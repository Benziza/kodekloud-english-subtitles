"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseEnglishTrack, isEnglishTrack } = require("../track-selector.js");

test("recognizes English language codes and labels", () => {
  assert.equal(isEnglishTrack({ srclang: "en" }), true);
  assert.equal(isEnglishTrack({ srclang: "en-US" }), true);
  assert.equal(isEnglishTrack({ label: "English CC" }), true);
  assert.equal(isEnglishTrack({ srclang: "fr", label: "French" }), false);
});

test("selects the first English track that has a source URL", () => {
  const selected = chooseEnglishTrack([
    { srclang: "en", src: "" },
    { srclang: "fr", src: "https://example.test/fr.vtt" },
    { label: "English", src: "https://example.test/en.vtt" }
  ]);

  assert.equal(selected.src, "https://example.test/en.vtt");
});

test("returns null when no English source exists", () => {
  assert.equal(chooseEnglishTrack([{ srclang: "fr", src: "fr.vtt" }]), null);
});
