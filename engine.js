let audioCtx;
let isRunning = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function startSound() {
    if (!isRunning) {
        isRunning = true;
        loop();
    }
}

function stopSound() {
    isRunning = false;
}

function loop() {
    if (!isRunning) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = 110 + Math.random() * 40;

    gain.gain.value = 0.1;
    osc.connect(gain).connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);

    setTimeout(loop, 300);
}

document.getElementById("btn_start").onclick = () => {
    initAudio();
    startSound();
};

document.getElementById("btn_stop").onclick = () => {
    stopSound();
};
