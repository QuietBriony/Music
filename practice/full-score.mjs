import { noteName } from './music.mjs?v=22';
import { neckDiagram } from './sanshin-view.mjs?v=22';
import { scoreLyricAnnotations,setScoreLyric,renderLyricReference } from './score-lyrics.mjs?v=22';

// Keep note indices separate from rests: selecting a cell must seek the actual
// note, and must never count as a correct microphone answer.
export function sheetEntries(notes){
  const entries=[];let end=0;
  notes.forEach((note,index)=>{
    if(Number.isFinite(note.beat)&&note.beat>end+.01)entries.push({rest:true,beats:note.beat-end});
    entries.push({note,index});
    end=Number.isFinite(note.beat)?note.beat+(note.beats||0):end;
  });
  return entries;
}

export function mountFullScore({onSeek,onGuide,onStop,onTuning,onMic}){
  const $=id=>document.getElementById(`full-score-${id}`),dialog=$('dialog');
  let state=null,renderedNotes=null,renderedIndex=null,sheet={},annotationNotes=null,annotationLines=null,annotationCues=null,annotationSyllables=null,referenceLines=null,referenceNotes=null;
  const duration=beats=>Number.isFinite(beats)?`${Number(beats.toFixed(2))}拍`:'';
  function annotate(){
    if(!renderedNotes)return;
    if(annotationNotes===renderedNotes&&annotationLines===sheet.lines&&annotationCues===sheet.cues&&annotationSyllables===sheet.syllables)return;
    const annotations=scoreLyricAnnotations(renderedNotes,sheet);
    for(const cell of $('sheet').querySelectorAll('[data-index]'))setScoreLyric(cell,annotations[Number(cell.dataset.index)]);
    annotationNotes=renderedNotes;annotationLines=sheet.lines;annotationCues=sheet.cues;annotationSyllables=sheet.syllables;
  }
  function reveal(force=false,smooth=true){
    if(!dialog.open||!state||(!force&&!$('follow').checked))return;
    const cell=$('sheet').querySelector('[aria-current="true"]');if(!cell)return;
    const viewport=$('sheet'),v=viewport.getBoundingClientRect(),c=cell.getBoundingClientRect(),b=cell.closest('.sheet-block').getBoundingClientRect(),context=Math.min(65,v.height/4);
    if(!force&&c.top>=v.top+context&&c.bottom<=v.bottom-context&&c.left>=v.left&&c.right<=v.right)return;
    const target=b.height+20<=v.height?b.top-8:c.top-context;
    viewport.scrollTo({top:viewport.scrollTop+target-v.top,left:viewport.scrollLeft+(c.right>v.right?c.right-v.right:c.left<v.left?c.left-v.left:0),behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
  }
  new ResizeObserver(()=>reveal(false,false)).observe($('sheet'));
  function update(next){
    state=next;if(!dialog.open)return;
    $('title').textContent=`${state.title} · 工工四全体`;
    $('tuning').value=state.tuning;
    if(renderedNotes!==state.notes){
      renderedNotes=state.notes;annotationNotes=null;renderedIndex=null;const entries=sheetEntries(state.notes),blocks=[];
      for(let start=0;start<entries.length;start+=16){
        const block=document.createElement('section');block.className='sheet-block';block.setAttribute('aria-label',`${Math.floor(start/16)+1}つ目の段`);
        const heading=document.createElement('p');heading.textContent=`${Math.floor(start/16)+1}段目`;block.append(heading);
        const grid=document.createElement('div');grid.className='sheet-column-grid';
        for(const entry of entries.slice(start,start+16)){
          const cell=document.createElement(entry.rest?'div':'button'),symbol=document.createElement('strong'),detail=document.createElement('small');
          cell.className='sheet-cell';symbol.textContent=entry.rest?'休':entry.note.symbol;
          detail.textContent=entry.rest?duration(entry.beats):`${entry.index+1} ${duration(entry.note.beats)}`;
          const lyric=document.createElement('span');lyric.className='score-note-lyric';cell.append(symbol,lyric,detail);
          if(entry.rest){cell.classList.add('rest');cell.setAttribute('aria-label',`${duration(entry.beats)}休む`);}
          else{cell.dataset.index=entry.index;cell.setAttribute('aria-label',`${entry.index+1}音目 ${entry.note.symbol} ${entry.note.position}`);cell.onclick=()=>onSeek(entry.index);}
          grid.append(cell);
        }
        block.append(grid);blocks.push(block);
      }
      $('sheet').replaceChildren(...blocks);
    }
    annotate();
    for(const cell of $('sheet').querySelectorAll('[data-index]')){
      const i=Number(cell.dataset.index);cell.classList.toggle('current',i===state.index);cell.setAttribute('aria-current',String(i===state.index));
      cell.classList.toggle('outside',i<state.start||i>=state.end);
    }
    if(renderedIndex!==state.index){
      reveal();
      renderedIndex=state.index;
    }
    const note=state.notes[state.index];
    $('position').textContent=`${state.index+1} / ${state.notes.length}音 · ${note.symbol} ${note.position} · ${noteName(note.midi)}`;
    $('finger').innerHTML=neckDiagram(note.symbol);
    $('previous').disabled=state.index===0;$('next').disabled=state.index===state.notes.length-1;
    $('guide').textContent=state.mode==='demo'?'■ ガイドを止める':'♪ ガイドで進む';
    $('stop').disabled=state.mode==='idle';
    $('mic').disabled=state.mode==='pending'||state.mode==='mic';$('mic').textContent=state.mode==='mic'?'マイクで聴いています':'マイクで進む';
    $('status').textContent=state.mode==='pending'?'マイクを準備しています。':state.mode==='demo'?'ガイドに合わせて音と歌詞が進みます。':state.mode==='mic'?'正しい音を弾くと、演奏位置が自動で見えるように進みます。':'ガイドかマイクで始めると、演奏位置が自動で見えるように進みます。';
    $('range').textContent=state.start===0&&state.end===state.notes.length?'全体を練習':`${state.start+1}〜${state.end}音の反復中（全体はすべて表示）`;
    $('all').hidden=state.start===0&&state.end===state.notes.length;
  }
  $('previous').onclick=()=>onSeek(Math.max(0,state.index-1));
  $('next').onclick=()=>onSeek(Math.min(state.notes.length-1,state.index+1));
  $('guide').onclick=()=>onGuide(false);
  $('mic').onclick=onMic;
  $('follow').onchange=()=>{if($('follow').checked)reveal(true);};
  $('current').onclick=()=>{$('follow').checked=true;reveal(true);};
  $('all').onclick=()=>onGuide(true);
  $('stop').onclick=onStop;
  $('tuning').onchange=()=>onTuning(Number($('tuning').value));
  $('close').onclick=()=>dialog.close();
  dialog.addEventListener('close',onStop);
  return{update,lyrics(display){sheet=display.sheet;annotate();$('lyrics').hidden=!display.hasLyrics;for(const field of ['status','current','next']){const el=$(`lyric-${field}`);if(el.textContent!==display[field])el.textContent=display[field]||'';el.hidden=!el.textContent;}$('reference').hidden=!sheet.notes?.some(n=>n.reading||n.meaning);if(referenceLines!==sheet.lines||referenceNotes!==sheet.notes){renderLyricReference($('reference-lines'),sheet.lines||[],sheet.notes);referenceLines=sheet.lines;referenceNotes=sheet.notes;}},open(){dialog.showModal();renderedNotes=null;$('sheet').scrollTop=0;update(state);reveal(true,false);},close(){if(dialog.open)dialog.close();}};
}
