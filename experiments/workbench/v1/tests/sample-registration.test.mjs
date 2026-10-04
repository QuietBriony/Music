import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { singleWorkCode } from '../src/mix-code.js';
import { createSampleRegistry } from './helpers/sample-registry.mjs';

const names = ['bd', 'sd', 'hh', 'oh'];
const globalKeys = [...names.map(name => 'RolandTR909_' + name), 'set_crash', 'set_ride'];
const sampleRoot = 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/main/machines/RolandTR909/';
const expected = {
  afterimagefinalv1_bd: [sampleRoot + 'rolandtr909-bd/Bassdrum-01.wav'],
  afterimagefinalv1_sd: [sampleRoot + 'rolandtr909-sd/naredrum.wav'],
  afterimagefinalv1_hh: [sampleRoot + 'rolandtr909-hh/hh01.wav'],
  afterimagefinalv1_oh: [sampleRoot + 'rolandtr909-oh/Hat Open.wav'],
  afterimage_final_v1_crash: ['/modules/acidbros/assets/samples/tr909/cr01.wav'],
  afterimage_final_v1_ride: ['/modules/acidbros/assets/samples/tr909/rd01.wav'],
};

async function seededRegistry() {
  const registry = await createSampleRegistry();
  await registry.registerSamples(Object.fromEntries(names.map(name => ['RolandTR909_' + name, '/__local__/samples/' + name + '.wav'])));
  await registry.registerSamples({ set_crash: 'fixture://existing/shared-crash.wav', set_ride: 'fixture://existing/shared-ride.wav' });
  return registry;
}

test('Afterimage registration and return to existing Acid preserve the global local bank and cymbals', async () => {
  const [score, acid] = await Promise.all([
    readFile(new URL('../src/patterns/afterimage-final-v1.txt', import.meta.url), 'utf8'),
    readFile(new URL('../src/patterns/acid-303-909.txt', import.meta.url), 'utf8'),
  ]);
  const registry = await seededRegistry();
  const before = registry.snapshot(globalKeys);
  for (const code of [singleWorkCode(score), singleWorkCode(acid), singleWorkCode(score)]) {
    assert.ok(await registry.registerCode(code), 'the production score contains actual sample declarations');
    assert.deepEqual(registry.snapshot(globalKeys), before, 'shared 909 and cymbal registrations survive each selection');
    assert.deepEqual(registry.snapshot(Object.keys(expected)), expected, 'all six isolated source URLs remain exact');
  }
  assert.deepEqual(registry.boundaryAttempts, { network: 0, audio: 0 });
});

test('same-key negative control exposes the original shared-bank overwrite', async () => {
  const registry = await seededRegistry();
  const before = registry.snapshot(globalKeys);
  const unsafe = Object.fromEntries(names.map(name => ['RolandTR909_' + name, expected['afterimagefinalv1_' + name][0]]));
  unsafe.set_crash = expected.afterimage_final_v1_crash[0];
  unsafe.set_ride = expected.afterimage_final_v1_ride[0];
  assert.equal(await registry.registerCode('samples(' + JSON.stringify(unsafe) + ')'), 1);
  assert.notDeepEqual(registry.snapshot(globalKeys), before, 'the preservation invariant catches same-key registration');
  for (const name of names) assert.deepEqual(registry.sources('RolandTR909_' + name), expected['afterimagefinalv1_' + name]);
  assert.notDeepEqual(registry.sources('set_crash'), before.set_crash);
  assert.notDeepEqual(registry.sources('set_ride'), before.set_ride);
  const acid = await readFile(new URL('../src/patterns/acid-303-909.txt', import.meta.url), 'utf8');
  await registry.registerCode(singleWorkCode(acid));
  assert.notDeepEqual(registry.snapshot(globalKeys), before, 'existing Acid does not silently repair a polluted bank');
  assert.deepEqual(registry.boundaryAttempts, { network: 0, audio: 0 });
});

test('registration-only helper refuses fetching and never evaluates the musical expression', async () => {
  const registry = await createSampleRegistry();
  assert.equal(await registry.registerCode("samples({qa_sample:'fixture://example.wav'})\nthrow new Error('musical expression must not run')"), 1);
  assert.deepEqual(registry.sources('qa_sample'), ['fixture://example.wav']);
  await assert.rejects(registry.registerCode("samples('https://invalid.example/registry.json')"), /literal samples/);
  await assert.rejects(registry.registerCode("samples({qa_sample:fetch('https://invalid.example/sample.wav')})"), /literal samples/);
  assert.deepEqual(registry.boundaryAttempts, { network: 0, audio: 0 });
});
