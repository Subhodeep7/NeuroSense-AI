import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
import sys
import json
import os


class CNN(nn.Module):

    def __init__(self):
        super().__init__()

        self.conv = nn.Sequential(
            nn.Conv2d(1, 32, 3),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, 3),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )

        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 30 * 30, 128),
            nn.ReLU(),
            nn.Linear(128, 2)
        )

    def forward(self, x):
        x = self.conv(x)
        x = self.fc(x)
        return x


# ---------------------------
# Load model safely
# ---------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "saved-model", "handwriting_model.pth")

model = CNN()
model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
model.eval()


# ---------------------------
# Image preprocessing
# ---------------------------

transform = transforms.Compose([
    transforms.Grayscale(),
    transforms.Resize((128, 128)),
    transforms.ToTensor()
])


# ---------------------------
# Input image
# ---------------------------

image_path = sys.argv[1]

image = Image.open(image_path)
image = transform(image).unsqueeze(0)


# ---------------------------
# Prediction
# ---------------------------

with torch.no_grad():

    output = model(image)

    prob = torch.softmax(output, dim=1)

    prediction = torch.argmax(prob).item()

    confidence = float(prob[0][prediction])


# ---------------------------
# JSON output
# ---------------------------

result = {
    "model": "handwriting",
    "prediction": prediction,
    "confidence": confidence
}

print(json.dumps(result))