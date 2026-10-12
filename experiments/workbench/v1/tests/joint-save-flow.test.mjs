import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {normalizeJointState,captureMachineState} from '../src/machine-state.js';
import {BinaryFormatEncoder} from '../third_party/acidbros/js/data/BinaryFormatEncoder.js';
import {BinaryFormatDecoder} from '../third_party/acidbros/js/data/BinaryFormatDecoder.js';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function section(a,b) {const start=app.indexOf(a),end=app.indexOf(b,start);assert.ok(start>=0&&end>start);return app.slice(start,end);}
const handlers=section('function captureJoint()', '// Place the still-empty iframe');

function harness() {
  const data=new BinaryFormatDecoder().createDefaultState();
  const machine=captureMachineState({...data,currentPatternId:3,mode:'pattern',keepSoundSettings:false,
    unitLocks:{tb303_1:false,tb303_2:true,tr909:false},active909Tracks:['bd','sd','ch','oh'],
    exportFullState:()=>new BinaryFormatEncoder().toBase64URL(new BinaryFormatEncoder().encodeFull(data)),
  },{tempo:125,swing:57});
  let drafts=[],code='setcpm(19)\n// handwritten body',state=structuredClone(machine),playing=true,failWrite=false,failEditor=false;
  const c=createContext({normalizeJointState,joint:true,jointBaseline:'',loadedCode:'old code',
    jointLevel:{value:'.42'},jointStatus:{},status:{},draftTitle:{value:'好きな組み合わせ'},draftDetails:{},draftForm:{hidden:false},
    MAX_CODE_LENGTH:1e6,window:{crypto:{randomUUID:()=> 'joint-one'}},
    currentCode:()=>code,readDrafts:()=>structuredClone(drafts),
    writeDrafts(value){if(failWrite)throw Error('quota'); drafts=structuredClone(value);},
    setCurrentSelection(value){c.activeSelection=value;},setWorkUrl(){},renderDrafts(){},focusSaveButton(){},
    document:{querySelector:()=>({}),body:{classList:{contains:()=>true}}},
    setJoint(){playing=false;},readTechnoSet:()=>true,performance:{show(){}},
    setEditorCode(value){if(failEditor&&value==='new code')throw Error('editor failure');code=value;c.loadedCode=value;},
    machineLink:{capture:()=>structuredClone(state),validate(){},restore(value){state=structuredClone(value);},setLevel(){}},
  });
  runInContext(handlers+'\n'+section('function saveDraft(event)', 'async function deleteDraft('),c);
  return {c,machine,get drafts(){return drafts;},get code(){return code;},get state(){return state;},get playing(){return playing;},
    failWrite(){failWrite=true;},failEditor(){failEditor=true;},edit(){state.locks.tr909=!state.locks.tr909;code+='\n// new edit';},
    save(){c.saveDraft({preventDefault(){}});}};
}
test('combined save retains exact handwritten code, restores both sides stopped and detects machine-only edits',async()=>{
  const h=harness();h.save();const saved=h.drafts[0];assert.equal(saved.code,h.code);assert.equal(saved.joint.level,.42);
  assert.equal(h.c.hasUnsavedJointChanges(),false);h.c.machineLink.restore({...h.machine,locks:{...h.machine.locks,tr909:true}});
  assert.equal(h.c.hasUnsavedJointChanges(),true);h.edit();await h.c.restoreJointDraft(saved);
  assert.equal(h.code,saved.code);assert.deepEqual(h.state,saved.joint.machine);assert.equal(h.playing,false);
  assert.equal(h.c.hasUnsavedJointChanges(),false);assert.equal(h.c.jointLevel.value,'0.42');
});
test('quota failure does not mark edits saved or replace existing versions',()=>{
  const h=harness();h.save();const before=JSON.stringify(h.drafts),baseline=h.c.jointBaseline,loaded=h.c.loadedCode;
  h.edit();h.failWrite();h.save();assert.equal(JSON.stringify(h.drafts),before);assert.equal(h.c.jointBaseline,baseline);
  assert.equal(h.c.loadedCode,loaded);assert.match(h.c.status.textContent,/保存できません/);assert.equal(h.c.hasUnsavedJointChanges(),true);
});
test('malformed restore leaves current code intact; editor failure rolls back machine and dirty baseline',async()=>{
  const h=harness();h.save();h.edit();const before=h.code,loaded=h.c.loadedCode,state=structuredClone(h.state);
  await assert.rejects(h.c.restoreJointDraft({...h.drafts[0],joint:{version:5}}));assert.equal(h.code,before);
  h.failEditor();await assert.rejects(h.c.restoreJointDraft({...h.drafts[0],code:'new code'}),/editor failure/);
  assert.equal(h.code,before);assert.equal(h.c.loadedCode,loaded);assert.deepEqual(h.state,state);
});
