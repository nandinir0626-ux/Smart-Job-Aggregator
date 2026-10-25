import re
import hashlib
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional
from config import COSINE_DEDUPE_THRESHOLD

def normalize_string(val: str) -> str:
    if not val:
        return ""
    # Lowercase, strip punctuation, normalize whitespaces
    s = val.lower().strip()
    s = re.sub(r'[\s\-_/]+', ' ', s)
    s = re.sub(r'[^\w\s]', '', s)
    return s.strip()

def compute_fingerprint(title: str, company: str, location: str) -> str:
    """
    fingerprint = sha1(normalized title + company + location)
    """
    norm_title = normalize_string(title)
    norm_company = normalize_string(company)
    norm_location = normalize_string(location)
    combined = f"{norm_title}::{norm_company}::{norm_location}"
    return hashlib.sha1(combined.encode("utf-8")).hexdigest()

def cosine_similarity(v1, v2) -> float:
    if v1 is None or v2 is None or len(v1) == 0 or len(v2) == 0:
        return 0.0
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def check_near_duplicate(db, job_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Check if a job from the same company has cosine similarity > 0.92.
    Returns the existing job document if near-duplicate found, else None.
    """
    company = job_dict.get("company", "")
    embedding = job_dict.get("embedding", [])
    if not company or not embedding:
        return None

    # Query existing jobs with the same company
    existing_jobs = list(db.jobs.find(
        {"company": {"$regex": f"^{re.escape(company.strip())}$", "$options": "i"}},
        {"_id": 1, "title": 1, "company": 1, "location": 1, "postedAt": 1, "createdAt": 1, "embedding": 1, "alsoOn": 1, "source": 1, "sourceId": 1, "url": 1}
    ))

    for ex in existing_jobs:
        ex_embedding = ex.get("embedding")
        if ex_embedding and len(ex_embedding) > 0:
            sim = cosine_similarity(embedding, ex_embedding)
            if sim >= COSINE_DEDUPE_THRESHOLD:
                return ex

    return None
