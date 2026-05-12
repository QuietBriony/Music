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
    currentSongId: "human-fly",
    songData: null,
    started: false,
    starting: false,
    barCount: 0,           // global bar counter since play start
    sectionIdx: 0,         // index into songData.structure
    sectionBarStart: 0,    // bar at which the current section started
    chordIdx: 0,           // index into current section's chord progression
    chordBarsRemaining: 0,
    scheduledIds: []
  };

  // ---- Tone.js nodes -------------------------------------------

  let masterGain = null;
  let masterLimiter = null;
  let drumBus = null;
  let bassBus = null;
  let chordBus = null;
  let clickBus = null;

  let drumKit = null;        // { kick, snare, hat, ghost, fill, crash }
  let synthBass = null;
  let chordSynth = null;
  let clickSynth = null;

  // ---- Master setup -------------------------------------------

  function ensureMaster() {
    if (masterGain) return masterGain;
    masterLimiter = new Tone.Limiter({ threshold: -0.5 }).toDestination();
    const masterEq = new Tone.EQ3({ low: 1.2, mid: -0.2, high: 0.6, lowFrequency: 200, highFrequency: 5000 });
    const masterComp = new Tone.Compressor({ threshold: -14, ratio: 2.5, attack: 0.010, release: 0.20, knee: 6 });
    masterGain = new Tone.Gain(0.9);
    masterGain.connect(masterComp);
    masterComp.connect(masterEq);
    masterEq.connect(masterLimiter);

    drumBus = new Tone.Gain(0.75).connect(masterGain);
    bassBus = new Tone.Gain(0.65).connect(masterGain);
    chordBus = new Tone.Gain(0.55).connect(masterGain);
    clickBus = new Tone.Gain(0.0).connect(masterGain);  // off by default
    return masterGain;
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
    try {
      const url = `presets/drum-frames-tabasco-${songId}.json?cb=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const data = await res.json();
      state.songData = data;
      state.currentSongId = songId;
      $("br-bpm").textContent = data.bpm || "—";
      $("br-key").textContent = data.key || "—";
      // Load lyrics from the draft md (extract the section for this song)
      try {
        const lyricsRes = await fetch("docs/tabasco-lyrics-draft.md?cb=" + Date.now());
        if (lyricsRes.ok) {
          const md = await lyricsRes.text();
          const lyrics = extractLyricsForSong(md, data.song_title || songId);
          $("br-lyrics-body").textContent = lyrics || "(lyrics todo — see docs/tabasco-lyrics-draft.md)";
        }
      } catch (e) {
        $("br-lyrics-body").textContent = "(lyrics file not available offline)";
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
    if (!drumKit) drumKit = makeDrumKit(drumBus);
    if (!synthBass) synthBass = makeSynthBass(bassBus);
    if (!chordSynth) chordSynth = makeChordSynth(chordBus);
    if (!clickSynth) clickSynth = makeClick(clickBus);

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

    document.getElementById("br-track-select")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-song]");
      if (!btn || btn.disabled) return;
      document.querySelectorAll("#br-track-select button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      const wasPlaying = state.started;
      if (wasPlaying) stopPlayback();
      await loadSong(btn.dataset.song);
      if (wasPlaying) await startPlayback();
    });

    const volMap = { "br-vol-drums": "drumBus", "br-vol-bass": "bassBus", "br-vol-chords": "chordBus", "br-vol-click": "clickBus" };
    Object.entries(volMap).forEach(([id, busName]) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        ensureMaster();
        const bus = { drumBus, bassBus, chordBus, clickBus }[busName];
        if (bus) {
          try { bus.gain.rampTo(Number(el.value) / 100, 0.08); } catch (e) {}
        }
      });
    });
  }

  // ---- Boot ---------------------------------------------------

  window.addEventListener("DOMContentLoaded", () => {
    bindUI();
    // Pre-load the default song meta (doesn't start audio)
    loadSong(state.currentSongId);
  });

})();
