import {
  defaultSet as legacyDefault, readTechnoSet as readLegacy, technoSetCode as legacyCode,
  validateSet as validateLegacy, SET_MARKER as LEGACY_MARKER,
  SET_SLIDERS as LEGACY_SLIDERS, SET_TRACKS as LEGACY_TRACKS,
} from './performance-code.js';
import { splitPublishedPattern } from './mix-code.js';
export { SET_PRESETS, SET_SCENES, sceneAtCycle } from './performance-code.js';

export const SET_MARKER = '// TECHNO_SET_V2 ';
export const SET_SLIDERS = [...LEGACY_SLIDERS,
  ['RESPONSE', '303返し音量', .11, 0, .4, .01, '%'],
  ['PERC', '追加打楽器音量', .16, 0, .5, .01, '%'],
  ['SPACE', '303の残響', .12, 0, .35, .01, '%'],
  ['MOTION', '音色の起伏', .45, 0, 1, .01, '%'],
];
export const EXTRA_DRUMS = [
  ['clap', 'CLAP'], ['rim', 'RIM'], ['lt', 'LOW TOM'], ['mt', 'MID TOM'], ['ht', 'HIGH TOM'],
  ['crash', 'CRASH'], ['ride', 'RIDE'],
];
export const SET_TRACKS = [...LEGACY_TRACKS, ...EXTRA_DRUMS.map(([id]) => id), 'response', 'percussion'];
const noteMidi = { g1:31, bb1:34, c2:36, d2:38, eb2:39, f2:41, g2:43, bb2:46, c3:48 };
const pitches = Object.keys(noteMidi);
const masks = {
  intro:['kick','hh'], groove:['kick','snare','hh','oh','clap'],
  acid:SET_TRACKS, break:['hh','bell','acid','response','rim'], peak:SET_TRACKS,
};
const sections = ['intro','groove','acid','acid','break','peak','peak','groove'];
const hitSteps = {clap:[4,12],rim:[11],lt:[14],mt:[15],ht:[13],crash:[0],ride:[2,6,10,14]};

export function defaultSet(preset, layers) {
  const state = legacyDefault(preset, layers);
  state.groove = { seed:731, variation:1, hold:false, kit:[], previousNotes:null };
  for (const [key,,value] of SET_SLIDERS.slice(LEGACY_SLIDERS.length)) state.values[key] = value;
  for (const [id] of EXTRA_DRUMS) state.steps[id] = Array.from({length:16}, (_, i) => hitSteps[id].includes(i));
  if (preset === 'dub-room') Object.assign(state.values, { RESPONSE:.07, SPACE:.22, MOTION:.35 });
  return state;
}

export function upgradeSet(legacy) {
  const fresh=defaultSet(legacy.preset,legacy.layers);
  return {...structuredClone(legacy),groove:fresh.groove,
    values:{...fresh.values,...legacy.values}, steps:{...fresh.steps,...legacy.steps}};
}

function validate(state) {
  validateLegacy({...state, muted:state.muted.filter((id) => LEGACY_TRACKS.includes(id))});
  const g = state.groove;
  if (!g || !Number.isInteger(g.seed) || g.seed < 1 || g.seed > 0xffffffff
    || ![0,1,2].includes(g.variation) || typeof g.hold !== 'boolean' || !Array.isArray(g.kit)
    || g.kit.length > 7 || new Set(g.kit).size !== g.kit.length
    || g.kit.some((id) => !EXTRA_DRUMS.some(([key]) => key === id))
    || state.muted.some((id) => !SET_TRACKS.includes(id))) throw new Error('変奏の形式が合いません');
  if (g.previousNotes !== null && (!Array.isArray(g.previousNotes) || g.previousNotes.length !== 16
    || g.previousNotes.some((note) => note !== '~' && !pitches.includes(note)))) throw new Error('戻すフレーズが不正です');
  for (const [id] of EXTRA_DRUMS) if (!Array.isArray(state.steps[id]) || state.steps[id].length !== 16
    || state.steps[id].some((v) => typeof v !== 'boolean')) throw new Error('追加打楽器の打点が不正です');
  for (const [key,,,min,max] of SET_SLIDERS) if (!Number.isFinite(state.values[key])
    || state.values[key] < min || state.values[key] > max) throw new Error('フェーダーが範囲外です');
  return state;
}

