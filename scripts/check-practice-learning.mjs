import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tuningStrings,tunerReading } from '../practice/tuner.mjs';
import { STUDIES,BASICS } from '../practice/learning.mjs';
import { chordExercise,scoreNotes } from '../practice/scores.mjs';
import { frequencyFor } from '../practice/music.mjs';
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
const jigsaw=STUDIES.guitar.find(s=>s.id==='jigsaw');assert.deepEqual(jigsaw.names,['Bm','Bm','Bm','Bm']);assert.equal(jigsaw.referenceChord,'Bm');assert.match(jigsaw.referenceNote,/標準調弦 EADGBE/);assert.equal(jigsaw.video,'https://www.youtube.com/watch?v=daD3x6XudqY');assert.match(jigsaw.note,/原曲の進行・リフ・リズムは再現していません/);
console.log('Practice learning: guitar/sanshin tuning, high/low/octaves, seven reference studies, Jigsaw standard-tuning reference/Bm preparation, three easy stages and safe local lyric display PASS');
