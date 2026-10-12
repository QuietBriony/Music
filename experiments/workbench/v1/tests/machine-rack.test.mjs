import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMachineRack, DRUMS, SYNTH_CONTROLS } from '../src/machine-rack/model.js';
import { BinaryFormatEncoder } from '../third_party/acidbros/js/data/BinaryFormatEncoder.js';
import { BinaryFormatDecoder } from '../third_party/acidbros/js/data/BinaryFormatDecoder.js';
import { carryMachine, takeMachine } from '../src/machine-rack/handoff.js';
import { captureMachineState, decodeMachineState, applyMachineState } from '../src/machine-state.js';
import { TR909 } from '../third_party/acidbros/js/audio/TR909.js';
import { createRackAuto } from '../src/machine-rack/auto.js';
import { varyVoice } from '../src/machine-rack/variation.js';

// Exercise the pinned machine's real randomizer and save/apply mappings, with
// native knob/radio DOM substitutes. No audio, browser, storage or network.
function rig() {
  const inputs = new Map(), knobs = {}, radios = {}, saved = new Map();
  const ui = { renderAll(){}, refreshParamCache(){}, updateLockUI(){}, updateSwingUI(){} };
  const audio = { tempo:127, swing:50, instruments:new Map() };
  for (const n of [1,2]) for (const wave of ['saw','sq']) {
    const id=`wave-${wave}-${n}`;
    radios[id]={ get checked(){return radios['selected'+n]===wave;}, set checked(v){if(v)radios['selected'+n]=wave;}, value:wave==='saw'?'sawtooth':'square' };
  }
  const ids=[...['tune','cutoff','reso','env','decay','accent','vol','delayTime','delayFb','delayWet'].flatMap(k=>[k+'303_1',k+'303_2']), ...DRUMS.flatMap(([, , controls])=>controls.map(c=>c[2]))];
  for(const id of ids) {const input={value:0};inputs.set(id+'-input',input);knobs[id]={setValue(v){input.value=String(v);}};}
  let seed=731;const randomMath=Object.create(Math);randomMath.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const context = vm.createContext({ console:{...console,error(...args){throw new Error(args.join(' '));}}, Math:randomMath, Uint8Array, TextEncoder, TextDecoder, btoa, atob,
    UI:ui, AudioEngine:audio, MidiManager:{mappings:[],clearAllMappings(){}}, BinaryFormatEncoder, BinaryFormatDecoder,
    window:{knobInstances:knobs},
    localStorage:{setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k)},
    document:{getElementById:id=>inputs.get(id)||radios[id]||null,querySelector:selector=>radios[`wave-${radios['selected'+selector.match(/303_(\d)/)[1]]}-${selector.match(/303_(\d)/)[1]}`]}
  });
  const source=readFileSync(new URL('../third_party/acidbros/js/data/Data.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export const Data =','const Data =');
  const data=vm.runInContext(source+'\nData;',context);
  data.patterns=Array.from({length:16},()=>data.createEmptyPattern());data.song=[0];
  data.active909Tracks=['bd','sd','ch','oh'];data.applyPatternSettings(0);
  const model=createMachineRack({data,ui,knobs:()=>knobs});
  return {data,model,audio,knobs,inputs,ui};
}
const snapshot = r=>structuredClone(r.data.patterns[r.data.currentPatternId].units);
const volumes = units=>[units.tb303_1.settings.volume,units.tb303_2.settings.volume,...Object.values(units.tr909.tracks).map(t=>t.level)];

