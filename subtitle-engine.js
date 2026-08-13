(function createSubtitleEngine(globalScope) {
  "use strict";

  const ENGLISH_LANGUAGE = /^en(?:[-_]|$)/i;
  const ENGLISH_LABEL = /\benglish\b/i;
  const SUBTITLE_KINDS = new Set(["captions", "subtitles"]);

  function normalized(value) {
    return String(value || "").trim();
  }

  function isSubtitleTrack(track) {
    const kind = normalized(track && track.kind).toLowerCase();
    return !kind || SUBTITLE_KINDS.has(kind);
  }

  function isEnglishTrack(track) {
    if (!track || !isSubtitleTrack(track)) {
      return false;
    }

    const language = normalized(track.language || track.srclang);
    const label = normalized(track.label);
    return ENGLISH_LANGUAGE.test(language) || ENGLISH_LABEL.test(label);
  }

  function trackScore(track) {
    if (!isEnglishTrack(track)) {
      return Number.NEGATIVE_INFINITY;
    }

    const language = normalized(track.language || track.srclang).toLowerCase();
    const label = normalized(track.label).toLowerCase();
    const kind = normalized(track.kind).toLowerCase();
    let score = 0;

    if (language === "en" || language === "en-us" || language === "en-gb") {
      score += 100;
    } else if (ENGLISH_LANGUAGE.test(language)) {
      score += 80;
    }

    if (label === "english") {
      score += 50;
    } else if (ENGLISH_LABEL.test(label)) {
      score += 30;
    }

    if (kind === "subtitles") {
      score += 10;
    } else if (kind === "captions") {
      score += 8;
    }

    if (track.mode === "showing") {
      score += 5;
    }

    return score;
  }

  function selectBestEnglishTrack(tracks) {
    return Array.from(tracks || [])
      .filter(isEnglishTrack)
      .sort((left, right) => trackScore(right) - trackScore(left))[0] || null;
  }

  function activateEnglishTrack(tracks) {
    const availableTracks = Array.from(tracks || []);
    const selected = selectBestEnglishTrack(availableTracks);

    if (!selected) {
      return { found: false, enabled: false, selected: null };
    }

    for (const track of availableTracks) {
      if (track === selected || !isSubtitleTrack(track)) {
        continue;
      }

      if (track.mode === "showing") {
        try {
          track.mode = "disabled";
        } catch (_error) {
          // Some players expose a read-only TextTrack proxy.
        }
      }
    }

    try {
      selected.mode = "showing";
    } catch (_error) {
      return { found: true, enabled: false, selected };
    }

    return {
      found: true,
      enabled: selected.mode === "showing",
      selected
    };
  }

  const api = {
    activateEnglishTrack,
    isEnglishTrack,
    selectBestEnglishTrack,
    trackScore
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.KKESubtitleEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
