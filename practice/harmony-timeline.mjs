import { SING_SHAPES } from './singalong-core.mjs?v=28';

const aliases={Db:'C#','D#':'Eb',Gb:'F#',Ab:'G#','A#':'Bb'};
export function harmonyName(value){
 if(['N','NC','-',''].includes(value))return 'N';
 const m=String(value).match(/^([A-G][#b]?)(m?)$/);if(!m)throw new Error('未対応の推定コードです。');
 const name=(aliases[m[1]]||m[1])+m[2];if(!SING_SHAPES[name])throw new Error('押さえ方が未登録です。');return name;
}
export function estimatedCourse(spec){
 const {id,video,bpm,duration,events,source}=spec;
 if(!/^[\w-]{11}$/.test(video)||!Number.isFinite(bpm)||bpm<20||bpm>300||!Number.isFinite(duration)||duration<1||duration>7200||typeof events!=='string'||events.length>40000)throw new Error('推定データを確認してください。');
 const rows=events.trim().split(/\s+/);if(!rows.length||rows.length>1024)throw new Error('推定の長さが不正です。');
 const steps=[],times=[];
 for(const token of rows){
  const m=token.match(/^(\d+):(.+)$/);if(!m)throw new Error('推定の形式が不正です。');
  const beat=Number(m[1]),time=Math.max(0,(beat-1)*60/bpm),name=harmonyName(m[2]);if(!Number.isFinite(time)||time>=duration||times.length&&time<times.at(-1))throw new Error('推定の時刻が不正です。');
  const section=Math.floor(time/30),title=`${Math.floor(section/2)}:${section%2?'30':'00'}から`;
  const item={name,silent:name==='N',section,title,index:steps.length};
  if(times.length&&time===times.at(-1)){steps[steps.length-1]={...item,index:steps.length-1};continue;}
  steps.push(item);times.push(time);
 }
 return {key:`${id}-${video}-estimate-v1`,video,url:`https://www.youtube.com/watch?v=${video}`,capo:0,estimated:true,source,steps,times,end:duration,note:'公開動画の音から推定した簡略伴奏（試験）。コード名や切替位置に誤りがあります。標準調弦・カポなしで、細かなリフや転回形を省いた形です。原曲の運指とは異なります。歌詞は動画・字幕か自分のテキストで確認してください。'};
}

export function correctedCourse(base,raw){
 if(!raw)return base;
 if(typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||raw.key!==base.key||!Array.isArray(raw.changes)||raw.changes.length>1024)throw new Error('保存した補正の形式を確認してください。');
 const steps=base.steps.map(s=>({...s})),times=[...base.times],seen=new Set();
 for(const change of raw.changes){
  if(!change||typeof change!=='object'||Array.isArray(change))throw new Error('補正の形式が不正です。');
  const i=change.index;if(!Number.isInteger(i)||i<0||i>=steps.length||seen.has(i))throw new Error('補正の位置が不正です。');seen.add(i);
  if(change.name!==undefined){if(change.name!=='N'&&!Object.hasOwn(SING_SHAPES,change.name))throw new Error('補正のコード名が不正です。');steps[i].name=change.name;steps[i].silent=change.name==='N';}
  if(change.time!==undefined){if(!Number.isFinite(change.time)||change.time<0||change.time>=base.end)throw new Error('補正の時刻が不正です。');times[i]=Math.round(change.time*1000)/1000;}
 }
 if(times.some((t,i)=>i&&t<=times[i-1]))throw new Error('コードの時刻は前後のコードの間にしてください。');
 return {...base,steps,times,personal:true};
}

// Separate-device practice uses an explicitly started local clock, never a media stream.
export function practiceClock(duration,position=0,now=()=>performance.now()){
 let time=Math.max(0,Math.min(duration,position)),anchor=now(),running=false,rate=1;
 const current=()=>Math.min(duration,time+(running?(now()-anchor)/1000*rate:0));
 const pause=()=>{time=current();running=false;anchor=now();};
 return {localClock:true,getCurrentTime:current,getDuration:()=>duration,getPlayerState:()=>running?1:2,getAvailablePlaybackRates:()=>[.5,.75,1],playVideo(){time=current();anchor=now();running=true;},pauseVideo:pause,seekTo(value){time=Math.max(0,Math.min(duration,value));anchor=now();},setPlaybackRate(value){const was=running;pause();rate=value;running=was;},destroy:pause};
}
