import assert from 'node:assert/strict';
import { estimatedCourse,harmonyName,correctedCourse,practiceClock } from '../practice/harmony-timeline.mjs';
import { SMALL_GRIPS } from '../practice/hand-guide-core.mjs';
import { readFileSync } from 'node:fs';
import { videoId,validRange,readSteps,TOKIYO_STEPS,SING_SHAPES,normalizeSingState,fingeringText,sectionStarts } from '../practice/singalong-core.mjs';
import { detectChord } from '../practice/polyphonic.mjs';
import { TOKIYO_TIMES,TOKIYO_VIDEO_ID,TOKIYO_END,cueAt } from '../practice/video-cues.mjs';
import { spectrum } from './lib/practice-signal-fixtures.mjs';
import { JIGSAW_STEPS,JIGSAW_TIMES,JIGSAW_END,JIGSAW_VIDEO_ID } from '../practice/jigsaw-cues.mjs';
import { PREPARED_COURSES,courseState } from '../practice/singalong-courses.mjs';
import { MATERIAL_COURSES,materialChoice,materialLyricKey,materialUpgradeState } from '../practice/material-courses.mjs';
import { SANSHIN_MATERIALS,sanshinMaterialChoice,sanshinSessionKey,sanshinLyricKey,lessonChapter } from '../practice/sanshin-materials.mjs';
import { EASY_CAPOS,transposeChord,arrangeCourse,availableCapos,nextChange,changeCue,chordPhrase,timePhrase } from '../practice/song-coach.mjs';
const id='KgKycz0uHbM';for(const url of [id,`https://youtu.be/${id}`,`https://www.youtube.com/watch?v=${id}`,`https://www.youtube-nocookie.com/embed/${id}`])assert.equal(videoId(url),id);
assert.equal(Object.keys(MATERIAL_COURSES).length,8);
for(const [id,course] of Object.entries(MATERIAL_COURSES)){
 assert.equal(materialChoice(id,{videoTime:45}),'original');assert.equal(materialChoice(id,{material:true}),'material');
 assert.equal(materialChoice(id,null),course.noNative?'original':'material');assert.equal(materialChoice(id,null,'original'),'original');
 assert.notEqual(materialLyricKey(id,course),materialLyricKey(id,PREPARED_COURSES[id]));
 assert.ok(!course.noNative&&course.steps.length>20,'Every lyric material has a native full-performance guide');
 const arranged=arrangeCourse(course,course.easyCapo);assert.equal(course.steps.length,course.times.length);assert.ok(course.estimated);
 for(let i=0;i<course.times.length;i++){assert.ok(course.times[i]>=0&&course.times[i]<course.end&&(!i||course.times[i]>course.times[i-1]));assert.ok(course.steps[i].silent||SING_SHAPES[arranged.steps[i].name]);assert.equal(cueAt(course.times,course.times[i],0,course.end).index,i);}
}
for(const id of ['blackbird','under-the-bridge','sleep-last-night','your-song','santeria','could-you-be-loved']){
 const c=MATERIAL_COURSES[id],old={material:true,timeline:c.previousKey,video:c.video,videoTime:42,a:20,b:50,capo:0,follow:false,arranged:false,custom:''};
 const upgraded=materialUpgradeState(old,c);assert.equal(upgraded.timeline,c.key);assert.equal(upgraded.videoTime,42);assert.equal(upgraded.a,20);assert.equal(upgraded.b,50);assert.equal(upgraded.capo,c.easyCapo);assert.ok(upgraded.follow&&upgraded.arranged);assert.notEqual(upgraded,old);assert.equal(old.follow,false);
 const custom={...old,custom:'Am G'};assert.equal(materialUpgradeState(custom,c),custom);
 const original={...old,material:false};assert.equal(materialUpgradeState(original,c),original);
 const unrelated={...old,timeline:'other-recording'};assert.equal(materialUpgradeState(unrelated,c),unrelated);
 assert.equal(materialUpgradeState(upgraded,c),upgraded);
}
assert.equal(MATERIAL_COURSES.santeria.capo,4);assert.equal(MATERIAL_COURSES.santeria.easyCapo,4);
assert.equal(MATERIAL_COURSES['your-song'].easyCapo,0);assert.equal(MATERIAL_COURSES['sleep-last-night'].easyCapo,0);
assert.deepEqual([...new Set(MATERIAL_COURSES['sleep-last-night'].steps.map(s=>s.name))],['E','A','G','B7']);
assert.equal(materialLyricKey('imagine',PREPARED_COURSES.imagine),'video:guitar:imagine');
assert.equal(Object.keys(SANSHIN_MATERIALS).length,8);
for(const material of Object.values(SANSHIN_MATERIALS)){
 assert.ok(material.start>=0);assert.ok(material.end===null||material.end>material.start);
 for(let i=0;i<material.chapters.length;i++){const [time]=material.chapters[i];assert.ok(i===0||time>material.chapters[i-1][0]);assert.equal(lessonChapter(material,time).index,i);if(i)assert.equal(lessonChapter(material,time-.001).index,i-1);}
}
console.log('Materials: eight complete simplified timelines, six chart migrations, recording-specific capos, preserved drafts and eight Sanshin chapter maps PASS');
const pcs=(shape,capo)=>[...new Set(shape.frets.flatMap((f,i)=>f<0?[]:[([40,45,50,55,59,64][i]+f+capo)%12]))].sort((a,b)=>a-b);
for(const [key,base] of Object.entries(PREPARED_COURSES)){
 const arranged=arrangeCourse(base,EASY_CAPOS[key]);assert.equal(arranged.key,base.key);assert.deepEqual(arranged.times,base.times);assert.ok(availableCapos(base).includes(EASY_CAPOS[key]));
 for(const step of arranged.steps){if(step.silent)continue;assert.deepEqual(pcs(SING_SHAPES[step.name],arranged.capo),pcs(SING_SHAPES[base.steps[step.index].name],base.capo),key+' preserves sounding harmony');assert.equal(transposeChord(step.name,arranged.capo-base.capo),base.steps[step.index].name);}
 for(const capo of availableCapos(base)){const shifted=arrangeCourse(base,capo);assert.equal(shifted.steps.length,base.steps.length);}
 for(let i=0;i<base.steps.length;i++){const phrase=chordPhrase(base,i);if(phrase)assert.ok(phrase.a>=0&&phrase.b<=base.end&&phrase.b-phrase.a>=1);const next=nextChange(base.steps,i);if(next>=0){assert.notEqual(base.steps[next].name,base.steps[i].name);assert.equal(changeCue(base,i,base.times[i]).remaining,base.times[next]-base.times[i]);}}
}
assert.equal(transposeChord('G/B',-2),'F/A');assert.equal(transposeChord('N',4),'N');assert.throws(()=>arrangeCourse(PREPARED_COURSES.tokiyo,2));assert.throws(()=>arrangeCourse(PREPARED_COURSES.tokiyo,Infinity));
const prelude={steps:[{name:'C'},{name:'C'},{name:'G'}],times:[2,4,6],end:10};
assert.deepEqual(changeCue(prelude,0,0),{started:false,next:0,remaining:2});assert.deepEqual(changeCue(prelude,0,3),{started:true,next:2,remaining:3});assert.equal(nextChange(prelude.steps,2),-1);
assert.deepEqual(timePhrase(15,20),{a:15,b:20});assert.deepEqual(timePhrase(100,20),{a:19,b:20});assert.equal(timePhrase(0,NaN),null);
const original=PREPARED_COURSES.santeria,edited=correctedCourse(original,{version:1,key:original.key,changes:[{index:2,name:'A',time:original.times[2]+.1}]}),easy=arrangeCourse(edited,4);
assert.equal(easy.steps[2].name,'F');assert.equal(easy.times[2],edited.times[2]);assert.equal(transposeChord(easy.steps[2].name,4),'A');assert.notEqual(original.steps[2].name,'A');
assert.deepEqual(PREPARED_COURSES['under-the-bridge'].steps.slice(0,13).map(x=>x.name),['D','F#','F#','D','D','F#','F#','D','F#','F#','D','D','F#']);
assert.ok(PREPARED_COURSES['yes-my-love'].steps.filter(x=>x.title==='サビ・反復').every(x=>['Fm','G7','C'].includes(x.name)));
console.log('11 song arrangements: sounding pitch equivalence, stable personal edits, distinct-change anticipation, prelude and bounded phrase loops PASS');
for(const url of ['javascript:alert(1)',`http://youtube.com/watch?v=${id}`,`https://youtube.com.evil.test/watch?v=${id}`,`https://evil.test/${id}`,'bad'])assert.equal(videoId(url),null);
assert.equal(TOKIYO_STEPS.length,110);assert.deepEqual(TOKIYO_STEPS.slice(-2).map(s=>s.name),['Fm','C']);assert.equal(new Set(TOKIYO_STEPS.map(s=>s.section)).size,11);
assert.deepEqual(sectionStarts(TOKIYO_STEPS).map(s=>s.index),[0,4,18,28,42,52,66,76,90,100,108]);
for(const step of TOKIYO_STEPS)assert.ok(Object.hasOwn(SING_SHAPES,step.name));
assert.equal(validRange(1,1.5,20),false);assert.equal(validRange(1,2,20),true);assert.equal(validRange(1,30,20),false);assert.equal(validRange(null,3,20),false);
assert.deepEqual(readSteps('C → Am | Dm, G').map(s=>s.name),['C','Am','Dm','G']);assert.throws(()=>readSteps('Unknown'));assert.throws(()=>readSteps('C '.repeat(513)));
assert.equal(normalizeSingState({index:999,capo:20,loop:true},110).index,0);assert.equal(normalizeSingState({index:110,capo:4,loop:true},110).capo,4);assert.equal(normalizeSingState({loop:true},110).loop,false);
assert.match(fingeringText('C'),/5弦3フレット・薬指/);
const open=[40,45,50,55,59,64];let checked=0;
for(const capo of [0,2,4,7])for(const name of ['C','Caug','Am','Dm','G','Em','A','F','Fm']){
 const shape=SING_SHAPES[name],midis=shape.frets.flatMap((f,i)=>f<0?[]:[open[i]+f+capo]);
 const found=detectChord(spectrum(midis),48000,16384,{rms:.1,capo});assert.equal(found.name,name,`${name}, capo ${capo}`);assert.ok(found.confidence>=.65);checked++;
}
assert.equal(detectChord(spectrum([52,56,59]),48000,16384,{rms:.1,capo:4}).name,'C','capo-aware C shape is an E sounding chord');
const sw=readFileSync('practice/sw.js','utf8');for(const name of ['singalong.mjs?v=36','singalong-core.mjs?v=36','youtube.mjs?v=36','singalong.css?v=36','songs/singalong-provenance.json'])assert.ok(sw.includes(name));assert.doesNotMatch(sw,/www\.youtube|googlevideo/);
const source=readFileSync('practice/singalong.mjs','utf8');assert.doesNotMatch(source,/MediaRecorder|sendBeacon|innerHTML/);
console.log(`Singalong: 110 harmonic targets, 11 sections, safe video URLs, loop bounds, local sequence validation and ${checked} capo-aware chord mixtures PASS`);

