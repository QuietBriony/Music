/* =========================================================
   UCM Mandala Engine v3.0 (Full)
   Tone.js × Tidal風パターン × 観フェーダー同期 × 自動生成
   - ファイル音源不要
   - GitHub Pages 上で動作
========================================================= */

/* --------------------
   0. UCM 状態
-------------------- */

const UCM = {
  energy: 40,    // 静 ⇄ 動
  wave: 40,      // リズム揺らぎ
  mind: 50,      // 和声・テンション
  creation: 50,  // サウンドデザイン
  void: 20,      // 休符の多さ
  circle: 60,    // 全体の滑らかさ
  body: 50,      // 低域
  resource: 60,  // 密度・情報量
  observer: 50,  // 空間・リバーブ

  auto: {
    enabled: false,
    timer: null,
  }
};

let initialized = false;
let isPlaying  = false;

/* =========================================================
   1. ヘルパー
========================================================= */

function getSliderValue(id, fallback = 50) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  return parseInt(el.value, 10);
}

function updateFromUI() {
  // UIが存在しない場合にも耐える
  UCM.energy   = getSliderValue("fader_energy",   UCM.energy);
  UCM.wave     = getSliderValue("fader_wave",     UCM.wave);
  UCM.mind     = getSliderValue("fader_mind",     UCM.mind);
  UCM.creation = getSliderValue("fader_creation", UCM.creation);
  UCM.void     = getSliderValue("fader_void",     UCM.void);
  UCM.circle   = getSliderValue("fader_circle",   UCM.circle);
  UCM.body     = getSliderValue("fader_body",     UCM.body);
  UCM.resource = getSliderValue("fader_resource", UCM.resource);
  UCM.observer = getSliderValue("fader_observer", UCM.observer);

  applyUCMToParams();
}

function mapValue(x, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (x - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function rand(prob) {
  return Math.random() < prob;
}

/* =========================================================
   2. Tone.js グローバル構成
========================================================= */

// マスター処理
const masterLimiter = new Tone.Limiter(-1).toDestination();
const masterComp    = new Tone.Compressor(-18, 3).connect(masterLimiter);
const masterGain    = new Tone.Gain(0.8).connect(masterComp);

// FX センド
const globalReverb = new Tone.Reverb({
  decay: 8,
  wet: 0.45
}).connect(masterGain);

const globalDelay = new Tone.PingPongDelay({
  delayTime: "8n",
  feedback: 0.45,
  wet: 0.25
}).connect(masterGain);

const textureReverb = new Tone.Reverb({
  decay: 10,
  wet: 0.7
}).connect(masterGain);

// バス
const drumBus    = new Tone.Gain(0.9).connect(globalReverb);
const bassBus    = new Tone.Gain(0.8).connect(globalDelay);
const padBus     = new Tone.Gain(0.9).connect(globalReverb);
const textureBus = new Tone.Gain(0.4).connect(textureReverb);

// ===== 楽器定義 =====

// Kick
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.03,
  octaves: 6,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.4, sustain: 0 }
}).connect(drumBus);

// Snare
const snare = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: { attack: 0.004, decay: 0.2, sustain: 0 }
}).connect(drumBus);

// Hat
const hat = new Tone.MetalSynth({
  frequency: 300,
  envelope: { attack: 0.001, decay: 0.07, release: 0.02 },
  harmonicity: 5,
  modulationIndex: 40,
  resonance: 3000
}).connect(drumBus);

// Perc（クリックやリムショット的）
const percFilter = new Tone.Filter(2500, "bandpass").connect(drumBus);
const perc = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
}).connect(percFilter);

// Bass
const bass = new Tone.MonoSynth({
  oscillator: { type: "sawtooth" },
  filter: { type: "lowpass", Q: 1 },
  filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.4, baseFrequency: 100, octaves: 2 },
  envelope: { attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.6 }
}).connect(bassBus);

// Pad
const padFilter = new Tone.Filter(1200, "lowpass").connect(padBus);
const padReverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).connect(padFilter);

const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 1.5, decay: 0.8, sustain: 0.7, release: 4.0 }
}).connect(padReverb);

// Texture（空気の揺らぎ）
const textureNoise = new Tone.Noise("pink").start();
const textureFilter = new Tone.Filter(800, "lowpass").connect(textureBus);
const textureGain   = new Tone.Gain(0.1).connect(textureFilter);
textureNoise.connect(textureGain);

/* =========================================================
   3. パラメータ構造
========================================================= */

const EngineParams = {
  bpm: 80,
  stepCount: 16,
  mode: "ambient", // ambient / lofi / techno / trance / dub

  kickProb: 0.7,
  snareProb: 0.4,
  hatProb: 0.7,
  percProb: 0.3,
  bassProb: 0.4,
  padProb: 0.4,
  restProb: 0.2,

  bassPattern: "x...x..x....x..x",
  kickPattern: "x...x...x...x...",
  snarePattern: "...x....x....x..",
  hatPattern:   "x.x.x.x.x.x.x.x.",
  padPattern:   "x...x...x...x..."
};

// スケール
let currentScale = ["C4", "D4", "E4", "G4", "A4"];
let bassRoot     = "C2";

