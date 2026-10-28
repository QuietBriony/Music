import assert from 'node:assert/strict';
import { detectChord,ChordGate } from '../practice/polyphonic.mjs';
import { CHORDS,chordNotes } from '../practice/chords.mjs';
import { spectrum } from './lib/practice-signal-fixtures.mjs';
let tested=0;
for(const rate of [44100,48000])for(const options of [{},{detune:10},{harmonics:[1,.25,.1,.08,.02]},{harmonics:[.6,1,.6,.3,.15,.08,.03]},{noise:.015}])for(const name of Object.keys(CHORDS)){
  const result=detectChord(spectrum(chordNotes(name).map(n=>n.midi),rate,options),rate,16384,{rms:.1});
  assert.equal(result.name,name.split('/')[0],`${name} at ${rate}, ${JSON.stringify(options)}`);assert.ok(result.confidence>=.65);tested++;
}
for(let midi=36;midi<=80;midi++)for(const harmonics of [[1,.5,.25,.1],[.6,1,.6,.3,.15,.08,.03]]){
  assert.equal(detectChord(spectrum([midi],48000,{harmonics}),48000,16384,{rms:.1}).name,null,`single ${midi} must abstain`);
}
for(const pair of [[40,47],[48,52],[48,55],[45,48],[50,57],[55,59]])assert.equal(detectChord(spectrum(pair),48000,16384,{rms:.1}).name,null,`two notes ${pair} must abstain`);
assert.equal(detectChord(spectrum([],48000,{noise:1}),48000,16384,{rms:.1}).name,null,'noise must abstain');
assert.equal(detectChord(new Float32Array(8192).fill(-Infinity),48000,16384,{rms:0}).name,null);
const gate=new ChordGate(),heard=name=>({name,confidence:.95});
assert.equal(gate.feed(heard('G'),'G',0,.1),false);assert.equal(gate.feed(heard('G'),'G',260,.1),true);
for(const t of [500,800,1300])assert.equal(gate.feed(heard('G'),'G',t,.1),false,'held chord cannot consume a repeat');
gate.feed({name:null},'G',1400,0);gate.feed({name:null},'G',1500,0);
gate.feed(heard('G'),'G',1600,.1);assert.equal(gate.feed(heard('G'),'G',1860,.1),true);
assert.equal(gate.feed(heard('C'),'D',2100,.1),false,'wrong chord cannot progress');
gate.feed(heard('C'),'C',2200,.1);assert.equal(gate.feed(heard('C'),'C',2460,.1),true);
gate.reset();gate.feed(heard('G'),'G/B',0,.1);assert.equal(gate.feed(heard('G'),'G/B',260,.1),true,'inversions share a chord family, not a fingering claim');
console.log(`Practice polyphonic: ${tested} chord mixtures, single notes, intervals, noise, repeat gating and wrong chords PASS (real instrument unverified)`);