assert.equal(TOKIYO_VIDEO_ID,id);assert.equal(TOKIYO_TIMES.length,TOKIYO_STEPS.length);
assert.ok(TOKIYO_TIMES.every((t,i)=>Number.isFinite(t)&&t>=0&&(!i||t>TOKIYO_TIMES[i-1])));
assert.ok(TOKIYO_TIMES.at(-1)<TOKIYO_END&&TOKIYO_END<274.281);
for(let i=0;i<TOKIYO_TIMES.length;i++){
 assert.equal(cueAt(TOKIYO_TIMES,TOKIYO_TIMES[i]).index,i);
 if(i)assert.equal(cueAt(TOKIYO_TIMES,TOKIYO_TIMES[i]-.001).index,i-1);
 assert.equal(cueAt(TOKIYO_TIMES,TOKIYO_TIMES[i]+.3,-.3).index,i);
}
assert.equal(cueAt(TOKIYO_TIMES,NaN),null);assert.equal(cueAt(TOKIYO_TIMES,-100).index,0);
assert.equal(cueAt(TOKIYO_TIMES,274).ended,true);
const inspected=[[13,'Caug'],[14,'Em'],[18,'Am'],[22.4,'Dm'],[24,'G'],[28,'Caug'],[44.7,'Caug'],[66,'Caug'],[97,'G'],[116,'F'],[118.3,'C'],[150,'G'],[174,'C'],[195,'Caug'],[210,'C'],[222,'Em'],[230,'F'],[234,'C'],[236,'Am'],[238,'Dm'],[240,'G'],[242,'C'],[244,'Am'],[246,'Dm'],[248,'G'],[250,'Fm'],[255,'C']];
assert.deepEqual(inspected.filter(([time,name])=>TOKIYO_STEPS[cueAt(TOKIYO_TIMES,time).index].name!==name),[], 'inspected reference positions');
assert.equal(normalizeSingState({offset:Infinity,videoTime:-4,follow:false},110).offset,0);
assert.equal(normalizeSingState({offset:.4,videoTime:87.25,follow:false},110).videoTime,87.25);
assert.equal(normalizeSingState({offset:.4,videoTime:87.25,follow:false},110).follow,false);
assert.ok(sw.includes('video-cues.mjs?v=36'));
console.log('Video sync: all 110 boundary pairs, backward seeks, offset bounds and 27 inspected reference positions PASS');

