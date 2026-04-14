import torch
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image
from torchvision import transforms, models
import sys
import json
import os

IMG_SIZE = 224   # EfficientNet input size

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
    kernel = np.ones((3, 3), np.uint8)
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    rgb = cv2.merge([processed, processed, processed])
    return Image.fromarray(rgb)

# =========================
# TTA TRANSFORMS
# 5 views: original, H-flip, V-flip, 90-deg, 180-deg
# Must match training exactly
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
# INFERENCE
# =========================
try:
    BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "..", "saved-model", "handwriting_model.pth")

    # Build EfficientNet-B0 — must match training architecture exactly
    model = models.efficientnet_b0(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4),
        nn.Linear(1280, 256),
        nn.ReLU(),
        nn.Dropout(p=0.3),
        nn.Linear(256, 2),
    )

    if not os.path.exists(MODEL_PATH):
        raise Exception(f"Model not found at {MODEL_PATH}. Run train_handwriting.py first.")

    checkpoint = torch.load(MODEL_PATH, map_location="cpu")
    state_dict = (checkpoint["model_state_dict"]
                  if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint
                  else checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    # Check if model was trained with TTA
    tta_enabled = isinstance(checkpoint, dict) and checkpoint.get("tta_enabled", False)

    image_path = sys.argv[1]
    image = preprocess_image(image_path)
    if image is None:
        raise Exception("Could not read image: " + image_path)

    with torch.no_grad():
        if tta_enabled:
            # Average softmax across all 5 TTA views
            probs = torch.zeros(2)
            for t in TTA_TRANSFORMS:
                tensor = t(image).unsqueeze(0)
                probs += torch.softmax(model(tensor)[0], dim=0)
            probs /= len(TTA_TRANSFORMS)
        else:
            # Fallback: single-pass inference
            base_transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ])
            tensor = base_transform(image).unsqueeze(0)
            probs  = torch.softmax(model(tensor)[0], dim=0)

    prediction = int(probs.argmax().item())
    confidence = float(probs[prediction].item())

    print(json.dumps({
        "model":      "handwriting",
        "prediction": prediction,
        "confidence": confidence,
        "tta":        tta_enabled,
    }))

except Exception as e:
    print(json.dumps({
        "model":      "handwriting",
        "prediction": -1,
        "confidence": 0.0,
        "error":      str(e),
    }))