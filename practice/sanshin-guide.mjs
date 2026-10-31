import { mountVideoLyrics } from './video-lyrics.mjs?v=24';
import { SANSHIN_PLAYLIST } from './sanshin-playlist.mjs?v=24';
import { SANSHIN_POSITIONS, sanshinPosition, positionTip } from './sanshin-core.mjs?v=24';
import { neckDiagram,handDiagram } from './sanshin-view.mjs?v=24';
import { lessonPlayer } from './youtube.mjs?v=24';
export const SANSHIN_VIDEOS = Object.fromEntries(SANSHIN_PLAYLIST.tracks.map(t=>[t.id,t]));
const storageKey=id=>`music-practice-sanshin-video-${id}-v1`;
const timeLabel=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
export function mountSanshinGuide({onTakeOver}) {
  const $=id=>document.getElementById(`sanshin-${id}`),dialog=$('dialog');
  const lyrics=mountVideoLyrics($('lyrics-host'),'sanshin-video-lyrics',{getVideoTime:currentTime});
  let song=null,player=null,ready=false,ticket=0,timer=null,position=0,a=0,b=0,loop=false,shown='合';
  function status(text){$('video-status').textContent=text;}
  function remember(){
    if(!song)return;
    try{localStorage.setItem(storageKey(song),JSON.stringify({position,a,b,loop}));}catch{/* Optional storage. */}
  }
  function currentTime(){const t=Number(player?.getCurrentTime?.());return Number.isFinite(t)&&t>=0?t:position;}
  function controls(){
    for(const id of ['play','pause','back','speed','a','b','score-start'])$(id).disabled=!ready;
    // YouTube seekTo may play a merely cued video. Rewind only an already playing/paused video.
    $('back').disabled=!ready||![1,2].includes(player?.getPlayerState?.());
    $('loop').disabled=!ready||b-a<1;$('loop').checked=loop;
    $('loop-state').textContent=b-a>=1?`${timeLabel(a)} → ${timeLabel(b)}`:'始めと終わりをA・Bで指定';
    $('video-time').textContent=timeLabel(position);lyrics.position({videoTime:position,stepTime:0,ready});
  }
  function destroy(){
    ticket++;clearInterval(timer);timer=null;
    if(ready){position=currentTime();remember();}
    ready=false;const old=player;player=null;try{old?.destroy();}catch{/* Detached iframe. */}
    $('player').replaceChildren();$('load').disabled=false;controls();
  }
  function pause(){if(ready){player.pauseVideo();position=currentTime();remember();controls();}}
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
    destroy();const own=ticket,id=song,course=SANSHIN_VIDEOS[id];
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
          $('speed').replaceChildren(...rates.filter(r=>r>=.5&&r<=1).map(r=>new Option(r===1?'ふつう':`${r}倍`,r)));$('speed').value='1';
          controls();status('準備できました。「再生」で始めます。動画の調弦を確かめて合わせましょう。');
          timer=setInterval(()=>{
            if(!ready||own!==ticket)return;position=currentTime();
            if(loop&&b-a>=1&&player.getPlayerState()===1&&position>=b){player.seekTo(a,true);position=a;}
            controls();
          },200);
        },
        onStateChange:event=>{if(own===ticket&&ready&&(event.data===2||event.data===0)){position=currentTime();remember();}},
        onError:()=>{if(own!==ticket)return;destroy();status('動画を開けませんでした。下の「YouTubeで見る」から再生できます。');}
      },()=>own===ticket&&dialog.open,position);
      if(own!==ticket){try{instance?.destroy();}catch{/* Cancelled. */}return;}
      player=instance;
    }catch{if(own===ticket){destroy();status('動画を読み込めませんでした。通信を確認するか、YouTubeで開いてください。');}}
  }
  $('load').onclick=load;
  $('play').onclick=()=>{if(ready){if(loop&&(currentTime()<a||currentTime()>=b))player.seekTo(a,true);player.playVideo();status('再生中。分からない文字を押すと一時停止して指を確認できます。');}};
  $('pause').onclick=()=>{pause();status('一時停止しています。');};
  $('back').onclick=()=>{if(ready){position=Math.max(0,currentTime()-5);player.seekTo(position,true);remember();controls();}};
  $('score-start').onclick=()=>{if(ready&&SANSHIN_VIDEOS[song]?.scoreAt){loop=false;position=SANSHIN_VIDEOS[song].scoreAt;player.seekTo(position,true);player.playVideo();remember();controls();status('前奏の工工四から再生しています。分からない文字を押すと止められます。');}};
  $('speed').onchange=()=>{if(ready)player.setPlaybackRate(Number($('speed').value));};
  $('a').onclick=()=>{a=currentTime();if(b-a<1){b=0;loop=false;}remember();controls();};
  $('b').onclick=()=>{const end=currentTime();if(end-a<1){status('Aより1秒以上先をBにしてください。');return;}b=end;loop=true;remember();controls();};
  $('loop').onchange=()=>{loop=$('loop').checked&&b-a>=1;remember();controls();};
  $('close').onclick=()=>dialog.close();dialog.addEventListener('close',destroy);
  for(const id of ['source','outside','fingering-source','score-source'])$(id).addEventListener('click',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){destroy();status('画面を離れたので停止しました。「動画を読み込む」で再開できます。');}});
  window.addEventListener('pagehide',destroy);
  return {
    open(id=null,symbol='合'){
      onTakeOver();destroy();song=Object.hasOwn(SANSHIN_VIDEOS,id)?id:null;position=a=b=0;loop=false;
      if(song){try{const saved=JSON.parse(localStorage.getItem(storageKey(song))||'{}');position=Number.isFinite(saved.position)?Math.max(0,saved.position):0;a=Number.isFinite(saved.a)?Math.max(0,saved.a):0;b=Number.isFinite(saved.b)?Math.max(0,saved.b):0;loop=saved.loop===true&&b-a>=1;}catch{/* Start fresh. */}}
      const course=SANSHIN_VIDEOS[song];$('video').hidden=!course;
      $('score-start').hidden=!course?.scoreAt;
      $('score-source').hidden=$('score-source-note').hidden=!course;
      if(course){$('score-source').href=course.sheets[0].url;$('score-source').textContent=course.sheets[0].label+' ↗';$('score-source-note').textContent=course.note;}
      $('extra-sheets').replaceChildren(...(course?.sheets.slice(1)||[]).map(sheet=>{const a=document.createElement('a');a.href=sheet.url;a.textContent=sheet.label+' ↗';a.target='_blank';a.rel='noopener';a.onclick=pause;return a;}));
      $('video-note').textContent=song==='jidai'?'初めに先生の解説、途中から工工四と歌詞が表示されます。「前奏から再生」で3:30から始められます。動画と同じ調弦に合わせ、まず短い部分を繰り返しましょう。':'先生の動画を聴いて、同じ調弦に合わせます。工工四は動画や先生の掲載ページで確認できます。';
      $('title').textContent=course?`${course.title} · 動画と指の位置`:'工工四から、指の位置を調べる';
      if(course){$('source').href=course.source;$('source').textContent=`先生の掲載ページ（${course.credit}） ↗`;$('outside').href=`https://www.youtube.com/watch?v=${course.video}`;}
      lyrics.use(song?`video:sanshin:${song}`:'video:sanshin:lookup',course?.title||'工工四の指の確認');$('lyrics-host').hidden=!course;showSymbol(symbol);controls();status('「動画を読み込む」を押した時だけYouTubeへ接続します。');
      if(!dialog.open)dialog.showModal();$('dialog-body').scrollTop=0;
    },
    close(){if(dialog.open)dialog.close();destroy();},
    pause,
    get symbol(){return shown;}
  };
}