test('combined snapshot restores all patterns, fractional tone, mode, locks and drum candidates',()=>{
  const r=rig();r.model.randomize();r.model.set('tb303_2','reso',10.8);r.model.basicDrums();
  r.model.lock('tb303_2');r.model.lock('tr909');r.data.currentPatternId=7;
  r.data.patterns[7].units.tb303_1.sequence[9]={active:true,note:'D#',octave:3,accent:true,slide:true};
  r.data.applyPatternSettings(7);r.model.set('tb303_1','reso',7.3);
  r.data.keepSoundSettings=true;r.audio.swing=55.5;
  const saved=captureMachineState(r.data,r.audio), before=JSON.stringify(saved);
  r.audio.rackAuto={reset(){r.model.read();}};
  r.data.currentPatternId=0;r.data.mode='song';r.data.unitLocks={};r.data.active909Tracks=['bd'];r.audio.swing=50;
  applyMachineState(r,decodeMachineState(saved,BinaryFormatDecoder));
  assert.equal(r.data.currentPatternId,7);assert.equal(r.data.mode,'pattern');assert.equal(r.data.keepSoundSettings,true);
  assert.equal(r.audio.swing,55.5);assert.equal(r.data.patterns[0].units.tb303_2.settings.reso,10.8);
  assert.equal(r.data.patterns[7].units.tb303_1.settings.reso,7.3);
  assert.equal(r.data.patterns[7].units.tb303_1.sequence[9].note,'D#');
  const after=captureMachineState(r.data,r.audio);
  assert.deepEqual({...after,code:null},{...JSON.parse(before),code:null});
  r.data.mode='song';const song=captureMachineState(r.data,r.audio);r.data.mode='pattern';
  applyMachineState(r,decodeMachineState(song,BinaryFormatDecoder));assert.equal(r.data.mode,'song');
  assert.throws(()=>decodeMachineState({...saved,code:saved.code.slice(0,-20)},BinaryFormatDecoder));
  assert.equal(r.data.mode,'song','bad data is rejected before mutation');
});

test('basic drum recovery makes four simultaneous parts without changing 303, tone or levels',()=>{
  const r=rig();r.model.randomize();r.data.active909Tracks=['bd'];
  const before=snapshot(r),levels=volumes(before);r.model.basicDrums();const after=snapshot(r);
  assert.deepEqual(after.tb303_1,before.tb303_1);assert.deepEqual(after.tb303_2,before.tb303_2);
  assert.deepEqual(volumes(after),levels);
  assert.deepEqual([...r.data.active909Tracks],['bd','sd','ch','oh']);
  assert.deepEqual(DRUMS.filter(([id])=>after.tr909.tracks[id].steps.some(Boolean)).map(([id])=>id),['bd','sd','ch','oh']);
  r.model.drumCandidates(DRUMS.map(([id])=>id));assert.deepEqual(snapshot(r),after,'candidate changes do not silently replace the beat');
  r.model.lock('tr909');assert.throws(()=>r.model.basicDrums(),/固定/);assert.throws(()=>r.model.drumCandidates(['bd']),/固定/);
});

test('the original 909 triggers all eleven voices on one step, independently of the edit selector',()=>{
  const voice=new TR909({},{}),calls=[];
  voice.voices=new Map(DRUMS.map(([id])=>[id,{trigger:(time,params)=>calls.push({id,time,params})}]));
  const steps=Object.fromEntries(DRUMS.map(([id])=>[id,[1,...Array(15).fill(0)]]));
  const params=Object.fromEntries(DRUMS.map(([id],i)=>[id,{level:20+i}]));
  voice.processStep(1.25,0,steps,params,128);
  assert.equal(calls.length,11);assert.deepEqual(calls.map(c=>c.id),DRUMS.map(([id])=>id));
  assert.ok(calls.every(c=>c.time===1.25&&c.params===params[c.id]));
});

test('single-module dice uses the original bass/answer rules and preserves other modules',()=>{
  const r=rig();r.model.randomize();r.model.lock('tb303_2');
  const before=snapshot(r);r.model.randomize('tb303_1');const after=snapshot(r);
  assert.deepEqual(after.tb303_2,before.tb303_2);assert.deepEqual(after.tr909,before.tr909);
  assert.notDeepEqual(after.tb303_1.sequence,before.tb303_1.sequence);
  const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  after.tb303_1.sequence.forEach((s,i)=>{
    const scale=['C','D#','F','F#','G','A#'],intervals=i%4===0?[3,4,8,9]:[0,3,4,7,8,9];
    const candidates=scale.filter(n=>intervals.includes((notes.indexOf(n)-notes.indexOf(after.tb303_2.sequence[i].note)+12)%12));
    // The upstream falls back to its blues scale when no interval fits.
    assert.ok((candidates.length?candidates:scale).includes(s.note));
  });
  assert.deepEqual({...r.data.unitLocks},{tb303_1:false,tb303_2:true,tr909:false});
});

