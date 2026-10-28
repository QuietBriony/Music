import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseMidi, melodyNotes, MIDI_LIMITS, fetchMidi } from '../practice/midi.mjs';
import { CHORDS, chordNotes, shapeMatches, mapMelody } from '../practice/chords.mjs';
import { scoreNotes } from '../practice/scores.mjs';
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
for(const [name,shape] of Object.entries(CHORDS)){assert.ok(shapeMatches(shape.frets,name));assert.ok(chordNotes(name).every(n=>Number.isInteger(n.midi)));}
const provenance=JSON.parse(readFileSync('practice/songs/provenance.json','utf8'));
for(const song of provenance.songs){
  const data=readFileSync(`practice/songs/${song.file}`), midi=parseMidi(data), notes=melodyNotes(midi,midi.groups[0].id);
  assert.equal(createHash('sha256').update(data).digest('hex'),song.sha256);
  const instrument=song.id==='twinkle'?'sanshin':'guitar';
  const score=scoreNotes(midi,midi.groups[0].id,instrument);
  assert.equal(notes.length,song.id==='twinkle'?42:47);
  assert.equal(midi.endBeat,song.id==='twinkle'?48:72);
  assert.ok(score.notes.every(n=>n.string>=1 && n.string<=(instrument==='guitar'?6:3)));
  if(instrument==='guitar'){
    const chords=scoreNotes(midi,midi.groups[0].id,instrument,{chords:true});
    assert.equal(chords.cues.length,16);assert.deepEqual([...new Set(chords.notes.map(n=>n.chord))],['G','C','D']);
    assert.throws(()=>scoreNotes(midi,midi.groups[0].id,instrument,{chords:true,shift:12}),/元の調/);
  }else{assert.equal(score.notes[0].symbol,'合');assert.equal(mapMelody(notes,'sanshin',{tuning:-3})[0].midi,45);}
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
console.log('Practice MIDI: SMF 0/1, running status, channels, tempo, rests, highest voice, malformed/limits, chord shapes, both licensed song hashes PASS');
