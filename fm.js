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
  const LISTENING_TRACE_STORAGE_KEY = "music:fm:listening-trace:v1";
  const LISTENING_TRACE_MAX_TRANSITIONS = 24;
  const FADE_IN_S = 4;
  const FADE_OUT_S = 3;
  const GENRE_MIX_DIP_S = 0.75;
  const GENRE_MIX_RETURN_S = 2.1;
  const GENRE_MIX_SWITCH_MS = 420;
  const GENRE_MIX_RETURN_MS = 920;
  const RESUME_WINDOW_MS = 30 * 60 * 1000;
  const TARGET_LEVEL = 100;            // engine OUTPUT max — limiter ceiling caps the peak
  const DESTINATION_BOOST_DB = 4;      // final-stage post-limiter loudness lift
  const SLEEP_FADE_AFTER_MS = 90 * 60 * 1000;  // 90 min: start auto fade-to-sleep
  const SLEEP_FADE_DURATION_S = 30 * 60;       // 30 min: ramp output to quiet
  const ENERGY_VALUES = { low: 25, mid: 45, high: 70 };
  const SHUFFLE_AUDITION_INTERVAL_MS = 42000;
  const SHUFFLE_AUDITION_GENRES = ["ambient", "techno", "lofi", "jazz", "funk", "piano"];
  const SHUFFLE_AUDITION_ENERGIES = ["low", "mid", "high"];
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
  let genreMixTimer = null;
  let genreMixReturnTimer = null;
  let genreMixSeq = 0;
  let shuffleAuditionEnabled = false;
  let shuffleAuditionTimer = null;
  let lastShuffleGenre = "";
  let lastShuffleEnergy = "";
  let lastAcidCueAt = 0;
  let lastAcidCueKey = "";
  let listeningTrace = null;

  // ---- Helpers --------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function dispatchInput(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dispatchChange(el) {
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function randomChoice(values) {
    if (!Array.isArray(values) || !values.length) return null;
    return values[Math.floor(Math.random() * values.length)];
  }

  function roundedMs(value) {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  function traceTimestamp() {
    return Date.now();
  }

  function traceIso(ms) {
    try { return new Date(ms).toISOString(); } catch (e) { return new Date().toISOString(); }
  }

  function currentFlavorSource() {
    try {
      return window.GenreFlavor?.state?.source || null;
    } catch (e) {
      return null;
    }
  }

  function currentBpmValue() {
    try {
      const bpm = Number(window.Tone?.Transport?.bpm?.value);
      return Number.isFinite(bpm) ? Math.round(bpm * 10) / 10 : null;
    } catch (e) {
      return null;
    }
  }

  function persistListeningTrace() {
    if (!listeningTrace) return;
    try {
      localStorage.setItem(LISTENING_TRACE_STORAGE_KEY, JSON.stringify(listeningTrace));
    } catch (e) {
      // localStorage may be unavailable in private mode; trace is best-effort.
    }
  }

  function startListeningTrace(genre) {
    const now = traceTimestamp();
    listeningTrace = {
      version: 1,
      startedAt: now,
      lastChangedAt: now,
      currentGenre: genre || getCurrentGenre(),
      currentSource: currentFlavorSource(),
      currentEnergy: getCurrentEnergy(),
      dwellMsByGenre: {},
      transitions: [],
      switchCount: 0
    };
    persistListeningTrace();
  }

  function ensureListeningTrace() {
    if (listeningTrace) return listeningTrace;
    startListeningTrace(getCurrentGenre());
    return listeningTrace;
  }

  function closeListeningTraceSegment(reason = "snapshot") {
    const trace = ensureListeningTrace();
    const now = traceTimestamp();
    const genre = trace.currentGenre || getCurrentGenre();
    const dwell = roundedMs(now - (trace.lastChangedAt || now));
    if (dwell > 0) {
      trace.dwellMsByGenre[genre] = roundedMs((trace.dwellMsByGenre[genre] || 0) + dwell);
      trace.lastClosedReason = reason;
      trace.lastChangedAt = now;
    }
    trace.currentSource = currentFlavorSource();
    trace.currentEnergy = getCurrentEnergy();
    persistListeningTrace();
    return { trace, now };
  }

  function recordGenreTrace(nextGenre, reason = "genre") {
    if (!nextGenre) return;
    const trace = ensureListeningTrace();
    const previous = trace.currentGenre || getCurrentGenre();
    const now = traceTimestamp();
    const dwell = roundedMs(now - (trace.lastChangedAt || now));
    if (previous && dwell > 0) {
      trace.dwellMsByGenre[previous] = roundedMs((trace.dwellMsByGenre[previous] || 0) + dwell);
    }
    if (previous !== nextGenre) {
      trace.switchCount += 1;
      trace.transitions.push({
        at_ms: roundedMs(now - trace.startedAt),
        from: previous || null,
        to: nextGenre,
        dwell_ms: dwell,
        reason,
        source: currentFlavorSource()
      });
      if (trace.transitions.length > LISTENING_TRACE_MAX_TRANSITIONS) {
        trace.transitions = trace.transitions.slice(-LISTENING_TRACE_MAX_TRANSITIONS);
      }
    }
    trace.currentGenre = nextGenre;
    trace.currentSource = currentFlavorSource();
    trace.currentEnergy = getCurrentEnergy();
    trace.lastChangedAt = now;
    persistListeningTrace();
  }

  function listeningTraceSnapshot() {
    const { trace, now } = closeListeningTraceSegment("snapshot");
    return {
      version: trace.version,
      active: started || starting,
      started_at: traceIso(trace.startedAt),
      elapsed_ms: roundedMs(now - trace.startedAt),
      current_genre: trace.currentGenre || getCurrentGenre(),
      current_source: currentFlavorSource() || trace.currentSource || null,
      current_energy: getCurrentEnergy(),
      shuffle_audition: shuffleAuditionEnabled,
      bpm: currentBpmValue(),
      dwell_ms_by_genre: { ...trace.dwellMsByGenre },
      switch_count: trace.switchCount,
      transitions: trace.transitions.slice(-LISTENING_TRACE_MAX_TRANSITIONS),
      storage_key: LISTENING_TRACE_STORAGE_KEY,
      review_only: true
    };
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

  function currentOutputLevel() {
    const slider = $("output_level");
    const value = slider ? Number(slider.value) : TARGET_LEVEL;
    return Number.isFinite(value) ? value : TARGET_LEVEL;
  }

  function clearGenreMixTimers() {
    if (genreMixTimer) {
      clearTimeout(genreMixTimer);
      genreMixTimer = null;
    }
    if (genreMixReturnTimer) {
      clearTimeout(genreMixReturnTimer);
      genreMixReturnTimer = null;
    }
  }

  function shouldDjMixGenre(options = {}) {
    return options.mix !== false && started && !starting && !stopping;
  }

  function beginGenreDjMix(name, options = {}) {
    const profile = GENRE_PROFILES[name];
    if (!profile) return;

    const seq = ++genreMixSeq;
    clearGenreMixTimers();
    const returnLevel = Math.max(62, currentOutputLevel());
    const dipLevel = Math.max(48, Math.round(returnLevel * 0.68));
    const reason = options.reason || "profile";

    rampOutputLevel(dipLevel, GENRE_MIX_DIP_S).catch(() => {});

    genreMixTimer = setTimeout(() => {
      if (seq !== genreMixSeq) return;
      genreMixTimer = null;
      applyGenreProfileNow(name, { reason: `${reason}.djmix` });
    }, GENRE_MIX_SWITCH_MS);

    genreMixReturnTimer = setTimeout(() => {
      if (seq !== genreMixSeq) return;
      genreMixReturnTimer = null;
      rampOutputLevel(returnLevel, GENRE_MIX_RETURN_S).catch(() => {});
    }, GENRE_MIX_RETURN_MS);
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

  function applyGenreProfile(name, options = {}) {
    if (shouldDjMixGenre(options)) {
      beginGenreDjMix(name, options);
      return;
    }
    applyGenreProfileNow(name, options);
  }

  function applyGenreProfileNow(name, options = {}) {
    const profile = GENRE_PROFILES[name];
    if (!profile) return;
    recordGenreTrace(name, options.reason || "profile");

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
        shuffleAudition: shuffleAuditionEnabled,
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

  function setEnergySelection(name, options = {}) {
    if (!ENERGY_VALUES[name]) return false;
    const group = $("fm-energy");
    if (!group) return false;
    group.querySelectorAll("button[data-energy]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.energy === name ? "true" : "false");
    });
    if (options.apply !== false) applyEnergyValue(name);
    return true;
  }

  function setGenreSelection(name, options = {}) {
    if (!GENRE_PROFILES[name]) return false;
    const group = $("fm-genre");
    if (!group) return false;
    group.querySelectorAll("button[data-genre]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.genre === name ? "true" : "false");
    });
    if (options.apply && (started || starting)) {
      applyGenreProfile(name, { reason: options.reason || "profile" });
    }
    return true;
  }

  function setShuffleStatus(text) {
    const status = $("fm-shuffle-status");
    if (status) status.textContent = text || "manual";
  }

  function syncShuffleButtonState() {
    const btn = $("fm_shuffle");
    if (btn) {
      btn.setAttribute("aria-pressed", shuffleAuditionEnabled ? "true" : "false");
      btn.textContent = shuffleAuditionEnabled ? "shuffle on" : "shuffle";
    }
    if (!shuffleAuditionEnabled) {
      setShuffleStatus("manual");
    }
  }

  function pickShuffleGenre() {
    const current = getCurrentGenre();
    const avoid = new Set([lastShuffleGenre]);
    if (current !== "any") avoid.add(current);
    const pool = SHUFFLE_AUDITION_GENRES.filter((name) => !avoid.has(name));
    return randomChoice(pool.length ? pool : SHUFFLE_AUDITION_GENRES);
  }

  function pickShuffleEnergy() {
    const current = getCurrentEnergy();
    const pool = SHUFFLE_AUDITION_ENERGIES.filter((name) => name !== current || SHUFFLE_AUDITION_ENERGIES.length === 1);
    return randomChoice(pool.length ? pool : SHUFFLE_AUDITION_ENERGIES);
  }

  function runShuffleAuditionStep(reason = "step", options = {}) {
    const genre = pickShuffleGenre();
    const energy = pickShuffleEnergy();
    if (!genre || !energy) return null;

    lastShuffleGenre = genre;
    lastShuffleEnergy = energy;
    setEnergySelection(energy, { apply: true });
    setGenreSelection(genre, { apply: false });
    setShuffleStatus(`${genre}/${energy}`);

    if (options.apply !== false && (started || starting)) {
      applyGenreProfile(genre, { reason: `shuffle.${reason}` });
    }
    return { genre, energy, reason };
  }

  function stopShuffleAuditionTimer() {
    if (shuffleAuditionTimer) {
      clearInterval(shuffleAuditionTimer);
      shuffleAuditionTimer = null;
    }
  }

  function startShuffleAuditionTimer() {
    stopShuffleAuditionTimer();
    if (!shuffleAuditionEnabled || (!started && !starting)) return;
    shuffleAuditionTimer = setInterval(() => {
      if (!started || !shuffleAuditionEnabled) {
        stopShuffleAuditionTimer();
        return;
      }
      runShuffleAuditionStep("timer", { apply: true });
    }, SHUFFLE_AUDITION_INTERVAL_MS);
  }

  function setShuffleAudition(enabled, options = {}) {
    shuffleAuditionEnabled = enabled === true;
    syncShuffleButtonState();
    if (!shuffleAuditionEnabled) {
      stopShuffleAuditionTimer();
      return;
    }
    if (options.immediate !== false) {
      runShuffleAuditionStep(options.reason || "manual", { apply: started || starting });
    }
    if (started || starting) startShuffleAuditionTimer();
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

  // ---- Review / SYNC -------------------------------------------

  function setSyncStatus(text) {
    const status = $("fm-sync-status");
    if (status) status.textContent = text || "";
  }

  function formatDwellSeconds(trace, genre) {
    const dwell = trace?.dwell_ms_by_genre?.[genre];
    const seconds = Math.round((Number(dwell) || 0) / 1000);
    return seconds > 0 ? `${seconds}s` : "";
  }

  function syncReviewMoment() {
    const btn = $("fm_sync");
    if (!started) {
      setSyncStatus("start first");
      return;
    }
    const api = window.MusicSessionPacket;
    if (!api || typeof api.sync !== "function") {
      setSyncStatus("sync unavailable");
      return;
    }
    if (btn) btn.disabled = true;
    try {
      const result = api.sync();
      const packet = result?.payload?.packet || api.last || null;
      const hazama = packet?.performance_state?.hazama_fm || null;
      const trace = hazama?.listening_trace || null;
      const genre = trace?.current_genre || hazama?.genre || getCurrentGenre();
      const dwell = formatDwellSeconds(trace, genre);
      const cue = hazama?.review_cue || packet?.routing?.openclaw?.next_action?.fm_review_cue || null;
      const cueLabel = cue?.short_label || cue?.target_repo || "";
      const stored = result?.stored || result?.broadcast;
      setSyncStatus(stored ? `saved ${genre}${dwell ? ` ${dwell}` : ""}${cueLabel ? ` -> ${cueLabel}` : ""}` : "sync failed");
    } catch (err) {
      console.warn("[Hazama FM] review sync failed:", err);
      setSyncStatus("sync failed");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindReviewSync() {
    const btn = $("fm_sync");
    if (btn) btn.addEventListener("click", syncReviewMoment);
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

      // Final-stage loudness lift. Tone.Destination.volume is the post-limiter
      // master, so this safely boosts overall loudness without distorting —
      // the engine's masterLimiter (-0.8 dBFS) still caps peaks upstream.
      try {
        if (Tone.getDestination) {
          Tone.getDestination().volume.value = DESTINATION_BOOST_DB;
        }
      } catch (e) {}

      // Reset master to silent so engine's restoreMasterLevel snaps to 0,
      // then fm.js ramps it up audibly.
      const out = $("output_level");
      if (out) {
        out.value = "1"; // not exactly 0 to avoid -Infinity dB / clicks
        dispatchInput(out);
      }

      // Apply current GENRE profile (sets all 9 faders + culture grammar),
      // then ENERGY pill on top to honor the energy choice.
      if (shuffleAuditionEnabled && getCurrentGenre() === "any") {
        runShuffleAuditionStep("start", { apply: false });
      }
      startListeningTrace(getCurrentGenre());
      applyGenreProfile(getCurrentGenre(), { reason: shuffleAuditionEnabled ? "shuffle.start" : "profile.start" });

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
      startSleepTimer();
      if (shuffleAuditionEnabled) {
        startShuffleAuditionTimer();
      }
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
      closeListeningTraceSegment("stop");
      await rampOutputLevel(0, FADE_OUT_S);
      if (typeof window.stopPlayback === "function") {
        window.stopPlayback({ source: "fm.stop" });
      }
    } catch (err) {
      console.warn("[Hazama FM] stop fade failed:", err);
    } finally {
      started = false;
      stopping = false;
      clearGenreMixTimers();
      stopShuffleAuditionTimer();
      stopGenreTempoLock();
      cancelSleepTimer("stop");
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
      cancelSleepTimer("user-energy");
      setEnergySelection(btn.dataset.energy, { apply: true });
    });
  }

  function bindGenrePill() {
    const group = $("fm-genre");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-genre]");
      if (!btn) return;
      const name = btn.dataset.genre;
      cancelSleepTimer("user-genre");
      if (shuffleAuditionEnabled) {
        setShuffleAudition(false);
      }
      setGenreSelection(name, { apply: false });
      // Only apply live if engine is running. Otherwise just remember the
      // selection — fmStart will apply it on START.
      if (started) applyGenreProfile(name, { reason: "manual" });
    });
  }

  function bindShuffleAudition() {
    const btn = $("fm_shuffle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      setShuffleAudition(!shuffleAuditionEnabled, { reason: "button", immediate: true });
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

  // ---- Fade-to-sleep ------------------------------------------

  // 90 分連続再生したら、自動で 30 分かけて output_level を 100 → 25 まで
  // 下げる。寝落ち想定。途中で genre/energy をユーザーが操作したらキャンセル。
  let sleepStartedAt = null;
  let sleepTimer = null;
  let sleepRamping = false;

  function startSleepTimer() {
    if (sleepTimer || !started) return;
    sleepStartedAt = Date.now();
    sleepTimer = setTimeout(() => {
      sleepTimer = null;
      if (!started) return;
      sleepRamping = true;
      // 30 分 (1800 秒) かけて output_level を 100 → 25 まで降ろす。
      // engine の masterGain がそれに追従して全体が静かになる。
      rampOutputLevel(25, SLEEP_FADE_DURATION_S).then(() => {
        sleepRamping = false;
      }).catch(() => { sleepRamping = false; });
    }, SLEEP_FADE_AFTER_MS);
  }

  function cancelSleepTimer(reason = "manual") {
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      sleepTimer = null;
    }
    sleepStartedAt = null;
    // ramping 中にユーザー操作があったら、output_level を即 TARGET に戻す
    if (sleepRamping) {
      sleepRamping = false;
      rampOutputLevel(TARGET_LEVEL, 6).catch(() => {});
    }
  }

  // ---- PWA install prompt -------------------------------------

  let deferredInstallPrompt = null;

  function bindInstallPrompt() {
    if (typeof window === "undefined") return;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      showInstallButton();
    });
    // 既にインストール済みなら何もしない
    window.addEventListener("appinstalled", () => {
      hideInstallButton();
      deferredInstallPrompt = null;
    });
  }

  function showInstallButton() {
    let btn = $("fm-install");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "fm-install";
      btn.type = "button";
      btn.className = "fm-install-btn";
      btn.textContent = "📲 install as app";
      btn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        try {
          await deferredInstallPrompt.userChoice;
        } catch (e) {}
        deferredInstallPrompt = null;
        hideInstallButton();
      });
      const shell = $("fm-shell");
      if (shell) shell.appendChild(btn);
    }
    btn.hidden = false;
  }

  function hideInstallButton() {
    const btn = $("fm-install");
    if (btn) btn.hidden = true;
  }

  // ---- Boot ----------------------------------------------------

  function boot() {
    const playBtn = $("fm_play");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    bindEnergyPill();
    bindGenrePill();
    bindShuffleAudition();
    bindReviewSync();
    bindVisibility();
    ensureMediaSession();
    bindInstallPrompt();

    // Kick off preset fetch in the background. Loader is graceful: missing
    // files just resolve to null and the genre-flavor builders fall back
    // to their hand-coded defaults.
    if (window.HazamaPresets && typeof window.HazamaPresets.loadAll === "function") {
      window.HazamaPresets.loadAll().catch(() => {});
    }

    window.addEventListener("music-runtime-state", onRuntimeState);
    window.HazamaFmListeningTrace = {
      snapshot: listeningTraceSnapshot,
      storageKey: LISTENING_TRACE_STORAGE_KEY
    };
    window.HazamaFmShuffleAudition = {
      setEnabled(value) {
        setShuffleAudition(value === true, { reason: "api", immediate: true });
      },
      step(reason = "api") {
        return runShuffleAuditionStep(reason, { apply: started || starting });
      },
      get state() {
        return {
          enabled: shuffleAuditionEnabled,
          intervalMs: SHUFFLE_AUDITION_INTERVAL_MS,
          timerActive: !!shuffleAuditionTimer,
          currentGenre: getCurrentGenre(),
          currentEnergy: getCurrentEnergy(),
          lastGenre: lastShuffleGenre || null,
          lastEnergy: lastShuffleEnergy || null
        };
      }
    };
    syncShuffleButtonState();

    const resume = readSession();
    if (resume) {
      showResumeHint(resume);
      // Restore last energy / genre choice (visual only; applied on START).
      if (resume.energy && ENERGY_VALUES[resume.energy]) {
        setEnergySelection(resume.energy, { apply: false });
      }
      if (resume.genre && GENRE_PROFILES[resume.genre]) {
        setGenreSelection(resume.genre, { apply: false });
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
