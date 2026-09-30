import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const dist = new URL('../dist/', import.meta.url);
test('PWA release contains the complete self-hosted app and valid home-screen assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist)));
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  for (const [filename, size] of [['music-live-192.png', 192], ['music-live-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const png = await readFile(new URL('icons/' + filename, dist));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const release = JSON.parse(await readFile(new URL('offline-assets.json', dist)));
  const urls = release.assets.map((file) => file.url);
  for (const path of ['/index.html', '/app.js', '/pwa.js', '/session-backup.js', '/manifest.webmanifest',
    '/vendor/strudel/index.js', '/modules/acidbros/index.html', '/patterns/acid-303-909.txt', '/live-code.js', '/live-plan.js']) assert.ok(urls.includes(path), path);
  assert.equal(urls.filter((url) => url.endsWith('.wav')).length, 4, 'only the four approved bundled acidBros WAVs');
  assert.equal(urls.some((url) => url.startsWith('/api/') || url === '/sw.js'), false);
  for (const file of release.assets) {
    const bytes = await readFile(new URL(file.url.slice(1), dist));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.url);
    assert.equal(bytes.length, file.bytes);
  }
  const worker = await readFile(new URL('sw.js', dist), 'utf8');
  assert.ok(worker.includes(JSON.stringify(release.release)));
  new Script(worker); // classic service worker, not a module with unbundled imports
});
