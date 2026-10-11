// Button-time composition, not another audio clock. The resulting notes,
// hits and instruments are ordinary saved score data. No added polyphony.
import {INSTRUMENT_ROLES, INSTRUMENT_VOICES, instrumentProfile, validateInstruments} from './instrument-voices.js';
const pitches = ['g1','bb1','c2','d2','eb2','f2','g2','bb2','c3'];
const tracks = ['hh','oh','bell','rim','lt','mt','ht','ride'];
const toneRanges = {CUTOFF:[120,4800],RESONANCE:[1,26],DRIVE:[0,5],DECAY:[.03,.45],SPACE:[0,.35],MOTION:[0,1]};
const masks = [
  [0,2,3,6,7,8,11,14], [0,3,4,6,7,10,11,12,15],
  [0,1,4,7,8,9,12,15], [0,2,3,4,6,7,8,11,12,15], [0,3,6,7,8,11,14],
];
const tones = [
  {CUTOFF:430,RESONANCE:13,DRIVE:1.4,DECAY:.13,SPACE:.1,MOTION:.45},
  {CUTOFF:700,RESONANCE:17,DRIVE:2.5,DECAY:.18,SPACE:.14,MOTION:.6},
  {CUTOFF:290,RESONANCE:10,DRIVE:.8,DECAY:.25,SPACE:.22,MOTION:.35},
  {CUTOFF:980,RESONANCE:19,DRIVE:3.1,DECAY:.1,SPACE:.08,MOTION:.55},
];
const snapshot = state => ({notes:[...state.notes],steps:Object.fromEntries(tracks.map(key=>[key,[...state.steps[key]]])),
  tone:Object.fromEntries(Object.keys(toneRanges).map(key=>[key,state.values[key]])),
  bank:state.bank,instruments:state.instruments ? structuredClone(state.instruments) : null});
const validNotes = notes => Array.isArray(notes) && notes.length === 16 && notes.every(n=>n==='~' || pitches.includes(n));
const uint = n => Number.isInteger(n) && n >= 1 && n <= 0xffffffff;

export function validateDice(dice) {
  if (!dice || dice.version !== 1 || !uint(dice.seed) || !Number.isInteger(dice.turn) || dice.turn < 0 || dice.turn > 0xffffffff
    || !validNotes(dice.anchor?.notes) || typeof dice.locks?.drums !== 'boolean' || typeof dice.locks?.tone !== 'boolean') {
    throw new Error('ランダムの保存設定が不正です');
  }
  for (const track of tracks) if (!Array.isArray(dice.anchor.steps?.[track]) || dice.anchor.steps[track].length !== 16
    || dice.anchor.steps[track].some(v=>typeof v !== 'boolean')) throw new Error('ランダムの戻す打点が不正です');
  for (const [key,[min,max]] of Object.entries(toneRanges)) if (!Number.isFinite(dice.anchor.tone?.[key])
    || dice.anchor.tone[key] < min || dice.anchor.tone[key] > max) throw new Error('ランダムの戻す音色が不正です');
  if (dice.locks.instruments !== undefined && typeof dice.locks.instruments !== 'boolean') throw new Error('楽器固定の設定が不正です');
  if (dice.anchor.bank !== undefined && !['909','808'].includes(dice.anchor.bank)) throw new Error('戻すドラム音源が不正です');
  if (dice.anchor.instruments !== undefined && dice.anchor.instruments !== null) validateInstruments(dice.anchor.instruments);
  return dice;
}

function prepare(state) {
  if (!state?.live || !state.groove) throw new Error('LIVEセットを開いてください');
  if (!state.dice) state.dice = {version:1,seed:state.groove.seed,turn:0,locks:{drums:false,tone:false,instruments:false},anchor:snapshot(state)};
  const dice=validateDice(state.dice);
  // Extend an old checkpoint only at an explicit button action, never on read.
  if (dice.anchor.bank === undefined) dice.anchor.bank=state.bank;
  if (dice.anchor.instruments === undefined) dice.anchor.instruments=state.instruments ? structuredClone(state.instruments) : null;
  return dice;
}

function generator(seed) {
  let value = seed >>> 0;
  return max => { value = (Math.imul(value,1664525)+1013904223) >>> 0; return Math.floor(value / 0x100000000 * max); };
}
const hits = indices => Array.from({length:16},(_,i)=>indices.includes(i));
const chooseOther = (options,current,pick) => {
  const choices = options.filter(value=>value!==current);
  return choices[pick(choices.length)];
};

