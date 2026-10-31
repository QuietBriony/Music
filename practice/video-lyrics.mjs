import { mountLyrics } from './lyrics.mjs?v=25';

// Reuse the same bounded, local-only lyric editor with independent DOM ids.
export function mountVideoLyrics(host,prefix,{steps=false,onImport,onSheet=()=>{},getVideoTime=null}={}){
 const originals=[document.getElementById('session-lyrics'),document.getElementById('lyric-editor')],map=new Map();
 const copies=originals.map(node=>node.cloneNode(true));copies[0].className='video-lyric-card';copies[1].classList.remove('learning-card');
 for(const root of copies)for(const node of [root,...root.querySelectorAll('[id]')])if(node.id)map.set(node.id,`${prefix}-${node.id}`);
 for(const root of copies){for(const node of [root,...root.querySelectorAll('*')]){
  if(node.id)node.id=map.get(node.id);
  for(const attr of ['for','aria-labelledby','aria-describedby','aria-controls'])if(node.hasAttribute(attr))node.setAttribute(attr,node.getAttribute(attr).split(' ').map(id=>map.get(id)||id).join(' '));
  const href=node.getAttribute('href');if(href?.startsWith('#')&&map.has(href.slice(1)))node.setAttribute('href','#'+map.get(href.slice(1)));
 }host.append(root);}
 host.classList.add('video-lyrics');const $=id=>document.getElementById(`${prefix}-${id}`);
 const label=document.createElement('label'),clock=document.createElement('select'),hint=document.createElement('p');
 label.className='lyric-clock';label.append('歌詞を合わせる位置 ',clock);clock.id=`${prefix}-clock`;
 clock.replaceChildren(new Option('動画の位置','video'),...(steps?[new Option('コードの進行（1コード4拍の仮位置）','steps')]:[]));
 hint.className='small';hint.textContent='手元の歌詞・LRCを入れ、動画を止めて行を選び「この行を現在の位置に合わせる」でそろえられます。入力はこの端末だけに保存します。';$('lyric-editor').insertBefore(label,$('lyric-editor').querySelector('p'));
 $('lyric-editor').querySelector('summary').textContent='この曲の歌詞・位置合わせを編集';
 $('lyric-editor').querySelector('p').textContent=hint.textContent;
 $('chord-sheet-import').hidden=$('chord-sheet-import').disabled=!onImport;
 if(onImport)$('chord-sheet-import').textContent='コードと歌詞を練習に使う';
 let id='',context={videoTime:0,stepTime:0,ready:false},lastDisplay=null;
 const key=()=>`music-practice-lyric-clock-v1:${id}`;
 const applyClock=()=>{api.position(clock.value==='steps'?context.stepTime:context.videoTime,clock.value==='steps'?'コード進行':'動画');};
 const api=mountLyrics({prefix:`${prefix}-`,timelineLabel:'動画',importMessage:'コード順と歌詞を保存しました。歌詞は1コード4拍の仮位置で、コードの進行に合わせます。',onImport:async value=>{
  const result=await onImport(value);if(result===false)return false;clock.value='steps';try{localStorage.setItem(key(),'steps');}catch{}api.import(value);applyClock();$('lyric-editor').open=false;return true;
 },onDisplay:display=>{lastDisplay=display;$('lyric-mark').disabled=!display.hasLyrics||(clock.value==='video'&&!context.ready);onSheet(display.sheet,clock.value);}});
 const save=$('lyric-save').onclick;$('lyric-save').onclick=()=>{const previous=lastDisplay;save();if(lastDisplay!==previous)$('lyric-editor').open=false;};
 const mark=$('lyric-mark').onclick;$('lyric-mark').onclick=()=>{if(clock.value==='video'&&context.ready&&getVideoTime){const time=Number(getVideoTime());if(Number.isFinite(time)&&time>=0)context.videoTime=time;}applyClock();mark();};
 $('edit-lyrics').onclick=()=>api.open();
 clock.onchange=()=>{try{localStorage.setItem(key(),clock.value);}catch{}applyClock();};
 return{
  use(next,title){if(next!==id){$('lyric-editor').open=false;$('lyric-reference').open=false;$('lyric-overview').open=false;}id=next;context={videoTime:0,stepTime:0,ready:false};let saved;try{saved=localStorage.getItem(key());}catch{}clock.value=steps&&saved==='steps'?'steps':'video';api.use(next,title);api.hint({primary:'歌詞は動画で見るか、手元の歌詞を下の編集欄へ。',secondary:'動画の位置に合わせると、この曲の歌詞も自動で進みます。'});applyClock();},
  position(value){context=value;applyClock();},
  open(){api.open();},
  get sheet(){return lastDisplay?.sheet;},get clock(){return clock.value;}
 };
}
