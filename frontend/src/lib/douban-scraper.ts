import { parse } from "node-html-parser";
import type { CanonicalMedia, MediaType } from "./local-export";
import type { DoubanBackupEntryType, DoubanStatus, StatusAuthor, StatusComment } from "./status-backup";

export type ScrapePageResult = {
  items: CanonicalMedia[];
  nextUrl: string | null;
};

export type AccountBackupType =
  | "status"
  | "diary"
  | "review"
  | "post"
  | "reply"
  | "album"
  | "doulist"
  | "profile"
  | "relationship"
  | "event";

export type AccountBackupPageResult = {
  entries: DoubanStatus[];
  nextUrl: string | null;
};

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  DNT: "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

export type EnrichResult = {
  sourceId: string;
  originalTitle?: string;
  alternativeTitles: string[];
  imdbId?: string;
  year?: number;
};

export async function enrichSubject(sourceId: string, mediaType: MediaType, cookie?: string): Promise<EnrichResult> {
  const sub = mediaType === "book" ? "book" : mediaType === "music" ? "music" : "movie";
  const url = `https://${sub}.douban.com/subject/${sourceId}/`;
  const headers: Record<string, string> = { ...FETCH_HEADERS };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const root = parse(html);

  // Year from <span class="year">(2026)</span>
  const yearText = compact(root.querySelector("span.year, h1 .year")?.text || "");
  const year = yearText.match(/\b(19|20)\d{2}\b/)?.[0];

  // Alternative titles — Douban lists them under "又名:" in #info
  const infoEl = root.querySelector("#info");
  const infoText = infoEl?.text || "";

  // "又名:" line
  const altSection = infoText.match(/又名[：:]\s*([^\n]+)/)?.[1] || "";
  const alternativeTitles = altSection.split(/\s*\/\s*/).map(compact).filter(Boolean);

  // First Latin-script alternative = original/English title
  const originalTitle = alternativeTitles.find((t) => /^[A-Za-z]/.test(t));

  // IMDb ID from a link or plain text in #info
  const imdbLink = infoEl?.querySelector("a[href*='imdb.com']");
  const imdbText = imdbLink?.getAttribute("href") || imdbLink?.text || infoText;
  const imdbId = imdbText.match(/\btt\d{7,9}\b/i)?.[0];

  return { sourceId, originalTitle, alternativeTitles, imdbId, year: year ? Number(year) : undefined };
}

export function doubanPageUrl(userId: string, mediaType: MediaType, status: "collect" | "wish", start = 0): string {
  const sub = mediaType === "book" ? "book" : mediaType === "music" ? "music" : "movie";
  const mode = mediaType === "movie" ? "grid" : "list";
  return `https://${sub}.douban.com/people/${encodeURIComponent(userId)}/${status}?start=${start}&sort=time&rating=all&filter=all&mode=${mode}`;
}

export function doubanAccountBackupPageUrl(userId: string, backupType: AccountBackupType, page = 1): string {
  const encoded = encodeURIComponent(userId);
  const safePage = Math.max(1, Math.floor(page));
  const start = (safePage - 1) * 10;
  if (backupType === "profile") return `https://www.douban.com/people/${encoded}/`;
  if (backupType === "status") return `https://www.douban.com/people/${encoded}/statuses?p=${safePage}`;
  if (backupType === "diary") return `https://www.douban.com/people/${encoded}/notes?start=${start}`;
  if (backupType === "review") return `https://www.douban.com/people/${encoded}/reviews?start=${start}`;
  if (backupType === "post") return `https://www.douban.com/people/${encoded}/discussion?start=${start}`;
  if (backupType === "reply") return `https://www.douban.com/people/${encoded}/comments?start=${start}`;
  if (backupType === "album") return `https://www.douban.com/people/${encoded}/photos?start=${start}`;
  if (backupType === "doulist") return `https://www.douban.com/people/${encoded}/doulists/all?start=${start}`;
  if (backupType === "relationship") return `https://www.douban.com/people/${encoded}/contacts?start=${start}`;
  return `https://www.douban.com/people/${encoded}/events?start=${start}`;
}

