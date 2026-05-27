import csv
import json
import zipfile
from abc import ABC, abstractmethod
from pathlib import Path

from app import models
from app.domain.enums import DestinationPlatform


class ExportAdapter(ABC):
    destination: DestinationPlatform

    @abstractmethod
    def render(self, items: list[models.MediaItem], output_dir: Path) -> Path:
        raise NotImplementedError

    def validate(self, path: Path) -> None:
        if not path.exists() or path.stat().st_size == 0:
            raise ValueError(f"Export output is empty: {path}")


class LetterboxdAdapter(ExportAdapter):
    destination = DestinationPlatform.LETTERBOXD

    def render(self, items: list[models.MediaItem], output_dir: Path) -> Path:
        path = output_dir / "letterboxd.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["Title", "Year", "Rating", "WatchedDate", "Review", "Tags"])
            writer.writeheader()
            for item in items:
                writer.writerow(
                    {
                        "Title": item.titles.get("en") or item.titles.get("original") or item.titles.get("zh") or "",
                        "Year": item.year or "",
                        "Rating": item.rating.value if item.rating else "",
                        "WatchedDate": item.consumed_date.isoformat() if item.consumed_date else "",
                        "Review": item.review.body if item.review else "",
                        "Tags": ", ".join(item.tags),
                    }
                )
        self.validate(path)
        return path


class GoodreadsAdapter(ExportAdapter):
    destination = DestinationPlatform.GOODREADS

    def render(self, items: list[models.MediaItem], output_dir: Path) -> Path:
        path = output_dir / "goodreads.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["Title", "Author", "My Rating", "Date Read", "My Review"])
            writer.writeheader()
            for item in items:
                writer.writerow(
                    {
                        "Title": item.titles.get("en") or item.titles.get("original") or item.titles.get("zh") or "",
                        "Author": item.external_ids.get("author", ""),
                        "My Rating": item.rating.value if item.rating else "",
                        "Date Read": item.consumed_date.isoformat() if item.consumed_date else "",
                        "My Review": item.review.body if item.review else "",
                    }
                )
        self.validate(path)
        return path


class FilmarksAdapter(ExportAdapter):
    destination = DestinationPlatform.FILMARKS

    def render(self, items: list[models.MediaItem], output_dir: Path) -> Path:
        path = output_dir / "filmarks.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["title", "year", "rating", "watched_date", "comment"])
            writer.writeheader()
            for item in items:
                writer.writerow(
                    {
                        "title": item.titles.get("original") or item.titles.get("en") or item.titles.get("zh") or "",
                        "year": item.year or "",
                        "rating": item.rating.value if item.rating else "",
                        "watched_date": item.consumed_date.isoformat() if item.consumed_date else "",
                        "comment": item.review.body if item.review else "",
                    }
                )
        self.validate(path)
        return path


class RateYourMusicAdapter(ExportAdapter):
    destination = DestinationPlatform.RATEYOURMUSIC

    def render(self, items: list[models.MediaItem], output_dir: Path) -> Path:
        path = output_dir / "rateyourmusic.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["Artist", "Release", "Rating", "Date", "Review"])
            writer.writeheader()
            for item in items:
                writer.writerow(
                    {
                        "Artist": item.external_ids.get("artist", ""),
                        "Release": item.titles.get("original") or item.titles.get("en") or item.titles.get("zh") or "",
                        "Rating": item.rating.value if item.rating else "",
                        "Date": item.consumed_date.isoformat() if item.consumed_date else "",
                        "Review": item.review.body if item.review else "",
                    }
                )
        self.validate(path)
        return path


class ArchiveAdapter(ExportAdapter):
    destination = DestinationPlatform.ARCHIVE

    def render(self, items: list[models.MediaItem], output_dir: Path) -> Path:
        json_path = output_dir / "canonical.json"
        markdown_dir = output_dir / "markdown"
        markdown_dir.mkdir(parents=True, exist_ok=True)
        payload = []
        for item in items:
            record = {
                "media_type": item.media_type,
                "source_platform": item.source_platform,
                "source_id": item.source_id,
                "titles": item.titles,
                "year": item.year,
                "rating": {"value": item.rating.value, "scale": item.rating.scale} if item.rating else None,
                "review": item.review.body if item.review else "",
                "consumed_date": item.consumed_date.isoformat() if item.consumed_date else None,
                "tags": item.tags,
                "external_ids": item.external_ids,
            }
            payload.append(record)
            title = item.titles.get("en") or item.titles.get("zh") or item.source_id
            (markdown_dir / f"{item.source_id}.md").write_text(
                f"# {title}\n\n- Type: {item.media_type}\n- Year: {item.year or ''}\n- Rating: {record['rating'] or ''}\n\n{record['review']}\n",
                encoding="utf-8",
            )
        json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        zip_path = output_dir / "douban-refugee-archive.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(json_path, json_path.name)
            for md in markdown_dir.glob("*.md"):
                archive.write(md, f"markdown/{md.name}")
        self.validate(zip_path)
        return zip_path


ADAPTERS: dict[DestinationPlatform, type[ExportAdapter]] = {
    DestinationPlatform.LETTERBOXD: LetterboxdAdapter,
    DestinationPlatform.GOODREADS: GoodreadsAdapter,
    DestinationPlatform.FILMARKS: FilmarksAdapter,
    DestinationPlatform.RATEYOURMUSIC: RateYourMusicAdapter,
    DestinationPlatform.ARCHIVE: ArchiveAdapter,
}

