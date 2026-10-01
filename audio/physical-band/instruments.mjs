import { GUITAR_KEYS, BASS_KEYS, nearestKey, MAX_BANK_BYTES } from "./bank.mjs?v=1";
import { createGuitarAmp } from "./amp.mjs?v=1";

// One bank per current audio context. Prepared in a Worker only after START;
// PCM is transferred once, then discarded after copying into AudioBuffers.
let cached;
export async function prepareInstrumentBank(context, { signal, progress = () => {} } = {}) {
  if (signal?.aborted) throw new Error("Instrument preparation cancelled");
  if (cached?.context === context) return cached;
  cached = undefined;
  const bank = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./bank-worker.mjs?v=1", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); signal?.removeEventListener("abort", abort);
      worker.terminate(); error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new Error("Instrument preparation cancelled"));
    const timeout = setTimeout(() => finish(new Error("楽器の準備が長引いています。もう一度STARTを押してください。")), 30000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.error) finish(new Error(data.error));
      else if (data.bank) finish(null, data.bank);
      else progress(data.progress);
    };
    worker.onerror = () => finish(new Error("楽器を準備できませんでした。ページを更新してください。"));
    worker.postMessage({});
  });
  if (signal?.aborted) throw new Error("Instrument preparation cancelled");
  if (bank.bytes > MAX_BANK_BYTES || bank.sampleRate !== 32000) throw new Error("Invalid instrument bank");
  const buffers = new Map();
  for (const [key, samples] of Object.entries(bank.samples)) {
    const buffer = context.createBuffer(1, samples.length, bank.sampleRate);
    buffer.copyToChannel(samples, 0); buffers.set(key, buffer);
  }
  cached = { context, buffers, bytes: bank.bytes };
  return cached;
}

export function createPhysicalBand(context, bank, targets, { connect, seconds, midi, tone = "crunch" }) {
  const pending = new Set();
  const stats = { played: 0, dropped: 0, last: {} };
  const amp = createGuitarAmp(context, tone);
  connect(amp.output, targets.guitar);
  const destinations = { bass: targets.bass, guitar: amp.input, drums: targets.drums, melody: targets.voice };
  let disposed = false;

  function fire(part, key, time, velocity, rate = 1, duration = Infinity) {
    if (disposed || !Number.isFinite(time) || !Number.isFinite(velocity) || velocity <= 0) return;
    const buffer = bank.buffers.get(key);
    if (!buffer || pending.size >= 128) { stats.dropped++; return; }
    const at = Math.max(context.currentTime, time);
    if (at - context.currentTime > 8) { stats.dropped++; return; }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.playbackRate.value = rate;
    const length = Math.max(0.035, Math.min(buffer.duration / rate, duration + 0.025));
    const level = Math.min(1, velocity) * (part === "guitar" ? 0.7 : (part === "melody" ? 0.65 : 1));
    gain.gain.setValueAtTime(level, at);
    gain.gain.setValueAtTime(level, at + Math.max(0, length - 0.025));
    gain.gain.linearRampToValueAtTime(0, at + length);
    source.connect(gain); connect(gain, destinations[part]);
    const hit = { part, source, gain, end: at + length };
    function cleanup() { source.onended = null; source.disconnect(); gain.disconnect(); pending.delete(hit); }
    hit.cleanup = cleanup; pending.add(hit); source.onended = cleanup;
    try { source.start(at); source.stop(at + length); stats.played++; stats.last[part] = { at, key, rate, velocity }; }
    catch { cleanup(); stats.dropped++; }
  }
  function release(part) {
    for (const hit of [...pending]) {
      if (part && hit.part !== part) continue;
      try { hit.source.stop(); } catch {} hit.cleanup();
    }
  }
  function string(part, keys) {
    return {
      _physical: true,
      triggerAttackRelease(notes, duration, time, velocity = 0.7) {
        const gate = Math.max(0.02, Number(seconds(duration)) || 0.2);
        (Array.isArray(notes) ? notes.slice(0, 3) : [notes]).forEach((note, i) => {
          const pitch = Number(midi(note));
          if (!Number.isFinite(pitch) || pitch < 24 || pitch > 84) return;
          const root = nearestKey(pitch, keys);
          const technique = part === "guitar" && gate < 0.2 ? "palm" : (part === "melody" ? "guitar" : part);
          fire(part, `${technique}:${root}`, Number(time) + (part === "guitar" ? i * 0.006 : 0), velocity, 2 ** ((pitch - root) / 12), gate);
        });
      },
      releaseAll() { release(part); }, dispose() { release(part); }
    };
  }
  const drums = { _physical: true, dispose() { release("drums"); } };
  for (const [name, drum] of Object.entries({ kick: "kick", snare: "snare", hat: "hat", ghost: "snare", fill: "tom", crash: "crash", ride: "ride", cowbell: "cowbell" })) {
    drums[name] = { triggerAttackRelease(...args) {
      const [time, velocity] = name === "kick" ? args.slice(2) : args.slice(1);
      fire("drums", `drums:${drum}`, Number(time), (velocity ?? 0.6) * (name === "ghost" ? 0.45 : 1));
    } };
  }
  return { bass: string("bass", BASS_KEYS), guitar: string("guitar", GUITAR_KEYS), melody: string("melody", GUITAR_KEYS), drums,
    setTone: amp.setTone,
    snapshot: () => ({ pending: pending.size, bytes: bank.bytes, ...stats }),
    releaseAll() { release(); },
    dispose() { if (disposed) return; disposed = true; release(); amp.dispose(); }
  };
}
