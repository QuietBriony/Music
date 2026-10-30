// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v6';
const SHELL = ['./', './index.html', './style.css?v=6', './presets.css?v=6', './app.mjs?v=6', './music.mjs?v=6', './midi.mjs?v=6', './chords.mjs?v=6', './scores.mjs?v=6', './progress.mjs?v=6', './polyphonic.mjs?v=6', './lyrics.mjs?v=6', './lyric-presets.mjs?v=6', './session.css?v=6', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=6', './learning.mjs?v=6', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
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
