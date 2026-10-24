import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

// Exercise timeline and native-graph ownership without Tone, media or a GPU.
let clock=0, nodes=[],timers=new Map(),serial=0;
class Param {
  constructor(value=0){this.value=value;this.events=[];}
  cancelScheduledValues(time){this.events=this.events.filter(e=>e[0]<time);}
  setValueAtTime(value,time){assert.ok(Number.isFinite(value)&&time>=clock);this.events.push([time,value]);}
  linearRampToValueAtTime(value,time){this.setValueAtTime(value,time);}
}
class Node {
  constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.delayTime=new Param();this.pan=new Param();this.playbackRate=new Param(1);this.links=[];nodes.push(this);}
  connect(to){this.links.push(to);return to;}
  disconnect(to){this.links=to?this.links.filter(n=>n!==to):[];}
  start(at,offset){this.started={at,offset};assert.ok(at>=clock);}
  stop(at){this.stopped=at;}
}
let allocations=0;
const context={get currentTime(){return clock;},state:'running',createGain:()=>new Node(),createBiquadFilter:()=>new Node(),createStereoPanner:()=>new Node(),createDelay:max=>{assert.ok(max<=1.2);return new Node();},createBufferSource:()=>new Node(),createBuffer:(channels,length,sampleRate)=>{allocations++;const data=Array.from({length:channels},()=>new Float32Array(length));return{length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:i=>data[i]};}};
const sb={console,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
vm.createContext(sb);
for(const f of ['audio/dub-arrangement.js','audio/dub-mix.js','audio/stem-live-mix.js'])vm.runInContext(readFileSync(f,'utf8'),sb);
const dub=sb.RecordedDubMix, opts={bpm:117.45,duration:239.491,rate:1,offset:0,at:0};
const arr=sb.RecordedDubArrangement,plan=dub.plan(opts.bpm,opts.duration),bar=240/opts.bpm;
const scene=arr.build(opts.bpm,opts.duration);
assert.equal(scene.scenes.length,5);assert.equal(scene.loops.length,8);
assert.deepEqual(Object.keys(plan).sort(),['bass','drums','other','vocals']);
assert.equal(dub.valueAt(plan.drums.dry,30),0,'Opening drops the drums');
assert.equal(dub.valueAt(plan.bass.source,30),0,'Loop replaces the continuing source');
assert.equal(dub.valueAt(plan.bass.dry,30),1,'Bass loop keeps its direct body');
assert.equal(dub.valueAt(plan.other.dry,30),.76,'Guitar loop is audible at normal Dub level');
for(const part of Object.keys(plan))assert.equal(dub.valueAt(plan[part].dry,32),0,'Echo-only moment removes all direct parts');
assert.equal(dub.valueAt(plan.drums.dry,33),1,'Band returns on the original time line');
assert.equal(dub.valueAt(plan.bass.dry,128),0,'Middle guitar/drum scene drops the bass');
assert.equal(dub.valueAt(plan.drums.dry,128),1,'Middle scene retains the original drummer');
assert.equal(dub.valueAt(plan.drums.source,169),0,'Later drum loop replaces the original performance');
assert.equal(dub.valueAt(arr.echoGate(opts.bpm,opts.duration),228.5),0,'Final pause mutes the last echoes');
for(const part of Object.keys(plan))assert.equal(dub.valueAt(plan[part].dry,228.5),0);
for(const part of Object.keys(plan))assert.equal(dub.valueAt(plan[part].dry,scene.scenes.at(-1).back-.08),0,'Every part stays out through the final beat; no early vocal pickup');
assert.equal(dub.valueAt(plan.drums.dry,229),1);
for(const p of ['vocals','other'])for(const sec of [5,20,40,80,180,210])assert.equal(dub.valueAt(plan[p].send,sec),0);
for(const p of Object.values(plan))for(const points of Object.values(p))for(let i=1;i<points.length;i++)assert.ok(points[i][0]>points[i-1][0]);
const raw=new Float32Array(8000*240);for(let i=0;i<raw.length;i++)raw[i]=.2*Math.sin(i*.071)+.1*Math.sin(i*.117);
const originalDataHash=createHash('sha256').update(new Uint8Array(raw.buffer)).digest('hex');
const buffer={length:raw.length,sampleRate:8000,numberOfChannels:1,duration:240,getChannelData:()=>raw};
const buffers=Object.fromEntries(['vocals','drums','bass','other'].map(p=>[p,{...buffer}]));
for(const bad of [{bpm:0},{rate:0},{offset:-1},{duration:Infinity},{at:NaN},{rate:2}])assert.throws(()=>dub.validate({...opts,...bad}));
const mix=sb.RecordedStemMix.create(context),baseNodes=nodes.length;
assert.equal(mix.diagnostics().dub,null,'No lazy echo nodes before selection');
assert.throws(()=>mix.startDub({...opts,bpm:NaN},buffers));assert.equal(nodes.length,baseNodes);
for(const rate of [.5,.8,1,1.2,1.5]){
  clock=2;mix.startDub({...opts,at:2,offset:30,rate},buffers);
  const d=mix.diagnostics().dub;assert.equal(d.nodes,60);assert.equal(d.lastEchoSeconds,240/(117.45*rate));
  assert.equal(d.revision,3);assert.equal(d.loops.jobs.length,8);assert.ok(d.loops.bytes<600000);assert.equal(d.echoBeats.vocals,.75);assert.equal(d.echoBeats.other,1);
  assert.ok(timers.size<=1,'Only one retiring graph');
  for(const j of d.loops.jobs){assert.ok(j.at>=clock);assert.ok(j.stopAt>j.at);assert.ok(Math.abs(j.stopAt-(2+(j.end-30)/rate))<1e-8);if(j.start<30)assert.ok(Math.abs(j.phase-(30-j.start)%j.cycleSeconds)<1e-8);}
  const direct=nodes.filter(n=>n.gain.events.some(e=>e[1]===.82));
  assert.ok(direct.some(n=>n.gain.events.some(e=>Math.abs(e[0]-2.04)<1e-9&&e[1]===0)),'Seeking inside a break restores its silence');
}
const first=mix.diagnostics().dub.settings;
clock=3;mix.setDubMuted('vocals',true);
assert.ok(mix.diagnostics().dub.settings.offset>first.offset,'A mute flush preserves the source position');
mix.setDubMuted('vocals',false);mix.setDubMuted('bass',true);mix.setDubMuted('drums',true);mix.setDubMuted('other',true);mix.setLevel('other',0);mix.setLevel('other',.8);
assert.equal(allocations,8,'Rate changes/mutes reuse only the short loop copies');
for(const n of nodes.filter(n=>n.buffer)){assert.ok(n.buffer.duration<1.1);assert.ok(n.buffer.getChannelData(0)[0]===0);assert.ok(n.buffer.getChannelData(0).at(-1)===0);}
assert.ok(timers.size<=1);
mix.stopDub();assert.equal(mix.diagnostics().dub,null);
for(const fn of [...timers.values()])fn();
assert.equal(nodes.slice(baseNodes+8).filter(n=>n.links.length).length,0,'All retired echo connections destroyed');
for(const n of nodes.slice(baseNodes,baseNodes+8)) {
  assert.equal(n.gain.events.at(-1)[1],1,'The eight source and direct routes return to unity');
  assert.ok(n.gain.events.every(e=>e[0]<=clock+.04),'No future dry drops after Stop');
}
assert.ok(Object.values(mix.inputs).every(n=>n.links.length),'Dry stem graph remains connected');
mix.dispose();assert.equal(nodes.filter(n=>n.links.length).length,0,'Dispose owns every connection');
delete context.createStereoPanner;
const fallback=sb.RecordedStemMix.create(context);fallback.startDub({...opts,at:clock,offset:30},buffers);
assert.equal(fallback.diagnostics().dub.nodes,60,'A missing stereo panner uses a bounded centered route');
fallback.dispose();assert.equal(nodes.filter(n=>n.links.length).length,0);
const evidence=JSON.parse(readFileSync('docs/human-fly-dub-cues-20261024.json','utf8'));
for(const [part,hash]of Object.entries(evidence.source_sha256))assert.equal(createHash('sha256').update(readFileSync(`presets/tabasco-stems/human-fly/${part}.mp3`)).digest('hex'),hash);
const cueRows=JSON.parse(readFileSync('audio/dub-mix.js','utf8').match(/const CUES = (.*);/)[1]);
assert.deepEqual(cueRows,evidence.cues.map(c=>[c.vocal?.end??null,c.vocal?.return??null,c.guitar.attack,c.guitar.return]));
for(const c of evidence.cues){if(c.vocal){assert.ok(c.vocal.pre_db>=-22&&c.vocal.drop_db>=18);assert.ok(c.vocal.return>c.vocal.end+.5);}assert.ok(c.guitar.return>c.guitar.attack+.7);}
const app=readFileSync('band-room.js','utf8'),html=readFileSync('band-room.html','utf8'),sw=readFileSync('sw.js','utf8');
assert.match(app,/const startAt = Tone.now\(\) \+ 0.15/);
assert.match(app,/stemPlaybackAnchor = \{ at: startAt, offset: offsetSec, rate: tempoMult \}/);
assert.match(app,/currentBandId === "tabasco" && state.currentSongId === "human-fly"/);
assert.match(app,/originalMastering === "dub" && loaded !== 4/);
for(const s of [html,sw])assert.ok(s.includes('audio/dub-mix.js?v=3'));
assert.ok(html.includes('id="br-dub-compare"'));
assert.throws(()=>arr.validateBuffers({...buffers,bass:null},opts));
for(const [part,b]of Object.entries(buffers))assert.equal(b.getChannelData(0),raw,'Original decoded audio is never altered');
assert.equal(createHash('sha256').update(new Uint8Array(raw.buffer)).digest('hex'),originalDataHash,'Preparing loops must not taper or overwrite the original recording');
console.log('Human Fly Dub DJ: loop phase, finite jobs, source replacement, echo-only pause, original restoration, mute cleanup; Human Fly Dub: source-time breaks, seek/rate alignment, finite echo ownership, mute/fader flush and lazy allocation passed');
