import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import vm from 'node:vm';
import {defaultSet,technoSetCode} from '../src/live-code.js';
import {rollDice} from '../src/musical-dice.js';

globalThis.fetch=()=>{throw new Error('No network in score verification');};
globalThis.AudioContext=class{constructor(){throw new Error('No device audio in score verification');}};
registerHooks({resolve(specifier,context,next){
  if(specifier==='@kabelsalat/web') return {url:new URL('../node_modules/@kabelsalat/web/dist/index.mjs',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const core=await import('@strudel/core');
const mini=await import('@strudel/mini');
const {transpiler}=await import('@strudel/transpiler');
core.setStringParser(undefined);
const layers=await Promise.all(['techno-dub','namima-test'].map(async id=>({
  id,title:id,source:await readFile(new URL('../src/patterns/'+id+'.txt',import.meta.url),'utf8'),
})));

async function score(state){
  const tempos=[];
  const context=vm.createContext({...core,m:mini.m,samples:async()=>{},setcpm:value=>tempos.push(value),
    sliderWithID:(_id,value)=>core.ref(()=>value)});
  const compiled=transpiler(technoSetCode(state),{wrapAsync:true});
  const pattern=await new vm.Script(compiled.output).runInContext(context,{timeout:5000});
  assert.deepEqual(tempos,[state.bpm/4]);
  return pattern;
}

test('real pinned Strudel evaluates rolled scores on one clock, preserving kick/backbeat and axis return',async()=>{
  const original=defaultSet('acid-drive',layers);
  original.auto=false;
  const originalPattern=await score(original);
  const onsets=(pattern,sound,bar)=>pattern.queryArc(bar,bar+1).filter(h=>h.hasOnset() && h.value.s===sound);
  let state=original;
  for(let turn=0;turn<8;turn++){
    state=rollDice(state);
    const pattern=await score(state);
    for(const bar of [0,4,7,8,64]){
      for(const sound of ['bd','sd']) assert.deepEqual(onsets(pattern,sound,bar).map(h=>Number(h.whole.begin)),onsets(originalPattern,sound,bar).map(h=>Number(h.whole.begin)));
      const bass=onsets(pattern,'sawtooth',bar);
      assert.equal(bass.length,state.notes.filter(n=>n!=='~').length);
      assert.ok(bass.every(h=>Number.isFinite(h.value.note) && Number.isFinite(h.value.gain) && h.value.gain>0));
      assert.ok(onsets(pattern,'square',bar).filter(h=>h.value.note!==undefined).length<=4,'the second 303 remains sparse');
    }
    assert.deepEqual(onsets(pattern,'sawtooth',0).map(h=>h.value.note),onsets(pattern,'sawtooth',8).map(h=>h.value.note));
  }
});
