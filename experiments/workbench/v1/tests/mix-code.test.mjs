import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
import { stack, xfade } from '../node_modules/@strudel/core/pattern.mjs';
import { gain, s } from '../node_modules/@strudel/core/controls.mjs';
import {
  comparableCode, deckMixCode, managedSliderValue, replaceManagedSliderValue,
  singleWorkCode, splitPublishedPattern, upgradeLegacyDraftCode,
} from '../src/mix-code.js';

const source = new URL('../src/', import.meta.url);
const library = JSON.parse(readFileSync(new URL('library.json', source), 'utf8'));
const works = library.items.map((item) => ({
  id: item.id,
  source: readFileSync(new URL('patterns/' + item.id + '.txt', source), 'utf8'),
}));

test('all published works keep their original parts under a live volume control', () => {
  for (const work of works) {
    const code = singleWorkCode(work.source, 0.63);
    new Script(code, { filename: work.id });
    assert.equal(managedSliderValue(code, 'WORKBENCH_LEVEL_V1'), 0.63);
    assert.match(code, /\.mul\(gain\(WORKBENCH_LEVEL_V1\)\)/);
    assert.match(code, /setcpm\(/);
    assert.equal(comparableCode(code), comparableCode(replaceManagedSliderValue(code, 'WORKBENCH_LEVEL_V1', 0.22)));
  }
});

test('older standard drafts gain a level fader without replacing their pattern', () => {
  const oldCode = `samples({\n  pad: '/api/sounds/pad',\n  sub: '/api/sounds/sub',\n  drums: '/api/sounds/drums',\n});\n\n${works[0].source}`;
  const upgraded = upgradeLegacyDraftCode(oldCode, 0.4);
  new Script(upgraded);
  assert.equal(managedSliderValue(upgraded, 'WORKBENCH_LEVEL_V1'), 0.4);
  assert.match(upgraded, /\.mul\(gain\(WORKBENCH_LEVEL_V1\)\)/);
  assert.equal(upgradeLegacyDraftCode(upgraded), upgraded);
  assert.equal(upgradeLegacyDraftCode('custom code with no known structure'), 'custom code with no known structure');
});

test('published pairs compose into one tempo and two isolated code scopes', () => {
  for (const a of works) {
    for (const b of works) {
      if (a.id === b.id) continue;
      const code = deckMixCode(a, b, { a: 0.55, b: 0.45, cross: 0.5 });
      new Script(code, { filename: a.id + '+' + b.id });
      assert.equal((code.match(/setcpm\(/g) || []).length, 1);
      assert.equal(managedSliderValue(code, 'DECK_A_LEVEL_V1'), 0.55);
      assert.equal(managedSliderValue(code, 'DECK_B_LEVEL_V1'), 0.45);
      assert.equal(managedSliderValue(code, 'DECK_XFADE_V1'), 0.5);
      assert.match(code, /xfade\(deckA\.mul\(gain\(DECK_A_LEVEL_V1\)\)/);
      assert.equal(splitPublishedPattern(a.source).cpm * 4, Number(code.match(/Aの([0-9.]+) BPM/)[1]));
    }
  }
  assert.throws(() => deckMixCode(works[0], works[0], { a: 1, b: 1, cross: 0.5 }));
});

test('pinned Strudel multiplies a work trim with its existing per-part gains', () => {
  const left = stack(s('bd').gain(0.5), s('hh').gain(0.2));
  const right = s('sd').gain(0.4);
  assert.deepEqual(left.mul(gain(0.5)).queryArc(0, 1).map((hap) => hap.value.gain), [0.25, 0.1]);
  const mixed = xfade(left.mul(gain(0.5)), 0.5, right.mul(gain(0.5))).mul(gain(0.7));
  assert.deepEqual(mixed.queryArc(0, 1).map((hap) => Number(hap.value.gain.toFixed(3))), [0.175, 0.07, 0.14]);
});

test('code already trimmed to 15% receives a neutral default shelf level', () => {
  const original = works[0].source.replace(/\r\n?/g, '\n').trim() + '\n.mul(gain(0.15))';
  const code = singleWorkCode(original);
  new Script(code);
  assert.equal(managedSliderValue(code, 'WORKBENCH_LEVEL_V1'), 1);
  assert.ok(code.includes(original));
  const trimmed = stack(s('bd').gain(0.5), s('hh').gain(0.2)).mul(gain(0.15));
  assert.deepEqual(trimmed.mul(gain(1)).queryArc(0, 1).map((hap) => hap.value.gain), [0.075, 0.03]);
});
