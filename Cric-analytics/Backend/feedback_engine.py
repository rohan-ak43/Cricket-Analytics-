"""
feedback_engine.py — Rule-based AI coaching feedback generator.

Generates specific, actionable improvement suggestions from
biomechanical metrics. Modular design for future LLM integration.
"""
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class FeedbackEngine:
    """
    Generates human-readable coaching feedback from analysis results.
    Each rule: (condition_fn, feedback_item_dict).
    """

    # ── Batting Rules ─────────────────────────────────────────────────────────
    BATTING_RULES = [
        {
            "condition": lambda m: m.get("right_elbow", 180) < 90,
            "item": {
                "category": "biomechanics",
                "message": "Your bowling/batting arm elbow drops too early in the swing. Keep it high for better power transfer.",
                "severity": "warning",
                "metric": "right_elbow_angle",
            },
        },
        {
            "condition": lambda m: m.get("head_stability_score", 100) < 65,
            "item": {
                "category": "technique",
                "message": "Head position is unstable during shot execution. Focus on keeping eyes level and head still through the shot.",
                "severity": "critical",
                "metric": "head_stability",
            },
        },
        {
            "condition": lambda m: m.get("foot_placement_score", 100) < 60,
            "item": {
                "category": "footwork",
                "message": "Front foot movement is delayed or misaligned. Step decisively towards the pitch of the ball.",
                "severity": "warning",
                "metric": "foot_placement",
            },
        },
        {
            "condition": lambda m: m.get("balance_score", 100) < 65,
            "item": {
                "category": "technique",
                "message": "Weight distribution is off-balance. Ensure even weight transfer from back foot to front foot.",
                "severity": "warning",
                "metric": "balance",
            },
        },
        {
            "condition": lambda m: m.get("timing_score", 100) < 60,
            "item": {
                "category": "timing",
                "message": "Shot timing appears early. Wait longer before committing — watch the ball off the pitch.",
                "severity": "info",
                "metric": "timing",
            },
        },
        {
            "condition": lambda m: m.get("swing_score", 100) < 65,
            "item": {
                "category": "biomechanics",
                "message": "Bat swing path is inconsistent. Work on a straighter backswing and follow-through in the V.",
                "severity": "warning",
                "metric": "swing_score",
            },
        },
        {
            "condition": lambda m: m.get("swing_score", 0) >= 80,
            "item": {
                "category": "technique",
                "message": "Excellent bat swing consistency — your path through the ball is well-grooved.",
                "severity": "info",
                "metric": "swing_score",
            },
        },
    ]

    # ── Bowling Rules ─────────────────────────────────────────────────────────
    BOWLING_RULES = [
        {
            "condition": lambda m: (m.get("avg_speed_kmh") or 0) < 110,
            "item": {
                "category": "technique",
                "message": "Bowling speed is below medium-pace threshold. Focus on hip drive and a full arm extension at release.",
                "severity": "info",
                "metric": "avg_speed_kmh",
            },
        },
        {
            "condition": lambda m: (m.get("consistency_score") or 100) < 70,
            "item": {
                "category": "technique",
                "message": "Speed consistency is low across deliveries. Work on repeating your run-up stride pattern.",
                "severity": "warning",
                "metric": "consistency_score",
            },
        },
        {
            "condition": lambda m: m.get("right_elbow", 180) < 100,
            "item": {
                "category": "biomechanics",
                "message": "Bowling arm angle suggests possible elbow flex at release — check for legality and shoulder rotation.",
                "severity": "critical",
                "metric": "right_elbow_angle",
            },
        },
        {
            "condition": lambda m: m.get("left_knee", 180) > 160,
            "item": {
                "category": "biomechanics",
                "message": "Front knee is too straight at delivery stride — bend it more for better energy transfer.",
                "severity": "warning",
                "metric": "left_knee_angle",
            },
        },
        {
            "condition": lambda m: (m.get("avg_speed_kmh") or 0) >= 140,
            "item": {
                "category": "technique",
                "message": "Impressive pace! You're bowling in the fast-bowling range — focus on consistent line and length.",
                "severity": "info",
                "metric": "avg_speed_kmh",
            },
        },
        {
            "condition": lambda m: (m.get("consistency_score") or 0) >= 85,
            "item": {
                "category": "technique",
                "message": "Excellent delivery consistency — your action is well-grooved and repeatable.",
                "severity": "info",
                "metric": "consistency_score",
            },
        },
    ]

    def generate_feedback(
        self,
        analysis_type: str,
        pose_results: Dict[str, Any],
        speed_results: Dict[str, Any],
        shot_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate a complete feedback report.

        Returns:
            {
              feedback_items: [...],
              strengths: [...],
              improvements: [...],
              summary: str,
            }
        """
        # Merge all metrics into one flat dict for rule evaluation
        metrics = {}
        if pose_results:
            # Include average joint angles
            frames = pose_results.get("frames", [])
            if frames:
                angle_acc: Dict[str, List[float]] = {}
                for f in frames:
                    for k, v in f.get("joint_angles", {}).items():
                        angle_acc.setdefault(k, []).append(v)
                for k, vals in angle_acc.items():
                    metrics[k] = sum(vals) / len(vals)

        if speed_results:
            metrics.update({
                "avg_speed_kmh": speed_results.get("avg_speed_kmh"),
                "max_speed_kmh": speed_results.get("max_speed_kmh"),
                "consistency_score": speed_results.get("consistency_score"),
            })

        if shot_results and shot_results.get("batting_metrics"):
            metrics.update(shot_results["batting_metrics"])

        rules = self.BOWLING_RULES if analysis_type == "bowling" else self.BATTING_RULES
        all_items = []
        for rule in rules:
            try:
                if rule["condition"](metrics):
                    all_items.append(rule["item"].copy())
            except Exception as e:
                logger.debug(f"Rule evaluation error: {e}")

        # Separate strengths (info) vs improvements (warning/critical)
        strengths = [i["message"] for i in all_items if i["severity"] == "info"]
        improvements = [i["message"] for i in all_items if i["severity"] in ("warning", "critical")]

        summary = self._generate_summary(analysis_type, metrics, strengths, improvements)

        return {
            "feedback_items": all_items,
            "strengths": strengths,
            "improvements": improvements,
            "summary": summary,
        }

    def _generate_summary(
        self,
        analysis_type: str,
        metrics: Dict,
        strengths: List[str],
        improvements: List[str],
    ) -> str:
        n_improvements = len(improvements)
        n_strengths = len(strengths)

        if analysis_type == "bowling":
            speed = metrics.get("avg_speed_kmh")
            speed_str = f" at an average of {speed:.1f} km/h" if speed else ""
            if n_improvements == 0:
                return f"Outstanding bowling session{speed_str}. Your action is technically sound and consistent."
            elif n_improvements <= 2:
                return f"Good bowling performance{speed_str} with {n_improvements} areas for refinement."
            else:
                return f"Bowling session captured{speed_str}. Focus on the {n_improvements} improvement areas identified."
        else:
            shot = metrics.get("shot_type", "")
            shot_str = f" ({shot.replace('_', ' ').title()})" if shot else ""
            if n_improvements == 0:
                return f"Excellent batting technique{shot_str}. Strong fundamentals across all aspects."
            elif n_improvements <= 2:
                return f"Solid batting session{shot_str} with {n_improvements} technical areas to work on."
            else:
                return f"Batting session recorded{shot_str}. {n_improvements} technical points need attention."


# Module-level singleton
feedback_engine = FeedbackEngine()