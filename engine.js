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

function markManualInfluenceFromEvent(event) {
  const id = event && event.target && event.target.id;
  const key = SLIDER_KEY_BY_ID[id];
  if (!key) return;
  const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  manualInfluenceUntil[key] = now + MANUAL_INFLUENCE_HOLD_MS;
}

function isManualInfluenceActive(key, now) {
  return typeof manualInfluenceUntil[key] === "number" && now < manualInfluenceUntil[key];
}

function setPerformancePad(name, active) {
  if (!Object.prototype.hasOwnProperty.call(PerformancePadState, name)) return;
  PerformancePadState[name] = active ? 1 : 0;
  PerformancePadState.lastTouchAt = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  if (initialized) updateTimbreStateFromWorld(currentGradientParts());
  if (active) triggerPadSignature(name);
  if (document.body) {
    document.body.dataset.padActive = Object.entries(PerformancePadState)
      .some(([key, value]) => key !== "lastTouchAt" && value > 0)
      ? "true"
      : "false";
  }
  updatePerformancePadStatus();
}

function clearPerformancePads() {
  ["drift", "repeat", "punch", "void"].forEach((name) => {
    PerformancePadState[name] = 0;
  });
  if (initialized) updateTimbreStateFromWorld(currentGradientParts());
  if (document.body) document.body.dataset.padActive = "false";
  document.querySelectorAll("[data-performance-pad].active").forEach((pad) => {
    pad.classList.remove("active");
  });
  updatePerformancePadStatus();
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
    button.textContent = PlaybackState.wakeLockEnabled ? "KEEP ON" : "KEEP";
  }

  if (PlaybackState.wakeLockEnabled && isPlaying) {
    requestPlaybackWakeLock();
  } else {
    releasePlaybackWakeLock();
  }
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
const drumBus = new Tone.Gain(0.84).connect(globalReverb);
const padBus  = new Tone.Gain(0.84).connect(globalReverb);
const bassBus = new Tone.Gain(0.72).connect(globalDelay);
const textureBus = new Tone.Gain(0.17).connect(globalDelay);

// ===== 楽器（3+1に絞る） =====

// Kick（ベーシック）
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.03,
  octaves: 5,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.35, sustain: 0 }
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
  filter: { type: "lowpass", Q: 1 },
  filterEnvelope: {
    attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3,
    baseFrequency: 80, octaves: 2
  },
  envelope: { attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.4 }
}).connect(bassBus);

// Pad（PolySynth だけ残す）
const padFilter = new Tone.Filter(1000, "lowpass").connect(padBus);
const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 1.2, decay: 0.7, sustain: 0.7, release: 3.5 }
}).connect(padFilter);

const texture = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.03 }
}).connect(textureBus);

const glass = new Tone.FMSynth({
  harmonicity: 1.5,
  modulationIndex: 8,
  oscillator: { type: "sine" },
  envelope: { attack: 0.006, decay: 0.14, sustain: 0, release: 0.22 },
  modulation: { type: "triangle" },
  modulationEnvelope: { attack: 0.003, decay: 0.09, sustain: 0, release: 0.12 }
}).connect(globalDelay);

function organicFragment(offset = 0) {
  return ORGANIC_PLUCK_FRAGMENTS[(GrooveState.cycle + stepIndex + offset) % ORGANIC_PLUCK_FRAGMENTS.length];
}

function transparentFragment(offset = 0) {
  return TRANSPARENT_AIR_FRAGMENTS[(GrooveState.cycle + stepIndex + offset) % TRANSPARENT_AIR_FRAGMENTS.length];
}

