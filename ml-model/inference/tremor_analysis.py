import sys
import json
import numpy as np
from scipy.signal import butter, filtfilt, welch

def butter_highpass_filter(data, cutoff, fs, order=4):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    y = filtfilt(b, a, data)
    return y

def analyze_tremor(data):
    try:
        timestamps = np.array(data['timestamps'])
        ax = np.array(data['ax'])
        ay = np.array(data['ay'])
        az = np.array(data['az'])

        if len(timestamps) < 20:
             return {"error": "Not enough data for FFT"}
             
        duration_s = (timestamps[-1] - timestamps[0]) / 1000.0
        fs = len(timestamps) / duration_s

        # Use acceleration magnitude
        acc_mag = np.sqrt(ax**2 + ay**2 + az**2)

        # High-pass filter > 1Hz to remove gravity
        if fs > 2:
            acc_hp = butter_highpass_filter(acc_mag, cutoff=1.0, fs=fs, order=2)
        else:
            acc_hp = acc_mag - np.mean(acc_mag)

        # FFT via Welch's method to find dominant frequency
        # nperseg limits resolution, but stabilizes variance
        nperseg = min(256, len(acc_hp))
        freqs, psd = welch(acc_hp, fs, nperseg=nperseg)

        # Find dominant frequency in the 3 to 12 Hz band
        band_mask = (freqs >= 3.0) & (freqs <= 12.0)
        
        if np.any(band_mask):
            band_freqs = freqs[band_mask]
            band_psd = psd[band_mask]
            
            max_idx = np.argmax(band_psd)
            dominant_freq = band_freqs[max_idx]
            max_amplitude = band_psd[max_idx]
        else:
            dominant_freq = 0
            max_amplitude = 0

        # Parkinsonian Rest Tremor is typically 4-6 Hz
        is_parkinsons = 0
        confidence = 0.0

        if 4.0 <= dominant_freq <= 6.0 and max_amplitude > 0.5:
            is_parkinsons = 1
            # Confidence scales with amplitude up to a point
            confidence = min(0.95, 0.5 + (max_amplitude * 0.1))
        else:
            # Healthy or non-Parkinsonian tremor
            confidence = 0.8 # Confident it's not PD tremor

        result = {
            "model": "tremor",
            "dominant_freq": float(dominant_freq),
            "amplitude": float(max_amplitude),
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
    
    try:
        data = json.loads(input_data)
    except:
        with open(input_data, 'r') as f:
            data = json.load(f)

    res = analyze_tremor(data)
    print(json.dumps(res))
