/* =========================================================
   Hazama FM mode — single-button focus radio
   Wraps engine.js without modifying it.
   - START / STOP with soft fade in / out
   - Live program label from MusicRuntimeState.radioBrain
   - Resume hint from localStorage (30 min window)
   - iOS Safari gesture-tied audio start
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "music:fm:v1";
  const FADE_IN_S = 4;
  const FADE_OUT_S = 3;
  const RESUME_WINDOW_MS = 30 * 60 * 1000;
  const TARGET_LEVEL = 80;
  const ENERGY_VALUES = { low: 25, mid: 45, high: 70 };
  const FM_ACID_CUE_MIN_MS = 6200;
  const ACID_CUE_PROGRAMS = new Set(["hardTechno", "dryGridWork", "ghostPressure"]);

  // Genre profiles. Each profile sets all 9 UCM faders + the engine's culture
  // grammar. The MusicRadioBrain still picks programs on its own — we just
  // bias the underlying UCM state so the same brain produces a recognizably
  // different palette per genre.
  // Culture values match index.html option values (engine.js:1342 reads
  // #culture_grammar_select directly).
  const GENRE_PROFILES = {
    any: {
      culture: "auto",
      faders: { energy: 40, wave: 40, mind: 50, creation: 50, void: 20, circle: 60, body: 50, resource: 60, observer: 50 }
    },
    ambient: {
      bpm: 72,
      culture: "ambient_room",
      faders: { energy: 22, wave: 38, mind: 55, creation: 30, void: 65, circle: 72, body: 22, resource: 50, observer: 78 }
    },
    techno: {
      bpm: 132,
      culture: "acid_core",
      faders: { energy: 78, wave: 50, mind: 28, creation: 38, void: 8, circle: 32, body: 82, resource: 70, observer: 32 }
    },
    lofi: {
      bpm: 82,
      culture: "tape_memory",
      faders: { energy: 38, wave: 62, mind: 65, creation: 58, void: 28, circle: 64, body: 42, resource: 55, observer: 56 }
    },
    jazz: {
      bpm: 96,
      culture: "earth_reed",
      faders: { energy: 36, wave: 70, mind: 72, creation: 76, void: 18, circle: 70, body: 50, resource: 64, observer: 60 }
    },
    funk: {
      bpm: 108,
      culture: "broken_machine",
      faders: { energy: 64, wave: 56, mind: 44, creation: 70, void: 14, circle: 50, body: 76, resource: 68, observer: 44 }
    },
    piano: {
      bpm: 68,
      culture: "earth_reed",
      faders: { energy: 28, wave: 50, mind: 60, creation: 64, void: 32, circle: 72, body: 30, resource: 54, observer: 70 }
    }
  };

  let started = false;
  let starting = false;
  let stopping = false;
  let rampHandle = null;
  let previousRadioProgram = null;
  let identTimer = null;
  let programLabelTimer = null;
  let genreTempoTimer = null;
  let lastAcidCueAt = 0;
  let lastAcidCueKey = "";

  // ---- Helpers --------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function dispatchInput(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dispatchChange(el) {
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function triggerHazamaFmAcidCue(reason, amount, options = {}) {
    if (!options.force && (!started || starting || stopping)) return;
    const now = performance.now();
    const key = `${reason}:${getCurrentGenre()}`;
    if (!options.force && key === lastAcidCueKey && now - lastAcidCueAt < FM_ACID_CUE_MIN_MS) return;
    const api = window.MusicAcidCue;
    if (!api || typeof api.trigger !== "function") return;
    try {
      api.trigger({
        amount,
        source: `hazama-fm.${reason}`,
        force: options.force === true
      });
      lastAcidCueAt = now;
      lastAcidCueKey = key;
    } catch (err) {
      console.warn("[Hazama FM] acid cue failed:", err);
    }
  }

  function maybeTriggerProgramAcidCue(program) {
    if (!program || !ACID_CUE_PROGRAMS.has(program)) return;
    const genre = getCurrentGenre();
    if (program === "hardTechno") {
      triggerHazamaFmAcidCue(`program.${program}`, genre === "techno" ? 0.66 : 0.48);
      return;
    }
    if (genre === "techno") {
      triggerHazamaFmAcidCue(`program.${program}`, 0.52);
    }
  }

  function setButtonState(state) {
    const btn = $("fm_play");
    if (!btn) return;
    btn.dataset.state = state;
    if (state === "playing") {
      btn.textContent = "STOP";
      btn.setAttribute("aria-label", "Stop playback");
    } else if (state === "starting") {
      btn.textContent = "…";
      btn.setAttribute("aria-label", "Starting");
    } else if (state === "stopping") {
      btn.textContent = "…";
      btn.setAttribute("aria-label", "Stopping");
    } else {
      btn.textContent = "START";
      btn.setAttribute("aria-label", "Start playback");
    }
  }

  function rampOutputLevel(target, seconds) {
    const slider = $("output_level");
    if (!slider) return Promise.resolve();
    if (rampHandle) cancelAnimationFrame(rampHandle);

    const start = Number(slider.value) || 0;
    const t0 = performance.now();
    const duration = Math.max(50, seconds * 1000);

    return new Promise((resolve) => {
      function step(now) {
        const t = Math.min(1, (now - t0) / duration);
        const eased = t * (2 - t); // easeOutQuad — gentler at the top
        const v = Math.round(start + (target - start) * eased);
        slider.value = String(v);
        dispatchInput(slider);
        if (t < 1) {
          rampHandle = requestAnimationFrame(step);
        } else {
          rampHandle = null;
          resolve();
        }
      }
      rampHandle = requestAnimationFrame(step);
    });
  }

  function applyEnergyValue(name) {
    const slider = $("fader_energy");
    if (!slider) return;
    const v = ENERGY_VALUES[name];
    if (typeof v !== "number") return;
    slider.value = String(v);
    dispatchInput(slider);
  }

  function applyGenreTempo(profile, name) {
    if (!profile || typeof profile.bpm !== "number") return;
    const bpm = profile.bpm;
    try {
      if (typeof EngineParams !== "undefined") EngineParams.bpm = Math.round(bpm);
      if (typeof DJTempoState !== "undefined") {
        DJTempoState.targetBpm = bpm;
        DJTempoState.bpm = bpm;
        DJTempoState.motion = 0;
        DJTempoState.drift = 0;
      }
      if (typeof Tone !== "undefined" && Tone.Transport?.bpm) {
        Tone.Transport.bpm.rampTo(bpm, name === "piano" ? 0.9 : 0.65);
      }
    } catch (err) {
      console.warn("[Hazama FM] genre tempo apply failed:", err);
    }
  }

  function stopGenreTempoLock() {
    if (genreTempoTimer) {
      clearInterval(genreTempoTimer);
      genreTempoTimer = null;
    }
  }

  function startGenreTempoLock(profile, name) {
    stopGenreTempoLock();
    if (!profile || typeof profile.bpm !== "number" || name === "any") return;
    applyGenreTempo(profile, name);
    genreTempoTimer = setInterval(() => {
      if ((!started && !starting) || getCurrentGenre() !== name) {
        stopGenreTempoLock();
        return;
      }
      applyGenreTempo(profile, name);
    }, 900);
  }

  function applyGenreProfile(name) {
    const profile = GENRE_PROFILES[name];
    if (!profile) return;

    // For non-"any" genres, lock the genre identity by disabling AUTOMIX
    // (engine.js's UCM.auto.enabled). Otherwise the engine's sine-wave
    // modulation and director-scene bias overwrite our fader values every
    // 240ms (syncAutoSlidersFromCurrent at engine.js:6870). Radio-brain
    // program rotation is a separate system and keeps running.
    const autoToggle = $("auto_toggle");
    const wantsAuto = name === "any";
    if (autoToggle && autoToggle.checked !== wantsAuto) {
      autoToggle.checked = wantsAuto;
      dispatchChange(autoToggle);
    }

    // Write all 9 UCM faders. Dispatch each input event with a small spread
    // so the engine's 30 ms-throttled updateFromUI accepts each one and marks
    // manual influence on every key (engine.js:11690, 983).
    const keys = Object.keys(profile.faders);
    keys.forEach((key, i) => {
      const slider = $("fader_" + key);
      if (!slider) return;
      slider.value = String(profile.faders[key]);
      // Spacing 35 ms > 30 ms throttle window.
      setTimeout(() => dispatchInput(slider), i * 35);
    });

    // Re-apply ENERGY pill on top of the genre baseline so the user's energy
    // choice still wins for the energy fader.
    setTimeout(() => applyEnergyValue(getCurrentEnergy()), keys.length * 35 + 20);
    setTimeout(() => startGenreTempoLock(profile, name), keys.length * 35 + 60);

    // Switch culture grammar — engine.js:11780 listens for change events.
    const cultureSelect = $("culture_grammar_select");
    if (cultureSelect && cultureSelect.value !== profile.culture) {
      cultureSelect.value = profile.culture;
      dispatchChange(cultureSelect);
    }

    // Crossfade the genre flavor layer.
    if (window.GenreFlavor) {
      try { window.GenreFlavor.setGenre(name); } catch (e) {}
    }

    if (name === "techno") {
      setTimeout(() => triggerHazamaFmAcidCue("genre.techno", 0.64), keys.length * 35 + 90);
    }
  }

  // ---- localStorage --------------------------------------------

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      if (!data.savedAt || Date.now() - data.savedAt > RESUME_WINDOW_MS) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeSession(rb) {
    if (!rb) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: rb.active || null,
        next: rb.next || null,
        lastReason: rb.lastReason || null,
        energy: getCurrentEnergy(),
        genre: getCurrentGenre(),
        savedAt: Date.now()
      }));
    } catch (e) {
      // quota / private mode — non-fatal
    }
  }

  function clearResumeHint() {
    const node = $("fm-resume");
    if (node) node.hidden = true;
  }

  function showResumeHint(data) {
    const node = $("fm-resume");
    if (!node || !data || !data.active) return;
    node.hidden = false;
    node.textContent = `resume from ${data.active}`;
  }

  function getCurrentEnergy() {
    const pressed = document.querySelector('#fm-energy button[aria-pressed="true"]');
    return pressed ? pressed.dataset.energy : "mid";
  }

  function getCurrentGenre() {
    const pressed = document.querySelector('#fm-genre button[aria-pressed="true"]');
    return pressed ? pressed.dataset.genre : "any";
  }

  function formatProgramLabel(rb) {
    const reason = rb.lastReason ? ` — ${rb.lastReason}` : "";
    return `${rb.active || "—"}${reason}`;
  }

  function triggerStationIdent() {
    const mandala = $("mandala-container");
    if (!mandala) return;
    if (identTimer) clearTimeout(identTimer);
    mandala.classList.remove("ident-active");
    // Force a reflow so back-to-back transitions restart the brightness pulse.
    void mandala.offsetWidth;
    mandala.classList.add("ident-active");
    identTimer = setTimeout(() => {
      mandala.classList.remove("ident-active");
      identTimer = null;
    }, 1500);
  }

  function renderProgramLabel(rb, transition) {
    const now = $("fm-now");
    if (!now) return;
    const label = formatProgramLabel(rb);
    if (!transition) {
      if (!programLabelTimer) now.textContent = label;
      return;
    }

    if (programLabelTimer) clearTimeout(programLabelTimer);
    now.classList.add("transitioning");
    programLabelTimer = setTimeout(() => {
      now.textContent = label;
      programLabelTimer = null;
      now.classList.remove("transitioning");
    }, 220);
  }

  // ---- Runtime state subscription ------------------------------

  function onRuntimeState(event) {
    const detail = event.detail || (typeof window !== "undefined" ? window.MusicRuntimeState : null);
    const rb = detail && detail.radioBrain;
    if (!rb) return;

    const activeProgram = rb.active || "";
    const hasPreviousProgram = previousRadioProgram !== null;
    const programChanged = !!activeProgram && hasPreviousProgram && activeProgram !== previousRadioProgram;

    if (programChanged) {
      triggerStationIdent();
      renderProgramLabel(rb, true);
      maybeTriggerProgramAcidCue(activeProgram);
    } else {
      renderProgramLabel(rb, false);
    }
    if (activeProgram) previousRadioProgram = activeProgram;

    const next = $("fm-next");
    if (next) {
      next.textContent = `up next: ${rb.next || "—"}`;
    }

    // Phrase progress bar (0..1 within current program).
    const progressFill = document.querySelector("#fm-progress > span");
    if (progressFill) {
      const cycles = Math.max(1, rb.phraseCycles || 24);
      const progress = Math.min(1, Math.max(0, (rb.phrase || 0) / cycles));
      progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
    }

    // Mirror to Media Session so the OS lock screen / control center shows
    // the current program and tags it as Hazama FM.
    updateMediaSessionMetadata(rb);

    if (started) writeSession(rb);
  }

  // ---- Media Session API (lock screen / control center) ----------

  function ensureMediaSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler("play", () => fmStart());
      navigator.mediaSession.setActionHandler("pause", () => fmStop());
      navigator.mediaSession.setActionHandler("stop", () => fmStop());
      navigator.mediaSession.setActionHandler("nexttrack", () => cycleEnergy(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => cycleEnergy(-1));
    } catch (e) {
      // Some browsers reject unsupported actions — non-fatal.
    }
  }

  function updateMediaSessionMetadata(rb) {
    if (!("mediaSession" in navigator)) return;
    if (!rb) return;
    try {
      const reason = rb.lastReason ? ` — ${rb.lastReason}` : "";
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: `${rb.active || "Hazama FM"}${reason}`,
        artist: "Hazama FM",
        album: "music for thinking and building",
        artwork: [
          { src: "icons/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      });
    } catch (e) {
      // MediaMetadata constructor may not exist on very old browsers.
    }
  }

  function setMediaPlaybackState(state) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state; // "playing" | "paused" | "none"
    } catch (e) {}
  }

  function cycleEnergy(direction) {
    const order = ["low", "mid", "high"];
    const current = getCurrentEnergy();
    const idx = order.indexOf(current);
    if (idx < 0) return;
    const next = order[(idx + direction + order.length) % order.length];
    const btn = document.querySelector(`#fm-energy button[data-energy="${next}"]`);
    if (btn) btn.click();
  }

  // ---- START / STOP --------------------------------------------

  async function fmStart() {
    if (started || starting) return;
    starting = true;
    setButtonState("starting");
    clearResumeHint();

    try {
      // Gesture-tied AudioContext start (iOS Safari requirement).
      if (typeof Tone !== "undefined" && Tone.start) {
        await Tone.start();
      }

      // Reset master to silent so engine's restoreMasterLevel snaps to 0,
      // then fm.js ramps it up audibly.
      const out = $("output_level");
      if (out) {
        out.value = "1"; // not exactly 0 to avoid -Infinity dB / clicks
        dispatchInput(out);
      }

      // Apply current GENRE profile (sets all 9 faders + culture grammar),
      // then ENERGY pill on top to honor the energy choice.
      applyGenreProfile(getCurrentGenre());

      if (typeof window.startPlayback === "function") {
        await window.startPlayback({ source: "fm.start" });
      } else {
        // engine.js failed to load — surface to user.
        const now = $("fm-now");
        if (now) now.textContent = "engine unavailable — reload?";
        starting = false;
        setButtonState("idle");
        return;
      }

      // Audible fade in.
      await rampOutputLevel(TARGET_LEVEL, FADE_IN_S);

      // Boot the genre flavor layer (jazz brush+walking-bass, funk clavi+EP, etc.)
      // Independent of engine — own master Gain, own Tone.Transport schedules.
      if (window.GenreFlavor) {
        try {
          window.GenreFlavor.setGenre(getCurrentGenre());
          window.GenreFlavor.start();
        } catch (err) {
          console.warn("[Hazama FM] GenreFlavor.start failed:", err);
        }
      }

      started = true;
      starting = false;
      setButtonState("playing");
      setMediaPlaybackState("playing");
      if (getCurrentGenre() === "techno") {
        triggerHazamaFmAcidCue("start.techno", 0.64, { force: true });
      }

      // Try to render whatever runtime state is already published.
      if (window.MusicRuntimeState) {
        onRuntimeState({ detail: window.MusicRuntimeState });
      }
    } catch (err) {
      console.warn("[Hazama FM] start failed:", err);
      starting = false;
      setButtonState("idle");
      const now = $("fm-now");
      if (now) now.textContent = "start failed";
    }
  }

  async function fmStop() {
    if (!started || stopping) return;
    stopping = true;
    setButtonState("stopping");

    try {
      // Stop the genre flavor layer first so it fades alongside the engine.
      if (window.GenreFlavor) {
        try { window.GenreFlavor.stop(); } catch (e) {}
      }
      await rampOutputLevel(0, FADE_OUT_S);
      if (typeof window.stopPlayback === "function") {
        window.stopPlayback({ source: "fm.stop" });
      }
    } catch (err) {
      console.warn("[Hazama FM] stop fade failed:", err);
    } finally {
      started = false;
      stopping = false;
      stopGenreTempoLock();
      setButtonState("idle");
      setMediaPlaybackState("paused");
    }
  }

  function togglePlay() {
    if (starting || stopping) return;
    if (started) fmStop();
    else fmStart();
  }

  // ---- ENERGY pill ---------------------------------------------

  function bindEnergyPill() {
    const group = $("fm-energy");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-energy]");
      if (!btn) return;
      const name = btn.dataset.energy;
      group.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      applyEnergyValue(name);
    });
  }

  function bindGenrePill() {
    const group = $("fm-genre");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-genre]");
      if (!btn) return;
      const name = btn.dataset.genre;
      group.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      // Only apply live if engine is running. Otherwise just remember the
      // selection — fmStart will apply it on START.
      if (started) applyGenreProfile(name);
    });
  }

  // ---- Visibility / wake handling ------------------------------

  function bindVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!started) return;
      if (typeof Tone !== "undefined") {
        const ctx = Tone.getContext && Tone.getContext().rawContext;
        if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
          ctx.resume().catch(() => {});
        }
      }
    });
  }

  // ---- Boot ----------------------------------------------------

  function boot() {
    const playBtn = $("fm_play");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    bindEnergyPill();
    bindGenrePill();
    bindVisibility();
    ensureMediaSession();

    // Kick off preset fetch in the background. Loader is graceful: missing
    // files just resolve to null and the genre-flavor builders fall back
    // to their hand-coded defaults.
    if (window.HazamaPresets && typeof window.HazamaPresets.loadAll === "function") {
      window.HazamaPresets.loadAll().catch(() => {});
    }

    window.addEventListener("music-runtime-state", onRuntimeState);

    const resume = readSession();
    if (resume) {
      showResumeHint(resume);
      // Restore last energy / genre choice (visual only; applied on START).
      if (resume.energy && ENERGY_VALUES[resume.energy]) {
        const group = $("fm-energy");
        if (group) {
          group.querySelectorAll("button").forEach((b) => {
            b.setAttribute("aria-pressed", b.dataset.energy === resume.energy ? "true" : "false");
          });
        }
      }
      if (resume.genre && GENRE_PROFILES[resume.genre]) {
        const group = $("fm-genre");
        if (group) {
          group.querySelectorAll("button").forEach((b) => {
            b.setAttribute("aria-pressed", b.dataset.genre === resume.genre ? "true" : "false");
          });
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
