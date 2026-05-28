import csv
import json
import zipfile
from datetime import date

from app.domain.enums import MediaType, SourcePlatform
from app.models import MediaItem, Rating, Review
from app.services.export_adapters import (
    ArchiveAdapter,
    FilmarksAdapter,
    GoodreadsAdapter,
    LetterboxdAdapter,
    RateYourMusicAdapter,
)


def media_item(
    media_type: MediaType,
    source_id: str,
    title: str,
    year: int,
    external_ids: dict[str, str] | None = None,
) -> MediaItem:
    item = MediaItem(
        media_type=media_type,
        source_platform=SourcePlatform.DOUBAN,
        source_id=source_id,
        titles={"en": title},
        year=year,
        consumed_date=date(2024, 1, 2),
        tags=["archive"],
        external_ids=external_ids or {},
    )
    item.rating = Rating(value=4.5, scale=5)
    item.review = Review(body="Preserved.")
    return item


def read_csv(path):
    return list(csv.DictReader(path.read_text(encoding="utf-8").splitlines()))


def test_letterboxd_adapter_renders_movie_csv(tmp_path):
    item = media_item(MediaType.MOVIE, "1291557", "In the Mood for Love", 2000)

    rows = read_csv(LetterboxdAdapter().render([item], tmp_path))

    assert rows == [
        {
            "Title": "In the Mood for Love",
            "Year": "2000",
            "Rating": "4.5",
            "WatchedDate": "2024-01-02",
            "Review": "Preserved.",
            "Tags": "archive",
        }
    ]


def test_filmarks_adapter_renders_movie_csv(tmp_path):
    item = media_item(MediaType.MOVIE, "1292052", "The Shawshank Redemption", 1994)

    rows = read_csv(FilmarksAdapter().render([item], tmp_path))

    assert rows == [
        {
            "title": "The Shawshank Redemption",
            "year": "1994",
            "rating": "4.5",
            "watched_date": "2024-01-02",
            "comment": "Preserved.",
        }
    ]


def test_goodreads_adapter_renders_book_csv(tmp_path):
    item = media_item(
        MediaType.BOOK,
        "2567698",
        "The Three-Body Problem",
        2008,
        {"author": "Liu Cixin", "isbn": "9787536692930"},
    )

    rows = read_csv(GoodreadsAdapter().render([item], tmp_path))

    assert rows == [
        {
            "Title": "The Three-Body Problem",
            "Author": "Liu Cixin",
            "My Rating": "4.5",
            "Date Read": "2024-01-02",
            "My Review": "Preserved.",
        }
    ]


def test_rateyourmusic_adapter_renders_music_csv(tmp_path):
    item = media_item(MediaType.MUSIC, "1394653", "OK Computer", 1997, {"artist": "Radiohead"})

    rows = read_csv(RateYourMusicAdapter().render([item], tmp_path))

    assert rows == [
        {
            "Artist": "Radiohead",
            "Release": "OK Computer",
            "Rating": "4.5",
            "Date": "2024-01-02",
            "Review": "Preserved.",
        }
    ]


def test_archive_adapter_renders_backup_zip(tmp_path):
    items = [
        media_item(MediaType.MOVIE, "1291557", "In the Mood for Love", 2000),
        media_item(MediaType.BOOK, "2567698", "The Three-Body Problem", 2008, {"author": "Liu Cixin"}),
        media_item(MediaType.MUSIC, "1394653", "OK Computer", 1997, {"artist": "Radiohead"}),
    ]

    path = ArchiveAdapter().render(items, tmp_path)

    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        canonical = json.loads(archive.read("canonical.json").decode("utf-8"))

    assert names == {
        "canonical.json",
        "markdown/1291557.md",
        "markdown/2567698.md",
        "markdown/1394653.md",
    }
    assert {record["source_id"] for record in canonical} == {"1291557", "2567698", "1394653"}
