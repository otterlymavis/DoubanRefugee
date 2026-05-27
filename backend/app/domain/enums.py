from enum import StrEnum


class MediaType(StrEnum):
    MOVIE = "movie"
    BOOK = "book"
    MUSIC = "music"


class SourcePlatform(StrEnum):
    DOUBAN = "douban"


class DestinationPlatform(StrEnum):
    LETTERBOXD = "letterboxd"
    FILMARKS = "filmarks"
    GOODREADS = "goodreads"
    RATEYOURMUSIC = "rateyourmusic"
    ARCHIVE = "archive"


class MatchConfidence(StrEnum):
    EXACT = "exact"
    HIGH = "high-confidence fuzzy"
    MEDIUM = "medium-confidence"
    REVIEW = "manual review required"


class ExportStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"

