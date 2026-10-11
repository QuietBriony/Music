import { AUDITION_RATE, AUDITION_SECONDS, recordedAuditionNotes, renderAudition, matchAuditionLevels } from "./guitar-audition.mjs?v=2";
const panel = document.getElementById("br-guitar-audition");
if (panel) {
  if (location.hash === "#br-guitar-audition") panel.open = true;
  const prepare = panel.querySelector("[data-guitar-prepare]");
  const stopButton = panel.querySelector("[data-guitar-stop]");
  const status = panel.querySelector("[data-guitar-status]");
  const volume = panel.querySelector("[data-guitar-volume]");
  const plays = [...panel.querySelectorAll("[data-guitar-play]")];
  let context, ownsContext = false, phase = "idle", token = 0, controller, worker, cancelWorker, timeout;
  let prepared, source, gain, measurements, failure = "";
  const message = (text) => { status.textContent = text; };
  function update() {
    prepare.disabled = phase === "preparing" || Boolean(prepared) || Boolean(failure);
    stopButton.disabled = phase === "idle";
    plays.forEach((button) => { button.disabled = !prepared?.[button.dataset.guitarPlay] || phase === "preparing"; });
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
    const request = new CustomEvent("band-room:physical-preview", { cancelable: true, detail: { owner: "guitar-audition" } });
    window.dispatchEvent(request);
    if (request.defaultPrevented) { message("曲の準備が終わってから比較してください。"); return false; }
    return true;
  }
  function synthNotes(signal) {
    return new Promise((resolve, reject) => {
      const task = new Worker(new URL("./guitar-audition-worker.mjs?v=2", import.meta.url), { type: "module" });
      worker = task;
      const finish = (error, notes) => {
        task.terminate(); signal.removeEventListener("abort", cancel);
        if (worker === task) { worker = undefined; cancelWorker = undefined; }
        if (error) reject(error); else resolve(notes);
      };
      const cancel = () => finish(new DOMException("Cancelled", "AbortError"));
      cancelWorker = cancel; signal.addEventListener("abort", cancel, { once: true });
      task.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.notes);
      task.onerror = () => finish(new Error("合成音の準備に失敗しました。"));
      task.postMessage({ prepare: true });
    });
  }
  prepare.addEventListener("click", async () => {
    if (!exclusive()) return;
    stop(null); const run = token;
    controller = new AbortController(); const signal = controller.signal;
    phase = "preparing"; update(); message("新旧の弦合成と録音ギター4音を準備しています…");
    timeout = setTimeout(() => { if (run === token) stop("準備が30秒を超えたため停止しました。"); }, 30000);
    try {
      const resumed = acquire();
      const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const decoding = new OfflineContext(1, 1, AUDITION_RATE);
      // A failed recorded fetch is never retried or silently replaced by synthesis.
      const reference = recordedAuditionNotes(decoding, signal).catch((error) => {
        if (!signal.aborted) failure = error.message;
        return null;
      });
      const [notes] = await Promise.all([synthNotes(signal), resumed]); signal.throwIfAborted();
      const synthetic = await renderAudition(OfflineContext, notes.synthetic);
      signal.throwIfAborted();
      const refined = await renderAudition(OfflineContext, notes.refined);
      signal.throwIfAborted();
      const recordedNotes = await reference; signal.throwIfAborted();
      const recorded = recordedNotes ? await renderAudition(OfflineContext, recordedNotes, true) : null;
      signal.throwIfAborted();
      if (run !== token) return;
      measurements = matchAuditionLevels(synthetic, recorded, refined);
      prepared = { refined, synthetic, recorded };
      clearTimeout(timeout); controller = undefined; phase = "idle"; update();
      message(recorded ? "準備できました。新しい弦の芯と余韻を、これまでの合成・録音ギターと聴き比べてください。" : failure);
    } catch (error) {
      if (run !== token) return;
      stop(error.message || "比較音を準備できませんでした。");
    }
  });
  plays.forEach((button) => button.addEventListener("click", async () => {
    if (!prepared?.[button.dataset.guitarPlay] || !exclusive()) return;
    stop(null); const run = token, kind = button.dataset.guitarPlay;
    phase = "starting"; update();
    try {
      await acquire(); if (run !== token) return;
      const buffer = context.createBuffer(1, prepared[kind].length, AUDITION_RATE);
      buffer.copyToChannel(prepared[kind], 0);
      source = context.createBufferSource(); source.buffer = buffer;
      gain = context.createGain(); gain.gain.value = Number(volume.value) / 100;
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => { if (run === token) stop("比較フレーズが終わりました。"); };
      source.start(context.currentTime + 0.03); phase = "playing"; update();
      const label = { refined: "新しい弦合成", synthetic: "これまでの弦合成", recorded: "録音されたエレキギター" }[kind];
      message(`${label} · 単音 → E5 → A5 → 短いミュート → E5`);
    } catch (error) { if (run === token) stop(error.message || "再生を開始できませんでした。"); }
  }));
  stopButton.addEventListener("click", () => stop());
  volume.addEventListener("input", () => gain?.gain.setTargetAtTime(Number(volume.value) / 100, context.currentTime, 0.015));
  window.addEventListener("band-room:physical-preview", (event) => { if (event.detail?.owner !== "guitar-audition") stop(); });
  for (const event of ["band-room:playback-starting", "band-room:playback-stopped"]) window.addEventListener(event, () => { if (phase !== "idle") stop(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", () => { prepared = undefined; measurements = undefined; stop(null); if (ownsContext) context?.close(); });
  window.GuitarAudition = Object.freeze({ snapshot: () => ({ phase, sources: source ? 1 : 0, nodes: source ? 2 : 0, worker: Boolean(worker), fetching: Boolean(controller), duration: AUDITION_SECONDS, cacheBytes: Object.values(prepared || {}).reduce((sum, data) => sum + (data?.byteLength || 0), 0), measurements, failure }) });
  update();
}
