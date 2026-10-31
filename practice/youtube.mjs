import { videoId } from './singalong-core.mjs?v=23';
let pending=null;
export function youtubeAPI(){
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
 const api=await youtubeAPI();if(!canCreate())return null;const frame=document.createElement('iframe');
 frame.title='YouTubeの参考演奏・レッスン';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
 const url=new URL(`https://www.youtube-nocookie.com/embed/${id}`);url.search=new URLSearchParams({enablejsapi:'1',playsinline:'1',autoplay:'0',origin:location.origin,rel:'0',hl:'ja'});
 if(Number.isFinite(startSeconds)&&startSeconds>0)url.searchParams.set('start',String(Math.floor(Math.min(startSeconds,43200))));
 frame.src=url.href;container.replaceChildren(frame);return new api.Player(frame,{events});
}
