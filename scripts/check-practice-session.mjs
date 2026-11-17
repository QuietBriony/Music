import {lyricManualLine} from '../practice/lyrics.mjs';
import {packLyricRecord,migratePresetCopy} from '../practice/lyric-storage.mjs';
import {createHash} from 'node:crypto';
import {lyricPhraseRange} from '../practice/score-lyrics.mjs';
import {ahaMidi,AHA_CYCLE} from './build-practice-aha.mjs';
import assert from 'node:assert/strict';
import { scoreLyricAnnotations } from '../practice/score-lyrics.mjs';
import { readFileSync } from 'node:fs';
import { readLyrics,resolveLyricTiming,normalizeCues,lyricAt,lrcText,readChordSheet,readLyricFile } from '../practice/lyrics.mjs';
import { LYRIC_PRESETS } from '../practice/lyric-presets.mjs';
import {minyoVerse,readMinyoVerses,MINYO_VERSE_STORAGE} from '../practice/minyo-verses.mjs';
import { normalizeLyricNotes,readParallelNotes } from '../practice/lyric-notes.mjs';
import { chordExercise,scoreNotes } from '../practice/scores.mjs';
import {parseMidi} from '../practice/midi.mjs';
import {tsukinuMidi} from './build-practice-tsukinu.mjs';
const parsed=readLyrics('[ar:My own song]\n[00:00.00]My first line\n[00:02.50][00:09.00]My second line');
assert.deepEqual(parsed.lines,['My first line','My second line']);assert.deepEqual(parsed.cues,[{line:0,time:0},{line:1,time:2.5},{line:1,time:9}]);
assert.equal(lyricAt(normalizeCues([{line:1,time:4*60/85}],2),4*60/85),1,'Fractional beat positions use the same millisecond precision as saved cues');
assert.equal(lyricAt(parsed.cues,2.49),0);assert.equal(lyricAt(parsed.cues,2.5),1);assert.equal(lyricAt(parsed.cues,-1),-1);
assert.deepEqual(readLyrics(lrcText(parsed.lines,parsed.cues)).cues,[{line:0,time:0},{line:1,time:2.5},{line:2,time:9}]);
assert.deepEqual(readLyrics(lrcText(['Minute boundary'],[{line:0,time:59.999}])).cues,[{line:0,time:60}]);
assert.deepEqual(readLyrics('<img src=x>\n<script>literal text</script>').lines,['<img src=x>','<script>literal text</script>']);
assert.throws(()=>readLyrics('x'.repeat(20001)));assert.throws(()=>readLyrics('x\n'.repeat(201)));assert.throws(()=>readLyrics('[00:99]Bad time'));
assert.deepEqual(normalizeCues([null,4,{line:0,time:3},{line:1,time:-1},{line:90,time:0},{line:0,time:NaN}],2),[{line:0,time:3}]);
const sheet=readChordSheet('{title:My own exercise}\n[C]One [Am]two\n[F]Three [G]four');
assert.deepEqual(sheet.names,['C','Am','F','G']);assert.equal(sheet.text,'One two\nThree four');assert.equal(sheet.title,'My own exercise');
assert.equal(sheet.cues[1].time,8*60/85);assert.equal(scoreNotes(chordExercise(sheet.names),'chords','guitar',{chords:true}).cues.length,4);
assert.throws(()=>readChordSheet('[Unknown]line'),/未対応/);assert.throws(()=>readChordSheet('No chord tokens'));
assert.throws(()=>readChordSheet('[C]line\n'.repeat(65)),/64/);
for(const preset of Object.values(LYRIC_PRESETS)){const data=readLyrics(preset.text);assert.ok(preset.cues.every(c=>c.line<data.lines.length));assert.ok(preset.source.startsWith('https:'));}
assert.equal(Object.hasOwn(LYRIC_PRESETS,'song:asatoya'),false,'No unverified traditional text is imposed on the different modern Asatoya melody');
for(const [song,count,beats]of[['tinsagu',26,[16,24,32,40]],['tsukinu',18,[16,24,32]]]){
 const midi=parseMidi(readFileSync(`practice/songs/${song}.mid`)),notes=scoreNotes(midi,midi.groups[0].id,'sanshin').notes;
 for(const verse of [2,3]){
  const key=minyoVerse(`song:${song}`,verse).key,preset=LYRIC_PRESETS[key],lines=readLyrics(preset.text).lines,annotations=scoreLyricAnnotations(notes,{...preset,lines});
  assert.equal(preset.syllables.length,count);assert.equal(annotations.filter(a=>a.text).length,count);
  assert.deepEqual(preset.cues.map(c=>Math.round(c.time*85/60)),beats);
  assert.deepEqual(preset.notes.map(n=>n.text),lines,'Readings and meanings belong to the chosen verse, not the previous text');
  for(const s of preset.syllables){const i=notes.findIndex(n=>n.beat===s.beat);assert.ok(i>=0,'Lyric fragments attach to sounding cells, not rests');assert.equal(annotations[i].text,s.text);assert.equal(lyricAt(normalizeCues(preset.cues,lines.length),notes[i].time),s.line);}
  for(let line=0;line<lines.length;line++)assert.equal(preset.syllables.filter(s=>s.line===line).map(s=>s.text).join(''),preset.notes[line].reading.replaceAll(' ',''));
  assert.equal(resolveLyricTiming(preset,{cues:[{line:0,time:7}],follow:false},readLyrics(preset.text)).follow,false,'Selecting a verse does not overwrite private timing or manual mode');
 }
}
assert.deepEqual(minyoVerse('song:tinsagu',1),{verse:1,key:'song:tinsagu'},'The existing first-verse private lyric key is unchanged');
assert.equal(minyoVerse('song:tsukinu',2).key,'song:tsukinu:verse:2');
for(const bad of [undefined,-1,0,4,'2',NaN,{},null])assert.equal(minyoVerse('song:tinsagu',bad).verse,1);
for(const bad of ['__proto__','song:asatoya','song:amazing-grace',null])assert.equal(minyoVerse(bad,2),null);
const storedSelection=readMinyoVerses({getItem:key=>{assert.equal(key,MINYO_VERSE_STORAGE);return JSON.stringify({'song:tinsagu':3,'song:tsukinu':2,'song:asatoya':1});}});
assert.deepEqual(storedSelection,{'song:tinsagu':3,'song:tsukinu':2});
assert.deepEqual(readMinyoVerses({getItem(){throw Error('blocked');}}),{});
assert.deepEqual(readMinyoVerses({getItem:()=>'{bad'}),{});
const lyricRights=JSON.parse(readFileSync('practice/songs/lyrics-provenance.json','utf8')),minyoResearch=JSON.parse(readFileSync('practice/songs/minyo-v42-research.json','utf8'));
assert.deepEqual(lyricRights.authorization.by_song.map(s=>s.id),['asatoya','tinsagu','tsukinu','amazing-grace','twinkle','aha','akata','tancha']);
assert.ok(lyricRights.authorization.by_song.every(s=>s.date==='2026-11-17'&&s.quote));
assert.equal(minyoResearch.decisions.find(s=>s.song==='asatoya').adopted,false);
assert.equal(minyoResearch.candidates_research_only.length,3,'The v42 research history retains its three candidates');
assert.ok(minyoResearch.candidates_research_only.every(c=>c.v43_adoption?.includes('v43')),'Research history points to later adoption and corrected provenance');
for(const s of minyoResearch.decisions)for(const source of s.sources){assert.equal(new URL(source.url).protocol,'https:');if(source.sha256)assert.match(source.sha256,/^[a-f0-9]{64}$/);}
assert.equal(lyricAt(LYRIC_PRESETS['song:twinkle'].cues,16*.666667),2);
const personal=readParallelNotes(['First','Second'],'ふぁーすと\nせかんど','最初\n次');
assert.equal(normalizeLyricNotes(personal,['Changed','Second'])[0].meaning,'','Changed lyric must not keep an unrelated meaning');
assert.equal(normalizeLyricNotes(personal,['Changed','Second'])[1].meaning,'次');
assert.throws(()=>readParallelNotes(['First','Second'],'one',''),/2行/);
assert.throws(()=>readParallelNotes(['First'],'','x'.repeat(20001)),/2万字/);
assert.equal(readParallelNotes(['First','Second'],'one\n','')[1].reading,'');
assert.equal(normalizeLyricNotes([{text:'First',meaning:42}],['First'])[0].meaning,'');
assert.equal(LYRIC_PRESETS['song:tinsagu'].notes.length,4);
const tinsagu=LYRIC_PRESETS['song:tinsagu'],tinParsed=readLyrics(tinsagu.text);
assert.deepEqual(tinsagu.cues.map(c=>Math.round(c.time*85/60)),[16,24,32,40],'First-verse entrances follow the licensed simplified sheet');
assert.equal(tinsagu.singing.end*85/60,45);
const oldDefault=resolveLyricTiming(tinsagu,{text:tinsagu.text,cues:[],follow:false},tinParsed);
assert.equal(oldDefault.upgrade,true);assert.equal(oldDefault.follow,true);
assert.equal(resolveLyricTiming(tinsagu,{cues:[],follow:false,syncVersion:1},tinParsed).follow,false,'An explicit later manual choice survives reload');
assert.deepEqual(resolveLyricTiming(tinsagu,{cues:[{line:1,time:9}],follow:false},tinParsed).cues,[{line:1,time:9}],'User timing wins');
assert.equal(resolveLyricTiming(tinsagu,{cues:[],follow:false},readLyrics('My own words')).upgrade,false,'Personal lyrics are never replaced');
assert.deepEqual(resolveLyricTiming(tinsagu,null,readLyrics('[00:03]Own LRC')).cues,[{line:0,time:3}]);
for(let line=0;line<4;line++)assert.equal(tinsagu.syllables.filter(s=>s.line===line).map(s=>s.text).join(''),['てぃんさぐぬはなや','ちみさちにすみてぃ','うやぬゆしぐとぅや','ちむにすみり'][line]);
const annotationNotes=Array.from({length:64},(_,beat)=>({beat,time:beat*60/85})).filter(n=>n.beat!==29);
const inline=scoreLyricAnnotations(annotationNotes,tinsagu);
assert.equal(inline[16].text,'てぃ');assert.equal(inline[43].text,'り');assert.equal(inline[44].text,'');
assert.equal(inline[28].text,'す');assert.equal(inline[29].text,'み','Rest does not shift lyric positions');
const personalInline=scoreLyricAnnotations(annotationNotes,{lines:['<script>plain text</script>'],cues:[{line:0,time:1}]});assert.equal(personalInline[2].text,'<script>plain text</script>');
const moon=LYRIC_PRESETS['song:tsukinu'],moonMidi=parseMidi(tsukinuMidi()),moonNotes=scoreNotes(moonMidi,moonMidi.groups[0].id,'sanshin').notes;
const moonSheet={...moon,lines:readLyrics(moon.text).lines},moonInline=scoreLyricAnnotations(moonNotes,moonSheet);
assert.equal(moonNotes.length,37);assert.equal(moonMidi.endBeat,42);
assert.deepEqual(moon.cues.map(c=>Math.round(c.time*85/60)),[16,24,32]);
for(const s of moon.syllables){const i=moonNotes.findIndex(n=>n.beat===s.beat);assert.ok(i>=0,'A syllable must belong to a sounding cell, never a rest');assert.equal(moonInline[i].text,s.text);assert.equal(lyricAt(normalizeCues(moon.cues,3),moonNotes[i].time),s.line);}
for(let line=0;line<3;line++)assert.equal(moon.syllables.filter(s=>s.line===line).map(s=>s.text).join(''),['つくぬかいしゃとぅかみっか','みやらびかいしゃとぅななつ','ほーいちょーが'][line]);
assert.equal(moonInline.filter(s=>s.text).length,18);assert.equal(moonInline.filter((s,i)=>moonNotes[i].beat<16).some(s=>s.text),false,'The introduction carries no sung words');
assert.equal(moon.notes.length,3);assert.ok(moon.notes.every(n=>n.reading&&n.meaning));
assert.equal(resolveLyricTiming(moon,{cues:[{line:1,time:5}],follow:false},readLyrics(moon.text)).follow,false,'A personal manual lyric mode survives a new built-in preset');
assert.deepEqual(resolveLyricTiming(moon,{cues:[{line:1,time:5}],follow:false},readLyrics(moon.text)).cues,[{line:1,time:5}]);
assert.equal(scoreLyricAnnotations(annotationNotes,{lines:['No timing'],cues:[]}).every(n=>!n.text),true,'Untimed personal lyrics do not acquire invented placement');
const lyricsSource=readFileSync('practice/lyrics.mjs','utf8');assert.doesNotMatch(lyricsSource,/innerHTML|fetch\(|XMLHttpRequest|sendBeacon/);
assert.equal(await readLyricFile({size:24,text:async()=> '\uFEFF[00:01]My own line'}),'[00:01]My own line');
await assert.rejects(()=>readLyricFile({size:80001,text:async()=>{throw new Error('must not read');}}),/80 KB/);
await assert.rejects(()=>readLyricFile({size:20001,text:async()=> 'x'.repeat(20001)}),/2万字/);
await assert.rejects(()=>readLyricFile({size:5,text:async()=> '\0binary'}),/UTF-8/);
await assert.rejects(()=>readLyricFile({size:5,text:async()=> '\uFFFD'}),/UTF-8/);
const sw=readFileSync('practice/sw.js','utf8');for(const path of ['lyric-notes.mjs?v=44','songs/learning-provenance.json','progress.mjs?v=44','songs/tokiyo-study.json','session.css?v=44','lyrics.mjs?v=44','lyric-presets.mjs?v=44','songs/lyrics-provenance.json','polyphonic.mjs?v=44'])assert.ok(sw.includes(path),path);

const ahaData=ahaMidi(),ahaModel=parseMidi(ahaData),ahaScore=scoreNotes(ahaModel,ahaModel.groups[0].id,'sanshin').notes,aha=LYRIC_PRESETS['song:aha'];
assert.deepEqual(Buffer.from(ahaData),readFileSync('practice/songs/aha.mid'),'The generated elementary Aha score is reproducible');
assert.equal(AHA_CYCLE.length,53);assert.equal(ahaScore.length,92);assert.equal(ahaModel.endBeat,107);
const ahaSheet={...aha,lines:readLyrics(aha.text).lines,follow:true,presetTiming:true},ahaInline=scoreLyricAnnotations(ahaScore,ahaSheet);
assert.equal(ahaInline.filter(s=>s.text).length,30);
for(const fragment of aha.syllables){const i=ahaScore.findIndex(n=>n.beat===fragment.beat);assert.ok(i>=0,'Aha phonetics belong to a sounding cell');assert.equal(ahaInline[i].text,fragment.text);assert.equal(lyricAt(normalizeCues(aha.cues,4),ahaScore[i].time),fragment.line);}
for(let i=0;i<4;i++)assert.equal(aha.syllables.filter(s=>s.line===i).map(s=>s.text).join(''),aha.notes[i].reading.replaceAll(' ',''));
for(const beat of [8,28,61,81]){
 const i=ahaScore.findIndex(n=>n.beat===beat),range=lyricPhraseRange(ahaScore,ahaSheet,i);
 assert.ok(range&&range.end>range.start);assert.ok(ahaScore[range.start].time+.001>=aha.cues[range.line].time);
 assert.equal(lyricAt(normalizeCues(aha.cues,4),ahaScore[range.start].time),range.line);
 assert.ok(ahaScore[range.end-1].time<([28,61,81,96][range.line])*60/85);
}
assert.ok(lyricPhraseRange(ahaScore,{...ahaSheet,follow:false},10),'Manual lyric display does not invalidate verified score timing');
assert.equal(lyricPhraseRange(ahaScore,{...ahaSheet,follow:false,manualLine:1},10).line,1,'Selecting a lyric row chooses that verified line');
assert.equal(lyricPhraseRange(ahaScore,{...ahaSheet,presetTiming:false},10),null,'Private timing does not acquire a guessed practice loop');
for(const beat of [0,27,43,52,60,80,96,105]){const i=ahaScore.findIndex(n=>n.beat===beat);if(i>=0)assert.equal(lyricPhraseRange(ahaScore,ahaSheet,i),null,'Instrumental gaps offer no sung-line repeat');}
assert.equal(lyricPhraseRange(ahaScore,{lines:['No times'],cues:[]},0),null);
assert.equal(lyricPhraseRange([],{lines:['Empty score'],cues:[{line:0,time:0}]},0),null);
const unsorted=lyricPhraseRange(ahaScore,{...ahaSheet,cues:[...aha.cues].reverse()},ahaScore.findIndex(n=>n.beat===8));assert.equal(unsorted.line,0,'Cue order is normalized without mutating personal data');
for(const id of ['akata','tancha']){const p=LYRIC_PRESETS[`video:sanshin:${id}`];assert.ok(p.text&&p.notes.every(n=>n.reading&&n.meaning));assert.deepEqual(p.cues,[],'Unverified teacher-video timing is never fabricated');assert.equal(Object.hasOwn(LYRIC_PRESETS,`song:${id}`),false,'No unverified native score route is advertised');}
for(const bad of [undefined,-1,4,'2',NaN,Infinity,null])assert.equal(lyricManualLine(bad,4),0);assert.equal(lyricManualLine(2,4),2);assert.equal(lyricManualLine(0,0),0);
assert.equal(minyoVerse('song:aha',1),null,'A single-stanza song does not expose the other songs verse selector');
assert.equal(JSON.parse(readFileSync('practice/songs/folk-v43-provenance.json','utf8')).authorization.answer,'3曲の伝承歌詞も収録してOK');

// All native verses end at the final sung cell, not a later instrumental bar.
for(const id of ['aha','tinsagu','tsukinu']){
 const midi=parseMidi(readFileSync(`practice/songs/${id}.mid`)),ns=scoreNotes(midi,midi.groups[0].id,'sanshin').notes;
 for(const [key,p] of Object.entries(LYRIC_PRESETS).filter(([key])=>key===`song:${id}`||key.startsWith(`song:${id}:verse:`))){
  const s={...p,lines:readLyrics(p.text).lines,presetTiming:true};
  for(const cue of p.cues){const start=ns.findIndex(n=>n.time+.001>=cue.time),range=lyricPhraseRange(ns,s,start),lastBeat=Math.max(...p.syllables.filter(f=>f.line===cue.line).map(f=>f.beat));
   assert.ok(range,key+' verified line is available');assert.equal(ns[range.end-1].beat,lastBeat,key+' ends on the final sung syllable');
   assert.ok((ns[range.end-1].stepSeconds-ns[range.end-1].duration)/(60/85)<=3.001,key+' has at most three beats of unsung tail');
   assert.deepEqual(lyricPhraseRange(ns,{...s,follow:false,manualLine:cue.line},0),range,'Manual selection keeps the verified line range');
  }
 }
}
const beforePreset={text:'First line\nSecond line',notes:[{text:'First line',reading:'first'},{text:'Second line',reading:'second'}],cues:[{line:0,time:0},{line:1,time:4}],syncVersion:1};
const record={text:beforePreset.text,notes:beforePreset.notes,cues:beforePreset.cues,follow:false,manualLine:1};
const ref=packLyricRecord(beforePreset,record);assert.equal(ref.preset,true);assert.equal(Object.hasOwn(ref,'text'),false);assert.equal(Object.hasOwn(ref,'notes'),false);assert.equal(Object.hasOwn(ref,'cues'),false);assert.equal(ref.manualLine,1);assert.equal(ref.follow,false);
assert.ok(Object.hasOwn(packLyricRecord(beforePreset,{...record,text:'My edited words'}),'text'),'Edited words remain explicit personal data');
assert.ok(Object.hasOwn(packLyricRecord(beforePreset,{...record,notes:[{text:'First line',meaning:'My own explanation'}]}),'notes'),'Edited annotations are not erased');
const ownCues=[{line:0,time:2.5}];assert.deepEqual(packLyricRecord(beforePreset,{...record,cues:ownCues}).cues,ownCues,'Personal timing survives a preset reference');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),known={fixture:{content:digest([record.text,record.notes]),cues:digest(record.cues)}};
const afterPreset={...beforePreset,text:'Corrected bundled line\nSecond line'};
const migrated=await migratePresetCopy('fixture',record,afterPreset,known);assert.equal(migrated.preset,true);assert.equal(Object.hasOwn(migrated,'text'),false,'A known old copy cannot shadow corrected bundled words');
assert.deepEqual(await migratePresetCopy('fixture',{...record,text:'My edit'},afterPreset,known),{...record,text:'My edit'});
assert.deepEqual(await migratePresetCopy('fixture',{...record,notes:[{text:'First line',meaning:'My note'}]},afterPreset,known),{...record,notes:[{text:'First line',meaning:'My note'}]});
assert.deepEqual((await migratePresetCopy('fixture',{...record,cues:ownCues},afterPreset,known)).cues,ownCues);
assert.equal((await migratePresetCopy('fixture',record,undefined,known)).preset,true,'A removed bundled item leaves no copied lyrics in the migrated record');
assert.equal(resolveLyricTiming(beforePreset,ref,readLyrics(beforePreset.text)).follow,false,'A reference keeps explicit manual mode and uses current preset cues');
assert.deepEqual(resolveLyricTiming(beforePreset,ref,readLyrics(beforePreset.text)).cues,beforePreset.cues);
const twinklePreset=LYRIC_PRESETS['song:twinkle'],twinkleModel=parseMidi(readFileSync('practice/songs/twinkle.mid')),twinkleNotes=scoreNotes(twinkleModel,twinkleModel.groups[0].id,'sanshin').notes;
for(const cue of twinklePreset.cues){
 const index=twinkleNotes.findIndex(n=>n.time+.001>=cue.time),s={...twinklePreset,lines:readLyrics(twinklePreset.text).lines,presetTiming:true};
 const range=lyricPhraseRange(twinkleNotes,s,index);assert.ok(range,'The existing Twinkle line loop remains available');assert.equal(range.line,cue.line);
 assert.ok(twinkleNotes[range.end-1].time<twinklePreset.lineEnds[cue.line]);assert.ok((twinkleNotes[range.end-1].stepSeconds-twinkleNotes[range.end-1].duration)/.666667<=3.001);
 assert.deepEqual(lyricPhraseRange(twinkleNotes,{...s,follow:false,manualLine:cue.line},0),range);
 assert.equal(lyricPhraseRange(twinkleNotes,{...s,presetTiming:false},index),null,'Private Twinkle timing is not guessed');
}
for(const verse of [2,3]){
 const tin=LYRIC_PRESETS[`song:tinsagu:verse:${verse}`],moon=LYRIC_PRESETS[`song:tsukinu:verse:${verse}`];
 assert.equal(tin.scoreSource,LYRIC_PRESETS['song:tinsagu'].source,'Later verses retain the licensed notation source link');
 assert.ok(tin.credit.includes('沖縄県の掲載ふりがな'),'Existing prefecture readings receive attribution');
 assert.equal(moon.license,'https://creativecommons.org/publicdomain/zero/1.0/','Later Moon verses expose their CC0 link');
}
assert.deepEqual(lyricRights.decisions_source,['songs/minyo-v42-research.json','songs/folk-v43-provenance.json']);
const ahaRights=JSON.parse(readFileSync('practice/songs/aha-provenance.json','utf8')),folkRights=JSON.parse(readFileSync('practice/songs/folk-v43-provenance.json','utf8'));
assert.equal(ahaRights.source,'https://mabui.jp/ahabushi/');assert.equal(lyricRights.texts.find(t=>t.id==='aha').source,ahaRights.source);
assert.ok(ahaRights.rights_basis.notation_basis.endsWith('/about-kunkunshi-2021/'));assert.ok(ahaRights.rights_basis.comparison_result.includes('first53'));
assert.equal(lyricRights.texts.find(t=>t.id==='tancha').refrain_source,'https://www.ryukyumura.co.jp/official/oki100/vol5/');
assert.ok(folkRights.decisions.every(d=>d.sources.every(s=>s.url&&s.use)),'Each cited source has an explicit use');
assert.ok(!LYRIC_PRESETS['video:sanshin:akata'].credit.includes('文化庁'),'An unavailable source is not credited as an active reference');
console.log('Practice session: lyric parsing, verified sung-line loops, compact preset storage/migration, private edits and PWA coverage PASS');
