// Own context and nodes only. Never use Music's engine, Transport, or saved output.
import { clamp, DURATION } from "./model.mjs";
export const TONE_URL = "https://unpkg.com/tone@14.8.49/build/Tone.js";
let libraryPromise;
function loadTone() {
  if (globalThis.Tone) return Promise.resolve(globalThis.Tone);
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TONE_URL;
    script.crossOrigin = "anonymous";
    const timer = setTimeout(() => finish(new Error("Tone load timeout")), 15000);
    function finish(error) {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); libraryPromise = null; reject(error); }
      else {
        // UMD's empty default context is never our playback context. Dispose
        // even if the user canceled the tap while this download was pending.
        globalThis.Tone.getContext().dispose();
        resolve(globalThis.Tone);
      }
    }
    script.onload = () => finish(globalThis.Tone ? null : new Error("Tone unavailable"));
    script.onerror = () => finish(new Error("Tone download failed"));
    document.head.append(script);
  });
  return libraryPromise;
}

// Also used by OfflineContext QA; every graph is disposed on stop/switch.
export function createGraph(Tone, context, p, volume, destination) {
  const nodes = [];
  const own = (node) => { nodes.push(node); return node; };
  const options = { context };
  const output = own(new Tone.Gain({ ...options, gain: volume }));
  output.connect(destination);
  const limiter = own(new Tone.Limiter({ ...options, threshold: -5 })).connect(output);
  // Fixed palette compensation, calibrated on the three 20 s fixtures.
  // Never increases with round count or negative feedback; not a LUFS claim.
  const trim = own(new Tone.Gain({ ...options, gain: clamp(0.65 + 0.95 * (1 - p.warmth) + 0.35 * p.space - 0.1 * p.pulse, 0.65, 1.8) })).connect(limiter);
  const compressor = own(new Tone.Compressor({ ...options, threshold: -20, ratio: 3, attack: 0.02, release: 0.18 })).connect(trim);
  const bus = own(new Tone.Filter({ ...options, frequency: 32, type: "highpass", rolloff: -12 })).connect(compressor);
  const padFilter = own(new Tone.Filter({ ...options, frequency: 1250 - p.warmth * 650, type: "lowpass", Q: 0.6 })).connect(bus);
  const echo = own(new Tone.FeedbackDelay({ ...options, delayTime: 0.46875, feedback: 0.22, wet: 0.24 })).connect(bus);
  const leadFilter = own(new Tone.Filter({ ...options, frequency: 3100 + p.space * 1400, type: "lowpass", Q: 0.6 })).connect(echo);
  const bassFilter = own(new Tone.Filter({ ...options, frequency: 500 + p.pulse * 750, type: "lowpass", Q: 0.75 })).connect(bus);
  const noiseFilter = own(new Tone.Filter({ ...options, frequency: 1500, type: "highpass", Q: 0.5 })).connect(bus);
  const hatFilter = own(new Tone.Filter({ ...options, frequency: 6200, type: "highpass", Q: 0.5 })).connect(bus);
  const voices = {
    pad: own(new Tone.PolySynth({ ...options, voice: Tone.Synth, maxPolyphony: 4, options: {
      oscillator: { type: "triangle" }, envelope: { attack: 0.22, decay: 0.3, sustain: 0.65, release: 0.28 }, volume: -19
    } })).connect(padFilter),
    lead: own(new Tone.PolySynth({ ...options, voice: Tone.FMSynth, maxPolyphony: 4, options: {
      harmonicity: 2, modulationIndex: 1.2 + p.fracture * 1.6,
      oscillator: { type: "sine" }, modulation: { type: "sine" },
      envelope: { attack: 0.006, decay: 0.38, sustain: 0.09, release: 0.35 },
      modulationEnvelope: { attack: 0.002, decay: 0.22, sustain: 0.04, release: 0.2 }, volume: -15
    } })).connect(leadFilter),
    bass: own(new Tone.MonoSynth({ ...options, oscillator: { type: "triangle" },
      envelope: { attack: 0.015, decay: 0.18, sustain: 0.4, release: 0.1 },
      filter: { type: "lowpass", Q: 0.6 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.1, baseFrequency: 220, octaves: 2 }, volume: -12 })).connect(bassFilter),
    kick: own(new Tone.MembraneSynth({ ...options, pitchDecay: 0.025, octaves: 4,
      oscillator: { type: "sine" }, envelope: { attack: 0.003, decay: 0.23, sustain: 0, release: 0.05 }, volume: -15 })).connect(bus),
    snare: own(new Tone.NoiseSynth({ ...options, noise: { type: "pink" },
      envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.03 }, volume: -25 })).connect(noiseFilter),
    hat: own(new Tone.NoiseSynth({ ...options, noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.035, sustain: 0, release: 0.012 }, volume: -31 })).connect(hatFilter)
  };
  let disposed = false;
  return {
    output, limiter, nodes,
    trigger(event, time) {
      const voice = voices[event.voice];
      if (!voice) throw new Error("Unknown voice");
      if (["snare", "hat"].includes(event.voice)) voice.triggerAttackRelease(event.duration, time, event.velocity);
      else {
        const frequencies = event.notes.map((midi) => 440 * 2 ** ((midi - 69) / 12));
        voice.triggerAttackRelease(event.voice === "pad" || event.voice === "lead" ? frequencies : frequencies[0],
          event.duration, time, event.velocity);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const node of [...nodes].reverse()) node.dispose();
    }
  };
}

