// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v20';
const SHELL = ['./lyric-notes.mjs?v=20', './songs/learning-provenance.json', './sanshin-core.mjs?v=20', './sanshin-view.mjs?v=20', './sanshin-guide.mjs?v=20', './sanshin.css?v=20', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=20', './presets.css?v=20', './app.mjs?v=20', './instrument-voice.mjs?v=20', './music.mjs?v=20', './midi.mjs?v=20', './chords.mjs?v=20', './scores.mjs?v=20', './singalong.mjs?v=20', './singalong-courses.mjs?v=20', './jigsaw-cues.mjs?v=20', './hand-guide.mjs?v=20', './hand-guide-core.mjs?v=20', './hand-guide.css?v=20', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=20', './singalong-core.mjs?v=20', './youtube.mjs?v=20', './singalong.css?v=20', './songs/singalong-provenance.json', './progress.mjs?v=20', './polyphonic.mjs?v=20', './lyrics.mjs?v=20', './lyric-presets.mjs?v=20', './session.css?v=20', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=20', './learning.mjs?v=20', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./mic-input.mjs?v=20','./guitar-playlist.mjs?v=20','./guitar-playlist.css?v=20','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=20','./songs/sanshin-playlist.json','./tablet.css?v=20','./full-score.mjs?v=20','./full-score.css?v=20');
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
