import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rhythmScore, renderRhythmStems, rhythmMetrics, matchRhythmPair, RHYTHM_RATE, RHYTHM_SECONDS, MAX_RHYTHM_BYTES } from "../audio/physical-band/rhythm-audition.mjs";
const score = rhythmScore();
assert.equal(score.bass[0].note, 28);
assert.deepEqual(new Set(score.drums.map((e) => e.drum)), new Set(["kick", "snare", "hat", "tom", "ride", "crash"]));
for (const events of Object.values(score)) assert.ok(events.every((e) => e.time >= 0 && e.time < RHYTHM_SECONDS - 2));
assert.equal(score.guitar[0].time, 8);
const stems = renderRhythmStems();
for (const pcm of [stems.guitar, ...Object.values(stems.previous), ...Object.values(stems.refined)]) {
  assert.equal(pcm.length, RHYTHM_SECONDS * RHYTHM_RATE);
  assert.ok(pcm.every(Number.isFinite));
  assert.ok(rhythmMetrics(pcm).rms > 0.001);
  assert.ok(pcm[0] === 0 && pcm.at(-1) === 0);
}
assert.equal(MAX_RHYTHM_BYTES, RHYTHM_RATE * RHYTHM_SECONDS * 4 * 6);
const a = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i) * 0.2);
const b = Float32Array.from({ length: 1000 }, (_, i) => i === 500 ? 1 : Math.cos(i) * 0.01);
const m = matchRhythmPair(a, b);
assert.ok(Math.abs(m.previous.rms - m.refined.rms) < 1e-8);
assert.ok(Math.max(m.previous.peak, m.refined.peak) <= 0.650001);
assert.throws(() => matchRhythmPair(a, new Float32Array(1000)));
assert.throws(() => rhythmMetrics(new Float32Array([NaN])));
const html = readFileSync('band-room.html', 'utf8'), sw = readFileSync('sw.js', 'utf8');
assert.ok(html.includes('id="br-rhythm-audition"'));
for (const file of ['rhythm-synthesis', 'rhythm-audition', 'rhythm-worker', 'rhythm-preview']) assert.ok(sw.includes(`audio/physical-band/${file}.mjs?v=1`));
console.log('Rhythm audition: fixed isolated/groove score, finite stems, memory budget, level/headroom matching and offline assets passed');
