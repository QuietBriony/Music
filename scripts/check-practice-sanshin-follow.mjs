import assert from 'node:assert/strict';
import { SanshinFollower,detectSanshinPitch,sanshinAttack } from '../practice/sanshin-follow.mjs';
import { frequencyFor,centsFrom,detectPitch } from '../practice/music.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { asatoyaMidi,asatoyaNotes,ASATOYA_PARTS } from './build-practice-asatoya.mjs';
import { parseMidi } from '../practice/midi.mjs';
import { scoreNotes } from '../practice/scores.mjs';
import { sheetEntries } from '../practice/full-score.mjs';
const data=readFileSync('practice/songs/asatoya.mid'),meta=JSON.parse(readFileSync('practice/songs/asatoya-provenance.json','utf8'));
assert.deepEqual(data,asatoyaMidi(),'Native Asatoya is reproducible from the elementary score');assert.equal(createHash('sha256').update(data).digest('hex'),meta.sha256);
const parsed=parseMidi(data),notes=scoreNotes(parsed,parsed.groups[0].id,'sanshin').notes;
assert.equal(notes.length,92);assert.equal(parsed.endBeat,97);assert.equal(ASATOYA_PARTS.length,6);assert.equal(sheetEntries(notes).filter(n=>n.rest).length,4);
assert.equal(meta.license,'CC0-1.0');assert.ok(!meta.lyrics.includes('サア'));assert.equal(asatoyaNotes().at(-1).beats,2);
for(const transpose of [-3,-2,-1,0,2]){const shifted=scoreNotes(parsed,parsed.groups[0].id,'sanshin',{tuning:transpose}).notes;assert.deepEqual(shifted.map(n=>n.symbol),notes.map(n=>n.symbol));assert.deepEqual(shifted.map(n=>n.midi),notes.map(n=>n.midi+transpose));}
const signal=(midi,extra={})=>({frequency:frequencyFor(midi),rms:.02,clarity:.8,attack:.0005,...extra});
const gap={frequency:null,clarity:0,rms:.003,attack:.0001};
const soft=new SanshinFollower([{midi:53}],{gate:.0015});
soft.feed(signal(53),0);soft.feed(signal(53),45);assert.equal(soft.feed(signal(53),90).done,true,'A short bright string with moderate clarity is enough');
const interrupted=new SanshinFollower([{midi:53}],{gate:.0015});
interrupted.feed(signal(53),0);interrupted.feed(signal(53),45);interrupted.feed(gap,90);interrupted.feed(gap,135);assert.equal(interrupted.feed(signal(53),180).matched,false);assert.equal(interrupted.feed(signal(53),225).done,true,'Short pitch dropouts retain evidence, without counting missing time');
const absent=new SanshinFollower([{midi:53}],{gate:.0015});absent.feed(signal(53),0);for(let t=45;t<800;t+=45)assert.equal(absent.feed(gap,t).matched,false);assert.equal(absent.feed(signal(53),900).matched,false,'Silence cannot complete an isolated pitch');
for(const wrong of [52,54,41,65]){const f=new SanshinFollower([{midi:53}]);for(let t=0;t<1000;t+=45)assert.equal(f.feed(signal(wrong),t).matched,false,'Wrong semitone or octave cannot advance');}
for(const detune of [-50,50]){const f=new SanshinFollower([{midi:53}]);const s=signal(53,{frequency:frequencyFor(53)*2**(detune/1200)});f.feed(s,0);f.feed(s,45);assert.equal(f.feed(s,90).done,true,'Fretless beginners have room to approach the note');}
const repeat=new SanshinFollower([{midi:53},{midi:53}]);repeat.feed(signal(53),0);repeat.feed(signal(53),45);assert.equal(repeat.feed(signal(53),90).matched,true);
for(let t=135;t<800;t+=45)assert.equal(repeat.feed(signal(53,{rms:.012,attack:.0003}),t).matched,false,'Sustained ringing never consumes a repeated note');
repeat.feed(signal(53,{rms:.016,attack:.0012}),810);repeat.feed(signal(53,{rms:.0155,attack:.0008}),855);assert.equal(repeat.feed(signal(53,{rms:.015,attack:.0006}),900).done,true,'A modest new bachi attack can count over a ringing tail');
const click=new SanshinFollower([{midi:53},{midi:53}]);click.feed(signal(53),0);click.feed(signal(53),45);click.feed(signal(53),90);for(let t=135;t<800;t+=45)click.feed(signal(53,{rms:.012,attack:.0003}),t);
click.feed(signal(53,{rms:.03,clarity:.3,attack:.006}),810);for(let t=855;t<1700;t+=45)assert.equal(click.feed(signal(53,{rms:.012,attack:.0003}),t).matched,false,'A short unpitched click over an old tail cannot advance');
const delayed=new SanshinFollower([{midi:53},{midi:53}]);delayed.feed(signal(53),0);delayed.feed(signal(53),45);delayed.feed(signal(53),90);for(let t=135;t<800;t+=45)delayed.feed(signal(53,{rms:.012,attack:.0003}),t);
delayed.feed(signal(53,{rms:.0133,attack:.0012}),810);delayed.feed(signal(53,{rms:.017,attack:.0008}),855);delayed.feed(signal(53,{rms:.017,attack:.0007}),900);assert.equal(delayed.feed(signal(53,{rms:.0165,attack:.0006}),945).done,true,'Attack and windowed RMS can rise in neighboring frames');
const gain=new SanshinFollower([{midi:53},{midi:53}]);gain.feed(signal(53),0);gain.feed(signal(53),45);gain.feed(signal(53),90);gain.rebaseEnvelope();gain.armed=false;gain.lastRms=.08;for(let t=500;t<1200;t+=45)assert.equal(gain.feed(signal(53,{rms:.08,attack:.002}),t).matched,false,'A gain adjustment is not a pluck');
let seed=445,improved=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32-.5)*2;
for(const rate of [44100,48000])for(const midi of [45,48,50,52,53,55,57,60,62,64,67,69])for(const detune of [-30,0,30]){
 const hz=frequencyFor(midi)*2**(detune/1200);const samples=Float32Array.from({length:4096},(_,i)=>{const p=2*Math.PI*hz*i/rate;return .004*(Math.sin(p)+.85*Math.sin(p*2)+.45*Math.sin(p*3))+.0018*random();});
 const heard=detectSanshinPitch(samples,rate,.0015);assert.ok(heard.frequency&&Math.abs(centsFrom(heard.frequency,midi)-detune)<12,`Independent quiet string ${rate}/${midi}/${detune}`);assert.ok(heard.attack>=0);
 const previous=detectPitch(samples,rate,.0015);if(!previous.frequency)improved++;
 const wrong=new SanshinFollower([{midi:midi+1}],{gate:.0015});if(detune<=0){wrong.feed(heard,0);wrong.feed(heard,45);assert.equal(wrong.feed(heard,90).matched,false,'A quiet lower neighbor cannot be mistaken for its target');}
}
for(const samples of [new Float32Array(4096),new Float32Array(4096).fill(.1),Float32Array.from({length:4096},()=>random()*.03)])assert.equal(detectSanshinPitch(samples,48000,.0015).frequency,null,'Silence/DC/unpitched noise cannot advance');
let noisyFrames=0,oldMisses=0;
for(const midi of [48,53,60]){
 const follower=new SanshinFollower([{midi}],{gate:.0015}),hz=frequencyFor(midi);
 for(let frame=0;frame<12;frame++){
  const samples=Float32Array.from({length:4096},(_,i)=>{const p=2*Math.PI*hz*(i+frame*2160)/48000;return .004*(Math.sin(p)+.85*Math.sin(p*2)+.45*Math.sin(p*3))+.003*random();});
  const detection=detectSanshinPitch(samples,48000,.0015),old=detectPitch(samples,48000,.0015);
  if(detection.frequency){assert.ok(Math.abs(centsFrom(detection.frequency,midi))<35, `noisy ${midi}/${frame}: ${centsFrom(detection.frequency,midi)}`);noisyFrames++;if(!old.frequency)oldMisses++;}
  follower.feed(detection,frame*45);
 }
 assert.equal(follower.done,true,'A noisy string progresses using real voiced observations across short dropouts');
}
assert.ok(oldMisses>0,'Independent noisy-string fixtures reproduce strict pitch dropouts');
assert.equal(sanshinAttack(new Float32Array(4096).fill(.1),48000),0);
const between=new Float32Array(4096);for(let i=between.length-1800;i<between.length-1300;i++)between[i]=.01*(i%2?1:-1);
assert.ok(sanshinAttack(between,48000)>.005,'A bachi transient between callbacks is still observed');
const oldTransient=new Float32Array(4096);for(let i=20;i<100;i++)oldTransient[i]=.01*(i%2?1:-1);assert.equal(sanshinAttack(oldTransient,48000),0,'An old transient does not keep rearming notes');
console.log(`Sanshin follow: 72 quiet/detuned pitch fixtures, three noisy string sequences, short voiced evidence, dropouts, fresh bachi attacks over tails, click/gain rejection and exact pitch boundaries PASS (${oldMisses} formerly missed noisy pitch frames)`);
