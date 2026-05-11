import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, videos, history
from app.database.connection import connect_to_mongo, close_mongo_connection, get_videos_collection

app = FastAPI(
    title="Lie Detection API",
    description="API for lie detection through video analysis",
    version="1.0.0"
)

# ---------------------------------------------------------------------------
# CORS
# Local dev  → no env var needed, defaults to * (allow all)
# Vercel/prod → set ALLOWED_ORIGINS=https://yourapp.vercel.app on backend server
# Multiple   → ALLOWED_ORIGINS=https://yourapp.vercel.app,http://localhost:5173
# ---------------------------------------------------------------------------
_raw = os.getenv("ALLOWED_ORIGINS", "*")
if _raw == "*":
    allowed_origins = ["*"]
    allow_credentials = False
else:
    allowed_origins = [o.strip() for o in _raw.split(",")]
    allow_credentials = False  # using JWT Bearer — no cookies needed

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await connect_to_mongo()

    # Reset videos that were stuck in "processing" when the server last crashed/restarted
    videos_col = get_videos_collection()
    stuck = await videos_col.update_many(
        {"analysis_status": "processing"},
        {"$set": {
            "analysis_status": "failed",
            "analysis_error": "Server restarted during analysis — please re-run."
        }}
    )
    if stuck.modified_count:
        print(f"[startup] Reset {stuck.modified_count} stuck video(s) from 'processing' to 'failed'")


@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()


app.include_router(auth.router,    prefix="/api/auth",    tags=["Authentication"])
app.include_router(videos.router,  prefix="/api/videos",  tags=["Videos"])
app.include_router(history.router, prefix="/api/history", tags=["History"])


@app.get("/")
async def root():
    return {"message": "Lie Detection API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
