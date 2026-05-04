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
  intensity: 0
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
  level: 75
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
  return clampValue(Math.max(AcidLockState.intensity || 0, albumArcAcidDrive()), 0, 1);
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

function tonalRhymeIndex(step = stepIndex, offset = 0) {
  const phaseOffset = Math.floor((GenomeState.phase || 0) * 8);
  const refrainOffset = Math.floor((MotifMemoryState.strength || 0) * 5);
  const voiceOffset = Math.floor((VoiceEmergenceState?.refrain || 0) * 4);
  const index = GrooveState.cycle + step + phaseOffset + refrainOffset + voiceOffset + TonalRhymeState.stepOffset + offset;
  return ((index % 8) + 8) % 8;
}

function tonalRhymeNote(pool, step = stepIndex, offset = 0) {
  return pool[tonalRhymeIndex(step, offset) % pool.length];
}

function tonalRhymeSub(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_SUB, step, TonalRhymeState.lowOffset + offset);
}

function tonalRhymeLow(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_LOW, step, TonalRhymeState.lowOffset + offset);
}

function tonalRhymeMid(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_MID, step, offset);
}

function tonalRhymeHigh(step = stepIndex, offset = 0) {
  return tonalRhymeNote(TONAL_RHYME_HIGH, step, offset);
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
      genre.techno * 0.06,
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
      eventLoad * 0.04,
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
      eventLoad * 0.03,
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
      lowGuard * 0.14,
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
      lowGuard * 0.05,
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
  const target = resolvePerformanceTempoTarget(rawBpm + longformTempoBias() + albumArcTempoBias() + genreBias + cultureTempoBias + oddLogicTempoBias() + pressureLift + contour);
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
  const density = clampValue(
    eventLoad * 0.38 +
      (human.density || 0) * 0.18 +
      (human.grain || 0) * 0.08 +
      (human.collapse || 0) * 0.13 +
      signatureDebt * 0.17 -
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
      acidPerformanceAmount() * 0.08 -
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
      acidPerformanceAmount() * 0.08 -
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
      performance: acidPerformanceAmount(),
      arcDrive: albumArcAcidDrive(),
      color: { ...PerformanceColorDriftState }
    },
    gradient: { ...GradientState },
    depth: { ...DepthState },
    genre: { ...GenreBlendState },
    genreTimbreKits: genreTimbreKitRuntimeState(),
    referenceMorph: referenceMorphRuntimeState(),
    rdjGrowth: rdjGrowthRuntimeState(),
    producerHabits: producerHabitsRuntimeState(),
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

function packetNumber(value, min = 0, max = 1, digits = 3) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : min;
  const factor = 10 ** digits;
  return Math.round(clampValue(safe, min, max) * factor) / factor;
}

function packetPercent(value) {
  return packetNumber(value, 0, 100, 1);
}

function packetUnit(value) {
  return packetNumber(value, 0, 1, 3);
}

function dedupePacketLabels(labels) {
  return Array.from(new Set(labels.filter(Boolean)));
}

function activePerformancePadNames() {
  return ["drift", "repeat", "punch", "void"].filter((name) => PerformancePadState[name] > 0);
}

function isManualPerformanceInfluenceActive() {
  const now = performanceNowMs();
  const sliderActive = Object.keys(manualInfluenceUntil).some((key) => isManualInfluenceActive(key, now));
  const padActive = now - (PerformancePadState.lastTouchAt || 0) < MANUAL_INFLUENCE_HOLD_MS;
  return sliderActive || padActive;
}

function recorderDurationSeconds() {
  if (RecorderState.recorder && RecorderState.recorder.state === "recording" && RecorderState.startedAt) {
    return packetNumber((Date.now() - RecorderState.startedAt) / 1000, 0, 36000, 1);
  }
  return 0;
}

function dominantPacketKey(map, fallback = "ambient") {
  const entries = Object.entries(map || {});
  if (!entries.length) return fallback;
  return entries.reduce((best, item) => (Number(item[1]) || 0) > (Number(best[1]) || 0) ? item : best, entries[0])[0] || fallback;
}

function packetSectionName(activePads) {
  if (activePads.includes("void")) return "void";
  if (activePads.includes("punch")) return "punch";
  if (activePads.includes("repeat")) return "repeat";
  if (activePads.includes("drift")) return "drift";
  if (albumArcActive()) return String(currentAlbumArcChapter()?.name || "album_arc").toLowerCase();
  return UCM.auto.enabled ? "self_running" : "manual";
}

function packetModeName() {
  if (UCM.auto.enabled) return "self_running";
  const morph = dominantReferenceMorphStyle();
  if (morph && morph !== "haze") return "reference_gradient";
  return EngineParams.mode || "ambient";
}

function packetIntentArrays(activePads, gradient, kits, parts) {
  const dominantKit = dominantPacketKey(kits, "ambientKit");
  const timbre = ["metadata-only"];
  if (gradient.haze > 0.36 || kits.ambientKit > 0.44) timbre.push("haze-bed");
  if (gradient.memory > 0.34) timbre.push("memory-point");
  if (gradient.micro > 0.34 || kits.idmKit > 0.36) timbre.push("micro-particle");
  if (gradient.ghost > 0.34 || kits.pressureKit > 0.34) timbre.push("ghost-pressure");
  if (gradient.chrome > 0.36 || kits.spaceKit > 0.42) timbre.push("chrome-air");
  if (gradient.organic > 0.34) timbre.push("organic-dust");

  const rhythm = [];
  if (kits.ambientKit > 0.48 || parts.energy < 0.3) rhythm.push("low-activity");
  if (kits.idmKit > 0.34) rhythm.push("broken-repeat");
  if (kits.technoKit > 0.34) rhythm.push("dry-grid");
  if (kits.pressureKit > 0.34 || activePads.includes("punch")) rhythm.push("body-snap");
  if (activePads.includes("repeat")) rhythm.push("manual-repeat");
  if (!rhythm.length) rhythm.push("soft-pulse");

  const space = [];
  if (kits.spaceKit > 0.38 || activePads.includes("void")) space.push("transparent-tail");
  if (gradient.haze > 0.4) space.push("wide-haze");
  if (gradient.chrome > 0.38) space.push("clear-air");
  if (parts.voidness > 0.52) space.push("void-room");
  if (!space.length) space.push("room-safe");

  const structure = [packetSectionName(activePads)];
  if (UCM.auto.enabled) structure.push("automix");
  if (albumArcActive()) structure.push("album-arc");
  if (HazamaBridgeState.loaded) structure.push("hazama-follow");

  const gesture = activePads.length ? activePads.map((name) => `pad-${name}`) : ["listen"];
  if (dominantKit) gesture.push(`kit-${dominantKit.replace(/Kit$/, "")}`);

  return {
    timbre: dedupePacketLabels(timbre),
    rhythm: dedupePacketLabels(rhythm),
    space: dedupePacketLabels(space),
    structure: dedupePacketLabels(structure),
    gesture: dedupePacketLabels(gesture),
    safety: ["metadata-only", "human-review-required", "no-audio", "no-samples", "no-lyrics"]
  };
}

function makeMusicSessionId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
  const random = Math.random().toString(36).slice(2, 7);
  return `music-${stamp}-${random}`;
}

function makeMusicSessionPacketFileName(sessionId) {
  return `${sessionId || makeMusicSessionId()}.json`;
}

