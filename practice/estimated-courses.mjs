import { estimatedCourse } from './harmony-timeline.mjs?v=27';
import { songSteps } from './singalong-core.mjs?v=27';

// Harmonic labels and numerical beat positions only. See songs/auto-follow-provenance.json.
const specs=[
 {
  "id": "under-the-bridge",
  "video": "GLvohMXgcBo",
  "bpm": 85.8,
  "duration": 268,
  "source": "https://chordu.com/chords-tabs-red-hot-chili-peppers-under-the-bridge-id_GLvohMXgcBo",
  "events": "2:D 7:F# 11:Bm 12:D 16:E 17:F# 21:Bm 22:D 27:F# 31:Bm 32:D 36:E 37:F# 42:E 44:B 47:C#m 48:G#m 49:A 51:E 52:B 55:C#m 56:A 59:Em 61:B 63:C#m 65:G#m 66:A 67:E 69:B 71:C#m 73:A 75:E 86:B 89:C#m 90:G#m 91:A 93:E 94:B 97:C#m 98:A 101:E 103:B 106:C#m 107:E 108:A 109:E 111:B 114:C#m 115:A 117:E 126:F#m 127:E 130:B 131:F#m 135:E 138:B 139:F#m 143:E 146:B 147:F#m 150:F# 151:E 154:B 155:F#m 158:E 159:D 160:B 163:C#m 164:G#m 165:A 166:E 168:B 171:C#m 172:A 175:E 176:B 179:E 181:A 183:E 184:B 187:A 191:E 192:B 195:C#m 196:G#m 197:A 199:E 201:B 203:C#m 205:A 207:E 216:D 217:E 219:B 221:F#m 225:E 227:B 229:F#m 233:E 235:B 237:F#m 241:E 243:B 245:F#m 247:A 249:C 251:G 253:F 255:A 257:Am 259:G 261:F 262:Am 263:A 265:C 267:G 269:F 275:E 277:G 279:A 280:Am 283:G 284:F 287:A 288:Am 291:G 292:F 294:A 296:Am 299:G 300:F 302:A 304:Am 306:G 308:Am 310:A 312:Am 314:G 315:F 318:A 319:Am 322:G 323:F 325:A 327:Am 330:G 331:F 333:A 335:Am 337:G 339:Am 341:A 343:Am 349:A 350:Am 357:A 359:Am 361:Em 363:F 365:A 367:Am 369:Em 371:Am 374:A 382:N"
 },
 {
  "id": "blackbird",
  "video": "y_70M2GC3jw",
  "bpm": 149.45,
  "duration": 391.701,
  "source": "https://chordu.com/chords-tabs-the-beatles-blackbird-chase-eagleson-cover--id_y_70M2GC3jw",
  "events": "16:A 32:B 34:A 48:B 49:A 58:D 66:A 74:D 76:Bm 77:A 83:B 85:F#m 94:A 98:B 102:G# 103:A 111:D 116:B 118:A 124:F#m 128:Bm 130:A 168:D 170:B 172:E 175:B 176:F# 181:F 184:A 187:B 189:D 193:Dm 198:A 202:B 206:Bm 209:A 214:D 216:F#m 219:B 223:Bm 225:A 233:Bm 235:F#m 237:A 245:D 246:B 249:E 253:F#m 258:F 260:A 266:D 270:Dm 274:A 283:G 287:A 291:D 292:F#m 295:B 299:Bm 303:A 310:Em 311:A 322:D 324:D# 326:E 330:F#m 334:Dm 337:A 343:D 347:Dm 351:A 356:B 360:Em 363:A 368:Em 370:Bm 371:A 374:D 376:Am 380:D 384:Em 386:F#m 390:Bm 392:C 396:B 398:Em 400:Bm 406:A 427:B 431:A 438:D 444:F#m 446:A 452:D 454:F#m 457:A 461:E 463:A 470:C# 472:A 482:D 485:A 486:E 491:F#m 495:F 498:A 501:D# 502:D 511:A 515:B 518:A 519:Bm 522:A 528:D 530:A 532:B 536:Bm 539:A 546:Bm 548:A 558:D 560:F#m 571:F 572:A 579:D 586:A 591:B 595:Bm 599:A 603:D 606:A 608:B 612:Bm 614:A 622:Bm 623:A 634:D 635:A 637:E 641:F#m 646:F 650:C#m 651:A 654:D 658:Dm 662:A 666:B 670:Em 674:A 678:Em 680:D 682:A 684:Bm 686:C 690:D 694:Em 696:Bm 698:A 700:Bm 703:C 706:B 710:Em 714:A 732:F#m 740:C# 741:Bm 742:F#m 746:F 749:A 751:D# 754:D 758:Dm 761:A 766:B 770:Bm 773:A 778:D 780:F#m 782:B 786:Bm 790:A 797:B 799:A 806:F#m 812:B 816:C#m 821:F#m 825:D 831:A 838:D 841:B 843:A 849:B 851:A 857:F#m 863:B 866:E 868:A 875:D 881:G# 882:A 889:D 891:F#m 893:C# 895:A"
 },
 {
  "id": "imagine",
  "video": "hJOs03sMna4",
  "bpm": 150,
  "duration": 196.441,
  "source": "https://chordu.com/chords-tabs-raef-imagine-john-lennon-cover--id_hJOs03sMna4",
  "events": "1:N 6:D 15:Bm 23:D 31:G 34:Bm 39:D 47:G 54:D 62:G 70:D 78:G 86:D 94:G 100:Bm 104:G 106:Bm 110:Em 118:A 133:D 141:G 149:D 157:G 165:D 173:G 181:D 189:G 201:Bm 205:Em 212:A 228:G 232:A 236:D 240:F# 244:G 248:A 252:D 257:F# 260:G 264:A 268:D 272:F# 276:G 280:A 283:D 293:Bm 298:D 307:G 315:D 323:G 331:D 339:G 347:D 355:G 362:D 370:G 382:Bm 386:Em 394:A 410:G 414:A 418:D 422:F# 426:G 429:A 434:D 437:F# 441:G 445:A 449:D 453:F# 457:G 461:A"
 },
 {
  "id": "woman",
  "video": "K9yBG6oyPP4",
  "bpm": 81.3,
  "duration": 197.061,
  "source": "https://chordu.com/chords-tabs-john-lennon-women-with-lyrics-1980-high-quality-cover-version--id_K9yBG6oyPP4",
  "events": "1:Eb 13:Ab 14:Eb 19:Fm 21:Gm 23:Fm 25:Eb 27:Cm 29:Fm 31:Eb 32:Bb 33:Ab 35:Fm 37:Gm 39:Eb 40:Bb 41:Eb 43:Fm 45:Gm 47:Fm 49:Eb 51:Cm 53:Ab 55:Eb 56:Bb 57:Ab 59:Fm 61:Gm 63:Ab 67:Bb 71:Gm 75:Cm 79:Fm 83:Gm 91:Cm 95:Fm 99:Gm 101:Bb 103:Eb 105:Fm 107:Gm 109:Ab 111:Eb 113:Cm 115:Ab 117:Bb 119:Ab 121:Fm 123:Bb 127:Eb 129:Fm 131:Gm 133:Fm 135:Eb 137:Cm 139:Fm 141:Bb 143:Ab 145:Fm 147:Gm 150:Ab 153:Bb 158:Eb 161:Cm 165:Fm 169:Bb 173:Gm 175:Eb 177:Cm 181:Fm 185:Gm 189:E 191:Gbm 193:Abm 195:Gbm 197:E 199:Dbm 201:Gbm 203:B 205:A 207:Gbm 209:Abm 211:A 215:B 219:E 223:Dbm 227:Gbm 231:B 233:Db 234:B 235:E 239:Dbm 243:Gbm 247:B 250:E 255:Dbm 259:Gbm 263:B 267:N"
 },
 {
  "id": "your-song",
  "video": "GlPlfCy1urI",
  "bpm": 128.95,
  "duration": 229,
  "source": "https://chordu.com/chords-tabs-elton-john-your-song-id_GlPlfCy1urI",
  "events": "2:Eb 6:Ab 10:Bb 18:Cm 23:Gm 26:A 29:Ab 34:Eb 38:Bb 42:G 46:Cm 50:Eb 54:Fm 58:Ab 62:Bb 70:Eb 74:Ab 78:Bb 82:Gm 86:Cm 90:Eb 94:Cm 100:Ab 102:Eb 106:Bb 110:G 114:Cm 118:Eb 122:Fm 126:Ab 130:Eb 134:Ab 135:Eb 138:Bb 142:Cm 146:Fm 150:Ab 154:Bb 158:Cm 162:Fm 165:Ab 170:Cm 178:A 182:Ab 190:Eb 194:Fm 202:Bb 210:Eb 214:Ab 218:F 220:Bb 222:Ab 226:Eb 230:Cm 234:Bb 242:Cm 256:Ab 258:Eb 262:Bb 266:G 270:Cm 274:Eb 278:Fm 282:Ab 286:Bb 294:Eb 298:Ab 302:Bb 307:Gm 311:Cm 323:Ab 327:Eb 331:Bb 335:G 339:Cm 343:Eb 348:Fm 352:Ab 356:Eb 360:Ab 361:Eb 364:Bb 368:Cm 372:Fm 376:Ab 381:Bb 385:Cm 389:Fm 392:Bb 393:Ab 397:Cm 409:Ab 417:Eb 421:Ab 430:Bb 438:Cm 450:Ab 454:Fm 458:Eb 462:Ab 470:Eb 474:Ab 479:Bb 482:Ab 486:Eb 490:N"
 },
 {
  "id": "could-you-be-loved",
  "video": "pYFOPu-WowQ",
  "bpm": 105,
  "duration": 208.421,
  "source": "https://chordu.com/chords-tabs-wretch-32-covers-bob-marley-s-could-you-be-loved-id_pYFOPu-WowQ",
  "events": "5:E 7:B 17:Bm 19:C# 21:Bm 25:D 29:B 32:G 35:G 37:D 44:Bm 49:G 52:D 58:Bm 65:Em 74:Bm 81:E 89:Bm 97:G 99:F# 101:E 106:B 109:Bm 113:G 115:F# 117:A 121:D 125:Bm 129:G 133:D 141:Bm 145:G 148:Bm 165:F# 168:A 170:Bm 176:A 178:Bm 209:E 217:Bm 225:E 233:Bm 241:G 244:E 249:Bm 257:G 259:F# 261:A 268:B 270:E 273:Bm 275:C# 277:G 281:D 289:Bm 293:G 295:G 298:Bm 307:F#m 310:Bm 339:F#m 341:Bm 355:F#m 357:Bm 365:N"
 },
 {
  "id": "sleep-last-night",
  "video": "1yH5gbXI7DQ",
  "bpm": 150,
  "duration": 255.081,
  "source": "https://chordu.com/chords-tabs-in-the-pines-where-did-you-sleep-last-night-leadbelly-cover-id_1yH5gbXI7DQ",
  "events": "1:N 4:E 9:B 25:E 30:G 33:A 39:E 54:B 61:Bm 66:C 71:E 77:Dbm 86:E 92:Bm 95:A 100:E 109:Em 116:E 127:B 134:A 137:B 142:G 147:E 153:C 155:E 164:A 173:Bb 178:G 181:E 197:Bb 201:A 204:C 208:Bb 213:G 218:Eb 220:N 223:A 230:G 233:B 236:Eb 239:G 242:A 245:Em 251:G 254:A 262:E 274:B 280:C 292:A 297:N 303:E 305:Db 308:B 313:A 320:B 325:G 329:E 353:B 357:Gb 360:G 363:E 369:A 374:Em 380:B 384:C 389:B 394:G 397:E 402:Eb 405:A 411:B 416:D 421:C 424:E 431:C 438:Em 445:E 452:A 456:Gm 459:Bm 463:G 466:E 469:N 474:A 480:Bb 487:G 490:Bb 498:Em 503:Db 506:E 511:Bb 517:G 523:B 525:Bb 529:G 531:E 534:Eb 539:E 546:Bbm 551:G 555:B 560:G 564:E 571:A 578:Bm 585:G 589:B 592:A 597:E 616:Bm 623:A"
 },
 {
  "id": "santeria",
  "video": "AEYN5w4T_aM",
  "bpm": 90.65,
  "duration": 196,
  "source": "https://chordu.com/chords-tabs-sublime-santeria-id_AEYN5w4T_aM",
  "events": "2:D 5:N 17:E 22:G# 26:C# 29:C#m 32:B 37:E 41:G# 45:C#m 49:Bm 53:G# 63:C# 65:B 69:A 71:B 73:E 74:D# 75:C#m 77:A 79:B 81:E 82:D#m 83:C#m 85:A 87:B 89:E 90:D# 91:C#m 93:A 95:Bm 97:E 101:G# 104:B 105:C#m 109:Bm 113:E 117:G#m 121:C#m 125:B 127:Bm 129:A 131:B 133:E 134:D# 135:C#m 137:A 139:B 141:E 142:B 143:C#m 145:A 147:B 149:E 150:D# 151:C#m 153:A 155:Bm 157:E 159:F#m 161:G#m 165:C#m 177:G# 181:F# 182:C#m 185:B 189:A 191:B 193:E 194:D# 195:C#m 197:A 199:Bm 201:E 202:D# 203:C#m 205:A 207:B 209:E 210:D#m 211:C#m 213:A 215:B 217:E 221:G# 225:C#m 227:C# 229:Bm 232:E 237:G# 241:C#m 245:B 248:A 251:B 253:E 254:D#m 256:C#m 257:A 259:B 261:E 262:D# 263:C#m 265:A 267:B 269:E 270:D# 271:C#m 273:A 275:B 277:E 278:D# 279:C# 280:B 281:A 283:B 284:E 295:N"
 }
];
export const ESTIMATED_COURSES=Object.fromEntries(specs.map(s=>[s.id,estimatedCourse(s)]));

