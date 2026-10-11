import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultSet,readTechnoSet,technoSetCode,liveMotif} from '../src/live-code.js';
import {rollDice,keepDice,restoreDice} from '../src/musical-dice.js';

const layers=await Promise.all(['techno-dub','namima-test'].map(async id=>({
  id,title:id,source:await readFile(new URL('../src/patterns/'+id+'.txt',import.meta.url),'utf8'),
})));
const untouched = state => ({bpm:state.bpm,bank:state.bank,muted:state.muted,layers:state.layers,
  live:state.live,auto:state.auto,scene:state.scene,groove:state.groove,shadow:state.shadow,
  kick:state.steps.kick,snare:state.steps.snare,clap:state.steps.clap,crash:state.steps.crash,
  levels:Object.fromEntries(Object.entries(state.values).filter(([key])=>!['CUTOFF','RESONANCE','DRIVE','DECAY','SPACE','MOTION'].includes(key)))});

test('coordinated rolls produce bounded motifs and real variety, preserve the mix and never mutate input',()=>{
  const source=defaultSet('acid-drive',layers), original=structuredClone(source);
  const motifs=new Set(),colors=new Set();
  let state=source;
  for(let i=0;i<128;i++) {
    assert.deepEqual(rollDice(state),rollDice(structuredClone(state)),'same seed/turn is reproducible');
    state=rollDice(state);
    motifs.add(state.notes.join());colors.add(state.values.CUTOFF);
    assert.deepEqual(untouched(state),untouched(source));
    assert.ok(state.notes.filter(n=>n!=='~').length>=7 && state.notes.filter(n=>n!=='~').length<=10);
    assert.ok(state.steps.hh.filter(Boolean).length<=6);
    for(const i of [2,6,10,14]) assert.equal(state.steps.hh[i],true);
    assert.ok(state.steps.oh.filter(Boolean).length<=2);
    assert.deepEqual(readTechnoSet(technoSetCode(state)),state);
    for(let step=0;step<16;step++) {
      const motif=liveMotif(state.notes,state.groove,0,step/16);
      if(motif.response!==null) assert.ok([0,2,3,5,7,10].includes(motif.response%12));
    }
  }
  assert.ok(motifs.size>32);assert.equal(colors.size,4);
  assert.deepEqual(source,original);
  assert.deepEqual(state.dice.anchor.notes,source.notes,'rolls keep a single checkpoint');
});

test('small changes keep every rest and strong beat, with at most two neighboring pitches',()=>{
  const state=defaultSet('acid-drive',layers);
  for(let seed=1;seed<64;seed++) {
    state.groove.seed=seed;
    const next=rollDice(state,'nudge');
    assert.deepEqual(untouched(next),untouched(state));
    assert.equal(next.notes.filter((n,i)=>n!==state.notes[i]).length,2);
    for(let i=0;i<16;i++) if(i%4===0 || state.notes[i]==='~') assert.equal(next.notes[i],state.notes[i]);
    assert.equal(next.notes.filter(n=>n!=='~').length,state.notes.filter(n=>n!=='~').length);
    assert.ok(Math.abs(next.values.CUTOFF-state.values.CUTOFF)<=120);
  }
  const sparse=defaultSet('dub-room',layers);
  assert.deepEqual(rollDice(sparse,'nudge').notes,sparse.notes,'no invented pickups in a sparse axis');
});

test('phrase, drum and timbre locks survive saving; ambient cannot introduce rhythm',()=>{
  for(const preset of ['acid-drive','dub-room','electro-808','ambient-drift']) {
    const state=defaultSet(preset,layers);state.groove.hold=true;
    const next=rollDice(state,'phrase',{drums:true,tone:true});
    assert.deepEqual(next.notes,state.notes);assert.deepEqual(next.steps,state.steps);assert.deepEqual(next.values,state.values);
    assert.deepEqual(readTechnoSet(technoSetCode(next)),next);
  }
  const ambient=defaultSet('ambient-drift',layers),next=rollDice(ambient);
  assert.deepEqual(next.notes,ambient.notes);assert.deepEqual(next.steps,ambient.steps);assert.deepEqual(next.live,ambient.live);
});

test('keep and restore persist across score reload, without reverting later volume, tempo or mute edits',()=>{
  const original=defaultSet('acid-drive',layers);
  let state=rollDice(original);
  const kept=keepDice(state);
  state=rollDice(kept,'nudge');
  state.bpm=119;state.values.MASTER=.18;state.values.A=.24;state.muted=['acid'];state.steps.kick[15]=true;
  state=restoreDice(readTechnoSet(technoSetCode(state)));
  assert.deepEqual(state.notes,kept.notes);assert.deepEqual(state.steps.hh,kept.steps.hh);
  for(const key of Object.keys(kept.dice.anchor.tone)) assert.equal(state.values[key],kept.values[key]);
  assert.equal(state.bpm,119);assert.equal(state.values.MASTER,.18);assert.equal(state.values.A,.24);
  assert.deepEqual(state.muted,['acid']);assert.equal(state.steps.kick[15],true);
  assert.deepEqual(restoreDice(rollDice(original)).notes,original.notes);
});

test('existing V3/V4 code stays byte identical until a button is used; malformed checkpoints fail closed',()=>{
  for(const shadow of [true,false]) {
    const state=defaultSet('acid-drive',layers);
    if(!shadow) delete state.shadow;
    const code=technoSetCode(state);
    assert.equal(technoSetCode(readTechnoSet(code)),code);
    assert.equal(readTechnoSet(code).dice,undefined);
  }
  for(const edit of [d=>d.seed=0,d=>d.turn=-1,d=>d.anchor.notes=['fake'],d=>d.anchor.steps.hh[0]=1,d=>d.anchor.tone.DRIVE=100,d=>d.locks.drums=1]) {
    const state=rollDice(defaultSet('acid-drive',layers));edit(state.dice);
    assert.throws(()=>technoSetCode(state));
  }
});
