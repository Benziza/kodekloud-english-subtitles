"use strict";

const openButton = document.getElementById("open");

function resetButton(message = "Open subtitles in new tab") {
  openButton.disabled = false;
  openButton.textContent = message;
}

openButton.addEventListener("click", async () => {
  openButton.disabled = true;
  openButton.textContent = "Searching...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https:\/\/learn\.kodekloud\.com\//i.test(tab.url || "")) {
    resetButton("Open a KodeKloud lesson first");
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

    if (!found) {
      resetButton("No subtitles found — Try again");
      return;
    }

    openButton.textContent = "Opening...";
    await chrome.tabs.create({ url: found.url, active: true });
    window.close();
  } catch (_error) {
    resetButton("Could not access subtitles — Try again");
  }
});

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
    const language = String(track.getAttribute("srclang") || track.srclang || "").trim().toLowerCase();
    const label = String(track.getAttribute("label") || track.label || "").trim().toLowerCase();
    const rawSource = track.getAttribute("src") || track.src || "";
    const isEnglish = language === "en" || language.startsWith("en-") || label.includes("english");

    if (!isEnglish || !rawSource) {
      continue;
    }

    try {
      return { url: new URL(rawSource, document.baseURI).href };
    } catch (_error) {
      return { url: rawSource };
    }
  }

  return null;
}
