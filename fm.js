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
  const FOCUS_MODE_STORAGE_KEY = "music:fm:focus-mode:v1";
  const LISTENING_TRACE_STORAGE_KEY = "music:fm:listening-trace:v1";
  const DRUM_FLOOR_APP_URL = "https://quietbriony.github.io/drum-floor/";
  const LISTENING_TRACE_MAX_TRANSITIONS = 24;
  const FADE_IN_S = 4;
  const FADE_OUT_S = 3;
  const GENRE_MIX_DIP_S = 0.75;
  const GENRE_MIX_RETURN_S = 2.1;
  const GENRE_MIX_SWITCH_MS = 420;
  const GENRE_MIX_RETURN_MS = 920;
  const RESUME_WINDOW_MS = 30 * 60 * 1000;
  // FM runs the Music engine plus GenreFlavor as a parallel color layer.
  // v154: browser playback was too quiet versus normalized music apps.
  // 88 gives useful phone/car volume while keeping 90+ as manual headroom.
  const TARGET_LEVEL = 88;
  // Destination stays neutral. Do not post-boost both the engine and the
  // parallel flavor layer into the hardware output.
  const DESTINATION_BOOST_DB = 0;
  const SLEEP_FADE_AFTER_MS = 90 * 60 * 1000;  // 90 min: start auto fade-to-sleep
  const SLEEP_FADE_DURATION_S = 30 * 60;       // 30 min: ramp output to quiet
  const ENERGY_VALUES = { low: 25, mid: 45, high: 70 };
  const SESSION_WRITE_HEARTBEAT_MS = 10000;
  const SHUFFLE_AUDITION_INTERVAL_MS = 42000;
  const SHUFFLE_AUDITION_GENRES = ["ambient", "techno", "lofi", "jazz", "funk", "piano"];
  const SHUFFLE_AUDITION_ENERGIES = ["low", "mid", "high"];

  // DJ sets — auto-piloted 30-minute arcs that cross genres and ramp BPM.
  // Each segment specifies pill + bpm range. Tick fires every 1 sec to
  // interpolate BPM linearly within segment and switch pill at boundaries.
  const DJ_SETS = {
    "focus-30": {
      name: "FOCUS",
      label: "30-min focus arc",
      description: "piano → lofi → jazz → lofi → ambient",
      duration_min: 30,
      segments: [
        { from: 0,  to: 5,  pill: "piano",   energy: "low",  bpm: [62, 72] },
        { from: 5,  to: 11, pill: "lofi",    energy: "mid",  bpm: [72, 86] },
        { from: 11, to: 19, pill: "jazz",    energy: "mid",  bpm: [86, 108] },
        { from: 19, to: 25, pill: "lofi",    energy: "mid",  bpm: [108, 88] },
        { from: 25, to: 30, pill: "ambient", energy: "low",  bpm: [88, 70] }
      ]
    },
    "drive-30": {
      name: "DRIVE",
      label: "30-min build arc",
      description: "lofi → jazz → funk → techno → ambient",
      duration_min: 30,
      segments: [
        { from: 0,  to: 4,  pill: "lofi",    energy: "mid",  bpm: [80, 92] },
        { from: 4,  to: 12, pill: "jazz",    energy: "mid",  bpm: [92, 110] },
        { from: 12, to: 22, pill: "funk",    energy: "high", bpm: [98, 108] },
        { from: 22, to: 28, pill: "techno",  energy: "high", bpm: [120, 130] },
        { from: 28, to: 30, pill: "ambient", energy: "low",  bpm: [110, 78] }
      ]
    },
    "night-30": {
      name: "NIGHT",
      label: "30-min settle arc",
      description: "jazz → lofi → piano → ambient",
      duration_min: 30,
      segments: [
        { from: 0,  to: 6,  pill: "jazz",    energy: "mid", bpm: [102, 88] },
        { from: 6,  to: 14, pill: "lofi",    energy: "mid", bpm: [88,  78] },
        { from: 14, to: 22, pill: "piano",   energy: "low", bpm: [78,  64] },
        { from: 22, to: 30, pill: "ambient", energy: "low", bpm: [64,  56] }
      ]
    }
  };
  const DJ_TICK_INTERVAL_MS = 1000;     // v45: 1s for smoother BPM curve + tighter segment boundaries
  const DJ_BPM_RAMP_S = 4;              // bpm.rampTo seconds — short = responsive
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
  let rampResolve = null;
  let previousRadioProgram = null;
  let identTimer = null;
  let programLabelTimer = null;
  let genreTempoTimer = null;
  let genreMixTimer = null;
  let genreMixReturnTimer = null;
  let genreMixSeq = 0;
  let lastBandRoomGenreLink = null;
  let shuffleAuditionEnabled = false;
  let shuffleAuditionTimer = null;
  let lastShuffleGenre = "";
  let lastShuffleEnergy = "";
  let lastAcidCueAt = 0;
  let lastAcidCueKey = "";
  let listeningTrace = null;
  let focusModeEnabled = false;
  let lastSessionWriteAt = 0;
  let lastSessionWriteSignature = "";
  let lastMediaMetadataSignature = "";
  let mediaSessionWired = false;
  let playbackIntentSeq = 0;
  let profileApplySeq = 0;
  let profileApplyTimers = [];

  // ---- Helpers --------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function dispatchInput(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dispatchChange(el) {
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function normalizeAudioRoute(value) {
    const route = String(value || "").toLowerCase();
    if (route.includes("failed") || route.includes("error")) return "failed";
    if (route.includes("bridge") || route.includes("ios bg")) return "bridge";
    if (route.includes("ready") || route.includes("hidden")) return "ready";
    if (route.includes("direct") || route.includes("system")) return "direct";
    if (route.includes("off") || !route) return "off";
    return "direct";
  }

  function routeLabelFor(route) {
    if (route === "bridge") return "bridge";
    if (route === "failed") return "failed";
    if (route === "ready") return "ready";
    if (route === "direct") return "direct";
    return "off";
  }

  function refreshAudioRouteStatus(value = null) {
    const raw = value != null ? value : $("background_value")?.textContent;
    const route = normalizeAudioRoute(raw);
    const panel = $("fm-route");
    const label = $("fm-route-status");
    if (panel) {
      panel.dataset.route = route;
      panel.title = route === "bridge" ? "hidden media bridge active"
        : route === "ready" ? "hidden media bridge ready"
        : route === "failed" ? "hidden media bridge failed; direct output restored"
        : route === "direct" ? "direct Web Audio output"
        : "audio route off";
      panel.setAttribute("aria-label", panel.title);
    }
    if (label) label.textContent = routeLabelFor(route);
  }

  function bindAudioRouteStatus() {
    refreshAudioRouteStatus();
    const source = $("background_value");
    if (!source || typeof MutationObserver !== "function") return;
    const observer = new MutationObserver(() => refreshAudioRouteStatus());
    observer.observe(source, { childList: true, characterData: true, subtree: true });
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
      btn.textContent = "WARMING UP";
      btn.setAttribute("aria-label", "Warming up audio engine");
    } else if (state === "stopping") {
      btn.textContent = "FADING";
      btn.setAttribute("aria-label", "Fading out");
    } else {
      btn.textContent = "START";
      btn.setAttribute("aria-label", "Start playback");
    }
  }

  function settleOutputRamp() {
    if (rampHandle) {
      cancelAnimationFrame(rampHandle);
      rampHandle = null;
    }
    if (rampResolve) {
      const resolve = rampResolve;
      rampResolve = null;
      resolve();
    }
  }

  function rampOutputLevel(target, seconds) {
    const slider = $("output_level");
    settleOutputRamp();
    if (!slider) return Promise.resolve();

    const start = Number(slider.value) || 0;
    const t0 = performance.now();
    const duration = Math.max(50, seconds * 1000);

    return new Promise((resolve) => {
      rampResolve = resolve;
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
          rampResolve = null;
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

  function adjustOutputLevel(delta) {
    const slider = $("output_level");
    if (!slider) return;
    settleOutputRamp();
    const next = Math.max(0, Math.min(100, Math.round(currentOutputLevel() + delta)));
    slider.value = String(next);
    dispatchInput(slider);
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

  function clearProfileApplyTimers() {
    profileApplySeq++;
    profileApplyTimers.forEach((id) => clearTimeout(id));
    profileApplyTimers = [];
  }

  function scheduleProfileApply(seq, fn, delayMs) {
    const id = setTimeout(() => {
      profileApplyTimers = profileApplyTimers.filter((timerId) => timerId !== id);
      if (seq !== profileApplySeq) return;
      fn();
    }, delayMs);
    profileApplyTimers.push(id);
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
    clearProfileApplyTimers();
    const seq = profileApplySeq;
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
      scheduleProfileApply(seq, () => dispatchInput(slider), i * 35);
    });

    // Re-apply ENERGY pill on top of the genre baseline so the user's energy
    // choice still wins for the energy fader.
    scheduleProfileApply(seq, () => applyEnergyValue(getCurrentEnergy()), keys.length * 35 + 20);
    // v46: when DJ set is driving BPM through a curve, skip the static genre
    // tempo lock (would snap to profile.bpm every 900ms and fight the DJ ramp).
    // The DJ owns Tone.Transport.bpm exclusively while it's active.
    if (!isDjSetActive()) {
      scheduleProfileApply(seq, () => startGenreTempoLock(profile, name), keys.length * 35 + 60);
    }

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
      scheduleProfileApply(seq, () => triggerHazamaFmAcidCue("genre.techno", 0.64), keys.length * 35 + 90);
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

  function writeSession(rb, options = {}) {
    if (!rb) return;
    const now = Date.now();
    const energy = getCurrentEnergy();
    const genre = getCurrentGenre();
    const signature = [
      rb.active || "",
      rb.next || "",
      rb.lastReason || "",
      energy,
      genre,
      shuffleAuditionEnabled ? "shuffle" : "manual"
    ].join("|");
    if (
      !options.force &&
      signature === lastSessionWriteSignature &&
      now - lastSessionWriteAt < SESSION_WRITE_HEARTBEAT_MS
    ) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: rb.active || null,
        next: rb.next || null,
        lastReason: rb.lastReason || null,
        energy,
        genre,
        shuffleAudition: shuffleAuditionEnabled,
        savedAt: now
      }));
      lastSessionWriteAt = now;
      lastSessionWriteSignature = signature;
    } catch (e) {
      // quota / private mode — non-fatal
    }
  }

  function readFocusModePreference() {
    try {
      return localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === "on";
    } catch (e) {
      return false;
    }
  }

  function writeFocusModePreference(enabled) {
    try {
      localStorage.setItem(FOCUS_MODE_STORAGE_KEY, enabled ? "on" : "off");
    } catch (e) {
      // localStorage may be unavailable in private mode.
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

  // ---- DJ set engine ------------------------------------------
  // Plays a 30-min cross-genre arc, switching pill + ramping BPM at segment
  // boundaries. User clicking a pill manually cancels the active set.

  let djSetActive = null;            // current DJ_SETS entry or null
  let djSetStartTime = 0;
  let djSetCurrentSegmentIdx = -1;
  let djSetTimerId = null;
  let djSetUserCanceled = false;

  function isDjSetActive() {
    return djSetActive !== null && djSetTimerId !== null;
  }

  function setDjSetStatus(text) {
    const status = $("fm-dj-status");
    if (status) status.textContent = text || "manual";
  }

  function syncDjSetButtonState() {
    const group = $("fm-dj-set");
    if (!group) return;
    const activeKey = djSetActive
      ? Object.keys(DJ_SETS).find((k) => DJ_SETS[k] === djSetActive)
      : null;
    group.querySelectorAll("button[data-djset]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.djset === activeKey ? "true" : "false");
    });
  }

  function djSetCurrentSegment(elapsedMin) {
    if (!djSetActive) return null;
    for (let i = 0; i < djSetActive.segments.length; i++) {
      const s = djSetActive.segments[i];
      if (elapsedMin >= s.from && elapsedMin < s.to) {
        return { ...s, index: i };
      }
    }
    return null;
  }

  function tickDjSet() {
    if (!djSetActive) return;
    const elapsedMin = (Date.now() - djSetStartTime) / 60000;

    // Set complete — auto-stop
    if (elapsedMin >= djSetActive.duration_min) {
      const name = djSetActive.name;
      stopDjSet({ reason: "completed" });
      setDjSetStatus(`${name} completed`);
      return;
    }

    const seg = djSetCurrentSegment(elapsedMin);
    if (!seg) return;

    // Linear BPM interpolation within segment
    const segProgress = (elapsedMin - seg.from) / (seg.to - seg.from);
    const targetBpm = seg.bpm[0] + (seg.bpm[1] - seg.bpm[0]) * segProgress;
    if (window.Tone && window.Tone.Transport && window.Tone.Transport.bpm) {
      try { window.Tone.Transport.bpm.rampTo(targetBpm, DJ_BPM_RAMP_S); } catch (e) {}
    }

    // Switch pill + energy when entering a new segment
    if (seg.index !== djSetCurrentSegmentIdx) {
      djSetCurrentSegmentIdx = seg.index;
      try {
        setEnergySelection(seg.energy, { apply: started || starting });
      } catch (e) {}
      try {
        setGenreSelection(seg.pill, {
          apply: started || starting,
          reason: `dj-set:${djSetActive.name}:seg${seg.index}`,
          fromDjSet: true
        });
      } catch (e) {}
    }

    // Status display — compact format (mobile-friendly)
    const nextSeg = djSetActive.segments[seg.index + 1];
    const remainingMin = djSetActive.duration_min - elapsedMin;
    const segRemaining = seg.to - elapsedMin;
    const arrow = nextSeg ? ` → ${nextSeg.pill}` : "";
    setDjSetStatus(
      `${djSetActive.name} ${seg.pill}@${Math.round(targetBpm)}` +
      ` · ${segRemaining.toFixed(1)}m${arrow}` +
      ` · ${remainingMin.toFixed(1)}m total`
    );

    // Expose to flavor state for trace
    if (typeof window !== "undefined") {
      window.HazamaFlavorState = window.HazamaFlavorState || {};
      window.HazamaFlavorState.djSet = {
        name: djSetActive.name,
        segmentIdx: seg.index,
        segmentTotal: djSetActive.segments.length,
        currentPill: seg.pill,
        nextPill: nextSeg ? nextSeg.pill : null,
        elapsedMin: Math.round(elapsedMin * 10) / 10,
        remainingMin: Math.round(remainingMin * 10) / 10,
        targetBpm: Math.round(targetBpm * 10) / 10
      };
    }
  }

  function startDjSet(setKey) {
    const set = DJ_SETS[setKey];
    if (!set) return;
    stopDjSet({ reason: "switch", silent: true });
    djSetActive = set;
    djSetStartTime = Date.now();
    djSetCurrentSegmentIdx = -1;
    djSetUserCanceled = false;
    syncDjSetButtonState();
    setDjSetStatus(`${set.name} starting…`);
    // First tick immediately so pill switches right away
    tickDjSet();
    djSetTimerId = setInterval(tickDjSet, DJ_TICK_INTERVAL_MS);
    // Cancel sleep timer if active — DJ set is the user's session intent
    try { cancelSleepTimer("dj-set-start"); } catch (e) {}
  }

  function stopDjSet(options = {}) {
    const wasActive = djSetTimerId != null;
    if (djSetTimerId != null) {
      clearInterval(djSetTimerId);
      djSetTimerId = null;
    }
    djSetActive = null;
    djSetCurrentSegmentIdx = -1;
    if (typeof window !== "undefined" && window.HazamaFlavorState) {
      window.HazamaFlavorState.djSet = null;
    }
    syncDjSetButtonState();
    if (!options.silent) setDjSetStatus("manual");
    if (options.reason === "user-pill") {
      djSetUserCanceled = true;
    }
    // v46: restore tempo control to the current pill when DJ exits cleanly.
    // - User clicking a pill: setGenreSelection already re-applies the new
    //   pill's profile (which now re-engages tempo lock since DJ is gone).
    // - Stop button / completion: re-engage tempo lock for the currently
    //   selected pill so its BPM stabilizes instead of staying at DJ's last value.
    if (wasActive && options.reason !== "user-pill" && options.reason !== "fm-stop" && options.reason !== "switch") {
      if (started || starting) {
        const currentPill = getCurrentGenre();
        const profile = GENRE_PROFILES[currentPill];
        if (profile && currentPill !== "any") {
          try { startGenreTempoLock(profile, currentPill); } catch (e) {}
        }
      }
    }
  }

  function bindDjSetButtons() {
    const group = $("fm-dj-set");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-djset]");
      if (!btn) return;
      const key = btn.dataset.djset;
      if (key === "stop") {
        stopDjSet({ reason: "user-stop" });
        return;
      }
      if (djSetActive && Object.keys(DJ_SETS).find((k) => DJ_SETS[k] === djSetActive) === key) {
        // Same set clicked again — toggle off
        stopDjSet({ reason: "user-toggle" });
        return;
      }
      startDjSet(key);
    });
  }

  function setGenreSelection(name, options = {}) {
    if (!GENRE_PROFILES[name]) return false;
    const group = $("fm-genre");
    if (!group) return false;
    group.querySelectorAll("button[data-genre]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.genre === name ? "true" : "false");
    });
    // body data attribute drives the per-genre station-ident hue + accent
    // (CSS uses [data-fm-genre="<name>"] selectors in fm.css).
    if (document.body) {
      document.body.dataset.fmGenre = name;
    }
    // If user manually picked a pill (not driven by DJ set), cancel the set
    if (isDjSetActive() && !options.fromDjSet) {
      stopDjSet({ reason: "user-pill" });
    }
    if (options.apply && (started || starting)) {
      applyGenreProfile(name, { reason: options.reason || "profile" });
    }
    publishBandRoomGenreLink(name);
    return true;
  }

  function bandRoomGenreForFmGenre(name) {
    const map = {
      lofi: "boom-bap",
      jazz: "jazz-brush",
      techno: "four-on-floor",
      funk: "soul-funk",
      dnb: "dnb",
      breakbeat: "breakbeat",
      trance: "dnb",
      trap: "trap"
    };
    return map[name] || "";
  }

  function bandRoomHrefForGenre(name, slug = bandRoomGenreForFmGenre(name)) {
    const params = new URLSearchParams();
    params.set("from", "fm");
    if (name && GENRE_PROFILES[name]) params.set("g", name);
    if (slug) params.set("pattern", slug);
    return `band-room.html?${params.toString()}`;
  }

  function refreshBandRoomLinkHref(name = getCurrentGenre(), slug = bandRoomGenreForFmGenre(name)) {
    const link = $("fm-band-room-link");
    if (!link) return;
    link.href = bandRoomHrefForGenre(name, slug);
    link.setAttribute("aria-label", slug ? `Open Band Room with ${slug} pattern suggestion` : "Open Band Room");
  }

  function drumFloorHrefForContext(name = getCurrentGenre()) {
    const url = new URL(DRUM_FLOOR_APP_URL);
    const bpm = currentBpmValue();
    url.searchParams.set("from", "fm");
    if (name && name !== "any") url.searchParams.set("g", name);
    const energy = getCurrentEnergy();
    if (energy) url.searchParams.set("energy", energy);
    if (bpm) url.searchParams.set("bpm", String(Math.round(bpm)));
    return url.toString();
  }

  function refreshDrumFloorLinkHref(name = getCurrentGenre()) {
    const link = $("fm-drum-floor-link");
    if (!link) return;
    link.href = drumFloorHrefForContext(name);
    link.setAttribute("aria-label", `Open Drum Floor from Hazama FM${name && name !== "any" ? ` ${name}` : ""}`);
  }

  function publishDrumFloorHandoff(options = {}) {
    refreshDrumFloorLinkHref(getCurrentGenre());
    if (!options.force) return false;
    const api = window.MusicSessionPacket;
    if (!api || typeof api.sync !== "function") {
      if (options.status) setSyncStatus("drum-floor query fallback");
      return false;
    }
    try {
      const result = api.sync();
      const delivered = !!(result?.stored || result?.broadcast);
      if (options.status) {
        const genre = getCurrentGenre();
        const bpm = currentBpmValue();
        setSyncStatus(delivered
          ? `drum-floor sync ${genre}${bpm ? ` ${Math.round(bpm)}bpm` : ""}`
          : "drum-floor query fallback");
      }
      return delivered;
    } catch (err) {
      console.warn("[Hazama FM] drum-floor handoff sync failed:", err);
      if (options.status) setSyncStatus("drum-floor query fallback");
      return false;
    }
  }

  function publishBandRoomGenreLink(name, options = {}) {
    const slug = bandRoomGenreForFmGenre(name);
    refreshBandRoomLinkHref(name, slug);
    if (slug === lastBandRoomGenreLink && !options.force) return;
    lastBandRoomGenreLink = slug;
    try {
      if (slug) {
        localStorage.setItem("band-room.fm-linked-genre", slug);
        localStorage.setItem("band-room.fm-linked-genre-at", String(Date.now()));
      } else {
        localStorage.removeItem("band-room.fm-linked-genre");
        localStorage.removeItem("band-room.fm-linked-genre-at");
      }
    } catch (e) {
      // localStorage can be unavailable in private mode.
    }
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
    const base = `${rb.active || "—"}${reason}`;
    const flavor = (typeof window !== "undefined") ? window.HazamaFlavorState : null;
    if (!flavor || !flavor.sessionRole || flavor.sessionRole === "?") return base;
    const role = flavor.sessionRole === "break" ? "ためる"
               : flavor.sessionRole === "recap" ? "解放"
               : flavor.sessionRole === "head" ? "ヘッド"
               : flavor.sessionRole === "comp" ? "コンプ"
               : flavor.sessionRole === "vamp" ? "ヴァンプ"
               : flavor.sessionRole.replace("section-", "セクション");
    const arc = flavor.arcStage ? ` · ${flavor.arcStage}` : "";
    return `${base} · ${role}${arc}`;
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
    if (mediaSessionWired || !("mediaSession" in navigator)) return;
    const setHandler = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        // Some browsers reject unsupported actions — non-fatal.
      }
    };
    setHandler("play", () => fmStart());
    setHandler("pause", () => fmStop());
    setHandler("stop", () => fmStop());
    setHandler("nexttrack", () => cycleEnergy(1));
    setHandler("previoustrack", () => cycleEnergy(-1));
    setHandler("seekbackward", () => adjustOutputLevel(-5));
    setHandler("seekforward", () => adjustOutputLevel(5));
    mediaSessionWired = true;
  }

  function updateMediaSessionMetadata(rb) {
    if (!("mediaSession" in navigator)) return;
    if (!rb) return;
    const reason = rb.lastReason ? ` — ${rb.lastReason}` : "";
    const title = `${rb.active || "Hazama FM"}${reason}`;
    const signature = `${title}|${getCurrentGenre()}|${getCurrentEnergy()}`;
    if (signature === lastMediaMetadataSignature) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist: "Hazama FM",
        album: "music for thinking and building",
        artwork: [
          { src: "icons/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      });
      lastMediaMetadataSignature = signature;
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
    const intentSeq = ++playbackIntentSeq;
    starting = true;
    setButtonState("starting");
    clearResumeHint();

    const startWasAborted = () => intentSeq !== playbackIntentSeq || !starting || stopping;
    const cleanupAbortedStart = () => {
      try { window.GenreFlavor?.stop?.(); } catch (e) {}
      try { window.stopPlayback?.({ source: "fm.start-abort" }); } catch (e) {}
    };

    try {
      // Gesture-tied AudioContext start (iOS Safari requirement).
      if (typeof Tone !== "undefined" && Tone.start) {
        await Tone.start();
      }
      if (startWasAborted()) {
        cleanupAbortedStart();
        return;
      }

      // Keep the shared hardware destination neutral. Hazama FM loudness is
      // managed by engine OUTPUT plus GenreFlavor's internal headroom.
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
      if (startWasAborted()) {
        cleanupAbortedStart();
        return;
      }

      // Apply current GENRE profile (sets all 9 faders + culture grammar),
      // then ENERGY pill on top to honor the energy choice.
      if (shuffleAuditionEnabled && getCurrentGenre() === "any") {
        runShuffleAuditionStep("start", { apply: false });
      }
      startListeningTrace(getCurrentGenre());
      applyGenreProfile(getCurrentGenre(), { reason: shuffleAuditionEnabled ? "shuffle.start" : "profile.start" });
      if (startWasAborted()) {
        cleanupAbortedStart();
        return;
      }

      if (typeof window.startPlayback === "function") {
        const ok = await window.startPlayback({ source: "fm.start" });
        if (ok === false) {
          throw new Error("engine start returned false");
        }
      } else {
        // engine.js failed to load — surface to user.
        const now = $("fm-now");
        if (now) now.textContent = "engine unavailable — reload?";
        starting = false;
        setButtonState("idle");
        return;
      }
      if (startWasAborted()) {
        cleanupAbortedStart();
        return;
      }

      // Audible fade in.
      await rampOutputLevel(TARGET_LEVEL, FADE_IN_S);
      if (startWasAborted()) {
        cleanupAbortedStart();
        return;
      }

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
      if (startWasAborted()) {
        cleanupAbortedStart();
        return;
      }

      started = true;
      starting = false;
      setButtonState("playing");
      applyFocusModePreference();
      setMediaPlaybackState("playing");
      startSleepTimer();
      requestWakeLock();
      startTimeOfDayLoop();
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
      cleanupAbortedStart();
      if (intentSeq === playbackIntentSeq) {
        started = false;
        starting = false;
        setButtonState("idle");
        setMediaPlaybackState("paused");
        const now = $("fm-now");
        if (now) now.textContent = "start failed";
      }
    }
  }

  async function fmStop() {
    if ((!started && !starting) || stopping) return;
    playbackIntentSeq++;
    stopping = true;
    starting = false;
    clearProfileApplyTimers();
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
      starting = false;
      clearProfileApplyTimers();
      applyFocusModePreference();
      clearGenreMixTimers();
      stopShuffleAuditionTimer();
      stopGenreTempoLock();
      stopDjSet({ reason: "fm-stop" });
      cancelSleepTimer("stop");
      releaseWakeLock();
      stopTimeOfDayLoop();
      setButtonState("idle");
      setMediaPlaybackState("paused");
    }
  }

  // ---- Screen Wake Lock ----------------------------------------
  // Prevent the screen from sleeping during playback so iOS Safari keeps
  // Tone.Transport ticking. Re-acquired automatically on visibility return.

  let wakeLock = null;
  let wakeLockVisibilityBound = false;

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener?.("release", () => { wakeLock = null; });
      if (!wakeLockVisibilityBound) {
        wakeLockVisibilityBound = true;
        document.addEventListener("visibilitychange", async () => {
          if (started && !wakeLock && document.visibilityState === "visible") {
            try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
          }
        });
      }
    } catch (err) {
      console.warn("[Hazama FM] wake lock denied:", err && err.message);
    }
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    try { wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }

  // ---- Time-of-day auto pill (ANY mode only) -------------------
  // When the user has ANY selected, gently bias the underlying culture grammar
  // toward a time-appropriate flavor: morning piano, midday lofi, afternoon
  // jazz, evening funk/techno, late ambient. Doesn't override user pill picks.

  const TIME_OF_DAY_BUCKETS = [
    { hour: 6,  genre: "piano",   reason: "朝のpiano" },
    { hour: 10, genre: "lofi",    reason: "昼のlofi" },
    { hour: 15, genre: "jazz",    reason: "午後のjazz" },
    { hour: 19, genre: "funk",    reason: "夕方のfunk" },
    { hour: 22, genre: "techno",  reason: "夜のtechno" },
    { hour: 0,  genre: "ambient", reason: "深夜のambient" }
  ];
  let timeOfDayIntervalId = null;
  let timeOfDayLastApplied = null;

  function pickTimeOfDayGenre() {
    const h = new Date().getHours();
    let chosen = TIME_OF_DAY_BUCKETS[TIME_OF_DAY_BUCKETS.length - 1];
    for (const bucket of TIME_OF_DAY_BUCKETS) {
      if (h >= bucket.hour) chosen = bucket;
    }
    if (h < TIME_OF_DAY_BUCKETS[0].hour) chosen = TIME_OF_DAY_BUCKETS[TIME_OF_DAY_BUCKETS.length - 1];
    return chosen;
  }

  function applyTimeOfDayIfAny() {
    if (!started || getCurrentGenre() !== "any") return;
    const bucket = pickTimeOfDayGenre();
    if (timeOfDayLastApplied === bucket.genre) return;
    timeOfDayLastApplied = bucket.genre;
    if (window.GenreFlavor && typeof window.GenreFlavor.setGenre === "function") {
      try { window.GenreFlavor.setGenre(bucket.genre); } catch (e) {}
    }
    // Keep the visible ANY pill selected — this is a "background suggestion"
    // not a switch. fm-now will reflect the engine program; the flavor layer
    // brings in the time-appropriate color underneath.
    const caption = $("fm-now");
    if (caption && caption.dataset.timeOfDayReason !== bucket.reason) {
      caption.dataset.timeOfDayReason = bucket.reason;
    }
  }

  function startTimeOfDayLoop() {
    if (timeOfDayIntervalId != null) return;
    timeOfDayLastApplied = null;
    applyTimeOfDayIfAny();
    timeOfDayIntervalId = setInterval(applyTimeOfDayIfAny, 5 * 60 * 1000);
  }

  function stopTimeOfDayLoop() {
    if (timeOfDayIntervalId != null) {
      clearInterval(timeOfDayIntervalId);
      timeOfDayIntervalId = null;
    }
    timeOfDayLastApplied = null;
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

  function bindBandRoomLink() {
    const link = $("fm-band-room-link");
    if (!link) return;
    link.addEventListener("pointerenter", () => publishBandRoomGenreLink(getCurrentGenre(), { force: false }));
    link.addEventListener("focus", () => publishBandRoomGenreLink(getCurrentGenre(), { force: false }));
    link.addEventListener("click", () => publishBandRoomGenreLink(getCurrentGenre(), { force: true }));
  }

  function bindDrumFloorLink() {
    const link = $("fm-drum-floor-link");
    if (!link) return;
    link.addEventListener("pointerenter", () => refreshDrumFloorLinkHref(getCurrentGenre()));
    link.addEventListener("focus", () => refreshDrumFloorLinkHref(getCurrentGenre()));
    link.addEventListener("click", () => publishDrumFloorHandoff({ force: true, status: true }));
  }

  // ---- fm-75: 40 Hz focus mode --------------------------------

  function readFocusEngineState(detail = null) {
    if (detail) return detail;
    if (typeof window.getFmFocusModeState === "function") {
      try { return window.getFmFocusModeState(); } catch (e) {}
    }
    return null;
  }

  function syncFocusModeButtonState(detail = null) {
    const btn = $("fm-focus-mode");
    const status = $("fm-focus-status");
    const engineState = readFocusEngineState(detail);
    if (btn) {
      btn.setAttribute("aria-pressed", String(focusModeEnabled));
    }
    if (!status) return;
    if (!focusModeEnabled) {
      status.textContent = "off";
    } else if (!started && !starting) {
      status.textContent = "ready";
    } else if (engineState && engineState.suppressedByAiFill) {
      status.textContent = "ai fill";
    } else if (engineState && engineState.active) {
      status.textContent = "40 hz";
    } else {
      status.textContent = "ramping";
    }
  }

  function applyFocusModePreference(options = {}) {
    const shouldRun = focusModeEnabled && (started || starting);
    if (typeof window.setFmFocusModeEnabled === "function") {
      try {
        const state = window.setFmFocusModeEnabled(shouldRun, {
          force: options.force === true,
          rampInSeconds: 3,
          rampOutSeconds: 0.45
        });
        syncFocusModeButtonState(state);
        return;
      } catch (e) {}
    }
    syncFocusModeButtonState();
  }

  function bindFocusModeButton() {
    const btn = $("fm-focus-mode");
    focusModeEnabled = readFocusModePreference();
    syncFocusModeButtonState();
    if (!btn) return;
    btn.addEventListener("click", () => {
      focusModeEnabled = !focusModeEnabled;
      writeFocusModePreference(focusModeEnabled);
      applyFocusModePreference();
    });
    window.addEventListener("music-focus-mode-state", (event) => {
      syncFocusModeButtonState(event.detail);
    });
  }

  // ---- fm-71: AI fill button (Magenta DrumsRNN) ----------------
  // The CDN scripts + checkpoint (~5 MB) are fetched lazily on the
  // first click. While loading the button shows "loading…" and is
  // disabled to prevent stacked requests. After the model warms up
  // the click fires a 4-bar burst on top of the current mode's
  // pattern; the engine reverts automatically after the burst.

  function bindAiFillButton() {
    const btn = $("fm-ai-fill");
    const status = $("fm-ai-fill-status");
    if (!btn) return;
    if (window.FmAiFill && status && typeof window.FmAiFill.bindStatusElement === "function") {
      window.FmAiFill.bindStatusElement(status);
    }
    btn.addEventListener("click", async () => {
      if (!window.FmAiFill) {
        if (status) status.textContent = "AI module missing";
        return;
      }
      // Engine not started yet → ask the user to press START first
      // (Magenta would download but the burst couldn't fire anyway).
      if (!started) {
        if (status) status.textContent = "press START first";
        return;
      }
      const originalLabel = btn.textContent;
      btn.disabled = true;
      if (!window.FmAiFill.status.ready) {
        btn.textContent = "loading…";
      } else {
        btn.textContent = "firing…";
      }
      try {
        const ok = await window.FmAiFill.startBurst(4);
        if (!ok && status && !status.textContent) {
          status.textContent = "AI fill aborted";
        }
      } catch (e) {
        if (status) status.textContent = "AI fill error";
      } finally {
        btn.textContent = originalLabel;
        btn.disabled = false;
      }
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
      // v45: catch up DJ set state immediately when the window becomes
      // visible again. setInterval is throttled when minimized (≥1s, worse
      // for long backgrounds) — tickDjSet computes from Date.now() so
      // running it on focus return resyncs the BPM + pill instantly.
      if (isDjSetActive()) {
        try { tickDjSet(); } catch (e) {}
      }
      applyFocusModePreference();
    });
  }

  // ---- Fade-to-sleep ------------------------------------------

  // 90 分連続再生したら、自動で 30 分かけて現在の output_level → 25 まで
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
      // 30 分 (1800 秒) かけて output_level を現在値 → 25 まで降ろす。
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

  // ---- Listening trace debug overlay --------------------------

  let traceRefreshTimer = null;

  function formatTraceSummary(snap) {
    const lines = [];
    // Legend — what the session_role and lead voice values mean
    lines.push("legend");
    lines.push("  ためる  = break frame (drum-only, dynamic dip)");
    lines.push("  解放    = recap frame (released, +12% velocity)");
    lines.push("  ヘッド  = head statement (melody-led)");
    lines.push("  コンプ  = comping (chord-led)");
    lines.push("  ヴァンプ = vamp (loop pocket)");
    lines.push("  lead    = which voice has the spotlight this 4-bar window");
    lines.push("  drop    = 32-bar quiet moment (melodic layers silent)");
    lines.push("");
    const elapsedMin = (snap.elapsed_ms / 60000).toFixed(1);
    lines.push(`status        ${snap.active ? "playing" : "idle"}`);
    lines.push(`elapsed       ${elapsedMin} min`);
    lines.push(`bpm           ${snap.bpm ?? "—"}`);
    lines.push(`genre         ${snap.current_genre ?? "—"}  (${snap.current_energy ?? "—"})`);
    lines.push(`source        ${snap.current_source ?? "—"}`);
    lines.push(`shuffle       ${snap.shuffle_audition ? "on" : "off"}`);
    lines.push(`switch count  ${snap.switch_count}`);
    lines.push("");

    // Active flavor state — current frame + arc + governor amounts
    const flavor = (typeof window !== "undefined") ? window.HazamaFlavorState : null;
    if (flavor && flavor.pill) {
      lines.push("flavor state");
      lines.push(`  pill        ${flavor.pill}`);
      if (flavor.frameId) lines.push(`  frame       ${flavor.frameId}  (${flavor.sessionRole || "?"})`);
      if (flavor.frameRole) lines.push(`  role        ${flavor.frameRole}`);
      if (flavor.frameBpm) lines.push(`  frame-bpm   ${flavor.frameBpm}`);
      if (flavor.arcStage) lines.push(`  arc         ${flavor.arcStage}  (${flavor.arcElapsedSec}s, ${flavor.arcScale}x)`);
      // Groove lock state
      if (flavor.groove) {
        const g = flavor.groove;
        lines.push(`  groove      push ${(g.pushMs || 0).toFixed(1)}ms · intensity ${(g.intensity || 1).toFixed(2)}x`);
      }
      if (flavor.phraseBar != null) lines.push(`  phrase bar  ${flavor.phraseBar} / 4  ·  8bar ${flavor.phrase8Bar != null ? flavor.phrase8Bar : "?"} / 8`);
      if (flavor.leadVoice) lines.push(`  lead voice  ${flavor.leadVoice}${flavor.leadVoice === "lead" ? "  (solo)" : ""}`);
      if (flavor.dropBar) lines.push(`  drop bar    YES (32-bar quiet moment)`);
      if (flavor.keyShift != null && flavor.keyShift !== 0) {
        const keyNames = { 0: "D dorian", 5: "G dorian", 7: "A dorian" };
        lines.push(`  key shift   +${flavor.keyShift} semi  (${keyNames[flavor.keyShift] || "?"})`);
      }
      // v43 narrative movement
      if (flavor.movement) {
        const tension = flavor.tension != null ? `${(flavor.tension * 100).toFixed(0)}%` : "?";
        const movementJp = {
          intro: "イントロ (静)",
          build: "ビルド (上り)",
          peak:  "ピーク (満)",
          break: "ブレイク (休)",
          return: "リターン (帰)",
          outro: "アウトロ (引)"
        }[flavor.movement] || flavor.movement;
        lines.push(`  movement    ${movementJp}  bar ${flavor.movementBar}/${flavor.movementTotal}  tension ${tension}`);
      }
      // v44 DJ set
      if (flavor.djSet) {
        const dj = flavor.djSet;
        lines.push(`  dj set      ${dj.name}  seg ${dj.segmentIdx + 1}/${dj.segmentTotal}  · ${dj.currentPill}@${dj.targetBpm}BPM`);
        if (dj.nextPill) lines.push(`              next: ${dj.nextPill}  · remaining ${dj.remainingMin}m`);
      }
      // Live tempo (BPM drift visible)
      if (typeof window !== "undefined" && window.Tone && window.Tone.Transport) {
        const bpm = Math.round(Number(window.Tone.Transport.bpm.value) * 10) / 10;
        if (Number.isFinite(bpm)) lines.push(`  live bpm    ${bpm}`);
      }
      // Governor amounts per pill (mirrors GENRE_GOVERNORS in genre-flavor.js)
      const gov = {
        ambient: { rdj: 0.012, dangelo: 0.0 },
        techno:  { rdj: 0.035, dangelo: 0.0 },
        lofi:    { rdj: 0.030, dangelo: 0.5 },
        jazz:    { rdj: 0.022, dangelo: 0.5 },
        funk:    { rdj: 0.022, dangelo: 1.0 },
        piano:   { rdj: 0.018, dangelo: 0.2 },
        any:     { rdj: 0.025, dangelo: 0.0 }
      }[flavor.pill] || { rdj: 0.0, dangelo: 0.0 };
      lines.push(`  governor    RDJ ${(gov.rdj * 100).toFixed(1)}%  ·  D'A ${gov.dangelo.toFixed(2)}`);
      lines.push("");
    }

    // Wake lock state
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      lines.push(`wake lock     ${wakeLock ? "held" : "released"}`);
      lines.push("");
    }

    lines.push("genre dwell (ms)");
    const dwell = snap.dwell_ms_by_genre || {};
    const dwellEntries = Object.entries(dwell).sort((a, b) => b[1] - a[1]);
    if (dwellEntries.length === 0) {
      lines.push("  (no genre played yet)");
    } else {
      const totalMs = dwellEntries.reduce((s, [, ms]) => s + ms, 0) || 1;
      for (const [g, ms] of dwellEntries) {
        const pct = ((ms / totalMs) * 100).toFixed(1);
        const min = (ms / 60000).toFixed(1);
        lines.push(`  ${g.padEnd(10, " ")} ${min.padStart(5, " ")}m  ${pct.padStart(5, " ")}%`);
      }
    }
    lines.push("");
    const trans = snap.transitions || [];
    lines.push(`recent transitions (last ${Math.min(trans.length, 6)} of ${trans.length}):`);
    if (trans.length === 0) {
      lines.push("  (none yet)");
    } else {
      for (const t of trans.slice(-6)) {
        const from = (t.from_genre || "—").padEnd(8, " ");
        const to = (t.to_genre || "—").padEnd(8, " ");
        const reason = t.reason || "";
        const dwell = t.dwell_ms != null ? `${(t.dwell_ms / 1000).toFixed(0)}s` : "—";
        lines.push(`  ${from} → ${to} (${dwell.padStart(4, " ")}) [${reason}]`);
      }
    }
    return lines.join("\n");
  }

  function refreshTracePanel() {
    const body = $("fm-trace-body");
    if (!body) return;
    try {
      const snap = listeningTraceSnapshot();
      body.textContent = formatTraceSummary(snap);
    } catch (e) {
      body.textContent = "trace error: " + (e && e.message ? e.message : e);
    }
  }

  function bindTracePanel() {
    const btn = $("fm-trace-btn");
    const panel = $("fm-trace-panel");
    const closeBtn = $("fm-trace-close");
    if (!btn || !panel) return;
    btn.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) {
        refreshTracePanel();
        // refresh every 2 s while open
        traceRefreshTimer = setInterval(refreshTracePanel, 2000);
      } else if (traceRefreshTimer) {
        clearInterval(traceRefreshTimer);
        traceRefreshTimer = null;
      }
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (traceRefreshTimer) {
          clearInterval(traceRefreshTimer);
          traceRefreshTimer = null;
        }
      });
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

  // ---- GENRE pill captions (artist reference tags) ----------

  // 各 pill の下に「Nujabes dust」「Blakey + Evans」のような短い参照タグを
  // 動的に注入する。references/hazama-fm-pill-refs.json から ui_caption を
  // 読む。fetch 失敗時は caption なし (graceful)。
  async function applyGenrePillCaptions() {
    let data = null;
    try {
      const res = await fetch("references/hazama-fm-pill-refs.json", { cache: "no-store" });
      if (!res.ok) return;
      data = await res.json();
    } catch (e) {
      return;
    }
    if (!data || !data.pills) return;
    Object.entries(data.pills).forEach(([name, info]) => {
      if (!info || !info.ui_caption) return;
      const btn = document.querySelector(`#fm-genre button[data-genre="${name}"]`);
      if (!btn || btn.querySelector(".fm-genre-caption")) return;
      const caption = document.createElement("small");
      caption.className = "fm-genre-caption";
      caption.textContent = info.ui_caption;
      btn.appendChild(caption);
      btn.classList.add("fm-genre--captioned");
    });
  }

  // ---- Boot ----------------------------------------------------

  function boot() {
    const playBtn = $("fm_play");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    bindEnergyPill();
    bindGenrePill();
    bindDjSetButtons();
    bindShuffleAudition();
    bindBandRoomLink();
    bindDrumFloorLink();
    bindAudioRouteStatus();
    bindFocusModeButton();
    bindAiFillButton();
    bindReviewSync();
    bindVisibility();
    ensureMediaSession();
    bindInstallPrompt();
    bindTracePanel();
    applyGenrePillCaptions();

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

    // URL query (?g=jazz) — used by manifest.shortcuts on Android long-press
    // and by deep links. Overrides resume genre when present.
    try {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("g") || params.get("genre");
      if (requested && GENRE_PROFILES[requested]) {
        setGenreSelection(requested, { apply: false });
        clearResumeHint();
      }
    } catch (e) { /* URL parse fail — non-fatal */ }

    refreshBandRoomLinkHref(getCurrentGenre());
    refreshDrumFloorLinkHref(getCurrentGenre());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
