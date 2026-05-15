from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import timedelta
from bson import ObjectId

UTC7 = timedelta(hours=7)

from app.models.schemas import HistoryLog
from app.database.connection import get_history_collection
from app.api.auth import get_current_user, get_current_user_id

router = APIRouter()


@router.get("/", response_model=List[HistoryLog])
async def get_history(
    user_id: str = Depends(get_current_user_id),
    skip: int = 0,
    limit: int = 50
):
    """Get video view history for logged in user, enriched with video metadata."""
    history_col = get_history_collection()

    pipeline = [
        {"$match": {"userId": user_id}},
        {"$sort": {"viewedAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$addFields": {"videoObjId": {"$toObjectId": "$videoId"}}},
        {"$lookup": {
            "from": "videos",
            "localField": "videoObjId",
            "foreignField": "_id",
            "as": "vid",
            "pipeline": [{"$project": {"video": 1, "video_url": 1, "thumbnail_url": 1}}],
        }},
        {"$unwind": {"path": "$vid", "preserveNullAndEmptyArrays": True}},
    ]

    result = []
    async for doc in history_col.aggregate(pipeline):
        vid = doc.get("vid") or {}
        result.append(HistoryLog(
            id=str(doc["_id"]),
            userId=doc["userId"],
            videoId=doc["videoId"],
            viewedAt=doc["viewedAt"] + UTC7,
            video=vid.get("video"),
            video_url=vid.get("video_url"),
            thumbnail_url=vid.get("thumbnail_url"),
        ))

    return result


@router.delete("/clear")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear all history for logged in user."""
    history = get_history_collection()
    result = await history.delete_many({"userId": str(current_user["_id"])})
    return {"message": f"Deleted {result.deleted_count} history entries"}


@router.delete("/{history_id}")
async def delete_history_entry(
    history_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a single history entry. Must be the owner."""
    if not ObjectId.is_valid(history_id):
        raise HTTPException(status_code=400, detail=f"Invalid history ID: '{history_id}'")

    history = get_history_collection()
    entry = await history.find_one({"_id": ObjectId(history_id)})

    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")
    if entry.get("userId") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to delete this entry")

    await history.delete_one({"_id": ObjectId(history_id)})
    return {"message": "History entry deleted"}
