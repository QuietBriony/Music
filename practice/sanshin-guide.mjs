import { mountVideoLyrics } from './video-lyrics.mjs?v=36';
import { SANSHIN_PLAYLIST } from './sanshin-playlist.mjs?v=36';
import { SANSHIN_POSITIONS, sanshinPosition, positionTip } from './sanshin-core.mjs?v=36';
import { neckDiagram,handDiagram } from './sanshin-view.mjs?v=36';
import { lessonPlayer } from './youtube.mjs?v=36';
export const SANSHIN_VIDEOS = Object.fromEntries(SANSHIN_PLAYLIST.tracks.map(t=>[t.id,t]));
import { SANSHIN_MATERIALS,ANATA_PERFORMANCE,ANATA_LESSON,sanshinMaterialChoice,sanshinSessionKey,sanshinLyricKey,lessonChapter } from './sanshin-materials.mjs?v=36';
import { lessonWindow,lessonRange,performanceProgress,sanshinSession,addLessonMark } from './sanshin-session.mjs?v=36';
const preferenceKey='music-practice-sanshin-material-anata-v1';
const timeLabel=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
export function mountSanshinGuide({onTakeOver}) {
  const $=id=>document.getElementById(`sanshin-${id}`),dialog=$('dialog');
  const lyrics=mountVideoLyrics($('lyrics-host'),'sanshin-video-lyrics',{getVideoTime:currentTime});
  let song=null,variant='original',player=null,ready=false,ticket=0,timer=null,position=0,a=0,b=0,loop=false,shown='合',rate=1,repeatSeconds=10,marks=[];
  const materialForSong=()=>song==='anata-ni'&&variant==='original'?ANATA_LESSON:SANSHIN_MATERIALS[song];
  const courseForSong=()=>song==='anata-ni'&&variant==='performance'?{...SANSHIN_VIDEOS[song],...ANATA_PERFORMANCE}:SANSHIN_VIDEOS[song];
  const shortLandscape=matchMedia('(max-height:500px) and (orientation:landscape)');
  function enlarge(value){dialog.dataset.enlarged=String(!!value&&!!song&&dialog.dataset.reading==='score');const active=dialog.dataset.enlarged==='true';$('enlarge').setAttribute('aria-pressed',String(active));$('enlarge').textContent=active?'メニュー':'大きく';$('enlarge').setAttribute('aria-label',active?'練習メニューも表示':'工工四の動画を大きく表示');$('dialog-body').scrollTop=0;}
  $('enlarge').onclick=()=>enlarge(dialog.dataset.enlarged!=='true');
  shortLandscape.addEventListener('change',()=>{if(dialog.open)enlarge(shortLandscape.matches);});
  function status(text){$('video-status').textContent=text;}
  function remember(){
    if(!song)return false;
    try{localStorage.setItem(sanshinSessionKey(song,variant),JSON.stringify({position,a,b,loop,rate,repeatSeconds,marks}));return true;}catch{return false;}
  }
  function currentTime(){const t=Number(player?.getCurrentTime?.());return Number.isFinite(t)&&t>=0?t:position;}
  function controls(){
    $('load').hidden=ready;
    for(const id of ['play','pause','back','speed','a','b','score-start'])$(id).disabled=!ready;
    // YouTube seekTo may play a merely cued video. Rewind only an already playing/paused video.
    $('back').disabled=!ready||![1,2].includes(player?.getPlayerState?.());
    const duration=Number(player?.getDuration?.())||0;
    const window=lessonWindow(materialForSong(),loop?a:position,duration),range=ready?lessonRange(materialForSong(),position,duration,repeatSeconds):null;
    $('seek').disabled=!ready||duration<1;$('phrase').disabled=!range;$('mark').disabled=!ready;
    $('phrase-next').disabled=!ready||!loop||b-a<1||b>=window.end-1;
    $('phrase-previous').disabled=!ready||!loop||b-a<1||a<=window.start;
    $('continue').disabled=!ready||!loop;
    $('quick-repeat').disabled=!range;$('quick-continue').disabled=$('continue').disabled;
    $('quick-repeat').textContent=loop?'範囲を替える':`${repeatSeconds}秒反復`;$('quick-repeat').setAttribute('aria-pressed',String(loop));
    $('repeat-length').value=String(repeatSeconds);$('phrase').textContent=`ここから${repeatSeconds}秒を反復`;$('phrase-next').textContent=`次の${repeatSeconds}秒へ →`;
    $('seek').max=duration||1;if(document.activeElement!==$('seek'))$('seek').value=position;
    $('loop').disabled=!ready||b-a<1;$('loop').checked=loop;
    $('loop-state').textContent=loop&&b-a>=1?`反復中 · ${timeLabel(a)} → ${timeLabel(b)}`:'短く繰り返し、慣れたら先へ';
    const material=materialForSong(),chapter=lessonChapter(material,position);for(const [i,button] of [...$('chapters').children].entries())button.setAttribute('aria-current',String(chapter?.index===i));$('chapter-state').textContent=chapter?`${chapter.label}${chapter.next?' · 次は '+chapter.next[1]:''}`:'';
    $('video-time').textContent=`${timeLabel(position)} / ${timeLabel(duration)}`;lyrics.position({videoTime:position,stepTime:0,ready});
    const progress=performanceProgress(material,position);$('performance-progress').hidden=!progress;
    $('progress-label').textContent=!progress?'レッスンの位置':progress.phase==='lesson'?`解説中 · 通しは${timeLabel(material.start)}から`:progress.phase==='ended'?'通し練習おわり':'通し練習の位置';
    $('performance-time').textContent=progress?`${timeLabel(progress.elapsed)} / ${timeLabel(progress.duration)}`:timeLabel(position);
    if(progress)$('performance-progress').value=progress.ratio;
  }
  function renderMarks(){
    $('marks').replaceChildren(...marks.map((mark,index)=>{const row=document.createElement('div'),jump=document.createElement('button'),remove=document.createElement('button');
      jump.textContent=`${index+1} · ${timeLabel(mark.time)}${mark.end!==null?' → '+timeLabel(mark.end):''}`;jump.setAttribute('aria-label',`しおり ${index+1}、${timeLabel(mark.time)}から${mark.end!==null?'反復':'確認'}`);
      jump.onclick=()=>{pause();position=mark.time;a=mark.time;b=mark.end??0;loop=b-a>=1;if(ready)seek(position);else{remember();controls();}status(ready?'しおりの場所に戻りました。「再生」で練習できます。':'しおりの場所を選びました。「動画を読み込む」で準備できます。');};
      remove.textContent='×';remove.setAttribute('aria-label',`しおり ${index+1}を削除`);remove.onclick=()=>{marks=marks.filter((_,i)=>i!==index);remember();renderMarks();$('mark-status').textContent='しおりを外しました。';};row.append(jump,remove);return row;
    }));
  }
  function destroy(){
    ticket++;clearInterval(timer);timer=null;
    if(ready){position=currentTime();remember();}
    ready=false;const old=player;player=null;try{old?.destroy();}catch{/* Detached iframe. */}
    $('player').replaceChildren();$('load').disabled=false;controls();
  }
  function pause(){if(ready){player.pauseVideo();position=currentTime();remember();controls();}}
  function readingMode(mode){
    if(mode==='score'&&!song)return;dialog.dataset.reading=mode;
    $('enlarge').hidden=mode!=='score';enlarge(mode==='score'&&shortLandscape.matches);
    $('score-view').setAttribute('aria-pressed',String(mode==='score'));$('finger-view').setAttribute('aria-pressed',String(mode==='finger'));
    if(mode==='finger'){pause();$('finger-panel').scrollIntoView({block:'start',behavior:'instant'});status('動画を止めました。工工四の文字を選んで指を確認できます。');}
    else{$('dialog-body').scrollTop=0;status('動画内の工工四・歌詞を見て練習します。再生は自分で開始してください。');}
  }
  $('score-view').onclick=()=>readingMode('score');$('finger-view').onclick=()=>readingMode('finger');
  function showSymbol(symbol){
    const p=sanshinPosition(symbol);if(!p)return;shown=p.symbol;
    $('symbol').textContent=p.symbol;$('reading').textContent=`${p.reading} · ${p.position}`;
    $('neck').innerHTML=neckDiagram(p.symbol);$('hand').innerHTML=handDiagram(p.symbol);
    $('finger').textContent=p.finger?`${p.finger} ${p.fingerName}`:'○ 左手は押さえない';
    $('tip').textContent=positionTip(p);
    for(const button of $('letters').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.symbol===p.symbol));
  }
  $('letters').replaceChildren(...SANSHIN_POSITIONS.map(p=>{
    const button=document.createElement('button');button.textContent=p.symbol;button.dataset.symbol=p.symbol;button.setAttribute('aria-label',`${p.symbol} ${p.reading} ${p.position}`);
    button.onclick=()=>{pause();showSymbol(p.symbol);if(song)status('動画を止めて、指を確認しています。続きは「再生」で。');};return button;
  }));
  async function load(){
    if(!song||!dialog.open)return;
    destroy();const own=ticket,course=courseForSong();
    $('load').disabled=true;status('YouTubeの動画を読み込んでいます…');
    try{
      const instance=await lessonPlayer($('player'),course.video,{
        onReady:event=>{
          if(own!==ticket||!dialog.open){event.target.destroy();return;}
          player=event.target;ready=true;
          const duration=Number(player.getDuration());
          position=Math.max(0,Math.min(position,Number.isFinite(duration)&&duration>0?duration-1:position));
          if(duration>0&&b>duration){b=0;loop=false;}
          const rates=player.getAvailablePlaybackRates?.()||[1];
          const available=rates.filter(r=>[.5,.75,1].includes(r));if(!available.length)available.push(1);if(!available.includes(rate))rate=available.at(-1);
          $('speed').replaceChildren(...available.map(r=>new Option(r===1?'ふつう':`${r}倍`,r)));$('speed').value=String(rate);player.setPlaybackRate(rate);
          controls();status('準備できました。「再生」で始めます。動画の調弦を確かめて合わせましょう。');
          timer=setInterval(()=>{
            if(!ready||own!==ticket)return;position=currentTime();
            if(loop&&b-a>=1&&player.getPlayerState()===1&&position>=b){player.seekTo(a,true);position=a;}else if(!loop&&$('finish-stop').checked&&materialForSong()?.end&&position>=materialForSong().end&&player.getPlayerState()===1){player.pauseVideo();remember();status('教材の演奏が終わりました。「最初から通して弾く」で、もう一度練習できます。');}
            controls();
          },200);
        },
        onStateChange:event=>{if(own===ticket&&ready&&(event.data===2||event.data===0)){position=currentTime();remember();}},
        onError:()=>{if(own!==ticket)return;destroy();enlarge(false);$('material-details').open=true;status('動画を開けませんでした。下の「YouTubeで見る」から再生できます。');}
      },()=>own===ticket&&dialog.open,position);
      if(own!==ticket){try{instance?.destroy();}catch{/* Cancelled. */}return;}
      player=instance;
    }catch{if(own===ticket){destroy();enlarge(false);$('material-details').open=true;status('動画を読み込めませんでした。通信を確認するか、下の「YouTubeで見る」から開いてください。');}}
  }
  function seek(time){
    if(!ready)return;const playing=player.getPlayerState()===1;position=Math.max(0,Math.min(Number(player.getDuration())||0,time));
    player.seekTo(position,true);if(!playing)player.pauseVideo();remember();controls();
  }
  function repeatFrom(time){const range=lessonRange(materialForSong(),time,Number(player?.getDuration?.()),repeatSeconds);if(!range)return;a=range.a;b=range.b;loop=true;seek(a);status(`${repeatSeconds}秒を目安に反復します。慣れたら「できた・この先を弾く」で続きへ。`);}
  $('seek').onchange=()=>{loop=false;seek($('seek').valueAsNumber);};
  $('phrase').onclick=()=>{if(ready)repeatFrom(currentTime());};
  $('phrase-next').onclick=()=>{if(ready)repeatFrom(b);};
  $('phrase-previous').onclick=()=>{if(ready)repeatFrom(Math.max(lessonWindow(materialForSong(),a,Number(player.getDuration())).start,a-repeatSeconds));};
  $('repeat-length').onchange=()=>{repeatSeconds=Number($('repeat-length').value);if(ready&&loop)repeatFrom(a);else{remember();controls();}};
  $('continue').onclick=()=>{if(!ready||!loop)return;const next=b;loop=false;seek(next);if($('finish-stop').checked&&materialForSong()?.end&&next>=materialForSong().end){pause();status('教材の演奏を最後まで練習しました。もう一度なら「最初から通して弾く」で。');}else{player.playVideo();status('反復を終えて、次の場所から続けています。');}};
  $('quick-repeat').onclick=()=>{if(!ready)return;if(loop){enlarge(false);document.querySelector('.sanshin-repeat-card').scrollIntoView({block:'start',behavior:'instant'});}else repeatFrom(currentTime());};
  $('quick-continue').onclick=()=>{$('continue').click();$('dialog-body').scrollTop=0;};
  $('mark').onclick=()=>{if(!ready)return;const result=addLessonMark(marks,loop?a:currentTime(),loop?b:null);marks=result.marks;const saved=remember();renderMarks();$('mark-status').textContent=!saved?'端末に保存できません。この画面を閉じるまではしおりを使えます。':result.reason==='added'?'この教材のしおりを端末に保存しました。':result.reason==='duplicate'?'この場所は保存済みです。':result.reason==='full'?'しおりは12個まで。不要なしおりを外して追加できます。':'この位置は保存できません。';};
  $('load').onclick=load;
  $('play').onclick=()=>{if(ready){if(loop&&(currentTime()<a||currentTime()>=b))player.seekTo(a,true);else if($('finish-stop').checked&&materialForSong()?.end&&currentTime()>=materialForSong().end)player.seekTo(materialForSong().start,true);player.playVideo();$('dialog-body').scrollTop=0;status('再生中。分からない文字を押すと一時停止して指を確認できます。');}};
  $('pause').onclick=()=>{pause();status('一時停止しています。');};
  $('back').onclick=()=>{if(ready)seek(Math.max(0,currentTime()-5));};
  $('score-start').onclick=()=>{if(!song)return;loop=false;const start=materialForSong()?.start||0;position=start;if(ready){seek(start);player.playVideo();$('dialog-body').scrollTop=0;}else remember();controls();status(ready?'通し演奏から再生しています。工工四と歌詞は動画内で進みます。':'通し演奏の位置を選びました。「動画を読み込む」で準備できます。');};
  $('speed').onchange=()=>{if(ready){rate=Number($('speed').value);player.setPlaybackRate(rate);remember();}};
  $('a').onclick=()=>{a=currentTime();if(b-a<1){b=0;loop=false;}remember();controls();};
  $('b').onclick=()=>{const end=currentTime();if(end-a<1){status('Aより1秒以上先をBにしてください。');return;}b=end;loop=true;remember();controls();};
  $('loop').onchange=()=>{loop=$('loop').checked&&b-a>=1;remember();controls();};
  $('close').onclick=()=>dialog.close();dialog.addEventListener('close',destroy);
  for(const id of ['source','outside','fingering-source','score-source'])$(id).addEventListener('click',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){destroy();status('画面を離れたので停止しました。「動画を読み込む」で再開できます。');}});
  window.addEventListener('pagehide',destroy);
  function open(id=null,symbol='合',requested){
      onTakeOver();destroy();song=Object.hasOwn(SANSHIN_VIDEOS,id)?id:null;
      let preference=null,hasOld=false;try{preference=localStorage.getItem(preferenceKey);hasOld=!!localStorage.getItem(sanshinSessionKey(song,'original'));}catch{}
      variant=sanshinMaterialChoice(song,preference,hasOld,requested);if(song==='anata-ni')try{localStorage.setItem(preferenceKey,variant);}catch{}
      $('material-choice').hidden=song!=='anata-ni';$('material').value=variant;
      let stored=null;if(song)try{stored=JSON.parse(localStorage.getItem(sanshinSessionKey(song,variant))||'null');}catch{}
      ({position,a,b,loop,rate,repeatSeconds,marks}=sanshinSession(stored,materialForSong()));renderMarks();$('mark-status').textContent=marks.length?'この教材に保存したしおりです。':'場所だけを端末に保存。動画や歌詞は保存しません。';
      const course=courseForSong();$('video').hidden=!course;
      $('reading-controls').hidden=!course;dialog.dataset.reading=course?'score':'finger';$('score-view').setAttribute('aria-pressed',String(!!course));$('finger-view').setAttribute('aria-pressed',String(!course));
      $('enlarge').hidden=!course;enlarge(shortLandscape.matches);
      $('transport').hidden=!course;$('score-start').hidden=!course;$('score-start').textContent='最初から通して弾く';$('finish-stop').checked=true;$('material-details').open=false;
      const material=materialForSong();$('chapters').replaceChildren(...(material?.chapters||[]).map(([time,label])=>{const button=document.createElement('button');button.type='button';button.textContent=`${timeLabel(time)} ${label}`;button.onclick=()=>{loop=false;if(ready){pause();seek(time);}else{position=time;remember();controls();}status('練習する場所を選びました。再生は自分で始めてください。');};return button;}));
      $('score-source').hidden=$('score-source-note').hidden=!course;
      if(course){$('score-source').href=course.sheets[0].url;$('score-source').textContent=course.sheets[0].label+' ↗';$('score-source-note').textContent=course.note;}
      $('extra-sheets').replaceChildren(...(course?.sheets.slice(1)||[]).map(sheet=>{const a=document.createElement('a');a.href=sheet.url;a.textContent=sheet.label+' ↗';a.target='_blank';a.rel='noopener';a.onclick=pause;return a;}));
      $('video-note').textContent=course?`${material?.tuning||'動画の調弦に合わせてから始めましょう。'} ${material?.scope||''} ページは教材の演奏に合わせて自動で切り替わります。`:'';
      $('title').textContent=course?`${course.title} · 工工四と弾き語り`:'工工四から、指の位置を調べる';
      if(course){$('source').href=course.source;$('source').textContent=`先生の掲載ページ（${course.credit}） ↗`;$('outside').href=`https://www.youtube.com/watch?v=${course.video}`;}
      lyrics.use(song?sanshinLyricKey(song,variant):'video:sanshin:lookup',course?.title||'工工四の指の確認',{inVideo:!!course});$('lyrics-host').hidden=!course;showSymbol(symbol);controls();status('「動画を読み込む」を押した時だけYouTubeへ接続します。');
      if(!dialog.open)dialog.showModal();$('dialog-body').scrollTop=0;
  }
  $('material').onchange=()=>open(song,shown,$('material').value);
  return {open,
    close(){if(dialog.open)dialog.close();destroy();},
    pause,
    get symbol(){return shown;}
  };
}