test('dice preserves every volume and BPM while changing original sequences',()=>{
  const r=rig();r.model.set('tb303_1','volume',23);r.model.set('bd','level',17);
  const before=volumes(snapshot(r));r.model.randomize();
  assert.deepEqual(volumes(snapshot(r)),before);assert.equal(r.audio.tempo,127);
  assert.ok(r.model.read().canRestore);
});

test('locked dice is a no-op but manual tone edits still work',()=>{
  const r=rig();for(const id of ['tb303_1','tb303_2','tr909'])r.model.lock(id);
  const before=snapshot(r);assert.equal(r.model.randomize(),false);assert.deepEqual(snapshot(r),before);
  r.model.set('tb303_1','cutoff',77);assert.equal(r.model.read().units.tb303_1.settings.cutoff,77);
  assert.equal(r.model.read().canRestore,false);
});

test('return point restores phrases, timbres and track selection, preserving live levels',()=>{
  const r=rig();r.model.randomize();r.model.remember();const before=snapshot(r);
  r.model.randomize();r.data.active909Tracks=['bd'];r.model.set('tb303_2','volume',0);r.model.set('sd','level',12);
  const volume=volumes(snapshot(r));assert.equal(r.model.restore(),true);
  assert.deepEqual(volumes(snapshot(r)),volume);assert.deepEqual(r.model.read().tracks,['bd','sd','ch','oh']);
  const after=snapshot(r);assert.deepEqual(after.tb303_1.sequence,before.tb303_1.sequence);assert.equal(after.tb303_2.settings.cutoff,before.tb303_2.settings.cutoff);
});

test('changing the pattern or replacing a FILE invalidates a stale return point',()=>{
  const r=rig();r.model.remember();r.data.currentPatternId=1;assert.equal(r.model.read().canRestore,false);
  r.model.remember();r.data.patterns[1]=r.data.createEmptyPattern();assert.equal(r.model.restore(),false);
});

test('failed original dice restores the score, UI values and temporary locks',()=>{
  const r=rig();r.model.lock('tb303_2');const before=snapshot(r),locks={...r.data.unitLocks};
  r.data.randomize=()=>{r.data.patterns[0].units.tb303_1.settings.cutoff=1;throw new Error('failed');};
  assert.throws(()=>r.model.randomize('tb303_1'),/failed/);
  assert.deepEqual(snapshot(r),before);assert.deepEqual({...r.data.unitLocks},locks);
  assert.equal(Number(r.inputs.get('cutoff303_1-input').value),before.tb303_1.settings.cutoff);
});

test('every exposed fader writes through the real native save/apply mappings',()=>{
  const r=rig();
  for(const unit of ['tb303_1','tb303_2'])for(const [key,,,min,max] of SYNTH_CONTROLS){const value=(min+max)/2;r.model.set(unit,key,value);assert.equal(r.model.read().units[unit].settings[key],value);}
  for(const [unit,,controls] of DRUMS)for(const [key] of controls){r.model.set(unit,key,37);assert.equal(r.model.read().units.tr909.tracks[unit][key],37);}
  r.model.wave('tb303_1','square');assert.equal(r.model.read().units.tb303_1.settings.waveform,'square');
  for(const args of [['tb303_1','cutoff',101],['bd','level',NaN],['tb303_1','unknown',2],['unknown','level',2]])assert.throws(()=>r.model.set(...args));
  assert.throws(()=>r.model.wave('tr909','square'));assert.throws(()=>r.model.randomize('unknown'));
});

