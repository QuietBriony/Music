import { estimatedCourse } from './harmony-timeline.mjs?v=28';
import { songSteps } from './singalong-core.mjs?v=28';

// Harmonic labels and numerical beat positions only. See songs/auto-follow-provenance.json.
const specs=[
 {
  "id": "under-the-bridge",
  "video": "GLvohMXgcBo",
  "bpm": 85.8,
  "duration": 267.161,
  "source": "https://chordu.com/chords-tabs-red-hot-chili-peppers-under-the-bridge-id_GLvohMXgcBo",
  "events": "2:D 7:F# 11:Bm 12:D 16:E 17:F# 21:Bm 22:D 27:F# 31:Bm 32:D 36:E 37:F# 42:E 44:B 47:C#m 48:G#m 49:A 51:E 52:B 55:C#m 56:A 59:Em 61:B 63:C#m 65:G#m 66:A 67:E 69:B 71:C#m 73:A 75:E 86:B 89:C#m 90:G#m 91:A 93:E 94:B 97:C#m 98:A 101:E 103:B 106:C#m 107:E 108:A 109:E 111:B 114:C#m 115:A 117:E 126:F#m 127:E 130:B 131:F#m 135:E 138:B 139:F#m 143:E 146:B 147:F#m 150:F# 151:E 154:B 155:F#m 158:E 159:D 160:B 163:C#m 164:G#m 165:A 166:E 168:B 171:C#m 172:A 175:E 176:B 179:E 181:A 183:E 184:B 187:A 191:E 192:B 195:C#m 196:G#m 197:A 199:E 201:B 203:C#m 205:A 207:E 216:D 217:E 219:B 221:F#m 225:E 227:B 229:F#m 233:E 235:B 237:F#m 241:E 243:B 245:F#m 247:A 249:C 251:G 253:F 255:A 257:Am 259:G 261:F 262:Am 263:A 265:C 267:G 269:F 275:E 277:G 279:A 280:Am 283:G 284:F 287:A 288:Am 291:G 292:F 294:A 296:Am 299:G 300:F 302:A 304:Am 306:G 308:Am 310:A 312:Am 314:G 315:F 318:A 319:Am 322:G 323:F 325:A 327:Am 330:G 331:F 333:A 335:Am 337:G 339:Am 341:A 343:Am 349:A 350:Am 357:A 359:Am 361:Em 363:F 365:A 367:Am 369:Em 371:Am 374:A 382:N"
 },
 {
  "id": "blackbird",
  "video": "Man4Xw8Xypo",
  "bpm": 94.25,
  "duration": 138.401,
  "source": "https://chordu.com/chords-tabs-the-beatles-blackbird-id_Man4Xw8Xypo",
  "events": "1:G 2:Am 3:G 15:C 16:C# 17:G 18:D# 19:Em 21:G 24:C# 25:C 27:Cm 29:G 31:A 33:G 37:C 38:G 39:A 41:G 52:C 53:C# 54:G 56:Em 58:G 61:C# 62:C 64:Cm 66:G 68:A 70:G 75:Em 76:Dm 77:C 78:A# 80:C 82:Em 84:G 85:C 86:A# 88:A 90:G 93:Am 94:G 99:C 100:C# 101:G 102:B 103:Em 105:D# 107:G 108:C# 109:C 111:Cm 113:G 115:A 117:G 122:Em 123:G 124:C 125:A# 127:C 129:G 132:C 133:Gm 135:A 137:G 140:Am 141:G 161:Am 162:G 163:C 164:G 165:A 167:G 169:Am 170:G 175:C 177:G 179:Em 181:D# 184:G 185:C 187:Cm 189:G 191:A 193:G 197:C 198:G 199:A 201:G 205:C 206:G 207:A 209:G 217:N"
 },
 {
  "id": "imagine",
  "video": "YkgkThdzX-8",
  "bpm": 75.8,
  "duration": 233.921,
  "source": "https://chordu.com/chords-tabs-john-lennon-imagine-id_YkgkThdzX-8",
  "events": "53:C 57:F 61:C 65:F 69:C 73:F 77:C 81:F 85:C 93:C 97:F 103:Am 105:Dm 109:G 117:C 121:F 125:C 129:F 133:C 137:F 141:C 145:F 151:Am 153:Dm 155:F 157:G 165:F 167:G 169:C 171:E 173:F 175:G 177:C 179:E 181:F 183:G 185:C 187:E 189:F 191:G 193:C 201:F 205:C 209:F 213:C 217:F 221:C 225:F 231:Am 233:Dm 235:F 237:G 245:F 247:G 249:C 251:E 253:F 255:G 257:C 259:E 261:F 263:G 265:C 267:E 269:F 271:G 273:C 281:F# 295:N"
 },
 {
  "id": "woman",
  "video": "ZhfWiU8wGCc",
  "bpm": 79.5,
  "duration": 214.101,
  "source": "https://chordu.com/chords-tabs-john-lennon-woman-id_ZhfWiU8wGCc",
  "events": "3:Eb 5:Ab 7:Eb 13:Ab 15:Eb 19:Fm 21:Gm 23:Fm 25:Eb 27:Cm 29:Fm 31:Bb 33:Ab 35:Fm 37:Gm 39:Bb 41:Eb 43:Fm 45:Gm 47:Fm 49:Eb 51:Cm 53:Fm 55:Bb 57:Ab 59:Fm 61:Gm 63:F 67:Bb 71:Eb 75:Cm 79:Fm 83:Bb 87:Eb 91:Cm 95:Fm 99:Bb 103:Eb 105:Fm 107:Gm 109:Fm 111:Eb 113:Cm 115:Fm 117:Bb 119:Ab 121:Fm 123:Gm 125:Bb 127:Eb 129:Fm 131:Gm 133:Fm 135:Eb 137:Cm 139:Fm 141:Bb 143:Ab 145:Fm 147:Gm 149:F 153:Bb 157:Eb 161:Cm 165:Fm 169:Bb 173:Eb 177:Gm 181:Fm 185:Bb 189:E 191:Gbm 197:E 199:Dbm 201:Gbm 203:B 205:A 207:Gbm 209:Abm 211:Gb 215:B 219:E 223:Dbm 227:Gbm 231:B 235:E 239:Dbm 243:Gbm 247:B 251:E 255:Dbm 259:Gbm 263:B 267:E 270:Dbm 274:Gbm 283:N"
 },
 {
  "id": "your-song",
  "video": "GlPlfCy1urI",
  "bpm": 128.95,
  "duration": 228.341,
  "source": "https://chordu.com/chords-tabs-elton-john-your-song-id_GlPlfCy1urI",
  "events": "2:Eb 6:Ab 10:Bb 18:Cm 23:Gm 26:A 29:Ab 34:Eb 38:Bb 42:G 46:Cm 50:Eb 54:Fm 58:Ab 62:Bb 70:Eb 74:Ab 78:Bb 82:Gm 86:Cm 90:Eb 94:Cm 100:Ab 102:Eb 106:Bb 110:G 114:Cm 118:Eb 122:Fm 126:Ab 130:Eb 134:Ab 135:Eb 138:Bb 142:Cm 146:Fm 150:Ab 154:Bb 158:Cm 162:Fm 165:Ab 170:Cm 178:A 182:Ab 190:Eb 194:Fm 202:Bb 210:Eb 214:Ab 218:F 220:Bb 222:Ab 226:Eb 230:Cm 234:Bb 242:Cm 256:Ab 258:Eb 262:Bb 266:G 270:Cm 274:Eb 278:Fm 282:Ab 286:Bb 294:Eb 298:Ab 302:Bb 307:Gm 311:Cm 323:Ab 327:Eb 331:Bb 335:G 339:Cm 343:Eb 348:Fm 352:Ab 356:Eb 360:Ab 361:Eb 364:Bb 368:Cm 372:Fm 376:Ab 381:Bb 385:Cm 389:Fm 392:Bb 393:Ab 397:Cm 409:Ab 417:Eb 421:Ab 430:Bb 438:Cm 450:Ab 454:Fm 458:Eb 462:Ab 470:Eb 474:Ab 479:Bb 482:Ab 486:Eb 490:N"
 },
 {
  "id": "could-you-be-loved",
  "video": "1ti2YCFgCoI",
  "bpm": 103.1,
  "duration": 240.941,
  "source": "https://chordu.com/chords-tabs-bob-marley-could-you-be-loved-id_1ti2YCFgCoI",
  "events": "1:B 9:C# 11:E 23:Bm 32:D 35:Bm 39:G 43:D 51:Bm 55:G 59:D 62:Bm 71:Em 79:Bm 87:Em 94:Bm 103:G 105:F#m 107:Em 111:Bm 119:G 121:F#m 123:A 127:D 131:Bm 135:G 139:D 147:Bm 151:G 155:D 159:Bm 215:Em 222:Bm 231:Em 239:Bm 247:G 249:F#m 251:Em 255:Bm 263:G 265:F#m 267:A 275:D 279:Bm 283:G 287:D 295:Bm 299:G 303:D 307:Bm 414:N"
 },
 {
  "id": "sleep-last-night",
  "video": "hEMm7gxBYSc",
  "bpm": 107.9,
  "duration": 411.401,
  "source": "https://chordu.com/chords-tabs-nirvana-where-did-you-sleep-last-night-id_hEMm7gxBYSc",
  "events": "1:Ebm 5:Ab 16:Eb 48:Gb 50:Bb 68:N 73:B 85:Gb 89:Eb 95:Abm 96:Ebm 102:Ab 104:Gb 107:Bb 111:Eb 124:Gb 127:Bb 132:Eb 143:Ab 146:Gb 149:Bb 154:Eb 163:Ebm 166:Abm 169:Gb 172:Bb 178:Eb 190:Ab 193:Gb 196:Bb 202:Eb 214:Ab 217:Gb 220:Bb 226:Eb 235:Bb 238:Ab 241:Gb 244:Bb 250:Eb 262:Ab 265:Gb 268:Bb 274:Eb 286:Ab 289:Gb 292:Bb 298:Eb 310:Ab 313:Gb 316:Bb 322:Eb 334:Ab 337:Gb 340:Bb 346:Eb 358:Ab 361:Gb 364:Bb 370:Eb 382:Ab 385:Gb 388:Fm 389:Bb 394:Eb 407:Ab 409:Gb 412:Bb 418:Eb 430:Ab 433:Gb 436:Bb 442:Eb 454:Ab 457:Gb 460:Bb 466:Eb 478:Ab 481:Gb 484:Bb 490:Eb 502:Ab 505:Gb 508:Bb 514:Eb 521:Bb 527:Eb 544:Ab 547:Gb 550:Bb 555:Gb 556:Eb 568:Ab 571:Gb 574:Bb 578:Cm 579:Dm 580:Eb 596:N 613:Bb 622:N"
 },
 {
  "id": "santeria",
  "video": "AEYN5w4T_aM",
  "bpm": 90.65,
  "duration": 195.561,
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
ESTIMATED_COURSES['yes-my-love']={key:'yes-my-love-kr1n2Pzn4eA-section-v1',video:'kr1n2Pzn4eA',url:'https://www.youtube.com/watch?v=kr1n2Pzn4eA',capo:5,estimated:true,precision:'section',source:'https://www.youtube.com/watch?v=kr1n2Pzn4eA',steps:songSteps(yesSections),times:yesTimes,end:258.181,note:'山田まさひろの歌詞・コード付き通し動画。カポ5。演奏区間を補間した目安の自動送りで、細かな切替にはずれがあります。Dm7-5はD音を省いたFmの3本の形に簡略化しています。合わないコード・位置は下の補正で直せます。歌詞は動画内に表示します。'};
