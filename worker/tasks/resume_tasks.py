import logging
from bson import ObjectId
from celery_app import celery
from db import get_db
from ai.resume_parser import extract_text_from_file, parse_resume_text
from ai.skill_normalizer import get_skill_normalizer
from ai.embeddings import get_embedding_engine, EmbeddingEngine
from tasks.notification_tasks import publish_event, match_job_to_users

logger = logging.getLogger(__name__)

@celery.task(bind=True, max_retries=2, default_retry_delay=10, name="tasks.parse_resume")
def parse_resume(self, resume_id: str, user_id: str, file_path: str):
    """
    Parses resume text from file, runs LLM / Mock extraction, validates via Pydantic,
    normalizes skills, computes embedding, updates MongoDB, and publishes live event.
    """
    logger.info(f"Starting parse_resume task for resume_id={resume_id}, user_id={user_id}, file={file_path}")
    db = get_db()
    try:
        # 1. Extract text from PDF or DOCX
        text = extract_text_from_file(file_path)
        logger.info(f"Extracted {len(text)} characters of text from resume file.")

        # 2. Extract structured fields via configured provider (Gemini / Ollama / Mock)
        parsed_schema = parse_resume_text(text)
        parsed_dict = parsed_schema.model_dump()
        logger.info(f"Parsed resume structured data. Name: {parsed_dict.get('name')}, Skills found: {len(parsed_dict.get('skills', []))}")

        # 3. Normalize skills using curated database + RapidFuzz
        normalizer = get_skill_normalizer()
        raw_skills = parsed_dict.get("skills", [])
        normalized_skills = normalizer.normalize_skill_list(raw_skills)
        logger.info(f"Normalized {len(raw_skills)} raw skills to {len(normalized_skills)} canonical skills: {normalized_skills}")

        # 4. Generate resume embedding with BGE query instruction prefix
        embedder = get_embedding_engine()
        resume_text = EmbeddingEngine.prepare_resume_text(
            summary=parsed_dict.get("summary", ""),
            skills=normalized_skills,
            experience=parsed_dict.get("experience", []),
            projects=parsed_dict.get("projects", [])
        )
        embedding = embedder.embed_text(resume_text, is_query=True)

        # 5. Update MongoDB resume document
        db.resumes.update_one(
            {"_id": ObjectId(resume_id)},
            {"$set": {
                "status": "done",
                "parsed": parsed_dict,
                "normalizedSkills": normalized_skills,
                "embedding": embedding,
                "error": None
            }}
        )
        logger.info(f"Updated resume {resume_id} in MongoDB to status 'done'.")

        # 6. Publish event so the UI updates live via Socket.IO
        event_payload = {
            "resumeId": resume_id,
            "userId": user_id,
            "status": "done",
            "name": parsed_dict.get("name"),
            "skills": normalized_skills,
            "summary": parsed_dict.get("summary")
        }
        publish_event("resume.processed", event_payload)

        # 7. Check matches against recent jobs for this user
        match_user_to_all_jobs.apply_async(args=[user_id, resume_id])

        return {"status": "success", "resume_id": resume_id, "skills_count": len(normalized_skills)}

    except Exception as exc:
        logger.error(f"Error parsing resume {resume_id}: {exc}")
        db.resumes.update_one(
            {"_id": ObjectId(resume_id)},
            {"$set": {"status": "failed", "error": str(exc)}}
        )
        publish_event("resume.processed", {
            "resumeId": resume_id,
            "userId": user_id,
            "status": "failed",
            "error": str(exc)
        })
        raise self.retry(exc=exc)

@celery.task(bind=True, name="tasks.reindex_user_resume")
def reindex_user_resume(self, resume_id: str):
    """
    Re-embeds and re-indexes a resume when edited by the user in the UI.
    """
    db = get_db()
    resume = db.resumes.find_one({"_id": ObjectId(resume_id)})
    if not resume:
        return {"status": "not_found"}

    parsed = resume.get("parsed", {})
    skills = resume.get("normalizedSkills", [])
    embedder = get_embedding_engine()

    resume_text = EmbeddingEngine.prepare_resume_text(
        summary=parsed.get("summary", ""),
        skills=skills,
        experience=parsed.get("experience", []),
        projects=parsed.get("projects", [])
    )
    embedding = embedder.embed_text(resume_text, is_query=True)

    db.resumes.update_one(
        {"_id": ObjectId(resume_id)},
        {"$set": {"embedding": embedding}}
    )
    logger.info(f"Reindexed resume {resume_id}.")
    return {"status": "reindexed"}