function buildMusicSessionPacket(options = {}) {
  const createdAt = options.createdAt instanceof Date ? options.createdAt : new Date();
  const parts = currentGradientParts();
  const gradient = {
    haze: packetUnit(GradientState.haze),
    memory: packetUnit(GradientState.memory),
    micro: packetUnit(GradientState.micro),
    ghost: packetUnit(GradientState.ghost),
    chrome: packetUnit(GradientState.chrome),
    organic: packetUnit(GradientState.organic)
  };
  const kits = genreTimbreKitRuntimeState();
  const activePads = activePerformancePadNames();
  const activePad = activePads[0] || null;
  const density = packetUnit(parts.energy * 0.3 + parts.resource * 0.28 + parts.creation * 0.18 + gradient.micro * 0.14 + kits.technoKit * 0.1);
  const pressure = packetUnit(parts.body * 0.26 + parts.energy * 0.24 + parts.resource * 0.16 + gradient.ghost * 0.16 + kits.pressureKit * 0.16 - parts.voidness * 0.12);
  const section = packetSectionName(activePads);
  const namimaCalm = packetUnit(parts.circle * 0.3 + parts.observer * 0.28 + parts.voidness * 0.18 + gradient.haze * 0.14 + kits.spaceKit * 0.1);

  return {
    version: 1,
    source_repo: "Music",
    created_at: createdAt.toISOString(),
    session_id: options.sessionId || makeMusicSessionId(createdAt),
    mode: packetModeName(),
    reference_gradient: {
      weights: gradient
    },
    ucm_state: {
      energy: packetPercent(UCM_CUR.energy),
      wave: packetPercent(UCM_CUR.wave),
      mind: packetPercent(UCM_CUR.mind),
      creation: packetPercent(UCM_CUR.creation),
      void: packetPercent(UCM_CUR.void),
      circle: packetPercent(UCM_CUR.circle),
      body: packetPercent(UCM_CUR.body),
      resource: packetPercent(UCM_CUR.resource),
      observer: packetPercent(UCM_CUR.observer)
    },
    output_state: {
      output_level: packetPercent(OutputState.level),
      recorder_duration: recorderDurationSeconds(),
      review_boost: packetUnit((MixGovernorState.eventLoad || 0) * 0.65 + (ProducerHabitState.curiosity || 0) * 0.35)
    },
    performance_state: {
      active_pad: activePad,
      recent_pads: activePads,
      manual_influence_active: isManualPerformanceInfluenceActive(),
      automix_enabled: !!UCM.auto.enabled
    },
    music_intent: packetIntentArrays(activePads, gradient, kits, parts),
    routing: {
      drum_floor: {
        enabled: density > 0.18 && !activePads.includes("void"),
        groove_intent: {
          style: kits.technoKit > 0.42 ? "dry_grid" : kits.idmKit > 0.34 ? "broken_organic" : kits.pressureKit > 0.34 ? "ghost_pressure" : "soft_pocket",
          ghost_notes: gradient.ghost,
          micro: gradient.micro,
          articulation: activePads.includes("punch") ? "body_snap" : activePads.includes("repeat") ? "dry_repeat" : "human_pocket",
          review_only: true
        },
        density,
        pressure,
        section,
        review_only: true
      },
      namima: {
        enabled: namimaCalm > 0.16,
        mood_intent: {
          mood: parts.voidness > 0.54 ? "transparent_void" : gradient.haze > 0.42 ? "garden_haze" : "calm_water",
          safe_energy_cap: packetUnit(0.38 + (1 - parts.energy) * 0.24 + parts.observer * 0.14),
          air: packetUnit(gradient.chrome * 0.36 + kits.spaceKit * 0.36 + parts.observer * 0.28),
          review_only: true
        },
        family_safe: true,
        water_motion: packetUnit(parts.wave * 0.36 + parts.circle * 0.24 + gradient.organic * 0.2 + namimaCalm * 0.2),
        brightness: packetUnit(0.24 + gradient.chrome * 0.28 + parts.observer * 0.2 + (1 - pressure) * 0.14),
        review_only: true
      },
      openclaw: {
        enabled: true,
        promotion_status: "draft",
        human_review_required: true,
        review_only: true
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

function downloadMusicSessionPacket() {
  const packet = buildMusicSessionPacket();
  if (typeof window !== "undefined") {
    window.MusicSessionPacket.last = packet;
  }
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return packet;

  const json = `${JSON.stringify(packet, null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = makeMusicSessionPacketFileName(packet.session_id);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch (error) {}
  }, 60000);
  setRecorderStatus("Packet JSON downloaded");
  return packet;
}

if (typeof window !== "undefined") {
  window.MusicSessionPacket = {
    build: buildMusicSessionPacket,
    download: downloadMusicSessionPacket,
    last: null
  };
}

function feedbackNumber(value, digits = 3) {
  const safe = Number.isFinite(value) ? value : 0;
  const factor = 10 ** digits;
  return Math.round(safe * factor) / factor;
}

function hazamaRuntimeFeedbackEnabled() {
  return !!(HazamaBridgeState.loaded || HazamaBridgeState.active);
}

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

function sourceFamilyFeedback() {
  const family = typeof TimbreFamilyState !== "undefined" ? TimbreFamilyState : {};
  const inner = family.inner || {};
  const profile = inner.profile || "";
  const oneHot = (name, fallback) => feedbackNumber(profile === name ? Math.max(0.62, fallback) : fallback);

  return {
    hazeBed: oneHot("hazeBed", clampValue((family.voiceDust || 0) * 0.44 + (GradientState.haze || 0) * 0.42 + (DepthState.bed || 0) * 0.14, 0, 1)),
    chromeHymn: oneHot("chromeHymn", clampValue((family.voiceDust || 0) * 0.35 + (GradientState.chrome || 0) * 0.48 + (DepthState.tail || 0) * 0.17, 0, 1)),
    memoryRefrain: oneHot("memoryRefrain", clampValue((family.pianoMemory || 0) * 0.52 + (GradientState.memory || 0) * 0.34 + (MotifMemoryState.strength || 0) * 0.14, 0, 1)),
    coldPulse: oneHot("coldPulse", clampValue((family.chain || 0) * 0.42 + GenreBlendState.techno * 0.26 + GenreBlendState.idm * 0.16 + acidPerformanceAmount() * 0.16, 0, 1)),
    ghostBody: oneHot("ghostBody", clampValue((family.drumSkin || 0) * 0.28 + (family.sub808 || 0) * 0.28 + (GradientState.ghost || 0) * 0.32 + GenreBlendState.pressure * 0.12, 0, 1)),
    acidBiyon: feedbackNumber(clampValue(family.acidBiyon || 0, 0, 1)),
    sub808: feedbackNumber(clampValue(family.sub808 || 0, 0, 1)),
    reedBuzz: feedbackNumber(clampValue(family.reedBuzz || 0, 0, 1))
  };
}

function buildHazamaRuntimeFeedbackPayload(kind = "heartbeat", state = window.MusicRuntimeState || null) {
  const family = sourceFamilyFeedback();
  return {
    type: "music-runtime-feedback",
    version: 1,
    provider: "music",
    target: "hazama",
    runtime: {
      playing: !!isPlaying,
      auto: !!(UCM.auto.enabled || hazamaAutoFollowActive()),
      autoFollow: hazamaAutoFollowActive(),
      bpm: Math.round(EngineParams.bpm || 0),
      mode: EngineParams.mode,
      outputLevel: Math.round(OutputState.level || 0),
      culture: {
        selected: CultureGrammarState.selected || "auto",
        active: CultureGrammarState.active || "ambient_room",
        label: CultureGrammarState.label || "AUTO",
        strength: feedbackNumber(CultureGrammarState.strength || 0)
      },
      proposal: {
        mode: OddLogicDirectorState.mode || "auto",
        active: !!OddLogicDirectorState.active,
        label: OddLogicDirectorState.label || "",
        want: OddLogicDirectorState.want || "",
        move: OddLogicDirectorState.move || "",
        intensity: feedbackNumber(OddLogicDirectorState.intensity || 0)
      },
      albumArc: {
        active: !!albumArcActive(),
        chapter: currentAlbumArcChapter()?.name || "",
        label: currentAlbumArcChapter()?.label || "",
        progress: feedbackNumber(AlbumArcState.progress || 0)
      },
      acid: {
        enabled: !!AcidLockState.enabled,
        performance: feedbackNumber(acidPerformanceAmount()),
        arcDrive: feedbackNumber(albumArcAcidDrive())
      },
      hazama: {
        active: !!HazamaBridgeState.active,
        autoFollow: hazamaAutoFollowActive(),
        connectionState: hazamaConnectionState(),
        controlAction: HazamaBridgeState.controlAction || "",
        name: HazamaBridgeState.name || "",
        stage: HazamaBridgeState.stage || "",
        depthId: HazamaBridgeState.depthId || ""
      },
      color: {
        genre: {
          ambient: feedbackNumber(GenreBlendState.ambient),
          idm: feedbackNumber(GenreBlendState.idm),
          techno: feedbackNumber(GenreBlendState.techno),
          pressure: feedbackNumber(GenreBlendState.pressure)
        },
        gradient: {
          haze: feedbackNumber(GradientState.haze),
          memory: feedbackNumber(GradientState.memory),
          micro: feedbackNumber(GradientState.micro),
          ghost: feedbackNumber(GradientState.ghost),
          chrome: feedbackNumber(GradientState.chrome),
          organic: feedbackNumber(GradientState.organic)
        },
        families: family
      },
      event: {
        kind,
        at: Date.now()
      }
    },
    capabilities: {
      feedbackVersion: 1,
      albumArc: true,
      acidDrive: true,
      sourceFamilies: true,
      cultureGrammar: true,
      oddLogicProposal: true,
      hazamaControl: true
    }
  };
}

function postHazamaRuntimeFeedback(payload) {
  if (typeof window === "undefined" || !payload) return false;
  const targets = [];
  if (window.opener && !window.opener.closed) targets.push(window.opener);
  if (window.parent && window.parent !== window) targets.push(window.parent);
  if (!targets.length) return false;

  let sent = false;
  for (const target of targets) {
    for (const origin of HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS) {
      try {
        target.postMessage(payload, origin);
        sent = true;
      } catch (error) {}
    }
  }
  return sent;
}

function hazamaRuntimeFeedbackSignature() {
  const family = typeof TimbreFamilyState !== "undefined" ? TimbreFamilyState : {};
  const inner = family.inner || {};
  return [
    isPlaying ? "1" : "0",
    UCM.auto.enabled ? "auto" : (hazamaAutoFollowActive() ? "hazama" : "manual"),
    Math.round((EngineParams.bpm || 0) / 2) * 2,
    albumArcActive() ? currentAlbumArcChapter()?.label || "" : "live",
    CultureGrammarState.selected || "auto",
    CultureGrammarState.active || "",
    OddLogicDirectorState.mode || "auto",
    OddLogicDirectorState.move || "",
    Math.round((OddLogicDirectorState.intensity || 0) * 10),
    Math.round(acidPerformanceAmount() * 10),
    inner.profile || "",
    dominantInnerSourceFamily(inner)
  ].join("|");
}

function sendHazamaRuntimeFeedback(kind = "heartbeat", options = {}) {
  if (!hazamaRuntimeFeedbackEnabled()) return false;
  const now = Date.now();
  if (!options.force && now - HazamaRuntimeFeedbackState.lastSentAt < 1100) return false;

  const payload = buildHazamaRuntimeFeedbackPayload(kind, options.state);
  HazamaRuntimeFeedbackState.sequence += 1;
  payload.runtime.sequence = HazamaRuntimeFeedbackState.sequence;
  const sent = postHazamaRuntimeFeedback(payload);
  HazamaRuntimeFeedbackState.lastSentAt = now;
  if (kind === "heartbeat") HazamaRuntimeFeedbackState.lastHeartbeatAt = now;
  HazamaRuntimeFeedbackState.lastSignature = hazamaRuntimeFeedbackSignature();
  return sent;
}

function maybeSendHazamaRuntimeFeedback(state) {
  if (!hazamaRuntimeFeedbackEnabled()) return;
  const now = Date.now();
  const signature = hazamaRuntimeFeedbackSignature();
  if (now - HazamaRuntimeFeedbackState.lastHeartbeatAt >= 8000) {
    sendHazamaRuntimeFeedback("heartbeat", { state, force: true });
  } else if (signature !== HazamaRuntimeFeedbackState.lastSignature && now - HazamaRuntimeFeedbackState.lastSentAt >= 1400) {
    sendHazamaRuntimeFeedback("change", { state, force: true });
  }
}

function requestHazamaRuntimeFeedback(kind = "change") {
  sendHazamaRuntimeFeedback(kind, { force: true });
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

const RecorderState = {
  recorder: null,
  chunks: [],
  startedAt: 0,
  objectUrl: null,
  mimeType: "",
  maxMs: 30000,
  stopTimer: null
};

function getRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const ua = nav.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const mp4First = [
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/webm;codecs=opus",
    "audio/webm"
  ];
  const webmFirst = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2"
  ];
  const candidates = isAppleMobile ? mp4First : webmFirst;
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function getRecorderExtension(mimeType) {
  return mimeType.includes("mp4") ? "m4a" : "webm";
}

function getRecorderSavedMessage(mimeType, sizeKb) {
  if (mimeType.includes("mp4")) {
    return `Recorded ${sizeKb} KB as m4a-compatible audio`;
  }
  if (mimeType.includes("webm")) {
    return `WebM saved ${sizeKb} KB. iPhone app may reject; use PC/convert to m4a.`;
  }
  return `Recorded ${sizeKb} KB`;
}

function getRecorderFallbackMessage() {
  return "Recorder unavailable on this browser";
}

function getRecorderStartMessage(mimeType) {
  if (mimeType.includes("mp4")) return "Recording Music output as m4a-compatible audio...";
  if (mimeType.includes("webm")) return "Recording WebM audio; iPhone upload may need conversion...";
  return "Recording Music output...";
}

function getRecorderDefaultMimeType() {
  if (RecorderState.mimeType) return RecorderState.mimeType;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) || "audio/webm";
}

function setRecorderStatus(message) {
  const statusText = document.getElementById("status-text");
  if (statusText) statusText.textContent = message;
}

function setRecorderButton(recording) {
  const btn = document.getElementById("btn_rec");
  if (btn) btn.textContent = recording ? "STOP REC" : "REC";
  if (document.body) document.body.dataset.recording = recording ? "true" : "false";
}

function cleanupRecorderObjectUrl() {
  if (!RecorderState.objectUrl) return;
  try { URL.revokeObjectURL(RecorderState.objectUrl); } catch(e) {}
  RecorderState.objectUrl = null;
}

function makeReviewFileName(extension = "webm") {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `music-review-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
}

function startLocalRecorder() {
  const link = document.getElementById("rec_download");
  if (link) link.hidden = true;

  if (typeof MediaRecorder === "undefined" || !recorderDestination?.stream) {
    setRecorderStatus(getRecorderFallbackMessage());
    return;
  }
  if (RecorderState.recorder && RecorderState.recorder.state === "recording") return;

  cleanupRecorderObjectUrl();
  RecorderState.chunks = [];
  RecorderState.mimeType = getRecorderMimeType();

  try {
    RecorderState.recorder = RecorderState.mimeType
      ? new MediaRecorder(recorderDestination.stream, { mimeType: RecorderState.mimeType })
      : new MediaRecorder(recorderDestination.stream);
  } catch (error) {
    console.warn("[Music] recorder start failed:", error);
    setRecorderStatus(getRecorderFallbackMessage());
    RecorderState.recorder = null;
    return;
  }

  RecorderState.recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) RecorderState.chunks.push(event.data);
  };
  RecorderState.recorder.onerror = (event) => {
    console.warn("[Music] recorder error:", event.error || event);
    stopLocalRecorder();
    setRecorderStatus("Recorder stopped");
  };
  RecorderState.recorder.onstop = () => {
    const mimeType = getRecorderDefaultMimeType();
    const blob = new Blob(RecorderState.chunks, { type: mimeType });
    const extension = getRecorderExtension(mimeType);
    RecorderState.chunks = [];
    RecorderState.recorder = null;
    setRecorderButton(false);
    if (!blob.size) {
      setRecorderStatus("No recording captured");
      return;
    }
    RecorderState.objectUrl = URL.createObjectURL(blob);
    const download = document.getElementById("rec_download");
    if (download) {
      download.href = RecorderState.objectUrl;
      download.download = makeReviewFileName(extension);
      download.textContent = "save";
      download.hidden = false;
    }
    setRecorderStatus(getRecorderSavedMessage(mimeType, Math.round(blob.size / 1024)));
  };

  try {
    RecorderState.recorder.start(1000);
    RecorderState.startedAt = Date.now();
    setRecorderButton(true);
    setRecorderStatus(getRecorderStartMessage(RecorderState.mimeType));
    clearTimeout(RecorderState.stopTimer);
    RecorderState.stopTimer = setTimeout(() => stopLocalRecorder(), RecorderState.maxMs);
  } catch (error) {
    console.warn("[Music] recorder start failed:", error);
    setRecorderButton(false);
    setRecorderStatus(getRecorderFallbackMessage());
  }
}

function stopLocalRecorder() {
  clearTimeout(RecorderState.stopTimer);
  RecorderState.stopTimer = null;
  const recorder = RecorderState.recorder;
  if (!recorder) {
    setRecorderButton(false);
    return;
  }
  try {
    if (recorder.state !== "inactive") recorder.stop();
  } catch (error) {
    console.warn("[Music] recorder stop failed:", error);
    RecorderState.recorder = null;
    setRecorderButton(false);
    setRecorderStatus("Recorder stopped");
  }
}

function toggleLocalRecorder() {
  if (RecorderState.recorder && RecorderState.recorder.state === "recording") {
    stopLocalRecorder();
  } else {
    startLocalRecorder();
  }
}

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
    param.rampTo(value, seconds);
  } catch (error) {
    console.warn("[Music] param ramp failed:", cacheKey, error);
  }
}

