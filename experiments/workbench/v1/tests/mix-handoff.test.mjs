import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { deckMixCode, readDeckMix, splitPublishedPattern } from '../src/mix-code.js';
import { readTechnoSet, setFromMix, technoSetCode, SET_TRACKS, defaultSet } from '../src/live-code.js';

const catalog = JSON.parse(readFileSync(new URL('../src/library.json', import.meta.url)));
const layers = catalog.items.map(item => ({ id: item.id, title: item.title,
  source: readFileSync(new URL('../src' + item.path, import.meta.url), 'utf8') }));
const settings = { a: .42, b: .31, cross: .23 };

test('every published pair keeps its musical bodies and mix values when recovered', () => {
  for (const a of layers) for (const b of layers.filter(layer => layer.id !== a.id)) {
    const code = deckMixCode(a, b, settings);
    const recovered = readDeckMix(code);
    assert.ok(recovered, a.id + ' + ' + b.id);
    assert.deepEqual(recovered.settings, settings);
    assert.deepEqual(recovered.layers.map(layer => layer.id), [a.id, b.id]);
    for (const [i, original] of [a, b].entries()) {
      const before = splitPublishedPattern(original.source);
      const after = splitPublishedPattern(recovered.layers[i].source);
      assert.equal(after.expression, before.expression);
      assert.equal(after.declarations, before.declarations);
    }
  }
});

test('edits inside a musical body survive; changes to the outer mixing logic fail closed', () => {
  const code = deckMixCode(layers[0], layers[1], settings);
  const modified = code.replace(/return stack\(/, 'return stack(\n// my live edit');
  assert.ok(readDeckMix(modified)?.layers[0].source.includes('// my live edit'));
  for (const altered of [code + '\nconsole.log(1)', code.replace('.mul(gain(0.7))', '.mul(gain(0.9))'),
    code.replace('slider(0.42,', 'slider(1.2,'), code.replace('return stack(', 'return silence(')]) {
    assert.equal(readDeckMix(altered), null);
  }
});

test('a transferred mix keeps A tempo, all layer notes and levels, with extra instruments muted', () => {
  const mix = readDeckMix(deckMixCode(layers[0], layers[1], settings));
  const titled = mix.layers.map((layer, i) => ({ ...layer, title: layers[i].title }));
  const state = setFromMix(titled, mix.settings);
  assert.equal(state.bpm, splitPublishedPattern(layers[0].source).cpm * 4);
  assert.deepEqual(state.muted, SET_TRACKS);
  assert.deepEqual([state.values.A, state.values.B, state.values.CROSS], [.42, .31, .23]);
  assert.deepEqual(state.layers, titled);
  assert.equal(state.layerGain, 1);
  const recovered = readTechnoSet(technoSetCode(state));
  assert.deepEqual(recovered, state);
  // Saving/reopening then adding a kick preserves the transferred layer gain.
  recovered.muted = recovered.muted.filter(track => track !== 'kick');
  assert.equal(readTechnoSet(technoSetCode(recovered)).layerGain, 1);
  assert.throws(() => setFromMix(titled, { ...settings, b: NaN }));
  const tooFast = [{ ...titled[0], source: titled[0].source.replace(/^setcpm\([0-9.]+\)/m, 'setcpm(50)') }, titled[1]];
  assert.throws(() => setFromMix(tooFast, settings), /60〜180/);
});

test('ordinary and saved V3 sets keep the original layer attenuation without opting into transfer', () => {
  const state = defaultSet('acid-drive', layers.slice(0, 2));
  assert.equal(state.layerGain, undefined);
  const code = technoSetCode(state);
  assert.match(code, /setLayerB\.mul\(gain\(SET_B\)\)\)\.mul\(gain\(0\.3\)\)/);
  assert.deepEqual(readTechnoSet(code), state);
  assert.throws(() => technoSetCode({ ...state, layerGain: 2 }));
});
