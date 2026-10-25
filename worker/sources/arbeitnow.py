import logging
import requests
import re
from typing import List, Dict, Any
from datetime import datetime, timezone
from sources.base import JobSource

logger = logging.getLogger(__name__)

def strip_html(html_text: str) -> str:
    if not html_text:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', html_text)
    return re.sub(r'\s+', ' ', clean).strip()

class ArbeitnowSource(JobSource):
    @property
    def name(self) -> str:
        return "arbeitnow"

    def fetch_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        jobs = []
        try:
            url = "https://www.arbeitnow.com/api/job-board-api"
            logger.info(f"Fetching jobs from Arbeitnow API ({url})...")
            response = requests.get(url, timeout=12)

            if response.status_code == 200:
                data = response.json()
                raw_jobs = data.get("data", [])
                for item in raw_jobs[:limit]:
                    title = item.get("title", "").strip()
                    company = item.get("company_name", "Unknown Company").strip()
                    location = item.get("location", "Remote").strip() or "Remote"
                    description = strip_html(item.get("description", ""))
                    job_url = item.get("url", "")
                    
                    # Convert timestamp
                    created_val = item.get("created_at")
                    if isinstance(created_val, (int, float)):
                        posted_at = datetime.fromtimestamp(created_val, tz=timezone.utc).isoformat()
                    else:
                        posted_at = datetime.now(timezone.utc).isoformat()
                        
                    source_id = str(item.get("slug", ""))
                    tags = item.get("tags", [])
                    is_remote = bool(item.get("remote", False) or "remote" in location.lower())

                    if not job_url or not title or not company:
                        continue

                    jobs.append({
                        "source": self.name,
                        "sourceId": source_id,
                        "title": title,
                        "company": company,
                        "location": location,
                        "remote": is_remote,
                        "description": description,
                        "skills": tags,
                        "salaryMin": None,
                        "salaryMax": None,
                        "url": job_url,
                        "postedAt": posted_at
                    })
                logger.info(f"Fetched {len(jobs)} jobs from Arbeitnow.")
            else:
                logger.warning(f"Arbeitnow API returned status {response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching from Arbeitnow API: {e}")

        return jobs
