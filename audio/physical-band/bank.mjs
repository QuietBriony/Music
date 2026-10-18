import { renderDrum } from "./dsp.mjs?v=4";
import { renderElectricString } from "./electric-string.mjs?v=1";
import { renderElectricBass, renderAcousticDrum } from "./rhythm-synthesis.mjs?v=2";

export const BANK_SAMPLE_RATE = 32000;
// Bass needs the recorded long holds, including the 6.63-second final note.
// Its model is band-limited below 6.5 kHz. 16 kHz keeps an eight-second tail
// bounded without doubling the whole bank or adding live synthesis nodes.
export const BASS_SAMPLE_RATE = 16000;
export const BASS_BANK_SECONDS = 8;
export const MAX_BANK_BYTES = 15_400_000;
export const GUITAR_KEYS = [...Array.from({ length: 15 }, (_, i) => 40 + i * 3), 84];
export const BASS_KEYS = Array.from({ length: 13 }, (_, i) => 24 + i * 3);
export const DRUM_KEYS = ["kick", "snare", "hat", "ride", "crash", "tom", "cowbell"];

function finish(data, target, sampleRate = BANK_SAMPLE_RATE) {
  // DC-free samples with a level ceiling; velocity remains a live gain.
  let previous = 0, dc = 0, peak = 0;
  const pole = Math.exp(-2 * Math.PI * 18 / sampleRate);
  for (let i = 0; i < data.length; i++) {
    dc = data[i] - previous + pole * dc;
    previous = data[i]; data[i] = dc; peak = Math.max(peak, Math.abs(dc));
  }
  const scale = peak ? target / peak : 0;
  for (let i = 0; i < data.length; i++) {
    const tail = Math.min(1, (data.length - 1 - i) / (sampleRate * 0.025));
    data[i] *= scale * tail;
  }
  return data;
}

export function renderInstrumentBank(progress = () => {}) {
  const samples = {}, sampleRates = {};
  const jobs = [
    ...GUITAR_KEYS.flatMap((note) => [
      [`guitar:${note}`, () => renderElectricString({ note, duration: 3, velocity: 1, technique: "open" }, BANK_SAMPLE_RATE), 0.12],
      [`palm:${note}`, () => renderElectricString({ note, duration: 0.55, velocity: 1, technique: "palm" }, BANK_SAMPLE_RATE), 0.12]
    ]),
    ...BASS_KEYS.map((note) => [`bass:${note}`, () => renderElectricBass({ note, duration: BASS_BANK_SECONDS, velocity: 1 }, BASS_SAMPLE_RATE), 0.30, BASS_SAMPLE_RATE]),
    ...DRUM_KEYS.map((drum, i) => [`drums:${drum}`, () => (drum === "cowbell" ? renderDrum : renderAcousticDrum)({ drum, velocity: 1 }, BANK_SAMPLE_RATE, 331 + i), drum === "kick" ? 0.48 : (["snare", "hat", "ride", "crash"].includes(drum) ? 0.55 : 0.4)]),
    // A quiet snare excites less wire, rather than scaling the loud hit alone.
    ["drums:snare-soft", () => renderAcousticDrum({ drum: "snare", velocity: 0.35 }, BANK_SAMPLE_RATE, 332), 0.55]
  ];
  jobs.forEach(([key, render, peak, rate = BANK_SAMPLE_RATE], i) => {
    samples[key] = finish(render(), peak, rate);
    sampleRates[key] = rate;
    if (i % 8 === 0 || i === jobs.length - 1) progress((i + 1) / jobs.length);
  });
  const bytes = Object.values(samples).reduce((sum, sample) => sum + sample.byteLength, 0);
  if (bytes > MAX_BANK_BYTES) throw new Error("Instrument bank exceeds memory budget");
  return { samples, sampleRates, bytes, sampleRate: BANK_SAMPLE_RATE };
}

export function nearestKey(note, keys) {
  if (!Number.isFinite(note)) throw new Error("Invalid instrument note");
  return keys.reduce((best, key) => Math.abs(key - note) < Math.abs(best - note) ? key : best);
}
