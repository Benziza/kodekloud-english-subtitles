"use strict";

const enabledInput = document.getElementById("enabled");
const autoOpenInput = document.getElementById("auto-open");
const statusDot = document.getElementById("status-dot");
const statusTitle = document.getElementById("status-title");
const statusCopy = document.getElementById("status-copy");
const openViewerButton = document.getElementById("open-viewer");
const rescanButton = document.getElementById("rescan");
let sourceTabId = null;

const statusMessages = {
  enabled: {
    title: "English track connected",
    copy: "Open the subtitle tab and play the lesson.",
    className: "enabled"
  },
  found: {
    title: "English track detected",
    copy: "Start the video, then open the subtitle tab.",
    className: "warning"
  },
  unavailable: {
    title: "No English track found",
    copy: "This lesson does not currently expose English captions.",
    className: "warning"
  },
  disabled: {
    title: "Subtitle capture is off",
    copy: "Turn the first switch on to capture English captions.",
    className: ""
  },
  waiting: {
    title: "Waiting for a video",
    copy: "Open or start a KodeKloud video lesson.",
    className: ""
  }
};

function renderStatus(state) {
  const message = statusMessages[state] || statusMessages.waiting;
  statusTitle.textContent = message.title;
  statusCopy.textContent = message.copy;
  statusDot.className = `status-dot ${message.className}`.trim();
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function sourceIdFromViewerUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "chrome-extension:" && parsed.pathname.endsWith("/viewer.html")) {
      return Number(parsed.searchParams.get("sourceTabId"));
    }
  } catch (_error) {
    // Not a URL handled by this extension.
  }
  return null;
}

async function refreshStatus() {
  const tab = await currentTab();
  const viewerSourceId = tab && sourceIdFromViewerUrl(tab.url || "");
  sourceTabId = viewerSourceId || tab && tab.id;

  if (!tab || (!viewerSourceId && !/^https:\/\/learn\.kodekloud\.com\//i.test(tab.url || ""))) {
    statusTitle.textContent = "Open KodeKloud first";
    statusCopy.textContent = "Open a KodeKloud lesson before creating its subtitle tab.";
    statusDot.className = "status-dot warning";
    openViewerButton.disabled = true;
    rescanButton.disabled = true;
    return;
  }

  const status = await chrome.runtime.sendMessage({
    type: "get-tab-status",
    tabId: sourceTabId
  });
  renderStatus(status && status.state);
}

enabledInput.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabledInput.checked });
  renderStatus(enabledInput.checked ? "waiting" : "disabled");
});

autoOpenInput.addEventListener("change", async () => {
  await chrome.storage.sync.set({ autoOpenViewer: autoOpenInput.checked });
});

openViewerButton.addEventListener("click", async () => {
  if (!sourceTabId) {
    return;
  }
  openViewerButton.textContent = "Opening...";
  const result = await chrome.runtime.sendMessage({
    type: "open-subtitle-viewer",
    sourceTabId
  });
  if (result && result.ok) {
    window.close();
  } else {
    openViewerButton.textContent = "Could not open subtitle tab";
  }
});

rescanButton.addEventListener("click", async () => {
  if (!sourceTabId) {
    return;
  }

  rescanButton.textContent = "Checking...";
  try {
    await chrome.tabs.sendMessage(sourceTabId, { type: "rescan-subtitles" });
  } catch (_error) {
    // The video frame can respond even if the top page does not.
  }

  setTimeout(async () => {
    await refreshStatus();
    rescanButton.textContent = "Check again";
  }, 350);
});

Promise.all([
  chrome.storage.sync.get({ enabled: true, autoOpenViewer: true }),
  refreshStatus()
]).then(([settings]) => {
  enabledInput.checked = settings.enabled !== false;
  autoOpenInput.checked = settings.autoOpenViewer !== false;
  if (!enabledInput.checked) {
    renderStatus("disabled");
  }
});
