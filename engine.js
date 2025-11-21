// UCM Mandala Engine v0.3
// 八観 + Urei風ミキサー + Ambient/Club crossfader

let audioCtx = null;
let masterGain, reverbGain, dryGain;
let analyser, analyserData;
let schedulerTimer = null;
let vizTimer = null;

let isRunning = false;
let nextTime = 0;
let step = 0;

// timing
let tempo = 86;
const subdivision = 4;
const scheduleAhead = 0.15;
const lookaheadMs = 30;

// controls
let patternDepth = 2;
let intensity = 0.5;
let energy = 0.25; // 0 = Ambient, 1 = Club
let currentModeKey = "void";

const baseFreq = 110;

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
    desc: "なめらかな倍音アルペジオが波のようにうねる状態。",
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
    desc: "リズムとパターンの構造が立ち上がる領域。",
    tempo: 86,
    droneLevel: 0.24,
    pulseProb: 0.6,
    offgridProb: 0.35,
    glitchProb: 0.11,
    scaleSpread: 3
  },
  creation: {
    name: "創 観",
    desc: "グリッチと偶然性が強くなるモード。",
    tempo: 94,
    droneLevel: 0.2,
    pulseProb: 0.52,
    offgridProb: 0.5,
    glitchProb: 0.22,
    scaleSpread: 3
  },
  value: {
    name: "財 観",
    desc: "ややポップで聴きやすいモード。Lo-Fi Beat に寄った質感。",
    tempo: 92,
    droneLevel: 0.23,
    pulseProb: 0.65,
    offgridProb: 0.25,
    glitchProb: 0.06,
    scaleSpread: 2
  },
  observer: {
    name: "観察者 観",
    desc: "内部の状態変化に応じて音量・密度がゆっくり変化する。",
    tempo: 78,
    droneLevel: 0.22,
    pulseProb: 0.45,
    offgridProb: 0.2,
    glitchProb: 0.1,
    scaleSpread: 2.5
  },
  circle: {
    name: "円 観",
    desc: "一定周期で静と動がゆっくり巡回するモード。",
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
let droneGainNodes = [];

// util
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function chance(p) {
  return Math.random() < p;
}
const scaleRatios = [1.0, 5/4, 4/3, 3/2, 5/3, 2.0];
function pickFreq(modeKey) {
  const mode = MODES[modeKey] || MODES.wave;
  const spread = mode.scaleSpread || 2;
  const ratio = scaleRatios[Math.floor(Math.random() * scaleRatios.length)];
  const octave = Math.floor(rand(0, spread)) * 2;
  return baseFreq * ratio * Math.pow(2, octave);
}

// audio init
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

  dryGain.connect(masterGain);
  reverbGain.connect(masterGain);
  reverbGain.connect(convolver);
  convolver.connect(reverbGain);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyserData = new Uint8Array(analyser.frequencyBinCount);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

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

  droneGainNodes = [gainL, gainR];
}

function createModeLfo() {
  modeLfo = audioCtx.createOscillator();
  modeLfoGain = audioCtx.createGain();
  modeLfo.type = "sine";
  modeLfo.frequency.value = 0.005;
  modeLfoGain.gain.value = 0.0;

  modeLfo.connect(modeLfoGain);
  modeLfoGain.connect(masterGain.gain);
  modeLfo.start();
}

function getCurrentMode() {
  return MODES[currentModeKey] || MODES.wave;
}

// apply mode and energy
function applyMode(key) {
  if (!audioCtx) return;
  const mode = MODES[key] || MODES.wave;
  currentModeKey = key;

  tempo = mode.tempo;

  const now = audioCtx.currentTime;

  if (droneGainNodes.length) {
    const levelBase = mode.droneLevel;
    const energyFactor = 1 - energy * 0.7;
    const target = levelBase * (0.7 + energyFactor * 0.6);
    droneGainNodes.forEach(g => {
      g.gain.cancelScheduledValues(now);
      g.gain.linearRampToValueAtTime(target, now + 1.0);
    });
  }

  if (modeLfoGain) {
    modeLfoGain.gain.cancelScheduledValues(now);
    if (key === "observer" || key === "circle") {
      modeLfoGain.gain.linearRampToValueAtTime(0.07, now + 1.0);
    } else {
      modeLfoGain.gain.linearRampToValueAtTime(0.0, now + 1.0);
    }
  }

  if (key === "circle") {
    applyMode.circlePhaseStart = now;
  }

  updateModeText();
}