assert.equal(JIGSAW_STEPS.length,101);assert.equal(JIGSAW_TIMES.length,101);assert.equal(new Set(JIGSAW_STEPS.map(s=>s.section)).size,14);
assert.equal(JIGSAW_VIDEO_ID,'x0YbxY-u7fI');assert.equal(JIGSAW_TIMES[0],0);assert.equal(JIGSAW_STEPS.at(-1).name,'Am');
assert.ok(JIGSAW_TIMES.at(-1)<JIGSAW_END&&JIGSAW_END<=271);
for(let i=0;i<JIGSAW_TIMES.length;i++){
 assert.ok(Number.isFinite(JIGSAW_TIMES[i])&&(!i||JIGSAW_TIMES[i]>JIGSAW_TIMES[i-1]));
 assert.equal(cueAt(JIGSAW_TIMES,JIGSAW_TIMES[i],0,JIGSAW_END).index,i);
 if(i)assert.equal(cueAt(JIGSAW_TIMES,JIGSAW_TIMES[i]-.001,0,JIGSAW_END).index,i-1);
}
const easyNames=[...new Set(JIGSAW_STEPS.map(s=>s.name))];assert.equal(easyNames.length,8);
for(const name of easyNames){const shape=SING_SHAPES[name];assert.ok(shape&&!shape.barre&&shape.frets.every(f=>f<=3));assert.ok(new Set(shape.fingers.filter(Boolean)).size<=3);const midis=shape.frets.flatMap((f,i)=>f<0?[]:[open[i]+f+2]);assert.equal(detectChord(spectrum(midis),48000,16384,{rms:.1,capo:2}).name,name);}
assert.equal(cueAt(JIGSAW_TIMES,260,0,JIGSAW_END).ended,false,'the second course must not inherit Time yo Tomare end time');assert.equal(cueAt(JIGSAW_TIMES,271,0,JIGSAW_END).ended,true);assert.equal(cueAt(TOKIYO_TIMES,260).ended,true);
const legacy={index:20,capo:4,videoTime:97.25,offset:.4,follow:false,a:30,b:50};
assert.equal(courseState(legacy,PREPARED_COURSES.tokiyo,TOKIYO_STEPS).videoTime,97.25);assert.equal(courseState(legacy,PREPARED_COURSES.tokiyo,TOKIYO_STEPS).follow,false);
const migrated=courseState({...legacy,capo:0},PREPARED_COURSES.jigsaw,JIGSAW_STEPS);assert.equal(migrated.capo,2);assert.equal(migrated.index,0);assert.equal(migrated.videoTime,0);assert.equal(migrated.a,null);assert.equal(migrated.offset,0);assert.equal(migrated.follow,true);
const same=courseState({...legacy,timeline:PREPARED_COURSES.jigsaw.key,capo:2},PREPARED_COURSES.jigsaw,JIGSAW_STEPS);assert.equal(same.videoTime,97.25);assert.equal(same.follow,false);
const custom=courseState({index:1,capo:0,follow:false,videoTime:12},PREPARED_COURSES.jigsaw,readSteps('C Am'),true);assert.equal(custom.index,1);assert.equal(custom.capo,0);assert.equal(custom.videoTime,12);
for(const file of ['singalong-courses.mjs?v=36','jigsaw-cues.mjs?v=36'])assert.ok(sw.includes(file));
console.log('Two prepared courses: Jigsaw 101 targets/14 sections/eight open shapes, independent end times, capo-aware detection, legacy migration and custom-order preservation PASS');