@celery.task(bind=True, name="tasks.match_user_to_all_jobs")
def match_user_to_all_jobs(self, user_id: str, resume_id: str):
    """
    Triggered after a new resume is processed. Matches against the top 100 candidate jobs
    in-memory in milliseconds without flooding Celery with 100 redundant tasks.
    """
    from datetime import datetime, timezone
    from config import DEFAULT_MIN_MATCH_SCORE
    from ai.matcher import calculate_hybrid_score
    from ai.deduplicator import cosine_similarity
    from tasks.notification_tasks import publish_event, can_send_email_to_user

    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    resume = db.resumes.find_one({"_id": ObjectId(resume_id)})
    if not user or not resume or not user.get("isVerified", False):
        return {"matched": 0}

    preferences = user.get("preferences", {}) or {}
    min_score = preferences.get("minMatchScore", DEFAULT_MIN_MATCH_SCORE)
    resume_skills = resume.get("normalizedSkills", [])
    resume_embedding = resume.get("embedding", [])

    if not resume_embedding:
        return {"matched": 0}

    # Fetch candidate jobs (scans up to 1000 recent jobs in sub-100ms)
    jobs = list(db.jobs.find({}, {
        "_id": 1, "title": 1, "company": 1, "location": 1, "remote": 1,
        "skills": 1, "postedAt": 1, "embedding": 1, "url": 1
    }).sort([("postedAt", -1)]).limit(1000))

    existing_notifs_map = {
        n["jobId"]: n for n in db.notifications.find({"userId": user["_id"]})
    }

    new_notif_count = 0
    updated_notif_count = 0
    emails_dispatched = 0
    from tasks.email_tasks import send_email

    for job in jobs:
        job_embedding = job.get("embedding")
        if not job_embedding:
            continue

        cosine_sim = cosine_similarity(job_embedding, resume_embedding)
        score_result = calculate_hybrid_score(
            user_skills=resume_skills,
            job_skills=job.get("skills", []),
            cosine_sim=cosine_sim,
            job_remote=job.get("remote", False),
            job_location=job.get("location", ""),
            user_preferences=preferences,
            posted_at=job.get("postedAt")
        )

        final_score = score_result["score"]
        existing_notif = existing_notifs_map.get(job["_id"])

        if existing_notif:
            old_score = existing_notif.get("score", 0.0)
            # If the score improved by >= 2% and meets user's minMatchScore
            if final_score > old_score + 0.02 and final_score >= min_score:
                now_iso = datetime.now(timezone.utc).isoformat()
                db.notifications.update_one(
                    {"_id": existing_notif["_id"]},
                    {"$set": {
                        "score": final_score,
                        "matchedSkills": score_result["matchedSkills"],
                        "missingSkills": score_result["missingSkills"],
                        "explanation": score_result["explanation"],
                        "read": False,
                        "createdAt": now_iso
                    }}
                )

                event_payload = {
                    "notificationId": str(existing_notif["_id"]),
                    "userId": str(user["_id"]),
                    "jobId": str(job["_id"]),
                    "score": final_score,
                    "matchedSkills": score_result["matchedSkills"],
                    "missingSkills": score_result["missingSkills"],
                    "jobTitle": job.get("title"),
                    "company": job.get("company"),
                    "location": job.get("location"),
                    "explanation": score_result["explanation"],
                    "createdAt": now_iso
                }
                publish_event("notification.created", event_payload)

                if (
                    preferences.get("emailAlerts", True) and
                    final_score >= 0.75 and
                    can_send_email_to_user(db, user["_id"])
                ):
                    now_email = datetime.now(timezone.utc).isoformat()
                    db.notifications.update_one(
                        {"_id": existing_notif["_id"]},
                        {"$set": {"emailSent": True, "emailSentAt": now_email}}
                    )
                    subject = f"New Job Match: {job.get('title')} at {job.get('company')} ({int(final_score * 100)}% Match)"
                    body_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                        <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
                            <h2 style="color: #059669; margin: 0; font-size: 22px;">SmartJobs Match Notification</h2>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">AI Skill Matching & Career Opportunities</p>
                        </div>
                        <p style="font-size: 15px; color: #1e293b;">Hello <strong>{user.get('name', 'Job Seeker')}</strong>,</p>
                        <p style="color: #475569; font-size: 14px; line-height: 1.5;">A role matching your skill profile has been found with an impressive <strong>{int(final_score * 100)}% Match</strong>:</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 8px;">
                            <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px;">{job.get('title')}</h3>
                            <p style="margin: 4px 0; color: #334155;"><strong>Company:</strong> {job.get('company')}</p>
                            <p style="margin: 4px 0; color: #334155;"><strong>Location:</strong> {job.get('location')} ({'Remote' if job.get('remote') else 'On-site'})</p>
                            <p style="margin: 4px 0; color: #059669; font-size: 16px;"><strong>Match Score:</strong> <span style="background: #dcfce7; padding: 2px 8px; border-radius: 6px; font-weight: bold;">{int(final_score * 100)}% Match</span></p>
                        </div>

                        <div style="margin: 16px 0;">
                            <p style="margin: 4px 0; color: #334155;"><strong>Matched Skills:</strong> <span style="color: #059669;">{', '.join(score_result['matchedSkills']) or 'General background'}</span></p>
                            <p style="margin: 4px 0; color: #334155;"><strong>Missing Skills:</strong> <span style="color: #e11d48;">{', '.join(score_result['missingSkills']) or 'None'}</span></p>
                            <p style="margin: 8px 0 0 0; color: #475569; font-style: italic; font-size: 13px;">{score_result['explanation']}</p>
                        </div>

                        <div style="margin-top: 28px; text-align: center;">
                            <a href="{job.get('url', '#')}" style="background-color: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">View Job Posting</a>
                        </div>
                    </div>
                    """
                    send_email.apply_async(args=[user.get("email"), subject, body_html, str(existing_notif["_id"])])

                updated_notif_count += 1
        else:
            # New notification for this user and job
            if final_score >= min_score:
                now_iso = datetime.now(timezone.utc).isoformat()
                notif_doc = {
                    "userId": user["_id"],
                    "jobId": job["_id"],
                    "score": final_score,
                    "matchedSkills": score_result["matchedSkills"],
                    "missingSkills": score_result["missingSkills"],
                    "explanation": score_result["explanation"],
                    "read": False,
                    "createdAt": now_iso
                }
                res = db.notifications.insert_one(notif_doc)
                notif_id_str = str(res.inserted_id)

                event_payload = {
                    "notificationId": notif_id_str,
                    "userId": str(user["_id"]),
                    "jobId": str(job["_id"]),
                    "score": final_score,
                    "matchedSkills": score_result["matchedSkills"],
                    "missingSkills": score_result["missingSkills"],
                    "jobTitle": job.get("title"),
                    "company": job.get("company"),
                    "location": job.get("location"),
                    "explanation": score_result["explanation"],
                    "createdAt": now_iso
                }
                publish_event("notification.created", event_payload)

                if (
                    preferences.get("emailAlerts", True) and
                    final_score >= 0.75 and
                    can_send_email_to_user(db, user["_id"])
                ):
                    now_email = datetime.now(timezone.utc).isoformat()
                    db.notifications.update_one(
                        {"_id": res.inserted_id},
                        {"$set": {"emailSent": True, "emailSentAt": now_email}}
                    )
                    subject = f"New Job Match: {job.get('title')} at {job.get('company')} ({int(final_score * 100)}% Match)"
                    body_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                        <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
                            <h2 style="color: #059669; margin: 0; font-size: 22px;">SmartJobs Match Notification</h2>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">AI Skill Matching & Career Opportunities</p>
                        </div>
                        <p style="font-size: 15px; color: #1e293b;">Hello <strong>{user.get('name', 'Job Seeker')}</strong>,</p>
                        <p style="color: #475569; font-size: 14px; line-height: 1.5;">A role matching your skill profile has been found with an impressive <strong>{int(final_score * 100)}% Match</strong>:</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 8px;">
                            <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px;">{job.get('title')}</h3>
                            <p style="margin: 4px 0; color: #334155;"><strong>Company:</strong> {job.get('company')}</p>
                            <p style="margin: 4px 0; color: #334155;"><strong>Location:</strong> {job.get('location')} ({'Remote' if job.get('remote') else 'On-site'})</p>
                            <p style="margin: 4px 0; color: #059669; font-size: 16px;"><strong>Match Score:</strong> <span style="background: #dcfce7; padding: 2px 8px; border-radius: 6px; font-weight: bold;">{int(final_score * 100)}% Match</span></p>
                        </div>

                        <div style="margin: 16px 0;">
                            <p style="margin: 4px 0; color: #334155;"><strong>Matched Skills:</strong> <span style="color: #059669;">{', '.join(score_result['matchedSkills']) or 'General background'}</span></p>
                            <p style="margin: 4px 0; color: #334155;"><strong>Missing Skills:</strong> <span style="color: #e11d48;">{', '.join(score_result['missingSkills']) or 'None'}</span></p>
                            <p style="margin: 8px 0 0 0; color: #475569; font-style: italic; font-size: 13px;">{score_result['explanation']}</p>
                        </div>

                        <div style="margin-top: 28px; text-align: center;">
                            <a href="{job.get('url', '#')}" style="background-color: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">View Job Posting</a>
                        </div>
                    </div>
                    """
                    send_email.apply_async(args=[user.get("email"), subject, body_html, notif_id_str])

                new_notif_count += 1

    logger.info(f"Direct match complete for user {user.get('email')}: created {new_notif_count}, upgraded {updated_notif_count} notifications.")
    return {"matched_count": new_notif_count, "upgraded_count": updated_notif_count}