export function doubanAccountBackupPageUrls(userId: string, backupType: AccountBackupType, page = 1): string[] {
  if (backupType !== "relationship") return [doubanAccountBackupPageUrl(userId, backupType, page)];
  const encoded = encodeURIComponent(userId);
  const safePage = Math.max(1, Math.floor(page));
  const start = (safePage - 1) * 10;
  return [
    `https://www.douban.com/people/${encoded}/contacts?start=${start}`,
    `https://www.douban.com/people/${encoded}/rev_contacts?start=${start}`,
  ];
}

export async function scrapeDoubanPage(url: string, cookie?: string): Promise<ScrapePageResult> {
  const headers: Record<string, string> = { ...FETCH_HEADERS };
  if (cookie) headers["Cookie"] = cookie;

  const response = await fetch(url, { headers, redirect: "follow" });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Douban blocked the request (HTTP 403). " +
        "Book and music pages almost always require your session cookie. " +
        "Paste your Douban cookie string in the Cookie field and try again.",
      );
    }
    if (response.status === 404) {
      throw new Error("Douban user not found (HTTP 404). Check the user ID and try again.");
    }
    throw new Error(`Douban returned HTTP ${response.status}.`);
  }

  const html = await response.text();

  if (
    (html.includes("login.douban.com") || html.includes("请先登录") || html.includes("需要先登录")) &&
    !html.includes('class="item"')
  ) {
    throw new Error("Douban requires login for this profile. Paste your session cookie in the advanced options.");
  }

  const mediaType = url.includes("book.douban.com") ? "book" : url.includes("music.douban.com") ? "music" : "movie";
  const collectionStatus: "completed" | "watchlist" = url.includes("/wish") ? "watchlist" : "completed";

  return {
    items: parseItems(html, url, mediaType as MediaType, collectionStatus),
    nextUrl: findNextUrl(html, url),
  };
}

export async function scrapeDoubanAccountBackupPage(url: string, cookie?: string): Promise<AccountBackupPageResult> {
  const headers: Record<string, string> = { ...FETCH_HEADERS };
  if (cookie) headers["Cookie"] = cookie;

  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Douban blocked the request (HTTP 403). Paste your session cookie and try again.");
    }
    if (response.status === 404) {
      throw new Error("Douban page not found (HTTP 404). Check the user ID and try again.");
    }
    throw new Error(`Douban returned HTTP ${response.status}.`);
  }

  const html = await response.text();
  if (html.includes("login.douban.com") || html.includes("请先登录") || html.includes("需要先登录")) {
    throw new Error("Douban requires login for this account section. Paste your session cookie in the cookie field.");
  }

  return {
    entries: parseAccountEntries(html, url),
    nextUrl: findNextUrl(html, url),
  };
}

function compact(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string, base: string): string {
  try { return new URL(href, base).href; } catch { return href; }
}

function subjectId(url: string): string {
  return url.match(/\/subject\/(\d+)\/?/)?.[1] || "";
}

