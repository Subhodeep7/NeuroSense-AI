import os
import numpy as np
import librosa
import joblib

from sklearn.model_selection import train_test_split, cross_val_score
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
# HIGH ACCURACY FEATURE EXTRACTION
# =========================

def extract_features(audio_path):

    y, sr = librosa.load(audio_path, sr=None)
    y = librosa.util.normalize(y)

    # MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)

    # MFCC DELTA (NEW)
    delta = librosa.feature.delta(mfcc)
    delta_mean = np.mean(delta, axis=1)
    delta_std = np.std(delta, axis=1)

    # Chroma
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    # Spectral contrast
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    contrast_mean = np.mean(contrast, axis=1)

    # Spectral centroid (NEW)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    centroid_mean = np.mean(centroid)

    # Spectral bandwidth (NEW)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    bandwidth_mean = np.mean(bandwidth)

    # ZCR
    zcr = librosa.feature.zero_crossing_rate(y)
    zcr_mean = np.mean(zcr)

    # RMS
    rms = librosa.feature.rms(y=y)
    rms_mean = np.mean(rms)

    return np.concatenate([
        mfcc_mean,
        mfcc_std,
        delta_mean,
        delta_std,
        chroma_mean,
        contrast_mean,
        [centroid_mean],
        [bandwidth_mean],
        [zcr_mean],
        [rms_mean]
    ])


# =========================
# LOAD DATASET
# =========================

X = []
y = []

print("Extracting features...")

for label in ["healthy", "parkinsons"]:

    folder = os.path.join(DATASET_PATH, label)

    for file in os.listdir(folder):

        if file.endswith(".wav"):

            path = os.path.join(folder, file)

            features = extract_features(path)

            X.append(features)

            y.append(0 if label == "healthy" else 1)


X = np.array(X)
y = np.array(y)

print("Dataset size:", len(X))


# =========================
# SCALE
# =========================

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)


# =========================
# SPLIT
# =========================

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled,
    y,
    test_size=0.2,
    stratify=y,
    random_state=42
)


# =========================
# MODELS
# =========================

rf_model = RandomForestClassifier(
    n_estimators=1000,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

xgb_model = XGBClassifier(
    n_estimators=1000,
    learning_rate=0.01,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="logloss",
    random_state=42,
    n_jobs=-1
)

svm_model = SVC(
    kernel="rbf",
    probability=True,
    class_weight="balanced",
    C=10
)

lr_model = LogisticRegression(
    max_iter=2000,
    class_weight="balanced"
)


# =========================
# TRAIN
# =========================

print("Training models...")

rf_model.fit(X_train, y_train)
xgb_model.fit(X_train, y_train)
svm_model.fit(X_train, y_train)
lr_model.fit(X_train, y_train)


# =========================
# TEST ACCURACY
# =========================

print("\nTest Accuracy:")

print("RF:", accuracy_score(y_test, rf_model.predict(X_test)))
print("XGB:", accuracy_score(y_test, xgb_model.predict(X_test)))
print("SVM:", accuracy_score(y_test, svm_model.predict(X_test)))
print("LR:", accuracy_score(y_test, lr_model.predict(X_test)))


# =========================
# CROSS VALIDATION (REAL ACCURACY)
# =========================

print("\nCross Validation Accuracy:")

print("RF CV:", cross_val_score(rf_model, X_scaled, y, cv=5).mean())
print("XGB CV:", cross_val_score(xgb_model, X_scaled, y, cv=5).mean())
print("SVM CV:", cross_val_score(svm_model, X_scaled, y, cv=5).mean())
print("LR CV:", cross_val_score(lr_model, X_scaled, y, cv=5).mean())


# =========================
# SAVE
# =========================

joblib.dump(rf_model, SAVE_PATH + "/rf_model.pkl")
joblib.dump(xgb_model, SAVE_PATH + "/xgb_model.pkl")
joblib.dump(svm_model, SAVE_PATH + "/svm_model.pkl")
joblib.dump(lr_model, SAVE_PATH + "/lr_model.pkl")
joblib.dump(scaler, SAVE_PATH + "/scaler.pkl")

print("\nAll models saved successfully")