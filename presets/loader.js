/* =========================================================
   Hazama FM — Presets Loader
   Loads sibling-repo JSON exports (chill / drum-floor / namima)
   for genre-flavor.js to consume. Schema in presets/SCHEMA.md.

   Usage:
     await window.HazamaPresets.load("chill-piano-recipe");
     const recipe = window.HazamaPresets.get("chill-piano-recipe");
     if (window.HazamaPresets.available("drum-frames-funk")) { ... }

   Graceful: never throws. Falls back to null on missing/invalid.
========================================================= */

(function () {
  "use strict";

  if (typeof window === "undefined") return;
  if (window.HazamaPresets) return;

  const PRESET_FILES = {
    "chill-piano-recipe": "presets/chill-piano-recipe.json",
    "drum-frames-funk": "presets/drum-frames-funk.json",
    "drum-frames-techno": "presets/drum-frames-techno.json",
    "drum-frames-jazz": "presets/drum-frames-jazz.json",
    "drum-frames-lofi": "presets/drum-frames-lofi.json",
    "namima-shape-ambient": "presets/namima-shape-ambient.json"
  };

  const EXPECTED_FORMATS = {
    "chill-piano-recipe": "chill-piano-recipe",
    "drum-frames-funk": "drum-frames",
    "drum-frames-techno": "drum-frames",
    "drum-frames-jazz": "drum-frames",
    "drum-frames-lofi": "drum-frames",
    "namima-shape-ambient": "namima-ambient-tone-js"
  };

  const cache = Object.create(null);
  const inflight = Object.create(null);

  function logWarn(name, reason, detail) {
    console.warn(`[Hazama Presets] ${name}: ${reason}`, detail || "");
  }

  function validate(name, data) {
    if (!data || typeof data !== "object") return false;
    const expected = EXPECTED_FORMATS[name];
    if (expected && data.format !== expected) {
      logWarn(name, `format mismatch (expected "${expected}", got "${data.format}")`);
      return false;
    }
    if (typeof data.version !== "number") {
      logWarn(name, "missing or non-numeric version");
      return false;
    }
    if (data.version > 1) {
      logWarn(name, `unknown major version ${data.version}, treating as null`);
      return false;
    }
    return true;
  }

  async function load(name) {
    if (!PRESET_FILES[name]) {
      logWarn(name, "unknown preset name");
      return null;
    }
    if (cache[name] !== undefined) return cache[name];
    if (inflight[name]) return inflight[name];

    const url = PRESET_FILES[name];
    inflight[name] = (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          // 404 is expected before codex emits the file — silent on first miss.
          if (res.status !== 404) {
            logWarn(name, `fetch ${res.status}`);
          }
          cache[name] = null;
          return null;
        }
        const data = await res.json();
        if (!validate(name, data)) {
          cache[name] = null;
          return null;
        }
        cache[name] = data;
        return data;
      } catch (err) {
        logWarn(name, "fetch/parse error", err);
        cache[name] = null;
        return null;
      } finally {
        delete inflight[name];
      }
    })();
    return inflight[name];
  }

  function get(name) {
    return cache[name] ?? null;
  }

  function available(name) {
    return cache[name] != null;
  }

  async function loadAll() {
    return Promise.all(Object.keys(PRESET_FILES).map(load));
  }

  window.HazamaPresets = {
    load,
    loadAll,
    get,
    available,
    files: { ...PRESET_FILES }
  };
})();
