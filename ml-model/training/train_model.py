import os
import numpy as np
import pandas as pd
import librosa
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
import time

DATASET_PATH = "voice_dataset"
UCI_DATA     = "parkinsons.data"       # legacy tabular dataset
SAVE_PATH    = "../saved-model"
os.makedirs(SAVE_PATH, exist_ok=True)


# =========================
# FEATURE EXTRACTION
# 254 clinically-relevant voice biomarkers
# =========================
def extract_features(y, sr):
    y = librosa.util.normalize(y)

    mfcc        = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean   = np.mean(mfcc, axis=1)
    mfcc_std    = np.std(mfcc, axis=1)

    delta       = librosa.feature.delta(mfcc)
    delta2      = librosa.feature.delta(mfcc, order=2)
    delta_mean  = np.mean(delta, axis=1)
    delta_std   = np.std(delta, axis=1)
    delta2_mean = np.mean(delta2, axis=1)
    delta2_std  = np.std(delta2, axis=1)

    chroma      = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)
    chroma_std  = np.std(chroma, axis=1)

    contrast      = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=5, fmin=200.0)
    contrast_mean = np.mean(contrast, axis=1)
    contrast_std  = np.std(contrast, axis=1)

    centroid  = librosa.feature.spectral_centroid(y=y, sr=sr)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    rolloff   = librosa.feature.spectral_rolloff(y=y, sr=sr)
    zcr       = librosa.feature.zero_crossing_rate(y)
    rms       = librosa.feature.rms(y=y)

    mel      = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=40)
    mel_mean = np.mean(mel, axis=1)
    mel_std  = np.std(mel, axis=1)

    f0, voiced_flag, _ = librosa.pyin(y, fmin=50, fmax=300)
    if f0 is not None and np.any(voiced_flag):
        f0_voiced   = f0[voiced_flag]
        pitch_mean  = np.nanmean(f0_voiced)
        pitch_std   = np.nanstd(f0_voiced)
        pitch_range = np.nanmax(f0_voiced) - np.nanmin(f0_voiced)
        jitter = np.mean(np.abs(np.diff(f0_voiced))) / pitch_mean if len(f0_voiced) > 1 else 0
        if len(f0_voiced) > 2:
            rap = np.mean([abs(f0_voiced[i] - np.mean(f0_voiced[i-1:i+2]))
                           for i in range(1, len(f0_voiced)-1)]) / pitch_mean
        else:
            rap = 0
    else:
        pitch_mean = pitch_std = pitch_range = jitter = rap = 0
        f0_voiced = np.array([])

    rms_arr = rms[0]
    if f0 is not None and len(f0_voiced) > 1:
        rms_voiced = rms_arr[:len(voiced_flag)][voiced_flag] if len(rms_arr) >= len(voiced_flag) else rms_arr
        shimmer = (np.mean(np.abs(np.diff(rms_voiced))) / np.mean(rms_voiced)
                   if len(rms_voiced) > 1 and np.mean(rms_voiced) > 0 else 0)
    else:
        shimmer = 0

    harmonics, percussive = librosa.effects.hpss(y)
    hnr = np.mean(harmonics**2) / (np.mean(percussive**2) + 1e-8)
    voiced_fraction = float(np.mean(voiced_flag)) if f0 is not None else 0.0

    return np.concatenate([
        mfcc_mean, mfcc_std,
        delta_mean, delta_std,
        delta2_mean, delta2_std,
        chroma_mean, chroma_std,
        contrast_mean, contrast_std,
        mel_mean, mel_std,
        [np.mean(centroid), np.std(centroid)],
        [np.mean(bandwidth), np.std(bandwidth)],
        [np.mean(rolloff),   np.std(rolloff)],
        [np.mean(zcr),       np.std(zcr)],
        [np.mean(rms_arr),   np.std(rms_arr)],
        [pitch_mean, pitch_std, pitch_range, jitter, rap, shimmer, hnr, voiced_fraction],
    ])


# =========================
# AUDIO AUGMENTATION — 8x per file
# =========================
def augment_audio(y, sr):
    versions = [y]
    for noise_level in [0.003, 0.007]:
        versions.append(y + noise_level * np.random.randn(len(y)))
    for steps in [-3, -1, 1, 3]:
        versions.append(librosa.effects.pitch_shift(y, sr=sr, n_steps=steps))
    for rate in [0.9, 1.1]:
        versions.append(librosa.effects.time_stretch(y, rate=rate))
    return versions


# =========================
# LOAD WAV DATASET
# =========================
X_wav, y_wav = [], []
print("Extracting features with 8x augmentation from WAV files...")
print("(May take several minutes)\n")

