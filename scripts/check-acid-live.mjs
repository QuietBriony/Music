import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validate,dice,stepsForBar,chordAt,voiceSteps,voiceParams,PARTS} from '../audio/acid-live-state.mjs';
import {createAcidLive} from '../audio/acid-live.mjs';

const initial=defaults();assert.deepEqual(validate(initial),initial);
assert.throws(()=>validate({...initial,parts:{...initial.parts,bass:{...initial.parts.bass,reso:15}}}));
assert.throws(()=>validate({...initial,parts:{...initial.parts,bass:{...initial.parts.bass,steps:[]}}}));
const pinned=defaults();pinned.parts.bass.locked=true;pinned.auto=true;
assert.deepEqual(dice(pinned,'bass',()=>.8),pinned);
assert.deepEqual(dice(initial,'reply',()=>.8).parts.bass,initial.parts.bass);
for(const part of PARTS)for(let bar=0;bar<64;bar++){
 const steps=stepsForBar(pinned,part,bar);
 assert.equal(steps.filter(s=>s.active).length,pinned.parts[part].steps.filter(s=>s.active).length);
 assert.deepEqual(steps.map(s=>s.n),pinned.parts[part].steps.map(s=>s.n));
 if(part==='bass')assert.deepEqual(steps,pinned.parts.bass.steps);
}
const auto=defaults();auto.auto=true;
assert.notDeepEqual(stepsForBar(auto,'bass',8),auto.parts.bass.steps);
assert.deepEqual(stepsForBar(auto,'bass',16),auto.parts.bass.steps);
const song=JSON.parse(readFileSync('presets/drum-frames-tabasco-human-fly.json','utf8'));
assert.equal(chordAt(song,0),'G');assert.equal(chordAt(song,2),'F');
assert.equal(voiceSteps(initial.parts.bass.steps,'bass','G')[0].note,'G');
assert.equal(voiceSteps(initial.parts.bass.steps,'bass','Bb')[0].note,'A#');
assert.ok(Math.abs(voiceParams(initial.parts.bass,1.2).tune-1200*Math.log2(1.2))<1e-9);

class Param {
 constructor(){this.value=0;this.events=[];}
 cancelScheduledValues(t){this.events=this.events.filter(e=>e[0]<t);}
 setValueAtTime(v,t){this.value=v;this.events.push([t,v]);}
 setTargetAtTime(v,t){this.value=v;this.events.push([t,v]);}
 exponentialRampToValueAtTime(v,t){this.setValueAtTime(v,t);}
 linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);}
}
const nodes=[];
class Node {
 constructor(){this.links=[];for(const k of ['gain','frequency','Q','delayTime'])this[k]=new Param();nodes.push(this);}
 connect(n){this.links.push(n);return n;}
 disconnect(){this.links=[];}
 start(t){this.starts=[t];} stop(t){this.stops=[t];}
}
const ctx={sampleRate:48000,currentTime:0,state:'running',createGain:()=>new Node(),createDelay:()=>new Node(),createOscillator:()=>new Node(),createBiquadFilter:()=>new Node()};
const events=new Map();let id=0,load=0,peak=0,outputs=[],feedback=[];
const transport={getTicksAtTime:time=>time*384,scheduleOnce(fn,ticks){assert.match(ticks,/^\d+i$/,'Tone 14 only parses integer tick strings');events.set(++id,{fn,at:Number(ticks.slice(0,-1))/384});peak=Math.max(peak,events.size);return id;},clear(id){events.delete(id);}};
const engine=createAcidLive({context:ctx,transport,loadFilter:async()=>load++,createFilter:()=>{const n=new Node();n.parameters=new Map([['cutoff',new Param()],['resonance',new Param()]]);return n;},connect:n=>{outputs.push(n);n.connect({});},onStatus:x=>feedback.push(x)});
await Promise.all([engine.prepare(),engine.prepare()]);await engine.prepare();assert.equal(load,1,'Rapid enable/START shares a single filter preparation');
engine.configure(initial);
const anchor={at:.2,offset:0,bpm:117.45,rate:1,duration:239.491,song};
function tick(){const [key,e]=[...events][0];events.delete(key);ctx.currentTime=Math.max(ctx.currentTime,e.at-.04);e.fn();return e.at;}
engine.start(anchor);
for(let i=0;i<300;i++){const at=tick();assert.ok(Math.abs(at-(.2+i*15/117.45))<=.5/384+1e-9,'Host wake-up stays within half a tick of the exact recording anchor');}
assert.equal(peak,1);assert.ok(engine.diagnostics().played>200);
const oldOutput=outputs.at(-1);engine.stop();assert.equal(events.size,0);assert.equal(oldOutput.links.length,0);assert.equal(engine.diagnostics().voices,0);
// Capture a callback that escaped cancellation, then restart. It must be inert.
engine.start({...anchor,at:ctx.currentTime+.2,offset:40,rate:1.2});
const stale=[...events.values()][0].fn;engine.stop();
engine.start({...anchor,at:ctx.currentTime+.3,offset:90,rate:.85});const before=engine.diagnostics().played;
stale();assert.equal(engine.diagnostics().played,before);assert.equal(events.size,1);
const first=tick();assert.ok(first>=ctx.currentTime);engine.configure({...initial,auto:true});
const outputCount=outputs.length;engine.retime({...anchor,at:ctx.currentTime+.15,offset:92,rate:1.2});
assert.equal(outputs.length,outputCount,'Dragging tempo reuses the two voices and delay graph');
assert.equal(events.size,1);
ctx.currentTime+=4;tick();assert.equal(events.size,1,'Blocked UI skips ahead without scheduling a burst');
engine.stop();assert.ok(outputs.every(n=>n.links.length===0));
const fallback=createAcidLive({context:ctx,transport,loadFilter:async()=>{throw Error('No worklet');},connect(){}});
await fallback.prepare();assert.equal(fallback.diagnostics().fallback,true);fallback.dispose();
assert.throws(()=>engine.start({...anchor,at:ctx.currentTime+.1,rate:NaN}));
assert.equal(events.size,0);
const html=readFileSync('band-room.html','utf8'),source=readFileSync('band-room.js','utf8');
assert.match(html,/br-acid-live[\s\S]*303で遊ぶ/);
assert.match(source,/function stopStemPlayback\(\)\s*\{\s*stopAcidLive\(\)/);
assert.match(source,/state.started && acidLiveEnabled\) syncAcidLivePlayback\(true\)/);
console.log('Acid LIVE: fixed motifs, bounded AUTO, same recording anchor, detune, one owned event, stale-callback/Stop isolation passed');
