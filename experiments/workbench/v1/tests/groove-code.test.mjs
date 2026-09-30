import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultSet, groovePlan, readTechnoSet, technoSetCode, upgradeSet, EXTRA_DRUMS, SET_SLIDERS } from '../src/groove-code.js';
import { defaultSet as oldDefault, technoSetCode as oldCode } from '../src/performance-code.js';

const layers=await Promise.all(['techno-dub','namima-test'].map(async id => ({
  id,title:id,source:await readFile(new URL('../src/patterns/'+id+'.txt',import.meta.url),'utf8'),
})));

test('new sets round-trip all 18 faders, optional instruments, undo and variation settings',()=>{
  for (const preset of ['acid-drive','dub-room','electro-808']) {
    const state=defaultSet(preset,layers);
    state.groove.kit=EXTRA_DRUMS.map(([id])=>id);
    state.groove.previousNotes=[...state.notes];
    state.groove.hold=true; state.muted=['response','percussion'];
    const code=technoSetCode(state);
    assert.deepEqual(readTechnoSet(code),state);
    assert.equal(SET_SLIDERS.length,18);
    assert.equal([...code.matchAll(/^setcpm\(/gm)].length,1);
    const edited=code.replace('SET_SPACE = slider('+state.values.SPACE+',','SET_SPACE = slider(0.3,');
    const restored=readTechnoSet(edited);
    assert.equal(restored.values.SPACE,.3);
    assert.deepEqual(restored.groove,state.groove);
  }
});

test('old saved code stays byte-for-byte old until the user explicitly upgrades',()=>{
  const old=oldDefault('acid-drive',layers);
  old.notes[3]='f2'; old.muted=['hh']; old.steps.kick[14]=true;
  old.values.CUTOFF=1800; old.auto=true;
  const code=oldCode(old);
  assert.deepEqual(readTechnoSet(code),old);
  assert.equal(technoSetCode(readTechnoSet(code)),code);
  const upgraded=upgradeSet(old);
  assert.deepEqual(upgraded.notes,old.notes);
  assert.deepEqual(upgraded.layers,old.layers);
  assert.deepEqual(upgraded.muted,old.muted);
  assert.deepEqual(upgraded.steps.kick,old.steps.kick);
  for (const key of Object.keys(old.values)) assert.equal(upgraded.values[key],old.values[key]);
  assert.equal(upgraded.auto,true);
  assert.equal(old.groove,undefined);
  assert.deepEqual(readTechnoSet(technoSetCode(upgraded)),upgraded);
});

test('bounded variations keep rests and strong beats, repeat four bars and return deterministically',()=>{
  const state=defaultSet('acid-drive',layers);
  for (let seed=1;seed<=48;seed++) for (const variation of [0,1,2]) {
    Object.assign(state.groove,{seed,variation});
    const plan=groovePlan(state);
    assert.deepEqual(plan,groovePlan(structuredClone(state)));
    for (let bar=0;bar<8;bar++) {
      for (let i=0;i<16;i++) if (i%4===0 || state.notes[i]==='~') assert.equal(plan.notes[bar][i],state.notes[i]);
      assert.equal(plan.notes[bar].filter(n=>n!=='~').length,state.notes.filter(n=>n!=='~').length);
      assert.deepEqual(plan.notes[bar],plan.notes[bar<4?0:4]);
      assert.equal(plan.notes[bar].filter((n,i)=>n!==state.notes[i]).length,bar<4?0:variation);
    }
    state.groove.hold=true;
    for (const bar of groovePlan(state).notes) assert.deepEqual(bar,state.notes);
    state.groove.hold=false;
  }
});

test('303 responses stay sparse, above the bass and in the shared scale for every allowed pitch',()=>{
  const midi={g1:31,bb1:34,c2:36,d2:38,eb2:39,f2:41,g2:43,bb2:46,c3:48};
  for (const [pitch,value] of Object.entries(midi)) {
    const state=defaultSet('acid-drive',layers); state.notes.fill(pitch);
    const plan=groovePlan(state);
    for (let bar=0;bar<8;bar++) for (let i=0;i<16;i++) {
      const response=plan.response[bar][i];
      if (![3,7,10,14].includes(i)) assert.equal(response,'~');
      else {
        const delta=Number(response)-midi[plan.notes[bar][i]];
        assert.ok([15,19].includes(delta));
        assert.ok([0,2,3,5,7,10].includes(Number(response)%12));
      }
    }
  }
});

test('corrupt metadata, duplicate instruments and hand-edited musical code fail closed',()=>{
  for (const edit of [
    s=>s.groove.kit=['crash','crash'], s=>s.groove.kit=['unknown'], s=>s.groove.seed=0,
    s=>s.groove.variation=3, s=>s.groove.previousNotes=['c2'], s=>s.steps.ride[0]=1,
    s=>s.values.SPACE=1, s=>s.muted=['unknown'],
  ]) {
    const state=defaultSet('acid-drive',layers); edit(state);
    assert.throws(()=>technoSetCode(state));
  }
  const code=technoSetCode(defaultSet('acid-drive',layers));
  assert.equal(readTechnoSet(code.replace('.lpq(8)','.lpq(28)')),null);
});
