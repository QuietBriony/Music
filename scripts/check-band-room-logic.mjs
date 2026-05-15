import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("band-room.js", "utf8");

const inertElement = () => ({
  addEventListener() {},
  appendChild() {},
  classList: { add() {}, remove() {}, toggle() {} },
  dataset: {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  remove() {},
  setAttribute() {},
  style: {},
  value: "",
  textContent: ""
});

const documentMock = {
  addEventListener() {},
  body: inertElement(),
  createElement() { return inertElement(); },
  documentElement: inertElement(),
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};

const windowMock = {
  addEventListener() {},
  dispatchEvent() {},
  document: documentMock,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  Tone: {}
};

const sandbox = {
  clearInterval() {},
  clearTimeout() {},
  console,
  document: documentMock,
  localStorage: windowMock.localStorage,
  navigator: windowMock.navigator,
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  setInterval() { return 0; },
  setTimeout() { return 0; },
  window: windowMock
};
sandbox.globalThis = sandbox;

vm.runInNewContext(source, sandbox, { filename: "band-room.js" });

const chordRoot = windowMock.BandRoomTestHooks?.chordRoot;
assert.equal(typeof chordRoot, "function", "BandRoomTestHooks.chordRoot should be exposed");
assert.equal(chordRoot("C"), "C2");
assert.equal(chordRoot("G"), "G2");
assert.equal(chordRoot("Bbmaj7"), "A#2");
assert.equal(chordRoot("F#m7"), "F#2");
assert.equal(chordRoot("not-a-chord"), "G2");

const firstSongIdForBand = windowMock.BandRoomTestHooks?.firstSongIdForBand;
const adjacentSongIdInBand = windowMock.BandRoomTestHooks?.adjacentSongIdInBand;
assert.equal(typeof firstSongIdForBand, "function", "firstSongIdForBand should be exposed");
assert.equal(typeof adjacentSongIdInBand, "function", "adjacentSongIdInBand should be exposed");

const tabascoBand = {
  songs: [
    { id: "tabasco" },
    { id: "hey" },
    { id: "i-got-a-feeling" }
  ]
};
assert.equal(firstSongIdForBand(tabascoBand), "tabasco");
assert.equal(firstSongIdForBand({ songs: [] }), null);
assert.equal(adjacentSongIdInBand(tabascoBand, "tabasco", 1), "hey");
assert.equal(adjacentSongIdInBand(tabascoBand, "hey", -1), "tabasco");
assert.equal(adjacentSongIdInBand(tabascoBand, "i-got-a-feeling", 1), null);
assert.equal(adjacentSongIdInBand(tabascoBand, "missing", 1), null);

assert.match(source, /currentSongId:\s*"tabasco"/, "Band Room should reload to track 01");
assert.match(
  source,
  /new Tone\.Player\(\{\s*url,\s*autostart:\s*false,\s*fadeIn:\s*0\.15,\s*fadeOut:\s*0\.30,\s*loop:\s*false/,
  "Stem players should not loop the same song"
);
assert.match(source, /queueMicrotask/, "Auto-advance should not depend on requestAnimationFrame");
assert.match(
  source,
  /stopPlayback\(\{\s*keepBackgroundBridge:\s*true,\s*updateMedia:\s*false\s*\}\)/,
  "Auto-advance should keep the background media bridge alive"
);
assert.match(source, /setHandler\("nexttrack"[\s\S]*selectAdjacentSong\(1\)/, "Media nexttrack should follow album flow");
assert.match(source, /setHandler\("previoustrack"[\s\S]*selectAdjacentSong\(-1\)/, "Media previoustrack should follow album flow");
assert.match(source, /let songSwitchSeq = 0/, "Song switches should have a generation guard");
assert.match(source, /loadSong\(songId, \{ switchSeq \}\)/, "Song switching should pass the generation guard into loadSong");
assert.match(source, /clearLoopRange\(\);\s*refreshLoopVisuals\(\);/, "Song switches should clear stale A/B loops");

const savePrefsBody = source.match(/function savePrefs\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(savePrefsBody, /songId\s*:/, "Saved prefs should not restore the last song");

console.log("Band Room logic check passed");
