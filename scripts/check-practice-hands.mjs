import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHORDS } from '../practice/chords.mjs';
import { SING_SHAPES } from '../practice/singalong-core.mjs';
import { SMALL_GRIPS,gripChoices,fingerSteps,pitchClasses,soundingStrings,HAND_LESSONS } from '../practice/hand-guide-core.mjs';
import { videoId } from '../practice/singalong-core.mjs';
let checked=0;
for(const [name,current] of Object.entries(SING_SHAPES)){
 const choices=gripChoices(name,current);assert.deepEqual(choices[0].shape,current);
 for(const {shape} of choices){
  const steps=fingerSteps(shape);assert.ok(steps.length>=1&&steps.length<=4);
  const covered=steps.flatMap(s=>s.positions.map(p=>`${p.string}:${p.fret}`)).sort();
  assert.deepEqual(covered,shape.frets.flatMap((f,i)=>f>0?[`${6-i}:${f}`]:[]).sort());
  for(const step of steps)assert.ok(step.text.includes(['','人差し指','中指','薬指','小指'][step.finger]));
  assert.deepEqual(pitchClasses(shape),pitchClasses(current),name+' preserves its chord');
  assert.deepEqual(soundingStrings(shape),shape.frets.flatMap((f,i)=>f>=0?[6-i]:[]));
  if(shape.barre)assert.equal(steps.at(-1).finger,1,'barre is placed after the other fingers');
  checked++;
 }
}
assert.equal(Object.keys(SING_SHAPES).length,34);assert.equal(Object.keys(SMALL_GRIPS).length,8);
assert.deepEqual(gripChoices('F',SING_SHAPES.F).map(c=>c.id),['current','standard']);
assert.deepEqual(gripChoices('Bm',CHORDS.Bm)[1].shape.frets,[-1,-1,-1,4,3,2]);
assert.equal(fingerSteps(CHORDS.F).find(s=>s.finger===1).barre.from,6);
assert.equal(fingerSteps(CHORDS.Em7).length,1);
for(const lesson of Object.values(HAND_LESSONS)){assert.equal(videoId(lesson.video),lesson.video);assert.ok(lesson.start>=0&&lesson.page.startsWith('https://'));}
const sw=readFileSync('practice/sw.js','utf8');for(const f of ['hand-guide.mjs?v=9','hand-guide-core.mjs?v=9','hand-guide.css?v=9','songs/hand-guide-provenance.json'])assert.ok(sw.includes(f));
const ui=readFileSync('practice/hand-guide.mjs','utf8');assert.doesNotMatch(ui,/MediaRecorder|getUserMedia|fetch\(|innerHTML|sendBeacon/);
console.log(`Hand guide: all 34 chords, ${checked} grip choices, eight same-chord small grips, complete finger coverage, barre order and offline files PASS`);
