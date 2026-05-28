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
      "source_url": "https://movie.douban.com/subject/1291557/",
      "collection_status": "completed",
      "titles": {
        "en": "In the Mood for Love"
      },
      "year": 2000,
      "release_date": "2000-09-29",
      "creators": ["Wong Kar-wai"],
      "countries": ["Hong Kong"],
      "rating": {
        "value": 4.5,
        "scale": 5
      },
      "review": "",
      "marked_date": "2024-01-02",
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
- `release_date`
- `creators`: directors, authors, musicians, or other people Douban exposes in
  the list-page intro.
- `countries`: movie production countries parsed from Douban list-page intros.
- `rating`
- `review`
- `collection_status`: `completed`, `watchlist`, or `watching`. Older imports
  that use `watched` are normalized to `completed`.
- `source_url`
- `poster_url`
- `marked_date`: when the user marked the item on Douban.
- `consumed_date`
- `tags`
- `external_ids`
