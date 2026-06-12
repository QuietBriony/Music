/* =========================================================
   Hazama FM — Service Worker
   - Precaches the FM-mode shell (fm.html + scripts + icons).
   - Network-first for the HTML so deploys propagate quickly.
   - Cache-first for static assets (CSS/JS/SVG/PNG).
   - Stale-while-revalidate for presets JSON.
   - Bypasses Range requests (audio streams) and non-GET.
========================================================= */

const VERSION = "hazama-fm-v337";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// Files we need available offline. Keep tight — engine.js is large but
// the whole point is offline focus listening.
const PRECACHE_URLS = [
  "fm.html",
  "index.html",
  "listen.html",
  "band-room.html",
  "band-room.css?v=br-84",
  "band-room.js?v=br-203",
  "presets/drum-frames-tabasco-human-fly.json",
  "presets/drum-frames-tabasco-tabasco.json",
  "presets/drum-frames-tabasco-hey.json",
  "presets/drum-frames-tabasco-i-got-a-feeling.json",
  "presets/drum-frames-tabasco-under-the-moon.json",
  "presets/drum-frames-tabasco-electric-sheep.json",
  "presets/drum-frames-tabasco-sister.json",
  "presets/tabasco-songs.json",
  "presets/bands.json",
  "presets/online-samples-catalog.json",
  "presets/tabasco-stems/human-fly/vocals.mp3",
  "presets/tabasco-stems/human-fly/drums.mp3",
  "presets/tabasco-stems/human-fly/bass.mp3",
  "presets/tabasco-stems/human-fly/other.mp3",
  "docs/tabasco-lyrics-draft.md",
  "docs/tabasco-lyrics-burroughs.md",
  "docs/tabasco-lyrics-final.md",
  "docs/BAND-ROOM-MANUAL.md",
  "docs/BAND-ROOM-CHANGELOG.md",
  "docs/BAND-ROOM-USAGE.md",
  "docs/AI-RECREATION-EXPORT.md",
  "docs/SAMPLE-CATALOG-GUIDE.md",
  "docs/DAW-INTEGRATION.md",
  "docs/FREE-SAMPLES-AND-SYNTHESIS.md",
  "docs/REPO-MANAGEMENT.md",
  "docs/CROSS-APP-INTEGRITY.md",
  "docs/PRODUCTION-PATH.md",
  "docs/tabasco-lyrics-v4-syllabic.md",
  "docs/SUNO-WORKFLOW.md",
  "docs/RECORDING-WORKFLOW.md",
  "docs/RHYTHM-RESEARCH.md",
  "docs/runtime-browser-listening-checklist.md",
  "docs/listening-feedback-backlog.md",
  "docs/USER-NOTES-MEMO.md",
  "docs/CODEX-HANDOFF.md",
  "fm.css?v=fm-53",
  "fm.js?v=fm-70",
  "style.css?v=fm-28",
  "audio/music-stack-routing.js?v=fm-118",
  "audio/music-focus-modulation.js?v=fm-118",
  "audio/music-recorder.js?v=fm-118",
  "audio/music-packet.js?v=fm-118",
  "audio/music-hazama-feedback.js?v=fm-118",
  "engine.js?v=fm-118",
  "docs/music-stack-human-review-queue.html",
  "audio/namima-audio-adapter.js?v=fm-66",
  "audio/audio-safety.js?v=fm-61",
  "audio/audio-safety.js?v=br-67",
  "audio/human-groove-governor.js",
  "audio/genre-flavor.js?v=fm-75",
  "audio/ai-fills.js?v=fm-71",
  "presets/loader.js?v=fm-18",
  "presets/SCHEMA.md",
  "presets/chill-piano-recipe.json",
  "presets/drum-frames-funk.json",
  "presets/drum-frames-techno.json",
  "presets/drum-frames-jazz.json",
  "presets/drum-frames-lofi.json",
  "presets/namima-shape-ambient.json",
  "presets/drum-patterns-genres/boom-bap.json",
  "presets/drum-patterns-genres/four-on-floor.json",
  "presets/drum-patterns-genres/jazz-brush.json",
  "presets/drum-patterns-genres/dnb.json",
  "presets/drum-patterns-genres/afro-cuban.json",
  "presets/drum-patterns-genres/reggaeton.json",
  "presets/drum-patterns-genres/breakbeat.json",
  "presets/drum-patterns-genres/trap.json",
  "presets/drum-patterns-genres/soul-funk.json",
  "presets/drum-patterns-genres/README.md",
  "references/hazama-fm-pill-refs.json",
  "references/apple-music-refs.json",
  "references/style-archetype-from-test.json",
  "manifest.webmanifest",
  "manifest-mixer.webmanifest",
  "manifest-band-room.webmanifest",
  "manifest-band-room.webmanifest?v=br-icon-1",
  "icons/icon-96.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png",
  "icons/band-room-96.png",
  "icons/band-room-192.png",
  "icons/band-room-512.png",
  "icons/band-room-512-maskable.png",
  "icons/band-room-apple-touch-icon.png",
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

function isDocRequest(url) {
  return url.origin === self.location.origin &&
         url.pathname.includes("/docs/") &&
         /\.(?:md|json|html)$/.test(url.pathname);
}

function matchCachedRequest(request, options = {}) {
  return caches.match(request).then((cached) => {
    if (cached || !options.ignoreSearch) return cached;
    return caches.match(request, { ignoreSearch: true });
  });
}

function isToneCdn(url) {
  return url.hostname === "unpkg.com" && url.pathname.includes("/tone");
}

// fm-71: Magenta DrumsRNN runtime cache.
//   - cdn.jsdelivr.net hosts @magenta/music core.js + music_rnn.js (~2 MB)
//   - storage.googleapis.com/magentadata/.../drum_kit_rnn hosts the
//     checkpoint shards (weights_manifest.json + group1-shard*.bin, ~3 MB)
// Both are large, immutable per pinned version, and fetched only when
// the user clicks 🎲 AI fill — so cache-first with opaque cache is
// the right shape: first-click pays the cost, subsequent clicks are
// instant + offline-capable.
function isMagentaCdn(url) {
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("@magenta/music")) return true;
  if (url.hostname === "storage.googleapis.com" && url.pathname.includes("magentadata")) return true;
  return false;
}

