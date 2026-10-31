// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v27';
const SHELL = ['./lyric-notes.mjs?v=27', './songs/learning-provenance.json', './sanshin-core.mjs?v=27', './sanshin-view.mjs?v=27', './sanshin-guide.mjs?v=27', './sanshin.css?v=27', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=27', './presets.css?v=27', './app.mjs?v=27', './instrument-voice.mjs?v=27', './music.mjs?v=27', './midi.mjs?v=27', './chords.mjs?v=27', './scores.mjs?v=27', './singalong.mjs?v=27', './singalong-courses.mjs?v=27', './jigsaw-cues.mjs?v=27', './hand-guide.mjs?v=27', './hand-guide-core.mjs?v=27', './hand-guide.css?v=27', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=27', './singalong-core.mjs?v=27', './youtube.mjs?v=27', './singalong.css?v=27', './songs/singalong-provenance.json', './progress.mjs?v=27', './polyphonic.mjs?v=27', './lyrics.mjs?v=27', './lyric-presets.mjs?v=27', './session.css?v=27', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=27', './learning.mjs?v=27', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=27','./video-lyrics.mjs?v=27','./score-lyrics.mjs?v=27','./score-strip.mjs?v=27','./mic-input.mjs?v=27','./guitar-playlist.mjs?v=27','./guitar-playlist.css?v=27','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=27','./songs/sanshin-playlist.json','./tablet.css?v=27','./full-score.mjs?v=27','./full-score.css?v=27');
SHELL.push('./harmony-timeline.mjs?v=27','./estimated-courses.mjs?v=27','./auto-follow.css?v=27','./songs/auto-follow-provenance.json');
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
