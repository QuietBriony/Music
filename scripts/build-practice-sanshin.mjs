// Adapted note data CC BY-SA 4.0, Lrschneider / Music Stack.
// Source, changes, attribution: practice/songs/sanshin-provenance.json.
import { writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeMidi } from './build-practice-songs.mjs';
import { sanshinPosition } from '../practice/sanshin-core.mjs';
export const TINSAGU_COLUMNS = [
  '中中工上四合四五中中工上',
  '四合四五中中工上四合四五',
  '中中七九八○七八中中工上',
  '四合四五中中工上四合四五',
  '中中工上四合四五中中工上',
  '四合四五'
];
export const tinsaguMidi = () => encodeMidi([...TINSAGU_COLUMNS.join('')].flatMap((symbol,beat)=>symbol==='○'?[]:[{midi:sanshinPosition(symbol).midi,beat,beats:1}]),{bpm:85,name:'Tinsagu nu Hana - first verse, simplified - CC BY-SA 4.0'});
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-practice-sanshin.mjs')){
  const data=tinsaguMidi();writeFileSync('practice/songs/tinsagu.mid',data);
  const path='practice/songs/sanshin-provenance.json',meta=JSON.parse(readFileSync(path,'utf8'));
  meta.tinsagu.sha256=createHash('sha256').update(data).digest('hex');writeFileSync(path,JSON.stringify(meta,null,2)+'\n');
  const catalogPath='practice/songs/provenance.json',catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
  const entry=catalog.songs.find(s=>s.id==='tinsagu');if(entry){Object.assign(entry,meta.tinsagu);writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');}
  console.log('Tinsagu: 63 notes, 64 beats; adaptation and MIDI CC BY-SA 4.0.');
}
