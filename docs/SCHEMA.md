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

## Status Backup JSON

Status backup files use a separate `statuses` array:

```json
{
  "exported_at": "2026-05-28T12:00:00.000Z",
  "statuses": [
    {
      "source_platform": "douban",
      "source_id": "123456789",
      "source_url": "https://www.douban.com/people/example/status/123456789/",
      "status_type": "group/topic",
      "author": {
        "name": "Example User",
        "uid": "example",
        "link": "https://www.douban.com/people/example/"
      },
      "created_at": "2024-04-01 12:30",
      "activity": "推荐",
      "rating": "",
      "content": "Broadcast text captured from Douban.",
      "images": [{ "url": "https://img.example/status.jpg", "alt": "image" }],
      "topic": { "title": "Topic title", "url": "https://www.douban.com/group/topic/123/" },
      "card": { "title": "Attached recommendation", "url": "https://www.douban.com/example" },
      "reshared_status": {
        "author": { "name": "Original Author" },
        "content": "Original broadcast text."
      },
      "comments": [{ "author": { "name": "Friend" }, "content": "Visible response text." }],
      "like_count": 2,
      "reshare_count": 1,
      "comment_count": 1
    }
  ]
}
```

The web app can re-import this JSON, merge statuses by `source_id`, and export a
readable Markdown archive.

## Notion Exports

The web and mobile apps can export `notion-douban-media.csv`, which Notion can
import as a database with columns for title, media type, collection status,
ratings, dates, creators, countries, review text, tags, Douban URL, poster URL,
and known external IDs.

The web app can export `notion-douban-statuses.csv`, which Notion can import as
a status database with columns for title, created time, author, type, activity,
content, source URL, image URLs, card/topic links, reshared content, comments,
and interaction counts. Status Markdown exports can also be imported into Notion
as pages.
