import dramatiq
from dramatiq.brokers.redis import RedisBroker

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.domain.enums import MediaType
from app.services.export_service import ExportService
from app.services.matching import MatchingService

broker = RedisBroker(url=get_settings().redis_url)
dramatiq.set_broker(broker)


@dramatiq.actor(max_retries=3)
def run_matching_job(user_id: str, media_type: str | None = None) -> None:
    with SessionLocal() as db:
        MatchingService(db).run_sync(user_id, MediaType(media_type) if media_type else None)


@dramatiq.actor(max_retries=3)
def run_export_job(job_id: str) -> None:
    with SessionLocal() as db:
        ExportService(db).run_job(job_id)