assert.equal(Object.keys(PREPARED_COURSES).length,11);
assert.equal(Object.values(PREPARED_COURSES).filter(c=>c.estimated).length,9);
for(const [key,course] of Object.entries(PREPARED_COURSES)){
 assert.equal(course.steps.length,course.times.length,key);assert.ok(course.times.length>0&&course.times.length<=1024);
 for(let i=0;i<course.times.length;i++){
  const time=course.times[i],step=course.steps[i];assert.equal(step.index,i);assert.ok(Number.isFinite(time)&&time>=0&&time<course.end);assert.ok(!i||time>course.times[i-1]);
  assert.ok(step.silent?step.name==='N':Object.hasOwn(SING_SHAPES,step.name));assert.equal(cueAt(course.times,time,0,course.end).index,i);if(i)assert.equal(cueAt(course.times,time-.0001,0,course.end).index,i-1);
 }
 assert.equal(cueAt(course.times,course.end,0,course.end).ended,true);
}
assert.equal(harmonyName('A#'),'Bb');assert.equal(harmonyName('Dbm'),'C#m');assert.equal(harmonyName('D#m'),'Ebm');assert.equal(harmonyName('Gb'),'F#');assert.equal(harmonyName('Abm'),'G#m');assert.throws(()=>harmonyName('<script>'));
const sample=estimatedCourse({id:'test',video:'abcdefghijk',bpm:120,duration:8,events:'0:N 2:Dbm 4:Gb 5:N',source:'https://source.example'});
assert.deepEqual(sample.times,[0,.5,1.5,2]);assert.deepEqual(sample.steps.map(s=>s.name),['N','C#m','F#','N']);
assert.throws(()=>estimatedCourse({id:'test',video:'abcdefghijk',bpm:120,duration:8,events:'2:C 1:G'}));
assert.throws(()=>estimatedCourse({id:'test',video:'abcdefghijk',bpm:0,duration:8,events:'1:C'}));
const edits={version:1,key:sample.key,changes:[{index:1,name:'Ebm',time:.8}]},changed=correctedCourse(sample,edits);
assert.equal(changed.steps[1].name,'Ebm');assert.equal(changed.times[1],.8);assert.equal(sample.steps[1].name,'C#m');assert.equal(sample.times[1],.5);
for(const change of [null,{index:-1},{index:4},{index:1,time:0},{index:1,time:1.5},{index:1,time:NaN},{index:1,name:'toString'},{index:1,name:'__proto__'}])assert.throws(()=>correctedCourse(sample,{version:1,key:sample.key,changes:[change]}));
assert.throws(()=>correctedCourse(sample,{...edits,key:'another-video'}));assert.throws(()=>correctedCourse(sample,{...edits,changes:[{index:1},{index:1}]}));
for(const capo of [0,2,4,7])for(const name of ['C#','Eb','F#','Bb','Ebm','F#m','G#m','Bbm'])for(const shape of [SING_SHAPES[name],SMALL_GRIPS[name]]){
 const midis=shape.frets.flatMap((f,i)=>f<0?[]:[open[i]+f+capo]);assert.equal(detectChord(spectrum(midis),48000,16384,{rms:.1,capo}).name,name,`${name} compact/standard capo ${capo}`);
}
console.log('All 11 course boundaries, explicit 9 uncertain guides, rests, enharmonic names, isolated bounded corrections and 64 new compact/standard capo mixtures PASS');
let ms=0;const clock=practiceClock(10,2,()=>ms);ms=1000;assert.equal(clock.getCurrentTime(),2);clock.playVideo();ms=3000;assert.equal(clock.getCurrentTime(),4);clock.pauseVideo();ms=5000;assert.equal(clock.getCurrentTime(),4);clock.playVideo();clock.setPlaybackRate(.5);ms=7000;assert.equal(clock.getCurrentTime(),5);clock.seekTo(9);ms=11000;assert.equal(clock.getCurrentTime(),10);clock.destroy();ms=20000;assert.equal(clock.getCurrentTime(),10);assert.equal(clock.getPlayerState(),2);
console.log('Separate-device local clock: explicit start, pause, speed, seek, end clamp and destroy PASS');

assert.equal(sanshinMaterialChoice("anata-ni",null,false),"performance");
assert.equal(sanshinMaterialChoice("anata-ni",null,true),"original");
assert.equal(sanshinMaterialChoice("anata-ni","performance",true),"performance");
assert.equal(sanshinMaterialChoice("anata-ni","performance",true,"original"),"original");
assert.equal(sanshinSessionKey("anata-ni","original"),"music-practice-sanshin-video-anata-ni-v1");
assert.notEqual(sanshinSessionKey("anata-ni","original"),sanshinSessionKey("anata-ni","performance"));
assert.notEqual(sanshinLyricKey("anata-ni","original"),sanshinLyricKey("anata-ni","performance"));
