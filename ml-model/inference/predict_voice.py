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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "saved-model")

RF_PATH = os.path.join(MODEL_DIR, "rf_model.pkl")
XGB_PATH = os.path.join(MODEL_DIR, "xgb_model.pkl")
SVM_PATH = os.path.join(MODEL_DIR, "svm_model.pkl")
LR_PATH = os.path.join(MODEL_DIR, "lr_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")


# =========================
# LOAD MODELS
# =========================

try:
    rf_model = joblib.load(RF_PATH)
    xgb_model = joblib.load(XGB_PATH)
    svm_model = joblib.load(SVM_PATH)
    lr_model = joblib.load(LR_PATH)
    scaler = joblib.load(SCALER_PATH)
except Exception as e:
    # Models might not be trained yet
    pass


# =========================
# FEATURE EXTRACTION
# =========================

def extract_features(audio_path):

    y, sr = librosa.load(audio_path, sr=None)
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
        
        if len(f0_voiced) > 1:
            jitter = np.mean(np.abs(np.diff(f0_voiced))) / pitch_mean
        else:
            jitter = 0
    else:
        pitch_mean = 0
        pitch_std = 0
        jitter = 0

    rms_voiced = rms[0][:len(voiced_flag)][voiced_flag] if f0 is not None else rms[0]
    if len(rms_voiced) > 1 and np.mean(rms_voiced) > 0:
        shimmer = np.mean(np.abs(np.diff(rms_voiced))) / np.mean(rms_voiced)
    else:
        shimmer = 0

    features = np.concatenate([
        mfcc_mean, mfcc_std, delta_mean, delta_std,
        chroma_mean, contrast_mean,
        [centroid_mean, bandwidth_mean, zcr_mean, rms_mean],
        [pitch_mean, pitch_std, jitter, shimmer]
    ])

    return features.reshape(1, -1)


# =========================
# ENSEMBLE PREDICTION
# =========================

def ensemble_predict(features_scaled):

    models = {
        "rf": rf_model,
        "xgb": xgb_model,
        "svm": svm_model,
        "lr": lr_model
    }

    predictions = {}
    probabilities = []

    for name, model in models.items():

        pred = model.predict(features_scaled)[0]
        prob = model.predict_proba(features_scaled)[0][1]

        predictions[name] = int(pred)
        probabilities.append(prob)

    # Majority voting
    votes = list(predictions.values())
    final_prediction = max(set(votes), key=votes.count)

    # Average probability
    avg_probability = float(np.mean(probabilities))

    confidence = avg_probability if final_prediction == 1 else (1 - avg_probability)

    return {
        "model": "voice",
        "prediction": int(final_prediction),
        "confidence": confidence,
        "model_predictions": predictions
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
        print(json.dumps({
            "model": "voice",
            "prediction": -1,
            "confidence": 0,
            "error": str(e)
        }))