from pydantic import BaseModel, EmailStr, Field
from typing import Optional
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

class VideoUpload(BaseModel):
    """Video metadata after upload"""
    id: str
    originalFilename: str
    fileSize: int
    uploadedAt: datetime
    isAnonymous: bool
    sessionToken: Optional[str] = None


class AnalysisResult(BaseModel):
    """Lie detection analysis result"""
    isLieDetected: bool
    confidenceScore: float
    status: str  # "pending", "processing", "completed", "failed"
    analyzedAt: Optional[datetime] = None


class VideoResponse(BaseModel):
    """Full video info returned to client"""
    id: str
    userId: Optional[str] = None
    originalFilename: str
    durationSeconds: Optional[float] = None
    fileSize: int
    uploadedAt: datetime
    isAnonymous: bool
    isClaimed: bool = False
    analysisResult: Optional[AnalysisResult] = None


class VideoInDB(BaseModel):
    """Video as stored in database"""
    userId: Optional[str] = None
    sessionToken: Optional[str] = None
    filePath: str  # GridFS file ID
    originalFilename: str
    durationSeconds: Optional[float] = None
    fileSize: int
    uploadedAt: datetime
    isAnonymous: bool
    isClaimed: bool = False
    analysisResult_isLieDetected: Optional[bool] = None
    analysisResult_confidenceScore: Optional[float] = None
    analysisResult_status: str = "pending"
    analysisResult_analyzedAt: Optional[datetime] = None


# ============ HISTORY MODELS ============

class HistoryLog(BaseModel):
    """History log entry"""
    id: str
    userId: str
    videoId: str
    viewedAt: datetime


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
