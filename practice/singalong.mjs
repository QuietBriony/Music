import { mountVideoLyrics } from './video-lyrics.mjs?v=23';
import { scoreLyricAnnotations,setScoreLyric } from './score-lyrics.mjs?v=23';
import { songSupport } from './song-support.mjs?v=23';
import { MicInputBoost } from './mic-input.mjs?v=23';
import { cueAt } from './video-cues.mjs?v=23';
import { PREPARED_COURSES,courseState } from './singalong-courses.mjs?v=23';
import { STUDIES } from './learning.mjs?v=23';
import { SING_SHAPES,readSteps,videoId,validRange,fingeringText,sectionStarts } from './singalong-core.mjs?v=23';
import { detectChord,ChordGate } from './polyphonic.mjs?v=23';
import { lessonPlayer } from './youtube.mjs?v=23';
const STORAGE='music-practice-singalong-v1';
const lessons=STUDIES.guitar.map(s=>({...s,instrument:'guitar',video:PREPARED_COURSES[s.id]?.url||s.video||s.lesson}));
const text=(id,value)=>{const e=document.getElementById(id);if(e.textContent!==String(value))e.textContent=value;};
const $=id=>document.getElementById(id);
export function mountSingalong({onTakeOver,onChange,onHandGuide,onWarmup}){
 let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{}
 let selected=lessons.find(s=>s.id===saved.selected)||lessons[0],steps=[],course=null,customOrder='',state={},active=false,player=null,ready=false,playerTicket=0,timer=null;
 let inputTicket=0,stream=null,ctx=null,source=null,analyser=null,silent=null,meter=null,inputBoost=null;
 const gate=new ChordGate();let trackAnnotation=null;document.querySelector('.sing-workspace').append($('sing-lyrics-host'));
 const lyrics=mountVideoLyrics($('sing-lyrics-host'),'sing-lyrics',{steps:true,getVideoTime:()=>ready?player?.getCurrentTime?.():state.videoTime||0,onImport:async value=>{
  pause();steps=readSteps(value.names.join(' '));customOrder=value.names.join(' ');$('sing-code-input').value=customOrder;state.follow=false;state.index=0;store();makeTrack();render();return true;
 },onSheet:(sheet,clock)=>annotateTrack(sheet,clock)});
 function annotateTrack(sheet,clock){
  const times=clock==='video'&&canFollow()?course.times:null;
  if(trackAnnotation?.steps===steps&&trackAnnotation.lines===sheet.lines&&trackAnnotation.cues===sheet.cues&&trackAnnotation.clock===clock&&trackAnnotation.times===times&&trackAnnotation.offset===state.offset)return;
  const annotations=clock==='video'?steps.map(()=>({text:'',line:-1,kind:'line'})):scoreLyricAnnotations(steps.map((s,i)=>({time:i*4*60/85})),sheet);if(clock==='video'&&times)for(const cue of sheet.cues||[]){const i=cueAt(times,cue.time,state.offset,course.end)?.index;if(Number.isInteger(i)&&sheet.lines[cue.line]){annotations[i].text+=(annotations[i].text?' / ':'')+sheet.lines[cue.line];annotations[i].line=cue.line;}}
  [...$('sing-chord-track').children].forEach((cell,i)=>setScoreLyric(cell,annotations[i]));trackAnnotation={steps,lines:sheet.lines,cues:sheet.cues,clock,times,offset:state.offset};
 }
 function lyricPosition(){lyrics.position({videoTime:ready?Number(player?.getCurrentTime?.())||0:state.videoTime||0,stepTime:state.index*4*60/85,ready});}
 function revealTrack(){const v=$('sing-chord-track'),cell=v.querySelector('[aria-current="true"]');if(!cell||!v.clientHeight)return;const a=v.getBoundingClientRect(),b=cell.getBoundingClientRect();if(b.top<a.top||b.bottom>a.bottom)v.scrollTo({top:v.scrollTop+b.top-a.top-18,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 new ResizeObserver(revealTrack).observe($('sing-chord-track'));
 const status=value=>text('sing-status',value);
 const canFollow=()=>!!course&&videoId(selected.video)===course.video&&steps===course.steps;
 const following=()=>canFollow()&&state.follow;
 const finishedVideo=()=>following()&&cueAt(course.times,state.videoTime,state.offset,course.end)?.ended;
 const modeMessage=()=>following()?'動画に合わせて今のコード図が自動で切り替わります。マイクは今のコードの確認に使えます。':'コード図は手動か自分の演奏で進みます。動画の音はイヤホンで聴いてください。';
 function followVideo(){
  if(!ready||!active||!following())return;
  const time=player.getCurrentTime();if(!Number.isFinite(time))return;
  state.videoTime=time;const cue=cueAt(course.times,time,state.offset,course.end);
  if(state.index!==cue.index){state.index=cue.index;gate.reset();store();render();}
  text('sing-next-countdown',cue.ended?'演奏おわり':cue.remaining===null?'最後のコード':`あと${cue.remaining.toFixed(1)}秒`);
  if(cue.ended&&(ctx||stream)){stopInput();status('通し演奏が終わりました。巻き戻すと、その場所のコード図に戻ります。');}
  const label=cue.ended?'演奏おわり':'今押さえるコード';text('sing-target-label',label);
  $('sing-mic').disabled=cue.ended||!!ctx||finishedVideo();
 }
 function seekStep(index){
  stopInput();state.index=Math.max(0,Math.min(steps.length-1,index));
  if(following()){state.videoTime=Math.max(0,course.times[state.index]-state.offset);if(ready)player.seekTo(state.videoTime,true);}
  store();render();
 }

 const store=()=>{try{const bySong={...(saved.bySong||{}),[selected.id]:{timeline:canFollow()?course.key:null,index:state.index,capo:state.capo,a:state.a,b:state.b,follow:state.follow,offset:state.offset,videoTime:state.videoTime,custom:customOrder}};saved={selected:selected.id,bySong};localStorage.setItem(STORAGE,JSON.stringify(saved));return true;}catch{status('この端末に保存できません。今の画面では練習を続けられます。');return false;}};
 function stopInput(){
  inputTicket++;clearInterval(meter);meter=null;stream?.getTracks().forEach(t=>t.stop());stream=null;
  for(const node of [source,analyser,silent])try{node?.disconnect();}catch{}source=analyser=silent=null;
  const old=ctx;ctx=null;if(old&&old.state!=='closed')old.close().catch(()=>{});
  inputBoost?.disconnect();inputBoost=null;gate.reset();$('sing-mic').disabled=!steps.length||state.index>=steps.length||finishedVideo();$('sing-mic-stop').disabled=true;text('sing-heard','—');
 }
 function pause(){if(ready&&following()){const time=player?.getCurrentTime?.();if(Number.isFinite(time)){state.videoTime=time;store();}}try{player?.pauseVideo?.();}catch{}stopInput();}
 function destroyPlayer(){playerTicket++;ready=false;clearInterval(timer);timer=null;try{player?.destroy?.();}catch{}player=null;$('sing-player').replaceChildren();$('sing-load').hidden=false;setPlayerControls(false);}
 function setPlayerControls(value){for(const id of ['sing-play','sing-pause','sing-back','sing-a','sing-b','sing-loop','sing-speed'])$(id).disabled=!value;lyricPosition();}
 function renderDiagram(name){
  const shape=SING_SHAPES[name],host=$('sing-diagram');host.replaceChildren();if(!shape)return;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 180 164');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${name}の押さえ方。指番号は1人差し指、2中指、3薬指、4小指`);
  const add=(tag,attrs,value)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(value!==undefined)e.textContent=value;svg.append(e);};
  for(let i=0;i<6;i++){const x=28+i*25;add('line',{x1:x,x2:x,y1:32,y2:136});add('text',{x,y:156},6-i);}
  for(let f=0;f<=6;f++)add('line',{x1:28,x2:153,y1:32+f*17.3,y2:32+f*17.3,class:f===0?'nut':''});
  if(shape.barre){const b=shape.barre;add('line',{x1:28+(6-b.from)*25,x2:28+(6-b.to)*25,y1:32+(b.fret-.5)*17.3,y2:32+(b.fret-.5)*17.3,class:'barre'});}
  shape.frets.forEach((f,i)=>{const x=28+i*25;if(f<=0)add('text',{x,y:21},f<0?'×':'○');else{const y=32+(f-.5)*17.3;add('circle',{cx:x,cy:y,r:8});add('text',{x,y:y+3.5,class:'finger'},shape.fingers[i]);}});host.append(svg);
  text('sing-fingering',fingeringText(name));
  $('sing-fingers').replaceChildren(...shape.frets.flatMap((f,i)=>{if(f<=0)return[];const li=document.createElement('li');li.textContent=`${['','人差し指','中指','薬指','小指'][shape.fingers[i]]}：${6-i}弦の${f}フレット`;return[li];}));
 }
 function render(){
  const target=steps[Math.min(state.index,steps.length-1)],name=target?.name||$('sing-chord-picker').value||'C';
  text('sing-course-title',`${selected.title} / ${selected.artist}`);text('sing-target',state.index>=steps.length&&steps.length?'✓':name);
  text('sing-target-label',following()?(finishedVideo()?'演奏おわり':'今押さえるコード'):steps.length?state.index>=steps.length?'コードを一通り確認しました':'次に押さえるコード':'曲のコードは未設定 · 下で押さえ方を選ぶ');
  text('sing-next',steps[state.index+1]?.name||'—');text('sing-section',target?.title||'参考動画とコード図');
  text('sing-progress',steps.length?`${Math.min(state.index+1,steps.length)} / ${steps.length}コード`:'曲のコードを下で選べます');
  $('sing-advance').disabled=!steps.length||state.index>=steps.length||(following()&&state.index===steps.length-1);$('sing-previous').disabled=!steps.length||state.index<=0;
  $('sing-mic').disabled=!steps.length||state.index>=steps.length||!!ctx||finishedVideo();
  $('sing-follow').checked=following();$('sing-follow').disabled=!canFollow();
  text('sing-follow-note',canFollow()?(following()?'動画の位置に追従中':'自分のペースで練習中'):'この曲・自分の並びの時刻は未設定です');
  text('sing-offset-value',state.offset?`${Math.abs(state.offset).toFixed(1)}秒${state.offset>0?'早め':'遅め'}`:'標準');
  for(const id of ['sing-earlier','sing-later','sing-offset-reset'])$(id).disabled=!canFollow();
  if(!following())text('sing-next-countdown','');
  text('sing-mic',following()?'今のコードをマイクで確認（試験）':'マイクで合ったら次へ（試験）');
  $('sing-hand-open').hidden=selected.instrument!=='guitar';$('sing-warmup').hidden=!selected.names&&!selected.stages;
  $('sing-capo').value=state.capo;$('sing-chord-picker').value=name;renderDiagram(name);
  text('sing-capo-note',state.capo?`カポ${state.capo}。図の数字はカポから数えます。`:'カポなし。図の数字はナットから数えます。');
  if(target)$('sing-sections').value=steps.find(s=>s.section===target.section)?.index??0;
  for(const b of $('sing-chord-track').querySelectorAll('[data-step]')){const i=Number(b.dataset.step);b.setAttribute('aria-current',String(i===state.index));b.classList.toggle('passed',i<state.index);}
  text('sing-loop-state',state.a!==null&&state.b!==null?`${state.a.toFixed(1)}〜${state.b.toFixed(1)}秒`:'AとBを動画の位置で決めます');$('sing-loop').checked=state.loop;lyricPosition();revealTrack();
 }
 function makeTrack(){
  trackAnnotation=null;$('sing-chord-track').replaceChildren(...steps.map((s,i)=>{const b=document.createElement('button'),label=document.createElement('strong'),lyric=document.createElement('span');label.textContent=s.name;lyric.className='score-note-lyric sing-track-lyric';b.append(label,lyric);b.dataset.step=i;b.setAttribute('aria-label',`${i+1}番目 ${s.title} ${s.name}`);return b;}));
  $('sing-sections').replaceChildren(...sectionStarts(steps).map(s=>new Option(s.title,s.index)));
 }
 function advance(){if(state.index>=steps.length)return;state.index++;store();render();if(state.index>=steps.length){stopInput();status('最後までコードを確認しました。歌い方やタイミングの採点ではありません。');}}
 function select(id){
  pause();destroyPlayer();selected=lessons.find(s=>s.id===id)||lessons[0];course=PREPARED_COURSES[selected.id]||null;const stored=saved.bySong?.[selected.id];
  steps=course?.steps||[];$('sing-code-input').value=typeof stored?.custom==='string'?stored.custom.slice(0,20000):'';
  if($('sing-code-input').value)try{steps=readSteps($('sing-code-input').value);}catch{$('sing-code-input').value='';}
  customOrder=$('sing-code-input').value;state=courseState(stored,course,steps,!!customOrder);if(following())state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;if(!steps.length)$('sing-chord-picker').value=selected.referenceChord||'C';
  $('sing-course').value=selected.id;$('sing-source').href=selected.video;$('sing-lesson-link').href=selected.lesson;
  $('sing-outside').href=selected.video;
  $('sing-source').textContent=videoId(selected.video)?'YouTubeで開く ↗':'解説ページで開く ↗';$('sing-load').disabled=!videoId(selected.video);
  text('sing-reference-note',course?.note||selected.referenceNote||(selected.id==='tokiyo'?'オーリーズの音楽室の歌詞・コード付き通し演奏。カポ4のコード名を案内します。':selected.instrument==='sanshin'?'三線の参考動画です。全曲の工工四・コード順は未設定です。この画面の指の図はギター用です。':'参考動画・演奏です。動画のキー・カポ・譜面表示を確認してください。全曲のコード順は未設定です。'));
  lyrics.use(`video:guitar:${selected.id}`,selected.title);text('sing-support',songSupport('guitar',selected.id).badge+' · '+songSupport('guitar',selected.id).detail);makeTrack();render();status(modeMessage());store();
 }
 async function loadVideo(){
  const id=videoId(selected.video);if(!id)return;pause();destroyPlayer();const ticket=playerTicket;$('sing-load').disabled=true;status('YouTubeを準備しています…');
  try{const created=await lessonPlayer($('sing-player'),id,{
   onReady:e=>{if(ticket!==playerTicket||!active){try{e.target.destroy();}catch{}return;}player=e.target;ready=true;$('sing-load').hidden=true;$('sing-load').disabled=false;setPlayerControls(true);
    const rates=player.getAvailablePlaybackRates?.()||[1];$('sing-speed').replaceChildren(...rates.filter(r=>r<=1).map(r=>new Option(`${r===1?'ふつう':r+'倍'}`,r)));$('sing-speed').value='1';if(following()&&state.videoTime>0){player.seekTo(Math.min(state.videoTime,player.getDuration?.()||course.end),true);player.pauseVideo();}followVideo();status('準備できました。動画の再生を押してください。'+modeMessage());
   },
   onError:e=>{if(ticket!==playerTicket)return;stopInput();ready=false;setPlayerControls(false);$('sing-load').disabled=false;$('sing-load').hidden=false;status(`動画を開けませんでした（${Number(e.data)||'通信'}）。「YouTubeで開く」から配信元で見ることもできます。`);},
   onPlaybackRateChange:e=>{if(ticket===playerTicket)$('sing-speed').value=String(e.data);},
   onStateChange:e=>{if(ticket!==playerTicket)return;if(e.data===1){$('sing-position-details').open=true;revealTrack();}followVideo();if(e.data===2||e.data===0)store();if(e.data===0&&state.loop&&validRange(state.a,state.b,player?.getDuration?.())){player.seekTo(state.a,true);player.playVideo();}else if(e.data===0){stopInput();}}
  },()=>ticket===playerTicket&&active);if(ticket!==playerTicket||!active){try{created?.destroy();}catch{}return;}player=created;
  timer=setInterval(()=>{if(!ready||!active)return;try{const time=player.getCurrentTime()||0;text('sing-video-time',`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`);if(state.loop&&player.getPlayerState()===1&&time>=state.b){player.seekTo(state.a,true);}followVideo();lyricPosition();}catch{}},100);
  }catch(error){if(ticket===playerTicket){$('sing-load').disabled=false;status(error.message);}}
 }
 async function startInput(){
  if(!steps.length||state.index>=steps.length||finishedVideo())return;$('sing-position-details').open=true;onTakeOver();stopInput();render();const ticket=inputTicket;$('sing-mic').disabled=true;$('sing-mic-stop').disabled=false;status('マイクの許可を待っています。動画の音はイヤホンで聴いてください。');let acquired;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('マイクはHTTPSかlocalhostで使えます。');const Audio=window.AudioContext||window.webkitAudioContext;ctx=new Audio({latencyHint:'interactive'});const audio=ctx;await audio.resume();if(ticket!==inputTicket)return;
   acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});if(ticket!==inputTicket){acquired.getTracks().forEach(t=>t.stop());return;}
   if(audio.state!=='running'){
    let resumeTimer;try{await Promise.race([audio.resume(),new Promise((_,reject)=>{resumeTimer=setTimeout(()=>reject(new Error('音声が一時停止しています。マイクをもう一度始めてください。')),2000);})]);}finally{clearTimeout(resumeTimer);}
    if(ticket!==inputTicket){acquired.getTracks().forEach(t=>t.stop());return;}
    if(audio.state!=='running')throw new Error('音声を再開できませんでした。マイクをもう一度始めてください。');
   }
   stream=acquired;source=audio.createMediaStreamSource(stream);analyser=audio.createAnalyser();analyser.fftSize=16384;analyser.smoothingTimeConstant=.1;silent=audio.createGain();silent.gain.value=0;inputBoost=new MicInputBoost(audio,source,analyser);analyser.connect(silent).connect(audio.destination);
   acquired.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(stream===acquired){stopInput();status('マイクが切断されました。もう一度始めてください。');}}));
   const wave=new Float32Array(analyser.fftSize),spectrum=new Float32Array(analyser.frequencyBinCount);status(following()?'動画に合わせて、今のコードを確認します（試験）。動画の音はイヤホンで聴いてください。':'和音を聴いて次へ進めます（試験）。歌声・周囲の音で検出できないことがあります。');
   meter=setInterval(()=>{if(!analyser||!stream)return;analyser.getFloatTimeDomainData(wave);const rms=Math.sqrt(wave.reduce((s,v)=>s+v*v,0)/wave.length);if(inputBoost?.settling(gate,rms))return;analyser.getFloatFrequencyData(spectrum);const found=detectChord(spectrum,audio.sampleRate,16384,{rms,capo:state.capo});text('sing-heard',found.name||'—');
    if(gate.feed(found,steps[state.index]?.name,performance.now(),rms)){const name=steps[state.index].name;if(following()){status(`${name}を確認しました。図は動画に合わせて進みます。`);return;}advance();if(state.index<steps.length)status(`${name}を確認しました。次の押さえ方を準備しましょう。`);}
   },80);
  }catch(error){if(ticket!==inputTicket){acquired?.getTracks().forEach(t=>t.stop());return;}stopInput();status(error.name==='NotAllowedError'?'マイクが許可されていません。手動の「次へ」でも進められます。':error.message||'マイクを開始できませんでした。');}
 }
 $('sing-course').replaceChildren(...lessons.map(s=>new Option(`${s.title} / ${s.artist}`,s.id)));
 $('sing-chord-picker').replaceChildren(...Object.keys(SING_SHAPES).map(n=>new Option(n,n)));$('sing-capo').replaceChildren(...Array.from({length:8},(_,i)=>new Option(i?`カポ${i}`:'カポなし',i)));
 $('sing-hand-open').onclick=()=>{pause();const name=$('sing-chord-picker').value,target=steps[state.index],next=target?.name===name?steps.slice(state.index+1).find(s=>s.name!==name):null;onHandGuide({name,shape:SING_SHAPES[name],capo:state.capo,next:next?{name:next.name,shape:SING_SHAPES[next.name]}:null});};
 $('sing-warmup').onclick=()=>{pause();onWarmup(selected);};
 $('sing-course').onchange=()=>select($('sing-course').value);$('sing-load').onclick=loadVideo;
 $('sing-play').onclick=()=>{if(ready){$('sing-position-details').open=true;player.playVideo();render();}};$('sing-pause').onclick=()=>{pause();status('止めました。再生は自分で再開できます。');};$('sing-back').onclick=()=>{if(ready)player.seekTo(Math.max(0,player.getCurrentTime()-5),true);};
 $('sing-speed').onchange=()=>{if(ready)player.setPlaybackRate(Number($('sing-speed').value));};
 $('sing-a').onclick=()=>{state.a=player.getCurrentTime();state.loop=false;if(state.b!==null&&state.b<=state.a)state.b=null;store();render();};
 $('sing-b').onclick=()=>{const b=player.getCurrentTime();if(!validRange(state.a,b,player.getDuration())){status('Aより1秒以上後ろでBを決めてください。');return;}state.b=b;store();render();};
 $('sing-loop').onchange=()=>{if($('sing-loop').checked&&!validRange(state.a,state.b,player.getDuration())){state.loop=false;status('先にAとBを決めてください。');}else state.loop=$('sing-loop').checked;render();};
 $('sing-advance').onclick=()=>{$('sing-position-details').open=true;if(following()){seekStep(state.index+1);return;}gate.reset();advance();};$('sing-previous').onclick=()=>seekStep(state.index-1);
 $('sing-restart').onclick=()=>{pause();state.index=0;state.videoTime=0;state.loop=false;if(ready)player.seekTo(0,true);store();render();status('最初に戻りました。動画・マイクは自分で開始してください。');};
 $('sing-sections').onchange=()=>{seekStep(Number($('sing-sections').value));status(following()?'選んだ場所へ動画とコード図を移動しました。':'コード図の位置を変えました。');};
 $('sing-chord-track').onclick=e=>{const button=e.target.closest('[data-step]');if(!button)return;seekStep(Number(button.dataset.step));};
 $('sing-chord-picker').onchange=()=>{const name=$('sing-chord-picker').value;stopInput();if(following()){pause();state.follow=false;store();render();}renderDiagram(name);$('sing-chord-picker').value=name;text('sing-target',name);text('sing-target-label','押さえ方の確認（進行位置は変えません）');};
 $('sing-follow').onchange=()=>{stopInput();state.follow=$('sing-follow').checked&&canFollow();if(ready)followVideo();else if(following())state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;store();render();status(modeMessage());};
 function adjustOffset(delta){state.offset=Math.max(-2,Math.min(2,Number((delta===null?0:state.offset+delta).toFixed(1))));followVideo();store();render();}
 $('sing-earlier').onclick=()=>adjustOffset(.2);$('sing-later').onclick=()=>adjustOffset(-.2);$('sing-offset-reset').onclick=()=>adjustOffset(null);
 $('sing-capo').onchange=()=>{stopInput();state.capo=Number($('sing-capo').value);store();render();};
 $('sing-mic').onclick=startInput;$('sing-mic-stop').onclick=()=>{stopInput();status('マイクを止めました。');};
 for(const id of ['sing-source','sing-lesson-link'])$(id).addEventListener('click',pause);
 $('sing-outside').addEventListener('click',pause);
 $('sing-layout').onclick=()=>{const only=document.body.classList.toggle('sing-diagram-only');if(only){try{player?.pauseVideo?.();}catch{}state.loop=false;}text('sing-layout',only?'動画も並べる':'コード図を大きく');};
 $('sing-code-save').onclick=()=>{try{const next=readSteps($('sing-code-input').value);stopInput();steps=next;customOrder=$('sing-code-input').value;state.follow=false;state.index=0;store();makeTrack();render();status('コードの並びをこの曲に保存しました。動画とは自動同期しません。');}catch(e){status(e.message);}};
 $('sing-code-reset').onclick=()=>{customOrder='';$('sing-code-input').value='';stopInput();steps=course?.steps||[];state=courseState(null,course,steps);state.follow=canFollow();if(ready&&following())player.seekTo(0,true);store();makeTrack();render();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(active)status('画面を離れたので、動画とマイクを止めました。');}});window.addEventListener('pagehide',pause);
 return{pause,setMicGain(value){inputBoost?.set(value);if(stream)status('拾う強さを変えました。もう一度コードを鳴らしてください。');},open(id){onTakeOver();active=true;if(id)select(id);else select(selected.id);document.body.classList.add('singalong-mode');$('view-singalong').setAttribute('aria-pressed','true');onChange(true);window.scrollTo({top:0,behavior:'instant'});},close(){active=false;pause();destroyPlayer();document.body.classList.remove('singalong-mode');$('view-singalong').setAttribute('aria-pressed','false');onChange(false);}};
}
