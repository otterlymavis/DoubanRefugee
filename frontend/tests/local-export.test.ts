import assert from "node:assert/strict";
import { type CanonicalMedia, mergeItems, parseJsonItems, renderExport } from "../src/lib/local-export";

const realDoubanItems: CanonicalMedia[] = [
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1291557",
    titles: { en: "In the Mood for Love" },
    year: 2000,
    rating: { value: 5, scale: 5 },
    review: "Real Douban movie fixture with IMDb mapping.",
    consumed_date: "2024-01-02",
    tags: ["douban", "wong-kar-wai"],
    external_ids: { imdb: "tt0118694" },
  },
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1305690",
    titles: { en: "Days of Being Wild" },
    year: 1990,
    rating: { value: 4.5, scale: 5 },
    review: "Second real Douban movie fixture for movie-only exports.",
    consumed_date: "2024-02-12",
    tags: ["douban", "migration"],
    external_ids: {},
  },
  {
    media_type: "book",
    source_platform: "douban",
    source_id: "2567698",
    titles: { en: "The Three-Body Problem" },
    year: 2008,
    rating: { value: 5, scale: 5 },
    review: "Real Douban book fixture for Goodreads migration.",
    consumed_date: "2024-03-08",
    tags: ["douban", "sci-fi"],
    external_ids: { isbn: "9787536692930", author: "Liu Cixin" },
  },
  {
    media_type: "music",
    source_platform: "douban",
    source_id: "1394653",
    titles: { en: "OK Computer" },
    year: 1997,
    rating: { value: 5, scale: 5 },
    review: "Real Douban music fixture for RateYourMusic migration.",
    consumed_date: "2024-03-09",
    tags: ["douban", "rock"],
    external_ids: { artist: "Radiohead", barcode: "0724385522925" },
  },
];

const imported = parseJsonItems(JSON.stringify({ items: realDoubanItems }));
const merged = mergeItems([realDoubanItems[0]], imported);

assert.equal(merged.length, 4, "backup imports should merge by Douban source id without duplicates");
assert.deepEqual(
  new Set(merged.map((item) => item.source_id)),
  new Set(["1291557", "1305690", "2567698", "1394653"]),
);

const letterboxd = renderExport(merged, "letterboxd", "movie");
assert.equal(letterboxd.filename, "letterboxd.csv");
assert.equal(letterboxd.content.split("\n")[0], "Title,Year,Rating,WatchedDate,Review,Tags");
assertIncludes(letterboxd.content, "In the Mood for Love");
assertIncludes(letterboxd.content, "Days of Being Wild");
assertDoesNotInclude(letterboxd.content, "The Three-Body Problem");

const filmarks = renderExport(merged, "filmarks", "movie");
assert.equal(filmarks.filename, "filmarks.csv");
assert.equal(filmarks.content.split("\n")[0], "title,year,rating,watched_date,comment");
assertIncludes(filmarks.content, "In the Mood for Love");
assertIncludes(filmarks.content, "Days of Being Wild");
assertDoesNotInclude(filmarks.content, "OK Computer");

const goodreads = renderExport(merged, "goodreads", "book");
assert.equal(goodreads.filename, "goodreads.csv");
assert.equal(goodreads.content.split("\n")[0], "Title,Author,My Rating,Date Read,My Review");
assertIncludes(goodreads.content, "The Three-Body Problem");
assertIncludes(goodreads.content, "Liu Cixin");
assertDoesNotInclude(goodreads.content, "Days of Being Wild");

const rateYourMusic = renderExport(merged, "rateyourmusic", "music");
assert.equal(rateYourMusic.filename, "rateyourmusic.csv");
assert.equal(rateYourMusic.content.split("\n")[0], "Artist,Release,Rating,Date,Review");
assertIncludes(rateYourMusic.content, "Radiohead");
assertIncludes(rateYourMusic.content, "OK Computer");
assertDoesNotInclude(rateYourMusic.content, "The Three-Body Problem");

const backup = renderExport(merged, "backup");
assert.equal(backup.filename, "douban-refugee-backup.json");
const parsedBackup = JSON.parse(backup.content) as { exported_at: string; items: CanonicalMedia[] };
assert.match(parsedBackup.exported_at, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(parsedBackup.items.length, 4);
assert.deepEqual(
  new Set(parsedBackup.items.map((item) => `${item.media_type}:${item.source_id}`)),
  new Set(["movie:1291557", "movie:1305690", "book:2567698", "music:1394653"]),
);

console.log("Local export tests passed for Letterboxd, Filmarks, Goodreads, RateYourMusic, and backup JSON.");

function assertIncludes(content: string, expected: string) {
  assert.ok(content.includes(expected), `Expected export to include ${expected}`);
}

function assertDoesNotInclude(content: string, unexpected: string) {
  assert.ok(!content.includes(unexpected), `Expected export not to include ${unexpected}`);
}
