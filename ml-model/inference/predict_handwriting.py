import torch
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image
from torchvision import transforms
import sys
import json
import os

# =========================
# CNN MODEL
# =========================
class CNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(1, 32, 3),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(32, 64, 3),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(64, 128, 3),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )
        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 14 * 14, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, 2)
        )

    def forward(self, x):
        return self.fc(self.conv(x))

# =========================
# PREPROCESSING
# =========================
def preprocess_image_cv(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None: return None
    
    img = cv2.resize(img, (128, 128))
    thresh = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    kernel = np.ones((3,3), np.uint8)
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    return Image.fromarray(processed)

# =========================
# INFERENCE
# =========================
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "..", "saved-model", "handwriting_model.pth")

    model = CNN()
    
    # Try to load model, if not ignore or error cleanly
    if os.path.exists(MODEL_PATH):
        # weights_only is not standard in old torch, better to just load cleanly
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        
    model.eval()

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5], std=[0.5])
    ])

    image_path = sys.argv[1]
    image = preprocess_image_cv(image_path)
    
    if image is None:
        raise Exception("Invalid image")
        
    image = transform(image).unsqueeze(0)

    with torch.no_grad():
        output = model(image)
        prob = torch.softmax(output, dim=1)
        prediction = torch.argmax(prob).item()
        confidence = float(prob[0][prediction])

    result = {
        "model": "handwriting",
        "prediction": prediction,
        "confidence": confidence
    }
    print(json.dumps(result))

except Exception as e:
    print(json.dumps({
        "model": "handwriting",
        "prediction": -1,
        "confidence": 0.0,
        "error": str(e)
    }))