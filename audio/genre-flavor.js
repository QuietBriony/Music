/* =========================================================
   Hazama FM — Genre Flavor Layer
   Lightweight Tone.js synths layered on top of engine.js.
   Independent from engine: own master Gain into Tone.Destination,
   own Tone.Transport schedules. Engine controls BPM globally.

   Public API: window.GenreFlavor
     start()           — boot bus, ramp gain to working level
     stop()            — fade out, clear schedules
     setGenre(name)    — crossfade between genres (any|ambient|techno|lofi|jazz|funk)
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

  // D dorian / D minor — aligned with Music's natural key area.
  const SCALE_HZ = {
    D2: "D2", F2: "F2", G2: "G2", A2: "A2",
    D3: "D3", F3: "F3", G3: "G3", A3: "A3", C4: "C4",
    D4: "D4", F4: "F4", A4: "A4", C5: "C5"
  };

  // Master bus for all flavor synths.
  let master = null;
  let started = false;
  let currentGenre = "any";
  let activeLayer = null; // { gain, synths[], scheduledIds[], dispose }

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

  // ---- Layer builders ----------------------------------------

  // Returns { gain, synths, scheduledIds, dispose }
  function buildAmbient() {
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
    // Sustained drone: D2 + A2 fifth, restruck softly every 16 bars.
    const droneTick = (time) => {
      pad.triggerAttackRelease("D2", "16m", time, 0.5);
      pad.triggerAttackRelease("A2", "16m", time + 0.3, 0.45);
    };
    droneTick(Tone.Transport.now() + 0.1);
    ids.push(Tone.Transport.scheduleRepeat(droneTick, "16m"));

    return {
      gain,
      synths: [pad, reverb],
      scheduledIds: ids
    };
  }

  function buildTechno() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    // Off-beat hat: tight noise burst.
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -20
    }).connect(gain);

    // Sub punch: subtle 4-on-floor body, well below engine drums to avoid clash.
    const sub = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 },
      volume: -18
    }).connect(gain);

    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      hat.triggerAttackRelease("16n", time, 0.5);
    }, "8n", "8n")); // off-beat

    ids.push(Tone.Transport.scheduleRepeat((time) => {
      sub.triggerAttackRelease("D1", "16n", time, 0.6);
    }, "4n"));

    return { gain, synths: [hat, sub], scheduledIds: ids };
  }

  function buildLofi() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const lp = new Tone.Filter({ frequency: 2400, type: "lowpass", Q: 0.6 }).connect(gain);

    // Vinyl crackle (continuous noise, very low).
    const crackle = new Tone.Noise("pink");
    const crackleAmp = new Tone.Gain(0.06).connect(lp);
    crackle.connect(crackleAmp);
    crackle.start();

    // Soft kick on quarter notes.
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
      volume: -14
    }).connect(lp);

    const ids = [];
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      // skip beat 3 occasionally to feel "lazy"
      if (Math.random() > 0.18) {
        kick.triggerAttackRelease("C2", "8n", time, 0.55 + Math.random() * 0.15);
      }
    }, "4n"));

    return {
      gain,
      synths: [crackle, crackleAmp, kick, lp],
      scheduledIds: ids,
      dispose: () => {
        try { crackle.stop(); } catch (e) {}
      }
    };
  }

  function buildJazz() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());
    const room = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).connect(gain);

    // Felt brush — filtered noise burst, soft.
    const brushHi = new Tone.Filter({ frequency: 4200, type: "lowpass" });
    const brushLo = new Tone.Filter({ frequency: 800, type: "highpass" });
    brushHi.connect(brushLo).connect(room);
    const brush = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.02, decay: 0.18, sustain: 0, release: 0.05 },
      volume: -22
    }).connect(brushHi);

    // Walking bass — triangle, low, swung quarters.
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", frequency: 850, Q: 0.7 },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.55, release: 0.15 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2, baseFrequency: 280, octaves: 2 },
      volume: -14
    }).connect(room);

    // 8-step walking bass loop in D minor (typical 1-4-5 movement)
    const walk = ["D2", "F2", "G2", "A2", "C3", "A2", "G2", "F2"];
    let walkIdx = 0;
    const ids = [];

    ids.push(Tone.Transport.scheduleRepeat((time) => {
      bass.triggerAttackRelease(walk[walkIdx % walk.length], "8n", time, 0.6);
      walkIdx++;
    }, "4n"));

    // Brush: gentle "x.x.x.xx" 8th-note pattern with some humanization.
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

    return {
      gain,
      synths: [brush, brushHi, brushLo, bass, room],
      scheduledIds: ids
    };
  }

  function buildFunk() {
    const gain = new Tone.Gain(0.0001).connect(ensureMaster());

    // Clavi — snappy sawtooth with quick decay, lowpass keeps it from biting.
    const claviFilter = new Tone.Filter({ frequency: 1800, type: "lowpass", Q: 1.2 }).connect(gain);
    const clavi = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0.0, release: 0.08 },
      volume: -16
    }).connect(claviFilter);
    clavi.maxPolyphony = 6;

    // Electric piano — FM, soft warm pad.
    const epRoom = new Tone.Reverb({ decay: 1.2, wet: 0.18 }).connect(gain);
    const ep = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.6, sustain: 0.5, release: 1.2 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.05, decay: 0.5, sustain: 0.3, release: 1 },
      volume: -18
    }).connect(epRoom);
    ep.maxPolyphony = 6;

    const dmin7 = ["D3", "F3", "A3", "C4"];
    const ids = [];

    // Clavi 16th-note funk pattern — staccato stabs with rests.
    // pattern: 1.0.1.10.0.10.011.
    const claviPattern = [1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0];
    let claviIdx = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (claviPattern[claviIdx % claviPattern.length]) {
        const note = dmin7[Math.floor(Math.random() * dmin7.length)];
        clavi.triggerAttackRelease(note, "32n", time, 0.45 + Math.random() * 0.15);
      }
      claviIdx++;
    }, "16n"));

    // EP soft chord on bar 1 of every 2-bar phrase.
    let epBar = 0;
    ids.push(Tone.Transport.scheduleRepeat((time) => {
      if (epBar % 2 === 0) {
        ep.triggerAttackRelease(dmin7, "1m", time, 0.35);
      }
      epBar++;
    }, "1m"));

    return {
      gain,
      synths: [clavi, claviFilter, ep, epRoom],
      scheduledIds: ids
    };
  }

  const BUILDERS = {
    any: null,           // no flavor layer
    ambient: buildAmbient,
    techno: buildTechno,
    lofi: buildLofi,
    jazz: buildJazz,
    funk: buildFunk
  };

  // ---- Lifecycle ---------------------------------------------

  function teardownActive() {
    if (!activeLayer) return;
    const layer = activeLayer;
    activeLayer = null;
    // Ramp out fast, then dispose so we don't kill audio mid-tail.
    try { layer.gain.gain.rampTo(0, CROSSFADE_S); } catch (e) {}
    setTimeout(() => {
      clearSchedules(layer.scheduledIds);
      if (typeof layer.dispose === "function") layer.dispose();
      disposeSynths(layer.synths);
      try { layer.gain.dispose(); } catch (e) {}
    }, (CROSSFADE_S + 0.2) * 1000);
  }

  function spinUp(name) {
    const builder = BUILDERS[name];
    if (!builder) return null;
    const layer = builder();
    // Crossfade up.
    try { layer.gain.gain.rampTo(WORKING_LEVEL, CROSSFADE_S); } catch (e) {}
    return layer;
  }

  function setGenre(name) {
    if (!started) {
      // Defer until start() — remember the choice.
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
        scheduled: activeLayer ? activeLayer.scheduledIds.length : 0
      };
    }
  };
})();