// Repeated, bounded variations of the user's motif. Never add notes to its
// rests or alter its four strong beats. The same seed always renders the same
// eight bars, independent of scheduler lookahead or browser frame timing.
export function groovePlan(state) {
  const base = [...state.notes];
  const variation = [...base];
  const candidates = base.map((note,i) => note !== '~' && i % 4 !== 0 ? i : -1).filter(i => i >= 0);
  if (!state.groove.hold && state.groove.variation && candidates.length) {
    for (let n=0; n<Math.min(state.groove.variation,candidates.length); n++) {
      const slot = candidates[(state.groove.seed + n) % candidates.length];
      const old = pitches.indexOf(base[slot]);
      let target=old + (state.groove.seed % 2 ? 1 : -1);
      if (target < 0 || target >= pitches.length) target=old + (target < 0 ? 1 : -1);
      variation[slot] = pitches[target];
    }
  }
  const notes = Array.from({length:8}, (_,bar) => [...(bar < 4 ? base : variation)]);
  const accents = notes.map(bar => bar.map((note,i) => note !== '~' && (i % 4 === 0 || i === 6) ? 1.16 : .86));
  const slides = notes.map(bar => bar.map((note,i) => {
    const previous = bar[(i+15)%16];
    return (i === 3 || i === 7 || i === 11) && note !== '~' && previous !== '~'
      ? noteMidi[note] - noteMidi[previous] : 0;
  }));
  const response = notes.map(bar => bar.map((note,i) => {
    if (note === '~' || ![3,7,10,14].includes(i)) return '~';
    // Minor-third / fifth answers, kept one octave above the bass.
    const intervals=(i%2?[3,7]:[7,3]).filter(n => [0,2,3,5,7,10].includes((noteMidi[note]+n)%12));
    return String(noteMidi[note] + 12 + intervals[0]);
  }));
  return {notes,accents,slides,response};
}

const multi = bars => '<' + bars.map(bar => '[' + bar.join(' ') + ']').join(' ') + '>';
const seq = (state,track,sound) => state.steps[track].map(hit => hit ? sound : '~').join(' ');

