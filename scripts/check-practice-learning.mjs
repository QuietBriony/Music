import { songSupport } from '../practice/song-support.mjs';
import { GUITAR_PLAYLIST } from '../practice/guitar-playlist.mjs';
import { SANSHIN_PLAYLIST } from '../practice/sanshin-playlist.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tuningLabel,tuningStrings,tunerReading,detectTuningPitch,TunerTracker,tuningGate,tunerInputGate } from '../practice/tuner.mjs';
import { sheetEntries,practiceSheetEntries } from '../practice/full-score.mjs';
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
for(const shift of [-3,-2,-1,0,2]){
 assert.deepEqual(tuningStrings('sanshin',shift,'niage').map(n=>n.midi),[48,55,60].map(n=>n+shift));
 assert.deepEqual(tuningStrings('sanshin',shift,'sansage').map(n=>n.midi),[48,53,58].map(n=>n+shift));
}
assert.equal(tuningLabel(-1),'本調子 B・E・B');assert.equal(tuningLabel(-1,'niage'),'二揚げ B・F♯・B');assert.equal(tuningLabel(-1,'sansage'),'三下げ B・E・A');
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
assert.equal(tracker.feed(openC,48).status,'settling');assert.equal(tracker.feed(openC,48).status,'matched');assert.equal(tracker.feed(openC,48).status,'matched');
assert.equal(tracker.feed({...openC,frequency:frequencyFor(60)},48).status,'settling');tracker.feed({...openC,frequency:frequencyFor(60)},48);assert.equal(tracker.feed({...openC,frequency:frequencyFor(60)},48).status,'check','A wrong octave is never folded into a match');
assert.equal(tracker.feed({...openC,frequency:null,rms:.03,clarity:0},48).reason,'unclear');assert.equal(tracker.feed({...openC,frequency:null,rms:0},48).reason,'quiet');
assert.equal(tracker.feed(openC,53).status,'settling','Changing string clears stability');
// Decaying plucks retain their observed pitch, but silence cannot confirm it.
const heldTracker=new TunerTracker(),silent={frequency:null,rms:0,clarity:0};
assert.equal(heldTracker.feed(silent,48,.006,0).frequency,null);
assert.equal(heldTracker.feed(openC,48,.006,10).status,'settling');
let held=heldTracker.feed(silent,48,.006,70);assert.equal(held.held,true);assert.equal(held.status,'settling');assert.equal(held.frequency,openC.frequency);
assert.equal(heldTracker.feed(openC,48,.006,130).status,'matched');
held=heldTracker.feed(silent,48,.006,1000);assert.equal(held.status,'matched');assert.equal(held.held,true);
held=heldTracker.feed(silent,48,.006,5000);assert.equal(held.status,'held');assert.equal(held.frequency,openC.frequency);
heldTracker.reset();assert.equal(heldTracker.feed(silent,48,.006,5100).frequency,null);
const toward=new TunerTracker(),pitched=cents=>({...openC,frequency:frequencyFor(48)*2**(cents/1200)});
for(const [cents,expected] of [[-110,'low'],[-65,'near'],[-35,'near'],[-12,'matched']]){
 for(let i=0;i<4;i++)toward.feed(pitched(cents),48,.006,6000+cents*10+i*60);
 const result=toward.feed(pitched(cents),48,.006,6200+cents*10);assert.equal(result.status,expected);if(cents>-110)assert.equal(result.trend,'closer');
}
for(let i=0;i<4;i++)assert.notEqual(toward.feed(pitched(1200),48,.006,8000+i*60).status,'matched');
assert.equal(toward.feed(silent,53,.006,8500).frequency,null,'Changing the target clears the retained pitch');
const weak=Float32Array.from({length:8192},(_,i)=>.0016*Math.sin(2*Math.PI*frequencyFor(48)*i/48000));
assert.equal(detectPitch(weak,48000,tuningGate(.006)).frequency,null,'Regression: old tuning amplitude gate dropped a decaying pluck');
assert.ok(detectTuningPitch(weak,48000).frequency);assert.ok(tunerInputGate(.006)<tuningGate(.006));
for(const transpose of [-3,-2,-1,0,2])assert.deepEqual(tuningStrings('sanshin',transpose).map(n=>n.midi),[48,53,60].map(n=>n+transpose));
for(const instrument of ['guitar','sanshin'])for(const n of tuningStrings(instrument)){
  const detect=cents=>({frequency:frequencyFor(n.midi)*2**(cents/1200),rms:.1,clarity:.99});
  assert.equal(tunerReading(detect(0),n.midi).status,'matched');
  assert.equal(tunerReading(detect(30),n.midi).status,'near');assert.equal(tunerReading(detect(30),n.midi).direction,'high');assert.equal(tunerReading(detect(-30),n.midi).status,'near');assert.equal(tunerReading(detect(-30),n.midi).direction,'low');
  assert.equal(tunerReading(detect(1200),n.midi).status,'check');
  assert.equal(tunerReading({...detect(0),rms:0},n.midi).status,'waiting');
}
assert.deepEqual(Object.values(STUDIES).flat().map(s=>s.id),['tokiyo','santeria','blackbird','jigsaw','sleep-last-night','woman','could-you-be-loved','imagine','your-song','yes-my-love','under-the-bridge','shimauta','jidai','warabigami','nadasoso','sanshinnohana','tinsagu','tsukinu','anata-ni']);
for(const [instrument,studies] of Object.entries(STUDIES)){
  assert.ok(BASICS[instrument].steps.length>=5);
  for(const study of studies){
    for(const field of ['lesson','video','score'])if(study[field])assert.equal(new URL(study[field]).protocol,'https:');
    if(study.names){const model=chordExercise(study.names);assert.equal(scoreNotes(model,'chords','guitar',{chords:true}).cues.length,study.names.length);}
    assert.ok(study.note.length>0,'accurate scope label');
  }
}
assert.deepEqual(SANSHIN_PLAYLIST,JSON.parse(readFileSync('practice/songs/sanshin-playlist.json','utf8')),'Offline UI metadata matches the inspectable playlist source');
assert.deepEqual(SANSHIN_PLAYLIST.tracks.map(t=>t.appleId),['1481952783','896534388','1467728468','1838687755','1838717174','279394371','724943335','594418333'],'Original seven recordings retain their order; owner-requested addition is appended');
for(const t of SANSHIN_PLAYLIST.tracks){assert.equal(new URL(t.appleUrl).searchParams.get('i'),t.appleId);assert.equal(SANSHIN_VIDEOS[t.id].video,t.video);assert.ok(t.sheets.length&&t.focus&&t.note);}
assert.deepEqual(GUITAR_PLAYLIST,JSON.parse(readFileSync('practice/songs/guitar-playlist.json','utf8')));
assert.deepEqual(GUITAR_PLAYLIST.tracks.map(t=>t.appleId),['1440893075','1440848005','1469575893','1436922357','1440754861','1440839501','1441133834','1636234075','1109715469','1636243735','945581840']);
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
// A short missing-pitch frame must not erase all accumulated voiced evidence,
// and missing time itself must never count towards a correct note.
const tolerant=new NoteFollower([{midi:57},{midi:57}],{gate:.0015,dropout:90});
const soft={frequency:frequencyFor(57),clarity:.97,rms:.002},gap={frequency:null,clarity:0,rms:.002};
tolerant.feed(soft,0);tolerant.feed(soft,45);tolerant.feed(gap,90);
assert.equal(tolerant.feed(soft,135).matched,false);assert.equal(tolerant.feed(soft,180).matched,false);assert.equal(tolerant.feed(soft,225).matched,true);
assert.equal(tolerant.feed(soft,600).matched,false,'Continuous ringing cannot consume the repeated note');
const isolated=new NoteFollower([{midi:57}],{gate:.0015,dropout:90});isolated.feed(soft,0);for(const now of [45,90,135,180,300])assert.equal(isolated.feed(gap,now).matched,false);assert.equal(isolated.feed(soft,350).matched,false,'A later isolated frame starts fresh');
const pausedEvidence=new NoteFollower([{midi:57}],{gate:.0015,dropout:120});pausedEvidence.feed(soft,0);assert.equal(pausedEvidence.feed(soft,1000).matched,false,'Unobserved pause cannot count as voiced evidence');
const wrongSoft=new NoteFollower([{midi:58}],{gate:.0015,dropout:90});wrongSoft.feed(soft,0);assert.equal(wrongSoft.feed(soft,200).matched,false,'Amplified wrong semitone is still wrong');
assert.equal(tinsaguNotes.map(n=>n.symbol).join(''),'中中工上四合四五中中工上四合四五中中工上四合四五中中七九八七八中中工上四合四五中中工上四合四五中中工上四合四五中中工上四合四五');
for(const tuning of [-3,-2,-1,0,2]){
 const notes=mapMelody(parsed.groups[0].notes,'sanshin',{tuning});
 assert.deepEqual(notes.map(n=>n.symbol),tinsaguNotes.map(n=>n.symbol));
 assert.deepEqual(notes.map(n=>n.midi),parsed.groups[0].notes.map(n=>n.midi+tuning));
}
assert.equal(SANSHIN_VIDEOS.jidai.video,'xtf0OAu-qVY');
for(const id of Object.keys(SANSHIN_VIDEOS))assert.ok(STUDIES.sanshin.find(s=>s.id===id)?.video.endsWith(SANSHIN_VIDEOS[id].video));
const sw=readFileSync('practice/sw.js','utf8');for(const path of ['sanshin-core.mjs?v=27','sanshin-view.mjs?v=27','sanshin-guide.mjs?v=27','sanshin.css?v=27','songs/sanshin-provenance.json','songs/tinsagu.mid'])assert.ok(sw.includes(path),path);
console.log('Practice learning: tuning, nineteen studies, three easy stages, 14 sanshin finger positions, licensed/reproducible 63-note Tinsagu with rest/transposition, video references and PWA PASS');

const guitarCourseNotes=scoreNotes(chordExercise(['C','Am']),'chords','guitar',{chords:true}).notes;
const cards=practiceSheetEntries(guitarCourseNotes,{instrument:'guitar',chords:true});assert.equal(cards.length,2);assert.equal(cards[0].index,0);assert.equal(cards[0].end,cards[1].index);assert.equal(cards[1].end,guitarCourseNotes.length);
assert.equal(practiceSheetEntries(guitarCourseNotes,{instrument:'guitar',chords:false}).length,guitarCourseNotes.length);
const support=[...GUITAR_PLAYLIST.tracks.map(t=>songSupport('guitar',t.id)),...SANSHIN_PLAYLIST.tracks.map(t=>songSupport('sanshin',t.id))];assert.equal(support.length,19);assert.equal(support.filter(s=>s.badge==='自動コード').length,2);assert.equal(support.filter(s=>s.quality==='estimated').length,9);assert.equal(support.filter(s=>s.badge==='動画の工工四').length,7);assert.equal(support.filter(s=>s.badge==='工工四＋歌詞').length,1);assert.ok(support.every(s=>s.detail&&s.badge));
