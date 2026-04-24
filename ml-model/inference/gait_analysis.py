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
    # ── Path A: raw arrays from direct capture (full DSP pipeline) ────────────
    if 'timestamps' in data and 'ax' in data and len(data.get('ax', [])) > 10:
        try:
            timestamps = np.array(data['timestamps'])
            ax = np.array(data['ax'])
            ay = np.array(data['ay'])
            az = np.array(data['az'])

            duration_s = (timestamps[-1] - timestamps[0]) / 1000.0
            if duration_s <= 0: duration_s = 1.0
            fs = len(timestamps) / duration_s

            acc_mag = np.sqrt(ax**2 + ay**2 + az**2)
            if fs > 6:
                acc_filtered = butter_lowpass_filter(acc_mag, cutoff=3.0, fs=fs, order=2)
            else:
                acc_filtered = acc_mag

            peaks, _ = find_peaks(acc_filtered, distance=fs*0.4, prominence=1.5)
            step_count = len(peaks)
            duration_min = duration_s / 60.0
            cadence = step_count / duration_min if duration_min > 0 else 0

            if step_count > 1:
                step_times = timestamps[peaks]
                step_intervals = np.diff(step_times)
                symmetry_score = np.std(step_intervals) / np.mean(step_intervals)
            else:
                symmetry_score = 0

            is_parkinsons = 0
            confidence = 0.0
            if cadence > 0 and cadence < 95:
                is_parkinsons = 1
                confidence += 0.4
            elif cadence == 0:
                confidence = 0.0
            else:
                confidence += 0.2
            if symmetry_score > 0.15:
                is_parkinsons = 1
                confidence += 0.4
            confidence = min(0.95, confidence + 0.1)

            return {
                "model": "gait", "source": "raw_arrays",
                "step_count": int(step_count), "cadence": float(cadence),
                "symmetry_score": float(symmetry_score),
                "prediction": is_parkinsons, "confidence": float(confidence)
            }
        except Exception as e:
            return {"error": str(e), "prediction": -1, "confidence": 0}

    # ── Path B: pre-computed features from ESP32 compact payload ─────────────
    # ESP32 sends: step_count, cadence_spm, mean/std/rms for ax/ay/az
    try:
        step_count  = int(data.get('step_count', 0))
        cadence     = float(data.get('cadence_spm', 0))
        std_ax      = float(data.get('std_ax', 0))
        std_ay      = float(data.get('std_ay', 0))
        std_az      = float(data.get('std_az', 0))
        rms_ay      = float(data.get('rms_ay', 0))

        # Symmetry proxy: variance between lateral (ax) and vertical (az) std
        total_std     = std_ax + std_ay + std_az + 1e-6
        symmetry_score = abs(std_ax - std_az) / total_std

        is_parkinsons = 0
        confidence    = 0.1
        if cadence > 0 and cadence < 95:
            is_parkinsons = 1; confidence += 0.40
        elif cadence >= 95:
            confidence += 0.20
        if symmetry_score > 0.20:
            is_parkinsons = 1; confidence += 0.35
        if rms_ay < 1.5 and step_count > 0:   # low vertical energy = shuffling
            is_parkinsons = 1; confidence += 0.15
        confidence = min(0.92, confidence)

        return {
            "model": "gait", "source": "esp32_features",
            "step_count": step_count, "cadence": cadence,
            "symmetry_score": float(symmetry_score),
            "prediction": is_parkinsons, "confidence": float(confidence)
        }
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
