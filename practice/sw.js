// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v30';
const SHELL = ['./lyric-notes.mjs?v=30', './songs/learning-provenance.json', './sanshin-core.mjs?v=30', './sanshin-view.mjs?v=30', './sanshin-guide.mjs?v=30', './sanshin.css?v=30', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=30', './presets.css?v=30', './app.mjs?v=30', './instrument-voice.mjs?v=30', './music.mjs?v=30', './midi.mjs?v=30', './chords.mjs?v=30', './scores.mjs?v=30', './singalong.mjs?v=30', './singalong-courses.mjs?v=30', './jigsaw-cues.mjs?v=30', './hand-guide.mjs?v=30', './hand-guide-core.mjs?v=30', './hand-guide.css?v=30', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=30', './singalong-core.mjs?v=30', './youtube.mjs?v=30', './singalong.css?v=30', './songs/singalong-provenance.json', './progress.mjs?v=30', './polyphonic.mjs?v=30', './lyrics.mjs?v=30', './lyric-presets.mjs?v=30', './session.css?v=30', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=30', './learning.mjs?v=30', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=30','./video-lyrics.mjs?v=30','./score-lyrics.mjs?v=30','./score-strip.mjs?v=30','./mic-input.mjs?v=30','./guitar-playlist.mjs?v=30','./guitar-playlist.css?v=30','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=30','./songs/sanshin-playlist.json','./tablet.css?v=30','./full-score.mjs?v=30','./full-score.css?v=30');
SHELL.push('./chord-guide.mjs?v=30','./chord-guide.css?v=30');
SHELL.push('./harmony-timeline.mjs?v=30','./estimated-courses.mjs?v=30','./auto-follow.css?v=30','./songs/auto-follow-provenance.json');
SHELL.push('./app-shell.mjs?v=30','./app-shell.css?v=30');
const URLS = new Set(SHELL.map(path => new URL(path, self.location.href).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('music-practice-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url); url.hash = '';
  if (event.request.method !== 'GET' || !URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request,{cache:'reload'});
      if (response.ok) await cache.put(url.href, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(url.href);
      if (cached) return cached;
      throw error;
    }
  })());
});
