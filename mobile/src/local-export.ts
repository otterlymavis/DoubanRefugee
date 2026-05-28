export type MediaType = "movie" | "book" | "music";
export type CollectionStatus = "completed" | "watchlist" | "watching" | "watched";
export type Destination = "letterboxd" | "letterboxd-watchlist" | "filmarks" | "goodreads" | "rateyourmusic" | "backup";

export type CanonicalMedia = {
  media_type: MediaType;
  source_platform: "douban";
  source_id: string;
  source_url?: string;
  poster_url?: string;
  collection_status?: CollectionStatus;
  titles: Record<string, string>;
  year?: number;
  release_date?: string | null;
  creators?: string[];
  countries?: string[];
  rating?: { value: number; scale: number } | null;
  review?: string | null;
  marked_date?: string | null;
  consumed_date?: string | null;
  tags?: string[];
  external_ids?: Record<string, string>;
};

export type ExportFile = {
  filename: string;
  content: string;
};

export function mergeItems(existing: CanonicalMedia[], incoming: CanonicalMedia[]) {
  const bySource = new Map(existing.map(normalizeItem).map((item) => [sourceKey(item), item]));
  for (const item of incoming) {
    bySource.set(sourceKey(item), normalizeItem(item));
  }
  return Array.from(bySource.values()).sort(compareMedia);
}

export function parseJsonItems(value: string): CanonicalMedia[] {
  const parsed = JSON.parse(value);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) {
    throw new Error("JSON must be an array of media items or an object with an items array.");
  }
  return items.map(normalizeItem);
}

export function renderExport(items: CanonicalMedia[], destination: Destination, mediaType?: MediaType): ExportFile {
  const scoped = scopedItems(items, destination, mediaType);
  if (scoped.length === 0) {
    throw new Error(`No ${mediaType || "media"} items available for this export.`);
  }

  switch (destination) {
    case "letterboxd":
      return csvFile("letterboxd.csv", ["Title", "Year", "Rating", "WatchedDate", "Review", "Tags"], scoped, (item) => [
        titleFor(item),
        item.year || "",
        ratingFor(item),
        item.consumed_date || "",
        item.review || "",
        (item.tags || []).join(", "),
      ]);
    case "letterboxd-watchlist":
      return csvFile("letterboxd-watchlist.csv", ["Title", "Year", "Tags"], scoped, (item) => [
        titleFor(item),
        item.year || "",
        (item.tags || []).join(", "),
      ]);
    case "filmarks":
      return csvFile("filmarks.csv", ["title", "year", "rating", "watched_date", "comment"], scoped, (item) => [
        titleFor(item),
        item.year || "",
        ratingFor(item),
        item.consumed_date || "",
        item.review || "",
      ]);
    case "goodreads":
      return csvFile("goodreads.csv", ["Title", "Author", "My Rating", "Date Read", "My Review"], scoped, (item) => [
        titleFor(item),
        creatorFor(item, "author"),
        ratingFor(item),
        item.consumed_date || "",
        item.review || "",
      ]);
    case "rateyourmusic":
      return csvFile("rateyourmusic.csv", ["Artist", "Release", "Rating", "Date", "Review"], scoped, (item) => [
        creatorFor(item, "artist"),
        titleFor(item),
        ratingFor(item),
        item.consumed_date || "",
        item.review || "",
      ]);
    case "backup":
      return {
        filename: "douban-refugee-backup.json",
        content: JSON.stringify({ exported_at: new Date().toISOString(), items: scoped }, null, 2),
      };
  }
}

function csvFile(
  filename: string,
  headers: string[],
  items: CanonicalMedia[],
  rowFor: (item: CanonicalMedia) => Array<string | number>,
): ExportFile {
  return {
    filename,
    content: [headers, ...items.map(rowFor)].map((row) => row.map(csvCell).join(",")).join("\n"),
  };
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeItem(item: CanonicalMedia): CanonicalMedia {
  if (!item.source_id || !item.media_type) {
    throw new Error("Every item needs source_id and media_type.");
  }
  return {
    media_type: item.media_type,
    source_platform: "douban",
    source_id: String(item.source_id),
    source_url: item.source_url || undefined,
    poster_url: item.poster_url || undefined,
    collection_status: normalizeCollectionStatus(item.collection_status),
    titles: item.titles || {},
    year: item.year,
    release_date: item.release_date || null,
    creators: item.creators || [],
    countries: item.countries || [],
    rating: item.rating || null,
    review: item.review || null,
    marked_date: item.marked_date || null,
    consumed_date: item.consumed_date || null,
    tags: item.tags || [],
    external_ids: item.external_ids || {},
  };
}

function sourceKey(item: CanonicalMedia) {
  return `${item.media_type}:${item.source_platform}:${item.source_id}:${item.collection_status || "item"}`;
}

function normalizeCollectionStatus(status: CanonicalMedia["collection_status"]) {
  return status === "watched" ? "completed" : status;
}

function compareMedia(a: CanonicalMedia, b: CanonicalMedia) {
  return dateForSort(b).localeCompare(dateForSort(a)) || sourceKey(a).localeCompare(sourceKey(b));
}

function dateForSort(item: CanonicalMedia) {
  return item.consumed_date || item.marked_date || item.release_date || "";
}

function titleFor(item: CanonicalMedia) {
  return item.titles.en || item.titles.original || item.titles.zh || item.source_id;
}

function ratingFor(item: CanonicalMedia) {
  return item.rating?.value ?? "";
}

function creatorFor(item: CanonicalMedia, fallbackKey: "artist" | "author") {
  return item.creators?.join(" / ") || item.external_ids?.[fallbackKey] || "";
}

function scopedItems(items: CanonicalMedia[], destination: Destination, mediaType?: MediaType) {
  const typed = mediaType ? items.filter((item) => item.media_type === mediaType) : items;
  if (destination === "backup") return typed;
  if (destination === "letterboxd-watchlist") {
    return typed.filter((item) => item.media_type === "movie" && item.collection_status === "watchlist");
  }
  return typed.filter((item) => item.collection_status !== "watchlist");
}
