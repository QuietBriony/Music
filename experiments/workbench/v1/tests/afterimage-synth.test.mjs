import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'acorn';

const originalPath = new URL('../src/patterns/afterimage-final-v1.txt', import.meta.url);
const synthPath = new URL('../src/patterns/afterimage-synth-v1.txt', import.meta.url);
const [originalBytes, synthBytes] = await Promise.all([readFile(originalPath), readFile(synthPath)]);
const original = originalBytes.toString('utf8');
const synth = synthBytes.toString('utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const boundaryAttempts = { network: 0, audio: 0 };
const networkForbidden = () => { boundaryAttempts.network++; throw new Error('Network forbidden in pure score tests'); };
const audioForbidden = () => { boundaryAttempts.audio++; throw new Error('Audio forbidden in pure score tests'); };
globalThis.fetch = networkForbidden;
globalThis.AudioContext = class { constructor() { audioForbidden(); } };
globalThis.OfflineAudioContext = globalThis.AudioContext;

// The installed package's main points at a UMD build; the pinned transpiler
// requires the existing ESM exports. This process-local resolution adds no files.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@kabelsalat/web') return {
    url: new URL('../node_modules/@kabelsalat/web/dist/index.mjs', import.meta.url).href,
    shortCircuit: true,
  };
  return next(specifier, context);
} });
const core = await import('@strudel/core');
const mini = await import('@strudel/mini');
const { transpiler } = await import('@strudel/transpiler');
core.setStringParser(undefined);

function cleanAst(value) {
  if (Array.isArray(value)) return value.map(cleanAst);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['start', 'end', 'raw'].includes(key))
    .map(([key, child]) => [key, cleanAst(child)]));
}

function arrangement(code) {
  const names = new Set(['SET_MASTER', 'SEED', 'BASE', 'CHAPTERS', 'smooth', 'frame', 'motif', 'level', 'cutoff']);
  return parse(code, { ecmaVersion: 2022 }).body
    .filter(node => node.type === 'VariableDeclaration' && node.declarations.some(item => names.has(item.id.name)))
    .map(cleanAst);
}

async function evaluate(code, reference = false) {
  const sliders = {}, tempos = [];
  let declarations = 0;
  const context = vm.createContext({
    s: core.s, note: core.note, signal: core.signal, gain: core.gain, stack: core.stack, m: mini.m,
    setcpm(value) { tempos.push(value); },
    samples: async () => {
      assert.ok(reference, 'the synth score must not register recorded samples');
      declarations++;
    },
    sliderWithID(id, value) { sliders[id] = value; return core.ref(() => sliders[id]); },
    fetch: networkForbidden, AudioContext: globalThis.AudioContext, OfflineAudioContext: globalThis.OfflineAudioContext,
  });
  const compiled = transpiler(code, { wrapAsync: true });
  const pattern = await new vm.Script(compiled.output).runInContext(context, { timeout: 5000 });
  const events = [];
  for (let bar = 0; bar < 256; bar++) {
    for (const hap of pattern.queryArc(bar, bar + 1).filter(event => event.hasOnset())) {
      events.push({ begin: Number(hap.whole.begin), end: Number(hap.whole.end), value: hap.value });
    }
  }
  return { pattern, events, sliders, tempos, declarations };
}

// Invert only the six intentional timbre conversions. Keep every onset,
// duration, gain, pan, dynamic scene value and all untouched melodic controls.
const envelope = ['attack', 'decay', 'sustain', 'release'];
const parts = {
  bd: { sound: 'sine', original: 'bd', controls: ['freq', 'penv', 'pattack', 'pdecay', 'psustain', 'panchor'] },
  sd: { sound: 'white', original: 'sd', controls: ['hcutoff', 'cutoff'] },
  hh: { sound: 'white', original: 'hh', controls: ['hcutoff'] },
  oh: { sound: 'white', original: 'oh', controls: ['hcutoff'] },
  crash: { sound: 'white', original: 'afterimage_final_v1_crash', controls: ['hcutoff', 'cutoff'] },
  ride: { sound: 'square', original: 'afterimage_final_v1_ride', controls: ['freq', 'fmi', 'fmh', 'hcutoff', 'cutoff'] },
};

