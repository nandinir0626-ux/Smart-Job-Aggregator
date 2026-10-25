from pymongo import MongoClient, TEXT, ASCENDING
import logging
from config import MONGO_URI

logger = logging.getLogger(__name__)

_client = None
_db = None

def get_db():
    global _client, _db
    if _db is None:
        logger.info(f"Connecting to MongoDB at {MONGO_URI}...")
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Extract database name from URI or default
        db_name = "job_aggregator"
        if "/" in MONGO_URI.replace("mongodb://", "").replace("mongodb+srv://", ""):
            parts = MONGO_URI.rsplit("/", 1)
            if parts[-1] and "?" not in parts[-1]:
                db_name = parts[-1]
            elif "?" in parts[-1]:
                db_name = parts[-1].split("?")[0]
        _db = _client[db_name]
        init_db_indexes(_db)
    return _db

def init_db_indexes(db):
    try:
        # jobs collection indexes
        db.jobs.create_index([("fingerprint", ASCENDING)], unique=True)
        db.jobs.create_index([("postedAt", ASCENDING)])
        db.jobs.create_index([("remote", ASCENDING)])
        db.jobs.create_index([("source", ASCENDING)])
        # Text index
        existing_indexes = db.jobs.index_information()
        if "JobTextIndex" not in existing_indexes:
            db.jobs.create_index(
                [("title", TEXT), ("company", TEXT), ("description", TEXT)],
                name="JobTextIndex",
                weights={"title": 5, "company": 3, "description": 1}
            )

        # users collection indexes
        db.users.create_index([("email", ASCENDING)], unique=True)

        # resumes collection indexes
        db.resumes.create_index([("userId", ASCENDING)])
        db.resumes.create_index([("status", ASCENDING)])

        # notifications collection indexes
        db.notifications.create_index([("userId", ASCENDING), ("read", ASCENDING)])

        # savedJobs collection indexes
        db.savedJobs.create_index([("userId", ASCENDING), ("jobId", ASCENDING)], unique=True)

        logger.info("MongoDB indexes verified and ready.")
    except Exception as e:
        logger.warning(f"Error ensuring indexes: {e}")
