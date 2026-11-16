// Execute the actual Band Room scheduler with silent instrument stubs. No
// browser/audio is started. Test-only hooks are injected into the VM copy;
// the shipped runtime gains no API.
//
// Contract: a song that carries a drum transcription owns its crashes
// (including intentional rests). The v106 section-entry crash hint is only
// for pattern-only songs. Both the native ARCB clock (Tabasco default) and
// the legacy ?physical=0 clock run the same per-bar scheduler.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('band-room.js', 'utf8');
const end = source.lastIndexOf('\n})();');
assert.ok(end > 0, 'Band Room IIFE boundary must be present');
const hook = `
  window.__drumTest = {
    start(data, mode, native) {
      state.songData = data;
      state.currentBandId = 'tabasco';
      state.currentSongId = 'scheduler-fixture-' + Math.random();
      state.barCount = 0; state.sectionIdx = 0; state.sectionBarStart = 0;
      state.loopA = null; state.loopB = null; state.pendingSeekOffsetSec = 0;
      currentMode = mode;
      drumKit = window.__silentKit;
      physicalArcb = native ? { drums: drumKit } : null;
      // UI and bus ramps are outside this test's trigger contract.
      updateChordDisplay = () => null;
      updateSectionDisplay = () => {};
      rampInstrumentBusForSection = () => {};
      return scheduleBar();
    },
    native: () => currentMode === 'synth' && physicalArcbEnabled(),
    totalBars: () => playbackStructure().reduce((sum, sec) => sum + (Number(sec.bars) || 0), 0)
  };
`;

const BAR_SECONDS = 2;  // 120 BPM, 4/4
const SUB_SECONDS = 0.125;

function boot({ light, native, muted = false }) {
  const hits = [];
  const repeats = [];
  let bar = -1;
  const inert = () => ({
    addEventListener() {}, appendChild() {}, remove() {}, setAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, dataset: {}, textContent: '', value: '', checked: false
  });
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
  const Tone = {
    Transport: { bpm: { value: 120 }, scheduleRepeat(fn, interval, start) { repeats.push({ fn, interval, start }); return repeats.length; } },
    Time(note) { return { toSeconds: () => note === '4n' ? BAR_SECONDS / 4 : SUB_SECONDS }; }
  };
  const search = `?aiLight=${light ? 1 : 0}&physical=${native ? 1 : 0}`;
  const silentKit = Object.fromEntries(['kick', 'snare', 'hat', 'crash', 'ghost', 'fill'].map(cls => [cls, {
    triggerAttackRelease(...args) { hits.push({ cls, bar, time: args.at(-2), velocity: args.at(-1) }); }
  }]));
  silentKit._physical = native;
  const win = {
    document, navigator: nav, Tone, location: { search },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    addEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    __silentKit: silentKit
  };
  const sandbox = {
    window: win, document, navigator: nav, Tone, localStorage: win.localStorage,
    location: win.location, matchMedia: win.matchMedia, URLSearchParams, console,
    performance: { now: () => 0 }, Event: class {},
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source.slice(0, end) + hook + source.slice(end), sandbox, { filename: 'band-room.js' });

  return {
    hits,
    start(data, mode = 'synth') {
      const resumeBar = win.__drumTest.start(data, mode, native);
      assert.equal(repeats.length, 1, 'Scheduler must register exactly one bar repeat');
      const nativeClock = win.__drumTest.native();
      assert.equal(nativeClock, mode === 'synth' && native, 'Fixture must exercise the intended clock');
      assert.equal(typeof resumeBar === 'function', nativeClock, 'Only the native clock returns a resume-bar bootstrap');
      if (nativeClock) assert.equal(repeats[0].start, BAR_SECONDS, 'Native repeats start on the next bar boundary');
      // Mirror production: native start plays bar 0 through the bootstrap,
      // then the Transport repeat owns every later bar.
      return (n) => {
        bar = n;
        const time = n * BAR_SECONDS;
        if (n === 0 && resumeBar) resumeBar(time);
        else repeats[0].fn(time);
      };
    },
    totalBars: () => win.__drumTest.totalBars()
  };
}

