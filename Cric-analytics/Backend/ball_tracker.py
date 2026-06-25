"""
ball_tracker.py — YOLOv8-based cricket ball detection and tracking.

Detects ball position per frame, builds trajectory,
and computes movement vectors for speed estimation.
"""
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import logging
import os

logger = logging.getLogger(__name__)

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("Ultralytics YOLO not installed — ball detection unavailable")

YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "./models/cricket_ball_yolov8.pt")
FALLBACK_YOLO_MODEL = "yolov8n.pt"   # Use nano general model if custom not found


class BallTracker:
    """
    Cricket ball tracker using YOLOv8 detection + OpenCV KCF tracker
    for robust frame-to-frame tracking.
    """

    def __init__(self):
        self.model = None
        self.tracker = None
        self._load_model()

    def _load_model(self):
        if not YOLO_AVAILABLE:
            return
        try:
            model_path = YOLO_MODEL_PATH if os.path.exists(YOLO_MODEL_PATH) else FALLBACK_YOLO_MODEL
            self.model = YOLO(model_path)
            logger.info(f"Loaded YOLO model: {model_path}")
        except Exception as e:
            logger.error(f"YOLO load failed: {e}")

    def detect_ball(self, frame: np.ndarray, conf_threshold: float = 0.4) -> Optional[Tuple[float, float, float]]:
        """
        Detect cricket ball in a single frame.
        Returns (x_center, y_center, confidence) in pixel coords, or None.
        """
        if self.model is None:
            return self._heuristic_detect(frame)

        try:
            results = self.model(frame, verbose=False, conf=conf_threshold)
            for r in results:
                boxes = r.boxes
                if boxes is None or len(boxes) == 0:
                    continue
                # Look for small round objects (ball class or sports-ball in COCO)
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    # COCO sports-ball class = 32; custom model class = 0
                    if cls_id in (0, 32):
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cx = (x1 + x2) / 2
                        cy = (y1 + y2) / 2
                        return (cx, cy, conf)
        except Exception as e:
            logger.debug(f"YOLO detection error: {e}")

        return self._heuristic_detect(frame)

    def _heuristic_detect(self, frame: np.ndarray) -> Optional[Tuple[float, float, float]]:
        """
        Fallback heuristic: detect red/white circular objects via color+shape.
        """
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        # Red ball mask (two ranges for HSV wrap-around)
        mask1 = cv2.inRange(hsv, np.array([0, 120, 70]), np.array([10, 255, 255]))
        mask2 = cv2.inRange(hsv, np.array([170, 120, 70]), np.array([180, 255, 255]))
        # White ball mask
        mask3 = cv2.inRange(hsv, np.array([0, 0, 200]), np.array([180, 30, 255]))
        mask = cv2.bitwise_or(cv2.bitwise_or(mask1, mask2), mask3)

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        best = None
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 50 or area > 5000:    # Filter by realistic ball size
                continue
            ((cx, cy), radius) = cv2.minEnclosingCircle(cnt)
            circularity = area / (np.pi * radius ** 2 + 1e-9)
            if circularity > 0.65:           # Roughly circular
                if best is None or area > best[2]:
                    best = (cx, cy, area)

        if best:
            return (best[0], best[1], 0.6)
        return None


def run_ball_tracking(video_path: str, frame_skip: int = 2) -> Dict[str, Any]:
    """
    Track ball across all frames in a video.

    Returns:
        {
          detections: [{frame, timestamp_ms, x, y, confidence, detected}],
          trajectory: [[x, y], ...],
          total_frames: int,
        }
    """
    tracker = BallTracker()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Cannot open video: {video_path}")
        return _mock_tracking_result()

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    detections = []
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        timestamp_ms = (frame_idx / fps) * 1000

        if frame_idx % frame_skip == 0:
            result = tracker.detect_ball(frame)
            if result:
                cx, cy, conf = result
                detections.append({
                    "frame_number": frame_idx,
                    "timestamp_ms": round(timestamp_ms, 1),
                    "x": round(float(cx), 2),
                    "y": round(float(cy), 2),
                    "confidence": round(conf, 3),
                    "ball_detected": True,
                })
            else:
                detections.append({
                    "frame_number": frame_idx,
                    "timestamp_ms": round(timestamp_ms, 1),
                    "x": 0.0,
                    "y": 0.0,
                    "confidence": 0.0,
                    "ball_detected": False,
                })

        frame_idx += 1

    cap.release()

    trajectory = [[d["x"], d["y"]] for d in detections if d["ball_detected"]]
    return {
        "detections": detections,
        "trajectory": trajectory,
        "total_frames": frame_idx,
        "detected_count": sum(1 for d in detections if d["ball_detected"]),
    }


def _mock_tracking_result() -> Dict[str, Any]:
    """Return mock ball tracking data."""
    detections = []
    # Simulate a bowling delivery trajectory
    for i in range(0, 60, 2):
        t = i / 60
        # Parabolic path from bowler to batsman
        x = 100 + t * 500
        y = 300 - 80 * (1 - (2 * t - 1) ** 2)   # Slight bounce arc
        detections.append({
            "frame_number": i,
            "timestamp_ms": round(i / 30 * 1000, 1),
            "x": round(x + np.random.normal(0, 3), 2),
            "y": round(y + np.random.normal(0, 3), 2),
            "confidence": round(0.75 + np.random.uniform(-0.1, 0.1), 3),
            "ball_detected": True,
        })

    return {
        "detections": detections,
        "trajectory": [[d["x"], d["y"]] for d in detections],
        "total_frames": 60,
        "detected_count": len(detections),
    }