function normalized(event) {
  const value = { ...event.value };
  const role = value.afterimageSynthPart;
  if (role) {
    const part = parts[role];
    assert.ok(part, 'only the six converted roles may be tagged');
    assert.equal(value.s, part.sound);
    assert.equal(value.sustain, 0);
    assert.ok(value.attack > 0 && value.attack <= .01);
    assert.ok(value.decay > 0 && value.decay <= 1);
    assert.ok(value.release > 0 && value.release <= 1);
    for (const key of [...envelope, ...part.controls]) delete value[key];
    delete value.afterimageSynthPart;
    value.s = part.original;
    if (['bd', 'sd', 'hh', 'oh'].includes(role)) value.bank = 'AfterimageFinalV1';
  }
  return { begin: event.begin, end: event.end, value };
}

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    : value;
const ordered = events => events.map(event => JSON.stringify(canonical(event))).sort();
const finite = value => typeof value === 'number' ? Number.isFinite(value)
  : Array.isArray(value) ? value.every(finite)
    : value && typeof value === 'object' ? Object.values(value).every(finite) : true;
const [reference, converted] = await Promise.all([evaluate(original, true), evaluate(synth)]);

test('the separate synth score retains licence/finite markers with no recording declarations or URLs', () => {
  assert.equal(originalBytes.length, 7797);
  assert.equal(hash(originalBytes), 'd59bb636b012d5e9d780b1127e54a6ae6b3310fd518ef49edc1e44b39289beb4');
  assert.match(synth, /^\/\/ SPDX-License-Identifier: AGPL-3\.0-or-later$/m);
  assert.match(synth, /^\/\/ WORKBENCH_PLAYBACK_V1 from-start$/m);
  assert.match(synth, /^\/\/ WORKBENCH_SYNTH_ONLY_V1$/m);
  assert.doesNotMatch(synth, /\bsamples\s*\(|\.bank\s*\(|\bfetch\s*\(|https?:|\/modules\/|\.wav\b/);
  assert.equal(converted.declarations, 0);
});

test('the synth preview keeps the complete chapter/motif/seed/master and 128 BPM arrangement', () => {
  assert.deepEqual(arrangement(synth), arrangement(original));
  assert.deepEqual(converted.tempos, [32]);
  assert.deepEqual(Object.values(converted.sliders), [.15]);
});

test('all 7720 events retain original timing, duration, gain and controls outside the six converted voices', () => {
  assert.equal(converted.events.length, 7720);
  assert.deepEqual(ordered(converted.events.map(normalized)), ordered(reference.events));
});

test('every resolved sound is native synthesis and six percussion roles keep their onset counts', () => {
  const allowed = new Set(['sine', 'white', 'square', 'sawtooth', 'triangle']);
  const counts = {};
  for (const event of converted.events) {
    assert.ok(allowed.has(event.value.s));
    assert.equal(event.value.bank, undefined);
    assert.ok(finite(event));
    assert.ok(event.value.gain > 0);
    const role = event.value.afterimageSynthPart;
    if (role) counts[role] = (counts[role] || 0) + 1;
  }
  assert.deepEqual(counts, { bd: 808, hh: 1029, sd: 372, oh: 186, ride: 464, crash: 6 });
});

test('the synth preview remains finite after bar256 and pure checking preserves both score files', async () => {
  assert.equal(Math.max(...converted.events.map(event => event.begin)), 252);
  assert.equal(Math.max(...converted.events.map(event => event.end)), 256);
  for (const [begin, end] of [[256,257], [257,272], [512,528], [256,1024], [100000,100001]]) {
    assert.equal(converted.pattern.queryArc(begin, end).filter(hap => hap.hasOnset()).length, 0);
  }
  assert.equal(hash(await readFile(originalPath)), hash(originalBytes));
  assert.equal(hash(await readFile(synthPath)), hash(synthBytes));
  assert.deepEqual(boundaryAttempts, { network: 0, audio: 0 });
});
