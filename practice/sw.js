// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v21';
const SHELL = ['./lyric-notes.mjs?v=21', './songs/learning-provenance.json', './sanshin-core.mjs?v=21', './sanshin-view.mjs?v=21', './sanshin-guide.mjs?v=21', './sanshin.css?v=21', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=21', './presets.css?v=21', './app.mjs?v=21', './instrument-voice.mjs?v=21', './music.mjs?v=21', './midi.mjs?v=21', './chords.mjs?v=21', './scores.mjs?v=21', './singalong.mjs?v=21', './singalong-courses.mjs?v=21', './jigsaw-cues.mjs?v=21', './hand-guide.mjs?v=21', './hand-guide-core.mjs?v=21', './hand-guide.css?v=21', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=21', './singalong-core.mjs?v=21', './youtube.mjs?v=21', './singalong.css?v=21', './songs/singalong-provenance.json', './progress.mjs?v=21', './polyphonic.mjs?v=21', './lyrics.mjs?v=21', './lyric-presets.mjs?v=21', './session.css?v=21', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=21', './learning.mjs?v=21', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./score-strip.mjs?v=21','./mic-input.mjs?v=21','./guitar-playlist.mjs?v=21','./guitar-playlist.css?v=21','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=21','./songs/sanshin-playlist.json','./tablet.css?v=21','./full-score.mjs?v=21','./full-score.css?v=21');
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
