import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["USE_TF"] = "0"

from pathlib import Path
from dotenv import load_dotenv

# Load root .env
root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Database & Broker
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/job_aggregator")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", RABBITMQ_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "rpc://")

# Paths
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = root_dir
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT_DIR / "data")))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
SKILLS_FILE = DATA_DIR / "skills.json"
SEED_JOBS_FILE = DATA_DIR / "seed_jobs.json"

# Job Sources Config
REMOTIVE_API_URL = os.getenv("REMOTIVE_API_URL", "https://remotive.com/api/remote-jobs")
CRAWL_INTERVAL_MINUTES = int(os.getenv("CRAWL_INTERVAL_MINUTES", "15"))

# AI & LLM Provider Config
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock").lower()  # gemini | ollama | mock
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")

# Hybrid Scoring Weights (must sum to 1.0)
WEIGHT_SEMANTIC = float(os.getenv("WEIGHT_SEMANTIC", "0.50"))
WEIGHT_SKILL = float(os.getenv("WEIGHT_SKILL", "0.30"))
WEIGHT_LOCATION = float(os.getenv("WEIGHT_LOCATION", "0.10"))
WEIGHT_RECENCY = float(os.getenv("WEIGHT_RECENCY", "0.10"))
RECENCY_HALF_LIFE_DAYS = float(os.getenv("RECENCY_HALF_LIFE_DAYS", "14.0"))

# Thresholds
COSINE_DEDUPE_THRESHOLD = float(os.getenv("COSINE_DEDUPE_THRESHOLD", "0.92"))
RAPIDFUZZ_SKILL_THRESHOLD = float(os.getenv("RAPIDFUZZ_SKILL_THRESHOLD", "90.0"))
DEFAULT_MIN_MATCH_SCORE = float(os.getenv("DEFAULT_MIN_MATCH_SCORE", "0.60"))

# Email Provider Config
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "smtp").lower()  # smtp | brevo | resend | console
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "SmartJobs Security <hanu88688@gmail.com>")

