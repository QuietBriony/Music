import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {defaultSet,technoSetCode,readTechnoSet} from '../src/live-code.js';
import {rollDice,keepDice,restoreDice} from '../src/musical-dice.js';
import {INSTRUMENT_ROLES, INSTRUMENT_VOICES, instrumentProfile} from '../src/instrument-voices.js';

const source=await readFile(new URL('../src/performance.js',import.meta.url),'utf8');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0 && end>start);return source.slice(start,end);};
const layers=await Promise.all(['techno-dub','namima-test'].map(async id=>({id,title:id,source:await readFile(new URL('../src/patterns/'+id+'.txt',import.meta.url),'utf8')})));

function harness(){
  const controls=new Map();
  const control=id=>{
    if(!controls.has(id)) controls.set(id,{checked:false,listeners:{},options:[],append(option){this.options.push(option);},addEventListener(event,fn){this.listeners[event]=fn;}});
    return controls.get(id);
  };
  let code=technoSetCode(defaultSet('acid-drive',layers)),changes=0;
  const context=vm.createContext({structuredClone,rollDice,keepDice,restoreDice,readTechnoSet,technoSetCode,INSTRUMENT_ROLES,INSTRUMENT_VOICES,instrumentProfile,
    el:(_tag,title)=>({textContent:title}),
    state:readTechnoSet(code),loading:false,blocked:false,dicePanel:{},diceStatus:{dataset:{}},
    drumsLock:control('#set-dice-drums-lock'),toneLock:control('#set-dice-tone-lock'),
    instrumentsLock:control('#set-dice-instruments-lock'),
    document:{querySelector:control},hooks:{getCode:()=>code,isBusy:()=>context.blocked,
      changeCode:next=>{code=next;changes++;context.state=readTechnoSet(code);}},
  });
  vm.runInContext('function sync(){'+section('    dicePanel.disabled =','    document.querySelector(\'#set-upgrade\')')+'}\n'
    +section('  function mutate(', '  async function loadLayer(')
    +section('  const instrumentSelects =','  for (const [id,title] of LIVE_MODES)')
    +section("  for (const [id, kind] of [['set-roll-dice'",'  variation.addEventListener('),context);
  context.sync();
  return {context,controls,click:id=>control(id).listeners.click(),change:id=>control(id).listeners.change(),
    state:()=>readTechnoSet(code),count:()=>changes,setCode:next=>{code=next;context.state=readTechnoSet(next);context.sync();}};
}

test('production buttons preserve checked locks, update saved score and restore a kept groove',()=>{
  const h=harness(),original=h.state();
  h.controls.get('#set-dice-drums-lock').checked=true;h.change('#set-dice-drums-lock');
  assert.equal(h.context.drumsLock.checked,true);
  h.click('#set-roll-dice');
  assert.deepEqual(h.state().steps,original.steps);assert.notDeepEqual(h.state().notes,original.notes);
  assert.match(h.context.diceStatus.textContent,/候補 1/);
  const kept=h.state();h.click('#set-keep-dice');
  h.context.sync();assert.match(h.context.diceStatus.textContent,/ここを戻り先にしました/, 'queued UI refresh preserves the action feedback');
  h.click('#set-nudge-dice');assert.match(h.context.diceStatus.textContent,/候補 2/, 'the next action replaces the feedback');
  h.click('#set-restore-dice');h.context.sync();assert.match(h.context.diceStatus.textContent,/戻しました/);
  assert.deepEqual(h.state().notes,kept.notes);assert.deepEqual(h.state().values,kept.values);assert.deepEqual(h.state().instruments,kept.instruments);
  assert.equal(h.controls.get('#set-restore-dice').disabled,false);
});

test('production instrument-only button and manual selectors save, lock and restore voices',()=>{
  const h=harness(),original=h.state();
  h.click('#set-instrument-dice');
  assert.deepEqual(h.state().notes,original.notes);assert.deepEqual(h.state().steps,original.steps);assert.deepEqual(h.state().values,original.values);
  assert.equal(h.context.document.querySelector('#set-instrument-bass').value,h.state().instruments.bass);
  h.click('#set-restore-dice');assert.equal(h.state().instruments,undefined);assert.equal(h.state().bank,original.bank);
  const select=h.controls.get('#set-instrument-response');assert.equal(select.options.length,3);
  select.value='glass';h.change('#set-instrument-response');assert.equal(h.state().instruments.response,'glass');
  h.context.instrumentsLock.checked=true;h.change('#set-dice-instruments-lock');
  const profile=h.state().instruments;h.click('#set-roll-dice');assert.deepEqual(h.state().instruments,profile);
  assert.equal(h.controls.get('#set-instrument-dice').disabled,true);
  select.value='pluck';h.change('#set-instrument-response');assert.equal(h.state().instruments.response,'pluck','lock only affects dice');
});

test('production mutation guard rejects busy and hand-edited scores; legacy does not expose dice',()=>{
  const h=harness();h.context.blocked=true;h.click('#set-roll-dice');assert.equal(h.count(),0);
  h.context.blocked=false;h.setCode(technoSetCode(h.state()).replace('.postgain(0.38)','.postgain(0.2)'));
  h.click('#set-roll-dice');assert.equal(h.count(),0);assert.equal(h.context.dicePanel.hidden,true);
  const old=defaultSet('acid-drive',layers);delete old.live;delete old.shadow;
  h.setCode(technoSetCode(old));assert.equal(h.context.dicePanel.hidden,true);assert.equal(h.context.dicePanel.disabled,true);
});
