import logging
import requests
import re
from typing import List, Dict, Any
from datetime import datetime, timezone
from sources.base import JobSource
from config import REMOTIVE_API_URL

logger = logging.getLogger(__name__)

def strip_html(html_text: str) -> str:
    if not html_text:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', html_text)
    return re.sub(r'\s+', ' ', clean).strip()

class RemotiveSource(JobSource):
    @property
    def name(self) -> str:
        return "remotive"

    def fetch_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        jobs = []
        try:
            url = REMOTIVE_API_URL or "https://remotive.com/api/remote-jobs"
            params = {"category": "software-dev", "limit": limit}
            logger.info(f"Fetching jobs from Remotive API ({url})...")
            response = requests.get(url, params=params, timeout=12)

            if response.status_code == 200:
                data = response.json()
                raw_jobs = data.get("jobs", [])
                for item in raw_jobs[:limit]:
                    title = item.get("title", "").strip()
                    company = item.get("company_name", "Unknown Company").strip()
                    location = item.get("candidate_required_location", "Worldwide Remote").strip() or "Remote"
                    description = strip_html(item.get("description", ""))
                    job_url = item.get("url", "")
                    posted_at = item.get("publication_date") or datetime.now(timezone.utc).isoformat()
                    source_id = str(item.get("id", ""))
                    tags = item.get("tags", [])

                    # Salary parsing if present
                    salary_str = item.get("salary", "")
                    salary_min = None
                    salary_max = None
                    if salary_str:
                        nums = re.findall(r'\d[\d,]*', salary_str)
                        if nums:
                            clean_nums = [float(n.replace(',', '')) for n in nums if len(n.replace(',', '')) >= 4]
                            if len(clean_nums) == 1:
                                salary_min = clean_nums[0]
                            elif len(clean_nums) >= 2:
                                salary_min = min(clean_nums)
                                salary_max = max(clean_nums)

                    jobs.append({
                        "source": self.name,
                        "sourceId": source_id,
                        "title": title,
                        "company": company,
                        "location": location,
                        "remote": True,
                        "description": description,
                        "skills": tags,
                        "salaryMin": salary_min,
                        "salaryMax": salary_max,
                        "url": job_url,
                        "postedAt": posted_at
                    })
                logger.info(f"Fetched {len(jobs)} jobs from Remotive.")
            else:
                logger.warning(f"Remotive API returned status {response.status_code}: {response.text[:200]}")
        except Exception as e:
            logger.error(f"Error fetching from Remotive API: {e}")

        return jobs