test('SONG score is protected from rack mutations',()=>{
  const r=rig();r.data.mode='song';const before=snapshot(r);
  for(const action of [()=>r.model.set('bd','level',1),()=>r.model.randomize(),()=>r.model.remember(),()=>r.model.restore(),()=>r.model.lock('tr909'),()=>r.model.wave('tb303_1','square')])assert.throws(action,/SONG/);
  assert.deepEqual(snapshot(r),before);assert.equal(r.model.read().editable,false);
});

test('rack edits remain compatible with the original full FILE encoding',()=>{
  const r=rig();r.model.randomize();r.model.set('tb303_2','cutoff',38);r.model.set('bd','level',29);r.model.wave('tb303_1','square');
  const decoded=new BinaryFormatDecoder().decode(r.data.exportFullState());
  assert.equal(decoded.bpm,127);assert.equal(decoded.patterns[0].units.tb303_2.settings.cutoff,38);
  assert.equal(decoded.patterns[0].units.tr909.tracks.bd.level,29);assert.equal(decoded.patterns[0].units.tb303_1.settings.waveform,'square');
  assert.deepEqual(structuredClone(decoded.patterns[0].units.tb303_2.sequence),snapshot(r).tb303_2.sequence);
});

test('real native full encoding handoff keeps PATTERN editable, the selected phrase and dice locks',()=>{
  const r=rig();r.data.currentPatternId=5;r.data.applyPatternSettings(5);r.model.randomize();r.model.lock('tb303_2');
  r.model.lockDrum('bd');
  const before=snapshot(r),values=new Map();
  const storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  carryMachine(r.data,storage);
  // The unmodified native decoder treats full FILEs as SONG.
  assert.equal(new BinaryFormatDecoder().decode(r.data.exportFullState()).mode,'song');
  const target=rig();target.ui.updateSwingUI=()=>{};target.ui.updateSevenSegment=()=>{};
  takeMachine(target.data,storage,BinaryFormatDecoder);
  assert.equal(target.data.currentPatternId,5);assert.equal(target.model.read().editable,true);
  assert.equal(target.data.unitLocks.tb303_2,true);
  assert.equal(target.data.drumLocks.bd,true);
  assert.deepEqual(snapshot(target).tb303_2.sequence,before.tb303_2.sequence);
  target.model.randomize('tb303_1');
  assert.deepEqual(snapshot(target).tb303_2.sequence,before.tb303_2.sequence);
});

test('kick and cymbal locks preserve exact steps and tone across native, module and combination dice',()=>{
  const r=rig();r.model.basicDrums();r.model.set('bd','level',21);r.model.set('bd','tune',33);
  r.data.patterns[0].units.tr909.tracks.bd.steps[7]=2;r.model.lockDrum('bd');r.model.lockDrum('cr');
  const before=snapshot(r).tr909.tracks;
  const variations=new Set();
  for(let i=0;i<24;i++) {
    if(i%3===0) r.data.randomize(); else r.model.randomize(i%3===1?'tr909':'all');
    const now=snapshot(r).tr909.tracks;
    assert.deepEqual(now.bd,before.bd);assert.deepEqual(now.cr,before.cr);
    variations.add(JSON.stringify(now.ch.steps));
  }
  assert.ok(variations.size>1,'unlocked hats still vary');
  r.model.set('bd','tune',67);assert.equal(r.model.read().units.tr909.tracks.bd.tune,67,'manual fader remains usable');
  r.model.basicDrums();assert.deepEqual(snapshot(r).tr909.tracks.bd.steps,before.bd.steps);
});

test('voice and hat-pair dice change only requested unlocked voices; tempo and levels remain stable',()=>{
  const r=rig();r.model.randomize();r.model.lockDrum('bd');r.model.lockDrum('oh');
  for(const target of ['sd','hats',...DRUMS.map(([id])=>id).filter(id=>!['bd','oh'].includes(id))]) {
    const before=snapshot(r),volume=volumes(before),tempo=r.audio.tempo,locks={...r.data.drumLocks};
    r.model.randomize(target);const after=snapshot(r);
    const changed=target==='hats'?['ch']:[target];
    for(const [id] of DRUMS) if(!changed.includes(id)) assert.deepEqual(after.tr909.tracks[id],before.tr909.tracks[id],target+' protects '+id);
    assert.deepEqual(after.tb303_1,before.tb303_1);assert.deepEqual(after.tb303_2,before.tb303_2);
    assert.deepEqual(volumes(after),volume);assert.equal(r.audio.tempo,tempo);assert.deepEqual(r.data.drumLocks,locks);
  }
  assert.equal(r.model.randomize('bd'),false);
  r.model.lockDrum('ch');assert.equal(r.model.randomize('hats'),false);
  r.model.lock('tr909');assert.equal(r.model.randomize('sd'),false);
});

