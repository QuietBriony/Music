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
  if (!UCM.auto.enabled || !isPlaying) return;
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
    ["drift", 0.18 + waveNorm * 0.3 + observerNorm * 0.12 + circleNorm * 0.1 + OrganicChaosState.airPull * 0.08 + (scene.gesture?.drift || 0) + longformArcGestureBias("drift")],
    ["repeat", 0.16 + creationNorm * 0.28 + resourceNorm * 0.22 + waveNorm * 0.08 + OrganicChaosState.tangle * 0.12 + (scene.gesture?.repeat || 0) + longformArcGestureBias("repeat")],
    ["punch", 0.1 + energyNorm * 0.16 + UCM_CUR.body / 100 * 0.12 + OrganicChaosState.lowMotion * 0.1 + (scene.gesture?.punch || 0) + longformArcGestureBias("punch")],
    ["void", 0.12 + voidNorm * 0.22 + observerNorm * 0.16 + circleNorm * 0.08 + OrganicChaosState.impulse * 0.06 + (scene.gesture?.void || 0) + longformArcGestureBias("void")]
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
  if (!UCM.auto.enabled || !isPlaying) return;
  const now = performanceNowMs();
  if (hasActivePerformancePad()) return;
  if (now - PerformancePadState.lastTouchAt < AUTO_GESTURE_MANUAL_GRACE_MS) return;
  if (now - AutoGestureState.lastAt < AUTO_GESTURE_MIN_GAP_MS) return;
  if (!(step % 8 === 0 || step % 8 === 4)) return;

  const scene = currentAutoDirectorScene();
  const arcLift = longformArcActive() ? LongformArcState.contrast * 0.026 + LongformArcState.turn * 0.018 : 0;
  const chanceValue = 0.11 + (scene.gestureChance || 0.03) + context.creationNorm * 0.045 + context.observerNorm * 0.032 + context.waveNorm * 0.032 + context.resourceNorm * 0.022 + arcLift;
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
  TonalRhymeState.lowOffset = (phrase + Math.floor((MotifMemoryState.strength || 0) * 4) + (AcidLockState.enabled ? 2 : 0)) % 4;
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
  const acid = updateAcidLockIntensity(0.028);
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

function markMixEvent(amount = 0.08) {
  MixGovernorState.eventLoad = clampValue(MixGovernorState.eventLoad + amount, 0, 1);
}

