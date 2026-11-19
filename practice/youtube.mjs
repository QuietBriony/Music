import { videoId } from './singalong-core.mjs?v=46';
import {hasYouTubeConsent,requestYouTubeConsent} from './privacy.mjs?v=46';
let pending=null;
export function youtubeAPI(){
 if(!hasYouTubeConsent())return Promise.reject(new Error('YouTubeの動画を使う前に、規約とプライバシーを確認してください。'));
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const script=document.createElement('script'),previous=window.onYouTubeIframeAPIReady;
  const timer=setTimeout(()=>fail(),12000);
  const fail=()=>{clearTimeout(timer);script.remove();pending=null;reject(new Error('YouTubeを準備できませんでした。通信を確認するか、YouTubeで直接開いてください。'));};
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);if(typeof previous==='function')try{previous();}catch{}resolve(window.YT);};
  script.src='https://www.youtube.com/iframe_api';script.onerror=fail;document.head.append(script);
 });return pending;
}
export async function lessonPlayer(container,id,events,canCreate=()=>true,startSeconds=0){
 if(!videoId(id))throw new Error('YouTubeの動画IDを確認してください。');
 if(!await requestYouTubeConsent())throw new Error('動画を読み込まずに続けます。使うときは、もう一度読込ボタンを押してください。');
 if(!canCreate())return null;
 const api=await youtubeAPI();if(!hasYouTubeConsent()||!canCreate())return null;const frame=document.createElement('iframe');
 frame.title='YouTubeの参考演奏・レッスン';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
 const url=new URL(`https://www.youtube-nocookie.com/embed/${id}`);url.search=new URLSearchParams({enablejsapi:'1',playsinline:'1',autoplay:'0',origin:location.origin,rel:'0',hl:'ja'});
 if(Number.isFinite(startSeconds)&&startSeconds>0)url.searchParams.set('start',String(Math.floor(Math.min(startSeconds,43200))));
 frame.src=url.href;container.replaceChildren(frame);
 const protectedPlayers=new WeakMap();
 function protect(raw){
  if(protectedPlayers.has(raw))return protectedPlayers.get(raw);
  const timer=setInterval(()=>{if(!canPlayLesson(container))try{raw.pauseVideo();}catch{}},250);
  const proxy=new Proxy(raw,{get(target,key){
   if(key==='playVideo')return()=>{if(canPlayLesson(container))return target.playVideo();try{target.pauseVideo();}catch{}};
   if(key==='seekTo')return(...args)=>{const result=target.seekTo(...args);if(!canPlayLesson(container))try{target.pauseVideo();}catch{}return result;};
   if(key==='destroy')return()=>{clearInterval(timer);return target.destroy();};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});protectedPlayers.set(raw,proxy);return proxy;
 }
 const guarded=Object.fromEntries(Object.entries(events||{}).map(([name,callback])=>[name,event=>{
  const target=protect(event.target);
  if(name==='onStateChange'&&event.data===1&&!canPlayLesson(container)){try{event.target.pauseVideo();}catch{}return;}
  callback({...event,target});
 }]));
 return protect(new api.Player(frame,{events:guarded}));
}
// Scripted playback cannot resume a hidden, covered or undersized player.
// Pausing never implies permission to resume when the player becomes visible.
export function canPlayLesson(container){
 if(!hasYouTubeConsent()||document.hidden)return false;
 const frame=container.querySelector('iframe');if(!frame||!frame.isConnected||!frame.getClientRects().length)return false;
 const r=frame.getBoundingClientRect();if(r.width<200||r.height<200)return false;
 const left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
 if(Math.max(0,right-left)*Math.max(0,bottom-top)<r.width*r.height*.5)return false;
 return document.elementFromPoint((left+right)/2,(top+bottom)/2)===frame;
}
