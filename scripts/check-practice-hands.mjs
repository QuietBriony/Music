import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHORDS } from '../practice/chords.mjs';
import { SING_SHAPES } from '../practice/singalong-core.mjs';
import { SMALL_GRIPS,gripChoices,fingerSteps,pitchClasses,soundingStrings,HAND_LESSONS,fingerMoves,stringCheck } from '../practice/hand-guide-core.mjs';
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
assert.deepEqual(fingerMoves(CHORDS.C,CHORDS.Am).map(m=>[m.finger,m.kind]),[[1,'keep'],[2,'keep'],[3,'move']]);
assert.deepEqual(fingerMoves(CHORDS.F,CHORDS.Fm).map(m=>[m.finger,m.kind]),[[1,'keep'],[2,'release'],[3,'keep'],[4,'keep']],'barre still covers the string revealed when the middle finger lifts');
assert.equal(fingerMoves(SMALL_GRIPS.F,SMALL_GRIPS.Fm).find(m=>m.finger===3).kind,'keep');
assert.equal(fingerMoves(CHORDS.Em7,CHORDS.C).find(m=>m.finger===1).kind,'place');
assert.equal(fingerMoves(CHORDS.F,SMALL_GRIPS.F).find(m=>m.finger===1).kind,'move','same fret still needs changing from barre to fingertip');
const narrowBarre={...CHORDS.F,barre:{fret:1,from:2,to:1}};
assert.equal(fingerMoves(CHORDS.F,narrowBarre).find(m=>m.finger===1).kind,'move','changed barre range cannot stay');
for(const [name,shape] of Object.entries(SING_SHAPES)){
 for(const {shape:grip} of gripChoices(name,shape)){
  assert.ok(fingerMoves(grip,grip).every(m=>m.kind==='keep'));
  for(let string=1;string<=6;string++){const check=stringCheck(grip,string),fret=grip.frets[6-string];assert.equal(check.kind,fret<0?'muted':fret===0?'open':'fretted');assert.ok(check.title.includes(`${string}弦`));assert.ok(check.tips.length>=2);if(fret>0)assert.ok(check.title.includes(`${fret}フレット`));}
 }
}
assert.match(stringCheck(SMALL_GRIPS.Fm,1).title,/弾かない/);
assert.match(stringCheck(CHORDS.Fm,3).title,/人差し指（セーハ）/);
assert.match(stringCheck(CHORDS.C,1).title,/押さえず/);
for(const lesson of Object.values(HAND_LESSONS)){assert.equal(videoId(lesson.video),lesson.video);assert.ok(lesson.start>=0&&lesson.page.startsWith('https://'));}
const sw=readFileSync('practice/sw.js','utf8');for(const f of ['hand-guide.mjs?v=16','hand-guide-core.mjs?v=16','hand-guide.css?v=16','songs/hand-guide-provenance.json'])assert.ok(sw.includes(f));
const ui=readFileSync('practice/hand-guide.mjs','utf8');assert.doesNotMatch(ui,/MediaRecorder|getUserMedia|fetch\(|innerHTML|sendBeacon/);
const app=readFileSync('practice/app.mjs','utf8');assert.ok(app.includes("caches.open('music-practice-v16')"),'offline readiness uses the installed cache');
console.log(`Hand guide: all 34 chords, ${checked} grip choices, eight same-chord small grips, complete finger coverage, transition anchors/barres, per-string checks and offline files PASS`);
