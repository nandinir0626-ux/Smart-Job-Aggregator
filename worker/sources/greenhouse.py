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

class GreenhouseSource(JobSource):
    """
    Crawls public, free, keyless Greenhouse job boards for top tech companies.
    Provides direct application links to company ATS with zero middlemen.
    """

    # Curated list of top tech companies using public Greenhouse boards
    DEFAULT_COMPANIES = [
        "stripe",
        "figma",
        "datadog",
        "discord",
        "airbnb",
        "coinbase",
        "cloudflare",
    ]

    def __init__(self, companies: List[str] = None):
        self.companies = companies or self.DEFAULT_COMPANIES

    @property
    def name(self) -> str:
        return "greenhouse"

    def _fetch_company_jobs(self, company: str, jobs_per_company: int) -> List[Dict[str, Any]]:
        company_jobs_res = []
        try:
            url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true"
            response = requests.get(url, timeout=4)
            if response.status_code == 200:
                data = response.json()
                for item in data.get("jobs", [])[:jobs_per_company]:
                    title = item.get("title", "").strip()
                    location = (item.get("location", {}) or {}).get("name", "Remote").strip() or "Remote"
                    description = strip_html(item.get("content", ""))
                    job_url = item.get("absolute_url", "")
                    source_id = str(item.get("id", ""))
                    updated_at = item.get("updated_at") or datetime.now(timezone.utc).isoformat()
                    is_remote = bool("remote" in location.lower() or "remote" in title.lower())

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
                        "postedAt": updated_at
                    })
        except Exception as e:
            logger.warning(f"[Greenhouse] Error fetching from '{company}': {e}")
        return company_jobs_res

    def fetch_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        jobs = []
        jobs_per_company = max(3, limit // len(self.companies))

        with ThreadPoolExecutor(max_workers=min(len(self.companies), 8)) as executor:
            future_to_company = {
                executor.submit(self._fetch_company_jobs, comp, jobs_per_company): comp
                for comp in self.companies
            }
            for future in as_completed(future_to_company):
                comp_jobs = future.result()
                jobs.extend(comp_jobs)
                if len(jobs) >= limit:
                    break

        logger.info(f"[Greenhouse] Fetched {len(jobs)} jobs concurrently across {len(self.companies)} companies.")
        return jobs[:limit]
