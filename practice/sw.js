// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v32';
const SHELL = ['./lyric-notes.mjs?v=32', './songs/learning-provenance.json', './sanshin-core.mjs?v=32', './sanshin-view.mjs?v=32', './sanshin-guide.mjs?v=32', './sanshin.css?v=32', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=32', './presets.css?v=32', './app.mjs?v=32', './instrument-voice.mjs?v=32', './music.mjs?v=32', './midi.mjs?v=32', './chords.mjs?v=32', './scores.mjs?v=32', './singalong.mjs?v=32', './singalong-courses.mjs?v=32', './jigsaw-cues.mjs?v=32', './hand-guide.mjs?v=32', './hand-guide-core.mjs?v=32', './hand-guide.css?v=32', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=32', './singalong-core.mjs?v=32', './youtube.mjs?v=32', './singalong.css?v=32', './songs/singalong-provenance.json', './progress.mjs?v=32', './polyphonic.mjs?v=32', './lyrics.mjs?v=32', './lyric-presets.mjs?v=32', './session.css?v=32', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=32', './learning.mjs?v=32', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=32','./video-lyrics.mjs?v=32','./score-lyrics.mjs?v=32','./score-strip.mjs?v=32','./mic-input.mjs?v=32','./guitar-playlist.mjs?v=32','./guitar-playlist.css?v=32','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=32','./songs/sanshin-playlist.json','./tablet.css?v=32','./full-score.mjs?v=32','./full-score.css?v=32');
SHELL.push('./chord-guide.mjs?v=32','./chord-guide.css?v=32');
SHELL.push('./harmony-timeline.mjs?v=32','./estimated-courses.mjs?v=32','./auto-follow.css?v=32','./songs/auto-follow-provenance.json');
SHELL.push('./app-shell.mjs?v=32','./app-shell.css?v=32');
SHELL.push('./app-update.mjs?v=32','./first-song.mjs?v=32');
SHELL.push('./song-coach.mjs?v=32');
const VERSION = '32';
const URLS = new Set(SHELL.map(path => new URL(path, self.location.href).href));
const ASSET_PATHS = new Set([...URLS].map(url => new URL(url).pathname));
const INDEX = new URL('./index.html', self.location.href).href;
const ROOT = new URL('./', self.location.href);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    await cache.addAll(SHELL.map(path => new Request(new URL(path, self.location.href), { cache: 'reload' })));
    for (const path of ['./', './index.html']) {
      const key = new URL(path, self.location.href).href, response = await cache.match(key);
      if (!(await response.clone().text()).includes(`<meta name="practice-version" content="${VERSION}">`)) throw Error('Incomplete practice release');
      // Pages redirects index.html to /. Navigation cannot reuse a followed redirect.
      // Normalizing this identical HTML also repairs an already installed v31 cache.
      if (response.redirected) await cache.put(key, new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers }));
    }
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'PRACTICE_VERSION') event.ports[0]?.postMessage({ version: VERSION });
  if (event.data?.type === 'PRACTICE_ACTIVATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'PRACTICE_CLEAN' && event.data.version === VERSION) event.waitUntil((async () => {
    const clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => client.url.startsWith(ROOT.href));
    // Another tab may still be running the previous release. Keep its cached modules.
    if (clients.length !== 1 || clients[0].id !== event.source?.id) return;
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('music-practice-') && key !== CACHE).map(key => caches.delete(key)));
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url); url.hash = '';
  if (event.request.method !== 'GET') return;
  const navigation = event.request.mode === 'navigate' && url.origin === ROOT.origin && [ROOT.pathname, new URL(INDEX).pathname].includes(url.pathname);
  const known = URLS.has(url.href);
  const previous = url.origin === ROOT.origin && ASSET_PATHS.has(url.pathname) && /^\d+$/.test(url.searchParams.get('v') || '') && Number(url.searchParams.get('v')) < Number(VERSION);
  if (!navigation && !known && !previous) return;
  event.respondWith((async () => {
    if (previous) {
      for (const key of (await caches.keys()).filter(key => key.startsWith('music-practice-'))) {
        const response = await (await caches.open(key)).match(url.href); if (response) return response;
      }
      return fetch(event.request);
    }
    const cache = await caches.open(CACHE), key = navigation ? INDEX : url.href;
    const cached = await cache.match(key);
    // A release is an immutable HTML / module / stylesheet snapshot until activation.
    if (cached) return navigation && cached.redirected ? new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers }) : cached;
    return fetch(event.request);
  })());
});
