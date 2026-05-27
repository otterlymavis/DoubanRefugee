import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models
from app.domain.enums import ExportStatus, MediaType
from app.schemas import CanonicalMediaPayload


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, user_id: uuid.UUID | None = None) -> models.User:
        if user_id:
            user = self.db.get(models.User, user_id)
            if user:
                return user
        user = models.User()
        self.db.add(user)
        self.db.flush()
        return user

    def delete(self, user_id: uuid.UUID) -> None:
        user = self.db.get(models.User, user_id)
        if user:
            self.db.delete(user)


class MediaRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_snapshot(self, user_id: uuid.UUID, import_method: str, raw_payload: dict, item_count: int) -> models.BackupSnapshot:
        snapshot = models.BackupSnapshot(
            user_id=user_id,
            import_method=import_method,
            raw_payload=raw_payload,
            item_count=item_count,
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot

    def upsert_items(
        self,
        user_id: uuid.UUID,
        snapshot_id: uuid.UUID,
        items: Iterable[CanonicalMediaPayload],
    ) -> list[models.MediaItem]:
        stored: list[models.MediaItem] = []
        for payload in items:
            existing = self.db.scalar(
                select(models.MediaItem).where(
                    models.MediaItem.user_id == user_id,
                    models.MediaItem.source_platform == payload.source_platform,
                    models.MediaItem.source_id == payload.source_id,
                    models.MediaItem.media_type == payload.media_type,
                )
            )
            item = existing or models.MediaItem(
                user_id=user_id,
                source_platform=payload.source_platform,
                source_id=payload.source_id,
                media_type=payload.media_type,
            )
            item.backup_snapshot_id = snapshot_id
            item.titles = payload.titles
            item.year = payload.year
            item.consumed_date = payload.consumed_date
            item.tags = payload.tags
            item.external_ids = payload.external_ids
            self.db.add(item)
            self.db.flush()

            if payload.rating:
                item.rating = item.rating or models.Rating(media_item_id=item.id, value=payload.rating.value, scale=payload.rating.scale)
                item.rating.value = payload.rating.value
                item.rating.scale = payload.rating.scale
            if payload.review is not None:
                item.review = item.review or models.Review(media_item_id=item.id, body=payload.review)
                item.review.body = payload.review
            stored.append(item)
        return stored

    def list_items(self, user_id: uuid.UUID, media_type: MediaType | None = None) -> list[models.MediaItem]:
        stmt = (
            select(models.MediaItem)
            .options(selectinload(models.MediaItem.rating), selectinload(models.MediaItem.review))
            .where(models.MediaItem.user_id == user_id)
            .order_by(models.MediaItem.consumed_date.desc().nullslast(), models.MediaItem.created_at.desc())
        )
        if media_type:
            stmt = stmt.where(models.MediaItem.media_type == media_type)
        return list(self.db.scalars(stmt))


class MatchRepository:
    def __init__(self, db: Session):
        self.db = db

    def replace_candidates(self, media_item_id: uuid.UUID, candidates: list[models.MatchCandidate]) -> list[models.MatchCandidate]:
        existing = list(self.db.scalars(select(models.MatchCandidate).where(models.MatchCandidate.media_item_id == media_item_id)))
        for candidate in existing:
            self.db.delete(candidate)
        self.db.flush()
        for candidate in candidates:
            candidate.media_item_id = media_item_id
            self.db.add(candidate)
        self.db.flush()
        return candidates

    def review_queue(self, user_id: uuid.UUID) -> list[models.MatchCandidate]:
        stmt = (
            select(models.MatchCandidate)
            .join(models.MediaItem)
            .where(models.MediaItem.user_id == user_id, models.MatchCandidate.selected.is_(False))
            .order_by(models.MatchCandidate.score.desc())
        )
        return list(self.db.scalars(stmt))

    def select_candidate(self, candidate_id: uuid.UUID, user_id: uuid.UUID) -> models.MatchCandidate:
        candidate = self.db.scalar(
            select(models.MatchCandidate)
            .join(models.MediaItem)
            .where(models.MatchCandidate.id == candidate_id, models.MediaItem.user_id == user_id)
        )
        if candidate is None:
            raise ValueError("Candidate not found")
        siblings = self.db.scalars(select(models.MatchCandidate).where(models.MatchCandidate.media_item_id == candidate.media_item_id))
        for sibling in siblings:
            sibling.selected = sibling.id == candidate.id
        item = candidate.media_item
        mapping = models.ManualMapping(
            user_id=user_id,
            media_type=item.media_type,
            source_platform=item.source_platform,
            source_id=item.source_id,
            provider=candidate.provider,
            provider_id=candidate.provider_id,
            provider_metadata=candidate.provider_metadata,
        )
        self.db.merge(mapping)
        return candidate


class ExportRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: uuid.UUID, destination, media_type) -> models.ExportJob:
        job = models.ExportJob(user_id=user_id, destination=destination, media_type=media_type, status=ExportStatus.PENDING)
        self.db.add(job)
        self.db.flush()
        return job

    def get(self, job_id: uuid.UUID) -> models.ExportJob | None:
        return self.db.get(models.ExportJob, job_id)
