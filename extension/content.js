(() => {
if (window.__doubanRefugeeContentScriptLoaded) return;
window.__doubanRefugeeContentScriptLoaded = true;

const MAX_SCRAPE_PAGES = 50;
const PAGE_DELAY_MS = 300;

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

function parseYear(text) {
  const match = compact(text).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function parseConsumedDate(text) {
  const match = compact(text).match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseRating(root) {
  const ratingNode = root.querySelector("[class*='rating'], [class*='allstar']");
  if (!ratingNode) return undefined;

  const classText = Array.from(ratingNode.classList).join(" ");
  const allstar = classText.match(/allstar(\d{2})/);
  if (allstar) {
    return { value: Number(allstar[1]) / 10, scale: 5 };
  }

  const ratingClass = classText.match(/rating(\d)-t/);
  if (ratingClass) {
    return { value: Number(ratingClass[1]), scale: 5 };
  }

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
    if (line === `${label}:` || line === `${label}：`) return lines[index + 1] || "";
    if (line.startsWith(`${label}:`) || line.startsWith(`${label}：`)) return compact(line.slice(label.length + 1));
  }
  return "";
}

function parseExternalIds(root) {
  const text = compact(textContentFor(root));
  const imdb = text.match(/\btt\d{7,9}\b/i);
  const isbn = text.match(/\b(?:97[89][-\s]?)?(?:\d[-\s]?){9,12}[\dX]\b/i);
  const externalIds = {};
  if (imdb) externalIds.imdb = imdb[0];
  if (isbn) externalIds.isbn = isbn[0].replace(/[-\s]/g, "");
  const author = infoValue(root, "作者");
  const artist = infoValue(root, "表演者");
  const barcode = infoValue(root, "条形码");
  if (author) externalIds.author = author;
  if (artist) externalIds.artist = artist;
  if (barcode) externalIds.barcode = barcode;
  return externalIds;
}

function itemFromRoot(root, anchor, mediaType, pageUrl = window.location.href) {
  const href = anchor ? absoluteUrl(anchor.getAttribute("href") || anchor.href, pageUrl) : pageUrl;
  const sourceId = subjectIdFromUrl(href, pageUrl);
  if (!sourceId) return undefined;

  const titleNode = anchor
    ? root.querySelector(".title a") || root.querySelector(".title") || anchor
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
  const year = parseYear(rootText);
  const rating = anchor ? parseRating(root) : undefined;
  const consumedDate = parseConsumedDate(rootText);
  const reviewNode = root.querySelector(".comment, .short, .review-short, blockquote");
  const review = compact(reviewNode?.textContent);
  const externalIds = parseExternalIds(metadataRoot);

  const item = {
    media_type: mediaType || detectMediaType(href),
    source_platform: "douban",
    source_id: sourceId,
    titles: { zh: title },
    tags: ["douban-scrape"],
    external_ids: externalIds
  };

  if (year) item.year = year;
  if (rating) item.rating = rating;
  if (consumedDate) item.consumed_date = consumedDate;
  if (review) item.review = review;

  return item;
}

function extractListItemsFromDocument(documentLike, mediaType, pageUrl = window.location.href) {
  const candidates = Array.from(
    documentLike.querySelectorAll(".item, .doulist-item, li.subject-item, .grid-view li, .item-root, .article li")
  );
  const items = [];
  const seen = new Set();

  for (const root of candidates) {
    const anchor = root.querySelector("a[href*='douban.com/subject/'], a[href*='/subject/']");
    const item = anchor ? itemFromRoot(root, anchor, mediaType || detectMediaType(pageUrl), pageUrl) : undefined;
    if (item && !seen.has(item.source_id)) {
      seen.add(item.source_id);
      items.push(item);
    }
  }

  return items;
}

function extractSubjectPageFromDocument(documentLike, mediaType, pageUrl = window.location.href) {
  const sourceId = subjectIdFromUrl(pageUrl);
  if (!sourceId) return [];
  const item = itemFromRoot(documentLike, undefined, mediaType || detectMediaType(pageUrl), pageUrl);
  return item ? [item] : [];
}

function extractDoubanItems(mediaType, documentLike = document, pageUrl = window.location.href) {
  if (subjectIdFromUrl(pageUrl)) {
    const subjectItems = extractSubjectPageFromDocument(documentLike, mediaType, pageUrl);
    if (subjectItems.length > 0) return subjectItems;
  }

  const items = extractListItemsFromDocument(documentLike, mediaType, pageUrl);
  return items.length > 0 ? items : extractSubjectPageFromDocument(documentLike, mediaType, pageUrl);
}

function sourceKey(item) {
  return `${item.media_type}:${item.source_platform}:${item.source_id}`;
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

async function scrapeDoubanHistory({ mediaType, maxPages }) {
  const limit = normalizePageLimit(maxPages);
  const seenUrls = new Set();
  const bySource = new Map();
  const pages = [];
  let nextUrl = window.location.href;
  let reachedMaxPages = false;

  for (let pageNumber = 1; pageNumber <= limit && nextUrl; pageNumber += 1) {
    if (seenUrls.has(nextUrl)) break;
    seenUrls.add(nextUrl);

    const documentLike = pageNumber === 1 ? document : await fetchDoubanDocument(nextUrl);
    const pageMediaType = mediaType || detectMediaType(nextUrl);
    const items = extractDoubanItems(pageMediaType, documentLike, nextUrl);
    for (const item of items) {
      bySource.set(sourceKey(item), item);
    }

    pages.push({
      url: nextUrl,
      title: documentLike.title,
      item_count: items.length
    });

    const discoveredNextUrl = findNextPageUrl(documentLike, nextUrl);
    nextUrl = discoveredNextUrl && !seenUrls.has(discoveredNextUrl) ? discoveredNextUrl : "";
    if (pageNumber === limit && nextUrl) {
      reachedMaxPages = true;
    }
    if (nextUrl) {
      await delay(PAGE_DELAY_MS);
    }
  }

  return {
    items: Array.from(bySource.values()),
    pages,
    reached_max_pages: reachedMaxPages,
    max_pages: limit
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
            media_type: message.mediaType || detectMediaType()
          }
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
            media_type: message.mediaType || detectMediaType()
          }
        });
        return;
      }

      sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return true;
});
})();
