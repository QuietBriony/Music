export const CONSENT_KEY='music-practice-youtube-consent-v1';
export const POLICY_VERSION='2026-11-19';
export const CONSENT_EVENT='practice-youtube-consent';
export const POLICY_OPEN_EVENT='practice-policy-open';
let sessionChoice=null,openDialog=null;
export function readConsent(storage){
 try{const value=JSON.parse(storage.getItem(CONSENT_KEY)||'null');return value?.version===POLICY_VERSION&&typeof value.accepted==='boolean'?value:null;}catch{return null;}
}
function choice(){try{return readConsent(localStorage)||sessionChoice;}catch{return sessionChoice;}}
export function hasYouTubeConsent(){return choice()?.accepted===true;}
export function requestYouTubeConsent(){return hasYouTubeConsent()?Promise.resolve(true):openDialog?openDialog():Promise.resolve(false);}
export function mountPrivacy(){
 const dialog=document.getElementById('practice-consent-dialog'),state=document.getElementById('practice-consent-state');let pending=null,resolve=null,opener=null;
 function refresh(){state.textContent=hasYouTubeConsent()?'YouTubeの動画を利用できます。取り消すと動画とそのマイク判定を止めます。':'YouTubeの動画を読み込まない設定です。調弦・内蔵譜・手元の歌詞は使えます。';}
 function open(){
  if(pending)return pending;opener=document.activeElement;
  pending=new Promise(done=>resolve=done);refresh();window.dispatchEvent(new Event(POLICY_OPEN_EVENT));dialog.showModal();return pending;
 }
 openDialog=open;
 function finish(accepted){
  sessionChoice={version:POLICY_VERSION,accepted,updatedAt:new Date().toISOString()};let saved=true;
  try{localStorage.setItem(CONSENT_KEY,JSON.stringify(sessionChoice));}catch{saved=false;}
  const done=resolve;resolve=null;pending=null;dialog.close();refresh();
  document.getElementById('practice-consent-save-state').textContent=saved?'選択をこの端末に保存しました。':'この画面では選択を使えます。端末に保存できないため、開き直したときは再確認します。';
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT,{detail:{accepted}}));done?.(accepted);opener?.focus?.({preventScroll:true});
 }
 document.getElementById('practice-consent-accept').onclick=()=>finish(true);
 document.getElementById('practice-consent-decline').onclick=()=>finish(false);
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 dialog.addEventListener('close',()=>{if(resolve){const done=resolve;resolve=null;pending=null;done(false);}});
 for(const button of document.querySelectorAll('[data-practice-privacy]'))button.addEventListener('click',()=>void open());
 window.addEventListener('storage',event=>{if(event.key===CONSENT_KEY||event.key===null){sessionChoice=null;refresh();window.dispatchEvent(new CustomEvent(CONSENT_EVENT,{detail:{accepted:hasYouTubeConsent()}}));}});
 refresh();if(!choice())void open();
}
