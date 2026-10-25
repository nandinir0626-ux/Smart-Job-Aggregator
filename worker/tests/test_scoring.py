import pytest
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.matcher import calculate_hybrid_score, compute_recency_score

def test_recency_half_life():
    now = datetime.now(timezone.utc)
    # Today -> recency score 1.0
    score_today = compute_recency_score(now.isoformat())
    assert pytest.approx(score_today, 0.05) == 1.0

    # 14 days ago -> recency score ~ 0.50 (half-life = 14 days)
    date_14d_ago = (now - timedelta(days=14)).isoformat()
    score_14d = compute_recency_score(date_14d_ago)
    assert pytest.approx(score_14d, 0.05) == 0.50

    # 28 days ago -> recency score ~ 0.25 (two half-lives)
    date_28d_ago = (now - timedelta(days=28)).isoformat()
    score_28d = compute_recency_score(date_28d_ago)
    assert pytest.approx(score_28d, 0.05) == 0.25

def test_hybrid_scoring_calculation():
    user_skills = ["Python", "React", "PostgreSQL", "Docker"]
    job_skills = ["Python", "React", "FastAPI"]
    
    # Cosine = 1.0, Job is Remote, User prefers Remote, Posted Today
    now_iso = datetime.now(timezone.utc).isoformat()
    prefs = {"remote": True, "locations": ["Remote"]}

    result = calculate_hybrid_score(
        user_skills=user_skills,
        job_skills=job_skills,
        cosine_sim=1.0,
        job_remote=True,
        job_location="Remote",
        user_preferences=prefs,
        posted_at=now_iso
    )

    # 2 out of 3 job skills matched (Python, React): skill score = 2/3 = 0.667
    # cosine = 1.0, loc = 1.0, recency = 1.0
    # Expected: 0.50*(1.0) + 0.30*(2/3) + 0.10*(1.0) + 0.10*(1.0) = 0.50 + 0.20 + 0.10 + 0.10 = 0.90
    assert "Python" in result["matchedSkills"]
    assert "React" in result["matchedSkills"]
    assert "FastAPI" in result["missingSkills"]
    assert pytest.approx(result["score"], 0.05) == 0.90
    assert "FastAPI" in result["explanation"]