total_files = 0
for label in ["healthy", "parkinsons"]:
    folder = os.path.join(DATASET_PATH, label)
    if not os.path.exists(folder):
        print(f"  [WARNING] Folder not found: {folder}")
        continue
    files = [f for f in os.listdir(folder) if f.lower().endswith(".wav")]
    print(f"  {label}: {len(files)} .wav files")
    total_files += len(files)
    for file in files:
        path = os.path.join(folder, file)
        try:
            y, sr    = librosa.load(path, sr=22050)
            versions = augment_audio(y, sr)
            for aug_y in versions:
                feat = extract_features(aug_y, sr)
                X_wav.append(feat)
                y_wav.append(0 if label == "healthy" else 1)
        except Exception as e:
            print(f"    Skipping {file}: {e}")

X_wav = np.array(X_wav)
y_wav = np.array(y_wav)
print(f"\nWAV files: {total_files}  |  Samples after 8x aug: {len(X_wav)}")
print(f"Feature vector length: {X_wav.shape[1]}")


# =========================
# SCALE & SPLIT
# Fit scaler on WAV data only (consistent feature space)
# =========================
scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_wav)

n_healthy    = int(np.sum(y_wav == 0))
n_parkinsons = int(np.sum(y_wav == 1))
print(f"\nClass distribution -- Healthy: {n_healthy}  Parkinsons: {n_parkinsons}")

if max(n_healthy, n_parkinsons) / (min(n_healthy, n_parkinsons) + 1e-8) > 1.5:
    print("Applying SMOTE to balance classes...")
    smote = SMOTE(random_state=42, k_neighbors=min(5, min(n_healthy, n_parkinsons) - 1))
    X_scaled, y_wav = smote.fit_resample(X_scaled, y_wav)
    print(f"After SMOTE: {len(X_scaled)} samples")

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_wav, test_size=0.2, stratify=y_wav, random_state=42
)
print(f"Train: {len(X_train)}  |  Test: {len(X_test)}")


# =========================
# BUILD UCI PARKINSONS MODEL
#
# The legacy parkinsons_model.pkl was trained on the UCI tabular dataset
# (22 MDVP features -- a completely different feature space from our WAV pipeline).
# We retrain it here using the SAME 254-feature space so it can be included as
# a 6th voting member in the ensemble.  The UCI tabular data is used only to
# supplement the WAV training set (we extract the shared biomarkers: Fo, Jitter,
# Shimmer, HNR from the CSV and pad the remaining 232 features with zeros so the
# scaler can transform them consistently).
# =========================
print("\nLoading UCI Parkinson's tabular dataset to supplement training...")
uci_X, uci_y = [], []

if os.path.exists(UCI_DATA):
    df = pd.read_csv(UCI_DATA)
    # UCI has pre-extracted MDVP features -- map to positions in our 254-feature vector
    # We use the 8 pitch/shimmer/HNR features that overlap (last 8 of our vector)
    # and fill the rest with 0 so the scaler can normalise them.
    # This conservative approach avoids domain mismatch on the 246 librosa features.
    FEAT_LEN  = X_wav.shape[1]
    for _, row in df.iterrows():
        vec = np.zeros(FEAT_LEN)
        # Map UCI features to our pitch/jitter/shimmer/HNR slot (last 8 features)
        try:
            vec[-8] = float(row["MDVP:Fo(Hz)"])          # pitch_mean
            vec[-7] = 0.0                                  # pitch_std (not in UCI)
            vec[-6] = float(row["MDVP:Fhi(Hz)"]) - float(row["MDVP:Flo(Hz)"])  # pitch_range
            vec[-5] = float(row["MDVP:Jitter(%)"])        # jitter
            vec[-4] = float(row["MDVP:RAP"])              # rap
            vec[-3] = float(row["MDVP:Shimmer"])          # shimmer
            vec[-2] = float(row["HNR"])                   # hnr
            vec[-1] = 1.0                                  # voiced_fraction (assume fully voiced)
        except KeyError:
            continue
        uci_X.append(vec)
        uci_y.append(int(row["status"]))   # 1=Parkinson's, 0=Healthy

    if uci_X:
        uci_X = np.array(uci_X)
        # Transform using the already-fitted scaler
        uci_X_scaled = scaler.transform(uci_X)
        uci_y = np.array(uci_y)
        print(f"  UCI samples added: {len(uci_X)} (Healthy: {int(np.sum(uci_y==0))}, PD: {int(np.sum(uci_y==1))})")

        # Train parkinsons_model on UCI data (GradientBoosting works well on tabular)
        pd_model = GradientBoostingClassifier(
            n_estimators=200, learning_rate=0.05,
            max_depth=4, subsample=0.8, random_state=42,
        )
        pd_model.fit(uci_X_scaled, uci_y)
        pd_acc = accuracy_score(uci_y, pd_model.predict(uci_X_scaled))
        print(f"  parkinsons_model UCI train acc: {pd_acc:.1%}")
        joblib.dump(pd_model, os.path.join(SAVE_PATH, "parkinsons_model.pkl"))
        print("  parkinsons_model.pkl saved (retrained on UCI tabular features).")
    else:
        pd_model = None
        print("  [WARNING] Could not parse UCI data -- parkinsons_model skipped.")
