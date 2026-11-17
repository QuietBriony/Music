// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v44';
const SHELL = ['./lyric-notes.mjs?v=44', './songs/learning-provenance.json', './sanshin-core.mjs?v=44', './sanshin-view.mjs?v=44', './sanshin-guide.mjs?v=44', './sanshin.css?v=44', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=44', './presets.css?v=44', './app.mjs?v=44', './instrument-voice.mjs?v=44', './music.mjs?v=44', './midi.mjs?v=44', './chords.mjs?v=44', './scores.mjs?v=44', './singalong.mjs?v=44', './singalong-courses.mjs?v=44', './jigsaw-cues.mjs?v=44', './hand-guide.mjs?v=44', './hand-guide-core.mjs?v=44', './hand-guide.css?v=44', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=44', './singalong-core.mjs?v=44', './youtube.mjs?v=44', './singalong.css?v=44', './songs/singalong-provenance.json', './progress.mjs?v=44', './polyphonic.mjs?v=44', './lyrics.mjs?v=44', './lyric-storage.mjs?v=44', './lyric-presets.mjs?v=44', './session.css?v=44', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=44', './learning.mjs?v=44', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=44','./video-lyrics.mjs?v=44','./score-lyrics.mjs?v=44','./score-strip.mjs?v=44','./mic-input.mjs?v=44','./guitar-playlist.mjs?v=44','./guitar-playlist.css?v=44','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=44','./songs/sanshin-playlist.json','./tablet.css?v=44','./full-score.mjs?v=44','./full-score.css?v=44');
SHELL.push('./chord-guide.mjs?v=44','./chord-guide.css?v=44');
SHELL.push('./harmony-timeline.mjs?v=44','./estimated-courses.mjs?v=44','./auto-follow.css?v=44','./songs/auto-follow-provenance.json');
SHELL.push('./app-shell.mjs?v=44','./app-shell.css?v=44');
SHELL.push('./app-update.mjs?v=44','./first-song.mjs?v=44');
SHELL.push('./song-coach.mjs?v=44','./material-courses.mjs?v=44','./material-arrangements.mjs?v=44','./sanshin-materials.mjs?v=44','./materials.css?v=44','./songs/material-provenance.json');
const VERSION = '44';
SHELL.push('./mic-permission.mjs?v=44');
SHELL.push('./sanshin-session.mjs?v=44','./sanshin-study.css?v=44','./sanshin-follow.mjs?v=44','./songs/asatoya.mid','./songs/asatoya-provenance.json');
SHELL.push('./songs/tsukinu.mid','./songs/tsukinu-provenance.json');
SHELL.push('./minyo-lyrics.mjs?v=44','./minyo-verses.mjs?v=44','./songs/minyo-v42-research.json');
SHELL.push('./folk-lyrics.mjs?v=44','./songs/aha.mid','./songs/aha-provenance.json','./songs/folk-v43-provenance.json');
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
