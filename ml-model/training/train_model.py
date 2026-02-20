import os
import numpy as np
import librosa
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score


DATASET_PATH = "voice_dataset"


def extract_features(audio_path):
    y, sr = librosa.load(audio_path, sr=None)

    # normalize audio
    y = librosa.util.normalize(y)

    # MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)

    # Chroma
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    # Spectral contrast
    contrast = librosa.feature.spectral_contrast(
        y=y,
        sr=sr,
        n_bands=5,
        fmin=200.0
    )
    contrast_mean = np.mean(contrast, axis=1)

    # Zero Crossing Rate
    zcr = librosa.feature.zero_crossing_rate(y)
    zcr_mean = np.mean(zcr)

    # RMS energy
    rms = librosa.feature.rms(y=y)
    rms_mean = np.mean(rms)

    return np.concatenate([
        mfcc_mean,
        mfcc_std,
        chroma_mean,
        contrast_mean,
        [zcr_mean],
        [rms_mean]
    ])



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


scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)


X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42, stratify=y
)


model = RandomForestClassifier(
    n_estimators=500,
    max_depth=None,
    min_samples_split=2,
    class_weight="balanced",
    random_state=42
)

model.fit(X_train, y_train)


y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("Accuracy:", accuracy)


joblib.dump(model, "../saved-model/parkinsons_model.pkl")
joblib.dump(scaler, "../saved-model/scaler.pkl")

print("Model saved successfully")
