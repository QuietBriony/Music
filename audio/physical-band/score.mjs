// Original, bounded rehearsal scores. No song, stem, model download or sample.
export const PARTS = ["guitar", "bass", "drums"];
export const STYLES = ["rock", "jazz"];

export function createScore(style = "rock") {
  if (!STYLES.includes(style)) throw new Error("Unknown rehearsal style");
  const jazz = style === "jazz";
  const bpm = jazz ? 116 : 112;
  const beatSeconds = 60 / bpm;
  const events = [];
  const note = (part, beat, midi, beats, velocity, technique) => events.push({
    part, time: beat * beatSeconds, note: midi, duration: beats * beatSeconds,
    velocity, technique
  });
  const hit = (beat, drum, velocity) => events.push({
    part: "drums", time: beat * beatSeconds, drum, velocity
  });
  const roots = jazz ? [38, 43, 36, 36, 38, 43, 36, 45] : [40, 40, 36, 38, 40, 40, 36, 38];
  const shells = { 38: [53, 60, 65], 43: [53, 59, 62], 36: [52, 59, 62], 45: [55, 61, 64] };
  roots.forEach((root, bar) => {
    const base = bar * 4;
    if (jazz) {
      // Shell comping, a walking line, swung ride and soft snare response.
      [0.5, 2.5].forEach((offset, index) => shells[root].forEach((midi, string) =>
        note("guitar", base + offset + string * 0.018, midi, 0.72, index ? 0.58 : 0.68, "clean")));
      const next = roots[(bar + 1) % roots.length];
      [root, root + (root === 38 ? 3 : 4), root + 7, next - 1].forEach((midi, step) =>
        note("bass", base + step, midi, 0.88, step === 0 ? 0.85 : 0.69, "finger"));
      [0, 1, 1 + 2 / 3, 2, 3, 3 + 2 / 3].forEach((offset, i) => hit(base + offset, "ride", i % 3 ? 0.44 : 0.64));
      hit(base, "kick", 0.34);
      hit(base + 2, "kick", 0.28);
      hit(base + 1, "snare", 0.32);
      hit(base + 3, "snare", 0.4);
    } else {
      // Root/fifth power chords, palm damping and a stable rock pocket.
      [0, 0.5, 1.5, 2, 2.5, 3.5].forEach((offset, index) => {
        [root + 12, root + 19, root + 24].forEach((midi, string) =>
          note("guitar", base + offset + string * 0.011, midi, index % 3 ? 0.3 : 0.68,
            index % 3 ? 0.66 : 0.9, index % 3 ? "palm" : "open"));
        note("bass", base + offset, root, index % 3 ? 0.34 : 0.7, index % 3 ? 0.72 : 0.94, "pick");
      });
      for (let step = 0; step < 8; step++) hit(base + step / 2, "hat", step % 2 ? 0.43 : 0.64);
      [0, 1.5, 2, ...(bar % 2 ? [3.5] : [])].forEach((offset) => hit(base + offset, "kick", 0.9));
      [1, 3].forEach((offset) => hit(base + offset, "snare", 0.85));
      if (bar === 7) { hit(base + 3.5, "snare", 0.5); hit(base + 3.75, "snare", 0.65); }
    }
  });
  return { version: 1, style, bpm, bars: 8, duration: 32 * beatSeconds + 0.8,
    events: events.sort((a, b) => a.time - b.time) };
}
