import torch
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image
from torchvision import transforms, models
import sys
import json
import os

IMG_SIZE     = 224
NUM_HC_FEATS = 4

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# =========================
# PREPROCESSING
# Identical pipeline to training
# =========================
def preprocess_image(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    thresh = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    kernel    = np.ones((3, 3), np.uint8)
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    rgb       = cv2.merge([processed, processed, processed])
    return Image.fromarray(rgb)


# =========================
# HANDCRAFTED FEATURE EXTRACTION
# Identical to training — must not drift
# =========================
def extract_handcrafted_features(pil_image):
    gray = np.array(pil_image.convert('L'))
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
    total_px  = gray.size

    # [0] Stroke smoothness
    edges             = cv2.Canny(gray, threshold1=50, threshold2=150)
    stroke_smoothness = float(np.sum(edges > 0)) / total_px

    # [1] Tremor frequency
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    perimeters   = [cv2.arcLength(c, True) for c in contours if cv2.arcLength(c, True) > 5]
    tremor_frequency = (
        float(np.std(perimeters) / (np.mean(perimeters) + 1e-6))
        if len(perimeters) > 1 else 0.0
    )

    # [2] Writing size (micrographia)
    ys, xs = np.where(binary > 0)
    if len(xs) > 0:
        bbox_area    = (int(xs.max()) - int(xs.min()) + 1) * (int(ys.max()) - int(ys.min()) + 1)
        writing_size = float(bbox_area) / total_px
    else:
        writing_size = 0.0

    # [3] Stroke thickness variation
    dist        = cv2.distanceTransform(binary, cv2.DIST_L2, maskSize=5)
    ink_widths  = dist[binary > 0]
    thickness_variation = (
        float(np.std(ink_widths) / (np.mean(ink_widths) + 1e-6))
        if len(ink_widths) > 0 else 0.0
    )

    features = np.array([
        np.clip(stroke_smoothness,   0.0, 1.0),
        np.clip(tremor_frequency,    0.0, 5.0) / 5.0,
        np.clip(writing_size,        0.0, 1.0),
        np.clip(thickness_variation, 0.0, 3.0) / 3.0,
    ], dtype=np.float32)

    return features


# =========================
# TTA TRANSFORMS (5 views, must match training)
# =========================
TTA_TRANSFORMS = [
    transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]),
    transforms.Compose([
        transforms.RandomHorizontalFlip(p=1.0),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]),
    transforms.Compose([
        transforms.RandomVerticalFlip(p=1.0),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]),
    transforms.Compose([
        transforms.RandomRotation(degrees=(90, 90)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]),
    transforms.Compose([
        transforms.RandomRotation(degrees=(180, 180)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]),
]


# =========================
# HYBRID MODEL
# Must match training architecture exactly
# =========================
class HybridModel(nn.Module):
    def __init__(self, num_handcrafted=NUM_HC_FEATS):
        super().__init__()
        backbone          = models.efficientnet_b0(weights=None)
        self.features_cnn = backbone.features
        self.avgpool      = backbone.avgpool

        self.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(1280 + num_handcrafted, 256),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(256, 2),
        )

    def forward(self, x_img, x_feat):
        cnn_out  = self.features_cnn(x_img)
        cnn_out  = self.avgpool(cnn_out)
        cnn_out  = torch.flatten(cnn_out, 1)
        combined = torch.cat([cnn_out, x_feat], 1)
        return self.classifier(combined)


