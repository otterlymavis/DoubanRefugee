import { parse } from "node-html-parser";
import type { CanonicalMedia, MediaType } from "./local-export";

export type ScrapePageResult = {
  items: CanonicalMedia[];
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

function compact(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string, base: string): string {
  try { return new URL(href, base).href; } catch { return href; }
}

function subjectId(url: string): string {
  return url.match(/\/subject\/(\d+)\/?/)?.[1] || "";
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
