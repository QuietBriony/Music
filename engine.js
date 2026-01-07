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
  }
};

let initialized = false;
let isPlaying   = false;

/* =========================================================
   1. ヘルパー
========================================================= */

function getSliderValue(id, fallback = 50) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  return parseInt(el.value, 10);
}

function updateFromUI() {
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
   2. Tone.js 構成（軽量版）
========================================================= */

// マスター処理（少なめ）
const masterLimiter = new Tone.Limiter(-1).toDestination();
const masterGain    = new Tone.Gain(0.8).connect(masterLimiter);

// シンプルなリバーブ＆ディレイのみ
const globalReverb = new Tone.Reverb({
  decay: 5,
  wet: 0.3,
}).connect(masterGain);

const globalDelay = new Tone.PingPongDelay({
  delayTime: "8n",
  feedback: 0.3,
  wet: 0.2,
}).connect(masterGain);

// バス
const drumBus = new Tone.Gain(0.9).connect(globalReverb);
const padBus  = new Tone.Gain(0.9).connect(globalReverb);
const bassBus = new Tone.Gain(0.8).connect(globalDelay);

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

let bassRoot     = "C2";

/* =========================================================
   4. UCM → パラメータ変換（簡略チューン）
========================================================= */

function chooseMode() {
  const e = UCM.energy;
  if (e < 25) return "ambient";
  if (e < 50) return "lofi";
  if (e < 75) return "techno";
  return "trance";
}

function applyUCMToParams() {
  // BPM
  EngineParams.bpm = Math.round(mapValue(UCM.energy, 0, 100, 50, 135));
  Tone.Transport.bpm.rampTo(EngineParams.bpm, 0.3);

  // モード
  EngineParams.mode = resolveMode();

  // 休符
  EngineParams.restProb = mapValue(UCM.void, 0, 100, 0.05, 0.6);

  // ドラム密度
  EngineParams.kickProb = mapValue(UCM.body, 0, 100, 0.3, 0.95);
  EngineParams.hatProb  = mapValue(UCM.resource, 0, 100, 0.2, 0.9);

  // Bass / Pad
  EngineParams.bassProb = mapValue(UCM.body, 0, 100, 0.1, 0.7);
  EngineParams.padProb  = mapValue(UCM.circle, 0, 100, 0.2, 0.8);

  // リバーブ/ディレイ量を少しだけ動かす（軽量）
  const reverbWet = mapValue(UCM.observer, 0, 100, 0.15, 0.5);
  globalReverb.wet.rampTo(reverbWet, 1.5);

  const delayWet = mapValue(UCM.creation, 0, 100, 0.05, 0.35);
  globalDelay.wet.rampTo(delayWet, 1.0);

  // Padのカットオフ
  const cutoff = mapValue(UCM.observer, 0, 100, 400, 4000);
  padFilter.frequency.rampTo(cutoff, 1.0);

  // スケール
  const baseScale = ["C4", "D4", "E4", "G4", "A4"];
  const tensions  = ["B3", "B4", "D5", "F5"];
  if (UCM.mind > 60 || UCM.creation > 60) {
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

  // If a preset is manually selected, apply it (best-effort).
  const manual = PresetManager.selected && PresetManager.selected !== "__auto__";
  if (manual && PresetManager.presets[EngineParams.mode]) {
    applyPresetToEngineParams(PresetManager.presets[EngineParams.mode]);
  }

  setPatternsByMode();
  updateUIFromParams();
}


function updateUIFromParams(){
  const modeLabel = document.getElementById("mode-label");
  if (modeLabel) modeLabel.textContent = EngineParams.mode.toUpperCase();

  const bpmValue = document.getElementById("bpm-value");
  if (bpmValue) bpmValue.textContent = `${EngineParams.bpm} BPM`;

  const energyValue = document.getElementById("energy-value");
  if (energyValue) energyValue.textContent = `${UCM.energy}`;
}

function setPatternsByMode() {
  // シンプルに 8 ステップだけ切り替え
  switch (EngineParams.mode) {
    case "ambient":
      EngineParams.kickPattern = "x.......";
      EngineParams.hatPattern  = "x.x.x.x.";
      EngineParams.bassPattern = "x......x";
      EngineParams.padPattern  = "x...x...";
      break;
    case "lofi":
      EngineParams.kickPattern = "x...x..x";
      EngineParams.hatPattern  = "x.x.x.x.";
      EngineParams.bassPattern = "x...x...";
      EngineParams.padPattern  = "x...x...";
      break;
    case "techno":
      EngineParams.kickPattern = "x.x.x.x.";
      EngineParams.hatPattern  = "x.x.x.x.";
      EngineParams.bassPattern = "x..x..x.";
      EngineParams.padPattern  = "x...x...";
      break;
    case "trance":
    default:
      EngineParams.kickPattern = "x.x.x.x.";
      EngineParams.hatPattern  = "xxxx.xxx";
      EngineParams.bassPattern = "x..x..x.";
      EngineParams.padPattern  = "x...x...";
      break;
  }
}

/* =========================================================
   5. ステップシーケンサ（8ステップ）
========================================================= */

let stepIndex = 0;

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

  // 休符判定
  const isRest = rand(EngineParams.restProb);

  if (!isRest) {
    // Kick
    if (patternAt(EngineParams.kickPattern, step) && rand(EngineParams.kickProb)) {
      kick.triggerAttackRelease("C2", "8n", time);
    }

    // Hat
    if (patternAt(EngineParams.hatPattern, step) && rand(EngineParams.hatProb)) {
      hat.triggerAttackRelease("32n", time);
    }

    // Bass
    if (patternAt(EngineParams.bassPattern, step) && rand(EngineParams.bassProb)) {
      bass.triggerAttackRelease(bassRoot, "8n", time);
    }

    // Pad（ゆっくり）
    if (patternAt(EngineParams.padPattern, step) && rand(EngineParams.padProb)) {
      const note = randomNoteFromScale();
      const dur  = EngineParams.mode === "ambient" ? "2n" : "4n";
      pad.triggerAttackRelease(note, dur, time);
    }
  }

  stepIndex++;
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

  const btnStart   = document.getElementById("btn_start");
  const btnStop    = document.getElementById("btn_stop");
  const autoToggle = document.getElementById("auto_toggle");
  const statusText = document.getElementById("status-text");
  const modeLabel  = document.getElementById("mode-label");

  if (btnStart) {
    btnStart.onclick = async () => {
      if (!initialized) {
        await Tone.start();
        initialized = true;

        Tone.Transport.scheduleRepeat((time) => {
          scheduleStep(time);
        }, "8n"); // 16n → 8n にして負荷軽減＋グルーヴ感維持
      }
      updateFromUI();
      if (!isPlaying) {
        Tone.Transport.start();
        isPlaying = true;
        if (statusText) statusText.textContent = "Playing…";
      }
      if (modeLabel) modeLabel.textContent = EngineParams.mode.toUpperCase();
    };
  }

  if (btnStop) {
    btnStop.onclick = () => {
      Tone.Transport.stop();
      isPlaying = false;
      if (statusText) statusText.textContent = "Stopped";
    };
  }

  if (autoToggle) {
    autoToggle.onchange = (e) => {
      if (e.target.checked) startAutoCycle();
      else stopAutoCycle();
    };
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

      updateFromUI();
    });
  }
  if (btnReloadPresets){
    btnReloadPresets.addEventListener("click", async () => {
      await loadPresets();
      updateFromUI();
    });
  }

}

/* =========================================================
   8. INIT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  mountMandalaLayers();
  attachUI();
  loadPresets().finally(()=>{ applyUCMToParams(); });
  console.log("UCM Mandala Engine v3.0 Lite ready");
});

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
