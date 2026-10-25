import logging
import requests
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from celery_app import celery
from config import (
    EMAIL_PROVIDER,
    BREVO_API_KEY,
    RESEND_API_KEY,
    EMAIL_FROM,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
)

logger = logging.getLogger(__name__)

@celery.task(bind=True, max_retries=3, default_retry_delay=30, name="tasks.email_tasks.send_email")
def send_email(self, to_email: str, subject: str, body_html: str, notification_id: str = None):
    """
    Sends email via Google SMTP (smtplib), Brevo, Resend, or falls back to console.
    """
    logger.info(f"Processing email delivery to: {to_email} | Subject: '{subject}' | Provider: {EMAIL_PROVIDER}")

    # 1. Google SMTP via smtplib (Free, reliable, no 3rd party API)
    if EMAIL_PROVIDER == "smtp" and SMTP_HOST and SMTP_USER and SMTP_PASS:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = EMAIL_FROM
            msg["To"] = to_email

            part_html = MIMEText(body_html, "html", "utf-8")
            msg.attach(part_html)

            if SMTP_PORT == 465:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                    server.login(SMTP_USER, SMTP_PASS)
                    server.sendmail(SMTP_USER, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                    server.starttls()
                    server.login(SMTP_USER, SMTP_PASS)
                    server.sendmail(SMTP_USER, [to_email], msg.as_string())

            logger.info(f"[Google SMTP] Email successfully delivered to {to_email}")
            return {"status": "sent", "provider": "smtp", "to": to_email}
        except Exception as e:
            logger.error(f"[Google SMTP] Exception sending email to {to_email}: {e}")
            raise self.retry(exc=e)

    elif EMAIL_PROVIDER == "resend" and RESEND_API_KEY:
        try:
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": body_html,
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code in [200, 201]:
                logger.info(f"[Resend] Email successfully sent to {to_email}")
                return {"status": "sent", "provider": "resend", "id": resp.json().get("id")}
            else:
                logger.warning(f"[Resend] Failed with status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"[Resend] Exception sending email: {e}")

    elif EMAIL_PROVIDER == "brevo" and BREVO_API_KEY:
        try:
            url = "https://api.brevo.com/v3/smtp/email"
            headers = {
                "api-key": BREVO_API_KEY,
                "Content-Type": "application/json",
            }
            payload = {
                "sender": {"email": EMAIL_FROM, "name": "SmartJobs Alerts"},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": body_html,
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code in [200, 201]:
                logger.info(f"[Brevo] Email successfully sent to {to_email}")
                return {"status": "sent", "provider": "brevo", "id": resp.json().get("messageId")}
            else:
                logger.warning(f"[Brevo] Failed with status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"[Brevo] Exception sending email: {e}")

    # Fallback to console logger (free, demo-safe, always functional)
    logger.info("====================== [EMAIL SIMULATED / CONSOLE] ======================")
    logger.info(f"From: {EMAIL_FROM}")
    logger.info(f"To: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Body (Preview):\n{body_html[:300]}...")
    logger.info("=========================================================================")
    return {"status": "logged_to_console", "to": to_email}
