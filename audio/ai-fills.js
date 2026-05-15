/* =========================================================
   Hazama FM — Magenta DrumsRNN AI fills (fm-71)
   Ports the v134 band-room.js Magenta integration into a
   self-contained, lazy-loaded module for FM mode.

   Design rules:
   - Magenta is NEVER preloaded on page load. The two CDN
     scripts (@magenta/music core.js + music_rnn.js, ~5 MB)
     are appended to <head> only when the user clicks the
     AI fill button.
   - The fill is a *burst* — for N bars the engine consults
     window.FmAiFill.shouldFire(role, step) instead of the
     mode's fixed kick/hat pattern. After the burst window
     expires the engine reverts to normal scheduling
     automatically; no permanent state change.
   - If FM is currently in pure-ambient mode (kickPattern is
     all dots, no rhythm to seed), the fill is refused and a
     "no rhythm to fill" message is surfaced.

   Public API: window.FmAiFill
     ensureLoaded()         — lazy-load Magenta + warm checkpoint
     startBurst(bars)       — fire a burst for the next N bars
     stopBurst()            — early cancel
     shouldFire(role, step) — consulted from scheduleStep /
                              the lofi/jazz Tone.Player layers
                              instead of patternAt for the
                              burst window
     status                 — { ready, loading, active, etc }
   ========================================================= */

