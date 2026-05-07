from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional
import os
import random
import string
import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.models.schemas import (
    UserCreate, UserLogin, UserResponse, GoogleAuth, Token, TokenData
)
from app.database.connection import get_users_collection

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# OTP settings
OTP_EXPIRE_MINUTES = 10

# Mail settings
mail_conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", ""),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return current user"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    users = get_users_collection()
    user = await users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[dict]:
    """Get user if token provided, otherwise return None (for anonymous access)"""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def user_to_response(user: dict) -> UserResponse:
    """Convert DB user to response model"""
    return UserResponse(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        authProvider=user["authProvider"],
        avatarUrl=user.get("avatarUrl"),
        createdAt=user["createdAt"]
    )


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user with email/password"""
    users = get_users_collection()
    
    # Check if email already exists
    existing = await users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    existing = await users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    new_user = {
        "username": user_data.username,
        "email": user_data.email,
        "passwordHash": get_password_hash(user_data.password),
        "googleId": None,
        "authProvider": "local",
        "avatarUrl": None,
        "createdAt": datetime.utcnow(),
        "lastLogin": datetime.utcnow()
    }
    
    result = await users.insert_one(new_user)
    
    # Create token
    access_token = create_access_token({
        "user_id": str(result.inserted_id),
        "email": user_data.email
    })
    
    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    """Login with email/password"""
    users = get_users_collection()
    
    user = await users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get("authProvider") != "local":
        raise HTTPException(status_code=400, detail="Please login with Google")
    
    if not verify_password(login_data.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update last login
    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastLogin": datetime.utcnow()}}
    )
    
    access_token = create_access_token({
        "user_id": str(user["_id"]),
        "email": user["email"]
    })
    
    return Token(access_token=access_token)


@router.post("/google", response_model=Token)
async def google_auth(auth_data: GoogleAuth):
    """Login/Register with Google OAuth"""
    # Verify Google token
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.credential}"
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            
            google_data = response.json()
    except Exception:
        raise HTTPException(status_code=401, detail="Failed to verify Google token")
    
    users = get_users_collection()
    email = google_data.get("email")
    google_id = google_data.get("sub")
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture")
    
    # Check if user exists
    user = await users.find_one({"$or": [{"email": email}, {"googleId": google_id}]})
    
    if user:
        # Update last login and Google info
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "lastLogin": datetime.utcnow(),
                "googleId": google_id,
                "avatarUrl": picture
            }}
        )
    else:
        # Create new user
        new_user = {
            "username": name,
            "email": email,
            "passwordHash": None,
            "googleId": google_id,
            "authProvider": "google",
            "avatarUrl": picture,
            "createdAt": datetime.utcnow(),
            "lastLogin": datetime.utcnow()
        }
        result = await users.insert_one(new_user)
        user = await users.find_one({"_id": result.inserted_id})
    
    access_token = create_access_token({
        "user_id": str(user["_id"]),
        "email": user["email"]
    })
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current logged in user"""
    return user_to_response(current_user)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout current user. Frontend should delete the stored token."""
    return {"message": "Logged out successfully"}


@router.post("/forgotpassword")
async def forgot_password(email: str):
    """Send OTP to email for password reset"""
    users = get_users_collection()
    user = await users.find_one({"email": email})

    # Always return same message to prevent email enumeration
    if not user:
        return {"message": "If that email is registered, an OTP has been sent."}

    if user.get("authProvider") != "local":
        raise HTTPException(status_code=400, detail="This account uses Google login. No password to reset.")

    otp = generate_otp()
    otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)

    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "resetOtp": get_password_hash(otp),
            "resetOtpExpiry": otp_expiry
        }}
    )

    message = MessageSchema(
        subject="Your Password Reset OTP",
        recipients=[email],
        body=f"<h2>Your OTP is: <strong>{otp}</strong></h2><p>Expires in {OTP_EXPIRE_MINUTES} minutes.</p>",
        subtype="html"
    )
    fm = FastMail(mail_conf)
    await fm.send_message(message)

    return {"message": "If that email is registered, an OTP has been sent."}


@router.post("/verifyotp")
async def verify_otp(email: str, otp: str):
    """Verify OTP and return a short-lived reset token"""
    users = get_users_collection()
    user = await users.find_one({"email": email})

    if not user or not user.get("resetOtp") or not user.get("resetOtpExpiry"):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if datetime.utcnow() > user["resetOtpExpiry"]:
        raise HTTPException(status_code=400, detail="OTP has expired")

    if not verify_password(otp, user["resetOtp"]):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Clear OTP after successful verification (one-time use)
    await users.update_one(
        {"_id": user["_id"]},
        {"$unset": {"resetOtp": "", "resetOtpExpiry": ""}}
    )

    reset_token = jwt.encode(
        {
            "user_id": str(user["_id"]),
            "email": user["email"],
            "purpose": "password_reset",
            "exp": datetime.utcnow() + timedelta(minutes=15)
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {"reset_token": reset_token}


@router.post("/resetpassword")
async def reset_password(reset_token: str, new_password: str, confirm_password: str):
    """Reset password using the token from verifyotp"""
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    try:
        payload = jwt.decode(reset_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"passwordHash": get_password_hash(new_password)}}
    )

    return {"message": "Password reset successfully"}