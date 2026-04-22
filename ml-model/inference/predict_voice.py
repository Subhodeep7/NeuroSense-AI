import warnings
warnings.filterwarnings("ignore")

import sys
import json
import numpy as np
import librosa
import joblib
import traceback
import os


# =========================
# BASE PATH
# =========================

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "saved-model")

ENSEMBLE_PATH = os.path.join(MODEL_DIR, "ensemble_model.pkl")
RF_PATH       = os.path.join(MODEL_DIR, "rf_model.pkl")
XGB_PATH      = os.path.join(MODEL_DIR, "xgb_model.pkl")
SVM_PATH      = os.path.join(MODEL_DIR, "svm_model.pkl")
LR_PATH       = os.path.join(MODEL_DIR, "lr_model.pkl")
GB_PATH       = os.path.join(MODEL_DIR, "gb_model.pkl")
SCALER_PATH   = os.path.join(MODEL_DIR, "scaler.pkl")


# =========================
# LOAD MODELS
# Prefer the trained soft-voting ensemble; fall back to individual models
# =========================

ensemble_model = None
rf_model = xgb_model = svm_model = lr_model = gb_model = None
scaler   = None

try:
    scaler = joblib.load(SCALER_PATH)
    if os.path.exists(ENSEMBLE_PATH):
        ensemble_model = joblib.load(ENSEMBLE_PATH)
    else:
        rf_model  = joblib.load(RF_PATH)
        xgb_model = joblib.load(XGB_PATH)
        svm_model = joblib.load(SVM_PATH)
        lr_model  = joblib.load(LR_PATH)
        if os.path.exists(GB_PATH):
            gb_model = joblib.load(GB_PATH)
except Exception as e:
    pass  # Models not trained yet


# =========================
# FEATURE EXTRACTION — must match train_model.py exactly (254 features)
# =========================