export class Player {
  constructor(onUpdate, onError) {
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.volume = 0.35;
    this.token = 0;
    this.raw = null;
    this.context = null;
    this.graph = null;
    this.active = null;
    this.pending = null;
    this.retiring = new Set();
    this.closePromise = null;
  }
  snapshot() {
    return { playing: this.active?.id ?? null, pending: this.pending,
      state: this.raw?.state ?? "not-created", seconds: this.elapsed(),
      graphs: (this.graph ? 1 : 0) + this.retiring.size, volume: this.volume };
  }
  elapsed() { return this.active ? clamp(this.raw.currentTime - this.active.start, 0, DURATION) : 0; }
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = clamp(value);
    if (this.graph) this.graph.output.gain.rampTo(this.volume, 0.025);
  }
  async play(score) {
    if (!score || score.duration !== DURATION || score.events.length > 256) throw new Error("Invalid score budget");
    this.stop("switch");
    const token = this.token;
    this.pending = score.candidateId;
    this.onUpdate({ type: "loading", id: this.pending });
    try {
      if (!this.raw || this.raw.state === "closed") {
        const NativeContext = window.AudioContext || window.webkitAudioContext;
        if (!NativeContext) throw new Error("Web Audio unavailable");
        // Synchronous creation/resume in the actual tap, before fetching Tone.
        this.raw = new NativeContext({ latencyHint: "playback" });
        const raw = this.raw;
        raw.addEventListener("statechange", () => {
          if (this.raw === raw && this.active && raw.state !== "running") this.stop("interrupted");
        });
      }
      const resumed = this.raw.resume();
      const [Tone] = await Promise.all([loadTone(), resumed]);
      if (token !== this.token || document.hidden) return;
      if (this.raw.state !== "running") throw new Error("Audio permission not ready");
      if (!this.context) this.context = new Tone.Context({ context: this.raw, lookAhead: 0.08 });
      // The pinned UMD creates a default context at load. Retire that empty
      // context before making voices; keep exactly one live playback context.
      if (Tone.getContext() !== this.context) Tone.setContext(this.context, true);
      this.graph = createGraph(Tone, this.context, score.params, 0, this.raw.destination);
      const start = this.raw.currentTime + 0.12;
      this.graph.output.gain.setValueAtTime(0, start);
      this.graph.output.gain.linearRampToValueAtTime(this.volume, start + 0.05);
      this.pending = null;
      this.active = { id: score.candidateId, start, score, cursor: 0 };
      this.onUpdate({ type: "start", id: score.candidateId });
      const tick = () => {
        if (!this.active || token !== this.token) return;
        try {
          const { score: current, start: epoch } = this.active;
          const seconds = this.elapsed();
          if (seconds >= DURATION) { this.stop("ended"); return; }
          while (this.active.cursor < current.events.length) {
            const event = current.events[this.active.cursor];
            const at = epoch + event.time;
            if (at > this.raw.currentTime + 0.18) break;
            this.active.cursor++;
            // After an unexpected stall, skip stale attacks, never burst-catch-up.
            if (at >= this.raw.currentTime + 0.005) this.graph.trigger(event, at);
          }
          this.onUpdate({ type: "progress", id: current.candidateId, seconds });
        } catch (error) { this.stop("error"); this.onError(error); }
      };
      tick();
      if (this.active) this.interval = setInterval(tick, 30);
    } catch (error) {
      if (token !== this.token) return;
      this.stop("error");
      this.onError(error);
    }
  }
  stop(reason = "stop") {
    ++this.token;
    clearInterval(this.interval);
    this.interval = null;
    const previous = this.active;
    const seconds = this.elapsed();
    this.active = null;
    this.pending = null;
    if (this.graph) {
      // At most one fading graph plus the new graph, even under rapid taps.
      for (const old of this.retiring) old.dispose();
      this.retiring.clear();
      const graph = this.graph;
      this.graph = null;
      // Fade at the native clock; scheduled attacks are never left connected.
      graph.output.gain.cancelScheduledValues(0);
      graph.output.gain.setValueAtTime(graph.output.gain.value, this.raw.currentTime);
      graph.output.gain.linearRampToValueAtTime(0, this.raw.currentTime + 0.025);
      this.retiring.add(graph);
      setTimeout(() => { graph.dispose(); this.retiring.delete(graph); }, 45);
    }
    this.onUpdate({ type: "stop", id: previous?.id, seconds, reason });
  }
  async close() {
    this.stop("hidden");
    if (this.closePromise) return this.closePromise;
    if (!this.raw) return;
    const raw = this.raw, context = this.context;
    raw.onstatechange = null;
    this.raw = null; this.context = null;
    for (const graph of this.retiring) graph.dispose();
    this.retiring.clear();
    this.closePromise = (async () => {
      if (context) context.dispose();
      if (raw.state !== "closed") await raw.close();
    })().catch(() => {}).finally(() => { this.closePromise = null; });
    return this.closePromise;
  }
}
