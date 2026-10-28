import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseMidi, melodyNotes, MIDI_LIMITS, fetchMidi } from '../practice/midi.mjs';
import { CHORDS, CHORD_GROUPS, PROGRESSIONS, chordNotes, shapeMatches, mapMelody } from '../practice/chords.mjs';
import { SONGS, scoreNotes, chordExercise } from '../practice/scores.mjs';
import { encodeMidi } from './build-practice-songs.mjs';
const n = (midi, beat, beats=1) => ({midi,beat,beats});
const basic=encodeMidi([n(60,0),n(62,2,2)],{bpm:120,chords:[{beat:0,chord:'C'}]});
const parsed=parseMidi(basic), selected=melodyNotes(parsed,'0:0');
assert.equal(parsed.ppq,384); assert.equal(selected.length,2); assert.equal(selected[0].stepSeconds,1); assert.equal(selected[0].duration,.5); assert.equal(selected[1].duration,1); assert.equal(parsed.markers[0].chord,'C');
const raw = track => Buffer.from([...Buffer.from('MThd'),0,0,0,6,0,0,0,1,1,0,...Buffer.from('MTrk'),0,0,0,track.length,...track]);
const running=parseMidi(raw([0,0x90,60,90,0x81,0,60,0,0,62,90,0x81,0,0x80,62,0,0,255,47,0]));
assert.deepEqual(running.groups[0].notes.map(x=>[x.midi,x.durationTicks]),[[60,128],[62,128]]);
const tempo=parseMidi(raw([0,255,81,3,7,161,32,0,0x90,60,90,0x81,0,255,81,3,15,66,64,0x81,0,0x80,60,0,0,255,47,0]));
assert.equal(tempo.groups[0].notes[0].duration,.75,'tempo change within note');
const lyrics=parseMidi(raw([0,255,5,3,97,98,99,0,0x90,60,90,1,0x80,60,0,0,255,47,0]));
assert.ok(!JSON.stringify(lyrics).includes('abc'),'lyrics are ignored');
const channels=parseMidi(raw([0,0x90,60,90,0,0x91,62,90,10,0x80,60,0,0,0x81,62,0,0,255,47,0]));
assert.equal(channels.groups.length,2);
const poly=parseMidi(encodeMidi([n(60,0,2),n(64,0),n(62,1)]));
assert.throws(()=>melodyNotes(poly,'0:0'),/和音/); assert.deepEqual(melodyNotes(poly,'0:0',true).map(n=>n.midi),[64,62]);
assert.ok(Math.abs(melodyNotes(poly,'0:0',true)[0].duration-2/3)<.000001,'trim highest voice');
const format1=Buffer.from(basic);format1[9]=1;assert.equal(parseMidi(format1).format,1);
const multitrack=Buffer.concat([format1,basic.subarray(14)]);multitrack[11]=2;
assert.equal(parseMidi(multitrack).groups.length,2,'Format 1 multiple tracks');
for(const mutation of [b=>{b[9]=2;},b=>{b[12]=128;},b=>{b[0]=0;},b=>{b[21]=255;}]){const b=Buffer.from(basic);mutation(b);assert.throws(()=>parseMidi(b));}
assert.throws(()=>parseMidi(basic.subarray(0,-1)));assert.throws(()=>parseMidi(new Uint8Array(MIDI_LIMITS.bytes+1)));
assert.throws(()=>parseMidi(raw([0x81,0x81,0x81,0x81,0,255,47,0])));
assert.throws(()=>parseMidi(raw([0,0x90,60,90,0,255,47,0])),/終了/);
const roots={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const qualities={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],sus4:[0,5,7],add9:[0,2,4,7]};
assert.equal(Object.keys(CHORDS).length,33);
assert.deepEqual(CHORD_GROUPS.flatMap(g=>g.names).sort(),Object.keys(CHORDS).sort());
for(const [name,shape] of Object.entries(CHORDS)){
  assert.ok(shapeMatches(shape.frets,name));assert.ok(chordNotes(name).every(n=>Number.isInteger(n.midi)));
  assert.equal(shape.frets.length,6);assert.equal(shape.fingers.length,6);
  assert.ok(shape.frets.every(f=>Number.isInteger(f)&&f>=-1&&f<=6),'fits interactive fretboard');
  const [,root,accidental,quality,bass]=name.match(/^([A-G])(#?)([^/]*)(?:\/([A-G]))?$/),pitch=roots[root]+(accidental?1:0);
  const actual=[...new Set(chordNotes(name).map(n=>(n.midi-pitch+120)%12))].sort((a,b)=>a-b);
  assert.deepEqual(actual,qualities[quality].filter(interval=>!shape.omitsFifth||interval!==7),`${name} voicing pitch classes`);
  if(bass)assert.equal(chordNotes(name)[0].midi%12,roots[bass]);
  if(shape.barre){const b=shape.barre;assert.ok(b.fret>=1&&b.fret<=6);for(let s=b.to;s<=b.from;s++)assert.ok(shape.frets[6-s]>=b.fret,`${name} barre string ${s}`);}
  const model=chordExercise([name]),score=scoreNotes(model,'chords','guitar',{chords:true});
  assert.deepEqual(score.notes.map(n=>n.midi),chordNotes(name).map(n=>n.midi));
}
for(const p of PROGRESSIONS){const m=chordExercise(p.names);assert.deepEqual(scoreNotes(m,'chords','guitar',{chords:true}).cues.map(c=>c.chord),p.names);}
assert.throws(()=>chordExercise(['toString']));assert.throws(()=>chordExercise([]));
const provenance=JSON.parse(readFileSync('practice/songs/provenance.json','utf8'));
for(const song of provenance.songs){
  const data=readFileSync(`practice/songs/${song.file}`), midi=parseMidi(data), notes=melodyNotes(midi,midi.groups[0].id);
  assert.equal(createHash('sha256').update(data).digest('hex'),song.sha256);
  const expected={'amazing-grace':[47,72,16],'twinkle':[42,48,16],'ode-to-joy':[30,32,9]}[song.id];
  assert.equal(notes.length,expected[0]);assert.equal(midi.endBeat,expected[1]);
  for(const [instrument,songs] of Object.entries(SONGS))if(songs.some(s=>s.id===song.id)){
    const score=scoreNotes(midi,midi.groups[0].id,instrument);
    assert.ok(score.notes.every(n=>n.string>=1 && n.string<=(instrument==='guitar'?6:3)));
    if(instrument==='guitar'){
      const chords=scoreNotes(midi,midi.groups[0].id,instrument,{chords:true});assert.equal(chords.cues.length,expected[2]);
      assert.throws(()=>scoreNotes(midi,midi.groups[0].id,instrument,{chords:true,shift:12}),/元の調/);
    }else assert.equal(mapMelody(notes,'sanshin',{tuning:-3})[0].midi,notes[0].midi-3);
  }
}
const nativeFetch=globalThis.fetch;
globalThis.location=new URL('https://practice.example/practice/');
let requested;
globalThis.fetch=async (url,options)=>{requested=options;return new Response(basic);};
assert.equal((await fetchMidi('https://source.example/song.mid')).byteLength,basic.length);
assert.equal(requested.credentials,'omit');
await assert.rejects(fetchMidi('http://source.example/song.mid'),/HTTPS/);
await assert.rejects(fetchMidi('https://user:password@source.example/song.mid'),/HTTPS/);
globalThis.fetch=async()=>new Response(new Uint8Array(MIDI_LIMITS.bytes+1));
await assert.rejects(fetchMidi('https://source.example/huge.mid'),/大き/);
globalThis.fetch=async()=>new Response('not midi',{headers:{'content-length':String(MIDI_LIMITS.bytes+1)}});
await assert.rejects(fetchMidi('https://source.example/huge.mid'),/1 MB/);
globalThis.fetch=nativeFetch;delete globalThis.location;
console.log('Practice MIDI: SMF/tempo/limits, 33 chord voicings, four progressions, three licensed song hashes PASS');
