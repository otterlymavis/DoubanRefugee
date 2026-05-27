import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.domain.enums import DestinationPlatform, ExportStatus, MatchConfidence, MediaType, SourcePlatform


class RatingPayload(BaseModel):
    value: float = Field(ge=0)
    scale: int = Field(default=5, gt=0)


class CanonicalMediaPayload(BaseModel):
    media_type: MediaType
    source_platform: SourcePlatform = SourcePlatform.DOUBAN
    source_id: str
    titles: dict[str, str] = Field(default_factory=dict)
    year: int | None = None
    rating: RatingPayload | None = None
    review: str | None = None
    consumed_date: date | None = None
    tags: list[str] = Field(default_factory=list)
    external_ids: dict[str, str] = Field(default_factory=dict)


class BrowserExtensionImportRequest(BaseModel):
    user_id: uuid.UUID | None = None
    items: list[CanonicalMediaPayload]
    source_profile: dict[str, Any] = Field(default_factory=dict)


class HtmlImportRequest(BaseModel):
    user_id: uuid.UUID | None = None
    media_type: MediaType = MediaType.MOVIE
    html: str


class ImportResponse(BaseModel):
    user_id: uuid.UUID
    snapshot_id: uuid.UUID
    imported_count: int


class MediaItemResponse(CanonicalMediaPayload):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchCandidateResponse(BaseModel):
    id: uuid.UUID
    media_item_id: uuid.UUID
    provider: str
    provider_id: str
    title: str
    year: int | None
    confidence: MatchConfidence
    score: float
    metadata: dict[str, Any]
    selected: bool

    model_config = {"from_attributes": True}


class RunMatchingRequest(BaseModel):
    user_id: uuid.UUID
    media_type: MediaType | None = None


class SelectCandidateRequest(BaseModel):
    user_id: uuid.UUID


class CreateExportRequest(BaseModel):
    user_id: uuid.UUID
    destination: DestinationPlatform
    media_type: MediaType | None = None


class ExportJobResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    destination: DestinationPlatform
    media_type: MediaType | None
    status: ExportStatus
    file_path: str | None
    error: str | None
    metadata: dict[str, Any] = Field(validation_alias="export_metadata")

    model_config = {"from_attributes": True}
