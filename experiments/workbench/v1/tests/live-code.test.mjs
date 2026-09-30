import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultSet, readTechnoSet, technoSetCode, upgradeSet, liveFrame, liveMotif, SET_PRESETS, SET_SLIDERS } from '../src/live-code.js';
import { defaultSet as oldDefault, technoSetCode as oldCode } from '../src/performance-code.js';
import { defaultSet as grooveDefault, technoSetCode as grooveCode } from '../src/groove-code.js';

const layers=await Promise.all(['techno-dub','namima-test'].map(async id => ({
  id,title:id,source:await readFile(new URL('../src/patterns/'+id+'.txt',import.meta.url),'utf8'),
})));

test('four LIVE presets save all controls, phrase lock and manual mutes without changing old V1/V2 scores',()=>{
  for (const {id} of SET_PRESETS) {
    const state=defaultSet(id,layers);
    state.live.lock='groove'; state.muted=['pad','response','hh'];
    const code=technoSetCode(state);
    assert.deepEqual(readTechnoSet(code),state);
    assert.deepEqual(readTechnoSet(code.replace(/\r\n?/g,'\n').replace(/\n/g,'\r\n')),state,'saved scores also restore with Windows line endings');
    assert.equal(SET_SLIDERS.length,19);
    assert.ok(code.length < 100_000);
    assert.equal([...code.matchAll(/^setcpm\(/gm)].length,1);
    const changed=code.replace('SET_AIR = slider('+state.values.AIR+',','SET_AIR = slider(0.3,');
    assert.equal(readTechnoSet(changed).values.AIR,.3);
  }
  for (const [make,codeOf] of [[oldDefault,oldCode],[grooveDefault,grooveCode]]) {
    const old=make('acid-drive',layers);old.muted=['hh'];old.notes[3]='f2';old.values.CUTOFF=1800;
    const code=codeOf(old);
    assert.equal(technoSetCode(readTechnoSet(code)),code);
    const upgraded=upgradeSet(old);
    assert.deepEqual(upgraded.notes,old.notes);
    for (const [key,value] of Object.entries(old.steps)) assert.deepEqual(upgraded.steps[key],value);
    assert.deepEqual(upgraded.muted,old.muted);assert.deepEqual(upgraded.layers,old.layers);
    for (const [key,value] of Object.entries(old.values)) assert.equal(upgraded.values[key],value);
    assert.deepEqual(readTechnoSet(technoSetCode(upgraded)),upgraded);
    assert.equal(old.live,undefined);
  }
});

test('chapters continue deterministically beyond the old 64-bar loop, with exact 8/16/32-bar sections',()=>{
  for (const pace of [8,16,32]) {
    const config={mode:'techno',pace,energy:.65,lock:null};
    const sections=new Set(); const orders=new Set();
    for (let chapter=0;chapter<12;chapter++) {
      const order=[];
      for (let i=0;i<8;i++) {
        const cycle=(chapter*8+i)*pace;
        const frame=liveFrame(config,731,cycle);
        assert.deepEqual(frame,liveFrame(structuredClone(config),731,cycle));
        assert.equal(frame.chapter,chapter);assert.equal(frame.index,i);assert.equal(frame.position,0);
        assert.equal(liveFrame(config,731,cycle+pace-.01).section,frame.section);
        sections.add(frame.section);order.push(frame.section);
      }
      orders.add(order.join(','));
    }
    assert.equal(sections.size,5);assert.ok(orders.size>1);
  }
});

test('live motif never grows note density or changes rests/strong beats, returns every 8 bars and respects lock',()=>{
  const state=defaultSet('acid-drive',layers);
  const original=structuredClone(state.notes);
  const variants=new Set();
  for (let chapter=0;chapter<16;chapter++) for (let bar=0;bar<64;bar++) {
    const cycle=chapter*64+bar+.1875;
    const motif=liveMotif(state.notes,state.groove,chapter,cycle);
    assert.deepEqual(motif,liveMotif(state.notes,state.groove,chapter,cycle));
    assert.equal(motif.notes.filter(n=>n!=='~').length,original.filter(n=>n!=='~').length);
    for (let i=0;i<16;i++) if (i%4===0||original[i]==='~') assert.equal(motif.notes[i],original[i]);
    assert.equal(motif.notes.filter((n,i)=>n!==original[i]).length,bar%8<4?0:1);
    if (bar%8<4) assert.deepEqual(motif.notes,original);
    else variants.add(motif.notes.join(','));
  }
  assert.ok(variants.size>4);assert.deepEqual(state.notes,original);
  state.groove.hold=true;
  for (const cycle of [4,12,64,68,1028]) assert.deepEqual(liveMotif(state.notes,state.groove,Math.floor(cycle/64),cycle).notes,original);
});

test('soft mode suppresses all automatic drums and 303, while pad and time continue at bounded levels',()=>{
  const state=defaultSet('ambient-drift',layers);
  assert.equal(state.bpm,76);assert.equal(state.live.pace,32);assert.equal(state.auto,true);
  for (let cycle=0;cycle<512;cycle+=.25) {
    const frame=liveFrame(state.live,state.groove.seed,cycle);
    for (const key of ['kick','snare','hh','oh','bell','acid','response','percussion','ride']) assert.equal(frame[key],0);
    assert.equal(frame.fill,false);assert.equal(frame.crash,false);
    assert.ok(frame.pad>.4 && frame.pad<=1);assert.ok(frame.tone>=.35 && frame.tone<=.8);
  }
  assert.ok(liveFrame(state.live,731,10,false,'peak').pad>liveFrame(state.live,731,10,false,'break').pad);
});

test('manual scenes and scene keep override automatic order; fills stay short and the first intro is clean',()=>{
  const config={mode:'techno',pace:8,energy:.65,lock:null};
  for (const t of [0,.25,1,4,7.99]) { assert.equal(liveFrame(config,731,t).snare,0);assert.equal(liveFrame(config,731,t).response,0); }
  for (let t=0;t<160;t+=.25) {
    const kept=liveFrame({...config,lock:'break'},731,t);
    assert.equal(kept.section,'break');assert.equal(kept.kick,0);assert.equal(kept.fill,false);
    assert.equal(liveFrame(config,731,t,false,'peak').section,'peak');
    const frame=liveFrame(config,731,t);
    if (frame.fill) assert.equal(Math.floor(t)%8,7);
    if (frame.crash) assert.equal(Math.floor(t)%8,0);
  }
  const quiet={...config,energy:.35};
  for (const t of [7,15,47,48]) { assert.equal(liveFrame(quiet,731,t).fill,false);assert.equal(liveFrame(quiet,731,t).crash,false); }
});

test('LIVE metadata and hand edits fail closed rather than overwriting a custom score',()=>{
  for (const edit of [s=>s.live.mode='unknown',s=>s.live.pace=0,s=>s.live.energy=2,s=>s.live.lock=true,s=>s.values.AIR=1,s=>s.muted=['fake']]) {
    const state=defaultSet('acid-drive',layers);edit(state);assert.throws(()=>technoSetCode(state));
  }
  const code=technoSetCode(defaultSet('acid-drive',layers));
  assert.equal(readTechnoSet(code.replace('.postgain(0.38)','.postgain(3)')),null);
});
