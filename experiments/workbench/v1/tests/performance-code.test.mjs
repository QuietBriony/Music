import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  defaultSet, readTechnoSet, sceneAtCycle, SET_SLIDERS, technoSetCode,
} from '../src/performance-code.js';

const layers = await Promise.all(['techno-dub', 'namima-test'].map(async (id) => ({
  id, title: id, source: await readFile(new URL('../src/patterns/' + id + '.txt', import.meta.url), 'utf8'),
})));

test('all three presets have one tempo and round-trip their complete state', () => {
  for (const preset of ['acid-drive', 'dub-room', 'electro-808']) {
    const state = defaultSet(preset, layers);
    const code = technoSetCode(state);
    assert.deepEqual(readTechnoSet(code), state);
    assert.equal([...code.matchAll(/^setcpm\(/gm)].length, 1);
    assert.equal([...code.matchAll(/^const SET_\w+ = slider/gm)].length, SET_SLIDERS.length);
  }
});

test('live slider edits return into the saved set without losing its steps or layers', () => {
  const state = defaultSet('electro-808', layers);
  state.steps.kick[1] = true;
  state.muted = ['hh', 'oh'];
  state.auto = true;
  const changed = technoSetCode(state).replace('SET_CUTOFF = slider(700,', 'SET_CUTOFF = slider(1800,');
  const reopened = readTechnoSet(changed);
  assert.equal(reopened.values.CUTOFF, 1800);
  assert.deepEqual(reopened.steps, state.steps);
  assert.deepEqual(reopened.layers, state.layers);
  assert.deepEqual(reopened.muted, ['hh', 'oh']);
  assert.equal(reopened.auto, true);
});

test('hand edits to musical code disable generated controls instead of overwriting edits', () => {
  const code = technoSetCode(defaultSet('acid-drive', layers));
  assert.equal(readTechnoSet(code.replace('.postgain(0.42)', '.postgain(0.39)')), null);
  assert.equal(readTechnoSet(code + '\n// edited by hand'), null);
  assert.equal(readTechnoSet(code.replace('SET_MASTER = slider(0.55,', 'SET_MASTER = slider(9,')), null);
});

test('reject malformed steps, notes, extra layers, and out-of-range tempos', () => {
  for (const edit of [
    (s) => { s.steps.kick.push(true); }, (s) => { s.notes[0] = 'window.alert(1)'; },
    (s) => { s.layers.push(layers[0]); }, (s) => { s.bpm = 400; },
    (s) => { s.values.MASTER = -1; }, (s) => { s.muted.push('unknown'); },
  ]) {
    const state = defaultSet('acid-drive', layers); edit(state);
    assert.throws(() => technoSetCode(state));
  }
});

test('manual mutes override automatic scenes and break removes the kick', () => {
  const state = defaultSet('acid-drive', layers);
  state.scene = 'break';
  let code = technoSetCode(state);
  assert.match(code, /bank\("RolandTR909"\)\.gain\(SET_KICK\)\.filterWhen\(\(\) => false\)/);
  state.auto = true;
  state.muted = ['kick'];
  code = technoSetCode(state);
  assert.match(code, /gain\(SET_KICK\)\.filterWhen\(\(\) => false\)/);
  assert.match(code, /Math\.floor\(Number\(t\) \/ 8\) % 8/);
});

test('808 uses synthesized voices and has no 808 sample dependency', () => {
  const code = technoSetCode(defaultSet('electro-808', layers));
  assert.match(code, /freq\(52\)\.penv\(36\)/);
  assert.match(code, /decay\(SET_BOOM\)/);
  assert.doesNotMatch(code, /RolandTR808|\.wav/);
});

test('automatic arrangement is 64 bars and the displayed scene follows the same 8-bar intervals', () => {
  assert.deepEqual([0, 8, 16, 24, 32, 40, 48, 56, 64].map(sceneAtCycle),
    ['intro', 'groove', 'acid', 'acid', 'break', 'peak', 'peak', 'groove', 'intro']);
});
