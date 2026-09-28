import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet as getPattern } from '../functions/api/pattern.js';
import { onRequestGet as getSound } from '../functions/api/sounds/[part].js';

test('pattern endpoint only reads the configured KV key', async () => {
  const calls = [];
  const env = {
    LIVE_PATTERN_KEY: 'saved/pattern.js',
    MUSIC_LIVE_ASSETS: { get: async (...args) => { calls.push(args); return 'setcpm(24)'; } },
  };
  const response = await getPattern({ env });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'setcpm(24)');
  assert.deepEqual(calls, [['saved/pattern.js', 'text']]);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('sound endpoint rejects unknown names and serves only the three WAV parts', async () => {
  const calls = [];
  const bytes = new Uint8Array([82, 73, 70, 70]).buffer;
  const env = {
    LIVE_SOUND_PREFIX: 'saved/sounds',
    MUSIC_LIVE_ASSETS: { get: async (...args) => { calls.push(args); return bytes; } },
  };
  const unknown = await getSound({ env, params: { part: 'other' } });
  assert.equal(unknown.status, 404);
  assert.equal(calls.length, 0);
  const response = await getSound({ env, params: { part: 'drums' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'audio/wav');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [['saved/sounds/drums.wav', 'arrayBuffer']]);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(bytes));
});
