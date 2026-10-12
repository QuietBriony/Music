import assert from "node:assert/strict";
import { renderElectricBass, renderAcousticDrum, ACOUSTIC_DRUMS } from "../audio/physical-band/rhythm-synthesis.mjs";
const rms = (data, rate, a, b) => {
  let energy = 0; const end = Math.min(data.length, Math.round(rate * b)), start = Math.round(rate * a);
  for (let i = start; i < end; i++) energy += data[i] ** 2;
  return Math.sqrt(energy / Math.max(1, end - start));
};
function pitch(data, rate, hz) {
  const period = rate / hz, values = new Map();
  for (let lag = Math.floor(period * 0.92); lag <= Math.ceil(period * 1.08); lag++) {
    let dot = 0, a = 0, b = 0;
    for (let i = Math.round(rate * 0.2); i < Math.round(rate * 0.55); i++) {
      dot += data[i] * data[i + lag]; a += data[i] ** 2; b += data[i + lag] ** 2;
    }
    values.set(lag, dot / Math.sqrt(a * b));
  }
  const [lag, mid] = [...values].sort((a, b) => b[1] - a[1])[0], left = values.get(lag - 1), right = values.get(lag + 1);
  assert.ok(Number.isFinite(left) && Number.isFinite(right));
  return rate / (lag + 0.5 * (left - right) / (left - 2 * mid + right));
}
let bassCases = 0, drumCases = 0;
for (const rate of [16000, 32000, 48000]) {
  for (const note of [24, 28, 33, 38, 43, 48, 60]) {
    const event = { note, duration: 3, velocity: 0.8 }, data = renderElectricBass(event, rate);
    assert.equal(data.length, rate * 3);
    assert.ok(data.every(Number.isFinite) && data[0] === 0 && data.at(-1) === 0);
    const hz = 440 * 2 ** ((note - 69) / 12), cents = 1200 * Math.log2(pitch(data, rate, hz) / hz);
    assert.ok(Math.abs(cents) < 8, `${note}@${rate}: ${cents.toFixed(2)} cents`);
    const decay = 20 * Math.log10(rms(data, rate, 1.6, 1.9) / rms(data, rate, 0.08, 0.38));
    assert.ok(decay > -22 && decay < -4, `Sustained but decaying bass: ${decay}`);
    const muted = renderElectricBass({ ...event, technique: "mute" }, rate);
    assert.ok(rms(muted, rate, 0.4, 0.6) < rms(data, rate, 0.4, 0.6) * 0.02);
    bassCases++;
  }
  for (const drum of Object.keys(ACOUSTIC_DRUMS)) {
    const data = renderAcousticDrum({ drum, velocity: 0.8 }, rate, 42);
    assert.ok(data.every(Number.isFinite) && data[0] === 0 && data.at(-1) === 0);
    assert.ok(rms(data, rate, 0.01, 0.06) > 0.005);
    assert.ok(data.length <= rate * 3);
    if (["ride", "crash"].includes(drum)) {
      const late = rms(data, rate, 1, 1.2), early = rms(data, rate, 0.01, 0.08);
      assert.ok(late > early * 0.02 && late < early * 0.4, `${drum}: metal ring must remain and decay`);
    }
    if (drum === "hat") assert.ok(rms(data, rate, 0.13, 0.16) < rms(data, rate, 0.01, 0.04) * 0.04);
    assert.deepEqual(data, renderAcousticDrum({ drum, velocity: 0.8 }, rate, 42));
    assert.ok(renderAcousticDrum({ drum, velocity: 0 }, rate, 42).every((x) => x === 0));
    drumCases++;
  }
}
const event = { note: 28, duration: 1, velocity: 1 };
for (const invalid of [{ note: NaN }, { note: 80 }, { duration: 999 }, { velocity: Infinity }, { technique: "unknown" }]) assert.throws(() => renderElectricBass({ ...event, ...invalid }));
assert.throws(() => renderAcousticDrum({ drum: "unknown" }));
assert.throws(() => renderAcousticDrum({ drum: "kick", velocity: -1 }));
assert.throws(() => renderElectricBass(event, 192000));
assert.throws(() => renderAcousticDrum({ drum: "kick" }, NaN));
console.log(`Rhythm synthesis: ${bassCases} bass pitch/sustain/mute cases; ${drumCases} percussion body/tail cases; finite deterministic bounds passed`);
