// Fixed notes separate instrument timbre from ARCB transcription errors.
// Recorded assets stay on the already registered immutable CDN, outside Git.
import { renderString } from "./dsp.mjs?v=4";
import { createGuitarAmp } from "./amp.mjs?v=1";

export const AUDITION_RATE = 32000;
export const AUDITION_SECONDS = 10.8;
export const REFERENCE_BASE = "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/guitar-electric";
export const REFERENCE_NOTES = [
  { midi: 40, file: "E2.mp3", hash: "7dd2be5de9d91dcd7f525ef8e1bfc8d77ffc27ac98faeb61e5eea0357ce42b75" },
  { midi: 45, file: "A2.mp3", hash: "cef8d3fe2cb17c36e4e9a96a002613aac15fe6224ef3d09e91ba23cc3555b910" },
  { midi: 51, file: "Ds3.mp3", hash: "0b6e69576b898eb61460a4b2b32ba4bcd4943a95035ba5794c19abdffc0208a0" },
  { midi: 57, file: "A3.mp3", hash: "b840f271794efc3efcce886d71d1ee57cf6d524b6da1be15b1429f6bc8fe2f45" }
];

export function auditionScore() {
  return [
    { time: 0.2, notes: [40], hold: 2, velocity: 0.8 },
    { time: 2.6, notes: [40, 47, 52], hold: 1.6, velocity: 0.85 },
    { time: 4.8, notes: [45, 52, 57], hold: 1.5, velocity: 0.85 },
    ...[0, 1, 2, 3].map((i) => ({ time: 6.8 + i * 0.27, notes: [40], hold: 0.12, velocity: i % 2 ? 0.65 : 0.85, palm: true })),
    { time: 8.05, notes: [40, 47, 52], hold: 2, velocity: 0.85 }
  ];
}

function normalizeNote(data) {
  let previous = 0, dc = 0, peak = 0;
  const pole = Math.exp(-2 * Math.PI * 18 / AUDITION_RATE);
  for (let i = 0; i < data.length; i++) {
    dc = data[i] - previous + pole * dc;
    previous = data[i]; data[i] = dc; peak = Math.max(peak, Math.abs(dc));
  }
  const gain = peak ? 0.22 / peak : 0;
  for (let i = 0; i < data.length; i++) data[i] *= gain * Math.min(1, (data.length - 1 - i) / (AUDITION_RATE * 0.025));
  return data;
}

export function syntheticAuditionNotes() {
  const notes = [40, 43, 46, 52, 58]; // Same nearest-note grid and seed as the current bank.
  return notes.map((midi) => ({ midi, data: normalizeNote(renderString({ part: "guitar", note: midi, duration: 2.5, velocity: 1, technique: "open" }, AUDITION_RATE, 113 + midi)) }))
    .concat([{ midi: 40, palm: true, data: normalizeNote(renderString({ part: "guitar", note: 40, duration: 0.55, velocity: 1, technique: "palm" }, AUDITION_RATE, 153)) }]);
}

async function boundedBody(response) {
  if (!response.ok) throw new Error(`録音ギターを取得できません（HTTP ${response.status}）。再取得はせず、合成の比較を残します。`);
  if (Number(response.headers.get("content-length")) > 150000) throw new Error("録音ギターのサイズが上限を超えています。");
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 150000) throw new Error("録音ギターのサイズが上限を超えています。");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return data;
}

export async function recordedAuditionNotes(context, signal) {
  const notes = [];
  for (const asset of REFERENCE_NOTES) {
    signal.throwIfAborted();
    const bytes = await boundedBody(await fetch(`${REFERENCE_BASE}/${asset.file}`, { signal }));
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (hash !== asset.hash) throw new Error("録音ギターの内容が確認した版と異なります。取得を止めました。");
    const decoded = await context.decodeAudioData(bytes.buffer);
    signal.throwIfAborted();
    if (decoded.duration > 5 || decoded.length > 5 * AUDITION_RATE || decoded.sampleRate !== AUDITION_RATE || decoded.numberOfChannels > 2) throw new Error("録音ギターが準備の上限を超えています。");
    const data = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const input = decoded.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] += input[i] / decoded.numberOfChannels;
    }
    if (!data.every(Number.isFinite)) throw new Error("録音ギターに不正な値があります。");
    notes.push({ midi: asset.midi, data: normalizeNote(data) });
  }
  return notes;
}

