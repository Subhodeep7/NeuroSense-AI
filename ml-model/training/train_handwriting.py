import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms, models
from sklearn.metrics import classification_report, confusion_matrix
from PIL import Image
import copy

DATASET_PATH = "handwriting_dataset"
SAVE_PATH    = "../saved-model"
os.makedirs(SAVE_PATH, exist_ok=True)

DEVICE        = torch.device("cuda" if torch.cuda.is_available() else "cpu")
EPOCHS        = 60
BATCH_SIZE    = 16
LR            = 3e-4
PATIENCE      = 12
IMG_SIZE      = 224
NUM_HC_FEATS  = 4   # number of handcrafted features

print(f"Using device: {DEVICE}")

# =========================
# PREPROCESSING
# =========================
def preprocess_image(image_path):
    """Load image, convert to grayscale, adaptive threshold, denoise, return RGB PIL."""
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
# Step 2 of the hybrid pipeline:
#   [0] stroke_smoothness   – edge density (tremor -> jagged edges -> higher value)
#   [1] tremor_frequency    – normalised contour perimeter variance
#   [2] writing_size        – ink bounding-box area ratio (micrographia -> lower)
#   [3] thickness_variation – normalised stroke-width std (inconsistency -> higher)
# All 4 features are normalised to [0, 1] range via clipping.
# =========================
def extract_handcrafted_features(pil_image):
    """
    Given a preprocessed PIL image (already thresholded/binary),
    extract 4 handcrafted clinical features.
    Returns: np.float32 array of shape (4,)
    """
    # Work on grayscale numpy
    gray = np.array(pil_image.convert('L'))

    # Binary mask of ink pixels
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
    total_px  = gray.size  # IMG_SIZE * IMG_SIZE

    # ── Feature 0: Stroke smoothness (edge irregularity) ────────────
    # More jagged/tremory strokes → denser Canny edges
    edges             = cv2.Canny(gray, threshold1=50, threshold2=150)
    stroke_smoothness = float(np.sum(edges > 0)) / total_px  # in [0, ~0.3]

    # ── Feature 1: Tremor frequency (contour perimeter variation) ───
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    perimeters   = [cv2.arcLength(c, True) for c in contours if cv2.arcLength(c, True) > 5]
    if len(perimeters) > 1:
        tremor_frequency = float(np.std(perimeters) / (np.mean(perimeters) + 1e-6))
    else:
        tremor_frequency = 0.0

    # ── Feature 2: Writing size (bounding box area, micrographia) ───
    ys, xs = np.where(binary > 0)
    if len(xs) > 0:
        bbox_area    = (int(xs.max()) - int(xs.min()) + 1) * (int(ys.max()) - int(ys.min()) + 1)
        writing_size = float(bbox_area) / total_px  # in [0, 1]
    else:
        writing_size = 0.0

    # ── Feature 3: Stroke thickness variation ───────────────────────
    # Distance transform gives approximate stroke half-width at each ink pixel
    dist      = cv2.distanceTransform(binary, cv2.DIST_L2, maskSize=5)
    ink_widths = dist[binary > 0]
    if len(ink_widths) > 0:
        thickness_variation = float(np.std(ink_widths) / (np.mean(ink_widths) + 1e-6))
    else:
        thickness_variation = 0.0

    # Clip to reasonable ranges to prevent outlier blow-up
    features = np.array([
        np.clip(stroke_smoothness,    0.0, 1.0),
        np.clip(tremor_frequency,     0.0, 5.0) / 5.0,   # normalise
        np.clip(writing_size,         0.0, 1.0),
        np.clip(thickness_variation,  0.0, 3.0) / 3.0,   # normalise
    ], dtype=np.float32)

    return features


