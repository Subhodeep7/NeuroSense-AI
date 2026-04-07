import sys
import json
import numpy as np
from scipy.signal import butter, filtfilt, find_peaks

def butter_lowpass_filter(data, cutoff, fs, order=4):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    y = filtfilt(b, a, data)
    return y

def analyze_gait(data):
    try:
        timestamps = np.array(data['timestamps']) # in milliseconds
        ax = np.array(data['ax'])
        ay = np.array(data['ay'])
        az = np.array(data['az'])

        # Calculate sampling frequency
        if len(timestamps) < 2:
            return {"error": "Not enough data"}
            
        duration_s = (timestamps[-1] - timestamps[0]) / 1000.0
        if duration_s <= 0:
            duration_s = 1.0 # fallback
        fs = len(timestamps) / duration_s

        # 1. Magnitude of acceleration
        acc_mag = np.sqrt(ax**2 + ay**2 + az**2)

        # 2. Low-pass filter to remove noise (cutoff = 3Hz is good for walking)
        # Assuming minimal movement if fs is very low, guard against it.
        if fs > 6:
            acc_filtered = butter_lowpass_filter(acc_mag, cutoff=3.0, fs=fs, order=2)
        else:
            acc_filtered = acc_mag

        # 3. Step detection (find peaks)
        # Prominence of 1.5 m/s^2 is a reasonable threshold for walking
        peaks, _ = find_peaks(acc_filtered, distance=fs*0.4, prominence=1.5)
        step_count = len(peaks)
        
        # 4. Cadence (steps per minute)
        duration_min = duration_s / 60.0
        cadence = step_count / duration_min if duration_min > 0 else 0

        # 5. Gait symmetry (variance of time between steps)
        if step_count > 1:
            step_times = timestamps[peaks]
            step_intervals = np.diff(step_times)
            # COV (Coefficient of Variation) = std / mean
            symmetry_score = np.std(step_intervals) / np.mean(step_intervals)
        else:
            symmetry_score = 0
            
        # 6. Parkinson's Prediction Heuristic
        # Parkinson's often features reduced cadence (<100) and higher asymmetry (>0.1 cov)
        is_parkinsons = 0
        confidence = 0.0
        
        if cadence > 0 and cadence < 95:
            is_parkinsons = 1
            confidence += 0.4
        elif cadence == 0:
            confidence = 0.0
        else:
            confidence += 0.2 # healthy confidence range
            
        if symmetry_score > 0.15:
            is_parkinsons = 1
            confidence += 0.4
            
        confidence = min(0.95, confidence + 0.1) # base confidence

        result = {
            "model": "gait",
            "step_count": int(step_count),
            "cadence": float(cadence),
            "symmetry_score": float(symmetry_score),
            "prediction": is_parkinsons,
            "confidence": float(confidence)
        }
        
        return result

    except Exception as e:
        return {"error": str(e), "prediction": -1, "confidence": 0}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No data provided"}))
        sys.exit(1)

    input_data = sys.argv[1]
    
    # Try parsing as JSON string, if it's a file path, read it
    try:
        data = json.loads(input_data)
    except:
        with open(input_data, 'r') as f:
            data = json.load(f)

    res = analyze_gait(data)
    print(json.dumps(res))
