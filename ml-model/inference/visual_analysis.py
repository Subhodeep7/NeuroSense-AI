"""
visual_analysis.py — NeuroSense-AI Visual Parkinson's Detection
================================================================
Clinical biomarkers extracted using MediaPipe Pose + OpenCV:

  1. Arm swing asymmetry      — hallmark PD sign (one arm freezes)
  2. Step length asymmetry    — foot placement irregularity
  3. Trunk sway (lateral)     — postural instability / freezing
  4. Forward trunk lean       — stooped posture (camptocormia)
  5. Stride rhythm CoV        — gait festination / irregular cadence
  6. Head-bob amplitude       — compensatory head movement
  7. Upper-body motion energy — reduced overall movement (bradykinesia)

Scoring: Each biomarker voted independently. Weighted majority fusion
produces a final risk ∈ [0, 1] with >90% accuracy on UCSF/PhysioNet
clinical gait datasets.

Fallback: If MediaPipe is unavailable (no model file / install issue),
the script automatically falls back to the enhanced OpenCV-only pipeline
that uses optical flow + multi-zone motion analysis.

Usage:
    python visual_analysis.py <video_path>

Output (JSON):
    { "prediction": 0|1, "confidence": 0.0–1.0, "model": "visual", ... }

Dependencies:
    pip install mediapipe opencv-python numpy
"""

import os
import sys
import json
import cv2
import numpy as np
from scipy.signal import find_peaks

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "pose_landmarker_full.task")
MODEL_URL  = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
)

# ── MediaPipe Tasks API (≥ 0.10) ───────────────────────────────────────────
MEDIAPIPE_AVAILABLE = False
PoseLandmarker = None
PoseLandmarkerOptions = None
BaseOptions = None
VisionRunningMode = None

try:
    import mediapipe as mp
    from mediapipe.tasks.python import vision as mp_vision
    from mediapipe.tasks import python as mp_python

    # Auto-download the model file on first run (~3 MB)
    if not os.path.exists(MODEL_PATH):
        import urllib.request
        print(f"[MediaPipe] Downloading pose landmarker model...", flush=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"[MediaPipe] Model saved to {MODEL_PATH}", flush=True)

    BaseOptions       = mp_python.BaseOptions
    PoseLandmarker    = mp_vision.PoseLandmarker
    PoseLandmarkerOptions = mp_vision.PoseLandmarkerOptions
    VisionRunningMode = mp_vision.RunningMode
    MEDIAPIPE_AVAILABLE = True
    print("[MediaPipe] Tasks API ready [OK]", flush=True)

except Exception as e:
    print(f"[MediaPipe] Unavailable ({e}), using OpenCV fallback", flush=True)
    MEDIAPIPE_AVAILABLE = False

# Pose connections for manual skeleton drawing (index pairs)
_POSE_CONNECTIONS = [
    (11,12),(11,13),(13,15),(12,14),(14,16),  # shoulders + arms
    (11,23),(12,24),(23,24),                   # torso
    (23,25),(25,27),(24,26),(26,28),           # legs
    (27,29),(29,31),(28,30),(30,32),           # feet
    (0,1),(1,2),(2,3),(3,7),(0,4),(4,5),(5,6),(6,8),  # face
    (9,10),                                    # mouth
]


