import warnings
warnings.filterwarnings("ignore")

import sys
import json
import numpy as np
import librosa
import joblib

# Load model and scaler
MODEL_PATH = "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/saved-model/parkinsons_model.pkl"
SCALER_PATH = "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/saved-model/scaler.pkl"

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)



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

    features = np.concatenate([
        mfcc_mean,
        mfcc_std,
        chroma_mean,
        contrast_mean,
        [zcr_mean],
        [rms_mean]
    ])

    return features.reshape(1, -1)




def predict_from_audio(audio_path):
    features = extract_features(audio_path)
    features_scaled = scaler.transform(features)

    prediction = model.predict(features_scaled)[0]
    confidence = model.predict_proba(features_scaled)[0][prediction]

    return {
        "prediction": int(prediction),
        "confidence": float(confidence)
    }


def predict_from_features(features_json):
    features = np.array(json.loads(features_json)).reshape(1, -1)
    features_scaled = scaler.transform(features)

    prediction = model.predict(features_scaled)[0]
    confidence = model.predict_proba(features_scaled)[0][prediction]

    return {
        "prediction": int(prediction),
        "confidence": float(confidence)
    }


if __name__ == "__main__":

    import traceback

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
        traceback.print_exc()   #error printing

