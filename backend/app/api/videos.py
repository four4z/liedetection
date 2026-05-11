from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
from typing import Optional, List, Literal
import asyncio
import json
import uuid
from bson import ObjectId

from app.models.schemas import (
    VideoResponse, VideoListItem, VideoUpload, VideoLinkSubmit,
    SegmentResult, VideoSummary, VideoRename, ClaimRequest,
    PaginatedVideos, VideoStatus
)
from app.database.connection import get_videos_collection, get_history_collection
from app.api.auth import get_current_user, get_current_user_id, get_optional_user
from app.ai.analyzer import analyze_video

router = APIRouter()

ANONYMOUS_VIDEO_TTL_DAYS = 7


def _build_video_response(video: dict) -> VideoResponse:
    segments = [SegmentResult(**seg) for seg in video.get("segments", [])]
    summary = VideoSummary(**video["summary"]) if video.get("summary") else None
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
        analysis_error=video.get("analysis_error"),
    )


def _build_list_item(video: dict) -> VideoListItem:
    summary = VideoSummary(**video["summary"]) if video.get("summary") else None
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
        analysis_error=video.get("analysis_error"),
    )


def _require_valid_id(video_id: str) -> None:
    if not ObjectId.is_valid(video_id):
        raise HTTPException(status_code=400, detail=f"Invalid video ID: '{video_id}'")


async def _run_analysis(video_id: str) -> None:
    """Wrapper that catches unhandled errors from analyze_video and stores the reason."""
    try:
        await analyze_video(video_id)
    except Exception as e:
        videos = get_videos_collection()
        await videos.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {"analysis_status": "failed", "analysis_error": str(e)}}
        )


# ---------------------------------------------------------------------------
# GET /api/videos/
# ---------------------------------------------------------------------------

@router.get("/", response_model=PaginatedVideos)
async def get_user_videos(
    user_id: str = Depends(get_current_user_id),
    skip: int = 0,
    limit: int = 20,
    status: Optional[Literal["pending", "processing", "completed", "failed"]] = None,
    search: Optional[str] = None,
):
    """Paginated video list. Filter by ?status= and/or search by ?search= (video name)."""
    videos = get_videos_collection()

    query: dict = {"user_id": user_id}
    if status:
        query["analysis_status"] = status
    if search:
        query["video"] = {"$regex": search, "$options": "i"}

    total = await videos.count_documents(query)
    cursor = videos.find(query, {"segments": 0}).sort("uploaded_at", -1).skip(skip).limit(limit)
    items = [_build_list_item(v) async for v in cursor]

    return PaginatedVideos(items=items, total=total, skip=skip, limit=limit, has_more=(skip + limit) < total)


