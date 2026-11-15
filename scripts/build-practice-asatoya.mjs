// New elementary study of the public-domain melody by Chohu Miyara (1939).
// Melody cross-checks and rights basis: songs/asatoya-provenance.json.
// No publisher PDF, recording, lyrics, ornament or performance timing is copied.
import { writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeMidi } from './build-practice-songs.mjs';
import { sanshinPosition } from '../practice/sanshin-core.mjs';
export const ASATOYA_PARTS=[
 {title:'前奏・前半',symbols:'中工七合七合七七五工四上中工合工合五工○'},
 {title:'前奏・結び',symbols:'四合上合中上合工合乙四中上老四○'},
 {title:'1節・前半',symbols:'四合上合中工中合上合四合上中工合工五工合'},
 {title:'1節・短い返し',symbols:'工合五合五七工○'},
 {title:'1節・後半',symbols:'合五七五合工中上合中五工合中上四○'},
 {title:'1節・結び',symbols:'四合上合中上合工合乙四中上老四'}
];
export function asatoyaNotes(){
 let beat=0;const notes=[];
 for(const part of ASATOYA_PARTS)for(const symbol of part.symbols){
  if(symbol!=='○'){const position=sanshinPosition(symbol);if(!position)throw Error('Unknown symbol');notes.push({midi:position.midi,beat,beats:1});}beat++;
 }
 notes.at(-1).beats=2;return notes;
}
export const asatoyaMidi=()=>encodeMidi(asatoyaNotes(),{bpm:85,name:'Asatoya Yunta - intro and one verse - elementary melody study'});
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-practice-asatoya.mjs')){
 const midi=asatoyaMidi();writeFileSync('practice/songs/asatoya.mid',midi);
 const p='practice/songs/asatoya-provenance.json',meta=JSON.parse(readFileSync(p,'utf8'));meta.sha256=createHash('sha256').update(midi).digest('hex');meta.notes=asatoyaNotes().length;meta.beats=asatoyaNotes().at(-1).beat+2;writeFileSync(p,JSON.stringify(meta,null,2)+'\n');
 const path='practice/songs/provenance.json',catalog=JSON.parse(readFileSync(path,'utf8'));catalog.songs=catalog.songs.filter(s=>s.id!=='asatoya');catalog.songs.push({...meta,id:'asatoya',file:'asatoya.mid'});writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');console.log('Asatoya:',meta.notes,'notes /',meta.beats,'beats');
}
