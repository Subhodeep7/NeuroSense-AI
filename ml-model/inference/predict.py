import sys
import json
import numpy as np
import joblib


# Load model and scaler
model = joblib.load("../saved-model/parkinsons_model.pkl")
scaler = joblib.load("../saved-model/scaler.pkl")


def predict(features):

    features_array = np.array(features).reshape(1, -1)

    features_scaled = scaler.transform(features_array)

    prediction = model.predict(features_scaled)[0]

    probability = model.predict_proba(features_scaled)[0][prediction]

    return {
        "prediction": int(prediction),
        "confidence": float(probability)
    }


if __name__ == "__main__":

    # Input comes from command line as JSON
    input_json = sys.argv[1]

    features = json.loads(input_json)

    result = predict(features)

    print(json.dumps(result))