# =========================
# DATASET
# =========================
class SpiralDataset(Dataset):
    """Base dataset — stores (path, label) pairs, does no transform."""
    def __init__(self, root_dir, transform=None):
        self.transform = transform
        self.samples   = []
        for label, cls in enumerate(["Healthy", "Parkinson"]):
            cls_dir = os.path.join(root_dir, cls)
            if not os.path.exists(cls_dir):
                print(f"  [WARNING] Missing folder: {cls_dir}")
                continue
            files = [f for f in os.listdir(cls_dir)
                     if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp'))]
            for f in files:
                self.samples.append((os.path.join(cls_dir, f), label))
            print(f"  {cls}: {len(files)} images")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = preprocess_image(path)
        if img is None:
            img = Image.fromarray(np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8))
        feats = extract_handcrafted_features(img)
        if self.transform:
            img = self.transform(img)
        return img, torch.tensor(feats), label


IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_transform = transforms.Compose([
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.3),
    transforms.RandomRotation(degrees=30),
    transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.8, 1.2), shear=15),
    transforms.ColorJitter(brightness=0.4, contrast=0.4),
    transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    transforms.RandomErasing(p=0.2, scale=(0.02, 0.1)),
])

val_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])

# 5 TTA views: original, H-flip, V-flip, 90-deg, 180-deg
tta_transforms = [
    transforms.Compose([transforms.ToTensor(),
                        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)]),
    transforms.Compose([transforms.RandomHorizontalFlip(p=1.0),
                        transforms.ToTensor(),
                        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)]),
    transforms.Compose([transforms.RandomVerticalFlip(p=1.0),
                        transforms.ToTensor(),
                        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)]),
    transforms.Compose([transforms.RandomRotation(degrees=(90, 90)),
                        transforms.ToTensor(),
                        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)]),
    transforms.Compose([transforms.RandomRotation(degrees=(180, 180)),
                        transforms.ToTensor(),
                        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)]),
]

# =========================
# LOAD DATASET
# =========================
print(f"\nLoading dataset from: {DATASET_PATH}")
full_dataset = SpiralDataset(DATASET_PATH, transform=None)

if len(full_dataset) == 0:
    print("No data found! Check the handwriting_dataset folder.")
    exit()

print(f"Total images: {len(full_dataset)}")

# 80/20 split
train_size = int(0.8 * len(full_dataset))
val_size   = len(full_dataset) - train_size
train_idx, val_idx = torch.utils.data.random_split(range(len(full_dataset)), [train_size, val_size])


class SubsetWithTransform(Dataset):
    """Applies a transform to a subset; also extracts handcrafted features."""
    def __init__(self, base, indices, transform):
        self.base      = base
        self.indices   = list(indices)
        self.transform = transform

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, i):
        path, label = self.base.samples[self.indices[i]]
        img = preprocess_image(path)
        if img is None:
            img = Image.fromarray(np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8))
        feats = extract_handcrafted_features(img)
        return self.transform(img), torch.tensor(feats), label


train_ds = SubsetWithTransform(full_dataset, train_idx, train_transform)
val_ds   = SubsetWithTransform(full_dataset, val_idx,   val_transform)

# Weighted sampler for class balance
labels_train  = [full_dataset.samples[i][1] for i in list(train_idx)]
class_counts  = np.bincount(labels_train)
sample_weights = [1.0 / class_counts[l] for l in labels_train]
sampler        = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)

train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,   num_workers=0)

print(f"Train: {len(train_ds)}  |  Val: {len(val_ds)}")
print(f"Class -- Healthy: {class_counts[0]}  Parkinsons: {class_counts[1]}")

# =========================
# WEIGHTED LOSS
# Penalise missing a PD patient 1.5x more than a false alarm
# =========================
total_train   = class_counts[0] + class_counts[1]
class_weights = torch.tensor([
    total_train / (2.0 * class_counts[0]),
    total_train / (2.0 * class_counts[1]) * 1.5,   # Parkinsons 1.5x boost
], dtype=torch.float).to(DEVICE)
print(f"Loss weights -- Healthy: {class_weights[0]:.3f}  Parkinsons: {class_weights[1]:.3f}")

# =========================
# MIXUP HELPERS
# =========================
def mixup_data(x, y, alpha=0.3):
    lam = np.random.beta(alpha, alpha) if alpha > 0 else 1.0
    idx = torch.randperm(x.size(0)).to(DEVICE)
    return lam * x + (1 - lam) * x[idx], y, y[idx], lam, idx

