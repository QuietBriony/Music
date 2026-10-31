// Original, conservative spectral template fitting. No recordings or external model.
import { frequencyFor } from './music.mjs?v=28';
import { CHORDS, chordNotes } from './chords.mjs?v=28';
const sinc=x=>Math.abs(x)<1e-9?1:Math.sin(Math.PI*x)/(Math.PI*x);
const blackman=x=>Math.abs(.42*sinc(x)+.25*(sinc(x-1)+sinc(x+1))+.04*(sinc(x-2)+sinc(x+2)));
const families=[...new Map(Object.keys(CHORDS).map(name=>{
 const required=[...new Set(chordNotes(name).map(n=>n.midi%12))],pcs=CHORDS[name].omitsFifth?[...new Set([...required,(chordNotes(name)[0].midi+7)%12])]:required;
 return[name.split('/')[0],{name:name.split('/')[0],pcs,required}];
})).values(),{name:'Caug',pcs:[0,4,8],required:[0,4,8]}];
const cache=new Map();
function dictionary(sampleRate,fftSize,capo){
 const key=`${sampleRate}:${fftSize}:${capo}`;if(cache.has(key))return cache.get(key);
 const maxBin=Math.min(fftSize/2-1,Math.ceil(3000*fftSize/sampleRate)),templates=[];
 for(let midi=36;midi<=83;midi++)for(const cents of [-12,0,12])for(const bright of [false,true]){
  const points=new Map(),fundamental=frequencyFor(midi+capo)*2**(cents/1200);
  for(let h=1;h<=7;h++){
   const centre=fundamental*h*fftSize/sampleRate;if(centre>maxBin-3)break;
   const harmonic=bright?(h===1?.55:1/(h-1)**1.2):1/h**1.3;
   for(let bin=Math.max(1,Math.ceil(centre-3));bin<=Math.min(maxBin,Math.floor(centre+3));bin++)points.set(bin,(points.get(bin)||0)+blackman(bin-centre)*harmonic);
  }
  const norm=Math.sqrt([...points.values()].reduce((s,v)=>s+v*v,0));
  templates.push({midi,points:[...points].map(([bin,v])=>[bin,v/norm])});
 }
 const result={maxBin,templates};if(cache.size>=3)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export function detectChord(decibels,sampleRate,fftSize,{rms=0,gate=.006,capo=0,expected=null,previous=null}={}){
 if(rms<gate)return{name:null,confidence:0,status:'quiet',pitches:[]};
 if(!Number.isInteger(capo)||capo<0||capo>7)return{name:null,confidence:0,status:'unclear',pitches:[]};
 const {maxBin,templates}=dictionary(sampleRate,fftSize,capo),spectrum=new Float64Array(maxBin+1);
 let peak=0,energy=0;for(let i=1;i<=maxBin;i++){const value=Number.isFinite(decibels[i])?Math.max(0,10**(decibels[i]/20)-.00002):0;spectrum[i]=value;peak=Math.max(peak,value);}
 if(peak<.0001)return{name:null,confidence:0,status:'quiet',pitches:[]};
 for(let i=1;i<=maxBin;i++){spectrum[i]/=peak;energy+=spectrum[i]**2;}
 const residual=spectrum.slice(),weights=new Float64Array(templates.length);
 // Non-negative coordinate descent; each dictionary column is unit length.
 for(let pass=0;pass<10;pass++)for(let t=0;t<templates.length;t++){
  let correlation=0;for(const [bin,value] of templates[t].points)correlation+=residual[bin]*value;
  const next=Math.max(0,weights[t]+correlation-.008),change=next-weights[t];weights[t]=next;
  if(Math.abs(change)>.000001)for(const [bin,value] of templates[t].points)residual[bin]-=value*change;
 }
 const pitches=new Float64Array(84),chroma=new Float64Array(12);
 for(let i=0;i<templates.length;i++)pitches[templates[i].midi]+=weights[i];
 const maximum=Math.max(...pitches),active=[];
 for(let midi=36;midi<=83;midi++)if(pitches[midi]>maximum*.15){chroma[midi%12]+=pitches[midi];active.push(midi);}
 const chromaMax=Math.max(...chroma);if(!chromaMax)return{name:null,confidence:0,status:'unclear',pitches:active};
 const present=[...chroma].map((v,i)=>v>=chromaMax*.16?i:-1).filter(i=>i>=0);
 const fit=1-[...residual].reduce((s,v)=>s+v*v,0)/Math.max(energy,1e-10);
 if(present.length<3||fit<.55)return{name:null,confidence:0,status:'unclear',pitches:active};
 const total=[...chroma].reduce((s,v)=>s+v,0),candidates=[];
 // All tones of the requested chord must be audible. Only tones belonging to
 // the preceding accepted chord may account for a lingering string resonance.
 const target=families.find(f=>f.name===expected?.split('/')[0]),before=families.find(f=>f.name===previous?.split('/')[0]);
 if(target&&before&&target.required.every(pc=>chroma[pc]>=chromaMax*.18)){
  const outside=[...chroma].reduce((s,v,pc)=>s+(target.pcs.includes(pc)?0:v),0)/total;
  const unexplained=[...chroma].reduce((s,v,pc)=>s+(target.pcs.includes(pc)||before.pcs.includes(pc)?0:v),0)/total;
  if(outside<=.26&&unexplained<=.035)return{name:target.name,confidence:Math.min(1,fit)*(1-unexplained)*(1-outside*.4),status:'chord',pitches:active,tail:outside>.14};
 }
 if(present.length>5)return{name:null,confidence:0,status:'unclear',pitches:active};
 for(const family of families){
  if(!family.required.every(pc=>chroma[pc]>=chromaMax*.16))continue;
  const outside=[...chroma].reduce((s,v,pc)=>s+(family.pcs.includes(pc)?0:v),0)/total;
  if(outside>.14)continue;
  const confidence=Math.min(1,fit)*(1-outside);
  candidates.push({...family,confidence});
 }
 candidates.sort((a,b)=>b.confidence-a.confidence||b.pcs.length-a.pcs.length);
 const winner=candidates[0];
 return{name:winner?.name||null,confidence:winner?.confidence||0,status:winner?'chord':'unclear',pitches:active};
}
export class ChordGate {
 constructor(){this.reset();}
 reset(){this.last=null;this.candidate=null;this.since=null;this.lastGoodAt=null;this.interrupted=false;this.acceptedAt=-Infinity;this.quietAt=null;this.armed=true;this.lastRms=0;}
 rebaseEnvelope(rms){this.lastRms=rms;this.candidate=null;this.since=null;this.lastGoodAt=null;if(this.last!==null)this.armed=false;}
 feed(result,expected,now,rms,gate=.006,attackRms=rms){
  if(rms<gate){this.quietAt??=now;if(now-this.quietAt>=80)this.armed=true;this.candidate=null;this.since=null;this.lastRms=attackRms;return false;}
  this.quietAt=null;
  if(now-this.acceptedAt>=160&&attackRms>Math.max(gate*1.5,this.lastRms*1.45)&&attackRms-this.lastRms>gate*.5)this.armed=true;
  this.lastRms=attackRms;const name=expected?.split('/')[0];
  if(!name||result.name!==name||result.confidence<.65){this.interrupted=true;if(result.name||this.lastGoodAt===null||now-this.lastGoodAt>160){this.candidate=null;this.since=null;}return false;}
  const from=families.find(f=>f.name===this.last),to=families.find(f=>f.name===name),newTone=from&&to&&to.required.some(pc=>!from.pcs.includes(pc));
  if(this.last&&!this.armed&&!newTone)return false;
  if(this.candidate!==name||this.interrupted&&this.lastGoodAt!==null&&now-this.lastGoodAt>160){this.candidate=name;this.since=now;}
  this.lastGoodAt=now;this.interrupted=false;
  if(now-this.since<140||now-this.acceptedAt<280)return false;
  this.last=name;this.armed=false;this.acceptedAt=now;this.candidate=null;this.since=null;return true;
 }
}
export function chordAttackLevel(wave){let sum=0;const count=Math.min(2048,wave.length);for(let i=wave.length-count;i<wave.length;i++)sum+=wave[i]*wave[i];return count?Math.sqrt(sum/count):0;}
