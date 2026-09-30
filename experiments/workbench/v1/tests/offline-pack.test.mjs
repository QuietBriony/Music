import assert from 'node:assert/strict';
import test from 'node:test';
import { SOUND_FILES, SOUND_CACHE_PREFIX, SOUND_META_CACHE, SOUND_META_PATH,
  SAMPLE_REGISTRIES, soundDigest, soundFileFor, offlineRegistry, soundRange } from '../src/offline-policy.js';
import { readSoundPack, saveSoundPack } from '../src/offline-pack.js';

const origin = 'https://music.example';
const wave = () => {
  const bytes = new Uint8Array(48);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WAVE'), 8);
  return bytes;
};
const files = [{ key: '/api/sounds/pad', url: '/api/sounds/pad', label: 'pad' },
  { key: '/api/sounds/sub', url: '/api/sounds/sub', label: 'sub' }];
const okFetch = async () => new Response(wave(), { headers: { 'Content-Type': 'audio/wav' } });

class MemoryStorage {
  sets = new Map();
  failCommit = false;
  failCleanup = false;
  failWrite = false;
  async open(name) {
    if (!this.sets.has(name)) this.sets.set(name, new Map());
    const entries = this.sets.get(name);
    const key = (request) => typeof request === 'string' ? request : request.url;
    return {
      match: async (request) => entries.get(key(request))?.clone(),
      put: async (request, response) => {
        if ((this.failCommit && name === SOUND_META_CACHE) || (this.failWrite && name.startsWith(SOUND_CACHE_PREFIX))) {
          throw new Error('QuotaExceededError');
        }
        entries.set(key(request), response.clone());
      },
      delete: async (request) => entries.delete(key(request)),
    };
  }
  async keys() { if (this.failCleanup) throw new Error('cleanup failure'); return [...this.sets.keys()]; }
  async delete(name) { return this.sets.delete(name); }
}

test('only the seven approved sounds and their exact standard-bank aliases match', () => {
  assert.equal(SOUND_FILES.length, 7);
  for (const file of SOUND_FILES) {
    assert.equal(soundFileFor(new URL(file.key, origin).href + '?cache=1', origin), file);
    if (file.alias) assert.equal(soundFileFor(file.alias, origin), file);
  }
  for (const url of ['/api/private', '/api/pattern', '/api/sounds/pad/other', '/audio/me.wav',
    'https://elsewhere.example/api/sounds/pad', 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/main/machines/other.wav']) {
    assert.equal(soundFileFor(new URL(url, origin).href, origin), undefined);
  }
});

test('offline startup registries expose just the four pinned first-hit 909 sounds', () => {
  const bank = offlineRegistry(SAMPLE_REGISTRIES[0]);
  assert.deepEqual(Object.keys(bank), ['_base', 'RolandTR909_bd', 'RolandTR909_sd', 'RolandTR909_hh', 'RolandTR909_oh']);
  for (const [key, values] of Object.entries(bank)) {
    if (key === '_base') continue;
    assert.equal(values.length, 1);
    assert.ok(SOUND_FILES.some((file) => file.url === new URL(values[0], bank._base).href));
    assert.match(bank._base, /6577395a4d05031728ced2ec3e5637fa89d8be48/);
  }
  for (const url of SAMPLE_REGISTRIES.slice(1)) assert.deepEqual(offlineRegistry(url), {});
});

test('full and byte-range responses preserve cached audio and content type', async () => {
  const full = new Response(Uint8Array.from({ length: 12 }, (_, i) => i), { headers: { 'Content-Type': 'audio/wav' } });
  assert.equal(await soundRange(full, null), full);
  const part = await soundRange(full.clone(), 'bytes=2-5');
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 2-5/12');
  assert.equal(part.headers.get('Content-Type'), 'audio/wav');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [2, 3, 4, 5]);
  assert.equal((await full.arrayBuffer()).byteLength, 12);
});

test('Safari suffix and open-ended ranges are supported, end bounds are clamped', async () => {
  const response = () => new Response(new Uint8Array(12));
  for (const [range, expected] of [['bytes=-3', 'bytes 9-11/12'], ['bytes=8-', 'bytes 8-11/12'],
    ['bytes=2-99', 'bytes 2-11/12'], ['bytes=-99', 'bytes 0-11/12']]) {
    assert.equal((await soundRange(response(), range)).headers.get('Content-Range'), expected);
  }
});

test('malformed, multiple, zero-suffix and out-of-bounds ranges return 416', async () => {
  for (const range of ['bytes=99-', 'bytes=8-2', 'bytes=-0', 'bytes=-', 'bytes=0-2,4-6',
    'items=0-3', 'bytes=999999999999999999999-']) {
    const response = await soundRange(new Response(new Uint8Array(12)), range);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), 'bytes */12');
  }
});

