// Original bounded model + composition. No physiological time-scale claim.
export const VERSION = "listening-loop-v1";
export const CIRCUIT_HASH = "8f76d94034dcf802453e3a0a8ed5342d122e57d37e2bb5ea28da66de0856f5d6";
export const CIRCUIT_BYTES = 1076374;
export const SEED = 20260914;
export const DURATION = 20;
export const MAX_ROUNDS = 12;
export const PARAMS = ["warmth", "pulse", "space", "fracture"];
export const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function params(values) {
  return Object.fromEntries(PARAMS.map((key) => {
    if (!Number.isFinite(values[key])) throw new Error(`Invalid ${key}`);
    return [key, Math.round(clamp(values[key], 0.04, 0.96) * 1000) / 1000];
  }));
}
export function validateCircuit(data) {
  if (!data || data.neurons?.length !== 1045 || data.edges?.length !== 17224 ||
      data.rawSynapseCounts?.length !== 17224 || data.provenance?.license !== "CC-BY-4.0") {
    throw new Error("Circuit schema mismatch");
  }
  for (const [i, edge] of data.edges.entries()) {
    if (!Array.isArray(edge) || edge.length !== 3 || !edge.every(Number.isFinite) ||
        !edge.slice(0, 2).every((v) => Number.isInteger(v) && v >= 0 && v < 1045) ||
        Math.abs(edge[2]) > 100000 || !Number.isFinite(data.rawSynapseCounts[i])) {
      throw new Error("Invalid circuit edge");
    }
  }
  const legs = Array.from({ length: 6 }, () => []);
  const seen = new Set();
  const roles = new Set(["ascending", "descending", "premotor", "motor", "sensory"]);
  data.neurons.forEach((cell, i) => {
    if (typeof cell.id !== "string" || seen.has(cell.id) || !roles.has(cell.role)) {
      throw new Error("Invalid circuit neuron");
    }
    seen.add(cell.id);
    if (cell.role === "motor") {
      if (!Number.isInteger(cell.leg) || cell.leg < 0 || cell.leg > 5) throw new Error("Invalid motor leg");
      legs[cell.leg].push(i);
    }
  });
  if (legs.some((leg) => leg.length === 0)) throw new Error("Missing motor readout");
  return legs;
}
export function prepareCircuit(data) {
  const legs = validateCircuit(data);
  const count = data.neurons.length;
  const incoming = new Float64Array(count);
  const from = new Uint16Array(data.edges.length);
  const to = new Uint16Array(data.edges.length);
  const weights = new Float64Array(data.edges.length);
  data.edges.forEach(([source, target, weight], i) => {
    from[i] = source; to[i] = target; weights[i] = weight;
    incoming[target] += Math.abs(weight);
  });
  // Absolute incoming-sum normalization bounds recurrent drive per neuron.
  for (let i = 0; i < weights.length; i++) weights[i] /= Math.max(1, incoming[to[i]]);
  return { count, from, to, weights, legs, roles: data.neurons.map((n) => n.role) };
}
export function motorTrace(circuit, seed, mode = "circuit") {
  if (!["circuit", "rules"].includes(mode)) throw new Error("Unknown condition");
  const rng = random(seed);
  const phase = Float64Array.from({ length: circuit.count }, () => rng() * Math.PI * 2);
  const state = new Float64Array(circuit.count);
  const fatigue = new Float64Array(circuit.count);
  const drive = new Float64Array(circuit.count);
  const trace = [];
  for (let step = -24; step < 128; step++) {
    for (let micro = 0; micro < 4; micro++) {
      drive.fill(0);
      if (mode === "circuit") {
        for (let e = 0; e < circuit.weights.length; e++) {
          drive[circuit.to[e]] += circuit.weights[e] * state[circuit.from[e]];
        }
      }
      for (let i = 0; i < circuit.count; i++) {
        const wave = Math.sin((step + micro / 4) * 0.19 + phase[i]);
        const sensory = circuit.roles[i] === "sensory" ? 0.38 : 0.025;
        const descending = circuit.roles[i] === "descending" ? 0.28 : 0;
        const target = Math.max(0, Math.tanh(1.7 * drive[i] + sensory * (wave + 1) +
          descending * (1 + Math.sin(step * 0.07)) + 0.055 - fatigue[i] * 0.3));
        state[i] += (target - state[i]) * 0.24;
        fatigue[i] += (state[i] - fatigue[i]) * 0.035;
      }
    }
    if (step >= 0) trace.push(circuit.legs.map((leg) =>
      leg.reduce((sum, i) => sum + state[i], 0) / leg.length));
  }
  // Readout calibration is an authored music mapping, not neural firing Hz.
  for (let leg = 0; leg < 6; leg++) {
    const values = trace.map((row) => row[leg]);
    const low = Math.min(...values), high = Math.max(...values);
    const middle = (high + low) / 2;
    const width = Math.max(0.035, high - low);
    trace.forEach((row) => { row[leg] = clamp(0.5 + (row[leg] - middle) / width); });
  }
  return trace;
}
const ANCHORS = [
  { title: "霞むコード", description: "長い和音。短い旋律が、少し変わって戻る。", warmth: 0.91, pulse: 0.2, space: 0.47, fracture: 0.18 },
  { title: "ずれたビート", description: "低音と裏拍。途中で引いて、また動きだす。", warmth: 0.3, pulse: 0.9, space: 0.2, fracture: 0.8 },
  { title: "光る断片", description: "高い粒と長い間。呼びかけに、別の音が返る。", warmth: 0.24, pulse: 0.14, space: 0.9, fracture: 0.48 }
];
function candidate(p, index, round, seed, title, description) {
  return { id: `r${round}-${"abc"[index]}`, letter: "ABC"[index], round,
    seed: (seed + round * 4099 + index * 131) >>> 0, params: params(p), title, description };
}
export function firstBatch(seed = SEED) {
  return ANCHORS.map((p, i) => candidate(p, i, 1, seed, p.title, p.description));
}
export function nextBatch(batch, feedback, seed = SEED) {
  if (batch.length !== 3 || batch.some((c) => c.round !== batch[0].round)) throw new Error("Invalid batch");
  const round = batch[0].round + 1;
  if (round > MAX_ROUNDS) throw new Error("Round budget reached");
  const rng = random(seed + round * 7717);
  let result;
  if (feedback.kind === "like") {
    const liked = batch.find((c) => c.id === feedback.candidateId);
    if (!liked) throw new Error("Feedback candidate does not belong to batch");
    const p = liked.params;
    result = [
      { ...p, fracture: p.fracture + (rng() - 0.5) * 0.12 },
      { ...p, pulse: p.pulse < 0.55 ? 0.88 : 0.3, fracture: p.fracture + 0.16 },
      { ...p, space: p.space < 0.7 ? 0.88 : 0.3, warmth: p.warmth + (p.warmth < 0.5 ? 0.2 : -0.2) }
    ];
    return result.map((values, i) => candidate(values, i, round, seed,
      ["選んだ芯を残す", "リズムを変える", "余白を変える"][i],
      [`${liked.letter} の配合を残して、旋律を作り直す。`, `${liked.letter} から、拍の密度と崩し方を変える。`, `${liked.letter} から、休符と和音の長さを変える。`][i]));
  }
  if (!["monotonous", "unclear"].includes(feedback.kind)) throw new Error("Unknown feedback");
  if (feedback.kind === "unclear") {
    result = [
      { warmth: 0.96, pulse: 0.04, space: 0.45, fracture: 0.08 },
      { warmth: 0.12, pulse: 0.96, space: 0.08, fracture: 0.92 },
      { warmth: 0.08, pulse: 0.04, space: 0.96, fracture: 0.6 }
    ];
  } else {
    result = batch.map((c, i) => ({ ...c.params, fracture: c.params.fracture + 0.24,
      space: c.params.space + (i === 1 ? -0.2 : 0.2), pulse: c.params.pulse + (i === 1 ? 0.18 : -0.1) }));
  }
  return result.map((p, i) => candidate(p, i, round, seed, ANCHORS[i].title,
    feedback.kind === "unclear" ? ["和音に絞って、長く伸ばす。", "ビートを前へ。和音は短く。", "低音を引いて、粒と沈黙に寄せる。"][i] :
      ["戻ってくる旋律に、別の終わり方を。", "拍の抜けと、短い切り返しを増やす。", "鳴らさない時間と、高低の応答を増やす。"][i]));
}
const CHORDS = [[57, 60, 64, 71], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 69]];
const ROOTS = [45, 41, 48, 43];
const SIXTEENTH = DURATION / 128;
export function compose(c, trace) {
  if (trace.length !== 128 || trace.some((row) => row.length !== 6 || row.some((v) => !Number.isFinite(v) || v < 0 || v > 1))) {
    throw new Error("Invalid motor trace");
  }
  const p = params(c.params), rng = random(c.seed ^ 0x17abcd);
  const drumPulse = p.pulse * (1 - p.space * 0.65);
  const events = [];
  const add = (voice, step, notes, length, velocity) => {
    const time = Math.max(0, step * SIXTEENTH);
    if (time > DURATION - 0.4) return;
    events.push({ voice, time: +time.toFixed(5), notes: Array.isArray(notes) ? notes : [notes],
      duration: +Math.min(length * SIXTEENTH, DURATION - 0.18 - time).toFixed(5),
      velocity: +clamp(velocity, 0.12, 0.8).toFixed(4) });
  };
  // A small original motif is repeated, then answered; not random note soup.
  const motif = [0, 2, 1, 3, 2, 1, 0, 2];
  for (let bar = 0; bar < 8; bar++) {
    const section = Math.floor(bar / 2);
    const chord = CHORDS[section], root = ROOTS[section];
    const thin = bar === 4 || bar === 5;
    const density = thin ? 0.57 : 1;
    const start = bar * 16;
    if (p.warmth > 0.55) {
      add("pad", start, chord, 10 + p.warmth * 3, 0.52);
    } else if (bar % 2 === 0) {
      add("pad", start + 2, chord.slice(1, 4), 3 + p.warmth * 6, 0.42);
    }
    const slots = p.space > 0.7 ? [0, 7, 12] : p.pulse > 0.6 ? [2, 5, 10, 14] : [0, 6, 10];
    for (let n = 0; n < slots.length; n++) {
      if (thin && n === 1) continue;
      const slot = slots[n], signal = trace[start + slot];
      const displaced = p.fracture > 0.58 && signal[1] > 0.55 ? 1 : 0;
      const swing = slot % 2 ? 0.17 * p.pulse : 0;
      const reply = bar % 2 === 1;
      const turn = signal[0] > 0.6 ? 1 : 0;
      const degree = (motif[(n + (reply ? 3 : 0)) % 8] + turn) % chord.length;
      const octave = p.space > 0.7 || (reply && p.fracture > 0.5) ? 12 : 0;
      add("lead", start + slot + displaced + swing, chord[degree] + octave,
        p.space > 0.7 ? 2.8 : 2.2 + p.warmth * 2.5, 0.52 + signal[2] * 0.16);
      if (p.fracture > 0.7 && !thin && n === slots.length - 1 && slot < 14) {
        add("lead", start + slot + 2, chord[(degree + 1) % 4] + octave, 1.2, 0.32);
      }
    }
    const bassSlots = p.space > 0.7 ? [0] : p.pulse > 0.55 ? [0, 6, 10, 14] : [0, 10];
    for (const slot of bassSlots) {
      if ((thin && slot > 6) || (p.space > 0.8 && bar % 2)) continue;
      const signal = trace[start + slot];
      const extra = slot === 14 && signal[3] > 0.52 ? 7 : 0;
      add("bass", start + slot + (slot === 6 ? p.fracture * 0.4 : 0), root + extra,
        p.pulse > 0.55 ? (slot === 14 ? 1.2 : 2.7) : 6, 0.64);
    }
    for (let slot = 0; slot < 16; slot++) {
      const signal = trace[start + slot];
      if (drumPulse > 0.5) {
        if (slot === 0 || (!thin && (slot === 6 || (slot === 11 && signal[4] > 0.4)))) {
          add("kick", start + slot, 36, 0.65, slot === 0 ? 0.72 : 0.55);
        }
        if (slot === 4 || (slot === 12 && !thin)) add("snare", start + slot + 0.13, 0, 0.45, 0.55);
      } else if (slot === 0 && bar % 2 === 0 && drumPulse > 0.1) {
        add("kick", start, 36, 0.65, 0.43);
      }
      if (!thin && slot % 4 === 2 && rng() < drumPulse * density * (0.5 + signal[5] * 0.5)) {
        add("hat", start + slot + 0.15, 0, 0.25, 0.26 + rng() * 0.12);
      }
    }
  }
  events.sort((a, b) => a.time - b.time);
  return { version: VERSION, candidateId: c.id, duration: DURATION, bpm: 96, seed: c.seed, params: p, events };
}
export function summarize(score) {
  return { events: score.events.length, voices: Object.fromEntries(
    ["pad", "lead", "bass", "kick", "snare", "hat"].map((v) => [v, score.events.filter((e) => e.voice === v).length])),
    sectionEvents: Array.from({ length: 4 }, (_, section) =>
      score.events.filter((e) => Math.floor(e.time / 5) === section).length) };
}
