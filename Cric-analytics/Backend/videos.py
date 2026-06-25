"""
Video routes: upload, list, fetch, delete.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from app.database.connection import get_db
from app.models.video import User, Video, AnalysisType, ProcessingStatus
from app.schemas.schemas import VideoResponse, VideoListResponse
from app.utils.auth import get_current_user
from app.utils.storage import save_upload, validate_video_file
from app.utils.rate_limiter import limiter

router = APIRouter()


@router.post("/upload", response_model=VideoResponse, status_code=201)
@limiter.limit("5/minute")
async def upload_video(
    request: Request,
    analysis_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a cricket video and queue it for AI analysis."""
    # Validate file
    file_data = await file.read()
    try:
        validate_video_file(file.filename, len(file_data))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if analysis_type not in ("batting", "bowling"):
        raise HTTPException(status_code=400, detail="analysis_type must be 'batting' or 'bowling'")

    # Save to storage
    video_url = await save_upload(file_data, file.filename, current_user.id)

    video = Video(
        user_id=current_user.id,
        original_filename=file.filename,
        video_url=video_url,
        analysis_type=AnalysisType(analysis_type),
        file_size_mb=round(len(file_data) / 1024 / 1024, 2),
        processing_status=ProcessingStatus.pending,
    )
    db.add(video)
    await db.flush()

    # Queue Celery task
    try:
        from workers.celery_app import process_video_task
        task = process_video_task.delay(video.id)
        video.celery_task_id = task.id
        video.processing_status = ProcessingStatus.processing
    except Exception:
        # Continue without Celery in dev if Redis not available
        pass

    return VideoResponse.model_validate(video)


@router.get("", response_model=VideoListResponse)
async def list_videos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
):
    """List all videos for the current user."""
    result = await db.execute(
        select(Video)
        .where(Video.user_id == current_user.id)
        .order_by(desc(Video.upload_time))
        .limit(limit)
        .offset(offset)
    )
    videos = result.scalars().all()

    count_result = await db.execute(
        select(Video).where(Video.user_id == current_user.id)
    )
    total = len(count_result.scalars().all())

    return VideoListResponse(
        videos=[VideoResponse.model_validate(v) for v in videos],
        total=total,
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single video by ID."""
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoResponse.model_validate(video)


@router.delete("/{video_id}", status_code=204)
async def delete_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a video and its analysis data."""
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    await db.delete(video)