function chooseMode() {
  const e = UCM.energy;
  if (e < 20) return "deep-ambient";
  if (e < 40) return "ambient";
  if (e < 60) return "lofi";
  if (e < 80) return "techno";
  return "trance-dub";
}

/* =========================================================
   4. UCM → 音楽パラメータ
========================================================= */

function applyUCMToParams() {
  // BPM
  EngineParams.bpm = Math.round(mapValue(UCM.energy, 0, 100, 48, 148));
  Tone.Transport.bpm.rampTo(EngineParams.bpm, 0.3);

  // モード選択
  EngineParams.mode = chooseMode();

  // 休符率（Void）
  EngineParams.restProb = mapValue(UCM.void, 0, 100, 0.05, 0.65);

  // ドラム密度
  EngineParams.kickProb =
    mapValue(UCM.body, 0, 100, 0.3, EngineParams.mode.includes("ambient") ? 0.7 : 0.98);
  EngineParams.snareProb =
    mapValue(UCM.wave, 0, 100, 0.1, EngineParams.mode === "lofi" ? 0.7 : 0.5);
  EngineParams.hatProb =
    mapValue(UCM.resource, 0, 100, 0.1, EngineParams.mode.includes("techno") ? 0.95 : 0.6);
  EngineParams.percProb =
    mapValue(UCM.creation, 0, 100, 0.0, 0.6);

  // Bass・Pad
  EngineParams.bassProb =
    mapValue(UCM.body, 0, 100, 0.1, EngineParams.mode.includes("ambient") ? 0.3 : 0.8);
  EngineParams.padProb =
    mapValue(UCM.circle, 0, 100, 0.15, 0.8);

  // フィルタ・リバーブ
  const padCutoff = mapValue(UCM.observer, 0, 100, 500, 5000);
  padFilter.frequency.rampTo(padCutoff, 1.0);

  const reverbWet = mapValue(UCM.observer, 0, 100, 0.2, 0.9);
  padReverb.wet.rampTo(reverbWet, 2.0);
  globalReverb.wet.rampTo(reverbWet * 0.8, 2.0);

  // Delay のウェットとフィードバック（トランス/ダブ寄りで強く）
  const delayWet = EngineParams.mode.includes("trance") || EngineParams.mode.includes("dub")
    ? mapValue(UCM.creation, 0, 100, 0.2, 0.6)
    : mapValue(UCM.creation, 0, 100, 0.05, 0.3);
  globalDelay.wet.rampTo(delayWet, 1.0);

  const feedback = mapValue(UCM.wave, 0, 100, 0.25, 0.7);
  globalDelay.feedback.rampTo(feedback, 1.0);

  // テクスチャの量（環境ノイズ）
  const texGain = mapValue(UCM.circle, 0, 100, 0.05, 0.2);
  textureGain.gain.rampTo(texGain, 2.0);

  // スケール選択：mind / creation
  const baseScale = ["C4", "D4", "E4", "G4", "A4"];
  const tensions  = ["B3", "B4", "D5", "F5"];
  if (UCM.mind > 60 || UCM.creation > 60) {
    currentScale = baseScale.concat(tensions);
  } else {
    currentScale = baseScale;
  }

  // ルート音（mode によって若干変える）
  if (EngineParams.mode === "lofi") {
    bassRoot = "A1";
  } else if (EngineParams.mode.includes("trance")) {
    bassRoot = "D2";
  } else if (EngineParams.mode.includes("techno")) {
    bassRoot = "C2";
  } else {
    bassRoot = "F1";
  }

  // パターン雛形（Tidal風）
  setPatternsByMode();
}

function setPatternsByMode() {
  switch (EngineParams.mode) {
    case "deep-ambient":
      EngineParams.kickPattern  = "................";
      EngineParams.snarePattern = "................";
      EngineParams.hatPattern   = "x...x...x...x...";
      EngineParams.bassPattern  = "x...............";
      EngineParams.padPattern   = "x...x...x...x...";
      break;
    case "ambient":
      EngineParams.kickPattern  = "x...............";
      EngineParams.snarePattern = ".......x........";
      EngineParams.hatPattern   = "x.x.x.x.x.x.x.x.";
      EngineParams.bassPattern  = "x......x........";
      EngineParams.padPattern   = "x...x...x...x...";
      break;
    case "lofi":
      EngineParams.kickPattern  = "x...x...x..x....";
      EngineParams.snarePattern = "....x.......x...";
      EngineParams.hatPattern   = "x.x.x.x.x.x.x.x.";
      EngineParams.bassPattern  = "x...x...x...x...";
      EngineParams.padPattern   = "x...x...x...x...";
      break;
    case "techno":
      EngineParams.kickPattern  = "x...x...x...x...";
      EngineParams.snarePattern = "....x.......x...";
      EngineParams.hatPattern   = "x.x.x.x.x.x.x.x.";
      EngineParams.bassPattern  = "x..x..x..x..x..x";
      EngineParams.padPattern   = "x...x...x...x...";
      break;
    case "trance-dub":
    default:
      EngineParams.kickPattern  = "x...x...x...x...";
      EngineParams.snarePattern = "....x.......x...";
      EngineParams.hatPattern   = "x.xxx.x.xxx.x.xx";
      EngineParams.bassPattern  = "x..x..x..x..x..x";
      EngineParams.padPattern   = "x...x...x...x...";
      break;
  }
}

