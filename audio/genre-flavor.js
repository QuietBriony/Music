/* =========================================================
   Hazama FM — Genre Flavor Layer
   Lightweight Tone.js synths layered on top of engine.js.
   Independent from engine: own master Gain into Tone.Destination,
   own Tone.Transport schedules. Engine controls BPM globally.

   Each builder accepts an optional preset (loaded from
   window.HazamaPresets); when present, it's used to drive the
   synth, otherwise we fall back to the hand-coded default.

   Public API: window.GenreFlavor
     start()           — boot bus, ramp gain to working level
     stop()            — fade out, clear schedules
     setGenre(name)    — crossfade between genres (any|ambient|techno|lofi|jazz|funk|piano)
     dispose()         — full teardown
========================================================= */

(function () {
  "use strict";

  if (typeof window === "undefined" || typeof window.Tone === "undefined") return;
  if (window.GenreFlavor) return; // single-instance guard

  const Tone = window.Tone;

  // Working volume (linear gain). Sits near the engine without becoming the master.
  // The output follower below adds loudness gently, so keep per-layer headroom.
  const WORKING_LEVEL = 0.56;
  const FADE_IN_S = 2.5;
  const FADE_OUT_S = 1.6;
  const CROSSFADE_S = 1.5;
  const OUTPUT_FOLLOW_MIN = 0.34;
  const OUTPUT_FOLLOW_MAX = 1.28;

  // Per-genre master level override. Each builder has its own synth-voice
  // density (piano = 4–5 note chords vs ambient = 1-voice drone), so a
  // single WORKING_LEVEL across all genres makes some pills sound louder.
  // Tuned by ear so all GENRE pills land within ~2 dB of each other.
  const LEVEL_BY_GENRE = {
    any: 0.66,
    ambient: 0.62,
    techno: 0.70,
    lofi: 0.68,
    jazz: 0.72,
    funk: 0.70,
    piano: 0.50   // 4-5 note voicings → density high, drop ~2.5 dB relative to others
  };

  function workingLevelFor(name) {
    return (LEVEL_BY_GENRE[name] != null) ? LEVEL_BY_GENRE[name] : WORKING_LEVEL;
  }

  // Maps genre → preset name in HazamaPresets. Genres without a mapping
  // always use their default builder.
  const PRESET_BY_GENRE = {
    piano: "chill-piano-recipe",
    funk: "drum-frames-funk",
    techno: "drum-frames-techno",
    jazz: "drum-frames-jazz",
    lofi: "drum-frames-lofi",
    ambient: "namima-shape-ambient"
  };

  const FLAVOR_PROFILE_BY_GENRE = {
    any: {
      role: "Music radio brain only",
      edge: "50-minute engine arc with no extra FM flavor layer",
      feedback: "Core Rig faders and radio brain remain the source of truth"
    },
    ambient: {
      role: "namima-safe ambient surface",
      edge: "water/garden air, low pressure, public-friendly drift",
      feedback: "send calm mood and air hints toward namima"
    },
    techno: {
      role: "machine rhythm plus acid pulse",
      edge: "stripped four-on-floor body, sparse machine hat, resonant acid motion, high-BPM brain ratchets, and filtered chord lift",
      feedback: "send groove density and acid-source hints toward drum-floor/Music review"
    },
    lofi: {
      role: "dusty pocket memory and jazz-hop break surface",
      edge: "lazy live-break kit, vinyl crackle, filtered jazz chords, and softened top end",
      feedback: "send tape-memory and restraint hints toward Music/chill review"
    },
    jazz: {
      role: "walking-bass live writing room",
      edge: "live jazz kit, ride/brush motion, walking glue, sparse piano comp, and small session breaks",
      feedback: "send human pocket and phrase-space hints toward chill/drum-floor review"
    },
    funk: {
      role: "syncopated body pocket",
      edge: "live funk kit, behind-the-beat snare, rubber bass, EP color, clipped clavi, and pocket breaks",
      feedback: "send body-pocket and syncopation hints toward drum-floor review"
    },
    piano: {
      role: "chill quiet piano memory",
      edge: "foreground felt-piano strikes, planing color replies, memory answer, and long space",
      feedback: "send piano/trio and listening-space hints toward chill"
    }
  };

  // Master bus for all flavor synths.
  let master = null;
  let masterCompressor = null;
  let masterMakeup = null;
  let masterLimiter = null;
  let outputLevelInput = null;
  let outputLevelHandler = null;
  let started = false;
  let currentGenre = "any";
  let activeLayer = null; // { gain, synths[], scheduledIds[], dispose, source }

  function ensureMaster() {
    if (master) return master;
    masterCompressor = new Tone.Compressor({
      threshold: -18,
      ratio: 2.8,
      attack: 0.008,
      release: 0.18,
      knee: 12
    });
    masterMakeup = new Tone.Gain(1.08);
    masterLimiter = new Tone.Limiter({ threshold: -1.2 }).toDestination();
    master = new Tone.Gain(0).connect(masterCompressor);
    masterCompressor.connect(masterMakeup);
    masterMakeup.connect(masterLimiter);
    bindOutputLevelFollower();
    return master;
  }

  function outputLevelValue() {
    const slider = typeof document !== "undefined" ? document.getElementById("output_level") : null;
    const parsed = slider ? parseInt(slider.value, 10) : 96;
    return clamp(Number.isFinite(parsed) ? parsed : 96, 0, 100);
  }

  function targetMasterLevel() {
    const level = outputLevelValue() / 100;
    return clamp(OUTPUT_FOLLOW_MIN + level * (OUTPUT_FOLLOW_MAX - OUTPUT_FOLLOW_MIN), 0.0001, OUTPUT_FOLLOW_MAX);
  }

  function syncMasterLevel(seconds = 0.24) {
    if (!started || !master) return;
    try { master.gain.rampTo(targetMasterLevel(), seconds); } catch (e) {}
  }

  function bindOutputLevelFollower() {
    if (outputLevelInput || typeof document === "undefined") return;
    outputLevelInput = document.getElementById("output_level");
    if (!outputLevelInput) return;
    outputLevelHandler = () => syncMasterLevel(0.18);
    outputLevelInput.addEventListener("input", outputLevelHandler);
    outputLevelInput.addEventListener("change", outputLevelHandler);
  }

  function clearSchedules(ids) {
    if (!Array.isArray(ids)) return;
    ids.forEach((id) => {
      try { Tone.Transport.clear(id); } catch (e) {}
    });
  }

  function disposeSynths(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach((s) => {
      try { s.dispose && s.dispose(); } catch (e) {}
    });
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function safeEventTime(time, leadSeconds = 0.006) {
    const now = typeof Tone.now === "function" ? Tone.now() : 0;
    const candidate = Number.isFinite(time) ? time : now;
    return Math.max(candidate, now + leadSeconds);
  }

  // Cheap fifth lookup so namima's pad.baseNote can drive a P5 drone.
  const FIFTH_OF = {
    "C2":"G2","D2":"A2","E2":"B2","F2":"C3","G2":"D3","A2":"E3","B2":"F#3",
    "C3":"G3","D3":"A3","E3":"B3","F3":"C4","G3":"D4","A3":"E4","B3":"F#4"
  };
  function fifth(note) { return FIFTH_OF[note] || "A2"; }

  // ---- AMBIENT --------------------------------------------------

  function buildAmbientDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).connect(gain);
    const pad = new Tone.AMSynth({
      harmonicity: 1.5,
      oscillator: { type: "sine" },
      envelope: { attack: 4, decay: 0.5, sustain: 0.85, release: 6 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 3, decay: 0.5, sustain: 0.6, release: 4 },
      volume: -8
    }).connect(reverb);

    const ids = [];
    const droneTick = (time) => {
      const t = safeEventTime(time);
      pad.triggerAttackRelease("D2", "16m", t, 0.5);
      pad.triggerAttackRelease("A2", "16m", safeEventTime(t + 0.3), 0.45);
    };
    droneTick(Tone.Transport.now() + 0.1);
    ids.push(Tone.Transport.scheduleRepeat(droneTick, "16m"));

    return { gain, synths: [pad, reverb], scheduledIds: ids, source: "default" };
  }

  function buildAmbientFromShape(shape) {
    const presets = (shape && Array.isArray(shape.presets)) ? shape.presets : [];
    if (presets.length === 0) return buildAmbientDefault();
    const p = presets[0]; // first preset; rotation could be added later

    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const reverb = new Tone.Reverb({
      decay: p.reverb?.decay || 6,
      wet: clamp(p.reverb?.wet ?? 0.3, 0, 0.9)
    }).connect(gain);
    const lp = new Tone.Filter({
      frequency: p.filter?.lowpass?.freq || 2000,
      type: "lowpass",
      Q: p.filter?.lowpass?.Q || 0.6
    }).connect(reverb);
    const hp = new Tone.Filter({
      frequency: p.filter?.highpass?.freq || 220,
      type: "highpass",
      Q: p.filter?.highpass?.Q || 0.5
    }).connect(lp);

    const padCfg = p.pad || {};
    const pad = new Tone.AMSynth({
      harmonicity: 1.5,
      oscillator: { type: "sine" },
      envelope: {
        attack: padCfg.attack ?? 4,
        decay: padCfg.decay ?? 0.5,
        sustain: padCfg.sustain ?? 0.85,
        release: padCfg.release ?? 6
      },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 3, decay: 0.5, sustain: 0.6, release: 4 },
      volume: -8 + 6 * (clamp(padCfg.gain ?? 0.7, 0, 1) - 0.7)
    }).connect(hp);

    const baseNote = padCfg.baseNote || "D2";
    const ids = [];
    const droneTick = (time) => {
      const t = safeEventTime(time);
      pad.triggerAttackRelease(baseNote, "16m", t, 0.5);
      pad.triggerAttackRelease(fifth(baseNote), "16m", safeEventTime(t + 0.3), 0.45);
    };
    droneTick(Tone.Transport.now() + 0.1);
    ids.push(Tone.Transport.scheduleRepeat(droneTick, "16m"));

    // Air noise bed (continuous, very low).
    let air = null, airAmp = null;
    const airGain = p.air?.gain ?? 0;
    if (airGain > 0.01) {
      air = new Tone.Noise("pink");
      airAmp = new Tone.Gain(clamp(airGain * 0.05, 0, 0.08)).connect(hp);
      air.connect(airAmp);
      try { air.start(); } catch (e) {}
    }

    const synths = [pad, hp, lp, reverb];
    if (air) synths.push(air, airAmp);

    return {
      gain,
      synths,
      scheduledIds: ids,
      dispose: () => { if (air) try { air.stop(); } catch (e) {} },
      source: "namima-preset:" + (p.id || "?")
    };
  }

  function buildAmbient(shape) {
    if (shape && shape.format === "namima-ambient-tone-js") {
      try { return applyProductionGovernor(buildAmbientFromShape(shape), "ambient"); }
      catch (e) { console.warn("[GenreFlavor] ambient shape failed, fallback:", e); }
    }
    return applyProductionGovernor(buildAmbientDefault(), "ambient");
  }

  // ---- TECHNO ---------------------------------------------------

  function buildTechnoDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const kit = makeTechnoMachineKit(gain);

    const ids = [];
    let hatStep = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      kit.kick.triggerAttackRelease("C1", "8n", safeEventTime(time), 0.84);
    }, "4n"));
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      kit.hat.triggerAttackRelease("32n", safeEventTime(time), hatStep % 2 === 0 ? 0.42 : 0.24);
      hatStep++;
    }, "8n", "8n"));
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      kit.snare.triggerAttackRelease("16n", safeEventTime(time), 0.46);
    }, "2n", "4n"));

    return addAcidPulse({
      gain,
      synths: Object.values(kit),
      scheduledIds: ids,
      source: "default-machine"
    }, { source: "default-machine-acid" });
  }

  function makeMachineKick(gain) {
    const body = new Tone.MembraneSynth({
      pitchDecay: 0.085, octaves: 6,
      envelope: { attack: 0.001, decay: 0.48, sustain: 0, release: 0.18 },
      volume: -8
    }).connect(gain);
    const click = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.01 },
      volume: -30
    }).connect(gain);
    return {
      triggerAttackRelease(note, duration, time, velocity = 0.7) {
        const t = safeEventTime(time);
        body.triggerAttackRelease("C1", "8n", t, clamp(velocity, 0.05, 1));
        click.triggerAttackRelease("64n", safeEventTime(t + 0.004), clamp(velocity * 0.28, 0.02, 0.28));
      },
      dispose() {
        try { body.dispose(); } catch (e) {}
        try { click.dispose(); } catch (e) {}
      }
    };
  }

  function makeMachineClap(gain) {
    const body = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.075, sustain: 0, release: 0.035 },
      volume: -15
    }).connect(gain);
    const slap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.025 },
      volume: -21
    }).connect(gain);
    return {
      triggerAttackRelease(duration, time, velocity = 0.5) {
        const t = safeEventTime(time);
        body.triggerAttackRelease("32n", t, clamp(velocity * 0.8, 0.04, 0.75));
        slap.triggerAttackRelease("64n", safeEventTime(t + 0.018), clamp(velocity * 0.58, 0.03, 0.52));
      },
      dispose() {
        try { body.dispose(); } catch (e) {}
        try { slap.dispose(); } catch (e) {}
      }
    };
  }

  function makeMachineHat(gain) {
    const tickBus = new Tone.Gain(0.7).connect(gain);
    const hp = new Tone.Filter({ frequency: 7200, type: "bandpass", Q: 3.2 }).connect(tickBus);
    const body = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.008 },
      volume: -42
    }).connect(hp);
    const tick = new Tone.MetalSynth({
      frequency: 240,
      envelope: { attack: 0.001, decay: 0.022, release: 0.008 },
      harmonicity: 4.2,
      modulationIndex: 5.2,
      resonance: 2100,
      octaves: 0.55,
      volume: -37
    }).connect(tickBus);
    return {
      triggerAttackRelease(duration, time, velocity = 0.3) {
        const v = clamp(velocity, 0.03, 0.44);
        const t = safeEventTime(time);
        body.triggerAttackRelease("128n", t, v * 0.36);
        tick.triggerAttackRelease("128n", safeEventTime(t + 0.002), v * 0.42);
      },
      dispose() {
        try { body.dispose(); } catch (e) {}
        try { tick.dispose(); } catch (e) {}
        try { hp.dispose(); } catch (e) {}
        try { tickBus.dispose(); } catch (e) {}
      }
    };
  }

  function makeTechnoMachineKit(gain) {
    const ghost = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.025 },
      volume: -42
    }).connect(gain);
    const fill = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.035 },
      volume: -38
    }).connect(gain);
    const crash = new Tone.MetalSynth({
      frequency: 190,
      envelope: { attack: 0.001, decay: 0.7, release: 0.28 },
      harmonicity: 4.8,
      modulationIndex: 20,
      resonance: 3900,
      octaves: 1.8,
      volume: -42
    }).connect(gain);
    return {
      kick: makeMachineKick(gain),
      snare: makeMachineClap(gain),
      hat: makeMachineHat(gain),
      ghost,
      fill,
      crash
    };
  }

  function makeLiveKick(gain, profile = "funk") {
    const deep = profile === "funk";
    const body = new Tone.MembraneSynth({
      pitchDecay: deep ? 0.06 : 0.045,
      octaves: deep ? 4.2 : 2.4,
      envelope: { attack: 0.001, decay: deep ? 0.34 : 0.22, sustain: 0, release: deep ? 0.16 : 0.11 },
      volume: deep ? -10 : -13
    }).connect(gain);
    const skin = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.01 },
      volume: deep ? -34 : -38
    }).connect(gain);
    return {
      triggerAttackRelease(note, duration, time, velocity = 0.6) {
        const t = safeEventTime(time);
        body.triggerAttackRelease(profile === "jazz" ? "A1" : "C1", deep ? "8n" : "16n", t, clamp(velocity, 0.04, 0.95));
        skin.triggerAttackRelease("128n", safeEventTime(t + 0.003), clamp(velocity * 0.18, 0.01, 0.2));
      },
      dispose() {
        try { body.dispose(); } catch (e) {}
        try { skin.dispose(); } catch (e) {}
      }
    };
  }

  function makeLiveSnare(gain, profile = "funk") {
    const bus = new Tone.Gain(profile === "jazz" ? 0.62 : 0.82).connect(gain);
    const hp = new Tone.Filter({ frequency: profile === "lofi" ? 850 : 1300, type: "highpass", Q: 0.8 }).connect(bus);
    const body = new Tone.NoiseSynth({
      noise: { type: profile === "lofi" ? "pink" : "white" },
      envelope: {
        attack: 0.001,
        decay: profile === "jazz" ? 0.18 : profile === "lofi" ? 0.22 : 0.16,
        sustain: 0,
        release: profile === "lofi" ? 0.1 : 0.06
      },
      volume: profile === "jazz" ? -21 : profile === "lofi" ? -18 : -14
    }).connect(hp);
    const rim = new Tone.MetalSynth({
      frequency: profile === "funk" ? 170 : 145,
      envelope: { attack: 0.001, decay: 0.045, release: 0.018 },
      harmonicity: 2.4,
      modulationIndex: 5,
      resonance: profile === "lofi" ? 900 : 1600,
      octaves: 0.5,
      volume: profile === "jazz" ? -36 : -32
    }).connect(bus);
    return {
      triggerAttackRelease(duration, time, velocity = 0.5) {
        const t = safeEventTime(time);
        const v = clamp(velocity, 0.03, 0.9);
        body.triggerAttackRelease(profile === "jazz" ? "16n" : "32n", t, v * (profile === "jazz" ? 0.82 : 0.96));
        rim.triggerAttackRelease("128n", safeEventTime(t + 0.006), v * (profile === "funk" ? 0.32 : 0.2));
      },
      dispose() {
        try { body.dispose(); } catch (e) {}
        try { rim.dispose(); } catch (e) {}
        try { hp.dispose(); } catch (e) {}
        try { bus.dispose(); } catch (e) {}
      }
    };
  }

  function makeLiveHat(gain, profile = "funk") {
    const bus = new Tone.Gain(profile === "jazz" ? 0.72 : profile === "lofi" ? 0.46 : 0.58).connect(gain);
    const bp = new Tone.Filter({
      frequency: profile === "jazz" ? 5200 : profile === "lofi" ? 3600 : 6200,
      type: "bandpass",
      Q: profile === "jazz" ? 1.6 : 2.4
    }).connect(bus);
    const noise = new Tone.NoiseSynth({
      noise: { type: profile === "jazz" ? "pink" : "white" },
      envelope: {
        attack: profile === "jazz" ? 0.006 : 0.001,
        decay: profile === "jazz" ? 0.16 : profile === "lofi" ? 0.08 : 0.045,
        sustain: 0,
        release: profile === "jazz" ? 0.08 : 0.018
      },
      volume: profile === "jazz" ? -23 : profile === "lofi" ? -29 : -25
    }).connect(bp);
    const ping = new Tone.MetalSynth({
      frequency: profile === "jazz" ? 260 : 210,
      envelope: { attack: 0.001, decay: profile === "jazz" ? 0.24 : 0.055, release: 0.02 },
      harmonicity: profile === "jazz" ? 3.6 : 4.8,
      modulationIndex: profile === "jazz" ? 8 : 13,
      resonance: profile === "jazz" ? 2300 : 3200,
      octaves: profile === "jazz" ? 1.4 : 0.8,
      volume: profile === "jazz" ? -30 : -42
    }).connect(bus);
    return {
      triggerAttackRelease(duration, time, velocity = 0.28) {
        const t = safeEventTime(time);
        const v = clamp(velocity, 0.02, profile === "jazz" ? 0.68 : 0.48);
        noise.triggerAttackRelease(profile === "jazz" ? "8n" : "64n", t, v);
        if (profile === "jazz" || Math.random() < 0.32) ping.triggerAttackRelease("64n", safeEventTime(t + 0.004), v * 0.38);
      },
      dispose() {
        try { noise.dispose(); } catch (e) {}
        try { ping.dispose(); } catch (e) {}
        try { bp.dispose(); } catch (e) {}
        try { bus.dispose(); } catch (e) {}
      }
    };
  }

  function makeLiveDrumKit(gain, profile = "funk") {
    const ghost = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.004, decay: profile === "jazz" ? 0.18 : 0.095, sustain: 0, release: 0.045 },
      volume: profile === "jazz" ? -30 : profile === "lofi" ? -32 : -27
    }).connect(gain);
    const fill = new Tone.NoiseSynth({
      noise: { type: profile === "lofi" ? "pink" : "white" },
      envelope: { attack: 0.001, decay: profile === "jazz" ? 0.16 : 0.11, sustain: 0, release: 0.045 },
      volume: profile === "jazz" ? -24 : profile === "lofi" ? -24 : -19
    }).connect(gain);
    const crash = new Tone.MetalSynth({
      frequency: profile === "jazz" ? 145 : 175,
      envelope: { attack: 0.004, decay: profile === "jazz" ? 1.1 : 0.62, release: 0.3 },
      harmonicity: 4.4,
      modulationIndex: profile === "lofi" ? 10 : 18,
      resonance: profile === "jazz" ? 2400 : 3600,
      octaves: profile === "jazz" ? 2.1 : 1.3,
      volume: profile === "jazz" ? -33 : -36
    }).connect(gain);
    return {
      kick: makeLiveKick(gain, profile),
      snare: makeLiveSnare(gain, profile),
      hat: makeLiveHat(gain, profile),
      ghost,
      fill,
      crash
    };
  }

  // Shared drum kit for funk/techno frames builds.
  function makeDrumKit(gain, options = {}) {
    if (options.kit === "techno-machine") return makeTechnoMachineKit(gain);
    if (options.kit === "live-jazz") return makeLiveDrumKit(gain, "jazz");
    if (options.kit === "live-funk") return makeLiveDrumKit(gain, "funk");
    if (options.kit === "lofi-break") return makeLiveDrumKit(gain, "lofi");

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04, octaves: 2,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.12 },
      volume: -12
    }).connect(gain);
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
      volume: -16
    }).connect(gain);
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 },
      volume: -22
    }).connect(gain);
    const ghost = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 },
      volume: -28
    }).connect(gain);
    const fill = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 },
      volume: -18
    }).connect(gain);
    const crash = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
      volume: -22
    }).connect(gain);
    return { kick, snare, hat, ghost, fill, crash };
  }

  // Production aesthetic governor amounts per pill. Light wash that pulls
  // every genre toward a shared aesthetic — Aphex-style wrongness + D Angelo
  // behind-beat pocket — without changing the genre's identity.
  // See references/hazama-fm-pill-refs.json production_aesthetic_governors.
  const GOVERNOR_BY_PILL = {
    ambient: { rdj: 0.012, dangelo: 0.0 },
    techno:  { rdj: 0.035, dangelo: 0.0 },
    lofi:    { rdj: 0.030, dangelo: 0.5 },
    jazz:    { rdj: 0.022, dangelo: 0.5 },
    funk:    { rdj: 0.022, dangelo: 1.0 },
    piano:   { rdj: 0.018, dangelo: 0.2 },
    any:     { rdj: 0.025, dangelo: 0.0 }
  };

  function governorFor(pill) {
    return GOVERNOR_BY_PILL[pill] || GOVERNOR_BY_PILL.any;
  }

  // Build drum-frame–driven layer. Bar-by-bar scheduler advances through
  // the frames array and triggers each event at (beat*4n + sub*16n + microMs).
  //
  // Production governor (Aphex/D Angelo) is applied at the event level:
  //   - rdj amount: per-event probability of velocity dropout to 0.3x
  //     (creates the "1 hit missing" micro-wrongness)
  //   - dangelo amount: extra 2-7 ms behind-beat shift on snare/ghost
  //     (multiplied by amount; the per-frame microMs already encodes the
  //     baseline behind-beat character, this is wash on top)
  //
  // Break/recap dynamics: when frame.session_role === "break", the trailing
  // events are slightly attenuated (ためる), and when session_role === "recap"
  // velocities are boosted 1.12x to release the held tension.
  function buildDrumsFromFrames(framesData, options = {}) {
    const frames = (framesData && Array.isArray(framesData.frames)) ? framesData.frames : [];
    if (frames.length === 0) return null;

    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const kit = makeDrumKit(gain, options);

    const beatTime = Tone.Time("4n").toSeconds();
    const subTime = Tone.Time("16n").toSeconds();

    const rdj = clamp(options.governorRdj ?? 0, 0, 0.2);
    const dangelo = clamp(options.governorDangelo ?? 0, 0, 1.5);

    let frameIdx = 0;
    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      const frame = frames[frameIdx % frames.length];
      frameIdx++;
      if (!frame || !Array.isArray(frame.events)) return;
      const isBreak = frame.session_role === "break";
      const isRecap = frame.session_role === "recap";
      const eventCount = frame.events.length;
      frame.events.forEach((evt, evtIdx) => {
        if (options.minimalTechno) {
          if (evt.instrument === "ghost" || evt.instrument === "fill" || evt.instrument === "crash") return;
          if (evt.instrument === "hat" && evt.role !== "offbeat_tick" && evt.sub !== 2) return;
        }
        const synth = kit[evt.instrument];
        if (!synth) return;

        // D Angelo behind-beat wash — extra ms on snare/ghost only.
        let extraMs = 0;
        if (dangelo > 0 && (evt.instrument === "snare" || evt.instrument === "ghost")) {
          extraMs = (2 + Math.random() * 5) * dangelo;
        }

        const offset = (evt.beat || 0) * beatTime
                     + (evt.sub || 0) * subTime
                     + ((evt.microMs || 0) + extraMs) / 1000;
        const vel = clamp(evt.velocity ?? 0.5, 0.05, 1);
        let eventVel = vel;

        if (options.minimalTechno) {
          if (evt.instrument === "hat") eventVel = vel * 0.42;
          else if (evt.instrument === "snare") eventVel = vel * 0.76;
          else if (evt.instrument === "kick") eventVel = Math.min(1, vel * 1.06);
        }

        // ためる: tail dip on break frames (last ~25% of events fade to 0.55x)
        if (isBreak && evtIdx > eventCount * 0.75) {
          eventVel *= 0.55 + (eventCount - evtIdx) / eventCount * 0.3;
        }
        // 解放: recap frames lift 1.12x
        if (isRecap) {
          eventVel = Math.min(1, eventVel * 1.12);
        }

        // RDJ wrongness: occasional per-event velocity dropout to 0.3x
        if (rdj > 0 && Math.random() < rdj) {
          eventVel *= 0.3;
        }

        try {
          const eventTime = safeEventTime(time + offset);
          if (evt.instrument === "kick") {
            synth.triggerAttackRelease(options.kickNote || "C2", "16n", eventTime, eventVel);
          } else {
            synth.triggerAttackRelease("16n", eventTime, eventVel);
          }
        } catch (e) {}
      });
    }, "1m"));

    return {
      gain,
      synths: [kit.kick, kit.snare, kit.hat, kit.ghost, kit.fill, kit.crash],
      scheduledIds: ids,
      source: options.source || "drum-frames"
    };
  }

  // Public surface for the production aesthetic governor.
  // This is a labeling/no-op wrapper — the actual rdj/dangelo amounts are
  // baked into buildDrumsFromFrames options at construction. We keep this
  // function in the public path so the source string clearly indicates which
  // pill the governor wash targeted.
  function applyProductionGovernor(layer, pill) {
    if (!layer) return null;
    const gov = governorFor(pill);
    layer.source = `${layer.source || "layer"}+gov(${pill}:rdj=${gov.rdj.toFixed(3)},da=${gov.dangelo.toFixed(2)})`;
    return layer;
  }

  function addAcidPulse(layer, options = {}) {
    if (!layer) return null;
    const acid = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: 520, Q: 11.5 },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.12, release: 0.055 },
      filterEnvelope: {
        attack: 0.004,
        decay: 0.22,
        sustain: 0.08,
        release: 0.06,
        baseFrequency: 90,
        octaves: 4.6
      },
      portamento: 0.035,
      volume: options.volume ?? -20
    }).connect(layer.gain);
    const pattern = [
      "D2", null, "D2", "F2",
      null, "D2", "A1", "C2",
      "D2", "F2", null, "D2",
      "C2", "D2", null, "A1"
    ];
    let step = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      const note = pattern[step % pattern.length];
      const accent = step % 8 === 0 || step % 16 === 9;
      const gate = note && Math.random() < (accent ? 0.78 : 0.46);
      if (gate) {
        try {
          const eventTime = safeEventTime(time + 0.012 + Math.random() * 0.01);
          acid.filter.frequency.rampTo(accent ? 1520 : 740, 0.028);
          acid.triggerAttackRelease(note, accent ? "16n" : "32n", eventTime, accent ? 0.34 : 0.23);
          acid.filter.frequency.rampTo(300, 0.14);
        } catch (e) {}
      }
      step++;
    }, "16n"));
    layer.synths.push(acid);
    layer.source = options.source || "drum-frames+machine-acid";
    return layer;
  }

  function addBrainDanceRatchet(layer, options = {}) {
    if (!layer) return null;
    const ratchet = new Tone.MonoSynth({
      oscillator: { type: "square" },
      filter: { type: "lowpass", frequency: 760, Q: 7.6 },
      envelope: { attack: 0.002, decay: 0.035, sustain: 0, release: 0.018 },
      filterEnvelope: {
        attack: 0.001,
        decay: 0.052,
        sustain: 0,
        release: 0.018,
        baseFrequency: 180,
        octaves: 3.2
      },
      portamento: 0.012,
      volume: -28
    }).connect(layer.gain);
    const click = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.006 },
      volume: -42
    }).connect(layer.gain);
    const notes = ["D2", "D2", "F2", "A1", "C2", "D2", "F2", "D2"];
    let tick = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      const bpm = Number(Tone.Transport?.bpm?.value) || 0;
      const highBpm = clamp((bpm - 122) / 28, 0, 1);
      if (highBpm < 0.08) {
        tick++;
        return;
      }
      const phraseGate = tick % 4 === 1 || tick % 8 === 6 || Math.random() < 0.18;
      if (!phraseGate || Math.random() > 0.18 + highBpm * 0.34) {
        tick++;
        return;
      }
      const count = highBpm > 0.62 && Math.random() < 0.42 ? 3 : 2;
      const gap = 0.018 + (1 - highBpm) * 0.006;
      for (let i = 0; i < count; i++) {
        const ratchetTime = safeEventTime(time + 0.006 + i * gap + Math.random() * 0.004);
        const note = notes[(tick + i * 2) % notes.length];
        try {
          ratchet.filter.frequency.rampTo(i === 0 ? 960 : 1320, 0.014);
          ratchet.triggerAttackRelease(note, "128n", ratchetTime, 0.09 + highBpm * 0.08);
          if (Math.random() < 0.38 + highBpm * 0.18) {
            click.triggerAttackRelease("128n", safeEventTime(ratchetTime + 0.002), 0.07 + highBpm * 0.06);
          }
        } catch (e) {}
      }
      tick++;
    }, "8n", "16n"));
    layer.synths.push(ratchet, click);
    layer.source = options.source || `${layer.source || "drum-frames+machine-acid"}+brain`;
    return layer;
  }

  function addTechnoChordLift(layer) {
    if (!layer) return null;
    const hp = new Tone.Filter({ frequency: 360, type: "highpass", Q: 0.7 }).connect(layer.gain);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.18, wet: 0.18 }).connect(hp);
    const stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.006, decay: 0.18, sustain: 0, release: 0.12 },
      volume: -24
    }).connect(delay);
    stab.maxPolyphony = 5;
    const chords = [
      ["D3", "F3", "A3", "C4"],
      ["F3", "A3", "C4", "E4"],
      ["C3", "E3", "G3", "Bb3"],
      ["A2", "C3", "E3", "G3"]
    ];
    let bar = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (Math.random() < 0.34) {
        const chord = chords[bar % chords.length];
        try {
          stab.triggerAttackRelease(chord, "16n", safeEventTime(time + 0.012), 0.18 + Math.random() * 0.08);
        } catch (e) {}
      }
      bar++;
    }, "2m", "1m"));
    layer.synths.push(stab, delay, hp);
    layer.source = `${layer.source || "drum-frames+machine-acid-brain"}+chord-lift`;
    return layer;
  }

  function addSessionBreaks(layer, profile) {
    if (!layer) return null;
    const snare = new Tone.NoiseSynth({
      noise: { type: profile === "lofi" ? "pink" : "white" },
      envelope: { attack: 0.001, decay: profile === "jazz" ? 0.18 : 0.12, sustain: 0, release: 0.045 },
      volume: profile === "jazz" ? -26 : profile === "lofi" ? -25 : -20
    }).connect(layer.gain);
    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.055,
      octaves: profile === "funk" ? 3.2 : 2.4,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 },
      volume: profile === "funk" ? -18 : -22
    }).connect(layer.gain);
    const hats = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: profile === "jazz" ? 0.09 : 0.045, sustain: 0, release: 0.018 },
      volume: profile === "lofi" ? -34 : -30
    }).connect(layer.gain);
    let phrase = profile === "funk" ? 1 : 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      const active = profile === "jazz" ? phrase % 3 === 2 : profile === "lofi" ? phrase % 4 === 3 : phrase % 2 === 1;
      if (!active) {
        phrase++;
        return;
      }
      const base = safeEventTime(time + Tone.Time("2n").toSeconds() + Tone.Time("4n").toSeconds());
      const density = profile === "funk" ? 4 : profile === "jazz" ? 3 : 2;
      for (let i = 0; i < density; i++) {
        const dt = safeEventTime(base + i * (profile === "funk" ? 0.075 : 0.105) + Math.random() * 0.012);
        try {
          if (profile === "funk" && i % 2 === 0) tom.triggerAttackRelease(i === 0 ? "G1" : "C2", "32n", dt, 0.28 + Math.random() * 0.08);
          else snare.triggerAttackRelease("64n", dt, profile === "jazz" ? 0.16 + Math.random() * 0.07 : 0.2 + Math.random() * 0.1);
          if (Math.random() < (profile === "jazz" ? 0.6 : 0.38)) hats.triggerAttackRelease("64n", safeEventTime(dt + 0.018), 0.12 + Math.random() * 0.06);
        } catch (e) {}
      }
      phrase++;
    }, profile === "lofi" ? "4m" : "2m"));
    layer.synths.push(snare, tom, hats);
    layer.source = `${layer.source || "drum-frames"}+session-breaks`;
    return layer;
  }

  function addJazzComping(layer) {
    if (!layer) return null;
    const room = new Tone.Reverb({ decay: 1.4, wet: 0.16 }).connect(layer.gain);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.018, decay: 0.34, sustain: 0.08, release: 0.7 },
      volume: -15
    }).connect(room);
    piano.maxPolyphony = 6;
    const voicings = [
      ["F3", "A3", "C4", "E4"],
      ["E3", "G3", "B3", "D4"],
      ["A2", "G3", "C4", "F4"],
      ["D3", "F3", "A3", "C4"]
    ];
    let bar = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (Math.random() < 0.7) {
        const chord = voicings[bar % voicings.length];
        try {
          piano.triggerAttackRelease(chord, "2n", safeEventTime(time + 0.035 + Math.random() * 0.035), 0.19 + Math.random() * 0.07);
        } catch (e) {}
      }
      bar++;
    }, "1m", "2n"));
    layer.synths.push(piano, room);
    layer.source = `${layer.source || "drum-frames+walking-bass+brush"}+piano-comp`;
    return layer;
  }

  function addFunkRubberBass(layer) {
    if (!layer) return null;
    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", frequency: 540, Q: 2.8 },
      envelope: { attack: 0.004, decay: 0.16, sustain: 0.18, release: 0.08 },
      filterEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.06, release: 0.06, baseFrequency: 95, octaves: 3.1 },
      portamento: 0.035,
      volume: -13
    }).connect(layer.gain);
    const pattern = ["D2", null, "D2", "F2", "G2", null, "A1", "C2", "D2", "F2", null, "C2", "A1", null, "C2", "D2"];
    let step = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      const note = pattern[step % pattern.length];
      if (note && Math.random() < (step % 4 === 0 ? 0.86 : 0.58)) {
        try {
          bass.triggerAttackRelease(note, step % 2 === 0 ? "16n" : "32n", safeEventTime(time + 0.006 + Math.random() * 0.01), step % 4 === 0 ? 0.42 : 0.3);
        } catch (e) {}
      }
      step++;
    }, "16n"));
    layer.synths.push(bass);
    layer.source = `${layer.source || "drum-frames+ep+clavi"}+rubber-bass`;
    return layer;
  }

  function addLofiJazzDust(layer) {
    if (!layer) return null;
    const room = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).connect(layer.gain);
    const lp = new Tone.Filter({ frequency: 1800, type: "lowpass", Q: 0.6 }).connect(room);
    const keys = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.6,
      modulationIndex: 2.4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.035, decay: 0.28, sustain: 0.28, release: 0.9 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.02, decay: 0.16, sustain: 0.12, release: 0.5 },
      volume: -19
    }).connect(lp);
    keys.maxPolyphony = 5;
    const voicings = [
      ["D3", "F3", "A3", "C4"],
      ["G2", "F3", "A3", "C4"],
      ["C3", "E3", "Bb3", "D4"],
      ["A2", "G3", "C4", "E4"]
    ];
    let bar = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (Math.random() < 0.74) {
        try {
          keys.triggerAttackRelease(voicings[bar % voicings.length], "2n", safeEventTime(time + 0.055 + Math.random() * 0.035), 0.18 + Math.random() * 0.05);
        } catch (e) {}
      }
      bar++;
    }, "1m"));
    layer.synths.push(keys, lp, room);
    layer.source = `${layer.source || "drum-frames+vinyl-crackle"}+jazz-dust`;
    return layer;
  }

  function buildTechnoMachineFromFrames(frames) {
    const technoGov = governorFor("techno");
    const drums = buildDrumsFromFrames(frames, {
      kit: "techno-machine",
      minimalTechno: true,
      kickNote: "C1",
      governorRdj: technoGov.rdj,
      governorDangelo: technoGov.dangelo,
      source: "drum-frames+machine-minimal"
    });
    return applyProductionGovernor(
      addTechnoChordLift(
        addBrainDanceRatchet(
          addAcidPulse(drums, { source: "drum-frames+machine-acid-minimal", volume: -18 }),
          { source: "drum-frames+machine-acid-brain" }
        )
      ),
      "techno"
    );
  }

  function buildTechno(frames) {
    if (frames && frames.format === "drum-frames" && frames.genre === "techno") {
      try {
        const layer = buildTechnoMachineFromFrames(frames);
        if (layer) return layer;
      } catch (e) {
        console.warn("[GenreFlavor] techno frames failed, fallback:", e);
      }
    }
    return buildTechnoDefault();
  }

  // ---- LOFI -----------------------------------------------------

  function buildLofiDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const lp = new Tone.Filter({ frequency: 2400, type: "lowpass", Q: 0.6 }).connect(gain);
    const crackle = new Tone.Noise("pink");
    const crackleAmp = new Tone.Gain(0.06).connect(lp);
    crackle.connect(crackleAmp);
    crackle.start();
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.06, octaves: 4,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
      volume: -14
    }).connect(lp);

    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (Math.random() > 0.18) {
        kick.triggerAttackRelease("C2", "8n", safeEventTime(time), 0.55 + Math.random() * 0.15);
      }
    }, "4n"));

    return {
      gain,
      synths: [crackle, crackleAmp, kick, lp],
      scheduledIds: ids,
      dispose: () => { try { crackle.stop(); } catch (e) {} },
      source: "default"
    };
  }

  // Nujabes-style memory dots — sustained maj9/add9 voicings that occasionally
  // peek through the existing jazz dust. Volume -24 keeps it under the base
  // jazz chord (-19), so it reads as "気配のあるメモリ" rather than a second
  // chord layer. Reference: references/apple-music-refs.json (Nujabes /
  // Aruarian Dance, Feather) and references/hazama-fm-pill-refs.json.
  function addNujabesMemoryDots(layer) {
    if (!layer) return null;
    const room = new Tone.Reverb({ decay: 2.4, wet: 0.28 }).connect(layer.gain);
    const lp = new Tone.Filter({ frequency: 1500, type: "lowpass", Q: 0.5 }).connect(room);
    const memory = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.0,
      modulationIndex: 2.6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.08, decay: 0.4, sustain: 0.55, release: 1.8 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.05, decay: 0.3, sustain: 0.25, release: 1.2 },
      volume: -24
    }).connect(lp);
    memory.maxPolyphony = 5;
    // jazz-hop staples: Fmaj9 / Am11 / Dmaj13 / Bb7sus / Cmaj7add / Gm9
    const voicings = [
      ["F3", "A3", "C4", "E4", "G4"],   // Fmaj9
      ["A2", "G3", "C4", "E4", "B4"],   // Am11
      ["D3", "F#3", "A3", "C4", "E4"],  // Dmaj9 (color shift)
      ["Bb2", "F3", "A3", "Eb4"],       // Bb7sus
      ["C3", "G3", "B3", "D4", "F4"],   // Cmaj7add
      ["G2", "F3", "A3", "C4", "D4"]    // Gm9
    ];
    let phrase = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      // 4-bar phrase の最後の 2 拍に 30% で memory dot を入れる
      if (Math.random() < 0.32) {
        const voicing = voicings[phrase % voicings.length];
        try {
          memory.triggerAttackRelease(voicing, "1n", safeEventTime(time + 0.08), 0.16 + Math.random() * 0.04);
        } catch (e) {}
      }
      phrase++;
    }, "2m"));
    layer.synths.push(memory, lp, room);
    layer.source = `${layer.source || "lofi"}+nujabes-memory`;
    return layer;
  }

  // Nujabes-style flute lead — sparse top-line phrases that sit above
  // the memory dots / jazz dust. Sine-leaning FM with a breathy noise tail,
  // soft attack, light vibrato. Modal D dorian / Am pentatonic phrases.
  // Reference: Nujabes "Feather" (Modal Soul) sad-warm flute character.
  // Volume -19 dB foreground but sparse — only 28-38% probability each
  // 4-bar phrase window, with rests built into the phrase shapes.
  function addNujabesFluteLead(layer) {
    if (!layer) return null;
    const hall = new Tone.Reverb({ decay: 3.6, preDelay: 0.03, wet: 0.34 }).connect(layer.gain);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.18, wet: 0.16 }).connect(hall);
    const lp = new Tone.Filter({ frequency: 4200, type: "lowpass", Q: 0.4 }).connect(delay);
    const flute = new Tone.FMSynth({
      harmonicity: 1.0,
      modulationIndex: 1.6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.085, decay: 0.32, sustain: 0.62, release: 0.7 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.06, decay: 0.22, sustain: 0.4, release: 0.5 },
      volume: -19
    }).connect(lp);

    // Vibrato — 5 Hz pitch wobble for breath
    const vibrato = new Tone.LFO({ frequency: 5.2, min: -7, max: 7 });
    try {
      vibrato.connect(flute.detune);
      vibrato.start();
    } catch (e) {}

    // Breath noise sidechain — fires under each note attack
    const breathFilter = new Tone.Filter({ frequency: 3800, type: "bandpass", Q: 1.2 }).connect(lp);
    const breath = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.04, decay: 0.18, sustain: 0.05, release: 0.3 },
      volume: -36
    }).connect(breathFilter);

    // Nujabes-style phrases — D dorian / A minor pentatonic with rests.
    // dur in 4n (beats). 0-duration entries are explicit rests.
    const phrases = [
      // Aruarian Dance-ish ascending question
      [{ note: "D4", dur: 1 }, { note: "F4", dur: 1 }, { note: "A4", dur: 2 }],
      // Feather-ish descending answer
      [{ note: "C5", dur: 1 }, { note: "A4", dur: 1 }, { note: "G4", dur: 1 }, { note: "F4", dur: 2 }],
      // Half-step sigh with hold
      [{ note: "D4", dur: 0.5 }, { note: "F4", dur: 0.5 }, { note: "G4", dur: 1 }, { note: "A4", dur: 2 }],
      // Long sustain over chord change
      [{ note: "F4", dur: 4 }],
      // Modal phrase ascending then resting on 5
      [{ note: "A4", dur: 1 }, { note: "G4", dur: 0.5 }, { note: "F4", dur: 0.5 }, { note: "D4", dur: 2 }],
      // High pickup → low rest (sparse)
      [{ note: "C5", dur: 0.5 }, { note: "A4", dur: 1.5 }],
      // Open-fifth question
      [{ note: "D4", dur: 1 }, { note: "A4", dur: 3 }]
    ];

    const beatSec = Tone.Time("4n").toSeconds();
    let phraseIdx = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      // 4-bar phrase window; flute speaks on 30-38% of windows
      if (Math.random() < 0.34) {
        const phrase = phrases[phraseIdx % phrases.length];
        let offset = 0.06 + Math.random() * 0.04; // light upbeat lag
        phrase.forEach((step) => {
          if (step.note) {
            const t = safeEventTime(time + offset);
            const dur = step.dur * beatSec;
            const vel = 0.42 + Math.random() * 0.1;
            try {
              flute.triggerAttackRelease(step.note, dur * 0.9, t, vel);
              breath.triggerAttackRelease(dur * 0.6, t, vel * 0.5);
            } catch (e) {}
          }
          offset += step.dur * beatSec;
        });
      }
      phraseIdx++;
    }, "4m", "1m"));

    layer.synths.push(flute, vibrato, breath, breathFilter, lp, delay, hall);
    const prevDispose = layer.dispose;
    layer.dispose = () => {
      try { vibrato.stop(); } catch (e) {}
      if (prevDispose) prevDispose();
    };
    layer.source = `${layer.source || "lofi"}+nujabes-flute`;
    return layer;
  }

  // When drum-frames-lofi preset is present, render the lazy frame rhythm
  // PLUS the vinyl crackle bed for the dusty character.
  function buildLofiFromFrames(frames) {
    const lofiGov = governorFor("lofi");
    const drums = buildDrumsFromFrames(frames, {
      kit: "lofi-break",
      governorRdj: lofiGov.rdj,
      governorDangelo: lofiGov.dangelo,
      source: "drum-frames+dusty-break-kit"
    });
    if (!drums) return null;

    const lp = new Tone.Filter({ frequency: 2400, type: "lowpass", Q: 0.6 }).connect(drums.gain);
    const crackle = new Tone.Noise("pink");
    const crackleAmp = new Tone.Gain(0.06).connect(lp);
    crackle.connect(crackleAmp);
    try { crackle.start(); } catch (e) {}

    drums.synths.push(crackle, crackleAmp, lp);
    const prevDispose = drums.dispose;
    drums.dispose = () => {
      try { crackle.stop(); } catch (e) {}
      if (prevDispose) prevDispose();
    };
    drums.source = "drum-frames+dusty-break-kit+vinyl-crackle";
    return applyProductionGovernor(
      addSessionBreaks(
        addNujabesFluteLead(
          addNujabesMemoryDots(
            addLofiJazzDust(drums)
          )
        ),
        "lofi"
      ),
      "lofi"
    );
  }

  function buildLofi(frames) {
    if (frames && frames.format === "drum-frames" && frames.genre === "lofi") {
      try {
        const layer = buildLofiFromFrames(frames);
        if (layer) return layer;
      } catch (e) {
        console.warn("[GenreFlavor] lofi frames failed, fallback:", e);
      }
    }
    return buildLofiDefault();
  }

  // ---- JAZZ -----------------------------------------------------

  function buildJazzDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const room = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).connect(gain);

    const brushHi = new Tone.Filter({ frequency: 4600, type: "lowpass" });
    const brushLo = new Tone.Filter({ frequency: 1200, type: "highpass" });
    brushHi.connect(brushLo).connect(room);
    const brush = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.07, decay: 0.32, sustain: 0, release: 0.12 },
      volume: -19
    }).connect(brushHi);

    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", frequency: 720, Q: 0.9 },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0.45, release: 0.28 },
      filterEnvelope: { attack: 0.012, decay: 0.22, sustain: 0.32, release: 0.3, baseFrequency: 220, octaves: 2.4 },
      volume: -12
    }).connect(room);

    const walk = ["D2", "F2", "G2", "A2", "C3", "A2", "G2", "F2"];
    let walkIdx = 0;
    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      bass.triggerAttackRelease(walk[walkIdx % walk.length], "8n", safeEventTime(time), 0.6);
      walkIdx++;
    }, "4n"));

    const brushPattern = [1, 0, 1, 0, 1, 0, 1, 1];
    let brushIdx = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (brushPattern[brushIdx % brushPattern.length]) {
        const vel = 0.18 + Math.random() * 0.08;
        const jitter = (Math.random() - 0.5) * 0.012;
        brush.triggerAttackRelease("16n", safeEventTime(time + jitter), vel);
      }
      brushIdx++;
    }, "8n"));

    return { gain, synths: [brush, brushHi, brushLo, bass, room], scheduledIds: ids, source: "default" };
  }

  // When drum-frames-jazz preset is present, render the frame rhythm AND
  // keep the walking bass plus a low brush layer. The brush sits behind the
  // frame hats so jazz reads as live pocket instead of just a drum preset.
  function buildJazzFromFrames(frames) {
    const jazzGov = governorFor("jazz");
    const drums = buildDrumsFromFrames(frames, {
      kit: "live-jazz",
      governorRdj: jazzGov.rdj,
      governorDangelo: jazzGov.dangelo,
      source: "drum-frames+live-jazz-kit"
    });
    if (!drums) return null;

    const room = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).connect(drums.gain);
    const brushHi = new Tone.Filter({ frequency: 5000, type: "lowpass" });
    const brushLo = new Tone.Filter({ frequency: 1300, type: "highpass" });
    brushHi.connect(brushLo).connect(room);
    const brush = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.045, decay: 0.24, sustain: 0, release: 0.08 },
      volume: -27
    }).connect(brushHi);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", frequency: 720, Q: 0.9 },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0.45, release: 0.28 },
      filterEnvelope: { attack: 0.012, decay: 0.22, sustain: 0.32, release: 0.3, baseFrequency: 220, octaves: 2.4 },
      volume: -14
    }).connect(room);

    const walk = ["D2", "F2", "G2", "A2", "C3", "A2", "G2", "F2"];
    let walkIdx = 0;
    drums.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      bass.triggerAttackRelease(walk[walkIdx % walk.length], "8n", safeEventTime(time), 0.55);
      walkIdx++;
    }, "4n"));
    const brushPattern = [1, 0, 1, 0, 1, 0, 1, 1];
    let brushIdx = 0;
    drums.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (brushPattern[brushIdx % brushPattern.length]) {
        const jitter = (Math.random() - 0.5) * 0.014;
        brush.triggerAttackRelease("16n", safeEventTime(time + jitter), 0.12 + Math.random() * 0.06);
      }
      brushIdx++;
    }, "8n", "8n"));
    drums.synths.push(brush, brushHi, brushLo, bass, room);
    drums.source = "drum-frames+live-jazz-kit+walking-bass+brush";
    return applyProductionGovernor(addSessionBreaks(addJazzComping(drums), "jazz"), "jazz");
  }

  function buildJazz(frames) {
    if (frames && frames.format === "drum-frames" && frames.genre === "jazz") {
      try {
        const layer = buildJazzFromFrames(frames);
        if (layer) return layer;
      } catch (e) {
        console.warn("[GenreFlavor] jazz frames failed, fallback:", e);
      }
    }
    return buildJazzDefault();
  }

  // ---- FUNK -----------------------------------------------------

  function buildFunkDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const claviFilter = new Tone.Filter({ frequency: 2100, type: "lowpass", Q: 1.4 }).connect(gain);
    const clavi = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.001, decay: 0.09, sustain: 0.0, release: 0.04 },
      volume: -14
    }).connect(claviFilter);
    clavi.maxPolyphony = 6;
    const epRoom = new Tone.Reverb({ decay: 1.2, wet: 0.2 }).connect(gain);
    const ep = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.04, decay: 0.6, sustain: 0.6, release: 1.5 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.06, decay: 0.5, sustain: 0.32, release: 1.1 },
      volume: -16
    }).connect(epRoom);
    ep.maxPolyphony = 6;

    const dmin7 = ["D3", "F3", "A3", "C4"];
    const ids = [];
    const claviPattern = [1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0];
    let claviIdx = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (claviPattern[claviIdx % claviPattern.length]) {
        const note = dmin7[Math.floor(Math.random() * dmin7.length)];
        clavi.triggerAttackRelease(note, "32n", safeEventTime(time), 0.45 + Math.random() * 0.15);
      }
      claviIdx++;
    }, "16n"));
    let epBar = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (epBar % 2 === 0) ep.triggerAttackRelease(dmin7, "1m", safeEventTime(time), 0.35);
      epBar++;
    }, "1m"));

    return { gain, synths: [clavi, claviFilter, ep, epRoom], scheduledIds: ids, source: "default" };
  }

  // When drum frames are present, render the frame rhythm AND keep the EP
  // chord layer plus a quiet clavi. The clavi is sparse so it adds funk
  // articulation without flattening the frame timing.
  function buildFunkFromFrames(frames) {
    const funkGov = governorFor("funk");
    const drums = buildDrumsFromFrames(frames, {
      kit: "live-funk",
      governorRdj: funkGov.rdj,
      governorDangelo: funkGov.dangelo,
      source: "drum-frames+live-funk-kit"
    });
    if (!drums) return null;

    const claviFilter = new Tone.Filter({ frequency: 2400, type: "lowpass", Q: 1.5 }).connect(drums.gain);
    const clavi = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.035 },
      volume: -21
    }).connect(claviFilter);
    clavi.maxPolyphony = 4;
    const epRoom = new Tone.Reverb({ decay: 1.2, wet: 0.2 }).connect(drums.gain);
    const ep = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.04, decay: 0.6, sustain: 0.6, release: 1.5 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.06, decay: 0.5, sustain: 0.32, release: 1.1 },
      volume: -18
    }).connect(epRoom);
    ep.maxPolyphony = 6;

    const dmin7 = ["D3", "F3", "A3", "C4"];
    const claviPattern = [1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0];
    let claviIdx = 3;
    drums.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (claviPattern[claviIdx % claviPattern.length] && Math.random() > 0.2) {
        const note = dmin7[(claviIdx + Math.floor(Math.random() * 2)) % dmin7.length];
        const push = (Math.random() - 0.5) * 0.012;
        clavi.triggerAttackRelease(note, "32n", safeEventTime(time + push), 0.22 + Math.random() * 0.08);
      }
      claviIdx++;
    }, "16n"));
    let epBar = 0;
    drums.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (epBar % 2 === 0) ep.triggerAttackRelease(dmin7, "1m", safeEventTime(time), 0.32);
      epBar++;
    }, "1m"));
    drums.synths.push(clavi, claviFilter, ep, epRoom);
    drums.source = "drum-frames+live-funk-kit+ep+clavi";
    return applyProductionGovernor(addSessionBreaks(addFunkRubberBass(drums), "funk"), "funk");
  }

  function buildFunk(frames) {
    if (frames && frames.format === "drum-frames" && frames.genre === "funk") {
      try {
        const layer = buildFunkFromFrames(frames);
        if (layer) return layer;
      } catch (e) {
        console.warn("[GenreFlavor] funk frames failed, fallback:", e);
      }
    }
    return buildFunkDefault();
  }

  // ---- PIANO ----------------------------------------------------

  function buildPianoDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const room = new Tone.Reverb({ decay: 3.4, wet: 0.36 }).connect(gain);
    const lp = new Tone.Filter({ frequency: 2200, type: "lowpass", Q: 0.5 }).connect(room);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.06, decay: 0.9, sustain: 0.35, release: 1.6 },
      volume: -16
    }).connect(lp);
    piano.maxPolyphony = 8;

    const VOICINGS = [
      ["D3", "A3", "C4", "F4"],
      ["G2", "F3", "A3", "C4", "E4"],
      ["C3", "G3", "Bb3", "E4"],
      ["A2", "E3", "G3", "C4", "D4"],
      ["F2", "C3", "E3", "A3"]
    ];
    const ids = [];
    let bar = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      const voicing = VOICINGS[bar % VOICINGS.length];
      voicing.forEach((note, i) => {
        const delay = i * 0.022 + (Math.random() - 0.5) * 0.008;
        const vel = 0.32 + Math.random() * 0.1;
        piano.triggerAttackRelease(note, "2n", safeEventTime(time + delay), vel);
      });
      bar++;
    }, "2m"));

    return { gain, synths: [piano, lp, room], scheduledIds: ids, source: "default" };
  }

  // chill recipe -> felt piano. Uses several piano layers so the FM piano
  // pill has a chord bed, memory replies, and a soft melody surface.
  function normalizePianoVoicings(layer) {
    let voicings = layer && layer.notes;
    if (!Array.isArray(voicings) || voicings.length === 0) {
      return [["D3", "F3", "A3", "C4"]];
    }
    if (!Array.isArray(voicings[0])) return [voicings];
    return voicings;
  }

  function pianoLayerRole(layer) {
    const id = String(layer?.id || "").toLowerCase();
    if (id.includes("memory") || id.includes("reply") || id.includes("answer")) return "memory";
    if (id.includes("melody") || id.includes("solo") || id.includes("dust")) return "melody";
    return "bed";
  }

  function selectRecipePianoLayers(recipes) {
    const primary = recipes[0] || {};
    const primaryPianos = Array.isArray(primary.layers)
      ? primary.layers.filter((l) => l && l.type === "piano")
      : [];
    const selected = [];
    const pushLayer = (recipe, layer, role) => {
      if (!layer || selected.some((item) => item.layer === layer)) return;
      selected.push({ recipe, layer, role: role || pianoLayerRole(layer) });
    };

    pushLayer(primary, primaryPianos[0], "bed");
    pushLayer(primary, primaryPianos.find((l) => pianoLayerRole(l) === "memory") || primaryPianos[1], "memory");

    const melodyRecipe = recipes.find((r) => r && r.id === "soft-melody-piano") || recipes[1] || primary;
    const melodyLayers = Array.isArray(melodyRecipe.layers)
      ? melodyRecipe.layers.filter((l) => l && l.type === "piano")
      : [];
    pushLayer(melodyRecipe, melodyLayers.find((l) => pianoLayerRole(l) === "melody") || melodyLayers[0], "melody");

    return selected.slice(0, 3);
  }

  function pianoLayerTone(layer) {
    let oscType = "triangle";
    let cutoff = 2200;
    if (layer.tone === "glass") { oscType = "triangle"; cutoff = 2100; }
    else if (layer.tone === "memory") { oscType = "triangle"; cutoff = 1500; }
    return { oscType, cutoff };
  }

  function pianoLayerDuration(layer, role) {
    if (Array.isArray(layer.duration) && layer.duration.length > 0) {
      return role === "bed" ? (layer.duration[1] || layer.duration[0]) : (layer.duration[1] || layer.duration[0]);
    }
    if (typeof layer.duration === "string") return layer.duration;
    return role === "bed" ? "2n" : "4n";
  }

  function buildRecipePianoLayer(gain, layer, role, layerIndex) {
    const { oscType, cutoff } = pianoLayerTone(layer);
    const roleGain = role === "bed" ? 1.05 : role === "memory" ? 0.78 : 0.7;
    const layerGain = new Tone.Gain(roleGain).connect(gain);
    const roomWet = role === "bed" ? 0.12 : role === "memory" ? 0.1 : 0.11;
    const room = new Tone.Reverb({ decay: role === "bed" ? 1.45 : 1.15, wet: roomWet }).connect(layerGain);
    const lp = new Tone.Filter({
      frequency: role === "memory" ? Math.min(cutoff, 1950) : Math.min(cutoff + 260, 2600),
      type: "lowpass",
      Q: 0.48
    }).connect(room);
    const hammerFilter = new Tone.Filter({
      frequency: role === "bed" ? 2100 : 2400,
      type: "bandpass",
      Q: 2.6
    }).connect(layerGain);
    const hammer = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: role === "bed" ? 0.018 : 0.014, sustain: 0, release: 0.006 },
      volume: role === "bed" ? -29 : -33
    }).connect(hammerFilter);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: oscType },
      envelope: {
        attack: role === "memory" ? 0.012 : 0.014,
        decay: role === "bed" ? 0.42 : 0.34,
        sustain: role === "bed" ? 0.07 : 0.035,
        release: role === "bed" ? 0.82 : 0.52
      },
      volume: role === "bed" ? -6.5 : role === "memory" ? -10 : -11
    }).connect(lp);
    piano.maxPolyphony = 8;

    const voicings = normalizePianoVoicings(layer);
    const pattern = (Array.isArray(layer.pattern) && layer.pattern.length > 0)
      ? layer.pattern
      : [0.9, 0, 0, 0, 0.28, 0, 0, 0];
    const roleBoost = role === "bed" ? 2.1 : role === "memory" ? 2.15 : 1.7;
    const baseVel = clamp((layer.velocity ?? 0.14) * roleBoost, 0.08, 0.58);
    const probabilityBoost = role === "memory" ? 1.85 : role === "melody" ? 1.25 : 1;
    const probability = clamp((layer.probability ?? 0.75) * probabilityBoost, 0, 1);
    const humanize = clamp(layer.humanize ?? 0.026, 0, 0.15);
    const every = Math.max(1, layer.every || pattern.length || 16);
    const duration = pianoLayerDuration(layer, role);

    let step = layerIndex * 2;
    let voicingIdx = 0;
    const id = Tone.Transport.scheduleRepeat((time) => {
      const trigger = pattern[step % pattern.length];
      if (trigger > 0 && Math.random() < probability) {
        const voicing = voicings[voicingIdx % voicings.length] || voicings[0];
        const jitter = (Math.random() - 0.5) * humanize + (layer.swingPush || 0);
        const chordTime = safeEventTime(time + jitter);
        try {
          hammer.triggerAttackRelease("128n", chordTime, clamp(baseVel * trigger * 0.28, 0.018, 0.13));
        } catch (e) {}
        voicing.forEach((note, i) => {
          const delay = i * (role === "bed" ? 0.024 : 0.017);
          const vel = clamp(baseVel * trigger * (0.86 + Math.random() * 0.28), 0.025, 0.58);
          piano.triggerAttackRelease(note, duration, safeEventTime(chordTime + delay), vel);
        });
      }
      step++;
      if (step % every === 0) voicingIdx++;
    }, "16n");

    return { synths: [piano, hammer, lp, hammerFilter, room, layerGain], scheduledId: id };
  }

  function buildPianoAnchorLayer(gain, selectedLayers) {
    const sourceLayer = selectedLayers.find((item) => item.role === "bed")?.layer
      || selectedLayers[0]?.layer
      || null;
    const voicings = normalizePianoVoicings(sourceLayer);
    const anchorGain = new Tone.Gain(0.9).connect(gain);
    const room = new Tone.Reverb({ decay: 1.1, wet: 0.075 }).connect(anchorGain);
    const lp = new Tone.Filter({ frequency: 2750, type: "lowpass", Q: 0.42 }).connect(room);
    const hammerFilter = new Tone.Filter({ frequency: 2250, type: "bandpass", Q: 2.4 }).connect(anchorGain);
    const hammer = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.016, sustain: 0, release: 0.006 },
      volume: -28
    }).connect(hammerFilter);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.012, decay: 0.36, sustain: 0.045, release: 0.68 },
      volume: -6.2
    }).connect(lp);
    piano.maxPolyphony = 8;

    let bar = 0;
    const id = Tone.Transport.scheduleRepeat((time) => {
      const t = safeEventTime(time);
      const voicing = (voicings[bar % voicings.length] || voicings[0] || ["D3", "F3", "A3", "C4"]).slice(0, 4);
      const reply = voicing.slice(-2);
      try {
        hammer.triggerAttackRelease("128n", t, 0.095);
      } catch (e) {}
      voicing.forEach((note, i) => {
        piano.triggerAttackRelease(note, i === 0 ? "2n" : "4n", safeEventTime(t + i * 0.021), 0.34 - i * 0.025);
      });
      if (bar % 2 === 1) {
        const replyTime = safeEventTime(t + Tone.Time("2n").toSeconds() + 0.035);
        try {
          hammer.triggerAttackRelease("128n", replyTime, 0.052);
        } catch (e) {}
        reply.forEach((note, i) => {
          piano.triggerAttackRelease(note, "8n", safeEventTime(replyTime + i * 0.017), 0.18 - i * 0.018);
        });
      }
      bar++;
    }, "1m");

    return { synths: [piano, hammer, lp, hammerFilter, room, anchorGain], scheduledId: id };
  }

  function buildPianoPlaningReplyLayer(gain) {
    const layerGain = new Tone.Gain(0.72).connect(gain);
    const room = new Tone.Reverb({ decay: 1.25, wet: 0.105 }).connect(layerGain);
    const lp = new Tone.Filter({ frequency: 2450, type: "lowpass", Q: 0.42 }).connect(room);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.018, decay: 0.38, sustain: 0.045, release: 0.72 },
      volume: -10.5
    }).connect(lp);
    piano.maxPolyphony = 6;
    const voicings = [
      ["E3", "A3", "D4", "F4"],
      ["F3", "Bb3", "Eb4", "G4"],
      ["D3", "G3", "C4", "E4"],
      ["C3", "F3", "Bb3", "D4"]
    ];
    let bar = 0;
    const id = Tone.Transport.scheduleRepeat((time) => {
      if (bar % 2 === 0 || Math.random() < 0.44) {
        const chord = voicings[bar % voicings.length];
        const t = safeEventTime(time + Tone.Time("2n").toSeconds() + 0.08 + Math.random() * 0.035);
        try {
          chord.forEach((note, i) => {
            piano.triggerAttackRelease(note, i < 2 ? "4n" : "8n", safeEventTime(t + i * 0.019), 0.18 - i * 0.012);
          });
        } catch (e) {}
      }
      bar++;
    }, "1m");
    return { synths: [piano, lp, room, layerGain], scheduledId: id };
  }

  // Debussy whole-tone memory layer — sustained whole-tone voicings that
  // peek through every 2-3 bars, with a long concert-hall reverb tail.
  // Volume sits ~5 dB below anchor so it reads as "気配のあるメモリ".
  // Reference: references/apple-music-refs.json (Debussy "Clair de Lune"
  // production_translation: impressionist + whole-tone + concert hall).
  function addDebussyMemoryDots(layer) {
    if (!layer) return null;
    const hall = new Tone.Reverb({ decay: 6.4, preDelay: 0.04, wet: 0.42 }).connect(layer.gain);
    const lp = new Tone.Filter({ frequency: 2800, type: "lowpass", Q: 0.4 }).connect(hall);
    const memory = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.4,
      modulationIndex: 1.8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.4, decay: 1.2, sustain: 0.5, release: 4.5 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.25, decay: 0.8, sustain: 0.3, release: 3.0 },
      volume: -20
    }).connect(lp);
    memory.maxPolyphony = 6;
    // Whole-tone (Debussy) voicings: Cwhole / Dwhole / open-fifth wash
    const voicings = [
      ["C3", "D3", "E3", "F#3", "G#3", "A#3"],   // C whole-tone span
      ["D3", "E3", "F#3", "G#3", "A#3", "C4"],   // shifted whole-tone
      ["G2", "A2", "B2", "C#3", "D#3", "F3"],    // dark whole-tone
      ["C3", "G3", "D4"],                         // open-fifth wash
      ["F3", "C4", "G4"],                         // pentatonic-ish answer
      ["A2", "E3", "B3", "F#4"]                   // open quartal stack
    ];
    let phrase = 0;
    layer.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      // 3-bar phrase の最後に 28% で memory dot を入れる
      if (Math.random() < 0.30) {
        const voicing = voicings[phrase % voicings.length];
        try {
          // soft arpeggiation: each note 35-80ms apart for "rolled chord" feel
          voicing.forEach((note, i) => {
            const delay = i * (0.04 + Math.random() * 0.025);
            memory.triggerAttackRelease(note, "1n", safeEventTime(time + 0.06 + delay), 0.18 + Math.random() * 0.04);
          });
        } catch (e) {}
      }
      phrase++;
    }, "3m"));
    layer.synths.push(memory, lp, hall);
    layer.source = `${layer.source || "piano"}+debussy-memory`;
    return layer;
  }

  function buildPianoFromRecipe(recipeContainer) {
    const recipes = (recipeContainer && Array.isArray(recipeContainer.recipes)) ? recipeContainer.recipes : [];
    if (recipes.length === 0) return buildPianoDefault();
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const pianoLayers = selectRecipePianoLayers(recipes);
    if (pianoLayers.length === 0) return buildPianoDefault();

    const synths = [];
    const ids = [];
    pianoLayers.forEach(({ layer, role }, i) => {
      const built = buildRecipePianoLayer(gain, layer, role, i);
      synths.push(...built.synths);
      ids.push(built.scheduledId);
    });
    const anchor = buildPianoAnchorLayer(gain, pianoLayers);
    synths.push(...anchor.synths);
    ids.push(anchor.scheduledId);
    const planing = buildPianoPlaningReplyLayer(gain);
    synths.push(...planing.synths);
    ids.push(planing.scheduledId);

    const built = {
      gain,
      synths,
      scheduledIds: ids,
      source: "chill-recipe:" + (recipes[0]?.id || "?") + "+foreground-piano+planing-reply",
      level: 2.15
    };
    return applyProductionGovernor(addDebussyMemoryDots(built), "piano");
  }

  function buildPiano(recipe) {
    if (recipe && recipe.format === "chill-piano-recipe") {
      try { return buildPianoFromRecipe(recipe); }
      catch (e) { console.warn("[GenreFlavor] piano recipe failed, fallback:", e); }
    }
    return applyProductionGovernor(addDebussyMemoryDots(buildPianoDefault()), "piano");
  }

  // ---- BUILDERS index -------------------------------------------

  const BUILDERS = {
    any: null,
    ambient: buildAmbient,
    techno: buildTechno,
    lofi: buildLofi,
    jazz: buildJazz,
    funk: buildFunk,
    piano: buildPiano
  };

  // ---- Lifecycle ------------------------------------------------

  function teardownActive() {
    if (!activeLayer) return;
    const layer = activeLayer;
    activeLayer = null;
    try { layer.gain.gain.rampTo(0, CROSSFADE_S); } catch (e) {}
    setTimeout(() => {
      clearSchedules(layer.scheduledIds);
      if (typeof layer.dispose === "function") layer.dispose();
      disposeSynths(layer.synths);
      try { layer.gain.dispose(); } catch (e) {}
    }, (CROSSFADE_S + 0.2) * 1000);
  }

  function lookupPreset(genre) {
    if (!window.HazamaPresets) return null;
    const presetName = PRESET_BY_GENRE[genre];
    if (!presetName) return null;
    return window.HazamaPresets.get(presetName);
  }

  function spinUp(name) {
    const builder = BUILDERS[name];
    if (!builder) return null;
    const preset = lookupPreset(name);
    let layer = null;
    try {
      layer = builder(preset);
    } catch (e) {
      console.warn("[GenreFlavor] builder threw, falling back to none:", name, e);
      return null;
    }
    if (!layer) return null;
    const target = workingLevelFor(name) * (layer.level || 1);
    try { layer.gain.gain.rampTo(target, CROSSFADE_S); } catch (e) {}
    return layer;
  }

  function setGenre(name) {
    if (!started) {
      currentGenre = name;
      return;
    }
    if (name === currentGenre && activeLayer) return;
    teardownActive();
    currentGenre = name;
    activeLayer = spinUp(name);
  }

  function start() {
    if (started) return;
    ensureMaster();
    started = true;
    syncMasterLevel(FADE_IN_S);
    activeLayer = spinUp(currentGenre);
  }

  function stop() {
    if (!started) return;
    try { master.gain.rampTo(0, FADE_OUT_S); } catch (e) {}
    teardownActive();
    started = false;
  }

  function dispose() {
    stop();
    setTimeout(() => {
      if (master) {
        try { master.dispose(); } catch (e) {}
        master = null;
      }
      if (masterCompressor) {
        try { masterCompressor.dispose(); } catch (e) {}
        masterCompressor = null;
      }
      if (masterMakeup) {
        try { masterMakeup.dispose(); } catch (e) {}
        masterMakeup = null;
      }
      if (masterLimiter) {
        try { masterLimiter.dispose(); } catch (e) {}
        masterLimiter = null;
      }
      if (outputLevelInput && outputLevelHandler) {
        try {
          outputLevelInput.removeEventListener("input", outputLevelHandler);
          outputLevelInput.removeEventListener("change", outputLevelHandler);
        } catch (e) {}
      }
      outputLevelInput = null;
      outputLevelHandler = null;
    }, (FADE_OUT_S + 0.2) * 1000);
  }

  window.GenreFlavor = {
    start,
    stop,
    setGenre,
    dispose,
    get state() {
      const profile = FLAVOR_PROFILE_BY_GENRE[currentGenre] || null;
      return {
        started,
        genre: currentGenre,
        scheduled: activeLayer ? activeLayer.scheduledIds.length : 0,
        source: activeLayer ? activeLayer.source : null,
        outputLevel: outputLevelValue(),
        masterLevel: master ? Math.round(targetMasterLevel() * 1000) / 1000 : null,
        role: profile ? profile.role : null,
        edge: profile ? profile.edge : null,
        feedback: profile ? profile.feedback : null,
        integrationMode: "fm-audio-plus-music-packet-metadata"
      };
    }
  };
})();
