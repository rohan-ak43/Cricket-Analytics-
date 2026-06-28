# CricIQ — AI-Powered Cricket Batting Analytics 🏏🤖

CricIQ is a state-of-the-art web application that analyzes cricket batting posture, biomechanics, and technique using computer vision and deep learning. By combining **MediaPipe Pose Estimation** and a custom **CrickLM transformer model**, CricIQ extracts joint angles from video or image uploads, scores technique, diagnoses flaws, and suggests targeted drills.

---

## 🌟 Key Features

*   **Posture & Biomechanics Tracking:** Uses MediaPipe Tasks API to map body joints in real-time, computing critical angles (elbows, shoulders, hips, knees) during the setup, backlift, and follow-through.
*   **CrickLM AI Inference:** Evaluates batting posture against a custom deep learning transformer model (`CrickLM`) to score batting alignment and flow.
*   **Vulnerability Detection:** Identifies joint alignment weaknesses (e.g., dropped shoulders, open hips) and highlights high-risk delivery zones (e.g., vulnerable to short-pitched balls or yorkers).
*   **Personalized Training Drills:** Generates custom training routines and duration-based drills tailored to address diagnosed technical flaws.
*   **Pro Player Benchmarking:** Compares player posture against professional profiles to provide actionable, elite-level adjustments.
*   **Premium Glassmorphism Dashboard:** Responsive, responsive UI with smooth transitions, interactive skeleton animation overlays, and dark-theme aesthetics.

---

## 📂 Project Structure

```text
├── Cric-analytics/
│   ├── Backend/          # Python API (FastAPI, PyTorch, MediaPipe, OpenCV)
│   │   ├── main.py       # FastAPI application and route definitions
│   │   ├── requirements.txt # Python package dependencies
│   │   └── Cricklm/      # Deep learning model package and inference scripts
│   │
│   └── Frontend/         # React SPA (TypeScript, Vite, Vanilla CSS)
│       ├── src/          # React components, style definitions, and states
│       ├── package.json  # NPM scripts and package dependencies
│       └── vite.config.js# Vite build configurations
```

---

## ⚡ Setup & Local Development

### 1. Backend API Setup

The backend is built with FastAPI and requires Python 3.10+.

1.  Navigate to the Backend directory:
    ```bash
    cd Cric-analytics/Backend
    ```
2.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    *Note: If you have a GPU and want PyTorch CUDA acceleration, install the CUDA-supported version of PyTorch:*
    ```bash
    pip install torch --index-url https://download.pytorch.org/whl/cu121
    ```
3.  Start the FastAPI server:
    ```bash
    uvicorn main:app --reload
    ```
    The API will be available at `http://localhost:8000`.

### 2. Frontend Setup

The frontend is built with React, TypeScript, and Vite.

1.  Navigate to the Frontend directory:
    ```bash
    cd Cric-analytics/Frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Run the local development server:
    ```bash
    npm run dev
    ```
    The web app will be available at `http://localhost:5173`.

---

