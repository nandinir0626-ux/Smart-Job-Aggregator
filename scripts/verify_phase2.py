import sys
import os
from pathlib import Path

# Add worker and root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "worker"))

from db import get_db
from sources.seed import SeedSource
from ai.skill_normalizer import get_skill_normalizer
from ai.deduplicator import compute_fingerprint
from ai.embeddings import get_embedding_engine, EmbeddingEngine
from ai.faiss_index import get_faiss_cache
import requests

def run_phase2_check():
    print("--- RUNNING PHASE 2 ACCEPTANCE CHECK ---")
    db = get_db()
    normalizer = get_skill_normalizer()
    embedder = get_embedding_engine()
    faiss_cache = get_faiss_cache()

    # 1. Test normalization
    raw_sample_skills = ["reactjs", "py", "k8s", "golang", "unknown_nonexistent_xyz123"]
    normalized = normalizer.normalize_skill_list(raw_sample_skills)
    print(f"Skill Normalization Test: {raw_sample_skills} -> {normalized}")
    assert "React" in normalized, "React should be normalized"
    assert "Python" in normalized, "Python should be normalized"
    assert "Kubernetes" in normalized, "Kubernetes should be normalized"
    assert "Go" in normalized, "Go should be normalized"
    assert "unknown_nonexistent_xyz123" not in normalized, "Junk skills must be dropped"

    # 2. Test seed jobs ingestion into Mongo
    seed_source = SeedSource()
    seed_jobs = seed_source.fetch_jobs(limit=165)
    print(f"Fetched {len(seed_jobs)} seed jobs.")
    assert len(seed_jobs) >= 150, f"Expected at least 150 seed jobs, got {len(seed_jobs)}"

    inserted_count = 0
    duplicate_count = 0

    print("Inserting/Indexing seed jobs in MongoDB and FAISS...")
    for j in seed_jobs:
        title = j["title"]
        company = j["company"]
        location = j["location"]
        skills = normalizer.normalize_skill_list(j.get("skills", []))
        fingerprint = compute_fingerprint(title, company, location)

        existing = db.jobs.find_one({"fingerprint": fingerprint})
        if existing:
            duplicate_count += 1
            continue

        job_text = EmbeddingEngine.prepare_job_text(title, company, skills, j["description"])
        embedding = embedder.embed_text(job_text)

        doc = {
            "source": j.get("source", "seed"),
            "sourceId": j.get("sourceId", ""),
            "title": title,
            "company": company,
            "location": location,
            "remote": j.get("remote", False),
            "description": j["description"],
            "skills": skills,
            "salaryMin": j.get("salaryMin"),
            "salaryMax": j.get("salaryMax"),
            "url": j.get("url", ""),
            "postedAt": j.get("postedAt"),
            "fingerprint": fingerprint,
            "embedding": embedding,
            "alsoOn": [],
            "createdAt": j.get("createdAt")
        }
        res = db.jobs.insert_one(doc)
        faiss_cache.add_job(str(res.inserted_id), embedding)
        inserted_count += 1

    total_in_db = db.jobs.count_documents({})
    print(f"Inserted: {inserted_count}, Duplicates skipped: {duplicate_count}, Total in Mongo: {total_in_db}")
    assert total_in_db >= 150, f"Expected at least 150 jobs in Mongo, found {total_in_db}"
    print(f"FAISS index ntotal: {faiss_cache.index.ntotal}")

    print(">>> PHASE 2 ACCEPTANCE CHECK PASSED! <<<")

if __name__ == "__main__":
    run_phase2_check()
