"use strict";

const enabledInput = document.getElementById("enabled");
const statusDot = document.getElementById("status-dot");
const statusTitle = document.getElementById("status-title");
const statusCopy = document.getElementById("status-copy");
const rescanButton = document.getElementById("rescan");
let activeTabId = null;

const statusMessages = {
  enabled: {
    title: "English subtitles are on",
    copy: "The English caption track is active.",
    className: "enabled"
  },
  found: {
    title: "English track detected",
    copy: "The player has not accepted the selection yet. Start the video and check again.",
    className: "warning"
  },
  unavailable: {
    title: "No English track found",
    copy: "This lesson does not currently expose English captions.",
    className: "warning"
  },
  disabled: {
    title: "Automatic subtitles are off",
    copy: "Turn the switch on to select English automatically.",
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

async function refreshStatus() {
  const tab = await currentTab();
  activeTabId = tab && tab.id;

  if (!tab || !/^https:\/\/(learn\.kodekloud\.com|player\.vimeo\.com)\//i.test(tab.url || "")) {
    statusTitle.textContent = "Open KodeKloud first";
    statusCopy.textContent = "This extension only runs on KodeKloud lessons and their video player.";
    statusDot.className = "status-dot warning";
    rescanButton.disabled = true;
    return;
  }

  const status = await chrome.runtime.sendMessage({
    type: "get-tab-status",
    tabId: tab.id
  });
  renderStatus(status && status.state);
}

enabledInput.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabledInput.checked });
  renderStatus(enabledInput.checked ? "waiting" : "disabled");
});

rescanButton.addEventListener("click", async () => {
  if (!activeTabId) {
    return;
  }

  rescanButton.textContent = "Checking…";
  try {
    await chrome.tabs.sendMessage(activeTabId, { type: "rescan-subtitles" });
  } catch (_error) {
    // The top page may not have a content script while its video frame does.
  }

  setTimeout(async () => {
    await refreshStatus();
    rescanButton.textContent = "Check again";
  }, 350);
});

Promise.all([
  chrome.storage.sync.get({ enabled: true }),
  refreshStatus()
]).then(([settings]) => {
  enabledInput.checked = settings.enabled !== false;
  if (!enabledInput.checked) {
    renderStatus("disabled");
  }
});
