import { centsFrom, noteName, detectPitch } from './music.mjs?v=27';
export const SANSHIN_TUNINGS={honchoshi:{name:'本調子',reading:'ほんちょうし',offsets:[0,5,12],tip:'男弦・中弦・女弦がド・ファ・ドの関係。収録の工工四はこの調弦です。'},niage:{name:'二揚げ',reading:'にあげ・にあぎ',offsets:[0,7,12],tip:'本調子から中弦だけを全音上げます。ド・ソ・ドの関係。'},sansage:{name:'三下げ',reading:'さんさげ・さんさぎ',offsets:[0,5,10],tip:'本調子から女弦だけを全音下げます。ド・ファ・シ♭の関係。'}};
export const sanshinTuning=kind=>SANSHIN_TUNINGS[kind]||SANSHIN_TUNINGS.honchoshi;
export function tuningLabel(transpose=0,kind='honchoshi'){
 const t=sanshinTuning(kind);return `${t.name} ${t.offsets.map(n=>noteName(48+transpose+n).replace(/\d/g,'').replace('#','♯').replace('A♯','B♭').replace('D♯','E♭')).join('・')}`;
}
export function tuningStrings(instrument, transpose=0,kind='honchoshi') {
  return instrument==='guitar'?[40,45,50,55,59,64].map((midi,i)=>({midi,string:6-i,fret:0,position:`${6-i}弦・開放`,label:`${6-i}弦 ${noteName(midi)}`})):
    [{midi:48,symbol:'合',string:3,name:'男弦'},{midi:53,symbol:'四',string:2,name:'中弦'},{midi:60,symbol:'工',string:1,name:'女弦'}].map((n,i)=>{const midi=48+transpose+sanshinTuning(kind).offsets[i];return{...n,midi,fret:0,position:`${n.name}・開放`,label:`${n.name} ${noteName(midi)}`};});
}
export const tuningGate=gate=>Math.max(.0006,Math.min(.0035,gate/4));
export const tunerInputGate=gate=>Math.max(.00035,Math.min(.0025,gate/6));
export function detectTuningPitch(samples,sampleRate,gate=.006){
  // Tuning tolerates quieter, less pure ringing than lesson scoring. The target
  // never constrains the frequency search or folds a wrong octave into a match.
  return detectPitch(samples,sampleRate,tunerInputGate(gate),{threshold:.32});
}
export function tunerReading(detection,midi,gate=.006) {
  if(!Number.isFinite(detection.frequency)||detection.frequency<=0 || detection.rms<tunerInputGate(gate) || detection.clarity<.65)return{cents:null,status:'waiting',reason:detection.rms<tunerInputGate(gate)?'quiet':'unclear'};
  const cents=centsFrom(detection.frequency,midi);
  return{cents,direction:cents>0?'high':'low',status:Math.abs(cents)>300?'check':Math.abs(cents)<=20?'matched':Math.abs(cents)<=80?'near':cents>0?'high':'low'};
}
export class TunerTracker {
  constructor(){this.reset();}
  reset(){this.frequencies=[];this.target=null;this.last=null;this.lastAt=-Infinity;this.trendBase=null;this.trend='';this.trendUntil=0;}
  feed(detection,midi,gate=.006,now=performance.now()){
    const reading=tunerReading(detection,midi,gate);
    if(this.target!==midi){this.reset();this.target=midi;}
    if(reading.status==='waiting'){
      if(!this.last)return{...reading,frequency:null,held:false};
      const ageMs=Math.max(0,now-this.lastAt);
      return{...this.last,reason:reading.reason,held:true,ageMs,status:ageMs<=3000?this.last.status:'held'};
    }
    if(now-this.lastAt>800)this.frequencies=[];
    const previous=this.frequencies.at(-1);
    if(previous&&Math.abs(1200*Math.log2(detection.frequency/previous))>120)this.frequencies=[];
    this.frequencies.push(detection.frequency);if(this.frequencies.length>3)this.frequencies.shift();
    const frequency=[...this.frequencies].sort((a,b)=>a-b)[Math.floor(this.frequencies.length/2)];
    const stable=tunerReading({...detection,frequency},midi,gate);
    // Two real observations are required for OK. Missing frames may retain a
    // reading but can never promote it to a confirmed match.
    if(this.frequencies.length<2)stable.status='settling';
    else if(this.last?.status==='matched'&&Math.abs(stable.cents)<=28)stable.status='matched';
    const error=Math.abs(stable.cents);
    if(stable.status==='check'){this.trendBase=null;this.trend='';}
    else if(this.trendBase===null)this.trendBase=error;
    else if(Math.abs(error-this.trendBase)>=5){this.trend=error<this.trendBase?'closer':'away';this.trendBase=error;this.trendUntil=now+1500;}
    this.lastAt=now;
    this.last={...stable,frequency,held:false,ageMs:0,trend:now<=this.trendUntil?this.trend:''};
    return this.last;
  }
}
