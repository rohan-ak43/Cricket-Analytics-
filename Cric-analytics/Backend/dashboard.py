"""
Dashboard routes: aggregated stats and history.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List

from app.database.connection import get_db
from app.models.video import (
    User, Video, AnalysisResult, SpeedMetrics,
    FeedbackReport, AnalysisType, ProcessingStatus
)
from app.schemas.schemas import DashboardStats, SessionHistoryItem
from app.utils.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate dashboard statistics for the current user."""
    # All videos
    all_vids = (await db.execute(
        select(Video).where(Video.user_id == current_user.id)
    )).scalars().all()

    total = len(all_vids)
    batting = sum(1 for v in all_vids if v.analysis_type == AnalysisType.batting)
    bowling = sum(1 for v in all_vids if v.analysis_type == AnalysisType.bowling)

    # Sessions this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    this_week = sum(
        1 for v in all_vids
        if v.upload_time and v.upload_time.replace(tzinfo=timezone.utc) >= week_ago
    )

    # Speed metrics
    completed_video_ids = [v.id for v in all_vids if v.processing_status == ProcessingStatus.completed]
    avg_speed = best_speed = None
    if completed_video_ids:
        speed_rows = (await db.execute(
            select(SpeedMetrics)
            .join(AnalysisResult, SpeedMetrics.analysis_id == AnalysisResult.id)
            .where(AnalysisResult.video_id.in_(completed_video_ids))
        )).scalars().all()

        if speed_rows:
            speeds = [s.avg_speed_kmh for s in speed_rows if s.avg_speed_kmh]
            maxes = [s.max_speed_kmh for s in speed_rows if s.max_speed_kmh]
            avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else None
            best_speed = round(max(maxes), 1) if maxes else None

    # Overall scores
    ar_rows = (await db.execute(
        select(AnalysisResult)
        .where(AnalysisResult.video_id.in_(completed_video_ids))
    )).scalars().all()

    scores = [r.overall_score for r in ar_rows if r.overall_score]
    avg_score = round(sum(scores) / len(scores), 1) if scores else None

    # Improvement trend: compare last 3 sessions avg vs prior 3
    sorted_scores = [
        r.overall_score for r in sorted(ar_rows, key=lambda x: x.completed_at, reverse=True)
        if r.overall_score
    ]
    trend = 0.0
    if len(sorted_scores) >= 4:
        recent_avg = sum(sorted_scores[:3]) / 3
        earlier_avg = sum(sorted_scores[3:6]) / len(sorted_scores[3:6])
        trend = round(recent_avg - earlier_avg, 1)

    return DashboardStats(
        total_sessions=total,
        batting_sessions=batting,
        bowling_sessions=bowling,
        avg_bowling_speed=avg_speed,
        best_bowling_speed=best_speed,
        avg_overall_score=avg_score,
        sessions_this_week=this_week,
        improvement_trend=trend,
    )


@router.get("/history", response_model=List[SessionHistoryItem])
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 10,
    offset: int = 0,
):
    """Return paginated session history with key metrics."""
    vids = (await db.execute(
        select(Video)
        .where(Video.user_id == current_user.id)
        .order_by(desc(Video.upload_time))
        .limit(limit)
        .offset(offset)
    )).scalars().all()

    items: List[SessionHistoryItem] = []
    for v in vids:
        avg_speed = shot_type = overall_score = None

        if v.processing_status == ProcessingStatus.completed:
            ar = (await db.execute(
                select(AnalysisResult).where(AnalysisResult.video_id == v.id)
            )).scalar_one_or_none()
            if ar:
                overall_score = ar.overall_score
                sm = (await db.execute(
                    select(SpeedMetrics).where(SpeedMetrics.analysis_id == ar.id)
                )).scalar_one_or_none()
                if sm:
                    avg_speed = sm.avg_speed_kmh
                fr = (await db.execute(
                    select(FeedbackReport).where(FeedbackReport.analysis_id == ar.id)
                )).scalar_one_or_none()
                if fr:
                    shot_type = fr.shot_type

        items.append(SessionHistoryItem(
            video_id=v.id,
            analysis_type=v.analysis_type,
            upload_time=v.upload_time,
            processing_status=v.processing_status,
            overall_score=overall_score,
            avg_speed_kmh=avg_speed,
            shot_type=shot_type,
            thumbnail_url=v.thumbnail_url,
        ))

    return items