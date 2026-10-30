// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v17';
const SHELL = ['./lyric-notes.mjs?v=17', './songs/learning-provenance.json', './sanshin-core.mjs?v=17', './sanshin-view.mjs?v=17', './sanshin-guide.mjs?v=17', './sanshin.css?v=17', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=17', './presets.css?v=17', './app.mjs?v=17', './instrument-voice.mjs?v=17', './music.mjs?v=17', './midi.mjs?v=17', './chords.mjs?v=17', './scores.mjs?v=17', './singalong.mjs?v=17', './singalong-courses.mjs?v=17', './jigsaw-cues.mjs?v=17', './hand-guide.mjs?v=17', './hand-guide-core.mjs?v=17', './hand-guide.css?v=17', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=17', './singalong-core.mjs?v=17', './youtube.mjs?v=17', './singalong.css?v=17', './songs/singalong-provenance.json', './progress.mjs?v=17', './polyphonic.mjs?v=17', './lyrics.mjs?v=17', './lyric-presets.mjs?v=17', './session.css?v=17', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=17', './learning.mjs?v=17', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./sanshin-playlist.mjs?v=17','./songs/sanshin-playlist.json','./tablet.css?v=17','./full-score.mjs?v=17','./full-score.css?v=17');
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
