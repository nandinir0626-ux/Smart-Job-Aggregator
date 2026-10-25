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

class LeverSource(JobSource):
    """
    Crawls public, free, keyless Lever job boards for top tech companies.
    Provides direct application links to Lever postings.
    """

    DEFAULT_COMPANIES = [
        "palantir",
        "spotify",
    ]

    def __init__(self, companies: List[str] = None):
        self.companies = companies or self.DEFAULT_COMPANIES

    @property
    def name(self) -> str:
        return "lever"

    def _fetch_company_jobs(self, company: str, jobs_per_company: int) -> List[Dict[str, Any]]:
        company_jobs_res = []
        try:
            url = f"https://api.lever.co/v0/postings/{company}?mode=json"
            response = requests.get(url, timeout=4)
            if response.status_code == 200:
                raw_data = response.json()
                if isinstance(raw_data, list):
                    for item in raw_data[:jobs_per_company]:
                        title = item.get("text", "").strip()
                        categories = item.get("categories", {}) or {}
                        location = categories.get("location", "Remote").strip() or "Remote"
                        description = strip_html(item.get("descriptionPlain", "") or item.get("description", ""))
                        job_url = item.get("applyUrl") or item.get("hostedUrl", "")
                        source_id = str(item.get("id", ""))
                        
                        created_val = item.get("createdAt")
                        if isinstance(created_val, (int, float)):
                            posted_at = datetime.fromtimestamp(created_val / 1000.0, tz=timezone.utc).isoformat()
                        else:
                            posted_at = datetime.now(timezone.utc).isoformat()

                        workplace_type = (item.get("workplaceType") or "").lower()
                        is_remote = bool("remote" in location.lower() or "remote" in workplace_type or "remote" in title.lower())

                        if not title or not job_url:
                            continue

                        company_jobs_res.append({
                            "source": self.name,
                            "sourceId": f"{company}-{source_id}",
                            "title": title,
                            "company": company.capitalize(),
                            "location": location,
                            "remote": is_remote,
                            "description": description,
                            "skills": [],
                            "salaryMin": None,
                            "salaryMax": None,
                            "url": job_url,
                            "postedAt": posted_at
                        })
        except Exception as e:
            logger.warning(f"[Lever] Error fetching from '{company}': {e}")
        return company_jobs_res

    def fetch_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        jobs = []
        jobs_per_company = max(4, limit // len(self.companies))

        with ThreadPoolExecutor(max_workers=min(len(self.companies), 4)) as executor:
            future_to_company = {
                executor.submit(self._fetch_company_jobs, comp, jobs_per_company): comp
                for comp in self.companies
            }
            for future in as_completed(future_to_company):
                comp_jobs = future.result()
                jobs.extend(comp_jobs)
                if len(jobs) >= limit:
                    break

        logger.info(f"[Lever] Fetched {len(jobs)} jobs concurrently across {len(self.companies)} companies.")
        return jobs[:limit]
