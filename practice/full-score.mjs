import { noteName } from './music.mjs?v=19';
import { neckDiagram } from './sanshin-view.mjs?v=19';

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

export function mountFullScore({onSeek,onGuide,onStop,onTuning}){
  const $=id=>document.getElementById(`full-score-${id}`),dialog=$('dialog');
  let state=null,renderedNotes=null,renderedIndex=null;
  const duration=beats=>Number.isFinite(beats)?`${Number(beats.toFixed(2))}拍`:'';
  function update(next){
    state=next;if(!dialog.open)return;
    $('title').textContent=`${state.title} · 工工四全体`;
    $('tuning').value=state.tuning;
    if(renderedNotes!==state.notes){
      renderedNotes=state.notes;renderedIndex=null;const entries=sheetEntries(state.notes),blocks=[];
      for(let start=0;start<entries.length;start+=16){
        const block=document.createElement('section');block.className='sheet-block';block.setAttribute('aria-label',`${Math.floor(start/16)+1}つ目の段`);
        const heading=document.createElement('p');heading.textContent=`${Math.floor(start/16)+1}段目`;block.append(heading);
        const grid=document.createElement('div');grid.className='sheet-column-grid';
        for(const entry of entries.slice(start,start+16)){
          const cell=document.createElement(entry.rest?'div':'button'),symbol=document.createElement('strong'),detail=document.createElement('small');
          cell.className='sheet-cell';symbol.textContent=entry.rest?'休':entry.note.symbol;
          detail.textContent=entry.rest?duration(entry.beats):`${entry.index+1} ${duration(entry.note.beats)}`;
          cell.append(symbol,detail);
          if(entry.rest){cell.classList.add('rest');cell.setAttribute('aria-label',`${duration(entry.beats)}休む`);}
          else{cell.dataset.index=entry.index;cell.setAttribute('aria-label',`${entry.index+1}音目 ${entry.note.symbol} ${entry.note.position}`);cell.onclick=()=>onSeek(entry.index);}
          grid.append(cell);
        }
        block.append(grid);blocks.push(block);
      }
      $('sheet').replaceChildren(...blocks);
    }
    for(const cell of $('sheet').querySelectorAll('[data-index]')){
      const i=Number(cell.dataset.index);cell.classList.toggle('current',i===state.index);cell.setAttribute('aria-current',String(i===state.index));
      cell.classList.toggle('outside',i<state.start||i>=state.end);
    }
    if(renderedIndex!==state.index){
      $('sheet').querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
      renderedIndex=state.index;
    }
    const note=state.notes[state.index];
    $('position').textContent=`${state.index+1} / ${state.notes.length}音 · ${note.symbol} ${note.position} · ${noteName(note.midi)}`;
    $('finger').innerHTML=neckDiagram(note.symbol);
    $('previous').disabled=state.index===0;$('next').disabled=state.index===state.notes.length-1;
    $('guide').textContent=state.mode==='demo'?'■ ガイドを止める':'♪ ガイドで進む';
    $('stop').disabled=state.mode==='idle';
    $('status').textContent=state.mode==='demo'?'ガイドに合わせて色が進みます。マイク判定は使いません。':'音を押すか「次の音」で進めます。音の正誤は採点しません。';
    $('range').textContent=state.start===0&&state.end===state.notes.length?'全体を練習':`${state.start+1}〜${state.end}音の反復中（全体はすべて表示）`;
    $('all').hidden=state.start===0&&state.end===state.notes.length;
  }
  $('previous').onclick=()=>onSeek(Math.max(0,state.index-1));
  $('next').onclick=()=>onSeek(Math.min(state.notes.length-1,state.index+1));
  $('guide').onclick=()=>onGuide(false);
  $('all').onclick=()=>onGuide(true);
  $('stop').onclick=onStop;
  $('tuning').onchange=()=>onTuning(Number($('tuning').value));
  $('close').onclick=()=>dialog.close();
  dialog.addEventListener('close',onStop);
  return{update,open(){onStop();dialog.showModal();renderedNotes=null;$('sheet').scrollTop=0;update(state);},close(){if(dialog.open)dialog.close();}};
}
