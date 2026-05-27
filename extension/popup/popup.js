/**
 * DoubanRefugee Extension Popup Script
 *
 * Communicates with the background service worker to:
 * - Display current page detection info
 * - Control scraping (start/stop)
 * - Sync collected items to the DoubanRefugee API
 * - Manage settings (API URL)
 */

"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const healthDot     = $("health-dot");
const pageBanner    = $("page-banner");
const pageInfoText  = $("page-info-text");
const statItems     = $("stat-items");
const statPages     = $("stat-pages");
const statSynced    = $("stat-synced");
const progressSection = $("progress-section");
const progressText  = $("progress-text");
const progressCount = $("progress-count");
const progressBar   = $("progress-bar");
const statusMsg     = $("status-msg");
const btnScrape     = $("btn-scrape");
const btnScrapeLabel= $("btn-scrape-label");
const btnStop       = $("btn-stop");
const btnSync       = $("btn-sync");
const btnSyncLabel  = $("btn-sync-label");
const btnClear      = $("btn-clear");
const lastSyncDiv   = $("last-sync");
const lastSyncText  = $("last-sync-text");
const settingsPanel = $("settings-panel");
const inputApiUrl   = $("input-api-url");
const inputUserId   = $("input-user-id");
const btnSaveSettings = $("btn-save-settings");
const btnSettingsToggle = $("btn-settings-toggle");
const btnOpenApp    = $("btn-open-app");

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  apiHealthy: false,
  scrapingActive: false,
  collectedItems: [],
  pagesScraped: 0,
  syncUserId: null,
  lastSyncTime: null,
  lastPageInfo: null,
  apiUrl: "http://localhost:8000",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(type, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (res) => {
      resolve(res || {});
    });
  });
}

function showStatus(text, kind = "info") {
  statusMsg.textContent = text;
  statusMsg.className = `status-msg ${kind}`;
  statusMsg.classList.remove("hidden");
}

function hideStatus() {
  statusMsg.classList.add("hidden");
}

function setProgress(pct, label, count) {
  progressSection.classList.remove("hidden");
  progressBar.style.width = `${Math.min(100, pct)}%`;
  progressText.textContent = label;
  progressCount.textContent = count || "";
}

function hideProgress() {
  progressSection.classList.add("hidden");
}

function formatRelativeTime(isoString) {
  if (!isoString) return null;
  const ms = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatPageInfo(info) {
  if (!info) return null;
  const typeMap = { movie: "🎬 Movies", book: "📚 Books", music: "🎵 Music" };
  const interestMap = { collect: "Watched", wish: "Wishlist", do: "Watching" };
  const mediaLabel = typeMap[info.mediaType] || info.mediaType;
  const interestLabel = interestMap[info.interestType] || info.interestType;
  const pages = info.totalPages ? ` · ~${info.totalPages} pages` : "";
  return `@${info.username} · ${mediaLabel} · ${interestLabel}${pages}`;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  // Health dot
  healthDot.className = `health-dot ${state.apiHealthy ? "healthy" : "unhealthy"}`;
  healthDot.title = state.apiHealthy ? "API connected" : "API unreachable";

  // Page banner
  const pageLabel = formatPageInfo(state.lastPageInfo);
  if (pageLabel) {
    pageInfoText.textContent = pageLabel;
    pageBanner.classList.remove("hidden");
  } else {
    pageBanner.classList.add("hidden");
  }

  // Stats
  statItems.textContent = state.collectedItems?.length ?? 0;
  statPages.textContent = state.pagesScraped ?? 0;
  statSynced.textContent = state.syncUserId ? "✓" : "—";

  // Last sync
  if (state.lastSyncTime) {
    lastSyncText.textContent = `Last sync: ${formatRelativeTime(state.lastSyncTime)}`;
    lastSyncDiv.classList.remove("hidden");
  } else {
    lastSyncDiv.classList.add("hidden");
  }

  // Buttons
  const hasItems = (state.collectedItems?.length ?? 0) > 0;
  const onDoubanPage = !!state.lastPageInfo;

  if (state.scrapingActive) {
    btnScrape.classList.add("hidden");
    btnStop.classList.remove("hidden");
    btnSync.disabled = true;
    btnClear.disabled = true;
  } else {
    btnScrape.classList.remove("hidden");
    btnStop.classList.add("hidden");
    btnScrape.disabled = !onDoubanPage;
    btnScrapeLabel.textContent = onDoubanPage ? "Scrape All Pages" : "Navigate to Douban first";
    btnSync.disabled = !hasItems || !state.apiHealthy;
    btnSyncLabel.textContent = hasItems
      ? `Sync ${state.collectedItems.length} Items`
      : "Sync to DoubanRefugee";
    btnClear.disabled = !hasItems;
    hideProgress();
  }

  // Settings inputs
  inputApiUrl.value = state.apiUrl || "http://localhost:8000";
  inputUserId.value = state.syncUserId || "";

  // Open app link
  btnOpenApp.href = (state.apiUrl || "http://localhost:8000").replace(":8000", ":3000");
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const s = await send("GET_STATE");
  state = { ...state, ...s };
  render();

  // Also get page info from the active tab's content script directly
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const res = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" }, (r) => {
          resolve(r || {});
        });
      });
      if (res.pageInfo) {
        state.lastPageInfo = res.pageInfo;
        render();
      }
    }
  } catch {
    // Content script not loaded on this page — normal
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

btnScrape.addEventListener("click", async () => {
  hideStatus();
  const res = await send("START_SCRAPING");
  if (!res.ok) {
    showStatus(res.error || "Could not start scraping.", "error");
  }
});

btnStop.addEventListener("click", async () => {
  await send("STOP_SCRAPING");
  showStatus("Scraping stopped.", "info");
});

btnSync.addEventListener("click", async () => {
  btnSync.disabled = true;
  btnSyncLabel.textContent = "Syncing…";
  hideStatus();
  await send("SYNC_TO_API");
});

btnClear.addEventListener("click", async () => {
  await send("CLEAR_ITEMS");
  state.collectedItems = [];
  state.pagesScraped = 0;
  hideStatus();
  render();
});

btnSettingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  btnSettingsToggle.textContent = settingsPanel.classList.contains("hidden") ? "Settings" : "Close";
});

