import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories import ExportRepository, MatchRepository, MediaRepository, UserRepository
from app.schemas import (
    BrowserExtensionImportRequest,
    CreateExportRequest,
    ExportJobResponse,
    HtmlImportRequest,
    ImportResponse,
    MatchCandidateResponse,
    MediaItemResponse,
    RunMatchingRequest,
    SelectCandidateRequest,
)
from app.services.export_service import ExportService
from app.services.import_service import ImportService
from app.services.matching import MatchingService

router = APIRouter(prefix="/api/v1")


@router.post("/imports/douban/browser-extension", response_model=ImportResponse)
def import_browser_extension(payload: BrowserExtensionImportRequest, db: Session = Depends(get_db)):
    return ImportService(db).import_browser_extension(payload)


@router.post("/imports/douban/html", response_model=ImportResponse)
def import_html(payload: HtmlImportRequest, db: Session = Depends(get_db)):
    return ImportService(db).import_html(payload)


@router.get("/media", response_model=list[MediaItemResponse])
def list_media(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return [
        {
            "id": item.id,
            "media_type": item.media_type,
            "source_platform": item.source_platform,
            "source_id": item.source_id,
            "titles": item.titles,
            "year": item.year,
            "rating": {"value": item.rating.value, "scale": item.rating.scale} if item.rating else None,
            "review": item.review.body if item.review else None,
            "consumed_date": item.consumed_date,
            "tags": item.tags,
            "external_ids": item.external_ids,
            "created_at": item.created_at,
        }
        for item in MediaRepository(db).list_items(user_id)
    ]


@router.post("/matching/run")
async def run_matching(payload: RunMatchingRequest, db: Session = Depends(get_db)):
    count = await MatchingService(db).run(payload.user_id, payload.media_type)
    return {"candidate_count": count}


@router.get("/review-queue", response_model=list[MatchCandidateResponse])
def review_queue(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return [
        {
            "id": candidate.id,
            "media_item_id": candidate.media_item_id,
            "provider": candidate.provider,
            "provider_id": candidate.provider_id,
            "title": candidate.title,
            "year": candidate.year,
            "confidence": candidate.confidence,
            "score": candidate.score,
            "metadata": candidate.provider_metadata,
            "selected": candidate.selected,
        }
        for candidate in MatchRepository(db).review_queue(user_id)
    ]


@router.post("/review-queue/{candidate_id}/select", response_model=MatchCandidateResponse)
def select_candidate(candidate_id: uuid.UUID, payload: SelectCandidateRequest, db: Session = Depends(get_db)):
    try:
        candidate = MatchRepository(db).select_candidate(candidate_id, payload.user_id)
        db.commit()
        return {
            "id": candidate.id,
            "media_item_id": candidate.media_item_id,
            "provider": candidate.provider,
            "provider_id": candidate.provider_id,
            "title": candidate.title,
            "year": candidate.year,
            "confidence": candidate.confidence,
            "score": candidate.score,
            "metadata": candidate.provider_metadata,
            "selected": candidate.selected,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/exports", response_model=ExportJobResponse)
def create_export(payload: CreateExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    job = service.create_job(payload)
    return service.run_job(job.id)


@router.get("/exports/{job_id}", response_model=ExportJobResponse)
def get_export(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = ExportRepository(db).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return job


@router.get("/exports/{job_id}/download")
def download_export(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = ExportRepository(db).get(job_id)
    if not job or not job.file_path:
        raise HTTPException(status_code=404, detail="Export file not found")
    path = Path(job.file_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="Export file expired")
    return FileResponse(path, filename=path.name)


@router.delete("/account")
def delete_account(user_id: uuid.UUID, db: Session = Depends(get_db)):
    UserRepository(db).delete(user_id)
    db.commit()
    return {"deleted": True}
