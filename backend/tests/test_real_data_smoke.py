import csv
import json
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import main
from app.api import routes
from app.core.config import get_settings
from app.db.session import Base


REAL_DOUBAN_PAYLOAD = {
    "source_profile": {
        "source": "public Douban subject pages",
        "fixture": "real-data-smoke",
    },
    "items": [
        {
            "media_type": "movie",
            "source_platform": "douban",
            "source_id": "1292052",
            "titles": {"zh": "肖申克的救赎", "en": "The Shawshank Redemption"},
            "year": 1994,
            "rating": {"value": 5, "scale": 5},
            "review": "Hope is a good thing.",
            "consumed_date": "2024-04-01",
            "tags": ["top250", "drama"],
            "external_ids": {"imdb": "tt0111161"},
        },
        {
            "media_type": "movie",
            "source_platform": "douban",
            "source_id": "1291557",
            "titles": {"zh": "花样年华", "en": "In the Mood for Love"},
            "year": 2000,
            "rating": {"value": 4.5, "scale": 5},
            "review": "A preserved migration note.",
            "consumed_date": "2024-04-02",
            "tags": ["hong-kong", "romance"],
            "external_ids": {"imdb": "tt0118694"},
        },
        {
            "media_type": "book",
            "source_platform": "douban",
            "source_id": "2567698",
            "titles": {"zh": "三体", "en": "The Three-Body Problem"},
            "year": 2008,
            "rating": {"value": 5, "scale": 5},
            "review": "Book record kept in the same canonical payload.",
            "consumed_date": "2024-04-03",
            "tags": ["sci-fi"],
            "external_ids": {"isbn": "9787536692930", "author": "Liu Cixin"},
        },
        {
            "media_type": "music",
            "source_platform": "douban",
            "source_id": "1394653",
            "titles": {"en": "OK Computer"},
            "year": 1997,
            "rating": {"value": 5, "scale": 5},
            "review": "Music record kept for RateYourMusic export.",
            "consumed_date": "2024-04-04",
            "tags": ["rock"],
            "external_ids": {"artist": "Radiohead", "barcode": "0724385522925"},
        },
    ],
}


def read_csv(path: Path):
    return list(csv.DictReader(path.read_text(encoding="utf-8").splitlines()))


def create_test_app(tmp_path, monkeypatch):
    database_path = tmp_path / "real_data_smoke.db"
    export_dir = tmp_path / "exports"
    engine = create_engine(f"sqlite:///{database_path}", pool_pre_ping=True)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    get_settings.cache_clear()
    monkeypatch.setenv("EXPORT_STORAGE_DIR", str(export_dir))
    monkeypatch.setattr(main, "engine", engine)

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    app = main.create_app()
    app.dependency_overrides[routes.get_db] = override_get_db
    return app


def create_export(client: TestClient, user_id: str, destination: str, media_type: str | None = None):
    response = client.post(
        "/api/v1/exports",
        json={"user_id": user_id, "destination": destination, "media_type": media_type},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "complete"
    assert body["metadata"]["item_count"] > 0
    return Path(body["file_path"])


def test_real_douban_payload_imports_lists_exports_and_backs_up(tmp_path, monkeypatch):
    app = create_test_app(tmp_path, monkeypatch)

    with TestClient(app) as client:
        import_response = client.post("/api/v1/imports/douban/browser-extension", json=REAL_DOUBAN_PAYLOAD)
        assert import_response.status_code == 200
        import_body = import_response.json()
        assert import_body["imported_count"] == 4

        user_id = import_body["user_id"]
        media_response = client.get("/api/v1/media", params={"user_id": user_id})
        assert media_response.status_code == 200
        media_items = media_response.json()
        assert {item["source_id"] for item in media_items} == {"1292052", "1291557", "2567698", "1394653"}

        letterboxd_path = create_export(client, user_id, "letterboxd", "movie")
        filmarks_path = create_export(client, user_id, "filmarks", "movie")
        goodreads_path = create_export(client, user_id, "goodreads", "book")
        rateyourmusic_path = create_export(client, user_id, "rateyourmusic", "music")
        archive_path = create_export(client, user_id, "archive")

    letterboxd_rows = read_csv(letterboxd_path)
    assert [row["Title"] for row in letterboxd_rows] == ["In the Mood for Love", "The Shawshank Redemption"]

    filmarks_rows = read_csv(filmarks_path)
    assert [row["title"] for row in filmarks_rows] == ["In the Mood for Love", "The Shawshank Redemption"]

    goodreads_rows = read_csv(goodreads_path)
    assert goodreads_rows == [
        {
            "Title": "The Three-Body Problem",
            "Author": "Liu Cixin",
            "My Rating": "5.0",
            "Date Read": "2024-04-03",
            "My Review": "Book record kept in the same canonical payload.",
        }
    ]

    rateyourmusic_rows = read_csv(rateyourmusic_path)
    assert rateyourmusic_rows == [
        {
            "Artist": "Radiohead",
            "Release": "OK Computer",
            "Rating": "5.0",
            "Date": "2024-04-04",
            "Review": "Music record kept for RateYourMusic export.",
        }
    ]

    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        canonical = json.loads(archive.read("canonical.json").decode("utf-8"))

    assert "canonical.json" in names
    assert {"markdown/1292052.md", "markdown/1291557.md", "markdown/2567698.md", "markdown/1394653.md"} <= names
    assert {record["source_id"] for record in canonical} == {"1292052", "1291557", "2567698", "1394653"}
