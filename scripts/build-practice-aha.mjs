// Basic traditional melody, newly entered as an equal-beat beginner study.
// Compare university No43 p265 and the independently published teacher sheets.
// Small ornaments, vocal inflections and teacher layout are deliberately omitted.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encodeMidi} from './build-practice-songs.mjs';
import {sanshinPosition} from '../practice/sanshin-core.mjs';
export const AHA_CYCLE='工七五工中合工合工○工五工○中合工合工五工○中上四○上中工中上中合○合乙四○四乙四乙合○工七五工中合工合工';
export function ahaNotes(){
 const notes=[];
 for(let cycle=0;cycle<2;cycle++)[...AHA_CYCLE].forEach((symbol,i)=>{if(symbol!=='○')notes.push({midi:sanshinPosition(symbol).midi,beat:cycle*AHA_CYCLE.length+i,beats:1});});
 notes.at(-1).beats=2;return notes;
}
export const ahaMidi=()=>encodeMidi(ahaNotes(),{bpm:85,name:'Aha Bushi - traditional first stanza - elementary honchoshi study'});
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-practice-aha.mjs')){
 const midi=ahaMidi();writeFileSync('practice/songs/aha.mid',midi);
 const path='practice/songs/aha-provenance.json',meta=JSON.parse(readFileSync(path,'utf8'));
 meta.sha256=createHash('sha256').update(midi).digest('hex');meta.notes=ahaNotes().length;meta.beats=ahaNotes().at(-1).beat+2;
 writeFileSync(path,JSON.stringify(meta,null,2)+'\n');
 const catalogPath='practice/songs/provenance.json',catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
 catalog.songs=catalog.songs.filter(s=>s.id!=='aha');catalog.songs.push({...meta,id:'aha',file:'aha.mid'});
 writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');console.log('Aha:',meta.notes,'notes /',meta.beats,'beats');
}