function updateEnergy() {
  if (!audioCtx) return;
  const mode = getCurrentMode();
  const now = audioCtx.currentTime;

  // tempo morph: Ambient側で0.7倍、Club側で1.6倍くらい
  const baseTempo = mode.tempo;
  const k = energy;
  tempo = baseTempo * (0.7 + k * 0.9);

  // drone balance
  if (droneGainNodes.length) {
    const levelBase = mode.droneLevel;
    const energyFactor = 1 - energy * 0.7;
    const target = levelBase * (0.6 + energyFactor * 0.7);
    droneGainNodes.forEach(g => {
      g.gain.cancelScheduledValues(now);
      g.gain.linearRampToValueAtTime(target, now + 0.8);
    });
  }

  // master slight lift on Club side
  const targetMaster = 0.85 + energy * 0.25;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.5);
}

// kick for Club side
function scheduleKick(t) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(85, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);

  const g = 0.16 + intensity * 0.14;
  gain.gain.setValueAtTime(g, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);

  const comp = audioCtx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255 * 2 - 1;
    curve[i] = Math.tanh(x * 2.4);
  }
  comp.curve = curve;
  comp.oversample = "4x";

  osc.connect(gain).connect(comp).connect(dryGain);
  osc.start(t);
  osc.stop(t + 0.3);
}

