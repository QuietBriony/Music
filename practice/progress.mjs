// Device-local practice positions. Never stores audio or sends requests.
export const PROGRESS_STORAGE='music-practice-progress-v1';
export function progressKey(session,options,notes){
 const source=JSON.stringify([options,notes.map(n=>[n.midi,n.time,n.duration,n.string,n.fret,n.chord,n.cueIndex])]);
 let hash=2166136261;for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return `${session}:${(hash>>>0).toString(16)}`;
}
export function validProgress(value,count){
 if(!value||value.count!==count||!Number.isInteger(count)||count<1||count>4096)return null;
 const {start,end,index,done,loop}=value;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||start>=end||end>count||!Number.isInteger(index)||index<start||index>end)return null;
 if(typeof done!=='boolean'||done!==(index===end)||typeof loop!=='boolean'||(!loop&&(start!==0||end!==count)))return null;
 return{count,start,end,index,done,loop,matched:Math.max(0,Math.min(1000000,Math.floor(Number(value.matched)||0))),rounds:Math.max(0,Math.min(1000000,Math.floor(Number(value.rounds)||0))),updated:Number.isFinite(value.updated)?value.updated:0};
}
export class PracticeProgress {
 constructor(storage){this.storage=storage;}
 read(){try{const data=JSON.parse(this.storage.getItem(PROGRESS_STORAGE)||'null');return data?.version===1&&Array.isArray(data.entries)?data.entries.filter(e=>e&&typeof e.key==='string'&&e.key.length<=400).slice(0,24):[];}catch{return[];}}
 get(key,count){return validProgress(this.read().find(e=>e.key===key),count);}
 set(key,value){
  const clean=validProgress(value,value.count);if(!clean||typeof key!=='string'||key.length>400)return false;
  const entries=[{key,...clean,updated:Date.now()},...this.read().filter(e=>e.key!==key)].slice(0,24);
  try{this.storage.setItem(PROGRESS_STORAGE,JSON.stringify({version:1,entries}));return true;}catch{return false;}
 }
}