test('part locks survive named snapshot, settings and handoff, while old snapshots default unlocked',()=>{
  const r=rig();r.model.basicDrums();r.model.lockDrum('bd');r.model.lockDrum('oh');
  const saved=captureMachineState(r.data,r.audio);r.model.lockDrum('bd');
  applyMachineState(r,decodeMachineState(saved,BinaryFormatDecoder));assert.equal(r.data.drumLocks.bd,true);
  const old={...saved,version:1};delete old.drumLocks;
  applyMachineState(r,decodeMachineState(old,BinaryFormatDecoder));assert.ok(Object.values(r.data.drumLocks).every(v=>!v));
  r.model.lockDrum('bd');r.data.drumLocks={};r.data.loadSettings();assert.equal(r.data.drumLocks.bd,true);
  r.data.init();assert.equal(r.data.drumLocks.bd,true);assert.ok(snapshot(r).tr909.tracks.bd.steps.some(Boolean),'fresh bank is seeded before global locks take effect');
  assert.throws(()=>decodeMachineState({...saved,drumLocks:{bd:'yes'}},BinaryFormatDecoder),/固定/);
});

test('partial dice failure rolls back candidates and temporary protection; SONG stays protected',()=>{
  const r=rig();r.model.basicDrums();r.model.lockDrum('bd');
  const before=snapshot(r),locks={...r.data.drumLocks},tracks=[...r.data.active909Tracks];
  r.data.randomize=()=>{r.data.patterns[0].units.tr909.tracks.bd.steps.fill(0);throw Error('dice failed');};
  assert.throws(()=>r.model.randomize('cr'),/dice failed/);assert.deepEqual(snapshot(r),before);
  assert.deepEqual(r.data.drumLocks,locks);assert.deepEqual(r.data.active909Tracks,tracks);
  r.data.mode='song';assert.throws(()=>r.model.lockDrum('bd'),/SONG/);assert.throws(()=>r.model.randomize('hats'),/SONG/);
});

test('gentle variations return to the motif, preserve locked kick/303 and never accumulate more hits',()=>{
  const r=rig();r.model.randomize();r.model.basicDrums();r.model.lock('tb303_2');r.model.lockDrum('bd');
  r.model.remember();
  const before=snapshot(r),volume=volumes(before),seen=new Set();let previous;
  for(let turn=0;turn<120;turn++) {
    previous=r.model.evolve(turn,previous,()=>.6);const now=snapshot(r);
    assert.deepEqual(now.tb303_2,before.tb303_2);assert.deepEqual(now.tr909.tracks.bd,before.tr909.tracks.bd);
    assert.deepEqual(volumes(now),volume);assert.equal(r.audio.tempo,127);
    const units=[...['tb303_1','tb303_2'].map(id=>[id,now[id],before[id]]),...DRUMS.map(([id])=>[id,now.tr909.tracks[id],before.tr909.tracks[id]])];
    assert.equal(units.filter(([,a,b])=>JSON.stringify(a)!==JSON.stringify(b)).length,1,'only one variation at a time');
    for(const [id,a,b] of units) {
      const hits=v=>id.startsWith('tb303')?v.sequence.filter(s=>s.active).length:v.steps.filter(Boolean).length;
      assert.equal(hits(a),hits(b),id+' retains its hit count');
      if(id.startsWith('tb303')) assert.deepEqual(a.sequence.filter(s=>s.active).map(s=>s.note).sort(),b.sequence.filter(s=>s.active).map(s=>s.note).sort());
    }
    seen.add(previous.detail);
  }
  assert.ok(seen.size>=3);r.model.restore();assert.deepEqual(snapshot(r),before,'existing return point remains usable');
});

