import os
import numpy as np
import librosa
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score

from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier

DATASET_PATH = "voice_dataset"
SAVE_PATH = "../saved-model"

os.makedirs(SAVE_PATH, exist_ok=True)

# =========================
# FEATURE EXTRACTION
# =========================

def extract_features(y, sr):
    y = librosa.util.normalize(y)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)

    delta = librosa.feature.delta(mfcc)
    delta_mean = np.mean(delta, axis=1)
    delta_std = np.std(delta, axis=1)

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=5, fmin=200.0)
    contrast_mean = np.mean(contrast, axis=1)

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    centroid_mean = np.mean(centroid)

    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    bandwidth_mean = np.mean(bandwidth)

    zcr = librosa.feature.zero_crossing_rate(y)
    zcr_mean = np.mean(zcr)

    rms = librosa.feature.rms(y=y)
    rms_mean = np.mean(rms)

    # Pitch, Jitter, Shimmer proxies
    f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=50, fmax=300)
    if f0 is not None and np.any(voiced_flag):
        f0_voiced = f0[voiced_flag]
        pitch_mean = np.nanmean(f0_voiced)
        pitch_std = np.nanstd(f0_voiced)
        
        # Jitter proxy: absolute difference between consecutive f0
        if len(f0_voiced) > 1:
            jitter = np.mean(np.abs(np.diff(f0_voiced))) / pitch_mean
        else:
            jitter = 0
    else:
        pitch_mean = 0
        pitch_std = 0
        jitter = 0

    # Shimmer proxy: based on RMS variations
    rms_voiced = rms[0][:len(voiced_flag)][voiced_flag] if f0 is not None else rms[0]
    if len(rms_voiced) > 1 and np.mean(rms_voiced) > 0:
        shimmer = np.mean(np.abs(np.diff(rms_voiced))) / np.mean(rms_voiced)
    else:
        shimmer = 0

    return np.concatenate([
        mfcc_mean, mfcc_std, delta_mean, delta_std,
        chroma_mean, contrast_mean,
        [centroid_mean, bandwidth_mean, zcr_mean, rms_mean],
        [pitch_mean, pitch_std, jitter, shimmer]
    ])

def augment_audio(y, sr):
    versions = [y]
    # Noise addition
    noise = np.random.randn(len(y))
    versions.append(y + 0.005 * noise)
    # Pitch shifting
    versions.append(librosa.effects.pitch_shift(y, sr=sr, n_steps=2))
    versions.append(librosa.effects.pitch_shift(y, sr=sr, n_steps=-2))
    # Time stretching
    versions.append(librosa.effects.time_stretch(y, rate=1.1))
    return versions

# =========================
# LOAD DATASET
# =========================

X = []
y_labels = []

print("Extracting features with data augmentation (this may take a while)...")

for label in ["healthy", "parkinsons"]:
    folder = os.path.join(DATASET_PATH, label)
    if not os.path.exists(folder):
        continue

    for file in os.listdir(folder):
        if not file.endswith(".wav"):
            continue

        path = os.path.join(folder, file)
        try:
            y, sr = librosa.load(path, sr=None)
            audio_versions = augment_audio(y, sr)
            
            for aug_y in audio_versions:
                features = extract_features(aug_y, sr)
                X.append(features)
                y_labels.append(0 if label == "healthy" else 1)
        except Exception as e:
            print(f"Skipping file {file}: {e}")

X = np.array(X)
y = np.array(y_labels)

print("Dataset size after augmentation:", len(X))

if len(X) == 0:
    print("No data found! Skipping training.")
    exit()

# =========================
# SCALE & SPLIT
# =========================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, stratify=y, random_state=42
)

# =========================
# MODELS
# =========================
rf_model = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
xgb_model = XGBClassifier(n_estimators=100, learning_rate=0.01, max_depth=6, subsample=0.8, colsample_bytree=0.8, eval_metric="logloss", random_state=42, n_jobs=-1)
svm_model = SVC(kernel="rbf", probability=True, class_weight="balanced", C=10)
lr_model = LogisticRegression(max_iter=2000, class_weight="balanced")

print("Training models...")
rf_model.fit(X_train, y_train)
xgb_model.fit(X_train, y_train)
svm_model.fit(X_train, y_train)
lr_model.fit(X_train, y_train)

# =========================
# TEST ACCURACY (Augmented test set)
# =========================
print("\nTest Accuracy:")
print("RF:", accuracy_score(y_test, rf_model.predict(X_test)))
print("XGB:", accuracy_score(y_test, xgb_model.predict(X_test)))
print("SVM:", accuracy_score(y_test, svm_model.predict(X_test)))
print("LR:", accuracy_score(y_test, lr_model.predict(X_test)))

# =========================
# SAVE
# =========================
joblib.dump(rf_model, os.path.join(SAVE_PATH, "rf_model.pkl"))
joblib.dump(xgb_model, os.path.join(SAVE_PATH, "xgb_model.pkl"))
joblib.dump(svm_model, os.path.join(SAVE_PATH, "svm_model.pkl"))
joblib.dump(lr_model, os.path.join(SAVE_PATH, "lr_model.pkl"))
joblib.dump(scaler, os.path.join(SAVE_PATH, "scaler.pkl"))

print("\nAll models saved successfully.")