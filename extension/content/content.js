/**
 * DoubanRefugee Content Script
 * Injected into Douban interest list pages to extract media history.
 *
 * Supported URLs:
 *   https://www.douban.com/people/{user}/collect  (movies, books, music via ?type=)
 *   https://www.douban.com/people/{user}/wish
 *   https://www.douban.com/people/{user}/do
 *   https://movie.douban.com/people/{user}/collect
 *   https://book.douban.com/people/{user}/collect
 *   https://music.douban.com/people/{user}/collect
 */

(function () {
  "use strict";

  // ── Page detection ──────────────────────────────────────────────────────────

  function detectPage() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const search = window.location.search;

    // Match /people/{user}/{interestType}
    const pathMatch = pathname.match(/\/people\/([^/]+)\/(collect|wish|do)/);
    if (!pathMatch) return null;

    const username = pathMatch[1];
    const interestType = pathMatch[2]; // collect | wish | do

    // Determine media type
    let mediaType = "movie";
    if (hostname === "book.douban.com") {
      mediaType = "book";
    } else if (hostname === "music.douban.com") {
      mediaType = "music";
    } else {
      const params = new URLSearchParams(search);
      const t = params.get("type");
      if (t === "book") mediaType = "book";
      else if (t === "music") mediaType = "music";
      else mediaType = "movie";
    }

    // Try to get total item count from page
    let totalItems = null;
    const numEl = document.querySelector("#content h1 span, .subject-list .title span");
    if (numEl) {
      const m = numEl.textContent.match(/\d+/);
      if (m) totalItems = parseInt(m[0], 10);
    }

    // Pagination: items per page (Douban uses 15)
    const ITEMS_PER_PAGE = 15;
    const params2 = new URLSearchParams(search);
    const start = parseInt(params2.get("start") || "0", 10);
    const currentPage = Math.floor(start / ITEMS_PER_PAGE) + 1;
    const totalPages = totalItems ? Math.ceil(totalItems / ITEMS_PER_PAGE) : null;

    return { username, interestType, mediaType, totalItems, currentPage, totalPages };
  }

  // ── Item extraction ─────────────────────────────────────────────────────────

  function extractRating(el) {
    for (let i = 5; i >= 1; i--) {
      if (el.querySelector(`.rating${i}-t`)) return { value: i, scale: 5 };
    }
    return null;
  }

  function extractTags(el) {
    const tagsEl = el.querySelector(".tags, .interest-tags");
    if (!tagsEl) return [];
    return Array.from(tagsEl.querySelectorAll("a"))
      .map((a) => a.textContent.trim())
      .filter(Boolean);
  }

  function extractItem(el, mediaType) {
    // Subject link — required
    const linkEl =
      el.querySelector("a[href*='/subject/']") ||
      el.querySelector(".title a") ||
      el.querySelector(".hd a");
    if (!linkEl) return null;

    const url = linkEl.getAttribute("href") || "";
    const idMatch = url.match(/\/subject\/(\d+)\//);
    const sourceId = idMatch ? idMatch[1] : null;
    if (!sourceId) return null;

    // Titles
    const titleEl =
      el.querySelector(".title em") ||
      el.querySelector(".title a") ||
      el.querySelector(".hd a em") ||
      el.querySelector(".hd a") ||
      linkEl;
    const titleZh = titleEl ? titleEl.textContent.trim() : "";

    // Alternate title from img alt
    const imgEl = el.querySelector("img[alt]");
    const altTitle = imgEl ? imgEl.getAttribute("alt").trim() : "";

    // Date (e.g. "2024-01-02 看过")
    const dateEl = el.querySelector(".date");
    let consumedDate = null;
    if (dateEl) {
      const m = dateEl.textContent.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) consumedDate = m[1];
    }

    // Rating
    const rating = extractRating(el);

    // Review / comment
    const commentEl =
      el.querySelector(".comment p") ||
      el.querySelector(".comment") ||
      el.querySelector(".review-text");
    const review = commentEl ? commentEl.textContent.trim() : null;

    // Tags
    const userTags = extractTags(el);
    const tags = ["douban", mediaType, ...userTags].filter(
      (v, i, a) => a.indexOf(v) === i, // deduplicate
    );

    return {
      media_type: mediaType,
      source_platform: "douban",
      source_id: sourceId,
      titles: buildTitles(titleZh, altTitle),
      consumed_date: consumedDate || undefined,
      rating: rating || undefined,
      review: review || undefined,
      tags,
      external_ids: {},
    };
  }

  function buildTitles(zh, alt) {
    const t = {};
    if (zh) t.zh = zh;
    if (alt && alt !== zh) t.original = alt;
    return t;
  }

  function extractItems(mediaType) {
    // Try multiple container selectors to handle different page layouts
    const selectors = [
      "#content .subject-item",
      "#content .item",
      ".interest-list .item",
      ".grid-view .item",
      ".subject-list .subject-item",
    ];

    let containers = [];
    for (const sel of selectors) {
      containers = Array.from(document.querySelectorAll(sel));
      if (containers.length > 0) break;
    }

    return containers
      .map((el) => extractItem(el, mediaType))
      .filter(Boolean);
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  function getNextPageUrl() {
    const next =
      document.querySelector(".paginator .next a") ||
      document.querySelector('a[rel="next"]') ||
      document.querySelector(".paginator a:last-child");

    if (!next) return null;

    const text = next.textContent || "";
    // Douban uses "后页" (next page in Chinese) or ">" for next
    if (text.includes("后页") || text.includes(">") || text.includes("›")) {
      return next.href || null;
    }
    return null;
  }

  function getPaginationInfo() {
    const paginator = document.querySelector(".paginator");
    if (!paginator) return { currentPage: 1, totalPages: 1, hasNext: false };

    const current = paginator.querySelector("span.thispage, .current");
    const currentPage = current ? parseInt(current.textContent, 10) || 1 : 1;

    const allLinks = Array.from(paginator.querySelectorAll("a"));
    let maxPage = currentPage;
    for (const a of allLinks) {
      const n = parseInt(a.textContent, 10);
      if (!isNaN(n) && n > maxPage) maxPage = n;
    }

    const hasNext = !!getNextPageUrl();

    return { currentPage, totalPages: maxPage, hasNext };
  }

  // ── Message handling ────────────────────────────────────────────────────────

  const pageInfo = detectPage();

  // Notify background/popup about the current page
  if (pageInfo) {
    chrome.runtime.sendMessage({
      type: "PAGE_INFO",
      pageInfo,
      url: window.location.href,
    });
  }

  // Listen for messages from background or popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SCRAPE_PAGE") {
      if (!pageInfo) {
        sendResponse({ ok: false, error: "Not a Douban interest page" });
        return true;
      }
      const items = extractItems(pageInfo.mediaType);
      const pagination = getPaginationInfo();
      const nextUrl = getNextPageUrl();
      sendResponse({ ok: true, items, pagination, nextUrl, pageInfo });
      return true;
    }

    if (message.type === "GET_PAGE_INFO") {
      sendResponse({ ok: true, pageInfo, url: window.location.href });
      return true;
    }

    if (message.type === "NAVIGATE_NEXT") {
      const nextUrl = getNextPageUrl();
      if (nextUrl) {
        window.location.href = nextUrl;
        sendResponse({ ok: true, navigating: true });
      } else {
        sendResponse({ ok: true, navigating: false });
      }
      return true;
    }
  });

  // Auto-collect mode: if the background marked this tab as active scraping,
  // extract items and report back immediately on page load.
  chrome.storage.local.get(["scrapingActive", "scrapingTabId"]).then((state) => {
    if (!state.scrapingActive || !pageInfo) return;

    const items = extractItems(pageInfo.mediaType);
    const pagination = getPaginationInfo();
    const nextUrl = getNextPageUrl();

    chrome.runtime.sendMessage({
      type: "AUTO_COLLECT_PAGE",
      items,
      pagination,
      nextUrl,
      pageInfo,
      url: window.location.href,
    });
  });
})();
