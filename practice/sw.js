// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v7';
const SHELL = ['./', './index.html', './style.css?v=7', './presets.css?v=7', './app.mjs?v=7', './music.mjs?v=7', './midi.mjs?v=7', './chords.mjs?v=7', './scores.mjs?v=7', './singalong.mjs?v=7', './singalong-core.mjs?v=7', './youtube.mjs?v=7', './singalong.css?v=7', './songs/singalong-provenance.json', './progress.mjs?v=7', './polyphonic.mjs?v=7', './lyrics.mjs?v=7', './lyric-presets.mjs?v=7', './session.css?v=7', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=7', './learning.mjs?v=7', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
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
