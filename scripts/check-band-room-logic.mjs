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

console.log("Band Room logic check passed");
