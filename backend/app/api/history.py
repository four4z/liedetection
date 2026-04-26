from fastapi import APIRouter, Depends
from typing import List
from bson import ObjectId

from app.models.schemas import HistoryLog
from app.database.connection import get_history_collection, get_videos_collection
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[HistoryLog])
async def get_history(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    """Get video view history for logged in user, enriched with video metadata."""
    history_col = get_history_collection()
    videos_col = get_videos_collection()

    cursor = history_col.find(
        {"userId": str(current_user["_id"])}
    ).sort("viewedAt", -1).skip(skip).limit(limit)

    logs = []
    async for log in cursor:
        logs.append(log)

    if not logs:
        return []

    # Bulk-fetch all referenced videos in one query (avoids N+1)
    video_ids = []
    for log in logs:
        vid = log.get("videoId", "")
        if ObjectId.is_valid(vid):
            video_ids.append(ObjectId(vid))

    video_map: dict = {}
    if video_ids:
        async for video in videos_col.find(
            {"_id": {"$in": video_ids}},
            {"video": 1, "video_url": 1, "thumbnail_url": 1}  # only fetch what we need
        ):
            video_map[str(video["_id"])] = video

    result = []
    for log in logs:
        vid_data = video_map.get(log.get("videoId", ""), {})
        result.append(HistoryLog(
            id=str(log["_id"]),
            userId=log["userId"],
            videoId=log["videoId"],
            viewedAt=log["viewedAt"],
            video=vid_data.get("video"),
            video_url=vid_data.get("video_url"),
            thumbnail_url=vid_data.get("thumbnail_url"),
        ))

    return result


@router.delete("/clear")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear all history for logged in user"""
    history = get_history_collection()
    
    result = await history.delete_many({"userId": str(current_user["_id"])})
    
    return {"message": f"Deleted {result.deleted_count} history entries"}


@router.get("/debug/{video_id}")
async def debug_video_lookup(
    video_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Debug: check what fields the videos collection returns for a given video_id."""
    from bson import ObjectId

    videos_col = get_videos_collection()

    if not ObjectId.is_valid(video_id):
        return {"error": f"'{video_id}' is not a valid ObjectId"}

    video = await videos_col.find_one({"_id": ObjectId(video_id)})

    if video is None:
        return {"found": False, "video_id": video_id}

    return {
        "found": True,
        "video_id": video_id,
        "video": video.get("video"),
        "video_url": video.get("video_url"),
        "thumbnail_url": video.get("thumbnail_url"),
        "analysis_status": video.get("analysis_status"),
        "all_keys": list(video.keys()),
    }
