const DEFAULTS = {
  mediaType: "all",
  maxPages: "200",
  backupTypes: ["status", "diary", "review", "post", "reply", "album", "doulist", "profile", "relationship", "event"],
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
const copyCookieButton = document.querySelector("#copyCookieButton");
const cookieStatus = document.querySelector("#cookieStatus");
const statusStartPageInput = document.querySelector("#statusStartPage");
const statusEndPageInput = document.querySelector("#statusEndPage");
const statusScrapeButton = document.querySelector("#statusScrapeButton");
const statusCopyButton = document.querySelector("#statusCopyButton");
const statusDownloadButton = document.querySelector("#statusDownloadButton");
const statusCancelButton = document.querySelector("#statusCancelButton");
const statusProgress = document.querySelector("#statusProgress");
const statusText = document.querySelector("#statusText");
const backupTypeInputs = Array.from(document.querySelectorAll("input[name='backupTypes']"));
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
  if (!tab?.id) throw new Error(chrome.i18n.getMessage("errorNoTab"));
  return tab;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  webAppUrlInput.value = stored.webAppUrl || DEFAULTS.webAppUrl;
  maxPagesInput.value = stored.maxPages || DEFAULTS.maxPages;
  mediaTypeInput.value = stored.mediaType || DEFAULTS.mediaType;
  const selected = new Set(stored.backupTypes || DEFAULTS.backupTypes);
  backupTypeInputs.forEach((input) => { input.checked = selected.has(input.value); });
  webAppLink.href = normalizeUrl(stored.webAppUrl || DEFAULTS.webAppUrl);
}

