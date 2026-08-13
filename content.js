(function enableKodeKloudEnglishSubtitles() {
  "use strict";

  const engine = globalThis.KKESubtitleEngine;
  const observedVideos = new WeakSet();
  const observedTracks = new WeakSet();
  const settingsDefaults = { enabled: true };
  let extensionEnabled = true;
  let lastReportedState = "";
  let lastToastUrl = "";
  let lastVimeoEnglishTrack = null;
  let scanTimer = null;

  if (!engine) {
    return;
  }

  function collectRoots() {
    const roots = [document];
    const queue = [document];

    while (queue.length) {
      const root = queue.shift();
      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot && !roots.includes(element.shadowRoot)) {
          roots.push(element.shadowRoot);
          queue.push(element.shadowRoot);
        }
      }
    }

    return roots;
  }

  function findVideos() {
    const videos = [];
    for (const root of collectRoots()) {
      for (const video of root.querySelectorAll("video")) {
        if (!videos.includes(video)) {
          videos.push(video);
        }
      }
    }
    return videos;
  }

  function findVimeoFrames() {
    const frames = [];
    for (const root of collectRoots()) {
      for (const frame of root.querySelectorAll("iframe[src*='player.vimeo.com']")) {
        if (!frames.includes(frame)) {
          frames.push(frame);
        }
      }
    }
    return frames;
  }

  function requestVimeoEnglishTrack(frames) {
    for (const frame of frames) {
      try {
        frame.contentWindow.postMessage({
          method: "enableTextTrack",
          value: {
            language: "en",
            kind: null,
            showing: true
          }
        }, "https://player.vimeo.com");
      } catch (_error) {
        // The frame may be navigating while a KodeKloud lesson changes.
      }
    }
  }

  function report(state, details = {}) {
    const fingerprint = JSON.stringify([state, details.label || "", details.videoCount || 0]);
    if (fingerprint === lastReportedState) {
      return;
    }

    lastReportedState = fingerprint;
    chrome.runtime.sendMessage({
      type: "subtitle-status",
      state,
      details
    }).catch(() => {
      // The page can outlive an extension reload during development.
    });
  }

  function showToast(label) {
    const urlKey = `${location.href}|${label}`;
    if (urlKey === lastToastUrl || document.getElementById("kke-subtitle-toast")) {
      return;
    }

    lastToastUrl = urlKey;
    const toast = document.createElement("div");
    toast.id = "kke-subtitle-toast";
    toast.setAttribute("role", "status");
    toast.textContent = `English subtitles enabled${label ? ` (${label})` : ""}`;
    (document.body || document.documentElement).appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("kke-subtitle-toast--visible"));
    setTimeout(() => {
      toast.classList.remove("kke-subtitle-toast--visible");
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  function markMatchingTrackElement(video, selectedTrack) {
    const selectedLanguage = String(selectedTrack.language || "").toLowerCase();
    const selectedLabel = String(selectedTrack.label || "").toLowerCase();

    for (const trackElement of video.querySelectorAll("track[kind='subtitles'], track[kind='captions']")) {
      const elementLanguage = String(trackElement.srclang || "").toLowerCase();
      const elementLabel = String(trackElement.label || "").toLowerCase();
      const isMatch =
        (selectedLanguage && elementLanguage === selectedLanguage) ||
        (selectedLabel && elementLabel === selectedLabel);

      trackElement.default = Boolean(isMatch);
    }
  }

  function watchVideo(video) {
    if (!observedVideos.has(video)) {
      observedVideos.add(video);
      for (const eventName of ["loadedmetadata", "loadeddata", "play", "durationchange"]) {
        video.addEventListener(eventName, scheduleScan, { passive: true });
      }
    }

    for (const trackElement of video.querySelectorAll("track")) {
      if (!observedTracks.has(trackElement)) {
        observedTracks.add(trackElement);
        trackElement.addEventListener("load", scheduleScan, { passive: true });
      }
    }
  }

  function scan() {
    scanTimer = null;

    if (!extensionEnabled) {
      report("disabled");
      return;
    }

    const videos = findVideos();
    const vimeoFrames = findVimeoFrames();
    requestVimeoEnglishTrack(vimeoFrames);
    let englishTrackFound = false;
    let englishTrackEnabled = false;
    let enabledLabel = "";

    for (const video of videos) {
      watchVideo(video);
      const result = engine.activateEnglishTrack(video.textTracks);
      englishTrackFound ||= result.found;
      englishTrackEnabled ||= result.enabled;

      if (result.enabled && result.selected) {
        enabledLabel = result.selected.label || result.selected.language || "English";
        markMatchingTrackElement(video, result.selected);
      }
    }

    if (lastVimeoEnglishTrack && Date.now() - lastVimeoEnglishTrack.updatedAt < 10000) {
      englishTrackFound = true;
      englishTrackEnabled = true;
      enabledLabel = lastVimeoEnglishTrack.label || lastVimeoEnglishTrack.language || "English";
    }

    if (englishTrackEnabled) {
      report("enabled", { label: enabledLabel, videoCount: videos.length });
      showToast(enabledLabel);
    } else if (englishTrackFound) {
      report("found", { videoCount: videos.length });
    } else if (videos.length) {
      report("unavailable", { videoCount: videos.length });
    } else {
      report("waiting", { videoCount: 0 });
    }
  }

  function scheduleScan() {
    if (scanTimer !== null) {
      return;
    }
    scanTimer = setTimeout(scan, 100);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srclang", "label", "kind"]
  });

  chrome.storage.sync.get(settingsDefaults).then((settings) => {
    extensionEnabled = settings.enabled !== false;
    scan();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.enabled) {
      extensionEnabled = changes.enabled.newValue !== false;
      scheduleScan();
    }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== "https://player.vimeo.com" || !extensionEnabled) {
      return;
    }

    const knownFrame = findVimeoFrames().some((frame) => frame.contentWindow === event.source);
    const data = typeof event.data === "string" ? (() => {
      try {
        return JSON.parse(event.data);
      } catch (_error) {
        return null;
      }
    })() : event.data;

    if (
      knownFrame &&
      data &&
      data.method === "enableTextTrack" &&
      data.value &&
      engine.isEnglishTrack(data.value)
    ) {
      lastVimeoEnglishTrack = {
        language: data.value.language,
        label: data.value.label,
        updatedAt: Date.now()
      };
      scheduleScan();
    }
  }, { passive: true });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "rescan-subtitles") {
      scheduleScan();
    }
  });

  setInterval(scheduleScan, 2000);
})();
