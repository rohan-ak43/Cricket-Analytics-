"""
celery_app.py — Celery worker configuration and video processing pipeline.

Background task workflow:
1. Load video from storage
2. Extract frames (OpenCV)
3. Run pose detection (MediaPipe)
4. Run ball tracking (YOLOv8)
5. Estimate speed
6. Classify shot type (batting) or bowling metrics
7. Generate AI feedback
8. Save all results to PostgreSQL
9. Update video status → completed/failed
"""
import os
import time
import logging
from celery import Celery
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.ai.pose_detector import run_pose_analysis
from app.ai.ball_tracker import run_ball_tracking
from app.ai.speed_estimator import estimate_speed_from_detections
from app.ai.shot_classifier import shot_classifier
from app.ai.feedback_engine import feedback_engine

logger = logging.getLogger(__name__)

# ── Celery configuration ──────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "crickai",
    broker=os.getenv("CELERY_BROKER_URL", REDIS_URL),
    backend=os.getenv("CELERY_RESULT_BACKEND", REDIS_URL.replace("/0", "/1")),
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,                   # Requeue on worker crash
    worker_prefetch_multiplier=1,          # Process one task at a time (CPU-heavy)
    task_soft_time_limit=600,              # 10 min soft limit
    task_time_limit=900,                   # 15 min hard limit
)

# ── Sync DB session for Celery workers (not async) ────────────────────────────
SYNC_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://crickai_user:crickai_pass@localhost:5432/crickai"
).replace("+asyncpg", "")   # Use sync driver in workers

sync_engine = create_engine(SYNC_DB_URL, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)


def get_sync_db() -> Session:
    return SyncSession()


# ── Main processing task ──────────────────────────────────────────────────────

@celery_app.task(bind=True, name="workers.celery_app.process_video_task")
def process_video_task(self, video_id: str):
    """
    Full AI analysis pipeline for a single video.
    Runs in a Celery worker process.
    """
    db = get_sync_db()
    start_time = time.time()

    try:
        # Import models inside task to avoid circular imports
        from app.models.video import (
            Video, AnalysisResult, PoseData, BallTracking,
            SpeedMetrics, FeedbackReport, ProcessingStatus
        )

        # ── Step 1: Fetch video record ────────────────────────────────────────
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            logger.error(f"Video {video_id} not found")
            return {"status": "error", "message": "Video not found"}

        video.processing_status = ProcessingStatus.processing
        db.commit()

        # ── Step 2: Resolve local file path ───────────────────────────────────
        video_path = _resolve_video_path(video.video_url)
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        # ── Step 3: Pose detection ─────────────────────────────────────────────
        logger.info(f"[{video_id}] Running pose detection...")
        self.update_state(state="PROGRESS", meta={"step": "pose_detection", "progress": 20})
        pose_results = run_pose_analysis(video_path, frame_skip=3)

        # ── Step 4: Ball tracking ─────────────────────────────────────────────
        logger.info(f"[{video_id}] Running ball tracking...")
        self.update_state(state="PROGRESS", meta={"step": "ball_tracking", "progress": 40})
        ball_results = run_ball_tracking(video_path, frame_skip=2)

        # ── Step 5: Speed estimation ──────────────────────────────────────────
        logger.info(f"[{video_id}] Estimating speed...")
        self.update_state(state="PROGRESS", meta={"step": "speed_estimation", "progress": 60})
        speed_results = estimate_speed_from_detections(
            ball_results.get("detections", []),
            fps=30.0,
        )

        # ── Step 6: Shot classification (batting) ──────────────────────────────
        shot_results = {}
        if video.analysis_type.value == "batting":
            logger.info(f"[{video_id}] Classifying shots...")
            self.update_state(state="PROGRESS", meta={"step": "shot_classification", "progress": 75})
            shot_results = shot_classifier.classify(pose_results.get("frames", []))

        # ── Step 7: Feedback generation ────────────────────────────────────────
        logger.info(f"[{video_id}] Generating feedback...")
        self.update_state(state="PROGRESS", meta={"step": "feedback_generation", "progress": 85})
        fb_results = feedback_engine.generate_feedback(
            analysis_type=video.analysis_type.value,
            pose_results=pose_results,
            speed_results=speed_results,
            shot_results=shot_results,
        )

        # ── Step 8: Compute overall score ─────────────────────────────────────
        overall_score = _compute_overall_score(
            pose_results, speed_results, shot_results, video.analysis_type.value
        )

        # ── Step 9: Persist results ───────────────────────────────────────────
        logger.info(f"[{video_id}] Saving results to database...")
        self.update_state(state="PROGRESS", meta={"step": "saving", "progress": 95})

        processing_time = round(time.time() - start_time, 2)

        # Create AnalysisResult
        ar = AnalysisResult(
            video_id=video_id,
            analysis_type=video.analysis_type,
            overall_score=overall_score,
            frames_analyzed=pose_results.get("analyzed_frames", 0),
            processing_time_seconds=processing_time,
            summary=fb_results.get("summary", ""),
        )
        db.add(ar)
        db.flush()

        # Save top pose frames (keep max 50 for storage efficiency)
        for frame_data in pose_results.get("frames", [])[:50]:
            pd = PoseData(
                analysis_id=ar.id,
                frame_number=frame_data["frame_number"],
                timestamp_ms=frame_data["timestamp_ms"],
                keypoints=frame_data["keypoints"],
                joint_angles=frame_data.get("joint_angles"),
                pose_score=frame_data.get("pose_score"),
                is_key_frame=frame_data.get("is_key_frame", False),
            )
            db.add(pd)

        # Save ball tracking (keep max 100 detections)
        for det in ball_results.get("detections", [])[:100]:
            bt = BallTracking(
                analysis_id=ar.id,
                frame_number=det["frame_number"],
                timestamp_ms=det["timestamp_ms"],
                x=det["x"],
                y=det["y"],
                confidence=det.get("confidence"),
                ball_detected=det.get("ball_detected", True),
            )
            db.add(bt)

        # Save speed metrics
        if speed_results.get("avg_speed_kmh") is not None or video.analysis_type.value == "bowling":
            sm = SpeedMetrics(
                analysis_id=ar.id,
                max_speed_kmh=speed_results.get("max_speed_kmh"),
                avg_speed_kmh=speed_results.get("avg_speed_kmh"),
                min_speed_kmh=speed_results.get("min_speed_kmh"),
                consistency_score=speed_results.get("consistency_score"),
                speed_series=speed_results.get("speed_series"),
                delivery_count=speed_results.get("delivery_count", 0),
            )
            db.add(sm)

        # Save feedback report
        fr = FeedbackReport(
            analysis_id=ar.id,
            analysis_type=video.analysis_type,
            shot_type=shot_results.get("shot_type"),
            shot_confidence=shot_results.get("shot_confidence"),
            feedback_items=fb_results.get("feedback_items", []),
            strengths=fb_results.get("strengths", []),
            improvements=fb_results.get("improvements", []),
            batting_metrics=shot_results.get("batting_metrics"),
            bowling_metrics=_extract_bowling_metrics(pose_results, speed_results),
        )
        db.add(fr)

        # Mark video as completed
        video.processing_status = ProcessingStatus.completed
        db.commit()

        logger.info(f"[{video_id}] Analysis complete in {processing_time}s. Score: {overall_score}")
        return {"status": "completed", "video_id": video_id, "processing_time": processing_time}

    except Exception as e:
        logger.exception(f"[{video_id}] Analysis failed: {e}")
        try:
            from app.models.video import Video, ProcessingStatus
            video = db.query(Video).filter(Video.id == video_id).first()
            if video:
                video.processing_status = ProcessingStatus.failed
                video.error_message = str(e)[:500]
                db.commit()
        except Exception:
            pass
        raise

    finally:
        db.close()


