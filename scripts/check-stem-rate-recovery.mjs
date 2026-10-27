import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

// WebKit's ConvolverNode rejects buffers whose rate differs from the current
// context. Model an audio session changing rate while Band Room is open.
class Param { constructor() { this.value=0; } cancelScheduledValues() {} setValueAtTime(v) { this.value=v; } linearRampToValueAtTime(v) { this.value=v; } }
class Node {
  constructor() { for(const key of ['gain','frequency','Q','delayTime','pan','playbackRate'])this[key]=new Param();this.links=[]; }
  connect(n) { this.links.push(n);return n; } disconnect(n) { this.links=n?this.links.filter(x=>x!==n):[]; }
  start() {} stop() {}
}
function makeContext() {
  const ctx={sampleRate:44100,currentTime:1,state:'running',convolverCount:0,rejectRoom:false,rejectSpring:false,otherError:false,retainNull:false,nullWrites:0,
    createGain:()=>new Node(),createBiquadFilter:()=>new Node(),createStereoPanner:()=>new Node(),
    createWaveShaper:()=>new Node(),createDelay:()=>new Node(),createBufferSource:()=>new Node(),
    createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {sampleRate,length,numberOfChannels:channels,duration:length/sampleRate,getChannelData:i=>data[i]};},
    createConvolver(){const n=new Node(),id=this.convolverCount++;let b=null;Object.defineProperty(n,'buffer',{get:()=>b,set:value=>{
      if(value===null){ctx.nullWrites++;if(ctx.retainNull&&b!==null)value=ctx.createBuffer(1,1,44100);}
      if(value && ctx.otherError) throw Error('unrelated failure');
      if(value && (value.sampleRate!==ctx.sampleRate || (id===0?ctx.rejectRoom:ctx.rejectSpring))) {
        const e=Error("Buffer sample rate does not match the context's sample rate");e.name='NotSupportedError';throw e;
      } b=value;
    }});return n;}};
  return ctx;
}
const sandbox={console,Float32Array,setTimeout:()=>1,clearTimeout(){}};vm.createContext(sandbox);
for(const path of ['audio/dub-arrangement.js','audio/dub-mix.js','audio/stem-live-mix.js']){
  const code=process.env.MUSIC_RATE_BASELINE==='1'?execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}):readFileSync(path,'utf8');
  vm.runInContext(code,sandbox);
}
// Model Tone 14's real null-buffer workaround: on Safari retaining a cleared
// native buffer, the wrapper tries a 44100 Hz dummy even in a 48000 Hz context.
const safari=makeContext();safari.sampleRate=48000;safari.retainNull=true;
const safariMix=sandbox.RecordedStemMix.create(safari);
assert.doesNotThrow(()=>safariMix.setRoomActive(true),'Reset must avoid the Tone/Safari 44100 Hz null-buffer workaround');
assert.doesNotThrow(()=>safariMix.stopDub());
assert.doesNotThrow(()=>safariMix.setLevel('vocals',0));
assert.doesNotThrow(()=>safariMix.setLevel('vocals',.8));
assert.doesNotThrow(()=>safariMix.dispose());
assert.equal(safari.nullWrites,0,'No room reset/dispose should invoke the null-buffer workaround');
const ctx=makeContext(),mix=sandbox.RecordedStemMix.create(ctx);
ctx.sampleRate=48000;
assert.doesNotThrow(()=>mix.setRoomActive(true),'Rate change must rebuild the room IR before it is assigned');
assert.equal(mix.diagnostics().roomSampleRate,48000);
assert.equal(mix.diagnostics().roomRateFallback,false);
ctx.rejectRoom=true;
assert.doesNotThrow(()=>mix.setRoomActive(true),'A WebKit mismatch must not stop direct stem playback');
assert.equal(mix.diagnostics().roomRateFallback,true);
assert.ok(Object.values(mix.inputs).every(n=>n.links.length),'All four input paths remain connected');
ctx.rejectRoom=false;
mix.setRoomActive(true);
assert.equal(mix.diagnostics().roomRateFallback,false,'Room recovers when the rate mismatch clears');

const sample=new Float32Array(8000*240);
const buffer={sampleRate:8000,length:sample.length,numberOfChannels:1,duration:240,getChannelData:()=>sample};
const buffers=Object.fromEntries(['vocals','drums','bass','other'].map(p=>[p,buffer]));
const options={bpm:117.45,duration:239.491,rate:1,offset:118,at:1};
const safariDub=makeContext();safariDub.sampleRate=48000;safariDub.retainNull=true;
const safariDubMix=sandbox.RecordedStemMix.create(safariDub);
assert.doesNotThrow(()=>safariDubMix.startDub(options,buffers));
assert.doesNotThrow(()=>safariDubMix.setDubMuted('drums',true));
assert.doesNotThrow(()=>safariDubMix.stopDub());
assert.doesNotThrow(()=>safariDubMix.dispose());
assert.equal(safariDub.nullWrites,0,'Dub cleanup must avoid the same null-buffer workaround');
ctx.rejectSpring=true;
assert.doesNotThrow(()=>mix.startDub(options,buffers),'A spring mismatch must retain Dub echo and stems');
assert.equal(mix.diagnostics().dub.springRateFallback,true);
assert.equal(mix.diagnostics().dub.loops.jobs.length,2);
assert.doesNotThrow(()=>mix.setDubMuted('drums',true));
assert.doesNotThrow(()=>mix.stopDub());
ctx.rejectSpring=false;
ctx.sampleRate=44100;
mix.startDub(options,buffers);
assert.equal(mix.diagnostics().roomSampleRate,44100);
assert.equal(mix.diagnostics().dub.springRateFallback,false);
assert.equal(mix.diagnostics().dub.springBytes,388080,'Spring cache follows the current sample rate');
mix.dispose();

const bad=makeContext();bad.otherError=true;
assert.throws(()=>sandbox.RecordedStemMix.create(bad),/unrelated failure/,'Only sample-rate mismatches are recoverable');
console.log('Stem rate recovery: changed rate, WebKit mismatch fallback, Dub echo, mute, stop and recovery passed');