export function rollDice(input, kind = 'phrase', locks) {
  if (!['phrase','nudge','instruments'].includes(kind)) throw new Error('ランダムの操作が不正です');
  const state = structuredClone(input);
  const dice = prepare(state);
  if (locks) dice.locks = {...dice.locks,...locks};
  validateDice(dice);
  dice.turn = (dice.turn + 1) >>> 0;
  const pick = generator((dice.seed ^ Math.imul(dice.turn,2654435761)) >>> 0);
  // A repeated two-beat cell, sparse pickups, and a shared C-minor palette.
  // The existing 303 answer follows these notes with minor thirds/fifths.
  if (kind !== 'instruments' && !state.groove.hold && state.live.mode !== 'ambient') {
    if (kind === 'phrase') {
      const mask = masks[pick(masks.length)];
      const root = ['g1','c2','bb1'].includes(dice.anchor.notes[0]) ? dice.anchor.notes[0] : 'c2';
      const cell = [root,root,chooseOther(['bb1','eb2','g2'],root,pick),chooseOther(['c2','d2','f2'],root,pick)];
      state.notes = Array.from({length:16},(_,i)=>mask.includes(i) ? cell[i%4] : '~');
      // A short answer at the end of the bar, rather than filling every rest.
      state.notes[mask.at(-1)] = chooseOther(['c2','eb2','g2'],state.notes[mask.at(-1)],pick);
      if (state.notes.join() === input.notes.join()) state.notes[mask.at(-1)] = root;
    } else {
      const slots = state.notes.map((n,i)=>n!=='~' && i%4!==0 ? i : -1).filter(i=>i>=0);
      const count = Math.min(2,slots.length);
      for (let n=0;n<count;n++) {
        const slot = slots.splice(pick(slots.length),1)[0];
        const index = pitches.indexOf(state.notes[slot]);
        const neighbors = pitches.filter((_,i)=>Math.abs(i-index)===1);
        state.notes[slot] = neighbors[pick(neighbors.length)];
      }
    }
  }
  if (kind !== 'instruments' && !dice.locks.drums && state.live.mode !== 'ambient') {
    if (kind === 'phrase') {
      // Keep kick/backbeat and kit membership; decorate their gaps.
      state.steps.hh = hits([2,6,10,14,...[[3,11],[7,15],[1,9],[]][pick(4)]]);
      state.steps.oh = hits([[6,14],[14],[10],[2,10]][pick(4)]);
      state.steps.bell = hits([[3,10],[7,14],[6,11],[3]][pick(4)]);
      state.steps.rim = hits([[3],[7],[11],[15]][pick(4)]);
      state.steps.lt = hits([14]); state.steps.mt = hits(pick(2) ? [15] : []); state.steps.ht = hits([13]);
      state.steps.ride = hits([2,6,10,14]);
    } else {
      const extras = [1,3,5,7,9,11,13,15];
      const occupied = extras.filter(i=>state.steps.hh[i]);
      const empty = extras.filter(i=>!state.steps.hh[i]);
      if (occupied.length && empty.length) {
        state.steps.hh[occupied[pick(occupied.length)]] = false;
        state.steps.hh[empty[pick(empty.length)]] = true;
      }
      state.steps.oh = hits([[6,14],[14],[10],[2,10]][pick(4)]);
    }
  }
  if (kind !== 'instruments' && !dice.locks.tone) {
    const target = {...tones[pick(tones.length)]};
    if (state.live.mode !== 'techno') Object.assign(target,{CUTOFF:240+pick(25)*10,RESONANCE:6+pick(5),DRIVE:.3+pick(6)/10,DECAY:.26,SPACE:.24,MOTION:.35});
    const basis = kind === 'phrase' ? dice.anchor.tone : state.values;
    for (const [key,value] of Object.entries(target)) {
      const mixed = kind === 'phrase' ? value : basis[key]+(value-basis[key])*.2;
      const quantum = {CUTOFF:10,RESONANCE:1,DRIVE:.1,DECAY:.01,SPACE:.01,MOTION:.01}[key];
      state.values[key] = Number((Math.round(mixed/quantum)*quantum).toFixed(2));
    }
  }
  if (!dice.locks.instruments) {
    const profile={...instrumentProfile(state)};
    const roles=state.live.mode==='ambient' ? ['pad'] : Object.keys(INSTRUMENT_ROLES);
    const selected=kind==='nudge' ? [roles[pick(roles.length)]] : roles;
    for (const role of selected) profile[role]=chooseOther(INSTRUMENT_VOICES[role].map(voice=>voice.id),profile[role],pick);
    state.instruments=profile;
    if (kind !== 'nudge' && !dice.locks.drums && state.live.mode !== 'ambient') state.bank=state.bank==='909' ? '808' : '909';
  }
  // BPM, levels, MUTE, A/B, LIVE chapter settings, axis variation and kit
  // are untouched. Ambient changes only pad family and soft timbre.
  return state;
}

export function keepDice(input) {
  const state = structuredClone(input);
  const dice = prepare(state);
  dice.anchor = snapshot(state);
  return state;
}

export function restoreDice(input) {
  const state = structuredClone(input);
  if (!state.dice) return state;
  const {anchor} = validateDice(state.dice);
  state.notes = [...anchor.notes];
  for (const key of tracks) state.steps[key] = [...anchor.steps[key]];
  Object.assign(state.values,anchor.tone);
  if (anchor.bank !== undefined) state.bank=anchor.bank;
  if (anchor.instruments === null) delete state.instruments;
  else if (anchor.instruments !== undefined) state.instruments=structuredClone(anchor.instruments);
  return state;
}