async function saveSettings() {
  const webAppUrl = normalizeUrl(webAppUrlInput.value);
  const maxPages = normalizeMaxPages(maxPagesInput.value);
  maxPagesInput.value = maxPages;
  await chrome.storage.local.set({
    maxPages,
    mediaType: mediaTypeInput.value,
    backupTypes: selectedBackupTypes(),
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
    throw new Error(chrome.i18n.getMessage("errorOpenHistory"));
  }

  const response = await requestExtraction(tab.id, {
    type: "DOUBAN_REFUGEE_SCRAPE_HISTORY",
    mediaType: mediaTypeInput.value,
    maxPages: Number(maxPagesInput.value)
  });

  if (!response?.ok) {
    throw new Error(response?.error || chrome.i18n.getMessage("errorScraperNoResponse"));
  }

  extractedPayload = {
    exported_at: new Date().toISOString(),
    source_profile: {
      client: "douban-refugee-extension",
      page: response.page,
      scrape: {
        media_type: response.media_type,
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
  const limitNote = response.reached_max_pages ? " (Limit Reached)" : "";
  const completedCount = extractedPayload.items.filter((item) => item.collection_status === "completed" || item.collection_status === "watched").length;
  const wishlistCount = extractedPayload.items.filter((item) => item.collection_status === "watchlist").length;
  setStatus(chrome.i18n.getMessage("doneStatus", [String(completedCount), String(wishlistCount), limitNote]));
  showPreview({
    page: response.page,
    scraped_pages: response.pages?.length || 0,
    items: extractedPayload.items.slice(0, 5)
  });
}

async function scrapeAccountBackup() {
  await saveSettings();
  const tab = await getActiveTab();

  if (!tab.url || !tab.url.includes("douban.com")) {
    throw new Error(chrome.i18n.getMessage("errorOpenStatuses"));
  }

  const startPage = Number(normalizePage(statusStartPageInput.value));
  const endPage = Math.max(startPage, Number(normalizePage(statusEndPageInput.value)));
  statusStartPageInput.value = String(startPage);
  statusEndPageInput.value = String(endPage);
  activeStatusRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await chrome.storage.local.set({ statusScrapeCancelRequestId: "" });
  statusProgress.style.display = "block";
  statusProgress.value = 0;

  const response = await requestExtraction(tab.id, {
    type: "DOUBAN_REFUGEE_SCRAPE_ACCOUNT_BACKUP",
    backupTypes: selectedBackupTypes(),
    startPage,
    endPage,
    requestId: activeStatusRequestId
  });

  if (!response?.ok) {
    throw new Error(response?.error || chrome.i18n.getMessage("errorStatusScraperNoResponse"));
  }

  statusPayload = {
    exported_at: new Date().toISOString(),
    source_profile: {
      client: "douban-refugee-extension",
      page: response.page,
      account_backup: {
        backup_type: response.backup_type,
        backup_types: response.backup_types || selectedBackupTypes(),
        user_name: response.user_name,
        start_page: response.start_page,
        end_page: response.end_page,
        pages: response.pages || [],
        errors: response.errors || [],
        cancelled: Boolean(response.cancelled)
      }
    },
    entries: response.entries || [],
    statuses: response.statuses || response.entries || []
  };

  const hasStatuses = statusPayload.entries.length > 0;
  statusCopyButton.disabled = !hasStatuses;
  statusDownloadButton.disabled = !hasStatuses;
  statusProgress.value = 100;
  const cancelNote = response.cancelled ? " (Cancelled)" : "";
  setStatus(chrome.i18n.getMessage("doneStatuses", [String(statusPayload.entries.length), String(response.pages?.length || 0), cancelNote]));
  showPreview({
    page: response.page,
    scraped_pages: response.pages?.length || 0,
    entries: statusPayload.entries.slice(0, 3)
  });
}

function selectedBackupTypes() {
  const selected = backupTypeInputs.filter((input) => input.checked).map((input) => input.value);
  return selected.length > 0 ? selected : DEFAULTS.backupTypes;
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
  setStatus(chrome.i18n.getMessage("copiedJson"));
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
  setStatus(chrome.i18n.getMessage("downloadedJson"));
}

async function copyStatusJson() {
  if (!statusPayload) return;
  await navigator.clipboard.writeText(JSON.stringify(statusPayload, null, 2));
  setStatus(chrome.i18n.getMessage("copiedStatusJson"));
}

function downloadStatusJson() {
  if (!statusPayload) return;
  const blob = new Blob([JSON.stringify(statusPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "douban-refugee-account-backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(chrome.i18n.getMessage("downloadedStatusJson"));
}

scrapeButton.addEventListener("click", async () => {
  scrapeButton.disabled = true;
  setStatus(chrome.i18n.getMessage("scrapingPages"));
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
  setStatus(chrome.i18n.getMessage("backingUp"));
  try {
    await scrapeAccountBackup();
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
  setStatus(chrome.i18n.getMessage("cancelRequested"));
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "DOUBAN_REFUGEE_STATUS_PROGRESS" || message.requestId !== activeStatusRequestId) return;
  const progress = message.total ? Math.round((message.page / message.total) * 100) : 0;
  statusProgress.style.display = "block";
  statusProgress.value = progress;
  setStatus(chrome.i18n.getMessage("statusPageCount", [String(message.page), String(message.total), String(message.entry_count ?? message.status_count ?? 0)]));
});

openButton.addEventListener("click", async () => {
  const webAppUrl = await saveSettings();
  await chrome.tabs.create({ url: webAppUrl });
});

copyCookieButton.addEventListener("click", async () => {
  cookieStatus.textContent = chrome.i18n.getMessage("cookieReading");
  cookieStatus.className = "cookie-note";
  try {
    const cookies = await chrome.cookies.getAll({ domain: ".douban.com" });
    if (cookies.length === 0) {
      cookieStatus.textContent = chrome.i18n.getMessage("cookieNoDouban");
      cookieStatus.className = "cookie-note err";
      return;
    }
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    await navigator.clipboard.writeText(cookieString);
    cookieStatus.textContent = chrome.i18n.getMessage("cookieCopied", [String(cookies.length)]);
    cookieStatus.className = "cookie-note ok";
    setTimeout(() => { cookieStatus.textContent = ""; }, 5000);
  } catch (error) {
    cookieStatus.textContent = error instanceof Error ? error.message : chrome.i18n.getMessage("cookieCopyFailed");
    cookieStatus.className = "cookie-note err";
  }
});

document.querySelectorAll('[data-i18n]').forEach(el => {
  const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
  if (msg) {
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
      el.value = msg;
    } else {
      el.textContent = msg;
    }
  }
});

loadSettings().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error));
});
