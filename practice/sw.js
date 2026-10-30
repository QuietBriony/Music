// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v8';
const SHELL = ['./', './index.html', './style.css?v=8', './presets.css?v=8', './app.mjs?v=8', './music.mjs?v=8', './midi.mjs?v=8', './chords.mjs?v=8', './scores.mjs?v=8', './singalong.mjs?v=8', './video-cues.mjs?v=8', './singalong-core.mjs?v=8', './youtube.mjs?v=8', './singalong.css?v=8', './songs/singalong-provenance.json', './progress.mjs?v=8', './polyphonic.mjs?v=8', './lyrics.mjs?v=8', './lyric-presets.mjs?v=8', './session.css?v=8', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=8', './learning.mjs?v=8', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
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