# =========================
# INFERENCE
# =========================
try:
    BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "..", "saved-model", "handwriting_model.pth")

    if not os.path.exists(MODEL_PATH):
        raise Exception(f"Model not found at {MODEL_PATH}. Run train_handwriting.py first.")

    # Detect device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"USING DEVICE: {device}", file=sys.stderr)

    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)

    # Determine architecture from checkpoint
    arch = (checkpoint.get("architecture", "unknown")
            if isinstance(checkpoint, dict) else "unknown")

    is_hybrid    = ("hybrid" in arch)
    tta_enabled  = isinstance(checkpoint, dict) and checkpoint.get("tta_enabled", False)
    num_hc_feats = (checkpoint.get("num_hc_feats", NUM_HC_FEATS)
                    if isinstance(checkpoint, dict) else NUM_HC_FEATS)

    # Build model and move to device
    model = HybridModel(num_handcrafted=num_hc_feats).to(device)
    state_dict = (checkpoint["model_state_dict"]
                  if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint
                  else checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    # ── Load & preprocess image ──────────────────────────────────
    image_path = sys.argv[1]
    image      = preprocess_image(image_path)
    if image is None:
        raise Exception("Could not read image: " + image_path)

    # Extract handcrafted features (computed once — stable across TTA views)
    hc_feats     = extract_handcrafted_features(image)
    feat_tensor  = torch.tensor(hc_feats).unsqueeze(0).to(device)  # Move to GPU

    # ── Run inference ────────────────────────────────────────────
    with torch.no_grad():
        if tta_enabled:
            # Average softmax over 5 TTA views; features are image-invariant
            probs = torch.zeros(2).to(device)
            for t in TTA_TRANSFORMS:
                tensor = t(image).unsqueeze(0).to(device)
                probs += torch.softmax(model(tensor, feat_tensor)[0], dim=0)
            probs /= len(TTA_TRANSFORMS)
        else:
            base_transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ])
            tensor = base_transform(image).unsqueeze(0).to(device)
            probs  = torch.softmax(model(tensor, feat_tensor)[0], dim=0)
    
    # Move probs back to CPU for numpy/json
    probs = probs.cpu()

    prediction = int(probs.argmax().item())
    confidence = float(probs[prediction].item())

    # ── OpenCV Segmentation & Tracing ────────────────────────────
    # Segment blue pen strokes and overlay a colored trace based on result
    try:
        orig_img = cv2.imread(image_path)
        if orig_img is not None:
            # Convert to HSV for better blue segmentation
            hsv = cv2.cvtColor(orig_img, cv2.COLOR_BGR2HSV)
            # Blue range (adjust if necessary)
            lower_blue = np.array([90, 50, 50])
            upper_blue = np.array([130, 255, 255])
            mask = cv2.inRange(hsv, lower_blue, upper_blue)
            
            # Find contours of the blue strokes
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Determine trace color based on prediction/confidence
            # 0 = Normal, 1 = Parkinson's (High Risk if high confidence)
            trace_color = (0, 255, 0) # Green (Normal)
            risk_level = "LOW"
            
            if prediction == 1:
                if confidence > 0.75:
                    trace_color = (0, 0, 255) # Red (High Risk)
                    risk_level = "HIGH"
                else:
                    trace_color = (0, 255, 255) # Yellow (Moderate Risk)
                    risk_level = "MEDIUM"
            
            # Create a clean white canvas for the trace or overlay on original
            # Let's overlay on the original image for context
            annotated = orig_img.copy()
            cv2.drawContours(annotated, contours, -1, trace_color, 2)
            
            # Save annotated image
            base, ext = os.path.splitext(image_path)
            annotated_path = f"{base}_annotated{ext}"
            cv2.imwrite(annotated_path, annotated)
            annotated_name = os.path.basename(annotated_path)
        else:
            annotated_name = None
    except:
        annotated_name = None

    print(json.dumps({
        "model"        : "handwriting",
        "architecture" : arch,
        "prediction"   : prediction,
        "confidence"   : confidence,
        "risk_level"   : risk_level,
        "annotated_image": annotated_name,
        "tta"          : tta_enabled,
        "handcrafted_features": {
            "stroke_smoothness"   : float(hc_feats[0]),
            "tremor_frequency"    : float(hc_feats[1]),
            "writing_size"        : float(hc_feats[2]),
            "thickness_variation" : float(hc_feats[3]),
        },
    }))

except Exception as e:
    print(json.dumps({
        "model"      : "handwriting",
        "prediction" : -1,
        "confidence" : 0.0,
        "error"      : str(e),
    }))