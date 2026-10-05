import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { singleWorkCode, splitPublishedPattern } from '../src/mix-code.js';

const scorePath = new URL('../src/patterns/minimal-techno-01.txt', import.meta.url);
const bytes = await readFile(scorePath);
const source = bytes.toString('utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const attempts = { network: 0, audio: 0, samples: 0 };
const networkForbidden = () => { attempts.network++; throw new Error('Network forbidden in pure score tests'); };
const audioForbidden = () => { attempts.audio++; throw new Error('Audio forbidden in pure score tests'); };
globalThis.fetch = networkForbidden;
globalThis.AudioContext = class { constructor() { audioForbidden(); } };
globalThis.OfflineAudioContext = globalThis.AudioContext;

// Use the pinned package's installed ESM export without downloading or changing it.
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

async function evaluate(code) {
  const tempos = [], sliders = [];
  const context = vm.createContext({
    s: core.s, note: core.note, signal: core.signal, gain: core.gain, stack: core.stack, m: mini.m,
    setcpm(value) { tempos.push(value); },
    samples() { attempts.samples++; throw new Error('Recorded samples forbidden'); },
    sliderWithID(id, value, min, max, step) {
      const control = { id, value, min, max, step };
      sliders.push(control);
      return core.ref(() => control.value);
    },
    fetch: networkForbidden, AudioContext: globalThis.AudioContext, OfflineAudioContext: globalThis.OfflineAudioContext,
  });
  const compiled = transpiler(code, { wrapAsync: true });
  const pattern = await new vm.Script(compiled.output).runInContext(context, { timeout: 5000 });
  return { pattern, tempos, sliders };
}

function onsets(pattern, begin, end) {
  return pattern.queryArc(begin, end).filter(hap => hap.hasOnset()).map(hap => ({
    begin: Number(hap.whole.begin), end: Number(hap.whole.end), value: hap.value,
  })).sort((a, b) => a.begin - b.begin || a.value.minimalTechnoPart.localeCompare(b.value.minimalTechnoPart));
}
const finite = value => typeof value === 'number' ? Number.isFinite(value)
  : Array.isArray(value) ? value.every(finite)
    : value && typeof value === 'object' ? Object.values(value).every(finite) : true;
const score = await evaluate(source);
const events = Array.from({ length: 32 }, (_, bar) => onsets(score.pattern, bar, bar + 1)).flat();
const countRoles = list => list.reduce((counts, event) => {
  const role = event.value.minimalTechnoPart;
  counts[role] = (counts[role] || 0) + 1;
  return counts;
}, {});

test('the short 124 BPM score is synth-only and uses the existing shelf format', () => {
  assert.match(source, /^\/\/ SPDX-License-Identifier: AGPL-3\.0-or-later$/m);
  assert.match(source, /^\/\/ WORKBENCH_PLAYBACK_V1 from-start$/m);
  assert.match(source, /^\/\/ WORKBENCH_SYNTH_ONLY_V1$/m);
  assert.doesNotMatch(source, /\bsamples\s*\(|\.bank\s*\(|\bfetch\s*\(|https?:|\/api\/|\.wav\b/);
  assert.deepEqual(score.tempos, [31]);
  assert.deepEqual(score.sliders.map(({ value, min, max, step }) => [value, min, max, step]), [[.12, 0, 1, .01]]);
  assert.equal(splitPublishedPattern(source).cpm, 31);
  assert.ok(32 * 60 / 31 > 61 && 32 * 60 / 31 < 63);
});

test('three sparse native voices enter gradually and retain a repeated pulse', () => {
  assert.equal(events.length, 332);
  assert.deepEqual(countRoles(events), { kick: 128, hat: 120, bass: 84 });
  assert.deepEqual(countRoles(onsets(score.pattern, 0, 2)), { kick: 8 });
  assert.deepEqual(countRoles(onsets(score.pattern, 2, 4)), { kick: 8, hat: 8 });
  for (let bar = 4; bar < 32; bar++) {
    const phrase = onsets(score.pattern, bar, bar + 1);
    assert.deepEqual(countRoles(phrase), { kick: 4, hat: 4, bass: 3 });
    assert.deepEqual(phrase.filter(event => event.value.minimalTechnoPart === 'kick').map(event => event.begin - bar), [0, .25, .5, .75]);
    assert.deepEqual(phrase.filter(event => event.value.minimalTechnoPart === 'hat').map(event => event.begin - bar), [.125, .375, .625, .875]);
    assert.deepEqual(phrase.filter(event => event.value.minimalTechnoPart === 'bass').map(event => event.begin - bar), [0, .375, .75]);
  }
});

test('resolved synthesis stays finite, quiet and short with no recorded voice', () => {
  const native = { kick: 'sine', hat: 'white', bass: 'triangle' };
  const gains = { kick: .58 * .12, hat: .14 * .12, bass: .24 * .12 };
  for (const event of events) {
    const { value } = event;
    const role = value.minimalTechnoPart;
    assert.equal(value.s, native[role]);
    assert.equal(value.bank, undefined);
    assert.ok(finite(event));
    assert.ok(value.gain > 0 && value.gain <= gains[role] + 1e-12);
    assert.ok(value.attack > 0 && value.attack <= .004);
    assert.ok(value.decay > 0 && value.decay <= .15);
    assert.equal(value.sustain, 0);
    assert.ok(value.release > 0 && value.release <= .04);
    assert.ok(value.attack + value.decay + value.release < .2);
    assert.ok(event.begin >= 0 && event.begin < 32 && event.end <= 32);
  }
  const kick = events.find(event => event.value.minimalTechnoPart === 'kick').value;
  assert.equal(kick.freq, 49);
  assert.equal(kick.penv, 28);
  const hat = events.find(event => event.value.minimalTechnoPart === 'hat').value;
  assert.equal(hat.hcutoff, 7000);
  assert.equal(hat.cutoff, 10000);
  for (const event of events.filter(event => event.value.minimalTechnoPart === 'bass')) {
    assert.ok(event.value.cutoff >= 450 && event.value.cutoff <= 590);
    assert.ok([31, 34, 36].includes(event.value.note));
  }
});

test('small phrase changes preserve the home note and the ending fades to silence', () => {
  const bassNotes = bar => onsets(score.pattern, bar, bar + 1)
    .filter(event => event.value.minimalTechnoPart === 'bass').map(event => event.value.note);
  assert.deepEqual(bassNotes(4), [36, 31, 36]);
  assert.deepEqual(bassNotes(8), [36, 31, 34]);
  assert.deepEqual(bassNotes(16), [36, 31, 36]);
  assert.deepEqual(bassNotes(24), [36, 31, 34]);
  for (const role of ['kick', 'hat', 'bass']) {
    const tail = events.filter(event => event.begin >= 28 && event.value.minimalTechnoPart === role);
    assert.ok(tail[0].value.gain > tail.at(-1).value.gain);
    assert.ok(tail.at(-1).value.gain < tail[0].value.gain * .03);
    for (let index = 1; index < tail.length; index++) assert.ok(tail[index].value.gain < tail[index - 1].value.gain);
  }
  assert.equal(Math.max(...events.map(event => event.begin)), 31.875);
  assert.equal(Math.max(...events.map(event => event.end)), 31.9375);
  for (const [begin, end] of [[32, 33], [32, 64], [31.9375, 40], [64, 128], [100000, 100001]]) {
    assert.equal(onsets(score.pattern, begin, end).length, 0);
  }
});

test('the live shelf trim preserves every event and master while applying its own level', async () => {
  for (const level of [1, .5, 0]) {
    const code = singleWorkCode(source, level);
    assert.doesNotMatch(code, /\bsamples\s*\(|\/api\//);
    const wrapped = await evaluate(code);
    assert.deepEqual(wrapped.tempos, [31]);
    assert.deepEqual(wrapped.sliders.map(control => control.value), [level, .12]);
    const result = onsets(wrapped.pattern, 0, 32);
    assert.equal(result.length, events.length);
    result.forEach((event, index) => {
      const expected = events[index];
      assert.deepEqual({ ...event, value: { ...event.value, gain: expected.value.gain } }, expected);
      assert.ok(Math.abs(event.value.gain - expected.value.gain * level) < 1e-12);
    });
    wrapped.sliders[0].value = .25;
    const live = onsets(wrapped.pattern, 0, 1);
    assert.ok(Math.abs(live[0].value.gain - events[0].value.gain * .25) < 1e-12);
    wrapped.sliders[1].value = .06;
    const masterTrimmed = onsets(wrapped.pattern, 0, 1);
    assert.ok(Math.abs(masterTrimmed[0].value.gain - events[0].value.gain * .25 * .5) < 1e-12);
    wrapped.sliders[1].value = 0;
    assert.equal(onsets(wrapped.pattern, 0, 32).length, 0);
    assert.equal(onsets(wrapped.pattern, 32, 64).length, 0);
  }
});

test('pure evaluation changes no score file and opens no network, samples or audio', async () => {
  assert.equal(digest(await readFile(scorePath)), digest(bytes));
  assert.deepEqual(attempts, { network: 0, audio: 0, samples: 0 });
});
