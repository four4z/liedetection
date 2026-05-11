from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict
from functools import partial
import asyncio
import os
import random
import string
import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.models.schemas import (
    UserCreate, UserLogin, UserResponse, GoogleAuth, Token, TokenData,
    UserUpdate, ForgetPasswordRequest, VerifyOTPRequest, ResetPasswordRequest
)
from app.database.connection import get_users_collection

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
OTP_EXPIRE_MINUTES = 10
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Simple in-memory rate limiter (resets on restart)
_rate_buckets: dict = defaultdict(list)

def _check_rate_limit(key: str, max_attempts: int = 5, window_minutes: int = 15) -> None:
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=window_minutes)
    recent = [t for t in _rate_buckets[key] if t > cutoff]
    _rate_buckets[key] = recent
    if len(recent) >= max_attempts:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    _rate_buckets[key].append(now)


def get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
        MAIL_FROM=os.getenv("MAIL_FROM"),
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


def _verify_google_token_sync(credential: str) -> dict:
    """Runs synchronously — call via run_in_executor to avoid blocking the event loop."""
    return google_id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        GOOGLE_CLIENT_ID
    )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT and return full user document. Use when user fields are needed."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
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


async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Decode JWT and return user_id string. No DB round-trip."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[dict]:
    """Return user if token provided, else None (for anonymous access)."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        authProvider=user["authProvider"],
        avatarUrl=user.get("avatarUrl"),
        createdAt=user["createdAt"]
    )


# ---------------------------------------------------------------------------
# Register / Login / Google
# ---------------------------------------------------------------------------

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    users = get_users_collection()

    if await users.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await users.find_one({"username": user_data.username}):
        raise HTTPException(status_code=400, detail="Username already taken")

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
    access_token = create_access_token({"user_id": str(result.inserted_id), "email": user_data.email})
    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    _check_rate_limit(f"login:{login_data.email}")

    users = get_users_collection()
    user = await users.find_one({"email": login_data.email})
    if not user or user.get("authProvider") != "local":
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(login_data.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": datetime.utcnow()}})
    access_token = create_access_token({"user_id": str(user["_id"]), "email": user["email"]})
    return Token(access_token=access_token)


@router.post("/google", response_model=Token)
async def google_auth(auth_data: GoogleAuth):
    """Login/Register with Google — verifies token locally via google-auth library."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google login not configured on server")

    try:
        loop = asyncio.get_event_loop()
        google_data = await loop.run_in_executor(
            None, partial(_verify_google_token_sync, auth_data.credential)
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    users = get_users_collection()
    email = google_data.get("email")
    google_id = google_data.get("sub")
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture")

    user = await users.find_one({"$or": [{"email": email}, {"googleId": google_id}]})

    if user:
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {"lastLogin": datetime.utcnow(), "googleId": google_id, "avatarUrl": picture}}
        )
    else:
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

    access_token = create_access_token({"user_id": str(user["_id"]), "email": user["email"]})
    return Token(access_token=access_token)


# ---------------------------------------------------------------------------
# Me / Refresh / Logout
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(body: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update username and/or avatar URL."""
    users = get_users_collection()
    updates: dict = {}

    if body.username is not None:
        if body.username != current_user["username"]:
            if await users.find_one({"username": body.username}):
                raise HTTPException(status_code=400, detail="Username already taken")
        updates["username"] = body.username

    if body.avatarUrl is not None:
        updates["avatarUrl"] = body.avatarUrl

    if not updates:
        return user_to_response(current_user)

    await users.update_one({"_id": current_user["_id"]}, {"$set": updates})
    current_user.update(updates)
    return user_to_response(current_user)


@router.post("/refresh", response_model=Token)
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Return a new token with a fresh 7-day expiry. Call this before the old token expires."""
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM],
            options={"verify_exp": False}  # allow refreshing even if just expired
        )
        user_id = payload.get("user_id")
        email = payload.get("email")
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    access_token = create_access_token({"user_id": user_id, "email": email})
    return Token(access_token=access_token)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

@router.post("/forgetpassword")
async def forget_password(body: ForgetPasswordRequest):
    _check_rate_limit(f"otp:{body.email}", max_attempts=3, window_minutes=15)

    users = get_users_collection()
    user = await users.find_one({"email": body.email})

    if not user:
        return {"message": "If that email is registered, an OTP has been sent."}
    if user.get("authProvider") != "local":
        raise HTTPException(status_code=400, detail="This account uses Google login. No password to reset.")

    otp = generate_otp()
    otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)

    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"resetOtp": get_password_hash(otp), "resetOtpExpiry": otp_expiry}}
    )

    message = MessageSchema(
        subject="Your Password Reset OTP",
        recipients=[body.email],
        body=f"<h2>Your OTP is: <strong>{otp}</strong></h2><p>Expires in {OTP_EXPIRE_MINUTES} minutes.</p>",
        subtype="html"
    )
    fm = FastMail(get_mail_config())
    await fm.send_message(message)
    return {"message": "If that email is registered, an OTP has been sent."}


@router.post("/verifyotp")
async def verify_otp(body: VerifyOTPRequest):
    _check_rate_limit(f"verifyotp:{body.email}", max_attempts=5, window_minutes=15)

    users = get_users_collection()
    user = await users.find_one({"email": body.email})

    if not user or not user.get("resetOtp") or not user.get("resetOtpExpiry"):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    if datetime.utcnow() > user["resetOtpExpiry"]:
        raise HTTPException(status_code=400, detail="OTP has expired")
    if not verify_password(body.otp, user["resetOtp"]):
        raise HTTPException(status_code=400, detail="Invalid OTP")

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
async def reset_password(body: ResetPasswordRequest):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    try:
        payload = jwt.decode(body.reset_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"passwordHash": get_password_hash(body.new_password)}}
    )
    return {"message": "Password reset successfully"}