(function () {
  "use strict";

  if (typeof window === "undefined") return;
  if (window.FmAiFill) return;

  // ---- Magenta drumkit pitch ↔ FM role mapping ---------------
  // Magenta DrumsRNN emits the standard 9-class drum kit:
  //   36 kick, 38 snare, 42 closedHat, 46 openHat,
  //   43 lowTom, 47 midTom, 50 hiTom, 49 crash, 51 ride.
  // FM mode only exposes kick / hat / snare voices in the
  // scheduler hot path, so toms/crash/ride collapse into the
  // closest existing voice. Anything else is dropped.
  const MAGENTA_PITCH_TO_FM = {
    36: "kick",
    38: "snare",
    42: "hat",   46: "hat",
    43: "hat",   47: "hat",   50: "hat",   // toms → ghost hat
    49: "hat",   51: "hat"                  // crash/ride → bright hat accent
  };
  const FM_TO_MAGENTA_PITCH = {
    kick: 36, snare: 38, hat: 42
  };

  // CDN URLs — pinned to v134 band-room versions so the cache
  // entry can be shared between the two pages.
  const MAGENTA_CORE_URL =
    "https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js";
  const MAGENTA_RNN_URL =
    "https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/music_rnn.js";
  const DRUMSRNN_CHECKPOINT =
    "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn";

  const DEFAULT_BURST_BARS = 4;
  const DEFAULT_TEMPERATURE = 1.05;

  // Burst event lookup: stepKey "kick:5" → velocity (0..1).
  const state = {
    loading: false,
    ready: false,
    rnn: null,
    active: false,
    burstSteps: 0,           // total steps for the current burst
    burstRemaining: 0,       // steps left in current burst
    events: new Map(),       // stepKey → velocity
    statusEl: null,
    onStatusChange: null,
    lastError: null
  };

  function setStatus(text, kind) {
    if (state.statusEl) state.statusEl.textContent = text || "";
    if (typeof state.onStatusChange === "function") {
      try { state.onStatusChange(text || "", kind || "info"); } catch (e) {}
    }
  }

  // ---- CDN loader (lazy) -------------------------------------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Already injected?
      const existing = document.querySelector(`script[data-fm-ai-cdn="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "1") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("script load failed: " + src)));
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.dataset.fmAiCdn = src;
      el.addEventListener("load", () => {
        el.dataset.loaded = "1";
        resolve();
      });
      el.addEventListener("error", () => reject(new Error("script load failed: " + src)));
      document.head.appendChild(el);
    });
  }

  async function ensureLoaded() {
    if (state.ready) return state.rnn;
    if (state.loading) {
      // Wait for in-flight load.
      while (state.loading) await new Promise((r) => setTimeout(r, 100));
      return state.rnn;
    }
    state.loading = true;
    setStatus("loading Magenta… (~5 MB)", "loading");
    try {
      // core.js exposes window.mm (the Magenta namespace).
      await loadScript(MAGENTA_CORE_URL);
      await loadScript(MAGENTA_RNN_URL);
      if (typeof window.mm === "undefined") {
        throw new Error("@magenta/music did not expose window.mm");
      }
      setStatus("warming DrumsRNN checkpoint…", "loading");
      state.rnn = new window.mm.MusicRNN(DRUMSRNN_CHECKPOINT);
      await state.rnn.initialize();
      state.ready = true;
      state.loading = false;
      setStatus("AI fill ready", "ready");
      return state.rnn;
    } catch (e) {
      state.loading = false;
      state.lastError = e;
      console.warn("[Hazama FM] Magenta load failed:", e);
      setStatus("AI load failed: " + (e.message || e), "error");
      return null;
    }
  }

  // ---- Pattern → NoteSequence seed ---------------------------
  // FM doesn't carry an explicit snare pattern (snare lives in
  // the lofi/jazz Tone.Player layers as 2-and-4 backbeats), so
  // we synthesize a "kick-on-1-3 + snare-on-2-4" baseline if
  // the kickPattern is too sparse to seed the RNN. The model
  // wants at least a few notes to continue from.
  function patternToSteps(pattern, stepCount) {
    const steps = [];
    if (!pattern || pattern.length === 0) return steps;
    for (let i = 0; i < stepCount; i++) {
      const ch = pattern[i % pattern.length];
      if (ch === "x" || ch === "X" || ch === "o") steps.push(i);
    }
    return steps;
  }

  function buildSeed(engineParams) {
    if (typeof window.mm === "undefined") return null;
    const stepCount = Math.max(8, engineParams.stepCount || 16);
    // Magenta wants 16 steps per bar (quarter * 4 sub).
    const seedSteps = Math.min(16, stepCount);
    const notes = [];
    const pushNote = (pitch, step, vel) => {
      if (step < 0 || step >= seedSteps) return;
      notes.push({
        pitch,
        quantizedStartStep: step,
        quantizedEndStep: step + 1,
        isDrum: true,
        velocity: Math.max(20, Math.min(127, Math.round(vel * 127)))
      });
    };
    const kickHits = patternToSteps(engineParams.kickPattern, seedSteps);
    const hatHits = patternToSteps(engineParams.hatPattern, seedSteps);
    kickHits.forEach((s) => pushNote(36, s, 0.85));
    hatHits.forEach((s) => pushNote(42, s, 0.55));
    // Synthesize backbeat snare on 2 / 4 (steps 4, 12 in a 16-step bar).
    // This gives the RNN a recognizable groove to continue.
    [4, 12].forEach((s) => {
      if (s < seedSteps) pushNote(38, s, 0.78);
    });
    return new window.mm.NoteSequence({
      notes,
      totalQuantizedSteps: seedSteps,
      quantizationInfo: { stepsPerQuarter: 4 }
    });
  }

  function continuationToEventMap(ns, totalSteps) {
    const events = new Map();
    if (!ns || !Array.isArray(ns.notes)) return events;
    ns.notes.forEach((n) => {
      const role = MAGENTA_PITCH_TO_FM[n.pitch];
      if (!role) return;
      const step = (n.quantizedStartStep || 0) % totalSteps;
      const vel = Math.min(1, Math.max(0.1, (n.velocity || 80) / 127));
      const key = role + ":" + step;
      // Keep the loudest hit per (role, step).
      const existing = events.get(key);
      if (existing == null || vel > existing) events.set(key, vel);
    });
    return events;
  }

  // ---- Burst lifecycle ---------------------------------------
  function hasRhythmToSeed() {
    const ep = window.EngineParams || null;
    if (!ep) return false;
    const kickHits = patternToSteps(ep.kickPattern, ep.stepCount || 16).length;
    const hatHits = patternToSteps(ep.hatPattern, ep.stepCount || 16).length;
    // Pure ambient ("................" kick + sparse hat) → refuse.
    return (kickHits + hatHits) >= 3;
  }

  async function startBurst(bars) {
    const barsRequested = Math.max(2, Math.min(8, bars || DEFAULT_BURST_BARS));
    const ep = window.EngineParams || null;
    if (!ep) {
      setStatus("engine not ready", "error");
      return false;
    }
    if (!hasRhythmToSeed()) {
      setStatus("no rhythm to fill — pick a non-ambient genre first", "error");
      return false;
    }
    const rnn = await ensureLoaded();
    if (!rnn) return false;
    setStatus("generating AI fill…", "loading");
    try {
      const seed = buildSeed(ep);
      // Each bar = 16 steps in DrumsRNN units. Generate enough
      // to cover the requested burst.
      const totalSteps = barsRequested * 16;
      const continuation = await rnn.continueSequence(
        seed,
        totalSteps,
        DEFAULT_TEMPERATURE
      );
      const events = continuationToEventMap(continuation, totalSteps);
      if (events.size === 0) {
        setStatus("AI returned empty — try again", "error");
        return false;
      }
      // FM's scheduleStep advances in engine steps (stepCount /
      // bar, typically 8 or 16). Convert the burst length to
      // *engine steps* so the modulo math in shouldFire lines up.
      const enginePerMagenta = (ep.stepCount || 16) / 16;
      state.events = events;
      state.burstSteps = Math.round(totalSteps * enginePerMagenta);
      state.burstRemaining = state.burstSteps;
      state.active = true;
      setStatus(
        `AI fill firing (${barsRequested} bars, ${events.size} hits)`,
        "active"
      );
      return true;
    } catch (e) {
      console.warn("[Hazama FM] AI fill generation failed:", e);
      setStatus("AI fill failed: " + (e.message || e), "error");
      return false;
    }
  }

  function stopBurst() {
    if (!state.active) return;
    state.active = false;
    state.burstRemaining = 0;
    state.events.clear();
    setStatus("AI fill ended", "ready");
  }

  // Consulted from scheduleStep. Returns:
  //   null  → fall back to mode pattern (default scheduling)
  //   { fire: bool, velocity: number } → override
  // The engine calls this once per (role, step). We piggyback
  // on the call to tick the burst countdown for the kick role
  // (kick is queried every engine step regardless of pattern).
  //
  // engineSteps → Magenta steps: Magenta always operates at 16
  // steps per bar; FM's stepCount may be 8 or 16. We map every
  // engine step to one *or more* Magenta steps and OR the hit
  // bits, so a sparse engine grid still sees every AI hit (just
  // collapsed in time onto the nearest engine step).
  function shouldFire(role, step) {
    if (!state.active) return null;
    const ep = window.EngineParams || null;
    if (!ep) return null;
    const stepCount = ep.stepCount || 16;
    const magentaPerEngine = Math.max(1, Math.round(16 / stepCount));
    const cursor = state.burstSteps - state.burstRemaining;
    // total Magenta-step length of the burst (must match buildSeed totalSteps)
    const burstMagenta = state.burstSteps * magentaPerEngine;
    let bestVel = null;
    for (let m = 0; m < magentaPerEngine; m++) {
      const magentaStep = (cursor * magentaPerEngine + m) % burstMagenta;
      const vel = state.events.get(role + ":" + magentaStep);
      if (vel != null && (bestVel == null || vel > bestVel)) bestVel = vel;
    }
    // Tick countdown once per engine step on the kick query.
    // (kick is consulted every step regardless of pattern.)
    if (role === "kick") {
      state.burstRemaining--;
      if (state.burstRemaining <= 0) stopBurst();
    }
    if (bestVel == null) return { fire: false, velocity: 0 };
    return { fire: true, velocity: bestVel };
  }

  // ---- Public API --------------------------------------------
  window.FmAiFill = {
    ensureLoaded,
    startBurst,
    stopBurst,
    shouldFire,
    bindStatusElement(el) { state.statusEl = el; },
    onStatusChange(fn) { state.onStatusChange = fn; },
    get status() {
      return {
        ready: state.ready,
        loading: state.loading,
        active: state.active,
        burstRemaining: state.burstRemaining,
        hits: state.events.size,
        lastError: state.lastError ? String(state.lastError.message || state.lastError) : null
      };
    }
  };
})();
