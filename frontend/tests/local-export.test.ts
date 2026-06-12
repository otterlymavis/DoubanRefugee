import assert from "node:assert/strict";
import { type CanonicalMedia, mergeItems, parseJsonItems, renderExport } from "../src/lib/local-export";
import { mergeStatuses, parseStatusJson, renderStatusBackupJson, renderStatusMarkdown, renderStatusNotionCsv } from "../src/lib/status-backup";
import { scrapeDoubanAccountBackupPage } from "../src/lib/douban-scraper";

const realDoubanItems: CanonicalMedia[] = [
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1291557",
    collection_status: "completed",
    titles: { en: "In the Mood for Love" },
    year: 2000,
    release_date: "2000-09-29",
    countries: ["Hong Kong"],
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
    collection_status: "completed",
    titles: { en: "Days of Being Wild" },
    year: 1990,
    rating: { value: 4.5, scale: 5 },
    review: "Second real Douban movie fixture for movie-only exports.",
    consumed_date: "2024-02-12",
    tags: ["douban", "migration"],
    external_ids: {},
  },
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1308857",
    collection_status: "watchlist",
    titles: { en: "2046" },
    year: 2004,
    rating: null,
    marked_date: "2024-02-20",
    tags: ["douban", "watchlist"],
    external_ids: {},
  },
  {
    media_type: "book",
    source_platform: "douban",
    source_id: "2567698",
    collection_status: "completed",
    titles: { en: "The Three-Body Problem" },
    year: 2008,
    release_date: "2008",
    creators: ["Liu Cixin"],
    rating: { value: 5, scale: 5 },
    review: "Real Douban book fixture for Goodreads migration.",
    consumed_date: "2024-03-08",
    tags: ["douban", "sci-fi"],
    external_ids: { isbn: "9787536692930" },
  },
  {
    media_type: "book",
    source_platform: "douban",
    source_id: "1000001",
    collection_status: "watchlist",
    titles: { en: "Book on the wishlist" },
    year: 2020,
    release_date: "2020",
    creators: ["Wishlist Author"],
    rating: null,
    marked_date: "2024-03-10",
    tags: ["douban", "wishlist"],
    external_ids: {},
  },
  {
    media_type: "music",
    source_platform: "douban",
    source_id: "1394653",
    collection_status: "completed",
    titles: { en: "OK Computer" },
    year: 1997,
    release_date: "1997-05-21",
    creators: ["Radiohead"],
    rating: { value: 5, scale: 5 },
    review: "Real Douban music fixture for RateYourMusic migration.",
    consumed_date: "2024-03-09",
    tags: ["douban", "rock"],
    external_ids: { barcode: "0724385522925" },
  },
];

const imported = parseJsonItems(JSON.stringify({ items: realDoubanItems }));
const legacyImported = parseJsonItems(JSON.stringify({ items: [{ ...realDoubanItems[0], collection_status: "watched" }] }));
assert.equal(legacyImported[0].collection_status, "completed", "legacy watched status should import as completed");
const merged = mergeItems([realDoubanItems[0]], imported);

assert.equal(merged.length, 6, "backup imports should merge by Douban source id and status without duplicates");
assert.deepEqual(
  new Set(merged.map((item) => item.source_id)),
  new Set(["1291557", "1305690", "1308857", "2567698", "1000001", "1394653"]),
);

const letterboxd = renderExport(merged, "letterboxd", "movie");
assert.equal(letterboxd.filename, "letterboxd.csv");
assert.equal(letterboxd.content.split("\n")[0], "Title,Year,Rating,WatchedDate,Review,Tags");
assert.equal(rowCount(letterboxd.content), 2, "Letterboxd watched export should include only completed movies");
assertIncludes(letterboxd.content, "In the Mood for Love");
assertIncludes(letterboxd.content, "Days of Being Wild");
assertDoesNotInclude(letterboxd.content, "2046");
assertDoesNotInclude(letterboxd.content, "The Three-Body Problem");

const letterboxdWatchlist = renderExport(merged, "letterboxd-watchlist", "movie");
assert.equal(letterboxdWatchlist.filename, "letterboxd-watchlist.csv");
assert.equal(letterboxdWatchlist.content.split("\n")[0], "Title,Year,Tags");
assert.equal(rowCount(letterboxdWatchlist.content), 1, "Letterboxd watchlist export should include only wanted movies");
assertIncludes(letterboxdWatchlist.content, "2046");
assertDoesNotInclude(letterboxdWatchlist.content, "In the Mood for Love");