export function signalMetrics(data) {
  let energy = 0, peak = 0;
  for (const value of data) {
    if (!Number.isFinite(value)) throw new Error("比較音に不正な値があります。");
    energy += value * value; peak = Math.max(peak, Math.abs(value));
  }
  return { rms: Math.sqrt(energy / data.length), peak };
}

export async function renderAudition(OfflineContext, notes, recorded = false) {
  const context = new OfflineContext(1, Math.ceil(AUDITION_RATE * AUDITION_SECONDS), AUDITION_RATE);
  const amp = createGuitarAmp(context, "crunch"), nodes = [];
  amp.output.connect(context.destination);
  const buffers = notes.map((note) => {
    const buffer = context.createBuffer(1, note.data.length, AUDITION_RATE);
    buffer.copyToChannel(note.data, 0);
    return { ...note, buffer };
  });
  const score = auditionScore();
  for (const [strokeIndex, stroke] of score.entries()) {
    stroke.notes.forEach((pitch, i) => {
      const eligible = buffers.filter((note) => Boolean(note.palm) === Boolean(stroke.palm && !recorded));
      const nearest = eligible.reduce((best, note) => Math.abs(note.midi - pitch) < Math.abs(best.midi - pitch) ? note : best);
      const source = context.createBufferSource(), gain = context.createGain();
      const at = stroke.time + i * 0.007, rate = 2 ** ((pitch - nearest.midi) / 12);
      const next = score[strokeIndex + 1];
      const dampAt = next ? next.time : Infinity;
      const end = Math.min(AUDITION_SECONDS - 0.15, at + nearest.buffer.duration / rate, at + stroke.hold + (stroke.palm ? 0.065 : 1.8), dampAt + (next?.palm ? 0.018 : 0.1));
      source.buffer = nearest.buffer; source.playbackRate.value = rate;
      const level = stroke.velocity * 0.9 * (1 - i * 0.06);
      gain.gain.setValueAtTime(level, at);
      if (stroke.palm && recorded) {
        // An explicit approximation, not a recorded palm-mute articulation.
        gain.gain.exponentialRampToValueAtTime(level * 0.015, end - 0.015);
      } else gain.gain.setValueAtTime(level, Math.min(at + stroke.hold, dampAt, end - 0.025));
      gain.gain.linearRampToValueAtTime(0, end);
      source.connect(gain);
      if (stroke.palm && recorded) {
        const damping = context.createBiquadFilter(); damping.type = "lowpass"; damping.frequency.value = 1100; damping.Q.value = 0.707;
        gain.connect(damping); damping.connect(amp.input); nodes.push(damping);
      } else gain.connect(amp.input);
      source.start(at); source.stop(end); nodes.push(source, gain);
    });
  }
  try { return (await context.startRendering()).getChannelData(0).slice(); }
  finally { nodes.forEach((node) => node.disconnect()); amp.dispose(); }
}

export function matchAuditionLevels(synthetic, recorded) {
  const inputs = [synthetic, recorded].filter(Boolean);
  const metrics = inputs.map(signalMetrics);
  if (metrics.some(({ rms, peak }) => rms < 0.00001 || peak <= 0)) throw new Error("比較音の出力を確認できません。");
  // Equal phrase RMS, with a common target reduced if either signal needs headroom.
  const target = Math.min(0.06, ...metrics.map(({ rms, peak }) => 0.65 * rms / peak));
  inputs.forEach((data, i) => { const gain = target / metrics[i].rms; for (let j = 0; j < data.length; j++) data[j] *= gain; });
  return { targetRms: target, synthetic: signalMetrics(synthetic), recorded: recorded ? signalMetrics(recorded) : null };
}
