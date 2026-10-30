import { CHORDS } from './chords.mjs?v=16';
import { normalizeLyricNotes, readParallelNotes } from './lyric-notes.mjs?v=16';
export const LYRIC_LIMIT=20000;
export function readLyrics(text){
 if(typeof text!=='string'||text.length>LYRIC_LIMIT)throw new Error('歌詞は2万字までです。');
 const lines=[],cues=[],warnings=[];
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
  if(/^\s*(?:\[(?:ti|ar|al|by|re|ve):|\{)/i.test(raw))continue;
  if(/^\s*\[offset:/i.test(raw)){warnings.push('LRCのoffsetタグは反映しません。時刻を直接調整してください。');continue;}
  const times=[...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)].map(m=>{
   if(Number(m[2])>=60)throw new Error('LRCの秒は00〜59で指定してください。');
   return Number(m[1])*60+Number(m[2])+(m[3]?Number(`0.${m[3]}`):0);
  });
  const line=raw.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g,'').replace(/\[([^\]\r\n]+)\]/g,(all,chord)=>Object.hasOwn(CHORDS,chord)?'':all).trim();
  if(!line)continue;if(lines.length>=200)throw new Error('歌詞は200行までです。');
  for(const time of times){if(time>7200)throw new Error('時刻は2時間以内で指定してください。');cues.push({line:lines.length,time});}
  lines.push(line);
 }
 return{lines,cues:normalizeCues(cues,lines.length),warnings};
}
export function normalizeCues(cues,lineCount){
 return (Array.isArray(cues)?cues:[]).filter(c=>c&&Number.isInteger(c.line)&&c.line>=0&&c.line<lineCount&&Number.isFinite(c.time)&&c.time>=0&&c.time<=7200).map(c=>({line:c.line,time:Math.round(c.time*1000)/1000})).sort((a,b)=>a.time-b.time||a.line-b.line).slice(0,1000);
}
export function lyricAt(cues,time){let line=-1;for(const cue of cues){if(cue.time>time+.0001)break;line=cue.line;}return line;}
export function lrcText(lines,cues){
 const stamped=new Set(cues.map(c=>c.line));
 const stamp=time=>{const hundredths=Math.round(time*100),minutes=Math.floor(hundredths/6000),seconds=(hundredths%6000)/100;return `[${String(minutes).padStart(2,'0')}:${seconds.toFixed(2).padStart(5,'0')}]`;};
 return [...cues.map(c=>`${stamp(c.time)}${lines[c.line]}`),...lines.flatMap((line,i)=>stamped.has(i)?[]:[line])].join('\n');
}
export function readChordSheet(text){
 if(typeof text!=='string'||text.length>LYRIC_LIMIT)throw new Error('コード付き歌詞は2万字までです。');
 const names=[],lines=[],cues=[];let title='コード付き歌詞';
 for(const raw of text.split(/\r?\n/)){
  const heading=raw.match(/^\s*\{(?:title|t):\s*([^}]+)\}/i);if(heading){title=heading[1].slice(0,80);continue;}
  if(/^\s*\{/.test(raw))continue;
  const chords=[...raw.matchAll(/\[([^\]\r\n]+)\]/g)].map(m=>m[1]);
  for(const name of chords)if(!Object.hasOwn(CHORDS,name))throw new Error(`未対応のコード「${name}」があります。33種類のコード名で指定してください。`);
  const line=raw.replace(/\[[^\]\r\n]+\]/g,'').trim();
  if(line){cues.push({line:lines.length,time:names.length*4*60/85});lines.push(line);}
  names.push(...chords);if(names.length>64)throw new Error('コードは64個までです。短い範囲に分けてください。');
 }
 if(!names.length)throw new Error('[C]や[Am]の形で、歌詞の中にコードを書いてください。');
 if(lines.length>200)throw new Error('歌詞は200行までです。');
 return{names,title,text:lines.join('\n'),cues};
}
export async function readLyricFile(file){
 if(!file||file.size>80000)throw new Error('80 KB以下の歌詞ファイルを選んでください。');
 const text=await file.text();if(text.length>LYRIC_LIMIT)throw new Error('歌詞は2万字までです。');
 if(text.includes('\uFFFD')||text.includes('\0'))throw new Error('UTF-8のテキストで保存して、もう一度選んでください。');
 return text.replace(/^\uFEFF/,'');
}
export function mountLyrics({defaults={},onImport}){
 const $=id=>document.getElementById(id);let key='',data={lines:[],cues:[]},manual=0,selected=0,currentTime=0,follow=true,credit='',hint=null;
 let display='parallel',overviewState='';try{const saved=localStorage.getItem('music-practice-lyrics-display-v1');if(['lyrics','reading','parallel'].includes(saved))display=saved;}catch{}
 const storage=()=>`music-practice-session-lyrics-v2:${key}`;
 function persist(){try{localStorage.setItem(storage(),JSON.stringify({version:2,text:data.lines.join('\n'),cues:data.cues,notes:data.notes||[],follow}));return true;}catch{return false;}}
 const samePreset=()=>defaults[key]?.text===data.lines.join('\n');
 function overview(){
  overviewState='';
  const notes=normalizeLyricNotes(data.notes,data.lines);
  $('lyric-reading-input').value=notes.map(n=>n.reading).join('\n');$('lyric-meaning-input').value=notes.map(n=>n.meaning).join('\n');
  $('lyric-notes-save').disabled=!data.lines.length;
  $('lyric-overview-lines').replaceChildren(...data.lines.map((text,i)=>{
   const row=document.createElement('div'),button=document.createElement('button');button.textContent=`${i+1}. ${text}`;button.dataset.line=i;
   button.onclick=()=>{manual=selected=i;follow=false;persist();render();};row.append(button);
   for(const field of ['reading','meaning','words'])if(notes[i][field]){const p=document.createElement('p');p.textContent=notes[i][field];p.dataset.lyricField=field;row.append(p);}
   return row;
  }));
  const preset=samePreset()?defaults[key]:null;$('lyric-overview-note').textContent=preset?.note||'行を押すと、上の歌詞もその行に移ります。';
  const links=$('lyric-source-links');links.replaceChildren();
  for(const [label,url] of [['歌詞の出所',preset?.source],['CC BY-SA 4.0',preset?.license],['出所と変更','songs/lyrics-provenance.json']])if(url){const a=document.createElement('a');a.textContent=label+' ↗';a.href=url;a.target='_blank';a.rel='noopener';links.append(a);}
 }
 function render(){
  $('session-lyrics').dataset.empty=String(!data.lines.length&&!hint);
  $('session-lyrics').dataset.hasLyrics=String(!!data.lines.length);
  const current=follow?lyricAt(data.cues,currentTime):manual;
  const active=current<0?0:Math.min(data.lines.length-1,current);
  $('session-lyric-current').textContent=data.lines[active]||hint?.primary||'歌詞を入れると、演奏に合わせてここに表示できます。';
  $('session-lyric-next').textContent=data.lines.length?data.lines[active+1]||'':hint?.secondary||'';
  const annotation=data.notes?.[active],hasNotes=data.notes?.some(n=>n.reading||n.meaning);
  $('lyric-display-label').hidden=!hasNotes;$('lyric-display').value=display;
  for(const field of ['reading','meaning']){const el=$(`session-lyric-${field}`);el.textContent=annotation?.[field]||'';el.hidden=!el.textContent||display==='lyrics'||field==='meaning'&&display!=='parallel';}
  $('lyric-overview').hidden=!data.lines.length;
  const nextOverviewState=`${display}:${active}`;
  if(overviewState!==nextOverviewState){
   for(const row of $('lyric-overview-lines').querySelectorAll('[data-lyric-field]'))row.hidden=display==='lyrics'||row.dataset.lyricField!=='reading'&&display!=='parallel';
   for(const button of $('lyric-overview-lines').querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.line)===active));
   overviewState=nextOverviewState;
  }
  $('session-lyric-status').textContent=!data.lines.length?hint?'練習のコツ':'歌詞未入力':follow&&data.cues.length?`${active+1} / ${data.lines.length} · 譜面に追従`:`${active+1} / ${data.lines.length} · 手動`;
  $('lyric-current').textContent=data.lines[active]||'歌詞を貼り付けて、表示する行を選べます。';$('lyric-position').textContent=data.lines.length?`${active+1} / ${data.lines.length}`:'未入力';
  $('lyric-prev').disabled=!data.lines.length||active<=0;$('lyric-next').disabled=!data.lines.length||active>=data.lines.length-1;
  $('session-lyric-prev').disabled=$('lyric-prev').disabled;$('session-lyric-forward').disabled=$('lyric-next').disabled;
  $('session-lyric-follow').hidden=!data.cues.length||follow;
  $('session-lyric-manual').hidden=!data.lines.length||!!data.cues.length;
  $('lyric-follow').checked=follow;$('lyric-mark').disabled=!data.lines.length;
  $('lyric-time').textContent=`譜面の位置 ${currentTime.toFixed(2)} 秒`;
  $('lyric-credit').textContent=credit;
  $('lyric-overview-credit').textContent=credit;
 }
 function editor(){
  $('lyric-line').replaceChildren(...data.lines.map((line,i)=>new Option(`${i+1}. ${line.slice(0,50)}`,i)));selected=Math.min(selected,Math.max(0,data.lines.length-1));$('lyric-line').value=selected;
  $('lyric-cues').textContent=data.cues.length?data.cues.map(c=>`${c.line+1}行目 ${c.time.toFixed(2)}秒`).join(' / '):'時刻なし。「この行を現在の位置に合わせる」かLRCで設定できます。';overview();render();
 }
 $('lyric-save').onclick=()=>{fileEpoch++;try{const parsed=readLyrics($('lyric-input').value),same=parsed.lines.join('\n')===data.lines.join('\n'),hadNotes=data.notes?.some(n=>n.reading||n.meaning);data={lines:parsed.lines,cues:parsed.cues.length?parsed.cues:same?normalizeCues(data.cues,parsed.lines.length):[],notes:normalizeLyricNotes(same?data.notes:[],parsed.lines)};manual=selected=0;follow=!!data.cues.length;credit='この端末で入力した歌詞';$('lyric-status').textContent=(persist()?'この端末に保存しました。':'表示しました。端末保存はできませんでした。')+(!same&&hadNotes?'歌詞を変えたので、以前の読み方と意味を外しました。':'')+(parsed.warnings.join(' '));editor();}catch(error){$('lyric-status').textContent=error.message;}};
 $('lyric-notes-save').onclick=()=>{try{
  if(readLyrics($('lyric-input').value).lines.join('\n')!==data.lines.join('\n'))throw new Error('先に歌詞を保存してから、読み方と意味を入れてください。');
  data.notes=readParallelNotes(data.lines,$('lyric-reading-input').value,$('lyric-meaning-input').value);credit=samePreset()?`${defaults[key].credit} · 読み方と意味は端末で編集`:'この端末で入力した歌詞・読み方・意味';
  $('lyric-status').textContent=persist()?'読み方と意味をこの端末に保存しました。':'表示しました。端末保存はできませんでした。';editor();
 }catch(error){$('lyric-status').textContent=error.message;}};
 $('lyric-display').onchange=()=>{display=$('lyric-display').value;try{localStorage.setItem('music-practice-lyrics-display-v1',display);}catch{}render();};
 $('session-lyric-follow').onclick=()=>{follow=true;persist();render();};
 let fileEpoch=0;
 $('lyric-input').oninput=()=>{fileEpoch++;};
 $('lyric-file').onchange=async()=>{const file=$('lyric-file').files[0],session=key,ticket=++fileEpoch,previous=$('lyric-input').value;$('lyric-file').value='';if(!file)return;try{const text=await readLyricFile(file);if(ticket!==fileEpoch||session!==key||previous!==$('lyric-input').value)return;$('lyric-input').value=text;$('lyric-status').textContent='ファイルを開きました。内容を確認して「端末に保存して表示」か「コード譜と歌詞を読み込む」を押してください。';}catch(error){if(ticket===fileEpoch&&session===key)$('lyric-status').textContent=error.message;}};
 $('lyric-clear').onclick=()=>{fileEpoch++;data={lines:[],cues:[]};manual=selected=0;$('lyric-input').value='';credit='';follow=false;persist();if(key.startsWith('study:'))try{localStorage.removeItem(`music-practice-local-lyrics-v1:${key.slice(6)}`);}catch{}editor();$('lyric-status').textContent='この曲の歌詞を端末から削除しました。';};
 $('lyric-restore').onclick=()=>{fileEpoch++;const preset=defaults[key];if(!preset)return;const lines=readLyrics(preset.text).lines;data={lines,cues:normalizeCues(preset.cues,lines.length),notes:normalizeLyricNotes(preset.notes,lines)};credit=preset.credit;follow=!!data.cues.length;manual=selected=0;$('lyric-input').value=preset.text;persist();editor();};
 $('lyric-follow').onchange=()=>{follow=$('lyric-follow').checked;if(follow&&!data.cues.length){follow=false;$('lyric-status').textContent='先に行の位置を設定してください。';}persist();render();};
 const step=delta=>{const active=follow?Math.max(0,lyricAt(data.cues,currentTime)):manual;manual=Math.max(0,Math.min(data.lines.length-1,active+delta));follow=false;persist();render();};
 $('lyric-prev').onclick=()=>step(-1);$('lyric-next').onclick=()=>step(1);
 $('session-lyric-prev').onclick=()=>step(-1);$('session-lyric-forward').onclick=()=>step(1);
 $('lyric-line').onchange=()=>{selected=Number($('lyric-line').value);manual=selected;follow=false;render();};
 $('lyric-mark').onclick=()=>{if(!data.lines.length)return;const time=Math.round(currentTime*1000)/1000;data.cues=normalizeCues([...data.cues.filter(c=>c.line!==selected&&Math.abs(c.time-time)>.0005),{line:selected,time}],data.lines.length);follow=true;persist();editor();$('lyric-status').textContent=`${selected+1}行目を今の譜面の位置に合わせました。`;};
 $('lyric-unmark').onclick=()=>{data.cues=data.cues.filter(c=>c.line!==selected);persist();editor();};
 $('lyric-download').onclick=()=>{const blob=new Blob([lrcText(data.lines,data.cues)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='practice-lyrics.lrc';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('chord-sheet-import').onclick=async()=>{try{const result=await onImport(readChordSheet($('lyric-input').value));$('lyric-status').textContent=result===false?'コード譜の読込を取り消しました。':'コードと歌詞を読み込みました。コードごと4拍の仮ガイドです。';}catch(error){$('lyric-status').textContent=error.message;}};
 return{
  use(next,title){
   if(next===key){$('lyric-song-title').textContent=title;return;}fileEpoch++;key=next;currentTime=0;manual=selected=0;
   let stored=null;try{stored=JSON.parse(localStorage.getItem(storage())||'null');}catch{}
   if(!stored&&next.startsWith('study:')){try{const legacy=JSON.parse(localStorage.getItem(`music-practice-local-lyrics-v1:${next.slice(6)}`)||'null');if(legacy?.text)stored=legacy;}catch{}}
   const preset=defaults[next];const text=typeof stored?.text==='string'?stored.text.slice(0,LYRIC_LIMIT):preset?.text||'';
   let parsed;try{parsed=readLyrics(text);$('lyric-status').textContent='この曲の歌詞と譜面の位置を合わせられます。';}catch(error){parsed={lines:[],cues:[]};$('lyric-status').textContent=`保存した歌詞を確認してください。${error.message}`;}
   const matches=preset?.text===parsed.lines.join('\n');
   data={lines:parsed.lines,cues:normalizeCues(stored?stored.cues||parsed.cues:parsed.cues.length?parsed.cues:preset?.cues,parsed.lines.length),notes:normalizeLyricNotes(Array.isArray(stored?.notes)?stored.notes:matches?preset?.notes:[],parsed.lines)};
   follow=!!data.cues.length&&stored?.follow!==false;credit=matches?preset.credit+(stored?.notes?' · 読み方・意味はこの端末の保存内容':''):stored?'この端末で入力した歌詞':'';$('lyric-input').value=text;$('lyric-song-title').textContent=title;$('lyric-restore').hidden=!preset;editor();
  },
  position(time){currentTime=Math.max(0,Number(time)||0);render();},
  hint(value){hint=value;render();},
  import(value){data={lines:readLyrics(value.text).lines,cues:normalizeCues(value.cues,readLyrics(value.text).lines.length)};follow=true;manual=selected=0;credit='この端末で入力した歌詞';$('lyric-input').value=value.text;persist();editor();},
  open(){ $('lyric-editor').open=true;$('lyric-editor').scrollIntoView({block:'center',behavior:'smooth'});}
 };
}
