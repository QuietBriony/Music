import { CHORDS } from './chords.mjs?v=23';
export const SING_SHAPES={...CHORDS,
 F:{frets:[-1,-1,3,2,1,-1],fingers:[0,0,3,2,1,0]},
 Fm:{frets:[-1,-1,3,1,1,-1],fingers:[0,0,3,1,2,0]},
 Caug:{frets:[-1,3,2,1,-1,-1],fingers:[0,3,2,1,0,0]}
};
const a=['C','Caug','Em','G','Am','Dm','G'];
const b=['C','Caug','A','Dm','G','Em','A','Dm','G','F'];
export const TOKIYO_SECTIONS=[
 {title:'イントロ',names:['C','C','Fm','G']},
 {title:'1番 · 前半',names:[...a,...a]}, {title:'1番 · 後半',names:b},
 {title:'2番 · 前半',names:[...a,...a]}, {title:'2番 · 後半',names:b},
 {title:'間奏',names:[...a,...a]}, {title:'繰り返し',names:b},
 {title:'3番 · 前半',names:[...a,...a]}, {title:'3番 · 後半',names:b},
 {title:'終わりのフレーズ',names:['C','Am','Dm','G','C','Am','Dm','G']}, {title:'最後',names:['Fm','C']}
];
export function songSteps(sections){let index=0;return sections.flatMap((s,section)=>s.names.map(name=>({name,section,title:s.title,index:index++})));}
export const TOKIYO_STEPS=songSteps(TOKIYO_SECTIONS);
export function sectionStarts(steps){const seen=new Set();return steps.filter(s=>{if(seen.has(s.section))return false;seen.add(s.section);return true;});}
export function videoId(value){
 if(/^[\w-]{11}$/.test(value||''))return value;
 let url;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:')return null;
 const host=url.hostname.toLowerCase();let id;
 if(host==='youtu.be')id=url.pathname.slice(1).split('/')[0];
 else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
 return /^[\w-]{11}$/.test(id||'')?id:null;
}
export function validRange(a,b,duration){return Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b-a>=1&&b<=Math.min(7200,duration||7200);}
export function readSteps(text){
 if(typeof text!=='string'||text.length>20000)throw new Error('コードの並びは2万字までです。');
 const names=text.split(/[\s,、→|]+/).filter(Boolean);if(!names.length||names.length>512)throw new Error('コードは1〜512個で指定してください。');
 if(names.some(n=>!Object.hasOwn(SING_SHAPES,n)))throw new Error('未対応のコード名があります。下のコード一覧で確認してください。');
 return songSteps([{title:'自分の曲',names}]);
}
export function fingeringText(name){
 const s=SING_SHAPES[name];if(!s)return'';
 return s.frets.map((f,i)=>`${6-i}弦${f<0?'は弾かない':f===0?'は開放':`${f}フレット・${['','人差し指','中指','薬指','小指'][s.fingers[i]]}`}`).join('、')+'。';
}
export function normalizeSingState(value,stepCount){
 return{index:Number.isInteger(value?.index)&&value.index>=0&&value.index<=stepCount?value.index:0,capo:Number.isInteger(value?.capo)&&value.capo>=0&&value.capo<=7?value.capo:0,
 a:Number.isFinite(value?.a)&&value.a>=0&&value.a<=7200?value.a:null,b:Number.isFinite(value?.b)&&value.b>=0&&value.b<=7200?value.b:null,loop:false,follow:value?.follow!==false,offset:Number.isFinite(value?.offset)&&Math.abs(value.offset)<=2?value.offset:0,videoTime:Number.isFinite(value?.videoTime)&&value.videoTime>=0&&value.videoTime<=7200?value.videoTime:0};
}
