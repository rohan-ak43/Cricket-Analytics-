"""
speed_estimator.py — Cricket bowling speed estimation from ball tracking data.

Uses pixel displacement between frames + calibration to estimate real-world speed.
"""
import numpy as np
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# ── Calibration constants ─────────────────────────────────────────────────────
# Standard cricket pitch: 20.12 metres (crease to crease)
# Typical broadcast camera: pitch occupies ~500px horizontally at 1080p
PITCH_LENGTH_METRES = 20.12
DEFAULT_PITCH_WIDTH_PIXELS = 500       # Calibrate per video if camera reference is available
PIXELS_PER_METRE = DEFAULT_PITCH_WIDTH_PIXELS / PITCH_LENGTH_METRES  # ~24.8 px/m


def _pixel_distance(p1: List[float], p2: List[float]) -> float:
    """Euclidean distance between two pixel points."""
    return float(np.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2))


def estimate_speed_from_detections(
    detections: List[Dict],
    fps: float = 30.0,
    pixels_per_metre: float = PIXELS_PER_METRE,
) -> Dict[str, Any]:
    """
    Estimate bowling speed from consecutive ball detections.

    Args:
        detections: List of {frame_number, timestamp_ms, x, y, ball_detected}
        fps: Video frames per second
        pixels_per_metre: Calibration — pixels per real-world metre

    Returns:
        {speed_series, max_speed_kmh, avg_speed_kmh, min_speed_kmh,
         consistency_score, delivery_count}
    """
    detected = [d for d in detections if d.get("ball_detected")]
    if len(detected) < 2:
        return _empty_speed_result()

    speed_points = []
    for i in range(1, len(detected)):
        prev = detected[i - 1]
        curr = detected[i]

        # Time between frames
        dt_ms = curr["timestamp_ms"] - prev["timestamp_ms"]
        if dt_ms <= 0:
            continue

        # Pixel distance
        px_dist = _pixel_distance([prev["x"], prev["y"]], [curr["x"], curr["y"]])
        if px_dist < 2:   # Ignore near-zero movement (static frames)
            continue

        # Convert to real-world metres
        metres = px_dist / pixels_per_metre

        # Speed = distance / time
        speed_ms = metres / (dt_ms / 1000.0)
        speed_kmh = speed_ms * 3.6

        # Filter physically plausible speeds (30–220 km/h for cricket)
        if 30 <= speed_kmh <= 220:
            speed_points.append({
                "frame": curr["frame_number"],
                "timestamp_ms": curr["timestamp_ms"],
                "speed_kmh": round(speed_kmh, 1),
            })

    if not speed_points:
        return _empty_speed_result()

    speeds = [p["speed_kmh"] for p in speed_points]
    max_speed = round(max(speeds), 1)
    avg_speed = round(float(np.mean(speeds)), 1)
    min_speed = round(min(speeds), 1)

    # Consistency: inverse of coefficient of variation (0-100 scale)
    cv = (np.std(speeds) / avg_speed) if avg_speed > 0 else 1
    consistency = round(max(0, 100 - cv * 200), 1)

    # Estimate delivery count: number of distinct speed bursts
    delivery_count = _count_deliveries(speed_points)

    return {
        "speed_series": speed_points,
        "max_speed_kmh": max_speed,
        "avg_speed_kmh": avg_speed,
        "min_speed_kmh": min_speed,
        "consistency_score": consistency,
        "delivery_count": delivery_count,
    }


def _count_deliveries(speed_points: List[Dict], gap_ms: float = 1000) -> int:
    """
    Count distinct deliveries by identifying temporal gaps between detections.
    A gap > gap_ms milliseconds between detections = new delivery.
    """
    if len(speed_points) < 2:
        return 1
    count = 1
    for i in range(1, len(speed_points)):
        if speed_points[i]["timestamp_ms"] - speed_points[i - 1]["timestamp_ms"] > gap_ms:
            count += 1
    return count


def _empty_speed_result() -> Dict[str, Any]:
    return {
        "speed_series": [],
        "max_speed_kmh": None,
        "avg_speed_kmh": None,
        "min_speed_kmh": None,
        "consistency_score": None,
        "delivery_count": 0,
    }


def generate_mock_speed_data(num_deliveries: int = 5) -> Dict[str, Any]:
    """Generate realistic mock speed data for testing/demo."""
    base_speed = 130.0     # Average medium-fast bowler
    speed_points = []
    frame = 0
    for d in range(num_deliveries):
        delivery_speed = base_speed + np.random.normal(0, 8)
        # Each delivery: ~20 frames of ball travel
        for f in range(20):
            speed = delivery_speed + np.random.normal(0, 2)
            speed_points.append({
                "frame": frame,
                "timestamp_ms": round(frame / 30 * 1000, 1),
                "speed_kmh": round(float(np.clip(speed, 80, 165)), 1),
            })
            frame += 1
        frame += 30   # Gap between deliveries

    speeds = [p["speed_kmh"] for p in speed_points]
    return {
        "speed_series": speed_points,
        "max_speed_kmh": round(max(speeds), 1),
        "avg_speed_kmh": round(float(np.mean(speeds)), 1),
        "min_speed_kmh": round(min(speeds), 1),
        "consistency_score": round(float(82 + np.random.uniform(-5, 5)), 1),
        "delivery_count": num_deliveries,
    }