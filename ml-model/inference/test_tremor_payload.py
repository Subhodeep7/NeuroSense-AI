"""
Tremor calibration tests — all 3 real ESP32 payloads + synthetic references.
Run: python ml-model/inference/test_tremor_payload.py
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from tremor_analysis import analyze_tremor

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"; X = "\033[0m"

cases = [
    # ── REAL DEVICE PAYLOADS ─────────────────────────────────────────────────
    {
        "label":    "REAL #1 — No tremor (user holding still)",
        "expected": 0,
        "reason":   "cadence=28 (Zone 0), but total_std=3.315 + max_az=112 → gross movement artifact",
        "payload": {
            "mode":"tremor","patientId":1,
            "sample_count":1261,"duration_ms":14998,
            "mean_ax":1.279,"mean_ay":0.569,"mean_az":14.199,
            "std_ax":1.281,"std_ay":5.803,"std_az":2.863,
            "rms_ax":1.811,"rms_ay":5.831,"rms_az":14.484,
            "min_ax":-0.666,"max_ax":7.968,
            "min_ay":-4.405,"max_ay":25.991,
            "min_az":0.000,"max_az":112.451,
            "step_count":7,"cadence_spm":28.0
        }
    },
    {
        "label":    "REAL #2 — Deliberate shaking (simulated tremor)",
        "expected": 1,
        "reason":   "cadence=376 spm = 6.27 Hz (Zone 2, PD band), total_std=0.200, amplitude ≥ 0.10",
        "payload": {
            "mode":"tremor","patientId":1,
            "sample_count":1250,"duration_ms":14990,
            "mean_ax":1.911,"mean_ay":0.895,"mean_az":13.882,
            "std_ax":0.273,"std_ay":0.134,"std_az":0.194,
            "rms_ax":1.930,"rms_ay":0.905,"rms_az":13.883,
            "min_ax":1.075,"max_ax":2.454,
            "min_ay":0.510,"max_ay":1.252,
            "min_az":13.108,"max_az":14.471,
            "step_count":94,"cadence_spm":376.3
        }
    },
    {
        "label":    "REAL #3 — Deliberate shaking (simulated tremor, stronger)",
        "expected": 1,
        "reason":   "cadence=336 spm = 5.6 Hz (Zone 2, centre of PD band), total_std=0.600",
        "payload": {
            "mode":"tremor","patientId":1,
            "sample_count":1250,"duration_ms":14989,
            "mean_ax":1.284,"mean_ay":0.423,"mean_az":13.985,
            "std_ax":0.412,"std_ay":0.626,"std_az":0.762,
            "rms_ax":1.348,"rms_ay":0.756,"rms_az":14.006,
            "min_ax":0.110,"max_ax":2.674,
            "min_ay":-3.031,"max_ay":2.164,
            "min_az":10.523,"max_az":18.203,
            "step_count":84,"cadence_spm":336.2
        }
    },
    {
        "label":    "REAL #4 — Flat bench (TRUE rest, REFERENCE) ← golden negative",
        "expected": 0,
        "reason":   "total_std=0.039 < 0.08 noise floor. cadence=1120 is ADC jitter, not real motion.",
        "payload": {
            "mode":"tremor","patientId":1,
            "sample_count":1250,"duration_ms":14989,
            "mean_ax":1.949,"mean_ay":-0.683,"mean_az":13.913,
            "std_ax":0.042,"std_ay":0.026,"std_az":0.048,
            "rms_ax":1.950,"rms_ay":0.684,"rms_az":13.913,
            "min_ax":1.575,"max_ax":3.024,
            "min_ay":-0.814,"max_ay":-0.472,
            "min_az":13.005,"max_az":14.408,
            "step_count":280,"cadence_spm":1120.8
        }
    },
    {
        "label":    "REAL #5 — Device swinging (cadence=96 spm = Zone 1 walking)",
        "expected": 0,
        "reason":   "96 spm = 1.6 Hz = walking zone. Also sensor spikes (max_ax=35, max_az=112). Reject.",
        "payload": {
            "mode":"tremor","patientId":1,
            "sample_count":1257,"duration_ms":14998,
            "mean_ax":3.312,"mean_ay":1.427,"mean_az":13.847,
            "std_ax":3.953,"std_ay":5.567,"std_az":3.076,
            "rms_ax":5.157,"rms_ay":5.747,"rms_az":14.184,
            "min_ax":-7.321,"max_ax":35.645,
            "min_ay":-0.898,"max_ay":25.991,
            "min_az":0.000,"max_az":112.949,
            "step_count":24,"cadence_spm":96.0
        }
    },
    # ── SYNTHETIC REFERENCE CASES ────────────────────────────────────────────
    {
        "label":    "SYNTHETIC — Perfect healthy rest (device on table)",
        "expected": 0,
        "reason":   "Very low STD, no cadence — noise floor only",
        "payload": {
            "sample_count":1261,"duration_ms":14998,
            "mean_ax":0.02,"mean_ay":0.01,"mean_az":9.80,
            "std_ax":0.05,"std_ay":0.04,"std_az":0.03,
            "rms_ax":0.06,"rms_ay":0.05,"rms_az":9.81,
            "min_ax":-0.1,"max_ax":0.1,"min_ay":-0.1,"max_ay":0.1,
            "min_az":9.5,"max_az":10.1,"step_count":0,"cadence_spm":0.0
        }
    },
    {
        "label":    "SYNTHETIC — Walking (cadence=112 spm = 1.87 Hz) → REJECT",
        "expected": 0,
        "reason":   "Zone 1 walking guard — should return warning, not tremor",
        "payload": {
            "sample_count":1261,"duration_ms":14998,
            "mean_ax":0.5,"mean_ay":0.2,"mean_az":9.81,
            "std_ax":0.8,"std_ay":0.6,"std_az":0.7,
            "rms_ax":1.5,"rms_ay":0.9,"rms_az":9.85,
            "min_ax":-0.5,"max_ax":1.5,"min_ay":-0.3,"max_ay":0.6,
            "min_az":8.0,"max_az":11.0,"step_count":28,"cadence_spm":112.0
        }
    },
    {
        "label":    "SYNTHETIC — Classic PD tremor (cadence=300 spm = 5 Hz, asymmetric)",
        "expected": 1,
        "reason":   "Perfect PD profile: centre of band, unilateral X-axis dominance",
        "payload": {
            "sample_count":1261,"duration_ms":14998,
            "mean_ax":0.5,"mean_ay":0.2,"mean_az":9.81,
            "std_ax":0.45,"std_ay":0.12,"std_az":0.08,
            "rms_ax":1.50,"rms_ay":0.90,"rms_az":9.82,
            "min_ax":-0.5,"max_ax":1.5,"min_ay":-0.3,"max_ay":0.6,
            "min_az":8.0,"max_az":11.0,"step_count":75,"cadence_spm":300.0
        }
    },
]

print(f"\n{'='*72}")
print(f"  Tremor Analysis — Calibration Test Suite")
print(f"{'='*72}")

passed = 0
for i, case in enumerate(cases, 1):
    r = analyze_tremor(case["payload"])
    pred    = r.get("prediction", -1)
    conf    = r.get("confidence", 0)
    amp     = r.get("amplitude", 0)
    freq    = r.get("dominant_freq", 0)
    asymm   = r.get("amp_asymmetry", 0)
    warning = r.get("warning", "")
    in_pd   = r.get("in_pd_band")
    exp     = case["expected"]

    ok = (pred == exp)
    if ok: passed += 1

    icon  = f"{G}✅ PASS{X}" if ok else f"{R}❌ FAIL{X}"
    p_str = f"{G}0 HEALTHY{X}" if pred == 0 else (f"{R}1 PD{X}" if pred == 1 else f"{R}ERR{X}")
    e_str = f"{G}0 HEALTHY{X}" if exp == 0 else f"{R}1 PD{X}"

    print(f"\n{icon}  [{i}] {case['label']}")
    print(f"       {C}Why:{X} {case['reason']}")
    print(f"       Expected   → {e_str}")
    print(f"       Got        → {p_str}   conf={conf:.3f}   amp={amp:.4f}   freq={freq:.2f} Hz   asymm={asymm:.2f}", end="")
    if in_pd is not None:
        print(f"   in_pd={in_pd}", end="")
    print()
    if warning:
        print(f"       {Y}⚠ {warning[:85]}{X}")

print(f"\n{'='*72}")
print(f"  Results: {passed}/{len(cases)} passed  {'🎉' if passed == len(cases) else '⚠ fix needed'}")
print(f"{'='*72}\n")
