import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/machine-rack/link.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
function rig() {
  const node=()=>({connections:[],events:[],gain:{value:0,setValueAtTime(v,t){this.value=v;},setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}},
    threshold:{value:0},ratio:{value:0},connect(n){this.connections.push(n);},disconnect(){this.connections=[];}});
  const ctx={currentTime:1,closed:false,createDynamicsCompressor:node,close(){this.closed=true;}};
  class Voice {constructor(ctx,out){this.ctx=ctx;this.output=out;this.samples={};this.customSamples=new Map();} initVoices(){} refreshCustomSamples(){} }
  const ticks=[];let initGate;
  const audio={ctx:null,instruments:new Map(),isPlaying:false,swing:50,tempo:125,
    stopInternal(){this.isPlaying=false;},
    async init(){if(initGate)await initGate;if(!this.isInitialized){this.analyser=node();this.outputGain=node();this.master=node();this.instruments.set('tr909',new Voice(this.ctx,this.master));this.isInitialized=true;}},
    handleTick(t){ticks.push(t);},
  };
  const ui={updateTempoUI(){},refreshParamCache(){}};
  const data={mode:'pattern',customSampleMap:{bd:'custom'},currentPatternId:0};
  const context=vm.createContext({TB303:Voice,TR909:Voice,document:{dispatchEvent(){}},Event});
  const create=vm.runInContext(source+';createMachineLink;',context);
  const link=create({audio,ui,data});
  const host={play(){},stop(){}};
  link.connect(host);
  return {link,audio,ctx,ticks,data,host,ui,hold(){let resolve;initGate=new Promise(r=>resolve=r);return resolve;}};
}
test('link reuses the parent context, schedules only supplied steps and renews bus after Stop',async()=>{
  const r=rig();assert.equal(r.audio.ctx,null,'connection alone cannot open audio');
  await r.link.prepare(r.ctx);
  assert.equal(r.audio.ctx,r.ctx);assert.equal(r.audio.isPlaying,true);
  r.link.tick(2,0,.5);assert.equal(r.audio.tempo,120);assert.deepEqual({...r.ticks[0]},{time:2,step:0});
  const oldBus=r.audio.master;
  r.link.setLevel(.3);assert.equal(r.audio.outputGain.gain.value,.24);
  r.link.stop();r.link.tick(3,1,.5);assert.equal(r.ticks.length,1);
  assert.equal(r.audio.outputGain.gain.value,0);assert.equal(oldBus.connections.length,0);
  await r.link.prepare(r.ctx);assert.notEqual(r.audio.master,oldBus);
  await r.link.disconnect();assert.equal(r.ctx.closed,false,'the machine cannot close Strudel audio');
  assert.equal(r.audio.externalTransport,null);assert.equal(r.audio.ctx,null);
});
test('Stop during asynchronous initialization cannot start a delayed machine',async()=>{
  const r=rig(),release=r.hold();const preparing=r.link.prepare(r.ctx);
  await Promise.resolve();r.link.stop();release();
  assert.equal(await preparing,false);assert.equal(r.audio.isPlaying,false);
  r.link.tick(2,0,.5);assert.equal(r.ticks.length,0);
  await r.link.prepare(r.ctx);assert.equal(r.audio.isPlaying,true);
  await r.link.disconnect();
});
test('vocal transport uses native command cancellation and preserves the current score',async()=>{
  const r=rig();await r.link.disconnect();const score=r.data;
  let restart,stops=0,finish;
  r.audio.play=value=>{restart=value;return new Promise(resolve=>{finish=resolve;});};
  r.audio.stop=()=>{stops++;};
  const starting=r.link.playCurrent();r.link.stopCurrent();finish();await starting;
  assert.equal(restart,false,'already-playing native audio must not restart the bar');
  assert.equal(stops,1);assert.equal(r.data,score);assert.equal(r.audio.externalTransport,null);
});
test('moving from standalone closes only its own old context and retains the score',async()=>{
  const r=rig(),old={...r.ctx};r.audio.ctx=old;const data=r.data;
  await r.link.prepare(r.ctx);assert.equal(old.closed,true);assert.equal(r.ctx.closed,false);
  assert.equal(r.data,data);assert.equal(r.audio.instruments.get('tr909').customSampleMap.bd,'custom');
  await r.link.disconnect();
});

test('native tempo UI emits input without recursive updates; a quick reconnect survives old teardown',async()=>{
  const r=rig();await r.link.prepare(r.ctx);
  // Reconnect while the asynchronous disconnect is at its cleanup boundary.
  const closing=r.link.disconnect();r.link.connect(r.host);await closing;
  assert.ok(r.audio.externalTransport);
  let refreshes=0;
  r.ui.updateTempoUI=()=>{assert.ok(++refreshes<4);r.audio.externalTransport.tempo(Math.round(r.audio.tempo));};
  await r.link.prepare(r.ctx);r.link.tick(3,0,.4);assert.equal(r.audio.tempo,96);
  assert.equal(refreshes,1);
  r.audio.externalTransport.tempo(96);assert.equal(r.audio.tempo,96);
  r.link.tick(4,1,125/240);assert.equal(r.audio.tempo,125);
  r.link.tick(5,2,125.5/240);assert.equal(r.audio.tempo,125.5);
  assert.equal(refreshes,3);
  await r.link.disconnect();
});
