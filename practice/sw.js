// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v13';
const SHELL = ['./sanshin-core.mjs?v=13', './sanshin-view.mjs?v=13', './sanshin-guide.mjs?v=13', './sanshin.css?v=13', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=13', './presets.css?v=13', './app.mjs?v=13', './instrument-voice.mjs?v=13', './music.mjs?v=13', './midi.mjs?v=13', './chords.mjs?v=13', './scores.mjs?v=13', './singalong.mjs?v=13', './singalong-courses.mjs?v=13', './jigsaw-cues.mjs?v=13', './hand-guide.mjs?v=13', './hand-guide-core.mjs?v=13', './hand-guide.css?v=13', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=13', './singalong-core.mjs?v=13', './youtube.mjs?v=13', './singalong.css?v=13', './songs/singalong-provenance.json', './progress.mjs?v=13', './polyphonic.mjs?v=13', './lyrics.mjs?v=13', './lyric-presets.mjs?v=13', './session.css?v=13', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=13', './learning.mjs?v=13', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
const URLS = new Set(SHELL.map(path => new URL(path, self.location.href).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('music-practice-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !URLS.has(event.request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request,{cache:'reload'});
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
