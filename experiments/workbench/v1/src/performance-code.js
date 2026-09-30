import { splitPublishedPattern } from './mix-code.js';

export const SET_MARKER = '// TECHNO_SET_V1 ';
export const SET_PRESETS = [
  { id: 'acid-drive', title: 'Acid Drive', bpm: 128, bank: '909' },
  { id: 'dub-room', title: 'Dub Room', bpm: 122, bank: '909' },
  { id: 'electro-808', title: 'Electro 808', bpm: 134, bank: '808' },
];
export const SET_SCENES = ['intro', 'groove', 'acid', 'break', 'peak'];
export const SET_TRACKS = ['kick', 'snare', 'hh', 'oh', 'bell', 'acid'];
export const SET_SLIDERS = [
  ['MASTER', '全体音量', .55, 0, 1, .01, '%'],
  ['KICK', 'キック音量', .65, 0, 1, .01, '%'],
  ['SNARE', 'スネア音量', .38, 0, 1, .01, '%'],
  ['HATS', 'ハット音量', .28, 0, 1, .01, '%'],
  ['BELL', 'カウベル音量', .2, 0, 1, .01, '%'],
  ['ACID', '303音量', .32, 0, 1, .01, '%'],
  ['CUTOFF', '明るさ', 420, 120, 4800, 10, ' Hz'],
  ['RESONANCE', 'みょん', 14, 1, 26, 1, ''],
  ['DRIVE', '歪み', 2.4, 0, 5, .1, ''],
  ['DECAY', 'うねりの長さ', .16, .03, .45, .01, ' s'],
  ['BOOM', '808の低音の長さ', .24, .08, .8, .01, ' s'],
  ['A', '素材A音量', 0, 0, 1, .01, '%'],
  ['B', '素材B音量', 0, 0, 1, .01, '%'],
  ['CROSS', '素材A/Bのクロスフェーダー', .5, 0, 1, .01, '%'],
];
const sceneMasks = {
  intro: ['kick', 'hh'], groove: ['kick', 'snare', 'hh', 'oh'],
  acid: SET_TRACKS, break: ['hh', 'bell', 'acid'], peak: SET_TRACKS,
};
const hits = (indices) => Array.from({ length: 16 }, (_, i) => indices.includes(i));
const defaults = {
  kick: hits([0, 4, 8, 12]), snare: hits([4, 12]), hh: hits([2, 6, 10, 14]),
  oh: hits([14]), bell: hits([3, 10]),
};
const notes = ['c2', '~', 'c2', 'eb2', 'g1', '~', 'bb1', 'c2', 'c2', 'c3', '~', 'eb2', 'g1', '~', 'bb1', 'd2'];

export function defaultSet(preset = 'acid-drive', layers = []) {
  const selected = SET_PRESETS.find((p) => p.id === preset) || SET_PRESETS[0];
  const state = {
    preset: selected.id, bpm: selected.bpm, bank: selected.bank, scene: 'acid', auto: false,
    steps: structuredClone(defaults), notes: [...notes], muted: [], layers: structuredClone(layers),
    values: Object.fromEntries(SET_SLIDERS.map(([key, , value]) => [key, value])),
  };
  if (preset === 'dub-room') {
    Object.assign(state.values, { CUTOFF: 270, RESONANCE: 8, DRIVE: .8, DECAY: .3, ACID: .25 });
    state.notes = ['c2', '~', '~', '~', 'eb2', '~', '~', '~', 'g1', '~', '~', '~', 'bb1', '~', '~', '~'];
  } else if (preset === 'electro-808') {
    state.steps.kick = hits([0, 3, 6, 8, 11]);
    state.steps.snare = hits([4, 12]);
    state.steps.hh = hits([0, 2, 4, 6, 8, 10, 12, 14]);
    Object.assign(state.values, { CUTOFF: 700, RESONANCE: 10, DRIVE: 1.1, ACID: .22, BOOM: .34 });
  }
  return state;
}

export function validateSet(state) {
  if (!state || !SET_PRESETS.some((p) => p.id === state.preset)
    || !SET_SCENES.includes(state.scene) || !['909', '808'].includes(state.bank)
    || !Number.isInteger(state.bpm) || state.bpm < 60 || state.bpm > 180
    || typeof state.auto !== 'boolean' || !Array.isArray(state.muted)
    || state.muted.some((key) => !SET_TRACKS.includes(key))) throw new Error('セットの形式が合いません');
  for (const track of Object.keys(defaults)) {
    if (!Array.isArray(state.steps?.[track]) || state.steps[track].length !== 16
      || state.steps[track].some((hit) => typeof hit !== 'boolean')) throw new Error('16ステップが不正です');
  }
  if (!Array.isArray(state.notes) || state.notes.length !== 16
    || state.notes.some((n) => !['~', 'g1', 'bb1', 'c2', 'd2', 'eb2', 'f2', 'g2', 'bb2', 'c3'].includes(n))) {
    throw new Error('303の音符が不正です');
  }
  if (!Array.isArray(state.layers) || state.layers.length !== 2) throw new Error('素材A/Bが必要です');
  for (const layer of state.layers) {
    if (!layer || !/^[a-z0-9-]{1,80}$/.test(layer.id) || typeof layer.title !== 'string'
      || layer.title.length > 120 || typeof layer.source !== 'string' || layer.source.length > 12000) {
      throw new Error('素材の形式が合いません');
    }
    splitPublishedPattern(layer.source);
  }
  for (const [key, , , min, max] of SET_SLIDERS) {
    const value = state.values?.[key];
    if (!Number.isFinite(value) || value < min || value > max) throw new Error('フェーダーが範囲外です');
  }
  return state;
}

