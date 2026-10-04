import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSamplePreparation } from '../src/sample-preparation.js';
import { isSynthOnlyCode, singleWorkCode } from '../src/mix-code.js';

const synth = readFileSync(new URL('../src/patterns/afterimage-synth-v1.txt', import.meta.url), 'utf8');
test('synthetic published and saved code require no default sample registry', async () => {
  let calls = 0;
  const prepare = createSamplePreparation(() => { calls++; });
  const wrapped = singleWorkCode(synth);
  assert.ok(isSynthOnlyCode(wrapped));
  assert.doesNotMatch(wrapped, /samples\s*\(|\/api\/sounds\//);
  await prepare(synth);
  await prepare(wrapped.replaceAll('\n', '\r\n') + '\r\n// saved edit');
  assert.equal(calls, 0);
});
test('ordinary works share exactly one lazy default registry preparation', async () => {
  let calls = 0;
  let resolve;
  const gate = new Promise(yes => { resolve = yes; });
  const prepare = createSamplePreparation(() => { calls++; return gate; });
  const pending = [prepare('s("bd")'), prepare('s("hh")')];
  await Promise.resolve();
  assert.equal(calls, 1);
  await prepare(synth);
  resolve();
  await Promise.all(pending);
  await prepare('s("sd")');
  assert.equal(calls, 1);
});
test('a failed registry request stays failed without automatic retry and synth stays usable', async () => {
  let calls = 0;
  const failure = new Error('registry unavailable');
  const prepare = createSamplePreparation(() => { calls++; throw failure; });
  await assert.rejects(prepare('s("bd")'), error => error === failure);
  await assert.rejects(prepare('s("hh")'), error => error === failure);
  await prepare(synth);
  assert.equal(calls, 1);
});
