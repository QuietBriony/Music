import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../src/vocal-booth.js',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf('  function renderPlayback()'),source.indexOf("  $('gain').addEventListener"));
function rig() {
  const elements=new Map();
  const $=id=>{
    if (!elements.has(id)) elements.set(id,{value:id==='mode'?'backing':'',listeners:{},
      addEventListener(name,fn){this.listeners[name]=fn;},pause(){this.paused=true;}});
    return elements.get(id);
  };
  let sources=[],busy=false,starts=0,stops=0,finish,fail;
  const gate=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
  const recorder={active:false,state:'idle',stream:null};
  const context=vm.createContext({$,recorder,playPending:false,playGeneration:0,getSources:()=>sources,
    isBusy:()=>busy,say:text=>{$('status').textContent=text;},
    playPlayback:()=>{starts++;return gate;},stopPlayback:()=>{stops++;sources=[];}});
  vm.runInContext(handlers,context);
  return {$,recorder,context,finish,fail,click:id=>$(id).listeners.click(),render:()=>context.renderPlayback(),
    get starts(){return starts;},get stops(){return stops;},setBusy:value=>{busy=value;},
    playing:()=>{sources=[{context:{state:'running'}}];}};
}
test('reader restart pauses audition, gates recording, and never requests mic or recording',async()=>{
  const r=rig();r.render();assert.equal(r.$('record').disabled,true);
  const start=r.click('play');assert.equal(r.$('player').paused,true);
  assert.equal(r.$('play').disabled,true);assert.equal(r.$('pause').disabled,false);
  assert.equal(r.$('record').disabled,true);await r.click('play');assert.equal(r.starts,1);
  r.playing();r.finish();await start;
  assert.equal(r.$('record').disabled,false);assert.equal(r.$('play-state').textContent,'演奏中');
  assert.equal(r.recorder.state,'idle');assert.equal(r.recorder.stream,null);
  r.$('mode').value='voice';r.render();assert.equal(r.$('record').disabled,true);
});
test('stopping a pending restart keeps its status when a stale start rejects',async()=>{
  const r=rig(),start=r.click('play');r.click('pause');const stopped=r.$('status').textContent;
  r.fail(new Error('late failure'));await start;
  assert.equal(r.stops,1);assert.equal(r.$('status').textContent,stopped);
  assert.equal(r.$('play').disabled,false);assert.equal(r.$('record').disabled,true);
});
test('recording and mic permission wait protect the live transport; external busy also gates start',async()=>{
  const r=rig();r.playing();r.recorder.active=true;r.render();
  assert.equal(r.$('pause').disabled,true);await r.click('play');r.click('pause');
  assert.equal(r.starts,0);assert.equal(r.stops,0);
  r.recorder.active=false;r.recorder.state='requesting';r.render();r.click('pause');assert.equal(r.stops,0);
  r.recorder.state='idle';r.setBusy(true);r.render();assert.equal(r.$('record').disabled,true);
  await r.click('play');assert.equal(r.starts,0);
});
