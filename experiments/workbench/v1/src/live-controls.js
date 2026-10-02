import { readTechnoSet } from './live-code.js';

// Patch the saved tempo and its one setcpm literal, leaving the musical body
// and live slider signal IDs intact. No score evaluation is needed.
export function setTempoChanges(code, bpm) {
  const state = readTechnoSet(code);
  if (!state || !Number.isInteger(bpm) || bpm < 60 || bpm > 180) {
    throw new Error('このセットのBPMは変更できません。コードの接続と60〜180の範囲を確認してください');
  }
  const header = /^\/\/ TECHNO_SET_V[1234] (.+)$/m.exec(code);
  const tempo = /^setcpm\(([0-9.]+)\)$/m.exec(code);
  const metadata = JSON.parse(header[1]);
  metadata.bpm = bpm;
  const from = header.index + header[0].length - header[1].length;
  const tempoFrom = tempo.index + 'setcpm('.length;
  return [
    { from, to: from + header[1].length, insert: JSON.stringify(metadata) },
    { from: tempoFrom, to: tempoFrom + tempo[1].length, insert: String(bpm / 4) },
  ];
}

// These are the score's section controls before master/postgain, envelopes and
// individual hits. They are not an audio meter or a measure of loudness.
export function liveReadouts(state, frame) {
  if (!state?.live || !frame) return new Map();
  const levels = new Map();
  for (const [key, track] of [
    ['KICK','kick'], ['SNARE','snare'], ['HATS','hh'], ['BELL','bell'],
    ['ACID','acid'], ['RESPONSE','response'], ['PERC','percussion'], ['AIR','pad'],
  ]) levels.set(key, state.muted.includes(track) ? 0 : state.values[key] * frame[track]);
  levels.set('CUTOFF', state.values.CUTOFF * (1 + state.values.MOTION * (frame.tone - 1)));
  return levels;
}
