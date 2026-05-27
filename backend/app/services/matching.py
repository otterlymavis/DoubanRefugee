import asyncio

from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app import models
from app.domain.enums import MatchConfidence, MediaType
from app.repositories import MatchRepository, MediaRepository
from app.services.normalization import normalize_text, title_variants
from app.services.providers import MetadataProvider, MusicBrainzProvider, OpenLibraryProvider, TMDbProvider


def confidence_for(score: float, exact: bool) -> MatchConfidence:
    if exact:
        return MatchConfidence.EXACT
    if score >= 88:
        return MatchConfidence.HIGH
    if score >= 72:
        return MatchConfidence.MEDIUM
    return MatchConfidence.REVIEW


class MatchingEngine:
    def __init__(self, providers: list[MetadataProvider] | None = None):
        self.providers = providers or [TMDbProvider(), OpenLibraryProvider(), MusicBrainzProvider()]

    async def candidates_for(self, item: models.MediaItem) -> list[models.MatchCandidate]:
        variants = title_variants(item.titles)
        if not variants:
            return []
        provider_results = []
        for provider in self.providers:
            for variant in variants:
                provider_results.extend(await provider.search(variant, item.year, item.media_type))

        candidates: list[models.MatchCandidate] = []
        source_norms = [normalize_text(title) for title in variants]
        for result in provider_results:
            result_title = result.get("title", "")
            result_norm = normalize_text(result_title)
            title_score = max((fuzz.token_set_ratio(source, result_norm) for source in source_norms), default=0)
            year_boost = 8 if item.year and result.get("year") == item.year else 0
            exact = title_score == 100 and (not item.year or result.get("year") == item.year)
            score = min(100, title_score + year_boost)
            candidates.append(
                models.MatchCandidate(
                    provider=result["provider"],
                    provider_id=str(result["provider_id"]),
                    title=result_title,
                    year=result.get("year"),
                    score=score,
                    confidence=confidence_for(score, exact),
                    provider_metadata=result.get("metadata", {}),
                    selected=exact,
                )
            )
        return sorted(candidates, key=lambda c: c.score, reverse=True)[:8]


class MatchingService:
    def __init__(self, db: Session):
        self.db = db
        self.media = MediaRepository(db)
        self.matches = MatchRepository(db)
        self.engine = MatchingEngine()

    async def run(self, user_id, media_type: MediaType | None = None) -> int:
        count = 0
        for item in self.media.list_items(user_id, media_type):
            candidates = await self.engine.candidates_for(item)
            self.matches.replace_candidates(item.id, candidates)
            count += len(candidates)
        self.db.commit()
        return count

    def run_sync(self, user_id, media_type: MediaType | None = None) -> int:
        return asyncio.run(self.run(user_id, media_type))