test('auto respects newly locked, muted, excluded and manually edited voices',()=>{
  const r=rig();r.model.randomize();r.model.basicDrums();
  let p=r.model.evolve(0,null,()=>.3);assert.equal(p.id,'tb303_2');
  r.model.lock(p.id);const held=snapshot(r)[p.id];p=r.model.evolve(1,p,()=>.3);assert.deepEqual(snapshot(r).tb303_2,held);
  r.model.set('tb303_1','cutoff',71);const edited=snapshot(r).tb303_1;
  r.model.set('tb303_1','volume',0);const muted=snapshot(r).tb303_1;
  r.data.active909Tracks=['bd'];r.model.lockDrum('bd');
  const before=snapshot(r);assert.equal(r.model.evolve(2,p),null);assert.deepEqual(snapshot(r),before);
  assert.equal(snapshot(r).tb303_1.settings.cutoff,edited.settings.cutoff);assert.deepEqual(snapshot(r).tb303_1,muted);
  r.data.mode='song';assert.throws(()=>r.model.evolve(0),/SONG/);
});

test('variation leaves quarter beats intact and handles sparse or empty motifs',()=>{
  const drum={steps:[1,1,0,0,1,0,0,0,1,0,0,0,1,0,0,0],level:25,decay:99};
  const moved=varyVoice(drum,false,1,()=>0).voice;
  for(const i of [0,4,8,12]) assert.equal(moved.steps[i],1);
  assert.equal(moved.steps.filter(Boolean).length,5);assert.equal(moved.level,25);
  assert.equal(varyVoice({...drum,steps:Array(16).fill(0)},false,0),null);
  assert.equal(varyVoice(drum,false,2,()=>.8).voice.decay,93,'tone stays bounded without clipping to silence');
});

test('AUTO follows real bar ticks, suspends for hands, stops safely and adopts manual dice/faders',()=>{
  const r=rig();r.model.randomize();r.model.basicDrums();r.model.lock('tb303_2');r.model.lockDrum('bd');
  const auto=createRackAuto(r),before=snapshot(r);r.audio.isPlaying=true;
  const bar=n=>{for(let s=0;s<16;s++)auto.tick(n*2+s/8,s);};
  bar(0);assert.deepEqual(snapshot(r),before,'default off');
  auto.configure(true,4);for(let b=0;b<4;b++)bar(b);assert.deepEqual(snapshot(r),before);
  auto.tick(8,0);const changed=snapshot(r);assert.notDeepEqual(changed,before);
  auto.tick(8,0);assert.deepEqual(snapshot(r),changed,'duplicate bar start cannot double-advance');
  auto.touch(true);for(let b=5;b<12;b++)bar(b);assert.deepEqual(snapshot(r),changed,'hands keep control at the boundary');
  auto.manual();r.model.randomize('hats');r.model.set('tb303_1','cutoff',61);const manual=snapshot(r);
  auto.touch(false);auto.configure(true,2);bar(20);bar(21);assert.deepEqual(snapshot(r),manual);
  bar(22);assert.equal(snapshot(r).tb303_1.settings.cutoff,61);
  auto.configure(false,2);const frozen=snapshot(r);bar(23);assert.deepEqual(snapshot(r),frozen,'OFF keeps what is audible');
  auto.configure(true,2);r.audio.isPlaying=false;auto.reset();for(let b=24;b<30;b++)bar(b);assert.deepEqual(snapshot(r),frozen);
  r.audio.isPlaying=true;bar(30);bar(31);assert.deepEqual(snapshot(r),frozen,'restart waits a full interval');
  r.data.mode='song';for(let b=32;b<40;b++)bar(b);assert.deepEqual(snapshot(r),frozen,'SONG is never rewritten');
  r.data.mode='pattern';r.data.currentPatternId=1;r.data.applyPatternSettings(1);bar(40);bar(41);assert.ok(snapshot(r).tb303_1.sequence.every(s=>!s.active),'silent new pattern stays silent');
});

