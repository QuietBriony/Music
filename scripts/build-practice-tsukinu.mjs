// Newly entered elementary study of the traditional Yaeyama melody.
// The common melody is moved from niage to honchoshi finger positions.
// No teacher layout, recording, modern translation or expressive timing is bundled.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encodeMidi} from './build-practice-songs.mjs';
import {sanshinPosition} from '../practice/sanshin-core.mjs';
export const TSUKINU_PARTS=[
 {title:'前奏',symbols:'上上工上工五五○上上工上工五五○'},
 {title:'1節',symbols:'上上工上工五五○六五工中上四上合'},
 {title:'囃子',symbols:'工五五○六五中中四'}
];
export function tsukinuNotes(){
 let beat=0;const notes=[];
 for(const part of TSUKINU_PARTS)for(const symbol of part.symbols){
  if(symbol!=='○')notes.push({midi:sanshinPosition(symbol).midi,beat,beats:1});
  beat++;
 }
 notes.at(-1).beats=2;return notes;
}
export const tsukinuMidi=()=>encodeMidi(tsukinuNotes(),{bpm:85,name:'Tsukinu Kaisha - one verse and refrain - honchoshi elementary study'});
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-practice-tsukinu.mjs')){
 const midi=tsukinuMidi();writeFileSync('practice/songs/tsukinu.mid',midi);
 const path='practice/songs/tsukinu-provenance.json',meta=JSON.parse(readFileSync(path,'utf8'));
 meta.sha256=createHash('sha256').update(midi).digest('hex');meta.notes=tsukinuNotes().length;meta.beats=tsukinuNotes().at(-1).beat+2;
 writeFileSync(path,JSON.stringify(meta,null,2)+'\n');
 const catalogPath='practice/songs/provenance.json',catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
 catalog.songs=catalog.songs.filter(s=>s.id!=='tsukinu');catalog.songs.push({...meta,id:'tsukinu',file:'tsukinu.mid'});
 writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');console.log('Tsukinu:',meta.notes,'notes /',meta.beats,'beats');
}
