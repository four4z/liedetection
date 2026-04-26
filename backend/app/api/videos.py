from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime
from typing import Optional, List
import uuid
from bson import ObjectId

from app.models.schemas import (
    VideoResponse, VideoListItem, VideoUpload, VideoLinkSubmit,
    SegmentResult, VideoSummary
)
from app.database.connection import get_videos_collection, get_history_collection
from app.api.auth import get_current_user, get_optional_user
from app.ai.analyzer import analyze_video

router = APIRouter()


def _build_video_response(video: dict) -> VideoResponse:
    """Helper: convert a MongoDB video document → VideoResponse."""
    segments = []
    for seg in video.get("segments", []):
        segments.append(SegmentResult(**seg))

    summary = None
    if video.get("summary"):
        summary = VideoSummary(**video["summary"])

    return VideoResponse(
        id=str(video["_id"]),
        user_id=video.get("user_id"),
        video=video.get("video", ""),
        video_url=video["video_url"],
        thumbnail_url=video.get("thumbnail_url"),
        uploaded_at=video["uploaded_at"],
        video_duration=video.get("video_duration"),
        segments=segments,
        summary=summary,
        analysis_status=video.get("analysis_status", "pending"),
    )


def _build_list_item(video: dict) -> VideoListItem:
    """Helper: convert a MongoDB video document → VideoListItem (no segments)."""
    summary = None
    if video.get("summary"):
        summary = VideoSummary(**video["summary"])

    return VideoListItem(
        id=str(video["_id"]),
        user_id=video.get("user_id"),
        video=video.get("video", ""),
        video_url=video["video_url"],
        thumbnail_url=video.get("thumbnail_url"),
        uploaded_at=video["uploaded_at"],
        video_duration=video.get("video_duration"),
        summary=summary,
        analysis_status=video.get("analysis_status", "pending"),
    )


# ---------------------------------------------------------------------------
# POST /api/videos/upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=VideoUpload)
async def upload_video(
    video_data: VideoLinkSubmit,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Submit a video link for analysis. Works for both logged-in and anonymous users."""

    # Basic URL validation
    if not video_data.video_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")

    is_anonymous = current_user is None
    session_token = str(uuid.uuid4()) if is_anonymous else None
    video_name = video_data.video or video_data.video_url.rsplit("/", 1)[-1]

    video_doc = {
        "user_id": str(current_user["_id"]) if current_user else None,
        "session_token": session_token,
        "video": video_name,
        "video_url": video_data.video_url,
        "thumbnail_url": video_data.thumbnail_url,
        "uploaded_at": datetime.utcnow(),
        "video_duration": None,
        "is_anonymous": is_anonymous,
        "is_claimed": False,
        "segments": [],
        "summary": None,
        "analysis_status": "pending",
    }

    videos = get_videos_collection()
    result = await videos.insert_one(video_doc)

    return VideoUpload(
        id=str(result.inserted_id),
        video=video_name,
        video_url=video_data.video_url,
        thumbnail_url=video_data.thumbnail_url,
        uploaded_at=video_doc["uploaded_at"],
        is_anonymous=is_anonymous,
        session_token=session_token,
    )


# ---------------------------------------------------------------------------
# GET /api/videos/{video_id}
# ---------------------------------------------------------------------------

@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Get full video details (including segments) by ID."""
    videos = get_videos_collection()

    try:
        video = await videos.find_one({"_id": ObjectId(video_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Log view in history if user is logged in
    if current_user:
        history = get_history_collection()
        await history.insert_one({
            "userId": str(current_user["_id"]),
            "videoId": video_id,
            "viewedAt": datetime.utcnow()
        })

    return _build_video_response(video)


# ---------------------------------------------------------------------------
# POST /api/videos/{video_id}/analyze
# ---------------------------------------------------------------------------

@router.post("/{video_id}/analyze")
async def trigger_analysis(
    video_id: str,
    background_tasks: BackgroundTasks
):
    """Trigger lie detection analysis on a video."""
    videos = get_videos_collection()

    try:
        video = await videos.find_one({"_id": ObjectId(video_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.get("analysis_status") == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")

    # Update status to processing
    await videos.update_one(
        {"_id": ObjectId(video_id)},
        {"$set": {"analysis_status": "processing"}}
    )

    # Run analysis in background
    background_tasks.add_task(analyze_video, video_id)

    return {"message": "Analysis started", "videoId": video_id, "status": "processing"}


# ---------------------------------------------------------------------------
# POST /api/videos/claim
# ---------------------------------------------------------------------------

@router.post("/claim")
async def claim_anonymous_videos(
    session_token: str,
    current_user: dict = Depends(get_current_user)
):
    """Claim anonymous videos after login using session token."""
    videos = get_videos_collection()

    result = await videos.update_many(
        {"session_token": session_token, "is_anonymous": True},
        {"$set": {
            "user_id": str(current_user["_id"]),
            "is_anonymous": False,
            "is_claimed": True,
            "session_token": None
        }}
    )

    return {
        "message": f"Claimed {result.modified_count} video(s)",
        "claimedCount": result.modified_count
    }


# ---------------------------------------------------------------------------
# GET /api/videos/
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[VideoListItem])
async def get_user_videos(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Get all videos for the logged-in user (lightweight — no segments payload)."""
    videos = get_videos_collection()

    # Exclude the heavy segments array from the list query
    cursor = videos.find(
        {"user_id": str(current_user["_id"])},
        {"segments": 0}  # projection: omit segments
    ).sort("uploaded_at", -1).skip(skip).limit(limit)

    result = []
    async for video in cursor:
        result.append(_build_list_item(video))

    return result