function outputGainFromLevel(level) {
  const safeLevel = clampValue(Number.isFinite(level) ? level : 75, 0, 100);
  if (safeLevel <= 0) return 0.0001;
  if (safeLevel <= 50) {
    return mapValue(safeLevel, 0, 50, 0.0001, 0.82);
  }
  if (safeLevel <= 75) {
    return mapValue(safeLevel, 50, 75, 0.82, 1.22);
  }
  return mapValue(safeLevel, 75, 100, 1.22, 1.6);
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

function applyOutputLevel(options = {}) {
  const allowWhenStopped = options.allowWhenStopped === true;
  if (!isPlaying && !allowWhenStopped) return;
  const seconds = options.force === true ? 0.08 : 0.18;
  rampParam("master-gain", masterGain.gain, outputGainFromLevel(OutputState.level), seconds, 0.003);
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

function setBackgroundStatus(message) {
  const el = document.getElementById("background_value");
  if (el) el.textContent = message;
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
    stop: () => document.getElementById("btn_stop")?.click()
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
    setBackgroundStatus(navigator.wakeLock?.request ? "off" : "n/a");
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

function setAcidLockEnabled(enabled) {
  AcidLockState.enabled = !!enabled;
  AcidLockState.intensity = AcidLockState.enabled ? Math.max(AcidLockState.intensity, 0.58) : 0;
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
  return audio;
}

function routeHardwareOutputForBridge(active, force = false) {
  const value = active ? 0.0001 : 1;
  rampParam("hardware-output", hardwareOutput.gain, value, force ? 0.04 : 0.12, 0.003);
}

async function startBackgroundAudioBridge(options = {}) {
  const force = options.force === true;
  if (!force && !shouldPreferBackgroundAudioBridge()) {
    routeHardwareOutputForBridge(false);
    return false;
  }

  const audio = ensureBackgroundPlaybackElement();
  if (!audio) {
    setBackgroundStatus("direct");
    routeHardwareOutputForBridge(false);
    return false;
  }

  try {
    audio.muted = false;
    audio.volume = 1;
    if (PlaybackState.outputDeviceId && typeof audio.setSinkId === "function") {
      await audio.setSinkId(PlaybackState.outputDeviceId);
    }
    const result = audio.play();
    if (result && typeof result.then === "function") await result;
    PlaybackState.backgroundBridgeActive = true;
    routeHardwareOutputForBridge(true, force);
    setBackgroundStatus(shouldPreferBackgroundAudioBridge() ? "ios bg" : "bridge");
    return true;
  } catch (error) {
    console.warn("[Music] background audio bridge failed:", error);
    PlaybackState.backgroundBridgeActive = false;
    routeHardwareOutputForBridge(false, true);
    setBackgroundStatus("direct");
    return false;
  }
}

function stopBackgroundAudioBridge() {
  const audio = PlaybackState.backgroundAudio;
  PlaybackState.backgroundBridgeActive = false;
  routeHardwareOutputForBridge(false, true);
  if (audio) {
    try { audio.pause(); } catch(e) {}
  }
  setBackgroundStatus(PlaybackState.wakeLockEnabled ? "ready" : "off");
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

function approachValue(current, target, maxStep) {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

/* =========================================================
   2. Tone.js 構成（軽量版）
========================================================= */

// マスター処理（少なめ）
const masterLimiter = new Tone.Limiter(-1);
const hardwareOutput = new Tone.Gain(1).toDestination();
const masterGain    = new Tone.Gain(0.8).connect(masterLimiter);
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

// シンプルなリバーブ＆ディレイのみ
const globalReverb = new Tone.Reverb({
  decay: 5.6,
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
const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 1.2, decay: 0.7, sustain: 0.7, release: 3.5 }
}).connect(padFilter);

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

const pianoMemoryFilter = new Tone.Filter(1800, "lowpass").connect(globalDelay);
const pianoMemory = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.18, sustain: 0.045, release: 0.5 }
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

function organicFragment(offset = 0) {
  return ORGANIC_PLUCK_FRAGMENTS[tonalRhymeIndex(stepIndex, offset) % ORGANIC_PLUCK_FRAGMENTS.length];
}

function transparentFragment(offset = 0) {
  return TRANSPARENT_AIR_FRAGMENTS[tonalRhymeIndex(stepIndex, offset) % TRANSPARENT_AIR_FRAGMENTS.length];
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
  const index = tonalRhymeIndex(stepIndex, GenomeState.generation + phaseOffset + offset);
  return pool[((index % pool.length) + pool.length) % pool.length];
}

function triggerVoiceColorCue() {
  if (!isPlaying || !initialized || typeof Tone === "undefined") return;

  const now = Tone.now();
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

function triggerPadSignature(name) {
  if (!isPlaying || !initialized || typeof Tone === "undefined") return;

  const now = Tone.now();
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
    ["E3", "G3", "B3"]
  ],
  dub: [
    ["D3", "A3", "E4"],
    ["G3", "D4", "F#4"]
  ],
  jazz: [
    ["D3", "F#3", "A3", "E4"],
    ["G3", "B3", "D4", "F#4"]
  ],
  techno: [
    ["D3", "F#3"],
    ["G3", "E4"],
    ["D3", "E4"]
  ],
  trance: [
    ["D3", "F#3", "A3"],
    ["E3", "G3", "B3"]
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
  ["F#4", "E5", "G5"]
];
const GLASS_ACCENT_STEPS = [3, 5, 7, 10, 11, 14];

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
    if (typeof param.linearRampTo === "function") {
      param.linearRampTo(target, seconds);
      return;
    }
    param.rampTo(target, seconds);
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

  safeToneRamp(pad?.volume, airyPad, 0.28);
  safeToneRamp(glass?.volume, glassLevel, 0.22);
  safeToneRamp(texture?.volume, textureLevel, 0.2);
  safeToneRamp(bass?.filter?.frequency, bassCutoff, 0.18);
  safeToneRamp(bass?.filter?.Q, bassBite, 0.2);
  safeToneRamp(glass?.harmonicity, 1.0 + (TimbreState.glass * 0.95) + (TimbreState.harp * 0.72) + (organicColor * 0.12) + genre.idm * 0.08 + genre.techno * 0.06 + (PerformancePadState.void * 0.24), 0.24);
  safeToneRamp(glass?.modulationIndex, 0.58 + (TimbreState.fracture * 2.08) + (TimbreState.harp * 0.92) + (pressureColor * 0.1) + genre.techno * 0.16 - genre.ambient * 0.12 - (TimbreState.warmth * 0.5) - (PerformancePadState.void * 0.2), 0.2);
  safeToneRamp(pianoMemory?.volume, -45.2 + family.pianoMemory * 8.2 + family.chain * 1.4 + clarity * 0.8 - genre.techno * 0.8, 0.3);
  safeToneRamp(voiceDust?.volume, -48 + family.voiceDust * 9.4 + family.chain * 1.2 + PerformancePadState.void * 1.4 - genre.pressure * 0.7, 0.32);
  safeToneRamp(drumSkin?.volume, -42 + family.drumSkin * 9.2 + family.acidBiyon * 1.8 - lowGuard * 2.6, 0.22);
  safeToneRamp(subImpact?.volume, -39 + family.sub808 * 8.8 + family.acidBiyon * 2.4 - lowGuard * 4.4, 0.22);
  safeToneRamp(reedBuzz?.volume, -52 + family.reedBuzz * 10.4 + (TimbreFamilyState.inner?.reedBuzz || 0) * 1.8 - lowGuard * 4.2 - genre.techno * 0.9, 0.36);
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

// Mode-specific sound personality (v1.3)
function updateSoundForMode(mode){
  // Keep changes gentle; use .set and ramp where possible
  try{
    if(mode==="ambient"){
      pad.set({ oscillator:{type:"sine"}, envelope:{attack:1.2, decay:0.8, sustain:0.62, release:3.2} });
      padFilter.frequency.rampTo(800, 1.2);
      globalReverb.decay = 5.8;
      globalReverb.wet.rampTo(0.32, 1.2);
      globalDelay.wet.rampTo(0.10, 1.2);
      bass.set({ oscillator:{type:"triangle"}, envelope:{attack:0.02, decay:0.35, sustain:0.25, release:1.2} });
    }else if(mode==="lofi"){
      pad.set({ oscillator:{type:"triangle"}, envelope:{attack:0.8, decay:0.7, sustain:0.58, release:2.8} });
      padFilter.frequency.rampTo(1200, 1.0);
      globalReverb.decay = 5.5;
      globalReverb.wet.rampTo(0.28, 1.0);
      globalDelay.wet.rampTo(0.18, 1.0);
      bass.set({ oscillator:{type:"square"}, filterEnvelope:{baseFrequency:70, octaves:2.2} });
    }else if(mode==="dub"){
      pad.set({ oscillator:{type:"sawtooth"}, envelope:{attack:0.65, decay:0.5, sustain:0.5, release:2.5} });
      padFilter.frequency.rampTo(1400, 0.9);
      globalReverb.decay = 6.2;
      globalReverb.wet.rampTo(0.34, 0.9);
      globalDelay.delayTime = "4n.";
      globalDelay.feedback.rampTo(0.55, 0.8);
      globalDelay.wet.rampTo(0.32, 0.8);
      bass.set({ oscillator:{type:"square"}, filter:{Q:1.2}, filterEnvelope:{baseFrequency:65, octaves:2.6} });
    }else if(mode==="jazz"){
      pad.set({ oscillator:{type:"triangle"}, envelope:{attack:0.55, decay:0.6, sustain:0.48, release:2.2} });
      padFilter.frequency.rampTo(1600, 0.9);
      globalReverb.decay = 4.8;
      globalReverb.wet.rampTo(0.22, 0.9);
      globalDelay.wet.rampTo(0.14, 0.9);
      bass.set({ oscillator:{type:"triangle"}, filterEnvelope:{baseFrequency:80, octaves:2.0} });
    }else if(mode==="techno"){
      pad.set({ oscillator:{type:"sawtooth"}, envelope:{attack:0.35, decay:0.35, sustain:0.36, release:1.4} });
      padFilter.frequency.rampTo(2200, 0.7);
      globalReverb.decay = 4.2;
      globalReverb.wet.rampTo(0.18, 0.7);
      globalDelay.delayTime = "8n";
      globalDelay.feedback.rampTo(0.28, 0.7);
      globalDelay.wet.rampTo(0.16, 0.7);
      bass.set({ oscillator:{type:"sawtooth"}, filter:{Q:2.2}, filterEnvelope:{baseFrequency:55, octaves:3.3}, envelope:{attack:0.005, decay:0.18, sustain:0.2, release:0.25} });
    }else if(mode==="trance"){
      pad.set({ oscillator:{type:"sawtooth"}, envelope:{attack:0.45, decay:0.45, sustain:0.45, release:1.8} });
      padFilter.frequency.rampTo(2600, 0.9);
      globalReverb.decay = 6.8;
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
  }catch(e){
    console.warn("updateSoundForMode failed", e);
  }
}
let bassRoot     = "D2";

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

  const swing = mapValue(UCM_CUR.wave, 0, 100, 0.015, 0.105);
  if (force || typeof RAMP_CACHE["transport-swing"] !== "number" || Math.abs(RAMP_CACHE["transport-swing"] - swing) > 0.008) {
    Tone.Transport.swing = swing;
    Tone.Transport.swingSubdivision = "8n";
    RAMP_CACHE["transport-swing"] = swing;
  }

  // モード
  const newMode = resolveMode();
  if (EngineParams.mode !== newMode){
    EngineParams.mode = newMode;
  }
  const manual = PresetManager.selected && PresetManager.selected !== "__auto__";

  // mode-change hooks (patterns + sound)
  if (lastMode !== EngineParams.mode){
    lastMode = EngineParams.mode;
    setPatternsByMode();
    updateSoundForMode(EngineParams.mode);
    if (manual && PresetManager.presets[EngineParams.mode]) {
      applyPresetToEngineParams(PresetManager.presets[EngineParams.mode]);
    }
    const modeLabel = document.getElementById("mode-label");
  renderModeLabel();
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
    case "techno":  bassRoot = tonalRhymeSub(stepIndex, 1); break;
    case "trance":  bassRoot = tonalRhymeSub(stepIndex, 2); break;
  }

  if (!manual) setPatternsByMode();
  applyHazamaProfileToEngineParams({ force });
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
  resetDJTempo();
  resetGenerativeGenome();
  resetAutoVoiceMorph();
  resetReferenceMorph();
  resetRdjGrowth();
  resetProducerHabits();
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

function randomNoteFromScale() {
  const idx = Math.floor(Math.random() * currentScale.length);
  return currentScale[idx];
}

function randomChordForMode() {
  const chords = MODE_CHORDS[EngineParams.mode] || MODE_CHORDS.ambient;
  return chords[Math.floor(Math.random() * chords.length)];
}

function randomHazeChord() {
  return HAZE_CHORDS[tonalRhymeIndex(stepIndex, Math.floor(Math.random() * HAZE_CHORDS.length)) % HAZE_CHORDS.length];
}

function advanceGrooveStructure() {
  GrooveState.cycle++;
  advanceAutoDirectorPhrase();
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
  advanceLongformArcPhrase({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceOrganicEcosystemPhrase({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceOddLogicDirectorPhrase();
  updateBpmCrossfadeMemory(currentGradientParts());
  advanceAutoVoiceMorphPhrase();
  advanceVoiceEmergencePhrase();
  advanceReferenceMorph({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceRdjGrowth({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
  advanceProducerHabits({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm });
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
      idm: GenreBlendState.idm || 0
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

  GrooveState.fillActive = phraseStep === 3 && rand(fillChance);
  GrooveState.textureLift = GrooveState.fillActive ? 0.10 + creationNorm * 0.12 : creationNorm * 0.035;
  GrooveState.glassLift = (phraseStep === 1 || phraseStep === 3) ? 0.04 + creationNorm * 0.08 : 0.015;
  GrooveState.accentStep = GLASS_ACCENT_STEPS[(GrooveState.cycle + Math.floor(waveNorm * 6)) % GLASS_ACCENT_STEPS.length];
  GrooveState.bassOffset = (GrooveState.cycle + Math.floor(UCM_CUR.mind / 18)) % 4;
  GrooveState.microJitterScale = GrooveState.fillActive ? 1.4 : 0.7 + waveNorm * 0.7;
}

function bassNoteForStep(step) {
  const phraseIndex = Math.floor(step / 4) + GrooveState.bassOffset;
  return step % 8 === 0
    ? tonalRhymeSub(step, phraseIndex)
    : tonalRhymeLow(step, phraseIndex);
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
    ? 0.46 + acid * 0.32 + energyNorm * 0.08
    : 0.075 + acid * 0.3 + PerformancePadState.repeat * 0.06;
  if (!gate || !rand(gateChance)) return;

  const acidPhase = Math.floor((GenomeState.phase || 0) * TONAL_RHYME_LOW.length);
  const note = tonalRhymeLow(step, acidPhase);
  const turnNote = tonalRhymeLow(step, acidPhase + 2);
  const reply = tonalRhymeHigh(step, acidPhase + 2);
  const acidTime = time + 0.012 + Math.random() * (0.01 + waveNorm * 0.012);
  const vel = clampValue(0.056 + acid * 0.122 - lowGuard * 0.038, 0.04, 0.166);
  const impactVel = clampValue(0.24 + acid * 0.2 + energyNorm * 0.045 - lowGuard * 0.095, 0.18, 0.48);
  const jabVel = clampValue(0.085 + acid * 0.12 + resourceNorm * 0.018 - lowGuard * 0.04, 0.065, 0.22);
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
    if (rand(0.34 + acid * 0.32)) {
      bass.triggerAttackRelease(note, "64n", acidTime + 0.046 + Math.random() * 0.012, vel * 0.52);
    }
    if ((step % 8 === 3 || step % 8 === 6 || isAccentStep) && rand(0.18 + acid * 0.22)) {
      bass.triggerAttackRelease(turnNote, "64n", acidTime + 0.074 + Math.random() * 0.014, vel * 0.42);
    }
    if (glass && rand(0.32 + acid * 0.34)) {
      glass.triggerAttackRelease(reply, "64n", acidTime + 0.022, clampValue(0.022 + acid * 0.06 + gradient.chrome * 0.01, 0.016, 0.096));
    }
    if (hat && (step % 4 === 1 || step % 4 === 3 || isAccentStep) && rand(0.24 + acid * 0.32)) {
      hat.triggerAttackRelease("64n", acidTime + 0.008, clampValue(0.04 + acid * 0.08 + energyNorm * 0.018, 0.032, 0.14));
    }
    if (texture && rand(0.26 + acid * 0.3)) {
      texture.triggerAttackRelease("64n", acidTime + 0.016, clampValue(0.024 + acid * 0.07 + (impactGate ? 0.018 : 0), 0.016, 0.116));
    }
    markMixEvent(0.12 + acid * 0.1 + (impactGate ? 0.05 : 0));
  } catch (error) {
    console.warn("[Music] acid trace failed:", error);
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
  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + GenomeState.generation + 1) * GOLDEN_RATIO_INVERSE) * 8);
  const chanceValue = chance(
    (0.034 +
      SignatureCellState.intensity * 0.12 +
      RdjGrowthState.tender * 0.018 +
      (gradient.chrome || 0) * 0.04 +
      (depth.tail || 0) * 0.034 +
      (family.voiceDust || 0) * 0.025 +
      producerHabitBias("ghostGlass") * 0.025 +
      PerformancePadState.drift * 0.035 +
      PerformancePadState.repeat * 0.034 +
      voiding * 0.034 -
      producerHabitBias("restraint") * 0.01 -
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
  const intensity = SignatureCellState.lowBreathIntensity;
  const chanceValue = chance(
    (0.02 +
      intensity * 0.09 +
      RdjGrowthState.rubber * 0.018 +
      (depth.bed || 0) * 0.036 +
      (gradient.ghost || 0) * 0.03 +
      (family.reedBuzz || 0) * 0.026 +
      producerHabitBias("lowBreath") * 0.026 +
      producerHabitBias("ghostPressure") * 0.018 +
      voiding * 0.026 -
      producerHabitBias("restraint") * 0.012 -
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
  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + GenomeState.generation + 4) * GOLDEN_RATIO_INVERSE) * 7);
  const shard = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 2) % FIELD_MURK_FRAGMENTS.length];
  const glassShard = GLASS_NOTES[(step + GrooveState.cycle + phaseOffset + 5) % GLASS_NOTES.length];
  const scarTime = time + 0.01 + Math.random() * (0.01 + waveNorm * 0.014 + PerformancePadState.drift * 0.014);
  const chanceValue = chance(
    (0.022 +
      intensity * 0.1 +
      RdjGrowthState.edit * 0.018 +
      collapse * 0.04 +
      (gradient.micro || 0) * 0.04 +
      (family.drumSkin || 0) * 0.032 +
      PerformancePadState.repeat * 0.04 +
      producerHabitBias("brokenTexture") * 0.032 +
      producerHabitBias("rubberEdit") * 0.018 -
      producerHabitBias("restraint") * 0.012 -
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
  const intensity = SignatureCellState.memoryPluckIntensity;
  if (intensity < 0.2) return;

  const chanceValue = chance(
    (0.018 +
      intensity * 0.095 +
      (gradient.memory || 0) * 0.034 +
      (family.pianoMemory || 0) * 0.028 +
      RdjGrowthState.toy * 0.026 +
      RdjGrowthState.tender * 0.018 +
      producerHabitBias("memoryPluck") * 0.034 -
      producerHabitBias("restraint") * 0.012 -
      voidNorm * 0.025 -
      (MixGovernorState.eventLoad || 0) * 0.04) * conductorScale
  );
  if (!rand(chanceValue)) return;

  const phaseOffset = Math.floor(fractionalPart((GrooveState.cycle + SignatureCellState.phrase + RdjGrowthState.generation + 6) * GOLDEN_RATIO_INVERSE) * 8);
  const root = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 1) % ORGANIC_PLUCK_FRAGMENTS.length];
  const reply = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + phaseOffset + 4) % TRANSPARENT_AIR_FRAGMENTS.length];
  const shade = tonalRhymeMid(step, phaseOffset + 2);
  const pluckTime = time + 0.018 + Math.random() * (0.018 + waveNorm * 0.018);
  const vel = clampValue(0.012 + intensity * 0.05 + creationNorm * 0.008 + observerNorm * 0.006, 0.01, 0.074);

  try {
    if (pianoMemory) {
      pianoMemory.triggerAttackRelease(root, "32n", pluckTime, vel);
      if (rand(0.2 + RdjGrowthState.toy * 0.18 + MotifMemoryState.strength * 0.12)) {
        pianoMemory.triggerAttackRelease(shade, "64n", pluckTime + 0.072 + Math.random() * 0.02, clampValue(vel * 0.45, 0.008, 0.036));
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
  const driftedTime = time + Math.random() * (0.01 + waveNorm * 0.018 + PerformancePadState.drift * 0.018);
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
    const acidChance = chance(0.12 + family.acidBiyon * 0.34 + resourceNorm * 0.05 + kits.technoKit * 0.045 + ReferenceMorphState.pulse * 0.028 + RdjGrowthState.rubber * 0.04 + habitRubber * 0.04 + habitGrid * 0.015 + PerformancePadState.repeat * 0.05 - kits.spaceKit * 0.04 - habitSpace * 0.025 - RdjGrowthState.restraint * 0.02 - habitRestraint * 0.018 - lowGuard * 0.12);
    if (rand(acidChance)) {
      const acidTime = time + 0.014 + Math.random() * (0.012 + waveNorm * 0.012);
      const note = tonalRhymeLow(step, phaseOffset + 1);
      const turn = tonalRhymeLow(step, phaseOffset + 3);
      const high = tonalRhymeHigh(step, phaseOffset + 2);
      const vel = clampValue(0.06 + family.acidBiyon * 0.13 + energyNorm * 0.018 - lowGuard * 0.04, 0.045, 0.22);
      const cutoff = clampValue(240 + family.acidBiyon * 980 + creationNorm * 260 + resourceNorm * 140 - lowGuard * 140, 140, 1450);
      const q = clampValue(2.2 + family.acidBiyon * 5.2 + creationNorm * 0.8 - lowGuard * 0.8, 1.6, 8.0);
      try {
        safeToneRamp(bass?.filter?.frequency, cutoff, 0.04);
        safeToneRamp(bass?.filter?.Q, q, 0.04);
        bass.triggerAttackRelease(note, "64n", acidTime, vel);
        if (rand(0.42 + family.acidBiyon * 0.26)) {
          bass.triggerAttackRelease(turn, "64n", acidTime + 0.047 + Math.random() * 0.014, vel * 0.52);
        }
        if (glass && rand(0.28 + family.acidBiyon * 0.22)) {
          glass.triggerAttackRelease(high, "64n", acidTime + 0.026, clampValue(0.018 + family.acidBiyon * 0.056, 0.014, 0.086));
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
  const lowGuard = MixGovernorState.lowGuard || 0;

  if (PerformancePadState.drift && (step % 8 === 1 || step % 8 === 5)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle) % TRANSPARENT_AIR_FRAGMENTS.length];
    const liftNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
    const pluckNote = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 5) % ORGANIC_PLUCK_FRAGMENTS.length];
    try {
      const driftDur = kits.technoKit > 0.42 || kits.idmKit > 0.5 ? "64n" : "32n";
      glass.triggerAttackRelease(note, driftDur, time + 0.018 + waveNorm * (0.014 + kits.ambientKit * 0.014), clampValue(0.03 + observerNorm * 0.034 + creationNorm * 0.014 + kits.idmKit * 0.014 + kits.spaceKit * 0.008 + gradient.chrome * 0.006, 0.024, 0.1));
      glass.triggerAttackRelease(liftNote, kits.ambientKit > kits.technoKit ? "32n" : "64n", time + 0.058 + waveNorm * 0.016 + kits.ambientKit * 0.018, clampValue(0.018 + observerNorm * 0.024 + kits.ambientKit * 0.012 + kits.idmKit * 0.008 + gradient.memory * 0.006, 0.016, 0.072));
      if (kits.idmKit > 0.3 || kits.ambientKit > 0.34) glass.triggerAttackRelease(pluckNote, "64n", time + 0.118 + waveNorm * 0.014, clampValue(0.016 + observerNorm * 0.022 + kits.idmKit * 0.01 + gradient.haze * 0.004, 0.014, 0.06));
      texture.triggerAttackRelease("64n", time + 0.026, clampValue(0.02 + waveNorm * 0.028 + kits.idmKit * 0.014 + kits.technoKit * 0.012, 0.018, 0.078));
      if (pad && kits.ambientKit > 0.5 && step % 8 === 5 && rand(0.2 + kits.ambientKit * 0.22)) {
        pad.triggerAttackRelease(randomHazeChord(), "1n", time + 0.045, clampValue(0.018 + kits.ambientKit * 0.03 + observerNorm * 0.012, 0.016, 0.058));
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
      if (kits.technoKit > 0.34 && rand(0.22 + kits.technoKit * 0.32)) {
        glass.triggerAttackRelease(note, "64n", time + 0.112, clampValue(0.014 + kits.technoKit * 0.04, 0.012, 0.06));
      }
      if (step % 8 === 6) hat.triggerAttackRelease("64n", time + 0.034, clampValue(0.036 + energyNorm * 0.034 + kits.technoKit * 0.036 + kits.idmKit * 0.018, 0.03, 0.118));
    } catch (error) {
      console.warn("[Music] repeat hold failed:", error);
    }
  }

  if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep)) {
    try {
      const bodySnap = clampValue(kits.pressureKit + kits.technoKit * 0.4 + kits.idmKit * 0.22 - kits.spaceKit * 0.24, 0, 1);
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), kits.ambientKit > 0.5 ? "32n" : "16n", time + 0.006, clampValue(0.14 + energyNorm * 0.058 + bodySnap * 0.074 - lowGuard * 0.05, 0.11, 0.31));
      if (step % 8 === 0 && lowGuard < 0.64 && kits.spaceKit < 0.58) {
        bass.triggerAttackRelease(tonalRhymeSub(step, 1), "32n", time + 0.028, clampValue(0.052 + energyNorm * 0.034 + kits.pressureKit * 0.018 - lowGuard * 0.028, 0.045, 0.125));
      }
      glass.triggerAttackRelease(ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 2) % ORGANIC_PLUCK_FRAGMENTS.length], "64n", time + 0.036, clampValue(0.032 + creationNorm * 0.03 + gradient.organic * 0.008, 0.026, 0.088));
      texture.triggerAttackRelease("64n", time + 0.018, clampValue(0.046 + creationNorm * 0.04 + kits.pressureKit * 0.034 + kits.technoKit * 0.018 + gradient.ghost * 0.01, 0.04, 0.126));
    } catch (error) {
      console.warn("[Music] punch hold failed:", error);
    }
  }

  if (PerformancePadState.void && (step % 8 === 4 || step % 8 === 7)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 2) % TRANSPARENT_AIR_FRAGMENTS.length];
    const tailNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 5) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, kits.spaceKit > 0.5 ? "8n" : "16n", time + 0.022, clampValue(0.028 + observerNorm * 0.038 + kits.spaceKit * 0.018 + gradient.chrome * 0.008, 0.024, 0.1));
      glass.triggerAttackRelease(tailNote, kits.technoKit > 0.44 ? "64n" : "32n", time + 0.112, clampValue(0.018 + observerNorm * 0.03 + kits.spaceKit * 0.014 + gradient.haze * 0.006, 0.016, 0.074));
      if (kits.technoKit > 0.42 && texture && rand(0.18 + kits.technoKit * 0.18)) {
        texture.triggerAttackRelease("64n", time + 0.052, clampValue(0.012 + kits.technoKit * 0.032, 0.01, 0.052));
      }
      if (step % 8 === 4) {
        pad.triggerAttackRelease(randomHazeChord(), kits.spaceKit > 0.52 ? "2n" : "1n", time + 0.04, clampValue(0.024 + observerNorm * 0.024 + kits.spaceKit * 0.018 + gradient.haze * 0.006, 0.02, 0.068));
      }
    } catch (error) {
      console.warn("[Music] void hold failed:", error);
    }
  }
}

