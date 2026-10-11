import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUDITION_RATE, AUDITION_SECONDS, REFERENCE_BASE, REFERENCE_NOTES, auditionScore, syntheticAuditionNotes, matchAuditionLevels, signalMetrics } from "../audio/physical-band/guitar-audition.mjs";
const catalog = JSON.parse(readFileSync("presets/online-samples-catalog.json", "utf8"));
const instrument = catalog.instruments.find((item) => item.id === "guitar-electric");
assert.equal(REFERENCE_BASE, instrument.base_url);
assert.match(instrument.license, /CC-BY 3.0/);
const names = { 40: "E2", 45: "A2", 51: "D#3", 57: "A3" };
for (const asset of REFERENCE_NOTES) {
  assert.equal(instrument.notes[names[asset.midi]], `/${asset.file}`);
  assert.match(asset.hash, /^[a-f0-9]{64}$/);
}
// Reject the earlier nonexistent / denied filenames, rather than retrying them.
assert.ok(REFERENCE_NOTES.every(({ file }) => !["Cs3.mp3", "E3.mp3", "Cs4.mp3", "E4.mp3", "Cs5.mp3"].includes(file)));
const score = auditionScore();
assert.deepEqual(score[1].notes, [40, 47, 52]);
assert.deepEqual(score[2].notes, [45, 52, 57]);
assert.equal(score.filter((stroke) => stroke.palm).length, 4);
assert.ok(score.every((stroke) => stroke.time >= 0 && stroke.time + stroke.hold < AUDITION_SECONDS));
const notes = [...syntheticAuditionNotes(), ...syntheticAuditionNotes(true)];
assert.ok(notes.reduce((bytes, note) => bytes + note.data.byteLength, 0) < 3_400_000);
for (const note of notes) {
  assert.ok(note.data.every(Number.isFinite));
  assert.ok(signalMetrics(note.data).peak <= 0.220001);
  assert.ok(note.data.length <= AUDITION_RATE * 2.5);
}
// Equal level despite a different crest factor, without clipping either signal.
const a = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i) * 0.3);
const b = Float32Array.from({ length: 1000 }, (_, i) => i === 500 ? 1 : Math.sin(i) * 0.02);
const c = Float32Array.from({ length: 1000 }, (_, i) => Math.cos(i) * 0.1);
const metrics = matchAuditionLevels(a, b, c);
assert.ok(Math.abs(metrics.synthetic.rms - metrics.recorded.rms) < 1e-8);
assert.ok(Math.abs(metrics.refined.rms - metrics.recorded.rms) < 1e-8);
assert.ok(Math.max(metrics.synthetic.peak, metrics.recorded.peak, metrics.refined.peak) <= 0.650001);
const withoutRecording = matchAuditionLevels(a, null, c);
assert.equal(withoutRecording.recorded, null);
assert.ok(Math.abs(withoutRecording.synthetic.rms - withoutRecording.refined.rms) < 1e-8);
assert.throws(() => matchAuditionLevels(new Float32Array(100), b));
assert.throws(() => signalMetrics(new Float32Array([NaN])));
const sw = readFileSync("sw.js", "utf8"), html = readFileSync("band-room.html", "utf8");
for (const file of ["guitar-audition", "guitar-audition-worker", "guitar-audition-preview"]) assert.ok(sw.includes(`audio/physical-band/${file}.mjs?v=2`));
assert.ok(sw.includes("audio/physical-band/electric-string.mjs?v=1"));
assert.ok(html.includes("br-guitar-audition"));
console.log("Guitar audition: score, existing asset provenance, finite output, memory and level matching passed");
