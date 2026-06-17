/* =========================================================
   Band Room — Air Rock Connect Box
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
  const BANDROOM_APP_VERSION = "br-220-voice-formant3";
  const BANDROOM_STORAGE_SCHEMA_VERSION = 2;
  const BANDROOM_STORAGE_SCHEMA_KEY = "band-room.storage.schema";
  const BANDROOM_PREFS_KEY = "band-room.prefs.v1";
  const BANDROOM_MASTER_VOL_KEY = "band-room.masterVol.v2";
  const BANDROOM_ALLOW_BACKGROUND_AUDIO_KEY = "band-room.allowBackgroundAudio.v1";
  const BANDROOM_AI_SAMPLER_UPGRADE_KEY = "band-room.aiSamplerUpgrade.v1";
  const BANDROOM_AUDIO_STATE_KEYS = [BANDROOM_PREFS_KEY, BANDROOM_MASTER_VOL_KEY];
  const BANDROOM_BOOT_MODE = detectBandRoomBootMode();
  const BANDROOM_SAFE_BOOT = BANDROOM_BOOT_MODE === "safe";
  const DRUM_FLOOR_URL = "https://quietbriony.github.io/drum-floor/";
  const MUSIC_STACK_PACKET_STORAGE_KEY = "qb:music-stack:latest-packet:v1";
  const MUSIC_STACK_CHANNEL_NAME = "qb:music-stack:v1";
  const MAGENTA_CORE_URL = "https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/core.js";
  const MAGENTA_RNN_URL = "https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/music_rnn.js";
  const TONE_MIDI_URL = "https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/build/Midi.min.js";

  function hasSafeBootQuery() {
    try {
      const value = new URLSearchParams(window.location.search).get("safe");
      return value === "1" || value === "true" || value === "audio";
    } catch (e) {
      return false;
    }
  }

  function isStandaloneDisplayMode() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
             window.navigator?.standalone === true;
    } catch (e) {
      return false;
    }
  }

  function detectBandRoomBootMode() {
    if (hasSafeBootQuery()) return "safe";
    if (isStandaloneDisplayMode()) return "standalone";
    return "browser";
  }

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
    stemVariant: "original",
    lastStemResyncAtMs: 0,
    watchdogRecoverTicks: 0,
    chordIdx: 0,
    chordBarsRemaining: 0,
    scheduledIds: [],
    lastSchedulerBarAtMs: 0,
    healthLastBarCount: 0,
    healthLastTransportSec: 0,
    healthStallTicks: 0,
    kitSource: "online/tone-acoustic",  // v259: default to the Tone.js acoustic CDN kit (real
                            // sampled drum sounds). After v247-v257 the procedural rhythm/structure
                            // levers were exhausted but the user still heard "ただ鳴ってる感" — synth
                            // drums were the largest "fake/electronic" element in the AI band's
                            // texture. tone-acoustic gives real kick/snare/hat samples; the SW
                            // caches them (v230) so offline still works after the first online play.
                            // Old default "synth" (v208) — switchable back via the kit-source
                            // dropdown. "auto-self" = song-extracted (still retired to synth on
                            // load — Demucs bleed sounds amateur).
                            // ("auto-self" = song-self samples, "<src>/<song>" = specific sample kit,
                            //  "online/<id>" = CDN-streamed kit from online-samples-catalog.json)
    kitProfile: "default",  // v91: synth voice profile (only applies when kitSource = "synth")
    // v99: per-voice overrides — kick だけ 808, snare だけ acoustic みたいに
    // 1 voice 単位で別 kit からピックできる。null = base kit を使う、文字列 = その kit id
    voiceOverrides: { kick: null, snare: null, hat: null, ghost: null, fill: null, crash: null },
    chordInstrument: "salamander-piano",  // v262: default to real piano (CDN Salamander Grand). v259 made
                                          // drums acoustic; chord pad is the next "生音" lever — synth pad
                                          // was the last fake-electronic element in the AI 再現 baseline.
                                          // Piano's natural decay arc complements the v257 whole-note
                                          // sustain (chord rings out the bar instead of pad-flat). null
                                          // = synth fallback if user explicitly picks it from the
                                          // chord instrument dropdown.
    bassInstrument: "bass-electric",  // v267: was null (v231 synth fallback). Root cause was a catalog
                                      // bug — v97 listed notes (F#/A in low octaves) that don't exist in
                                      // the upstream repo. v267 corrected the catalog to the 17 actual
                                      // github files (A#/C#/E/G in 4-5 octaves); all 17 servable now.
                                      // This completes the 生音 5/5 AI 再現 baseline (drums + bass +
                                      // guitar + chord all real samples; voice OFF). null = synth bass
                                      // if explicitly chosen from the dropdown.
    guitarInstrument: "guitar-acoustic",  // v265: was null (v231 synth fallback). 2026 re-audit (HEAD-checked all CDN samples) shows:
                                          //   guitar-acoustic: 11/11 notes OK ✓
                                          //   guitar-nylon:    11/11 notes OK ✓
                                          //   guitar-electric:  8/13 notes OK (midrange C#3/E3/C#4/E4/C#5 = 403 Forbidden)
                                          // Switching to acoustic for full-servability + "生音" continuation of v259 (drums)
                                          // + v262 (chord piano). cramps-punk users can re-select guitar-electric from
                                          // the dropdown if they want the gritty electric tone (Tone.Sampler interpolates
                                          // the missing notes). null = synth fallback if explicitly chosen.
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
  let playbackLifecycleStopSeq = 0;
  let screenWakeLock = null;  // v235: screen Wake Lock sentinel (iOS focus-listening stability)
  let autoAdvanceInFlight = false;
  let autoAdvanceTimer = 0;
  let playbackHealthTimer = 0;
  let suspendReleaseTimers = [];
  let songSwitchSeq = 0;
  let modeSwitchSeq = 0;
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
  let masterMeterTimer = 0;           // v316: low-cadence meter loop for AI/light runtime
  let transportProgressRaf = 0;       // v165: ordinary song timeline RAF
  let transportProgressTimer = 0;     // v316: low-cadence timeline loop for AI/light runtime
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
  // v220: instrumentBus (the non-vocal polish bus) hoisted to module scope so
  // the scheduler can modulate its gain per section role. Stems mode is
  // unaffected because stems route through stemBus.* → masterGain directly,
  // bypassing instrumentBus.
  let instrumentBus = null;

  // Synth (AI 再現) layers
  let drumKit = null;
  let synthBass = null;
  // v218: last chord-voicing top semi for jazzy voice leading (chordAgentPlan
  // uses this to pick the next bar's inversion that minimizes top-note jump).
  // Reset on song change in loadSong.
  let lastChordTopNote = null;
  let guitarSynth = null;
  let voiceSynth = null;
  let chordSynth = null;
  let clickSynth = null;
  let synthSamplerUpgradeSeq = 0;

  // Original stem buses + Tone.Player instances (Demucs separated)
  let stemBus = { vocals: null, drums: null, bass: null, other: null };
  let stemPlayers = { vocals: null, drums: null, bass: null, other: null };
  let stemPlayerGains = { vocals: null, drums: null, bass: null, other: null };
  let loadedStemsSongId = null;
  let loadedStemsVariant = null;
  let currentMode = "stems";  // "stems" | "synth"
  // v339: AI 再構築 — rebuild the groove in a reference style while keeping
  // the song's identity (real vocal melody, real bass pitches, corrected
  // chords). Applies in synth mode only; session-only (not persisted).
  // v340: per-PART matrix — each band member picks their own style
  // ("off" = 忠実/transcribed). 4 parts x 3 styles = the play matrix.
  const reconstructParts = { drums: "off", bass: "off", guitar: "off", chords: "off" };
  function reconstructStyleFor(part) {
    const v = reconstructParts[part];
    return v === "lcd" || v === "sakanaction" ? v : "off";
  }
  const STEM_NAMES = ["vocals", "drums", "bass", "other"];
  const samplerAudioBufferCache = new Map();  // URL -> Promise<AudioBuffer|null>
  const runtimeScriptPromises = new Map();    // URL -> Promise<void>

  // Drum kit source (acoustic CDN kit default since v259; synth + sampled songs
  // remain selectable). v260: tone-acoustic listed first explicitly so the
  // dropdown always surfaces the actual default; synth relabelled "legacy"
  // since "(default)" no longer reflects reality. renderKitOptions dedupes
  // tone-acoustic vs the online-catalog auto-append so it doesn't appear twice.
  const KIT_OPTIONS = [
    { value: "online/tone-acoustic", label: "🌐 acoustic kit (生音, default)" },
    { value: "synth", label: "synth: AI drums (legacy)" },
    { value: "auto-self", label: "sample: 曲自身の drums (現在の曲)" },
    { value: "tabasco/tabasco",         label: "sample: Tabasco / TABASCO (136)" },
    { value: "tabasco/hey",             label: "sample: Tabasco / Hey (123)" },
    { value: "tabasco/i-got-a-feeling", label: "sample: Tabasco / I got a feeling (117)" },
    { value: "tabasco/under-the-moon",  label: "sample: Tabasco / Under the Moon (161)" },
    { value: "tabasco/electric-sheep",  label: "sample: Tabasco / Electric Sheep (129)" },
    { value: "tabasco/human-fly",       label: "sample: Tabasco / Human Fly (117)" },
    { value: "tabasco/sister",          label: "sample: Tabasco / Sister (117)" },
    { value: "unripe/continuous",    label: "sample: UNRIPE / Continuous (103)" },
    { value: "unripe/list-of-words", label: "sample: UNRIPE / List of Words (103)" },
    { value: "unripe/definition",    label: "sample: UNRIPE / Definition (144)" },
    { value: "unripe/past-and-fate", label: "sample: UNRIPE / Past and Fate (144)" },
    { value: "unripe/end-falls",     label: "sample: UNRIPE / End Falls (108)" },
    { value: "unripe/erase",         label: "sample: UNRIPE / Erase (136)" }
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
      // v198: voice the vocal to settle into the mix — pull the word/consonant
      // band (420–4200 Hz) down so it reads by tone not diction (音感寄り), and
      // lift a high-air shelf so it floats in from above. de-ess deepened since
      // the extra air would otherwise expose sibilance.
      const hp = new Tone.Filter({ frequency: 120, type: "highpass", Q: 0.55 });
      const presence = new Tone.EQ3({ low: -0.5, mid: -1.4, high: 1.3, lowFrequency: 420, highFrequency: 4200 });
      const deEss = new Tone.Filter({ frequency: 6200, type: "peaking", Q: 1.0, gain: -4.5 });
      hp.connect(presence);
      presence.connect(deEss);
      return { input: hp, output: deEss };
    }
    // other
    const hp = new Tone.Filter({ frequency: 120, type: "highpass", Q: 0.55 });
    const shelf = new Tone.EQ3({ low: -0.35, mid: 0.2, high: 0.85, lowFrequency: 220, highFrequency: 4600 });
    hp.connect(shelf);
    return { input: hp, output: shelf };
  }

  // v198: non-vocal "band polish" bus. drums/bass/guitar/chords sum here
  // before the master remaster; the vocal/melody lead and the metronome
  // click bypass it and route straight to masterGain.
  //   instrumentBus → EQ tilt → glue comp → [dry] + [parallel saturation]
  //                 → stereo lift → makeup → masterGain
  // EQ trims low-mid stacking mud and lifts presence/air (hi-fi clarity);
  // the glue compressor + parallel harmonic saturation add density (音圧)
  // without flattening drum transients (12 ms attack, 16% parallel wet).
  function makeInstrumentPolishBus(dest) {
    const input  = new Tone.Gain(1);
    // v274 → v284 → v286 → v301: high shelf retuned for Human Fly.
    //   v274: +3 dB above 4.2 kHz — too high, boosted near-silence.
    //   v284: shelf 4200 → 3000 Hz — fixed v274 dark, but v285's offline
    //         renderer measurement showed AI brightness +863 Hz and
    //         rolloff +1359 Hz vs target (tabasco/human-fly). v284
    //         over-corrected: the +3 dB shelf at 3 kHz now lifts content
    //         that was already at reference brightness.
    //   v286: shelf 3000 → 3600 Hz — meets the prior shelf at the
    //         midpoint, expecting brightness/rolloff to come down ~half-
    //         way toward target without re-darkening.
    //   v301: Human Fly recreation-cycle measured too bright (3785 Hz vs
    //         2402 Hz target) and too unglued (DR 16.49 dB vs 8.73 dB).
    //         Reduce the AI-only shelf/exciter and restore a little glue
    //         while leaving 原音 stems outside this bus.
    // v323: AI wall — un-scoop the mids (the 原音 v322 brief applies here too:
    // early-Nirvana wall lives in the mids) and give back a touch of body.
    // High shelf stays 1.5/4200 — that axis was measurement-tuned (v301).
    const eq     = new Tone.EQ3({ low: -0.5, mid: 0.8, high: 1.5, lowFrequency: 130, highFrequency: 4200 });  // v344: gentle mid/body lift (+0.8) + low-cut under 130Hz; air axis (1.5/4200) preserved
    // v275: comp loosened to preserve dynamic range (measurement-driven).
    // Capture vs target showed DR 12.3 dB vs 33.6 dB (-21 dB gap). v271
    // section dynamics (5 dB swing) addressed the section layer, but the
    // glue comp was squashing per-bar transients flat. Threshold -20 → -14
    // (6 dB more headroom before catching) + ratio 2.2 → 1.8 (gentler when
    // it does catch). Net effect: louder peaks pass through, quiet bits
    // stay quiet, "song breathing" returns. v301 nudges the glue back in
    // for Human Fly so the AI band reads as one performance, not separate
    // drum/bass/other layers.
    // v323: one notch denser (2.05 → 2.2, release 0.17) — v301 measured AI DR
    // still wider than target (16.5 vs 8.7 dB), so more glue is also on-target.
    const comp   = new Tone.Compressor({ threshold: -18, ratio: 2.6, attack: 0.018, release: 0.16, knee: 8 });  // v344: a touch more glue (softer knee, slower attack so transients still snap)
    const lightRuntime = aiLightRuntimeEnabled();
    const widen  = new Tone.StereoWidener(lightRuntime ? 0.38 : 0.50);  // v344: pull width in slightly so the phantom center keeps mono body
    const makeup = new Tone.Gain(3.2);    // v243: glue-comp makeup + AI 再現 level lift (~+9 dB) so the synth band reaches the stems-tuned master at comparable level. v323: 3.0 → 3.2 (~+0.6 dB) to track the 原音 v322 loudness lift. Stems-only (原音) never touch this bus.

    if (lightRuntime) {
      // v316: phone/PWA AI diet. The continuous parallel saturation + exciter
      // path sounds good, but it runs for the whole AI bus even when no note is
      // changing. Keep EQ + glue + width, drop the always-on waveshapers.
      input.connect(eq);
      eq.connect(comp);
      comp.connect(widen);
      widen.connect(makeup);
      makeup.connect(dest);
      return input;
    }

    // v323: grit up (0.12/0.16 → 0.15/0.20) toward the v322 wall density —
    // kept shy of the 原音 settings because synth content tips into fizz sooner.
    const sat    = new Tone.Distortion({ distortion: 0.18, oversample: "2x", wet: 1 });  // audio-cost-ok: desktop-only, behind the if(lightRuntime){...return} early-return at ~L351 (v344 grit 0.18)
    const satWet = new Tone.Gain(0.24);   // v344: 0.20->0.24 parallel saturated blend
    const satDry = new Tone.Gain(0.92);   // parallel clean path
    // v344: low-pass the saturated copy so its harmonics land as low-mid
    // WARMTH/body (~<1.8k), not high fizz — the exciter below owns the air.
    const satLp  = new Tone.Filter({ frequency: 1800, type: "lowpass", Q: 0.3 });

    // v287: parallel high-frequency exciter. The v274/v284/v286 EQ high-
    // shelf could not brighten the AI mix — the webapp source (acoustic
    // CDN kit + synth band) has near-zero energy above ~3 kHz, so shelving
    // an empty band left webapp rolloff stuck at ~2.5 kHz (target 5.3 kHz)
    // across all three rounds (see MEASUREMENT-LOOP §5). An exciter instead
    // GENERATES new harmonics from the existing 1.8-3 kHz content via hard
    // waveshaping, then high-passes at 3.5 kHz so only the freshly-created
    // "air" blends back in (wet 0.10 — subtle, avoids fizz/harshness). This
    // is the source-level "right knob" the three EQ rounds missed. Tapped
    // post-comp so excitation rides the glued, leveled signal. AI-only:
    // stems bypass this bus entirely, so 原音 is untouched.
    const exciteIn    = new Tone.Filter({ frequency: 1800, type: "highpass", Q: 0.4 });
    // v288: oversample 4x → 2x. The exciter's waveshaper runs continuously
    // on the whole AI bus (not a per-note transient), so 4x oversampling
    // was a standing CPU cost that pushed the headless capture renderer
    // into a hard hang during v287 measurement and risks the same on weaker
    // mobile devices. 2x still antialiases the generated harmonics well
    // enough given the 3.5 kHz high-pass + 0.10 wet that follow. Same air,
    // roughly half the exciter CPU.
    const mobileAiDiet = isMobileOrStandaloneRuntime();
    const exciteShape = new Tone.Distortion({
      distortion: mobileAiDiet ? 0.55 : 0.9,
      oversample: mobileAiDiet ? "none" : "2x",
      wet: 1
    });
    const exciteOut   = new Tone.Filter({ frequency: 3500, type: "highpass", Q: 0.5 });
    const exciteWet   = new Tone.Gain(mobileAiDiet ? 0.025 : 0.06);

    input.connect(eq);
    eq.connect(comp);
    comp.connect(satDry);
    comp.connect(sat);
    sat.connect(satLp);
    satLp.connect(satWet);
    comp.connect(exciteIn);
    exciteIn.connect(exciteShape);
    exciteShape.connect(exciteOut);
    exciteOut.connect(exciteWet);
    satDry.connect(widen);
    satWet.connect(widen);
    exciteWet.connect(widen);
    widen.connect(makeup);
    makeup.connect(dest);
    return input;
  }

  // v303: 原音 (stems) master bus — the real-recording counterpart to
  // makeInstrumentPolishBus. The four real stems sum here before the shared
  // master, voiced to the user's reference brief: Nirvana-style loudness /
  // density + LCD Soundsystem-style balance (tight punchy low, present mids,
  // controlled — not harsh — top). AI 再現 never touches this (it has its own
  // polish bus), so 原音 is voiced independently. Stems still tap their own
  // per-stem recorder destinations PRE this bus, so stems-pack export is
  // unaffected.
  //   stemBus.* → makeStemMasterBus → masterGain → shared remaster → limiter
  function makeStemMasterBus(dest) {
    const input  = new Tone.Gain(1);
    // v354: the 原音 stem-master ran an always-on 2x-oversampled grit distortion
    // in every mode — a standing CPU cost that helped choke 原音 on phones (audit
    // MSC-1). Gate the oversampling to device; desktop keeps the v322 wall density.
    const lightRuntime = aiLightRuntimeEnabled();
    // LCD balance: weight the low so kick+bass punch instead of boom, keep
    // mids present, and keep the top alive without letting cymbals turn harsh.
    // v313 nudges mid/high forward so the band wall stands up around the vocal.
    // v322: early-Nirvana (Bleach/Nevermind) wall, by measurement. The tabasco
    // stems put 57% of their energy in 80–250 Hz with only ~5% above 6 kHz and
    // guitar peaking ~6 dB under drums — dark + boomy reads as しょぼい. Tilt a
    // touch off the boom and into mids/bite; the parallel grit below does the
    // real thickening by converting that low energy into harmonics.
    const eq     = new Tone.EQ3({ low: 0.8, mid: 0.85, high: 0.3, lowFrequency: 120, highFrequency: 6500 });
    // Nirvana density: a glue compressor so the band reads as one wall. v311:
    // eased from 2.8:1 / 10ms grab to 2.3:1 / 18ms attack + 0.22 release so it
    // stops pumping the whole band around the forward vocal (調和してない fix) —
    // transients punch through and the mix breathes instead of squashing flat.
    // v322: one notch denser (2.5:1, release 0.20) — keeps the 18ms punch window.
    const comp   = new Tone.Compressor({ threshold: -19, ratio: 2.5, attack: 0.018, release: 0.20, knee: 6 });
    // parallel tape/amp grit — the Bleach-era dirt. v322: 0.11/0.10 → 0.16/0.16
    // so the blended crunch carries the wall's density without comp pumping.
    const sat    = new Tone.Distortion({ distortion: 0.16, oversample: lightRuntime ? "none" : "2x", wet: 1 });
    const satWet = new Tone.Gain(0.16);
    const satDry = new Tone.Gain(1.0);
    // loudness makeup — push the glued band into the shared limiter for 音圧.
    // v311 dropped this to 1.20 to stop the pump; with the slower-attack glue
    // holding, v322 brings the heat back (1.20 → 1.34, ~+1 dB) — しょぼい fix.
    const makeup = new Tone.Gain(1.34);

    input.connect(eq);
    eq.connect(comp);
    comp.connect(satDry);
    comp.connect(sat);
    sat.connect(satWet);
    satDry.connect(makeup);
    satWet.connect(makeup);
    makeup.connect(dest);
    return input;
  }

  // v220 / v271 / v301: section role → instrumentBus gain target. Real bands shape
  // song dynamics across sections — verse settled, chorus lifted,
  // intro / break dropped further for contrast.
  //
  // v271 widening (from v220 ±10% to ±47%): user reported AI 再現 was
  // still "音楽として成立してない" after the texture/groove rounds —
  // structure was the missing layer. Expanding the per-role gain spread
  // makes the verse-vs-chorus contrast clearly audible and pulls intros/
  // breaks back enough to feel dramatic without compromising the glue
  // comp. v301 narrows the deepest dips after the Human Fly render showed
  // the AI band still reading too separated in quiet sections.
  function sectionGainForRole(role) {
    const ROLE_GAIN = {
      intro:  0.68,  // -3.3 dB — atmospheric entrance with body
      verse:  0.84,  // -1.5 dB — settled, makes room for vocal/melody
      comp:   0.96,  // near-neutral comping
      recap:  1.02,  // +0.2 dB chorus / lifted without widening DR too far
      break:  0.66,  // -3.6 dB — dramatic dip, but not a hole
      outro:  0.76,  // -2.4 dB — winding down
      head:   0.96,  // near-neutral
      post:   0.88,  // -1.1 dB — settling after a peak
      swell:  0.86   // -1.3 dB — building anticipation
    };
    return ROLE_GAIN[role] || 0.96;  // unknown role → near-neutral default
  }

  // v220: ramp the instrumentBus gain to the section's target over 0.5s.
  // Fired on the first bar of each section. No-op if instrumentBus isn't
  // built yet (early boot) or we're in stems mode (stems bypass this bus).
  function rampInstrumentBusForSection(sec, time) {
    if (!instrumentBus || !instrumentBus.gain) return;
    if (currentMode !== "synth") return;
    const role = sec?.session_role || sec?.role || "verse";
    const target = sectionGainForRole(role);
    try {
      instrumentBus.gain.cancelScheduledValues(time);
      instrumentBus.gain.linearRampToValueAtTime(target, time + 0.5);
    } catch (e) {}
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
    // v316: FFT + MediaStream taps are now lazy. Keeping analyser/recorder/
    // background streams connected during AI playback costs CPU even when the
    // user is only listening. They are created on first visual draw, REC, or
    // background-bridge arming.
    // v198: low-shelf weight + high shelf for 艶 + tighter comp2 glue.
    // v204: punch & air pass — presence/air shelf lifted (high 0.7→1.4, from
    // 4.8 kHz) for バキバキ crispness, a touch more low-mid scoop (mid −0.5)
    // for 抜け clarity, and comp2 attack slowed (8→16 ms) so transients punch
    // through before the glue clamps.
    const masterEq = new Tone.EQ3({ low: 1.5, mid: -0.5, high: 1.4, lowFrequency: 185, highFrequency: 4800 });
    const masterComp1 = new Tone.Compressor({ threshold: -16, ratio: 2.0, attack: 0.018, release: 0.26, knee: 8 });
    const masterComp2 = new Tone.Compressor({ threshold: -10, ratio: 1.7, attack: 0.016, release: 0.16, knee: 5 });
    masterWidener = new Tone.StereoWidener(0.72);

    // v353: was `currentMode === "synth" && aiLightRuntimeEnabled()` — but the
    // master is built ONCE and shared, and 原音 is the default mode, so a phone
    // booting in 原音 got the HEAVY convolution master reverb (decay 3.0) + 2x
    // tape-sat for the whole session (audit MSC-2/3/4 → 原音 dropouts on phones).
    // Gate on device only, so phones get the intended light master in BOTH modes.
    const lightRuntime = aiLightRuntimeEnabled();
    masterTapeSat = new Tone.Distortion({
      distortion: lightRuntime ? 0.075 : 0.12,
      oversample: lightRuntime ? "none" : "2x",
      wet: 1
    });  // v204/v316: a touch more harmonic edge, lighter on constrained runtimes
    masterTapeSatWet = new Tone.Gain(lightRuntime ? 0.045 : 0.07);
    masterTapeSatDry = new Tone.Gain(0.94);

    masterReverb = lightRuntime
      ? new Tone.FeedbackDelay({ delayTime: "16n.", feedback: 0.20, wet: 1 })   // v358: a bit more cheap room tail on light runtime
      : new Tone.Reverb({ decay: 3.0, preDelay: 0.018, wet: 1 });
    // v330: AI light runtime avoids Tone.Reverb's convolution buffer build
    // during START; a short delay keeps width/space without the heavy boot cost.
    masterDryGain = new Tone.Gain(0.80);
    masterWetGain = new Tone.Gain(lightRuntime ? 0.15 : 0.20);

    masterGain = new Tone.Gain(1.2);
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
    // v198: drums/bass/guitar/chords route through the non-vocal polish bus;
    // the voice (vocal/melody lead) and click bypass it straight to masterGain.
    // v220: assigned to module-level `instrumentBus` so scheduleBar can
    // modulate its gain per section role.
    instrumentBus = makeInstrumentPolishBus(masterGain);
    const drumPan   = new Tone.Panner(0.00).connect(instrumentBus);
    const bassPan   = new Tone.Panner(0.00).connect(instrumentBus);
    // v336: double-track illusion (full runtime). The same guitar performance
    // feeds two takes: dry hard-left and a 13ms Haas-delayed copy hard-right —
    // the classic L/R rhythm-guitar wall without a second sampler. Light
    // runtime keeps the old single slightly-left placement.
    const guitarPan = new Tone.Panner(aiLightRuntimeEnabled() ? -0.18 : -0.42).connect(instrumentBus);
    const voicePan  = new Tone.Panner(0.00).connect(masterGain);
    const chordPan  = new Tone.Panner(+0.16).connect(instrumentBus);
    const clickPan  = new Tone.Panner(0.00).connect(masterGain);
    // v289 mix rebalance — user feedback (Human Fly AI 再現): "bass intro,
    // then mostly only drums." Offline render confirmed guitar+chord sit
    // ~10 dB under drums. v255 dropped chord to background + v254 voiced
    // OFF for rhythm-section clarity, then v259's acoustic drums (hotter
    // than the synth kit those levels were tuned against) overpowered the
    // intended bass+guitar foreground. cramps-punk guitar is sparse, so
    // between stabs only drums+bass remain. Restore harmonic presence:
    // guitar 0.56→0.70 (foreground), chord 0.58→0.52 init (paired with the
    // v289 slider/migration 40→52 so the pad is a present bed, not a wash),
    // drums 0.58→0.52 (back off the v259 acoustic punch). Voice stays OFF
    // (v254 intentional). Stems mode bypasses all of this — 原音 untouched.
    // v298 phone pass: pull drums back and move the AI body parts forward.
    // v301 Human Fly body pass: one more small move away from "mostly drums".
    // v317: restore a little drum pressure after the v316 light-runtime pass.
    // v318: lift guitar pressure/sparkle while keeping bass and chord steady.
    // v319: add a small bass pressure lift without moving the drum/guitar wall.
    drumBus = new Tone.Gain(0.52).connect(drumPan);
    bassBus = new Tone.Gain(0.84).connect(bassPan);
    guitarBus = new Tone.Gain(aiLightRuntimeEnabled() ? 0.88 : 0.74).connect(guitarPan);  // v336: doubled path adds ~+2.5 dB — compensate so the wall widens without getting louder
    if (!aiLightRuntimeEnabled()) {
      const guitarHaas = new Tone.Delay(0.013);
      const guitarPanB = new Tone.Panner(0.42).connect(instrumentBus);
      guitarBus.connect(guitarHaas);
      guitarHaas.connect(guitarPanB);
    }
    voiceBus = new Tone.Gain(1.33).connect(voicePan);   // v243: AI 再現 level lift (~+9 dB, matches the instrumentBus makeup boost) — voice bypasses instrumentBus, so it needs the lift here
    chordBus = new Tone.Gain(0.62).connect(chordPan);
    clickBus = new Tone.Gain(0.35).connect(clickPan);

    // v303: 原音 master bus sits between the stem buses and masterGain so the
    // real recording gets its own Nirvana-loud / LCD-balanced glue (the AI
    // path has makeInstrumentPolishBus; 原音 had nothing). Stems summed here.
    const stemMaster = makeStemMasterBus(masterGain);

    // Original-stem buses → per-stem EQ → stemMaster → masterGain
    // v167: slightly lower full-stem defaults so the remaster chain glues
    // instead of constantly living on the limiter.
    stemBus.drums  = new Tone.Gain(0.92).connect(stemMaster);
    stemBus.bass   = new Tone.Gain(0.91).connect(stemMaster);
    stemBus.other  = new Tone.Gain(0.96).connect(stemMaster);  // v322: guitars forward (measured ~6 dB under drums) — the early-Nirvana wall wants them up
    // Wire EQ outputs into respective buses (input side will receive players)
    stemEQs.drums.output.connect(stemBus.drums);
    stemEQs.bass.output.connect(stemBus.bass);
    stemEQs.other.output.connect(stemBus.other);

    // Vocal stem has its own FX chain — disguise / polish the raw vocal
    // before it reaches the master remaster.
    //
    // Chain: Tone.Player → [dry] + [chorus → delay → reverb (wet)] → vocalBus → masterGain
    // v198: deeper/slower chorus + a longer, more pre-delayed reverb, with the
    // dry path pulled back so the vocal dissolves into the space (ふわっと上から)
    // rather than sitting in front of the band.
    // v304: vocal pulled OUT of the v198 "ふわっと上から / dissolve into space"
    // wash. User ear feedback on the v303 mix: the vocal reads as "floaty /
    // detached — it floats out of the band and reaches the ear early." That
    // washy, reverb-forward voicing contradicts the v303 brief (Nirvana / LCD
    // = vocal sits IN the wall, present). So: dry up and tighten — more dry
    // level, half the reverb send + a shorter tail, half the delay echoes, and
    // a calmer chorus so the vocal stops swimming. It now sits forward and in
    // time with the band instead of hovering above it.
    // v305: user asked the vocal to "軽く空間になじむ" — v304's de-wash sat it
    // present but a touch dry. Add a little space back (a light blend, not the
    // old v303 float): reverb send 0.10 → 0.14 with a slightly longer 2.8s
    // tail, and dry 0.82 → 0.78 so a bit more of that space comes through.
    // Still far drier than the pre-v304 wash — present, just settled into the
    // room rather than bone-dry.
    // v306 grew the reverb back (0.18 send / 3.2s tail) for "空間になじむ" — but
    // the user again reads the vocal as early / detached and the whole mix as
    // not cohesive. The four stems are sample-aligned and start together
    // (verified), so this is the FX floating the vocal, not a timing bug.
    // v311 pulled it firmly into the pocket. v312 added room back. v313 answers
    // the "vocal still strong" pass by lowering the dry center and total vocal
    // bus, then widening the FX path so the voice melts sideways into the band.
    // v354: the vocal chorus is a started LFO that runs always-on on the 原音
    // vocal path. On phones (light runtime) use a passthrough Gain instead so the
    // 原音 vocal chain has no standing modulator; desktop keeps the chorus width.
    // v358: chorus restored on light runtime too — it's one cheap node (LFO + 2
    // delay lines), not the convolution reverb that the watchdog headroom needs off.
    vocalChorus = new Tone.Chorus({ frequency: 1.1, delayTime: 4.2, depth: 0.42, wet: 0.16 }).start();
    vocalDelay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.24, wet: 1 });
    vocalDelayWet = new Tone.Gain(0.0);    // echoes stay off — they smeared the timing
    vocalReverb = lightRuntime
      ? new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.10, wet: 1 })
      : new Tone.Reverb({ decay: 2.9, preDelay: 0.012, wet: 1 });
    vocalReverbWet = new Tone.Gain(0.16);  // v313: more shared room, less front-center vocal
    vocalDryGain = new Tone.Gain(0.68);    // pull the dry vocal back into the wall

    // v303: vocal pulled down so it sits IN the wall, not on top of it.
    // v311: 0.60 → 0.58, back into the pocket with the band — the dry path is up,
    // so it stays present without riding ahead.
    // v313: 0.52, paired with wider FX and louder band stems so the vocal
    // dissolves into the room instead of sitting on top.
    // v319: 0.55, a small pressure lift without bringing the dry center back.
    stemBus.vocals = new Tone.Gain(0.55);

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
    stemBus.vocals.connect(stemMaster);
    // Vocal stem EQ → vocalChorus (so EQ runs before FX chain)
    stemEQs.vocals.output.connect(vocalChorus);

    // External vocal bus — feeds INTO vocalChorus (shares vocal FX chain
    // with stem vocals so chorus/echo/reverb apply to both)
    externalVocalBus = new Tone.Gain(0.78);
    externalVocalBus.connect(vocalChorus);

    return masterGain;
  }

  function ensureMasterFft() {
    if (masterFft) return masterFft;
    ensureMaster();
    if (!masterLimiter) return null;
    try {
      masterFft = new Tone.FFT({ size: 64, smoothing: 0.65 });
      masterLimiter.connect(masterFft);
    } catch (e) {
      console.warn("[Band Room] spectrum analyzer unavailable:", e);
      masterFft = null;
    }
    return masterFft;
  }

  function ensureMasterRecorderDestination() {
    if (masterRecorderDest) return masterRecorderDest;
    ensureMaster();
    if (!masterLimiter) return null;
    try {
      masterRecorderDest = Tone.context.createMediaStreamDestination();
      masterLimiter.connect(masterRecorderDest);
    } catch (e) {
      console.warn("[Band Room] recorder destination unavailable:", e);
      masterRecorderDest = null;
    }
    return masterRecorderDest;
  }

  function ensureBackgroundPlaybackDestination() {
    if (masterPlaybackDest) return masterPlaybackDest;
    ensureMaster();
    if (!masterLimiter) return null;
    try {
      masterPlaybackDest = Tone.context.createMediaStreamDestination();
      masterLimiter.connect(masterPlaybackDest);
    } catch (e) {
      console.warn("[Band Room] playback bridge destination unavailable:", e);
      masterPlaybackDest = null;
    }
    return masterPlaybackDest;
  }

  function ensureStemRecorderDestinations() {
    ensureMaster();
    try {
      STEM_NAMES.forEach((stem) => {
        if (stemRecorderDests[stem] || !stemBus[stem]) return;
        const dest = Tone.context.createMediaStreamDestination();
        stemBus[stem].connect(dest);
        stemRecorderDests[stem] = dest;
      });
    } catch (e) {
      console.warn("[Band Room] per-stem recorder destinations unavailable:", e);
    }
    return stemRecorderDests;
  }

  function isAppleMobileDevice() {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const ua = nav.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  }

  // v308: background audio is ON by default now. The hidden media-stream bridge
  // keeps playback alive when the screen locks / the app is backgrounded. It was
  // previously opt-in AND Apple-only, which made it unreachable without a ?bg=1
  // URL hack (the "codex phone" case). ?bg=0 or a persisted "0" still disables it.
  function backgroundAudioEnabled() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const value = params.get("bg") || params.get("backgroundAudio");
      if (value === "1" || value === "true") return true;
      if (value === "0" || value === "false") return false;
    } catch (e) {}
    try {
      return safeLocalStorageGet(BANDROOM_ALLOW_BACKGROUND_AUDIO_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function shouldPreferBackgroundAudioBridge() {
    if (!backgroundAudioEnabled()) return false;
    // The media bridge matters wherever the OS suspends Web Audio in the
    // background: iOS, Android, and installed (standalone) PWAs. Desktop keeps
    // Web Audio running while hidden, so it doesn't need the bridge.
    const nav = typeof navigator !== "undefined" ? navigator : {};
    return isStandaloneDisplayMode() || isAppleMobileDevice() || /Android|Mobile/i.test(nav.userAgent || "");
  }

  function shouldStopPlaybackForBackground(reason = "hidden") {
    if (backgroundAudioEnabled()) return false;
    if (reason === "pagehide" || reason === "freeze" || reason === "beforeunload") return true;
    if (typeof document !== "undefined" && document.hidden && (reason === "hidden" || reason === "blur")) return true;
    return false;
  }

  function isMobileOrStandaloneRuntime() {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    return isStandaloneDisplayMode() ||
           isAppleMobileDevice() ||
           /Android|Mobile/i.test(nav.userAgent || "") ||
           (Number(nav.hardwareConcurrency) > 0 && Number(nav.hardwareConcurrency) <= 4);
  }

  function runtimeQueryFlag(name) {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const value = params.get(name);
      if (value === "1" || value === "true" || value === "on") return true;
      if (value === "0" || value === "false" || value === "off") return false;
    } catch (e) {}
    return null;
  }

  function aiLightRuntimeEnabled() {
    const forced = runtimeQueryFlag("aiLight");
    if (forced != null) return forced;
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    if (connection && connection.saveData) return true;
    const cores = Number(nav.hardwareConcurrency) || 0;
    const memory = Number(nav.deviceMemory) || 0;
    return isMobileOrStandaloneRuntime() ||
           (cores > 0 && cores <= 8) ||
           (memory > 0 && memory <= 8);
  }

  function aiSamplerUpgradeEnabled() {
    const forced = runtimeQueryFlag("aiSamples");
    if (forced != null) return forced;
    try {
      return safeLocalStorageGet(BANDROOM_AI_SAMPLER_UPGRADE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function shouldAutoUpgradeSynthSamples(reason = "start") {
    return shouldStageSynthPlaybackFirst(reason) && aiSamplerUpgradeEnabled() && !BANDROOM_SAFE_BOOT;
  }

  function samplerDecodeConcurrency() {
    return aiLightRuntimeEnabled() ? 1 : (isMobileOrStandaloneRuntime() ? 2 : 4);
  }

  function yieldToUi() {
    const delayMs = aiLightRuntimeEnabled() ? 40 : (isMobileOrStandaloneRuntime() ? 24 : 8);
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  function bandRoomNowMs() {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function isBandAiPlaybackMode() {
    return currentMode === "synth";
  }

  function uiTelemetryIntervalMs(kind = "timeline") {
    if (isBandAiPlaybackMode() && aiLightRuntimeEnabled()) return kind === "meter" ? 900 : 1000;
    if (isMobileOrStandaloneRuntime()) return kind === "meter" ? 500 : 800;
    if (isBandAiPlaybackMode()) return kind === "meter" ? 300 : 500;
    return kind === "meter" ? 100 : 250;
  }

  function resetPlaybackHealthState() {
    state.lastSchedulerBarAtMs = bandRoomNowMs();
    state.healthLastBarCount = state.barCount;
    try { state.healthLastTransportSec = Number(Tone.Transport?.seconds) || 0; } catch (e) { state.healthLastTransportSec = 0; }
    state.healthStallTicks = 0;
  }

  function loadScriptOnce(src, globalCheck) {
    if (typeof globalCheck === "function" && globalCheck()) return Promise.resolve();
    if (runtimeScriptPromises.has(src)) return runtimeScriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      const done = () => {
        if (!globalCheck || globalCheck()) resolve();
        else reject(new Error("runtime did not expose expected global"));
      };
      if (existing) {
        existing.addEventListener("load", done, { once: true });
        existing.addEventListener("error", () => reject(new Error("script load failed: " + src)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = done;
      script.onerror = () => reject(new Error("script load failed: " + src));
      document.head.appendChild(script);
    }).catch((e) => {
      runtimeScriptPromises.delete(src);
      throw e;
    });
    runtimeScriptPromises.set(src, promise);
    return promise;
  }

  async function ensureMagentaRuntime() {
    if (typeof window.mm !== "undefined") return window.mm;
    await loadScriptOnce(MAGENTA_CORE_URL, () => typeof window.mm !== "undefined");
    await loadScriptOnce(MAGENTA_RNN_URL, () => typeof window.mm?.MusicRNN !== "undefined");
    return window.mm;
  }

  async function ensureMidiRuntime() {
    if (typeof Midi !== "undefined") return Midi;
    if (typeof window.Midi !== "undefined") return window.Midi;
    await loadScriptOnce(TONE_MIDI_URL, () => typeof Midi !== "undefined" || typeof window.Midi !== "undefined");
    return (typeof Midi !== "undefined") ? Midi : window.Midi;
  }

  function ensureBackgroundBridgeAudio() {
    if (backgroundBridgeAudio) return backgroundBridgeAudio;
    const playbackDest = ensureBackgroundPlaybackDestination();
    if (!playbackDest?.stream || typeof document === "undefined") return null;

    const audio = document.createElement("audio");
    audio.id = "br-background-audio";
    audio.autoplay = false;
    audio.controls = false;
    audio.loop = false;
    audio.muted = false;
    audio.playsInline = true;
    audio.srcObject = playbackDest.stream;
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
      ensureMasterRecorderDestination();
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

  // v272: AudioBuffer → WAV (PCM 16-bit interleaved) encoder. Standard
  // pattern (~50 lines). Lets the ● REC button output a .wav file that
  // librosa/scripts/audacity/etc. can read DIRECTLY, no ffmpeg install
  // required — completing the measurement loop (analyze-band-stems.py +
  // compare-capture.py + docs/MEASUREMENT-LOOP.md) for any user with
  // just Python.
  function _writeWavString(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function audioBufferToWavBlob(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.length;
    const dataBytes = samples * numCh * 2; // 16-bit PCM
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    // RIFF header
    _writeWavString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataBytes, true);
    _writeWavString(view, 8, "WAVE");
    // fmt chunk (PCM)
    _writeWavString(view, 12, "fmt ");
    view.setUint32(16, 16, true);              // fmt chunk size
    view.setUint16(20, 1, true);               // PCM format
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numCh * 2, true);  // byte rate
    view.setUint16(32, numCh * 2, true);       // block align
    view.setUint16(34, 16, true);              // bits per sample
    // data chunk
    _writeWavString(view, 36, "data");
    view.setUint32(40, dataBytes, true);
    // PCM samples (interleaved L/R/L/R/...)
    let offset = 44;
    const channels = [];
    for (let ch = 0; ch < numCh; ch++) channels.push(audioBuffer.getChannelData(ch));
    for (let i = 0; i < samples; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        let s = channels[ch][i];
        if (s > 1) s = 1; else if (s < -1) s = -1;
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;
    mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(recorderChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      recorderChunks = [];
      const a = $("br-rec-download");
      if (!a) { setRecorderUi("ready"); return; }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const baseName = `band-room_${state.currentBandId}_${state.currentSongId}_${stamp}`;
      // v272: decode the webm and re-encode as WAV so librosa et al. can
      // read it directly. If decode fails (browser quirk, codec missing),
      // fall back to the raw webm so the user at least gets SOMETHING.
      try {
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        const wavBlob = audioBufferToWavBlob(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        a.href = url;
        a.download = baseName + ".wav";
        a.textContent = `↓ download .wav (${(wavBlob.size / 1024 / 1024).toFixed(1)} MB)`;
        a.style.display = "inline";
      } catch (e) {
        console.warn("[Band Room] WAV re-encode failed, falling back to webm:", e);
        const url = URL.createObjectURL(webmBlob);
        const ext = (mediaRecorder.mimeType || "").includes("mp4") ? "m4a" : "webm";
        a.href = url;
        a.download = baseName + "." + ext;
        a.textContent = `↓ download .${ext} (${(webmBlob.size / 1024 / 1024).toFixed(1)} MB)`;
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
    ensureStemRecorderDestinations();
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
      kick:  { decay: 0.32, octaves: 4.0,  vol: -8,  clickVol: -32, sub: -6, subDecay: 0.26, drive: 0.18 },
      snare: { decay: 0.14, hpFreq: 1100,  vol: -12, rimVol: -28 },
      hat:   { decay: 0.04, bpFreq: 6800,  vol: -22 },
      crash: { decay: 0.9,  vol: -18 },
      // v92: bass / chord / vocal profile params
      bass:  { filterFreq: 480, filterQ: 1.4, drive: 0.08, driveWet: 0.45,
               envRelease: 0.15, postLpFreq: 1400, portamento: 0.018 },
      chord: { oscType: "triangle", attack: 0.018, decay: 0.32, release: 0.5, sustain: 0.5,
               chorusWet: 0.40, autoPanFreq: 0.18, autoPanDepth: 0.32, verbWet: 0.20 },
      vocal: { harmonicity: 2.4, vibratoFreq: 5.0, vibratoCents: 10,
               formant1: 700, formant2: 1200, formant3: 2600, formant3Q: 6, hpFreq: 200, verbWet: 0.22 },
      guitar: { oscType: "sawtooth", driveAmt: 0.55, dryWet: 0.42, driveWet: 0.62, cabFreq: 2200, cabQ: 1.5, lpFreq: 4800, verbWet: 0.12 }
    },
    "sakanaction": {
      label: "Sakanaction (dance rock — tight kick / clicky hat)",
      kick:  { decay: 0.20, octaves: 5.0,  vol: -6,  clickVol: -22, sub: -9, subDecay: 0.16, drive: 0.10 },
      snare: { decay: 0.09, hpFreq: 1600,  vol: -10, rimVol: -24 },
      hat:   { decay: 0.028, bpFreq: 8200, vol: -20 },
      crash: { decay: 1.1,  vol: -16 },
      // Bright synth bass with snappy filter env, glassy pad, clean vocal
      bass:  { filterFreq: 720, filterQ: 2.4, drive: 0.04, driveWet: 0.35,
               envRelease: 0.08, postLpFreq: 2400, portamento: 0.008,
               filterDecay: 0.07, filterSustain: 0.35, filterBase: 160, filterOctaves: 2.9 },
      chord: { oscType: "sawtooth", attack: 0.008, decay: 0.20, release: 0.35, sustain: 0.55,
               chorusWet: 0.55, autoPanFreq: 0.35, autoPanDepth: 0.42, verbWet: 0.16 },
      vocal: { harmonicity: 2.0, vibratoFreq: 4.0, vibratoCents: 6,
               formant1: 850, formant2: 1500, formant3: 2950, formant3Q: 5, hpFreq: 280, verbWet: 0.14 },
      guitar: { oscType: "sawtooth", driveAmt: 0.40, dryWet: 0.50, driveWet: 0.52, cabFreq: 2600, cabQ: 1.3, lpFreq: 5200, verbWet: 0.10 }
    },
    "lcd-motorik": {
      label: "LCD motorik (4-on-floor / cowbell / pad swell)",
      kick:  { decay: 0.38, octaves: 6.0,  vol: -5,  clickVol: -28, sub: -4, subDecay: 0.34, drive: 0.22 },
      snare: { decay: 0.18, hpFreq: 950,   vol: -8,  rimVol: -26 },
      hat:   { decay: 0.06, bpFreq: 5800,  vol: -19 },
      crash: { decay: 1.3,  vol: -14 },
      // Sub-y bass with portamento, dreamy pad swell, breathy vocal
      bass:  { filterFreq: 600, filterQ: 1.6, drive: 0.06, driveWet: 0.42,
               envRelease: 0.22, postLpFreq: 1600, portamento: 0.04,
               filterDecay: 0.22, filterSustain: 0.6, filterBase: 80, filterOctaves: 2.2 },
      chord: { oscType: "triangle", attack: 0.040, decay: 0.55, release: 0.85, sustain: 0.7,
               chorusWet: 0.48, autoPanFreq: 0.10, autoPanDepth: 0.28, verbWet: 0.34 },
      vocal: { harmonicity: 2.6, vibratoFreq: 5.5, vibratoCents: 14,
               formant1: 650, formant2: 1100, formant3: 2450, formant3Q: 4.5, hpFreq: 180, verbWet: 0.32 },
      guitar: { oscType: "sawtooth", driveAmt: 0.50, dryWet: 0.45, driveWet: 0.58, cabFreq: 2000, cabQ: 1.4, lpFreq: 4600, verbWet: 0.16 }
    },
    "cramps-punk": {
      label: "Cramps punk (Human Fly / boomy / rockabilly slap)",
      kick:  { decay: 0.40, octaves: 5.5,  vol: -7,  clickVol: -36, sub: -3, subDecay: 0.40, drive: 0.30 },
      snare: { decay: 0.22, hpFreq: 800,   vol: -10, rimVol: -22 },
      hat:   { decay: 0.05, bpFreq: 5000,  vol: -27 },
      crash: { decay: 1.45, vol: -18 },
      // Distorted slap bass, square stab chord, snarled vocal
      bass:  { filterFreq: 380, filterQ: 2.6, drive: 0.18, driveWet: 0.70,
               envRelease: 0.10, postLpFreq: 1200, portamento: 0.02,
               filterDecay: 0.09, filterSustain: 0.28, filterBase: 90, filterOctaves: 3.4 },
      chord: { oscType: "square", attack: 0.005, decay: 0.18, release: 0.25, sustain: 0.28,
               chorusWet: 0.22, autoPanFreq: 0.06, autoPanDepth: 0.18, verbWet: 0.12 },
      vocal: { harmonicity: 3.0, vibratoFreq: 6.5, vibratoCents: 18,
               formant1: 560, formant2: 1400, formant3: 2850, formant3Q: 6.5, hpFreq: 260, verbWet: 0.18 },
      guitar: { oscType: "square", driveAmt: 0.72, dryWet: 0.34, driveWet: 0.74, cabFreq: 2400, cabQ: 1.8, lpFreq: 5000, verbWet: 0.08 }
    },
    "lofi-nujabes": {
      label: "Lofi Nujabes (jazzy boom-bap + warm piano)",
      // v109: Nujabes 感を音色そのもので。dusty drum + walking sub bass +
      // piano chord (Salamander 推奨, linked via master preset) + warm vocal.
      // Drum: tight kick, body-rich snare (low HP), brushed hat, ride-friendly crash
      kick:  { decay: 0.28, octaves: 4.5, vol: -7,  clickVol: -28, sub: -7, subDecay: 0.24, drive: 0.14 },
      snare: { decay: 0.16, hpFreq: 900,  vol: -11, rimVol: -30 },
      hat:   { decay: 0.05, bpFreq: 6200, vol: -23 },
      crash: { decay: 1.2,  vol: -17 },
      // Bass: warm upright-ish, slow filter env, soft portamento for walking feel
      bass:  { filterFreq: 380, filterQ: 1.0, drive: 0.04, driveWet: 0.30,
               envRelease: 0.30, postLpFreq: 1200, portamento: 0.06,
               filterDecay: 0.30, filterSustain: 0.65, filterBase: 70, filterOctaves: 1.8 },
      // Chord: soft triangle pad with long release + verb (用 fallback when
      // sampler not loaded; master preset auto-switches chord_instrument to
      // salamander-piano which takes over via Tone.Sampler)
      chord: { oscType: "triangle", attack: 0.030, decay: 0.45, release: 0.75, sustain: 0.6,
               chorusWet: 0.20, autoPanFreq: 0.08, autoPanDepth: 0.15, verbWet: 0.28 },
      // Vocal: warm formants, gentle vibrato, healthy verb tail (jazzy)
      vocal: { harmonicity: 2.2, vibratoFreq: 4.5, vibratoCents: 8,
               formant1: 720, formant2: 1300, formant3: 2400, formant3Q: 4.5, hpFreq: 220, verbWet: 0.34 },
      guitar: { oscType: "sawtooth", driveAmt: 0.34, dryWet: 0.55, driveWet: 0.42, cabFreq: 1900, cabQ: 1.2, lpFreq: 4300, verbWet: 0.14 }
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
    "neutral":  { reverb: 20, width: 72, warmth: 9, loudness: -1,
                  synth_profile: "default",
                  chord_instrument: "", bass_instrument: "",
                  guitar_instrument: "", voice_instrument: "",
                  // v260: was null (= "don't touch") which silently reverted
                  // users to synth when they applied the neutral preset, undoing
                  // the v259 acoustic default. Aligned to the shipped default.
                  kit_source: "online/tone-acoustic", guitar_on: true },
    "vertical-room": { reverb: 30, width: 60, warmth: 12, loudness: -1 },
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
    "rock":     { reverb: 18, width: 68, warmth: 11, loudness: 0,
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

  // v229: synth-lifecycle leak fix. The make* factories each build an FX
  // chain (filters / reverb / chorus / running LFOs) around a head synth,
  // but historically returned only the head synth — so disposing it
  // orphaned the whole chain. makeDrumKit was worse: it returned a plain
  // { kick, snare, ... } object with NO dispose at all, so buildKitForSource's
  // `if (drumKit && drumKit.dispose)` guard silently short-circuited and
  // never disposed the synth kit — leaking ~9 continuously-running
  // noise/oscillator generators on every kit-profile change. Since
  // applyRecommendedKitProfile fires that rebuild on every song switch, a
  // few switches in AI 再現 mode piled up dozens of orphaned oscillators +
  // LFOs that saturated the audio thread and froze the device. This wraps
  // a factory's returned object so its dispose() tears down the ENTIRE
  // chain — not just the head node. orig may be absent (makeDrumKit).
  function withChainDispose(node, extraNodes) {
    if (!node) return node;
    const orig = typeof node.dispose === "function" ? node.dispose.bind(node) : null;
    node.dispose = function () {
      if (orig) { try { orig(); } catch (e) {} }
      (extraNodes || []).forEach((n) => {
        try { if (n && typeof n.dispose === "function") n.dispose(); } catch (e) {}
      });
      return node;
    };
    return node;
  }

  function markLayerKind(node, kind) {
    if (node && typeof node === "object") {
      try { node._brLayerKind = kind; } catch (e) {}
    }
    return node;
  }

  function isSamplerLayer(node) {
    return !!(node && node._brLayerKind === "sampler");
  }

  // v237: buffer-based drum kit. The old kit re-synthesised every hit LIVE —
  // machine-gunning Tone synths ~30×/bar piled up Web Audio cost until the
  // browser choked (preview oracle: full density freezes ~16s, ~2 hits/bar
  // survives; PolySynth / bass / voice ruled out — it was the synth drums).
  // 原音 (stem) playback — buffered AudioBufferSource playback — never chokes.
  // Fix: render each drum voice's synth sound to a short buffer ONCE at
  // kit-build time, then play hits as cheap one-shot buffer sources. Same
  // sound, same Dilla / ghost / fill rhythm logic — only the playback engine
  // changes (live re-synthesis → buffer playback).
  function playDrumHit(buffer, panNode, time, vel, rate = 1) {
    if (!buffer) return;
    const t = Math.max(Number(time) || 0, Tone.now() + 0.003);
    let src, g;
    try {
      g = new Tone.Gain(clamp(Number(vel) || 0.5, 0.001, 1)).connect(panNode);
      src = new Tone.ToneBufferSource({
        url: buffer,
        playbackRate: clamp(Number(rate) || 1, 0.5, 2),   // v347: round-robin micro-detune
        onended() {
          try { src.dispose(); } catch (e) {}
          try { g.dispose(); } catch (e) {}
        }
      }).connect(g);
      src.start(t);
    } catch (e) {
      try { if (src) src.dispose(); } catch (e2) {}
      try { if (g) g.dispose(); } catch (e2) {}
    }
  }

  function makeLightDrumBuffer(seconds, render) {
    const raw = Tone.context?.rawContext || Tone.context?.context || Tone.context;
    const sr = Math.max(8000, Math.floor(raw?.sampleRate || 44100));
    const len = Math.max(1, Math.floor(seconds * sr));
    const audioBuffer = raw.createBuffer(1, len, sr);
    const data = audioBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      data[i] = clamp(render(t, i, sr), -1, 1);
    }
    return typeof Tone.ToneAudioBuffer === "function" ? new Tone.ToneAudioBuffer(audioBuffer) : audioBuffer;
  }

  function makeLightDrumKit(target, profileName) {
    const p = KIT_PROFILES[profileName] || KIT_PROFILES["default"];
    // v346: chest-thump sub + DC-free tanh fold (peaks calibrated in preview;
    // see changelog). Profile-driven, NaN-guarded (?? defaults).
    const kSubDb  = p.kick.sub ?? -6;
    const kSubDec = Math.min(p.kick.subDecay ?? 0.26, 0.14);   // cap: a thump, not a boomy drone
    const kDrv    = p.kick.drive ?? 0.18;
    const kSubAmp = Math.pow(10, kSubDb / 20);
    const kDrvK   = 1 + kDrv * 1.5;            // gentle tanh pre-gain (DC-free, keeps dynamics)
    const kNorm   = 1 / Math.tanh(kDrvK);      // unity-back so the fold never raises peak
    const kickBuf = makeLightDrumBuffer(0.42, (t, i, sr) => {
      const env = Math.exp(-t * 9.0);
      const freq = 46 + 72 * Math.exp(-t * 18);
      const body = Math.sin(2 * Math.PI * freq * t) * env * 0.76;
      const sub = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t / kSubDec) * kSubAmp * 0.24;  // 55Hz (A1) thump
      const folded = Math.tanh((body + sub) * kDrvK) * kNorm;
      const click = i < sr * 0.012 ? (Math.random() * 2 - 1) * (1 - i / (sr * 0.012)) * 0.10 : 0;
      return folded + click;
    });
    const snareBuf = makeLightDrumBuffer(0.24, (t) => {
      const env = Math.exp(-t * (18 / Math.max(0.06, p.snare.decay)));
      const noise = (Math.random() * 2 - 1) * env * 0.46;
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.13;   // v346: fast bright snap
      const body = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 24) * 0.14;
      return noise + crack + body;
    });
    const hatFreq = (p.hat && p.hat.bpFreq) ? p.hat.bpFreq : 6800;
    const hatBuf = makeLightDrumBuffer(0.09, (t, i) => {
      const env = Math.exp(-t * 72);
      const noise = ((Math.random() * 2 - 1) - (i % 2 ? 0.22 : -0.22)) * env * 0.26;
      const metal = (Math.sin(2 * Math.PI * hatFreq * t) + Math.sin(2 * Math.PI * hatFreq * 1.503 * t)) * env * 0.06;  // v346: inharmonic shimmer
      return noise + metal;
    });
    const clapBuf = makeLightDrumBuffer(0.18, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 24) * 0.42);
    const cowbellBuf = makeLightDrumBuffer(0.16, (t) => (
      Math.sin(2 * Math.PI * 540 * t) + Math.sin(2 * Math.PI * 810 * t) * 0.55
    ) * Math.exp(-t * 18) * 0.32);
    const tomBuf = makeLightDrumBuffer(0.28, (t) => {
      const freq = 96 + 44 * Math.exp(-t * 12);
      return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * 0.55;
    });
    const crashBuf = makeLightDrumBuffer(0.72, (t, i) => {
      const env = Math.exp(-t * 3.1);
      const noise = ((Math.random() * 2 - 1) - (i % 3 ? 0.12 : -0.12)) * env * 0.19;
      const shimmer = (Math.sin(2 * Math.PI * 5400 * t) + Math.sin(2 * Math.PI * 8217 * t)) * env * 0.05;  // v346: detuned partials
      return noise + shimmer;
    });

    const kickPan  = new Tone.Panner(0).connect(target);
    const snarePan = new Tone.Panner(-0.06).connect(target);
    const hatPan   = new Tone.Panner(0.22).connect(target);
    const ghostPan = new Tone.Panner(-0.16).connect(target);
    const fillPan  = new Tone.Panner(0.12).connect(target);
    const crashPan = new Tone.Panner(0.20).connect(target);

    // v348: round-robin micro-detune on the light kit too (kick/snare/hat) — this
    // is the path heard on every phone/PWA start. playbackRate only, no added energy.
    let rr = 0;
    const kit = {
      kick:  { triggerAttackRelease(_note, _dur, time, vel) { playDrumHit(kickBuf, kickPan, time, clamp(vel, 0.04, 0.98), 1 + ((rr++ & 1) ? 0.0012 : -0.0012)); } },
      snare: { triggerAttackRelease(_d, time, vel) { playDrumHit(snareBuf, snarePan, time, clamp(vel, 0.05, 0.95), 1 + ((rr++ & 1) ? 0.0015 : -0.0015)); } },
      hat:   { triggerAttackRelease(_d, time, vel) { playDrumHit(hatBuf, hatPan, time, clamp(vel, 0.02, 0.55), 1 + ((rr++ & 1) ? 0.0010 : -0.0010)); } },
      ghost: { triggerAttackRelease(_d, time, vel, role) {
        const v = clamp(vel, 0.04, 0.7);
        playDrumHit(role && role.indexOf("cowbell") >= 0 ? cowbellBuf : clapBuf, ghostPan, time, v);
      } },
      fill:  { triggerAttackRelease(_d, time, vel) { playDrumHit(tomBuf, fillPan, time, clamp(vel, 0.05, 0.9)); } },
      crash: { triggerAttackRelease(_d, time, vel) { playDrumHit(crashBuf, crashPan, time, clamp(vel, 0.06, 0.85)); } }
    };
    return withChainDispose(markLayerKind(kit, "synth"), [kickPan, snarePan, hatPan, ghostPan, fillPan, crashPan]);
  }

  async function makeDrumKit(target, profileName) {
    const p = KIT_PROFILES[profileName] || KIT_PROFILES["default"];

    // Render each voice's synth sound to a buffer once (offline). Sequential
    // awaits — the kit is built once per playback start, a few ms each.
    const kSubDb  = p.kick.sub ?? -6;
    const kSubDec = Math.min(p.kick.subDecay ?? 0.26, 0.14);
    const kDrv    = p.kick.drive ?? 0.18;
    const kickBuf = await Tone.Offline(() => {
      // v346: make-up < 1 so the added 55Hz sub + tanh warmth stay under the safe
      // rendered peak (~0.6 vs the live drumBus 0.52 * polish 3.2 = 1.66x).
      const out = new Tone.Gain(0.62).toDestination();
      // DC-free warmth: a gentle tanh waveshaper (NOT Chebyshev — order-2 on a
      // ~55Hz sub would add DC + a strong 2nd harmonic and clip after make-up).
      const k = 1 + kDrv * 1.5;
      const curve = new Float32Array(1024);
      for (let n = 0; n < 1024; n++) {
        const x = (n / 1023) * 2 - 1;
        curve[n] = Math.tanh(x * k) / Math.tanh(k);
      }
      const shaper = new Tone.WaveShaper(curve).connect(out);
      const click = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.012 },
        volume: p.kick.clickVol
      }).connect(out);
      const body = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: p.kick.octaves,
        envelope: { attack: 0.001, decay: p.kick.decay, sustain: 0, release: 0.15 },
        volume: p.kick.vol
      }).connect(shaper);
      // parallel 55Hz (A1) sub, enveloped ONLY (not also raw) so it is a decaying
      // thump, not a constant drone for the whole render window.
      const sub = new Tone.Oscillator({ frequency: 55, type: "sine", volume: kSubDb });
      const subEnv = new Tone.AmplitudeEnvelope({ attack: 0.004, decay: kSubDec, sustain: 0, release: 0.05 }).connect(shaper);
      sub.connect(subEnv);
      sub.start(0).stop(kSubDec + 0.1);
      subEnv.triggerAttackRelease(kSubDec, 0);
      body.triggerAttackRelease("C1", "8n", 0, 0.86);
      click.triggerAttackRelease("128n", 0, 0.16);
    }, 0.9);

    const snareBuf = await Tone.Offline(() => {
      // v346: layered snare = crack (hp noise) + dark fizz tail + ~190Hz shell tone
      // + un-buried rim. Bus make-up dropped 0.85->0.72 to absorb the added layers.
      const bus = new Tone.Gain(0.72).toDestination();
      const hp = new Tone.Filter({ frequency: p.snare.hpFreq, type: "highpass", Q: 0.8 }).connect(bus);
      const body = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: p.snare.decay, sustain: 0, release: 0.06 },
        volume: p.snare.vol
      }).connect(hp);
      const fizzLp = new Tone.Filter({ frequency: 2600, type: "lowpass", Q: 0.7 }).connect(bus);
      const fizz = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.002, decay: p.snare.decay * 1.4, sustain: 0, release: 0.08 },
        volume: p.snare.vol - 8
      }).connect(fizzLp);
      const shell = new Tone.MembraneSynth({
        pitchDecay: 0.03, octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.10, sustain: 0, release: 0.05 },
        volume: p.snare.vol - 6
      }).connect(bus);
      const rim = new Tone.MetalSynth({
        frequency: 165, envelope: { attack: 0.001, decay: 0.04, release: 0.02 },
        harmonicity: 2.4, modulationIndex: 5, resonance: 1800, octaves: 0.5,
        volume: p.snare.rimVol + 2
      }).connect(bus);
      body.triggerAttackRelease("16n", 0, 0.86);
      fizz.triggerAttackRelease("16n", 0, 0.6);
      shell.triggerAttackRelease("G3", "32n", 0, 0.7);
      rim.triggerAttackRelease("64n", 0.005, 0.36);
    }, 0.6);

    const hatBuf = await Tone.Offline(() => {
      const bus = new Tone.Gain(0.6).toDestination();
      const bp = new Tone.Filter({ frequency: p.hat.bpFreq, type: "bandpass", Q: 2.4 }).connect(bus);
      const n = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: p.hat.decay, sustain: 0, release: 0.018 },
        volume: p.hat.vol
      }).connect(bp);
      n.triggerAttackRelease("64n", 0, 0.5);
    }, 0.32);

    const clapBuf = await Tone.Offline(() => {
      const bus = new Tone.Gain(0.7).toDestination();
      const bp = new Tone.Filter({ frequency: 1200, type: "bandpass", Q: 1.5 }).connect(bus);
      const body = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.04 },
        volume: -18
      }).connect(bp);
      body.triggerAttackRelease("32n", 0, 0.7);
    }, 0.5);

    const cowbellBuf = await Tone.Offline(() => {
      const cb = new Tone.MetalSynth({
        frequency: 540, envelope: { attack: 0.001, decay: 0.18, release: 0.04 },
        harmonicity: 3.2, modulationIndex: 8, resonance: 2400, octaves: 1.2,
        volume: -22
      }).toDestination();
      cb.triggerAttackRelease("16n", 0, 0.85);
    }, 0.5);

    const tomBuf = await Tone.Offline(() => {
      const t = new Tone.MembraneSynth({
        pitchDecay: 0.06, octaves: 2.4,
        envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.12 },
        volume: -14
      }).toDestination();
      t.triggerAttackRelease("E2", "16n", 0, 0.9);
    }, 0.6);

    const crashBuf = await Tone.Offline(() => {
      const hp = new Tone.Filter({ frequency: 4200, type: "highpass", Q: 0.6 }).toDestination();
      const c = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.002, decay: p.crash.decay, sustain: 0, release: 0.6 },
        volume: p.crash.vol
      }).connect(hp);
      c.triggerAttackRelease("2n", 0, 0.85);
    }, 2.6);

    // v351: shared room reverb removed. A convolution Reverb running always-on
    // on the AI bus (stacked with the guitar reverb + the pre-existing voice/
    // chord/master reverbs) overloaded the audio thread and bled dropouts into
    // 原音 while the synth band lingered in the graph. Round-robin (below) stays.
    // Playable kit: one persistent panner per voice; hits are one-shot buffers.
    const kickPan  = new Tone.Panner(0).connect(target);
    const snarePan = new Tone.Panner(-0.06).connect(target);
    const hatPan   = new Tone.Panner(0.22).connect(target);
    const ghostPan = new Tone.Panner(-0.16).connect(target);
    const fillPan  = new Tone.Panner(0.12).connect(target);
    const crashPan = new Tone.Panner(0.20).connect(target);

    // v347: alternate a ~+/-1.3 cent detune per hit so repeated kicks/snares are
    // not byte-identical (round-robin). playbackRate only — no added energy.
    let rr = 0;
    const kick = {
      triggerAttackRelease(_note, _dur, time, vel) {
        const rate = 1 + ((rr++ & 1) ? 0.0012 : -0.0012);
        playDrumHit(kickBuf, kickPan, time, clamp(vel, 0.04, 0.98), rate);
      }
    };
    const snare = {
      triggerAttackRelease(_d, time, vel) {
        const rate = 1 + ((rr++ & 1) ? 0.0015 : -0.0015);
        playDrumHit(snareBuf, snarePan, time, clamp(vel, 0.05, 0.95), rate);
      }
    };
    const hat = {
      triggerAttackRelease(_d, time, vel) {
        const rate = 1 + ((rr++ & 1) ? 0.0010 : -0.0010);   // v348: round-robin
        playDrumHit(hatBuf, hatPan, time, clamp(vel, 0.02, 0.55), rate);
      }
    };
    const ghost = {
      triggerAttackRelease(_d, time, vel, role) {
        const v = clamp(vel, 0.04, 0.7);
        if (role && role.indexOf("cowbell") >= 0) playDrumHit(cowbellBuf, ghostPan, time, v * 0.9);
        else playDrumHit(clapBuf, ghostPan, time, v);
      }
    };
    const fill = {
      triggerAttackRelease(_d, time, vel) {
        playDrumHit(tomBuf, fillPan, time, clamp(vel, 0.05, 0.9));
      }
    };
    const crash = {
      triggerAttackRelease(_d, time, vel) {
        playDrumHit(crashBuf, crashPan, time, clamp(vel, 0.06, 0.85));
      }
    };

    // v229/v237: dispose tears down the persistent panners. The rendered
    // buffers and one-shot sources GC on their own (sources self-dispose on
    // onended) — no continuously-running generators left to leak.
    return withChainDispose(
      markLayerKind({ kick, snare, hat, ghost, fill, crash }, "synth"),
      [kickPan, snarePan, hatPan, ghostPan, fillPan, crashPan]
    );
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
  // v270: pre-decode CDN samples manually before handing to Tone.Sampler.
  // Tone.js v14.8.49's internal ToneAudioBuffer.load() fails on
  // cdn.jsdelivr.net URLs ("could not load url:") even though fetch +
  // AudioContext.decodeAudioData on the SAME URL works fine — verified by
  // manual repro. salamander-piano on tonejs.github.io worked through Tone's
  // loader, masking the bug until v265+v267 made bass-electric and guitar-
  // acoustic (both jsDelivr-hosted) the AI 再現 defaults. Symptom: drums +
  // chord audible, bass + guitar silent. Fix: fetch + decodeAudioData per
  // note, wrap in Tone.ToneAudioBuffer, pass the buffer-map to Tone.Sampler
  // (it accepts ToneAudioBuffer values in its urls option).
  async function decodedSamplerBuffer(url) {
    if (!samplerAudioBufferCache.has(url)) {
      samplerAudioBufferCache.set(url, (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const ab = await res.arrayBuffer();
          const audio = await Tone.context.decodeAudioData(ab);
          await yieldToUi();
          return audio;
        } catch (e) {
          console.warn("[Band Room] sample preload failed (" + url + "):", e && e.message ? e.message : e);
          return null;
        }
      })());
    }
    return samplerAudioBufferCache.get(url);
  }

  async function preloadSamplerUrls(urls) {
    const preloaded = {};
    const entries = Object.entries(urls || {});
    const limit = Math.max(1, Math.min(samplerDecodeConcurrency(), entries.length || 1));
    let cursor = 0;
    async function worker() {
      while (cursor < entries.length) {
        const [note, url] = entries[cursor++];
        const audio = await decodedSamplerBuffer(url);
        if (audio) preloaded[note] = new Tone.ToneAudioBuffer(audio);
        await yieldToUi();
      }
    }
    await Promise.all(Array.from({ length: limit }, worker));
    return preloaded;
  }

  async function makeVelocitySensitiveSampler(opts) {
    const minCutoff = opts.minCutoff ?? 1200;
    const maxCutoff = opts.maxCutoff ?? 8000;
    const filter = new Tone.Filter({ frequency: maxCutoff, type: "lowpass", Q: 0.6 });
    // v270: pre-decode rather than passing raw URLs (see preloadSamplerUrls)
    const preloaded = await preloadSamplerUrls(opts.urls);
    if (Object.keys(preloaded).length === 0) return null;
    const sampler = new Tone.Sampler({
      urls: preloaded,
      release: opts.baseRelease ?? 0.6,
      volume: opts.volume ?? -6
    }).connect(filter);
    return {
      _brLayerKind: "sampler",
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

  // v237-v241: AI 再現 rebuild COMPLETE — all 5 parts restored, the
  // browser-choke runaway fixed. Drums are buffer-based (v237). bass (v238),
  // voice (v239), chord (v240), guitar (v241) re-enabled. guitar uses a
  // sparse-strum cap (guitarSparseStrums — ~8 strums/bar → ~2) so its
  // PolySynth is not machine-gunned. SYNTH_REBUILD_PARTS stays as a per-part
  // kill-switch: flip any part to false to silence it if it ever regresses.
  const SYNTH_REBUILD_PARTS = { bass: true, guitar: true, voice: true, chord: true };

  async function makeSynthBass(target, opts = {}) {  // v270: async — awaits the v270 sampler pre-decode
    // v110: if bassInstrument is set to a sampler in catalog.instruments[],
    // use real samples (e.g. salamander-bass = piano left-hand register).
    // Falls back to profile-aware synth bass otherwise.
    const b = currentProfile().bass;
    const light = opts.light === true || aiLightRuntimeEnabled();
    const post = new Tone.Filter({ frequency: b.postLpFreq, type: "lowpass", Q: 0.6 }).connect(target);

    if (!opts.forceSynth && state.bassInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.bassInstrument);
      if (instDef && instDef.kind === "sampler") {
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, p]) => {
          urls[note] = instDef.base_url + p;
        });
        // v126: velocity-sensitive — 強く弾いたらブライト、弱く弾いたらダーク
        const sampler = await makeVelocitySensitiveSampler({
          urls, baseRelease: 0.4, volume: -2,  // v269: +2 dB lift (was -4). After v267 made bass-electric the default, sample's natural decay envelope read quieter than the synth fat-saw fallback at v101 calibration — drums dominated. +2 dB rebalances toward drums without re-tuning the master or stems chains.
          minCutoff: 600, maxCutoff: 3200
        });
        if (sampler) {
          sampler.connect(post);
          return withChainDispose(sampler, [post]);  // v229: also tear down post filter
        }
      }
    }

    // synth fallback
    const drive = new Tone.Distortion({
      distortion: light ? Math.min(b.drive, 0.18) : b.drive,
      wet: light ? Math.min(b.driveWet, 0.42) : b.driveWet,
      oversample: light ? "none" : "2x"
    }).connect(post);
    const bass = new Tone.MonoSynth({
      // v244: fat (detuned-unison) oscillator. A lone sawtooth reads as a
      // static "beep"; the detune gives analog width. v344: spread 20->26 now
      // that the clean sub (below) anchors the fundamental. Light = single saw.
      oscillator: light ? { type: "sawtooth" } : { type: "fatsawtooth", count: 3, spread: 26 },
      filter: { type: "lowpass", frequency: b.filterFreq, Q: b.filterQ },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.6, release: b.envRelease },
      // v344: filter envelope is now profile-driven (was one hard-coded literal
      // that made every profile articulate the same). cramps snarls, sakanaction
      // plucks, lcd/lofi stay round. Defaults reproduce the prior constant.
      filterEnvelope: {
        attack: 0.003,
        decay: b.filterDecay ?? 0.12,
        sustain: b.filterSustain ?? 0.5,
        release: 0.12,
        baseFrequency: b.filterBase ?? 120,
        octaves: b.filterOctaves ?? 2.6
      },
      portamento: b.portamento,
      volume: -10
    }).connect(drive);

    // v344: clean sub-oscillator one octave down — the direct fix for the
    // "thin" bass. A lone (fat)saw has a weak fundamental; a sine an octave
    // below at ~-5 dB supplies the body on BOTH runtimes (one sine osc is the
    // cheapest node, so the light/phone path gets it too). Summed into the SAME
    // `post` lowpass but NOT through `drive`, so the fundamental stays clean
    // (no grit = no mud). Construction, not a new trigger (v241/v343 safe).
    const subGain = new Tone.Gain(light ? 0.5 : 0.6).connect(post);
    const sub = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.008, decay: 0.16, sustain: 0.85, release: b.envRelease },
      volume: 0
    }).connect(subGain);
    const origTAR = bass.triggerAttackRelease.bind(bass);
    const origTR = bass.triggerRelease.bind(bass);
    bass.triggerAttackRelease = function (note, dur, time, vel) {
      origTAR(note, dur, time, vel);
      try {
        const f = Math.max(33, Tone.Frequency(note).toFrequency() * 0.5);  // clamp: keep the sub out of sub-audible rumble
        sub.triggerAttackRelease(f, dur, time, Math.min((vel ?? 1) * 0.9, 1));
      } catch (e) {}
      return bass;
    };
    bass.triggerRelease = function (time) {
      origTR(time);
      try { sub.triggerRelease(time); } catch (e) {}
      return bass;
    };
    return withChainDispose(markLayerKind(bass, "synth"), [post, drive, sub, subGain]);  // v229/v344: tear down post + drive + sub
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
      const gain = stemPlayerGains[k];
      if (gain) {
        try { gain.dispose(); } catch (e) {}
      }
      stemPlayers[k] = null;
      stemPlayerGains[k] = null;
    });
    state.loadedStemDurationSec = 0;
    loadedStemsSongId = null;
    loadedStemsVariant = null;
  }

  function currentBand() {
    if (!state.bandsRegistry) return null;
    return state.bandsRegistry.bands[state.currentBandId] || null;
  }

  // v213: per-band / per-song kit profile auto-mapping. bands.json may
  // specify `kit_profile_default` on the band (e.g. UNRIPE → "cramps-punk")
  // and `kit_profile` on individual songs (e.g. Tabasco / Human Fly →
  // "cramps-punk"). loadSong calls this after song data is set.
  //
  // v215: gate on `state.kitProfileExplicitlyChosen` (set by the profileSel
  // change handler when the user manually picks a non-default profile)
  // instead of `state.kitProfile === "default"`. The old condition broke
  // album-listen-through: the first auto-apply made state non-default,
  // which locked out auto-mapping for every subsequent song. Now auto-
  // apply continues until the user explicitly picks something from the
  // dropdown; picking "default" treats it as "auto-pick mode" and resets
  // the flag.
  function applyRecommendedKitProfile() {
    if (state.kitProfileExplicitlyChosen) return;
    const band = currentBand();
    const songMeta = currentBandSongMeta();
    const recommended = songMeta?.kit_profile || band?.kit_profile_default;
    if (!recommended || recommended === state.kitProfile) return;
    const psel = $("br-kit-profile-select");
    if (!psel) return;
    psel.value = recommended;
    state.kitProfile = recommended;
    // v215: guard so the change-event handler doesn't mark this as an
    // explicit user pick. The handler resets state.kitProfileExplicitlyChosen
    // only when the dispatch was NOT triggered by us.
    state.__kitProfileAutoApplying = true;
    try {
      psel.dispatchEvent(new Event("change"));
    } finally {
      state.__kitProfileAutoApplying = false;
    }
  }

  function currentBandSongMeta(songId = state.currentSongId) {
    const band = currentBand();
    if (!Array.isArray(band?.songs)) return null;
    return band.songs.find((song) => song.id === songId) || null;
  }

  function dbToGain(db) {
    const value = Number(db);
    if (!Number.isFinite(value) || value === 0) return 1;
    return Math.pow(10, clamp(value, -12, 6) / 20);
  }

  function stemMasteringGainForSong(songId, stem) {
    const mastering = currentBandSongMeta(songId)?.stem_mastering;
    if (!mastering || typeof mastering !== "object") return 1;
    return dbToGain(mastering[`${stem}_db`]);
  }

  function localPreviewVariantsAllowed() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const value = params.get("localPreview") || params.get("previewStems");
      if (value === "1" || value === "true") return true;
      if (value === "0" || value === "false") return false;
    } catch (e) {}
    try {
      const host = window.location.hostname || "";
      return host === "localhost" || host === "127.0.0.1" || host === "";
    } catch (e) {
      return false;
    }
  }

  function stemVariantEntriesForSong(songId = state.currentSongId) {
    const band = currentBand();
    const entries = [{ key: "original", label: "original", original: true }];
    const variants = band?.stems_variants;
    if (!variants || typeof variants !== "object" || Array.isArray(variants)) return entries;
    Object.entries(variants).forEach(([key, raw]) => {
      if (!key || !raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const songs = Array.isArray(raw.songs) ? raw.songs : [];
      if (songs.length > 0 && !songs.includes(songId)) return;
      if (raw.production_visible === false && !localPreviewVariantsAllowed()) return;
      entries.push({ key, ...raw, label: raw.label || key });
    });
    return entries;
  }

  function selectedStemVariant(songId = state.currentSongId) {
    const entries = stemVariantEntriesForSong(songId);
    return entries.find((entry) => entry.key === state.stemVariant) || entries[0];
  }

  function stemVariantLabel(variant) {
    return variant?.label || variant?.key || "original";
  }

  function syncStemVariantSelect(songId = state.currentSongId) {
    const sel = $("br-stems-variant-select");
    if (!sel) return selectedStemVariant(songId);
    const entries = stemVariantEntriesForSong(songId);
    const selected = entries.find((entry) => entry.key === state.stemVariant) || entries[0];
    sel.innerHTML = "";
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.key;
      option.textContent = stemVariantLabel(entry);
      sel.appendChild(option);
    });
    state.stemVariant = selected.key;
    sel.value = selected.key;
    sel.disabled = entries.length <= 1;
    return selected;
  }

  function originalStemUrl(stem, songId) {
    const band = currentBand();
    const stemsDir = band?.stems_dir || "presets/tabasco-stems";
    return `${stemsDir}/${songId}/${stem}.mp3`;
  }

  function variantStemUrl(stem, songId, variant) {
    if (!variant || variant.original) return originalStemUrl(stem, songId);
    const stemMap = variant.stems && typeof variant.stems === "object" ? variant.stems : {};
    const rawName = stemMap[stem];
    if (!rawName) return null;
    const raw = String(rawName)
      .replace(/\{songid\}/g, songId)
      .replace(/\{stem\}/g, stem)
      .replace(/^\/+/, "");
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
    const base = String(variant.stems_dir || "").replace(/\/+$/, "");
    return base ? `${base}/${songId}/${raw}` : raw;
  }

  function stemLoadCandidates(stem, songId, variant) {
    const original = originalStemUrl(stem, songId);
    if (!variant || variant.original) return [{ url: original, source: "original", fallback: false }];
    const primary = variantStemUrl(stem, songId, variant);
    const candidates = [];
    if (primary) candidates.push({ url: primary, source: variant.key, fallback: false });
    if (variant.fallback_to_original !== false) {
      candidates.push({ url: original, source: "original", fallback: true });
    }
    return candidates;
  }

  async function stemUrlAvailable(url) {
    if (!url) return false;
    try {
      const head = await fetch(url, { method: "HEAD" });
      return head.ok;
    } catch (e) {
      return false;
    }
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
    if (options.updateLyrics !== false) updateKaraokeHighlight(targetSec);
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
    clearTimeout(transportProgressTimer);
    let lastUiAtMs = 0;
    const tick = () => {
      const nowMs = bandRoomNowMs();
      const interval = uiTelemetryIntervalMs("timeline");
      if (nowMs - lastUiAtMs >= interval) {
        lastUiAtMs = nowMs;
        updateSongTimelineDisplay();
      }
      // v306: karaoke line follow (stems mode). Guarded + idx-cached, so it's
      // cheap to run every frame and stays tight to the audio clock.
      if (currentMode === "stems") updateKaraokeHighlight(playbackContentElapsedSec());
      const duration = playbackDurationSec();
      if (state.started && duration && playbackContentElapsedSec() >= duration - 0.15) {
        queueAutoAdvanceToNextSong();
      }
      if (!state.started) return;
      if (currentMode === "stems") {
        transportProgressRaf = requestAnimationFrame(tick);
      } else {
        transportProgressTimer = setTimeout(tick, interval);
      }
    };
    updateSongTimelineDisplay();
    tick();
  }

  function stopTransportProgress() {
    cancelAnimationFrame(transportProgressRaf);
    clearTimeout(transportProgressTimer);
    transportProgressRaf = 0;
    transportProgressTimer = 0;
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
    const variant = syncStemVariantSelect(songId);
    const variantLabel = stemVariantLabel(variant);
    setStemsStatus(variant.original ? "loading stems…" : `loading ${variantLabel} stems…`);
    const promises = STEM_NAMES.map(async (stem) => {
      const candidates = stemLoadCandidates(stem, songId, variant);
      for (const candidate of candidates) {
        try {
          if (!(await stemUrlAvailable(candidate.url))) continue;
          // Route via per-stem EQ chain (v66). EQ output already wired to:
          //   - bus → master (drums/bass/other)
          //   - vocalChorus (vocals)
          const target = stemEQs[stem] ? stemEQs[stem].input : stemBus[stem];
          // v320: per-song album mastering. Some Tabasco stems land below
          // Electric Sheep; trim each stem before the shared remaster so
          // track-to-track band pressure stays consistent.
          const trimGain = new Tone.Gain(stemMasteringGainForSong(songId, stem)).connect(target);
          // v152: album-flow playback advances to the next track at song end.
          // Keep stems non-looping so the audio does not wrap underneath.
          const player = new Tone.Player({
            url: candidate.url, autostart: false, fadeIn: 0.15, fadeOut: 0.30, loop: false
          }).connect(trimGain);
          await Tone.loaded();
          return { stem, player, trimGain, source: candidate.source, fallback: candidate.fallback };
        } catch (e) {
          console.warn("[Band Room] stem candidate failed:", stem, candidate.url, e);
        }
      }
      return null;
    });
    const results = await Promise.all(promises);
    let loaded = 0;
    let variantLoaded = 0;
    let fallbackLoaded = 0;
    results.forEach((r) => {
      if (!r) return;
      stemPlayers[r.stem] = r.player;
      stemPlayerGains[r.stem] = r.trimGain;
      loaded++;
      if (!variant.original && r.source === variant.key) variantLoaded++;
      if (!variant.original && r.fallback) fallbackLoaded++;
    });
    state.loadedStemDurationSec = loadedStemDurationSec();
    updateSongTimelineDisplay();
    if (loaded === 0) {
      setStemsStatus("(stems not available — switch to AI 再現 mode)");
      return false;
    }
    loadedStemsSongId = songId;
    loadedStemsVariant = variant.key;
    if (variant.original) {
      setStemsStatus(`stems loaded (${loaded}/4)`);
    } else if (variantLoaded > 0) {
      const fallbackNote = fallbackLoaded > 0 ? `, ${fallbackLoaded} fallback` : "";
      setStemsStatus(`stems loaded (${loaded}/4 · ${variantLabel}${fallbackNote})`);
    } else {
      setStemsStatus(`stems loaded (${loaded}/4 · ${variantLabel} missing, original fallback)`);
    }
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

  function synthPartEnabled(toggleId) {
    return $(toggleId)?.checked === true;
  }

  function shouldRebuildSynthControlNow() {
    return currentMode === "synth" && state.started && !state.starting;
  }

  function markSynthControlDeferred(status, label, value) {
    if (status) status.textContent = `${label}: ${value || "synth"} (applies on AI start)`;
  }

  async function ensureOnlineCatalogForSynth() {
    if (state.onlineCatalog) return true;
    try { await loadOnlineCatalog(); } catch (e) {}
    if (state.onlineCatalog) return true;
    const kitStatus = $("br-kit-status");
    const msg = "online catalog unavailable — CDN instruments will fall back to synth";
    if (kitStatus) kitStatus.textContent = "warning: " + msg;
    console.warn("[Band Room] synth prep:", msg);
    return false;
  }

  function shouldStageSynthPlaybackFirst(reason) {
    return reason === "start" || reason === "mode-switch";
  }

  function voiceOverridesSnapshotKey() {
    try { return JSON.stringify(state.voiceOverrides || {}); } catch (e) { return ""; }
  }

  function synthSamplerUpgradeSnapshot(reason) {
    return {
      seq: ++synthSamplerUpgradeSeq,
      reason,
      stopSeq: playbackLifecycleStopSeq,
      modeSeq: modeSwitchSeq,
      songId: state.currentSongId,
      kitSource: state.kitSource,
      kitProfile: state.kitProfile,
      voiceOverrides: voiceOverridesSnapshotKey(),
      bassInstrument: state.bassInstrument,
      guitarInstrument: state.guitarInstrument,
      voiceInstrument: state.voiceInstrument,
      chordInstrument: state.chordInstrument
    };
  }

  function synthSamplerUpgradeStillCurrent(snapshot) {
    return snapshot &&
      snapshot.seq === synthSamplerUpgradeSeq &&
      snapshot.stopSeq === playbackLifecycleStopSeq &&
      snapshot.modeSeq === modeSwitchSeq &&
      snapshot.songId === state.currentSongId &&
      snapshot.kitSource === state.kitSource &&
      snapshot.kitProfile === state.kitProfile &&
      snapshot.voiceOverrides === voiceOverridesSnapshotKey() &&
      snapshot.bassInstrument === state.bassInstrument &&
      snapshot.guitarInstrument === state.guitarInstrument &&
      snapshot.voiceInstrument === state.voiceInstrument &&
      snapshot.chordInstrument === state.chordInstrument;
  }

  function disposeSynthLayer(layer) {
    try { if (layer && typeof layer.dispose === "function") layer.dispose(); } catch (e) {}
  }

  function replaceSynthLayer(name, nextLayer, snapshot) {
    if (!synthSamplerUpgradeStillCurrent(snapshot) || !isSamplerLayer(nextLayer)) {
      disposeSynthLayer(nextLayer);
      return false;
    }
    if (name === "drums") {
      const old = drumKit;
      drumKit = nextLayer;
      disposeSynthLayer(old);
      return true;
    }
    if (name === "bass") {
      const old = synthBass;
      synthBass = nextLayer;
      disposeSynthLayer(old);
      return true;
    }
    if (name === "guitar") {
      const old = guitarSynth;
      guitarSynth = nextLayer;
      disposeSynthLayer(old);
      return true;
    }
    if (name === "voice") {
      const old = voiceSynth;
      voiceSynth = nextLayer;
      disposeSynthLayer(old);
      return true;
    }
    if (name === "chord") {
      const old = chordSynth;
      chordSynth = nextLayer;
      disposeSynthLayer(old);
      return true;
    }
    disposeSynthLayer(nextLayer);
    return false;
  }

  // v354: AI→原音 must DISPOSE the synth band, not just release its notes.
  // Otherwise its always-on chord/voice Tone.Reverbs + AutoPanner/Chorus/lpLfo
  // LFOs + 2x-oversampled synthBass Distortion stay wired to masterGain and keep
  // processing every audio quantum during 原音 (the v352 stack, only partially
  // fixed). Deferred ~1.8s so release tails fade first (no click); guarded so a
  // fast switch back to AI keeps the live band. Switch-back rebuilds lazily via
  // prepareSynthPlaybackAssets (needsQuickSynthLayer(null) === true).
  let synthBandTeardownTimer = null;
  function scheduleSynthBandTeardown() {
    if (synthBandTeardownTimer) clearTimeout(synthBandTeardownTimer);
    const captured = { drumKit, synthBass, guitarSynth, voiceSynth, chordSynth, clickSynth };
    synthBandTeardownTimer = setTimeout(() => {
      synthBandTeardownTimer = null;
      if (currentMode !== "stems") return; // switched back to AI — leave its band wired
      Object.values(captured).forEach((layer) => { if (layer) disposeSynthLayer(layer); });
      // Null only vars that still point at the disposed instances, so a
      // concurrent rebuild is never clobbered (mirrors the prepareSynth pattern).
      if (drumKit === captured.drumKit) drumKit = null;
      if (synthBass === captured.synthBass) synthBass = null;
      if (guitarSynth === captured.guitarSynth) guitarSynth = null;
      if (voiceSynth === captured.voiceSynth) voiceSynth = null;
      if (chordSynth === captured.chordSynth) chordSynth = null;
      if (clickSynth === captured.clickSynth) clickSynth = null;
    }, 1800);
  }

  function queueSynthSamplerUpgrade(reason = "start") {
    if (!shouldAutoUpgradeSynthSamples(reason)) {
      const kitStatus = $("br-kit-status");
      if (kitStatus) kitStatus.textContent = "AI ready (light synth)";
      return;
    }
    const snapshot = synthSamplerUpgradeSnapshot(reason);
    const kitStatus = $("br-kit-status");
    const run = async () => {
      await yieldToUi();
      if (!synthSamplerUpgradeStillCurrent(snapshot)) return;
      await ensureOnlineCatalogForSynth();
      if (!synthSamplerUpgradeStillCurrent(snapshot)) return;
      let upgraded = 0;
      try {
        if (synthPartEnabled("br-toggle-drums") && state.kitSource !== "synth") {
          const nextKit = await buildKitForSource(state.kitSource, { disposeExisting: false });
          if (replaceSynthLayer("drums", nextKit, snapshot)) upgraded++;
        }
        if (SYNTH_REBUILD_PARTS.bass && synthPartEnabled("br-toggle-bass") && state.bassInstrument) {
          const nextBass = await makeSynthBass(bassBus);
          if (replaceSynthLayer("bass", nextBass, snapshot)) upgraded++;
        }
        if (SYNTH_REBUILD_PARTS.guitar && synthPartEnabled("br-toggle-guitar") && state.guitarInstrument) {
          const nextGuitar = await makeGuitar(guitarBus);
          if (replaceSynthLayer("guitar", nextGuitar, snapshot)) upgraded++;
        }
        if (SYNTH_REBUILD_PARTS.voice && synthPartEnabled("br-toggle-voice") && state.voiceInstrument) {
          const nextVoice = await makeVoiceBox(voiceBus);
          if (replaceSynthLayer("voice", nextVoice, snapshot)) upgraded++;
        }
        if (SYNTH_REBUILD_PARTS.chord && synthPartEnabled("br-toggle-chords") && state.chordInstrument) {
          const nextChord = await makeChordSynth(chordBus);
          if (replaceSynthLayer("chord", nextChord, snapshot)) upgraded++;
        }
        if (kitStatus && synthSamplerUpgradeStillCurrent(snapshot)) {
          kitStatus.textContent = upgraded > 0 ? `AI samples upgraded (${upgraded})` : "AI ready (synth)";
        }
      } catch (e) {
        if (kitStatus && synthSamplerUpgradeStillCurrent(snapshot)) kitStatus.textContent = "AI ready (sample upgrade skipped)";
        console.warn("[Band Room] AI sample upgrade skipped:", e);
      }
    };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else setTimeout(run, 0);
  }

  function needsQuickSynthLayer(layer, quickFirst) {
    if (!layer) return true;
    return quickFirst && aiLightRuntimeEnabled() && isSamplerLayer(layer);
  }

  async function prepareSynthPlaybackAssets(reason = "start") {
    ensureMaster();
    const kitStatus = $("br-kit-status");
    if (kitStatus && reason !== "toggle") {
      kitStatus.textContent = shouldStageSynthPlaybackFirst(reason) ? "preparing quick AI..." : "preparing AI...";
    }
    try {
      const quickFirst = shouldStageSynthPlaybackFirst(reason);
      if (!quickFirst) await ensureOnlineCatalogForSynth();
      if (synthPartEnabled("br-toggle-drums") && needsQuickSynthLayer(drumKit, quickFirst)) {
        drumKit = await buildKitForSource(quickFirst ? "synth" : state.kitSource);
        await yieldToUi();
      }
      if (SYNTH_REBUILD_PARTS.bass && synthPartEnabled("br-toggle-bass") && needsQuickSynthLayer(synthBass, quickFirst)) {
        const old = synthBass;
        synthBass = await makeSynthBass(bassBus, { forceSynth: quickFirst, light: quickFirst && aiLightRuntimeEnabled() });
        if (old && old !== synthBass) disposeSynthLayer(old);
        await yieldToUi();
      }
      if (SYNTH_REBUILD_PARTS.guitar && synthPartEnabled("br-toggle-guitar") && needsQuickSynthLayer(guitarSynth, quickFirst)) {
        const old = guitarSynth;
        guitarSynth = await makeGuitar(guitarBus, { forceSynth: quickFirst, light: quickFirst && aiLightRuntimeEnabled() });
        if (old && old !== guitarSynth) disposeSynthLayer(old);
        await yieldToUi();
      }
      if (SYNTH_REBUILD_PARTS.voice && synthPartEnabled("br-toggle-voice") && needsQuickSynthLayer(voiceSynth, quickFirst)) {
        const old = voiceSynth;
        voiceSynth = await makeVoiceBox(voiceBus, { forceSynth: quickFirst, light: quickFirst && aiLightRuntimeEnabled() });
        if (old && old !== voiceSynth) disposeSynthLayer(old);
        await yieldToUi();
      }
      if (SYNTH_REBUILD_PARTS.chord && synthPartEnabled("br-toggle-chords") && needsQuickSynthLayer(chordSynth, quickFirst)) {
        const old = chordSynth;
        chordSynth = await makeChordSynth(chordBus, { forceSynth: quickFirst, light: quickFirst && aiLightRuntimeEnabled() });
        if (old && old !== chordSynth) disposeSynthLayer(old);
        await yieldToUi();
      }
      if (synthPartEnabled("br-toggle-click") && !clickSynth) clickSynth = makeClick(clickBus);
      if (kitStatus && reason !== "toggle") {
        kitStatus.textContent = quickFirst && !shouldAutoUpgradeSynthSamples(reason) ? "AI ready (light synth)" :
          (quickFirst ? "AI ready (quick synth)" : "AI ready");
      }
      if (quickFirst) queueSynthSamplerUpgrade(reason);
      return true;
    } catch (e) {
      if (kitStatus) kitStatus.textContent = "AI prep failed: " + (e.message || e);
      console.warn("[Band Room] AI prep failed:", e);
      return false;
    }
  }

  async function prepareStemPlaybackAssets(songId = state.currentSongId) {
    ensureMaster();
    const variant = selectedStemVariant(songId);
    if (loadedStemsSongId === songId && loadedStemsVariant === variant.key && Object.values(stemPlayers).some(Boolean)) {
      updateSongTimelineDisplay();
      return true;
    }
    return loadStemsForSong(songId);
  }

  async function preparePlaybackAssetsForCurrentMode(reason = "start") {
    if (currentMode === "synth") return prepareSynthPlaybackAssets(reason);
    return prepareStemPlaybackAssets(state.currentSongId);
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

  async function buildKitForSource(source, opts = {}) {
    if (!drumBus) ensureMaster();
    if (opts.disposeExisting !== false && drumKit && drumKit.dispose) {
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
      if (aiLightRuntimeEnabled()) return makeLightDrumKit(drumBus, state.kitProfile || "default");
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
    markLayerKind(merged, "sampler");
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
    markLayerKind(voices, "sampler");
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
    markLayerKind(voices, "sampler");
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
  async function makeGuitar(target, opts = {}) {  // v270: async
    const light = opts.light === true || aiLightRuntimeEnabled();
    // v111: if guitarInstrument is set to a catalog sampler, use real samples.
    // Less distortion + softer chain than synth fallback (real samples already
    // have body and harmonic content).
    if (!opts.forceSynth && state.guitarInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.guitarInstrument);
      if (instDef && instDef.kind === "sampler") {
        const verb = light
          ? new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.08, wet: 0.08 }).connect(target)
          : new Tone.Reverb({ decay: 1.2, wet: 0.09 }).connect(target);
        const lp = new Tone.Filter({ frequency: 8600, type: "lowpass", Q: 0.5 }).connect(verb);
        // Light distortion only on electric variant
        const isElectric = instDef.id.includes("electric");
        let chainIn = lp;
        let dist = null;  // v229: hoisted so dispose can reach it
        if (isElectric) {
          // v335: more amp drive on the full path — the transcribed chug is in
          // (v334); now it needs the crunch to read as a driven rock guitar
          // instead of a clean demo sample. Light path keeps the gentler drive
          // (phone speakers + CPU).
          dist = new Tone.Distortion({
            distortion: light ? 0.12 : 0.26,
            wet: light ? 0.22 : 0.42,
            oversample: light ? "none" : "2x"
          }).connect(lp);
          chainIn = dist;
        }
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, p]) => {
          urls[note] = instDef.base_url + p;
        });
        // v126: velocity-sensitive — guitar は強く弾けばブライトに、弱く弾けば
        // 柔らかく。electric guitar の muting / strumming nuance に対応
        const sampler = await makeVelocitySensitiveSampler({
          urls, baseRelease: 0.5, volume: -2.0,  // v330: a little more pick pressure; still below the synth fallback's raw edge.
          minCutoff: 1800, maxCutoff: 9800
        });
        if (sampler) {
          sampler.connect(chainIn);
          return withChainDispose(sampler, [verb, lp, dist]);  // v229: tear down FX chain
        }
        [verb, lp, dist].forEach((node) => { try { node && node.dispose && node.dispose(); } catch (e) {} });
      }
    }

    // v70 synth fallback -> v345 driven parallel-cab. Profile-driven amp/cab
    // voicing; the || fallback covers older saved kitProfile state.
    const g = currentProfile().guitar || { oscType: "sawtooth", driveAmt: 0.55, dryWet: 0.42, driveWet: 0.62, cabFreq: 2200, cabQ: 1.5, lpFreq: 4800, verbWet: 0.12 };
    // v232: high-pass at 130 Hz so the distorted low-mid stays out of the bass
    // lane (octave 2); the guitar's lane is octave-3 power chords.
    const hpG = new Tone.Filter({ frequency: 130, type: "highpass", Q: 0.6 });
    if (light) {
      // v345: phone guitar = one driven distortion + a peaking cab bump + a
      // profile lowpass -> a small driven amp, not a fizzy buzz. One extra
      // filter only (light path stays cheap). Wrapper shape + volume unchanged.
      const dist = new Tone.Distortion({ distortion: 0.42, wet: 0.68, oversample: "none" });
      const cabL = new Tone.Filter({ frequency: g.cabFreq, type: "peaking", Q: 1.2, gain: 3.5 });
      const lp = new Tone.Filter({ frequency: g.lpFreq, type: "lowpass", Q: 0.6 });
      const guitar = new Tone.Synth({
        oscillator: { type: g.oscType },
        envelope: { attack: 0.003, decay: 0.12, sustain: 0.38, release: 0.12 },  // v345: pick-attack droop
        volume: -9.8
      });
      guitar.connect(hpG);
      hpG.connect(dist);
      dist.connect(cabL);
      cabL.connect(lp);
      lp.connect(target);
      const lightGuitar = {
        triggerAttackRelease(notes, dur, time, vel) {
          const note = Array.isArray(notes) ? notes[0] : notes;
          if (!note) return;
          try { guitar.triggerAttackRelease(note, dur, time, vel); } catch (e) {}
        },
        triggerRelease(_note, time = Tone.now()) {
          try { guitar.triggerRelease(time); } catch (e) {}
        },
        releaseAll(time = Tone.now()) {
          try { guitar.triggerRelease(time); } catch (e) {}
        },
        dispose() {
          try { guitar.dispose(); } catch (e) {}
        }
      };
      return withChainDispose(markLayerKind(lightGuitar, "synth"), [dist, cabL, lp, hpG]);
    }
    // v345 FULL path: parallel dry + driven cab. Clean and distorted copies sum
    // (balance in the gains, distortion fully wet), a low-order Chebyshev adds
    // amp warmth, a peaking cab + steep -24 dB/oct lowpass shape the speaker,
    // then straight out. v351: removed the always-on convolution reverb here —
    // it overloaded the audio thread (with the drum room reverb) and bled
    // dropouts into 原音. No extra oscillators/voices — v245/v343 freeze-safe.
    const chorus = new Tone.Chorus({ frequency: 0.9, delayTime: 3.2, depth: 0.38, wet: 0.34 }).start();
    const dryG = new Tone.Gain(g.dryWet);
    const dist = new Tone.Distortion({ distortion: g.driveAmt, wet: 1.0, oversample: "none" });   // v351: 2x->none, standing CPU cost
    const driveG = new Tone.Gain(g.driveWet);
    const cheb = new Tone.Chebyshev({ order: 3, wet: 0.18 });
    const cab = new Tone.Filter({ frequency: g.cabFreq, type: "peaking", Q: g.cabQ, gain: 4.5 });
    const lp = new Tone.Filter({ frequency: g.lpFreq, type: "lowpass", Q: 0.7, rolloff: -24 });
    const guitar = new Tone.PolySynth(Tone.Synth, {
      // v345: oscType profile-driven (cramps square bite vs rock saw). Single
      // non-fat oscillator — PolySynth voice cost unchanged (v245 fat attempt
      // choked alongside chord fat; not repeated here).
      oscillator: { type: g.oscType },
      envelope: { attack: 0.004, decay: 0.16, sustain: 0.40, release: 0.18 },  // v345: pick-attack droop
      volume: -10.2
    });
    // v228: maxPolyphony cap stays low — PolySynth voices are continuous
    // oscillators; uncapping froze devices. v343 note density keeps the low cap
    // from dropping audible notes.
    guitar.maxPolyphony = 10;
    guitar.connect(hpG);
    hpG.connect(chorus);
    chorus.connect(dryG);
    chorus.connect(dist);
    dist.connect(driveG);
    dryG.connect(cheb);
    driveG.connect(cheb);
    cheb.connect(cab);
    cab.connect(lp);
    lp.connect(target);
    // v229/v345: chorus is a started LFO — tear the whole chain down.
    return withChainDispose(markLayerKind(guitar, "synth"), [chorus, dryG, dist, driveG, cheb, cab, lp, hpG].filter(Boolean));
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
  async function makeVoiceBox(target, opts = {}) {  // v270: async
    const light = opts.light === true || aiLightRuntimeEnabled();
    // v111: if voiceInstrument is set to a catalog sampler, use it
    // (typically violin / cello / flute for "lead melody as instrument").
    // This bypasses the formant-vowel synth path entirely and gives the
    // melody guide a real instrumental voice — Nujabes/J Dilla flute lead,
    // RHRN cello, etc.
    if (!opts.forceSynth && state.voiceInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.voiceInstrument);
      if (instDef && instDef.kind === "sampler") {
        const verb = light
          ? new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.08, wet: 0.10 }).connect(target)
          : new Tone.Reverb({ decay: 2.7, wet: 0.36 }).connect(target);
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, p]) => {
          urls[note] = instDef.base_url + p;
        });
        // v126: velocity-sensitive — melody lead (violin / cello / flute) は
        // 強く吹けばブライト、弱く吹けば柔らかい音色変化
        const sampler = await makeVelocitySensitiveSampler({
          urls, baseRelease: light ? 0.45 : 0.8, volume: -6,
          minCutoff: 1800, maxCutoff: 9000
        });
        if (sampler) {
          sampler.connect(verb);
          return withChainDispose(sampler, [verb]);  // v229: tear down reverb
        }
        try { verb.dispose(); } catch (e) {}
      }
    }

    // v92 synth fallback: AMSynth + dual formant (vowel-ish "ah")
    const v = currentProfile().vocal;
    const verb = light
      ? new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.08, wet: Math.min(v.verbWet, 0.08) }).connect(target)
      : new Tone.Reverb({ decay: 2.5, wet: v.verbWet }).connect(target);
    const hp = new Tone.Filter({ frequency: v.hpFreq, type: "highpass", Q: 0.5 }).connect(verb);
    if (light) {
      // v344: phone voice was a near-sine triangle "beep". A sawtooth gives
      // real upper harmonics; ONE wide bandpass at the profile F1 gives a
      // single vowel peak — the cheap win the light path allows (osc + 1 filter).
      const formant = new Tone.Filter({ frequency: v.formant1, type: "bandpass", Q: 1.2 }).connect(hp);
      const voice = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.035, decay: 0.18, sustain: 0.58, release: 0.22 },
        volume: -13
      }).connect(formant);
      return withChainDispose(markLayerKind(voice, "synth"), [verb, hp, formant]);
    }
    const mix = new Tone.Gain(0.78).connect(hp);  // v344: 0.9->0.78 holds level as F3 + dry-body add summed energy
    // v344: three formants (was two) at gentler, profile-driven Qs so the bands
    // COLOR the carrier instead of gutting it, plus a low dry-body tap so the
    // vowel has chest behind it. F3 (~2.6k) adds the presence that reads as a
    // voice rather than a filtered drone. (Qs default if a profile omits them.)
    const formant1 = new Tone.Filter({ frequency: v.formant1, type: "bandpass", Q: v.formant1Q ?? 1.8 }).connect(mix);
    const formant2 = new Tone.Filter({ frequency: v.formant2, type: "bandpass", Q: v.formant2Q ?? 4 }).connect(mix);
    const formant3 = new Tone.Filter({ frequency: v.formant3 ?? 2600, type: "bandpass", Q: Math.min(v.formant3Q ?? 6, 7) }).connect(mix);
    const body = new Tone.Gain(v.bodyGain ?? 0.20).connect(mix);

    const voice = new Tone.AMSynth({
      harmonicity: v.harmonicity,
      // v344: wider fat carrier (count 3 / spread 22; was 2/12) = audible
      // chorusing body instead of a hollow ring. Light path is the Synth above.
      oscillator: { type: "fatsawtooth", count: 3, spread: 22 },
      envelope: { attack: 0.05, decay: 0.32, sustain: 0.65, release: 0.62 },  // v342: softer entry, longer tail
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.04, decay: 0.2, sustain: 0.6, release: 0.4 },  // v344: 0.5->0.6 keeps AM partials present through the sustain
      volume: -14  // v104: lowered so vocal guide doesn't dominate
    });
    voice.connect(formant1);
    voice.connect(formant2);
    voice.connect(formant3);
    voice.connect(body);

    const vibrato = light ? null : new Tone.LFO({ frequency: v.vibratoFreq, min: -v.vibratoCents, max: v.vibratoCents });
    // v344: vibrato onset — amplitude ramps 0->1 over 150ms so notes start
    // straight and bloom into vibrato like a singer (was full-depth from zero).
    try { if (vibrato) { vibrato.connect(voice.detune); vibrato.amplitude.value = 0; vibrato.start(); vibrato.amplitude.rampTo(1, 0.15); } } catch (e) {}

    // v229/v344: vibrato is a started LFO; formant3 + body added to teardown.
    return withChainDispose(markLayerKind(voice, "synth"), [verb, hp, mix, formant1, formant2, formant3, body, vibrato].filter(Boolean));
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

  async function makeChordSynth(target, opts = {}) {  // v270: async
    const light = opts.light === true || aiLightRuntimeEnabled();
    // v92: profile-aware chord synth.
    // v101: if state.chordInstrument is set to an "instruments[]" catalog
    //   entry id (e.g. "salamander-piano"), use Tone.Sampler with that
    //   sample set instead of Tone.PolySynth.
    const c = currentProfile().chord;
    const verb = light ? null : new Tone.Reverb({ decay: 1.6, wet: c.verbWet }).connect(target);
    const autoPan = light ? null : new Tone.AutoPanner({ frequency: c.autoPanFreq, depth: c.autoPanDepth }).connect(verb).start();
    const chorus = light ? null : new Tone.Chorus({ frequency: 0.6, delayTime: 4.5, depth: 0.45, wet: c.chorusWet }).start();
    if (chorus && autoPan) chorus.connect(autoPan);
    const chordOutput = chorus || verb || target;

    if (!opts.forceSynth && state.chordInstrument && state.onlineCatalog) {
      const instDef = state.onlineCatalog.instruments?.find((i) => i.id === state.chordInstrument);
      if (instDef && instDef.kind === "sampler") {
        const urls = {};
        Object.entries(instDef.notes).forEach(([note, path]) => {
          urls[note] = instDef.base_url + path;
        });
        // v126: velocity-sensitive — piano voicing で弱く弾いた chord は
        // 柔らかく、強く弾いた chord はブライトに (jazz comping の表情)
        const sampler = await makeVelocitySensitiveSampler({
          urls, baseRelease: 1.2, volume: -5,  // v269: +3 dB lift (was -8). Piano's natural decay reads especially quiet vs the held synth-pad it replaced (v262), so chord needs the largest bump of the three Samplers — but still kept under the bass/guitar level so the pad stays a background colour (v255/v257 intent).
          minCutoff: 2000, maxCutoff: 9000
        });
        if (sampler) {
          sampler.connect(chordOutput);
          // v229: autoPan + chorus are started LFOs — tear the whole chain down.
          return withChainDispose(sampler, [verb, autoPan, chorus].filter(Boolean));
        }
      }
    }

    // v232: high-pass the chord pad at 190 Hz so it sits in its mid lane
    // (octave 4) and stops muddying the bass + guitar low-mid beneath it.
    const hpC = new Tone.Filter({ frequency: 190, type: "highpass", Q: 0.6 });
    const chord = new Tone.PolySynth(Tone.Synth, {
      // v344: detuned-unison osc on the FULL path (light keeps single osc per
      // v316). v245's fat attempt (count2/spread14) choked alongside guitar fat;
      // this is gentler (count2/spread12) and the chord agent is 8ths now (v343),
      // so it sits inside the polyphony budget. "fat"+oscType => fat{triangle,
      // sawtooth,square}, all valid Tone v14 partial types.
      oscillator: light ? { type: c.oscType } : { type: "fat" + c.oscType, count: 2, spread: 12 },
      // v344: sustain is profile-driven — pads (lcd/lofi) bloom & hold, the
      // cramps square decays to a real stab instead of a held slab.
      envelope: { attack: c.attack, decay: c.decay, sustain: c.sustain ?? 0.45, release: c.release },
      volume: -12  // v104: was -16, raised so chord pad anchors the mix
    });
    chord.maxPolyphony = light ? 5 : 10;
    chord.connect(hpC);
    // v344: slow low-pass sweep gives the pad the spectral movement it lacked
    // (Tone.Synth has no per-voice filter env, so one shared filter + LFO on
    // the FULL path is the cheap "opening/closing" life).
    const lpC = light ? null : new Tone.Filter({ frequency: 2600, type: "lowpass", Q: 0.7 });
    const lpLfo = light ? null : new Tone.LFO({ frequency: 0.08, min: 1700, max: 3400 });
    if (lpC) {
      hpC.connect(lpC);
      lpC.connect(chordOutput);
      try { lpLfo.connect(lpC.frequency); lpLfo.start(); } catch (e) {}
    } else {
      hpC.connect(chordOutput);
    }
    // v229/v344: autoPan + chorus + lpLfo are started LFOs — tear all down.
    return withChainDispose(markLayerKind(chord, "synth"), [verb, autoPan, chorus, hpC, lpC, lpLfo].filter(Boolean));
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

  function clampNumber(value, fallback, lo, hi) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, lo, hi);
  }

  function safeLocalStorageGet(key) {
    if (BANDROOM_SAFE_BOOT && BANDROOM_AUDIO_STATE_KEYS.includes(key)) return null;
    try { return window.localStorage?.getItem(key) ?? null; } catch (e) { return null; }
  }

  function safeLocalStorageSet(key, value) {
    try { window.localStorage?.setItem(key, value); return true; } catch (e) { return false; }
  }

  function safeLocalStorageRemove(key) {
    try { window.localStorage?.removeItem(key); return true; } catch (e) { return false; }
  }

  function sanitizeRangeInputValue(id, value) {
    const el = $(id);
    if (!el || el.type !== "range") return null;
    const min = Number.isFinite(Number(el.min)) ? Number(el.min) : 0;
    const max = Number.isFinite(Number(el.max)) ? Number(el.max) : 100;
    const fallback = clampNumber(el.defaultValue || el.value || min, min, min, max);
    return String(clampNumber(value, fallback, min, max));
  }

  function sanitizeBooleanPref(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    return fallback;
  }

  function isSafeToken(value, maxLength = 96) {
    return typeof value === "string" &&
           value.length > 0 &&
           value.length <= maxLength &&
           /^[a-z0-9._/-]+$/i.test(value);
  }

  function sanitizeKitSource(value, fallback = "online/tone-acoustic") {
    if (value == null || value === "") return fallback;
    if (value === "synth" || value === "auto-self") return value;
    if (!isSafeToken(value)) return fallback;
    if (/^online\/[a-z0-9._-]+$/i.test(value)) return value;
    if (/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(value)) return value;
    return fallback;
  }

  function sanitizeInstrumentId(value) {
    if (value == null || value === "") return null;
    return isSafeToken(value, 80) && !value.includes("/") ? value : null;
  }

  function sanitizePrefsForBoot(prefs) {
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return null;
    const next = {
      ...prefs,
      storageSchemaVersion: BANDROOM_STORAGE_SCHEMA_VERSION,
      sliders: {},
      toggles: {}
    };
    Object.entries(prefs.sliders || {}).forEach(([id, value]) => {
      const safeValue = sanitizeRangeInputValue(id, value);
      if (safeValue !== null) next.sliders[id] = safeValue;
    });
    Object.entries(prefs.toggles || {}).forEach(([id, value]) => {
      const el = $(id);
      if (el && el.type === "checkbox") next.toggles[id] = sanitizeBooleanPref(value, el.defaultChecked);
    });
    next.kitSource = sanitizeKitSource(prefs.kitSource, state.kitSource);
    if (prefs.kitProfile && Object.prototype.hasOwnProperty.call(KIT_PROFILES, prefs.kitProfile)) {
      next.kitProfile = prefs.kitProfile;
    } else {
      next.kitProfile = state.kitProfile;
    }
    const voiceOverrides = {};
    Object.keys(state.voiceOverrides).forEach((voice) => {
      const value = prefs.voiceOverrides?.[voice];
      voiceOverrides[voice] = value ? sanitizeKitSource(value, null) : null;
    });
    next.voiceOverrides = voiceOverrides;
    next.chordInstrument = sanitizeInstrumentId(prefs.chordInstrument);
    next.bassInstrument = sanitizeInstrumentId(prefs.bassInstrument);
    next.guitarInstrument = sanitizeInstrumentId(prefs.guitarInstrument);
    next.voiceInstrument = sanitizeInstrumentId(prefs.voiceInstrument);
    if (typeof prefs.bandId !== "string" || prefs.bandId.length > 80) delete next.bandId;
    return next;
  }
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

  // v210: round-trip helper — parse a "C4" / "F#3" / "Bb5" note name back
  // to absolute semi so we can transpose voicings. Mirrors semiToNote's
  // octave convention (Math.floor(semi/12)).
  function noteNameToSemi(noteName) {
    const m = String(noteName).match(/^([A-G][#b]?)(-?\d+)$/);
    if (!m) return 48;  // fallback to "C4" baseline
    const NOTE_SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    return (NOTE_SEMI[m[1]] ?? 0) + Number(m[2]) * 12;
  }

  // v210: chord inversion — take the lowest `inv` notes and bump them up
  // an octave each so the top note weaves with phrase position. For a
  // C-major triad ["C4","E4","G4"]:
  //   inv 0 (root)        → C4 E4 G4   (top G)
  //   inv 1 (1st)         → E4 G4 C5   (top C)
  //   inv 2 (2nd)         → G4 C5 E5   (top E)
  //   inv 3 (root + oct)  → C5 E5 G5   (whole voicing up an octave; bright)
  // dedupeAgentSteps + the chordSynth's PolySynth handle the extra range.
  function chordInversion(notes, inv) {
    if (!Array.isArray(notes) || notes.length === 0) return notes || [];
    const n = ((inv % 4) + 4) % 4;
    if (n === 0) return notes;
    const semis = notes.map(noteNameToSemi).sort((a, b) => a - b);
    const lift = Math.min(n, semis.length);
    for (let i = 0; i < lift; i++) semis[i] += 12;
    semis.sort((a, b) => a - b);
    return semis.map(semiToNote);
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
      BANDROOM_APP_VERSION,
      BANDROOM_STORAGE_SCHEMA_VERSION,
      chordRoot,
      normalizedDrumFloorSection,
      migratePrefsForCurrentMix,
      sanitizeRangeInputValue,
      sanitizePrefsForBoot,
      resetBandRoomAudioState,
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
      syncStemVariantSelect(songId);
      state.barCount = 0;
      state.sectionIdx = 0;
      state.sectionBarStart = 0;
      state.pendingSeekOffsetSec = 0;
      state.playbackStartOffsetSec = 0;
      // v218: reset jazzy voice-leading history at song boundary so the new
      // song starts from its first chord's natural root-position voicing
      // instead of inheriting the previous song's top-note context.
      lastChordTopNote = null;
      updateSongTimelineDisplay(0);
      $("br-bpm").textContent = data.bpm || "—";
      $("br-key").textContent = data.key || "—";
      // v213: auto-pick kit profile from band/song recommendation (UNRIPE →
      // cramps-punk, Human Fly → cramps-punk, etc.). No-op if user has
      // explicitly chosen a non-default profile.
      applyRecommendedKitProfile();
      renderSectionNav();  // v75: clickable section list
      refreshDrumFloorLink();
      updateMediaSession(state.started ? "playing" : "paused");  // v85: refresh OS metadata
      // Load lyrics from the band's lyrics_doc if present. v306: also pull this
      // song's word-timestamp karaoke lines (stems mode follows them line by
      // line); renderLyricsView() picks karaoke vs section-block rendering.
      const lyricsDoc = band.lyrics_doc;
      state.currentTimedLines = null;
      state.currentLyricMarkdown = null;
      try { await ensureTimedLyricsLoaded(); } catch (e) {}
      if (switchSeq != null && switchSeq !== songSwitchSeq) return null;
      state.currentTimedLines = timedLinesForSong(songId);
      if (lyricsDoc) {
        try {
          const lyricsRes = await fetch(lyricsDoc + "?cb=" + Date.now());
          if (lyricsRes.ok) {
            const md = await lyricsRes.text();
            if (switchSeq != null && switchSeq !== songSwitchSeq) return null;
            state.currentLyricMarkdown =
              extractLyricsForSong(md, data.song_title || songId) || `(lyrics todo — see ${lyricsDoc})`;
          } else {
            state.currentLyricMarkdown = "(lyrics file not available offline)";
          }
        } catch (e) {
          state.currentLyricMarkdown = "(lyrics file not available offline)";
        }
      } else {
        state.currentLyricMarkdown = "(no lyrics doc for this band yet)";
      }
      renderLyricsView();
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

  function setTrackSelectorBusy(isBusy, text = "") {
    const group = $("br-track-select");
    if (!group) return;
    group.setAttribute("aria-busy", isBusy ? "true" : "false");
    group.querySelectorAll("button[data-song]").forEach((btn) => {
      btn.disabled = !!isBusy;
    });
    let status = group.querySelector(".br-track-status");
    if (isBusy || text) {
      if (!status) {
        status = document.createElement("span");
        status.className = "br-track-status";
        group.appendChild(status);
      }
      status.textContent = text || "loading...";
    } else if (status) {
      status.remove();
    }
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
    setTrackSelectorBusy(true, "loading track...");
    try {
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
    } finally {
      if (switchSeq === songSwitchSeq) setTrackSelectorBusy(false);
    }
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
    const lines = text.split(/\r?\n/);  // v203: tolerate CRLF line endings
    let curBlock = null;
    let curBody = [];
    function flush() {
      if (!curBlock) return;
      // v203: tidy the body — drop leading/trailing blank lines and collapse
      // runs of blank lines so blocks render compact.
      const cleaned = [];
      for (const line of curBody) {
        const isBlank = line.trim() === "";
        if (isBlank && (cleaned.length === 0 || cleaned[cleaned.length - 1] === "")) continue;
        cleaned.push(isBlank ? "" : line);
      }
      while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();
      // v203: skip an empty preamble (left over once the song-title heading
      // is stripped); keep empty section blocks so their marker still anchors.
      if (cleaned.length === 0 && curBlock.classList.contains("br-lyric-preamble")) {
        curBlock = null;
        curBody = [];
        return;
      }
      const pre = document.createElement("pre");
      pre.className = "br-lyric-text";
      pre.textContent = cleaned.join("\n");
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
      // v203: skip markdown noise — H1/H2 headings (song title etc.) and
      // --- rules are doc structure, not lyrics. ### H3 stays a marker.
      if (/^#{1,2}\s/.test(ln) || /^\s*-{3,}\s*$/.test(ln)) continue;
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

  // ---- Timed (karaoke) lyrics ---------------------------------
  // v306: in 原音 (stems) mode the real vocals play at known times, so we can
  // follow the actual sung LINE karaoke-style instead of just the section.
  // Timing + text come from Whisper word-timestamp ASR of the vocal stems
  // (docs/tabasco-lyrics-timed.json) — what's actually sung, lightly cleaned.
  // Instrumentals / AI (synth) mode fall back to the section blocks above.
  let timedLyricsData = null;
  let timedLyricsPromise = null;
  function ensureTimedLyricsLoaded() {
    if (timedLyricsData) return Promise.resolve(timedLyricsData);
    if (timedLyricsPromise) return timedLyricsPromise;
    timedLyricsPromise = fetch("docs/tabasco-lyrics-timed.json?cb=" + Date.now())
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { timedLyricsData = (j && j.songs) ? j : { songs: {} }; return timedLyricsData; })
      .catch(() => { timedLyricsData = { songs: {} }; return timedLyricsData; });
    return timedLyricsPromise;
  }
  function timedLinesForSong(songId) {
    const songs = timedLyricsData && timedLyricsData.songs;
    const arr = songs && songs[songId];
    return (Array.isArray(arr) && arr.length) ? arr : null;
  }

  function renderTimedLyricLines(lines) {
    const body = $("br-lyrics-body");
    if (!body) return;
    body.innerHTML = "";
    let prevT = null;
    lines.forEach((ln) => {
      const t = Number(ln.t) || 0;
      const div = document.createElement("div");
      div.className = "br-lyric-line";
      // separate phrases visually when there's a long instrumental gap
      if (prevT != null && t - prevT >= 3.5) div.classList.add("br-lyric-line--gap");
      div.dataset.t = t.toFixed(2);
      div.textContent = ln.x || "";
      body.appendChild(div);
      prevT = t;
    });
  }

  // Pick karaoke (timed lines, stems mode) vs section blocks. Re-runnable on
  // song load and mode switch; no-ops until a song's lyrics have been loaded.
  function renderLyricsView() {
    if (state.currentLyricMarkdown == null && !state.currentTimedLines) return;
    state.activeLyricLineIdx = -1;
    state.focusLyricLineIdx = -1;
    const useKaraoke = currentMode === "stems"
      && Array.isArray(state.currentTimedLines) && state.currentTimedLines.length > 0;
    if (useKaraoke) {
      renderTimedLyricLines(state.currentTimedLines);
      const pos = state.started
        ? playbackContentElapsedSec()
        : (state.pendingSeekOffsetSec || state.playbackStartOffsetSec || 0);
      updateKaraokeHighlight(pos);
    } else {
      renderLyricBlocks(state.currentLyricMarkdown || "(lyrics todo)");
      // keep the section highlight in sync right away (e.g. after a mode switch)
      const sec = currentSection();
      if (sec && sec.section) updateLyricsHighlight(sec.section);
    }
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
      // v201: scroll within the lyrics panel only. The old auto-follow
      // scrolled the page/window too (a nested DOM scroll-into-view call),
      // which hijacked the user's manual scroll on every section change.
      // Move #br-lyrics' own scrollTop so the panel follows, page stays put.
      scrollLyricElIntoPanel(match);
    }
  }

  // v306/v307: karaoke line follow. In stems mode, light up the line being sung
  // at the current second; during intros and instrumental gaps, LEAD the eye to
  // the upcoming line so the panel always shows where we are. (Vocal songs have
  // 30–90s intros — without the lead the panel looks frozen until the first line
  // and reads as "not following".) Cheap every frame — DOM only touched on change.
  const KARAOKE_LEAD_SEC = 0.20;  // light anticipation so the line reads in time
  function updateKaraokeHighlight(posSec) {
    if (currentMode !== "stems") return;
    const lines = state.currentTimedLines;
    if (!Array.isArray(lines) || lines.length === 0) return;
    const p = (Number(posSec) || 0) + KARAOKE_LEAD_SEC;
    // cur = last line whose time has arrived (the line being sung); -1 in the intro
    let lo = 0, hi = lines.length - 1, cur = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((Number(lines[mid].t) || 0) <= p) { cur = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    // focus = line to keep in view. Intro → first line; in a gap, once we're past
    // the midpoint between the sung line and the next, lead to the next line.
    let focus = cur < 0 ? 0 : cur;
    const nxt = cur + 1;
    if (nxt < lines.length) {
      const curT = cur >= 0 ? (Number(lines[cur].t) || 0) : -Infinity;
      const nxtT = Number(lines[nxt].t) || 0;
      if (cur < 0 || (p - curT) > (nxtT - p)) focus = nxt;
    }
    if (cur === state.activeLyricLineIdx && focus === state.focusLyricLineIdx) return;
    state.activeLyricLineIdx = cur;
    state.focusLyricLineIdx = focus;
    const body = $("br-lyrics-body");
    if (!body) return;
    let els = body.querySelectorAll(".br-lyric-line");
    if (!els.length) {
      // data exists but the timed view isn't on screen (first-load / mode race) — heal it
      renderTimedLyricLines(lines);
      els = body.querySelectorAll(".br-lyric-line");
      if (!els.length) return;
    }
    els.forEach((el, i) => {
      el.classList.toggle("active", i === cur);
      el.classList.toggle("upcoming", i === focus && i !== cur);
    });
    const focusEl = els[focus] || els[Math.max(0, cur)];
    if (focusEl) scrollLyricElIntoPanel(focusEl);
  }

  // Scroll the lyrics panel (only — never the page; see v201) so el is centered.
  function scrollLyricElIntoPanel(el) {
    const panel = document.getElementById("br-lyrics");
    if (!panel || !el) return;
    const mRect = el.getBoundingClientRect();
    const pRect = panel.getBoundingClientRect();
    const target = (mRect.top - pRect.top) + panel.scrollTop
                  - (panel.clientHeight - mRect.height) / 2;
    try { panel.scrollTo({ top: Math.max(0, target), behavior: "smooth" }); }
    catch (e) { panel.scrollTop = Math.max(0, target); }
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
      safeLocalStorageSet(MUSIC_STACK_PACKET_STORAGE_KEY, JSON.stringify(payload));
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
    const chord = chordAtBarInProgression(prog, barInSection);
    if (chord) {
      $("br-chord-current").textContent = chord;
      return chord;
    }
    $("br-chord-current").textContent = "—";
    return null;
  }

  // v222: shared chord lookup logic — given a progression (array of
  // [chord, bars] tuples) and a bar index, return the chord at that bar.
  // Loops the progression once if bar exceeds the sum. Returns null on
  // empty / invalid prog.
  function chordAtBarInProgression(prog, bar) {
    if (!Array.isArray(prog) || prog.length === 0) return null;
    let cursor = 0;
    for (const [chord, bars] of prog) {
      if (bar < cursor + bars) return chord;
      cursor += bars;
    }
    if (cursor === 0) return null;
    const looped = bar % cursor;
    cursor = 0;
    for (const [chord, bars] of prog) {
      if (looped < cursor + bars) return chord;
      cursor += bars;
    }
    return null;
  }

  // v222: next-chord lookahead. Returns the chord at (barInSection + 1),
  // crossing into the next section if needed. Used by walking-bass beat 4
  // to play a chromatic approach toward the next root. Returns null if
  // no chord progression / next section is unavailable.
  function nextChordLookahead() {
    if (!state.songData || !state.songData.chord_progression) return null;
    const sec = currentSection();
    if (!sec) return null;
    const cp = state.songData.chord_progression;
    const baseSection = sec.section.split("-")[0];
    const prog = cp[sec.section] || cp[baseSection];
    const barInSection = state.barCount - state.sectionBarStart;
    const nextBar = barInSection + 1;
    const barsInSection = Math.max(1, Number(sec.bars) || 1);
    if (nextBar < barsInSection) {
      return chordAtBarInProgression(prog, nextBar);
    }
    // Crosses into next section — peek at its first chord.
    const nextSec = state.songData.structure?.[state.sectionIdx + 1];
    if (!nextSec) return null;
    const nextProg = cp[nextSec.section] || cp[nextSec.section.split("-")[0]];
    return chordAtBarInProgression(nextProg, 0);
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
      // v222: next-bar chord for walking-bass chromatic approach (jazz mode)
      nextChord: nextChordLookahead(),
      pressure: metrics.pressure,
      density: metrics.density
    };
  }

  // v226: single source of truth for "are we in jazz mode". Was hand-copied
  // as an inline boolean in 5 places (bass / chord / voice / 2× guitar) —
  // identical each time, but a drift risk: editing one and missing another
  // would silently desync the agents. One helper, one definition.
  function isJazzyMode() {
    return state.kitProfile === "lofi-nujabes" ||
           state.chordInstrument === "salamander-piano";
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
    // v216: 4-bar phrase shape — the last flat agent gets the same breathing
    // pattern the other 4 already have (drum v209, chord v210, voice v211,
    // guitar v212). Velocity multiplier is slightly bigger than drum's
    // (±6% vs ±5%) since bass notes ring through their full duration —
    // even a small velocity bump reads as a real lift.
    const phrasePos = (ctx.barInSection || 0) % 4;
    const PHRASE_VEL_MULT_BASS = [0.96, 1.00, 1.06, 0.98];
    const phraseMult = PHRASE_VEL_MULT_BASS[phrasePos];

    // v221: jazzy walking-bass mode — for lofi-nujabes profile or
    // salamander-piano chord sampler, ditch the kick-locked source and play
    // 4 independent quarter notes per bar walking through chord tones
    // (root → 5th → 3rd → 7th). Real jazz bassists walk on the beat grid,
    // not on the drummer's kick. 7th on beat 4 sets up a half-step lead
    // into many common chord changes (e.g. G7 7th = F → C of Cmaj7).
    //
    // Skip the bar 2 octave lift in jazz (too dramatic for walking line —
    // jazz dynamics stay subtle). Role embellishments (recap +pressure
    // extra) still apply on top so chorus sections have extra punch.
    const isJazzy = isJazzyMode();
    if (isJazzy && ctx.role !== "break") {
      // v222: beat 4 chromatic approach to next chord's root when next != current.
      // Leading-tone-from-below (nextRoot - 1) is the most common jazz move;
      // works for the majority of progressions without lookahead-aware key
      // analysis. If next chord is the same or unknown, fall back to 7th
      // (the v221 default — also a natural lead for V7 → I changes).
      const nextRootSemi = ctx.nextChord ? chordToSemi(ctx.nextChord) : null;
      const beat4Semi = (nextRootSemi != null && nextRootSemi !== root)
        ? nextRootSemi - 1
        : seventh;
      const walkSteps = [
        { sub: 0,  note: semiToNote(root),       dur: "4n", vel: clamp(0.50 * phraseMult, 0.30, 0.82), microMs: 0 },
        { sub: 4,  note: semiToNote(fifth),      dur: "4n", vel: clamp(0.42 * phraseMult, 0.30, 0.82), microMs: 0 },
        { sub: 8,  note: semiToNote(third),      dur: "4n", vel: clamp(0.42 * phraseMult, 0.30, 0.82), microMs: 0 },
        { sub: 12, note: semiToNote(beat4Semi),  dur: "4n", vel: clamp(0.46 * phraseMult, 0.30, 0.82), microMs: 0 }
      ];
      if ((ctx.role === "recap" || ctx.role === "comp") && ctx.pressure > 0.52) {
        walkSteps.push({ sub: 14, note: semiToNote(third + 12), dur: "16n", vel: clamp(0.42 * phraseMult, 0.30, 0.82), microMs: -8 });
      }
      return dedupeAgentSteps(walkSteps, 10);
    }

    const source = ctx.kick.length ? ctx.kick : [
      { step: 0, vel: 0.58, microMs: 0 },
      { step: ctx.role === "break" ? 8 : 6, vel: 0.42, microMs: 0 }
    ];
    // Bar 2 downbeat octave lift — phrase peak. Real bassists often jump
    // an octave on the bar before a fill for excitement. Only applies to
    // the downbeat (hit.step === 0), only on bar 2, and only on roles
    // where it makes musical sense (skip break / intro / outro where
    // the section is quiet by design).
    const liftBar2Downbeat = phrasePos === 2 &&
      ctx.role !== "break" && ctx.role !== "intro" && ctx.role !== "outro";

    const steps = source.map((hit, idx) => {
      let tone = hit.step >= 12 ? seventh : hit.step >= 8 ? octave : hit.step >= 4 ? fifth : root;
      if (liftBar2Downbeat && hit.step === 0) tone += 12;
      return {
        sub: hit.step,
        note: semiToNote(tone),
        dur: ctx.role === "recap" && ctx.density > 0.5 ? "16n" : "8n",
        vel: clamp((0.30 + hit.vel * 0.58 + (idx === 0 ? 0.08 : 0)) * phraseMult, 0.30, 0.82),
        microMs: hit.microMs || 0
      };
    });
    if ((ctx.role === "recap" || ctx.role === "comp") && ctx.pressure > 0.52) {
      steps.push({ sub: 14, note: semiToNote(third + 12), dur: "16n", vel: clamp(0.42 * phraseMult, 0.30, 0.82), microMs: -8 });
    }
    if (ctx.role === "verse" && ctx.ghost.some((hit) => hit.step >= 10)) {
      steps.push({ sub: 11, note: semiToNote(fifth), dur: "16n", vel: clamp(0.36 * phraseMult, 0.30, 0.82), microMs: -6 });
    }
    return dedupeAgentSteps(steps, ctx.role === "recap" ? 10 : 7);
  }

  function guitarAgentPlan(ctx) {
    if (!ctx.chord) return [];
    if (ctx.role === "intro" && ctx.crash.length === 0 && ctx.pressure < 0.55) return [];
    const accentSteps = sourceAccentSteps(ctx, ["kick", "snare", "crash", "ghost"], 0.24);
    const accentMap = new Map(accentSteps.map((hit) => [hit.step, hit]));
    const steps = [];

    // v225 / v226: jazz comping rhythm — sparse + syncopated. A dense 8th/16th
    // strum is wrong for a jazz combo: jazz guitar leaves space. The base
    // pattern is the Charleston rhythm — beat 1 + "and of 2" (sub 0 +
    // sub 6); recap adds the "and of 3" (sub 10). Off-beat hits (sub 6/10)
    // lay back 12ms — same lo-fi laid-back micro-timing the voice agent uses
    // (v226 corrected this from a 35ms bebop triplet to a 12ms lo-fi wonk so
    // it stays coherent with the lofi-nujabes drum Dilla offsets).
    // Skips outro / break / intro (those have their own treatment below).
    const isJazzy = isJazzyMode();
    if (isJazzy && ctx.role !== "outro" && ctx.role !== "break" && ctx.role !== "intro") {
      const jazzGrid = ctx.role === "recap" ? [0, 6, 10] : [0, 6];
      jazzGrid.forEach((sub) => {
        const sourceHit = accentMap.get(sub);
        const isOffBeat8th = (sub % 4) === 2;
        steps.push({
          sub,
          dur: "8n",
          vel: clamp(0.40 + (sourceHit ? sourceHit.vel * 0.22 : 0) + (sub === 0 ? 0.08 : 0), 0.32, 0.68),
          microMs: (sourceHit?.microMs || 0) + (isOffBeat8th ? 12 : 0)
        });
      });
      return dedupeAgentSteps(steps, 4);
    }

    if (ctx.role === "outro") {
      steps.push({ sub: 0, dur: "1n", vel: 0.82 });
    } else if (ctx.role === "break") {
      [0, 8].forEach((sub) => steps.push({ sub, dur: "4n", vel: 0.38 + ctx.pressure * 0.20 }));
    } else if (ctx.role === "recap" || ctx.pressure > 0.66) {
      // v200: 8th-note strum (was 16th). 16 power-chord triggers per bar
      // (×3 notes each) overran the guitar PolySynth — halving the strum
      // density keeps the part audible instead of mostly dropped.
      for (let sub = 0; sub < 16; sub += 2) {
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
    return dedupeAgentSteps(steps, 8);
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
    // v232: voice/melody octave 4 → 5. At octave 4 it played the exact same
    // chord tones as the chord pad (also octave 4), so it doubled the chord
    // instead of reading as a separate 5th part. Octave 5 puts the melody
    // clearly above the pad — its own frequency lane (bass 2 / guitar 3 /
    // chord 4 / voice 5).
    const notes = chordToNotes(ctx.chord, 5);
    if (notes.length < 3) return [];
    const accents = sourceAccentSteps(ctx, ["snare", "ghost", "crash"], 0.30)
      .filter((hit) => hit.step === 0 || hit.step >= 3);
    if (ctx.isPhraseEnd) {
      const hold = ctx.role === "break" ? notes[1] : notes[0];
      return [{ sub: 0, note: hold, durSteps: 12, vel: ctx.role === "recap" ? 0.62 : 0.48 }];
    }
    // v211: phrase-shaped contour rotation. The old flat [root, 3rd, 5th, 3rd]
    // every bar made the AI vocal line read as a stuck arpeggio. Real vocals
    // arc through a 4-bar phrase — rise into it, sit near the top, descend,
    // close back. The new contour table gives each bar of the phrase its
    // own shape, so 4 bars compose one melodic gesture.
    //
    // r = notes[0] (root), m = notes[1] (3rd), h = notes[2] (5th)
    // Default path (verse / comp / non-recap):
    //   bar 0 ascending  : r → m → h → m   (settle entrance)
    //   bar 1 weaving    : m → h → m → h   (sit near top)
    //   bar 2 descending : h → m → r → m   (lead into fill bar)
    //   bar 3 closing    : r → h → m → r   (prep for next phrase entrance)
    // Recap path (chorus-style intensity already): top-centered variants
    // so the existing [3rd, 5th, root, 5th] gesture becomes phrase 1 of 4.
    const r = notes[0], m = notes[1], h = notes[2];
    const PHRASE_CONTOURS_DEFAULT = [
      [r, m, h, m],   // bar 0
      [m, h, m, h],   // bar 1
      [h, m, r, m],   // bar 2
      [r, h, m, r]    // bar 3
    ];
    const PHRASE_CONTOURS_RECAP = [
      [m, h, r, h],   // bar 0 — original recap shape
      [h, h, m, h],   // bar 1 — peak weaving
      [m, r, m, h],   // bar 2 — descend-bounce
      [h, m, h, r]    // bar 3 — closing
    ];
    const phrasePos = (ctx.barInSection || 0) % 4;
    const contour = (ctx.role === "recap" ? PHRASE_CONTOURS_RECAP : PHRASE_CONTOURS_DEFAULT)[phrasePos];
    const source = accents.length ? accents.slice(0, 4) : [0, 4, 8, 12].map((step) => ({ step, vel: 0.42, microMs: 0 }));
    // v223 / v226: jazzy mode laid-back micro-timing — off-beat 8th positions
    // (sub 2/6/10/14) lay back slightly. v226 fix: this was +35ms (a bebop
    // triplet swing), which contradicted the lofi-nujabes profile's actual
    // aesthetic — that profile is named for Nujabes / J Dilla lo-fi, whose
    // feel is SUBTLE wonk, not a uniform triplet. The drum scheduler's Dilla
    // offsets for this profile are small (snareBack 14ms / ghostBack 8ms /
    // hatOffPush -4ms). +12ms sits in that same small range, so the melody's
    // lay-back is coherent with the drum feel instead of fighting it.
    // On-beats (sub 0/4/8/12) stay grid-locked so the contour hits with the
    // chord stab.
    const isJazzySwing = isJazzyMode();
    return dedupeAgentSteps(source.map((hit, idx) => {
      const isOffBeat8th = (hit.step % 4) === 2;
      const swingMs = isJazzySwing && isOffBeat8th ? 12 : 0;
      return {
        sub: hit.step,
        note: contour[idx % contour.length],
        durSteps: ctx.role === "recap" ? 2 : 3,
        vel: clamp((ctx.role === "recap" ? 0.42 : 0.34) + hit.vel * 0.28, 0.34, 0.66),
        microMs: (hit.microMs || 0) + swingMs
      };
    }), 4);
  }

  function chordAgentPlan(ctx) {
    if (!ctx.chord) return [];
    const isJazzy = isJazzyMode();
    const ext = /m\b|min\b/.test(ctx.chord) ? "m7" : "maj7";
    const voicingChord = isJazzy ? ctx.chord.replace(/(m|maj7|7|m7)?$/, ext) : ctx.chord;
    let baseNotes = chordToNotes(voicingChord, isJazzy ? 4 : 4);
    if (!baseNotes.length) return [];
    // v231: chord is a PolySynth (maxPolyphony 10). A 7th voicing (4 notes)
    // × up to 3 stabs/bar = 12 → polyphony flood + dropped notes. Drop a
    // 7th chord to a 3-note shell (root + 3rd + 7th — the 5th is the most
    // omittable tone) so 3 stabs × 3 = 9 fits the cap. Plain triads are
    // already 3 notes and pass through untouched.
    if (baseNotes.length >= 4) baseNotes = [baseNotes[0], baseNotes[1], baseNotes[3]];

    // v210: inversion rotation per phrase position. Real chord players don't
    // hammer root-position every bar — the top note weaves across the 4-bar
    // phrase. inv = root → 1st → 2nd → root+oct creates a melodic contour
    // in the chord voicing itself without changing the underlying harmony.
    //
    // v218: jazzy mode (lofi-nujabes profile or salamander-piano chord
    // sampler) overrides this with **voice leading** — pick the inversion
    // whose top note is closest to the previous bar's top note. This is
    // what a real jazz pianist does instead of mechanical rotation:
    // smooth, stepwise top-note motion across chord changes. The phrase
    // rotation is musically right for rock / dance, but jazz wants the
    // chords to weave like a melodic line.
    const phrasePos = (ctx.barInSection || 0) % 4;
    let notes;
    if (isJazzy && lastChordTopNote != null) {
      let bestInv = 0;
      let bestDistance = Infinity;
      for (let inv = 0; inv < 4; inv++) {
        const inverted = chordInversion(baseNotes, inv);
        if (!inverted.length) continue;
        const topSemi = noteNameToSemi(inverted[inverted.length - 1]);
        const distance = Math.abs(topSemi - lastChordTopNote);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestInv = inv;
        }
      }
      notes = chordInversion(baseNotes, bestInv);
    } else {
      const INVERSION_BY_PHRASE = [0, 1, 2, 0];  // bar 4 returns to root for phrase closure
      notes = chordInversion(baseNotes, INVERSION_BY_PHRASE[phrasePos]);
    }
    // v218: store top note for next bar's voice-leading decision.
    if (notes.length) {
      lastChordTopNote = noteNameToSemi(notes[notes.length - 1]);
    }

    // v210: phrase-aware rhythm. Old behavior was 1-2 stabs per bar with the
    // same shape, regardless of where in the phrase you were. Now non-break
    // / non-comp roles get a 4-bar rhythm shape:
    //   bar 0: long pad on downbeat (settle into the phrase)
    //   bar 1: downbeat + mid-bar stab (push the phrase mid)
    //   bar 2: downbeat + anticipation into bar 3 (lead into fill bar)
    //   bar 3: long pad (release; drums do the fill build)
    // break / comp / jazzy paths keep their existing reactive logic but
    // also get the inversion rotation.
    //
    // v219: intro / outro use "1n" so the chord rings the full bar and the
    // release tail overlaps into the next bar — atmospheric pad swell.
    // Matches guitar agent's existing outro "1n" treatment. Voice agent
    // already returns [] for intro/outro, so the chord pad isn't competing
    // with a melody line.
    // v257: chord pad simplification for non-jazzy modes.
    // The v210 default phrase rhythm (mid-bar stab on bar 1, anticipation
    // on bar 2) was adding rhythmic events from a part that for rock/punk
    // should be a sustained background pad. With v254 (voice off) +
    // v255 (chord vol 40), the chord is already a background colour; the
    // stabs were extra info competing with drums/bass/guitar rhythm.
    //
    // Non-jazzy non-special: 1 onset/bar at "1n" — the chord rings the
    // full bar as a pad. Polyphony is fine (3 notes × ~1.5 bars sustain =
    // ~5 voices, well under cap 10).
    //
    // jazzy / break / comp / recap-pressure / intro / outro: unchanged —
    // those modes have their own structural reason to stab (jazz comping
    // rhythm, break call-response, intro/outro pad swell).
    const isRockPad = !isJazzy
      && ctx.role !== "break"
      && ctx.role !== "comp"
      && ctx.role !== "intro"
      && ctx.role !== "outro"
      && !(ctx.role === "recap" && ctx.pressure > 0.58)
      && ctx.ghost.length <= 1;
    const downbeatDur = ctx.role === "break"
      ? "4n"
      : (ctx.role === "intro" || ctx.role === "outro")
        ? "1n"
        : isRockPad
          ? "1n"  // v257: hold the full bar as a pad
          : "2n";
    const downbeatVel = isJazzy ? 0.28 : 0.34;
    const steps = [{ sub: 0, notes, dur: downbeatDur, vel: downbeatVel }];

    if (ctx.role === "break") {
      steps.push({ sub: 8, notes, dur: "4n", vel: 0.22 });
    } else if (isJazzy || ctx.ghost.length > 1 || ctx.role === "comp") {
      // Jazzy / comp / busy ghost — answer on the ghost-step or sub 10
      const ghostAnswer = ctx.ghost.find((hit) => hit.step >= 8)?.step;
      steps.push({
        sub: ghostAnswer != null ? ghostAnswer : 10,
        notes,
        dur: "4n",
        vel: clamp(0.18 + ctx.pressure * 0.12, 0.18, 0.32)
      });
    } else if (ctx.role === "recap" && ctx.pressure > 0.58) {
      steps.push({ sub: 8, notes, dur: "4n", vel: 0.24 });
    }
    // v257: non-jazzy non-special path (the rock pad case) emits ONLY the
    // downbeat — the v210 phrase-rhythm stabs are removed. drums + bass +
    // guitar carry the rhythm; chord just holds.
    return dedupeAgentSteps(steps, 3);
  }

  // v324: transcribed-line playback. Songs whose JSON carries real note data
  // extracted from the stems (bass_line / vocal_melody via
  // scripts/transcribe-stem-lines.py) get the ACTUAL line played back instead
  // of a generated one — the difference between "a band jamming on the chart"
  // and "the song". Events are compact [bar, step16, durSteps, midi, vel]
  // rows; indexed per-bar on first use, re-built on song switch.
  let transcribedLineCache = { songId: null, lines: {} };
  function transcribedNotesForBar(lineKey, absBar) {
    const line = state.songData?.[lineKey];
    const events = line && Array.isArray(line.events) ? line.events : null;
    if (!events || !events.length) return null;
    if (transcribedLineCache.songId !== state.currentSongId) {
      transcribedLineCache = { songId: state.currentSongId, lines: {} };
    }
    let byBar = transcribedLineCache.lines[lineKey];
    if (!byBar) {
      byBar = new Map();
      for (const ev of events) {
        const bar = Number(ev[0]) || 0;
        if (!byBar.has(bar)) byBar.set(bar, []);
        byBar.get(bar).push(ev);
      }
      transcribedLineCache.lines[lineKey] = byBar;
    }
    return byBar.get(absBar) || null;
  }
  function hasTranscribedLine(lineKey) {
    const line = state.songData?.[lineKey];
    return !!(line && Array.isArray(line.events) && line.events.length);
  }

  function transcribedLightRowLimit(lineKey) {
    if (!(currentMode === "synth" && aiLightRuntimeEnabled())) return Infinity;
    if (lineKey === "vocal_melody") return 4;
    if (lineKey === "guitar_line") return 6;  // v335: one more strum on phones — chug needs at least 8th-ish density
    if (lineKey === "drum_line") return 10;   // v338: kit one-shots are cheap; vel-slot thinning drops quiet hats first, keeps kick/snare/crash
    if (lineKey === "bass_line") return 6;
    return 6;
  }

  function rowsForLightTranscribedPlayback(lineKey, rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const limit = transcribedLightRowLimit(lineKey);
    if (!Number.isFinite(limit) || rows.length <= limit) return rows;
    const slots = Math.max(1, Math.floor(limit));
    const bestBySlot = new Array(slots).fill(null);
    rows.forEach((row) => {
      const step = clamp(Number(row[1]) || 0, 0, 15.999);
      const slot = clamp(Math.floor((step / 16) * slots), 0, slots - 1);
      const prev = bestBySlot[slot];
      const vel = Number(row[4]) || 0;
      if (!prev || vel > (Number(prev[4]) || 0)) bestBySlot[slot] = row;
    });
    const picked = bestBySlot.filter(Boolean);
    if (picked.length < slots) {
      const byVelocity = rows.slice().sort((a, b) => (Number(b[4]) || 0) - (Number(a[4]) || 0));
      for (const row of byVelocity) {
        if (picked.length >= slots) break;
        if (!picked.includes(row)) picked.push(row);
      }
    }
    return picked.sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0));
  }

  function playTranscribedBar(synth, lineKey, ctx, time) {
    const rows = rowsForLightTranscribedPlayback(lineKey, transcribedNotesForBar(lineKey, state.barCount));
    if (!rows.length) return false;
    rows.forEach((row) => {
      // v328 (生感): step and durSteps are FRACTIONAL — the data carries the
      // player's real micro-timing (間/pocket) and real note lengths
      // (staccato/legato breathing), both tempo-relative via subTime. No
      // quantize clamp, no fixed gate — the performance IS the humanization.
      const t = time + (Number(row[1]) || 0) * ctx.subTime;
      const rawDurSteps = Math.max(0.5, Number(row[2]) || 1);
      const durSteps = aiLightRuntimeEnabled()
        ? Math.min(rawDurSteps, lineKey === "bass_line" ? 2.8 : 3.0)
        : rawDurSteps;
      const durSec = Math.max(0.05, durSteps * ctx.subTime);
      const note = Tone.Frequency(Number(row[3]) || 36, "midi").toNote();
      try { synth.triggerAttackRelease(note, durSec, t, Number(row[4]) || 0.6); } catch (e) {}
    });
    return true;
  }

  function guitarVoicingFromMidi(rootMidi, chord, isJazzy, maxNotes) {
    if (isJazzy && chord) {
      const ext = /m\b|min\b/.test(chord) ? "m7" : "maj7";
      const voicingChord = chord.replace(/(m|maj7|7|m7)?$/, ext);
      const full = chordToNotes(voicingChord, 3);
      const shell = full.length >= 4 ? [full[0], full[1], full[3]] : full;
      return shell.slice(0, maxNotes);
    }
    const midi = Number(rootMidi) || 48;
    return [midi, midi + 7, midi + 12]
      .slice(0, maxNotes)
      .map((n) => Tone.Frequency(n, "midi").toNote());
  }

  // ---- v339: AI 再構築 (style reconstruction) -------------------
  // Rebuild the groove in a reference style while keeping the song's
  // identity: the vocal sings the real melody, the bass keeps the real
  // pitches (re-rhythmed), guitar/chords follow the corrected progression.
  // Per-bar energy follows the real drum performance's density, so verses
  // still sit lower than choruses. All deterministic — no dice.
  function reconstructRootMidi(ctx) {
    const rows = transcribedNotesForBar("bass_line", state.barCount);
    if (rows && rows.length) {
      const weight = {};
      rows.forEach((r) => {
        const m = Number(r[3]) || 36;
        weight[m] = (weight[m] || 0) + (Number(r[2]) || 1) * (Number(r[4]) || 0.5);
      });
      return Number(Object.entries(weight).sort((a, b) => b[1] - a[1])[0][0]);
    }
    const semi = ctx && ctx.chord ? chordToSemi(ctx.chord) : null;
    return semi != null ? semi + 12 : 38;
  }

  function reconstructEnergy() {
    const rows = transcribedNotesForBar("drum_line", state.barCount);
    if (!rows) return 0.85;
    return clamp(rows.length / 14, 0.55, 1);
  }

  function reconstructDrumBar(time, subTime, style) {
    if (!drumKit) return false;
    const e = reconstructEnergy();
    const hit = (cls, st, vel) => {
      const inst = drumKit[cls];
      if (!inst) return;
      const t = time + st * subTime;
      const v = clamp(vel * e, 0.05, 1);
      try {
        if (cls === "kick") inst.triggerAttackRelease("C1", "16n", t, v);
        else if (cls === "crash") inst.triggerAttackRelease("2n", t, v);
        else inst.triggerAttackRelease("16n", t, v);
      } catch (err) {}
    };
    [0, 4, 8, 12].forEach((st) => hit("kick", st, 0.94));   // four on the floor
    [4, 12].forEach((st) => hit("snare", st, 0.9));         // backbeat
    if (style === "lcd") {
      [2, 6, 10, 14].forEach((st) => hit("hat", st, 0.6));  // disco offbeat hat
      hit("hat", 15, 0.3);                                  // pickup tick
    } else {
      for (let st = 0; st < 16; st += 2) hit("hat", st, st % 4 === 0 ? 0.5 : 0.34);  // straight 8th ride
      hit("hat", 14, 0.62);                                 // open-ish lift
    }
    if (state.barCount % 8 === 0) hit("crash", 0, 0.5);
    return true;
  }

  function reconstructBassBar(ctx, time, style) {
    if (!synthBass) return false;
    const root = reconstructRootMidi(ctx);
    const e = reconstructEnergy();
    const steps = style === "lcd"
      ? [0, 2, 4, 6, 8, 10, 12, 14].map((st) => ({ st, m: (st === 6 || st === 14) ? root + 12 : root, v: st % 4 === 0 ? 0.9 : 0.62, d: 0.9 }))
      : [0, 3, 4, 7, 8, 10, 12, 14].map((st, i) => ({ st, m: (st === 7 || st === 14) ? root + 12 : root, v: i % 2 === 0 ? 0.85 : 0.6, d: 0.8 }));
    steps.forEach(({ st, m, v, d }) => {
      const note = Tone.Frequency(m, "midi").toNote();
      try { synthBass.triggerAttackRelease(note, d * ctx.subTime, time + st * ctx.subTime, clamp(v * e, 0.16, 1)); } catch (err) {}
    });
    return true;
  }

  function reconstructGuitarBar(ctx, time, style) {
    if (!guitarSynth) return false;
    let root = reconstructRootMidi(ctx);
    while (root < 48) root += 12;
    const e = reconstructEnergy();
    const strums = style === "lcd"
      ? [2, 6, 10, 14].map((st) => ({ st, v: 0.58, d: 0.55 }))  // disco skank
      : [{ st: 0, v: 0.46, d: 3 }, { st: 6, v: 0.5, d: 0.6 }, { st: 8, v: 0.44, d: 3 }, { st: 14, v: 0.5, d: 0.6 }];
    // v343: ONE batched PolySynth call per strum. The staggered per-note
    // triggers tripled the call count (12/bar) — past the v241 freeze budget
    // — and after minutes of play the voice churn ground playback to a halt
    // (user: しばらくなったら激重でならなくなる). Batched = 4 calls/bar.
    const notesPerStrum = aiLightRuntimeEnabled() ? 2 : 3;
    const voicing = guitarVoicingFromMidi(root, ctx.chord, false, notesPerStrum);
    if (!voicing.length) return false;
    strums.forEach(({ st, v, d }) => {
      try { guitarSynth.triggerAttackRelease(voicing, d * ctx.subTime, time + st * ctx.subTime, clamp(v * e, 0.16, 1)); } catch (err) {}
    });
    return true;
  }

  function reconstructChordBar(ctx, time, style) {
    if (!chordSynth || !ctx.chord) return false;
    const e = reconstructEnergy();
    const tones = chordToNotes(ctx.chord, 4);
    if (!tones.length) return false;
    if (style === "lcd") {
      [2, 10].forEach((st) => {  // house-ish stabs on the and-of-1 / and-of-3
        try { chordSynth.triggerAttackRelease(tones, 0.75 * ctx.subTime, time + st * ctx.subTime + 0.004, clamp(0.5 * e, 0.16, 1)); } catch (err) {}
      });
    } else {
      // v343: 8th-note arp (8 triggers/bar), was a 16th arp at 16/bar — 60%
      // over the PolySynth's maxPolyphony 10, so Tone warned on EVERY dropped
      // voice (console flood) and voice churn accumulated until playback
      // seized (激重). 8ths keep the sakanaction sparkle inside the budget.
      for (let st = 0; st < 16; st += 2) {
        const n = tones[(st >> 1) % tones.length];
        try { chordSynth.triggerAttackRelease(n, 1.2 * ctx.subTime, time + st * ctx.subTime, clamp((st % 4 === 0 ? 0.52 : 0.38) * e, 0.12, 1)); } catch (err) {}
      }
    }
    return true;
  }

  // v338: transcribed drum performance. Row format matches the other lines —
  // [bar, step(frac), durSteps, CLASS, vel] where CLASS indexes DRUM_CLASS
  // (not midi). The real recording carries its own fills, crash placement,
  // dynamics and micro-timing, so none of the pattern path's compensation
  // (velocity floors, jitter, Dilla offsets, phrase shaping, generated
  // fills/crash hints) applies here — the performance IS the groove.
  const DRUM_CLASS = ["kick", "snare", "hat", "crash"];
  function playTranscribedDrumBar(time, subTime) {
    if (!drumKit) return false;
    // v339: AI 再構築 takes over the kit entirely when a style is selected.
    const drumStyle = reconstructStyleFor("drums");
    if (drumStyle !== "off") return reconstructDrumBar(time, subTime, drumStyle);
    const rows = rowsForLightTranscribedPlayback("drum_line", transcribedNotesForBar("drum_line", state.barCount));
    if (!rows.length) return false;
    const micScale = micFollowVelocityScale();
    rows.forEach((row) => {
      const cls = DRUM_CLASS[Number(row[3])] || "snare";
      const inst = drumKit[cls];
      if (!inst) return;
      const t = time + (Number(row[1]) || 0) * subTime;
      const vel = clamp((Number(row[4]) || 0.5) * micScale, 0.05, 1);
      try {
        if (cls === "kick") inst.triggerAttackRelease("C1", "16n", t, vel);
        else if (cls === "crash") inst.triggerAttackRelease("2n", t, vel);
        else inst.triggerAttackRelease("16n", t, vel);
      } catch (e) {}
    });
    return true;
  }

  function playTranscribedGuitarBar(ctx, time) {
    // v339: AI 再構築 replaces the strum performance with the style comp.
    const guitarStyle = reconstructStyleFor("guitar");
    if (guitarStyle !== "off") return reconstructGuitarBar(ctx, time, guitarStyle);
    const rows = rowsForLightTranscribedPlayback("guitar_line", transcribedNotesForBar("guitar_line", state.barCount));
    if (!rows.length || !guitarSynth) return false;
    const isJazzy = isJazzyMode();
    const light = aiLightRuntimeEnabled();
    // v334: a power chord needs root+5th MINIMUM — the old floor(9/rows)
    // collapsed dense bars to single notes, which is exactly the しょぼい
    // thin-mono-guitar sound. Voices stay bounded because the v334 data caps
    // durations at 2 steps (chug gates on the next strum, voices release fast).
    const notesPerStrum = light ? 2 : 3;
    // v335: down/up stroke feel. In a fast chug (strums < 1.2 steps apart) a
    // real right hand alternates: downstrokes drive, upstrokes sit slightly
    // softer and a hair late, and the pick crosses the strings in the
    // OPPOSITE direction. Strokes separated by more than 1.2 steps are all
    // treated as fresh downstrokes.
    let prevStep = -Infinity;
    let strokeIdx = 0;
    rows.forEach((row) => {
      const step = Number(row[1]) || 0;
      strokeIdx = (step - prevStep) < 1.2 ? strokeIdx + 1 : 0;
      prevStep = step;
      const isUpstroke = strokeIdx % 2 === 1;
      const t = time + step * ctx.subTime + (isUpstroke ? 0.004 : 0);
      const rawDurSteps = Math.max(0.3, Number(row[2]) || 1);
      const durSteps = light ? Math.min(rawDurSteps, 1.6) : rawDurSteps;
      const durSec = Math.max(0.045, durSteps * ctx.subTime * 0.96);
      const vel = clamp(((Number(row[4]) || 0.55) * 0.96 + 0.02) * (isUpstroke ? 0.88 : 1), 0.16, 0.98);
      const voicing = guitarVoicingFromMidi(row[3], ctx.chord, isJazzy, notesPerStrum);
      if (!voicing.length) return;
      // v334: strum stagger — a real downstroke hits low→high strings ~5-8ms
      // apart; simultaneous PolySynth notes read as an organ stab. Light
      // runtime keeps the single batched call (CPU). v335: upstrokes sweep
      // high→low (reversed order).
      if (light) {
        try { guitarSynth.triggerAttackRelease(voicing, durSec, t, vel); } catch (e) {}
      } else {
        const sweep = isUpstroke ? voicing.slice().reverse() : voicing;
        sweep.forEach((note, i) => {
          try { guitarSynth.triggerAttackRelease(note, durSec, t + i * 0.007, vel * (1 - i * 0.06)); } catch (e) {}
        });
      }
    });
    return true;
  }

  function triggerBassAgent(ctx, time) {
    // v339: AI 再構築 re-rhythms the real pitches into the style's pulse.
    const bassStyle = reconstructStyleFor("bass");
    if (bassStyle !== "off" && reconstructBassBar(ctx, time, bassStyle)) return;
    // v324: real line first — when this song has a transcribed bass line,
    // play it and skip the generative plan entirely.
    if (playTranscribedBar(synthBass, "bass_line", ctx, time)) return;
    // v249: bass → kick onset lock. The bass agent's note times are
    // grid-quantized; the drum kicks have micro-offsets from the source
    // (or stay on grid for cramps-punk). Snapping bass onsets to the
    // nearest kick within a tight ±50ms pocket window locks the
    // bass-and-drums pair into one rhythm-section voice — the single
    // biggest "band" groove move. Bass notes more than 50ms from any
    // kick are left on grid: those are intended syncopation, not pocket.
    const kickTimes = (ctx.events || [])
      .filter((e) => e.instrument === "kick")
      .map((e) => (e.beat || 0) * ctx.beatTime + (e.sub || 0) * ctx.subTime + (e.microMs || 0) / 1000);
    // When the frame has no kicks at all, v106 / v247 sparse-frame
    // reinforcement adds them at beat 0 + beat 2 (sub 0). Mirror those
    // here so the bass still has lock targets in rescue sections.
    if (kickTimes.length === 0) {
      kickTimes.push(0, 2 * ctx.beatTime);
    }
    const SNAP_WINDOW_SEC = 0.050;
    // v264: per-profile bass push offset. Measured from real Tabasco stems
    // via scripts/analyze-tabasco-stems.py — across 6 of 7 Tabasco songs,
    // bass onsets land 7-16 ms BEFORE the nearest kick (the cramps-punk
    // "前のめり" feel: bassist anticipates, drummer lands). Snap to
    // (kick + push) instead of kick exactly, so the cramps-punk profile
    // re-creates the natural push. Other profiles keep delta=0 (no
    // measured data → conservative).
    //
    //   measured avg per song (ms ahead of kick, negative = pushed):
    //     hey -16.4 / igaf -11.5 / utm -11.4 / es -11.5 / hf -8.9 / sister -7.4
    //     mean = -11.2 ms, median -11.5 — landed on -10 ms (clean number,
    //     well within the measured range)
    const BASS_PUSH_BY_PROFILE = {
      "cramps-punk":  -0.010,
      "default":       0.0,
      "sakanaction":   0.0,
      "lcd-motorik":   0.0,
      "lofi-nujabes":  0.0
    };
    const bassPushSec = BASS_PUSH_BY_PROFILE[state.kitProfile || "default"] || 0;
    bassAgentPlan(ctx).forEach((step) => {
      let baseOffset = step.sub * ctx.subTime + (Number(step.microMs) || 0) / 1000;
      let nearestDelta = Infinity;
      let nearestKick = null;
      for (const kt of kickTimes) {
        const d = Math.abs(kt - baseOffset);
        if (d < nearestDelta) { nearestDelta = d; nearestKick = kt; }
      }
      if (nearestKick !== null && nearestDelta <= SNAP_WINDOW_SEC) {
        baseOffset = nearestKick + bassPushSec;
      }
      const t = time + baseOffset;
      try { synthBass.triggerAttackRelease(step.note, step.dur || "8n", t, step.vel); } catch (e) {}
    });
  }

  // v241: guitar sparse-strum cap. The guitar agent can return ~8 strums/bar;
  // machine-gunning the PolySynth that fast was the last AI 再現 freeze cause
  // (drums/bass/voice/chord were all verified clear). A guitar comping at
  // ~2 strums/bar sits in the same safe zone as the chord (~1-2 stabs/bar).
  // Keep the earliest strum (downbeat) + one mid-bar strum, full power-chord
  // voicing on each — sparse rhythm, full chords: a real rhythm-guitar comp.
  function guitarSparseStrums(plan) {
    if (!Array.isArray(plan) || plan.length <= 2) return plan || [];
    const sorted = plan.slice().sort((a, b) => (Number(a.sub) || 0) - (Number(b.sub) || 0));
    const first = sorted[0];
    const mid = sorted.find((s) => (Number(s.sub) || 0) >= 8) || sorted[sorted.length - 1];
    return mid && mid !== first ? [first, mid] : [first];
  }

  function triggerGuitarAgent(ctx, time) {
    if (playTranscribedGuitarBar(ctx, time)) return;
    if (!ctx.chord) return;
    // v224: jazzy mode uses 7th-extended shell voicings instead of power
    // chords. Power chords (root + 5th + octave) sound wrong against a jazz
    // combo — jazz guitar comps with shell voicings (root + 3rd + 7th, the
    // 5th dropped) à la Freddie Green. The 3rd carries major/minor colour,
    // the 7th carries the chord's jazz extension; the 5th is harmonically
    // redundant and just adds mud. Non-jazzy stays on power chords (the
    // right sound for rock / dance).
    const isJazzy = isJazzyMode();
    let baseNotes;
    if (isJazzy) {
      const ext = /m\b|min\b/.test(ctx.chord) ? "m7" : "maj7";
      const voicingChord = ctx.chord.replace(/(m|maj7|7|m7)?$/, ext);
      const full = chordToNotes(voicingChord, 3);  // [root, 3rd, 5th, 7th]
      baseNotes = full.length >= 4 ? [full[0], full[1], full[3]] : full;
    } else {
      baseNotes = powerChordNotes(ctx.chord, 3);
    }
    if (!baseNotes.length) return;
    // v212: power chord voicing rotates per phrase position. Pattern offset
    // from the chord agent's [0, 1, 2, 0] so guitar and chord don't double
    // their top-note motion in parallel — guitar's [1, 0, 2, 0] gives
    //   bar 0: 1st (mid)  bar 1: root (low / chord 1st inv top)
    //   bar 2: 2nd (high) bar 3: root (low / phrase close)
    // The two parts now weave: guitar low at chord peak (bar 2), guitar
    // high at chord settle (bar 0). chordInversion handles the lift; we
    // dedup because power-chord root doubling creates duplicate notes at
    // inv 1 / 2 which waste PolySynth voices. (Shell voicings have no
    // duplicates so the Set dedup is a harmless no-op for jazz mode.)
    const phrasePos = (ctx.barInSection || 0) % 4;
    const GUITAR_INVERSION_BY_PHRASE = [1, 0, 2, 0];
    const notes = [...new Set(chordInversion(baseNotes, GUITAR_INVERSION_BY_PHRASE[phrasePos]))];
    // v231: guitar is now a PolySynth (the electric-guitar CDN samples are
    // unservable — jsDelivr 50MB limit). The bar scheduler fires a whole
    // bar of strums at once and PolySynth reserves a voice per note on the
    // call, so 8 strums × a 3-note power chord = 24 voices >> maxPolyphony
    // 10 → flood + dropped notes. Scale notes-per-strum to the strum count
    // so the bar's total stays within the cap: dense strumming collapses to
    // a single-note chug (a real palm-muted punk-guitar texture), sparse
    // strumming keeps the full power chord.
    const plan = guitarSparseStrums(guitarAgentPlan(ctx));  // v241: ~8 strums/bar → ~2 (sparse comp)
    const notesPerStrum = clamp(Math.floor(9 / Math.max(1, plan.length)), 1, notes.length);
    const voicing = notes.slice(0, notesPerStrum);
    // v250: guitar → kick onset lock (same ±50ms pocket as v249 bass).
    // Rock/punk rhythm guitar stabs typically land with the kick (1/3 in
    // cramps-punk); locking the guitar strums to the kick brings the
    // third rhythm-section voice into the same pocket as bass + drums.
    // Strums more than 50ms from any kick are intended syncopation —
    // left on grid. (Inline duplicate of v249's bass-lock math; will
    // extract a helper if a third agent needs the same logic.)
    const kickTimes = (ctx.events || [])
      .filter((e) => e.instrument === "kick")
      .map((e) => (e.beat || 0) * ctx.beatTime + (e.sub || 0) * ctx.subTime + (e.microMs || 0) / 1000);
    if (kickTimes.length === 0) {
      kickTimes.push(0, 2 * ctx.beatTime);
    }
    const SNAP_WINDOW_SEC = 0.050;
    plan.forEach((step) => {
      let baseOffset = step.sub * ctx.subTime + (Number(step.microMs) || 0) / 1000;
      let nearestDelta = Infinity;
      let nearestKick = null;
      for (const kt of kickTimes) {
        const d = Math.abs(kt - baseOffset);
        if (d < nearestDelta) { nearestDelta = d; nearestKick = kt; }
      }
      if (nearestKick !== null && nearestDelta <= SNAP_WINDOW_SEC) {
        baseOffset = nearestKick;
      }
      const t = time + baseOffset;
      try { guitarSynth.triggerAttackRelease(voicing, step.dur || "16n", t, step.vel); } catch (e) {}
    });
  }

  // v342: vocal expression — a singer CONNECTS notes. When the next note
  // starts within a breath of the previous one's end and the interval is
  // singable (≤5 semitones), glide into it (portamento = legato/しゃくり);
  // bigger leaps and post-rest entries re-attack cleanly. Cross-bar
  // continuity is tracked so phrases spanning a barline stay connected.
  // The mono AMSynth/Synth voice glides from its current pitch; the
  // sampler voice path ignores .portamento (instrument lead, no glide).
  let lastVocalNote = { bar: -99, endStep: 0, midi: 0 };
  function playTranscribedVocalBar(ctx, time) {
    const rows = rowsForLightTranscribedPlayback("vocal_melody", transcribedNotesForBar("vocal_melody", state.barCount));
    if (!rows.length || !voiceSynth) return false;
    rows.forEach((row) => {
      const step = Number(row[1]) || 0;
      const durSteps = Math.max(0.5, Number(row[2]) || 1);
      const midi = Number(row[3]) || 60;
      const prevAbsEnd = lastVocalNote.bar * 16 + lastVocalNote.endStep;
      const gap = (state.barCount * 16 + step) - prevAbsEnd;
      const interval = Math.abs(midi - lastVocalNote.midi);
      const legato = gap > -2 && gap < 0.9 && interval > 0 && interval <= 5;
      try { voiceSynth.portamento = legato ? 0.055 : 0; } catch (e) {}
      const t = time + step * ctx.subTime;
      const durSec = Math.max(0.06, durSteps * ctx.subTime * 0.97);
      const note = Tone.Frequency(midi, "midi").toNote();
      try { voiceSynth.triggerAttackRelease(note, durSec, t, Number(row[4]) || 0.6); } catch (e) {}
      lastVocalNote = { bar: state.barCount, endStep: step + durSteps, midi };
    });
    return true;
  }

  function triggerVoiceAgent(ctx, time) {
    // v324/v342: real melody first, sung with expression — when this song has
    // a transcribed vocal line, sing it and skip the generative contour.
    if (playTranscribedVocalBar(ctx, time)) return;
    voiceAgentPlan(ctx).forEach((step) => {
      const t = time + step.sub * ctx.subTime + (Number(step.microMs) || 0) / 1000;
      const durSec = Math.max(1, Number(step.durSteps) || 2) * ctx.subTime * 0.92;
      try { voiceSynth.triggerAttackRelease(step.note, durSec, t, step.vel); } catch (e) {}
    });
  }

  function triggerChordAgent(ctx, time) {
    // v339: AI 再構築 swaps the pad for style comping (stabs / 16th arp).
    const chordStyle = reconstructStyleFor("chords");
    if (chordStyle !== "off" && reconstructChordBar(ctx, time, chordStyle)) return;
    // v336: on transcribed songs the real guitar now plays the actual chords —
    // a full-level pad doubling the same voicings reads as mud. Duck the pad
    // to a supporting bed; songs without a transcribed guitar keep full level.
    const padDuck = hasTranscribedLine("guitar_line") ? 0.62 : 1;
    chordAgentPlan(ctx).forEach((step) => {
      const t = time + step.sub * ctx.subTime;
      const notes = aiLightRuntimeEnabled() && Array.isArray(step.notes) ? step.notes.slice(0, 2) : step.notes;
      const dur = aiLightRuntimeEnabled() && step.dur === "1n" ? "2n" : (step.dur || "4n");
      try { chordSynth.triggerAttackRelease(notes, dur, t + 0.005, step.vel * padDuck); } catch (e) {}
    });
  }

  // ---- Scheduler ----------------------------------------------

  function scheduleBar() {
    // This fires once per bar. Reads current frame's events, schedules drums.
    state.scheduledIds.push(Tone.Transport.scheduleRepeat((time) => {
      state.lastSchedulerBarAtMs = bandRoomNowMs();
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
          // v220: ramp instrumentBus gain to the new section's role target.
          // Stems mode is a no-op (instrumentBus is bypassed).
          rampInstrumentBusForSection(nowSec, time);
        }
      }

      // v220: also fire on the very first bar of the song so the intro
      // starts at its role-appropriate level instead of the default 1.0.
      if (state.barCount === 0) {
        rampInstrumentBusForSection(sec, time);
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
      // v338: transcribed performance first — when the song carries a real
      // drum transcription, the actual kit performance (incl. its own fills,
      // crashes and dynamics) plays and the pattern/fill/Dilla machinery
      // below stays silent. Songs without data fall through unchanged.
      if (isSynthMode && $("br-toggle-drums").checked && drumKit &&
          !playTranscribedDrumBar(time, subTime)) {
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

        // v209: 4-bar phrase velocity shape. Real drummers breathe across
        // phrase boundaries — slightly softer entrance into a 4-bar block,
        // peak on bar 3 to lead into the fill, ease back on bar 4 (the fill
        // does the build itself). Subtle (±6%) so it doesn't feel artificial,
        // but enough to kill the "looped" monotony of identical bars.
        const barInSection = state.barCount - state.sectionBarStart;
        const phrasePos = barInSection % 4;
        const PHRASE_VEL_MULT = [0.95, 1.00, 1.04, 0.98];
        const phraseMult = PHRASE_VEL_MULT[phrasePos];

        // v290: crash thinning. The extracted drum frames over-detect
        // crashes — librosa's band-energy classifier tagged hat / ride /
        // cymbal-bleed onsets as "crash", so each 4-bar frame carries 3-6
        // crash events that re-fire EVERY bar on repeat (~400 over the
        // song, more than the 334 kicks). That constant cymbal wall is the
        // main reason the AI 再現 reads as "all drums" (user feedback) and a
        // big source of harshness. Keep at most ONE crash per bar — the most
        // downbeat one — and in low-energy sections (verse / intro / outro)
        // only let it land on a phrase start (1 per 4 bars). Higher-energy
        // sections keep 1/bar. Real drummers crash on accents, not every
        // bar. The section-change crash (scheduleBar top) still marks
        // transitions. Playback-side only — the extracted data is untouched.
        const crashRole = String(frame.session_role || "").toLowerCase();
        const crashLowEnergy = /verse|intro|outro|end/.test(crashRole);
        const crashAllowedThisBar = !crashLowEnergy || phrasePos === 0;
        let crashKeptKey = null;
        if (crashAllowedThisBar) {
          let bestRank = Infinity;
          frame.events.forEach((e) => {
            if (e.instrument !== "crash") return;
            const rank = (Number(e.beat) || 0) * 4 + (Number(e.sub) || 0);
            if (rank < bestRank) {
              bestRank = rank;
              crashKeptKey = `${Number(e.beat) || 0}:${Number(e.sub) || 0}`;
            }
          });
        }
        let crashFiredThisBar = false;
        const lightDrumRuntime = aiLightRuntimeEnabled();

        frame.events.forEach((evt) => {
          const inst = drumKit[evt.instrument];
          if (!inst) return;
          if (lightDrumRuntime) {
            const beat = Number(evt.beat) || 0;
            const sub = Number(evt.sub) || 0;
            if (evt.instrument === "ghost" || evt.instrument === "fill") return;
            if (evt.instrument === "hat" && !(sub === 0 && (beat === 0 || beat === 2))) return;
          }
          // v290: drop the over-detected extra crashes — at most one
          // downbeat crash per bar, phrase-gated in low-energy sections.
          if (evt.instrument === "crash") {
            const key = `${Number(evt.beat) || 0}:${Number(evt.sub) || 0}`;
            if (!crashAllowedThisBar || crashFiredThisBar || key !== crashKeptKey) return;
            crashFiredThisBar = true;
          }
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
          let rawVel = clamp(evt.velocity ?? 0.5, 0.05, 1);
          // v247: backbeat groove floor — extracted drum frames have flat
          // ~0.35 velocities across the board (librosa onset detection
          // doesn't recover dynamics), which reads as "no groove" even
          // when hits land on the right beats. Rock/punk groove needs the
          // kick to slam on the downbeats (0, 2) and the snare to crack
          // on the backbeat (1, 3). Floor only — preserves dynamics where
          // the data already has them.
          if (evt.instrument === "kick" && (evt.beat === 0 || evt.beat === 2) && (evt.sub || 0) === 0) {
            rawVel = Math.max(rawVel, 0.82);
          } else if (evt.instrument === "snare" && (evt.beat === 1 || evt.beat === 3) && (evt.sub || 0) === 0) {
            rawVel = Math.max(rawVel, 0.86);
          }
          // v118: velocity humanize — ±4% perturb, accent-friendly
          // v137: mic follow scale — 演奏の音量で drum velocity を ±30% スケール
          // v209: phraseMult layers the 4-bar phrase shape on top (±6%)
          // v252: humanize widened ±4% → ±10%. v247 added backbeat velocity
          // floors (kick 0.82, snare 0.86) so the strong hits are now loud
          // and steady — the ±4% breath was too tight on top of that, the
          // drum line read as "machine-loud" rather than a human player.
          // ±10% lets the kick swing 0.74-0.90 and the snare 0.77-0.95 —
          // a real drummer's pocket dynamic without sacrificing the pocket.
          const micScale = micFollowVelocityScale();
          let vel = clamp(rawVel * micScale * phraseMult * (1 + (Math.random() - 0.5) * 0.20), 0.05, 1);
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

        // v107: 4-bar fill — every 4th bar of a section gets a fill on the
        // last quarter ("4" beat) to break the bar-loop sameness. Skip in
        // intro (too noisy) and outro (already busy).
        // v209: rotate through 4 fill patterns instead of always the same
        // tom roll. fillVariant cycles per 4-bar block within a section so
        // a 16-bar verse hears tom roll → snare build → kick-snare
        // interplay → sparse tom-tom, then repeats. Real drummers vary fills
        // bar to bar — a single repeating fill is what made the loop feel
        // "machine."
        // v217: also force a fill on the LAST bar of the section, regardless
        // of 4-bar alignment. Sections with bar counts not divisible by 4
        // (e.g. 6-bar verse, 10-bar chorus) previously had no transition
        // marker — the next section just started cold. The forced
        // section-end fill uses V3 (sparse tom-tom lead-in) to feel
        // transitional rather than busy. Skipped if the 4-bar fill is
        // already going to fire (no double-fill).
        const barsInSection = Math.max(1, Number(sec?.bars) || 1);
        const isFillBar = (barInSection + 1) % 4 === 0;
        const isSectionEnd = (barInSection === barsInSection - 1);
        const isForcedSectionEndFill = isSectionEnd && !isFillBar;
        const role = frame.session_role || "";
        if (!lightDrumRuntime && (isFillBar || isForcedSectionEndFill) && role !== "intro" && role !== "outro") {
          // Forced section-end fill always uses V3 (sparse tom-tom). The 4-bar
          // rotating fill keeps its existing fillVariant cycle.
          const fillVariant = isForcedSectionEndFill ? 3 : Math.floor(barInSection / 4) % 4;
          const tom   = drumKit.fill;
          const snare = drumKit.snare;
          const kick  = drumKit.kick;
          try {
            if (fillVariant === 0 && tom) {
              // V0: classic 4×16th tom roll on beat 4 (the v107 original).
              for (let s = 0; s < 4; s++) {
                const t = time + 3 * beatTime + s * subTime;
                tom.triggerAttackRelease("16n", t, 0.42 + s * 0.10);
              }
            } else if (fillVariant === 1 && snare) {
              // V1: snare 16th build on beat 4 — rising velocity, capping
              // on the last 16th. Punchy / driving feel.
              for (let s = 0; s < 4; s++) {
                const t = time + 3 * beatTime + s * subTime;
                snare.triggerAttackRelease("16n", t, 0.40 + s * 0.13);
              }
            } else if (fillVariant === 2 && kick && snare) {
              // V2: kick-snare alternation on beat 4 — Bonham-ish forward
              // march into the next bar's downbeat.
              [
                { i: "kick",  s: 0, vel: 0.56 },
                { i: "snare", s: 1, vel: 0.48 },
                { i: "kick",  s: 2, vel: 0.56 },
                { i: "snare", s: 3, vel: 0.68 }
              ].forEach((hit) => {
                const t = time + 3 * beatTime + hit.s * subTime;
                if (hit.i === "kick") kick.triggerAttackRelease("C1", "16n", t, hit.vel);
                else snare.triggerAttackRelease("16n", t, hit.vel);
              });
            } else if (fillVariant === 3 && tom) {
              // V3: sparse — 2 tom hits in the last half of beat 4. Leaves
              // space; counter-balances the busier V0–V2 with a tom-tom
              // lead-in feel.
              tom.triggerAttackRelease("16n", time + 3 * beatTime + 2 * subTime, 0.58);
              tom.triggerAttackRelease("16n", time + 3 * beatTime + 3 * subTime, 0.76);
            } else if (tom || snare) {
              // Fallback (kit missing voices): default to V0 with whichever exists.
              const inst = tom || snare;
              for (let s = 0; s < 4; s++) {
                const t = time + 3 * beatTime + s * subTime;
                inst.triggerAttackRelease("16n", t, 0.42 + s * 0.10);
              }
            }
          } catch (e) {}
        }

        // v106 / v247: sparse-frame reinforcement.
        // v106 fired only when fewer than 6 events existed. v247 also
        // fires when the frame has events but NONE on the strong beats
        // (e.g. Human Fly verse is just ghost+crash+hat — 8+ events, no
        // kick or snare anywhere → felt like atmospheric noise rather
        // than drumming). Intro / outro stay atmospheric on purpose.
        // Velocities bumped from 0.50/0.55 to 0.82/0.86 so the rescue
        // beat actually grooves (was previously a whisper-pulse).
        const hasStrongHit = frame.events.some((e) => {
          if (e.instrument === "kick"  && (e.beat === 0 || e.beat === 2) && (e.sub || 0) === 0) return true;
          if (e.instrument === "snare" && (e.beat === 1 || e.beat === 3) && (e.sub || 0) === 0) return true;
          return false;
        });
        const sectionRole = frame.session_role || "";
        const isAtmosphericSection = (sectionRole === "intro" || sectionRole === "outro");
        if (!isAtmosphericSection && (frame.events.length < 6 || !hasStrongHit)) {
          const basicPattern = [
            { inst: "kick",  beat: 0, vel: 0.82 },
            { inst: "snare", beat: 1, vel: 0.86 },
            { inst: "kick",  beat: 2, vel: 0.82 },
            { inst: "snare", beat: 3, vel: 0.86 }
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
      if (isSynthMode && SYNTH_REBUILD_PARTS.bass && $("br-toggle-bass").checked && synthBass && (chord || hasTranscribedLine("bass_line"))) {
        triggerBassAgent(partAgentCtx, time);
      } else if (isSynthMode && SYNTH_REBUILD_PARTS.bass && $("br-toggle-bass").checked && synthBass && !chord && state.songData?.key) {
        // v108: chord null fallback — section has no chord progression
        // (Human Fly intro/outro etc). Anchor bass to the song's key
        // root, one whole-note hit per bar, low velocity. Keeps the
        // section from feeling empty without imposing a melodic line.
        const keyRoot = state.songData.key.split(" ")[0];
        if (keyRoot) {
          try { synthBass.triggerAttackRelease(keyRoot + "2", "1n", time, 0.36); } catch (e) {}
        }
      }

      if (isSynthMode && SYNTH_REBUILD_PARTS.guitar && $("br-toggle-guitar").checked && guitarSynth && (chord || hasTranscribedLine("guitar_line")) && frame) {
        triggerGuitarAgent(partAgentCtx, time);
      }

      if (isSynthMode && SYNTH_REBUILD_PARTS.voice && $("br-toggle-voice").checked && voiceSynth && (chord || hasTranscribedLine("vocal_melody")) && frame) {
        triggerVoiceAgent(partAgentCtx, time);
      }

      if (isSynthMode && SYNTH_REBUILD_PARTS.chord && $("br-toggle-chords").checked && chordSynth && chord) {
        triggerChordAgent(partAgentCtx, time);
      }

      updateSectionDisplay();
      state.barCount++;
    }, "1m"));
  }

  // ---- Playback lifecycle -------------------------------------

  async function startPlayback(opts = {}) {
    if (state.started || state.starting) return;
    const startSeq = playbackLifecycleStopSeq;
    state.starting = true;
    setButtonState("starting");
    try {
      await yieldToUi();
      await startPlaybackBoot(Object.assign({}, opts, { startSeq }));
    } catch (e) {
      console.warn("[Band Room] startPlayback failed:", e);
      stopPlayback({ resetPosition: false, keepBackgroundBridge: false, updateMedia: true });
      releaseSustainedSynths("start-failed");
      state.started = false;
      state.starting = false;
      setButtonState("idle");
    }
  }

  async function startPlaybackBoot(opts = {}) {
    try {
      await Tone.start();
    } catch (e) {
      console.warn("[Band Room] Tone.start failed:", e);
    }
    await yieldToUi();

    if (!state.songData) {
      await loadSong(state.currentSongId);
    }
    if (!state.songData) {
      state.starting = false;
      setButtonState("idle");
      return;
    }

    ensureMaster();
    await yieldToUi();
    const backgroundBridgeStart = startBackgroundAudioBridge();
    if (currentMode === "synth") setButtonState("preparing-ai");
    await preparePlaybackAssetsForCurrentMode("start");
    await backgroundBridgeStart;
    if (!playbackStartStillAllowed(opts.startSeq)) {
      abortPlaybackStart("lifecycle-stop");
      return;
    }

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

    // Clear any old schedules. Band Room is a standalone Tone surface, so
    // cancelling the Transport here cannot touch Music Core Rig or Hazama FM.
    try { Tone.Transport.stop(); } catch (e) {}
    try { Tone.Transport.cancel(0); } catch (e) {}
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];

    resetPlaybackHealthState();
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
    requestScreenWakeLock();  // v235: keep the screen awake for stable focus listening
  }

  function playbackStartStillAllowed(startSeq) {
    if (startSeq !== playbackLifecycleStopSeq) return false;
    if (!backgroundAudioEnabled() && typeof document !== "undefined" && document.hidden) return false;
    return true;
  }

  function abortPlaybackStart(reason = "abort") {
    state.starting = false;
    state.started = false;
    setButtonState("idle");
    stopBackgroundAudioBridge();
    stopPlaybackHealthWatchdog();
    clearSuspendReleaseTimers();
    releaseSustainedSynths(reason);
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
    clearTimeout(masterMeterTimer);
    const tick = () => {
      if (!state.started) return;
      const interval = uiTelemetryIntervalMs("meter");
      // --- RMS meter ---
      const dB = masterMeter.getValue();
      const pct = Math.max(0, Math.min(100, (dB + 60) / 60 * 100));
      fill.style.width = pct.toFixed(1) + "%";
      fill.style.background = dB > -3 ? "#ff5566" : (dB > -12 ? "#ffb39a" : "#ff8866");
      // --- Spectrum ---
      const drawSpectrum = ctx && !(aiLightRuntimeEnabled() && isBandAiPlaybackMode()) &&
        !(isMobileOrStandaloneRuntime() && isBandAiPlaybackMode());
      const fft = drawSpectrum ? ensureMasterFft() : null;
      if (ctx && fft) {
        const w = canvas.width, h = canvas.height;
        const vals = fft.getValue();  // Float32Array of dB values
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
      } else if (ctx && isBandAiPlaybackMode()) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (state.started) masterMeterTimer = setTimeout(tick, interval);
    };
    tick();
  }

  function stopMasterMeter() {
    cancelAnimationFrame(masterMeterRaf);
    clearTimeout(masterMeterTimer);
    masterMeterRaf = 0;
    masterMeterTimer = 0;
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

  function stopPhraseLoops(reason = "stop") {
    phraseLoopPool.forEach((player, url) => {
      try { player.stop("+0.02"); } catch (e) {}
      try { player.dispose(); } catch (e) {}
      updatePhraseLoopUI(url, false);
    });
    phraseLoopPool.clear();
    if (reason === "reset") {
      phrasePlayerPool.forEach((player) => {
        try { player.stop(); } catch (e) {}
        try { player.dispose(); } catch (e) {}
      });
      phrasePlayerPool.clear();
    }
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

  // v236: iOS background-transition duck. Locking the iPhone screen briefly
  // throttles the AudioContext during the visibility transition — audible as
  // a short "bo-bo-bo" buffer-repeat before the background bridge re-settles
  // playback (v235 stabilised the steady state; this smooths the seam).
  // Mask it: duck the master gain to near-silence across the transition
  // window and ramp back. The whole envelope is scheduled on the audio clock
  // in one shot, so it self-completes even if JS freezes while the page is
  // hidden — it always ends back at the captured volume and so can never get
  // stuck silent. iOS-only (only iOS throttles like this) and debounced (the
  // visibilitychange / blur / pagehide burst all routes through here).
  let bgTransitionDuckAtMs = 0;
  function duckThroughBackgroundTransition() {
    if (!state.started || !masterGain || !masterGain.gain) return;
    if (!shouldPreferBackgroundAudioBridge()) return;
    if (typeof document !== "undefined" && !document.hidden) return;
    const nowMs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    if (nowMs - bgTransitionDuckAtMs < 2500) return;
    bgTransitionDuckAtMs = nowMs;
    try {
      const g = masterGain.gain;
      const restore = g.value;
      if (!(restore > 0.02)) return;  // master already silent — nothing to mask
      const t0 = Tone.context.currentTime;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(restore, t0);
      g.linearRampToValueAtTime(0.0001, t0 + 0.05);   // fast duck under the glitch
      g.setValueAtTime(0.0001, t0 + 0.60);            // hold through the throttle window
      g.linearRampToValueAtTime(restore, t0 + 0.92);  // smooth restore
    } catch (e) {}
  }

  function handlePlaybackGoingBackground(reason = "hidden") {
    if (!state.started) return;
    if (shouldStopPlaybackForBackground(reason)) {
      stopPlaybackForPageLifecycle(reason);
      return;
    }
    duckThroughBackgroundTransition();  // v236: mask the iOS lock-transition glitch
    scheduleMobileSuspendRelease(reason);
    checkBackgroundBridgeHealth(reason);
    if (shouldPreferBackgroundAudioBridge() && !backgroundBridgeActive) {
      startBackgroundAudioBridge({ force: true, rearm: true, reason });
    }
  }

  function stopPlaybackForPageLifecycle(reason = "hidden") {
    playbackLifecycleStopSeq++;
    if (state.started || state.starting) {
      stopPlayback({ resetPosition: false, keepBackgroundBridge: false, updateMedia: true });
    } else {
      stopBackgroundAudioBridge();
      updateMediaSession("paused");
    }
    releaseSustainedSynths(reason);
  }

  // v235: screen Wake Lock. iOS throttles / suspends Web Audio hard once the
  // screen sleeps — the MediaStream background-bridge fights it but can't
  // fully win (audible as pitch wobble / stutter / single-note loop in 原音
  // mode). hazamaFM dodges this with a "KEEP" wake lock; band-room never had
  // one. Hold a screen wake lock for the whole playback session so the screen
  // doesn't auto-sleep — focus listening stays in the foreground where Web
  // Audio is stable. The browser auto-releases the lock when the page is
  // hidden, so re-acquire it on every foreground return.
  async function requestScreenWakeLock() {
    if (typeof navigator === "undefined" || !navigator.wakeLock ||
        typeof navigator.wakeLock.request !== "function") return;
    if (screenWakeLock) return;
    if (typeof document !== "undefined" &&
        document.visibilityState && document.visibilityState !== "visible") return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      screenWakeLock = lock;
      lock.addEventListener?.("release", () => {
        if (screenWakeLock === lock) screenWakeLock = null;
      });
    } catch (e) {
      // NotAllowedError when the page isn't visible / user-activated — harmless.
      screenWakeLock = null;
    }
  }

  function releaseScreenWakeLock() {
    const lock = screenWakeLock;
    screenWakeLock = null;
    if (lock) {
      try { lock.release(); } catch (e) {}
    }
  }

  function handlePlaybackReturningForeground(reason = "visible") {
    clearSuspendReleaseTimers();
    if (state.started) {
      recoverPlaybackAfterSuspend(reason);
      requestScreenWakeLock();  // v235: re-acquire — the lock auto-released while hidden
    }
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
      // v207: while the tab is still hidden, skip the forced stem resync.
      // The watchdog runs every 2.5s and any brief BG context-suspend would
      // otherwise stop/restart every stem here — that hard cycle was audible
      // as occasional "音程が下ブレる" in background playback. On visibility
      // return we re-enter with reason="visible" / document.hidden=false, so
      // resync runs then to clean up any drift.
      if (!document.hidden) {
        resyncStemPlaybackToClock(reason, true);
      }
    }
  }

  function synthSchedulerStallLimitMs() {
    const bpm = Number(state.songData?.bpm) || 117;
    const barMs = (60 / Math.max(1, bpm)) * 4 * 1000;
    return Math.max(6200, barMs * 2.4);
  }

  function restartSynthTransportSchedule(reason = "ai-stall") {
    if (!state.started || !isBandAiPlaybackMode()) return false;
    const targetSec = clampPlaybackSecond(playbackContentElapsedSec());
    try { releaseSustainedSynths(reason); } catch (e) {}
    try { Tone.Transport.stop(); } catch (e) {}
    try { Tone.Transport.cancel(0); } catch (e) {}
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];
    setTimelineStateForSecond(targetSec);
    resetPlaybackClock(targetSec);
    resetPlaybackHealthState();
    scheduleBar();
    try { Tone.Transport.start("+0.03", targetSec); } catch (e) { try { Tone.Transport.start("+0.03"); } catch (err) {} }
    console.warn("[Band Room] restarted AI scheduler after stall:", reason);
    return true;
  }

  function checkSynthSchedulerHealth(reason = "watchdog") {
    if (!state.started || !isBandAiPlaybackMode()) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const duration = playbackDurationSec();
    if (duration && playbackContentElapsedSec() >= duration - 1.0) return;
    const nowMs = bandRoomNowMs();
    if (!state.lastSchedulerBarAtMs) state.lastSchedulerBarAtMs = nowMs;
    const staleMs = nowMs - state.lastSchedulerBarAtMs;
    if (staleMs < synthSchedulerStallLimitMs()) {
      state.healthStallTicks = 0;
      return;
    }
    state.healthStallTicks++;
    if (state.healthStallTicks < 2) return;
    state.healthStallTicks = 0;
    restartSynthTransportSchedule(reason);
  }

  function startPlaybackHealthWatchdog() {
    if (playbackHealthTimer) return;
    playbackHealthTimer = setInterval(() => {
      if (!state.started) return;
      const contextStopped = Tone.context && Tone.context.state !== "running";
      const transportStopped = Tone.Transport && Tone.Transport.state !== "started";
      if (contextStopped || transportStopped) {
        // v357: debounce iOS transient non-running reads. iOS Safari intermittently
        // reports the WebAudio context as not "running" while foreground + audible;
        // one bad tick must NOT hard-restart the stems (that force-resync was the
        // ~2.5s 原音 stutter on iPhone). A cheap resume() runs immediately every bad
        // tick; the destructive recover (which force-resyncs all 4 stems) only fires
        // after 2 consecutive bad ticks — a genuine sustained suspend still recovers.
        try {
          if (contextStopped && typeof Tone.context?.resume === "function") Tone.context.resume();
        } catch (e) {}
        state.watchdogRecoverTicks++;
        if (state.watchdogRecoverTicks >= 2) {
          state.watchdogRecoverTicks = 0;
          recoverPlaybackAfterSuspend("watchdog");
        }
      } else {
        state.watchdogRecoverTicks = 0;
      }
      checkBackgroundBridgeHealth("watchdog");
      checkSynthSchedulerHealth("watchdog");
      checkPolyVoicePressure("watchdog");
    }, 2500);
  }

  // v343: poly-voice pressure relief. If a PolySynth's active voice count
  // climbs past any musical need (chords/strums are short-gated — sustained
  // accumulation means churn, the 激重→無音 spiral), release everything and
  // let the next bar re-trigger cleanly. Runs on the 2.5s health watchdog.
  function checkPolyVoicePressure(reason = "watchdog") {
    [guitarSynth, chordSynth].forEach((synth) => {
      if (!synth) return;
      const active = typeof synth.activeVoices === "number" ? synth.activeVoices : 0;
      if (active > 16) {
        console.warn("[Band Room] poly voice pressure relief:", reason, active);
        try { synth.releaseAll(Tone.now()); } catch (e) {}
      }
    });
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
      state.starting = false;
      state.lastSchedulerBarAtMs = 0;
      state.healthStallTicks = 0;
      stopTransportProgress();
      stopPlaybackHealthWatchdog();
      clearSuspendReleaseTimers();
      if (!options.keepBackgroundBridge) stopBackgroundAudioBridge();
      if (options.updateMedia !== false) updateMediaSession("paused");
      return;
    }
    try { Tone.Transport.stop(); } catch (e) {}
    try { Tone.Transport.cancel(0); } catch (e) {}
    state.scheduledIds.forEach((id) => { try { Tone.Transport.clear(id); } catch (e) {} });
    state.scheduledIds = [];
    stopStemPlayback();
    stopExternalVocal();
    ["drums", "bass", "other"].forEach((s) => stopExternalStem(s)); // v87
    stopPhraseLoops("stop");
    state.started = false;
    state.starting = false;
    state.playbackStartedAtMs = 0;
    state.playbackStartedAtAudioSec = 0;
    state.playbackRateAtStart = 1;
    state.lastSchedulerBarAtMs = 0;
    state.healthStallTicks = 0;
    setTimelineStateForSecond(retainedOffsetSec);
    stopPlaybackHealthWatchdog();
    clearSuspendReleaseTimers();
    setButtonState("idle");
    stopMasterMeter();
    stopTransportProgress();
    if (!options.keepBackgroundBridge) stopBackgroundAudioBridge();
    if (options.updateMedia !== false) updateMediaSession("paused");
    stopMidiClock(); // v88
    releaseScreenWakeLock();  // v235: drop the screen wake lock
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
    } else if (s === "preparing-ai") {
      btn.textContent = "PREPARING AI";
      btn.setAttribute("aria-label", "Preparing AI playback");
    } else if (s === "starting") {
      btn.textContent = "WARMING UP";
      btn.setAttribute("aria-label", "Starting");
    } else {
      btn.textContent = "START";
      btn.setAttribute("aria-label", "Start playback");
    }
  }

  function syncModeRadioSelection(mode = currentMode) {
    const radio = document.querySelector(`input[name=br-mode][value="${mode}"]`);
    if (radio) radio.checked = true;
  }

  function setBodyPlaybackMode(mode = currentMode) {
    if (document.body) document.body.dataset.mode = mode;
    // v306: karaoke (stems) vs section-block (synth) lyric view differs by mode
    renderLyricsView();
  }

  function stopStemLayerPlayback() {
    stopStemPlayback();
    stopExternalVocal();
    ["drums", "bass", "other"].forEach((s) => stopExternalStem(s));
  }

  function startStemLayerPlayback(offsetSec) {
    startStemPlayback(offsetSec);
    startExternalVocalIfEnabled(offsetSec);
    ["drums", "bass", "other"].forEach((s) => startExternalStemIfEnabled(s, offsetSec));
  }

  async function switchStemVariant(variantKey) {
    const next = variantKey || "original";
    state.stemVariant = next;
    const selected = syncStemVariantSelect(state.currentSongId);
    if (selected.key !== next) return true;
    loadedStemsSongId = null;
    loadedStemsVariant = null;
    if (currentMode !== "stems") return true;
    const wasPlaying = state.started;
    const offsetSec = wasPlaying ? playbackContentElapsedSec() : (state.pendingSeekOffsetSec || state.playbackStartOffsetSec || 0);
    if (wasPlaying) stopStemLayerPlayback();
    const ready = await prepareStemPlaybackAssets(state.currentSongId);
    if (wasPlaying && ready) {
      resetPlaybackClock(offsetSec);
      startStemLayerPlayback(offsetSec);
      setButtonState("playing");
    }
    return ready;
  }

  async function switchPlaybackMode(newMode) {
    if (newMode !== "stems" && newMode !== "synth") return false;
    const oldMode = currentMode;
    if (newMode === oldMode) {
      syncModeRadioSelection(oldMode);
      return true;
    }
    if (state.starting && !state.started) {
      syncModeRadioSelection(oldMode);
      return false;
    }
    const switchSeq = ++modeSwitchSeq;

    if (!state.started) {
      currentMode = newMode;
      setBodyPlaybackMode(currentMode);
      syncModeRadioSelection(currentMode);
      return true;
    }

    const busyText = newMode === "synth" ? "preparing AI..." : "loading stems...";
    setTrackSelectorBusy(true, busyText);
    if (newMode === "synth") {
      setButtonState("preparing-ai");
      const kitStatus = $("br-kit-status");
      if (kitStatus) kitStatus.textContent = "preparing AI...";
    } else {
      setStemsStatus("loading stems...");
    }

    try {
      if (newMode === "synth") {
        const ready = await prepareSynthPlaybackAssets("mode-switch");
        if (switchSeq !== modeSwitchSeq) return false;
        if (!state.started) {
          currentMode = "synth";
          setBodyPlaybackMode(currentMode);
          syncModeRadioSelection(currentMode);
          setButtonState("idle");
          return true;
        }
        if (!ready) throw new Error("AI assets unavailable");
        const offsetSec = playbackContentElapsedSec();
        stopStemLayerPlayback();
        currentMode = "synth";
        setBodyPlaybackMode(currentMode);
        resetPlaybackClock(offsetSec);
      } else {
        const ready = await prepareStemPlaybackAssets(state.currentSongId);
        if (switchSeq !== modeSwitchSeq) return false;
        if (!state.started) {
          currentMode = "stems";
          setBodyPlaybackMode(currentMode);
          syncModeRadioSelection(currentMode);
          setButtonState("idle");
          return true;
        }
        if (!ready) throw new Error("stems unavailable");
        const offsetSec = playbackContentElapsedSec();
        releaseSustainedSynths("mode-switch-stems");
        scheduleSynthBandTeardown(); // v354: free the synth band's always-on FX so it stops costing during 原音
        currentMode = "stems";
        setBodyPlaybackMode(currentMode);
        resetPlaybackClock(offsetSec);
        startStemLayerPlayback(offsetSec);
      }
      syncModeRadioSelection(currentMode);
      setButtonState("playing");
      return true;
    } catch (e) {
      console.warn("[Band Room] mode switch failed:", e);
      currentMode = oldMode;
      setBodyPlaybackMode(currentMode);
      syncModeRadioSelection(currentMode);
      setButtonState(state.started ? "playing" : "idle");
      if (newMode === "synth") {
        const kitStatus = $("br-kit-status");
        if (kitStatus) kitStatus.textContent = "AI prep failed: " + (e.message || e);
      } else {
        setStemsStatus("stem load failed: " + (e.message || e));
      }
      return false;
    } finally {
      if (switchSeq === modeSwitchSeq) setTrackSelectorBusy(false);
    }
  }

  function removeBandRoomAudioState(reason = "reset") {
    BANDROOM_AUDIO_STATE_KEYS.forEach((key) => safeLocalStorageRemove(key));
    safeLocalStorageSet(BANDROOM_STORAGE_SCHEMA_KEY, String(BANDROOM_STORAGE_SCHEMA_VERSION));
    console.info("[Band Room] local audio state cleared", { reason, keys: BANDROOM_AUDIO_STATE_KEYS });
  }

  function stopRecordersForReset() {
    try {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
    } catch (e) {}
    Object.values(stemRecorders).forEach((rec) => {
      try {
        if (rec && rec.state === "recording") rec.stop();
      } catch (e) {}
    });
  }

  function resetBandRoomAudioState(reason = "manual-reset") {
    const btn = $("br-reset-audio");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "RESETTING";
    }
    stopRecordersForReset();
    stopPlayback({ resetPosition: true, keepBackgroundBridge: false, updateMedia: true });
    stopPhraseLoops("reset");
    releaseSustainedSynths(reason);
    disableMicFollow();
    removeBandRoomAudioState(reason);
    updateBootDiagnostics("audio-state-reset");
    const url = new URL(window.location.href);
    url.searchParams.set("safe", "1");
    window.location.replace(url.toString());
  }

  // ---- UI bindings --------------------------------------------

  function bindUI() {
    $("br-play")?.addEventListener("click", togglePlay);
    $("br-reset-audio")?.addEventListener("click", () => resetBandRoomAudioState("manual-reset"));
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

    // v260: voice toggle off → disable voice volume slider so the UI doesn't
    // look "set but does nothing." Mirrors the v254 voice-off default — without
    // this, the slider stays draggable while the part is silent, which was
    // confusing ("動かしてるのに鳴らない"). HTML `disabled` greys out the
    // control natively, no CSS needed.
    const voiceToggleEl = $("br-toggle-voice");
    const voiceVolEl = $("br-vol-voice");
    const syncVoiceVolEnabled = () => {
      if (voiceVolEl && voiceToggleEl) voiceVolEl.disabled = !voiceToggleEl.checked;
    };
    if (voiceToggleEl) {
      voiceToggleEl.addEventListener("change", syncVoiceVolEnabled);
      syncVoiceVolEnabled();
    }
    ["drums", "bass", "guitar", "voice", "chords", "click"].forEach((part) => {
      const el = $("br-toggle-" + part);
      if (!el) return;
      el.addEventListener("change", async () => {
        if (!el.checked || currentMode !== "synth" || !state.started) return;
        await prepareSynthPlaybackAssets("toggle");
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
          // muddy the top end with the 0.09 distortion setting)
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
    let masterVolValue = 100;
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
    const MASTER_VOL_KEY = BANDROOM_MASTER_VOL_KEY;
    const masterVolEl = $("br-master-vol");
    const masterVolReadout = $("br-master-vol-readout");
    const masterVolDown = $("br-master-vol-down");
    const masterVolUp = $("br-master-vol-up");
    let masterVolBase = 1.2; // matches initial Tone.Gain(1.2) in ensureMaster()

    function masterVolGainFromValue(value) {
      // v202: louder system output — was 80→0.90 / 100→1.25.
      // 0 → 0, 80 → 1.2, 100 → 1.8 — drives the −1 dBFS limiter harder so
      // band-room sits closer to other apps' loudness.
      const v = Math.max(0, Math.min(100, Number(value) || 0));
      if (v <= 80) return (v / 80) * masterVolBase;
      return masterVolBase + ((v - 80) / 20) * (1.8 - masterVolBase);
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
      safeLocalStorageSet(MASTER_VOL_KEY, String(v));
    }

    // Restore persisted volume on init (v202: default 100 — max by default;
    // MASTER_VOL_KEY bumped to .v2 so stale low values don't keep it quiet)
    let savedVol = 100;
    try {
      const raw = safeLocalStorageGet(MASTER_VOL_KEY);
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
        await ensureMidiRuntime();
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

    const stemVariantSel = $("br-stems-variant-select");
    if (stemVariantSel) {
      stemVariantSel.addEventListener("change", async () => {
        stemVariantSel.disabled = true;
        try {
          await switchStemVariant(stemVariantSel.value);
        } finally {
          syncStemVariantSelect(state.currentSongId);
        }
      });
    }
    syncStemVariantSelect(state.currentSongId);

    // Mode radio (stems vs synth)
    document.querySelectorAll("input[name=br-mode]").forEach((radio) => {
      radio.addEventListener("change", async () => {
        if (!radio.checked) return;
        await switchPlaybackMode(radio.value);
      });
    });
    setBodyPlaybackMode(currentMode);
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
    if (bandIds.length === 1) {
      const band = state.bandsRegistry.bands[bandIds[0]];
      group.dataset.mode = "album";
      const plaque = document.createElement("div");
      plaque.className = "br-album-plaque";
      plaque.setAttribute("aria-label", "Album");
      const label = document.createElement("span");
      label.className = "br-album-plaque__label";
      label.textContent = "album";
      const title = document.createElement("span");
      title.className = "br-album-plaque__title";
      title.textContent = band?.name || bandIds[0];
      plaque.appendChild(label);
      plaque.appendChild(title);
      group.appendChild(plaque);
      renderTrackButtons();
      updateSubtitle();
      return;
    }
    group.dataset.mode = "selector";
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
      const rawSubtitle = `${band.subtitle || band.name || ""}`.trim();
      const subtitle = rawSubtitle.replace(/^air rock connect box\s*[·-]\s*/i, "").trim();
      el.textContent = subtitle;
      el.hidden = subtitle.length === 0;
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
        if (!shouldRebuildSynthControlNow()) {
          if (status) status.textContent = `${voice}: ${sel.value || "(base)"} (applies on AI start)`;
          schedulePrefsSave();
          return;
        }
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
        if (!shouldRebuildSynthControlNow()) {
          markSynthControlDeferred(status, "chord", sel.value);
          schedulePrefsSave();
          return;
        }
        if (status) status.textContent = `chord: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (chordSynth) { try { chordSynth.dispose(); } catch (e) {} }
          chordSynth = await makeChordSynth(chordBus);  // v270: async
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
        if (!shouldRebuildSynthControlNow()) {
          markSynthControlDeferred(status, "bass", sel.value);
          schedulePrefsSave();
          return;
        }
        if (status) status.textContent = `bass: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (synthBass) { try { synthBass.dispose(); } catch (e) {} }
          synthBass = await makeSynthBass(bassBus);  // v270: async
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
        if (!shouldRebuildSynthControlNow()) {
          markSynthControlDeferred(status, "guitar", sel.value);
          schedulePrefsSave();
          return;
        }
        if (status) status.textContent = `guitar: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (guitarSynth) { try { guitarSynth.dispose(); } catch (e) {} }
          guitarSynth = await makeGuitar(guitarBus);  // v270: async
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
        if (!shouldRebuildSynthControlNow()) {
          markSynthControlDeferred(status, "melody lead", sel.value);
          schedulePrefsSave();
          return;
        }
        if (status) status.textContent = `melody lead: ${sel.value || "synth"} — rebuilding…`;
        try {
          if (voiceSynth) { try { voiceSynth.dispose(); } catch (e) {} }
          voiceSynth = await makeVoiceBox(voiceBus);  // v270: async
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
    // v260: dedupe — tone-acoustic is now in KIT_OPTIONS as the explicit default
    // (so the dropdown surfaces it at the top with a clear "(default)" label).
    // Skip catalog entries whose value matches a local KIT_OPTIONS entry to
    // avoid showing the same kit twice.
    if (state.onlineCatalog && state.onlineCatalog.kits) {
      const localKitValues = new Set(KIT_OPTIONS.map((k) => k.value));
      const onlineExtras = state.onlineCatalog.kits.filter((kit) => !localKitValues.has("online/" + kit.id));
      if (onlineExtras.length) {
        const sep = document.createElement("option");
        sep.disabled = true;
        sep.textContent = "─── online (CDN) ───";
        sel.appendChild(sep);
        onlineExtras.forEach((kit) => {
          const o = document.createElement("option");
          o.value = "online/" + kit.id;
          o.textContent = "🌐 " + kit.label;
          if (o.value === state.kitSource) o.selected = true;
          sel.appendChild(o);
        });
      }
    }
    sel.addEventListener("change", async () => {
      const newSource = sel.value;
      const status = $("br-kit-status");
      state.kitSource = newSource;
      if (!shouldRebuildSynthControlNow()) {
        if (status) status.textContent = `kit: ${newSource} (applies on AI start)`;
        schedulePrefsSave();
        return;
      }
      if (status) status.textContent = "loading kit…";
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
          safeLocalStorageSet("band-room.custom-kits.v1", JSON.stringify(customs));
        } catch (e) {}
        renderKitOptions();
        renderVoiceOverridesGrid();
        const s = $("br-custom-kit-status");
        if (s) s.textContent = `追加: online/${kit.id}`;
      });
    }

    // v102: restore custom kits from localStorage
    try {
      const raw = safeLocalStorageGet("band-room.custom-kits.v1");
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
        if (!shouldRebuildSynthControlNow()) {
          if (status) status.textContent = "overrides cleared (applies on AI start)";
          schedulePrefsSave();
          return;
        }
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
    // v339/v340: AI 再構築 — synth-mode only (stems untouched); session-only
    // by design (reload returns to the faithful AI 再現). v340 matrix: the
    // mode-row master select sets ALL parts at once; the per-part selects in
    // the sound-mix panel let each band member pick their own style
    // (忠実 = "off" = transcribed performance). The kit profile follows the
    // DRUMS part's style (lcd → lcd-motorik, sakanaction → sakanaction).
    const RECONSTRUCT_PART_IDS = {
      drums: "br-reconstruct-drums",
      bass: "br-reconstruct-bass",
      guitar: "br-reconstruct-guitar",
      chords: "br-reconstruct-chords"
    };
    function normalizeReconstructValue(v) {
      return v === "lcd" || v === "sakanaction" ? v : "off";
    }
    function applyDrumStyleKitProfile() {
      const profileByStyle = { lcd: "lcd-motorik", sakanaction: "sakanaction" };
      const linked = profileByStyle[reconstructParts.drums];
      const psel = $("br-kit-profile-select");
      if (linked && psel && psel.value !== linked) {
        psel.value = linked;
        psel.dispatchEvent(new Event("change"));
      }
    }
    Object.entries(RECONSTRUCT_PART_IDS).forEach(([part, id]) => {
      const sel = $(id);
      if (!sel) return;
      sel.addEventListener("change", () => {
        reconstructParts[part] = normalizeReconstructValue(sel.value);
        if (part === "drums") applyDrumStyleKitProfile();
      });
    });
    const reconstructSel = $("br-reconstruct-style");
    if (reconstructSel) {
      reconstructSel.addEventListener("change", () => {
        const style = normalizeReconstructValue(reconstructSel.value);
        Object.entries(RECONSTRUCT_PART_IDS).forEach(([part, id]) => {
          reconstructParts[part] = style;
          const sel = $(id);
          if (sel) sel.value = style;
        });
        applyDrumStyleKitProfile();
      });
    }

    const profileSel = $("br-kit-profile-select");
    if (profileSel) {
      profileSel.value = state.kitProfile || "default";
      profileSel.addEventListener("change", async () => {
        // v215: distinguish manual user pick from applyRecommendedKitProfile's
        // programmatic change. Without this, the first auto-apply would set
        // state.kitProfile to e.g. "sakanaction" and look like an explicit
        // user pick — locking out auto-mapping for subsequent songs.
        // Picking "default" manually means "auto-pick mode" → reset the flag.
        if (!state.__kitProfileAutoApplying) {
          state.kitProfileExplicitlyChosen = (profileSel.value !== "default");
        }
        state.kitProfile = profileSel.value;
        const status = $("br-kit-status");
        if (!shouldRebuildSynthControlNow()) {
          if (status) status.textContent = `profile: ${profileSel.value} (applies on AI start)`;
          schedulePrefsSave();
          return;
        }
        if (status) status.textContent = `applying profile: ${profileSel.value}…`;
        try {
          // Rebuild bass/chord/vocal — always synth, always affected
          if (synthBass) { try { synthBass.dispose(); } catch (e) {} }
          synthBass = await makeSynthBass(bassBus);  // v270: async
          if (chordSynth) { try { chordSynth.dispose(); } catch (e) {} }
          chordSynth = await makeChordSynth(chordBus);  // v270: async
          if (voiceSynth) { try { voiceSynth.dispose(); } catch (e) {} }
          voiceSynth = await makeVoiceBox(voiceBus);  // v270: async
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
      const album = "Band Room — Air Rock Connect Box";
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
  const PREFS_KEY = BANDROOM_PREFS_KEY;
  const MIX_PREFS_VERSION = "v342-vocal-on";
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
  // v254: AI 再現 default-parts migration. The procedural voice agent
  // synthesises a chord-tone melody that doesn't sound like a real vocal
  // line — with all 5 parts on, the AI 再現 reads as a wall of texture
  // rather than music. Defaulting voice OFF makes the baseline a 4-piece
  // instrumental (drums + bass + guitar + chord pad), which sits more
  // naturally as music. Users who want to hear the synth lead can enable
  // it in the UI; the toggle stays. Only flips users who had the old
  // default (true) — customised values (already false) are left alone.
  const V254_DEFAULT_TOGGLES_MIGRATION = {
    // v254 turned the (then-generative, noisy) voice OFF. v342: the voice
    // sings the real transcribed melody now — flip the v254-era OFF back ON.
    // Same caveat as every default migration: only saved values matching the
    // old default move; post-migration manual choices stick.
    "br-toggle-voice": { old: false, current: true }
  };
  // v255: chord pad volume reduction. With voice now OFF (v254), the
  // 4-piece baseline is drums + bass + guitar + chord. The chord pad's
  // sustained synth-wash texture is the LEAST authentic element for
  // cramps-punk and tends to mud-mask the bass + guitar lock that v249
  // and v250 built up. Drop the chord vol default 58 → 40 (~30% softer)
  // so chord sits as background harmonic colour instead of competing
  // with the rhythm-section foreground. Only flips users still at the
  // v168 default 58 — anyone who customised away from 58 keeps theirs.
  const V255_CHORD_REDUCTION_MIGRATION = {
    "br-vol-chords": { old: "58", current: "40" }
  };
  // v259: synth-drums → acoustic-drums migration. The procedural rhythm
  // & structure refinements (v247-v257) couldn't escape the "synth fake"
  // perception because the drum SOURCE was synth. Switching the default
  // to the CDN-streamed acoustic Tone.js kit gives real kick/snare/hat
  // samples — the single biggest "生音" lift. Conditional: only users
  // whose saved kitSource is still the old "synth" default flip; anyone
  // who picked a specific kit (e.g. a song sample or another online kit)
  // keeps theirs.
  const V259_KIT_SOURCE_MIGRATION = {
    old: "synth",
    current: "online/tone-acoustic"
  };
  // v262: chord pad → Salamander Grand Piano (CDN). Same "生音" thread —
  // v259 took drums to real samples; chord pad was the last fake-electronic
  // element in the 4-piece AI 再現 baseline. Piano's natural attack/decay
  // arc complements the v257 whole-note sustain so the chord rings out
  // the bar instead of pad-flat. Conditional: only users whose saved
  // chordInstrument is null or "" (the v101 synth default or a master
  // preset's explicit "use synth" override that landed at "") flip to
  // salamander-piano; anyone who picked a specific catalog instrument
  // (e.g. casio-synth, salamander-piano already, etc.) keeps theirs.
  const V262_CHORD_INSTRUMENT_MIGRATION = {
    olds: [null, ""],
    current: "salamander-piano"
  };
  // v265: guitarInstrument null/"" → "guitar-acoustic". 2026 re-audit
  // showed the CDN samples are fully servable now (11/11 notes); v231
  // had blanket-deprecated them. Same conditional pattern as v262: only
  // flips the null/"" defaults; users who chose another instrument keep
  // theirs.
  const V265_GUITAR_INSTRUMENT_MIGRATION = {
    olds: [null, ""],
    current: "guitar-acoustic"
  };
  // v267: bassInstrument null/"" → "bass-electric". Catalog was corrected
  // (v97 had wrong note pattern; v267 aligned to the actual 17 github
  // files). bass-electric is now fully servable. This closes the last
  // synth-only part in the AI 再現 baseline — drums + bass + guitar +
  // chord are all real samples (voice intentionally OFF).
  const V267_BASS_INSTRUMENT_MIGRATION = {
    olds: [null, ""],
    current: "bass-electric"
  };
  // v289: AI 再現 mix rebalance for harmonic presence. User feedback on
  // Human Fly: "bass intro, then mostly only drums." Offline render showed
  // guitar+chord ~10 dB under drums. v255 (chord → background 40) + v254
  // (voice OFF) tuned a rhythm-section-forward balance against the SYNTH
  // kit; v259 then swapped in punchier acoustic drums and the harmonic
  // foreground got buried. Restore it: guitar 56 → 70 (the intended
  // foreground partner of bass), chord 40 → 52 (present harmonic bed, not
  // the v255 background wash — context changed), drums 58 → 52 (back off
  // the acoustic punch). Voice stays OFF (v254). Only flips users still at
  // each part's untouched current default; customised values are kept.
  const V289_MIX_REBALANCE_MIGRATION = {
    "br-vol-drums":  { old: "58", current: "52" },
    "br-vol-guitar": { old: "56", current: "70" },
    "br-vol-chords": { old: "40", current: "52" }
  };
  const V298_HUMAN_FLY_PRESENCE_MIGRATION = {
    "br-vol-drums":  { old: "52", current: "48" },
    "br-vol-bass":   { old: "66", current: "72" },
    "br-vol-guitar": { old: "70", current: "76" },
    "br-vol-chords": { old: "52", current: "56" }
  };
  const V301_HUMAN_FLY_BODY_MIGRATION = {
    "br-vol-drums":  { old: "48", current: "44" },
    "br-vol-bass":   { old: "72", current: "80" },
    "br-vol-guitar": { old: "76", current: "82" },
    "br-vol-chords": { old: "56", current: "62" }
  };
  const V312_SPACIOUS_VOCAL_AIR_MIGRATION = {
    "br-vol-stem-vocals": { old: "68", current: "59" },
    "br-vfx-chorus":      { old: "22", current: "11" },
    "br-vfx-delay":       { old: "12", current: "0" },
    "br-vfx-reverb":      { old: "20", current: "13" },
    "br-space-reverb":    { old: "16", current: "18" },
    "br-space-width":     { old: "62", current: "68" },
    "br-tape-warmth":     { old: "7", current: "8" }
  };
  const V313_BAND_FORWARD_VOCAL_WIDE_MIGRATION = {
    "br-vol-stem-vocals": { old: "59", current: "52" },
    "br-vol-stem-drums":  { old: "86", current: "88" },
    "br-vol-stem-bass":   { old: "86", current: "88" },
    "br-vol-stem-other":  { old: "84", current: "88" },
    "br-vfx-chorus":      { old: "11", current: "16" },
    "br-vfx-reverb":      { old: "13", current: "16" },
    "br-space-reverb":    { old: "18", current: "20" },
    "br-space-width":     { old: "68", current: "72" },
    "br-tape-warmth":     { old: "8", current: "9" }
  };
  const V317_DRUM_PRESSURE_MIGRATION = {
    "br-vol-stem-drums": { olds: ["88"], current: "92" },
    "br-vol-drums":      { olds: ["44", "48"], current: "52" }
  };
  const V318_GUITAR_SPARK_PRESSURE_MIGRATION = {
    "br-vol-stem-other": { olds: ["88"], current: "91" },
    "br-vol-guitar":     { olds: ["76", "82"], current: "88" }
  };
  const V319_BASS_VOCAL_PRESSURE_MIGRATION = {
    "br-vol-stem-vocals": { olds: ["52"], current: "55" },
    "br-vol-stem-bass":   { olds: ["88"], current: "91" },
    "br-vol-bass":        { olds: ["72", "80"], current: "84" }
  };

  function readRawStoredPrefs() {
    const raw = safeLocalStorageGet(PREFS_KEY);
    if (!raw) return null;
    try {
      const prefs = JSON.parse(raw);
      return prefs && typeof prefs === "object" && !Array.isArray(prefs) ? prefs : null;
    } catch (e) {
      return null;
    }
  }

  function applyBandRoomStorageBootPolicy() {
    let reason = "ok";
    const rawPrefs = readRawStoredPrefs();
    const storedSchema = Number(rawPrefs?.storageSchemaVersion || safeLocalStorageGet(BANDROOM_STORAGE_SCHEMA_KEY) || 0);
    const schemaIsCurrent = storedSchema === BANDROOM_STORAGE_SCHEMA_VERSION;

    if (BANDROOM_SAFE_BOOT) {
      removeBandRoomAudioState("safe-query");
      return "safe-query-reset";
    }

    if (BANDROOM_BOOT_MODE === "standalone" && !schemaIsCurrent) {
      removeBandRoomAudioState(`standalone-schema-${storedSchema || "none"}`);
      return "standalone-schema-reset";
    }

    if (!schemaIsCurrent) reason = "schema-upgraded";
    safeLocalStorageSet(BANDROOM_STORAGE_SCHEMA_KEY, String(BANDROOM_STORAGE_SCHEMA_VERSION));
    return reason;
  }

  function loadPrefs() {
    const prefs = readRawStoredPrefs();
    return sanitizePrefsForBoot(prefs);
  }

  function migratePrefsForCurrentMix(prefs) {
    if (!prefs || prefs.mixPrefsVersion === MIX_PREFS_VERSION) return prefs;
    const next = {
      ...prefs,
      sliders: { ...(prefs.sliders || {}) },
      toggles: { ...(prefs.toggles || {}) },
      storageSchemaVersion: BANDROOM_STORAGE_SCHEMA_VERSION,
      mixPrefsVersion: MIX_PREFS_VERSION
    };
    let changed = prefs.mixPrefsVersion !== MIX_PREFS_VERSION;
    Object.entries(V167_DEFAULT_MIX_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    // v254: toggle defaults migration. Only flips toggles whose saved value
    // matches the OLD default — if the user already customised, leave alone.
    Object.entries(V254_DEFAULT_TOGGLES_MIGRATION).forEach(([id, rule]) => {
      if (next.toggles[id] === rule.old) {
        next.toggles[id] = rule.current;
        changed = true;
      }
    });
    // v255: chord pad volume reduction. Runs AFTER V167 (which lifted
    // chord 68 → 58); chains so a pre-v168 user at 58 (after V167 ran)
    // continues to v255's 40 in the same migration pass.
    Object.entries(V255_CHORD_REDUCTION_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    // v259: kitSource migration — synth → online/tone-acoustic for "生音".
    // kitSource lives at top-level of prefs (not in sliders/toggles).
    if (next.kitSource === V259_KIT_SOURCE_MIGRATION.old) {
      next.kitSource = V259_KIT_SOURCE_MIGRATION.current;
      changed = true;
    }
    // v262: chordInstrument migration — null/"" → salamander-piano. Same
    // top-level pref. The applyPrefs reader uses `prefs.chordInstrument || null`
    // (treats "" as null), but here we explicitly cover both forms so the
    // saved value becomes the new explicit default in localStorage.
    if (Object.prototype.hasOwnProperty.call(next, "chordInstrument")
        && V262_CHORD_INSTRUMENT_MIGRATION.olds.includes(next.chordInstrument)) {
      next.chordInstrument = V262_CHORD_INSTRUMENT_MIGRATION.current;
      changed = true;
    }
    // v265: guitarInstrument migration — same shape as v262 above.
    if (Object.prototype.hasOwnProperty.call(next, "guitarInstrument")
        && V265_GUITAR_INSTRUMENT_MIGRATION.olds.includes(next.guitarInstrument)) {
      next.guitarInstrument = V265_GUITAR_INSTRUMENT_MIGRATION.current;
      changed = true;
    }
    // v267: bassInstrument migration — completes the 生音 5/5.
    if (Object.prototype.hasOwnProperty.call(next, "bassInstrument")
        && V267_BASS_INSTRUMENT_MIGRATION.olds.includes(next.bassInstrument)) {
      next.bassInstrument = V267_BASS_INSTRUMENT_MIGRATION.current;
      changed = true;
    }
    // v289: mix rebalance. Runs LAST so it chains off the values V167/V255
    // already settled (drums/guitar at the V167 current, chord at V255's
    // 40). Only untouched defaults move; customised sliders are preserved.
    Object.entries(V289_MIX_REBALANCE_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V298_HUMAN_FLY_PRESENCE_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V301_HUMAN_FLY_BODY_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V312_SPACIOUS_VOCAL_AIR_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V313_BAND_FORWARD_VOCAL_WIDE_MIGRATION).forEach(([id, rule]) => {
      if (String(next.sliders[id]) === rule.old) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V317_DRUM_PRESSURE_MIGRATION).forEach(([id, rule]) => {
      if ((rule.olds || []).includes(String(next.sliders[id]))) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V318_GUITAR_SPARK_PRESSURE_MIGRATION).forEach(([id, rule]) => {
      if ((rule.olds || []).includes(String(next.sliders[id]))) {
        next.sliders[id] = rule.current;
        changed = true;
      }
    });
    Object.entries(V319_BASS_VOCAL_PRESSURE_MIGRATION).forEach(([id, rule]) => {
      if ((rule.olds || []).includes(String(next.sliders[id]))) {
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
        storageSchemaVersion: BANDROOM_STORAGE_SCHEMA_VERSION,
        mixPrefsVersion: MIX_PREFS_VERSION,
        // v205: mode intentionally NOT persisted — band-room always opens in
        // 原音 (stems); AI 再現 is still WIP, don't land users in it.
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
      safeLocalStorageSet(PREFS_KEY, JSON.stringify(prefs));
      safeLocalStorageSet(BANDROOM_STORAGE_SCHEMA_KEY, String(BANDROOM_STORAGE_SCHEMA_VERSION));
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
    // v205: mode is NOT restored — band-room always opens in 原音 (stems).
    // AI 再現 is still WIP; landing users in the unfinished mode confuses.
    // Kit source (select)
    // v208: silently retire saved "auto-self" — the song-extracted sample
    // kits sound raw / amateur (Demucs bleed + onset artifacts) and that's
    // exactly what made AI 再現 drums sound 壊滅的.
    // v259: target updated synth → online/tone-acoustic. v259 also flipped
    // saved "synth" users to the acoustic CDN kit (the "生音" default) via
    // migratePrefsForCurrentMix; auto-self users skip that migration so
    // they need their own bridge straight to the new default. Users can
    // still pick auto-self / synth back from the dropdown.
    if (prefs.kitSource === "auto-self") {
      prefs.kitSource = "online/tone-acoustic";
    }
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
      // v267: the v231 force-to-null for "bass-electric" was removed.
      // Root cause of the v231 "unservable" was a CATALOG note-name bug
      // (v97 listed F#/A in low octaves that the upstream repo doesn't
      // ship); the github files were always there, just under different
      // pitch names (A#/C#/E/G). v267 corrected the catalog to 17 actual
      // mp3s and made bass-electric the AI 再現 default. Saved user prefs
      // that still read "bass-electric" (from pre-v231) now persist.
      const sel = $("br-bass-instrument-select");
      if (sel) {
        sel.value = state.bassInstrument || "";
        sel.dispatchEvent(new Event("change"));
      }
    }
    // v111: guitar instrument
    if (Object.prototype.hasOwnProperty.call(prefs, "guitarInstrument")) {
      state.guitarInstrument = prefs.guitarInstrument || null;
      // v265: the v231 force-to-null for "guitar-electric" was removed.
      // 2026 re-audit: 8/13 sample notes are servable (only midrange
      // C#3/E3/C#4/E4/C#5 still 403); Tone.Sampler interpolates the gaps
      // well enough that users who want the gritty electric tone can
      // pick it from the dropdown and have it persist. bass-electric is
      // NOT re-enabled — its 403s land squarely on the bass core range
      // (F#1/A1/F#2/A2) which Sampler can't interpolate cleanly.
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
    let magenta = typeof mm !== "undefined" ? mm : (typeof window !== "undefined" ? window.mm : null);
    if (!magenta?.MusicRNN) {
      setAiFillStatus("loading Magenta runtime...");
      try {
        magenta = await ensureMagentaRuntime();
      } catch (e) {
        console.warn("[Band Room] Magenta runtime load failed:", e);
        setAiFillStatus("error: @magenta/music not loaded (offline?)");
        return null;
      }
    }
    if (!magenta?.MusicRNN) {
      setAiFillStatus("error: @magenta/music not loaded (offline?)");
      return null;
    }
    setAiFillStatus("loading Magenta DrumsRNN model…");
    try {
      aiDrumRnn = new magenta.MusicRNN(
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
    const magenta = typeof mm !== "undefined" ? mm : (typeof window !== "undefined" ? window.mm : null);
    return new magenta.NoteSequence({
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
        safeLocalStorageSet(FM_LINKED_GENRE_KEY, genre);
        safeLocalStorageSet(FM_LINKED_GENRE_AT_KEY, String(at));
      } else {
        genre = safeLocalStorageGet(FM_LINKED_GENRE_KEY) || "";
        at = Number(safeLocalStorageGet(FM_LINKED_GENRE_AT_KEY) || 0);
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

  window.addEventListener("beforeunload", () => {
    stopPlaybackForPageLifecycle("beforeunload");
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

  function updateBootDiagnostics(storageStatus = "ok") {
    const controlled = !!navigator.serviceWorker?.controller;
    const label = `${BANDROOM_APP_VERSION} / ${BANDROOM_BOOT_MODE} / storage:${storageStatus}`;
    const el = $("br-boot-status");
    if (el) {
      el.textContent = label;
      el.title = `Band Room ${label}${controlled ? " / sw:controlled" : " / sw:uncontrolled"}`;
    }
    window.BandRoomBoot = {
      appVersion: BANDROOM_APP_VERSION,
      storageSchemaVersion: BANDROOM_STORAGE_SCHEMA_VERSION,
      bootMode: BANDROOM_BOOT_MODE,
      safeBoot: BANDROOM_SAFE_BOOT,
      storageStatus,
      serviceWorkerControlled: controlled
    };
    console.info("[Band Room] boot", window.BandRoomBoot);
  }

  window.addEventListener("DOMContentLoaded", async () => {
    const storageStatus = applyBandRoomStorageBootPolicy();
    bindUI();
    updateBootDiagnostics(storageStatus);
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
