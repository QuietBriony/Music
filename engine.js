/* =========================================================
   UCM Mandala Engine v1.0
   Tone.js × Tidal風 × 観フェーダー同期 × ライブ生成
========================================================= */

/* --------------------
   0. GLOBAL VAR
-------------------- */
let initialized = false;
let isPlaying = false;

// ===== UCM PARAMETERS =====
const UCM = {
  energy: 40,
  wave: 40,
  mind: 50,
  creation: 50,
  void: 20,
  circle: 60,
  body: 50,
  resource: 60,
  observer: 50,

  auto: {
    enabled: false,
    timer: null,
    min: 1,
    max: 10,
  }
};

/* =========================================================
    1. HELPERS
========================================================= */

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

  applyUCM();
}

function map(x, a, b, c, d) {
  if (b === a) return c;
  return c + ((x - a) / (b - a)) * (d - c);
}

function rand(prob) {
  return Math.random() < prob;
}

/* =========================================================
    2. TONE.JS INSTRUMENTS
========================================================= */

// Kick
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.03,
  octaves: 6,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.4, sustain: 0 }
}).toDestination();

// Snare
const snare = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: { attack: 0.005, decay: 0.2, sustain: 0 }
}).toDestination();

// Hat
const hat = new Tone.MetalSynth({
  frequency: 320,
  envelope: { attack: 0.001, decay: 0.07, release: 0.05 },
  harmonicity: 5,
  modulationIndex: 40
}).toDestination();

// Pad
const padFilter = new Tone.Filter(1000, "lowpass").toDestination();
const padReverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).connect(padFilter);

const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 1.0, decay: 0.6, sustain: 0.6, release: 3.0 }
}).connect(padReverb);

/* =========================================================
    3. UCM → SOUND PARAM MAPPING
========================================================= */
const params = {
  bpm: 80,
  stepCount: 16,
  kickProb: 0.7,
  snareProb: 0.4,
  hatProb: 0.7,
  restProb: 0.2,
  padProb: 0.3,
  scale: ["C4", "D4", "E4", "G4", "A4"]
};

function applyUCM() {
  // BPM: 静⇄動
  params.bpm = Math.round(map(UCM.energy, 0, 100, 60, 150));
  Tone.Transport.bpm.rampTo(params.bpm, 0.2);

  // ドラム密度
  params.kickProb  = map(UCM.body,     0, 100, 0.3, 0.95);
  params.snareProb = map(UCM.wave,     0, 100, 0.1, 0.7);
  params.hatProb   = map(UCM.resource, 0, 100, 0.1, 0.95);

  // 休符量：Void
  params.restProb  = map(UCM.void, 0, 100, 0.05, 0.6);

  // Pad密度：円観
  params.padProb   = map(UCM.circle, 0, 100, 0.1, 0.7);

  // フィルタ・リバーブ：観察者
  const cutoff = map(UCM.observer, 0, 100, 400, 5000);
  padFilter.frequency.rampTo(cutoff, 0.5);

  const wet = map(UCM.observer, 0, 100, 0.2, 0.8);
  padReverb.wet.rampTo(wet, 0.8);

  // スケール：mind / creation
  const baseScale = ["C4", "D4", "E4", "G4", "A4"];
  const tension   = ["B3", "B4", "D5", "F5"];

  if (UCM.mind > 60 || UCM.creation > 60) {
    params.scale = baseScale.concat(tension);
  } else {
    params.scale = baseScale;
  }
}

/* =========================================================
    4. PATTERN ENGINE（Tidal風）
========================================================= */

let stepIndex = 0;

function nextNoteFromScale() {
  const idx = Math.floor(Math.random() * params.scale.length);
  return params.scale[idx];
}

function scheduleStep(time) {
  // 休符確率（Void）に応じて丸ごと休むこともある
  if (!rand(params.restProb)) {
    // Kick: 4つ打ち成分＋ランダム
    if (rand(params.kickProb) || stepIndex % 4 === 0) {
      kick.triggerAttackRelease("C2", "8n", time);
    }

    // Snare: 2, 4拍目を中心に
    if ((stepIndex % 8 === 4 || stepIndex % 8 === 6) && rand(params.snareProb)) {
      snare.triggerAttackRelease("16n", time);
    }

    // Hat: 全体の細かさ
    if (rand(params.hatProb)) {
      hat.triggerAttackRelease("32n", time);
    }
  }

  // Pad / メロ
  if (rand(params.padProb)) {
    const note = nextNoteFromScale();
    const dur  = rand(0.3) ? "2n" : "4n";
    pad.triggerAttackRelease(note, dur, time);
  }

  // 次のステップ
  stepIndex = (stepIndex + 1) % params.stepCount;
}

// Tone.Transport に登録（16分音符刻み）
Tone.Transport.scheduleRepeat((time) => {
  scheduleStep(time);
}, "16n");

/* =========================================================
    5. AUTO CYCLE（観フェーダーをじわっと動かす）
========================================================= */

function startAutoCycle() {
  stopAutoCycle();
  UCM.auto.enabled = true;

  const minutes = getVal("auto_cycle") || 3;
  const intervalMs = minutes * 60 * 1000;

  UCM.auto.timer = setInterval(() => {
    const sliderIds = [
      "fader_wave",
      "fader_mind",
      "fader_creation",
      "fader_void",
      "fader_circle",
      "fader_body",
      "fader_resource",
      "fader_observer"
    ];

    sliderIds.forEach(id => {
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
    6. UI BINDINGS
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

  // Start / Stop
  const btnStart = document.getElementById("btn_start");
  const btnStop  = document.getElementById("btn_stop");
  const autoToggle = document.getElementById("auto_toggle");

  if (btnStart) {
    btnStart.onclick = async () => {
      if (!initialized) {
        await Tone.start();      // ブラウザのユーザー操作制限を解除
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

/* =========================================================
    7. INIT
========================================================= */
window.addEventListener("DOMContentLoaded", () => {
  attachUI();
  applyUCM();
  console.log("UCM Mandala Engine (Tone.js) v1.0 ready");
});
