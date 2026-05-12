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

  // ---- State ---------------------------------------------------

  const state = {
    bandsRegistry: null,
    currentBandId: "tabasco",
    currentSongId: "human-fly",
    songData: null,
    started: false,
    starting: false,
    barCount: 0,
    sectionIdx: 0,
    sectionBarStart: 0,
    chordIdx: 0,
    chordBarsRemaining: 0,
    scheduledIds: [],
    kitSource: "auto-self"  // default: use the current song's own extracted drum samples
                            // ("synth" = generic Tone.js voices, "<src>/<song>" = specific kit)
  };

  // ---- Tone.js nodes -------------------------------------------

  let masterGain = null;
  let masterLimiter = null;
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

  // ---- Master setup -------------------------------------------

  function makeStemEQChain(stem) {
    // Returns { input, output } — caller connects player → input, output → bus
    if (stem === "drums") {
      const hp = new Tone.Filter({ frequency: 50, type: "highpass", Q: 0.6 });
      const eq = new Tone.EQ3({ low: 0.5, mid: 0, high: 1.5, lowFrequency: 250, highFrequency: 3000 });
      hp.connect(eq);
      return { input: hp, output: eq };
    }
    if (stem === "bass") {
      const hp = new Tone.Filter({ frequency: 30, type: "highpass", Q: 0.6 });
      const lp = new Tone.Filter({ frequency: 5000, type: "lowpass", Q: 0.6 });
      hp.connect(lp);
      return { input: hp, output: lp };
    }
    if (stem === "vocals") {
      const hp = new Tone.Filter({ frequency: 90, type: "highpass", Q: 0.6 });
      const presence = new Tone.EQ3({ low: 0, mid: 0.5, high: 2.0, lowFrequency: 400, highFrequency: 3000 });
      // Built-in de-esser: notch at ~6 kHz with low Q to gently tame sibilance
      const deEss = new Tone.Filter({ frequency: 6500, type: "peaking", Q: 1.2, gain: -2.5 });
      hp.connect(presence);
      presence.connect(deEss);
      return { input: hp, output: deEss };
    }
    // other
    const hp = new Tone.Filter({ frequency: 100, type: "highpass", Q: 0.6 });
    const shelf = new Tone.EQ3({ low: 0, mid: 0, high: 1.0, lowFrequency: 200, highFrequency: 5000 });
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
    masterLimiter = new Tone.Limiter({ threshold: -0.5 }).toDestination();
    const masterEq = new Tone.EQ3({ low: 1.4, mid: -0.4, high: 0.8, lowFrequency: 200, highFrequency: 5000 });
    const masterComp1 = new Tone.Compressor({ threshold: -14, ratio: 2.5, attack: 0.012, release: 0.22, knee: 6 });
    const masterComp2 = new Tone.Compressor({ threshold: -8,  ratio: 1.7, attack: 0.003, release: 0.10, knee: 4 });
    masterWidener = new Tone.StereoWidener(0.72);

    masterTapeSat = new Tone.Distortion({ distortion: 0.06, oversample: "2x", wet: 1 });
    masterTapeSatWet = new Tone.Gain(0.10);
    masterTapeSatDry = new Tone.Gain(0.90);

    masterReverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.025, wet: 1 });
    masterDryGain = new Tone.Gain(0.78);
    masterWetGain = new Tone.Gain(0.22);

    masterGain = new Tone.Gain(0.9);
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

    drumBus = new Tone.Gain(0.75).connect(masterGain);
    bassBus = new Tone.Gain(0.65).connect(masterGain);
    guitarBus = new Tone.Gain(0.70).connect(masterGain);
    voiceBus = new Tone.Gain(0.40).connect(masterGain);
    chordBus = new Tone.Gain(0.55).connect(masterGain);
    clickBus = new Tone.Gain(0.0).connect(masterGain);

    // Original-stem buses → per-stem EQ → masterGain
    stemBus.drums  = new Tone.Gain(0.85).connect(masterGain);
    stemBus.bass   = new Tone.Gain(0.85).connect(masterGain);
    stemBus.other  = new Tone.Gain(0.85).connect(masterGain);
    // Wire EQ outputs into respective buses (input side will receive players)
    stemEQs.drums.output.connect(stemBus.drums);
    stemEQs.bass.output.connect(stemBus.bass);
    stemEQs.other.output.connect(stemBus.other);

    // Vocal stem has its own FX chain — disguise / polish the raw vocal
    // before it reaches the master remaster.
    //
    // Chain: Tone.Player → [dry] + [chorus → delay → reverb (wet)] → vocalBus → masterGain
    vocalChorus = new Tone.Chorus({ frequency: 1.4, delayTime: 4.0, depth: 0.42, wet: 0.30 }).start();
    vocalDelay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.32, wet: 1 });
    vocalDelayWet = new Tone.Gain(0.18);  // delay send level
    vocalReverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.04, wet: 1 });
    vocalReverbWet = new Tone.Gain(0.28);  // reverb send level (stronger than master's)
    vocalDryGain = new Tone.Gain(0.78);

    stemBus.vocals = new Tone.Gain(0.85);  // output of vocal FX chain to master

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
    externalVocalBus = new Tone.Gain(0.85);
    externalVocalBus.connect(vocalChorus);
    return masterGain;
  }

  // Vocal phrase trigger — fire one-shot Tone.Player on click
  // Phrase samples are at presets/sample-kits/<source>/<song>/vocal-phrase-NN.wav
  // (summary.json has the list). Each plays through the same vocalChorus FX chain.
  const phrasePlayerPool = new Map();  // url → Tone.Player (cached)

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

    const phrases = summary && summary.vocal_phrases && summary.vocal_phrases.phrases;
    if (!phrases || phrases.length === 0) {
      const empty = document.createElement("span");
      empty.className = "br-phrase-empty";
      empty.textContent = "(no phrases extracted for this song)";
      grid.appendChild(empty);
      return;
    }

    phrases.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${(i + 1).toString().padStart(2, "0")}`;
      btn.title = `${p.duration_s}s @ ${p.src_start_s}s (RMS ${p.rms})`;
      btn.dataset.phraseUrl = `presets/sample-kits/${band}/${song}/${p.file}`;
      grid.appendChild(btn);
    });
  }

  function firePhrase(url) {
    if (!vocalChorus) ensureMaster();
    let player = phrasePlayerPool.get(url);
    if (!player) {
      player = new Tone.Player({
        url, autostart: false, retrigger: true, fadeIn: 0.01, fadeOut: 0.02
      }).connect(externalVocalBus || vocalChorus);
      phrasePlayerPool.set(url, player);
    }
    try {
      // If buffer not yet loaded, Tone.Player.start() throws — wait
      if (!player.buffer || !player.buffer.loaded) {
        Tone.loaded().then(() => {
          try { player.start("+0.005"); } catch (e) {}
        });
      } else {
        player.start("+0.005");
      }
    } catch (e) {
      console.warn("[Band Room] phrase fire failed:", e);
    }
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

  function startExternalVocalIfEnabled() {
    if (!externalVocalPlayer) return;
    const enabled = $("br-toggle-external-vocal")?.checked;
    if (!enabled) return;
    try {
      externalVocalPlayer.start("+0.15");
    } catch (e) {
      console.warn("[Band Room] external vocal start failed:", e);
    }
  }
  function stopExternalVocal() {
    if (!externalVocalPlayer) return;
    try { externalVocalPlayer.stop(); } catch (e) {}
  }

  // ---- Drum kit (tabasco-rock profile: LCD + Backdrop Bomb) ----

  function makeDrumKit(target) {
    // Kick: punchy modern, deep & tight (LCD/dance + rock)
    const kickPan = new Tone.Panner(0).connect(target);
    const kickClick = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.012 },
      volume: -32
    }).connect(kickPan);
    const kickBody = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.15 },
      volume: -8
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
    const snareHp = new Tone.Filter({ frequency: 1100, type: "highpass", Q: 0.8 }).connect(snareBus);
    const snareBody = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.06 },
      volume: -12
    }).connect(snareHp);
    const snareRim = new Tone.MetalSynth({
      frequency: 165,
      envelope: { attack: 0.001, decay: 0.04, release: 0.02 },
      harmonicity: 2.4,
      modulationIndex: 5,
      resonance: 1800,
      octaves: 0.5,
      volume: -28
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
    const hatBp = new Tone.Filter({ frequency: 6800, type: "bandpass", Q: 2.4 }).connect(hatBus);
    const hatNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.018 },
      volume: -22
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
      envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 },
      volume: -18
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

  // ---- Synth bass ----------------------------------------------

  function makeSynthBass(target) {
    // LCD-style analog synth bass: sub-y, slight saw warmth
    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: 480, Q: 1.4 },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.6, release: 0.15 },
      filterEnvelope: { attack: 0.003, decay: 0.12, sustain: 0.5, release: 0.12, baseFrequency: 120, octaves: 2.6 },
      portamento: 0.018,
      volume: -10
    }).connect(target);
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
  }

  function currentBand() {
    if (!state.bandsRegistry) return null;
    return state.bandsRegistry.bands[state.currentBandId] || null;
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
        const player = new Tone.Player({ url, autostart: false, fadeIn: 0.005, fadeOut: 0.02 }).connect(target);
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
    if (loaded === 0) {
      setStemsStatus("(stems not available — switch to AI 再現 mode)");
      return false;
    }
    setStemsStatus(`stems loaded (${loaded}/4)`);
    return true;
  }

  function startStemPlayback() {
    if (!stemPlayers.vocals && !stemPlayers.drums && !stemPlayers.bass && !stemPlayers.other) return false;
    // Sync start: schedule all at the same Transport position
    const startAt = "+0.15";  // small delay so all loaded buffers can fire together
    Object.entries(stemPlayers).forEach(([stem, player]) => {
      if (!player) return;
      try {
        const enabled = $("br-toggle-stem-" + stem)?.checked !== false;
        const muteVal = !enabled;
        player.mute = muteVal;
        player.start(startAt);
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
    const resolved = resolveKitSource(source);
    if (resolved === "synth" || !resolved) {
      return makeDrumKit(drumBus);
    }
    const kitPath = `presets/sample-kits/${resolved}`;
    const kit = makeSampledKit(drumBus, kitPath);
    try { await Tone.loaded(); } catch (e) {}
    return kit;
  }

  function makeSampledKit(target, kitPath) {
    // kitPath e.g. "presets/sample-kits/unripe/continuous"
    // Map drum-frames instrument names → sample files
    const mapping = {
      kick:  "kick-01.wav",
      snare: "snare-01.wav",
      hat:   "hat-01.wav",
      ghost: "snare-03.wav",   // softer snare for ghost notes
      fill:  "snare-02.wav",   // alternate snare as fill
      crash: "crash-01.wav"
    };
    const voices = {};
    Object.entries(mapping).forEach(([k, fname]) => {
      voices[k] = makeSampleVoice(target, `${kitPath}/${fname}`);
    });
    voices._kitPath = kitPath;
    voices.dispose = () => Object.values(voices).forEach((v) => v && v.dispose && v.dispose());
    return voices;
  }

  // ---- Distorted guitar (UNRIPE hardcore-postpunk drive) ------
  // Power chord (root + 5th + octave), saw + distortion + LP shimmer.
  // Section-aware picking: silent intro / palm-mute 8th verse / open
  // prechorus / 16th chorus / sparse bridge / hit outro.
  function makeGuitar(target) {
    const dist = new Tone.Distortion({ distortion: 0.55, wet: 0.85, oversample: "2x" });
    const lp = new Tone.Filter({ frequency: 4200, type: "lowpass", Q: 0.6 });
    const verb = new Tone.Reverb({ decay: 1.0, wet: 0.14 });
    const guitar = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.003, decay: 0.10, sustain: 0.55, release: 0.16 },
      volume: -12
    });
    guitar.maxPolyphony = 6;
    guitar.connect(dist);
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
    const verb = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).connect(target);
    const hp = new Tone.Filter({ frequency: 200, type: "highpass", Q: 0.5 }).connect(verb);
    // Two parallel formants — F1 around 700 Hz ("ah") + F2 around 1200 Hz
    const mix = new Tone.Gain(0.9).connect(hp);
    const formant1 = new Tone.Filter({ frequency: 700, type: "bandpass", Q: 5 }).connect(mix);
    const formant2 = new Tone.Filter({ frequency: 1200, type: "bandpass", Q: 5 }).connect(mix);

    const voice = new Tone.AMSynth({
      harmonicity: 2.4,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.06, decay: 0.32, sustain: 0.65, release: 0.45 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.4 },
      volume: -10
    });
    voice.connect(formant1);
    voice.connect(formant2);

    // Vibrato (5 Hz, ±10 cents)
    const vibrato = new Tone.LFO({ frequency: 5.0, min: -10, max: 10 });
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
    const verb = new Tone.Reverb({ decay: 1.6, wet: 0.20 }).connect(target);
    const chord = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.018, decay: 0.32, sustain: 0.45, release: 0.5 },
      volume: -16
    }).connect(verb);
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
    const semi = NOTE_SEMI[m[1]] || 7;
    return semiToNote(semi + 2 * 12); // C2 baseline
  }

  // ---- Load song ----------------------------------------------

  async function loadSong(songId) {
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
      state.songData = data;
      state.currentSongId = songId;
      $("br-bpm").textContent = data.bpm || "—";
      $("br-key").textContent = data.key || "—";
      // Load lyrics from the band's lyrics_doc if present
      const lyricsDoc = band.lyrics_doc;
      if (lyricsDoc) {
        try {
          const lyricsRes = await fetch(lyricsDoc + "?cb=" + Date.now());
          if (lyricsRes.ok) {
            const md = await lyricsRes.text();
            const lyrics = extractLyricsForSong(md, data.song_title || songId);
            $("br-lyrics-body").textContent = lyrics || `(lyrics todo — see ${lyricsDoc})`;
          }
        } catch (e) {
          $("br-lyrics-body").textContent = "(lyrics file not available offline)";
        }
      } else {
        $("br-lyrics-body").textContent = "(no lyrics doc for this band yet)";
      }
      return data;
    } catch (e) {
      console.warn("[Band Room] loadSong failed:", e);
      $("br-lyrics-body").textContent = "(failed to load song data: " + e.message + ")";
      return null;
    }
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

  function updateSectionDisplay() {
    const sec = currentSection();
    if (!sec) {
      $("br-section-name").textContent = "—";
      $("br-section-progress").textContent = "—";
      $("br-section-next-name").textContent = "—";
      return;
    }
    $("br-section-name").textContent = sec.section;
    const barInSection = state.barCount - state.sectionBarStart + 1;
    $("br-section-progress").textContent = `${barInSection} / ${sec.bars} bars`;
    const nextSec = state.songData.structure[state.sectionIdx + 1];
    $("br-section-next-name").textContent = nextSec ? nextSec.section : "(end)";
  }

  function updateChordDisplay() {
    const sec = currentSection();
    if (!sec || !state.songData.chord_progression) {
      $("br-chord-current").textContent = "—";
      return;
    }
    // Find section -> progression key
    const baseSection = sec.section.split("-")[0]; // "verse-1" → "verse"
    const prog = state.songData.chord_progression[baseSection];
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

  // ---- Scheduler ----------------------------------------------

  function scheduleBar() {
    // This fires once per bar. Reads current frame's events, schedules drums.
    state.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      const sec = currentSection();
      if (!sec) {
        // End of song — stop
        if (state.started) stopPlayback();
        return;
      }
      // Did we cross into next section?
      if (state.barCount - state.sectionBarStart >= sec.bars) {
        state.sectionIdx++;
        state.sectionBarStart = state.barCount;
        if (state.sectionIdx >= state.songData.structure.length) {
          stopPlayback();
          return;
        }
      }

      const frame = currentFrame();
      if (!frame || !Array.isArray(frame.events)) {
        state.barCount++;
        return;
      }

      const beatTime = Tone.Time("4n").toSeconds();
      const subTime = Tone.Time("16n").toSeconds();

      // Drums (only if toggle on)
      if ($("br-toggle-drums").checked && drumKit) {
        frame.events.forEach((evt) => {
          const inst = drumKit[evt.instrument];
          if (!inst) return;
          const offset = (evt.beat || 0) * beatTime + (evt.sub || 0) * subTime + (evt.microMs || 0) / 1000;
          const t = time + offset;
          const vel = clamp(evt.velocity ?? 0.5, 0.05, 1);
          if (evt.instrument === "kick") {
            inst.triggerAttackRelease("C1", "16n", t, vel);
          } else if (evt.instrument === "ghost") {
            inst.triggerAttackRelease("16n", t, vel, evt.role);
          } else {
            inst.triggerAttackRelease("16n", t, vel);
          }
        });
      }

      // Click (4 quarter notes per bar)
      if ($("br-toggle-click").checked && clickSynth) {
        for (let b = 0; b < 4; b++) {
          const t = time + b * beatTime;
          const accent = (b === 0);
          clickSynth.triggerAttackRelease(accent ? "C6" : "G5", "32n", t, accent ? 0.7 : 0.4);
        }
      }

      // Bass (8th-note root pulse on current chord)
      const chord = updateChordDisplay();
      if ($("br-toggle-bass").checked && synthBass && chord) {
        const rootNote = chordRoot(chord);
        for (let b = 0; b < 4; b++) {
          for (let s = 0; s < 2; s++) {
            const t = time + b * beatTime + s * (beatTime / 2);
            const accent = (s === 0);
            synthBass.triggerAttackRelease(rootNote, "8n", t, accent ? 0.7 : 0.45);
          }
        }
      }

      // Guitar — section-aware power-chord picking (UNRIPE drive)
      // verse: palm-mute 8th low velocity / prechorus: open 8th / chorus:
      // 16th furious / bridge: sparse stab / outro: 1 hit / intro: silent
      if ($("br-toggle-guitar").checked && guitarSynth && chord && frame) {
        const sectionName = (sec && sec.section) || "";
        const sessionRole = frame.session_role || "";
        let pattern = null;       // array of { sub, vel } where sub is 0..15 (16th-grid position in bar)
        let octave = 3;
        let dur = "16n";
        if (sessionRole === "intro") {
          pattern = null;
        } else if (sessionRole === "outro") {
          pattern = [{ sub: 0, vel: 0.85 }];
          dur = "1n";
        } else if (sessionRole === "break") {
          // bridge — sparse, beat 0 + 2 stabs only, low velocity
          pattern = [{ sub: 0, vel: 0.42 }, { sub: 8, vel: 0.40 }];
          dur = "4n";
        } else if (sessionRole === "verse") {
          // palm-mute 8th: 8 hits per bar at 0,2,4,...,14, velocity low
          pattern = [];
          for (let i = 0; i < 8; i++) pattern.push({ sub: i * 2, vel: 0.40 + (i % 2 === 0 ? 0.06 : 0) });
          dur = "8n";
        } else if (sessionRole === "comp") {
          // prechorus_build: 8th opening up
          pattern = [];
          for (let i = 0; i < 8; i++) pattern.push({ sub: i * 2, vel: 0.55 + (i % 2 === 0 ? 0.08 : 0.02) });
          dur = "8n";
        } else if (sessionRole === "recap") {
          // chorus: 16th furious power-chord drive
          pattern = [];
          for (let i = 0; i < 16; i++) {
            const accent = (i % 4 === 0);
            pattern.push({ sub: i, vel: accent ? 0.78 : 0.58 });
          }
          dur = "16n";
        } else {
          // Fallback: 8th picking
          pattern = [];
          for (let i = 0; i < 8; i++) pattern.push({ sub: i * 2, vel: 0.48 });
          dur = "8n";
        }
        if (pattern && pattern.length) {
          try {
            const notes = powerChordNotes(chord, octave);
            if (notes.length) {
              const sub16 = subTime;
              pattern.forEach((step) => {
                const t = time + step.sub * sub16;
                guitarSynth.triggerAttackRelease(notes, dur, t, step.vel);
              });
            }
          } catch (e) {}
        }
      }

      // Vocal guide (melody-only, 母音 "ah" voice-box).
      // Human Fly has hardcoded melody; other songs no melody-guide yet.
      // (Future: load song.melody_guide from JSON if present.)
      if ($("br-toggle-voice").checked && voiceSynth && state.currentSongId === "human-fly"
          && frame && frame.session_role === "recap") {
        const barInSection = state.barCount - state.sectionBarStart;
        const phraseBar = barInSection % 4;
        const phrase = (HUMAN_FLY_VOCAL_MELODY.chorus || [])[phraseBar];
        if (phrase) {
          phrase.forEach((step) => {
            const t = time + step.sub * subTime;
            const durSec = step.dur * subTime;
            try { voiceSynth.triggerAttackRelease(step.note, durSec * 0.95, t, 0.55); } catch (e) {}
          });
        }
      }

      // Chord guide (one chord per bar's downbeat)
      if ($("br-toggle-chords").checked && chordSynth && chord) {
        try {
          const notes = chordToNotes(chord, 4);
          if (notes.length) {
            chordSynth.triggerAttackRelease(notes, "2n", time + 0.005, 0.34);
          }
        } catch (e) {}
      }

      updateSectionDisplay();
      state.barCount++;
    }, "1m"));
  }

  // ---- Playback lifecycle -------------------------------------

  async function startPlayback() {
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
    if (!drumKit) drumKit = await buildKitForSource(state.kitSource);
    if (!synthBass) synthBass = makeSynthBass(bassBus);
    if (!guitarSynth) guitarSynth = makeGuitar(guitarBus);
    if (!voiceSynth) voiceSynth = makeVoiceBox(voiceBus);
    if (!chordSynth) chordSynth = makeChordSynth(chordBus);
    if (!clickSynth) clickSynth = makeClick(clickBus);

    // Load stems (if available for this song)
    await loadStemsForSong(state.currentSongId);

    // Reset state
    state.barCount = 0;
    state.sectionIdx = 0;
    state.sectionBarStart = 0;

    Tone.Transport.bpm.value = state.songData.bpm || 117;

    // Clear any old schedules
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];

    scheduleBar();
    Tone.Transport.start();
    if (currentMode === "stems") {
      startStemPlayback();
      startExternalVocalIfEnabled();
    }

    state.started = true;
    state.starting = false;
    setButtonState("playing");
    updateSectionDisplay();
    updateChordDisplay();
  }

  function stopPlayback() {
    if (!state.started) return;
    try { Tone.Transport.stop(); } catch (e) {}
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];
    stopStemPlayback();
    stopExternalVocal();
    state.started = false;
    setButtonState("idle");
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

    document.getElementById("br-band-select")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-band]");
      if (!btn || btn.disabled) return;
      selectBand(btn.dataset.band);
    });

    document.getElementById("br-track-select")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-song]");
      if (!btn || btn.disabled) return;
      document.querySelectorAll("#br-track-select button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      const wasPlaying = state.started;
      if (wasPlaying) stopPlayback();
      await loadSong(btn.dataset.song);
      renderPhraseTrigger();
      // If kit was auto-self, dispose so new song's kit loads on next start
      if (state.kitSource === "auto-self" && drumKit && drumKit.dispose) {
        try { drumKit.dispose(); } catch (e) {}
        drumKit = null;
      }
      if (wasPlaying) await startPlayback();
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
          const dryVal = 1 - wetVal * 0.5;  // keep dry mostly intact (overlap is fine)
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
          // Compensate dry path so total stays ~constant
          const w = Number(tapeWarmthEl.value) / 100;
          try { masterTapeSatDry.gain.rampTo(1 - w * 0.5, 0.12); } catch (e) {}
        }
      });
    }

    // v66: loudness (final master gain, dB → linear)
    const loudnessEl = $("br-loudness");
    if (loudnessEl) {
      loudnessEl.addEventListener("input", () => {
        ensureMaster();
        if (masterGain) {
          const dB = Number(loudnessEl.value);
          // 0 dB → 0.9 (default master gain); ±dB scales from there
          const linear = 0.9 * Math.pow(10, dB / 20);
          try { masterGain.gain.rampTo(linear, 0.10); } catch (e) {}
        }
      });
    }

    // External vocal upload + toggle + volume
    const extFile = $("br-external-vocal-file");
    if (extFile) {
      extFile.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) {
          ensureMaster();
          await loadExternalVocal(f);
          // Auto-toggle on after upload
          const tog = $("br-toggle-external-vocal");
          if (tog && !tog.checked) {
            tog.checked = true;
            // If playing, mute stem vocals so external takes over
            const stemTog = $("br-toggle-stem-vocals");
            if (stemTog) {
              stemTog.checked = false;
              if (stemPlayers.vocals) stemPlayers.vocals.mute = true;
            }
            if (state.started) startExternalVocalIfEnabled();
          }
        }
      });
    }
    const extToggle = $("br-toggle-external-vocal");
    if (extToggle) {
      extToggle.addEventListener("change", () => {
        if (extToggle.checked && state.started) startExternalVocalIfEnabled();
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

    // Mode radio (stems vs synth)
    document.querySelectorAll("input[name=br-mode]").forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        currentMode = radio.value;
        if (document.body) document.body.dataset.mode = currentMode;
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
            lyrics_doc: "docs/tabasco-lyrics-draft.md",
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
    if (!band.songs || band.songs.length === 0) return;
    if (state.started) stopPlayback();
    state.currentBandId = bandId;
    state.currentSongId = band.songs[0].id;
    document.querySelectorAll("#br-band-select button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.band === bandId ? "true" : "false");
    });
    renderTrackButtons();
    updateSubtitle();
    await loadSong(state.currentSongId);
    renderPhraseTrigger();
  }

  function renderKitOptions() {
    const sel = $("br-kit-source-select");
    if (!sel) return;
    sel.innerHTML = "";
    KIT_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === state.kitSource) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", async () => {
      const newSource = sel.value;
      const wasPlaying = state.started;
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
  }

  // ---- Boot ---------------------------------------------------

  window.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    renderKitOptions();
    await loadBandsRegistry();
    // Pre-load the default song meta (doesn't start audio)
    await loadSong(state.currentSongId);
    renderPhraseTrigger();
  });

})();
