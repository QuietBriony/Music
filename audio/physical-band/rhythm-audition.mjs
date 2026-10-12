import { renderString, renderDrum } from "./dsp.mjs?v=4";
import { renderElectricString } from "./electric-string.mjs?v=1";
import { renderElectricBass, renderAcousticDrum } from "./rhythm-synthesis.mjs?v=1";
import { createGuitarAmp } from "./amp.mjs?v=1";
import { createBandRoom } from "./room.mjs?v=1";

export const RHYTHM_RATE = 32000, RHYTHM_SECONDS = 15, MAX_RHYTHM_BYTES = 11_520_000;
const frames = RHYTHM_RATE * RHYTHM_SECONDS;
export function rhythmScore() {
  const bass = [
    { time: 0.2, note: 28, hold: 2.4, velocity: 0.8 },
    { time: 3, note: 33, hold: 1.45, velocity: 0.8 },
    { time: 5, note: 38, hold: 1.3, velocity: 0.8 }
  ];
  const drums = [
    { time: 0.2, drum: "kick", velocity: 0.85 }, { time: 1.3, drum: "snare", velocity: 0.85 },
    { time: 2.5, drum: "hat", velocity: 0.7 }, { time: 3, drum: "tom", velocity: 0.8 },
    { time: 4.3, drum: "ride", velocity: 0.7 }, { time: 5.5, drum: "crash", velocity: 0.8 }
  ];
  for (let bar = 0; bar < 2; bar++) {
    const start = 8 + bar * 2;
    for (const [beat, note, hold, velocity] of [[0, 28, 0.38, 0.85], [0.75, 28, 0.18, 0.65], [1.5, 35, 0.32, 0.75], [2, 28, 0.38, 0.85], [3, 38, 0.18, 0.7], [3.5, 35, 0.2, 0.7]]) {
      bass.push({ time: start + beat * 0.5, note, hold, velocity });
    }
    for (const beat of [0, 1.5, 2, 2.75]) drums.push({ time: start + beat * 0.5, drum: "kick", velocity: beat === 0 || beat === 2 ? 0.85 : 0.65 });
    for (const beat of [1, 3]) drums.push({ time: start + beat * 0.5, drum: "snare", velocity: 0.85 });
    drums.push({ time: start + 1.375, drum: "snare", velocity: 0.3 });
    for (let i = 0; i < 8; i++) drums.push({ time: start + i * 0.25, drum: "hat", velocity: i % 2 ? 0.38 : 0.55 });
  }
  bass.push({ time: 12, note: 28, hold: 2, velocity: 0.85 });
  drums.push({ time: 12, drum: "kick", velocity: 0.85 }, { time: 12, drum: "crash", velocity: 0.75 });
  const guitar = [8, 9, 10, 11, 12].map((time) => ({ time, notes: [40, 47, 52], hold: time === 12 ? 2.1 : 0.5 }));
  return { bass, drums, guitar };
}
export function rhythmMetrics(data) {
  let energy = 0, peak = 0;
  for (const value of data) {
    if (!Number.isFinite(value)) throw new Error("Invalid rhythm PCM");
    energy += value * value; peak = Math.max(peak, Math.abs(value));
  }
  return { rms: Math.sqrt(energy / data.length), peak };
}
function normalize(data, target) {
  let prior = 0, dc = 0, peak = 0;
  const pole = Math.exp(-2 * Math.PI * 18 / RHYTHM_RATE);
  for (let i = 0; i < data.length; i++) {
    const sample = data[i]; dc = sample - prior + pole * dc; prior = sample;
    data[i] = dc; peak = Math.max(peak, Math.abs(dc));
  }
  for (let i = 0; i < data.length; i++) data[i] *= (peak ? target / peak : 0) * Math.min(1, (data.length - 1 - i) / (RHYTHM_RATE * 0.025));
  return data;
}
function place(output, data, time, velocity, hold = Infinity, release = 0.12) {
  const start = Math.round(time * RHYTHM_RATE), end = Math.min(data.length, frames - start, Math.ceil((hold + release) * RHYTHM_RATE));
  for (let i = 0; i < end; i++) {
    const fade = Math.min(1, Math.max(0, (end - 1 - i) / (release * RHYTHM_RATE)));
    output[start + i] += data[i] * velocity * fade;
  }
}
export function renderRhythmStems(progress = () => {}) {
  const score = rhythmScore(), result = {};
  for (const [voiceIndex, voice] of ["previous", "refined"].entries()) {
    const bass = new Float32Array(frames), drums = new Float32Array(frames), cache = new Map();
    for (const [i, event] of score.bass.entries()) {
      if (!cache.has(event.note)) {
        const options = { part: "bass", note: event.note, duration: 3, velocity: 1, technique: voice === "refined" ? "finger" : "pick" };
        cache.set(event.note, normalize(voice === "refined" ? renderElectricBass(options, RHYTHM_RATE) : renderString(options, RHYTHM_RATE, 211 + event.note), 0.16));
      }
      const next = score.bass[i + 1]?.time ?? Infinity;
      place(bass, cache.get(event.note), event.time, event.velocity, Math.min(event.hold, next - event.time - 0.02), Math.min(0.12, Math.max(0.02, next - event.time - event.hold)));
    }
    cache.clear();
    for (const event of score.drums) {
      const ghost = event.drum === "snare" && event.velocity < 0.4, key = event.drum + (ghost ? ":ghost" : "");
      if (!cache.has(key)) {
        const render = voice === "refined" ? renderAcousticDrum : renderDrum;
        // A quiet snare has a distinct wire/body balance, then keeps its live velocity.
        cache.set(key, normalize(render({ drum: event.drum, velocity: ghost ? 0.35 : 1 }, RHYTHM_RATE, 331 + ["kick", "snare", "hat", "ride", "crash", "tom"].indexOf(event.drum)), event.drum === "kick" ? 0.42 : (event.drum === "snare" ? 0.55 : 0.4)));
      }
      place(drums, cache.get(key), event.time, event.velocity, Infinity, 0.025);
    }
    result[voice] = { bass, drums }; progress((voiceIndex + 1) / 3);
  }
  // Identical v414 guitar in both mixes isolates the bass/drum change.
  const guitar = new Float32Array(frames), notes = new Map();
  for (const stroke of score.guitar) for (const [i, note] of stroke.notes.entries()) {
    if (!notes.has(note)) notes.set(note, normalize(renderElectricString({ note, duration: 2.5, velocity: 1, technique: "open" }, RHYTHM_RATE), 0.22));
    place(guitar, notes.get(note), stroke.time + i * 0.007, 0.72 * (1 - i * 0.06), stroke.hold, 0.12);
  }
  result.guitar = guitar; progress(1); return result;
}
async function colourPart(OfflineContext, data, part) {
  const context = new OfflineContext(1, frames, RHYTHM_RATE), nodes = [];
  const buffer = context.createBuffer(1, frames, RHYTHM_RATE); buffer.copyToChannel(data, 0);
  const source = context.createBufferSource(); source.buffer = buffer; nodes.push(source);
  const room = createBandRoom(context, 0.35), send = context.createGain(); nodes.push(send);
  send.gain.value = { bass: 0.06, drums: 0.4, guitar: 0.3 }[part];
  let amp, output;
  if (part === "guitar") { amp = createGuitarAmp(context, "crunch"); source.connect(amp.input); output = amp.output; }
  else {
    const hp = context.createBiquadFilter(), lp = context.createBiquadFilter(); nodes.push(hp, lp);
    hp.type = "highpass"; hp.frequency.value = part === "bass" ? 28 : 30; hp.Q.value = 0.707;
    lp.type = "lowpass"; lp.frequency.value = part === "bass" ? 4200 : 11000; lp.Q.value = 0.707;
    source.connect(hp); hp.connect(lp); output = lp;
  }
  output.connect(context.destination); output.connect(send); send.connect(room.input); room.output.connect(context.destination);
  source.start();
  try {
    const pcm = (await context.startRendering()).getChannelData(0).slice();
    for (let i = frames - RHYTHM_RATE * 0.08; i < frames; i++) pcm[i] *= (frames - 1 - i) / (RHYTHM_RATE * 0.08);
    return pcm;
  } finally { nodes.forEach((node) => node.disconnect()); amp?.dispose(); room.dispose(); }
}
export function matchRhythmPair(a, b, target = 0.065) {
  const metrics = [a, b].map(rhythmMetrics);
  if (metrics.some((m) => m.rms < 1e-6)) throw new Error("Silent rhythm comparison");
  const level = Math.min(target, ...metrics.map((m) => 0.65 * m.rms / m.peak));
  [a, b].forEach((data, n) => { for (let i = 0; i < data.length; i++) data[i] *= level / metrics[n].rms; });
  return { previous: rhythmMetrics(a), refined: rhythmMetrics(b), targetRms: level };
}
export async function prepareRhythm(OfflineContext, stems, signal) {
  const prepared = { previous: {}, refined: {} }, measurements = {};
  for (const part of ["bass", "drums"]) {
    for (const voice of ["previous", "refined"]) {
      signal.throwIfAborted(); prepared[voice][part] = await colourPart(OfflineContext, stems[voice][part], part);
    }
    measurements[part] = matchRhythmPair(prepared.previous[part], prepared.refined[part]);
  }
  signal.throwIfAborted();
  const guitar = await colourPart(OfflineContext, stems.guitar, "guitar");
  const g = rhythmMetrics(guitar), scale = Math.min(0.035 / g.rms, 0.35 / g.peak);
  for (const voice of ["previous", "refined"]) {
    const mix = new Float32Array(frames);
    for (let i = 0; i < frames; i++) mix[i] = prepared[voice].bass[i] + prepared[voice].drums[i] + guitar[i] * scale;
    prepared[voice].band = mix;
  }
  measurements.band = matchRhythmPair(prepared.previous.band, prepared.refined.band, 0.085);
  signal.throwIfAborted();
  const bytes = Object.values(prepared).flatMap(Object.values).reduce((sum, data) => sum + data.byteLength, 0);
  if (bytes > MAX_RHYTHM_BYTES) throw new Error("Rhythm cache budget exceeded");
  return { prepared, measurements, bytes };
}
