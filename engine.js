// UCM Mandala Engine
// 八観モードで質感を切り替える Web Audio ジェネレータ

let audioCtx = null;
let masterGain, reverbGain, dryGain;
let analyser, analyserData;
let schedulerTimer = null;
let vizTimer = null;

let isRunning = false;
let nextTime = 0;
let step = 0;

let tempo = 86;
const subdivision = 4;      // 16分
const scheduleAhead = 0.15; // 秒
const lookaheadMs = 30;

let patternDepth = 2;
let intensity = 0.5;
let currentModeKey = "void";

const baseFreq = 110;

// 観モードごとのパラメータ
const MODES = {
  void: {
    name: "Void 観",
    desc: "ほぼ静寂。低いドローンだけがわずかに揺れ、他の音はほとんど出てこない領域。",
    tempo: 52,
    droneLevel: 0.22,
    pulseProb: 0.08,
    offgridProb: 0.0,
    glitchProb: 0.02,
    scaleSpread: 1
  },
  wave: {
    name: "波 観",
    desc: "なめらかな倍音アルペジオがゆっくり波のようにうねる状態。拍は曖昧。",
    tempo: 64,
    droneLevel: 0.26,
    pulseProb: 0.35,
    offgridProb: 0.15,
    glitchProb: 0.05,
    scaleSpread: 2
  },
  body: {
    name: "体 観",
    desc: "定位と動きが前面に出るモード。LRのパンと揺れが強調される。",
    tempo: 76,
    droneLevel: 0.3,
    pulseProb: 0.45,
    offgridProb: 0.25,
    glitchProb: 0.08,
    scaleSpread: 2
  },
  thought: {
    name: "思 観",
    desc: "リズムとパターンの構造が立ち上がる領域。ポリリズム・グリッド感が増す。",
    tempo: 86,
    droneLevel: 0.24,
    pulseProb: 0.6,
    offgridProb: 0.35,
    glitchProb: 0.11,
    scaleSpread: 3
  },
  creation: {
    name: "創 観",
    desc: "グリッチと偶然性が強くなるモード。意図とノイズの間を行き来する。",
    tempo: 94,
    droneLevel: 0.2,
    pulseProb: 0.52,
    offgridProb: 0.5,
    glitchProb: 0.22,
    scaleSpread: 3
  },
  value: {
    name: "財 観",
    desc: "ややポップで聴きやすいモード。反復しやすい音程と周期が多く現れる。",
    tempo: 92,
    droneLevel: 0.23,
    pulseProb: 0.65,
    offgridProb: 0.25,
    glitchProb: 0.06,
    scaleSpread: 2
  },
  observer: {
    name: "観察者 観",
    desc: "内部の状態変化に応じて音量・密度がゆっくり変化する。俯瞰して眺める耳。",
    tempo: 78,
    droneLevel: 0.22,
    pulseProb: 0.45,
    offgridProb: 0.2,
    glitchProb: 0.1,
    scaleSpread: 2.5
  },
  circle: {
    name: "円 観",
    desc: "一定周期で「吸って吐く」ように、静と動がゆっくり巡回するモード。",
    tempo: 68,
    droneLevel: 0.24,
    pulseProb: 0.4,
    offgridProb: 0.2,
    glitchProb: 0.08,
    scaleSpread: 2
  }
};

let modeLfo = null;
let modeLfoGain = null;

// ===================================
// 汎用ユーティリティ
// ===================================
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function chance(p) {
  return Math.random() < p;
}

const scaleRatios = [
  1.0,
  5/4,
  4/3,
  3/2,
  5/3,
  2.0
];

function pickFreq(modeKey) {
  const mode = MODES[modeKey] || MODES.wave;
  const spread = mode.scaleSpread || 2;
  const ratio = scaleRatios[Math.floor(Math.random() * scaleRatios.length)];
  const octave = Math.floor(rand(0, spread)) * 2;
  return baseFreq * ratio * Math.pow(2, octave);
}

// ===================================
// Audio 初期化
// ===================================
function initAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;

  dryGain = audioCtx.createGain();
  dryGain.gain.value = 0.7;

  reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.65;

  const convolver = audioCtx.createConvolver();
  convolver.buffer = buildReverbImpulse(audioCtx, 3.2, 2.1);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyserData = new Uint8Array(analyser.frequencyBinCount);

  dryGain.connect(masterGain);
  convolver.connect(reverbGain);
  reverbGain.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  reverbGain.connect(convolver);

  createDroneLayer();
  createModeLfo();

  applyMode(currentModeKey);

  nextTime = audioCtx.currentTime + 0.05;
}

function buildReverbImpulse(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return impulse;
}

