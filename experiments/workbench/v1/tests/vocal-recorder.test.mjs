import test from 'node:test';
import assert from 'node:assert/strict';
import { VocalRecorder, recordingExtension, recordingType } from '../src/vocal-recorder.js';
import { checkTakeRoom, TAKE_LIMIT, BYTE_LIMIT } from '../src/vocal-store.js';

class Track extends EventTarget {
  readyState = 'live'; stops = 0;
  stop() { this.readyState='ended'; this.stops++; }
}
const stream = () => { const track=new Track(); return {getTracks:()=>[track],getAudioTracks:()=>[track],track}; };
class Node {
  constructor(context) { this.context=context; this.connections=new Set(); this.gain={value:1,setTargetAtTime(value){this.value=value;}}; }
  connect(node) { this.connections.add(node); return node; }
  disconnect(node) { if(node) this.connections.delete(node); else this.connections.clear(); }
  getFloatTimeDomainData(values) { values.fill(.25); }
}
class Recorder {
  static made=[]; static isTypeSupported(type) { return type==='audio/webm;codecs=opus'; }
  constructor(stream,options) { this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';Recorder.made.push(this); }
  start() {this.state='recording';}
  stop() {this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['encoded'],{type:this.mimeType})});this.onstop();});}
}
function rig(overrides={}) {
  const ctx={state:'running',currentTime:0};
  ctx.createGain=ctx.createAnalyser=()=>new Node(ctx);
  ctx.createMediaStreamSource=()=>new Node(ctx);
  ctx.createMediaStreamDestination=()=>Object.assign(new Node(ctx),{stream:stream()});
  ctx.destination=new Node(ctx);
  const instrument=new Node(ctx); instrument.connect(ctx.destination);
  let sources=[instrument],take;
  const mic=stream(),audioSession={type:'playback'};
  const recorder=new VocalRecorder({getSources:()=>sources,Recorder,mediaDevices:{getUserMedia:async()=>mic},audioSession,onTake:value=>{take=value;},...overrides});
  return {recorder,ctx,instrument,mic,audioSession,get take(){return take;},sources:value=>{sources=value;}};
}
test('voice recording creates mix, dry voice and backing without speaker monitoring; stop releases only owned nodes',async()=>{
  const r=rig();await r.recorder.arm();
  assert.equal(r.audioSession.type,'play-and-record');
  assert.equal(r.recorder.peak(),.25);
  const micNode=r.recorder.mic,micGain=r.recorder.micGain;
  r.recorder.level(.42);assert.equal(micGain.gain.value,.42);
  r.recorder.start({metadata:{title:'take',lyrics:'original'},withVoice:true});
  assert.deepEqual(r.recorder.recorders.map(x=>x.name),['mix','voice','backing']);
  assert.ok(!micNode.connections.has(r.ctx.destination)); assert.ok(!micGain.connections.has(r.ctx.destination));
  assert.equal(r.instrument.connections.size,2);
  await r.recorder.stop();
  assert.equal(r.take.lyrics,'original');assert.equal(Object.keys(r.take.audio).length,3);
  assert.ok(r.take.audio.mix.size>0); assert.equal(r.recorder.state,'idle');
  assert.deepEqual([...r.instrument.connections],[r.ctx.destination]);
  assert.equal(r.mic.track.stops,1);assert.equal(r.ctx.state,'running');assert.equal(r.audioSession.type,'playback');
});
test('backing-only never requests a microphone and a second take does not duplicate taps',async()=>{
  let requests=0;const r=rig({mediaDevices:{getUserMedia:()=>{requests++;}}});
  for(let i=0;i<2;i++) {r.recorder.start({metadata:{},withVoice:false});assert.equal(r.instrument.connections.size,2);await r.recorder.stop();}
  assert.equal(requests,0);assert.deepEqual(Object.keys(r.take.audio),['mix']);assert.equal(r.instrument.connections.size,1);
});
test('stop during permission request discards a late microphone and restores audio session',async()=>{
  let resolve;const r=rig({mediaDevices:{getUserMedia:()=>new Promise(done=>{resolve=done;})}});
  const requested=r.recorder.arm();r.recorder.disarm();resolve(r.mic);await requested;
  assert.equal(r.mic.track.stops,1);assert.equal(r.recorder.stream,null);assert.equal(r.recorder.state,'idle');assert.equal(r.audioSession.type,'playback');
});
test('permission denial leaves no armed state and can retry',async()=>{
  const r=rig({mediaDevices:{getUserMedia:async()=>{throw new Error('denied');}}});
  await assert.rejects(r.recorder.arm(),/denied/);assert.equal(r.recorder.state,'idle');assert.equal(r.audioSession.type,'playback');
  r.recorder.mediaDevices.getUserMedia=async()=>r.mic;await r.recorder.arm();assert.equal(r.recorder.state,'armed');r.recorder.disarm();
});
test('a replaced output gets exactly one tap; interruption finalizes instead of recording silent indefinitely',async()=>{
  const r=rig();r.recorder.start({metadata:{},withVoice:false});
  const next=new Node(r.ctx);next.connect(r.ctx.destination);r.sources([next]);r.recorder.refresh();r.recorder.refresh();
  assert.equal(r.instrument.connections.size,1);assert.equal(next.connections.size,2);
  r.ctx.state='suspended';r.recorder.refresh();await r.recorder.finishing;
  assert.match(r.take.reason,/音声中断/);assert.equal(next.connections.size,1);
});
test('no playback / wrong context / missing mic fail before encoders or taps',()=>{
  const r=rig();assert.throws(()=>r.recorder.start({metadata:{},withVoice:true}),/マイクを準備/);
  r.sources([]);assert.throws(()=>r.recorder.start({metadata:{},withVoice:false}),/先に演奏/);
  r.sources([r.instrument,new Node({state:'running'})]);assert.throws(()=>r.recorder.context(),/先に演奏/);
  assert.equal(r.instrument.connections.size,1);
});
test('encoder construction failure cleans up microphone and preserves listening output',async()=>{
  class Broken extends Recorder { constructor(){throw new Error('encoder unavailable');} }
  const r=rig({Recorder:Broken});await r.recorder.arm();assert.throws(()=>r.recorder.start({metadata:{}}),/encoder unavailable/);
  assert.equal(r.recorder.state,'idle');assert.equal(r.mic.track.stops,1);assert.equal(r.instrument.connections.size,1);
});
test('microphone device disconnect finishes all streams',async()=>{
  const r=rig();await r.recorder.arm();r.recorder.start({metadata:{}});r.mic.track.dispatchEvent(new Event('ended'));
  await r.recorder.finishing;assert.match(r.take.reason,/マイクが切断/);assert.equal(Object.keys(r.take.audio).length,3);
});
test('bounded shelf rejects count and bytes instead of evicting any take; codec follows supported MIME',()=>{
  const incoming={audio:{mix:new Blob(['take'])}};
  checkTakeRoom([],incoming);
  assert.throws(()=>checkTakeRoom(Array(TAKE_LIMIT).fill(incoming),incoming),/上限/);
  assert.throws(()=>checkTakeRoom([{audio:{mix:{size:BYTE_LIMIT}}}],incoming),/上限/);
  assert.equal(recordingType(Recorder),'audio/webm;codecs=opus');assert.equal(recordingExtension('audio/mp4'),'m4a');
  assert.throws(()=>recordingType(null),/対応していません/);
});