const filmarks = renderExport(merged, "filmarks", "movie");
assert.equal(filmarks.filename, "filmarks.csv");
assert.equal(filmarks.content.split("\n")[0], "title,year,rating,watched_date,comment");
assert.equal(rowCount(filmarks.content), 2, "Filmarks export should include only completed movies");
assertIncludes(filmarks.content, "In the Mood for Love");
assertIncludes(filmarks.content, "Days of Being Wild");
assertDoesNotInclude(filmarks.content, "2046");
assertDoesNotInclude(filmarks.content, "OK Computer");

const goodreads = renderExport(merged, "goodreads", "book");
assert.equal(goodreads.filename, "goodreads.csv");
assert.equal(goodreads.content.split("\n")[0], "Title,Author,My Rating,Date Read,My Review");
assert.equal(rowCount(goodreads.content), 1, "Goodreads export should include only completed books");
assertIncludes(goodreads.content, "The Three-Body Problem");
assertIncludes(goodreads.content, "Liu Cixin");
assertDoesNotInclude(goodreads.content, "Book on the wishlist");
assertDoesNotInclude(goodreads.content, "Days of Being Wild");

const rateYourMusic = renderExport(merged, "rateyourmusic", "music");
assert.equal(rateYourMusic.filename, "rateyourmusic.csv");
assert.equal(rateYourMusic.content.split("\n")[0], "Artist,Release,Rating,Date,Review");
assert.equal(rowCount(rateYourMusic.content), 1, "RateYourMusic export should include only completed music");
assertIncludes(rateYourMusic.content, "Radiohead");
assertIncludes(rateYourMusic.content, "OK Computer");
assertDoesNotInclude(rateYourMusic.content, "The Three-Body Problem");

const notionMedia = renderExport(merged, "notion");
assert.equal(notionMedia.filename, "notion-douban-media.csv");
assert.equal(
  notionMedia.content.split("\n")[0],
  "Name,Media Type,Collection Status,Rating,Rating Scale,Date,Year,Release Date,Creators,Countries,Review,Tags,Douban URL,Poster URL,IMDb,ISBN,Artist,Barcode",
);
assert.equal(rowCount(notionMedia.content), 6, "Notion media export should include the whole local media library");
assertIncludes(notionMedia.content, "In the Mood for Love");
assertIncludes(notionMedia.content, "The Three-Body Problem");
assertIncludes(notionMedia.content, "OK Computer");

