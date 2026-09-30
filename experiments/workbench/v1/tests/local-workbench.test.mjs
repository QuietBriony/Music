import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createLocalServer, prepareSoundPack, verifySoundPack } from '../scripts/local-workbench.mjs';

const drumMapUrl = 'https://raw.githubusercontent.com/felixroos/dough-samples/9eacfc86ec4393e68a463ff52b01c19cfaa77f38/tidal-drum-machines.json';
const drumRoot = 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/main/machines/';

function fixtureFetcher() {
  const wav = Buffer.alloc(44);
  wav.write('RIFF', 0, 'ascii');
  wav.write('WAVE', 8, 'ascii');
  const paths = Object.fromEntries(['bd', 'sd', 'hh', 'oh'].map((part) =>
    ['RolandTR909_' + part, ['RolandTR909/' + part + '.wav']]));
  return async (url) => url === drumMapUrl
    ? { ok: true, url, json: async () => ({ _base: drumRoot, ...paths }) }
    : { ok: true, status: 200, url, headers: new Headers({ 'content-type': 'audio/wav',
      'content-length': String(wav.length) }), arrayBuffer: async () => wav.buffer.slice(
        wav.byteOffset, wav.byteOffset + wav.byteLength) };
}

test('local preparation rejects drum bytes that differ from the pinned source', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'music-workbench-test-'));
  try {
    await assert.rejects(prepareSoundPack(temp, fixtureFetcher()), /固定SHA-256/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('local server serves prepared cache and replaces the upstream maps', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'music-workbench-test-'));
  const sounds = join(temp, 'sounds');
  const site = join(temp, 'site');
  let server;
  try {
    await mkdir(site);
    await writeFile(join(site, 'index.html'),
      '<script src="/vendor/strudel/index.js" defer></script>');
    const sourceSounds = fileURLToPath(new URL('../third_party/acidbros/assets/samples/tr909/', import.meta.url));
    const sample = await readFile(join(sourceSounds, 'hh01.wav'));
    await mkdir(sounds);
    for (const part of ['pad', 'sub', 'drums', 'tr909_bd', 'tr909_sd', 'tr909_hh', 'tr909_oh']) {
      await writeFile(join(sounds, part + '.wav'), sample);
    }
    const files = Object.fromEntries(['pad', 'sub', 'drums', 'tr909_bd', 'tr909_sd', 'tr909_hh', 'tr909_oh']
      .map((part) => [part, { bytes: sample.length, sha256: '' }]));
    const hash = createHash('sha256').update(sample).digest('hex');
    for (const entry of Object.values(files)) entry.sha256 = hash;
    await writeFile(join(sounds, 'manifest.json'), JSON.stringify({ schema_version: 2,
      source: 'https://music-private-live-workbench.pages.dev', drum_map: drumMapUrl, files }));
    const manifest = await verifySoundPack(sounds);
    assert.equal(Object.keys(manifest.files).length, 7);

    server = createLocalServer({ directory: site, sounds });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const html = await (await fetch(base + '/')).text();
    assert.ok(html.indexOf('/__local__/bank-bridge.js') < html.indexOf('/vendor/strudel/index.js'));
    const bank = await (await fetch(base + '/__local__/maps/tidal-drum-machines.json')).json();
    assert.deepEqual(bank.RolandTR909_bd, ['bd.wav']);
    assert.equal((await fetch(base + '/api/sounds/pad')).status, 200);
    assert.equal((await fetch(base + '/__local__/samples/sd.wav')).status, 200);
    assert.equal((await fetch(base + '/api/sounds/other')).status, 404);
    assert.equal((await fetch(base + '/__local__/samples/other.wav')).status, 404);

    const pad = await readFile(join(sounds, 'pad.wav'));
    pad[0] = 0;
    await writeFile(join(sounds, 'pad.wav'), pad);
    await assert.rejects(verifySoundPack(sounds), /pad.wav/);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
});