def _resolve_video_path(video_url: str) -> str:
    """Convert a video URL/path to a local file path."""
    if video_url.startswith("/uploads/"):
        return "." + video_url
    if video_url.startswith("http"):
        # For S3: download to temp location (implement if S3 enabled)
        raise NotImplementedError("S3 download in worker not yet implemented")
    return video_url


def _compute_overall_score(
    pose_results: dict,
    speed_results: dict,
    shot_results: dict,
    analysis_type: str,
) -> float:
    """Compute a 0-100 overall performance score."""
    scores = []

    # Pose consistency (weighted 30%)
    consistency = pose_results.get("consistency", 70)
    scores.append(("consistency", consistency, 0.3))

    if analysis_type == "bowling":
        # Speed consistency (40%)
        speed_consistency = speed_results.get("consistency_score") or 70
        scores.append(("speed_consistency", speed_consistency, 0.4))
        # Frames detected (30%)
        det_rate = (speed_results.get("delivery_count") or 0) * 20
        scores.append(("delivery", min(det_rate, 100), 0.3))
    else:
        # Batting metrics (70%)
        bm = shot_results.get("batting_metrics") or {}
        batting_avg = sum([
            bm.get("swing_score", 70),
            bm.get("foot_placement_score", 70),
            bm.get("head_stability_score", 70),
            bm.get("balance_score", 70),
        ]) / 4
        scores.append(("batting", batting_avg, 0.7))

    overall = sum(s * w for _, s, w in scores)
    return round(min(max(overall, 0), 100), 1)


def _extract_bowling_metrics(pose_results: dict, speed_results: dict) -> dict:
    """Extract bowling-specific metrics."""
    frames = pose_results.get("frames", [])
    avg_angles = {}
    for f in frames[:20]:
        for k, v in f.get("joint_angles", {}).items():
            avg_angles.setdefault(k, []).append(v)
    avg = {k: sum(v) / len(v) for k, v in avg_angles.items()}

    return {
        "release_angle_degrees": avg.get("right_elbow", 120),
        "follow_through_score": avg.get("right_hip", 70),
        "action_consistency": pose_results.get("consistency", 70),
        "landing_zone_score": speed_results.get("consistency_score") or 70,
    }