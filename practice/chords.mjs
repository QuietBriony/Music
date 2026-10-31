import { SANSHIN_POSITIONS } from './sanshin-core.mjs?v=25';
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
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 6, to: 1 } },
  B: { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 2, from: 5, to: 1 } },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 5, to: 1 } },
  Cm: { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 3, from: 5, to: 1 } },
  Fm: { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, from: 6, to: 1 } },
  Gm: { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 3, from: 6, to: 1 } },
  C7: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], omitsFifth: true },
  D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  B7: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barre: { fret: 1, from: 2, to: 1 } },
  Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  Asus4: { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Esus4: { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0] },
  Cadd9: { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
  Gadd9: { frets: [3, 0, 0, 0, 0, 3], fingers: [2, 0, 0, 0, 0, 3] },
  'G#': { frets:[4,6,6,5,4,4],fingers:[1,3,4,2,1,1],barre:{fret:4,from:6,to:1} },
  'C#m': { frets:[-1,4,6,6,5,4],fingers:[0,1,3,4,2,1],barre:{fret:4,from:5,to:1} },
  'G/B': { frets:[-1,2,0,0,3,3],fingers:[0,1,0,0,3,4] }
};
export const CHORD_GROUPS = [
  { title: 'メジャー', names: ['C','D','E','F','G','A','B'] },
  { title: 'マイナー', names: ['Am','Dm','Em','Bm','Cm','Fm','Gm'] },
  { title: 'セブンス', names: ['C7','D7','E7','G7','A7','B7'] },
  { title: 'maj7・m7', names: ['Cmaj7','Fmaj7','Dm7','Em7','Am7'] },
  { title: 'sus4・add9', names: ['Dsus4','Asus4','Esus4','Cadd9','Gadd9'] },
  { title: '好きな曲から',names:['G#','C#m','G/B'] }
];
export const PROGRESSIONS = [
  { id:'basic', title:'G → C → D', names:['G','C','D','G'] },
  { id:'minor', title:'Am → Dm → E', names:['Am','Dm','E','Am'] },
  { id:'four', title:'C → Am → F → G', names:['C','Am','F','G'] },
  { id:'sevenths', title:'A7 → D7 → E7', names:['A7','D7','A7','E7'] }
];
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
export function mapMelody(source, instrument, { shift = 0, tuning = 0 } = {}) {
  let previous = null;
  return source.map(note => {
    const midi = note.midi + shift;
    let position;
    if (instrument === 'guitar') { position = guitarPosition(midi, previous); previous = position; }
    else {
      const found = SANSHIN_POSITIONS.find(item => item.midi === midi);
      if (!found) throw new Error('この移調では工工四に変換できない音があります。移調を変えてください。');
      position = { ...found, midi: midi + tuning };
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
