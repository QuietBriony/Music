import { GUITAR_PLAYLIST } from '../practice/guitar-playlist.mjs';
import { SANSHIN_PLAYLIST } from '../practice/sanshin-playlist.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tuningStrings,tunerReading,detectTuningPitch,TunerTracker,tuningGate } from '../practice/tuner.mjs';
import { sheetEntries } from '../practice/full-score.mjs';
import { STUDIES,BASICS } from '../practice/learning.mjs';
import { chordExercise,scoreNotes } from '../practice/scores.mjs';
import { frequencyFor,centsFrom,detectPitch,NoteFollower } from '../practice/music.mjs';
import { SANSHIN_POSITIONS,sanshinPosition,neckY } from '../practice/sanshin-core.mjs';
import { neckDiagram,handDiagram } from '../practice/sanshin-view.mjs';
import { SANSHIN_VIDEOS } from '../practice/sanshin-guide.mjs';
import { parseMidi } from '../practice/midi.mjs';
import { mapMelody } from '../practice/chords.mjs';
import { tinsaguMidi,TINSAGU_COLUMNS } from './build-practice-sanshin.mjs';
import { createHash } from 'node:crypto';
assert.deepEqual(tuningStrings('guitar').map(n=>n.midi),[40,45,50,55,59,64]);
assert.deepEqual(tuningStrings('sanshin').map(n=>n.midi),[48,53,60]);
// Quiet plucked strings previously moved the level meter but failed the lesson
// amplitude gate. Exercise the actual tuner detector, not only canned readings.
let tuningSeed=57;const random=()=>((tuningSeed=(1664525*tuningSeed+1013904223)>>>0)/2**32-.5)*2;
for(const rate of [44100,48000])for(const midi of [40,45,48,50,53,55,60,62,64])for(const amplitude of [.003,.006,.05]){
 const hz=frequencyFor(midi),samples=Float32Array.from({length:8192},(_,i)=>{const p=2*Math.PI*hz*i/rate;return amplitude*(Math.sin(p)+.85*Math.sin(p*2)+.3*Math.sin(p*3))+.3*amplitude*random();});
 if(amplitude===.003)assert.equal(detectPitch(samples.subarray(0,4096),rate,.006).frequency,null,'Regression reproduces the old gate');
 const heard=detectTuningPitch(samples,rate);assert.ok(heard.frequency&&Math.abs(centsFrom(heard.frequency,midi))<10,`Quiet tuning ${rate}/${midi}/${amplitude}`);
}
for(const samples of [new Float32Array(8192),new Float32Array(8192).fill(.1),Float32Array.from({length:8192},()=>random()*.2)])assert.equal(detectTuningPitch(samples,48000).frequency,null,'Silence/DC/random noise cannot tune a string');
const tracker=new TunerTracker(),openC={frequency:frequencyFor(48),clarity:.95,rms:.003};
assert.equal(tracker.feed(openC,48).status,'settling');assert.equal(tracker.feed(openC,48).status,'settling');assert.equal(tracker.feed(openC,48).status,'matched');
assert.equal(tracker.feed({...openC,frequency:frequencyFor(60)},48).status,'settling');tracker.feed({...openC,frequency:frequencyFor(60)},48);assert.equal(tracker.feed({...openC,frequency:frequencyFor(60)},48).status,'check','A wrong octave is never folded into a match');
assert.equal(tracker.feed({...openC,frequency:null,rms:.03,clarity:0},48).reason,'unclear');assert.equal(tracker.feed({...openC,frequency:null,rms:0},48).reason,'quiet');
assert.equal(tracker.feed(openC,53).status,'settling','Changing string clears stability');
for(const transpose of [-3,-2,-1,0,2])assert.deepEqual(tuningStrings('sanshin',transpose).map(n=>n.midi),[48,53,60].map(n=>n+transpose));
for(const instrument of ['guitar','sanshin'])for(const n of tuningStrings(instrument)){
  const detect=cents=>({frequency:frequencyFor(n.midi)*2**(cents/1200),rms:.1,clarity:.99});
  assert.equal(tunerReading(detect(0),n.midi).status,'matched');
  assert.equal(tunerReading(detect(30),n.midi).status,'high');assert.equal(tunerReading(detect(-30),n.midi).status,'low');
  assert.equal(tunerReading(detect(1200),n.midi).status,'check');
  assert.equal(tunerReading({...detect(0),rms:0},n.midi).status,'waiting');
}
assert.deepEqual(Object.values(STUDIES).flat().map(s=>s.id),['tokiyo','santeria','blackbird','jigsaw','sleep-last-night','woman','could-you-be-loved','imagine','your-song','shimauta','jidai','warabigami','nadasoso','sanshinnohana','tinsagu','tsukinu']);
for(const [instrument,studies] of Object.entries(STUDIES)){
  assert.ok(BASICS[instrument].steps.length>=5);
  for(const study of studies){
    for(const field of ['lesson','video','score'])if(study[field])assert.equal(new URL(study[field]).protocol,'https:');
    if(study.names){const model=chordExercise(study.names);assert.equal(scoreNotes(model,'chords','guitar',{chords:true}).cues.length,study.names.length);}
    assert.ok(study.note.length>0,'accurate scope label');
  }
}
assert.deepEqual(SANSHIN_PLAYLIST,JSON.parse(readFileSync('practice/songs/sanshin-playlist.json','utf8')),'Offline UI metadata matches the inspectable playlist source');
assert.deepEqual(SANSHIN_PLAYLIST.tracks.map(t=>t.appleId),['1481952783','896534388','1467728468','1838687755','1838717174','279394371','724943335'],'Exact seven recordings from the supplied playlist, in original order');
for(const t of SANSHIN_PLAYLIST.tracks){assert.equal(new URL(t.appleUrl).searchParams.get('i'),t.appleId);assert.equal(SANSHIN_VIDEOS[t.id].video,t.video);assert.ok(t.sheets.length&&t.focus&&t.note);}
assert.deepEqual(GUITAR_PLAYLIST,JSON.parse(readFileSync('practice/songs/guitar-playlist.json','utf8')));
assert.deepEqual(GUITAR_PLAYLIST.tracks.map(t=>t.appleId),['1440893075','1440848005','1469575893','1436922357','1440754861','1440839501','1441133834','1636234075','1109715469']);
for(const t of GUITAR_PLAYLIST.tracks)assert.equal(new URL(t.appleUrl).searchParams.get('i'),t.appleId);
const source=readFileSync('practice/lyrics.mjs','utf8');
assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|innerHTML/,'personal lyrics remain local text');
assert.match(source,/textContent=data.lines\[active\]/);
const easy=STUDIES.guitar.find(s=>s.id==='tokiyo');assert.equal(easy.stages.length,3);assert.deepEqual(easy.stages[0].names,['C','Am','C','Am']);assert.deepEqual(easy.stages[1].names,['Dm','G7','Dm','G7']);
for(const stage of easy.stages){const score=scoreNotes(chordExercise(stage.names),'chords','guitar',{chords:true});assert.equal(score.cues.length,stage.names.length);assert.ok(score.notes.every(n=>n.fret<=3));}
assert.match(readFileSync('practice/songs/tokiyo-study.json','utf8'),/No copied full score/);
const jigsaw=STUDIES.guitar.find(s=>s.id==='jigsaw');assert.deepEqual(jigsaw.names,['Bm','Bm','Bm','Bm']);assert.equal(jigsaw.referenceChord,'Bm');assert.match(jigsaw.referenceNote,/標準調弦 EADGBE/);assert.equal(jigsaw.video,'https://www.youtube.com/watch?v=daD3x6XudqY');assert.match(jigsaw.note,/準備ボタンはカポなしのBm/);
assert.equal(SANSHIN_POSITIONS.length,14);
for(const [symbols,finger] of [['合四工',0],['乙上五',1],['老中六',2],['尺七八九',4]])for(const symbol of symbols){
  assert.equal(sanshinPosition(symbol).finger,finger,`${symbol}: correct basic finger`);
  assert.match(neckDiagram(symbol),/role="img"/);assert.match(handDiagram(symbol),/左手の手のひら/);
}
assert.equal(sanshinPosition('unknown'),null);assert.equal(neckDiagram('<script>'),'');
assert.ok(neckY(2)<neckY(4)&&neckY(4)<neckY(5)&&neckY(5)<neckY(7)&&neckY(7)<neckY(9));
const tinsagu=readFileSync('practice/songs/tinsagu.mid'), parsed=parseMidi(tinsagu),meta=JSON.parse(readFileSync('practice/songs/sanshin-provenance.json','utf8'));
assert.deepEqual(tinsagu,tinsaguMidi(),'MIDI reproducible from attributed note data');
assert.equal(createHash('sha256').update(tinsagu).digest('hex'),meta.tinsagu.sha256);
assert.equal(meta.tinsagu.license,'CC-BY-SA-4.0');assert.equal(TINSAGU_COLUMNS.join('').length,64);
assert.equal(parsed.endBeat,64);assert.equal(parsed.groups[0].notes.length,63);assert.equal(parsed.groups[0].notes[29].beat,30,'One-beat rest at cell 30');
const tinsaguNotes=mapMelody(parsed.groups[0].notes,'sanshin');
const sheet=sheetEntries(tinsaguNotes);
assert.equal(sheet.length,64);assert.equal(sheet.filter(c=>c.rest).length,1);assert.equal(sheet[29].beats,1);
assert.deepEqual(sheet.filter(c=>!c.rest).map(c=>c.index),Array.from({length:63},(_,i)=>i),'Whole sheet keeps all note indices through the rest');
for(const tuning of [-1,0]){
 const target=tinsaguNotes[0].midi+tuning,gate=tuningGate(.006),follower=new NoteFollower([{midi:target},{midi:target}],{gate});
 const samples=Float32Array.from({length:8192},(_,i)=>.003*Math.sin(2*Math.PI*frequencyFor(target)*i/48000));
 assert.equal(detectPitch(samples,48000,.006).frequency,null,'Quiet lesson input used to be rejected');
 const heard=detectPitch(samples,48000,gate);assert.ok(heard.frequency);
 follower.feed(heard,0);assert.equal(follower.feed(heard,150).matched,true);assert.equal(follower.feed(heard,600).matched,false,'One sustained pluck cannot consume repeated notes');
 const wrong=new NoteFollower([{midi:target+1}],{gate});wrong.feed(heard,0);assert.equal(wrong.feed(heard,200).matched,false,'A B/C tuning mismatch is not accepted');
}
assert.equal(tinsaguNotes.map(n=>n.symbol).join(''),'中中工上四合四五中中工上四合四五中中工上四合四五中中七九八七八中中工上四合四五中中工上四合四五中中工上四合四五中中工上四合四五');
for(const tuning of [-3,-2,-1,0,2]){
 const notes=mapMelody(parsed.groups[0].notes,'sanshin',{tuning});
 assert.deepEqual(notes.map(n=>n.symbol),tinsaguNotes.map(n=>n.symbol));
 assert.deepEqual(notes.map(n=>n.midi),parsed.groups[0].notes.map(n=>n.midi+tuning));
}
assert.equal(SANSHIN_VIDEOS.jidai.video,'xtf0OAu-qVY');
for(const id of Object.keys(SANSHIN_VIDEOS))assert.ok(STUDIES.sanshin.find(s=>s.id===id)?.video.endsWith(SANSHIN_VIDEOS[id].video));
const sw=readFileSync('practice/sw.js','utf8');for(const path of ['sanshin-core.mjs?v=18','sanshin-view.mjs?v=18','sanshin-guide.mjs?v=18','sanshin.css?v=18','songs/sanshin-provenance.json','songs/tinsagu.mid'])assert.ok(sw.includes(path),path);
console.log('Practice learning: tuning, sixteen studies, three easy stages, 14 sanshin finger positions, licensed/reproducible 63-note Tinsagu with rest/transposition, video references and PWA PASS');
