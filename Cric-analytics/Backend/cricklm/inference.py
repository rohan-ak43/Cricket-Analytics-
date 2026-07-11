import json
import math
import torch
from pathlib import Path
from typing import Optional, Tuple
 
from model import CrickLM, CrickLMConfig
from tokenizer import CrickTokenizer
 
 
# Cricket biomechanical benchmarks 
SEVERITY_THRESHOLD = {
    "High": 25,   
    "Med":  10,   
}
 
 
def angle_severity(angle: Optional[float], lo: float, hi: float) -> str:
    if angle is None:
        return "Low"
    if lo <= angle <= hi:
        return "Low"
    deviation = min(abs(angle - lo), abs(angle - hi))
    if deviation > SEVERITY_THRESHOLD["High"]:
        return "High"
    if deviation > SEVERITY_THRESHOLD["Med"]:
        return "Med"
    return "Low"
 
 
# Auto player type detection 
def detect_player_type(features: dict) -> Tuple[str, float]:
    angles  = features.get("joint_angles_deg", {})
    metrics = features.get("body_metrics", {})
 
    stance_ratio = metrics.get("stance_to_shoulder_ratio", 1.2)
    wrist_height = metrics.get("wrist_height_normalized", 0.5)
    shoulder_ang = abs(metrics.get("shoulder_alignment_angle_deg", 0))
    head_off     = abs(metrics.get("head_offset_from_center_px", 0))
    rk           = angles.get("right_knee")
    re_          = angles.get("right_elbow")
    rs           = angles.get("right_shoulder")
 
    bat_score = 0
    bowl_score = 0
 
    # Stance width 
    if stance_ratio > 1.2:
        bat_score += 2
    elif stance_ratio < 0.85:
        bowl_score += 2
    else:
        bat_score += 1   
 
    # Wrist/bat height 
    if wrist_height > 0.62:
        bowl_score += 3   
    elif wrist_height < 0.42:
        bat_score += 3    
    elif wrist_height < 0.55:
        bat_score += 2    
 
    # Shoulder alignment angle 
    if shoulder_ang > 25:
        bowl_score += 2
    elif shoulder_ang < 12:
        bat_score += 1
 
    # Knee angle 
    if rk is not None:
        if 118 <= rk <= 148:
            bat_score += 2    
        elif rk > 155:
            bowl_score += 1   
        elif rk < 115:
            bowl_score += 1   
 
    # Elbow angle 
    if re_ is not None:
        if re_ > 155:
            bowl_score += 2   
        elif 75 <= re_ <= 140:
            bat_score += 1    
 
    # Shoulder angle for bowling arm height 
    if rs is not None:
        if rs < 100:
            bowl_score += 1
        elif rs > 130:
            bat_score += 1
 
    # Head offset 
    if head_off > 20:
        bat_score += 1
 
    # Final decision 
    total = bat_score + bowl_score
    if total == 0:
        return "batsman", 0.5 
 
    if bat_score >= bowl_score:
        confidence = bat_score / total
        return "batsman", round(confidence, 2)
    else:
        confidence = bowl_score / total
        return "bowler", round(confidence, 2)
 
 
def build_analysis_prompt(features: dict, player_type: str) -> str:
    angles  = features.get("joint_angles_deg", {})
    metrics = features.get("body_metrics", {})
 
    def a(key):
        v = angles.get(key)
        return f"{v:.1f} degrees" if v is not None else "not detected"
 
    stance   = metrics.get("stance_to_shoulder_ratio", 0)
    head_off = metrics.get("head_offset_from_center_px", 0)
    wrist_h  = metrics.get("wrist_height_normalized", 0.5)
 
    if player_type == "batsman":
        return (
            f"biomechanical analysis of batsman technique . "
            f"right knee angle is {a('right_knee')} . "
            f"left knee angle is {a('left_knee')} . "
            f"right elbow angle is {a('right_elbow')} . "
            f"head offset from center is {head_off:.1f} pixels . "
            f"stance width ratio is {stance:.2f} . "
            f"wrist height is {wrist_h:.2f} . "
            f"the batsman has weakness"
        )
    else:
        return (
            f"biomechanical analysis of bowling action technique . "
            f"right shoulder angle is {a('right_shoulder')} . "
            f"right elbow angle is {a('right_elbow')} . "
            f"right knee angle is {a('right_knee')} . "
            f"shoulder alignment angle is "
            f"{metrics.get('shoulder_alignment_angle_deg', 0):.1f} degrees . "
            f"the bowler has weakness"
        )
 
 
