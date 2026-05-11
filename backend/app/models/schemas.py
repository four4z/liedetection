from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
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
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)  # consistent with reset password


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuth(BaseModel):
    credential: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    authProvider: str
    avatarUrl: Optional[str] = None
    createdAt: datetime


class UserInDB(BaseModel):
    username: str
    email: str
    passwordHash: Optional[str] = None
    googleId: Optional[str] = None
    authProvider: str
    avatarUrl: Optional[str] = None
    createdAt: datetime
    lastLogin: Optional[datetime] = None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    avatarUrl: Optional[str] = None


# ============ AUTH REQUEST BODIES ============

class ForgetPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str


# ============ VIDEO MODELS ============

class VideoLinkSubmit(BaseModel):
    video_url: str
    video: Optional[str] = None
    thumbnail_url: Optional[str] = None


class VideoUpload(BaseModel):
    id: str
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    analysis_status: str = "pending"
    is_anonymous: bool
    session_token: Optional[str] = None


class VideoRename(BaseModel):
    video: str = Field(..., min_length=1, max_length=200)


class ClaimRequest(BaseModel):
    session_token: str


class VideoStatus(BaseModel):
    """Lightweight status-only response for polling."""
    id: str
    analysis_status: str
    summary: Optional["VideoSummary"] = None
    analysis_error: Optional[str] = None


class SegmentResult(BaseModel):
    timestamp: str
    face_confidence_score: float
    face_verdict: Literal["TRUTH", "LIE"]
    arms_confidence_score: float
    arms_verdict: Literal["TRUTH", "LIE"]
    average_confidence_score_segment: float
    verdict: Literal["TRUTH", "LIE"]
    parts_indicate: Literal["face", "arms"]
    average_based_verdict: Literal["TRUTH", "LIE"]
    face_image_b64: Optional[str] = None


class VideoSummary(BaseModel):
    average_confidence_score: float
    final_verdict: Literal["TRUTH", "LIE"]
    total_segments_analyzed: int


class VideoResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    video_duration: Optional[str] = None
    segments: List[SegmentResult] = []
    summary: Optional[VideoSummary] = None
    analysis_status: str = "pending"
    analysis_error: Optional[str] = None


class VideoListItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    video_duration: Optional[str] = None
    summary: Optional[VideoSummary] = None
    analysis_status: str = "pending"
    analysis_error: Optional[str] = None


class PaginatedVideos(BaseModel):
    items: List[VideoListItem]
    total: int
    skip: int
    limit: int
    has_more: bool


class VideoInDB(BaseModel):
    user_id: Optional[str] = None
    session_token: Optional[str] = None
    video: str
    video_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    video_duration: Optional[str] = None
    is_anonymous: bool
    is_claimed: bool = False
    segments: List[dict] = []
    summary: Optional[dict] = None
    analysis_status: str = "pending"
    analysis_error: Optional[str] = None


# ============ HISTORY MODELS ============

class HistoryLog(BaseModel):
    id: str
    userId: str
    videoId: str
    viewedAt: datetime
    video: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class HistoryLogCreate(BaseModel):
    videoId: str


# ============ AUTH TOKENS ============

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: str
    email: str


VideoStatus.model_rebuild()
