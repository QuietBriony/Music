// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v22';
const SHELL = ['./lyric-notes.mjs?v=22', './songs/learning-provenance.json', './sanshin-core.mjs?v=22', './sanshin-view.mjs?v=22', './sanshin-guide.mjs?v=22', './sanshin.css?v=22', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=22', './presets.css?v=22', './app.mjs?v=22', './instrument-voice.mjs?v=22', './music.mjs?v=22', './midi.mjs?v=22', './chords.mjs?v=22', './scores.mjs?v=22', './singalong.mjs?v=22', './singalong-courses.mjs?v=22', './jigsaw-cues.mjs?v=22', './hand-guide.mjs?v=22', './hand-guide-core.mjs?v=22', './hand-guide.css?v=22', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=22', './singalong-core.mjs?v=22', './youtube.mjs?v=22', './singalong.css?v=22', './songs/singalong-provenance.json', './progress.mjs?v=22', './polyphonic.mjs?v=22', './lyrics.mjs?v=22', './lyric-presets.mjs?v=22', './session.css?v=22', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=22', './learning.mjs?v=22', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./score-lyrics.mjs?v=22','./score-strip.mjs?v=22','./mic-input.mjs?v=22','./guitar-playlist.mjs?v=22','./guitar-playlist.css?v=22','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=22','./songs/sanshin-playlist.json','./tablet.css?v=22','./full-score.mjs?v=22','./full-score.css?v=22');
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