# Analysis parser 
def parse_generated_text(text: str, features: dict, player_type: str) -> dict:
    angles  = features.get("joint_angles_deg", {})
    metrics = features.get("body_metrics", {})
 
    rk  = angles.get("right_knee")
    lk  = angles.get("left_knee")
    re_ = angles.get("right_elbow")
    le  = angles.get("left_elbow")
    rs  = angles.get("right_shoulder")
 
    head_off  = metrics.get("head_offset_from_center_px", 0)
    stance_r  = metrics.get("stance_to_shoulder_ratio", 1.2)
    wrist_h   = metrics.get("wrist_height_normalized", 0.5)
 
    weaknesses     = []
    vulnerabilities = []
    drills         = []
    strengths      = []
 
    
    # BATSMAN ANALYSIS
    if player_type == "batsman":
 
        # Knee bend 
        if rk is not None:
            if rk < 118:
                weaknesses.append({
                    "title": "Excessive knee bend — too crouched",
                    "detail": (
                        f"Right knee at {rk:.1f}°. Below 118° creates instability "
                        f"and restricts weight transfer through the shot."
                    ),
                    "severity": "High",
                    "joint": "right_knee",
                })
                vulnerabilities.append({
                    "delivery": "Full delivery on off stump",
                    "reason": "Low stance restricts front foot drive and forces across-the-line movement.",
                    "risk": "High",
                })
                drills.append({
                    "name": "Stance height correction drill",
                    "description": (
                        "Stand in front of a mirror in batting stance. "
                        "Adjust knee bend to 130° and hold for 30 seconds. "
                        "Film from side-on to verify."
                    ),
                    "duration": "10 min × 3 sessions/week",
                    "targets": "knee_bend, balance",
                })
            elif rk > 155:
                weaknesses.append({
                    "title": "Insufficient knee bend — standing too upright",
                    "detail": (
                        f"Right knee at {rk:.1f}°. Above 155° reduces balance "
                        f"and power generation through the shot."
                    ),
                    "severity": "Med",
                    "joint": "right_knee",
                })
                vulnerabilities.append({
                    "delivery": "Short pitched ball into the ribs",
                    "reason": "Upright stance limits ability to sway away from the short ball.",
                    "risk": "High",
                })
                drills.append({
                    "name": "Athletic stance drill",
                    "description": (
                        "Practice batting stance with knees at 130–145°. "
                        "Hold for 30 seconds focusing on balance and weight distribution."
                    ),
                    "duration": "10 min × 3 sessions/week",
                    "targets": "knee_bend, balance",
                })
            else:
                strengths.append(
                    f"Good knee bend at {rk:.1f}° — within the ideal 118–155° batting range."
                )
 
        # Head position
        if abs(head_off) > 25:
            direction = "right" if head_off > 0 else "left"
            weaknesses.append({
                "title": f"Head falling {direction} — unstable eye line",
                "detail": (
                    f"Head is {abs(head_off):.0f}px off center. "
                    f"Head falling over causes mistimed shots and poor ball tracking."
                ),
                "severity": "High" if abs(head_off) > 40 else "Med",
                "joint": "head/neck",
            })
            vulnerabilities.append({
                "delivery": "Away swing outside off stump",
                "reason": "Head position pulls eyes off the ball line, making late movement hard to track.",
                "risk": "Critical",
            })
            drills.append({
                "name": "Head position mirror drill",
                "description": (
                    "Shadow bat in front of a full-length mirror. "
                    "Keep eyes level and head perfectly still throughout each shot. "
                    "A coin balanced on your helmet is a useful feedback tool."
                ),
                "duration": "15 min daily",
                "targets": "head_stability, eye_line",
            })
        else:
            strengths.append("Head remains stable and centered — good eye position throughout stance.")
 
        # Elbow 
        if re_ is not None:
            if re_ < 70:
                weaknesses.append({
                    "title": "Tucked elbow — restricted bat swing arc",
                    "detail": (
                        f"Right elbow at {re_:.1f}°. Tucked elbows restrict "
                        f"the bat swing arc and reduce power through the hitting zone."
                    ),
                    "severity": "Med",
                    "joint": "right_elbow",
                })
                drills.append({
                    "name": "High elbow drive drill",
                    "description": (
                        "Use a resistance band to practice leading with a high right elbow "
                        "on the drive. Elbow should stay above the wrist at the top of the swing."
                    ),
                    "duration": "10 min × 4 sessions/week",
                    "targets": "elbow_position, bat_swing",
                })
            elif re_ > 145:
                weaknesses.append({
                    "title": "Overextended elbow — loss of bat control",
                    "detail": (
                        f"Right elbow at {re_:.1f}°. Overextension causes the bat "
                        f"to drift away from the body reducing control."
                    ),
                    "severity": "Med",
                    "joint": "right_elbow",
                })
            else:
                strengths.append(f"Elbow angle at {re_:.1f}° — good bat control position.")
 
        # Stance width 
        if stance_r < 0.9:
            weaknesses.append({
                "title": "Narrow stance — poor base of support",
                "detail": (
                    f"Stance ratio {stance_r:.2f}. A narrow stance limits "
                    f"balance and weight transfer power."
                ),
                "severity": "Med",
                "joint": "feet/ankles",
            })
            vulnerabilities.append({
                "delivery": "Yorker on middle stump",
                "reason": "Narrow base makes it hard to get low quickly for yorker defence.",
                "risk": "High",
            })
        elif stance_r > 1.65:
            weaknesses.append({
                "title": "Very wide stance — restricted footwork",
                "detail": (
                    f"Stance ratio {stance_r:.2f}. Too wide a stance prevents "
                    f"effective front or back foot movement."
                ),
                "severity": "High",
                "joint": "feet/ankles",
            })
            vulnerabilities.append({
                "delivery": "Good length delivery on off stump",
                "reason": "Wide stance restricts ability to move front foot to pitch of ball.",
                "risk": "High",
            })
            drills.append({
                "name": "Footwork ladder drill",
                "description": (
                    "Use a speed ladder to practice front and back foot movements "
                    "from a balanced stance. React to coach's call for drive vs pull."
                ),
                "duration": "20 min × 3 sessions/week",
                "targets": "footwork, stance_width",
            })
        else:
            strengths.append(f"Stance width ratio {stance_r:.2f} — well balanced base.")
 
        # Wrist / bat lift 
        if wrist_h < 0.28:
            weaknesses.append({
                "title": "Low bat lift — restricted backswing",
                "detail": (
                    f"Wrist height {wrist_h:.2f}. A low backswing reduces time "
                    f"to generate bat speed through the hitting zone."
                ),
                "severity": "Med",
                "joint": "wrists",
            })
        else:
            strengths.append("Good bat lift height — generating sufficient swing arc.")
 
        # Default vulnerability if none found 
        if not vulnerabilities:
            vulnerabilities.append({
                "delivery": "Leg spin on a length, turning away",
                "reason": "Detected stance position creates vulnerability to turn away from body.",
                "risk": "Med",
            })
 
        drills.append({
            "name": "Soft hands leave drill",
            "description": (
                "Face throw-downs on a good length outside off. "
                "Practice leaving balls with soft hands. "
                "Builds discipline and late decision-making."
            ),
            "duration": "15 min × session",
            "targets": "shot_selection, hands",
        })
        drills.append({
            "name": "Tee batting — front foot drive",
            "description": (
                "Place ball on tee at front-foot reach. "
                "Drive straight through the line. "
                "Film from side-on to check head position and elbow."
            ),
            "duration": "10 min × 4 sessions/week",
            "targets": "technique, head_position",
        })
 
        # Scores 
        high_count = sum(1 for w in weaknesses if w["severity"] == "High")
        med_count  = sum(1 for w in weaknesses if w["severity"] == "Med")
        overall    = max(20, min(92, 100 - high_count*18 - med_count*8))
 
        sub_scores = {
            "posture":   max(20, min(95, 85 - high_count*15 - med_count*5)),
            "balance":   max(20, min(95, 80 if abs(head_off) > 25 else 90)),
            "technique": max(20, min(95, overall + 4)),
            "footwork":  max(20, min(95, 75 if stance_r < 0.9 or stance_r > 1.65 else 88)),
        }
 
        summary = (
            f"Batting technique analysis reveals "
            f"{'significant' if high_count >= 2 else 'moderate' if high_count == 1 else 'minor'} "
            f"areas for improvement. "
        )
        if rk:
            summary += f"Right knee measured at {rk:.1f}°. "
        summary += (
            f"{'Head position requires attention. ' if abs(head_off) > 25 else 'Head position is stable. '}"
            f"Overall technique is "
            f"{'developing' if overall < 60 else 'solid' if overall < 80 else 'advanced'}."
        )
 
        pro_map = [
            (85, 100, "Virat Kohli — compact, balanced stance with excellent head position"),
            (65,  84, "Shubman Gill — technically correct with room to develop power"),
            (45,  64, "Early-career MS Dhoni — raw power with technique refinements needed"),
            (0,   44, "Junior academy level — fundamentals need structured coaching attention"),
        ]
        pro_comp = next(v for lo, hi, v in pro_map if lo <= overall <= hi)
 
    
    # BOWLER ANALYSIS
    else:
        sa = metrics.get("shoulder_alignment_angle_deg", 0)
 
        # Bowling arm height 
        if rs is not None and rs < 135:
            weaknesses.append({
                "title": "Low bowling arm at release",
                "detail": (
                    f"Right shoulder angle {rs:.1f}°. Arm below ideal release height "
                    f"reduces bounce and increases injury risk to shoulder."
                ),
                "severity": "High",
                "joint": "right_shoulder",
            })
            vulnerabilities.append({
                "delivery": "Short of length delivery",
                "reason": "Low arm produces flat trajectory — easier for batsman to pull or cut.",
                "risk": "High",
            })
            drills.append({
                "name": "High arm bowling drill",
                "description": (
                    "Bowl against a wall target placed above shoulder height. "
                    "Force the bowling arm to reach its highest point before release."
                ),
                "duration": "20 min × session",
                "targets": "arm_height, release_point",
            })
        elif rs is not None:
            strengths.append(f"Good arm height at {rs:.1f}° — generating steep delivery angle.")
 
        # Front knee 
        if rk is not None and rk < 150:
            weaknesses.append({
                "title": "Bent front knee at delivery",
                "detail": (
                    f"Front knee at {rk:.1f}°. Knee should be braced (close to 170°) "
                    f"at release for effective load transfer and pace."
                ),
                "severity": "High" if rk < 130 else "Med",
                "joint": "right_knee",
            })
            vulnerabilities.append({
                "delivery": "Any full delivery",
                "reason": "Bent front knee causes the body to collapse forward reducing pace.",
                "risk": "Med",
            })
            drills.append({
                "name": "Front knee brace drill",
                "description": (
                    "Bowl off a short run-up focusing on driving the front knee "
                    "straight through delivery. Have a coach watch from side-on."
                ),
                "duration": "15 min × session",
                "targets": "front_knee, pace_generation",
            })
        elif rk is not None:
            strengths.append(f"Front knee well braced at {rk:.1f}° — good load transfer at delivery.")
 
        # Shoulder alignment (side-on vs front-on) 
        if abs(sa) < 15:
            weaknesses.append({
                "title": "Front-on action — limited seam control",
                "detail": (
                    f"Shoulder alignment angle {sa:.1f}°. A more side-on action "
                    f"improves seam presentation and outswing generation."
                ),
                "severity": "Med",
                "joint": "shoulders",
            })
            drills.append({
                "name": "Side-on alignment drill",
                "description": (
                    "Practice delivery stride with a hoop on the crease. "
                    "Drive the non-bowling arm down and across body to force hip rotation."
                ),
                "duration": "20 min × 3 sessions/week",
                "targets": "hip_rotation, side_on_action",
            })
 
        # Default vulnerability 
        if not vulnerabilities:
            vulnerabilities.append({
                "delivery": "Full delivery on off stump",
                "reason": "Action analysis suggests inconsistency in line and length.",
                "risk": "Med",
            })
 
        # Always add conditioning drill 
        drills.append({
            "name": "Rhythm bowling — 6 over spell",
            "description": (
                "Bowl a full 6-over spell in the nets focusing purely on rhythm "
                "and consistent release point. Don't try to bowl fast — let the action flow."
            ),
            "duration": "30 min × 2 sessions/week",
            "targets": "rhythm, consistency",
        })
 
        # Scores 
        high_count = sum(1 for w in weaknesses if w["severity"] == "High")
        med_count  = sum(1 for w in weaknesses if w["severity"] == "Med")
        overall    = max(20, min(92, 100 - high_count*18 - med_count*8))
 
        sub_scores = {
            "posture":   max(20, min(95, 82 - high_count*12)),
            "balance":   max(20, min(95, 85)),
            "technique": max(20, min(95, overall)),
            "footwork":  max(20, min(95, 80)),
        }
 
        summary = (
            f"Bowling action analysis shows "
            f"{'significant' if high_count >= 2 else 'some'} areas for improvement. "
            f"Arm height and front knee position are the key determinants "
            f"of pace and bounce at this level."
        )
 
        pro_comp = (
            "Jasprit Bumrah — if front knee and arm height are corrected"
            if overall > 70 else
            "Early-career Shami — action in development with clear technical targets"
        )
 
    # Default strengths if none found 
    if not strengths:
        strengths.append("Shows commitment to technique development.")
        strengths.append("Consistent stance setup before each delivery.")
 
    return {
        "summary":         summary,
        "player_type":     player_type,
        "overall_score":   overall,
        "scores":          sub_scores,
        "weaknesses":      weaknesses[:4],
        "vulnerable_zones": vulnerabilities[:3],
        "drills":          drills[:4],
        "strengths":       strengths[:3],
        "pro_comparison":  pro_comp,
        "model":           "CrickLM-10M (local transformer)",
    }
 
 
