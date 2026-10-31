import assert from 'node:assert/strict';
import { detectChord,ChordGate,chordAttackLevel } from '../practice/polyphonic.mjs';
import { CHORDS,chordNotes } from '../practice/chords.mjs';
import { spectrum } from './lib/practice-signal-fixtures.mjs';
let tested=0;
for(const fftSize of [8192,16384])for(const rate of [44100,48000])for(const options of [{},{detune:10},{harmonics:[1,.25,.1,.08,.02]},{harmonics:[.6,1,.6,.3,.15,.08,.03]},{noise:.015}])for(const name of Object.keys(CHORDS)){
  const result=detectChord(spectrum(chordNotes(name).map(n=>n.midi),rate,{...options,fftSize}),rate,fftSize,{rms:.1});
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
for(const [previous,expected]of[['C','Am'],['Am','C'],['G','C'],['C','G'],['Dm','G'],['G','Em'],['E','Am'],['Am','Dm'],['Cmaj7','Am'],['C','Fm']])for(const tail of [.15,.3]){
 const a=chordNotes(expected).map(n=>n.midi),b=chordNotes(previous).map(n=>n.midi),weights=[...a.map(()=>1),...b.map(()=>tail)];
 const found=detectChord(spectrum([...a,...b],48000,{weights,fftSize:8192}),48000,8192,{rms:.1,expected,previous});assert.equal(found.name,expected,`${previous} tail ${tail} into ${expected}`);assert.ok(found.confidence>=.65);
 const old=detectChord(spectrum(b,48000,{fftSize:8192}),48000,8192,{rms:.1,expected,previous});if(!chordNotes(expected).every(n=>b.some(p=>p%12===n.midi%12)))assert.notEqual(old.name,expected,'the old chord alone cannot supply missing target tones');
}
const fast=new ChordGate();fast.feed(heard('C'),'C',0,.1);assert.equal(fast.feed(heard('C'),'C',160,.1),true,'a stable chord accepts in 160ms');assert.equal(fast.feed(heard('C'),'C',440,.09,.006,.08),false);assert.equal(fast.feed(heard('C'),'C',520,.1,.006,.13),false);fast.feed(heard('C'),'C',600,.1,.006,.12);assert.equal(fast.feed(heard('C'),'C',680,.1,.006,.11),true,'a fresh strum advances without silence');
for(const t of [760,920,1100])assert.equal(fast.feed(heard('C'),'C',t,.1,.006,.11),false,'one strum advances once');
fast.rebaseEnvelope(.2);for(const t of [1400,1600,1800])assert.equal(fast.feed(heard('C'),'C',t,.2),false,'gain changes are not a new strum');
const subset=new ChordGate();subset.feed(heard('Cmaj7'),'Cmaj7',0,.1);assert.equal(subset.feed(heard('Cmaj7'),'Cmaj7',160,.1),true);for(const t of [500,700,900])assert.equal(subset.feed(heard('C'),'C',t,.1),false,'a held extended chord cannot consume its simpler subset');
const dropout=new ChordGate();dropout.feed(heard('C'),'C',0,.1);dropout.feed({name:null},'C',80,.1);dropout.feed({name:null},'C',160,.1);assert.equal(dropout.feed(heard('C'),'C',240,.1),false,'stale evidence cannot be carried across a dropout');assert.equal(dropout.feed(heard('C'),'C',400,.1),true);
assert.equal(chordAttackLevel(new Float32Array(8192).fill(.1)).toFixed(3),'0.100');assert.equal(chordAttackLevel(new Float32Array(0)),0);
console.log('Strum: short-window fitting, 20 ringing chord transitions, missing tones, fresh attacks without silence, subset/repeat and gain guards PASS');
