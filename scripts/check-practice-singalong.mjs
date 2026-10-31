import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { videoId,validRange,readSteps,TOKIYO_STEPS,SING_SHAPES,normalizeSingState,fingeringText,sectionStarts } from '../practice/singalong-core.mjs';
import { detectChord } from '../practice/polyphonic.mjs';
import { TOKIYO_TIMES,TOKIYO_VIDEO_ID,TOKIYO_END,cueAt } from '../practice/video-cues.mjs';
import { spectrum } from './lib/practice-signal-fixtures.mjs';
import { JIGSAW_STEPS,JIGSAW_TIMES,JIGSAW_END,JIGSAW_VIDEO_ID } from '../practice/jigsaw-cues.mjs';
import { PREPARED_COURSES,courseState } from '../practice/singalong-courses.mjs';
const id='KgKycz0uHbM';for(const url of [id,`https://youtu.be/${id}`,`https://www.youtube.com/watch?v=${id}`,`https://www.youtube-nocookie.com/embed/${id}`])assert.equal(videoId(url),id);
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
const sw=readFileSync('practice/sw.js','utf8');for(const name of ['singalong.mjs?v=21','singalong-core.mjs?v=21','youtube.mjs?v=21','singalong.css?v=21','songs/singalong-provenance.json'])assert.ok(sw.includes(name));assert.doesNotMatch(sw,/www\.youtube|googlevideo/);
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
assert.ok(sw.includes('video-cues.mjs?v=21'));
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
for(const file of ['singalong-courses.mjs?v=21','jigsaw-cues.mjs?v=21'])assert.ok(sw.includes(file));
console.log('Two prepared courses: Jigsaw 101 targets/14 sections/eight open shapes, independent end times, capo-aware detection, legacy migration and custom-order preservation PASS');
