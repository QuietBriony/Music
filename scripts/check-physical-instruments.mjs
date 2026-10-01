import assert from 'node:assert/strict';
import { renderInstrumentBank, nearestKey, GUITAR_KEYS, BASS_KEYS, MAX_BANK_BYTES } from '../audio/physical-band/bank.mjs';
import { midiFrequency } from '../audio/physical-band/dsp.mjs';
import { createPhysicalBand, prepareInstrumentBank } from '../audio/physical-band/instruments.mjs';
const bank=renderInstrumentBank();
assert.ok(bank.bytes<MAX_BANK_BYTES); assert.equal(Object.keys(bank.samples).length,52);
function pitch(data,note){
 const period=32000/midiFrequency(note), from=1920, to=Math.min(data.length-Math.ceil(period*1.2),7680), s=new Map();
 for(let lag=Math.floor(period*.9);lag<=Math.ceil(period*1.1);lag++){let dot=0,a=0,b=0;for(let i=from;i<to;i++){dot+=data[i]*data[i+lag];a+=data[i]**2;b+=data[i+lag]**2;}s.set(lag,dot/Math.sqrt(a*b));}
 const [lag,c]=[...s].sort((a,b)=>b[1]-a[1])[0], l=s.get(lag-1),r=s.get(lag+1);
 return 32000/(lag+.5*(l-r)/(l-2*c+r));
}
for(const [key,data] of Object.entries(bank.samples)){
 assert.ok(data.every(Number.isFinite),key);assert.ok(data.at(-1)===0);assert.ok(data.some(x=>Math.abs(x)>.02));
 const mean=data.reduce((sum,x)=>sum+x,0)/data.length;assert.ok(Math.abs(mean)<.0001,`${key} DC ${mean}`);
 if(!key.startsWith('drums')&&!key.startsWith('palm')){const n=+key.split(':')[1],cents=1200*Math.log2(pitch(data,n)/midiFrequency(n));assert.ok(Math.abs(cents)<20,`${key}: ${cents}`);}
}
for(let n=24;n<=84;n++){const keys=n<40?BASS_KEYS:GUITAR_KEYS; assert.ok(Math.abs(nearestKey(n,keys)-n)<=1);}
// Exercise the actual adapter: fractional pitches, scheduling, hard STOP of
// future notes, capacity bound, and disconnect of every source and amp node.
const made=[];const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}});
function node(){const n={gain:param(),frequency:param(),Q:param(),playbackRate:param(),connect(){},disconnect(){this.disconnected=true;},start(t){this.startAt=t;},stop(t){this.stopAt=t;}};made.push(n);return n;}
const context={currentTime:2,createGain:node,createBiquadFilter:node,createWaveShaper:node,createBufferSource:node};
const buffers=new Map(Object.entries(bank.samples).map(([k,s])=>[k,{duration:s.length/32000}]));
const band=createPhysicalBand(context,{buffers,bytes:bank.bytes},{},{connect:(s,t)=>s.connect(t),seconds:Number,midi:Number});
band.bass.triggerAttackRelease(26.5,.4,3,.8);band.guitar.triggerAttackRelease([48,55,60],.2,3,.8);band.drums.kick.triggerAttackRelease('C1','16n',3,.6);
let snap=band.snapshot();assert.equal(snap.pending,5);assert.equal(snap.last.bass.rate,2**(-.5/12));
band.bass.releaseAll();assert.equal(band.snapshot().pending,4);
for(let i=0;i<150;i++)band.guitar.triggerAttackRelease(48,.2,3,.8);
assert.equal(band.snapshot().pending,128);assert.ok(band.snapshot().dropped>0);
band.dispose();band.dispose();assert.equal(band.snapshot().pending,0);assert.ok(made.every(n=>n.disconnected));
console.log(`Physical instruments PASS: 52 finite/DC-free buffers, measured tuning, fractional playback rates, ${bank.bytes} bytes, future-note cancellation and graph disposal`);


let workers=0, terminated=0;
globalThis.Worker=class {
 constructor(){workers++;} postMessage(){} terminate(){terminated++;}
};
const abort=new AbortController(), preparing=prepareInstrumentBank({}, {signal:abort.signal});
abort.abort();await assert.rejects(preparing,/cancelled/);assert.equal(workers,1);assert.equal(terminated,1);
await assert.rejects(prepareInstrumentBank({}, {signal:abort.signal}),/cancelled/);assert.equal(workers,1);
delete globalThis.Worker;
console.log('Physical bank cancellation PASS: terminate in-flight Worker and reject pre-aborted preparation without allocation');
