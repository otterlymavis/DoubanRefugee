export type MediaType = "movie" | "book" | "music";
export type Destination = "letterboxd" | "filmarks" | "goodreads" | "rateyourmusic" | "backup";

export type CanonicalMedia = {
  media_type: MediaType;
  source_platform: "douban";
  source_id: string;
  titles: Record<string, string>;
  year?: number;
  rating?: { value: number; scale: number } | null;
  review?: string | null;
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
    titles: { zh: "花样年华", en: "In the Mood for Love", original: "花樣年華" },
    year: 2000,
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
    titles: { zh: "阿飞正传", en: "Days of Being Wild", original: "阿飛正傳" },
    year: 1990,
    rating: { value: 4.5, scale: 5 },
    consumed_date: "2024-02-12",
    tags: ["manual-review"],
    external_ids: {},
  },
  {
    media_type: "book",
    source_platform: "douban",
    source_id: "2567698",
    titles: { zh: "三体", en: "The Three-Body Problem" },
    year: 2008,
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
  const bySource = new Map(existing.map((item) => [sourceKey(item), item]));
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

export function renderExport(items: CanonicalMedia[], destination: Destination, mediaType?: MediaType): ExportFile {
  const scoped = mediaType ? items.filter((item) => item.media_type === mediaType) : items;
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
        item.external_ids?.author || "",
        ratingFor(item),
        item.consumed_date || "",
        item.review || "",
      ]);
    case "rateyourmusic":
      return csvFile("rateyourmusic.csv", ["Artist", "Release", "Rating", "Date", "Review"], scoped, (item) => [
        item.external_ids?.artist || "",
        titleFor(item),
        ratingFor(item),
        item.consumed_date || "",
        item.review || "",
      ]);
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
    titles: item.titles || {},
    year: item.year,
    rating: item.rating || null,
    review: item.review || null,
    consumed_date: item.consumed_date || null,
    tags: item.tags || [],
    external_ids: item.external_ids || {},
  });
}

function compactItem(item: CanonicalMedia): CanonicalMedia {
  return JSON.parse(JSON.stringify(item)) as CanonicalMedia;
}

function sourceKey(item: CanonicalMedia) {
  return `${item.media_type}:${item.source_platform}:${item.source_id}`;
}

function compareMedia(a: CanonicalMedia, b: CanonicalMedia) {
  return (b.consumed_date || "").localeCompare(a.consumed_date || "") || sourceKey(a).localeCompare(sourceKey(b));
}

function titleFor(item: CanonicalMedia) {
  return item.titles.en || item.titles.original || item.titles.zh || item.source_id;
}

function ratingFor(item: CanonicalMedia) {
  return item.rating?.value ?? "";
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
