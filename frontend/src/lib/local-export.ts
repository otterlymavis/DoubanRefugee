export type MediaType = "movie" | "book" | "music";
export type CollectionStatus = "completed" | "watchlist" | "watching" | "watched";
export type Destination = "letterboxd" | "letterboxd-watchlist" | "filmarks" | "goodreads" | "rateyourmusic" | "notion" | "backup";

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
  mimeType: string;
  content: string;
};

export const STORAGE_KEY = "douban-refugee.local-library";

export const demoItems: CanonicalMedia[] = [
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
    review: "A preserved sample entry from the local wizard.",
    consumed_date: "2024-01-02",
    tags: ["douban", "migration"],
    external_ids: { imdb: "tt0118694" },
  },
  {
    media_type: "movie",
    source_platform: "douban",
    source_id: "1305690",
    collection_status: "watchlist",
    titles: { en: "Days of Being Wild" },
    year: 1990,
    rating: null,
    marked_date: "2024-02-12",
    tags: ["douban-watchlist"],
    external_ids: {},
  },
  {
    media_type: "book",
    source_platform: "douban",
    source_id: "2567698",
    titles: { en: "The Three-Body Problem" },
    year: 2008,
    release_date: "2008",
    creators: ["Liu Cixin"],
    rating: { value: 5, scale: 5 },
    review: "A preserved book entry for Goodreads migration.",
    consumed_date: "2024-03-08",
    tags: ["book", "sci-fi"],
    external_ids: { isbn: "9787536692930", author: "Liu Cixin" },
  },
  {
    media_type: "music",
    source_platform: "douban",
    source_id: "1394653",
    titles: { en: "OK Computer" },
    year: 1997,
    release_date: "1997-05-21",
    creators: ["Radiohead"],
    rating: { value: 5, scale: 5 },
    review: "A preserved music entry for RateYourMusic migration.",
    consumed_date: "2024-03-09",
    tags: ["music", "rock"],
    external_ids: { artist: "Radiohead", barcode: "0724385522925" },
  },
];

export function loadLibrary(): CanonicalMedia[] {
  if (typeof window === "undefined") return [];
  return parseJsonItems(window.localStorage.getItem(STORAGE_KEY) || "[]");
}

