import { gripChoices,fingerSteps,soundingStrings,gripTips,FINGER_NAMES,handLesson } from './hand-guide-core.mjs?v=9';
import { lessonPlayer } from './youtube.mjs?v=9';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const colors=['','#245f9a','#915100','#804ba1','#14776f'];
function element(tag,attrs={},value){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(value!==undefined)e.textContent=value;return e;}
export function mountHandGuide({pausePractice}){
 const dialog=$('hand-dialog');let name='',choices=[],choice=0,step=0,capo=0,origin=null,player=null,ticket=0,ready=false;
 function destroyVideo(){ticket++;ready=false;try{player?.pauseVideo?.();player?.destroy?.();}catch{}player=null;$('hand-player').replaceChildren();$('hand-video-load').hidden=false;for(const id of ['hand-video-play','hand-video-pause'])$(id).disabled=true;}
 function draw(){
  const shape=choices[choice].shape,steps=fingerSteps(shape),svg=element('svg',{viewBox:'0 0 320 340',role:'img','aria-label':`${name}。6弦が左、1弦が右。色と数字は左手の指。${steps[step]?.text||'形を確認'}`});
  svg.append(element('rect',{x:58,y:52,width:200,height:230,rx:9,fill:'#ece4d4'}));
  for(let i=0;i<6;i++){const x=58+i*40;svg.append(element('line',{x1:x,x2:x,y1:52,y2:282,'stroke-width':2.5-i*.27,stroke:'#898679'}),element('text',{x,y:307},`${6-i}弦`));}
  for(let f=0;f<=6;f++){const y=52+f*38;svg.append(element('line',{x1:58,x2:258,y1:y,y2:y,stroke:'#969a8e','stroke-width':f===0?6:2}));if(f<6)svg.append(element('text',{x:35,y:y+25},f+1));}
  const placed=new Set(steps.slice(0,step+1).map(s=>s.finger)),active=steps[step]?.finger;
  if(shape.barre){const b=shape.barre,y=52+(b.fret-.5)*38;svg.append(element('line',{x1:58+(6-b.from)*40,x2:58+(6-b.to)*40,y1:y,y2:y,stroke:colors[1],'stroke-width':23,'stroke-linecap':'round',opacity:placed.has(1)?1:.2}));}
  shape.frets.forEach((f,i)=>{const x=58+i*40,finger=shape.fingers[i];if(f<=0){svg.append(element('text',{x,y:31,class:'hand-open'},f<0?'×':'○'));return;}const y=52+(f-.5)*38;svg.append(element('circle',{cx:x,cy:y,r:finger===active?16:13,fill:colors[finger],opacity:placed.has(finger)?1:.2,stroke:finger===active?'#fffdf8':'none','stroke-width':3}),element('text',{x,y:y+5,fill:placed.has(finger)?'white':'#35463c',class:'hand-number',style:`fill:${placed.has(finger)?'white':'#35463c'}`},finger));});
  $('hand-diagram').replaceChildren(svg);
  $('hand-step-list').replaceChildren(...steps.map((s,i)=>{const b=document.createElement('button');b.type='button';b.dataset.step=i;b.setAttribute('aria-pressed',String(i===step));b.style.setProperty('--finger-color',colors[s.finger]);const badge=document.createElement('span');badge.className='hand-finger-badge';badge.textContent=s.finger;const words=document.createElement('span');words.textContent=s.text;b.append(badge,words);return b;}));
  $('hand-step-label').textContent=`${step+1} / ${steps.length} · ${FINGER_NAMES[active]}`;$('hand-prev').disabled=step===0;$('hand-next').disabled=step===steps.length-1;
  $('hand-grip-kind').textContent=shape.barre?'人差し指を横にする形（セーハ）':`${soundingStrings(shape).length}本の弦 · セーハなし`;
  $('hand-strings').textContent=`弾く弦：${soundingStrings(shape).join('・')}弦。×の弦は弾きません。`;
  $('hand-tips').replaceChildren(...gripTips(name,shape).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  for(const e of dialog.querySelectorAll('[data-hand-finger]')){const finger=Number(e.dataset.handFinger);e.style.opacity=finger===active?'1':'.3';}
 }
 function close(){destroyVideo();if(dialog.open)dialog.close();}
 async function loadVideo(){
  destroyVideo();const request=ticket,lesson=handLesson(name);$('hand-video-load').disabled=true;$('hand-video-status').textContent='手元の動画を準備しています…';
  try{const created=await lessonPlayer($('hand-player'),lesson.video,{
   onReady:e=>{if(request!==ticket||!dialog.open){e.target.destroy();return;}player=e.target;ready=true;const wasLoading=document.activeElement===$('hand-video-load');if(lesson.start){player.seekTo(lesson.start,true);player.pauseVideo();}$('hand-video-load').hidden=true;$('hand-video-load').disabled=false;$('hand-video-play').disabled=false;$('hand-video-pause').disabled=false;$('hand-video-status').textContent='準備できました。再生は自分で開始できます。';if(wasLoading){jumpTo('hand-video-section');$('hand-video-play').focus({preventScroll:true});}},
   onError:e=>{if(request!==ticket)return;destroyVideo();$('hand-video-load').disabled=false;$('hand-video-status').textContent=`動画を開けませんでした（${Number(e.data)||'通信'}）。配信元のリンクも使えます。`;}
  },()=>request===ticket&&dialog.open);if(request!==ticket||!dialog.open){created?.destroy();return;}player=created;
  }catch(e){if(request===ticket){$('hand-video-load').disabled=false;$('hand-video-status').textContent=e.message;}}
 }
 function jumpTo(id){const e=$(id);dialog.scrollTo({top:dialog.scrollTop+e.getBoundingClientRect().top-dialog.getBoundingClientRect().top-$('hand-header').offsetHeight-12,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 $('hand-to-steps').onclick=()=>jumpTo('hand-steps-section');$('hand-to-posture').onclick=()=>jumpTo('hand-posture-section');$('hand-to-video').onclick=()=>jumpTo('hand-video-section');
 $('hand-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{destroyVideo();document.body.classList.remove('hand-help-open');origin?.focus({preventScroll:true});});
 $('hand-shape').onchange=()=>{choice=Number($('hand-shape').value);step=0;draw();};
 $('hand-step-list').onclick=e=>{const b=e.target.closest('[data-step]');if(b){step=Number(b.dataset.step);draw();}};
 $('hand-next').onclick=()=>{step++;draw();};$('hand-prev').onclick=()=>{step--;draw();};$('hand-all').onclick=()=>{step=fingerSteps(choices[choice].shape).length-1;draw();};
 $('hand-video-load').onclick=loadVideo;$('hand-video-play').onclick=()=>{if(ready){jumpTo('hand-video-section');player.playVideo();}};$('hand-video-pause').onclick=()=>{if(ready)player.pauseVideo();};$('hand-source').onclick=()=>{if(ready)player.pauseVideo();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){destroyVideo();$('hand-video-load').disabled=false;$('hand-video-status').textContent='画面を離れたので動画を停止しました。';}});window.addEventListener('pagehide',close);
 return{close,open(options){const available=gripChoices(options.name,options.shape);if(!available.length)return;pausePractice();destroyVideo();name=options.name;choices=available;choice=0;step=0;capo=Number.isInteger(options.capo)?options.capo:0;origin=document.activeElement;
  $('hand-title').textContent=`${name} の手の作り方`;$('hand-capo').textContent=capo?`カポ${capo}。フレットはカポから数えます。`:'カポなし。フレットはナットから数えます。';
  $('hand-shape').replaceChildren(...choices.map((c,i)=>new Option(c.title,i)));$('hand-shape-label').hidden=choices.length===1;$('hand-shape-note').textContent=choices.length>1?'別の形は見比べ用です。練習の曲・判定の設定は変えません。':'';
  const lesson=handLesson(name);$('hand-video-title').textContent=`手元の動画：${lesson.title}`;$('hand-video-note').textContent=`${lesson.creator} · ${lesson.note}`;$('hand-source').href=lesson.page;$('hand-video-load').disabled=false;$('hand-video-status').textContent='押したときだけYouTubeへ接続します。動画は通信が必要です。';
  draw();document.body.classList.add('hand-help-open');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('hand-close').focus();
 }};
}
