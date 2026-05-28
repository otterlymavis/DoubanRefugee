const DEFAULTS = {
  mediaType: "movie",
  maxPages: "200",
  webAppUrl: "http://localhost:3000"
};

let extractedPayload = undefined;

const webAppUrlInput = document.querySelector("#webAppUrl");
const maxPagesInput = document.querySelector("#maxPages");
const mediaTypeInput = document.querySelector("#mediaType");
const scrapeButton = document.querySelector("#scrapeButton");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const openButton = document.querySelector("#openButton");
const statusStartPageInput = document.querySelector("#statusStartPage");
const statusEndPageInput = document.querySelector("#statusEndPage");
const statusScrapeButton = document.querySelector("#statusScrapeButton");
const statusCopyButton = document.querySelector("#statusCopyButton");
const statusDownloadButton = document.querySelector("#statusDownloadButton");
const statusCancelButton = document.querySelector("#statusCancelButton");
const statusText = document.querySelector("#statusText");
const preview = document.querySelector("#preview");
const webAppLink = document.querySelector("#webAppLink");
let statusPayload = undefined;
let activeStatusRequestId = "";

function setStatus(message) {
  statusText.textContent = message;
}

function showPreview(payload) {
  preview.style.display = "block";
  preview.textContent = JSON.stringify(payload, null, 2);
}

