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
# BASE PATH (SAFE)
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

rf_model = joblib.load(RF_PATH)
xgb_model = joblib.load(XGB_PATH)
svm_model = joblib.load(SVM_PATH)
lr_model = joblib.load(LR_PATH)

scaler = joblib.load(SCALER_PATH)


# =========================
# FEATURE EXTRACTION
# =========================

def extract_features(audio_path):

    y, sr = librosa.load(audio_path, sr=None)

    y = librosa.util.normalize(y)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    contrast = librosa.feature.spectral_contrast(
        y=y,
        sr=sr,
        n_bands=5,
        fmin=200.0
    )
    contrast_mean = np.mean(contrast, axis=1)

    zcr = librosa.feature.zero_crossing_rate(y)
    zcr_mean = np.mean(zcr)

    rms = librosa.feature.rms(y=y)
    rms_mean = np.mean(rms)

    features = np.concatenate([
        mfcc_mean,
        mfcc_std,
        chroma_mean,
        contrast_mean,
        [zcr_mean],
        [rms_mean]
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
    final_prediction = int(round(sum(votes) / len(votes)))

    # Average probability
    avg_probability = float(np.mean(probabilities))

    confidence = avg_probability if final_prediction == 1 else (1 - avg_probability)

    return {
        "model": "voice",
        "prediction": final_prediction,
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

        traceback.print_exc()

        print(json.dumps({
            "model": "voice",
            "prediction": -1,
            "confidence": 0,
            "error": str(e)
        }))