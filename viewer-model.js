(function createViewerModel(globalScope) {
  "use strict";

  function formatTime(totalSeconds) {
    const safeSeconds = Number.isFinite(Number(totalSeconds))
      ? Math.max(0, Math.floor(Number(totalSeconds)))
      : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function progressPercent(currentTime, duration) {
    const current = Number(currentTime);
    const total = Number(duration);
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, current / total * 100));
  }

  function normalizedTranscript(entries) {
    const seen = new Set();
    return Array.from(entries || []).filter((entry) => {
      const text = String(entry && entry.text || "").trim();
      const key = String(entry && entry.key || `${entry && entry.startTime}|${text}`);
      if (!text || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  const api = { formatTime, normalizedTranscript, progressPercent };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.KKEViewerModel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
