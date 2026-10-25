import os
from celery import Celery
from celery.schedules import crontab
from kombu import Exchange, Queue
from config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND, CRAWL_INTERVAL_MINUTES

celery = Celery(
    "smartjobs_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "tasks.crawler_tasks",
        "tasks.job_tasks",
        "tasks.resume_tasks",
        "tasks.notification_tasks",
        "tasks.email_tasks",
    ]
)

# Kombu exchanges and queues
events_exchange = Exchange("events", type="topic", durable=True)
default_exchange = Exchange("celery", type="direct", durable=True)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="celery",
    task_queues=(
        Queue("celery", default_exchange, routing_key="celery"),
    ),
    task_routes={
        "tasks.crawler_tasks.*": {"queue": "celery"},
        "tasks.job_tasks.*": {"queue": "celery"},
        "tasks.resume_tasks.*": {"queue": "celery"},
        "tasks.notification_tasks.*": {"queue": "celery"},
        "tasks.email_tasks.*": {"queue": "celery"},
    },
    beat_schedule={
        "crawl-sources-periodic": {
            "task": "tasks.crawler_tasks.crawl_sources",
            "schedule": crontab(minute=f"*/{CRAWL_INTERVAL_MINUTES}"),
        },
    },
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

if __name__ == "__main__":
    celery.start()
