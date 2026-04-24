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
    # ── Path A: raw arrays (full FFT pipeline) ─────────────────────────────
    if 'timestamps' in data and 'ax' in data and len(data.get('ax', [])) >= 20:
        try:
            timestamps = np.array(data['timestamps'])
            ax = np.array(data['ax'])
            ay = np.array(data['ay'])
            az = np.array(data['az'])

            if len(timestamps) < 20:
                return {"error": "Not enough data for FFT"}

            duration_s = (timestamps[-1] - timestamps[0]) / 1000.0
            fs = len(timestamps) / duration_s

            acc_mag = np.sqrt(ax**2 + ay**2 + az**2)
            if fs > 2:
                acc_hp = butter_highpass_filter(acc_mag, cutoff=1.0, fs=fs, order=2)
            else:
                acc_hp = acc_mag - np.mean(acc_mag)

            nperseg = min(256, len(acc_hp))
            freqs, psd = welch(acc_hp, fs, nperseg=nperseg)
            band_mask = (freqs >= 3.0) & (freqs <= 12.0)

            if np.any(band_mask):
                band_freqs = freqs[band_mask]
                band_psd   = psd[band_mask]
                max_idx        = np.argmax(band_psd)
                dominant_freq  = band_freqs[max_idx]
                max_amplitude  = band_psd[max_idx]
            else:
                dominant_freq = 0; max_amplitude = 0

            is_parkinsons = 0; confidence = 0.0
            if 4.0 <= dominant_freq <= 6.0 and max_amplitude > 0.5:
                is_parkinsons = 1
                confidence = min(0.95, 0.5 + (max_amplitude * 0.1))
            else:
                confidence = 0.8

            return {
                "model": "tremor", "source": "raw_arrays",
                "dominant_freq": float(dominant_freq), "amplitude": float(max_amplitude),
                "prediction": is_parkinsons, "confidence": float(confidence)
            }
        except Exception as e:
            return {"error": str(e), "prediction": -1, "confidence": 0}

    # ── Path B: pre-computed features from ESP32 compact payload ─────────────
    # Without raw time-series, frequency resolution is unavailable.
    # We use amplitude (RMS) and asymmetry as Parkinson's tremor proxies.
    try:
        std_ax  = float(data.get('std_ax', 0))
        std_ay  = float(data.get('std_ay', 0))
        std_az  = float(data.get('std_az', 0))
        rms_ax  = float(data.get('rms_ax', 0))
        rms_ay  = float(data.get('rms_ay', 0))
        rms_az  = float(data.get('rms_az', 0))

        avg_rms = (rms_ax + rms_ay + rms_az) / 3.0 + 1e-6
        avg_std = (std_ax + std_ay + std_az) / 3.0

        # Amplitude asymmetry: strong asymmetry = unilateral tremor (PD sign)
        max_rms    = max(rms_ax, rms_ay, rms_az)
        amp_asymm  = max_rms / avg_rms         # >1.5 = one axis dominates

        # Tremor amplitude relative to gravity (9.81 m/s2)
        # Resting PD tremor: avg_std ~0.3–1.5 m/s2
        is_parkinsons = 0; confidence = 0.15

        if avg_std > 0.3 and amp_asymm > 1.4:
            is_parkinsons = 1
            confidence = min(0.88, 0.45 + avg_std * 0.10 + (amp_asymm - 1.4) * 0.15)
        elif avg_std > 0.5:                     # high overall tremor
            is_parkinsons = 1
            confidence = min(0.80, 0.40 + avg_std * 0.08)
        else:
            confidence = min(0.82, 0.60 + (0.3 - avg_std) * 0.5)  # healthy confidence

        return {
            "model": "tremor", "source": "esp32_features",
            "dominant_freq": 0.0,          # unavailable without raw data
            "amplitude": float(avg_std),
            "amp_asymmetry": float(amp_asymm),
            "prediction": is_parkinsons, "confidence": float(confidence)
        }
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