export function saveLibrary(items: CanonicalMedia[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

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

export function parseDoubanHtml(html: string, mediaType: MediaType): CanonicalMedia[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const nodes = Array.from(document.querySelectorAll(".item, .doulist-item, li.subject-item, .grid-view li, .item-root, .article li"));
  const items: CanonicalMedia[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const anchor = node.querySelector<HTMLAnchorElement>("a[href*='douban.com/subject/'], a[href*='/subject/']");
    if (!anchor) continue;
    const sourceId = subjectIdFromUrl(anchor.href);
    if (!sourceId || seen.has(sourceId)) continue;

    const titleNode = node.querySelector(".title a, .title, h2, a") || anchor;
    const title = compact(titleNode.textContent || "").replace(/\s*\((19|20)\d{2}\)\s*$/, "");
    if (!title) continue;

    seen.add(sourceId);
    items.push(
      compactItem({
        media_type: mediaType,
        source_platform: "douban",
        source_id: sourceId,
        titles: { zh: title },
        year: parseYear(node.textContent || ""),
        ...parseIntroMetadata(node, mediaType),
        rating: parseRating(node),
        review: compact(node.querySelector(".comment, .short, .review-short, blockquote")?.textContent || "") || undefined,
        consumed_date: parseConsumedDate(node.textContent || ""),
        tags: ["douban-html"],
        external_ids: parseExternalIds(node.textContent || ""),
      }),
    );
  }

  return items;
}

export function renderExport(items: CanonicalMedia[], destination: Destination, mediaType?: MediaType, includeReviews = true): ExportFile {
  const scoped = scopedItems(items, destination, mediaType);
  if (scoped.length === 0) {
    throw new Error(`No ${mediaType || "media"} items available for this export.`);
  }

  const review = (item: CanonicalMedia) => (includeReviews ? item.review || "" : "");

  switch (destination) {
    case "letterboxd":
      return csvFile("letterboxd.csv", ["Title", "Year", "Rating", "WatchedDate", "Review", "Tags"], scoped, (item) => [
        titleFor(item),
        item.year || "",
        ratingFor(item),
        item.consumed_date || "",
        review(item),
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
        review(item),
      ]);
    case "goodreads":
      return csvFile("goodreads.csv", ["Title", "Author", "My Rating", "Date Read", "My Review"], scoped, (item) => [
        titleFor(item),
        creatorFor(item, "author"),
        ratingFor(item),
        item.consumed_date || "",
        review(item),
      ]);
    case "rateyourmusic":
      return csvFile("rateyourmusic.csv", ["Artist", "Release", "Rating", "Date", "Review"], scoped, (item) => [
        creatorFor(item, "artist"),
        titleFor(item),
        ratingFor(item),
        item.consumed_date || "",
        review(item),
      ]);
    case "notion":
      return csvFile(
        "notion-douban-media.csv",
        [
          "Name", "Media Type", "Collection Status", "Rating", "Rating Scale",
          "Date", "Year", "Release Date", "Creators", "Countries",
          "Review", "Tags", "Douban URL", "Poster URL", "IMDb", "ISBN", "Artist", "Barcode",
        ],
        scoped,
        (item) => [
          titleFor(item),
          item.media_type,
          item.collection_status || "",
          item.rating?.value || "",
          item.rating?.scale || "",
          item.consumed_date || item.marked_date || "",
          item.year || "",
          item.release_date || "",
          (item.creators || []).join(" / "),
          (item.countries || []).join(" / "),
          review(item),
          (item.tags || []).join(", "),
          item.source_url || "",
          item.poster_url || "",
          item.external_ids?.imdb || "",
          item.external_ids?.isbn || "",
          item.external_ids?.artist || "",
          item.external_ids?.barcode || "",
        ],
      );
    case "backup":
      return {
        filename: "douban-refugee-backup.json",
        mimeType: "application/json;charset=utf-8",
        content: JSON.stringify({ exported_at: new Date().toISOString(), items: scoped }, null, 2),
      };
  }
}

export function downloadFile(file: ExportFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvFile(
  filename: string,
  headers: string[],
  items: CanonicalMedia[],
  rowFor: (item: CanonicalMedia) => Array<string | number>,
): ExportFile {
  return {
    filename,
    mimeType: "text/csv;charset=utf-8",
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
  return compactItem({
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
  });
}

function compactItem(item: CanonicalMedia): CanonicalMedia {
  return JSON.parse(JSON.stringify(item)) as CanonicalMedia;
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
  if (destination === "backup" || destination === "notion") return typed;
  if (destination === "letterboxd-watchlist") {
    return typed.filter((item) => item.media_type === "movie" && item.collection_status === "watchlist");
  }
  return typed.filter((item) => item.collection_status !== "watchlist");
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function subjectIdFromUrl(url: string) {
  return url.match(/\/subject\/(\d+)\/?/)?.[1] || "";
}

function parseYear(text: string) {
  const match = compact(text).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function parseConsumedDate(text: string) {
  const match = compact(text).match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parsePartialDate(text: string) {
  const normalized = compact(text).replace(/\//g, "-");
  const fullDate = parseConsumedDate(normalized);
  if (fullDate) return fullDate;
  const yearMonth = normalized.match(/\b((?:19|20)\d{2})-(\d{1,2})\b/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2].padStart(2, "0")}`;
  const year = normalized.match(/\b(19|20)\d{2}\b/);
  return year ? year[0] : "";
}

function parseIntroMetadata(node: Element, mediaType: MediaType) {
  const introText = compact(node.querySelector(".info .intro, .intro")?.textContent || "");
  const parts = introText.split(/\s+\/\s+/).map(compact).filter(Boolean);
  const metadata: Pick<CanonicalMedia, "release_date" | "creators" | "countries"> = {};

  if (mediaType === "movie") {
    const firstPart = parts[0] || introText;
    const match = firstPart.match(/^(\d{4}(?:-\d{1,2})?(?:-\d{1,2})?)(?:\(([^)]+)\))?/);
    const releaseDate = match ? parsePartialDate(match[1]) : parsePartialDate(firstPart);
    if (releaseDate) metadata.release_date = releaseDate;
    if (match?.[2]) metadata.countries = match[2].split(/[\/,，、]/).map(compact).filter(Boolean);
    return metadata;
  }

  if (mediaType === "book" || mediaType === "music") {
    const firstPart = parts[0] || "";
    const datePart = parts.find((part) => /\b(19|20)\d{2}\b/.test(part));
    if (firstPart && !/\b(19|20)\d{2}\b/.test(firstPart)) {
      metadata.creators = firstPart.split(/[\/,，、]/).map(compact).filter(Boolean);
    }
    const releaseDate = datePart ? parsePartialDate(datePart) : "";
    if (releaseDate) metadata.release_date = releaseDate;
  }

  return metadata;
}

function parseRating(node: Element) {
  const ratingNode = node.querySelector("[class*='rating'], [class*='allstar']");
  if (!ratingNode) return undefined;
  const classText = Array.from(ratingNode.classList).join(" ");
  const allstar = classText.match(/allstar(\d{2})/);
  if (allstar) return { value: Number(allstar[1]) / 10, scale: 5 };
  const ratingClass = classText.match(/rating(\d)-t/);
  if (ratingClass) return { value: Number(ratingClass[1]), scale: 5 };
  const numeric = compact(ratingNode.textContent || "").match(/\b([0-5](?:\.\d)?)\b/);
  return numeric ? { value: Number(numeric[1]), scale: 5 } : undefined;
}

function parseExternalIds(text: string) {
  const imdb = text.match(/\btt\d{7,9}\b/i);
  const isbn = text.match(/\b(?:97[89][-\s]?)?(?:\d[-\s]?){9,12}[\dX]\b/i);
  const externalIds: Record<string, string> = {};
  if (imdb) externalIds.imdb = imdb[0];
  if (isbn) externalIds.isbn = isbn[0].replace(/[-\s]/g, "");
  return externalIds;
}
