/* --------------------------------------------------------
   UCM Mandala Engine — Tone.js version
   Tidal風ステップシーケンサ × 観フェーダー連動
-------------------------------------------------------- */

// ===== 1. UCM 状態 =====
const UCM = {
  energy: 40,     // 静⇄動
  wave: 40,       // リズムの揺らぎ
  mind: 50,       // 和声の変化量
  creation: 50,   // 音色の派手さ
  void: 20,       // 休符の多さ
  circle: 60,     // 全体の滑らかさ
  body: 50,       // 低域の重さ
  resource: 60,   // 密度・情報量
  observer: 50,   // 空間・リバーブ量
  auto: {
    enabled: false,
    minMinutes: 1,
    maxMinutes: 10,
    timerId: null
  }
};

// ===== 2. ヘルパー =====
function getVal(id) {
  const el = document.getElementById(id);
  return el ? parseInt(el.value, 10) : 0;
}

function updateFromUI() {
  UCM.energy   = getVal("fader_energy");
  UCM.wave     = getVal("fader_wave");
  UCM.mind     = getVal("fader_mind");
  UCM.creation = getVal("fader_creation");
  UCM.void     = getVal("fader_void");
  UCM.circle   = getVal("fader_circle");
  UCM.body     = getVal("fader_body");
  UCM.resource = getVal("fader_resource");
  UCM.observer = getVal("fader_observer");
  applyUCMToSound();
}

function map(x, inMin, inMax, outMin, outMax) {
  return outMin + ((x - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// ===== 3. Tone.js 初期化 =====
let initialized = false;
let isPlaying = false;

// ドラム系
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.02,
  octaves: 4,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.3, sustain: 0 }
}).toDestination();

const snare = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
}).toDestination();

const hat = new Tone.MetalSynth({
  frequency: 250,
  envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
  harmonicity: 5.1,
  modulationIndex: 32
}).toDestination();

// パッド・メロディ
const padFilter = new Tone.Filter(800, "lowpass").toDestination();
const padReverb = new Tone.Reverb({ decay: 5, wet: 0.4 }).connect(padFilter);
const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.6, decay: 1.0, sustain: 0.6, release: 2.0 }
}).connect(padReverb);

// ===== 4. 観 → 音楽パラメータ変換 =====
const params = {
  bpm: 80,
  stepCount: 16,
  kickProb: 0.7,
  snareProb: 0.4,
  hatProb: 0.7,
  restProb: 0.2,
  scale: ["C4", "D4", "E4", "G4", "A4"],
  padDensity: 0.3
};

function applyUCMToSound() {
  // BPM: 静⇄動
  params.bpm = Math.round(map(UCM.energy, 0, 100, 60, 150));
  Tone.Transport.bpm.rampTo(params.bpm, 0.2);

  // ドラムの密度：resource / energy
  params.kickProb = map(UCM.body, 0, 100, 0.3, 0.95);
  params.snareProb = map(UCM.wave, 0, 100, 0.1, 0.7);
  params.hatProb = map(UCM.resource, 0, 100, 0.2, 0.9);

  // 休符量：void
  params.restProb = map(UCM.void, 0, 100, 0.05, 0.6);

  // pad の密度：circle / mind
  params.padDensity = map(UCM.circle, 0, 100, 0.1, 0.6);

  // フィルタ・リバーブ：observer
  const cutoff = map(UCM.observer, 0, 100, 400, 4000);
  padFilter.frequency.rampTo(cutoff, 0.5);

  const wet = map(UCM.observer, 0, 100, 0.2, 0.8);
  padReverb.wet.rampTo(wet, 1.0);

  // スケール選択：mind / creation
  // mind が高いほどテンション（9th, 11th）が混ざるイメージ
  const baseScale = ["C4", "D4", "E4", "G4", "A4"];
  const extNotes = ["B4", "D5", "F5"];

  if (UCM.mind > 60) {
    params.scale = baseScale.concat(extNotes);
  } else {
    params.scale = baseScale;
  }
}

// ===== 5. パターンエンジン（Tidal風ステップ） =====
let stepIndex = 0;

function randomBool(prob) {
  return Math.random() < prob;
}

function nextNoteFromScale() {
  const idx = Math.floor(Math.random() * params.scale.length);
  return params.scale[idx];
}

function scheduleStep(time) {
  // ドラム
  if (!randomBool(params.restProb)) {
    if (randomBool(params.kickProb)) kick.triggerAttackRelease("C2", "8n", time);
    if (randomBool(params.snareProb) && stepIndex % 4 === 2) {
      snare.triggerAttackRelease("16n", time);
    }
    if (randomBool(params.hatProb)) {
      hat.triggerAttackRelease("16n", time);
    }
  }

  // pad / メロディ
  if (randomBool(params.padDensity)) {
    const note = nextNoteFromScale();
    const dur = (Math.random() < 0.3) ? "2n" : "4n";
    pad.triggerAttackRelease(note, dur, time);
  }

  // 次ステップ
  stepIndex = (stepIndex + 1) % params.stepCount;
}

// ===== 6. Transport にループを登録 =====
Tone.Transport.scheduleRepeat((time) => {
  scheduleStep(time);
}, "16n");  // 16ステップで1小節感

// ===== 7. Auto Cycle（観ランダム遷移） =====
function startAutoCycle() {
  stopAutoCycle();
  UCM.auto.enabled = true;

  const minutes = getVal("auto_cycle") || 3;
  const intervalMs = minutes * 60 * 1000;

  UCM.auto.timerId = setInterval(() => {
    // ランダムに観を少しだけ動かす（全部ぶっ壊さないように）
    const sliders = [
      "fader_wave", "fader_mind", "fader_creation",
      "fader_void", "fader_circle", "fader_body",
      "fader_resource", "fader_observer"
    ];

    sliders.forEach(id => {
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
  if (UCM.auto.timerId) {
    clearInterval(UCM.auto.timerId);
    UCM.auto.timerId = null;
  }
}

// ===== 8. UIイベント紐付け =====
function attachUI() {
  const ids = [
    "fader_energy", "fader_wave", "fader_mind", "fader_creation",
    "fader_void", "fader_circle", "fader_body", "fader_resource",
    "fader_observer"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        updateFromUI();
      });
    }
  });

  const btnStart = document.getElementById("btn_start");
  const btnStop = document.getElementById("btn_stop");
  const autoToggle = document.getElementById("auto_toggle");

  if (btnStart) {
    btnStart.onclick = async () => {
      if (!initialized) {
        await Tone.start();          // ブラウザの制約回避
        initialized = true;
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

// ===== 9. ページロード時に初期化 =====
window.addEventListener("DOMContentLoaded", () => {
  attachUI();
  applyUCMToSound();
  console.log("UCM Mandala Engine (Tone.js) initialized");
});
