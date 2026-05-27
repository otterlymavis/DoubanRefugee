const DEFAULTS = {
  apiBase: "http://localhost:8000",
  mediaType: "movie",
  userId: undefined
};

let extractedItems = [];
let activePage = undefined;

const apiBaseInput = document.querySelector("#apiBase");
const mediaTypeInput = document.querySelector("#mediaType");
const extractButton = document.querySelector("#extractButton");
const importButton = document.querySelector("#importButton");
const statusText = document.querySelector("#statusText");
const preview = document.querySelector("#preview");
const webAppLink = document.querySelector("#webAppLink");

function setStatus(message) {
  statusText.textContent = message;
}

function showPreview(payload) {
  preview.style.display = "block";
  preview.textContent = JSON.stringify(payload, null, 2);
}

function normalizeApiBase(value) {
  return (value || DEFAULTS.apiBase).replace(/\/+$/, "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  apiBaseInput.value = stored.apiBase || DEFAULTS.apiBase;
  mediaTypeInput.value = stored.mediaType || DEFAULTS.mediaType;
  webAppLink.href = normalizeApiBase(stored.webAppUrl || "http://localhost:3000").replace(":8000", ":3000");
}

async function saveSettings() {
  await chrome.storage.local.set({
    apiBase: normalizeApiBase(apiBaseInput.value),
    mediaType: mediaTypeInput.value
  });
}

async function extractPage() {
  await saveSettings();
  const tab = await getActiveTab();

  if (!tab.url || !tab.url.includes("douban.com")) {
    throw new Error("Open a douban.com subject, collection, or list page first.");
  }

  const response = await requestExtraction(tab.id, {
    type: "DOUBAN_REFUGEE_EXTRACT",
    mediaType: mediaTypeInput.value
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The content extractor did not respond.");
  }

  extractedItems = response.items || [];
  activePage = response.page;
  importButton.disabled = extractedItems.length === 0;
  setStatus(`Extracted ${extractedItems.length} item(s) from ${activePage.title || "this page"}.`);
  showPreview({ page: activePage, items: extractedItems.slice(0, 5) });
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

async function importToApi() {
  await saveSettings();
  const stored = await chrome.storage.local.get(DEFAULTS);
  const apiBase = normalizeApiBase(apiBaseInput.value);

  const response = await fetch(`${apiBase}/api/v1/imports/douban/browser-extension`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: stored.userId || null,
      items: extractedItems,
      source_profile: {
        client: "douban-refugee-test-extension",
        page: activePage,
        extracted_at: new Date().toISOString()
      }
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const body = await response.json();
  await chrome.storage.local.set({ userId: body.user_id });
  setStatus(`Imported ${body.imported_count} item(s). User ${body.user_id.slice(0, 8)} is saved for the next import.`);
  showPreview(body);
}

extractButton.addEventListener("click", async () => {
  extractButton.disabled = true;
  setStatus("Extracting from active Douban tab...");
  try {
    await extractPage();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    extractButton.disabled = false;
  }
});

importButton.addEventListener("click", async () => {
  importButton.disabled = true;
  setStatus("Sending extracted items to local API...");
  try {
    await importToApi();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    importButton.disabled = extractedItems.length === 0;
  }
});

loadSettings().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error));
});
