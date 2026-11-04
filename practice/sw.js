// Deliberately scoped to /practice/. Never changes the root Music PWA cache.
const CACHE = 'music-practice-v29';
const SHELL = ['./lyric-notes.mjs?v=29', './songs/learning-provenance.json', './sanshin-core.mjs?v=29', './sanshin-view.mjs?v=29', './sanshin-guide.mjs?v=29', './sanshin.css?v=29', './songs/sanshin-provenance.json', './songs/tinsagu.mid', './', './index.html', './style.css?v=29', './presets.css?v=29', './app.mjs?v=29', './instrument-voice.mjs?v=29', './music.mjs?v=29', './midi.mjs?v=29', './chords.mjs?v=29', './scores.mjs?v=29', './singalong.mjs?v=29', './singalong-courses.mjs?v=29', './jigsaw-cues.mjs?v=29', './hand-guide.mjs?v=29', './hand-guide-core.mjs?v=29', './hand-guide.css?v=29', './songs/hand-guide-provenance.json', './songs/jigsaw-study.json', './video-cues.mjs?v=29', './singalong-core.mjs?v=29', './youtube.mjs?v=29', './singalong.css?v=29', './songs/singalong-provenance.json', './progress.mjs?v=29', './polyphonic.mjs?v=29', './lyrics.mjs?v=29', './lyric-presets.mjs?v=29', './session.css?v=29', './songs/lyrics-provenance.json', './songs/tokiyo-study.json', './tuner.mjs?v=29', './learning.mjs?v=29', './songs/amazing-grace.mid', './songs/twinkle.mid', './songs/ode-to-joy.mid', './songs/provenance.json', './manifest.webmanifest', './icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/apple-touch-icon.png'];
SHELL.push('./song-support.mjs?v=29','./video-lyrics.mjs?v=29','./score-lyrics.mjs?v=29','./score-strip.mjs?v=29','./mic-input.mjs?v=29','./guitar-playlist.mjs?v=29','./guitar-playlist.css?v=29','./songs/guitar-playlist.json','./sanshin-playlist.mjs?v=29','./songs/sanshin-playlist.json','./tablet.css?v=29','./full-score.mjs?v=29','./full-score.css?v=29');
SHELL.push('./chord-guide.mjs?v=29','./chord-guide.css?v=29');
SHELL.push('./harmony-timeline.mjs?v=29','./estimated-courses.mjs?v=29','./auto-follow.css?v=29','./songs/auto-follow-provenance.json');
SHELL.push('./app-shell.mjs?v=29','./app-shell.css?v=29');
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
