from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Optional, List
import uuid
from bson import ObjectId

from app.models.schemas import VideoResponse, VideoUpload
from app.database.connection import get_videos_collection, get_history_collection
from app.api.auth import get_current_user, get_optional_user


router = APIRouter()


@router.post("/upload", response_model=VideoUpload)
async def upload_video(
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Submit a video link for analysis. Works for both logged in and anonymous users."""
    
    # Basic URL validation
    if not video_data.videoUrl.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")
    
    # Create video document
    is_anonymous = current_user is None
    session_token = str(uuid.uuid4()) if is_anonymous else None
    title = video_data.title or video_data.videoUrl.rsplit("/", 1)[-1]
    
    video_doc = {
        "userId": str(current_user["_id"]) if current_user else None,
        "sessionToken": session_token,
        "videoUrl": video_data.videoUrl,
        "title": title,
        "durationSeconds": None,
        "uploadedAt": datetime.utcnow(),
        "isAnonymous": is_anonymous,
        "isClaimed": False,
        "analysisResult_isLieDetected": None,
        "analysisResult_confidenceScore": None,
        "analysisResult_status": "pending",
        "analysisResult_analyzedAt": None
    }
    
    videos = get_videos_collection()
    result = await videos.insert_one(video_doc)
    
    return VideoUpload(
        id=str(result.inserted_id),
        videoUrl=video_data.videoUrl,
        title=title,
        uploadedAt=video_doc["uploadedAt"],
        isAnonymous=is_anonymous,
        sessionToken=session_token
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Get video details by ID"""
    videos = get_videos_collection()
    
    try:
        video = await videos.find_one({"_id": ObjectId(video_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid video ID")
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Build analysis result if exists
    analysis_result = None
    if video.get("analysisResult_status") and video["analysisResult_status"] != "pending":
        analysis_result = {
            "isLieDetected": video.get("analysisResult_isLieDetected"),
            "confidenceScore": video.get("analysisResult_confidenceScore"),
            "status": video.get("analysisResult_status"),
            "analyzedAt": video.get("analysisResult_analyzedAt")
        }
    
    # Log view in history if user is logged in
    if current_user:
        history = get_history_collection()
        await history.insert_one({
            "userId": str(current_user["_id"]),
            "videoId": video_id,
            "viewedAt": datetime.utcnow()
        })
    
    return VideoResponse(
        id=str(video["_id"]),
        userId=video.get("userId"),
        videoUrl=video["videoUrl"],
        title=video.get("title"),
        durationSeconds=video.get("durationSeconds"),
        uploadedAt=video["uploadedAt"],
        isAnonymous=video["isAnonymous"],
        isClaimed=video.get("isClaimed", False),
        analysisResult=analysis_result
    )


@router.post("/{video_id}/analyze")
async def trigger_analysis(
    video_id: str,
):
    """Trigger lie detection analysis on a video.
    
    Note: Direct background analysis via this endpoint is not yet wired to the
    new AI pipeline. Use POST /api/ai/analyze-video to run inference directly.
    """
    raise HTTPException(
        status_code=501,
        detail="Direct background analysis is not implemented. Use POST /api/ai/analyze-video instead."
    )


@router.post("/claim")
async def claim_anonymous_videos(
    session_token: str,
    current_user: dict = Depends(get_current_user)
):
    """Claim anonymous videos after login using session token"""
    videos = get_videos_collection()
    
    result = await videos.update_many(
        {"sessionToken": session_token, "isAnonymous": True},
        {"$set": {
            "userId": str(current_user["_id"]),
            "isAnonymous": False,
            "isClaimed": True,
            "sessionToken": None
        }}
    )
    
    return {
        "message": f"Claimed {result.modified_count} video(s)",
        "claimedCount": result.modified_count
    }


@router.get("/", response_model=List[VideoResponse])
async def get_user_videos(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Get all videos for logged in user"""
    videos = get_videos_collection()
    
    cursor = videos.find({"userId": str(current_user["_id"])}).sort("uploadedAt", -1).skip(skip).limit(limit)
    
    result = []
    async for video in cursor:
        analysis_result = None
        if video.get("analysisResult_status") and video["analysisResult_status"] != "pending":
            analysis_result = {
                "isLieDetected": video.get("analysisResult_isLieDetected"),
                "confidenceScore": video.get("analysisResult_confidenceScore"),
                "status": video.get("analysisResult_status"),
                "analyzedAt": video.get("analysisResult_analyzedAt")
            }
        
        result.append(VideoResponse(
            id=str(video["_id"]),
            userId=video.get("userId"),
            videoUrl=video["videoUrl"],
            title=video.get("title"),
            durationSeconds=video.get("durationSeconds"),
            uploadedAt=video["uploadedAt"],
            isAnonymous=video["isAnonymous"],
            isClaimed=video.get("isClaimed", False),
            analysisResult=analysis_result
        ))
    
    return result

