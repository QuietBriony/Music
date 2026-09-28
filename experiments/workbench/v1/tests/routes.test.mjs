import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as authChain } from '../functions/_middleware.js';
import { onRequestGet as getPattern } from '../functions/api/pattern.js';
import { onRequestGet as getSound } from '../functions/api/sounds/[part].js';

test('private app fails closed without Access configuration', async () => {
  const response = await authChain[0]({ env: {}, next: () => new Response('public') });
  assert.equal(response.status, 503);
});

test('owner identity is required even after an Access token passes validation', async () => {
  const env = { OWNER_EMAIL: 'owner@example.com' };
  const next = () => new Response('private');
  const other = await authChain[2]({ env, data: { cloudflareAccess: { JWT: { payload: { email: 'other@example.com' } } } }, next });
  assert.equal(other.status, 403);
  const owner = await authChain[2]({ env, data: { cloudflareAccess: { JWT: { payload: { email: 'OWNER@example.com' } } } }, next });
  assert.equal(await owner.text(), 'private');
});

test('pattern endpoint only reads the configured private key', async () => {
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

test('sound endpoint rejects unknown names and serves only private WAV bytes', async () => {
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