function updateGenreBlend(parts) {
  const { energy, wave, creation, voidness, circle, body, resource, observer, pressure } = parts;
  const bpmNorm = clampValue((EngineParams.bpm - 58) / 90, 0, 1);
  const acid = AcidLockState.enabled ? clampValue(AcidLockState.intensity || 0.42, 0, 1) : 0;
  const midBpm = 1 - Math.abs(bpmNorm - 0.5) * 2;
  const activeGrid = clampValue((energy * 0.42) + (resource * 0.28) + (bpmNorm * 0.3), 0, 1);
  const ambientTarget = clampValue(
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
  const idmTarget = clampValue(
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
  const technoTarget = clampValue(
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
  const pressureTarget = clampValue(
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
  const total = Math.max(0.001, ambientTarget + idmTarget + technoTarget + pressureTarget);

  GenreBlendState.ambient = approachValue(GenreBlendState.ambient, ambientTarget / total, 0.08);
  GenreBlendState.idm = approachValue(GenreBlendState.idm, idmTarget / total, 0.08);
  GenreBlendState.techno = approachValue(GenreBlendState.techno, technoTarget / total, 0.08);
  GenreBlendState.pressure = approachValue(GenreBlendState.pressure, pressureTarget / total, 0.08);
  return GenreBlendState;
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
  const acidAmount = updateAcidLockIntensity(0.012);
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
  const contour = Math.sin((GrooveState.cycle * 0.045) + (LongformArcState.stageIndex * 0.9)) * (1.2 + longformArcShape() * 2.4);
  const pressureLift = clampValue((body * 0.22) + (resource * 0.18) + (creation * 0.12) - (observer * 0.08) - (voidness * 0.08), -0.12, 0.36) * 8;
  const target = resolvePerformanceTempoTarget(rawBpm + longformTempoBias() + genreBias + pressureLift + contour);
  const targetStep = force ? 96 : 0.55 + Math.abs(DJTempoState.targetBpm - target) * 0.018;
  const bpmStep = force ? 96 : 0.42 + wave * 0.18 + genre.techno * 0.16;

  DJTempoState.rawBpm = rawBpm;
  DJTempoState.targetBpm = approachValue(DJTempoState.targetBpm, target, targetStep);
  DJTempoState.bpm = approachValue(DJTempoState.bpm, DJTempoState.targetBpm, bpmStep);
  DJTempoState.drift = DJTempoState.bpm - rawBpm;
  DJTempoState.motion = DJTempoState.targetBpm - DJTempoState.bpm;
  EngineParams.bpm = Math.round(DJTempoState.bpm);

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
  if (GenreBlendState.techno > 0.34 || AcidLockState.intensity > 0.18) push("micro", "ghost", "chrome");
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
  const activity = clampValue(GenreBlendState.idm * 0.26 + GenreBlendState.techno * 0.22 + AcidLockState.intensity * 0.18 + energy * 0.12, 0, 0.36);
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
    acid: {
      enabled: AcidLockState.enabled,
      intensity: AcidLockState.intensity,
      color: { ...PerformanceColorDriftState }
    },
    gradient: { ...GradientState },
    depth: { ...DepthState },
    genre: { ...GenreBlendState },
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
      source: HazamaBridgeState.source,
      name: HazamaBridgeState.name,
      style: HazamaBridgeState.style,
      pending: HazamaBridgeState.pending,
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
    statusText.textContent = UCM.auto.enabled ? "Playing / AutoMix" : "Playing…";
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
  const button = document.getElementById("btn_start");
  if (button) {
    button.textContent = HazamaBridgeState.loaded ? "START.HZM" : "START";
    button.setAttribute("aria-label", HazamaBridgeState.loaded ? "Start Hazama audio" : "Start audio");
    button.setAttribute("title", HazamaBridgeState.loaded ? "Start Hazama audio" : "Start audio");
  }
  if (document.body) {
    document.body.dataset.hazama = HazamaBridgeState.loaded ? "true" : "false";
    document.body.dataset.hazamaStage = HazamaBridgeState.stage || "";
  }
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
  setHazamaStatus(HazamaBridgeState.pending ? "HAZAMA.PENDING" : "HAZAMA.SYNC");
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

function applyPendingHazamaProfileOnStart() {
  if (!HazamaBridgeState.loaded) return false;
  HazamaBridgeState.pending = false;
  for (const key of UCM_KEYS) {
    if (typeof UCM_TARGET[key] !== "number") continue;
    UCM_CUR[key] = UCM_TARGET[key];
    UCM[key] = Math.round(UCM_CUR[key]);
    syncSliderFromTarget(key);
  }
  applyHazamaProfileToEngineParams({ force: true });
  updateHazamaUiState();
  updateRuntimeUiState();
  setHazamaStatus("HAZAMA.SYNC");
  return true;
}

function importHazamaFromHash() {
  if (typeof window === "undefined" || !window.location || !window.location.hash) return false;
  const match = window.location.hash.match(/(?:^#|&)hazama=([^&]+)/);
  if (!match) return false;
  setHazamaStatus("HAZAMA.READY");
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
    if (data.type !== "hazama-profile") return;
    if (data.provider !== "music") return;
    handleHazamaPayload(data, { source: "postMessage" });
  });

  window.importHazamaProfile = importHazamaProfile;
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
  if (step % 4 !== 0) return;

  const maxStep = step === 0 ? 2.4 : 1.25;
  for (const key of UCM_KEYS) {
    UCM_CUR[key] = approachValue(UCM_CUR[key], UCM_TARGET[key], maxStep);
    UCM[key] = Math.round(UCM_CUR[key]);
  }

  try {
    applyUCMToParams();
  } catch (error) {
    console.warn("[Music] Hazama transport control failed:", error);
  }
}

function autoMixUiSyncAllowed(step) {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return false;
  return step % 4 === 0;
}

function syncAutoMixTransportControls(step) {
  if (!UCM.auto.enabled || !isPlaying || HazamaBridgeState.active) return;
  if (step % 4 !== 0) return;

  const maxStep = step === 0 ? 2.1 : 1.05;
  for (const key of UCM_KEYS) {
    UCM_CUR[key] = approachValue(UCM_CUR[key], UCM_TARGET[key], maxStep);
    UCM[key] = Math.round(UCM_CUR[key]);
  }

  try {
    applyUCMToParams();
  } catch (error) {
    console.warn("[Music] AutoMix transport control failed:", error);
  }
}

function advanceAutoMixTransport(step) {
  if (!UCM.auto.enabled || !isPlaying) return;
  if (UCM.auto.lastTransportStep === stepIndex) return;
  UCM.auto.lastTransportStep = stepIndex;

  const cycleMs = Math.max(30000, UCM.auto.cycleMs || 180000);
  const bpm = Math.max(40, Math.min(180, DJTempoState.bpm || EngineParams.bpm || 80));
  const eighthNoteMs = 30000 / bpm;
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
const MixGovernorState = {
  lowGuard: 0,
  clarity: 0.34,
  eventLoad: 0,
  lastAirCycle: -99
};
const INNER_SOURCE_FAMILY_KEYS = ["drumSkin", "pianoMemory", "voiceDust", "acidBiyon", "sub808", "reedBuzz", "chain"];
const SOURCE_DEPTH_PROFILES = [
  { name: "hazeBed", focus: "voiceDust", span: 12, weights: { voiceDust: 0.18, pianoMemory: 0.08, reedBuzz: 0.04, chain: 0.08 } },
  { name: "membrane", focus: "sub808", span: 10, weights: { sub808: 0.12, reedBuzz: 0.1, voiceDust: 0.1, chain: 0.06 } },
  { name: "memoryRefrain", focus: "pianoMemory", span: 9, weights: { pianoMemory: 0.2, chain: 0.12, voiceDust: 0.04 } },
  { name: "brokenSplice", focus: "drumSkin", span: 7, weights: { drumSkin: 0.14, chain: 0.1, acidBiyon: 0.04 } },
  { name: "ghostBody", focus: "drumSkin", span: 8, weights: { drumSkin: 0.12, sub808: 0.1, reedBuzz: 0.06, voiceDust: 0.05 } },
  { name: "chromeHymn", focus: "voiceDust", span: 11, weights: { voiceDust: 0.18, pianoMemory: 0.08, chain: 0.1 } },
  { name: "coldPulse", focus: "chain", span: 8, weights: { chain: 0.16, drumSkin: 0.08, acidBiyon: 0.06 } },
  { name: "earthBuzz", focus: "reedBuzz", span: 13, weights: { reedBuzz: 0.2, sub808: 0.07, voiceDust: 0.07, chain: 0.05 } }
];
const TimbreFamilyState = {
  drumSkin: 0.18,
  pianoMemory: 0.26,
  voiceDust: 0.2,
  acidBiyon: 0,
  sub808: 0.14,
  reedBuzz: 0.06,
  chain: 0.3,
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
  label.textContent = `${modeName} / ${WorldState.label} / ${currentPresetCharacter().label}`;
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
  const acid = AcidLockState.enabled ? clampValue(AcidLockState.intensity || 0.42, 0, 1) : 0;

  if (acid > 0.3 && (genre.techno > 0.18 || parts.creation > 0.34)) return sourceDepthProfileByName("coldPulse");
  if (hazamaMicro > 0.55 || gradient.micro > 0.58) return sourceDepthProfileByName("brokenSplice");
  if (hazamaPulse > 0.58 || gradient.ghost > 0.56) return sourceDepthProfileByName("ghostBody");
  if (hazamaBloom > 0.48 || observer > 0.62 || gradient.chrome > 0.58 || PerformancePadState.void) return sourceDepthProfileByName("chromeHymn");
  if (lowBpm && (gradient.ghost > 0.42 || depth.bed > 0.5) && GrooveState.cycle % 13 < 4) return sourceDepthProfileByName("earthBuzz");
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

  const acid = AcidLockState.enabled ? clampValue(AcidLockState.intensity || 0.36, 0, 1) : 0;
  const lowBpm = EngineParams.bpm < 82 || genre.ambient > 0.5 || parts.energy < 0.32;
  const profileWeights = profile.weights || {};
  const targets = {
    drumSkin: clampValue((profileWeights.drumSkin || 0) + genre.techno * 0.08 + genre.pressure * 0.06 + depth.pulse * 0.05 + acid * 0.05 - (lowBpm ? 0.08 : 0), 0, 1),
    pianoMemory: clampValue((profileWeights.pianoMemory || 0) + gradient.memory * 0.08 + gradient.organic * 0.05 + MotifMemoryState.strength * 0.06 + (lowBpm ? 0.05 : 0), 0, 1),
    voiceDust: clampValue((profileWeights.voiceDust || 0) + gradient.chrome * 0.07 + depth.tail * 0.06 + (HazamaBridgeState.active ? 0.03 : 0) + (lowBpm ? 0.06 : 0), 0, 1),
    acidBiyon: clampValue((profileWeights.acidBiyon || 0) + acid * 0.18 + genre.techno * 0.04 + gradient.micro * 0.04 - parts.voidness * 0.08, 0, 1),
    sub808: clampValue((profileWeights.sub808 || 0) + gradient.ghost * 0.06 + parts.body * 0.05 + acid * 0.04 - MixGovernorState.lowGuard * 0.12 - (lowBpm ? 0.04 : 0), 0, 1),
    reedBuzz: clampValue((profileWeights.reedBuzz || 0) + gradient.ghost * 0.06 + depth.bed * 0.05 + parts.body * 0.04 + (HazamaBridgeState.active ? 0.025 : 0) + (lowBpm ? 0.08 : 0) - acid * 0.04 - MixGovernorState.lowGuard * 0.08, 0, 1),
    chain: clampValue((profileWeights.chain || 0) + GenomeState.growth * 0.05 + BpmCrossfadeState.refrain * 0.05 + gradient.organic * 0.05 + (UCM.auto.enabled || HazamaBridgeState.active ? 0.04 : 0), 0, 1)
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
  const acid = AcidLockState.enabled ? clampValue(AcidLockState.intensity || 0.36, 0, 1) : clampValue(AcidLockState.intensity || 0, 0, 1) * 0.18;
  const autoDrive = UCM.auto.enabled || HazamaBridgeState.active ? 1 : 0;
  const motif = MotifMemoryState.strength || 0;
  const genome = clampValue(GenomeState.growth * 0.42 + GenomeState.resonance * 0.28, 0, 1);
  const refrain = clampValue(BpmCrossfadeState.refrain + VoiceEmergenceState.refrain * 0.5, 0, 1);
  const lowGuard = MixGovernorState.lowGuard;
  const inner = updateInnerSourceFamily(parts, gradient, depth, genre);
  const innerLift = 0.035 + (inner.bloom || 0) * 0.035;

  const drumTarget = clampValue(
    genre.techno * 0.3 +
      genre.pressure * 0.22 +
      depth.pulse * 0.18 +
      resource * 0.12 +
      creation * 0.08 +
      hazamaPulse * 0.08 +
      acid * 0.12 -
      genre.ambient * 0.12 -
      voidness * 0.14 +
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
      hazamaBloom * 0.08 -
      pressure * 0.08 -
      genre.techno * 0.08 +
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
      hazamaAir * 0.12 +
      observer * 0.08 +
      voidness * 0.06 -
      genre.pressure * 0.08 +
      (inner.voiceDust || 0) * innerLift +
      (inner.focus === "voiceDust" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const acidTarget = clampValue(
    acid * 0.58 +
      (AcidLockState.enabled ? 0.18 : 0) +
      genre.techno * 0.12 +
      genre.pressure * 0.1 +
      gradient.micro * 0.08 +
      creation * 0.07 +
      resource * 0.05 -
      voidness * 0.18 -
      lowGuard * 0.14 +
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
      hazamaPulse * 0.08 +
      acid * 0.18 +
      PerformancePadState.punch * 0.1 -
      voidness * 0.18 -
      lowGuard * 0.2 +
      (inner.sub808 || 0) * innerLift +
      (inner.focus === "sub808" ? (inner.bloom || 0) * 0.02 : 0),
    0,
    1
  );
  const reedTarget = clampValue(
    gradient.ghost * 0.18 +
      depth.bed * 0.15 +
      depth.tail * 0.1 +
      body * 0.1 +
      hazamaAir * 0.08 +
      hazamaBloom * 0.05 +
      (EngineParams.bpm < 84 ? 0.08 : 0) -
      acid * 0.08 -
      lowGuard * 0.16 +
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
      autoDrive * 0.07 +
      hazamaMicro * 0.06 +
      energy * 0.04 +
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

  TimbreState.air = clampValue((ethereal * 0.56) + (observer * 0.2) + (voidness * 0.16) + ((1 - resource) * 0.08) + (gradient.haze * 0.055) + (gradient.chrome * 0.035) + (depth.tail * 0.04) + genre.ambient * 0.05 - genre.techno * 0.025 + clarity * 0.028 + voiceHaze * 0.024 + voiceVoidTail * 0.026 + character.air, 0, 1);
  TimbreState.glass = clampValue((wave * 0.28) + (observer * 0.24) + (circle * 0.2) + (creation * 0.16) + (TimbreState.air * 0.12) + (gradient.chrome * 0.055) + (gradient.memory * 0.032) + (depth.particle * 0.038) + genre.idm * 0.035 + clarity * 0.035 + voiceChrome * 0.028 + voiceMicro * 0.014 + character.glass, 0, 1);
  TimbreState.grit = clampValue((pressure * 0.48) + (resource * 0.22) + (body * 0.16) + (energy * 0.14) + (gradient.ghost * 0.032) + (gradient.micro * 0.022) + genre.techno * 0.04 + genre.pressure * 0.035 + voicePressure * 0.018 - voiceHaze * 0.012 - (gradient.haze * 0.035) - (depth.lowMidClean * 0.036) - lowGuard * 0.035 + character.grit, 0, 1);
  TimbreState.fracture = clampValue((creation * 0.32) + (wave * 0.24) + (resource * 0.2) + (WorldState.spectrum * 0.24) + (gradient.micro * 0.06) + (gradient.organic * 0.025) + (depth.particle * 0.035) + genre.idm * 0.045 + genre.techno * 0.035 + voiceMicro * 0.03 + voicePressure * 0.012 + character.fracture, 0, 1);
  TimbreState.harp = clampValue((TimbreState.glass * 0.46) + (TimbreState.air * 0.24) + (circle * 0.18) + ((1 - TimbreState.grit) * 0.12) + (gradient.chrome * 0.05) + (gradient.memory * 0.035) + (depth.tail * 0.032) + genre.ambient * 0.03 + genre.idm * 0.02 - genre.techno * 0.035 + voiceChrome * 0.028 + voiceRefrain * 0.012 + (character.harp || 0), 0, 1);
  TimbreState.warmth = clampValue((circle * 0.22) + (body * 0.16) + (resource * 0.16) + ((1 - TimbreState.fracture) * 0.18) + ((1 - pressure) * 0.08) + (gradient.memory * 0.045) + (gradient.organic * 0.025) + (depth.bed * 0.026) + genre.ambient * 0.025 - genre.techno * 0.035 - (depth.lowMidClean * 0.018) + voiceOrganic * 0.018 + voicePulse * 0.006 - voicePressure * 0.01 + (character.warmth || 0), 0, 1);

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
  EngineParams.restProb = clampValue(EngineParams.restProb * character.restScale + genre.ambient * 0.035 - genre.techno * 0.035, 0.035, PerformancePadState.void ? 0.58 : 0.46);
  EngineParams.kickProb = clampValue(EngineParams.kickProb * character.kickScale + genre.pressure * 0.024 - genre.ambient * 0.018, PerformancePadState.void ? 0.06 : 0.11, 0.7);
  EngineParams.hatProb = clampValue(EngineParams.hatProb * character.hatScale + genre.techno * 0.11 + genre.idm * 0.035 - genre.ambient * 0.05, PerformancePadState.void ? 0.11 : 0.18, 0.86);
  EngineParams.bassProb = clampValue(EngineParams.bassProb * character.bassScale + genre.pressure * 0.018 - genre.ambient * 0.018, PerformancePadState.void ? 0.05 : 0.09, 0.48);
  EngineParams.padProb = clampValue(EngineParams.padProb * character.padScale * (character.hazeScale || 1) + genre.ambient * 0.055 - genre.techno * 0.045, PerformancePadState.void ? 0.15 : 0.16, 0.58);
  if (droneZone) {
    const droneAmount = clampValue((84 - EngineParams.bpm) / 34 + (0.34 - energyNorm) + genre.ambient * 0.62 + voidNorm * 0.18, 0, 1);
    EngineParams.restProb = clampValue(EngineParams.restProb + droneAmount * 0.08, 0.06, 0.58);
    EngineParams.kickProb = clampValue(EngineParams.kickProb * (0.08 + (1 - droneAmount) * 0.24), 0.004, 0.16);
    EngineParams.hatProb = clampValue(EngineParams.hatProb * (0.18 + (1 - droneAmount) * 0.34), 0.015, 0.22);
    EngineParams.bassProb = clampValue(EngineParams.bassProb * (0.34 + (1 - droneAmount) * 0.28), 0.025, 0.22);
    EngineParams.padProb = clampValue(EngineParams.padProb + droneAmount * 0.15, 0.24, 0.68);
  }

  // リバーブ/ディレイ量を少しだけ動かす（軽量）
  const reverbWet = clampValue(
    mapValue(UCM_CUR.observer + UCM_CUR.void * 0.35, 0, 135, 0.14, 0.46) +
      DepthState.tail * 0.035 +
      DepthState.bed * 0.018 +
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
  resetDJTempo();
  resetGenerativeGenome();
  resetAutoVoiceMorph();
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
  const phraseStep = GrooveState.cycle % 4;
  const density = (energyNorm + creationNorm + resourceNorm) / 3;
  const fillChance = mapValue(density, 0, 1, 0.04, 0.30);
  advanceLongformArcPhrase({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm: clampValue(UCM_CUR.void / 100, 0, 1), circleNorm: clampValue(UCM_CUR.circle / 100, 0, 1) });
  advanceOrganicEcosystemPhrase({ energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm: clampValue(UCM_CUR.void / 100, 0, 1), circleNorm: clampValue(UCM_CUR.circle / 100, 0, 1) });
  updateBpmCrossfadeMemory(currentGradientParts());
  advanceAutoVoiceMorphPhrase();
  advanceVoiceEmergencePhrase();
  updateGenerativeGenome(currentGradientParts());

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
  AcidLockState.intensity = approachValue(AcidLockState.intensity, AcidLockState.enabled ? 1 : 0, 0.018);
  if (AcidLockState.intensity < 0.08) return;

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
      voiceGeneBias("pressure") * 0.14 -
      voidNorm * 0.24 -
      lowGuard * 0.26,
    0,
    1
  ) * AcidLockState.intensity;
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
  if (!gate || !rand(0.016 + amount * 0.078 + state.splice * 0.028 + AcidLockState.intensity * 0.018)) return;

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
  const acid = clampValue(AcidLockState.intensity || 0, 0, 1);
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
  const lowGuard = MixGovernorState.lowGuard;
  const eventLoad = MixGovernorState.eventLoad;
  if (eventLoad > 0.94 && !PerformancePadState.void) return;

  const inner = TimbreFamilyState.inner || {};
  const phaseOffset = Math.floor((GenomeState.phase || 0) * 8) + TonalRhymeState.stepOffset + (inner.generation || 0);
  const chain = clampValue(family.chain + (inner.chain || 0) * 0.08 + MotifMemoryState.strength * 0.18 + (HazamaBridgeState.active ? 0.08 : 0), 0, 1);
  const droneThin = EngineParams.bpm < 84 || energyNorm < 0.32 || genre.ambient > 0.46;
  const acidOn = AcidLockState.enabled && family.acidBiyon > 0.18 && PerformancePadState.void < 0.5;
  const phraseTurn = step % 16 === 0 || step % 16 === 8;
  const offPulse = step % 16 === 3 || step % 16 === 6 || step % 16 === 11 || step % 16 === 14;
  const driftedTime = time + Math.random() * (0.01 + waveNorm * 0.018 + PerformancePadState.drift * 0.018);
  const chromeHymn = clampValue(gradient.chrome * 0.28 + gradient.haze * 0.18 + depth.tail * 0.18 + observerNorm * 0.12 + family.voiceDust * 0.1 + chain * 0.08, 0, 1);
  const brokenLogic = clampValue(gradient.micro * 0.26 + genre.idm * 0.18 + family.drumSkin * 0.12 + family.acidBiyon * 0.12 + BpmCrossfadeState.refrain * 0.1 + PerformancePadState.repeat * 0.12, 0, 1);
  const ghostBody = clampValue(gradient.ghost * 0.24 + depth.pulse * 0.18 + family.sub808 * 0.16 + genre.pressure * 0.12 + PerformancePadState.punch * 0.12 - lowGuard * 0.16, 0, 1);
  const coldPulse = clampValue(genre.techno * 0.18 + genre.idm * 0.12 + gradient.micro * 0.12 + depth.gesture * 0.12 + family.chain * 0.1 + AcidLockState.intensity * 0.12 - genre.ambient * 0.08, 0, 1);
  const earthBuzz = clampValue(family.reedBuzz * 0.34 + (inner.reedBuzz || 0) * 0.18 + gradient.ghost * 0.16 + depth.bed * 0.14 + (droneThin ? 0.1 : 0) - lowGuard * 0.18 - acidOn * 0.06, 0, 1);

  if (pianoMemory && (step % 16 === 4 || step % 16 === 10 || (PerformancePadState.drift && step % 4 === 1) || (chain > 0.52 && step % 8 === 5))) {
    const pianoChance = chance(0.014 + family.pianoMemory * 0.15 + chain * 0.04 + PerformancePadState.drift * 0.055 - eventLoad * 0.04);
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
    const voiceChance = chance(0.012 + family.voiceDust * 0.13 + depth.tail * 0.035 + PerformancePadState.void * 0.05 + (HazamaBridgeState.active ? 0.022 : 0) - genre.pressure * 0.02);
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
    const drumChance = chance((0.01 + family.drumSkin * 0.16 + genre.techno * 0.035 + PerformancePadState.repeat * 0.05 + (acidOn ? 0.035 : 0) - eventLoad * 0.035) * (droneThin ? 0.42 : 1));
    if (rand(drumChance)) {
      try {
        drumSkin.triggerAttackRelease("64n", time + 0.008 + Math.random() * 0.012, clampValue(0.018 + family.drumSkin * 0.074 + creationNorm * 0.018 + (acidOn ? 0.024 : 0), 0.014, 0.13));
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
    const subChance = chance(0.018 + family.sub808 * 0.14 + family.acidBiyon * 0.08 + PerformancePadState.punch * 0.08 - lowGuard * 0.14);
    if (rand(subChance)) {
      const note = tonalRhymeSub(step, phaseOffset + (phraseTurn ? 0 : 2));
      const dur = acidOn || PerformancePadState.punch ? "16n" : "8n";
      const vel = clampValue(0.036 + family.sub808 * 0.12 + family.acidBiyon * 0.054 + PerformancePadState.punch * 0.03 - lowGuard * 0.05, 0.028, acidOn ? 0.24 : 0.17);
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
    const buzzChance = chance(0.012 + earthBuzz * 0.12 + (HazamaBridgeState.active ? 0.018 : 0) + PerformancePadState.void * 0.035 - eventLoad * 0.035);
    if (rand(buzzChance)) {
      const buzzNote = rand(0.58 + gradient.ghost * 0.14)
        ? tonalRhymeLow(step, phaseOffset - 1)
        : tonalRhymeSub(step, phaseOffset + 1);
      const buzzTime = time + 0.032 + Math.random() * (0.024 + waveNorm * 0.016);
      const vel = clampValue(0.018 + earthBuzz * 0.07 - lowGuard * 0.026, 0.014, 0.098);
      try {
        reedBuzz.triggerAttackRelease(buzzNote, PerformancePadState.void ? "1n" : "2n", buzzTime, vel);
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
    const acidChance = chance(0.12 + family.acidBiyon * 0.34 + resourceNorm * 0.05 + PerformancePadState.repeat * 0.05 - lowGuard * 0.12);
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
    const pulseChance = chance(0.012 + coldPulse * 0.12 + brokenLogic * 0.04 - eventLoad * 0.04);
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

  const phraseGate = step % 16 === 0 || step % 16 === 4 || step % 16 === 8 || step % 16 === 12 || isAccentStep;
  const gateChance = chance(
    0.02 +
      blend * 0.1 +
      refrain * 0.12 +
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
      if (reedBuzz && membrane > 0.42 && lowGuard < 0.58 && rand(0.08 + membrane * 0.1)) {
        reedBuzz.triggerAttackRelease(lowNote, "2n", time + 0.088 + Math.random() * 0.032, clampValue(0.012 + membrane * 0.038, 0.01, 0.048));
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

  if (PerformancePadState.drift && (step % 8 === 1 || step % 8 === 5)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle) % TRANSPARENT_AIR_FRAGMENTS.length];
    const liftNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
    const pluckNote = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 5) % ORGANIC_PLUCK_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, genre.techno > 0.34 ? "64n" : "32n", time + 0.018 + waveNorm * 0.02, clampValue(0.034 + observerNorm * 0.038 + creationNorm * 0.016 + genre.idm * 0.012 + gradient.chrome * 0.006, 0.028, 0.106));
      glass.triggerAttackRelease(liftNote, "64n", time + 0.058 + waveNorm * 0.018 + genre.ambient * 0.012, clampValue(0.02 + observerNorm * 0.026 + genre.idm * 0.01 + gradient.memory * 0.006, 0.018, 0.074));
      glass.triggerAttackRelease(pluckNote, "64n", time + 0.118 + waveNorm * 0.014, clampValue(0.018 + observerNorm * 0.024 + gradient.haze * 0.004, 0.016, 0.062));
      texture.triggerAttackRelease("64n", time + 0.026, clampValue(0.026 + waveNorm * 0.034, 0.022, 0.074));
    } catch (error) {
      console.warn("[Music] drift hold failed:", error);
    }
  }

  if (PerformancePadState.repeat && (step % 8 === 2 || step % 8 === 6)) {
    const note = GLASS_NOTES[(step + GrooveState.cycle) % GLASS_NOTES.length];
    const chipNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 1) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "64n", time + 0.012, clampValue(0.044 + energyNorm * 0.036 + genre.idm * 0.018 + genre.techno * 0.014 + gradient.micro * 0.008, 0.038, 0.112));
      glass.triggerAttackRelease(note, "64n", time + 0.048, clampValue(0.032 + energyNorm * 0.028 + genre.techno * 0.012 + gradient.micro * 0.006, 0.026, 0.086));
      glass.triggerAttackRelease(chipNote, "64n", time + 0.082, clampValue(0.018 + observerNorm * 0.024 + genre.idm * 0.008 + gradient.organic * 0.006, 0.016, 0.068));
      if (genre.techno > 0.35 && rand(0.28 + genre.techno * 0.22)) {
        glass.triggerAttackRelease(note, "64n", time + 0.116, clampValue(0.016 + genre.techno * 0.034, 0.014, 0.058));
      }
      if (step % 8 === 6) hat.triggerAttackRelease("64n", time + 0.034, clampValue(0.042 + energyNorm * 0.038 + genre.techno * 0.026, 0.034, 0.116));
    } catch (error) {
      console.warn("[Music] repeat hold failed:", error);
    }
  }

  if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep)) {
    try {
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), "16n", time + 0.006, clampValue(0.2 + energyNorm * 0.08 + genre.pressure * 0.032, 0.16, 0.36));
      if (step % 8 === 0) {
        bass.triggerAttackRelease(tonalRhymeSub(step, 1), "32n", time + 0.028, clampValue(0.07 + energyNorm * 0.045, 0.06, 0.14));
      }
      glass.triggerAttackRelease(ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 2) % ORGANIC_PLUCK_FRAGMENTS.length], "64n", time + 0.036, clampValue(0.032 + creationNorm * 0.03 + gradient.organic * 0.008, 0.026, 0.088));
      texture.triggerAttackRelease("64n", time + 0.018, clampValue(0.062 + creationNorm * 0.044 + genre.pressure * 0.024 + genre.techno * 0.012 + gradient.ghost * 0.01, 0.05, 0.136));
    } catch (error) {
      console.warn("[Music] punch hold failed:", error);
    }
  }

  if (PerformancePadState.void && (step % 8 === 4 || step % 8 === 7)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 2) % TRANSPARENT_AIR_FRAGMENTS.length];
    const tailNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 5) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "16n", time + 0.022, clampValue(0.034 + observerNorm * 0.042 + genre.techno * 0.01 + gradient.chrome * 0.008, 0.03, 0.104));
      glass.triggerAttackRelease(tailNote, "32n", time + 0.112, clampValue(0.022 + observerNorm * 0.032 + gradient.haze * 0.006, 0.02, 0.074));
      if (step % 8 === 4) {
        pad.triggerAttackRelease(randomHazeChord(), "2n", time + 0.04, clampValue(0.03 + observerNorm * 0.026 + gradient.haze * 0.006, 0.026, 0.07));
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
  decayVoiceMorph();

  // 休符判定
  const genre = GenreBlendState;
  const isRest = rand(clampValue(EngineParams.restProb + genre.ambient * 0.045 - genre.techno * 0.05 - genre.pressure * 0.025 + PerformancePadState.void * 0.18 - PerformancePadState.punch * 0.06, 0.018, PerformancePadState.void ? 0.6 : 0.48));
  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resourceNorm = clampValue(UCM_CUR.resource / 100, 0, 1);
  const waveNorm = clampValue(UCM_CUR.wave / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const voidNorm = clampValue(UCM_CUR.void / 100, 0, 1);
  const circleNorm = clampValue(UCM_CUR.circle / 100, 0, 1);
  const isAccentStep = step === GrooveState.accentStep || (GrooveState.fillActive && (step % 4 === 3 || step % 8 === 6));
  const chaos = organicChaosAmount();
  const grooveJitter = (step % 2 === 1 ? mapValue(waveNorm, 0, 1, 0, 0.014 + PerformancePadState.drift * 0.026 + chaos * 0.012) * GrooveState.microJitterScale : 0);
  const fillBoost = GrooveState.fillActive ? 0.14 : 0;
  const t = time + grooveJitter;
  const stepContext = { energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm, isRest, isAccentStep };
  const gradientParts = currentGradientParts();
  const gradient = updateReferenceGradient(gradientParts);
  updateReferenceDepth(gradientParts, gradient);
  updateTimbreFamilyBlend(gradientParts, gradient, DepthState, genre);
  const lowGuard = MixGovernorState.lowGuard;
  const clarity = MixGovernorState.clarity;
  const voiceMicro = voiceGeneBias("micro");
  const voiceChrome = voiceGeneBias("chrome");
  const voiceOrganic = voiceGeneBias("organic");
  const voiceVoidTail = voiceGeneBias("voidTail");
  const voicePulse = voiceGeneBias("pulse");
  const voiceRefrain = voiceGeneBias("refrain");
  maybeTriggerAutoPerformanceGesture(step, stepContext);
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
  triggerLowMotion(step, t, stepContext);
  triggerAcidTechnoTrace(step, t, stepContext);
  triggerPadHoldMinimums(step, t, stepContext);

  if (!isRest) {
    const droneDrumThin = EngineParams.bpm < 84 || energyNorm < 0.3 || genre.ambient > 0.44;
    const droneDrumScale = droneDrumThin ? clampValue(0.12 + (energyNorm * 0.56) + genre.techno * 0.28, 0.08, 0.5) : 1;
    // Kick
    const kickChance = chance((EngineParams.kickProb + (isAccentStep ? 0.024 : 0) + genre.pressure * 0.024 + PerformancePadState.punch * 0.055 - PerformancePadState.void * 0.14) * (1 - lowGuard * 0.14) * droneDrumScale);
    if (patternAt(EngineParams.kickPattern, step) && rand(kickChance)) {
      kick.triggerAttackRelease(tonalRhymeLow(step, -1), "16n", t + 0.004, clampValue(0.32 + energyNorm * 0.072 + genre.pressure * 0.02 + (isAccentStep ? 0.014 : 0) + PerformancePadState.punch * 0.026 - lowGuard * 0.04, 0.18, droneDrumThin ? 0.32 : 0.5));
      if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep) && rand(0.46)) {
        try {
          texture.triggerAttackRelease("64n", t + 0.012, clampValue(0.05 + energyNorm * 0.064, 0.038, 0.118));
        } catch (error) {
          console.warn("[Music] punch transient failed:", error);
        }
      }
    }

    // Hat
    const hatChance = chance((EngineParams.hatProb + fillBoost + genre.techno * 0.12 + genre.idm * 0.045 + (isAccentStep ? 0.08 : 0) - genre.ambient * 0.045 - PerformancePadState.void * 0.1) * (droneDrumThin ? 0.42 : 1));
    if ((patternAt(EngineParams.hatPattern, step) || (GrooveState.fillActive && step % 4 === 2)) && rand(hatChance)) {
      hat.triggerAttackRelease("32n", t, clampValue(0.086 + energyNorm * 0.108 + genre.techno * 0.038 + (isAccentStep ? 0.04 : 0), 0.054, 0.23));
    }
    if (genre.techno > 0.28 && !PerformancePadState.void && (step % 4 === 1 || step % 4 === 3) && rand(0.06 + genre.techno * 0.16 + genre.idm * 0.04)) {
      try {
        hat.triggerAttackRelease("64n", t + 0.012 + Math.random() * 0.012, clampValue(0.034 + genre.techno * 0.058 + energyNorm * 0.028, 0.03, 0.12));
        markMixEvent(0.05);
      } catch (error) {
        console.warn("[Music] techno grid hat failed:", error);
      }
    }
    if (PerformancePadState.repeat && (step % 4 === 2 || isAccentStep || step % 8 === 5) && rand(0.68)) {
      try {
        hat.triggerAttackRelease("64n", t + 0.018, clampValue(0.06 + energyNorm * 0.075, 0.045, 0.14));
        if (rand(0.38)) hat.triggerAttackRelease("64n", t + 0.036, clampValue(0.045 + energyNorm * 0.055, 0.035, 0.11));
      } catch (error) {
        console.warn("[Music] repeat hat failed:", error);
      }
    }

    // Bass
    const bassChance = chance((EngineParams.bassProb + genre.pressure * 0.018 + (GrooveState.fillActive && step % 8 === 6 ? 0.07 : 0) - PerformancePadState.void * 0.14) * (1 - lowGuard * 0.16) * (droneDrumThin ? 0.58 : 1));
    if (patternAt(EngineParams.bassPattern, step) && rand(bassChance)) {
      const note = step % 8 === 0 ? bassRoot : bassNoteForStep(step);
      bass.triggerAttackRelease(note, "8n", t + 0.004, clampValue(0.19 + energyNorm * 0.092 + PerformancePadState.punch * 0.02 - lowGuard * 0.024, 0.12, 0.33));
      if (PerformancePadState.repeat && step % 8 === 0 && rand(0.1)) {
        try {
          bass.triggerAttackRelease(note, "32n", t + 0.04, clampValue(0.08 + energyNorm * 0.04, 0.06, 0.14));
        } catch (error) {
          console.warn("[Music] repeat bass failed:", error);
        }
      }
    }

    // Pad（ゆっくり）
    if (patternAt(EngineParams.padPattern, step) && rand(EngineParams.padProb)) {
      const dur = EngineParams.mode === "ambient" || EngineParams.mode === "lofi" ? "2n" : "4n";
      const chord = rand(0.38 + observerNorm * 0.22 + gradient.haze * 0.12 + gradient.chrome * 0.06 + PerformancePadState.void * 0.16) ? randomHazeChord() : randomChordForMode();
      pad.triggerAttackRelease(chord, dur, t, clampValue(0.052 + circleNorm * 0.056 + observerNorm * 0.018 + gradient.haze * 0.006, 0.046, 0.132));
    }
  }

  const textureProb = chance(mapValue(UCM_CUR.creation + UCM_CUR.resource, 0, 200, 0.024, 0.19) + GrooveState.textureLift + genre.techno * 0.042 + genre.idm * 0.018 + gradient.micro * 0.014 + gradient.ghost * 0.006 + DepthState.particle * 0.016 + DepthState.gesture * 0.01 + voiceMicro * 0.01 + voicePulse * 0.006 + PerformancePadState.drift * 0.086 - genre.ambient * 0.018 - PerformancePadState.void * 0.01);
  if (rand(textureProb) && (step % 2 === 1 || isAccentStep)) {
    const textureTime = t + (isAccentStep ? 0.006 : 0.012);
    texture.triggerAttackRelease("32n", textureTime, clampValue(0.028 + creationNorm * 0.088 + resourceNorm * 0.024 + gradient.micro * 0.006 + DepthState.gesture * 0.012 + PerformancePadState.punch * 0.014, 0.02, 0.13));
  }

  const particleProb = chance(0.03 + creationNorm * 0.034 + waveNorm * 0.024 + observerNorm * 0.022 + genre.idm * 0.034 + genre.techno * 0.018 + gradient.chrome * 0.014 + gradient.micro * 0.01 + DepthState.particle * 0.022 + clarity * 0.018 + voiceChrome * 0.011 + voiceOrganic * 0.008 + voiceRefrain * 0.006 + PerformancePadState.drift * 0.104 + PerformancePadState.repeat * 0.056 + PerformancePadState.void * 0.06 - genre.ambient * 0.012);
  if (rand(particleProb) && (step % 4 === 1 || step % 8 === 5 || isAccentStep)) {
    const note = voiceFragment(Math.floor(Math.random() * FIELD_MURK_FRAGMENTS.length), FIELD_MURK_FRAGMENTS);
    try {
      glass.triggerAttackRelease(note, "32n", t + 0.019 + Math.random() * 0.018, clampValue(0.026 + creationNorm * 0.038 + gradient.micro * 0.008 + DepthState.particle * 0.008 + clarity * 0.008 + PerformancePadState.repeat * 0.038 + PerformancePadState.void * 0.018, 0.018, 0.112));
    } catch (error) {
      console.warn("[Music] field particle failed:", error);
    }
  }

  const airProb = chance(0.03 + observerNorm * 0.046 + circleNorm * 0.021 + gradient.chrome * 0.016 + gradient.haze * 0.009 + DepthState.tail * 0.026 + voiceChrome * 0.012 + voiceVoidTail * 0.016 + PerformancePadState.void * 0.14 + PerformancePadState.drift * 0.066 + PerformancePadState.repeat * 0.022);
  if (rand(airProb) && (step % 8 === 4 || step % 8 === 7)) {
    const note = voiceFragment(Math.floor(Math.random() * TRANSPARENT_AIR_FRAGMENTS.length), TRANSPARENT_AIR_FRAGMENTS);
    try {
      glass.triggerAttackRelease(note, "32n", t + 0.024, clampValue(0.02 + observerNorm * 0.042 + gradient.chrome * 0.008 + DepthState.tail * 0.008 + PerformancePadState.void * 0.025 + PerformancePadState.repeat * 0.012, 0.014, 0.095));
    } catch (error) {
      console.warn("[Music] transparent air failed:", error);
    }
  }

  const glassProb = chance(mapValue(UCM_CUR.mind + UCM_CUR.creation, 0, 200, 0.022, 0.145) + GrooveState.glassLift + genre.idm * 0.028 + genre.techno * 0.014 + gradient.memory * 0.012 + gradient.chrome * 0.013 + gradient.micro * 0.009 + DepthState.particle * 0.016 + DepthState.gesture * 0.01 + voiceChrome * 0.012 + voiceRefrain * 0.008 + PerformancePadState.drift * 0.088 + PerformancePadState.repeat * 0.068 + PerformancePadState.void * 0.038 - genre.ambient * 0.01);
  if (rand(glassProb) && (isAccentStep || step % 8 === 3 || step % 16 === 11)) {
    const note = voiceFragment(Math.floor(Math.random() * GLASS_NOTES.length), GLASS_NOTES);
    glass.triggerAttackRelease(note, "16n", t + 0.015, clampValue(0.039 + energyNorm * 0.055 + observerNorm * 0.018 + PerformancePadState.void * 0.014, 0.028, 0.124));
    if (PerformancePadState.repeat && rand(0.72)) {
      try {
        glass.triggerAttackRelease(note, "32n", t + 0.024, clampValue(0.032 + energyNorm * 0.052, 0.024, 0.092));
        if (rand(0.32)) glass.triggerAttackRelease(note, "64n", t + 0.04, clampValue(0.022 + energyNorm * 0.038, 0.018, 0.068));
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
    const desired = clampValue(profile.base + directorBias + arcBias + profile.depth * (wave + ripple), 4, 96);
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

  if (btnStart) {
    btnStart.onclick = async () => {
      if (isStarting) return;
      isStarting = true;

      try {
        await Tone.start();
        await resumeAudioContext("start");

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
          if (statusText) statusText.textContent = "Playing…";
        }
        updateRuntimeUiState();

        if (autoToggle && autoToggle.checked) {
          startAutoCycle();
        }
        setupMediaSessionControls();
        updateMediaSessionPlaybackState();
        await startBackgroundAudioBridge();
        requestPlaybackWakeLock();
  renderModeLabel();
      } catch (error) {
        console.warn("[Music] start failed:", error);
        isPlaying = false;
        updateRuntimeUiState();
        releaseAllVoices();
        if (statusText) statusText.textContent = "Start failed";
      } finally {
        isStarting = false;
      }
    };
  }

  if (btnStop) {
    btnStop.onclick = () => {
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
      updateRuntimeUiState();
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
      if (PlaybackState.iosSafariBridgePreferred && !PlaybackState.backgroundBridgeActive) {
        startBackgroundAudioBridge();
      }
      requestPlaybackWakeLock();
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
