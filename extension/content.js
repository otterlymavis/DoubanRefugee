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
    if (/\/people\/[^/]+\/collect\/?/.test(pathname)) return "completed";
  } catch {
    return undefined;
  }
  return undefined;
}

const DOUBAN_MEDIA_HOSTS = {
  movie: "movie.douban.com",
  book: "book.douban.com",
  music: "music.douban.com",
};

function userIdFromPeopleUrl(url = window.location.href) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.match(/^\/people\/([^/]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function userSectionStarts(currentUrl = window.location.href, mediaType = detectMediaType(currentUrl)) {
  const host = DOUBAN_MEDIA_HOSTS[mediaType];
  if (!host) return [];
  const userId = userIdFromPeopleUrl(currentUrl);
  if (!userId) return [];
  const encodedUserId = encodeURIComponent(userId);
  const mode = mediaType === "movie" ? "grid" : "list";
  return [
    {
      collection_status: "completed",
      label: `${mediaType}-completed`,
      url: `https://${host}/people/${encodedUserId}/collect?start=0&sort=time&rating=all&filter=all&mode=${mode}`,
    },
    {
      collection_status: "watchlist",
      label: `${mediaType}-wishlist`,
      url: `https://${host}/people/${encodedUserId}/wish?start=0&sort=time&rating=all&filter=all&mode=${mode}`,
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

function parsePartialDate(text) {
  const normalized = compact(text).replace(/\//g, "-");
  const fullDate = parseDate(normalized);
  if (fullDate) return fullDate;
  const yearMonth = normalized.match(/\b((?:19|20)\d{2})-(\d{1,2})\b/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2].padStart(2, "0")}`;
  const year = normalized.match(/\b(19|20)\d{2}\b/);
  return year ? year[0] : "";
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

function parseIntroMetadata(root, mediaType) {
  const introText = compact(root.querySelector(".info .intro, .intro")?.textContent || "");
  const parts = introText.split(/\s+\/\s+/).map(compact).filter(Boolean);
  const metadata = {};

  if (mediaType === "movie") {
    const firstPart = parts[0] || introText;
    const match = firstPart.match(/^(\d{4}(?:-\d{1,2})?(?:-\d{1,2})?)(?:\(([^)]+)\))?/);
    const releaseDate = match ? parsePartialDate(match[1]) : parsePartialDate(firstPart);
    if (releaseDate) metadata.release_date = releaseDate;
    if (match?.[2]) metadata.countries = match[2].split(/[\/,，、]/).map(compact).filter(Boolean);
    return metadata;
  }

  if (mediaType === "book" || mediaType === "music") {
    const datePart = parts.find((part) => /\b(19|20)\d{2}\b/.test(part));
    const firstPart = parts[0] || "";
    if (firstPart && !/\b(19|20)\d{2}\b/.test(firstPart)) {
      metadata.creators = firstPart.split(/[\/,，、]/).map(compact).filter(Boolean);
    }
    const releaseDate = datePart ? parsePartialDate(datePart) : "";
    if (releaseDate) metadata.release_date = releaseDate;
  }

  return metadata;
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
  const introMetadata = parseIntroMetadata(root, itemMediaType);
  if (itemMediaType === "book" && introMetadata.creators?.length && !externalIds.author) {
    externalIds.author = introMetadata.creators.join(" / ");
  }
  if (itemMediaType === "music" && introMetadata.creators?.length && !externalIds.artist) {
    externalIds.artist = introMetadata.creators.join(" / ");
  }

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
    ...introMetadata,
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
  if (mediaType === "all") {
    const bySource = new Map();
    const pages = [];
    let reachedMaxPages = false;
    let max_pages = normalizePageLimit(maxPages);
    for (const type of ["movie", "book", "music"]) {
      const result = await scrapeDoubanHistory({ mediaType: type, maxPages });
      for (const item of result.items) bySource.set(sourceKey(item), item);
      pages.push(...result.pages.map((page) => ({ ...page, media_type: type })));
      reachedMaxPages = reachedMaxPages || result.reached_max_pages;
      max_pages = result.max_pages;
      await delay(PAGE_DELAY_MS);
    }
    return {
      items: Array.from(bySource.values()),
      pages,
      reached_max_pages: reachedMaxPages,
      max_pages,
      media_type: "all",
    };
  }

  const limit = normalizePageLimit(maxPages);
  const seenUrls = new Set();
  const bySource = new Map();
  const pages = [];
  const starts = userSectionStarts(window.location.href, mediaType || detectMediaType());
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

function statusIdFromRoot(root) {
  return root.getAttribute("data-sid") || root.id?.replace(/^status-/, "") || root.querySelector("a[href*='/status/']")?.href?.match(/\/status(?:es)?\/(\d+)/)?.[1] || "";
}

function authorFromElement(element) {
  if (!element) return { name: "", uid: "", link: "" };
  const href = element.href || element.getAttribute?.("href") || "";
  return {
    name: compact(element.textContent || ""),
    uid: href.match(/people\/([^/]+)/)?.[1] || "",
    link: href ? absoluteUrl(href, window.location.href) : "",
  };
}

function parseCountNear(root, patterns) {
  const text = compact(root.textContent || "");
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1] || 0);
  }
  return undefined;
}

function cleanStatusContent(value) {
  return compact(value)
    .replace(/^(转发[:：]\s*)+/, "转发：")
    .replace(/function\s*\([^)]*\)\s*\{.*?\}/g, "")
    .trim();
}

function firstText(root, selectors) {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = compact(element?.textContent || "");
    if (text) return text;
  }
  return "";
}

function extractStatusCard(root) {
  const card = root.querySelector(".card, .status-card, .attachment, .rec-sec, .block-card");
  if (!card) return null;
  const link = card.querySelector("a[href]");
  const title = compact(card.querySelector(".title, h3, h4, a")?.textContent || link?.textContent || "");
  const description = compact(card.querySelector(".desc, .abstract, .content, p")?.textContent || "");
  const url = link ? absoluteUrl(link.getAttribute("href") || link.href, window.location.href) : "";
  return title || description || url ? { title, description, url } : null;
}

function extractStatusTopic(root) {
  const link = root.querySelector("a[href*='/topic/'], a[href*='douban.com/group/topic/']");
  if (!link) return null;
  return {
    title: compact(link.textContent || "") || "Topic",
    url: absoluteUrl(link.getAttribute("href") || link.href, window.location.href),
  };
}

function extractVisibleComments(root) {
  return Array.from(root.querySelectorAll(".lite-comment-item, .comment-item, .comments-items li"))
    .map((comment) => {
      const authorElement = comment.querySelector(".lite-comment-item-author, .author, a[href*='/people/']");
      const content = compact(comment.querySelector(".lite-comment-item-content, .content, p")?.textContent || comment.textContent || "");
      return {
        author: authorFromElement(authorElement),
        content,
      };
    })
    .filter((comment) => comment.content);
}

function extractResharedStatus(root) {
  const reshared = root.querySelector(".status-reshared-wrapper .status-item, .status-real-wrapper, .reshared-status, blockquote");
  if (!reshared) return null;
  const author = authorFromElement(reshared.querySelector(".lnk-people, .user-name, a[href*='/people/']"));
  const content = cleanStatusContent(firstText(reshared, [".status-saying", ".status-content", ".text", ".content", "p", "blockquote"]));
  const timeElement = reshared.querySelector(".created_at, .lnk-time, a[href*='/status/']");
  return content ? {
    author,
    content,
    created_at: timeElement?.getAttribute("title") || compact(timeElement?.textContent || ""),
    source_url: timeElement?.href ? absoluteUrl(timeElement.href, window.location.href) : "",
  } : null;
}

function extractSingleDoubanStatus(root, pageUrl = window.location.href) {
  if (root.closest(".status-real-wrapper") && root.closest(".status-reshared-wrapper")) return undefined;
  const sourceId = statusIdFromRoot(root);
  if (!sourceId) return undefined;

  const timeElement = root.querySelector(".created_at, .lnk-time, a[href*='/status/']");
  const author = authorFromElement(root.querySelector(".lnk-people, .user-name, a[href*='/people/']"));
  const sourceUrl = timeElement?.href ? absoluteUrl(timeElement.href, pageUrl) : `${pageUrl.replace(/[?#].*$/, "")}/status/${sourceId}/`;
  const content = cleanStatusContent(
    firstText(root, [
      ".status-saying blockquote p",
      ".status-saying",
      ".status-content",
      ".text",
      ".content blockquote p",
      ".content p",
      "blockquote p",
    ]),
  );

  const images = Array.from(root.querySelectorAll(".status-images img, .topic-pics img, .pics-wrapper img, .photo-item img"))
    .map((image) => {
      const src = image.getAttribute("src") || image.getAttribute("data-original") || "";
      if (!src) return undefined;
      return {
        url: absoluteUrl(src.replace("/small/", "/large/").replace("/medium/", "/large/"), pageUrl),
        alt: image.getAttribute("alt") || "image",
      };
    })
    .filter(Boolean);

  return {
    source_platform: "douban",
    source_id: sourceId,
    source_url: sourceUrl,
    status_type: root.getAttribute("data-atype") || "",
    author,
    created_at: timeElement?.getAttribute("title") || timeElement?.getAttribute("data-time") || compact(timeElement?.textContent || ""),
    activity: compact(root.querySelector(".activity")?.textContent || ""),
    rating: compact(root.querySelector(".rating-stars, [class*='allstar'], [class*='rating']")?.textContent || ""),
    content,
    images,
    card: extractStatusCard(root),
    topic: extractStatusTopic(root),
    reshared_status: extractResharedStatus(root),
    comments: extractVisibleComments(root),
    like_count: parseCountNear(root.querySelector(".actions, .status-actions") || root, [/赞\(?(\d+)\)?/, /like\(?(\d+)\)?/i]),
    reshare_count: parseCountNear(root.querySelector(".actions, .status-actions") || root, [/转发\(?(\d+)\)?/, /reshare\(?(\d+)\)?/i]),
    comment_count: parseCountNear(root.querySelector(".actions, .status-actions") || root, [/回应\(?(\d+)\)?/, /评论\(?(\d+)\)?/, /comment\(?(\d+)\)?/i]),
  };
}

function extractDoubanStatuses(documentLike = document, pageUrl = window.location.href) {
  const roots = Array.from(documentLike.querySelectorAll(".status-item, [data-sid]"));
  const seen = new Set();
  const statuses = [];
  for (const root of roots) {
    const status = extractSingleDoubanStatus(root, pageUrl);
    if (status && !seen.has(status.source_id)) {
      seen.add(status.source_id);
      statuses.push(status);
    }
  }
  return statuses;
}

function userNameFromStatusPage(documentLike = document, pageUrl = window.location.href) {
  return compact(documentLike.querySelector("h1, .info h1")?.textContent || "") || pageUrl.match(/\/people\/([^/]+)/)?.[1] || "Douban user";
}

function pageOwnerId(url = window.location.href) {
  try {
    const parsed = new URL(url);
    const people = parsed.pathname.match(/\/people\/([^/]+)/)?.[1];
    if (people) return people;
    return compact(document.querySelector("a[href*='/people/']")?.href?.match(/\/people\/([^/]+)/)?.[1] || "");
  } catch {
    return "";
  }
}

function statusPageUrl(pageNumber, currentUrl = window.location.href) {
  const url = new URL(currentUrl);
  url.searchParams.set("p", String(pageNumber));
  return url.toString();
}

function accountBackupStartUrl(backupType, pageNumber, currentUrl = window.location.href) {
  if (backupType === "current") return currentUrl;
  const userId = pageOwnerId(currentUrl);
  if (!userId) return currentUrl;
  const start = Math.max(0, (pageNumber - 1) * 10);
  if (backupType === "profile") return `https://www.douban.com/people/${encodeURIComponent(userId)}/`;
  if (backupType === "status") {
    return statusPageUrl(pageNumber, currentUrl.includes("/statuses") ? currentUrl : `https://www.douban.com/people/${encodeURIComponent(userId)}/statuses`);
  }

  const sectionPath = {
    diary: "notes",
    review: "reviews",
    post: "discussion",
    reply: "comments",
    album: "photos",
    doulist: "doulists/all",
    relationship: "contacts",
    event: "events",
  }[backupType] || "";
  return sectionPath ? `https://www.douban.com/people/${encodeURIComponent(userId)}/${sectionPath}?start=${start}` : currentUrl;
}

function accountBackupStartUrls(backupType, pageNumber, currentUrl = window.location.href) {
  const primary = accountBackupStartUrl(backupType, pageNumber, currentUrl);
  if (backupType !== "relationship") return [primary];
  return [primary, primary.replace("/contacts?", "/rev_contacts?")];
}

function statusPageNumber(url = window.location.href) {
  try {
    return Number(new URL(url).searchParams.get("p") || "1") || 1;
  } catch {
    return 1;
  }
}

async function scrapeDoubanStatuses({ startPage, endPage, requestId }) {
  const start = Math.max(1, Math.floor(Number(startPage) || statusPageNumber()));
  const end = Math.max(start, Math.floor(Number(endPage) || start));
  const bySource = new Map();
  const pages = [];
  let cancelled = false;

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    const pageUrl = accountBackupStartUrl("status", pageNumber);
    const documentLike = pageUrl === window.location.href ? document : await fetchDoubanDocument(pageUrl);
    const statuses = extractDoubanStatuses(documentLike, pageUrl);
    for (const status of statuses) bySource.set(status.source_id, status);
    pages.push({ page: pageNumber, url: pageUrl, title: documentLike.title, status_count: statuses.length });

    chrome.runtime.sendMessage({
      type: "DOUBAN_REFUGEE_STATUS_PROGRESS",
      requestId,
      page: pageNumber,
      total: end - start + 1,
      status_count: statuses.length,
    }).catch(() => {});

    const stop = await chrome.storage.local.get({ statusScrapeCancelRequestId: "" });
    if (stop.statusScrapeCancelRequestId === requestId) {
      cancelled = true;
      break;
    }
    if (pageNumber < end) await delay(PAGE_DELAY_MS);
  }

  return {
    statuses: Array.from(bySource.values()),
    pages,
    cancelled,
    user_name: userNameFromStatusPage(),
    start_page: start,
    end_page: end,
  };
}

function backupEntryIdFromUrl(url, fallbackPrefix = "entry") {
  const absolute = absoluteUrl(url, window.location.href);
  const match = absolute.match(/\/(?:status|statuses|note|review|topic|album|photos|doulist|event|people)\/([^/?#]+)/) || absolute.match(/\/([^/?#]+)\/?$/);
  return match ? match[1] : `${fallbackPrefix}-${Math.random().toString(36).slice(2)}`;
}

function detectBackupTypeFromUrl(url = window.location.href) {
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

function normalizeBackupEntryType(detected, backupType) {
  if (backupType === "reply") return "reply";
  if (backupType === "album") return detected === "photo" ? "photo" : "album";
  if (detected === "unknown" || detected === "profile") return backupType;
  return detected;
}

function backupLinkPatterns(backupType) {
  return {
    diary: ["/note/"],
    review: ["/review/"],
    post: ["/group/topic/"],
    reply: ["/group/topic/", "/review/", "/note/", "/subject/"],
    album: ["/album/", "/photos/photo/"],
    doulist: ["/doulist/"],
    relationship: ["/people/"],
    event: ["/event/"],
    unknown: ["/note/", "/review/", "/group/topic/", "/album/", "/photos/photo/", "/doulist/", "/event/", "/people/"],
  }[backupType] || ["/note/", "/review/", "/group/topic/", "/album/", "/photos/photo/", "/doulist/", "/event/", "/people/"];
}

function metadataForBackupRoot(root, entryType, pageUrl) {
  return {
    section: entryType,
    image_count: root?.querySelectorAll?.("img")?.length || 0,
    links: Array.from(root?.querySelectorAll?.("a[href]") || [])
      .map((anchor) => absoluteUrl(anchor.getAttribute("href") || anchor.href || "", pageUrl))
      .slice(0, 20),
  };
}

function extractProfileBackupEntry(documentLike = document, pageUrl = window.location.href) {
  const userId = pageUrl.match(/\/people\/([^/]+)/)?.[1] || pageOwnerId(pageUrl) || "profile";
  const title = compact(documentLike.querySelector("h1, .info h1, .user-info h1")?.textContent || documentLike.title || userId);
  const avatar = documentLike.querySelector(".userface img, .pic img, img.userface, img[alt]")?.getAttribute("src") || "";
  const intro = compact(documentLike.querySelector(".user-intro, .intro, #display")?.textContent || "");
  const signature = compact(documentLike.querySelector(".signature, .user-info .pl, .info .pl")?.textContent || "");
  return {
    source_platform: "douban",
    source_id: userId,
    source_url: pageUrl,
    entry_type: "profile",
    title,
    author: { name: title, uid: userId, link: pageUrl },
    content: [intro, signature].filter(Boolean).join("\n\n"),
    images: avatar ? [{ url: absoluteUrl(avatar, pageUrl), alt: `${title} avatar` }] : [],
    comments: [],
    metadata: metadataForBackupRoot(documentLike, "profile", pageUrl),
  };
}

function extractDetailBackupEntry(documentLike = document, pageUrl = window.location.href, backupType = detectBackupTypeFromUrl(pageUrl)) {
  const selectors = {
    diary: ".note, #link-report, .article, main",
    review: ".review-content, #link-report, .article, main",
    post: ".topic-content, #link-report, .article, main",
    album: ".album, .photolst, #link-report, .article, main",
    doulist: ".doulist, .doulist-list, #link-report, .article, main",
    event: ".event, #link-report, .article, main",
    unknown: "#content, .article, main",
  };
  const title = firstText(documentLike, ["h1", "title"]);
  const contentRoot = documentLike.querySelector(selectors[backupType] || selectors.unknown);
  const content = compact(contentRoot?.textContent || "");
  const hasDetailUrl = /\/(?:note|review|topic|album|photos\/photo|doulist|event)\/\d+/.test(pageUrl);
  if (!hasDetailUrl || (!title && !content)) return undefined;
  const author = authorFromElement(documentLike.querySelector(".author a[href*='/people/'], .user-info a[href*='/people/'], a[href*='/people/']"));
  const timeElement = documentLike.querySelector(".pub-date, .created_at, .main-meta, .topic-doc .color-green, .review-meta");
  return {
    source_platform: "douban",
    source_id: backupEntryIdFromUrl(pageUrl, backupType),
    source_url: pageUrl,
    entry_type: normalizeBackupEntryType(detectBackupTypeFromUrl(pageUrl), backupType),
    title,
    author,
    created_at: compact(timeElement?.getAttribute("title") || timeElement?.textContent || ""),
    content,
    images: Array.from(documentLike.querySelectorAll("#link-report img, .article img, main img"))
      .map((image) => ({ url: absoluteUrl(image.getAttribute("src") || image.getAttribute("data-original") || "", pageUrl), alt: image.getAttribute("alt") || "image" }))
      .filter((image) => image.url),
    comments: extractVisibleComments(documentLike),
    comment_count: parseCountNear(documentLike, [/回应\(?(\d+)\)?/, /评论\(?(\d+)\)?/, /comment\(?(\d+)\)?/i]),
    metadata: metadataForBackupRoot(contentRoot || documentLike, backupType, pageUrl),
  };
}

function extractListBackupEntries(documentLike = document, pageUrl = window.location.href, backupType = detectBackupTypeFromUrl(pageUrl)) {
  if (backupType === "profile") return [extractProfileBackupEntry(documentLike, pageUrl)];
  if (backupType === "status") return extractDoubanStatuses(documentLike, pageUrl);
  const linkPatterns = backupLinkPatterns(backupType);
  const anchors = Array.from(documentLike.querySelectorAll("a[href]"))
    .filter((anchor) => linkPatterns.some((pattern) => (anchor.getAttribute("href") || anchor.href || "").includes(pattern)));
  const bySource = new Map();

  for (const anchor of anchors) {
    const href = absoluteUrl(anchor.getAttribute("href") || anchor.href, pageUrl);
    const entryType = normalizeBackupEntryType(detectBackupTypeFromUrl(href), backupType);
    const root = anchor.closest(".note-item, .review-item, .topic-list li, .olt tr, .item, .albumlst li, .photolst li, .doulist-item, .events-list li, .obu, li, tr, .article") || anchor.parentElement;
    const title = compact(anchor.textContent || "");
    const content = compact(root?.querySelector?.(".abstract, .short-content, .content, .reply-doc, p")?.textContent || root?.textContent || title);
    const author = authorFromElement(root?.querySelector?.("a[href*='/people/']"));
    const timeElement = root?.querySelector?.(".date, .time, .pub-date, .created_at, .color-green");
    const entry = {
      source_platform: "douban",
      source_id: backupEntryIdFromUrl(href, entryType),
      source_url: href,
      entry_type: entryType,
      title,
      author,
      created_at: compact(timeElement?.getAttribute("title") || timeElement?.textContent || ""),
      content,
      images: Array.from(root?.querySelectorAll?.("img") || [])
        .map((image) => ({ url: absoluteUrl(image.getAttribute("src") || image.getAttribute("data-original") || "", pageUrl), alt: image.getAttribute("alt") || "image" }))
        .filter((image) => image.url),
      comments: extractVisibleComments(root || anchor),
      comment_count: parseCountNear(root || anchor, [/回应\(?(\d+)\)?/, /评论\(?(\d+)\)?/, /comment\(?(\d+)\)?/i]),
      metadata: metadataForBackupRoot(root, entryType, pageUrl),
    };
    if (entry.source_id && (entry.title || entry.content)) bySource.set(`${entry.entry_type}:${entry.source_id}`, entry);
  }

  const detail = extractDetailBackupEntry(documentLike, pageUrl, backupType);
  if (detail) bySource.set(`${detail.entry_type}:${detail.source_id}`, detail);
  return Array.from(bySource.values());
}

function attachBackupRun(entries, { selectedTypes, startPage, endPage, pages = [], errors = [] }) {
  const backupRun = {
    user_id: pageOwnerId(),
    selected_sections: selectedTypes,
    start_page: startPage,
    end_page: endPage,
    scraped_pages: pages,
    errors: errors.map((error) => typeof error === "string" ? error : `${error?.backup_type || "section"}: ${error?.error || String(error)}`),
    scraped_at: new Date().toISOString(),
  };
  return entries.map((entry) => ({
    ...entry,
    metadata: {
      ...(entry.metadata || {}),
      backup_run: backupRun,
    },
  }));
}

async function scrapeDoubanAccountBackup({ backupType = "all", backupTypes, startPage, endPage, requestId }) {
  const selectedTypes = Array.isArray(backupTypes) && backupTypes.length ? backupTypes : (backupType === "all" ? ["status", "diary", "review", "post", "reply", "album", "doulist", "profile", "relationship", "event"] : [backupType]);

  if (selectedTypes.length > 1) {
    const bySource = new Map();
    const pages = [];
    const errors = [];
    let cancelled = false;
    for (const type of selectedTypes) {
      try {
        const result = await scrapeDoubanAccountBackup({ backupType: type, startPage, endPage, requestId });
        for (const entry of result.entries || result.statuses || []) {
          const typedEntry = {
            ...entry,
            entry_type: entry.entry_type || type,
            metadata: {
              ...(entry.metadata || {}),
              backup_run: {
                selected_sections: selectedTypes,
                start_page: startPage,
                end_page: endPage,
                scraped_at: new Date().toISOString(),
              },
            },
          };
          bySource.set(`${typedEntry.entry_type}:${typedEntry.source_id}`, typedEntry);
        }
        pages.push(...(result.pages || []).map((page) => ({ ...page, backup_type: type })));
        cancelled = cancelled || Boolean(result.cancelled);
      } catch (error) {
        errors.push({ backup_type: type, error: error instanceof Error ? error.message : String(error) });
      }
      if (cancelled) break;
      await delay(PAGE_DELAY_MS);
    }
    const normalizedStart = Math.max(1, Math.floor(Number(startPage) || 1));
    const normalizedEnd = Math.max(normalizedStart, Math.floor(Number(endPage) || normalizedStart));
    const entries = attachBackupRun(Array.from(bySource.values()), {
      selectedTypes,
      startPage: normalizedStart,
      endPage: normalizedEnd,
      pages,
      errors,
    });
    return {
      entries,
      statuses: entries,
      pages,
      cancelled,
      user_name: userNameFromStatusPage(),
      start_page: normalizedStart,
      end_page: normalizedEnd,
      backup_type: "all",
      backup_types: selectedTypes,
      errors,
    };
  }

  if (backupType === "status") {
    const result = await scrapeDoubanStatuses({ startPage, endPage, requestId });
    const entries = attachBackupRun(result.statuses, {
      selectedTypes,
      startPage: result.start_page,
      endPage: result.end_page,
      pages: result.pages,
    });
    return { ...result, entries, statuses: entries, backup_type: "status" };
  }

  const start = Math.max(1, Math.floor(Number(startPage) || 1));
  const end = backupType === "current" || backupType === "profile" ? start : Math.max(start, Math.floor(Number(endPage) || start));
  const bySource = new Map();
  const pages = [];
  let cancelled = false;
  const startUrls = accountBackupStartUrls(backupType, start);
  const totalPages = (end - start + 1) * startUrls.length;
  let completedPages = 0;

  for (const startUrl of startUrls) {
    let nextUrl = startUrl;
    for (let pageNumber = start; pageNumber <= end && nextUrl; pageNumber += 1) {
      const documentLike = nextUrl === window.location.href ? document : await fetchDoubanDocument(nextUrl);
      const entries = extractListBackupEntries(documentLike, nextUrl, backupType);
      for (const entry of entries) bySource.set(`${entry.entry_type}:${entry.source_id}`, entry);
      pages.push({ page: pageNumber, url: nextUrl, title: documentLike.title, entry_count: entries.length });
      completedPages += 1;

      chrome.runtime.sendMessage({
        type: "DOUBAN_REFUGEE_STATUS_PROGRESS",
        requestId,
        page: completedPages,
        total: totalPages,
        entry_count: entries.length,
      }).catch(() => {});

      const stop = await chrome.storage.local.get({ statusScrapeCancelRequestId: "" });
      if (stop.statusScrapeCancelRequestId === requestId) {
        cancelled = true;
        break;
      }

      const discoveredNextUrl = findNextPageUrl(documentLike, nextUrl);
      nextUrl = backupType === "current" ? "" : discoveredNextUrl;
      if (nextUrl && pageNumber < end) await delay(PAGE_DELAY_MS);
    }
    if (cancelled) break;
    if (startUrls.length > 1) await delay(PAGE_DELAY_MS);
  }

  const entries = attachBackupRun(Array.from(bySource.values()), {
    selectedTypes,
    startPage: start,
    endPage: end,
    pages,
  });
  return {
    entries,
    statuses: entries,
    pages,
    cancelled,
    user_name: userNameFromStatusPage(),
    start_page: start,
    end_page: end,
    backup_type: backupType,
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

      if (message.type === "DOUBAN_REFUGEE_SCRAPE_STATUSES" || message.type === "DOUBAN_REFUGEE_SCRAPE_ACCOUNT_BACKUP") {
        const result = await scrapeDoubanAccountBackup(message);
        sendResponse({
          ok: true,
          ...result,
          page: {
            title: document.title,
            url: window.location.href,
            media_type: "status",
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
