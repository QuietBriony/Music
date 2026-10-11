// Fixed native synth recipes. IDs are saved; executable fragments are never
// taken from metadata. These reuse the existing voices, clock and faders.
export const INSTRUMENT_ROLES = {bass:'低音',response:'返し',pad:'パッド'};
export const INSTRUMENT_DEFAULTS = {version:1,bass:'acid',response:'square',pad:'warm'};
export const INSTRUMENT_VOICES = {
  bass:[
    {id:'acid',title:'303風 · ノコギリ',sound:'sawtooth',code:'.s("sawtooth")',level:1},
    {id:'rubber',title:'ゴムっぽい低音 · 矩形',sound:'square',code:'.s("square")',level:.72},
    {id:'fm-bass',title:'FMベース · 硬い芯',sound:'sine',code:'.s("sine").fm(1.2).fmh(1)',level:.85},
  ],
  response:[
    {id:'square',title:'303風 · 矩形の返し',sound:'square',code:'.s("square")',level:1},
    {id:'glass',title:'ガラス風 · FMプラック',sound:'sine',code:'.s("sine").fm(1.6).fmh(2.01)',level:.85},
    {id:'pluck',title:'丸いプラック · 三角波',sound:'triangle',code:'.s("triangle")',level:1},
  ],
  pad:[
    {id:'warm',title:'暖かいパッド · 三角波',sound:'triangle',code:'.s("triangle")',level:1},
    {id:'soft',title:'柔らかいパッド · 正弦波',sound:'sine',code:'.s("sine")',level:1},
    {id:'hollow',title:'空洞っぽいパッド · FM',sound:'sine',code:'.s("sine").fm(.45).fmh(2)',level:.85},
  ],
};
export function validateInstruments(profile) {
  if (!profile || profile.version !== 1 || Object.keys(INSTRUMENT_ROLES).some(role =>
    !INSTRUMENT_VOICES[role].some(voice=>voice.id===profile[role]))) throw new Error('楽器の保存設定が不正です');
  return profile;
}
export function instrumentProfile(state) { return state.instruments === undefined ? INSTRUMENT_DEFAULTS : validateInstruments(state.instruments); }
export function instrumentVoice(state,role) {
  return INSTRUMENT_VOICES[role].find(voice=>voice.id===instrumentProfile(state)[role]);
}
export function instrumentCode(state,role) {
  return instrumentVoice(state,role).code;
}
export function instrumentGain(state,role) {
  const level=instrumentVoice(state,role).level;
  return level===1 ? '' : '.mul(gain('+level+'))';
}
