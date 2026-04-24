/**
 * Music → namima AudioEngine bridge adapter.
 * Delegates to window.AudioEngine when present and tolerates missing methods.
 * Phase1: if window.AudioEngine is not loaded/available, all calls are safe no-op.
 */
(function () {
  const STORAGE = {
    started: false,
    lastStyle: null,
    lastStyleEnergy: null,
    styleByEnergy: {
      ambient: 0.18,
      lofi: 0.36,
      dub: 0.45,
      jazz: 0.5,
      techno: 0.78,
      trance: 0.96
    }
  };

  function getAudioEngine() {
    return window && window.AudioEngine ? window.AudioEngine : null;
  }

  function normalizeEnergy(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null;
    }

    let energy = value;
    if (energy > 1.5) {
      energy = energy / 100;
    }
    return Math.max(0, Math.min(1, energy));
  }

  function normalizeStyle(styleOrRatio) {
    if (typeof styleOrRatio === "number") return normalizeEnergy(styleOrRatio);
    if (typeof styleOrRatio !== "string") return null;

    const key = styleOrRatio.toLowerCase();
    if (key in STORAGE.styleByEnergy) return STORAGE.styleByEnergy[key];

    const trimmed = key.trim();
    if (trimmed in STORAGE.styleByEnergy) return STORAGE.styleByEnergy[trimmed];
    return null;
  }

  function withAudioEngine(method, ...args) {
    const engine = getAudioEngine();
    if (!engine || typeof engine[method] !== "function") return undefined;

    try {
      const result = engine[method](...args);
      if (result && typeof result.catch === "function") {
        return result.catch((error) => {
          console.warn("[Music] namima audio adapter error:", error);
        });
      }
      return result;
    } catch (error) {
      console.warn("[Music] namima audio adapter error:", error);
      return undefined;
    }
  }

  async function start() {
    if (STORAGE.started) return true;
    const engine = getAudioEngine();
    if (!engine) {
      console.warn("[Music] Phase1 no-op: window.AudioEngine is not available.");
      return false;
    }

    if (engine.started) {
      STORAGE.started = true;
      return true;
    }

    if (typeof engine.start !== "function") {
      console.warn("[Music] Phase1 no-op: window.AudioEngine.start is not available.");
      return false;
    }

    try {
      const maybePromise = engine.start();
      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise.catch((error) => {
          throw error;
        });
      }
      STORAGE.started = true;
      return true;
    } catch (error) {
      // Keep Music behavior intact; avoid throwing into host engine.
      console.warn("[Music] namima audio adapter start failed:", error);
      return false;
    }
  }

  function stop() {
    const result = withAudioEngine("stop");
    STORAGE.started = false;
    return result;
  }

  function updateEnergy(v) {
    const energy = normalizeEnergy(v);
    if (energy == null) return false;

    return !!withAudioEngine("updateEnergy", energy);
  }

  function updateStyle(styleOrRatio) {
    STORAGE.lastStyle = styleOrRatio;
    const mapped = normalizeStyle(styleOrRatio);
    if (mapped == null) {
      STORAGE.lastStyleEnergy = null;
      return false;
    }
    STORAGE.lastStyleEnergy = mapped;
    return true;
  }

  function onTap(xNorm = 0, intensity = 0.6) {
    const result = withAudioEngine("onTap", xNorm, intensity);
    if (result === undefined) {
      return false;
    }
    return true;
  }

  window.MusicNamimaAudioAdapter = {
    start,
    stop,
    updateEnergy,
    updateStyle,
    onTap
  };
})();
