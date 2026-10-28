// String order in shapes: sixth (low E) to first (high e). -1 means muted.
export const GUITAR_OPEN = [40, 45, 50, 55, 59, 64];
export const CHORDS = {
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Fmaj7: { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] }
};
export function chordNotes(name) {
  const shape = CHORDS[name];
  if (!shape) return [];
  return shape.frets.flatMap((fret, i) => fret < 0 ? [] : [{ string: 6 - i, fret, midi: GUITAR_OPEN[i] + fret, finger: shape.fingers[i] }]);
}
export function shapeMatches(actual, expected) { return actual.length === 6 && actual.every((fret, i) => fret === CHORDS[expected]?.frets[i]); }
export function guitarPosition(midi, previous = null) {
  const choices = GUITAR_OPEN.flatMap((open, i) => midi >= open && midi - open <= 12 ? [{ midi, string: 6 - i, fret: midi - open }] : []);
  if (!choices.length) throw new Error('ギターの音域を超えています。MIDIの移調を変えてください。');
  return choices.sort((a, b) => a.fret + (previous ? Math.abs(a.string - previous.string) * 0.25 : 0) - b.fret - (previous ? Math.abs(b.string - previous.string) * 0.25 : 0))[0];
}
const SANSHIN = [
  [48, '合', 3, 0, '男弦・開放'], [50, '乙', 3, 2, '男弦・人差し指'], [52, '老', 3, 4, '男弦・小指'],
  [53, '四', 2, 0, '中弦・開放'], [55, '上', 2, 2, '中弦・人差し指'], [57, '中', 2, 4, '中弦・小指'],
  [58, '尺♭', 2, 5, '中弦・低い尺'], [59, '尺', 2, 6, '中弦・高い尺'],
  [60, '工', 1, 0, '女弦・開放'], [62, '五', 1, 2, '女弦・人差し指'], [64, '六', 1, 4, '女弦・小指'],
  [65, '七', 1, 5, '女弦・七'], [67, '八', 1, 7, '女弦・八'], [69, '九', 1, 9, '女弦・九']
];
export function mapMelody(source, instrument, { shift = 0, tuning = 0 } = {}) {
  let previous = null;
  return source.map(note => {
    const midi = note.midi + shift;
    let position;
    if (instrument === 'guitar') { position = guitarPosition(midi, previous); previous = position; }
    else {
      const found = SANSHIN.find(item => item[0] === midi);
      if (!found) throw new Error('この移調では工工四に変換できない音があります。移調を変えてください。');
      const [, symbol, string, fret, hint] = found;
      position = { midi: midi + tuning, symbol, string, fret, position: hint };
    }
    return { ...note, ...position };
  });
}
export function bestShift(source, instrument) {
  for (const shift of [0, -12, 12, -24, 24, -2, 2, -5, 5, -7, 7, -1, 1, -3, 3, -4, 4, -14, -10]) {
    try { mapMelody(source, instrument, { shift }); return shift; } catch { /* Try another practical key/octave. */ }
  }
  throw new Error('この旋律を楽器の音域に収められません。短い別トラックを選んでください。');
}
