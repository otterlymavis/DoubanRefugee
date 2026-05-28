# Canonical JSON Schema

The app stores and exports an array of canonical media records. Backup files use
this shape:

```json
{
  "exported_at": "2026-05-28T12:00:00.000Z",
  "items": [
    {
      "media_type": "movie",
      "source_platform": "douban",
      "source_id": "1291557",
      "titles": {
        "zh": "花样年华",
        "en": "In the Mood for Love",
        "original": "花樣年華"
      },
      "year": 2000,
      "rating": {
        "value": 4.5,
        "scale": 5
      },
      "review": "",
      "consumed_date": "2024-01-02",
      "tags": ["douban"],
      "external_ids": {
        "imdb": "tt0118694",
        "isbn": "",
        "artist": ""
      }
    }
  ]
}
```

Required fields:

- `media_type`: `movie`, `book`, or `music`.
- `source_platform`: currently `douban`.
- `source_id`: Douban subject ID.
- `titles`: object containing any known title variants.

Optional fields:

- `year`
- `rating`
- `review`
- `consumed_date`
- `tags`
- `external_ids`
