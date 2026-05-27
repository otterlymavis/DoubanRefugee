/**
 * DoubanRefugee Background Service Worker
 *
 * Manages the scraping state machine, stores collected items, and
 * communicates with the DoubanRefugee API.
 *
 * State keys in chrome.storage.local:
 *   apiUrl          – DoubanRefugee backend URL (default: http://localhost:8000)
 *   scrapingActive  – boolean
 *   scrapingTabId   – number | null
 *   scrapingPageInfo – object | null
 *   collectedItems  – array of CanonicalMedia
 *   pagesScraped    – number
 *   syncUserId      – string | null (returned by /api/v1/imports/…)
 *   lastSyncTime    – ISO string | null
 */

const DEFAULT_API_URL = "http://localhost:8000";
const ITEMS_PER_BATCH = 50; // Send to API in batches

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const data = await chrome.storage.local.get([
    "apiUrl",
    "scrapingActive",
    "scrapingTabId",
    "collectedItems",
    "pagesScraped",
    "syncUserId",
    "lastSyncTime",
    "scrapingPageInfo",
  ]);
  return {
    apiUrl: data.apiUrl || DEFAULT_API_URL,
    scrapingActive: data.scrapingActive || false,
    scrapingTabId: data.scrapingTabId || null,
    collectedItems: data.collectedItems || [],
    pagesScraped: data.pagesScraped || 0,
    syncUserId: data.syncUserId || null,
    lastSyncTime: data.lastSyncTime || null,
    scrapingPageInfo: data.scrapingPageInfo || null,
  };
}

