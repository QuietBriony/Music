// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v28';
const SHELL = ['./lyric-notes.mjs?v=28', './songs/learning-provenance.json', './sanshin-core.mjs?v=28', './sanshin-view.mjs?v=28', './sanshin-guide.mjs?v=28', './sanshin.css?v=28', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=28', './presets.css?v=28', './app.mjs?v=28', './instrument-voice.mjs?v=28', './music.mjs?v=28', './midi.mjs?v=28', './chords.mjs?v=28', './scores.mjs?v=28', './singalong.mjs?v=28', './singalong-courses.mjs?v=28', './jigsaw-cues.mjs?v=28', './hand-guide.mjs?v=28', './hand-guide-core.mjs?v=28', './hand-guide.css?v=28', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=28', './singalong-core.mjs?v=28', './youtube.mjs?v=28', './singalong.css?v=28', './songs/singalong-provenance.json', './progress.mjs?v=28', './polyphonic.mjs?v=28', './lyrics.mjs?v=28', './lyric-presets.mjs?v=28', './session.css?v=28', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=28', './learning.mjs?v=28', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=28','./video-lyrics.mjs?v=28','./score-lyrics.mjs?v=28','./score-strip.mjs?v=28','./mic-input.mjs?v=28','./guitar-playlist.mjs?v=28','./guitar-playlist.css?v=28','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=28','./songs/sanshin-playlist.json','./tablet.css?v=28','./full-score.mjs?v=28','./full-score.css?v=28');
SHELL.push('./chord-guide.mjs?v=28','./chord-guide.css?v=28');
SHELL.push('./harmony-timeline.mjs?v=28','./estimated-courses.mjs?v=28','./auto-follow.css?v=28','./songs/auto-follow-provenance.json');
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
