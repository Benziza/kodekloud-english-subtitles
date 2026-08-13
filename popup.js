"use strict";

const statusCard = document.getElementById("status-card");
const statusTitle = document.getElementById("status-title");
const statusCopy = document.getElementById("status-copy");
const resultPanel = document.getElementById("result");
const trackName = document.getElementById("track-name");
const subtitleUrlElement = document.getElementById("subtitle-url");
const findButton = document.getElementById("find");
const openButton = document.getElementById("open");
let subtitleResult = null;

function setStatus(kind, title, copy) {
  statusCard.className = `status-card ${kind || ""}`.trim();
  statusTitle.textContent = title;
  statusCopy.textContent = copy;
}

function clearResult() {
  subtitleResult = null;
  resultPanel.hidden = true;
  subtitleUrlElement.textContent = "";
  openButton.disabled = true;
}

function showResult(result) {
  subtitleResult = result;
  trackName.textContent = result.label || result.language || "English";
  subtitleUrlElement.textContent = result.url;
  resultPanel.hidden = false;
  openButton.disabled = false;
  setStatus("success", "English subtitles found", "Open the original subtitle file in a separate tab.");
}

async function findSubtitles() {
  clearResult();
  findButton.disabled = true;
  findButton.textContent = "Searching...";
  setStatus("", "Looking for subtitles...", "Checking the video and its embedded player.");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus("warning", "No active tab", "Open a KodeKloud video lesson and try again.");
    findButton.disabled = false;
    findButton.textContent = "Search again";
    return;
  }

  if (!/^https:\/\/learn\.kodekloud\.com\//i.test(tab.url || "")) {
    setStatus("warning", "This is not KodeKloud", "Open a lesson on learn.kodekloud.com and try again.");
    findButton.disabled = false;
    findButton.textContent = "Search again";
    return;
  }

  try {
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: findEnglishSubtitleInPage
    });
    const found = frameResults
      .map((entry) => entry && entry.result)
      .find((entry) => entry && entry.url);

    if (found) {
      showResult(found);
    } else {
      setStatus(
        "warning",
        "No English subtitle found",
        "Start the video, wait a moment for the Vimeo player to load, then search again."
      );
    }
  } catch (_error) {
    setStatus(
      "warning",
      "Cannot inspect this lesson",
      "Reload the KodeKloud page and confirm that the extension is allowed on this site."
    );
  } finally {
    findButton.disabled = false;
    findButton.textContent = "Search again";
  }
}

openButton.addEventListener("click", async () => {
  if (!subtitleResult || !subtitleResult.url) {
    return;
  }

  openButton.textContent = "Opening...";
  try {
    await chrome.tabs.create({ url: subtitleResult.url, active: true });
    window.close();
  } catch (_error) {
    openButton.textContent = "Could not open subtitles";
  }
});

findButton.addEventListener("click", findSubtitles);
findSubtitles();

function findEnglishSubtitleInPage() {
  function allMatches(root, selector) {
    const matches = [];
    try {
      root.querySelectorAll(selector).forEach((element) => matches.push(element));
      root.querySelectorAll("*").forEach((element) => {
        if (element.shadowRoot) {
          allMatches(element.shadowRoot, selector).forEach((match) => matches.push(match));
        }
      });
    } catch (_error) {
      // Ignore inaccessible or detached roots while the player is loading.
    }
    return matches;
  }

  const tracks = allMatches(document, "video track, track[kind='subtitles'], track[kind='captions']");
  for (const track of tracks) {
    const language = String(track.getAttribute("srclang") || track.srclang || "").trim();
    const label = String(track.getAttribute("label") || track.label || "").trim();
    const normalizedLanguage = language.toLowerCase();
    const normalizedLabel = label.toLowerCase();
    const rawSource = track.getAttribute("src") || track.src || "";
    const isEnglish =
      normalizedLanguage === "en" ||
      normalizedLanguage.startsWith("en-") ||
      normalizedLabel.includes("english");

    if (!isEnglish || !rawSource) {
      continue;
    }

    let absoluteUrl = rawSource;
    try {
      absoluteUrl = new URL(rawSource, document.baseURI).href;
    } catch (_error) {
      // The resolved track.src value may already be a browser-managed URL.
    }

    return {
      url: absoluteUrl,
      language: language || "en",
      label: label || "English",
      frameUrl: location.href
    };
  }

  return null;
}