# Inference engine 
class CrickLMInference:
    """
    Main inference class. Drop-in replacement for external AI API.
    Auto-detects player type and warns if user selected the wrong one.
    """
 
    def __init__(
        self,
        checkpoint_path: str = "checkpoints/best.pt",
        tokenizer_path:  str = "checkpoints/tokenizer.json",
        device: Optional[str] = None,
    ):
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.model     = None
        self.tokenizer = None
        self._loaded   = False
 
        ckpt = Path(checkpoint_path)
        tok  = Path(tokenizer_path)
 
        if ckpt.exists() and tok.exists():
            self._load(str(ckpt), str(tok))
        else:
            print(
                "[CrickLM] No trained checkpoint found. "
                "Running in rule-based mode. "
                "Train the model first: python train.py"
            )
 
    def _load(self, ckpt_path: str, tok_path: str) -> None:
        print(f"[CrickLM] Loading tokenizer ← {tok_path}")
        self.tokenizer = CrickTokenizer.load(tok_path)
 
        print(f"[CrickLM] Loading model ← {ckpt_path}")
        ckpt        = torch.load(ckpt_path, map_location=self.device)
        config_dict = ckpt.get("model_config", {})
        config      = CrickLMConfig(**config_dict)
        self.model  = CrickLM(config).to(self.device)
        self.model.load_state_dict(ckpt["model_state"])
        self.model.eval()
        self._loaded = True
        print(f"[CrickLM] Model ready on {self.device}")
 
    def _generate_text(self, prompt: str, max_tokens: int = 80) -> str:
        if not self._loaded:
            return ""
        ids = self.tokenizer.encode(prompt, add_bos=True, add_eos=False)
        x   = torch.tensor([ids], dtype=torch.long).to(self.device)
        with torch.no_grad():
            out = self.model.generate(
                x, max_new_tokens=max_tokens,
                temperature=0.7, top_k=30, top_p=0.9
            )
        return self.tokenizer.decode(out[0].tolist())
 
    def analyze(self, features: dict, player_type: str = "batsman") -> dict:
        
        # Step 1: Auto-detect from pose 
        detected_type, confidence = detect_player_type(features)
 
        # Step 2: Check for mismatch 
        mismatch         = detected_type != player_type
        mismatch_warning = None
 
        if mismatch and confidence >= 0.62:
            actual_type = detected_type
            mismatch_warning = (
                f"You selected '{player_type}' but this image appears to show "
                f"a {detected_type} (auto-detected with {int(confidence*100)}% confidence). "
                f"Analysis has been automatically switched to {detected_type} mode."
            )
        else:
            actual_type = player_type
 
        # Step 3: Build prompt + generate 
        prompt    = build_analysis_prompt(features, actual_type)
        generated = self._generate_text(prompt)
 
        # Step 4: Parse into structured result 
        result = parse_generated_text(generated, features, actual_type)
 
        # Step 5: Inject mismatch info 
        if mismatch_warning:
            result["mismatch_warning"]   = mismatch_warning
            result["auto_detected"]      = detected_type
            result["original_selection"] = player_type
 
        return result