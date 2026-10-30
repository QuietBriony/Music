import { centsFrom, noteName, detectPitch } from './music.mjs?v=16';
export function tuningStrings(instrument, transpose=0) {
  return instrument==='guitar'?[40,45,50,55,59,64].map((midi,i)=>({midi,string:6-i,fret:0,position:`${6-i}弦・開放`,label:`${6-i}弦 ${noteName(midi)}`})):
    [{midi:48,symbol:'合',string:3,name:'男弦'},{midi:53,symbol:'四',string:2,name:'中弦'},{midi:60,symbol:'工',string:1,name:'女弦'}].map(n=>({...n,midi:n.midi+transpose,fret:0,position:`${n.name}・開放`,label:`${n.name} ${noteName(n.midi+transpose)}`}));
}
export const tuningGate=gate=>Math.max(.0006,Math.min(.0035,gate/4));
export function detectTuningPitch(samples,sampleRate,gate=.006){
  // Tuning tolerates quieter, less pure ringing than lesson scoring. The target
  // never constrains the frequency search or folds a wrong octave into a match.
  return detectPitch(samples,sampleRate,tuningGate(gate),{threshold:.28});
}
export function tunerReading(detection,midi,gate=.006) {
  if(!detection.frequency || detection.rms<tuningGate(gate) || detection.clarity<.72)return{cents:null,status:'waiting',reason:detection.rms<tuningGate(gate)?'quiet':'unclear'};
  const cents=centsFrom(detection.frequency,midi);
  return{cents,status:Math.abs(cents)>300?'check':Math.abs(cents)<=10?'matched':cents>0?'high':'low'};
}
export class TunerTracker {
  constructor(){this.reset();}
  reset(){this.frequencies=[];this.target=null;}
  feed(detection,midi,gate=.006){
    const reading=tunerReading(detection,midi,gate);
    if(this.target!==midi){this.reset();this.target=midi;}
    if(reading.status==='waiting'){this.frequencies=[];return{...reading,frequency:null};}
    const previous=this.frequencies.at(-1);
    if(previous&&Math.abs(1200*Math.log2(detection.frequency/previous))>65)this.frequencies=[];
    this.frequencies.push(detection.frequency);if(this.frequencies.length>3)this.frequencies.shift();
    const frequency=[...this.frequencies].sort((a,b)=>a-b)[Math.floor(this.frequencies.length/2)];
    const stable=tunerReading({...detection,frequency},midi,gate);
    return{...stable,frequency,status:this.frequencies.length<3?'settling':stable.status};
  }
}