function run({ light, native, transcribed = true, mode = 'synth', muted = false, emptyLine = false, missingBar = false, section = 'chorus-1' }) {
  const room = boot({ light, native, muted });
  // [bar, step16, durSteps, CLASS(kick/snare/hat/crash), velocity]
  const events = [[0, 0.25, 1, 0, 0.73], [1, 0.5, 4, 3, 0.81], [1, 4.125, 1, 1, 0.67]];
  const data = {
    bpm: 120, key: 'G major', frames: [{ id: 'quiet', events: [], energy: 0 }],
    structure: [{ section: 'intro', bars: 1, frame_id: 'quiet' }, { section, bars: 1, frame_id: 'quiet' }],
    ...(transcribed ? { drum_line: { events: emptyLine ? [] : missingBar ? events.slice(0, 1) : events } } : {})
  };
  const playBar = room.start(data, mode);
  playBar(0);
  playBar(1);  // crosses intro -> lift section
  return room.hits.map(({ cls, time, velocity }) => ({ cls, time, velocity }));
}

const sectionCrash = (hits) => hits.filter(h => h.cls === 'crash' && h.time === BAR_SECONDS && h.velocity === 0.62);

for (const native of [true, false]) {
  for (const light of [true, false]) {
    const label = `${native ? 'native' : 'legacy'}/${light ? 'light' : 'full'}`;
    assert.deepEqual(run({ light, native }), [
      { cls: 'kick', time: 0.03125, velocity: 0.73 },
      { cls: 'crash', time: 2.0625, velocity: 0.81 },
      { cls: 'snare', time: 2.515625, velocity: 0.67 }
    ], `${label}: transcribed playback must preserve every fixture hit and add no section crash`);
    for (const section of ['chorus-1', 'bridge', 'outro', 'chant-b']) {
      assert.equal(run({ light, native, section }).filter(h => h.cls === 'crash').length, 1, `${label}: no generated crash over transcription at ${section}`);
      assert.equal(sectionCrash(run({ light, native, section, transcribed: false })).length, 1, `${label}: pattern-only songs keep the ${section} entry hint`);
    }
    assert.deepEqual(run({ light, native, muted: true }), [], `${label}: drum mute remains silent`);
    assert.deepEqual(run({ light, native, mode: 'stems' }), [], `${label}: original-stem mode never triggers synthetic drums`);
    assert.equal(run({ light, native, missingBar: true }).some(h => h.cls === 'crash'), false, `${label}: a missing transcription bar must not restore the section hint`);
    assert.equal(sectionCrash(run({ light, native, emptyLine: true })).length, 1, `${label}: an empty line is a pattern-only song`);
  }
}

// Real catalog sweep on the default Tabasco path (native clock): every crash
// the scheduler fires must be a transcribed crash row at its exact time and
// velocity. Full mode plays every transcribed crash; light may only thin.
const DRUM_CLASS = ['kick', 'snare', 'hat', 'crash'];
let songs = 0, crashes = 0, lifts = 0;
for (const file of readdirSync('presets').filter(f => /^drum-frames-tabasco-.+\.json$/.test(f)).sort()) {
  const data = JSON.parse(readFileSync(`presets/${file}`, 'utf8'));
  if (!data.drum_line?.events?.length) continue;
  songs++;
  lifts += data.structure.filter(s => /^(chorus|outro)/.test(s.section || '') || ['bridge', 'chant-b'].includes(s.section)).length;
  for (const light of [true, false]) {
    const room = boot({ light, native: true });
    const playBar = room.start(data);
    const total = room.totalBars();
    assert.ok(total > 0, `${file}: playback structure must have bars`);
    for (let n = 0; n < total; n++) playBar(n);
    const expected = data.drum_line.events
      .filter(row => DRUM_CLASS[Number(row[3])] === 'crash' && Number(row[0]) < total)
      .map(row => `${row[0]}@${Number(row[0]) * BAR_SECONDS + (Number(row[1]) || 0) * SUB_SECONDS}/${Math.min(1, Math.max(0.05, Number(row[4]) || 0.5))}`);
    const fired = room.hits.filter(h => h.cls === 'crash').map(h => `${h.bar}@${h.time}/${h.velocity}`);
    const pool = new Map();
    for (const key of expected) pool.set(key, (pool.get(key) || 0) + 1);
    for (const key of fired) {
      assert.ok(pool.get(key) > 0, `${file} ${light ? 'light' : 'full'}: crash ${key} is not in the transcription (generated section crash?)`);
      pool.set(key, pool.get(key) - 1);
    }
    if (!light) {
      assert.equal(fired.length, expected.length, `${file} full: every transcribed crash must play`);
      crashes += fired.length;
    }
  }
}
assert.ok(songs >= 7 && lifts > 0, 'The sweep must cover the transcribed Tabasco catalog and its lift sections');

console.log(`Band Room transcribed-drum scheduler check passed (native+legacy clock, light/full, real trigger timing, original mode, mute, pattern fallback; ${songs} transcribed songs / ${lifts} lift sections / ${crashes} crashes, no generated section crash).`);
