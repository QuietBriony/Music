// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v46';
const SHELL = ['./lyric-notes.mjs?v=46', './songs/learning-provenance.json', './sanshin-core.mjs?v=46', './sanshin-view.mjs?v=46', './sanshin-guide.mjs?v=46', './sanshin.css?v=46', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=46', './presets.css?v=46', './app.mjs?v=46', './instrument-voice.mjs?v=46', './music.mjs?v=46', './midi.mjs?v=46', './chords.mjs?v=46', './scores.mjs?v=46', './singalong.mjs?v=46', './singalong-courses.mjs?v=46', './jigsaw-cues.mjs?v=46', './hand-guide.mjs?v=46', './hand-guide-core.mjs?v=46', './hand-guide.css?v=46', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=46', './singalong-core.mjs?v=46', './youtube.mjs?v=46', './singalong.css?v=46', './songs/singalong-provenance.json', './progress.mjs?v=46', './polyphonic.mjs?v=46', './lyrics.mjs?v=46', './lyric-storage.mjs?v=46', './lyric-presets.mjs?v=46', './session.css?v=46', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=46', './learning.mjs?v=46', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=46','./video-lyrics.mjs?v=46','./score-lyrics.mjs?v=46','./score-strip.mjs?v=46','./mic-input.mjs?v=46','./guitar-playlist.mjs?v=46','./guitar-playlist.css?v=46','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=46','./songs/sanshin-playlist.json','./tablet.css?v=46','./full-score.mjs?v=46', './full-score-support.mjs?v=46','./full-score.css?v=46');
SHELL.push('./chord-guide.mjs?v=46','./chord-guide.css?v=46');
SHELL.push('./harmony-timeline.mjs?v=46','./estimated-courses.mjs?v=46','./auto-follow.css?v=46','./songs/auto-follow-provenance.json');
SHELL.push('./app-shell.mjs?v=46','./app-shell.css?v=46');
SHELL.push('./app-update.mjs?v=46','./first-song.mjs?v=46');
SHELL.push('./song-coach.mjs?v=46','./material-courses.mjs?v=46','./material-arrangements.mjs?v=46','./sanshin-materials.mjs?v=46','./materials.css?v=46','./songs/material-provenance.json');
const VERSION = '46';
SHELL.push('./mic-permission.mjs?v=46');
SHELL.push('./sanshin-session.mjs?v=46','./sanshin-study.css?v=46','./sanshin-follow.mjs?v=46','./songs/asatoya.mid','./songs/asatoya-provenance.json');
SHELL.push('./songs/tsukinu.mid','./songs/tsukinu-provenance.json');
SHELL.push('./minyo-lyrics.mjs?v=46','./minyo-verses.mjs?v=46','./songs/minyo-v42-research.json');
SHELL.push('./folk-lyrics.mjs?v=46','./songs/aha.mid','./songs/aha-provenance.json','./songs/folk-v43-provenance.json');
SHELL.push('./privacy.mjs?v=46','./policies.css?v=46','./video-policy.css?v=46','./terms.html','./privacy.html','./songs/youtube-status.json');
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
