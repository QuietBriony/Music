// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v23';
const SHELL = ['./lyric-notes.mjs?v=23', './songs/learning-provenance.json', './sanshin-core.mjs?v=23', './sanshin-view.mjs?v=23', './sanshin-guide.mjs?v=23', './sanshin.css?v=23', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=23', './presets.css?v=23', './app.mjs?v=23', './instrument-voice.mjs?v=23', './music.mjs?v=23', './midi.mjs?v=23', './chords.mjs?v=23', './scores.mjs?v=23', './singalong.mjs?v=23', './singalong-courses.mjs?v=23', './jigsaw-cues.mjs?v=23', './hand-guide.mjs?v=23', './hand-guide-core.mjs?v=23', './hand-guide.css?v=23', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=23', './singalong-core.mjs?v=23', './youtube.mjs?v=23', './singalong.css?v=23', './songs/singalong-provenance.json', './progress.mjs?v=23', './polyphonic.mjs?v=23', './lyrics.mjs?v=23', './lyric-presets.mjs?v=23', './session.css?v=23', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=23', './learning.mjs?v=23', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=23','./video-lyrics.mjs?v=23','./score-lyrics.mjs?v=23','./score-strip.mjs?v=23','./mic-input.mjs?v=23','./guitar-playlist.mjs?v=23','./guitar-playlist.css?v=23','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=23','./songs/sanshin-playlist.json','./tablet.css?v=23','./full-score.mjs?v=23','./full-score.css?v=23');
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
