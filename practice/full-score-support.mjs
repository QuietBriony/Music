import {centsFrom,noteName} from './music.mjs?v=47';
import {lyricPhraseRange} from './score-lyrics.mjs?v=47';

// Only verified bundled positions can move the musical playhead. Personal text
// and custom timing retain their existing manual controls without inferred notes.
export function scoreSungLines(notes,sheet={}){
 if(sheet.presetTiming!==true)return [];
 return (sheet.lines||[]).flatMap((text,line)=>{
  const range=lyricPhraseRange(notes,{...sheet,manualLine:line},0);
  return range?[{...range,text,reading:sheet.notes?.[line]?.reading||''}]:[];
 });
}
export function adjacentSungLine(notes,sheet,index,delta){
 const lines=scoreSungLines(notes,sheet);if(!lines.length)return null;
 const manual=Number.isInteger(sheet.manualLine)?lines.findIndex(r=>r.line===sheet.manualLine):-1;
 const current=manual>=0?manual:lines.findIndex(r=>index>=r.start&&index<r.end);
 if(current>=0)return lines[current+delta]||null;
 return delta>0?lines.find(r=>r.start>index)||null:[...lines].reverse().find(r=>r.end<=index)||null;
}

// A user-initiated range change can keep an already open capture. Rebase the
// new follower against the actual sound, so a lingering target still requires a
// fresh pluck. This never opens capture or changes pitch/clarity tolerances.
export function retainSanshinCapture(next,previous,reading,now){
 const reliable=reading?.frequency>0&&reading.clarity>=next.minClarity&&reading.rms>=next.gate;
 const target=next.notes[next.index]?.midi;
 next.lastMidi=reliable?Math.abs(centsFrom(reading.frequency,target))<=next.tolerance?target:Math.round(69+12*Math.log2(reading.frequency/440)):previous.lastMidi;
 next.acceptedAt=now;next.armed=false;next.lastRms=previous.lastRms;
 next.attackBaseline=previous.attackBaseline??null;next.previousAttack=previous.previousAttack||0;
 next.candidateAt=null;next.voicedMs=0;next.lastGoodAt=null;next.previousGood=false;
 next.repluck=null;next.onset=null;
}

// Presentation only: a held label is never fed back to the pitch follower.
export class ListeningDisplay{
 constructor(){this.reset();}
 reset(){this.last=null;this.goodAt=-Infinity;this.okAt=-Infinity;this.okName='';}
 accepted(midi,now){this.okAt=now;this.okName=noteName(midi);}
 observe(reading,now,{gate=.0015,minClarity=.74}={}){
  reading=reading||{};
  const reliable=reading?.frequency>0&&reading.clarity>=minClarity&&reading.rms>=gate;
  if(reliable){this.last=noteName(Math.round(69+12*Math.log2(reading.frequency/440)));this.goodAt=now;}
  const held=!reliable&&now-this.goodAt<=1100,ok=now-this.okAt<=600;
  const heard=reliable?`聴こえた音 ${this.last}`:held?`直前の音 ${this.last}`:'音を待っています';
  const state=ok?'matched':reliable?'heard':held?'held':reading.rms>=gate?'unclear':'waiting';
  return {heard,state,accepted:ok?`○ ${this.okName} OK`:'',held,level:Math.min(100,Math.max(0,Math.round((reading.rms||0)*700)))};
 }
}
