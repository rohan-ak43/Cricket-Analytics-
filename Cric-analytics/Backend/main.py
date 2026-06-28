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


