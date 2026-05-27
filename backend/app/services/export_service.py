import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.domain.enums import ExportStatus
from app.repositories import ExportRepository, MediaRepository
from app.schemas import CreateExportRequest
from app.services.export_adapters import ADAPTERS


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.exports = ExportRepository(db)
        self.media = MediaRepository(db)

    def create_job(self, request: CreateExportRequest):
        job = self.exports.create(request.user_id, request.destination, request.media_type)
        self.db.commit()
        return job

    def run_job(self, job_id: uuid.UUID):
        job = self.exports.get(job_id)
        if job is None:
            raise ValueError("Export job not found")
        try:
            job.status = ExportStatus.RUNNING
            self.db.flush()
            items = self.media.list_items(job.user_id, job.media_type)
            output_dir = Path(get_settings().export_storage_dir) / str(job.id)
            output_dir.mkdir(parents=True, exist_ok=True)
            adapter = ADAPTERS[job.destination]()
            path = adapter.render(items, output_dir)
            job.file_path = str(path)
            job.status = ExportStatus.COMPLETE
            job.export_metadata = {"item_count": len(items)}
        except Exception as exc:
            job.status = ExportStatus.FAILED
            job.error = str(exc)
        self.db.commit()
        return job
