// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v14';
const SHELL = ['./lyric-notes.mjs?v=14', './songs/learning-provenance.json', './sanshin-core.mjs?v=14', './sanshin-view.mjs?v=14', './sanshin-guide.mjs?v=14', './sanshin.css?v=14', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=14', './presets.css?v=14', './app.mjs?v=14', './instrument-voice.mjs?v=14', './music.mjs?v=14', './midi.mjs?v=14', './chords.mjs?v=14', './scores.mjs?v=14', './singalong.mjs?v=14', './singalong-courses.mjs?v=14', './jigsaw-cues.mjs?v=14', './hand-guide.mjs?v=14', './hand-guide-core.mjs?v=14', './hand-guide.css?v=14', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=14', './singalong-core.mjs?v=14', './youtube.mjs?v=14', './singalong.css?v=14', './songs/singalong-provenance.json', './progress.mjs?v=14', './polyphonic.mjs?v=14', './lyrics.mjs?v=14', './lyric-presets.mjs?v=14', './session.css?v=14', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=14', './learning.mjs?v=14', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
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
