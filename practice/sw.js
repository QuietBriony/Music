// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v10';
const SHELL = ['./', './index.html', './style.css?v=10', './presets.css?v=10', './app.mjs?v=10', './music.mjs?v=10', './midi.mjs?v=10', './chords.mjs?v=10', './scores.mjs?v=10', './singalong.mjs?v=10', './hand-guide.mjs?v=10', './hand-guide-core.mjs?v=10', './hand-guide.css?v=10', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=10', './singalong-core.mjs?v=10', './youtube.mjs?v=10', './singalong.css?v=10', './songs/singalong-provenance.json', './progress.mjs?v=10', './polyphonic.mjs?v=10', './lyrics.mjs?v=10', './lyric-presets.mjs?v=10', './session.css?v=10', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=10', './learning.mjs?v=10', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
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
