import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

class Database:
    client: AsyncIOMotorClient = None
    db = None
    gridfs: AsyncIOMotorGridFSBucket = None

database = Database()

async def connect_to_mongo():
    username = os.getenv("MONGO_USERNAME")
    password = os.getenv("MONGO_PASSWORD")
    host = os.getenv("MONGO_HOST", "localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "liedetection")

    if username and password:
        mongo_url = f"mongodb+srv://{username}:{password}@{host}/"
    else:
        mongo_url = f"mongodb://{host}/"

    database.client = AsyncIOMotorClient(
        mongo_url,
        maxPoolSize=20,
        minPoolSize=2,
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
    )
    database.db = database.client[db_name]
    database.gridfs = AsyncIOMotorGridFSBucket(database.db)

    # Query indexes
    await database.db["users"].create_index("email", unique=True, background=True)
    await database.db["users"].create_index("username", unique=True, background=True)
    await database.db["videos"].create_index("user_id", background=True)
    await database.db["videos"].create_index(
        [("user_id", 1), ("uploaded_at", -1)], background=True
    )
    await database.db["history_logs"].create_index("userId", background=True)
    await database.db["history_logs"].create_index(
        [("userId", 1), ("viewedAt", -1)], background=True
    )
    await database.db["history_logs"].create_index(
        [("userId", 1), ("videoId", 1)], background=True
    )
    # TTL index — MongoDB auto-deletes anonymous videos after expireAt passes
    await database.db["videos"].create_index(
        "expireAt", expireAfterSeconds=0, background=True, sparse=True
    )

    print(f"Connected to MongoDB: {db_name}")

async def close_mongo_connection():
    if database.client:
        database.client.close()
        print("MongoDB connection closed")

def get_database():
    return database.db

def get_gridfs():
    return database.gridfs

def get_users_collection():
    return database.db["users"]

def get_videos_collection():
    return database.db["videos"]

def get_history_collection():
    return database.db["history_logs"]