function entryIdFromUrl(url: string): string {
  return url.match(/\/(?:status|statuses|note|review|topic|album|photos|doulist|event|people)\/([^/?#]+)/)?.[1] || url.match(/\/([^/?#]+)\/?$/)?.[1] || "";
}

function detectAccountEntryType(url: string): DoubanBackupEntryType {
  if (/\/people\/[^/]+\/?$/.test(url)) return "profile";
  if (/\/statuses?(?:\/|\?|$)/.test(url)) return "status";
  if (/\/notes?(?:\/|\?|$)|\/note\/\d+/.test(url)) return "diary";
  if (/\/reviews?(?:\/|\?|$)|\/review\/\d+/.test(url)) return "review";
  if (/\/discussion(?:\/|\?|$)|\/group\/topic\/\d+/.test(url)) return "post";
  if (/\/comments?(?:\/|\?|$)/.test(url)) return "reply";
  if (/\/photos?(?:\/|\?|$)|\/album\/\d+|\/photos\/photo\/\d+/.test(url)) return "photo";
  if (/\/doulists?(?:\/|\?|$)|\/doulist\/\d+/.test(url)) return "doulist";
  if (/\/contacts?(?:\/|\?|$)|\/rev_contacts(?:\/|\?|$)/.test(url)) return "relationship";
  if (/\/events?(?:\/|\?|$)|\/event\/\d+/.test(url)) return "event";
  return "unknown";
}

function authorFromLink(link: ReturnType<ReturnType<typeof parse>["querySelector"]>): StatusAuthor {
  if (!link) return { name: "" };
  const href = link.getAttribute("href") || "";
  return {
    name: compact(link.text || ""),
    uid: href.match(/people\/([^/]+)/)?.[1] || undefined,
    link: href ? absoluteUrl(href, "https://www.douban.com/") : undefined,
  };
}

function parseVisibleComments(root: ReturnType<typeof parse> | null | undefined, pageUrl: string): StatusComment[] {
  const nodes = root?.querySelectorAll?.(".lite-comment-item, .comment-item, .comments-items li, .reply-item, .reply-doc, .comment") || [];
  const comments: StatusComment[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const authorLink = node.querySelector?.(".lite-comment-item-author, .author, .user-name, a[href*='/people/']");
    const contentNode = node.querySelector?.(".lite-comment-item-content, .reply-content, .content, blockquote, p");
    const rawContent = compact(contentNode?.text || node.text || "");
    const content = rawContent.replace(/^(回应|回复|评论)[:：]\s*/, "");
    if (!content) continue;

    const author = authorFromLink(authorLink || null);
    if (author.link) author.link = absoluteUrl(author.link, pageUrl);
    const key = `${author.name}:${content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    comments.push({ author, content });
  }

  return comments;
}

function parseAccountEntries(html: string, pageUrl: string): DoubanStatus[] {
  const root = parse(html);
  const type = detectAccountEntryType(pageUrl);
  if (type === "profile") return parseProfileEntry(root, pageUrl);
  if (type === "status") return parseStatusEntries(root, pageUrl);
  return parseListOrDetailEntries(root, pageUrl, type);
}

function profileUserId(pageUrl: string) {
  return pageUrl.match(/\/people\/([^/]+)/)?.[1] || "profile";
}

function parseProfileEntry(root: ReturnType<typeof parse>, pageUrl: string): DoubanStatus[] {
  const userId = profileUserId(pageUrl);
  const name = compact(root.querySelector("h1, .info h1, .user-info h1")?.text || root.querySelector("title")?.text || userId);
  const avatar = root.querySelector(".userface img, .pic img, img.userface, img[alt]")?.getAttribute("src") || "";
  const intro = compact(root.querySelector(".user-intro, .intro, #display")?.text || "");
  const signature = compact(root.querySelector(".signature, .user-info .pl, .info .pl")?.text || "");
  const links = root.querySelectorAll("a[href]")
    .map((anchor) => absoluteUrl(anchor.getAttribute("href") || "", pageUrl))
    .filter((href) => href.includes("douban.com/people/") || href.includes("douban.com/group/") || href.includes("douban.com/doulist/"))
    .slice(0, 50);

  return [{
    source_platform: "douban",
    source_id: userId,
    source_url: pageUrl,
    entry_type: "profile",
    title: name,
    author: { name, uid: userId, link: pageUrl },
    content: [intro, signature].filter(Boolean).join("\n\n"),
    images: avatar ? [{ url: absoluteUrl(avatar, pageUrl), alt: `${name} avatar` }] : [],
    comments: [],
    metadata: { user_id: userId, links },
  }];
}

function parseStatusEntries(root: ReturnType<typeof parse>, pageUrl: string): DoubanStatus[] {
  const entries: DoubanStatus[] = [];
  const seen = new Set<string>();
  const roots = root.querySelectorAll(".status-item, [data-sid]");

  for (const node of roots) {
    const id = node.getAttribute("data-sid") || node.getAttribute("id")?.replace(/^status-/, "") || node.querySelector("a[href*='/status/']")?.getAttribute("href")?.match(/\/status(?:es)?\/(\d+)/)?.[1] || "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const time = node.querySelector(".created_at, .lnk-time, a[href*='/status/']");
    const sourceUrl = absoluteUrl(time?.getAttribute("href") || `/people/status/${id}/`, pageUrl);
    const content = compact(node.querySelector(".status-saying, .status-content, .text, blockquote p, .content p")?.text || "");

    const comments = parseVisibleComments(node, pageUrl);
    entries.push({
      source_platform: "douban",
      source_id: id,
      source_url: sourceUrl,
      entry_type: "status",
      status_type: node.getAttribute("data-atype") || undefined,
      author: authorFromLink(node.querySelector(".lnk-people, .user-name, a[href*='/people/']")),
      created_at: time?.getAttribute("title") || time?.getAttribute("data-time") || compact(time?.text || "") || undefined,
      activity: compact(node.querySelector(".activity")?.text || "") || undefined,
      content,
      images: node.querySelectorAll(".status-images img, .topic-pics img, .pics-wrapper img, .photo-item img")
        .map((image) => ({
          url: absoluteUrl((image.getAttribute("data-original") || image.getAttribute("src") || "").replace("/small/", "/large/").replace("/medium/", "/large/"), pageUrl),
          alt: image.getAttribute("alt") || "image",
        }))
        .filter((image) => image.url),
      comments,
      comment_count: comments.length || undefined,
    });
  }

  return entries;
}

function parseListOrDetailEntries(root: ReturnType<typeof parse>, pageUrl: string, pageType: DoubanBackupEntryType): DoubanStatus[] {
  const detail = parseDetailEntry(root, pageUrl, pageType);
  const bySource = new Map<string, DoubanStatus>();
  if (detail) bySource.set(`${detail.entry_type}:${detail.source_id}`, detail);

  const patterns = patternsForAccountType(pageType);
  for (const anchor of root.querySelectorAll("a[href]")) {
    const rawHref = anchor.getAttribute("href") || "";
    if (!patterns.some((pattern) => rawHref.includes(pattern))) continue;
    const href = absoluteUrl(rawHref, pageUrl);
    const entryType = normalizeDetectedEntryType(detectAccountEntryType(href), pageType);
    const sourceId = entryIdFromUrl(href);
    const itemRoot = anchor.closest(".note-item, .review-item, .topic-list li, .olt tr, .item, .albumlst li, .photolst li, .doulist-item, .events-list li, .obu, li, tr, .article") || anchor.parentNode;
    const title = compact(anchor.text || "");
    const content = compact(itemRoot?.querySelector?.(".abstract, .short-content, .content, .reply-doc, p")?.text || itemRoot?.text || title);
    if (!sourceId || (!title && !content)) continue;

    const comments = parseVisibleComments(itemRoot, pageUrl);
    bySource.set(`${entryType}:${sourceId}`, {
      source_platform: "douban",
      source_id: sourceId,
      source_url: href,
      entry_type: entryType,
      title: title || undefined,
      author: authorFromLink(itemRoot?.querySelector?.("a[href*='/people/']") || null),
      created_at: itemRoot?.querySelector?.(".date, .time, .pub-date, .created_at, .color-green")?.text.trim() || undefined,
      content,
      images: itemRoot?.querySelectorAll?.("img").map((image) => ({
        url: absoluteUrl(image.getAttribute("data-original") || image.getAttribute("src") || "", pageUrl),
        alt: image.getAttribute("alt") || "image",
      })).filter((image) => image.url) || [],
      comments,
      comment_count: comments.length || undefined,
      metadata: metadataForEntry(itemRoot, entryType, pageUrl),
    });
  }

  return Array.from(bySource.values());
}

function patternsForAccountType(pageType: DoubanBackupEntryType) {
  if (pageType === "diary") return ["/note/"];
  if (pageType === "review") return ["/review/"];
  if (pageType === "post") return ["/group/topic/"];
  if (pageType === "reply" || pageType === "comment") return ["/group/topic/", "/review/", "/note/", "/subject/"];
  if (pageType === "album" || pageType === "photo") return ["/album/", "/photos/photo/"];
  if (pageType === "doulist") return ["/doulist/"];
  if (pageType === "relationship") return ["/people/"];
  if (pageType === "event") return ["/event/"];
  return ["/note/", "/review/", "/group/topic/", "/album/", "/photos/photo/", "/doulist/", "/event/", "/people/"];
}

function normalizeDetectedEntryType(detected: DoubanBackupEntryType, pageType: DoubanBackupEntryType): DoubanBackupEntryType {
  if (pageType === "reply") return "reply";
  if (pageType === "album") return detected === "photo" ? "photo" : "album";
  if (detected === "unknown" || detected === "profile") return pageType;
  return detected;
}

function metadataForEntry(itemRoot: ReturnType<typeof parse> | null | undefined, entryType: DoubanBackupEntryType, pageUrl: string) {
  const imageCount = itemRoot?.querySelectorAll?.("img").length || 0;
  const links = itemRoot?.querySelectorAll?.("a[href]").map((anchor) => absoluteUrl(anchor.getAttribute("href") || "", pageUrl)).slice(0, 20) || [];
  return {
    section: entryType,
    image_count: imageCount,
    links,
  };
}

function parseDetailEntry(root: ReturnType<typeof parse>, pageUrl: string, pageType: DoubanBackupEntryType): DoubanStatus | null {
  if (!/\/(?:note|review|topic|album|photos\/photo|doulist|event)\/\d+/.test(pageUrl)) return null;
  const sourceId = entryIdFromUrl(pageUrl);
  const title = compact(root.querySelector("h1")?.text || root.querySelector("title")?.text || "");
  const contentRoot = root.querySelector(".note, .review-content, .topic-content, #link-report, .article, main, #content");
  const content = compact(contentRoot?.text || "");
  if (!sourceId || (!title && !content)) return null;

  const comments = parseVisibleComments(root, pageUrl);
  return {
    source_platform: "douban",
    source_id: sourceId,
    source_url: pageUrl,
    entry_type: normalizeDetectedEntryType(detectAccountEntryType(pageUrl), pageType),
    title: title || undefined,
    author: authorFromLink(root.querySelector(".author a[href*='/people/'], .user-info a[href*='/people/'], a[href*='/people/']")),
    created_at: compact(root.querySelector(".pub-date, .created_at, .main-meta, .topic-doc .color-green, .review-meta")?.text || "") || undefined,
    content,
    images: root.querySelectorAll("#link-report img, .article img, main img").map((image) => ({
      url: absoluteUrl(image.getAttribute("data-original") || image.getAttribute("src") || "", pageUrl),
      alt: image.getAttribute("alt") || "image",
    })).filter((image) => image.url),
    comments,
    comment_count: comments.length || undefined,
    metadata: metadataForEntry(contentRoot, pageType, pageUrl),
  };
}

function parseItems(html: string, pageUrl: string, mediaType: MediaType, collectionStatus: "completed" | "watchlist"): CanonicalMedia[] {
  const root = parse(html);
  const nodes = root.querySelectorAll(".item, .doulist-item, li.subject-item, .grid-view li, .item-root, .article li");
  const items: CanonicalMedia[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const anchor = node.querySelector("a[href*='douban.com/subject/'], a[href*='/subject/']");
    if (!anchor) continue;

    const href = absoluteUrl(anchor.getAttribute("href") || "", pageUrl);
    const sourceId = subjectId(href);
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);

    const titleNode = node.querySelector(".info .title a, .title a, h2 a") || anchor;
    const rawTitle = compact(
      titleNode.getAttribute("content") || titleNode.getAttribute("alt") || titleNode.text
    ).replace(/\s*\((19|20)\d{2}\)\s*$/, "");
    if (!rawTitle) continue;

    // Rating — match allstar50 → 5/5, allstar40 → 4/5, etc.
    const ratingEl = node.querySelector("[class*='rating'],[class*='allstar']");
    const ratingClass = ratingEl?.getAttribute("class") || "";
    const allstar = ratingClass.match(/allstar(\d{2})/);
    const ratingNum = ratingClass.match(/rating(\d)-t/);
    const rating =
      allstar ? { value: Number(allstar[1]) / 10, scale: 5 } :
      ratingNum ? { value: Number(ratingNum[1]), scale: 5 } :
      null;

    // Date
    const dateRaw = compact(node.querySelector(".date")?.text || "");
    const dm = dateRaw.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    const markedDate = dm ? `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}` : undefined;

    // Review
    const review =
      collectionStatus !== "watchlist"
        ? compact(node.querySelector(".comment, .short, .review-short")?.text || "") || undefined
        : undefined;

    // Year from intro line
    const introText = compact(node.querySelector(".info .intro, .intro")?.text || "");
    const yearStr = introText.match(/\b(19|20)\d{2}\b/)?.[0];

    // Poster
    const posterUrl = node.querySelector(".pic img")?.getAttribute("src") || undefined;

    // User tags
    const tagsRaw = compact(node.querySelector(".info .tags, .tags")?.text || "").replace(/^标签[:：]\s*/, "");
    const userTags = tagsRaw ? tagsRaw.split(/\s+/).filter(Boolean) : [];

    items.push({
      media_type: mediaType,
      source_platform: "douban",
      source_id: sourceId,
      source_url: href,
      poster_url: posterUrl,
      collection_status: collectionStatus,
      titles: { zh: rawTitle },
      year: yearStr ? Number(yearStr) : undefined,
      rating: collectionStatus !== "watchlist" ? rating : null,
      review: review || null,
      consumed_date: collectionStatus !== "watchlist" ? markedDate : undefined,
      marked_date: collectionStatus === "watchlist" ? markedDate : undefined,
      tags: ["douban-scrape", `douban-${collectionStatus}`, ...userTags].filter(Boolean),
      external_ids: {},
    });
  }

  return items;
}

function findNextUrl(html: string, currentUrl: string): string | null {
  const root = parse(html);

  const direct = root.querySelector("link[rel='next'], .paginator .next a, .paginator a.next, span.next a");
  const directHref = direct?.getAttribute("href");
  if (directHref) {
    try { return new URL(directHref, currentUrl).href; } catch { /* fall through */ }
  }

  let currentStart: number;
  try { currentStart = Number(new URL(currentUrl).searchParams.get("start") || "0"); }
  catch { return null; }

  const base = new URL(currentUrl);
  const candidates = root.querySelectorAll("a[href*='start=']")
    .flatMap(a => {
      const href = a.getAttribute("href") || "";
      try {
        const u = new URL(href, currentUrl);
        const start = Number(u.searchParams.get("start") || "0");
        if (start > currentStart && u.origin === base.origin && u.pathname === base.pathname) {
          return [{ href: u.href, start }];
        }
      } catch { /* ignore */ }
      return [];
    })
    .sort((a, b) => a.start - b.start);

  return candidates[0]?.href ?? null;
}
