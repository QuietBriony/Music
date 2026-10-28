import { CHORDS } from './chords.mjs?v=5';
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
export function mountLyrics({defaults={},onImport}){
 const $=id=>document.getElementById(id);let key='',data={lines:[],cues:[]},manual=0,selected=0,currentTime=0,follow=true,credit='';
 const storage=()=>`music-practice-session-lyrics-v2:${key}`;
 function persist(){try{localStorage.setItem(storage(),JSON.stringify({version:2,text:data.lines.join('\n'),cues:data.cues,follow}));return true;}catch{return false;}}
 function render(){
  const current=follow?lyricAt(data.cues,currentTime):manual;
  const active=current<0?0:Math.min(data.lines.length-1,current);
  $('session-lyric-current').textContent=data.lines[active]||'歌詞を入れると、演奏に合わせてここに表示できます。';
  $('session-lyric-next').textContent=data.lines[active+1]||'';
  $('session-lyric-status').textContent=!data.lines.length?'歌詞未入力':follow&&data.cues.length?`${active+1} / ${data.lines.length} · 譜面に追従`:`${active+1} / ${data.lines.length} · 手動`;
  $('lyric-current').textContent=data.lines[active]||'歌詞を貼り付けて、表示する行を選べます。';$('lyric-position').textContent=data.lines.length?`${active+1} / ${data.lines.length}`:'未入力';
  $('lyric-prev').disabled=!data.lines.length||active<=0;$('lyric-next').disabled=!data.lines.length||active>=data.lines.length-1;
  $('lyric-follow').checked=follow;$('lyric-mark').disabled=!data.lines.length;
  $('lyric-time').textContent=`譜面の位置 ${currentTime.toFixed(2)} 秒`;
  $('lyric-credit').textContent=credit;
 }
 function editor(){
  $('lyric-line').replaceChildren(...data.lines.map((line,i)=>new Option(`${i+1}. ${line.slice(0,50)}`,i)));selected=Math.min(selected,Math.max(0,data.lines.length-1));$('lyric-line').value=selected;
  $('lyric-cues').textContent=data.cues.length?data.cues.map(c=>`${c.line+1}行目 ${c.time.toFixed(2)}秒`).join(' / '):'時刻なし。「この行を現在の位置に合わせる」かLRCで設定できます。';render();
 }
 $('lyric-save').onclick=()=>{try{const parsed=readLyrics($('lyric-input').value),same=parsed.lines.join('\n')===data.lines.join('\n');data={lines:parsed.lines,cues:parsed.cues.length?parsed.cues:same?normalizeCues(data.cues,parsed.lines.length):[]};manual=selected=0;follow=!!data.cues.length;credit='この端末で入力した歌詞';$('lyric-status').textContent=(persist()?'この端末に保存しました。':'表示しました。端末保存はできませんでした。')+(parsed.warnings.join(' '));editor();}catch(error){$('lyric-status').textContent=error.message;}};
 $('lyric-clear').onclick=()=>{data={lines:[],cues:[]};manual=selected=0;$('lyric-input').value='';credit='';follow=false;persist();if(key.startsWith('study:'))try{localStorage.removeItem(`music-practice-local-lyrics-v1:${key.slice(6)}`);}catch{}editor();$('lyric-status').textContent='この曲の歌詞を端末から削除しました。';};
 $('lyric-restore').onclick=()=>{const preset=defaults[key];if(!preset)return;data={lines:readLyrics(preset.text).lines,cues:normalizeCues(preset.cues,200)};credit=preset.credit;follow=true;manual=selected=0;$('lyric-input').value=preset.text;persist();editor();};
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
   if(next===key){$('lyric-song-title').textContent=title;return;}key=next;currentTime=0;manual=selected=0;
   let stored=null;try{stored=JSON.parse(localStorage.getItem(storage())||'null');}catch{}
   if(!stored&&next.startsWith('study:')){try{const legacy=JSON.parse(localStorage.getItem(`music-practice-local-lyrics-v1:${next.slice(6)}`)||'null');if(legacy?.text)stored=legacy;}catch{}}
   const preset=defaults[next];const text=typeof stored?.text==='string'?stored.text.slice(0,LYRIC_LIMIT):preset?.text||'';
   let parsed;try{parsed=readLyrics(text);$('lyric-status').textContent='この曲の歌詞と譜面の位置を合わせられます。';}catch(error){parsed={lines:[],cues:[]};$('lyric-status').textContent=`保存した歌詞を確認してください。${error.message}`;}
   data={lines:parsed.lines,cues:normalizeCues(stored?.cues||parsed.cues.length&&parsed.cues||preset?.cues,parsed.lines.length)};
   follow=!!data.cues.length&&stored?.follow!==false;credit=stored?'この端末で入力した歌詞':preset?.credit||'';$('lyric-input').value=text;$('lyric-song-title').textContent=title;$('lyric-restore').hidden=!preset;editor();
  },
  position(time){currentTime=Math.max(0,Number(time)||0);render();},
  import(value){data={lines:readLyrics(value.text).lines,cues:normalizeCues(value.cues,readLyrics(value.text).lines.length)};follow=true;manual=selected=0;credit='この端末で入力した歌詞';$('lyric-input').value=value.text;persist();editor();},
  open(){ $('lyric-editor').open=true;$('lyric-editor').scrollIntoView({block:'center',behavior:'smooth'});}
 };
}
