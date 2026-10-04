import { GUITAR_KEYS, BASS_KEYS, nearestKey, MAX_BANK_BYTES } from "./bank.mjs?v=3";
import { createGuitarAmp } from "./amp.mjs?v=1";
import { createBandRoom } from "./room.mjs?v=1";

// One bank per current audio context. Prepared in a Worker only after START;
// PCM is transferred once, then discarded after copying into AudioBuffers.
let cached;
export async function prepareInstrumentBank(context, { signal, progress = () => {} } = {}) {
  if (signal?.aborted) throw new Error("Instrument preparation cancelled");
  if (cached?.context === context) return cached;
  cached = undefined;
  const bank = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./bank-worker.mjs?v=3", import.meta.url), { type: "module" });
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

export function createPhysicalBand(context, bank, targets, { connect, disconnect = (source, target) => source.disconnect(target), seconds, midi, tone = "crunch", roomWet = 0.35 }) {
  const pending = new Set();
  const stats = { played: 0, dropped: 0, last: {}, guitarStrokes: { open: 0, palm: 0, cut: 0, up: 0, down: 0 }, guitarVoicings: { harmonic: 0, fallback: 0 } };
  const amp = createGuitarAmp(context, tone);
  connect(amp.output, targets.guitar);
  const destinations = { bass: targets.bass, guitar: amp.input, drums: targets.drums, melody: targets.voice };
  let disposed = false;
  let room, sends = [];

  function clearRoom() {
    for (const [bus, send] of sends) { disconnect(bus, send); send.disconnect(); }
    sends = []; room?.dispose(); room = undefined;
  }
  function attachRoom() {
    if (!targets.room || disposed) return;
    room = createBandRoom(context, roomWet);
    // Post-fader sends: muting a part also removes its room input. Return
    // through the existing instrument/master/REC path, with no dry bypass.
    for (const [part, level] of Object.entries({ guitar: 0.35, bass: 0.08, drums: 0.4, voice: 0.15 })) {
      const send = context.createGain(); send.gain.value = level;
      connect(targets[part], send); send.connect(room.input); sends.push([targets[part], send]);
    }
    connect(room.output, targets.room);
  }
  attachRoom();

  function damp(part, at, fade) {
    for (const hit of pending) {
      if (hit.part !== part || hit.at >= at || hit.end <= at) continue;
      const end = Math.min(hit.end, at + fade);
      const level = hit.level * Math.max(0, Math.min(1, (hit.end - at) / (hit.end - hit.releaseAt)));
      hit.gain.gain.cancelScheduledValues(at);
      // Preserve the original slope up to the damping time: cancelling its
      // old ramp endpoint and adding a set-value event would create a step.
      hit.gain.gain.linearRampToValueAtTime(level, at);
      hit.gain.gain.linearRampToValueAtTime(0, end);
      hit.releaseAt = at; hit.level = level; hit.end = end;
      try { hit.source.stop(end); } catch {}
    }
  }

  function fire(part, key, time, velocity, rate = 1, duration = Infinity, technique = "open", upstroke = false) {
    if (disposed || !Number.isFinite(time) || !Number.isFinite(velocity) || velocity <= 0) return;
    if (time < context.currentTime - 0.05) return; // elapsed attacks when resuming inside a bar
    const buffer = bank.buffers.get(key);
    if (!buffer || pending.size >= 128) { stats.dropped++; return; }
    const at = Math.max(context.currentTime, time);
    if (at - context.currentTime > 8) { stats.dropped++; return; }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.playbackRate.value = rate;
    const palm = key.startsWith("palm:");
    const articulated = part === "guitar" && (palm || technique === "cut");
    const hold = Number.isFinite(duration) ? Math.max(articulated ? 0.025 : (part === "guitar" ? 0.2 : 0.12), duration) : Infinity;
    const tail = articulated ? (palm ? 0.065 : 0.025) : (part === "guitar" ? 1.8 : (part === "bass" ? 1.4 : 0.3));
    const length = Math.max(0.035, Math.min(buffer.duration / rate, hold + tail));
    const releaseAt = at + Math.min(hold, length - 0.025);
    const level = Math.min(1, velocity) * (part === "guitar" ? 0.9 : (part === "melody" ? 0.46 : 1));
    gain.gain.setValueAtTime(level, at);
    gain.gain.setValueAtTime(level, releaseAt);
    gain.gain.linearRampToValueAtTime(0, at + length);
    source.connect(gain); connect(gain, destinations[part]);
    const hit = { part, source, gain, at, level, releaseAt, end: at + length };
    function cleanup() { source.onended = null; source.disconnect(); gain.disconnect(); pending.delete(hit); }
    hit.cleanup = cleanup; pending.add(hit); source.onended = cleanup;
    try { source.start(at); source.stop(at + length); stats.played++; stats.last[part] = { at, key, rate, velocity, ...(part === "guitar" ? { technique, upstroke } : {}) }; }
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
      triggerAttackRelease(notes, duration, time, velocity = 0.7, { technique = "open", upstroke = false, sweep = 0.007, voicingSource = "fallback" } = {}) {
        if (disposed || !Number.isFinite(velocity) || velocity <= 0) return;
        const gate = Math.max(0.02, Number(seconds(duration)) || 0.2);
        if (Number(time) < context.currentTime - 0.05) return;
        const at = Math.max(context.currentTime, Number(time));
        if (!Number.isFinite(at) || at - context.currentTime > 8) return;
        const pitches = (Array.isArray(notes) ? notes.slice(0, 3) : [notes]).map((note) => Number(midi(note)))
          .filter((pitch) => Number.isFinite(pitch) && pitch >= 24 && pitch <= 84);
        if (!pitches.length) return;
        // One stroke owns the whole chord; crossing its strings must never
        // choke its siblings. A later stroke / bass note damps the old one.
        const articulated = part === "guitar" && ["palm", "cut"].includes(technique);
        damp(part, at, part === "bass" ? 0.06 : (part === "guitar" ? (articulated ? 0.018 : 0.1) : 0.04));
        if (upstroke) pitches.reverse();
        const spread = Number.isFinite(sweep) ? Math.max(0.002, Math.min(0.012, sweep)) : 0.007;
        const playedBefore = stats.played;
        pitches.forEach((pitch, i) => {
          const root = nearestKey(pitch, keys);
          const key = part === "guitar" && technique === "palm" ? "palm" : (part === "melody" ? "guitar" : part);
          const offset = part === "guitar" ? i * spread : 0;
          // One fretting-hand release closes all strings of a cut together.
          fire(part, `${key}:${root}`, at + offset, velocity * (part === "guitar" ? 1 - i * 0.06 : 1), 2 ** ((pitch - root) / 12), articulated ? Math.max(0.025, gate - offset) : gate, technique, upstroke);
        });
        if (part === "guitar" && stats.played > playedBefore) {
          stats.guitarStrokes[["palm", "cut"].includes(technique) ? technique : "open"]++;
          stats.guitarStrokes[upstroke ? "up" : "down"]++;
          const source = voicingSource === "harmonic" ? "harmonic" : "fallback";
          stats.guitarVoicings[source]++;
          stats.lastStrum = { at, notes: pitches.slice(), source, technique, upstroke };
        }
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
    setRoom(value) { if (Number.isFinite(value)) { roomWet = Math.max(0, Math.min(1, value)); room?.setWet(roomWet); } },
    snapshot: () => ({ pending: pending.size, bytes: bank.bytes, roomWet, roomNodes: room ? room.nodes.length + sends.length : 0, ...stats }),
    releaseAll() { release(); clearRoom(); attachRoom(); },
    dispose() { if (disposed) return; disposed = true; release(); clearRoom(); amp.dispose(); }
  };
}
