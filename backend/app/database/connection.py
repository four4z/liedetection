import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from dotenv import load_dotenv

load_dotenv()

class Database:
    client: AsyncIOMotorClient = None
    db = None
    gridfs: AsyncIOMotorGridFSBucket = None

database = Database()

async def connect_to_mongo():
    """Connect to MongoDB"""
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "liedetection")
    
    database.client = AsyncIOMotorClient(mongo_url)
    database.db = database.client[db_name]
    database.gridfs = AsyncIOMotorGridFSBucket(database.db)
    
    print(f"Connected to MongoDB: {db_name}")

async def close_mongo_connection():
    """Close MongoDB connection"""
    if database.client:
        database.client.close()
        print("MongoDB connection closed")

def get_database():
    """Get database instance"""
    return database.db

def get_gridfs():
    """Get GridFS instance for video storage"""
    return database.gridfs

# Collections
def get_users_collection():
    return database.db["users"]

def get_videos_collection():
    return database.db["videos"]

def get_history_collection():
    return database.db["history_logs"]
