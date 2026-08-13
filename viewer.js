"use strict";

const model = globalThis.KKEViewerModel;
const params = new URLSearchParams(location.search);
const sourceTabId = Number(params.get("sourceTabId"));
const lessonTitle = document.getElementById("lesson-title");
const connectionStatus = document.getElementById("connection-status");
const connectionLabel = document.getElementById("connection-label");
const trackLabel = document.getElementById("track-label");
const currentCue = document.getElementById("current-cue");
const playbackState = document.getElementById("playback-state");
const playbackTime = document.getElementById("playback-time");
const progressBar = document.getElementById("progress-bar");
const transcriptList = document.getElementById("transcript");
const focusSourceButton = document.getElementById("focus-source");
const smallerButton = document.getElementById("font-smaller");
const largerButton = document.getElementById("font-larger");
let lastTranscriptKey = "";
let captionSize = 42;

function setConnection(state) {
  const connection = {
    enabled: ["live", "Live English captions"],
    found: ["warning", "English track detected"],
    unavailable: ["warning", "No English captions available"],
    disabled: ["warning", "Extension is disabled"],
    "source-closed": ["warning", "Lesson tab was closed"],
    waiting: ["waiting", "Waiting for the lesson"]
  }[state] || ["waiting", "Waiting for the lesson"];

  connectionStatus.className = `connection-status ${connection[0]}`;
  connectionLabel.textContent = connection[1];
}

function renderTranscript(entries) {
  const transcript = model.normalizedTranscript(entries);
  const newestKey = transcript.at(-1) && transcript.at(-1).key || "";
  if (newestKey === lastTranscriptKey) {
    return;
  }
  lastTranscriptKey = newestKey;
  transcriptList.replaceChildren();

  if (!transcript.length) {
    const empty = document.createElement("li");
    empty.className = "empty-transcript";
    empty.textContent = "Caption history will appear as the video plays.";
    transcriptList.appendChild(empty);
    return;
  }

  const visibleEntries = transcript.slice(-100);
  for (const entry of visibleEntries) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    const text = document.createElement("p");
    item.className = "transcript-entry";
    time.dateTime = `PT${Math.max(0, Number(entry.startTime || 0))}S`;
    time.textContent = model.formatTime(entry.startTime);
    text.textContent = entry.text;
    item.append(time, text);
    transcriptList.appendChild(item);
  }
  transcriptList.scrollTop = transcriptList.scrollHeight;
}

function renderSession(session) {
  if (!session) {
    setConnection("waiting");
    return;
  }

  setConnection(session.state);
  lessonTitle.textContent = session.title || "English subtitles";
  document.title = `${session.title || "English subtitles"} — Subtitle Companion`;
  trackLabel.textContent = String(session.trackLabel || "English").toUpperCase();
  currentCue.textContent = session.currentCue || (
    session.state === "unavailable"
      ? "This lesson does not expose an English subtitle track."
      : "Play the video. English subtitles will appear here."
  );
  playbackState.textContent = session.paused ? "Paused" : `Playing · ${session.playbackRate || 1}×`;
  playbackTime.textContent = `${model.formatTime(session.currentTime)} / ${model.formatTime(session.duration)}`;
  progressBar.style.width = `${model.progressPercent(session.currentTime, session.duration)}%`;
  renderTranscript(session.transcript);
}

async function refresh() {
  if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) {
    setConnection("warning");
    connectionLabel.textContent = "Missing KodeKloud lesson";
    currentCue.textContent = "Open this companion from a KodeKloud lesson tab.";
    return;
  }

  try {
    const session = await chrome.runtime.sendMessage({
      type: "get-subtitle-session",
      sourceTabId
    });
    renderSession(session);
  } catch (_error) {
    setConnection("warning");
    connectionLabel.textContent = "Extension was reloaded";
  }
}

focusSourceButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "focus-source-tab", sourceTabId });
});

smallerButton.addEventListener("click", () => {
  captionSize = Math.max(24, captionSize - 4);
  document.documentElement.style.setProperty("--caption-size", `${captionSize}px`);
});

largerButton.addEventListener("click", () => {
  captionSize = Math.min(72, captionSize + 4);
  document.documentElement.style.setProperty("--caption-size", `${captionSize}px`);
});

refresh();
setInterval(refresh, 250);
