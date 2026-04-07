import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image

DATASET_PATH = "handwriting_dataset"
SAVE_PATH = "../saved-model"
os.makedirs(SAVE_PATH, exist_ok=True)

# =========================
# IMAGE PREPROCESSING
# =========================
def preprocess_image_cv(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None: return None
    
    # 1. Resize
    img = cv2.resize(img, (128, 128))
    
    # 2. Adaptive Thresholding (emphasizes stroke variations)
    thresh = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # 3. Morphological operations (tremor/curvature enhancement)
    kernel = np.ones((3,3), np.uint8)
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    return Image.fromarray(processed)

# =========================
# DATASET CLASS
# =========================
class SpiralDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        
        for label, class_name in enumerate(["healthy", "parkinsons"]):
            class_dir = os.path.join(root_dir, class_name)
            if not os.path.exists(class_dir): continue
            for file in os.listdir(class_dir):
                if file.endswith(('.png', '.jpg', '.jpeg')):
                    self.samples.append((os.path.join(class_dir, file), label))
                    
    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = preprocess_image_cv(path)
        if img is None:
            # Fallback black image
            img = Image.fromarray(np.zeros((128, 128), dtype=np.uint8))
            
        if self.transform:
            img = self.transform(img)
            
        return img, label

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
# TRAINING SCRIPT
# =========================
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5], std=[0.5])
])

dataset = SpiralDataset(DATASET_PATH, transform=transform)

if len(dataset) == 0:
    print("No handwriting data found! Skipping training.")
    exit()

train_size = int(0.8 * len(dataset))
test_size = len(dataset) - train_size
train_dataset, test_dataset = torch.utils.data.random_split(dataset, [train_size, test_size])

train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=16, shuffle=False)

model = CNN()
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

epochs = 10
print("Training Handwriting CNN...")

for epoch in range(epochs):
    model.train()
    running_loss = 0.0
    for images, labels in train_loader:
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item()
        
    print(f"Epoch {epoch+1}/{epochs}, Loss: {running_loss/len(train_loader):.4f}")

# Evaluation
model.eval()
correct = 0
total = 0
with torch.no_grad():
    for images, labels in test_loader:
        outputs = model(images)
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

if total > 0:
    print(f"Test Accuracy: {100 * correct / total:.2f}%")

torch.save(model.state_dict(), os.path.join(SAVE_PATH, "handwriting_model.pth"))
print("Model saved to", os.path.join(SAVE_PATH, "handwriting_model.pth"))