btnSaveSettings.addEventListener("click", async () => {
  const apiUrl = inputApiUrl.value.trim().replace(/\/$/, "");
  if (!apiUrl) return;
  await send("SAVE_SETTINGS", { apiUrl });
  state.apiUrl = apiUrl;
  showStatus("Settings saved.", "ok");
  // Re-check health with new URL
  const res = await send("CHECK_HEALTH");
  state.apiHealthy = res.healthy;
  render();
});

// ── Background message listener (real-time updates) ───────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case "SCRAPING_STARTED":
      state.scrapingActive = true;
      btnScrape.classList.add("hidden");
      btnStop.classList.remove("hidden");
      btnSync.disabled = true;
      btnClear.disabled = true;
      setProgress(0, "Starting scrape…", "");
      break;

    case "SCRAPING_PROGRESS": {
      const { pagesScraped, totalItems, currentPage, totalPages } = message;
      state.pagesScraped = pagesScraped;
      state.collectedItems = { length: totalItems }; // lightweight update
      statItems.textContent = totalItems;
      statPages.textContent = pagesScraped;
      const pct = totalPages ? (currentPage / totalPages) * 100 : 50;
      setProgress(pct, `Page ${currentPage}${totalPages ? ` of ${totalPages}` : ""}`, `${totalItems} items`);
      break;
    }

    case "SCRAPING_COMPLETE": {
      state.scrapingActive = false;
      state.pagesScraped = message.pagesScraped;
      state.collectedItems = { length: message.totalItems };
      statItems.textContent = message.totalItems;
      statPages.textContent = message.pagesScraped;
      hideProgress();
      if (message.error) {
        showStatus(message.error, "error");
      } else {
        showStatus(`✓ Collected ${message.totalItems} items from ${message.pagesScraped} pages.`, "ok");
      }
      // Re-fetch full state
      send("GET_STATE").then((s) => { state = { ...state, ...s }; render(); });
      break;
    }

    case "SYNC_STARTED":
      showStatus(`Syncing ${message.total} items to DoubanRefugee…`, "info");
      break;

    case "SYNC_PROGRESS":
      showStatus(`Syncing… ${message.synced} / ${message.total}`, "info");
      break;

    case "SYNC_COMPLETE":
      state.syncUserId = message.userId;
      state.lastSyncTime = message.lastSyncTime;
      statSynced.textContent = "✓";
      showStatus(`✓ Synced ${message.total} items! Your user ID: ${message.userId.slice(0, 8)}…`, "ok");
      render();
      break;

    case "SYNC_ERROR":
      showStatus(`Sync failed: ${message.error}`, "error");
      btnSync.disabled = false;
      btnSyncLabel.textContent = `Retry Sync`;
      break;
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