function triggerPadSignature(name) {
  if (!isPlaying || !initialized || typeof Tone === "undefined") return;

  const now = Tone.now();
  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const gradient = updateReferenceGradient(currentGradientParts());

  try {
    if (name === "drift") {
      const note = transparentFragment();
      const driftNote = transparentFragment(2);
      const pluckNote = organicFragment(4);
      glass.triggerAttackRelease(note, "16n", now + 0.006, clampValue(0.064 + observerNorm * 0.048 + gradient.chrome * 0.012, 0.054, 0.13));
      glass.triggerAttackRelease(driftNote, "32n", now + 0.056, clampValue(0.044 + creationNorm * 0.03 + gradient.memory * 0.01, 0.036, 0.092));
      glass.triggerAttackRelease(GLASS_NOTES[(stepIndex + 3) % GLASS_NOTES.length], "32n", now + 0.108, clampValue(0.03 + creationNorm * 0.026 + gradient.haze * 0.006, 0.026, 0.076));
      glass.triggerAttackRelease(pluckNote, "64n", now + 0.142, clampValue(0.026 + observerNorm * 0.03 + gradient.memory * 0.008, 0.022, 0.072));
      texture.triggerAttackRelease("64n", now + 0.018, clampValue(0.034 + creationNorm * 0.034, 0.028, 0.078));
    } else if (name === "repeat") {
      const note = GLASS_NOTES[(GrooveState.cycle + stepIndex) % GLASS_NOTES.length];
      const chipNote = transparentFragment(1);
      glass.triggerAttackRelease(note, "64n", now + 0.004, clampValue(0.062 + energyNorm * 0.032 + gradient.micro * 0.01, 0.052, 0.108));
      glass.triggerAttackRelease(note, "64n", now + 0.052, clampValue(0.048 + energyNorm * 0.026 + gradient.micro * 0.008, 0.04, 0.09));
      glass.triggerAttackRelease(chipNote, "64n", now + 0.086, clampValue(0.026 + observerNorm * 0.028 + gradient.organic * 0.008, 0.022, 0.07));
      hat.triggerAttackRelease("64n", now + 0.026, clampValue(0.056 + energyNorm * 0.038, 0.048, 0.112));
      texture.triggerAttackRelease("64n", now + 0.068, clampValue(0.032 + creationNorm * 0.028, 0.026, 0.07));
    } else if (name === "punch") {
      kick.triggerAttackRelease("C2", "16n", now + 0.002, clampValue(0.38 + energyNorm * 0.11, 0.34, 0.54));
      bass.triggerAttackRelease(bassRoot || "C2", "32n", now + 0.016, clampValue(0.11 + energyNorm * 0.07, 0.1, 0.2));
      glass.triggerAttackRelease(organicFragment(2), "64n", now + 0.032, clampValue(0.032 + creationNorm * 0.026 + gradient.organic * 0.008, 0.026, 0.078));
      texture.triggerAttackRelease("64n", now + 0.014, clampValue(0.074 + creationNorm * 0.04 + gradient.ghost * 0.01, 0.062, 0.132));
    } else if (name === "void") {
      const airNote = transparentFragment(2);
      const bloomNote = transparentFragment(5);
      const dustNote = transparentFragment(1);
      glass.triggerAttackRelease(airNote, "8n", now + 0.01, clampValue(0.052 + observerNorm * 0.046 + gradient.chrome * 0.012, 0.044, 0.11));
      glass.triggerAttackRelease(bloomNote, "16n", now + 0.096, clampValue(0.034 + observerNorm * 0.034 + gradient.haze * 0.008, 0.03, 0.084));
      glass.triggerAttackRelease(dustNote, "32n", now + 0.176, clampValue(0.022 + observerNorm * 0.03 + gradient.chrome * 0.006, 0.02, 0.066));
      pad.triggerAttackRelease(randomHazeChord(), "2n", now + 0.02, clampValue(0.042 + observerNorm * 0.028 + gradient.haze * 0.006, 0.034, 0.082));
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

let currentScale = ["C4", "D4", "E4", "G4", "A4"];
const MODE_CHORDS = {
  ambient: [
    ["F3", "C4", "G4"],
    ["A3", "E4", "G4"],
    ["D3", "A3", "E4"]
  ],
  lofi: [
    ["A3", "C4", "E4", "G4"],
    ["F3", "A3", "C4", "E4"],
    ["D3", "F4", "A4"]
  ],
  dub: [
    ["C3", "G3", "Bb3"],
    ["F3", "C4", "Eb4"]
  ],
  jazz: [
    ["D3", "F4", "A4", "C5"],
    ["G3", "B3", "D4", "F4"]
  ],
  techno: [
    ["C3", "G3"],
    ["C3", "Bb3"],
    ["F3", "C4"]
  ],
  trance: [
    ["D3", "A3", "E4"],
    ["F3", "C4", "G4"]
  ]
};
const GLASS_NOTES = ["D5", "F#5", "G5", "E5", "D6", "F#6", "G6", "E6"];
const FIELD_MURK_FRAGMENTS = ["D4", "F#4", "G4", "E4", "D5", "F#5", "G5", "E5"];
const TRANSPARENT_AIR_FRAGMENTS = ["D6", "F#6", "G6", "E6", "D7", "F#7"];
const ORGANIC_PLUCK_FRAGMENTS = ["D4", "F#4", "G4", "E4", "D5", "F#5", "G5", "E5", "D6", "F#6"];
const PRESSURE_TURN_NOTES = ["D2", "E2", "F#2", "G2"];
const HAZE_CHORDS = [
  ["D4", "F#4", "E5"],
  ["G4", "D5", "F#5"],
  ["E4", "G4", "D5"],
  ["F#4", "E5", "G5"]
];
const MODE_BASS_NOTES = {
  ambient: ["F1", "C2", "A1", "D2"],
  lofi: ["A1", "E2", "G1", "C2"],
  dub: ["C2", "C2", "Bb1", "F1"],
  jazz: ["D2", "G1", "C2", "A1"],
  techno: ["C2", "C2", "Bb1", "C2"],
  trance: ["D2", "A1", "C2", "D2"]
};
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
    label: "burning horizon",
    air: 0.02,
    glass: 0.12,
    grit: 0.08,
    fracture: 0.08,
    harp: 0.14,
    warmth: 0.06,
    restScale: 0.82,
    kickScale: 1.02,
    hatScale: 0.92,
    bassScale: 1.02,
    padScale: 1.08,
    textureScale: 0.94,
    glassScale: 1.12,
    organicScale: 0.9,
    dustScale: 0.86,
    pressureColor: 0.72,
    hazeScale: 1.0,
    pulseScale: 1.06,
  },
};

const HARP_NOTE_POOLS = {
  ambient: ["D4", "F#4", "G4", "E5", "D5", "F#5"],
  dub: ["C4", "Eb4", "G4", "Bb4", "C5"],
  jazz: ["D4", "F4", "A4", "C5", "E5", "G5"],
  lofi: ["D4", "E4", "F#4", "G4", "D5", "E5"],
  techno: ["C4", "Eb4", "G4", "Bb4"],
  trance: ["D4", "F#4", "A4", "C#5", "E5", "A5"],
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
  label.textContent = `${EngineParams.mode.toUpperCase()} / ${WorldState.label} / ${currentPresetCharacter().label}`;
}


function safeToneRamp(param, value, seconds = 0.18) {
  if (!param || typeof param.rampTo !== "function") return;
  try {
    param.rampTo(value, seconds);
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

  GradientState.haze = clampValue((circle * 0.28) + (observer * 0.28) + (voidness * 0.18) + ((1 - energy) * 0.18) + ((1 - resource) * 0.08), 0, 1);
  GradientState.memory = clampValue((wave * 0.32) + (circle * 0.28) + (mind * 0.22) + ((1 - harshness) * 0.18), 0, 1);
  GradientState.micro = clampValue((creation * 0.34) + (resource * 0.32) + (observer * 0.18) + (wave * 0.16), 0, 1);
  GradientState.ghost = clampValue((body * 0.28) + (voidness * 0.28) + (observer * 0.22) + ((1 - energy) * 0.1) + (pressure * 0.12), 0, 1);
  GradientState.chrome = clampValue((mind * 0.3) + (observer * 0.3) + (circle * 0.24) + (creation * 0.12) + ((1 - voidness) * 0.04), 0, 1);
  GradientState.organic = clampValue((wave * 0.28) + (creation * 0.26) + (circle * 0.16) + (observer * 0.14) + ((1 - harshness) * 0.16), 0, 1);

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

function updateTimbreStateFromWorld(parts) {
  const { energy, wave, creation, voidness, circle, body, resource, observer, ethereal, pressure } = parts;
  const character = currentPresetCharacter();
  const gradient = updateReferenceGradient(parts);

  TimbreState.air = clampValue((ethereal * 0.56) + (observer * 0.2) + (voidness * 0.16) + ((1 - resource) * 0.08) + (gradient.haze * 0.055) + (gradient.chrome * 0.035) + character.air, 0, 1);
  TimbreState.glass = clampValue((wave * 0.28) + (observer * 0.24) + (circle * 0.2) + (creation * 0.16) + (TimbreState.air * 0.12) + (gradient.chrome * 0.055) + (gradient.memory * 0.032) + character.glass, 0, 1);
  TimbreState.grit = clampValue((pressure * 0.48) + (resource * 0.22) + (body * 0.16) + (energy * 0.14) + (gradient.ghost * 0.032) + (gradient.micro * 0.022) - (gradient.haze * 0.035) + character.grit, 0, 1);
  TimbreState.fracture = clampValue((creation * 0.32) + (wave * 0.24) + (resource * 0.2) + (WorldState.spectrum * 0.24) + (gradient.micro * 0.06) + (gradient.organic * 0.025) + character.fracture, 0, 1);
  TimbreState.harp = clampValue((TimbreState.glass * 0.46) + (TimbreState.air * 0.24) + (circle * 0.18) + ((1 - TimbreState.grit) * 0.12) + (gradient.chrome * 0.05) + (gradient.memory * 0.035) + (character.harp || 0), 0, 1);
  TimbreState.warmth = clampValue((circle * 0.22) + (body * 0.16) + (resource * 0.16) + ((1 - TimbreState.fracture) * 0.18) + ((1 - pressure) * 0.08) + (gradient.memory * 0.045) + (gradient.organic * 0.025) + (character.warmth || 0), 0, 1);

  const organicColor = (character.organicScale || 1) - 1;
  const dustColor = (character.dustScale || 1) - 1;
  const pressureColor = character.pressureColor || 0.5;
  const hazeColor = (character.hazeScale || 1) - 1;
  const airyPad = -25.2 + (TimbreState.air * 4.4) - (TimbreState.grit * 2.6) + (TimbreState.warmth * 1.1) + (hazeColor * 1.25) + (gradient.haze * 0.42) + (gradient.chrome * 0.22) - (PerformancePadState.void * 1.55);
  const glassLevel = -34.5 + (TimbreState.glass * 5.4) + (TimbreState.harp * 3.4) + (WorldState.spectrum * 0.9) + (organicColor * 1.15) + (gradient.chrome * 0.38) + (gradient.micro * 0.22) + (PerformancePadState.void * 2.15);
  const textureLevel = -38.2 + (TimbreState.grit * 6.0) + (TimbreState.fracture * 2.3) + (dustColor * 1.35) + ((pressureColor - 0.5) * WorldState.spectrum * 0.62) + (gradient.micro * 0.28) + (gradient.ghost * 0.16) - (TimbreState.warmth * 1.65) - (PerformancePadState.void * 1.15);
  const bassCutoff = 96 + (TimbreState.grit * 350) + (resource * 102) + (pressureColor * pressure * 34) - (TimbreState.warmth * 54) - (PerformancePadState.void * 82) + (PerformancePadState.punch * 62);
  const bassBite = 0.58 + (TimbreState.grit * 3.8) + (TimbreState.warmth * 0.62) + (pressureColor * pressure * 0.24) + (PerformancePadState.punch * 0.3);

  safeToneRamp(pad?.volume, airyPad, 0.28);
  safeToneRamp(glass?.volume, glassLevel, 0.22);
  safeToneRamp(texture?.volume, textureLevel, 0.2);
  safeToneRamp(bass?.filter?.frequency, bassCutoff, 0.18);
  safeToneRamp(bass?.filter?.Q, bassBite, 0.2);
  safeToneRamp(glass?.harmonicity, 1.0 + (TimbreState.glass * 0.95) + (TimbreState.harp * 0.72) + (organicColor * 0.12) + (PerformancePadState.void * 0.24), 0.24);
  safeToneRamp(glass?.modulationIndex, 0.68 + (TimbreState.fracture * 2.25) + (TimbreState.harp * 0.82) + (pressureColor * 0.12) - (TimbreState.warmth * 0.46) - (PerformancePadState.void * 0.22), 0.2);

  setEnvelopeValue(glass?.envelope, "attack", 0.004 + (TimbreState.harp * 0.012));
  setEnvelopeValue(glass?.envelope, "decay", 0.082 + (TimbreState.harp * 0.17) + (TimbreState.air * 0.09) + (PerformancePadState.void * 0.11));
  setEnvelopeValue(glass?.envelope, "sustain", 0.015 + (TimbreState.warmth * 0.035));
  setEnvelopeValue(glass?.envelope, "release", 0.12 + (TimbreState.air * 0.17) + (TimbreState.warmth * 0.16) + (PerformancePadState.void * 0.16));
  setEnvelopeValue(glass?.modulationEnvelope, "attack", 0.003);
  setEnvelopeValue(glass?.modulationEnvelope, "decay", 0.07 + (TimbreState.harp * 0.12));
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
  const ethereal = 1 - spectrum;
  const pulse = GrooveState.cycle || 0;
  const isDownbeat = pulse % 16 === 0;
  const isTurnaround = pulse % 16 === 14;
  const sparseGate = pulse % (spectrum > 0.72 ? 4 : 8) === 0;
  const harpGate = pulse % (spectrum > 0.72 ? 12 : 8) === 4;

  if (texture && sparseGate && Math.random() < (0.026 + (spectrum * 0.035) + (TimbreState.grit * 0.035)) * character.textureScale * dustScale) {
    const textureVel = clampValue(0.018 + (spectrum * 0.04) + (TimbreState.fracture * 0.04) + ((dustScale - 1) * 0.012), 0.018, 0.09);
    try {
      texture.triggerAttackRelease("64n", time, textureVel);
    } catch (error) {
      console.warn("[Music] Texture accent failed:", error);
    }
  }

  if (glass && (isDownbeat || isTurnaround || Math.random() < (0.014 + (ethereal * 0.024) + (TimbreState.glass * 0.026)) * character.glassScale)) {
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

  if (hat && spectrum > 0.62 && pulse % 8 === 6 && Math.random() < (0.06 + (TimbreState.fracture * 0.14)) * (0.7 + pressureColor * 0.6)) {
    try {
      hat.triggerAttackRelease("64n", time + 0.032, clampValue(0.045 + (TimbreState.grit * 0.06), 0.035, 0.11));
    } catch (error) {
      console.warn("[Music] Hat fracture failed:", error);
    }
  }
  if (bass && spectrum > 0.78 && isTurnaround && Math.random() < 0.16 + pressureColor * 0.18) {
    const bassNotes = PRESSURE_TURN_NOTES;
    const note = bassNotes[Math.floor(Math.random() * bassNotes.length)];
    try {
      bass.triggerAttackRelease(note, "32n", time + 0.028, clampValue(0.08 + pressureColor * 0.06, 0.08, 0.15));
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
      opt.textContent = n.toUpperCase();
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o=>o.value===current)) sel.value = current;
  }

  if (status){
    status.textContent = ok.length ? `loaded: ${ok.join(", ")}` : "no presets found";
  }
}

function resolveMode(){
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
      bass.set({ oscillator:{type:"square"}, filter:{Q:1.8}, filterEnvelope:{baseFrequency:60, octaves:3.0} });
    }else{
      // fallback
      globalReverb.wet.rampTo(0.26, 1.0);
      globalDelay.wet.rampTo(0.18, 1.0);
    }
  }catch(e){
    console.warn("updateSoundForMode failed", e);
  }
}
let bassRoot     = "C2";

/* =========================================================
   4. UCM → パラメータ変換（簡略チューン）
========================================================= */

function chooseMode() {
  const e = UCM_CUR.energy;
  if (e < 25) return "ambient";
  if (e < 50) return "lofi";
  if (e < 75) return "techno";
  return "trance";
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

  // BPM
  EngineParams.bpm = Math.round(mapValue(UCM_CUR.energy, 0, 100, 58, 148));
  rampParam("transport-bpm", Tone.Transport.bpm, EngineParams.bpm, force ? 0.18 : 0.45, force ? 0 : 1);

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

  // 休符
  EngineParams.restProb = clampValue(mapValue(UCM_CUR.void, 0, 100, 0.025, 0.42) - energyNorm * 0.035 + observerNorm * 0.012, 0.02, 0.46);

  // ドラム密度
  EngineParams.kickProb = mapValue((bodyNorm * 0.72 + energyNorm * 0.28) * 100, 0, 100, 0.24, 0.86);
  EngineParams.hatProb  = mapValue((resourceNorm * 0.64 + energyNorm * 0.24 + waveNorm * 0.12) * 100, 0, 100, 0.14, 0.76);

  // Bass / Pad
  EngineParams.bassProb = mapValue((bodyNorm * 0.82 + energyNorm * 0.18) * 100, 0, 100, 0.11, 0.58);
  EngineParams.padProb  = mapValue((circleNorm * 0.62 + observerNorm * 0.2 + voidNorm * 0.18) * 100, 0, 100, 0.18, 0.52);
  const character = currentPresetCharacter();
  EngineParams.restProb = clampValue(EngineParams.restProb * character.restScale, 0.04, PerformancePadState.void ? 0.58 : 0.46);
  EngineParams.kickProb = clampValue(EngineParams.kickProb * character.kickScale, PerformancePadState.void ? 0.08 : 0.18, 0.86);
  EngineParams.hatProb = clampValue(EngineParams.hatProb * character.hatScale, PerformancePadState.void ? 0.12 : 0.2, 0.82);
  EngineParams.bassProb = clampValue(EngineParams.bassProb * character.bassScale, PerformancePadState.void ? 0.07 : 0.14, 0.62);
  EngineParams.padProb = clampValue(EngineParams.padProb * character.padScale * (character.hazeScale || 1), PerformancePadState.void ? 0.16 : 0.18, 0.56);

  // リバーブ/ディレイ量を少しだけ動かす（軽量）
  const reverbWet = clampValue(
    mapValue(UCM_CUR.observer + UCM_CUR.void * 0.35, 0, 135, 0.14, 0.46) +
      PerformancePadState.void * 0.16 +
      PerformancePadState.drift * 0.04,
    0.08,
    0.62
  );
  rampParam("reverb-wet", globalReverb.wet, reverbWet, 0.8, force ? 0 : 0.012);

  const delayWet = clampValue(
    mapValue(UCM_CUR.creation + UCM_CUR.observer * 0.22, 0, 122, 0.035, 0.28) +
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
      PerformancePadState.void * 720 +
      PerformancePadState.punch * 72,
    180,
    2600
  );
  rampParam("pad-cutoff", padFilter.frequency, cutoff, 0.5, force ? 0 : 70);

  // スケール
  const baseScale = ["C4", "D4", "E4", "G4", "A4"];
  const tensions  = ["B3", "B4", "D5", "F5"];
  if (UCM_CUR.mind > 60 || UCM_CUR.creation > 60) {
    currentScale = baseScale.concat(tensions);
  } else {
    currentScale = baseScale;
  }

  // ルート
  switch (EngineParams.mode) {
    case "ambient": bassRoot = "F1"; break;
    case "lofi":    bassRoot = "A1"; break;
    case "techno":  bassRoot = "C2"; break;
    case "trance":  bassRoot = "D2"; break;
  }

  if (!manual) setPatternsByMode();
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
      EngineParams.hatPattern  = "....x......x....";
      EngineParams.bassPattern = "x...x...x...x...";
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
  return HAZE_CHORDS[(GrooveState.cycle + Math.floor(Math.random() * HAZE_CHORDS.length)) % HAZE_CHORDS.length];
}

function advanceGrooveStructure() {
  GrooveState.cycle++;

  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resourceNorm = clampValue(UCM_CUR.resource / 100, 0, 1);
  const waveNorm = clampValue(UCM_CUR.wave / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const phraseStep = GrooveState.cycle % 4;
  const density = (energyNorm + creationNorm + resourceNorm) / 3;
  const fillChance = mapValue(density, 0, 1, 0.04, 0.30);

  GrooveState.fillActive = phraseStep === 3 && rand(fillChance);
  GrooveState.textureLift = GrooveState.fillActive ? 0.10 + creationNorm * 0.12 : creationNorm * 0.035;
  GrooveState.glassLift = (phraseStep === 1 || phraseStep === 3) ? 0.04 + creationNorm * 0.08 : 0.015;
  GrooveState.accentStep = GLASS_ACCENT_STEPS[(GrooveState.cycle + Math.floor(waveNorm * 6)) % GLASS_ACCENT_STEPS.length];
  GrooveState.bassOffset = (GrooveState.cycle + Math.floor(UCM_CUR.mind / 18)) % 4;
  GrooveState.microJitterScale = GrooveState.fillActive ? 1.4 : 0.7 + waveNorm * 0.7;
}

function bassNoteForStep(step) {
  const notes = MODE_BASS_NOTES[EngineParams.mode] || MODE_BASS_NOTES.techno;
  const phraseIndex = Math.floor(step / 4) + GrooveState.bassOffset;
  return notes[phraseIndex % notes.length];
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
  const hazeScale = (character.hazeScale || 1) * (0.9 + gradient.haze * 0.18 + gradient.chrome * 0.08);
  const pulseScale = (character.pulseScale || 1) * (0.9 + gradient.ghost * 0.16 + gradient.micro * 0.08);
  const inWarmup = GrooveState.floorWarmupSteps > 0;
  const voiding = PerformancePadState.void > 0;
  const floorGate = inWarmup || step % 2 === 0 || (isRest && step % 8 === 2);
  if (!floorGate) return;

  const airTime = time + 0.008 + (PerformancePadState.drift ? Math.random() * 0.026 : Math.random() * 0.01);
  const ghostTextureVel = clampValue(
    0.012 + observerNorm * 0.018 + creationNorm * 0.012 + gradient.ghost * 0.004 + gradient.micro * 0.003 + PerformancePadState.drift * 0.016 + voiding * 0.014,
    0.012,
    0.054
  );
  const ghostGlassVel = clampValue(
    0.014 + observerNorm * 0.03 + (1 - energyNorm) * 0.012 + gradient.chrome * 0.006 + gradient.memory * 0.004 + PerformancePadState.void * 0.026,
    0.014,
    0.078
  );

  try {
    if (step % 2 === 0 || inWarmup || voiding) {
      texture.triggerAttackRelease("64n", airTime, ghostTextureVel);
    }
  } catch (error) {
    console.warn("[Music] ghost texture floor failed:", error);
  }

  if (step % 8 === 0 && !voiding && rand(0.82 * pulseScale)) {
    try {
      kick.triggerAttackRelease("C2", "16n", time + 0.004, clampValue(0.16 + energyNorm * 0.07 + PerformancePadState.punch * 0.08, 0.12, 0.32));
    } catch (error) {
      console.warn("[Music] ghost pulse failed:", error);
    }
  }

  if ((step % 8 === 2 || step % 8 === 6) && rand((0.26 + observerNorm * 0.16 + waveNorm * 0.07 + gradient.ghost * 0.05) * pulseScale)) {
    const note = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle) % FIELD_MURK_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "64n", airTime + 0.018, clampValue(0.018 + observerNorm * 0.024 + gradient.ghost * 0.006 + PerformancePadState.repeat * 0.018, 0.014, 0.066));
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
  const hazeChance = chance((0.19 + observerNorm * 0.17 + circleNorm * 0.145 + (1 - energyNorm) * 0.075 + gradient.haze * 0.085 + gradient.chrome * 0.045 + PerformancePadState.void * 0.16) * hazeScale);
  if (hazeGate && (inWarmup || rand(hazeChance))) {
    try {
      pad.triggerAttackRelease(randomHazeChord(), voiding ? "2n" : "1n", airTime + 0.018, clampValue(0.027 + observerNorm * 0.027 + circleNorm * 0.015 + (1 - energyNorm) * 0.012 + gradient.haze * 0.006, 0.023, 0.076));
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
  const organicScale = (character.organicScale || 1) * (0.9 + gradient.organic * 0.2);
  const dustScale = (character.dustScale || 1) * (0.92 + gradient.memory * 0.08 + gradient.micro * 0.08);
  const pressureColor = (character.pressureColor || 0.5) * (0.9 + gradient.ghost * 0.2);
  const pluckGate = step % 8 === 1 || step % 8 === 5 || (PerformancePadState.drift && step % 8 === 3);
  const organicProb = chance((0.02 + observerNorm * 0.032 + creationNorm * 0.028 + waveNorm * 0.021 + gradient.organic * 0.019 + PerformancePadState.drift * 0.052 + PerformancePadState.void * 0.022) * organicScale);

  if (pluckGate && rand(organicProb)) {
    const note = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + Math.floor(waveNorm * 4)) % ORGANIC_PLUCK_FRAGMENTS.length];
    const echoNote = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 3) % ORGANIC_PLUCK_FRAGMENTS.length];
    const pluckTime = time + 0.014 + Math.random() * (0.012 + waveNorm * 0.014);
    const vel = clampValue(0.024 + observerNorm * 0.034 + creationNorm * 0.026 + gradient.organic * 0.006 + PerformancePadState.drift * 0.016, 0.018, 0.094);
    try {
      glass.triggerAttackRelease(note, "64n", pluckTime, vel);
      if (rand(0.24 + TimbreState.harp * 0.27 + gradient.micro * 0.08 + PerformancePadState.repeat * 0.2)) {
        glass.triggerAttackRelease(echoNote, "64n", pluckTime + 0.046 + Math.random() * 0.018, vel * 0.64);
      }
      if (rand(0.22 + dustScale * 0.08)) {
        texture.triggerAttackRelease("64n", pluckTime + 0.01, clampValue(0.016 + creationNorm * 0.026 + dustScale * 0.012, 0.014, 0.066));
      }
    } catch (error) {
      console.warn("[Music] organic pluck failed:", error);
    }
  }

  const pressure = clampValue((energyNorm * 0.42) + (creationNorm * 0.34) + (resourceNorm * 0.16) + (waveNorm * 0.08) - (voidNorm * 0.22), 0, 1);
  const pressureGate = !isRest && !PerformancePadState.void && pressure > 0.62 && (step % 16 === 10 || isAccentStep);
  if (pressureGate && rand((0.024 + pressure * 0.062 + gradient.ghost * 0.018) * pressureColor)) {
    const turnNote = PRESSURE_TURN_NOTES[(GrooveState.cycle + step) % PRESSURE_TURN_NOTES.length];
    try {
      glass.triggerAttackRelease(organicFragment(1), "64n", time + 0.012, clampValue(0.024 + pressure * 0.042, 0.022, 0.078));
      if (rand(0.36)) {
        bass.triggerAttackRelease(turnNote, "64n", time + 0.024, clampValue(0.075 + pressure * 0.052, 0.07, 0.15));
      }
    } catch (error) {
      console.warn("[Music] pressure color failed:", error);
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

  if (PerformancePadState.drift && (step % 8 === 1 || step % 8 === 5)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle) % TRANSPARENT_AIR_FRAGMENTS.length];
    const liftNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 3) % TRANSPARENT_AIR_FRAGMENTS.length];
    const pluckNote = ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 5) % ORGANIC_PLUCK_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "32n", time + 0.018 + waveNorm * 0.02, clampValue(0.036 + observerNorm * 0.038 + creationNorm * 0.016 + gradient.chrome * 0.006, 0.03, 0.102));
      glass.triggerAttackRelease(liftNote, "64n", time + 0.066 + waveNorm * 0.018, clampValue(0.022 + observerNorm * 0.026 + gradient.memory * 0.006, 0.018, 0.07));
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
      glass.triggerAttackRelease(note, "64n", time + 0.012, clampValue(0.048 + energyNorm * 0.038 + gradient.micro * 0.008, 0.04, 0.104));
      glass.triggerAttackRelease(note, "64n", time + 0.052, clampValue(0.034 + energyNorm * 0.03 + gradient.micro * 0.006, 0.028, 0.08));
      glass.triggerAttackRelease(chipNote, "64n", time + 0.088, clampValue(0.018 + observerNorm * 0.024 + gradient.organic * 0.006, 0.016, 0.064));
      if (step % 8 === 6) hat.triggerAttackRelease("64n", time + 0.034, clampValue(0.046 + energyNorm * 0.042, 0.038, 0.108));
    } catch (error) {
      console.warn("[Music] repeat hold failed:", error);
    }
  }

  if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep)) {
    try {
      kick.triggerAttackRelease("C2", "16n", time + 0.004, clampValue(0.3 + energyNorm * 0.16, 0.26, 0.52));
      if (step % 8 === 0) {
        bass.triggerAttackRelease(bassRoot || "C2", "32n", time + 0.026, clampValue(0.1 + energyNorm * 0.07, 0.09, 0.2));
      }
      glass.triggerAttackRelease(ORGANIC_PLUCK_FRAGMENTS[(step + GrooveState.cycle + 2) % ORGANIC_PLUCK_FRAGMENTS.length], "64n", time + 0.036, clampValue(0.026 + creationNorm * 0.026 + gradient.organic * 0.006, 0.022, 0.076));
      texture.triggerAttackRelease("64n", time + 0.018, clampValue(0.06 + creationNorm * 0.044 + gradient.ghost * 0.008, 0.05, 0.124));
    } catch (error) {
      console.warn("[Music] punch hold failed:", error);
    }
  }

  if (PerformancePadState.void && (step % 8 === 4 || step % 8 === 7)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 2) % TRANSPARENT_AIR_FRAGMENTS.length];
    const tailNote = TRANSPARENT_AIR_FRAGMENTS[(step + GrooveState.cycle + 5) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "16n", time + 0.022, clampValue(0.034 + observerNorm * 0.042 + gradient.chrome * 0.008, 0.03, 0.1));
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

  // 休符判定
  const isRest = rand(clampValue(EngineParams.restProb + PerformancePadState.void * 0.18 - PerformancePadState.punch * 0.06, 0.02, PerformancePadState.void ? 0.6 : 0.48));
  const energyNorm = clampValue(UCM_CUR.energy / 100, 0, 1);
  const creationNorm = clampValue(UCM_CUR.creation / 100, 0, 1);
  const resourceNorm = clampValue(UCM_CUR.resource / 100, 0, 1);
  const waveNorm = clampValue(UCM_CUR.wave / 100, 0, 1);
  const observerNorm = clampValue(UCM_CUR.observer / 100, 0, 1);
  const voidNorm = clampValue(UCM_CUR.void / 100, 0, 1);
  const circleNorm = clampValue(UCM_CUR.circle / 100, 0, 1);
  const isAccentStep = step === GrooveState.accentStep || (GrooveState.fillActive && (step % 4 === 3 || step % 8 === 6));
  const grooveJitter = (step % 2 === 1 ? mapValue(waveNorm, 0, 1, 0, 0.014 + PerformancePadState.drift * 0.026) * GrooveState.microJitterScale : 0);
  const fillBoost = GrooveState.fillActive ? 0.14 : 0;
  const t = time + grooveJitter;
  const stepContext = { energyNorm, creationNorm, resourceNorm, waveNorm, observerNorm, voidNorm, circleNorm, isRest, isAccentStep };
  const gradient = updateReferenceGradient(currentGradientParts());

  triggerAudibleGrooveFloor(step, t, stepContext);
  triggerOrganicTexture(step, t, stepContext);
  triggerPadHoldMinimums(step, t, stepContext);

  if (!isRest) {
    // Kick
    const kickChance = chance(EngineParams.kickProb + (isAccentStep ? 0.05 : 0) + PerformancePadState.punch * 0.1 - PerformancePadState.void * 0.12);
    if (patternAt(EngineParams.kickPattern, step) && rand(kickChance)) {
      kick.triggerAttackRelease("C2", "8n", t, clampValue(0.58 + energyNorm * 0.13 + (isAccentStep ? 0.04 : 0) + PerformancePadState.punch * 0.08, 0.46, 0.84));
      if (PerformancePadState.punch && (step % 8 === 0 || isAccentStep) && rand(0.46)) {
        try {
          texture.triggerAttackRelease("64n", t + 0.012, clampValue(0.045 + energyNorm * 0.06, 0.035, 0.11));
        } catch (error) {
          console.warn("[Music] punch transient failed:", error);
        }
      }
    }

    // Hat
    const hatChance = chance(EngineParams.hatProb + fillBoost + (isAccentStep ? 0.10 : 0) - PerformancePadState.void * 0.1);
    if ((patternAt(EngineParams.hatPattern, step) || (GrooveState.fillActive && step % 4 === 2)) && rand(hatChance)) {
      hat.triggerAttackRelease("32n", t, 0.10 + energyNorm * 0.13 + (isAccentStep ? 0.05 : 0));
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
    const bassChance = chance(EngineParams.bassProb + (GrooveState.fillActive && step % 8 === 6 ? 0.10 : 0) - PerformancePadState.void * 0.12);
    if (patternAt(EngineParams.bassPattern, step) && rand(bassChance)) {
      const note = step % 8 === 0 ? bassRoot : bassNoteForStep(step);
      bass.triggerAttackRelease(note, EngineParams.mode === "ambient" ? "4n" : "8n", t, clampValue(0.26 + energyNorm * 0.16 + PerformancePadState.punch * 0.04, 0.18, 0.48));
      if (PerformancePadState.repeat && step % 8 === 0 && rand(0.1)) {
        try {
          bass.triggerAttackRelease(note, "32n", t + 0.036, clampValue(0.12 + energyNorm * 0.06, 0.09, 0.22));
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

  const textureProb = chance(mapValue(UCM_CUR.creation + UCM_CUR.resource, 0, 200, 0.024, 0.185) + GrooveState.textureLift + gradient.micro * 0.012 + gradient.ghost * 0.006 + PerformancePadState.drift * 0.088 - PerformancePadState.void * 0.012);
  if (rand(textureProb) && (step % 2 === 1 || isAccentStep)) {
    const textureTime = t + (isAccentStep ? 0.006 : 0.012);
    texture.triggerAttackRelease("32n", textureTime, clampValue(0.026 + creationNorm * 0.095 + resourceNorm * 0.026 + PerformancePadState.punch * 0.016, 0.018, 0.125));
  }

  const particleProb = chance(0.03 + creationNorm * 0.032 + waveNorm * 0.022 + observerNorm * 0.018 + gradient.chrome * 0.012 + gradient.micro * 0.008 + PerformancePadState.drift * 0.105 + PerformancePadState.repeat * 0.055 + PerformancePadState.void * 0.06);
  if (rand(particleProb) && (step % 4 === 1 || step % 8 === 5 || isAccentStep)) {
    const note = FIELD_MURK_FRAGMENTS[(step + GrooveState.cycle + Math.floor(Math.random() * FIELD_MURK_FRAGMENTS.length)) % FIELD_MURK_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "32n", t + 0.019 + Math.random() * 0.018, clampValue(0.022 + creationNorm * 0.036 + gradient.micro * 0.006 + PerformancePadState.repeat * 0.038 + PerformancePadState.void * 0.018, 0.016, 0.098));
    } catch (error) {
      console.warn("[Music] field particle failed:", error);
    }
  }

  const airProb = chance(0.026 + observerNorm * 0.042 + circleNorm * 0.018 + gradient.chrome * 0.014 + gradient.haze * 0.008 + PerformancePadState.void * 0.145 + PerformancePadState.drift * 0.066 + PerformancePadState.repeat * 0.022);
  if (rand(airProb) && (step % 8 === 4 || step % 8 === 7)) {
    const note = TRANSPARENT_AIR_FRAGMENTS[(step + Math.floor(Math.random() * TRANSPARENT_AIR_FRAGMENTS.length)) % TRANSPARENT_AIR_FRAGMENTS.length];
    try {
      glass.triggerAttackRelease(note, "32n", t + 0.024, clampValue(0.016 + observerNorm * 0.038 + gradient.chrome * 0.006 + PerformancePadState.void * 0.026 + PerformancePadState.repeat * 0.012, 0.012, 0.082));
    } catch (error) {
      console.warn("[Music] transparent air failed:", error);
    }
  }

  const glassProb = chance(mapValue(UCM_CUR.mind + UCM_CUR.creation, 0, 200, 0.02, 0.136) + GrooveState.glassLift + gradient.memory * 0.01 + gradient.chrome * 0.01 + gradient.micro * 0.008 + PerformancePadState.drift * 0.09 + PerformancePadState.repeat * 0.07 + PerformancePadState.void * 0.038);
  if (rand(glassProb) && (isAccentStep || step % 8 === 3 || step % 16 === 11)) {
    const note = GLASS_NOTES[Math.floor(Math.random() * GLASS_NOTES.length)];
    glass.triggerAttackRelease(note, "16n", t + 0.015, clampValue(0.035 + energyNorm * 0.065 + PerformancePadState.void * 0.014, 0.026, 0.118));
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
  updateRuntimeUiState();
  updateAutoMixTargets(cycleMs);

  UCM.auto.timer = setInterval(() => {
    updateAutoMixTargets(cycleMs);
  }, AUTO_MOTION_TICK_MS);
}

function updateAutoMixTargets(cycleMs) {
  if (!UCM.auto.enabled || !isPlaying) return;

  UCM.auto.phase = (UCM.auto.phase + AUTO_MOTION_TICK_MS / cycleMs) % 1;
  for (const key of AUTOMIX_MOTION_KEYS) {
    const profile = AUTOMIX_PROFILE[key];
    const phase = (UCM.auto.phase + profile.phase) % 1;
    const wave = Math.sin(phase * Math.PI * 2);
    const ripple = Math.sin((phase * 2.7 + profile.phase) * Math.PI * 2) * 0.23;
    const desired = clampValue(profile.base + profile.depth * (wave + ripple), 4, 96);
    const current = typeof UCM_TARGET[key] === "number" ? UCM_TARGET[key] : profile.base;
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    if (isManualInfluenceActive(key, now)) {
      syncSliderFromTarget(key);
      continue;
    }
    UCM_TARGET[key] = approachValue(current, desired, profile.step);
    syncSliderFromTarget(key);
  }
  updateUIFromParams();
}

function stopAutoCycle(options = {}) {
  const keepEnabled = options && options.keepEnabled;
  if (!keepEnabled) UCM.auto.enabled = false;

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
  const audioOutputSelect = document.getElementById("audio_output_select");
  const btnAudioOutput = document.getElementById("btn_audio_output");
  const btnKeepAwake = document.getElementById("btn_keep_awake");
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
        releaseAllVoices();
        resetRuntimeCounters();
        restoreMasterLevel();
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