async function broadcastToPopup(message) {
  try {
    // Try to send to all extension contexts (popup if open)
    await chrome.runtime.sendMessage(message).catch(() => {});
  } catch {
    // Popup may not be open — ignore
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function syncItemsToApi(items, userId, apiUrl) {
  const url = `${apiUrl}/api/v1/imports/douban/browser-extension`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId || undefined,
      items,
      source_profile: { client: "browser-extension", version: "1.0.0" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function checkApiHealth(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Scraping state machine ────────────────────────────────────────────────────

async function startScraping(tabId) {
  await chrome.storage.local.set({
    scrapingActive: true,
    scrapingTabId: tabId,
    collectedItems: [],
    pagesScraped: 0,
  });

  broadcastToPopup({ type: "SCRAPING_STARTED" });

  // Trigger the content script on the active tab
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE" });
    if (result?.ok) {
      await handlePageResult(result, tabId);
    } else {
      await stopScraping("Content script not ready. Navigate to a Douban interest page first.");
    }
  } catch {
    await stopScraping("Could not reach the content script. Make sure you are on a Douban interest page.");
  }
}

async function handlePageResult(result, tabId) {
  const { items = [], pagination, nextUrl, pageInfo } = result;

  // Accumulate items
  const state = await getSettings();
  const merged = [...state.collectedItems, ...items];
  const pagesScraped = state.pagesScraped + 1;

  await chrome.storage.local.set({
    collectedItems: merged,
    pagesScraped,
    scrapingPageInfo: pageInfo,
  });

  broadcastToPopup({
    type: "SCRAPING_PROGRESS",
    pagesScraped,
    totalItems: merged.length,
    currentPage: pagination?.currentPage,
    totalPages: pagination?.totalPages,
  });

  // Navigate to next page if available
  if (nextUrl && state.scrapingActive) {
    // Small delay to be polite to Douban's servers
    await delay(1000);
    try {
      await chrome.tabs.update(tabId, { url: nextUrl });
      // The content script will fire again when the page loads (handled via AUTO_COLLECT_PAGE)
    } catch {
      await stopScraping("Navigation failed.");
    }
  } else {
    await stopScraping(null); // null = normal completion
  }
}

async function stopScraping(errorMsg) {
  const state = await getSettings();
  await chrome.storage.local.set({ scrapingActive: false, scrapingTabId: null });
  broadcastToPopup({
    type: "SCRAPING_COMPLETE",
    totalItems: state.collectedItems.length,
    pagesScraped: state.pagesScraped,
    error: errorMsg || null,
  });
}

// ── Sync to API ───────────────────────────────────────────────────────────────

async function syncToApi() {
  const state = await getSettings();

  if (state.collectedItems.length === 0) {
    broadcastToPopup({ type: "SYNC_ERROR", error: "No items to sync. Scrape your Douban history first." });
    return;
  }

  broadcastToPopup({ type: "SYNC_STARTED", total: state.collectedItems.length });

  let userId = state.syncUserId;
  let synced = 0;

  // Send in batches
  for (let i = 0; i < state.collectedItems.length; i += ITEMS_PER_BATCH) {
    const batch = state.collectedItems.slice(i, i + ITEMS_PER_BATCH);
    try {
      const res = await syncItemsToApi(batch, userId, state.apiUrl);
      userId = res.user_id; // persist returned user_id
      synced += batch.length;
      await chrome.storage.local.set({ syncUserId: userId });
      broadcastToPopup({ type: "SYNC_PROGRESS", synced, total: state.collectedItems.length });
    } catch (e) {
      broadcastToPopup({ type: "SYNC_ERROR", error: e.message, synced });
      return;
    }
  }

  const now = new Date().toISOString();
  await chrome.storage.local.set({ lastSyncTime: now, syncUserId: userId });

  broadcastToPopup({
    type: "SYNC_COMPLETE",
    total: synced,
    userId,
    lastSyncTime: now,
  });
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      // Content script reported page info
      case "PAGE_INFO": {
        await chrome.storage.local.set({ lastPageInfo: message.pageInfo, lastPageUrl: message.url });
        return { ok: true };
      }

      // Content script completed auto-collect page scrape
      case "AUTO_COLLECT_PAGE": {
        const state = await getSettings();
        if (!state.scrapingActive) return;
        await handlePageResult(message, state.scrapingTabId);
        return { ok: true };
      }

      // Popup: start scraping
      case "START_SCRAPING": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          return { ok: false, error: "No active tab" };
        }
        await startScraping(tab.id);
        return { ok: true };
      }

      // Popup: stop scraping
      case "STOP_SCRAPING": {
        await stopScraping("Stopped by user.");
        return { ok: true };
      }

      // Popup: sync collected items to API
      case "SYNC_TO_API": {
        syncToApi(); // async — responses sent via broadcastToPopup
        return { ok: true };
      }

      // Popup: clear collected items
      case "CLEAR_ITEMS": {
        await chrome.storage.local.set({ collectedItems: [], pagesScraped: 0 });
        return { ok: true };
      }

      // Popup: get current state
      case "GET_STATE": {
        const state = await getSettings();
        const healthy = await checkApiHealth(state.apiUrl);
        const lastPageInfo = (await chrome.storage.local.get("lastPageInfo")).lastPageInfo;
        return { ...state, apiHealthy: healthy, lastPageInfo };
      }

      // Popup: save settings
      case "SAVE_SETTINGS": {
        await chrome.storage.local.set({ apiUrl: message.apiUrl || DEFAULT_API_URL });
        return { ok: true };
      }

      // Popup: check API health
      case "CHECK_HEALTH": {
        const { apiUrl } = await getSettings();
        const healthy = await checkApiHealth(apiUrl);
        return { ok: true, healthy };
      }

      default:
        return { ok: false, error: `Unknown message type: ${message.type}` };
    }
  };

  handle().then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
  return true; // keep message channel open for async response
});

// ── Tab update listener (for pagination) ─────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;

  const state = await getSettings();
  if (!state.scrapingActive || state.scrapingTabId !== tabId) return;

  // Page loaded; wait briefly then try to scrape
  await delay(800);

  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE" });
    if (result?.ok) {
      await handlePageResult(result, tabId);
    } else {
      await stopScraping("Content script unavailable on next page.");
    }
  } catch {
    // Content script may not be ready yet; the AUTO_COLLECT_PAGE message
    // from the content script's own init will handle it.
  }
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Alarm-based keepalive (service workers can be killed after 30s of inactivity)
chrome.alarms.create("keepalive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {
  // Just accessing storage keeps the worker alive during active scraping
  chrome.storage.local.get("scrapingActive");
});