export function setSliderValue(code, key) {
  const match = new RegExp('\\bconst SET_' + key + ' = slider\\(([0-9.]+),').exec(code);
  return match ? Number(match[1]) : null;
}

function sequence(state, track, sound) {
  return state.steps[track].map((hit) => hit ? sound : '~').join(' ');
}

export function technoSetCode(input) {
  const state = validateSet(input);
  const metadata = structuredClone(state);
  delete metadata.values;
  const [a, b] = state.layers.map((layer) => splitPublishedPattern(layer.source));
  const muted = new Set(state.muted);
  const enabled = (track) => !muted.has(track) && sceneMasks[state.scene].includes(track);
  const gate = (track) => {
    if (muted.has(track)) return '.filterWhen(() => false)';
    if (!state.auto) return enabled(track) ? '' : '.filterWhen(() => false)';
    const sections = ['intro', 'groove', 'acid', 'acid', 'break', 'peak', 'peak', 'groove'];
    const flags = sections.map((s) => sceneMasks[s].includes(track));
    return '.filterWhen(t => ' + JSON.stringify(flags) + '[Math.floor(Number(t) / 8) % 8])';
  };
  const drum = (track, sound, level) => 's(' + JSON.stringify(sequence(state, track, sound))
    + ').bank("RolandTR909").gain(SET_' + level + ')' + gate(track);
  const synth = (track, sound) => 's(' + JSON.stringify(sequence(state, track, sound)) + ')';
  const peakHats = state.auto
    ? '.when(t => [false,false,false,false,false,true,true,false][Math.floor(Number(t) / 8) % 8], p => p.ply(2))'
    : state.scene === 'peak' ? '.ply(2)' : '';
  const voices = state.bank === '909' ? [
    drum('kick', 'bd', 'KICK'), drum('snare', 'sd', 'SNARE'), drum('hh', 'hh', 'HATS') + peakHats,
    drum('oh', 'oh', 'HATS') + '.mul(gain(0.65))',
  ] : [
    synth('kick', 'sine') + '.freq(52).penv(36).pdec(0.035).panchor(0).attack(0.002).decay(SET_BOOM).sustain(0).release(0.02).gain(SET_KICK)' + gate('kick'),
    'stack(' + synth('snare', 'white') + '.hpf(1400).attack(0.002).decay(0.12).sustain(0).release(0.02), '
      + synth('snare', 'triangle') + '.freq(180).attack(0.002).decay(0.06).sustain(0).release(0.02)).gain(SET_SNARE)' + gate('snare'),
    synth('hh', 'white') + '.hpf(6500).attack(0.001).decay(0.035).sustain(0).release(0.01).gain(SET_HATS)' + gate('hh') + peakHats,
    synth('oh', 'white') + '.hpf(5500).attack(0.001).decay(0.16).sustain(0).release(0.02).gain(SET_HATS).mul(gain(0.55))' + gate('oh'),
  ];
  voices.push(
    synth('bell', 'square') + '.freq(540).fm(0.8).fmh(1.48).hpf(500).lpf(2800).attack(0.002).decay(0.055).sustain(0).release(0.02).gain(SET_BELL).mul(gain(0.35))' + gate('bell'),
    'note(' + JSON.stringify(state.notes.join(' ')) + ').s("sawtooth")'
      + '.attack(0.003).decay(0.13).sustain(0).release(0.03)'
      + '.lpf(SET_CUTOFF).lpq(SET_RESONANCE).lpa(0.003).lpd(SET_DECAY).lps(0).lpenv(6.5).ftype("ladder")'
      + '.distort(SET_DRIVE).postgain(0.42).gain(SET_ACID)' + gate('acid'),
    'xfade(setLayerA.mul(gain(SET_A)), SET_CROSS, setLayerB.mul(gain(SET_B))).mul(gain(0.3))',
  );
  return [
    SET_MARKER + JSON.stringify(metadata),
    '// テクノ・ライブセット。1 cycle = 4拍。808は合成による近似、純正エミュレーションではありません。',
    "samples({pad:'/api/sounds/pad',sub:'/api/sounds/sub',drums:'/api/sounds/drums'});",
    ...SET_SLIDERS.map(([key, title, , min, max, step]) =>
      `const SET_${key} = slider(${state.values[key]}, ${min}, ${max}, ${step}) // ${title}`),
    `setcpm(${state.bpm / 4})`,
    `const setLayerA = (() => {\n${a.declarations}\nreturn ${a.expression}\n})()`,
    `const setLayerB = (() => {\n${b.declarations}\nreturn ${b.expression}\n})()`,
    'stack(\n  ' + voices.join(',\n  ') + '\n).mul(gain(SET_MASTER)).mul(gain(0.72)).filterValues(v => v.gain > 0)',
    '',
  ].join('\n');
}

// Only drive the controls while the generated structure still matches. Hand
// edits to the body belong to the code editor and must never be overwritten.
export function readTechnoSet(code) {
  try {
    const line = code.replace(/\r\n?/g, '\n').split('\n').find((s) => s.startsWith(SET_MARKER));
    if (!line || code.length > 100_000) return null;
    const state = JSON.parse(line.slice(SET_MARKER.length));
    state.values = Object.fromEntries(SET_SLIDERS.map(([key]) => [key, setSliderValue(code, key)]));
    const tempo = /^setcpm\(([0-9.]+)\)$/m.exec(code);
    state.bpm = tempo ? Number(tempo[1]) * 4 : NaN;
    validateSet(state);
    return technoSetCode(state).trim() === code.replace(/\r\n?/g, '\n').trim() ? state : null;
  } catch { return null; }
}

export function sceneAtCycle(cycle) {
  const sections = ['intro', 'groove', 'acid', 'acid', 'break', 'peak', 'peak', 'groove'];
  return sections[Math.max(0, Math.floor(cycle / 8)) % sections.length];
}
