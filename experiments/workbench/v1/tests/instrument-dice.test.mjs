import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {defaultSet,readTechnoSet,technoSetCode} from '../src/live-code.js';
import {rollDice,keepDice,restoreDice} from '../src/musical-dice.js';
import {INSTRUMENT_DEFAULTS,INSTRUMENT_ROLES,INSTRUMENT_VOICES,instrumentProfile} from '../src/instrument-voices.js';
const layers=await Promise.all(['techno-dub','namima-test'].map(async id=>({id,title:id,source:await readFile(new URL('../src/patterns/'+id+'.txt',import.meta.url),'utf8')})));
const legacyHashes=JSON.parse(await readFile(new URL('./legacy-live-score-hashes.json',import.meta.url),'utf8'));

test('pre-change V3/V4 and old dice score hashes stay exact for all four presets',()=>{
  for (const id of ['acid-drive','dub-room','electro-808','ambient-drift']) {
    const state=defaultSet(id,layers),variants={v4:state,v3:structuredClone(state),dice:keepDice(state)};
    delete variants.v3.shadow;
    delete variants.dice.dice.locks.instruments;
    delete variants.dice.dice.anchor.bank;delete variants.dice.dice.anchor.instruments;
    for (const [key,v] of Object.entries(variants)) {
      const code=technoSetCode(v);
      assert.equal(createHash('sha256').update(code).digest('hex'),legacyHashes[id+':'+key]);
      assert.equal(technoSetCode(readTechnoSet(code)),code);
    }
  }
});

test('instrument-only dice varies every role without changing melody, rhythm, parameters or mix',()=>{
  const initial=defaultSet('acid-drive',layers),before=structuredClone(initial),seen={bass:new Set(),response:new Set(),pad:new Set()};
  let state=initial;
  for(let i=0;i<48;i++) {
    const next=rollDice(state,'instruments');
    assert.deepEqual(next,rollDice(state,'instruments'));
    for(const role of Object.keys(INSTRUMENT_ROLES)) {
      assert.notEqual(next.instruments[role],instrumentProfile(state)[role]);seen[role].add(next.instruments[role]);
    }
    assert.notEqual(next.bank,state.bank);
    for (const key of ['notes','steps','values','muted','bpm','layers','live','groove','shadow','auto','scene']) assert.deepEqual(next[key],initial[key],key);
    assert.deepEqual(readTechnoSet(technoSetCode(next)),next);state=next;
  }
  for(const role of Object.keys(seen)) assert.equal(seen[role].size,3);
  assert.deepEqual(initial,before);
  assert.deepEqual(restoreDice(state),{...initial,dice:state.dice},'restoring original removes the optional profile');
});

test('locks are independent, small changes choose one role and ambient changes only pad',()=>{
  const source=defaultSet('acid-drive',layers);
  const locked=rollDice(source,'phrase',{instruments:true});
  assert.equal(locked.instruments,undefined);assert.equal(locked.bank,source.bank);
  assert.notDeepEqual(locked.notes,source.notes);assert.notEqual(locked.values.CUTOFF,source.values.CUTOFF);
  const drumsLocked=rollDice(source,'instruments',{drums:true});
  assert.equal(drumsLocked.bank,source.bank);assert.notDeepEqual(drumsLocked.instruments,INSTRUMENT_DEFAULTS);
  for(let seed=1;seed<=24;seed++) {
    source.groove.seed=seed;
    const next=rollDice(source,'nudge');
    assert.equal(Object.keys(INSTRUMENT_ROLES).filter(role=>next.instruments[role]!==INSTRUMENT_DEFAULTS[role]).length,1);
    assert.equal(next.bank,source.bank);
  }
  const ambient=defaultSet('ambient-drift',layers),next=rollDice(ambient,'instruments');
  assert.equal(next.instruments.bass,'acid');assert.equal(next.instruments.response,'square');assert.notEqual(next.instruments.pad,'warm');
  for(const key of ['notes','steps','bank','values','muted','live','groove']) assert.deepEqual(next[key],ambient[key]);
});

test('old checkpoints extend only on explicit action; keep/reload/restore preserves later manual mix',()=>{
  const original=keepDice(defaultSet('acid-drive',layers));
  delete original.dice.locks.instruments;delete original.dice.anchor.bank;delete original.dice.anchor.instruments;
  const old=readTechnoSet(technoSetCode(original));assert.equal(old.dice.anchor.bank,undefined);
  let changed=rollDice(old,'instruments');assert.equal(changed.dice.anchor.instruments,null);
  const kept=keepDice(changed);
  changed=rollDice(kept,'instruments');changed.values.MASTER=.1;changed.muted=['acid'];changed.bpm=110;
  const restored=restoreDice(readTechnoSet(technoSetCode(changed)));
  assert.deepEqual(restored.instruments,kept.instruments);assert.equal(restored.bank,kept.bank);
  assert.equal(restored.values.MASTER,.1);assert.equal(restored.bpm,110);assert.deepEqual(restored.muted,['acid']);
  assert.equal(restoreDice(rollDice(old,'instruments')).instruments,undefined);
});

test('untrusted voice IDs, versions and checkpoint settings fail closed',()=>{
  for(const invalid of [null,{...INSTRUMENT_DEFAULTS,version:2},{...INSTRUMENT_DEFAULTS,bass:'piano'},{...INSTRUMENT_DEFAULTS,response:'square").gain(100)'}]) {
    const state=defaultSet('acid-drive',layers);state.instruments=invalid;
    assert.throws(()=>technoSetCode(state));
  }
  for(const edit of [s=>s.dice.locks.instruments=1,s=>s.dice.anchor.bank='unknown',s=>s.dice.anchor.instruments={version:1,bass:'fake'}]) {
    const state=keepDice(defaultSet('acid-drive',layers));edit(state);assert.throws(()=>technoSetCode(state));
  }
  for(const voices of Object.values(INSTRUMENT_VOICES)) for(const voice of voices) assert.ok(voice.level>0 && voice.level<=1);
});
