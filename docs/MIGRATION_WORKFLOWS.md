# Migration Workflows

## Phase 1: Douban Movies to Letterboxd

1. User exports Douban movie history through the browser extension payload.
2. Backend stores a `BackupSnapshot` and normalized `MediaItem` rows.
3. User runs matching. TMDb candidates are ranked by exact title/year,
   alternate titles, fuzzy score, and metadata boosts.
4. Low-confidence rows appear in the review queue.
5. `LetterboxdAdapter` renders a destination-compatible CSV.

## Phase 2: Manual Review

1. User inspects candidate matches.
2. User selects the correct provider record.
3. Selection writes a `ManualMapping`.
4. Later exports prefer the persisted correction.

## Phase 3: Books and Music

Books use Open Library candidates and `GoodreadsAdapter`.
Music uses MusicBrainz candidates and `RateYourMusicAdapter`.

## Phase 4: Additional Destinations

Filmarks and RateYourMusic remain destination adapters. The canonical schema,
matching engine, ingestion layer, and review queue do not need destination-aware
branches.

## Phase 5: Notion Sync and Local Backups

1. **Local Backups:** The canonical schema is exported to flat `JSON` and `CSV` bundles. These archives contain all metadata, tags, and reviews, allowing users to store a complete snapshot offline.
2. **Notion Sync:** A dedicated `NotionSyncAdapter` connects to the user's Notion API. It periodically pushes new or modified media items directly into their specified Notion databases, preserving rich properties like ratings, tags, and cover images.