// ===================================
// レイヤー
// ===================================
function createDroneLayer() {
  const oscL = audioCtx.createOscillator();
  const oscR = audioCtx.createOscillator();
  const gainL = audioCtx.createGain();
  const gainR = audioCtx.createGain();

  oscL.type = "sine";
  oscR.type = "sine";

  oscL.frequency.value = baseFreq * 0.5;
  oscR.frequency.value = baseFreq * 0.5017;

  gainL.gain.value = 0.22;
  gainR.gain.value = 0.22;

  const pannerL = audioCtx.createStereoPanner();
  const pannerR = audioCtx.createStereoPanner();
  pannerL.pan.value = -0.25;
  pannerR.pan.value = 0.27;

  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.028;
  lfoGain.gain.value = 0.18;

  lfo.connect(lfoGain);
  lfoGain.connect(pannerL.pan);
  lfoGain.connect(pannerR.pan);

  oscL.connect(gainL).connect(pannerL).connect(dryGain);
  oscR.connect(gainR).connect(pannerR).connect(dryGain);

  oscL.start();
  oscR.start();
  lfo.start();

  // drone の音量はモードで動かすので保持
  createDroneLayer.droneGainNodes = [gainL, gainR];
}

// モード用 LFO（観察者観などで使う）
function createModeLfo() {
  modeLfo = audioCtx.createOscillator();
  modeLfoGain = audioCtx.createGain();
  modeLfo.type = "sine";
  modeLfo.frequency.value = 0.005; // 超低速

  modeLfo.connect(modeLfoGain);
  modeLfoGain.connect(masterGain.gain);

  modeLfo.start();
}

// ===================================
// モード適用
// ===================================
function applyMode(key) {
  const mode = MODES[key] || MODES.wave;
  currentModeKey = key;
  tempo = mode.tempo;

  // drone レベル
  if (createDroneLayer.droneGainNodes) {
    const [gL, gR] = createDroneLayer.droneGainNodes;
    const now = audioCtx ? audioCtx.currentTime : 0;
    [gL, gR].forEach(g => {
      g.gain.cancelScheduledValues(now);
      g.gain.linearRampToValueAtTime(mode.droneLevel, now + 1.2);
    });
  }

  // 観察者観と円観は master をゆっくり揺らす
  if (modeLfoGain) {
    const now = audioCtx.currentTime;
    modeLfoGain.gain.cancelScheduledValues(now);
    if (key === "observer" || key === "circle") {
      modeLfoGain.gain.linearRampToValueAtTime(0.08, now + 1.0);
    } else {
      modeLfoGain.gain.linearRampToValueAtTime(0.0, now + 1.0);
    }
  }

  // 円観は周期的な「ミュート」として扱う
  if (key === "circle") {
    applyMode.circlePhaseStart = audioCtx.currentTime;
  }

  updateModeText();
}

function getCurrentMode() {
  return MODES[currentModeKey] || MODES.wave;
}

// ===================================
// イベントスケジューラ
// ===================================
function schedulePulse(t) {
  const mode = getCurrentMode();
  const voiceCount = 1 + patternDepth;

  for (let i = 0; i < voiceCount; i++) {
    const baseProb = mode.pulseProb || 0.4;
    if (!chance(baseProb + patternDepth * 0.04)) continue;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const freq = pickFreq(currentModeKey);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);

    const g = 0.08 + intensity * 0.12;
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0007, t + rand(0.14, 0.32));

    const pan = audioCtx.createStereoPanner();
    pan.pan.value = rand(-0.8, 0.8);

    osc.connect(gain).connect(pan);
    pan.connect(dryGain);
    pan.connect(reverbGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }
}

function scheduleGlitch(t) {
  const mode = getCurrentMode();
  const baseProb = mode.glitchProb || 0.08;
  if (!chance(baseProb + intensity * 0.1)) return;

  const bufferSize = audioCtx.sampleRate * rand(0.05, 0.23);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const pos = i / bufferSize;
    const noise = (Math.random() * 2 - 1) * Math.pow(1 - pos, 1.4);
    const crush = Math.round(noise * 9) / 9;
    data[i] = crush;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 0.6 + intensity * 1.5;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.24 + intensity * 0.3;

  const pan = audioCtx.createStereoPanner();
  pan.pan.value = rand(-1, 1);

  src.connect(gain).connect(pan);
  pan.connect(dryGain);
  pan.connect(reverbGain);

  src.start(t);
}