def extract_features(audio_path):

    y, sr = librosa.load(audio_path, sr=22050)   # same resample rate as training
    y = librosa.util.normalize(y)

    # MFCC
    mfcc        = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean   = np.mean(mfcc, axis=1)
    mfcc_std    = np.std(mfcc, axis=1)

    # Delta & Delta-Delta
    delta       = librosa.feature.delta(mfcc)
    delta2      = librosa.feature.delta(mfcc, order=2)
    delta_mean  = np.mean(delta, axis=1)
    delta_std   = np.std(delta, axis=1)
    delta2_mean = np.mean(delta2, axis=1)
    delta2_std  = np.std(delta2, axis=1)

    # Chroma
    chroma      = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)
    chroma_std  = np.std(chroma, axis=1)

    # Spectral contrast
    contrast      = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=5, fmin=200.0)
    contrast_mean = np.mean(contrast, axis=1)
    contrast_std  = np.std(contrast, axis=1)

    # Mel spectrogram
    mel      = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=40)
    mel_mean = np.mean(mel, axis=1)
    mel_std  = np.std(mel, axis=1)

    # Scalar spectral features
    centroid  = librosa.feature.spectral_centroid(y=y, sr=sr)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    rolloff   = librosa.feature.spectral_rolloff(y=y, sr=sr)
    zcr       = librosa.feature.zero_crossing_rate(y)
    rms       = librosa.feature.rms(y=y)
    rms_arr   = rms[0]

    # F0 / Pitch
    f0, voiced_flag, _ = librosa.pyin(y, fmin=50, fmax=300)
    if f0 is not None and np.any(voiced_flag):
        f0_voiced   = f0[voiced_flag]
        pitch_mean  = np.nanmean(f0_voiced)
        pitch_std   = np.nanstd(f0_voiced)
        pitch_range = np.nanmax(f0_voiced) - np.nanmin(f0_voiced)
        jitter      = np.mean(np.abs(np.diff(f0_voiced))) / pitch_mean if len(f0_voiced) > 1 else 0
        if len(f0_voiced) > 2:
            rap = np.mean([abs(f0_voiced[i] - np.mean(f0_voiced[i-1:i+2]))
                           for i in range(1, len(f0_voiced)-1)]) / pitch_mean
        else:
            rap = 0
    else:
        pitch_mean = pitch_std = pitch_range = jitter = rap = 0
        f0_voiced = np.array([])

    # Shimmer
    if f0 is not None and len(f0_voiced) > 1:
        rms_voiced = rms_arr[:len(voiced_flag)][voiced_flag] if len(rms_arr) >= len(voiced_flag) else rms_arr
        shimmer = (np.mean(np.abs(np.diff(rms_voiced))) / np.mean(rms_voiced)
                   if len(rms_voiced) > 1 and np.mean(rms_voiced) > 0 else 0)
    else:
        shimmer = 0

    # HNR approximation
    harmonics, percussive = librosa.effects.hpss(y)
    hnr = np.mean(harmonics**2) / (np.mean(percussive**2) + 1e-8)

    voiced_fraction = float(np.mean(voiced_flag)) if f0 is not None else 0.0

    features = np.concatenate([
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

    return features.reshape(1, -1)


# =========================
# ENSEMBLE PREDICTION
# Uses the pre-trained VotingClassifier (soft) if available;
# falls back to individual model majority vote otherwise.
# =========================

def ensemble_predict(features_scaled):

    # ── Fast path: use the trained sklearn VotingClassifier ──
    if ensemble_model is not None:
        pred       = int(ensemble_model.predict(features_scaled)[0])
        prob_pd    = float(ensemble_model.predict_proba(features_scaled)[0][1])
        confidence = prob_pd if pred == 1 else (1.0 - prob_pd)
        return {
            "model":      "voice",
            "prediction": pred,
            "confidence": confidence,
            "method":     "soft_voting_ensemble",
        }

    # ── Fallback: individual model majority vote ──
    available = {k: v for k, v in {
        "rf": rf_model, "xgb": xgb_model,
        "svm": svm_model, "lr": lr_model, "gb": gb_model
    }.items() if v is not None}

    predictions  = {}
    probabilities = []
    for name, model in available.items():
        pred = model.predict(features_scaled)[0]
        prob = model.predict_proba(features_scaled)[0][1]
        predictions[name] = int(pred)
        probabilities.append(prob)

    votes            = list(predictions.values())
    final_prediction = max(set(votes), key=votes.count)
    avg_probability  = float(np.mean(probabilities))
    confidence       = avg_probability if final_prediction == 1 else (1.0 - avg_probability)

    return {
        "model":             "voice",
        "prediction":        int(final_prediction),
        "confidence":        confidence,
        "method":            "majority_vote",
        "model_predictions": predictions,
    }


# =========================
# AUDIO PREDICTION
# =========================

def predict_from_audio(audio_path):

    features = extract_features(audio_path)
    features_scaled = scaler.transform(features)

    return ensemble_predict(features_scaled)


# =========================
# FEATURE PREDICTION
# =========================

def predict_from_features(features_json):

    features = np.array(json.loads(features_json)).reshape(1, -1)
    features_scaled = scaler.transform(features)

    return ensemble_predict(features_scaled)


# =========================
# MAIN ENTRY
# =========================

if __name__ == "__main__":

    try:

        if len(sys.argv) < 2:
            raise Exception("No input provided")

        input_value = sys.argv[1]

        if input_value.endswith(".wav"):
            result = predict_from_audio(input_value)
        else:
            result = predict_from_features(input_value)

        print(json.dumps(result))

    except Exception as e:
        error_msg = str(e) if str(e) else type(e).__name__
        # Provide helpful message for the most common failure mode
        if "NoBackendError" in error_msg or "NoBackendError" in type(e).__name__:
            error_msg = (
                "Cannot read audio file — no compatible backend found. "
                "File may be in WebM/Opus format. Please upload a standard .wav file."
            )
        print(json.dumps({
            "model": "voice",
            "prediction": -1,
            "confidence": 0,
            "error": error_msg
        }))