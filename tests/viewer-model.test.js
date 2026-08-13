"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatTime,
  normalizedTranscript,
  progressPercent
} = require("../viewer-model.js");

test("formats lesson playback times", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(65.9), "1:05");
  assert.equal(formatTime(3661), "1:01:01");
});

test("clamps playback progress", () => {
  assert.equal(progressPercent(25, 100), 25);
  assert.equal(progressPercent(120, 100), 100);
  assert.equal(progressPercent(-5, 100), 0);
  assert.equal(progressPercent(1, 0), 0);
});

test("removes empty and duplicate transcript entries", () => {
  const transcript = normalizedTranscript([
    { key: "1|hello", text: "Hello", startTime: 1 },
    { key: "1|hello", text: "Hello", startTime: 1 },
    { key: "2|empty", text: "   ", startTime: 2 },
    { key: "3|world", text: "World", startTime: 3 }
  ]);

  assert.deepEqual(transcript.map((entry) => entry.text), ["Hello", "World"]);
});
