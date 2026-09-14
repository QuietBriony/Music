import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { VERSION, CIRCUIT_HASH, CIRCUIT_BYTES, SEED, DURATION, MAX_ROUNDS, PARAMS,
  validateCircuit, prepareCircuit, motorTrace, firstBatch, nextBatch, compose, summarize } from "../experiments/listening-loop/v1/model.mjs";
import { TONE_URL } from "../experiments/listening-loop/v1/audio.mjs";

const base = new URL("../experiments/listening-loop/v1/", import.meta.url);
const read = (path) => readFileSync(new URL(path, base), "utf8");
let count = 0;
function check(name, fn) { fn(); count++; }
const raw = readFileSync(new URL("circuit.json", base));
const data = JSON.parse(raw);
check("provenance bytes and hash", () => {
  assert.equal(raw.byteLength, CIRCUIT_BYTES);
  assert.equal(createHash("sha256").update(raw).digest("hex"), CIRCUIT_HASH);
  assert.equal(data.provenance.license, "CC-BY-4.0");
});
const circuit = prepareCircuit(data);
check("six motor channels", () => assert.equal(circuit.legs.flat().length, 220));
check("malformed circuit fails closed", () => assert.throws(() => validateCircuit({ ...data, edges: [] })));
check("nonfinite weights rejected", () => assert.throws(() => validateCircuit({ ...data, edges: [[0, 1, Infinity], ...data.edges.slice(1)] })));
check("invalid indices rejected", () => assert.throws(() => validateCircuit({ ...data, edges: [[-1, 1, 1], ...data.edges.slice(1)] })));
check("nonfinite parameters rejected", () => assert.throws(() => compose({ seed: 1, params: { warmth: NaN } }, Array.from({ length: 128 }, () => [0, 0, 0, 0, 0, 0]))));
check("unknown condition rejected", () => assert.throws(() => motorTrace(circuit, 1, "unknown")));
const first = firstBatch();
const traces = first.map((c) => motorTrace(circuit, c.seed));
const scores = first.map((c, i) => compose(c, traces[i]));
check("deterministic neural trace", () => assert.deepEqual(traces[0], motorTrace(circuit, first[0].seed)));
check("deterministic score", () => assert.deepEqual(scores[0], compose(first[0], traces[0])));
check("ablation changes actual events", () => {
  const noEdges = motorTrace(circuit, first[1].seed, "rules");
  assert.notDeepEqual(traces[1], noEdges);
  assert.notDeepEqual(scores[1].events, compose(first[1], noEdges).events);
});
check("clear first-round structural contrast", () => {
  const s = scores.map(summarize);
  assert.ok(s[1].voices.kick >= s[0].voices.kick * 2);
  assert.ok(s[0].voices.pad > s[2].voices.pad);
  assert.ok(s[1].voices.bass >= s[2].voices.bass * 2);
  assert.ok(s.every((v) => v.sectionEvents[2] < v.sectionEvents[1]));
});
function scoreBudget(score) {
  assert.equal(score.duration, DURATION);
  assert.equal(score.bpm, 96);
  assert.ok(score.events.length > 20 && score.events.length <= 256);
  let previous = -1;
  for (const event of score.events) {
    assert.ok(event.time >= previous && event.time >= 0 && event.time < DURATION);
    previous = event.time;
    assert.ok(event.duration > 0 && event.time + event.duration <= DURATION);
    assert.ok(event.velocity >= 0.12 && event.velocity <= 0.8);
    assert.ok(event.notes.length >= 1 && event.notes.length <= 4);
    assert.ok(event.notes.every((n) => Number.isInteger(n) && n >= 0 && n <= 90));
    assert.ok(["pad", "lead", "bass", "kick", "snare", "hat"].includes(event.voice));
  }
  for (const key of PARAMS) assert.ok(score.params[key] >= 0.04 && score.params[key] <= 0.96);
}
for (let seed = SEED; seed < SEED + 6; seed++) {
  const batch = firstBatch(seed);
  for (let i = 0; i < 3; i++) check(`seed ${seed} candidate ${i} budget`, () => scoreBudget(compose(batch[i], traces[i])));
}
for (const kind of ["like", "monotonous", "unclear"]) {
  let batch = firstBatch();
  for (let round = 2; round <= MAX_ROUNDS; round++) {
    const feedback = kind === "like" ? { kind, candidateId: batch[1].id } : { kind };
    const next = nextBatch(batch, feedback);
    check(`${kind} round ${round} deterministic, bounded`, () => {
      assert.deepEqual(next, nextBatch(batch, feedback));
      assert.equal(new Set(next.map((c) => c.id)).size, 3);
      next.forEach((c, i) => { assert.equal(c.round, round); scoreBudget(compose(c, traces[i])); });
    });
    batch = next;
  }
  check(`${kind} explicit round budget`, () => assert.throws(() => nextBatch(batch, { kind, candidateId: batch[0].id })));
}
check("feedback changes later candidates", () => {
  assert.notDeepEqual(nextBatch(first, { kind: "like", candidateId: first[0].id }), nextBatch(first, { kind: "like", candidateId: first[1].id }));
  assert.notDeepEqual(nextBatch(first, { kind: "monotonous" }), nextBatch(first, { kind: "unclear" }));
});
check("liked beat yields structurally different explorations", () => {
  const next = nextBatch(first, { kind: "like", candidateId: first[1].id });
  const stats = next.map((c, i) => summarize(compose(c, traces[i])));
  assert.ok(stats[0].voices.kick > stats[1].voices.kick * 2);
  assert.ok(stats[0].voices.bass > stats[2].voices.bass * 2);
});
check("foreign feedback cannot enter batch", () => assert.throws(() => nextBatch(first, { kind: "like", candidateId: "r99-x" })));
check("unknown feedback rejected", () => assert.throws(() => nextBatch(first, { kind: "upload" })));
const html = read("index.html"), app = read("app.mjs"), audio = read("audio.mjs");
check("isolated opt-in surface", () => {
  assert.doesNotMatch(html + app + audio, /localStorage|sessionStorage|serviceWorker|engine\.js|Tone\.Transport|\.toDestination\(|getUserMedia|sendBeacon/);
  assert.doesNotMatch(html, /autoplay|tone@/);
  assert.ok(audio.includes('script.src = TONE_URL'));
  assert.ok(app.includes('"visibilitychange"'));
  assert.ok(app.includes('"pagehide"'));
  assert.ok(app.includes('"manual-review-only"'));
  assert.ok(app.includes('crypto.subtle.digest("SHA-256", data)'));
});
check("no runaway scheduling / default gain drift", () => {
  assert.ok(audio.includes("this.volume = 0.35"));
  assert.ok(audio.includes("seconds >= DURATION"));
  assert.ok(audio.includes("at >= this.raw.currentTime + 0.005"));
  assert.ok(audio.includes("clearInterval(this.interval)"));
  assert.ok(audio.includes("maxPolyphony: 4"));
  assert.ok(audio.includes("threshold: -5"));
  assert.ok(audio.includes("globalThis.Tone.getContext().dispose()"));
});
check("locked dependency and visible attribution", () => {
  const manifest = JSON.parse(readFileSync(new URL("../config/external-dependencies.json", import.meta.url), "utf8"));
  const item = manifest.dependencies.find((d) => d.id === "malecns-locomotor-data");
  assert.equal(item.integrity.value, CIRCUIT_HASH);
  assert.equal(item.expected_size.bytes, CIRCUIT_BYTES);
  assert.ok(manifest.dependencies.find((d) => d.id === "tonejs-runtime").runtime_urls.includes(TONE_URL));
  assert.ok(html.includes("MaleCNS collaboration"));
  assert.ok(read("THIRD-PARTY.md").includes(CIRCUIT_HASH));
  assert.ok(read(".gitattributes").includes("circuit.json -text"));
});
console.log(`${VERSION}: ${count} checks PASS; 0 BAD. Musical quality / physical mobile remain human gates.`);
console.log(JSON.stringify(scores.map((score) => ({ id: score.candidateId, ...summarize(score) }))));
