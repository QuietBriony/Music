import { noteName } from './music.mjs?v=47';
import { scoreLyricAnnotations,setScoreLyric,renderLyricReference,lyricPhraseRange } from './score-lyrics.mjs?v=47';
import {scoreSungLines,adjacentSungLine,ListeningDisplay} from './full-score-support.mjs?v=47';

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

export function mountFullScore({onSeek,onGuide,onStop,onTuning,onMic,onLoop=()=>{},onLine=()=>{},onLyricFollow=()=>{},onSoftInput=()=>{}}){
  const $=id=>document.getElementById(`full-score-${id}`),dialog=$('dialog');
  let state=null,renderedNotes=null,renderedIndex=null,renderedKind='',entries=[],sheet={},annotationNotes=null,annotationLines=null,annotationCues=null,annotationSyllables=null,referenceLines=null,referenceNotes=null;
  const listening=new ListeningDisplay(),text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
  function focus(value){dialog.dataset.focus=String(!!value);$('focus').setAttribute('aria-pressed',String(!!value));$('focus').textContent=value?'設定':'譜面を広く';requestAnimationFrame(()=>{fit();reveal(true,false);});}
  $('focus').onclick=()=>focus(dialog.dataset.focus!=='true');
  $('size').onchange=()=>{dialog.dataset.size=$('size').value;fit();reveal(true,false);};
  const duration=beats=>Number.isFinite(beats)?`${Number(beats.toFixed(2))}拍`:'';
  function annotate(){
    if(!renderedNotes)return;
    if(annotationNotes===renderedNotes&&annotationLines===sheet.lines&&annotationCues===sheet.cues&&annotationSyllables===sheet.syllables)return;
    const annotations=scoreLyricAnnotations(renderedNotes,sheet);
    for(const cell of $('sheet').querySelectorAll('[data-index]')){const i=Number(cell.dataset.index),end=Number(cell.dataset.end)||i+1,parts=annotations.slice(i,end).filter(a=>a.text);setScoreLyric(cell,parts.length?{...parts[0],text:parts.map(a=>a.text).join(' / ')}:null);}
    annotationNotes=renderedNotes;annotationLines=sheet.lines;annotationCues=sheet.cues;annotationSyllables=sheet.syllables;fit();phraseControls();
  }
  function reveal(force=false,smooth=true){
    if(!dialog.open||!state||(!force&&!$('follow').checked))return;
    const cell=$('sheet').querySelector('[aria-current="true"]');if(!cell)return;
    const viewport=$('sheet'),v=viewport.getBoundingClientRect(),c=cell.getBoundingClientRect(),b=cell.closest('.sheet-block').getBoundingClientRect(),context=Math.min(65,v.height/4);
    if(!force&&c.top>=v.top+context&&c.bottom<=v.bottom-context&&c.left>=v.left&&c.right<=v.right)return;
    const target=b.height+20<=v.height?b.top-8:c.top-context;
    viewport.scrollTo({top:viewport.scrollTop+target-v.top,left:viewport.scrollLeft+(c.right>v.right?c.right-v.right:c.left<v.left?c.left-v.left:0),behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
  }
  function fit(){
    if(!dialog.open||state?.instrument!=='sanshin'||dialog.dataset.size==='large')return;
    const viewport=$('sheet'),blocks=[...viewport.querySelectorAll('.sheet-block')];if(!blocks.length)return;
    const rows=new Set(blocks.map(b=>Math.round(b.offsetTop))).size,style=getComputedStyle(viewport),heading=blocks[0].querySelector('p').getBoundingClientRect().height+5;
    const room=viewport.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-(rows-1)*parseFloat(style.rowGap||'0')-rows*heading;
    const fragments=[...viewport.querySelectorAll('.score-note-lyric[data-kind="syllable"]')];
    const short=matchMedia('(max-height:500px) and (orientation:landscape)').matches;
    const minimum=Math.max(44,...fragments.map(n=>(short?16:20)+Math.min(4,[...n.textContent].length)*parseFloat(getComputedStyle(n).fontSize)));
    const size=Math.max(Math.ceil(minimum),Math.min(68,Math.floor(room/(rows*4))));viewport.style.setProperty('--sheet-cell-height',size+'px');
  }
  new ResizeObserver(()=>{fit();reveal(false,false);}).observe($('sheet'));
  const phrase=()=>state?.instrument==='sanshin'?lyricPhraseRange(state.notes,sheet,state.index):null;
  const repeating=range=>!!range&&state.loop===true&&state.start===range.start&&state.end===range.end;
  function phraseControls(){
    const range=phrase();
    for(const button of dialog.querySelectorAll('[data-score-phrase]')){
      button.hidden=!range;button.disabled=!range;text(button,repeating(range)?'反復を終える':'この行を反復');
      button.setAttribute('aria-pressed',String(repeating(range)));
      if(range)button.setAttribute('aria-label',`${range.line+1}行目「${range.text}」${repeating(range)?'の反復を終える':'を反復する'}`);
    }
    const native=state?.instrument==='sanshin',lines=native?scoreSungLines(state.notes,sheet):[];
    for(const [id,delta]of[['line-previous',-1],['line-next',1]]){
      const next=native?adjacentSungLine(state.notes,sheet,state.index,delta):null;
      $(id).hidden=!lines.length;$(id).disabled=!next;
      $(id).setAttribute('aria-label',next?`${next.line+1}行目「${next.text}」から練習`:(delta>0?'次の行はありません':'前の行はありません'));
      text($(id),delta>0&&next&&state.index<lines[0].start?'歌い出しへ':delta>0?'次の行':'前の行');
    }
    $('lyric-follow').hidden=!native||!lines.length||sheet.follow!==false;
    $('lyric-actions').hidden=!lines.length;
    const current=range||lines.find(r=>state.index>=r.start&&state.index<r.end),ahead=lines.find(r=>r.start>state?.index);
    text($('phrase-state'),repeating(range)?`${range.line+1}行目を反復 · ${(state.rounds||0)+1}周目`:lines.length&&!current?ahead?(state.index<lines[0].start?'前奏 · 歌い出しを準備':'間奏 · 次の行へ'):'後奏':current?`${current.line+1} / ${sheet.lines.length}行 · ${sheet.follow===false?'手動表示':'譜面に連動'}`:'');
    $('phrase-state').hidden=!$('phrase-state').textContent;
  }
  for(const button of dialog.querySelectorAll('[data-score-phrase]'))button.onclick=()=>{const range=phrase();if(range)onLoop(repeating(range)?null:range,state.index);};
  for(const [id,delta]of[['line-previous',-1],['line-next',1]])$(id).onclick=()=>{if(!state)return;const range=adjacentSungLine(state.notes,sheet,state.index,delta);if(range)onLine(range,state.loop);};
  $('lyric-follow').onclick=onLyricFollow;
  $('soft-input').onclick=()=>{onSoftInput();$('soft-input').disabled=$('mic-boost').value==='16';};
  $('mic-boost').addEventListener('change',()=>{$('soft-input').disabled=$('mic-boost').value==='16';});
  function update(next){
    if(state?.mode!==next.mode)listening.reset();state=next;if(!dialog.open)return;
    const guitar=state.instrument==='guitar';dialog.dataset.instrument=guitar?'guitar':'sanshin';dialog.dataset.chords=String(!!state.chords);dialog.dataset.mode=state.mode;dialog.dataset.done=String(!!state.done);
    $('title').textContent=`${state.title} · ${guitar?state.chords?'コード譜と歌詞':'TABと歌詞':'工工四'}`;
    $('tuning').closest('label').hidden=guitar;$('reading').textContent=guitar?(state.chords?'コードを左から右へ。枠を押すと、そのコードから練習できます。':'TABは左から右へ。数字はフレット、0は開放弦です。枠を押すと、その音から練習できます。'):'各段の右上から下へ、次は左の列。色の枠が今の音です。枠を押すと、その音から練習できます。';
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
          detail.textContent=entry.rest?duration(entry.beats):guitar?(state.chords?state.strum?'ジャーンと1回':`${entry.index+1}音目から · ${entry.end-entry.index}本の弦`:`${entry.note.string}弦 · ${duration(entry.note.beats)}`):`${entry.index+1} ${duration(entry.note.beats)}`;
          const lyric=document.createElement('span');lyric.className='score-note-lyric';cell.append(symbol,lyric,detail);
          if(entry.rest){cell.classList.add('rest');cell.setAttribute('aria-label',`${duration(entry.beats)}休む`);}
          else{cell.dataset.index=entry.index;cell.dataset.end=entry.end??entry.index+1;cell.setAttribute('aria-label',`${entry.index+1}音目 ${entry.note.symbol||entry.note.chord||entry.note.fret} ${entry.note.position}`);cell.onclick=()=>onSeek(entry.index);}
          grid.append(cell);
        }
        block.append(grid);blocks.push(block);
      }
      $('sheet').replaceChildren(...blocks);
      requestAnimationFrame(fit);
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
    $('position').textContent=state.done?'○ 最後まで弾けました':guitar&&state.chords?`${active+1} / ${playable.length}コード · ${note.chord} · ${state.mode==='demo'&&state.easy?'4拍で下へ1回':state.strum?'まとめて鳴らす':`${note.string}弦 ${note.fret===0?'開放':note.fret+'F'}`}`:`${state.index+1} / ${state.notes.length}音 · ${guitar?`${note.string}弦 ${note.fret}F`:note.symbol} · ${noteName(note.midi)}`;
    $('instruction').textContent=guitar&&state.chords?state.guitarInstruction||'':'';
    if(!guitar)$('finger').replaceChildren();
    else if(state.guitarDiagram)$('finger').replaceChildren(state.guitarDiagram.cloneNode(true));
    else{const label=document.createElement('strong');label.textContent=`${note.string}弦 ${note.fret===0?'開放':note.fret+'F'}`;$('finger').replaceChildren(label);}
    $('previous').disabled=active<=0;$('next').disabled=active===playable.length-1;
    $('guide').textContent=state.mode==='demo'?'■ ガイドを止める':'♪ ガイドで進む';
    $('stop').disabled=state.mode==='idle';
    $('mic').disabled=state.mode==='pending'||state.mode==='mic';$('mic').textContent=state.mode==='mic'?'マイクで聴いています':'マイクで進む';
    if(state.mode!=='mic'){$('level').querySelector('span').style.width='0%';$('level').setAttribute('aria-valuenow','0');$('heard').textContent=state.mode==='pending'?'マイクを準備中':state.done?'演奏を確認しました · マイク停止':'マイクは押したときだけ始まります';$('accepted').textContent='';dialog.dataset.listening=state.done?'matched':'idle';}
    $('soft-input').hidden=guitar;$('soft-input').disabled=$('mic-boost').value==='16';
    $('status').textContent=state.mode==='pending'?'マイクを準備しています。':state.mode==='demo'?'ガイドに合わせて音と歌詞が進みます。':state.mode==='mic'?'正しい音を弾くと、演奏位置が自動で見えるように進みます。':'ガイドかマイクで始めると、演奏位置が自動で見えるように進みます。';
    $('range').textContent=state.start===0&&state.end===state.notes.length?'全体を練習':`${state.start+1}〜${state.end}音の反復中（全体はすべて表示）`;
    $('all').hidden=state.start===0&&state.end===state.notes.length;
    phraseControls();
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
  function showReading(detection,now=performance.now()){
    if(!dialog.open)return;
    const result=listening.observe(detection,now,{gate:state?.gate});
    $('level').querySelector('span').style.width=result.level+'%';$('level').setAttribute('aria-valuenow',String(result.level));
    text($('heard'),state?.instrument==='sanshin'?result.heard:detection.name?`聴こえたコード ${detection.name}`:detection.frequency?`聴こえた音 ${noteName(Math.round(69+12*Math.log2(detection.frequency/440)))}`:'音を聴いています');
    text($('accepted'),result.accepted);dialog.dataset.listening=result.state;
  }
  return{update,reading:showReading,accepted(midi,now){if(state?.instrument!=='sanshin')return;listening.accepted(midi,now);if(dialog.open){text($('accepted'),`○ ${noteName(midi)} OK`);dialog.dataset.listening='matched';}},resetListening(){listening.reset();if(dialog.open){$('accepted').textContent='';dialog.dataset.listening='waiting';}},lyrics(display){sheet=display.sheet;annotate();phraseControls();$('lyrics').hidden=!display.hasLyrics;for(const field of ['status','current','next','reading']){const el=$(`lyric-${field}`);text(el,display[field]||'');el.hidden=!el.textContent;}$('reference').hidden=!sheet.notes?.some(n=>n.reading||n.meaning);if(referenceLines!==sheet.lines||referenceNotes!==sheet.notes){renderLyricReference($('reference-lines'),sheet.lines||[],sheet.notes);referenceLines=sheet.lines;referenceNotes=sheet.notes;}},open(){dialog.showModal();focus(state?.instrument==='sanshin');renderedNotes=null;$('sheet').scrollTop=0;update(state);reveal(true,false);},close(){if(dialog.open)dialog.close();}};
}
