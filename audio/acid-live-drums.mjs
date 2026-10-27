import { UnifiedSynth, getFactoryPreset, applyTrackPerformanceControls } from '../experiments/workbench/v1/third_party/acidbros/js/audio/tr909/UnifiedSynth.js?v=br-442';

export const DRUMS=[['kick','KICK'],['snare','SNARE'],['hat','HAT'],['open','OPEN HAT'],['clap','CLAP']];
const ids=DRUMS.map(([id])=>id),factory={kick:'bd',snare:'sd',clap:'cp'};
const pattern=(hits,accent=[])=>Array.from({length:16},(_,i)=>accent.includes(i)?2:hits.includes(i)?1:0);
export function drumDefaults() {
  return {enabled:false,parts:{
    kick:{enabled:true,locked:true,volume:72,tone:48,decay:48,steps:pattern([0,4,8,12],[0,8])},
    snare:{enabled:true,locked:false,volume:52,tone:46,decay:32,steps:pattern([4,12],[12])},
    hat:{enabled:true,locked:false,volume:38,tone:50,decay:24,steps:pattern([0,2,4,6,8,10,12,14],[2,6,10,14])},
    open:{enabled:true,locked:false,volume:29,tone:42,decay:42,steps:pattern([6,14])},
    clap:{enabled:true,locked:false,volume:30,tone:48,decay:32,steps:pattern([12])}
  }};
}
export function validateDrums(value) {
  if(!value||typeof value.enabled!=='boolean')throw Error('電子ドラムの設定が不正です。');
  const result={enabled:value.enabled,parts:{}};
  for(const id of ids){
    const p=value.parts?.[id];if(!p||typeof p.enabled!=='boolean'||typeof p.locked!=='boolean'||!Array.isArray(p.steps)||p.steps.length!==16||p.steps.some(s=>![0,1,2].includes(s)))throw Error('ドラムの打点は16個の0／1／2で指定してください。');
    for(const k of ['volume','tone','decay'])if(!Number.isFinite(p[k])||p[k]<0||p[k]>100)throw Error('ドラムのフェーダー値が範囲外です。');
    result.parts[id]={enabled:p.enabled,locked:p.locked,volume:p.volume,tone:p.tone,decay:p.decay,steps:[...p.steps]};
  }
  return result;
}
export function drumDice(config,id,random=Math.random) {
  const next=validateDrums(config),p=next.parts[id];if(!p||p.locked)return next;
  const choices={kick:[[0,4,8,12],[0,4,8,10,12],[0,4,7,8,12]],snare:[[4,12],[4,11,12],[4,12,15]],hat:[[0,2,4,6,8,10,12,14],[2,6,10,14],[0,2,6,8,10,14]],open:[[6,14],[2,10],[6,10,14]],clap:[[12],[4,12],[4]]};
  const hits=choices[id][Math.min(2,Math.floor(random()*choices[id].length))];p.steps=pattern(hits,hits.filter(i=>i%8===4));return next;
}
const noiseCache=new WeakMap();
function noise(context) {
  const old=noiseCache.get(context);if(old?.sampleRate===context.sampleRate)return old;
  const b=context.createBuffer(1,context.sampleRate,context.sampleRate),x=b.getChannelData(0);let seed=0x909442;
  for(let i=0;i<x.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;x[i]=(seed>>>0)/2147483648-1;}
  noiseCache.set(context,b);return b;
}
export function drumPreset(id,settings,accent=1,sampleRate=48000) {
  if(factory[id]) {
    const p=getFactoryPreset(factory[id]);
    applyTrackPerformanceControls(p,factory[id],{vol:.55,p1:50,p2:settings.tone,p3:50,decay:50,accent:accent===2?1.25:1});
    const length=.35+settings.decay/100*1.3;
    for(const key of ['osc1','osc2','osc3','noise','noise2'])if(p[key]){if(p[key].a_decay)p[key].a_decay*=length;if(p[key].decay)p[key].decay*=length;}
    return p;
  }
  // The workbench WAVs remain in their original surface. Hats here are
  // procedural noise through the same synth, with no downloaded recording.
  return {vol:.4,accent:accent===2?1.2:1,masterHPF:Math.min(sampleRate*.4,4500),noise:{enabled:true,
    filter_type:'highpass',cutoff:Math.min(sampleRate*.43,4200+settings.tone*65),Q:.5,
    decay:(id==='open'?.09:.018)+settings.decay/100*(id==='open'?.42:.09),level:.45}};
}
export function createDrumVoices(context,output) {
  const shared=noise(context),voices={},gains={},last={};let disposed=false,hits=0;
  for(const id of ids){const gain=context.createGain();gain.gain.value=0;gain.connect(output);gains[id]=gain;voices[id]=new UnifiedSynth(context,gain,shared);}
  return {
    level(id,value,time=context.currentTime){if(disposed||last[id]===value)return;last[id]=value;const p=gains[id].gain;p.cancelScheduledValues(time);p.setTargetAtTime(value*.4,time,.02);},
    trigger(id,time,settings,accent){if(disposed)return;voices[id].play(drumPreset(id,settings,accent,context.sampleRate),time);hits++;},
    stop(){for(const id of ids){voices[id].stopAll();gains[id].gain.cancelScheduledValues(context.currentTime);gains[id].gain.setValueAtTime(0,context.currentTime);last[id]=0;}},
    dispose(){this.stop();for(const gain of Object.values(gains))gain.disconnect();disposed=true;},
    diagnostics:()=>({hits,activeNodes:Object.values(voices).reduce((sum,v)=>sum+v.activeNodes.length,0),noiseBytes:shared.length*4})
  };
}
