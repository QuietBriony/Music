// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v24';
const SHELL = ['./lyric-notes.mjs?v=24', './songs/learning-provenance.json', './sanshin-core.mjs?v=24', './sanshin-view.mjs?v=24', './sanshin-guide.mjs?v=24', './sanshin.css?v=24', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=24', './presets.css?v=24', './app.mjs?v=24', './instrument-voice.mjs?v=24', './music.mjs?v=24', './midi.mjs?v=24', './chords.mjs?v=24', './scores.mjs?v=24', './singalong.mjs?v=24', './singalong-courses.mjs?v=24', './jigsaw-cues.mjs?v=24', './hand-guide.mjs?v=24', './hand-guide-core.mjs?v=24', './hand-guide.css?v=24', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=24', './singalong-core.mjs?v=24', './youtube.mjs?v=24', './singalong.css?v=24', './songs/singalong-provenance.json', './progress.mjs?v=24', './polyphonic.mjs?v=24', './lyrics.mjs?v=24', './lyric-presets.mjs?v=24', './session.css?v=24', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=24', './learning.mjs?v=24', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=24','./video-lyrics.mjs?v=24','./score-lyrics.mjs?v=24','./score-strip.mjs?v=24','./mic-input.mjs?v=24','./guitar-playlist.mjs?v=24','./guitar-playlist.css?v=24','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=24','./songs/sanshin-playlist.json','./tablet.css?v=24','./full-score.mjs?v=24','./full-score.css?v=24');
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
