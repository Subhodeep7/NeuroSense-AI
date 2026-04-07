import sys
import json
import cv2
import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose

def angle_between(p1, p2, p3):
    """Calculate angle at p2 between vectors p2->p1 and p2->p3."""
    a = np.array(p1)
    b = np.array(p2)
    c = np.array(p3)
    ba = a - b
    bc = c - b
    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))

def analyze_visual(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}", "prediction": -1, "confidence": 0}

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    posture_angles = []          # trunk lean angle
    left_arm_swing_angles = []
    right_arm_swing_angles = []
    frames_with_pose = 0

    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            if not results.pose_landmarks:
                continue

            lm = results.pose_landmarks.landmark
            h, w, _ = frame.shape

            def pt(idx):
                return [lm[idx].x * w, lm[idx].y * h]

            # Key landmarks
            left_shoulder  = pt(mp_pose.PoseLandmark.LEFT_SHOULDER.value)
            right_shoulder = pt(mp_pose.PoseLandmark.RIGHT_SHOULDER.value)
            left_hip       = pt(mp_pose.PoseLandmark.LEFT_HIP.value)
            right_hip      = pt(mp_pose.PoseLandmark.RIGHT_HIP.value)
            left_elbow     = pt(mp_pose.PoseLandmark.LEFT_ELBOW.value)
            right_elbow    = pt(mp_pose.PoseLandmark.RIGHT_ELBOW.value)
            left_wrist     = pt(mp_pose.PoseLandmark.LEFT_WRIST.value)
            right_wrist    = pt(mp_pose.PoseLandmark.RIGHT_WRIST.value)

            # Trunk midpoints
            mid_shoulder = [(left_shoulder[0] + right_shoulder[0]) / 2,
                            (left_shoulder[1] + right_shoulder[1]) / 2]
            mid_hip = [(left_hip[0] + right_hip[0]) / 2,
                       (left_hip[1] + right_hip[1]) / 2]

            # Posture (trunk lean): angle of spine vs vertical
            # Vertical direction is [0,-1] from hip to shoulder
            spine_vec = np.array(mid_shoulder) - np.array(mid_hip)
            vertical = np.array([0, -1])
            cos_a = np.dot(spine_vec, vertical) / (np.linalg.norm(spine_vec) + 1e-6)
            trunk_angle = np.degrees(np.arccos(np.clip(cos_a, -1.0, 1.0)))
            posture_angles.append(trunk_angle)

            # Arm swing: angle at shoulder (hip->shoulder->elbow)
            l_arm_angle = angle_between(left_hip, left_shoulder, left_elbow)
            r_arm_angle = angle_between(right_hip, right_shoulder, right_elbow)
            left_arm_swing_angles.append(l_arm_angle)
            right_arm_swing_angles.append(r_arm_angle)

            frames_with_pose += 1

    cap.release()

    if frames_with_pose < 5:
        return {"error": "Not enough pose detections in video", "prediction": -1, "confidence": 0}

    avg_posture_angle = float(np.mean(posture_angles))
    std_posture_angle = float(np.std(posture_angles))
    avg_left_arm_swing = float(np.mean(left_arm_swing_angles))
    avg_right_arm_swing = float(np.mean(right_arm_swing_angles))
    arm_swing_asymmetry = float(abs(avg_left_arm_swing - avg_right_arm_swing))

    # --- Parkinson's Heuristic ---
    # 1. Stooped posture: trunk forward lean > 15 degrees
    # 2. Reduced arm swing: average swing angle < 60 degrees
    # 3. Arm swing asymmetry: difference > 10 degrees
    confidence = 0.0
    is_parkinsons = 0

    if avg_posture_angle > 15:
        confidence += 0.35
        is_parkinsons = 1

    if avg_left_arm_swing < 65 or avg_right_arm_swing < 65:
        confidence += 0.35
        is_parkinsons = 1

    if arm_swing_asymmetry > 10:
        confidence += 0.2
        is_parkinsons = 1

    confidence = min(0.95, confidence + 0.1)

    return {
        "model": "visual",
        "frames_analyzed": frames_with_pose,
        "avg_posture_angle_deg": round(avg_posture_angle, 2),
        "avg_left_arm_swing_deg": round(avg_left_arm_swing, 2),
        "avg_right_arm_swing_deg": round(avg_right_arm_swing, 2),
        "arm_swing_asymmetry_deg": round(arm_swing_asymmetry, 2),
        "prediction": is_parkinsons,
        "confidence": round(confidence, 4)
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python visual_analysis.py <video_path>"}))
        sys.exit(1)

    video_path = sys.argv[1]
    result = analyze_visual(video_path)
    print(json.dumps(result))