test('AUTO settings round-trip without playback, reject invalid intervals, and migrate old snapshots OFF',()=>{
  const r=rig(),auto=createRackAuto(r);auto.configure(true,8);r.data.rackAuto={};r.data.loadSettings();
  assert.deepEqual({...r.data.rackAuto},{enabled:true,bars:8});
  const saved=captureMachineState(r.data,r.audio);auto.configure(false,2);
  applyMachineState(r,decodeMachineState(saved,BinaryFormatDecoder));assert.deepEqual(r.data.rackAuto,{enabled:true,bars:8});assert.ok(!r.audio.isPlaying);
  for(const version of [1,2]) {const old={...saved,version};delete old.rackAuto;applyMachineState(r,decodeMachineState(old,BinaryFormatDecoder));assert.deepEqual(r.data.rackAuto,{enabled:false,bars:4});}
  assert.throws(()=>auto.configure(true,3),/間隔/);
  assert.throws(()=>decodeMachineState({...saved,rackAuto:{enabled:'true',bars:4}},BinaryFormatDecoder),/AUTO/);
  r.data.rackAuto={enabled:true,bars:16};const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;},removeItem(){this.value=null;}};
  carryMachine(r.data,storage);const target=rig();target.ui.updateSevenSegment=()=>{};
  takeMachine(target.data,storage,BinaryFormatDecoder);assert.deepEqual(target.data.rackAuto,{enabled:true,bars:16});
});

test('AUTO failure rolls back the musical data and disables further automatic edits',()=>{
  const r=rig();r.model.randomize();const before=snapshot(r);let once=true;
  r.ui.renderAll=()=>{if(once){once=false;throw Error('render failed');}};
  assert.throws(()=>r.model.evolve(0,null),/render failed/);assert.deepEqual(snapshot(r),before);
  const auto=createRackAuto({...r,model:{evolve(){throw Error('offline error');}}});r.audio.isPlaying=true;auto.configure(true,2);
  for(let b=0;b<3;b++)for(let s=0;s<16;s++)auto.tick(b*2+s/8,s);
  assert.equal(auto.read().enabled,false);assert.match(auto.read().lastChange,/offline error/);assert.deepEqual(snapshot(r),before);
});

test('native worklet/linked ticks and fallback scheduler vary before voice scheduling and Stop resets AUTO',()=>{
  const calls=[],source=readFileSync(new URL('../third_party/acidbros/js/audio/AudioEngine.js',import.meta.url),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.invalid/AudioEngine.js')).replace('export const AudioEngine =','const AudioEngine =');
  const ui={getParams:()=>({}),drawPlayhead(){},clearPlayhead(){},updateQueuedPatternUI(){}};
  const data={mode:'pattern',getSequence:()=>[]};
  const context=vm.createContext({console,Data:data,UI:ui,window:{setTimeout(){return 1;},clearTimeout(){}}});
  const audio=vm.runInContext(source+';AudioEngine;',context);audio.ctx={currentTime:0};
  audio.rackAuto={tick(t,s){calls.push(['auto',s,t]);},reset(){calls.push(['reset',audio.isPlaying]);}};
  audio.instruments.set('tr909',{processStep(t,s){calls.push(['voice',s,t]);}});audio.isPlaying=true;
  for(const linked of [false,true]) {
    audio.useWorklet=!linked;audio.externalTransport=linked?{}:null;
    audio.handleTick({time:1,step:0});assert.deepEqual(calls.splice(0),[['auto',0,1],['voice',0,1]]);
  }
  audio.externalTransport=null;audio.useWorklet=false;audio.nextNoteTime=0;audio.currentStep=0;audio.scheduleAheadTime=.01;
  audio.scheduler();assert.deepEqual(calls.splice(0),[['auto',0,0],['voice',0,0]]);
  audio.stopInternal();assert.deepEqual(calls[0],['reset',false]);
});
