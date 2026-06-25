"""
Analysis routes: trigger, fetch results, check status.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.connection import get_db
from app.models.video import (
    User, Video, AnalysisResult, SpeedMetrics,
    FeedbackReport, ProcessingStatus
)
from app.schemas.schemas import (
    AnalysisResultResponse, AnalysisStatusResponse,
    SpeedPoint, FeedbackItem, BattingMetrics, BowlingMetrics
)
from app.utils.auth import get_current_user

router = APIRouter()


@router.post("/analyze/{video_id}", response_model=AnalysisStatusResponse)
async def trigger_analysis(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger analysis for a video (re-queue if failed)."""
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.processing_status == ProcessingStatus.completed:
        return AnalysisStatusResponse(
            video_id=video_id,
            status=ProcessingStatus.completed,
            progress_percent=100,
            message="Analysis already completed",
        )

    try:
        from workers.celery_app import process_video_task
        task = process_video_task.delay(video.id)
        video.celery_task_id = task.id
        video.processing_status = ProcessingStatus.processing
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue task: {str(e)}")

    return AnalysisStatusResponse(
        video_id=video_id,
        status=ProcessingStatus.processing,
        progress_percent=0,
        message="Analysis queued successfully",
    )


@router.get("/{video_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Poll the processing status of a video."""
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    status_messages = {
        ProcessingStatus.pending: "Waiting in queue...",
        ProcessingStatus.processing: "AI is analyzing your video...",
        ProcessingStatus.completed: "Analysis complete!",
        ProcessingStatus.failed: video.error_message or "Analysis failed",
    }
    progress_map = {
        ProcessingStatus.pending: 5,
        ProcessingStatus.processing: 50,
        ProcessingStatus.completed: 100,
        ProcessingStatus.failed: 0,
    }

    return AnalysisStatusResponse(
        video_id=video_id,
        status=video.processing_status,
        progress_percent=progress_map[video.processing_status],
        message=status_messages[video.processing_status],
    )


@router.get("/{video_id}", response_model=AnalysisResultResponse)
async def get_analysis_result(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch the full analysis result for a completed video."""
    # Verify ownership
    vid_result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = vid_result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.processing_status != ProcessingStatus.completed:
        raise HTTPException(
            status_code=202,
            detail=f"Analysis not ready yet. Status: {video.processing_status}",
        )

    # Load analysis with related data
    ar_result = await db.execute(
        select(AnalysisResult)
        .where(AnalysisResult.video_id == video_id)
        .options(
            selectinload(AnalysisResult.speed_metrics),
            selectinload(AnalysisResult.feedback_report),
        )
    )
    ar = ar_result.scalar_one_or_none()
    if not ar:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    # Build response
    response = AnalysisResultResponse(
        id=ar.id,
        video_id=ar.video_id,
        analysis_type=ar.analysis_type,
        overall_score=ar.overall_score,
        frames_analyzed=ar.frames_analyzed,
        processing_time_seconds=ar.processing_time_seconds,
        summary=ar.summary,
        completed_at=ar.completed_at,
    )

    if ar.speed_metrics:
        sm = ar.speed_metrics
        response.max_speed_kmh = sm.max_speed_kmh
        response.avg_speed_kmh = sm.avg_speed_kmh
        response.consistency_score = sm.consistency_score
        if sm.speed_series:
            response.speed_series = [SpeedPoint(**p) for p in sm.speed_series]

    if ar.feedback_report:
        fr = ar.feedback_report
        response.feedback_items = [FeedbackItem(**f) for f in (fr.feedback_items or [])]
        response.strengths = fr.strengths
        response.improvements = fr.improvements
        if fr.batting_metrics:
            response.batting_metrics = BattingMetrics(**fr.batting_metrics)
        if fr.bowling_metrics:
            response.bowling_metrics = BowlingMetrics(**fr.bowling_metrics)

    return response