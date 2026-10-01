// Small, original implementation of a lossy plucked-string delay loop and
// damped drum modes. Rendered in a Worker; none of this runs on the audio thread.
import { PARTS, STYLES } from "./score.mjs?v=4";

export const midiFrequency = (note) => 440 * 2 ** ((note - 69) / 12);
function random(seed) {
  let state = seed >>> 0 || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function bounded(value, low, high, name) {
  if (!Number.isFinite(value) || value < low || value > high) throw new Error(`Invalid ${name}`);
}

export function renderString(event, sampleRate, seed = 1) {
  bounded(sampleRate, 16000, 48000, "sample rate");
  bounded(event.note, 24, 84, "note");
  bounded(event.duration, 0.02, 3, "note duration");
  bounded(event.velocity, 0, 1, "velocity");
  const frequency = midiFrequency(event.note);
  // Compensate the half-sample phase delay of the two-tap loss filter.
  const delay = sampleRate / frequency - 0.5;
  const size = Math.ceil(delay) + 2;
  const ring = new Float64Array(size);
  const excitation = new Float64Array(size);
  const rand = random(seed);
  const pluck = Math.max(1, Math.round(delay * (event.part === "bass" ? 0.22 : 0.16)));
  let mean = 0;
  for (let i = 0; i < size; i++) excitation[i] = rand() * 2 - 1;
  for (let i = 0; i < size; i++) {
    // A displaced string has a pitched body. White-noise-only excitation
    // made its fundamental depend on the seed and left a thin pick click
    // dominating the peak-normalized bank. Keep a small pick component.
    const position = Math.min(1, i / delay), pickPosition = event.part === "bass" ? 0.22 : 0.16;
    const displacement = (position < pickPosition ? position / pickPosition : (1 - position) / (1 - pickPosition)) * 2 - 1;
    const pickNoise = excitation[i] - excitation[(i + size - pluck) % size];
    ring[i] = (displacement * (event.part === "bass" ? 0.95 : 0.4) + pickNoise * (event.part === "bass" ? 0.035 : 0.3)) * 0.35;
    mean += ring[i] / size;
  }
  for (let i = 0; i < size; i++) ring[i] -= mean;
  const palm = event.technique === "palm";
  const sustain = palm ? 0.22 : (event.part === "bass" ? 4.5 : 3.2);
  const loss = Math.exp(-6.91 / (frequency * sustain));
  const frames = Math.ceil(event.duration * sampleRate);
  const output = new Float32Array(frames);
  const release = Math.min(frames / 3, sampleRate * 0.028);
  let write = 0, previous = 0;
  for (let i = 0; i < frames; i++) {
    let read = write - delay;
    if (read < 0) read += size;
    const index = Math.floor(read);
    const fraction = read - index;
    const value = ring[index] * (1 - fraction) + ring[(index + 1) % size] * fraction;
    ring[write] = (value + previous) * 0.5 * loss;
    previous = value;
    write = (write + 1) % size;
    const envelope = Math.min(1, i / (sampleRate * 0.0015)) * Math.min(1, (frames - 1 - i) / release);
    output[i] = value * envelope * event.velocity;
  }
  return output;
}

const DRUMS = {
  kick: { frequency: 58, ratios: [1, 1.59, 2.14, 2.3, 2.65], decay: 0.25, length: 0.65, noise: 0.01, noiseHP: 900, noiseLP: 4500, noiseDecay: 0.015 },
  snare: { frequency: 180, ratios: [1, 1.59, 2.14, 2.3, 2.65], decay: 0.14, length: 0.5, noise: 0.7, noiseHP: 700, noiseLP: 6500 },
  hat: { frequency: 3200, ratios: [1, 1.29, 1.61, 1.93, 2.28, 2.84], decay: 0.022, length: 0.095, noise: 0.14 },
  ride: { frequency: 2800, ratios: [1, 1.44, 1.87, 2.43, 2.99], decay: 0.28, length: 0.9, noise: 0.035 },
  crash: { frequency: 1950, ratios: [1, 1.39, 1.73, 2.19, 2.71, 3.47, 4.23], decay: 0.42, length: 1.55, noise: 0.16 },
  tom: { frequency: 104, ratios: [1, 1.59, 2.14, 2.3, 2.65], decay: 0.22, length: 0.65, noise: 0.025 },
  cowbell: { frequency: 540, ratios: [1, 1.5, 2.13], decay: 0.07, length: 0.25, noise: 0.005 }
};
export function renderDrum(event, sampleRate, seed) {
  const spec = DRUMS[event.drum];
  if (!spec) throw new Error("Invalid drum");
  const output = new Float32Array(Math.ceil(spec.length * sampleRate));
  const modes = spec.ratios.filter((ratio) => ratio * spec.frequency < sampleRate * 0.45).map((ratio, i) => {
    const radius = Math.exp(-1 / (sampleRate * spec.decay / (1 + i * 0.3)));
    const omega = 2 * Math.PI * spec.frequency * ratio / sampleRate;
    return { re: 1 / (i + 1) ** 1.3, im: 0, c: Math.cos(omega) * radius, s: Math.sin(omega) * radius };
  });
  const rand = random(seed);
  const noiseLP = 1 - Math.exp(-2 * Math.PI * (spec.noiseLP || 12000) / sampleRate);
  const noiseHP = 1 - Math.exp(-2 * Math.PI * (spec.noiseHP || 2500) / sampleRate);
  let noiseLow = 0, noiseBase = 0;
  for (let frame = 0; frame < output.length; frame++) {
    let value = 0;
    for (const mode of modes) {
      value += mode.re;
      const re = mode.re * mode.c - mode.im * mode.s;
      mode.im = mode.re * mode.s + mode.im * mode.c;
      mode.re = re;
    }
    const noise = rand() * 2 - 1;
    // Baked noise colour separates the head/body from wire/cymbal air.
    // Differencing white noise pushed snare brightness toward the top octave.
    noiseLow += noiseLP * (noise - noiseLow);
    noiseBase += noiseHP * (noiseLow - noiseBase);
    value = value * 0.38 + (noiseLow - noiseBase) * spec.noise * Math.exp(-frame / (sampleRate * (spec.noiseDecay || spec.decay)));
    const attack = Math.min(1, frame / (sampleRate * 0.001));
    const release = Math.min(1, (output.length - 1 - frame) / (sampleRate * 0.015));
    output[frame] = value * attack * release * event.velocity;
  }
  return output;
}

export function renderScore(score, sampleRate = 32000, progress = () => {}) {
  if (!STYLES.includes(score.style) || !Array.isArray(score.events) || score.events.length > 2048) throw new Error("Invalid score");
  bounded(sampleRate, 16000, 48000, "sample rate");
  bounded(score.duration, 1, 30, "score duration");
  for (const event of score.events) {
    if (!PARTS.includes(event.part)) throw new Error("Invalid part");
    bounded(event.time, 0, score.duration - 0.1, "event time");
    bounded(event.velocity, 0, 1, "velocity");
    if (event.part === "drums") { if (!DRUMS[event.drum]) throw new Error("Invalid drum"); }
    else { bounded(event.note, 28, 84, "note"); bounded(event.duration, 0.02, 3, "note duration"); }
  }
  const count = Math.ceil(score.duration * sampleRate);
  const stems = {};
  const peaks = {};
  PARTS.forEach((part, partIndex) => {
    const buffer = new Float32Array(count);
    score.events.forEach((event, index) => {
      if (event.part !== part) return;
      const data = part === "drums" ? renderDrum(event, sampleRate, 73 + index) : renderString(event, sampleRate, 73 + index);
      const start = Math.round(event.time * sampleRate);
      for (let i = 0; i < Math.min(data.length, count - start); i++) buffer[start + i] += data[i];
    });
    // Bake the simple amplifier/cabinet colour; no standing FX graph.
    const drive = part === "guitar" ? (score.style === "rock" ? 3.2 : 1.2) : 1;
    const lowpass = 1 - Math.exp(-2 * Math.PI * (part === "bass" ? 1800 : 5200) / sampleRate);
    const dcPole = Math.exp(-2 * Math.PI * 18 / sampleRate);
    let prior = 0, dc = 0, filtered = 0, peak = 0;
    for (let i = 0; i < count; i++) {
      const raw = buffer[i];
      dc = raw - prior + dcPole * dc;
      prior = raw;
      const coloured = part === "guitar" ? Math.tanh(dc * drive) : dc;
      filtered += lowpass * (coloured - filtered);
      buffer[i] = filtered;
      peak = Math.max(peak, Math.abs(filtered));
    }
    const target = part === "drums" ? 0.24 : (part === "bass" ? 0.34 : 0.3);
    const scale = peak > 0 ? target / peak : 0;
    for (let i = 0; i < count; i++) buffer[i] *= scale;
    stems[part] = buffer;
    peaks[part] = peak > 0 ? target : 0;
    progress((partIndex + 1) / PARTS.length);
  });
  return { style: score.style, bpm: score.bpm, bars: score.bars, duration: count / sampleRate, sampleRate, stems, peaks };
}
