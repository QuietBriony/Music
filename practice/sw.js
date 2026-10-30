// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v15';
const SHELL = ['./lyric-notes.mjs?v=15', './songs/learning-provenance.json', './sanshin-core.mjs?v=15', './sanshin-view.mjs?v=15', './sanshin-guide.mjs?v=15', './sanshin.css?v=15', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=15', './presets.css?v=15', './app.mjs?v=15', './instrument-voice.mjs?v=15', './music.mjs?v=15', './midi.mjs?v=15', './chords.mjs?v=15', './scores.mjs?v=15', './singalong.mjs?v=15', './singalong-courses.mjs?v=15', './jigsaw-cues.mjs?v=15', './hand-guide.mjs?v=15', './hand-guide-core.mjs?v=15', './hand-guide.css?v=15', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=15', './singalong-core.mjs?v=15', './youtube.mjs?v=15', './singalong.css?v=15', './songs/singalong-provenance.json', './progress.mjs?v=15', './polyphonic.mjs?v=15', './lyrics.mjs?v=15', './lyric-presets.mjs?v=15', './session.css?v=15', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=15', './learning.mjs?v=15', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./tablet.css?v=15');
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
