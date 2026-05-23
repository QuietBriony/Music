/* =========================================================
   UCM Mandala Engine v3.0 Lite
   Tone.js × Tidal風 × 観フェーダー同期（軽量化版）
   - Instruments削減
   - FX簡略化
   - スケジューリング最適化
========================================================= */

/* --------------------
   0. UCM 状態
-------------------- */

const UCM = {
  energy:   40, // 静 ⇄ 動
  wave:     40, // リズム揺らぎ
  mind:     50, // 和声・テンション
  creation: 50, // サウンド変化
  void:     20, // 休符量
  circle:   60, // 滑らかさ
  body:     50, // 低域
  resource: 60, // 密度
  observer: 50, // 空間

  auto: {
    enabled: false,
    timer: null,
    phase: 0,
    cycleMs: 180000,
    lastTransportStep: -1,
  }
};

// --- Smoothing state (v1.3) ---
// Sliders/presets write into UCM_TARGET.
// Engine reads a smoothed UCM_CUR so visuals + audio don't jump.
const UCM_TARGET = { energy: UCM.energy, wave: UCM.wave, mind: UCM.mind, creation: UCM.creation, void: UCM.void, circle: UCM.circle, body: UCM.body, resource: UCM.resource, observer: UCM.observer };
const UCM_CUR    = { energy: UCM.energy, wave: UCM.wave, mind: UCM.mind, creation: UCM.creation, void: UCM.void, circle: UCM.circle, body: UCM.body, resource: UCM.resource, observer: UCM.observer };
const UCM_KEYS = ["energy", "wave", "mind", "creation", "void", "circle", "body", "resource", "observer"];
const AUTOMIX_MOTION_KEYS = ["energy", "wave", "mind", "creation", "void", "circle", "body", "resource", "observer"];
const SLIDER_BY_UCM = {
  energy: "fader_energy",
  wave: "fader_wave",
  mind: "fader_mind",
  creation: "fader_creation",
  void: "fader_void",
  circle: "fader_circle",
  body: "fader_body",
  resource: "fader_resource",
  observer: "fader_observer"
};
const AUTOMIX_PROFILE = {
  energy: { base: 48, depth: 26, phase: 0.00, step: 3.0 },
  wave: { base: 55, depth: 30, phase: 0.13, step: 4.0 },
  mind: { base: 50, depth: 22, phase: 0.31, step: 3.0 },
  creation: { base: 54, depth: 30, phase: 0.47, step: 4.2 },
  void: { base: 24, depth: 18, phase: 0.62, step: 2.6 },
  circle: { base: 58, depth: 24, phase: 0.71, step: 3.2 },
  body: { base: 56, depth: 28, phase: 0.83, step: 3.8 },
  resource: { base: 62, depth: 28, phase: 0.91, step: 4.0 },
  observer: { base: 52, depth: 22, phase: 0.38, step: 3.0 }
};
// v192: Sectional form. Pre-v192 the 9 macro params above were swept by a
// continuous ~3-minute sine that never held a value — the music perpetually
// morphed and never settled into a recognisable section, which read as
// monotonous and aimlessly random. SECTION_PROFILES is a fixed sequence of
// "worlds": each is a plateau the macro params are pulled onto and HELD for
// `bars` bars, then it steps to the next. The order is a deliberate arc —
// quiet emergence → groove → intense peak → empty breakdown → return groove —
// so the piece has perceptible chunks (塊 / 節), each its own world.
// `targets` are absolute UCM values 0-100. `drive` scales drum probability
// and `space` scales rest probability — together they give each world a
// distinct density: a packed, tight "打ち込み" peak (high drive / low space)
// vs an airy breakdown (zero drive / high space). v194 widened the contrast
// so surge is a real showcase and hollow a real rest. Tune freely by ear.
// v242: submerge now carries a light low-end groove (drive 0.60) instead of
// drive 0 — the cold-start section used to clamp the kick to silence and
// halve the bass for its first ~16 bars (~30-46 s), so the low-end "打ち込み"
// foundation felt held back ("ためすぎ"). bars 16→12 also tightens the climb
// into sprout/flow. hollow stays the one true zero-drive breakdown.
const SECTION_PROFILES = [
  { name: "submerge", bars: 12, drive: 0.60, space: 1.30, targets: { energy: 20, wave: 40, mind: 46, creation: 28, void: 84, circle: 74, body: 14, resource: 24, observer: 80 } },
  { name: "sprout",   bars: 14, drive: 0.72, space: 1.15, targets: { energy: 42, wave: 52, mind: 50, creation: 46, void: 48, circle: 60, body: 40, resource: 46, observer: 62 } },
  { name: "flow",     bars: 18, drive: 1.00, space: 0.95, targets: { energy: 60, wave: 60, mind: 52, creation: 56, void: 24, circle: 46, body: 62, resource: 64, observer: 46 } },
  { name: "surge",    bars: 16, drive: 1.55, space: 0.40, targets: { energy: 90, wave: 84, mind: 56, creation: 78, void: 8,  circle: 24, body: 90, resource: 88, observer: 28 } },
  { name: "hollow",   bars: 14, drive: 0.00, space: 1.95, targets: { energy: 15, wave: 38, mind: 54, creation: 26, void: 92, circle: 74, body: 8,  resource: 16, observer: 84 } },
  { name: "return",   bars: 16, drive: 0.90, space: 1.00, targets: { energy: 54, wave: 56, mind: 52, creation: 52, void: 30, circle: 48, body: 56, resource: 58, observer: 48 } }
];
// How much of the old continuous sweep survives inside a held section — a
// little keeps the world breathing rather than frozen. 0 = dead still,
// 1 = the pre-v192 continuous morph.
const SECTION_LIFE_FACTOR = 0.2;
// v196: average of every section's target per key — the "neutral" the section
// deltas are measured from, so a genre-mode modulation is zero-mean over the
// form (it breathes around the genre baseline without drifting off it).
const SECTION_FORM_CENTER = (() => {
  const center = {};
  for (const key of Object.keys(SECTION_PROFILES[0].targets)) {
    let sum = 0;
    for (const p of SECTION_PROFILES) sum += p.targets[key];
    center[key] = sum / SECTION_PROFILES.length;
  }
  return center;
})();
// How strongly the section modulates the macro params when a genre pill has
// locked AUTOMIX off — gentle ("ゆるく"), to keep each genre's identity.
const GENRE_SECTION_SCALE = 0.32;
// v197: intra-section "breath" — a gentle sin arc over each section's progress
// lifts these params toward mid-section, so even a long, calm section keeps
// developing instead of holding a flat plateau for 14-18 bars. Absolute UCM
// offsets at the peak of the arc; 0 at the section's start and end.
const INTRA_SECTION_BREATH = { wave: 8, creation: 8, resource: 7, void: -7 };
const AUTO_MOTION_TICK_MS = 3500;
const AUTO_SLIDER_SYNC_INTERVAL_MS = 240;
const AUTO_GESTURE_MIN_GAP_MS = 4200;
const AUTO_GESTURE_MANUAL_GRACE_MS = 1800;
const AUTO_GESTURE_DURATIONS = { drift: 980, repeat: 760, punch: 420, void: 880 };
const AUTO_DIRECTOR_SCENES = [
  {
    name: "haze",
    length: 5,
    bias: { energy: -10, wave: 6, mind: 4, creation: -2, void: 10, circle: 12, body: -10, resource: -8, observer: 14 },
    gesture: { drift: 0.18, repeat: 0.04, punch: 0.02, void: 0.18 },
    gestureChance: 0.02
  },
  {
    name: "stir",
    length: 4,
    bias: { energy: 4, wave: 12, mind: 2, creation: 10, void: -4, circle: 2, body: 0, resource: 8, observer: 6 },
    gesture: { drift: 0.14, repeat: 0.13, punch: 0.04, void: 0.04 },
    gestureChance: 0.045
  },
  {
    name: "tangle",
    length: 4,
    bias: { energy: 8, wave: 16, mind: 10, creation: 16, void: -6, circle: -8, body: -2, resource: 14, observer: 4 },
    gesture: { drift: 0.08, repeat: 0.28, punch: 0.07, void: 0.02 },
    gestureChance: 0.07
  },
  {
    name: "body",
    length: 3,
    bias: { energy: 12, wave: 6, mind: -2, creation: 6, void: -8, circle: -4, body: 12, resource: 8, observer: -2 },
    gesture: { drift: 0.04, repeat: 0.08, punch: 0.22, void: 0.01 },
    gestureChance: 0.055
  },
  {
    name: "open",
    length: 5,
    bias: { energy: -8, wave: 8, mind: 8, creation: 2, void: 14, circle: 10, body: -12, resource: -6, observer: 16 },
    gesture: { drift: 0.18, repeat: 0.03, punch: 0.01, void: 0.24 },
    gestureChance: 0.05
  }
];
const LONGFORM_ARC_STAGES = [
  {
    name: "submerge",
    length: 9,
    bias: { energy: -7, wave: 5, mind: 3, creation: -2, void: 9, circle: 10, body: -8, resource: -6, observer: 12 },
    gradient: { haze: 0.11, memory: 0.05, micro: 0.0, ghost: 0.03, chrome: 0.06, organic: 0.02 },
    gesture: { drift: 0.12, repeat: 0.02, punch: 0, void: 0.16 }
  },
  {
    name: "sprout",
    length: 8,
    bias: { energy: -1, wave: 10, mind: 4, creation: 8, void: 3, circle: 7, body: -4, resource: 4, observer: 10 },
    gradient: { haze: 0.06, memory: 0.08, micro: 0.04, ghost: 0.01, chrome: 0.06, organic: 0.1 },
    gesture: { drift: 0.12, repeat: 0.08, punch: 0.02, void: 0.03 }
  },
  {
    name: "ferment",
    length: 8,
    bias: { energy: 4, wave: 13, mind: 8, creation: 12, void: -2, circle: -2, body: -2, resource: 10, observer: 6 },
    gradient: { haze: 0.02, memory: 0.06, micro: 0.12, ghost: 0.04, chrome: 0.05, organic: 0.08 },
    gesture: { drift: 0.04, repeat: 0.18, punch: 0.04, void: 0 }
  },
  {
    name: "root",
    length: 6,
    bias: { energy: 5, wave: 6, mind: -1, creation: 4, void: -5, circle: -3, body: 6, resource: 5, observer: 0 },
    gradient: { haze: 0.0, memory: 0.02, micro: 0.04, ghost: 0.12, chrome: 0.0, organic: 0.05 },
    gesture: { drift: 0, repeat: 0.04, punch: 0.16, void: 0.01 }
  },
  {
    name: "exhale",
    length: 9,
    bias: { energy: -9, wave: 7, mind: 7, creation: 1, void: 12, circle: 11, body: -10, resource: -7, observer: 15 },
    gradient: { haze: 0.12, memory: 0.05, micro: 0.01, ghost: 0.03, chrome: 0.11, organic: 0.02 },
    gesture: { drift: 0.1, repeat: 0.01, punch: 0, void: 0.2 }
  }
];
const ALBUM_ARC_TOTAL_MS = 36 * 60 * 1000;
const ALBUM_ARC_PROGRAM = [
  {
    name: "SUBMERGE",
    label: "ARC.SUB",
    durationMs: 7 * 60 * 1000,
    tempoBias: -15,
    acidDrive: 0,
    bias: { energy: -18, wave: 7, mind: 4, creation: -7, void: 18, circle: 17, body: -16, resource: -14, observer: 18 },
    gradient: { haze: 0.18, memory: 0.05, micro: -0.03, ghost: 0.04, chrome: 0.1, organic: 0.04 },
    family: { voiceDust: 0.1, pianoMemory: 0.05, reedBuzz: 0.035, sub808: -0.035, drumSkin: -0.1, acidBiyon: -0.08, chain: 0.02 },
    gesture: { drift: 0.16, repeat: 0.01, punch: -0.04, void: 0.18 },
    drumThin: 0.72
  },
  {
    name: "MEMORY",
    label: "ARC.MEM",
    durationMs: 6 * 60 * 1000,
    tempoBias: -7,
    acidDrive: 0,
    bias: { energy: -7, wave: 13, mind: 8, creation: 7, void: 7, circle: 12, body: -9, resource: 1, observer: 13 },
    gradient: { haze: 0.1, memory: 0.16, micro: 0.02, ghost: 0.02, chrome: 0.07, organic: 0.11 },
    family: { pianoMemory: 0.11, voiceDust: 0.06, chain: 0.05, reedBuzz: 0.015, drumSkin: -0.04, acidBiyon: -0.05 },
    gesture: { drift: 0.14, repeat: 0.1, punch: -0.02, void: 0.03 },
    drumThin: 0.38
  },
  {
    name: "BROKEN",
    label: "ARC.AE",
    durationMs: 6 * 60 * 1000,
    tempoBias: 4,
    acidDrive: 0.08,
    bias: { energy: 5, wave: 16, mind: 10, creation: 16, void: -4, circle: -2, body: -4, resource: 14, observer: 7 },
    gradient: { haze: -0.02, memory: 0.07, micro: 0.18, ghost: 0.04, chrome: 0.08, organic: 0.08 },
    family: { drumSkin: 0.04, pianoMemory: 0.04, chain: 0.12, acidBiyon: 0.035, sub808: -0.02, reedBuzz: -0.025 },
    gesture: { drift: 0.04, repeat: 0.22, punch: 0.02, void: -0.01 },
    drumThin: 0.1
  },
  {
    name: "GHOST",
    label: "ARC.GST",
    durationMs: 6 * 60 * 1000,
    tempoBias: 8,
    acidDrive: 0.16,
    bias: { energy: 10, wave: 8, mind: 1, creation: 8, void: 2, circle: -4, body: 11, resource: 8, observer: 8 },
    gradient: { haze: 0.03, memory: 0.03, micro: 0.06, ghost: 0.16, chrome: 0.03, organic: 0.07 },
    family: { drumSkin: 0.07, sub808: 0.1, voiceDust: 0.04, reedBuzz: 0.02, chain: 0.05 },
    gesture: { drift: 0, repeat: 0.05, punch: 0.18, void: 0.08 },
    drumThin: 0
  },
  {
    name: "ACID",
    label: "ARC.ACD",
    durationMs: 5 * 60 * 1000,
    tempoBias: 24,
    acidDrive: 0.78,
    bias: { energy: 23, wave: 9, mind: 2, creation: 18, void: -12, circle: -10, body: 14, resource: 18, observer: -3 },
    gradient: { haze: -0.06, memory: -0.01, micro: 0.18, ghost: 0.12, chrome: 0.05, organic: 0.04 },
    family: { acidBiyon: 0.26, sub808: 0.13, chain: 0.12, drumSkin: 0.06, voiceDust: -0.04, reedBuzz: -0.08 },
    gesture: { drift: -0.02, repeat: 0.2, punch: 0.18, void: -0.05 },
    drumThin: 0
  },
  {
    name: "EXHALE",
    label: "ARC.XHL",
    durationMs: 6 * 60 * 1000,
    tempoBias: -12,
    acidDrive: 0,
    bias: { energy: -16, wave: 8, mind: 11, creation: 0, void: 20, circle: 18, body: -16, resource: -12, observer: 22 },
    gradient: { haze: 0.16, memory: 0.05, micro: -0.02, ghost: 0.02, chrome: 0.18, organic: 0.03 },
    family: { voiceDust: 0.12, pianoMemory: 0.05, chain: 0.04, sub808: -0.04, drumSkin: -0.1, acidBiyon: -0.1, reedBuzz: 0.015 },
    gesture: { drift: 0.11, repeat: -0.02, punch: -0.05, void: 0.22 },
    drumThin: 0.66
  }
];
const CULTURE_GRAMMARS = {
  ambient_room: {
    label: "HAZE",
    genre: { ambient: 0.18, idm: -0.03, techno: -0.1, pressure: -0.08 },
    gradient: { haze: 0.16, memory: 0.03, micro: -0.04, ghost: 0.03, chrome: 0.1, organic: 0.04 },
    family: { voiceDust: 0.11, pianoMemory: 0.04, reedBuzz: 0.035, sub808: -0.04, drumSkin: -0.11, acidBiyon: -0.09, chain: 0.02 },
    rhythm: { rest: 0.06, drumThin: 0.52, repeat: -0.04, pulse: -0.05 },
    space: { reverb: 0.045, delay: 0.012 },
    gesture: { drift: 0.1, repeat: -0.02, punch: -0.05, void: 0.09 },
    refrain: 0.04
  },
  tape_memory: {
    label: "TAPE",
    genre: { ambient: 0.04, idm: 0.09, techno: -0.05, pressure: -0.04 },
    gradient: { haze: 0.07, memory: 0.17, micro: 0.02, ghost: 0.02, chrome: 0.04, organic: 0.1 },
    family: { pianoMemory: 0.13, voiceDust: 0.05, chain: 0.08, reedBuzz: 0.015, drumSkin: -0.04, acidBiyon: -0.06 },
    rhythm: { rest: 0.025, drumThin: 0.28, repeat: 0.045, pulse: 0 },
    space: { reverb: 0.025, delay: 0.022 },
    gesture: { drift: 0.1, repeat: 0.08, punch: -0.02, void: 0.02 },
    refrain: 0.13
  },
  broken_machine: {
    label: "BROKEN",
    genre: { ambient: -0.04, idm: 0.16, techno: 0.05, pressure: 0.01 },
    gradient: { haze: -0.04, memory: 0.06, micro: 0.2, ghost: 0.04, chrome: 0.07, organic: 0.04 },
    family: { drumSkin: 0.07, chain: 0.15, acidBiyon: 0.04, pianoMemory: 0.03, reedBuzz: -0.03 },
    rhythm: { rest: -0.025, drumThin: 0.04, repeat: 0.17, pulse: 0.05 },
    space: { reverb: -0.015, delay: 0.035 },
    gesture: { drift: 0.01, repeat: 0.18, punch: 0.03, void: -0.02 },
    refrain: 0.1
  },
  ghost_dub: {
    label: "GHOST",
    genre: { ambient: 0.02, idm: 0.02, techno: 0.05, pressure: 0.11 },
    gradient: { haze: 0.03, memory: 0.03, micro: 0.05, ghost: 0.18, chrome: 0.02, organic: 0.06 },
    family: { drumSkin: 0.06, sub808: 0.12, reedBuzz: 0.035, voiceDust: 0.04, chain: 0.04 },
    rhythm: { rest: 0.02, drumThin: 0.06, repeat: 0.02, pulse: 0.1 },
    space: { reverb: 0.035, delay: 0.04 },
    gesture: { drift: 0, repeat: 0.03, punch: 0.12, void: 0.08 },
    refrain: 0.06
  },
  acid_core: {
    label: "ACID",
    genre: { ambient: -0.14, idm: 0.02, techno: 0.18, pressure: 0.12 },
    gradient: { haze: -0.08, memory: -0.02, micro: 0.16, ghost: 0.1, chrome: 0.04, organic: 0.03 },
    family: { acidBiyon: 0.26, sub808: 0.12, chain: 0.1, drumSkin: 0.06, voiceDust: -0.05, reedBuzz: -0.09 },
    rhythm: { rest: -0.08, drumThin: 0, repeat: 0.14, pulse: 0.18 },
    space: { reverb: -0.02, delay: 0.018 },
    gesture: { drift: -0.02, repeat: 0.15, punch: 0.13, void: -0.06 },
    refrain: 0.08
  },
  chrome_hymn: {
    label: "CHROME",
    genre: { ambient: 0.12, idm: 0.02, techno: -0.06, pressure: -0.08 },
    gradient: { haze: 0.1, memory: 0.04, micro: -0.02, ghost: 0.01, chrome: 0.19, organic: 0.03 },
    family: { voiceDust: 0.13, pianoMemory: 0.06, chain: 0.06, sub808: -0.04, drumSkin: -0.09, acidBiyon: -0.1 },
    rhythm: { rest: 0.055, drumThin: 0.44, repeat: -0.03, pulse: -0.04 },
    space: { reverb: 0.06, delay: 0.018 },
    gesture: { drift: 0.08, repeat: -0.02, punch: -0.05, void: 0.16 },
    refrain: 0.05
  },
  earth_reed: {
    label: "EARTH",
    genre: { ambient: 0.06, idm: -0.02, techno: -0.06, pressure: 0.02 },
    gradient: { haze: 0.08, memory: 0.01, micro: -0.03, ghost: 0.12, chrome: 0.02, organic: 0.08 },
    family: { reedBuzz: 0.18, sub808: 0.035, voiceDust: 0.08, chain: 0.03, drumSkin: -0.03, acidBiyon: -0.08 },
    rhythm: { rest: 0.04, drumThin: 0.42, repeat: -0.03, pulse: 0.02 },
    space: { reverb: 0.04, delay: 0.006 },
    gesture: { drift: 0.04, repeat: -0.02, punch: -0.03, void: 0.09 },
    refrain: 0.02
  }
};
const CULTURE_GRAMMAR_OPTIONS = {
  auto: "AUTO",
  ambient_room: "HAZE",
  tape_memory: "TAPE",
  broken_machine: "BROKEN",
  ghost_dub: "GHOST",
  acid_core: "ACID",
  chrome_hymn: "CHROME",
  earth_reed: "EARTH"
};
const ODD_LOGIC_MOVES = {
  soft_wrong_lullaby: {
    label: "WANT.LULL",
    want: { wantsGlass: 0.3, wantsRefrain: 0.22, wantsBreak: 0.05 },
    gradientBias: { memory: 0.1, organic: 0.08, haze: 0.05, chrome: 0.04, micro: -0.02 },
    familyBias: { pianoMemory: 0.14, voiceDust: 0.05, chain: 0.04, drumSkin: -0.04, acidBiyon: -0.06 },
    rhythmBias: { rest: 0.035, drumThin: 0.26, repeat: 0.04, pulse: -0.02 },
    spaceBias: { reverb: 0.025, delay: 0.018 },
    gestureHint: { drift: 0.1, repeat: 0.05, punch: -0.02, void: 0.02 },
    tempoBias: -2.4,
    motifSeed: "D5"
  },
  toy_color_flash: {
    label: "WANT.TOY",
    want: { wantsGlass: 0.34, wantsBreak: 0.1, wantsRefrain: 0.08 },
    gradientBias: { chrome: 0.12, micro: 0.07, organic: 0.05, haze: -0.02 },
    familyBias: { voiceDust: 0.08, chain: 0.08, pianoMemory: 0.04, drumSkin: -0.02 },
    rhythmBias: { rest: -0.01, drumThin: 0.08, repeat: 0.08, pulse: 0.02 },
    spaceBias: { reverb: 0.012, delay: 0.024 },
    gestureHint: { drift: 0.04, repeat: 0.11, punch: 0.01, void: -0.02 },
    tempoBias: 1.6,
    motifSeed: "G5"
  },
  dry_machine_crumbs: {
    label: "WANT.BRK",
    want: { wantsBreak: 0.38, wantsRefrain: 0.12, wantsGlass: 0.08 },
    gradientBias: { micro: 0.16, chrome: 0.05, organic: 0.03, haze: -0.05, ghost: 0.03 },
    familyBias: { drumSkin: 0.08, chain: 0.14, acidBiyon: 0.03, voiceDust: -0.02 },
    rhythmBias: { rest: -0.025, drumThin: -0.02, repeat: 0.18, pulse: 0.06 },
    spaceBias: { reverb: -0.02, delay: 0.026, dry: 0.04 },
    gestureHint: { drift: 0, repeat: 0.18, punch: 0.04, void: -0.03 },
    tempoBias: 3.4,
    motifSeed: "F#5"
  },
  rubber_acid_prank: {
    label: "WANT.RBR",
    want: { wantsRubber: 0.5, wantsBreak: 0.08, wantsRefrain: 0.04 },
    gradientBias: { micro: 0.14, ghost: 0.08, chrome: 0.04, haze: -0.08 },
    familyBias: { acidBiyon: 0.24, sub808: 0.08, chain: 0.08, drumSkin: 0.04, reedBuzz: -0.06 },
    rhythmBias: { rest: -0.08, drumThin: -0.03, repeat: 0.13, pulse: 0.18 },
    spaceBias: { reverb: -0.018, delay: 0.018, dry: 0.025 },
    gestureHint: { drift: -0.02, repeat: 0.13, punch: 0.12, void: -0.06 },
    tempoBias: 10,
    motifSeed: "D3"
  },
  rain_ghost_body: {
    label: "WANT.GST",
    want: { wantsAir: 0.14, wantsVoid: 0.12, wantsRefrain: 0.08 },
    gradientBias: { ghost: 0.14, haze: 0.05, memory: 0.03, organic: 0.04 },
    familyBias: { sub808: 0.08, drumSkin: 0.06, voiceDust: 0.06, reedBuzz: 0.025 },
    rhythmBias: { rest: 0.02, drumThin: 0.05, repeat: 0.02, pulse: 0.1 },
    spaceBias: { reverb: 0.04, delay: 0.035 },
    gestureHint: { drift: 0.02, repeat: 0.03, punch: 0.1, void: 0.08 },
    tempoBias: 2.2,
    motifSeed: "D2"
  },
  chrome_hymn_bend: {
    label: "WANT.CRM",
    want: { wantsAir: 0.26, wantsGlass: 0.2, wantsVoid: 0.12 },
    gradientBias: { chrome: 0.17, haze: 0.08, memory: 0.03, micro: -0.02 },
    familyBias: { voiceDust: 0.14, pianoMemory: 0.05, chain: 0.04, drumSkin: -0.08, acidBiyon: -0.08 },
    rhythmBias: { rest: 0.05, drumThin: 0.42, repeat: -0.02, pulse: -0.04 },
    spaceBias: { reverb: 0.06, delay: 0.016, tail: 0.04 },
    gestureHint: { drift: 0.06, repeat: -0.02, punch: -0.04, void: 0.14 },
    tempoBias: -4.5,
    motifSeed: "E5"
  },
  earth_nasal_drone: {
    label: "WANT.REED",
    want: { wantsReed: 0.45, wantsVoid: 0.12, wantsAir: 0.08 },
    gradientBias: { ghost: 0.12, haze: 0.08, organic: 0.08, chrome: 0.02, micro: -0.04 },
    familyBias: { reedBuzz: 0.2, voiceDust: 0.08, sub808: 0.035, drumSkin: -0.04, acidBiyon: -0.08 },
    rhythmBias: { rest: 0.045, drumThin: 0.46, repeat: -0.03, pulse: 0.02 },
    spaceBias: { reverb: 0.045, delay: 0.006 },
    gestureHint: { drift: 0.04, repeat: -0.02, punch: -0.03, void: 0.09 },
    tempoBias: -6,
    motifSeed: "D2"
  },
  sub_joke_turn: {
    label: "WANT.SUB",
    want: { wantsRubber: 0.18, wantsBreak: 0.08, wantsRefrain: 0.1 },
    gradientBias: { ghost: 0.1, micro: 0.06, organic: 0.04, haze: -0.03 },
    familyBias: { sub808: 0.12, acidBiyon: 0.08, drumSkin: 0.04, chain: 0.04 },
    rhythmBias: { rest: -0.04, drumThin: 0.02, repeat: 0.06, pulse: 0.12 },
    spaceBias: { reverb: -0.006, delay: 0.018 },
    gestureHint: { drift: -0.02, repeat: 0.06, punch: 0.14, void: -0.02 },
    tempoBias: 5.5,
    motifSeed: "F#2"
  },
  void_afterimage: {
    label: "WANT.VOID",
    want: { wantsVoid: 0.4, wantsAir: 0.18, wantsGlass: 0.08 },
    gradientBias: { haze: 0.12, chrome: 0.12, memory: 0.04, ghost: 0.02, micro: -0.04 },
    familyBias: { voiceDust: 0.12, pianoMemory: 0.04, reedBuzz: 0.02, drumSkin: -0.1, acidBiyon: -0.09, sub808: -0.04 },
    rhythmBias: { rest: 0.07, drumThin: 0.55, repeat: -0.035, pulse: -0.05 },
    spaceBias: { reverb: 0.07, delay: 0.025, tail: 0.08 },
    gestureHint: { drift: 0.07, repeat: -0.03, punch: -0.05, void: 0.18 },
    tempoBias: -8,
    motifSeed: "A5"
  }
};
const ODD_LOGIC_OPTIONS = {
  auto: "AUTO",
  rare: "RARE",
  wild: "WILD",
  off: "OFF"
};
const MANUAL_INFLUENCE_HOLD_MS = 4300;
const manualInfluenceUntil = {};
const SLIDER_KEY_BY_ID = Object.fromEntries(Object.entries(SLIDER_BY_UCM).map(([key, id]) => [id, key]));
const PERFORMANCE_PAD_STATUS = {
  drift: "DRIFT active",
  repeat: "REPEAT active",
  punch: "PUNCH active",
  void: "VOID open"
};
const PerformancePadState = {
  drift: 0,
  repeat: 0,
  punch: 0,
  void: 0,
  lastTouchAt: 0
};
const AutoGestureState = {
  active: "",
  timer: null,
  seq: 0,
  lastAt: 0
};
const OrganicChaosState = {
  impulse: 0,
  tangle: 0,
  lowMotion: 0,
  airPull: 0,
  lastGesture: "",
  lastAt: 0
};
const MotifMemoryState = {
  root: "D5",
  reply: "F#5",
  shade: "D4",
  strength: 0,
  air: 0,
  lastStep: -99,
  source: ""
};
const TONAL_RHYME_SUB = ["D1", "F#1", "G1", "E1", "D2", "F#2", "E2", "G2"];
const TONAL_RHYME_LOW = ["D2", "F#2", "G2", "E2", "D3", "F#3", "E3", "G3"];
const TONAL_RHYME_MID = ["D4", "F#4", "G4", "E4", "D5", "F#5", "E5", "G5"];
const TONAL_RHYME_HIGH = ["D5", "F#5", "G5", "E5", "D6", "F#6", "E6", "G6"];
const TonalRhymeState = {
  phrase: 0,
  stepOffset: 0,
  lowOffset: 0,
  lastCycle: -1
};
const AutoDirectorState = {
  sceneIndex: 0,
  phrase: 0,
  intensity: 0.58,
  cadence: "",
  lastScene: "haze"
};
const OrganicEcosystemState = {
  breath: 0.52,
  sprout: 0.18,
  ferment: 0.16,
  rootTurn: 0.14,
  bloom: 0,
  lastBloomCycle: -99
};
const LongformArcState = {
  stageIndex: 0,
  phrase: 0,
  breath: 0.48,
  contrast: 0.18,
  turn: 0,
  lastStage: "submerge"
};
const AlbumArcState = {
  mode: "live",
  elapsedMs: 0,
  chapterIndex: 0,
  progress: 0,
  blend: 0,
  acidDrive: 0,
  chapterTurn: 0,
  lastChapter: "SUBMERGE"
};
// v192: sectional-form clock — see SECTION_PROFILES. Advanced once per bar by
// advanceSection() from advanceGrooveStructure.
const SectionState = {
  started: false,
  index: 0,
  barsLeft: 0,
  barsInto: 0,
  fillCue: false,
  name: ""
};
if (typeof window !== "undefined") window.SectionState = SectionState;
// v196: when a genre pill locks AUTOMIX off, fm.js hands the engine that
// genre's UCM baseline here so the section system can still develop the macro
// params gently around it. null = ANY (AUTOMIX itself drives the sections).
const GenreSectionState = {
  baseline: null
};
const DJTempoState = {
  bpm: 80,
  targetBpm: 80,
  rawBpm: 80,
  drift: 0,
  motion: 0
};
const BpmCrossfadeState = {
  zone: "ambient",
  previousZone: "ambient",
  blend: 0,
  refrain: 0,
  lastCrossCycle: -99,
  motifRoot: "D5",
  motifReply: "F#5",
  motifShade: "D4",
  motifIndex: 0
};
const GOLDEN_RATIO = 1.61803398875;
const GOLDEN_RATIO_INVERSE = 1 / GOLDEN_RATIO;
const GenomeState = {
  generation: 0,
  phase: 0,
  growth: 0.22,
  mutation: 0.12,
  resonance: 0,
  lastPulseCycle: -99,
  root: "D5",
  reply: "F#5",
  shade: "D4",
  genes: {
    haze: 0.48,
    pulse: 0.34,
    micro: 0.36,
    chrome: 0.4,
    organic: 0.42,
    pressure: 0.24,
    refrain: 0.36,
    voidTail: 0.32
  }
};
const GENOME_GENE_KEYS = ["haze", "pulse", "micro", "chrome", "organic", "pressure", "refrain", "voidTail"];
const VoiceColorState = {
  atmosphere: "auto",
  source: "genome"
};
const CultureGrammarState = {
  selected: "auto",
  active: "ambient_room",
  label: "AUTO",
  strength: 0.72,
  lastActive: "ambient_room"
};
const OddLogicDirectorState = {
  mode: "auto",
  active: false,
  move: "soft_wrong_lullaby",
  label: "WANT.LULL",
  want: "glass",
  intensity: 0,
  phase: 0,
  askPulse: 0,
  cuePending: false,
  lastCycle: -1,
  lastMoveCycle: -99,
  lastCueCycle: -99,
  generation: 0,
  vector: {
    wantsGlass: 0,
    wantsBreak: 0,
    wantsAir: 0,
    wantsRefrain: 0,
    wantsRubber: 0,
    wantsReed: 0,
    wantsVoid: 0
  }
};
const AcidLockState = {
  enabled: false,
  intensity: 0,
  indicator: 0,
  transient: 0,
  transientSource: ""
};
const PerformanceColorDriftState = {
  lastCycle: -1,
  phase: 0,
  haze: 0.4,
  chrome: 0.36,
  dust: 0.34,
  pressure: 0.18,
  acid: 0
};
const VoiceMorphState = {
  transition: 0,
  gradient: {
    haze: 0,
    memory: 0,
    micro: 0,
    ghost: 0,
    chrome: 0,
    organic: 0
  },
  genes: {
    haze: 0,
    pulse: 0,
    micro: 0,
    chrome: 0,
    organic: 0,
    pressure: 0,
    refrain: 0,
    voidTail: 0
  }
};
const VOICE_EMERGENCE_KEYS = ["haze", "memory", "micro", "ghost", "chrome", "organic"];
const VoiceEmergenceState = {
  lastCycle: -1,
  phrase: 0,
  phraseCycles: 10,
  focus: "haze",
  nextFocus: "chrome",
  blend: 0,
  phase: 0,
  bloom: 0,
  splice: 0,
  shimmer: 0,
  refrain: 0
};
const SIGNATURE_CELL_MOTIFS = ["call", "answer", "scar"];
const SIGNATURE_CONDUCTOR_MODES = ["listen", "breathe", "scratch", "remember", "open"];
const PRODUCER_HABIT_MODES = ["listen", "softWrongMemory", "dryGridScar", "ghostPressureBreath", "transparentVoidTail", "rubberMicroEdit"];
const MODE_TIMBRE_PALETTE_KEYS = ["ambientHaze", "idmGlass", "technoDryGrid", "pressureGhost", "voidAir"];
const MUSIC_RADIO_BRAIN_PROGRAMS = ["fieldStudy", "glassCoding", "dryGridWork", "ghostPressure", "voidRoom", "hardTechno", "liveJazz", "nightFunk", "quietPiano"];
const ReferenceMorphState = {
  lastCycle: -1,
  phase: 0,
  style: "haze",
  haze: 0.4,
  broken: 0.22,
  pulse: 0.18,
  void: 0.2,
  chrome: 0.3,
  organic: 0.28,
  rdj: 0.2,
  restraint: 0.48
};
const RdjGrowthState = {
  lastCycle: -1,
  generation: 0,
  phase: 0,
  toy: 0.12,
  rubber: 0.08,
  wrong: 0.16,
  tender: 0.2,
  edit: 0.14,
  restraint: 0.5
};
const ProducerHabitState = {
  lastCycle: -1,
  generation: 0,
  phase: 0,
  mode: "listen",
  lastMutation: "listen",
  restraintBudget: 0.62,
  curiosity: 0.18,
  risk: 0,
  riskSnapshot: {
    density: 0,
    bright: 0,
    low: 0,
    hook: 0,
    overall: 0
  },
  habits: {
    tenderMemory: 0.22,
    dryGrid: 0.12,
    ghostPressure: 0.1,
    transparentVoid: 0.28,
    rubberEdit: 0.14,
    beautifulRestraint: 0.5
  }
};
const SelfReviewGovernorState = {
  lastCycle: -1,
  densityBrake: 0,
  lowCleanup: 0,
  airTail: 0,
  transientSoftener: 0,
  lastSuggestion: "listen"
};
const ModeTimbrePaletteState = {
  lastCycle: -1,
  phase: 0,
  active: "ambientHaze",
  lastDecision: "ambientHaze",
  weights: {
    ambientHaze: 0.44,
    idmGlass: 0.34,
    technoDryGrid: 0.16,
    pressureGhost: 0.12,
    voidAir: 0.32
  },
  shape: {
    rhythm: 0.22,
    haze: 0.42,
    glass: 0.34,
    texture: 0.24,
    air: 0.36,
    pad: 0.42,
    signature: 0.28,
    transient: 0.2,
    lowClamp: 0.16,
    restraint: 0.48
  },
  safety: {
    densityBrake: 0,
    lowClamp: 0,
    brightnessDamp: 0,
    restraint: 0.48
  }
};
const MusicRadioBrainState = {
  lastCycle: -1,
  generation: 0,
  phrase: 0,
  phraseCycles: 24,
  active: "fieldStudy",
  next: "glassCoding",
  blend: 0,
  phase: 0,
  lastDecision: "fieldStudy",
  lastReason: "initial haze room",
  weights: {
    fieldStudy: 0.42,
    glassCoding: 0.28,
    dryGridWork: 0.12,
    ghostPressure: 0.08,
    voidRoom: 0.26,
    hardTechno: 0.10,
    liveJazz: 0.12,
    nightFunk: 0.10,
    quietPiano: 0.16
  },
  bias: {
    haze: 0.36,
    glass: 0.28,
    grid: 0.12,
    pressure: 0.08,
    air: 0.3,
    restraint: 0.48,
    curiosity: 0.18
  },
  guard: {
    density: 0,
    low: 0,
    bright: 0
  },
  cuePending: false,
  cueProgram: "fieldStudy",
  cueCycle: -99,
  cueLastStep: -99
};
let selfReviewMeter = null;
const MicFollowState = {
  enabled: false,
  pending: false,
  supported: true,
  status: "off",
  stream: null,
  source: null,
  analyser: null,
  buffer: null,
  lastLevel: 0,
  onsetTimes: [],
  targetBias: {},
  lastUiAt: 0,
  features: {
    inputLevel: 0,
    onsetRate: 0,
    roughTempo: 0,
    density: 0,
    stability: 0,
    silence: 1,
    brightness: 0,
    lastOnsetAt: 0
  },
  updatedAt: 0
};
const MicJamState = {
  gesture: "silent",
  previousGesture: "silent",
  drive: 0,
  pulse: 0,
  phrase: 0,
  clap: 0,
  hum: 0,
  air: 1,
  noisy: 0,
  confidence: 0,
  bpmLock: 0,
  cooldownSteps: 0,
  lastCueStep: -99,
  lastGestureAt: 0,
  updatedAt: 0
};
const SignatureCellState = {
  phrase: 0,
  phraseCycles: 6,
  motif: "call",
  nextMotif: "answer",
  blend: 0,
  cooldownSteps: 0,
  intensity: 0,
  lastStep: -99,
  lowBreathCooldownSteps: 0,
  lowBreathIntensity: 0,
  lowBreathLastStep: -99,
  brokenTextureCooldownSteps: 0,
  brokenTextureIntensity: 0,
  brokenTextureLastStep: -99,
  memoryPluckCooldownSteps: 0,
  memoryPluckIntensity: 0,
  memoryPluckLastStep: -99,
  globalCooldownSteps: 0,
  conductorMode: "listen",
  nextConductorMode: "breathe",
  conductorPhrase: 0,
  conductorPhraseCycles: 4,
  silenceDebt: 0,
  lastFlavor: ""
};
const VOICE_EMERGENCE_COLORS = {
  haze: {
    gradient: { haze: 0.085, memory: 0.035, chrome: 0.018, micro: -0.012 },
    genes: { haze: 0.08, refrain: 0.04, voidTail: 0.026, pressure: -0.018 }
  },
  memory: {
    gradient: { memory: 0.09, organic: 0.035, haze: 0.028, chrome: -0.008 },
    genes: { refrain: 0.064, organic: 0.04, haze: 0.026, micro: -0.01 }
  },
  micro: {
    gradient: { micro: 0.095, chrome: 0.038, organic: 0.018, haze: -0.018 },
    genes: { micro: 0.088, chrome: 0.03, pressure: 0.026, haze: -0.018 }
  },
  ghost: {
    gradient: { ghost: 0.088, haze: 0.032, memory: 0.024, chrome: 0.012 },
    genes: { pulse: 0.07, voidTail: 0.046, pressure: 0.022, refrain: 0.02 }
  },
  chrome: {
    gradient: { chrome: 0.092, haze: 0.032, micro: 0.026, organic: -0.008 },
    genes: { chrome: 0.09, voidTail: 0.038, micro: 0.026, haze: 0.018 }
  },
  organic: {
    gradient: { organic: 0.096, memory: 0.04, micro: 0.024, chrome: -0.008 },
    genes: { organic: 0.092, refrain: 0.04, micro: 0.026, haze: 0.018 }
  }
};
const BarCounter = {
  current: 0,
  lastModeChangeBar: -999,
  phraseLength: 16,
  pendingMode: null
};
const PatternVariation = {
  bar: 0,
  phraseLength: 16,
  variationInterval: 4,
  baseSignature: "",
  basePattern: {
    kick: "",
    hat: "",
    bass: "",
    pad: "",
    skin: ""
  },
  currentPattern: {
    kick: "",
    hat: "",
    bass: "",
    pad: "",
    skin: ""
  },
  lastVariationBar: -1
};

function musicRuntimeDebugEnabled(channel = "") {
  try {
    if (typeof window === "undefined") return false;
    const runtimeDebug = window.MusicRuntimeDebug;
    if (runtimeDebug === true) return true;
    if (runtimeDebug && typeof runtimeDebug === "object" && runtimeDebug[channel] === true) return true;
    const storage = window.localStorage;
    if (!storage) return false;
    if (storage.getItem("music.debug") === "1") return true;
    return !!channel && storage.getItem(`music.debug.${channel}`) === "1";
  } catch (error) {
    return false;
  }
}

function musicRuntimeDebugLog(channel, ...args) {
  if (musicRuntimeDebugEnabled(channel)) console.log(...args);
}
const AUTO_SOURCE_MORPH_KEYS = ["xtal", "boc", "opn", "fsol", "autechre", "burial"];
const AUTO_ATMOSPHERE_MORPH_KEYS = ["haze", "chrome", "void", "organic", "ghost"];
const AutoVoiceMorphState = {
  sourceIndex: 0,
  sourceNextIndex: 1,
  sourceAge: 0,
  sourceSegmentCycles: 54,
  sourceBlend: 0,
  atmosphereIndex: 0,
  atmosphereNextIndex: 1,
  atmosphereAge: 0,
  atmosphereSegmentCycles: 38,
  atmosphereBlend: 0,
  generation: 0,
  lastCycle: -1
};
const ATMOSPHERE_COLORS = {
  auto: {
    label: "AUTO.AIR",
    gradient: {},
    genes: {}
  },
  haze: {
    label: "HAZE.01",
    gradient: { haze: 0.16, memory: 0.07, chrome: 0.04, ghost: -0.02 },
    genes: { haze: 0.18, refrain: 0.08, voidTail: 0.04, pressure: -0.04 }
  },
  chrome: {
    label: "CHROME.02",
    gradient: { chrome: 0.18, micro: 0.07, haze: 0.04, organic: -0.02 },
    genes: { chrome: 0.2, micro: 0.08, voidTail: 0.05 }
  },
  ghost: {
    label: "GHOST.03",
    gradient: { ghost: 0.15, haze: 0.08, memory: 0.05, chrome: 0.03 },
    genes: { pulse: 0.12, voidTail: 0.12, pressure: 0.04, refrain: 0.06 }
  },
  organic: {
    label: "ORG.DUST",
    gradient: { organic: 0.2, memory: 0.08, micro: 0.06, chrome: -0.02 },
    genes: { organic: 0.22, refrain: 0.08, micro: 0.06, haze: 0.04 }
  },
  void: {
    label: "VOID.05",
    gradient: { haze: 0.14, chrome: 0.14, ghost: -0.04, micro: -0.02 },
    genes: { voidTail: 0.24, haze: 0.12, chrome: 0.1, pressure: -0.06 }
  }
};
const SOURCE_COLORS = {
  genome: {
    label: "GENOME",
    gradient: {},
    genes: { refrain: 0.04, organic: 0.03, micro: 0.03 }
  },
  xtal: {
    label: "XTAL.THA",
    gradient: { haze: 0.13, chrome: 0.09, memory: 0.05, ghost: -0.03 },
    genes: { haze: 0.16, chrome: 0.1, refrain: 0.08, pressure: -0.05 }
  },
  boc: {
    label: "BoC.MEM",
    gradient: { memory: 0.16, organic: 0.08, haze: 0.08, micro: -0.02 },
    genes: { organic: 0.12, refrain: 0.12, haze: 0.08, chrome: -0.02 }
  },
  autechre: {
    label: "AE.LOGIC",
    gradient: { micro: 0.18, chrome: 0.08, organic: 0.04, haze: -0.04 },
    genes: { micro: 0.2, pressure: 0.08, chrome: 0.08, haze: -0.05 }
  },
  burial: {
    label: "GHOST.PULSE",
    gradient: { ghost: 0.17, haze: 0.07, memory: 0.05, chrome: 0.02 },
    genes: { pulse: 0.18, voidTail: 0.12, refrain: 0.06, pressure: 0.04 }
  },
  opn: {
    label: "OPN.CHROME",
    gradient: { chrome: 0.2, haze: 0.08, memory: 0.03, ghost: -0.02 },
    genes: { chrome: 0.22, voidTail: 0.08, haze: 0.06, micro: 0.03 }
  },
  fsol: {
    label: "FSOL.MOTION",
    gradient: { organic: 0.14, micro: 0.09, ghost: 0.08 },
    genes: { organic: 0.16, pulse: 0.12, micro: 0.08, pressure: 0.04 }
  }
};
const OutputState = {
  level: 88
};
const PlaybackState = {
  outputDeviceId: "",
  outputDeviceLabel: "SYSTEM / BT",
  wakeLockEnabled: false,
  wakeLockSentinel: null,
  wakeLockSupported: typeof navigator !== "undefined" && !!navigator.wakeLock,
  mediaSessionSupported: typeof navigator !== "undefined" && !!navigator.mediaSession,
  backgroundBridgeActive: false,
  backgroundAudio: null,
  backgroundBridgeHealthBound: false,
  backgroundBridgeRearmTimer: 0,
  backgroundBridgeDiagnostics: {
    status: "off",
    lastEvent: "init",
    lastError: "",
    lastChangedAt: 0,
    lastAttemptAt: 0,
    lastSuccessAt: 0,
    lastLostAt: 0,
    attemptCount: 0,
    successCount: 0,
    lostCount: 0,
    rearmCount: 0,
    lastRearmReason: ""
  },
  iosSafariBridgePreferred: false
};
const HazamaBridgeState = {
  active: false,
  loaded: false,
  source: "",
  name: "",
  style: "",
  stage: "",
  depthId: "",
  stability: 0,
  resonance: 0,
  marks: 0,
  importedAt: 0,
  profile: null,
  baseUcm: {},
  baseAudio: {},
  audio: {},
  patterns: {},
  pending: false,
  autoFollow: false,
  controlAction: "",
  controlPending: false,
  controlAt: 0,
  lastExternalAt: 0,
  lastAutonomyCycle: -1,
  autonomyGeneration: 0,
  evolution: {
    air: 0,
    pulse: 0,
    micro: 0,
    bloom: 0
  },
  lastError: ""
};
const HazamaRuntimeFeedbackState = {
  sequence: 0,
  lastSentAt: 0,
  lastHeartbeatAt: 0,
  lastSignature: ""
};
const HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS = [
  "https://quietbriony.github.io",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:8095",
  "http://localhost:8095"
];

function markManualInfluenceFromEvent(event) {
  const id = event && event.target && event.target.id;
  const key = SLIDER_KEY_BY_ID[id];
  if (!key) return;
  const now = performanceNowMs();
  manualInfluenceUntil[key] = now + MANUAL_INFLUENCE_HOLD_MS;
}

function isManualInfluenceActive(key, now) {
  return typeof manualInfluenceUntil[key] === "number" && now < manualInfluenceUntil[key];
}

function performanceNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

const ToneScheduleGuard = {
  // Minimum separation between two triggers on the same voice — de-collides
  // notes that would otherwise land on the exact same instant.
  minGapSec: 0.003,
  // Scheduling headroom ("ちょい先読み"). A note whose requested time is in the
  // near-past — a Transport step that fired late, or a gesture scheduled off
  // raw currentTime — gets floored this far ahead of the audio clock. At 4ms
  // the floor sat inside the render quantum + main-thread jitter, so floored
  // notes still rendered late with a truncated attack: an audible click. ~30ms
  // clears the quantum and lets the audio thread land the note cleanly. Still
  // well within Tone's 100ms lookAhead, so on-time notes are never touched.
  nowLeadSec: 0.03,
  lastByVoice: new Map()
};

function resetToneScheduleGuard() {
  ToneScheduleGuard.lastByVoice.clear();
}

function currentToneContextTime() {
  if (typeof Tone === "undefined" || !Tone) return 0;
  const toneContext = Tone.context || (typeof Tone.getContext === "function" ? Tone.getContext() : null);
  const rawContext = toneContext?.rawContext || toneContext?._context || toneContext?.context || toneContext;
  return Number.isFinite(rawContext?.currentTime) ? rawContext.currentTime : 0;
}

function estimateTriggeredNoteCount(noteArg) {
  return Array.isArray(noteArg) ? Math.max(1, noteArg.length) : 1;
}

function safeToneScheduleTime(voiceKey, time) {
  const toneNow = currentToneContextTime();
  const requested = Number.isFinite(Number(time)) ? Number(time) : toneNow;
  const last = ToneScheduleGuard.lastByVoice.get(voiceKey) || 0;
  const safe = Math.max(requested, toneNow + ToneScheduleGuard.nowLeadSec, last + ToneScheduleGuard.minGapSec);
  ToneScheduleGuard.lastByVoice.set(voiceKey, safe);
  return safe;
}

// Retrigger debounce for monophonic percussion (the kick). The kick is fired
// from several uncoordinated paths (punch-pad signature, punch hold, acid
// trace, ambient ghost-pulse); when two land within a few tens of ms they
// don't read as two hits — the second restarts the MembraneSynth mid-transient
// and the pitch/amp envelope discontinuity is heard as a click. This peeks at
// the last *scheduled* time for the voice (without mutating it) so the wrapper
// can drop the straggler. Compares absolute times both ways: a real collision
// is two requests close together regardless of which was queued first, while a
// kick a full beat away (or a Transport hit queued ~100ms ahead) is far enough
// to fall outside the window and is left alone.
function toneVoiceRetriggerTooSoon(scheduleKey, time, minRetriggerSec) {
  if (!Number.isFinite(minRetriggerSec) || minRetriggerSec <= 0) return false;
  const last = ToneScheduleGuard.lastByVoice.get(scheduleKey);
  if (!Number.isFinite(last)) return false;
  const requested = Number.isFinite(Number(time)) ? Number(time) : currentToneContextTime();
  return Math.abs(requested - last) < minRetriggerSec;
}

function guardToneTriggerReleaseSchedule(voiceKey, source, timeArgIndex, options = {}) {
  if (!source || source.__musicTriggerGuarded) return source;
  const scheduleKey = `${voiceKey}:attackRelease`;
  const originalTriggerAttackRelease = source.triggerAttackRelease;
  if (typeof originalTriggerAttackRelease === "function") {
    source.triggerAttackRelease = function guardedTriggerAttackRelease(...args) {
      // Monophonic percussion: drop a retrigger that lands within
      // minRetriggerSec of the previous hit rather than restarting the synth
      // mid-transient (the source of the occasional kick click).
      if (toneVoiceRetriggerTooSoon(scheduleKey, args[timeArgIndex], options.minRetriggerSec)) {
        return source;
      }
      if (args[timeArgIndex] == null || Number.isFinite(Number(args[timeArgIndex]))) {
        args[timeArgIndex] = safeToneScheduleTime(scheduleKey, args[timeArgIndex]);
      }
      if (
        Number.isFinite(options.maxActiveVoices) &&
        Number.isFinite(source.activeVoices) &&
        source.activeVoices + estimateTriggeredNoteCount(args[0]) > options.maxActiveVoices
      ) {
        return source;
      }
      return originalTriggerAttackRelease.apply(this, args);
    };
  }
  Object.defineProperty(source, "__musicTriggerGuarded", {
    value: true,
    configurable: true
  });
  return source;
}

function cancelAutoGesture(options = {}) {
  if (AutoGestureState.timer) {
    clearTimeout(AutoGestureState.timer);
    AutoGestureState.timer = null;
  }
  const active = AutoGestureState.active;
  AutoGestureState.active = "";
  AutoGestureState.seq += 1;
  if (options.clearPad && active && Object.prototype.hasOwnProperty.call(PerformancePadState, active)) {
    PerformancePadState[active] = 0;
    const pad = typeof document !== "undefined" ? document.querySelector(`[data-performance-pad="${active}"]`) : null;
    if (pad) pad.classList.remove("active");
  }
}

function updatePerformancePadDataset() {
  if (typeof document === "undefined" || !document.body) return;
  document.body.dataset.padActive = Object.entries(PerformancePadState)
    .some(([key, value]) => key !== "lastTouchAt" && value > 0)
    ? "true"
    : "false";
}

function setPerformancePad(name, active, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(PerformancePadState, name)) return;
  const source = options.source || "manual";
  if (source !== "auto") cancelAutoGesture({ clearPad: true });
  PerformancePadState[name] = active ? 1 : 0;
  if (source !== "auto") PerformancePadState.lastTouchAt = performanceNowMs();
  if (active) {
    exciteOrganicChaos(name, source);
    rememberGestureMotif(name, source);
    nudgeLongformArcFromGesture(name, source);
  }
  if (initialized) updateTimbreStateFromWorld(currentGradientParts());
  if (active) triggerPadSignature(name);
  updatePerformancePadDataset();
  updatePerformancePadStatus();
}

function clearPerformancePads() {
  cancelAutoGesture({ clearPad: false });
  resetOrganicChaos();
  resetMotifMemory();
  ["drift", "repeat", "punch", "void"].forEach((name) => {
    PerformancePadState[name] = 0;
  });
  if (initialized) updateTimbreStateFromWorld(currentGradientParts());
  updatePerformancePadDataset();
  document.querySelectorAll("[data-performance-pad].active").forEach((pad) => {
    pad.classList.remove("active");
  });
  updatePerformancePadStatus();
}

function hasActivePerformancePad() {
  return ["drift", "repeat", "punch", "void"].some((name) => PerformancePadState[name] > 0);
}

function currentAutoDirectorScene() {
  return AUTO_DIRECTOR_SCENES[AutoDirectorState.sceneIndex % AUTO_DIRECTOR_SCENES.length] || AUTO_DIRECTOR_SCENES[0];
}

function currentLongformArcStage() {
  return LONGFORM_ARC_STAGES[LongformArcState.stageIndex % LONGFORM_ARC_STAGES.length] || LONGFORM_ARC_STAGES[0];
}

// v192: sectional form — see SECTION_PROFILES / SectionState. advanceSection()
// is the per-bar clock; sectionMacroTarget() feeds updateAutoMixTargets() so
// the macro params hold on the current section's plateau instead of sweeping
// continuously. resetSection() restarts the sequence on a fresh auto cycle.
function currentSectionProfile() {
  return SECTION_PROFILES[SectionState.index % SECTION_PROFILES.length] || SECTION_PROFILES[0];
}

function resetSection() {
  SectionState.started = false;
  SectionState.index = 0;
  SectionState.barsLeft = 0;
  SectionState.barsInto = 0;
  SectionState.fillCue = false;
  SectionState.name = "";
}

// v197: mark a section boundary with the radio-brain ident — a subtle
// harmonic gesture (otherwise only fired on a program change) that announces
// the new world. Skipped when a program-change cue is already pending so the
// two transition markers don't stack.
function cueSectionIdent() {
  if (!isPlaying || !MusicRadioBrainState || MusicRadioBrainState.cuePending) return;
  MusicRadioBrainState.cuePending = true;
  MusicRadioBrainState.cueProgram = MusicRadioBrainState.active;
  MusicRadioBrainState.cueCycle = GrooveState.cycle;
}

function advanceSection() {
  SectionState.fillCue = false;
  if (!SectionState.started) {
    SectionState.started = true;
    SectionState.index = 0;
    SectionState.barsLeft = currentSectionProfile().bars;
    SectionState.barsInto = 0;
    SectionState.name = currentSectionProfile().name;
    return;
  }
  SectionState.barsLeft -= 1;
  SectionState.barsInto += 1;
  // v193: cue a fill on the bar just before a section boundary, so the change
  // into the next world is heard as a clear edge (the "塊" the listener wants).
  if (SectionState.barsLeft === 1) SectionState.fillCue = true;
  if (SectionState.barsLeft <= 0) {
    SectionState.index = (SectionState.index + 1) % SECTION_PROFILES.length;
    SectionState.barsLeft = currentSectionProfile().bars;
    SectionState.barsInto = 0;
    SectionState.name = currentSectionProfile().name;
    cueSectionIdent();
  }
}

function sectionMacroTarget(key) {
  if (!SectionState.started) return null;
  const profile = currentSectionProfile();
  const target = profile.targets[key];
  if (typeof target !== "number") return null;
  // v197: add the intra-section breath — a gentle sin arc over the section's
  // progress so a held section still develops within itself.
  const lift = INTRA_SECTION_BREATH[key];
  if (typeof lift !== "number") return target;
  const progress = clampValue(SectionState.barsInto / Math.max(1, profile.bars), 0, 1);
  return target + Math.sin(progress * Math.PI) * lift;
}

function longformArcActive() {
  return !!(UCM.auto.enabled && isPlaying);
}

function longformArcShape() {
  if (!longformArcActive()) return 0;
  const stage = currentLongformArcStage();
  const length = Math.max(1, stage.length || 1);
  const progress = clampValue(LongformArcState.phrase / length, 0, 1);
  return clampValue((0.52 + Math.sin(progress * Math.PI) * 0.42) * LongformArcState.breath, 0, 1);
}

function longformArcBias(key) {
  if (!longformArcActive()) return 0;
  const stage = currentLongformArcStage();
  return (stage.bias?.[key] || 0) * longformArcShape();
}

function longformArcGestureBias(name) {
  if (!longformArcActive()) return 0;
  const stage = currentLongformArcStage();
  return (stage.gesture?.[name] || 0) * (0.58 + LongformArcState.contrast * 0.7 + LongformArcState.turn * 0.24);
}

function albumArcActive() {
  return !!(UCM.auto.enabled && isPlaying && AlbumArcState.mode === "arc36");
}

function resetAlbumArc(options = {}) {
  if (options.keepElapsed !== true) AlbumArcState.elapsedMs = 0;
  AlbumArcState.chapterIndex = 0;
  AlbumArcState.progress = 0;
  AlbumArcState.blend = 0;
  AlbumArcState.acidDrive = 0;
  AlbumArcState.chapterTurn = 0;
  AlbumArcState.lastChapter = ALBUM_ARC_PROGRAM[0]?.name || "SUBMERGE";
  updateAlbumArcUi();
}

function albumArcChapterAt(elapsedMs) {
  const total = ALBUM_ARC_PROGRAM.reduce((sum, chapter) => sum + chapter.durationMs, 0) || ALBUM_ARC_TOTAL_MS;
  const wrapped = ((elapsedMs % total) + total) % total;
  let cursor = 0;
  for (let index = 0; index < ALBUM_ARC_PROGRAM.length; index++) {
    const chapter = ALBUM_ARC_PROGRAM[index];
    const nextCursor = cursor + chapter.durationMs;
    if (wrapped < nextCursor || index === ALBUM_ARC_PROGRAM.length - 1) {
      const progress = clampValue((wrapped - cursor) / Math.max(1, chapter.durationMs), 0, 1);
      return { chapter, index, progress };
    }
    cursor = nextCursor;
  }
  return { chapter: ALBUM_ARC_PROGRAM[0], index: 0, progress: 0 };
}

function currentAlbumArcChapter() {
  return ALBUM_ARC_PROGRAM[AlbumArcState.chapterIndex] || ALBUM_ARC_PROGRAM[0];
}

function nextAlbumArcChapter() {
  const nextIndex = (AlbumArcState.chapterIndex + 1) % ALBUM_ARC_PROGRAM.length;
  return ALBUM_ARC_PROGRAM[nextIndex] || currentAlbumArcChapter();
}

function albumArcTransitionBlend() {
  if (!albumArcActive()) return 0;
  return smoothStep01(clampValue((AlbumArcState.progress - 0.78) / 0.22, 0, 1));
}

function albumArcValue(section, key) {
  if (!albumArcActive()) return 0;
  const current = currentAlbumArcChapter();
  const next = nextAlbumArcChapter();
  const blend = albumArcTransitionBlend();
  return ((current?.[section]?.[key] || 0) * (1 - blend)) + ((next?.[section]?.[key] || 0) * blend);
}

function albumArcBias(key) {
  return albumArcValue("bias", key) * (0.72 + LongformArcState.breath * 0.28);
}

function albumArcGradientBias(key) {
  return albumArcValue("gradient", key) * (0.72 + LongformArcState.contrast * 0.36);
}

function albumArcFamilyBias(key) {
  return albumArcValue("family", key) * (0.7 + LongformArcState.turn * 0.26);
}

function albumArcGestureBias(name) {
  return albumArcValue("gesture", name) * (0.8 + LongformArcState.contrast * 0.32);
}

function albumArcTempoBias() {
  if (!albumArcActive()) return 0;
  const current = currentAlbumArcChapter();
  const next = nextAlbumArcChapter();
  const blend = albumArcTransitionBlend();
  const base = (current?.tempoBias || 0) * (1 - blend) + (next?.tempoBias || 0) * blend;
  return base + Math.sin((AlbumArcState.elapsedMs / 1000) * 0.008 + AlbumArcState.chapterIndex) * 1.8;
}

function albumArcDrumThin() {
  if (!albumArcActive()) return 0;
  const current = currentAlbumArcChapter();
  const next = nextAlbumArcChapter();
  const blend = albumArcTransitionBlend();
  return clampValue((current?.drumThin || 0) * (1 - blend) + (next?.drumThin || 0) * blend, 0, 1);
}

function albumArcAcidDrive() {
  return albumArcActive() ? clampValue(AlbumArcState.acidDrive || 0, 0, 1) : 0;
}

function acidPerformanceAmount() {
  return clampValue(Math.max(AcidLockState.intensity || 0, AcidLockState.transient || 0, albumArcAcidDrive()), 0, 1);
}

function advanceAlbumArcTransport(eighthNoteMs) {
  if (!albumArcActive()) {
    AlbumArcState.acidDrive = 0;
    return;
  }

  AlbumArcState.elapsedMs = (AlbumArcState.elapsedMs + Math.max(1, eighthNoteMs || 0)) % ALBUM_ARC_TOTAL_MS;
  const next = albumArcChapterAt(AlbumArcState.elapsedMs);
  const changed = next.chapter.name !== AlbumArcState.lastChapter;
  AlbumArcState.chapterIndex = next.index;
  AlbumArcState.progress = next.progress;
  AlbumArcState.blend = albumArcTransitionBlend();
  const current = currentAlbumArcChapter();
  const following = nextAlbumArcChapter();
  AlbumArcState.acidDrive = clampValue((current.acidDrive || 0) * (1 - AlbumArcState.blend) + (following.acidDrive || 0) * AlbumArcState.blend, 0, 1);

  if (changed) {
    AlbumArcState.chapterTurn = 1;
    AlbumArcState.lastChapter = next.chapter.name;
    BpmCrossfadeState.blend = clampValue(Math.max(BpmCrossfadeState.blend, 0.48), 0, 0.9);
    BpmCrossfadeState.refrain = clampValue(Math.max(BpmCrossfadeState.refrain, 0.44), 0, 0.86);
    if (typeof document !== "undefined" && document.visibilityState !== "hidden") updateAlbumArcUi();
    requestHazamaRuntimeFeedback("arc");
  } else {
    AlbumArcState.chapterTurn *= 0.965;
  }
}

function updateAlbumArcUi() {
  if (typeof document === "undefined") return;
  const select = document.getElementById("auto_arc_mode");
  if (select && select.value !== AlbumArcState.mode) select.value = AlbumArcState.mode;
  const status = document.getElementById("auto_arc_status");
  const chapter = currentAlbumArcChapter();
  if (status) status.textContent = AlbumArcState.mode === "arc36" ? chapter.label : "LIVE";
  if (document.body) {
    document.body.dataset.autoArc = AlbumArcState.mode;
    document.body.dataset.autoArcChapter = AlbumArcState.mode === "arc36" ? chapter.name.toLowerCase() : "";
  }
}

function updateAlbumArcModeFromUI(options = {}) {
  const select = typeof document !== "undefined" ? document.getElementById("auto_arc_mode") : null;
  const nextMode = select ? select.value || "live" : AlbumArcState.mode;
  const changed = nextMode !== AlbumArcState.mode;
  AlbumArcState.mode = nextMode === "arc36" ? "arc36" : "live";
  if (changed || options.reset === true) resetAlbumArc();
  updateAlbumArcUi();
  updateCultureGrammarState({ nudge: changed });
  if (initialized) applyUCMToParams({ force: true });
}

function cultureGrammarByKey(key) {
  return CULTURE_GRAMMARS[key] || CULTURE_GRAMMARS.ambient_room;
}

function albumArcCultureKey() {
  if (!albumArcActive()) return "";
  const chapter = currentAlbumArcChapter()?.name || "";
  return {
    SUBMERGE: "ambient_room",
    MEMORY: "tape_memory",
    BROKEN: "broken_machine",
    GHOST: "ghost_dub",
    ACID: "acid_core",
    EXHALE: "chrome_hymn"
  }[chapter] || "";
}

function autoCultureGrammarKey() {
  const arcKey = albumArcCultureKey();
  if (arcKey) return arcKey;
  const acid = acidPerformanceAmount();
  const inner = typeof TimbreFamilyState !== "undefined" ? TimbreFamilyState.inner || {} : {};
  const genre = typeof GenreBlendState !== "undefined" ? GenreBlendState : {};
  const gradient = typeof GradientState !== "undefined" ? GradientState : {};
  if (acid > 0.28 || AcidLockState.enabled) return "acid_core";
  const reedAmount = typeof TimbreFamilyState !== "undefined" ? TimbreFamilyState.reedBuzz || 0 : 0;
  if (inner.profile === "earthBuzz" || reedAmount > 0.42) return "earth_reed";
  if (EngineParams.bpm < 82 || (genre.ambient || 0) > 0.52) {
    return (gradient.chrome || 0) > (gradient.haze || 0) + 0.1 ? "chrome_hymn" : "ambient_room";
  }
  if ((gradient.memory || 0) > 0.56 || inner.profile === "memoryRefrain") return "tape_memory";
  if ((gradient.micro || 0) > 0.55 || inner.profile === "brokenSplice") return "broken_machine";
  if ((gradient.ghost || 0) > 0.54 || inner.profile === "ghostBody") return "ghost_dub";
  if ((gradient.chrome || 0) > 0.58 || inner.profile === "chromeHymn") return "chrome_hymn";
  return "tape_memory";
}

function currentCultureGrammarKey() {
  if (CultureGrammarState.selected && CultureGrammarState.selected !== "auto") return CultureGrammarState.selected;
  return autoCultureGrammarKey();
}

function updateCultureGrammarState(options = {}) {
  const key = currentCultureGrammarKey();
  const grammar = cultureGrammarByKey(key);
  const changed = key !== CultureGrammarState.active;
  CultureGrammarState.lastActive = CultureGrammarState.active;
  CultureGrammarState.active = key;
  CultureGrammarState.label = grammar.label;
  CultureGrammarState.strength = CultureGrammarState.selected === "auto" ? 0.72 : 0.9;
  if (changed && options.nudge !== false) {
    BpmCrossfadeState.refrain = clampValue(Math.max(BpmCrossfadeState.refrain, grammar.refrain || 0), 0, 0.86);
    if (grammar.family) {
      const familyKey = Object.entries(grammar.family).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]?.[0];
      if (familyKey && INNER_SOURCE_FAMILY_KEYS.includes(familyKey)) nudgeInnerSourceFamily(familyKey, 0.018);
    }
  }
  if (changed || options.forceUi === true) updateCultureGrammarUi();
  return grammar;
}

function currentCultureGrammar() {
  return cultureGrammarByKey(CultureGrammarState.active || currentCultureGrammarKey());
}

function cultureGrammarBias(section, key, scale = 1) {
  const grammar = currentCultureGrammar();
  return (grammar?.[section]?.[key] || 0) * CultureGrammarState.strength * scale;
}

function cultureGenreBias(key) {
  return cultureGrammarBias("genre", key, 0.72);
}

function cultureGradientBias(key) {
  return cultureGrammarBias("gradient", key, 0.82);
}

function cultureFamilyBias(key) {
  return cultureGrammarBias("family", key, 0.86);
}

function cultureRhythmBias(key) {
  return cultureGrammarBias("rhythm", key, 1);
}

function cultureSpaceBias(key) {
  return cultureGrammarBias("space", key, 1);
}

function cultureGestureBias(key) {
  return cultureGrammarBias("gesture", key, 0.8);
}

function updateCultureGrammarUi() {
  if (typeof document === "undefined") return;
  const select = document.getElementById("culture_grammar_select");
  if (select && select.value !== CultureGrammarState.selected) select.value = CultureGrammarState.selected;
  const status = document.getElementById("culture_grammar_status");
  if (status) status.textContent = CultureGrammarState.label || "AUTO";
  if (document.body) {
    document.body.dataset.culture = CultureGrammarState.active || "";
    document.body.dataset.cultureMode = CultureGrammarState.selected || "auto";
  }
}

function updateCultureGrammarFromUI(options = {}) {
  const select = typeof document !== "undefined" ? document.getElementById("culture_grammar_select") : null;
  const next = select ? select.value || "auto" : CultureGrammarState.selected;
  CultureGrammarState.selected = CULTURE_GRAMMAR_OPTIONS[next] ? next : "auto";
  updateCultureGrammarState({ nudge: options.nudge !== false, forceUi: true });
  if (initialized && options.apply !== false) applyUCMToParams({ force: options.force === true });
  publishMusicRuntimeState();
  requestHazamaRuntimeFeedback("culture");
}

function oddLogicMoveByKey(key) {
  return ODD_LOGIC_MOVES[key] || ODD_LOGIC_MOVES.soft_wrong_lullaby;
}

function currentOddLogicMove() {
  return oddLogicMoveByKey(OddLogicDirectorState.move);
}

function oddLogicModeAmount() {
  if (OddLogicDirectorState.mode === "off") return 0;
  if (OddLogicDirectorState.mode === "wild") return 0.95;
  if (OddLogicDirectorState.mode === "rare") return 0.48;
  return 0.68;
}

function oddLogicShouldRun() {
  return !!(isPlaying && OddLogicDirectorState.mode !== "off" && (UCM.auto.enabled || albumArcActive() || HazamaBridgeState.active));
}

function computeOddLogicWantVector() {
  const lowGuard = MixGovernorState.lowGuard || 0;
  const family = TimbreFamilyState || {};
  const gradient = GradientState || {};
  const genre = GenreBlendState || {};
  const acid = acidPerformanceAmount();
  const hazamaDeep = HazamaBridgeState.active
    ? clampValue((HazamaBridgeState.marks || 0) / 120 + (100 - (HazamaBridgeState.stability || 50)) / 180 + (HazamaBridgeState.stage === "submerge" ? 0.2 : 0), 0, 1)
    : 0;
  const longSameMove = clampValue((GrooveState.cycle - OddLogicDirectorState.lastMoveCycle) / 48, 0, 1);
  return {
    wantsGlass: clampValue((1 - (gradient.chrome || 0)) * 0.3 + (1 - (family.voiceDust || 0)) * 0.18 + lowGuard * 0.12 + genre.ambient * 0.08, 0, 1),
    wantsBreak: clampValue((1 - (gradient.micro || 0)) * 0.26 + (1 - OrganicChaosState.tangle) * 0.16 + genre.idm * 0.1 + longSameMove * 0.1, 0, 1),
    wantsAir: clampValue(lowGuard * 0.3 + (family.sub808 || 0) * 0.14 + (1 - DepthState.tail) * 0.16 + (PerformancePadState.void ? 0.2 : 0), 0, 1),
    wantsRefrain: clampValue((1 - (MotifMemoryState.strength || 0)) * 0.24 + (1 - BpmCrossfadeState.refrain) * 0.12 + longSameMove * 0.14, 0, 1),
    wantsRubber: clampValue(acid * 0.58 + (AcidLockState.enabled ? 0.34 : 0) + albumArcAcidDrive() * 0.28, 0, 1),
    wantsReed: clampValue(hazamaDeep * 0.32 + (CultureGrammarState.active === "earth_reed" ? 0.24 : 0) + (EngineParams.bpm < 82 ? 0.12 : 0), 0, 1),
    wantsVoid: clampValue(unitValue(UCM_CUR.void) * 0.24 + DepthState.tail * 0.1 + (albumArcActive() && currentAlbumArcChapter()?.name === "EXHALE" ? 0.26 : 0) + hazamaDeep * 0.12, 0, 1)
  };
}

function dominantOddWant(vector) {
  let bestKey = "wantsGlass";
  let bestValue = -1;
  for (const [key, value] of Object.entries(vector || {})) {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }
  return bestKey.replace(/^wants/, "").toLowerCase();
}

function oddLogicArcMoveBias(key) {
  if (!albumArcActive()) return 0;
  const chapter = currentAlbumArcChapter()?.name || "";
  const map = {
    SUBMERGE: { soft_wrong_lullaby: 0.12, chrome_hymn_bend: 0.1, earth_nasal_drone: 0.1, void_afterimage: 0.08 },
    MEMORY: { soft_wrong_lullaby: 0.12, toy_color_flash: 0.1, chrome_hymn_bend: 0.03 },
    BROKEN: { dry_machine_crumbs: 0.18, toy_color_flash: 0.08, sub_joke_turn: 0.04 },
    GHOST: { rain_ghost_body: 0.16, sub_joke_turn: 0.1, void_afterimage: 0.06 },
    ACID: { rubber_acid_prank: 0.24, sub_joke_turn: 0.14, dry_machine_crumbs: 0.06 },
    EXHALE: { chrome_hymn_bend: 0.18, void_afterimage: 0.14, soft_wrong_lullaby: 0.08, earth_nasal_drone: 0.04 }
  };
  return map[chapter]?.[key] || 0;
}

function chooseOddLogicMove(vector, options = {}) {
  const entries = Object.entries(ODD_LOGIC_MOVES);
  const phase = fractionalPart((GrooveState.cycle + 1 + OddLogicDirectorState.generation * 5) * GOLDEN_RATIO_INVERSE);
  const culture = CultureGrammarState.active || "ambient_room";
  const acid = acidPerformanceAmount();
  const weights = entries.map(([key, move], index) => {
    let weight = 0.03 + oddLogicArcMoveBias(key);
    for (const [wantKey, amount] of Object.entries(move.want || {})) {
      weight += (vector[wantKey] || 0) * amount;
    }
    if (culture === "acid_core" && (key === "rubber_acid_prank" || key === "sub_joke_turn")) weight += 0.14;
    if (culture === "broken_machine" && key === "dry_machine_crumbs") weight += 0.12;
    if (culture === "tape_memory" && key === "soft_wrong_lullaby") weight += 0.1;
    if (culture === "chrome_hymn" && (key === "chrome_hymn_bend" || key === "void_afterimage")) weight += 0.1;
    if (culture === "earth_reed" && key === "earth_nasal_drone") weight += 0.16;
    if (acid < 0.12 && key === "rubber_acid_prank") weight *= 0.36;
    if (EngineParams.bpm < 84 && (key === "rubber_acid_prank" || key === "sub_joke_turn")) weight *= 0.42;
    weight += fractionalPart((index + 1) * GOLDEN_RATIO_INVERSE + phase) * 0.035;
    return [key, Math.max(0, weight)];
  });

  if (options.avoidCurrent !== false && weights.length > 1) {
    const current = OddLogicDirectorState.move;
    for (const item of weights) {
      if (item[0] === current) item[1] *= 0.45;
    }
  }

  const total = weights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  let pick = (options.force ? Math.random() : phase) * total;
  for (const [key, weight] of weights) {
    pick -= weight;
    if (pick <= 0) return key;
  }
  return weights[0][0];
}

function setOddLogicMove(key, options = {}) {
  const move = oddLogicMoveByKey(key);
  const changed = key !== OddLogicDirectorState.move;
  OddLogicDirectorState.move = key;
  OddLogicDirectorState.label = move.label || "WANT.IDEA";
  OddLogicDirectorState.want = dominantOddWant(OddLogicDirectorState.vector);
  OddLogicDirectorState.active = OddLogicDirectorState.intensity > 0.03 || oddLogicShouldRun();
  if (changed || options.cue === true) {
    OddLogicDirectorState.lastMoveCycle = GrooveState.cycle;
    OddLogicDirectorState.generation += 1;
    OddLogicDirectorState.cuePending = isPlaying;
    BpmCrossfadeState.refrain = clampValue(Math.max(BpmCrossfadeState.refrain, 0.14 + (move.rhythmBias?.repeat || 0) * 0.5), 0, 0.86);
    const familyKey = Object.entries(move.familyBias || {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]?.[0];
    if (familyKey && typeof nudgeInnerSourceFamily === "function") nudgeInnerSourceFamily(familyKey, 0.016 + OddLogicDirectorState.intensity * 0.02);
    requestHazamaRuntimeFeedback("proposal");
  }
  updateOddLogicUi();
}

function requestOddLogicProposal(options = {}) {
  const vector = computeOddLogicWantVector();
  OddLogicDirectorState.vector = vector;
  OddLogicDirectorState.askPulse = options.source === "ask" ? 1 : OddLogicDirectorState.askPulse;
  OddLogicDirectorState.intensity = clampValue(Math.max(OddLogicDirectorState.intensity, options.source === "ask" ? 0.72 : oddLogicModeAmount() * 0.55), 0, 1);
  const key = chooseOddLogicMove(vector, { force: options.source === "ask", avoidCurrent: true });
  setOddLogicMove(key, { cue: options.cue !== false });
  if (initialized && options.apply !== false) applyUCMToParams({ force: options.force === true });
  publishMusicRuntimeState();
}

function advanceOddLogicDirectorPhrase() {
  if (OddLogicDirectorState.lastCycle === GrooveState.cycle) return;
  OddLogicDirectorState.lastCycle = GrooveState.cycle;
  const canRun = oddLogicShouldRun();
  const vector = computeOddLogicWantVector();
  OddLogicDirectorState.vector = vector;
  const modeAmount = oddLogicModeAmount();
  const pulse = (Math.sin((GrooveState.cycle + 1) * 0.23 + OddLogicDirectorState.generation * 0.71) + 1) / 2;
  const rdjNudge = canRun ? RdjGrowthState.wrong * 0.04 + RdjGrowthState.edit * 0.025 : 0;
  const target = canRun ? modeAmount * (0.74 + pulse * 0.18 + rdjNudge) : OddLogicDirectorState.askPulse * 0.5;
  OddLogicDirectorState.intensity = approachValue(OddLogicDirectorState.intensity, target, OddLogicDirectorState.mode === "wild" ? 0.16 : 0.08);
  OddLogicDirectorState.active = OddLogicDirectorState.intensity > 0.04;
  OddLogicDirectorState.phase = fractionalPart((GrooveState.cycle + OddLogicDirectorState.generation + 1) * GOLDEN_RATIO_INVERSE);

  const gap = OddLogicDirectorState.mode === "wild" ? 6 : OddLogicDirectorState.mode === "rare" ? 28 : 14;
  const chapterKick = albumArcActive() && AlbumArcState.chapterTurn > 0.42;
  const wantKick = Math.max(...Object.values(vector)) > 0.58 && GrooveState.cycle - OddLogicDirectorState.lastMoveCycle > Math.floor(gap * 0.58);
  if (canRun && (chapterKick || wantKick || GrooveState.cycle - OddLogicDirectorState.lastMoveCycle >= gap)) {
    setOddLogicMove(chooseOddLogicMove(vector, { avoidCurrent: true }), { cue: true });
  } else {
    OddLogicDirectorState.want = dominantOddWant(vector);
    updateOddLogicUi();
  }
}

function decayOddLogicDirector() {
  OddLogicDirectorState.askPulse *= 0.88;
  if (!oddLogicShouldRun() && OddLogicDirectorState.askPulse < 0.04) {
    OddLogicDirectorState.intensity = approachValue(OddLogicDirectorState.intensity, 0, 0.06);
    OddLogicDirectorState.active = OddLogicDirectorState.intensity > 0.04;
  }
}

function oddLogicBias(section, key, scale = 1) {
  if (OddLogicDirectorState.mode === "off") return 0;
  const move = currentOddLogicMove();
  return (move?.[section]?.[key] || 0) * clampValue(OddLogicDirectorState.intensity, 0, 1) * scale;
}

function oddLogicGradientBias(key) {
  return oddLogicBias("gradientBias", key, 0.72);
}

function oddLogicFamilyBias(key) {
  return oddLogicBias("familyBias", key, 0.78);
}

function oddLogicRhythmBias(key) {
  return oddLogicBias("rhythmBias", key, 1);
}

function oddLogicSpaceBias(key) {
  return oddLogicBias("spaceBias", key, 1);
}

function oddLogicGestureBias(key) {
  return oddLogicBias("gestureHint", key, 0.72);
}

function oddLogicTempoBias() {
  if (OddLogicDirectorState.mode === "off") return 0;
  return (currentOddLogicMove().tempoBias || 0) * clampValue(OddLogicDirectorState.intensity, 0, 1);
}

function oddLogicSourceProfileName() {
  if (OddLogicDirectorState.mode === "off" || OddLogicDirectorState.intensity < 0.22) return "";
  return {
    soft_wrong_lullaby: "memoryRefrain",
    toy_color_flash: "chromeHymn",
    dry_machine_crumbs: "brokenSplice",
    rubber_acid_prank: "coldPulse",
    rain_ghost_body: "ghostBody",
    chrome_hymn_bend: "chromeHymn",
    earth_nasal_drone: "earthBuzz",
    sub_joke_turn: "ghostBody",
    void_afterimage: "hazeBed"
  }[OddLogicDirectorState.move] || "";
}

function updateOddLogicUi() {
  if (typeof document === "undefined") return;
  const select = document.getElementById("odd_logic_mode");
  if (select && select.value !== OddLogicDirectorState.mode) select.value = OddLogicDirectorState.mode;
  const status = document.getElementById("odd_logic_status");
  if (status) {
    status.textContent = OddLogicDirectorState.mode === "off"
      ? "OFF"
      : OddLogicDirectorState.active
        ? OddLogicDirectorState.label
        : `WANT.${(OddLogicDirectorState.want || "glass").toUpperCase()}`;
  }
  if (document.body) {
    document.body.dataset.oddLogic = OddLogicDirectorState.mode;
    document.body.dataset.oddLogicMove = OddLogicDirectorState.active ? OddLogicDirectorState.move : "";
  }
}

function updateOddLogicFromUI(options = {}) {
  const select = typeof document !== "undefined" ? document.getElementById("odd_logic_mode") : null;
  const next = select ? select.value || "auto" : OddLogicDirectorState.mode;
  OddLogicDirectorState.mode = ODD_LOGIC_OPTIONS[next] ? next : "auto";
  if (OddLogicDirectorState.mode === "off") {
    OddLogicDirectorState.active = false;
    OddLogicDirectorState.cuePending = false;
    OddLogicDirectorState.intensity = 0;
  } else if (options.propose !== false) {
    requestOddLogicProposal({ source: "ui", cue: false, apply: options.apply });
  }
  updateOddLogicUi();
  publishMusicRuntimeState();
  requestHazamaRuntimeFeedback("proposal");
}

function triggerOddLogicProposalCue(step, time, context = {}) {
  if (!OddLogicDirectorState.cuePending || OddLogicDirectorState.mode === "off" || !isPlaying) return;
  if (OddLogicDirectorState.lastCueCycle === GrooveState.cycle && step !== 0) return;
  if (!(step % 4 === 0 || step % 8 === 5)) return;

  const moveKey = OddLogicDirectorState.move;
  const move = currentOddLogicMove();
  const intensity = clampValue(OddLogicDirectorState.intensity + OddLogicDirectorState.askPulse * 0.35, 0.18, 1);
  const lowGuard = MixGovernorState.lowGuard || 0;
  const seed = move.motifSeed || "D5";
  OddLogicDirectorState.cuePending = false;
  OddLogicDirectorState.lastCueCycle = GrooveState.cycle;

  try {
    if (moveKey === "rubber_acid_prank" && bass && !PerformancePadState.void) {
      safeToneRamp(bass?.filter?.frequency, 460 + intensity * 720 - lowGuard * 180, 0.045);
      safeToneRamp(bass?.filter?.Q, 3.2 + intensity * 3.8 - lowGuard, 0.045);
      bass.triggerAttackRelease(tonalRhymeLow(step, 2), "64n", time + 0.012, clampValue(0.07 + intensity * 0.09 - lowGuard * 0.04, 0.045, 0.18));
      if (glass) glass.triggerAttackRelease(tonalRhymeHigh(step, 1), "64n", time + 0.044, clampValue(0.018 + intensity * 0.04, 0.014, 0.07));
    } else if (moveKey === "earth_nasal_drone" && reedBuzz) {
      reedBuzz.triggerAttackRelease(tonalRhymeSub(step, -1), "2n", time + 0.018, clampValue(0.026 + intensity * 0.048 - lowGuard * 0.02, 0.018, 0.08));
    } else if (moveKey === "void_afterimage" && pad) {
      pad.triggerAttackRelease(randomHazeChord(), "1n", time + 0.018, clampValue(0.025 + intensity * 0.036, 0.018, 0.07));
      if (glass) glass.triggerAttackRelease(voiceFragment(step, TRANSPARENT_AIR_FRAGMENTS), "16n", time + 0.075, clampValue(0.018 + intensity * 0.034, 0.014, 0.064));
    } else if (moveKey === "sub_joke_turn" && subImpact && !PerformancePadState.void) {
      subImpact.triggerAttackRelease(tonalRhymeSub(step, 1), "32n", time + 0.006, clampValue(0.045 + intensity * 0.075 - lowGuard * 0.04, 0.028, 0.16));
      if (bass) bass.triggerAttackRelease(tonalRhymeLow(step, 3), "64n", time + 0.05, clampValue(0.045 + intensity * 0.048 - lowGuard * 0.025, 0.03, 0.12));
    } else if (moveKey === "rain_ghost_body" && voiceDust) {
      voiceDust.triggerAttackRelease(seed, "8n", time + 0.036, clampValue(0.016 + intensity * 0.046, 0.012, 0.074));
      if (drumSkin && !PerformancePadState.void) drumSkin.triggerAttackRelease("64n", time + 0.018, clampValue(0.018 + intensity * 0.038, 0.014, 0.07));
    } else if (moveKey === "dry_machine_crumbs" && texture) {
      texture.triggerAttackRelease("64n", time + 0.012, clampValue(0.024 + intensity * 0.06, 0.018, 0.09));
      if (glass) glass.triggerAttackRelease(tonalRhymeHigh(step, 4), "64n", time + 0.046, clampValue(0.016 + intensity * 0.04, 0.012, 0.066));
    } else if (glass) {
      const pool = moveKey === "chrome_hymn_bend" || moveKey === "toy_color_flash" ? TRANSPARENT_AIR_FRAGMENTS : ORGANIC_PLUCK_FRAGMENTS;
      const first = voiceFragment(step, pool);
      const second = voiceFragment(step + 3, pool);
      glass.triggerAttackRelease(first, "32n", time + 0.018, clampValue(0.022 + intensity * 0.052, 0.016, 0.09));
      if (moveKey === "toy_color_flash" || moveKey === "soft_wrong_lullaby") {
        glass.triggerAttackRelease(second, "64n", time + 0.072, clampValue(0.014 + intensity * 0.034, 0.012, 0.058));
      }
    }
    rememberMotif(seed, {
      reply: moveKey === "rubber_acid_prank" ? tonalRhymeHigh(step, 1) : voiceFragment(step + 2, TRANSPARENT_AIR_FRAGMENTS),
      shade: tonalRhymeLow(step, 1),
      strength: 0.035 + intensity * 0.07,
      air: moveKey === "void_afterimage" || moveKey === "chrome_hymn_bend" ? 0.16 : 0.06,
      source: `odd:${moveKey}`
    });
    markMixEvent(0.05 + intensity * 0.06);
  } catch (error) {
    console.warn("[Music] odd logic cue failed:", error);
  }
}

function nudgeLongformArcFromGesture(name, source = "manual") {
  if (!isPlaying) return;
  const scale = source === "auto" ? 0.55 : 0.85;
  const shape = {
    drift: { breath: 0.05, contrast: 0.035, turn: 0.055 },
    repeat: { breath: -0.015, contrast: 0.075, turn: 0.075 },
    punch: { breath: -0.035, contrast: 0.09, turn: 0.085 },
    void: { breath: 0.07, contrast: -0.01, turn: 0.065 }
  }[name] || { breath: 0.02, contrast: 0.025, turn: 0.04 };

  LongformArcState.breath = clampValue(LongformArcState.breath + shape.breath * scale, 0.16, 0.84);
  LongformArcState.contrast = clampValue(LongformArcState.contrast + shape.contrast * scale, 0.06, 0.62);
  LongformArcState.turn = clampValue(LongformArcState.turn + shape.turn * scale, 0, 0.82);
}

function autoDirectorSceneBias(key) {
  if (!UCM.auto.enabled || !isPlaying) return 0;
  const scene = currentAutoDirectorScene();
  const sceneLength = Math.max(1, scene.length || 1);
  const progress = clampValue(AutoDirectorState.phrase / sceneLength, 0, 1);
  const phraseShape = 0.72 + Math.sin(progress * Math.PI) * 0.28;
  const intensity = clampValue(AutoDirectorState.intensity, 0.35, 0.9);
  return (scene.bias?.[key] || 0) * phraseShape * intensity;
}

function resetAutoDirector() {
  AutoDirectorState.sceneIndex = 0;
  AutoDirectorState.phrase = 0;
  AutoDirectorState.intensity = 0.58;
  AutoDirectorState.cadence = "";
  AutoDirectorState.lastScene = currentAutoDirectorScene().name;
}

function advanceAutoDirectorPhrase() {
  if (!effectiveAutoPerformanceActive() || !isPlaying) return;
  const scene = currentAutoDirectorScene();
  AutoDirectorState.phrase += 1;
  if (AutoDirectorState.phrase >= (scene.length || 4)) {
    AutoDirectorState.sceneIndex = (AutoDirectorState.sceneIndex + 1) % AUTO_DIRECTOR_SCENES.length;
    AutoDirectorState.phrase = 0;
    AutoDirectorState.intensity = clampValue(0.48 + Math.random() * 0.24 + organicChaosAmount() * 0.1, 0.44, 0.84);
    AutoDirectorState.cadence = "scene";
    AutoDirectorState.lastScene = currentAutoDirectorScene().name;
    return;
  }

  if (AutoDirectorState.phrase % 2 === 0) {
    AutoDirectorState.cadence = "phrase";
  }
}

function chooseAutoGesture(context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    voidNorm,
    circleNorm
  } = context;
  const scene = currentAutoDirectorScene();
  const weighted = [
    ["drift", 0.18 + waveNorm * 0.3 + observerNorm * 0.12 + circleNorm * 0.1 + OrganicChaosState.airPull * 0.08 + (scene.gesture?.drift || 0) + longformArcGestureBias("drift") + albumArcGestureBias("drift") + cultureGestureBias("drift") + oddLogicGestureBias("drift")],
    ["repeat", 0.16 + creationNorm * 0.28 + resourceNorm * 0.22 + waveNorm * 0.08 + OrganicChaosState.tangle * 0.12 + (scene.gesture?.repeat || 0) + longformArcGestureBias("repeat") + albumArcGestureBias("repeat") + cultureGestureBias("repeat") + oddLogicGestureBias("repeat")],
    ["punch", 0.1 + energyNorm * 0.16 + UCM_CUR.body / 100 * 0.12 + OrganicChaosState.lowMotion * 0.1 + (scene.gesture?.punch || 0) + longformArcGestureBias("punch") + albumArcGestureBias("punch") + cultureGestureBias("punch") + oddLogicGestureBias("punch")],
    ["void", 0.12 + voidNorm * 0.22 + observerNorm * 0.16 + circleNorm * 0.08 + OrganicChaosState.impulse * 0.06 + (scene.gesture?.void || 0) + longformArcGestureBias("void") + albumArcGestureBias("void") + cultureGestureBias("void") + oddLogicGestureBias("void")]
  ];
  const total = weighted.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let pick = Math.random() * total;
  for (const [name, weight] of weighted) {
    pick -= Math.max(0, weight);
    if (pick <= 0) return name;
  }
  return "drift";
}

function startAutoPerformanceGesture(name) {
  if (!Object.prototype.hasOwnProperty.call(PerformancePadState, name)) return;
  cancelAutoGesture({ clearPad: true });

  const now = performanceNowMs();
  const seq = AutoGestureState.seq + 1;
  AutoGestureState.seq = seq;
  AutoGestureState.active = name;
  AutoGestureState.lastAt = now;
  setPerformancePad(name, true, { source: "auto" });

  const pad = typeof document !== "undefined" ? document.querySelector(`[data-performance-pad="${name}"]`) : null;
  if (pad) pad.classList.add("active");

  const duration = (AUTO_GESTURE_DURATIONS[name] || 720) + Math.random() * 180;
  AutoGestureState.timer = setTimeout(() => {
    if (AutoGestureState.seq !== seq || AutoGestureState.active !== name) return;
    PerformancePadState[name] = 0;
    AutoGestureState.active = "";
    AutoGestureState.timer = null;
    if (pad) pad.classList.remove("active");
    if (initialized) updateTimbreStateFromWorld(currentGradientParts());
    updatePerformancePadDataset();
    updatePerformancePadStatus();
  }, duration);
}

function maybeTriggerAutoPerformanceGesture(step, context) {
  if (!effectiveAutoPerformanceActive() || !isPlaying) return;
  const now = performanceNowMs();
  if (hasActivePerformancePad()) return;
  if (now - PerformancePadState.lastTouchAt < AUTO_GESTURE_MANUAL_GRACE_MS) return;
  if (now - AutoGestureState.lastAt < AUTO_GESTURE_MIN_GAP_MS) return;
  if (!(step % 8 === 0 || step % 8 === 4)) return;

  const scene = currentAutoDirectorScene();
  const arcLift = longformArcActive() ? LongformArcState.contrast * 0.026 + LongformArcState.turn * 0.018 : 0;
  const albumLift = albumArcActive() ? 0.018 + AlbumArcState.chapterTurn * 0.025 + albumArcAcidDrive() * 0.026 : 0;
  const oddLift = OddLogicDirectorState.active ? 0.012 + OddLogicDirectorState.intensity * 0.026 : 0;
  const chanceValue = 0.11 + (scene.gestureChance || 0.03) + context.creationNorm * 0.045 + context.observerNorm * 0.032 + context.waveNorm * 0.032 + context.resourceNorm * 0.022 + arcLift + albumLift + oddLift;
  if (!rand(chance(chanceValue))) return;
  startAutoPerformanceGesture(chooseAutoGesture(context));
}

function exciteOrganicChaos(name, source = "manual") {
  const autoScale = source === "auto" ? 0.82 : 1;
  const shape = {
    drift: { impulse: 0.3, tangle: 0.42, lowMotion: 0.08, airPull: 0.38 },
    repeat: { impulse: 0.36, tangle: 0.54, lowMotion: 0.18, airPull: 0.18 },
    punch: { impulse: 0.46, tangle: 0.28, lowMotion: 0.42, airPull: 0.08 },
    void: { impulse: 0.26, tangle: 0.24, lowMotion: 0.04, airPull: 0.56 }
  }[name] || { impulse: 0.24, tangle: 0.26, lowMotion: 0.12, airPull: 0.18 };

  OrganicChaosState.impulse = clampValue(OrganicChaosState.impulse + shape.impulse * autoScale, 0, 1);
  OrganicChaosState.tangle = clampValue(OrganicChaosState.tangle + shape.tangle * autoScale, 0, 1);
  OrganicChaosState.lowMotion = clampValue(OrganicChaosState.lowMotion + shape.lowMotion * autoScale, 0, 1);
  OrganicChaosState.airPull = clampValue(OrganicChaosState.airPull + shape.airPull * autoScale, 0, 1);
  OrganicChaosState.lastGesture = name;
  OrganicChaosState.lastAt = performanceNowMs();
}

function decayOrganicChaos() {
  OrganicChaosState.impulse *= 0.9;
  OrganicChaosState.tangle *= 0.92;
  OrganicChaosState.lowMotion *= 0.91;
  OrganicChaosState.airPull *= 0.93;
  if (OrganicChaosState.impulse < 0.001) OrganicChaosState.impulse = 0;
  if (OrganicChaosState.tangle < 0.001) OrganicChaosState.tangle = 0;
  if (OrganicChaosState.lowMotion < 0.001) OrganicChaosState.lowMotion = 0;
  if (OrganicChaosState.airPull < 0.001) OrganicChaosState.airPull = 0;
}

function resetOrganicChaos() {
  OrganicChaosState.impulse = 0;
  OrganicChaosState.tangle = 0;
  OrganicChaosState.lowMotion = 0;
  OrganicChaosState.airPull = 0;
  OrganicChaosState.lastGesture = "";
  OrganicChaosState.lastAt = 0;
}

function organicChaosAmount() {
  return clampValue(
    OrganicChaosState.impulse * 0.28 +
      OrganicChaosState.tangle * 0.34 +
      OrganicChaosState.lowMotion * 0.18 +
      OrganicChaosState.airPull * 0.2,
    0,
    1
  );
}

function tonalRhymeIndex(step = stepIndex, offset = 0, span = 8) {
  const safeSpan = Math.max(1, Math.round(Number(span) || 8));
  const phaseOffset = Math.floor((GenomeState.phase || 0) * safeSpan);
  const refrainOffset = Math.floor((MotifMemoryState.strength || 0) * 5);
  const voiceOffset = Math.floor((VoiceEmergenceState?.refrain || 0) * 4);
  const index = GrooveState.cycle + step + phaseOffset + refrainOffset + voiceOffset + TonalRhymeState.stepOffset + offset;
  return ((index % safeSpan) + safeSpan) % safeSpan;
}

function syncMelodicDirectorBassRoot() {
  switch (EngineParams.mode) {
    case "ambient":
      bassRoot = tonalRhymeSub(stepIndex, -1);
      break;
    case "lofi":
    case "jazz":
      bassRoot = tonalRhymeSub(stepIndex, 0);
      break;
    case "dub":
      bassRoot = tonalRhymeSub(stepIndex, 1);
      break;
    case "funk":
      bassRoot = tonalRhymeSub(stepIndex, 2);
      break;
    case "techno":
      bassRoot = tonalRhymeSub(stepIndex, 1);
      break;
    case "trance":
      bassRoot = tonalRhymeSub(stepIndex, 2);
      break;
    default:
      bassRoot = tonalRhymeSub(stepIndex, 0);
      break;
  }
}

function tonalRhymeNote(pool, step = stepIndex, offset = 0, options = {}) {
  const note = pool[tonalRhymeIndex(step, offset, pool.length) % pool.length];
  return melodicDirectorNote(note, step, offset, options);
}

function tonalRhymeSub(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_SUB, step, TonalRhymeState.lowOffset + offset, { role: "low", contour: false });
}

function tonalRhymeLow(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_LOW, step, TonalRhymeState.lowOffset + offset, { role: "low", contour: false });
}

function tonalRhymeMid(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_MID, step, offset, { role: "mid" });
}

function tonalRhymeHigh(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_HIGH, step, offset, { role: "voice" });
}

function advanceTonalRhymePhrase() {
  if (TonalRhymeState.lastCycle === GrooveState.cycle) return;
  TonalRhymeState.lastCycle = GrooveState.cycle;
  if (GrooveState.cycle % 2 !== 0) return;

  const phrase = Math.floor(GrooveState.cycle / 2);
  TonalRhymeState.phrase = phrase;
  TonalRhymeState.stepOffset = Math.floor(fractionalPart((phrase + GenomeState.generation + 1) * GOLDEN_RATIO_INVERSE) * 8);
  TonalRhymeState.lowOffset = (phrase + Math.floor((MotifMemoryState.strength || 0) * 4) + (acidPerformanceAmount() > 0.18 ? 2 : 0)) % 4;
}

function rememberMotif(root, options = {}) {
  if (!root) return;
  MotifMemoryState.root = root;
  MotifMemoryState.reply = options.reply || root;
  MotifMemoryState.shade = options.shade || root;
  MotifMemoryState.strength = clampValue(MotifMemoryState.strength * 0.72 + (options.strength || 0.16), 0, 1);
  MotifMemoryState.air = clampValue(MotifMemoryState.air * 0.62 + (options.air || 0), 0, 1);
  MotifMemoryState.lastStep = stepIndex;
  MotifMemoryState.source = options.source || "";
}

function rememberGestureMotif(name, source = "manual") {
  const autoScale = source === "auto" ? 0.78 : 1;
  const offset = { drift: 1, repeat: 3, punch: 5, void: 2 }[name] || 0;
  const airy = name === "void" || name === "drift";
  const root = airy ? tonalRhymeHigh(stepIndex, offset) : tonalRhymeMid(stepIndex, offset);
  const reply = tonalRhymeHigh(stepIndex, offset + 2);
  const shade = name === "punch" ? tonalRhymeLow(stepIndex, offset + 1) : tonalRhymeMid(stepIndex, offset + 1);
  rememberMotif(root, {
    reply,
    shade,
    strength: (0.22 + OrganicChaosState.impulse * 0.1) * autoScale,
    air: name === "void" || name === "drift" ? 0.28 * autoScale : 0.1 * autoScale,
    source: name
  });
}

function decayMotifMemory() {
  MotifMemoryState.strength *= 0.972;
  MotifMemoryState.air *= 0.968;
  if (MotifMemoryState.strength < 0.001) MotifMemoryState.strength = 0;
  if (MotifMemoryState.air < 0.001) MotifMemoryState.air = 0;
}

function decayBpmCrossfadeMemory() {
  BpmCrossfadeState.blend *= 0.93;
  BpmCrossfadeState.refrain *= 0.968;
  if (BpmCrossfadeState.blend < 0.001) BpmCrossfadeState.blend = 0;
  if (BpmCrossfadeState.refrain < 0.001) BpmCrossfadeState.refrain = 0;
}

function decayGenerativeGenome() {
  GenomeState.resonance *= 0.982;
  if (GenomeState.resonance < 0.001) GenomeState.resonance = 0;
}

function resetMotifMemory() {
  MotifMemoryState.strength = 0;
  MotifMemoryState.air = 0;
  MotifMemoryState.lastStep = -99;
  MotifMemoryState.source = "";
  TonalRhymeState.phrase = 0;
  TonalRhymeState.stepOffset = 0;
  TonalRhymeState.lowOffset = 0;
  TonalRhymeState.lastCycle = -1;
  resetBpmCrossfadeMemory();
}

function resetBpmCrossfadeMemory() {
  BpmCrossfadeState.zone = "ambient";
  BpmCrossfadeState.previousZone = "ambient";
  BpmCrossfadeState.blend = 0;
  BpmCrossfadeState.refrain = 0;
  BpmCrossfadeState.lastCrossCycle = -99;
  BpmCrossfadeState.motifRoot = "D5";
  BpmCrossfadeState.motifReply = "F#5";
  BpmCrossfadeState.motifShade = "D4";
  BpmCrossfadeState.motifIndex = 0;
}

function resetGenerativeGenome() {
  GenomeState.generation = 0;
  GenomeState.phase = 0;
  GenomeState.growth = 0.22;
  GenomeState.mutation = 0.12;
  GenomeState.resonance = 0;
  GenomeState.lastPulseCycle = -99;
  GenomeState.root = "D5";
  GenomeState.reply = "F#5";
  GenomeState.shade = "D4";
  GenomeState.genes.haze = 0.48;
  GenomeState.genes.pulse = 0.34;
  GenomeState.genes.micro = 0.36;
  GenomeState.genes.chrome = 0.4;
  GenomeState.genes.organic = 0.42;
  GenomeState.genes.pressure = 0.24;
  GenomeState.genes.refrain = 0.36;
  GenomeState.genes.voidTail = 0.32;
}

function advancePerformanceColorDrift() {
  if (PerformanceColorDriftState.lastCycle === GrooveState.cycle) return;
  PerformanceColorDriftState.lastCycle = GrooveState.cycle;

  const cycle = GrooveState.cycle + 1;
  updateAcidLockIntensity(0.028);
  const acid = acidPerformanceAmount();
  const energy = clampValue(UCM_CUR.energy / 100, 0, 1);
  const creation = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resource = clampValue(UCM_CUR.resource / 100, 0, 1);
  const observer = clampValue(UCM_CUR.observer / 100, 0, 1);
  const voidness = clampValue(UCM_CUR.void / 100, 0, 1);
  const bpmNorm = clampValue((EngineParams.bpm - 58) / 86, 0, 1);
  const phase = fractionalPart(cycle * 0.034 + GenomeState.generation * 0.055 + (acid > 0.08 ? 0.17 : 0));
  const slow = (Math.sin(cycle * 0.13 + phase * Math.PI * 2) + 1) / 2;
  const off = (Math.sin(cycle * 0.071 + 1.9) + 1) / 2;
  const shimmer = (Math.sin(cycle * 0.21 + 0.7) + 1) / 2;

  PerformanceColorDriftState.phase = phase;
  PerformanceColorDriftState.haze = approachValue(
    PerformanceColorDriftState.haze,
    clampValue(0.28 + voidness * 0.26 + observer * 0.12 + (1 - energy) * 0.16 + slow * 0.18 - acid * 0.06, 0, 1),
    0.035
  );
  PerformanceColorDriftState.chrome = approachValue(
    PerformanceColorDriftState.chrome,
    clampValue(0.22 + observer * 0.22 + shimmer * 0.26 + GenomeState.genes.chrome * 0.12 + acid * 0.06, 0, 1),
    0.035
  );
  PerformanceColorDriftState.dust = approachValue(
    PerformanceColorDriftState.dust,
    clampValue(0.2 + creation * 0.2 + resource * 0.14 + off * 0.24 + GenomeState.genes.organic * 0.1, 0, 1),
    0.035
  );
  PerformanceColorDriftState.pressure = approachValue(
    PerformanceColorDriftState.pressure,
    clampValue(energy * 0.2 + resource * 0.16 + bpmNorm * 0.14 + acid * 0.32 + off * 0.1 - voidness * 0.14, 0, 1),
    0.03
  );
  PerformanceColorDriftState.acid = approachValue(
    PerformanceColorDriftState.acid,
    clampValue(acid * (0.38 + bpmNorm * 0.34 + creation * 0.18 + resource * 0.12), 0, 1),
    0.04
  );
}

function resetOrganicEcosystem() {
  OrganicEcosystemState.breath = 0.52;
  OrganicEcosystemState.sprout = 0.18;
  OrganicEcosystemState.ferment = 0.16;
  OrganicEcosystemState.rootTurn = 0.14;
  OrganicEcosystemState.bloom = 0;
  OrganicEcosystemState.lastBloomCycle = -99;
}

function resetLongformArc() {
  LongformArcState.stageIndex = 0;
  LongformArcState.phrase = 0;
  LongformArcState.breath = 0.48;
  LongformArcState.contrast = 0.18;
  LongformArcState.turn = 0;
  LongformArcState.lastStage = currentLongformArcStage().name;
}

function resetMixGovernor() {
  MixGovernorState.lowGuard = 0;
  MixGovernorState.clarity = 0.34;
  MixGovernorState.eventLoad = 0;
  MixGovernorState.lastAirCycle = -99;
}

function resetTimbreFamily() {
  TimbreFamilyState.drumSkin = 0.18;
  TimbreFamilyState.pianoMemory = 0.26;
  TimbreFamilyState.voiceDust = 0.2;
  TimbreFamilyState.acidBiyon = 0;
  TimbreFamilyState.sub808 = 0.14;
  TimbreFamilyState.reedBuzz = 0.06;
  TimbreFamilyState.chain = 0.3;
  TimbreFamilyState.lastReedBuzzCycle = -99;
  TimbreFamilyState.inner.drumSkin = 0.18;
  TimbreFamilyState.inner.pianoMemory = 0.26;
  TimbreFamilyState.inner.voiceDust = 0.2;
  TimbreFamilyState.inner.acidBiyon = 0;
  TimbreFamilyState.inner.sub808 = 0.14;
  TimbreFamilyState.inner.reedBuzz = 0.06;
  TimbreFamilyState.inner.chain = 0.3;
  TimbreFamilyState.inner.bloom = 0;
  TimbreFamilyState.inner.focus = "pianoMemory";
  TimbreFamilyState.inner.profile = "memoryRefrain";
  TimbreFamilyState.inner.profileIndex = 2;
  TimbreFamilyState.inner.generation = 0;
  TimbreFamilyState.inner.lastTick = -1;
}

function resetGenreBlend() {
  GenreBlendState.ambient = 0.45;
  GenreBlendState.idm = 0.34;
  GenreBlendState.techno = 0.14;
  GenreBlendState.pressure = 0.07;
}

function resetGenreTimbreKits() {
  GenreTimbreKitState.ambientKit = 0.44;
  GenreTimbreKitState.idmKit = 0.34;
  GenreTimbreKitState.technoKit = 0.16;
  GenreTimbreKitState.pressureKit = 0.12;
  GenreTimbreKitState.spaceKit = 0.32;
}

function resetModeTimbrePalettes() {
  ModeTimbrePaletteState.lastCycle = -1;
  ModeTimbrePaletteState.phase = 0;
  ModeTimbrePaletteState.active = "ambientHaze";
  ModeTimbrePaletteState.lastDecision = "ambientHaze";
  ModeTimbrePaletteState.weights.ambientHaze = 0.44;
  ModeTimbrePaletteState.weights.idmGlass = 0.34;
  ModeTimbrePaletteState.weights.technoDryGrid = 0.16;
  ModeTimbrePaletteState.weights.pressureGhost = 0.12;
  ModeTimbrePaletteState.weights.voidAir = 0.32;
  ModeTimbrePaletteState.shape.rhythm = 0.22;
  ModeTimbrePaletteState.shape.haze = 0.42;
  ModeTimbrePaletteState.shape.glass = 0.34;
  ModeTimbrePaletteState.shape.texture = 0.24;
  ModeTimbrePaletteState.shape.air = 0.36;
  ModeTimbrePaletteState.shape.pad = 0.42;
  ModeTimbrePaletteState.shape.signature = 0.28;
  ModeTimbrePaletteState.shape.transient = 0.2;
  ModeTimbrePaletteState.shape.lowClamp = 0.16;
  ModeTimbrePaletteState.shape.restraint = 0.48;
  ModeTimbrePaletteState.safety.densityBrake = 0;
  ModeTimbrePaletteState.safety.lowClamp = 0;
  ModeTimbrePaletteState.safety.brightnessDamp = 0;
  ModeTimbrePaletteState.safety.restraint = 0.48;
}

function resetMusicRadioBrain() {
  MusicRadioBrainState.lastCycle = -1;
  MusicRadioBrainState.generation = 0;
  MusicRadioBrainState.phrase = 0;
  MusicRadioBrainState.phraseCycles = 24;
  MusicRadioBrainState.active = "fieldStudy";
  MusicRadioBrainState.next = "glassCoding";
  MusicRadioBrainState.blend = 0;
  MusicRadioBrainState.phase = 0;
  MusicRadioBrainState.lastDecision = "fieldStudy";
  MusicRadioBrainState.lastReason = "initial haze room";
  MusicRadioBrainState.weights.fieldStudy = 0.42;
  MusicRadioBrainState.weights.glassCoding = 0.28;
  MusicRadioBrainState.weights.dryGridWork = 0.12;
  MusicRadioBrainState.weights.ghostPressure = 0.08;
  MusicRadioBrainState.weights.voidRoom = 0.26;
  MusicRadioBrainState.weights.hardTechno = 0.10;
  MusicRadioBrainState.weights.liveJazz = 0.12;
  MusicRadioBrainState.weights.nightFunk = 0.10;
  MusicRadioBrainState.weights.quietPiano = 0.16;
  MusicRadioBrainState.bias.haze = 0.36;
  MusicRadioBrainState.bias.glass = 0.28;
  MusicRadioBrainState.bias.grid = 0.12;
  MusicRadioBrainState.bias.pressure = 0.08;
  MusicRadioBrainState.bias.air = 0.3;
  MusicRadioBrainState.bias.restraint = 0.48;
  MusicRadioBrainState.bias.curiosity = 0.18;
  MusicRadioBrainState.guard.density = 0;
  MusicRadioBrainState.guard.low = 0;
  MusicRadioBrainState.guard.bright = 0;
  MusicRadioBrainState.cuePending = false;
  MusicRadioBrainState.cueProgram = "fieldStudy";
  MusicRadioBrainState.cueCycle = -99;
  MusicRadioBrainState.cueLastStep = -99;
}

function resetBarCounter() {
  BarCounter.current = 0;
  BarCounter.lastModeChangeBar = -999;
  BarCounter.pendingMode = null;
}

function resetPatternVariation() {
  PatternVariation.baseSignature = "";
  PatternVariation.lastVariationBar = -1;
  syncPatternVariationBase({ force: true });
}

function resetDJTempo() {
  const current = Number.isFinite(EngineParams.bpm) ? EngineParams.bpm : 80;
  DJTempoState.bpm = current;
  DJTempoState.targetBpm = current;
  DJTempoState.rawBpm = current;
  DJTempoState.drift = 0;
  DJTempoState.motion = 0;
}

function decayOrganicEcosystem() {
  OrganicEcosystemState.bloom *= 0.9;
  OrganicEcosystemState.sprout *= 0.995;
  OrganicEcosystemState.ferment *= 0.996;
  OrganicEcosystemState.rootTurn *= 0.996;
  if (OrganicEcosystemState.bloom < 0.001) OrganicEcosystemState.bloom = 0;
}

function decayLongformArc() {
  LongformArcState.turn *= 0.92;
  if (LongformArcState.turn < 0.001) LongformArcState.turn = 0;
}

function decayMixGovernor() {
  MixGovernorState.eventLoad *= 0.88;
  if (MixGovernorState.eventLoad < 0.001) MixGovernorState.eventLoad = 0;
}

function decaySignatureCells() {
  if (SignatureCellState.cooldownSteps > 0) {
    SignatureCellState.cooldownSteps = Math.max(0, SignatureCellState.cooldownSteps - 1);
  }
  if (SignatureCellState.lowBreathCooldownSteps > 0) {
    SignatureCellState.lowBreathCooldownSteps = Math.max(0, SignatureCellState.lowBreathCooldownSteps - 1);
  }
  if (SignatureCellState.brokenTextureCooldownSteps > 0) {
    SignatureCellState.brokenTextureCooldownSteps = Math.max(0, SignatureCellState.brokenTextureCooldownSteps - 1);
  }
  if (SignatureCellState.memoryPluckCooldownSteps > 0) {
    SignatureCellState.memoryPluckCooldownSteps = Math.max(0, SignatureCellState.memoryPluckCooldownSteps - 1);
  }
  if (SignatureCellState.globalCooldownSteps > 0) {
    SignatureCellState.globalCooldownSteps = Math.max(0, SignatureCellState.globalCooldownSteps - 1);
  }
  SignatureCellState.silenceDebt = Math.max(0, SignatureCellState.silenceDebt * 0.94 - 0.006);
}

function markMixEvent(amount = 0.08) {
  MixGovernorState.eventLoad = clampValue(MixGovernorState.eventLoad + amount, 0, 1);
}

function updateGenreBlend(parts) {
  const { energy, wave, creation, voidness, circle, body, resource, observer, pressure } = parts;
  const bpmNorm = clampValue((EngineParams.bpm - 58) / 90, 0, 1);
  const acid = acidPerformanceAmount();
  updateCultureGrammarState({ nudge: false });
  const midBpm = 1 - Math.abs(bpmNorm - 0.5) * 2;
  const activeGrid = clampValue((energy * 0.42) + (resource * 0.28) + (bpmNorm * 0.3), 0, 1);
  let ambientTarget = clampValue(
    ((1 - bpmNorm) * 0.32) +
      ((1 - energy) * 0.26) +
      (voidness * 0.16) +
      (observer * 0.12) +
      (circle * 0.1) -
      (resource * 0.08) -
      acid * 0.16,
    0,
    1
  );
  let idmTarget = clampValue(
    (midBpm * 0.22) +
      (wave * 0.22) +
      (creation * 0.22) +
      (observer * 0.12) +
      (resource * 0.1) +
      ((1 - voidness) * 0.06) +
      (LongformArcState.contrast * 0.06),
    0,
    1
  );
  let technoTarget = clampValue(
    (bpmNorm * 0.34) +
      (energy * 0.22) +
      (resource * 0.18) +
      (creation * 0.08) +
      ((1 - voidness) * 0.08) +
      (activeGrid * 0.1) -
      (observer * 0.06) +
      acid * 0.24,
    0,
    1
  );
  let pressureTarget = clampValue(
    (energy * 0.26) +
      (body * 0.24) +
      (pressure * 0.2) +
      (resource * 0.12) +
      (bpmNorm * 0.1) -
      (voidness * 0.12) +
      acid * 0.18,
    0,
    1
  );
  ambientTarget = clampValue(ambientTarget + cultureGenreBias("ambient"), 0, 1);
  idmTarget = clampValue(idmTarget + cultureGenreBias("idm"), 0, 1);
  technoTarget = clampValue(technoTarget + cultureGenreBias("techno"), 0, 1);
  pressureTarget = clampValue(pressureTarget + cultureGenreBias("pressure"), 0, 1);

  const total = Math.max(0.001, ambientTarget + idmTarget + technoTarget + pressureTarget);

  GenreBlendState.ambient = approachValue(GenreBlendState.ambient, ambientTarget / total, 0.08);
  GenreBlendState.idm = approachValue(GenreBlendState.idm, idmTarget / total, 0.08);
  GenreBlendState.techno = approachValue(GenreBlendState.techno, technoTarget / total, 0.08);
  GenreBlendState.pressure = approachValue(GenreBlendState.pressure, pressureTarget / total, 0.08);
  return GenreBlendState;
}

function genreTimbreKitRuntimeState() {
  return {
    ambientKit: GenreTimbreKitState.ambientKit,
    idmKit: GenreTimbreKitState.idmKit,
    technoKit: GenreTimbreKitState.technoKit,
    pressureKit: GenreTimbreKitState.pressureKit,
    spaceKit: GenreTimbreKitState.spaceKit
  };
}

function updateGenreTimbreKits(parts, gradient = GradientState, depth = DepthState, genre = GenreBlendState) {
  const energy = clampValue(parts.energy ?? unitValue(UCM_CUR.energy), 0, 1);
  const wave = clampValue(parts.wave ?? unitValue(UCM_CUR.wave), 0, 1);
  const creation = clampValue(parts.creation ?? unitValue(UCM_CUR.creation), 0, 1);
  const voidness = clampValue(parts.voidness ?? unitValue(UCM_CUR.void), 0, 1);
  const circle = clampValue(parts.circle ?? unitValue(UCM_CUR.circle), 0, 1);
  const body = clampValue(parts.body ?? unitValue(UCM_CUR.body), 0, 1);
  const resource = clampValue(parts.resource ?? unitValue(UCM_CUR.resource), 0, 1);
  const observer = clampValue(parts.observer ?? unitValue(UCM_CUR.observer), 0, 1);
  const pressure = clampValue(parts.pressure ?? 0, 0, 1);
  const bpmNorm = clampValue((EngineParams.bpm - 58) / 90, 0, 1);
  const lowBpm = 1 - bpmNorm;
  const midBpm = clampValue(1 - Math.abs(bpmNorm - 0.5) * 2, 0, 1);
  const pulse = clampValue(energy * 0.34 + resource * 0.26 + (1 - voidness) * 0.16 + bpmNorm * 0.18 + (depth.pulse || 0) * 0.06, 0, 1);
  const eventLoad = MixGovernorState.eventLoad || 0;
  const lowGuard = MixGovernorState.lowGuard || 0;
  const tenderHabit = producerHabitBias("tenderMemory");
  const gridHabit = producerHabitBias("dryGrid");
  const pressureHabit = producerHabitBias("ghostPressure");
  const spaceHabit = producerHabitBias("transparentVoid");
  const rubberHabit = producerHabitBias("rubberEdit");
  const restraintHabit = producerHabitBias("restraint");
  const micBias = micFollowKitBias();
  const radioHaze = musicRadioBrainBias("haze");
  const radioGlass = musicRadioBrainBias("glass");
  const radioGrid = musicRadioBrainBias("grid");
  const radioPressure = musicRadioBrainBias("pressure");
  const radioAir = musicRadioBrainBias("air");
  const radioRestraint = musicRadioBrainBias("restraint");

  const ambientTarget = clampValue(
    (1 - energy) * 0.22 +
      lowBpm * 0.2 +
      circle * 0.16 +
      observer * 0.14 +
      voidness * 0.1 +
      (1 - resource) * 0.08 +
      (gradient.haze || 0) * 0.1 +
      genre.ambient * 0.18 -
      gridHabit * 0.018 +
      tenderHabit * 0.026 +
      spaceHabit * 0.024 +
      restraintHabit * 0.014 -
      genre.techno * 0.06 +
      radioHaze * 0.035 +
      radioAir * 0.012 +
      radioRestraint * 0.012 +
      micBias.ambient,
    0,
    1
  );
  const idmTarget = clampValue(
    midBpm * 0.13 +
      wave * 0.18 +
      creation * 0.2 +
      resource * 0.15 +
      observer * 0.1 +
      (gradient.micro || 0) * 0.1 +
      (gradient.organic || 0) * 0.06 +
      genre.idm * 0.18 +
      ReferenceMorphState.broken * 0.06 +
      tenderHabit * 0.018 +
      gridHabit * 0.014 +
      rubberHabit * 0.028 -
      eventLoad * 0.04 +
      radioGlass * 0.04 -
      radioRestraint * 0.01 +
      micBias.idm,
    0,
    1
  );
  const technoTarget = clampValue(
    bpmNorm * 0.22 +
      energy * 0.19 +
      resource * 0.17 +
      (1 - voidness) * 0.13 +
      pulse * 0.14 +
      (gradient.micro || 0) * 0.06 +
      genre.techno * 0.2 +
      ReferenceMorphState.pulse * 0.06 +
      gridHabit * 0.042 +
      rubberHabit * 0.014 -
      spaceHabit * 0.026 -
      restraintHabit * 0.018 -
      genre.ambient * 0.08 -
      eventLoad * 0.03 +
      radioGrid * 0.046 -
      radioAir * 0.018 -
      radioRestraint * 0.014 +
      micBias.techno,
    0,
    1
  );
  const pressureTarget = clampValue(
    body * 0.2 +
      energy * 0.18 +
      pressure * 0.18 +
      (PerformancePadState.punch || 0) * 0.18 +
      (gradient.ghost || 0) * 0.08 +
      genre.pressure * 0.18 +
      ReferenceMorphState.pulse * 0.04 +
      pressureHabit * 0.04 -
      restraintHabit * 0.018 -
      voidness * 0.12 -
      lowGuard * 0.14 +
      radioPressure * 0.038 -
      radioAir * 0.012 -
      radioRestraint * 0.014 +
      micBias.pressure,
    0,
    1
  );
  const spaceTarget = clampValue(
    voidness * 0.22 +
      observer * 0.22 +
      (depth.tail || 0) * 0.18 +
      (depth.lowMidClean || 0) * 0.12 +
      circle * 0.08 +
      (PerformancePadState.void || 0) * 0.16 +
      genre.ambient * 0.08 +
      spaceHabit * 0.05 +
      restraintHabit * 0.018 -
      resource * 0.05 -
      lowGuard * 0.05 +
      radioAir * 0.048 +
      radioHaze * 0.012 +
      radioRestraint * 0.016 +
      micBias.space,
    0,
    1
  );

  GenreTimbreKitState.ambientKit = approachValue(GenreTimbreKitState.ambientKit, ambientTarget, 0.055);
  GenreTimbreKitState.idmKit = approachValue(GenreTimbreKitState.idmKit, idmTarget, 0.06);
  GenreTimbreKitState.technoKit = approachValue(GenreTimbreKitState.technoKit, technoTarget, 0.062);
  GenreTimbreKitState.pressureKit = approachValue(GenreTimbreKitState.pressureKit, pressureTarget, 0.058);
  GenreTimbreKitState.spaceKit = approachValue(GenreTimbreKitState.spaceKit, spaceTarget, 0.05);

  depth.bed = clampValue(depth.bed + GenreTimbreKitState.ambientKit * 0.025 + tenderHabit * 0.012 + restraintHabit * 0.006 - GenreTimbreKitState.technoKit * 0.02, 0, 1);
  depth.particle = clampValue(depth.particle + GenreTimbreKitState.idmKit * 0.032 + GenreTimbreKitState.technoKit * 0.022 + gridHabit * 0.012 + rubberHabit * 0.008 - restraintHabit * 0.005, 0, 1);
  depth.lowMidClean = clampValue(depth.lowMidClean + GenreTimbreKitState.spaceKit * 0.04 + GenreTimbreKitState.technoKit * 0.012 + spaceHabit * 0.026 + restraintHabit * 0.01 - GenreTimbreKitState.pressureKit * 0.012 - pressureHabit * 0.006, 0, 1);
  depth.tail = clampValue(depth.tail + GenreTimbreKitState.spaceKit * 0.04 + GenreTimbreKitState.ambientKit * 0.026 + spaceHabit * 0.024 + tenderHabit * 0.006 - GenreTimbreKitState.technoKit * 0.02, 0, 1);
  depth.gesture = clampValue(depth.gesture + GenreTimbreKitState.idmKit * 0.028 + GenreTimbreKitState.technoKit * 0.034 + GenreTimbreKitState.pressureKit * 0.024 + gridHabit * 0.018 + rubberHabit * 0.014 - restraintHabit * 0.008, 0, 1);

  return GenreTimbreKitState;
}

function longformTempoBias() {
  const stageName = currentLongformArcStage().name || "submerge";
  const stageBias = {
    submerge: -7,
    sprout: 3,
    ferment: 9,
    root: 5,
    exhale: -8
  }[stageName] || 0;
  return stageBias * clampValue(0.42 + longformArcShape() * 0.8, 0.25, 1);
}

function updateAcidLockIntensity(step = 0.02) {
  AcidLockState.intensity = approachValue(AcidLockState.intensity, AcidLockState.enabled ? 1 : 0, step);
  AcidLockState.transient = approachValue(AcidLockState.transient || 0, 0, step * 0.72);
  if ((AcidLockState.transient || 0) <= 0.01) AcidLockState.transientSource = "";
  const indicatorTarget = AcidLockState.enabled ? 0.24 : clampValue((AcidLockState.transient || 0) * 0.42, 0, 0.42);
  AcidLockState.indicator = approachValue(AcidLockState.indicator || 0, indicatorTarget, step * 1.5);
  return AcidLockState.intensity;
}

function resolvePerformanceTempoTarget(rawTarget) {
  updateAcidLockIntensity(0.012);
  const acidAmount = acidPerformanceAmount();
  const noAcidCeiling = 114;
  if (acidAmount < 0.08) return clampValue(rawTarget, 54, noAcidCeiling);

  const acidFloor = 124 + acidAmount * 4;
  const acidLift = acidAmount * 18;
  return clampValue(Math.max(rawTarget + acidLift, acidFloor), acidFloor, 146);
}

function updateDJTempo(parts, options = {}) {
  const force = options.force === true;
  const { energy, wave, creation, body, resource, observer, voidness } = parts;
  const genre = GenreBlendState;
  const rawBpm = mapValue(energy, 0, 1, 58, 148);
  const genreBias =
    genre.ambient * -7 +
    genre.idm * 2.5 +
    genre.techno * 7 +
    genre.pressure * 3;
  const cultureTempoBias =
    cultureRhythmBias("pulse") * 11 +
    cultureRhythmBias("repeat") * 4 -
    cultureRhythmBias("drumThin") * 8;
  const contour = Math.sin((GrooveState.cycle * 0.045) + (LongformArcState.stageIndex * 0.9)) * (1.2 + longformArcShape() * 2.4);
  const pressureLift = clampValue((body * 0.22) + (resource * 0.18) + (creation * 0.12) - (observer * 0.08) - (voidness * 0.08), -0.12, 0.36) * 8;
  const target = resolvePerformanceTempoTarget(rawBpm + longformTempoBias() + albumArcTempoBias() + genreBias + cultureTempoBias + oddLogicTempoBias() + micFollowTempoBias(rawBpm) + pressureLift + contour);
  const targetStep = force ? 96 : 0.55 + Math.abs(DJTempoState.targetBpm - target) * 0.018;
  const bpmStep = force ? 96 : 0.42 + wave * 0.18 + genre.techno * 0.16;

  DJTempoState.rawBpm = rawBpm;
  DJTempoState.targetBpm = approachValue(DJTempoState.targetBpm, target, targetStep);
  DJTempoState.bpm = approachValue(DJTempoState.bpm, DJTempoState.targetBpm, bpmStep);
  DJTempoState.drift = DJTempoState.bpm - rawBpm;
  DJTempoState.motion = DJTempoState.targetBpm - DJTempoState.bpm;
  EngineParams.bpm = Math.round(DJTempoState.bpm);
  updateHeaderRuntimeUi();

  if (typeof Tone !== "undefined" && Tone.Transport?.bpm) {
    rampParam("transport-bpm", Tone.Transport.bpm, DJTempoState.bpm, force ? 0.35 : 1.6, force ? 0 : 0.08);
  }
}

function bpmZoneForTempo(bpm, genre = GenreBlendState) {
  if (bpm < 82 || genre.ambient > 0.46) return "ambient";
  if (bpm < 112 || genre.idm > genre.techno + 0.08) return "idm";
  if (bpm < 136 || genre.techno > genre.pressure) return "grid";
  return "pressure";
}

function motifPoolForZone(zone) {
  if (zone === "ambient") return TRANSPARENT_AIR_FRAGMENTS;
  if (zone === "idm") return ORGANIC_PLUCK_FRAGMENTS;
  if (zone === "grid") return GLASS_NOTES;
  return FIELD_MURK_FRAGMENTS;
}

function bpmZoneGradientBias(zone) {
  switch (zone) {
    case "ambient":
      return { haze: 0.12, memory: 0.04, micro: 0.01, ghost: 0.02, chrome: 0.1, organic: 0.03 };
    case "idm":
      return { haze: 0.03, memory: 0.11, micro: 0.12, ghost: 0.02, chrome: 0.07, organic: 0.1 };
    case "grid":
      return { haze: -0.02, memory: 0.02, micro: 0.15, ghost: 0.08, chrome: 0.04, organic: 0.04 };
    case "pressure":
      return { haze: -0.03, memory: 0.01, micro: 0.08, ghost: 0.14, chrome: 0.02, organic: 0.05 };
    default:
      return { haze: 0, memory: 0, micro: 0, ghost: 0, chrome: 0, organic: 0 };
  }
}

function updateBpmCrossfadeMemory(parts) {
  const nextZone = bpmZoneForTempo(DJTempoState.bpm, GenreBlendState);
  const currentZone = BpmCrossfadeState.zone || nextZone;
  const crossed = nextZone !== currentZone;
  const motionAmount = clampValue(Math.abs(DJTempoState.motion) / 22, 0, 1);
  const pressure = parts.pressure || 0;

  if (crossed) {
    const fromPool = motifPoolForZone(currentZone);
    const toPool = motifPoolForZone(nextZone);
    const root = fromPool[(GrooveState.cycle + BpmCrossfadeState.motifIndex) % fromPool.length];
    const reply = toPool[(GrooveState.cycle + BpmCrossfadeState.motifIndex + 2) % toPool.length];
    const shade = FIELD_MURK_FRAGMENTS[(GrooveState.cycle + BpmCrossfadeState.motifIndex + 1) % FIELD_MURK_FRAGMENTS.length];

    BpmCrossfadeState.previousZone = currentZone;
    BpmCrossfadeState.zone = nextZone;
    BpmCrossfadeState.blend = clampValue(0.62 + motionAmount * 0.22 + LongformArcState.turn * 0.08, 0, 0.92);
    BpmCrossfadeState.refrain = clampValue(0.52 + motionAmount * 0.18 + pressure * 0.08, 0, 0.84);
    BpmCrossfadeState.lastCrossCycle = GrooveState.cycle;
    BpmCrossfadeState.motifRoot = root;
    BpmCrossfadeState.motifReply = reply;
    BpmCrossfadeState.motifShade = shade;
    BpmCrossfadeState.motifIndex = (BpmCrossfadeState.motifIndex + 1) % 16;
    rememberMotif(root, {
      reply,
      shade,
      strength: 0.12 + BpmCrossfadeState.refrain * 0.18,
      air: nextZone === "ambient" ? 0.18 : 0.08 + motionAmount * 0.08,
      source: `bpm:${currentZone}->${nextZone}`
    });
    return;
  }

  if (motionAmount > 0.24) {
    BpmCrossfadeState.blend = clampValue(BpmCrossfadeState.blend + motionAmount * 0.025, 0, 0.72);
    BpmCrossfadeState.refrain = clampValue(BpmCrossfadeState.refrain + motionAmount * 0.018, 0, 0.62);
  }
}

function fractionalPart(value) {
  return value - Math.floor(value);
}

function goldenPulseGate(step, offset = 0) {
  const point = (step + GenomeState.generation + offset) % 13;
  return point === 0 || point === 5 || point === 8;
}

function geneValue(key) {
  return clampValue(GenomeState.genes[key] || 0, 0, 1);
}

function currentVoiceColor() {
  const atmosphere = ATMOSPHERE_COLORS[VoiceColorState.atmosphere] || ATMOSPHERE_COLORS.auto;
  const source = SOURCE_COLORS[VoiceColorState.source] || SOURCE_COLORS.genome;
  return { atmosphere, source };
}

function smoothStep01(value) {
  const x = clampValue(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function autoVoiceKey(palette, index) {
  return palette[((index % palette.length) + palette.length) % palette.length];
}

function autoVoiceSegmentCycles(base, span, offset = 0) {
  const phi = fractionalPart((AutoVoiceMorphState.generation + 1 + offset) * GOLDEN_RATIO_INVERSE);
  const tempoMotion = clampValue(Math.abs(DJTempoState.motion || 0) / 18, 0, 1);
  const energyLift = clampValue(UCM_CUR.energy / 100, 0, 1) * 0.16;
  return Math.round(base + span * phi - span * 0.18 * tempoMotion - span * energyLift);
}

function autoVoiceBlendValue(map, fromKey, toKey, blend, key, amountKey) {
  const from = map[fromKey]?.[amountKey]?.[key] || 0;
  const to = map[toKey]?.[amountKey]?.[key] || 0;
  return from * (1 - blend) + to * blend;
}

function autoVoiceSourceActive() {
  return VoiceColorState.source === "genome";
}

function autoVoiceAtmosphereActive() {
  return VoiceColorState.atmosphere === "auto";
}

function activeAutoSourceKey() {
  return autoVoiceKey(AUTO_SOURCE_MORPH_KEYS, AutoVoiceMorphState.sourceIndex);
}

function nextAutoSourceKey() {
  return autoVoiceKey(AUTO_SOURCE_MORPH_KEYS, AutoVoiceMorphState.sourceNextIndex);
}

function activeAutoAtmosphereKey() {
  return autoVoiceKey(AUTO_ATMOSPHERE_MORPH_KEYS, AutoVoiceMorphState.atmosphereIndex);
}

function nextAutoAtmosphereKey() {
  return autoVoiceKey(AUTO_ATMOSPHERE_MORPH_KEYS, AutoVoiceMorphState.atmosphereNextIndex);
}

function effectiveVoiceSourceKey() {
  return autoVoiceSourceActive() ? activeAutoSourceKey() : VoiceColorState.source;
}

function effectiveVoiceAtmosphereKey() {
  return autoVoiceAtmosphereActive() ? activeAutoAtmosphereKey() : VoiceColorState.atmosphere;
}

function autoVoiceMorphLabel() {
  const sourceFrom = SOURCE_COLORS[activeAutoSourceKey()]?.label || "GENOME";
  const sourceTo = SOURCE_COLORS[nextAutoSourceKey()]?.label || sourceFrom;
  const atmosphereFrom = ATMOSPHERE_COLORS[activeAutoAtmosphereKey()]?.label || "AUTO.AIR";
  const atmosphereTo = ATMOSPHERE_COLORS[nextAutoAtmosphereKey()]?.label || atmosphereFrom;
  const sourceLabel = AutoVoiceMorphState.sourceBlend > 0.18 && AutoVoiceMorphState.sourceBlend < 0.82
    ? `${sourceFrom} -> ${sourceTo}`
    : sourceFrom;
  const atmosphereLabel = AutoVoiceMorphState.atmosphereBlend > 0.18 && AutoVoiceMorphState.atmosphereBlend < 0.82
    ? `${atmosphereFrom} -> ${atmosphereTo}`
    : atmosphereFrom;

  return { sourceLabel, atmosphereLabel };
}

function autoVoiceMorphBias(key, amountKey) {
  let bias = 0;

  if (autoVoiceAtmosphereActive()) {
    bias += autoVoiceBlendValue(
      ATMOSPHERE_COLORS,
      activeAutoAtmosphereKey(),
      nextAutoAtmosphereKey(),
      AutoVoiceMorphState.atmosphereBlend,
      key,
      amountKey
    ) * 0.72;
  }

  if (autoVoiceSourceActive()) {
    bias += autoVoiceBlendValue(
      SOURCE_COLORS,
      activeAutoSourceKey(),
      nextAutoSourceKey(),
      AutoVoiceMorphState.sourceBlend,
      key,
      amountKey
    ) * 0.78;
  }

  return bias;
}

function voiceEmergencePalette() {
  const sourceKey = effectiveVoiceSourceKey();
  const atmosphereKey = effectiveVoiceAtmosphereKey();
  const palette = [];
  const push = (...keys) => {
    for (const key of keys) {
      if (VOICE_EMERGENCE_KEYS.includes(key) && !palette.includes(key)) palette.push(key);
    }
  };

  if (sourceKey === "xtal" || atmosphereKey === "haze") push("haze", "chrome", "memory");
  if (sourceKey === "boc") push("memory", "haze", "organic");
  if (sourceKey === "opn" || atmosphereKey === "chrome" || atmosphereKey === "void") push("chrome", "haze", "micro");
  if (sourceKey === "autechre") push("micro", "chrome", "organic");
  if (sourceKey === "burial" || atmosphereKey === "ghost") push("ghost", "memory", "haze");
  if (sourceKey === "fsol" || atmosphereKey === "organic") push("organic", "micro", "ghost");

  if (GenreBlendState.ambient > 0.42 || EngineParams.bpm < 84) push("haze", "chrome");
  if (GenreBlendState.idm > 0.38) push("micro", "organic", "memory");
  if (GenreBlendState.techno > 0.34 || acidPerformanceAmount() > 0.18) push("micro", "ghost", "chrome");
  if (GenreBlendState.pressure > 0.34) push("ghost", "organic");
  if (palette.length < 3) push("haze", "memory", "chrome", "organic");
  return palette;
}

function chooseVoiceEmergenceFocus(offset = 0) {
  const palette = voiceEmergencePalette();
  const index = Math.floor(fractionalPart((GrooveState.cycle + 1 + AutoVoiceMorphState.generation * 3 + offset) * GOLDEN_RATIO_INVERSE) * palette.length);
  return palette[((index % palette.length) + palette.length) % palette.length];
}

function voiceEmergenceSegmentCycles(offset = 0) {
  const phi = fractionalPart((AutoVoiceMorphState.generation + GrooveState.cycle + 1 + offset) * GOLDEN_RATIO_INVERSE);
  const energy = clampValue(UCM_CUR.energy / 100, 0, 1);
  const activity = clampValue(GenreBlendState.idm * 0.26 + GenreBlendState.techno * 0.22 + acidPerformanceAmount() * 0.18 + energy * 0.12, 0, 0.36);
  return Math.round(clampValue(8 + phi * 9 - activity * 6, 6, 16));
}

function voiceEmergenceBias(key, amountKey) {
  const from = VOICE_EMERGENCE_COLORS[VoiceEmergenceState.focus]?.[amountKey]?.[key] || 0;
  const to = VOICE_EMERGENCE_COLORS[VoiceEmergenceState.nextFocus]?.[amountKey]?.[key] || 0;
  const blended = from * (1 - VoiceEmergenceState.blend) + to * VoiceEmergenceState.blend;
  const lift = 0.66 + VoiceEmergenceState.bloom * 0.16 + VoiceEmergenceState.splice * 0.1 + VoiceEmergenceState.shimmer * 0.08 + VoiceEmergenceState.refrain * 0.06;
  return blended * clampValue(lift, 0.5, 0.96);
}

function voiceRawGradientBias(key) {
  const { atmosphere, source } = currentVoiceColor();
  return (
    (atmosphere.gradient?.[key] || 0) +
    (source.gradient?.[key] || 0) +
    autoVoiceMorphBias(key, "gradient") +
    voiceEmergenceBias(key, "gradient")
  );
}

function voiceRawGeneBias(key) {
  const { atmosphere, source } = currentVoiceColor();
  return (
    (atmosphere.genes?.[key] || 0) +
    (source.genes?.[key] || 0) +
    autoVoiceMorphBias(key, "genes") +
    voiceEmergenceBias(key, "genes")
  );
}

function voiceTransitionAmount() {
  return clampValue(VoiceMorphState.transition || 0, 0, 1);
}

function smoothVoiceBias(store, key, target, baseStep, transitionStep) {
  const current = typeof store[key] === "number" ? store[key] : target;
  const next = approachValue(current, target, baseStep + voiceTransitionAmount() * transitionStep);
  store[key] = clampValue(next, -0.32, 0.32);
  return store[key];
}

function voiceGradientBias(key) {
  return smoothVoiceBias(VoiceMorphState.gradient, key, voiceRawGradientBias(key), 0.016, 0.048);
}

function voiceGeneBias(key) {
  return smoothVoiceBias(VoiceMorphState.genes, key, voiceRawGeneBias(key), 0.012, 0.036);
}

function decayVoiceMorph() {
  VoiceMorphState.transition = approachValue(VoiceMorphState.transition, 0, 0.07);
}

function resetAutoVoiceMorph() {
  AutoVoiceMorphState.sourceIndex = 0;
  AutoVoiceMorphState.sourceNextIndex = 1;
  AutoVoiceMorphState.sourceAge = 0;
  AutoVoiceMorphState.sourceSegmentCycles = 54;
  AutoVoiceMorphState.sourceBlend = 0;
  AutoVoiceMorphState.atmosphereIndex = 0;
  AutoVoiceMorphState.atmosphereNextIndex = 1;
  AutoVoiceMorphState.atmosphereAge = 0;
  AutoVoiceMorphState.atmosphereSegmentCycles = 38;
  AutoVoiceMorphState.atmosphereBlend = 0;
  AutoVoiceMorphState.generation = 0;
  AutoVoiceMorphState.lastCycle = -1;
  VoiceMorphState.transition = 1;
  resetVoiceEmergence();
}

function resetVoiceEmergence() {
  VoiceEmergenceState.lastCycle = -1;
  VoiceEmergenceState.phrase = 0;
  VoiceEmergenceState.phraseCycles = 10;
  VoiceEmergenceState.focus = chooseVoiceEmergenceFocus(0);
  VoiceEmergenceState.nextFocus = chooseVoiceEmergenceFocus(2);
  VoiceEmergenceState.blend = 0;
  VoiceEmergenceState.phase = 0;
  VoiceEmergenceState.bloom = 0;
  VoiceEmergenceState.splice = 0;
  VoiceEmergenceState.shimmer = 0;
  VoiceEmergenceState.refrain = 0;
}

function resetReferenceMorph() {
  ReferenceMorphState.lastCycle = -1;
  ReferenceMorphState.phase = 0;
  ReferenceMorphState.style = "haze";
  ReferenceMorphState.haze = 0.4;
  ReferenceMorphState.broken = 0.22;
  ReferenceMorphState.pulse = 0.18;
  ReferenceMorphState.void = 0.2;
  ReferenceMorphState.chrome = 0.3;
  ReferenceMorphState.organic = 0.28;
  ReferenceMorphState.rdj = 0.2;
  ReferenceMorphState.restraint = 0.48;
}

function resetRdjGrowth() {
  RdjGrowthState.lastCycle = -1;
  RdjGrowthState.generation = 0;
  RdjGrowthState.phase = 0;
  RdjGrowthState.toy = 0.12;
  RdjGrowthState.rubber = 0.08;
  RdjGrowthState.wrong = 0.16;
  RdjGrowthState.tender = 0.2;
  RdjGrowthState.edit = 0.14;
  RdjGrowthState.restraint = 0.5;
}

function resetProducerHabits() {
  ProducerHabitState.lastCycle = -1;
  ProducerHabitState.generation = 0;
  ProducerHabitState.phase = 0;
  ProducerHabitState.mode = "listen";
  ProducerHabitState.lastMutation = "listen";
  ProducerHabitState.restraintBudget = 0.62;
  ProducerHabitState.curiosity = 0.18;
  ProducerHabitState.risk = 0;
  ProducerHabitState.riskSnapshot = {
    density: 0,
    bright: 0,
    low: 0,
    hook: 0,
    overall: 0
  };
  ProducerHabitState.habits.tenderMemory = 0.22;
  ProducerHabitState.habits.dryGrid = 0.12;
  ProducerHabitState.habits.ghostPressure = 0.1;
  ProducerHabitState.habits.transparentVoid = 0.28;
  ProducerHabitState.habits.rubberEdit = 0.14;
  ProducerHabitState.habits.beautifulRestraint = 0.5;
}

function resetSelfReviewGovernor() {
  SelfReviewGovernorState.lastCycle = -1;
  SelfReviewGovernorState.densityBrake = 0;
  SelfReviewGovernorState.lowCleanup = 0;
  SelfReviewGovernorState.airTail = 0;
  SelfReviewGovernorState.transientSoftener = 0;
  SelfReviewGovernorState.lastSuggestion = "listen";
}

function resetSignatureCells() {
  SignatureCellState.phrase = 0;
  SignatureCellState.phraseCycles = 6;
  SignatureCellState.motif = "call";
  SignatureCellState.nextMotif = "answer";
  SignatureCellState.blend = 0;
  SignatureCellState.cooldownSteps = 0;
  SignatureCellState.intensity = 0;
  SignatureCellState.lastStep = -99;
  SignatureCellState.lowBreathCooldownSteps = 0;
  SignatureCellState.lowBreathIntensity = 0;
  SignatureCellState.lowBreathLastStep = -99;
  SignatureCellState.brokenTextureCooldownSteps = 0;
  SignatureCellState.brokenTextureIntensity = 0;
  SignatureCellState.brokenTextureLastStep = -99;
  SignatureCellState.memoryPluckCooldownSteps = 0;
  SignatureCellState.memoryPluckIntensity = 0;
  SignatureCellState.memoryPluckLastStep = -99;
  SignatureCellState.globalCooldownSteps = 0;
  SignatureCellState.conductorMode = "listen";
  SignatureCellState.nextConductorMode = "breathe";
  SignatureCellState.conductorPhrase = 0;
  SignatureCellState.conductorPhraseCycles = 4;
  SignatureCellState.silenceDebt = 0;
  SignatureCellState.lastFlavor = "";
}

function signatureCellCollapseAmount(context = {}) {
  const creation = clampValue(context.creationNorm ?? unitValue(UCM_CUR.creation), 0, 1);
  const wave = clampValue(context.waveNorm ?? unitValue(UCM_CUR.wave), 0, 1);
  const resource = clampValue(context.resourceNorm ?? unitValue(UCM_CUR.resource), 0, 1);
  const circle = clampValue(context.circleNorm ?? unitValue(UCM_CUR.circle), 0, 1);
  const observer = clampValue(context.observerNorm ?? unitValue(UCM_CUR.observer), 0, 1);
  const voidness = clampValue(context.voidNorm ?? unitValue(UCM_CUR.void), 0, 1);
  const micro = clampValue((GradientState.micro || 0) + (WorldState.micro || 0), 0, 1);
  const chaos = organicChaosAmount();
  return clampValue(
    creation * 0.3 +
      wave * 0.24 +
      resource * 0.2 +
      micro * 0.16 +
      chaos * 0.14 -
      circle * 0.18 -
      observer * 0.12 -
      voidness * 0.1,
    0,
    1
  );
}

function signatureCellMotifPool(collapse) {
  const scarReady = collapse > 0.42 || PerformancePadState.drift || PerformancePadState.repeat;
  return scarReady ? SIGNATURE_CELL_MOTIFS : ["call", "answer"];
}

function chooseSignatureCellMotif(offset = 0, collapse = signatureCellCollapseAmount()) {
  const pool = signatureCellMotifPool(collapse);
  const phi = fractionalPart((GrooveState.cycle + SignatureCellState.phrase + GenomeState.generation + offset + 1) * GOLDEN_RATIO_INVERSE);
  const index = Math.min(pool.length - 1, Math.floor(phi * pool.length));
  return pool[index] || "call";
}

function signatureCellPhraseCycles(offset = 0) {
  const phi = fractionalPart((GrooveState.cycle + GenomeState.generation + offset + 1) * GOLDEN_RATIO_INVERSE);
  return Math.round(5 + phi * 5);
}

function dominantReferenceMorphStyle() {
  const pairs = [
    ["haze", ReferenceMorphState.haze],
    ["broken", ReferenceMorphState.broken],
    ["pulse", ReferenceMorphState.pulse],
    ["void", ReferenceMorphState.void],
    ["chrome", ReferenceMorphState.chrome],
    ["organic", ReferenceMorphState.organic]
  ];
  return pairs.reduce((best, item) => item[1] > best[1] ? item : best, pairs[0])[0];
}

function referenceMorphRuntimeState() {
  return {
    phase: ReferenceMorphState.phase,
    style: ReferenceMorphState.style,
    haze: ReferenceMorphState.haze,
    broken: ReferenceMorphState.broken,
    pulse: ReferenceMorphState.pulse,
    void: ReferenceMorphState.void,
    chrome: ReferenceMorphState.chrome,
    organic: ReferenceMorphState.organic,
    rdj: ReferenceMorphState.rdj,
    restraint: ReferenceMorphState.restraint
  };
}

function rdjGrowthRuntimeState() {
  return {
    generation: RdjGrowthState.generation,
    phase: RdjGrowthState.phase,
    toy: RdjGrowthState.toy,
    rubber: RdjGrowthState.rubber,
    wrong: RdjGrowthState.wrong,
    tender: RdjGrowthState.tender,
    edit: RdjGrowthState.edit,
    restraint: RdjGrowthState.restraint
  };
}

function humanGrooveStateForProducerHabits() {
  if (typeof window === "undefined") return null;
  const governor = window.HumanGrooveGovernor;
  if (typeof governor?.getState === "function") return governor.getState();
  if (typeof governor?.state === "object") return governor.state;
  return null;
}

function producerHabitRiskSnapshot() {
  const human = humanGrooveStateForProducerHabits() || {};
  const signatureDebt = SignatureCellState.silenceDebt || 0;
  const eventLoad = MixGovernorState.eventLoad || 0;
  const lowGuard = MixGovernorState.lowGuard || 0;
  const meter = selfReviewMeterNormalized();
  const density = clampValue(
    eventLoad * 0.38 +
      (human.density || 0) * 0.18 +
      (human.grain || 0) * 0.08 +
      (human.collapse || 0) * 0.13 +
      signatureDebt * 0.17 +
      meter * 0.05 -
      (human.repair || 0) * 0.12 -
      ReferenceMorphState.restraint * 0.05,
    0,
    1
  );
  const bright = clampValue(
    GenreTimbreKitState.technoKit * 0.26 +
      ReferenceMorphState.chrome * 0.2 +
      ReferenceMorphState.pulse * 0.18 +
      (DepthState.particle || 0) * 0.16 +
      acidPerformanceAmount() * 0.08 +
      meter * 0.04 -
      GenreTimbreKitState.spaceKit * 0.08 -
      ReferenceMorphState.restraint * 0.06,
    0,
    1
  );
  const low = clampValue(
    lowGuard * 0.34 +
      GenreTimbreKitState.pressureKit * 0.22 +
      (TimbreFamilyState.sub808 || 0) * 0.16 +
      (PerformancePadState.punch || 0) * 0.12 +
      acidPerformanceAmount() * 0.08 +
      meter * 0.03 -
      GenreTimbreKitState.spaceKit * 0.12 -
      (DepthState.lowMidClean || 0) * 0.08,
    0,
    1
  );
  const hook = clampValue(
    SignatureCellState.memoryPluckIntensity * 0.26 +
      MotifMemoryState.strength * 0.15 +
      RdjGrowthState.toy * 0.12 +
      RdjGrowthState.tender * 0.08 -
      RdjGrowthState.restraint * 0.1 -
      ProducerHabitState.habits.beautifulRestraint * 0.08,
    0,
    1
  );
  const overall = clampValue(Math.max(density, low, bright * 0.92, hook * 0.88), 0, 1);
  return { density, bright, low, hook, overall };
}

function producerHabitBias(key) {
  const habits = ProducerHabitState.habits;
  const risk = ProducerHabitState.riskSnapshot || producerHabitRiskSnapshot();
  const safety = clampValue(1 - ProducerHabitState.risk * 0.38 - ProducerHabitState.restraintBudget * 0.2, 0, 1);
  const pressureSafe = clampValue(1 - (risk.low || 0) * 0.72, 0, 1);
  const hookSafe = clampValue(1 - (risk.hook || 0) * 0.54, 0, 1);
  if (key === "tenderMemory" || key === "memory" || key === "memoryPluck") return clampValue(habits.tenderMemory * hookSafe, 0, 1);
  if (key === "dryGrid" || key === "grid" || key === "brokenTexture") return clampValue(habits.dryGrid * (0.28 + safety * 0.72), 0, 1);
  if (key === "ghostPressure" || key === "pressure") return clampValue(habits.ghostPressure * pressureSafe, 0, 1);
  if (key === "transparentVoid" || key === "space" || key === "lowBreath") return clampValue(habits.transparentVoid * (0.78 + ProducerHabitState.restraintBudget * 0.22), 0, 1);
  if (key === "rubberEdit" || key === "rubber") return clampValue(habits.rubberEdit * safety, 0, 1);
  if (key === "ghostGlass") return clampValue(Math.max(habits.tenderMemory * 0.52, habits.transparentVoid * 0.36) * hookSafe, 0, 1);
  if (key === "beautifulRestraint" || key === "restraint") return clampValue(habits.beautifulRestraint * 0.6 + ProducerHabitState.restraintBudget * 0.28 + ProducerHabitState.risk * 0.2, 0, 1);
  return 0;
}

function producerHabitAllows(flavor) {
  const habits = ProducerHabitState.habits;
  const risk = ProducerHabitState.riskSnapshot || producerHabitRiskSnapshot();
  if (ProducerHabitState.risk > 0.86 || SignatureCellState.silenceDebt > 0.9) {
    return flavor === "lowBreath" && habits.transparentVoid > 0.5 && (risk.low || 0) < 0.62;
  }
  if (flavor === "memoryPluck" && (risk.hook || 0) > 0.68) return false;
  if (flavor === "brokenTexture" && (risk.bright || 0) > 0.78) return false;
  if (flavor === "lowBreath" && (risk.low || 0) > 0.72 && !PerformancePadState.void) return false;
  if (ProducerHabitState.mode === "listen" && producerHabitBias("restraint") > 0.74) return false;
  if (ProducerHabitState.mode === "softWrongMemory") return flavor === "memoryPluck" || flavor === "ghostGlass" || habits.beautifulRestraint < 0.42;
  if (ProducerHabitState.mode === "dryGridScar") return flavor === "brokenTexture" || flavor === "ghostGlass" || habits.transparentVoid > 0.48;
  if (ProducerHabitState.mode === "ghostPressureBreath") return flavor === "lowBreath" || flavor === "ghostGlass";
  if (ProducerHabitState.mode === "transparentVoidTail") return flavor === "lowBreath" || flavor === "ghostGlass";
  if (ProducerHabitState.mode === "rubberMicroEdit") return flavor === "brokenTexture" || flavor === "memoryPluck" || flavor === "ghostGlass";
  return true;
}

function producerHabitsRuntimeState() {
  return {
    generation: ProducerHabitState.generation,
    phase: ProducerHabitState.phase,
    mode: ProducerHabitState.mode,
    lastMutation: ProducerHabitState.lastMutation,
    restraintBudget: ProducerHabitState.restraintBudget,
    curiosity: ProducerHabitState.curiosity,
    risk: ProducerHabitState.risk,
    riskSnapshot: { ...ProducerHabitState.riskSnapshot },
    habits: { ...ProducerHabitState.habits }
  };
}

function dominantModeTimbrePalette() {
  const weights = ModeTimbrePaletteState.weights;
  return MODE_TIMBRE_PALETTE_KEYS.reduce((best, key) => {
    return (weights[key] || 0) > (weights[best] || 0) ? key : best;
  }, "ambientHaze");
}

function modeTimbrePaletteShape() {
  return ModeTimbrePaletteState.shape;
}

function modeTimbrePaletteBias(key) {
  const shape = ModeTimbrePaletteState.shape;
  const weights = ModeTimbrePaletteState.weights;
  if (key === "ambient" || key === "haze") return clampValue(weights.ambientHaze * 0.7 + shape.haze * 0.3, 0, 1);
  if (key === "idm" || key === "glass") return clampValue(weights.idmGlass * 0.64 + shape.glass * 0.36, 0, 1);
  if (key === "techno" || key === "grid" || key === "rhythm") return clampValue(weights.technoDryGrid * 0.64 + shape.rhythm * 0.36, 0, 1);
  if (key === "pressure" || key === "transient") return clampValue(weights.pressureGhost * 0.62 + shape.transient * 0.38, 0, 1);
  if (key === "void" || key === "air" || key === "space") return clampValue(weights.voidAir * 0.68 + shape.air * 0.32, 0, 1);
  if (key === "restraint") return clampValue(shape.restraint, 0, 1);
  return 0;
}

function modeTimbrePalettesRuntimeState() {
  return {
    active: ModeTimbrePaletteState.active,
    phase: ModeTimbrePaletteState.phase,
    weights: { ...ModeTimbrePaletteState.weights },
    shape: { ...ModeTimbrePaletteState.shape },
    safety: { ...ModeTimbrePaletteState.safety },
    lastDecision: ModeTimbrePaletteState.lastDecision
  };
}

function advanceModeTimbrePalettes(context = {}) {
  if (ModeTimbrePaletteState.lastCycle === GrooveState.cycle) return;
  ModeTimbrePaletteState.lastCycle = GrooveState.cycle;

  const energy = clampValue(context.energyNorm ?? unitValue(UCM_CUR.energy), 0, 1);
  const creation = clampValue(context.creationNorm ?? unitValue(UCM_CUR.creation), 0, 1);
  const resource = clampValue(context.resourceNorm ?? unitValue(UCM_CUR.resource), 0, 1);
  const wave = clampValue(context.waveNorm ?? unitValue(UCM_CUR.wave), 0, 1);
  const observer = clampValue(context.observerNorm ?? unitValue(UCM_CUR.observer), 0, 1);
  const circle = clampValue(context.circleNorm ?? unitValue(UCM_CUR.circle), 0, 1);
  const voidness = clampValue(context.voidNorm ?? unitValue(UCM_CUR.void), 0, 1);
  const body = clampValue(unitValue(UCM_CUR.body), 0, 1);
  const bpmNorm = clampValue((EngineParams.bpm - 58) / 90, 0, 1);
  const lowBpm = 1 - bpmNorm;
  const midBpm = clampValue(1 - Math.abs(bpmNorm - 0.5) * 2, 0, 1);
  const kits = GenreTimbreKitState;
  const morph = ReferenceMorphState;
  const habits = ProducerHabitState.habits;
  const risk = ProducerHabitState.riskSnapshot || producerHabitRiskSnapshot();
  const review = musicSelfReviewRuntimeState();
  const micJam = micJamShape();
  const densityBrake = clampValue(Math.max(SelfReviewGovernorState.densityBrake || 0, risk.density || 0, review.densityRisk || 0), 0, 1);
  const lowClamp = clampValue(Math.max(SelfReviewGovernorState.lowCleanup || 0, risk.low || 0, review.lowEndRisk || 0, MixGovernorState.lowGuard || 0), 0, 1);
  const brightnessDamp = clampValue(Math.max(SelfReviewGovernorState.transientSoftener || 0, risk.bright || 0, review.brightnessRisk || 0), 0, 1);
  const restraint = clampValue(
    0.14 +
      ProducerHabitState.restraintBudget * 0.24 +
      ReferenceMorphState.restraint * 0.18 +
      RdjGrowthState.restraint * 0.16 +
      densityBrake * 0.18 +
      lowClamp * 0.12 +
      brightnessDamp * 0.12,
    0,
    1
  );
  const safetyLift = clampValue(Math.max(densityBrake, lowClamp, brightnessDamp) * 0.24 + restraint * 0.08, 0, 0.38);

  const targets = {
    ambientHaze: clampValue(
      kits.ambientKit * 0.34 +
        morph.haze * 0.16 +
        lowBpm * 0.12 +
        (1 - energy) * 0.1 +
        circle * 0.09 +
        observer * 0.1 +
        habits.tenderMemory * 0.06 +
        micJam.hum * 0.08 +
        micJam.breath * 0.06 +
        micJam.air * 0.04 +
        PerformancePadState.drift * 0.08 +
        safetyLift * 0.36 -
        kits.technoKit * 0.08,
      0,
      1
    ),
    idmGlass: clampValue(
      kits.idmKit * 0.34 +
        morph.broken * 0.16 +
        morph.organic * 0.08 +
        midBpm * 0.08 +
        creation * 0.12 +
        wave * 0.09 +
        resource * 0.07 +
        RdjGrowthState.edit * 0.06 +
        RdjGrowthState.rubber * 0.05 +
        habits.rubberEdit * 0.06 +
        micJam.phrase * 0.12 +
        micJam.pulse * 0.04 +
        PerformancePadState.repeat * 0.05 -
        densityBrake * 0.1 -
        brightnessDamp * 0.06,
      0,
      1
    ),
    technoDryGrid: clampValue(
      kits.technoKit * 0.36 +
        morph.pulse * 0.14 +
        bpmNorm * 0.12 +
        energy * 0.12 +
        resource * 0.1 +
        habits.dryGrid * 0.08 +
        micJam.pulse * 0.12 +
        micJam.clap * 0.08 +
        PerformancePadState.repeat * 0.07 -
        voidness * 0.08 -
        brightnessDamp * 0.12 -
        restraint * 0.04,
      0,
      1
    ),
    pressureGhost: clampValue(
      kits.pressureKit * 0.34 +
        body * 0.14 +
        energy * 0.1 +
        morph.pulse * 0.1 +
        habits.ghostPressure * 0.1 +
        micJam.clap * 0.05 +
        micJam.drive * 0.04 -
        micJam.noisy * 0.05 +
        PerformancePadState.punch * 0.16 +
        (GradientState.ghost || 0) * 0.06 -
        lowClamp * 0.18 -
        voidness * 0.08,
      0,
      1
    ),
    voidAir: clampValue(
      kits.spaceKit * 0.34 +
        morph.void * 0.18 +
        morph.chrome * 0.08 +
        voidness * 0.14 +
        observer * 0.12 +
        circle * 0.06 +
        habits.transparentVoid * 0.1 +
        micJam.air * 0.1 +
        micJam.breath * 0.06 +
        PerformancePadState.void * 0.16 +
        safetyLift * 0.42 -
        resource * 0.04,
      0,
      1
    )
  };

  const weights = ModeTimbrePaletteState.weights;
  MODE_TIMBRE_PALETTE_KEYS.forEach((key) => {
    weights[key] = approachValue(weights[key], targets[key], 0.072);
  });

  const active = dominantModeTimbrePalette();
  ModeTimbrePaletteState.phase = fractionalPart((GrooveState.cycle + GenomeState.generation + 7) * GOLDEN_RATIO_INVERSE);
  ModeTimbrePaletteState.lastDecision = active;
  ModeTimbrePaletteState.active = active;
  ModeTimbrePaletteState.safety.densityBrake = densityBrake;
  ModeTimbrePaletteState.safety.lowClamp = lowClamp;
  ModeTimbrePaletteState.safety.brightnessDamp = brightnessDamp;
  ModeTimbrePaletteState.safety.restraint = restraint;

  const shape = ModeTimbrePaletteState.shape;
  shape.rhythm = clampValue(weights.technoDryGrid * 0.42 + weights.idmGlass * 0.24 + weights.pressureGhost * 0.14 + micJam.pulse * 0.06 + micJam.clap * 0.04 - weights.ambientHaze * 0.08 - weights.voidAir * 0.12 - restraint * 0.08, 0, 1);
  shape.haze = clampValue(weights.ambientHaze * 0.48 + weights.voidAir * 0.16 + weights.idmGlass * 0.06 + micJam.hum * 0.04 + micJam.breath * 0.04 - weights.technoDryGrid * 0.12 + restraint * 0.05, 0, 1);
  shape.glass = clampValue(weights.idmGlass * 0.34 + weights.ambientHaze * 0.15 + weights.voidAir * 0.14 + weights.technoDryGrid * 0.08 + RdjGrowthState.toy * 0.04 + micJam.phrase * 0.05 + micJam.hum * 0.02 - densityBrake * 0.04, 0, 1);
  shape.texture = clampValue(weights.technoDryGrid * 0.3 + weights.idmGlass * 0.26 + weights.pressureGhost * 0.12 + RdjGrowthState.edit * 0.04 + micJam.pulse * 0.05 + micJam.clap * 0.04 - weights.ambientHaze * 0.06 - weights.voidAir * 0.06 - brightnessDamp * 0.06, 0, 1);
  shape.air = clampValue(weights.voidAir * 0.44 + weights.ambientHaze * 0.2 + weights.idmGlass * 0.06 + SelfReviewGovernorState.airTail * 0.08 + micJam.air * 0.06 + micJam.breath * 0.03 - weights.pressureGhost * 0.05, 0, 1);
  shape.pad = clampValue(weights.ambientHaze * 0.42 + weights.voidAir * 0.24 + PerformancePadState.drift * 0.08 - weights.technoDryGrid * 0.12 - weights.pressureGhost * 0.04, 0, 1);
  shape.signature = clampValue(weights.idmGlass * 0.24 + weights.ambientHaze * 0.12 + weights.voidAir * 0.12 + weights.pressureGhost * 0.08 + ProducerHabitState.curiosity * 0.08 - densityBrake * 0.1 - restraint * 0.04, 0, 1);
  shape.transient = clampValue(weights.technoDryGrid * 0.32 + weights.pressureGhost * 0.28 + weights.idmGlass * 0.14 - weights.ambientHaze * 0.08 - weights.voidAir * 0.08 - brightnessDamp * 0.08, 0, 1);
  shape.lowClamp = clampValue(lowClamp * 0.58 + weights.voidAir * 0.18 + weights.pressureGhost * 0.08 + SelfReviewGovernorState.lowCleanup * 0.12, 0, 1);
  shape.restraint = restraint;
}

function musicRadioBrainBias(key) {
  const bias = MusicRadioBrainState.bias;
  if (key === "haze" || key === "ambient") return clampValue(bias.haze, 0, 1);
  if (key === "glass" || key === "idm" || key === "memory") return clampValue(bias.glass, 0, 1);
  if (key === "grid" || key === "techno" || key === "rhythm") return clampValue(bias.grid, 0, 1);
  if (key === "pressure" || key === "ghost") return clampValue(bias.pressure, 0, 1);
  if (key === "air" || key === "void" || key === "space") return clampValue(bias.air, 0, 1);
  if (key === "restraint") return clampValue(bias.restraint, 0, 1);
  if (key === "curiosity") return clampValue(bias.curiosity, 0, 1);
  return 0;
}

function musicRadioBrainPhraseCycles(offset = 0) {
  const phi = fractionalPart((GrooveState.cycle + MusicRadioBrainState.generation + offset + 1) * GOLDEN_RATIO_INVERSE);
  return Math.round(18 + phi * 24);
}

function musicRadioBrainReason(program) {
  if (program === "fieldStudy") return "haze/airを前にして長く聴ける作業部屋";
  if (program === "glassCoding") return "短いglassとmemory点で集中を少し揺らす";
  if (program === "dryGridWork") return "中高域のdry gridで速度感を出す";
  if (program === "ghostPressure") return "低域を守りつつbody snapだけ出す";
  if (program === "voidRoom") return "密度や明るさを逃がして透明なtailへ戻す";
  if (program === "hardTechno") return "高密度のpulseで4-on-the-floorを叩き続ける";
  if (program === "liveJazz") return "ウォーキングとブラシで生音感を残す部屋";
  if (program === "nightFunk") return "bodyとgrooveで黒いpocketを刻む";
  if (program === "quietPiano") return "feltピアノの和音と長い休符だけで部屋を整える";
  return "listen first";
}

function chooseMusicRadioBrainProgram(offset = 0) {
  const weights = MusicRadioBrainState.weights;
  const guard = MusicRadioBrainState.guard;
  if (guard.low > 0.72 || guard.bright > 0.76) return "voidRoom";
  if (guard.density > 0.78) return weights.voidRoom > weights.fieldStudy ? "voidRoom" : "fieldStudy";

  const phi = fractionalPart((GrooveState.cycle + MusicRadioBrainState.generation + offset + 1) * GOLDEN_RATIO_INVERSE);
  const weighted = MUSIC_RADIO_BRAIN_PROGRAMS.map((program) => [program, weights[program] || 0]);
  weighted.sort((a, b) => b[1] - a[1]);
  if ((weighted[0]?.[1] || 0) < 0.18) return "fieldStudy";
  if (phi < 0.62) return weighted[0][0];
  if (phi < 0.86) return weighted[1]?.[0] || weighted[0][0];
  return weighted[Math.min(weighted.length - 1, Math.floor(phi * weighted.length))]?.[0] || weighted[0][0] || "fieldStudy";
}

function musicRadioBrainRuntimeState() {
  return {
    generation: MusicRadioBrainState.generation,
    phrase: MusicRadioBrainState.phrase,
    phraseCycles: MusicRadioBrainState.phraseCycles,
    active: MusicRadioBrainState.active,
    next: MusicRadioBrainState.next,
    blend: MusicRadioBrainState.blend,
    phase: MusicRadioBrainState.phase,
    weights: { ...MusicRadioBrainState.weights },
    bias: { ...MusicRadioBrainState.bias },
    guard: { ...MusicRadioBrainState.guard },
    lastDecision: MusicRadioBrainState.lastDecision,
    lastReason: MusicRadioBrainState.lastReason,
    cuePending: MusicRadioBrainState.cuePending,
    cueProgram: MusicRadioBrainState.cueProgram
  };
}

function musicRadioBrainPacketState() {
  return {
    program: MusicRadioBrainState.active,
    next_program: MusicRadioBrainState.next,
    blend: packetUnit(MusicRadioBrainState.blend),
    reason: MusicRadioBrainState.lastReason,
    bias: {
      haze: packetUnit(MusicRadioBrainState.bias.haze),
      glass: packetUnit(MusicRadioBrainState.bias.glass),
      grid: packetUnit(MusicRadioBrainState.bias.grid),
      pressure: packetUnit(MusicRadioBrainState.bias.pressure),
      air: packetUnit(MusicRadioBrainState.bias.air),
      restraint: packetUnit(MusicRadioBrainState.bias.restraint),
      curiosity: packetUnit(MusicRadioBrainState.bias.curiosity)
    },
    metadata_only: true
  };
}

function advanceMusicRadioBrain(context = {}) {
  if (MusicRadioBrainState.lastCycle === GrooveState.cycle) return;
  MusicRadioBrainState.lastCycle = GrooveState.cycle;
  MusicRadioBrainState.phrase += 1;
  if (GrooveState.cycle % 29 === 0) MusicRadioBrainState.generation += 1;

  const energy = clampValue(context.energyNorm ?? unitValue(UCM_CUR.energy), 0, 1);
  const creation = clampValue(context.creationNorm ?? unitValue(UCM_CUR.creation), 0, 1);
  const resource = clampValue(context.resourceNorm ?? unitValue(UCM_CUR.resource), 0, 1);
  const wave = clampValue(context.waveNorm ?? unitValue(UCM_CUR.wave), 0, 1);
  const observer = clampValue(context.observerNorm ?? unitValue(UCM_CUR.observer), 0, 1);
  const circle = clampValue(context.circleNorm ?? unitValue(UCM_CUR.circle), 0, 1);
  const voidness = clampValue(context.voidNorm ?? unitValue(UCM_CUR.void), 0, 1);
  const body = clampValue(unitValue(UCM_CUR.body), 0, 1);
  const bpmNorm = clampValue((EngineParams.bpm - 58) / 90, 0, 1);
  const palettes = ModeTimbrePaletteState.weights;
  const review = musicSelfReviewRuntimeState();
  const risk = ProducerHabitState.riskSnapshot || producerHabitRiskSnapshot();
  const densityGuard = clampValue(Math.max(review.densityRisk || 0, risk.density || 0, MixGovernorState.eventLoad || 0), 0, 1);
  const lowGuard = clampValue(Math.max(review.lowEndRisk || 0, risk.low || 0, MixGovernorState.lowGuard || 0), 0, 1);
  const brightGuard = clampValue(Math.max(review.brightnessRisk || 0, risk.bright || 0), 0, 1);
  const guardMax = Math.max(densityGuard, lowGuard, brightGuard);
  const weights = MusicRadioBrainState.weights;

  MusicRadioBrainState.guard.density = densityGuard;
  MusicRadioBrainState.guard.low = lowGuard;
  MusicRadioBrainState.guard.bright = brightGuard;

  const targets = {
    fieldStudy: clampValue(
      palettes.ambientHaze * 0.34 +
        (1 - energy) * 0.16 +
        observer * 0.14 +
        circle * 0.1 +
        ReferenceMorphState.haze * 0.1 +
        MusicRadioBrainState.bias.restraint * 0.05 +
        (1 - densityGuard) * 0.06,
      0,
      1
    ),
    glassCoding: clampValue(
      palettes.idmGlass * 0.34 +
        creation * 0.12 +
        wave * 0.1 +
        ReferenceMorphState.broken * 0.12 +
        ReferenceMorphState.organic * 0.08 +
        RdjGrowthState.toy * 0.06 +
        RdjGrowthState.edit * 0.06 +
        ProducerHabitState.curiosity * 0.08 -
        densityGuard * 0.12,
      0,
      1
    ),
    dryGridWork: clampValue(
      palettes.technoDryGrid * 0.34 +
        bpmNorm * 0.12 +
        energy * 0.1 +
        resource * 0.12 +
        ReferenceMorphState.pulse * 0.1 +
        ProducerHabitState.habits.dryGrid * 0.08 +
        PerformancePadState.repeat * 0.08 -
        brightGuard * 0.16 -
        voidness * 0.08,
      0,
      1
    ),
    ghostPressure: clampValue(
      palettes.pressureGhost * 0.34 +
        body * 0.14 +
        energy * 0.08 +
        (GradientState.ghost || 0) * 0.1 +
        ProducerHabitState.habits.ghostPressure * 0.1 +
        PerformancePadState.punch * 0.18 -
        lowGuard * 0.2 -
        voidness * 0.08,
      0,
      1
    ),
    voidRoom: clampValue(
      palettes.voidAir * 0.34 +
        voidness * 0.14 +
        observer * 0.1 +
        ReferenceMorphState.void * 0.14 +
        ReferenceMorphState.chrome * 0.06 +
        PerformancePadState.void * 0.16 +
        guardMax * 0.24 +
        SelfReviewGovernorState.airTail * 0.08,
      0,
      1
    ),
    hardTechno: clampValue(
      palettes.technoDryGrid * 0.22 +
        bpmNorm * 0.18 +
        energy * 0.16 +
        body * 0.1 +
        ReferenceMorphState.pulse * 0.14 +
        ProducerHabitState.habits.dryGrid * 0.06 +
        PerformancePadState.repeat * 0.06 -
        voidness * 0.12 -
        brightGuard * 0.14 -
        lowGuard * 0.1,
      0,
      1
    ),
    liveJazz: clampValue(
      palettes.idmGlass * 0.16 +
        palettes.ambientHaze * 0.1 +
        wave * 0.16 +
        creation * 0.14 +
        ReferenceMorphState.organic * 0.18 +
        ReferenceMorphState.haze * 0.06 +
        (1 - energy) * 0.06 -
        densityGuard * 0.1 -
        voidness * 0.06,
      0,
      1
    ),
    nightFunk: clampValue(
      palettes.pressureGhost * 0.2 +
        body * 0.16 +
        creation * 0.12 +
        energy * 0.1 +
        ReferenceMorphState.pulse * 0.12 +
        ReferenceMorphState.organic * 0.08 +
        ProducerHabitState.habits.ghostPressure * 0.06 -
        lowGuard * 0.12 -
        voidness * 0.08,
      0,
      1
    ),
    quietPiano: clampValue(
      palettes.ambientHaze * 0.18 +
        creation * 0.14 +
        observer * 0.12 +
        circle * 0.1 +
        ReferenceMorphState.organic * 0.16 +
        ReferenceMorphState.haze * 0.08 +
        MusicRadioBrainState.bias.restraint * 0.08 +
        (1 - energy) * 0.08 -
        densityGuard * 0.12 -
        brightGuard * 0.08,
      0,
      1
    )
  };

  MUSIC_RADIO_BRAIN_PROGRAMS.forEach((program) => {
    weights[program] = approachValue(weights[program], targets[program], 0.045);
  });

  if (MusicRadioBrainState.phrase >= MusicRadioBrainState.phraseCycles || guardMax > 0.82) {
    const previousProgram = MusicRadioBrainState.active;
    MusicRadioBrainState.active = guardMax > 0.82 ? chooseMusicRadioBrainProgram(13) : MusicRadioBrainState.next;
    MusicRadioBrainState.next = chooseMusicRadioBrainProgram(7);
    MusicRadioBrainState.phrase = 0;
    MusicRadioBrainState.phraseCycles = musicRadioBrainPhraseCycles(11);
    MusicRadioBrainState.lastDecision = MusicRadioBrainState.active;
    MusicRadioBrainState.lastReason = musicRadioBrainReason(MusicRadioBrainState.active);
    if (MusicRadioBrainState.active !== previousProgram) {
      MusicRadioBrainState.cuePending = true;
      MusicRadioBrainState.cueProgram = MusicRadioBrainState.active;
      MusicRadioBrainState.cueCycle = GrooveState.cycle;
    }
  }

  const progress = MusicRadioBrainState.phrase / Math.max(1, MusicRadioBrainState.phraseCycles);
  MusicRadioBrainState.blend = smoothStep01(progress);
  MusicRadioBrainState.phase = fractionalPart((GrooveState.cycle + MusicRadioBrainState.generation + 9) * GOLDEN_RATIO_INVERSE);

  const current = MusicRadioBrainState.active;
  const next = MusicRadioBrainState.next;
  const mix = MusicRadioBrainState.blend * 0.42;
  const programWeight = (program) => {
    const base = current === program ? 1 - mix : 0;
    const incoming = next === program ? mix : 0;
    return clampValue(base + incoming + (weights[program] || 0) * 0.18, 0, 1);
  };
  const field = programWeight("fieldStudy");
  const glass = programWeight("glassCoding");
  const grid = programWeight("dryGridWork");
  const pressure = programWeight("ghostPressure");
  const room = programWeight("voidRoom");
  const hardTechno = programWeight("hardTechno");
  const liveJazz = programWeight("liveJazz");
  const nightFunk = programWeight("nightFunk");
  const quietPiano = programWeight("quietPiano");
  const bias = MusicRadioBrainState.bias;

  bias.haze = approachValue(bias.haze, clampValue(field * 0.42 + room * 0.12 + liveJazz * 0.06 + quietPiano * 0.16 + ReferenceMorphState.haze * 0.08, 0, 1), 0.055);
  bias.glass = approachValue(bias.glass, clampValue(glass * 0.42 + field * 0.08 + liveJazz * 0.12 + quietPiano * 0.06 + RdjGrowthState.toy * 0.05 - densityGuard * 0.04, 0, 1), 0.06);
  bias.grid = approachValue(bias.grid, clampValue(grid * 0.42 + glass * 0.08 + hardTechno * 0.34 + nightFunk * 0.1 + PerformancePadState.repeat * 0.06 - brightGuard * 0.08, 0, 1), 0.06);
  bias.pressure = approachValue(bias.pressure, clampValue(pressure * 0.42 + grid * 0.06 + hardTechno * 0.12 + nightFunk * 0.32 + PerformancePadState.punch * 0.08 - lowGuard * 0.12, 0, 1), 0.055);
  bias.air = approachValue(bias.air, clampValue(room * 0.46 + field * 0.14 + liveJazz * 0.16 + quietPiano * 0.14 + SelfReviewGovernorState.airTail * 0.08 + guardMax * 0.08, 0, 1), 0.052);
  bias.restraint = approachValue(bias.restraint, clampValue(0.18 + field * 0.18 + room * 0.24 + liveJazz * 0.08 + quietPiano * 0.18 + guardMax * 0.32 + ReferenceMorphState.restraint * 0.14 - glass * 0.04 - hardTechno * 0.06 - nightFunk * 0.04, 0, 1), 0.05);
  bias.curiosity = approachValue(bias.curiosity, clampValue(glass * 0.22 + grid * 0.12 + nightFunk * 0.08 + RdjGrowthState.wrong * 0.08 + ProducerHabitState.curiosity * 0.22 - guardMax * 0.16, 0, 1), 0.055);

  ModeTimbrePaletteState.weights.ambientHaze = approachValue(ModeTimbrePaletteState.weights.ambientHaze, clampValue(ModeTimbrePaletteState.weights.ambientHaze + bias.haze * 0.035 + bias.restraint * 0.012, 0, 1), 0.04);
  ModeTimbrePaletteState.weights.idmGlass = approachValue(ModeTimbrePaletteState.weights.idmGlass, clampValue(ModeTimbrePaletteState.weights.idmGlass + bias.glass * 0.032 + bias.curiosity * 0.01 - densityGuard * 0.016, 0, 1), 0.04);
  ModeTimbrePaletteState.weights.technoDryGrid = approachValue(ModeTimbrePaletteState.weights.technoDryGrid, clampValue(ModeTimbrePaletteState.weights.technoDryGrid + bias.grid * 0.03 - brightGuard * 0.022, 0, 1), 0.04);
  ModeTimbrePaletteState.weights.pressureGhost = approachValue(ModeTimbrePaletteState.weights.pressureGhost, clampValue(ModeTimbrePaletteState.weights.pressureGhost + bias.pressure * 0.026 - lowGuard * 0.028, 0, 1), 0.04);
  ModeTimbrePaletteState.weights.voidAir = approachValue(ModeTimbrePaletteState.weights.voidAir, clampValue(ModeTimbrePaletteState.weights.voidAir + bias.air * 0.04 + guardMax * 0.022, 0, 1), 0.04);

  ModeTimbrePaletteState.shape.haze = clampValue(ModeTimbrePaletteState.shape.haze + bias.haze * 0.018, 0, 1);
  ModeTimbrePaletteState.shape.glass = clampValue(ModeTimbrePaletteState.shape.glass + bias.glass * 0.018, 0, 1);
  ModeTimbrePaletteState.shape.rhythm = clampValue(ModeTimbrePaletteState.shape.rhythm + bias.grid * 0.016 - bias.air * 0.008, 0, 1);
  ModeTimbrePaletteState.shape.transient = clampValue(ModeTimbrePaletteState.shape.transient + bias.pressure * 0.014 - lowGuard * 0.018, 0, 1);
  ModeTimbrePaletteState.shape.air = clampValue(ModeTimbrePaletteState.shape.air + bias.air * 0.02, 0, 1);
  ModeTimbrePaletteState.shape.restraint = clampValue(Math.max(ModeTimbrePaletteState.shape.restraint, bias.restraint * 0.9), 0, 1);
}

function selfReviewMeterNormalized() {
  try {
    if (!selfReviewMeter || typeof selfReviewMeter.getValue !== "function") return 0;
    const value = Number(selfReviewMeter.getValue());
    if (!Number.isFinite(value)) return 0;
    if (value >= 0 && value <= 1.2) return clampValue(value, 0, 1);
    return clampValue((value + 60) / 60, 0, 1);
  } catch (error) {
    return 0;
  }
}

function selfReviewNumber(value, digits = 3) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const factor = 10 ** digits;
  return Math.round(clampValue(safe, 0, 1) * factor) / factor;
}

function micFollowNumber(value, digits = 3, min = 0, max = 1) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const factor = 10 ** digits;
  return Math.round(clampValue(safe, min, max) * factor) / factor;
}

function resetMicJamState() {
  MicJamState.gesture = "silent";
  MicJamState.previousGesture = "silent";
  MicJamState.drive = 0;
  MicJamState.pulse = 0;
  MicJamState.phrase = 0;
  MicJamState.clap = 0;
  MicJamState.hum = 0;
  MicJamState.air = 1;
  MicJamState.noisy = 0;
  MicJamState.confidence = 0;
  MicJamState.bpmLock = 0;
  MicJamState.cooldownSteps = 0;
  MicJamState.lastCueStep = -99;
  MicJamState.lastGestureAt = 0;
  MicJamState.updatedAt = Date.now();
}

function classifyMicJamGesture(f = {}) {
  const level = clampValue(Number(f.inputLevel) || 0, 0, 1);
  const onset = clampValue(Number(f.onsetRate) || 0, 0, 1);
  const density = clampValue(Number(f.density) || 0, 0, 1);
  const stability = clampValue(Number(f.stability) || 0, 0, 1);
  const silence = clampValue(Number(f.silence) || 0, 0, 1);
  const brightness = clampValue(Number(f.brightness) || 0, 0, 1);
  const tempo = Number(f.roughTempo) || 0;

  if (silence > 0.74 && level < 0.035 && onset < 0.08) return "silent";
  if (level > 0.18 && onset > 0.32 && brightness > 0.14) return "clap";
  if (tempo > 0 && onset > 0.16 && stability > 0.34) return "pulse";
  if (level > 0.08 && stability > 0.64 && onset < 0.16 && brightness < 0.23) return "hum";
  if (level > 0.035 && level < 0.16 && stability > 0.52 && onset < 0.14) return "breath";
  if (level > 0.07 && density > 0.16 && onset < 0.38) return "phrase";
  if (brightness > 0.42 && density > 0.28) return "noisy";
  return level > 0.045 ? "phrase" : "silent";
}

function updateMicJamState(features = MicFollowState.features || {}) {
  const gesture = MicFollowState.enabled ? classifyMicJamGesture(features) : "silent";
  const level = clampValue(Number(features.inputLevel) || 0, 0, 1);
  const onset = clampValue(Number(features.onsetRate) || 0, 0, 1);
  const density = clampValue(Number(features.density) || 0, 0, 1);
  const stability = clampValue(Number(features.stability) || 0, 0, 1);
  const silence = clampValue(Number(features.silence) || 0, 0, 1);
  const brightness = clampValue(Number(features.brightness) || 0, 0, 1);
  const tempo = Number(features.roughTempo) || 0;
  const noisy = gesture === "noisy" ? clampValue(brightness * 0.64 + density * 0.36, 0, 1) : 0;
  const rawDrive = MicFollowState.enabled
    ? clampValue(level * 0.34 + density * 0.26 + onset * 0.32 + brightness * 0.08 - silence * 0.1, 0, 1)
    : 0;
  const confidence = MicFollowState.enabled
    ? clampValue(rawDrive * 0.52 + stability * 0.24 + onset * 0.18 + (tempo ? 0.12 : 0) - noisy * 0.28, 0, 1)
    : 0;
  const bpmLock = confidence > 0.28 && onset > 0.12 && stability > 0.32 && tempo ? tempo : 0;

  if (gesture !== MicJamState.gesture) {
    MicJamState.previousGesture = MicJamState.gesture;
    MicJamState.gesture = gesture;
    MicJamState.lastGestureAt = performanceNowMs();
  }

  MicJamState.drive = approachValue(MicJamState.drive, rawDrive, 0.28);
  MicJamState.pulse = approachValue(MicJamState.pulse, gesture === "pulse" || gesture === "clap" ? clampValue(onset * 0.7 + density * 0.3, 0, 1) : 0, 0.24);
  MicJamState.phrase = approachValue(MicJamState.phrase, gesture === "phrase" ? clampValue(density * 0.58 + level * 0.42, 0, 1) : 0, 0.22);
  MicJamState.clap = approachValue(MicJamState.clap, gesture === "clap" ? clampValue(onset * 0.7 + brightness * 0.3, 0, 1) : 0, 0.3);
  MicJamState.hum = approachValue(MicJamState.hum, gesture === "hum" ? clampValue(level * 0.46 + stability * 0.54, 0, 1) : 0, 0.18);
  MicJamState.air = approachValue(MicJamState.air, gesture === "silent" || gesture === "breath" || gesture === "hum" ? clampValue(silence * 0.5 + stability * 0.3 + (1 - density) * 0.2, 0, 1) : 0, 0.18);
  MicJamState.noisy = approachValue(MicJamState.noisy, noisy, 0.28);
  MicJamState.confidence = approachValue(MicJamState.confidence, confidence, 0.24);
  MicJamState.bpmLock = bpmLock;
  MicJamState.updatedAt = Date.now();
  return micJamRuntimeState();
}

function resetMicFollowFeatures(status = "off") {
  MicFollowState.features = {
    inputLevel: 0,
    onsetRate: 0,
    roughTempo: 0,
    density: 0,
    stability: 0,
    silence: 1,
    brightness: 0,
    lastOnsetAt: 0
  };
  MicFollowState.lastLevel = 0;
  MicFollowState.onsetTimes = [];
  MicFollowState.updatedAt = Date.now();
  MicFollowState.status = status;
  resetMicJamState();
}

function micFollowRuntimeState() {
  const f = MicFollowState.features || {};
  return {
    schema: "music.mic-follow.v1",
    enabled: !!MicFollowState.enabled,
    pending: !!MicFollowState.pending,
    supported: !!MicFollowState.supported,
    status: MicFollowState.status,
    inputLevel: micFollowNumber(f.inputLevel),
    onsetRate: micFollowNumber(f.onsetRate),
    roughTempo: Math.round(clampValue(Number(f.roughTempo) || 0, 0, 240)),
    density: micFollowNumber(f.density),
    stability: micFollowNumber(f.stability),
    silence: micFollowNumber(f.silence),
    brightness: micFollowNumber(f.brightness),
    lastOnsetAt: Math.round(Number(f.lastOnsetAt) || 0),
    updatedAt: MicFollowState.updatedAt || 0,
    safety: {
      stores_audio: false,
      stores_samples: false,
      stores_lyrics: false,
      uploads_audio: false,
      metadata_only: true
    }
  };
}

function micJamRuntimeState() {
  return {
    schema: "music.mic-jam.v2",
    active: !!MicFollowState.enabled && MicJamState.confidence > 0.04,
    gesture: MicJamState.gesture,
    previousGesture: MicJamState.previousGesture,
    drive: micFollowNumber(MicJamState.drive),
    pulse: micFollowNumber(MicJamState.pulse),
    phrase: micFollowNumber(MicJamState.phrase),
    clap: micFollowNumber(MicJamState.clap),
    hum: micFollowNumber(MicJamState.hum),
    air: micFollowNumber(MicJamState.air),
    noisy: micFollowNumber(MicJamState.noisy),
    confidence: micFollowNumber(MicJamState.confidence),
    bpmLock: Math.round(clampValue(Number(MicJamState.bpmLock) || 0, 0, 240)),
    updatedAt: MicJamState.updatedAt || 0,
    safety: {
      stores_audio: false,
      uploads_audio: false,
      metadata_only: true
    }
  };
}

function micJamPacketState() {
  const state = micJamRuntimeState();
  return {
    active: state.active,
    gesture: state.gesture,
    previous_gesture: state.previousGesture,
    drive: state.drive,
    pulse: state.pulse,
    phrase: state.phrase,
    clap: state.clap,
    hum: state.hum,
    air: state.air,
    noisy: state.noisy,
    bpm_lock: state.bpmLock,
    confidence: state.confidence,
    metadata_only: true,
    stores_audio: false
  };
}

function micFollowPacketState() {
  const state = micFollowRuntimeState();
  const jam = micJamPacketState();
  return {
    enabled: state.enabled,
    status: state.status,
    input_level: state.inputLevel,
    onset_rate: state.onsetRate,
    rough_tempo: state.roughTempo,
    density: state.density,
    stability: state.stability,
    silence: state.silence,
    brightness: state.brightness,
    active: jam.active,
    gesture: jam.gesture,
    previous_gesture: jam.previous_gesture,
    drive: jam.drive,
    pulse: jam.pulse,
    phrase: jam.phrase,
    clap: jam.clap,
    hum: jam.hum,
    air: jam.air,
    noisy: jam.noisy,
    bpm_lock: jam.bpm_lock,
    confidence: jam.confidence,
    metadata_only: true,
    stores_audio: false
  };
}

function updateMicFollowButton() {
  if (typeof document === "undefined") return;
  const btn = document.getElementById("btn_mic_follow");
  if (btn) {
    const jam = micJamRuntimeState();
    const drive = Math.round((jam.drive || 0) * 100);
    btn.textContent = MicFollowState.pending ? "MIC..." : MicFollowState.enabled ? (drive > 5 ? `MIC ${drive}` : "MIC ON") : MicFollowState.status.startsWith("error") || MicFollowState.status.startsWith("permission") ? "MIC ERR" : "MIC";
    btn.classList.toggle("is-active", !!MicFollowState.enabled);
    btn.setAttribute("aria-pressed", MicFollowState.enabled ? "true" : "false");
    btn.title = MicFollowState.enabled
      ? "MIC FOLLOW ON: 録音せずローカルfeaturesだけ解析しています"
      : "マイク入力を録音せずローカルfeaturesだけ解析";
  }
  if (document.body) document.body.dataset.micFollow = MicFollowState.enabled ? "true" : "false";
  updateMicFollowReadout(true);
}

function updateMicFollowReadout(force = false) {
  if (typeof document === "undefined") return;
  const now = performanceNowMs();
  if (!force && now - (MicFollowState.lastUiAt || 0) < 120) return;
  MicFollowState.lastUiAt = now;

  const panel = document.getElementById("mic_follow_panel");
  const label = document.getElementById("mic_follow_label");
  const bar = document.getElementById("mic_follow_bar");
  const detail = document.getElementById("mic_follow_detail");
  const f = MicFollowState.features || {};
  const jam = micJamRuntimeState();
  const level = clampValue(Number(f.inputLevel) || 0, 0, 1);
  const density = clampValue(Number(f.density) || 0, 0, 1);
  const onset = clampValue(Number(f.onsetRate) || 0, 0, 1);
  const tempo = Math.round(clampValue(Number(f.roughTempo) || 0, 0, 240));
  const active = !!MicFollowState.enabled;
  const response = clampValue(Math.max(jam.drive || 0, level * 0.52 + density * 0.22 + onset * 0.24), 0, 1);
  const reacting = active && response > 0.06;
  const error = String(MicFollowState.status || "").startsWith("error") || String(MicFollowState.status || "").startsWith("permission");

  if (panel) {
    panel.classList.toggle("is-active", active);
    panel.classList.toggle("is-reacting", reacting);
    panel.classList.toggle("is-error", error);
    panel.dataset.gesture = active ? jam.gesture : "off";
  }
  if (label) {
    if (MicFollowState.pending) label.textContent = "MIC requesting";
    else if (active) label.textContent = reacting ? `${String(jam.gesture || "mic").toUpperCase()} ${Math.round(response * 100)}%` : "MIC listening";
    else if (error) label.textContent = "MIC error";
    else label.textContent = "MIC off";
  }
  if (bar) bar.style.width = `${Math.round(response * 100)}%`;
  if (detail) {
    detail.textContent = active
      ? `drive ${Math.round((jam.drive || 0) * 100)} / conf ${Math.round((jam.confidence || 0) * 100)} / ${jam.bpmLock || tempo || "--"} bpm`
      : "任意: grooveだけ曲げる / local features only";
  }
  const btn = document.getElementById("btn_mic_follow");
  if (btn && active && !MicFollowState.pending) {
    const drive = Math.round((jam.drive || 0) * 100);
    btn.textContent = drive > 5 ? `MIC ${drive}` : "MIC ON";
  }
}

function estimateMicFollowTempo() {
  if (MicFollowState.onsetTimes.length < 3) return 0;
  const intervals = MicFollowState.onsetTimes
    .slice(1)
    .map((time, index) => time - MicFollowState.onsetTimes[index])
    .filter((ms) => ms > 220 && ms < 1400);
  if (!intervals.length) return 0;
  const average = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length;
  return Math.round(clampValue(60000 / average, 54, 190));
}

function updateMicFollowAnalysis() {
  if (!MicFollowState.enabled || !MicFollowState.analyser || !MicFollowState.buffer) return MicFollowState.features;

  try {
    MicFollowState.analyser.getFloatTimeDomainData(MicFollowState.buffer);
  } catch (error) {
    MicFollowState.status = "analysis error";
    updateMicFollowButton();
    return MicFollowState.features;
  }

  let sum = 0;
  let zeroCrossings = 0;
  for (let i = 0; i < MicFollowState.buffer.length; i += 1) {
    const sample = MicFollowState.buffer[i];
    sum += sample * sample;
    if (i > 0 && Math.sign(sample) !== Math.sign(MicFollowState.buffer[i - 1])) zeroCrossings += 1;
  }

  const rms = Math.sqrt(sum / MicFollowState.buffer.length);
  const level = clampValue(rms * 8, 0, 1);
  const now = performanceNowMs();
  const onset = level > 0.08 && level - MicFollowState.lastLevel > 0.09;
  if (onset) MicFollowState.onsetTimes.push(now);
  MicFollowState.onsetTimes = MicFollowState.onsetTimes.filter((time) => now - time < 4000);

  const onsetRate = clampValue(MicFollowState.onsetTimes.length / 14, 0, 1);
  const roughTempo = estimateMicFollowTempo();
  const density = clampValue(level * 0.55 + onsetRate * 0.45, 0, 1);
  const stability = clampValue(1 - Math.abs(level - MicFollowState.lastLevel) * 2.2, 0, 1);
  const silence = clampValue(1 - level * 3.6 - onsetRate * 0.7, 0, 1);
  const brightness = clampValue((zeroCrossings / MicFollowState.buffer.length) * 3.2, 0, 1);

  MicFollowState.lastLevel = level;
  MicFollowState.features = {
    inputLevel: level,
    onsetRate,
    roughTempo,
    density,
    stability,
    silence,
    brightness,
    lastOnsetAt: MicFollowState.onsetTimes[MicFollowState.onsetTimes.length - 1] || 0
  };
  MicFollowState.updatedAt = Date.now();
  MicFollowState.status = "local features only";
  updateMicJamState(MicFollowState.features);
  updateMicFollowReadout();
  return MicFollowState.features;
}

function applyMicFollowBiasKey(key, desiredBias, step) {
  if (!Object.prototype.hasOwnProperty.call(UCM_TARGET, key)) return;
  const previous = Number(MicFollowState.targetBias[key]) || 0;
  const next = approachValue(previous, clampValue(desiredBias, -18, 18), step);
  const delta = next - previous;
  if (Math.abs(delta) > 0.0001) {
    UCM_TARGET[key] = clampValue((Number(UCM_TARGET[key]) || 0) + delta, 0, 100);
  }
  MicFollowState.targetBias[key] = next;
}

function releaseMicFollowTargetBias(force = false) {
  const step = force ? 64 : 0.18;
  for (const key of UCM_KEYS) {
    const previous = Number(MicFollowState.targetBias[key]) || 0;
    if (!previous) continue;
    const next = force ? 0 : approachValue(previous, 0, step);
    UCM_TARGET[key] = clampValue((Number(UCM_TARGET[key]) || 0) + (next - previous), 0, 100);
    MicFollowState.targetBias[key] = next;
  }
}

function applyMicFollowTargetBias(dt = 0.016) {
  if (!MicFollowState.enabled) {
    releaseMicFollowTargetBias(false);
    return;
  }

  const f = updateMicFollowAnalysis();
  const loudDense = clampValue(f.inputLevel * 0.38 + f.density * 0.34 + f.onsetRate * 0.28, 0, 1);
  const quietStable = clampValue(f.silence * 0.54 + f.stability * 0.28 + (1 - f.density) * 0.18, 0, 1);
  const particle = clampValue(f.onsetRate * 0.48 + f.density * 0.24 + f.brightness * 0.18 + f.inputLevel * 0.1, 0, 1);
  const followScale = clampValue((UCM.auto.enabled ? 0.34 : 0.58) * (0.7 + f.stability * 0.3), 0.18, 0.7);
  const step = clampValue(dt * 3.2, 0.04, 0.22);

  const desired = {
    energy: (loudDense * 11 - quietStable * 4) * followScale,
    wave: (particle * 8 + f.stability * 2 - quietStable * 2) * followScale,
    mind: (particle * 4 + quietStable * 2) * followScale,
    creation: (particle * 8 + loudDense * 3 - quietStable * 2) * followScale,
    void: (quietStable * 11 - loudDense * 5) * followScale,
    circle: (quietStable * 7 - particle * 1.5) * followScale,
    body: (loudDense * 6 - quietStable * 2.5) * followScale,
    resource: (loudDense * 8 + particle * 4 - quietStable * 2) * followScale,
    observer: (quietStable * 6 + f.stability * 3 - loudDense * 1.5) * followScale
  };

  for (const key of UCM_KEYS) applyMicFollowBiasKey(key, desired[key] || 0, step);
}

function micFollowKitBias() {
  if (!MicFollowState.enabled) return { ambient: 0, idm: 0, techno: 0, pressure: 0, space: 0 };
  const f = MicFollowState.features || {};
  const jam = micJamShape();
  const loudDense = clampValue(f.inputLevel * 0.38 + f.density * 0.34 + f.onsetRate * 0.28, 0, 1);
  const quietStable = clampValue(f.silence * 0.54 + f.stability * 0.28 + (1 - f.density) * 0.18, 0, 1);
  const particle = clampValue(f.onsetRate * 0.5 + f.density * 0.24 + f.brightness * 0.2, 0, 1);
  return {
    ambient: quietStable * 0.06 + jam.hum * 0.035 + jam.breath * 0.03,
    idm: particle * 0.07 + jam.phrase * 0.052 + jam.pulse * 0.028,
    techno: loudDense * 0.045 + particle * 0.026 + jam.pulse * 0.052 + jam.clap * 0.042,
    pressure: clampValue(f.inputLevel * 0.055 + f.density * 0.028 + jam.clap * 0.026 - f.silence * 0.03 - jam.noisy * 0.025, 0, 0.08),
    space: quietStable * 0.07 + jam.air * 0.04 + jam.breath * 0.03
  };
}

function micFollowGrooveShape() {
  if (!MicFollowState.enabled) return { pulse: 0, particle: 0, space: 0 };
  const f = MicFollowState.features || {};
  const jam = micJamShape();
  const pulse = clampValue((f.inputLevel || 0) * 0.3 + (f.density || 0) * 0.35 + (f.onsetRate || 0) * 0.35, 0, 1);
  const particle = clampValue((f.onsetRate || 0) * 0.48 + (f.density || 0) * 0.28 + (f.brightness || 0) * 0.24, 0, 1);
  const space = clampValue((f.silence || 0) * 0.5 + (f.stability || 0) * 0.25 + (1 - (f.density || 0)) * 0.25, 0, 1);
  return {
    pulse: clampValue(Math.max(pulse, jam.pulse * 0.92 + jam.clap * 0.5), 0, 1),
    particle: clampValue(Math.max(particle, jam.phrase * 0.62 + jam.pulse * 0.28 + jam.clap * 0.34), 0, 1),
    space: clampValue(Math.max(space, jam.air * 0.86 + jam.breath * 0.4), 0, 1)
  };
}

function micJamShape() {
  if (!MicFollowState.enabled) {
    return { drive: 0, pulse: 0, phrase: 0, clap: 0, hum: 0, breath: 0, air: 0, noisy: 0, confidence: 0, bpmLock: 0 };
  }
  const gesture = MicJamState.gesture;
  const confidence = clampValue(MicJamState.confidence || 0, 0, 1);
  const safety = clampValue(1 - Math.max(SelfReviewGovernorState.densityBrake || 0, SelfReviewGovernorState.transientSoftener || 0, MixGovernorState.eventLoad || 0) * 0.34, 0.48, 1);
  return {
    drive: clampValue((MicJamState.drive || 0) * confidence * safety, 0, 1),
    pulse: clampValue((MicJamState.pulse || 0) * confidence * safety, 0, 1),
    phrase: clampValue((MicJamState.phrase || 0) * confidence * safety, 0, 1),
    clap: clampValue((MicJamState.clap || 0) * confidence * safety, 0, 1),
    hum: clampValue((MicJamState.hum || 0) * confidence, 0, 1),
    breath: gesture === "breath" ? clampValue((MicJamState.air || 0) * confidence, 0, 1) : 0,
    air: clampValue((MicJamState.air || 0) * (0.55 + confidence * 0.45), 0, 1),
    noisy: clampValue(MicJamState.noisy || 0, 0, 1),
    confidence,
    bpmLock: MicJamState.bpmLock || 0
  };
}

function decayMicJam() {
  if (MicJamState.cooldownSteps > 0) MicJamState.cooldownSteps = Math.max(0, MicJamState.cooldownSteps - 1);
}

function micFollowTempoBias(rawTarget = EngineParams.bpm || 80) {
  if (!MicFollowState.enabled) return 0;
  const f = MicFollowState.features || {};
  const jam = micJamShape();
  const tempo = jam.bpmLock || f.roughTempo;
  if (!tempo || f.stability < 0.34 || f.onsetRate < 0.1 || jam.confidence < 0.24) return 0;
  const influence = clampValue(f.stability * 0.08 + f.onsetRate * 0.08 + f.density * 0.04 + jam.pulse * 0.05 + jam.clap * 0.025, 0, 0.22);
  return clampValue((tempo - rawTarget) * influence, -7.5, 7.5);
}

async function startMicFollow() {
  if (MicFollowState.enabled || MicFollowState.pending) return MicFollowState.enabled;
  MicFollowState.supported = !!navigator.mediaDevices?.getUserMedia;
  if (!MicFollowState.supported) {
    resetMicFollowFeatures("getUserMedia unsupported");
    setRecorderStatus("MIC unavailable");
    updateMicFollowButton();
    return false;
  }

  MicFollowState.pending = true;
  MicFollowState.status = "requesting permission";
  updateMicFollowButton();
  try {
    await resumeAudioContext("mic-follow");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });
    const context = getNativeAudioContext();
    if (!context || typeof context.createMediaStreamSource !== "function") throw new Error("AudioContext unavailable");
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.42;
    const buffer = new Float32Array(analyser.fftSize);
    source.connect(analyser);

    Object.assign(MicFollowState, {
      enabled: true,
      pending: false,
      status: "local features only",
      stream,
      source,
      analyser,
      buffer,
      onsetTimes: [],
      lastLevel: 0,
      updatedAt: Date.now()
    });
    updateMicFollowAnalysis();
    setRecorderStatus("MIC ON / local features only");
    updateMicFollowButton();
    publishMusicRuntimeState();
    return true;
  } catch (error) {
    console.warn("[Music] mic follow start failed:", error);
    stopMicFollow({ silent: true, releaseBias: true });
    MicFollowState.pending = false;
    MicFollowState.status = error && error.name === "NotAllowedError" ? "permission denied" : `error: ${error.message || "mic failed"}`;
    setRecorderStatus("MIC ERR");
    updateMicFollowButton();
    publishMusicRuntimeState();
    return false;
  }
}

function stopMicFollow(options = {}) {
  try { MicFollowState.source?.disconnect?.(); } catch (error) {}
  try { MicFollowState.analyser?.disconnect?.(); } catch (error) {}
  try { MicFollowState.stream?.getTracks?.().forEach((track) => track.stop()); } catch (error) {}
  MicFollowState.enabled = false;
  MicFollowState.pending = false;
  MicFollowState.stream = null;
  MicFollowState.source = null;
  MicFollowState.analyser = null;
  MicFollowState.buffer = null;
  resetMicFollowFeatures("off");
  if (options.releaseBias !== false) releaseMicFollowTargetBias(true);
  if (!options.silent) setRecorderStatus("MIC OFF");
  updateMicFollowButton();
  publishMusicRuntimeState();
}

function toggleMicFollow() {
  return MicFollowState.enabled || MicFollowState.pending ? stopMicFollow() : startMicFollow();
}

// fm-70: Drum-floor follows the player. Port of band-room v137 mic follow
// velocity scaler — reads existing MicFollowState (already running its own
// AnalyserNode + RMS) and maps it onto kick/snare/hat velocity.
//   energy ~0.5 (mid)  -> 1.0  (no change)
//   energy = 0         -> 1.0 - 0.3 * amount  (softer)
//   energy = 1         -> 1.0 + 0.3 * amount  (louder)
// band-room uses Tone.Meter (dB normalized to 0..1 via (dB+60)/60).
// engine.js uses rms * 8 (0..1), so the curve is roughly equivalent.
// "amount" defaults to 50% from the FM slider; treat the slider as the
// performer-facing sensitivity knob.
function fmMicFollowVelocityScale() {
  if (!MicFollowState.enabled) return 1.0;
  const f = MicFollowState.features || {};
  const energy = clampValue(Number(f.inputLevel) || 0, 0, 1);
  let amount = 0.5;
  if (typeof document !== "undefined") {
    const el = document.getElementById("fm-mic-follow-amount");
    if (el) amount = clampValue(Number(el.value) / 100, 0, 1);
  }
  // band-room v137 formula. ±30% maximum range at amount=1.
  return clampValue(1.0 + (energy - 0.5) * 0.6 * amount, 0.55, 1.45);
}

// fm-70: dB nudge for sample-based drum layers (jazz/lofi) — Tone.Player
// does not accept per-trigger velocity. ±2.4 dB at amount=1, neutral=0 dB.
function fmMicFollowDbDelta() {
  const scale = fmMicFollowVelocityScale();
  if (scale <= 0) return 0;
  // gain → dB; clamp safety
  return clampValue(20 * Math.log10(scale), -6, 4);
}

function musicSelfReviewRuntimeState() {
  const risk = ProducerHabitState.riskSnapshot || producerHabitRiskSnapshot();
  const habits = ProducerHabitState.habits || {};
  const kits = genreTimbreKitRuntimeState();
  const morph = referenceMorphRuntimeState();
  const meter = selfReviewMeterNormalized();
  const densityRisk = selfReviewNumber(Math.max(risk.density || 0, (MixGovernorState.eventLoad || 0) * 0.82 + meter * 0.08));
  const lowEndRisk = selfReviewNumber(Math.max(risk.low || 0, (MixGovernorState.lowGuard || 0) * 0.72 + kits.pressureKit * 0.12));
  const brightnessRisk = selfReviewNumber(Math.max(risk.bright || 0, morph.chrome * 0.24 + kits.technoKit * 0.18 + (MixGovernorState.clarity || 0) * 0.16));
  const restraintScore = selfReviewNumber(
    (ProducerHabitState.restraintBudget || 0) * 0.32 +
      (habits.beautifulRestraint || 0) * 0.28 +
      (RdjGrowthState.restraint || 0) * 0.2 +
      (ReferenceMorphState.restraint || 0) * 0.2
  );
  const referenceFit = selfReviewNumber(
    (GradientState.haze || 0) * 0.14 +
      (GradientState.memory || 0) * 0.14 +
      (GradientState.micro || 0) * 0.15 +
      (GradientState.ghost || 0) * 0.13 +
      (GradientState.chrome || 0) * 0.11 +
      (GradientState.organic || 0) * 0.13 +
      (RdjGrowthState.wrong || 0) * 0.08 +
      (RdjGrowthState.tender || 0) * 0.06 +
      restraintScore * 0.06
  );

  let nextSuggestion = "listen";
  if (lowEndRisk > 0.72) nextSuggestion = "thin-low-end";
  else if (densityRisk > 0.74) nextSuggestion = "add-space";
  else if (brightnessRisk > 0.76) nextSuggestion = "soften-transients";
  else if (referenceFit < 0.34 && ProducerHabitState.curiosity > 0.34) nextSuggestion = "let-reference-morph-speak";
  else if (restraintScore > 0.72 && densityRisk < 0.46) nextSuggestion = "allow-one-signature";

  return {
    schema: "music.self-listening-review.v1",
    densityRisk,
    lowEndRisk,
    brightnessRisk,
    restraintScore,
    referenceFit,
    meter: selfReviewNumber(meter),
    nextSuggestion,
    referenceAxes: {
      haze: selfReviewNumber(GradientState.haze || 0),
      memory: selfReviewNumber(GradientState.memory || 0),
      micro: selfReviewNumber(GradientState.micro || 0),
      ghost: selfReviewNumber(GradientState.ghost || 0),
      chrome: selfReviewNumber(GradientState.chrome || 0),
      organic: selfReviewNumber(GradientState.organic || 0),
      restraint: selfReviewNumber(restraintScore),
      wrongness: selfReviewNumber(RdjGrowthState.wrong || 0),
      space: selfReviewNumber(kits.spaceKit || 0)
    },
    safety: {
      external_ai: false,
      stores_audio: false,
      metadata_only: true
    },
    governor: selfReviewGovernorRuntimeState()
  };
}

function selfReviewGovernorRuntimeState() {
  return {
    densityBrake: selfReviewNumber(SelfReviewGovernorState.densityBrake),
    lowCleanup: selfReviewNumber(SelfReviewGovernorState.lowCleanup),
    airTail: selfReviewNumber(SelfReviewGovernorState.airTail),
    transientSoftener: selfReviewNumber(SelfReviewGovernorState.transientSoftener),
    lastSuggestion: SelfReviewGovernorState.lastSuggestion
  };
}

function applySelfReviewRestraintGovernor() {
  if (SelfReviewGovernorState.lastCycle === GrooveState.cycle) return SelfReviewGovernorState;
  SelfReviewGovernorState.lastCycle = GrooveState.cycle;

  const review = musicSelfReviewRuntimeState();
  const densityBrakeTarget = clampValue(
    (review.densityRisk - 0.58) * 1.45 + (MixGovernorState.eventLoad - 0.62) * 0.72,
    0,
    1
  );
  const lowCleanupTarget = clampValue(
    (review.lowEndRisk - 0.52) * 1.55 + GenreTimbreKitState.pressureKit * 0.18,
    0,
    1
  );
  const airTailTarget = clampValue(
    (review.densityRisk - 0.48) * 0.56 + GenreTimbreKitState.spaceKit * 0.38 + unitValue(UCM_CUR.void) * 0.28,
    0,
    1
  );
  const transientSoftenerTarget = clampValue(
    (review.brightnessRisk - 0.54) * 1.42 + GenreTimbreKitState.technoKit * 0.16,
    0,
    1
  );

  SelfReviewGovernorState.densityBrake = approachValue(SelfReviewGovernorState.densityBrake, densityBrakeTarget, 0.11);
  SelfReviewGovernorState.lowCleanup = approachValue(SelfReviewGovernorState.lowCleanup, lowCleanupTarget, 0.1);
  SelfReviewGovernorState.airTail = approachValue(SelfReviewGovernorState.airTail, airTailTarget, 0.08);
  SelfReviewGovernorState.transientSoftener = approachValue(SelfReviewGovernorState.transientSoftener, transientSoftenerTarget, 0.1);
  SelfReviewGovernorState.lastSuggestion = review.nextSuggestion;

  DepthState.lowMidClean = clampValue(
    DepthState.lowMidClean + SelfReviewGovernorState.lowCleanup * 0.026 + SelfReviewGovernorState.densityBrake * 0.012,
    0,
    1
  );
  DepthState.tail = clampValue(
    DepthState.tail + SelfReviewGovernorState.airTail * 0.022 + SelfReviewGovernorState.lowCleanup * 0.008,
    0,
    1
  );
  SignatureCellState.silenceDebt = clampValue(
    SignatureCellState.silenceDebt + SelfReviewGovernorState.densityBrake * 0.035 + SelfReviewGovernorState.transientSoftener * 0.018,
    0,
    1
  );
  GenreTimbreKitState.spaceKit = approachValue(
    GenreTimbreKitState.spaceKit,
    clampValue(GenreTimbreKitState.spaceKit + SelfReviewGovernorState.airTail * 0.04 + SelfReviewGovernorState.lowCleanup * 0.026, 0, 1),
    0.045
  );
  GenreTimbreKitState.pressureKit = approachValue(
    GenreTimbreKitState.pressureKit,
    clampValue(GenreTimbreKitState.pressureKit - SelfReviewGovernorState.lowCleanup * 0.035, 0, 1),
    0.04
  );
  return SelfReviewGovernorState;
}

// music-stack routing cluster extracted to audio/music-stack-routing.js (BL-008)
const MUSIC_STACK_ROUTE_LABELS = window.MusicStackRoutes.ROUTE_LABELS;
const MUSIC_STACK_ROUTE_URLS = window.MusicStackRoutes.ROUTE_URLS;
const hazamaFmReviewCue = window.MusicStackRoutes.reviewCue;

function musicStackRoutingRecommendation(input = {}) {
  const review = input.selfReview || musicSelfReviewRuntimeState();
  const parts = input.parts || currentGradientParts();
  const gradient = input.gradient || {
    haze: packetUnit(GradientState.haze),
    memory: packetUnit(GradientState.memory),
    micro: packetUnit(GradientState.micro),
    ghost: packetUnit(GradientState.ghost),
    chrome: packetUnit(GradientState.chrome),
    organic: packetUnit(GradientState.organic)
  };
  const kits = input.kits || genreTimbreKitRuntimeState();
  const activePads = input.activePads || activePerformancePadNames();
  const fmCue = input.hazamaFmReviewCue || hazamaFmReviewCue(input.hazamaFm);
  return window.MusicStackRoutes.routingRecommendation({
    ...input,
    selfReview: review,
    parts,
    gradient,
    kits,
    activePads,
    hazamaFmReviewCue: fmCue,
    producerHabitCuriosity: input.producerHabitCuriosity ?? (ProducerHabitState.curiosity || 0)
  });
}

function advanceReferenceMorph(context = {}) {
  if (ReferenceMorphState.lastCycle === GrooveState.cycle) return;
  ReferenceMorphState.lastCycle = GrooveState.cycle;

  const sourceKey = effectiveVoiceSourceKey();
  const atmosphereKey = effectiveVoiceAtmosphereKey();
  const gradient = GradientState;
  const depth = DepthState;
  const genre = GenreBlendState;
  const creation = clampValue(context.creationNorm ?? unitValue(UCM_CUR.creation), 0, 1);
  const resource = clampValue(context.resourceNorm ?? unitValue(UCM_CUR.resource), 0, 1);
  const wave = clampValue(context.waveNorm ?? unitValue(UCM_CUR.wave), 0, 1);
  const voidness = clampValue(context.voidNorm ?? unitValue(UCM_CUR.void), 0, 1);
  const observer = clampValue(context.observerNorm ?? unitValue(UCM_CUR.observer), 0, 1);
  const body = unitValue(UCM_CUR.body);
  const acid = acidPerformanceAmount();
  const chaos = organicChaosAmount();
  const rdjSource = sourceKey === "autechre" || sourceKey === "fsol" || sourceKey === "boc" ? 0.08 : 0;

  ReferenceMorphState.phase = fractionalPart((GrooveState.cycle + GenomeState.generation + 1) * GOLDEN_RATIO_INVERSE);
  ReferenceMorphState.haze = approachValue(ReferenceMorphState.haze, clampValue(gradient.haze * 0.34 + genre.ambient * 0.2 + observer * 0.13 + (1 - resource) * 0.08 + (atmosphereKey === "haze" ? 0.12 : 0), 0, 1), 0.045);
  ReferenceMorphState.broken = approachValue(ReferenceMorphState.broken, clampValue(gradient.micro * 0.28 + genre.idm * 0.18 + creation * 0.14 + resource * 0.1 + chaos * 0.08 + (sourceKey === "autechre" ? 0.16 : 0), 0, 1), 0.05);
  ReferenceMorphState.pulse = approachValue(ReferenceMorphState.pulse, clampValue(gradient.ghost * 0.2 + genre.techno * 0.14 + genre.pressure * 0.12 + body * 0.12 + acid * 0.12 + (sourceKey === "burial" ? 0.12 : 0), 0, 1), 0.045);
  ReferenceMorphState.void = approachValue(ReferenceMorphState.void, clampValue(voidness * 0.28 + depth.tail * 0.18 + genre.ambient * 0.1 + (atmosphereKey === "void" ? 0.18 : 0) + PerformancePadState.void * 0.16, 0, 1), 0.04);
  ReferenceMorphState.chrome = approachValue(ReferenceMorphState.chrome, clampValue(gradient.chrome * 0.32 + observer * 0.16 + depth.tail * 0.08 + (sourceKey === "opn" || sourceKey === "xtal" ? 0.13 : 0), 0, 1), 0.045);
  ReferenceMorphState.organic = approachValue(ReferenceMorphState.organic, clampValue(gradient.organic * 0.24 + gradient.memory * 0.12 + wave * 0.14 + genre.idm * 0.08 + (sourceKey === "fsol" || sourceKey === "boc" ? 0.14 : 0), 0, 1), 0.045);
  ReferenceMorphState.rdj = approachValue(ReferenceMorphState.rdj, clampValue(0.12 + ReferenceMorphState.broken * 0.26 + ReferenceMorphState.organic * 0.12 + acid * 0.08 + OddLogicDirectorState.intensity * 0.12 + rdjSource, 0, 1), 0.04);
  ReferenceMorphState.restraint = approachValue(ReferenceMorphState.restraint, clampValue(0.2 + observer * 0.2 + ReferenceMorphState.haze * 0.16 + ReferenceMorphState.void * 0.12 + MixGovernorState.eventLoad * 0.12 - ReferenceMorphState.broken * 0.08, 0, 1), 0.035);
  ReferenceMorphState.style = dominantReferenceMorphStyle();
}

function advanceRdjGrowth(context = {}) {
  if (RdjGrowthState.lastCycle === GrooveState.cycle) return;
  RdjGrowthState.lastCycle = GrooveState.cycle;
  if (GrooveState.cycle % 11 === 0) RdjGrowthState.generation += 1;

  const creation = clampValue(context.creationNorm ?? unitValue(UCM_CUR.creation), 0, 1);
  const resource = clampValue(context.resourceNorm ?? unitValue(UCM_CUR.resource), 0, 1);
  const wave = clampValue(context.waveNorm ?? unitValue(UCM_CUR.wave), 0, 1);
  const observer = clampValue(context.observerNorm ?? unitValue(UCM_CUR.observer), 0, 1);
  const circle = clampValue(context.circleNorm ?? unitValue(UCM_CUR.circle), 0, 1);
  const voidness = clampValue(context.voidNorm ?? unitValue(UCM_CUR.void), 0, 1);
  const acid = acidPerformanceAmount();
  const morph = ReferenceMorphState;

  RdjGrowthState.phase = fractionalPart((GrooveState.cycle + RdjGrowthState.generation + 1) * GOLDEN_RATIO_INVERSE);
  RdjGrowthState.toy = approachValue(RdjGrowthState.toy, clampValue(0.08 + morph.organic * 0.18 + morph.chrome * 0.08 + MotifMemoryState.strength * 0.16 + circle * 0.08 + BpmCrossfadeState.refrain * 0.08, 0, 1), 0.04);
  RdjGrowthState.rubber = approachValue(RdjGrowthState.rubber, clampValue(0.06 + acid * 0.22 + wave * 0.14 + morph.pulse * 0.1 + PerformancePadState.repeat * 0.08 + PerformancePadState.punch * 0.05, 0, 1), 0.045);
  RdjGrowthState.wrong = approachValue(RdjGrowthState.wrong, clampValue(0.1 + morph.broken * 0.2 + OddLogicDirectorState.intensity * 0.18 + creation * 0.12 + resource * 0.08 + organicChaosAmount() * 0.08, 0, 1), 0.045);
  RdjGrowthState.tender = approachValue(RdjGrowthState.tender, clampValue(0.12 + morph.haze * 0.16 + morph.void * 0.12 + observer * 0.12 + circle * 0.1 + GenomeState.genes.refrain * 0.08, 0, 1), 0.04);
  RdjGrowthState.edit = approachValue(RdjGrowthState.edit, clampValue(0.1 + morph.broken * 0.18 + (GradientState.micro || 0) * 0.16 + PerformancePadState.repeat * 0.09 + SignatureCellState.brokenTextureIntensity * 0.08, 0, 1), 0.05);
  RdjGrowthState.restraint = approachValue(RdjGrowthState.restraint, clampValue(0.22 + morph.restraint * 0.22 + observer * 0.12 + circle * 0.1 + voidness * 0.08 + MixGovernorState.eventLoad * 0.12 - RdjGrowthState.wrong * 0.06, 0, 1), 0.035);
}

function chooseProducerHabitMode() {
  const risk = ProducerHabitState.riskSnapshot || producerHabitRiskSnapshot();
  if (ProducerHabitState.risk > 0.78 || ProducerHabitState.restraintBudget > 0.84 || (risk.density || 0) > 0.82) return "listen";
  const phi = fractionalPart((GrooveState.cycle + ProducerHabitState.generation + 1) * GOLDEN_RATIO_INVERSE);
  const habits = ProducerHabitState.habits;
  const weighted = [
    ["softWrongMemory", habits.tenderMemory + RdjGrowthState.toy * 0.1 + RdjGrowthState.tender * 0.08 - (risk.hook || 0) * 0.2],
    ["dryGridScar", habits.dryGrid + GenreTimbreKitState.technoKit * 0.06 + ReferenceMorphState.broken * 0.08 - (risk.bright || 0) * 0.2],
    ["ghostPressureBreath", habits.ghostPressure + ReferenceMorphState.pulse * 0.08 + GenreTimbreKitState.pressureKit * 0.08 - (risk.low || 0) * 0.24],
    ["transparentVoidTail", habits.transparentVoid + ReferenceMorphState.void * 0.08 + GenreTimbreKitState.spaceKit * 0.08],
    ["rubberMicroEdit", habits.rubberEdit + RdjGrowthState.rubber * 0.12 + RdjGrowthState.edit * 0.08 - (risk.bright || 0) * 0.08],
    ["listen", habits.beautifulRestraint + ProducerHabitState.restraintBudget * 0.18 + ProducerHabitState.risk * 0.2]
  ];
  weighted.sort((a, b) => b[1] - a[1]);
  if ((weighted[0]?.[1] || 0) < 0.22) return "listen";
  const picked = phi < 0.58
    ? weighted[0][0]
    : phi < 0.84
      ? weighted[1][0]
      : weighted[Math.min(weighted.length - 1, Math.floor(phi * weighted.length))]?.[0];
  return PRODUCER_HABIT_MODES.includes(picked) ? picked : "listen";
}

function advanceProducerHabits(context = {}) {
  if (ProducerHabitState.lastCycle === GrooveState.cycle) return;
  ProducerHabitState.lastCycle = GrooveState.cycle;
  if (GrooveState.cycle % 13 === 0) ProducerHabitState.generation += 1;

  const creation = clampValue(context.creationNorm ?? unitValue(UCM_CUR.creation), 0, 1);
  const resource = clampValue(context.resourceNorm ?? unitValue(UCM_CUR.resource), 0, 1);
  const wave = clampValue(context.waveNorm ?? unitValue(UCM_CUR.wave), 0, 1);
  const observer = clampValue(context.observerNorm ?? unitValue(UCM_CUR.observer), 0, 1);
  const circle = clampValue(context.circleNorm ?? unitValue(UCM_CUR.circle), 0, 1);
  const voidness = clampValue(context.voidNorm ?? unitValue(UCM_CUR.void), 0, 1);
  const body = unitValue(UCM_CUR.body);
  const human = humanGrooveStateForProducerHabits() || {};
  const risk = producerHabitRiskSnapshot();
  const habits = ProducerHabitState.habits;

  ProducerHabitState.riskSnapshot = risk;
  ProducerHabitState.risk = approachValue(ProducerHabitState.risk, risk.overall, 0.12);
  ProducerHabitState.phase = fractionalPart((GrooveState.cycle + ProducerHabitState.generation + 3) * GOLDEN_RATIO_INVERSE);
  ProducerHabitState.restraintBudget = approachValue(
    ProducerHabitState.restraintBudget,
    clampValue(
      0.22 +
        ReferenceMorphState.restraint * 0.22 +
        RdjGrowthState.restraint * 0.24 +
        risk.overall * 0.28 +
        (SignatureCellState.silenceDebt || 0) * 0.16 +
        observer * 0.08 +
        circle * 0.05 -
        ReferenceMorphState.broken * 0.04,
      0.18,
      0.96
    ),
    0.055
  );
  ProducerHabitState.curiosity = approachValue(
    ProducerHabitState.curiosity,
    clampValue(
      0.1 +
        ReferenceMorphState.broken * 0.18 +
        ReferenceMorphState.organic * 0.13 +
        GenreTimbreKitState.idmKit * 0.12 +
        wave * 0.08 +
        creation * 0.07 -
        ProducerHabitState.risk * 0.18 -
        ProducerHabitState.restraintBudget * 0.08,
      0.04,
      0.72
    ),
    0.06
  );

  habits.tenderMemory = approachValue(
    habits.tenderMemory,
    clampValue(
      ReferenceMorphState.organic * 0.18 +
        ReferenceMorphState.haze * 0.12 +
        RdjGrowthState.toy * 0.18 +
        RdjGrowthState.tender * 0.18 +
        MotifMemoryState.strength * 0.12 +
        circle * 0.08 -
        risk.hook * 0.16,
      0,
      1
    ),
    0.052
  );
  habits.dryGrid = approachValue(
    habits.dryGrid,
    clampValue(
      GenreTimbreKitState.technoKit * 0.22 +
        GenreTimbreKitState.idmKit * 0.12 +
        ReferenceMorphState.broken * 0.14 +
        ReferenceMorphState.pulse * 0.1 +
        RdjGrowthState.edit * 0.12 +
        resource * 0.08 -
        risk.bright * 0.2 -
        voidness * 0.08,
      0,
      1
    ),
    0.058
  );
  habits.ghostPressure = approachValue(
    habits.ghostPressure,
    clampValue(
      GenreTimbreKitState.pressureKit * 0.22 +
        ReferenceMorphState.pulse * 0.14 +
        body * 0.12 +
        (PerformancePadState.punch || 0) * 0.12 +
        (GradientState.ghost || 0) * 0.08 -
        risk.low * 0.22 -
        voidness * 0.08,
      0,
      1
    ),
    0.055
  );
  habits.transparentVoid = approachValue(
    habits.transparentVoid,
    clampValue(
      GenreTimbreKitState.spaceKit * 0.24 +
        ReferenceMorphState.void * 0.18 +
        ReferenceMorphState.chrome * 0.1 +
        (DepthState.tail || 0) * 0.14 +
        (DepthState.lowMidClean || 0) * 0.1 +
        observer * 0.1 +
        voidness * 0.1,
      0,
      1
    ),
    0.045
  );
  habits.rubberEdit = approachValue(
    habits.rubberEdit,
    clampValue(
      RdjGrowthState.rubber * 0.2 +
        RdjGrowthState.edit * 0.16 +
        RdjGrowthState.wrong * 0.1 +
        ReferenceMorphState.broken * 0.12 +
        wave * 0.08 +
        (human.syncopation || 0) * 0.08 -
        risk.density * 0.16,
      0,
      1
    ),
    0.058
  );
  habits.beautifulRestraint = approachValue(
    habits.beautifulRestraint,
    clampValue(
      ReferenceMorphState.restraint * 0.26 +
        RdjGrowthState.restraint * 0.3 +
        observer * 0.12 +
        circle * 0.1 +
        risk.overall * 0.2 +
        (human.repair || 0) * 0.08 +
        (SignatureCellState.silenceDebt || 0) * 0.12 -
        ProducerHabitState.curiosity * 0.06,
      0,
      1
    ),
    0.055
  );

  const previousMode = ProducerHabitState.mode;
  ProducerHabitState.mode = chooseProducerHabitMode();
  if (ProducerHabitState.mode !== previousMode) {
    ProducerHabitState.lastMutation = ProducerHabitState.mode;
  }
}

function chooseSignatureConductorMode(offset = 0) {
  if (SignatureCellState.silenceDebt > 0.7 || MixGovernorState.eventLoad > 0.82) return "listen";
  const phi = fractionalPart((GrooveState.cycle + SignatureCellState.conductorPhrase + RdjGrowthState.generation + offset + 1) * GOLDEN_RATIO_INVERSE);
  const weighted = [
    ["breathe", ReferenceMorphState.haze + ReferenceMorphState.void + SignatureCellState.lowBreathIntensity],
    ["scratch", ReferenceMorphState.broken + RdjGrowthState.edit + SignatureCellState.brokenTextureIntensity],
    ["remember", ReferenceMorphState.organic + RdjGrowthState.toy + RdjGrowthState.tender + MotifMemoryState.strength],
    ["open", ReferenceMorphState.chrome + ReferenceMorphState.void + RdjGrowthState.tender],
    ["listen", RdjGrowthState.restraint + SignatureCellState.silenceDebt]
  ];
  weighted.sort((a, b) => b[1] - a[1]);
  if (phi < 0.56) return weighted[0][0];
  if (phi < 0.84) return weighted[1][0];
  const fallback = SIGNATURE_CONDUCTOR_MODES[Math.min(SIGNATURE_CONDUCTOR_MODES.length - 1, Math.floor(phi * SIGNATURE_CONDUCTOR_MODES.length))] || "listen";
  return weighted[Math.min(weighted.length - 1, Math.floor(phi * weighted.length))]?.[0] || fallback;
}

function signatureConductorAllows(flavor) {
  if (SignatureCellState.silenceDebt > 0.88 || SignatureCellState.conductorMode === "listen") return false;
  if (SignatureCellState.conductorMode === "breathe") return flavor === "lowBreath" || flavor === "ghostGlass";
  if (SignatureCellState.conductorMode === "scratch") return flavor === "brokenTexture" || flavor === "ghostGlass";
  if (SignatureCellState.conductorMode === "remember") return flavor === "memoryPluck" || flavor === "ghostGlass";
  if (SignatureCellState.conductorMode === "open") return flavor === "ghostGlass" || flavor === "lowBreath" || flavor === "brokenTexture" || flavor === "memoryPluck";
  return false;
}

function signatureConductorChanceScale(flavor) {
  if (!signatureConductorAllows(flavor)) return 0;
  if (!producerHabitAllows(flavor)) return 0;
  const mode = SignatureCellState.conductorMode;
  let scale = 0.78 + (1 - SignatureCellState.silenceDebt) * 0.22;
  if ((mode === "breathe" && flavor === "lowBreath") || (mode === "scratch" && flavor === "brokenTexture") || (mode === "remember" && flavor === "memoryPluck")) scale += 0.28;
  if (mode === "open" && flavor === "ghostGlass") scale += 0.18;
  scale += producerHabitBias(flavor) * 0.22;
  scale -= producerHabitBias("restraint") * 0.06;
  return clampValue(scale - RdjGrowthState.restraint * 0.12, 0, 1.35);
}

function advanceSignatureCells(context = {}) {
  SignatureCellState.phrase += 1;
  SignatureCellState.conductorPhrase += 1;
  const collapse = signatureCellCollapseAmount(context);

  if (SignatureCellState.phrase >= SignatureCellState.phraseCycles) {
    SignatureCellState.motif = SignatureCellState.nextMotif;
    SignatureCellState.nextMotif = chooseSignatureCellMotif(2, collapse);
    SignatureCellState.phrase = 0;
    SignatureCellState.phraseCycles = signatureCellPhraseCycles(3);
  }

  if (SignatureCellState.conductorPhrase >= SignatureCellState.conductorPhraseCycles) {
    SignatureCellState.conductorMode = SignatureCellState.nextConductorMode;
    SignatureCellState.nextConductorMode = chooseSignatureConductorMode(5);
    SignatureCellState.conductorPhrase = 0;
    SignatureCellState.conductorPhraseCycles = Math.round(3 + fractionalPart((GrooveState.cycle + RdjGrowthState.generation + 2) * GOLDEN_RATIO_INVERSE) * 5);
  }

  const progress = SignatureCellState.phrase / Math.max(1, SignatureCellState.phraseCycles);
  SignatureCellState.blend = smoothStep01(progress);
  SignatureCellState.intensity = approachValue(
    SignatureCellState.intensity,
    clampValue(
      0.18 +
        collapse * 0.22 +
        (GradientState.chrome || 0) * 0.16 +
        (DepthState.tail || 0) * 0.12 +
        (GenreBlendState.idm || 0) * 0.1 +
        RdjGrowthState.tender * 0.06 +
        producerHabitBias("ghostGlass") * 0.05 +
        (context.voidNorm || 0) * 0.07 +
        PerformancePadState.drift * 0.1 +
        PerformancePadState.repeat * 0.07 -
        producerHabitBias("restraint") * 0.016 -
        RdjGrowthState.restraint * 0.04 -
        (MixGovernorState.eventLoad || 0) * 0.12,
      0,
      1
    ),
    0.055
  );

  SignatureCellState.lowBreathIntensity = approachValue(
    SignatureCellState.lowBreathIntensity,
    clampValue(
      0.14 +
        (DepthState.bed || 0) * 0.18 +
        (DepthState.tail || 0) * 0.08 +
        (GradientState.ghost || 0) * 0.13 +
        (TimbreFamilyState.sub808 || 0) * 0.12 +
        (TimbreFamilyState.reedBuzz || 0) * 0.12 +
        (GenreBlendState.ambient || 0) * 0.08 +
        RdjGrowthState.rubber * 0.05 +
        producerHabitBias("lowBreath") * 0.04 +
        producerHabitBias("ghostPressure") * 0.024 +
        (context.voidNorm || 0) * 0.08 -
        producerHabitBias("restraint") * 0.018 -
        RdjGrowthState.restraint * 0.05 -
        (MixGovernorState.lowGuard || 0) * 0.18 -
        (MixGovernorState.eventLoad || 0) * 0.1,
      0,
      1
    ),
    0.045
  );

  SignatureCellState.brokenTextureIntensity = approachValue(
    SignatureCellState.brokenTextureIntensity,
    clampValue(
      0.12 +
        collapse * 0.18 +
        (GradientState.micro || 0) * 0.18 +
        (GradientState.ghost || 0) * 0.08 +
        (TimbreFamilyState.drumSkin || 0) * 0.13 +
        (TimbreFamilyState.chain || 0) * 0.06 +
        (GenreBlendState.idm || 0) * 0.1 +
        PerformancePadState.repeat * 0.08 +
        PerformancePadState.drift * 0.04 +
        RdjGrowthState.edit * 0.02 +
        RdjGrowthState.wrong * 0.06 +
        producerHabitBias("brokenTexture") * 0.05 +
        producerHabitBias("rubberEdit") * 0.034 -
        (context.voidNorm || 0) * 0.06 -
        producerHabitBias("restraint") * 0.02 -
        RdjGrowthState.restraint * 0.05 -
        (MixGovernorState.eventLoad || 0) * 0.1,
      0,
      1
    ),
    0.05
  );

  SignatureCellState.memoryPluckIntensity = approachValue(
    SignatureCellState.memoryPluckIntensity,
    clampValue(
      0.1 +
        (GradientState.memory || 0) * 0.2 +
        (GradientState.organic || 0) * 0.12 +
        (TimbreFamilyState.pianoMemory || 0) * 0.16 +
        MotifMemoryState.strength * 0.14 +
        ReferenceMorphState.organic * 0.08 +
        RdjGrowthState.toy * 0.1 +
        RdjGrowthState.tender * 0.08 +
        producerHabitBias("memoryPluck") * 0.058 -
        producerHabitBias("restraint") * 0.018 -
        RdjGrowthState.restraint * 0.05 -
        (MixGovernorState.eventLoad || 0) * 0.1,
      0,
      1
    ),
    0.045
  );
}

function signatureCellsRuntimeState() {
  const stepsSince = stepIndex - SignatureCellState.lastStep;
  const lowStepsSince = stepIndex - SignatureCellState.lowBreathLastStep;
  const textureStepsSince = stepIndex - SignatureCellState.brokenTextureLastStep;
  const memoryStepsSince = stepIndex - SignatureCellState.memoryPluckLastStep;
  const ghostActive = SignatureCellState.lastStep >= 0 && stepsSince >= 0 && stepsSince <= Math.max(2, SignatureCellState.cooldownSteps + 1);
  const lowBreathActive = SignatureCellState.lowBreathLastStep >= 0 && lowStepsSince >= 0 && lowStepsSince <= Math.max(2, SignatureCellState.lowBreathCooldownSteps + 1);
  const brokenTextureActive = SignatureCellState.brokenTextureLastStep >= 0 && textureStepsSince >= 0 && textureStepsSince <= Math.max(2, SignatureCellState.brokenTextureCooldownSteps + 1);
  const memoryPluckActive = SignatureCellState.memoryPluckLastStep >= 0 && memoryStepsSince >= 0 && memoryStepsSince <= Math.max(2, SignatureCellState.memoryPluckCooldownSteps + 1);
  const flavor = SignatureCellState.lastFlavor || "ghostGlass";
  const currentFlavorState = flavor === "lowBreath"
    ? { intensity: SignatureCellState.lowBreathIntensity, cooldownSteps: SignatureCellState.lowBreathCooldownSteps, lastStep: SignatureCellState.lowBreathLastStep }
    : flavor === "brokenTexture"
      ? { intensity: SignatureCellState.brokenTextureIntensity, cooldownSteps: SignatureCellState.brokenTextureCooldownSteps, lastStep: SignatureCellState.brokenTextureLastStep }
      : flavor === "memoryPluck"
        ? { intensity: SignatureCellState.memoryPluckIntensity, cooldownSteps: SignatureCellState.memoryPluckCooldownSteps, lastStep: SignatureCellState.memoryPluckLastStep }
      : { intensity: SignatureCellState.intensity, cooldownSteps: SignatureCellState.cooldownSteps, lastStep: SignatureCellState.lastStep };
  return {
    active: ghostActive || lowBreathActive || brokenTextureActive || memoryPluckActive,
    flavor,
    phrase: SignatureCellState.phrase,
    motif: SignatureCellState.motif,
    intensity: currentFlavorState.intensity,
    cooldownSteps: currentFlavorState.cooldownSteps,
    lastStep: currentFlavorState.lastStep,
    globalCooldownSteps: SignatureCellState.globalCooldownSteps,
    conductor: {
      mode: SignatureCellState.conductorMode,
      nextMode: SignatureCellState.nextConductorMode,
      phrase: SignatureCellState.conductorPhrase,
      phraseCycles: SignatureCellState.conductorPhraseCycles,
      silenceDebt: SignatureCellState.silenceDebt
    },
    flavors: {
      ghostGlass: {
        active: ghostActive,
        motif: SignatureCellState.motif,
        intensity: SignatureCellState.intensity,
        cooldownSteps: SignatureCellState.cooldownSteps,
        lastStep: SignatureCellState.lastStep
      },
      lowBreath: {
        active: lowBreathActive,
        intensity: SignatureCellState.lowBreathIntensity,
        cooldownSteps: SignatureCellState.lowBreathCooldownSteps,
        lastStep: SignatureCellState.lowBreathLastStep
      },
      brokenTexture: {
        active: brokenTextureActive,
        intensity: SignatureCellState.brokenTextureIntensity,
        cooldownSteps: SignatureCellState.brokenTextureCooldownSteps,
        lastStep: SignatureCellState.brokenTextureLastStep
      },
      memoryPluck: {
        active: memoryPluckActive,
        intensity: SignatureCellState.memoryPluckIntensity,
        cooldownSteps: SignatureCellState.memoryPluckCooldownSteps,
        lastStep: SignatureCellState.memoryPluckLastStep
      }
    }
  };
}

function advanceVoiceEmergencePhrase() {
  if (VoiceEmergenceState.lastCycle === GrooveState.cycle) return;
  VoiceEmergenceState.lastCycle = GrooveState.cycle;

  VoiceEmergenceState.phrase += 1;
  if (VoiceEmergenceState.phrase >= VoiceEmergenceState.phraseCycles) {
    VoiceEmergenceState.focus = VoiceEmergenceState.nextFocus;
    VoiceEmergenceState.nextFocus = chooseVoiceEmergenceFocus(VoiceEmergenceState.phrase + 2);
    VoiceEmergenceState.phrase = 0;
    VoiceEmergenceState.phraseCycles = voiceEmergenceSegmentCycles(3);
    VoiceMorphState.transition = Math.max(VoiceMorphState.transition, 0.42);
  }

  const progress = VoiceEmergenceState.phrase / Math.max(1, VoiceEmergenceState.phraseCycles);
  const energy = clampValue(UCM_CUR.energy / 100, 0, 1);
  const observer = clampValue(UCM_CUR.observer / 100, 0, 1);
  const creation = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resource = clampValue(UCM_CUR.resource / 100, 0, 1);
  const voidness = clampValue(UCM_CUR.void / 100, 0, 1);
  const circle = clampValue(UCM_CUR.circle / 100, 0, 1);
  const color = PerformanceColorDriftState;
  const pulse = (Math.sin((GrooveState.cycle + 1) * 0.19 + AutoVoiceMorphState.generation * 0.31) + 1) / 2;

  VoiceEmergenceState.blend = smoothStep01(progress);
  VoiceEmergenceState.phase = fractionalPart((GrooveState.cycle + 1) * GOLDEN_RATIO_INVERSE + AutoVoiceMorphState.generation * 0.0618);
  VoiceEmergenceState.bloom = approachValue(
    VoiceEmergenceState.bloom,
    clampValue(0.22 + color.haze * 0.22 + color.chrome * 0.16 + observer * 0.12 + voidness * 0.1 + pulse * 0.1 - energy * 0.05, 0, 1),
    0.045
  );
  VoiceEmergenceState.splice = approachValue(
    VoiceEmergenceState.splice,
    clampValue(0.12 + color.dust * 0.18 + color.acid * 0.22 + creation * 0.16 + resource * 0.12 + GenreBlendState.idm * 0.1 + GenreBlendState.techno * 0.08, 0, 1),
    0.045
  );
  VoiceEmergenceState.shimmer = approachValue(
    VoiceEmergenceState.shimmer,
    clampValue(0.14 + color.chrome * 0.24 + observer * 0.18 + circle * 0.1 + GenomeState.genes.chrome * 0.08 + pulse * 0.08, 0, 1),
    0.04
  );
  VoiceEmergenceState.refrain = approachValue(
    VoiceEmergenceState.refrain,
    clampValue(0.16 + GenomeState.genes.refrain * 0.18 + circle * 0.14 + VoiceMorphState.transition * 0.08 + BpmCrossfadeState.refrain * 0.14, 0, 1),
    0.035
  );
}

function advanceAutoVoiceMorphPhrase() {
  if (AutoVoiceMorphState.lastCycle === GrooveState.cycle) return;
  AutoVoiceMorphState.lastCycle = GrooveState.cycle;

  AutoVoiceMorphState.sourceAge += 1;
  AutoVoiceMorphState.atmosphereAge += 1;
  let sourceTurned = false;
  let atmosphereTurned = false;

  if (AutoVoiceMorphState.sourceAge >= AutoVoiceMorphState.sourceSegmentCycles) {
    AutoVoiceMorphState.sourceIndex = AutoVoiceMorphState.sourceNextIndex;
    AutoVoiceMorphState.sourceNextIndex = (AutoVoiceMorphState.sourceNextIndex + 1) % AUTO_SOURCE_MORPH_KEYS.length;
    AutoVoiceMorphState.sourceAge = 0;
    AutoVoiceMorphState.sourceSegmentCycles = autoVoiceSegmentCycles(42, 34, 0);
    AutoVoiceMorphState.generation += 1;
    VoiceMorphState.transition = 1;
    sourceTurned = true;
  }

  if (AutoVoiceMorphState.atmosphereAge >= AutoVoiceMorphState.atmosphereSegmentCycles) {
    AutoVoiceMorphState.atmosphereIndex = AutoVoiceMorphState.atmosphereNextIndex;
    AutoVoiceMorphState.atmosphereNextIndex = (AutoVoiceMorphState.atmosphereNextIndex + 1) % AUTO_ATMOSPHERE_MORPH_KEYS.length;
    AutoVoiceMorphState.atmosphereAge = 0;
    AutoVoiceMorphState.atmosphereSegmentCycles = autoVoiceSegmentCycles(30, 24, 2);
    AutoVoiceMorphState.generation += 1;
    VoiceMorphState.transition = 1;
    atmosphereTurned = true;
  }

  AutoVoiceMorphState.sourceBlend = smoothStep01(AutoVoiceMorphState.sourceAge / Math.max(1, AutoVoiceMorphState.sourceSegmentCycles));
  AutoVoiceMorphState.atmosphereBlend = smoothStep01(AutoVoiceMorphState.atmosphereAge / Math.max(1, AutoVoiceMorphState.atmosphereSegmentCycles));

  if (isPlaying && ((sourceTurned && autoVoiceSourceActive()) || (atmosphereTurned && autoVoiceAtmosphereActive()))) {
    triggerVoiceColorCue();
  }

  if ((autoVoiceSourceActive() || autoVoiceAtmosphereActive()) && GrooveState.cycle % 4 === 0) {
    updateVoiceColorUi();
  }
}

function publishMusicRuntimeState() {
  if (typeof window === "undefined") return;

  const autoLabels = autoVoiceMorphLabel();
  const state = {
    version: 1,
    playing: isPlaying,
    initialized,
    cycle: GrooveState.cycle,
    step: stepIndex,
    bpm: EngineParams.bpm,
    mode: EngineParams.mode,
    world: {
      key: WorldState.key,
      label: WorldState.label,
      spectrum: WorldState.spectrum,
      micro: WorldState.micro
    },
    voice: {
      atmosphere: VoiceColorState.atmosphere,
      source: VoiceColorState.source,
      effectiveAtmosphere: effectiveVoiceAtmosphereKey(),
      effectiveSource: effectiveVoiceSourceKey(),
      autoAtmosphere: activeAutoAtmosphereKey(),
      autoAtmosphereNext: nextAutoAtmosphereKey(),
      autoAtmosphereBlend: AutoVoiceMorphState.atmosphereBlend,
      autoSource: activeAutoSourceKey(),
      autoSourceNext: nextAutoSourceKey(),
      autoSourceBlend: AutoVoiceMorphState.sourceBlend,
      atmosphereLabel: autoLabels.atmosphereLabel,
      sourceLabel: autoLabels.sourceLabel,
      autoActive: autoVoiceAtmosphereActive() || autoVoiceSourceActive(),
      emergence: { ...VoiceEmergenceState }
    },
    culture: {
      selected: CultureGrammarState.selected,
      active: CultureGrammarState.active,
      label: CultureGrammarState.label,
      strength: CultureGrammarState.strength
    },
    proposal: {
      mode: OddLogicDirectorState.mode,
      active: OddLogicDirectorState.active,
      label: OddLogicDirectorState.label,
      want: OddLogicDirectorState.want,
      move: OddLogicDirectorState.move,
      intensity: OddLogicDirectorState.intensity,
      vector: { ...OddLogicDirectorState.vector }
    },
    acid: {
      enabled: AcidLockState.enabled,
      intensity: AcidLockState.intensity,
      indicator: AcidLockState.indicator || 0,
      transient: AcidLockState.transient || 0,
      transientSource: AcidLockState.transientSource || "",
      performance: acidPerformanceAmount(),
      arcDrive: albumArcAcidDrive(),
      color: { ...PerformanceColorDriftState }
    },
    gradient: { ...GradientState },
    depth: { ...DepthState },
    genre: { ...GenreBlendState },
    genreTimbreKits: genreTimbreKitRuntimeState(),
    timbrePalettes: modeTimbrePalettesRuntimeState(),
    melodicDirector: melodicDirectorRuntimeState(),
    basslineDirector: basslineDirectorRuntimeState(),
    radioBrain: musicRadioBrainRuntimeState(),
    referenceMorph: referenceMorphRuntimeState(),
    rdjGrowth: rdjGrowthRuntimeState(),
    producerHabits: producerHabitsRuntimeState(),
    selfReview: musicSelfReviewRuntimeState(),
    micFollow: micFollowRuntimeState(),
    micJam: micJamRuntimeState(),
    stackRouting: musicStackRoutingRecommendation(),
    humanGroove: typeof window.HumanGrooveGovernor?.getState === "function"
      ? window.HumanGrooveGovernor.getState()
      : (typeof window.HumanGrooveGovernor?.state === "object" ? { ...window.HumanGrooveGovernor.state } : null),
    signatureCells: signatureCellsRuntimeState(),
    autoFollow: hazamaAutoFollowActive(),
    albumArc: {
      mode: AlbumArcState.mode,
      active: albumArcActive(),
      elapsedMs: AlbumArcState.elapsedMs,
      chapter: currentAlbumArcChapter()?.name || "",
      label: currentAlbumArcChapter()?.label || "",
      progress: AlbumArcState.progress,
      blend: AlbumArcState.blend,
      acidDrive: AlbumArcState.acidDrive
    },
    genome: {
      generation: GenomeState.generation,
      phase: GenomeState.phase,
      growth: GenomeState.growth,
      mutation: GenomeState.mutation,
      genes: { ...GenomeState.genes }
    },
    hazama: {
      active: HazamaBridgeState.active,
      loaded: HazamaBridgeState.loaded,
      connectionState: hazamaConnectionState(),
      source: HazamaBridgeState.source,
      name: HazamaBridgeState.name,
      style: HazamaBridgeState.style,
      pending: HazamaBridgeState.pending,
      autoFollow: HazamaBridgeState.autoFollow,
      controlAction: HazamaBridgeState.controlAction,
      controlPending: HazamaBridgeState.controlPending,
      stage: HazamaBridgeState.stage,
      depthId: HazamaBridgeState.depthId,
      stability: HazamaBridgeState.stability,
      resonance: HazamaBridgeState.resonance,
      marks: HazamaBridgeState.marks,
      importedAt: HazamaBridgeState.importedAt,
      autonomyGeneration: HazamaBridgeState.autonomyGeneration,
      evolution: { ...HazamaBridgeState.evolution },
      audio: { ...HazamaBridgeState.audio },
      patterns: { ...HazamaBridgeState.patterns }
    },
    pads: { ...PerformancePadState },
    output: { level: OutputState.level },
    updatedAt: Date.now()
  };

  window.MusicRuntimeState = state;
  try {
    window.dispatchEvent(new CustomEvent("music-runtime-state", { detail: state }));
  } catch (error) {}
  maybeSendHazamaRuntimeFeedback(state);
}

// Music session/orchestra packet cluster extracted to audio/music-packet.js (BL-008)
const {
  packetUnit,
  buildMusicSessionPacket,
  syncMusicSessionPacket,
  downloadMusicSessionPacket,
  buildMusicOrchestraPacket,
  syncMusicOrchestraPacket,
  downloadMusicOrchestraPacket,
  MUSIC_STACK_PACKET_STORAGE_KEY,
  MUSIC_STACK_CHANNEL_NAME,
  MUSIC_ORCHESTRA_PACKET_STORAGE_KEY,
  MUSIC_ORCHESTRA_CHANNEL_NAME
} = window.MusicPacketKit;

function activePerformancePadNames() {
  return ["drift", "repeat", "punch", "void"].filter((name) => PerformancePadState[name] > 0);
}

function isManualPerformanceInfluenceActive() {
  const now = performanceNowMs();
  const sliderActive = Object.keys(manualInfluenceUntil).some((key) => isManualInfluenceActive(key, now));
  const padActive = now - (PerformancePadState.lastTouchAt || 0) < MANUAL_INFLUENCE_HOLD_MS;
  return sliderActive || padActive;
}

function makeMusicSessionId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
  const random = Math.random().toString(36).slice(2, 7);
  return `music-${stamp}-${random}`;
}

function promotionTargetFromDestination(destination) {
  const map = {
    music: "Music",
    drum_floor: "drum-floor",
    namima: "namima",
    chill: "chill",
    openclaw: "OpenClaw"
  };
  return map[destination] || "OpenClaw";
}

function updateMusicStackSyncHelp(route, result = {}) {
  if (typeof document === "undefined") return;
  const help = document.getElementById("sync_help");
  const link = document.getElementById("sync_route_link");
  const kicker = document.getElementById("sync_route_kicker");
  const title = document.getElementById("sync_route_title");
  const reason = document.getElementById("sync_route_reason");
  const dock = document.getElementById("transport-dock");
  const setRouteLink = (destination, label) => {
    if (!link) return;
    const key = String(destination || "openclaw").trim();
    link.href = MUSIC_STACK_ROUTE_URLS[key] || MUSIC_STACK_ROUTE_URLS.openclaw;
    link.textContent = label || "開く";
    link.removeAttribute("aria-disabled");
  };
  const setText = (node, value) => {
    if (node) node.textContent = value;
  };
  if (!help) {
    setRouteLink(route?.destination, "開く");
    return;
  }
  if (!route) {
    if (dock) dock.classList.remove("has-sync-route");
    setText(kicker, "まずSYNC");
    setText(title, "次の行き先");
    setText(help, "START任意 → SYNC → 開く");
    setText(reason, "MICは任意。歌/手拍子はgrooveだけ反応。");
    setRouteLink("openclaw", "Desk");
    return;
  }
  const delivered = result.stored || result.broadcast;
  const label = route.label || route.destination || "Deskで見る";
  const action = route.action || "OpenClaw Desk (openclaw repo hub) を開いて次の制作カードを見る。";
  if (dock) dock.classList.toggle("has-sync-route", !!delivered);
  setText(kicker, delivered ? "次はここ" : "SYNC未完了");
  setText(title, delivered ? label : "JSON fallback");
  setText(help, delivered ? action : "OpenClaw DeskかJSON fallbackでlatestを確認。");
  setText(reason, delivered ? (route.reason || "Musicの現在状態から推奨しています。") : "音声・録音・サンプルは共有していません。");
  setRouteLink(delivered ? route.destination : "openclaw", delivered ? "開く" : "Desk");
  if (link && delivered) link.setAttribute("aria-label", `${label}を開く`);
  if (delivered) {
    try {
      window.dispatchEvent(new CustomEvent("music-stack-route-updated", { detail: { route } }));
    } catch (error) {}
  }
}

if (typeof window !== "undefined") {
  window.MusicSessionPacket = {
    build: buildMusicSessionPacket,
    sync: syncMusicSessionPacket,
    download: downloadMusicSessionPacket,
    recommend: musicStackRoutingRecommendation,
    storageKey: MUSIC_STACK_PACKET_STORAGE_KEY,
    channelName: MUSIC_STACK_CHANNEL_NAME,
    lastSync: null,
    last: null
  };
  window.MusicOrchestraPacket = {
    build: buildMusicOrchestraPacket,
    sync: syncMusicOrchestraPacket,
    download: downloadMusicOrchestraPacket,
    storageKey: MUSIC_ORCHESTRA_PACKET_STORAGE_KEY,
    channelName: MUSIC_ORCHESTRA_CHANNEL_NAME,
    lastSync: null,
    last: null
  };
  window.MusicMicFollow = {
    start: startMicFollow,
    stop: stopMicFollow,
    toggle: toggleMicFollow,
    getState: micFollowRuntimeState,
    getJamState: micJamRuntimeState
  };
  window.MusicAcidCue = {
    trigger: triggerTransientAcidCue,
    getState: () => ({
      enabled: AcidLockState.enabled,
      intensity: AcidLockState.intensity,
      indicator: AcidLockState.indicator || 0,
      transient: AcidLockState.transient || 0,
      transientSource: AcidLockState.transientSource || "",
      performance: acidPerformanceAmount()
    })
  };
}

// Hazama runtime feedback cluster extracted to audio/music-hazama-feedback.js (BL-008)
const {
  maybeSend: maybeSendHazamaRuntimeFeedback,
  request: requestHazamaRuntimeFeedback
} = window.MusicHazamaFeedback;

function hazamaAutoFollowActive() {
  return !!(HazamaBridgeState.loaded && HazamaBridgeState.active && HazamaBridgeState.autoFollow);
}

function hazamaConnectionState() {
  if (!HazamaBridgeState.loaded) return "off";
  if (HazamaBridgeState.lastError) return "error";
  if (HazamaBridgeState.controlPending) return "control-pending";
  if (hazamaAutoFollowActive()) return "follow";
  if (isPlaying && HazamaBridgeState.active) return "sync";
  if (HazamaBridgeState.controlAction === "pause") return "paused";
  if (HazamaBridgeState.controlAction === "stop") return "stopped";
  if (HazamaBridgeState.pending) return "pending";
  return "ready";
}

function hazamaUiStatusLabel() {
  return {
    off: "",
    error: "HAZAMA.ERROR",
    "control-pending": "HAZAMA.PENDING",
    follow: "HAZAMA.FOLLOW",
    sync: "HAZAMA.SYNC",
    paused: "HAZAMA.PAUSE",
    stopped: "HAZAMA.STOP",
    pending: "HAZAMA.PENDING",
    ready: "HAZAMA.READY"
  }[hazamaConnectionState()] || "HAZAMA.READY";
}

function effectiveAutoPerformanceActive() {
  return !!(UCM.auto.enabled || hazamaAutoFollowActive());
}

function updateVoiceColorUi() {
  const { atmosphere, source } = currentVoiceColor();
  const autoLabels = autoVoiceMorphLabel();
  const status = document.getElementById("voice_status");
  if (status) {
    const atmosphereLabel = autoVoiceAtmosphereActive() ? `AUTO ${autoLabels.atmosphereLabel}` : atmosphere.label;
    const sourceLabel = autoVoiceSourceActive() ? `AUTO ${autoLabels.sourceLabel}` : source.label;
    status.textContent = `${atmosphereLabel} / ${sourceLabel}`;
  }
  if (document.body) {
    document.body.dataset.atmosphere = VoiceColorState.atmosphere;
    document.body.dataset.sourceColor = VoiceColorState.source;
    document.body.dataset.autoAtmosphere = autoVoiceAtmosphereActive() ? activeAutoAtmosphereKey() : "";
    document.body.dataset.autoSourceColor = autoVoiceSourceActive() ? activeAutoSourceKey() : "";
    document.body.dataset.autoVoiceMorph = autoVoiceSourceActive() || autoVoiceAtmosphereActive() ? "true" : "false";
  }
  publishMusicRuntimeState();
}

function updateVoiceColorFromUI(options = {}) {
  const atmosphereSelect = document.getElementById("atmosphere_select");
  const sourceSelect = document.getElementById("source_color_select");
  const nextAtmosphere = atmosphereSelect ? atmosphereSelect.value || "auto" : VoiceColorState.atmosphere;
  const nextSource = sourceSelect ? sourceSelect.value || "genome" : VoiceColorState.source;
  const changed = nextAtmosphere !== VoiceColorState.atmosphere || nextSource !== VoiceColorState.source;
  VoiceColorState.atmosphere = nextAtmosphere;
  VoiceColorState.source = nextSource;
  if (changed) {
    VoiceMorphState.transition = 1;
    VoiceEmergenceState.focus = chooseVoiceEmergenceFocus(0);
    VoiceEmergenceState.nextFocus = chooseVoiceEmergenceFocus(2);
    VoiceEmergenceState.phrase = 0;
    VoiceEmergenceState.blend = 0;
  }
  updateVoiceColorUi();
  if (options.apply !== false && initialized) {
    updateTimbreStateFromWorld(currentGradientParts());
    applyUCMToParams({ force: options.force === true });
    if (changed) triggerVoiceColorCue();
  }
}

function genomeDominantPool() {
  const genes = GenomeState.genes;
  if (genes.voidTail > 0.58 || genes.chrome > 0.62) return TRANSPARENT_AIR_FRAGMENTS;
  if (genes.organic > genes.micro && genes.organic > 0.48) return ORGANIC_PLUCK_FRAGMENTS;
  if (genes.micro > 0.54 || genes.pressure > 0.56) return GLASS_NOTES;
  return FIELD_MURK_FRAGMENTS;
}

function updateGenerativeGenome(parts) {
  const genes = GenomeState.genes;
  const phiPhase = fractionalPart((GrooveState.cycle + 1) * GOLDEN_RATIO_INVERSE + GenomeState.generation * 0.03398875);
  const mutationNoise = (Math.random() - 0.5) * GenomeState.mutation;
  const pressure = parts.pressure || 0;
  const targets = {
    haze: clampValue((1 - parts.energy) * 0.24 + parts.voidness * 0.18 + parts.circle * 0.18 + parts.observer * 0.18 + GradientState.haze * 0.22, 0, 1),
    pulse: clampValue(parts.energy * 0.24 + parts.body * 0.2 + parts.resource * 0.16 + GradientState.ghost * 0.16 + GenreBlendState.techno * 0.14 + BpmCrossfadeState.blend * 0.1, 0, 1),
    micro: clampValue(parts.creation * 0.26 + parts.resource * 0.2 + parts.wave * 0.18 + GradientState.micro * 0.22 + GenreBlendState.idm * 0.14, 0, 1),
    chrome: clampValue(parts.observer * 0.24 + parts.mind * 0.2 + parts.circle * 0.16 + GradientState.chrome * 0.24 + BpmCrossfadeState.refrain * 0.16, 0, 1),
    organic: clampValue(parts.wave * 0.22 + parts.creation * 0.2 + GradientState.organic * 0.24 + OrganicEcosystemState.sprout * 0.16 + OrganicEcosystemState.ferment * 0.12 + (1 - pressure) * 0.06, 0, 1),
    pressure: clampValue(pressure * 0.34 + parts.energy * 0.18 + parts.body * 0.18 + GenreBlendState.pressure * 0.2 + OrganicChaosState.lowMotion * 0.1, 0, 1),
    refrain: clampValue(MotifMemoryState.strength * 0.24 + BpmCrossfadeState.refrain * 0.26 + LongformArcState.turn * 0.18 + parts.observer * 0.12 + parts.circle * 0.1 + phiPhase * 0.1, 0, 1),
    voidTail: clampValue(parts.voidness * 0.28 + parts.observer * 0.18 + GradientState.haze * 0.16 + DepthState.tail * 0.2 + PerformancePadState.void * 0.18, 0, 1)
  };

  for (const key of GENOME_GENE_KEYS) {
    targets[key] = clampValue(targets[key] + voiceGeneBias(key) * 0.22, 0, 1);
    genes[key] = approachValue(genes[key], targets[key], 0.012 + GenomeState.growth * 0.008);
  }

  const selectedKey = GENOME_GENE_KEYS[(GenomeState.generation + Math.floor(phiPhase * GENOME_GENE_KEYS.length)) % GENOME_GENE_KEYS.length];
  genes[selectedKey] = clampValue(genes[selectedKey] + mutationNoise * 0.18 + (targets[selectedKey] - genes[selectedKey]) * 0.05, 0, 1);

  GenomeState.phase = phiPhase;
  GenomeState.growth = approachValue(
    GenomeState.growth,
    clampValue(0.2 + OrganicEcosystemState.bloom * 0.12 + BpmCrossfadeState.refrain * 0.1 + Math.abs(DJTempoState.motion) * 0.004 + LongformArcState.contrast * 0.08, 0.16, 0.72),
    0.025
  );
  GenomeState.mutation = approachValue(
    GenomeState.mutation,
    clampValue(0.08 + OrganicChaosState.tangle * 0.08 + parts.creation * 0.05 + parts.wave * 0.04 + BpmCrossfadeState.blend * 0.05, 0.05, 0.26),
    0.02
  );
  GenomeState.resonance = clampValue(GenomeState.resonance + (targets.refrain + targets.micro + targets.organic) * 0.012, 0, 1);

  if (GenomeState.phase < GOLDEN_RATIO_INVERSE * 0.08 && GrooveState.cycle - GenomeState.lastPulseCycle > 1) {
    GenomeState.generation += 1;
    GenomeState.lastPulseCycle = GrooveState.cycle;
    const pool = genomeDominantPool();
    GenomeState.root = pool[(GrooveState.cycle + GenomeState.generation) % pool.length];
    GenomeState.reply = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + GenomeState.generation + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
    GenomeState.shade = FIELD_MURK_FRAGMENTS[(GrooveState.cycle + GenomeState.generation + 5) % FIELD_MURK_FRAGMENTS.length];
    rememberMotif(GenomeState.root, {
      reply: GenomeState.reply,
      shade: GenomeState.shade,
      strength: 0.05 + geneValue("refrain") * 0.08 + GenomeState.growth * 0.04,
      air: geneValue("voidTail") * 0.12 + geneValue("chrome") * 0.08,
      source: `genome:${GenomeState.generation}`
    });
  }
}

function updateMixGovernor(parts, gradient = GradientState, depth = DepthState) {
  const { energy, creation, voidness, body, resource, observer, pressure } = parts;
  const lowTarget = clampValue(
    body * 0.34 +
      energy * 0.22 +
      pressure * 0.2 +
      gradient.ghost * 0.1 +
      LongformArcState.turn * 0.09 -
      depth.lowMidClean * 0.16 -
      voidness * 0.08,
    0,
    1
  );
  const clarityTarget = clampValue(
    observer * 0.24 +
      creation * 0.18 +
      gradient.chrome * 0.2 +
      gradient.micro * 0.16 +
      depth.particle * 0.12 +
      (1 - resource) * 0.06 +
      LongformArcState.breath * 0.04 -
      lowTarget * 0.08,
    0.08,
    0.84
  );

  MixGovernorState.lowGuard = approachValue(MixGovernorState.lowGuard, lowTarget, 0.08);
  MixGovernorState.clarity = approachValue(MixGovernorState.clarity, clarityTarget, 0.07);
}

function advanceLongformArcPhrase(parts) {
  if (!longformArcActive()) return;
  const stage = currentLongformArcStage();
  LongformArcState.phrase += 1;

  if (LongformArcState.phrase >= (stage.length || 8)) {
    LongformArcState.stageIndex = (LongformArcState.stageIndex + 1) % LONGFORM_ARC_STAGES.length;
    LongformArcState.phrase = 0;
    LongformArcState.turn = clampValue(0.42 + Math.random() * 0.24 + organicChaosAmount() * 0.08, 0, 0.78);
    LongformArcState.lastStage = currentLongformArcStage().name;
  }

  const next = currentLongformArcStage();
  const progress = clampValue(LongformArcState.phrase / Math.max(1, next.length || 1), 0, 1);
  const quietAir = (parts.observerNorm + parts.circleNorm + parts.voidNorm) / 3;
  const activeMass = (parts.energyNorm + parts.creationNorm + parts.resourceNorm) / 3;
  const breathTarget = clampValue(
    0.36 +
      quietAir * 0.34 +
      Math.sin((GrooveState.cycle * 0.083) + progress * Math.PI) * 0.12 -
      activeMass * 0.1,
    0.18,
    0.82
  );
  const contrastTarget = clampValue(
    0.12 +
      parts.waveNorm * 0.18 +
      parts.creationNorm * 0.16 +
      organicChaosAmount() * 0.12 +
      LongformArcState.turn * 0.16,
    0.08,
    0.56
  );

  LongformArcState.breath = approachValue(LongformArcState.breath, breathTarget, 0.035);
  LongformArcState.contrast = approachValue(LongformArcState.contrast, contrastTarget, 0.045);
}

function advanceOrganicEcosystemPhrase(parts) {
  if (!UCM.auto.enabled || !isPlaying) return;
  const scene = currentAutoDirectorScene();
  const chaos = organicChaosAmount();
  const arc = currentLongformArcStage();
  const arcName = arc.name || "submerge";
  const sceneName = scene.name || "haze";
  const sceneSprout = (sceneName === "stir" || sceneName === "tangle" ? 0.07 : sceneName === "open" ? 0.035 : 0.025) + (arcName === "sprout" ? 0.035 : arcName === "ferment" ? 0.018 : 0);
  const sceneFerment = (sceneName === "tangle" ? 0.08 : sceneName === "body" ? 0.065 : 0.025) + (arcName === "ferment" ? 0.04 : arcName === "root" ? 0.018 : 0);
  const sceneRoot = (sceneName === "body" ? 0.09 : sceneName === "tangle" ? 0.045 : 0.02) + (arcName === "root" ? 0.045 : 0);
  const breathTarget = clampValue(
    0.48 +
      Math.sin(GrooveState.cycle * 0.31) * 0.18 +
      parts.observerNorm * 0.1 +
      parts.circleNorm * 0.08 +
      parts.voidNorm * 0.06 -
      parts.energyNorm * 0.08 +
      LongformArcState.breath * 0.06,
    0.18,
    0.88
  );

  OrganicEcosystemState.breath = approachValue(OrganicEcosystemState.breath, breathTarget, 0.05);
  OrganicEcosystemState.sprout = clampValue(OrganicEcosystemState.sprout * 0.84 + sceneSprout + parts.creationNorm * 0.035 + parts.waveNorm * 0.018 + Math.random() * 0.025, 0, 1);
  OrganicEcosystemState.ferment = clampValue(OrganicEcosystemState.ferment * 0.86 + sceneFerment + parts.resourceNorm * 0.032 + chaos * 0.07, 0, 1);
  OrganicEcosystemState.rootTurn = clampValue(OrganicEcosystemState.rootTurn * 0.86 + sceneRoot + (UCM_CUR.body / 100) * 0.032 + parts.waveNorm * 0.026 + OrganicChaosState.lowMotion * 0.05, 0, 1);

  const bloomChance = 0.08 + OrganicEcosystemState.sprout * 0.08 + OrganicEcosystemState.ferment * 0.06 + (AutoDirectorState.cadence === "scene" ? 0.1 : 0);
  if (GrooveState.cycle - OrganicEcosystemState.lastBloomCycle > 2 && rand(chance(bloomChance))) {
    OrganicEcosystemState.bloom = clampValue(OrganicEcosystemState.bloom + 0.28 + Math.random() * 0.22 + chaos * 0.08, 0, 1);
    OrganicEcosystemState.lastBloomCycle = GrooveState.cycle;
  }
}

// seconds to reach target (larger = smoother)
let UCM_SMOOTH_SEC = 1.6;

let initialized = false;
let isPlaying   = false;
let isStarting  = false;
let transportEventId = null;
let barCounterEventId = null;

const RAMP_CACHE = {};
const NAMIMA_ADAPTER_UPDATE_INTERVAL_MS = 180;
const NAMIMA_ADAPTER_ENERGY_DELTA = 0.015;
let namimaAdapterLastSentAt = 0;
let namimaAdapterLastEnergy = null;
let namimaAdapterLastMode = null;
let autoSliderLastSyncAt = 0;
const TRANSPORT_CONTROL_SYNC_STEPS = 4;

/* =========================================================
   1. ヘルパー
========================================================= */

function getSliderValue(id, fallback = 50) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  return parseInt(el.value, 10);
}

function updateFromUI(options = {}) {
  markManualInfluenceFromEvent(options);
  UCM_TARGET.energy = getSliderValue("fader_energy", UCM_TARGET.energy);
  UCM_TARGET.wave = getSliderValue("fader_wave", UCM_TARGET.wave);
  UCM_TARGET.mind = getSliderValue("fader_mind", UCM_TARGET.mind);
  UCM_TARGET.creation = getSliderValue("fader_creation", UCM_TARGET.creation);
  UCM_TARGET.void = getSliderValue("fader_void", UCM_TARGET.void);
  UCM_TARGET.circle = getSliderValue("fader_circle", UCM_TARGET.circle);
  UCM_TARGET.body = getSliderValue("fader_body", UCM_TARGET.body);
  UCM_TARGET.resource = getSliderValue("fader_resource", UCM_TARGET.resource);
  UCM_TARGET.observer = getSliderValue("fader_observer", UCM_TARGET.observer);

  if (options.apply !== false) {
    applyUCMToParams({ force: options.force === true });
  }
}

function getMusicAudioAdapter() {
  return window && window.MusicNamimaAudioAdapter ? window.MusicNamimaAudioAdapter : null;
}

function safeCallMusicAudioAdapter(methodName, ...args) {
  const adapter = getMusicAudioAdapter();
  if (!adapter || typeof adapter[methodName] !== "function") return undefined;

  try {
    const result = adapter[methodName](...args);
    if (result && typeof result.catch === "function") {
      return result.catch((error) => {
        console.warn("[Music] audio adapter call failed:", methodName, error);
      });
    }
    return result;
  } catch (error) {
    console.warn("[Music] audio adapter call failed:", methodName, error);
    return undefined;
  }
}

// Local recorder cluster extracted to audio/music-recorder.js (BL-008)
const RecorderState = window.MusicRecorder.state;
const {
  toggle: toggleLocalRecorder,
  stop: stopLocalRecorder,
  setStatus: setRecorderStatus
} = window.MusicRecorder;

function activePerformancePadName() {
  return ["drift", "repeat", "punch", "void"].find((name) => PerformancePadState[name] > 0) || "";
}

function updatePerformancePadStatus() {
  const statusText = document.getElementById("status-text");
  if (!statusText) return;
  if (RecorderState.recorder && RecorderState.recorder.state === "recording") return;

  const activeName = activePerformancePadName();
  if (activeName) {
    statusText.textContent = PERFORMANCE_PAD_STATUS[activeName] || `${activeName.toUpperCase()} active`;
  } else if (isPlaying) {
    statusText.textContent = albumArcActive()
      ? `Playing / ${currentAlbumArcChapter().label}`
      : hazamaAutoFollowActive()
        ? "Playing / Hazama"
        : UCM.auto.enabled ? "Playing / AutoMix" : "Playing…";
  }
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rampParam(cacheKey, param, value, seconds, minDelta = 0.001) {
  if (!param || typeof param.rampTo !== "function" || typeof value !== "number" || Number.isNaN(value)) return;

  const previous = RAMP_CACHE[cacheKey];
  if (typeof previous === "number" && Math.abs(previous - value) < minDelta) return;

  RAMP_CACHE[cacheKey] = value;
  try {
    param.rampTo(value, seconds, currentToneContextTime());
  } catch (error) {
    console.warn("[Music] param ramp failed:", cacheKey, error);
  }
}

function outputGainFromLevel(level) {
  const safeLevel = clampValue(Number.isFinite(level) ? level : 75, 0, 100);
  if (safeLevel <= 0) return 0.0001;
  if (safeLevel <= 50) {
    return mapValue(safeLevel, 0, 50, 0.0001, 1.0);
  }
  if (safeLevel <= 75) {
    return mapValue(safeLevel, 50, 75, 1.0, 1.65);
  }
  return mapValue(safeLevel, 75, 100, 1.65, 2.65);
}

function updateOutputLevelUi() {
  const value = document.getElementById("output_value");
  if (value) value.textContent = String(Math.round(OutputState.level));
  updateHeaderRuntimeUi();
}

function updateOutputLevel(options = {}) {
  const slider = document.getElementById("output_level");
  const nextLevel = slider ? parseInt(slider.value, 10) : OutputState.level;
  OutputState.level = clampValue(Number.isFinite(nextLevel) ? nextLevel : OutputState.level, 0, 100);
  updateOutputLevelUi();
  if (options.apply !== false) {
    applyOutputLevel({ force: options.force === true });
  }
}

function adjustOutputLevel(delta, options = {}) {
  const slider = document.getElementById("output_level");
  const current = slider ? parseInt(slider.value, 10) : OutputState.level;
  const nextLevel = clampValue((Number.isFinite(current) ? current : OutputState.level) + delta, 0, 100);
  if (slider) slider.value = String(Math.round(nextLevel));
  OutputState.level = nextLevel;
  updateOutputLevelUi();
  applyOutputLevel({ force: options.force === true, allowWhenStopped: options.allowWhenStopped === true });
  return nextLevel;
}

function applyOutputLevel(options = {}) {
  const allowWhenStopped = options.allowWhenStopped === true;
  if (!isPlaying && !allowWhenStopped) return;
  const seconds = options.force === true ? 0.08 : 0.18;
  rampParam("master-gain", masterGain.gain, engineOutputGainTarget(), seconds, 0.003);
}

function engineOutputGainTarget(level = OutputState.level) {
  const outputGain = outputGainFromLevel(level);
  let fmTrim = 1;
  try {
    const fmMix = hazamaFmEngineMix();
    if (fmMix?.genre && typeof fmMix.engineGain === "number") {
      fmTrim = fmMix.engineGain;
    }
  } catch (error) {
    fmTrim = 1;
  }
  return clampValue(outputGain * fmTrim, 0.0001, 2.72);
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
  return isAppleMobileDevice() && isSafariFamily();
}

function setAudioOutputStatus(message) {
  const el = document.getElementById("audio_output_status");
  if (el) el.textContent = message;
}

function backgroundBridgeErrorMessage(error) {
  if (!error) return "";
  const name = error.name ? `${error.name}: ` : "";
  const message = error.message || String(error);
  return `${name}${message}`.slice(0, 180);
}

function updateBackgroundBridgeDiagnostics(patch = {}) {
  const diagnostics = PlaybackState.backgroundBridgeDiagnostics;
  if (!diagnostics) return;

  const next = { ...patch };
  if ("error" in next) {
    if (next.error) next.lastError = backgroundBridgeErrorMessage(next.error);
    delete next.error;
  }
  if (next.clearError) {
    next.lastError = "";
    delete next.clearError;
  }

  Object.assign(diagnostics, next, { lastChangedAt: Date.now() });
}

function normalizeBackgroundBridgeRoute(message) {
  if (PlaybackState.backgroundBridgeActive) return "bridge";
  const route = String(message || "").toLowerCase();
  if (route.includes("failed") || route.includes("error") || route.includes("lost") || route.includes("stalled") || route.includes("abort")) return "failed";
  if (route.includes("bridge") || route.includes("ios bg")) return "bridge";
  if (route.includes("arm") || route.includes("ready") || route.includes("hidden") || route.includes("resume") || route.includes("keep")) return "ready";
  if (route.includes("direct") || route.includes("system") || route.includes("blocked") || route.includes("n/a")) return "direct";
  if (route.includes("off") || !route) return "off";
  return "direct";
}

function getBackgroundBridgeSnapshot(extra = {}) {
  const diagnostics = PlaybackState.backgroundBridgeDiagnostics || {};
  const audio = PlaybackState.backgroundAudio;
  let bridgeStreamReady = false;
  try {
    bridgeStreamReady = !!backgroundPlaybackDestination?.stream;
  } catch (error) {
    bridgeStreamReady = false;
  }

  let toneState = "";
  try {
    toneState = Tone?.context?.state || "";
  } catch (error) {
    toneState = "";
  }

  const status = diagnostics.status || "off";
  return {
    status,
    route: normalizeBackgroundBridgeRoute(status),
    active: !!PlaybackState.backgroundBridgeActive,
    available: !!audio || bridgeStreamReady,
    preferred: !!PlaybackState.iosSafariBridgePreferred,
    audioReady: !!audio && !!audio.srcObject,
    audioPaused: audio ? !!audio.paused : true,
    audioEnded: audio ? !!audio.ended : false,
    audioReadyState: audio ? audio.readyState || 0 : 0,
    currentTime: audio ? Math.round((Number(audio.currentTime) || 0) * 1000) / 1000 : 0,
    sinkId: audio?.sinkId || PlaybackState.outputDeviceId || "",
    outputDeviceLabel: PlaybackState.outputDeviceLabel || "SYSTEM / BT",
    wakeLockEnabled: !!PlaybackState.wakeLockEnabled,
    lastEvent: diagnostics.lastEvent || "",
    lastError: diagnostics.lastError || "",
    lastChangedAt: diagnostics.lastChangedAt || 0,
    lastAttemptAt: diagnostics.lastAttemptAt || 0,
    lastSuccessAt: diagnostics.lastSuccessAt || 0,
    lastLostAt: diagnostics.lastLostAt || 0,
    attemptCount: diagnostics.attemptCount || 0,
    successCount: diagnostics.successCount || 0,
    lostCount: diagnostics.lostCount || 0,
    rearmCount: diagnostics.rearmCount || 0,
    lastRearmReason: diagnostics.lastRearmReason || "",
    hardwareMuted: !!PlaybackState.backgroundBridgeActive,
    canRearm: !!audio || bridgeStreamReady,
    isPlaying: !!isPlaying,
    toneState,
    visibilityState: typeof document !== "undefined" ? document.visibilityState || "visible" : "",
    ...extra
  };
}

function publishBackgroundBridgeState(extra = {}) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    window.dispatchEvent(new CustomEvent("music-background-bridge-state", {
      detail: getBackgroundBridgeSnapshot(extra)
    }));
  } catch (error) {
    // Diagnostic events are best effort only.
  }
}

function setBackgroundStatus(message) {
  const el = document.getElementById("background_value");
  if (el) el.textContent = message;
  updateBackgroundBridgeDiagnostics({ status: message || "off" });
  publishBackgroundBridgeState();
}

function getNativeAudioContext() {
  if (typeof Tone === "undefined" || !Tone.context) return null;
  return Tone.context.rawContext || Tone.context._context || Tone.context.context || Tone.context;
}

function getAudioOutputSinkTarget() {
  const context = getNativeAudioContext();
  return context && typeof context.setSinkId === "function" ? context : null;
}

function getHtmlAudioSinkTarget() {
  const audio = PlaybackState.backgroundAudio;
  return audio && typeof audio.setSinkId === "function" ? audio : null;
}

function getOutputDeviceLabel(device) {
  if (!device) return "SYSTEM / BT";
  return device.label || (device.deviceId === "default" ? "System default" : "Audio output");
}

async function refreshAudioOutputDevices(selectedDeviceId = PlaybackState.outputDeviceId) {
  const select = document.getElementById("audio_output_select");
  if (!select) return;

  const canEnumerate = !!navigator.mediaDevices?.enumerateDevices;
  const canRoute = !!getAudioOutputSinkTarget();
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "SYSTEM / BT";
  select.appendChild(defaultOption);

  if (!canEnumerate) {
    select.disabled = true;
    setAudioOutputStatus("system");
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((device) => device.kind === "audiooutput");
    outputs.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Output ${index + 1}`;
      select.appendChild(option);
    });

    select.disabled = !canRoute || outputs.length === 0;
    if (selectedDeviceId && [...select.options].some((option) => option.value === selectedDeviceId)) {
      select.value = selectedDeviceId;
    } else {
      select.value = "";
    }

    if (!canRoute) {
      setAudioOutputStatus("system");
    } else if (outputs.length === 0) {
      setAudioOutputStatus("default");
    } else {
      setAudioOutputStatus(PlaybackState.outputDeviceLabel || "ready");
    }
  } catch (error) {
    console.warn("[Music] audio output list failed:", error);
    select.disabled = !canRoute;
    setAudioOutputStatus(canRoute ? "ready" : "system");
  }
}

async function applyAudioOutputDevice(deviceId, label = "") {
  const sinkTarget = getAudioOutputSinkTarget();
  const htmlSinkTarget = getHtmlAudioSinkTarget();
  PlaybackState.outputDeviceId = deviceId || "";
  PlaybackState.outputDeviceLabel = label || (deviceId ? "Audio output" : "SYSTEM / BT");

  if (!sinkTarget && !htmlSinkTarget) {
    setAudioOutputStatus("system");
    return false;
  }

  let routed = false;
  try {
    if (sinkTarget) {
      await sinkTarget.setSinkId(deviceId || "");
      routed = true;
    }
    if (htmlSinkTarget) {
      await htmlSinkTarget.setSinkId(deviceId || "");
      routed = true;
    }
    setAudioOutputStatus(deviceId && routed ? "routed" : "system");
    return routed;
  } catch (error) {
    console.warn("[Music] audio output route failed:", error);
    setAudioOutputStatus("blocked");
    return false;
  }
}

async function chooseAudioOutputDevice() {
  if (!navigator.mediaDevices) {
    setAudioOutputStatus("system");
    return;
  }

  try {
    if (typeof navigator.mediaDevices.selectAudioOutput === "function") {
      const device = await navigator.mediaDevices.selectAudioOutput();
      await applyAudioOutputDevice(device.deviceId, getOutputDeviceLabel(device));
      await refreshAudioOutputDevices(device.deviceId);
      return;
    }

    await refreshAudioOutputDevices();
    const select = document.getElementById("audio_output_select");
    if (select && !select.disabled) {
      setAudioOutputStatus("select");
    } else {
      setAudioOutputStatus("system");
    }
  } catch (error) {
    if (error && error.name !== "NotAllowedError") {
      console.warn("[Music] audio output choose failed:", error);
    }
    setAudioOutputStatus("system");
  }
}

async function resumeAudioContext(reason = "resume") {
  if (typeof Tone === "undefined" || !Tone.context) return false;
  try {
    if (Tone.context.state !== "running") {
      const result = Tone.context.resume?.();
      if (result && typeof result.then === "function") await result;
    }
    return Tone.context.state === "running";
  } catch (error) {
    console.warn("[Music] AudioContext resume failed:", reason, error);
    return false;
  }
}

function setupMediaSessionControls() {
  if (!navigator.mediaSession) return;
  if (document.body?.dataset?.page === "fm") return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Music Core Rig",
      artist: "QuietBriony",
      album: "Reference-Driven Generative Rig"
    });
  } catch (error) {
    console.warn("[Music] media session metadata failed:", error);
  }

  const handlers = {
    play: () => document.getElementById("btn_start")?.click(),
    pause: () => document.getElementById("btn_stop")?.click(),
    stop: () => document.getElementById("btn_stop")?.click(),
    seekbackward: () => adjustOutputLevel(-5, { force: true }),
    seekforward: () => adjustOutputLevel(5, { force: true })
  };

  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      // Some browsers expose Media Session but not every action.
    }
  });
}

function updateMediaSessionPlaybackState() {
  if (!navigator.mediaSession) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  } catch (error) {
    console.warn("[Music] media session state failed:", error);
  }
}

async function requestPlaybackWakeLock() {
  if (!PlaybackState.wakeLockEnabled || !navigator.wakeLock?.request) {
    setBackgroundStatus(isPlaying ? "direct" : (navigator.wakeLock?.request ? "off" : "n/a"));
    return false;
  }
  if (document.visibilityState && document.visibilityState !== "visible") {
    setBackgroundStatus("hidden");
    return false;
  }
  if (PlaybackState.wakeLockSentinel && !PlaybackState.wakeLockSentinel.released) {
    setBackgroundStatus("keep");
    return true;
  }

  try {
    PlaybackState.wakeLockSentinel = await navigator.wakeLock.request("screen");
    PlaybackState.wakeLockSentinel.addEventListener("release", () => {
      PlaybackState.wakeLockSentinel = null;
      if (PlaybackState.wakeLockEnabled && isPlaying) setBackgroundStatus("resume");
      else setBackgroundStatus("off");
    });
    setBackgroundStatus("keep");
    return true;
  } catch (error) {
    console.warn("[Music] wake lock failed:", error);
    setBackgroundStatus("blocked");
    return false;
  }
}

async function releasePlaybackWakeLock() {
  const sentinel = PlaybackState.wakeLockSentinel;
  PlaybackState.wakeLockSentinel = null;
  if (sentinel && !sentinel.released) {
    try {
      await sentinel.release();
    } catch (error) {
      console.warn("[Music] wake lock release failed:", error);
    }
  }
  setBackgroundStatus(PlaybackState.wakeLockEnabled ? "ready" : "off");
}

function setKeepAwakeEnabled(enabled) {
  PlaybackState.wakeLockEnabled = !!enabled;
  const button = document.getElementById("btn_keep_awake");
  if (button) {
    button.classList.toggle("active", PlaybackState.wakeLockEnabled);
    button.setAttribute("aria-pressed", PlaybackState.wakeLockEnabled ? "true" : "false");
    button.setAttribute("aria-label", PlaybackState.wakeLockEnabled ? "Keep playback awake on" : "Keep playback awake");
    button.setAttribute("title", PlaybackState.wakeLockEnabled ? "Keep playback awake on" : "Keep playback awake");
    button.textContent = PlaybackState.wakeLockEnabled ? "KEEP.ON" : "KEEP";
  }

  if (PlaybackState.wakeLockEnabled && isPlaying) {
    requestPlaybackWakeLock();
  } else {
    releasePlaybackWakeLock();
  }
}

function triggerAcidLockIndicator(time = currentToneContextTime(), options = {}) {
  const cueLevel = clampValue(options.amount ?? Math.max(AcidLockState.intensity || 0, AcidLockState.transient || 0, AcidLockState.indicator || 0), 0, 1);
  if ((!AcidLockState.enabled && cueLevel < 0.08) || !isPlaying || !glass) return;
  const amount = clampValue(0.42 + (AcidLockState.intensity || 0) * 0.28 + (AcidLockState.transient || 0) * 0.22 + (AcidLockState.indicator || 0) * 0.3, 0, 1);
  const step = stepIndex || 0;
  const tagTime = time + 0.018;
  const root = tonalRhymeHigh(step, 4);
  const reply = tonalRhymeHigh(step, 7);

  try {
    glass.triggerAttackRelease(root, "64n", tagTime, clampValue(0.05 + amount * 0.072, 0.04, 0.13));
    glass.triggerAttackRelease(reply, "64n", tagTime + 0.072, clampValue(0.028 + amount * 0.052, 0.024, 0.096));
    if (hat) {
      hat.triggerAttackRelease("64n", tagTime + 0.012, clampValue(0.034 + amount * 0.05, 0.028, 0.092));
    }
    if (texture) {
      texture.triggerAttackRelease("64n", tagTime + 0.024, clampValue(0.018 + amount * 0.042, 0.014, 0.074));
    }
    nudgeInnerSourceFamily("acidBiyon", 0.028 + amount * 0.026);
    nudgeInnerSourceFamily("chain", 0.018 + amount * 0.016);
    markMixEvent(0.06 + amount * 0.08);
  } catch (error) {
    console.warn("[Music] acid lock indicator failed:", error);
  }
}

function triggerTransientAcidCue(options = {}) {
  const amount = clampValue(Number(options.amount) || 0.52, 0.18, 0.86);
  AcidLockState.transient = Math.max(AcidLockState.transient || 0, amount);
  AcidLockState.indicator = Math.max(AcidLockState.indicator || 0, clampValue(amount + 0.22, 0, 1));
  AcidLockState.transientSource = typeof options.source === "string" ? options.source.slice(0, 80) : "transient";
  VoiceMorphState.transition = Math.max(VoiceMorphState.transition, 0.5 + amount * 0.22);
  if (initialized) {
    updateTimbreStateFromWorld(currentGradientParts());
    applyUCMToParams({ force: options.force === true });
    triggerAcidLockIndicator(currentToneContextTime(), { amount });
    publishMusicRuntimeState();
  }
  return {
    amount,
    transient: AcidLockState.transient,
    indicator: AcidLockState.indicator,
    source: AcidLockState.transientSource
  };
}

function setAcidLockEnabled(enabled) {
  AcidLockState.enabled = !!enabled;
  AcidLockState.intensity = AcidLockState.enabled ? Math.max(AcidLockState.intensity, 0.7) : 0;
  AcidLockState.indicator = AcidLockState.enabled ? Math.max(AcidLockState.indicator || 0, 1) : 0;
  VoiceMorphState.transition = Math.max(VoiceMorphState.transition, AcidLockState.enabled ? 0.7 : 0.38);
  const button = document.getElementById("btn_acid_lock");
  if (button) {
    button.classList.toggle("active", AcidLockState.enabled);
    button.setAttribute("aria-pressed", AcidLockState.enabled ? "true" : "false");
    button.setAttribute("aria-label", AcidLockState.enabled ? "Acid color lock on" : "Acid color lock");
    button.setAttribute("title", AcidLockState.enabled ? "Acid color lock on" : "Acid color lock");
    button.textContent = AcidLockState.enabled ? "ACID.ON" : "ACID";
  }
  if (document.body) document.body.dataset.acid = AcidLockState.enabled ? "true" : "false";
  if (initialized) {
    updateTimbreStateFromWorld(currentGradientParts());
    applyUCMToParams({ force: true });
    triggerAcidLockIndicator();
  }
  updateRuntimeUiState();
}

function ensureBackgroundPlaybackElement() {
  if (PlaybackState.backgroundAudio) return PlaybackState.backgroundAudio;
  if (!backgroundPlaybackDestination?.stream || typeof document === "undefined") return null;

  const audio = document.createElement("audio");
  audio.id = "ios_background_audio";
  audio.autoplay = false;
  audio.controls = false;
  audio.loop = false;
  audio.muted = false;
  audio.playsInline = true;
  audio.srcObject = backgroundPlaybackDestination.stream;
  audio.setAttribute("aria-hidden", "true");
  audio.setAttribute("playsinline", "");
  audio.style.position = "fixed";
  audio.style.width = "1px";
  audio.style.height = "1px";
  audio.style.opacity = "0";
  audio.style.pointerEvents = "none";
  audio.style.left = "-9999px";
  audio.style.bottom = "0";

  const host = document.body || document.documentElement;
  host.appendChild(audio);
  PlaybackState.backgroundAudio = audio;
  updateBackgroundBridgeDiagnostics({ lastEvent: "element" });
  publishBackgroundBridgeState();
  bindBackgroundPlaybackHealth(audio);
  return audio;
}

function routeHardwareOutputForBridge(active, force = false) {
  const value = active ? 0.0001 : 1;
  rampParam("hardware-output", hardwareOutput.gain, value, force ? 0.04 : 0.12, 0.003);
}

function bindBackgroundPlaybackHealth(audio) {
  if (!audio || PlaybackState.backgroundBridgeHealthBound) return;
  PlaybackState.backgroundBridgeHealthBound = true;
  const markBridgeLost = (event) => {
    if (!PlaybackState.backgroundBridgeActive) return;
    const eventType = event?.type || "lost";
    PlaybackState.backgroundBridgeActive = false;
    updateBackgroundBridgeDiagnostics({
      lastEvent: eventType,
      lastLostAt: Date.now(),
      lostCount: PlaybackState.backgroundBridgeDiagnostics.lostCount + 1,
      error: eventType === "error" ? audio.error || new Error("background bridge error") : null
    });
    routeHardwareOutputForBridge(false, true);
    setBackgroundStatus(eventType === "error" ? "failed" : "lost");
    scheduleBackgroundBridgeRearm(eventType);
  };
  ["pause", "ended", "error", "stalled", "emptied", "abort"].forEach((eventName) => {
    audio.addEventListener(eventName, markBridgeLost);
  });
}

function clearBackgroundBridgeRearmTimer() {
  if (!PlaybackState.backgroundBridgeRearmTimer) return;
  clearTimeout(PlaybackState.backgroundBridgeRearmTimer);
  PlaybackState.backgroundBridgeRearmTimer = 0;
}

function scheduleBackgroundBridgeRearm(reason = "lost") {
  clearBackgroundBridgeRearmTimer();
  if (!isPlaying || !PlaybackState.iosSafariBridgePreferred) return;

  updateBackgroundBridgeDiagnostics({ lastRearmReason: reason });
  PlaybackState.backgroundBridgeRearmTimer = setTimeout(() => {
    PlaybackState.backgroundBridgeRearmTimer = 0;
    if (!isPlaying || PlaybackState.backgroundBridgeActive) return;
    startBackgroundAudioBridge({ force: true, rearm: true, reason });
  }, 1200);
}

function checkBackgroundBridgeHealth(reason = "watchdog") {
  const audio = PlaybackState.backgroundAudio;
  if (!isPlaying || !PlaybackState.backgroundBridgeActive) {
    if (isPlaying && PlaybackState.iosSafariBridgePreferred && !PlaybackState.backgroundBridgeActive) {
      scheduleBackgroundBridgeRearm(reason);
    }
    return getBackgroundBridgeSnapshot({ healthy: !isPlaying || !PlaybackState.backgroundBridgeActive });
  }

  const unhealthy = !audio || audio.paused || audio.ended || !audio.srcObject || audio.readyState === 0;
  if (!unhealthy) return getBackgroundBridgeSnapshot({ healthy: true });

  PlaybackState.backgroundBridgeActive = false;
  updateBackgroundBridgeDiagnostics({
    lastEvent: reason,
    lastLostAt: Date.now(),
    lostCount: PlaybackState.backgroundBridgeDiagnostics.lostCount + 1
  });
  routeHardwareOutputForBridge(false, true);
  setBackgroundStatus("lost");
  scheduleBackgroundBridgeRearm(reason);
  return getBackgroundBridgeSnapshot({ healthy: false });
}

async function startBackgroundAudioBridge(options = {}) {
  const force = options.force === true;
  if (!force && !shouldPreferBackgroundAudioBridge()) {
    routeHardwareOutputForBridge(false);
    setBackgroundStatus("direct");
    return false;
  }

  const audio = ensureBackgroundPlaybackElement();
  if (!audio) {
    updateBackgroundBridgeDiagnostics({ lastEvent: "unavailable" });
    setBackgroundStatus("direct");
    routeHardwareOutputForBridge(false);
    return false;
  }

  const isRearm = options.rearm === true;
  updateBackgroundBridgeDiagnostics({
    lastEvent: isRearm ? "rearm" : "arm",
    lastAttemptAt: Date.now(),
    attemptCount: PlaybackState.backgroundBridgeDiagnostics.attemptCount + 1,
    rearmCount: isRearm ? PlaybackState.backgroundBridgeDiagnostics.rearmCount + 1 : PlaybackState.backgroundBridgeDiagnostics.rearmCount,
    lastRearmReason: options.reason || PlaybackState.backgroundBridgeDiagnostics.lastRearmReason || "",
    clearError: true
  });
  setBackgroundStatus(isRearm ? "rearming" : "arming");

  try {
    audio.muted = false;
    audio.volume = 1;
    if (PlaybackState.outputDeviceId && typeof audio.setSinkId === "function") {
      try {
        await audio.setSinkId(PlaybackState.outputDeviceId);
      } catch (sinkError) {
        console.warn("[Music] background bridge sink fallback:", sinkError);
        setAudioOutputStatus("SYSTEM / BT");
      }
    }
    const result = audio.play();
    if (result && typeof result.then === "function") await result;
    PlaybackState.backgroundBridgeActive = true;
    clearBackgroundBridgeRearmTimer();
    updateBackgroundBridgeDiagnostics({
      lastEvent: isRearm ? "rearmed" : "play",
      lastSuccessAt: Date.now(),
      successCount: PlaybackState.backgroundBridgeDiagnostics.successCount + 1,
      clearError: true
    });
    routeHardwareOutputForBridge(true, force);
    setBackgroundStatus(shouldPreferBackgroundAudioBridge() ? "ios bg" : "bridge");
    return true;
  } catch (error) {
    console.warn("[Music] background audio bridge failed:", error);
    PlaybackState.backgroundBridgeActive = false;
    updateBackgroundBridgeDiagnostics({
      lastEvent: isRearm ? "rearm-error" : "error",
      lastLostAt: Date.now(),
      error
    });
    routeHardwareOutputForBridge(false, true);
    setBackgroundStatus("failed");
    return false;
  }
}

function stopBackgroundAudioBridge() {
  const audio = PlaybackState.backgroundAudio;
  clearBackgroundBridgeRearmTimer();
  PlaybackState.backgroundBridgeActive = false;
  updateBackgroundBridgeDiagnostics({ lastEvent: "stop" });
  routeHardwareOutputForBridge(false, true);
  if (audio) {
    try { audio.pause(); } catch(e) {}
  }
  setBackgroundStatus(isPlaying ? "direct" : (PlaybackState.wakeLockEnabled ? "ready" : "off"));
}

async function rearmBackgroundAudioBridge(options = {}) {
  clearBackgroundBridgeRearmTimer();
  updateBackgroundBridgeDiagnostics({
    lastEvent: "manual-rearm",
    lastRearmReason: options.reason || options.source || "manual"
  });
  await resumeAudioContext("bridge-rearm");
  const ok = await startBackgroundAudioBridge({ force: true, rearm: true, reason: options.reason || options.source || "manual" });
  return getBackgroundBridgeSnapshot({ rearmed: ok });
}

if (typeof window !== "undefined") {
  window.MusicBackgroundBridge = {
    getState: getBackgroundBridgeSnapshot,
    rearm: rearmBackgroundAudioBridge,
    check: checkBackgroundBridgeHealth
  };
}

function syncSliderValue(key, value) {
  const id = SLIDER_BY_UCM[key];
  if (!id) return;

  const el = document.getElementById(id);
  if (!el || document.activeElement === el) return;
  el.value = String(Math.round(clampValue(value, 0, 100)));
}

function syncSliderFromTarget(key) {
  syncSliderValue(key, UCM_TARGET[key]);
}

function setHazamaStatus(text) {
  const status = document.getElementById("status-text");
  if (status && !isPlaying) status.textContent = text;
  const presetStatus = document.getElementById("preset-status");
  if (presetStatus && HazamaBridgeState.loaded) presetStatus.textContent = text;
}

function updateHazamaUiState() {
  const statusLabel = hazamaUiStatusLabel();
  const button = document.getElementById("btn_start");
  if (button) {
    button.textContent = HazamaBridgeState.loaded ? (hazamaAutoFollowActive() ? "HZM.ON" : "START.HZM") : "START";
    button.setAttribute("aria-label", HazamaBridgeState.loaded ? "Start Hazama audio" : "Start audio");
    button.setAttribute("title", HazamaBridgeState.loaded ? "Start Hazama audio" : "Start audio");
  }
  if (document.body) {
    document.body.dataset.hazama = HazamaBridgeState.loaded ? "true" : "false";
    document.body.dataset.hazamaStage = HazamaBridgeState.stage || "";
    document.body.dataset.hazamaState = hazamaConnectionState();
  }
  const presetStatus = document.getElementById("preset-status");
  if (presetStatus && HazamaBridgeState.loaded) presetStatus.textContent = statusLabel;
  updateHeaderRuntimeUi();
}

function sanitizeHazamaStyle(style) {
  const normalized = typeof style === "string" ? style.trim().toLowerCase() : "";
  if (normalized === "trance" || normalized === "acid-techno" || normalized === "acid_techno") return "techno";
  if (normalized === "acid-house" || normalized === "acid_house") return "lofi";
  if (PresetManager.names.includes(normalized)) return normalized;
  if (normalized === "idm" || normalized === "field" || normalized === "haze") return "ambient";
  if (normalized === "broken" || normalized === "glitch") return "lofi";
  return "";
}

function normalizeHazamaTempo(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 100) return mapValue(clampValue(value, 0, 100), 0, 100, 54, 142);
  return clampValue(value, 54, 152);
}

function safeHazamaNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const HAZAMA_ALLOWED_ORIGINS = new Set([
  "https://quietbriony.github.io",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:8095",
  "http://localhost:8095"
]);

function isAllowedHazamaOrigin(origin) {
  if (typeof origin !== "string" || !origin || origin === "null") return false;
  return HAZAMA_ALLOWED_ORIGINS.has(origin);
}

function decodeBase64UrlJson(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const json = typeof TextDecoder !== "undefined"
      ? new TextDecoder("utf-8").decode(bytes)
      : decodeURIComponent(Array.from(bytes).map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join(""));
    return JSON.parse(json);
  } catch (error) {
    console.warn("[Music] invalid hazama payload:", error);
    HazamaBridgeState.lastError = "invalid payload";
    setHazamaStatus("HAZAMA.ERROR");
    return null;
  }
}

function profileFromHazamaPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.type !== "hazama-profile") {
    HazamaBridgeState.lastError = "invalid type";
    return null;
  }
  if (payload.version !== 1) {
    HazamaBridgeState.lastError = "invalid version";
    return null;
  }
  if (payload.provider !== "music") {
    HazamaBridgeState.lastError = "invalid provider";
    return null;
  }
  const profile = payload.profile;
  if (!profile || typeof profile !== "object") {
    HazamaBridgeState.lastError = "missing profile";
    return null;
  }
  return profile;
}

function importHazamaProfile(profile, options = {}) {
  if (!profile || typeof profile !== "object") return false;

  const ucm = profile.ucm && typeof profile.ucm === "object" ? profile.ucm : {};
  const audio = profile.audio && typeof profile.audio === "object" ? profile.audio : {};
  const patterns = profile.patterns && typeof profile.patterns === "object" ? profile.patterns : {};
  const source = profile.source && typeof profile.source === "object" ? profile.source : {};
  const style = sanitizeHazamaStyle(profile.style);
  const importedUcm = {};
  let touchedUcm = false;
  const smoothUpdate = initialized && isPlaying && options.force !== true;

  for (const key of UCM_KEYS) {
    if (typeof ucm[key] !== "number" || !Number.isFinite(ucm[key])) continue;
    const value = Math.round(clampValue(ucm[key], 0, 100));
    UCM_TARGET[key] = value;
    if (!smoothUpdate) {
      UCM_CUR[key] = value;
      UCM[key] = value;
    }
    importedUcm[key] = value;
    syncSliderFromTarget(key);
    touchedUcm = true;
  }

  HazamaBridgeState.active = true;
  HazamaBridgeState.loaded = true;
  HazamaBridgeState.autoFollow = !!isPlaying || HazamaBridgeState.autoFollow;
  HazamaBridgeState.controlPending = false;
  if (isPlaying) HazamaBridgeState.controlAction = "";
  HazamaBridgeState.source = options.source || source.repo || "hazama";
  HazamaBridgeState.name = typeof profile.name === "string" ? profile.name.slice(0, 80) : "hazama";
  HazamaBridgeState.style = style;
  HazamaBridgeState.stage = typeof source.stage === "string" ? source.stage.slice(0, 40) : "";
  HazamaBridgeState.depthId = typeof source.depthId === "string" ? source.depthId.slice(0, 24) : "";
  HazamaBridgeState.stability = clampValue(safeHazamaNumber(source.stability, 0), 0, 100);
  HazamaBridgeState.resonance = clampValue(safeHazamaNumber(source.resonance, 0), 0, 100);
  HazamaBridgeState.marks = clampValue(safeHazamaNumber(source.marks, 0), 0, 100);
  HazamaBridgeState.audio = {
    tempo: normalizeHazamaTempo(audio.tempo),
    density: typeof audio.density === "number" ? clamp01(audio.density) : null,
    brightness: typeof audio.brightness === "number" ? clamp01(audio.brightness) : null,
    silenceRate: typeof audio.silenceRate === "number" ? clamp01(audio.silenceRate) : null,
    bassWeight: typeof audio.bassWeight === "number" ? clamp01(audio.bassWeight) : null,
    harmonicDeviation: typeof audio.harmonicDeviation === "number" ? clamp01(audio.harmonicDeviation) : null,
    smoothing: typeof audio.smoothing === "number" ? clamp01(audio.smoothing) : null,
    droneStability: typeof audio.droneStability === "number" ? clamp01(audio.droneStability) : null,
    space: typeof audio.space === "number" ? clamp01(audio.space) : null
  };
  HazamaBridgeState.baseUcm = Object.fromEntries(UCM_KEYS.map((key) => [key, typeof importedUcm[key] === "number" ? importedUcm[key] : UCM_TARGET[key]]));
  HazamaBridgeState.baseAudio = { ...HazamaBridgeState.audio };
  HazamaBridgeState.patterns = {
    drone: patterns.drone === true,
    droneLayers: typeof patterns.droneLayers === "number" ? clampValue(patterns.droneLayers, 0, 6) : 0,
    glitch: patterns.glitch === true,
    glitchRate: typeof patterns.glitchRate === "number" ? clamp01(patterns.glitchRate) : 0,
    jazzStabs: patterns.jazzStabs === true,
    percussion: patterns.percussion === true,
    gatePulse: patterns.gatePulse === true
  };
  HazamaBridgeState.pending = !initialized || !isPlaying;
  HazamaBridgeState.lastExternalAt = Date.now();
  HazamaBridgeState.lastAutonomyCycle = -1;
  HazamaBridgeState.evolution = {
    air: 0,
    pulse: 0,
    micro: 0,
    bloom: 0
  };
  HazamaBridgeState.importedAt = Date.now();
  HazamaBridgeState.profile = {
    name: HazamaBridgeState.name,
    style: HazamaBridgeState.style,
    source: {
      repo: source.repo || "QuietBriony/hazama",
      depthId: HazamaBridgeState.depthId,
      stage: HazamaBridgeState.stage,
      stability: HazamaBridgeState.stability,
      resonance: HazamaBridgeState.resonance,
      marks: HazamaBridgeState.marks,
      rawInputStored: false
    },
    ucm: Object.fromEntries(UCM_KEYS.map((key) => [key, UCM_TARGET[key]])),
    audio: { ...HazamaBridgeState.audio },
    patterns: { ...HazamaBridgeState.patterns }
  };
  HazamaBridgeState.lastError = "";

  if (style) {
    EngineParams.mode = style;
    lastMode = null;
  }

  if (typeof HazamaBridgeState.audio.smoothing === "number") {
    UCM_SMOOTH_SEC = 0.45 + HazamaBridgeState.audio.smoothing * 2.2;
  }

  if (touchedUcm || options.force) {
    applyUCMToParams({ force: options.force === true });
  }
  updateHazamaUiState();
  updateRuntimeUiState();
  setHazamaStatus(hazamaUiStatusLabel());
  requestHazamaRuntimeFeedback("profile");
  return true;
}

function handleHazamaPayload(payload, options = {}) {
  const profile = profileFromHazamaPayload(payload);
  if (!profile) {
    setHazamaStatus("HAZAMA.ERROR");
    return false;
  }
  return importHazamaProfile(profile, options);
}

function controlFromHazamaPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.type !== "hazama-control") return null;
  if (payload.version !== 1) return null;
  if (payload.provider !== "music") return null;
  if (payload.target !== "music") return null;
  const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";
  if (!["pause", "resume", "stop"].includes(action)) return null;
  return action;
}

function handleHazamaControlPayload(payload, options = {}) {
  const action = controlFromHazamaPayload(payload);
  if (!action) return false;

  HazamaBridgeState.controlAction = action;
  HazamaBridgeState.controlAt = Date.now();
  HazamaBridgeState.controlPending = false;

  if (action === "stop" || action === "pause") {
    HazamaBridgeState.autoFollow = false;
    HazamaBridgeState.pending = HazamaBridgeState.loaded;
    if (action === "stop") HazamaBridgeState.active = false;
    stopPlayback({ source: `hazama-control.${action}`, feedbackKind: action === "stop" ? "control.stop" : "control.pause" });
    updateHazamaUiState();
    setHazamaStatus(hazamaUiStatusLabel());
    return true;
  }

  if (!HazamaBridgeState.loaded) {
    HazamaBridgeState.controlPending = true;
    setHazamaStatus("HAZAMA.PENDING");
    requestHazamaRuntimeFeedback("control.pending");
    return true;
  }

  if (!initialized) {
    HazamaBridgeState.pending = true;
    HazamaBridgeState.controlPending = true;
    setHazamaStatus("HAZAMA.PENDING");
    requestHazamaRuntimeFeedback("control.pending");
    return true;
  }

  startPlayback({ source: options.source || "hazama-control.resume", feedbackKind: "control.resume" });
  return true;
}

function applyPendingHazamaProfileOnStart() {
  if (!HazamaBridgeState.loaded) return false;
  HazamaBridgeState.pending = false;
  HazamaBridgeState.active = true;
  HazamaBridgeState.autoFollow = true;
  HazamaBridgeState.controlPending = false;
  for (const key of UCM_KEYS) {
    if (typeof UCM_TARGET[key] !== "number") continue;
    UCM_CUR[key] = UCM_TARGET[key];
    UCM[key] = Math.round(UCM_CUR[key]);
    syncSliderFromTarget(key);
  }
  applyHazamaProfileToEngineParams({ force: true });
  updateHazamaUiState();
  updateRuntimeUiState();
  setHazamaStatus(hazamaUiStatusLabel());
  requestHazamaRuntimeFeedback("start.hazama");
  return true;
}

function importHazamaFromHash() {
  if (typeof window === "undefined" || !window.location || !window.location.hash) return false;
  const match = window.location.hash.match(/(?:^#|&)hazama=([^&]+)/);
  if (!match) return false;
  setHazamaStatus(hazamaUiStatusLabel() || "HAZAMA.READY");
  const payload = decodeBase64UrlJson(decodeURIComponent(match[1]));
  return handleHazamaPayload(payload, { source: "hash", force: true });
}

function setupHazamaBridge() {
  importHazamaFromHash();

  window.addEventListener("hashchange", () => {
    importHazamaFromHash();
  });

  window.addEventListener("message", (event) => {
    const data = event && event.data;
    if (!isAllowedHazamaOrigin(event.origin)) return;
    if (!data || typeof data !== "object") return;
    if (data.provider !== "music") return;
    if (data.type === "hazama-profile") {
      handleHazamaPayload(data, { source: "postMessage" });
      return;
    }
    if (data.type === "hazama-control") {
      handleHazamaControlPayload(data, { source: "postMessage" });
    }
  });

  window.importHazamaProfile = importHazamaProfile;
  window.handleHazamaControl = handleHazamaControlPayload;
  window.MusicHazamaBridge = {
    importProfile: importHazamaProfile,
    handleControl: handleHazamaControlPayload,
    getState: () => ({
      loaded: HazamaBridgeState.loaded,
      active: HazamaBridgeState.active,
      autoFollow: hazamaAutoFollowActive(),
      pending: HazamaBridgeState.pending,
      connectionState: hazamaConnectionState(),
      controlAction: HazamaBridgeState.controlAction,
      stage: HazamaBridgeState.stage,
      depthId: HazamaBridgeState.depthId
    })
  };
}

function hazamaBaseValue(key) {
  const base = HazamaBridgeState.baseUcm || {};
  const value = typeof base[key] === "number" ? base[key] : UCM_TARGET[key];
  return clampValue(value, 0, 100);
}

function hazamaIdleAutonomyAmount() {
  const lastExternalAt = HazamaBridgeState.lastExternalAt || Date.now();
  const idleSec = Math.max(0, (Date.now() - lastExternalAt) / 1000);
  return clampValue(0.28 + idleSec / 30, 0.28, 0.88);
}

function advanceHazamaAutonomy() {
  if (!HazamaBridgeState.active || !HazamaBridgeState.loaded || !isPlaying) return;
  if (HazamaBridgeState.lastAutonomyCycle === GrooveState.cycle) return;

  HazamaBridgeState.lastAutonomyCycle = GrooveState.cycle;

  const cycle = GrooveState.cycle + 1;
  const phase = fractionalPart(cycle * GOLDEN_RATIO_INVERSE + HazamaBridgeState.autonomyGeneration * 0.037);
  const slow = Math.sin(cycle * 0.17 + phase * Math.PI * 2);
  const deep = Math.sin(cycle * 0.041 + HazamaBridgeState.autonomyGeneration * 0.61);
  const shimmer = Math.sin(cycle * 0.29 + 1.7);
  const idle = hazamaIdleAutonomyAmount();
  const stability = clampValue(HazamaBridgeState.stability / 100, 0, 1);
  const resonance = clampValue(HazamaBridgeState.resonance / 100, 0, 1);
  const marks = clampValue(HazamaBridgeState.marks / 100, 0, 1);
  const stage = HazamaBridgeState.stage || "";
  const stageOpen = stage === "submerge" || stage === "exhale" ? 0.18 : 0.05;
  const stagePulse = stage === "root" || stage === "ferment" ? 0.16 : 0.04;
  const baseAudio = HazamaBridgeState.baseAudio || {};

  const base = {
    energy: hazamaBaseValue("energy") / 100,
    wave: hazamaBaseValue("wave") / 100,
    mind: hazamaBaseValue("mind") / 100,
    creation: hazamaBaseValue("creation") / 100,
    void: hazamaBaseValue("void") / 100,
    circle: hazamaBaseValue("circle") / 100,
    body: hazamaBaseValue("body") / 100,
    resource: hazamaBaseValue("resource") / 100,
    observer: hazamaBaseValue("observer") / 100
  };

  const air = clampValue(base.void * 0.28 + base.observer * 0.24 + base.circle * 0.18 + stageOpen + phase * 0.16 + stability * 0.06, 0, 1);
  const pulse = clampValue(base.energy * 0.22 + base.body * 0.2 + base.resource * 0.14 + stagePulse + (1 - stability) * 0.08 + (slow + 1) * 0.07, 0, 1);
  const micro = clampValue(base.creation * 0.24 + base.wave * 0.22 + base.resource * 0.18 + marks * 0.12 + (shimmer + 1) * 0.08, 0, 1);
  const bloom = clampValue(base.mind * 0.18 + base.circle * 0.18 + base.observer * 0.2 + resonance * 0.12 + (deep + 1) * 0.07, 0, 1);

  HazamaBridgeState.evolution = { air, pulse, micro, bloom };
  if (phase < 0.12) HazamaBridgeState.autonomyGeneration += 1;

  const depth = idle * (0.72 + (1 - stability) * 0.18 + marks * 0.12);
  const targets = {
    energy: hazamaBaseValue("energy") + (pulse * 18 - air * 7 + slow * 5) * depth,
    wave: hazamaBaseValue("wave") + (air * 9 + micro * 7 + shimmer * 6) * depth,
    mind: hazamaBaseValue("mind") + (bloom * 9 + phase * 6 - pulse * 2) * depth,
    creation: hazamaBaseValue("creation") + (micro * 17 + bloom * 5 + shimmer * 4) * depth,
    void: hazamaBaseValue("void") + (air * 13 - pulse * 5 + deep * 4) * depth,
    circle: hazamaBaseValue("circle") + (bloom * 9 + air * 5 - micro * 2) * depth,
    body: hazamaBaseValue("body") + (pulse * 9 + deep * 4 - air * 3) * depth,
    resource: hazamaBaseValue("resource") + (micro * 14 + pulse * 5 - air * 3) * depth,
    observer: hazamaBaseValue("observer") + (air * 12 + bloom * 7 + phase * 4) * depth
  };

  for (const key of UCM_KEYS) {
    UCM_TARGET[key] = approachValue(UCM_TARGET[key], clampValue(targets[key], 0, 100), 1.1 + depth * 1.9);
  }

  const baseTempo = typeof baseAudio.tempo === "number" ? baseAudio.tempo : EngineParams.bpm;
  const baseDensity = typeof baseAudio.density === "number" ? baseAudio.density : 0.24;
  const baseBrightness = typeof baseAudio.brightness === "number" ? baseAudio.brightness : 0.34;
  const baseSilence = typeof baseAudio.silenceRate === "number" ? baseAudio.silenceRate : 0.28;
  const baseBass = typeof baseAudio.bassWeight === "number" ? baseAudio.bassWeight : 0.32;
  const baseDeviation = typeof baseAudio.harmonicDeviation === "number" ? baseAudio.harmonicDeviation : 0.08;

  HazamaBridgeState.audio.tempo = clampValue(baseTempo + (pulse * 15 + micro * 8 - air * 6 + slow * 4) * depth, 54, 152);
  HazamaBridgeState.audio.density = clamp01(baseDensity + (pulse * 0.13 + micro * 0.09 - air * 0.04) * depth);
  HazamaBridgeState.audio.brightness = clamp01(baseBrightness + (air * 0.08 + micro * 0.08 + bloom * 0.04) * depth);
  HazamaBridgeState.audio.silenceRate = clamp01(baseSilence - (pulse * 0.14 + micro * 0.08) * depth + air * 0.035);
  HazamaBridgeState.audio.bassWeight = clamp01(baseBass + (pulse * 0.06 - air * 0.035) * depth);
  HazamaBridgeState.audio.harmonicDeviation = clamp01(baseDeviation + (micro * 0.08 + bloom * 0.05) * depth);

  if (typeof document !== "undefined" && document.visibilityState !== "hidden" && GrooveState.cycle % 4 === 0) {
    for (const key of UCM_KEYS) syncSliderFromTarget(key);
  }
}

function syncHazamaTransportControls(step) {
  if (!HazamaBridgeState.active || !HazamaBridgeState.loaded || !isPlaying) return;
  syncTransportControlValues(step, step === 0 ? 2.4 : 1.25, "Hazama");
}

function autoMixUiSyncAllowed(step) {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return false;
  return step % 4 === 0;
}

function syncAutoMixTransportControls(step) {
  if (!UCM.auto.enabled || !isPlaying || HazamaBridgeState.active) return;
  syncTransportControlValues(step, step === 0 ? 2.1 : 1.05, "AutoMix");
}

// v196: section development for genre-locked modes. A genre pill turns AUTOMIX
// off and freezes the 9 UCM params, so the section system (which rides the
// AUTOMIX path) never reached genre modes. fm.js hands the engine the genre's
// UCM baseline; here the section gently breathes the macro params around it.
// `energy` is held exactly at the baseline so chooseMode()'s energy band — and
// thus the genre/mode/tempo identity — never shifts; the other 8 params move
// by GENRE_SECTION_SCALE across the section form.
function syncGenreModeSectionControls(step) {
  if (step % TRANSPORT_CONTROL_SYNC_STEPS !== 0) return;
  if (UCM.auto.enabled || !isPlaying || HazamaBridgeState.active) return;
  const baseline = GenreSectionState.baseline;
  if (!baseline || !SectionState.started) return;
  const now = performanceNowMs();
  for (const key of AUTOMIX_MOTION_KEYS) {
    const base = baseline[key];
    if (typeof base !== "number") continue;
    if (isManualInfluenceActive(key, now)) continue;
    let delta = 0;
    if (key !== "energy") {
      const sectionTarget = sectionMacroTarget(key);
      const center = SECTION_FORM_CENTER[key];
      if (sectionTarget != null && typeof center === "number") {
        delta = (sectionTarget - center) * GENRE_SECTION_SCALE;
      }
    }
    UCM_TARGET[key] = clampValue(base + delta, 4, 96);
  }
  syncTransportControlValues(step, step === 0 ? 1.4 : 0.85, "GenreSection");
}

// v196: fm.js calls this when a genre pill is applied — `faders` is the
// genre's UCM profile (the locked baseline), or null for ANY.
function setGenreSectionBaseline(faders) {
  if (!faders || typeof faders !== "object") {
    GenreSectionState.baseline = null;
    return;
  }
  const snap = {};
  for (const key of AUTOMIX_MOTION_KEYS) {
    const v = Number(faders[key]);
    if (Number.isFinite(v)) snap[key] = clampValue(v, 0, 100);
  }
  GenreSectionState.baseline = Object.keys(snap).length === AUTOMIX_MOTION_KEYS.length ? snap : null;
}
if (typeof window !== "undefined") window.setMusicGenreSectionBaseline = setGenreSectionBaseline;

function syncTransportControlValues(step, maxStep, label) {
  if (step % TRANSPORT_CONTROL_SYNC_STEPS !== 0) return;

  for (const key of UCM_KEYS) {
    UCM_CUR[key] = approachValue(UCM_CUR[key], UCM_TARGET[key], maxStep);
    UCM[key] = Math.round(UCM_CUR[key]);
  }

  try {
    applyUCMToParams();
  } catch (error) {
    console.warn(`[Music] ${label} transport control failed:`, error);
  }
}

function advanceAutoMixTransport(step) {
  if (!UCM.auto.enabled || !isPlaying) return;
  if (UCM.auto.lastTransportStep === stepIndex) return;
  UCM.auto.lastTransportStep = stepIndex;

  const cycleMs = Math.max(30000, UCM.auto.cycleMs || 180000);
  const bpm = Math.max(40, Math.min(180, DJTempoState.bpm || EngineParams.bpm || 80));
  const eighthNoteMs = 30000 / bpm;
  advanceAlbumArcTransport(eighthNoteMs);
  const phaseDelta = eighthNoteMs / cycleMs;
  updateAutoMixTargets(cycleMs, {
    phaseDelta,
    syncUi: autoMixUiSyncAllowed(step)
  });
  syncAutoMixTransportControls(step);
}

function syncAutoSlidersFromCurrent(now) {
  if (!UCM.auto.enabled || !isPlaying) return;
  if (now - autoSliderLastSyncAt < AUTO_SLIDER_SYNC_INTERVAL_MS) return;

  autoSliderLastSyncAt = now;
  for (const key of UCM_KEYS) {
    syncSliderValue(key, UCM_CUR[key]);
  }
  updateUIFromParams();
}

function updateRuntimeUiState() {
  if (!document.body) return;
  document.body.dataset.playing = isPlaying ? "true" : "false";
  document.body.dataset.auto = UCM.auto.enabled ? "true" : "false";
  updateAlbumArcUi();
  updateCultureGrammarUi();
  updateOddLogicUi();
  updateHeaderRuntimeUi();
  publishMusicRuntimeState();
}

function syncMusicAudioAdapterFromUCM(force = false) {
  const now = typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

  if (!force && now - namimaAdapterLastSentAt < NAMIMA_ADAPTER_UPDATE_INTERVAL_MS) return;

  const energy = clampValue(UCM_CUR.energy / 100, 0, 1);
  const mode = EngineParams.mode;
  const shouldSendEnergy =
    force ||
    namimaAdapterLastEnergy === null ||
    Math.abs(energy - namimaAdapterLastEnergy) >= NAMIMA_ADAPTER_ENERGY_DELTA;
  const shouldSendMode = force || namimaAdapterLastMode !== mode;

  if (!shouldSendEnergy && !shouldSendMode) return;
  namimaAdapterLastSentAt = now;

  if (shouldSendEnergy) {
    safeCallMusicAudioAdapter("updateEnergy", energy);
    namimaAdapterLastEnergy = energy;
  }

  if (shouldSendMode) {
    safeCallMusicAudioAdapter("updateStyle", mode);
    namimaAdapterLastMode = mode;
  }
}

function mapValue(x, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (x - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function rand(prob) {
  return Math.random() < prob;
}

function chance(value) {
  return clampValue(value, 0, 1);
}

const HAZAMA_FM_ENGINE_MIX_DEFAULT = {
  engineGain: 0.8,
  drumBus: 0.8,
  padBus: 0.84,
  bassBus: 0.66,
  textureBus: 0.19,
  reverbWet: 0.31,
  delayWet: 0.21,
  padDb: 0,
  glassDb: 0,
  textureDb: 0,
  pianoMemoryDb: 0,
  voiceDustDb: 0,
  drumSkinDb: 0,
  subImpactDb: 0,
  reedBuzzDb: 0,
  kickDb: 0,
  hatDb: 0
};

const HAZAMA_FM_ENGINE_MIXES = {
  any: { engineGain: 0.78, padDb: -1.2, glassDb: -1.2, pianoMemoryDb: -1.2, voiceDustDb: -1.2 },
  // fm-57: デフォルト = lofi (UCM energy 40) で最適音になるよう全 voice を磨く
  // - glass / voiceDust / texture を更に下げて Salamander piano (v113) を前面に
  // - pianoMemory はやや残す (Salamander の echo として効く)
  // - ambient の texture も -3.5 → -6 にして noise 減らす
  ambient: { engineGain: 0.74, padBus: 0.65, reverbWet: 0.32, delayWet: 0.16, glassDb: -10, voiceDustDb: -12, textureDb: -6, hatDb: -8, kickDb: -5 },
  lofi: { engineGain: 0.66, padBus: 0.30, reverbWet: 0.22, delayWet: 0.14, padDb: -16, glassDb: -16, pianoMemoryDb: -22, voiceDustDb: -16, textureDb: -10, hatDb: -8 },
  jazz: { engineGain: 0.60, padBus: 0.22, reverbWet: 0.20, delayWet: 0.12, padDb: -13, glassDb: -14, pianoMemoryDb: -9, voiceDustDb: -14, textureDb: -8, hatDb: -7 },
  funk: { engineGain: 0.60, padBus: 0.18, reverbWet: 0.16, delayWet: 0.10, padDb: -14, glassDb: -14, pianoMemoryDb: -14, voiceDustDb: -14, textureDb: -7, hatDb: -6 },
  techno: { engineGain: 0.48, drumBus: 0.30, padBus: 0.014, bassBus: 0.28, textureBus: 0.07, reverbWet: 0.05, delayWet: 0.04, padDb: -38, glassDb: -42, textureDb: -14, pianoMemoryDb: -42, voiceDustDb: -42, drumSkinDb: -11, reedBuzzDb: -38, hatDb: -32, kickDb: -7 },
  piano: { engineGain: 0.42, drumBus: 0.04, padBus: 0.012, bassBus: 0.08, textureBus: 0.025, reverbWet: 0.06, delayWet: 0.04, padDb: -40, glassDb: -46, textureDb: -24, pianoMemoryDb: -38, voiceDustDb: -46, drumSkinDb: -28, subImpactDb: -20, reedBuzzDb: -42, hatDb: -36, kickDb: -26 }
};

function hazamaFmRuntimeGenre() {
  if (typeof document === "undefined" || document.body?.dataset?.page !== "fm") return null;
  if (typeof window !== "undefined" && window.GenreFlavor) {
    try {
      const genre = window.GenreFlavor.state?.genre;
      if (genre && HAZAMA_FM_ENGINE_MIXES[genre]) return genre;
    } catch (error) {}
  }
  const active = document.querySelector?.("#fm-genre button[aria-pressed='true']");
  const genre = active?.dataset?.genre;
  return HAZAMA_FM_ENGINE_MIXES[genre] ? genre : null;
}

function hazamaFmEngineMix() {
  const genre = hazamaFmRuntimeGenre();
  if (!genre) return HAZAMA_FM_ENGINE_MIX_DEFAULT;
  return {
    ...HAZAMA_FM_ENGINE_MIX_DEFAULT,
    ...HAZAMA_FM_ENGINE_MIXES[genre],
    genre
  };
}

function approachValue(current, target, maxStep) {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

/* =========================================================
   2. Tone.js 構成（軽量版）
========================================================= */

// マスター処理（少なめ）
// fm-55: cross-app mastering polish — band-room の v66 と同じ系統で、
// gentle compressor + StereoWidener を masterGain と masterLimiter の間に
// 挿入。conservative settings (threshold -10 / ratio 2.0 / width 0.62) で
// 既存ミックスバランスを大きく崩さず音圧感と横方向を底上げ。
const masterLimiter = new Tone.Limiter({ threshold: -0.8 });
const hardwareOutput = new Tone.Gain(1).toDestination();
const masterComp = new Tone.Compressor({ threshold: -10, ratio: 2.0, attack: 0.012, release: 0.18, knee: 6 });
const masterWidener = new Tone.StereoWidener(0.62);
const focusModGain = new Tone.Gain(1);
const masterGain    = new Tone.Gain(0.8);
masterGain.connect(masterComp);
masterComp.connect(masterWidener);
masterWidener.connect(focusModGain);
focusModGain.connect(masterLimiter);
const recorderDestination = Tone.context.createMediaStreamDestination();
const backgroundPlaybackDestination = Tone.context.createMediaStreamDestination();
masterLimiter.connect(hardwareOutput);
try {
  masterLimiter.connect(recorderDestination);
} catch (error) {
  console.warn("[Music] recorder tap unavailable:", error);
}
try {
  masterLimiter.connect(backgroundPlaybackDestination);
} catch (error) {
  console.warn("[Music] background playback tap unavailable:", error);
}
try {
  selfReviewMeter = new Tone.Meter({ normalRange: true });
  masterLimiter.connect(selfReviewMeter);
} catch (error) {
  console.warn("[Music] self-listening meter unavailable:", error);
}

// 40 Hz focus modulation cluster extracted to audio/music-focus-modulation.js (BL-008)
const {
  refresh: refreshFocusModulation,
  setEnabled: setFmFocusModeEnabled,
  getState: getFmFocusModeState
} = window.MusicFocusModulation;

if (typeof window !== "undefined") {
  window.setFmFocusModeEnabled = setFmFocusModeEnabled;
  window.getFmFocusModeState = getFmFocusModeState;
}

// シンプルなリバーブ＆ディレイのみ
// v194: decay is FIXED here, never reassigned per mode. updateSoundForMode
// used to set globalReverb.decay every mode change — and Tone.Reverb.decay is
// a setter that re-renders the impulse response through an OfflineAudioContext,
// a synchronous CPU spike that choked the audio (~every 60-90s as the radio
// brain rotates modes). Per-mode reverb character now comes from `wet` alone.
const globalReverb = new Tone.Reverb({
  decay: 4.3,
  wet: 0.31,
}).connect(masterGain);

const globalDelay = new Tone.PingPongDelay({
  delayTime: "8n",
  feedback: 0.32,
  wet: 0.21,
}).connect(masterGain);

// バス
const drumBus = new Tone.Gain(0.8).connect(globalReverb);
const padBus  = new Tone.Gain(0.84).connect(globalReverb);
const bassBus = new Tone.Gain(0.66).connect(globalDelay);
const textureBus = new Tone.Gain(0.19).connect(globalDelay);

// ===== 楽器（3+1に絞る） =====

// Kick（ベーシック）
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.018,
  octaves: 3.7,
  oscillator: { type: "sine" },
  envelope: { attack: 0.006, decay: 0.26, sustain: 0 }
}).connect(drumBus);

// Hat（1台だけ）
const hat = new Tone.MetalSynth({
  frequency: 300,
  envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
  harmonicity: 5,
  modulationIndex: 32,
  resonance: 2500
}).connect(drumBus);

// Bass（単純なMono）
const bass = new Tone.MonoSynth({
  oscillator: { type: "square" },
  filter: { type: "lowpass", Q: 0.82 },
  filterEnvelope: {
    attack: 0.014, decay: 0.22, sustain: 0.08, release: 0.34,
    baseFrequency: 72, octaves: 1.65
  },
  envelope: { attack: 0.012, decay: 0.24, sustain: 0.24, release: 0.42 }
}).connect(bassBus);

// Pad（PolySynth だけ残す）
const padFilter = new Tone.Filter(1000, "lowpass").connect(padBus);
const pad = new Tone.PolySynth({
  voice: Tone.Synth,
  // BL-022: capped from 64. The pad fires 1n/2n haze chords with a
  // multi-second release from ~20 trigger paths; an over-generous ceiling
  // let voices pile up and spike CPU on simultaneous onsets. 24 bounds the
  // load — an overflow steals the oldest (deep-decay, inaudible) voice.
  maxPolyphony: 24,
  options: {
    oscillator: { type: "triangle" },
    // v191: fallback envelope for modes without a updateSoundForMode branch
    // (funk / piano). Shortened from attack 1.2 / release 3.5 — a 1.2s swell
    // plus 3.5s tail smeared every chord into formless wash ("もっさり").
    // 0.4 / 2.0 lets each chord articulate while staying soft.
    envelope: { attack: 0.4, decay: 0.7, sustain: 0.7, release: 2.0 }
  }
}).connect(padFilter);

// fm-56: lofi mode で synth pad の上に重ねる Salamander Grand Piano (CC-BY 3.0)
// — band-room の lofi/Nujabes preset と整合させるための実音源 chord 担当
// fm-60: catalog 経由化 — band-room と同じ presets/online-samples-catalog.json
// を engine.js でも参照する。これにより jazz / ambient mode も catalog 経由
// で実 sample 化できる (band-room v97-v111 と整合)。
let hazamaFmCatalog = null;
let hazamaFmCatalogPromise = null;
function loadHazamaFmCatalog() {
  if (hazamaFmCatalog) return Promise.resolve(hazamaFmCatalog);
  if (hazamaFmCatalogPromise) return hazamaFmCatalogPromise;
  hazamaFmCatalogPromise = fetch("presets/online-samples-catalog.json")
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { hazamaFmCatalog = data; return data; })
    .catch((err) => { console.warn("[Music] catalog fetch failed:", err); return null; });
  return hazamaFmCatalogPromise;
}
// fm-71: runtime catalog override — Music Core Rig (index.html) ships a
// <select id="catalog-select"> that lets the user pick a specific kit or
// instrument from online-samples-catalog.json. When set, every catalogKit() /
// catalogInstrument() call returns the override instead of the requested id.
// Default = null = AUTO (original band/mode bindings). Only one override at a
// time, narrowed by kind so a "kit" override doesn't poison instrument lookups
// (and vice versa).
const CatalogOverride = { kind: null, id: null };

function catalogInstrument(id) {
  if (CatalogOverride.kind === "instrument" && CatalogOverride.id) {
    const o = hazamaFmCatalog?.instruments?.find((i) => i.id === CatalogOverride.id);
    if (o) return o;
  }
  return hazamaFmCatalog?.instruments?.find((i) => i.id === id) || null;
}
function catalogKit(id) {
  if (CatalogOverride.kind === "kit" && CatalogOverride.id) {
    const o = hazamaFmCatalog?.kits?.find((k) => k.id === CatalogOverride.id);
    if (o) return o;
  }
  return hazamaFmCatalog?.kits?.find((k) => k.id === id) || null;
}
// fm-60: 触ってない mode は手付かず、jazz だけ catalog 経由で実楽器化試行
const FM_MODE_BINDINGS = {
  jazz: {
    chord_instrument: "salamander-piano",      // Tone.js Salamander piano
    lead_instrument: "guitar-nylon",           // nbrosowsky nylon guitar
    drum_kit_id: "tone-acoustic"               // tonejs.github.io acoustic kit
  },
  ambient: {
    // ambient = harp texture + cello sustained lead, drum 無し
    texture_instrument: "harp",
    lead_instrument: "cello"
  },
  dub: {
    // dub = electric bass の deep echo + organ の sustained chord
    bass_instrument: "bass-electric",
    chord_instrument: "organ"
  }
};

// kick the catalog fetch as soon as engine boots
loadHazamaFmCatalog();

// fm-60: jazz mode 用の sampler + drum layer (lofi と並列構造で実装)
let jazzPianoSampler = null;
let jazzPianoSchedId = null;
let jazzGuitarSampler = null;
let jazzDrumSamples = null;
let jazzDrumSchedId = null;

function ensureJazzPiano() {
  if (jazzPianoSampler) return jazzPianoSampler;
  const inst = catalogInstrument("salamander-piano");
  if (!inst) return null;
  const urls = {};
  Object.entries(inst.notes).forEach(([n, p]) => { urls[n] = inst.base_url + p; });
  try {
    jazzPianoSampler = new Tone.Sampler({ urls, release: 1.2, volume: -8 }).connect(padFilter);
  } catch (e) {
    console.warn("[Music] jazz piano init failed:", e);
    jazzPianoSampler = null;
  }
  return jazzPianoSampler;
}
function ensureJazzGuitar() {
  if (jazzGuitarSampler) return jazzGuitarSampler;
  const inst = catalogInstrument("guitar-nylon");
  if (!inst) return null;
  const urls = {};
  Object.entries(inst.notes).forEach(([n, p]) => { urls[n] = inst.base_url + p; });
  try {
    // jazz lead = soft nylon guitar through globalDelay (light echo for solo lines)
    jazzGuitarSampler = new Tone.Sampler({ urls, release: 0.6, volume: -10 }).connect(globalDelay);
  } catch (e) {
    console.warn("[Music] jazz guitar init failed:", e);
    jazzGuitarSampler = null;
  }
  return jazzGuitarSampler;
}
function ensureJazzDrumKit() {
  if (jazzDrumSamples) return jazzDrumSamples;
  const kit = catalogKit("tone-acoustic");
  if (!kit) return null;
  try {
    jazzDrumSamples = {
      kick:  new Tone.Player({ url: kit.base_url + kit.voices.kick,  autostart: false, volume: -6 }).connect(drumBus),
      snare: new Tone.Player({ url: kit.base_url + kit.voices.snare, autostart: false, volume: -7 }).connect(drumBus),
      hat:   new Tone.Player({ url: kit.base_url + kit.voices.hat,   autostart: false, volume: -16 }).connect(drumBus)
    };
  } catch (e) {
    console.warn("[Music] jazz drum kit init failed:", e);
    jazzDrumSamples = null;
  }
  return jazzDrumSamples;
}
function startJazzPianoLayer() {
  stopJazzPianoLayer();
  const sampler = ensureJazzPiano();
  if (!sampler) return;
  // Jazz comp: 2 小節ごとに chord + delayed accent (lofi より速いペース)
  jazzPianoSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      const ch = typeof randomHazeChord === "function" ? randomHazeChord() : ["C4","E4","G4"];
      sampler.triggerAttackRelease(ch, "2n", time + 0.02, 0.40);
      // anticipated comp
      sampler.triggerAttackRelease(ch[0], "4n", time + 2.5 * Tone.Time("4n").toSeconds(), 0.28);
    } catch (e) {}
  }, "2m");
}
function stopJazzPianoLayer() {
  if (jazzPianoSchedId != null) {
    try { Tone.Transport.clear(jazzPianoSchedId); } catch (e) {}
    jazzPianoSchedId = null;
  }
}
function startJazzDrumLayer() {
  stopJazzDrumLayer();
  const samples = ensureJazzDrumKit();
  if (!samples) return;
  // Brushed jazz: kick on 1 (soft), snare brush on 2/4, hat 8th (lighter)
  // fm-70: jazz kick/snare base volumes captured here so mic-follow can
  // modulate them per-bar without drifting.
  const jazzBaseKickDb = samples.kick.volume.value;
  const jazzBaseSnareDb = samples.snare.volume.value;
  const jazzBaseHatDb = samples.hat.volume.value;
  jazzDrumSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      // fm-71: while an AI fill burst is active, skip the canned jazz drum
      // bar — the engine's kick/hat (driven by Magenta) carry the bar
      // instead, so we don't double-trigger backbeat snares.
      if (typeof window !== "undefined" && window.FmAiFill && window.FmAiFill.status.active) return;
      const bt = Tone.Time("4n").toSeconds();
      const e8 = bt / 2;
      // fm-69: Dilla per-step microOffsets (mode-fixed). jazz = light Dilla.
      const dilla = FM_MODE_DILLA_OFFSETS[EngineParams.mode] || FM_DILLA_OFFSETS_ZERO;
      const snareSec = (dilla.snareBack || 0) / 1000;
      const hatOffSec = (dilla.hatOffPush || 0) / 1000;
      // fm-70: drum-floor follows the player. Bias jazz kit volume by the
      // mic-follow dB delta sampled at bar start. Tone.Player.start() has no
      // velocity arg so this is the cleanest way to "play harder" with the
      // performer. Defaults to 0 dB when mic is off.
      const micDb = fmMicFollowDbDelta();
      samples.kick.volume.value = jazzBaseKickDb + micDb;
      samples.snare.volume.value = jazzBaseSnareDb + micDb;
      samples.hat.volume.value = jazzBaseHatDb + micDb * 0.7;  // hats follow lighter
      samples.kick.start(time);
      samples.snare.start(time + bt + snareSec);       // backbeat 2 dragged back
      samples.snare.start(time + 3 * bt + snareSec);   // backbeat 4 dragged back
      for (let h = 0; h < 8; h++) {
        // odd h = offbeat (between quarter notes) → push by hatOffPush
        const hOff = (h % 2 === 1) ? hatOffSec : 0;
        samples.hat.start(time + h * e8 + hOff);
      }
    } catch (e) {}
  }, "1m");
}
function stopJazzDrumLayer() {
  if (jazzDrumSchedId != null) {
    try { Tone.Transport.clear(jazzDrumSchedId); } catch (e) {}
    jazzDrumSchedId = null;
  }
}

// fm-61: ambient mode 用の harp texture + cello lead
let ambientHarpSampler = null;
let ambientHarpSchedId = null;
let ambientCelloSampler = null;
let ambientCelloSchedId = null;
function ensureAmbientHarp() {
  if (ambientHarpSampler) return ambientHarpSampler;
  const inst = catalogInstrument("harp");
  if (!inst) return null;
  const urls = {};
  Object.entries(inst.notes).forEach(([n, p]) => { urls[n] = inst.base_url + p; });
  try {
    ambientHarpSampler = new Tone.Sampler({ urls, release: 3.0, volume: -14 }).connect(padBus);
  } catch (e) {
    console.warn("[Music] ambient harp init failed:", e);
    ambientHarpSampler = null;
  }
  return ambientHarpSampler;
}
function ensureAmbientCello() {
  if (ambientCelloSampler) return ambientCelloSampler;
  const inst = catalogInstrument("cello");
  if (!inst) return null;
  const urls = {};
  Object.entries(inst.notes).forEach(([n, p]) => { urls[n] = inst.base_url + p; });
  try {
    ambientCelloSampler = new Tone.Sampler({ urls, release: 2.4, volume: -12 }).connect(padBus);
  } catch (e) {
    console.warn("[Music] ambient cello init failed:", e);
    ambientCelloSampler = null;
  }
  return ambientCelloSampler;
}
function startAmbientHarpLayer() {
  stopAmbientHarpLayer();
  const sampler = ensureAmbientHarp();
  if (!sampler) return;
  // 4 小節ごとに 1 つの note を gentle に — harp は texture でいいので疎に
  ambientHarpSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      const ch = typeof randomHazeChord === "function" ? randomHazeChord() : ["C4","E4","G4"];
      const note = ch[Math.floor(Math.random() * ch.length)];
      sampler.triggerAttackRelease(note, "1n", time + Math.random() * 0.4, 0.30);
    } catch (e) {}
  }, "4m");
}
function stopAmbientHarpLayer() {
  if (ambientHarpSchedId != null) {
    try { Tone.Transport.clear(ambientHarpSchedId); } catch (e) {}
    ambientHarpSchedId = null;
  }
}
function startAmbientCelloLayer() {
  stopAmbientCelloLayer();
  const sampler = ensureAmbientCello();
  if (!sampler) return;
  // 2 小節ごとに sustained chord (cello で長い uhng)
  ambientCelloSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      const ch = typeof randomHazeChord === "function" ? randomHazeChord() : ["C3","E3","G3"];
      // root + 5th only for cello (low register fat sound)
      const notes = [ch[0], ch[Math.min(2, ch.length - 1)]];
      sampler.triggerAttackRelease(notes, "2m", time + 0.05, 0.40);
    } catch (e) {}
  }, "2m");
}
function stopAmbientCelloLayer() {
  if (ambientCelloSchedId != null) {
    try { Tone.Transport.clear(ambientCelloSchedId); } catch (e) {}
    ambientCelloSchedId = null;
  }
}

// fm-61: dub mode 用の electric bass deep echo + organ sustained chord
let dubBassSampler = null;
let dubBassSchedId = null;
let dubOrganSampler = null;
let dubOrganSchedId = null;
function ensureDubBass() {
  if (dubBassSampler) return dubBassSampler;
  const inst = catalogInstrument("bass-electric");
  if (!inst) return null;
  const urls = {};
  Object.entries(inst.notes).forEach(([n, p]) => { urls[n] = inst.base_url + p; });
  try {
    // dub bass は heavy delay 経由 (globalDelay で echo 強調)
    dubBassSampler = new Tone.Sampler({ urls, release: 0.6, volume: -4 }).connect(bassBus);
  } catch (e) {
    console.warn("[Music] dub bass init failed:", e);
    dubBassSampler = null;
  }
  return dubBassSampler;
}
function ensureDubOrgan() {
  if (dubOrganSampler) return dubOrganSampler;
  const inst = catalogInstrument("organ");
  if (!inst) return null;
  const urls = {};
  Object.entries(inst.notes).forEach(([n, p]) => { urls[n] = inst.base_url + p; });
  try {
    dubOrganSampler = new Tone.Sampler({ urls, release: 1.5, volume: -14 }).connect(padFilter);
  } catch (e) {
    console.warn("[Music] dub organ init failed:", e);
    dubOrganSampler = null;
  }
  return dubOrganSampler;
}
function startDubBassLayer() {
  stopDubBassLayer();
  const sampler = ensureDubBass();
  if (!sampler) return;
  // dub bass follows the shared bassline director instead of a fixed root/octave bar.
  dubBassSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      triggerSamplerBasslineBar(sampler, time, {
        baseVelocity: 0.66,
        maxVelocity: 0.76,
        maxEvents: 4,
        register: "sub",
        fallbackDuration: "4n"
      });
    } catch (e) {}
  }, "1m");
}
function stopDubBassLayer() {
  if (dubBassSchedId != null) {
    try { Tone.Transport.clear(dubBassSchedId); } catch (e) {}
    dubBassSchedId = null;
  }
}
function startDubOrganLayer() {
  stopDubOrganLayer();
  const sampler = ensureDubOrgan();
  if (!sampler) return;
  // 4 小節ごとに sustained organ chord (dub の anchor)
  dubOrganSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      const ch = typeof randomHazeChord === "function" ? randomHazeChord() : ["C3","E3","G3"];
      sampler.triggerAttackRelease(ch, "4m", time + 0.05, 0.30);
    } catch (e) {}
  }, "4m");
}
function stopDubOrganLayer() {
  if (dubOrganSchedId != null) {
    try { Tone.Transport.clear(dubOrganSchedId); } catch (e) {}
    dubOrganSchedId = null;
  }
}

let lofiPianoSampler = null;
let lofiPianoSchedId = null;
function ensureLofiPianoSampler() {
  if (lofiPianoSampler) return lofiPianoSampler;
  const base = "https://tonejs.github.io/audio/salamander";
  // Note: Tone.Sampler は note 名 "D#1" 形式を受け取る、URL は "Ds1.mp3" 形式
  const noteMap = {
    "A0":"A0","C1":"C1","D#1":"Ds1","F#1":"Fs1","A1":"A1",
    "C2":"C2","D#2":"Ds2","F#2":"Fs2","A2":"A2",
    "C3":"C3","D#3":"Ds3","F#3":"Fs3","A3":"A3",
    "C4":"C4","D#4":"Ds4","F#4":"Fs4","A4":"A4",
    "C5":"C5","D#5":"Ds5","F#5":"Fs5","A5":"A5",
    "C6":"C6","D#6":"Ds6","F#6":"Fs6","A6":"A6",
    "C7":"C7","D#7":"Ds7","F#7":"Fs7","A7":"A7","C8":"C8"
  };
  const urls = {};
  Object.entries(noteMap).forEach(([note, file]) => {
    urls[note] = `${base}/${file}.mp3`;
  });
  try {
    // fm-57: volume を -10 dB に下げて mix の中に納まるレベルに。
    // release を 2.0 に延ばして lofi のレジトーンを長く
    lofiPianoSampler = new Tone.Sampler({
      urls, release: 2.0, volume: -10
    }).connect(padFilter);
  } catch (e) {
    console.warn("[Music] lofi piano sampler init failed:", e);
    lofiPianoSampler = null;
  }
  return lofiPianoSampler;
}
function startLofiPianoLayer() {
  stopLofiPianoLayer();
  const sampler = ensureLofiPianoSampler();
  if (!sampler) return;
  // fm-57: 1 小節 1 コードではなく、毎 2 小節に 1 コード stab + 1 拍遅れて 7th を
  // ピアノっぽい comp。動きを少し作って "ノイズで覆う lofi" 卒業
  lofiPianoSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      const ch = typeof randomHazeChord === "function" ? randomHazeChord() : ["C4","E4","G4"];
      // 1 拍目: 全 chord notes
      sampler.triggerAttackRelease(ch, "2n", time + 0.02, 0.45);
      // 2.5 拍目に anticipated comp (chord tone のうち 1 つだけ)
      const accentNote = ch[Math.floor(Math.random() * ch.length)];
      sampler.triggerAttackRelease(accentNote, "4n", time + 2.5 * Tone.Time("4n").toSeconds(), 0.32);
    } catch (e) {}
  }, "2m"); // 2 小節ごと = lofi の落ち着いた呼吸
}
function stopLofiPianoLayer() {
  if (lofiPianoSchedId != null) {
    try { Tone.Transport.clear(lofiPianoSchedId); } catch (e) {}
    lofiPianoSchedId = null;
  }
}

// fm-58: lofi mode の bass を Salamander piano 低オクで担当
// (band-room v110 "salamander-bass" と完全整合 = piano left-hand walking)
let lofiBassSampler = null;
let lofiBassSchedId = null;
function ensureLofiBassSampler() {
  if (lofiBassSampler) return lofiBassSampler;
  const base = "https://tonejs.github.io/audio/salamander";
  const lowNotes = {
    "A0":"A0","C1":"C1","D#1":"Ds1","F#1":"Fs1","A1":"A1",
    "C2":"C2","D#2":"Ds2","F#2":"Fs2","A2":"A2",
    "C3":"C3"
  };
  const urls = {};
  Object.entries(lowNotes).forEach(([n,f]) => { urls[n] = `${base}/${f}.mp3`; });
  try {
    lofiBassSampler = new Tone.Sampler({
      urls, release: 0.8, volume: -8
    }).connect(bassBus);
  } catch (e) {
    console.warn("[Music] lofi bass sampler init failed:", e);
    lofiBassSampler = null;
  }
  return lofiBassSampler;
}
function startLofiBassLayer() {
  stopLofiBassLayer();
  const sampler = ensureLofiBassSampler();
  if (!sampler) return;
  // Walking bass follows the shared bassline director, so the left hand turns
  // phrases instead of repeating root/5th/octave/5th forever.
  lofiBassSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      triggerSamplerBasslineBar(sampler, time, {
        baseVelocity: 0.58,
        maxVelocity: 0.68,
        maxEvents: 6,
        register: "low",
        fallbackDuration: "4n"
      });
    } catch (e) {}
  }, "1m");
}
function stopLofiBassLayer() {
  if (lofiBassSchedId != null) {
    try { Tone.Transport.clear(lofiBassSchedId); } catch (e) {}
    lofiBassSchedId = null;
  }
}

// fm-58: lofi mode の drum を tone-breakbeat sample で boom-bap groove
// (band-room v109 lo-fi preset の kit_source: online/tone-breakbeat と整合)
let lofiDrumSamples = null;
let lofiDrumSchedId = null;
function ensureLofiDrumSamples() {
  if (lofiDrumSamples) return lofiDrumSamples;
  const base = "https://tonejs.github.io/audio/drum-samples/breakbeat13";
  try {
    lofiDrumSamples = {
      kick:  new Tone.Player({ url: base + "/kick.mp3",  autostart: false, volume: -4 }).connect(drumBus),
      snare: new Tone.Player({ url: base + "/snare.mp3", autostart: false, volume: -6 }).connect(drumBus),
      hat:   new Tone.Player({ url: base + "/hihat.mp3", autostart: false, volume: -14 }).connect(drumBus)
    };
  } catch (e) {
    console.warn("[Music] lofi drum samples init failed:", e);
    lofiDrumSamples = null;
  }
  return lofiDrumSamples;
}
function startLofiDrumLayer() {
  stopLofiDrumLayer();
  const samples = ensureLofiDrumSamples();
  if (!samples) return;
  // Boom-bap pattern: kick on 1 + "and-of-3", snare on 2 + 4, hat 8th
  // fm-70: lofi kit base volumes for mic-follow modulation (see jazz layer).
  const lofiBaseKickDb = samples.kick.volume.value;
  const lofiBaseSnareDb = samples.snare.volume.value;
  const lofiBaseHatDb = samples.hat.volume.value;
  lofiDrumSchedId = Tone.Transport.scheduleRepeat((time) => {
    try {
      // fm-71: skip canned lofi boom-bap while AI fill is firing (engine
      // kick/hat blocks handle the AI sequence; doubling the backbeat
      // snare here would wash out the Magenta continuation).
      if (typeof window !== "undefined" && window.FmAiFill && window.FmAiFill.status.active) return;
      const bt = Tone.Time("4n").toSeconds();
      const e8 = bt / 2;
      // fm-69: Dilla per-step microOffsets (mode-fixed). lofi = full Dilla.
      const dilla = FM_MODE_DILLA_OFFSETS[EngineParams.mode] || FM_DILLA_OFFSETS_ZERO;
      const snareSec = (dilla.snareBack || 0) / 1000;
      const hatOffSec = (dilla.hatOffPush || 0) / 1000;
      // fm-70: mic-follow dB nudge — drum-floor follows the player.
      const micDb = fmMicFollowDbDelta();
      samples.kick.volume.value = lofiBaseKickDb + micDb;
      samples.snare.volume.value = lofiBaseSnareDb + micDb;
      samples.hat.volume.value = lofiBaseHatDb + micDb * 0.7;
      samples.kick.start(time);
      samples.snare.start(time + bt + snareSec);                 // backbeat 2 dragged back
      samples.kick.start(time + 2 * bt + e8 * 0.5);              // syncopated kick (no offset)
      samples.snare.start(time + 3 * bt + snareSec);             // backbeat 4 dragged back
      for (let h = 0; h < 8; h++) {
        const hOff = (h % 2 === 1) ? hatOffSec : 0;              // offbeat hat pushed
        samples.hat.start(time + h * e8 + hOff);
      }
    } catch (e) {}
  }, "1m");
}
function stopLofiDrumLayer() {
  if (lofiDrumSchedId != null) {
    try { Tone.Transport.clear(lofiDrumSchedId); } catch (e) {}
    lofiDrumSchedId = null;
  }
}

const texture = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.002, decay: 0.064, sustain: 0, release: 0.036 }
}).connect(textureBus);

const glass = new Tone.FMSynth({
  harmonicity: 1.5,
  modulationIndex: 7.2,
  oscillator: { type: "sine" },
  envelope: { attack: 0.007, decay: 0.13, sustain: 0, release: 0.24 },
  modulation: { type: "triangle" },
  modulationEnvelope: { attack: 0.004, decay: 0.085, sustain: 0, release: 0.13 }
}).connect(globalDelay);

// v248: pianoMemory gets a dedicated echo for character. v246 went fully dry
// to silence a perceived smear, but stripping the "memory" echo entirely felt
// 退屈 — the wash was the layer's signature. Restore character via a separate
// PingPongDelay (shorter feedback than globalDelay's 0.32) at a controlled
// send level: dry direct → clean v244-tight on-beat attack; wet send →
// soft 8n tail for the missing wash.
// v251: v248's first pass still felt subtle — bumped feedback 0.20→0.24
// (slightly longer tail, still well under globalDelay's 0.32 so it decays
// before the next chord) and send 0.32→0.42 (first echo ~-7.5 dB vs -10 dB)
// for a more audible "memory" character without re-introducing v245's smear.
const pianoMemoryEcho = new Tone.PingPongDelay({
  delayTime: "8n",
  feedback: 0.24,
  wet: 1,
}).connect(masterGain);
const pianoMemorySend = new Tone.Gain(0.42).connect(pianoMemoryEcho);
const pianoMemoryFilter = new Tone.Filter(1800, "lowpass").connect(masterGain);
pianoMemoryFilter.connect(pianoMemorySend);
const pianoMemory = new Tone.PolySynth({
  voice: Tone.Synth,
  // BL-022: capped from 48. Short 16n/32n/64n notes free voices fast,
  // so 24 is ample headroom while bounding the simultaneous-onset load.
  maxPolyphony: 24,
  options: {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.004, decay: 0.18, sustain: 0.045, release: 0.5 }
  }
}).connect(pianoMemoryFilter);

const voiceDustFilter = new Tone.Filter(2400, "bandpass").connect(globalReverb);
const voiceDust = new Tone.FMSynth({
  harmonicity: 0.76,
  modulationIndex: 1.85,
  oscillator: { type: "sine" },
  envelope: { attack: 0.018, decay: 0.22, sustain: 0.02, release: 0.48 },
  modulation: { type: "triangle" },
  modulationEnvelope: { attack: 0.012, decay: 0.16, sustain: 0, release: 0.24 }
}).connect(voiceDustFilter);

const drumSkin = new Tone.NoiseSynth({
  noise: { type: "brown" },
  envelope: { attack: 0.001, decay: 0.038, sustain: 0, release: 0.025 }
}).connect(drumBus);

const subImpact = new Tone.MonoSynth({
  oscillator: { type: "sine" },
  filter: { type: "lowpass", Q: 0.58 },
  filterEnvelope: {
    attack: 0.003,
    decay: 0.26,
    sustain: 0,
    release: 0.08,
    baseFrequency: 42,
    octaves: 1.35
  },
  envelope: { attack: 0.004, decay: 0.34, sustain: 0, release: 0.16 }
}).connect(bassBus);

const reedBuzzFilter = new Tone.Filter(170, "bandpass").connect(globalReverb);
const reedBuzz = new Tone.MonoSynth({
  oscillator: { type: "sawtooth" },
  filter: { type: "bandpass", Q: 2.6 },
  filterEnvelope: {
    attack: 0.04,
    decay: 0.42,
    sustain: 0.18,
    release: 0.58,
    baseFrequency: 72,
    octaves: 1.15
  },
  envelope: { attack: 0.035, decay: 0.34, sustain: 0.34, release: 0.72 }
}).connect(reedBuzzFilter);

pianoMemory.volume.value = -41;
voiceDust.volume.value = -43;
drumSkin.volume.value = -32;
subImpact.volume.value = -30;
reedBuzz.volume.value = -48;

// kick: drop retriggers landing within 60ms of the last hit (see
// toneVoiceRetriggerTooSoon). The punch-pad, acid-trace and ambient
// ghost-pulse paths can all fire the kick on the same step — without this
// they collide ~10-30ms apart and the MembraneSynth clicks on the restart.
guardToneTriggerReleaseSchedule("kick", kick, 2, { minRetriggerSec: 0.06 });
guardToneTriggerReleaseSchedule("hat", hat, 1);
guardToneTriggerReleaseSchedule("bass", bass, 2);
guardToneTriggerReleaseSchedule("pad", pad, 2, { maxActiveVoices: 52 });
guardToneTriggerReleaseSchedule("texture", texture, 1);
guardToneTriggerReleaseSchedule("glass", glass, 2);
guardToneTriggerReleaseSchedule("pianoMemory", pianoMemory, 2, { maxActiveVoices: 40 });
guardToneTriggerReleaseSchedule("voiceDust", voiceDust, 2);
guardToneTriggerReleaseSchedule("drumSkin", drumSkin, 1);
guardToneTriggerReleaseSchedule("subImpact", subImpact, 2);
guardToneTriggerReleaseSchedule("reedBuzz", reedBuzz, 2);

function organicFragment(offset = 0) {
  return tonalRhymeNote(ORGANIC_PLUCK_FRAGMENTS, stepIndex, offset, { role: "mid" });
}

function transparentFragment(offset = 0) {
  return tonalRhymeNote(TRANSPARENT_AIR_FRAGMENTS, stepIndex, offset, { role: "voice" });
}

function voiceNotePool(fallbackPool = TRANSPARENT_AIR_FRAGMENTS) {
  const atmosphereKey = effectiveVoiceAtmosphereKey();
  const sourceKey = effectiveVoiceSourceKey();

  if (atmosphereKey === "chrome" || atmosphereKey === "void" || sourceKey === "opn" || sourceKey === "xtal") {
    return TRANSPARENT_AIR_FRAGMENTS;
  }
  if (atmosphereKey === "organic" || sourceKey === "fsol") return ORGANIC_PLUCK_FRAGMENTS;
  if (atmosphereKey === "ghost" || sourceKey === "burial" || sourceKey === "boc") return FIELD_MURK_FRAGMENTS;
  if (sourceKey === "autechre") return GLASS_NOTES;
  return fallbackPool;
}

function voiceFragment(offset = 0, fallbackPool = TRANSPARENT_AIR_FRAGMENTS) {
  const pool = voiceNotePool(fallbackPool);
  const phaseOffset = Math.floor((GenomeState.phase || 0) * pool.length);
  const index = tonalRhymeIndex(stepIndex, GenomeState.generation + phaseOffset + offset, pool.length);
  const note = pool[((index % pool.length) + pool.length) % pool.length];
  return melodicDirectorNote(note, stepIndex, offset, { role: "voice" });
}

function triggerVoiceColorCue(time) {
  if (!isPlaying || !initialized || typeof Tone === "undefined") return;

  const now = Number.isFinite(time) ? time : currentToneContextTime();
  const atmosphereKey = effectiveVoiceAtmosphereKey();
  const sourceKey = effectiveVoiceSourceKey();
  const gradientParts = currentGradientParts();
  const gradient = updateReferenceGradient(gradientParts);
  const depth = updateReferenceDepth(gradientParts, gradient);
  const cueVel = clampValue(0.026 + depth.particle * 0.018 + depth.tail * 0.012 + voiceTransitionAmount() * 0.026, 0.022, 0.086);

  try {
    if (sourceKey === "autechre") {
      const note = voiceFragment(0, GLASS_NOTES);
      glass.triggerAttackRelease(note, "64n", now + 0.006, clampValue(cueVel + gradient.micro * 0.012, 0.026, 0.094));
      glass.triggerAttackRelease(note, "64n", now + 0.046, clampValue(cueVel * 0.62, 0.018, 0.058));
      texture.triggerAttackRelease("64n", now + 0.022, clampValue(0.018 + gradient.micro * 0.034, 0.014, 0.068));
    } else if (sourceKey === "burial" || atmosphereKey === "ghost") {
      texture.triggerAttackRelease("32n", now + 0.012, clampValue(0.026 + gradient.ghost * 0.042, 0.02, 0.082));
      glass.triggerAttackRelease(voiceFragment(2, FIELD_MURK_FRAGMENTS), "32n", now + 0.052, clampValue(cueVel * 0.72, 0.018, 0.064));
    } else if (sourceKey === "fsol" || atmosphereKey === "organic") {
      const note = voiceFragment(1, ORGANIC_PLUCK_FRAGMENTS);
      glass.triggerAttackRelease(note, "64n", now + 0.008, clampValue(cueVel + gradient.organic * 0.012, 0.026, 0.09));
      glass.triggerAttackRelease(voiceFragment(4, ORGANIC_PLUCK_FRAGMENTS), "64n", now + 0.064, clampValue(cueVel * 0.52, 0.014, 0.052));
      texture.triggerAttackRelease("64n", now + 0.018, clampValue(0.014 + gradient.organic * 0.026, 0.012, 0.058));
    } else if (sourceKey === "opn" || atmosphereKey === "chrome" || atmosphereKey === "void") {
      glass.triggerAttackRelease(voiceFragment(0, TRANSPARENT_AIR_FRAGMENTS), "16n", now + 0.012, clampValue(cueVel + gradient.chrome * 0.014, 0.028, 0.092));
      glass.triggerAttackRelease(voiceFragment(3, TRANSPARENT_AIR_FRAGMENTS), "32n", now + 0.092, clampValue(cueVel * 0.5, 0.014, 0.05));
      if (atmosphereKey === "void") {
        pad.triggerAttackRelease(randomHazeChord(), "2n", now + 0.026, clampValue(0.024 + depth.tail * 0.026, 0.022, 0.064));
      }
    } else {
      pad.triggerAttackRelease(randomHazeChord(), "1n", now + 0.018, clampValue(0.022 + gradient.haze * 0.026, 0.02, 0.064));
      glass.triggerAttackRelease(voiceFragment(2, FIELD_MURK_FRAGMENTS), "32n", now + 0.052, clampValue(cueVel * 0.66, 0.016, 0.056));
    }
  } catch (error) {
    console.warn("[Music] voice color cue failed:", error);
  }
}

function triggerMusicRadioBrainIdent(step, time, context = {}) {
  if (!MusicRadioBrainState.cuePending || !isPlaying || !initialized) return;
  if (step !== 0 && step !== 8) return;
  if (MusicRadioBrainState.cueLastStep >= 0 && stepIndex - MusicRadioBrainState.cueLastStep < 12) return;
  if (GrooveState.cycle - MusicRadioBrainState.cueCycle > 2) {
    MusicRadioBrainState.cuePending = false;
    return;
  }

  const eventLoad = MixGovernorState.eventLoad || 0;
  const lowGuard = MixGovernorState.lowGuard || 0;
  const program = MusicRadioBrainState.cueProgram || MusicRadioBrainState.active;
  const bias = MusicRadioBrainState.bias;
  const gradient = GradientState;
  const palette = ModeTimbrePaletteState.shape;
  if (eventLoad > (program === "voidRoom" ? 0.88 : 0.78)) return;

  const baseTime = time + 0.014 + Math.random() * 0.012;
  const airNote = voiceFragment(2, TRANSPARENT_AIR_FRAGMENTS);
  const glassNote = voiceFragment(1, GLASS_NOTES);
  const memoryNote = voiceFragment(3, ORGANIC_PLUCK_FRAGMENTS);
  const murkNote = voiceFragment(4, FIELD_MURK_FRAGMENTS);
  const vel = clampValue(0.018 + bias.curiosity * 0.032 + palette.signature * 0.024 - eventLoad * 0.012, 0.012, 0.074);

  try {
    if (program === "fieldStudy") {
      if (pad) pad.triggerAttackRelease(randomHazeChord(), "1n", baseTime + 0.012, clampValue(0.018 + bias.haze * 0.028 + bias.air * 0.012, 0.016, 0.06));
      if (glass) glass.triggerAttackRelease(airNote, "16n", baseTime + 0.052, clampValue(vel + bias.air * 0.018, 0.016, 0.078));
      if (voiceDust && rand(0.18 + bias.air * 0.22)) voiceDust.triggerAttackRelease(airNote, "8n", baseTime + 0.098, clampValue(0.01 + bias.haze * 0.022, 0.008, 0.044));
      markMixEvent(0.04);
    } else if (program === "glassCoding") {
      if (glass) {
        glass.triggerAttackRelease(glassNote, "64n", baseTime, clampValue(vel + bias.glass * 0.028, 0.018, 0.086));
        glass.triggerAttackRelease(memoryNote, "64n", baseTime + 0.054 + Math.random() * 0.012, clampValue(vel * 0.62 + bias.glass * 0.012, 0.012, 0.056));
      }
      if (texture && rand(0.22 + bias.glass * 0.2)) texture.triggerAttackRelease("64n", baseTime + 0.022, clampValue(0.014 + bias.glass * 0.04, 0.012, 0.066));
      rememberMotif(glassNote, { reply: memoryNote, shade: murkNote, strength: 0.02 + bias.glass * 0.04, air: bias.air * 0.05, source: "radio-glass-coding" });
      markMixEvent(0.05);
    } else if (program === "dryGridWork") {
      if (hat) {
        hat.triggerAttackRelease("64n", baseTime + 0.006, clampValue(0.032 + bias.grid * 0.052, 0.026, 0.112));
        hat.triggerAttackRelease("64n", baseTime + 0.042, clampValue(0.022 + bias.grid * 0.036, 0.018, 0.082));
      }
      if (texture) texture.triggerAttackRelease("64n", baseTime + 0.018, clampValue(0.018 + bias.grid * 0.046, 0.014, 0.086));
      if (glass && rand(0.18 + bias.glass * 0.14)) glass.triggerAttackRelease(glassNote, "64n", baseTime + 0.064, clampValue(vel * 0.58, 0.012, 0.05));
      markMixEvent(0.055);
    } else if (program === "ghostPressure") {
      if (texture) texture.triggerAttackRelease("64n", baseTime + 0.004, clampValue(0.026 + bias.pressure * 0.058 - lowGuard * 0.018, 0.018, 0.092));
      if (drumSkin && lowGuard < 0.7 && rand(0.22 + bias.pressure * 0.18)) drumSkin.triggerAttackRelease("64n", baseTime + 0.026, clampValue(0.018 + bias.pressure * 0.04 - lowGuard * 0.014, 0.012, 0.064));
      if (glass) glass.triggerAttackRelease(murkNote, "32n", baseTime + 0.068, clampValue(vel + gradient.ghost * 0.01, 0.014, 0.062));
      markMixEvent(0.052);
    } else if (program === "hardTechno") {
      if (drumSkin && lowGuard < 0.72) drumSkin.triggerAttackRelease("64n", baseTime, clampValue(0.038 + bias.grid * 0.06 + bias.pressure * 0.024 - lowGuard * 0.02, 0.026, 0.122));
      if (hat) {
        hat.triggerAttackRelease("64n", baseTime + 0.022, clampValue(0.034 + bias.grid * 0.05, 0.028, 0.108));
        hat.triggerAttackRelease("64n", baseTime + 0.07, clampValue(0.028 + bias.grid * 0.038, 0.022, 0.088));
      }
      if (texture) texture.triggerAttackRelease("64n", baseTime + 0.044, clampValue(0.022 + bias.grid * 0.04, 0.018, 0.084));
      markMixEvent(0.06);
    } else if (program === "liveJazz") {
      if (texture) texture.triggerAttackRelease("32n", baseTime + 0.018, clampValue(0.022 + bias.air * 0.038 + bias.glass * 0.018, 0.016, 0.082));
      if (glass) glass.triggerAttackRelease(memoryNote, "32n", baseTime + 0.064, clampValue(vel + bias.air * 0.024, 0.014, 0.07));
      if (pad) pad.triggerAttackRelease(randomHazeChord(), "1n", baseTime + 0.034, clampValue(0.014 + bias.air * 0.024 + bias.haze * 0.018, 0.012, 0.054));
      if (voiceDust && rand(0.16 + bias.air * 0.18)) voiceDust.triggerAttackRelease(airNote, "8n", baseTime + 0.092, clampValue(0.01 + bias.air * 0.02, 0.008, 0.044));
      markMixEvent(0.046);
    } else if (program === "nightFunk") {
      if (drumSkin && lowGuard < 0.7) drumSkin.triggerAttackRelease("64n", baseTime + 0.008, clampValue(0.034 + bias.pressure * 0.05 - lowGuard * 0.02, 0.024, 0.108));
      if (glass) glass.triggerAttackRelease(glassNote, "64n", baseTime + 0.054, clampValue(vel + bias.pressure * 0.022 + bias.grid * 0.014, 0.018, 0.082));
      if (hat) hat.triggerAttackRelease("64n", baseTime + 0.082, clampValue(0.026 + bias.grid * 0.034, 0.022, 0.084));
      if (texture && rand(0.22 + bias.pressure * 0.16)) texture.triggerAttackRelease("64n", baseTime + 0.038, clampValue(0.018 + bias.pressure * 0.034, 0.014, 0.078));
      markMixEvent(0.05);
    } else if (program === "quietPiano") {
      if (pad) pad.triggerAttackRelease(randomHazeChord(), "1n", baseTime + 0.012, clampValue(0.022 + bias.haze * 0.026 + bias.air * 0.014, 0.016, 0.068));
      if (glass) glass.triggerAttackRelease(memoryNote, "16n", baseTime + 0.082, clampValue(vel + bias.haze * 0.014, 0.014, 0.062));
      if (voiceDust && rand(0.18 + bias.air * 0.16)) voiceDust.triggerAttackRelease(airNote, "8n", baseTime + 0.142, clampValue(0.01 + bias.air * 0.018, 0.008, 0.04));
      markMixEvent(0.038);
    } else {
      if (glass) {
        glass.triggerAttackRelease(airNote, "16n", baseTime + 0.022, clampValue(0.018 + bias.air * 0.032, 0.014, 0.078));
        glass.triggerAttackRelease(voiceFragment(5, TRANSPARENT_AIR_FRAGMENTS), "32n", baseTime + 0.118, clampValue(0.012 + bias.air * 0.024, 0.01, 0.056));
      }
      if (voiceDust && rand(0.2 + bias.air * 0.2)) voiceDust.triggerAttackRelease(airNote, "4n", baseTime + 0.052, clampValue(0.008 + bias.air * 0.026, 0.008, 0.044));
      if (pad && rand(0.12 + bias.air * 0.18)) pad.triggerAttackRelease(randomHazeChord(), "2n", baseTime + 0.036, clampValue(0.014 + bias.air * 0.028, 0.012, 0.052));
      markMixEvent(0.038);
    }

    MusicRadioBrainState.cuePending = false;
    MusicRadioBrainState.cueLastStep = stepIndex;
  } catch (error) {
    MusicRadioBrainState.cuePending = false;
    console.warn("[Music] radio brain ident failed:", error);
  }
}

function triggerPadSignature(name, time) {
  if (!isPlaying || !initialized || typeof Tone === "undefined") return;

  // The gesture below layers onsets off `now` (now+0.002 … now+0.176). Fired
  // from a pad press there's no Transport time, so base it a short lead ahead
  // of the audio clock — otherwise the early onsets fall in the near-past, the
  // scheduler floors each one separately, and the gesture's front collapses
  // into a click. 50ms preserves the gesture shape, clears the nowLead floor,
  // and stays snappy enough that the pad still feels immediate.
  const now = Number.isFinite(time) ? time : currentToneContextTime() + 0.05;
  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const gradientParts = currentGradientParts();
  const gradient = updateReferenceGradient(gradientParts);
  const depth = updateReferenceDepth(gradientParts, gradient);

  try {
    if (name === "drift") {
      const note = voiceFragment(0, TRANSPARENT_AIR_FRAGMENTS);
      const driftNote = voiceFragment(2, TRANSPARENT_AIR_FRAGMENTS);
      const pluckNote = voiceFragment(4, ORGANIC_PLUCK_FRAGMENTS);
      glass.triggerAttackRelease(note, "16n", now + 0.006, clampValue(0.064 + observerNorm * 0.048 + gradient.chrome * 0.012 + depth.tail * 0.006, 0.054, 0.136));
      glass.triggerAttackRelease(driftNote, "32n", now + 0.056, clampValue(0.044 + creationNorm * 0.03 + gradient.memory * 0.01 + depth.particle * 0.006, 0.036, 0.098));
      glass.triggerAttackRelease(voiceFragment(3, GLASS_NOTES), "32n", now + 0.108, clampValue(0.03 + creationNorm * 0.026 + gradient.haze * 0.006 + depth.bed * 0.004, 0.026, 0.08));
      glass.triggerAttackRelease(pluckNote, "64n", now + 0.142, clampValue(0.026 + observerNorm * 0.03 + gradient.memory * 0.008 + depth.gesture * 0.006, 0.022, 0.078));
      texture.triggerAttackRelease("64n", now + 0.018, clampValue(0.034 + creationNorm * 0.034, 0.028, 0.078));
    } else if (name === "repeat") {
      const note = voiceFragment(0, GLASS_NOTES);
      const chipNote = voiceFragment(1, TRANSPARENT_AIR_FRAGMENTS);
      glass.triggerAttackRelease(note, "64n", now + 0.004, clampValue(0.062 + energyNorm * 0.032 + gradient.micro * 0.01 + depth.particle * 0.006, 0.052, 0.112));
      glass.triggerAttackRelease(note, "64n", now + 0.052, clampValue(0.048 + energyNorm * 0.026 + gradient.micro * 0.008 + depth.gesture * 0.006, 0.04, 0.096));
      glass.triggerAttackRelease(chipNote, "64n", now + 0.086, clampValue(0.026 + observerNorm * 0.028 + gradient.organic * 0.008 + depth.particle * 0.004, 0.022, 0.074));
      glass.triggerAttackRelease(voiceFragment(4, TRANSPARENT_AIR_FRAGMENTS), "64n", now + 0.132, clampValue(0.016 + depth.particle * 0.028, 0.014, 0.048));
      hat.triggerAttackRelease("64n", now + 0.026, clampValue(0.056 + energyNorm * 0.038, 0.048, 0.112));
      texture.triggerAttackRelease("64n", now + 0.068, clampValue(0.032 + creationNorm * 0.028, 0.026, 0.07));
    } else if (name === "punch") {
      kick.triggerAttackRelease(tonalRhymeLow(stepIndex, 0), "16n", now + 0.002, clampValue(0.28 + energyNorm * 0.08, 0.24, 0.42));
      bass.triggerAttackRelease(tonalRhymeSub(stepIndex, 1), "32n", now + 0.018, clampValue(0.075 + energyNorm * 0.045, 0.065, 0.14));
      glass.triggerAttackRelease(voiceFragment(2, ORGANIC_PLUCK_FRAGMENTS), "64n", now + 0.032, clampValue(0.038 + creationNorm * 0.028 + gradient.organic * 0.01 + depth.gesture * 0.006, 0.03, 0.092));
      texture.triggerAttackRelease("64n", now + 0.014, clampValue(0.08 + creationNorm * 0.042 + gradient.ghost * 0.012 + depth.pulse * 0.006, 0.064, 0.142));
    } else if (name === "void") {
      const airNote = voiceFragment(2, TRANSPARENT_AIR_FRAGMENTS);
      const bloomNote = voiceFragment(5, TRANSPARENT_AIR_FRAGMENTS);
      const dustNote = voiceFragment(1, TRANSPARENT_AIR_FRAGMENTS);
      glass.triggerAttackRelease(airNote, "8n", now + 0.01, clampValue(0.052 + observerNorm * 0.046 + gradient.chrome * 0.012 + depth.tail * 0.006, 0.044, 0.116));
      glass.triggerAttackRelease(bloomNote, "16n", now + 0.096, clampValue(0.034 + observerNorm * 0.034 + gradient.haze * 0.008 + depth.bed * 0.005, 0.03, 0.09));
      glass.triggerAttackRelease(dustNote, "32n", now + 0.176, clampValue(0.022 + observerNorm * 0.03 + gradient.chrome * 0.006 + depth.tail * 0.004, 0.02, 0.07));
      pad.triggerAttackRelease(randomHazeChord(), "2n", now + 0.02, clampValue(0.042 + observerNorm * 0.028 + gradient.haze * 0.006 + depth.tail * 0.006, 0.034, 0.088));
      texture.triggerAttackRelease("32n", now + 0.034, clampValue(0.024 + observerNorm * 0.03, 0.02, 0.064));
    }
  } catch (error) {
    console.warn("[Music] performance pad signature failed:", name, error);
  }
}

/* =========================================================
   3. パラメータ構造
========================================================= */

const EngineParams = {
  bpm: 80,
  stepCount: 8,          // 16 → 8 にしてスケジューリング半減
  mode: "ambient",

  kickProb: 0.7,
  hatProb:  0.7,
  bassProb: 0.4,
  padProb:  0.4,
  restProb: 0.2,

  kickPattern: "x...x...",
  hatPattern:  "x.x.x.x.",
  bassPattern: "x...x..x",
  padPattern:  "x...x..."
};

// fm-71: expose EngineParams so audio/ai-fills.js (Magenta DrumsRNN burst)
// can read the current mode's kick/hat patterns when building a seed
// NoteSequence. Read-only contract — the AI module never mutates these.
if (typeof window !== "undefined") window.EngineParams = EngineParams;

// fm-69: per-step Dilla microOffsets (band-room v133 port).
// Drag backbeat snare back, push offbeat hat forward — the J Dilla / lofi
// groove. Layered on top of genre-flavor.js microMs and humanGrooveGovernor
// timeOffsetSec; mode-fixed (NOT UCM-driven) so the groove signature stays
// consistent within a mode. Values in milliseconds; converted to seconds at
// apply time in scheduleStep.
const FM_MODE_DILLA_OFFSETS = {
  ambient: { snareBack: 0,  hatOffPush: 0,  ghostBack: 0 },  // no Dilla
  lofi:    { snareBack: 14, hatOffPush: -4, ghostBack: 8 },  // full Dilla
  jazz:    { snareBack: 8,  hatOffPush: -2, ghostBack: 5 },  // light Dilla
  techno:  { snareBack: 0,  hatOffPush: 0,  ghostBack: 0 },  // machine-tight
  trance:  { snareBack: 0,  hatOffPush: 0,  ghostBack: 0 },  // machine-tight
  dub:     { snareBack: 10, hatOffPush: -3, ghostBack: 6 },  // medium Dilla
  funk:    { snareBack: 18, hatOffPush: -5, ghostBack: 10 }  // heaviest Dilla
};
const FM_DILLA_OFFSETS_ZERO = { snareBack: 0, hatOffPush: 0, ghostBack: 0 };

// Compute Dilla per-step offset in seconds for a given drum role/step/velocity.
// stepCount-aware: derives beat (0-3) and sub-in-beat from step.
function dillaOffsetSec(role, step, velocity) {
  const mode = (EngineParams && EngineParams.mode) || "ambient";
  const dilla = FM_MODE_DILLA_OFFSETS[mode] || FM_DILLA_OFFSETS_ZERO;
  const stepsPerBeat = Math.max(1, Math.round((EngineParams.stepCount || 16) / 4));
  const beat = Math.floor(step / stepsPerBeat) % 4;
  const sub = step % stepsPerBeat;
  let ms = 0;
  if (role === "snare" && (beat === 1 || beat === 3)) {
    ms = dilla.snareBack;  // backbeat snare drags back
  } else if (role === "hat" && sub !== 0) {
    ms = dilla.hatOffPush;  // offbeat hat pushes forward (or back)
  }
  // ghost notes (low-velocity hits) get the ghostBack offset; treat velocity < 0.4 as ghost
  if (typeof velocity === "number" && velocity < 0.4 && dilla.ghostBack) {
    ms += dilla.ghostBack;
  }
  return ms / 1000;
}

let currentScale = ["D4", "F#4", "G4", "E4", "D5"];
const MODE_CHORDS = {
  ambient: [
    ["D3", "F#3", "E4"],
    ["G3", "D4", "F#4"],
    ["E3", "G3", "D4"]
  ],
  lofi: [
    ["D3", "F#3", "A3", "E4"],
    ["G3", "D4", "F#4", "E4"],
    ["E3", "G3", "B3"],
    ["A2", "E3", "G3", "C#4"]
  ],
  dub: [
    ["D3", "A3", "E4"],
    ["G3", "D4", "F#4"]
  ],
  jazz: [
    ["D3", "F#3", "A3", "E4"],
    ["G3", "B3", "D4", "F#4"],
    ["B2", "D3", "F#3", "A3"],
    ["A2", "C#3", "G3", "B3"]
  ],
  techno: [
    ["D3", "F#3"],
    ["G3", "E4"],
    ["D3", "E4"]
  ],
  trance: [
    ["D3", "F#3", "A3"],
    ["E3", "G3", "B3"],
    ["A2", "E3", "B3"]
  ]
};
const GLASS_NOTES = ["D5", "F#5", "G5", "E5", "D6", "F#6", "G6", "E6"];
const FIELD_MURK_FRAGMENTS = ["D4", "F#4", "G4", "E4", "D5", "F#5", "G5", "E5"];
const TRANSPARENT_AIR_FRAGMENTS = ["D6", "F#6", "G6", "E6", "D7", "F#7"];
const ORGANIC_PLUCK_FRAGMENTS = ["D4", "F#4", "G4", "E4", "D5", "F#5", "G5", "E5", "D6", "F#6"];
const HAZE_CHORDS = [
  ["D4", "F#4", "E5"],
  ["G4", "D5", "F#5"],
  ["E4", "G4", "D5"],
  ["F#4", "E5", "G5"],
  ["A3", "E4", "G4", "C#5"],
  ["B3", "D4", "F#4", "A4"]
];
const GLASS_ACCENT_STEPS = [3, 5, 7, 10, 11, 14];

const NOTE_NAME_TO_SEMITONE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const SEMITONE_TO_NOTE_NAME = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MELODIC_DIRECTOR_KEYS = [
  { id: "home-d", shift: 0, label: "D home" },
  { id: "fourth-g", shift: 5, label: "G lift" },
  { id: "fifth-a", shift: 7, label: "A answer" },
  { id: "side-e", shift: 2, label: "E side" },
  { id: "shadow-c", shift: -2, label: "C shadow" }
];
const MELODIC_DIRECTOR_KEY_ORDER = {
  ambient: [0, 4, 1, 0, 2, 4],
  lofi: [0, 3, 1, 0, 2, 3],
  jazz: [0, 1, 2, 3, 1, 0],
  funk: [0, 2, 3, 1, 2, 0],
  dub: [0, 4, 0, 1, 4, 2],
  techno: [0, 2, 0, 3, 2, 4],
  trance: [0, 2, 3, 2, 1, 0]
};
// Per-genre chord progression — a deliberate index order through HAZE_CHORDS
// (a D-major diatonic set: 0=I 1=IV 2=ii 3=iii 4=V 5=vi). The pad advances one
// chord per bar, so the haze layer forms a real progression instead of a
// random pool pick. Index arrays — tunable by ear.
const HAZE_CHORD_PROGRESSION = {
  ambient: [0, 5, 1, 0],
  lofi: [0, 5, 2, 4],
  jazz: [2, 4, 0, 5],
  funk: [0, 4, 5, 1],
  dub: [0, 1, 0, 4],
  techno: [0, 0, 5, 4],
  trance: [5, 1, 0, 4]
};
const MELODIC_DIRECTOR_CONTOURS = [
  { id: "call", shape: [0, 2, 0, 5, 3, 2, 0, -2] },
  { id: "answer", shape: [4, 2, 0, -2, 0, 2, 5, 4] },
  { id: "lift", shape: [0, 2, 3, 5, 7, 5, 3, 2] },
  { id: "turn", shape: [0, -2, 0, 3, 2, -2, 0, 5] },
  { id: "settle", shape: [2, 0, -2, 0, 2, 0, -3, 0] }
];
const MelodicDirectorState = {
  phrase: 0,
  phraseBars: 8,
  lastTurnCycle: -1,
  keyIndex: 0,
  keyShift: 0,
  keyLabel: "D home",
  contourIndex: 0,
  contour: "call",
  contourDepth: 0.5,
  chordTurn: 0
};

function noteNameToMidi(note) {
  const match = String(note || "").match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) return null;
  const semi = NOTE_NAME_TO_SEMITONE[match[1]];
  const octave = Number(match[2]);
  if (semi == null || !Number.isFinite(octave)) return null;
  return semi + octave * 12;
}

function midiToNoteName(midi) {
  const safe = Math.round(Number(midi) || 0);
  const semi = ((safe % 12) + 12) % 12;
  return SEMITONE_TO_NOTE_NAME[semi] + Math.floor(safe / 12);
}

function transposeNoteName(note, semis = 0) {
  const midi = noteNameToMidi(note);
  if (midi == null) return note;
  return midiToNoteName(midi + Math.round(Number(semis) || 0));
}

function melodicDirectorPhraseBars(mode = EngineParams.mode) {
  if (mode === "ambient" || mode === "dub") return 16;
  if (mode === "techno" || mode === "trance") return 8;
  return 8;
}

function melodicDirectorContourSemis(step = stepIndex, offset = 0, note = "", options = {}) {
  if (options.contour === false) return 0;
  const contour = MELODIC_DIRECTOR_CONTOURS[MelodicDirectorState.contourIndex] || MELODIC_DIRECTOR_CONTOURS[0];
  const shape = contour.shape || [0];
  const shapeIndex = ((GrooveState.cycle + step + offset + MelodicDirectorState.phrase) % shape.length + shape.length) % shape.length;
  const octave = Math.floor((noteNameToMidi(note) ?? 60) / 12);
  const roleScale = options.role === "chord" ? 0 : octave <= 2 ? 0.32 : octave <= 3 ? 0.55 : 1;
  return Math.round((shape[shapeIndex] || 0) * MelodicDirectorState.contourDepth * roleScale);
}

function melodicDirectorNote(note, step = stepIndex, offset = 0, options = {}) {
  const midi = noteNameToMidi(note);
  if (midi == null) return note;
  const shift = MelodicDirectorState.keyShift + melodicDirectorContourSemis(step, offset, note, options);
  return midiToNoteName(midi + shift);
}

function melodicDirectorChord(chord, offset = 0) {
  if (!Array.isArray(chord)) return chord;
  return chord.map((note) => melodicDirectorNote(note, stepIndex, offset, { role: "chord", contour: false }));
}

function advanceMelodicDirectorPhrase(context = {}) {
  const phraseBars = melodicDirectorPhraseBars();
  const phrase = Math.floor(GrooveState.cycle / Math.max(1, phraseBars));
  if (phrase === MelodicDirectorState.phrase && MelodicDirectorState.lastTurnCycle >= 0) return;
  const mode = EngineParams.mode || "ambient";
  const order = MELODIC_DIRECTOR_KEY_ORDER[mode] || MELODIC_DIRECTOR_KEY_ORDER.ambient;
  const energyNorm = context.energyNorm ?? clampValue(UCM_CUR.energy / 100, 0, 1);
  const creationNorm = context.creationNorm ?? clampValue(UCM_CUR.creation / 100, 0, 1);
  const observerNorm = context.observerNorm ?? clampValue(UCM_CUR.observer / 100, 0, 1);
  const voidNorm = context.voidNorm ?? clampValue(UCM_CUR.void / 100, 0, 1);
  const arcTurn = typeof LongformArcState !== "undefined" ? Math.floor((LongformArcState.turn || 0) * 2) : 0;
  const keyIndex = order[(phrase + arcTurn + Math.floor(observerNorm * 2)) % order.length] || 0;
  const contourIndex = (phrase + Math.floor(energyNorm * 3) + Math.floor(creationNorm * 2) + (voidNorm > 0.58 ? 4 : 0)) % MELODIC_DIRECTOR_CONTOURS.length;
  const key = MELODIC_DIRECTOR_KEYS[keyIndex] || MELODIC_DIRECTOR_KEYS[0];
  const contour = MELODIC_DIRECTOR_CONTOURS[contourIndex] || MELODIC_DIRECTOR_CONTOURS[0];
  MelodicDirectorState.phrase = phrase;
  MelodicDirectorState.phraseBars = phraseBars;
  MelodicDirectorState.lastTurnCycle = GrooveState.cycle;
  MelodicDirectorState.keyIndex = keyIndex;
  MelodicDirectorState.keyShift = key.shift || 0;
  MelodicDirectorState.keyLabel = key.label || key.id;
  MelodicDirectorState.contourIndex = contourIndex;
  MelodicDirectorState.contour = contour.id;
  MelodicDirectorState.contourDepth = clampValue(0.32 + creationNorm * 0.28 + observerNorm * 0.18 + energyNorm * 0.1 - voidNorm * 0.12, 0.2, 0.82);
  MelodicDirectorState.chordTurn = (phrase + keyIndex + contourIndex) % 4;
  rememberMotif(melodicDirectorNote("D5", stepIndex, 0, { role: "voice" }), {
    reply: melodicDirectorNote("F#5", stepIndex, 2, { role: "voice" }),
    shade: melodicDirectorNote("D4", stepIndex, 1, { role: "voice" }),
    strength: 0.08 + MelodicDirectorState.contourDepth * 0.08,
    air: mode === "ambient" || mode === "dub" ? 0.12 : 0.05,
    source: `melody:${key.id}:${contour.id}`
  });
}

function melodicDirectorRuntimeState() {
  return {
    phrase: MelodicDirectorState.phrase,
    phraseBars: MelodicDirectorState.phraseBars,
    key: MelodicDirectorState.keyLabel,
    keyShift: MelodicDirectorState.keyShift,
    contour: MelodicDirectorState.contour,
    contourDepth: MelodicDirectorState.contourDepth,
    lastTurnCycle: MelodicDirectorState.lastTurnCycle
  };
}

const BASSLINE_DIRECTOR_PATTERNS = {
  ambient: [
    { id: "anchor", pattern: "x...............", intervals: [0], durations: ["2n"], velocities: [0.82] },
    { id: "breath-fifth", pattern: "x.......o.......", intervals: [0, 7], durations: ["2n", "4n"], velocities: [0.78, 0.52] },
    { id: "soft-turn", pattern: "x.........o...o.", intervals: [0, 5, 7], durations: ["2n", "8n", "8n"], velocities: [0.72, 0.42, 0.38] }
  ],
  lofi: [
    { id: "dust-walk", pattern: "x...x...x...x...", intervals: [0, 7, 12, 7], durations: ["4n", "4n", "4n", "4n"], velocities: [0.9, 0.66, 0.76, 0.6] },
    { id: "minor-turn", pattern: "x...x...x...x.o.", intervals: [0, 3, 7, 10, 11], durations: ["4n", "4n", "4n", "8n", "16n"], velocities: [0.86, 0.62, 0.72, 0.58, 0.38] },
    { id: "side-pocket", pattern: "x...x.o.x...x...", intervals: [0, 4, 5, 7, 10], durations: ["4n", "8n", "16n", "4n", "8n"], velocities: [0.84, 0.56, 0.34, 0.68, 0.54] }
  ],
  dub: [
    { id: "drop-root", pattern: "x.......x.......", intervals: [0, 12], durations: ["2n", "4n"], velocities: [0.95, 0.58] },
    { id: "echo-fifth", pattern: "x...o.......x...", intervals: [0, 7, 5], durations: ["2n", "16n", "4n"], velocities: [0.9, 0.34, 0.54] },
    { id: "skank-turn", pattern: "x.....o.x...o...", intervals: [0, 10, 12, 7], durations: ["2n", "16n", "4n", "16n"], velocities: [0.86, 0.34, 0.54, 0.32] }
  ],
  jazz: [
    { id: "brush-walk", pattern: "x...x...x...x...", intervals: [0, 4, 7, 11], durations: ["4n", "4n", "4n", "4n"], velocities: [0.78, 0.58, 0.64, 0.56] },
    { id: "blue-walk", pattern: "x...x...x...x.o.", intervals: [0, 3, 7, 10, 11], durations: ["4n", "4n", "4n", "8n", "16n"], velocities: [0.76, 0.58, 0.62, 0.54, 0.36] },
    { id: "answer-walk", pattern: "x...x.o.x...x...", intervals: [0, 5, 6, 7, 9], durations: ["4n", "8n", "16n", "4n", "8n"], velocities: [0.76, 0.54, 0.32, 0.62, 0.48] }
  ],
  funk: [
    { id: "rubber-pocket", pattern: "x..x..o.x...x.o.", intervals: [0, 0, 7, 10, 7, 12], durations: ["8n", "16n", "16n", "8n", "8n", "16n"], velocities: [0.88, 0.5, 0.34, 0.72, 0.62, 0.38] },
    { id: "clavi-answer", pattern: "x...o.x...x.o...", intervals: [0, 5, 7, 10, 12], durations: ["8n", "16n", "16n", "8n", "16n"], velocities: [0.84, 0.42, 0.46, 0.7, 0.34] },
    { id: "late-push", pattern: "x.....x.o..x..o.", intervals: [0, 7, 5, 10, 12], durations: ["8n", "8n", "16n", "8n", "16n"], velocities: [0.82, 0.58, 0.36, 0.66, 0.34] }
  ],
  techno: [
    { id: "pulse-answer", pattern: "x.x...x.x...x...", intervals: [0, 0, 7, 0, 10], durations: ["8n", "16n", "8n", "16n", "8n"], velocities: [0.92, 0.48, 0.68, 0.42, 0.62] },
    { id: "machine-turn", pattern: "x..x..x.x..x..x.", intervals: [0, 5, 7, 0, 10, 12], durations: ["8n", "16n", "16n", "8n", "16n", "16n"], velocities: [0.9, 0.44, 0.48, 0.72, 0.42, 0.38] },
    { id: "acid-shadow", pattern: "x.x.x...x.x...o.", intervals: [0, 0, 3, 7, 0, 10, 12], durations: ["8n", "16n", "16n", "8n", "16n", "8n", "16n"], velocities: [0.9, 0.42, 0.36, 0.66, 0.42, 0.58, 0.34] }
  ],
  trance: [
    { id: "lift-pulse", pattern: "x.x...x.x...x...", intervals: [0, 0, 7, 12, 7], durations: ["8n", "16n", "8n", "16n", "8n"], velocities: [0.88, 0.46, 0.66, 0.42, 0.62] },
    { id: "sidechain-walk", pattern: "x..x..x.x..x..x.", intervals: [0, 2, 7, 0, 9, 12], durations: ["8n", "16n", "16n", "8n", "16n", "16n"], velocities: [0.86, 0.38, 0.48, 0.7, 0.4, 0.36] },
    { id: "answer-rise", pattern: "x.x...o.x.x...o.", intervals: [0, 0, 5, 7, 7, 10, 12], durations: ["8n", "16n", "16n", "8n", "16n", "8n", "16n"], velocities: [0.86, 0.4, 0.34, 0.64, 0.38, 0.56, 0.32] }
  ],
  piano: [
    { id: "felt-anchor", pattern: "x.......o.......", intervals: [0, 7], durations: ["2n", "4n"], velocities: [0.62, 0.38] },
    { id: "left-hand", pattern: "x...o...x.....o.", intervals: [0, 5, 7, 10], durations: ["4n", "16n", "4n", "16n"], velocities: [0.62, 0.3, 0.5, 0.28] }
  ],
  default: [
    { id: "default-turn", pattern: "x...x...x...x...", intervals: [0, 7, 12, 7], durations: ["4n", "4n", "4n", "4n"], velocities: [0.8, 0.58, 0.66, 0.52] }
  ]
};

const BasslineDirectorState = {
  phrase: 0,
  phraseBars: 4,
  lastTurnCycle: -1,
  patternIndex: 0,
  patternId: "anchor",
  density: 0.4,
  humanPush: 0,
  turnSemis: 0
};

function basslineDirectorPhraseBars(mode = EngineParams.mode) {
  if (mode === "ambient" || mode === "dub" || mode === "piano") return 8;
  return 4;
}

function basslineDirectorPatternsForMode(mode = EngineParams.mode) {
  return BASSLINE_DIRECTOR_PATTERNS[mode] || BASSLINE_DIRECTOR_PATTERNS.default;
}

function currentBasslineDirectorPattern() {
  const patterns = basslineDirectorPatternsForMode();
  return patterns[BasslineDirectorState.patternIndex % patterns.length] || patterns[0] || BASSLINE_DIRECTOR_PATTERNS.default[0];
}

function basslineDirectorActiveSteps(pattern = currentBasslineDirectorPattern()) {
  const chars = String(pattern?.pattern || "").split("");
  const steps = [];
  chars.forEach((ch, index) => {
    if (ch === "x" || ch === "o" || ch === "X") steps.push(index);
  });
  return steps.length ? steps : [0];
}

function basslineDirectorStepInfo(step = stepIndex) {
  const pattern = currentBasslineDirectorPattern();
  const steps = basslineDirectorActiveSteps(pattern);
  const pos = ((step % 16) + 16) % 16;
  let eventIndex = steps.indexOf(pos);
  if (eventIndex < 0) {
    let previous = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] <= pos) previous = i;
    }
    eventIndex = previous;
  }
  const intervals = pattern.intervals || [0];
  const durations = pattern.durations || [];
  const velocities = pattern.velocities || [];
  const ch = String(pattern.pattern || "")[pos] || "x";
  return {
    pattern,
    steps,
    pos,
    eventIndex,
    interval: intervals[eventIndex % intervals.length] || 0,
    duration: durations[eventIndex % durations.length] || "8n",
    velocityScale: velocities[eventIndex % velocities.length] ?? 1,
    ghost: ch === "o"
  };
}

function basslineDirectedPattern(basePattern = "") {
  const pattern = currentBasslineDirectorPattern()?.pattern || basePattern;
  if (!pattern) return basePattern;
  const targetLength = Math.max(1, (basePattern && basePattern.length) || EngineParams.stepCount || pattern.length || 16);
  if (pattern.length === targetLength) return pattern;
  let expanded = "";
  for (let i = 0; i < targetLength; i++) expanded += pattern[i % pattern.length] || ".";
  return expanded;
}

function transposeBassNote(note, semis = 0, options = {}) {
  const midi = noteNameToMidi(note);
  if (midi == null) return note;
  const minMidi = options.register === "sub" ? 12 : 16;
  const maxMidi = options.register === "sub" ? 32 : 42;
  let next = midi + Math.round(Number(semis) || 0);
  while (next > maxMidi) next -= 12;
  while (next < minMidi) next += 12;
  return midiToNoteName(next);
}

function basslineDirectorNoteForStep(step = stepIndex, rootNote = bassRoot, options = {}) {
  const info = basslineDirectorStepInfo(step);
  const register = options.register || (info.pos % 8 === 0 ? "sub" : "low");
  return transposeBassNote(rootNote || "D2", info.interval + BasslineDirectorState.turnSemis, { register });
}

function basslineDirectorDurationForStep(step = stepIndex, fallback = "8n") {
  const info = basslineDirectorStepInfo(step);
  if (fallback === "4n" && info.duration === "2n") return "4n";
  return info.duration || fallback;
}

function basslineDirectorVelocityScale(step = stepIndex) {
  const info = basslineDirectorStepInfo(step);
  const ghostScale = info.ghost ? 0.58 : 1;
  return clampValue((info.velocityScale || 1) * ghostScale * (0.92 + BasslineDirectorState.density * 0.16), 0.28, 1.14);
}

function triggerSamplerBasslineBar(sampler, time, options = {}) {
  if (!sampler || typeof Tone === "undefined") return;
  const steps = basslineDirectorActiveSteps().slice(0, Math.max(1, options.maxEvents || 6));
  const sixteenth = Tone.Time("16n").toSeconds();
  const rootNote = options.rootNote || bassRoot || "D2";
  const baseVelocity = options.baseVelocity ?? 0.58;
  for (const step of steps) {
    const info = basslineDirectorStepInfo(step);
    const note = basslineDirectorNoteForStep(step, rootNote, { register: options.register || (step % 8 === 0 ? "sub" : "low") });
    const duration = info.duration || options.fallbackDuration || "4n";
    const velocity = clampValue(baseVelocity * basslineDirectorVelocityScale(step), 0.16, options.maxVelocity || 0.72);
    const offset = step * sixteenth + (info.ghost ? BasslineDirectorState.humanPush : 0);
    sampler.triggerAttackRelease(note, duration, time + offset, velocity);
  }
}

function resetBasslineDirector() {
  BasslineDirectorState.phrase = 0;
  BasslineDirectorState.phraseBars = basslineDirectorPhraseBars();
  BasslineDirectorState.lastTurnCycle = -1;
  BasslineDirectorState.patternIndex = 0;
  BasslineDirectorState.patternId = currentBasslineDirectorPattern().id || "anchor";
  BasslineDirectorState.density = 0.4;
  BasslineDirectorState.humanPush = 0;
  BasslineDirectorState.turnSemis = 0;
}

function advanceBasslineDirectorPhrase(context = {}) {
  const phraseBars = basslineDirectorPhraseBars();
  const phrase = Math.floor(GrooveState.cycle / Math.max(1, phraseBars));
  if (phrase === BasslineDirectorState.phrase && BasslineDirectorState.lastTurnCycle >= 0) return;
  const mode = EngineParams.mode || "ambient";
  const patterns = basslineDirectorPatternsForMode(mode);
  const energyNorm = context.energyNorm ?? clampValue(UCM_CUR.energy / 100, 0, 1);
  const waveNorm = context.waveNorm ?? clampValue(UCM_CUR.wave / 100, 0, 1);
  const creationNorm = context.creationNorm ?? clampValue(UCM_CUR.creation / 100, 0, 1);
  const bodyNorm = clampValue(UCM_CUR.body / 100, 0, 1);
  const observerNorm = context.observerNorm ?? clampValue(UCM_CUR.observer / 100, 0, 1);
  const index = (phrase + Math.floor(energyNorm * 2) + Math.floor(waveNorm * 2) + Math.floor(creationNorm * 2) + MelodicDirectorState.chordTurn) % patterns.length;
  const turnPool = [0, 0, 5, 7, -2, 2];
  const turnSemis = turnPool[(phrase + MelodicDirectorState.keyIndex + Math.floor(observerNorm * 2)) % turnPool.length] || 0;
  const pattern = patterns[index] || patterns[0] || BASSLINE_DIRECTOR_PATTERNS.default[0];
  BasslineDirectorState.phrase = phrase;
  BasslineDirectorState.phraseBars = phraseBars;
  BasslineDirectorState.lastTurnCycle = GrooveState.cycle;
  BasslineDirectorState.patternIndex = index;
  BasslineDirectorState.patternId = pattern.id || "unknown";
  BasslineDirectorState.density = clampValue(0.28 + energyNorm * 0.28 + bodyNorm * 0.22 + waveNorm * 0.16 + creationNorm * 0.08, 0.18, 0.9);
  BasslineDirectorState.humanPush = clampValue(waveNorm * 0.012 + bodyNorm * 0.008, 0, 0.026);
  BasslineDirectorState.turnSemis = mode === "ambient" || mode === "piano" ? 0 : turnSemis;
}

function basslineDirectorRuntimeState() {
  const pattern = currentBasslineDirectorPattern();
  return {
    phrase: BasslineDirectorState.phrase,
    phraseBars: BasslineDirectorState.phraseBars,
    pattern: BasslineDirectorState.patternId,
    gate: pattern.pattern,
    density: BasslineDirectorState.density,
    turnSemis: BasslineDirectorState.turnSemis,
    lastTurnCycle: BasslineDirectorState.lastTurnCycle
  };
}

const GrooveState = {
  cycle: 0,
  accentStep: 7,
  fillActive: false,
  textureLift: 0,
  glassLift: 0,
  bassOffset: 0,
  microJitterScale: 1,
  floorWarmupSteps: 10
};
const WorldState = {
  spectrum: 0.35,
  key: "idm",
  label: "IDM DRIFT",
  micro: 0,
};
const TimbreState = {
  air: 0.45,
  glass: 0.4,
  grit: 0.35,
  fracture: 0.2,
  harp: 0.35,
  warmth: 0.3,
};
const GradientState = {
  haze: 0.45,
  memory: 0.35,
  micro: 0.3,
  ghost: 0.35,
  chrome: 0.35,
  organic: 0.35
};
const DepthState = {
  bed: 0.45,
  pulse: 0.34,
  particle: 0.36,
  lowMidClean: 0.34,
  tail: 0.42,
  gesture: 0.2
};
const GenreBlendState = {
  ambient: 0.45,
  idm: 0.34,
  techno: 0.14,
  pressure: 0.07
};
const GenreTimbreKitState = {
  ambientKit: 0.44,
  idmKit: 0.34,
  technoKit: 0.16,
  pressureKit: 0.12,
  spaceKit: 0.32
};
const MixGovernorState = {
  lowGuard: 0,
  clarity: 0.34,
  eventLoad: 0,
  lastAirCycle: -99
};
const INNER_SOURCE_FAMILY_KEYS = ["drumSkin", "pianoMemory", "voiceDust", "acidBiyon", "sub808", "reedBuzz", "chain"];
const SOURCE_DEPTH_PROFILES = [
  { name: "hazeBed", focus: "voiceDust", span: 12, weights: { voiceDust: 0.22, pianoMemory: 0.1, reedBuzz: 0.035, chain: 0.08 } },
  { name: "membrane", focus: "sub808", span: 12, weights: { sub808: 0.085, reedBuzz: 0.075, voiceDust: 0.12, chain: 0.06 } },
  { name: "memoryRefrain", focus: "pianoMemory", span: 9, weights: { pianoMemory: 0.22, chain: 0.12, voiceDust: 0.055 } },
  { name: "brokenSplice", focus: "drumSkin", span: 7, weights: { drumSkin: 0.13, chain: 0.11, acidBiyon: 0.05 } },
  { name: "ghostBody", focus: "drumSkin", span: 8, weights: { drumSkin: 0.1, sub808: 0.11, reedBuzz: 0.045, voiceDust: 0.055 } },
  { name: "chromeHymn", focus: "voiceDust", span: 11, weights: { voiceDust: 0.2, pianoMemory: 0.09, chain: 0.11 } },
  { name: "coldPulse", focus: "chain", span: 8, weights: { chain: 0.18, drumSkin: 0.07, acidBiyon: 0.09 } },
  { name: "earthBuzz", focus: "reedBuzz", span: 21, weights: { reedBuzz: 0.16, sub808: 0.045, voiceDust: 0.08, chain: 0.045 } }
];
const TimbreFamilyState = {
  drumSkin: 0.18,
  pianoMemory: 0.26,
  voiceDust: 0.2,
  acidBiyon: 0,
  sub808: 0.14,
  reedBuzz: 0.06,
  chain: 0.3,
  lastReedBuzzCycle: -99,
  inner: {
    drumSkin: 0.18,
    pianoMemory: 0.26,
    voiceDust: 0.2,
    acidBiyon: 0,
    sub808: 0.14,
    reedBuzz: 0.06,
    chain: 0.3,
    bloom: 0,
    focus: "pianoMemory",
    profile: "memoryRefrain",
    profileIndex: 2,
    generation: 0,
    lastTick: -1
  }
};

const PRESET_CHARACTERS = {
  ambient: {
    label: "submerged chapel",
    air: 0.22,
    glass: 0.16,
    grit: -0.18,
    fracture: -0.1,
    harp: 0.2,
    warmth: 0.16,
    restScale: 1.18,
    kickScale: 0.62,
    hatScale: 0.7,
    bassScale: 0.72,
    padScale: 1.2,
    textureScale: 0.7,
    glassScale: 1.24,
    organicScale: 1.18,
    dustScale: 0.78,
    pressureColor: 0.18,
    hazeScale: 1.24,
    pulseScale: 0.72,
  },
  dub: {
    label: "echo pressure",
    air: 0.02,
    glass: -0.03,
    grit: 0.08,
    fracture: -0.02,
    harp: -0.04,
    warmth: 0.22,
    restScale: 0.98,
    kickScale: 0.9,
    hatScale: 0.78,
    bassScale: 1.16,
    padScale: 0.86,
    textureScale: 0.82,
    glassScale: 0.8,
    organicScale: 0.78,
    dustScale: 0.9,
    pressureColor: 0.64,
    hazeScale: 0.9,
    pulseScale: 1.02,
  },
  jazz: {
    label: "bent circuitry",
    air: 0.06,
    glass: 0.1,
    grit: -0.02,
    fracture: 0.08,
    harp: 0.12,
    warmth: 0.12,
    restScale: 0.92,
    kickScale: 0.78,
    hatScale: 1.0,
    bassScale: 0.94,
    padScale: 1.02,
    textureScale: 0.95,
    glassScale: 1.06,
    organicScale: 1.2,
    dustScale: 0.98,
    pressureColor: 0.38,
    hazeScale: 1.02,
    pulseScale: 0.88,
  },
  lofi: {
    label: "dust memory",
    air: 0.08,
    glass: 0.04,
    grit: 0.04,
    fracture: -0.04,
    harp: 0.08,
    warmth: 0.24,
    restScale: 1.04,
    kickScale: 0.82,
    hatScale: 0.86,
    bassScale: 0.88,
    padScale: 1.14,
    textureScale: 0.9,
    glassScale: 0.94,
    organicScale: 1.14,
    dustScale: 1.18,
    pressureColor: 0.42,
    hazeScale: 1.16,
    pulseScale: 0.92,
  },
  techno: {
    label: "machine weather",
    air: -0.1,
    glass: -0.02,
    grit: 0.18,
    fracture: 0.16,
    harp: -0.1,
    warmth: 0.02,
    restScale: 0.74,
    kickScale: 1.12,
    hatScale: 1.1,
    bassScale: 1.08,
    padScale: 0.78,
    textureScale: 1.12,
    glassScale: 0.84,
    organicScale: 0.68,
    dustScale: 1.04,
    pressureColor: 0.92,
    hazeScale: 0.74,
    pulseScale: 1.18,
  },
  trance: {
    label: "acid horizon",
    air: -0.01,
    glass: 0.1,
    grit: 0.14,
    fracture: 0.14,
    harp: 0.14,
    warmth: 0.02,
    restScale: 0.78,
    kickScale: 1.02,
    hatScale: 1.04,
    bassScale: 0.98,
    padScale: 0.96,
    textureScale: 1.04,
    glassScale: 1.08,
    organicScale: 0.84,
    dustScale: 0.94,
    pressureColor: 0.86,
    hazeScale: 0.9,
    pulseScale: 1.14,
  },
};

const HARP_NOTE_POOLS = {
  ambient: ["D4", "F#4", "G4", "E5", "D5", "F#5"],
  dub: ["D4", "A4", "E5", "G5", "F#5"],
  jazz: ["D4", "F#4", "A4", "B4", "E5", "G5"],
  lofi: ["D4", "E4", "F#4", "G4", "D5", "E5"],
  techno: ["D4", "F#4", "G4", "E5", "D5"],
  trance: ["D4", "F#4", "A4", "B4", "E5", "G5"],
};

function currentPresetCharacter() {
  return PRESET_CHARACTERS[EngineParams.mode] || PRESET_CHARACTERS.ambient;
}

function unitValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clampValue(numeric / 100, 0, 1);
}

function currentGradientParts() {
  const energy = unitValue(UCM_CUR.energy);
  const wave = unitValue(UCM_CUR.wave);
  const mind = unitValue(UCM_CUR.mind);
  const creation = unitValue(UCM_CUR.creation);
  const voidness = unitValue(UCM_CUR.void);
  const circle = unitValue(UCM_CUR.circle);
  const body = unitValue(UCM_CUR.body);
  const resource = unitValue(UCM_CUR.resource);
  const observer = unitValue(UCM_CUR.observer);
  const ethereal = (wave + voidness + observer) / 3;
  const pressure = clampValue((energy * 0.34) + (creation * 0.22) + (resource * 0.18) + (body * 0.16) + (wave * 0.1) - (voidness * 0.08), 0, 1);
  return { energy, wave, mind, creation, voidness, circle, body, resource, observer, ethereal, pressure };
}

function updateWorldStateFromUCM() {
  const energy = unitValue(UCM_CUR.energy);
  const wave = unitValue(UCM_CUR.wave);
  const mind = unitValue(UCM_CUR.mind);
  const creation = unitValue(UCM_CUR.creation);
  const voidness = unitValue(UCM_CUR.void);
  const circle = unitValue(UCM_CUR.circle);
  const body = unitValue(UCM_CUR.body);
  const resource = unitValue(UCM_CUR.resource);
  const observer = unitValue(UCM_CUR.observer);

  const ethereal = clampValue((observer * 0.3) + (circle * 0.24) + (voidness * 0.24) + ((1 - energy) * 0.22), 0, 1);
  const pressure = clampValue((energy * 0.34) + (creation * 0.22) + (resource * 0.18) + (body * 0.16) + (wave * 0.1) - (voidness * 0.08), 0, 1);
  const spectrum = clampValue((pressure * 0.74) + ((1 - ethereal) * 0.26), 0, 1);

  WorldState.spectrum = spectrum;
  WorldState.micro = clampValue((wave * 0.4) + (creation * 0.24) + (observer * 0.18) + (energy * 0.18), 0, 1);

  if (spectrum < 0.34) {
    WorldState.key = "ambient";
    WorldState.label = "LIMINAL AMBIENT";
  } else if (spectrum > 0.72) {
    WorldState.key = "hardcore";
    WorldState.label = "HARDCORE WEATHER";
  } else {
    WorldState.key = "idm";
    WorldState.label = "IDM DRIFT";
  }

  updateTimbreStateFromWorld({ energy, wave, mind, creation, voidness, circle, body, resource, observer, ethereal, pressure });
  if (GenreBlendState.ambient > 0.42) {
    WorldState.key = "ambient";
    WorldState.label = "LIMINAL AMBIENT";
  } else if (GenreBlendState.pressure > 0.26 && GenreBlendState.techno > 0.24) {
    WorldState.key = "hardcore";
    WorldState.label = "PRESSURE PULSE";
  } else if (GenreBlendState.techno > GenreBlendState.idm && GenreBlendState.techno > 0.3) {
    WorldState.key = "hardcore";
    WorldState.label = "TECHNO GRID";
  } else {
    WorldState.key = "idm";
    WorldState.label = "IDM DRIFT";
  }
  renderModeLabel();
  const bodyEl = document.body;
  if (bodyEl) {
    bodyEl.dataset.world = WorldState.key;
    bodyEl.dataset.character = EngineParams.mode;
  }
  return WorldState;
}

function renderModeLabel() {
  const label = document.getElementById("mode-label");
  if (!label) return;
  const modeName = EngineParams.mode === "trance" ? "ACID.TECH" : EngineParams.mode.toUpperCase();
  const arcPrefix = albumArcActive() ? `${currentAlbumArcChapter().label} / ` : "";
  const cultureLabel = CultureGrammarState.label || "AUTO";
  label.textContent = `${arcPrefix}${modeName} / ${cultureLabel} / ${WorldState.label} / ${currentPresetCharacter().label}`;
}


function safeToneRamp(param, value, seconds = 0.18) {
  if (!param || typeof param.rampTo !== "function") return;
  let target = Number(value);
  if (!Number.isFinite(target)) return;
  const minValue = Number.isFinite(param.minValue) ? param.minValue : null;
  const maxValue = Number.isFinite(param.maxValue) ? param.maxValue : null;
  if (minValue !== null && maxValue !== null) {
    if (minValue === maxValue) return;
    target = clampValue(target, minValue, maxValue);
  }
  try {
    const startTime = currentToneContextTime();
    if (typeof param.linearRampTo === "function") {
      param.linearRampTo(target, seconds, startTime);
      return;
    }
    param.rampTo(target, seconds, startTime);
  } catch (error) {
    console.warn("[Music] Timbre ramp failed:", error);
  }
}

function setEnvelopeValue(envelope, key, value) {
  if (!envelope || typeof envelope[key] !== "number") return;
  envelope[key] = value;
}

function updateReferenceGradient(parts) {
  const { energy, wave, mind, creation, voidness, circle, body, resource, observer, pressure } = parts;
  const harshness = clampValue((pressure * 0.58) + (resource * 0.24) + (energy * 0.18), 0, 1);
  const genre = GenreBlendState;
  const tempoLift = clampValue(DJTempoState.motion / 22, -1, 1);
  const tempoRise = Math.max(0, tempoLift);
  const tempoFall = Math.max(0, -tempoLift);

  GradientState.haze = clampValue((circle * 0.28) + (observer * 0.28) + (voidness * 0.18) + ((1 - energy) * 0.18) + ((1 - resource) * 0.08), 0, 1);
  GradientState.memory = clampValue((wave * 0.32) + (circle * 0.28) + (mind * 0.22) + ((1 - harshness) * 0.18), 0, 1);
  GradientState.micro = clampValue((creation * 0.34) + (resource * 0.32) + (observer * 0.18) + (wave * 0.16), 0, 1);
  GradientState.ghost = clampValue((body * 0.28) + (voidness * 0.28) + (observer * 0.22) + ((1 - energy) * 0.1) + (pressure * 0.12), 0, 1);
  GradientState.chrome = clampValue((mind * 0.3) + (observer * 0.3) + (circle * 0.24) + (creation * 0.12) + ((1 - voidness) * 0.04), 0, 1);
  GradientState.organic = clampValue((wave * 0.28) + (creation * 0.26) + (circle * 0.16) + (observer * 0.14) + ((1 - harshness) * 0.16), 0, 1);

  GradientState.haze = clampValue(GradientState.haze + genre.ambient * 0.08 - genre.techno * 0.035 + tempoFall * 0.04, 0, 1);
  GradientState.memory = clampValue(GradientState.memory + genre.idm * 0.055 + genre.ambient * 0.025 + tempoFall * 0.025, 0, 1);
  GradientState.micro = clampValue(GradientState.micro + genre.idm * 0.07 + genre.techno * 0.085 + tempoRise * 0.05, 0, 1);
  GradientState.ghost = clampValue(GradientState.ghost + genre.techno * 0.045 + genre.pressure * 0.09 + tempoRise * 0.035, 0, 1);
  GradientState.chrome = clampValue(GradientState.chrome + genre.ambient * 0.035 + genre.idm * 0.035 + tempoFall * 0.02, 0, 1);
  GradientState.organic = clampValue(GradientState.organic + genre.idm * 0.045 + genre.ambient * 0.02 - genre.techno * 0.018 + tempoRise * 0.02, 0, 1);

  if (BpmCrossfadeState.blend > 0) {
    const fromBias = bpmZoneGradientBias(BpmCrossfadeState.previousZone);
    const toBias = bpmZoneGradientBias(BpmCrossfadeState.zone);
    const blend = BpmCrossfadeState.blend;
    for (const key of Object.keys(GradientState)) {
      const mixedBias = (fromBias[key] || 0) * 0.42 + (toBias[key] || 0) * 0.58;
      GradientState[key] = clampValue(GradientState[key] + mixedBias * blend, 0, 1);
    }
  }

  if (GenomeState.growth > 0) {
    const genes = GenomeState.genes;
    const genomeScale = clampValue(GenomeState.growth * 0.2 + GenomeState.resonance * 0.08, 0, 0.24);
    GradientState.haze = clampValue(GradientState.haze + genes.haze * genomeScale + genes.voidTail * genomeScale * 0.32, 0, 1);
    GradientState.memory = clampValue(GradientState.memory + genes.refrain * genomeScale * 0.5 + genes.organic * genomeScale * 0.32, 0, 1);
    GradientState.micro = clampValue(GradientState.micro + genes.micro * genomeScale + genes.pressure * genomeScale * 0.2, 0, 1);
    GradientState.ghost = clampValue(GradientState.ghost + genes.pulse * genomeScale * 0.58 + genes.pressure * genomeScale * 0.6, 0, 1);
    GradientState.chrome = clampValue(GradientState.chrome + genes.chrome * genomeScale + genes.voidTail * genomeScale * 0.24, 0, 1);
    GradientState.organic = clampValue(GradientState.organic + genes.organic * genomeScale + genes.refrain * genomeScale * 0.18, 0, 1);
  }

  const color = PerformanceColorDriftState;
  GradientState.haze = clampValue(GradientState.haze + color.haze * 0.045 - color.acid * 0.018, 0, 1);
  GradientState.memory = clampValue(GradientState.memory + color.haze * 0.018 + color.dust * 0.025, 0, 1);
  GradientState.micro = clampValue(GradientState.micro + color.dust * 0.046 + color.acid * 0.07, 0, 1);
  GradientState.ghost = clampValue(GradientState.ghost + color.pressure * 0.04 + color.acid * 0.032, 0, 1);
  GradientState.chrome = clampValue(GradientState.chrome + color.chrome * 0.052 + color.acid * 0.018, 0, 1);
  GradientState.organic = clampValue(GradientState.organic + color.dust * 0.042 + color.haze * 0.015, 0, 1);

  const voiceScale = 0.68;
  for (const key of Object.keys(GradientState)) {
    GradientState[key] = clampValue(GradientState[key] + voiceGradientBias(key) * voiceScale, 0, 1);
  }

  if (longformArcActive()) {
    const arc = currentLongformArcStage();
    const arcShape = longformArcShape();
    const turnGlow = LongformArcState.turn * 0.035;
    for (const key of Object.keys(GradientState)) {
      GradientState[key] = clampValue(GradientState[key] + (arc.gradient?.[key] || 0) * arcShape + turnGlow, 0, 1);
    }
  }

  if (albumArcActive()) {
    for (const key of Object.keys(GradientState)) {
      GradientState[key] = clampValue(GradientState[key] + albumArcGradientBias(key) + AlbumArcState.chapterTurn * 0.012, 0, 1);
    }
  }

  for (const key of Object.keys(GradientState)) {
    GradientState[key] = clampValue(GradientState[key] + cultureGradientBias(key), 0, 1);
  }

  for (const key of Object.keys(GradientState)) {
    GradientState[key] = clampValue(GradientState[key] + oddLogicGradientBias(key), 0, 1);
  }

  if (PerformancePadState.drift) {
    GradientState.haze = clampValue(GradientState.haze + 0.08, 0, 1);
    GradientState.memory = clampValue(GradientState.memory + 0.12, 0, 1);
    GradientState.chrome = clampValue(GradientState.chrome + 0.1, 0, 1);
  }
  if (PerformancePadState.repeat) {
    GradientState.micro = clampValue(GradientState.micro + 0.15, 0, 1);
    GradientState.organic = clampValue(GradientState.organic + 0.06, 0, 1);
  }
  if (PerformancePadState.punch) {
    GradientState.ghost = clampValue(GradientState.ghost + 0.12, 0, 1);
    GradientState.organic = clampValue(GradientState.organic + 0.06, 0, 1);
  }
  if (PerformancePadState.void) {
    GradientState.haze = clampValue(GradientState.haze + 0.12, 0, 1);
    GradientState.chrome = clampValue(GradientState.chrome + 0.1, 0, 1);
  }

  return GradientState;
}

function updateReferenceDepth(parts, gradient = GradientState) {
  const { energy, mind, creation, voidness, circle, body, resource, observer } = parts;
  const tempoLift = clampValue(DJTempoState.motion / 24, -1, 1);
  const tempoRise = Math.max(0, tempoLift);
  const tempoFall = Math.max(0, -tempoLift);
  const padIntensity = clampValue(
    PerformancePadState.drift +
      PerformancePadState.repeat +
      PerformancePadState.punch +
      PerformancePadState.void,
    0,
    1
  );
  const arcShape = longformArcShape();
  const arcStage = currentLongformArcStage();
  const genre = GenreBlendState;
  const bpmBlend = BpmCrossfadeState.blend;
  const refrain = BpmCrossfadeState.refrain;
  const genes = GenomeState.genes;
  const genomeGrowth = GenomeState.growth;
  const voiceHaze = voiceGeneBias("haze");
  const voicePulse = voiceGeneBias("pulse");
  const voiceMicro = voiceGeneBias("micro");
  const voiceChrome = voiceGeneBias("chrome");
  const voiceOrganic = voiceGeneBias("organic");
  const voiceRefrain = voiceGeneBias("refrain");
  const voiceVoidTail = voiceGeneBias("voidTail");
  const voicePressure = voiceGeneBias("pressure");

  DepthState.bed = clampValue(
    (gradient.haze * 0.34) +
      (gradient.memory * 0.18) +
      (circle * 0.18) +
      (observer * 0.16) +
      ((1 - energy) * 0.14) +
      genre.ambient * 0.04 -
      genre.techno * 0.02 +
      tempoFall * 0.035 -
      tempoRise * 0.018 +
      bpmBlend * 0.018 +
      refrain * 0.012 +
      genes.haze * genomeGrowth * 0.03 +
      genes.voidTail * genomeGrowth * 0.018 +
      voiceHaze * 0.018 +
      voiceVoidTail * 0.012 +
      arcShape * (arcStage.name === "submerge" || arcStage.name === "exhale" ? 0.045 : 0.018),
    0,
    1
  );
  DepthState.pulse = clampValue(
    (gradient.ghost * 0.3) +
      (energy * 0.18) +
      (body * 0.16) +
      (gradient.micro * 0.14) +
      (resource * 0.12) +
      ((1 - voidness) * 0.1) +
      genre.techno * 0.045 +
      genre.pressure * 0.035 +
      tempoRise * 0.04 -
      tempoFall * 0.016 +
      bpmBlend * 0.026 +
      genes.pulse * genomeGrowth * 0.032 +
      genes.pressure * genomeGrowth * 0.026 +
      voicePulse * 0.018 +
      voicePressure * 0.012 +
      arcShape * (arcStage.name === "root" ? 0.035 : 0.012),
    0,
    1
  );
  DepthState.particle = clampValue(
    (gradient.chrome * 0.24) +
      (gradient.micro * 0.22) +
      (gradient.organic * 0.2) +
      (creation * 0.16) +
      (mind * 0.12) +
      (observer * 0.06) +
      genre.idm * 0.045 +
      genre.techno * 0.035 +
      tempoRise * 0.046 +
      tempoFall * 0.012 +
      bpmBlend * 0.04 +
      refrain * 0.025 +
      genes.micro * genomeGrowth * 0.04 +
      genes.chrome * genomeGrowth * 0.025 +
      genes.organic * genomeGrowth * 0.025 +
      voiceMicro * 0.024 +
      voiceChrome * 0.018 +
      voiceOrganic * 0.016 +
      arcShape * (arcStage.name === "sprout" || arcStage.name === "ferment" ? 0.04 : 0.014),
    0,
    1
  );
  DepthState.lowMidClean = clampValue(
    (gradient.chrome * 0.2) +
      (voidness * 0.2) +
      (observer * 0.18) +
      ((1 - resource) * 0.16) +
      ((1 - body) * 0.14) +
      (gradient.haze * 0.12) +
      genre.ambient * 0.025 +
      genre.techno * 0.018 +
      tempoFall * 0.014 -
      tempoRise * 0.01 +
      bpmBlend * 0.008 +
      genes.chrome * genomeGrowth * 0.012 +
      genes.voidTail * genomeGrowth * 0.01 -
      genes.pressure * genomeGrowth * 0.008 +
      voiceChrome * 0.01 +
      voiceVoidTail * 0.012 -
      voicePressure * 0.006 +
      arcShape * (arcStage.name === "submerge" || arcStage.name === "exhale" ? 0.025 : 0.008),
    0,
    1
  );
  DepthState.tail = clampValue(
    (gradient.haze * 0.28) +
      (gradient.chrome * 0.22) +
      (voidness * 0.18) +
      (observer * 0.18) +
      (circle * 0.14) +
      genre.ambient * 0.04 -
      genre.techno * 0.014 +
      tempoFall * 0.045 -
      tempoRise * 0.012 +
      refrain * 0.018 +
      genes.voidTail * genomeGrowth * 0.04 +
      genes.haze * genomeGrowth * 0.02 +
      voiceVoidTail * 0.024 +
      voiceHaze * 0.012 +
      voiceChrome * 0.008 +
      arcShape * (arcStage.name === "exhale" ? 0.05 : 0.018),
    0,
    1
  );
  DepthState.gesture = clampValue(
    (padIntensity * 0.45) +
      (gradient.micro * 0.15) +
      (gradient.ghost * 0.14) +
      (gradient.organic * 0.12) +
      (gradient.chrome * 0.08) +
      (body * 0.06) +
      genre.idm * 0.03 +
      genre.techno * 0.035 +
      genre.pressure * 0.04 +
      tempoRise * 0.05 +
      tempoFall * 0.012 +
      bpmBlend * 0.045 +
      refrain * 0.042 +
      genes.refrain * genomeGrowth * 0.05 +
      genes.micro * genomeGrowth * 0.026 +
      voiceRefrain * 0.022 +
      voiceMicro * 0.012 +
      voiceOrganic * 0.01 +
      LongformArcState.turn * 0.06,
    0,
    1
  );

  return DepthState;
}

function nudgeInnerSourceFamily(key, amount = 0.035) {
  const inner = TimbreFamilyState.inner;
  if (!inner || !INNER_SOURCE_FAMILY_KEYS.includes(key)) return;
  const safeAmount = clampValue(Number.isFinite(amount) ? amount : 0.035, 0, 0.14);
  inner[key] = clampValue((inner[key] || 0) + safeAmount, 0, 1);
  inner.bloom = clampValue((inner.bloom || 0) + safeAmount * 0.42, 0, 1);
  inner.focus = key;
}

function dominantInnerSourceFamily(inner = TimbreFamilyState.inner) {
  let bestKey = "chain";
  let bestValue = -1;
  for (const key of INNER_SOURCE_FAMILY_KEYS) {
    const value = Number(inner?.[key]) || 0;
    if (value > bestValue) {
      bestValue = value;
      bestKey = key;
    }
  }
  return bestKey;
}

function sourceDepthProfileByName(name) {
  return SOURCE_DEPTH_PROFILES.find((profile) => profile.name === name) || SOURCE_DEPTH_PROFILES[0];
}

function chooseInnerSourceProfile(parts, gradient, depth, genre) {
  const energy = clampValue(parts.energy ?? unitValue(UCM_CUR.energy), 0, 1);
  const voidness = clampValue(parts.voidness ?? unitValue(UCM_CUR.void), 0, 1);
  const observer = clampValue(parts.observer ?? unitValue(UCM_CUR.observer), 0, 1);
  const evolution = HazamaBridgeState.evolution || {};
  const hazamaAir = HazamaBridgeState.active ? clampValue(evolution.air || 0, 0, 1) : 0;
  const hazamaPulse = HazamaBridgeState.active ? clampValue(evolution.pulse || 0, 0, 1) : 0;
  const hazamaMicro = HazamaBridgeState.active ? clampValue(evolution.micro || 0, 0, 1) : 0;
  const hazamaBloom = HazamaBridgeState.active ? clampValue(evolution.bloom || 0, 0, 1) : 0;
  const lowBpm = EngineParams.bpm < 82 || genre.ambient > 0.5 || energy < 0.32;
  const acid = acidPerformanceAmount();
  const culture = CultureGrammarState.active || "ambient_room";
  const oddProfile = oddLogicSourceProfileName();

  if (oddProfile && (OddLogicDirectorState.askPulse > 0.2 || GrooveState.cycle % 5 === 0 || OddLogicDirectorState.intensity > 0.56)) return sourceDepthProfileByName(oddProfile);
  if (culture === "earth_reed" && lowBpm) return sourceDepthProfileByName("earthBuzz");
  if (culture === "chrome_hymn" && (lowBpm || gradient.chrome > 0.46)) return sourceDepthProfileByName("chromeHymn");
  if (culture === "ambient_room" && lowBpm) return sourceDepthProfileByName("hazeBed");
  if (culture === "tape_memory" && gradient.memory > 0.36) return sourceDepthProfileByName("memoryRefrain");
  if (culture === "broken_machine" && gradient.micro > 0.34) return sourceDepthProfileByName("brokenSplice");
  if (culture === "ghost_dub" && gradient.ghost > 0.34) return sourceDepthProfileByName("ghostBody");
  if ((culture === "acid_core" || acid > 0.18) && (acid > 0.1 || genre.techno > 0.16 || parts.creation > 0.28 || parts.resource > 0.34)) return sourceDepthProfileByName("coldPulse");
  if (acid > 0.18 && (genre.techno > 0.16 || parts.creation > 0.28 || parts.resource > 0.34)) return sourceDepthProfileByName("coldPulse");
  if (hazamaMicro > 0.55 || gradient.micro > 0.58) return sourceDepthProfileByName("brokenSplice");
  if (hazamaPulse > 0.58 || gradient.ghost > 0.56) return sourceDepthProfileByName("ghostBody");
  if (hazamaBloom > 0.48 || observer > 0.62 || gradient.chrome > 0.58 || PerformancePadState.void) return sourceDepthProfileByName("chromeHymn");
  if (lowBpm && (gradient.ghost > 0.45 || depth.bed > 0.56) && GrooveState.cycle % 21 < 3) return sourceDepthProfileByName("earthBuzz");
  if (lowBpm && (voidness > 0.48 || hazamaAir > 0.42 || depth.bed > 0.55)) return sourceDepthProfileByName("hazeBed");
  if (lowBpm || depth.bed > 0.54) return sourceDepthProfileByName("membrane");
  if (gradient.memory > 0.52 || MotifMemoryState.strength > 0.22) return sourceDepthProfileByName("memoryRefrain");
  return SOURCE_DEPTH_PROFILES[(Math.floor((GrooveState.cycle + GenomeState.generation) * GOLDEN_RATIO_INVERSE) + SOURCE_DEPTH_PROFILES.length) % SOURCE_DEPTH_PROFILES.length];
}

function updateInnerSourceFamily(parts, gradient = GradientState, depth = DepthState, genre = GenreBlendState) {
  const inner = TimbreFamilyState.inner;
  if (!inner) return {};
  const tick = (GrooveState.cycle * 32) + (stepIndex % 32);
  if (inner.lastTick === tick) return inner;
  inner.lastTick = tick;

  const profile = chooseInnerSourceProfile(parts, gradient, depth, genre);
  const span = Math.max(4, profile.span || 8);
  const shouldTurn = GrooveState.cycle % span === 0 || inner.profile !== profile.name;
  if (shouldTurn && inner.profile !== profile.name) {
    inner.profile = profile.name;
    inner.profileIndex = SOURCE_DEPTH_PROFILES.indexOf(profile);
    inner.generation += 1;
    inner.bloom = clampValue((inner.bloom || 0) + 0.12, 0, 1);
  }

  const acid = acidPerformanceAmount();
  const lowBpm = EngineParams.bpm < 82 || genre.ambient > 0.5 || parts.energy < 0.32;
  const profileWeights = profile.weights || {};
  const targets = {
    drumSkin: clampValue((profileWeights.drumSkin || 0) + genre.techno * 0.08 + genre.pressure * 0.055 + depth.pulse * 0.045 + acid * 0.045 + albumArcFamilyBias("drumSkin") + cultureFamilyBias("drumSkin") + oddLogicFamilyBias("drumSkin") - (lowBpm ? 0.12 : 0), 0, 1),
    pianoMemory: clampValue((profileWeights.pianoMemory || 0) + gradient.memory * 0.09 + gradient.organic * 0.055 + MotifMemoryState.strength * 0.065 + albumArcFamilyBias("pianoMemory") + cultureFamilyBias("pianoMemory") + oddLogicFamilyBias("pianoMemory") + (lowBpm ? 0.065 : 0), 0, 1),
    voiceDust: clampValue((profileWeights.voiceDust || 0) + gradient.chrome * 0.08 + depth.tail * 0.07 + (HazamaBridgeState.active ? 0.035 : 0) + albumArcFamilyBias("voiceDust") + cultureFamilyBias("voiceDust") + oddLogicFamilyBias("voiceDust") + (lowBpm ? 0.075 : 0), 0, 1),
    acidBiyon: clampValue((profileWeights.acidBiyon || 0) + acid * 0.24 + genre.techno * 0.06 + gradient.micro * 0.055 + albumArcFamilyBias("acidBiyon") + cultureFamilyBias("acidBiyon") + oddLogicFamilyBias("acidBiyon") - parts.voidness * 0.08, 0, 1),
    sub808: clampValue((profileWeights.sub808 || 0) + gradient.ghost * 0.06 + parts.body * 0.055 + acid * 0.075 + albumArcFamilyBias("sub808") + cultureFamilyBias("sub808") + oddLogicFamilyBias("sub808") - MixGovernorState.lowGuard * 0.14 - (lowBpm ? 0.065 : 0), 0, 1),
    reedBuzz: clampValue((profileWeights.reedBuzz || 0) + gradient.ghost * 0.052 + depth.bed * 0.045 + parts.body * 0.03 + (HazamaBridgeState.active ? 0.022 : 0) + albumArcFamilyBias("reedBuzz") + cultureFamilyBias("reedBuzz") + oddLogicFamilyBias("reedBuzz") + (lowBpm ? 0.05 : 0) - acid * 0.07 - MixGovernorState.lowGuard * 0.1, 0, 1),
    chain: clampValue((profileWeights.chain || 0) + GenomeState.growth * 0.05 + BpmCrossfadeState.refrain * 0.05 + gradient.organic * 0.05 + albumArcFamilyBias("chain") + cultureFamilyBias("chain") + oddLogicFamilyBias("chain") + (UCM.auto.enabled || HazamaBridgeState.active ? 0.04 : 0), 0, 1)
  };

  for (const key of INNER_SOURCE_FAMILY_KEYS) {
    inner[key] = approachValue(inner[key] || 0, targets[key], 0.012 + (inner.bloom || 0) * 0.006);
  }
  inner.bloom = clampValue((inner.bloom || 0) * 0.965 + (MotifMemoryState.strength || 0) * 0.004 + (PerformancePadState.drift + PerformancePadState.repeat + PerformancePadState.punch + PerformancePadState.void) * 0.002, 0, 1);
  inner.focus = dominantInnerSourceFamily(inner);
  return inner;
}

function updateTimbreFamilyBlend(parts, gradient = GradientState, depth = DepthState, genre = GenreBlendState) {
  const energy = clampValue(parts.energy ?? unitValue(UCM_CUR.energy), 0, 1);
  const wave = clampValue(parts.wave ?? unitValue(UCM_CUR.wave), 0, 1);
  const creation = clampValue(parts.creation ?? unitValue(UCM_CUR.creation), 0, 1);
  const voidness = clampValue(parts.voidness ?? unitValue(UCM_CUR.void), 0, 1);
  const circle = clampValue(parts.circle ?? unitValue(UCM_CUR.circle), 0, 1);
  const body = clampValue(parts.body ?? unitValue(UCM_CUR.body), 0, 1);
  const resource = clampValue(parts.resource ?? unitValue(UCM_CUR.resource), 0, 1);
  const observer = clampValue(parts.observer ?? unitValue(UCM_CUR.observer), 0, 1);
  const pressure = clampValue(parts.pressure ?? 0, 0, 1);
  const evolution = HazamaBridgeState.evolution || {};
  const hazamaAir = HazamaBridgeState.active ? clampValue(evolution.air || 0, 0, 1) : 0;
  const hazamaPulse = HazamaBridgeState.active ? clampValue(evolution.pulse || 0, 0, 1) : 0;
  const hazamaMicro = HazamaBridgeState.active ? clampValue(evolution.micro || 0, 0, 1) : 0;
  const hazamaBloom = HazamaBridgeState.active ? clampValue(evolution.bloom || 0, 0, 1) : 0;
  const acid = acidPerformanceAmount();
  const autoDrive = UCM.auto.enabled || HazamaBridgeState.active ? 1 : 0;
  const motif = MotifMemoryState.strength || 0;
  const genome = clampValue(GenomeState.growth * 0.42 + GenomeState.resonance * 0.28, 0, 1);
  const refrain = clampValue(BpmCrossfadeState.refrain + VoiceEmergenceState.refrain * 0.5, 0, 1);
  const lowGuard = MixGovernorState.lowGuard;
  const kits = GenreTimbreKitState;
  const tenderHabit = producerHabitBias("tenderMemory");
  const gridHabit = producerHabitBias("dryGrid");
  const pressureHabit = producerHabitBias("ghostPressure");
  const spaceHabit = producerHabitBias("transparentVoid");
  const rubberHabit = producerHabitBias("rubberEdit");
  const restraintHabit = producerHabitBias("restraint");
  const inner = updateInnerSourceFamily(parts, gradient, depth, genre);
  const innerLift = 0.035 + (inner.bloom || 0) * 0.035;

  const drumTarget = clampValue(
    genre.techno * 0.3 +
      genre.pressure * 0.2 +
      depth.pulse * 0.15 +
      resource * 0.12 +
      creation * 0.075 +
      kits.technoKit * 0.1 +
      kits.idmKit * 0.045 +
      kits.pressureKit * 0.055 +
      hazamaPulse * 0.08 +
      acid * 0.1 -
      kits.ambientKit * 0.055 -
      genre.ambient * 0.18 -
      voidness * 0.14 +
      albumArcFamilyBias("drumSkin") * 0.42 +
      cultureFamilyBias("drumSkin") * 0.48 +
      oddLogicFamilyBias("drumSkin") * 0.46 +
      gridHabit * 0.035 +
      pressureHabit * 0.018 -
      restraintHabit * 0.01 +
      (inner.drumSkin || 0) * innerLift +
      (inner.focus === "drumSkin" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const pianoTarget = clampValue(
    gradient.memory * 0.28 +
      gradient.organic * 0.18 +
      gradient.haze * 0.12 +
      circle * 0.12 +
      observer * 0.1 +
      refrain * 0.08 +
      kits.ambientKit * 0.055 +
      kits.idmKit * 0.055 +
      kits.spaceKit * 0.025 -
      kits.technoKit * 0.04 -
      hazamaBloom * 0.08 -
      pressure * 0.08 -
      genre.techno * 0.08 +
      albumArcFamilyBias("pianoMemory") * 0.44 +
      cultureFamilyBias("pianoMemory") * 0.5 +
      oddLogicFamilyBias("pianoMemory") * 0.48 +
      tenderHabit * 0.04 +
      rubberHabit * 0.008 -
      restraintHabit * 0.01 +
      (inner.pianoMemory || 0) * innerLift +
      (inner.focus === "pianoMemory" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const voiceTarget = clampValue(
    gradient.chrome * 0.2 +
      gradient.ghost * 0.14 +
      gradient.haze * 0.12 +
      depth.tail * 0.16 +
      VoiceEmergenceState.bloom * 0.12 +
      kits.ambientKit * 0.05 +
      kits.spaceKit * 0.075 +
      kits.idmKit * 0.02 -
      kits.technoKit * 0.025 -
      hazamaAir * 0.12 +
      observer * 0.08 +
      voidness * 0.06 -
      genre.pressure * 0.08 +
      albumArcFamilyBias("voiceDust") * 0.44 +
      cultureFamilyBias("voiceDust") * 0.48 +
      oddLogicFamilyBias("voiceDust") * 0.48 +
      spaceHabit * 0.034 +
      tenderHabit * 0.016 +
      restraintHabit * 0.01 +
      (inner.voiceDust || 0) * innerLift +
      (inner.focus === "voiceDust" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const acidTarget = clampValue(
    acid * 0.66 +
      (AcidLockState.enabled ? 0.22 : 0) +
      (AcidLockState.indicator || 0) * 0.16 +
      genre.techno * 0.13 +
      genre.pressure * 0.11 +
      gradient.micro * 0.09 +
      kits.technoKit * 0.09 +
      kits.idmKit * 0.035 -
      kits.spaceKit * 0.05 -
      creation * 0.08 +
      resource * 0.06 -
      voidness * 0.18 -
      lowGuard * 0.14 +
      albumArcFamilyBias("acidBiyon") * 0.58 +
      cultureFamilyBias("acidBiyon") * 0.62 +
      oddLogicFamilyBias("acidBiyon") * 0.64 +
      rubberHabit * 0.026 -
      restraintHabit * 0.018 -
      spaceHabit * 0.01 +
      (inner.acidBiyon || 0) * innerLift +
      (inner.focus === "acidBiyon" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const subTarget = clampValue(
    body * 0.24 +
      gradient.ghost * 0.18 +
      depth.pulse * 0.15 +
      pressure * 0.12 +
      kits.pressureKit * 0.075 +
      kits.technoKit * 0.03 -
      kits.spaceKit * 0.055 -
      hazamaPulse * 0.08 +
      acid * 0.24 +
      PerformancePadState.punch * 0.1 -
      voidness * 0.18 -
      lowGuard * 0.2 +
      albumArcFamilyBias("sub808") * 0.52 +
      cultureFamilyBias("sub808") * 0.44 +
      oddLogicFamilyBias("sub808") * 0.5 +
      pressureHabit * 0.012 -
      spaceHabit * 0.022 -
      restraintHabit * 0.012 +
      (inner.sub808 || 0) * innerLift +
      (inner.focus === "sub808" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const reedTarget = clampValue(
    gradient.ghost * 0.15 +
      depth.bed * 0.13 +
      depth.tail * 0.1 +
      body * 0.075 +
      kits.ambientKit * 0.035 +
      kits.spaceKit * 0.045 -
      kits.technoKit * 0.035 -
      hazamaAir * 0.08 +
      hazamaBloom * 0.05 +
      (EngineParams.bpm < 84 ? 0.065 : 0) -
      acid * 0.12 -
      lowGuard * 0.18 +
      albumArcFamilyBias("reedBuzz") * 0.44 +
      cultureFamilyBias("reedBuzz") * 0.54 +
      oddLogicFamilyBias("reedBuzz") * 0.56 +
      spaceHabit * 0.018 +
      pressureHabit * 0.008 +
      (inner.reedBuzz || 0) * innerLift +
      (inner.focus === "reedBuzz" ? (inner.bloom || 0) * 0.025 : 0),
    0,
    1
  );
  const chainTarget = clampValue(
    motif * 0.22 +
      genome * 0.2 +
      refrain * 0.18 +
      gradient.organic * 0.12 +
      gradient.micro * 0.1 +
      wave * 0.08 +
      kits.idmKit * 0.075 +
      kits.technoKit * 0.055 +
      kits.ambientKit * 0.018 +
      autoDrive * 0.07 +
      hazamaMicro * 0.06 +
      energy * 0.04 +
      albumArcFamilyBias("chain") * 0.46 +
      cultureFamilyBias("chain") * 0.42 +
      oddLogicFamilyBias("chain") * 0.46 +
      gridHabit * 0.03 +
      rubberHabit * 0.034 +
      tenderHabit * 0.01 -
      restraintHabit * 0.006 +
      (inner.chain || 0) * innerLift +
      (inner.focus === "chain" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );

  TimbreFamilyState.drumSkin = approachValue(TimbreFamilyState.drumSkin, drumTarget, 0.035);
  TimbreFamilyState.pianoMemory = approachValue(TimbreFamilyState.pianoMemory, pianoTarget, 0.032);
  TimbreFamilyState.voiceDust = approachValue(TimbreFamilyState.voiceDust, voiceTarget, 0.032);
  TimbreFamilyState.acidBiyon = approachValue(TimbreFamilyState.acidBiyon, acidTarget, 0.04);
  TimbreFamilyState.sub808 = approachValue(TimbreFamilyState.sub808, subTarget, 0.035);
  TimbreFamilyState.reedBuzz = approachValue(TimbreFamilyState.reedBuzz, reedTarget, 0.026);
  TimbreFamilyState.chain = approachValue(TimbreFamilyState.chain, chainTarget, 0.03);
  return TimbreFamilyState;
}

function updateTimbreStateFromWorld(parts) {
  const { energy, wave, creation, voidness, circle, body, resource, observer, ethereal, pressure } = parts;
  const character = currentPresetCharacter();
  const genre = updateGenreBlend(parts);
  const gradient = updateReferenceGradient(parts);
  const depth = updateReferenceDepth(parts, gradient);
  updateGenreTimbreKits(parts, gradient, depth, genre);
  updateMixGovernor(parts, gradient, depth);
  const family = updateTimbreFamilyBlend(parts, gradient, depth, genre);
  const lowGuard = MixGovernorState.lowGuard;
  const clarity = MixGovernorState.clarity;
  const voiceHaze = voiceGeneBias("haze");
  const voicePulse = voiceGeneBias("pulse");
  const voiceMicro = voiceGeneBias("micro");
  const voiceChrome = voiceGeneBias("chrome");
  const voiceOrganic = voiceGeneBias("organic");
  const voiceRefrain = voiceGeneBias("refrain");
  const voiceVoidTail = voiceGeneBias("voidTail");
  const voicePressure = voiceGeneBias("pressure");
  const fmMix = hazamaFmEngineMix();

  TimbreState.air = clampValue((ethereal * 0.56) + (observer * 0.2) + (voidness * 0.16) + ((1 - resource) * 0.08) + (gradient.haze * 0.055) + (gradient.chrome * 0.035) + (depth.tail * 0.04) + genre.ambient * 0.05 - genre.techno * 0.025 + cultureGradientBias("haze") * 0.03 + cultureGradientBias("chrome") * 0.02 + clarity * 0.028 + voiceHaze * 0.024 + voiceVoidTail * 0.026 + character.air, 0, 1);
  TimbreState.glass = clampValue((wave * 0.28) + (observer * 0.24) + (circle * 0.2) + (creation * 0.16) + (TimbreState.air * 0.12) + (gradient.chrome * 0.055) + (gradient.memory * 0.032) + (depth.particle * 0.038) + genre.idm * 0.035 + cultureGradientBias("chrome") * 0.035 + cultureGradientBias("memory") * 0.018 + clarity * 0.035 + voiceChrome * 0.028 + voiceMicro * 0.014 + character.glass, 0, 1);
  TimbreState.grit = clampValue((pressure * 0.48) + (resource * 0.22) + (body * 0.16) + (energy * 0.14) + (gradient.ghost * 0.032) + (gradient.micro * 0.022) + genre.techno * 0.04 + genre.pressure * 0.035 + cultureGradientBias("ghost") * 0.024 + cultureGradientBias("micro") * 0.018 + voicePressure * 0.018 - voiceHaze * 0.012 - (gradient.haze * 0.035) - (depth.lowMidClean * 0.036) - lowGuard * 0.035 + character.grit, 0, 1);
  TimbreState.fracture = clampValue((creation * 0.32) + (wave * 0.24) + (resource * 0.2) + (WorldState.spectrum * 0.24) + (gradient.micro * 0.06) + (gradient.organic * 0.025) + (depth.particle * 0.035) + genre.idm * 0.045 + genre.techno * 0.035 + cultureGradientBias("micro") * 0.04 + cultureGradientBias("organic") * 0.018 + voiceMicro * 0.03 + voicePressure * 0.012 + character.fracture, 0, 1);
  TimbreState.harp = clampValue((TimbreState.glass * 0.46) + (TimbreState.air * 0.24) + (circle * 0.18) + ((1 - TimbreState.grit) * 0.12) + (gradient.chrome * 0.05) + (gradient.memory * 0.035) + (depth.tail * 0.032) + genre.ambient * 0.03 + genre.idm * 0.02 - genre.techno * 0.035 + cultureGradientBias("chrome") * 0.024 + cultureGradientBias("memory") * 0.02 + voiceChrome * 0.028 + voiceRefrain * 0.012 + (character.harp || 0), 0, 1);
  TimbreState.warmth = clampValue((circle * 0.22) + (body * 0.16) + (resource * 0.16) + ((1 - TimbreState.fracture) * 0.18) + ((1 - pressure) * 0.08) + (gradient.memory * 0.045) + (gradient.organic * 0.025) + (depth.bed * 0.026) + genre.ambient * 0.025 - genre.techno * 0.035 + cultureGradientBias("memory") * 0.024 + cultureGradientBias("organic") * 0.018 - (depth.lowMidClean * 0.018) + voiceOrganic * 0.018 + voicePulse * 0.006 - voicePressure * 0.01 + (character.warmth || 0), 0, 1);

  const organicColor = (character.organicScale || 1) - 1;
  const dustColor = (character.dustScale || 1) - 1;
  const pressureColor = character.pressureColor || 0.5;
  const hazeColor = (character.hazeScale || 1) - 1;
  const tempoLift = clampValue(DJTempoState.motion / 24, -1, 1);
  const tempoRise = Math.max(0, tempoLift);
  const tempoFall = Math.max(0, -tempoLift);
  const airyPad = -25.2 + (TimbreState.air * 4.4) - (TimbreState.grit * 2.6) + (TimbreState.warmth * 1.1) + (hazeColor * 1.25) + (gradient.haze * 0.42) + (gradient.chrome * 0.22) + (depth.bed * 0.34) + (depth.tail * 0.22) + voiceHaze * 0.28 + voiceVoidTail * 0.18 + genre.ambient * 0.42 - genre.techno * 0.34 + tempoFall * 0.24 - tempoRise * 0.1 - (PerformancePadState.void * 1.55);
  const glassLevel = -33.8 + (TimbreState.glass * 5.6) + (TimbreState.harp * 3.6) + (WorldState.spectrum * 0.94) + (organicColor * 1.18) + (gradient.chrome * 0.44) + (gradient.micro * 0.26) + (depth.particle * 0.34) + (depth.gesture * 0.2) + voiceChrome * 0.34 + voiceMicro * 0.18 + voiceOrganic * 0.12 + genre.idm * 0.3 + genre.techno * 0.16 + tempoRise * 0.24 + tempoFall * 0.08 + clarity * 0.44 + (PerformancePadState.void * 2.2);
  const textureLevel = -37.6 + (TimbreState.grit * 5.6) + (TimbreState.fracture * 2.45) + (dustColor * 1.4) + ((pressureColor - 0.5) * WorldState.spectrum * 0.54) + (gradient.micro * 0.34) + (gradient.ghost * 0.18) + (depth.particle * 0.24) + (depth.pulse * 0.08) + voiceMicro * 0.16 + voicePressure * 0.12 + voicePulse * 0.08 + genre.techno * 0.44 + genre.pressure * 0.18 + tempoRise * 0.2 - tempoFall * 0.04 + clarity * 0.24 - (TimbreState.warmth * 1.75) - (depth.lowMidClean * 0.22) - lowGuard * 0.16 - (PerformancePadState.void * 1.05);
  const bassCutoff = 86 + (TimbreState.grit * 308) + (resource * 84) + (pressureColor * pressure * 24) - (TimbreState.warmth * 62) - (depth.lowMidClean * 64) - lowGuard * 46 - (PerformancePadState.void * 88) + (PerformancePadState.punch * 26);
  const bassBite = 0.46 + (TimbreState.grit * 3.1) + (TimbreState.warmth * 0.5) + (pressureColor * pressure * 0.16) - (depth.lowMidClean * 0.3) - lowGuard * 0.18 + (PerformancePadState.punch * 0.1);

  safeToneRamp(masterGain?.gain, engineOutputGainTarget(), 0.55);
  safeToneRamp(drumBus?.gain, fmMix.drumBus, 0.45);
  safeToneRamp(padBus?.gain, fmMix.padBus, 0.45);
  safeToneRamp(bassBus?.gain, fmMix.bassBus, 0.45);
  safeToneRamp(textureBus?.gain, fmMix.textureBus, 0.45);
  safeToneRamp(globalReverb?.wet, fmMix.reverbWet, 0.7);
  safeToneRamp(globalDelay?.wet, fmMix.delayWet, 0.7);

  safeToneRamp(pad?.volume, airyPad + fmMix.padDb, 0.28);
  safeToneRamp(glass?.volume, glassLevel + fmMix.glassDb, 0.22);
  safeToneRamp(texture?.volume, textureLevel + fmMix.textureDb, 0.2);
  safeToneRamp(bass?.filter?.frequency, bassCutoff, 0.18);
  safeToneRamp(bass?.filter?.Q, bassBite, 0.2);
  safeToneRamp(glass?.harmonicity, 1.0 + (TimbreState.glass * 0.95) + (TimbreState.harp * 0.72) + (organicColor * 0.12) + genre.idm * 0.08 + genre.techno * 0.06 + (PerformancePadState.void * 0.24), 0.24);
  safeToneRamp(glass?.modulationIndex, 0.58 + (TimbreState.fracture * 2.08) + (TimbreState.harp * 0.92) + (pressureColor * 0.1) + genre.techno * 0.16 - genre.ambient * 0.12 - (TimbreState.warmth * 0.5) - (PerformancePadState.void * 0.2), 0.2);
  safeToneRamp(pianoMemory?.volume, -45.2 + family.pianoMemory * 8.2 + family.chain * 1.4 + clarity * 0.8 - genre.techno * 0.8 + fmMix.pianoMemoryDb, 0.3);
  safeToneRamp(voiceDust?.volume, -48 + family.voiceDust * 9.4 + family.chain * 1.2 + PerformancePadState.void * 1.4 - genre.pressure * 0.7 + fmMix.voiceDustDb, 0.32);
  safeToneRamp(drumSkin?.volume, -42 + family.drumSkin * 9.2 + family.acidBiyon * 1.8 - lowGuard * 2.6 + fmMix.drumSkinDb, 0.22);
  safeToneRamp(subImpact?.volume, -39 + family.sub808 * 8.8 + family.acidBiyon * 2.4 - lowGuard * 4.4 + fmMix.subImpactDb, 0.22);
  safeToneRamp(reedBuzz?.volume, -52 + family.reedBuzz * 10.4 + (TimbreFamilyState.inner?.reedBuzz || 0) * 1.8 - lowGuard * 4.2 - genre.techno * 0.9 + fmMix.reedBuzzDb, 0.36);
  safeToneRamp(kick?.volume, fmMix.kickDb, 0.28);
  safeToneRamp(hat?.volume, fmMix.hatDb, 0.28);
  safeToneRamp(pianoMemoryFilter?.frequency, 960 + family.pianoMemory * 1580 + gradient.chrome * 420 - genre.techno * 260, 0.32);
  safeToneRamp(voiceDustFilter?.frequency, 1180 + family.voiceDust * 1700 + gradient.chrome * 540 + PerformancePadState.void * 420, 0.32);
  safeToneRamp(subImpact?.filter?.frequency, 46 + family.sub808 * 94 + family.acidBiyon * 42 - lowGuard * 20, 0.18);
  safeToneRamp(reedBuzzFilter?.frequency, 96 + family.reedBuzz * 210 + depth.bed * 48 + PerformancePadState.void * 32, 0.42);
  safeToneRamp(reedBuzz?.filter?.frequency, 84 + family.reedBuzz * 160 + body * 52 - lowGuard * 24, 0.32);
  safeToneRamp(reedBuzz?.filter?.Q, 1.9 + family.reedBuzz * 3.4 + gradient.ghost * 0.9 - lowGuard * 0.7, 0.32);

  setEnvelopeValue(glass?.envelope, "attack", 0.005 + (TimbreState.harp * 0.012) - genre.techno * 0.0015);
  setEnvelopeValue(glass?.envelope, "decay", 0.078 + (TimbreState.harp * 0.16) + (TimbreState.air * 0.1) + genre.ambient * 0.025 - genre.techno * 0.018 + (PerformancePadState.void * 0.11));
  setEnvelopeValue(glass?.envelope, "sustain", 0.015 + (TimbreState.warmth * 0.035));
  setEnvelopeValue(glass?.envelope, "release", 0.13 + (TimbreState.air * 0.18) + (TimbreState.warmth * 0.15) + genre.ambient * 0.04 - genre.techno * 0.022 + (PerformancePadState.void * 0.16));
  setEnvelopeValue(glass?.modulationEnvelope, "attack", 0.004);
  setEnvelopeValue(glass?.modulationEnvelope, "decay", 0.068 + (TimbreState.harp * 0.11));
  setEnvelopeValue(glass?.modulationEnvelope, "sustain", 0.01);
  setEnvelopeValue(glass?.modulationEnvelope, "release", 0.1 + (TimbreState.warmth * 0.1));
}

function maybeTriggerWorldAccents(time) {
  if (!isPlaying) return;

  const spectrum = WorldState.spectrum;
  const character = currentPresetCharacter();
  const organicScale = character.organicScale || 1;
  const dustScale = character.dustScale || 1;
  const pressureColor = character.pressureColor || 0.5;
  const genre = GenreBlendState;
  const ethereal = 1 - spectrum;
  const pulse = GrooveState.cycle || 0;
  const isDownbeat = pulse % 16 === 0;
  const isTurnaround = pulse % 16 === 14;
  const sparseGate = pulse % (genre.techno > 0.34 ? 4 : spectrum > 0.72 ? 6 : 8) === 0;
  const harpGate = pulse % (genre.techno > 0.34 ? 12 : spectrum > 0.72 ? 10 : 8) === 4;

  if (texture && sparseGate && Math.random() < (0.026 + (spectrum * 0.035) + (TimbreState.grit * 0.035) + genre.techno * 0.018 + genre.idm * 0.01 - genre.ambient * 0.012) * character.textureScale * dustScale) {
    const textureVel = clampValue(0.018 + (spectrum * 0.04) + (TimbreState.fracture * 0.04) + ((dustScale - 1) * 0.012) + genre.techno * 0.012, 0.018, 0.098);
    try {
      texture.triggerAttackRelease("64n", time, textureVel);
    } catch (error) {
      console.warn("[Music] Texture accent failed:", error);
    }
  }

  if (glass && (isDownbeat || isTurnaround || Math.random() < (0.014 + (ethereal * 0.024) + (TimbreState.glass * 0.026) + genre.idm * 0.012 + genre.techno * 0.008 - genre.ambient * 0.006) * character.glassScale)) {
    const notes = spectrum > 0.72 ? ["D6", "F#6", "G6", "E6"] : ["D5", "F#5", "G5", "E5", "D6"];
    const note = notes[Math.floor(Math.random() * notes.length)];
    const offset = clampValue(WorldState.micro, 0, 1) * 0.018 * Math.random();
    const glassVel = clampValue(0.02 + (TimbreState.air * 0.038) + (TimbreState.glass * 0.042) + (spectrum * 0.015), 0.02, 0.095);
    try {
      glass.triggerAttackRelease(note, "32n", time + offset, glassVel);
    } catch (error) {
      console.warn("[Music] Glass accent failed:", error);
    }
  }

  if (glass && harpGate && Math.random() < (0.04 + (TimbreState.harp * 0.16)) * character.glassScale * organicScale) {
    const notes = HARP_NOTE_POOLS[EngineParams.mode] || HARP_NOTE_POOLS.ambient;
    const first = notes[Math.floor(Math.random() * notes.length)];
    const second = notes[(notes.indexOf(first) + 2 + Math.floor(Math.random() * 2)) % notes.length];
    const delay = 0.018 + (WorldState.micro * 0.02) + (Math.random() * 0.018);
    const vel = clampValue(0.022 + (TimbreState.harp * 0.048) + (TimbreState.warmth * 0.018), 0.024, 0.082);
    try {
      glass.triggerAttackRelease(first, "16n", time + delay, vel);
      if (TimbreState.harp > 0.56 && Math.random() < 0.42) {
        glass.triggerAttackRelease(second, "32n", time + delay + 0.052, vel * 0.72);
      }
    } catch (error) {
      console.warn("[Music] Harp pluck failed:", error);
    }
  }

  if (hat && spectrum > 0.62 && (pulse % 8 === 6 || (genre.techno > 0.36 && pulse % 4 === 2)) && Math.random() < (0.052 + (TimbreState.fracture * 0.13) + genre.techno * 0.07) * (0.68 + pressureColor * 0.46)) {
    try {
      hat.triggerAttackRelease("64n", time + 0.032, clampValue(0.045 + (TimbreState.grit * 0.06), 0.035, 0.11));
    } catch (error) {
      console.warn("[Music] Hat fracture failed:", error);
    }
  }
  if (bass && spectrum > 0.78 && isTurnaround && Math.random() < 0.12 + pressureColor * 0.12) {
    const note = tonalRhymeLow(stepIndex, pulse % 4);
    try {
      bass.triggerAttackRelease(note, "32n", time + 0.03, clampValue(0.06 + pressureColor * 0.04, 0.055, 0.11));
    } catch (error) {
      console.warn("[Music] Bass ratchet failed:", error);
    }
  }
}

/* =========================================================
   3.5 Presets (Genre) Loader
   - Loads /presets/*.json (ambient, dub, jazz, lofi, techno, trance…)
   - Schema is flexible; unknown fields are ignored.
========================================================= */

const PresetManager = {
  names: ["ambient","dub","jazz","lofi","techno","trance"],
  presets: {},
  selected: "__auto__",
};


function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// Apply preset.ucm -> UCM + UI sliders (so faders actually move + logic follows).
function applyPresetUCM(preset){
  const u = preset && preset.ucm;
  if (!u || typeof u !== "object") return;

  const map = {
    energy: "fader_energy",
    wave: "fader_wave",
    mind: "fader_mind",
    creation: "fader_creation",
    void: "fader_void",
    circle: "fader_circle",
    body: "fader_body",
    resource: "fader_resource",
    observer: "fader_observer"
  };

  for (const k of Object.keys(map)){
    if (typeof u[k] !== "number") continue;
    const v = Math.max(0, Math.min(100, Math.round(u[k])));
    if (k in UCM) UCM[k] = v;

    const el = document.getElementById(map[k]);
    if (el) el.value = String(v);
  }
}

async function fetchJson(path){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

// Normalize preset into EngineParams-compatible fields (best-effort).
// Normalize preset into EngineParams-compatible fields (schema-aware).
function applyPresetToEngineParams(preset){
  if (!preset || typeof preset !== "object") return;

  // v1 schema: { audio:{tempo,density,brightness,silenceRate,bassWeight...}, patterns:{percussion,glitch,drone...}, ucm:{...} }
  const audio = preset.audio || {};
  const flags = preset.patterns || {};

  // tempo -> bpm
  if (typeof audio.tempo === "number") EngineParams.bpm = Math.round(audio.tempo);
  if (typeof preset.bpm === "number") EngineParams.bpm = Math.round(preset.bpm);

  // density / brightness / silence
  const density = (typeof audio.density === "number") ? clamp01(audio.density) : 0.5;
  const bright  = (typeof audio.brightness === "number") ? clamp01(audio.brightness) : 0.5;
  const silence = (typeof audio.silenceRate === "number") ? clamp01(audio.silenceRate) : (typeof preset.restProb === "number" ? clamp01(preset.restProb) : 0.12);
  const bassW   = (typeof audio.bassWeight === "number") ? audio.bassWeight : 1.0;

  // kick/hat/bass/pad probabilities (best effort, but deterministic)
  const percussionBoost = flags.percussion ? 0.10 : 0.0;
  const glitchBoost     = flags.glitch ? 0.05 : 0.0;
  const droneBoost      = flags.drone ? 0.22 : 0.0;

  EngineParams.kickProb = clamp01(0.35 + density*0.45 + percussionBoost);
  EngineParams.hatProb  = clamp01(0.22 + density*0.55 + bright*0.18 + glitchBoost);
  EngineParams.bassProb = clamp01(0.18 + density*0.42 + (bassW-1.0)*0.15);
  EngineParams.padProb  = clamp01(0.10 + (1-density)*0.18 + droneBoost);

  EngineParams.restProb = clamp01(Math.min(0.6, silence));

  // If preset explicitly carries EngineParams-like fields, let them override.
  if (typeof preset.kickProb === "number") EngineParams.kickProb = clamp01(preset.kickProb);
  if (typeof preset.hatProb  === "number") EngineParams.hatProb  = clamp01(preset.hatProb);
  if (typeof preset.bassProb === "number") EngineParams.bassProb = clamp01(preset.bassProb);
  if (typeof preset.padProb  === "number") EngineParams.padProb  = clamp01(preset.padProb);

  if (typeof preset.stepCount === "number") EngineParams.stepCount = preset.stepCount;

  // patterns strings override (optional advanced schema)
  const pat = preset.patternStrings || preset.pattern || {};
  if (typeof pat.kick === "string") EngineParams.kickPattern = pat.kick;
  if (typeof pat.hat  === "string") EngineParams.hatPattern  = pat.hat;
  if (typeof pat.bass === "string") EngineParams.bassPattern = pat.bass;
  if (typeof pat.pad  === "string") EngineParams.padPattern  = pat.pad;

  // FX (optional)
  if (preset.reverbWet != null){
    globalReverb.wet.rampTo(clamp01(preset.reverbWet), 0.6);
  }
  if (preset.delayWet != null){
    globalDelay.wet.rampTo(clamp01(preset.delayWet), 0.6);
  }

  // smoothing (0..1): higher = smoother/longer reaction
  if (typeof audio.smoothing === "number") {
    const s = clamp01(audio.smoothing);
    // 0.35..2.4 sec
    UCM_SMOOTH_SEC = 0.35 + s * 2.05;
  }

}

function applyHazamaProfileToEngineParams(options = {}) {
  if (!HazamaBridgeState.active || !HazamaBridgeState.loaded) return;

  const audio = HazamaBridgeState.audio || {};
  const patterns = HazamaBridgeState.patterns || {};
  const evolution = HazamaBridgeState.evolution || {};
  const stage = HazamaBridgeState.stage || "";
  const force = options.force === true;
  const density = typeof audio.density === "number" ? audio.density : 0.24;
  const brightness = typeof audio.brightness === "number" ? audio.brightness : 0.36;
  const silenceRate = typeof audio.silenceRate === "number" ? audio.silenceRate : 0.24;
  const bassWeight = typeof audio.bassWeight === "number" ? audio.bassWeight : 0.34;
  const stability = clampValue(HazamaBridgeState.stability / 100, 0, 1);
  const resonance = clampValue(HazamaBridgeState.resonance / 100, 0, 1);
  const marks = clampValue(HazamaBridgeState.marks / 100, 0, 1);
  const harmonicDeviation = typeof audio.harmonicDeviation === "number" ? audio.harmonicDeviation : 0.08;
  const droneStability = typeof audio.droneStability === "number" ? audio.droneStability : stability;
  const space = typeof audio.space === "number" ? audio.space : silenceRate;
  const glitchRate = typeof patterns.glitchRate === "number" ? patterns.glitchRate : 0;
  const droneBoost = patterns.drone ? 0.14 + patterns.droneLayers * 0.018 + droneStability * 0.04 + (evolution.air || 0) * 0.035 : 0;
  const glitchBoost = (patterns.glitch ? 0.075 : 0) + glitchRate * 0.09 + harmonicDeviation * 0.05 + (evolution.micro || 0) * 0.035;
  const percussionBoost = (patterns.percussion || patterns.gatePulse ? 0.09 : 0) + (evolution.pulse || 0) * 0.025;
  const stageVoid = stage === "submerge" || stage === "exhale" ? 0.06 : 0;
  const stagePulse = stage === "root" || stage === "ferment" ? 0.06 : 0;

  if (typeof audio.smoothing === "number") {
    UCM_SMOOTH_SEC = 0.45 + audio.smoothing * 2.2;
  }

  if (typeof audio.tempo === "number") {
    const tempoTarget = resolvePerformanceTempoTarget(audio.tempo);
    const step = force ? 128 : 0.62 + Math.abs((DJTempoState.targetBpm || EngineParams.bpm) - tempoTarget) * 0.012;
    DJTempoState.targetBpm = approachValue(DJTempoState.targetBpm || tempoTarget, tempoTarget, step);
    DJTempoState.bpm = approachValue(DJTempoState.bpm || audio.tempo, DJTempoState.targetBpm, force ? 128 : 0.5);
    EngineParams.bpm = Math.round(DJTempoState.bpm);
    updateHeaderRuntimeUi();
    if (typeof Tone !== "undefined" && Tone.Transport?.bpm) {
      rampParam("transport-bpm", Tone.Transport.bpm, DJTempoState.bpm, force ? 0.25 : 1.6, force ? 0 : 0.08);
    }
  }

  EngineParams.restProb = clampValue(
    EngineParams.restProb * 0.72 + silenceRate * 0.3 + stageVoid - density * 0.05 - marks * 0.04,
    0.04,
    0.62
  );
  EngineParams.kickProb = clampValue(
    EngineParams.kickProb * 0.7 + density * 0.18 + percussionBoost + stagePulse - stability * 0.035,
    0.04,
    0.62
  );
  EngineParams.hatProb = clampValue(
    EngineParams.hatProb * 0.68 + density * 0.2 + brightness * 0.12 + glitchBoost + percussionBoost * 0.42,
    0.08,
    0.8
  );
  EngineParams.bassProb = clampValue(
    EngineParams.bassProb * 0.74 + bassWeight * 0.18 + resonance * 0.05 - silenceRate * 0.04,
    0.04,
    0.46
  );
  EngineParams.padProb = clampValue(
    EngineParams.padProb * 0.7 + droneBoost + (1 - density) * 0.12 + silenceRate * 0.06 + stability * 0.05,
    0.16,
    0.68
  );

  if (patterns.drone) {
    EngineParams.padPattern = (evolution.bloom || 0) > 0.58
      ? "x...x.......x..."
      : stage === "submerge" ? "x.......x......." : "x...x...x.......";
  }
  if (!patterns.percussion && !patterns.gatePulse) {
    EngineParams.kickPattern = "................";
    EngineParams.hatPattern = patterns.glitch || (evolution.micro || 0) > 0.62 ? "....x.......x..." : "................";
  }
  if (patterns.gatePulse) {
    EngineParams.hatPattern = "..x...x...x...x.";
  }
  if (patterns.glitch) {
    EngineParams.hatPattern = "..x.x...x...x.x.";
  }

  const reverbTarget = clampValue(0.18 + silenceRate * 0.14 + space * 0.18 + stability * 0.06 + droneBoost * 0.18 + stageVoid * 0.9, 0.12, 0.62);
  const delayTarget = clampValue(0.04 + glitchBoost * 0.8 + marks * 0.08 + resonance * 0.05 + brightness * 0.06 + harmonicDeviation * 0.06, 0.02, 0.38);
  rampParam("hazama-reverb", globalReverb.wet, reverbTarget, force ? 0.25 : 1.1, force ? 0 : 0.01);
  rampParam("hazama-delay", globalDelay.wet, delayTarget, force ? 0.25 : 0.9, force ? 0 : 0.01);
}


async function loadPresets(){
  const status = document.getElementById("preset-status");
  if (status) status.textContent = "loading…";
  PresetManager.presets = {};

  const jobs = PresetManager.names.map(async (name) => {
    const path = `presets/${name}.json`;
    try{
      const data = await fetchJson(path);
      PresetManager.presets[name] = data;
      return {name, ok:true};
    }catch(e){
      console.warn(e.message);
      return {name, ok:false};
    }
  });

  const results = await Promise.all(jobs);
  const ok = results.filter(r=>r.ok).map(r=>r.name);

  const sel = document.getElementById("preset_select");
  if (sel){
    const current = sel.value || "__auto__";
    sel.innerHTML = '<option value="__auto__">AUTO (by Energy)</option>';
    ok.forEach(n=>{
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n === "trance" ? "ACID.TECH" : n.toUpperCase();
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o=>o.value===current)) sel.value = current;
  }

  if (status){
    status.textContent = ok.length ? `loaded: ${ok.join(", ")}` : "no presets found";
  }
}

function resolveMode(){
  if (HazamaBridgeState.active && HazamaBridgeState.style) return HazamaBridgeState.style;
  if (PresetManager.selected && PresetManager.selected !== "__auto__") return PresetManager.selected;
  return chooseMode();
}


let lastMode = null;

// v195: mode cross-fade. The per-mode sample layers used to hard-cut on a
// mode change — the old mode's loops were cleared instantly and the new
// mode's started at full volume, so a radio-brain rotation sounded like
// "急に始まって急に止まる". The melodic layers (harp / cello / piano /
// bass / organ) are persistent samplers with a live, rampable .volume, so
// a mode change now fades the outgoing mode's down (then clears their
// loops) while the incoming mode's fade up — a gradual, DJ-style blend.
// v199: drum layers are kits of Tone.Players (no single rampable .volume —
// each voice's volume is re-set every bar by mic-follow), so they stay
// hard-cut via stop() and are not listed in samplers().
const MODE_LAYERS = {
  ambient: {
    samplers: () => [ambientHarpSampler, ambientCelloSampler],
    stop: () => { stopAmbientHarpLayer(); stopAmbientCelloLayer(); }
  },
  lofi: {
    samplers: () => [lofiPianoSampler, lofiBassSampler],
    stop: () => { stopLofiPianoLayer(); stopLofiBassLayer(); stopLofiDrumLayer(); }
  },
  jazz: {
    samplers: () => [jazzPianoSampler],
    stop: () => { stopJazzPianoLayer(); stopJazzDrumLayer(); }
  },
  dub: {
    samplers: () => [dubBassSampler, dubOrganSampler],
    stop: () => { stopDubBassLayer(); stopDubOrganLayer(); }
  }
};

// ~2 bars of cross-fade — long enough to read as a blend, short enough that a
// drum layer's overlap with the next mode never turns muddy.
function modeTransitionSeconds() {
  try {
    const sec = Tone.Time("2m").toSeconds();
    return Number.isFinite(sec) && sec > 0 ? sec : 5;
  } catch (e) {
    return 5;
  }
}

// Fade the incoming mode's layers up from silence (or set them straight to
// base when transitionSec is 0). __baseDb is captured once — the first call
// lands right after the sampler is created at its base volume.
function fadeInModeLayers(mode, transitionSec) {
  const layer = MODE_LAYERS[mode];
  if (!layer) return;
  for (const s of layer.samplers()) {
    if (!s || !s.volume) continue;
    if (s.__baseDb == null) s.__baseDb = s.volume.value;
    try {
      if (transitionSec > 0) {
        s.volume.value = -60;
        s.volume.rampTo(s.__baseDb, transitionSec);
      } else {
        s.volume.value = s.__baseDb;
      }
    } catch (e) {}
  }
}

// Fade every other mode's layers down, then clear their loops once the fade
// has finished. transitionSec 0 keeps the old instant-stop behaviour.
function crossfadeOutOtherModes(keepMode, transitionSec) {
  for (const mode of Object.keys(MODE_LAYERS)) {
    if (mode === keepMode) continue;
    const layer = MODE_LAYERS[mode];
    if (transitionSec > 0) {
      for (const s of layer.samplers()) {
        if (s && s.volume) { try { s.volume.rampTo(-60, transitionSec); } catch (e) {} }
      }
      Tone.Transport.scheduleOnce(() => {
        try { layer.stop(); } catch (e) {}
      }, `+${transitionSec + 0.3}`);
    } else {
      try { layer.stop(); } catch (e) {}
    }
  }
}

// Mode-specific sound personality (v1.3)
function updateSoundForMode(mode, transitionSec = 0){
  // Keep changes gentle; use .set and ramp where possible
  try{
    // v195: cross-fade the outgoing mode's sample layers out (then clear their
    // loops) instead of the old instant hard-cut. Stops the layers of every
    // mode that is not `mode`, exactly like the old per-mode stop block.
    crossfadeOutOtherModes(mode, transitionSec);
    if (mode !== "lofi" && mode !== "jazz" && mode !== "ambient" && mode !== "dub") {
      try { pad.volume.rampTo(0, 1.0); } catch (e) {}
      try { bass.volume.rampTo(0, 1.0); } catch (e) {}
    }
    if(mode==="ambient"){
      // fm-57: ambient = sine pad で柔らかく + long reverb tail
      // fm-61: + harp texture (4 小節 1 note) + cello sustained lead (2 小節 1 chord)
      // v191: attack 1.5→0.6, release 4.0→2.4 — the chord still swells in
      // softly but actually establishes instead of being a formless drift.
      pad.set({ oscillator:{type:"sine"}, envelope:{attack:0.6, decay:1.0, sustain:0.60, release:2.4} });
      padFilter.frequency.rampTo(760, 1.2);
      globalReverb.wet.rampTo(0.30, 1.2);
      globalDelay.wet.rampTo(0.08, 1.2);
      bass.set({ oscillator:{type:"sine"}, envelope:{attack:0.03, decay:0.40, sustain:0.30, release:1.6} });
      startAmbientHarpLayer();
      startAmbientCelloLayer();
    }else if(mode==="lofi"){
      // fm-58: 完全 Nujabes piano trio + breakbeat — pad/bass/drum 全部
      // 実 sample に。synth voices は裏に追いやって sampler が前面を取る。
      // v191: attack 1.2→0.5, release 3.2→2.0 — articulation pass.
      pad.set({ oscillator:{type:"sine"}, envelope:{attack:0.5, decay:0.8, sustain:0.5, release:2.0} });
      try { pad.volume.rampTo(-28, 1.2); } catch (e) {}
      try { bass.volume.rampTo(-26, 1.2); } catch (e) {}  // synth bass も裏へ
      padFilter.frequency.rampTo(2000, 1.0);
      globalReverb.wet.rampTo(0.18, 1.0);
      globalDelay.wet.rampTo(0.10, 1.0);
      bass.set({
        oscillator:{type:"triangle"},
        filter:{Q:0.8},
        filterEnvelope:{baseFrequency:75, octaves:1.8, attack:0.01, decay:0.20, sustain:0.4, release:0.4},
        envelope:{attack:0.02, decay:0.30, sustain:0.5, release:0.6}
      });
      startLofiPianoLayer();
      startLofiBassLayer();
      startLofiDrumLayer();
    }else if(mode==="dub"){
      // fm-61: dub = electric bass の deep echo + organ の sustained chord
      // synth pad は半分まで減衰、bass synth はほぼ無音 (実 bass が前面)
      // v191: attack 0.65→0.4, release 2.5→1.9 — articulation pass.
      pad.set({ oscillator:{type:"sawtooth"}, envelope:{attack:0.4, decay:0.5, sustain:0.5, release:1.9} });
      try { pad.volume.rampTo(-14, 1.0); } catch (e) {}
      try { bass.volume.rampTo(-22, 1.0); } catch (e) {}
      padFilter.frequency.rampTo(1400, 0.9);
      globalReverb.wet.rampTo(0.34, 0.9);
      globalDelay.delayTime = "4n.";
      globalDelay.feedback.rampTo(0.55, 0.8);
      globalDelay.wet.rampTo(0.32, 0.8);
      bass.set({ oscillator:{type:"square"}, filter:{Q:1.2}, filterEnvelope:{baseFrequency:65, octaves:2.6} });
      startDubBassLayer();
      startDubOrganLayer();
    }else if(mode==="jazz"){
      // fm-60: jazz mode も catalog 経由で実楽器化
      //   piano (Salamander), drums (acoustic kit), guitar (nylon、lead 役)
      // synth pad/bass は -22 dB に減衰 (二重発音回避)
      // v191: attack 0.55→0.34, release 2.2→1.7 — articulation pass.
      pad.set({ oscillator:{type:"triangle"}, envelope:{attack:0.34, decay:0.6, sustain:0.48, release:1.7} });
      try { pad.volume.rampTo(-22, 1.0); } catch (e) {}
      padFilter.frequency.rampTo(1800, 0.9);
      globalReverb.wet.rampTo(0.20, 0.9);
      globalDelay.wet.rampTo(0.12, 0.9);
      bass.set({ oscillator:{type:"triangle"}, filterEnvelope:{baseFrequency:80, octaves:2.0} });
      try { bass.volume.rampTo(-12, 1.0); } catch (e) {}  // bass は薄く synth で支える
      startJazzPianoLayer();
      startJazzDrumLayer();
    }else if(mode==="techno"){
      // v191: attack 0.35→0.18, release 1.4→1.0 — articulation pass.
      pad.set({ oscillator:{type:"sawtooth"}, envelope:{attack:0.18, decay:0.35, sustain:0.36, release:1.0} });
      padFilter.frequency.rampTo(2200, 0.7);
      globalReverb.wet.rampTo(0.18, 0.7);
      globalDelay.delayTime = "8n";
      globalDelay.feedback.rampTo(0.28, 0.7);
      globalDelay.wet.rampTo(0.16, 0.7);
      bass.set({ oscillator:{type:"sawtooth"}, filter:{Q:2.2}, filterEnvelope:{baseFrequency:55, octaves:3.3}, envelope:{attack:0.005, decay:0.18, sustain:0.2, release:0.25} });
    }else if(mode==="trance"){
      // v191: attack 0.45→0.24, release 1.8→1.3 — articulation pass.
      pad.set({ oscillator:{type:"sawtooth"}, envelope:{attack:0.24, decay:0.45, sustain:0.45, release:1.3} });
      padFilter.frequency.rampTo(2600, 0.9);
      globalReverb.wet.rampTo(0.30, 0.9);
      globalDelay.delayTime = "8n.";
      globalDelay.feedback.rampTo(0.34, 0.9);
      globalDelay.wet.rampTo(0.22, 0.9);
      bass.set({
        oscillator:{type:"sawtooth"},
        filter:{Q:2.7},
        filterEnvelope:{attack:0.004, decay:0.14, sustain:0.045, release:0.18, baseFrequency:68, octaves:3.9},
        envelope:{attack:0.004, decay:0.14, sustain:0.08, release:0.22}
      });
    }else{
      // fallback
      globalReverb.wet.rampTo(0.26, 1.0);
      globalDelay.wet.rampTo(0.18, 1.0);
    }
    // v195: fade the incoming mode's sample layers up from silence.
    fadeInModeLayers(mode, transitionSec);
  }catch(e){
    console.warn("updateSoundForMode failed", e);
  }
}
let bassRoot     = "D2";

function applyModeChangeHooks(manual = false, transitionSec = 0) {
  lastMode = EngineParams.mode;
  setPatternsByMode();
  updateSoundForMode(EngineParams.mode, transitionSec);
  if (manual && PresetManager.presets[EngineParams.mode]) {
    applyPresetToEngineParams(PresetManager.presets[EngineParams.mode]);
  }
  syncPatternVariationBase({ force: true });
  renderModeLabel();
}

function commitPhraseLockedMode(newMode, manual = false) {
  if (!newMode || EngineParams.mode === newMode) {
    BarCounter.pendingMode = null;
    return false;
  }
  EngineParams.mode = newMode;
  BarCounter.lastModeChangeBar = BarCounter.current;
  BarCounter.pendingMode = null;
  musicRuntimeDebugLog("barCounter", "[BarCounter]", BarCounter.current, "mode:", EngineParams.mode);
  applyModeChangeHooks(manual, modeTransitionSeconds());
  return true;
}

function advanceBarCounter() {
  BarCounter.current++;
  const sinceLastChange = BarCounter.current - BarCounter.lastModeChangeBar;
  if (
    BarCounter.pendingMode &&
    BarCounter.current % BarCounter.phraseLength === 0 &&
    sinceLastChange >= BarCounter.phraseLength
  ) {
    commitPhraseLockedMode(BarCounter.pendingMode, false);
  }
  advancePatternVariationBar();
}

/* =========================================================
   4. UCM → パラメータ変換（簡略チューン）
========================================================= */

function chooseMode() {
  const e = UCM_CUR.energy;
  if (e < 34) return "ambient";
  if (e < 68) return "lofi";
  return "techno";
}

function applyUCMToParams(options = {}) {
  const force = options.force === true;
  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const waveNorm = clampValue(UCM_CUR.wave / 100, 0, 1);
  const voidNorm = clampValue(UCM_CUR.void / 100, 0, 1);
  const circleNorm = clampValue(UCM_CUR.circle / 100, 0, 1);
  const bodyNorm = clampValue(UCM_CUR.body / 100, 0, 1);
  const resourceNorm = clampValue(UCM_CUR.resource / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const currentParts = currentGradientParts();

  // fm-67: Transport.swing を mode 別固定値に。以前は UCM.wave で常時動的変動
  // させてたが、drum-frames JSON の microMs と D'Angelo extraMs と Transport.swing
  // が三重に重なって「気持ち悪い遅延」を引き起こしてた (rhythm research v132
  // 参照)。modulation を一旦切って、microMs に任せる方針へ転換。
  const FM_MODE_SWING = {
    ambient: 0.0,
    lofi:    0.0,  // microMs で表現済、Transport.swing は不要
    jazz:    0.0,  // 同上 (jazz JSON の microMs が既に swung)
    techno:  0.0,
    trance:  0.04, // trance のみ軽く 8n swing で揺らぎ感
    dub:     0.0,
    funk:    0.02  // funk は軽い後ろノリ
  };
  const modeForSwing = (EngineParams && EngineParams.mode) || "ambient";
  const swing = (FM_MODE_SWING[modeForSwing] !== undefined) ? FM_MODE_SWING[modeForSwing] : 0;
  if (force || typeof RAMP_CACHE["transport-swing"] !== "number" || Math.abs(RAMP_CACHE["transport-swing"] - swing) > 0.005) {
    Tone.Transport.swing = swing;
    Tone.Transport.swingSubdivision = "8n";
    RAMP_CACHE["transport-swing"] = swing;
  }

  // モード
  const newMode = resolveMode();
  const manual = PresetManager.selected && PresetManager.selected !== "__auto__";
  if (EngineParams.mode !== newMode){
    const initialModeChange = BarCounter.lastModeChangeBar < 0;
    const canChange = manual || initialModeChange;
    if (canChange) {
      commitPhraseLockedMode(newMode, manual);
    } else {
      BarCounter.pendingMode = newMode;
    }
  } else if (BarCounter.pendingMode === newMode) {
    BarCounter.pendingMode = null;
  }

  // mode-change hooks (patterns + sound)
  if (lastMode !== EngineParams.mode){
    applyModeChangeHooks(manual);
  }
  updateWorldStateFromUCM();
  updateDJTempo(currentParts, { force });

  // 休符
  EngineParams.restProb = clampValue(mapValue(UCM_CUR.void, 0, 100, 0.025, 0.42) - energyNorm * 0.035 + observerNorm * 0.012, 0.02, 0.46);

  // ドラム密度
  EngineParams.kickProb = mapValue((bodyNorm * 0.72 + energyNorm * 0.28) * 100, 0, 100, 0.17, 0.68);
  EngineParams.hatProb  = mapValue((resourceNorm * 0.64 + energyNorm * 0.24 + waveNorm * 0.12) * 100, 0, 100, 0.16, 0.78);

  // Bass / Pad
  EngineParams.bassProb = mapValue((bodyNorm * 0.82 + energyNorm * 0.18) * 100, 0, 100, 0.08, 0.47);
  EngineParams.padProb  = mapValue((circleNorm * 0.62 + observerNorm * 0.2 + voidNorm * 0.18) * 100, 0, 100, 0.18, 0.52);
  const character = currentPresetCharacter();
  const genre = GenreBlendState;
  const droneZone = EngineParams.bpm < 84 || energyNorm < 0.3 || genre.ambient > 0.42;
  const arcDrumThin = albumArcDrumThin();
  const cultureDrumThin = clampValue(cultureRhythmBias("drumThin"), 0, 0.72);
  const culturePulse = clampValue(cultureRhythmBias("pulse"), -0.2, 0.32);
  const cultureRepeat = clampValue(cultureRhythmBias("repeat"), 0, 0.3);
  const cultureRest = clampValue(cultureRhythmBias("rest"), -0.14, 0.18);
  const oddDrumThin = clampValue(oddLogicRhythmBias("drumThin"), -0.08, 0.58);
  const oddPulse = clampValue(oddLogicRhythmBias("pulse"), -0.16, 0.28);
  const oddRepeat = clampValue(oddLogicRhythmBias("repeat"), -0.08, 0.28);
  const oddRest = clampValue(oddLogicRhythmBias("rest"), -0.12, 0.16);
  EngineParams.restProb = clampValue(EngineParams.restProb * character.restScale + genre.ambient * 0.035 - genre.techno * 0.035 + cultureRest + oddRest + cultureDrumThin * 0.035 + oddDrumThin * 0.028, 0.035, PerformancePadState.void ? 0.62 : 0.52);
  EngineParams.kickProb = clampValue(EngineParams.kickProb * character.kickScale + genre.pressure * 0.024 - genre.ambient * 0.018 + culturePulse * 0.035 + oddPulse * 0.036 - cultureDrumThin * 0.09 - oddDrumThin * 0.07, PerformancePadState.void ? 0.04 : 0.08, 0.7);
  EngineParams.hatProb = clampValue(EngineParams.hatProb * character.hatScale + genre.techno * 0.11 + genre.idm * 0.035 - genre.ambient * 0.05 + cultureRepeat * 0.08 + oddRepeat * 0.09 - cultureDrumThin * 0.12 - oddDrumThin * 0.1, PerformancePadState.void ? 0.08 : 0.12, 0.86);
  EngineParams.bassProb = clampValue(EngineParams.bassProb * character.bassScale + genre.pressure * 0.018 - genre.ambient * 0.018 + culturePulse * 0.03 + oddPulse * 0.032 - cultureDrumThin * 0.045 - oddDrumThin * 0.035, PerformancePadState.void ? 0.04 : 0.07, 0.5);
  EngineParams.padProb = clampValue(EngineParams.padProb * character.padScale * (character.hazeScale || 1) + genre.ambient * 0.055 - genre.techno * 0.045 + cultureDrumThin * 0.1 + oddDrumThin * 0.09 + cultureSpaceBias("reverb") * 0.035 + oddLogicSpaceBias("reverb") * 0.03, PerformancePadState.void ? 0.16 : 0.17, 0.7);
  if (arcDrumThin > 0) {
    EngineParams.kickProb = clampValue(EngineParams.kickProb * (1 - arcDrumThin * 0.62), 0.002, 0.42);
    EngineParams.hatProb = clampValue(EngineParams.hatProb * (1 - arcDrumThin * 0.48), 0.01, 0.56);
    EngineParams.bassProb = clampValue(EngineParams.bassProb * (1 - arcDrumThin * 0.34), 0.025, 0.34);
    EngineParams.padProb = clampValue(EngineParams.padProb + arcDrumThin * 0.08, 0.2, 0.72);
  }
  if (droneZone) {
    const droneAmount = clampValue((84 - EngineParams.bpm) / 34 + (0.34 - energyNorm) + genre.ambient * 0.62 + voidNorm * 0.18, 0, 1);
    EngineParams.restProb = clampValue(EngineParams.restProb + droneAmount * 0.08, 0.06, 0.58);
    EngineParams.kickProb = clampValue(EngineParams.kickProb * (0.045 + (1 - droneAmount) * 0.2), 0.002, 0.12);
    EngineParams.hatProb = clampValue(EngineParams.hatProb * (0.12 + (1 - droneAmount) * 0.28), 0.01, 0.18);
    EngineParams.bassProb = clampValue(EngineParams.bassProb * (0.38 + (1 - droneAmount) * 0.28), 0.025, 0.2);
    EngineParams.padProb = clampValue(EngineParams.padProb + droneAmount * 0.17, 0.26, 0.7);
  }

  // リバーブ/ディレイ量を少しだけ動かす（軽量）
  const reverbWet = clampValue(
    mapValue(UCM_CUR.observer + UCM_CUR.void * 0.35, 0, 135, 0.14, 0.46) +
      DepthState.tail * 0.035 +
      DepthState.bed * 0.018 +
      cultureSpaceBias("reverb") * 0.085 +
      cultureSpaceBias("tail") * 0.075 -
      cultureSpaceBias("dry") * 0.055 +
      oddLogicSpaceBias("reverb") * 0.08 +
      oddLogicSpaceBias("tail") * 0.07 -
      oddLogicSpaceBias("dry") * 0.05 +
      PerformancePadState.void * 0.16 +
      PerformancePadState.drift * 0.04,
    0.08,
    0.62
  );
  rampParam("reverb-wet", globalReverb.wet, reverbWet, 0.8, force ? 0 : 0.012);

  const delayWet = clampValue(
    mapValue(UCM_CUR.creation + UCM_CUR.observer * 0.22, 0, 122, 0.035, 0.28) +
      DepthState.particle * 0.018 +
      DepthState.gesture * 0.012 +
      cultureSpaceBias("delay") * 0.07 -
      cultureSpaceBias("dry") * 0.035 +
      oddLogicSpaceBias("delay") * 0.064 -
      oddLogicSpaceBias("dry") * 0.032 +
      PerformancePadState.repeat * 0.11 +
      PerformancePadState.drift * 0.055 +
      PerformancePadState.void * 0.045,
    0.02,
    0.4
  );
  rampParam("delay-wet", globalDelay.wet, delayWet, 0.55, force ? 0 : 0.012);

  // Padのカットオフ
  const cutoff = clampValue(
    mapValue(UCM_CUR.observer + UCM_CUR.energy * 0.28 - UCM_CUR.void * 0.18, -18, 128, 280, 2600) -
      DepthState.lowMidClean * 82 -
      PerformancePadState.void * 720 +
      PerformancePadState.punch * 72,
    180,
    2600
  );
  rampParam("pad-cutoff", padFilter.frequency, cutoff, 0.5, force ? 0 : 70);

  // スケール
  const baseScale = ["D4", "F#4", "G4", "E4", "D5"];
  const tensions  = ["A4", "B4", "F#5", "E5"];
  if (UCM_CUR.mind > 60 || UCM_CUR.creation > 60) {
    currentScale = baseScale.concat(tensions);
  } else {
    currentScale = baseScale;
  }

  // ルート
  switch (EngineParams.mode) {
    case "ambient": bassRoot = tonalRhymeSub(stepIndex, -1); break;
    case "lofi":    bassRoot = tonalRhymeSub(stepIndex, 0); break;
    case "dub":     bassRoot = tonalRhymeSub(stepIndex, 1); break;
    case "jazz":    bassRoot = tonalRhymeSub(stepIndex, 1); break;
    case "funk":    bassRoot = tonalRhymeSub(stepIndex, 2); break;
    case "techno":  bassRoot = tonalRhymeSub(stepIndex, 1); break;
    case "trance":  bassRoot = tonalRhymeSub(stepIndex, 2); break;
    case "piano":   bassRoot = tonalRhymeSub(stepIndex, -1); break;
  }

  if (!manual) setPatternsByMode();
  applyHazamaProfileToEngineParams({ force });
  syncPatternVariationBase();
  updateUIFromParams();

  syncMusicAudioAdapterFromUCM(force);
}


function updateUIFromParams(){
  const modeLabel = document.getElementById("mode-label");
  renderModeLabel();

  const bpmValue = document.getElementById("bpm-value");
  if (bpmValue) bpmValue.textContent = `${EngineParams.bpm} BPM`;

  const energyValue = document.getElementById("energy-value");
  if (energyValue) energyValue.textContent = `${UCM.energy}`;
  updateHeaderRuntimeUi();
}

function headerRuntimeSyncLabel() {
  if (HazamaBridgeState.loaded) {
    if (hazamaAutoFollowActive()) return HazamaBridgeState.depthId ? `HZM.${HazamaBridgeState.depthId}` : "HZM.AUTO";
    if (HazamaBridgeState.controlAction === "pause") return "HZM.PAUS";
    if (HazamaBridgeState.controlAction === "stop") return "HZM.STOP";
    if (HazamaBridgeState.pending || HazamaBridgeState.controlPending) return "HZM.PEND";
    return "HZM.RDY";
  }
  if (albumArcActive()) return currentAlbumArcChapter()?.label || "ARC";
  if (UCM.auto.enabled) return "AUTO";
  return isPlaying ? "PLAY" : "LIVE";
}

function updateHeaderRuntimeUi() {
  if (typeof document === "undefined") return;
  const bpm = document.getElementById("header_bpm");
  const output = document.getElementById("header_output");
  const sync = document.getElementById("header_sync");
  if (bpm) bpm.textContent = String(Math.round(EngineParams.bpm || 0));
  if (output) output.textContent = String(Math.round(OutputState.level || 0));
  if (sync) sync.textContent = headerRuntimeSyncLabel();
}

function setPatternsByMode() {
  // Distinct patterns per mode (v1.3). We use 16 steps for feel.
  EngineParams.stepCount = 16;

  switch (EngineParams.mode) {
    case "ambient":
      EngineParams.kickPattern = "................";
      EngineParams.hatPattern  = "....x.......x...";
      EngineParams.bassPattern = "x...............";
      EngineParams.padPattern  = "x.......x.......";
      break;

    case "lofi":
      EngineParams.kickPattern = "x...x...x...x...";
      EngineParams.hatPattern  = "..x...x...x...x.";
      EngineParams.bassPattern = "x......x....x...";
      EngineParams.padPattern  = "x.......x......x";
      break;

    case "dub":
      EngineParams.kickPattern = "x.......x.......";
      EngineParams.hatPattern  = "....x...x...x...";
      EngineParams.bassPattern = "x...x.......x...";
      EngineParams.padPattern  = "....x......x....";
      break;

    case "jazz":
      EngineParams.kickPattern = "x.....x...x.....";
      EngineParams.hatPattern  = "..x.x...x.x...x.";
      EngineParams.bassPattern = "x...x...x...x...";
      EngineParams.padPattern  = "x.......x...x...";
      break;

    case "funk":
      EngineParams.kickPattern = "x..x....x...x...";
      EngineParams.hatPattern  = "..x.x.x...x.x.x.";
      EngineParams.bassPattern = "x..x..o.x...x.o.";
      EngineParams.padPattern  = "x...x...x...x...";
      break;

    case "techno":
      EngineParams.kickPattern = "x...x...x...x...";
      EngineParams.hatPattern  = "..x...x...x...x.";
      EngineParams.bassPattern = "x.x...x.x...x...";
      EngineParams.padPattern  = "....x......x....";
      break;

    case "trance":
      EngineParams.kickPattern = "x...x...x...x...";
      EngineParams.hatPattern  = "..x.x.x...x.x.x.";
      EngineParams.bassPattern = "x.x...x.x...x...";
      EngineParams.padPattern  = "x.......x.......";
      break;

    case "piano":
      EngineParams.kickPattern = "................";
      EngineParams.hatPattern  = "........x.......";
      EngineParams.bassPattern = "x.......o.......";
      EngineParams.padPattern  = "x.......x.......";
      break;

    default:
      EngineParams.stepCount = 8;
      EngineParams.kickPattern = "x...x...";
      EngineParams.hatPattern  = "x.x.x.x.";
      EngineParams.bassPattern = "x......x";
      EngineParams.padPattern  = "x...x...";
      break;
  }
}

/* =========================================================
   5. ステップシーケンサ（8ステップ）
========================================================= */

let stepIndex = 0;

function resetRuntimeCounters() {
  stepIndex = 0;
  GrooveState.cycle = 0;
  GrooveState.fillActive = false;
  GrooveState.textureLift = 0;
  GrooveState.glassLift = 0;
  GrooveState.floorWarmupSteps = 10;
  resetAutoDirector();
  resetOrganicEcosystem();
  resetLongformArc();
  resetMixGovernor();
  resetTimbreFamily();
  resetGenreBlend();
  resetGenreTimbreKits();
  resetModeTimbrePalettes();
  resetMusicRadioBrain();
  resetBarCounter();
  resetPatternVariation();
  resetBasslineDirector();
  resetDJTempo();
  resetGenerativeGenome();
  resetAutoVoiceMorph();
  resetReferenceMorph();
  resetRdjGrowth();
  resetProducerHabits();
  resetSelfReviewGovernor();
  resetSignatureCells();
  resetAlbumArc();
  if (typeof window !== "undefined" && typeof window.HumanGrooveGovernor?.reset === "function") {
    window.HumanGrooveGovernor.reset();
  }
}

function patternAt(pattern, step) {
  if (!pattern || pattern.length === 0) return false;
  const ch = pattern[step % pattern.length];
  return ch === "x" || ch === "o" || ch === "X";
}

function patternVariationSignature() {
  return [
    EngineParams.mode,
    EngineParams.stepCount,
    EngineParams.kickPattern,
    EngineParams.hatPattern,
    EngineParams.bassPattern,
    EngineParams.padPattern
  ].join("|");
}

function emptyPatternLike(pattern) {
  const length = Math.max(1, (typeof pattern === "string" && pattern.length) || EngineParams.stepCount || 16);
  return ".".repeat(length);
}

function patternVariationSnapshot() {
  const skinBase = EngineParams.hatPattern || EngineParams.kickPattern || "";
  return {
    kick: typeof EngineParams.kickPattern === "string" ? EngineParams.kickPattern : "",
    hat: typeof EngineParams.hatPattern === "string" ? EngineParams.hatPattern : "",
    bass: typeof EngineParams.bassPattern === "string" ? EngineParams.bassPattern : "",
    pad: typeof EngineParams.padPattern === "string" ? EngineParams.padPattern : "",
    skin: emptyPatternLike(skinBase)
  };
}

function syncPatternVariationBase(options = {}) {
  const signature = patternVariationSignature();
  if (!options.force && PatternVariation.baseSignature === signature) return;
  PatternVariation.baseSignature = signature;
  PatternVariation.basePattern = patternVariationSnapshot();
  PatternVariation.currentPattern = { ...PatternVariation.basePattern };
  PatternVariation.bar = BarCounter.current;
  PatternVariation.lastVariationBar = -1;
}

function resetPatternVariationCurrent() {
  PatternVariation.currentPattern = { ...PatternVariation.basePattern };
  PatternVariation.bar = BarCounter.current;
  PatternVariation.lastVariationBar = BarCounter.current;
}

function patternVariationForRole(role) {
  if (!PatternVariation.baseSignature) syncPatternVariationBase({ force: true });
  if (role === "skin") return PatternVariation.currentPattern.skin || "";
  return PatternVariation.currentPattern[role] || EngineParams[`${role}Pattern`] || "";
}

function patternStepIsActive(chars, index) {
  return chars[index] === "x" || chars[index] === "o" || chars[index] === "X";
}

function patternStepsPerBeat(length) {
  return Math.max(1, Math.round(length / 4));
}

function patternIsBeatStart(index, length) {
  return index % patternStepsPerBeat(length) === 0;
}

function patternIsSnareBackbone(index, length) {
  const stepsPerBeat = patternStepsPerBeat(length);
  const beat = Math.floor(index / stepsPerBeat);
  return index % stepsPerBeat === 0 && (beat === 1 || beat === 3);
}

function randomPatternIndex(indices) {
  if (!indices.length) return -1;
  return indices[Math.floor(Math.random() * indices.length)];
}

function tryAddKickVariation(chars) {
  const length = chars.length;
  const candidates = [];
  for (let i = 1; i < length; i++) {
    if (!patternIsBeatStart(i, length) && !patternStepIsActive(chars, i)) candidates.push(i);
  }
  const index = randomPatternIndex(candidates);
  if (index < 0) return false;
  chars[index] = "o";
  return true;
}

function tryShiftKickVariation(chars) {
  const length = chars.length;
  const candidates = [];
  for (let i = 1; i < length; i++) {
    if (patternStepIsActive(chars, i) && !patternIsBeatStart(i, length)) candidates.push(i);
  }
  while (candidates.length) {
    const source = randomPatternIndex(candidates);
    candidates.splice(candidates.indexOf(source), 1);
    const direction = rand(0.5) ? -1 : 1;
    const target = source + direction;
    if (target <= 0 || target >= length) continue;
    if (patternIsBeatStart(target, length) || patternStepIsActive(chars, target)) continue;
    chars[source] = ".";
    chars[target] = "o";
    return true;
  }
  return tryAddKickVariation(chars);
}

function tryVaryHatPattern(chars) {
  const length = chars.length;
  const active = [];
  const empty = [];
  for (let i = 0; i < length; i++) {
    if (patternIsBeatStart(i, length)) continue;
    if (patternStepIsActive(chars, i)) active.push(i);
    else empty.push(i);
  }
  if (active.length > Math.max(3, Math.floor(length / 4)) && rand(0.52)) {
    const index = randomPatternIndex(active);
    chars[index] = ".";
    return true;
  }
  const index = randomPatternIndex(empty);
  if (index < 0) return false;
  chars[index] = "x";
  return true;
}

function tryAddSkinGhost(chars) {
  const length = chars.length;
  const candidates = [];
  for (let i = 1; i < length; i++) {
    if (!patternIsBeatStart(i, length) && !patternIsSnareBackbone(i, length) && !patternStepIsActive(chars, i)) candidates.push(i);
  }
  const index = randomPatternIndex(candidates);
  if (index < 0) return false;
  chars[index] = "o";
  return true;
}

function perturbPatternVariation() {
  syncPatternVariationBase();
  const kick = (PatternVariation.currentPattern.kick || "").split("");
  const hat = (PatternVariation.currentPattern.hat || "").split("");
  const skin = (PatternVariation.currentPattern.skin || "").split("");
  const operations = rand(0.45) ? 2 : 1;

  for (let i = 0; i < operations; i++) {
    const pick = Math.random();
    if (pick < 0.34) {
      tryShiftKickVariation(kick);
    } else if (pick < 0.74) {
      tryVaryHatPattern(hat);
    } else {
      tryAddSkinGhost(skin);
    }
  }

  PatternVariation.currentPattern = {
    ...PatternVariation.currentPattern,
    kick: kick.join(""),
    hat: hat.join(""),
    skin: skin.join("")
  };
  PatternVariation.lastVariationBar = BarCounter.current;
  musicRuntimeDebugLog("patternVariation", "[PatternVariation]", BarCounter.current, "kick:", PatternVariation.currentPattern.kick, "hat:", PatternVariation.currentPattern.hat);
}

function advancePatternVariationBar() {
  syncPatternVariationBase();
  PatternVariation.bar = BarCounter.current;
  if (BarCounter.current <= 0) return;
  if (BarCounter.current % PatternVariation.phraseLength === 0) {
    resetPatternVariationCurrent();
    return;
  }
  if (
    BarCounter.current % PatternVariation.variationInterval === 0 &&
    PatternVariation.lastVariationBar !== BarCounter.current
  ) {
    perturbPatternVariation();
  }
}

function randomChordForMode() {
  const chords = MODE_CHORDS[EngineParams.mode] || MODE_CHORDS.ambient;
  const idx = (MelodicDirectorState.phrase + MelodicDirectorState.chordTurn + Math.floor(Math.random() * chords.length)) % chords.length;
  return melodicDirectorChord(chords[idx], idx);
}

function randomHazeChord() {
  // Progression-based despite the legacy name: the pad advances through the
  // genre's HAZE_CHORD_PROGRESSION one chord per bar (GrooveState.cycle), and
  // chordTurn rotates the phrase start. Key transposition stays layered on top.
  const progression = HAZE_CHORD_PROGRESSION[EngineParams.mode] || HAZE_CHORD_PROGRESSION.ambient;
  const idx = progression[(GrooveState.cycle + MelodicDirectorState.chordTurn) % progression.length];
  return melodicDirectorChord(HAZE_CHORDS[idx], idx);
}

function advanceGrooveStructure() {
  GrooveState.cycle++;
  advanceAutoDirectorPhrase();
  advanceSection();
  advanceHazamaAutonomy();
  syncHazamaTransportControls(0);
  advanceTonalRhymePhrase();
  advancePerformanceColorDrift();

  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resourceNorm = clampValue(UCM_CUR.resource / 100, 0, 1);
  const waveNorm = clampValue(UCM_CUR.wave / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const voidNorm = clampValue(UCM_CUR.void / 100, 0, 1);
  const circleNorm = clampValue(UCM_CUR.circle / 100, 0, 1);
  const phraseStep = GrooveState.cycle % 4;
  const density = (energyNorm + creationNorm + resourceNorm) / 3;
  const fillChance = mapValue(density, 0, 1, 0.04, 0.30);
  const micShape = micFollowGrooveShape();
  const micJam = micJamShape();
  advanceMelodicDirectorPhrase({ energyNorm, creationNorm, observerNorm, voidNorm });
  advanceBasslineDirectorPhrase({ energyNorm, waveNorm, creationNorm, observerNorm, voidNorm });
  syncMelodicDirectorBassRoot();
  advanceLongformArcPhrase({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceOrganicEcosystemPhrase({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceOddLogicDirectorPhrase();
  updateBpmCrossfadeMemory(currentGradientParts());
  advanceAutoVoiceMorphPhrase();
  advanceVoiceEmergencePhrase();
  advanceReferenceMorph({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceRdjGrowth({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceProducerHabits({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  applySelfReviewRestraintGovernor();
  advanceModeTimbrePalettes({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceMusicRadioBrain({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceSignatureCells({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  updateGenerativeGenome(currentGradientParts());

  const humanGroove = typeof window !== "undefined" ? window.HumanGrooveGovernor : null;
  if (humanGroove && typeof humanGroove.advancePhrase === "function") {
    const shaped = humanGroove.advancePhrase({
      cycle: GrooveState.cycle,
      energy: energyNorm,
      wave: waveNorm,
      creation: creationNorm,
      resource: resourceNorm,
      micro: clampValue((GradientState.micro || 0) + (WorldState.micro || 0), 0, 1),
      chaos: organicChaosAmount(),
      circle: circleNorm,
      observer: observerNorm,
      voidness: voidNorm,
      eventLoad: MixGovernorState.eventLoad || 0,
      lowGuard: MixGovernorState.lowGuard || 0,
      drift: PerformancePadState.drift || 0,
      repeat: PerformancePadState.repeat || 0,
      ambient: GenreBlendState.ambient || 0,
      idm: GenreBlendState.idm || 0,
      acid: acidPerformanceAmount(),
      organic: clampValue((GradientState.organic || 0) * 0.7 + (ReferenceMorphState.organic || 0) * 0.3, 0, 1)
    });
    EngineParams.restProb = clampValue(
      EngineParams.restProb + shaped.repair * 0.08 - shaped.naturalness * 0.012,
      0.018,
      PerformancePadState.void ? 0.64 : 0.54
    );
    EngineParams.kickProb = clampValue(EngineParams.kickProb * (0.99 - shaped.repair * 0.04), PerformancePadState.void ? 0.035 : 0.07, 0.7);
    EngineParams.hatProb = clampValue(EngineParams.hatProb * (0.9 + shaped.density * 0.18 - shaped.repair * 0.14), PerformancePadState.void ? 0.06 : 0.1, 0.84);
    EngineParams.bassProb = clampValue(EngineParams.bassProb * (0.96 + shaped.density * 0.08 - shaped.repair * 0.07), PerformancePadState.void ? 0.035 : 0.06, 0.5);
  }

  if (MicFollowState.enabled) {
    EngineParams.restProb = clampValue(
      EngineParams.restProb + micShape.space * 0.035 + micJam.air * 0.018 - micShape.pulse * 0.018 - micJam.phrase * 0.012,
      0.018,
      PerformancePadState.void ? 0.66 : 0.55
    );
    EngineParams.hatProb = clampValue(
      EngineParams.hatProb * (1 + micShape.particle * 0.11 + micJam.pulse * 0.08 + micJam.clap * 0.05 - micShape.space * 0.045),
      PerformancePadState.void ? 0.06 : 0.1,
      0.86
    );
  }

  // v193/v194: section drum gate + density shaping. `drive` scales the drum
  // probabilities (near-silent breakdown ↔ dense peak); `space` scales the
  // rest probability (a packed, tight "打ち込み" world ↔ an airy one). Applied
  // after the groove governor and mic-follow so the section has the final say.
  if (SectionState.started) {
    const sectionProfile = currentSectionProfile();
    if (typeof sectionProfile.drive === "number") {
      const d = sectionProfile.drive;
      EngineParams.kickProb = clampValue(EngineParams.kickProb * d, 0.004, 0.74);
      EngineParams.hatProb = clampValue(EngineParams.hatProb * d, 0.006, 0.86);
      EngineParams.bassProb = clampValue(EngineParams.bassProb * (0.5 + d * 0.5), 0.02, 0.52);
    }
    if (typeof sectionProfile.space === "number") {
      EngineParams.restProb = clampValue(EngineParams.restProb * sectionProfile.space, 0.01, 0.72);
    }
  }

  // v193: a section boundary forces a fill (SectionState.fillCue) so the move
  // into the next world lands as a deliberate edge, not a silent crossfade.
  GrooveState.fillActive = (phraseStep === 3 && rand(fillChance)) || SectionState.fillCue;
  GrooveState.textureLift = clampValue((GrooveState.fillActive ? 0.10 + creationNorm * 0.12 : creationNorm * 0.035) + micShape.particle * 0.055 + micJam.pulse * 0.06 + micJam.clap * 0.04, 0, 0.34);
  GrooveState.glassLift = clampValue(((phraseStep === 1 || phraseStep === 3) ? 0.04 + creationNorm * 0.08 : 0.015) + micShape.particle * 0.035 + micShape.space * 0.014 + micJam.phrase * 0.06 + micJam.hum * 0.028 + micJam.air * 0.018, 0, 0.3);
  GrooveState.accentStep = GLASS_ACCENT_STEPS[(GrooveState.cycle + Math.floor(waveNorm * 6)) % GLASS_ACCENT_STEPS.length];
  GrooveState.bassOffset = (GrooveState.cycle + Math.floor(UCM_CUR.mind / 18)) % 4;
  GrooveState.microJitterScale = clampValue((GrooveState.fillActive ? 1.4 : 0.7 + waveNorm * 0.7) + micShape.particle * 0.18 - micShape.space * 0.08, 0.52, 1.62);
}

function bassNoteForStep(step) {
  return basslineDirectorNoteForStep(step, bassRoot, { register: step % 8 === 0 ? "sub" : "low" });
}

function triggerLowMotion(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!bass || PerformancePadState.void > 0.75) return;

  const repeat = PerformancePadState.repeat;
  const punch = PerformancePadState.punch;
  const ghost = GradientState.ghost;
  const chaos = OrganicChaosState;
  const eco = OrganicEcosystemState;
  const lowGuard = MixGovernorState.lowGuard;
  const motion = clampValue(
    energyNorm * 0.2 +
      (UCM_CUR.body / 100) * 0.2 +
      waveNorm * 0.22 +
      creationNorm * 0.12 +
      resourceNorm * 0.1 +
      ghost * 0.1 +
      chaos.lowMotion * 0.22 +
      chaos.impulse * 0.08 +
      eco.rootTurn * 0.16 +
      repeat * 0.08 +
      punch * 0.04 -
      voidNorm * 0.16,
    0,
    1
  );
  const gate = step % 8 === 2 || step % 8 === 6 || (repeat && step % 4 === 2) || (chaos.lowMotion > 0.18 && step % 8 === 3) || (eco.rootTurn > 0.34 && step % 8 === 5) || (isAccentStep && step % 2 === 0);
  if (!gate || !rand(chance((0.024 + motion * 0.12 + repeat * 0.052 + punch * 0.018 + chaos.lowMotion * 0.04 + eco.rootTurn * 0.026) * (1 - lowGuard * 0.18)))) return;

  const note = rand(0.44 + waveNorm * 0.22)
    ? tonalRhymeLow(step, 1)
    : tonalRhymeLow(step, 3);
  const tickTime = time + 0.018 + Math.random() * (0.012 + waveNorm * 0.016 + chaos.tangle * 0.012 + eco.ferment * 0.008);
  const vel = clampValue(0.052 + motion * 0.07 + repeat * 0.018 + chaos.lowMotion * 0.018 + eco.rootTurn * 0.012 - lowGuard * 0.018, 0.04, 0.14);

  try {
    bass.triggerAttackRelease(note, repeat ? "64n" : "32n", tickTime, vel);
    if ((repeat || chaos.tangle > 0.28) && rand(0.22 + motion * 0.12 + chaos.tangle * 0.14)) {
      bass.triggerAttackRelease(note, "64n", tickTime + 0.038 + Math.random() * 0.016, vel * 0.52);
    }
  } catch (error) {
    console.warn("[Music] low motion failed:", error);
  }
}

function triggerAcidTechnoTrace(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!bass || PerformancePadState.void > 0.55) return;
  updateAcidLockIntensity(0.018);
  const acidIntensity = acidPerformanceAmount();
  if (acidIntensity < 0.08) return;
  const acidIndicator = clampValue(AcidLockState.indicator || 0, 0, 1);
  const acidShape = context.acidShape || { timeOffsetSec: 0, probabilityScale: 1, velocityScale: 1, densityScale: 1, grainScale: 1 };
  const acidHighShape = context.acidHighShape || acidShape;

  const genre = GenreBlendState;
  const gradient = GradientState;
  const lowGuard = MixGovernorState.lowGuard;
  const acid = clampValue(
    0.22 +
      (EngineParams.mode === "trance" ? 0.34 : 0) +
      genre.techno * 0.26 +
      genre.pressure * 0.22 +
      energyNorm * 0.14 +
      creationNorm * 0.22 +
      resourceNorm * 0.18 +
      gradient.micro * 0.1 +
      gradient.chrome * 0.04 +
      acidIndicator * 0.1 +
      voiceGeneBias("pressure") * 0.14 +
      producerHabitBias("rubberEdit") * 0.08 -
      producerHabitBias("transparentVoid") * 0.05 -
      producerHabitBias("restraint") * 0.04 -
      voidNorm * 0.24 -
      lowGuard * 0.26,
    0,
    1
  ) * acidIntensity;
  if (acid < 0.22) return;

  const impactGate = step % 8 === 0 || (step % 16 === 8 && genre.pressure > 0.18);
  const gate = impactGate || step % 16 === 1 || step % 16 === 3 || step % 16 === 6 || step % 16 === 9 || step % 16 === 11 || step % 16 === 14 || (isAccentStep && step % 2 === 1);
  const gateChance = impactGate
    ? (0.42 + acid * 0.28 + energyNorm * 0.07) * acidShape.probabilityScale
    : (0.065 + acid * 0.25 + PerformancePadState.repeat * 0.05) * acidShape.probabilityScale;
  if (!gate || !rand(gateChance)) return;

  const acidPhase = Math.floor((GenomeState.phase || 0) * TONAL_RHYME_LOW.length);
  const note = tonalRhymeLow(step, acidPhase);
  const turnNote = tonalRhymeLow(step, acidPhase + 2);
  const reply = tonalRhymeHigh(step, acidPhase + 2);
  const acidTime = time + acidShape.timeOffsetSec + 0.012 + Math.random() * (0.01 + waveNorm * 0.012) * acidShape.grainScale;
  const vel = clampValue((0.056 + acid * 0.122 - lowGuard * 0.038) * acidShape.velocityScale, 0.04, 0.18);
  const impactVel = clampValue(0.24 + acid * 0.2 + energyNorm * 0.045 - lowGuard * 0.095, 0.18, 0.48);
  const jabVel = clampValue((0.085 + acid * 0.12 + resourceNorm * 0.018 - lowGuard * 0.04) * acidShape.velocityScale, 0.065, 0.23);
  const cutoff = clampValue(190 + acid * 860 + resourceNorm * 220 + waveNorm * 120 - lowGuard * 120, 130, 1260);
  const q = clampValue(2.4 + acid * 4.4 + creationNorm * 0.7 - lowGuard * 0.7, 1.6, 7.2);

  try {
    safeToneRamp(bass?.filter?.Q, q, 0.055);
    safeToneRamp(bass?.filter?.frequency, cutoff, 0.045);
    if (impactGate && kick && rand(0.62 + acid * 0.26 - lowGuard * 0.12)) {
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), "16n", acidTime + 0.002, impactVel);
    }
    bass.triggerAttackRelease(note, "32n", acidTime, vel);
    if (impactGate && rand(0.58 + acid * 0.24 - lowGuard * 0.12)) {
      bass.triggerAttackRelease(tonalRhymeSub(step, step % 16 === 8 ? 1 : 0), "16n", acidTime + 0.018, jabVel);
    }
    if (rand((0.34 + acid * 0.32) * acidShape.densityScale)) {
      bass.triggerAttackRelease(note, "64n", acidTime + 0.046 + Math.random() * 0.012, vel * 0.52);
    }
    if ((step % 8 === 3 || step % 8 === 6 || isAccentStep) && rand((0.18 + acid * 0.22) * acidShape.densityScale)) {
      bass.triggerAttackRelease(turnNote, "64n", acidTime + 0.074 + Math.random() * 0.014, vel * 0.42);
    }
    if (glass && rand((0.32 + acid * 0.3 + acidIndicator * 0.18) * acidHighShape.probabilityScale)) {
      glass.triggerAttackRelease(reply, "64n", acidTime + acidHighShape.timeOffsetSec * 0.35 + 0.022, clampValue((0.026 + acid * 0.076 + gradient.chrome * 0.014 + acidIndicator * 0.026) * acidHighShape.velocityScale, 0.018, 0.13));
      if ((isAccentStep || step % 16 === 1 || step % 16 === 9) && rand((0.12 + acidIndicator * 0.24) * acidHighShape.densityScale)) {
        glass.triggerAttackRelease(tonalRhymeHigh(step, acidPhase + 5), "64n", acidTime + acidHighShape.timeOffsetSec * 0.45 + 0.078 + Math.random() * (0.012 * acidHighShape.grainScale), clampValue((0.018 + acid * 0.048 + acidIndicator * 0.024) * acidHighShape.velocityScale, 0.014, 0.096));
      }
    }
    if (hat && (step % 4 === 1 || step % 4 === 3 || isAccentStep) && rand((0.24 + acid * 0.32) * acidShape.densityScale)) {
      hat.triggerAttackRelease("64n", acidTime + 0.008 + acidShape.timeOffsetSec * 0.2, clampValue((0.04 + acid * 0.08 + energyNorm * 0.018) * acidShape.velocityScale, 0.032, 0.14));
    }
    if (texture && rand((0.26 + acid * 0.3) * acidShape.densityScale)) {
      texture.triggerAttackRelease("64n", acidTime + 0.016 + acidShape.timeOffsetSec * 0.25, clampValue((0.024 + acid * 0.07 + (impactGate ? 0.018 : 0)) * acidShape.velocityScale, 0.016, 0.116));
    }
    markMixEvent(0.12 + acid * 0.1 + (impactGate ? 0.05 : 0));
  } catch (error) {
    console.warn("[Music] acid trace failed:", error);
  }
}

function triggerHighBpmIdmMicroDance(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    isAccentStep
  } = context;
  if (!texture || PerformancePadState.void > 0.55) return;

  const genre = GenreBlendState;
  const kits = GenreTimbreKitState;
  const gradient = GradientState;
  const bpmLift = clampValue((EngineParams.bpm - 122) / 34, 0, 1);
  const amount = clampValue(
    bpmLift * 0.34 +
      genre.idm * 0.22 +
      genre.techno * 0.2 +
      kits.idmKit * 0.16 +
      kits.technoKit * 0.12 +
      (gradient.micro || 0) * 0.18 +
      acidPerformanceAmount() * 0.14 +
      PerformancePadState.repeat * 0.1 +
      creationNorm * 0.05 +
      resourceNorm * 0.04 -
      genre.ambient * 0.16 -
      (MixGovernorState.eventLoad || 0) * 0.12,
    0,
    1
  );
  if (amount < 0.2) return;

  const gate = step % 4 === 1 || step % 4 === 3 || isAccentStep || (genre.idm > 0.26 && step % 8 === 5);
  const gateChance = chance(0.022 + amount * 0.15 + Math.max(0, bpmLift - 0.42) * 0.08);
  if (!gate || !rand(gateChance)) return;

  const fmGenre = hazamaFmRuntimeGenre();
  const allowGlass = fmGenre !== "techno" && fmGenre !== "piano";
  const burstCount = bpmLift > 0.62 && rand(0.36 + amount * 0.18) ? 3 : 2;
  const gap = 0.018 + (1 - bpmLift) * 0.006;
  const burstTime = time + 0.012 + Math.random() * (0.006 + waveNorm * 0.008);
  const note = tonalRhymeLow(step, Math.floor((GenomeState.phase || 0) * 6) + 1);
  const high = tonalRhymeHigh(step, Math.floor((GenomeState.phase || 0) * 8) + 3);
  const vel = clampValue(0.024 + amount * 0.056 + energyNorm * 0.018, 0.018, 0.116);

  try {
    for (let i = 0; i < burstCount; i++) {
      const t = burstTime + i * gap + Math.random() * 0.004;
      texture.triggerAttackRelease("128n", t, clampValue(vel * (i === 0 ? 1 : 0.72), 0.014, 0.1));
      if (bass && (acidPerformanceAmount() > 0.14 || genre.techno > 0.28) && rand(0.28 + amount * 0.22)) {
        bass.triggerAttackRelease(note, "128n", t + 0.002, clampValue(0.045 + amount * 0.058, 0.036, 0.13));
      }
      if (allowGlass && glass && rand(0.16 + genre.idm * 0.18 + (gradient.micro || 0) * 0.12)) {
        glass.triggerAttackRelease(high, "128n", t + 0.004, clampValue(0.012 + amount * 0.038, 0.01, 0.062));
      }
    }
    if (drumSkin && rand(0.18 + amount * 0.16)) {
      drumSkin.triggerAttackRelease("128n", burstTime + gap * 0.5, clampValue(0.012 + amount * 0.042, 0.01, 0.07));
    }
    markMixEvent(0.035 + amount * 0.05);
  } catch (error) {
    console.warn("[Music] high BPM IDM micro dance failed:", error);
  }
}

function triggerDroneResonanceBed(step, time, context) {
  const {
    energyNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    waveNorm
  } = context;
  const genre = GenreBlendState;
  const drone = clampValue(
    genre.ambient * 0.34 +
      (1 - energyNorm) * 0.26 +
      voidNorm * 0.18 +
      circleNorm * 0.14 +
      observerNorm * 0.08,
    0,
    1
  );
  if (drone < 0.34 || !(step % 16 === 0 || step % 16 === 8)) return;
  if (!rand(0.22 + drone * 0.36 + DepthState.bed * 0.08)) return;

  const lowNote = drone > 0.62 ? tonalRhymeSub(step, -1) : tonalRhymeLow(step, 0);
  const airNote = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + step + Math.floor(GenomeState.phase * 7)) % TRANSPARENT_AIR_FRAGMENTS.length];
  const chord = randomHazeChord();
  const droneTime = time + 0.018 + Math.random() * (0.024 + waveNorm * 0.018);

  try {
    pad.triggerAttackRelease(chord, "1n", droneTime, clampValue(0.036 + drone * 0.05 + observerNorm * 0.012, 0.03, 0.108));
    if (bass && rand(0.34 + drone * 0.22)) {
      bass.triggerAttackRelease(lowNote, "2n", droneTime + 0.024, clampValue(0.032 + drone * 0.048 - MixGovernorState.lowGuard * 0.018, 0.026, 0.09));
    }
    if (glass && rand(0.26 + drone * 0.18)) {
      glass.triggerAttackRelease(airNote, "4n", droneTime + 0.052, clampValue(0.018 + drone * 0.032 + DepthState.tail * 0.008, 0.014, 0.07));
    }
    markMixEvent(0.045);
  } catch (error) {
    console.warn("[Music] drone resonance failed:", error);
  }
}

function triggerPerformanceColorDriftDetail(step, time, context) {
  const {
    creationNorm,
    observerNorm,
    circleNorm,
    waveNorm,
    isAccentStep
  } = context;
  if (!glass || MixGovernorState.eventLoad > 0.9) return;

  const color = PerformanceColorDriftState;
  const amount = clampValue(color.haze * 0.2 + color.chrome * 0.22 + color.dust * 0.2 + color.pressure * 0.1 + color.acid * 0.24, 0, 1);
  if (amount < 0.24) return;

  const gate = step % 16 === 5 || step % 16 === 13 || (isAccentStep && step % 2 === 1);
  if (!gate || !rand(0.018 + amount * 0.08 + color.acid * 0.035)) return;

  const pool = color.acid > 0.18 || color.dust > color.haze
    ? GLASS_NOTES
    : color.chrome > color.dust
      ? TRANSPARENT_AIR_FRAGMENTS
      : ORGANIC_PLUCK_FRAGMENTS;
  const note = pool[(GrooveState.cycle + step + Math.floor(color.phase * pool.length)) % pool.length];
  const reply = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + step + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
  const driftTime = time + 0.018 + Math.random() * (0.016 + waveNorm * 0.016);

  try {
    glass.triggerAttackRelease(note, color.acid > 0.18 ? "64n" : "32n", driftTime, clampValue(0.016 + amount * 0.044 + observerNorm * 0.008, 0.014, 0.082));
    if (color.chrome > 0.42 && rand(0.22 + color.chrome * 0.18)) {
      glass.triggerAttackRelease(reply, "64n", driftTime + 0.052 + Math.random() * 0.018, clampValue(0.012 + color.chrome * 0.034, 0.012, 0.058));
    }
    if (texture && color.dust > 0.38 && rand(0.18 + color.dust * 0.18)) {
      texture.triggerAttackRelease("64n", driftTime + 0.012, clampValue(0.012 + color.dust * 0.036 + creationNorm * 0.008, 0.012, 0.066));
    }
    if (pad && color.haze > 0.54 && step % 16 === 13 && rand(0.16 + circleNorm * 0.16)) {
      pad.triggerAttackRelease(randomHazeChord(), "2n", driftTime + 0.04, clampValue(0.018 + color.haze * 0.035 + circleNorm * 0.008, 0.016, 0.064));
    }
    markMixEvent(0.06 + amount * 0.04);
  } catch (error) {
    console.warn("[Music] color drift detail failed:", error);
  }
}

function triggerVoiceEmergenceDetail(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!glass || MixGovernorState.eventLoad > 0.84) return;

  const state = VoiceEmergenceState;
  const focus = state.blend > 0.56 ? state.nextFocus : state.focus;
  const amount = clampValue(
    0.16 +
      state.bloom * 0.2 +
      state.splice * 0.2 +
      state.shimmer * 0.18 +
      state.refrain * 0.16 +
      voiceTransitionAmount() * 0.1 +
      PerformancePadState.drift * 0.05 +
      PerformancePadState.repeat * 0.05 +
      PerformancePadState.void * 0.04,
    0,
    1
  );
  const gate = step % 16 === 3 || step % 16 === 7 || step % 16 === 11 || step % 16 === 15 || (isAccentStep && step % 2 === 1);
  if (!gate || !rand(0.016 + amount * 0.078 + state.splice * 0.028 + acidPerformanceAmount() * 0.018)) return;

  const offset = Math.floor(state.phase * 9) + Math.floor(state.blend * 5);
  const airNote = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + step + offset) % TRANSPARENT_AIR_FRAGMENTS.length];
  const pluckNote = ORGANIC_PLUCK_FRAGMENTS[(GrooveState.cycle + step + offset + 2) % ORGANIC_PLUCK_FRAGMENTS.length];
  const glassNote = GLASS_NOTES[(GrooveState.cycle + step + offset + 1) % GLASS_NOTES.length];
  const shadeNote = FIELD_MURK_FRAGMENTS[(GrooveState.cycle + step + offset + 3) % FIELD_MURK_FRAGMENTS.length];
  const dt = 0.026 + Math.random() * (0.022 + waveNorm * 0.02);
  const vel = clampValue(0.014 + amount * 0.04 + observerNorm * 0.006, 0.012, 0.076);

  try {
    if (focus === "micro") {
      glass.triggerAttackRelease(glassNote, "64n", time + 0.012, clampValue(vel + creationNorm * 0.012 + state.splice * 0.018, 0.014, 0.086));
      if (rand(0.34 + state.splice * 0.2 + PerformancePadState.repeat * 0.16)) {
        glass.triggerAttackRelease(glassNote, "64n", time + 0.012 + dt, clampValue(vel * 0.68 + resourceNorm * 0.01, 0.012, 0.06));
      }
      if (texture && rand(0.18 + state.splice * 0.18)) {
        texture.triggerAttackRelease("64n", time + 0.02, clampValue(0.012 + state.splice * 0.036, 0.012, 0.058));
      }
      rememberMotif(glassNote, { reply: airNote, shade: shadeNote, strength: 0.024 + amount * 0.05, air: state.shimmer * 0.06, source: "voice-micro" });
    } else if (focus === "organic") {
      glass.triggerAttackRelease(pluckNote, "64n", time + 0.018 + waveNorm * 0.014, clampValue(vel + creationNorm * 0.014 + state.refrain * 0.012, 0.014, 0.084));
      if (rand(0.28 + state.refrain * 0.2)) {
        glass.triggerAttackRelease(airNote, "64n", time + 0.082 + Math.random() * 0.022, clampValue(vel * 0.52 + state.shimmer * 0.012, 0.012, 0.05));
      }
      if (texture && rand(0.2 + state.bloom * 0.16)) {
        texture.triggerAttackRelease("64n", time + 0.032, clampValue(0.012 + state.bloom * 0.032 + creationNorm * 0.006, 0.012, 0.054));
      }
      rememberMotif(pluckNote, { reply: airNote, shade: shadeNote, strength: 0.026 + state.refrain * 0.05, air: state.bloom * 0.05, source: "voice-organic" });
    } else if (focus === "chrome") {
      glass.triggerAttackRelease(airNote, "32n", time + 0.02 + Math.random() * 0.018, clampValue(vel + state.shimmer * 0.026 + observerNorm * 0.01, 0.016, 0.09));
      if (rand(0.24 + state.shimmer * 0.22)) {
        glass.triggerAttackRelease(TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + step + offset + 3) % TRANSPARENT_AIR_FRAGMENTS.length], "64n", time + 0.096, clampValue(vel * 0.48 + state.bloom * 0.01, 0.012, 0.052));
      }
    } else if (focus === "ghost") {
      if (texture) {
        texture.triggerAttackRelease("64n", time + 0.014, clampValue(0.014 + amount * 0.042 + energyNorm * 0.008, 0.012, 0.074));
      }
      glass.triggerAttackRelease(shadeNote, "32n", time + 0.048 + Math.random() * 0.02, clampValue(vel + state.refrain * 0.014 - voidNorm * 0.006, 0.014, 0.072));
      rememberMotif(shadeNote, { reply: airNote, shade: pluckNote, strength: 0.022 + state.refrain * 0.045, air: state.bloom * 0.04, source: "voice-ghost" });
    } else {
      const hazeVel = clampValue(0.016 + state.bloom * 0.04 + circleNorm * 0.008 - energyNorm * 0.006, 0.014, 0.068);
      if (focus === "haze" && pad && (step % 16 === 7 || step % 16 === 15) && rand(0.18 + state.bloom * 0.16)) {
        pad.triggerAttackRelease(randomHazeChord(), "1n", time + 0.03, hazeVel);
      }
      glass.triggerAttackRelease(focus === "memory" ? pluckNote : airNote, "32n", time + 0.054 + Math.random() * 0.026, clampValue(vel + state.refrain * 0.018, 0.014, 0.072));
      if (focus === "memory") {
        rememberMotif(pluckNote, { reply: airNote, shade: shadeNote, strength: 0.024 + state.refrain * 0.052, air: state.bloom * 0.052, source: "voice-memory" });
      }
    }
    markMixEvent(0.052 + amount * 0.04);
  } catch (error) {
    console.warn("[Music] voice emergence detail failed:", error);
  }
}

function triggerGhostGlassSignatureCell(step, time, context) {
  const {
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm
  } = context;
  if (!glass) return;
  const conductorScale = signatureConductorChanceScale("ghostGlass");
  if (conductorScale <= 0) return;
  if (SignatureCellState.globalCooldownSteps > 0) return;
  if (SignatureCellState.cooldownSteps > 0) return;
  if (stepIndex - SignatureCellState.lastStep < 5) return;

  const eventLoad = MixGovernorState.eventLoad || 0;
  const voiding = PerformancePadState.void > 0;
  if (eventLoad > (voiding ? 0.88 : 0.8)) return;

  const collapse = signatureCellCollapseAmount(context);
  const scarReady = collapse > 0.42 || PerformancePadState.drift || PerformancePadState.repeat;
  let motif = SignatureCellState.blend > 0.55 ? SignatureCellState.nextMotif : SignatureCellState.motif;
  if (motif === "scar" && !scarReady) motif = "call";

  const step16 = step % 16;
  const gate = motif === "call"
    ? step16 === 3 || step16 === 11
    : motif === "answer"
      ? (voiding ? step16 === 7 || step16 === 15 : step16 === 6 || step16 === 14)
      : step16 === 5 || step16 === 13;
  if (!gate) return;

  const gradient = GradientState;
  const depth = DepthState;
  const family = TimbreFamilyState;
  const palette = modeTimbrePaletteShape();
  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + GenomeState.generation + 1) * GOLDEN_RATIO_INVERSE) * 8);
  const chanceValue = chance(
    (0.034 +
      SignatureCellState.intensity * 0.12 +
      RdjGrowthState.tender * 0.018 +
      palette.signature * 0.032 +
      palette.glass * 0.026 +
      palette.air * 0.014 +
      (gradient.chrome || 0) * 0.04 +
      (depth.tail || 0) * 0.034 +
      (family.voiceDust || 0) * 0.025 +
      producerHabitBias("ghostGlass") * 0.025 +
      PerformancePadState.drift * 0.035 +
      PerformancePadState.repeat * 0.034 +
      voiding * 0.034 -
      producerHabitBias("restraint") * 0.01 -
      palette.restraint * 0.012 -
      eventLoad * 0.05) * conductorScale
  );
  if (!rand(chanceValue)) return;

  const airRoot = tonalRhymeHigh(step, phaseOffset + 2);
  const airReply = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
  const glassRoot = GLASS_NOTES[(step + GrooveState.cycle + phaseOffset + 1) % GLASS_NOTES.length];
  const shade = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 4) % FIELD_MURK_FRAGMENTS.length];
  const cellTime = time + 0.016 + Math.random() * (0.016 + waveNorm * 0.018 + PerformancePadState.drift * 0.018);
  const intensity = SignatureCellState.intensity;

  try {
    if (motif === "call") {
      const vel = clampValue(0.018 + intensity * 0.044 + observerNorm * 0.01 + creationNorm * 0.006, 0.014, 0.086);
      glass.triggerAttackRelease(glassRoot, "64n", cellTime, vel);
      glass.triggerAttackRelease(airReply, "64n", cellTime + 0.052 + Math.random() * 0.022, clampValue(vel * 0.58 + depth.tail * 0.008, 0.012, 0.058));
      if (voiceDust && rand(0.14 + (family.voiceDust || 0) * 0.18 + voiding * 0.18)) {
        voiceDust.triggerAttackRelease(airRoot, voiding ? "8n" : "16n", cellTime + 0.088, clampValue(vel * 0.42, 0.008, 0.04));
      }
      rememberMotif(glassRoot, { reply: airReply, shade, strength: 0.028 + intensity * 0.05, air: 0.08 + depth.tail * 0.08, source: "ghost-glass-call" });
      nudgeInnerSourceFamily("chain", 0.008 + intensity * 0.006);
      markMixEvent(0.045 + intensity * 0.032);
    } else if (motif === "answer") {
      const vel = clampValue(0.012 + intensity * 0.036 + observerNorm * 0.012 + voidNorm * 0.01, 0.01, 0.064);
      if (voiceDust) {
        voiceDust.triggerAttackRelease(airRoot, voiding ? "4n" : "8n", cellTime + 0.024, vel);
      }
      glass.triggerAttackRelease(airReply, voiding ? "16n" : "32n", cellTime + 0.066 + Math.random() * 0.026, clampValue(vel * 0.72 + depth.tail * 0.01, 0.01, 0.056));
      if (pad && (voiding || circleNorm > 0.42) && rand(0.14 + circleNorm * 0.16 + depth.tail * 0.14)) {
        pad.triggerAttackRelease(randomHazeChord(), voiding ? "2n" : "1n", cellTime + 0.034, clampValue(0.016 + intensity * 0.03 + circleNorm * 0.008, 0.014, 0.056));
      }
      rememberMotif(airRoot, { reply: airReply, shade, strength: 0.024 + intensity * 0.046, air: 0.16 + depth.tail * 0.1 + voidNorm * 0.08, source: "ghost-glass-answer" });
      nudgeInnerSourceFamily("voiceDust", 0.018 + intensity * 0.01);
      markMixEvent(0.035 + intensity * 0.028);
    } else {
      const vel = clampValue(0.014 + intensity * 0.046 + collapse * 0.018 + PerformancePadState.repeat * 0.018, 0.012, 0.078);
      if (texture) {
        texture.triggerAttackRelease("64n", cellTime + 0.004, clampValue(0.014 + collapse * 0.042 + creationNorm * 0.012, 0.012, 0.072));
      }
      glass.triggerAttackRelease(shade, "64n", cellTime + 0.026, vel);
      if (PerformancePadState.repeat && rand(0.24 + collapse * 0.22)) {
        glass.triggerAttackRelease(shade, "64n", cellTime + 0.056, clampValue(vel * 0.54, 0.01, 0.048));
      }
      rememberMotif(shade, { reply: airReply, shade: glassRoot, strength: 0.022 + collapse * 0.054, air: depth.tail * 0.06, source: "ghost-glass-scar" });
      nudgeInnerSourceFamily("chain", 0.012 + collapse * 0.012);
      markMixEvent(0.05 + intensity * 0.034);
    }
    SignatureCellState.cooldownSteps = motif === "scar" || voiding ? 6 : 5;
    SignatureCellState.globalCooldownSteps = motif === "scar" || voiding ? 5 : 4;
    SignatureCellState.silenceDebt = clampValue(SignatureCellState.silenceDebt + 0.18 + intensity * 0.08, 0, 1);
    SignatureCellState.lastStep = stepIndex;
    SignatureCellState.lastFlavor = "ghostGlass";
  } catch (error) {
    console.warn("[Music] ghost glass signature failed:", error);
  }
}

function triggerLowBreathSignatureCell(step, time, context) {
  const {
    energyNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!subImpact && !reedBuzz && !voiceDust) return;
  const conductorScale = signatureConductorChanceScale("lowBreath");
  if (conductorScale <= 0) return;
  if (SignatureCellState.globalCooldownSteps > 0) return;
  if (SignatureCellState.lowBreathCooldownSteps > 0) return;
  if (stepIndex - SignatureCellState.lowBreathLastStep < 10) return;

  const eventLoad = MixGovernorState.eventLoad || 0;
  const lowGuard = MixGovernorState.lowGuard || 0;
  const voiding = PerformancePadState.void > 0;
  if (eventLoad > (voiding ? 0.86 : 0.76)) return;
  if (!voiding && lowGuard > 0.72) return;

  const step16 = step % 16;
  const gate = voiding
    ? step16 === 4 || step16 === 7
    : step16 === 0 || step16 === 8 || (isAccentStep && step16 === 4);
  if (!gate) return;

  const depth = DepthState;
  const gradient = GradientState;
  const family = TimbreFamilyState;
  const palette = modeTimbrePaletteShape();
  const intensity = SignatureCellState.lowBreathIntensity;
  const chanceValue = chance(
    (0.02 +
      intensity * 0.09 +
      RdjGrowthState.rubber * 0.018 +
      palette.transient * 0.02 +
      palette.air * 0.012 +
      (depth.bed || 0) * 0.036 +
      (gradient.ghost || 0) * 0.03 +
      (family.reedBuzz || 0) * 0.026 +
      producerHabitBias("lowBreath") * 0.026 +
      producerHabitBias("ghostPressure") * 0.018 +
      voiding * 0.026 -
      producerHabitBias("restraint") * 0.012 -
      palette.lowClamp * 0.03 -
      lowGuard * 0.045 -
      eventLoad * 0.05) * conductorScale
  );
  if (!rand(chanceValue)) return;

  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + GenomeState.generation + 2) * GOLDEN_RATIO_INVERSE) * 5);
  const lowNote = tonalRhymeSub(step, phaseOffset);
  const reedNote = tonalRhymeLow(step, phaseOffset + 1);
  const airNote = tonalRhymeHigh(step, phaseOffset + 3);
  const breathTime = time + 0.022 + Math.random() * (0.016 + waveNorm * 0.018 + (voiding ? 0.016 : 0));

  try {
    if (subImpact && !voiding && lowGuard < 0.58) {
      subImpact.triggerAttackRelease(
        lowNote,
        "16n",
        breathTime,
        clampValue(0.026 + intensity * 0.074 + energyNorm * 0.018 - lowGuard * 0.03, 0.018, 0.12)
      );
      nudgeInnerSourceFamily("sub808", 0.014 + intensity * 0.012);
    }
    if (reedBuzz && rand(0.16 + intensity * 0.28 + (depth.bed || 0) * 0.16 + voiding * 0.16)) {
      reedBuzz.triggerAttackRelease(
        reedNote,
        voiding ? "1n" : "2n",
        breathTime + 0.066 + Math.random() * 0.026,
        clampValue(0.01 + intensity * 0.036 + (depth.bed || 0) * 0.01 - lowGuard * 0.014, 0.008, 0.052)
      );
      nudgeInnerSourceFamily("reedBuzz", 0.014 + intensity * 0.01);
    }
    if (voiceDust && (voiding || rand(0.2 + observerNorm * 0.18 + intensity * 0.16))) {
      voiceDust.triggerAttackRelease(
        airNote,
        voiding ? "4n" : "8n",
        breathTime + 0.108 + Math.random() * 0.032,
        clampValue(0.008 + intensity * 0.032 + voidNorm * 0.01, 0.008, 0.046)
      );
      nudgeInnerSourceFamily("voiceDust", 0.01 + intensity * 0.008);
    }
    if (glass && voiding && rand(0.16 + (depth.tail || 0) * 0.22)) {
      glass.triggerAttackRelease(
        TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 2) % TRANSPARENT_AIR_FRAGMENTS.length],
        "16n",
        breathTime + 0.14,
        clampValue(0.012 + intensity * 0.03 + observerNorm * 0.008, 0.01, 0.054)
      );
    }
    if (pad && voiding && rand(0.12 + circleNorm * 0.14 + (depth.tail || 0) * 0.16)) {
      pad.triggerAttackRelease(randomHazeChord(), "2n", breathTime + 0.044, clampValue(0.014 + intensity * 0.028 + circleNorm * 0.008, 0.012, 0.052));
    }
    rememberMotif(reedNote, { reply: airNote, shade: lowNote, strength: 0.022 + intensity * 0.05, air: 0.08 + voidNorm * 0.12 + (depth.tail || 0) * 0.06, source: "signature-low-breath" });
    markMixEvent(0.04 + intensity * 0.035);
    SignatureCellState.lowBreathCooldownSteps = voiding ? 12 : 10;
    SignatureCellState.globalCooldownSteps = voiding ? 7 : 6;
    SignatureCellState.silenceDebt = clampValue(SignatureCellState.silenceDebt + 0.22 + intensity * 0.08, 0, 1);
    SignatureCellState.lowBreathLastStep = stepIndex;
    SignatureCellState.lastFlavor = "lowBreath";
  } catch (error) {
    console.warn("[Music] low breath signature failed:", error);
  }
}

function triggerBrokenTextureSignatureCell(step, time, context) {
  const {
    creationNorm,
    resourceNorm,
    waveNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!texture && !drumSkin && !glass) return;
  const conductorScale = signatureConductorChanceScale("brokenTexture");
  if (conductorScale <= 0) return;
  if (SignatureCellState.globalCooldownSteps > 0) return;
  if (SignatureCellState.brokenTextureCooldownSteps > 0) return;
  if (stepIndex - SignatureCellState.brokenTextureLastStep < 7) return;

  const eventLoad = MixGovernorState.eventLoad || 0;
  const voiding = PerformancePadState.void > 0;
  if (eventLoad > (voiding ? 0.74 : 0.82)) return;
  if (voiding && !PerformancePadState.repeat && (GradientState.micro || 0) < 0.5) return;

  const collapse = signatureCellCollapseAmount(context);
  const intensity = SignatureCellState.brokenTextureIntensity;
  const ready = collapse > 0.34 || (GradientState.micro || 0) > 0.32 || PerformancePadState.repeat || PerformancePadState.drift || isAccentStep;
  if (!ready || intensity < 0.24) return;

  const step16 = step % 16;
  const gate = step16 === 5 || step16 === 13 || (PerformancePadState.repeat && (step16 === 2 || step16 === 10));
  if (!gate) return;

  const gradient = GradientState;
  const family = TimbreFamilyState;
  const palette = modeTimbrePaletteShape();
  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + GenomeState.generation + 4) * GOLDEN_RATIO_INVERSE) * 7);
  const shard = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 2) % FIELD_MURK_FRAGMENTS.length];
  const glassShard = GLASS_NOTES[(step + GrooveState.cycle + phaseOffset + 5) % GLASS_NOTES.length];
  const scarTime = time + 0.01 + Math.random() * (0.01 + waveNorm * 0.014 + PerformancePadState.drift * 0.014);
  const chanceValue = chance(
    (0.022 +
      intensity * 0.1 +
      RdjGrowthState.edit * 0.018 +
      collapse * 0.04 +
      palette.texture * 0.04 +
      palette.rhythm * 0.022 +
      (gradient.micro || 0) * 0.04 +
      (family.drumSkin || 0) * 0.032 +
      PerformancePadState.repeat * 0.04 +
      producerHabitBias("brokenTexture") * 0.032 +
      producerHabitBias("rubberEdit") * 0.018 -
      producerHabitBias("restraint") * 0.012 -
      palette.restraint * 0.014 -
      voidNorm * 0.04 -
      eventLoad * 0.04) * conductorScale
  );
  if (!rand(chanceValue)) return;

  try {
    if (texture) {
      texture.triggerAttackRelease("64n", scarTime, clampValue(0.014 + intensity * 0.052 + creationNorm * 0.012 + resourceNorm * 0.008, 0.012, 0.082));
    }
    if (drumSkin && !voiding && rand(0.16 + intensity * 0.18 + PerformancePadState.repeat * 0.14)) {
      drumSkin.triggerAttackRelease("64n", scarTime + 0.014 + Math.random() * 0.01, clampValue(0.012 + intensity * 0.04 + (family.drumSkin || 0) * 0.018, 0.01, 0.07));
      nudgeInnerSourceFamily("drumSkin", 0.012 + intensity * 0.012);
    }
    if (glass && rand(0.18 + intensity * 0.2 + (gradient.micro || 0) * 0.12)) {
      glass.triggerAttackRelease(shard, "64n", scarTime + 0.028 + Math.random() * 0.012, clampValue(0.012 + intensity * 0.034, 0.01, 0.058));
      if (PerformancePadState.repeat && rand(0.22 + collapse * 0.18)) {
        glass.triggerAttackRelease(glassShard, "64n", scarTime + 0.058, clampValue(0.01 + intensity * 0.024, 0.008, 0.042));
      }
    }
    rememberMotif(shard, {
      reply: glassShard,
      shade: tonalRhymeMid(step, phaseOffset + 1),
      strength: 0.02 + intensity * 0.052,
      air: (GradientState.chrome || 0) * 0.05,
      source: "signature-broken-texture"
    });
    nudgeInnerSourceFamily("chain", 0.01 + intensity * 0.01);
    markMixEvent(0.04 + intensity * 0.032);
    SignatureCellState.brokenTextureCooldownSteps = PerformancePadState.repeat ? 8 : 7;
    SignatureCellState.globalCooldownSteps = PerformancePadState.repeat ? 6 : 5;
    SignatureCellState.silenceDebt = clampValue(SignatureCellState.silenceDebt + 0.2 + intensity * 0.08, 0, 1);
    SignatureCellState.brokenTextureLastStep = stepIndex;
    SignatureCellState.lastFlavor = "brokenTexture";
  } catch (error) {
    console.warn("[Music] broken texture signature failed:", error);
  }
}

function triggerMemoryPluckSignatureCell(step, time, context) {
  const {
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!pianoMemory && !glass) return;
  const conductorScale = signatureConductorChanceScale("memoryPluck");
  if (conductorScale <= 0) return;
  if (SignatureCellState.globalCooldownSteps > 0) return;
  if (SignatureCellState.memoryPluckCooldownSteps > 0) return;
  if (stepIndex - SignatureCellState.memoryPluckLastStep < 9) return;
  if (MixGovernorState.eventLoad > (PerformancePadState.void ? 0.86 : 0.78)) return;

  const step16 = step % 16;
  const gate = step16 === 4 || step16 === 10 || (isAccentStep && step16 === 12);
  if (!gate) return;

  const gradient = GradientState;
  const family = TimbreFamilyState;
  const palette = modeTimbrePaletteShape();
  const intensity = SignatureCellState.memoryPluckIntensity;
  if (intensity < 0.2) return;

  const chanceValue = chance(
    (0.018 +
      intensity * 0.095 +
      (gradient.memory || 0) * 0.034 +
      (family.pianoMemory || 0) * 0.028 +
      palette.glass * 0.028 +
      palette.haze * 0.012 +
      RdjGrowthState.toy * 0.026 +
      RdjGrowthState.tender * 0.018 +
      producerHabitBias("memoryPluck") * 0.034 -
      producerHabitBias("restraint") * 0.012 -
      palette.restraint * 0.014 -
      voidNorm * 0.025 -
      (MixGovernorState.eventLoad || 0) * 0.04) * conductorScale
  );
  if (!rand(chanceValue)) return;

  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + RdjGrowthState.generation + 6) * GOLDEN_RATIO_INVERSE) * 8);
  const root = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 1) % ORGANIC_PLUCK_FRAGMENTS.length];
  const reply = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 4) % TRANSPARENT_AIR_FRAGMENTS.length];
  const shade = tonalRhymeMid(step, phaseOffset + 2);
  // pianoMemory is a low comp voice — keep its onset tight in the pocket.
  // The old hard +18ms drag (plus random spread) left it 15-50ms behind the
  // kick/bass, so the low piano "変に遅く入る" and the groove would not lock.
  const pluckTime = time + Math.random() * 0.012;
  const vel = clampValue(0.012 + intensity * 0.05 + creationNorm * 0.008 + observerNorm * 0.006, 0.01, 0.074);

  try {
    if (pianoMemory) {
      // v177 humanize: accent notes ring longer so the line breathes instead of
      // every pluck being an identical 32nd; per-hit velocity jitter de-robotizes.
      const leadDur = isAccentStep ? "8n" : step16 === 4 ? "16n" : "32n";
      const leadVel = clampValue(vel * (0.86 + Math.random() * 0.3), 0.01, 0.084);
      pianoMemory.triggerAttackRelease(root, leadDur, pluckTime, leadVel);
      // v177 harmony: the memory pluck used to be a bare single note. Voice two
      // soft tones from the mode's chord (rotated per phrase by chordTurn) under
      // the lead so it lands as a played chord. MODE_CHORDS is base-key like the
      // ORGANIC_PLUCK_FRAGMENTS lead, so no director key-shift is applied here.
      const chordPool = MODE_CHORDS[EngineParams.mode] || MODE_CHORDS.lofi;
      const voicing = chordPool[(MelodicDirectorState.chordTurn || 0) % chordPool.length] || [];
      if (voicing.length && rand(0.66 + MotifMemoryState.strength * 0.18)) {
        voicing.slice(0, 2).forEach((note, i) => {
          pianoMemory.triggerAttackRelease(
            note,
            "8n",
            pluckTime + 0.006 + i * (0.007 + Math.random() * 0.012),
            clampValue(leadVel * (0.32 - i * 0.07), 0.006, 0.044)
          );
        });
      }
      if (rand(0.2 + RdjGrowthState.toy * 0.18 + MotifMemoryState.strength * 0.12)) {
        pianoMemory.triggerAttackRelease(shade, "64n", pluckTime + 0.072 + Math.random() * 0.02, clampValue(leadVel * 0.45, 0.008, 0.036));
      }
    }
    if (glass && rand(0.2 + RdjGrowthState.tender * 0.18 + (gradient.chrome || 0) * 0.1)) {
      glass.triggerAttackRelease(reply, "64n", pluckTime + 0.052 + Math.random() * 0.018, clampValue(vel * 0.48, 0.008, 0.042));
    }
    rememberMotif(root, {
      reply,
      shade,
      strength: 0.028 + intensity * 0.06,
      air: 0.06 + RdjGrowthState.tender * 0.08 + circleNorm * 0.04,
      source: "signature-memory-pluck"
    });
    nudgeInnerSourceFamily("pianoMemory", 0.018 + intensity * 0.012);
    nudgeInnerSourceFamily("chain", 0.006 + RdjGrowthState.toy * 0.006);
    markMixEvent(0.035 + intensity * 0.032);
    SignatureCellState.memoryPluckCooldownSteps = 9 + Math.round(RdjGrowthState.restraint * 4);
    SignatureCellState.globalCooldownSteps = 5 + Math.round(RdjGrowthState.restraint * 3);
    SignatureCellState.silenceDebt = clampValue(SignatureCellState.silenceDebt + 0.2 + intensity * 0.08, 0, 1);
    SignatureCellState.memoryPluckLastStep = stepIndex;
    SignatureCellState.lastFlavor = "memoryPluck";
  } catch (error) {
    console.warn("[Music] memory pluck signature failed:", error);
  }
}

function triggerAudibleGrooveFloor(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    isRest,
    isAccentStep
  } = context;
  const character = currentPresetCharacter();
  const gradient = GradientState;
  const depth = DepthState;
  const chaos = OrganicChaosState;
  const eco = OrganicEcosystemState;
  const hazeScale = (character.hazeScale || 1) * (0.88 + gradient.haze * 0.16 + gradient.chrome * 0.07 + depth.bed * 0.08 + depth.tail * 0.05 + eco.breath * 0.05);
  const pulseScale = (character.pulseScale || 1) * (0.88 + gradient.ghost * 0.14 + gradient.micro * 0.07 + depth.pulse * 0.1 + chaos.lowMotion * 0.06);
  const inWarmup = GrooveState.floorWarmupSteps > 0;
  const voiding = PerformancePadState.void > 0;
  const floorGate = inWarmup || step % 2 === 0 || (isRest && step % 8 === 2);
  if (!floorGate) return;

  const airTime = time + 0.008 + (PerformancePadState.drift ? Math.random() * 0.026 : Math.random() * (0.01 + chaos.tangle * 0.01));
  const ghostTextureVel = clampValue(
    0.014 + observerNorm * 0.02 + creationNorm * 0.014 + gradient.ghost * 0.004 + gradient.micro * 0.004 + depth.particle * 0.004 + chaos.tangle * 0.008 + PerformancePadState.drift * 0.017 + voiding * 0.014,
    0.014,
    0.06
  );
  const ghostGlassVel = clampValue(
    0.018 + observerNorm * 0.034 + (1 - energyNorm) * 0.012 + gradient.chrome * 0.008 + gradient.memory * 0.005 + depth.tail * 0.005 + chaos.airPull * 0.014 + eco.breath * 0.006 + PerformancePadState.void * 0.026,
    0.016,
    0.086
  );

  try {
    if (step % 2 === 0 || inWarmup || voiding) {
      texture.triggerAttackRelease("64n", airTime, ghostTextureVel);
    }
  } catch (error) {
    console.warn("[Music] ghost texture floor failed:", error);
  }

  if (step % 8 === 0 && !voiding && rand(0.64 * pulseScale)) {
    try {
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), "16n", time + 0.006, clampValue(0.095 + energyNorm * 0.036 + PerformancePadState.punch * 0.036, 0.07, 0.19));
    } catch (error) {
      console.warn("[Music] ghost pulse failed:", error);
    }
  }

  if ((step % 8 === 2 || step % 8 === 6) && rand((0.26 + observerNorm * 0.16 + waveNorm * 0.07 + gradient.ghost * 0.05 + chaos.tangle * 0.03) * pulseScale)) {
    const note = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle) % FIELD_MURK_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "64n", airTime + 0.018, clampValue(0.022 + observerNorm * 0.027 + gradient.ghost * 0.007 + PerformancePadState.repeat * 0.019, 0.016, 0.074));
    } catch (error) {
      console.warn("[Music] soft pulse glass failed:", error);
    }
  }

  if ((step % 8 === 4 || inWarmup || voiding || isAccentStep) && rand(0.52 + PerformancePadState.void * 0.34)) {
    const notes = voiding ? TRANSPARENT_AIR_FRAGMENTS : FIELD_MURK_FRAGMENTS;
    const note = notes[(step + GrooveState.cycle + Math.floor(waveNorm * 5)) % notes.length];
    try {
      glass.triggerAttackRelease(note, voiding ? "16n" : "32n", airTime + 0.012, ghostGlassVel);
    } catch (error) {
      console.warn("[Music] ghost glass floor failed:", error);
    }
  }

  const hazeGate = step % 8 === 0 || step % 8 === 4 || (voiding && step % 8 === 6);
  const hazeChance = chance((0.18 + observerNorm * 0.16 + circleNorm * 0.14 + (1 - energyNorm) * 0.07 + gradient.haze * 0.08 + gradient.chrome * 0.04 + depth.bed * 0.04 + depth.tail * 0.025 + PerformancePadState.void * 0.16) * hazeScale);
  if (hazeGate && (inWarmup || rand(hazeChance))) {
    try {
      pad.triggerAttackRelease(randomHazeChord(), voiding ? "2n" : "1n", airTime + 0.018, clampValue(0.027 + observerNorm * 0.027 + circleNorm * 0.015 + (1 - energyNorm) * 0.012 + gradient.haze * 0.006 + depth.bed * 0.004, 0.023, 0.078));
    } catch (error) {
      console.warn("[Music] haze bed pad failed:", error);
    }
  }

  if (GrooveState.floorWarmupSteps > 0) GrooveState.floorWarmupSteps--;
}

function triggerOrganicTexture(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    voidNorm,
    isRest,
    isAccentStep
  } = context;
  const character = currentPresetCharacter();
  const gradient = GradientState;
  const depth = DepthState;
  const chaos = OrganicChaosState;
  const organicScale = (character.organicScale || 1) * (0.88 + gradient.organic * 0.18 + depth.particle * 0.08);
  const dustScale = (character.dustScale || 1) * (0.9 + gradient.memory * 0.07 + gradient.micro * 0.07 + depth.bed * 0.05 + depth.particle * 0.04);
  const pressureColor = (character.pressureColor || 0.5) * (0.9 + gradient.ghost * 0.2);
  const pluckGate = step % 8 === 1 || step % 8 === 5 || (PerformancePadState.drift && step % 8 === 3) || (chaos.tangle > 0.22 && step % 8 === 7);
  const organicProb = chance((0.022 + observerNorm * 0.034 + creationNorm * 0.028 + waveNorm * 0.022 + gradient.organic * 0.022 + depth.particle * 0.014 + chaos.tangle * 0.03 + PerformancePadState.drift * 0.054 + PerformancePadState.void * 0.022) * organicScale);

  if (pluckGate && rand(organicProb)) {
    const note = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + Math.floor(waveNorm * 4)) % ORGANIC_PLUCK_FRAGMENTS.length];
    const echoNote = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 3) % ORGANIC_PLUCK_FRAGMENTS.length];
    const pluckTime = time + 0.014 + Math.random() * (0.012 + waveNorm * 0.014 + chaos.tangle * 0.016);
    const vel = clampValue(0.023 + observerNorm * 0.036 + creationNorm * 0.026 + gradient.organic * 0.008 + depth.particle * 0.006 + chaos.impulse * 0.014 + PerformancePadState.drift * 0.016, 0.018, 0.104);
    try {
      glass.triggerAttackRelease(note, "64n", pluckTime, vel);
      rememberMotif(note, {
        reply: echoNote,
        shade: FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + 2) % FIELD_MURK_FRAGMENTS.length],
        strength: 0.035 + vel * 0.18,
        air: PerformancePadState.void ? 0.12 : 0.04,
        source: "organic"
      });
      if (rand(0.3 + TimbreState.harp * 0.28 + gradient.micro * 0.1 + chaos.tangle * 0.16 + PerformancePadState.repeat * 0.2)) {
        glass.triggerAttackRelease(echoNote, "64n", pluckTime + 0.044 + Math.random() * (0.02 + chaos.tangle * 0.018), vel * clampValue(0.54 + chaos.airPull * 0.08, 0.5, 0.66));
      }
      if (rand(0.28 + dustScale * 0.1 + chaos.tangle * 0.1)) {
        texture.triggerAttackRelease("64n", pluckTime + 0.01, clampValue(0.016 + creationNorm * 0.026 + dustScale * 0.014 + chaos.impulse * 0.012, 0.014, 0.08));
      }
    } catch (error) {
      console.warn("[Music] organic pluck failed:", error);
    }
  }

  const pressure = clampValue((energyNorm * 0.42) + (creationNorm * 0.34) + (resourceNorm * 0.16) + (waveNorm * 0.08) - (voidNorm * 0.22), 0, 1);
  const pressureGate = !isRest && !PerformancePadState.void && pressure > 0.62 && (step % 16 === 10 || isAccentStep);
  if (pressureGate && rand((0.024 + pressure * 0.062 + gradient.ghost * 0.018 + chaos.lowMotion * 0.02) * pressureColor)) {
    const turnNote = tonalRhymeLow(step, 2);
    try {
      glass.triggerAttackRelease(organicFragment(1), "64n", time + 0.012, clampValue(0.024 + pressure * 0.042, 0.022, 0.078));
      if (rand(0.36)) {
        bass.triggerAttackRelease(turnNote, "64n", time + 0.026, clampValue(0.055 + pressure * 0.036, 0.05, 0.11));
      }
    } catch (error) {
      console.warn("[Music] pressure color failed:", error);
    }
  }
}

function triggerGranularDetail(step, time, context) {
  const {
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    isAccentStep
  } = context;
  const gradient = GradientState;
  const depth = DepthState;
  const drift = PerformancePadState.drift;
  const repeat = PerformancePadState.repeat;
  const voiding = PerformancePadState.void;
  const chaos = OrganicChaosState;
  const eco = OrganicEcosystemState;
  const focus = clampValue(
    (gradient.micro * 0.28) +
      (gradient.chrome * 0.22) +
      (gradient.organic * 0.16) +
      (depth.particle * 0.2) +
      (chaos.tangle * 0.24) +
      (chaos.airPull * 0.12) +
      (eco.sprout * 0.08) +
      (eco.ferment * 0.06) +
      (observerNorm * 0.12) +
      (creationNorm * 0.12) +
      (repeat * 0.08) +
      (drift * 0.06),
    0,
    1
  );
  const grainGate = step % 8 === 1 || step % 8 === 5 || (chaos.tangle > 0.18 && step % 8 === 3) || (eco.sprout > 0.32 && step % 8 === 7) || (isAccentStep && step % 2 === 1);
  const grainChance = chance(0.018 + focus * 0.105 + resourceNorm * 0.018 + chaos.tangle * 0.04 + eco.sprout * 0.024 + voiding * 0.018);
  if (!grainGate || !rand(grainChance)) return;

  const brightPool = voiding || gradient.chrome > gradient.organic
    ? TRANSPARENT_AIR_FRAGMENTS
    : GLASS_NOTES;
  const organicPool = ORGANIC_PLUCK_FRAGMENTS;
  const root = brightPool[(step + GrooveState.cycle + Math.floor(waveNorm * 5)) % brightPool.length];
  const lift = brightPool[(step + GrooveState.cycle + 2 + Math.floor(observerNorm * 4)) % brightPool.length];
  const wood = organicPool[(step + GrooveState.cycle + 3) % organicPool.length];
  const grainTime = time + 0.014 + Math.random() * (0.012 + waveNorm * 0.018 + chaos.tangle * 0.018 + eco.ferment * 0.012);
  const baseVel = clampValue(
    0.018 + focus * 0.046 + observerNorm * 0.016 + creationNorm * 0.012 + chaos.impulse * 0.01 + voiding * 0.008,
    0.016,
    0.096
  );

  try {
    glass.triggerAttackRelease(root, "64n", grainTime, baseVel);
    rememberMotif(root, {
      reply: lift,
      shade: wood,
      strength: 0.028 + baseVel * 0.16 + chaos.tangle * 0.025,
      air: voiding ? 0.16 : chaos.airPull * 0.08,
      source: "grain"
    });
    if (rand(0.34 + gradient.micro * 0.22 + chaos.tangle * 0.14 + repeat * 0.18)) {
      glass.triggerAttackRelease(lift, "64n", grainTime + 0.034 + Math.random() * (0.018 + chaos.tangle * 0.014), baseVel * clampValue(0.6 + focus * 0.16 + chaos.airPull * 0.08, 0.54, 0.8));
    }
    if (rand(0.18 + gradient.organic * 0.16 + chaos.tangle * 0.12 + eco.sprout * 0.08 + drift * 0.14)) {
      glass.triggerAttackRelease(wood, "64n", grainTime + 0.066 + Math.random() * (0.024 + chaos.tangle * 0.018), baseVel * 0.5);
    }
    if (rand(0.24 + gradient.micro * 0.16 + depth.gesture * 0.12 + chaos.impulse * 0.1)) {
      texture.triggerAttackRelease("64n", grainTime + 0.008, clampValue(0.014 + focus * 0.032 + resourceNorm * 0.01 + chaos.impulse * 0.012, 0.012, 0.07));
    }
  } catch (error) {
    console.warn("[Music] granular detail failed:", error);
  }
}

function triggerClarityFilament(step, time, context) {
  const {
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    isAccentStep
  } = context;
  const clarity = MixGovernorState.clarity;
  if (!glass || clarity < 0.24 || MixGovernorState.eventLoad > 0.82) return;

  const gradient = GradientState;
  const depth = DepthState;
  const lowGuard = MixGovernorState.lowGuard;
  const gate = step % 8 === 3 || step % 8 === 7 || (isAccentStep && step % 2 === 1);
  const chanceValue = chance(
    0.012 +
      clarity * 0.058 +
      gradient.chrome * 0.018 +
      depth.tail * 0.018 +
      LongformArcState.breath * 0.012 -
      lowGuard * 0.016
  );
  if (!gate || !rand(chanceValue)) return;

  const note = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + Math.floor(waveNorm * 4)) % TRANSPARENT_AIR_FRAGMENTS.length];
  const reply = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
  const organicNote = ORGANIC_PLUCK_FRAGMENTS[(GrooveState.cycle + stepIndex + 2) % ORGANIC_PLUCK_FRAGMENTS.length];
  const filamentTime = time + 0.016 + Math.random() * (0.014 + waveNorm * 0.014);
  const vel = clampValue(0.016 + clarity * 0.04 + observerNorm * 0.016 + creationNorm * 0.008, 0.014, 0.078);

  try {
    glass.triggerAttackRelease(note, "64n", filamentTime, vel);
    if (rand(0.24 + circleNorm * 0.16 + gradient.memory * 0.12)) {
      glass.triggerAttackRelease(reply, "64n", filamentTime + 0.046 + Math.random() * 0.022, vel * 0.58);
    }
    if (rand(0.14 + gradient.organic * 0.14 + LongformArcState.contrast * 0.08)) {
      glass.triggerAttackRelease(organicNote, "64n", filamentTime + 0.084 + Math.random() * 0.018, vel * 0.42);
    }
    if (rand(0.18 + clarity * 0.16)) {
      texture.triggerAttackRelease("64n", filamentTime + 0.006, clampValue(0.012 + clarity * 0.026, 0.012, 0.052));
    }
    markMixEvent(0.16);
  } catch (error) {
    console.warn("[Music] clarity filament failed:", error);
  }
}

function triggerMotifAfterimage(step, time, context) {
  const {
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    isAccentStep
  } = context;
  const memory = MotifMemoryState;
  const refrain = BpmCrossfadeState.refrain;
  if (!glass || memory.strength + refrain * 0.16 < 0.024) return;
  if (stepIndex - memory.lastStep < 3) return;

  const chaos = organicChaosAmount();
  const replyGate = step % 8 === 3 || step % 8 === 7 || (OrganicChaosState.airPull > 0.18 && step % 8 === 5) || (isAccentStep && step % 2 === 1);
  const replyChance = chance(
    0.018 +
      memory.strength * 0.16 +
      memory.air * 0.04 +
      chaos * 0.05 +
      observerNorm * 0.03 +
      creationNorm * 0.018 +
      refrain * 0.045 +
      BpmCrossfadeState.blend * 0.022
  );
  if (!replyGate || !rand(replyChance)) return;

  const airy = memory.air + PerformancePadState.void + OrganicChaosState.airPull > 0.34;
  const first = airy ? memory.reply : memory.root;
  const second = airy
    ? TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + step + 2) % TRANSPARENT_AIR_FRAGMENTS.length]
    : memory.shade;
  const afterTime = time + 0.022 + Math.random() * (0.018 + waveNorm * 0.016 + chaos * 0.016);
  const vel = clampValue(0.018 + memory.strength * 0.07 + refrain * 0.018 + observerNorm * 0.018 + circleNorm * 0.01, 0.016, 0.096);

  try {
    glass.triggerAttackRelease(first, airy ? "16n" : "32n", afterTime, vel);
    if (rand(0.2 + memory.strength * 0.22 + OrganicChaosState.tangle * 0.1 + refrain * 0.08)) {
      glass.triggerAttackRelease(second, "64n", afterTime + 0.05 + Math.random() * 0.024, vel * 0.56);
    }
    if (rand(0.18 + memory.strength * 0.16 + OrganicChaosState.tangle * 0.08)) {
      texture.triggerAttackRelease("64n", afterTime + 0.012, clampValue(0.012 + memory.strength * 0.034, 0.012, 0.058));
    }
    memory.strength *= 0.74;
    memory.air *= 0.78;
    memory.lastStep = stepIndex;
  } catch (error) {
    console.warn("[Music] motif afterimage failed:", error);
  }
}

function triggerTonalRhymeResponse(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!glass || MixGovernorState.eventLoad > 0.88) return;

  const autoDrive = (UCM.auto.enabled || HazamaBridgeState.active) ? 1 : 0;
  const acid = acidPerformanceAmount();
  const memory = MotifMemoryState;
  const phraseTurn = step % 16 === 0;
  const offReply = step % 16 === 6 || step % 16 === 10;
  const accentReply = isAccentStep && step % 2 === 1;
  if (!phraseTurn && !offReply && !accentReply) return;

  const response = clampValue(
    0.1 +
      memory.strength * 0.24 +
      BpmCrossfadeState.refrain * 0.16 +
      VoiceEmergenceState.refrain * 0.14 +
      GenomeState.genes.refrain * 0.14 +
      LongformArcState.breath * 0.05 +
      autoDrive * 0.08 +
      acid * 0.12,
    0,
    1
  );
  const gateChance = chance(
    0.018 +
      response * 0.14 +
      observerNorm * 0.02 +
      creationNorm * 0.014 +
      GradientState.memory * 0.02 -
      voidNorm * 0.02
  );
  if (!rand(gateChance)) return;

  const airy = PerformancePadState.void || voidNorm > 0.56 || GradientState.haze > 0.58;
  const pressure = acid > 0.38 || GenreBlendState.pressure > 0.32;
  const root = airy ? tonalRhymeHigh(step, 0) : tonalRhymeMid(step, 0);
  const reply = pressure ? tonalRhymeMid(step, 3) : tonalRhymeHigh(step, 2);
  const shade = airy ? tonalRhymeHigh(step, 5) : tonalRhymeMid(step, 5);
  const low = tonalRhymeLow(step, phraseTurn ? 0 : 2);
  const responseTime = time + 0.018 + Math.random() * (0.012 + waveNorm * 0.014);
  const baseVel = clampValue(
    0.016 +
      response * 0.05 +
      observerNorm * 0.012 +
      circleNorm * 0.008 +
      acid * 0.012,
    0.014,
    0.09
  );

  try {
    if (phraseTurn && pad && rand(0.18 + response * 0.18 + circleNorm * 0.08)) {
      pad.triggerAttackRelease(randomHazeChord(), airy ? "1n" : "2n", responseTime + 0.012, clampValue(0.014 + response * 0.036 + circleNorm * 0.008, 0.012, 0.06));
    }
    glass.triggerAttackRelease(root, pressure ? "64n" : "32n", responseTime, baseVel);
    if (rand(0.42 + response * 0.22)) {
      glass.triggerAttackRelease(reply, airy ? "16n" : "64n", responseTime + 0.052 + Math.random() * 0.02, clampValue(baseVel * (airy ? 0.58 : 0.7), 0.012, 0.072));
    }
    if (rand(0.22 + response * 0.16 + GradientState.organic * 0.1)) {
      glass.triggerAttackRelease(shade, "64n", responseTime + 0.092 + Math.random() * 0.018, clampValue(baseVel * 0.44, 0.01, 0.05));
    }
    if (bass && (phraseTurn || pressure) && rand(0.16 + response * 0.12 + acid * 0.18 - MixGovernorState.lowGuard * 0.1)) {
      bass.triggerAttackRelease(low, pressure ? "64n" : "32n", responseTime + 0.026, clampValue(0.036 + response * 0.038 + energyNorm * 0.016 + acid * 0.03 - MixGovernorState.lowGuard * 0.02, 0.03, pressure ? 0.14 : 0.1));
    }
    if (texture && !airy && rand(0.16 + response * 0.14 + pressure * 0.12)) {
      texture.triggerAttackRelease("64n", responseTime + 0.01, clampValue(0.012 + response * 0.032 + pressure * 0.018, 0.012, 0.064));
    }
    rememberMotif(root, {
      reply,
      shade,
      strength: 0.032 + response * 0.08,
      air: airy ? 0.16 + response * 0.1 : 0.05 + GradientState.chrome * 0.04,
      source: "tonal-response"
    });
    markMixEvent(0.08 + response * 0.05);
  } catch (error) {
    console.warn("[Music] tonal response failed:", error);
  }
}

function triggerTimbreFamilyResponse(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    voidNorm,
    isAccentStep
  } = context;
  const family = TimbreFamilyState;
  const genre = GenreBlendState;
  const gradient = GradientState;
  const depth = DepthState;
  const kits = GenreTimbreKitState;
  const lowGuard = MixGovernorState.lowGuard;
  const eventLoad = MixGovernorState.eventLoad;
  if (eventLoad > 0.94 && !PerformancePadState.void) return;
  const habitMemory = producerHabitBias("memoryPluck");
  const habitGrid = producerHabitBias("dryGrid");
  const habitPressure = producerHabitBias("ghostPressure");
  const habitSpace = producerHabitBias("transparentVoid");
  const habitRubber = producerHabitBias("rubberEdit");
  const habitRestraint = producerHabitBias("restraint");

  const inner = TimbreFamilyState.inner || {};
  const phaseOffset = Math.floor((GenomeState.phase || 0) * 8) + TonalRhymeState.stepOffset + (inner.generation || 0);
  const chain = clampValue(family.chain + (inner.chain || 0) * 0.08 + MotifMemoryState.strength * 0.18 + (HazamaBridgeState.active ? 0.08 : 0), 0, 1);
  const droneThin = EngineParams.bpm < 84 || energyNorm < 0.32 || genre.ambient > 0.46;
  const acidAmount = acidPerformanceAmount();
  const acidOn = acidAmount > 0.18 && family.acidBiyon > 0.18 && PerformancePadState.void < 0.5;
  const phraseTurn = step % 16 === 0 || step % 16 === 8;
  const offPulse = step % 16 === 3 || step % 16 === 6 || step % 16 === 11 || step % 16 === 14;
  // tight onset — the pianoMemory lead should lock to the beat, not drag
  // behind the rhythm section (old random push was up to ~46ms late).
  const driftedTime = time + Math.random() * 0.012;
  const chromeHymn = clampValue(gradient.chrome * 0.28 + gradient.haze * 0.18 + depth.tail * 0.18 + observerNorm * 0.12 + family.voiceDust * 0.1 + chain * 0.08 + ReferenceMorphState.chrome * 0.06 + kits.ambientKit * 0.035 + kits.spaceKit * 0.045 + habitSpace * 0.04 + habitMemory * 0.02 + habitRestraint * 0.01, 0, 1);
  const brokenLogic = clampValue(gradient.micro * 0.26 + genre.idm * 0.18 + family.drumSkin * 0.12 + family.acidBiyon * 0.12 + BpmCrossfadeState.refrain * 0.1 + PerformancePadState.repeat * 0.12 + ReferenceMorphState.broken * 0.07 + RdjGrowthState.edit * 0.08 + RdjGrowthState.wrong * 0.06 + kits.idmKit * 0.08 + kits.technoKit * 0.045 + habitGrid * 0.06 + habitRubber * 0.05 - habitRestraint * 0.02, 0, 1);
  const ghostBody = clampValue(gradient.ghost * 0.24 + depth.pulse * 0.18 + family.sub808 * 0.16 + genre.pressure * 0.12 + PerformancePadState.punch * 0.12 + kits.pressureKit * 0.08 + habitPressure * 0.04 - kits.spaceKit * 0.04 - habitSpace * 0.02 - lowGuard * 0.16, 0, 1);
  const coldPulse = clampValue(genre.techno * 0.18 + genre.idm * 0.12 + gradient.micro * 0.12 + depth.gesture * 0.12 + family.chain * 0.1 + acidAmount * 0.12 + albumArcFamilyBias("chain") * 0.1 + ReferenceMorphState.pulse * 0.07 + RdjGrowthState.rubber * 0.06 + kits.technoKit * 0.1 + kits.idmKit * 0.035 + habitGrid * 0.06 + habitRubber * 0.04 - genre.ambient * 0.08 - kits.spaceKit * 0.035 - habitRestraint * 0.018, 0, 1);
  const earthBuzz = clampValue(family.reedBuzz * 0.34 + (inner.reedBuzz || 0) * 0.18 + gradient.ghost * 0.16 + depth.bed * 0.14 + ReferenceMorphState.organic * 0.05 + kits.ambientKit * 0.03 + kits.spaceKit * 0.035 + habitSpace * 0.02 + habitPressure * 0.006 + (droneThin ? 0.1 : 0) - kits.technoKit * 0.03 - habitGrid * 0.01 - lowGuard * 0.18 - acidOn * 0.06, 0, 1);

  if (pianoMemory && (step % 16 === 4 || step % 16 === 10 || (PerformancePadState.drift && step % 4 === 1) || (chain > 0.52 && step % 8 === 5))) {
    const pianoChance = chance(0.014 + family.pianoMemory * 0.15 + chain * 0.04 + ReferenceMorphState.organic * 0.014 + kits.idmKit * 0.025 + kits.ambientKit * 0.012 + RdjGrowthState.toy * 0.02 + RdjGrowthState.tender * 0.015 + habitMemory * 0.035 + PerformancePadState.drift * 0.055 - kits.technoKit * 0.025 - RdjGrowthState.restraint * 0.01 - habitRestraint * 0.014 - eventLoad * 0.04);
    if (rand(pianoChance)) {
      const root = tonalRhymeMid(step, phaseOffset + 1);
      const reply = tonalRhymeHigh(step, phaseOffset + 3);
      const shade = tonalRhymeMid(step, phaseOffset + 5);
      const vel = clampValue(0.018 + family.pianoMemory * 0.06 + gradient.memory * 0.012 + chain * 0.012, 0.016, 0.096);
      try {
        pianoMemory.triggerAttackRelease(root, "16n", driftedTime + 0.004, vel);
        if (rand(0.34 + family.pianoMemory * 0.28 + chain * 0.12)) {
          pianoMemory.triggerAttackRelease(reply, "32n", driftedTime + 0.06 + Math.random() * 0.022, vel * 0.58);
        }
        if (rand(0.18 + gradient.memory * 0.2 + family.pianoMemory * 0.12)) {
          pianoMemory.triggerAttackRelease(shade, "64n", driftedTime + 0.128 + Math.random() * 0.02, vel * 0.42);
        }
        if (glass && rand(0.2 + gradient.chrome * 0.16)) {
          glass.triggerAttackRelease(shade, "64n", driftedTime + 0.102, clampValue(vel * 0.46, 0.01, 0.052));
        }
        rememberMotif(root, { reply, shade, strength: 0.04 + family.pianoMemory * 0.08, air: 0.08 + gradient.haze * 0.08, source: "piano-memory" });
        nudgeInnerSourceFamily("pianoMemory", 0.024 + family.pianoMemory * 0.018);
        nudgeInnerSourceFamily("chain", 0.012);
        markMixEvent(0.045 + family.pianoMemory * 0.035);
      } catch (error) {
        console.warn("[Music] piano memory failed:", error);
      }
    }
  }

  if (voiceDust && (step % 16 === 2 || step % 16 === 7 || step % 16 === 13 || (PerformancePadState.void && step % 8 === 5))) {
    const voiceChance = chance(0.012 + family.voiceDust * 0.13 + depth.tail * 0.035 + kits.spaceKit * 0.028 + kits.ambientKit * 0.018 + habitSpace * 0.034 + habitRestraint * 0.006 + PerformancePadState.void * 0.05 + (HazamaBridgeState.active ? 0.022 : 0) - kits.pressureKit * 0.018 - genre.pressure * 0.02);
    if (rand(voiceChance)) {
      const root = tonalRhymeHigh(step, phaseOffset + 2);
      const reply = tonalRhymeHigh(step, phaseOffset + 6);
      const shade = tonalRhymeMid(step, phaseOffset + 4);
      const voiceTime = driftedTime + 0.018 + Math.random() * 0.03;
      const vel = clampValue(0.012 + family.voiceDust * 0.058 + observerNorm * 0.014 + PerformancePadState.void * 0.012, 0.01, 0.078);
      try {
        voiceDust.triggerAttackRelease(root, PerformancePadState.void ? "8n" : "16n", voiceTime, vel);
        if (glass && rand(0.18 + family.voiceDust * 0.2 + gradient.chrome * 0.1)) {
          glass.triggerAttackRelease(reply, "32n", voiceTime + 0.072, clampValue(vel * 0.56, 0.008, 0.048));
        }
        if (texture && rand(0.12 + gradient.ghost * 0.14)) {
          texture.triggerAttackRelease("64n", voiceTime + 0.018, clampValue(0.012 + family.voiceDust * 0.03, 0.01, 0.052));
        }
        if (chromeHymn > 0.46 && rand(0.16 + chromeHymn * 0.18)) {
          voiceDust.triggerAttackRelease(reply, "32n", voiceTime + 0.13 + Math.random() * 0.026, clampValue(vel * 0.46, 0.008, 0.04));
        }
        rememberMotif(root, { reply, shade, strength: 0.03 + family.voiceDust * 0.07, air: 0.18 + depth.tail * 0.08, source: "voice-dust" });
        nudgeInnerSourceFamily("voiceDust", 0.024 + family.voiceDust * 0.018);
        markMixEvent(0.035 + family.voiceDust * 0.035);
      } catch (error) {
        console.warn("[Music] voice dust failed:", error);
      }
    }
  }

  if (drumSkin && !PerformancePadState.void && (offPulse || isAccentStep)) {
    const drumChance = chance((0.01 + family.drumSkin * 0.16 + genre.techno * 0.035 + kits.technoKit * 0.05 + kits.idmKit * 0.026 + kits.pressureKit * 0.02 + habitGrid * 0.04 + habitPressure * 0.012 + PerformancePadState.repeat * 0.05 + (acidOn ? 0.035 : 0) - kits.ambientKit * 0.02 - habitRestraint * 0.014 - eventLoad * 0.035) * (droneThin ? 0.3 : 1));
    if (rand(drumChance)) {
      try {
        drumSkin.triggerAttackRelease("64n", time + 0.008 + Math.random() * 0.012, clampValue(0.014 + family.drumSkin * 0.066 + creationNorm * 0.016 + (acidOn ? 0.024 : 0), 0.01, droneThin ? 0.072 : 0.13));
        if (hat && (genre.techno > 0.24 || acidOn) && rand(0.16 + family.drumSkin * 0.18)) {
          hat.triggerAttackRelease("64n", time + 0.024 + Math.random() * 0.014, clampValue(0.028 + family.drumSkin * 0.055 + energyNorm * 0.018, 0.024, 0.11));
        }
        if (texture && ghostBody > 0.3 && rand(0.16 + ghostBody * 0.22)) {
          texture.triggerAttackRelease("64n", time + 0.034 + Math.random() * 0.012, clampValue(0.014 + ghostBody * 0.044, 0.012, 0.07));
        }
        if (glass && brokenLogic > 0.32 && rand(0.12 + brokenLogic * 0.2)) {
          glass.triggerAttackRelease(tonalRhymeHigh(step, phaseOffset + 4), "64n", time + 0.044 + Math.random() * 0.016, clampValue(0.014 + brokenLogic * 0.042, 0.012, 0.068));
        }
        nudgeInnerSourceFamily("drumSkin", 0.018 + family.drumSkin * 0.015);
        markMixEvent(0.04 + family.drumSkin * 0.035);
      } catch (error) {
        console.warn("[Music] drum skin failed:", error);
      }
    }
  }

  if (subImpact && !PerformancePadState.void && (phraseTurn || (acidOn && step % 8 === 4) || (PerformancePadState.punch && step % 4 === 0))) {
    const subChance = chance((0.018 + family.sub808 * 0.14 + family.acidBiyon * 0.08 + kits.pressureKit * 0.028 + habitPressure * 0.008 + PerformancePadState.punch * 0.08 - kits.spaceKit * 0.025 - habitSpace * 0.018 - habitRestraint * 0.012 - lowGuard * 0.14) * (droneThin && !acidOn ? 0.56 : 1));
    if (rand(subChance)) {
      const note = tonalRhymeSub(step, phaseOffset + (phraseTurn ? 0 : 2));
      const dur = acidOn || PerformancePadState.punch ? "16n" : "8n";
      const vel = clampValue(0.032 + family.sub808 * 0.12 + family.acidBiyon * 0.06 + PerformancePadState.punch * 0.03 - lowGuard * 0.05, 0.022, acidOn ? 0.25 : droneThin ? 0.105 : 0.17);
      try {
        subImpact.triggerAttackRelease(note, dur, time + 0.006, vel);
        rememberMotif(tonalRhymeLow(step, phaseOffset), { reply: tonalRhymeMid(step, phaseOffset + 2), shade: note, strength: 0.026 + family.sub808 * 0.06, air: 0.03, source: "sub808-rhyme" });
        nudgeInnerSourceFamily("sub808", 0.018 + family.sub808 * 0.016);
        markMixEvent(0.06 + family.sub808 * 0.06 + family.acidBiyon * 0.04);
      } catch (error) {
        console.warn("[Music] sub impact failed:", error);
      }
    }
  }

  if (reedBuzz && earthBuzz > 0.26 && !PerformancePadState.punch && (step % 16 === 0 || step % 16 === 8 || (PerformancePadState.void && step % 8 === 4))) {
    const lastBuzzCycle = typeof family.lastReedBuzzCycle === "number" ? family.lastReedBuzzCycle : -99;
    const cycleGap = GrooveState.cycle - lastBuzzCycle;
    const buzzChance = cycleGap < 3 ? 0 : chance(0.008 + earthBuzz * 0.075 + (HazamaBridgeState.active ? 0.012 : 0) + PerformancePadState.void * 0.026 - eventLoad * 0.04);
    if (rand(buzzChance)) {
      const buzzNote = rand(0.58 + gradient.ghost * 0.14)
        ? tonalRhymeLow(step, phaseOffset - 1)
        : tonalRhymeSub(step, phaseOffset + 1);
      const buzzTime = time + 0.032 + Math.random() * (0.024 + waveNorm * 0.016);
      const vel = clampValue(0.018 + earthBuzz * 0.07 - lowGuard * 0.026, 0.014, 0.098);
      try {
        reedBuzz.triggerAttackRelease(buzzNote, PerformancePadState.void ? "1n" : "2n", buzzTime, vel);
        family.lastReedBuzzCycle = GrooveState.cycle;
        if (voiceDust && rand(0.18 + earthBuzz * 0.2)) {
          voiceDust.triggerAttackRelease(tonalRhymeMid(step, phaseOffset + 4), "8n", buzzTime + 0.12, clampValue(vel * 0.36, 0.008, 0.034));
        }
        rememberMotif(tonalRhymeMid(step, phaseOffset + 1), {
          reply: tonalRhymeHigh(step, phaseOffset + 3),
          shade: buzzNote,
          strength: 0.022 + earthBuzz * 0.052,
          air: 0.08 + depth.tail * 0.04,
          source: "reed-buzz"
        });
        nudgeInnerSourceFamily("reedBuzz", 0.024 + earthBuzz * 0.018);
        nudgeInnerSourceFamily("voiceDust", 0.006);
        markMixEvent(0.04 + earthBuzz * 0.035);
      } catch (error) {
        console.warn("[Music] reed buzz failed:", error);
      }
    }
  }

  if (bass && acidOn && !PerformancePadState.void && (offPulse || step % 16 === 1 || step % 16 === 9 || isAccentStep)) {
    const acidIndicator = clampValue(AcidLockState.indicator || 0, 0, 1);
    const acidShape = context.acidShape || { timeOffsetSec: 0, probabilityScale: 1, velocityScale: 1, densityScale: 1, grainScale: 1 };
    const acidHighShape = context.acidHighShape || acidShape;
    const organicShape = context.organicShape || acidHighShape;
    const acidChance = chance((0.11 + family.acidBiyon * 0.32 + acidIndicator * 0.08 + resourceNorm * 0.045 + kits.technoKit * 0.04 + ReferenceMorphState.pulse * 0.024 + RdjGrowthState.rubber * 0.035 + habitRubber * 0.035 + habitGrid * 0.012 + PerformancePadState.repeat * 0.042 - kits.spaceKit * 0.04 - habitSpace * 0.025 - RdjGrowthState.restraint * 0.024 - habitRestraint * 0.022 - lowGuard * 0.12) * acidShape.probabilityScale);
    if (rand(acidChance)) {
      const acidTime = time + acidShape.timeOffsetSec + 0.014 + Math.random() * (0.012 + waveNorm * 0.012) * acidShape.grainScale;
      const note = tonalRhymeLow(step, phaseOffset + 1);
      const turn = tonalRhymeLow(step, phaseOffset + 3);
      const high = tonalRhymeHigh(step, phaseOffset + 2);
      const vel = clampValue((0.06 + family.acidBiyon * 0.13 + energyNorm * 0.018 - lowGuard * 0.04) * acidShape.velocityScale, 0.045, 0.22);
      const cutoff = clampValue(240 + family.acidBiyon * 980 + creationNorm * 260 + resourceNorm * 140 - lowGuard * 140, 140, 1450);
      const q = clampValue(2.2 + family.acidBiyon * 5.2 + creationNorm * 0.8 - lowGuard * 0.8, 1.6, 8.0);
      try {
        safeToneRamp(bass?.filter?.frequency, cutoff, 0.04);
        safeToneRamp(bass?.filter?.Q, q, 0.04);
        bass.triggerAttackRelease(note, "64n", acidTime, vel);
        if (rand((0.42 + family.acidBiyon * 0.26) * acidShape.densityScale)) {
          bass.triggerAttackRelease(turn, "64n", acidTime + 0.047 + Math.random() * 0.014, vel * 0.52);
        }
        if (glass && rand((0.3 + family.acidBiyon * 0.22 + acidIndicator * 0.18) * acidHighShape.probabilityScale)) {
          glass.triggerAttackRelease(high, "64n", acidTime + acidHighShape.timeOffsetSec * 0.35 + 0.026, clampValue((0.022 + family.acidBiyon * 0.068 + acidIndicator * 0.028) * acidHighShape.velocityScale, 0.016, 0.124));
          if ((isAccentStep || step % 16 === 1 || step % 16 === 9) && rand((0.14 + acidIndicator * 0.26) * acidHighShape.densityScale)) {
            glass.triggerAttackRelease(tonalRhymeHigh(step, phaseOffset + 5), "64n", acidTime + acidHighShape.timeOffsetSec * 0.45 + 0.072 + Math.random() * (0.012 * acidHighShape.grainScale), clampValue((0.016 + family.acidBiyon * 0.044 + acidIndicator * 0.024) * acidHighShape.velocityScale, 0.012, 0.086));
          }
        }
        if (pianoMemory && rand((0.03 + ReferenceMorphState.organic * 0.06 + RdjGrowthState.tender * 0.03) * organicShape.probabilityScale)) {
          pianoMemory.triggerAttackRelease(organicFragment(phaseOffset + 2), "64n", acidTime + organicShape.timeOffsetSec * 0.55 + 0.058 + Math.random() * (0.018 * organicShape.grainScale), clampValue((0.012 + ReferenceMorphState.organic * 0.032 + RdjGrowthState.toy * 0.012) * organicShape.velocityScale, 0.01, 0.06));
          nudgeInnerSourceFamily("pianoMemory", 0.006 + ReferenceMorphState.organic * 0.006);
        }
        if (drumSkin && rand(0.18 + family.acidBiyon * 0.18)) {
          drumSkin.triggerAttackRelease("64n", acidTime + 0.016, clampValue(0.018 + family.acidBiyon * 0.05, 0.014, 0.09));
        }
        rememberMotif(note, { reply: high, shade: turn, strength: 0.04 + family.acidBiyon * 0.08, air: 0.02 + gradient.chrome * 0.05, source: "acid-biyon" });
        nudgeInnerSourceFamily("acidBiyon", 0.024 + family.acidBiyon * 0.02);
        nudgeInnerSourceFamily("drumSkin", 0.01);
        markMixEvent(0.07 + family.acidBiyon * 0.08);
      } catch (error) {
        console.warn("[Music] acid biyon failed:", error);
      }
    }
  }

  if (glass && coldPulse > 0.28 && !PerformancePadState.void && (step % 16 === 5 || step % 16 === 12 || (isAccentStep && step % 2 === 1))) {
    const pulseChance = chance(0.012 + coldPulse * 0.12 + brokenLogic * 0.04 + kits.technoKit * 0.025 + habitGrid * 0.05 + habitRubber * 0.03 - habitRestraint * 0.02 - eventLoad * 0.04);
    if (rand(pulseChance)) {
      const root = tonalRhymeMid(step, phaseOffset + 6);
      const reply = tonalRhymeHigh(step, phaseOffset + 1);
      const pulseTime = time + 0.02 + Math.random() * (0.012 + waveNorm * 0.014);
      const vel = clampValue(0.014 + coldPulse * 0.052 + creationNorm * 0.012, 0.012, 0.076);
      try {
        glass.triggerAttackRelease(root, "64n", pulseTime, vel);
        if (rand(0.34 + brokenLogic * 0.24)) {
          glass.triggerAttackRelease(reply, "64n", pulseTime + 0.046 + Math.random() * 0.014, vel * 0.58);
        }
        if (texture && rand(0.2 + coldPulse * 0.18)) {
          texture.triggerAttackRelease("64n", pulseTime + 0.014, clampValue(0.012 + coldPulse * 0.032, 0.01, 0.058));
        }
        rememberMotif(root, { reply, shade: tonalRhymeLow(step, phaseOffset + 2), strength: 0.024 + coldPulse * 0.06, air: gradient.chrome * 0.08, source: "cold-pulse" });
        nudgeInnerSourceFamily("chain", 0.022 + coldPulse * 0.014);
        if (acidOn) nudgeInnerSourceFamily("acidBiyon", 0.012);
        markMixEvent(0.045 + coldPulse * 0.04);
      } catch (error) {
        console.warn("[Music] cold pulse failed:", error);
      }
    }
  }
}

function triggerBpmCrossfadeRefrain(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  const state = BpmCrossfadeState;
  const blend = clampValue(state.blend, 0, 1);
  const refrain = clampValue(state.refrain, 0, 1);
  if (!glass || (blend < 0.035 && refrain < 0.04)) return;
  if (MixGovernorState.eventLoad > 0.86 && !PerformancePadState.void) return;

  const phraseGate = step % 16 === 0 || step % 16 === 4 || step % 16 === 8 || step % 16 === 12 || isAccentStep || AlbumArcState.chapterTurn > 0.24;
  const gateChance = chance(
    0.02 +
      blend * 0.1 +
      refrain * 0.12 +
      AlbumArcState.chapterTurn * 0.06 +
      cultureGrammarBias("refrain", "amount", 0.18) +
      oddLogicBias("rhythmBias", "repeat", 0.14) +
      DepthState.gesture * 0.024 +
      observerNorm * 0.018 +
      creationNorm * 0.014 -
      voidNorm * 0.018
  );
  if (!phraseGate || !rand(gateChance)) return;

  const rising = DJTempoState.motion > 1.5;
  const falling = DJTempoState.motion < -1.5 || PerformancePadState.void;
  const fromZone = state.previousZone || "ambient";
  const toZone = state.zone || fromZone;
  const root = state.motifRoot || ORGANIC_PLUCK_FRAGMENTS[(GrooveState.cycle + step) % ORGANIC_PLUCK_FRAGMENTS.length];
  const reply = state.motifReply || TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + step + 2) % TRANSPARENT_AIR_FRAGMENTS.length];
  const shade = state.motifShade || FIELD_MURK_FRAGMENTS[(GrooveState.cycle + step + 1) % FIELD_MURK_FRAGMENTS.length];
  const refrainTime = time + 0.018 + Math.random() * (0.012 + waveNorm * 0.018);
  const baseVel = clampValue(0.018 + refrain * 0.052 + blend * 0.03 + observerNorm * 0.012, 0.016, 0.092);
  const replyDelay = rising ? 0.044 : falling ? 0.074 : 0.058;

  try {
    if (falling || toZone === "ambient") {
      pad.triggerAttackRelease(randomHazeChord(), PerformancePadState.void ? "2n" : "1n", refrainTime + 0.018, clampValue(0.016 + blend * 0.03 + circleNorm * 0.012 + observerNorm * 0.012, 0.014, 0.064));
    }

    glass.triggerAttackRelease(root, rising || toZone === "grid" ? "64n" : "32n", refrainTime, baseVel);
    if (rand(0.45 + refrain * 0.22 + GradientState.memory * 0.12)) {
      glass.triggerAttackRelease(reply, falling ? "16n" : "64n", refrainTime + replyDelay + Math.random() * 0.018, clampValue(baseVel * (falling ? 0.62 : 0.74), 0.012, 0.076));
    }
    if (rand(0.26 + blend * 0.24 + GradientState.organic * 0.1)) {
      glass.triggerAttackRelease(shade, "64n", refrainTime + replyDelay * 1.72 + Math.random() * 0.02, clampValue(baseVel * 0.48, 0.01, 0.052));
    }
    if (!falling && rand(0.22 + blend * 0.18 + (toZone === "grid" || toZone === "pressure" ? 0.14 : 0))) {
      texture.triggerAttackRelease("64n", refrainTime + 0.01, clampValue(0.012 + blend * 0.042 + energyNorm * 0.012, 0.012, 0.07));
    }
    if (fromZone !== toZone && rand(0.34 + refrain * 0.18)) {
      rememberMotif(reply, {
        reply: root,
        shade,
        strength: 0.04 + refrain * 0.11,
        air: falling ? 0.18 : 0.07,
        source: `refrain:${fromZone}->${toZone}`
      });
    }
    state.refrain *= 0.86;
    markMixEvent(0.12 + blend * 0.05);
  } catch (error) {
    console.warn("[Music] bpm crossfade refrain failed:", error);
  }
}

function triggerGoldenGenomeDevelopment(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!glass || GenomeState.growth < 0.12 || MixGovernorState.eventLoad > 0.88) return;

  const genes = GenomeState.genes;
  const phaseOffset = Math.floor(GenomeState.phase * 13);
  const goldenGate = goldenPulseGate(step, phaseOffset) || (isAccentStep && GenomeState.resonance > 0.22);
  const generativeChance = chance(
    0.012 +
      GenomeState.growth * 0.07 +
      GenomeState.resonance * 0.046 +
      genes.refrain * 0.036 +
      genes.micro * 0.024 +
      genes.organic * 0.02 +
      PerformancePadState.repeat * 0.03 +
      PerformancePadState.drift * 0.022
  );
  if (!goldenGate || !rand(generativeChance)) return;

  const pool = genomeDominantPool();
  const index = (GrooveState.cycle + step + GenomeState.generation + phaseOffset) % pool.length;
  const root = pool[index];
  const reply = genes.chrome + genes.voidTail > genes.organic
    ? TRANSPARENT_AIR_FRAGMENTS[(index + 2) % TRANSPARENT_AIR_FRAGMENTS.length]
    : ORGANIC_PLUCK_FRAGMENTS[(index + 3) % ORGANIC_PLUCK_FRAGMENTS.length];
  const shade = FIELD_MURK_FRAGMENTS[(index + 5) % FIELD_MURK_FRAGMENTS.length];
  const seedDelay = 0.026 + GenomeState.phase * 0.018 + waveNorm * 0.01;
  const replyDelay = seedDelay * GOLDEN_RATIO;
  const shadeDelay = replyDelay * GOLDEN_RATIO;
  const airy = genes.voidTail > 0.46 || PerformancePadState.void || voidNorm > 0.58;
  const vel = clampValue(
    0.016 +
      GenomeState.growth * 0.034 +
      GenomeState.resonance * 0.024 +
      observerNorm * 0.012 +
      creationNorm * 0.012,
    0.014,
    0.088
  );

  try {
    if (airy || genes.haze > 0.56) {
      pad.triggerAttackRelease(randomHazeChord(), airy ? "1n" : "2n", time + seedDelay * GOLDEN_RATIO_INVERSE, clampValue(0.014 + genes.haze * 0.026 + circleNorm * 0.01, 0.012, 0.058));
    }
    glass.triggerAttackRelease(root, genes.micro > 0.54 || genes.pressure > 0.52 ? "64n" : "32n", time + seedDelay, vel);
    if (rand(0.38 + genes.refrain * 0.24 + GenomeState.resonance * 0.08)) {
      glass.triggerAttackRelease(reply, airy ? "16n" : "64n", time + replyDelay, clampValue(vel * (airy ? 0.62 : 0.7), 0.012, 0.07));
    }
    if (rand(0.24 + genes.organic * 0.2 + genes.micro * 0.1)) {
      glass.triggerAttackRelease(shade, "64n", time + shadeDelay, clampValue(vel * 0.44, 0.01, 0.048));
    }
    if (!airy && rand(0.2 + genes.pulse * 0.16 + genes.pressure * 0.1 + resourceNorm * 0.04)) {
      texture.triggerAttackRelease("64n", time + seedDelay * 0.72, clampValue(0.012 + genes.micro * 0.028 + genes.pressure * 0.018 + energyNorm * 0.008, 0.012, 0.064));
    }
    GenomeState.root = root;
    GenomeState.reply = reply;
    GenomeState.shade = shade;
    GenomeState.resonance = clampValue(GenomeState.resonance + 0.045 + genes.refrain * 0.035, 0, 1);
    rememberMotif(root, {
      reply,
      shade,
      strength: 0.034 + genes.refrain * 0.09 + GenomeState.growth * 0.04,
      air: airy ? 0.18 + genes.voidTail * 0.1 : genes.chrome * 0.08,
      source: `golden-genome:${GenomeState.generation}`
    });
    markMixEvent(0.1 + GenomeState.growth * 0.04);
  } catch (error) {
    console.warn("[Music] golden genome development failed:", error);
  }
}

function triggerLongformArcTurn(step, time, context) {
  if (!longformArcActive() || LongformArcState.turn < 0.035) return;
  if (!(step % 8 === 0 || step % 8 === 4)) return;

  const stage = currentLongformArcStage();
  const stageName = stage.name || "submerge";
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm
  } = context;
  const gate = chance(0.052 + LongformArcState.turn * 0.2 + observerNorm * 0.018 + creationNorm * 0.012);
  if (!rand(gate)) return;

  const airy = stageName === "submerge" || stageName === "exhale";
  const organic = stageName === "sprout" || stageName === "ferment";
  const pressure = stageName === "root";
  const arcTime = time + 0.02 + Math.random() * (0.018 + waveNorm * 0.014);
  const first = airy
    ? transparentFragment(stageName === "exhale" ? 4 : 1)
    : organic
      ? organicFragment(stageName === "ferment" ? 5 : 2)
      : FIELD_MURK_FRAGMENTS[(GrooveState.cycle + stepIndex + 1) % FIELD_MURK_FRAGMENTS.length];
  const reply = airy
    ? transparentFragment(stageName === "exhale" ? 1 : 3)
    : GLASS_NOTES[(GrooveState.cycle + stepIndex + 3) % GLASS_NOTES.length];
  const shade = organicFragment(4);
  const vel = clampValue(
    0.018 +
      LongformArcState.turn * 0.042 +
      observerNorm * 0.018 +
      circleNorm * 0.008,
    0.016,
    0.084
  );

  try {
    if (airy) {
      pad.triggerAttackRelease(randomHazeChord(), stageName === "exhale" ? "2n" : "1n", arcTime + 0.016, clampValue(0.024 + LongformArcState.breath * 0.028 + observerNorm * 0.018, 0.02, 0.074));
      glass.triggerAttackRelease(first, "16n", arcTime + 0.038, vel);
    } else {
      glass.triggerAttackRelease(first, organic ? "64n" : "32n", arcTime, vel);
    }

    if (rand(0.3 + LongformArcState.contrast * 0.24)) {
      glass.triggerAttackRelease(reply, "64n", arcTime + 0.052 + Math.random() * 0.026, vel * 0.58);
    }
    if (rand(0.2 + LongformArcState.turn * 0.22 + (organic ? 0.08 : 0))) {
      texture.triggerAttackRelease("64n", arcTime + 0.014, clampValue(0.012 + LongformArcState.contrast * 0.04 + creationNorm * 0.012, 0.012, 0.064));
    }
    if (pressure && rand(0.16 + energyNorm * 0.1)) {
      const lowNote = tonalRhymeLow(step, 2);
      bass.triggerAttackRelease(lowNote, "64n", arcTime + 0.026, clampValue(0.038 + LongformArcState.turn * 0.036 + energyNorm * 0.012, 0.034, 0.09));
    }

    rememberMotif(first, {
      reply,
      shade,
      strength: 0.052 + LongformArcState.turn * 0.08,
      air: airy ? 0.18 + LongformArcState.breath * 0.08 : 0.06,
      source: `arc:${stageName}`
    });
    LongformArcState.turn *= 0.68;
  } catch (error) {
    console.warn("[Music] longform arc turn failed:", error);
  }
}

function triggerOrganicEcosystemBloom(step, time, context) {
  if (!UCM.auto.enabled || !isPlaying) return;
  const eco = OrganicEcosystemState;
  const scene = currentAutoDirectorScene();
  const bloom = clampValue(eco.bloom + eco.sprout * 0.18 + eco.ferment * 0.12, 0, 1);
  if (bloom < 0.08) return;

  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    isAccentStep
  } = context;
  const sceneName = scene.name || "haze";
  const bloomGate = step % 8 === 1 || step % 8 === 5 || (isAccentStep && step % 2 === 1) || (eco.bloom > 0.32 && step % 8 === 7);
  const bloomChance = chance(0.018 + bloom * 0.12 + observerNorm * 0.022 + creationNorm * 0.018);
  if (!bloomGate || !rand(bloomChance)) return;

  const airy = sceneName === "open" || sceneName === "haze" || eco.breath > 0.62;
  const firstPool = airy ? TRANSPARENT_AIR_FRAGMENTS : ORGANIC_PLUCK_FRAGMENTS;
  const first = firstPool[(GrooveState.cycle + stepIndex + Math.floor(waveNorm * 5)) % firstPool.length];
  const reply = airy
    ? TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + 3) % TRANSPARENT_AIR_FRAGMENTS.length]
    : GLASS_NOTES[(GrooveState.cycle + stepIndex + 2) % GLASS_NOTES.length];
  const shade = FIELD_MURK_FRAGMENTS[(GrooveState.cycle + stepIndex + 1) % FIELD_MURK_FRAGMENTS.length];
  const bloomTime = time + 0.018 + Math.random() * (0.02 + waveNorm * 0.018 + eco.ferment * 0.012);
  const vel = clampValue(0.02 + bloom * 0.048 + observerNorm * 0.018, 0.016, 0.09);

  try {
    glass.triggerAttackRelease(first, airy ? "32n" : "64n", bloomTime, vel);
    if (rand(0.24 + eco.sprout * 0.18 + eco.breath * 0.08)) {
      glass.triggerAttackRelease(reply, "64n", bloomTime + 0.052 + Math.random() * 0.028, vel * 0.58);
    }
    if (rand(0.22 + eco.ferment * 0.18)) {
      texture.triggerAttackRelease("64n", bloomTime + 0.012, clampValue(0.014 + eco.ferment * 0.034 + creationNorm * 0.012, 0.012, 0.07));
    }
    if (eco.rootTurn > 0.28 && sceneName !== "open" && rand(0.18 + eco.rootTurn * 0.14)) {
      const lowNote = tonalRhymeLow(step, 1);
      bass.triggerAttackRelease(lowNote, "64n", bloomTime + 0.026, clampValue(0.046 + energyNorm * 0.028 + eco.rootTurn * 0.025, 0.04, 0.11));
    }
    rememberMotif(first, {
      reply,
      shade,
      strength: 0.05 + bloom * 0.08,
      air: airy ? 0.16 + eco.breath * 0.08 : 0.06,
      source: `ecosystem:${sceneName}`
    });
    eco.bloom *= 0.72;
  } catch (error) {
    console.warn("[Music] organic ecosystem bloom failed:", error);
  }
}

function triggerAutoDirectorCadence(step, time, context) {
  if (!UCM.auto.enabled || !AutoDirectorState.cadence || step !== 0) return;
  const cadence = AutoDirectorState.cadence;
  AutoDirectorState.cadence = "";

  const scene = currentAutoDirectorScene();
  const isSceneChange = cadence === "scene";
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm
  } = context;
  const sceneName = scene.name || "haze";
  const cadenceTime = time + 0.018 + Math.random() * (0.016 + waveNorm * 0.012);
  const accentVel = clampValue((isSceneChange ? 0.034 : 0.022) + observerNorm * 0.018 + creationNorm * 0.012, 0.018, 0.082);

  try {
    if (isSceneChange) {
      const gesture = sceneName === "body" ? "punch" : sceneName === "tangle" ? "repeat" : sceneName === "open" ? "void" : "drift";
      exciteOrganicChaos(gesture, "auto");
      rememberGestureMotif(gesture, "auto");
    }

    if (sceneName === "haze" || sceneName === "open") {
      const note = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + (sceneName === "open" ? 3 : 1)) % TRANSPARENT_AIR_FRAGMENTS.length];
      pad.triggerAttackRelease(randomHazeChord(), isSceneChange ? "2n" : "1n", cadenceTime + 0.02, clampValue(0.026 + observerNorm * 0.026 + circleNorm * 0.014, 0.022, 0.07));
      glass.triggerAttackRelease(note, "16n", cadenceTime + 0.04, clampValue(accentVel + 0.006, 0.02, 0.09));
      rememberMotif(note, {
        reply: TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + 4) % TRANSPARENT_AIR_FRAGMENTS.length],
        shade: FIELD_MURK_FRAGMENTS[(GrooveState.cycle + stepIndex + 2) % FIELD_MURK_FRAGMENTS.length],
        strength: isSceneChange ? 0.13 : 0.07,
        air: isSceneChange ? 0.22 : 0.12,
        source: sceneName
      });
    } else if (sceneName === "tangle" || sceneName === "stir") {
      const note = GLASS_NOTES[(GrooveState.cycle + stepIndex + (sceneName === "tangle" ? 5 : 2)) % GLASS_NOTES.length];
      const reply = TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + 1) % TRANSPARENT_AIR_FRAGMENTS.length];
      glass.triggerAttackRelease(note, "64n", cadenceTime + 0.012, clampValue(accentVel + 0.014, 0.024, 0.096));
      glass.triggerAttackRelease(reply, "64n", cadenceTime + 0.058 + Math.random() * 0.018, clampValue(accentVel * 0.62, 0.016, 0.06));
      texture.triggerAttackRelease("64n", cadenceTime + 0.026, clampValue(0.018 + creationNorm * 0.034, 0.016, 0.072));
      rememberMotif(note, {
        reply,
        shade: ORGANIC_PLUCK_FRAGMENTS[(GrooveState.cycle + stepIndex + 3) % ORGANIC_PLUCK_FRAGMENTS.length],
        strength: isSceneChange ? 0.16 : 0.08,
        air: 0.08,
        source: sceneName
      });
    } else if (sceneName === "body") {
      const note = tonalRhymeLow(step, 0);
      bass.triggerAttackRelease(note, "32n", cadenceTime + 0.02, clampValue(0.058 + energyNorm * 0.048, 0.046, 0.13));
      texture.triggerAttackRelease("64n", cadenceTime + 0.028, clampValue(0.028 + creationNorm * 0.04, 0.024, 0.094));
      rememberMotif(ORGANIC_PLUCK_FRAGMENTS[(GrooveState.cycle + stepIndex + 2) % ORGANIC_PLUCK_FRAGMENTS.length], {
        reply: TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + 2) % TRANSPARENT_AIR_FRAGMENTS.length],
        shade: note,
        strength: isSceneChange ? 0.12 : 0.06,
        air: 0.04,
        source: sceneName
      });
    }
  } catch (error) {
    console.warn("[Music] auto director cadence failed:", error);
  }
}

function triggerReferenceDepthDetails(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  const gradient = GradientState;
  const depth = DepthState;
  const genre = GenreBlendState;
  const family = TimbreFamilyState;
  const lowGuard = MixGovernorState.lowGuard;

  const bedGate = step % 8 === 0 || step % 8 === 4;
  if (bedGate && rand(0.035 + genre.ambient * 0.034 + depth.bed * 0.055 + depth.tail * 0.035 + PerformancePadState.void * 0.04 - genre.techno * 0.016)) {
    try {
      pad.triggerAttackRelease(
        randomHazeChord(),
        PerformancePadState.void ? "2n" : "1n",
        time + 0.026 + Math.random() * 0.018,
        clampValue(0.022 + observerNorm * 0.022 + circleNorm * 0.012 + depth.bed * 0.008, 0.02, 0.064)
      );
    } catch (error) {
      console.warn("[Music] depth bed failed:", error);
    }
  }

  const membrane = clampValue(
    depth.bed * 0.24 +
      gradient.haze * 0.18 +
      gradient.ghost * 0.12 +
      family.pianoMemory * 0.08 +
      (1 - energyNorm) * 0.12 +
      voidNorm * 0.08 -
      lowGuard * 0.2,
    0,
    1
  );
  if (membrane > 0.28 && !PerformancePadState.punch && (step % 16 === 0 || step % 16 === 8) && rand(0.016 + membrane * 0.12 + genre.ambient * 0.03 - genre.techno * 0.018)) {
    const lowNote = tonalRhymeLow(step, Math.floor(GenomeState.phase * 4));
    const airNote = tonalRhymeHigh(step, Math.floor(GenomeState.phase * 6) + 2);
    try {
      if (bass && lowGuard < 0.66) {
        bass.triggerAttackRelease(lowNote, PerformancePadState.void ? "2n" : "1n", time + 0.034, clampValue(0.02 + membrane * 0.05 - lowGuard * 0.02, 0.018, 0.084));
      }
      if (voiceDust && rand(0.18 + membrane * 0.22 + depth.tail * 0.08)) {
        voiceDust.triggerAttackRelease(airNote, "4n", time + 0.072 + Math.random() * 0.04, clampValue(0.012 + membrane * 0.04, 0.01, 0.052));
      }
      nudgeInnerSourceFamily("voiceDust", 0.018 + membrane * 0.012);
      if (lowGuard < 0.54) nudgeInnerSourceFamily("sub808", 0.01 + membrane * 0.008);
      const lastBuzzCycle = typeof family.lastReedBuzzCycle === "number" ? family.lastReedBuzzCycle : -99;
      if (reedBuzz && membrane > 0.42 && lowGuard < 0.58 && GrooveState.cycle - lastBuzzCycle >= 3 && rand(0.05 + membrane * 0.072)) {
        reedBuzz.triggerAttackRelease(lowNote, "2n", time + 0.088 + Math.random() * 0.032, clampValue(0.01 + membrane * 0.032, 0.008, 0.04));
        family.lastReedBuzzCycle = GrooveState.cycle;
        nudgeInnerSourceFamily("reedBuzz", 0.018 + membrane * 0.01);
      }
      markMixEvent(0.035 + membrane * 0.025);
    } catch (error) {
      console.warn("[Music] low-mid membrane failed:", error);
    }
  }

  const chromeHymn = clampValue(
    gradient.chrome * 0.24 +
      depth.tail * 0.2 +
      observerNorm * 0.16 +
      circleNorm * 0.1 +
      PerformancePadState.void * 0.14 +
      family.voiceDust * 0.08,
    0,
    1
  );
  if (chromeHymn > 0.36 && (step % 16 === 12 || (PerformancePadState.void && step % 8 === 4)) && rand(0.018 + chromeHymn * 0.11 - genre.pressure * 0.02)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + Math.floor(GenomeState.phase * 5)) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      if (pad && rand(0.16 + chromeHymn * 0.2)) {
        pad.triggerAttackRelease(randomHazeChord(), "1n", time + 0.036, clampValue(0.014 + chromeHymn * 0.034 + circleNorm * 0.008, 0.012, 0.056));
      }
      if (voiceDust) {
        voiceDust.triggerAttackRelease(note, "8n", time + 0.058 + Math.random() * 0.028, clampValue(0.012 + chromeHymn * 0.046 + PerformancePadState.void * 0.01, 0.01, 0.062));
      }
      if (glass && rand(0.28 + gradient.chrome * 0.18)) {
        glass.triggerAttackRelease(tonalRhymeHigh(step, 4), "32n", time + 0.126, clampValue(0.014 + chromeHymn * 0.032, 0.012, 0.054));
      }
      rememberMotif(note, { reply: tonalRhymeHigh(step, 6), shade: tonalRhymeMid(step, 2), strength: 0.025 + chromeHymn * 0.055, air: 0.18 + depth.tail * 0.08, source: "chrome-hymn" });
      nudgeInnerSourceFamily("voiceDust", 0.02 + chromeHymn * 0.012);
      nudgeInnerSourceFamily("chain", 0.008);
      markMixEvent(0.045 + chromeHymn * 0.035);
    } catch (error) {
      console.warn("[Music] chrome hymn failed:", error);
    }
  }

  const memoryGate = step % 8 === 3 || step % 16 === 11 || PerformancePadState.drift || (genre.idm > 0.34 && step % 8 === 5);
  if (memoryGate && rand(0.018 + genre.idm * 0.026 + depth.particle * 0.05 + gradient.memory * 0.038 + PerformancePadState.drift * 0.04)) {
    const note = rand(0.48 + gradient.chrome * 0.18)
      ? TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 3) % TRANSPARENT_AIR_FRAGMENTS.length]
      : ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 1) % ORGANIC_PLUCK_FRAGMENTS.length];
    const echoNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 6) % TRANSPARENT_AIR_FRAGMENTS.length];
    const particleTime = time + 0.018 + Math.random() * (0.018 + waveNorm * 0.018);
    const vel = clampValue(0.018 + observerNorm * 0.024 + creationNorm * 0.022 + depth.particle * 0.01, 0.016, 0.074);
    try {
      glass.triggerAttackRelease(note, "32n", particleTime, vel);
      if (rand(0.26 + depth.tail * 0.28 + PerformancePadState.repeat * 0.12)) {
        glass.triggerAttackRelease(echoNote, "64n", particleTime + 0.058 + Math.random() * 0.026, vel * 0.58);
      }
      if (pianoMemory && rand(0.18 + gradient.memory * 0.2 + family.pianoMemory * 0.14)) {
        pianoMemory.triggerAttackRelease(note, "64n", particleTime + 0.034 + Math.random() * 0.018, clampValue(vel * 0.56, 0.01, 0.048));
      }
      rememberMotif(note, { reply: echoNote, shade: tonalRhymeMid(step, 3), strength: 0.02 + gradient.memory * 0.05, air: depth.tail * 0.05, source: "depth-memory" });
      nudgeInnerSourceFamily("pianoMemory", 0.02 + gradient.memory * 0.012);
      nudgeInnerSourceFamily("chain", 0.01);
    } catch (error) {
      console.warn("[Music] depth particle failed:", error);
    }
  }

  const pulseGate = (step % 8 === 6 || isAccentStep || (genre.techno > 0.36 && step % 4 === 2)) && !PerformancePadState.void;
  if (pulseGate && rand(0.018 + genre.techno * 0.032 + genre.pressure * 0.016 + depth.pulse * 0.055 + gradient.ghost * 0.028)) {
    try {
      texture.triggerAttackRelease("64n", time + 0.012, clampValue(0.022 + depth.pulse * 0.045 + creationNorm * 0.026, 0.02, 0.092));
      if (rand(0.22 + gradient.ghost * 0.22)) {
        glass.triggerAttackRelease(
          FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + 2) % FIELD_MURK_FRAGMENTS.length],
          "64n",
          time + 0.032,
          clampValue(0.016 + energyNorm * 0.022 + depth.pulse * 0.014, 0.014, 0.052)
        );
      }
      if (drumSkin && rand(0.12 + gradient.ghost * 0.22 + family.drumSkin * 0.12)) {
        drumSkin.triggerAttackRelease("64n", time + 0.024 + Math.random() * 0.012, clampValue(0.014 + depth.pulse * 0.04 + gradient.ghost * 0.018, 0.012, 0.07));
      }
      nudgeInnerSourceFamily("drumSkin", 0.016 + depth.pulse * 0.012);
      if (lowGuard < 0.5) nudgeInnerSourceFamily("sub808", 0.008 + gradient.ghost * 0.008);
    } catch (error) {
      console.warn("[Music] depth pulse failed:", error);
    }
  }

  if (PerformancePadState.void && (step % 8 === 7 || step % 16 === 15) && rand(0.18 + depth.tail * 0.34)) {
    try {
      glass.triggerAttackRelease(
        TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 4) % TRANSPARENT_AIR_FRAGMENTS.length],
        "16n",
        time + 0.04,
        clampValue(0.022 + observerNorm * 0.034 + depth.tail * 0.01, 0.02, 0.074)
      );
      nudgeInnerSourceFamily("voiceDust", 0.02 + depth.tail * 0.012);
    } catch (error) {
      console.warn("[Music] depth void tail failed:", error);
    }
  }
}

function triggerReferenceTimbreResearch(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    resourceNorm,
    waveNorm,
    observerNorm,
    circleNorm,
    voidNorm,
    isAccentStep
  } = context;
  if (!glass || MixGovernorState.eventLoad > 0.84) return;

  const gradient = GradientState;
  const depth = DepthState;
  const genre = GenreBlendState;
  const tempoLift = clampValue(DJTempoState.motion / 28, -1, 1);
  const tempoRise = Math.max(0, tempoLift);
  const tempoFall = Math.max(0, -tempoLift);
  const researchAmount = clampValue(
    0.14 +
      gradient.micro * 0.16 +
      gradient.chrome * 0.14 +
      gradient.organic * 0.12 +
      depth.particle * 0.12 +
      depth.tail * 0.08 +
      creationNorm * 0.1 +
      observerNorm * 0.08 +
      Math.abs(tempoLift) * 0.08,
    0,
    1
  );

  const voidAir = PerformancePadState.void || voidNorm > 0.64 || tempoFall > 0.2;
  if (voidAir && (step % 16 === 7 || step % 16 === 15) && rand(0.026 + depth.tail * 0.06 + tempoFall * 0.05 + PerformancePadState.void * 0.08)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 5) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "16n", time + 0.034 + Math.random() * 0.018, clampValue(0.018 + observerNorm * 0.034 + depth.tail * 0.012 + tempoFall * 0.012, 0.016, 0.082));
      if (rand(0.22 + gradient.haze * 0.18 + PerformancePadState.void * 0.14)) {
        pad.triggerAttackRelease(randomHazeChord(), "1n", time + 0.054, clampValue(0.018 + circleNorm * 0.02 + observerNorm * 0.018, 0.016, 0.06));
      }
      markMixEvent(0.08);
      return;
    } catch (error) {
      console.warn("[Music] reference air research failed:", error);
    }
  }

  const gridColor = clampValue(genre.techno * 0.36 + genre.pressure * 0.2 + tempoRise * 0.22 + resourceNorm * 0.12 + energyNorm * 0.1, 0, 1);
  if (!PerformancePadState.void && gridColor > 0.22 && (step % 4 === 1 || step % 4 === 3 || isAccentStep) && rand(0.014 + gridColor * 0.08 + depth.gesture * 0.018)) {
    const note = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + 2) % FIELD_MURK_FRAGMENTS.length];
    try {
      texture.triggerAttackRelease("64n", time + 0.01 + Math.random() * 0.01, clampValue(0.014 + gridColor * 0.046 + creationNorm * 0.012, 0.012, 0.082));
      glass.triggerAttackRelease(note, "64n", time + 0.026 + Math.random() * 0.012, clampValue(0.014 + gridColor * 0.034 + gradient.micro * 0.008, 0.012, 0.07));
      markMixEvent(0.1);
      return;
    } catch (error) {
      console.warn("[Music] reference grid research failed:", error);
    }
  }

  const brokenColor = clampValue(genre.idm * 0.34 + gradient.micro * 0.2 + gradient.organic * 0.14 + waveNorm * 0.12 + tempoRise * 0.08, 0, 1);
  if (brokenColor > 0.24 && (step % 8 === 3 || step % 8 === 5 || isAccentStep) && rand(0.018 + brokenColor * 0.08 + researchAmount * 0.025)) {
    const first = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 1) % ORGANIC_PLUCK_FRAGMENTS.length];
    const reply = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 4) % TRANSPARENT_AIR_FRAGMENTS.length];
    const dt = 0.036 + Math.random() * (0.026 + waveNorm * 0.018);
    try {
      glass.triggerAttackRelease(first, "64n", time + 0.018 + Math.random() * 0.014, clampValue(0.018 + brokenColor * 0.038 + observerNorm * 0.01, 0.016, 0.082));
      if (rand(0.32 + gradient.memory * 0.16 + PerformancePadState.repeat * 0.18)) {
        glass.triggerAttackRelease(reply, "64n", time + 0.018 + dt, clampValue(0.014 + brokenColor * 0.026 + gradient.chrome * 0.008, 0.012, 0.064));
      }
      if (rand(0.18 + gradient.organic * 0.18)) {
        texture.triggerAttackRelease("64n", time + 0.026, clampValue(0.012 + brokenColor * 0.028, 0.012, 0.058));
      }
      rememberMotif(first, {
        reply,
        shade: FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + 3) % FIELD_MURK_FRAGMENTS.length],
        strength: 0.026 + brokenColor * 0.06,
        air: gradient.chrome * 0.08 + tempoFall * 0.06,
        source: "research"
      });
      markMixEvent(0.12);
      return;
    } catch (error) {
      console.warn("[Music] reference broken research failed:", error);
    }
  }

  const hazeColor = clampValue(genre.ambient * 0.34 + gradient.haze * 0.2 + gradient.memory * 0.14 + tempoFall * 0.18 + (1 - energyNorm) * 0.08, 0, 1);
  if (hazeColor > 0.3 && (step % 16 === 0 || step % 16 === 8 || step % 16 === 12) && rand(0.014 + hazeColor * 0.058 + depth.bed * 0.018)) {
    const note = rand(0.48 + gradient.chrome * 0.16)
      ? TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 1) % TRANSPARENT_AIR_FRAGMENTS.length]
      : FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + 4) % FIELD_MURK_FRAGMENTS.length];
    try {
      pad.triggerAttackRelease(randomHazeChord(), "1n", time + 0.028, clampValue(0.018 + hazeColor * 0.034 + circleNorm * 0.01, 0.016, 0.062));
      glass.triggerAttackRelease(note, "32n", time + 0.046 + Math.random() * 0.02, clampValue(0.014 + hazeColor * 0.026 + observerNorm * 0.01, 0.012, 0.06));
      markMixEvent(0.08);
    } catch (error) {
      console.warn("[Music] reference haze research failed:", error);
    }
  }
}

function triggerMicJamResponse(step, time, context = {}) {
  if (!MicFollowState.enabled || MicJamState.cooldownSteps > 0 || MixGovernorState.eventLoad > 0.88) return;
  const jam = micJamShape();
  if (jam.confidence < 0.18 || jam.drive < 0.025) return;
  const gesture = MicJamState.gesture;
  const palette = context.palette || modeTimbrePaletteShape();
  const energyNorm = clampValue(context.energyNorm || 0, 0, 1);
  const observerNorm = clampValue(context.observerNorm || 0, 0, 1);
  const stepMod = step % 16;
  let chanceBoost = 0;
  let cooldown = 4;

  if (gesture === "clap" || gesture === "pulse") {
    if (!(step % 2 === 1 || context.isAccentStep)) return;
    chanceBoost = 0.22 + jam.pulse * 0.32 + jam.clap * 0.24;
    cooldown = gesture === "clap" ? 2 : 3;
  } else if (gesture === "phrase") {
    if (!(stepMod === 3 || stepMod === 7 || stepMod === 11 || context.isAccentStep)) return;
    chanceBoost = 0.16 + jam.phrase * 0.42;
    cooldown = 4;
  } else if (gesture === "hum" || gesture === "breath") {
    if (!(stepMod === 4 || stepMod === 12)) return;
    chanceBoost = 0.12 + jam.hum * 0.22 + jam.breath * 0.18 + jam.air * 0.14;
    cooldown = 5;
  } else if (gesture === "silent") {
    if (stepMod !== 8 || rand(0.5)) return;
    chanceBoost = 0.08 + jam.air * 0.12;
    cooldown = 8;
  } else {
    return;
  }

  const safety = clampValue(1 - Math.max(MixGovernorState.eventLoad || 0, SelfReviewGovernorState.densityBrake || 0, SelfReviewGovernorState.transientSoftener || 0) * 0.42, 0.38, 1);
  if (!rand(chanceBoost * safety)) return;

  const vel = clampValue(0.018 + jam.drive * 0.075 + energyNorm * 0.014 + observerNorm * 0.012, 0.014, gesture === "clap" || gesture === "pulse" ? 0.11 : 0.086);
  try {
    if (gesture === "clap" || gesture === "pulse") {
      if (texture) texture.triggerAttackRelease("64n", time + 0.01 + Math.random() * 0.008, clampValue(vel * (1.05 + palette.transient * 0.24), 0.016, 0.116));
      if (hat && rand(0.28 + jam.pulse * 0.36)) hat.triggerAttackRelease("64n", time + 0.026 + Math.random() * 0.008, clampValue(vel * 0.78, 0.018, 0.092));
      if (glass && rand(0.24 + jam.clap * 0.22)) glass.triggerAttackRelease(tonalRhymeHigh(step, 3), "64n", time + 0.046, clampValue(vel * 0.68, 0.012, 0.066));
    } else if (gesture === "phrase") {
      const first = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle) % ORGANIC_PLUCK_FRAGMENTS.length];
      const reply = GLASS_NOTES[(step + GrooveState.cycle + 5) % GLASS_NOTES.length];
      if (glass) {
        glass.triggerAttackRelease(first, "32n", time + 0.018, clampValue(vel * 0.86, 0.014, 0.082));
        glass.triggerAttackRelease(reply, "64n", time + 0.07 + Math.random() * 0.016, clampValue(vel * 0.56, 0.012, 0.058));
      }
    } else {
      const airNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 2) % TRANSPARENT_AIR_FRAGMENTS.length];
      if (voiceDust && (gesture === "hum" || gesture === "breath")) {
        voiceDust.triggerAttackRelease(airNote, gesture === "hum" ? "4n" : "8n", time + 0.038, clampValue(vel * 0.54, 0.01, 0.046));
      }
      if (glass) glass.triggerAttackRelease(airNote, "16n", time + 0.072, clampValue(vel * (gesture === "silent" ? 0.36 : 0.48), 0.01, 0.052));
    }
    MicJamState.cooldownSteps = cooldown;
    MicJamState.lastCueStep = stepIndex;
    markMixEvent(0.025 + jam.drive * 0.045);
  } catch (error) {
    console.warn("[Music] mic jam response failed:", error);
  }
}

function triggerPadHoldMinimums(step, time, context) {
  const {
    energyNorm,
    creationNorm,
    waveNorm,
    observerNorm,
    isAccentStep
  } = context;
  const gradient = GradientState;
  const genre = GenreBlendState;
  const kits = GenreTimbreKitState;
  const palette = modeTimbrePaletteShape();
  const lowGuard = MixGovernorState.lowGuard || 0;

  if (PerformancePadState.drift && (step % 8 === 1 || step % 8 === 5)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle) % TRANSPARENT_AIR_FRAGMENTS.length];
    const liftNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
    const pluckNote = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 5) % ORGANIC_PLUCK_FRAGMENTS.length];
    try {
      const driftDur = palette.rhythm > 0.42 || kits.technoKit > 0.42 || kits.idmKit > 0.5 ? "64n" : "32n";
      glass.triggerAttackRelease(note, driftDur, time + 0.018 + waveNorm * (0.014 + kits.ambientKit * 0.014 + palette.haze * 0.006), clampValue(0.03 + observerNorm * 0.034 + creationNorm * 0.014 + kits.idmKit * 0.014 + kits.spaceKit * 0.008 + palette.glass * 0.01 + gradient.chrome * 0.006, 0.024, 0.104));
      glass.triggerAttackRelease(liftNote, palette.haze > palette.rhythm || kits.ambientKit > kits.technoKit ? "32n" : "64n", time + 0.058 + waveNorm * 0.016 + kits.ambientKit * 0.018 + palette.haze * 0.012, clampValue(0.018 + observerNorm * 0.024 + kits.ambientKit * 0.012 + kits.idmKit * 0.008 + palette.air * 0.008 + gradient.memory * 0.006, 0.016, 0.076));
      if (palette.glass > 0.32 || kits.idmKit > 0.3 || kits.ambientKit > 0.34) glass.triggerAttackRelease(pluckNote, "64n", time + 0.118 + waveNorm * 0.014, clampValue(0.016 + observerNorm * 0.022 + kits.idmKit * 0.01 + palette.glass * 0.01 + gradient.haze * 0.004, 0.014, 0.064));
      texture.triggerAttackRelease("64n", time + 0.026, clampValue(0.02 + waveNorm * 0.028 + kits.idmKit * 0.014 + kits.technoKit * 0.012 + palette.texture * 0.012, 0.018, 0.082));
      if (pad && (palette.haze > 0.42 || kits.ambientKit > 0.5) && step % 8 === 5 && rand(0.2 + kits.ambientKit * 0.22 + palette.pad * 0.12)) {
        pad.triggerAttackRelease(randomHazeChord(), palette.air > 0.55 ? "2n" : "1n", time + 0.045, clampValue(0.018 + kits.ambientKit * 0.03 + palette.haze * 0.014 + observerNorm * 0.012, 0.016, 0.062));
      }
    } catch (error) {
      console.warn("[Music] drift hold failed:", error);
    }
  }

  if (PerformancePadState.repeat && (step % 8 === 2 || step % 8 === 6)) {
    const note = GLASS_NOTES[(step + GrooveState.cycle) % GLASS_NOTES.length];
    const chipNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 1) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "64n", time + 0.012, clampValue(0.038 + energyNorm * 0.032 + kits.idmKit * 0.022 + kits.technoKit * 0.018 + gradient.micro * 0.008, 0.032, 0.106));
      glass.triggerAttackRelease(note, "64n", time + 0.046 - kits.technoKit * 0.008, clampValue(0.026 + energyNorm * 0.024 + kits.technoKit * 0.018 + gradient.micro * 0.006, 0.022, 0.082));
      if (kits.ambientKit < 0.58) glass.triggerAttackRelease(chipNote, "64n", time + 0.082, clampValue(0.016 + observerNorm * 0.02 + kits.idmKit * 0.012 + gradient.organic * 0.006, 0.014, 0.064));
      if ((palette.rhythm > 0.34 || kits.technoKit > 0.34) && rand(0.22 + kits.technoKit * 0.32 + palette.rhythm * 0.18)) {
        glass.triggerAttackRelease(note, "64n", time + 0.112, clampValue(0.014 + kits.technoKit * 0.04 + palette.glass * 0.008, 0.012, 0.064));
      }
      if (step % 8 === 6) hat.triggerAttackRelease("64n", time + 0.034, clampValue(0.036 + energyNorm * 0.034 + kits.technoKit * 0.036 + kits.idmKit * 0.018 + palette.rhythm * 0.02, 0.03, 0.122));
    } catch (error) {
      console.warn("[Music] repeat hold failed:", error);
    }
  }

  if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep)) {
    try {
      const bodySnap = clampValue(kits.pressureKit + kits.technoKit * 0.4 + kits.idmKit * 0.22 + palette.transient * 0.18 - kits.spaceKit * 0.24 - palette.lowClamp * 0.18, 0, 1);
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), kits.ambientKit > 0.5 && palette.rhythm < 0.34 ? "32n" : "16n", time + 0.006, clampValue(0.14 + energyNorm * 0.058 + bodySnap * 0.074 - lowGuard * 0.05 - palette.lowClamp * 0.024, 0.11, 0.31));
      if (step % 8 === 0 && lowGuard < 0.64 && palette.lowClamp < 0.7 && kits.spaceKit < 0.58) {
        bass.triggerAttackRelease(tonalRhymeSub(step, 1), "32n", time + 0.028, clampValue(0.052 + energyNorm * 0.034 + kits.pressureKit * 0.018 - lowGuard * 0.028 - palette.lowClamp * 0.018, 0.045, 0.125));
      }
      glass.triggerAttackRelease(ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 2) % ORGANIC_PLUCK_FRAGMENTS.length], "64n", time + 0.036, clampValue(0.032 + creationNorm * 0.03 + gradient.organic * 0.008, 0.026, 0.088));
      texture.triggerAttackRelease("64n", time + 0.018, clampValue(0.046 + creationNorm * 0.04 + kits.pressureKit * 0.034 + kits.technoKit * 0.018 + palette.transient * 0.024 + gradient.ghost * 0.01, 0.04, 0.13));
    } catch (error) {
      console.warn("[Music] punch hold failed:", error);
    }
  }

  if (PerformancePadState.void && (step % 8 === 4 || step % 8 === 7)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 2) % TRANSPARENT_AIR_FRAGMENTS.length];
    const tailNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 5) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, palette.air > 0.48 || kits.spaceKit > 0.5 ? "8n" : "16n", time + 0.022, clampValue(0.028 + observerNorm * 0.038 + kits.spaceKit * 0.018 + palette.air * 0.014 + gradient.chrome * 0.008, 0.024, 0.104));
      glass.triggerAttackRelease(tailNote, palette.rhythm > 0.46 || kits.technoKit > 0.44 ? "64n" : "32n", time + 0.112, clampValue(0.018 + observerNorm * 0.03 + kits.spaceKit * 0.014 + palette.air * 0.012 + gradient.haze * 0.006, 0.016, 0.078));
      if ((palette.rhythm > 0.42 || kits.technoKit > 0.42) && texture && rand(0.18 + kits.technoKit * 0.18 + palette.rhythm * 0.1)) {
        texture.triggerAttackRelease("64n", time + 0.052, clampValue(0.012 + kits.technoKit * 0.032 + palette.texture * 0.012, 0.01, 0.056));
      }
      if (step % 8 === 4) {
        pad.triggerAttackRelease(randomHazeChord(), palette.air > 0.52 || kits.spaceKit > 0.52 ? "2n" : "1n", time + 0.04, clampValue(0.024 + observerNorm * 0.024 + kits.spaceKit * 0.018 + palette.air * 0.014 + gradient.haze * 0.006, 0.02, 0.072));
      }
    } catch (error) {
      console.warn("[Music] void hold failed:", error);
    }
  }
}

function releaseAllVoices(time) {
  const t = typeof time === "number" ? time : currentToneContextTime();
  try { pad.releaseAll(t); } catch(e) {}
  try { bass.triggerRelease(t); } catch(e) {}
  try { kick.triggerRelease(t); } catch(e) {}
  try { hat.triggerRelease(t); } catch(e) {}
  try { texture.triggerRelease(t); } catch(e) {}
  try { glass.triggerRelease(t); } catch(e) {}
  try { pianoMemory.releaseAll(t); } catch(e) {}
  try { voiceDust.triggerRelease(t); } catch(e) {}
  try { drumSkin.triggerRelease(t); } catch(e) {}
  try { subImpact.triggerRelease(t); } catch(e) {}
  try { reedBuzz.triggerRelease(t); } catch(e) {}
}

function restoreMasterLevel() {
  applyOutputLevel({ force: true, allowWhenStopped: true });
}

function quietMasterLevel() {
  rampParam("master-gain", masterGain.gain, 0.0001, 0.06, 0);
}

function ensureTransportScheduled() {
  if (transportEventId === null) {
    transportEventId = Tone.Transport.scheduleRepeat((time) => {
      if (!isPlaying) return;
      try {
        scheduleStep(time);
      } catch (error) {
        console.warn("[Music] scheduleStep failed:", error);
        releaseAllVoices(time);
      }
    }, "8n");
  }

  if (barCounterEventId === null) {
    barCounterEventId = Tone.Transport.scheduleRepeat(() => {
      if (!isPlaying) return;
      advanceBarCounter();
    }, "1m", "1m");
  }
}

function scheduleStep(time) {
  maybeTriggerWorldAccents(time);
  const step = stepIndex % EngineParams.stepCount;
  if (step === 0) advanceGrooveStructure();
  else syncHazamaTransportControls(step);
  advanceAutoMixTransport(step);
  syncGenreModeSectionControls(step);
  decayOrganicChaos();
  decayMotifMemory();
  decayBpmCrossfadeMemory();
  decayGenerativeGenome();
  decayOrganicEcosystem();
  decayLongformArc();
  decayMixGovernor();
  decaySignatureCells();
  decayVoiceMorph();
  decayOddLogicDirector();
  decayMicJam();

  // 休符判定
  const genre = GenreBlendState;
  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resourceNorm = clampValue(UCM_CUR.resource / 100, 0, 1);
  const waveNorm = clampValue(UCM_CUR.wave / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const voidNorm = clampValue(UCM_CUR.void / 100, 0, 1);
  const circleNorm = clampValue(UCM_CUR.circle / 100, 0, 1);
  const isAccentStep = step === GrooveState.accentStep || (GrooveState.fillActive && (step % 4 === 3 || step % 8 === 6));
  const chaos = organicChaosAmount();
  const preKit = GenreTimbreKitState;
  const humanShape = (role) => {
    const governor = typeof window !== "undefined" ? window.HumanGrooveGovernor : null;
    if (!governor || typeof governor.shapeStep !== "function") {
      return { timeOffsetSec: 0, probabilityScale: 1, velocityScale: 1, restLift: 0, densityScale: 1, grainScale: 1 };
    }
    return governor.shapeStep({
      role,
      step,
      cycle: GrooveState.cycle,
      energy: energyNorm,
      wave: waveNorm,
      creation: creationNorm,
      resource: resourceNorm,
      voidness: voidNorm,
      circle: circleNorm,
      observer: observerNorm,
      isAccentStep
    }) || { timeOffsetSec: 0, probabilityScale: 1, velocityScale: 1, restLift: 0, densityScale: 1, grainScale: 1 };
  };
  const habitMemory = producerHabitBias("memoryPluck");
  const habitGrid = producerHabitBias("dryGrid");
  const habitPressure = producerHabitBias("ghostPressure");
  const habitSpace = producerHabitBias("transparentVoid");
  const habitRubber = producerHabitBias("rubberEdit");
  const habitRestraint = producerHabitBias("restraint");
  const palette = modeTimbrePaletteShape();
  const micJam = micJamShape();
  const restShape = humanShape("rest");
  const isRest = rand(clampValue(EngineParams.restProb + restShape.restLift + genre.ambient * 0.045 + preKit.ambientKit * 0.03 + preKit.spaceKit * 0.035 + habitSpace * 0.02 + habitRestraint * 0.04 + palette.air * 0.024 + palette.restraint * 0.026 + micJam.air * 0.018 - genre.techno * 0.05 - preKit.technoKit * 0.045 - preKit.idmKit * 0.024 - habitGrid * 0.02 - habitRubber * 0.012 - palette.rhythm * 0.036 - palette.glass * 0.016 - micJam.pulse * 0.035 - micJam.phrase * 0.018 - genre.pressure * 0.025 + PerformancePadState.void * 0.18 - PerformancePadState.punch * 0.06, 0.018, PerformancePadState.void ? 0.66 : 0.52));
  const grooveJitter = (step % 2 === 1 ? mapValue(waveNorm, 0, 1, 0, 0.014 + PerformancePadState.drift * 0.026 + chaos * 0.012) * GrooveState.microJitterScale : 0);
  const fillBoost = GrooveState.fillActive ? 0.14 : 0;
  const t = time + grooveJitter;
  const stepContext = { energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm, isRest, isAccentStep };
  stepContext.acidShape = humanShape("acid");
  stepContext.acidHighShape = humanShape("acidHigh");
  stepContext.organicShape = humanShape("organic");
  const gradientParts = currentGradientParts();
  const gradient = updateReferenceGradient(gradientParts);
  updateReferenceDepth(gradientParts, gradient);
  updateGenreTimbreKits(gradientParts, gradient, DepthState, genre);
  updateTimbreFamilyBlend(gradientParts, gradient, DepthState, genre);
  const kits = GenreTimbreKitState;
  stepContext.palette = palette;
  const lowGuard = MixGovernorState.lowGuard;
  const clarity = MixGovernorState.clarity;
  const voiceMicro = voiceGeneBias("micro");
  const voiceChrome = voiceGeneBias("chrome");
  const voiceOrganic = voiceGeneBias("organic");
  const voiceVoidTail = voiceGeneBias("voidTail");
  const voicePulse = voiceGeneBias("pulse");
  const voiceRefrain = voiceGeneBias("refrain");
  maybeTriggerAutoPerformanceGesture(step, stepContext);
  triggerOddLogicProposalCue(step, t, stepContext);
  triggerAutoDirectorCadence(step, t, stepContext);

  triggerAudibleGrooveFloor(step, t, stepContext);
  triggerOrganicTexture(step, t, stepContext);
  triggerReferenceDepthDetails(step, t, stepContext);
  triggerReferenceTimbreResearch(step, t, stepContext);
  triggerMicJamResponse(step, t, stepContext);
  triggerGranularDetail(step, t, stepContext);
  triggerClarityFilament(step, t, stepContext);
  triggerMotifAfterimage(step, t, stepContext);
  triggerTonalRhymeResponse(step, t, stepContext);
  triggerTimbreFamilyResponse(step, t, stepContext);
  triggerBpmCrossfadeRefrain(step, t, stepContext);
  triggerGoldenGenomeDevelopment(step, t, stepContext);
  triggerLongformArcTurn(step, t, stepContext);
  triggerOrganicEcosystemBloom(step, t, stepContext);
  triggerDroneResonanceBed(step, t, stepContext);
  triggerPerformanceColorDriftDetail(step, t, stepContext);
  triggerVoiceEmergenceDetail(step, t, stepContext);
  triggerMusicRadioBrainIdent(step, t, stepContext);
  triggerGhostGlassSignatureCell(step, t, stepContext);
  triggerMemoryPluckSignatureCell(step, t, stepContext);
  triggerBrokenTextureSignatureCell(step, t, stepContext);
  triggerLowMotion(step, t, stepContext);
  triggerLowBreathSignatureCell(step, t, stepContext);
  triggerAcidTechnoTrace(step, t, stepContext);
  triggerHighBpmIdmMicroDance(step, t, stepContext);
  triggerPadHoldMinimums(step, t, stepContext);

  if (!isRest) {
    const arcDrumThin = albumArcDrumThin();
    const droneDrumThin = EngineParams.bpm < 84 || energyNorm < 0.3 || genre.ambient > 0.44 || kits.ambientKit > 0.58 || kits.spaceKit > 0.62 || palette.haze > 0.54 || palette.air > 0.62 || arcDrumThin > 0.42;
    const droneDrumScale = droneDrumThin ? clampValue(0.12 + (energyNorm * 0.54) + kits.technoKit * 0.34 + kits.idmKit * 0.12 + palette.rhythm * 0.18 - kits.spaceKit * 0.14 - palette.air * 0.08 - arcDrumThin * 0.18, 0.06, 0.58) : 1;
    const kickShape = humanShape("kick");
    const hatShape = humanShape("hat");
    const bassShape = humanShape("bass");
    // fm-70: mic-follow drum-floor follow — scale all drum velocities by the
    // performer's RMS energy when MicFollowState is enabled. Defaults to 1.0
    // when mic is off, so existing mixes are unchanged.
    const micVelScale = fmMicFollowVelocityScale();

    // fm-71: AI fill burst — Magenta DrumsRNN may temporarily override the
    // mode's kick/hat patterns. shouldFire() returns null when no burst is
    // running, otherwise { fire, velocity }. The kick query also ticks the
    // burst countdown (so it advances exactly once per engine step).
    const aiFill = (typeof window !== "undefined" && window.FmAiFill) ? window.FmAiFill : null;
    const aiKick = aiFill ? aiFill.shouldFire("kick", step) : null;
    const aiHat  = aiFill ? aiFill.shouldFire("hat",  step) : null;
    const aiFillActive = !!(aiKick || aiHat);
    const kickPattern = patternVariationForRole("kick");
    const hatPattern = patternVariationForRole("hat");
    const bassPattern = basslineDirectedPattern(patternVariationForRole("bass"));
    const padPattern = patternVariationForRole("pad");
    const skinPattern = patternVariationForRole("skin");

    // Kick
    const kickChance = chance((EngineParams.kickProb + (isAccentStep ? 0.024 : 0) + kits.pressureKit * 0.024 + habitPressure * 0.01 + palette.transient * 0.014 + PerformancePadState.punch * 0.052 - kits.spaceKit * 0.045 - habitSpace * 0.012 - habitRestraint * 0.008 - palette.air * 0.024 - PerformancePadState.void * 0.14) * (1 - lowGuard * 0.16) * (1 - palette.lowClamp * 0.1) * droneDrumScale * kickShape.probabilityScale);
    const kickGate = aiKick ? aiKick.fire : patternAt(kickPattern, step);
    const kickRoll = aiKick ? true : rand(kickChance);
    const aiKickVel = (aiKick && aiKick.fire) ? aiKick.velocity : 1;
    if (kickGate && kickRoll) {
      const kickTime = t + kickShape.timeOffsetSec;
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), droneDrumThin ? "32n" : "16n", kickTime + 0.004, clampValue((0.16 + energyNorm * 0.068 + kits.pressureKit * 0.024 + palette.transient * 0.018 + (isAccentStep ? 0.014 : 0) + PerformancePadState.punch * 0.024 - kits.spaceKit * 0.018 - palette.lowClamp * 0.026 - lowGuard * 0.05) * kickShape.velocityScale * micVelScale * aiKickVel, 0.08, droneDrumThin ? 0.22 : 0.44));
      if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep) && rand(0.46)) {
        try {
          texture.triggerAttackRelease("64n", kickTime + 0.012, clampValue((0.05 + energyNorm * 0.064 + palette.transient * 0.024) * kickShape.velocityScale * micVelScale, 0.038, 0.126));
        } catch (error) {
          console.warn("[Music] punch transient failed:", error);
        }
      }
    }

    // Hat
    const hatChance = chance((EngineParams.hatProb + fillBoost + kits.technoKit * 0.14 + kits.idmKit * 0.068 + habitGrid * 0.05 + habitRubber * 0.014 + palette.rhythm * 0.088 + palette.texture * 0.026 + micJam.pulse * 0.12 + micJam.clap * 0.08 + (isAccentStep ? 0.08 : 0) - kits.ambientKit * 0.06 - kits.spaceKit * 0.05 - habitSpace * 0.02 - habitRestraint * 0.018 - palette.haze * 0.034 - palette.air * 0.04 - micJam.air * 0.025 - PerformancePadState.void * 0.1) * (droneDrumThin ? 0.34 : 1) * hatShape.probabilityScale);
    const hatGate = aiHat ? aiHat.fire : (patternAt(hatPattern, step) || (GrooveState.fillActive && step % 4 === 2));
    const hatRoll = aiHat ? true : rand(hatChance);
    const aiHatVel = (aiHat && aiHat.fire) ? aiHat.velocity : 1;
    if (hatGate && hatRoll) {
      // fm-69: Dilla offbeat-hat push (mode-fixed, layered on humanShape timeOffsetSec)
      const hatVel = clampValue((0.074 + energyNorm * 0.098 + kits.technoKit * 0.05 + kits.idmKit * 0.018 + palette.transient * 0.026 + (isAccentStep ? 0.04 : 0) - palette.air * 0.012) * hatShape.velocityScale * micVelScale * aiHatVel, 0.048, 0.2);
      const hatDilla = dillaOffsetSec("hat", step, hatVel);
      hat.triggerAttackRelease(palette.rhythm > 0.5 || kits.technoKit > 0.44 ? "64n" : "32n", t + hatShape.timeOffsetSec + hatDilla, hatVel);
    }
    if (!aiFillActive && drumSkin && patternAt(skinPattern, step) && lowGuard < 0.72) {
      try {
        const skinVel = clampValue(0.018 + kits.technoKit * 0.018 + kits.idmKit * 0.014 + palette.transient * 0.012 + micJam.clap * 0.018, 0.014, 0.07);
        drumSkin.triggerAttackRelease("128n", t + hatShape.timeOffsetSec + 0.012, skinVel);
      } catch (error) {
        console.warn("[Music] pattern ghost skin failed:", error);
      }
    }
    if ((kits.technoKit > 0.26 || palette.rhythm > 0.34 || micJam.pulse > 0.12) && !PerformancePadState.void && (step % 4 === 1 || step % 4 === 3) && rand((0.045 + kits.technoKit * 0.2 + kits.idmKit * 0.05 + palette.rhythm * 0.13 + micJam.pulse * 0.12 + micJam.clap * 0.06 + habitGrid * 0.08 + habitRubber * 0.018 - kits.spaceKit * 0.035 - palette.air * 0.03 - micJam.air * 0.02 - habitRestraint * 0.03) * hatShape.densityScale)) {
      try {
        hat.triggerAttackRelease("64n", t + hatShape.timeOffsetSec + 0.01 + Math.random() * (0.01 * hatShape.grainScale), clampValue((0.028 + kits.technoKit * 0.07 + energyNorm * 0.024 + palette.transient * 0.018) * hatShape.velocityScale * micVelScale, 0.024, 0.124));
        markMixEvent(0.05);
      } catch (error) {
        console.warn("[Music] techno grid hat failed:", error);
      }
    }
    if (PerformancePadState.repeat && (step % 4 === 2 || isAccentStep || step % 8 === 5) && rand(clampValue(0.42 + kits.idmKit * 0.22 + kits.technoKit * 0.26 + palette.rhythm * 0.12 + palette.glass * 0.04 + habitGrid * 0.06 + habitRubber * 0.04 - kits.ambientKit * 0.12 - palette.haze * 0.04 - habitRestraint * 0.02, 0.18, 0.74) * hatShape.densityScale)) {
      try {
        hat.triggerAttackRelease("64n", t + hatShape.timeOffsetSec + 0.018, clampValue((0.05 + energyNorm * 0.064 + kits.technoKit * 0.024 + palette.transient * 0.016) * hatShape.velocityScale * micVelScale, 0.038, 0.136));
        if (rand((0.28 + kits.technoKit * 0.16) * hatShape.grainScale)) hat.triggerAttackRelease("64n", t + hatShape.timeOffsetSec + 0.034, clampValue((0.036 + energyNorm * 0.048) * hatShape.velocityScale * micVelScale, 0.028, 0.102));
      } catch (error) {
        console.warn("[Music] repeat hat failed:", error);
      }
    }

    // Bass
    const bassChance = chance((EngineParams.bassProb + kits.pressureKit * 0.016 + habitPressure * 0.008 + palette.transient * 0.008 + (GrooveState.fillActive && step % 8 === 6 ? 0.055 : 0) - kits.spaceKit * 0.045 - habitSpace * 0.014 - habitRestraint * 0.008 - palette.lowClamp * 0.026 - palette.air * 0.018 - PerformancePadState.void * 0.14) * (1 - lowGuard * 0.18) * (droneDrumThin ? 0.52 : 1) * bassShape.probabilityScale);
    if (patternAt(bassPattern, step) && rand(bassChance)) {
      const bassInfo = basslineDirectorStepInfo(step);
      const note = bassNoteForStep(step);
      const bassTime = t + bassShape.timeOffsetSec + (bassInfo.ghost ? BasslineDirectorState.humanPush : 0);
      const bassDur = droneDrumThin ? "4n" : basslineDirectorDurationForStep(step, "8n");
      bass.triggerAttackRelease(note, bassDur, bassTime + 0.004, clampValue((0.12 + energyNorm * 0.082 + kits.pressureKit * 0.018 + PerformancePadState.punch * 0.018 - kits.spaceKit * 0.018 - palette.lowClamp * 0.03 - lowGuard * 0.034) * bassShape.velocityScale * basslineDirectorVelocityScale(step), 0.05, droneDrumThin ? 0.16 : 0.27));
      if (PerformancePadState.repeat && step % 8 === 0 && rand(0.1 * bassShape.densityScale)) {
        try {
          bass.triggerAttackRelease(note, "32n", bassTime + 0.04, clampValue((0.08 + energyNorm * 0.04) * bassShape.velocityScale, 0.06, 0.14));
        } catch (error) {
          console.warn("[Music] repeat bass failed:", error);
        }
      }
    }

    // Pad（ゆっくり）
    const padChance = chance(EngineParams.padProb + kits.ambientKit * 0.045 + kits.spaceKit * 0.035 + palette.pad * 0.046 + palette.haze * 0.024 + palette.air * 0.022 + habitMemory * 0.026 + habitSpace * 0.026 + habitRestraint * 0.014 - kits.technoKit * 0.07 - kits.pressureKit * 0.035 - palette.rhythm * 0.04 - palette.transient * 0.016 - habitGrid * 0.024);
    if (patternAt(padPattern, step) && rand(padChance)) {
      const dur = palette.rhythm > 0.52 || kits.technoKit > 0.44 ? "8n" : palette.glass > 0.5 || kits.idmKit > 0.48 ? "4n" : "2n";
      const chord = rand(0.38 + observerNorm * 0.22 + gradient.haze * 0.12 + gradient.chrome * 0.06 + PerformancePadState.void * 0.16) ? randomHazeChord() : randomChordForMode();
      pad.triggerAttackRelease(chord, dur, t, clampValue(0.044 + circleNorm * 0.052 + observerNorm * 0.018 + kits.ambientKit * 0.014 + kits.spaceKit * 0.012 + palette.haze * 0.012 + palette.air * 0.01 - kits.technoKit * 0.012 - palette.rhythm * 0.008 + gradient.haze * 0.006, 0.034, 0.122));
    }
  }

  const textureShape = humanShape("texture");
  const glassShape = humanShape("glass");
  const textureProb = chance((mapValue(UCM_CUR.creation + UCM_CUR.resource, 0, 200, 0.024, 0.19) + GrooveState.textureLift + kits.technoKit * 0.056 + kits.idmKit * 0.038 + kits.pressureKit * 0.02 + palette.texture * 0.062 + palette.rhythm * 0.026 + palette.transient * 0.016 + micJam.pulse * 0.09 + micJam.clap * 0.065 + habitGrid * 0.038 + habitRubber * 0.026 + habitPressure * 0.01 + gradient.micro * 0.014 + gradient.ghost * 0.006 + DepthState.particle * 0.016 + DepthState.gesture * 0.01 + voiceMicro * 0.01 + voicePulse * 0.006 + PerformancePadState.drift * 0.086 - kits.ambientKit * 0.028 - kits.spaceKit * 0.014 - palette.haze * 0.018 - palette.air * 0.014 - micJam.air * 0.016 - habitRestraint * 0.018 - palette.restraint * 0.012 - PerformancePadState.void * 0.01) * textureShape.probabilityScale);
  if (rand(textureProb) && (step % 2 === 1 || isAccentStep)) {
    const textureTime = t + textureShape.timeOffsetSec + (isAccentStep ? 0.006 : 0.012);
    texture.triggerAttackRelease(palette.rhythm > 0.42 || palette.texture > 0.46 || kits.technoKit > 0.38 || kits.idmKit > 0.48 ? "64n" : "32n", textureTime, clampValue((0.024 + creationNorm * 0.078 + resourceNorm * 0.022 + kits.technoKit * 0.02 + kits.pressureKit * 0.018 + palette.transient * 0.02 + gradient.micro * 0.006 + DepthState.gesture * 0.012 + PerformancePadState.punch * 0.014 - palette.restraint * 0.006) * textureShape.velocityScale, 0.018, 0.126));
  }

  const particleProb = chance((0.03 + creationNorm * 0.034 + waveNorm * 0.024 + observerNorm * 0.022 + kits.idmKit * 0.046 + kits.technoKit * 0.03 + kits.spaceKit * 0.018 + palette.glass * 0.052 + palette.rhythm * 0.016 + palette.air * 0.012 + micJam.phrase * 0.085 + micJam.hum * 0.026 + micJam.pulse * 0.02 + habitMemory * 0.022 + habitRubber * 0.022 + habitSpace * 0.012 + gradient.chrome * 0.014 + gradient.micro * 0.01 + DepthState.particle * 0.022 + clarity * 0.018 + voiceChrome * 0.011 + voiceOrganic * 0.008 + voiceRefrain * 0.006 + PerformancePadState.drift * 0.104 + PerformancePadState.repeat * 0.056 + PerformancePadState.void * 0.06 - kits.ambientKit * 0.016 - habitRestraint * 0.012 - palette.restraint * 0.01) * glassShape.probabilityScale);
  if (rand(particleProb) && (step % 4 === 1 || step % 8 === 5 || isAccentStep)) {
    const particlePool = palette.rhythm > 0.5 || kits.technoKit > 0.42 ? GLASS_NOTES : palette.air > 0.52 || kits.spaceKit > 0.52 ? TRANSPARENT_AIR_FRAGMENTS : FIELD_MURK_FRAGMENTS;
    const note = voiceFragment(Math.floor(Math.random() * particlePool.length), particlePool);
    try {
      glass.triggerAttackRelease(note, palette.rhythm > 0.48 || palette.glass > 0.5 || kits.technoKit > 0.42 || kits.idmKit > 0.5 ? "64n" : "32n", t + glassShape.timeOffsetSec + 0.019 + Math.random() * (0.018 * glassShape.grainScale), clampValue((0.022 + creationNorm * 0.034 + kits.idmKit * 0.012 + kits.technoKit * 0.014 + kits.spaceKit * 0.008 + palette.glass * 0.012 + palette.air * 0.008 + gradient.micro * 0.008 + DepthState.particle * 0.008 + clarity * 0.008 + PerformancePadState.repeat * 0.038 + PerformancePadState.void * 0.018) * glassShape.velocityScale, 0.016, 0.108));
    } catch (error) {
      console.warn("[Music] field particle failed:", error);
    }
  }

  const airProb = chance(0.03 + observerNorm * 0.046 + circleNorm * 0.021 + kits.spaceKit * 0.038 + kits.ambientKit * 0.024 + palette.air * 0.068 + palette.haze * 0.022 + micJam.air * 0.07 + micJam.breath * 0.045 + micJam.hum * 0.025 + habitSpace * 0.038 + habitRestraint * 0.012 + gradient.chrome * 0.016 + gradient.haze * 0.009 + DepthState.tail * 0.026 + voiceChrome * 0.012 + voiceVoidTail * 0.016 + PerformancePadState.void * 0.14 + PerformancePadState.drift * 0.066 + PerformancePadState.repeat * 0.022 - kits.pressureKit * 0.012 - palette.transient * 0.018 - micJam.pulse * 0.02);
  if (rand(airProb) && (step % 8 === 4 || step % 8 === 7)) {
    const note = voiceFragment(Math.floor(Math.random() * TRANSPARENT_AIR_FRAGMENTS.length), TRANSPARENT_AIR_FRAGMENTS);
    try {
      glass.triggerAttackRelease(note, palette.air > 0.56 || kits.spaceKit > 0.56 ? "16n" : "32n", t + 0.024, clampValue(0.018 + observerNorm * 0.04 + kits.spaceKit * 0.014 + palette.air * 0.014 + gradient.chrome * 0.008 + DepthState.tail * 0.008 + PerformancePadState.void * 0.025 + PerformancePadState.repeat * 0.012, 0.012, 0.096));
    } catch (error) {
      console.warn("[Music] transparent air failed:", error);
    }
  }

  const glassProb = chance((mapValue(UCM_CUR.mind + UCM_CUR.creation, 0, 200, 0.022, 0.145) + GrooveState.glassLift + kits.idmKit * 0.036 + kits.technoKit * 0.022 + kits.spaceKit * 0.018 + palette.glass * 0.064 + palette.rhythm * 0.018 + palette.air * 0.014 + micJam.phrase * 0.068 + micJam.hum * 0.026 + habitMemory * 0.026 + habitRubber * 0.018 + habitSpace * 0.012 + gradient.memory * 0.012 + gradient.chrome * 0.013 + gradient.micro * 0.009 + DepthState.particle * 0.016 + DepthState.gesture * 0.01 + voiceChrome * 0.012 + voiceRefrain * 0.008 + PerformancePadState.drift * 0.088 + PerformancePadState.repeat * 0.068 + PerformancePadState.void * 0.038 - kits.ambientKit * 0.012 - habitRestraint * 0.012 - palette.restraint * 0.008) * glassShape.probabilityScale);
  if (rand(glassProb) && (isAccentStep || step % 8 === 3 || step % 16 === 11)) {
    const note = voiceFragment(Math.floor(Math.random() * GLASS_NOTES.length), GLASS_NOTES);
    const glassTime = t + glassShape.timeOffsetSec;
    glass.triggerAttackRelease(note, palette.rhythm > 0.5 || kits.technoKit > 0.48 ? "64n" : "16n", glassTime + 0.015, clampValue((0.034 + energyNorm * 0.046 + observerNorm * 0.018 + kits.idmKit * 0.012 + kits.spaceKit * 0.008 + palette.glass * 0.012 + palette.air * 0.006 + PerformancePadState.void * 0.014) * glassShape.velocityScale, 0.024, 0.114));
    if (PerformancePadState.repeat && rand(0.72 * glassShape.grainScale)) {
      try {
        glass.triggerAttackRelease(note, "32n", glassTime + 0.024, clampValue((0.032 + energyNorm * 0.052) * glassShape.velocityScale, 0.024, 0.092));
        if (rand(0.32 * glassShape.grainScale)) glass.triggerAttackRelease(note, "64n", glassTime + 0.04, clampValue((0.022 + energyNorm * 0.038) * glassShape.velocityScale, 0.018, 0.068));
      } catch (error) {
        console.warn("[Music] repeat glass failed:", error);
      }
    }
  }

  stepIndex++;
  publishMusicRuntimeState();
}

/* =========================================================
   6. Auto Cycle（観フェーダー自動変化）
========================================================= */

function startAutoCycle() {
  stopAutoCycle({ keepEnabled: true });

  const autoSlider = document.getElementById("auto_cycle");
  const rawMinutes = autoSlider ? parseInt(autoSlider.value, 10) : 3;
  const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 3;
  const cycleMs = Math.max(30000, minutes * 60 * 1000);

  UCM.auto.enabled = true;
  UCM.auto.cycleMs = cycleMs;
  UCM.auto.lastTransportStep = -1;
  resetAutoDirector();
  resetLongformArc();
  resetAlbumArc();
  resetSection();
  updateRuntimeUiState();
  updateAutoMixTargets(cycleMs, { phaseDelta: 0, syncUi: true });
}

function updateAutoMixTargets(cycleMs, options = {}) {
  if (!UCM.auto.enabled || !isPlaying) return;
  const syncUi = options.syncUi !== false;
  if (HazamaBridgeState.active) {
    if (syncUi) {
      for (const key of AUTOMIX_MOTION_KEYS) syncSliderFromTarget(key);
      updateUIFromParams();
    }
    return;
  }

  const phaseDelta = typeof options.phaseDelta === "number" ? options.phaseDelta : AUTO_MOTION_TICK_MS / cycleMs;
  UCM.auto.phase = (UCM.auto.phase + phaseDelta) % 1;
  for (const key of AUTOMIX_MOTION_KEYS) {
    const profile = AUTOMIX_PROFILE[key];
    const phase = (UCM.auto.phase + profile.phase) % 1;
    const wave = Math.sin(phase * Math.PI * 2);
    const ripple = Math.sin((phase * 2.7 + profile.phase) * Math.PI * 2) * 0.23;
    const directorBias = autoDirectorSceneBias(key);
    const arcBias = longformArcBias(key);
    const albumBias = albumArcBias(key);
    let desired = profile.base + directorBias + arcBias + albumBias + profile.depth * (wave + ripple);
    const sectionTarget = sectionMacroTarget(key);
    if (sectionTarget != null) {
      // v192: hold the param on the current section's plateau, keeping only a
      // little residual sweep (SECTION_LIFE_FACTOR) for life. The plateau
      // steps at section boundaries; the approachValue() below turns that
      // step into a smooth ~few-second glide into the next world.
      desired = sectionTarget + (desired - profile.base) * SECTION_LIFE_FACTOR;
    }
    desired = clampValue(desired, 4, 96);
    const current = typeof UCM_TARGET[key] === "number" ? UCM_TARGET[key] : profile.base;
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    if (isManualInfluenceActive(key, now)) {
      if (syncUi) syncSliderFromTarget(key);
      continue;
    }
    UCM_TARGET[key] = approachValue(current, desired, profile.step);
    if (syncUi) syncSliderFromTarget(key);
  }
  if (syncUi) updateUIFromParams();
}

function stopAutoCycle(options = {}) {
  const keepEnabled = options && options.keepEnabled;
  if (!keepEnabled) UCM.auto.enabled = false;
  cancelAutoGesture({ clearPad: true });

  if (UCM.auto.timer) {
    clearInterval(UCM.auto.timer);
    UCM.auto.timer = null;
  }
  updateRuntimeUiState();
}

/* =========================================================
   7. UI バインド（throttle付き）
========================================================= */

function throttle(fn, delay) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last > delay) {
      last = now;
      fn(...args);
    }
  };
}

async function startPlayback(options = {}) {
  if (isStarting) return false;
  isStarting = true;

  const autoToggle = document.getElementById("auto_toggle");
  const statusText = document.getElementById("status-text");
  const feedbackKind = options.feedbackKind || (HazamaBridgeState.loaded ? "start.hazama" : "start");

  try {
    await Tone.start();
    await resumeAudioContext(options.source || "start");

    ensureTransportScheduled();
    initialized = true;
    safeCallMusicAudioAdapter("start");

    updateFromUI({ apply: false });
    updateOutputLevel({ apply: false });
    updateVoiceColorFromUI({ apply: false });
    resetToneScheduleGuard();
    releaseAllVoices();
    resetRuntimeCounters();
    restoreMasterLevel();
    refreshFocusModulation({ rampInSeconds: 3, rampOutSeconds: 0.35 });
    applyPendingHazamaProfileOnStart();
    applyUCMToParams({ force: true });

    if (!isPlaying) {
      isPlaying = true;
      Tone.Transport.start("+0.03");
    }
    if (statusText) statusText.textContent = hazamaAutoFollowActive() ? "Playing / Hazama" : "Playing…";
    updateRuntimeUiState();

    if (autoToggle && autoToggle.checked) {
      startAutoCycle();
    }
    setupMediaSessionControls();
    updateMediaSessionPlaybackState();
    await startBackgroundAudioBridge();
    requestPlaybackWakeLock();
    requestHazamaRuntimeFeedback(feedbackKind);
    renderModeLabel();
    return true;
  } catch (error) {
    console.warn("[Music] start failed:", error);
    isPlaying = false;
    updateRuntimeUiState();
    releaseAllVoices();
    if (statusText) statusText.textContent = "Start failed";
    return false;
  } finally {
    isStarting = false;
  }
}

function stopPlayback(options = {}) {
  const statusText = document.getElementById("status-text");
  const feedbackKind = options.feedbackKind || "stop";

  isPlaying = false;
  stopLocalRecorder();
  stopAutoCycle({ keepEnabled: true });
  try { Tone.Transport.stop(); } catch(e) {}
  resetToneScheduleGuard();
  releaseAllVoices();
  resetRuntimeCounters();
  clearPerformancePads();
  quietMasterLevel();
  refreshFocusModulation({ rampInSeconds: 3, rampOutSeconds: 0.25 });
  safeCallMusicAudioAdapter("stop");
  updateMediaSessionPlaybackState();
  releasePlaybackWakeLock();
  stopBackgroundAudioBridge();
  if (statusText) statusText.textContent = "Stopped";
  if (HazamaBridgeState.loaded) updateHazamaUiState();
  updateRuntimeUiState();
  requestHazamaRuntimeFeedback(feedbackKind);
}

function setupTransportDockEscape() {
  const dock = document.getElementById("transport-dock");
  const toggle = document.getElementById("transport_dock_toggle");
  if (!dock || !toggle) return;

  const mobileQuery = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  let expanded = false;

  const isMobile = () => !mobileQuery || mobileQuery.matches;
  const apply = () => {
    const mobile = isMobile();
    const collapsed = mobile && !expanded;
    dock.classList.toggle("is-collapsed", collapsed);
    document.body.classList.toggle("transport-dock-expanded", mobile && expanded);
    toggle.hidden = !mobile;
    toggle.tabIndex = mobile ? 0 : -1;
    toggle.setAttribute("aria-expanded", String(mobile && expanded));
    toggle.textContent = collapsed ? "開く" : "畳む";
  };

  toggle.addEventListener("click", () => {
    expanded = dock.classList.contains("is-collapsed");
    apply();
  });

  window.addEventListener("music-stack-route-updated", () => {
    if (!isMobile()) return;
    expanded = true;
    apply();
  });

  if (mobileQuery) {
    const onChange = () => {
      expanded = false;
      apply();
    };
    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", onChange);
    } else if (typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(onChange);
    }
  }

  let lastScrollY = window.scrollY || 0;
  window.addEventListener("scroll", () => {
    if (!isMobile() || dock.classList.contains("is-collapsed")) return;
    const nextY = window.scrollY || 0;
    if (Math.abs(nextY - lastScrollY) > 18) {
      expanded = false;
      apply();
    }
    lastScrollY = nextY;
  }, { passive: true });

  ["btn_start", "btn_stop"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", () => {
      if (!isMobile()) return;
      expanded = false;
      apply();
    });
  });

  apply();
}

function attachUI() {
  const ids = [
    "fader_energy",
    "fader_wave",
    "fader_mind",
    "fader_creation",
    "fader_void",
    "fader_circle",
    "fader_body",
    "fader_resource",
    "fader_observer"
  ];

  const onSlide = throttle(updateFromUI, 30); // 30msごとに制限

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", onSlide);
  });

  document.querySelectorAll("[data-performance-pad]").forEach((pad) => {
    const name = pad.dataset.performancePad;
    const activate = (event) => {
      event.preventDefault();
      setPerformancePad(name, true);
      pad.classList.add("active");
      if (typeof pad.setPointerCapture === "function" && event.pointerId != null) {
        try { pad.setPointerCapture(event.pointerId); } catch(e) {}
      }
    };
    const release = (event) => {
      if (event) event.preventDefault();
      setPerformancePad(name, false);
      pad.classList.remove("active");
    };
    pad.addEventListener("pointerdown", activate);
    pad.addEventListener("pointerup", release);
    pad.addEventListener("pointercancel", release);
    pad.addEventListener("blur", release);
  });

  const btnStart   = document.getElementById("btn_start");
  const btnStop    = document.getElementById("btn_stop");
  const autoToggle = document.getElementById("auto_toggle");
  const autoCycle  = document.getElementById("auto_cycle");
  const autoArcMode = document.getElementById("auto_arc_mode");
  const cultureGrammarSelect = document.getElementById("culture_grammar_select");
  const oddLogicMode = document.getElementById("odd_logic_mode");
  const btnOddLogicAsk = document.getElementById("btn_odd_logic_ask");
  const outputLevel = document.getElementById("output_level");
  const atmosphereSelect = document.getElementById("atmosphere_select");
  const sourceColorSelect = document.getElementById("source_color_select");
  const audioOutputSelect = document.getElementById("audio_output_select");
  const btnAudioOutput = document.getElementById("btn_audio_output");
  const btnKeepAwake = document.getElementById("btn_keep_awake");
  const btnAcidLock = document.getElementById("btn_acid_lock");
  const statusText = document.getElementById("status-text");
  const modeLabel  = document.getElementById("mode-label");
  const btnRec = document.getElementById("btn_rec");
  const btnMicFollow = document.getElementById("btn_mic_follow");
  const btnPacketJson = document.getElementById("btn_packet_json");

  setupTransportDockEscape();

  if (btnStart) {
    btnStart.onclick = () => {
      startPlayback({ source: HazamaBridgeState.loaded ? "start.hazama" : "start" });
    };
  }

  if (btnStop) {
    btnStop.onclick = () => {
      if (HazamaBridgeState.loaded) {
        HazamaBridgeState.autoFollow = false;
        HazamaBridgeState.pending = true;
      }
      stopPlayback({ source: "manual.stop" });
    };
  }

  if (autoToggle) {
    autoToggle.onchange = (e) => {
      if (e.target.checked) startAutoCycle();
      else stopAutoCycle();
    };
  }

  if (autoCycle) {
    autoCycle.addEventListener("change", () => {
      if (autoToggle && autoToggle.checked) startAutoCycle();
    });
  }

  if (autoArcMode) {
    autoArcMode.addEventListener("change", () => {
      updateAlbumArcModeFromUI({ reset: true });
      if (autoToggle && autoToggle.checked) startAutoCycle();
    });
    updateAlbumArcModeFromUI({ reset: false });
  }

  if (cultureGrammarSelect) {
    cultureGrammarSelect.addEventListener("change", () => updateCultureGrammarFromUI({ force: true }));
    updateCultureGrammarFromUI({ apply: false, nudge: false });
  }

  if (oddLogicMode) {
    oddLogicMode.addEventListener("change", () => updateOddLogicFromUI({ apply: true }));
    updateOddLogicFromUI({ apply: false, propose: false });
  }

  if (btnOddLogicAsk) {
    btnOddLogicAsk.addEventListener("click", () => {
      if (OddLogicDirectorState.mode === "off") {
        OddLogicDirectorState.mode = "auto";
        if (oddLogicMode) oddLogicMode.value = "auto";
      }
      requestOddLogicProposal({ source: "ask", cue: true, force: true });
    });
  }

  if (outputLevel) {
    outputLevel.addEventListener("input", () => updateOutputLevel());
    updateOutputLevel({ apply: false });
  }

  if (atmosphereSelect) {
    atmosphereSelect.addEventListener("change", () => updateVoiceColorFromUI({ force: true }));
  }

  if (sourceColorSelect) {
    sourceColorSelect.addEventListener("change", () => updateVoiceColorFromUI({ force: true }));
  }

  updateVoiceColorFromUI({ apply: false });

  if (audioOutputSelect) {
    audioOutputSelect.addEventListener("change", () => {
      const option = audioOutputSelect.selectedOptions && audioOutputSelect.selectedOptions[0];
      applyAudioOutputDevice(audioOutputSelect.value, option ? option.textContent : "");
    });
    refreshAudioOutputDevices();
  }

  if (btnAudioOutput) {
    btnAudioOutput.addEventListener("click", chooseAudioOutputDevice);
  }

  if (btnKeepAwake) {
    btnKeepAwake.addEventListener("click", () => {
      setKeepAwakeEnabled(!PlaybackState.wakeLockEnabled);
    });
    setKeepAwakeEnabled(false);
  }

  if (btnAcidLock) {
    btnAcidLock.addEventListener("click", () => {
      setAcidLockEnabled(!AcidLockState.enabled);
    });
    setAcidLockEnabled(false);
  }

  if (btnRec) {
    btnRec.addEventListener("click", toggleLocalRecorder);
  }

  if (btnMicFollow) {
    btnMicFollow.textContent = "MIC";
    btnMicFollow.title = "マイク入力を録音せずローカルfeaturesだけ解析";
    btnMicFollow.addEventListener("click", toggleMicFollow);
    updateMicFollowButton();
  }

  // fm-70: visible FM-side mic-follow controls. Mirror band-room v137 UX:
  // one button to enable, one to disable, and a sensitivity slider that
  // fmMicFollowVelocityScale() reads on every step. The bar + label use the
  // mic_follow_panel / mic_follow_label / mic_follow_bar ids that
  // updateMicFollowReadout() already writes to — no extra plumbing needed.
  const fmMicEnableBtn = document.getElementById("fm-mic-follow-enable");
  const fmMicDisableBtn = document.getElementById("fm-mic-follow-disable");
  const fmMicAmountEl = document.getElementById("fm-mic-follow-amount");
  const fmMicAmountReadout = document.getElementById("fm-mic-follow-amount-readout");
  const syncFmMicButtons = () => {
    const active = !!MicFollowState.enabled;
    const pending = !!MicFollowState.pending;
    if (fmMicEnableBtn) fmMicEnableBtn.disabled = active || pending;
    if (fmMicDisableBtn) fmMicDisableBtn.disabled = !active;
  };
  if (fmMicEnableBtn) {
    fmMicEnableBtn.addEventListener("click", async () => {
      await startMicFollow();
      syncFmMicButtons();
    });
  }
  if (fmMicDisableBtn) {
    fmMicDisableBtn.addEventListener("click", () => {
      stopMicFollow();
      syncFmMicButtons();
    });
  }
  if (fmMicAmountEl) {
    const refreshAmount = () => {
      if (fmMicAmountReadout) fmMicAmountReadout.textContent = `${fmMicAmountEl.value}%`;
    };
    fmMicAmountEl.addEventListener("input", refreshAmount);
    refreshAmount();
  }
  // Keep button states in sync when toggleMicFollow is used from elsewhere.
  if (typeof window !== "undefined") {
    window.addEventListener("music-runtime-state", syncFmMicButtons);
    setInterval(syncFmMicButtons, 800);
  }
  syncFmMicButtons();

  if (btnPacketJson) {
    btnPacketJson.textContent = "SYNC";
    btnPacketJson.title = "Musicの現在状態を共有し、次に開く場所を表示します";
    btnPacketJson.addEventListener("click", syncMusicSessionPacket);
  }

  // Preset UI
  const presetSelect = document.getElementById("preset_select");
  const btnReloadPresets = document.getElementById("btn_reload_presets");

  if (presetSelect){
    presetSelect.addEventListener("change", () => {
      PresetManager.selected = presetSelect.value || "__auto__";

      // If manual, also apply UCM targets from preset (so faders + mood change immediately)
      if (PresetManager.selected !== "__auto__"){
        const p = PresetManager.presets[PresetManager.selected];
        if (p) applyPresetUCM(p);
      }

      updateFromUI({ force: true });
    });
  }
  if (btnReloadPresets){
    btnReloadPresets.addEventListener("click", async () => {
      await loadPresets();
      updateFromUI({ force: true });
    });
  }

  // fm-71: catalog picker (Music Core Rig only — element absent on fm.html)
  setupCatalogPicker();
}

// fm-71: populate <select id="catalog-select"> with entries from
// presets/online-samples-catalog.json and wire change → CatalogOverride.
// Idempotent: safe to call before/after the catalog fetch resolves; re-runs
// itself once the fetch completes. Gracefully no-ops when the element is
// absent (e.g. fm.html, band-room.html).
function setupCatalogPicker() {
  const sel = document.getElementById("catalog-select");
  if (!sel) return;
  const info = document.getElementById("catalog-info");
  const detail = document.getElementById("catalog-detail-body");

  const renderInfo = () => {
    if (CatalogOverride.kind === "kit" && CatalogOverride.id) {
      const k = hazamaFmCatalog?.kits?.find((x) => x.id === CatalogOverride.id);
      if (info) info.textContent = k ? `${k.label} · ${k.license}` : "—";
      if (detail) detail.innerHTML = k
        ? `<div><strong>${k.label}</strong></div>`
          + `<div>kind: drum kit</div>`
          + `<div>source: ${k.source || "?"}</div>`
          + `<div>license: ${k.license || "?"}</div>`
          + `<div>base_url: <code>${k.base_url || "?"}</code></div>`
        : "—";
      return;
    }
    if (CatalogOverride.kind === "instrument" && CatalogOverride.id) {
      const i = hazamaFmCatalog?.instruments?.find((x) => x.id === CatalogOverride.id);
      if (info) info.textContent = i ? `${i.label} · ${i.license}` : "—";
      if (detail) detail.innerHTML = i
        ? `<div><strong>${i.label}</strong></div>`
          + `<div>kind: ${i.kind || "instrument"}</div>`
          + `<div>source: ${i.source || "?"}</div>`
          + `<div>license: ${i.license || "?"}</div>`
          + `<div>base_url: <code>${i.base_url || "?"}</code></div>`
        : "—";
      return;
    }
    if (info) info.textContent = "AUTO — band/mode default";
    if (detail) detail.textContent = "AUTO 時は band/mode のデフォルト割り当てを使用します。";
  };

  const populate = () => {
    if (!hazamaFmCatalog) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="auto">AUTO (band default)</option>';
    const kits = hazamaFmCatalog.kits || [];
    const instruments = hazamaFmCatalog.instruments || [];
    if (kits.length) {
      const og = document.createElement("optgroup");
      og.label = "Drum kits";
      kits.forEach((k) => {
        const opt = document.createElement("option");
        opt.value = `kit:${k.id}`;
        opt.textContent = k.label || k.id;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    }
    if (instruments.length) {
      const og = document.createElement("optgroup");
      og.label = "Instruments";
      instruments.forEach((i) => {
        const opt = document.createElement("option");
        opt.value = `inst:${i.id}`;
        opt.textContent = i.label || i.id;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    }
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    renderInfo();
  };

  sel.addEventListener("change", () => {
    const v = sel.value;
    if (!v || v === "auto") {
      CatalogOverride.kind = null;
      CatalogOverride.id = null;
    } else if (v.startsWith("kit:")) {
      CatalogOverride.kind = "kit";
      CatalogOverride.id = v.slice(4);
    } else if (v.startsWith("inst:")) {
      CatalogOverride.kind = "instrument";
      CatalogOverride.id = v.slice(5);
    }
    renderInfo();
  });

  if (hazamaFmCatalog) {
    populate();
  } else {
    // fetch is already in flight (loadHazamaFmCatalog ran at module load);
    // poll briefly and populate once available.
    loadHazamaFmCatalog().then(() => populate()).catch(() => {});
  }
}

/* =========================================================
   8. INIT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  mountMandalaLayers();
  attachUI();
  setupHazamaBridge();
  updateRuntimeUiState();
  setupMediaSessionControls();
  updateMediaSessionPlaybackState();
  PlaybackState.iosSafariBridgePreferred = shouldPreferBackgroundAudioBridge();
  if (PlaybackState.iosSafariBridgePreferred) {
    ensureBackgroundPlaybackElement();
    setBackgroundStatus("ios ready");
  }
  loadPresets().finally(()=>{ 
    // prime
    applyUCMToParams({ force: true });
    if (HazamaBridgeState.loaded) setHazamaStatus(HazamaBridgeState.pending ? "HAZAMA.PENDING" : "HAZAMA.SYNC");
  });

  // Smooth loop: UCM_TARGET -> UCM_CUR -> params (v1.3)
  // v1.4+: throttle applyUCMToParams() so we don't fire rampTo updates at 60Hz,
  // clamp dt so a backgrounded tab doesn't catch-up with a huge automation burst.
  const APPLY_UCM_INTERVAL_SEC = 0.18;
  const SMOOTH_DT_MAX_SEC = 0.1;
  let lastT = performance.now();
  let applyUcmAcc = 0;
  function smoothTick(t){
    let dt = (t - lastT) / 1000;
    lastT = t;
    dt = Math.max(0.001, Math.min(dt, SMOOTH_DT_MAX_SEC));
    const a = 1 - Math.exp(-dt / UCM_SMOOTH_SEC);

    applyMicFollowTargetBias(dt);

    // Smooth all UCM dimensions (keep 60Hz for visual smoothness)
    for(const k of UCM_KEYS){
      UCM_CUR[k] = UCM_CUR[k] + (UCM_TARGET[k] - UCM_CUR[k]) * a;
      // keep the legacy UCM mirror updated for UI text
      UCM[k] = Math.round(UCM_CUR[k]);
    }
    syncAutoSlidersFromCurrent(t);

    // Apply to audio/engine on a slow control tick (was every frame -> Tone scheduler overload)
    applyUcmAcc += dt;
    if (applyUcmAcc >= APPLY_UCM_INTERVAL_SEC){
      applyUcmAcc = 0;
      if (typeof Tone !== "undefined" && Tone && Tone.Transport){
        try{ applyUCMToParams(); }catch(e){ console.warn("[Music] applyUCMToParams failed:", e); }
      }
    }

    requestAnimationFrame(smoothTick);
  }
  requestAnimationFrame(smoothTick);

  // AudioContext watchdog: browsers (especially Chrome/Safari on idle tabs or mobile)
  // can auto-suspend the AudioContext while Tone.Transport appears to keep running,
  // producing "suddenly no sound". Check every 2s and resume if needed.
  let lastWatchdogAudioState = "";
  let lastWatchdogTransportState = "";
  let lastWatchdogWarnAt = 0;
  setInterval(() => {
    try {
      if (isPlaying && typeof Tone !== "undefined" && Tone && Tone.context && Tone.context.state !== "running") {
        const now = Date.now();
        if (Tone.context.state !== lastWatchdogAudioState || now - lastWatchdogWarnAt > 15000) {
          console.warn("[Music] AudioContext not running:", Tone.context.state, "-> resume");
          lastWatchdogWarnAt = now;
          lastWatchdogAudioState = Tone.context.state;
        }
        resumeAudioContext("watchdog");
      } else {
        lastWatchdogAudioState = "";
      }
      if (isPlaying && Tone && Tone.Transport && Tone.Transport.state !== "started") {
        const now = Date.now();
        if (Tone.Transport.state !== lastWatchdogTransportState || now - lastWatchdogWarnAt > 15000) {
          console.warn("[Music] Transport not started:", Tone.Transport.state, "-> start");
          lastWatchdogWarnAt = now;
          lastWatchdogTransportState = Tone.Transport.state;
        }
        ensureTransportScheduled();
        Tone.Transport.start("+0.03");
      } else {
        lastWatchdogTransportState = "";
      }
      checkBackgroundBridgeHealth("watchdog");
    } catch(e){ /* swallow */ }
  }, 2000);

  console.log("UCM Mandala Engine v3.1 (v1.4 throttle+watchdog) ready");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (isPlaying) {
      resumeAudioContext("visible");
      try {
        if (Tone && Tone.Transport && Tone.Transport.state !== "started") {
          ensureTransportScheduled();
          Tone.Transport.start("+0.03");
        }
      } catch(e) {}
      if (PlaybackState.iosSafariBridgePreferred && !PlaybackState.backgroundBridgeActive) {
        startBackgroundAudioBridge({ rearm: true, reason: "visible" });
      } else {
        checkBackgroundBridgeHealth("visible");
      }
      requestPlaybackWakeLock();
      if (HazamaBridgeState.loaded) requestHazamaRuntimeFeedback("focus");
    }
    refreshAudioOutputDevices();
  } else if (PlaybackState.wakeLockEnabled && isPlaying) {
    setBackgroundStatus("hidden");
  }
  updateMediaSessionPlaybackState();
});

window.addEventListener("pagehide", () => {
  if (MicFollowState.enabled || MicFollowState.pending) stopMicFollow({ silent: true, releaseBias: true });
});

if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    refreshAudioOutputDevices();
  });
}

/* =========================================================
   9. Mandala Layers Loader (assets/layer_01.svg ...)
========================================================= */

function mountMandalaLayers(){
  const host = document.getElementById("mandala-layers");
  if (!host) return;

  if (host.dataset.mounted === "1") return;
  host.dataset.mounted = "1";

  const layers = ["layer_01","layer_02","layer_03","layer_04","layer_05","layer_06"];
  layers.forEach((name, i)=>{
    const img = document.createElement("img");
    img.src = `assets/${name}.svg`;
    img.alt = name;
    img.style.opacity = (0.12 + i*0.03).toString();
    img.style.animationDuration = `${70 + i*18}s`;
    host.appendChild(img);
  });
}
