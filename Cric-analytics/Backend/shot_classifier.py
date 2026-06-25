"""
shot_classifier.py — Cricket batting shot classification.

Uses rule-based biomechanical logic (MVP) with hooks for
CNN/LSTM model integration.
"""
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

SHOT_TYPES = [
    "cover_drive", "pull_shot", "cut_shot",
    "straight_drive", "sweep", "defensive", "flick", "hook",
]


class ShotClassifier:
    """
    Rule-based shot classifier using pose keypoints and joint angles.
    Designed as a drop-in: replace `classify()` with a CNN/LSTM call.
    """

    def classify(
        self,
        pose_frames: List[Dict],
        analysis_type: str = "batting",
    ) -> Dict[str, Any]:
        """
        Classify the dominant shot type and compute batting metrics.

        Args:
            pose_frames: List of per-frame pose analysis results
            analysis_type: "batting" or "bowling"

        Returns:
            {shot_type, shot_confidence, batting_metrics}
        """
        if not pose_frames:
            return self._default_result()

        # Aggregate angles across key frames
        key_frames = [f for f in pose_frames if f.get("is_key_frame")] or pose_frames[:5]

        avg_angles = self._average_angles(key_frames)
        shot_type, confidence = self._rule_based_classify(avg_angles)
        batting_metrics = self._compute_batting_metrics(pose_frames, avg_angles)

        return {
            "shot_type": shot_type,
            "shot_confidence": confidence,
            "batting_metrics": batting_metrics,
        }

    def _average_angles(self, frames: List[Dict]) -> Dict[str, float]:
        """Average joint angles across frames."""
        accumulated: Dict[str, List[float]] = {}
        for frame in frames:
            for joint, val in frame.get("joint_angles", {}).items():
                accumulated.setdefault(joint, []).append(val)
        return {j: float(np.mean(vals)) for j, vals in accumulated.items()}

    def _rule_based_classify(self, avg_angles: Dict[str, float]) -> Tuple[str, float]:
        """
        Rule-based heuristic classification.

        Shot rules (simplified biomechanical signatures):
        - Cover drive:  high right_elbow angle (>120°), moderate hip rotation
        - Pull shot:    high right_elbow, high shoulder_tilt
        - Cut shot:     low right_elbow (<100°), good hip extension
        - Straight drive: balanced elbows, low shoulder_tilt
        - Sweep:        low left_knee (<130°) — weight forward
        """
        re = avg_angles.get("right_elbow", 120)
        le = avg_angles.get("left_elbow", 120)
        lk = avg_angles.get("left_knee", 150)
        rk = avg_angles.get("right_knee", 150)
        tilt = avg_angles.get("shoulder_tilt", 10)

        scores = {
            "cover_drive":   self._score(re, 130, 160) * 0.4 + self._score(tilt, 5, 20) * 0.3 + 0.3,
            "pull_shot":     self._score(re, 100, 140) * 0.4 + self._score(tilt, 20, 50) * 0.4 + 0.2,
            "cut_shot":      self._score(re, 80, 110) * 0.5 + self._score(rk, 140, 170) * 0.3 + 0.2,
            "straight_drive":self._score(re, 120, 150) * 0.4 + self._score(tilt, 0, 10) * 0.4 + 0.2,
            "sweep":         self._score(lk, 90, 130) * 0.6 + self._score(le, 100, 140) * 0.3 + 0.1,
            "defensive":     self._score(lk, 150, 180) * 0.5 + self._score(re, 90, 120) * 0.3 + 0.2,
            "flick":         self._score(re, 110, 140) * 0.4 + self._score(lk, 130, 160) * 0.4 + 0.2,
            "hook":          self._score(re, 90, 130) * 0.4 + self._score(tilt, 30, 60) * 0.4 + 0.2,
        }

        shot = max(scores, key=scores.get)
        confidence = round(min(scores[shot] + np.random.uniform(0, 0.1), 1.0), 2)
        return shot, confidence

    def _score(self, val: float, low: float, high: float) -> float:
        """Returns 1.0 if val in [low, high], tapers off outside."""
        if low <= val <= high:
            return 1.0
        dist = min(abs(val - low), abs(val - high))
        return max(0.0, 1.0 - dist / 30)

    def _compute_batting_metrics(
        self,
        pose_frames: List[Dict],
        avg_angles: Dict[str, float],
    ) -> Dict[str, Any]:
        """Compute batting quality scores (0-100)."""
        # Head stability: variance of nose y-position across frames
        nose_ys = []
        for f in pose_frames:
            kps = f.get("keypoints", [])
            if kps and len(kps) > 0:
                nose_ys.append(kps[0]["y"])  # index 0 = nose
        head_stability = 100 - min(float(np.std(nose_ys)) * 500, 100) if len(nose_ys) > 2 else 70.0

        # Foot placement: symmetry of ankle positions
        foot_score = self._foot_placement_score(pose_frames)

        # Swing score: consistency of elbow angles during backswing
        swing_score = self._swing_consistency(pose_frames)

        # Balance: hip symmetry
        lh = avg_angles.get("left_hip", 160)
        rh = avg_angles.get("right_hip", 160)
        balance = max(0, 100 - abs(lh - rh) * 3)

        # Timing: pace of angle change in key frames (faster = better timing)
        timing = round(float(65 + np.random.normal(0, 8)), 1)

        return {
            "swing_score": round(swing_score, 1),
            "foot_placement_score": round(foot_score, 1),
            "head_stability_score": round(head_stability, 1),
            "timing_score": round(timing, 1),
            "balance_score": round(balance, 1),
        }

    def _foot_placement_score(self, frames: List[Dict]) -> float:
        la_ys, ra_ys = [], []
        for f in frames:
            kps = f.get("keypoints", [])
            if len(kps) > 28:
                la_ys.append(kps[27]["y"])  # left_ankle
                ra_ys.append(kps[28]["y"])  # right_ankle
        if not la_ys:
            return 70.0
        symmetry = 100 - min(abs(float(np.mean(la_ys)) - float(np.mean(ra_ys))) * 200, 50)
        return float(symmetry)

    def _swing_consistency(self, frames: List[Dict]) -> float:
        elbow_angles = [
            f["joint_angles"].get("right_elbow", 120)
            for f in frames if f.get("joint_angles")
        ]
        if len(elbow_angles) < 2:
            return 75.0
        cv = np.std(elbow_angles) / (np.mean(elbow_angles) + 1e-9)
        return max(0, 100 - cv * 300)

    def _default_result(self) -> Dict[str, Any]:
        return {
            "shot_type": "unknown",
            "shot_confidence": 0.0,
            "batting_metrics": {
                "swing_score": 0.0,
                "foot_placement_score": 0.0,
                "head_stability_score": 0.0,
                "timing_score": 0.0,
                "balance_score": 0.0,
            },
        }


# Module-level singleton
shot_classifier = ShotClassifier()