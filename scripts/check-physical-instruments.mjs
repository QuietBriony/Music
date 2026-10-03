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
const rms=(data,from,to)=>Math.sqrt(data.slice(Math.round(from*32000),Math.round(to*32000)).reduce((sum,x)=>sum+x*x,0)/Math.round((to-from)*32000));
assert.ok(rms(bank.samples['guitar:49'],.4,.65)>.001,'Open string retains an audible body after a short score gate');
assert.ok(rms(bank.samples['bass:36'],.4,.65)>.003,'Bass body survives a short score gate');
assert.ok(rms(bank.samples['palm:49'],.3,.5)<rms(bank.samples['guitar:49'],.3,.5)*.1,'Explicit palm articulation remains short');
assert.ok(rms(bank.samples['drums:snare'],.2,.35)>.003,'Snare has a decaying body after its attack');
// Exercise the actual adapter: fractional pitches, scheduling, hard STOP of
// future notes, capacity bound, and disconnect of every source and amp node.
const made=[];const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
function node(){const n={gain:param(),frequency:param(),Q:param(),pan:param(),delayTime:param(),playbackRate:param(),connect(){},disconnect(){this.disconnected=true;},start(t){this.startAt=t;},stop(t){this.stopAt=t;}};made.push(n);return n;}
const context={currentTime:2,createGain:node,createBiquadFilter:node,createWaveShaper:node,createBufferSource:node,createDelay:node,createStereoPanner:node};
const buffers=new Map(Object.entries(bank.samples).map(([k,s])=>[k,{duration:s.length/32000}]));
const band=createPhysicalBand(context,{buffers,bytes:bank.bytes},{},{connect:(s,t)=>s.connect(t),seconds:Number,midi:Number});
band.bass.triggerAttackRelease(36,.2,1,.8);band.drums.snare.triggerAttackRelease('16n',1,.7);
assert.equal(band.snapshot().pending,0,'Elapsed attacks on a mid-bar seek must not burst together at the current time');
band.bass.triggerAttackRelease(26.5,.4,3,.8);band.guitar.triggerAttackRelease([48,55,60],.2,3,.8);band.drums.kick.triggerAttackRelease('C1','16n',3,.6);
let snap=band.snapshot();assert.equal(snap.pending,5);assert.equal(snap.last.bass.rate,2**(-.5/12));
const firstBass=made.find(n=>n.startAt===3);
assert.ok(firstBass.stopAt>4,'Short bass score gate does not chop the body');
assert.ok(made.filter(n=>n.startAt>=3&&n.startAt<3.02).every(n=>n.stopAt>3.45),'Strings in one stroke do not choke each other');
band.bass.triggerAttackRelease(36,.12,3.6,.8);
assert.ok(firstBass.stopAt<=3.661,'The next bass note damps the old pitch');
band.bass.releaseAll();assert.equal(band.snapshot().pending,4);
band.guitar.releaseAll();band.drums.dispose();assert.equal(band.snapshot().pending,0);
let start=made.length;
band.guitar.triggerAttackRelease([48,55,60],.12,4,.8,{technique:'cut',upstroke:true,sweep:.003});
const cut=made.slice(start).filter(n=>Number.isFinite(n.startAt));
assert.equal(cut.length,3);assert.ok(cut[0].buffer===buffers.get('guitar:61')&&cut[2].buffer===buffers.get('guitar:49'),'An upstroke crosses high to low strings');
assert.ok(cut.every(n=>n.stopAt>4.12&&n.stopAt<4.15),'One cut mutes the entire chord together, after its playable gate');
assert.ok(Math.max(...cut.map(n=>n.stopAt))-Math.min(...cut.map(n=>n.stopAt))<1e-8,'Fretting release is common to every string');
band.guitar.releaseAll();start=made.length;
band.guitar.triggerAttackRelease([48,55,60],.12,4,.8,{technique:'palm',sweep:.003});
const muted=made.slice(start).filter(n=>Number.isFinite(n.startAt));
assert.ok(muted[0].buffer===buffers.get('palm:49')&&muted[2].buffer===buffers.get('palm:61'),'Palm technique really uses loss-model buffers, rather than just turning down open strings');
assert.ok(muted.every(n=>n.stopAt<4.2));
assert.deepEqual(band.snapshot().guitarStrokes,{open:1,palm:1,cut:1,up:1,down:2});
band.guitar.releaseAll();
for(let i=0;i<150;i++)band.guitar.triggerAttackRelease(48,.2,3,.8);
assert.equal(band.snapshot().pending,128);assert.ok(band.snapshot().dropped>0);
band.dispose();band.dispose();assert.equal(band.snapshot().pending,0);assert.ok(made.every(n=>n.disconnected));
const sendsRemoved=[];
const withRoom=createPhysicalBand(context,{buffers,bytes:bank.bytes},{guitar:{},bass:{},drums:{},voice:{},room:{}},{connect:(s,t)=>s.connect?.(t),disconnect:(bus,send)=>sendsRemoved.push([bus,send]),seconds:Number,midi:Number});
assert.equal(withRoom.snapshot().roomNodes,26);withRoom.setRoom(0);assert.equal(withRoom.snapshot().roomWet,0);
withRoom.releaseAll();assert.equal(sendsRemoved.length,4);assert.equal(withRoom.snapshot().pending,0);
withRoom.dispose();assert.equal(sendsRemoved.length,8);assert.ok(made.every(n=>n.disconnected),'STOP disconnects every owned room node and send');
console.log(`Physical instruments PASS: 52 finite/DC-free buffers, measured tuning, fractional playback rates, ${bank.bytes} bytes, natural sustain, chord grouping, bass damping, future-note cancellation and owned-room disposal`);


let workers=0, terminated=0;
globalThis.Worker=class {
 constructor(){workers++;} postMessage(){} terminate(){terminated++;}
};
const abort=new AbortController(), preparing=prepareInstrumentBank({}, {signal:abort.signal});
abort.abort();await assert.rejects(preparing,/cancelled/);assert.equal(workers,1);assert.equal(terminated,1);
await assert.rejects(prepareInstrumentBank({}, {signal:abort.signal}),/cancelled/);assert.equal(workers,1);
delete globalThis.Worker;
console.log('Physical bank cancellation PASS: terminate in-flight Worker and reject pre-aborted preparation without allocation');
