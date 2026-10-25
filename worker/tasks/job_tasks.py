import logging
from datetime import datetime, timezone
from celery_app import celery
from db import get_db
from ai.skill_normalizer import get_skill_normalizer
from ai.deduplicator import compute_fingerprint, check_near_duplicate
from ai.embeddings import get_embedding_engine, EmbeddingEngine
from ai.faiss_index import get_faiss_cache
from ai.salary_normalizer import SalaryNormalizer

logger = logging.getLogger(__name__)

@celery.task(bind=True, max_retries=3, default_retry_delay=15, name="tasks.job_tasks.process_job")
def process_job(self, raw_job: dict):
    """
    Normalizes a job, extracts skills, computes fingerprint and embedding,
    deduplicates against MongoDB, indexes in FAISS, and triggers matching.
    """
    try:
        db = get_db()
        normalizer = get_skill_normalizer()
        embedder = get_embedding_engine()
        faiss_cache = get_faiss_cache()

        title = raw_job.get("title", "").strip()
        company = raw_job.get("company", "").strip()
        location = raw_job.get("location", "Remote").strip()
        description = raw_job.get("description", "").strip()
        is_remote = bool(raw_job.get("remote", False) or "remote" in location.lower() or "remote" in title.lower())
        source = raw_job.get("source", "unknown")
        source_id = str(raw_job.get("sourceId", ""))
        url = raw_job.get("url", "")
        posted_at = raw_job.get("postedAt") or datetime.now(timezone.utc).isoformat()
        salary_min = raw_job.get("salaryMin")
        salary_max = raw_job.get("salaryMax")

        if not title or not company:
            logger.warning("Job missing title or company, skipping.")
            return {"status": "skipped", "reason": "missing_required_fields"}

        # 1. Skill extraction and normalization
        provided_skills = raw_job.get("skills", [])
        if provided_skills:
            normalized_skills = normalizer.normalize_skill_list(provided_skills)
        else:
            # Extract from title + description
            combined_text = f"{title}\n{description}"
            normalized_skills = normalizer.extract_skills_from_text(combined_text)

        # 2. Compute unique fingerprint
        fingerprint = compute_fingerprint(title, company, location)

        # 3. Check for exact duplicate via fingerprint
        existing_exact = db.jobs.find_one({"fingerprint": fingerprint})
        if existing_exact:
            logger.info(f"Exact duplicate found for job '{title}' at '{company}' (id: {existing_exact['_id']}).")
            # Update alsoOn if coming from a different source
            if existing_exact.get("source") != source or existing_exact.get("sourceId") != source_id:
                db.jobs.update_one(
                    {"_id": existing_exact["_id"]},
                    {"$addToSet": {"alsoOn": {
                        "source": source,
                        "sourceId": source_id,
                        "url": url,
                        "postedAt": posted_at
                    }}}
                )
            return {"status": "duplicate_exact", "job_id": str(existing_exact["_id"])}

        # 4. Generate embedding for the new job
        job_text = EmbeddingEngine.prepare_job_text(title, company, normalized_skills, description)
        embedding = embedder.embed_text(job_text, is_query=False)

        # 5. Check for near-duplicate (same company & cosine > 0.92)
        candidate = {
            "title": title,
            "company": company,
            "location": location,
            "embedding": embedding
        }
        near_duplicate = check_near_duplicate(db, candidate)
        if near_duplicate:
            logger.info(f"Near-duplicate found for job '{title}' at '{company}' (matches existing id: {near_duplicate['_id']}).")
            db.jobs.update_one(
                {"_id": near_duplicate["_id"]},
                {"$addToSet": {"alsoOn": {
                    "source": source,
                    "sourceId": source_id,
                    "url": url,
                    "postedAt": posted_at
                }}}
            )
            return {"status": "duplicate_near", "job_id": str(near_duplicate["_id"])}

        # 5b. Normalize multi-currency compensation
        raw_salary_text = raw_job.get("salary", "") or description[:500]
        normalized_salary = SalaryNormalizer.normalize_salary(raw_salary_text, salary_min, salary_max)

        # 6. Save new job document to MongoDB
        job_doc = {
            "source": source,
            "sourceId": source_id,
            "title": title,
            "company": company,
            "location": location,
            "remote": is_remote,
            "description": description,
            "skills": normalized_skills,
            "salaryMin": salary_min,
            "salaryMax": salary_max,
            "salaryNormalized": normalized_salary,
            "url": url,
            "postedAt": posted_at,
            "fingerprint": fingerprint,
            "embedding": embedding,
            "alsoOn": raw_job.get("alsoOn", []),
            "createdAt": datetime.now(timezone.utc).isoformat()
        }

        result = db.jobs.insert_one(job_doc)
        job_id_str = str(result.inserted_id)
        logger.info(f"Successfully processed and inserted new job: '{title}' at '{company}' (id: {job_id_str}).")

        # 7. Add to FAISS index
        faiss_cache.add_job(job_id_str, embedding)

        # 8. Dispatch matching task
        from tasks.notification_tasks import match_job_to_users
        match_job_to_users.apply_async(args=[job_id_str])

        return {"status": "inserted", "job_id": job_id_str}

    except Exception as exc:
        logger.error(f"Error processing job: {exc}")
        raise self.retry(exc=exc)