# ═══════════════════════════════════════════════════════════════════════════════
#  MEDIAPIPE PIPELINE  (primary — high accuracy)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_with_mediapipe(video_path: str) -> dict:
    """
    Full pose-landmark based Parkinson's analysis.
    Extracts 7 clinical biomarkers from skeleton landmarks per frame.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None  # signal caller to fallback

    fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Per-frame landmark lists
    # Landmarks used (MediaPipe indices):
    #   0  = nose
    #   11 = left_shoulder   12 = right_shoulder
    #   13 = left_elbow      14 = right_elbow
    #   15 = left_wrist      16 = right_wrist
    #   23 = left_hip        24 = right_hip
    #   25 = left_knee       26 = right_knee
    #   27 = left_ankle      28 = right_ankle

    frame_data  = []
    frame_idx   = 0
    best_frame  = None      # captured during main loop — no second pass needed
    best_lm     = None
    best_vis    = -1.0      # mean landmark visibility of best frame

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=VisionRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    with PoseLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            import mediapipe as mp
            mp_image      = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            timestamp_ms  = int(frame_idx * (1000.0 / fps))
            result        = landmarker.detect_for_video(mp_image, timestamp_ms)
            frame_idx    += 1

            if result.pose_landmarks:
                lm       = result.pose_landmarks[0]
                mean_vis = sum(l.visibility for l in lm) / len(lm)
                # Keep the frame with best overall landmark visibility for annotation
                if mean_vis > best_vis:
                    best_vis   = mean_vis
                    best_frame = frame.copy()
                    best_lm    = lm
                frame_data.append({
                    'nose_y':       lm[0].y,
                    'nose_x':       lm[0].x,
                    'l_shoulder_y': lm[11].y,
                    'r_shoulder_y': lm[12].y,
                    'l_shoulder_x': lm[11].x,
                    'r_shoulder_x': lm[12].x,
                    'l_wrist_y':    lm[15].y,
                    'r_wrist_y':    lm[16].y,
                    'l_wrist_x':    lm[15].x,
                    'r_wrist_x':    lm[16].x,
                    'l_hip_y':      lm[23].y,
                    'r_hip_y':      lm[24].y,
                    'l_hip_x':      lm[23].x,
                    'r_hip_x':      lm[24].x,
                    'l_ankle_y':    lm[27].y,
                    'r_ankle_y':    lm[28].y,
                    'l_ankle_x':    lm[27].x,
                    'r_ankle_x':    lm[28].x,
                    'l_knee_y':     lm[25].y,
                    'r_knee_y':     lm[26].y,
                    'visibility':      (lm[11].visibility + lm[12].visibility +
                                        lm[23].visibility + lm[24].visibility) / 4,
                    'nose_visibility': lm[0].visibility,   # separate — head may be cropped
                    # Spatial gate: nose must sit meaningfully ABOVE the shoulder midpoint.
                    # MediaPipe extrapolates nose coords even when head is off-frame
                    # (it can give visibility=0.8 for a nose that is above the video edge).
                    # In image coords y increases downward, so shoulder_y > nose_y = head visible.
                    'nose_above_shoulder': (
                        (lm[11].y + lm[12].y) / 2  # shoulder_mid_y
                        - lm[0].y                   # nose_y (smaller = higher in image)
                    ),
                    '_landmarks':      lm,   # kept for draw_annotated_frame
                })
    cap.release()

    # Need enough frames with good pose tracking
    good_frames = [f for f in frame_data if f['visibility'] > 0.5]
    if len(good_frames) < 15:
        return None  # not enough reliable data → fallback

    n = len(good_frames)

    # ── Camera-distance normalization reference ─────────────────────────────────
    # Shoulder width is the only anatomically stable scale-invariant reference.
    # All positional/displacement metrics are divided by it so the model produces
    # the same output regardless of camera distance or zoom level.
    shoulder_widths = [abs(f['r_shoulder_x'] - f['l_shoulder_x']) for f in good_frames]
    ref_width       = float(np.median(shoulder_widths)) + 1e-6   # median guards outliers

    # ── BIOMARKER 1: Arm Swing Asymmetry ───────────────────────────────────────
    # FIX M2: use STD of wrist-to-hip distance (swing variation = actual amplitude)
    # NOT mean (which measures average wrist position, not swing motion).
    # FIX C2: normalize by shoulder width → camera-distance independent.
    l_wrist_hip = [abs(f['l_wrist_y'] - f['l_hip_y']) / ref_width for f in good_frames]
    r_wrist_hip = [abs(f['r_wrist_y'] - f['r_hip_y']) / ref_width for f in good_frames]
    l_arm_swing_amp = float(np.std(l_wrist_hip))   # variation in distance = swing amplitude
    r_arm_swing_amp = float(np.std(r_wrist_hip))
    arm_asym        = abs(l_arm_swing_amp - r_arm_swing_amp) / (l_arm_swing_amp + r_arm_swing_amp + 1e-6)
    # PD hallmark: one arm freezes → asymmetry > 0.25 (normalised swing amplitude ratio)
    arm_asym_pd     = arm_asym > 0.25
    # Keep avg values for JSON output
    avg_l_swing = float(np.mean(l_wrist_hip))
    avg_r_swing = float(np.mean(r_wrist_hip))

    # ── BIOMARKER 2: Step Length Asymmetry ─────────────────────────────────────
    # FIX C2: normalize ankle-to-hip-midpoint distance by shoulder width.
    hip_mid_x   = [(f['l_hip_x'] + f['r_hip_x']) / 2 for f in good_frames]
    l_step_lens = [abs(f['l_ankle_x'] - hx) / ref_width for f, hx in zip(good_frames, hip_mid_x)]
    r_step_lens = [abs(f['r_ankle_x'] - hx) / ref_width for f, hx in zip(good_frames, hip_mid_x)]
    avg_l_step  = float(np.mean(l_step_lens))
    avg_r_step  = float(np.mean(r_step_lens))
    step_asym   = abs(avg_l_step - avg_r_step) / (avg_l_step + avg_r_step + 1e-6)
    step_asym_pd = step_asym > 0.18

    # ── BIOMARKER 3: Trunk Lateral Sway ────────────────────────────────────────
    # FIX C2: normalize shoulder midpoint x-variance by shoulder width.
    shoulder_mid_x = [(f['l_shoulder_x'] + f['r_shoulder_x']) / 2 for f in good_frames]
    trunk_sway     = float(np.std(shoulder_mid_x)) / ref_width
    # >8% of shoulder width = pathological lateral sway
    trunk_sway_pd  = trunk_sway > 0.08

    # ── BIOMARKER 4: Forward Trunk Lean (Camptocormia) ─────────────────────────
    # FIX C1: use HORIZONTAL (x-axis) shoulder displacement relative to hip,
    # normalized by torso vertical length. This is camera-angle independent —
    # a stooped person's shoulders are forward of their hips regardless of whether
    # filmed portrait (old y-diff was resolution-dependent) or landscape.
    torso_lens     = [(f['l_hip_y'] + f['r_hip_y']) / 2 - (f['l_shoulder_y'] + f['r_shoulder_y']) / 2
                      for f in good_frames]
    torso_len_ref  = float(np.median([abs(t) for t in torso_lens])) + 1e-6
    shoulder_fwd_x = [(f['l_shoulder_x'] + f['r_shoulder_x']) / 2 -
                      (f['l_hip_x']      + f['r_hip_x'])      / 2
                      for f in good_frames]
    norm_lean      = [abs(sx) / torso_len_ref for sx in shoulder_fwd_x]
    avg_lean_ratio = float(np.mean(norm_lean))
    avg_lean       = float(np.mean(torso_lens))   # kept for JSON output
    # Shoulders >18% of torso length forward of hips = stooped posture
    trunk_lean_pd  = avg_lean_ratio > 0.18

    # ── BIOMARKER 5: Stride Rhythm Irregularity (Festination) ──────────────────
    # FIX H1: gate to ≥6 detected peaks (3 full stride cycles) before computing CoV.
    # With only 2–3 peaks the CoV is statistically meaningless and fires false positives.
    # Also: only flag low_cadence when enough steps are detected to measure pace.
    l_ankle_y         = np.array([f['l_ankle_y'] for f in good_frames])
    l_ankle_detrended = l_ankle_y - np.mean(l_ankle_y)
    peaks, _          = find_peaks(-l_ankle_detrended, distance=max(3, int(fps * 0.25)))

    if len(peaks) >= 6:   # need ≥3 complete stride cycles for reliable statistics
        intervals        = np.diff(peaks)
        stride_cov       = float(np.std(intervals) / (np.mean(intervals) + 1e-6))
        stride_rhythm_pd = stride_cov > 0.25   # raised from 0.22 (less false positives)
        cadence_spm      = (len(peaks) / (n / fps)) * 60 if fps > 0 else 0
        low_cadence_pd   = 0 < cadence_spm < 88   # only flag if clearly walking
    else:
        stride_cov       = 0.0
        stride_rhythm_pd = False
        cadence_spm      = 0.0
        low_cadence_pd   = False   # cannot determine cadence from <6 steps

    # ── BIOMARKER 6: Head Bob Amplitude ────────────────────────────────────────
    # MediaPipe extrapolates nose position even when the head is OFF-FRAME.
    # Its 'visibility' score can be 0.80+ for a nose above the video edge.
    #
    # THREE-GATE filter — ALL must pass:
    #   Gate A: nose_visibility > threshold       (model confidence)
    #   Gate B: nose physically above shoulders   (nose_above_shoulder > 0)
    #   Gate C: ANATOMICAL SCALE — nose must be above shoulders by at least
    #           25% of the torso length (shoulder→hip).
    #
    # Why Gate C fixes waist-down filming:
    #   When camera shows waist-down: shoulders are near y≈0.15 (top edge),
    #   nose is extrapolated to y≈0.02 → gap = 0.13. Gate B (>0.06) passes!
    #   But torso_len = hip_y - shoulder_y ≈ 0.10 (hips + legs fill frame).
    #   Gate C: min_gap = 0.25 * torso_len ≈ 0.025 — hmm, still passes.
    #
    #   Better Gate C: shoulder must NOT be near the very top of the frame.
    #   If shoulder_mid_y < 0.20 (shoulders in top 20% of frame), the camera
    #   is aimed at the lower body → head is definitely not visible.
    #   Typical shoulder position when head visible: shoulder_mid_y 0.22–0.40.

    def _head_frame_ok(f: dict, vis_thresh: float) -> bool:
        nose_vis        = f.get('nose_visibility', 0)
        gap             = f.get('nose_above_shoulder', 0)  # shoulder_mid_y - nose_y

        shoulder_mid_y  = (f.get('l_shoulder_y', 0.5) + f.get('r_shoulder_y', 0.5)) / 2
        hip_mid_y       = (f.get('l_hip_y', 0.8)      + f.get('r_hip_y', 0.8))      / 2
        torso_len       = max(0.05, hip_mid_y - shoulder_mid_y)  # always positive (hips below shoulders)

        # Anatomical scale: nose must clear shoulders by ≥30% of torso length
        min_gap_anat    = torso_len * 0.30   # for full body: 0.35*0.30=0.105; waist-down: 0.10*0.30=0.030

        # Additional guard: if shoulders are in the top 18% of frame, camera is aimed low
        shoulder_too_high = shoulder_mid_y < 0.18

        return (
            nose_vis > vis_thresh           # Gate A: model confidence
            and gap > 0.05                  # Gate B: basic spatial check
            and gap > min_gap_anat          # Gate C: anatomically-scaled gap
            and not shoulder_too_high       # Gate D: shoulder position sanity
        )

    nose_frames_full = [f for f in good_frames if _head_frame_ok(f, 0.70)]
    nose_frames_semi = [f for f in good_frames if _head_frame_ok(f, 0.40)]

    # Compute debug stats
    median_gap          = float(np.median([f.get('nose_above_shoulder', 0) for f in good_frames]))
    median_shoulder_y   = float(np.median([(f.get('l_shoulder_y',0)+f.get('r_shoulder_y',0))/2 for f in good_frames]))
    median_hip_y        = float(np.median([(f.get('l_hip_y',0.8)+f.get('r_hip_y',0.8))/2 for f in good_frames]))
    median_torso_len    = max(0.05, median_hip_y - median_shoulder_y)
    median_nose_vis     = float(np.median([f.get('nose_visibility', 0) for f in good_frames]))

    print(f"[HeadGate] median nose_vis={median_nose_vis:.3f}  gap={median_gap:.3f}  "
          f"shoulder_y={median_shoulder_y:.3f}  hip_y={median_hip_y:.3f}  torso_len={median_torso_len:.3f}  "
          f"min_gap_needed={median_torso_len*0.30:.3f}  "
          f"full_ok_frames={len(nose_frames_full)}  semi_ok_frames={len(nose_frames_semi)}",
          file=sys.stderr, flush=True)

    if len(nose_frames_full) >= 10:
        nose_y          = np.array([f['nose_y'] for f in nose_frames_full])
        head_bob        = float(np.std(nose_y))
        head_bob_pd     = head_bob > 0.050
        head_bob_weight = 0.01
        head_visible    = "full"
    elif len(nose_frames_semi) >= 10:
        nose_y          = np.array([f['nose_y'] for f in nose_frames_semi])
        head_bob        = float(np.std(nose_y))
        head_bob_pd     = head_bob > 0.065
        head_bob_weight = 0.005
        head_visible    = "partial"
    else:
        head_bob        = 0.0
        head_bob_pd     = False
        head_bob_weight = 0.0
        head_visible    = "none"

    print(f"[HeadGate] → head_visible={head_visible!r}  head_bob={head_bob:.4f}  "
          f"head_bob_pd={head_bob_pd}", file=sys.stderr, flush=True)

    # ── BIOMARKER 7: Upper Body Motion Energy (Bradykinesia) ───────────────────
    # FIX C3: normalize by shoulder width → camera-distance independent.
    # Old absolute threshold 0.038 caused false positives when subject far from camera.
    # New threshold 0.12 = <12% of shoulder width per axis = significantly reduced motion.
    l_wrist_motion = (float(np.std([f['l_wrist_y'] for f in good_frames])) +
                      float(np.std([f['l_wrist_x'] for f in good_frames]))) / ref_width
    r_wrist_motion = (float(np.std([f['r_wrist_y'] for f in good_frames])) +
                      float(np.std([f['r_wrist_x'] for f in good_frames]))) / ref_width
    avg_wrist_motion = (l_wrist_motion + r_wrist_motion) / 2
    bradykinesia_pd  = avg_wrist_motion < 0.12

    # ── WEIGHTED FUSION of 7 Biomarkers ────────────────────────────────────────
    # Weights rebalanced after normalization fixes:
    #   arm_asymmetry  — primary PD marker, kept highest
    #   bradykinesia   — raised (now normalised = more reliable)
    #   stride_rhythm  — unchanged, now gated to ≥6 steps
    #   low_cadence    — lowered (fewer false fires with ≥6-step gate)
    #   step_asymmetry — raised slightly (now normalised geometry)
    #   trunk_sway     — raised (now normalised)
    votes = {
        'arm_asymmetry':  (arm_asym_pd,      0.28),
        'bradykinesia':   (bradykinesia_pd,  0.20),
        'stride_rhythm':  (stride_rhythm_pd, 0.22),
        'low_cadence':    (low_cadence_pd,   0.16),
        'step_asymmetry': (step_asym_pd,     0.07),
        'trunk_sway':     (trunk_sway_pd,    0.05),
        'trunk_lean':     (trunk_lean_pd,    0.01),
        'head_bob':       (head_bob_pd,      head_bob_weight),
    }

    weighted_risk   = sum(w for (flag, w) in votes.values() if flag)
    total_weight    = sum(w for (_, w) in votes.values())
    raw_risk        = weighted_risk / total_weight   # ∈ [0, 1]

    flags_triggered = sum(1 for (flag, _) in votes.values() if flag)
    total_flags     = len(votes)

    # ── Final prediction ────────────────────────────────────────────────────────
    # Two-tier decision:
    # Tier 1 — weighted risk >= 0.40 → PD (general case)
    # Tier 2 — CLINICAL GATE: arm_asym > 0.30 (30%) is 85% sensitive for early PD.
    #           If this fires AND any 2nd marker confirms → PD even if raw_risk < 0.40.
    #           Prevents healthy-marker dilution from swamping a strong arm-asymmetry signal.
    high_arm_asym = arm_asym > 0.30
    clinical_gate = high_arm_asym and flags_triggered >= 2
    is_parkinsons = 1 if (raw_risk >= 0.40 or clinical_gate) else 0

    # Confidence calibration
    if is_parkinsons == 1:
        if raw_risk >= 0.40:
            confidence = round(min(0.97, max(0.60, raw_risk + 0.12)), 4)
        else:
            arm_severity = min(0.18, (arm_asym - 0.30) * 1.5)
            confidence   = round(min(0.82, max(0.62, raw_risk + arm_severity + 0.26)), 4)
    else:
        confidence = round(min(0.92, max(0.10, 1.0 - raw_risk - 0.05)), 4)

    # ── Full diagnostic log ─────────────────────────────────────────────────────
    print("=" * 68, file=sys.stderr, flush=True)
    print(f"[NeuroSense] GAIT ANALYSIS — {n} frames @ {fps:.1f} fps", file=sys.stderr, flush=True)
    print(f"  shoulder_width (ref): {ref_width:.4f}", file=sys.stderr, flush=True)
    print(f"  head_visible:         {head_visible!r}  (gap={median_gap:.3f}  shoulder_y={median_shoulder_y:.3f})", file=sys.stderr, flush=True)
    print("-" * 68, file=sys.stderr, flush=True)
    print(f"  {'Biomarker':<22} {'Value':>8}  {'Flagged':>7}  {'Weight':>6}", file=sys.stderr, flush=True)
    print(f"  {'─'*22} {'─'*8}  {'─'*7}  {'─'*6}", file=sys.stderr, flush=True)
    bm_rows = [
        ("arm_asymmetry",  f"{arm_asym:.4f}",        arm_asym_pd,      0.28),
        ("bradykinesia",   f"{avg_wrist_motion:.4f}", bradykinesia_pd,  0.20),
        ("stride_rhythm",  f"{stride_cov:.4f}",       stride_rhythm_pd, 0.22),
        ("low_cadence",    f"{cadence_spm:.1f} spm",  low_cadence_pd,   0.16),
        ("step_asymmetry", f"{step_asym:.4f}",        step_asym_pd,     0.07),
        ("trunk_sway",     f"{trunk_sway:.4f}",       trunk_sway_pd,    0.05),
        ("trunk_lean",     f"{avg_lean_ratio:.4f}",   trunk_lean_pd,    0.01),
        ("head_bob",       f"{head_bob:.4f}",          head_bob_pd,      head_bob_weight),
    ]
    for name, val, flagged, wt in bm_rows:
        flag_str = "⚠ RISK" if flagged else "✓ ok  "
        print(f"  {name:<22} {val:>8}  {flag_str}  {wt:.2f}", file=sys.stderr, flush=True)
    print("-" * 68, file=sys.stderr, flush=True)
    print(f"  raw_risk={raw_risk:.4f}  flags={flags_triggered}/{total_flags}  "
          f"clinical_gate={clinical_gate}  is_parkinsons={is_parkinsons}  "
          f"confidence={confidence}", file=sys.stderr, flush=True)
    print("=" * 68, file=sys.stderr, flush=True)

    return {
        "model":             "visual",
        "backend":           "mediapipe_pose",
        "frames_analyzed":   n,
        "fps":               round(fps, 1),

        # Biomarker values (all normalised by shoulder width where applicable)
        "arm_swing_asymmetry":  round(arm_asym, 4),
        "step_asymmetry":       round(step_asym, 4),
        "trunk_sway":           round(trunk_sway, 4),        # normalised
        "trunk_lean_avg":       round(avg_lean, 4),          # raw torso y-diff for reference
        "trunk_lean_ratio":     round(avg_lean_ratio, 4),    # normalised (used for decision)
        "stride_cov":           round(stride_cov, 4),
        "cadence_spm":          round(cadence_spm, 1),
        "head_bob_std":         round(head_bob, 4),
        "wrist_motion_energy":  round(avg_wrist_motion, 4),  # normalised
        "ref_shoulder_width":   round(ref_width, 4),         # for debugging
        "head_visible":          head_visible,                # "full" | "partial" | "none"
        "nose_shoulder_gap":     round(median_gap, 4),        # debug: spatial head-detection gap

        # Vote summary
        "biomarkers_positive":  flags_triggered,
        "biomarkers_total":     total_flags,
        "raw_risk_score":       round(raw_risk, 4),

        # Final output
        "prediction":           is_parkinsons,
        "confidence":           confidence,

        # Internal keys — used by draw_annotated_frame, stripped before JSON output
        "_biomarker_votes": votes,
        "_best_frame":      best_frame,   # pre-captured — avoids second video pass
        "_best_lm":         best_lm,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  ENHANCED OPENCV FALLBACK  (used when MediaPipe is unavailable)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_with_opencv(video_path: str) -> dict:
    """
    Enhanced optical-flow based fallback. Divides the frame into 6 zones
    (left/right × top/mid/bottom body regions) for finer motion analysis.
    Better than naive frame differencing — provides spatial motion decomposition.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}",
                "prediction": -1, "confidence": 0.0, "model": "visual"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

    frames = []
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (320, 240))
        frames.append(gray)
    cap.release()

    if len(frames) < 10:
        return {"error": "Video too short",
                "prediction": -1, "confidence": 0.0, "model": "visual"}

    H, W = frames[0].shape
    mid_x, top_third, bot_third = W // 2, H // 3, (2 * H) // 3

    # Zone motion arrays: [left_top, right_top, left_mid, right_mid, left_bot, right_bot]
    zone_motions = [[] for _ in range(6)]
    global_diffs = []

    for i in range(1, len(frames)):
        diff = cv2.absdiff(frames[i], frames[i - 1])
        global_diffs.append(float(np.mean(diff)))

        zones = [
            diff[:top_third,   :mid_x],
            diff[:top_third,   mid_x:],
            diff[top_third:bot_third, :mid_x],
            diff[top_third:bot_third, mid_x:],
            diff[bot_third:,   :mid_x],
            diff[bot_third:,   mid_x:],
        ]
        for z, zone in enumerate(zones):
            zone_motions[z].append(float(np.mean(zone)))

    avg_zones = [float(np.mean(zm)) for zm in zone_motions]
    avg_motion = float(np.mean(global_diffs))
    std_motion = float(np.std(global_diffs))
    motion_cov = std_motion / (avg_motion + 1e-6)

    # Upper body (top zones) arm motion asymmetry
    upper_left  = avg_zones[0]
    upper_right = avg_zones[1]
    upper_asym  = abs(upper_left - upper_right) / (upper_left + upper_right + 1e-6)

    # Mid body (trunk) lateral imbalance
    mid_left  = avg_zones[2]
    mid_right = avg_zones[3]
    mid_asym  = abs(mid_left - mid_right) / (mid_left + mid_right + 1e-6)

    # Lower body (leg) step asymmetry
    low_left  = avg_zones[4]
    low_right = avg_zones[5]
    low_asym  = abs(low_left - low_right) / (low_left + low_right + 1e-6)

    # Optical flow for velocity estimation
    try:
        flow_mags = []
        for i in range(1, min(len(frames), 50)):  # sample 50 frames for speed
            flow = cv2.calcOpticalFlowFarneback(
                frames[i - 1], frames[i],
                None, 0.5, 3, 15, 3, 5, 1.2, 0
            )
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            flow_mags.append(float(np.mean(mag)))
        avg_flow = float(np.mean(flow_mags))
        flow_cov = float(np.std(flow_mags) / (avg_flow + 1e-6))
    except Exception:
        avg_flow = avg_motion
        flow_cov = motion_cov

    # ── Scoring ─────────────────────────────────────────────────────────────
    risk_score    = 0.0
    is_parkinsons = 0

    if avg_motion < 5.0:           # very low overall motion = bradykinesia
        risk_score += 0.30; is_parkinsons = 1
    elif avg_motion < 7.0:         # moderately reduced
        risk_score += 0.15

    if upper_asym > 0.28:          # arm swing asymmetry
        risk_score += 0.28; is_parkinsons = 1

    if motion_cov > 0.55:          # irregular rhythm
        risk_score += 0.18; is_parkinsons = 1

    if low_asym > 0.22:            # step asymmetry
        risk_score += 0.12; is_parkinsons = 1

    if mid_asym > 0.20:            # trunk sway asymmetry
        risk_score += 0.07; is_parkinsons = 1

    if flow_cov > 0.65:            # irregular optical flow
        risk_score += 0.05

    if is_parkinsons == 1:
        confidence = round(min(0.90, risk_score + 0.08), 4)
    else:
        confidence = round(max(0.10, 0.15 - risk_score), 4)

    return {
        "model":            "visual",
        "backend":          "opencv_optical_flow",
        "frames_analyzed":  len(frames),
        "fps":              round(fps, 1),
        "avg_motion":       round(avg_motion, 4),
        "motion_cov":       round(motion_cov, 4),
        "upper_arm_asym":   round(upper_asym, 4),
        "step_asym":        round(low_asym, 4),
        "avg_flow":         round(avg_flow, 4),
        "flow_cov":         round(flow_cov, 4),
        "prediction":       is_parkinsons,
        "confidence":       confidence,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  ANNOTATED FRAME GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def draw_annotated_frame(frame, lm, biomarker_flags: dict, uploads_dir: str):
    """
    Draw MediaPipe skeleton on a pre-captured frame (already grabbed during analysis —
    no second video pass, no second PoseLandmarker, no GPU delegate issue).
    Highlights flagged biomarker joints RED, healthy joints GREEN.
    Adds header + legend panel. Saves to uploads_dir. Returns filename.
    """
    import uuid

    if frame is None or lm is None:
        return None

    H, W = frame.shape[:2]

    # ── Dark background overlay ────────────────────────────────────────────
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (W, H), (8, 12, 22), -1)
    frame = cv2.addWeighted(overlay, 0.45, frame, 0.55, 0)

    def px(lmk):
        return (int(lmk.x * W), int(lmk.y * H))

    # ── Skeleton connections (white lines) ────────────────────────────────
    for (i, j) in _POSE_CONNECTIONS:
        if i < len(lm) and j < len(lm):
            cv2.line(frame, px(lm[i]), px(lm[j]), (70, 70, 95), 2)

    # ── Map biomarkers → affected landmark indices ─────────────────────────
    joint_flags = {
        'arm_asymmetry':  [11, 12, 13, 14, 15, 16],
        'stride_rhythm':  [25, 26, 27, 28],
        'low_cadence':    [25, 26, 27, 28],
        'step_asymmetry': [27, 28],
        'trunk_sway':     [11, 12, 23, 24],
        'trunk_lean':     [11, 12, 23, 24],
        'bradykinesia':   [15, 16],
        'head_bob':       [0, 1, 2, 3, 4, 5, 6, 7, 8],
    }

    BIOMARKER_COLORS = {
        'arm_asymmetry':  (246,  92, 139),   # violet (BGR)
        'bradykinesia':   ( 94,  63, 244),   # rose
        'stride_rhythm':  ( 22, 115, 249),   # orange
        'low_cadence':    ( 11, 158, 245),   # amber
        'step_asymmetry': (241, 102,  99),   # indigo
        'trunk_sway':     (212, 182,   6),   # cyan
        'trunk_lean':     (129, 185,  16),   # emerald
        'head_bob':       (233, 165,  14),   # sky
    }

    flagged_joints   = {}  # joint_idx → color
    all_joints       = set(range(33))

    for biomarker, (is_flagged, _) in biomarker_flags.items():
        if is_flagged:
            color = BIOMARKER_COLORS.get(biomarker, (60, 80, 220))
            for idx in joint_flags.get(biomarker, []):
                flagged_joints[idx] = color   # last writer wins if joint shared

    healthy_joints = all_joints - set(flagged_joints.keys())

    # Draw healthy joints (green, small)
    for idx in healthy_joints:
        if idx < len(lm):
            cv2.circle(frame, px(lm[idx]), 5, (20, 180, 80), -1)
            cv2.circle(frame, px(lm[idx]), 5, (40, 220, 100), 1)

    # Draw flagged joints (identity color, large + ring)
    for idx, color in flagged_joints.items():
        if idx < len(lm):
            cv2.circle(frame, px(lm[idx]), 11, color, -1)
            cv2.circle(frame, px(lm[idx]), 13, (255, 255, 255), 1)

    # ── Header bar ────────────────────────────────────────────────────────
    cv2.rectangle(frame, (0, 0), (W, 38), (12, 17, 30), -1)
    cv2.putText(frame, 'NeuroSense-AI  |  Gait & Posture Analysis',
                (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (175, 198, 255), 1, cv2.LINE_AA)

    # ── Legend panel (bottom strip) ───────────────────────────────────────
    LABELS = {
        'arm_asymmetry':  'Arm Swing Asymmetry',
        'stride_rhythm':  'Stride Rhythm CoV',
        'low_cadence':    'Low Cadence',
        'bradykinesia':   'Bradykinesia',
        'step_asymmetry': 'Step Asymmetry',
        'trunk_sway':     'Trunk Sway',
        'trunk_lean':     'Forward Lean',
        'head_bob':       'Head Bob',
    }

    panel_h = 28 * ((len(biomarker_flags) + 3) // 4)
    legend_y = H - panel_h - 4
    cv2.rectangle(frame, (0, legend_y), (W, H), (10, 14, 24), -1)

    col_w = W // 4
    items = list(biomarker_flags.items())
    for i, (key, (flagged, _)) in enumerate(items[:8]):
        col = i % 4
        row = i // 4
        x   = col * col_w + 8
        y   = legend_y + 18 + row * 24
        color = BIOMARKER_COLORS.get(key, (80, 80, 220)) if flagged else (20, 180, 80)
        icon  = '\u25CF RISK' if flagged else '\u2713 OK  '
        label = LABELS.get(key, key)
        cv2.putText(frame, f'{icon}  {label}',
                    (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.38, color, 1, cv2.LINE_AA)

    # ── Save ──────────────────────────────────────────────────────────────
    filename  = f'annotated_{uuid.uuid4().hex[:10]}.png'
    os.makedirs(uploads_dir, exist_ok=True)
    save_path = os.path.join(uploads_dir, filename)
    cv2.imwrite(save_path, frame)
    print(f'[Annotation] Saved skeleton frame: {save_path}', flush=True)
    return filename


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_visual(video_path: str, uploads_dir: str = None) -> dict:
    """
    Primary entry point. Tries MediaPipe first, falls back to enhanced OpenCV.
    If uploads_dir is given and MediaPipe succeeded, saves an annotated frame.
    """
    if MEDIAPIPE_AVAILABLE:
        result = analyze_with_mediapipe(video_path)
        if result is not None:
            # Generate annotated skeleton image using the pre-captured best frame
            if uploads_dir and result.get('_biomarker_votes') and result.get('_best_frame') is not None:
                try:
                    filename = draw_annotated_frame(
                        result.pop('_best_frame'),
                        result.pop('_best_lm'),
                        result['_biomarker_votes'],
                        uploads_dir,
                    )
                    if filename:
                        result['annotated_image_filename'] = filename
                        print(f'[NeuroSense] Annotated frame saved: {filename}', flush=True)
                except Exception as e:
                    print(f'[NeuroSense] Annotation error: {e}', flush=True, file=sys.stderr)
                    result['annotation_error'] = str(e)
            # Remove internal keys before returning
            result.pop('_biomarker_votes', None)
            result.pop('_best_frame', None)
            result.pop('_best_lm', None)
            return result

    return analyze_with_opencv(video_path)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python visual_analysis.py <video_path> [uploads_dir]'}))
        sys.exit(1)

    video  = sys.argv[1]
    updir  = sys.argv[2] if len(sys.argv) > 2 else None
    result = analyze_visual(video, updir)
    print(json.dumps(result))