test('a pack becomes ready only after every validated file and metadata commit', async () => {
  const storage = new MemoryStorage();
  assert.equal((await readSoundPack(storage, origin, files)).ready, false);
  const progress = [];
  const saved = await saveSoundPack({ storage, origin, files, fetcher: okFetch, progress: (item) => progress.push(item.done) });
  assert.equal(saved.ready, true);
  assert.equal(saved.bytes, 96);
  assert.deepEqual(progress, [0, 1, 2]);
  assert.equal((await readSoundPack(storage, origin, files)).cacheName, saved.cacheName);
});

test('network failure keeps the previous complete pack without partial promotion', async () => {
  const storage = new MemoryStorage();
  const original = await saveSoundPack({ storage, origin, files, fetcher: okFetch });
  let fetches = 0;
  await assert.rejects(saveSoundPack({ storage, origin, files, fetcher: async () => {
    if (++fetches === 2) throw new Error('offline');
    return okFetch();
  } }), /前の音源セットは残っています/);
  const current = await readSoundPack(storage, origin, files);
  assert.equal(current.ready, true);
  assert.equal(current.cacheName, original.cacheName);
  assert.equal((await storage.keys()).filter((name) => name.startsWith(SOUND_CACHE_PREFIX)).length, 1);
});

test('quota failures in either audio writes or pointer commit keep the old pack', async () => {
  for (const failure of ['failWrite', 'failCommit']) {
    const storage = new MemoryStorage();
    const original = await saveSoundPack({ storage, origin, files, fetcher: okFetch });
    storage[failure] = true;
    await assert.rejects(saveSoundPack({ storage, origin, files, fetcher: okFetch }), /QuotaExceeded/);
    assert.equal((await readSoundPack(storage, origin, files)).cacheName, original.cacheName);
  }
});

test('cleanup errors after commit do not delete the new active pack', async () => {
  const storage = new MemoryStorage();
  await saveSoundPack({ storage, origin, files, fetcher: okFetch });
  storage.failCleanup = true;
  const current = await saveSoundPack({ storage, origin, files, fetcher: okFetch });
  assert.equal((await readSoundPack(storage, origin, files)).cacheName, current.cacheName);
  assert.equal((await readSoundPack(storage, origin, files)).ready, true);
});

test('evicted sound makes readiness false, and the next successful save repairs it', async () => {
  const storage = new MemoryStorage();
  const original = await saveSoundPack({ storage, origin, files, fetcher: okFetch });
  await (await storage.open(original.cacheName)).delete(origin + files[0].key);
  assert.equal((await readSoundPack(storage, origin, files)).ready, false);
  await saveSoundPack({ storage, origin, files, fetcher: okFetch });
  assert.equal((await readSoundPack(storage, origin, files)).ready, true);
});

test('non-WAV bodies, oversized declarations, redirects and fixed-hash mismatch cannot be promoted', async () => {
  const sha256 = await soundDigest(wave());
  const pinned = [{ ...files[0], sha256 }];
  const invalid = [
    new Response('<html>error</html>'),
    new Response(wave(), { headers: { 'Content-Length': '20000001' } }),
    new Response(wave().fill(1)),
    Object.assign(new Response(wave()), { __differentUrl: true }),
  ];
  for (const response of invalid) {
    if (response.__differentUrl) Object.defineProperty(response, 'url', { value: 'https://elsewhere.example/audio.wav' });
    const storage = new MemoryStorage();
    await assert.rejects(saveSoundPack({ storage, origin, files: pinned, fetcher: async () => response }));
    assert.equal((await readSoundPack(storage, origin, pinned)).ready, false);
  }
  const changed = wave(); changed[44] = 1;
  await assert.rejects(saveSoundPack({ storage: new MemoryStorage(), origin, files: pinned,
    fetcher: async () => new Response(changed) }), /固定版と一致しません/);
});

test('metadata for a different schema/cache cannot claim offline readiness', async () => {
  const storage = new MemoryStorage();
  const control = await storage.open(SOUND_META_CACHE);
  for (const invalid of [null, { schema_version: 99 }, { schema_version: 1, cacheName: 42, files }, { schema_version: 1, cacheName: 'another-app', files },
    { schema_version: 1, cacheName: SOUND_CACHE_PREFIX + 'missing', files: [] }]) {
    await control.put(origin + SOUND_META_PATH, new Response(JSON.stringify(invalid)));
    assert.equal((await readSoundPack(storage, origin, files)).ready, false);
  }
});
