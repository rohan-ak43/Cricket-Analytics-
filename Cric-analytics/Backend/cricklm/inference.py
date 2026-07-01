"""
inference.py — CrickLM Inference Engine
"""

import json
import math
import re
import torch
from pathlib import Path
from typing import Optional
 
from model import CrickLM, CrickLMConfig
from tokenizer import CrickTokenizer

# benchmarking angles
BENCHMARKS = {
    # Batting
    "right_knee_bat":  (120, 145),   # ideal range degrees
    "left_knee_bat":   (120, 150),
    "right_elbow_bat": (80,  130),
    "head_offset_px":  (-20,  20),   # pixels from center
 
    # Bowling
    "right_knee_bowl": (140, 165),   # front knee at delivery
    "right_elbow_bowl":(150, 180),   # arm should be near straight at release
    "shoulder_angle":  (15,   45),   # degrees of rotation for side-on action
}

SEVERITY_THRESHOLD = {
    "High": 25,   # angle deviates more than 25° from ideal range
    "Med":  10,   # angle deviates 10-25° from ideal range
    # otherwise "Low"
}

