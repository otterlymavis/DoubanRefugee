(() => {
if (window.__doubanRefugeeContentScriptLoaded) return;
window.__doubanRefugeeContentScriptLoaded = true;

const MAX_SCRAPE_PAGES = 200;
const PAGE_DELAY_MS = 500;

function compact(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function textContentFor(root) {
  return root.body?.textContent || root.textContent || "";
}

function absoluteUrl(href, baseUrl = window.location.href) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href || "";
  }
}

function isDoubanUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "douban.com" || hostname.endsWith(".douban.com");
  } catch {
    return false;
  }
}

function subjectIdFromUrl(url, baseUrl = window.location.href) {
  const match = absoluteUrl(url, baseUrl).match(/\/subject\/(\d+)\/?/);
  return match ? match[1] : "";
}

function detectMediaType(url = window.location.href) {
  if (url.includes("book.douban.com")) return "book";
  if (url.includes("music.douban.com")) return "music";
  return "movie";
}

function detectCollectionStatus(url = window.location.href) {
  try {
    const { pathname } = new URL(url);
    if (/\/people\/[^/]+\/wish\/?/.test(pathname)) return "watchlist";
    if (/\/people\/[^/]+\/do\/?/.test(pathname)) return "watching";
    if (/\/people\/[^/]+\/collect\/?/.test(pathname)) return "watched";
  } catch {
    return undefined;
  }
  return undefined;
}