// pulses and glitches
function schedulePulse(t) {
  const mode = getCurrentMode();
  const voiceCount = 1 + patternDepth;
  const baseProb = mode.pulseProb || 0.4;
  const energyBoost = 0.3 * energy;

  for (let i = 0; i < voiceCount; i++) {
    if (!chance(baseProb + patternDepth * 0.04 + energyBoost)) continue;

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
  const energyBoost = 0.2 * energy;
  if (!chance(baseProb + intensity * 0.1 + energyBoost)) return;

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
  src.playbackRate.value = 0.6 + intensity * 1.5 + energy * 0.4;

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

  // 円観: bar単位の呼吸
  if (currentModeKey === "circle" && applyMode.circlePhaseStart) {
    const bar = Math.floor(step / stepsPerBar);
    const phase = bar % 16;
    const now = audioCtx.currentTime;
    if (phase === 0 || phase === 15) {
      masterGain.gain.setTargetAtTime(0.35, now, 0.6);
    } else {
      masterGain.gain.setTargetAtTime(0.9 + energy * 0.2, now, 0.6);
    }
  }

  // basic grid pulses
  if (posInBar % 2 === 0) schedulePulse(t);

  // off-grid
  if (patternDepth >= 2 && chance(mode.offgridProb || 0.2)) {
    schedulePulse(t + rand(0.01, 0.12));
  }

  // glitch
  if (posInBar === 0 && chance(0.6)) {
    scheduleGlitch(t + rand(0.0, 0.05));
  }
  if (patternDepth >= 4 && chance(0.18)) {
    scheduleGlitch(t + rand(0.08, 0.18));
  }

  // Club side: simple four-on-the-floor kick
  const clubAmount = energy;
  if (clubAmount > 0.35) {
    const barPosBeat = posInBar / subdivision;
    if (barPosBeat === 0 || barPosBeat === 2) {
      // downbeats
      if (chance(0.6 + clubAmount * 0.3)) {
        scheduleKick(t);
      }
    }
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

// visualizer (simple mandala-like radial bars)
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
    if (!analyser) {
      requestAnimationFrame(draw);
      return;
    }
    analyser.getByteFrequencyData(analyserData);
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radiusBase = Math.min(w, h) * 0.16;

    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fillRect(0, 0, w, h);

    const petals = 96;
    const stepSize = Math.floor(analyserData.length / petals);

    for (let i = 0; i < petals; i++) {
      const v = analyserData[i * stepSize] / 255;
      const angle = (i / petals) * Math.PI * 2;
      const len = radiusBase + v * Math.min(w, h) * 0.24 * (0.5 + energy);

      const x1 = cx + Math.cos(angle) * radiusBase;
      const y1 = cy + Math.sin(angle) * radiusBase;
      const x2 = cx + Math.cos(angle) * len;
      const y2 = cy + Math.sin(angle) * len;

      const alpha = 0.25 + v * 0.6;
      ctx.strokeStyle = `rgba(129,140,248,${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // center halo
    const halo = radiusBase * (0.9 + energy * 0.4);
    const grad = ctx.createRadialGradient(cx, cy, halo * 0.1, cx, cy, halo);
    grad.addColorStop(0, "rgba(248,250,252,0.14)");
    grad.addColorStop(1, "rgba(15,23,42,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, halo, 0, Math.PI * 2);
    ctx.fill();

    vizTimer = requestAnimationFrame(draw);
  }

  vizTimer = requestAnimationFrame(draw);
}

// UI helpers
function updateModeText() {
  const mode = getCurrentMode();
  const titleEl = document.getElementById("modeTitle");
  const textEl = document.getElementById("modeText");
  if (titleEl) titleEl.textContent = mode.name;
  if (textEl) textEl.textContent = mode.desc;
}

function updateStatus(text) {
  const el = document.getElementById("statusText");
  if (el) el.textContent = text;
}

function startEngine() {
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  isRunning = true;
  nextTime = audioCtx.currentTime + 0.05;
  schedulerLoop();
  startViz();
  updateStatus("Running — generative engine is evolving in real time.");
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
  updateStatus("Paused — engine suspended, audio context kept alive.");
}

// knob visual rotation
function attachKnobRotation(knobEl, sliderEl, min, max) {
  const indicator = knobEl.querySelector(".knob-indicator");
  if (!indicator) return;
  const range = max - min;
  const update = () => {
    const v = parseFloat(sliderEl.value);
    const norm = (v - min) / range;
    const deg = -135 + norm * 270;
    indicator.style.transform = `rotate(${deg}deg)`;
  };
  sliderEl.addEventListener("input", update);
  update();
}

// wiring
window.addEventListener("load", () => {
  const toggleBtn = document.getElementById("toggleBtn");
  const modeSelect = document.getElementById("mode");
  const depthSlider = document.getElementById("depth");
  const intensitySlider = document.getElementById("intensity");
  const energySlider = document.getElementById("energy");

  // knobs
  const depthKnob = document.querySelector('.knob[data-target="depth"]');
  const intensityKnob = document.querySelector('.knob[data-target="intensity"]');
  if (depthKnob && depthSlider) attachKnobRotation(depthKnob, depthSlider, 1, 4);
  if (intensityKnob && intensitySlider) attachKnobRotation(intensityKnob, intensitySlider, 0, 1);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      if (!audioCtx) initAudio();
      if (!isRunning) {
        await audioCtx.resume();
        startEngine();
        toggleBtn.classList.add("running");
        toggleBtn.textContent = "Stop";
      } else {
        stopEngine();
        toggleBtn.classList.remove("running");
        toggleBtn.textContent = "Start Engine";
      }
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      if (!audioCtx) initAudio();
      applyMode(modeSelect.value);
      updateStatus("Mode = " + getCurrentMode().name);
    });
  }

  if (depthSlider) {
    patternDepth = parseInt(depthSlider.value, 10);
    depthSlider.addEventListener("input", () => {
      patternDepth = parseInt(depthSlider.value, 10);
      updateStatus("Pattern Depth = " + patternDepth);
    });
  }

  if (intensitySlider) {
    intensity = parseFloat(intensitySlider.value);
    intensitySlider.addEventListener("input", () => {
      intensity = parseFloat(intensitySlider.value);
      updateStatus("Intensity = " + intensity.toFixed(2));
    });
  }

  if (energySlider) {
    energy = parseFloat(energySlider.value);
    energySlider.addEventListener("input", () => {
      energy = parseFloat(energySlider.value);
      if (!audioCtx) initAudio();
      updateEnergy();
      updateStatus("Energy (Ambient ⇔ Club) = " + energy.toFixed(2));
    });
  }

  updateModeText();
  updateStatus("Idle — “Start Engine” を押すと生成開始。");
});
