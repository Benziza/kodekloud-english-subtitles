"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  activateEnglishTrack,
  isEnglishTrack,
  selectBestEnglishTrack
} = require("../subtitle-engine.js");

function track({ language = "", label = "", kind = "subtitles", mode = "disabled" } = {}) {
  return { language, label, kind, mode };
}

test("recognizes English language variants", () => {
  assert.equal(isEnglishTrack(track({ language: "en" })), true);
  assert.equal(isEnglishTrack(track({ language: "en-US" })), true);
  assert.equal(isEnglishTrack(track({ language: "fr" })), false);
});

test("recognizes a track labeled English when the language code is missing", () => {
  assert.equal(isEnglishTrack(track({ label: "English (CC)" })), true);
});

test("prefers an exact English language code", () => {
  const labeled = track({ label: "English auto-generated" });
  const coded = track({ language: "en" });
  assert.equal(selectBestEnglishTrack([labeled, coded]), coded);
});

test("enables English and disables another visible subtitle track", () => {
  const french = track({ language: "fr", mode: "showing" });
  const english = track({ language: "en", label: "English" });
  const result = activateEnglishTrack([french, english]);

  assert.equal(result.found, true);
  assert.equal(result.enabled, true);
  assert.equal(result.selected, english);
  assert.equal(english.mode, "showing");
  assert.equal(french.mode, "disabled");
});

test("reports when no English subtitle track exists", () => {
  const result = activateEnglishTrack([track({ language: "fr" })]);
  assert.deepEqual(result, { found: false, enabled: false, selected: null });
});