function schedulerStep(t) {
  const mode = getCurrentMode();
  const stepsPerBar = subdivision * 4;
  const posInBar = step % stepsPerBar;

  // 円観：一定周期で全体を軽くミュート
  if (currentModeKey === "circle" && applyMode.circlePhaseStart) {
    const period = 16; // bar
    const bar = Math.floor(step / stepsPerBar);
    const phase = bar % period;
    if (phase === 0 || phase === period - 1) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(0.25, now, 0.6);
    } else {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(0.9, now, 0.6);
    }
  }

  // グリッド上のパルス
  if (posInBar % 2 === 0) {
    schedulePulse(t);
  }

  // オフグリッド（ズレ）の発生
  if (patternDepth >= 2 && chance(mode.offgridProb || 0.2)) {
    schedulePulse(t + rand(0.01, 0.12));
  }

  // グリッチ
  if (posInBar === 0 && chance(0.6)) {
    scheduleGlitch(t + rand(0.0, 0.05));
  }
  if (patternDepth >= 4 && chance(0.18)) {
    scheduleGlitch(t + rand(0.08, 0.18));
  }

  step++;
}

function schedulerLoop() {
  if (!audioCtx) return;
  const secondsPerBeat = 60 / tempo;

  while (nextTime < audioCtx.currentTime + scheduleAhead) {
    schedulerStep(nextTime);
    nextTime += secondsPerBeat / subdivision;
  }

  schedulerTimer = setTimeout(schedulerLoop, lookaheadMs);
}

// ===================================
// ビジュアライザ
// ===================================
function startViz() {
  const canvas = document.getElementById("viz");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function draw() {
    if (!analyser) return;
    analyser.getByteFrequencyData(analyserData);

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fillRect(0, 0, w, h);

    const barCount = 96;
    const stepSize = Math.floor(analyserData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const v = analyserData[i * stepSize] / 255;
      const barHeight = v * h * 0.5;

      const angle = (i / barCount) * Math.PI * 2;
      const radiusInner = h * 0.18;
      const radiusOuter = radiusInner + barHeight;

      const x1 = w / 2 + Math.cos(angle) * radiusInner;
      const y1 = h / 2 + Math.sin(angle) * radiusInner;
      const x2 = w / 2 + Math.cos(angle) * radiusOuter;
      const y2 = h / 2 + Math.sin(angle) * radiusOuter;

      const alpha = 0.15 + v * 0.85;
      ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    vizTimer = requestAnimationFrame(draw);
  }

  vizTimer = requestAnimationFrame(draw);
}

// ===================================
// UI
// ===================================
function updateStatus(text) {
  const el = document.getElementById("statusText");
  if (el) el.textContent = text;
}

function updateModeText() {
  const mode = getCurrentMode();
  const title = document.getElementById("modeTitle");
  const text = document.getElementById("modeText");
  if (title) title.textContent = mode.name;
  if (text) text.textContent = mode.desc;
}

function startEngine() {
  initAudio();
  if (!audioCtx) return;

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  isRunning = true;
  nextTime = audioCtx.currentTime + 0.05;
  schedulerLoop();
  startViz();
  updateStatus("Running — UCM Mandala Engine がリアルタイム生成中。");
}

function stopEngine() {
  isRunning = false;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  if (vizTimer) {
    cancelAnimationFrame(vizTimer);
    vizTimer = null;
  }
  if (audioCtx && audioCtx.state !== "closed") {
    audioCtx.suspend();
  }
  updateStatus("Paused — エンジン停止中。");
}

window.addEventListener("load", () => {
  const toggleBtn = document.getElementById("toggleBtn");
  const depthSlider = document.getElementById("depth");
  const intensitySlider = document.getElementById("intensity");
  const depthValue = document.getElementById("depthValue");
  const intensityValue = document.getElementById("intensityValue");
  const modeSelect = document.getElementById("mode");

  if (depthSlider && depthValue) {
    depthSlider.addEventListener("input", () => {
      patternDepth = parseInt(depthSlider.value, 10);
      depthValue.textContent = patternDepth.toString();
      updateStatus(`Pattern Depth = ${patternDepth} — 構造の深さを変更。`);
    });
  }

  if (intensitySlider && intensityValue) {
    intensitySlider.addEventListener("input", () => {
      intensity = parseFloat(intensitySlider.value);
      intensityValue.textContent = intensity.toFixed(2);
      updateStatus(`Intensity = ${intensity.toFixed(2)} — 密度と煌めきを調整。`);
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      currentModeKey = modeSelect.value;
      if (audioCtx) {
        applyMode(currentModeKey);
      }
      updateModeText();
      updateStatus(`${getCurrentMode().name} に切り替え。`);
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      if (!isRunning) {
        await audioCtx?.resume?.();
        startEngine();
        toggleBtn.classList.add("running");
        toggleBtn.textContent = "Stop Engine";
      } else {
        stopEngine();
        toggleBtn.classList.remove("running");
        toggleBtn.textContent = "Start Engine";
      }
    });
  }

  updateModeText();
  updateStatus("Idle — 観モードを選んで “Start Engine” を押す。");
});
