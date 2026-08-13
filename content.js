(function runKodeKloudSubtitleCompanion() {
  "use strict";

  const engine = globalThis.KKESubtitleEngine;
  const observedVideos = new WeakSet();
  const observedTrackElements = new WeakSet();
  const observedTextTracks = new WeakSet();
  const activeTracks = new WeakMap();
  const lastPublishTimes = new WeakMap();
  const settingsDefaults = { enabled: true };
  let extensionEnabled = true;
  let lastReportedState = "";
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

  function cueText(track) {
    return Array.from(track && track.activeCues || [])
      .map((cue) => {
        if (typeof cue.text === "string") {
          return cue.text;
        }
        try {
          return cue.getCueAsHTML().textContent || "";
        } catch (_error) {
          return "";
        }
      })
      .map((text) => text.trim())
      .filter(Boolean)
      .join("\n");
  }

  function publishVideoState(video, track, force = false) {
    const now = Date.now();
    const lastPublish = lastPublishTimes.get(video) || 0;
    if (!force && now - lastPublish < 200) {
      return;
    }
    lastPublishTimes.set(video, now);

    const activeCues = Array.from(track && track.activeCues || []);
    const firstCue = activeCues[0] || null;
    chrome.runtime.sendMessage({
      type: "subtitle-update",
      update: {
        state: "enabled",
        trackLabel: track.label || track.language || "English",
        currentCue: cueText(track),
        cueStartTime: firstCue && Number.isFinite(firstCue.startTime)
          ? firstCue.startTime
          : Number(video.currentTime || 0),
        currentTime: Number(video.currentTime || 0),
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        paused: video.paused,
        playbackRate: Number(video.playbackRate || 1)
      }
    }).catch(() => {});
  }

  function watchSelectedTrack(video, track) {
    activeTracks.set(video, track);
    if (!observedTextTracks.has(track)) {
      observedTextTracks.add(track);
      track.addEventListener("cuechange", () => publishVideoState(video, track, true));
    }
    publishVideoState(video, track, true);
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
      for (const eventName of [
        "loadedmetadata",
        "loadeddata",
        "play",
        "pause",
        "seeking",
        "seeked",
        "ratechange",
        "ended",
        "durationchange"
      ]) {
        video.addEventListener(eventName, () => {
          scheduleScan();
          const track = activeTracks.get(video);
          if (track) {
            publishVideoState(video, track, true);
          }
        }, { passive: true });
      }
      video.addEventListener("timeupdate", () => {
        const track = activeTracks.get(video);
        if (track) {
          publishVideoState(video, track);
        }
      }, { passive: true });
    }

    for (const trackElement of video.querySelectorAll("track")) {
      if (!observedTrackElements.has(trackElement)) {
        observedTrackElements.add(trackElement);
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
        watchSelectedTrack(video, result.selected);
      }
    }

    if (lastVimeoEnglishTrack && Date.now() - lastVimeoEnglishTrack.updatedAt < 10000) {
      englishTrackFound = true;
      englishTrackEnabled = true;
      enabledLabel = lastVimeoEnglishTrack.label || lastVimeoEnglishTrack.language || "English";
    }

    if (englishTrackEnabled) {
      report("enabled", { label: enabledLabel, videoCount: videos.length });
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
