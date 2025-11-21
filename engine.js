/* --------------------------------------------------------
   UCM Mandala Engine — mandala_engine.js
   観フェーダー × 静←→動 × 自動生成 × オートサイクル
   Version: 0.9 (markdown spec)
-------------------------------------------------------- */

let audioCtx;
let isRunning = false;
let autoTimer = null;

/* ========================================================
   1. 初期セットアップ
======================================================== */
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

/* ========================================================
   2. UCM 観の状態管理
======================================================== */
const UCM = {
    energy: 20,

    wave: 40,
    mind: 50,
    creation: 50,
    void: 30,
    circle: 50,
    body: 40,
    resource: 60,
    observer: 50,

    auto: {
        enabled: false,
        intervalMin: 1,
        intervalMax: 10,
        currentTimer: null,
    }
};

/* --------------------------------------------------------
   観パラメータをUIから更新
-------------------------------------------------------- */
function updateFromUI() {
    UCM.energy = getVal("fader_energy");
    UCM.wave = getVal("fader_wave");
    UCM.mind = getVal("fader_mind");
    UCM.creation = getVal("fader_creation");
    UCM.void = getVal("fader_void");
    UCM.circle = getVal("fader_circle");
    UCM.body = getVal("fader_body");
    UCM.resource = getVal("fader_resource");
    UCM.observer = getVal("fader_observer");
}

/* Short helper */
function getVal(id) {
    return parseInt(document.getElementById(id).value, 10);
}

/* ========================================================
   3. 観 → 音響パラメータ変換
======================================================== */
function computeParams() {
    return {
        /* Energy: 静 ↔ 動 */
        tempo: map(UCM.energy, 0, 100, 40, 150),
        density: map(UCM.energy, 0, 100, 0.1, 0.9),
        brightness: map(UCM.creation, 0, 100, 0.1, 1.2),

        /* Wave: 周期性 */
        rhythmicComplexity: map(UCM.wave, 0, 100, 0.1, 1.0),

        /* Mind: コード構造 */
        harmonicDeviation: map(UCM.mind, 0, 100, 0.0, 0.7),

        /* Void: ミニマル化 */
        silenceRate: map(UCM.void, 0, 100, 0.0, 0.45),

        /* Body: 低域の存在感 */
        bassWeight: map(UCM.body, 0, 100, 0.2, 2.0),

        /* Circle: 全体の整流 */
        smoothing: map(UCM.circle, 0, 100, 0.2, 1.0),
    };
}

/* --------------------------------------------------------
   数値マッピング
-------------------------------------------------------- */
function map(x, inMin, inMax, outMin, outMax) {
    return outMin + ((x - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/* ========================================================
   4. 音源生成（簡易版）
======================================================== */

/* Infinite Pad Drone (Ambient core) */
function generateDrone(p) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = 110 + (Math.random() * 30 - 15);

    gain.gain.value = 0.15 * p.smoothing;

    osc.connect(gain).connect(audioCtx.destination);
    osc.start();

    return { osc, gain };
}

/* Euclid-based Percussion */
function generatePercussion(p) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.value = 40 * p.bassWeight;

    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.31);
}

/* Glitch engine (IDM) */
function generateGlitch(p) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.value = 200 + Math.random() * 800;

    gain.gain.value = 0.05 * p.brightness;

    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

/* Jazz chord stabs */
function generateJazzChord(p) {
    const notes = [0, 4, 7, 11];
    const base = 220 * (1 + p.harmonicDeviation);
    notes.forEach((n) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.value = base * Math.pow(2, n / 12);
        gain.gain.value = 0.08;

        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    });
}

/* ========================================================
   5. メインループ
======================================================== */
function loop() {
    if (!isRunning) return;

    updateFromUI();
    const p = computeParams();

    /* Core ambient drone */
    generateDrone(p);

    /* Rhythm (energy determines density) */
    if (Math.random() < p.density) {
        generatePercussion(p);
    }

    /* IDM glitch / jazz hybrid */
    if (Math.random() < p.rhythmicComplexity * 0.4) {
        generateGlitch(p);
    }

    /* Jazz chord flavor */
    if (Math.random() < p.harmonicDeviation * 0.25) {
        generateJazzChord(p);
    }

    /* Loop timing */
    const bpm = p.tempo;
    const interval = 60 / bpm;

    setTimeout(loop, interval * 1000);
}

/* ========================================================
   6. Auto Cycle (観のランダム遷移)
======================================================== */
function autoCycle() {
    if (!UCM.auto.enabled) return;

    const duration = randomRange(
        UCM.auto.intervalMin,
        UCM.auto.intervalMax
    ) * 60 * 1000;

    UCM.wave = Math.floor(Math.random() * 100);
    UCM.mind = Math.floor(Math.random() * 100);
    UCM.creation = Math.floor(Math.random() * 100);
    UCM.void = Math.floor(Math.random() * 100);
    UCM.circle = Math.floor(Math.random() * 100);
    UCM.body = Math.floor(Math.random() * 100);
    UCM.resource = Math.floor(Math.random() * 100);
    UCM.observer = Math.floor(Math.random() * 100);

    UCM.auto.currentTimer = setTimeout(autoCycle, duration);
}

function randomRange(a, b) {
    return a + Math.random() * (b - a);
}

/* ========================================================
   7. UIボタン
======================================================== */
document.getElementById("btn_start").onclick = () => {
    initAudio();
    isRunning = true;
    loop();
};

document.getElementById("btn_stop").onclick = () => {
    isRunning = false;
};

document.getElementById("auto_toggle").onchange = (ev) => {
    const on = ev.target.checked;
    UCM.auto.enabled = on;
    if (on) autoCycle();
    else clearTimeout(UCM.auto.currentTimer);
};

/* ========================================================
   完了
======================================================== */
console.log("UCM Mandala Engine — JS Loaded");