function normalizeUrl(value) {
  return (value || DEFAULTS.webAppUrl).replace(/\/+$/, "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  webAppUrlInput.value = stored.webAppUrl || DEFAULTS.webAppUrl;
  maxPagesInput.value = stored.maxPages || DEFAULTS.maxPages;
  mediaTypeInput.value = stored.mediaType || DEFAULTS.mediaType;
  webAppLink.href = normalizeUrl(stored.webAppUrl || DEFAULTS.webAppUrl);
}

async function saveSettings() {
  const webAppUrl = normalizeUrl(webAppUrlInput.value);
  const maxPages = normalizeMaxPages(maxPagesInput.value);
  maxPagesInput.value = maxPages;
  await chrome.storage.local.set({
    maxPages,
    mediaType: mediaTypeInput.value,
    webAppUrl
  });
  webAppLink.href = webAppUrl;
  return webAppUrl;
}

function normalizeMaxPages(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULTS.maxPages;
  return String(Math.max(1, Math.min(200, Math.floor(parsed))));
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "1";
  return String(Math.max(1, Math.floor(parsed)));
}

async function scrapeHistory() {
  await saveSettings();
  const tab = await getActiveTab();

  if (!tab.url || !tab.url.includes("douban.com")) {
    throw new Error("Open your douban.com collection/history page first.");
  }

  const response = await requestExtraction(tab.id, {
    type: "DOUBAN_REFUGEE_SCRAPE_HISTORY",
    mediaType: mediaTypeInput.value,
    maxPages: Number(maxPagesInput.value)
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The paged history scraper did not respond.");
  }

  extractedPayload = {
    exported_at: new Date().toISOString(),
    source_profile: {
      client: "douban-refugee-extension",
      page: response.page,
      scrape: {
        max_pages: response.max_pages,
        pages: response.pages || [],
        reached_max_pages: Boolean(response.reached_max_pages)
      }
    },
    items: response.items || []
  };

  const hasItems = extractedPayload.items.length > 0;
  copyButton.disabled = !hasItems;
  downloadButton.disabled = !hasItems;
  const limitNote = response.reached_max_pages ? " The safety limit was reached; increase it and scrape again if your history is longer." : "";
  const completedCount = extractedPayload.items.filter((item) => item.collection_status === "completed" || item.collection_status === "watched").length;
  const wishlistCount = extractedPayload.items.filter((item) => item.collection_status === "watchlist").length;
  setStatus(`Scraped ${completedCount} completed and ${wishlistCount} wanted ${mediaTypeInput.value} item(s) from ${response.pages?.length || 0} Douban page(s).${limitNote} Download JSON, then import it in the web app for transfer files.`);
  showPreview({
    page: response.page,
    scraped_pages: response.pages?.length || 0,
    items: extractedPayload.items.slice(0, 5)
  });
}

async function scrapeStatuses() {
  await saveSettings();
  const tab = await getActiveTab();

  if (!tab.url || !tab.url.includes("douban.com") || !tab.url.includes("/statuses")) {
    throw new Error("Open a Douban statuses page first, such as https://www.douban.com/people/<id>/statuses.");
  }

  const startPage = Number(normalizePage(statusStartPageInput.value));
  const endPage = Math.max(startPage, Number(normalizePage(statusEndPageInput.value)));
  statusStartPageInput.value = String(startPage);
  statusEndPageInput.value = String(endPage);
  activeStatusRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await chrome.storage.local.set({ statusScrapeCancelRequestId: "" });

  const response = await requestExtraction(tab.id, {
    type: "DOUBAN_REFUGEE_SCRAPE_STATUSES",
    startPage,
    endPage,
    requestId: activeStatusRequestId
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The Douban status scraper did not respond.");
  }

  statusPayload = {
    exported_at: new Date().toISOString(),
    source_profile: {
      client: "douban-refugee-extension",
      page: response.page,
      status_scrape: {
        user_name: response.user_name,
        start_page: response.start_page,
        end_page: response.end_page,
        pages: response.pages || [],
        cancelled: Boolean(response.cancelled)
      }
    },
    statuses: response.statuses || []
  };

  const hasStatuses = statusPayload.statuses.length > 0;
  statusCopyButton.disabled = !hasStatuses;
  statusDownloadButton.disabled = !hasStatuses;
  const cancelNote = response.cancelled ? " The scrape was cancelled after saving completed pages." : "";
  setStatus(`Scraped ${statusPayload.statuses.length} Douban status(es) from ${response.pages?.length || 0} page(s).${cancelNote} Download JSON, then import it in the web app for Markdown export.`);
  showPreview({
    page: response.page,
    scraped_pages: response.pages?.length || 0,
    statuses: statusPayload.statuses.slice(0, 3)
  });
}

async function requestExtraction(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function copyJson() {
  if (!extractedPayload) return;
  await navigator.clipboard.writeText(JSON.stringify(extractedPayload, null, 2));
  setStatus("Copied JSON to clipboard. Paste it into the web app's Import JSON flow.");
}

function downloadJson() {
  if (!extractedPayload) return;
  const blob = new Blob([JSON.stringify(extractedPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "douban-refugee-import.json";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded douban-refugee-import.json.");
}

async function copyStatusJson() {
  if (!statusPayload) return;
  await navigator.clipboard.writeText(JSON.stringify(statusPayload, null, 2));
  setStatus("Copied status JSON to clipboard. Paste it into the web app's Status Backup import.");
}

function downloadStatusJson() {
  if (!statusPayload) return;
  const blob = new Blob([JSON.stringify(statusPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "douban-refugee-statuses.json";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded douban-refugee-statuses.json.");
}

scrapeButton.addEventListener("click", async () => {
  scrapeButton.disabled = true;
  setStatus(`Scraping paginated Douban ${mediaTypeInput.value} completed and wanted pages from this tab...`);
  try {
    await scrapeHistory();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    scrapeButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await copyJson();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadButton.addEventListener("click", downloadJson);

statusScrapeButton.addEventListener("click", async () => {
  statusScrapeButton.disabled = true;
  statusCancelButton.disabled = false;
  setStatus("Scraping Douban statuses from the selected page range...");
  try {
    await scrapeStatuses();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    statusScrapeButton.disabled = false;
    statusCancelButton.disabled = true;
    activeStatusRequestId = "";
  }
});

statusCopyButton.addEventListener("click", async () => {
  try {
    await copyStatusJson();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

statusDownloadButton.addEventListener("click", downloadStatusJson);

statusCancelButton.addEventListener("click", async () => {
  if (!activeStatusRequestId) return;
  await chrome.storage.local.set({ statusScrapeCancelRequestId: activeStatusRequestId });
  setStatus("Cancel requested. The scraper will stop after the current page finishes.");
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "DOUBAN_REFUGEE_STATUS_PROGRESS" || message.requestId !== activeStatusRequestId) return;
  setStatus(`Scraped status page ${message.page} (${message.status_count} status(es) on this page).`);
});

openButton.addEventListener("click", async () => {
  const webAppUrl = await saveSettings();
  await chrome.tabs.create({ url: webAppUrl });
});

loadSettings().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error));
});
