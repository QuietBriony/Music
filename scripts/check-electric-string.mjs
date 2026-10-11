import assert from "node:assert/strict";
import { renderElectricString } from "../audio/physical-band/electric-string.mjs";

const rms = (data, rate, a, b) => {
  const lo = Math.round(a * rate), hi = Math.round(b * rate);
  let energy = 0;
  for (let i = lo; i < hi; i++) energy += data[i] ** 2;
  return Math.sqrt(energy / (hi - lo));
};
function measuredFrequency(data, rate, expected) {
  const period = rate / expected, scores = new Map();
  for (let lag = Math.floor(period * 0.9); lag <= Math.ceil(period * 1.1); lag++) {
    let dot = 0, a = 0, b = 0;
    for (let i = Math.round(rate * 0.1); i < Math.round(rate * 0.35); i++) {
      dot += data[i] * data[i + lag]; a += data[i] ** 2; b += data[i + lag] ** 2;
    }
    scores.set(lag, dot / Math.sqrt(a * b));
  }
  const [lag, mid] = [...scores].sort((a, b) => b[1] - a[1])[0];
  const left = scores.get(lag - 1), right = scores.get(lag + 1);
  assert.ok(Number.isFinite(left) && Number.isFinite(right), "Interior periodicity peak");
  return rate / (lag + 0.5 * (left - right) / (left - 2 * mid + right));
}
for (const rate of [16000, 22050, 32000, 48000]) {
  for (const note of [40, 45, 51, 57, 64, 76, 84]) {
    const event = { note, duration: 2.5, velocity: 0.8, technique: "open" };
    const data = renderElectricString(event, rate);
    assert.equal(data.length, Math.ceil(rate * event.duration));
    assert.ok(data.every(Number.isFinite));
    assert.ok(data[0] === 0 && data.at(-1) === 0, "Silent endpoints, including signed zero");
    const expected = 440 * 2 ** ((note - 69) / 12);
    const cents = 1200 * Math.log2(measuredFrequency(data, rate, expected) / expected);
    assert.ok(Math.abs(cents) < 12, `${note}@${rate}: ${cents.toFixed(2)} cents`);
    const decay = 20 * Math.log10(rms(data, rate, 1.6, 1.9) / rms(data, rate, 0.05, 0.35));
    assert.ok(decay > -26 && decay < -5, `${note}@${rate}: continuous, decaying ring (${decay.toFixed(2)} dB)`);
    const palm = renderElectricString({ ...event, technique: "palm" }, rate);
    assert.ok(rms(palm, rate, 0.35, 0.5) < rms(data, rate, 0.35, 0.5) * 0.015, "Muted string must decay, not merely play quietly");
  }
}
const event = { note: 40, duration: 0.8, velocity: 1, technique: "open" };
assert.deepEqual(renderElectricString(event), renderElectricString(event), "Reproducible synthesis");
assert.ok(renderElectricString({ ...event, velocity: 0 }).every((value) => value === 0));
for (const invalid of [{ note: 12 }, { note: NaN }, { duration: 3600 }, { velocity: Infinity }, { technique: "unknown" }]) {
  assert.throws(() => renderElectricString({ ...event, ...invalid }));
}
assert.throws(() => renderElectricString(event, 192000));
console.log("Electric string: 28 rendered pitches, measurable sustain, effective muting, finite bounded/reproducible output passed");
