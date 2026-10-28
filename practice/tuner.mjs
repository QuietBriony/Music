import { centsFrom, noteName } from './music.mjs?v=4';
export function tuningStrings(instrument, transpose=0) {
  return instrument==='guitar'?[40,45,50,55,59,64].map((midi,i)=>({midi,string:6-i,fret:0,position:`${6-i}弦・開放`,label:`${6-i}弦 ${noteName(midi)}`})):
    [{midi:48,symbol:'合',string:3,name:'男弦'},{midi:53,symbol:'四',string:2,name:'中弦'},{midi:60,symbol:'工',string:1,name:'女弦'}].map(n=>({...n,midi:n.midi+transpose,fret:0,position:`${n.name}・開放`,label:`${n.name} ${noteName(n.midi+transpose)}`}));
}
export function tunerReading(detection,midi,gate=.006) {
  if(!detection.frequency || detection.rms<gate || detection.clarity<.85)return{cents:null,status:'waiting'};
  const cents=centsFrom(detection.frequency,midi);
  return{cents,status:Math.abs(cents)>300?'check':Math.abs(cents)<=10?'matched':cents>0?'high':'low'};
}
