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
    """Get video view history for logged in user"""
    history = get_history_collection()
    
    cursor = history.find(
        {"userId": str(current_user["_id"])}
    ).sort("viewedAt", -1).skip(skip).limit(limit)
    
    result = []
    async for log in cursor:
        result.append(HistoryLog(
            id=str(log["_id"]),
            userId=log["userId"],
            videoId=log["videoId"],
            viewedAt=log["viewedAt"]
        ))
    
    return result


@router.delete("/clear")
async def clear_history(current_user: dict = Depends(get_current_user)):
    """Clear all history for logged in user"""
    history = get_history_collection()
    
    result = await history.delete_many({"userId": str(current_user["_id"])})
    
    return {"message": f"Deleted {result.deleted_count} history entries"}
