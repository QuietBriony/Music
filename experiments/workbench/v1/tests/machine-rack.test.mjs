import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMachineRack, DRUMS, SYNTH_CONTROLS } from '../src/machine-rack/model.js';
import { BinaryFormatEncoder } from '../third_party/acidbros/js/data/BinaryFormatEncoder.js';
import { BinaryFormatDecoder } from '../third_party/acidbros/js/data/BinaryFormatDecoder.js';
import { carryMachine, takeMachine } from '../src/machine-rack/handoff.js';

// Exercise the pinned machine's real randomizer and save/apply mappings, with
// native knob/radio DOM substitutes. No audio, browser, storage or network.
function rig() {
  const inputs = new Map(), knobs = {}, radios = {}, saved = new Map();
  const ui = { renderAll(){}, refreshParamCache(){}, updateLockUI(){} };
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
  const before=snapshot(r),values=new Map();
  const storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  carryMachine(r.data,storage);
  // The unmodified native decoder treats full FILEs as SONG.
  assert.equal(new BinaryFormatDecoder().decode(r.data.exportFullState()).mode,'song');
  const target=rig();target.ui.updateSwingUI=()=>{};target.ui.updateSevenSegment=()=>{};
  takeMachine(target.data,storage,BinaryFormatDecoder);
  assert.equal(target.data.currentPatternId,5);assert.equal(target.model.read().editable,true);
  assert.equal(target.data.unitLocks.tb303_2,true);
  assert.deepEqual(snapshot(target).tb303_2.sequence,before.tb303_2.sequence);
  target.model.randomize('tb303_1');
  assert.deepEqual(snapshot(target).tb303_2.sequence,before.tb303_2.sequence);
});