function userIdFromMoviePeopleUrl(url = window.location.href) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "movie.douban.com") return "";
    return parsed.pathname.match(/^\/people\/([^/]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function movieUserSectionStarts(currentUrl = window.location.href, mediaType = "movie") {
  if (mediaType !== "movie") return [];
  const userId = userIdFromMoviePeopleUrl(currentUrl);
  if (!userId) return [];
  const encodedUserId = encodeURIComponent(userId);
  return [
    {
      collection_status: "watched",
      label: "watched",
      url: `https://movie.douban.com/people/${encodedUserId}/collect?start=0&sort=time&rating=all&filter=all&mode=grid`,
    },
    {
      collection_status: "watchlist",
      label: "watchlist",
      url: `https://movie.douban.com/people/${encodedUserId}/wish?start=0&sort=time&rating=all&filter=all&mode=grid`,
    },
  ];
}

function parseYear(text) {
  const match = compact(text).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function parseDate(text) {
  const match = compact(text).match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseRating(root) {
  const ratingNode = root.querySelector(".info [class*='rating'], .info [class*='allstar'], [class*='rating'], [class*='allstar']");
  if (!ratingNode) return undefined;

  const classText = Array.from(ratingNode.classList).join(" ");
  const allstar = classText.match(/allstar(\d{2})/);
  if (allstar) return { value: Number(allstar[1]) / 10, scale: 5 };

  const ratingClass = classText.match(/rating(\d)-t/);
  if (ratingClass) return { value: Number(ratingClass[1]), scale: 5 };

  const numeric = compact(ratingNode.textContent).match(/\b([0-5](?:\.\d)?)\b/);
  return numeric ? { value: Number(numeric[1]), scale: 5 } : undefined;
}

function infoLines(root) {
  const info = root.querySelector?.("#info") || root;
  return (info.textContent || "").split(/\n/).map(compact).filter(Boolean);
}

function infoValue(root, label) {
  const lines = infoLines(root);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === `${label}:` || line === `${label}\uFF1A`) return lines[index + 1] || "";
    if (line.startsWith(`${label}:`) || line.startsWith(`${label}\uFF1A`)) return compact(line.slice(label.length + 1));
  }
  return "";
}

function parseExternalIds(root, mediaType) {
  const text = compact(textContentFor(root));
  const externalIds = {};
  if (mediaType === "movie") {
    const imdb = text.match(/\btt\d{7,9}\b/i);
    if (imdb) externalIds.imdb = imdb[0];
  }
  if (mediaType === "book") {
    const isbn = text.match(/\b(?:97[89][-\s]?)?(?:\d[-\s]?){9,12}[\dX]\b/i);
    const author = infoValue(root, "\u4F5C\u8005");
    if (isbn) externalIds.isbn = isbn[0].replace(/[-\s]/g, "");
    if (author) externalIds.author = author;
  }
  if (mediaType === "music") {
    const artist = infoValue(root, "\u8868\u6F14\u8005");
    const barcode = infoValue(root, "\u6761\u5F62\u7801");
    if (artist) externalIds.artist = artist;
    if (barcode) externalIds.barcode = barcode;
  }
  return externalIds;
}

function cleanTags(value) {
  const text = compact(value).replace(/^\u6807\u7B7E[:\uFF1A]\s*/, "");
  return text ? text.split(/\s+/).filter(Boolean) : [];
}

function listTitleNode(root, mediaType) {
  if (mediaType === "book") return root.querySelector(".info h2 a, .info .title a, h2 a, .title a");
  return root.querySelector(".info .title a, .title a, h2 a");
}

function itemFromRoot(root, anchor, mediaType, pageUrl = window.location.href, collectionStatus = detectCollectionStatus(pageUrl)) {
  const href = anchor ? absoluteUrl(anchor.getAttribute("href") || anchor.href, pageUrl) : pageUrl;
  const sourceId = subjectIdFromUrl(href, pageUrl);
  const itemMediaType = mediaType || detectMediaType(href);
  if (!sourceId) return undefined;

  const titleNode = anchor
    ? listTitleNode(root, itemMediaType) || anchor
    : root.querySelector("h1 span[property='v:itemreviewed']") ||
      root.querySelector("h1 span") ||
      root.querySelector("h1") ||
      root.querySelector("meta[property='og:title']") ||
      root.querySelector("#mainpic img");

  const rawTitle = compact(titleNode ? titleNode.getAttribute?.("content") || titleNode.getAttribute?.("alt") || titleNode.textContent : anchor?.textContent);
  const title = rawTitle.replace(/\s*\((19|20)\d{2}\)\s*$/, "");
  if (!title) return undefined;

  const metadataRoot = anchor ? root : root.querySelector("#info") || root.querySelector(".subjectwrap") || root;
  const rootText = textContentFor(metadataRoot);
  const dateText = root.querySelector(".info .short-note .date, .info .date, .date")?.textContent || rootText;
  const markedDate = parseDate(dateText);
  const rating = anchor && collectionStatus !== "watchlist" ? parseRating(root) : undefined;
  const reviewNode = collectionStatus === "watchlist" ? undefined : root.querySelector(".info .comment, .comment, .short, .review-short, blockquote");
  const review = compact(reviewNode?.textContent);
  const tags = cleanTags(root.querySelector(".info .tags, .tags")?.textContent || "");
  const posterUrl = root.querySelector(".pic img, #mainpic img")?.getAttribute("src") || "";
  const externalIds = parseExternalIds(metadataRoot, itemMediaType);

  const item = {
    media_type: itemMediaType,
    source_platform: "douban",
    source_id: sourceId,
    source_url: href,
    poster_url: posterUrl,
    collection_status: collectionStatus,
    marked_date: markedDate || null,
    titles: { zh: title },
    tags: ["douban-scrape", collectionStatus ? `douban-${collectionStatus}` : "", ...tags].filter(Boolean),
    external_ids: externalIds,
  };

  const year = parseYear(rootText);
  if (year) item.year = year;
  if (rating) item.rating = rating;
  if (collectionStatus !== "watchlist" && markedDate) item.consumed_date = markedDate;
  if (review) item.review = review;

  return item;
}

function extractListItemsFromDocument(documentLike, mediaType, pageUrl = window.location.href, collectionStatus = detectCollectionStatus(pageUrl)) {
  const candidates = Array.from(
    documentLike.querySelectorAll(".item, .doulist-item, li.subject-item, .grid-view li, .item-root, .article li"),
  );
  const items = [];
  const seen = new Set();

  for (const root of candidates) {
    const anchor = root.querySelector("a[href*='douban.com/subject/'], a[href*='/subject/']");
    const item = anchor ? itemFromRoot(root, anchor, mediaType || detectMediaType(pageUrl), pageUrl, collectionStatus) : undefined;
    if (item && !seen.has(item.source_id)) {
      seen.add(item.source_id);
      items.push(item);
    }
  }

  return items;
}

function extractSubjectPageFromDocument(documentLike, mediaType, pageUrl = window.location.href, collectionStatus = detectCollectionStatus(pageUrl)) {
  const sourceId = subjectIdFromUrl(pageUrl);
  if (!sourceId) return [];
  const item = itemFromRoot(documentLike, undefined, mediaType || detectMediaType(pageUrl), pageUrl, collectionStatus);
  return item ? [item] : [];
}

function extractDoubanItems(mediaType, documentLike = document, pageUrl = window.location.href, collectionStatus = detectCollectionStatus(pageUrl)) {
  if (subjectIdFromUrl(pageUrl)) {
    const subjectItems = extractSubjectPageFromDocument(documentLike, mediaType, pageUrl, collectionStatus);
    if (subjectItems.length > 0) return subjectItems;
  }

  const items = extractListItemsFromDocument(documentLike, mediaType, pageUrl, collectionStatus);
  return items.length > 0 ? items : extractSubjectPageFromDocument(documentLike, mediaType, pageUrl, collectionStatus);
}

function sourceKey(item) {
  return `${item.media_type}:${item.source_platform}:${item.source_id}:${item.collection_status || "item"}`;
}

function findNextPageUrl(documentLike, currentUrl) {
  const directNext = documentLike.querySelector("link[rel='next'], a[rel='next'], .paginator .next a, .paginator a.next, span.next a");
  if (directNext?.href) {
    const url = absoluteUrl(directNext.getAttribute("href") || directNext.href, currentUrl);
    return isDoubanUrl(url) ? url : "";
  }

  let current;
  try {
    current = new URL(currentUrl);
  } catch {
    return "";
  }

  const currentStart = Number(current.searchParams.get("start") || "0");
  const pageLinks = Array.from(documentLike.querySelectorAll("a[href*='start=']"))
    .map((anchor) => absoluteUrl(anchor.getAttribute("href") || anchor.href, currentUrl))
    .filter(isDoubanUrl)
    .map((href) => {
      const url = new URL(href);
      return { href, start: Number(url.searchParams.get("start") || "0"), url };
    })
    .filter(({ start, url }) => start > currentStart && url.origin === current.origin && url.pathname === current.pathname)
    .sort((a, b) => a.start - b.start);

  return pageLinks[0]?.href || "";
}

async function fetchDoubanDocument(url) {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

function normalizePageLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(MAX_SCRAPE_PAGES, Math.floor(parsed)));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeSection(root, limit, seenUrls, bySource, pages, mediaType) {
  let nextUrl = root.url;
  let reachedMaxPages = false;

  for (let pageNumber = 1; pageNumber <= limit && nextUrl; pageNumber += 1) {
    if (seenUrls.has(nextUrl)) break;
    seenUrls.add(nextUrl);

    const documentLike = nextUrl === window.location.href ? document : await fetchDoubanDocument(nextUrl);
    const pageMediaType = mediaType || detectMediaType(nextUrl);
    const items = extractDoubanItems(pageMediaType, documentLike, nextUrl, root.collection_status);
    for (const item of items) {
      bySource.set(sourceKey(item), item);
    }

    pages.push({
      url: nextUrl,
      title: documentLike.title,
      item_count: items.length,
      collection_status: root.collection_status,
      section: root.label,
    });

    const discoveredNextUrl = findNextPageUrl(documentLike, nextUrl);
    nextUrl = discoveredNextUrl && !seenUrls.has(discoveredNextUrl) ? discoveredNextUrl : "";
    if (pageNumber === limit && nextUrl) reachedMaxPages = true;
    if (nextUrl) await delay(PAGE_DELAY_MS);
  }

  return reachedMaxPages;
}

async function scrapeDoubanHistory({ mediaType, maxPages }) {
  const limit = normalizePageLimit(maxPages);
  const seenUrls = new Set();
  const bySource = new Map();
  const pages = [];
  const starts = movieUserSectionStarts(window.location.href, mediaType || detectMediaType());
  const roots = starts.length > 0 ? starts : [{
    url: window.location.href,
    collection_status: detectCollectionStatus(),
    label: "current",
  }];
  let reachedMaxPages = false;

  for (const root of roots) {
    reachedMaxPages = (await scrapeSection(root, limit, seenUrls, bySource, pages, mediaType)) || reachedMaxPages;
  }

  return {
    items: Array.from(bySource.values()),
    pages,
    reached_max_pages: reachedMaxPages,
    max_pages: limit,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type?.startsWith("DOUBAN_REFUGEE_")) return false;

  (async () => {
    try {
      if (message.type === "DOUBAN_REFUGEE_SCRAPE_HISTORY") {
        const result = await scrapeDoubanHistory(message);
        sendResponse({
          ok: true,
          ...result,
          page: {
            title: document.title,
            url: window.location.href,
            media_type: message.mediaType || detectMediaType(),
          },
        });
        return;
      }

      if (message.type === "DOUBAN_REFUGEE_EXTRACT") {
        const items = extractDoubanItems(message.mediaType);
        sendResponse({
          ok: true,
          items,
          page: {
            title: document.title,
            url: window.location.href,
            media_type: message.mediaType || detectMediaType(),
          },
        });
        return;
      }

      sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
});
})();
