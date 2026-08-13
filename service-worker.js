"use strict";

const tabFrameStates = new Map();

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

async function updateBadge(tabId) {
  const { state } = aggregateTabState(tabId);
  const badge = state === "enabled" ? "EN" : state === "unavailable" ? "!" : "";
  const color = state === "enabled" ? "#16a34a" : "#d97706";

  await chrome.action.setBadgeText({ tabId, text: badge });
  if (badge) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
  }
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
    updateBadge(tabId).catch(() => {});
    return false;
  }

  if (message && message.type === "get-tab-status") {
    sendResponse(aggregateTabState(message.tabId));
    return false;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabFrameStates.delete(tabId);
    updateBadge(tabId).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabFrameStates.delete(tabId);
});
