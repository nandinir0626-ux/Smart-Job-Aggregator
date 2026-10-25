import json
import logging
from typing import List, Dict, Any
from sources.base import JobSource
from config import SEED_JOBS_FILE

logger = logging.getLogger(__name__)

class SeedSource(JobSource):
    @property
    def name(self) -> str:
        return "seed"

    def fetch_jobs(self, limit: int = 200) -> List[Dict[str, Any]]:
        jobs = []
        try:
            if SEED_JOBS_FILE.exists():
                logger.info(f"Loading seed jobs from {SEED_JOBS_FILE}...")
                with open(SEED_JOBS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                jobs = data[:limit]
                logger.info(f"Loaded {len(jobs)} seed jobs.")
            else:
                logger.warning(f"Seed jobs file not found at {SEED_JOBS_FILE}")
        except Exception as e:
            logger.error(f"Error loading seed jobs: {e}")
        return jobs
