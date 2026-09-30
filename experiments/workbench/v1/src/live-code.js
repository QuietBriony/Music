import {
  defaultSet as grooveDefault, readTechnoSet as readGroove, technoSetCode as grooveCode,
  upgradeSet as upgradeGroove, validateGrooveSet, isSetCode as isGrooveCode,
  SET_PRESETS as GROOVE_PRESETS, SET_SLIDERS as GROOVE_SLIDERS, SET_TRACKS as GROOVE_TRACKS,
} from './groove-code.js';
import { splitPublishedPattern } from './mix-code.js';
import { liveFrame, liveMotif } from './live-plan.js';
export { SET_SCENES, sceneAtCycle, EXTRA_DRUMS, groovePlan } from './groove-code.js';
export { liveFrame, liveMotif } from './live-plan.js';

export const SET_MARKER = '// TECHNO_SET_V3 ';
export const SET_PRESETS = [...GROOVE_PRESETS, {id:'ambient-drift',title:'Ambient Drift',bpm:76,bank:'909'}];
export const SET_SLIDERS = [...GROOVE_SLIDERS, ['AIR','パッド音量',.12,0,.65,.01,'%']];
export const SET_TRACKS = [...GROOVE_TRACKS, 'pad'];
export const LIVE_MODES = [['techno','テクノ · 走る'],['dub','ダブ · ゆったり'],['ambient','アンビエント · 漂う']];

export function upgradeSet(input) {
  const state = input.groove ? structuredClone(input) : upgradeGroove(input);
  if (!state.live) {
    state.live = {mode:state.preset === 'dub-room' ? 'dub' : 'techno', pace:state.preset === 'dub-room' ? 16 : 8, energy:.65, lock:null};
    state.values.AIR = .12;
  }
  return state;
}

export function defaultSet(preset = 'acid-drive', layers = []) {
  const ambient = preset === 'ambient-drift';
  const state = upgradeSet(grooveDefault(ambient ? 'dub-room' : preset, layers));
  state.auto = true; // Opening a score never starts audio. The first Play unlocks it.
  state.groove.kit = ambient ? [] : ['clap','lt','ht','crash','ride'];
  state.values.PERC = .12;
  if (ambient) {
    state.preset = preset;
    state.bpm = 76;
    state.live = {mode:'ambient',pace:32,energy:.35,lock:null};
    Object.assign(state.values,{AIR:.44,ACID:.12,RESPONSE:.05,CUTOFF:320,RESONANCE:4,DRIVE:.25,SPACE:.25});
  }
  return state;
}

function validate(state) {
  if (!state || !SET_PRESETS.some(p => p.id === state.preset) || !Array.isArray(state.muted)
    || state.muted.some(id => !SET_TRACKS.includes(id))) throw new Error('LIVEセットの形式が合いません');
  validateGrooveSet({...state,preset:state.preset === 'ambient-drift' ? 'dub-room' : state.preset,muted:state.muted.filter(id => id !== 'pad')});
  const config = state.live;
  if (!config || !LIVE_MODES.some(([id]) => id === config.mode) || ![8,16,32].includes(config.pace)
    || ![.35,.65,.9].includes(config.energy) || !(config.lock === null || ['intro','groove','acid','break','peak'].includes(config.lock))
    || !Number.isFinite(state.values.AIR) || state.values.AIR < 0 || state.values.AIR > .65) throw new Error('LIVE展開の設定が不正です');
  return state;
}