# ---------------------------------------------------------------------------
# POST /api/videos/upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=VideoUpload)
async def upload_video(
    video_data: VideoLinkSubmit,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Submit a video link for analysis. Works for both logged-in and anonymous users."""
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
        "analysis_error": None,
    }

    if is_anonymous:
        video_doc["expireAt"] = datetime.utcnow() + timedelta(days=ANONYMOUS_VIDEO_TTL_DAYS)

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
# POST /api/videos/claim
# ---------------------------------------------------------------------------

@router.post("/claim")
async def claim_anonymous_videos(body: ClaimRequest, current_user: dict = Depends(get_current_user)):
    """Claim anonymous videos after login using session token."""
    videos = get_videos_collection()

    result = await videos.update_many(
        {"session_token": body.session_token, "is_anonymous": True},
        {
            "$set": {
                "user_id": str(current_user["_id"]),
                "is_anonymous": False,
                "is_claimed": True,
                "session_token": None,
            },
            "$unset": {"expireAt": ""}
        }
    )
    return {"message": f"Claimed {result.modified_count} video(s)", "claimedCount": result.modified_count}


# ---------------------------------------------------------------------------
# PATCH /api/videos/{video_id}/rename
# ---------------------------------------------------------------------------

@router.patch("/{video_id}/rename", response_model=VideoListItem)
async def rename_video(video_id: str, body: VideoRename, current_user: dict = Depends(get_current_user)):
    """Rename a video's display name. Must be the owner."""
    _require_valid_id(video_id)
    videos = get_videos_collection()

    video = await videos.find_one({"_id": ObjectId(video_id)}, {"segments": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.get("user_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to rename this video")

    await videos.update_one({"_id": ObjectId(video_id)}, {"$set": {"video": body.video}})
    video["video"] = body.video
    return _build_list_item(video)


# ---------------------------------------------------------------------------
# DELETE /api/videos/{video_id}
# ---------------------------------------------------------------------------

@router.delete("/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a video and its history entries. Must be the owner."""
    _require_valid_id(video_id)
    videos = get_videos_collection()

    video = await videos.find_one({"_id": ObjectId(video_id)}, {"user_id": 1})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.get("user_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")

    await videos.delete_one({"_id": ObjectId(video_id)})
    history = get_history_collection()
    await history.delete_many({"videoId": video_id})

    return {"message": "Video deleted"}


# ---------------------------------------------------------------------------
# GET /api/videos/{video_id}/status  — lightweight polling
# ---------------------------------------------------------------------------

@router.get("/{video_id}/status", response_model=VideoStatus)
async def get_video_status(video_id: str):
    """Return only analysis_status, summary, and error. Cheap to poll."""
    _require_valid_id(video_id)
    videos = get_videos_collection()

    video = await videos.find_one(
        {"_id": ObjectId(video_id)},
        {"analysis_status": 1, "summary": 1, "analysis_error": 1}
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    summary = VideoSummary(**video["summary"]) if video.get("summary") else None
    return VideoStatus(
        id=video_id,
        analysis_status=video.get("analysis_status", "pending"),
        summary=summary,
        analysis_error=video.get("analysis_error"),
    )


# ---------------------------------------------------------------------------
# GET /api/videos/{video_id}/stream  — SSE real-time status
# ---------------------------------------------------------------------------

@router.get("/{video_id}/stream")
async def stream_video_status(video_id: str):
    """
    Server-Sent Events stream — pushes status updates until analysis completes or fails.
    Frontend usage: const es = new EventSource('/api/videos/{id}/stream')
    """
    _require_valid_id(video_id)

    async def event_generator():
        videos = get_videos_collection()
        while True:
            video = await videos.find_one(
                {"_id": ObjectId(video_id)},
                {"analysis_status": 1, "summary": 1, "analysis_error": 1}
            )
            if not video:
                yield f"event: error\ndata: {json.dumps({'detail': 'Video not found'})}\n\n"
                break

            status = video.get("analysis_status", "pending")
            payload = json.dumps({
                "analysis_status": status,
                "summary": video.get("summary"),
                "analysis_error": video.get("analysis_error"),
            })
            yield f"data: {payload}\n\n"

            if status in ("completed", "failed"):
                break

            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# GET /api/videos/{video_id}
# ---------------------------------------------------------------------------

@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Get full video details. User-owned videos require the owner to be logged in."""
    _require_valid_id(video_id)
    videos = get_videos_collection()

    video = await videos.find_one({"_id": ObjectId(video_id)})
    if not video:
        raise HTTPException(status_code=404, detail=f"Video not found for id: {video_id}")

    # Access control: user-owned videos are private
    owner_id = video.get("user_id")
    if owner_id:
        if not current_user or str(current_user["_id"]) != owner_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this video")

    if current_user:
        history = get_history_collection()
        await history.update_one(
            {"userId": str(current_user["_id"]), "videoId": video_id},
            {
                "$set": {"viewedAt": datetime.utcnow()},
                "$setOnInsert": {"userId": str(current_user["_id"]), "videoId": video_id},
            },
            upsert=True,
        )

    return _build_video_response(video)


# ---------------------------------------------------------------------------
# POST /api/videos/{video_id}/analyze
# ---------------------------------------------------------------------------

@router.post("/{video_id}/analyze")
async def trigger_analysis(
    video_id: str,
    background_tasks: BackgroundTasks,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Trigger lie detection analysis on a video."""
    _require_valid_id(video_id)
    videos = get_videos_collection()

    video = await videos.find_one({"_id": ObjectId(video_id)})
    if not video:
        raise HTTPException(status_code=404, detail=f"Video not found for id: {video_id}")

    owner_id = video.get("user_id")
    if owner_id:
        if not current_user or owner_id != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Not authorized to analyze this video")

    if video.get("analysis_status") == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")

    await videos.update_one(
        {"_id": ObjectId(video_id)},
        {"$set": {"analysis_status": "processing", "analysis_error": None}}
    )
    background_tasks.add_task(_run_analysis, video_id)

    return {"message": "Analysis started", "videoId": video_id, "status": "processing"}
