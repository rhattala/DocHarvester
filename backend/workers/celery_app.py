from celery import Celery
from backend.config import settings

# Create Celery app
celery_app = Celery(
    "docharvester",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "backend.workers.ingest_tasks",
        "backend.workers.coverage_tasks",
        "backend.workers.generation_tasks",
        "backend.workers.wiki_tasks",
        "backend.workers.entity_extraction_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.worker_timeout_seconds,
    task_soft_time_limit=settings.worker_timeout_seconds - 30,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    # Set default queue
    task_default_queue='celery',
    task_default_routing_key='celery',
)

# Configure task routing
# Commenting out for now to use default queue
# celery_app.conf.task_routes = {
#     "backend.workers.ingest_tasks.*": {"queue": "ingest"},
#     "backend.workers.coverage_tasks.*": {"queue": "coverage"},
#     "backend.workers.generation_tasks.*": {"queue": "generation"},
#     "backend.workers.wiki_tasks.*": {"queue": "wiki"},
# }

# Configure periodic tasks
celery_app.conf.beat_schedule = {
    "check-coverage": {
        "task": "backend.workers.coverage_tasks.check_all_project_coverage",
        "schedule": 3600.0,  # Run every hour
    },
} 