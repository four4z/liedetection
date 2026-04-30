from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, videos, history
from app.database.connection import connect_to_mongo, close_mongo_connection

app = FastAPI(
    title="Lie Detection API",
    description="API for lie detection through video analysis",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        # "https://86cz9rff-3000.asse.devtunnels.ms",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup and shutdown events
@app.on_event("startup")
async def startup():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
app.include_router(history.router, prefix="/api/history", tags=["History"])

@app.get("/")
async def root():
    return {"message": "Lie Detection API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
