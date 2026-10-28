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
assert.deepEqual(Object.values(STUDIES).flat().map(s=>s.id),['santeria','blackbird','tinsagu','tsukinu','jidai']);
for(const [instrument,studies] of Object.entries(STUDIES)){
  assert.ok(BASICS[instrument].steps.length>=5);
  for(const study of studies){
    for(const field of ['lesson','video','score'])if(study[field])assert.equal(new URL(study[field]).protocol,'https:');
    if(study.names){const model=chordExercise(study.names);assert.equal(scoreNotes(model,'chords','guitar',{chords:true}).cues.length,4);}
    assert.ok(study.note.length>0,'accurate scope label');
  }
}
const source=readFileSync('practice/learning.mjs','utf8');
assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|innerHTML/,'personal lyrics remain local text');
assert.match(source,/textContent=lines\[line\]/);
console.log('Practice learning: guitar/sanshin tuning, high/low/octaves, five reference studies, safe local lyric display PASS');