function releaseAllVoices(time) {
  const t = typeof time === "number" ? time : Tone.now();
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
  if (transportEventId !== null) return;

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

function scheduleStep(time) {
  maybeTriggerWorldAccents(time);
  const step = stepIndex % EngineParams.stepCount;
  if (step === 0) advanceGrooveStructure();
  else syncHazamaTransportControls(step);
  advanceAutoMixTransport(step);
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
  const restShape = humanShape("rest");
  const isRest = rand(clampValue(EngineParams.restProb + restShape.restLift + genre.ambient * 0.045 + preKit.ambientKit * 0.03 + preKit.spaceKit * 0.035 + habitSpace * 0.02 + habitRestraint * 0.04 - genre.techno * 0.05 - preKit.technoKit * 0.045 - preKit.idmKit * 0.024 - habitGrid * 0.02 - habitRubber * 0.012 - genre.pressure * 0.025 + PerformancePadState.void * 0.18 - PerformancePadState.punch * 0.06, 0.018, PerformancePadState.void ? 0.64 : 0.5));
  const grooveJitter = (step % 2 === 1 ? mapValue(waveNorm, 0, 1, 0, 0.014 + PerformancePadState.drift * 0.026 + chaos * 0.012) * GrooveState.microJitterScale : 0);
  const fillBoost = GrooveState.fillActive ? 0.14 : 0;
  const t = time + grooveJitter;
  const stepContext = { energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm, isRest, isAccentStep };
  const gradientParts = currentGradientParts();
  const gradient = updateReferenceGradient(gradientParts);
  updateReferenceDepth(gradientParts, gradient);
  updateGenreTimbreKits(gradientParts, gradient, DepthState, genre);
  updateTimbreFamilyBlend(gradientParts, gradient, DepthState, genre);
  const kits = GenreTimbreKitState;
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
  triggerGhostGlassSignatureCell(step, t, stepContext);
  triggerMemoryPluckSignatureCell(step, t, stepContext);
  triggerBrokenTextureSignatureCell(step, t, stepContext);
  triggerLowMotion(step, t, stepContext);
  triggerLowBreathSignatureCell(step, t, stepContext);
  triggerAcidTechnoTrace(step, t, stepContext);
  triggerPadHoldMinimums(step, t, stepContext);

  if (!isRest) {
    const arcDrumThin = albumArcDrumThin();
    const droneDrumThin = EngineParams.bpm < 84 || energyNorm < 0.3 || genre.ambient > 0.44 || kits.ambientKit > 0.58 || kits.spaceKit > 0.62 || arcDrumThin > 0.42;
    const droneDrumScale = droneDrumThin ? clampValue(0.12 + (energyNorm * 0.54) + kits.technoKit * 0.34 + kits.idmKit * 0.12 - kits.spaceKit * 0.14 - arcDrumThin * 0.18, 0.06, 0.54) : 1;
    const kickShape = humanShape("kick");
    const hatShape = humanShape("hat");
    const bassShape = humanShape("bass");
    // Kick
    const kickChance = chance((EngineParams.kickProb + (isAccentStep ? 0.024 : 0) + kits.pressureKit * 0.024 + habitPressure * 0.01 + PerformancePadState.punch * 0.052 - kits.spaceKit * 0.045 - habitSpace * 0.012 - habitRestraint * 0.008 - PerformancePadState.void * 0.14) * (1 - lowGuard * 0.16) * droneDrumScale * kickShape.probabilityScale);
    if (patternAt(EngineParams.kickPattern, step) && rand(kickChance)) {
      const kickTime = t + kickShape.timeOffsetSec;
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), droneDrumThin ? "32n" : "16n", kickTime + 0.004, clampValue((0.16 + energyNorm * 0.068 + kits.pressureKit * 0.024 + (isAccentStep ? 0.014 : 0) + PerformancePadState.punch * 0.024 - kits.spaceKit * 0.018 - lowGuard * 0.05) * kickShape.velocityScale, 0.08, droneDrumThin ? 0.22 : 0.44));
      if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep) && rand(0.46)) {
        try {
          texture.triggerAttackRelease("64n", kickTime + 0.012, clampValue((0.05 + energyNorm * 0.064) * kickShape.velocityScale, 0.038, 0.118));
        } catch (error) {
          console.warn("[Music] punch transient failed:", error);
        }
      }
    }

    // Hat
    const hatChance = chance((EngineParams.hatProb + fillBoost + kits.technoKit * 0.14 + kits.idmKit * 0.068 + habitGrid * 0.05 + habitRubber * 0.014 + (isAccentStep ? 0.08 : 0) - kits.ambientKit * 0.06 - kits.spaceKit * 0.05 - habitSpace * 0.02 - habitRestraint * 0.018 - PerformancePadState.void * 0.1) * (droneDrumThin ? 0.34 : 1) * hatShape.probabilityScale);
    if ((patternAt(EngineParams.hatPattern, step) || (GrooveState.fillActive && step % 4 === 2)) && rand(hatChance)) {
      hat.triggerAttackRelease(kits.technoKit > 0.44 ? "64n" : "32n", t + hatShape.timeOffsetSec, clampValue((0.074 + energyNorm * 0.098 + kits.technoKit * 0.05 + kits.idmKit * 0.018 + (isAccentStep ? 0.04 : 0)) * hatShape.velocityScale, 0.048, 0.2));
    }
    if (kits.technoKit > 0.26 && !PerformancePadState.void && (step % 4 === 1 || step % 4 === 3) && rand((0.045 + kits.technoKit * 0.2 + kits.idmKit * 0.05 + habitGrid * 0.08 + habitRubber * 0.018 - kits.spaceKit * 0.035 - habitRestraint * 0.03) * hatShape.densityScale)) {
      try {
        hat.triggerAttackRelease("64n", t + hatShape.timeOffsetSec + 0.01 + Math.random() * (0.01 * hatShape.grainScale), clampValue((0.028 + kits.technoKit * 0.07 + energyNorm * 0.024) * hatShape.velocityScale, 0.024, 0.118));
        markMixEvent(0.05);
      } catch (error) {
        console.warn("[Music] techno grid hat failed:", error);
      }
    }
    if (PerformancePadState.repeat && (step % 4 === 2 || isAccentStep || step % 8 === 5) && rand(clampValue(0.42 + kits.idmKit * 0.22 + kits.technoKit * 0.26 + habitGrid * 0.06 + habitRubber * 0.04 - kits.ambientKit * 0.12 - habitRestraint * 0.02, 0.18, 0.72) * hatShape.densityScale)) {
      try {
        hat.triggerAttackRelease("64n", t + hatShape.timeOffsetSec + 0.018, clampValue((0.05 + energyNorm * 0.064 + kits.technoKit * 0.024) * hatShape.velocityScale, 0.038, 0.132));
        if (rand((0.28 + kits.technoKit * 0.16) * hatShape.grainScale)) hat.triggerAttackRelease("64n", t + hatShape.timeOffsetSec + 0.034, clampValue((0.036 + energyNorm * 0.048) * hatShape.velocityScale, 0.028, 0.102));
      } catch (error) {
        console.warn("[Music] repeat hat failed:", error);
      }
    }

    // Bass
    const bassChance = chance((EngineParams.bassProb + kits.pressureKit * 0.016 + habitPressure * 0.008 + (GrooveState.fillActive && step % 8 === 6 ? 0.055 : 0) - kits.spaceKit * 0.045 - habitSpace * 0.014 - habitRestraint * 0.008 - PerformancePadState.void * 0.14) * (1 - lowGuard * 0.18) * (droneDrumThin ? 0.52 : 1) * bassShape.probabilityScale);
    if (patternAt(EngineParams.bassPattern, step) && rand(bassChance)) {
      const note = step % 8 === 0 ? bassRoot : bassNoteForStep(step);
      const bassTime = t + bassShape.timeOffsetSec;
      bass.triggerAttackRelease(note, droneDrumThin ? "4n" : "8n", bassTime + 0.004, clampValue((0.12 + energyNorm * 0.082 + kits.pressureKit * 0.018 + PerformancePadState.punch * 0.018 - kits.spaceKit * 0.018 - lowGuard * 0.034) * bassShape.velocityScale, 0.075, droneDrumThin ? 0.18 : 0.29));
      if (PerformancePadState.repeat && step % 8 === 0 && rand(0.1 * bassShape.densityScale)) {
        try {
          bass.triggerAttackRelease(note, "32n", bassTime + 0.04, clampValue((0.08 + energyNorm * 0.04) * bassShape.velocityScale, 0.06, 0.14));
        } catch (error) {
          console.warn("[Music] repeat bass failed:", error);
        }
      }
    }

    // Pad（ゆっくり）
    const padChance = chance(EngineParams.padProb + kits.ambientKit * 0.045 + kits.spaceKit * 0.035 + habitMemory * 0.026 + habitSpace * 0.026 + habitRestraint * 0.014 - kits.technoKit * 0.07 - kits.pressureKit * 0.035 - habitGrid * 0.024);
    if (patternAt(EngineParams.padPattern, step) && rand(padChance)) {
      const dur = kits.technoKit > 0.44 ? "8n" : kits.idmKit > 0.48 ? "4n" : "2n";
      const chord = rand(0.38 + observerNorm * 0.22 + gradient.haze * 0.12 + gradient.chrome * 0.06 + PerformancePadState.void * 0.16) ? randomHazeChord() : randomChordForMode();
      pad.triggerAttackRelease(chord, dur, t, clampValue(0.044 + circleNorm * 0.052 + observerNorm * 0.018 + kits.ambientKit * 0.014 + kits.spaceKit * 0.012 - kits.technoKit * 0.012 + gradient.haze * 0.006, 0.036, 0.122));
    }
  }

  const textureShape = humanShape("texture");
  const glassShape = humanShape("glass");
  const textureProb = chance((mapValue(UCM_CUR.creation + UCM_CUR.resource, 0, 200, 0.024, 0.19) + GrooveState.textureLift + kits.technoKit * 0.056 + kits.idmKit * 0.038 + kits.pressureKit * 0.02 + habitGrid * 0.038 + habitRubber * 0.026 + habitPressure * 0.01 + gradient.micro * 0.014 + gradient.ghost * 0.006 + DepthState.particle * 0.016 + DepthState.gesture * 0.01 + voiceMicro * 0.01 + voicePulse * 0.006 + PerformancePadState.drift * 0.086 - kits.ambientKit * 0.028 - kits.spaceKit * 0.014 - habitRestraint * 0.018 - PerformancePadState.void * 0.01) * textureShape.probabilityScale);
  if (rand(textureProb) && (step % 2 === 1 || isAccentStep)) {
    const textureTime = t + textureShape.timeOffsetSec + (isAccentStep ? 0.006 : 0.012);
    texture.triggerAttackRelease(kits.technoKit > 0.38 || kits.idmKit > 0.48 ? "64n" : "32n", textureTime, clampValue((0.024 + creationNorm * 0.078 + resourceNorm * 0.022 + kits.technoKit * 0.02 + kits.pressureKit * 0.018 + gradient.micro * 0.006 + DepthState.gesture * 0.012 + PerformancePadState.punch * 0.014) * textureShape.velocityScale, 0.018, 0.124));
  }

  const particleProb = chance((0.03 + creationNorm * 0.034 + waveNorm * 0.024 + observerNorm * 0.022 + kits.idmKit * 0.046 + kits.technoKit * 0.03 + kits.spaceKit * 0.018 + habitMemory * 0.022 + habitRubber * 0.022 + habitSpace * 0.012 + gradient.chrome * 0.014 + gradient.micro * 0.01 + DepthState.particle * 0.022 + clarity * 0.018 + voiceChrome * 0.011 + voiceOrganic * 0.008 + voiceRefrain * 0.006 + PerformancePadState.drift * 0.104 + PerformancePadState.repeat * 0.056 + PerformancePadState.void * 0.06 - kits.ambientKit * 0.016 - habitRestraint * 0.012) * glassShape.probabilityScale);
  if (rand(particleProb) && (step % 4 === 1 || step % 8 === 5 || isAccentStep)) {
    const particlePool = kits.technoKit > 0.42 ? GLASS_NOTES : kits.spaceKit > 0.52 ? TRANSPARENT_AIR_FRAGMENTS : FIELD_MURK_FRAGMENTS;
    const note = voiceFragment(Math.floor(Math.random() * particlePool.length), particlePool);
    try {
      glass.triggerAttackRelease(note, kits.technoKit > 0.42 || kits.idmKit > 0.5 ? "64n" : "32n", t + glassShape.timeOffsetSec + 0.019 + Math.random() * (0.018 * glassShape.grainScale), clampValue((0.022 + creationNorm * 0.034 + kits.idmKit * 0.012 + kits.technoKit * 0.014 + kits.spaceKit * 0.008 + gradient.micro * 0.008 + DepthState.particle * 0.008 + clarity * 0.008 + PerformancePadState.repeat * 0.038 + PerformancePadState.void * 0.018) * glassShape.velocityScale, 0.016, 0.104));
    } catch (error) {
      console.warn("[Music] field particle failed:", error);
    }
  }

  const airProb = chance(0.03 + observerNorm * 0.046 + circleNorm * 0.021 + kits.spaceKit * 0.038 + kits.ambientKit * 0.024 + habitSpace * 0.038 + habitRestraint * 0.012 + gradient.chrome * 0.016 + gradient.haze * 0.009 + DepthState.tail * 0.026 + voiceChrome * 0.012 + voiceVoidTail * 0.016 + PerformancePadState.void * 0.14 + PerformancePadState.drift * 0.066 + PerformancePadState.repeat * 0.022 - kits.pressureKit * 0.012);
  if (rand(airProb) && (step % 8 === 4 || step % 8 === 7)) {
    const note = voiceFragment(Math.floor(Math.random() * TRANSPARENT_AIR_FRAGMENTS.length), TRANSPARENT_AIR_FRAGMENTS);
    try {
      glass.triggerAttackRelease(note, kits.spaceKit > 0.56 ? "16n" : "32n", t + 0.024, clampValue(0.018 + observerNorm * 0.04 + kits.spaceKit * 0.014 + gradient.chrome * 0.008 + DepthState.tail * 0.008 + PerformancePadState.void * 0.025 + PerformancePadState.repeat * 0.012, 0.012, 0.092));
    } catch (error) {
      console.warn("[Music] transparent air failed:", error);
    }
  }

  const glassProb = chance((mapValue(UCM_CUR.mind + UCM_CUR.creation, 0, 200, 0.022, 0.145) + GrooveState.glassLift + kits.idmKit * 0.036 + kits.technoKit * 0.022 + kits.spaceKit * 0.018 + habitMemory * 0.026 + habitRubber * 0.018 + habitSpace * 0.012 + gradient.memory * 0.012 + gradient.chrome * 0.013 + gradient.micro * 0.009 + DepthState.particle * 0.016 + DepthState.gesture * 0.01 + voiceChrome * 0.012 + voiceRefrain * 0.008 + PerformancePadState.drift * 0.088 + PerformancePadState.repeat * 0.068 + PerformancePadState.void * 0.038 - kits.ambientKit * 0.012 - habitRestraint * 0.012) * glassShape.probabilityScale);
  if (rand(glassProb) && (isAccentStep || step % 8 === 3 || step % 16 === 11)) {
    const note = voiceFragment(Math.floor(Math.random() * GLASS_NOTES.length), GLASS_NOTES);
    const glassTime = t + glassShape.timeOffsetSec;
    glass.triggerAttackRelease(note, kits.technoKit > 0.48 ? "64n" : "16n", glassTime + 0.015, clampValue((0.034 + energyNorm * 0.046 + observerNorm * 0.018 + kits.idmKit * 0.012 + kits.spaceKit * 0.008 + PerformancePadState.void * 0.014) * glassShape.velocityScale, 0.024, 0.112));
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
    const desired = clampValue(profile.base + directorBias + arcBias + albumBias + profile.depth * (wave + ripple), 4, 96);
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
    releaseAllVoices();
    resetRuntimeCounters();
    restoreMasterLevel();
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
  releaseAllVoices();
  resetRuntimeCounters();
  clearPerformancePads();
  quietMasterLevel();
  safeCallMusicAudioAdapter("stop");
  updateMediaSessionPlaybackState();
  releasePlaybackWakeLock();
  stopBackgroundAudioBridge();
  if (statusText) statusText.textContent = "Stopped";
  if (HazamaBridgeState.loaded) updateHazamaUiState();
  updateRuntimeUiState();
  requestHazamaRuntimeFeedback(feedbackKind);
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
  const btnPacketJson = document.getElementById("btn_packet_json");

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

  if (btnPacketJson) {
    btnPacketJson.addEventListener("click", downloadMusicSessionPacket);
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
  setInterval(() => {
    try {
      if (isPlaying && typeof Tone !== "undefined" && Tone && Tone.context && Tone.context.state !== "running") {
        console.warn("[Music] AudioContext not running:", Tone.context.state, "-> resume");
        resumeAudioContext("watchdog");
      }
      if (isPlaying && Tone && Tone.Transport && Tone.Transport.state !== "started") {
        console.warn("[Music] Transport not started:", Tone.Transport.state, "-> start");
        ensureTransportScheduled();
        Tone.Transport.start("+0.03");
      }
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
        startBackgroundAudioBridge();
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