function evolvingCode(input) {
  const state = validate(input);
  const metadata = structuredClone(state); delete metadata.values;
  const [a,b] = state.layers.map(layer => splitPublishedPattern(layer.source));
  const plan = groovePlan(state);
  const gate = track => {
    if (state.muted.includes(track) || (state.muted.includes('percussion') && EXTRA_DRUMS.some(([id]) => id===track))) return '.filterWhen(() => false)';
    if (!state.auto) return masks[state.scene].includes(track) ? '' : '.filterWhen(() => false)';
    return '.filterWhen(t => ' + JSON.stringify(sections.map(s => masks[s].includes(track))) + '[Math.floor(Number(t) / 8) % 8])';
  };
  const sound = (track,name) => 's(' + JSON.stringify(seq(state,track,name)) + ')';
  const drum = (track,name,level) => sound(track,name) + '.bank("RolandTR909").gain(SET_' + level + ')';
  let kick, snare, hh, oh;
  if (state.bank === '909') {
    kick=drum('kick','bd','KICK'); snare=drum('snare','sd','SNARE');
    hh=drum('hh','hh','HATS'); oh=drum('oh','oh','HATS') + '.mul(gain(0.65))';
  } else {
    kick=sound('kick','sine') + '.freq(52).penv(36).pdec(0.035).panchor(0).attack(0.002).decay(SET_BOOM).sustain(0).release(0.02).gain(SET_KICK)';
    snare='stack(' + sound('snare','white') + '.hpf(1400).attack(0.002).decay(0.12).sustain(0).release(0.02), '
      + sound('snare','triangle') + '.freq(180).attack(0.002).decay(0.06).sustain(0).release(0.02)).gain(SET_SNARE)';
    hh=sound('hh','white') + '.hpf(6500).attack(0.001).decay(0.035).sustain(0).release(0.01).gain(SET_HATS)';
    oh=sound('oh','white') + '.hpf(5500).attack(0.001).decay(0.16).sustain(0).release(0.02).gain(SET_HATS).mul(gain(0.55))';
  }
  // One quiet end-of-phrase pickup, only in the final bar. No permanent
  // doubling of all hats in PEAK, and no alteration of the kick skeleton.
  if (state.groove.variation && !state.steps.hh[15]) {
    const fill=state.bank==='909' ? 's("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ hh").bank("RolandTR909")'
      : 's("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ white").hpf(6500).decay(0.025).sustain(0)';
    hh = 'stack(' + hh + ', ' + fill + '.gain(SET_HATS).mul(gain(0.22)).filterWhen(t => Math.floor(Number(t)) % 8 === 7))';
  }
  const voices=[kick+gate('kick'),snare+gate('snare'),hh+gate('hh'),oh+gate('oh'),
    sound('bell','square')+'.freq(540).fm(0.8).fmh(1.48).hpf(500).lpf(2800).attack(0.002).decay(0.055).sustain(0).release(0.02).gain(SET_BELL).mul(gain(0.35))'+gate('bell'),
    'note('+JSON.stringify(multi(plan.notes))+').s("sawtooth").attack(0.003).decay(0.16).sustain(0).release(0.035)'
      +'.penv('+JSON.stringify(multi(plan.slides))+').pattack(0.055).pdecay(0).psustain(1).prelease(0).panchor(1)'
      +'.lpf(SET_CUTOFF.mul(setBreath)).lpq(SET_RESONANCE).lpa(0.003).lpd(SET_DECAY).lps(0).lpenv(6.5).ftype("ladder")'
      +'.distort(SET_DRIVE).postgain(0.4).gain(SET_ACID).mul(gain('+JSON.stringify(multi(plan.accents))+'))'
      +'.delay(SET_SPACE).delaysync(0.1875).delayfeedback(0.24)'+gate('acid'),
    'note('+JSON.stringify(multi(plan.response))+').s("square").hpf(170).lpf(SET_CUTOFF.mul(setBreath).mul(1.5)).lpq(8)'
      +'.attack(0.004).decay(0.11).sustain(0).release(0.03).lpenv(3).lpd(SET_DECAY).gain(SET_RESPONSE).postgain(0.45)'
      +'.delay(SET_SPACE).delaysync(0.125).delayfeedback(0.2)'+gate('response'),
  ];
  for (const track of state.groove.kit) {
    let voice;
    if (track==='clap') voice=sound(track,'white')+'.hpf(900).attack(0.002).decay(0.1).sustain(0).release(0.025)';
    else if (track==='rim') voice=sound(track,'triangle')+'.freq(1650).hpf(600).attack(0.001).decay(0.022).sustain(0).release(0.01)';
    else if (['lt','mt','ht'].includes(track)) voice=sound(track,'sine')+'.freq('+({lt:110,mt:165,ht:220}[track])+').penv(7).pdec(0.08).panchor(0).attack(0.002).decay(0.18).sustain(0).release(0.02).filterWhen(t => Math.floor(Number(t)) % 8 === 7)';
    else if (track==='crash') voice=sound(track,'set_crash')+'.filterWhen(t => Math.floor(Number(t)) % 8 === 0)';
    else voice=sound(track,'set_ride');
    voices.push(voice+'.gain(SET_PERC).mul(gain(0.7))'+gate(track));
  }
  voices.push('xfade(setLayerA.mul(gain(SET_A)), SET_CROSS, setLayerB.mul(gain(SET_B))).mul(gain(0.3))');
  return [SET_MARKER+JSON.stringify(metadata),
    '// 元フレーズ→4小節後の小変奏→8小節で帰還。保存したseedから同じ展開を再現。303は2役の近似。',
    "samples({pad:'/api/sounds/pad',sub:'/api/sounds/sub',drums:'/api/sounds/drums',set_crash:'/modules/acidbros/assets/samples/tr909/cr01.wav',set_ride:'/modules/acidbros/assets/samples/tr909/rd01.wav'});",
    ...SET_SLIDERS.map(([key,title,,min,max,step]) => `const SET_${key} = slider(${state.values[key]}, ${min}, ${max}, ${step}) // ${title}`),
    `setcpm(${state.bpm/4})`,
    'const setBreath = sine.slow(16).range(0.82, 1.22).mul(SET_MOTION).add(SET_MOTION.mul(-1).add(1))',
    `const setLayerA = (() => {\n${a.declarations}\nreturn ${a.expression}\n})()`,
    `const setLayerB = (() => {\n${b.declarations}\nreturn ${b.expression}\n})()`,
    'stack(\n  '+voices.join(',\n  ')+'\n).mul(gain(SET_MASTER)).mul(gain(0.72)).filterValues(v => v.gain > 0)','',
  ].join('\n');
}

export function technoSetCode(state) { return state.groove ? evolvingCode(state) : legacyCode(state); }
export function validateGrooveSet(state) { return validate(state); }
export function isSetCode(code) { return code.includes(SET_MARKER) || code.includes(LEGACY_MARKER); }
export function readTechnoSet(code) {
  if (!code.includes(SET_MARKER)) return readLegacy(code);
  try {
    if (code.length > 100_000) return null;
    const normalized=code.replace(/\r\n?/g,'\n');
    const state=JSON.parse(normalized.split('\n').find(line => line.startsWith(SET_MARKER)).slice(SET_MARKER.length));
    state.values=Object.fromEntries(SET_SLIDERS.map(([key]) => {
      const match=new RegExp('^const SET_'+key+' = slider\\(([0-9.]+),','m').exec(normalized);
      return [key,match?Number(match[1]):NaN];
    }));
    validate(state);
    return evolvingCode(state).trim()===normalized.trim()?state:null;
  } catch { return null; }
}
