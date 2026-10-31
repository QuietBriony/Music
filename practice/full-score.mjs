import { noteName } from './music.mjs?v=26';
import { neckDiagram } from './sanshin-view.mjs?v=26';
import { scoreLyricAnnotations,setScoreLyric,renderLyricReference } from './score-lyrics.mjs?v=26';

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
export function practiceSheetEntries(notes,{instrument,chords}={}){
 if(instrument!=='guitar'||!chords)return sheetEntries(notes);
 const entries=notes.flatMap((note,index)=>!index||note.cueIndex!==notes[index-1].cueIndex?[{note,index}]:[]);
 entries.forEach((e,i)=>e.end=entries[i+1]?.index??notes.length);return entries;
}

export function mountFullScore({onSeek,onGuide,onStop,onTuning,onMic}){
  const $=id=>document.getElementById(`full-score-${id}`),dialog=$('dialog');
  let state=null,renderedNotes=null,renderedIndex=null,renderedKind='',entries=[],sheet={},annotationNotes=null,annotationLines=null,annotationCues=null,annotationSyllables=null,referenceLines=null,referenceNotes=null;
  const duration=beats=>Number.isFinite(beats)?`${Number(beats.toFixed(2))}拍`:'';
  function annotate(){
    if(!renderedNotes)return;
    if(annotationNotes===renderedNotes&&annotationLines===sheet.lines&&annotationCues===sheet.cues&&annotationSyllables===sheet.syllables)return;
    const annotations=scoreLyricAnnotations(renderedNotes,sheet);
    for(const cell of $('sheet').querySelectorAll('[data-index]')){const i=Number(cell.dataset.index),end=Number(cell.dataset.end)||i+1,parts=annotations.slice(i,end).filter(a=>a.text);setScoreLyric(cell,parts.length?{...parts[0],text:parts.map(a=>a.text).join(' / ')}:null);}
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
    const guitar=state.instrument==='guitar';dialog.dataset.instrument=guitar?'guitar':'sanshin';
    $('title').textContent=`${state.title} · ${guitar?state.chords?'コード譜と歌詞':'TABと歌詞':'工工四全体'}`;
    $('tuning').closest('label').hidden=guitar;$('reading').textContent=guitar?(state.chords?'コードを左から右へ。枠を押すと、そのコードから練習できます。':'TABは左から右へ。数字はフレット、0は開放弦です。枠を押すと、その音から練習できます。'):'各段の右上から下へ、次は左の列。文字の横が歌う言葉です。';
    $('tuning').value=state.tuning;
    const kind=`${state.instrument}:${state.chords}`;
    if(renderedNotes!==state.notes||renderedKind!==kind){
      renderedNotes=state.notes;renderedKind=kind;annotationNotes=null;renderedIndex=null;entries=practiceSheetEntries(state.notes,state);const blocks=[];
      for(let start=0;start<entries.length;start+=16){
        const block=document.createElement('section');block.className='sheet-block';block.setAttribute('aria-label',`${Math.floor(start/16)+1}つ目の段`);
        const heading=document.createElement('p');heading.textContent=guitar?`${start+1}〜${Math.min(entries.length,start+16)}${state.chords?'コード':'音'}`:`${Math.floor(start/16)+1}段目`;block.append(heading);
        const grid=document.createElement('div');grid.className='sheet-column-grid';
        for(const entry of entries.slice(start,start+16)){
          const cell=document.createElement(entry.rest?'div':'button'),symbol=document.createElement('strong'),detail=document.createElement('small');
          cell.className='sheet-cell';symbol.textContent=entry.rest?'休':guitar?(state.chords?entry.note.chord:entry.note.fret):entry.note.symbol;
          detail.textContent=entry.rest?duration(entry.beats):guitar?(state.chords?`${entry.index+1}音目から · ${entry.end-entry.index}本の弦`:`${entry.note.string}弦 · ${duration(entry.note.beats)}`):`${entry.index+1} ${duration(entry.note.beats)}`;
          const lyric=document.createElement('span');lyric.className='score-note-lyric';cell.append(symbol,lyric,detail);
          if(entry.rest){cell.classList.add('rest');cell.setAttribute('aria-label',`${duration(entry.beats)}休む`);}
          else{cell.dataset.index=entry.index;cell.dataset.end=entry.end??entry.index+1;cell.setAttribute('aria-label',`${entry.index+1}音目 ${entry.note.symbol||entry.note.chord||entry.note.fret} ${entry.note.position}`);cell.onclick=()=>onSeek(entry.index);}
          grid.append(cell);
        }
        block.append(grid);blocks.push(block);
      }
      $('sheet').replaceChildren(...blocks);
    }
    annotate();
    for(const cell of $('sheet').querySelectorAll('[data-index]')){
      const i=Number(cell.dataset.index),end=Number(cell.dataset.end),current=i<=state.index&&state.index<end;cell.classList.toggle('current',current);cell.setAttribute('aria-current',String(current));
      cell.classList.toggle('outside',end<=state.start||i>=state.end);
    }
    if(renderedIndex!==state.index){
      reveal();
      renderedIndex=state.index;
    }
    const note=state.notes[state.index];
    const playable=entries.filter(e=>!e.rest),active=playable.findIndex(e=>e.index<=state.index&&state.index<(e.end??e.index+1));
    $('position').textContent=guitar&&state.chords?`${active+1} / ${playable.length}コード · ${note.chord} · ${state.mode==='demo'&&state.easy?'4拍で下へ1回':state.strum?'まとめて鳴らす':`${note.string}弦 ${note.fret===0?'開放':note.fret+'F'}`}`:`${state.index+1} / ${state.notes.length}音 · ${guitar?`${note.string}弦 ${note.fret}F`:note.symbol+' '+note.position} · ${noteName(note.midi)}`;
    if(!guitar)$('finger').innerHTML=neckDiagram(note.symbol);
    else if(state.guitarDiagram)$('finger').replaceChildren(state.guitarDiagram.cloneNode(true));
    else{const label=document.createElement('strong');label.textContent=`${note.string}弦 ${note.fret===0?'開放':note.fret+'F'}`;$('finger').replaceChildren(label);}
    $('previous').disabled=active<=0;$('next').disabled=active===playable.length-1;
    $('guide').textContent=state.mode==='demo'?'■ ガイドを止める':'♪ ガイドで進む';
    $('stop').disabled=state.mode==='idle';
    $('mic').disabled=state.mode==='pending'||state.mode==='mic';$('mic').textContent=state.mode==='mic'?'マイクで聴いています':'マイクで進む';
    $('status').textContent=state.mode==='pending'?'マイクを準備しています。':state.mode==='demo'?'ガイドに合わせて音と歌詞が進みます。':state.mode==='mic'?'正しい音を弾くと、演奏位置が自動で見えるように進みます。':'ガイドかマイクで始めると、演奏位置が自動で見えるように進みます。';
    $('range').textContent=state.start===0&&state.end===state.notes.length?'全体を練習':`${state.start+1}〜${state.end}音の反復中（全体はすべて表示）`;
    $('all').hidden=state.start===0&&state.end===state.notes.length;
  }
  function navigate(delta){const playable=entries.filter(e=>!e.rest),active=playable.findIndex(e=>e.index<=state.index&&state.index<(e.end??e.index+1));onSeek(playable[Math.max(0,Math.min(playable.length-1,active+delta))].index);}
  $('previous').onclick=()=>navigate(-1);
  $('next').onclick=()=>navigate(1);
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