const backup = renderExport(merged, "backup");
assert.equal(backup.filename, "douban-refugee-backup.json");
const parsedBackup = JSON.parse(backup.content) as { exported_at: string; items: CanonicalMedia[] };
assert.match(parsedBackup.exported_at, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(parsedBackup.items.length, 6);
assert.deepEqual(parsedBackup.items.find((item) => item.source_id === "1291557")?.countries, ["Hong Kong"]);
assert.deepEqual(parsedBackup.items.find((item) => item.source_id === "2567698")?.creators, ["Liu Cixin"]);
assert.deepEqual(
  new Set(parsedBackup.items.map((item) => `${item.media_type}:${item.source_id}`)),
  new Set(["movie:1291557", "movie:1305690", "movie:1308857", "book:2567698", "book:1000001", "music:1394653"]),
);

const statusBackup = parseStatusJson(JSON.stringify({
  statuses: [
    {
      source_platform: "douban",
      source_id: "status-1",
      source_url: "https://www.douban.com/people/example/status/1/",
      entry_type: "status",
      author: { name: "Example User", uid: "example", link: "https://www.douban.com/people/example/" },
      created_at: "2024-04-01 12:30",
      activity: "推荐",
      content: "A preserved Douban broadcast with an image, comments, and a card.",
      images: [{ url: "https://img.example/status.jpg", alt: "status image" }],
      card: { title: "Linked thing", url: "https://www.douban.com/example", description: "Attached recommendation card." },
      comments: [{ author: { name: "Friend" }, content: "Nice backup." }],
      like_count: 2,
      reshare_count: 1,
      comment_count: 1,
    },
    {
      source_platform: "douban",
      source_id: "note-2",
      source_url: "https://www.douban.com/note/2/",
      entry_type: "diary",
      title: "A preserved diary",
      author: { name: "Example User" },
      created_at: "2024-04-02 08:00",
      content: "A preserved diary/note with long-form text.",
    },
    {
      source_platform: "douban",
      source_id: "album-1",
      source_url: "https://www.douban.com/photos/album/1/",
      entry_type: "album",
      title: "A preserved album",
      author: { name: "Example User" },
      content: "Album description.",
      metadata: { image_count: 12 },
    },
  ],
}));
const mergedStatuses = mergeStatuses([statusBackup[0]], statusBackup);
assert.equal(mergedStatuses.length, 3, "account backup imports should merge by Douban id and type without duplicates");
const statusMarkdown = renderStatusMarkdown(mergedStatuses, "Example User");
assert.match(statusMarkdown.filename, /^douban-account-backup-example-user-\d{4}-\d{2}-\d{2}\.md$/);
assertIncludes(statusMarkdown.content, "Douban Account Backup - Example User");
assertIncludes(statusMarkdown.content, "A preserved Douban broadcast");
assertIncludes(statusMarkdown.content, "Responses:");
assertIncludes(statusMarkdown.content, "A preserved diary");
const statusJson = renderStatusBackupJson(mergedStatuses);
assert.equal(statusJson.filename, "douban-account-backup.json");
assert.equal(JSON.parse(statusJson.content).entries.length, 3);
assert.equal(JSON.parse(statusJson.content).statuses.length, 3);
const notionStatuses = renderStatusNotionCsv(mergedStatuses);
assert.equal(notionStatuses.filename, "notion-douban-account-backup.csv");
assert.equal(
  notionStatuses.content.split("\n")[0],
  "Name,Type,Created At,Author,Status Type,Activity,Content,Source URL,Images,Card,Topic,Reshared Content,Comments,Likes,Reshares,Responses,Metadata",
);
assertIncludes(notionStatuses.content, "A preserved Douban broadcast");
assertIncludes(notionStatuses.content, "Friend: Nice backup.");
assertIncludes(notionStatuses.content, "diary");

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  const fixtures: Record<string, string> = {
    discussion: `<div class="topic-list"><ul><li><a href="https://www.douban.com/group/topic/123456/">Preserved discussion post</a><span class="date">2024-05-01</span><p>Post excerpt text.</p></li></ul></div>`,
    photos: `<ul class="photolst"><li><a href="https://www.douban.com/photos/photo/222/">Photo title</a><img src="https://img.example/photo.jpg" alt="photo"><p>Photo caption.</p></li></ul>`,
    doulists: `<div class="doulist-item"><a href="https://www.douban.com/doulist/333/">Migration list</a><p>List description.</p></div>`,
    people: `<h1>Example User</h1><div class="user-intro">Profile bio.</div><img class="userface" src="https://img.example/avatar.jpg">`,
  };
  const body = url.includes("discussion")
    ? fixtures.discussion
    : url.includes("photos")
      ? fixtures.photos
      : url.includes("doulists")
        ? fixtures.doulists
        : fixtures.people;
  return new Response(`<html><body>${body}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
};
Promise.all([
  scrapeDoubanAccountBackupPage("https://www.douban.com/people/example/discussion?start=0"),
  scrapeDoubanAccountBackupPage("https://www.douban.com/people/example/photos?start=0"),
  scrapeDoubanAccountBackupPage("https://www.douban.com/people/example/doulists/all?start=0"),
  scrapeDoubanAccountBackupPage("https://www.douban.com/people/example/"),
]).then(([postScrape, photoScrape, doulistScrape, profileScrape]) => {
  globalThis.fetch = originalFetch;
  assert.equal(postScrape.entries.length, 1, "account backup scraper should capture discussion posts");
  assert.equal(postScrape.entries[0].entry_type, "post");
  assert.equal(postScrape.entries[0].source_id, "123456");
  assertIncludes(postScrape.entries[0].title || "", "Preserved discussion post");
  assert.equal(photoScrape.entries[0].entry_type, "photo");
  assert.equal(photoScrape.entries[0].images?.[0]?.url, "https://img.example/photo.jpg");
  assert.equal(doulistScrape.entries[0].entry_type, "doulist");
  assert.equal(doulistScrape.entries[0].source_id, "333");
  assert.equal(profileScrape.entries[0].entry_type, "profile");
  assertIncludes(profileScrape.entries[0].content, "Profile bio.");

  console.log("Local export tests passed for media transfer files, Notion CSVs, backup JSON, and Douban whole-account backups.");
});

function assertIncludes(content: string, expected: string) {
  assert.ok(content.includes(expected), `Expected export to include ${expected}`);
}

function assertDoesNotInclude(content: string, unexpected: string) {
  assert.ok(!content.includes(unexpected), `Expected export not to include ${unexpected}`);
}

function rowCount(content: string) {
  return content.split("\n").length - 1;
}
