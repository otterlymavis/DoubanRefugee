import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.domain.enums import DestinationPlatform, ExportStatus, MatchConfidence, MediaType, SourcePlatform


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email_hash: Mapped[str | None] = mapped_column(String(128), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(128))
    encrypted_session: Mapped[str | None] = mapped_column(Text)

    media_items: Mapped[list["MediaItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class BackupSnapshot(Base, TimestampMixin):
    __tablename__ = "backup_snapshots"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_platform: Mapped[SourcePlatform] = mapped_column(Enum(SourcePlatform), default=SourcePlatform.DOUBAN)
    import_method: Mapped[str] = mapped_column(String(64))
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    item_count: Mapped[int] = mapped_column(Integer, default=0)


class MediaItem(Base, TimestampMixin):
    __tablename__ = "media_items"
    __table_args__ = (UniqueConstraint("user_id", "source_platform", "source_id", "media_type", name="uq_source_media"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    backup_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("backup_snapshots.id", ondelete="SET NULL"))
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType), index=True)
    source_platform: Mapped[SourcePlatform] = mapped_column(Enum(SourcePlatform), default=SourcePlatform.DOUBAN)
    source_id: Mapped[str] = mapped_column(String(128), index=True)
    titles: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    year: Mapped[int | None] = mapped_column(Integer)
    consumed_date: Mapped[date | None] = mapped_column(Date)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    external_ids: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)

    user: Mapped[User] = relationship(back_populates="media_items")
    rating: Mapped["Rating | None"] = relationship(back_populates="media_item", cascade="all, delete-orphan")
    review: Mapped["Review | None"] = relationship(back_populates="media_item", cascade="all, delete-orphan")
    match_candidates: Mapped[list["MatchCandidate"]] = relationship(back_populates="media_item", cascade="all, delete-orphan")


class Rating(Base, TimestampMixin):
    __tablename__ = "ratings"

    id: Mapped[uuid.UUID] = uuid_pk()
    media_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_items.id", ondelete="CASCADE"), unique=True)
    value: Mapped[float] = mapped_column(Float)
    scale: Mapped[int] = mapped_column(Integer, default=5)

    media_item: Mapped[MediaItem] = relationship(back_populates="rating")


class Review(Base, TimestampMixin):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = uuid_pk()
    media_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_items.id", ondelete="CASCADE"), unique=True)
    body: Mapped[str] = mapped_column(Text)

    media_item: Mapped[MediaItem] = relationship(back_populates="review")


class MatchCandidate(Base, TimestampMixin):
    __tablename__ = "match_candidates"

    id: Mapped[uuid.UUID] = uuid_pk()
    media_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_items.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(64))
    provider_id: Mapped[str] = mapped_column(String(128))
    title: Mapped[str] = mapped_column(String(512))
    year: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[MatchConfidence] = mapped_column(Enum(MatchConfidence))
    score: Mapped[float] = mapped_column(Float)
    provider_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    selected: Mapped[bool] = mapped_column(default=False)

    media_item: Mapped[MediaItem] = relationship(back_populates="match_candidates")


class ManualMapping(Base, TimestampMixin):
    __tablename__ = "manual_mappings"
    __table_args__ = (UniqueConstraint("user_id", "media_type", "source_platform", "source_id", name="uq_manual_mapping"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType))
    source_platform: Mapped[SourcePlatform] = mapped_column(Enum(SourcePlatform))
    source_id: Mapped[str] = mapped_column(String(128))
    provider: Mapped[str] = mapped_column(String(64))
    provider_id: Mapped[str] = mapped_column(String(128))
    provider_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class ExportJob(Base, TimestampMixin):
    __tablename__ = "export_jobs"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    destination: Mapped[DestinationPlatform] = mapped_column(Enum(DestinationPlatform))
    media_type: Mapped[MediaType | None] = mapped_column(Enum(MediaType))
    status: Mapped[ExportStatus] = mapped_column(Enum(ExportStatus), default=ExportStatus.PENDING)
    file_path: Mapped[str | None] = mapped_column(String(1024))
    error: Mapped[str | None] = mapped_column(Text)
    export_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
