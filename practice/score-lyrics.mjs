// Tinsagu fragments retain CC BY-SA 4.0; Tsukinu alignment is CC0.
// See songs/lyrics-provenance.json. User text is always handled as plain text.
export function scoreLyricAnnotations(notes,sheet={}){
 const result=notes.map(()=>({text:'',line:-1,kind:'line'}));
 if(sheet.syllables?.length){
  const fragments=new Map(sheet.syllables.map(s=>[s.beat,s]));
  notes.forEach((n,i)=>{const s=fragments.get(Math.round(n.beat));if(s&&Math.abs(n.beat-s.beat)<.01)result[i]={text:s.text,line:s.line,kind:'syllable'};});
 }else{
  for(const cue of sheet.cues||[]){
   const index=notes.findIndex(n=>Number.isFinite(n.time)&&n.time+.001>=cue.time);
   if(index>=0&&sheet.lines?.[cue.line]){const item=result[index];item.text+=(item.text?' / ':'')+sheet.lines[cue.line];item.line=cue.line;}
  }
 }
 return result;
}
// Resolve a sung line against this score's own clock, independently of rests.
// Personal manual lyrics never acquire a guessed practice range.
export function lyricPhraseRange(notes,sheet={},index=0){
 if(!notes.length||sheet.presetTiming!==true||!sheet.syllables?.length&&!sheet.lineEnds?.length)return null;
 const cues=(sheet.cues||[]).filter(c=>Number.isFinite(c.time)&&c.time>=0&&Number.isInteger(c.line)&&sheet.lines?.[c.line]).sort((a,b)=>a.time-b.time);
 if(!cues.length)return null;
 const time=notes[Math.max(0,Math.min(notes.length-1,index))]?.time;
 if(!Number.isFinite(time))return null;
 let at=0;while(at+1<cues.length&&cues[at+1].time<=time+.001)at++;
 if(Number.isInteger(sheet.manualLine)){at=cues.findIndex(c=>c.line===sheet.manualLine);if(at<0)return null;}
 const cue=cues[at],start=notes.findIndex(n=>n.time+.001>=cue.time);
 const fragments=sheet.syllables?.filter(s=>s.line===cue.line)||[],lastBeat=Math.max(...fragments.map(s=>s.beat));
 // Existing Twinkle has line timing but no per-syllable labels. Its explicit
 // verified line ends preserve that exercise without inferring private timing.
 const until=sheet.lineEnds?.[cue.line];
 const last=fragments.length?notes.findIndex(n=>Math.abs(n.beat-lastBeat)<.01):Number.isFinite(until)?notes.reduce((found,n,i)=>n.time+.001>=cue.time&&n.time<until-.001?i:found,-1):-1,end=last+1;
 if(start<0||last<start)return null;
 // Automatic score following offers no sung-line loop during an instrumental gap.
 if(!Number.isInteger(sheet.manualLine)&&(time+.001<cue.time||index>last))return null;
 return {start,end,line:cue.line,text:sheet.lines[cue.line]};
}
export function setScoreLyric(cell,annotation){
 const label=cell.querySelector('.score-note-lyric');
 label.textContent=annotation?.text||'';label.dataset.kind=annotation?.kind||'line';
 cell.classList.toggle('has-lyric',!!annotation?.text);
 cell.dataset.lyricLine=annotation?.line??-1;
 cell.dataset.noteLabel??=cell.getAttribute('aria-label')||'';cell.setAttribute('aria-label',cell.dataset.noteLabel+(annotation?.text?` 歌詞 ${annotation.text}`:''));
}
export function renderLyricReference(container,lines,notes){
 container.replaceChildren(...lines.map((line,i)=>{
  const row=document.createElement('div'),title=document.createElement('strong');title.textContent=line;row.append(title);
  for(const field of ['reading','meaning','words'])if(notes?.[i]?.[field]){const p=document.createElement('p');p.textContent=notes[i][field];row.append(p);}
  return row;
 }));
}
