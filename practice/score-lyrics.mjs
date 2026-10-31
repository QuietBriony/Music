// Lyric fragments belong to the existing CC BY-SA 4.0 Tinsagu adaptation.
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
