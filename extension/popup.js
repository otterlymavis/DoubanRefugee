const DEFAULTS = {
  mediaType: "movie",
  webAppUrl: "http://localhost:3000"
};

let extractedPayload = undefined;

const webAppUrlInput = document.querySelector("#webAppUrl");
const mediaTypeInput = document.querySelector("#mediaType");
const extractButton = document.querySelector("#extractButton");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const openButton = document.querySelector("#openButton");
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
  mediaTypeInput.value = stored.mediaType || DEFAULTS.mediaType;
  webAppLink.href = normalizeUrl(stored.webAppUrl || DEFAULTS.webAppUrl);
}

async function saveSettings() {
  const webAppUrl = normalizeUrl(webAppUrlInput.value);
  await chrome.storage.local.set({
    mediaType: mediaTypeInput.value,
    webAppUrl
  });
  webAppLink.href = webAppUrl;
  return webAppUrl;
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

  extractedPayload = {
    exported_at: new Date().toISOString(),
    source_profile: {
      client: "douban-refugee-extension",
      page: response.page
    },
    items: response.items || []
  };

  const hasItems = extractedPayload.items.length > 0;
  copyButton.disabled = !hasItems;
  downloadButton.disabled = !hasItems;
  setStatus(`Extracted ${extractedPayload.items.length} item(s). Download JSON, then import it in the web app.`);
  showPreview({ page: response.page, items: extractedPayload.items.slice(0, 5) });
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

copyButton.addEventListener("click", async () => {
  try {
    await copyJson();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadButton.addEventListener("click", downloadJson);

openButton.addEventListener("click", async () => {
  const webAppUrl = await saveSettings();
  await chrome.tabs.create({ url: webAppUrl });
});

loadSettings().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error));
});
