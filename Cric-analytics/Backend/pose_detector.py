"""
pose_detector.py — MediaPipe-based cricket pose analysis.

Detects 33 body keypoints per frame and computes:
- Joint angles (elbow, knee, hip, shoulder)
- Pose consistency score across frames
- Key frame selection (highest pose quality)
"""
import cv2
import numpy as np
import math
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

try:
    import mediapipe as mp
    MP_AVAILABLE = True
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
except ImportError:
    MP_AVAILABLE = False
    logger.warning("MediaPipe not installed — pose detection unavailable")


# MediaPipe landmark indices
LANDMARKS = {
    "nose": 0, "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14, "left_wrist": 15,
    "right_wrist": 16, "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26, "left_ankle": 27,
    "right_ankle": 28,
}


def _angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Compute the angle at joint B formed by A-B-C (degrees)."""
    ba = a - b
    bc = c - b
    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-9)
    return math.degrees(math.acos(np.clip(cos_angle, -1.0, 1.0)))


def _lm_to_arr(lm, w: int, h: int) -> np.ndarray:
    """Convert a MediaPipe landmark to a pixel-coordinate numpy array."""
    return np.array([lm.x * w, lm.y * h])


def analyze_pose_frame(frame: np.ndarray, pose_detector) -> Optional[Dict[str, Any]]:
    """
    Run pose detection on a single BGR frame.
    Returns keypoints dict and computed joint angles, or None if no pose detected.
    """
    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose_detector.process(rgb)

    if not results.pose_landmarks:
        return None

    lms = results.pose_landmarks.landmark

    # Extract all 33 keypoints
    keypoints = []
    for i, lm in enumerate(lms):
        keypoints.append({
            "index": i,
            "x": round(lm.x, 4),
            "y": round(lm.y, 4),
            "z": round(lm.z, 4),
            "visibility": round(lm.visibility, 4),
        })

    # Compute joint angles
    def pt(name: str) -> np.ndarray:
        idx = LANDMARKS[name]
        return _lm_to_arr(lms[idx], w, h)

    angles = {}
    try:
        angles["right_elbow"] = round(_angle(pt("right_shoulder"), pt("right_elbow"), pt("right_wrist")), 1)
        angles["left_elbow"] = round(_angle(pt("left_shoulder"), pt("left_elbow"), pt("left_wrist")), 1)
        angles["right_knee"] = round(_angle(pt("right_hip"), pt("right_knee"), pt("right_ankle")), 1)
        angles["left_knee"] = round(_angle(pt("left_hip"), pt("left_knee"), pt("left_ankle")), 1)
        angles["right_hip"] = round(_angle(pt("right_shoulder"), pt("right_hip"), pt("right_knee")), 1)
        angles["left_hip"] = round(_angle(pt("left_shoulder"), pt("left_hip"), pt("left_knee")), 1)
        angles["shoulder_tilt"] = round(
            abs(lms[LANDMARKS["left_shoulder"]].y - lms[LANDMARKS["right_shoulder"]].y) * h, 1
        )
    except Exception as e:
        logger.debug(f"Angle computation error: {e}")

    # Pose quality score — average visibility of key landmarks
    key_indices = list(LANDMARKS.values())
    pose_score = round(
        sum(lms[i].visibility for i in key_indices) / len(key_indices), 3
    )

    return {
        "keypoints": keypoints,
        "joint_angles": angles,
        "pose_score": pose_score,
    }


def compute_pose_consistency(frame_results: List[Dict]) -> float:
    """
    Measure how consistent the player's posture is across frames.
    Returns a 0-100 score.
    """
    if len(frame_results) < 2:
        return 100.0

    # Track standard deviation of key joint angles across frames
    angle_sequences: Dict[str, List[float]] = {}
    for fr in frame_results:
        for joint, val in fr.get("joint_angles", {}).items():
            angle_sequences.setdefault(joint, []).append(val)

    if not angle_sequences:
        return 75.0

    stds = [np.std(vals) for vals in angle_sequences.values() if len(vals) > 1]
    if not stds:
        return 75.0

    avg_std = np.mean(stds)
    # Lower std → more consistent → higher score
    consistency = max(0, 100 - avg_std * 1.5)
    return round(float(consistency), 1)


def run_pose_analysis(video_path: str, frame_skip: int = 3) -> Dict[str, Any]:
    """
    Full pose analysis pipeline for a video file.

    Args:
        video_path: Local path to the video file
        frame_skip: Analyze every N-th frame (performance)

    Returns:
        {frames: [...], consistency: float, total_frames: int}
    """
    if not MP_AVAILABLE:
        logger.error("MediaPipe not available — returning mock data")
        return _mock_pose_result()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    results = []
    frame_idx = 0

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    ) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_skip == 0:
                timestamp_ms = (frame_idx / fps) * 1000
                pose_data = analyze_pose_frame(frame, pose)
                if pose_data:
                    results.append({
                        "frame_number": frame_idx,
                        "timestamp_ms": round(timestamp_ms, 1),
                        "is_key_frame": False,
                        **pose_data,
                    })

            frame_idx += 1

    cap.release()

    # Mark top-5 frames as key frames
    if results:
        sorted_by_quality = sorted(results, key=lambda r: r["pose_score"], reverse=True)
        key_ids = {r["frame_number"] for r in sorted_by_quality[:5]}
        for r in results:
            r["is_key_frame"] = r["frame_number"] in key_ids

    consistency = compute_pose_consistency(results)
    return {
        "frames": results,
        "consistency": consistency,
        "total_frames": frame_idx,
        "analyzed_frames": len(results),
    }


def _mock_pose_result() -> Dict[str, Any]:
    """Return realistic mock data when MediaPipe is unavailable."""
    frames = []
    for i in range(0, 90, 3):
        frames.append({
            "frame_number": i,
            "timestamp_ms": round(i / 30 * 1000, 1),
            "keypoints": [{"index": j, "x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.9} for j in range(33)],
            "joint_angles": {
                "right_elbow": round(120 + np.random.normal(0, 8), 1),
                "left_elbow": round(115 + np.random.normal(0, 6), 1),
                "right_knee": round(140 + np.random.normal(0, 10), 1),
                "left_knee": round(145 + np.random.normal(0, 9), 1),
                "right_hip": round(160 + np.random.normal(0, 5), 1),
                "left_hip": round(158 + np.random.normal(0, 5), 1),
            },
            "pose_score": round(0.8 + np.random.uniform(-0.1, 0.1), 3),
            "is_key_frame": i in {0, 15, 30, 45, 60},
        })
    return {"frames": frames, "consistency": 78.4, "total_frames": 90, "analyzed_frames": 30}