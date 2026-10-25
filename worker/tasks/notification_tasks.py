import json
import logging
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from kombu import Connection, Exchange, Producer
from celery_app import celery
from db import get_db
from config import RABBITMQ_URL, DEFAULT_MIN_MATCH_SCORE
from ai.matcher import calculate_hybrid_score
from ai.deduplicator import cosine_similarity

logger = logging.getLogger(__name__)

events_exchange = Exchange("events", type="topic", durable=True)

def can_send_email_to_user(db, user_id) -> bool:
    """
    Enforces daily email limit: user can receive at most 5 job alert emails in a rolling 24-hour window.
    """
    twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    sent_count = db.notifications.count_documents({
        "userId": user_id,
        "emailSent": True,
        "emailSentAt": {"$gte": twenty_four_hours_ago}
    })
    return sent_count < 5

def publish_event(routing_key: str, payload: dict):
    try:
        with celery.producer_pool.acquire(block=True) as producer:
            producer.publish(
                json.dumps(payload),
                exchange=events_exchange,
                routing_key=routing_key,
                content_type="application/json",
                content_encoding="utf-8"
            )
        logger.info(f"Published event '{routing_key}' to RabbitMQ events exchange.")
    except Exception as e:
        logger.error(f"Failed to publish event '{routing_key}': {e}")

@celery.task(bind=True, max_retries=2, default_retry_delay=10, name="tasks.notification_tasks.match_job_to_users")
def match_job_to_users(self, job_id: str):
    """
    Scores the given job against every user who has a parsed resume with status 'done'.
    If score >= user minMatchScore threshold (default 0.60), creates notification,
    publishes notification.created event to RabbitMQ, and triggers email alert if enabled.
    """
    try:
        db = get_db()
        job = db.jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            logger.warning(f"Job {job_id} not found for matching.")
            return {"matched_users": 0}

        job_embedding = job.get("embedding", [])
        job_skills = job.get("skills", [])
        job_remote = job.get("remote", False)
        job_location = job.get("location", "")
        job_posted_at = job.get("postedAt")

        # Find all users with a completed resume
        completed_resumes = list(db.resumes.find({"status": "done"}))
        logger.info(f"Matching job '{job.get('title')}' against {len(completed_resumes)} active resumes...")

        matches_count = 0
        for resume in completed_resumes:
            user_id = resume.get("userId")
            if not user_id:
                continue

            user = db.users.find_one({"_id": user_id})
            if not user or not user.get("isVerified", False):
                continue

            preferences = user.get("preferences", {}) or {}
            min_score = preferences.get("minMatchScore", DEFAULT_MIN_MATCH_SCORE)

            resume_skills = resume.get("normalizedSkills", [])
            resume_embedding = resume.get("embedding", [])

            # Compute cosine similarity
            cosine_sim = cosine_similarity(job_embedding, resume_embedding)

            # Compute hybrid score
            score_result = calculate_hybrid_score(
                user_skills=resume_skills,
                job_skills=job_skills,
                cosine_sim=cosine_sim,
                job_remote=job_remote,
                job_location=job_location,
                user_preferences=preferences,
                posted_at=job_posted_at
            )

            final_score = score_result["score"]
            if final_score >= min_score:
                logger.info(f"Match found! User {user.get('email')} matched job '{job.get('title')}' with score {final_score} (threshold: {min_score})")

                # Check if notification already exists for this user and job
                existing_notif = db.notifications.find_one({
                    "userId": user["_id"],
                    "jobId": job["_id"]
                })

                if not existing_notif:
                    notif_doc = {
                        "userId": user["_id"],
                        "jobId": job["_id"],
                        "score": final_score,
                        "matchedSkills": score_result["matchedSkills"],
                        "missingSkills": score_result["missingSkills"],
                        "explanation": score_result["explanation"],
                        "read": False,
                        "createdAt": datetime.now(timezone.utc).isoformat()
                    }
                    inserted = db.notifications.insert_one(notif_doc)
                    notif_id_str = str(inserted.inserted_id)

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
                        "createdAt": notif_doc["createdAt"]
                    }

                    # Publish to RabbitMQ exchange events
                    publish_event("notification.created", event_payload)

                    # Trigger email ONLY if:
                    # 1. User has emailAlerts: true
                    # 2. Match score is >= 75%
                    # 3. User has received fewer than 5 emails in the rolling 24-hour window
                    if (
                        preferences.get("emailAlerts", True) and
                        final_score >= 0.75 and
                        can_send_email_to_user(db, user["_id"])
                    ):
                        now_email = datetime.now(timezone.utc).isoformat()
                        db.notifications.update_one(
                            {"_id": inserted.inserted_id},
                            {"$set": {"emailSent": True, "emailSentAt": now_email}}
                        )
                        from tasks.email_tasks import send_email
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

                    matches_count += 1
                else:
                    # Check if score improved
                    old_score = existing_notif.get("score", 0.0)
                    if final_score > old_score + 0.02:
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
                            from tasks.email_tasks import send_email
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

                        matches_count += 1

        return {"job_id": job_id, "matches_count": matches_count}

    except Exception as exc:
        logger.error(f"Error in match_job_to_users: {exc}")
        raise self.retry(exc=exc)
