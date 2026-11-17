// This selection stores only a verse number. Lyrics and score progress keep
// their existing independent stores; choosing a verse never replaces user text.
export const MINYO_VERSE_STORAGE='music-practice-minyo-verses-v1';
export const MINYO_VERSES={
 'song:tinsagu':[1,2,3],
 'song:tsukinu':[1,2,3]
};
export function minyoVerse(session,number){
 if(!Object.hasOwn(MINYO_VERSES,session))return null;
 const verse=MINYO_VERSES[session].includes(number)?number:1;
 return{verse,key:verse===1?session:`${session}:verse:${verse}`};
}
export function readMinyoVerses(storage){
 try{
  const data=JSON.parse(storage.getItem(MINYO_VERSE_STORAGE)||'null');
  return Object.fromEntries(Object.keys(MINYO_VERSES).map(key=>[key,minyoVerse(key,data?.[key]).verse]));
 }catch{return{};}
}
export function mountMinyoVerses({onChange}){
 const controls=[...document.querySelectorAll('[data-minyo-verse]')];let selected={},active=null;
 try{selected=readMinyoVerses(localStorage);}catch{/* Storage itself can be unavailable. */}
 function update(){
  const choice=minyoVerse(active,selected[active]);
  for(const control of controls){
   control.closest('[data-minyo-verse-choice]').hidden=!choice;
   if(!choice)continue;
   if(control.dataset.song!==active){control.replaceChildren(...MINYO_VERSES[active].map(n=>new Option(`${n}番`,n)));control.dataset.song=active;}
   control.value=choice.verse;
  }
  return choice;
 }
 for(const control of controls)control.onchange=()=>{
  const choice=minyoVerse(active,Number(control.value));if(!choice||choice.verse===selected[active])return;
  selected[active]=choice.verse;let saved=true;try{localStorage.setItem(MINYO_VERSE_STORAGE,JSON.stringify(selected));}catch{saved=false;}
  update();onChange(choice,{saved});
 };
 return{use(session,{disabled=false}={}){active=session;for(const control of controls)control.disabled=disabled;return update();},choice(session){return minyoVerse(session,selected[session]);}};
}
