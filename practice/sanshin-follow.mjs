import { NoteFollower,detectPitch } from './music.mjs?v=47';

// Find a short bachi attack anywhere in the latest observation interval, so an
// attack between microphone callbacks is not lost in the previous string's tail.
export function sanshinAttack(samples,sampleRate){
 const window=Math.max(8,Math.round(sampleRate*.012)),start=Math.max(1,samples.length-Math.round(sampleRate*.048));let sum=0,peak=0;
 for(let i=start;i<samples.length;i++){
  const delta=samples[i]-samples[i-1];sum+=delta*delta;
  if(i-start>=window){const old=samples[i-window]-samples[i-window-1];sum-=old*old;}
  if(i-start+1>=window)peak=Math.max(peak,sum/window);
 }
 return Math.sqrt(Math.max(0,peak));
}
export function detectSanshinPitch(samples,sampleRate,gate){
 return {...detectPitch(samples,sampleRate,gate,{threshold:.26}),attack:sanshinAttack(samples,sampleRate)};
}
export class SanshinFollower extends NoteFollower{
 constructor(notes,options={}){super(notes,{tolerance:60,hold:80,dropout:200,minClarity:.74,rearmRatio:Infinity,...options});}
 reset(index){super.reset(index);this.attackBaseline=null;this.previousAttack=0;this.repluck=null;this.onset=null;}
 rebaseEnvelope(){this.attackBaseline=null;this.previousAttack=0;this.repluck=null;this.onset=null;this.candidateAt=null;this.previousGood=false;}
 feed(reading,now){
  const attack=Number.isFinite(reading.attack)?reading.attack:0,rms=reading.rms||0;
  const baseline=this.attackBaseline,previousRms=this.lastRms;
  const repeated=this.lastMidi===this.notes[this.index]?.midi&&!this.done;
  // Remember a fresh bachi before the acceptance cooldown ends. A previous
  // pitch can be recognized late; its waiting time must not erase the next
  // physical attack. The parent still enforces 220ms before voiced evidence.
  if(this.onset&&(!repeated||now>this.onset.until))this.onset=null;
  if(!this.onset&&repeated&&now-this.acceptedAt>=120&&baseline!==null&&attack>Math.max(.00015,this.previousAttack*1.35)){
   this.onset={until:now+135,floor:previousRms,threshold:Math.max(.00015,Math.min(baseline,this.previousAttack)*1.5),peaked:false};
  }
  // The 12ms attack precedes the RMS rise of the 85ms pitch window. Confirm
  // their relationship across adjacent frames rather than requiring one frame.
  if(this.onset){
   // A rising edge, its peak and the RMS rise can occupy different callbacks.
   // Keep their shared pre-attack baseline; require all three observations.
   this.onset.peaked ||= attack>this.onset.threshold;
   if(this.onset.peaked&&rms>Math.max(this.gate*1.5,this.onset.floor*1.12)){
    this.armed=true;this.candidateAt=null;this.previousGood=false;this.repluck={until:now+300,floor:this.onset.floor};this.onset=null;
   }
  }
  // A short click over an old ringing note is not a new pitched pluck. Confirm
  // the new envelope while the detector collects actual voiced observations.
  if(this.repluck&&repeated){
   if(now>this.repluck.until||(now>this.repluck.until-220&&rms<this.repluck.floor*1.05)){
    this.armed=false;this.repluck=null;this.candidateAt=null;this.previousGood=false;
   }
  }
  const result=super.feed(reading,now);
  if(result.matched){this.repluck=null;this.onset=null;}
  this.attackBaseline=baseline===null?attack:baseline*.82+attack*.18;this.previousAttack=attack;
  return result;
 }
}