function liveCode(input) {
  const state = validate(input);
  const metadata = structuredClone(state); delete metadata.values;
  const [a,b] = state.layers.map(layer => splitPublishedPattern(layer.source));
  const seq = (track,sound) => 's(' + JSON.stringify(state.steps[track].map(hit => hit ? sound : '~').join(' ')) + ')';
  const gate = track => {
    if (state.muted.includes(track) || (state.muted.includes('percussion') && ['clap','rim','lt','mt','ht','crash','ride'].includes(track))) return '.filterWhen(() => false)';
    const level = ['clap','rim','lt','mt','ht','crash'].includes(track) ? 'percussion' : track;
    return '.mul(gain(signal(t => setFrame(t).' + level + '))).filterWhen(t => setFrame(t).' + level + ' > 0)';
  };
  let kick,snare,hh,oh;
  if (state.bank === '909') {
    kick=seq('kick','bd')+'.bank("RolandTR909").gain(SET_KICK)';
    snare=seq('snare','sd')+'.bank("RolandTR909").gain(SET_SNARE)';
    hh=seq('hh','hh')+'.bank("RolandTR909").gain(SET_HATS)';
    oh=seq('oh','oh')+'.bank("RolandTR909").gain(SET_HATS).mul(gain(0.6))';
  } else {
    kick=seq('kick','sine')+'.freq(52).penv(36).pdec(0.035).panchor(0).attack(0.002).decay(SET_BOOM).sustain(0).release(0.02).gain(SET_KICK)';
    snare='stack('+seq('snare','white')+'.hpf(1400).attack(0.002).decay(0.12).sustain(0).release(0.02), '+seq('snare','triangle')+'.freq(180).attack(0.002).decay(0.06).sustain(0).release(0.02)).gain(SET_SNARE)';
    hh=seq('hh','white')+'.hpf(6500).attack(0.001).decay(0.035).sustain(0).release(0.01).gain(SET_HATS)';
    oh=seq('oh','white')+'.hpf(5500).attack(0.001).decay(0.16).sustain(0).release(0.02).gain(SET_HATS).mul(gain(0.55))';
  }
  if (state.groove.variation && !state.steps.hh[15]) {
    const fill=state.bank==='909' ? 's("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ hh").bank("RolandTR909")'
      : 's("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ white").hpf(6500).decay(0.025).sustain(0)';
    hh='stack('+hh+', '+fill+'.gain(SET_HATS).mul(gain(0.2)).filterWhen(t => setFrame(t).fill))';
  }
  const response = state.notes.map((n,i) => n !== '~' && [3,7,10,14].includes(i) ? 'c4' : '~').join(' ');
  const noteMap = field => '.withHap(h => h.withValue(v => ({...v,note:setMotif(h.whole.begin).'+field+'})))';
  const voices = [kick+gate('kick'),snare+gate('snare'),hh+gate('hh'),oh+gate('oh'),
    seq('bell','square')+'.freq(540).fm(0.8).fmh(1.48).hpf(500).lpf(2800).attack(0.002).decay(0.055).sustain(0).release(0.02).gain(SET_BELL).mul(gain(0.3))'+gate('bell'),
    'note('+JSON.stringify(state.notes.join(' '))+')'+noteMap('note')+'.s("sawtooth").attack(0.003).decay(0.16).sustain(0).release(0.035)'
      +'.penv(signal(t => setMotif(t).slide)).pattack(0.055).pdecay(0).psustain(1).prelease(0).panchor(1)'
      +'.lpf(SET_CUTOFF.mul(setBreath)).lpq(SET_RESONANCE).lpa(0.003).lpd(SET_DECAY).lps(0).lpenv(6.5).ftype("ladder")'
      +'.distort(SET_DRIVE).postgain(0.38).gain(SET_ACID).mul(gain(signal(t => setMotif(t).accent)))'
      +'.delay(SET_SPACE).delaysync(0.1875).delayfeedback(0.24)'+gate('acid'),
    'note('+JSON.stringify(response)+')'+noteMap('response')+'.s("square").hpf(170).lpf(SET_CUTOFF.mul(setBreath).mul(1.5)).lpq(8)'
      +'.attack(0.004).decay(0.11).sustain(0).release(0.03).lpenv(3).lpd(SET_DECAY).gain(SET_RESPONSE).postgain(0.4)'
      +'.delay(SET_SPACE).delaysync(0.125).delayfeedback(0.2)'+gate('response'),
    'note("<[c3,eb3,g3] [eb3,g3,bb3] [bb2,d3,f3] [g2,bb2,d3]>").slow(4).s("triangle")'
      +'.hpf(90).lpf(SET_CUTOFF.mul(setBreath).mul(1.2).add(160)).attack(1.2).decay(0.8).sustain(0.58).release(1.6)'
      +'.gain(SET_AIR).postgain(0.24).delay(SET_SPACE.mul(0.25)).delaysync(0.25).delayfeedback(0.2)'+gate('pad'),
  ];
  for (const track of state.groove.kit) {
    let voice;
    if (track==='clap') voice=seq(track,'white')+'.hpf(900).attack(0.002).decay(0.1).sustain(0).release(0.025)';
    else if (track==='rim') voice=seq(track,'triangle')+'.freq(1650).hpf(600).attack(0.001).decay(0.022).sustain(0).release(0.01)';
    else if (['lt','mt','ht'].includes(track)) voice=seq(track,'sine')+'.freq('+({lt:110,mt:165,ht:220}[track])+').penv(7).pdec(0.08).panchor(0).attack(0.002).decay(0.18).sustain(0).release(0.02).filterWhen(t => setFrame(t).fill)';
    else if (track==='crash') voice=seq(track,'set_crash')+'.filterWhen(t => setFrame(t).crash)';
    else voice=seq(track,'set_ride');
    voices.push(voice+'.gain(SET_PERC).mul(gain(0.65))'+gate(track));
  }
  voices.push('xfade(setLayerA.mul(gain(SET_A)), SET_CROSS, setLayerB.mul(gain(SET_B))).mul(gain(0.3))');
  return [SET_MARKER+JSON.stringify(metadata),
    '// LIVE：軸へ戻りながら章ごとの変奏を続ける。音と画面は同じStrudel時計。旧保存版は明示更新だけ。',
    "samples({pad:'/api/sounds/pad',sub:'/api/sounds/sub',drums:'/api/sounds/drums',set_crash:'/modules/acidbros/assets/samples/tr909/cr01.wav',set_ride:'/modules/acidbros/assets/samples/tr909/rd01.wav'});",
    ...SET_SLIDERS.map(([key,title,,min,max,step]) => `const SET_${key} = slider(${state.values[key]}, ${min}, ${max}, ${step}) // ${title}`),
    `setcpm(${state.bpm/4})`,liveFrame.toString(),liveMotif.toString(),
    // Double-quoted literals become mini patterns in this REPL. These bounded
    // settings and pitches are ordinary JS, so emit single-quoted enum values.
    `const setLive = {mode:'${state.live.mode}',pace:${state.live.pace},energy:${state.live.energy},lock:${state.live.lock ? "'"+state.live.lock+"'" : 'null'}}`,
    `const setGroove = {seed:${state.groove.seed},variation:${state.groove.variation},hold:${state.groove.hold}}`,
    `const setFrame = t => liveFrame(setLive, setGroove.seed, Number(t), ${state.auto}, '${state.scene}')`,
    `const setMotif = t => liveMotif([${state.notes.map(n=>"'"+n+"'").join(',')}], setGroove, setFrame(t).chapter, Number(t))`,
    'const setBreath = signal(t => setFrame(t).tone).mul(SET_MOTION).add(SET_MOTION.mul(-1).add(1))',
    `const setLayerA = (() => {\n${a.declarations}\nreturn ${a.expression}\n})()`,
    `const setLayerB = (() => {\n${b.declarations}\nreturn ${b.expression}\n})()`,
    'stack(\n  '+voices.join(',\n  ')+'\n).mul(gain(SET_MASTER)).mul(gain(0.66)).filterValues(v => v.gain > 0)','',
  ].join('\n');
}

export function technoSetCode(state) { return state.live ? liveCode(state) : grooveCode(state); }
export function isSetCode(code) { return code.includes(SET_MARKER) || isGrooveCode(code); }
export function readTechnoSet(code) {
  if (!code.includes(SET_MARKER)) return readGroove(code);
  try {
    if (code.length > 100_000) return null;
    const text=code.replace(/\r\n?/g,'\n');
    const state=JSON.parse(text.split('\n').find(line => line.startsWith(SET_MARKER)).slice(SET_MARKER.length));
    state.values=Object.fromEntries(SET_SLIDERS.map(([key]) => {
      const match=new RegExp('^const SET_'+key+' = slider\\(([0-9.]+),','m').exec(text);
      return [key,match?Number(match[1]):NaN];
    }));
    validate(state);
    return liveCode(state).trim()===text.trim()?state:null;
  } catch { return null; }
}
