import { CHORDS,GUITAR_OPEN } from './chords.mjs?v=9';
export const FINGER_NAMES=['','人差し指','中指','薬指','小指'];
export const SMALL_GRIPS={
 F:{frets:[-1,-1,3,2,1,-1],fingers:[0,0,3,2,1,0]},
 Fm:{frets:[-1,-1,3,1,1,-1],fingers:[0,0,3,1,2,0]},
 B:{frets:[-1,-1,-1,4,4,2],fingers:[0,0,0,3,4,1]},
 Bm:{frets:[-1,-1,-1,4,3,2],fingers:[0,0,0,3,2,1]},
 Cm:{frets:[-1,-1,-1,5,4,3],fingers:[0,0,0,3,2,1]},
 Gm:{frets:[-1,-1,-1,3,3,3],fingers:[0,0,0,1,2,3]},
 'G#':{frets:[-1,-1,-1,5,4,4],fingers:[0,0,0,3,1,2]},
 'C#m':{frets:[-1,-1,-1,6,5,4],fingers:[0,0,0,3,2,1]}
};
const equal=(a,b)=>a.frets.every((f,i)=>f===b.frets[i]&&a.fingers[i]===b.fingers[i]);
export function gripChoices(name,current){
 if(!current||!Array.isArray(current.frets))return[];
 const choices=[{id:'current',title:'練習中の形',shape:current}];
 if(SMALL_GRIPS[name]&&!equal(current,SMALL_GRIPS[name]))choices.push({id:'small',title:'3本だけで弾く形',shape:SMALL_GRIPS[name]});
 if(CHORDS[name]&&!choices.some(c=>equal(c.shape,CHORDS[name])))choices.push({id:'standard',title:'標準の形・セーハ',shape:CHORDS[name]});
 return choices;
}
export function fingerSteps(shape){
 const order=shape.barre?[2,3,4,1]:[1,2,3,4];
 return order.flatMap(finger=>{
  const positions=shape.frets.flatMap((fret,i)=>fret>0&&shape.fingers[i]===finger?[{string:6-i,fret}]:[]);
  if(!positions.length)return[];
  const barre=finger===1?shape.barre:null;
  return[{finger,positions,barre:barre||null,text:barre?`${FINGER_NAMES[finger]}を${barre.fret}フレットに横向きに置き、${barre.from}〜${barre.to}弦をまとめて押さえる。`:`${FINGER_NAMES[finger]}：${positions.map(p=>`${p.string}弦の${p.fret}フレット`).join('・')}。指先を立てて置く。`}];
 });
}
export function soundingStrings(shape){return shape.frets.flatMap((f,i)=>f>=0?[6-i]:[]);}
export function pitchClasses(shape){return [...new Set(shape.frets.flatMap((f,i)=>f>=0?[(GUITAR_OPEN[i]+f)%12]:[]))].sort((a,b)=>a-b);}
export function gripTips(name,shape){
 const tips=shape.barre?['先に中指・薬指・小指の位置を作り、最後に人差し指を横へ。','セーハは人差し指の側面も試し、親指をネックの裏に添える。']:['手のひらをネックへ押し付けず、指先が弦に向くように曲げる。','フレットの金属棒の少し手前を押さえ、隣の弦に指が触れていないか確かめる。'];
 if(name==='C'||name==='Caug')tips.push(name==='C'?'指を階段のように並べ、6弦を避けて5弦から弾く。':'指を階段のように並べ、5・4・3弦だけを弾く。');
 if(name==='A')tips.push('2フレットに3本の指が並ぶ。指先を少しずらし、無理なく収まる位置を探す。');
 if(name==='Dm'||name==='D')tips.push('細い弦側の小さな三角形。4弦から弾き、5・6弦は避ける。');
 if(name==='Fm'&&!shape.barre)tips.push('1フレットの3弦と2弦は別々の指で押さえる。4・3・2弦の3本だけを弾く。');
 if(name==='F'&&!shape.barre)tips.push('4・3・2弦の3本だけを弾くF。1弦を開放で鳴らすFmaj7とは別の形。');
 return tips;
}
const fpage='https://plugplus.rittor-music.co.jp/hint/series/hisako_guitar/lesson03/';
export const HAND_LESSONS={
 f:{video:'1xkjzhcWHMA',title:'Fの手元とセーハ',creator:'田渕ひさ子 / plug+',page:fpage,start:61,note:'日本語。動画は標準のセーハ形です。3本だけの形とは押さえ方が異なります。'},
 fm:{video:'1xkjzhcWHMA',title:'FからFmへ・手元の形',creator:'田渕ひさ子 / plug+',page:fpage,start:111,note:'日本語。動画は標準のセーハ形です。3本だけの形とは押さえ方が異なります。'},
 b:{video:'gPCT6OYNmWg',title:'Bの手元と指のまとめ方',creator:'田渕ひさ子 / plug+',page:'https://plugplus.rittor-music.co.jp/hint/series/hisako_guitar/lesson04/',start:35,note:'日本語。動画では薬指をまとめて使う別の押さえ方も紹介します。'},
 c:{video:'f18EV2dr008',title:'Cの指の置き方・角度',creator:'JustinGuitar',page:'https://www.youtube.com/watch?v=f18EV2dr008',start:15,note:'英語。手元を見て確認できます。'},
 basic:{video:'IscDj_-Nr0s',title:'指の置き方・構え方の基本',creator:'JustinGuitar',page:'https://www.youtube.com/watch?v=IscDj_-Nr0s',start:0,note:'英語の共通レッスンです。このコード専用の運指動画ではありません。'}
};
export function handLesson(name){return name==='F'?HAND_LESSONS.f:name==='Fm'?HAND_LESSONS.fm:name==='B'?HAND_LESSONS.b:name==='C'?HAND_LESSONS.c:HAND_LESSONS.basic;}
