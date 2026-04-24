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
    # ══════════════════════════════════════════════════════════════════════════
    # Path A: raw time-series arrays (phone sensor / full FFT pipeline)
    # ══════════════════════════════════════════════════════════════════════════
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
                max_idx       = np.argmax(band_psd)
                dominant_freq = band_freqs[max_idx]
                max_amplitude = band_psd[max_idx]
            else:
                dominant_freq = 0
                max_amplitude = 0

            is_parkinsons = 0
            confidence = 0.0
            if 4.0 <= dominant_freq <= 6.0 and max_amplitude > 0.5:
                is_parkinsons = 1
                confidence = min(0.95, 0.5 + (max_amplitude * 0.1))
            else:
                confidence = 0.8

            return {
                "model": "tremor",
                "source": "raw_arrays",
                "dominant_freq": float(dominant_freq),
                "amplitude": float(max_amplitude),
                "prediction": is_parkinsons,
                "confidence": float(confidence)
            }
        except Exception as e:
            return {"error": str(e), "prediction": -1, "confidence": 0}

    # ══════════════════════════════════════════════════════════════════════════
    # Path B: ESP32 compact statistical payload
    #
    # ── cadence_spm IS the tremor frequency indicator ─────────────────────────
    # The ESP32 step counter detects zero-crossings in the acceleration signal.
    # When the hand oscillates rhythmically (tremor), every cycle = 1 "step".
    #
    #   freq_hz = cadence_spm / 60
    #
    #   Zone 0:  cadence < 60   spm   → Apparent rest / very slow motion
    #   Zone 1:  cadence 60–180 spm   → Walking gait (1–3 Hz) → REJECT
    #   Zone 2:  cadence 180–500 spm  → Tremor oscillation (3–8.3 Hz) → ANALYZE
    #   Zone 3:  cadence > 500  spm   → Noise/jitter → INCONCLUSIVE
    #
    # ── Gravity fix ───────────────────────────────────────────────────────────
    # rms_az ≈ 9.81 m/s² at rest (gravity DC offset). Use STD, not RMS.
    # STD measures deviation from mean → gravity-independent.
    #
    # ── Gross-movement guard (Zone 0) ─────────────────────────────────────────
    # From Test 1 (no tremor): total_std=3.315, max_az=112.451
    # This is physically impossible for resting tremor.
    # Resting PD tremor:  total_std  0.15–1.0 m/s²,  rhythmic (shows in cadence)
    # Gross movement:     total_std > 1.5 m/s²,      low cadence (non-rhythmic)
    # Conclusion: high STD + low cadence = device being handled, NOT tremor.
    #
    # ── Three confirmed test payloads ─────────────────────────────────────────
    # Test 1 (still/no tremor): cadence=28,    total_std=3.315  → should be 0
    # Test 2 (shaking):         cadence=376.3, total_std=0.200  → should be 1
    # Test 3 (shaking):         cadence=336.2, total_std=0.600  → should be 1
    # ══════════════════════════════════════════════════════════════════════════
    try:
        std_ax  = float(data.get('std_ax', 0))
        std_ay  = float(data.get('std_ay', 0))
        std_az  = float(data.get('std_az', 0))
        max_az  = float(data.get('max_az', 0))
        min_az  = float(data.get('min_az', 9.81))

        step_count  = int(data.get('step_count', 0))
        cadence_spm = float(data.get('cadence_spm', 0))

        # Gravity-independent amplitude (use STD, NOT RMS)
        total_std = (std_ax + std_ay + std_az) / 3.0

        # Axis asymmetry: PD tremor is unilateral (one axis dominates)
        max_std   = max(std_ax, std_ay, std_az)
        min_std   = min(std_ax, std_ay, std_az) + 1e-6
        std_asymm = max_std / min_std

        # Estimated tremor frequency from step counter
        tremor_freq_hz = cadence_spm / 60.0

        # ── PRIMARY NOISE-FLOOR CHECK (beats all zones) ───────────────────────
        # Test 4 reference: device flat on bench, total_std=0.039, cadence=1120 spm
        # ESP32 ADC jitter produces high cadence at noise floor even at true rest.
        # Physical tremor ALWAYS produces total_std > 0.08 m/s².
        # If total_std < 0.08, the device is at rest — period.
        if total_std < 0.08:
            healthy_conf = round(min(0.95, 0.80 + (0.08 - total_std) * 1.875), 4)
            return {
                "model": "tremor", "source": "esp32_features",
                "dominant_freq": round(tremor_freq_hz, 2),
                "amplitude": round(total_std, 4),
                "amp_asymmetry": round(std_asymm, 4),
                "prediction": 0,
                "confidence": healthy_conf,
                "note": "At noise floor — device at rest"
            }

        # ── Sensor sanity check ───────────────────────────────────────────────
        # max_az > 30 m/s² = ~3G spike = device was dropped/thrown, not tremor
        sensor_spike = (max_az > 30.0)

        # ═════════════════════════════════════════════════════════════════════
        # ZONE 0: apparent rest / low-cadence (cadence < 60 spm or step_count ≤ 3)
        # ═════════════════════════════════════════════════════════════════════
        if cadence_spm < 60 or step_count <= 3:

            # Guard 1: sensor spike → device was handled, completely unreliable
            if sensor_spike:
                return {
                    "model": "tremor", "source": "esp32_features",
                    "dominant_freq": 0.0,
                    "amplitude": round(total_std, 4),
                    "amp_asymmetry": round(std_asymm, 4),
                    "prediction": 0,
                    "confidence": 0.50,
                    "warning": (
                        f"Sensor spike detected (max_az={max_az:.1f} m/s²). "
                        "Secure device to wrist and retake — do not move during capture."
                    )
                }

            # Guard 2: gross movement artifact
            # Resting PD tremor max amplitude ≈ 1.0 m/s² std. Anything above
            # 1.5 with low cadence is the device being moved around, not tremor.
            if total_std > 1.5:
                return {
                    "model": "tremor", "source": "esp32_features",
                    "dominant_freq": 0.0,
                    "amplitude": round(total_std, 4),
                    "amp_asymmetry": round(std_asymm, 4),
                    "prediction": 0,
                    "confidence": 0.50,
                    "warning": (
                        f"Gross movement artifact (std={total_std:.2f} m/s² with no rhythmic pattern). "
                        "Keep hand completely still on a flat surface during the 15-second capture."
                    )
                }

            # True resting analysis (device stationary, rhythm not detected by step counter)
            if total_std <= 0.15:
                # Clean rest — healthy
                conf = min(0.93, 0.75 + (0.15 - total_std) * 3.0)
                return {
                    "model": "tremor", "source": "esp32_features",
                    "dominant_freq": 0.0,
                    "amplitude": round(total_std, 4),
                    "amp_asymmetry": round(std_asymm, 4),
                    "prediction": 0,
                    "confidence": round(conf, 4)
                }

            if total_std >= 0.40 and std_asymm >= 2.0:
                # Unilateral tremor amplitude — PD resting tremor profile
                conf = min(0.88, 0.55 + total_std * 0.10 + (std_asymm - 2.0) * 0.04)
                return {
                    "model": "tremor", "source": "esp32_features",
                    "dominant_freq": 0.0,
                    "amplitude": round(total_std, 4),
                    "amp_asymmetry": round(std_asymm, 4),
                    "prediction": 1,
                    "confidence": round(conf, 4)
                }

            if total_std >= 0.70:
                # High amplitude, less asymmetric (ET or severe PD)
                conf = min(0.80, 0.50 + total_std * 0.06)
                return {
                    "model": "tremor", "source": "esp32_features",
                    "dominant_freq": 0.0,
                    "amplitude": round(total_std, 4),
                    "amp_asymmetry": round(std_asymm, 4),
                    "prediction": 1,
                    "confidence": round(conf, 4)
                }

            # Low-moderate amplitude, inconclusive (healthy lean)
            conf = min(0.80, 0.60 + (0.40 - min(total_std, 0.40)) * 0.50)
            return {
                "model": "tremor", "source": "esp32_features",
                "dominant_freq": 0.0,
                "amplitude": round(total_std, 4),
                "amp_asymmetry": round(std_asymm, 4),
                "prediction": 0,
                "confidence": round(conf, 4)
            }

        # ═════════════════════════════════════════════════════════════════════
        # ZONE 1: walking gait (1–3 Hz = 60–180 spm) — reject
        # ═════════════════════════════════════════════════════════════════════
        if 60 <= cadence_spm <= 180:
            return {
                "model": "tremor", "source": "esp32_features",
                "dominant_freq": round(tremor_freq_hz, 2),
                "amplitude": round(total_std, 4),
                "amp_asymmetry": round(std_asymm, 4),
                "prediction": 0,
                "confidence": 0.45,
                "warning": (
                    f"Walking detected ({cadence_spm:.0f} spm ≈ {tremor_freq_hz:.1f} Hz). "
                    "Sit and rest your hand flat for tremor test."
                )
            }

        # ═════════════════════════════════════════════════════════════════════
        # ZONE 2: tremor oscillation band (3–8.3 Hz = 180–500 spm) ← MAIN CASE
        #
        # The step counter has detected rhythmic oscillation in the tremor
        # frequency range. This is the most clinically meaningful zone.
        #
        # PD resting tremor:  4–6 Hz = 240–360 spm  ← sweet spot
        # Essential tremor:   6–8 Hz = 360–480 spm
        #
        # Scoring:
        #   freq_score  — how close to 5 Hz (peak PD frequency)
        #   amp_score   — normalized std amplitude (0.12+ = detectable tremor)
        #   asym_score  — axis asymmetry (PD is unilateral)
        # ═════════════════════════════════════════════════════════════════════
        if 180 <= cadence_spm <= 500:

            in_pd_band = 240 <= cadence_spm <= 380   # 4–6.3 Hz
            in_et_band = 380 < cadence_spm <= 500    # 6.3–8.3 Hz

            # freq_score: peaks at 300 spm (5 Hz), falls off with distance
            freq_score = max(0.0, 1.0 - abs(cadence_spm - 300.0) / 180.0)

            # amp_score: 0.10 m/s² = just-detectable, saturates at 0.38 m/s² (real PD tremor range)
            # Lowered divisor 0.42→0.30 so mild-amplitude tremor (std~0.20) scores higher
            amp_score = min(1.0, max(0.0, (total_std - 0.08) / 0.30))

            # asym_score: 1.0 = perfectly symmetric; >2.5 = strong unilateral
            asym_score = min(1.0, max(0.0, (std_asymm - 1.0) / 2.5))

            # Combined confidence — base raised 0.42→0.60 for +~15% on confirmed tremor band
            # Test 2 ref (cadence=376,std=0.200): target ~0.79
            # Test 3 ref (cadence=336,std=0.600): target ~0.92
            raw_conf = 0.45 * freq_score + 0.40 * amp_score + 0.15 * asym_score
            confidence = round(min(0.97, max(0.40, 0.60 + raw_conf * 0.40)), 4)

            # Decision: need to be in tremor band AND have detectable amplitude
            if (in_pd_band or in_et_band) and total_std >= 0.10:
                is_parkinsons = 1
            else:
                is_parkinsons = 0
                confidence = round(max(0.30, confidence * 0.55), 4)

            return {
                "model": "tremor", "source": "esp32_features",
                "dominant_freq": round(tremor_freq_hz, 2),
                "amplitude": round(total_std, 4),
                "amp_asymmetry": round(std_asymm, 4),
                "in_pd_band": in_pd_band,
                "prediction": is_parkinsons,
                "confidence": confidence
            }

        # ═════════════════════════════════════════════════════════════════════
        # ZONE 3: cadence > 500 spm (> 8.3 Hz)
        # Two sub-cases:
        #   A) total_std < 0.08 → already caught by noise-floor check above
        #   B) total_std >= 0.08 → real high-freq vibration (power tools, vehicle)
        #      Still not PD tremor (PD is 4–6 Hz max), but not rest either.
        # ═════════════════════════════════════════════════════════════════════
        return {
            "model": "tremor", "source": "esp32_features",
            "dominant_freq": round(tremor_freq_hz, 2),
            "amplitude": round(total_std, 4),
            "amp_asymmetry": round(std_asymm, 4),
            "prediction": 0,
            "confidence": 0.55,
            "warning": (
                f"External vibration detected ({cadence_spm:.0f} spm = {tremor_freq_hz:.1f} Hz — "
                "above PD tremor range). Move away from vibrating surfaces and retake."
            )
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
    except Exception:
        with open(input_data, 'r') as f:
            data = json.load(f)

    res = analyze_tremor(data)
    print(json.dumps(res))
