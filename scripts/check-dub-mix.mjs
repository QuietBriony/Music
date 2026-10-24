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
  constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.delayTime=new Param();this.pan=new Param();this.links=[];nodes.push(this);}
  connect(to){this.links.push(to);return to;}
  disconnect(to){this.links=to?this.links.filter(n=>n!==to):[];}
}
const context={get currentTime(){return clock;},state:'running',createGain:()=>new Node(),createBiquadFilter:()=>new Node(),createStereoPanner:()=>new Node(),createDelay:max=>{assert.ok(max<=1.2);return new Node();}};
const sb={console,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
vm.createContext(sb);
for(const f of ['audio/dub-mix.js','audio/stem-live-mix.js'])vm.runInContext(readFileSync(f,'utf8'),sb);
const dub=sb.RecordedDubMix, opts={bpm:117.45,duration:239.491,rate:1,offset:0,at:0};
const plan=dub.plan(opts.bpm,opts.duration),bar=240/opts.bpm;
assert.deepEqual(Object.keys(plan),['vocals','other']);
assert.equal(plan.vocals.dry.length,25,'Six source-backed vocal exits');
assert.equal(plan.other.dry.length,29,'Seven guitar breaks');
assert.equal(dub.valueAt(plan.vocals.dry,14.5*bar),0);
assert.equal(dub.valueAt(plan.other.dry,30),.06);
assert.equal(dub.valueAt(plan.vocals.send,28.4),.68);
assert.equal(dub.valueAt(plan.vocals.dry,17*bar),.82);
for(const p of ['vocals','other'])for(const sec of [5,20,40,80,180,210])assert.equal(dub.valueAt(plan[p].send,sec),0,'No continuous echo wash between throws');
assert.equal(dub.valueAt(plan.vocals.send,159),0,'Instrumental section must not echo weak vocal bleed');
assert.equal(dub.valueAt(plan.vocals.wet,29.5),1);
assert.equal(dub.valueAt(plan.vocals.wet,32),.6,'Echo returns behind the lead after the break');
for(const p of Object.values(plan))for(const points of Object.values(p))for(let i=1;i<points.length;i++)assert.ok(points[i][0]>points[i-1][0]);
for(const bad of [{bpm:0},{rate:0},{offset:-1},{duration:Infinity},{at:NaN},{rate:2}])assert.throws(()=>dub.validate({...opts,...bad}));
const mix=sb.RecordedStemMix.create(context),baseNodes=nodes.length;
assert.equal(mix.diagnostics().dub,null,'No lazy echo nodes before selection');
assert.throws(()=>mix.startDub({...opts,bpm:NaN}));assert.equal(nodes.length,baseNodes);
for(const rate of [.5,.8,1,1.2,1.5]){
  clock=2;mix.startDub({...opts,at:2,offset:14.5*bar,rate});
  const d=mix.diagnostics().dub;assert.equal(d.nodes,40);assert.equal(d.lastEchoSeconds,240/(117.45*rate));
  assert.equal(d.revision,2);assert.equal(d.echoBeats.vocals,.75);assert.equal(d.echoBeats.other,1);
  assert.ok(timers.size<=1,'Only one retiring graph');
  const direct=nodes.filter(n=>n.gain.events.some(e=>e[1]===.82));
  assert.ok(direct.some(n=>n.gain.events.some(e=>Math.abs(e[0]-2.04)<1e-9&&e[1]===0)),'Seeking inside a break restores its silence');
}
const first=mix.diagnostics().dub.settings;
clock=3;mix.setDubMuted('vocals',true);
assert.ok(mix.diagnostics().dub.settings.offset>first.offset,'A mute flush preserves the source position');
mix.setDubMuted('vocals',false);mix.setLevel('other',0);mix.setLevel('other',.8);
assert.ok(timers.size<=1);
mix.stopDub();assert.equal(mix.diagnostics().dub,null);
for(const fn of [...timers.values()])fn();
assert.equal(nodes.slice(baseNodes+2).filter(n=>n.links.length).length,0,'All retired echo connections destroyed');
for(const n of nodes.slice(baseNodes,baseNodes+2)) {
  assert.equal(n.gain.events.at(-1)[1],1,'The two dry routes return to unity');
  assert.ok(n.gain.events.every(e=>e[0]<=clock+.04),'No future dry drops after Stop');
}
assert.ok(Object.values(mix.inputs).every(n=>n.links.length),'Dry stem graph remains connected');
mix.dispose();assert.equal(nodes.filter(n=>n.links.length).length,0,'Dispose owns every connection');
delete context.createStereoPanner;
const fallback=sb.RecordedStemMix.create(context);fallback.startDub({...opts,at:clock,offset:29});
assert.equal(fallback.diagnostics().dub.nodes,40,'A missing stereo panner uses a bounded centered route');
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
for(const s of [html,sw])assert.ok(s.includes('audio/dub-mix.js?v=2'));
assert.ok(html.includes('id="br-dub-compare"'));
console.log('Human Fly Dub: source-time breaks, seek/rate alignment, finite echo ownership, mute/fader flush and lazy allocation passed');
