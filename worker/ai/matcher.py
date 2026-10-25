import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Set, Tuple
from config import (
    WEIGHT_SEMANTIC,
    WEIGHT_SKILL,
    WEIGHT_LOCATION,
    WEIGHT_RECENCY,
    RECENCY_HALF_LIFE_DAYS,
    DEFAULT_MIN_MATCH_SCORE
)

def compute_recency_score(posted_at) -> float:
    if not posted_at:
        return 0.5
    try:
        if isinstance(posted_at, str):
            posted_date = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
        elif isinstance(posted_at, datetime):
            posted_date = posted_at
        else:
            return 0.5
        
        if posted_date.tzinfo is None:
            posted_date = posted_date.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        diff_days = max(0.0, (now - posted_date).total_seconds() / (24 * 3600))
        decay = math.exp(-math.log(2) * (diff_days / RECENCY_HALF_LIFE_DAYS))
        return min(1.0, max(0.0, decay))
    except Exception:
        return 0.5

def calculate_hybrid_score(
    user_skills: List[str],
    job_skills: List[str],
    cosine_sim: float,
    job_remote: bool,
    job_location: str,
    user_preferences: Dict[str, Any],
    posted_at: Any
) -> Dict[str, Any]:
    """
    Computes hybrid score according to spec:
    0.50 * semantic cosine + 0.30 * skill overlap + 0.10 * location/remote + 0.10 * recency decay
    """
    u_skills_set: Set[str] = {s.strip().lower() for s in user_skills if s}
    j_skills_list: List[str] = [s.strip() for s in job_skills if s]

    matched_skills = []
    missing_skills = []

    for s in j_skills_list:
        if s.lower() in u_skills_set:
            matched_skills.append(s)
        else:
            missing_skills.append(s)

    # 1. Skill score
    if len(j_skills_list) > 0:
        skill_score = len(matched_skills) / len(j_skills_list)
    else:
        # Jaccard fallback if job skills empty
        all_unique = u_skills_set.union({s.lower() for s in j_skills_list})
        skill_score = len(matched_skills) / len(all_unique) if all_unique else 0.2

    # 2. Location / remote score
    pref_remote = user_preferences.get("remote", True)
    pref_locations = [loc.lower().strip() for loc in user_preferences.get("locations", []) if loc]

    loc_score = 0.2
    if job_remote and pref_remote:
        loc_score = 1.0
    elif any(loc in (job_location or "").lower() for loc in pref_locations):
        loc_score = 1.0
    elif not pref_locations and pref_remote:
        loc_score = 0.5

    # 3. Recency score
    recency_score = compute_recency_score(posted_at)

    # 4. Semantic cosine (clamped between 0 and 1)
    cosine_score = min(1.0, max(0.0, float(cosine_sim)))

    # Weighted sum
    final_score = (
        WEIGHT_SEMANTIC * cosine_score +
        WEIGHT_SKILL * skill_score +
        WEIGHT_LOCATION * loc_score +
        WEIGHT_RECENCY * recency_score
    )
    final_score = round(min(1.0, max(0.0, final_score)), 3)

    # Explanations template
    if matched_skills and missing_skills:
        top_matched = ", ".join(matched_skills[:3])
        top_missing = ", ".join(missing_skills[:2])
        explanation = f"Matched {len(matched_skills)} skills ({top_matched}). Missing: {top_missing}."
    elif matched_skills:
        all_m = ", ".join(matched_skills)
        explanation = f"Strong match! Possesses all {len(matched_skills)} required skills ({all_m})."
    else:
        explanation = f"Relevant match based on role background in {job_location or 'remote'}."

    return {
        "score": final_score,
        "cosine": round(cosine_score, 3),
        "skillScore": round(skill_score, 3),
        "locScore": round(loc_score, 3),
        "recencyScore": round(recency_score, 3),
        "matchedSkills": matched_skills,
        "missingSkills": missing_skills,
        "explanation": explanation
    }
