// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v35';
const SHELL = ['./lyric-notes.mjs?v=35', './songs/learning-provenance.json', './sanshin-core.mjs?v=35', './sanshin-view.mjs?v=35', './sanshin-guide.mjs?v=35', './sanshin.css?v=35', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=35', './presets.css?v=35', './app.mjs?v=35', './instrument-voice.mjs?v=35', './music.mjs?v=35', './midi.mjs?v=35', './chords.mjs?v=35', './scores.mjs?v=35', './singalong.mjs?v=35', './singalong-courses.mjs?v=35', './jigsaw-cues.mjs?v=35', './hand-guide.mjs?v=35', './hand-guide-core.mjs?v=35', './hand-guide.css?v=35', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=35', './singalong-core.mjs?v=35', './youtube.mjs?v=35', './singalong.css?v=35', './songs/singalong-provenance.json', './progress.mjs?v=35', './polyphonic.mjs?v=35', './lyrics.mjs?v=35', './lyric-presets.mjs?v=35', './session.css?v=35', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=35', './learning.mjs?v=35', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=35','./video-lyrics.mjs?v=35','./score-lyrics.mjs?v=35','./score-strip.mjs?v=35','./mic-input.mjs?v=35','./guitar-playlist.mjs?v=35','./guitar-playlist.css?v=35','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=35','./songs/sanshin-playlist.json','./tablet.css?v=35','./full-score.mjs?v=35','./full-score.css?v=35');
SHELL.push('./chord-guide.mjs?v=35','./chord-guide.css?v=35');
SHELL.push('./harmony-timeline.mjs?v=35','./estimated-courses.mjs?v=35','./auto-follow.css?v=35','./songs/auto-follow-provenance.json');
SHELL.push('./app-shell.mjs?v=35','./app-shell.css?v=35');
SHELL.push('./app-update.mjs?v=35','./first-song.mjs?v=35');
SHELL.push('./song-coach.mjs?v=35','./material-courses.mjs?v=35','./material-arrangements.mjs?v=35','./sanshin-materials.mjs?v=35','./materials.css?v=35','./songs/material-provenance.json');
const VERSION = '35';
SHELL.push('./sanshin-session.mjs?v=35','./sanshin-study.css?v=35');
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
