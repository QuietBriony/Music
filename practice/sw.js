// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v26';
const SHELL = ['./lyric-notes.mjs?v=26', './songs/learning-provenance.json', './sanshin-core.mjs?v=26', './sanshin-view.mjs?v=26', './sanshin-guide.mjs?v=26', './sanshin.css?v=26', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=26', './presets.css?v=26', './app.mjs?v=26', './instrument-voice.mjs?v=26', './music.mjs?v=26', './midi.mjs?v=26', './chords.mjs?v=26', './scores.mjs?v=26', './singalong.mjs?v=26', './singalong-courses.mjs?v=26', './jigsaw-cues.mjs?v=26', './hand-guide.mjs?v=26', './hand-guide-core.mjs?v=26', './hand-guide.css?v=26', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=26', './singalong-core.mjs?v=26', './youtube.mjs?v=26', './singalong.css?v=26', './songs/singalong-provenance.json', './progress.mjs?v=26', './polyphonic.mjs?v=26', './lyrics.mjs?v=26', './lyric-presets.mjs?v=26', './session.css?v=26', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=26', './learning.mjs?v=26', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=26','./video-lyrics.mjs?v=26','./score-lyrics.mjs?v=26','./score-strip.mjs?v=26','./mic-input.mjs?v=26','./guitar-playlist.mjs?v=26','./guitar-playlist.css?v=26','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=26','./songs/sanshin-playlist.json','./tablet.css?v=26','./full-score.mjs?v=26','./full-score.css?v=26');
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
