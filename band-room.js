/* =========================================================
   Band Room — air rock connect box
   Standalone playback engine for Tabasco. revival.

   Reads:
     presets/drum-frames-tabasco-{song_id}.json (song-track format)

   Plays via Tone.js:
     - drum-floor groove (kick / snare / hat / ghost / fill / crash)
     - click track (4-on)
     - synth bass (8th-note root pulse from chord_progression)
     - chord guide (PolySynth on chord changes)

   Tracks song.structure section-by-section, updates UI per bar.
========================================================= */

(function () {
  "use strict";

  if (typeof window === "undefined" || typeof window.Tone === "undefined") return;
  const Tone = window.Tone;
  const DRUM_FLOOR_URL = "https://quietbriony.github.io/drum-floor/";
  const MUSIC_STACK_PACKET_STORAGE_KEY = "qb:music-stack:latest-packet:v1";
  const MUSIC_STACK_CHANNEL_NAME = "qb:music-stack:v1";

  // ---- State ---------------------------------------------------

  const state = {
    bandsRegistry: null,
    currentBandId: "tabasco",
    currentSongId: "tabasco",
    songData: null,
    started: false,
    starting: false,
    barCount: 0,
    sectionIdx: 0,
    sectionBarStart: 0,
    playbackStartedAtMs: 0,
    playbackStartedAtAudioSec: 0,
    playbackStartOffsetSec: 0,
    pendingSeekOffsetSec: 0,
    playbackRateAtStart: 1,
    loadedStemDurationSec: 0,
    lastStemResyncAtMs: 0,
    chordIdx: 0,
    chordBarsRemaining: 0,
    scheduledIds: [],
    kitSource: "auto-self", // default: use the current song's own extracted drum samples
                            // ("synth" = generic Tone.js voices, "<src>/<song>" = specific kit)
    kitProfile: "default",  // v91: synth voice profile (only applies when kitSource = "synth")
    // v99: per-voice overrides — kick だけ 808, snare だけ acoustic みたいに
    // 1 voice 単位で別 kit からピックできる。null = base kit を使う、文字列 = その kit id
    voiceOverrides: { kick: null, snare: null, hat: null, ghost: null, fill: null, crash: null },
    chordInstrument: null,  // v101: catalog instrument id for chord (null = synth)
    bassInstrument: "bass-electric",   // v166: default AI agent tone follows original-band electric bass
    guitarInstrument: "guitar-electric", // v166: default AI agent tone follows original-band electric guitar
    voiceInstrument: null,  // v111: catalog instrument id for vocal/melody lead (null = synth)
    loopA: null,            // v80: A-B loop range (null = no loop)
    loopB: null
  };

  // ---- Tone.js nodes -------------------------------------------

  let masterGain = null;
  let masterLimiter = null;
  let masterHardwareOutput = null;
  let masterPlaybackDest = null;
  let backgroundBridgeAudio = null;
  let backgroundBridgeActive = false;
  let backgroundBridgeHealthBound = false;
  let backgroundBridgeRearmTimer = 0;
  let autoAdvanceInFlight = false;
  let autoAdvanceTimer = 0;
  let playbackHealthTimer = 0;
  let suspendReleaseTimers = [];
  let songSwitchSeq = 0;
  let masterReverb = null;
  let masterWidener = null;
  let masterDryGain = null;
  let masterWetGain = null;
  // v66 mastering chain additions
  let masterMultibandComp = null;     // 3-band compression
  let masterTapeSat = null;           // parallel-wet harmonic saturator
  let masterTapeSatWet = null;        // wet send level for tape sat
  let masterTapeSatDry = null;        // dry path
  let stemEQs = { vocals: null, drums: null, bass: null, other: null }; // per-stem EQ
  let vocalDeEsser = null;            // sidechain-style sibilance dip
  let masterMeter = null;             // v71: master RMS meter for UI feedback
  let masterMeterRaf = 0;             // requestAnimationFrame id
  let transportProgressRaf = 0;       // v165: ordinary song timeline RAF
  let transportSeekActive = false;    // true while the user drags #br-song-seek
  let masterFft = null;               // v77: spectrum analyzer FFT
  let masterRecorderDest = null;      // v81: MediaStreamDestination for recording
  let mediaRecorder = null;           // v81: MediaRecorder for live capture
  let recorderChunks = [];            // v81: collected Blob parts
  // v90: per-stem MediaStreamDestination + recorders for stems pack export.
  // Each stem bus is tapped separately so the user gets 4 wav-equivalents.
  let stemRecorderDests = { vocals: null, drums: null, bass: null, other: null };
  let stemRecorders    = { vocals: null, drums: null, bass: null, other: null };
  let stemRecorderChunks = { vocals: [], drums: [], bass: [], other: [] };
  let drumBus = null;
  let bassBus = null;
  let guitarBus = null;
  let voiceBus = null;
  let chordBus = null;
  let clickBus = null;

  // Synth (AI 再現) layers
  let drumKit = null;
  let synthBass = null;
  let guitarSynth = null;
  let voiceSynth = null;
  let chordSynth = null;
  let clickSynth = null;

  // Original stem buses + Tone.Player instances (Demucs separated)
  let stemBus = { vocals: null, drums: null, bass: null, other: null };
  let stemPlayers = { vocals: null, drums: null, bass: null, other: null };
  let currentMode = "stems";  // "stems" | "synth"

  // Drum kit source (synth default OR sampled from a reference song)
  const KIT_OPTIONS = [
    { value: "synth", label: "AI synth (default)" },
    { value: "auto-self", label: "auto: 曲自身の drums (現在の曲)" },
    { value: "tabasco/tabasco",         label: "Tabasco / TABASCO (136)" },
    { value: "tabasco/hey",             label: "Tabasco / Hey (123)" },
    { value: "tabasco/i-got-a-feeling", label: "Tabasco / I got a feeling (117)" },
    { value: "tabasco/under-the-moon",  label: "Tabasco / Under the Moon (161)" },
    { value: "tabasco/electric-sheep",  label: "Tabasco / Electric Sheep (129)" },
    { value: "tabasco/human-fly",       label: "Tabasco / Human Fly (117)" },
    { value: "tabasco/sister",          label: "Tabasco / Sister (117)" },
    { value: "unripe/continuous",    label: "UNRIPE / Continuous (103)" },
    { value: "unripe/list-of-words", label: "UNRIPE / List of Words (103)" },
    { value: "unripe/definition",    label: "UNRIPE / Definition (144)" },
    { value: "unripe/past-and-fate", label: "UNRIPE / Past and Fate (144)" },
    { value: "unripe/end-falls",     label: "UNRIPE / End Falls (108)" },
    { value: "unripe/erase",         label: "UNRIPE / Erase (136)" }
  ];

  function resolveKitSource(source) {
    if (source === "auto-self") {
      return `${state.currentBandId}/${state.currentSongId}`;
    }
    return source;
  }

  // Vocal FX chain (applied to vocal stem + external vocal)
  let vocalChorus = null;
  let vocalDelay = null;
  let vocalDelayWet = null;
  let vocalReverb = null;
  let vocalReverbWet = null;
  let vocalDryGain = null;

  // External vocal (Suno-generated or user re-recording, mp3/wav blob URL)
  let externalVocalPlayer = null;
  let externalVocalBus = null;
  let externalVocalBlobUrl = null;

  // v87: per-stem external replacement (drums/bass/other).
  // Lets you mute the original drums stem and feed in your own kit take, etc.
  // Each routes via stemEQs[stem].input so the same EQ chain applies.
  let externalStemPlayers = { drums: null, bass: null, other: null };
  let externalStemBlobUrls = { drums: null, bass: null, other: null };

  // ---- Master setup -------------------------------------------

  function makeStemEQChain(stem) {
    // Returns { input, output } — caller connects player → input, output → bus
    if (stem === "drums") {
      const hp = new Tone.Filter({ frequency: 45, type: "highpass", Q: 0.55 });
      const eq = new Tone.EQ3({ low: 0.2, mid: -0.2, high: 0.7, lowFrequency: 220, highFrequency: 4200 });
      hp.connect(eq);
      return { input: hp, output: eq };
    }
    if (stem === "bass") {
      const hp = new Tone.Filter({ frequency: 34, type: "highpass", Q: 0.55 });
      const lp = new Tone.Filter({ frequency: 3600, type: "lowpass", Q: 0.55 });
      hp.connect(lp);
      return { input: hp, output: lp };
    }
    if (stem === "vocals") {
      const hp = new Tone.Filter({ frequency: 115, type: "highpass", Q: 0.55 });
      const presence = new Tone.EQ3({ low: -0.2, mid: 0.5, high: 0.6, lowFrequency: 420, highFrequency: 3600 });
      // Built-in de-esser: notch at ~6 kHz with low Q to gently tame sibilance
      const deEss = new Tone.Filter({ frequency: 6200, type: "peaking", Q: 1.1, gain: -3.5 });
      hp.connect(presence);
      presence.connect(deEss);
      return { input: hp, output: deEss };
    }
    // other
    const hp = new Tone.Filter({ frequency: 120, type: "highpass", Q: 0.55 });
    const shelf = new Tone.EQ3({ low: -0.2, mid: 0, high: 0.3, lowFrequency: 220, highFrequency: 5200 });
    hp.connect(shelf);
    return { input: hp, output: shelf };
  }

  function ensureMaster() {
    if (masterGain) return masterGain;
    // v66 mastering chain (two-stage compression + tape sat + per-stem EQ):
    //   stem player → per-stem EQ (HP/shelf/de-ess) → stem bus
    //   stem bus → masterGain → masterComp1 (gentle leveling)
    //                          → masterEq (broad tilt)
    //                          → masterComp2 (glue, tight)
    //                          → masterWidener
    //                          → [dry] + [tape sat wet] + [reverb wet]
    //                          → masterLimiter → Destination
    //
    // Per-stem EQ adds clarity (drum HP, bass LP, vocal HP + de-ess + presence,
    // other HP). Two-stage compression: comp1 catches peaks gently, EQ tilts,
    // comp2 glues. Tape sat parallel-wet for harmonic gel.
    masterLimiter = new Tone.Limiter({ threshold: -1.0 });
    masterHardwareOutput = new Tone.Gain(1).toDestination();
    masterLimiter.connect(masterHardwareOutput);
    // v71: meter tap on the limiter input — measures the final pre-clip RMS
    masterMeter = new Tone.Meter({ smoothing: 0.75 });
    masterLimiter.connect(masterMeter);
    // v77: FFT tap for the spectrum analyzer (64 bins is plenty for a
    // 28-bar compact view; smoothing built into the FFT analyser node).
    masterFft = new Tone.FFT({ size: 64, smoothing: 0.65 });
    masterLimiter.connect(masterFft);
    // v81: MediaStreamDestination so MediaRecorder can capture the
    // final post-limiter mix to a file (webm/opus by default; some
    // browsers can do audio/mp4).
    try {
      masterRecorderDest = Tone.context.createMediaStreamDestination();
      masterLimiter.connect(masterRecorderDest);
    } catch (e) {
      console.warn("[Band Room] recorder destination unavailable:", e);
    }
    try {
      masterPlaybackDest = Tone.context.createMediaStreamDestination();
      masterLimiter.connect(masterPlaybackDest);
    } catch (e) {
      console.warn("[Band Room] playback bridge destination unavailable:", e);
    }
    const masterEq = new Tone.EQ3({ low: 0.7, mid: -0.2, high: 0.2, lowFrequency: 180, highFrequency: 5600 });
    const masterComp1 = new Tone.Compressor({ threshold: -16, ratio: 2.0, attack: 0.018, release: 0.26, knee: 8 });
    const masterComp2 = new Tone.Compressor({ threshold: -7,  ratio: 1.45, attack: 0.006, release: 0.14, knee: 5 });
    masterWidener = new Tone.StereoWidener(0.62);

    masterTapeSat = new Tone.Distortion({ distortion: 0.045, oversample: "2x", wet: 1 });
    masterTapeSatWet = new Tone.Gain(0.07);
    masterTapeSatDry = new Tone.Gain(0.94);

    masterReverb = new Tone.Reverb({ decay: 1.9, preDelay: 0.025, wet: 1 });
    masterDryGain = new Tone.Gain(0.84);
    masterWetGain = new Tone.Gain(0.16);

    masterGain = new Tone.Gain(0.84);
    masterGain.connect(masterComp1);
    masterComp1.connect(masterEq);
    masterEq.connect(masterComp2);
    masterComp2.connect(masterWidener);

    masterWidener.connect(masterTapeSatDry);
    masterWidener.connect(masterTapeSat);
    masterWidener.connect(masterReverb);
    masterTapeSat.connect(masterTapeSatWet);
    masterReverb.connect(masterWetGain);
    masterTapeSatDry.connect(masterDryGain);
    masterDryGain.connect(masterLimiter);
    masterTapeSatWet.connect(masterLimiter);
    masterWetGain.connect(masterLimiter);

    // Per-stem EQ chains — created once, connected when players load
    stemEQs.drums = makeStemEQChain("drums");
    stemEQs.bass  = makeStemEQChain("bass");
    stemEQs.vocals = makeStemEQChain("vocals");
    stemEQs.other = makeStemEQChain("other");

    // v167: "good by default" rebalance after source-derived AI agents.
    // Keep the band cohesive: less top-end glare, more master headroom, and
    // enough bass/guitar presence without crowding the vocal stem.
    const drumPan   = new Tone.Panner(0.00).connect(masterGain);
    const bassPan   = new Tone.Panner(0.00).connect(masterGain);
    const guitarPan = new Tone.Panner(-0.18).connect(masterGain);
    const voicePan  = new Tone.Panner(0.00).connect(masterGain);
    const chordPan  = new Tone.Panner(+0.16).connect(masterGain);
    const clickPan  = new Tone.Panner(0.00).connect(masterGain);
    drumBus = new Tone.Gain(0.58).connect(drumPan);
    bassBus = new Tone.Gain(0.66).connect(bassPan);
    guitarBus = new Tone.Gain(0.56).connect(guitarPan);
    voiceBus = new Tone.Gain(0.48).connect(voicePan);
    chordBus = new Tone.Gain(0.58).connect(chordPan);
    clickBus = new Tone.Gain(0.35).connect(clickPan);

    // Original-stem buses → per-stem EQ → masterGain
    // v167: slightly lower full-stem defaults so the remaster chain glues
    // instead of constantly living on the limiter.
    stemBus.drums  = new Tone.Gain(0.86).connect(masterGain);
    stemBus.bass   = new Tone.Gain(0.86).connect(masterGain);
    stemBus.other  = new Tone.Gain(0.84).connect(masterGain);
    // Wire EQ outputs into respective buses (input side will receive players)
    stemEQs.drums.output.connect(stemBus.drums);
    stemEQs.bass.output.connect(stemBus.bass);
    stemEQs.other.output.connect(stemBus.other);

    // Vocal stem has its own FX chain — disguise / polish the raw vocal
    // before it reaches the master remaster.
    //
    // Chain: Tone.Player → [dry] + [chorus → delay → reverb (wet)] → vocalBus → masterGain
    vocalChorus = new Tone.Chorus({ frequency: 1.25, delayTime: 3.6, depth: 0.34, wet: 0.22 }).start();
    vocalDelay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.26, wet: 1 });
    vocalDelayWet = new Tone.Gain(0.12);  // delay send level
    vocalReverb = new Tone.Reverb({ decay: 2.6, preDelay: 0.035, wet: 1 });
    vocalReverbWet = new Tone.Gain(0.20);  // reverb send level
    vocalDryGain = new Tone.Gain(0.82);

    stemBus.vocals = new Tone.Gain(0.68);

    // Wire: vocalChorus is input. Chorus feeds three paths in parallel.
    // dry → vocalDryGain → stemBus.vocals
    // wet1 (delay) → vocalDelay → vocalDelayWet → stemBus.vocals
    // wet2 (reverb) → vocalReverb → vocalReverbWet → stemBus.vocals
    vocalChorus.connect(vocalDryGain);
    vocalChorus.connect(vocalDelay);
    vocalChorus.connect(vocalReverb);
    vocalDelay.connect(vocalDelayWet);
    vocalReverb.connect(vocalReverbWet);
    vocalDryGain.connect(stemBus.vocals);
    vocalDelayWet.connect(stemBus.vocals);
    vocalReverbWet.connect(stemBus.vocals);
    stemBus.vocals.connect(masterGain);
    // Vocal stem EQ → vocalChorus (so EQ runs before FX chain)
    stemEQs.vocals.output.connect(vocalChorus);

    // External vocal bus — feeds INTO vocalChorus (shares vocal FX chain
    // with stem vocals so chorus/echo/reverb apply to both)
    externalVocalBus = new Tone.Gain(0.78);
    externalVocalBus.connect(vocalChorus);

    // v90/v167: per-stem MediaStreamDestinations so each stem bus can be
    // captured independently for stems pack export. This must happen after
    // stemBus.* exists; otherwise the export starts with 0/4 streams.
    try {
      ["vocals", "drums", "bass", "other"].forEach((stem) => {
        if (!stemBus[stem]) return;
        const dest = Tone.context.createMediaStreamDestination();
        stemBus[stem].connect(dest);
        stemRecorderDests[stem] = dest;
      });
    } catch (e) {
      console.warn("[Band Room] per-stem recorder destinations unavailable:", e);
    }
    return masterGain;
  }

  function isAppleMobileDevice() {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const ua = nav.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  }

  function isSafariFamily() {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }

  function shouldPreferBackgroundAudioBridge() {
    return isAppleMobileDevice();
  }

  function ensureBackgroundBridgeAudio() {
    if (backgroundBridgeAudio) return backgroundBridgeAudio;
    if (!masterPlaybackDest?.stream || typeof document === "undefined") return null;

    const audio = document.createElement("audio");
    audio.id = "br-background-audio";
    audio.autoplay = false;
    audio.controls = false;
    audio.loop = false;
    audio.muted = false;
    audio.playsInline = true;
    audio.srcObject = masterPlaybackDest.stream;
    audio.setAttribute("aria-hidden", "true");
    audio.setAttribute("playsinline", "");
    audio.style.position = "fixed";
    audio.style.width = "1px";
    audio.style.height = "1px";
    audio.style.opacity = "0";
    audio.style.pointerEvents = "none";
    audio.style.left = "-9999px";
    audio.style.bottom = "0";

    (document.body || document.documentElement).appendChild(audio);
    backgroundBridgeAudio = audio;
    bindBackgroundBridgeHealth(audio);
    return audio;
  }

  function bindBackgroundBridgeHealth(audio) {
    if (!audio || backgroundBridgeHealthBound) return;
    backgroundBridgeHealthBound = true;
    const markBridgeLost = (event) => {
      if (!backgroundBridgeActive) return;
      backgroundBridgeActive = false;
      routeHardwareOutputForBridge(false, true);
      document.body?.classList.toggle("br-bg-audio", false);
      setAudioRouteStatus(event?.type === "error" ? "failed" : "direct");
      scheduleBackgroundBridgeRearm(event?.type || "lost");
    };
    ["pause", "ended", "error", "stalled", "emptied", "abort"].forEach((eventName) => {
      audio.addEventListener(eventName, markBridgeLost);
    });
  }

  function clearBackgroundBridgeRearmTimer() {
    if (!backgroundBridgeRearmTimer) return;
    clearTimeout(backgroundBridgeRearmTimer);
    backgroundBridgeRearmTimer = 0;
  }

  function scheduleBackgroundBridgeRearm(reason = "lost") {
    clearBackgroundBridgeRearmTimer();
    if (!state.started || !shouldPreferBackgroundAudioBridge()) return;
    backgroundBridgeRearmTimer = setTimeout(() => {
      backgroundBridgeRearmTimer = 0;
      if (!state.started || backgroundBridgeActive) return;
      startBackgroundAudioBridge({ force: true, rearm: true, reason });
    }, 1200);
  }

  function checkBackgroundBridgeHealth(reason = "watchdog") {
    if (!state.started) return true;
    const audio = backgroundBridgeAudio;
    if (!backgroundBridgeActive) {
      if (shouldPreferBackgroundAudioBridge()) scheduleBackgroundBridgeRearm(reason);
      return false;
    }

    const unhealthy = !audio || audio.paused || audio.ended || !audio.srcObject || audio.readyState === 0;
    if (!unhealthy) return true;

    backgroundBridgeActive = false;
    routeHardwareOutputForBridge(false, true);
    document.body?.classList.toggle("br-bg-audio", false);
    setAudioRouteStatus("direct");
    scheduleBackgroundBridgeRearm(reason);
    return false;
  }

  function routeHardwareOutputForBridge(active, force = false) {
    if (!masterHardwareOutput) return;
    const value = active ? 0.0001 : 1;
    try { masterHardwareOutput.gain.rampTo(value, force ? 0.04 : 0.12); } catch (e) {}
  }

  function setAudioRouteStatus(label) {
    const status = $("br-audio-route-status");
    if (!status) return;
    const route = ["bridge", "arming", "rearming", "failed"].includes(label) ? label : "direct";
    status.textContent = route;
    status.dataset.route = route;
    status.title = route === "bridge" ? "hidden media bridge active"
                 : route === "arming" || route === "rearming" ? "hidden media bridge starting"
                 : route === "failed" ? "hidden media bridge failed; direct output restored"
                 : "direct Web Audio output";
    status.setAttribute("aria-label", status.title);
  }

  async function startBackgroundAudioBridge(options = {}) {
    const force = options.force === true;
    if (!force && !shouldPreferBackgroundAudioBridge()) {
      routeHardwareOutputForBridge(false);
      setAudioRouteStatus("direct");
      return false;
    }

    const audio = ensureBackgroundBridgeAudio();
    if (!audio) {
      routeHardwareOutputForBridge(false);
      setAudioRouteStatus("direct");
      return false;
    }

    try {
      audio.muted = false;
      audio.volume = 1;
      setAudioRouteStatus(options.rearm ? "rearming" : "arming");
      const result = audio.play();
      if (result && typeof result.then === "function") await result;
      backgroundBridgeActive = true;
      clearBackgroundBridgeRearmTimer();
      routeHardwareOutputForBridge(true, force);
      document.body?.classList.toggle("br-bg-audio", true);
      setAudioRouteStatus("bridge");
      return true;
    } catch (e) {
      console.warn("[Band Room] background audio bridge failed:", e);
      backgroundBridgeActive = false;
      routeHardwareOutputForBridge(false, true);
      document.body?.classList.toggle("br-bg-audio", false);
      setAudioRouteStatus("failed");
      return false;
    }
  }

  function stopBackgroundAudioBridge() {
    clearBackgroundBridgeRearmTimer();
    backgroundBridgeActive = false;
    routeHardwareOutputForBridge(false, true);
    document.body?.classList.toggle("br-bg-audio", false);
    setAudioRouteStatus("direct");
    if (backgroundBridgeAudio) {
      try { backgroundBridgeAudio.pause(); } catch (e) {}
    }
  }

  // Vocal phrase trigger — fire one-shot Tone.Player on click
  // Phrase samples are at presets/sample-kits/<source>/<song>/vocal-phrase-NN.wav
  // (summary.json has the list). Each plays through the same vocalChorus FX chain.
  const phrasePlayerPool = new Map();  // url → Tone.Player (cached, one-shot)
  const phraseLoopPool = new Map();    // v72: url → Tone.Player (active loops)
  let phraseFireMode = "instant";       // v72: "instant" | "sync" | "loop"

  async function renderPhraseTrigger() {
    const grid = $("br-phrase-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const band = state.currentBandId;
    const song = state.currentSongId;
    const url = `presets/sample-kits/${band}/${song}/summary.json`;

    let summary = null;
    try {
      const res = await fetch(url + "?cb=" + Date.now());
      if (res.ok) summary = await res.json();
    } catch (e) {}

    // v72: mode chips above grid
    const modes = [
      { id: "instant", label: "⚡ 即発火" },
      { id: "sync",    label: "⏱ 次小節" },
      { id: "loop",    label: "🔁 ループ" }
    ];
    const modeRow = document.createElement("div");
    modeRow.className = "br-phrase-modes";
    modes.forEach((m) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "br-mode-chip" + (m.id === phraseFireMode ? " active" : "");
      chip.dataset.mode = m.id;
      chip.textContent = m.label;
      chip.addEventListener("click", () => {
        phraseFireMode = m.id;
        modeRow.querySelectorAll(".br-mode-chip").forEach((c) => {
          c.classList.toggle("active", c.dataset.mode === m.id);
        });
      });
      modeRow.appendChild(chip);
    });
    grid.appendChild(modeRow);

    const phrases = summary && summary.vocal_phrases && summary.vocal_phrases.phrases;
    if (!phrases || phrases.length === 0) {
      const empty = document.createElement("span");
      empty.className = "br-phrase-empty";
      empty.textContent = "(no phrases extracted for this song)";
      grid.appendChild(empty);
      return;
    }

    const cellsWrap = document.createElement("div");
    cellsWrap.className = "br-phrase-cells";
    // v82: qwerty keyboard mapping. First 20 phrases get keys q-p on row
    // 1 (10 keys) and a-l plus ; on row 2 (10 keys). Displayed as small
    // letter in the button corner.
    const KEYS = ["q","w","e","r","t","y","u","i","o","p",
                  "a","s","d","f","g","h","j","k","l",";"];
    phrases.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const num = (i + 1).toString().padStart(2, "0");
      const key = KEYS[i];
      btn.innerHTML = `<span class="br-phrase-num">${num}</span>` +
                      (key ? `<span class="br-phrase-key">${key}</span>` : "");
      btn.title = `${p.duration_s}s @ ${p.src_start_s}s (RMS ${p.rms})` +
                  (key ? ` · key: ${key}` : "");
      btn.dataset.phraseUrl = `presets/sample-kits/${band}/${song}/${p.file}`;
      if (key) btn.dataset.phraseKey = key;
      cellsWrap.appendChild(btn);
    });
    grid.appendChild(cellsWrap);
  }

  function firePhrase(url) {
    if (!vocalChorus) ensureMaster();

    // v72: loop mode — toggle. If already looping this url, stop it.
    if (phraseFireMode === "loop") {
      const existing = phraseLoopPool.get(url);
      if (existing) {
        try { existing.stop("+0.05"); } catch (e) {}
        try { existing.dispose(); } catch (e) {}
        phraseLoopPool.delete(url);
        updatePhraseLoopUI(url, false);
        return;
      }
      const loopPlayer = new Tone.Player({
        url, autostart: false, fadeIn: 0.04, fadeOut: 0.10, loop: true
      }).connect(externalVocalBus || vocalChorus);
      phraseLoopPool.set(url, loopPlayer);
      Tone.loaded().then(() => {
        try {
          // Quantize to next bar so the loop locks to the groove
          const next = state.started ? Tone.Transport.nextSubdivision("1m") : "+0.05";
          loopPlayer.start(next);
          updatePhraseLoopUI(url, true);
        } catch (e) {}
      });
      return;
    }

    // instant / sync — one-shot via shared pool
    let player = phrasePlayerPool.get(url);
    if (!player) {
      player = new Tone.Player({
        url, autostart: false, retrigger: true, fadeIn: 0.01, fadeOut: 0.02
      }).connect(externalVocalBus || vocalChorus);
      phrasePlayerPool.set(url, player);
    }
    const startWhen = (phraseFireMode === "sync" && state.started)
      ? Tone.Transport.nextSubdivision("1m")
      : "+0.005";
    const fire = () => {
      try { player.start(startWhen); } catch (e) {}
    };
    if (!player.buffer || !player.buffer.loaded) {
      Tone.loaded().then(fire);
    } else {
      fire();
    }
  }

  // v81: live recording — capture the post-limiter mix to a downloadable file
  function startRecording() {
    if (!masterRecorderDest) {
      ensureMaster();
      if (!masterRecorderDest) return false;
    }
    if (mediaRecorder && mediaRecorder.state === "recording") return false;
    recorderChunks = [];
    let mime = "audio/webm;codecs=opus";
    if (!(window.MediaRecorder && MediaRecorder.isTypeSupported(mime))) {
      mime = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "";
    }
    try {
      mediaRecorder = new MediaRecorder(masterRecorderDest.stream, mime ? { mimeType: mime } : undefined);
    } catch (e) {
      console.warn("[Band Room] MediaRecorder construct failed:", e);
      return false;
    }
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recorderChunks.push(e.data);
    };
    mediaRecorder.start(500); // collect every 500ms
    setRecorderUi("recording");
    return true;
  }

  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;
    mediaRecorder.onstop = () => {
      const blob = new Blob(recorderChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      recorderChunks = [];
      const url = URL.createObjectURL(blob);
      const a = $("br-rec-download");
      if (a) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const ext = (mediaRecorder.mimeType || "").includes("mp4") ? "m4a" : "webm";
        a.href = url;
        a.download = `band-room_${state.currentBandId}_${state.currentSongId}_${stamp}.${ext}`;
        a.textContent = `↓ download (${(blob.size / 1024 / 1024).toFixed(1)} MB)`;
        a.style.display = "inline";
      }
      setRecorderUi("ready");
    };
    mediaRecorder.stop();
  }

  function setRecorderUi(state) {
    const btn = $("br-rec-toggle");
    if (!btn) return;
    if (state === "recording") {
      btn.textContent = "■ STOP REC";
      btn.classList.add("rec-active");
    } else {
      btn.textContent = "● REC";
      btn.classList.remove("rec-active");
    }
  }

  // v90: stems pack export — start 4 MediaRecorders simultaneously,
  // one per stem bus. STOP collects 4 blobs and emits 4 download links.
  function startStemsPack() {
    ensureMaster();
    const stems = ["vocals", "drums", "bass", "other"];
    let started = 0;
    const mime = (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
      ? "audio/webm;codecs=opus" : "audio/webm";
    stems.forEach((stem) => {
      const dest = stemRecorderDests[stem];
      if (!dest) return;
      stemRecorderChunks[stem] = [];
      try {
        const rec = new MediaRecorder(dest.stream, { mimeType: mime });
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) stemRecorderChunks[stem].push(e.data);
        };
        rec.start(500);
        stemRecorders[stem] = rec;
        started++;
      } catch (e) {
        console.warn(`[Band Room] stems pack ${stem} start failed:`, e);
      }
    });
    setStemsPackUi("recording");
    setStemsPackStatus(`recording ${started}/4 streams…`);
    return started > 0;
  }

  function stopStemsPack() {
    const stems = ["vocals", "drums", "bass", "other"];
    const links = $("br-stems-pack-links");
    if (links) links.innerHTML = "";
    let pending = 0;
    let done = 0;
    stems.forEach((stem) => {
      const rec = stemRecorders[stem];
      if (!rec || rec.state !== "recording") return;
      pending++;
      rec.onstop = () => {
        const blob = new Blob(stemRecorderChunks[stem], { type: rec.mimeType || "audio/webm" });
        stemRecorderChunks[stem] = [];
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const ext = (rec.mimeType || "").includes("mp4") ? "m4a" : "webm";
        a.href = url;
        a.download = `band-room_${state.currentBandId}_${state.currentSongId}_${stem}_${stamp}.${ext}`;
        a.textContent = `↓ ${stem} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`;
        a.className = "br-stems-pack-link";
        if (links) links.appendChild(a);
        stemRecorders[stem] = null;
        done++;
        if (done === pending) {
          setStemsPackUi("ready");
          setStemsPackStatus(`done — ${done} stems exported`);
        }
      };
      rec.stop();
    });
  }

  function setStemsPackUi(state) {
    const btn = $("br-stems-pack-toggle");
    if (!btn) return;
    if (state === "recording") {
      btn.textContent = "■ STOP";
      btn.classList.add("rec-active");
    } else {
      btn.textContent = "● 4 stems";
      btn.classList.remove("rec-active");
    }
  }

  function setStemsPackStatus(s) {
    const el = $("br-stems-pack-status");
    if (el) el.textContent = s || "";
  }

  function updatePhraseLoopUI(url, active) {
    const btn = document.querySelector(`#br-phrase-grid button[data-phrase-url="${url}"]`);
    if (btn) btn.classList.toggle("looping", active);
  }

  function loadExternalVocal(fileBlob) {
    if (externalVocalPlayer) {
      try { externalVocalPlayer.stop(); externalVocalPlayer.dispose(); } catch (e) {}
      externalVocalPlayer = null;
    }
    if (externalVocalBlobUrl) {
      URL.revokeObjectURL(externalVocalBlobUrl);
      externalVocalBlobUrl = null;
    }
    if (!fileBlob) return Promise.resolve(false);
    if (!vocalChorus) ensureMaster();
    externalVocalBlobUrl = URL.createObjectURL(fileBlob);
    const status = $("br-external-vocal-status");
    if (status) status.textContent = "loading…";
    externalVocalPlayer = new Tone.Player({
      url: externalVocalBlobUrl,
      autostart: false,
      fadeIn: 0.01,
      fadeOut: 0.02
    }).connect(externalVocalBus);   // → externalVocalBus → vocalChorus → FX chain
    return Tone.loaded().then(() => {
      if (status) status.textContent = `loaded: ${fileBlob.name} (${(fileBlob.size/1024/1024).toFixed(1)} MB)`;
      return true;
    });
  }

  function startExternalVocalIfEnabled(offsetSec = 0) {
    if (!externalVocalPlayer) return;
    const enabled = $("br-toggle-external-vocal")?.checked;
    if (!enabled) return;
    try {
      externalVocalPlayer.start("+0.15", Math.max(0, Number(offsetSec) || 0));
    } catch (e) {
      console.warn("[Band Room] external vocal start failed:", e);
    }
  }
  function stopExternalVocal() {
    if (!externalVocalPlayer) return;
    try { externalVocalPlayer.stop(); } catch (e) {}
  }

  // v87: per-stem external upload (drums/bass/other).
  function loadExternalStem(stem, fileBlob) {
    if (!["drums", "bass", "other"].includes(stem)) return Promise.resolve(false);
    if (externalStemPlayers[stem]) {
      try { externalStemPlayers[stem].stop(); externalStemPlayers[stem].dispose(); } catch (e) {}
      externalStemPlayers[stem] = null;
    }
    if (externalStemBlobUrls[stem]) {
      URL.revokeObjectURL(externalStemBlobUrls[stem]);
      externalStemBlobUrls[stem] = null;
    }
    if (!fileBlob) return Promise.resolve(false);
    if (!stemEQs[stem]) ensureMaster();
    externalStemBlobUrls[stem] = URL.createObjectURL(fileBlob);
    const status = $(`br-external-${stem}-status`);
    if (status) status.textContent = "loading…";
    externalStemPlayers[stem] = new Tone.Player({
      url: externalStemBlobUrls[stem],
      autostart: false,
      fadeIn: 0.10,
      fadeOut: 0.20,
      loop: true
    }).connect(stemEQs[stem].input);
    return Tone.loaded().then(() => {
      if (status) status.textContent = `loaded: ${fileBlob.name} (${(fileBlob.size/1024/1024).toFixed(1)} MB)`;
      return true;
    });
  }

  function startExternalStemIfEnabled(stem, offsetSec = 0) {
    const p = externalStemPlayers[stem];
    if (!p) return;
    const enabled = $(`br-toggle-external-${stem}`)?.checked;
    if (!enabled) return;
    try { p.start("+0.15", Math.max(0, Number(offsetSec) || 0)); } catch (e) {}
  }

  function stopExternalStem(stem) {
    const p = externalStemPlayers[stem];
    if (!p) return;
    try { p.stop(); } catch (e) {}
  }

  // ---- Drum kit (tabasco-rock profile: LCD + Backdrop Bomb) ----

  // v91: kit synth profiles — preset DSP knob bundles that bend the
  // synth drum sound toward different genre identities. Sample kits
  // (auto-self / tabasco-* / unripe-*) are unaffected — only the
  // synth fallback uses these.
  const KIT_PROFILES = {
    "default": {
      label: "default (LCD + Backdrop Bomb mixture)",
      kick:  { decay: 0.32, octaves: 4.0,  vol: -8,  clickVol: -32 },
      snare: { decay: 0.14, hpFreq: 1100,  vol: -12, rimVol: -28 },
      hat:   { decay: 0.04, bpFreq: 6800,  vol: -22 },
      crash: { decay: 0.9,  vol: -18 },
      // v92: bass / chord / vocal profile params
      bass:  { filterFreq: 480, filterQ: 1.4, drive: 0.08, driveWet: 0.45,
               envRelease: 0.15, postLpFreq: 1400, portamento: 0.018 },
      chord: { oscType: "triangle", attack: 0.018, decay: 0.32, release: 0.5,
               chorusWet: 0.40, autoPanFreq: 0.18, autoPanDepth: 0.32, verbWet: 0.20 },
      vocal: { harmonicity: 2.4, vibratoFreq: 5.0, vibratoCents: 10,
               formant1: 700, formant2: 1200, hpFreq: 200, verbWet: 0.22 }
    },
    "sakanaction": {
      label: "Sakanaction (dance rock — tight kick / clicky hat)",
      kick:  { decay: 0.20, octaves: 5.0,  vol: -6,  clickVol: -22 },
      snare: { decay: 0.09, hpFreq: 1600,  vol: -10, rimVol: -24 },
      hat:   { decay: 0.028, bpFreq: 8200, vol: -20 },
      crash: { decay: 1.1,  vol: -16 },
      // Bright synth bass with snappy filter env, glassy pad, clean vocal
      bass:  { filterFreq: 720, filterQ: 2.2, drive: 0.04, driveWet: 0.35,
               envRelease: 0.08, postLpFreq: 2400, portamento: 0.008 },
      chord: { oscType: "sawtooth", attack: 0.008, decay: 0.20, release: 0.35,
               chorusWet: 0.55, autoPanFreq: 0.35, autoPanDepth: 0.42, verbWet: 0.16 },
      vocal: { harmonicity: 2.0, vibratoFreq: 4.0, vibratoCents: 6,
               formant1: 850, formant2: 1500, hpFreq: 280, verbWet: 0.14 }
    },
    "lcd-motorik": {
      label: "LCD motorik (4-on-floor / cowbell / pad swell)",
      kick:  { decay: 0.38, octaves: 6.0,  vol: -5,  clickVol: -28 },
      snare: { decay: 0.18, hpFreq: 950,   vol: -8,  rimVol: -26 },
      hat:   { decay: 0.06, bpFreq: 5800,  vol: -19 },
      crash: { decay: 1.3,  vol: -14 },
      // Sub-y bass with portamento, dreamy pad swell, breathy vocal
      bass:  { filterFreq: 600, filterQ: 1.6, drive: 0.06, driveWet: 0.42,
               envRelease: 0.22, postLpFreq: 1600, portamento: 0.04 },
      chord: { oscType: "triangle", attack: 0.040, decay: 0.55, release: 0.85,
               chorusWet: 0.48, autoPanFreq: 0.10, autoPanDepth: 0.28, verbWet: 0.34 },
      vocal: { harmonicity: 2.6, vibratoFreq: 5.5, vibratoCents: 14,
               formant1: 650, formant2: 1100, hpFreq: 180, verbWet: 0.32 }
    },
    "cramps-punk": {
      label: "Cramps punk (Human Fly / boomy / rockabilly slap)",
      kick:  { decay: 0.40, octaves: 5.5,  vol: -7,  clickVol: -36 },
      snare: { decay: 0.22, hpFreq: 800,   vol: -10, rimVol: -22 },
      hat:   { decay: 0.05, bpFreq: 5200,  vol: -24 },
      crash: { decay: 1.6,  vol: -15 },
      // Distorted slap bass, square stab chord, snarled vocal
      bass:  { filterFreq: 380, filterQ: 1.8, drive: 0.18, driveWet: 0.70,
               envRelease: 0.10, postLpFreq: 1200, portamento: 0.02 },
      chord: { oscType: "square", attack: 0.005, decay: 0.18, release: 0.25,
               chorusWet: 0.22, autoPanFreq: 0.06, autoPanDepth: 0.18, verbWet: 0.12 },
      vocal: { harmonicity: 3.0, vibratoFreq: 6.5, vibratoCents: 18,
               formant1: 560, formant2: 1400, hpFreq: 260, verbWet: 0.18 }
    },
    "lofi-nujabes": {
      label: "Lofi Nujabes (jazzy boom-bap + warm piano)",
      // v109: Nujabes 感を音色そのもので。dusty drum + walking sub bass +
      // piano chord (Salamander 推奨, linked via master preset) + warm vocal.
      // Drum: tight kick, body-rich snare (low HP), brushed hat, ride-friendly crash
      kick:  { decay: 0.28, octaves: 4.5, vol: -7,  clickVol: -28 },
      snare: { decay: 0.16, hpFreq: 900,  vol: -11, rimVol: -30 },
      hat:   { decay: 0.05, bpFreq: 6200, vol: -23 },
      crash: { decay: 1.2,  vol: -17 },
      // Bass: warm upright-ish, slow filter env, soft portamento for walking feel
      bass:  { filterFreq: 380, filterQ: 1.0, drive: 0.04, driveWet: 0.30,
               envRelease: 0.30, postLpFreq: 1200, portamento: 0.06 },
      // Chord: soft triangle pad with long release + verb (用 fallback when
      // sampler not loaded; master preset auto-switches chord_instrument to
      // salamander-piano which takes over via Tone.Sampler)
      chord: { oscType: "triangle", attack: 0.030, decay: 0.45, release: 0.75,
               chorusWet: 0.20, autoPanFreq: 0.08, autoPanDepth: 0.15, verbWet: 0.28 },
      // Vocal: warm formants, gentle vibrato, healthy verb tail (jazzy)
      vocal: { harmonicity: 2.2, vibratoFreq: 4.5, vibratoCents: 8,
               formant1: 720, formant2: 1300, hpFreq: 220, verbWet: 0.34 }
    }
  };

  function currentProfile() {
    return KIT_PROFILES[state.kitProfile] || KIT_PROFILES["default"];
  }

  // v93: master mix presets — one click swaps the whole master chain
  // (reverb / width / tape warmth / loudness sliders) to a genre vibe.
  // These map to the existing slider IDs so the existing event handlers
  // re-fire and the values persist via v78 localStorage.
  const MASTER_PRESETS = {
    "neutral":  { reverb: 16, width: 62, warmth: 7, loudness: -1,
                  synth_profile: "default",
                  chord_instrument: "", bass_instrument: "",
                  guitar_instrument: "", voice_instrument: "",
                  kit_source: null, guitar_on: true },
    "lo-fi":    { reverb: 24, width: 58, warmth: 18, loudness: -2,
                  synth_profile: "lofi-nujabes",
                  chord_instrument: "salamander-piano",
                  bass_instrument: "salamander-bass",
                  guitar_instrument: "guitar-nylon",
                  voice_instrument: "flute",
                  kit_source: "online/tone-breakbeat",
                  guitar_on: false },
    "club":     { reverb: 8, width: 74, warmth: 12, loudness: +1,
                  synth_profile: "sakanaction",
                  chord_instrument: "", bass_instrument: "",
                  guitar_instrument: "guitar-electric",
                  voice_instrument: "",
                  kit_source: "online/dirt-808",
                  guitar_on: true },
    "rock":     { reverb: 10, width: 58, warmth: 9, loudness: 0,
                  synth_profile: "cramps-punk",
                  chord_instrument: "", bass_instrument: "bass-electric",
                  guitar_instrument: "guitar-electric",
                  voice_instrument: "",
                  kit_source: "online/tone-acoustic",
                  guitar_on: true },
    "ambient":  { reverb: 44, width: 78, warmth: 16, loudness: -3,
                  synth_profile: "lcd-motorik",
                  chord_instrument: "salamander-piano",
                  bass_instrument: "salamander-bass",
                  guitar_instrument: "guitar-nylon",
                  voice_instrument: "cello",
                  kit_source: null,
                  guitar_on: false }
  };

  // v95: A/B state compare — capture all slider/toggle/profile/mode/master
  // preset into a snapshot. Two slots (A, B). Click A or B to recall.
  // Useful for "this profile vs that profile" or "club vs lo-fi" A/B.
  const abSnapshots = { A: null, B: null };

  function captureSnapshot() {
    const snap = {
      mode: currentMode,
      kitSource: state.kitSource,
      kitProfile: state.kitProfile,
      sliders: {},
      toggles: {}
    };
    document.querySelectorAll('#br-main input[type="range"]').forEach((el) => {
      if (el.id) snap.sliders[el.id] = el.value;
    });
    document.querySelectorAll('#br-main input[type="checkbox"]').forEach((el) => {
      if (el.id) snap.toggles[el.id] = el.checked;
    });
    return snap;
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    Object.entries(snap.sliders || {}).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = v;
        el.dispatchEvent(new Event("input"));
      }
    });
    Object.entries(snap.toggles || {}).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el && el.type === "checkbox") {
        el.checked = !!v;
        el.dispatchEvent(new Event("change"));
      }
    });
    if (snap.mode) {
      const r = document.querySelector(`input[name=br-mode][value="${snap.mode}"]`);
      if (r) { r.checked = true; r.dispatchEvent(new Event("change")); }
    }
    if (snap.kitProfile) {
      const psel = $("br-kit-profile-select");
      if (psel) { psel.value = snap.kitProfile; psel.dispatchEvent(new Event("change")); }
    }
    if (snap.kitSource) {
      const ksel = $("br-kit-source-select");
      if (ksel) { ksel.value = snap.kitSource; ksel.dispatchEvent(new Event("change")); }
    }
  }

  function applyMasterPreset(name) {
    const p = MASTER_PRESETS[name];
    if (!p) return;
    const map = {
      "br-space-reverb": p.reverb,
      "br-space-width":  p.width,
      "br-tape-warmth":  p.warmth,
      "br-loudness":     p.loudness
    };
    Object.entries(map).forEach(([id, v]) => {
      const el = $(id);
      if (!el) return;
      el.value = String(v);
      el.dispatchEvent(new Event("input"));
    });
    // v109/v110: linked synth profile + bass/chord instrument + kit + guitar toggle
    // 全部音色の中身を入れ替えるための連動
    if (p.synth_profile !== undefined) {
      const psel = $("br-kit-profile-select");
      if (psel && psel.value !== p.synth_profile) {
        psel.value = p.synth_profile;
        psel.dispatchEvent(new Event("change"));
      }
    }
    if (p.chord_instrument !== undefined) {
      const csel = $("br-chord-instrument-select");
      if (csel && csel.value !== p.chord_instrument) {
        csel.value = p.chord_instrument;
        csel.dispatchEvent(new Event("change"));
      }
    }
    if (p.bass_instrument !== undefined) {
      const bsel = $("br-bass-instrument-select");
      if (bsel && bsel.value !== p.bass_instrument) {
        bsel.value = p.bass_instrument;
        bsel.dispatchEvent(new Event("change"));
      }
    }
    // v111: linked guitar + voice instruments
    if (p.guitar_instrument !== undefined) {
      const gsel = $("br-guitar-instrument-select");
      if (gsel && gsel.value !== p.guitar_instrument) {
        gsel.value = p.guitar_instrument;
        gsel.dispatchEvent(new Event("change"));
      }
    }
    if (p.voice_instrument !== undefined) {
      const vsel = $("br-voice-instrument-select");
      if (vsel && vsel.value !== p.voice_instrument) {
        vsel.value = p.voice_instrument;
        vsel.dispatchEvent(new Event("change"));
      }
    }
    if (p.kit_source !== undefined && p.kit_source !== null) {
      const ksel = $("br-kit-source-select");
      if (ksel && ksel.value !== p.kit_source) {
        ksel.value = p.kit_source;
        ksel.dispatchEvent(new Event("change"));
      }
    }
    if (p.guitar_on !== undefined) {
      const g = $("br-toggle-guitar");
      if (g && g.checked !== p.guitar_on) {
        g.checked = p.guitar_on;
        g.dispatchEvent(new Event("change"));
      }
    }
  }

  function makeDrumKit(target, profileName) {
    const p = KIT_PROFILES[profileName] || KIT_PROFILES["default"];
    // Kick: punchy modern, deep & tight (LCD/dance + rock)
    const kickPan = new Tone.Panner(0).connect(target);
    const kickClick = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.012 },
      volume: p.kick.clickVol
    }).connect(kickPan);
    const kickBody = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: p.kick.octaves,
      envelope: { attack: 0.001, decay: p.kick.decay, sustain: 0, release: 0.15 },
      volume: p.kick.vol
    }).connect(kickPan);
    const kick = {
      triggerAttackRelease(_note, _dur, time, vel) {
        const t = Math.max(time, Tone.now() + 0.005);
        kickBody.triggerAttackRelease("C1", "8n", t, clamp(vel, 0.04, 0.98));
        kickClick.triggerAttackRelease("128n", t, clamp(vel * 0.18, 0.01, 0.2));
      }
    };

    // Snare: tight rock snare with crisp pop + body
    const snarePan = new Tone.Panner(-0.06).connect(target);
    const snareBus = new Tone.Gain(0.85).connect(snarePan);
    const snareHp = new Tone.Filter({ frequency: p.snare.hpFreq, type: "highpass", Q: 0.8 }).connect(snareBus);
    const snareBody = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: p.snare.decay, sustain: 0, release: 0.06 },
      volume: p.snare.vol
    }).connect(snareHp);
    const snareRim = new Tone.MetalSynth({
      frequency: 165,
      envelope: { attack: 0.001, decay: 0.04, release: 0.02 },
      harmonicity: 2.4,
      modulationIndex: 5,
      resonance: 1800,
      octaves: 0.5,
      volume: p.snare.rimVol
    }).connect(snareBus);
    const snare = {
      triggerAttackRelease(_d, time, vel) {
        const t = Math.max(time, Tone.now() + 0.005);
        const v = clamp(vel, 0.05, 0.95);
        snareBody.triggerAttackRelease("16n", t, v);
        snareRim.triggerAttackRelease("64n", t + 0.005, v * 0.4);
      }
    };

    // Hi-hat: bright, LCD-style 8th pulse
    const hatPan = new Tone.Panner(0.22).connect(target);
    const hatBus = new Tone.Gain(0.6).connect(hatPan);
    const hatBp = new Tone.Filter({ frequency: p.hat.bpFreq, type: "bandpass", Q: 2.4 }).connect(hatBus);
    const hatNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: p.hat.decay, sustain: 0, release: 0.018 },
      volume: p.hat.vol
    }).connect(hatBp);
    const hat = {
      triggerAttackRelease(_d, time, vel) {
        const t = Math.max(time, Tone.now() + 0.003);
        hatNoise.triggerAttackRelease("64n", t, clamp(vel, 0.02, 0.55));
      }
    };

    // Ghost: serves as clap + cowbell + general percussion (event role decides)
    // For tabasco-rock, mostly clap + cowbell
    const ghostPan = new Tone.Panner(-0.16).connect(target);
    const clapBus = new Tone.Gain(0.7).connect(ghostPan);
    const clapBp = new Tone.Filter({ frequency: 1200, type: "bandpass", Q: 1.5 }).connect(clapBus);
    const clapBody = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.04 },
      volume: -18
    }).connect(clapBp);
    const cowbell = new Tone.MetalSynth({
      frequency: 540,
      envelope: { attack: 0.001, decay: 0.18, release: 0.04 },
      harmonicity: 3.2,
      modulationIndex: 8,
      resonance: 2400,
      octaves: 1.2,
      volume: -22
    }).connect(ghostPan);
    const ghost = {
      triggerAttackRelease(_d, time, vel, role) {
        const t = Math.max(time, Tone.now() + 0.004);
        const v = clamp(vel, 0.04, 0.7);
        if (role && role.indexOf("cowbell") >= 0) {
          cowbell.triggerAttackRelease("16n", t, v * 0.9);
        } else {
          // clap / generic ghost
          clapBody.triggerAttackRelease("32n", t, v);
        }
      }
    };

    // Fill: tom for fills
    const fillPan = new Tone.Panner(0.12).connect(target);
    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 2.4,
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.12 },
      volume: -14
    }).connect(fillPan);
    const fill = {
      triggerAttackRelease(_d, time, vel) {
        const t = Math.max(time, Tone.now() + 0.004);
        tom.triggerAttackRelease("E2", "16n", t, clamp(vel, 0.05, 0.9));
      }
    };

    // Crash
    const crashPan = new Tone.Panner(0.20).connect(target);
    const crash = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: p.crash.decay, sustain: 0, release: 0.6 },
      volume: p.crash.vol
    }).connect(crashPan);
    const crashFilter = new Tone.Filter({ frequency: 4200, type: "highpass", Q: 0.6 });
    // Re-route crash through filter for shimmer
    crash.disconnect();
    crash.connect(crashFilter);
    crashFilter.connect(crashPan);
    const crashWrap = {
      triggerAttackRelease(_d, time, vel) {
        const t = Math.max(time, Tone.now() + 0.005);
        crash.triggerAttackRelease("2n", t, clamp(vel, 0.06, 0.85));
      }
    };

    return { kick, snare, hat, ghost, fill, crash: crashWrap };
  }

  // ---- Velocity-sensitive sampler wrapper -----------------------
  // v126: 真の multi-velocity (forte/mezzo/piano 別 wav) は CDN サンプル元が
  // 1 layer しか持ってないので不可能。代わりに velocity に応じて
  // LP filter cutoff を動かして "強く弾いたらブライト、弱く弾いたらダーク"
  // を演出する fake multi-velocity。
  //
  // Use case: catalog 経由の Sampler を wrap して触感を上げる。
  //   const s = makeVelocitySensitiveSampler({ urls, baseRelease: 0.8,
  //                                            volume: -6, minCutoff: 1200,
  //                                            maxCutoff: 8000 });
  //   s.connect(target);
  //   s.triggerAttackRelease(note, dur, time, vel);
  function makeVelocitySensitiveSampler(opts) {
    const minCutoff = opts.minCutoff ?? 1200;
    const maxCutoff = opts.maxCutoff ?? 8000;
    const filter = new Tone.Filter({ frequency: maxCutoff, type: "lowpass", Q: 0.6 });
    const sampler = new Tone.Sampler({
      urls: opts.urls,
      release: opts.baseRelease ?? 0.6,
      volume: opts.volume ?? -6
    }).connect(filter);
    return {
      _filter: filter,
      _sampler: sampler,
      connect(target) { filter.connect(target); return this; },
      triggerAttackRelease(note, dur, time, vel) {
        // vel 0..1 → cutoff minCutoff..maxCutoff (linear interp)
        const v = Math.max(0, Math.min(1, vel ?? 0.5));
        const cutoff = minCutoff + v * (maxCutoff - minCutoff);
        try {
          // setValueAtTime 直前にセット (audio thread と sync)
          filter.frequency.setValueAtTime(cutoff, Math.max(time - 0.001, Tone.now()));
        } catch (e) {}
        try { sampler.triggerAttackRelease(note, dur, time, vel); } catch (e) {}
      },
      triggerRelease(note, time = Tone.now()) {
        try { sampler.triggerRelease(note, time); } catch (e) {}
      },
      releaseAll(time = Tone.now()) {
        try {
          if (typeof sampler.releaseAll === "function") sampler.releaseAll(time);
        } catch (e) {}
      },
      dispose() {
        try { sampler.dispose(); } catch (e) {}
        try { filter.dispose(); } catch (e) {}
      }
    };
  }

  // ---- Synth bass ----------------------------------------------

  function makeSynthBass(target) {
    // v110: if bassInstrument is set to a sampler in catalog.instruments[],
    // use real samples (e.g. salamander-bass = piano left-hand register).
    // Falls back to profile-aware synth bass otherwise.
    const b = currentProfile().bass;
    const post = new Tone.Filter({ frequency: b.postLpFreq, type: "lowpass", Q: 0.6 }).connect(target);

    if (state.bassInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.bassInstrument);
      if (instDef && instDef.kind === "sampler") {
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, p]) => {
          urls[note] = instDef.base_url + p;
        });
        // v126: velocity-sensitive — 強く弾いたらブライト、弱く弾いたらダーク
        const sampler = makeVelocitySensitiveSampler({
          urls, baseRelease: 0.4, volume: -4,
          minCutoff: 600, maxCutoff: 3200
        });
        sampler.connect(post);
        return sampler;
      }
    }

    // synth fallback
    const drive = new Tone.Distortion({ distortion: b.drive, wet: b.driveWet, oversample: "2x" }).connect(post);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: b.filterFreq, Q: b.filterQ },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.6, release: b.envRelease },
      filterEnvelope: { attack: 0.003, decay: 0.12, sustain: 0.5, release: 0.12, baseFrequency: 120, octaves: 2.6 },
      portamento: b.portamento,
      volume: -10
    }).connect(drive);
    return bass;
  }

  // ---- Original-stem players (Demucs-separated playback) ------
  // Loads 4 mp3 stems (vocals/drums/bass/other) for the current song.
  // Each plays via Tone.Player → individual stem bus → masterGain
  // (compressor + EQ3 + limiter applied = built-in remaster).
  //
  // All 4 start in sync via shared start time; section state machine
  // keeps running in parallel for UI display (chord, lyric, section).

  function setStemsStatus(text) {
    const el = $("br-stems-status");
    if (el) el.textContent = text || "";
  }

  function disposeStemPlayers() {
    Object.keys(stemPlayers).forEach((k) => {
      const p = stemPlayers[k];
      if (p) {
        try { p.stop(); } catch (e) {}
        try { p.dispose(); } catch (e) {}
      }
      stemPlayers[k] = null;
    });
    state.loadedStemDurationSec = 0;
  }

  function currentBand() {
    if (!state.bandsRegistry) return null;
    return state.bandsRegistry.bands[state.currentBandId] || null;
  }

  function currentBandSongMeta(songId = state.currentSongId) {
    const band = currentBand();
    if (!Array.isArray(band?.songs)) return null;
    return band.songs.find((song) => song.id === songId) || null;
  }

  function songCatalogDurationSec(songId = state.currentSongId) {
    const duration = Number(currentBandSongMeta(songId)?.duration_s);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  function songStructureDurationSec() {
    if (!state.songData || !Array.isArray(state.songData.structure)) return 0;
    const bpm = Number(state.songData.bpm) || 117;
    const totalBars = state.songData.structure.reduce((sum, section) => sum + (Number(section.bars) || 0), 0);
    return totalBars > 0 ? totalBars * (60 / bpm * 4) : 0;
  }

  function playerDurationSeconds(player) {
    const candidates = [
      player?.buffer?.duration,
      player?.buffer?._buffer?.duration,
      player?.buffer?.get?.()?.duration
    ];
    const duration = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
    return duration ? Number(duration) : 0;
  }

  function loadedStemDurationSec() {
    return Object.values(stemPlayers).reduce((max, player) => {
      return Math.max(max, playerDurationSeconds(player));
    }, 0);
  }

  function playbackDurationSec() {
    const catalogDuration = songCatalogDurationSec();
    const stemDuration = state.loadedStemDurationSec || loadedStemDurationSec();
    const structureDuration = songStructureDurationSec();
    return Math.max(catalogDuration, stemDuration, structureDuration);
  }

  function fullSongDurationGuardSec() {
    if (currentMode !== "stems") return 0;
    const stemDuration = state.loadedStemDurationSec || loadedStemDurationSec();
    const catalogDuration = songCatalogDurationSec();
    return Math.max(stemDuration, catalogDuration);
  }

  function playbackRateMultiplier() {
    const tempoMult = Number($("br-tempo-mult")?.value || 100) / 100;
    return Number.isFinite(tempoMult) && tempoMult > 0 ? tempoMult : 1;
  }

  function audioClockSeconds() {
    try {
      const raw = Tone.context?.rawContext || Tone.context?._context || Tone.context?.context || Tone.context;
      const value = raw?.currentTime ?? Tone.now?.();
      return Number.isFinite(Number(value)) ? Number(value) : 0;
    } catch (e) {
      return 0;
    }
  }

  function playbackContentElapsedSec() {
    if (!state.playbackStartedAtMs) return state.playbackStartOffsetSec || 0;
    const audioNow = audioClockSeconds();
    const audioStart = Number(state.playbackStartedAtAudioSec);
    const audioElapsed = Number.isFinite(audioStart) ? Math.max(0, audioNow - audioStart) : 0;
    const rate = Number(state.playbackRateAtStart) > 0 ? Number(state.playbackRateAtStart) : playbackRateMultiplier();
    return (state.playbackStartOffsetSec || 0) + audioElapsed * rate;
  }

  function resetPlaybackClock(offsetSec = state.playbackStartOffsetSec || 0) {
    state.playbackStartOffsetSec = Math.max(0, Number(offsetSec) || 0);
    state.playbackStartedAtMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    state.playbackStartedAtAudioSec = audioClockSeconds();
    state.playbackRateAtStart = playbackRateMultiplier();
  }

  function formatPlaybackTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function clampPlaybackSecond(seconds) {
    const raw = Math.max(0, Number(seconds) || 0);
    const duration = playbackDurationSec();
    if (!duration) return raw;
    return clamp(raw, 0, Math.max(0, duration - 0.05));
  }

  function timelineStateForSecond(seconds) {
    const structure = state.songData?.structure;
    if (!Array.isArray(structure) || structure.length === 0) {
      return { barCount: 0, sectionIdx: 0, sectionBarStart: 0 };
    }
    const bpm = Number(state.songData?.bpm) || 117;
    const barDur = 60 / bpm * 4;
    const rawBar = Math.max(0, Math.floor((Number(seconds) || 0) / Math.max(0.001, barDur)));
    let cursor = 0;
    for (let idx = 0; idx < structure.length; idx++) {
      const bars = Math.max(0, Number(structure[idx]?.bars) || 0);
      const isLast = idx === structure.length - 1;
      if (rawBar < cursor + bars || isLast) {
        const lastBarInSection = Math.max(cursor, cursor + Math.max(1, bars) - 1);
        return {
          barCount: Math.min(rawBar, lastBarInSection),
          sectionIdx: idx,
          sectionBarStart: cursor
        };
      }
      cursor += bars;
    }
    return { barCount: 0, sectionIdx: 0, sectionBarStart: 0 };
  }

  function setTimelineStateForSecond(seconds, options = {}) {
    const targetSec = clampPlaybackSecond(seconds);
    const mapped = timelineStateForSecond(targetSec);
    state.barCount = mapped.barCount;
    state.sectionIdx = mapped.sectionIdx;
    state.sectionBarStart = mapped.sectionBarStart;
    state.pendingSeekOffsetSec = targetSec;
    state.playbackStartOffsetSec = targetSec;
    if (options.syncTransport !== false) {
      try { Tone.Transport.seconds = targetSec; } catch (e) {}
    }
    updateSectionDisplay();
    updateChordDisplay();
    const sec = currentSection();
    if (sec && options.updateLyrics !== false) updateLyricsHighlight(sec.section);
    return targetSec;
  }

  function restartCurrentAudioAt(offsetSec) {
    const targetSec = clampPlaybackSecond(offsetSec);
    releaseSustainedSynths("timeline-seek");
    if (currentMode === "stems") {
      stopStemPlayback();
      stopExternalVocal();
      ["drums", "bass", "other"].forEach((s) => stopExternalStem(s));
      startStemPlayback(targetSec);
      startExternalVocalIfEnabled(targetSec);
      ["drums", "bass", "other"].forEach((s) => startExternalStemIfEnabled(s, targetSec));
    }
    state.lastStemResyncAtMs = 0;
    return targetSec;
  }

  function updateSongTimelineDisplay(previewSec = null) {
    const seek = $("br-song-seek");
    const elapsedEl = $("br-song-elapsed");
    const durationEl = $("br-song-duration");
    const duration = playbackDurationSec();
    let elapsed = previewSec != null
      ? Number(previewSec) || 0
      : (state.started ? playbackContentElapsedSec() : (state.pendingSeekOffsetSec || state.playbackStartOffsetSec || 0));
    if (transportSeekActive && previewSec == null && seek) elapsed = Number(seek.value) || elapsed;
    const shown = duration ? clamp(elapsed, 0, duration) : Math.max(0, elapsed);

    if (elapsedEl) elapsedEl.textContent = formatPlaybackTime(shown);
    if (durationEl) durationEl.textContent = formatPlaybackTime(duration);
    if (seek) {
      seek.max = duration > 0 ? duration.toFixed(1) : "0";
      seek.disabled = !state.songData || duration <= 0;
      if (!transportSeekActive || previewSec != null) seek.value = duration ? shown.toFixed(1) : "0";
      const pct = duration ? clamp((shown / duration) * 100, 0, 100) : 0;
      seek.style.setProperty("--br-seek-pct", `${pct.toFixed(2)}%`);
    }
    try {
      if (duration > 0 && "mediaSession" in navigator && typeof navigator.mediaSession.setPositionState === "function") {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: playbackRateMultiplier(),
          position: clamp(shown, 0, duration)
        });
      }
    } catch (e) {}
  }

  function startTransportProgress() {
    cancelAnimationFrame(transportProgressRaf);
    const tick = () => {
      updateSongTimelineDisplay();
      const duration = playbackDurationSec();
      if (state.started && duration && playbackContentElapsedSec() >= duration - 0.15) {
        queueAutoAdvanceToNextSong();
      }
      if (state.started) transportProgressRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopTransportProgress() {
    cancelAnimationFrame(transportProgressRaf);
    transportProgressRaf = 0;
    updateSongTimelineDisplay();
  }

  function seekToPlaybackSecond(seconds, options = {}) {
    if (!state.songData) return 0;
    clearAutoAdvanceTimer();
    const targetSec = setTimelineStateForSecond(seconds);
    if (state.started) {
      resetPlaybackClock(targetSec);
      restartCurrentAudioAt(targetSec);
      updateMediaSession("playing");
    } else if (options.autoplay) {
      startPlayback({ preservePosition: true });
    }
    updateSongTimelineDisplay(targetSec);
    return targetSec;
  }

  function autoAdvanceDelayMsForFullSong() {
    const guardSec = fullSongDurationGuardSec();
    if (!guardSec) return 0;
    const elapsed = playbackContentElapsedSec();
    const remainingContent = guardSec - elapsed;
    if (remainingContent <= 0.75) return 0;
    return Math.ceil((remainingContent / playbackRateMultiplier() + 0.35) * 1000);
  }

  function shouldDelayAutoAdvanceForFullSong() {
    return autoAdvanceDelayMsForFullSong() > 0;
  }

  async function loadStemsForSong(songId) {
    if (!stemBus.vocals) ensureMaster();
    disposeStemPlayers();
    const band = currentBand();
    if (!band) {
      setStemsStatus("(no band loaded)");
      return false;
    }
    setStemsStatus("loading stems…");
    const stems = ["vocals", "drums", "bass", "other"];
    const stemsDir = band.stems_dir || "presets/tabasco-stems";
    const promises = stems.map(async (stem) => {
      const url = `${stemsDir}/${songId}/${stem}.mp3`;
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (!head.ok) return null;
        // Route via per-stem EQ chain (v66). EQ output already wired to:
        //   - bus → master (drums/bass/other)
        //   - vocalChorus (vocals)
        const target = stemEQs[stem] ? stemEQs[stem].input : stemBus[stem];
        // v152: album-flow playback advances to the next track at song end.
        // Keep stems non-looping so the audio does not wrap underneath.
        const player = new Tone.Player({
          url, autostart: false, fadeIn: 0.15, fadeOut: 0.30, loop: false
        }).connect(target);
        await Tone.loaded();
        return { stem, player };
      } catch (e) {
        return null;
      }
    });
    const results = await Promise.all(promises);
    let loaded = 0;
    results.forEach((r) => {
      if (r) { stemPlayers[r.stem] = r.player; loaded++; }
    });
    state.loadedStemDurationSec = loadedStemDurationSec();
    updateSongTimelineDisplay();
    if (loaded === 0) {
      setStemsStatus("(stems not available — switch to AI 再現 mode)");
      return false;
    }
    setStemsStatus(`stems loaded (${loaded}/4)`);
    return true;
  }

  function startStemPlayback(offsetSec = 0) {
    if (!stemPlayers.vocals && !stemPlayers.drums && !stemPlayers.bass && !stemPlayers.other) return false;
    // Sync start: schedule all at the same Transport position
    const startAt = "+0.15";  // small delay so all loaded buffers can fire together
    // v76: apply current tempo slider to playbackRate at start
    const tempoMult = Number($("br-tempo-mult")?.value || 100) / 100;
    Object.entries(stemPlayers).forEach(([stem, player]) => {
      if (!player) return;
      try {
        const enabled = $("br-toggle-stem-" + stem)?.checked !== false;
        const muteVal = !enabled;
        player.mute = muteVal;
        player.playbackRate = tempoMult;
        // v104: offsetSec lets us start mid-song (jumpToSection auto-start)
        if (offsetSec > 0) {
          player.start(startAt, offsetSec);
        } else {
          player.start(startAt);
        }
      } catch (e) {
        console.warn("[Band Room] stem start failed:", stem, e);
      }
    });
    return true;
  }

  function stopStemPlayback() {
    Object.values(stemPlayers).forEach((player) => {
      if (player) {
        try { player.stop(); } catch (e) {}
      }
    });
  }

  // ---- Sampled drum kit (Tone.Player per voice) ----------------
  // Loads wav samples from presets/sample-kits/<source>/<song>/ and
  // exposes the same interface as makeDrumKit (kick/snare/hat/ghost/
  // fill/crash with triggerAttackRelease). Lets drum-floor frames play
  // through actual recorded drum hits instead of Tone.MembraneSynth etc.
  //
  // Each voice = Tone.Player + Tone.Gain (velocity scaling).

  function makeSampleVoice(target, url) {
    const gain = new Tone.Gain(1).connect(target);
    const player = new Tone.Player({ url, autostart: false, retrigger: true }).connect(gain);
    return {
      _player: player, _gain: gain, _url: url,
      triggerAttackRelease(_note, _dur, time, vel) {
        try {
          gain.gain.cancelScheduledValues(time);
          gain.gain.setValueAtTime(Math.max(0.05, Math.min(1.0, vel || 0.5)), time);
          player.start(time);
        } catch (e) {}
      },
      dispose() {
        try { player.dispose(); } catch (e) {}
        try { gain.dispose(); } catch (e) {}
      }
    };
  }

  async function buildKitForSource(source) {
    if (!drumBus) ensureMaster();
    if (drumKit && drumKit.dispose) {
      try { drumKit.dispose(); } catch (e) {}
    }
    // v99: build the base kit first, then layer per-voice overrides on top.
    const baseKit = await buildBaseKit(source);
    const overrideKit = await applyVoiceOverrides(baseKit);
    return overrideKit;
  }

  // v99: build the underlying kit (synth or sample/online) without overrides
  async function buildBaseKit(source) {
    const resolved = resolveKitSource(source);
    if (resolved === "synth" || !resolved) {
      return makeDrumKit(drumBus, state.kitProfile || "default");
    }
    if (resolved.startsWith("online/")) {
      const kitId = resolved.substring("online/".length);
      const catalog = state.onlineCatalog;
      const kitDef = catalog && catalog.kits ? catalog.kits.find((k) => k.id === kitId) : null;
      if (!kitDef) {
        console.warn("[Band Room] online kit not found:", kitId);
        return makeDrumKit(drumBus, state.kitProfile || "default");
      }
      const voicesMap = {};
      Object.entries(kitDef.voices).forEach(([voice, path]) => {
        voicesMap[voice] = kitDef.base_url + path;
      });
      const kit = makeRemoteKit(drumBus, voicesMap, kitId);
      try { await Tone.loaded(); } catch (e) {}
      return kit;
    }
    const kitPath = `presets/sample-kits/${resolved}`;
    const kit = makeSampledKit(drumBus, kitPath);
    try { await Tone.loaded(); } catch (e) {}
    return kit;
  }

  // v99: build a single voice (drum hit) from any kit id, return the
  // voice object + the panner so callers can dispose later.
  async function buildOneVoice(voice, kitId) {
    if (!kitId || !drumBus) return null;
    const PANS = { kick: 0.00, snare: -0.06, hat: 0.22, ghost: -0.16, fill: 0.12, crash: 0.20 };
    const pan = PANS[voice] !== undefined ? PANS[voice] : 0;
    if (kitId.startsWith("online/")) {
      const id = kitId.substring("online/".length);
      const kitDef = state.onlineCatalog?.kits?.find((k) => k.id === id);
      if (!kitDef || !kitDef.voices[voice]) return null;
      const panner = new Tone.Panner(pan).connect(drumBus);
      const url = kitDef.base_url + kitDef.voices[voice];
      const v = makeSampleVoice(panner, url);
      try { await Tone.loaded(); } catch (e) {}
      return { voice: v, panner };
    }
    // Local sample kit — read from presets/sample-kits/<kitId>/<voice>-NN.wav
    const resolved = resolveKitSource(kitId);
    if (resolved === "synth") return null;  // can't override one voice with synth alone
    const fnameMap = { kick: "kick-01.wav", snare: "snare-01.wav", hat: "hat-01.wav",
                       ghost: "snare-03.wav", fill: "snare-02.wav", crash: "crash-01.wav" };
    const url = `presets/sample-kits/${resolved}/${fnameMap[voice]}`;
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) return null;
    } catch (e) { return null; }
    const panner = new Tone.Panner(pan).connect(drumBus);
    const v = makeSampleVoice(panner, url);
    try { await Tone.loaded(); } catch (e) {}
    return { voice: v, panner };
  }

  // v99: layer per-voice overrides on top of a base kit. Returns a new
  // kit object with the overridden voices swapped in; the original base
  // voices for overridden slots are disposed.
  async function applyVoiceOverrides(baseKit) {
    if (!state.voiceOverrides) return baseKit;
    const replacements = {};
    const newPanners = [];
    for (const [voice, kitId] of Object.entries(state.voiceOverrides)) {
      if (!kitId) continue;
      const result = await buildOneVoice(voice, kitId);
      if (result) {
        replacements[voice] = result.voice;
        newPanners.push(result.panner);
      }
    }
    if (Object.keys(replacements).length === 0) return baseKit;
    // Compose: keep base voices for non-overridden, swap in replacements
    const merged = Object.assign({}, baseKit);
    Object.entries(replacements).forEach(([voice, v]) => {
      // Dispose the base voice that's being overridden
      if (baseKit[voice] && baseKit[voice].dispose) {
        try { baseKit[voice].dispose(); } catch (e) {}
      }
      merged[voice] = v;
    });
    const originalDispose = baseKit.dispose;
    merged.dispose = () => {
      try { originalDispose && originalDispose(); } catch (e) {}
      Object.values(replacements).forEach((v) => { try { v.dispose && v.dispose(); } catch (e) {} });
      newPanners.forEach((p) => { try { p.dispose(); } catch (e) {} });
    };
    return merged;
  }

  // v97: remote drum kit — build a sample kit from a voice→URL map
  // (URLs typically point to public CDNs like jsDelivr or tonejs.github.io).
  // Same Panner layout as makeSampledKit, but accepts arbitrary URLs
  // instead of a local kitPath + standard filenames.
  function makeRemoteKit(target, voicesMap, kitId) {
    const PANS = { kick: 0.00, snare: -0.06, hat: 0.22, ghost: -0.16, fill: 0.12, crash: 0.20 };
    const voices = {};
    const panners = [];
    Object.entries(voicesMap).forEach(([voice, url]) => {
      if (!url) return;
      const pan = PANS[voice] !== undefined ? PANS[voice] : 0;
      const panner = new Tone.Panner(pan).connect(target);
      panners.push(panner);
      voices[voice] = makeSampleVoice(panner, url);
    });
    voices._kitPath = "online/" + kitId;
    voices._panners = panners;
    voices.dispose = () => {
      Object.values(voices).forEach((v) => v && v.dispose && v.dispose());
      panners.forEach((p) => { try { p.dispose(); } catch (e) {} });
    };
    return voices;
  }

  function makeSampledKit(target, kitPath) {
    // kitPath e.g. "presets/sample-kits/unripe/continuous"
    // Map drum-frames instrument names → sample files, with stereo pan
    // (v69: same spatial layout as synth kit so sample mode is also wide)
    const mapping = {
      kick:  { fname: "kick-01.wav",  pan:  0.00 },
      snare: { fname: "snare-01.wav", pan: -0.06 },
      hat:   { fname: "hat-01.wav",   pan: +0.22 },
      ghost: { fname: "snare-03.wav", pan: -0.16 },
      fill:  { fname: "snare-02.wav", pan: +0.12 },
      crash: { fname: "crash-01.wav", pan: +0.20 }
    };
    const voices = {};
    const panners = [];
    Object.entries(mapping).forEach(([k, { fname, pan }]) => {
      const panner = new Tone.Panner(pan).connect(target);
      panners.push(panner);
      voices[k] = makeSampleVoice(panner, `${kitPath}/${fname}`);
    });
    voices._kitPath = kitPath;
    voices._panners = panners;
    voices.dispose = () => {
      Object.values(voices).forEach((v) => v && v.dispose && v.dispose());
      panners.forEach((p) => { try { p.dispose(); } catch (e) {} });
    };
    return voices;
  }

  // ---- Distorted guitar (UNRIPE hardcore-postpunk drive) ------
  // Power chord (root + 5th + octave), saw + distortion + LP shimmer.
  // Section-aware picking: silent intro / palm-mute 8th verse / open
  // prechorus / 16th chorus / sparse bridge / hit outro.
  function makeGuitar(target) {
    // v111: if guitarInstrument is set to a catalog sampler, use real samples.
    // Less distortion + softer chain than synth fallback (real samples already
    // have body and harmonic content).
    if (state.guitarInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.guitarInstrument);
      if (instDef && instDef.kind === "sampler") {
        const verb = new Tone.Reverb({ decay: 1.2, wet: 0.12 }).connect(target);
        const lp = new Tone.Filter({ frequency: 6000, type: "lowpass", Q: 0.5 }).connect(verb);
        // Light distortion only on electric variant
        const isElectric = instDef.id.includes("electric");
        let chainIn = lp;
        if (isElectric) {
          const dist = new Tone.Distortion({ distortion: 0.18, wet: 0.32, oversample: "2x" }).connect(lp);
          chainIn = dist;
        }
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, p]) => {
          urls[note] = instDef.base_url + p;
        });
        // v126: velocity-sensitive — guitar は強く弾けばブライトに、弱く弾けば
        // 柔らかく。electric guitar の muting / strumming nuance に対応
        const sampler = makeVelocitySensitiveSampler({
          urls, baseRelease: 0.5, volume: -6,
          minCutoff: 1500, maxCutoff: 7000
        });
        sampler.connect(chainIn);
        return sampler;
      }
    }

    // v70 synth fallback: PolySynth saw + heavy distortion
    const chorus = new Tone.Chorus({ frequency: 0.9, delayTime: 3.2, depth: 0.38, wet: 0.34 }).start();
    const dist = new Tone.Distortion({ distortion: 0.55, wet: 0.85, oversample: "2x" });
    const lp = new Tone.Filter({ frequency: 4200, type: "lowpass", Q: 0.6 });
    const verb = new Tone.Reverb({ decay: 1.0, wet: 0.14 });
    const guitar = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.003, decay: 0.10, sustain: 0.55, release: 0.16 },
      volume: -12
    });
    guitar.maxPolyphony = 6;
    guitar.connect(chorus);
    chorus.connect(dist);
    dist.connect(lp);
    lp.connect(verb);
    verb.connect(target);
    return guitar;
  }

  function powerChordNotes(chord, octave = 3) {
    // Power chord = root + 5th + root octave up. Major/minor agnostic.
    const m = chord.match(/^([A-G][b#]?)/);
    if (!m) return [];
    const root = m[1];
    const NOTE_SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const rootSemi = NOTE_SEMI[root];
    if (rootSemi == null) return [];
    const base = rootSemi + octave * 12;
    return [semiToNote(base), semiToNote(base + 7), semiToNote(base + 12)];
  }

  // ---- Vocal guide ("voice-box" formant synth) ----------------
  // Not real AI-sung vocal — that needs Suno/Udio/Bark which can't run
  // in browser. This is an "おーあー" 母音 melodic guide: AMSynth +
  // dual formant band-pass filters approximating an "ah/oh" vowel, with
  // light vibrato. User sings their own words on top.
  //
  // For full AI-synthesized vocal: generate via Suno externally, save
  // mp3, drop into presets/vocals/{song-id}.mp3, then load via a
  // future HTMLAudio layer.
  function makeVoiceBox(target) {
    // v111: if voiceInstrument is set to a catalog sampler, use it
    // (typically violin / cello / flute for "lead melody as instrument").
    // This bypasses the formant-vowel synth path entirely and gives the
    // melody guide a real instrumental voice — Nujabes/J Dilla flute lead,
    // RHRN cello, etc.
    if (state.voiceInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.voiceInstrument);
      if (instDef && instDef.kind === "sampler") {
        const verb = new Tone.Reverb({ decay: 1.8, wet: 0.28 }).connect(target);
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, p]) => {
          urls[note] = instDef.base_url + p;
        });
        // v126: velocity-sensitive — melody lead (violin / cello / flute) は
        // 強く吹けばブライト、弱く吹けば柔らかい音色変化
        const sampler = makeVelocitySensitiveSampler({
          urls, baseRelease: 0.8, volume: -6,
          minCutoff: 1800, maxCutoff: 9000
        });
        sampler.connect(verb);
        return sampler;
      }
    }

    // v92 synth fallback: AMSynth + dual formant (vowel-ish "ah")
    const v = currentProfile().vocal;
    const verb = new Tone.Reverb({ decay: 1.6, wet: v.verbWet }).connect(target);
    const hp = new Tone.Filter({ frequency: v.hpFreq, type: "highpass", Q: 0.5 }).connect(verb);
    const mix = new Tone.Gain(0.9).connect(hp);
    const formant1 = new Tone.Filter({ frequency: v.formant1, type: "bandpass", Q: 5 }).connect(mix);
    const formant2 = new Tone.Filter({ frequency: v.formant2, type: "bandpass", Q: 5 }).connect(mix);

    const voice = new Tone.AMSynth({
      harmonicity: v.harmonicity,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.06, decay: 0.32, sustain: 0.65, release: 0.45 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.4 },
      volume: -14  // v104: was -10, lowered so vocal guide doesn't dominate
    });
    voice.connect(formant1);
    voice.connect(formant2);

    const vibrato = new Tone.LFO({ frequency: v.vibratoFreq, min: -v.vibratoCents, max: v.vibratoCents });
    try { vibrato.connect(voice.detune); vibrato.start(); } catch (e) {}

    return voice;
  }

  // Human Fly chorus melody — hook line over G | D | Em | C 4-bar
  // Repeats through 16-bar chorus. Notes are in G major.
  // Encoded as: { sub16 (0-15 position in bar), note, dur (in 16th steps), syllable (hint only) }
  const HUMAN_FLY_VOCAL_MELODY = {
    // 4-bar chorus phrase, repeated 4x in 16-bar chorus
    chorus: [
      // bar 0: G chord — "Hu-man fly, hu-man fly"
      [
        { sub: 0,  note: "B4", dur: 2, syl: "Hu" },
        { sub: 2,  note: "G4", dur: 2, syl: "man" },
        { sub: 4,  note: "D5", dur: 4, syl: "fly" },
        { sub: 10, note: "B4", dur: 2, syl: "hu" },
        { sub: 12, note: "G4", dur: 2, syl: "man" },
        { sub: 14, note: "D5", dur: 2, syl: "fly" }
      ],
      // bar 1: D chord — "Cut the rope, cut the wire"
      [
        { sub: 0,  note: "A4", dur: 2, syl: "Cut" },
        { sub: 2,  note: "F#4",dur: 2, syl: "the" },
        { sub: 4,  note: "D5", dur: 4, syl: "rope" },
        { sub: 10, note: "B4", dur: 2, syl: "cut" },
        { sub: 12, note: "A4", dur: 2, syl: "the" },
        { sub: 14, note: "D5", dur: 2, syl: "wire" }
      ],
      // bar 2: Em chord — "ぶっ飛んで go away"
      [
        { sub: 0, note: "E5", dur: 2, syl: "bu" },
        { sub: 2, note: "D5", dur: 2, syl: "tton" },
        { sub: 4, note: "B4", dur: 2, syl: "de" },
        { sub: 6, note: "G4", dur: 2, syl: "go" },
        { sub: 8, note: "B4", dur: 8, syl: "way" }
      ],
      // bar 3: C chord — long hold "Human fly~"
      [
        { sub: 0,  note: "C5", dur: 4, syl: "Hu" },
        { sub: 4,  note: "B4", dur: 4, syl: "man" },
        { sub: 8,  note: "G4", dur: 8, syl: "fly" }
      ]
    ]
  };

  // ---- Chord synth ---------------------------------------------

  function makeChordSynth(target) {
    // v92: profile-aware chord synth.
    // v101: if state.chordInstrument is set to an "instruments[]" catalog
    //   entry id (e.g. "salamander-piano"), use Tone.Sampler with that
    //   sample set instead of Tone.PolySynth.
    const c = currentProfile().chord;
    const verb = new Tone.Reverb({ decay: 1.6, wet: c.verbWet }).connect(target);
    const autoPan = new Tone.AutoPanner({ frequency: c.autoPanFreq, depth: c.autoPanDepth }).connect(verb).start();
    const chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 4.5, depth: 0.45, wet: c.chorusWet }).start();
    chorus.connect(autoPan);

    if (state.chordInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.chordInstrument);
      if (instDef && instDef.kind === "sampler") {
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, path]) => {
          urls[note] = instDef.base_url + path;
        });
        // v126: velocity-sensitive — piano voicing で弱く弾いた chord は
        // 柔らかく、強く弾いた chord はブライトに (jazz comping の表情)
        const sampler = makeVelocitySensitiveSampler({
          urls, baseRelease: 1.2, volume: -8,
          minCutoff: 2000, maxCutoff: 9000
        });
        sampler.connect(chorus);
        return sampler;
      }
    }

    const chord = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: c.oscType },
      envelope: { attack: c.attack, decay: c.decay, sustain: 0.45, release: c.release },
      volume: -12  // v104: was -16, raised so chord pad anchors the mix
    }).connect(chorus);
    chord.maxPolyphony = 6;
    return chord;
  }

  // ---- Click ---------------------------------------------------

  function makeClick(target) {
    const click = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.01 },
      volume: -12
    }).connect(target);
    return click;
  }

  // ---- Utils --------------------------------------------------

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function $(id) { return document.getElementById(id); }

  function chordToNotes(chord, octave = 3) {
    // Parse "G", "Em", "Am", "C", "D", "Dm", "Bb", "F#m", etc.
    const m = chord.match(/^([A-G][b#]?)(m|maj|min|sus|7|maj7|m7)?/);
    if (!m) return [];
    const root = m[1];
    const quality = m[2] || "";
    const NOTE_SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const rootSemi = NOTE_SEMI[root];
    if (rootSemi == null) return [];
    const isMinor = quality.startsWith("m") && !quality.startsWith("maj");
    const third = isMinor ? 3 : 4;
    const fifth = 7;
    const seventh = quality === "7" ? 10 : quality === "maj7" ? 11 : quality === "m7" ? 10 : null;
    const semis = [0, third, fifth];
    if (seventh != null) semis.push(seventh);
    return semis.map((s) => semiToNote(rootSemi + s + octave * 12));
  }
  function semiToNote(semi) {
    const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const oct = Math.floor(semi / 12);
    return NAMES[semi % 12] + oct;
  }

  function chordRoot(chord) {
    const m = chord.match(/^([A-G][b#]?)/);
    if (!m) return "G2";
    const NOTE_SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const semi = NOTE_SEMI[m[1]] ?? 7;
    return semiToNote(semi + 2 * 12); // C2 baseline
  }

  function firstSongForBand(band) {
    return Array.isArray(band?.songs) ? band.songs[0] || null : null;
  }

  function adjacentSongInBand(band, currentSongId, delta) {
    const songs = Array.isArray(band?.songs) ? band.songs : [];
    const idx = songs.findIndex((song) => song.id === currentSongId);
    if (idx < 0) return null;
    return songs[idx + delta] || null;
  }

  if (typeof window !== "undefined") {
    window.BandRoomTestHooks = Object.assign(window.BandRoomTestHooks || {}, {
      chordRoot,
      normalizedDrumFloorSection,
      migratePrefsForCurrentMix,
      firstSongIdForBand: (band) => firstSongForBand(band)?.id || null,
      adjacentSongIdInBand: (band, currentSongId, delta) => (
        adjacentSongInBand(band, currentSongId, delta)?.id || null
      )
    });
  }

  // v112: return absolute semitone of chord root at bass register (octave 2)
  function chordToSemi(chord) {
    const m = chord.match(/^([A-G][b#]?)/);
    if (!m) return null;
    const NOTE_SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const s = NOTE_SEMI[m[1]];
    if (s == null) return null;
    return s + 2 * 12;  // C2 baseline
  }

  // ---- Load song ----------------------------------------------

  async function loadSong(songId, options = {}) {
    const switchSeq = options.switchSeq;
    const band = currentBand();
    if (!band) {
      $("br-lyrics-body").textContent = "(no band loaded)";
      return null;
    }
    const pattern = band.drum_frames_pattern || "presets/drum-frames-tabasco-{songid}.json";
    const url = pattern.replace("{songid}", songId) + `?cb=${Date.now()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const data = await res.json();
      if (switchSeq != null && switchSeq !== songSwitchSeq) return null;
      state.songData = data;
      state.currentSongId = songId;
      state.barCount = 0;
      state.sectionIdx = 0;
      state.sectionBarStart = 0;
      state.pendingSeekOffsetSec = 0;
      state.playbackStartOffsetSec = 0;
      updateSongTimelineDisplay(0);
      $("br-bpm").textContent = data.bpm || "—";
      $("br-key").textContent = data.key || "—";
      renderSectionNav();  // v75: clickable section list
      refreshDrumFloorLink();
      updateMediaSession(state.started ? "playing" : "paused");  // v85: refresh OS metadata
      // Load lyrics from the band's lyrics_doc if present
      const lyricsDoc = band.lyrics_doc;
      if (lyricsDoc) {
        try {
          const lyricsRes = await fetch(lyricsDoc + "?cb=" + Date.now());
          if (lyricsRes.ok) {
            const md = await lyricsRes.text();
            if (switchSeq != null && switchSeq !== songSwitchSeq) return null;
            const lyrics = extractLyricsForSong(md, data.song_title || songId);
            // v73: render as section blocks for auto-highlight + scroll
            renderLyricBlocks(lyrics || `(lyrics todo — see ${lyricsDoc})`);
          }
        } catch (e) {
          renderLyricBlocks("(lyrics file not available offline)");
        }
      } else {
        renderLyricBlocks("(no lyrics doc for this band yet)");
      }
      return data;
    } catch (e) {
      console.warn("[Band Room] loadSong failed:", e);
      $("br-lyrics-body").textContent = "(failed to load song data: " + e.message + ")";
      return null;
    }
  }

  function syncTrackButtons() {
    document.querySelectorAll("#br-track-select button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.song === state.currentSongId ? "true" : "false");
    });
  }

  function disposeAutoSelfKitForSongChange() {
    if (state.kitSource === "auto-self" && drumKit && drumKit.dispose) {
      try { drumKit.dispose(); } catch (e) {}
      drumKit = null;
    }
  }

  function nextSongAfterCurrent() {
    return adjacentSongInBand(currentBand(), state.currentSongId, 1);
  }

  function previousSongBeforeCurrent() {
    return adjacentSongInBand(currentBand(), state.currentSongId, -1);
  }

  function queueAutoAdvanceToNextSong() {
    if (autoAdvanceInFlight) return;
    if (!state.started) return;
    const queuedSongId = state.currentSongId;
    autoAdvanceInFlight = true;
    const run = () => {
      autoAdvanceTimer = 0;
      advanceToNextSong(queuedSongId).finally(() => {
        autoAdvanceInFlight = false;
      });
    };
    const delayMs = autoAdvanceDelayMsForFullSong();
    if (delayMs > 0) {
      autoAdvanceTimer = setTimeout(run, delayMs);
    } else if (typeof queueMicrotask === "function") queueMicrotask(run);
    else setTimeout(run, 0);
  }

  function clearAutoAdvanceTimer() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = 0;
    }
    autoAdvanceInFlight = false;
  }

  async function advanceToNextSong(queuedSongId) {
    if (!state.started || state.currentSongId !== queuedSongId) return;
    if (shouldDelayAutoAdvanceForFullSong()) {
      autoAdvanceInFlight = false;
      queueAutoAdvanceToNextSong();
      return;
    }
    const nextSong = nextSongAfterCurrent();
    if (!nextSong) {
      stopPlayback({ resetPosition: true });
      return;
    }
    await switchToSong(nextSong.id, { autoAdvance: true, keepBackgroundBridge: true });
  }

  async function switchToSong(songId, options = {}) {
    if (!songId) return false;
    if (songId === state.currentSongId && state.songData) {
      syncTrackButtons();
      return true;
    }

    clearAutoAdvanceTimer();
    const switchSeq = ++songSwitchSeq;
    const wasPlaying = state.started;
    const keepBridge = wasPlaying && options.keepBackgroundBridge === true;
    if (wasPlaying) {
      if (options.fadeStems) {
        Object.values(stemPlayers).forEach((p) => {
          if (p) { try { p.stop(); } catch (e) {} }
        });
        await new Promise((resolve) => setTimeout(resolve, 320));
      }
      stopPlayback({ keepBackgroundBridge: keepBridge, updateMedia: false });
    }

    const loaded = await loadSong(songId, { switchSeq });
    if (switchSeq !== songSwitchSeq) return false;
    if (!loaded) {
      syncTrackButtons();
      if (keepBridge) stopBackgroundAudioBridge();
      updateMediaSession("paused");
      return false;
    }
    clearLoopRange();
    refreshLoopVisuals();
    syncTrackButtons();
    renderPhraseTrigger();
    disposeAutoSelfKitForSongChange();
    if (wasPlaying && options.restart !== false) {
      await startPlayback({ autoAdvance: options.autoAdvance === true });
    }
    return true;
  }

  async function selectAdjacentSong(delta) {
    const target = delta > 0 ? nextSongAfterCurrent() : previousSongBeforeCurrent();
    if (!target) {
      if (delta < 0 && state.songData) jumpToSection(0);
      return false;
    }
    return switchToSong(target.id, { fadeStems: true, keepBackgroundBridge: true });
  }

  function extractLyricsForSong(md, songTitle) {
    // Match "## NN <Title>" headings
    const lines = md.split("\n");
    const titleRe = new RegExp(`^##\\s+\\d+\\s+${escapeRegex(songTitle).split(" ")[0]}`, "i");
    let start = -1, end = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (start === -1 && titleRe.test(lines[i])) start = i;
      else if (start !== -1 && /^##\s+\d+\s+/.test(lines[i])) { end = i; break; }
    }
    if (start === -1) return null;
    return lines.slice(start, end).join("\n").trim();
  }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // v73: render lyrics text as section blocks. Each line starting with
  // [...] becomes a new block with data-marker set to the slug. Other
  // lines accumulate into the previous block's body.
  function renderLyricBlocks(text) {
    const body = $("br-lyrics-body");
    if (!body) return;
    body.innerHTML = "";
    if (!text) return;
    const lines = text.split("\n");
    let curBlock = null;
    let curBody = [];
    function flush() {
      if (!curBlock) return;
      const pre = document.createElement("pre");
      pre.className = "br-lyric-text";
      pre.textContent = curBody.join("\n").trimEnd();
      curBlock.appendChild(pre);
      body.appendChild(curBlock);
      curBlock = null;
      curBody = [];
    }
    // v127: accept both `[chorus]` inline tags AND `### chorus` markdown
    // H3 headers as section markers. ``` code fences are skipped (lyrics
    // block content inside ``` is treated as plain body text).
    let inFence = false;
    for (const ln of lines) {
      // Skip markdown code fence delimiters and don't parse markers inside
      if (/^```/.test(ln)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        if (!curBlock) {
          curBlock = document.createElement("div");
          curBlock.className = "br-lyric-block br-lyric-preamble";
          curBlock.dataset.marker = "preamble";
        }
        curBody.push(ln);
        continue;
      }
      // Section marker: [chorus] or ### chorus
      const inline = ln.match(/^\s*\[(.+?)\]\s*$/);
      const h3 = ln.match(/^###\s+(.+?)\s*$/);
      const m = inline || h3;
      if (m) {
        const raw = m[1].trim();
        // Skip non-section H3 like "### まとめ" — only accept English section words
        // (verse / chorus / bridge / intro / outro / pre-chorus / chant / break / interlude)
        const looksLikeSection = inline ||
          /^(verse|chorus|bridge|intro|outro|pre-chorus|prechorus|chant|break|interlude|hook)/i.test(raw);
        if (!looksLikeSection) {
          // Not a lyric section header — treat as body
          if (!curBlock) {
            curBlock = document.createElement("div");
            curBlock.className = "br-lyric-block br-lyric-preamble";
            curBlock.dataset.marker = "preamble";
          }
          curBody.push(ln);
          continue;
        }
        flush();
        curBlock = document.createElement("div");
        curBlock.className = "br-lyric-block";
        curBlock.dataset.marker = raw.toLowerCase().replace(/\s+/g, "-");
        const head = document.createElement("div");
        head.className = "br-lyric-marker";
        head.textContent = inline ? "[" + raw + "]" : raw;
        curBlock.appendChild(head);
      } else {
        if (!curBlock) {
          // text before first marker — wrap in a preamble block
          curBlock = document.createElement("div");
          curBlock.className = "br-lyric-block br-lyric-preamble";
          curBlock.dataset.marker = "preamble";
        }
        curBody.push(ln);
      }
    }
    flush();
  }

  // v73: highlight lyric block matching current section. Fuzzy: try
  // exact section match first, then base name (chorus-2 → chorus).
  function updateLyricsHighlight(sectionName) {
    const body = $("br-lyrics-body");
    if (!body || !sectionName) return;
    const blocks = body.querySelectorAll(".br-lyric-block");
    if (blocks.length === 0) return;
    const sec = sectionName.toLowerCase();
    const base = sec.split("-")[0];
    const idxMatch = sec.match(/-(\d+)$/);
    const secIdx = idxMatch ? idxMatch[1] : null;  // "verse-2" → "2"

    let match = null;
    // 1. Exact slug match (rarely true for Burroughs lyrics which have
    //    longer markers like "verse-1-—-flat-narration")
    blocks.forEach((b) => {
      if (!match && b.dataset.marker === sec) match = b;
    });
    // 2. v107: index-aware fuzzy — marker starts with "base-idx"
    //    followed by either end of string or "-" (avoids "verse-12"
    //    matching when secIdx=1). Distinguishes "verse 1" / "verse 2".
    if (!match && secIdx) {
      const prefix = base + "-" + secIdx;
      blocks.forEach((b) => {
        if (match) return;
        const m = b.dataset.marker;
        if (m === prefix || m.startsWith(prefix + "-")) match = b;
      });
    }
    // 3. Generic fallback: first block whose marker starts with the base
    if (!match) {
      blocks.forEach((b) => {
        if (!match && b.dataset.marker.startsWith(base)) match = b;
      });
    }
    blocks.forEach((b) => b.classList.toggle("active", b === match));
    if (match) {
      try { match.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
    }
  }

  // ---- Section state machine ----------------------------------

  function currentSection() {
    if (!state.songData || !state.songData.structure) return null;
    const s = state.songData.structure;
    if (state.sectionIdx >= s.length) return null;
    return s[state.sectionIdx];
  }

  function currentFrame() {
    const sec = currentSection();
    if (!sec || !state.songData) return null;
    return state.songData.frames.find((f) => f.id === sec.frame_id);
  }

  function normalizedDrumFloorSection(section) {
    const value = String(section || "").toLowerCase();
    if (value.includes("chorus") || value.includes("chant") || value.includes("hook")) return "chorus";
    if (value.includes("bridge") || value.includes("break") || value.includes("middle")) return "bridge";
    if (value.includes("outro") || value.includes("end")) return "end";
    return "verse";
  }

  function compactDrumFloorEvents(frame, limit = 64) {
    const events = Array.isArray(frame?.events) ? frame.events : [];
    return events.slice(0, limit).map((evt) => ({
      instrument: String(evt.instrument || "hit"),
      beat: Number(evt.beat) || 0,
      sub: Number(evt.sub) || 0,
      velocity: Number.isFinite(Number(evt.velocity)) ? Number(Number(evt.velocity).toFixed(3)) : 0.5,
      microMs: Number.isFinite(Number(evt.microMs)) ? Math.round(Number(evt.microMs)) : 0,
      role: evt.role ? String(evt.role) : ""
    }));
  }

  function drumFloorFrameMetrics(frame) {
    const events = Array.isArray(frame?.events) ? frame.events : [];
    const count = events.length;
    const velocities = events
      .map((evt) => Number(evt.velocity))
      .filter((value) => Number.isFinite(value));
    const avgVelocity = velocities.length
      ? velocities.reduce((sum, value) => sum + value, 0) / velocities.length
      : 0.52;
    const density = clamp(count / 36, 0.12, 0.92);
    const pressure = clamp(avgVelocity * 0.72 + density * 0.22 + (events.some((evt) => evt.instrument === "crash") ? 0.06 : 0), 0.12, 0.94);
    const ghost = clamp(events.filter((evt) => evt.instrument === "ghost").length / Math.max(count, 1), 0, 0.9);
    const micro = clamp(events.reduce((sum, evt) => sum + Math.abs(Number(evt.microMs) || 0), 0) / Math.max(count, 1) / 42, 0, 1);
    return { density, pressure, ghost, micro };
  }

  function buildBandRoomDrumFloorPacket() {
    const band = currentBand();
    const section = currentSection();
    const frame = currentFrame();
    const data = state.songData || {};
    const metrics = drumFloorFrameMetrics(frame);
    const bpm = Number(data.bpm) || 100;
    const sectionName = section?.section || frame?.session_role || "verse";
    const normalizedSection = normalizedDrumFloorSection(sectionName);
    const style = metrics.pressure > 0.68
      ? "ghost_pressure"
      : (bpm >= 118 && metrics.density > 0.5 ? "dry_grid" : "soft_pocket");
    const createdAt = new Date();
    const songId = state.currentSongId || data.song_id || "unknown-song";
    const masterVol = Number($("br-master-vol")?.value || 80);

    return {
      version: 1,
      source_repo: "Music",
      created_at: createdAt.toISOString(),
      session_id: `band-room-${state.currentBandId || "band"}-${songId}-${createdAt.getTime()}`,
      mode: "band_room",
      reference_gradient: {
        weights: {
          haze: 0.16,
          memory: 0.48,
          micro: Number(metrics.micro.toFixed(3)),
          ghost: Number(metrics.ghost.toFixed(3)),
          chrome: 0.12,
          organic: 0.78
        }
      },
      ucm_state: {
        energy: Math.round(clamp(metrics.density * 74 + metrics.pressure * 26, 18, 96)),
        wave: 34,
        mind: 24,
        creation: 56,
        void: normalizedSection === "bridge" ? 32 : 12,
        circle: normalizedSection === "chorus" ? 52 : 34,
        body: Math.round(clamp(metrics.pressure * 100, 12, 94)),
        resource: Math.round(clamp(metrics.density * 78 + metrics.ghost * 14, 18, 92)),
        observer: 24
      },
      output_state: {
        output_level: clamp(masterVol, 0, 100),
        recorder_duration: 0,
        review_boost: Number(clamp(metrics.pressure * 0.7 + metrics.density * 0.3, 0, 1).toFixed(3))
      },
      performance_state: {
        active_pad: normalizedSection,
        recent_pads: [normalizedSection, "band-room", currentMode],
        manual_influence_active: true,
        automix_enabled: false,
        mic_follow: {
          enabled: false,
          status: "not-used",
          metadata_only: true,
          stores_audio: false
        },
        radio_brain: {
          program: "band-room",
          reason: "Band Room current song and drum frame handoff.",
          metadata_only: true
        },
        hazama_fm: null
      },
      music_intent: {
        timbre: ["band-room", currentMode, state.kitSource || "auto-self"],
        rhythm: ["current-drum-frame", frame?.id || "unknown-frame", style],
        space: ["manual-preview", "no-autostart"],
        structure: [sectionName, normalizedSection, `${section?.bars || frame?.barLength || 4}-bars`],
        gesture: ["practice-room", "human-gated"],
        safety: ["metadata-only", "no-audio", "manual-start-required"]
      },
      routing: {
        drum_floor: {
          enabled: true,
          groove_intent: {
            style,
            ghost_notes: Number(metrics.ghost.toFixed(3)),
            micro: Number(metrics.micro.toFixed(3)),
            articulation: "band_room_frame",
            review_only: true
          },
          density: Number(metrics.density.toFixed(3)),
          pressure: Number(metrics.pressure.toFixed(3)),
          section: normalizedSection,
          source_song: {
            band_id: state.currentBandId,
            band_name: band?.name || "",
            song_id: songId,
            song_title: data.song_title || songId,
            bpm,
            key: data.key || "",
            source_section: sectionName,
            frame_id: frame?.id || section?.frame_id || "",
            drum_events_preview: compactDrumFloorEvents(frame)
          },
          review_reason: "Band Room footer handoff: open drum-floor with the current song/frame as a manual preview candidate.",
          review_only: true
        },
        namima: {
          enabled: false,
          mood_intent: { mood: "not-targeted", review_only: true },
          family_safe: true,
          water_motion: 0,
          brightness: 0,
          review_reason: "Band Room drum handoff targets drum-floor only.",
          review_only: true
        },
        chill: {
          enabled: false,
          trio_intent: { reference_id: "band-room", flow_on: false, bass_on: false, drums_suggested: false, review_only: true },
          piano_memory: 0,
          bass_activity: 0,
          drum_support: 0,
          section: normalizedSection,
          review_reason: "Band Room drum handoff targets drum-floor only.",
          review_only: true
        },
        openclaw: {
          enabled: true,
          promotion_status: "draft",
          human_review_required: true,
          next_action: {
            destination: "drum_floor",
            label: "drum-floor",
            reason: "Band Room current groove is ready for safe drum-floor preview.",
            action: "Open drum-floor and press playback manually if the translated kit/pocket looks useful.",
            confidence: 0.74,
            manual_start_required: true,
            metadata_only: true
          }
        }
      },
      safety: {
        stores_audio: false,
        stores_samples: false,
        stores_lyrics: false,
        metadata_only: true,
        human_review_required: true
      }
    };
  }

  function drumFloorUrlForPacket(packet) {
    let url;
    try {
      url = new URL(DRUM_FLOOR_URL, window.location?.href || DRUM_FLOOR_URL);
    } catch (e) {
      return DRUM_FLOOR_URL;
    }
    const sourceSong = packet?.routing?.drum_floor?.source_song || {};
    url.searchParams.set("from", "band-room");
    if (sourceSong.band_id) url.searchParams.set("band", sourceSong.band_id);
    if (sourceSong.song_id) url.searchParams.set("song", sourceSong.song_id);
    if (sourceSong.bpm) url.searchParams.set("bpm", String(sourceSong.bpm));
    if (sourceSong.source_section) url.searchParams.set("section", sourceSong.source_section);
    if (sourceSong.frame_id) url.searchParams.set("frame", sourceSong.frame_id);
    return url.toString();
  }

  function refreshDrumFloorLink(packet = null) {
    const link = $("br-open-drum-floor");
    if (!link) return;
    const nextPacket = packet || buildBandRoomDrumFloorPacket();
    link.href = drumFloorUrlForPacket(nextPacket);
    const sourceSong = nextPacket.routing?.drum_floor?.source_song || {};
    link.setAttribute("aria-label", `Open Drum Floor for ${sourceSong.song_title || "current Band Room song"}`);
  }

  function publishBandRoomDrumFloorHandoff() {
    const packet = buildBandRoomDrumFloorPacket();
    const payload = {
      schema: "qb.music-stack.packet-sync.v1",
      type: "music-session-packet",
      source: "Band Room",
      sent_at: new Date().toISOString(),
      packet
    };
    try {
      window.localStorage?.setItem(MUSIC_STACK_PACKET_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("[Band Room] drum-floor handoff localStorage failed:", error);
    }
    try {
      if (typeof window.BroadcastChannel === "function") {
        const channel = new window.BroadcastChannel(MUSIC_STACK_CHANNEL_NAME);
        channel.postMessage(payload);
        channel.close();
      }
    } catch (error) {
      console.warn("[Band Room] drum-floor handoff broadcast failed:", error);
    }
    try {
      window.dispatchEvent(new CustomEvent("music-stack-packet-sync", { detail: payload }));
    } catch (error) {}
    refreshDrumFloorLink(packet);
    console.info("[Band Room] drum-floor handoff", {
      song: packet.routing.drum_floor.source_song.song_id,
      frame: packet.routing.drum_floor.source_song.frame_id,
      section: packet.routing.drum_floor.section
    });
    return payload;
  }

  function updateSectionDisplay() {
    const sec = currentSection();
    if (!sec) {
      $("br-section-name").textContent = "—";
      $("br-section-progress").textContent = "—";
      $("br-section-next-name").textContent = "—";
      refreshDrumFloorLink();
      return;
    }
    $("br-section-name").textContent = sec.section;
    const barInSection = clamp(state.barCount - state.sectionBarStart + 1, 1, Math.max(1, Number(sec.bars) || 1));
    $("br-section-progress").textContent = `${barInSection} / ${sec.bars} bars`;
    const nextSec = state.songData.structure[state.sectionIdx + 1];
    $("br-section-next-name").textContent = nextSec ? nextSec.section : "(end)";
    // v75: refresh section nav chip active state
    document.querySelectorAll("#br-section-nav button").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.idx) === state.sectionIdx);
    });
    refreshDrumFloorLink();
  }

  // v75: render clickable section chips. Each chip jumps the playback
  // head to that section's start in both Transport time and stem buffer
  // offset (so stems re-seek and stay in sync with the visible section).
  // v80: shift-click sets A-B loop range (first shift-click = A,
  // second = B). Normal click clears the range and jumps.
  function renderSectionNav() {
    const nav = $("br-section-nav");
    if (!nav) return;
    nav.innerHTML = "";
    if (!state.songData || !state.songData.structure) return;
    state.songData.structure.forEach((sec, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.idx = String(idx);
      btn.textContent = sec.section;
      btn.title = `${sec.bars} bars · shift-click で A→B ループ`;
      if (idx === state.sectionIdx) btn.classList.add("active");
      btn.addEventListener("click", (e) => {
        if (e.shiftKey) {
          setLoopRange(idx);
          refreshLoopVisuals();
        } else {
          clearLoopRange();
          refreshLoopVisuals();
          jumpToSection(idx);
        }
      });
      nav.appendChild(btn);
    });
    refreshLoopVisuals();
  }

  function setLoopRange(idx) {
    if (state.loopA == null) {
      state.loopA = idx;
      state.loopB = null;
    } else if (state.loopB == null) {
      // Order them: A is earlier, B is later
      if (idx < state.loopA) {
        state.loopB = state.loopA;
        state.loopA = idx;
      } else if (idx === state.loopA) {
        // Same idx clicked twice → single-section loop
        state.loopB = idx;
      } else {
        state.loopB = idx;
      }
    } else {
      // Both set → reset and start a fresh A
      state.loopA = idx;
      state.loopB = null;
    }
  }

  function clearLoopRange() {
    state.loopA = null;
    state.loopB = null;
  }

  function refreshLoopVisuals() {
    document.querySelectorAll("#br-section-nav button").forEach((b) => {
      const i = Number(b.dataset.idx);
      b.classList.toggle("loop-a", state.loopA != null && i === state.loopA);
      b.classList.toggle("loop-b", state.loopB != null && i === state.loopB);
      const inRange = state.loopA != null && state.loopB != null &&
                      i > state.loopA && i < state.loopB;
      b.classList.toggle("loop-in-range", inRange);
    });
  }

  function jumpToSection(idx) {
    if (!state.songData || !state.songData.structure) return;
    if (idx < 0 || idx >= state.songData.structure.length) return;
    // Compute cumulative bars to this section start
    let cum = 0;
    for (let i = 0; i < idx; i++) cum += state.songData.structure[i].bars;
    const bpm = state.songData.bpm || 117;
    const barDur = 60 / bpm * 4;
    const targetSec = cum * barDur;
    clearAutoAdvanceTimer();
    setTimelineStateForSecond(targetSec);
    if (state.started) {
      resetPlaybackClock(targetSec);
      restartCurrentAudioAt(targetSec);
    } else {
      // v104: 停止中なら、そのセクションから自動再生開始する
      startPlayback({ preservePosition: true });
    }
    updateSectionDisplay();
    const sec = currentSection();
    if (sec) updateLyricsHighlight(sec.section);
  }

  function updateChordDisplay() {
    const sec = currentSection();
    if (!sec || !state.songData.chord_progression) {
      $("br-chord-current").textContent = "—";
      return;
    }
    // v105 fix: chord_progression keys are sometimes "verse-1" / "verse-2"
    // (Hey, Sister, Under the Moon), sometimes "verse" (early Tabasco JSON).
    // Try the full section name first, then fall back to the base name.
    const cp = state.songData.chord_progression;
    const baseSection = sec.section.split("-")[0]; // "verse-1" → "verse"
    const prog = cp[sec.section] || cp[baseSection];
    if (!prog) { $("br-chord-current").textContent = "—"; return; }
    const barInSection = state.barCount - state.sectionBarStart;
    // Sum chord durations until we find which chord this bar lands on
    let cursor = 0;
    for (const [chord, bars] of prog) {
      if (barInSection < cursor + bars) {
        $("br-chord-current").textContent = chord;
        return chord;
      }
      cursor += bars;
    }
    // Loop the progression
    const loopedBar = barInSection % cursor;
    cursor = 0;
    for (const [chord, bars] of prog) {
      if (loopedBar < cursor + bars) {
        $("br-chord-current").textContent = chord;
        return chord;
      }
      cursor += bars;
    }
    return null;
  }

  // ---- Source-derived AI part agents ---------------------------
  // v166: Each synth part gets its own tiny "agent" that reads the current
  // song's extracted drum-frame events plus chord/section state. This keeps
  // AI 再現 tied to the original song instead of free-running generic loops.

  function eventStep16(evt) {
    const beat = Math.max(0, Math.min(3, Math.floor(Number(evt?.beat) || 0)));
    const sub = Math.max(0, Math.min(3, Math.floor(Number(evt?.sub) || 0)));
    return beat * 4 + sub;
  }

  function eventVelocity(evt, fallback = 0.5) {
    const value = Number(evt?.velocity);
    return clamp(Number.isFinite(value) ? value : fallback, 0.04, 1);
  }

  function roleForPartAgent(sec, frame) {
    const raw = String(frame?.session_role || sec?.section || "").toLowerCase();
    if (raw.includes("intro")) return "intro";
    if (raw.includes("outro") || raw.includes("end")) return "outro";
    if (raw.includes("break") || raw.includes("bridge")) return "break";
    if (raw.includes("comp") || raw.includes("pre")) return "comp";
    if (raw.includes("chorus") || raw.includes("chant") || raw.includes("recap") || raw.includes("hook")) return "recap";
    return "verse";
  }

  function sourceAccentSteps(ctx, instruments, minVelocity = 0.28) {
    const wanted = new Set(instruments);
    const byStep = new Map();
    ctx.events.forEach((evt) => {
      if (!wanted.has(evt.instrument)) return;
      const vel = eventVelocity(evt);
      if (vel < minVelocity && evt.instrument !== "kick") return;
      const step = eventStep16(evt);
      const current = byStep.get(step);
      const microMs = Number.isFinite(Number(evt.microMs)) ? Number(evt.microMs) : 0;
      if (!current || vel > current.vel) {
        byStep.set(step, { step, vel, microMs, role: String(evt.role || ""), instrument: evt.instrument });
      }
    });
    return [...byStep.values()].sort((a, b) => a.step - b.step);
  }

  function dedupeAgentSteps(steps, limit = 12) {
    const byStep = new Map();
    steps.forEach((step) => {
      if (!step) return;
      const key = Math.max(0, Math.min(15, Math.floor(Number(step.sub) || 0)));
      const current = byStep.get(key);
      if (!current || (Number(step.vel) || 0) > (Number(current.vel) || 0)) {
        byStep.set(key, Object.assign({}, step, { sub: key }));
      }
    });
    return [...byStep.values()].sort((a, b) => a.sub - b.sub).slice(0, limit);
  }

  function makePartAgentContext(sec, frame, chord, beatTime, subTime) {
    const events = Array.isArray(frame?.events) ? frame.events : [];
    const metrics = drumFloorFrameMetrics(frame);
    const role = roleForPartAgent(sec, frame);
    const barInSection = Math.max(0, state.barCount - state.sectionBarStart);
    const barsInSection = Math.max(1, Number(sec?.bars) || 1);
    const isPhraseEnd = ((barInSection + 1) % 4 === 0) || barInSection >= barsInSection - 1;
    const kick = sourceAccentSteps({ events }, ["kick"], 0.08);
    const snare = sourceAccentSteps({ events }, ["snare"], 0.18);
    const hat = sourceAccentSteps({ events }, ["hat"], 0.16);
    const ghost = sourceAccentSteps({ events }, ["ghost"], 0.22);
    const crash = sourceAccentSteps({ events }, ["crash"], 0.12);
    return {
      sec, frame, chord, events, metrics, role, barInSection, barsInSection,
      isPhraseEnd, beatTime, subTime, kick, snare, hat, ghost, crash,
      pressure: metrics.pressure,
      density: metrics.density
    };
  }

  function bassAgentPlan(ctx) {
    if (!ctx.chord) return [];
    const rootSemi = chordToSemi(ctx.chord);
    const rootNote = chordRoot(ctx.chord);
    if (rootSemi == null) return [{ sub: 0, note: rootNote, dur: "1n", vel: 0.36 }];
    const isMinor = /m\b|min\b/.test(ctx.chord) && !/maj/.test(ctx.chord);
    const root = rootSemi;
    const fifth = rootSemi + 7;
    const octave = rootSemi + 12;
    const third = rootSemi + (isMinor ? 3 : 4);
    const seventh = rootSemi + (isMinor ? 10 : 11);
    const source = ctx.kick.length ? ctx.kick : [
      { step: 0, vel: 0.58, microMs: 0 },
      { step: ctx.role === "break" ? 8 : 6, vel: 0.42, microMs: 0 }
    ];
    const steps = source.map((hit, idx) => {
      const tone = hit.step >= 12 ? seventh : hit.step >= 8 ? octave : hit.step >= 4 ? fifth : root;
      return {
        sub: hit.step,
        note: semiToNote(tone),
        dur: ctx.role === "recap" && ctx.density > 0.5 ? "16n" : "8n",
        vel: clamp(0.30 + hit.vel * 0.58 + (idx === 0 ? 0.08 : 0), 0.30, 0.82),
        microMs: hit.microMs || 0
      };
    });
    if ((ctx.role === "recap" || ctx.role === "comp") && ctx.pressure > 0.52) {
      steps.push({ sub: 14, note: semiToNote(third + 12), dur: "16n", vel: 0.42, microMs: -8 });
    }
    if (ctx.role === "verse" && ctx.ghost.some((hit) => hit.step >= 10)) {
      steps.push({ sub: 11, note: semiToNote(fifth), dur: "16n", vel: 0.36, microMs: -6 });
    }
    return dedupeAgentSteps(steps, ctx.role === "recap" ? 10 : 7);
  }

  function guitarAgentPlan(ctx) {
    if (!ctx.chord) return [];
    if (ctx.role === "intro" && ctx.crash.length === 0 && ctx.pressure < 0.55) return [];
    const accentSteps = sourceAccentSteps(ctx, ["kick", "snare", "crash", "ghost"], 0.24);
    const accentMap = new Map(accentSteps.map((hit) => [hit.step, hit]));
    const steps = [];
    if (ctx.role === "outro") {
      steps.push({ sub: 0, dur: "1n", vel: 0.82 });
    } else if (ctx.role === "break") {
      [0, 8].forEach((sub) => steps.push({ sub, dur: "4n", vel: 0.38 + ctx.pressure * 0.20 }));
    } else if (ctx.role === "recap" || ctx.pressure > 0.66) {
      for (let sub = 0; sub < 16; sub += 1) {
        const sourceHit = accentMap.get(sub);
        const hatHit = ctx.hat.find((hit) => hit.step === sub);
        const isGridAccent = sub % 4 === 0;
        steps.push({
          sub,
          dur: "16n",
          vel: clamp((sourceHit ? 0.60 + sourceHit.vel * 0.28 : hatHit ? 0.48 + hatHit.vel * 0.18 : 0.42) + (isGridAccent ? 0.10 : 0), 0.34, 0.86),
          microMs: sourceHit?.microMs || hatHit?.microMs || 0
        });
      }
    } else {
      const grid = ctx.role === "comp" ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 4, 6, 8, 12, 14];
      grid.forEach((sub) => {
        const sourceHit = accentMap.get(sub) || ctx.kick.find((hit) => Math.abs(hit.step - sub) <= 1);
        steps.push({
          sub,
          dur: "8n",
          vel: clamp((sourceHit ? 0.42 + sourceHit.vel * 0.25 : 0.36) + (sub % 8 === 0 ? 0.08 : 0), 0.30, 0.68),
          microMs: sourceHit?.microMs || 0
        });
      });
    }
    return dedupeAgentSteps(steps, ctx.role === "recap" ? 16 : 8);
  }

  function humanFlyVoicePlan(ctx) {
    const phraseBar = ctx.barInSection % 4;
    return (HUMAN_FLY_VOCAL_MELODY.chorus || [])[phraseBar] || [];
  }

  function voiceAgentPlan(ctx) {
    if (!ctx.chord) return [];
    if (state.currentSongId === "human-fly" && ctx.role === "recap") {
      return humanFlyVoicePlan(ctx).map((step) => ({
        sub: step.sub,
        note: step.note,
        durSteps: step.dur,
        vel: 0.56
      }));
    }
    if (ctx.role === "intro" || ctx.role === "outro") return [];
    const notes = chordToNotes(ctx.chord, 4);
    if (notes.length < 3) return [];
    const accents = sourceAccentSteps(ctx, ["snare", "ghost", "crash"], 0.30)
      .filter((hit) => hit.step === 0 || hit.step >= 3);
    if (ctx.isPhraseEnd) {
      const hold = ctx.role === "break" ? notes[1] : notes[0];
      return [{ sub: 0, note: hold, durSteps: 12, vel: ctx.role === "recap" ? 0.62 : 0.48 }];
    }
    const contour = ctx.role === "recap"
      ? [notes[1], notes[2], notes[0], notes[2]]
      : ctx.role === "comp"
        ? [notes[0], notes[1], notes[2], notes[1]]
        : [notes[0], notes[1], notes[2], notes[1]];
    const source = accents.length ? accents.slice(0, 4) : [0, 4, 8, 12].map((step) => ({ step, vel: 0.42, microMs: 0 }));
    return dedupeAgentSteps(source.map((hit, idx) => ({
      sub: hit.step,
      note: contour[idx % contour.length],
      durSteps: ctx.role === "recap" ? 2 : 3,
      vel: clamp((ctx.role === "recap" ? 0.42 : 0.34) + hit.vel * 0.28, 0.34, 0.66),
      microMs: hit.microMs || 0
    })), 4);
  }

  function chordAgentPlan(ctx) {
    if (!ctx.chord) return [];
    const isJazzy = state.kitProfile === "lofi-nujabes" ||
                    state.chordInstrument === "salamander-piano";
    const ext = /m\b|min\b/.test(ctx.chord) ? "m7" : "maj7";
    const voicingChord = isJazzy ? ctx.chord.replace(/(m|maj7|7|m7)?$/, ext) : ctx.chord;
    const notes = chordToNotes(voicingChord, isJazzy ? 4 : 4);
    if (!notes.length) return [];
    const steps = [{ sub: 0, notes, dur: ctx.role === "break" ? "4n" : isJazzy ? "2n" : "2n", vel: isJazzy ? 0.28 : 0.34 }];
    if (ctx.role === "break") {
      steps.push({ sub: 8, notes, dur: "4n", vel: 0.22 });
    } else if (isJazzy || ctx.ghost.length > 1 || ctx.role === "comp") {
      const ghostAnswer = ctx.ghost.find((hit) => hit.step >= 8)?.step;
      steps.push({ sub: ghostAnswer != null ? ghostAnswer : 10, notes, dur: "4n", vel: clamp(0.18 + ctx.pressure * 0.12, 0.18, 0.32) });
    } else if (ctx.role === "recap" && ctx.pressure > 0.58) {
      steps.push({ sub: 8, notes, dur: "4n", vel: 0.24 });
    }
    return dedupeAgentSteps(steps, 3);
  }

  function triggerBassAgent(ctx, time) {
    bassAgentPlan(ctx).forEach((step) => {
      const t = time + step.sub * ctx.subTime + (Number(step.microMs) || 0) / 1000;
      try { synthBass.triggerAttackRelease(step.note, step.dur || "8n", t, step.vel); } catch (e) {}
    });
  }

  function triggerGuitarAgent(ctx, time) {
    const notes = powerChordNotes(ctx.chord, 3);
    if (!notes.length) return;
    guitarAgentPlan(ctx).forEach((step) => {
      const t = time + step.sub * ctx.subTime + (Number(step.microMs) || 0) / 1000;
      try { guitarSynth.triggerAttackRelease(notes, step.dur || "16n", t, step.vel); } catch (e) {}
    });
  }

  function triggerVoiceAgent(ctx, time) {
    voiceAgentPlan(ctx).forEach((step) => {
      const t = time + step.sub * ctx.subTime + (Number(step.microMs) || 0) / 1000;
      const durSec = Math.max(1, Number(step.durSteps) || 2) * ctx.subTime * 0.92;
      try { voiceSynth.triggerAttackRelease(step.note, durSec, t, step.vel); } catch (e) {}
    });
  }

  function triggerChordAgent(ctx, time) {
    chordAgentPlan(ctx).forEach((step) => {
      const t = time + step.sub * ctx.subTime;
      try { chordSynth.triggerAttackRelease(step.notes, step.dur || "4n", t + 0.005, step.vel); } catch (e) {}
    });
  }

  // ---- Scheduler ----------------------------------------------

  function scheduleBar() {
    // This fires once per bar. Reads current frame's events, schedules drums.
    state.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      let sec = currentSection();
      if (!sec) {
        queueAutoAdvanceToNextSong();
        return;
      }
      // Did we cross into next section?
      if (state.barCount - state.sectionBarStart >= sec.bars) {
        state.sectionIdx++;
        state.sectionBarStart = state.barCount;
        if (state.sectionIdx >= state.songData.structure.length) {
          if (state.loopA != null && state.loopB != null) {
            const targetA = state.loopA;
            requestAnimationFrame(() => jumpToSection(targetA));
          } else {
            queueAutoAdvanceToNextSong();
          }
          return;
        }
        // v106: crash hint on big section entry (chorus / bridge / outro).
        // Fires on beat 0 of the new section so the transition has lift.
        const newSec = state.songData.structure[state.sectionIdx];
        if (newSec && drumKit && drumKit.crash && (currentMode === "synth") && $("br-toggle-drums").checked) {
          const sn = newSec.section || "";
          const isLift = sn.startsWith("chorus") || sn === "bridge" ||
                         sn.startsWith("outro") || sn === "chant-b";
          if (isLift) {
            try { drumKit.crash.triggerAttackRelease("2n", time, 0.62); } catch (e) {}
          }
        }
        // v80: A-B loop — if we just stepped past loopB, jump back to loopA.
        // Defer the seek (which calls stop/start on stem players) to RAF so
        // we don't touch them inside the audio callback.
        if (state.loopA != null && state.loopB != null &&
            state.sectionIdx > state.loopB) {
          const targetA = state.loopA;
          requestAnimationFrame(() => jumpToSection(targetA));
        }
        // v73: scroll lyrics to new section. Defer to RAF so the
        // DOM update happens outside the audio callback.
        const nowSec = currentSection();
        if (nowSec) {
          requestAnimationFrame(() => updateLyricsHighlight(nowSec.section));
        }
      }

      const frame = currentFrame();
      if (!frame || !Array.isArray(frame.events)) {
        state.barCount++;
        return;
      }

      const beatTime = Tone.Time("4n").toSeconds();
      const subTime = Tone.Time("16n").toSeconds();

      // v131: AI 再現 mode のときだけ synth voice 発火する。stems mode のときは
      // 全 synth (drum / click / bass / guitar / voice / chord) を skip。
      // v104 で synth toggles のデフォを ON にした副作用で、stems mode でも
      // synth が裏で鳴ってた問題を修正。
      const isSynthMode = (currentMode === "synth");

      // Drums (only if toggle on AND we're in synth mode)
      if (isSynthMode && $("br-toggle-drums").checked && drumKit) {
        // v133: per-step microOffsets (Dilla feel) — master preset / profile
        // 別に固定の offset を加える。snare のバックビート (2/4 拍) を後ろに
        // ドラッグ、hat の offbeat を前にプッシュ = J Dilla / lofi の groove
        const profileName = state.kitProfile || "default";
        const DILLA_OFFSETS_BY_PROFILE = {
          "default":      { snareBack: 0,  hatOffPush: 0,  ghostBack: 0  },
          "sakanaction":  { snareBack: 0,  hatOffPush: -2, ghostBack: 0  },
          "lcd-motorik":  { snareBack: 4,  hatOffPush: 0,  ghostBack: 0  },
          "cramps-punk":  { snareBack: 0,  hatOffPush: 0,  ghostBack: 0  },
          "lofi-nujabes": { snareBack: 14, hatOffPush: -4, ghostBack: 8  }  // ★ Dilla feel
        };
        const dilla = DILLA_OFFSETS_BY_PROFILE[profileName] || DILLA_OFFSETS_BY_PROFILE["default"];

        frame.events.forEach((evt) => {
          const inst = drumKit[evt.instrument];
          if (!inst) return;
          let baseOffset = (evt.beat || 0) * beatTime + (evt.sub || 0) * subTime + (evt.microMs || 0) / 1000;
          // v133: Dilla offset per instrument + step
          let dillaMs = 0;
          if (evt.instrument === "snare" && (evt.beat === 1 || evt.beat === 3)) {
            dillaMs = dilla.snareBack;  // backbeat snare drags back
          } else if (evt.instrument === "hat" && (evt.sub || 0) !== 0) {
            dillaMs = dilla.hatOffPush;  // offbeat hat pushes forward (or back)
          } else if (evt.instrument === "ghost") {
            dillaMs = dilla.ghostBack;
          }
          baseOffset += dillaMs / 1000;
          // v118: random jitter on top (kick は除外、grid 上の方が強く感じる)
          const jitterMs = (evt.instrument === "kick") ? 0 : (Math.random() - 0.5) * 6;
          const t = time + baseOffset + jitterMs / 1000;
          const rawVel = clamp(evt.velocity ?? 0.5, 0.05, 1);
          // v118: velocity humanize — ±4% perturb, accent-friendly
          // v137: mic follow scale — 演奏の音量で drum velocity を ±30% スケール
          const micScale = micFollowVelocityScale();
          let vel = clamp(rawVel * micScale * (1 + (Math.random() - 0.5) * 0.08), 0.05, 1);
          // v122: ghost-note variation — 16th hat の弱拍を時々もっと弱く、
          // 強拍を時々もっと強く。一様な hat 刻みの "machine" 感を消す
          if (evt.instrument === "hat") {
            const onBeat = ((evt.sub || 0) === 0);
            if (onBeat) {
              // 拍頭の hat: 1/3 確率で +20% accent
              if (Math.random() < 0.33) vel = clamp(vel * 1.20, 0.05, 1);
            } else {
              // 弱拍の hat: 1/4 確率で -30% ghost (とても薄い)
              if (Math.random() < 0.25) vel = clamp(vel * 0.70, 0.04, 1);
            }
          }
          if (evt.instrument === "kick") {
            inst.triggerAttackRelease("C1", "16n", t, vel);
          } else if (evt.instrument === "ghost") {
            inst.triggerAttackRelease("16n", t, vel, evt.role);
          } else {
            inst.triggerAttackRelease("16n", t, vel);
          }
        });

        // v107: 4-bar fill — every 4th bar of a section gets a tom/snare
        // roll on the last 16th to break the bar-loop sameness. Skip in
        // intro (too noisy) and outro (already busy).
        const barInSection = state.barCount - state.sectionBarStart;
        const isFillBar = (barInSection + 1) % 4 === 0;
        const role = frame.session_role || "";
        if (isFillBar && role !== "intro" && role !== "outro") {
          const fillInst = drumKit.fill || drumKit.snare;
          if (fillInst) {
            // 4 sixteenth hits on beat 3 with rising velocity
            for (let s = 0; s < 4; s++) {
              const t = time + 3 * beatTime + s * subTime;
              const vel = 0.42 + s * 0.10;
              try {
                if (fillInst === drumKit.fill) fillInst.triggerAttackRelease("16n", t, vel);
                else fillInst.triggerAttackRelease("16n", t, vel);
              } catch (e) {}
            }
          }
        }

        // v106: sparse frame reinforcement — if the extracted pattern is
        // too thin (< 6 events) fill in the missing beats of a basic
        // kick-snare-kick-snare pattern at low velocity. Keeps the
        // groove anchored when librosa onset detection missed hits.
        if (frame.events.length < 6) {
          const basicPattern = [
            { inst: "kick",  beat: 0, vel: 0.50 },
            { inst: "snare", beat: 1, vel: 0.55 },
            { inst: "kick",  beat: 2, vel: 0.50 },
            { inst: "snare", beat: 3, vel: 0.55 }
          ];
          basicPattern.forEach((hit) => {
            // Skip if already covered by an extracted event at that beat
            const exists = frame.events.some((e) =>
              e.instrument === hit.inst && (e.beat || 0) === hit.beat && (e.sub || 0) === 0
            );
            if (exists) return;
            const inst = drumKit[hit.inst];
            if (!inst) return;
            const t = time + hit.beat * beatTime;
            if (hit.inst === "kick") {
              inst.triggerAttackRelease("C1", "16n", t, hit.vel);
            } else {
              inst.triggerAttackRelease("16n", t, hit.vel);
            }
          });
        }
      }

      // Click (4 quarter notes per bar)
      if (isSynthMode && $("br-toggle-click").checked && clickSynth) {
        for (let b = 0; b < 4; b++) {
          const t = time + b * beatTime;
          const accent = (b === 0);
          clickSynth.triggerAttackRelease(accent ? "C6" : "G5", "32n", t, accent ? 0.7 : 0.4);
        }
      }

      const chord = updateChordDisplay();
      const partAgentCtx = makePartAgentContext(sec, frame, chord, beatTime, subTime);
      if (isSynthMode && $("br-toggle-bass").checked && synthBass && chord) {
        triggerBassAgent(partAgentCtx, time);
      } else if (isSynthMode && $("br-toggle-bass").checked && synthBass && !chord && state.songData?.key) {
        // v108: chord null fallback — section has no chord progression
        // (Human Fly intro/outro etc). Anchor bass to the song's key
        // root, one whole-note hit per bar, low velocity. Keeps the
        // section from feeling empty without imposing a melodic line.
        const keyRoot = state.songData.key.split(" ")[0];
        if (keyRoot) {
          try { synthBass.triggerAttackRelease(keyRoot + "2", "1n", time, 0.36); } catch (e) {}
        }
      }

      if (isSynthMode && $("br-toggle-guitar").checked && guitarSynth && chord && frame) {
        triggerGuitarAgent(partAgentCtx, time);
      }

      if (isSynthMode && $("br-toggle-voice").checked && voiceSynth && chord && frame) {
        triggerVoiceAgent(partAgentCtx, time);
      }

      if (isSynthMode && $("br-toggle-chords").checked && chordSynth && chord) {
        triggerChordAgent(partAgentCtx, time);
      }

      updateSectionDisplay();
      state.barCount++;
    }, "1m"));
  }

  // ---- Playback lifecycle -------------------------------------

  async function startPlayback(opts = {}) {
    if (state.started || state.starting) return;
    state.starting = true;
    setButtonState("starting");

    try {
      await Tone.start();
    } catch (e) {
      console.warn("[Band Room] Tone.start failed:", e);
    }

    if (!state.songData) {
      await loadSong(state.currentSongId);
    }
    if (!state.songData) {
      state.starting = false;
      setButtonState("idle");
      return;
    }

    ensureMaster();
    const backgroundBridgeStart = startBackgroundAudioBridge();
    if (!drumKit) drumKit = await buildKitForSource(state.kitSource);
    if (!synthBass) synthBass = makeSynthBass(bassBus);
    if (!guitarSynth) guitarSynth = makeGuitar(guitarBus);
    if (!voiceSynth) voiceSynth = makeVoiceBox(voiceBus);
    if (!chordSynth) chordSynth = makeChordSynth(chordBus);
    if (!clickSynth) clickSynth = makeClick(clickBus);
    await backgroundBridgeStart;

    // Load stems (if available for this song)
    await loadStemsForSong(state.currentSongId);

    // v76: respect the tempo slider when starting (so re-start at 80% stays at 80%)
    const tempoMult = Number($("br-tempo-mult")?.value || 100) / 100;
    Tone.Transport.bpm.value = (state.songData.bpm || 117) * tempoMult;

    const bpm = state.songData.bpm || 117;
    const barDur = 60 / bpm * 4;
    const barOffsetSec = state.barCount > 0 ? state.barCount * barDur : 0;
    const requestedOffsetSec = opts.preservePosition
      ? (state.pendingSeekOffsetSec || state.playbackStartOffsetSec || barOffsetSec)
      : (state.pendingSeekOffsetSec || state.playbackStartOffsetSec || 0);
    const stemOffsetSec = setTimelineStateForSecond(requestedOffsetSec);

    // Clear any old schedules
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];

    scheduleBar();
    Tone.Transport.start();
    resetPlaybackClock(stemOffsetSec);
    state.lastStemResyncAtMs = 0;
    if (currentMode === "stems") {
      startStemPlayback(stemOffsetSec);
      startExternalVocalIfEnabled(stemOffsetSec);
      // v87: per-stem external replacements
      ["drums", "bass", "other"].forEach((s) => startExternalStemIfEnabled(s, stemOffsetSec));
    }

    state.started = true;
    state.starting = false;
    setButtonState("playing");
    updateSectionDisplay();
    updateChordDisplay();
    startMasterMeter();
    startTransportProgress();
    // v73: highlight first section's lyric block
    const firstSec = currentSection();
    if (firstSec) updateLyricsHighlight(firstSec.section);
    // v85: tell the OS we're playing audio
    updateMediaSession("playing");
    // v88: start MIDI Clock if a MIDI output is selected
    if (midiOut) startMidiClock();
    startPlaybackHealthWatchdog();
  }

  // v71: master meter — animate #br-meter-fill width from Tone.Meter dB
  // v77: also drive the spectrum canvas off the same RAF.
  function startMasterMeter() {
    if (!masterMeter) return;
    const fill = $("br-meter-fill");
    if (!fill) return;
    const canvas = $("br-spectrum");
    const ctx = canvas ? canvas.getContext("2d") : null;
    cancelAnimationFrame(masterMeterRaf);
    const tick = () => {
      if (!state.started) return;
      // --- RMS meter ---
      const dB = masterMeter.getValue();
      const pct = Math.max(0, Math.min(100, (dB + 60) / 60 * 100));
      fill.style.width = pct.toFixed(1) + "%";
      fill.style.background = dB > -3 ? "#ff5566" : (dB > -12 ? "#ffb39a" : "#ff8866");
      // --- Spectrum ---
      if (ctx && masterFft) {
        const w = canvas.width, h = canvas.height;
        const vals = masterFft.getValue();  // Float32Array of dB values
        ctx.clearRect(0, 0, w, h);
        const bw = w / vals.length;
        for (let i = 0; i < vals.length; i++) {
          const v = vals[i];
          // map -100..0 dB → 0..h
          const bh = Math.max(0, Math.min(h, (v + 100) / 100 * h));
          const hue = i < 8 ? 14 : (i < 24 ? 22 : 28);  // bass→mid→high tint
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.72)`;
          ctx.fillRect(i * bw, h - bh, bw - 0.5, bh);
        }
      }
      masterMeterRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopMasterMeter() {
    cancelAnimationFrame(masterMeterRaf);
    masterMeterRaf = 0;
    const fill = $("br-meter-fill");
    if (fill) fill.style.width = "0%";
    const canvas = $("br-spectrum");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function releaseSustainedSynths(reason = "panic") {
    [synthBass, guitarSynth, voiceSynth, chordSynth, clickSynth].forEach((voice) => {
      if (!voice) return;
      try {
        if (typeof voice.releaseAll === "function") voice.releaseAll(Tone.now());
        else if (typeof voice.triggerRelease === "function") voice.triggerRelease(Tone.now());
      } catch (e) {
        console.warn("[Band Room] synth release failed:", reason, e);
      }
    });
  }

  function clearSuspendReleaseTimers() {
    suspendReleaseTimers.forEach((timer) => {
      try { clearTimeout(timer); } catch (e) {}
    });
    suspendReleaseTimers = [];
  }

  function scheduleMobileSuspendRelease(reason = "suspend") {
    if (!state.started) return;
    clearSuspendReleaseTimers();
    releaseSustainedSynths(reason);
    // iOS can freeze between attack and scheduled release while the screen is
    // locking. Fire a few close panic releases while timers are still allowed.
    [80, 260, 720].forEach((delay) => {
      suspendReleaseTimers.push(setTimeout(() => {
        if (!state.started) return;
        releaseSustainedSynths(`${reason}+${delay}`);
      }, delay));
    });
  }

  function handlePlaybackGoingBackground(reason = "hidden") {
    if (!state.started) return;
    scheduleMobileSuspendRelease(reason);
    checkBackgroundBridgeHealth(reason);
    if (shouldPreferBackgroundAudioBridge() && !backgroundBridgeActive) {
      startBackgroundAudioBridge({ force: true, rearm: true, reason });
    }
  }

  function handlePlaybackReturningForeground(reason = "visible") {
    clearSuspendReleaseTimers();
    if (state.started) recoverPlaybackAfterSuspend(reason);
  }

  function resyncStemPlaybackToClock(reason = "resync", force = false) {
    if (!state.started || currentMode !== "stems") return false;
    if (!stemPlayers.vocals && !stemPlayers.drums && !stemPlayers.bass && !stemPlayers.other) return false;
    const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    if (!force && now - state.lastStemResyncAtMs < 2200) return false;

    const expectedOffset = playbackContentElapsedSec();
    const guardDuration = fullSongDurationGuardSec();
    if (guardDuration && expectedOffset >= guardDuration - 0.6) return false;

    const startAt = "+0.05";
    const tempoMult = playbackRateMultiplier();
    Object.entries(stemPlayers).forEach(([stem, player]) => {
      if (!player) return;
      const playerDuration = playerDurationSeconds(player) || guardDuration;
      if (playerDuration && expectedOffset >= playerDuration - 0.4) return;
      try {
        const enabled = $("br-toggle-stem-" + stem)?.checked !== false;
        player.stop();
        player.mute = !enabled;
        player.playbackRate = tempoMult;
        player.start(startAt, Math.max(0, expectedOffset));
      } catch (e) {
        console.warn("[Band Room] stem resync failed:", reason, stem, e);
      }
    });
    state.lastStemResyncAtMs = now;
    return true;
  }

  async function recoverPlaybackAfterSuspend(reason = "watchdog") {
    if (!state.started) return;
    let resumed = false;
    try {
      if (Tone.context?.state !== "running" && typeof Tone.context?.resume === "function") {
        await Tone.context.resume();
        resumed = true;
      }
    } catch (e) {
      console.warn("[Band Room] AudioContext resume failed:", reason, e);
    }

    try {
      if (Tone.Transport && Tone.Transport.state !== "started") {
        Tone.Transport.start("+0.03");
        resumed = true;
      }
    } catch (e) {
      console.warn("[Band Room] Transport restart failed:", reason, e);
    }

    checkBackgroundBridgeHealth(reason);

    if (resumed || reason === "visible" || reason === "pageshow") {
      releaseSustainedSynths(reason);
      resyncStemPlaybackToClock(reason, true);
    }
  }

  function startPlaybackHealthWatchdog() {
    if (playbackHealthTimer) return;
    playbackHealthTimer = setInterval(() => {
      if (!state.started) return;
      const contextStopped = Tone.context && Tone.context.state !== "running";
      const transportStopped = Tone.Transport && Tone.Transport.state !== "started";
      if (contextStopped || transportStopped) {
        recoverPlaybackAfterSuspend("watchdog");
      }
      checkBackgroundBridgeHealth("watchdog");
    }, 2500);
  }

  function stopPlaybackHealthWatchdog() {
    if (!playbackHealthTimer) return;
    clearInterval(playbackHealthTimer);
    playbackHealthTimer = 0;
  }

  function stopPlayback(options = {}) {
    clearAutoAdvanceTimer();
    const retainedOffsetSec = options.resetPosition ? 0 : clampPlaybackSecond(playbackContentElapsedSec());
    if (!state.started) {
      if (options.resetPosition) setTimelineStateForSecond(0);
      stopTransportProgress();
      stopPlaybackHealthWatchdog();
      clearSuspendReleaseTimers();
      if (!options.keepBackgroundBridge) stopBackgroundAudioBridge();
      if (options.updateMedia !== false) updateMediaSession("paused");
      return;
    }
    try { Tone.Transport.stop(); } catch (e) {}
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];
    stopStemPlayback();
    stopExternalVocal();
    ["drums", "bass", "other"].forEach((s) => stopExternalStem(s)); // v87
    state.started = false;
    state.playbackStartedAtMs = 0;
    state.playbackStartedAtAudioSec = 0;
    state.playbackRateAtStart = 1;
    setTimelineStateForSecond(retainedOffsetSec);
    stopPlaybackHealthWatchdog();
    clearSuspendReleaseTimers();
    setButtonState("idle");
    stopMasterMeter();
    stopTransportProgress();
    if (!options.keepBackgroundBridge) stopBackgroundAudioBridge();
    if (options.updateMedia !== false) updateMediaSession("paused");
    stopMidiClock(); // v88
  }

  function togglePlay() {
    if (state.starting) return;
    if (state.started) stopPlayback();
    else startPlayback();
  }

  function setButtonState(s) {
    const btn = $("br-play");
    if (!btn) return;
    btn.dataset.state = s;
    if (s === "playing") {
      btn.textContent = "STOP";
      btn.setAttribute("aria-label", "Stop playback");
    } else if (s === "starting") {
      btn.textContent = "WARMING UP";
      btn.setAttribute("aria-label", "Starting");
    } else {
      btn.textContent = "START";
      btn.setAttribute("aria-label", "Start playback");
    }
  }

  // ---- UI bindings --------------------------------------------

  function bindUI() {
    $("br-play")?.addEventListener("click", togglePlay);
    const songSeek = $("br-song-seek");
    if (songSeek) {
      const previewSeek = () => updateSongTimelineDisplay(Number(songSeek.value) || 0);
      const commitSeek = () => {
        transportSeekActive = false;
        seekToPlaybackSecond(Number(songSeek.value) || 0);
      };
      songSeek.addEventListener("pointerdown", () => {
        transportSeekActive = true;
      });
      songSeek.addEventListener("pointerup", commitSeek);
      songSeek.addEventListener("pointercancel", commitSeek);
      songSeek.addEventListener("input", () => {
        transportSeekActive = true;
        previewSeek();
      });
      songSeek.addEventListener("change", commitSeek);
      songSeek.addEventListener("keydown", () => {
        transportSeekActive = true;
        requestAnimationFrame(previewSeek);
      });
      songSeek.addEventListener("keyup", commitSeek);
    }

    const drumFloorLink = $("br-open-drum-floor");
    if (drumFloorLink) {
      drumFloorLink.addEventListener("mouseenter", () => refreshDrumFloorLink());
      drumFloorLink.addEventListener("focus", () => refreshDrumFloorLink());
      drumFloorLink.addEventListener("click", () => publishBandRoomDrumFloorHandoff());
      drumFloorLink.addEventListener("auxclick", () => publishBandRoomDrumFloorHandoff());
    }

    $("br-fm-suggestion-ai")?.addEventListener("click", () => switchToSynthMode());
    $("br-fm-suggestion-inject")?.addEventListener("click", () => {
      const genre = $("br-fm-suggestion-inject")?.dataset.genre || linkedGenreFromUrl();
      if (genre) loadGenrePattern(genre);
    });

    document.getElementById("br-band-select")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-band]");
      if (!btn || btn.disabled) return;
      selectBand(btn.dataset.band);
    });

    document.getElementById("br-track-select")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-song]");
      if (!btn || btn.disabled) return;
      const changed = await switchToSong(btn.dataset.song, {
        fadeStems: true,
        keepBackgroundBridge: true
      });
      if (changed) schedulePrefsSave();  // v78: persist band-level prefs
    });

    // Phrase trigger grid — fire one-shot on click
    document.getElementById("br-phrase-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-phrase-url]");
      if (!btn) return;
      firePhrase(btn.dataset.phraseUrl);
    });

    const volMap = { "br-vol-drums": "drumBus", "br-vol-bass": "bassBus", "br-vol-guitar": "guitarBus", "br-vol-voice": "voiceBus", "br-vol-chords": "chordBus", "br-vol-click": "clickBus" };
    Object.entries(volMap).forEach(([id, busName]) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        ensureMaster();
        const bus = { drumBus, bassBus, guitarBus, voiceBus, chordBus, clickBus }[busName];
        if (bus) {
          try { bus.gain.rampTo(Number(el.value) / 100, 0.08); } catch (e) {}
        }
      });
    });

    // Stem volume sliders
    ["vocals", "drums", "bass", "other"].forEach((stem) => {
      const el = $("br-vol-stem-" + stem);
      if (!el) return;
      el.addEventListener("input", () => {
        ensureMaster();
        const bus = stemBus[stem];
        if (bus) {
          try { bus.gain.rampTo(Number(el.value) / 100, 0.08); } catch (e) {}
        }
      });
    });

    // Stem toggles (per-stem mute)
    ["vocals", "drums", "bass", "other"].forEach((stem) => {
      const el = $("br-toggle-stem-" + stem);
      if (!el) return;
      el.addEventListener("change", () => {
        const player = stemPlayers[stem];
        if (player) {
          player.mute = !el.checked;
        }
      });
    });

    // Vocal FX sliders (chorus / delay / reverb — vocal stem only)
    const vfxChorus = $("br-vfx-chorus");
    if (vfxChorus) {
      vfxChorus.addEventListener("input", () => {
        ensureMaster();
        if (vocalChorus) try { vocalChorus.wet.rampTo(Number(vfxChorus.value) / 100, 0.10); } catch (e) {}
      });
    }
    const vfxDelay = $("br-vfx-delay");
    if (vfxDelay) {
      vfxDelay.addEventListener("input", () => {
        ensureMaster();
        if (vocalDelayWet) try { vocalDelayWet.gain.rampTo(Number(vfxDelay.value) / 100, 0.10); } catch (e) {}
      });
    }
    const vfxReverb = $("br-vfx-reverb");
    if (vfxReverb) {
      vfxReverb.addEventListener("input", () => {
        ensureMaster();
        if (vocalReverbWet) try { vocalReverbWet.gain.rampTo(Number(vfxReverb.value) / 100, 0.10); } catch (e) {}
      });
    }

    // Space processing sliders (reverb amount, stereo width)
    const reverbEl = $("br-space-reverb");
    if (reverbEl) {
      reverbEl.addEventListener("input", () => {
        ensureMaster();
        if (masterWetGain && masterDryGain) {
          const wetVal = Number(reverbEl.value) / 100;
          const dryVal = 1 - wetVal;
          try {
            masterWetGain.gain.rampTo(wetVal, 0.12);
            masterDryGain.gain.rampTo(Math.max(0.6, dryVal), 0.12);
          } catch (e) {}
        }
      });
    }
    const widthEl = $("br-space-width");
    if (widthEl) {
      widthEl.addEventListener("input", () => {
        ensureMaster();
        if (masterWidener) {
          // Tone.StereoWidener.width: 0=mono 0.5=normal 1=max wide
          // Map slider 0-100 → 0-1 (0=mono pull-in, 100=fully wide)
          const w = Number(widthEl.value) / 100;
          try { masterWidener.width.rampTo(w, 0.12); } catch (e) {}
        }
      });
    }

    // v76: practice tempo — multiply base BPM (synth mode practice; in stems
    // mode it shifts pitch which the help text warns about).
    const tempoEl = $("br-tempo-mult");
    const tempoRead = $("br-tempo-mult-readout");
    if (tempoEl) {
      tempoEl.addEventListener("input", () => {
        const mult = Number(tempoEl.value) / 100;
        if (state.started) {
          resetPlaybackClock(playbackContentElapsedSec());
          state.playbackRateAtStart = Number.isFinite(mult) && mult > 0 ? mult : 1;
          clearAutoAdvanceTimer();
        }
        if (tempoRead) tempoRead.textContent = tempoEl.value + "%";
        const baseBpm = state.songData?.bpm || 117;
        const targetBpm = baseBpm * mult;
        try { Tone.Transport.bpm.rampTo(targetBpm, 0.4); } catch (e) {}
        // Also adjust stem playback rate (acknowledged: pitch shifts)
        Object.values(stemPlayers).forEach((p) => {
          if (!p) return;
          try { p.playbackRate = mult; } catch (e) {}
        });
      });
    }

    // v120: swing slider — 8 分音符の偶数を遅らせる shuffle 量
    // Tone.Transport.swing は 0..1、UI は 0..50% (50 → swing=0.5、jazz 三連符寄り)
    const swingEl = $("br-swing");
    const swingRead = $("br-swing-readout");
    if (swingEl) {
      swingEl.addEventListener("input", () => {
        const val = Number(swingEl.value);
        if (swingRead) swingRead.textContent = val + "%";
        try {
          Tone.Transport.swing = val / 100;
          Tone.Transport.swingSubdivision = "8n";
        } catch (e) {}
      });
    }

    // v66: tape warmth (parallel saturator wet send 0..0.40)
    const tapeWarmthEl = $("br-tape-warmth");
    if (tapeWarmthEl) {
      tapeWarmthEl.addEventListener("input", () => {
        ensureMaster();
        if (masterTapeSatWet) {
          // Slider 0..40 → 0..0.40 (subtle parallel send; >0.40 starts to
          // muddy the top end with the 0.06 distortion setting)
          const w = Number(tapeWarmthEl.value) / 100;
          try { masterTapeSatWet.gain.rampTo(w, 0.12); } catch (e) {}
        }
        if (masterTapeSatDry) {
          // Compensate dry path so the default warmth value does not jump
          // on first touch, while higher values still trim some dry level.
          const w = Number(tapeWarmthEl.value) / 100;
          try { masterTapeSatDry.gain.rampTo(1 - w * 0.85, 0.12); } catch (e) {}
        }
      });
    }

    // v66: loudness (final master gain, dB → linear)
    const loudnessEl = $("br-loudness");
    let masterVolValue = 80;
    let masterLoudnessDb = Number(loudnessEl?.value || 0);
    if (loudnessEl) {
      loudnessEl.addEventListener("input", () => {
        masterLoudnessDb = Number(loudnessEl.value) || 0;
        applyMasterOutputGain(0.10);
      });
    }

    // v141/v167: master volume bar (car / Bluetooth touch-friendly control)
    // 0-100 linear → masterGain.gain 0 → 1.25. Multiplied with br-loudness for
    // independent fine-tune. Persisted via PREFS_KEY so it survives reload
    // (important for in-car use where the page may unload).
    const MASTER_VOL_KEY = "band-room.masterVol";
    const masterVolEl = $("br-master-vol");
    const masterVolReadout = $("br-master-vol-readout");
    const masterVolDown = $("br-master-vol-down");
    const masterVolUp = $("br-master-vol-up");
    let masterVolBase = 0.84; // matches initial Tone.Gain(0.84) in ensureMaster()

    function masterVolGainFromValue(value) {
      // 0 → 0, 80 → 0.84 (default), 100 → 1.25
      // Curve: v/80 * base for 0-80 range, then linear to 1.25 at 100
      const v = Math.max(0, Math.min(100, Number(value) || 0));
      if (v <= 80) return (v / 80) * masterVolBase;
      return masterVolBase + ((v - 80) / 20) * (1.25 - masterVolBase);
    }

    function applyMasterOutputGain(seconds = 0.08) {
      const loudnessGain = Math.pow(10, masterLoudnessDb / 20);
      const gain = masterVolGainFromValue(masterVolValue) * loudnessGain;
      ensureMaster();
      if (masterGain) {
        try { masterGain.gain.rampTo(gain, seconds); } catch (e) {}
      }
    }

    function applyMasterVol(value) {
      const v = Math.max(0, Math.min(100, Number(value) || 0));
      masterVolValue = v;
      if (masterVolEl) masterVolEl.value = String(v);
      if (masterVolReadout) masterVolReadout.textContent = String(v);
      applyMasterOutputGain(0.08);
      try { localStorage.setItem(MASTER_VOL_KEY, String(v)); } catch (e) {}
    }

    // Restore persisted volume on init (default 80)
    let savedVol = 80;
    try {
      const raw = localStorage.getItem(MASTER_VOL_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) savedVol = Math.max(0, Math.min(100, parsed));
      }
    } catch (e) {}
    masterVolValue = savedVol;
    if (masterVolEl) {
      masterVolEl.value = String(savedVol);
      masterVolEl.addEventListener("input", (e) => applyMasterVol(e.target.value));
    }
    if (masterVolReadout) masterVolReadout.textContent = String(savedVol);
    if (masterVolDown) {
      masterVolDown.addEventListener("click", () => {
        const cur = Number(masterVolEl?.value || savedVol);
        applyMasterVol(Math.max(0, cur - 5));
      });
    }
    if (masterVolUp) {
      masterVolUp.addEventListener("click", () => {
        const cur = Number(masterVolEl?.value || savedVol);
        applyMasterVol(Math.min(100, cur + 5));
      });
    }
    // Apply on first audio start (masterGain doesn't exist yet at this point)
    // ensureMaster() creates it, so we re-apply after ensureMaster runs the first time.
    // The applyMasterVol call below handles cases where masterGain is already ready.
    applyMasterVol(savedVol);

    // External vocal upload + toggle + volume
    const extFile = $("br-external-vocal-file");
    const acceptVocalFile = async (f) => {
      if (!f) return;
      ensureMaster();
      await loadExternalVocal(f);
      const tog = $("br-toggle-external-vocal");
      if (tog && !tog.checked) {
        tog.checked = true;
        const stemTog = $("br-toggle-stem-vocals");
        if (stemTog) {
          stemTog.checked = false;
          if (stemPlayers.vocals) stemPlayers.vocals.mute = true;
        }
        if (state.started) startExternalVocalIfEnabled(playbackContentElapsedSec());
      }
    };
    if (extFile) {
      extFile.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        await acceptVocalFile(f);
      });
    }
    // v83: drag-drop directly onto the external vocal section
    const extSection = $("br-external-vocal");
    if (extSection) {
      extSection.addEventListener("dragover", (e) => {
        e.preventDefault();
        extSection.classList.add("drag-over");
      });
      ["dragleave", "dragend"].forEach((ev) =>
        extSection.addEventListener(ev, () => extSection.classList.remove("drag-over"))
      );
      extSection.addEventListener("drop", async (e) => {
        e.preventDefault();
        extSection.classList.remove("drag-over");
        const f = e.dataTransfer?.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("audio/")) {
          const status = $("br-external-vocal-status");
          if (status) status.textContent = "(not an audio file)";
          return;
        }
        await acceptVocalFile(f);
      });
    }
    const extToggle = $("br-toggle-external-vocal");
    if (extToggle) {
      extToggle.addEventListener("change", () => {
        if (extToggle.checked && state.started) startExternalVocalIfEnabled(playbackContentElapsedSec());
        else if (!extToggle.checked) stopExternalVocal();
      });
    }
    const extVol = $("br-vol-external-vocal");
    if (extVol) {
      extVol.addEventListener("input", () => {
        ensureMaster();
        if (externalVocalBus) {
          try { externalVocalBus.gain.rampTo(Number(extVol.value) / 100, 0.08); } catch (e) {}
        }
      });
    }

    // v105: bulk toggle buttons (all on / all off / defaults / karaoke)
    document.querySelectorAll(".br-toggle-all").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.toggleAll;
        if (action === "synth-on") {
          ["drums", "bass", "guitar", "voice", "chords"].forEach((v) => setToggle("br-toggle-" + v, true));
          setToggle("br-toggle-click", false); // click stays off
        } else if (action === "synth-off") {
          ["drums", "bass", "guitar", "voice", "chords", "click"].forEach((v) => setToggle("br-toggle-" + v, false));
        } else if (action === "synth-default") {
          ["drums", "bass", "guitar", "voice", "chords"].forEach((v) => setToggle("br-toggle-" + v, true));
          setToggle("br-toggle-click", false);
        } else if (action === "stems-on") {
          ["vocals", "drums", "bass", "other"].forEach((s) => setToggle("br-toggle-stem-" + s, true));
        } else if (action === "stems-off") {
          ["vocals", "drums", "bass", "other"].forEach((s) => setToggle("br-toggle-stem-" + s, false));
        } else if (action === "stems-karaoke") {
          setToggle("br-toggle-stem-vocals", false);
          ["drums", "bass", "other"].forEach((s) => setToggle("br-toggle-stem-" + s, true));
        }
      });
    });
    function setToggle(id, on) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.checked === on) return;
      el.checked = on;
      el.dispatchEvent(new Event("change"));
    }

    // v95: A/B compare snapshot buttons
    const abStatus = $("br-ab-status");
    const setAbStatus = (s) => { if (abStatus) abStatus.textContent = s; };
    ["A", "B"].forEach((slot) => {
      const saveBtn = $(`br-ab-save-${slot.toLowerCase()}`);
      const recallBtn = $(`br-ab-recall-${slot.toLowerCase()}`);
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          abSnapshots[slot] = captureSnapshot();
          if (recallBtn) recallBtn.disabled = false;
          setAbStatus(`${slot} 保存済 · ${abSnapshots.A ? "A" : "-"}/${abSnapshots.B ? "B" : "-"}`);
        });
      }
      if (recallBtn) {
        recallBtn.addEventListener("click", () => {
          if (!abSnapshots[slot]) return;
          restoreSnapshot(abSnapshots[slot]);
          setAbStatus(`${slot} 呼び出し中`);
        });
      }
    });

    // v93: master mix preset chips
    document.querySelectorAll(".br-master-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.preset;
        applyMasterPreset(name);
        document.querySelectorAll(".br-master-preset").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
      });
    });

    // v90: stems pack export toggle
    const stemsPackBtn = $("br-stems-pack-toggle");
    if (stemsPackBtn) {
      stemsPackBtn.addEventListener("click", () => {
        const anyRecording = Object.values(stemRecorders).some(
          (r) => r && r.state === "recording"
        );
        if (anyRecording) {
          stopStemsPack();
        } else {
          ensureMaster();
          if (!state.started) {
            startPlayback().then(() => startStemsPack());
          } else {
            startStemsPack();
          }
        }
      });
    }

    // v134: AI fill (Magenta DrumsRNN)
    const aiLoadBtn = $("br-ai-fill-load");
    if (aiLoadBtn) {
      aiLoadBtn.addEventListener("click", async () => {
        aiLoadBtn.disabled = true;
        aiLoadBtn.textContent = "loading…";
        await loadDrumsRnn();
        aiLoadBtn.textContent = aiDrumRnnReady ? "✓ AI model loaded" : "⚡ load AI model (~2 MB)";
        if (!aiDrumRnnReady) aiLoadBtn.disabled = false;
      });
    }
    const aiGoBtn = $("br-ai-fill-go");
    if (aiGoBtn) aiGoBtn.addEventListener("click", () => aiFillContinueCurrentFrame());
    const aiResetBtn = $("br-ai-fill-reset");
    if (aiResetBtn) aiResetBtn.addEventListener("click", () => aiFillReset());
    const aiTempEl = $("br-ai-fill-temp");
    const aiTempRead = $("br-ai-fill-temp-readout");
    if (aiTempEl) {
      aiTempEl.addEventListener("input", () => {
        if (aiTempRead) aiTempRead.textContent = (Number(aiTempEl.value) / 100).toFixed(2);
      });
    }

    // v137: mic follow groove
    const micEnableBtn = $("br-mic-follow-enable");
    if (micEnableBtn) micEnableBtn.addEventListener("click", enableMicFollow);
    const micDisableBtn = $("br-mic-follow-disable");
    if (micDisableBtn) micDisableBtn.addEventListener("click", disableMicFollow);
    const micAmountEl = $("br-mic-follow-amount");
    const micAmountRead = $("br-mic-follow-amount-readout");
    if (micAmountEl) {
      micAmountEl.addEventListener("input", () => {
        if (micAmountRead) micAmountRead.textContent = micAmountEl.value + "%";
      });
    }

    // v136: Genre pattern picker — 4 ジャンルボタン
    document.querySelectorAll(".br-genre-pick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const genre = btn.dataset.genre;
        if (genre) loadGenrePattern(genre);
      });
    });
    const genreResetBtn = $("br-genre-pick-reset");
    if (genreResetBtn) genreResetBtn.addEventListener("click", () => genrePickReset());

    // Tier1 #3: MIDI loop import (@tonejs/midi)
    const midiImportFile = $("br-midi-import-file");
    const acceptMidiImportFile = async (f) => {
      if (!f) return;
      setMidiImportStatus(`reading ${f.name}…`);
      try {
        const buf = await f.arrayBuffer();
        const events = parseMidiFile(buf);
        if (!events || events.length === 0) {
          setMidiImportStatus("(no drum events found in bar 1)");
          midiImportPendingEvents = null;
          const goBtn = $("br-midi-import-go");
          if (goBtn) goBtn.disabled = true;
          return;
        }
        midiImportPendingEvents = events;
        midiImportSourceName = f.name;
        setMidiImportStatus(`✓ '${f.name}' parsed — ${events.length} events ready to inject`);
        const goBtn = $("br-midi-import-go");
        if (goBtn) goBtn.disabled = false;
      } catch (e) {
        console.warn("[Band Room] MIDI parse failed:", e);
        setMidiImportStatus("parse failed: " + (e.message || e));
        midiImportPendingEvents = null;
        const goBtn = $("br-midi-import-go");
        if (goBtn) goBtn.disabled = true;
      }
    };
    if (midiImportFile) {
      midiImportFile.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        await acceptMidiImportFile(f);
      });
    }
    const midiImportSection = $("br-midi-import");
    if (midiImportSection) {
      midiImportSection.addEventListener("dragover", (e) => {
        e.preventDefault();
        midiImportSection.classList.add("drag-over");
      });
      ["dragleave", "dragend"].forEach((ev) =>
        midiImportSection.addEventListener(ev, () => midiImportSection.classList.remove("drag-over"))
      );
      midiImportSection.addEventListener("drop", async (e) => {
        e.preventDefault();
        midiImportSection.classList.remove("drag-over");
        const f = e.dataTransfer?.files?.[0];
        if (!f) return;
        await acceptMidiImportFile(f);
      });
    }
    const midiImportGoBtn = $("br-midi-import-go");
    if (midiImportGoBtn) midiImportGoBtn.addEventListener("click", () => midiImportInject());
    const midiImportResetBtn = $("br-midi-import-reset");
    if (midiImportResetBtn) midiImportResetBtn.addEventListener("click", () => midiImportReset());

    // v88: MIDI panel
    const midiEnable = $("br-midi-enable");
    if (midiEnable) {
      midiEnable.addEventListener("click", async () => {
        const access = await initMidiAccess();
        if (access) {
          midiEnable.disabled = true;
          midiEnable.textContent = "✓ MIDI enabled";
        }
      });
    }
    const midiOutSel = $("br-midi-out-select");
    if (midiOutSel) {
      midiOutSel.addEventListener("change", () => {
        selectMidiOut(midiOutSel.value);
        if (state.started && midiOut) startMidiClock();
        else if (!midiOut) stopMidiClock();
      });
    }
    const midiInSel = $("br-midi-in-select");
    if (midiInSel) {
      midiInSel.addEventListener("change", () => selectMidiIn(midiInSel.value));
    }

    // v86: help overlay toggle
    const helpToggle = $("br-help-toggle");
    const helpOverlay = $("br-help-overlay");
    const helpClose = $("br-help-close");
    const openHelp = () => { if (helpOverlay) helpOverlay.hidden = false; };
    const closeHelp = () => { if (helpOverlay) helpOverlay.hidden = true; };
    if (helpToggle) helpToggle.addEventListener("click", openHelp);
    if (helpClose) helpClose.addEventListener("click", closeHelp);
    if (helpOverlay) {
      helpOverlay.addEventListener("click", (e) => {
        if (e.target === helpOverlay) closeHelp();
      });
    }

    // v87: per-stem external upload (drums / bass / other)
    ["drums", "bass", "other"].forEach((stem) => {
      const fileEl = $(`br-external-${stem}-file`);
      const togEl = $(`br-toggle-external-${stem}`);
      const accept = async (file) => {
        if (!file || !file.type.startsWith("audio/")) return;
        ensureMaster();
        await loadExternalStem(stem, file);
        if (togEl && !togEl.checked) {
          togEl.checked = true;
          // Mute the original stem so external takes over
          const origTog = $(`br-toggle-stem-${stem}`);
          if (origTog) {
            origTog.checked = false;
            if (stemPlayers[stem]) stemPlayers[stem].mute = true;
          }
          if (state.started) startExternalStemIfEnabled(stem, playbackContentElapsedSec());
        }
      };
      if (fileEl) {
        fileEl.addEventListener("change", async (e) => {
          await accept(e.target.files?.[0]);
        });
      }
      if (togEl) {
        togEl.addEventListener("change", () => {
          if (togEl.checked && state.started) startExternalStemIfEnabled(stem, playbackContentElapsedSec());
          else if (!togEl.checked) stopExternalStem(stem);
        });
      }
      // Drag-drop on the per-stem block
      const block = document.querySelector(`.br-ext-stem[data-stem="${stem}"]`);
      if (block) {
        block.addEventListener("dragover", (e) => {
          e.preventDefault();
          block.classList.add("drag-over");
        });
        ["dragleave", "dragend"].forEach((ev) =>
          block.addEventListener(ev, () => block.classList.remove("drag-over"))
        );
        block.addEventListener("drop", async (e) => {
          e.preventDefault();
          block.classList.remove("drag-over");
          await accept(e.dataTransfer?.files?.[0]);
        });
      }
    });

    // v81: recorder toggle button
    const recBtn = $("br-rec-toggle");
    if (recBtn) {
      recBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          stopRecording();
        } else {
          ensureMaster();
          if (!state.started) {
            // Need playback to be active for there to be audio to record
            startPlayback().then(() => startRecording());
          } else {
            startRecording();
          }
        }
      });
    }

    // Mode radio (stems vs synth)
    document.querySelectorAll("input[name=br-mode]").forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        const newMode = radio.value;
        const oldMode = currentMode;
        currentMode = newMode;
        if (document.body) document.body.dataset.mode = currentMode;
        // v109 fix: hot-swap audio when mode changes mid-playback.
        // Without this, the previous mode's audio kept playing on top
        // of the new mode → user heard both AI synth and original stems.
        if (state.started && newMode !== oldMode) {
          if (oldMode === "stems") {
            // Switching to AI 再現 → stop all stem audio
            stopStemPlayback();
            stopExternalVocal();
            ["drums", "bass", "other"].forEach((s) => stopExternalStem(s));
          } else if (oldMode === "synth" && newMode === "stems") {
            // Switching to 原音 → start stems from the exact transport position.
            const offsetSec = playbackContentElapsedSec();
            startStemPlayback(offsetSec);
            startExternalVocalIfEnabled(offsetSec);
            ["drums", "bass", "other"].forEach((s) => startExternalStemIfEnabled(s, offsetSec));
          }
        }
      });
    });
    if (document.body) document.body.dataset.mode = currentMode;
  }

  // ---- Band registry loader -----------------------------------

  async function loadBandsRegistry() {
    try {
      const res = await fetch("presets/bands.json?cb=" + Date.now());
      if (!res.ok) throw new Error("bands.json " + res.status);
      const data = await res.json();
      state.bandsRegistry = data;
      renderBandSelector();
      return data;
    } catch (e) {
      console.warn("[Band Room] bands registry load failed:", e);
      // Fallback: hardcoded Tabasco
      state.bandsRegistry = {
        bands: {
          tabasco: {
            name: "Tabasco",
            subtitle: "fallback (bands.json failed to load)",
            stems_dir: "presets/tabasco-stems",
            drum_frames_pattern: "presets/drum-frames-tabasco-{songid}.json",
            lyrics_doc: "docs/tabasco-lyrics-final.md",
            songs: [
              { id: "tabasco",         track: "01", title: "TABASCO" },
              { id: "hey",             track: "02", title: "Hey" },
              { id: "i-got-a-feeling", track: "03", title: "I got a feeling" },
              { id: "under-the-moon",  track: "04", title: "Under the Moon" },
              { id: "electric-sheep",  track: "05", title: "Electric Sheep" },
              { id: "human-fly",       track: "06", title: "Human Fly" },
              { id: "sister",          track: "07", title: "Sister" }
            ]
          }
        }
      };
      renderBandSelector();
      return state.bandsRegistry;
    }
  }

  function renderBandSelector() {
    const group = $("br-band-select");
    if (!group || !state.bandsRegistry) return;
    group.innerHTML = "";
    const bandIds = Object.keys(state.bandsRegistry.bands);
    bandIds.forEach((bid) => {
      const band = state.bandsRegistry.bands[bid];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.band = bid;
      btn.textContent = band.name;
      if (!band.songs || band.songs.length === 0) {
        btn.disabled = true;
        btn.title = band.intake_status || "no songs loaded";
      }
      btn.setAttribute("aria-pressed", bid === state.currentBandId ? "true" : "false");
      group.appendChild(btn);
    });
    renderTrackButtons();
    updateSubtitle();
  }

  function renderTrackButtons() {
    const group = $("br-track-select");
    if (!group) return;
    group.innerHTML = "";
    const band = currentBand();
    if (!band || !band.songs) return;
    band.songs.forEach((song) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.track = song.track;
      btn.dataset.song = song.id;
      btn.textContent = `${song.track} ${song.title}`;
      btn.setAttribute("aria-pressed", song.id === state.currentSongId ? "true" : "false");
      group.appendChild(btn);
    });
  }

  function updateSubtitle() {
    const band = currentBand();
    const el = $("br-subtitle");
    if (el && band) {
      el.textContent = `${band.subtitle || band.name}`;
    }
  }

  async function selectBand(bandId) {
    if (!state.bandsRegistry || !state.bandsRegistry.bands[bandId]) return;
    const band = state.bandsRegistry.bands[bandId];
    const firstSong = firstSongForBand(band);
    if (!firstSong) return;
    const switchSeq = ++songSwitchSeq;
    const wasPlaying = state.started;
    if (wasPlaying) stopPlayback({ keepBackgroundBridge: true, updateMedia: false });
    state.currentBandId = bandId;
    state.currentSongId = firstSong.id;
    document.querySelectorAll("#br-band-select button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.band === bandId ? "true" : "false");
    });
    renderTrackButtons();
    updateSubtitle();
    const loaded = await loadSong(state.currentSongId, { switchSeq });
    if (switchSeq !== songSwitchSeq) return;
    if (!loaded) {
      if (wasPlaying) stopBackgroundAudioBridge();
      return;
    }
    clearLoopRange();
    refreshLoopVisuals();
    syncTrackButtons();
    renderPhraseTrigger();
    if (wasPlaying) await startPlayback();
    schedulePrefsSave();  // v78/v152: persist band and sound prefs; song resets on reload
  }

  // v99: render the per-voice override grid. 6 selects, each with the
  // same kit options as the main kit-source selector, plus "(use base)"
  // as the null option.
  function renderVoiceOverridesGrid() {
    const grid = $("br-voice-overrides-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const voices = ["kick", "snare", "hat", "ghost", "fill", "crash"];
    const allKits = [
      { value: "", label: "(use base kit)" },
      ...KIT_OPTIONS.filter((k) => k.value !== "synth" && k.value !== "auto-self"),
      ...(state.onlineCatalog?.kits?.map((k) => ({
        value: "online/" + k.id,
        label: "🌐 " + k.label
      })) || [])
    ];
    voices.forEach((voice) => {
      const row = document.createElement("label");
      row.className = "br-voice-row";
      const lbl = document.createElement("span");
      lbl.textContent = voice;
      row.appendChild(lbl);
      const sel = document.createElement("select");
      sel.dataset.voice = voice;
      allKits.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if ((state.voiceOverrides[voice] || "") === opt.value) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", async () => {
        state.voiceOverrides[voice] = sel.value || null;
        const status = $("br-kit-status");
        if (status) status.textContent = `${voice} override: ${sel.value || "(base)"} — rebuilding…`;
        try {
          drumKit = await buildKitForSource(state.kitSource);
          if (status) status.textContent = `${voice}: ${sel.value || "(base)"}`;
        } catch (e) {
          if (status) status.textContent = "rebuild failed: " + e.message;
        }
        schedulePrefsSave();
      });
      row.appendChild(sel);
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "br-voice-preview";
      prev.dataset.voice = voice;
      prev.textContent = "▶";
      prev.title = `preview ${voice}`;
      prev.addEventListener("click", async () => {
        ensureMaster();
        const kitId = state.voiceOverrides[voice] || state.kitSource;
        const result = await buildOneVoice(voice, kitId);
        if (!result) return;
        try {
          // Different notes for tonal vs noise voices
          const note = voice === "kick" ? "C2" : "C4";
          result.voice.triggerAttackRelease(note, "8n", Tone.now() + 0.02, 0.8);
          setTimeout(() => {
            try { result.voice.dispose(); } catch (e) {}
            try { result.panner.dispose(); } catch (e) {}
          }, 1500);
        } catch (e) {}
      });
      row.appendChild(prev);
      grid.appendChild(row);
    });
  }

  // v101: chord instrument selector — populate from catalog.instruments[]
  function renderChordInstrumentSelector() {
    const sel = $("br-chord-instrument-select");
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    const instruments = state.onlineCatalog?.instruments || [];
    instruments.forEach((inst) => {
      const o = document.createElement("option");
      o.value = inst.id;
      o.textContent = "🌐 " + inst.label;
      if (inst.id === state.chordInstrument) o.selected = true;
      sel.appendChild(o);
    });
    if (!sel.dataset.bound) {
      sel.addEventListener("change", async () => {
        state.chordInstrument = sel.value || null;
        const status = $("br-kit-status");
        if (status) status.textContent = `chord: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (chordSynth) { try { chordSynth.dispose(); } catch (e) {} }
          chordSynth = makeChordSynth(chordBus);
          if (status) status.textContent = `chord: ${sel.value || "synth"}`;
        } catch (e) {
          if (status) status.textContent = "chord rebuild failed: " + e.message;
        }
        schedulePrefsSave();
      });
      sel.dataset.bound = "1";
    }
  }

  // v110: bass instrument selector — same pattern as chord
  function renderBassInstrumentSelector() {
    const sel = $("br-bass-instrument-select");
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    const instruments = state.onlineCatalog?.instruments || [];
    instruments.forEach((inst) => {
      const o = document.createElement("option");
      o.value = inst.id;
      o.textContent = "🌐 " + inst.label;
      if (inst.id === state.bassInstrument) o.selected = true;
      sel.appendChild(o);
    });
    if (!sel.dataset.bound) {
      sel.addEventListener("change", async () => {
        state.bassInstrument = sel.value || null;
        const status = $("br-kit-status");
        if (status) status.textContent = `bass: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (synthBass) { try { synthBass.dispose(); } catch (e) {} }
          synthBass = makeSynthBass(bassBus);
          if (status) status.textContent = `bass: ${sel.value || "synth"}`;
        } catch (e) {
          if (status) status.textContent = "bass rebuild failed: " + e.message;
        }
        schedulePrefsSave();
      });
      sel.dataset.bound = "1";
    }
  }

  // v111: guitar instrument selector
  function renderGuitarInstrumentSelector() {
    const sel = $("br-guitar-instrument-select");
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    const instruments = state.onlineCatalog?.instruments || [];
    instruments.forEach((inst) => {
      const o = document.createElement("option");
      o.value = inst.id;
      o.textContent = "🌐 " + inst.label;
      if (inst.id === state.guitarInstrument) o.selected = true;
      sel.appendChild(o);
    });
    if (!sel.dataset.bound) {
      sel.addEventListener("change", async () => {
        state.guitarInstrument = sel.value || null;
        const status = $("br-kit-status");
        if (status) status.textContent = `guitar: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (guitarSynth) { try { guitarSynth.dispose(); } catch (e) {} }
          guitarSynth = makeGuitar(guitarBus);
          if (status) status.textContent = `guitar: ${sel.value || "synth"}`;
        } catch (e) {
          if (status) status.textContent = "guitar rebuild failed: " + e.message;
        }
        schedulePrefsSave();
      });
      sel.dataset.bound = "1";
    }
  }

  // v111: voice (melody lead) instrument selector
  function renderVoiceInstrumentSelector() {
    const sel = $("br-voice-instrument-select");
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    const instruments = state.onlineCatalog?.instruments || [];
    instruments.forEach((inst) => {
      const o = document.createElement("option");
      o.value = inst.id;
      o.textContent = "🌐 " + inst.label;
      if (inst.id === state.voiceInstrument) o.selected = true;
      sel.appendChild(o);
    });
    if (!sel.dataset.bound) {
      sel.addEventListener("change", async () => {
        state.voiceInstrument = sel.value || null;
        const status = $("br-kit-status");
        if (status) status.textContent = `melody lead: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (voiceSynth) { try { voiceSynth.dispose(); } catch (e) {} }
          voiceSynth = makeVoiceBox(voiceBus);
          if (status) status.textContent = `melody lead: ${sel.value || "synth"}`;
        } catch (e) {
          if (status) status.textContent = "voice rebuild failed: " + e.message;
        }
        schedulePrefsSave();
      });
      sel.dataset.bound = "1";
    }
  }

  function renderKitOptions() {
    const sel = $("br-kit-source-select");
    if (!sel) return;
    sel.innerHTML = "";
    // Local kits first
    KIT_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === state.kitSource) o.selected = true;
      sel.appendChild(o);
    });
    // v97: append online catalog kits (CDN samples, no repo size impact)
    if (state.onlineCatalog && state.onlineCatalog.kits) {
      const sep = document.createElement("option");
      sep.disabled = true;
      sep.textContent = "─── online (CDN) ───";
      sel.appendChild(sep);
      state.onlineCatalog.kits.forEach((kit) => {
        const o = document.createElement("option");
        o.value = "online/" + kit.id;
        o.textContent = "🌐 " + kit.label;
        if (o.value === state.kitSource) o.selected = true;
        sel.appendChild(o);
      });
    }
    sel.addEventListener("change", async () => {
      const newSource = sel.value;
      const status = $("br-kit-status");
      if (status) status.textContent = "loading kit…";
      state.kitSource = newSource;
      try {
        drumKit = await buildKitForSource(newSource);
        if (status) status.textContent = newSource === "synth" ? "synth kit ready" : `sample kit: ${newSource}`;
      } catch (e) {
        if (status) status.textContent = "kit load failed: " + e.message;
      }
    });

    // v99: render the per-voice override grid (6 selects, one per voice)
    renderVoiceOverridesGrid();

    // v101: populate chord instrument selector from catalog
    renderChordInstrumentSelector();
    // v110: populate bass instrument selector
    renderBassInstrumentSelector();
    // v111: populate guitar + voice selectors
    renderGuitarInstrumentSelector();
    renderVoiceInstrumentSelector();

    // v102: custom kit URL add — user paste their own sample URLs and the
    // catalog gets a localStorage-backed kit entry that survives reload.
    const customAddBtn = $("br-custom-kit-add");
    if (customAddBtn) {
      customAddBtn.addEventListener("click", () => {
        const id = ($("br-custom-kit-id")?.value || "").trim();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
          const s = $("br-custom-kit-status");
          if (s) s.textContent = "id は英数字 / hyphen / underscore のみ";
          return;
        }
        const kickUrl  = ($("br-custom-kit-kick")?.value || "").trim();
        const snareUrl = ($("br-custom-kit-snare")?.value || "").trim();
        const hatUrl   = ($("br-custom-kit-hat")?.value || "").trim();
        if (!kickUrl && !snareUrl && !hatUrl) {
          const s = $("br-custom-kit-status");
          if (s) s.textContent = "URL を 1 つ以上入れて";
          return;
        }
        const kit = {
          id: "custom-" + id,
          label: id + " (custom URL)",
          source: "user",
          license: "user-supplied",
          base_url: "",
          voices: {
            kick:  kickUrl,
            snare: snareUrl,
            hat:   hatUrl,
            ghost: snareUrl,  // reuse snare for ghost / fill if not supplied separately
            fill:  snareUrl,
            crash: hatUrl
          }
        };
        if (!state.onlineCatalog) state.onlineCatalog = { kits: [], instruments: [] };
        if (!state.onlineCatalog.kits) state.onlineCatalog.kits = [];
        // Replace if same id exists
        state.onlineCatalog.kits = state.onlineCatalog.kits.filter((k) => k.id !== kit.id);
        state.onlineCatalog.kits.push(kit);
        // Persist custom kits separately
        try {
          const customs = state.onlineCatalog.kits.filter((k) => k.id.startsWith("custom-"));
          localStorage.setItem("band-room.custom-kits.v1", JSON.stringify(customs));
        } catch (e) {}
        renderKitOptions();
        renderVoiceOverridesGrid();
        const s = $("br-custom-kit-status");
        if (s) s.textContent = `追加: online/${kit.id}`;
      });
    }

    // v102: restore custom kits from localStorage
    try {
      const raw = localStorage.getItem("band-room.custom-kits.v1");
      if (raw) {
        const customs = JSON.parse(raw);
        if (Array.isArray(customs) && customs.length > 0) {
          if (!state.onlineCatalog) state.onlineCatalog = { kits: [], instruments: [] };
          if (!state.onlineCatalog.kits) state.onlineCatalog.kits = [];
          customs.forEach((k) => {
            if (!state.onlineCatalog.kits.find((existing) => existing.id === k.id)) {
              state.onlineCatalog.kits.push(k);
            }
          });
          renderKitOptions();
          renderVoiceOverridesGrid();
        }
      }
    } catch (e) {}
    const clearBtn = $("br-voice-overrides-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        Object.keys(state.voiceOverrides).forEach((v) => state.voiceOverrides[v] = null);
        renderVoiceOverridesGrid();
        const status = $("br-kit-status");
        if (status) status.textContent = "overrides cleared, rebuilding…";
        try {
          drumKit = await buildKitForSource(state.kitSource);
          if (status) status.textContent = "kit rebuilt (no overrides)";
        } catch (e) {
          if (status) status.textContent = "rebuild failed: " + e.message;
        }
      });
    }

    // v100: kit preview button — fetch kick from the currently-selected kit
    // and play it once. Cheap UX for auditioning.
    document.querySelectorAll(".br-kit-preview").forEach((btn) => {
      btn.addEventListener("click", async () => {
        ensureMaster();
        const result = await buildOneVoice("kick", state.kitSource);
        if (!result) return;
        try {
          result.voice.triggerAttackRelease("C2", "8n", Tone.now() + 0.02, 0.8);
          setTimeout(() => {
            try { result.voice.dispose(); } catch (e) {}
            try { result.panner.dispose(); } catch (e) {}
          }, 1500);
        } catch (e) {}
      });
    });

    // v91/v92: synth profile selector — hot-swap the synth voice profile.
    // v92: profile now affects bass/chord/vocal in addition to drums.
    // Drum profile only applies when kitSource = "synth"; bass/chord/vocal
    // are always synth so they always rebuild on profile change.
    const profileSel = $("br-kit-profile-select");
    if (profileSel) {
      profileSel.value = state.kitProfile || "default";
      profileSel.addEventListener("change", async () => {
        state.kitProfile = profileSel.value;
        const status = $("br-kit-status");
        if (status) status.textContent = `applying profile: ${profileSel.value}…`;
        try {
          // Rebuild bass/chord/vocal — always synth, always affected
          if (synthBass) { try { synthBass.dispose(); } catch (e) {} }
          synthBass = makeSynthBass(bassBus);
          if (chordSynth) { try { chordSynth.dispose(); } catch (e) {} }
          chordSynth = makeChordSynth(chordBus);
          if (voiceSynth) { try { voiceSynth.dispose(); } catch (e) {} }
          voiceSynth = makeVoiceBox(voiceBus);
          // Rebuild drum kit only if currently using synth source
          if (state.kitSource === "synth") {
            drumKit = await buildKitForSource("synth");
          }
          if (status) status.textContent = `profile: ${profileSel.value}`;
        } catch (e) {
          if (status) status.textContent = "profile apply failed: " + e.message;
        }
      });
    }
  }

  // ---- v88: WebMIDI in/out -----------------------------------
  // Out: send MIDI Clock so DAW / drum machines sync to band-room's transport.
  // In: listen for note-on events and map them to phrase trigger 01..20 + section nav.
  // Both opt-in via the MIDI panel (you don't pay the perf cost unless enabled).
  let midiAccess = null;
  let midiOut = null;
  let midiClockTimer = null;
  let midiInListening = false;

  async function initMidiAccess() {
    if (midiAccess) return midiAccess;
    if (!navigator.requestMIDIAccess) {
      setMidiStatus("WebMIDI not supported in this browser");
      return null;
    }
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      renderMidiDevices();
      midiAccess.onstatechange = renderMidiDevices;
      return midiAccess;
    } catch (e) {
      setMidiStatus("MIDI access denied: " + (e.message || e));
      return null;
    }
  }

  function renderMidiDevices() {
    if (!midiAccess) return;
    const outSel = $("br-midi-out-select");
    const inSel  = $("br-midi-in-select");
    if (outSel) {
      const prev = outSel.value;
      outSel.innerHTML = '<option value="">(none)</option>';
      midiAccess.outputs.forEach((out) => {
        const opt = document.createElement("option");
        opt.value = out.id;
        opt.textContent = `${out.name} — ${out.manufacturer || "?"}`;
        outSel.appendChild(opt);
      });
      if (prev && Array.from(outSel.options).some((o) => o.value === prev)) {
        outSel.value = prev;
      }
    }
    if (inSel) {
      const prev = inSel.value;
      inSel.innerHTML = '<option value="">(none)</option>';
      midiAccess.inputs.forEach((inp) => {
        const opt = document.createElement("option");
        opt.value = inp.id;
        opt.textContent = `${inp.name} — ${inp.manufacturer || "?"}`;
        inSel.appendChild(opt);
      });
      if (prev && Array.from(inSel.options).some((o) => o.value === prev)) {
        inSel.value = prev;
      }
    }
  }

  function setMidiStatus(s) {
    const el = $("br-midi-status");
    if (el) el.textContent = s || "";
  }

  function selectMidiOut(id) {
    if (!midiAccess) return;
    midiOut = id ? midiAccess.outputs.get(id) : null;
    setMidiStatus(midiOut ? `out: ${midiOut.name}` : "out: (none)");
  }

  // MIDI Clock = 0xF8, sent 24 times per quarter note.
  // At 120 BPM: 24 × 2 Hz = 48 Hz = 20.8 ms per tick.
  function startMidiClock() {
    stopMidiClock();
    if (!midiOut) return;
    try { midiOut.send([0xFA]); } catch (e) {} // start
    const tick = () => {
      if (!midiOut) return;
      const bpm = Tone.Transport.bpm.value || 120;
      const interval = (60 / bpm / 24) * 1000;
      try { midiOut.send([0xF8]); } catch (e) {}
      midiClockTimer = setTimeout(tick, interval);
    };
    tick();
  }

  function stopMidiClock() {
    if (midiClockTimer) clearTimeout(midiClockTimer);
    midiClockTimer = null;
    if (midiOut) {
      try { midiOut.send([0xFC]); } catch (e) {} // stop
    }
  }

  function selectMidiIn(id) {
    if (!midiAccess) return;
    // Detach previous listeners
    midiAccess.inputs.forEach((inp) => { inp.onmidimessage = null; });
    midiInListening = false;
    if (!id) {
      setMidiStatus("in: (none)");
      return;
    }
    const inp = midiAccess.inputs.get(id);
    if (!inp) return;
    inp.onmidimessage = handleMidiMessage;
    midiInListening = true;
    setMidiStatus(`in: ${inp.name}`);
  }

  // MIDI note → action mapping:
  //   notes 36..55 (C2..G3, 20 keys) → phrase 01..20
  //   notes 60..68 (C4..G#4)         → section index 0..8 (jumpToSection)
  function handleMidiMessage(msg) {
    const [status, data1, data2] = msg.data;
    const kind = status & 0xF0;
    if (kind !== 0x90 || data2 === 0) return; // only note-on with velocity
    // Phrase trigger range
    if (data1 >= 36 && data1 <= 55) {
      const phraseIdx = data1 - 36; // 0..19
      const btn = document.querySelectorAll("#br-phrase-grid .br-phrase-cells button")[phraseIdx];
      if (btn) btn.click();
    }
    // Section jump range
    else if (data1 >= 60 && data1 <= 68) {
      const idx = data1 - 60;
      if (state.songData?.structure?.[idx]) jumpToSection(idx);
    }
  }

  // ---- v85: MediaSession (lock screen / external media keys) -
  // Exposes the current song to the OS so headphones / Apple Watch /
  // Android notification controls work, and so the lock screen shows
  // metadata while playing in the background.
  let mediaSessionWired = false;
  function ensureMediaSessionHandlers() {
    if (mediaSessionWired || !("mediaSession" in navigator)) return;
    const setHandler = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        console.warn(`[Band Room] mediaSession ${action} handler failed:`, e);
      }
    };
    setHandler("play", () => {
      if (!state.started) startPlayback();
    });
    setHandler("pause", () => {
      if (state.started) stopPlayback();
    });
    setHandler("stop", () => {
      if (state.started) stopPlayback();
    });
    setHandler("previoustrack", () => {
      selectAdjacentSong(-1).catch((e) => {
        console.warn("[Band Room] previous track failed:", e);
      });
    });
    setHandler("nexttrack", () => {
      selectAdjacentSong(1).catch((e) => {
        console.warn("[Band Room] next track failed:", e);
      });
    });
    setHandler("seekbackward", (details = {}) => {
      const amount = Number(details.seekOffset) || 10;
      seekToPlaybackSecond(playbackContentElapsedSec() - amount);
    });
    setHandler("seekforward", (details = {}) => {
      const amount = Number(details.seekOffset) || 10;
      seekToPlaybackSecond(playbackContentElapsedSec() + amount);
    });
    setHandler("seekto", (details = {}) => {
      if (Number.isFinite(Number(details.seekTime))) seekToPlaybackSecond(Number(details.seekTime));
    });
    mediaSessionWired = true;
  }

  function updateMediaSession(playState) {
    if (!("mediaSession" in navigator)) return;
    ensureMediaSessionHandlers();
    try {
      const band = currentBand();
      const title = state.songData?.song_title || state.currentSongId;
      const artist = band?.name || state.currentBandId;
      const album = "Band Room — air rock connect box";
      if (window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title, artist, album,
          artwork: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
          ]
        });
      }
      navigator.mediaSession.playbackState = playState; // "playing" | "paused" | "none"
    } catch (e) {}
  }

  // ---- v78: localStorage persistence -------------------------
  // Remember sound/editing prefs. Song position intentionally resets to track 01
  // on reload so Band Room behaves like an album/set entry point.
  const PREFS_KEY = "band-room.prefs.v1";
  const MIX_PREFS_VERSION = "v168-default-mix";
  const V167_DEFAULT_MIX_MIGRATION = {
    "br-vol-stem-vocals": { old: "72", current: "68" },
    "br-vol-stem-drums": { old: "92", current: "86" },
    "br-vol-stem-bass": { old: "92", current: "86" },
    "br-vol-stem-other": { old: "92", current: "84" },
    "br-vol-drums": { old: "62", current: "58" },
    "br-vol-bass": { old: "72", current: "66" },
    "br-vol-guitar": { old: "62", current: "56" },
    "br-vol-voice": { old: "56", current: "48" },
    "br-vol-chords": { old: "68", current: "58" },
    "br-vfx-chorus": { old: "30", current: "22" },
    "br-vfx-delay": { old: "18", current: "12" },
    "br-vfx-reverb": { old: "28", current: "20" },
    "br-vol-external-vocal": { old: "85", current: "78" },
    "br-space-reverb": { old: "22", current: "16" },
    "br-space-width": { old: "72", current: "62" },
    "br-tape-warmth": { old: "10", current: "7" },
    "br-loudness": { old: "0", current: "-1" }
  };

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function migratePrefsForCurrentMix(prefs) {
    if (!prefs || prefs.mixPrefsVersion === MIX_PREFS_VERSION) return prefs;
    const next = { ...prefs, sliders: { ...(prefs.sliders || {}) }, mixPrefsVersion: MIX_PREFS_VERSION };
    let changed = prefs.mixPrefsVersion !== MIX_PREFS_VERSION;
    Object.entries(V167_DEFAULT_MIX_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    next.__mixMigrated = changed;
    return next;
  }

  function savePrefs() {
    try {
      const prefs = {
        bandId: state.currentBandId,
        mixPrefsVersion: MIX_PREFS_VERSION,
        mode: currentMode,
        kitSource: state.kitSource,
        kitProfile: state.kitProfile,
        voiceOverrides: state.voiceOverrides,
        chordInstrument: state.chordInstrument,
        bassInstrument: state.bassInstrument,
        guitarInstrument: state.guitarInstrument,
        voiceInstrument: state.voiceInstrument,
        sliders: {},
        toggles: {}
      };
      // Capture all range inputs
      document.querySelectorAll('#br-main input[type="range"]').forEach((el) => {
        if (el.id) prefs.sliders[el.id] = el.value;
      });
      // Capture key checkbox toggles (mute states)
      document.querySelectorAll('#br-main input[type="checkbox"]').forEach((el) => {
        if (el.id) prefs.toggles[el.id] = el.checked;
      });
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  function applyPrefs(prefs) {
    if (!prefs) return;
    prefs = migratePrefsForCurrentMix(prefs);
    // Sliders + toggles — re-trigger 'input'/'change' so handlers run
    if (prefs.sliders) {
      Object.entries(prefs.sliders).forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = v;
          el.dispatchEvent(new Event("input"));
        }
      });
    }
    if (prefs.toggles) {
      Object.entries(prefs.toggles).forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el && el.type === "checkbox") {
          el.checked = !!v;
          el.dispatchEvent(new Event("change"));
        }
      });
    }
    // Mode radio
    if (prefs.mode) {
      const radio = document.querySelector(`input[name=br-mode][value="${prefs.mode}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change"));
      }
    }
    // Kit source (select)
    if (prefs.kitSource) {
      const sel = $("br-kit-source-select");
      if (sel) {
        sel.value = prefs.kitSource;
        state.kitSource = prefs.kitSource;
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v91: synth kit profile
    if (prefs.kitProfile) {
      const psel = $("br-kit-profile-select");
      if (psel) {
        psel.value = prefs.kitProfile;
        state.kitProfile = prefs.kitProfile;
        psel.dispatchEvent(new Event("change"));
      }
    }
    // v99: per-voice overrides
    if (prefs.voiceOverrides) {
      Object.assign(state.voiceOverrides, prefs.voiceOverrides);
      renderVoiceOverridesGrid();
    }
    // v101/v166: instrument prefs may intentionally be null/"" to use synth fallback.
    // Check property presence so the new electric-agent defaults do not override a
    // user's explicit "(synth)" selection from an older saved prefs object.
    if (Object.prototype.hasOwnProperty.call(prefs, "chordInstrument")) {
      state.chordInstrument = prefs.chordInstrument || null;
      const sel = $("br-chord-instrument-select");
      if (sel) {
        sel.value = state.chordInstrument || "";
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v110: bass instrument
    if (Object.prototype.hasOwnProperty.call(prefs, "bassInstrument")) {
      state.bassInstrument = prefs.bassInstrument || null;
      const sel = $("br-bass-instrument-select");
      if (sel) {
        sel.value = state.bassInstrument || "";
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v111: guitar instrument
    if (Object.prototype.hasOwnProperty.call(prefs, "guitarInstrument")) {
      state.guitarInstrument = prefs.guitarInstrument || null;
      const sel = $("br-guitar-instrument-select");
      if (sel) {
        sel.value = state.guitarInstrument || "";
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v111: voice instrument
    if (Object.prototype.hasOwnProperty.call(prefs, "voiceInstrument")) {
      state.voiceInstrument = prefs.voiceInstrument || null;
      const sel = $("br-voice-instrument-select");
      if (sel) {
        sel.value = state.voiceInstrument || "";
        sel.dispatchEvent(new Event("change"));
      }
    }
    if (prefs.__mixMigrated) schedulePrefsSave();
  }

  // Save on any meaningful user change. Debounced so 100 slider drags
  // don't write 100 times.
  let savePrefsTimer = 0;
  function schedulePrefsSave() {
    clearTimeout(savePrefsTimer);
    savePrefsTimer = setTimeout(savePrefs, 400);
  }

  // ---- v134: Magenta DrumsRNN AI fill -----------------------
  // 現在の bar の drum events を seed として AI に続編 32 step (2 bar 分) を
  // 生成させて、現 frame に inject。Magenta drumkit は 9 class:
  //   0=kick(36), 1=snare(38), 2=closedHat(42), 3=openHat(46),
  //   4=lowTom(43), 5=midTom(47), 6=hiTom(50), 7=crash(49), 8=ride(51)
  // band-room の drum-frames instrument 名にマッピングして events に変換。
  let aiDrumRnn = null;
  let aiDrumRnnReady = false;
  let aiFillBackupEvents = null;  // 元 frame events を保存して reset 可能に
  let aiFillTargetFrameId = null;

  const MAGENTA_PITCH_TO_INST = {
    36: "kick",   38: "snare",  42: "hat",   46: "hat",     // closed/open both → hat
    43: "fill",   47: "fill",   50: "fill",                  // toms → fill (band-room voice)
    49: "crash",  51: "crash"                                 // crash/ride
  };
  const INST_TO_MAGENTA_PITCH = {
    kick: 36, snare: 38, hat: 42, ghost: 38, fill: 47, crash: 49
  };

  async function loadDrumsRnn() {
    if (aiDrumRnnReady) return aiDrumRnn;
    if (typeof mm === "undefined") {
      setAiFillStatus("error: @magenta/music not loaded (offline?)");
      return null;
    }
    setAiFillStatus("loading Magenta DrumsRNN model…");
    try {
      aiDrumRnn = new mm.MusicRNN(
        "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn"
      );
      await aiDrumRnn.initialize();
      aiDrumRnnReady = true;
      setAiFillStatus("✓ DrumsRNN ready");
      const goBtn = $("br-ai-fill-go");
      if (goBtn) goBtn.disabled = false;
      return aiDrumRnn;
    } catch (e) {
      console.warn("[Band Room] DrumsRNN init failed:", e);
      setAiFillStatus("init failed: " + (e.message || e));
      return null;
    }
  }

  function setAiFillStatus(s) {
    const el = $("br-ai-fill-status");
    if (el) el.textContent = s || "";
  }

  function eventsToSeedNoteSequence(events) {
    // events: drum-frames format → mm.NoteSequence (quantized to 16 steps)
    const notes = [];
    events.forEach((evt) => {
      const pitch = INST_TO_MAGENTA_PITCH[evt.instrument];
      if (!pitch) return;
      const stepIdx = (evt.beat || 0) * 4 + (evt.sub || 0);
      if (stepIdx < 0 || stepIdx >= 16) return;
      notes.push({
        pitch,
        quantizedStartStep: stepIdx,
        quantizedEndStep: stepIdx + 1,
        isDrum: true,
        velocity: Math.round(clamp(evt.velocity ?? 0.5, 0, 1) * 127)
      });
    });
    return new mm.NoteSequence({
      notes,
      totalQuantizedSteps: 16,
      quantizationInfo: { stepsPerQuarter: 4 }
    });
  }

  function noteSequenceToEvents(ns, stepOffset = 0) {
    // mm.NoteSequence → drum-frames events format
    const events = [];
    (ns.notes || []).forEach((n) => {
      const inst = MAGENTA_PITCH_TO_INST[n.pitch];
      if (!inst) return;
      const stepIdx = (n.quantizedStartStep || 0) + stepOffset;
      // Wrap to first bar of frame events (band-room frames are 1 bar = 16 steps)
      const wrappedStep = stepIdx % 16;
      events.push({
        instrument: inst,
        beat: Math.floor(wrappedStep / 4),
        sub: wrappedStep % 4,
        velocity: clamp((n.velocity || 90) / 127, 0.05, 1),
        microMs: 0,
        role: "ai_continued"
      });
    });
    return events;
  }

  async function aiFillContinueCurrentFrame() {
    if (!aiDrumRnnReady || !aiDrumRnn) {
      setAiFillStatus("model not ready, click load first");
      return;
    }
    const sec = currentSection();
    if (!sec || !state.songData) {
      setAiFillStatus("no song loaded");
      return;
    }
    const frame = currentFrame();
    if (!frame || !Array.isArray(frame.events)) {
      setAiFillStatus("no frame events to seed");
      return;
    }
    setAiFillStatus("generating continuation…");
    try {
      // Backup so we can reset later
      aiFillBackupEvents = JSON.parse(JSON.stringify(frame.events));
      aiFillTargetFrameId = frame.id;

      const seed = eventsToSeedNoteSequence(frame.events);
      const tempEl = $("br-ai-fill-temp");
      const temperature = tempEl ? Number(tempEl.value) / 100 : 1.0;
      // Continue 32 steps = 2 bars worth
      const continuation = await aiDrumRnn.continueSequence(seed, 32, temperature);
      // Use the *second* half of continuation for variety (or full if you want
      // total replacement). Here we take the first 16 steps as the new bar 1.
      const newEvents = noteSequenceToEvents(continuation, 0).filter((e) => {
        // Only keep events that fall in bar 1 (steps 0..15)
        return (e.beat * 4 + e.sub) < 16;
      });
      if (newEvents.length === 0) {
        setAiFillStatus("AI returned empty — try higher temperature");
        return;
      }
      // Replace frame.events with AI continuation
      frame.events = newEvents;
      const resetBtn = $("br-ai-fill-reset");
      if (resetBtn) resetBtn.disabled = false;
      setAiFillStatus(`✓ frame '${frame.id}' continued (${newEvents.length} events, temp ${temperature.toFixed(2)})`);
    } catch (e) {
      console.warn("[Band Room] AI fill failed:", e);
      setAiFillStatus("AI fill failed: " + (e.message || e));
    }
  }

  function aiFillReset() {
    if (!aiFillBackupEvents || !aiFillTargetFrameId || !state.songData) return;
    const frame = state.songData.frames.find((f) => f.id === aiFillTargetFrameId);
    if (frame) {
      frame.events = aiFillBackupEvents;
      setAiFillStatus(`reset '${frame.id}' to original events`);
      aiFillBackupEvents = null;
      aiFillTargetFrameId = null;
      const resetBtn = $("br-ai-fill-reset");
      if (resetBtn) resetBtn.disabled = true;
    }
  }

  // ---- Tier1 #3: MIDI loop import (@tonejs/midi) -----------------
  // Parse .mid → drum-frames events 形式 (band-room の AI fill と同じ shape)。
  // bar 1 (= ticks 0 〜 ppq*4) を抽出して現 frame.events に inject。
  // MIDI pitch → instrument map (General MIDI Drum standard):
  //   36=kick / 38=snare / 42=closed hat / 46=open hat /
  //   47/50=tom→fill / 49=crash / 51=ride→crash
  let midiImportPendingEvents = null;     // parse 結果のキャッシュ (inject 待ち)
  let midiImportSourceName = null;
  let midiImportBackupEvents = null;       // inject 前の元 events (reset 用)
  let midiImportTargetFrameId = null;

  const MIDI_PITCH_TO_INST = {
    35: "kick",   36: "kick",            // acoustic / electric bass drum
    38: "snare",  40: "snare",            // acoustic / electric snare
    37: "ghost",                           // side stick → ghost
    42: "hat",    44: "hat",   46: "hat",  // closed / pedal / open hat
    41: "fill",   43: "fill",   45: "fill",  // low / hi-floor / low toms
    47: "fill",   48: "fill",   50: "fill",  // low-mid / hi-mid / hi tom
    49: "crash",  51: "crash",  52: "crash", 53: "crash",
    55: "crash",  57: "crash",  59: "crash"
  };

  function setMidiImportStatus(s) {
    const el = $("br-midi-import-status");
    if (el) el.textContent = s || "";
  }

  function parseMidiFile(arrayBuffer) {
    // @tonejs/midi global is `Midi` (also accessible as window.Midi)
    const MidiCtor = (typeof Midi !== "undefined") ? Midi : (typeof window !== "undefined" ? window.Midi : null);
    if (!MidiCtor) {
      throw new Error("@tonejs/midi not loaded (offline?)");
    }
    const midi = new MidiCtor(arrayBuffer);
    const ppq = midi.header.ppq || 480;
    const barTicks = ppq * 4;        // 4/4 assumed (1 bar = 4 quarter notes)
    const subTicks = ppq / 4;        // 16th-note grid

    // Find drum track. Priority order:
    // 1. Track with channel === 9 (MIDI channel 10, zero-indexed = drum channel)
    // 2. Track name contains "drum"/"kit"/"perc" (case-insensitive)
    // 3. Track with most notes mapping to known drum pitches in bar 1
    let drumTrack = null;
    let bestKnownCount = 0;
    for (const tr of midi.tracks) {
      if (!tr || !Array.isArray(tr.notes) || tr.notes.length === 0) continue;
      // ch 9 (= MIDI ch 10) is the GM drum channel
      const ch = (typeof tr.channel === "number") ? tr.channel : -1;
      const nm = (tr.name || "").toLowerCase();
      const isNamedDrum = /drum|kit|perc|beat/.test(nm);
      if (ch === 9 || isNamedDrum) {
        drumTrack = tr;
        break;
      }
      // Fallback heuristic: count bar-1 notes that fall on known drum pitches
      let knownCount = 0;
      for (const n of tr.notes) {
        if (n.ticks >= barTicks) break;
        if (MIDI_PITCH_TO_INST[n.midi]) knownCount++;
      }
      if (knownCount > bestKnownCount) {
        bestKnownCount = knownCount;
        drumTrack = tr;
      }
    }
    if (!drumTrack) return [];

    const events = [];
    for (const n of drumTrack.notes) {
      if (n.ticks >= barTicks) continue;  // only bar 1
      const inst = MIDI_PITCH_TO_INST[n.midi];
      if (!inst) continue;
      const beat = Math.floor(n.ticks / ppq);            // 0..3
      const remainder = n.ticks - beat * ppq;            // tick remainder within beat
      const sub = Math.floor(remainder / subTicks);      // 0..3 (16th grid)
      const subRemainder = remainder - sub * subTicks;   // ticks off the 16th grid
      // Convert off-grid ticks to micro-ms. We assume base BPM ~117 for the
      // rendered ms (band-room re-times these via beatTime/subTime at play
      // time, microMs is the residual jitter — same units as Dilla offsets).
      // ms_per_tick at 120 BPM = 500 ms / ppq. Use 500 as a reasonable
      // constant since microMs is treated as a sub-grid nudge anyway.
      const microMs = Math.round((subRemainder / ppq) * 500);
      // @tonejs/midi already normalizes velocity to 0..1
      const velocity = clamp(typeof n.velocity === "number" ? n.velocity : 0.7, 0.05, 1);
      events.push({
        instrument: inst,
        beat: clamp(beat, 0, 3),
        sub: clamp(sub, 0, 3),
        velocity,
        microMs,
        role: "midi_import"
      });
    }
    // Sort by absolute step so they replay in order (cosmetic; replay engine
    // doesn't strictly require order but it makes the data easier to inspect).
    events.sort((a, b) => (a.beat * 4 + a.sub) - (b.beat * 4 + b.sub));
    return events;
  }

  function midiImportInject() {
    if (!midiImportPendingEvents || midiImportPendingEvents.length === 0) {
      setMidiImportStatus("nothing to inject — load a .mid first");
      return;
    }
    const sec = currentSection();
    if (!sec || !state.songData) {
      setMidiImportStatus("no song loaded");
      return;
    }
    const frame = currentFrame();
    if (!frame || !Array.isArray(frame.events)) {
      setMidiImportStatus("no frame events to replace");
      return;
    }
    // Backup so we can reset later
    midiImportBackupEvents = JSON.parse(JSON.stringify(frame.events));
    midiImportTargetFrameId = frame.id;
    // Deep clone so future re-injects don't share references
    frame.events = JSON.parse(JSON.stringify(midiImportPendingEvents));
    const resetBtn = $("br-midi-import-reset");
    if (resetBtn) resetBtn.disabled = false;
    setMidiImportStatus(`✓ injected ${frame.events.length} events into '${frame.id}' (from ${midiImportSourceName || "midi"})`);
  }

  function midiImportReset() {
    if (!midiImportBackupEvents || !midiImportTargetFrameId || !state.songData) return;
    const frame = state.songData.frames.find((f) => f.id === midiImportTargetFrameId);
    if (frame) {
      frame.events = midiImportBackupEvents;
      setMidiImportStatus(`reset '${frame.id}' to original events`);
      midiImportBackupEvents = null;
      midiImportTargetFrameId = null;
      const resetBtn = $("br-midi-import-reset");
      if (resetBtn) resetBtn.disabled = true;
    }
  }

  // ---- v137: drum-floor mic follow ----------------------------
  // Tone.UserMedia で mic を聞いて、現在の演奏 RMS energy に応じて
  // scheduleBar の drum velocity を動的スケール。録音はしない、解析のみ。
  let micFollowMedia = null;
  let micFollowMeter = null;
  let micFollowRaf = 0;
  let micFollowEnergy = 0.5;  // 0..1 normalized (0.5 = neutral / no scale)

  function setMicFollowStatus(s) {
    const el = $("br-mic-follow-status");
    if (el) el.textContent = s || "";
  }

  async function enableMicFollow() {
    if (micFollowMedia) return;
    setMicFollowStatus("requesting mic permission…");
    try {
      ensureMaster();
      micFollowMedia = new Tone.UserMedia();
      await micFollowMedia.open();
      micFollowMeter = new Tone.Meter({ smoothing: 0.86 });
      micFollowMedia.connect(micFollowMeter);
      tickMicFollow();
      setMicFollowStatus("✓ mic active — playing with the drum-floor");
      $("br-mic-follow-enable").disabled = true;
      $("br-mic-follow-disable").disabled = false;
    } catch (e) {
      console.warn("[Band Room] mic follow failed:", e);
      setMicFollowStatus("permission denied or no mic: " + (e.message || e));
      micFollowMedia = null;
    }
  }

  function tickMicFollow() {
    if (!micFollowMeter) return;
    const dB = micFollowMeter.getValue();
    const normalized = Math.max(0, Math.min(1, (dB + 60) / 60));
    micFollowEnergy = normalized;
    const bar = $("br-mic-follow-bar");
    if (bar) {
      const pct = (normalized * 100).toFixed(1);
      bar.style.width = pct + "%";
      // 色: 静→accent、 激→warn
      bar.style.background = normalized > 0.7 ? "#ff5566" : (normalized > 0.4 ? "#ffb39a" : "#ff8866");
    }
    micFollowRaf = requestAnimationFrame(tickMicFollow);
  }

  function disableMicFollow() {
    cancelAnimationFrame(micFollowRaf);
    micFollowRaf = 0;
    if (micFollowMedia) {
      try { micFollowMedia.close(); } catch (e) {}
      try { micFollowMedia.dispose(); } catch (e) {}
      micFollowMedia = null;
    }
    if (micFollowMeter) {
      try { micFollowMeter.dispose(); } catch (e) {}
      micFollowMeter = null;
    }
    micFollowEnergy = 0.5;
    const bar = $("br-mic-follow-bar");
    if (bar) bar.style.width = "0%";
    setMicFollowStatus("disabled");
    $("br-mic-follow-enable").disabled = false;
    $("br-mic-follow-disable").disabled = true;
  }

  // micFollow energy + amount slider → velocity scaler (0.7..1.3 range)
  function micFollowVelocityScale() {
    if (!micFollowMedia) return 1.0;  // not active = no effect
    const amountEl = $("br-mic-follow-amount");
    const amount = amountEl ? Number(amountEl.value) / 100 : 0.5;
    // micFollowEnergy 0.5 = neutral、 1.0 = forte、 0.0 = pp
    // amount で振幅をスケール、最大 ±0.3 (= 30%)
    return 1.0 + (micFollowEnergy - 0.5) * 0.6 * amount;
  }

  // ---- v136 (+v139 expansion): Genre pattern picker ----------
  // presets/drum-patterns-genres/{boom-bap,four-on-floor,jazz-brush,dnb,
  //                               afro-cuban,reggaeton,breakbeat,trap,
  //                               soul-funk}.json
  // を 1 クリックで現 frame に inject。AI fill / MIDI import と同じ backup &
  // reset 機構を流用。
  let genrePickBackupEvents = null;
  let genrePickTargetFrameId = null;
  const FM_LINKED_GENRE_KEY = "band-room.fm-linked-genre";
  const FM_LINKED_GENRE_AT_KEY = "band-room.fm-linked-genre-at";
  const FM_LINKED_GENRE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

  function bandRoomPatternForFmGenre(genre) {
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
    return map[genre] || "";
  }

  function fmGenreForBandRoomPattern(pattern) {
    const map = {
      "boom-bap": "lofi",
      "jazz-brush": "jazz",
      "four-on-floor": "techno",
      "soul-funk": "funk",
      dnb: "techno",
      breakbeat: "lofi",
      trap: "techno",
      "afro-cuban": "funk",
      reggaeton: "funk"
    };
    return map[pattern] || "";
  }

  function setGenrePickStatus(s) {
    const el = $("br-genre-pick-status");
    if (el) el.textContent = s || "";
  }

  function refreshHazamaFmLinkForPattern(pattern = "") {
    const link = $("br-open-fm");
    if (!link) return;
    const fmGenre = fmGenreForBandRoomPattern(pattern);
    const params = new URLSearchParams();
    params.set("from", "band-room");
    if (fmGenre) params.set("g", fmGenre);
    link.href = fmGenre ? `fm.html?${params.toString()}` : "fm.html";
  }

  function switchToSynthMode() {
    const radio = document.querySelector('input[name=br-mode][value="synth"]');
    if (!radio) return;
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
  }

  function setFmSuggestionCta(genre, reason = "fm") {
    const panel = $("br-fm-suggestion");
    const text = $("br-fm-suggestion-text");
    const inject = $("br-fm-suggestion-inject");
    if (!panel || !text || !inject) return;
    if (!genre) {
      panel.hidden = true;
      inject.dataset.genre = "";
      return;
    }
    panel.hidden = false;
    inject.dataset.genre = genre;
    text.textContent = `FM suggests ${genre} (${reason})`;
  }

  function linkedGenreFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const explicit = params.get("pattern") || params.get("genrePattern") || params.get("brPattern");
      if (explicit && linkedGenreButton(explicit)) return explicit;
      const fmGenre = params.get("g") || params.get("genre") || "";
      const mapped = bandRoomPatternForFmGenre(fmGenre);
      return mapped && linkedGenreButton(mapped) ? mapped : "";
    } catch (e) {
      return "";
    }
  }

  function linkedSongFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("from") !== "drum-floor") return null;
      const songId = params.get("song") || params.get("songId") || "";
      if (!songId) return null;
      const bandId = params.get("band") || params.get("bandId") || state.currentBandId;
      const band = state.bandsRegistry?.bands?.[bandId] || currentBand();
      const song = Array.isArray(band?.songs)
        ? band.songs.find((item) => item.id === songId)
        : null;
      if (!song) return null;
      return { bandId: bandId || state.currentBandId, songId };
    } catch (e) {
      return null;
    }
  }

  async function loadGenrePattern(genre) {
    const frame = currentFrame();
    if (!frame || !state.songData) {
      setGenrePickStatus("no song loaded");
      return;
    }
    setGenrePickStatus(`loading ${genre}…`);
    try {
      const url = `presets/drum-patterns-genres/${genre}.json`;
      const res = await fetch(url + "?cb=" + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sourceFrames = data.frames || [];
      // Prefer a "verse"-role frame (= main groove), fall back to mid / first
      const sourceFrame = sourceFrames.find((f) => (f.role === "verse" || f.session_role === "verse"))
        || sourceFrames.find((f) => (f.role === "main" || f.session_role === "main"))
        || sourceFrames[Math.floor(sourceFrames.length / 2)]
        || sourceFrames[0];
      if (!sourceFrame || !Array.isArray(sourceFrame.events)) {
        setGenrePickStatus(`${genre}: no events in pattern`);
        return;
      }
      genrePickBackupEvents = JSON.parse(JSON.stringify(frame.events));
      genrePickTargetFrameId = frame.id;
      frame.events = JSON.parse(JSON.stringify(sourceFrame.events));
      const resetBtn = $("br-genre-pick-reset");
      if (resetBtn) resetBtn.disabled = false;
      refreshHazamaFmLinkForPattern(genre);
      setGenrePickStatus(`✓ ${genre} (${sourceFrame.events.length} events) → '${frame.id}'`);
    } catch (e) {
      console.warn("[Band Room] genre pattern load failed:", e);
      setGenrePickStatus(`${genre} load failed: ${e.message || e}`);
    }
  }

  function linkedGenreButton(genre) {
    return document.querySelector(`.br-genre-pick-btn[data-genre="${genre}"]`);
  }

  function clearFmLinkedGenreSuggestion() {
    document.querySelectorAll(".br-genre-pick-btn.is-suggested").forEach((btn) => {
      btn.classList.remove("is-suggested");
      if (btn.getAttribute("title") === "Suggested by Hazama FM") btn.removeAttribute("title");
    });
  }

  function maybeShowFmLinkedGenre(reason = "boot") {
    let genre = "";
    let at = 0;
    const urlGenre = linkedGenreFromUrl();
    try {
      if (urlGenre) {
        genre = urlGenre;
        at = Date.now();
        localStorage.setItem(FM_LINKED_GENRE_KEY, genre);
        localStorage.setItem(FM_LINKED_GENRE_AT_KEY, String(at));
      } else {
        genre = localStorage.getItem(FM_LINKED_GENRE_KEY) || "";
        at = Number(localStorage.getItem(FM_LINKED_GENRE_AT_KEY) || 0);
      }
    } catch (e) {
      genre = urlGenre;
      at = Date.now();
    }
    if (!genre) {
      setFmSuggestionCta("", reason);
      return;
    }
    clearFmLinkedGenreSuggestion();
    const btn = linkedGenreButton(genre);
    const stale = !urlGenre && at && Date.now() - at > FM_LINKED_GENRE_MAX_AGE_MS;
    if (!genre || !btn || stale) {
      if (!genrePickBackupEvents) setGenrePickStatus("no FM genre suggestion");
      setFmSuggestionCta("", reason);
      return;
    }
    setGenrePickStatus(`FM suggests ${genre} (${reason}) — tap its button to inject`);
    setFmSuggestionCta(genre, reason);
    refreshHazamaFmLinkForPattern(genre);
    btn.classList.add("is-suggested");
    btn.setAttribute("title", "Suggested by Hazama FM");
  }

  function genrePickReset() {
    if (!genrePickBackupEvents || !genrePickTargetFrameId || !state.songData) return;
    const frame = state.songData.frames.find((f) => f.id === genrePickTargetFrameId);
    if (frame) {
      frame.events = genrePickBackupEvents;
      setGenrePickStatus(`reset '${frame.id}' to original events`);
      genrePickBackupEvents = null;
      genrePickTargetFrameId = null;
      const resetBtn = $("br-genre-pick-reset");
      if (resetBtn) resetBtn.disabled = true;
    }
  }

  // ---- Boot ---------------------------------------------------

  // v79: keyboard shortcuts. Skipped when focus is inside a text input,
  // so typing in a file/textbox/select doesn't trigger transport actions.
  document.addEventListener("keydown", (e) => {
    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "?": {
        // v86: open quick help
        e.preventDefault();
        const ov = $("br-help-overlay");
        if (ov) ov.hidden = false;
        break;
      }
      case "Escape": {
        const ov = $("br-help-overlay");
        if (ov && !ov.hidden) {
          e.preventDefault();
          ov.hidden = true;
        }
        break;
      }
      case " ":
      case "Spacebar":
        e.preventDefault();
        togglePlay();
        break;
      case "[":
        // previous section
        e.preventDefault();
        if (state.songData) jumpToSection(Math.max(0, state.sectionIdx - 1));
        break;
      case "]":
        // next section
        e.preventDefault();
        if (state.songData) {
          const max = (state.songData.structure?.length || 1) - 1;
          jumpToSection(Math.min(max, state.sectionIdx + 1));
        }
        break;
      case "m":
      case "M": {
        // toggle mode
        const cur = currentMode === "stems" ? "synth" : "stems";
        const radio = document.querySelector(`input[name=br-mode][value="${cur}"]`);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change")); }
        break;
      }
      case "1": case "2": case "3": case "4":
      case "5": case "6": case "7": case "8":
      case "9": {
        // jump to section index (1-based)
        const idx = Number(e.key) - 1;
        if (state.songData?.structure?.[idx]) jumpToSection(idx);
        break;
      }
      default: {
        // v82: phrase keyboard mapping (q-p row 1, a-l + ; row 2)
        const k = e.key.toLowerCase();
        const phraseBtn = document.querySelector(
          `#br-phrase-grid button[data-phrase-key="${k}"]`
        );
        if (phraseBtn) {
          e.preventDefault();
          phraseBtn.click();
          phraseBtn.classList.add("kbd-flash");
          setTimeout(() => phraseBtn.classList.remove("kbd-flash"), 180);
        }
      }
    }
  });

  // v68: resume AudioContext when tab returns to foreground (mobile Safari
  // and Chrome suspend the audio graph when the tab is backgrounded —
  // this was the "途中で止まる" cause on mobile).
  document.addEventListener("visibilitychange", () => {
    if (!state.started) return;
    if (document.visibilityState === "visible") {
      handlePlaybackReturningForeground("visible");
    } else {
      handlePlaybackGoingBackground("hidden");
    }
  });

  window.addEventListener("pageshow", () => {
    handlePlaybackReturningForeground("pageshow");
  });

  window.addEventListener("pagehide", () => {
    handlePlaybackGoingBackground("pagehide");
  });

  window.addEventListener("focus", () => {
    handlePlaybackReturningForeground("focus");
  });

  window.addEventListener("blur", () => {
    handlePlaybackGoingBackground("blur");
  });

  document.addEventListener("freeze", () => {
    handlePlaybackGoingBackground("freeze");
  });

  document.addEventListener("resume", () => {
    handlePlaybackReturningForeground("resume");
  });

  // v97: load online-samples-catalog at boot so kit dropdown can include
  // CDN kits (no repo size impact — sample fetch happens on demand).
  async function loadOnlineCatalog() {
    try {
      const res = await fetch("presets/online-samples-catalog.json?cb=" + Date.now());
      if (!res.ok) return null;
      const data = await res.json();
      state.onlineCatalog = data;
      return data;
    } catch (e) {
      console.warn("[Band Room] online catalog load failed:", e);
      return null;
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    await loadOnlineCatalog();  // v97: before renderKitOptions so online kits appear
    renderKitOptions();
    await loadBandsRegistry();

    // Restore band-level prefs only. Track always starts at 01 on reload.
    const prefs = loadPrefs();
    if (prefs && prefs.bandId && state.bandsRegistry?.bands?.[prefs.bandId]) {
      const band = state.bandsRegistry.bands[prefs.bandId];
      const firstSong = firstSongForBand(band);
      if (firstSong) {
        state.currentBandId = prefs.bandId;
        state.currentSongId = firstSong.id;
        // Repaint selectors to reflect this band/song
        document.querySelectorAll("#br-band-select button").forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.band === prefs.bandId ? "true" : "false");
        });
        renderTrackButtons();
        syncTrackButtons();
        updateSubtitle();
      }
    }

    // v157: normal reload still starts at track 01, but a return from
    // drum-floor may deep-link the source Band Room song.
    const linkedSong = linkedSongFromUrl();
    if (linkedSong) {
      state.currentBandId = linkedSong.bandId;
      state.currentSongId = linkedSong.songId;
      document.querySelectorAll("#br-band-select button").forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.band === linkedSong.bandId ? "true" : "false");
      });
      renderTrackButtons();
      syncTrackButtons();
      updateSubtitle();
    }

    // Pre-load the default song meta (doesn't start audio)
    await loadSong(state.currentSongId);
    renderPhraseTrigger();
    maybeShowFmLinkedGenre("fm-link");
    window.addEventListener("storage", (event) => {
      if (event.key === FM_LINKED_GENRE_KEY || event.key === FM_LINKED_GENRE_AT_KEY) {
        maybeShowFmLinkedGenre("fm-live");
      }
    });

    // Apply slider/toggle/mode prefs AFTER UI is bound + selectors built
    applyPrefs(prefs);

    // Global save hook — any input/change anywhere in main triggers a
    // debounced write. Doesn't fire for child elements of #br-lyrics
    // (those don't have form inputs anyway).
    const m = $("br-main");
    if (m) {
      m.addEventListener("input", schedulePrefsSave);
      m.addEventListener("change", schedulePrefsSave);
    }
  });

})();
