from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import Optional, List
import uuid
from bson import ObjectId
import io

from app.models.schemas import VideoResponse, VideoUpload
from app.database.connection import get_videos_collection, get_gridfs, get_history_collection
from app.api.auth import get_current_user, get_optional_user
from app.ai.analyzer import analyze_video

router = APIRouter()

ALLOWED_EXTENSIONS = {"mp4", "avi", "mov", "webm", "mkv"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def get_file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


@router.post("/upload", response_model=VideoUpload)
async def upload_video(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Upload a video for analysis. Works for both logged in and anonymous users."""
    
    # Validate file extension
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size: 100MB")
    
    # Store in GridFS
    gridfs = get_gridfs()
    file_id = await gridfs.upload_from_stream(
        file.filename,
        io.BytesIO(content),
        metadata={"content_type": file.content_type}
    )
    
    # Create video document
    is_anonymous = current_user is None
    session_token = str(uuid.uuid4()) if is_anonymous else None
    
    video_doc = {
        "userId": str(current_user["_id"]) if current_user else None,
        "sessionToken": session_token,
        "filePath": str(file_id),  # GridFS file ID
        "originalFilename": file.filename,
        "durationSeconds": None,  # Will be updated after analysis
        "fileSize": file_size,
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
        originalFilename=file.filename,
        fileSize=file_size,
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
        originalFilename=video["originalFilename"],
        durationSeconds=video.get("durationSeconds"),
        fileSize=video["fileSize"],
        uploadedAt=video["uploadedAt"],
        isAnonymous=video["isAnonymous"],
        isClaimed=video.get("isClaimed", False),
        analysisResult=analysis_result
    )


@router.get("/{video_id}/stream")
async def stream_video(video_id: str):
    """Stream video file"""
    videos = get_videos_collection()
    
    try:
        video = await videos.find_one({"_id": ObjectId(video_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid video ID")
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    gridfs = get_gridfs()
    
    try:
        grid_out = await gridfs.open_download_stream(ObjectId(video["filePath"]))
        
        async def stream_generator():
            while True:
                chunk = await grid_out.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                yield chunk
        
        return StreamingResponse(
            stream_generator(),
            media_type="video/mp4",
            headers={"Content-Disposition": f"inline; filename={video['originalFilename']}"}
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="Video file not found")


@router.post("/{video_id}/analyze")
async def trigger_analysis(
    video_id: str,
    background_tasks: BackgroundTasks
):
    """Trigger lie detection analysis on a video"""
    videos = get_videos_collection()
    
    try:
        video = await videos.find_one({"_id": ObjectId(video_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid video ID")
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video.get("analysisResult_status") == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")
    
    # Update status to processing
    await videos.update_one(
        {"_id": ObjectId(video_id)},
        {"$set": {"analysisResult_status": "processing"}}
    )
    
    # Run analysis in background
    background_tasks.add_task(analyze_video, video_id)
    
    return {"message": "Analysis started", "videoId": video_id, "status": "processing"}


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
            originalFilename=video["originalFilename"],
            durationSeconds=video.get("durationSeconds"),
            fileSize=video["fileSize"],
            uploadedAt=video["uploadedAt"],
            isAnonymous=video["isAnonymous"],
            isClaimed=video.get("isClaimed", False),
            analysisResult=analysis_result
        ))
    
    return result
