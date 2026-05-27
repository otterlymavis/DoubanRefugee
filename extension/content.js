(() => {
if (window.__doubanRefugeeContentScriptLoaded) return;
window.__doubanRefugeeContentScriptLoaded = true;

function compact(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href) {
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return href || "";
  }
}

function subjectIdFromUrl(url) {
  const match = absoluteUrl(url).match(/\/subject\/(\d+)\/?/);
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

function parseExternalIds(root) {
  const text = compact(root.textContent);
  const imdb = text.match(/\btt\d{7,9}\b/i);
  const isbn = text.match(/\b(?:97[89][-\s]?)?(?:\d[-\s]?){9,12}[\dX]\b/i);
  const externalIds = {};
  if (imdb) externalIds.imdb = imdb[0];
  if (isbn) externalIds.isbn = isbn[0].replace(/[-\s]/g, "");
  return externalIds;
}

function itemFromRoot(root, anchor, mediaType) {
  const href = anchor ? anchor.href : window.location.href;
  const sourceId = subjectIdFromUrl(href);
  if (!sourceId) return undefined;

  const titleNode =
    root.querySelector(".title a") ||
    root.querySelector(".title") ||
    root.querySelector("h1 span[property='v:itemreviewed']") ||
    root.querySelector("h1 span") ||
    root.querySelector("h1") ||
    anchor;

  const rawTitle = compact(titleNode ? titleNode.textContent : anchor?.textContent);
  const title = rawTitle.replace(/\s*\((19|20)\d{2}\)\s*$/, "");
  if (!title) return undefined;

  const year = parseYear(root.textContent);
  const rating = parseRating(root);
  const consumedDate = parseConsumedDate(root.textContent);
  const reviewNode = root.querySelector(".comment, .short, .review-short, blockquote");
  const review = compact(reviewNode?.textContent);
  const externalIds = parseExternalIds(root);

  const item = {
    media_type: mediaType || detectMediaType(href),
    source_platform: "douban",
    source_id: sourceId,
    titles: { zh: title },
    tags: ["douban-extension"],
    external_ids: externalIds
  };

  if (year) item.year = year;
  if (rating) item.rating = rating;
  if (consumedDate) item.consumed_date = consumedDate;
  if (review) item.review = review;

  return item;
}

function extractListItems(mediaType) {
  const candidates = Array.from(
    document.querySelectorAll(".item, .doulist-item, li.subject-item, .grid-view li, .item-root, .article li")
  );
  const items = [];
  const seen = new Set();

  for (const root of candidates) {
    const anchor = root.querySelector("a[href*='douban.com/subject/'], a[href*='/subject/']");
    const item = anchor ? itemFromRoot(root, anchor, mediaType) : undefined;
    if (item && !seen.has(item.source_id)) {
      seen.add(item.source_id);
      items.push(item);
    }
  }

  return items;
}

function extractSubjectPage(mediaType) {
  const sourceId = subjectIdFromUrl(window.location.href);
  if (!sourceId) return [];
  const item = itemFromRoot(document, undefined, mediaType);
  return item ? [item] : [];
}

function extractDoubanItems(mediaType) {
  const items = extractListItems(mediaType);
  return items.length > 0 ? items : extractSubjectPage(mediaType);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "DOUBAN_REFUGEE_EXTRACT") return false;

  try {
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
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return true;
});
})();
