/* Test-only classic-script fixture for check-music-satellite-contract.mjs.
   It models the engine.js global lexical seam without importing or executing engine.js.
   No real Tone node, MediaRecorder stream, timer, storage, network, or audio is used. */

const clampValue = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
let isPlaying = true;
const focusModGain = { gain: { value: 1 } };
const recorderDestination = { stream: window.__contract.stream };
const RecorderState = window.MusicRecorder.state;
const setRecorderStatus = window.MusicRecorder.setStatus;

const UCM = { auto: { enabled: false } };
const UCM_CUR = {
  energy: 35,
  wave: 42,
  mind: 51,
  creation: 46,
  void: 62,
  circle: 58,
  body: 28,
  resource: 24,
  observer: 64
};
const EngineParams = { mode: "ambient", bpm: 96 };
const OutputState = { level: 72 };
const MixGovernorState = { eventLoad: 0.18 };
const ProducerHabitState = { curiosity: 0.22 };
const RdjGrowthState = { tender: 0.3 };
const GradientState = {
  haze: 0.58,
  memory: 0.52,
  micro: 0.2,
  ghost: 0.18,
  chrome: 0.32,
  organic: 0.46
};
const HazamaBridgeState = {
  loaded: true,
  active: true,
  autoFollow: true,
  controlAction: "play",
  name: "contract-hazama",
  stage: "test",
  depthId: "middle",
  lastError: "",
  controlPending: false
};
const MusicRadioBrainState = { active: "quietPiano" };

function currentGradientParts() {
  return {
    energy: 0.28,
    resource: 0.2,
    creation: 0.34,
    body: 0.18,
    voidness: 0.64,
    circle: 0.62,
    observer: 0.7,
    wave: 0.42
  };
}

function genreTimbreKitRuntimeState() {
  return {
    technoKit: 0.08,
    pressureKit: 0.06,
    spaceKit: 0.58,
    ambientKit: 0.72,
    idmKit: 0.12
  };
}

function activePerformancePadNames() {
  return ["void"];
}

function albumArcActive() {
  return false;
}

function currentAlbumArcChapter() {
  return null;
}

function dominantReferenceMorphStyle() {
  return "haze";
}

function musicSelfReviewRuntimeState() {
  return {
    densityRisk: 0.18,
    lowEndRisk: 0.12,
    brightnessRisk: 0.16,
    restraintScore: 0.82,
    referenceFit: 0.74,
    nextSuggestion: "keep-space"
  };
}

function musicRadioBrainPacketState() {
  return { program: "quietPiano", metadata_only: true };
}

const hazamaFmReviewCue = window.MusicStackRoutes.reviewCue;

function musicStackRoutingRecommendation(input = {}) {
  return window.MusicStackRoutes.routingRecommendation({
    ...input,
    selfReview: input.selfReview || musicSelfReviewRuntimeState(),
    parts: input.parts || currentGradientParts(),
    gradient: input.gradient || GradientState,
    kits: input.kits || genreTimbreKitRuntimeState(),
    activePads: input.activePads || activePerformancePadNames(),
    producerHabitCuriosity: input.producerHabitCuriosity == null
      ? ProducerHabitState.curiosity
      : input.producerHabitCuriosity
  });
}

function isManualPerformanceInfluenceActive() {
  return false;
}

function micFollowPacketState() {
  return {
    enabled: false,
    status: "fixture",
    metadata_only: true,
    stores_audio: false
  };
}

function makeMusicSessionId() {
  const value = arguments[0];
  window.__contract.makeMusicSessionIdCalls.push(
    value instanceof Date ? value.toISOString() : String(value)
  );
  return "music-contract-session";
}

function promotionTargetFromDestination(destination) {
  window.__contract.promotionTargetCalls.push(destination);
  const map = {
    music: "Music",
    drum_floor: "drum-floor",
    namima: "namima",
    chill: "chill",
    openclaw: "OpenClaw"
  };
  return map[destination] || "OpenClaw";
}

function updateMusicStackSyncHelp(route, result) {
  window.__contract.syncHelpCalls.push({
    destination: route && route.destination,
    stored: !!(result && result.stored),
    broadcast: !!(result && result.broadcast)
  });
}

function hazamaFmEngineMix() {
  return {
    genre: "ambient",
    engineGain: 0.72,
    padDb: -18,
    glassDb: -24,
    pianoMemoryDb: -20,
    reverbWet: 0.28,
    delayWet: 0.12
  };
}

window.GenreFlavor = {
  state: {
    started: true,
    genre: "ambient",
    source: "fixture",
    scheduled: 4,
    role: "space",
    edge: "soft",
    feedback: "keep-air"
  }
};
window.HazamaFmListeningTrace = {
  snapshot: () => ({
    current_genre: "ambient",
    current_energy: "low",
    bpm: 96,
    dwell_ms_by_genre: { ambient: 4200 }
  })
};
window.HazamaFlavorState = {
  conversation: {
    version: 1,
    bar: 8,
    role: "space",
    motif: "neighbor",
    transform: "as-is",
    densityBias: 0.2,
    restGate: 0.7
  }
};

window.MusicSessionPacket = {
  build: window.MusicPacketKit.buildMusicSessionPacket,
  sync: window.MusicPacketKit.syncMusicSessionPacket,
  download: window.MusicPacketKit.downloadMusicSessionPacket,
  last: null,
  lastSync: null
};
window.MusicOrchestraPacket = {
  build: window.MusicPacketKit.buildMusicOrchestraPacket,
  sync: window.MusicPacketKit.syncMusicOrchestraPacket,
  download: window.MusicPacketKit.downloadMusicOrchestraPacket,
  last: null,
  lastSync: null
};

const TimbreFamilyState = {
  voiceDust: 0.32,
  pianoMemory: 0.44,
  chain: 0.18,
  drumSkin: 0.2,
  sub808: 0.24,
  acidBiyon: 0.12,
  reedBuzz: 0.08,
  inner: { profile: "memoryRefrain" }
};
const DepthState = { bed: 0.42, tail: 0.36 };
const MotifMemoryState = { strength: 0.48 };
const GenreBlendState = {
  ambient: 0.74,
  idm: 0.12,
  techno: 0.08,
  pressure: 0.06
};
const CultureGrammarState = {
  selected: "auto",
  active: "ambient_room",
  label: "AUTO",
  strength: 0.62
};
const OddLogicDirectorState = {
  mode: "auto",
  active: false,
  label: "",
  want: "",
  move: "",
  intensity: 0.18
};
const AlbumArcState = { progress: 0.24 };
const AcidLockState = {
  enabled: false,
  indicator: 0.08,
  transient: 0.04,
  transientSource: "fixture"
};
const HAZAMA_RUNTIME_FEEDBACK_TARGET_ORIGINS = [
  "https://quietbriony.github.io",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:8095",
  "http://localhost:8095"
];
const HazamaRuntimeFeedbackState = {
  sequence: 0,
  lastSentAt: 0,
  lastHeartbeatAt: 0,
  lastSignature: ""
};

function acidPerformanceAmount() {
  return 0.12;
}

function albumArcAcidDrive() {
  return 0.08;
}

function hazamaAutoFollowActive() {
  return !!(HazamaBridgeState.loaded && HazamaBridgeState.active && HazamaBridgeState.autoFollow);
}

function hazamaConnectionState() {
  return "follow";
}

function dominantInnerSourceFamily(inner) {
  return (inner && inner.profile) || "memoryRefrain";
}

window.MusicRuntimeState = { fixture: true };
window.__contract.engineFixtureLoaded = true;
