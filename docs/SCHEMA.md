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

## Account Backup JSON

Account backup files preserve non-media Douban account data such as statuses,
diaries/notes, reviews, posts, replies, albums/photos, doulists, profile/social
metadata, and events. New files use `entries`; the app still reads legacy
`statuses` files. The extension and web app can export one section at a time or
a combined whole-account backup that merges all supported entry types into the
same `entries` array.

```json
{
  "exported_at": "2026-05-28T12:00:00.000Z",
  "entries": [
    {
      "source_platform": "douban",
      "source_id": "123456789",
      "source_url": "https://www.douban.com/people/example/status/123456789/",
      "entry_type": "status",
      "status_type": "group/topic",
      "title": "",
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
      "comment_count": 1,
      "metadata": {
        "backup_run": {
          "user_id": "example",
          "selected_sections": ["status", "diary", "review", "post", "album", "doulist", "profile", "relationship", "event"],
          "start_page": 1,
          "end_page": 3,
          "scraped_pages": [
            {
              "section": "status",
              "page": 1,
              "url": "https://www.douban.com/people/example/statuses?p=1",
              "count": 12
            }
          ],
          "errors": ["event p1: HTTP 403"],
          "scraped_at": "2026-05-28T12:00:00.000Z"
        }
      }
    }
  ]
}
```

The web app can also import combined local backup files that include both
`items` and account-backup `entries`; each array is merged into the matching
local library.

`entry_type` may be `status`, `diary`, `review`, `post`, `reply`, `comment`,
`album`, `photo`, `doulist`, `profile`, `relationship`, `event`, `note`,
`topic`, or `unknown`. Entries may include `metadata.backup_run` with the
selected sections, page range, user id, scrape timestamp, scraped page list, and
per-page errors. The web app's JSON export also rolls these run details up into
`source_profile.backup_runs`, `source_profile.scraped_pages`, and
`source_profile.errors` so external importers can audit partial failures without
reading every entry. The web app can re-import this JSON, merge entries by
`entry_type/source_id`, and export a readable Markdown archive.

Account backup importers should read account data from top-level `entries` or
legacy `statuses` only. Top-level `items` is reserved for movie/book/music media
records.

## Notion Exports

The web and mobile apps can export `notion-douban-media.csv`, which Notion can
import as a database with columns for title, media type, collection status,
ratings, dates, creators, countries, review text, tags, Douban URL, poster URL,
and known external IDs.

The web app can export `notion-douban-account-backup.csv`, which Notion can
import as an account archive database with columns for title, entry type,
created time, author, activity, content, source URL, image URLs, card/topic
links, reshared content, comments, interaction counts, and JSON metadata.
Account Markdown exports can also be imported into Notion as pages.