const opening={names:['C','Caug','Am'],bars:[2,2,4]};
const rows={names:['Dm7','G7','E7','Am7','Dm7','G7','E7','Am7'],bars:[1,1,1,1,1,1,1,2]};
const phrase=(names,count)=>({names:Array.from({length:count},()=>names).flat(),bars:Array.from({length:count},()=>[1,1,2]).flat()});
const combine=(...parts)=>({names:parts.flatMap(p=>p.names),bars:parts.flatMap(p=>p.bars)});
const yesSections=[
 {title:'前奏',start:2,end:18,names:['Dm7','G7','C','C','Dm7','G7','C','C'],bars:[1,1,1,1,1,1,1,1]},
 {title:'1番・前半',start:18,end:34,...opening},
 {title:'1番・後半',start:34,end:60,...rows},
 {title:'サビ',start:60,end:96,...combine(phrase(['Fm','G7','C'],3),phrase(['Dm7','G7','C'],2))},
 {title:'2番・前半',start:96,end:112,...opening},
 {title:'2番・後半',start:112,end:140,...rows},
 {title:'サビ・反復',start:140,end:186,...combine(phrase(['Fm','G7','C'],3),phrase(['Dm7','G7','C'],4))},
 {title:'後奏',start:186,end:256,...combine(opening,rows,phrase(['Fm','G7','C'],2))}
];
const yesTimes=yesSections.flatMap(s=>{let beat=0;const total=s.bars.reduce((a,b)=>a+b,0);return s.bars.map(b=>{const time=s.start+(s.end-s.start)*beat/total;beat+=b;return time;});});
ESTIMATED_COURSES['yes-my-love']={key:'yes-my-love-kr1n2Pzn4eA-section-v1',video:'kr1n2Pzn4eA',url:'https://www.youtube.com/watch?v=kr1n2Pzn4eA',capo:5,estimated:true,precision:'section',source:'https://www.youtube.com/watch?v=kr1n2Pzn4eA',steps:songSteps(yesSections),times:yesTimes,end:258.5,note:'山田まさひろの歌詞・コード付き通し動画。カポ5。演奏区間を補間した目安の自動送りで、細かな切替にはずれがあります。Dm7-5はD音を省いたFmの3本の形に簡略化しています。合わないコード・位置は下の補正で直せます。歌詞は動画内に表示します。'};

// These three publisher videos refused embedding (YouTube 150) during release QA.
// A separate-device clock remains available, with explicit manual synchronization.
for(const id of ['under-the-bridge','your-song','santeria']){
 const c=ESTIMATED_COURSES[id];c.embedBlocked=true;c.note+=' この配信動画はアプリ内再生が制限されています。YouTubeを別画面で開き、コードの時間送りを手動で同時に始めてください。動画との自動同期はできません。';
}
for(const id of ['blackbird','imagine','woman','could-you-be-loved','sleep-last-night'])ESTIMATED_COURSES[id].note+=' 配信可能なカバー演奏に合わせたガイドです。Apple Musicの原曲とは演奏・長さ・キーが異なる場合があります。';