def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


# =========================
# HYBRID MODEL
# Step 3 + 4: EfficientNet-B0 deep features  +  4 handcrafted features
#
# Architecture:
#   Image (224x224) ──► EfficientNet-B0 backbone ──► 1280-d
#                                                          │
#   Handcrafted (4-d) ─────────────────────────────────────┤
#                                                          │
#                                              Concat → 1284-d
#                                                          │
#                                           Dense (256) → ReLU
#                                                          │
#                                              Output (2 classes)
# =========================
class HybridModel(nn.Module):
    def __init__(self, num_handcrafted=NUM_HC_FEATS):
        super().__init__()
        backbone          = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)
        self.features_cnn = backbone.features
        self.avgpool      = backbone.avgpool   # adaptive avg pool -> (batch, 1280, 1, 1)

        self.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(1280 + num_handcrafted, 256),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(256, 2),
        )

    def forward(self, x_img, x_feat):
        cnn_out = self.features_cnn(x_img)          # (B, 1280, 7, 7)
        cnn_out = self.avgpool(cnn_out)              # (B, 1280, 1, 1)
        cnn_out = torch.flatten(cnn_out, 1)          # (B, 1280)
        combined = torch.cat([cnn_out, x_feat], 1)  # (B, 1284)
        return self.classifier(combined)

    def freeze_backbone(self):
        for p in self.features_cnn.parameters():
            p.requires_grad = False

    def unfreeze_backbone(self):
        for p in self.features_cnn.parameters():
            p.requires_grad = True


model = HybridModel().to(DEVICE)

total_params     = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"\nHybrid EfficientNet-B0 loaded (ImageNet weights)")
print(f"Total params: {total_params:,}  |  Trainable: {trainable_params:,}")
print(f"Handcrafted features: {NUM_HC_FEATS}  "
      f"(smoothness, tremor_freq, writing_size, thickness_var)")

criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.05)

# =========================
# PHASE 1 — Warm up classifier head (5 epochs, high LR)
# Backbone frozen so only the new 1284->256->2 head trains
# =========================
model.freeze_backbone()
optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                        lr=1e-3, weight_decay=1e-4)

print("\n-- Phase 1: Warming up classifier head (5 epochs) --")
for epoch in range(1, 6):
    model.train()
    train_loss = 0.0
    for imgs, feats, lbls in train_loader:
        imgs  = imgs.to(DEVICE)
        feats = feats.to(DEVICE)
        lbls  = lbls.to(DEVICE)
        optimizer.zero_grad()
        loss = criterion(model(imgs, feats), lbls)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        train_loss += loss.item()

    model.eval()
    correct = total_n = 0
    with torch.no_grad():
        for imgs, feats, lbls in val_loader:
            imgs  = imgs.to(DEVICE)
            feats = feats.to(DEVICE)
            lbls  = lbls.to(DEVICE)
            correct  += (model(imgs, feats).argmax(1) == lbls).sum().item()
            total_n  += lbls.size(0)
    print(f"  Epoch {epoch}/5 - Loss: {train_loss/len(train_loader):.4f}  "
          f"Val Acc: {correct/total_n:.1%}")

# =========================
# PHASE 2 — Unfreeze all + fine-tune with Mixup & OneCycleLR
# =========================
print("\n-- Phase 2: Fine-tuning all layers (Mixup + OneCycleLR) --")
model.unfreeze_backbone()

optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
scheduler = optim.lr_scheduler.OneCycleLR(
    optimizer,
    max_lr=LR,
    steps_per_epoch=len(train_loader),
    epochs=EPOCHS,
    pct_start=0.1,
    anneal_strategy='cos',
)

best_val_loss  = float("inf")
best_val_acc   = 0.0
best_weights   = None
patience_count = 0

print(f"{'Epoch':>6} | {'Train Loss':>10} | {'Val Loss':>8} | {'Val Acc':>7} | {'LR':>8}")
print("-" * 55)

