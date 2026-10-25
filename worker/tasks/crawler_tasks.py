import logging
from celery_app import celery
from db import get_db
from sources import get_all_sources, get_source
from ai.deduplicator import compute_fingerprint

logger = logging.getLogger(__name__)

@celery.task(bind=True, max_retries=3, default_retry_delay=60, name="tasks.crawler_tasks.crawl_sources")
def crawl_sources(self, source_name=None):
    """
    Crawls job sources and enqueues process_job only for unseen jobs.
    Known duplicates are fast-updated directly in MongoDB without congesting Celery.
    """
    logger.info(f"Starting crawl_sources (source: {source_name or 'all'})...")
    db = get_db()

    sources_to_run = [get_source(source_name)] if source_name else get_all_sources()

    total_dispatched = 0
    total_skipped = 0

    for src in sources_to_run:
        if not src:
            continue
        try:
            logger.info(f"Executing crawl for source '{src.name}'...")
            jobs = src.fetch_jobs(limit=50)
            if not jobs:
                continue

            # Compute fingerprints for all scraped jobs
            job_fp_map = {}
            for j in jobs:
                fp = compute_fingerprint(j.get("title", ""), j.get("company", ""), j.get("location", "Remote"))
                j["fingerprint"] = fp
                job_fp_map[fp] = j

            # Batch query MongoDB for existing fingerprints
            existing_fps = set()
            for doc in db.jobs.find({"fingerprint": {"$in": list(job_fp_map.keys())}}, {"fingerprint": 1}):
                existing_fps.add(doc["fingerprint"])

            from tasks.job_tasks import process_job
            for fp, j in job_fp_map.items():
                if fp in existing_fps:
                    total_skipped += 1
                else:
                    process_job.apply_async(args=[j], expires=3600)
                    total_dispatched += 1

            logger.info(f"Source '{src.name}': {len(jobs)} fetched, {len(jobs) - len(existing_fps)} new dispatched, {len(existing_fps)} existing skipped.")
        except Exception as e:
            logger.error(f"Error crawling source {src.name}: {e}")

    logger.info(f"Crawl completed. Dispatched {total_dispatched} new jobs (skipped {total_skipped} existing).")
    return {"status": "success", "jobs_dispatched": total_dispatched, "duplicates_skipped": total_skipped}
