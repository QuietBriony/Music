import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

let clock=0,nodes=[],timers=new Map(),serial=0,allocations=0;
class Param{
  constructor(value=0){this.value=value;this.events=[];}
  cancelScheduledValues(t){this.events=this.events.filter(e=>e[0]<t);}
  setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&t>=clock);this.events.push([t,v]);}
  linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);}
}
class Node{
  constructor(){for(const p of ['gain','frequency','Q','delayTime','pan','playbackRate'])this[p]=new Param();this.links=[];nodes.push(this);}
  connect(to){this.links.push(to);return to;}
  disconnect(to){this.links=to?this.links.filter(n=>n!==to):[];}
  start(at,offset){this.started={at,offset};assert.ok(at>=clock);}
  stop(at){this.stopped=at;}
}
const context={sampleRate:48000,get currentTime(){return clock;},state:'running',createGain:()=>new Node(),createBiquadFilter:()=>new Node(),createStereoPanner:()=>new Node(),createConvolver(){const n=new Node(),sr=this.sampleRate;let buffer=null;Object.defineProperty(n,'buffer',{get:()=>buffer,set:b=>{if(b!==null)assert.equal(b.sampleRate,sr,'Convolver IR must use its context rate');buffer=b;}});return n;},createWaveShaper:()=>new Node(),createDelay:max=>{assert.ok(max<=1.2);return new Node();},createBufferSource:()=>new Node(),createBuffer:(channels,length,sampleRate)=>{allocations++;const data=Array.from({length:channels},()=>new Float32Array(length));return{length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:i=>data[i]};}};
const sb={console,Float32Array,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};vm.createContext(sb);
for(const f of ['audio/dub-arrangement.js','audio/dub-mix.js','audio/stem-live-mix.js'])vm.runInContext(readFileSync(f,'utf8'),sb);
const dub=sb.RecordedDubMix,arr=sb.RecordedDubArrangement,opts={bpm:117.45,duration:239.491,rate:1,offset:0,at:0};
const plan=dub.plan(opts.bpm,opts.duration),form=arr.build(opts.bpm,opts.duration),value=dub.valueAt;
assert.equal(form.scenes.length,9);assert.equal(form.loops.length,2);
for(let t=0;t<opts.duration;t+=.071){
  assert.equal(value(plan.drums.dry,t),1,'The drummer is never stopped by the arrangement');
  assert.equal(value(plan.bass.dry,t),1.08,'Bass body remains under the version');
  assert.equal(value(plan.other.source,t),1);assert.equal(value(plan.vocals.source,t),1);
}
for(const j of form.loops){assert.equal(j.part==='bass'||j.part==='drums',true);assert.equal(j.cycle,8*60/opts.bpm);assert.equal(j.end-j.start,4*j.cycle);assert.equal(value(plan[j.part].source,j.start+.1),0);assert.equal(value(plan[j.part].source,j.end+.01),1);}
assert.ok(value(plan.other.dry,60)<.2&&value(plan.vocals.dry,70)<.2,'Rhythm sections leave musical space');
assert.ok(value(plan.vocals.dry,59.7)>.7,'Selected vocal fragments return over the rhythm');
for(const p of ['vocals','other','drums']){
  assert.ok(plan[p].send.some(x=>x[1]>.5));
  assert.ok(plan[p].feedback.every(x=>x[1]>=0&&x[1]<=.685));
  assert.ok(plan[p].pan.every(x=>Math.abs(x[1])<=.4));
}
for(const c of Object.values(plan))for(const points of Object.values(c))for(let i=1;i<points.length;i++)assert.ok(points[i][0]>points[i-1][0]);
const raw=new Float32Array(8000*240);for(let i=0;i<raw.length;i++)raw[i]=.2*Math.sin(i*.071)+.1*Math.sin(i*.117);
const hash=()=>createHash('sha256').update(new Uint8Array(raw.buffer)).digest('hex'),originalHash=hash();
const buffer={length:raw.length,sampleRate:8000,numberOfChannels:1,duration:240,getChannelData:()=>raw},buffers=Object.fromEntries(['vocals','drums','bass','other'].map(p=>[p,{...buffer}]));
for(const bad of [{bpm:0},{rate:0},{offset:-1},{duration:Infinity},{at:NaN},{rate:2}])assert.throws(()=>dub.validate({...opts,...bad}));
const mix=sb.RecordedStemMix.create(context);assert.equal(nodes.length,34);assert.equal(mix.diagnostics().dub,null);
assert.throws(()=>mix.startDub({...opts,bpm:NaN},buffers));assert.equal(nodes.length,34);
for(const rate of [.5,.8,1,1.2,1.5]){
  clock=2;mix.startDub({...opts,at:clock,offset:118,rate},buffers);const d=mix.diagnostics().dub;
  assert.equal(d.revision,4);assert.equal(d.nodes,36);assert.equal(mix.diagnostics().nodes,54);assert.equal(d.springBytes,422400);assert.equal(d.loops.jobs.length,2);assert.ok(d.loops.bytes<300000);
  assert.equal(d.echoBeats.other,.75);assert.equal(d.echoBeats.vocals,1);assert.equal(d.echoBeats.drums,.75);assert.ok(d.lastEchoSeconds>8/rate);
  for(const j of d.loops.jobs){assert.ok(j.at>=clock&&j.stopAt>j.at);assert.ok(Math.abs(j.stopAt-(clock+(j.end-118)/rate))<1e-8);assert.ok(Math.abs(j.phase-(118-j.start)%j.cycleSeconds)<1e-8);}
  assert.ok(timers.size<=1);
}
for(const shape of nodes.filter(n=>n.curve)){
  const c=shape.curve;for(let i=1;i<c.length;i++)assert.ok((c[i]-c[i-1])*(c.length-1)/2<=1.0001,'Tape differential gain must not exceed unity');
}
for(const n of nodes.filter(n=>n.type==='lowpass'&&n.Q.value===.5))assert.ok(n.frequency.events.every(e=>e[1]>0&&e[1]<=context.sampleRate*.45));
const first=mix.diagnostics().dub.settings;clock=3;mix.setDubMuted('vocals',true);assert.ok(mix.diagnostics().dub.settings.offset>first.offset);
for(const p of ['vocals','bass','drums','other']){mix.setDubMuted(p,true);mix.setDubMuted(p,false);mix.setLevel(p,0);mix.setLevel(p,.8);}
assert.equal(allocations,3,'Only two short rhythm copies and one cached reverb IR');assert.equal(hash(),originalHash);
mix.stopDub();assert.equal(mix.diagnostics().dub,null);for(const fn of [...timers.values()])fn();
assert.ok(Object.values(mix.inputs).every(n=>n.links.length));
// Every future source/filter/dry automation is cancelled on a normal return.
for(const n of nodes.slice(34,54))for(const param of [n.gain,n.frequency])assert.ok(param.events.every(e=>e[0]<=clock+.04));
mix.dispose();assert.equal(nodes.filter(n=>n.links.length).length,0);
delete context.createStereoPanner;const fallback=sb.RecordedStemMix.create(context);fallback.startDub({...opts,at:clock,offset:118},buffers);assert.equal(fallback.diagnostics().dub.nodes,36);fallback.dispose();assert.equal(nodes.filter(n=>n.links.length).length,0);
const c44={...context,sampleRate:44100},mix44=sb.RecordedStemMix.create(c44);mix44.startDub({...opts,at:clock,offset:118},buffers);assert.equal(mix44.diagnostics().dub.springBytes,388080);mix44.dispose();
const failed=sb.RecordedStemMix.create({...context,createConvolver(){throw Error('Unavailable convolver');}});assert.throws(()=>failed.startDub({...opts,at:clock,offset:118},buffers));failed.dispose();assert.equal(nodes.filter(n=>n.links.length).length,0,'A constructor failure disconnects every partially built echo loop');
assert.throws(()=>arr.validateBuffers({...buffers,bass:null},opts));
const evidence=JSON.parse(readFileSync('docs/human-fly-dub-console-cues-20261024.json','utf8'));
for(const[p,h]of Object.entries(evidence.source_sha256))assert.equal(createHash('sha256').update(readFileSync(`presets/tabasco-stems/human-fly/${p}.mp3`)).digest('hex'),h);
const arrangement=readFileSync('audio/dub-arrangement.js','utf8');for(const[k,n]of [['VOICES','vocal_ends'],['GUITARS','guitar_attacks'],['SNARES','snare_attacks']])assert.deepEqual(JSON.parse(arrangement.match(new RegExp(`const ${k} = (.*);`))[1]),evidence[n]);
for(const f of ['band-room.html','sw.js'])assert.ok(readFileSync(f,'utf8').includes('audio/dub-mix.js?v=4'));
console.log('Human Fly Dub console: continuous rhythm, source-backed phrase response, bounded damped feedback, 2-bar loop phase, ordinary bypass, mute/seek/rate/Stop ownership passed');
