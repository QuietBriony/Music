import { SING_SHAPES } from './singalong-core.mjs?v=35';

const roots=['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B'];
const aliases={Db:'C#','D#':'Eb',Gb:'F#',Ab:'G#','A#':'Bb'};
export const EASY_CAPOS={'under-the-bridge':2,woman:3,'your-song':3,'could-you-be-loved':2,'sleep-last-night':1,santeria:4,blackbird:0,imagine:0,tokiyo:4,jigsaw:2,'yes-my-love':5};

export function transposeChord(name,semitones){
 if(name==='N')return name;
 if(!Number.isInteger(semitones))throw Error('移調を確認してください。');
 const shift=part=>{const m=part.match(/^([A-G][#b]?)(.*)$/);if(!m)throw Error('コード名を確認してください。');const root=roots.indexOf(aliases[m[1]]||m[1]);if(root<0)throw Error('コード名を確認してください。');return roots[((root+semitones)%12+12)%12]+m[2];};
 return name.split('/').map(shift).join('/');
}

// Keep the recording's sounding key: a higher capo needs a lower chord shape.
// Personal edits stay in the source key and retain their stable step indices.
export function arrangeCourse(base,capo){
 if(!Number.isInteger(capo)||capo<0||capo>7)throw Error('カポは0〜7で選んでください。');
 const steps=base.steps.map(step=>{
  const name=transposeChord(step.name,base.capo-capo);
  if(name!=='N'&&!Object.hasOwn(SING_SHAPES,name))throw Error('このカポの押さえ方は準備中です。');
  return {...step,name};
 });
 return {...base,capo,steps};
}
export function availableCapos(base){return Array.from({length:8},(_,i)=>i).filter(capo=>{try{arrangeCourse(base,capo);return true;}catch{return false;}});}
export function nextChange(steps,index){
 for(let i=index+1;i<steps.length;i++)if(steps[i].name!==steps[index]?.name)return i;
 return -1;
}
export function changeCue(course,index,time,offset=0){
 const position=Math.max(0,time)+offset,started=position>=course.times[0],next=started?nextChange(course.steps,index):0;
 return {started,next,remaining:next<0?null:Math.max(0,course.times[next]-position)};
}
// Four actual chord changes, not four repeated display cells.
export function chordPhrase(course,index,offset=0){
 let start=Math.max(0,Math.min(course.steps.length-1,index));
 while(start>0&&course.steps[start-1].name===course.steps[start].name)start--;
 let end=start;
 for(let n=0;n<4;n++){end=nextChange(course.steps,end);if(end<0)break;}
 const a=Math.max(0,course.times[start]-offset),b=Math.min(course.end,(end<0?course.end:course.times[end])-offset);
 return b-a>=1?{a,b}:null;
}
export function timePhrase(time,duration,length=10){
 if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<1)return null;
 const a=Math.max(0,Math.min(time,duration-1)),b=Math.min(duration,a+length);
 return b-a>=1?{a,b}:null;
}
export const timeLabel=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
