from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    """Custom ObjectId type for Pydantic"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str) and ObjectId.is_valid(v):
            return v
        raise ValueError("Invalid ObjectId")


# ============ USER MODELS ============

class UserCreate(BaseModel):
    """For user registration"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    """For user login"""
    email: EmailStr
    password: str


class GoogleAuth(BaseModel):
    """For Google OAuth"""
    credential: str  # Google ID token


class UserResponse(BaseModel):
    """User data returned to client"""
    id: str
    username: str
    email: str
    authProvider: str
    avatarUrl: Optional[str] = None
    createdAt: datetime


class UserInDB(BaseModel):
    """User as stored in database"""
    username: str
    email: str
    passwordHash: Optional[str] = None
    googleId: Optional[str] = None
    authProvider: str  # "local" or "google"
    avatarUrl: Optional[str] = None
    createdAt: datetime
    lastLogin: Optional[datetime] = None


# ============ VIDEO MODELS ============

class VideoLinkSubmit(BaseModel):
    """For submitting a video URL"""
    video_url: str
    video: Optional[str] = None           # display name / filename
    thumbnail_url: Optional[str] = None


class VideoUpload(BaseModel):
    """Returned immediately after upload (before analysis runs)"""
    id: str
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    analysis_status: str = "pending"
    is_anonymous: bool
    session_token: Optional[str] = None


class SegmentResult(BaseModel):
    """Analysis result for one time-segment of the video"""
    timestamp: str                              # e.g. "00:00:00–00:00:05"
    face_confidence_score: float               # 0.0–1.0, from hand-to-face signal
    face_verdict: Literal["TRUTH", "LIE"]
    arms_confidence_score: float               # 0.0–1.0, from arm movement signal
    arms_verdict: Literal["TRUTH", "LIE"]
    average_confidence_score_segment: float    # avg of face + arms scores
    verdict: Literal["TRUTH", "LIE"]           # driven by whichever score is higher
    parts_indicate: Literal["face", "arms"]    # which part drove the verdict
    average_based_verdict: Literal["TRUTH", "LIE"]  # verdict from average score
    face_image_b64: str                        # base64-encoded JPEG of representative frame


class VideoSummary(BaseModel):
    """Aggregated summary across all segments"""
    average_confidence_score: float            # mean confidence across all segments
    final_verdict: Literal["TRUTH", "LIE"]    # LIE if avg >= 0.60
    total_segments_analyzed: int


class VideoResponse(BaseModel):
    """Full video document returned to the client"""
    id: str
    user_id: Optional[str] = None
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    video_duration: Optional[str] = None       # "HH:MM:SS"
    segments: List[SegmentResult] = []
    summary: Optional[VideoSummary] = None
    analysis_status: str = "pending"           # pending / processing / completed / failed


class VideoListItem(BaseModel):
    """Lightweight video entry for list views (no segments payload)"""
    id: str
    user_id: Optional[str] = None
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    video_duration: Optional[str] = None
    summary: Optional[VideoSummary] = None
    analysis_status: str = "pending"


class VideoInDB(BaseModel):
    """Video document shape as stored in MongoDB"""
    user_id: Optional[str] = None
    session_token: Optional[str] = None
    video: str                                 # display name / filename
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    video_duration: Optional[str] = None       # "HH:MM:SS"
    is_anonymous: bool
    is_claimed: bool = False
    segments: List[dict] = []
    summary: Optional[dict] = None
    analysis_status: str = "pending"           # pending / processing / completed / failed


# ============ HISTORY MODELS ============

class HistoryLog(BaseModel):
    """History log entry — includes video metadata for display"""
    id: str
    userId: str
    videoId: str
    viewedAt: datetime
    # Video metadata (populated from videos collection on read)
    video: str        # display name / filename
    video_url: str
    thumbnail_url: str


class HistoryLogCreate(BaseModel):
    """For creating history log"""
    videoId: str


# ============ AUTH TOKENS ============

class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Data encoded in JWT"""
    user_id: str
    email: str
