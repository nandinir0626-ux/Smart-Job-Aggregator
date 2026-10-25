from abc import ABC, abstractmethod
from typing import List, Dict, Any

class JobSource(ABC):
    """
    Abstract base class for pluggable job sources.
    """
    @property
    @abstractmethod
    def name(self) -> str:
        """Source name identifier, e.g. 'adzuna', 'remotive', 'seed'"""
        pass

    @abstractmethod
    def fetch_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetches raw or partially normalized jobs from the source.
        Returns a list of dicts with fields:
        {
          "source": str,
          "sourceId": str,
          "title": str,
          "company": str,
          "location": str,
          "remote": bool,
          "description": str,
          "skills": List[str], # optional at fetch time
          "salaryMin": float/None,
          "salaryMax": float/None,
          "url": str,
          "postedAt": str (ISO)
        }
        """
        pass