for epoch in range(1, EPOCHS + 1):
    model.train()
    train_loss = 0.0
    for imgs, feats, lbls in train_loader:
        imgs  = imgs.to(DEVICE)
        feats = feats.to(DEVICE)
        lbls  = lbls.to(DEVICE)
        optimizer.zero_grad()

        # Apply Mixup on 50% of batches
        if np.random.random() < 0.5:
            imgs_m, y_a, y_b, lam, perm = mixup_data(imgs, lbls)
            # Also mix features with the same permutation / lambda
            feats_m = lam * feats + (1 - lam) * feats[perm]
            loss = mixup_criterion(criterion, model(imgs_m, feats_m), y_a, y_b, lam)
        else:
            loss = criterion(model(imgs, feats), lbls)

        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        train_loss += loss.item()

    train_loss /= len(train_loader)

    model.eval()
    val_loss = correct = total_n = 0
    with torch.no_grad():
        for imgs, feats, lbls in val_loader:
            imgs  = imgs.to(DEVICE)
            feats = feats.to(DEVICE)
            lbls  = lbls.to(DEVICE)
            out       = model(imgs, feats)
            val_loss += criterion(out, lbls).item()
            correct  += (out.argmax(1) == lbls).sum().item()
            total_n  += lbls.size(0)

    val_loss /= len(val_loader)
    val_acc   = correct / total_n if total_n > 0 else 0.0
    current_lr = optimizer.param_groups[0]["lr"]
    print(f"{epoch:>6} | {train_loss:>10.4f} | {val_loss:>8.4f} | "
          f"{val_acc:>6.1%} | {current_lr:>8.2e}")

    if val_loss < best_val_loss:
        best_val_loss  = val_loss
        best_val_acc   = val_acc
        best_weights   = copy.deepcopy(model.state_dict())
        patience_count = 0
    else:
        patience_count += 1
        if patience_count >= PATIENCE:
            print(f"\nEarly stopping at epoch {epoch}")
            break

# =========================
# FINAL EVALUATION WITH TTA
# Features are image-invariant (computed once per image, not per TTA view)
# We average softmax across 5 augmented views but keep features fixed
# =========================
print(f"\nBest Val Accuracy (no TTA): {best_val_acc:.2%}  |  "
      f"Best Val Loss: {best_val_loss:.4f}")

model.load_state_dict(best_weights)
model.eval()

print("\nRunning Test-Time Augmentation (TTA) on validation set...")
val_samples = [(full_dataset.samples[i][0], full_dataset.samples[i][1])
               for i in list(val_idx)]
tta_preds, tta_labels = [], []

with torch.no_grad():
    for path, label in val_samples:
        img = preprocess_image(path)
        if img is None:
            tta_preds.append(0)
            tta_labels.append(label)
            continue

        # Handcrafted features are stable — compute once per image
        feats      = extract_handcrafted_features(img)
        feat_tensor = torch.tensor(feats).unsqueeze(0).to(DEVICE)

        # Average softmax over 5 TTA views
        probs = torch.zeros(2).to(DEVICE)
        for t in tta_transforms:
            tensor = t(img).unsqueeze(0).to(DEVICE)
            probs += torch.softmax(model(tensor, feat_tensor)[0], dim=0)
        probs /= len(tta_transforms)

        tta_preds.append(probs.argmax().item())
        tta_labels.append(label)

print("\nClassification Report (with TTA):")
print(classification_report(tta_labels, tta_preds, target_names=["Healthy", "Parkinsons"]))
print("Confusion Matrix:")
print(confusion_matrix(tta_labels, tta_preds))

# =========================
# SAVE
# =========================
save_path = os.path.join(SAVE_PATH, "handwriting_model.pth")
torch.save({
    "model_state_dict" : best_weights,
    "val_accuracy"     : best_val_acc,
    "val_loss"         : best_val_loss,
    "img_size"         : IMG_SIZE,
    "architecture"     : "efficientnet_b0_hybrid",
    "num_hc_feats"     : NUM_HC_FEATS,
    "tta_enabled"      : True,
}, save_path)
print(f"\nModel saved -> {save_path}")
print(f"Training complete. Best accuracy: {best_val_acc:.1%}")