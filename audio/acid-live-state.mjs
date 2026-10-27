// Human Fly's optional live arrangement. Motifs use root/fifth/octave first;
// the extra suspended tones avoid guessing major/minor from a root-only score.
export const PARTS = ['bass', 'reply'];
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const INTERVALS = [0, 2, 5, 7, 12];
const clone = value => JSON.parse(JSON.stringify(value));
const step = (n, accent = false, slide = false) => ({ n, active: n !== null, accent, slide });
export function defaults() {
  return { version: 1, auto: false, parts: {
    bass: { locked: false, volume: 66, cutoff: 24, reso: 7.2, env: 42, decay: 30, delay: 12,
      steps: [step(0,true),step(null),step(null),step(0,false,true),step(0),step(null),step(3),step(null),step(0,true),step(null),step(4,false,true),step(3),step(0),step(null),step(3),step(null)] },
    reply: { locked: false, volume: 30, cutoff: 32, reso: 8.2, env: 53, decay: 24, delay: 28,
      steps: [step(null),step(null),step(3),step(null),step(null),step(0,false,true),step(4),step(null),step(null),step(3,true),step(null),step(4,false,true),step(3),step(null),step(0),step(null)] }
  }};
}
export function validate(value) {
  if (value?.version !== 1 || typeof value.auto !== 'boolean') throw Error('Acidの保存形式が違います。');
  const result = {version:1, auto:value.auto, parts:{}};
  for (const part of PARTS) {
    const p = value.parts?.[part];
    if (!p || typeof p.locked !== 'boolean' || !Array.isArray(p.steps) || p.steps.length !== 16) throw Error('303のフレーズは16ステップです。');
    const clean = {locked:p.locked};
    for (const key of ['volume','cutoff','reso','env','decay','delay']) {
      if (!Number.isFinite(p[key]) || p[key] < 0 || p[key] > (key === 'reso' ? 12 : 100)) throw Error('303のフェーダー値が範囲外です。');
      clean[key] = p[key];
    }
    clean.steps = p.steps.map(s => {
      if (!s || !(s.n === null || Number.isInteger(s.n) && s.n >= 0 && s.n < INTERVALS.length) ||
          typeof s.active !== 'boolean' || typeof s.accent !== 'boolean' || typeof s.slide !== 'boolean' || s.active !== (s.n !== null)) throw Error('303の音符が不正です。');
      return {n:s.n,active:s.active,accent:s.accent,slide:s.slide};
    });
    result.parts[part] = clean;
  }
  return result;
}
export function dice(value, part, random = Math.random) {
  const next = validate(value), p = next.parts[part];
  if (!p || p.locked) return next;
  const choose = values => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  const hits = part === 'bass' ? choose([[0,3,4,6,8,11,12,14],[0,2,4,7,8,10,12,15],[0,3,4,8,9,12,14,15]])
    : choose([[2,5,6,9,11,14],[1,3,6,10,13,15],[2,6,7,9,12,14]]);
  p.steps = Array.from({length:16},(_,i) => hits.includes(i)
    ? step(part === 'bass' && i % 4 === 0 ? 0 : choose(part === 'bass' ? [0,0,3,4] : [0,1,2,3,4]), i % 4 === 0 || random() < .22, i % 4 !== 0 && random() < .28)
    : step(null));
  return next;
}
export function stepsForBar(value, part, bar) {
  const p = value.parts[part], steps = clone(p.steps);
  // An eight-bar question/answer: change one accent or slide, then return to
  // the saved motif. Never add notes, touch levels, or vary a locked phrase.
  if (value.auto && !p.locked && Math.floor(bar / 8) % 2 === 1 && PARTS[Math.floor(bar / 16) % 2] === part) {
    const active = steps.flatMap((s,i) => s.active ? [i] : []);
    if (active.length) {
      const i = active[(Math.floor(bar / 8) * 3) % active.length];
      steps[i].accent = !steps[i].accent;
      if (steps[(i+1)%16].active) steps[i].slide = !steps[i].slide;
    }
  }
  return steps;
}
export function chordAt(song, bar) {
  let cursor = 0, chord = 'G';
  for (const section of song?.structure || []) {
    if (bar < cursor + section.bars) {
      let at = 0;
      for (const [name, count] of song.chord_progression?.[section.section] || []) {
        chord = name;
        if (bar - cursor < at + count) return chord;
        at += count;
      }
      return chord;
    }
    cursor += section.bars;
  }
  return chord;
}
export function voiceSteps(steps, part, chord) {
  const m = /^([A-G])([#b]?)/.exec(chord || 'G');
  const base = NOTES.indexOf(m?.[1] || 'G') + (m?.[2] === '#' ? 1 : m?.[2] === 'b' ? -1 : 0) + (part === 'bass' ? 24 : 36);
  return steps.map(s => {
    const pitch = base + (s.active ? INTERVALS[s.n] : 0);
    return {active:s.active,accent:s.accent,slide:s.slide,note:NOTES[(pitch%12+12)%12],octave:Math.floor(pitch/12)};
  });
}
export function voiceParams(part, rate = 1) {
  return {tune:1200*Math.log2(rate),cutoff:part.cutoff/100,reso:part.reso,env:part.env/100,
    decay:part.decay,vol:.42,wave:'sawtooth',delayWet:part.delay,delayTime:18.75,delayFeedback:30};
}
