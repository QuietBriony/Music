/* =========================================================
   Hazama FM — Service Worker
   - Precaches the FM-mode shell (fm.html + scripts + icons).
   - Network-first for the HTML so deploys propagate quickly.
   - Cache-first for static assets (CSS/JS/SVG/PNG).
   - Stale-while-revalidate for presets JSON.
   - Bypasses Range requests (audio streams) and non-GET.
========================================================= */

const VERSION = "hazama-fm-v93";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// Files we need available offline. Keep tight — engine.js is large but
// the whole point is offline focus listening.
const PRECACHE_URLS = [
  "fm.html",
  "index.html",
  "band-room.html",
  "band-room.css?v=br-38",
  "band-room.js?v=br-38",
  "presets/drum-frames-tabasco-human-fly.json",
  "presets/drum-frames-tabasco-tabasco.json",
  "presets/drum-frames-tabasco-hey.json",
  "presets/drum-frames-tabasco-i-got-a-feeling.json",
  "presets/drum-frames-tabasco-under-the-moon.json",
  "presets/drum-frames-tabasco-electric-sheep.json",
  "presets/drum-frames-tabasco-sister.json",
  "presets/tabasco-songs.json",
  "presets/bands.json",
  "presets/tabasco-stems/human-fly/vocals.mp3",
  "presets/tabasco-stems/human-fly/drums.mp3",
  "presets/tabasco-stems/human-fly/bass.mp3",
  "presets/tabasco-stems/human-fly/other.mp3",
  "docs/tabasco-lyrics-draft.md",
  "fm.css?v=fm-44",
  "fm.js?v=fm-53",
  "style.css?v=fm-26",
  "engine.js?v=fm-55",
  "docs/music-stack-human-review-queue.html",
  "audio/namima-audio-adapter.js",
  "audio/human-groove-governor.js",
  "audio/genre-flavor.js?v=fm-53",
  "presets/loader.js?v=fm-18",
  "presets/SCHEMA.md",
  "presets/chill-piano-recipe.json",
  "presets/drum-frames-funk.json",
  "presets/drum-frames-techno.json",
  "presets/drum-frames-jazz.json",
  "presets/drum-frames-lofi.json",
  "presets/namima-shape-ambient.json",
  "references/hazama-fm-pill-refs.json",
  "references/apple-music-refs.json",
  "manifest.webmanifest",
  "manifest-mixer.webmanifest",
  "icons/icon-96.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png",
  "icons/mixer-96.png",
  "icons/mixer-192.png",
  "icons/mixer-512.png",
  "icons/mixer-512-maskable.png",
  "icons/mixer-apple-touch-icon.png",
  "assets/background.svg",
  "assets/layer_01.svg",
  "assets/layer_02.svg",
  "assets/layer_03.svg",
  "assets/layer_04.svg",
  "assets/layer_05.svg",
  "assets/layer_06.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Use individual adds so one missing file doesn't fail the whole install.
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[Hazama FM SW] precache miss:", url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHtmlRequest(request) {
  return request.mode === "navigate" ||
         (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

function isPresetRequest(url) {
  return url.pathname.includes("/presets/") && url.pathname.endsWith(".json");
}

function isToneCdn(url) {
  return url.hostname === "unpkg.com" && url.pathname.includes("/tone");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Bypass non-GET and Range requests (e.g. partial audio streams).
  if (request.method !== "GET") return;
  if (request.headers.get("range")) return;

  const url = new URL(request.url);

  // HTML navigation: network-first so new deploys are picked up.
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("fm.html")))
    );
    return;
  }

  // Tone.js CDN: cache-first, opaque cache acceptable.
  if (isToneCdn(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
      )
    );
    return;
  }

  // Presets: stale-while-revalidate.
  if (isPresetRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Same-origin static assets: cache-first with background fill.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
