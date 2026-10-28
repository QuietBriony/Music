import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validate,dice,stepsForBar,chordAt,voiceSteps,voiceParams,PARTS,validatePerformanceContext} from '../audio/acid-live-state.mjs';
import {createAcidLive} from '../audio/acid-live.mjs';
import {drumDice,drumPreset} from '../audio/acid-live-drums.mjs';
import {sceneAt,effective303,drumPattern} from '../audio/acid-live-scenes.mjs';
import {createLiveEffects} from '../audio/acid-live-fx.mjs';
import {VERSIONS,makeVersion,versionScene} from '../audio/human-fly-versions.mjs';

const initial=defaults();assert.deepEqual(validate(initial),initial);
const works=VERSIONS.map(v=>makeVersion(v.id,defaults()));
assert.equal(new Set(works.map(v=>JSON.stringify(v))).size,3,'Three versions must be different configurations');
for(const [i,v]of works.entries()){
 assert.deepEqual(validate(v.state),v.state);assert.deepEqual(validatePerformanceContext(v.context),v.context);
 assert.deepEqual(makeVersion(VERSIONS[i].id,defaults()),v,'Finished version is deterministic');
 const a=v.state.arrangement;
 assert.equal(sceneAt(a,64).phase,64,'Finished form must not loop at 64 bars');
 assert.equal(sceneAt(a,96).phase,96);assert.equal(sceneAt(a,118).bass,0);assert.equal(sceneAt(a,118).reply,0);
 assert.equal(sceneAt(a,118).kick,0);assert.equal(sceneAt(a,118).hat,0);
 const fixed=structuredClone(v.state);fixed.parts.bass.locked=true;
 assert.deepEqual(stepsForBar(fixed,'bass',3),fixed.parts.bass.steps);
 assert.deepEqual(dice(fixed,'bass',()=>.9),fixed);
}
assert.equal(works[0].context.mastering,'dub');assert.equal(works[0].context.enabled.bass,true);assert.equal(works[0].state.drums.enabled,false);
assert.equal(works[1].context.mastering,'blend');assert.equal(works[1].context.enabled.drums,false);assert.equal(works[1].state.drums.parts.kick.enabled,true);
assert.equal(works[2].context.enabled.drums,true);assert.equal(works[2].state.drums.parts.kick.enabled,false);
assert.equal(versionScene('acid-drive',90).kick,0);assert.equal(versionScene('acid-drive',96).kick,1);
assert.ok(versionScene('acid-drive',96).reply>versionScene('acid-drive',56).reply);
assert.throws(()=>validate({...initial,arrangement:{...initial.arrangement,work:'unknown'}}));
assert.throws(()=>validate({...initial,arrangement:{...initial.arrangement,gain:4.1}}));
const oldV2=structuredClone(initial);delete oldV2.arrangement.work;delete oldV2.arrangement.gain;
assert.deepEqual(validate(oldV2),initial,'v442 saved mixes retain unity gain and their original sound');
const legacy=structuredClone(initial);legacy.version=1;delete legacy.drums;delete legacy.arrangement;delete legacy.fx;
for(const p of PARTS)delete legacy.parts[p].enabled;
const migrated=validate(legacy);assert.equal(migrated.drums.enabled,false);assert.equal(migrated.arrangement.scene,'keep');
assert.deepEqual(migrated.parts.bass.steps,legacy.parts.bass.steps);
assert.equal(validatePerformanceContext(null),null);
const snapshot={tempo:100,position:53,instruments:true,mastering:'blend',levels:{vocals:80,drums:40,bass:20,other:75},enabled:{vocals:true,drums:false,bass:false,other:true}};
assert.deepEqual(validatePerformanceContext(snapshot),snapshot);
assert.throws(()=>validatePerformanceContext({...snapshot,levels:{...snapshot.levels,vocals:Infinity}}));
const set=defaults();set.drums.enabled=true;set.arrangement.auto=true;
assert.deepEqual([0,8,24,32,48,56,64].map(bar=>sceneAt(set.arrangement,bar).id),['space','groove','build','peak','space','peak','space']);
assert.deepEqual(drumDice(set.drums,'kick',()=>.9),set.drums,'Pinned kick survives dice');
const hat=drumDice(set.drums,'hat',()=>.9);assert.notDeepEqual(hat.parts.hat.steps,set.drums.parts.hat.steps);assert.equal(hat.parts.hat.volume,set.drums.parts.hat.volume);
const rise=[24,27,31].map(bar=>effective303(set.parts.bass,'bass',sceneAt(set.arrangement,bar)).cutoff);
assert.ok(rise[0]<rise[1]&&rise[1]<rise[2]);
assert.equal(effective303({...set.parts.reply,locked:true},'reply',sceneAt(set.arrangement,0)).gain,set.parts.reply.volume/100);
assert.equal(effective303(set.parts.reply,'reply',sceneAt(set.arrangement,0)).gain,0);
const beforeFill=structuredClone(set.drums);
assert.equal(drumPattern(set.drums,'snare',31,sceneAt(set.arrangement,31))[15],2);
assert.deepEqual(drumPattern(set.drums,'snare',31,sceneAt(set.arrangement,31),true),set.drums.parts.snare.steps);
assert.deepEqual(set.drums,beforeFill,'Temporary turnaround never mutates the saved motif');
for(const id of ['kick','snare','clap'])assert.ok(drumPreset(id,{tone:50,decay:100}).noise?.decay>drumPreset(id,{tone:50,decay:0}).noise?.decay || drumPreset(id,{tone:50,decay:100}).osc1.a_decay>drumPreset(id,{tone:50,decay:0}).osc1.a_decay);
assert.throws(()=>validate({...set,drums:{...set.drums,parts:{...set.drums.parts,hat:{...set.drums.parts.hat,steps:[1]}}}}));
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
// Drums share the same one-event transport and are disposed on every stop.
let drumsCreated=0,drumsDisposed=0,hits=[],scenes=[];
const extended=createAcidLive({context:ctx,transport,loadFilter:async()=>{},connect(){},onStatus:info=>scenes.push(info.scene.id),drumFactory(){drumsCreated++;return{level(){},trigger:(...x)=>hits.push(x),dispose(){drumsDisposed++;},diagnostics:()=>({hits:hits.length})};}});
await extended.prepare();const percussion=defaults();percussion.drums.enabled=true;for(const p of PARTS)percussion.parts[p].enabled=false;
extended.configure(percussion);extended.start({...anchor,at:ctx.currentTime+.2});for(let i=0;i<32;i++)tick();
assert.deepEqual([...new Set(hits.map(x=>x[0]))].sort(),['clap','hat','kick','open','snare']);assert.equal(events.size,1);
percussion.arrangement.auto=true;extended.configure(percussion);
const kicks=hits.filter(x=>x[0]==='kick').length;for(let i=0;i<1024;i++)tick();
assert.deepEqual([...new Set(scenes)].sort(),['build','groove','keep','peak','space']);
assert.equal(hits.filter(x=>x[0]==='kick').length-kicks,256,'Pinned quarter-note kick survives a full 64-bar arc');
assert.equal(events.size,1);
extended.retime({...anchor,at:ctx.currentTime+.1,offset:5,rate:1.2});assert.equal(drumsCreated,1);extended.stop();assert.equal(drumsDisposed,1);assert.equal(events.size,0);
// Finite post-fader throws: two bounded buses, no source/timer ownership.
const taps=new Map(),exits=[];let unplugged=0;
const fx=createLiveEffects({context:ctx,tap:(p,n,onMute)=>{taps.set(p,{n,onMute});return()=>{taps.delete(p);unplugged++;};},connect:n=>exits.push(n)});
fx.throw('vocals',117.45);fx.throw('other',117.45);for(let i=0;i<40;i++)fx.throw('vocals',117.45);
assert.equal(fx.diagnostics().buses,2);assert.equal(fx.diagnostics().nodes,16);assert.equal(fx.diagnostics().feedbackLimit,.38);
taps.get('vocals').onMute();assert.equal(fx.diagnostics().buses,1);assert.equal(exits[0].links.length,0);
fx.configure({echo:0,tone:42});assert.equal(fx.diagnostics().buses,0);assert.equal(unplugged,2);
fx.throw('vocals',117.45);assert.equal(fx.diagnostics().buses,0);assert.throws(()=>fx.throw('bass',120));
fx.configure({echo:35,tone:42});fx.throw('other',120);fx.stop();assert.equal(fx.diagnostics().nodes,0);
const html=readFileSync('band-room.html','utf8'),source=readFileSync('band-room.js','utf8');
assert.match(html,/br-acid-live[\s\S]*Dub／Acidを聴く/);
assert.match(source,/function stopStemPlayback\(\)\s*\{\s*stopAcidLive\(\)/);
assert.match(source,/state.started && acidLiveEnabled\) syncAcidLivePlayback\(true\)/);
console.log('Acid LIVE: v1 migration, scene arc, pinned motifs, temporary fills, five drums, finite echoes, common clock and Stop isolation passed');
