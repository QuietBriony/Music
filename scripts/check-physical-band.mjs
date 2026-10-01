import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScore } from "../audio/physical-band/score.mjs";
import { renderScore, renderString, midiFrequency } from "../audio/physical-band/dsp.mjs";

const rms = (data, start = 0, end = data.length) => {
  let energy = 0;
  for (let i = start; i < end; i++) energy += data[i] ** 2;
  return Math.sqrt(energy / (end - start));
};
// Measure the rendered waveform's periodicity, rather than reading DSP settings.
function measuredPitch(data, expected, sampleRate) {
  const period = sampleRate / expected;
  const start = Math.round(sampleRate * 0.06);
  const end = Math.min(data.length - Math.ceil(period * 1.15), Math.round(sampleRate * 0.24));
  const scores = new Map();
  for (let lag = Math.floor(period * 0.9); lag <= Math.ceil(period * 1.1); lag++) {
    let dot = 0, a = 0, b = 0;
    for (let i = start; i < end; i++) { dot += data[i] * data[i + lag]; a += data[i] ** 2; b += data[i + lag] ** 2; }
    scores.set(lag, dot / Math.sqrt(a * b));
  }
  const [lag] = [...scores].sort((a, b) => b[1] - a[1])[0];
  const left = scores.get(lag - 1), right = scores.get(lag + 1), center = scores.get(lag);
  assert.ok(Number.isFinite(left) && Number.isFinite(right), "Periodicity has an interior peak");
  const offset = 0.5 * (left - right) / (left - 2 * center + right);
  return sampleRate / (lag + offset);
}
for (const sampleRate of [22050, 32000, 48000]) {
  for (const note of [28, 40, 55, 69, 84]) {
    const event = { part: "guitar", note, duration: 0.8, velocity: 0.8, technique: "open" };
    const data = renderString(event, sampleRate, 42);
    const cents = 1200 * Math.log2(measuredPitch(data, midiFrequency(note), sampleRate) / midiFrequency(note));
    assert.ok(Math.abs(cents) < 20, `Rendered note ${note} @ ${sampleRate}: ${cents.toFixed(2)} cents`);
  }
}
const open = renderString({ part: "guitar", note: 52, duration: 0.8, velocity: 0.8, technique: "open" }, 32000, 42);
const palm = renderString({ part: "guitar", note: 52, duration: 0.8, velocity: 0.8, technique: "palm" }, 32000, 42);
assert.ok(rms(palm, 12000, 16000) < rms(open, 12000, 16000) * 0.1, "Palm damping shortens the audible sustain");

for (const style of ["rock", "jazz"]) {
  const score = createScore(style);
  const progress = [];
  const rendered = renderScore(score, 32000, (value) => progress.push(value));
  assert.deepEqual(progress, [1 / 3, 2 / 3, 1]);
  assert.ok(rendered.duration < 19 && rendered.bars === 8);
  let peakSum = 0, bytes = 0;
  for (const part of ["guitar", "bass", "drums"]) {
    const stem = rendered.stems[part];
    assert.ok(stem.every(Number.isFinite), `${style}/${part}: finite audio`);
    assert.ok(rms(stem) > 0.008, `${style}/${part}: audible energy`);
    const peak = stem.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    peakSum += peak; bytes += stem.byteLength;
    assert.ok(rms(stem, stem.length - 2000) < 0.0001, `${style}/${part}: silent end`);
  }
  assert.ok(peakSum < 0.9, "Even fully enabled parts leave headroom before the volume control");
  assert.ok(bytes < 7_000_000, "Each cached rehearsal is bounded to under 7 MB of PCM");
  const again = renderScore(score);
  assert.deepEqual(again.stems.bass, rendered.stems.bass, "Seeded synthesis is repeatable");
}
assert.throws(() => createScore("orchestra"));
for (const mutate of [
  (score) => { score.duration = 3600; },
  (score) => { score.events[0].time = -1; },
  (score) => { score.events[0].velocity = Infinity; },
  (score) => { score.events[0].part = "unknown"; },
  (score) => { score.events.push({ part: "bass", time: 0, note: 8, duration: 0.5, velocity: 1 }); }
]) { const score = createScore(); mutate(score); assert.throws(() => renderScore(score)); }

const ui = readFileSync(new URL("../audio/physical-band/preview.mjs", import.meta.url), "utf8");
assert.match(ui, /new Worker\(/);
assert.doesNotMatch(ui, /renderScore\(|Tone\.(?:Synth|Reverb|Transport)|fetch\(/);
assert.match(ui, /sources\.forEach\(\(source\) => source\.start\(at\)\)/);
assert.match(ui, /source\.stop\(\)/);
assert.match(ui, /worker\?\.terminate\(\)/);
assert.match(ui, /source\.onended = null/);
console.log("Physical band PASS: measured string tuning, damping, two original scores, headroom, bounded memory, deterministic audio and input rejection");