/* =========================================================
   5. Tidal風ステップシーケンサ
========================================================= */

let stepIndex = 0;
let barIndex  = 0;

function patternAt(pattern, step) {
  if (!pattern || pattern.length === 0) return false;
  const ch = pattern[step % pattern.length];
  return ch === "x" || ch === "o" || ch === "X";
}

function randomNoteFromScale() {
  const idx = Math.floor(Math.random() * currentScale.length);
  return currentScale[idx];
}

function scheduleStep(time) {
  const step = stepIndex % EngineParams.stepCount;

  // 休符チェック（Void）
  const isRest = rand(EngineParams.restProb);

  if (!isRest) {
    // Kick
    if (patternAt(EngineParams.kickPattern, step) && rand(EngineParams.kickProb)) {
      kick.triggerAttackRelease("C2", "8n", time);
    }

    // Snare
    if (patternAt(EngineParams.snarePattern, step) && rand(EngineParams.snareProb)) {
      snare.triggerAttackRelease("16n", time);
    }

    // Hat
    if (patternAt(EngineParams.hatPattern, step) && rand(EngineParams.hatProb)) {
      hat.triggerAttackRelease("32n", time);
    }

    // Perc（グリッチ要素）
    if (rand(EngineParams.percProb) && (step % 3 === 0)) {
      perc.triggerAttackRelease("32n", time);
    }

    // Bass
    if (patternAt(EngineParams.bassPattern, step) && rand(EngineParams.bassProb)) {
      const bassNote = bassRoot;
      bass.triggerAttackRelease(bassNote, "8n", time);
    }

    // Pad / メロ
    if (patternAt(EngineParams.padPattern, step) && rand(EngineParams.padProb)) {
      const note = randomNoteFromScale();
      const dur  = (EngineParams.mode.includes("ambient") || EngineParams.mode === "deep-ambient")
        ? "2n"
        : (rand(0.3) ? "2n" : "4n");
      pad.triggerAttackRelease(note, dur, time);
    }
  }

  stepIndex++;

  if (stepIndex % EngineParams.stepCount === 0) {
    barIndex++;
    // 数小節ごとにわずかに揺らぎ
    if (barIndex % 8 === 0) {
      smallDrift();
    }
  }
}

function smallDrift() {
  // わずかに EngineParams をランダムウォークさせる（長時間聴いても飽きないように）
  EngineParams.restProb = Math.min(0.8, Math.max(0.0, EngineParams.restProb + (Math.random() - 0.5) * 0.05));
}

/* =========================================================
   6. Auto Cycle（観フェーダー自動変化）
========================================================= */

function startAutoCycle() {
  stopAutoCycle();
  UCM.auto.enabled = true;

  const autoSlider = document.getElementById("auto_cycle");
  const minutes = autoSlider ? parseInt(autoSlider.value, 10) || 3 : 3;
  const intervalMs = minutes * 60 * 1000;

  UCM.auto.timer = setInterval(() => {
    const ids = [
      "fader_wave",
      "fader_mind",
      "fader_creation",
      "fader_void",
      "fader_circle",
      "fader_body",
      "fader_resource",
      "fader_observer"
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      let v = parseInt(el.value, 10);
      const delta = Math.floor((Math.random() - 0.5) * 20); // -10〜+10
      v = Math.max(0, Math.min(100, v + delta));
      el.value = v;
    });

    updateFromUI();
  }, intervalMs);
}

function stopAutoCycle() {
  UCM.auto.enabled = false;
  if (UCM.auto.timer) {
    clearInterval(UCM.auto.timer);
    UCM.auto.timer = null;
  }
}

/* =========================================================
   7. UI バインド
========================================================= */

function attachUI() {
  // フェーダー
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

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      updateFromUI();
    });
  });

  const btnStart   = document.getElementById("btn_start");
  const btnStop    = document.getElementById("btn_stop");
  const autoToggle = document.getElementById("auto_toggle");

  if (btnStart) {
    btnStart.onclick = async () => {
      if (!initialized) {
        await Tone.start();       // ブラウザ制約解除
        initialized = true;

        // Transport にステップを登録
        Tone.Transport.scheduleRepeat((time) => {
          scheduleStep(time);
        }, "16n");
      }
      updateFromUI();
      if (!isPlaying) {
        Tone.Transport.start();
        isPlaying = true;
      }
    };
  }

  if (btnStop) {
    btnStop.onclick = () => {
      Tone.Transport.stop();
      isPlaying = false;
    };
  }

  if (autoToggle) {
    autoToggle.onchange = (e) => {
      if (e.target.checked) startAutoCycle();
      else stopAutoCycle();
    };
  }
}

/* =========================================================
   8. INIT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  attachUI();
  applyUCMToParams();
  console.log("UCM Mandala Engine v3.0 (Full) ready");
});