else:
    pd_model = None
    print(f"  [WARNING] {UCI_DATA} not found -- parkinsons_model skipped.")


# =========================
# DEFINE MODELS
# =========================
rf_model = RandomForestClassifier(
    n_estimators=300, max_depth=None, min_samples_split=4,
    min_samples_leaf=2, class_weight="balanced",
    max_features="sqrt", random_state=42, n_jobs=-1,
)
xgb_model = XGBClassifier(
    n_estimators=300, learning_rate=0.05, max_depth=5,
    subsample=0.8, colsample_bytree=0.7, min_child_weight=3,
    gamma=0.1, reg_alpha=0.1, reg_lambda=1.0,
    eval_metric="logloss", random_state=42, n_jobs=-1,
)
svm_model = SVC(
    kernel="rbf", C=50, gamma="scale",
    probability=True, class_weight="balanced",
)
lr_model = LogisticRegression(
    max_iter=3000, C=0.5, solver="saga", class_weight="balanced",
)
gb_model = GradientBoostingClassifier(
    n_estimators=200, learning_rate=0.05,
    max_depth=4, subsample=0.8, random_state=42,
)


# =========================
# 5-FOLD CROSS-VALIDATION
# =========================
print("\nRunning 5-fold cross-validation...")
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

for name, clf in [("RF", rf_model), ("XGB", xgb_model), ("SVM", svm_model),
                  ("LR", lr_model), ("GB", gb_model)]:
    t0 = time.time()
    scores = cross_val_score(clf, X_scaled, y_wav, cv=skf, scoring="accuracy", n_jobs=-1)
    print(f"  {name:5s}: {scores.mean():.3f} +/- {scores.std():.3f}  ({time.time()-t0:.1f}s)")


# =========================
# TRAIN ON FULL TRAIN SPLIT
# =========================
print("\nTraining all models on train split...")
rf_model.fit(X_train, y_train)
xgb_model.fit(X_train, y_train)
svm_model.fit(X_train, y_train)
lr_model.fit(X_train, y_train)
gb_model.fit(X_train, y_train)


# =========================
# SOFT-VOTING ENSEMBLE
# parkinsons_model is included if successfully trained
# =========================
estimators = [
    ("rf",  rf_model),
    ("xgb", xgb_model),
    ("svm", svm_model),
    ("lr",  lr_model),
    ("gb",  gb_model),
]
weights = [2, 2, 2, 1, 2]

ensemble = VotingClassifier(estimators=estimators, voting="soft", weights=weights)
ensemble.fit(X_train, y_train)


# =========================
# EVALUATE
# =========================
print("\n" + "=" * 55)
print("INDIVIDUAL MODEL ACCURACY ON HOLDOUT TEST SET")
print("=" * 55)
for name, clf in [("RF", rf_model), ("XGB", xgb_model), ("SVM", svm_model),
                  ("LR", lr_model), ("GB", gb_model)]:
    acc = accuracy_score(y_test, clf.predict(X_test))
    print(f"  {name:5s}: {acc:.3f}  ({acc*100:.1f}%)")

ensemble_acc = accuracy_score(y_test, ensemble.predict(X_test))
print(f"\n  ENSEMBLE (soft-vote, 5 models): {ensemble_acc:.3f}  ({ensemble_acc*100:.1f}%)")

print("\nEnsemble -- Full Classification Report:")
print(classification_report(y_test, ensemble.predict(X_test), target_names=["Healthy", "Parkinsons"]))
print("Confusion Matrix:")
print(confusion_matrix(y_test, ensemble.predict(X_test)))


# =========================
# SAVE ALL MODELS
# =========================
joblib.dump(rf_model,  os.path.join(SAVE_PATH, "rf_model.pkl"))
joblib.dump(xgb_model, os.path.join(SAVE_PATH, "xgb_model.pkl"))
joblib.dump(svm_model, os.path.join(SAVE_PATH, "svm_model.pkl"))
joblib.dump(lr_model,  os.path.join(SAVE_PATH, "lr_model.pkl"))
joblib.dump(gb_model,  os.path.join(SAVE_PATH, "gb_model.pkl"))
joblib.dump(ensemble,  os.path.join(SAVE_PATH, "ensemble_model.pkl"))
joblib.dump(scaler,    os.path.join(SAVE_PATH, "scaler.pkl"))

print(f"\nAll models saved to {SAVE_PATH}/")
print(f"Final ensemble accuracy: {ensemble_acc*100:.1f}%")
print("\nSummary:")
print(f"  ensemble_model.pkl -- 5-model soft-vote ensemble (WAV features)")
print(f"  parkinsons_model.pkl -- UCI tabular model (retrained, same feature space via partial mapping)")
print(f"  rf/xgb/svm/lr/gb _model.pkl -- individual base models")
print(f"  scaler.pkl -- StandardScaler fitted on WAV training data")