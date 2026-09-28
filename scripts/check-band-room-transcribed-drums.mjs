// Execute the actual scheduler with silent instrument stubs. No browser/audio is started.
// Test-only hooks are injected into the VM copy; the shipped runtime gains no API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('band-room.js', 'utf8');
const end = source.lastIndexOf('\n})();');
assert.ok(end > 0, 'Band Room IIFE boundary must be present');
const hook = `
  window.__drumTest = {
    start(data, mode) {
      state.songData = data;
      state.currentSongId = 'scheduler-fixture';
      state.barCount = 0; state.sectionIdx = 0; state.sectionBarStart = 0;
      state.loopA = null; state.loopB = null;
      currentMode = mode;
      drumKit = window.__silentKit;
      // UI and bus ramps are outside this test's trigger contract.
      updateChordDisplay = () => null;
      updateSectionDisplay = () => {};
      rampInstrumentBusForSection = () => {};
      scheduleBar();
    },
    selectRows: rowsForLightTranscribedPlayback
  };
`;

function run({ light, transcribed = true, mode = 'synth', muted = false, emptyLine = false, missingBar = false, section = 'chorus-1' }) {
  const hits = [];
  let callback;
  const inert = () => ({ addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, textContent: '', value: '', checked: false });
  const elements = new Map();
  const document = {
    addEventListener() {}, body: inert(), documentElement: inert(),
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement: inert,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, inert());
      const el = elements.get(id);
      el.checked = id === 'br-toggle-drums' && !muted;
      return el;
    }
  };
  const nav = { userAgent: light ? 'iPhone' : 'desktop', hardwareConcurrency: light ? 6 : 16, deviceMemory: light ? 4 : 16 };
  const Tone = { Transport: { scheduleRepeat(fn) { callback = fn; return 1; } }, Time(note) { return { toSeconds: () => note === '4n' ? 0.5 : 0.125 }; } };
  const win = {
    document, navigator: nav, Tone, location: { search: light ? '?aiLight=1' : '?aiLight=0' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    addEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    __silentKit: Object.fromEntries(['kick', 'snare', 'hat', 'crash', 'ghost', 'fill'].map(cls => [cls, {
      triggerAttackRelease(...args) { hits.push({ cls, time: args.at(-2), velocity: args.at(-1) }); }
    }]))
  };
  const sandbox = {
    window: win, document, navigator: nav, Tone, localStorage: win.localStorage,
    location: win.location, matchMedia: win.matchMedia, URLSearchParams, console,
    performance: { now: () => 0 }, Event: class {},
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source.slice(0, end) + hook + source.slice(end), sandbox);
  const events = [[0, 0.25, 1, 0, 0.73], [1, 0.5, 4, 3, 0.81], [1, 4.125, 1, 1, 0.67]];
  const data = {
    bpm: 120, key: 'G major', frames: [{ id: 'quiet', events: [], energy: 0 }],
    structure: [{ section: 'intro', bars: 1, frame_id: 'quiet' }, { section, bars: 1, frame_id: 'quiet' }],
    ...(transcribed ? { drum_line: { events: emptyLine ? [] : missingBar ? events.slice(0, 1) : events } } : {})
  };
  win.__drumTest.start(data, mode);
  assert.equal(typeof callback, 'function');
  callback(0);
  callback(2);
  return { hits, selectRows: win.__drumTest.selectRows };
}

for (const light of [true, false]) {
  const { hits } = run({ light });
  assert.deepEqual(hits, [
    { cls: 'kick', time: 0.03125, velocity: 0.73 },
    { cls: 'crash', time: 2.0625, velocity: 0.81 },
    { cls: 'snare', time: 2.515625, velocity: 0.67 }
  ], 'Transcribed playback must preserve every fixture hit and add no section crash');
  for (const section of ['chorus-1', 'bridge', 'outro', 'chant-b']) {
    assert.equal(run({ light, section }).hits.filter(h => h.cls === 'crash').length, 1, `No generated crash over transcription at ${section}`);
    assert.equal(run({ light, section, transcribed: false }).hits.filter(h => h.cls === 'crash' && h.time === 2).length, 1, `Pattern-only songs keep the ${section} entry hint`);
  }
  assert.deepEqual(run({ light, muted: true }).hits, [], 'Drum mute remains silent');
  assert.deepEqual(run({ light, mode: 'stems' }).hits, [], 'Original-stem mode never triggers synthetic drums');
  assert.equal(run({ light, missingBar: true }).hits.some(h => h.cls === 'crash'), false, 'A missing transcription bar must not restore the section hint');
  assert.equal(run({ light, emptyLine: true }).hits.some(h => h.cls === 'crash' && h.time === 2), true, 'An empty line is a pattern-only song');
}
console.log('Band Room transcribed-drum scheduler check passed (light/full, real trigger timing, original mode, mute, pattern fallback).');
