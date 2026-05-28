# Migration Workflows

## Import and Backup

1. User imports Douban movie, book, or music history through the browser
   extension payload, mobile demo payload, pasted HTML, or uploaded HTML.
2. Backend stores a `BackupSnapshot` and normalized `MediaItem` rows.
3. `ArchiveAdapter` renders a backup ZIP containing `canonical.json` plus one
   Markdown file per item.

## Destination Exports

All destination exports read from the canonical media model:

- Movies to Letterboxd through `LetterboxdAdapter`.
- Movies to Filmarks through `FilmarksAdapter`.
- Books to Goodreads through `GoodreadsAdapter`.
- Music to RateYourMusic through `RateYourMusicAdapter`.
- All media to portable backup ZIP through `ArchiveAdapter`.

## Manual Review

1. User runs matching for the imported media type.
2. Provider candidates are ranked by exact title/year, alternate titles, fuzzy
   score, and metadata boosts.
3. Low-confidence rows appear in the review queue.
4. User selects the correct provider record.
5. Selection writes a `ManualMapping` so later exports can reuse the correction.
