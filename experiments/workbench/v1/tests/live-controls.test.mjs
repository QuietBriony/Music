import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultSet, technoSetCode, readTechnoSet, liveFrame } from '../src/live-code.js';
import { defaultSet as oldDefault, technoSetCode as oldCode } from '../src/performance-code.js';
import { defaultSet as grooveDefault, technoSetCode as grooveCode } from '../src/groove-code.js';
import { setTempoChanges, liveReadouts } from '../src/live-controls.js';
import { SliderBridge, sliderDeclarations } from '../src/slider-bridge.js';
import { AudioPlayback } from '../src/audio-playback.js';

const layers = await Promise.all(['techno-dub','namima-test'].map(async id => ({
  id, title:id, source:await readFile(new URL('../src/patterns/'+id+'.txt', import.meta.url),'utf8'),
})));
function patch(code, changes) {
  for (const change of [...changes].sort((a,b) => b.from-a.from)) {
    code = code.slice(0,change.from)+change.insert+code.slice(change.to);
  }
  return code;
}

test('live tempo patches round-trip V1/V2/V3 without rewriting musical bodies or upgrading old scores', () => {
  for (const [make, generate] of [[oldDefault,oldCode],[grooveDefault,grooveCode],[defaultSet,technoSetCode]]) {
    const state = make('acid-drive',layers);
    state.notes[3]='f2'; state.muted=['hh']; state.values.CUTOFF=1800;
    let code = generate(state);
    const body = code.slice(code.indexOf('function liveFrame') >= 0 ? code.indexOf('function liveFrame') : code.indexOf('const setLayerA'));
    for (const bpm of [60,99,137,180]) {
      code = patch(code, setTempoChanges(code,bpm));
      assert.deepEqual(readTechnoSet(code), {...state,bpm});
      assert.ok(code.endsWith(body));
      assert.equal(code,generate({...state,bpm}));
    }
  }
  const code=technoSetCode(defaultSet('acid-drive',layers));
  for (const bpm of [NaN,59,181,120.5]) assert.throws(() => setTempoChanges(code,bpm));
  assert.throws(() => setTempoChanges(code+'\n// keep my hand edit',120));
});

test('a tempo digit-length change preserves live fader signal IDs without evaluating the score', () => {
  const mirror={code:technoSetCode(defaultSet('acid-drive',layers))};
  mirror.widgets=sliderDeclarations(mirror.code);
  mirror.editor={dispatch({changes}) { mirror.code=patch(mirror.code,Array.isArray(changes)?changes:[changes]); }};
  const signals=new Map();
  const bridge=new SliderBridge(() => mirror,{setSignal:(id,v) => signals.set(id,v),updateWidgets:()=>{}});
  bridge.capture();
  const id='slider_'+mirror.widgets.find(s => s.name==='SET_CUTOFF').from;
  mirror.editor.dispatch({changes:setTempoChanges(mirror.code,99)});
  bridge.refresh();
  bridge.set('SET_CUTOFF',1200,true);
  assert.equal(signals.get(id),1200);
  assert.equal(readTechnoSet(mirror.code).bpm,99);
  assert.equal(readTechnoSet(mirror.code).values.CUTOFF,1200);
});

test('automatic control readouts follow the same LIVE frame, manual mutes and motion zero', () => {
  const state=defaultSet('acid-drive',layers), snapshot=structuredClone(state);
  const frame=liveFrame(state.live,state.groove.seed,17,state.auto,state.scene);
  const values=liveReadouts(state,frame);
  assert.equal(values.get('ACID'),state.values.ACID*frame.acid);
  assert.equal(values.get('CUTOFF'),state.values.CUTOFF*(1+state.values.MOTION*(frame.tone-1)));
  assert.equal(values.has('MASTER'),false); assert.equal(values.has('BPM'),false);
  assert.deepEqual(state,snapshot,'visual feedback does not write automation into manual values');
  state.values.MOTION=0; state.muted=['acid','hh'];
  assert.equal(liveReadouts(state,frame).get('CUTOFF'),state.values.CUTOFF);
  assert.equal(liveReadouts(state,frame).get('ACID'),0);
  assert.equal(liveReadouts(state,frame).get('HATS'),0);
  const soft=defaultSet('ambient-drift',layers);
  const ambient=liveReadouts(soft,liveFrame(soft.live,soft.groove.seed,33,true,soft.scene));
  assert.equal(ambient.get('KICK'),0); assert.ok(ambient.get('AIR')>0);
  assert.equal(liveReadouts(null,frame).size,0);
});

function audioFixture(navigator={audioSession:{type:'auto'}}) {
  const context=new EventTarget(); context.state='suspended';
  const calls={contexts:0,resumes:0,inits:0,notifications:0};
  context.resume=async () => { calls.resumes++; context.state='running'; context.dispatchEvent(new Event('statechange')); };
  const audio=new AudioPlayback(() => { calls.contexts++; return context; },async () => {calls.inits++;},navigator,()=>{calls.notifications++;});
  return {audio,context,calls,navigator};
}
test('audio stays lazy, initializes once, but resumes again after stop or output interruption',async () => {
  const {audio,context,calls,navigator}=audioFixture();
  assert.equal(calls.contexts,0); assert.equal(calls.resumes,0);
  await audio.prepare(); context.state='interrupted'; await audio.prepare();
  assert.equal(navigator.audioSession.type,'playback');
  assert.equal(calls.inits,1); assert.equal(calls.resumes,2);
  assert.equal(context.state,'running'); assert.ok(calls.notifications>=2);
});
test('unsupported sessions fall back, and rejected resume/worklet init can retry without a new graph',async () => {
  const {audio,context,calls}=audioFixture({});
  let fail=true;
  context.resume=async () => {calls.resumes++; if (fail) throw new Error('interrupted'); context.state='running';};
  await assert.rejects(audio.prepare(),/interrupted/); fail=false;
  await audio.prepare(); assert.equal(calls.inits,1); assert.equal(audio.context,context);
  const second=audioFixture(); let initFailed=true;
  second.audio.initAudio=async () => {second.calls.inits++;if(initFailed) throw new Error('worklet');};
  await assert.rejects(second.audio.prepare(),/worklet/);initFailed=false;
  await second.audio.prepare();assert.equal(second.calls.inits,2);
  context.state='closed';await assert.rejects(audio.prepare(),/再読込/);
});
test('concurrent recovery shares one resume and reports contexts that remain interrupted',async () => {
  const {audio,context,calls}=audioFixture();
  let done;
  context.resume=() => {calls.resumes++;return new Promise(resolve => {done=resolve;});};
  const first=audio.prepare(),second=audio.prepare();
  assert.equal(calls.resumes,1); assert.equal(calls.inits,1);
  context.state='running';done();await Promise.all([first,second]);
  context.resume=async () => {}; context.state='interrupted';
  await assert.rejects(audio.prepare(),/音を再接続/);
});
