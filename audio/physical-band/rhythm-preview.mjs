import { RHYTHM_RATE, RHYTHM_SECONDS, prepareRhythm } from "./rhythm-audition.mjs?v=1";
const panel = document.getElementById("br-rhythm-audition");
if (panel) {
  if (location.hash === "#br-rhythm-audition") panel.open = true;
  const prepare = panel.querySelector("[data-rhythm-prepare]"), stopButton = panel.querySelector("[data-rhythm-stop]");
  const status = panel.querySelector("[data-rhythm-status]"), volume = panel.querySelector("[data-rhythm-volume]");
  const part = panel.querySelector("[data-rhythm-part]"), plays = [...panel.querySelectorAll("[data-rhythm-play]")];
  let context, ownsContext = false, phase = "idle", token = 0, controller, worker, cancelWorker, timeout;
  let prepared, measurements, source, gain;
  const message = (text) => { status.textContent = text; };
  function update() {
    prepare.disabled = phase === "preparing" || Boolean(prepared);
    part.disabled = phase === "preparing";
    stopButton.disabled = phase === "idle";
    plays.forEach((button) => { button.disabled = !prepared || phase === "preparing"; });
  }
  function stop(text = "停止しました。") {
    token++; controller?.abort(); controller = undefined;
    clearTimeout(timeout); cancelWorker?.(); cancelWorker = undefined; worker?.terminate(); worker = undefined;
    if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    gain?.disconnect(); source = gain = undefined; phase = "idle"; update();
    if (text) message(text);
  }
  function acquire() {
    if (!context || context.state === "closed") {
      ownsContext = false; context = window.Tone?.getContext?.().rawContext;
      if (!context?.createBufferSource) { context = new (window.AudioContext || window.webkitAudioContext)(); ownsContext = true; }
    }
    return context.resume();
  }
  function exclusive() {
    const request = new CustomEvent("band-room:physical-preview", { cancelable: true, detail: { owner: "rhythm-audition" } });
    window.dispatchEvent(request);
    if (request.defaultPrevented) { message("曲の準備が終わってから比較してください。"); return false; }
    return true;
  }
  function synthStems(signal) {
    return new Promise((resolve, reject) => {
      const task = new Worker(new URL("./rhythm-worker.mjs?v=1", import.meta.url), { type: "module" });
      worker = task; let settled = false;
      const finish = (error, stems) => {
        if (settled) return; settled = true;
        task.terminate(); signal.removeEventListener("abort", cancel);
        if (worker === task) { worker = undefined; cancelWorker = undefined; }
        if (error) reject(error); else resolve(stems);
      };
      const cancel = () => finish(new DOMException("Cancelled", "AbortError"));
      cancelWorker = cancel; signal.addEventListener("abort", cancel, { once: true });
      task.onmessage = ({ data }) => { if (data.stems || data.error) finish(data.error ? new Error(data.error) : null, data.stems); };
      task.onerror = () => finish(new Error("ベースとドラムを準備できませんでした。"));
      task.postMessage({ prepare: true });
    });
  }
  prepare.addEventListener("click", async () => {
    if (!exclusive()) return;
    stop(null); const run = token;
    controller = new AbortController(); const signal = controller.signal;
    phase = "preparing"; update(); message("ベース・ドラム・合奏の新旧の音を準備しています…");
    timeout = setTimeout(() => { if (run === token) stop("準備が30秒を超えたため停止しました。もう一度準備できます。"); }, 30000);
    try {
      const resumed = acquire();
      const [stems] = await Promise.all([synthStems(signal), resumed]); signal.throwIfAborted();
      const result = await prepareRhythm(window.OfflineAudioContext || window.webkitOfflineAudioContext, stems, signal);
      if (run !== token) return;
      prepared = result.prepared; measurements = result.measurements;
      clearTimeout(timeout); controller = undefined; phase = "idle"; update();
      message("準備できました。単音・一打の余韻から、8秒後に2小節の演奏へ進みます。");
    } catch (error) { if (run === token) stop(error.message || "比較音を準備できませんでした。"); }
  });
  plays.forEach((button) => button.addEventListener("click", async () => {
    const voice = button.dataset.rhythmPlay, chosenPart = part.value;
    if (!prepared?.[voice]?.[chosenPart] || !exclusive()) return;
    stop(null); const run = token; phase = "starting"; update();
    try {
      await acquire(); if (run !== token) return;
      const buffer = context.createBuffer(1, prepared[voice][chosenPart].length, RHYTHM_RATE);
      buffer.copyToChannel(prepared[voice][chosenPart], 0);
      source = context.createBufferSource(); source.buffer = buffer;
      gain = context.createGain(); gain.gain.value = Number(volume.value) / 100;
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => { if (run === token) stop("比較フレーズが終わりました。"); };
      source.start(context.currentTime + 0.03); phase = "playing"; update();
      message(`${voice === "refined" ? "新しい音" : "これまでの音"} · ${{ bass: "ベース", drums: "ドラム", band: "3人の合奏" }[chosenPart]} · 単音・一打 → 2小節 → 余韻`);
    } catch (error) { if (run === token) stop(error.message || "再生できませんでした。"); }
  }));
  part.addEventListener("change", () => stop("パートを切り替えました。聴くボタンで冒頭から再生します。"));
  stopButton.addEventListener("click", () => stop());
  volume.addEventListener("input", () => gain?.gain.setTargetAtTime(Number(volume.value) / 100, context.currentTime, 0.015));
  window.addEventListener("band-room:physical-preview", (event) => { if (event.detail?.owner !== "rhythm-audition") stop(); });
  for (const event of ["band-room:playback-starting", "band-room:playback-stopped"]) window.addEventListener(event, () => { if (phase !== "idle") stop(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", () => { prepared = measurements = undefined; stop(null); if (ownsContext) context?.close(); });
  window.RhythmAudition = Object.freeze({ snapshot: () => ({ phase, part: part.value, sources: source ? 1 : 0, nodes: source ? 2 : 0, worker: Boolean(worker), preparing: Boolean(controller), duration: RHYTHM_SECONDS, cacheBytes: Object.values(prepared || {}).flatMap(Object.values).reduce((sum, data) => sum + data.byteLength, 0), measurements }) });
  update();
}
