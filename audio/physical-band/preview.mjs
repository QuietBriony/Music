// Optional Band Room adapter. Loading this file creates no context, Worker,
// AudioNode or audio request. All expensive synthesis happens after a gesture.
import { createGuitarAmp } from "./amp.mjs?v=1";
const panel = document.getElementById("br-physical-band");
if (panel) {
  if (location.hash === "#br-physical-band") panel.open = true;
  const play = panel.querySelector("[data-physical-play]");
  const stopButton = panel.querySelector("[data-physical-stop]");
  const style = panel.querySelector("[data-physical-style]");
  const tone = panel.querySelector("[data-physical-tone]");
  const status = panel.querySelector("[data-physical-status]");
  const volume = panel.querySelector("[data-physical-volume]");
  const parts = ["guitar", "bass", "drums"];
  const cache = new Map(); // At most two short scores, not an unbounded song bank.
  let context, ownsContext = false, token = 0, phase = "idle", worker, cancelRender;
  let master, guitarAmp, sources = [], nodes = [], gains = {}, lastRender, renderMs = 0;
  const message = (text) => { status.textContent = text; };
  const updateButtons = () => { play.disabled = phase !== "idle"; stopButton.disabled = phase === "idle"; };

  function stop(text = "停止しました。") {
    token++;
    cancelRender?.();
    cancelRender = undefined;
    worker?.terminate();
    worker = undefined;
    for (const source of sources) {
      source.onended = null;
      try { source.stop(); } catch {}
    }
    for (const node of nodes) node.disconnect();
    sources = []; nodes = []; gains = {}; master = guitarAmp = undefined;
    phase = "idle";
    updateButtons();
    if (text) message(text);
  }

  function render(selected, run) {
    if (cache.has(selected)) { renderMs = 0; return Promise.resolve(cache.get(selected)); }
    const began = performance.now();
    return new Promise((resolve, reject) => {
      let timeout, taskWorker, settled = false;
      const finish = (error, rendered) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        taskWorker?.terminate();
        if (worker === taskWorker) { worker = undefined; cancelRender = undefined; }
        if (error) reject(error);
        else { renderMs = Math.round(performance.now() - began); cache.set(selected, rendered); resolve(rendered); }
      };
      try {
        taskWorker = new Worker(new URL("./render-worker.mjs?v=4", import.meta.url), { type: "module" });
        worker = taskWorker;
        cancelRender = () => finish(new Error("cancelled"));
        timeout = setTimeout(() => finish(new Error("準備に時間がかかっています。停止して、もう一度お試しください。")), 30000);
        worker.onmessage = ({ data }) => {
          if (run !== token) return;
          if (data.error) finish(new Error(data.error));
          else if (data.rendered) finish(null, data.rendered);
          else message(`8小節を準備しています… ${Math.round(data.progress * 100)}%`);
        };
        worker.onerror = () => finish(new Error("試奏を準備できませんでした。ページを更新してお試しください。"));
        worker.postMessage({ style: selected });
      } catch (error) { finish(error); }
    });
  }

  async function start() {
    const request = new CustomEvent("band-room:physical-preview", { cancelable: true });
    window.dispatchEvent(request);
    if (request.defaultPrevented) { message("曲の準備が終わってから試奏してください。"); return; }
    stop(null);
    const run = token;
    const selected = style.value;
    phase = "rendering"; updateButtons(); message("8小節を準備しています…");
    try {
      // Reuse Band Room's native context; keep Transport/master/REC independent.
      if (!context || context.state === "closed") {
        ownsContext = false;
        context = window.Tone?.getContext?.().rawContext;
        if (!context?.createBufferSource) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          context = new AudioContext(); ownsContext = true;
        }
      }
      const resumed = context.resume(); // Synchronous gesture boundary, before rendering.
      const rendering = render(selected, run);
      const [, result] = await Promise.all([resumed, rendering]);
      if (run !== token) return;
      if (context.state !== "running") throw new Error("音声を開始できませんでした。もう一度試奏を押してください。");
      lastRender = result;
      master = context.createGain();
      master.gain.value = Number(volume.value) / 100;
      master.connect(context.destination); nodes.push(master);
      const at = context.currentTime + 0.06;
      let ended = 0;
      parts.forEach((part, index) => {
        const buffer = context.createBuffer(1, result.stems[part].length, result.sampleRate);
        buffer.copyToChannel(result.stems[part], 0);
        const source = context.createBufferSource(); source.buffer = buffer;
        const gain = context.createGain();
        gain.gain.value = panel.querySelector(`[data-physical-part="${part}"]`).checked ? 1 : 0;
        source.connect(gain);
        let output = gain;
        if (part === "guitar" && tone.value !== "acoustic") {
          guitarAmp = createGuitarAmp(context, tone.value);
          gain.connect(guitarAmp.input); output = guitarAmp.output; nodes.push(...guitarAmp.nodes);
        }
        if (context.createStereoPanner) {
          const pan = context.createStereoPanner(); pan.pan.value = [-0.2, 0, 0.1][index];
          output.connect(pan); pan.connect(master); nodes.push(pan);
        } else output.connect(master);
        nodes.push(source, gain); sources.push(source); gains[part] = gain;
        source.onended = () => { if (run === token && ++ended === parts.length) stop("8小節の試奏が終わりました。"); };
      });
      sources.forEach((source) => source.start(at)); // One audio clock for all parts.
      phase = "playing"; updateButtons();
      message(`${selected === "rock" ? "ロック" : "ジャズ"} · ${result.bpm} BPM · 8小節を試奏中`);
    } catch (error) {
      if (run !== token) return;
      stop(null); message(error.message || "試奏を開始できませんでした。");
    }
  }

  play.addEventListener("click", start);
  stopButton.addEventListener("click", () => stop());
  style.addEventListener("change", () => stop("選んだスタイルで試奏を押してください。"));
  tone.addEventListener("change", () => stop("選んだギターの音で試奏を押してください。"));
  volume.addEventListener("input", () => master?.gain.setTargetAtTime(Number(volume.value) / 100, context.currentTime, 0.015));
  parts.forEach((part) => panel.querySelector(`[data-physical-part="${part}"]`).addEventListener("change", (event) => {
    gains[part]?.gain.setTargetAtTime(event.target.checked ? 1 : 0, context.currentTime, 0.015);
  }));
  window.addEventListener("band-room:playback-starting", () => stop());
  window.addEventListener("band-room:playback-stopped", () => { if (phase !== "idle") stop(); });
  window.addEventListener("pagehide", () => { stop(null); cache.clear(); lastRender = undefined; if (ownsContext) context?.close(); });
  window.PhysicalBandPreview = Object.freeze({ snapshot: () => ({
    phase, sources: sources.length, nodes: nodes.length, worker: Boolean(worker),
    context: context?.state || "uncreated", style: lastRender?.style,
    duration: lastRender?.duration, sampleRate: lastRender?.sampleRate,
    peaks: lastRender?.peaks, renderMs,
    cacheBytes: [...cache.values()].reduce((bytes, result) => bytes + Object.values(result.stems).reduce((sum, stem) => sum + stem.byteLength, 0), 0)
  }) });
  updateButtons();
}
