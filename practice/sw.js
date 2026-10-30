// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v11';
const SHELL = ['./', './index.html', './style.css?v=11', './presets.css?v=11', './app.mjs?v=11', './music.mjs?v=11', './midi.mjs?v=11', './chords.mjs?v=11', './scores.mjs?v=11', './singalong.mjs?v=11', './singalong-courses.mjs?v=11', './jigsaw-cues.mjs?v=11', './hand-guide.mjs?v=11', './hand-guide-core.mjs?v=11', './hand-guide.css?v=11', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=11', './singalong-core.mjs?v=11', './youtube.mjs?v=11', './singalong.css?v=11', './songs/singalong-provenance.json', './progress.mjs?v=11', './polyphonic.mjs?v=11', './lyrics.mjs?v=11', './lyric-presets.mjs?v=11', './session.css?v=11', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=11', './learning.mjs?v=11', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
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
