import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tuningStrings,tunerReading } from '../practice/tuner.mjs';
import { STUDIES,BASICS } from '../practice/learning.mjs';
import { chordExercise,scoreNotes } from '../practice/scores.mjs';
import { frequencyFor } from '../practice/music.mjs';
import { SANSHIN_POSITIONS,sanshinPosition,neckY } from '../practice/sanshin-core.mjs';
import { neckDiagram,handDiagram } from '../practice/sanshin-view.mjs';
import { SANSHIN_VIDEOS } from '../practice/sanshin-guide.mjs';
import { parseMidi } from '../practice/midi.mjs';
import { mapMelody } from '../practice/chords.mjs';
import { tinsaguMidi,TINSAGU_COLUMNS } from './build-practice-sanshin.mjs';
import { createHash } from 'node:crypto';
assert.deepEqual(tuningStrings('guitar').map(n=>n.midi),[40,45,50,55,59,64]);
assert.deepEqual(tuningStrings('sanshin').map(n=>n.midi),[48,53,60]);
for(const transpose of [-3,-2,-1,0,2])assert.deepEqual(tuningStrings('sanshin',transpose).map(n=>n.midi),[48,53,60].map(n=>n+transpose));
for(const instrument of ['guitar','sanshin'])for(const n of tuningStrings(instrument)){
  const detect=cents=>({frequency:frequencyFor(n.midi)*2**(cents/1200),rms:.1,clarity:.99});
  assert.equal(tunerReading(detect(0),n.midi).status,'matched');
  assert.equal(tunerReading(detect(30),n.midi).status,'high');assert.equal(tunerReading(detect(-30),n.midi).status,'low');
  assert.equal(tunerReading(detect(1200),n.midi).status,'check');
  assert.equal(tunerReading({...detect(0),rms:0},n.midi).status,'waiting');
}
assert.deepEqual(Object.values(STUDIES).flat().map(s=>s.id),['tokiyo','santeria','blackbird','jigsaw','tinsagu','tsukinu','jidai']);
for(const [instrument,studies] of Object.entries(STUDIES)){
  assert.ok(BASICS[instrument].steps.length>=5);
  for(const study of studies){
    for(const field of ['lesson','video','score'])if(study[field])assert.equal(new URL(study[field]).protocol,'https:');
    if(study.names){const model=chordExercise(study.names);assert.equal(scoreNotes(model,'chords','guitar',{chords:true}).cues.length,study.names.length);}
    assert.ok(study.note.length>0,'accurate scope label');
  }
}
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
assert.equal(tinsaguNotes.map(n=>n.symbol).join(''),'中中工上四合四五中中工上四合四五中中工上四合四五中中七九八七八中中工上四合四五中中工上四合四五中中工上四合四五中中工上四合四五');
for(const tuning of [-3,-2,-1,0,2]){
 const notes=mapMelody(parsed.groups[0].notes,'sanshin',{tuning});
 assert.deepEqual(notes.map(n=>n.symbol),tinsaguNotes.map(n=>n.symbol));
 assert.deepEqual(notes.map(n=>n.midi),parsed.groups[0].notes.map(n=>n.midi+tuning));
}
assert.equal(SANSHIN_VIDEOS.jidai.video,'xtf0OAu-qVY');
for(const id of Object.keys(SANSHIN_VIDEOS))assert.ok(STUDIES.sanshin.find(s=>s.id===id)?.video.endsWith(SANSHIN_VIDEOS[id].video));
const sw=readFileSync('practice/sw.js','utf8');for(const path of ['sanshin-core.mjs?v=13','sanshin-view.mjs?v=13','sanshin-guide.mjs?v=13','sanshin.css?v=13','songs/sanshin-provenance.json','songs/tinsagu.mid'])assert.ok(sw.includes(path),path);
console.log('Practice learning: tuning, seven studies, three easy stages, 14 sanshin finger positions, licensed/reproducible 63-note Tinsagu with rest/transposition, video references and PWA PASS');
