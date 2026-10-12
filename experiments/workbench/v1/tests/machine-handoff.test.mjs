import test from 'node:test';
import assert from 'node:assert/strict';
import { carryMachine, takeMachine } from '../src/machine-rack/handoff.js';

test('the standalone phrase, selected pattern and locks transfer once without saving over a FILE',()=>{
  const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  const data={exportFullState:()=> 'encoded-full-patterns',currentPatternId:7,mode:'pattern',unitLocks:{tb303_1:true,tb303_2:false,tr909:true}};
  carryMachine(data,storage);
  const target={unitLocks:{},importState(code){this.code=code;this.mode='song';}};
  class Decoder {decode(code){assert.equal(code,'encoded-full-patterns');}}
  assert.equal(takeMachine(target,storage,Decoder),true);
  assert.equal(target.currentPatternId,7);assert.deepEqual(target.unitLocks,data.unitLocks);
  assert.equal(target.mode,'pattern','full FILE decoding must not disable live rack edits');
  assert.equal(takeMachine(target,storage,Decoder),false);
});
test('invalid handoff cannot call the native reset-on-error importer',()=>{
  let imported=false;
  const data={unitLocks:{},importState(){imported=true;}};
  const storage={getItem:()=>JSON.stringify({code:'bad',pattern:0,mode:'pattern'}),removeItem(){}};
  class Decoder {decode(){throw new Error('invalid');}}
  assert.throws(()=>takeMachine(data,storage,Decoder),/invalid/);assert.equal(imported,false);
});
