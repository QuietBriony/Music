// Concept Music Build Engine
// UCM-2026β inspired Web Audio generative patch

let audioCtx = null;
let masterGain, reverbGain, dryGain;
let analyser, analyserData;
let schedulerTimer = null;
let vizTimer = null;

let isRunning = false;
let nextTime = 0;
let step = 0;

const tempo = 86;           // bpm
const subdivision = 4;      // steps per beat (16th)
const scheduleAhead = 0.15; // seconds
const lookaheadMs = 30;

let patternDepth = 2;
let intensity = 0.5;

// Simple pseudo-random utilities
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function chance(p) {
  return Math.random() < p;
}

// UCM-ish scale: slightly detuned A-based hexachord
const baseFreq = 110; // A2
const scaleRatios = [
  1.0,
  5/4,
  4/3,
  3/2,
  5/3,
  2.0
];

function pickFreq(octaveSpan = 2) {
  const ratio = scaleRatios[Math.floor(Math.random() * scaleRatios.length)];
  const octave = Math.floor(rand(0, octaveSpan)) * 2; // even octaves only
  return baseFreq * ratio * Math.pow(2, octave);
}

function initAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;

  dryGain = audioCtx.createGain();
  dryGain.gain.value = 0.65;

  reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.6;

  const convolver = audioCtx.createConvolver();
  convolver.buffer = buildReverbImpulse(audioCtx, 3.5, 2.2);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyserData = new Uint8Array(analyser.frequencyBinCount);

  // routing
  dryGain.connect(masterGain);
  convolver.connect(reverbGain);
  reverbGain.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  // create slow drone layer
  createDroneLayer();

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
      // gentle noise tail
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return impulse;
}

// ========== Layers ==========

// 1. Drone layer (Void / Wave / Body)
function createDroneLayer() {
  const oscL = audioCtx.createOscillator();
  const oscR = audioCtx.createOscillator();
  const gainL = audioCtx.createGain();
  const gainR = audioCtx.createGain();

  oscL.type = "sine";
  oscR.type = "sine";

  oscL.frequency.value = baseFreq * 0.5;
  oscR.frequency.value = baseFreq * 0.5015; // tiny detune

  gainL.gain.value = 0.22;
  gainR.gain.value = 0.22;

  const pannerL = audioCtx.createStereoPanner();
  const pannerR = audioCtx.createStereoPanner();

  pannerL.pan.value = -0.22;
  pannerR.pan.value = 0.24;

  // slow LFO for drone motion
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.03;
  lfoGain.gain.value = 0.18;

  lfo.connect(lfoGain);
  lfoGain.connect(pannerL.pan);
  lfoGain.connect(pannerR.pan);

  oscL.connect(gainL).connect(pannerL).connect(dryGain);
  oscR.connect(gainR).connect(pannerR).connect(dryGain);

  oscL.start();
  oscR.start();
  lfo.start();
}

// 2. Percussive pulses (patterned)
function schedulePulse(time) {
  const voiceCount = 1 + patternDepth; // more depth = more hits
  for (let i = 0; i < voiceCount; i++) {
    if (!chance(0.45 + (patternDepth * 0.1))) continue;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const freq = pickFreq(2);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);

    const g = 0.08 + intensity * 0.12;
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(g, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + rand(0.15, 0.35));

    const pan = audioCtx.createStereoPanner();
    pan.pan.value = rand(-0.7, 0.7);

    osc.connect(gain).connect(pan);
    pan.connect(dryGain);
    pan.connect(reverbGain);

    osc.start(time);
    osc.stop(time + 0.5);
  }
}

// 3. Glitch / noise bursts
function scheduleGlitch(time) {
  if (!chance(0.08 + intensity * 0.2)) return;

  const bufferSize = audioCtx.sampleRate * rand(0.05, 0.25);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const noise = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5);
    const bitcrush = Math.round(noise * 8) / 8;
    data[i] = bitcrush;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 0.6 + intensity * 1.4;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.3 + intensity * 0.3;

  const pan = audioCtx.createStereoPanner();
  pan.pan.value = rand(-1, 1);

  src.connect(gain).connect(pan);
  pan.connect(dryGain);
  pan.connect(reverbGain);

  src.start(time);
}

// The scheduler glues everything together
function scheduleStep(t) {
  const stepsPerBar = subdivision * 4;
  const posInBar = step % stepsPerBar;

  // Basic gravity: pulses on some grid positions
  if (posInBar % 2 === 0) {
    schedulePulse(t);
  }

  // Additional off-grid hits for higher depths
  if (patternDepth >= 3 && chance(0.35)) {
    schedulePulse(t + rand(0.01, 0.12));
  }

  if (patternDepth >= 2 && posInBar === 0 && chance(0.7)) {
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
    scheduleStep(nextTime);
    nextTime += (secondsPerBeat / subdivision);
  }

  schedulerTimer = setTimeout(schedulerLoop, lookaheadMs);
}

// ========== Visualizer ==========
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

    ctx.fillStyle = "rgba(0, 0, 0, 0.19)";
    ctx.fillRect(0, 0, w, h);

    const barCount = 90;
    const stepSize = Math.floor(analyserData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const v = analyserData[i * stepSize] / 255;
      const barHeight = v * h * 0.45;

      const x = (i / barCount) * w;
      const y = h - barHeight;

      const alpha = 0.3 + v * 0.6;
      ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`;
      ctx.fillRect(x, y, w / barCount * 0.9, barHeight);
    }

    vizTimer = requestAnimationFrame(draw);
  }

  vizTimer = requestAnimationFrame(draw);
}

// ========== UI Wiring ==========
function updateStatus(text) {
  const el = document.getElementById("statusText");
  if (el) el.textContent = text;
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

window.addEventListener("load", () => {
  const toggleBtn = document.getElementById("toggleBtn");
  const depthSlider = document.getElementById("depth");
  const intensitySlider = document.getElementById("intensity");
  const depthValue = document.getElementById("depthValue");
  const intensityValue = document.getElementById("intensityValue");

  if (depthSlider && depthValue) {
    depthSlider.addEventListener("input", () => {
      patternDepth = parseInt(depthSlider.value, 10);
      depthValue.textContent = patternDepth.toString();
      updateStatus(`Pattern Depth = ${patternDepth} — structure complexity adjusted.`);
    });
  }

  if (intensitySlider && intensityValue) {
    intensitySlider.addEventListener("input", () => {
      intensity = parseFloat(intensitySlider.value);
      intensityValue.textContent = intensity.toFixed(2);
      updateStatus(`Intensity = ${intensity.toFixed(2)} — density & brightness adjusted.`);
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

  updateStatus("Idle — click “Start Engine” (browser will ask for audio permission if needed).");
});
