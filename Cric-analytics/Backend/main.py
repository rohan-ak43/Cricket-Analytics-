import base64
import io
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image 

# cricketlm model 
sys.path.insert(0, str(Path(__file__).parent / "Cricklm"))
from inference import  CrickLMInference

# mediapipe tasks api
import mediapipe as mp 
from mediapipe.tasks import python as mp_python 
from mediapipe.tasks.python import vision as mp_vision

# app
app = FastAPI(title="CrickIQ API",version="2.0.0")

# cors
app.add_middleware(CORSMiddleware, 
allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Constants
Green = (74, 255, 92)
MAX_DIM = 1080
MODEL_PATH = Path(__file__).parent/"cricklm"/"pose_landmarker_full.task"

# MediaPipe PoseLandmark indices (Tasks API uses integers directly)
NOSE           = 0
LEFT_SHOULDER  = 11;  RIGHT_SHOULDER = 12
LEFT_ELBOW     = 13;  RIGHT_ELBOW    = 14
LEFT_WRIST     = 15;  RIGHT_WRIST    = 16
LEFT_HIP       = 23;  RIGHT_HIP      = 24
LEFT_KNEE      = 25;  RIGHT_KNEE     = 26
LEFT_ANKLE     = 27;  RIGHT_ANKLE    = 28

# skeleton connection (index pairs)
CONNECTIONS = [
    (NOSE, LEFT_SHOULDER), (NOSE, RIGHT_SHOULDER),
    (LEFT_SHOULDER, RIGHT_SHOULDER),
    (LEFT_SHOULDER, LEFT_ELBOW), (LEFT_ELBOW, LEFT_WRIST),
    (RIGHT_SHOULDER, RIGHT_ELBOW), (RIGHT_ELBOW, RIGHT_WRIST),
    (LEFT_SHOULDER, LEFT_HIP), (RIGHT_SHOULDER, RIGHT_HIP),
    (LEFT_HIP, RIGHT_HIP),
    (LEFT_HIP, LEFT_KNEE), (LEFT_KNEE, LEFT_ANKLE),
    (RIGHT_HIP, RIGHT_KNEE), (RIGHT_KNEE, RIGHT_ANKLE),
]

# joints with angle labels
ANGLE_JOINTS = { 
    "right_elbow": (RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
    "left_elbow":  (LEFT_SHOULDER,  LEFT_ELBOW,  LEFT_WRIST),
    "right_knee":  (RIGHT_HIP,  RIGHT_KNEE,  RIGHT_ANKLE),
    "left_knee":   (LEFT_HIP,   LEFT_KNEE,   LEFT_ANKLE),
    "right_shoulder": (RIGHT_ELBOW, RIGHT_SHOULDER, RIGHT_HIP),
    "left_shoulder":  (LEFT_ELBOW,  LEFT_SHOULDER,  LEFT_HIP),
    "right_hip":   (RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE),
    "left_hip":    (LEFT_SHOULDER,  LEFT_HIP,  LEFT_KNEE),
}

# singletons
_landmarker: Optional[mp_vision.PoseLandmarker] = None
_crick_engine: Optional[CrickLMInference] = None

def get_landmarker() -> Optional[mp_vision.PoseLandmarker]:
    global _landmarker
    if _landmarker is not None:
        return _landmarker
    if not MODEL_PATH.exists():
        print(
            f"[WARN] Pose model not found at {MODEL_PATH}\n"
            f"       Download from: https://storage.googleapis.com/mediapipe-models/"
            f"pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
        )
        return None 
    opts = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path = str(MODEL_PATH)),
        running_mode=mp_vision.RunningMode.IMAGE,
        num_poses = 1,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
        output_segmentation_masks=False,
    )
    _landmarker = mp_vision.PoseLandmarker.create_from_options(opts)
    print("[OK] MediaPipe PoseLandmarker loaded.")
    return _landmarker

