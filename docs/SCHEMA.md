# Database Schema

The persisted schema mirrors the canonical media model and keeps platform
specifics at the edge.

## Core Tables

- `users`: minimal user identity plus optional encrypted session payload.
- `backup_snapshots`: source import metadata and raw import audit envelope.
- `media_items`: canonical media record for movie, book, and music.
- `ratings`: normalized rating value and scale.
- `reviews`: user review text.
- `match_candidates`: provider results with confidence and score.
- `manual_mappings`: persisted user corrections.
- `export_jobs`: destination export state and artifact path.

## Canonical Record

```json
{
  "media_type": "movie",
  "source_platform": "douban",
  "source_id": "12345",
  "titles": {
    "zh": "",
    "en": "",
    "original": ""
  },
  "year": 2001,
  "rating": {
    "value": 4.5,
    "scale": 5
  },
  "review": "",
  "consumed_date": "",
  "external_ids": {
    "tmdb": "",
    "imdb": "",
    "openlibrary": "",
    "musicbrainz": ""
  }
}
```

## Migration Strategy

The SQLAlchemy models are the schema source of truth. For a production database:

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

The scaffold includes Alembic configuration and a placeholder first revision so
teams can switch from `create_all` development bootstrapping to audited
migrations before launch.

