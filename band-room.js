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
    kitSource: "auto-self", // default: use the current song's own extracted drum samples
                            // ("synth" = generic Tone.js voices, "<src>/<song>" = specific kit)
    kitProfile: "default",  // v91: synth voice profile (only applies when kitSource = "synth")
    // v99: per-voice overrides — kick だけ 808, snare だけ acoustic みたいに
    // 1 voice 単位で別 kit からピックできる。null = base kit を使う、文字列 = その kit id
    voiceOverrides: { kick: null, snare: null, hat: null, ghost: null, fill: null, crash: null },
    chordInstrument: null,  // v101: catalog instrument id for chord (null = synth)
    bassInstrument: null,   // v110: catalog instrument id for bass (null = synth)
    guitarInstrument: null, // v111: catalog instrument id for guitar (null = synth)
    voiceInstrument: null,  // v111: catalog instrument id for vocal/melody lead (null = synth)
    loopA: null,            // v80: A-B loop range (null = no loop)
    loopB: null
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
  let masterMeter = null;             // v71: master RMS meter for UI feedback
  let masterMeterRaf = 0;             // requestAnimationFrame id
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
    // v90: per-stem MediaStreamDestinations so each stem bus can be
    // captured independently for stems pack export. Drums/bass/other
    // tap their respective bus (post per-stem EQ, pre master FX) so
    // the user gets clean per-stem tracks for DAW import. Vocals
    // taps its post-FX bus (already FX'd; rarely useful to export
    // dry-only since vocal FX is part of the vocal sound).
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

    // v69: insert Tone.Panner per bus for AI 再現 stereo placement.
    // v104: rebalance — bus levels were skewed with chord/voice too quiet
    // and drums dominating. Adjust so the AI band sits balanced:
    //   drums 0.75 → 0.62 (was dominating)
    //   bass  0.65 → 0.72 (more presence)
    //   guitar 0.70 → 0.62
    //   voice 0.40 → 0.56 (guide should be audible)
    //   chord 0.55 → 0.68 (pad anchor)
    //   click 0.0 → 0.0 (default off; user enables via toggle + slider)
    const drumPan   = new Tone.Panner(0.00).connect(masterGain);
    const bassPan   = new Tone.Panner(0.00).connect(masterGain);
    const guitarPan = new Tone.Panner(-0.25).connect(masterGain);
    const voicePan  = new Tone.Panner(0.00).connect(masterGain);
    const chordPan  = new Tone.Panner(+0.20).connect(masterGain);
    const clickPan  = new Tone.Panner(0.00).connect(masterGain);
    drumBus = new Tone.Gain(0.62).connect(drumPan);
    bassBus = new Tone.Gain(0.72).connect(bassPan);
    guitarBus = new Tone.Gain(0.62).connect(guitarPan);
    voiceBus = new Tone.Gain(0.56).connect(voicePan);
    chordBus = new Tone.Gain(0.68).connect(chordPan);
    clickBus = new Tone.Gain(0.0).connect(clickPan);

    // Original-stem buses → per-stem EQ → masterGain
    // v131: drums/bass/other を slight boost (0.85 → 0.92) してカラオケ
    // (vocals OFF) 時の "痩せ" 感を補強。vocals は逆に下げる (0.85 → 0.72)
    // のを HTML slider default で対応。
    stemBus.drums  = new Tone.Gain(0.92).connect(masterGain);
    stemBus.bass   = new Tone.Gain(0.92).connect(masterGain);
    stemBus.other  = new Tone.Gain(0.92).connect(masterGain);
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

    stemBus.vocals = new Tone.Gain(0.72);  // v131: 0.85 → 0.72 (デフォ控えめ)

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

  function startExternalStemIfEnabled(stem) {
    const p = externalStemPlayers[stem];
    if (!p) return;
    const enabled = $(`br-toggle-external-${stem}`)?.checked;
    if (!enabled) return;
    try { p.start("+0.15"); } catch (e) {}
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
    "neutral":  { reverb: 22, width: 72, warmth: 10, loudness: 0,
                  synth_profile: "default",
                  chord_instrument: "", bass_instrument: "",
                  guitar_instrument: "", voice_instrument: "",
                  kit_source: null, guitar_on: true },
    "lo-fi":    { reverb: 32, width: 64, warmth: 24, loudness: -2,
                  synth_profile: "lofi-nujabes",
                  chord_instrument: "salamander-piano",
                  bass_instrument: "salamander-bass",
                  guitar_instrument: "guitar-nylon",
                  voice_instrument: "flute",
                  kit_source: "online/tone-breakbeat",
                  guitar_on: false },
    "club":     { reverb: 12, width: 88, warmth: 18, loudness: +3,
                  synth_profile: "sakanaction",
                  chord_instrument: "", bass_instrument: "",
                  guitar_instrument: "guitar-electric",
                  voice_instrument: "",
                  kit_source: "online/dirt-808",
                  guitar_on: true },
    "rock":     { reverb: 14, width: 65, warmth: 12, loudness: +1,
                  synth_profile: "cramps-punk",
                  chord_instrument: "", bass_instrument: "bass-electric",
                  guitar_instrument: "guitar-electric",
                  voice_instrument: "",
                  kit_source: "online/tone-acoustic",
                  guitar_on: true },
    "ambient":  { reverb: 55, width: 90, warmth: 22, loudness: -2,
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
        // v68: loop = true so practice/jam sessions don't go silent at song end.
        // v71: bump fadeIn/fadeOut so song-change crossfade is audible.
        const player = new Tone.Player({
          url, autostart: false, fadeIn: 0.15, fadeOut: 0.30, loop: true
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
    const semi = NOTE_SEMI[m[1]] || 7;
    return semiToNote(semi + 2 * 12); // C2 baseline
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
      renderSectionNav();  // v75: clickable section list
      updateMediaSession(state.started ? "playing" : "paused");  // v85: refresh OS metadata
      // Load lyrics from the band's lyrics_doc if present
      const lyricsDoc = band.lyrics_doc;
      if (lyricsDoc) {
        try {
          const lyricsRes = await fetch(lyricsDoc + "?cb=" + Date.now());
          if (lyricsRes.ok) {
            const md = await lyricsRes.text();
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
    // v75: refresh section nav chip active state
    document.querySelectorAll("#br-section-nav button").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.idx) === state.sectionIdx);
    });
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
    state.barCount = cum;
    state.sectionIdx = idx;
    state.sectionBarStart = cum;
    if (state.started) {
      // Reseek Transport to this section's start
      try { Tone.Transport.seconds = targetSec; } catch (e) {}
      // v109 fix: only seek/restart stem players in stems mode. In AI 再現
      // mode the stems aren't running and shouldn't be triggered by jump.
      if (currentMode === "stems") {
        Object.entries(stemPlayers).forEach(([stem, p]) => {
          if (!p) return;
          try {
            const enabled = $("br-toggle-stem-" + stem)?.checked !== false;
            p.stop();
            p.mute = !enabled;
            p.start("+0.05", targetSec);
          } catch (e) {}
        });
      }
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

  // ---- Scheduler ----------------------------------------------

  function scheduleBar() {
    // This fires once per bar. Reads current frame's events, schedules drums.
    state.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      let sec = currentSection();
      if (!sec) {
        // v68: loop to top of song instead of stopping (jam/practice mode)
        state.sectionIdx = 0;
        state.sectionBarStart = state.barCount;
        sec = currentSection();
        if (!sec) {
          if (state.started) stopPlayback();
          return;
        }
      }
      // Did we cross into next section?
      if (state.barCount - state.sectionBarStart >= sec.bars) {
        state.sectionIdx++;
        state.sectionBarStart = state.barCount;
        if (state.sectionIdx >= state.songData.structure.length) {
          // v68: loop to top of structure — stems already loop via player.loop=true
          state.sectionIdx = 0;
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
        frame.events.forEach((evt) => {
          const inst = drumKit[evt.instrument];
          if (!inst) return;
          const baseOffset = (evt.beat || 0) * beatTime + (evt.sub || 0) * subTime + (evt.microMs || 0) / 1000;
          // v118: micro-timing humanize — ±3 ms random jitter per hit so
          // 16-bar drum loops don't sound like a machine. Skip for kick
          // (kick on the grid feels stronger).
          const jitterMs = (evt.instrument === "kick") ? 0 : (Math.random() - 0.5) * 6;
          const t = time + baseOffset + jitterMs / 1000;
          const rawVel = clamp(evt.velocity ?? 0.5, 0.05, 1);
          // v118: velocity humanize — ±4% perturb, accent-friendly
          let vel = clamp(rawVel * (1 + (Math.random() - 0.5) * 0.08), 0.05, 1);
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

      // Bass — v112: pattern varies by master preset + profile.
      //   default / rock / club  → 8th-note root pulse (existing rock feel)
      //   lo-fi / ambient (Salamander piano bass) → walking pattern: root,
      //     5th, octave, 5th — one note per beat, smoother for jazz/lofi
      const chord = updateChordDisplay();
      if (isSynthMode && $("br-toggle-bass").checked && synthBass && chord) {
        const isJazzy = state.kitProfile === "lofi-nujabes" || state.bassInstrument === "salamander-bass";
        const rootNote = chordRoot(chord);
        if (isJazzy) {
          // Walking bass: root, 5th, root+oct, 5th — one note per beat
          const rootSemi = chordToSemi(chord);
          const notes = rootSemi != null ? [
            semiToNote(rootSemi),                    // beat 0: root
            semiToNote(rootSemi + 7),                // beat 1: 5th up
            semiToNote(rootSemi + 12),               // beat 2: octave
            semiToNote(rootSemi + 7)                 // beat 3: 5th
          ] : [rootNote, rootNote, rootNote, rootNote];
          for (let b = 0; b < 4; b++) {
            const t = time + b * beatTime;
            const accent = (b === 0 || b === 2);
            try { synthBass.triggerAttackRelease(notes[b], "4n", t, accent ? 0.62 : 0.50); } catch (e) {}
          }
        } else {
          // Rock 8th-note pulse
          for (let b = 0; b < 4; b++) {
            for (let s = 0; s < 2; s++) {
              const t = time + b * beatTime + s * (beatTime / 2);
              const accent = (s === 0);
              synthBass.triggerAttackRelease(rootNote, "8n", t, accent ? 0.7 : 0.45);
            }
          }
        }
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

      // Guitar — section-aware power-chord picking (UNRIPE drive)
      // verse: palm-mute 8th low velocity / prechorus: open 8th / chorus:
      // 16th furious / bridge: sparse stab / outro: 1 hit / intro: silent
      if (isSynthMode && $("br-toggle-guitar").checked && guitarSynth && chord && frame) {
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
      // v106: Human Fly chorus は専用 melody。他の曲 / 他 section は
      // generic walk-up fallback (chord tones in 4-step pattern).
      if (isSynthMode && $("br-toggle-voice").checked && voiceSynth && chord && frame) {
        const role = frame.session_role || "";
        const isHumanFlyChorus = state.currentSongId === "human-fly" && role === "recap";
        if (isHumanFlyChorus) {
          // Hardcoded Human Fly melody
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
        } else if (role === "verse" || role === "recap" || role === "comp") {
          // v106: Generic vocal walk — sing chord tones in 4-step pattern.
          // Pattern: root, 3rd, 5th, 3rd → repeats each bar.
          // Verse = softer (vel 0.45), chorus/recap = louder (vel 0.6).
          try {
            const notes = chordToNotes(chord, 4);
            if (notes.length >= 3) {
              const walk = [notes[0], notes[1], notes[2], notes[1]];
              const baseVel = role === "recap" ? 0.60 : role === "comp" ? 0.52 : 0.45;
              const barInSection = state.barCount - state.sectionBarStart;
              // Every 4th bar = "ah" sustain to feel like a phrase ending
              const isPhraseEnd = (barInSection + 1) % 4 === 0;
              if (isPhraseEnd) {
                // Long sustain on chord root
                try { voiceSynth.triggerAttackRelease(notes[0], "1n", time + 0.005, baseVel); } catch (e) {}
              } else {
                walk.forEach((note, i) => {
                  const t = time + i * beatTime;
                  const v = baseVel + (i === 0 ? 0.06 : 0);
                  try { voiceSynth.triggerAttackRelease(note, beatTime * 0.85, t, v); } catch (e) {}
                });
              }
            }
          } catch (e) {}
        }
      }

      // Chord guide — v112: jazzy voicing when piano sampler is loaded.
      //   default / rock / club  → simple triad on downbeat
      //   lo-fi / ambient (Salamander piano) → maj7/m7 voicing +
      //     anticipated comping (beat 0 + beat 2.5 instead of just 0)
      if (isSynthMode && $("br-toggle-chords").checked && chordSynth && chord) {
        try {
          const isJazzy = state.kitProfile === "lofi-nujabes" ||
                          state.chordInstrument === "salamander-piano";
          if (isJazzy) {
            // 7th extension: append maj7 (if major chord) or m7 (if minor)
            const ext = /m\b|min\b/.test(chord) ? "m7" : "maj7";
            const extChord = chord.replace(/(m|maj7|7|m7)?$/, ext);
            const notes = chordToNotes(extChord, 4);
            if (notes.length >= 3) {
              // Beat 0 stab + beat 2.5 anticipated comp
              chordSynth.triggerAttackRelease(notes, "2n", time + 0.005, 0.30);
              chordSynth.triggerAttackRelease(notes, "4n", time + 2.5 * beatTime, 0.22);
            }
          } else {
            const notes = chordToNotes(chord, 4);
            if (notes.length) {
              chordSynth.triggerAttackRelease(notes, "2n", time + 0.005, 0.34);
            }
          }
        } catch (e) {}
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
    if (!drumKit) drumKit = await buildKitForSource(state.kitSource);
    if (!synthBass) synthBass = makeSynthBass(bassBus);
    if (!guitarSynth) guitarSynth = makeGuitar(guitarBus);
    if (!voiceSynth) voiceSynth = makeVoiceBox(voiceBus);
    if (!chordSynth) chordSynth = makeChordSynth(chordBus);
    if (!clickSynth) clickSynth = makeClick(clickBus);

    // Load stems (if available for this song)
    await loadStemsForSong(state.currentSongId);

    // v104: reset state UNLESS the caller asked to preserve position
    // (jumpToSection while stopped → auto-start from that section)
    if (!opts.preservePosition) {
      state.barCount = 0;
      state.sectionIdx = 0;
      state.sectionBarStart = 0;
    }

    // v76: respect the tempo slider when starting (so re-start at 80% stays at 80%)
    const tempoMult = Number($("br-tempo-mult")?.value || 100) / 100;
    Tone.Transport.bpm.value = (state.songData.bpm || 117) * tempoMult;

    // v104: when starting from a non-zero section, seek Transport timeline
    if (opts.preservePosition && state.barCount > 0) {
      const bpm = state.songData.bpm || 117;
      const barDur = 60 / bpm * 4;
      try { Tone.Transport.seconds = state.barCount * barDur; } catch (e) {}
    }

    // Clear any old schedules
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];

    scheduleBar();
    Tone.Transport.start();
    const stemOffsetSec = opts.preservePosition && state.barCount > 0
      ? state.barCount * (60 / (state.songData.bpm || 117) * 4)
      : 0;
    if (currentMode === "stems") {
      startStemPlayback(stemOffsetSec);
      startExternalVocalIfEnabled();
      // v87: per-stem external replacements
      ["drums", "bass", "other"].forEach((s) => startExternalStemIfEnabled(s));
    }

    state.started = true;
    state.starting = false;
    setButtonState("playing");
    updateSectionDisplay();
    updateChordDisplay();
    startMasterMeter();
    // v73: highlight first section's lyric block
    const firstSec = currentSection();
    if (firstSec) updateLyricsHighlight(firstSec.section);
    // v85: tell the OS we're playing audio
    updateMediaSession("playing");
    // v88: start MIDI Clock if a MIDI output is selected
    if (midiOut) startMidiClock();
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

  function stopPlayback() {
    if (!state.started) return;
    try { Tone.Transport.stop(); } catch (e) {}
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];
    stopStemPlayback();
    stopExternalVocal();
    ["drums", "bass", "other"].forEach((s) => stopExternalStem(s)); // v87
    state.started = false;
    setButtonState("idle");
    stopMasterMeter();
    updateMediaSession("paused");
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
      if (wasPlaying) {
        // v71: graceful stem crossfade — start fadeOut on current stems,
        // wait for it to land, then stopPlayback (which disposes players).
        // The new song's stems fadeIn (0.15s) inside startPlayback.
        Object.values(stemPlayers).forEach((p) => {
          if (p) { try { p.stop(); } catch (e) {} }
        });
        await new Promise((r) => setTimeout(r, 320));
        stopPlayback();
      }
      await loadSong(btn.dataset.song);
      renderPhraseTrigger();
      // If kit was auto-self, dispose so new song's kit loads on next start
      if (state.kitSource === "auto-self" && drumKit && drumKit.dispose) {
        try { drumKit.dispose(); } catch (e) {}
        drumKit = null;
      }
      if (wasPlaying) await startPlayback();
      schedulePrefsSave();  // v78: persist song pick
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

    // v76: practice tempo — multiply base BPM (synth mode practice; in stems
    // mode it shifts pitch which the help text warns about).
    const tempoEl = $("br-tempo-mult");
    const tempoRead = $("br-tempo-mult-readout");
    if (tempoEl) {
      tempoEl.addEventListener("input", () => {
        const mult = Number(tempoEl.value) / 100;
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
        if (state.started) startExternalVocalIfEnabled();
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
          if (state.started) startExternalStemIfEnabled(stem);
        }
      };
      if (fileEl) {
        fileEl.addEventListener("change", async (e) => {
          await accept(e.target.files?.[0]);
        });
      }
      if (togEl) {
        togEl.addEventListener("change", () => {
          if (togEl.checked && state.started) startExternalStemIfEnabled(stem);
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
            // Switching to 原音 → start stems from current bar position
            const bpm = state.songData?.bpm || 117;
            const barDur = 60 / bpm * 4;
            const offsetSec = state.barCount * barDur;
            startStemPlayback(offsetSec);
            startExternalVocalIfEnabled();
            ["drums", "bass", "other"].forEach((s) => startExternalStemIfEnabled(s));
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
            lyrics_doc: "docs/tabasco-lyrics-v4-syllabic.md",
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
    schedulePrefsSave();  // v78: persist band/song switch
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
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (!state.started) startPlayback();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (state.started) stopPlayback();
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        if (state.started) stopPlayback();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        if (state.songData) jumpToSection(Math.max(0, state.sectionIdx - 1));
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (state.songData) {
          const max = (state.songData.structure?.length || 1) - 1;
          jumpToSection(Math.min(max, state.sectionIdx + 1));
        }
      });
      mediaSessionWired = true;
    } catch (e) {
      console.warn("[Band Room] mediaSession handlers failed:", e);
    }
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
  // Remember the last band, song, mode, kit, volumes, slider values
  // so the page restores its state on next visit.
  const PREFS_KEY = "band-room.prefs.v1";

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function savePrefs() {
    try {
      const prefs = {
        bandId: state.currentBandId,
        songId: state.currentSongId,
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
    // v101: chord instrument
    if (prefs.chordInstrument) {
      state.chordInstrument = prefs.chordInstrument;
      const sel = $("br-chord-instrument-select");
      if (sel) {
        sel.value = prefs.chordInstrument;
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v110: bass instrument
    if (prefs.bassInstrument) {
      state.bassInstrument = prefs.bassInstrument;
      const sel = $("br-bass-instrument-select");
      if (sel) {
        sel.value = prefs.bassInstrument;
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v111: guitar instrument
    if (prefs.guitarInstrument) {
      state.guitarInstrument = prefs.guitarInstrument;
      const sel = $("br-guitar-instrument-select");
      if (sel) {
        sel.value = prefs.guitarInstrument;
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v111: voice instrument
    if (prefs.voiceInstrument) {
      state.voiceInstrument = prefs.voiceInstrument;
      const sel = $("br-voice-instrument-select");
      if (sel) {
        sel.value = prefs.voiceInstrument;
        sel.dispatchEvent(new Event("change"));
      }
    }
  }

  // Save on any meaningful user change. Debounced so 100 slider drags
  // don't write 100 times.
  let savePrefsTimer = 0;
  function schedulePrefsSave() {
    clearTimeout(savePrefsTimer);
    savePrefsTimer = setTimeout(savePrefs, 400);
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
    if (document.visibilityState === "visible" && state.started) {
      try {
        if (Tone.context.state === "suspended") {
          Tone.context.resume();
        }
      } catch (e) {}
    }
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

    // v78: restore session — pick last band/song before pre-loading
    const prefs = loadPrefs();
    if (prefs && prefs.bandId && state.bandsRegistry?.bands?.[prefs.bandId]) {
      const band = state.bandsRegistry.bands[prefs.bandId];
      if (band.songs?.some((s) => s.id === prefs.songId)) {
        state.currentBandId = prefs.bandId;
        state.currentSongId = prefs.songId;
        // Repaint selectors to reflect this band/song
        document.querySelectorAll("#br-band-select button").forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.band === prefs.bandId ? "true" : "false");
        });
        renderTrackButtons();
        document.querySelectorAll("#br-track-select button").forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.song === prefs.songId ? "true" : "false");
        });
        updateSubtitle();
      }
    }

    // Pre-load the default song meta (doesn't start audio)
    await loadSong(state.currentSongId);
    renderPhraseTrigger();

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
