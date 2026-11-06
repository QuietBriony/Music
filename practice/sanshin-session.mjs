const finite=t=>Number.isFinite(t)&&t>=0&&t<=7200;
export function lessonWindow(material,position,duration=7200){
 const limit=Number.isFinite(duration)&&duration>0?Math.min(7200,duration):7200;
 const start=Math.min(limit,Math.max(0,material?.start||0));
 const end=Number.isFinite(material?.end)?Math.min(limit,material.end):limit;
 // A selected explanation can be practised too, without crossing into the song.
 return start>0&&position<start?{start:0,end:start,performance:false}:{start,end:Math.max(start,end),performance:true};
}
export function lessonRange(material,time,duration,length=10){
 if(!finite(time)||![5,10,20].includes(length))return null;
 const w=lessonWindow(material,time,duration);if(w.end-w.start<1)return null;
 const a=Math.max(w.start,Math.min(time,w.end-1)),b=Math.min(w.end,a+length);
 return b-a>=1?{a,b}:null;
}
export function performanceProgress(material,time){
 if(!finite(time)||!finite(material?.start)||!finite(material?.end)||material.end<=material.start)return null;
 const duration=material.end-material.start,elapsed=Math.max(0,Math.min(duration,time-material.start));
 return {duration,elapsed,ratio:elapsed/duration,phase:time<material.start?'lesson':time>=material.end?'ended':'performance'};
}
export function sanshinSession(raw,material){
 const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const position=finite(value.position)?value.position:material?.start||0;
 const a=finite(value.a)?value.a:0,b=finite(value.b)?value.b:0;
 const marks=Array.isArray(value.marks)?value.marks.filter(m=>m&&finite(m.time)&&(m.end===null||finite(m.end)&&m.end-m.time>=1)).slice(0,12).map(m=>({time:m.time,end:m.end})):[];
 return {position,a,b,loop:value.loop===true&&b-a>=1,rate:[.5,.75,1].includes(value.rate)?value.rate:1,repeatSeconds:[5,10,20].includes(value.repeatSeconds)?value.repeatSeconds:10,marks};
}
export function addLessonMark(marks,time,end=null){
 if(!finite(time)||end!==null&&(!finite(end)||end-time<1))return {marks,reason:'invalid'};
 const mark={time:Math.round(time*10)/10,end:end===null?null:Math.round(end*10)/10};
 if(marks.some(m=>Math.abs(m.time-mark.time)<.5&&m.end===mark.end))return {marks,reason:'duplicate'};
 if(marks.length>=12)return {marks,reason:'full'};
 return {marks:[...marks,mark].sort((a,b)=>a.time-b.time),reason:'added'};
}
