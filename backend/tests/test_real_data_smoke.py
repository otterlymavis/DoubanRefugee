import csv
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
            "external_ids": {"isbn": "9787536692930", "author": "刘慈欣"},
        },
    ],
}


def test_real_douban_payload_imports_lists_and_exports(tmp_path, monkeypatch):
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

    with TestClient(app) as client:
        import_response = client.post("/api/v1/imports/douban/browser-extension", json=REAL_DOUBAN_PAYLOAD)
        assert import_response.status_code == 200
        import_body = import_response.json()
        assert import_body["imported_count"] == 3

        user_id = import_body["user_id"]
        media_response = client.get("/api/v1/media", params={"user_id": user_id})
        assert media_response.status_code == 200
        media_items = media_response.json()
        assert {item["source_id"] for item in media_items} == {"1292052", "1291557", "2567698"}

        export_response = client.post(
            "/api/v1/exports",
            json={"user_id": user_id, "destination": "letterboxd", "media_type": "movie"},
        )
        assert export_response.status_code == 200
        export_body = export_response.json()
        assert export_body["status"] == "complete"

    csv_path = Path(export_body["file_path"])
    rows = list(csv.DictReader(csv_path.read_text(encoding="utf-8").splitlines()))
    assert [row["Title"] for row in rows] == ["In the Mood for Love", "The Shawshank Redemption"]
    assert [row["Rating"] for row in rows] == ["4.5", "5.0"]