// v230: online sample CDNs for AI 再現's real instruments + drum kits.
//   - tonejs.github.io/audio hosts the Tone.js demo drum samples + the
//     Salamander piano / Casio sample sets
//   - cdn.jsdelivr.net/gh/tidalcycles/dirt-samples hosts the dirt drum kits
//   - cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments hosts the guitar /
//     bass / strings / flute samplers — including AI 再現's DEFAULT guitar
//     (guitar-electric) and bass (bass-electric)
// These are pulled from online-samples-catalog.json on demand. Before v230
// the SW never cached them, so the AI band's real guitar + bass were dead
// offline — even though the app's whole point is offline focus listening.
// Cache-first with opaque cache (same shape as Tone/Magenta above): the
// first online play pays the download, every later play — including
// offline — is instant.
function isSampleCdn(url) {
  if (url.hostname === "tonejs.github.io" && url.pathname.includes("/audio/")) return true;
  if (url.hostname === "cdn.jsdelivr.net" &&
      (url.pathname.includes("/tidalcycles/dirt-samples") ||
       url.pathname.includes("/nbrosowsky/tonejs-instruments"))) return true;
  return false;
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

  // fm-71: Magenta CDN + checkpoint shards — cache-first, opaque OK.
  if (isMagentaCdn(url)) {
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

  // v230: online sample CDNs (AI 再現 real instruments + drum kits) —
  // cache-first so the AI band survives offline after one online play.
  if (isSampleCdn(url)) {
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
      matchCachedRequest(request, { ignoreSearch: true }).then((cached) => {
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
      matchCachedRequest(request, { ignoreSearch: isDocRequest(url) }).then((cached) => {
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
