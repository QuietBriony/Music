// Original, dependency-free single-note exercises and detector for Music Stack.
import { sanshinPosition } from './sanshin-core.mjs?v=16';
export const frequencyFor = (midi) => 440 * 2 ** ((midi - 69) / 12);
export const centsFrom = (frequency, midi) => 1200 * Math.log2(frequency / frequencyFor(midi));
export function noteName(midi) {
  return `${['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
const guitar = (string, fret) => ({ string, fret, midi: [0, 64, 59, 55, 50, 45, 40][string] + fret });
export const LESSONS = {
  guitar: [
    { id: 'open', title: '01 開放弦をひとつずつ', detail: '左手は押さえず、6弦から1弦へ。ほかの弦は軽く止めます。', notes: [6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 6].map(s => guitar(s, 0)) },
    { id: 'melody', title: '02 1弦で短いメロディー', detail: '1弦の0・1・3フレット。1は人差し指、3は薬指を目安に。', notes: [0, 1, 3, 1, 0, 0, 3, 0].map(f => guitar(1, f)) },
    { id: 'cross', title: '03 2本の弦を行き来する', detail: '2弦から1弦へ。音が重ならないように、一音ずつ弾きます。', notes: [[2, 0], [2, 1], [2, 3], [1, 0], [2, 3], [2, 1], [2, 0], [1, 0]].map(([s, f]) => guitar(s, f)) }
  ],
  sanshin: [
    { id: 'open', title: '01 合・四・工の開放弦', detail: '本調子の3本をひとつずつ。左手は押さえずに弾きます。', symbols: '合四工四合合四工' },
    { id: 'positions', title: '02 勘所をゆっくり往復', detail: '右の列から下へ読みます。音を聴きながら、勘所をひとつずつ確かめます。', symbols: '合乙老四上中工中上四老乙合' },
    { id: 'phrase', title: '03 短いフレーズを弾く', detail: '同じ音の続くところも、一音ずつ弾き直しましょう。', symbols: '工五六五工工上工' }
  ].map(lesson => ({ ...lesson, notes: [...lesson.symbols].map(symbol => ({ ...sanshinPosition(symbol) })) }))
};
export function lessonNotes(instrument, id, transpose = 0) {
  const lessons = LESSONS[instrument] || LESSONS.guitar;
  const lesson = lessons.find(item => item.id === id) || lessons[0];
  return lesson.notes.map(note => ({ ...note, midi: note.midi + (instrument === 'sanshin' ? transpose : 0) }));
}

// YIN-style cumulative normalized difference. Downsample to <=16 kHz, then
// scan a bounded 65–1200 Hz range. No recording or external inference service.
export function detectPitch(input, sampleRate, gate = 0.006, { threshold = 0.16 } = {}) {
  let power = 0;
  for (const sample of input) power += sample * sample;
  const rms = Math.sqrt(power / input.length);
  const empty = { frequency: null, clarity: 0, rms: Number.isFinite(rms) ? rms : 0 };
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || input.length < 1024 || !Number.isFinite(rms) || rms < gate) return empty;
  const stride = Math.max(1, Math.floor(sampleRate / 16000));
  const rate = sampleRate / stride;
  const size = Math.floor(input.length / stride);
  const values = new Float32Array(size);
  for (let i = 0; i < size; i++) values[i] = input[i * stride];
  const min = Math.floor(rate / 1200);
  const max = Math.min(Math.ceil(rate / 65), Math.floor(size / 2) - 1);
  const windowSize = size - max;
  const difference = new Float32Array(max + 1);
  let cumulative = 0;
  for (let lag = 1; lag <= max; lag++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) { const d = values[j] - values[j + lag]; sum += d * d; }
    cumulative += sum;
    difference[lag] = cumulative > 0 ? sum * lag / cumulative : 1;
  }
  for (let lag = min; lag < max - 1; lag++) {
    if (difference[lag] >= threshold) continue;
    while (lag + 1 < max && difference[lag + 1] < difference[lag]) lag++;
    const left = difference[lag - 1], center = difference[lag], right = difference[lag + 1];
    const denominator = 2 * (2 * center - right - left);
    const offset = denominator ? Math.max(-1, Math.min(1, (right - left) / denominator)) : 0;
    return { frequency: rate / (lag + offset), clarity: 1 - center, rms };
  }
  return empty;
}

export class NoteFollower {
  constructor(notes, { start = 0, end = notes.length, tolerance = 45, hold = 130, gate = 0.006 } = {}) {
    this.notes = notes; this.start = start; this.end = end;
    this.tolerance = tolerance; this.hold = hold; this.gate = gate; this.reset();
  }
  reset(index = this.start) {
    this.index = index; this.done = false; this.lastMidi = null;
    this.acceptedAt = -Infinity; this.armed = true; this.candidateAt = null;
    this.quietAt = null; this.lastRms = 0;
  }
  accept(now) {
    this.lastMidi = this.notes[this.index].midi; this.acceptedAt = now;
    this.index++; this.done = this.index >= this.end; this.armed = false; this.candidateAt = null;
    return { matched: true, done: this.done, index: this.index };
  }
  feed({ frequency, clarity = 1, rms = 0 }, now) {
    if (this.done) return { status: 'done', matched: false };
    if (rms < this.gate) {
      this.quietAt ??= now;
      if (now - this.quietAt >= 65) this.armed = true;
    } else this.quietAt = null;
    if (now - this.acceptedAt > 220 && rms > Math.max(this.gate * 2, this.lastRms * 1.7)) this.armed = true;
    this.lastRms = rms;
    if (!frequency || clarity < 0.84 || rms < this.gate) { this.candidateAt = null; return { status: 'listening', matched: false }; }
    const target = this.notes[this.index].midi;
    const cents = centsFrom(frequency, target);
    if (Math.abs(cents) > this.tolerance) {
      this.candidateAt = null;
      if (this.lastMidi !== null && Math.abs(centsFrom(frequency, this.lastMidi)) > 80) this.armed = true;
      return { status: cents > 0 ? 'high' : 'low', cents, matched: false };
    }
    if (this.lastMidi === target && !this.armed) { this.candidateAt = null; return { status: 'pluck', cents, matched: false }; }
    if (now - this.acceptedAt < 220) return { status: 'hold', cents, matched: false };
    this.candidateAt ??= now;
    if (now - this.candidateAt >= this.hold) return { ...this.accept(now), status: 'matched', cents };
    return { status: 'hold', cents, matched: false };
  }
}
