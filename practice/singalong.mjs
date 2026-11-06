import { mountVideoLyrics } from './video-lyrics.mjs?v=36';
import { scoreLyricAnnotations,setScoreLyric } from './score-lyrics.mjs?v=36';
import { songSupport } from './song-support.mjs?v=36';
import { MicInputBoost } from './mic-input.mjs?v=36';
import { cueAt } from './video-cues.mjs?v=36';
import { PREPARED_COURSES,courseState } from './singalong-courses.mjs?v=36';
import { MATERIAL_COURSES,materialChoice,materialLyricKey,materialUpgradeState } from './material-courses.mjs?v=36';
import { correctedCourse,practiceClock } from './harmony-timeline.mjs?v=36';
import { guitarShape,drawChord,fillFingerList,strumInstruction,gripCard } from './chord-guide.mjs?v=36';
import { STUDIES } from './learning.mjs?v=36';
import { SING_SHAPES,readSteps,videoId,validRange,fingeringText,sectionStarts } from './singalong-core.mjs?v=36';
import { detectChord,ChordGate,chordAttackLevel } from './polyphonic.mjs?v=36';
import { lessonPlayer } from './youtube.mjs?v=36';
import { EASY_CAPOS,transposeChord,arrangeCourse,availableCapos,nextChange,changeCue,chordPhrase,timeLabel } from './song-coach.mjs?v=36';
const STORAGE='music-practice-singalong-v1';
const lessons=STUDIES.guitar.map(s=>({...s,instrument:'guitar',referenceVideo:s.video||s.lesson,video:PREPARED_COURSES[s.id]?.url||s.video||s.lesson}));
const text=(id,value)=>{const e=document.getElementById(id);if(e.textContent!==String(value))e.textContent=value;};
const $=id=>document.getElementById(id);
export function mountSingalong({onTakeOver,onChange,onHandGuide,onWarmup}){
 let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{}
 let selected=lessons.find(s=>s.id===saved.selected)||lessons[0],steps=[],course=null,baseCourse=null,corrections=null,customOrder='',state={},active=false,player=null,ready=false,playerTicket=0,timer=null;
 let inputTicket=0,stream=null,ctx=null,source=null,analyser=null,silent=null,meter=null,inputBoost=null;
 let waiting=false;
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
 const canFollow=()=>!!course&&!course.noNative&&videoId(selected.video)===course.video&&steps===course.steps;
 const following=()=>canFollow()&&state.follow;
 const finishedVideo=()=>following()&&cueAt(course.times,state.videoTime,state.offset,course.end)?.ended;
 const modeMessage=()=>course?.noNative?'歌詞とコードは教材の画面で進みます。横の図は、調べたいコードを選んで確認できます。':player?.localClock?'別画面用のコード時間送りです。動画との開始・ずれは手動で合わせます。':following()?(course.estimated?'推定・目安のコード図が動画に追従します。違う箇所は補正できます。マイクは曲の正誤採点ではありません。':'動画に合わせて今のコード図が自動で切り替わります。マイクは今のコードの確認に使えます。'):'コード図は手動か自分の演奏で進みます。動画の音はイヤホンで聴いてください。';
 const activeShape=name=>guitarShape(name);
 const waitingToStart=()=>following()&&!changeCue(course,state.index,state.videoTime,state.offset).started;
 const sourceCourse=()=>correctedCourse(baseCourse,corrections);
 function updateArrangement(capo){
  try{const updated=arrangeCourse(sourceCourse(),capo);pause();course=updated;steps=course.steps;state.capo=capo;state.arranged=true;store();makeTrack();render();status('動画と同じ音の高さを保って、コード図を替えました。カポの位置も合わせてください。');}
  catch(error){status(error.message);render();}
 }
 function seekVideo(time){
  if(!ready)return;const playing=player.getPlayerState()===1;waiting=false;
  state.videoTime=Math.max(0,Math.min(player.getDuration()||course?.end||7200,time));
  if(following())state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;
  player.seekTo(state.videoTime,true);if(!playing)player.pauseVideo();store();render();
 }
 function showPerformance(){const panel=document.querySelector('.sing-workspace');if(panel.getBoundingClientRect().top<0)panel.scrollIntoView({block:'start',behavior:'instant'});}
 function continueVideo(){if(!ready)return;waiting=false;if(course?.material&&finishedVideo()&&!state.loop){state.videoTime=Math.max(0,course.times[steps.findIndex(s=>!s.silent)]-state.offset);player.seekTo(state.videoTime,true);} $('sing-position-details').open=true;player.playVideo();render();showPerformance();}
 function renderClock(){
  const duration=Number(player?.getDuration?.())||course?.end||1;
  text('sing-video-time',`${timeLabel(state.videoTime||0)} / ${timeLabel(duration)}`);
  $('sing-seek').max=duration;if(document.activeElement!==$('sing-seek'))$('sing-seek').value=state.videoTime||0;
 }

 const correctionKey=()=>`music-practice-cue-edits-v1:${selected.id}:${baseCourse?.key}`;
 function correctionSelection(){const i=Number($('sing-correct-step').value);$('sing-correct-name').value=steps[i]?.name||'N';$('sing-correct-time').value=course?.times?.[i]?.toFixed(3)||'0';}
 function saveCorrection(change){
  try{
   if(!baseCourse||baseCourse.noNative||customOrder)throw new Error('先に「用意した並びに戻す」で、動画の自動送りに切り替えてください。');
   const index=Number($('sing-correct-step').value),next={version:1,key:baseCourse.key,changes:[...(corrections?.changes||[])]};
   if(change.name!==undefined&&state.arranged)change={...change,name:transposeChord(change.name,state.capo-baseCourse.capo)};
   const previous=next.changes.findIndex(c=>c.index===index),value={...(previous>=0?next.changes[previous]:{}),index,...change};if(previous>=0)next.changes[previous]=value;else next.changes.push(value);
   const corrected=correctedCourse(baseCourse,next),updated=state.arranged?arrangeCourse(corrected,state.capo):corrected;localStorage.setItem(correctionKey(),JSON.stringify(next));pause();corrections=next;course=updated;steps=course.steps;state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;store();makeTrack();render();text('sing-correction-status','この端末に補正を保存しました。曲の歌詞やコード順は消していません。');
  }catch(error){text('sing-correction-status',error.message||'補正を保存できませんでした。');}
 }
 function followVideo(){
  if(!ready||!active||!following())return;
  const time=player.getCurrentTime();if(!Number.isFinite(time))return;
  state.videoTime=time;const cue=cueAt(course.times,time,state.offset,course.end);
  if(cue.ended&&course.material&&!state.loop&&player.getPlayerState()===1){player.pauseVideo();status('通し演奏が終わりました。「再生」で演奏の始めからもう一度練習できます。');}
  if(state.index!==cue.index){const previous=steps[state.index];state.index=cue.index;gate.reset();
   if(state.waitChanges&&!cue.ended&&!steps[cue.index]?.silent&&previous?.name!==steps[cue.index]?.name&&player.getPlayerState()===1){waiting=true;player.pauseVideo();player.seekTo(Math.max(0,course.times[cue.index]-state.offset),true);player.pauseVideo();status('押さえ替えを待っています。指が置けたら「押さえた・続ける」。マイクを開始済みなら、今のコードの確認でも進めます。');}
   store();render();}
  const change=changeCue(course,state.index,time,state.offset);
  text('sing-next-countdown',cue.ended?'演奏おわり':change.remaining===null?'最後のコード':`${change.started?'切替まで':'弾き始めまで'} ${change.remaining.toFixed(1)}秒`);
  if(cue.ended&&(ctx||stream)){stopInput();status('通し演奏が終わりました。巻き戻すと、その場所のコード図に戻ります。');}
  const label=cue.ended?'演奏おわり':waiting?'指を置いてから、続けよう':!change.started||steps[state.index]?.silent?'音が始まるまで待つ':'今押さえるコード';text('sing-target-label',label);
  $('sing-mic').disabled=!change.started||cue.ended||!!ctx||finishedVideo()||waitingToStart()||!!steps[state.index]?.silent;
 }
 function seekStep(index){
  stopInput();state.index=Math.max(0,Math.min(steps.length-1,index));
  if(following()){state.videoTime=Math.max(0,course.times[state.index]-state.offset);if(ready)seekVideo(state.videoTime);}
  store();render();
 }

 const store=()=>{try{const entry={material:baseCourse?.material===true,timeline:!customOrder&&course?course.key:null,video:videoId(selected.video),index:state.index,capo:state.capo,arranged:state.arranged,waitChanges:state.waitChanges,a:state.a,b:state.b,follow:state.follow,offset:state.offset,videoTime:state.videoTime,custom:customOrder};const bySong={...(saved.bySong||{}),[selected.id]:entry},byVersion={...(saved.byVersion||{}),[`${selected.id}:${baseCourse?.key}`]:entry};saved={...saved,selected:selected.id,bySong,byVersion};localStorage.setItem(STORAGE,JSON.stringify(saved));return true;}catch{status('この端末に保存できません。今の画面では練習を続けられます。');return false;}};
 function stopInput(){
  inputTicket++;clearInterval(meter);meter=null;stream?.getTracks().forEach(t=>t.stop());stream=null;
  for(const node of [source,analyser,silent])try{node?.disconnect();}catch{}source=analyser=silent=null;
  const old=ctx;ctx=null;if(old&&old.state!=='closed')old.close().catch(()=>{});
  inputBoost?.disconnect();inputBoost=null;gate.reset();$('sing-mic').disabled=!steps.length||state.index>=steps.length||finishedVideo()||waitingToStart()||!!steps[state.index]?.silent;$('sing-mic-stop').disabled=true;text('sing-heard','—');
 }
 function pause(){waiting=false;$('sing-continue').hidden=true;if(ready){const time=player?.getCurrentTime?.();if(Number.isFinite(time)){state.videoTime=time;store();}}try{player?.pauseVideo?.();}catch{}stopInput();}
 function destroyPlayer(){playerTicket++;ready=false;waiting=false;$('sing-continue').hidden=true;clearInterval(timer);timer=null;try{player?.destroy?.();}catch{}player=null;$('sing-player').replaceChildren();$('sing-load').hidden=false;$('sing-load').disabled=false;text('sing-play','▶ 再生');text('sing-clock-note','');setPlayerControls(false);}
 function setPlayerControls(value){for(const id of ['sing-play','sing-pause','sing-back','sing-a','sing-b','sing-loop','sing-speed','sing-seek','sing-phrase','sing-phrase-next'])$(id).disabled=!value;$('sing-song-start').disabled=!value||!canFollow();$('sing-correction-mark').disabled=!value||!!customOrder||!course||!!course.noNative||!!player?.localClock;lyricPosition();}
 function renderDiagram(name){
  const details=$('sing-finger-details');if(details.dataset.chord!==name){if(document.body.dataset.guitarGuide==='fingers')details.open=true;details.dataset.chord=name;}
  const shape=activeShape(name),host=$('sing-diagram');host.replaceChildren();if(!shape){text('sing-fingering','音が始まるまで待ちます。');$('sing-fingers').replaceChildren();text('sing-strum-guide','ここは弾かずに待ちます。');return;}
  host.append(drawChord(name,shape));
  text('sing-fingering',fingeringText(name,shape));
  fillFingerList($('sing-fingers'),shape);text('sing-strum-guide',strumInstruction(shape));
 }
 function render(){
  renderClock();$('sing-continue').hidden=!waiting;$('sing-wait').checked=!!state.waitChanges;$('sing-wait').disabled=!canFollow();$('sing-phrase').disabled=!ready||!canFollow();$('sing-phrase-next').disabled=!ready||!canFollow()||state.b===null||state.b>=course.end-1;
  const target=steps[Math.min(state.index,steps.length-1)],name=target?.name||$('sing-chord-picker').value||'C';
  text('sing-course-title',`${selected.title} / ${selected.artist}`);text('sing-target',state.index>=steps.length&&steps.length?'✓':target?.silent?'休み':name);
  text('sing-target-label',following()?(finishedVideo()?'演奏おわり':waiting?'指を置いてから、続けよう':waitingToStart()||target?.silent?'音が始まるまで待つ':'今押さえるコード'):steps.length?state.index>=steps.length?'コードを一通り確認しました':'次に押さえるコード':course?.noNative?'押さえ方を調べる · 手動で選択':'曲のコードは未設定 · 下で押さえ方を選ぶ');
  const nextIndex=nextChange(steps,state.index);text('sing-next',steps[nextIndex]?.silent?'休み':steps[nextIndex]?.name||'—');const next=steps[nextIndex],nextShape=!next?.silent&&activeShape(next?.name);$('sing-next-diagram').replaceChildren(...(nextShape?[drawChord(next.name,nextShape)]:[]));$('sing-next-diagram').hidden=!nextShape;text('sing-section',target?.title||'参考動画とコード図');
  text('sing-progress',steps.length?`${Math.min(state.index+1,steps.length)} / ${steps.length}コード`:'曲のコードを下で選べます');$('sing-song-progress').max=Math.max(1,steps.length);$('sing-song-progress').value=Math.min(state.index,steps.length);$('sing-song-progress').hidden=!steps.length;
  $('sing-advance').disabled=!steps.length||state.index>=steps.length||(following()&&state.index===steps.length-1);$('sing-previous').disabled=!steps.length||state.index<=0;
  $('sing-mic').disabled=!steps.length||state.index>=steps.length||!!ctx||finishedVideo()||waitingToStart()||!!target?.silent;
  $('sing-follow').checked=following();$('sing-follow').disabled=!canFollow();
  text('sing-follow-label',player?.localClock?'コードを時間で進める（動画は手動で同期）':'動画に合わせてコード図を進める');text('sing-follow-note',canFollow()?(following()?(player?.localClock?'コードの時間送り（動画とは手動同期）':'動画の位置に追従中'):'自分のペースで練習中'):course?.noNative?'譜面は動画内で進みます。横の指図は手動で選べます。':'この曲・自分の並びの時刻は未設定です');
  text('sing-offset-value',state.offset?`${Math.abs(state.offset).toFixed(1)}秒${state.offset>0?'早め':'遅め'}`:'標準');
  for(const id of ['sing-earlier','sing-later','sing-offset-reset'])$(id).disabled=!canFollow();
  if(!following())text('sing-next-countdown','');else{const change=changeCue(course,state.index,state.videoTime,state.offset);text('sing-next-countdown',finishedVideo()?'演奏おわり':change.remaining===null?'最後のコード':`${change.started?'切替まで':'弾き始めまで'} ${change.remaining.toFixed(1)}秒`);}
  text('sing-mic',following()&&ready?'今のコードをマイクで確認（試験）':'ジャーンと弾いて次へ（試験）');
  $('sing-hand-open').hidden=selected.instrument!=='guitar';$('sing-warmup').hidden=!selected.names&&!selected.stages;
  $('sing-hand-open').disabled=!activeShape(name);$('sing-correction-save').disabled=!course||!!course.noNative||!!customOrder;$('sing-correction-time-save').disabled=!course||!!course.noNative||!!customOrder;$('sing-correction-mark').disabled=!course||!!course.noNative||!!customOrder||!ready||!!player?.localClock;$('sing-correction-reset').disabled=!corrections;
  $('sing-song-start').disabled=!ready||!canFollow();
  $('sing-clock-start').disabled=!canFollow();
  if(!$('sing-timing-editor').open){$('sing-correct-step').value=Math.min(state.index,Math.max(0,steps.length-1));correctionSelection();}
  $('sing-easy').disabled=!baseCourse||baseCourse.noNative||!!customOrder;$('sing-reference').disabled=!baseCourse||baseCourse.noNative||!!customOrder;
  const capos=baseCourse&&!baseCourse.noNative&&!customOrder?availableCapos(sourceCourse()):Array.from({length:8},(_,i)=>i);
  if(!capos.includes(state.capo))capos.push(state.capo);$('sing-capo').replaceChildren(...capos.sort((a,b)=>a-b).map(i=>new Option(i?`カポ${i}`:'カポなし',i)));$('sing-capo').value=state.capo;
  text('sing-arrangement-note',course?.noNative?'動画に出てくるコードを下で選ぶと、指の置き方を確認できます。カポは動画の案内に合わせてください。':customOrder?'自分のコード順です。カポで音の高さが変わります。':state.arranged?'動画と同じ音の高さ。図の○はカポの位置、数字はそこから数えます。':'保存していた押さえ方です。「かんたんな形」で動画に合うカポと図を選べます。');$('sing-chord-picker').value=name;renderDiagram(name);
  text('sing-capo-badge',state.capo?`カポ${state.capo} · 図はカポから数える`:'カポなし');text('sing-capo-note',state.capo?`カポ${state.capo}。図の数字はカポから数えます。`:'カポなし。図の数字はナットから数えます。');
  if(target)$('sing-sections').value=steps.find(s=>s.section===target.section)?.index??0;
  for(const b of $('sing-chord-track').querySelectorAll('[data-step]')){const i=Number(b.dataset.step);b.setAttribute('aria-current',String(i===state.index));b.classList.toggle('passed',i<state.index);}
  text('sing-loop-state',state.a!==null&&state.b!==null?`${state.a.toFixed(1)}〜${state.b.toFixed(1)}秒`:'AとBを動画の位置で決めます');$('sing-loop').checked=state.loop;lyricPosition();revealTrack();
 }
 function makeTrack(){
  const editingIndex=Number($('sing-correct-step').value);trackAnnotation=null;$('sing-chord-track').replaceChildren(...steps.map((s,i)=>{const b=document.createElement('button'),label=document.createElement('strong'),lyric=document.createElement('span');label.textContent=s.silent?'休み':s.name;lyric.className='score-note-lyric sing-track-lyric';b.append(label,gripCard(s.name,activeShape(s.name)),lyric);b.dataset.step=i;b.setAttribute('aria-label',`${i+1}番目 ${s.title} ${s.silent?'休み':s.name}`);return b;}));
  $('sing-sections').replaceChildren(...sectionStarts(steps).map(s=>new Option(s.title,s.index)));
  $('sing-correct-step').replaceChildren(...steps.map((s,i)=>new Option(`${i+1}. ${s.silent?'休み':s.name} · ${course?.times?.[i]?.toFixed(1)||'—'}秒`,i)));
  $('sing-correct-step').value=Math.min(editingIndex,Math.max(0,steps.length-1));correctionSelection();
 }
 function advance(){if(state.index>=steps.length)return;state.index++;store();render();if(state.index>=steps.length){stopInput();status('最後までコードを確認しました。歌い方やタイミングの採点ではありません。');}}
 function select(id,requested){
  pause();destroyPlayer();selected={...(lessons.find(s=>s.id===id)||lessons[0])};const recent=saved.bySong?.[selected.id],variant=materialChoice(selected.id,recent,requested);baseCourse=(variant==='material'?MATERIAL_COURSES:PREPARED_COURSES)[selected.id]||null;course=baseCourse;corrections=null;const oldChart=baseCourse?.material?saved.byVersion?.[`${selected.id}:${selected.id}-${baseCourse.video}-chart-v1`]:null;const stored=materialUpgradeState(saved.byVersion?.[`${selected.id}:${baseCourse?.key}`]||oldChart||(recent?.material===!!baseCourse?.material||!recent?.material&&!baseCourse?.material?recent:null),baseCourse);if(baseCourse)selected.video=baseCourse.url;
  if(baseCourse?.noNative)$('sing-position-details').open=true;
  $('sing-material-choice').hidden=!MATERIAL_COURSES[selected.id];$('sing-material').value=variant;$('sing-material').options[0].textContent=baseCourse?.noNative||MATERIAL_COURSES[selected.id]?.noNative?'歌詞付き教材（動画の譜面で練習）':'歌詞付き教材とコード図';
  $('sing-timing-editor').open=false;text('sing-correction-status','補正はこの曲・この動画だけに適用し、この端末に保存します。');
  if(baseCourse)try{const raw=localStorage.getItem(correctionKey());if(raw){corrections=JSON.parse(raw);course=correctedCourse(baseCourse,corrections);}}catch{corrections=null;course=baseCourse;text('sing-correction-status','保存した補正を読み込めませんでした。元のガイドを表示します。保存データは削除していません。');}
  steps=course?.steps||[];$('sing-code-input').value=typeof stored?.custom==='string'?stored.custom.slice(0,20000):'';
  if($('sing-code-input').value)try{steps=readSteps($('sing-code-input').value);}catch{$('sing-code-input').value='';}
  customOrder=$('sing-code-input').value;if(course?.estimated&&customOrder)selected.video=videoId(stored?.video)?`https://www.youtube.com/watch?v=${videoId(stored.video)}`:selected.referenceVideo;state=courseState(stored,course,steps,!!customOrder);state.waitChanges=stored?.waitChanges===true;state.arranged=!baseCourse?.noNative&&!customOrder&&(stored?stored.arranged===true:true);
  if(state.arranged){try{course=arrangeCourse(course,stored?state.capo:baseCourse.easyCapo??EASY_CAPOS[selected.id]??course.capo);steps=course.steps;state.capo=course.capo;}catch{state.arranged=false;}}
  if(following())state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;if(!steps.length)$('sing-chord-picker').value=selected.referenceChord||'C';
  $('sing-course').value=selected.id;$('sing-source').href=selected.video;$('sing-lesson-link').href=selected.lesson;
  $('sing-outside').href=selected.video;
  $('sing-source').textContent=videoId(selected.video)?'YouTubeで開く ↗':'解説ページで開く ↗';$('sing-load').disabled=!videoId(selected.video);text('sing-load','YouTubeの動画を読み込む');
  text('sing-reference-note',course?.note||selected.referenceNote||(selected.id==='tokiyo'?'オーリーズの音楽室の歌詞・コード付き通し演奏。カポ4のコード名を案内します。':selected.instrument==='sanshin'?'三線の参考動画です。全曲の工工四・コード順は未設定です。この画面の指の図はギター用です。':'参考動画・演奏です。動画のキー・カポ・譜面表示を確認してください。全曲のコード順は未設定です。'));
  const support=baseCourse?.noNative?{badge:'動画の歌詞・コード譜',detail:'譜面は動画内で進みます。この教材用のアプリのコード図同期は準備中です。'}:baseCourse?.material?{badge:'歌詞付き教材＋コード図',detail:'歌詞は動画内で進み、横の図は簡略コードで追従します。切替位置は目安です。'}:songSupport('guitar',selected.id);lyrics.use(materialLyricKey(selected.id,baseCourse),selected.title,{inVideo:baseCourse?.lyricsInVideo||['tokiyo','jigsaw','yes-my-love'].includes(selected.id)});text('sing-support',support.badge+' · '+support.detail);$('sing-support').dataset.quality=course?.estimated?'estimated':'inspected';text('sing-guide-quality',course?.noNative?'動画の譜面で練習':course?.estimated?'自動送りは目安':'自動送りあり');$('sing-analysis-source').hidden=!course?.source;if(course?.source)$('sing-analysis-source').href=course.source;makeTrack();render();status(modeMessage());store();
 }
 function startTimer(){clearInterval(timer);timer=setInterval(()=>{if(!ready||!active)return;try{const time=player.getCurrentTime()||0;state.videoTime=time;renderClock();if(state.loop&&player.getPlayerState()===1&&time>=state.b)seekVideo(state.a);followVideo();lyricPosition();if(player.localClock&&!state.loop&&time>=course.end)player.pauseVideo();}catch{}},100);}
 function localClock(){
  if(!canFollow())return;pause();destroyPlayer();player=practiceClock(course.end,state.videoTime);ready=true;$('sing-load').disabled=false;state.follow=true;$('sing-player').textContent='別画面の動画に合わせるコード送り';text('sing-clock-note','動画とは自動同期しません。別画面で同じ参考動画を同じ位置から再生し、同時に「コード送り開始」を押してください。ずれたら停止してコードの位置を選び直せます。');text('sing-play','▶ コード送り開始');$('sing-speed').replaceChildren(...[.5,.75,1].map(r=>new Option(r===1?'ふつう':r+'倍',r)));$('sing-speed').value='1';setPlayerControls(true);startTimer();render();status('別画面用のコード送りを準備しました。開始は自分で押してください。');
 }
 async function loadVideo(){
  const id=videoId(selected.video);if(!id)return;pause();destroyPlayer();const ticket=playerTicket;$('sing-load').disabled=true;status('YouTubeを準備しています…');
  try{const created=await lessonPlayer($('sing-player'),id,{
   onReady:e=>{if(ticket!==playerTicket||!active){try{e.target.destroy();}catch{}return;}player=e.target;ready=true;$('sing-load').hidden=true;$('sing-load').disabled=false;setPlayerControls(true);
    const rates=player.getAvailablePlaybackRates?.()||[1];$('sing-speed').replaceChildren(...rates.filter(r=>r<=1).map(r=>new Option(`${r===1?'ふつう':r+'倍'}`,r)));$('sing-speed').value='1';if(following()&&state.videoTime>0){player.seekTo(Math.min(state.videoTime,player.getDuration?.()||course.end),true);player.pauseVideo();}followVideo();render();status('準備できました。動画の再生を押してください。'+modeMessage());
   },
   onError:e=>{if(ticket!==playerTicket)return;stopInput();ready=false;setPlayerControls(false);$('sing-load').disabled=false;$('sing-load').hidden=false;status(`動画を開けませんでした（${Number(e.data)||'通信'}）。「YouTubeで開く」から配信元で見ることもできます。`);},
   onPlaybackRateChange:e=>{if(ticket===playerTicket)$('sing-speed').value=String(e.data);},
   onStateChange:e=>{if(ticket!==playerTicket)return;if(e.data===1){$('sing-position-details').open=true;revealTrack();}followVideo();if(e.data===2||e.data===0)store();if(e.data===0&&state.loop&&validRange(state.a,state.b,player?.getDuration?.())){player.seekTo(state.a,true);player.playVideo();}else if(e.data===0){stopInput();}}
  },()=>ticket===playerTicket&&active);if(ticket!==playerTicket||!active){try{created?.destroy();}catch{}return;}player=created;
  startTimer();
  }catch(error){if(ticket===playerTicket){$('sing-load').disabled=false;status(error.message);}}
 }
 async function startInput(){
  if(following()&&!ready){state.follow=false;store();}
  if(!steps.length||state.index>=steps.length||finishedVideo()||waitingToStart()||steps[state.index]?.silent)return;$('sing-position-details').open=true;onTakeOver();stopInput();render();const ticket=inputTicket;$('sing-mic').disabled=true;$('sing-mic-stop').disabled=false;status('マイクの許可を待っています。動画の音はイヤホンで聴いてください。');let acquired;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('マイクはHTTPSかlocalhostで使えます。');const Audio=window.AudioContext||window.webkitAudioContext;ctx=new Audio({latencyHint:'interactive'});const audio=ctx;await audio.resume();if(ticket!==inputTicket)return;
   acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});if(ticket!==inputTicket){acquired.getTracks().forEach(t=>t.stop());return;}
   if(audio.state!=='running'){
    let resumeTimer;try{await Promise.race([audio.resume(),new Promise((_,reject)=>{resumeTimer=setTimeout(()=>reject(new Error('音声が一時停止しています。マイクをもう一度始めてください。')),2000);})]);}finally{clearTimeout(resumeTimer);}
    if(ticket!==inputTicket){acquired.getTracks().forEach(t=>t.stop());return;}
    if(audio.state!=='running')throw new Error('音声を再開できませんでした。マイクをもう一度始めてください。');
   }
   stream=acquired;source=audio.createMediaStreamSource(stream);analyser=audio.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=.1;silent=audio.createGain();silent.gain.value=0;inputBoost=new MicInputBoost(audio,source,analyser);analyser.connect(silent).connect(audio.destination);
   acquired.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(stream===acquired){stopInput();status('マイクが切断されました。もう一度始めてください。');}}));
   const wave=new Float32Array(analyser.fftSize),spectrum=new Float32Array(analyser.frequencyBinCount);status(following()?'動画に合わせて、今のコードを確認します（試験）。動画の音はイヤホンで聴いてください。':'和音を聴いて次へ進めます（試験）。歌声・周囲の音で検出できないことがあります。');
   meter=setInterval(()=>{if(!analyser||!stream)return;analyser.getFloatTimeDomainData(wave);const rms=Math.sqrt(wave.reduce((s,v)=>s+v*v,0)/wave.length);if(inputBoost?.settling(gate,rms))return;analyser.getFloatFrequencyData(spectrum);const found=detectChord(spectrum,audio.sampleRate,8192,{rms,capo:state.capo,expected:steps[state.index]?.name,previous:gate.last});text('sing-heard',found.name||'—');
    if(gate.feed(found,steps[state.index]?.name,performance.now(),rms,.006,chordAttackLevel(wave))){const name=steps[state.index].name;if(following()){if(waiting)continueVideo();status(`${name}を確認しました。図は動画に合わせて進みます。`);return;}advance();if(state.index<steps.length)status(`${name}を確認しました。次の押さえ方を準備しましょう。`);}
   },80);
  }catch(error){if(ticket!==inputTicket){acquired?.getTracks().forEach(t=>t.stop());return;}stopInput();status(error.name==='NotAllowedError'?'マイクが許可されていません。手動の「次へ」でも進められます。':error.message||'マイクを開始できませんでした。');}
 }
 $('sing-course').replaceChildren(...lessons.map(s=>new Option(`${s.title} / ${s.artist}`,s.id)));
 $('sing-chord-picker').replaceChildren(...Object.keys(SING_SHAPES).map(n=>new Option(n,n)));$('sing-capo').replaceChildren(...Array.from({length:8},(_,i)=>new Option(i?`カポ${i}`:'カポなし',i)));
 $('sing-hand-open').onclick=()=>{pause();const name=$('sing-chord-picker').value,target=steps[state.index],next=target?.name===name?steps.slice(state.index+1).find(s=>!s.silent&&s.name!==name):null;if(!activeShape(name))return;onHandGuide({name,shape:activeShape(name),capo:state.capo,next:next?{name:next.name,shape:activeShape(next.name)}:null});};
 $('sing-correct-name').replaceChildren(new Option('休み','N'),...Object.keys(SING_SHAPES).map(n=>new Option(n,n)));$('sing-correct-step').onchange=correctionSelection;
 $('sing-timing-editor').ontoggle=()=>{if($('sing-timing-editor').open){$('sing-correct-step').value=Math.min(state.index,Math.max(0,steps.length-1));correctionSelection();}};
 $('sing-correction-save').onclick=()=>saveCorrection({name:$('sing-correct-name').value});
 $('sing-correction-time-save').onclick=()=>saveCorrection({time:$('sing-correct-time').valueAsNumber});
 $('sing-correction-mark').onclick=()=>{if(ready){const time=Number(player.getCurrentTime());if(Number.isFinite(time))saveCorrection({time});}};
 $('sing-correction-reset').onclick=()=>{try{localStorage.removeItem(correctionKey());pause();corrections=null;course=state.arranged?arrangeCourse(baseCourse,state.capo):baseCourse;steps=course.steps;state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;store();makeTrack();render();text('sing-correction-status','この曲の補正だけを解除し、元のガイドに戻しました。');}catch{ text('sing-correction-status','補正を解除できませんでした。'); }};
 $('sing-warmup').onclick=()=>{pause();onWarmup(selected);};
 $('sing-material').onchange=()=>{store();select(selected.id,$('sing-material').value);};
 $('sing-course').onchange=()=>select($('sing-course').value);$('sing-load').onclick=loadVideo;
 $('sing-clock-start').onclick=localClock;
 $('sing-song-start').onclick=()=>{if(!ready||!canFollow())return;const index=steps.findIndex(s=>!s.silent);if(index<0)return;stopInput();waiting=false;state.loop=false;state.waitChanges=false;state.follow=true;state.index=index;state.videoTime=Math.max(0,course.times[index]-state.offset);player.seekTo(state.videoTime,true);player.playVideo();$('sing-position-details').open=true;store();render();showPerformance();status('1曲通して練習します。反復と押さえ替え待ちを外しました。歌詞と今のコードを見て弾いてみましょう。');};
 $('sing-play').onclick=continueVideo;$('sing-continue').onclick=continueVideo;$('sing-pause').onclick=()=>{pause();status('止めました。再生は自分で再開できます。');};$('sing-back').onclick=()=>{if(ready)seekVideo(Math.max(0,player.getCurrentTime()-5));};
 $('sing-seek').onchange=()=>{stopInput();state.loop=false;seekVideo($('sing-seek').valueAsNumber);};
 $('sing-wait').onchange=()=>{state.waitChanges=$('sing-wait').checked;store();render();};
 function loopPhrase(index){const range=chordPhrase(course,index,state.offset);if(!range){status('ここは短いため、少し前から区間を選んでください。');return;}state.a=range.a;state.b=range.b;state.loop=true;seekVideo(range.a);status('この4つのコードを繰り返します。慣れたら「次の区間へ」。通して弾くときは反復を外せます。');}
 $('sing-phrase').onclick=()=>{if(ready&&canFollow())loopPhrase(state.index);};
 $('sing-phrase-next').onclick=()=>{if(ready&&canFollow()&&state.b!==null)loopPhrase(cueAt(course.times,state.b+.001,state.offset,course.end).index);};
 $('sing-easy').onclick=()=>updateArrangement(baseCourse.easyCapo??EASY_CAPOS[selected.id]??baseCourse.capo);
 $('sing-reference').onclick=()=>updateArrangement(baseCourse.capo);
 $('sing-speed').onchange=()=>{if(ready)player.setPlaybackRate(Number($('sing-speed').value));};
 $('sing-a').onclick=()=>{state.a=player.getCurrentTime();state.loop=false;if(state.b!==null&&state.b<=state.a)state.b=null;store();render();};
 $('sing-b').onclick=()=>{const b=player.getCurrentTime();if(!validRange(state.a,b,player.getDuration())){status('Aより1秒以上後ろでBを決めてください。');return;}state.b=b;store();render();};
 $('sing-loop').onchange=()=>{if($('sing-loop').checked&&!validRange(state.a,state.b,player.getDuration())){state.loop=false;status('先にAとBを決めてください。');}else state.loop=$('sing-loop').checked;render();};
 $('sing-advance').onclick=()=>{$('sing-position-details').open=true;if(following()){seekStep(state.index+1);return;}gate.reset();advance();};$('sing-previous').onclick=()=>seekStep(state.index-1);
 $('sing-restart').onclick=()=>{pause();state.index=0;state.videoTime=0;state.loop=false;if(ready)seekVideo(0);store();render();status('最初に戻りました。動画・マイクは自分で開始してください。');};
 $('sing-sections').onchange=()=>{seekStep(Number($('sing-sections').value));status(player?.localClock?'コード送りの位置を変えました。別画面の動画も同じ場所に合わせてください。':following()?'選んだ場所へ動画とコード図を移動しました。':'コード図の位置を変えました。');};
 $('sing-chord-track').onclick=e=>{const button=e.target.closest('[data-step]');if(!button)return;seekStep(Number(button.dataset.step));};
 $('sing-chord-picker').onchange=()=>{const name=$('sing-chord-picker').value;stopInput();if(following()){pause();state.follow=false;store();render();}renderDiagram(name);$('sing-chord-picker').value=name;$('sing-hand-open').disabled=!activeShape(name);text('sing-target',name);text('sing-target-label','押さえ方の確認（進行位置は変えません）');};
 $('sing-follow').onchange=()=>{stopInput();state.follow=$('sing-follow').checked&&canFollow();if(ready)followVideo();else if(following())state.index=cueAt(course.times,state.videoTime,state.offset,course.end).index;store();render();status(modeMessage());};
 function adjustOffset(delta){state.offset=Math.max(-2,Math.min(2,Number((delta===null?0:state.offset+delta).toFixed(1))));followVideo();store();render();}
 $('sing-earlier').onclick=()=>adjustOffset(.2);$('sing-later').onclick=()=>adjustOffset(-.2);$('sing-offset-reset').onclick=()=>adjustOffset(null);
 $('sing-capo').onchange=()=>{if(baseCourse&&!baseCourse.noNative&&!customOrder)updateArrangement(Number($('sing-capo').value));else{stopInput();state.capo=Number($('sing-capo').value);store();render();}};
 $('sing-mic').onclick=startInput;$('sing-mic-stop').onclick=()=>{stopInput();status('マイクを止めました。');};
 for(const id of ['sing-source','sing-lesson-link','sing-analysis-source'])$(id).addEventListener('click',pause);
 $('sing-outside').addEventListener('click',pause);
 $('sing-layout').onclick=()=>{const only=document.body.classList.toggle('sing-diagram-only');if(only){try{player?.pauseVideo?.();}catch{}state.loop=false;}text('sing-layout',only?'動画も並べる':'コード図を大きく');};
 $('sing-code-save').onclick=()=>{try{const next=readSteps($('sing-code-input').value);stopInput();steps=next;customOrder=$('sing-code-input').value;state.follow=false;state.index=0;store();makeTrack();render();status('コードの並びをこの曲に保存しました。動画とは自動同期しません。');}catch(e){status(e.message);}};
 $('sing-code-reset').onclick=()=>{customOrder='';$('sing-code-input').value='';stopInput();if(course?.estimated&&videoId(selected.video)!==course.video){store();select(selected.id);return;}steps=course?.steps||[];const arranged=state.arranged,waitChanges=state.waitChanges;state=courseState(null,course,steps);state.arranged=arranged;state.waitChanges=waitChanges;state.follow=canFollow();if(ready&&following())seekVideo(0);store();makeTrack();render();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(active)status('画面を離れたので、動画とマイクを止めました。');}});window.addEventListener('pagehide',pause);
 return{pause,setMicGain(value){inputBoost?.set(value);if(stream)status('拾う強さを変えました。もう一度コードを鳴らしてください。');},open(id){onTakeOver();active=true;if(id)select(id);else select(selected.id);document.body.classList.add('singalong-mode');$('view-singalong').setAttribute('aria-pressed','true');onChange(true);window.scrollTo({top:0,behavior:'instant'});},close(){active=false;pause();destroyPlayer();document.body.classList.remove('singalong-mode');$('view-singalong').setAttribute('aria-pressed','false');onChange(false);}};
}
