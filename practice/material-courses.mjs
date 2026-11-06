import { estimatedCourse } from './harmony-timeline.mjs?v=33';

// Public harmonic labels and beat positions; publisher lyrics stay in the player.
// See songs/material-provenance.json for inspected pages and corrections.
const specs=[
 {
  "id": "imagine",
  "video": "oFWhUvOFQxc",
  "source": "https://chordu.com/chords-tabs-imagine-id_oFWhUvOFQxc",
  "bpm": 139.6,
  "duration": 212.0,
  "events": "1:C 15:F 23:C 33:F 41:C 50:F 59:C 68:F 76:C 85:F 94:C 102:F 118:D 121:Dm 126:G 144:C 152:F 159:C 168:F 176:C 184:F 192:C 200:F 216:Dm 220:F 224:G 240:F 244:G 249:C 252:E 256:Em 257:F 260:G 265:C 268:E 273:F 276:G 281:C 285:E 289:F 293:G 297:C 302:Am 304:Em 305:C 314:F 321:C 330:F 337:C 346:F 353:C 361:F 377:Dm 385:G 401:F 404:G 409:C 412:Em 413:E 417:F 420:G 425:C 429:E 433:F 436:G 441:C 444:G 445:E 449:F 452:G 457:C 472:F 473:C 475:Bm 477:A 481:C 489:F 491:N"
 },
 {
  "id": "woman",
  "video": "2WnFu1hij7c",
  "source": "https://chordu.com/chords-tabs-woman-id_2WnFu1hij7c",
  "bpm": 160.15,
  "duration": 235.0,
  "events": "1:N 16:A 18:B 20:Ab 30:Eb 35:Ab 38:Eb 63:Fm 67:Gm 71:Fm 75:Eb 79:Cm 83:Fm 87:Bb 91:Ab 99:Gm 103:Bb 107:Eb 111:Fm 115:Gm 119:Fm 123:Eb 127:Cm 131:Fm 135:Bb 139:Ab 144:Fm 147:Gm 151:Bb 155:Fm 159:Bb 169:Gm 171:Bb 175:Cm 183:Fm 191:Bb 201:Eb 207:Cm 215:Fm 223:Bb 231:Eb 235:Fm 239:Gm 243:Fm 247:Eb 251:Cm 255:Fm 259:Bb 263:Ab 271:Gm 275:Bb 279:Eb 283:Fm 287:Gm 291:Fm 295:Eb 299:Cm 303:Fm 308:Bb 311:Ab 319:Gm 323:Bb 339:Eb 342:Bb 347:Cm 355:Fm 363:Bb 371:Eb 373:Gm 377:Bb 379:Cm 387:Fm 395:Bb 403:E 407:Gbm 411:Abm 415:Gbm 419:E 423:Dbm 429:Gbm 431:B 435:A 441:Gbm 443:Abm 447:B 465:Abm 471:Dbm 479:Gbm 487:B 497:Abm 503:Dbm 510:Gbm 519:B 529:Abm 535:Dbm 543:Gbm 551:B 561:Abm 563:B 567:Dbm 575:Gbm 584:B 587:Ab 591:Eb 605:Ab"
 }
];
export const MATERIAL_COURSES=Object.fromEntries(specs.map(spec=>{
 const course=estimatedCourse(spec);
 course.key=`${spec.id}-${spec.video}-material-v1`;course.material=true;course.lyricsInVideo=true;course.easyCapo=spec.id==='woman'?3:0;course.precision='beat-estimate';course.source=course.url;
 course.note=spec.id==='woman'?'MusikManの歌詞・コード図付き演奏。動画はカポ1、かんたんな形はカポ3。動画と同じ音の高さで、7thや飾りを省いた伴奏です。後半に半音上がります。':'MunsonCoversの歌詞・コード付き演奏。標準調弦・カポなし。低音の動きを省いた簡略伴奏です。';
 course.note+=' 切替位置は拍の推定を基にした目安です。歌詞は動画内で進みます。';
 return [spec.id,course];
}));
// Corrections are tied to this recording and stable source beat positions.
const fixes={imagine:{118:'Dm',220:'Dm',256:'E',302:'C',304:'C',412:'E',444:'E',472:'C',475:'N',477:'N',481:'N',489:'N'},woman:{16:'N',18:'N',20:'N',169:'Eb',171:'Eb',342:'Eb',373:'Eb',377:'Eb',465:'E',497:'E',529:'E',561:'E',563:'E',587:'N',591:'N',605:'N'}};
for(const spec of specs){const course=MATERIAL_COURSES[spec.id],beats=spec.events.split(/\s+/).map(e=>Number(e.split(':')[0]));for(const [beat,name] of Object.entries(fixes[spec.id])){const i=beats.indexOf(Number(beat));if(i>=0)course.steps[i]={...course.steps[i],name,silent:name==='N'};}
 const sections=spec.id==='imagine'?[[0,'前奏'],[16,'1番'],[61,'2番'],[102,'サビ'],[131,'3番'],[172,'サビ・最後'],[204,'演奏おわり']]:[[0,'準備'],[11,'前奏'],[22,'1番'],[64,'サビ'],[86,'2番'],[126,'サビ'],[150,'3番・転調'],[174,'終わりの繰り返し'],[219,'演奏おわり']];
 course.steps=course.steps.map((step,i)=>{let section=0;while(section+1<sections.length&&sections[section+1][0]<=course.times[i])section++;return {...step,section,title:sections[section][1]};});
}

MATERIAL_COURSES.imagine.times[0]=3;

// These publisher charts can be followed in the player. No unrelated native
// timeline is attached until a map for that exact performance is available.
const charts=[
 ['blackbird','2EPFtnTex9g',138.681,'MunsonMusic'],
 ['under-the-bridge','vPnURDDWMW0',246.741,'MunsonMusic'],
 ['sleep-last-night','YC8HVwq0Tks',273.161,'MunsonCovers'],
 ['your-song','8KBAuOBoemw',576.381,'MunsonCovers'],
 ['santeria','5wlQ-AYhb2M',0,'MunsonMusic'],
 ['could-you-be-loved','tXssLSMy3mk',209,'Chords For You']
];
for(const [id,video,end,credit] of charts)MATERIAL_COURSES[id]={key:`${id}-${video}-chart-v1`,video,url:`https://www.youtube.com/watch?v=${video}`,source:`https://www.youtube.com/watch?v=${video}`,end,capo:0,steps:[],times:[],material:true,lyricsInVideo:true,noNative:true,note:`${credit}の歌詞・コード付き教材。歌詞とコードは動画内の表示で追います。この教材にアプリのコード図を同期する時刻は準備中です。押さえ方はコード名を選んで確認できます。`};
export function materialChoice(id,saved,requested){
 if(!MATERIAL_COURSES[id])return 'original';
 if(requested==='material'||requested==='original')return requested;
 // Existing sessions keep their recording, edits and timing until explicitly changed.
 return saved?.material===true?'material':saved||MATERIAL_COURSES[id].noNative?'original':'material';
}
export const materialLyricKey=(id,course)=>`video:guitar:${id}${course?.material?`:video:${course.video}`:''}`;
