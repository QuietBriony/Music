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

  // Working volume (linear gain). Kept low so layer sits under the engine.
  const WORKING_LEVEL = 0.22;
  const FADE_IN_S = 2.5;
  const FADE_OUT_S = 1.6;
  const CROSSFADE_S = 1.5;

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

  // Master bus for all flavor synths.
  let master = null;
  let started = false;
  let currentGenre = "any";
  let activeLayer = null; // { gain, synths[], scheduledIds[], dispose, source }

  function ensureMaster() {
    if (master) return master;
    master = new Tone.Gain(0).toDestination();
    return master;
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
      pad.triggerAttackRelease("D2", "16m", time, 0.5);
      pad.triggerAttackRelease("A2", "16m", time + 0.3, 0.45);
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
      pad.triggerAttackRelease(baseNote, "16m", time, 0.5);
      pad.triggerAttackRelease(fifth(baseNote), "16m", time + 0.3, 0.45);
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
      try { return buildAmbientFromShape(shape); }
      catch (e) { console.warn("[GenreFlavor] ambient shape failed, fallback:", e); }
    }
    return buildAmbientDefault();
  }

  // ---- TECHNO ---------------------------------------------------

  function buildTechnoDefault() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -20
    }).connect(gain);
    const sub = new Tone.MembraneSynth({
      pitchDecay: 0.04, octaves: 2,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 },
      volume: -18
    }).connect(gain);

    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      hat.triggerAttackRelease("16n", time, 0.5);
    }, "8n", "8n"));
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      sub.triggerAttackRelease("D1", "16n", time, 0.6);
    }, "4n"));

    return { gain, synths: [hat, sub], scheduledIds: ids, source: "default" };
  }

  // Shared drum kit for funk/techno frames builds.
  function makeDrumKit(gain) {
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

  // Build drum-frame–driven layer. Bar-by-bar scheduler advances through
  // the frames array and triggers each event at (beat*4n + sub*16n + microMs).
  function buildDrumsFromFrames(framesData) {
    const frames = (framesData && Array.isArray(framesData.frames)) ? framesData.frames : [];
    if (frames.length === 0) return null;

    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const kit = makeDrumKit(gain);

    const beatTime = Tone.Time("4n").toSeconds();
    const subTime = Tone.Time("16n").toSeconds();

    let frameIdx = 0;
    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      const frame = frames[frameIdx % frames.length];
      frameIdx++;
      if (!frame || !Array.isArray(frame.events)) return;
      frame.events.forEach((evt) => {
        const synth = kit[evt.instrument];
        if (!synth) return;
        const offset = (evt.beat || 0) * beatTime
                     + (evt.sub || 0) * subTime
                     + (evt.microMs || 0) / 1000;
        const vel = clamp(evt.velocity ?? 0.5, 0.05, 1);
        try {
          if (evt.instrument === "kick") {
            synth.triggerAttackRelease("C2", "16n", time + offset, vel);
          } else {
            synth.triggerAttackRelease("16n", time + offset, vel);
          }
        } catch (e) {}
      });
    }, "1m"));

    return {
      gain,
      synths: [kit.kick, kit.snare, kit.hat, kit.ghost, kit.fill, kit.crash],
      scheduledIds: ids,
      source: "drum-frames"
    };
  }

  function buildTechno(frames) {
    if (frames && frames.format === "drum-frames" && frames.genre === "techno") {
      try {
        const layer = buildDrumsFromFrames(frames);
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
        kick.triggerAttackRelease("C2", "8n", time, 0.55 + Math.random() * 0.15);
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

  // When drum-frames-lofi preset is present, render the lazy frame rhythm
  // PLUS the vinyl crackle bed for the dusty character.
  function buildLofiFromFrames(frames) {
    const drums = buildDrumsFromFrames(frames);
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
    drums.source = "drum-frames+vinyl-crackle";
    return drums;
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
      bass.triggerAttackRelease(walk[walkIdx % walk.length], "8n", time, 0.6);
      walkIdx++;
    }, "4n"));

    const brushPattern = [1, 0, 1, 0, 1, 0, 1, 1];
    let brushIdx = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (brushPattern[brushIdx % brushPattern.length]) {
        const vel = 0.18 + Math.random() * 0.08;
        const jitter = (Math.random() - 0.5) * 0.012;
        brush.triggerAttackRelease("16n", time + jitter, vel);
      }
      brushIdx++;
    }, "8n"));

    return { gain, synths: [brush, brushHi, brushLo, bass, room], scheduledIds: ids, source: "default" };
  }

  // When drum-frames-jazz preset is present, render the frame rhythm AND
  // keep the walking bass for harmonic glue (brush is dropped to avoid
  // clashing with frame hat events).
  function buildJazzFromFrames(frames) {
    const drums = buildDrumsFromFrames(frames);
    if (!drums) return null;

    const room = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).connect(drums.gain);
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
      bass.triggerAttackRelease(walk[walkIdx % walk.length], "8n", time, 0.55);
      walkIdx++;
    }, "4n"));
    drums.synths.push(bass, room);
    drums.source = "drum-frames+walking-bass";
    return drums;
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
        clavi.triggerAttackRelease(note, "32n", time, 0.45 + Math.random() * 0.15);
      }
      claviIdx++;
    }, "16n"));
    let epBar = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (epBar % 2 === 0) ep.triggerAttackRelease(dmin7, "1m", time, 0.35);
      epBar++;
    }, "1m"));

    return { gain, synths: [clavi, claviFilter, ep, epRoom], scheduledIds: ids, source: "default" };
  }

  // When drum frames are present, render the frame rhythm AND keep the EP
  // chord layer for harmonic color (clavi is dropped to avoid clashing
  // 16th-note timing with the live drum events).
  function buildFunkFromFrames(frames) {
    const drums = buildDrumsFromFrames(frames);
    if (!drums) return null;

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
    let epBar = 0;
    drums.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      if (epBar % 2 === 0) ep.triggerAttackRelease(dmin7, "1m", time, 0.32);
      epBar++;
    }, "1m"));
    drums.synths.push(ep, epRoom);
    drums.source = "drum-frames+ep";
    return drums;
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
        piano.triggerAttackRelease(note, "2n", time + delay, vel);
      });
      bar++;
    }, "2m"));

    return { gain, synths: [piano, lp, room], scheduledIds: ids, source: "default" };
  }

  // chill recipe → felt piano. Uses recipe.layers[type=piano].
  // Drives a single recipe (the first); voicings rotate every `every` 16ths.
  function buildPianoFromRecipe(recipeContainer) {
    const recipes = (recipeContainer && Array.isArray(recipeContainer.recipes)) ? recipeContainer.recipes : [];
    if (recipes.length === 0) return buildPianoDefault();
    const recipe = recipes[0];
    const pianoLayer = (recipe.layers || []).find((l) => l && l.type === "piano");
    if (!pianoLayer) return buildPianoDefault();

    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const reverbWet = clamp(pianoLayer.pedal ?? 0.5, 0.18, 0.6);
    const room = new Tone.Reverb({ decay: 3.4, wet: reverbWet }).connect(gain);

    // Tone hint controls timbre: felt = warm triangle, glass = bright sine,
    // memory = darker sine.
    let oscType = "triangle";
    let cutoff = 2200;
    if (pianoLayer.tone === "glass") { oscType = "sine"; cutoff = 3200; }
    else if (pianoLayer.tone === "memory") { oscType = "sine"; cutoff = 1600; }

    const lp = new Tone.Filter({ frequency: cutoff, type: "lowpass", Q: 0.5 }).connect(room);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: oscType },
      envelope: { attack: 0.06, decay: 0.9, sustain: 0.35, release: 1.6 },
      volume: -16
    }).connect(lp);
    piano.maxPolyphony = 8;

    // notes: array of voicings (each voicing is an array of notes).
    let voicings = pianoLayer.notes;
    if (!Array.isArray(voicings) || voicings.length === 0) {
      voicings = [["D3", "F3", "A3", "C4"]];
    } else if (!Array.isArray(voicings[0])) {
      // Some sources flatten — wrap into one voicing.
      voicings = [voicings];
    }

    const pattern = (Array.isArray(pianoLayer.pattern) && pianoLayer.pattern.length > 0)
      ? pianoLayer.pattern
      : [0.98, 0, 0, 0, 0.32, 0, 0, 0];
    const baseVel = clamp(pianoLayer.velocity ?? 0.17, 0.04, 0.4);
    const probability = clamp(pianoLayer.probability ?? 0.9, 0, 1);
    const humanize = clamp(pianoLayer.humanize ?? 0.026, 0, 0.15);
    const every = Math.max(1, pianoLayer.every || pattern.length || 16);

    let step = 0;
    let voicingIdx = 0;
    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      const trigger = pattern[step % pattern.length];
      if (trigger > 0 && Math.random() < probability) {
        const voicing = voicings[voicingIdx % voicings.length] || voicings[0];
        const jitter = (Math.random() - 0.5) * humanize;
        voicing.forEach((note, i) => {
          const delay = i * 0.022;
          const vel = clamp(baseVel * trigger * (0.85 + Math.random() * 0.3), 0.02, 0.6);
          piano.triggerAttackRelease(note, "2n", time + delay + jitter, vel);
        });
      }
      step++;
      if (step % every === 0) voicingIdx++;
    }, "16n"));

    return {
      gain,
      synths: [piano, lp, room],
      scheduledIds: ids,
      source: "chill-recipe:" + (recipe.id || "?")
    };
  }

  function buildPiano(recipe) {
    if (recipe && recipe.format === "chill-piano-recipe") {
      try { return buildPianoFromRecipe(recipe); }
      catch (e) { console.warn("[GenreFlavor] piano recipe failed, fallback:", e); }
    }
    return buildPianoDefault();
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
    try { layer.gain.gain.rampTo(WORKING_LEVEL, CROSSFADE_S); } catch (e) {}
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
    try { master.gain.rampTo(1, FADE_IN_S); } catch (e) {}
    started = true;
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
    }, (FADE_OUT_S + 0.2) * 1000);
  }

  window.GenreFlavor = {
    start,
    stop,
    setGenre,
    dispose,
    get state() {
      return {
        started,
        genre: currentGenre,
        scheduled: activeLayer ? activeLayer.scheduledIds.length : 0,
        source: activeLayer ? activeLayer.source : null
      };
    }
  };
})();
