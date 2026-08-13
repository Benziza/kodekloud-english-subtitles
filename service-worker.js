"use strict";

const SETTINGS_DEFAULTS = {
  enabled: true,
  autoOpenViewer: true
};
const MAX_TRANSCRIPT_ENTRIES = 300;
const tabFrameStates = new Map();
const subtitleSessions = new Map();
const sourceToViewer = new Map();
const viewerToSource = new Map();
const autoOpenedSources = new Set();

function statePriority(state) {
  return {
    enabled: 5,
    found: 4,
    unavailable: 3,
    waiting: 2,
    disabled: 1
  }[state] || 0;
}

function aggregateTabState(tabId) {
  const frameStates = tabFrameStates.get(tabId);
  if (!frameStates || frameStates.size === 0) {
    return { state: "waiting", details: {} };
  }

  return Array.from(frameStates.values()).sort(
    (left, right) => statePriority(right.state) - statePriority(left.state)
  )[0];
}

function sessionFor(tabId, senderTab = {}) {
  if (!subtitleSessions.has(tabId)) {
    subtitleSessions.set(tabId, {
      sourceTabId: tabId,
      sourceUrl: senderTab.url || "",
      title: senderTab.title || "KodeKloud lesson",
      state: "waiting",
      trackLabel: "",
      currentCue: "",
      currentTime: 0,
      duration: 0,
      paused: true,
      playbackRate: 1,
      transcript: [],
      updatedAt: Date.now()
    });
  }

  const session = subtitleSessions.get(tabId);
  session.sourceUrl = senderTab.url || session.sourceUrl;
  session.title = senderTab.title || session.title;
  return session;
}

function appendTranscript(session, update) {
  const text = String(update.currentCue || "").trim();
  if (!text) {
    return;
  }

  const startTime = Number.isFinite(update.cueStartTime)
    ? update.cueStartTime
    : Number(update.currentTime || 0);
  const cueKey = `${Math.round(startTime * 1000)}|${text}`;
  const lastEntry = session.transcript.at(-1);

  if (lastEntry && lastEntry.key === cueKey) {
    return;
  }

  session.transcript.push({
    key: cueKey,
    text,
    startTime
  });

  if (session.transcript.length > MAX_TRANSCRIPT_ENTRIES) {
    session.transcript.splice(0, session.transcript.length - MAX_TRANSCRIPT_ENTRIES);
  }
}

function updateSession(tabId, update, senderTab) {
  const session = sessionFor(tabId, senderTab);
  session.state = update.state || session.state;
  session.trackLabel = update.trackLabel || session.trackLabel;
  session.currentCue = String(update.currentCue || "").trim();
  session.currentTime = Number(update.currentTime || 0);
  session.duration = Number(update.duration || 0);
  session.paused = update.paused !== false;
  session.playbackRate = Number(update.playbackRate || 1);
  session.updatedAt = Date.now();
  appendTranscript(session, update);
  return session;
}

async function updateBadge(tabId) {
  const { state } = aggregateTabState(tabId);
  const badge = state === "enabled" ? "CC" : state === "unavailable" ? "!" : "";
  const color = state === "enabled" ? "#7c3aed" : "#d97706";

  await chrome.action.setBadgeText({ tabId, text: badge });
  if (badge) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
  }
}

async function existingViewer(sourceTabId) {
  const viewerTabId = sourceToViewer.get(sourceTabId);
  if (!viewerTabId) {
    return null;
  }

  try {
    return await chrome.tabs.get(viewerTabId);
  } catch (_error) {
    sourceToViewer.delete(sourceTabId);
    viewerToSource.delete(viewerTabId);
    return null;
  }
}

async function ensureViewerTab(sourceTabId, activate = false) {
  const current = await existingViewer(sourceTabId);
  if (current) {
    if (activate) {
      await chrome.tabs.update(current.id, { active: true });
      if (current.windowId) {
        await chrome.windows.update(current.windowId, { focused: true });
      }
    }
    return current;
  }

  let sourceTab = null;
  try {
    sourceTab = await chrome.tabs.get(sourceTabId);
  } catch (_error) {
    // The viewer can still show the last in-memory session.
  }

  const createOptions = {
    url: chrome.runtime.getURL(`viewer.html?sourceTabId=${sourceTabId}`),
    active: activate
  };

  if (sourceTab && Number.isInteger(sourceTab.index)) {
    createOptions.index = sourceTab.index + 1;
  }

  const viewerTab = await chrome.tabs.create(createOptions);
  sourceToViewer.set(sourceTabId, viewerTab.id);
  viewerToSource.set(viewerTab.id, sourceTabId);
  return viewerTab;
}

async function maybeAutoOpenViewer(sourceTabId) {
  if (autoOpenedSources.has(sourceTabId)) {
    return;
  }

  const settings = await chrome.storage.sync.get(SETTINGS_DEFAULTS);
  if (settings.enabled === false || settings.autoOpenViewer === false) {
    return;
  }

  autoOpenedSources.add(sourceTabId);
  await ensureViewerTab(sourceTabId, false);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "subtitle-status" && sender.tab) {
    const tabId = sender.tab.id;
    const frameId = sender.frameId || 0;
    const frameStates = tabFrameStates.get(tabId) || new Map();

    frameStates.set(frameId, {
      state: message.state,
      details: message.details || {},
      updatedAt: Date.now()
    });
    tabFrameStates.set(tabId, frameStates);
    sessionFor(tabId, sender.tab).state = message.state;
    updateBadge(tabId).catch(() => {});

    if (message.state === "enabled") {
      maybeAutoOpenViewer(tabId).catch(() => {});
    }
    return false;
  }

  if (message && message.type === "subtitle-update" && sender.tab) {
    updateSession(sender.tab.id, message.update || {}, sender.tab);
    return false;
  }

  if (message && message.type === "get-tab-status") {
    sendResponse(aggregateTabState(message.tabId));
    return false;
  }

  if (message && message.type === "get-subtitle-session") {
    sendResponse(subtitleSessions.get(Number(message.sourceTabId)) || null);
    return false;
  }

  if (message && message.type === "open-subtitle-viewer") {
    ensureViewerTab(Number(message.sourceTabId), true)
      .then((tab) => sendResponse({ ok: true, viewerTabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message && message.type === "focus-source-tab") {
    chrome.tabs.update(Number(message.sourceTabId), { active: true })
      .then((tab) => tab.windowId
        ? chrome.windows.update(tab.windowId, { focused: true })
        : null)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && !viewerToSource.has(tabId)) {
    tabFrameStates.delete(tabId);
    autoOpenedSources.delete(tabId);
    const existingSession = subtitleSessions.get(tabId);
    if (existingSession) {
      existingSession.state = "waiting";
      existingSession.currentCue = "";
      existingSession.sourceUrl = tab.url || existingSession.sourceUrl;
      existingSession.title = tab.title || existingSession.title;
    }
    updateBadge(tabId).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (viewerToSource.has(tabId)) {
    const sourceTabId = viewerToSource.get(tabId);
    viewerToSource.delete(tabId);
    sourceToViewer.delete(sourceTabId);
    return;
  }

  tabFrameStates.delete(tabId);
  autoOpenedSources.delete(tabId);
  const session = subtitleSessions.get(tabId);
  if (session) {
    session.state = "source-closed";
    session.currentCue = "";
    session.updatedAt = Date.now();
  }
});
