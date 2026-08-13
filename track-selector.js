(function createTrackSelector(globalScope) {
  "use strict";

  function isEnglishTrack(track) {
    if (!track) {
      return false;
    }
    const language = String(track.srclang || track.language || "").trim().toLowerCase();
    const label = String(track.label || "").trim().toLowerCase();
    return language === "en" || language.startsWith("en-") || label.includes("english");
  }

  function chooseEnglishTrack(tracks) {
    return Array.from(tracks || []).find((track) => isEnglishTrack(track) && track.src) || null;
  }

  const api = { chooseEnglishTrack, isEnglishTrack };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.KKETrackSelector = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
