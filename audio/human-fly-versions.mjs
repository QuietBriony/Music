// Authored versions of the existing Human Fly recording. No random selection,
// new recording, independent clock or timer. Bar positions follow its score.
export const VERSIONS = [
  {id:'shadow-dub',title:'Shadow Dub',note:'生ドラムと太いベース。声の語尾とギターの反響へ、短いシンセの返事。'},
  {id:'acid-drive',title:'Acid Drive',note:'303の低音と909系の四つ打ち。二つの山場とブレイクを経て、最後に戻る。'},
  {id:'acid-dub',title:'Acid Dub',note:'生ドラム＋303の低音。Dubの空間からアシッドへ広がり、声と余韻を残す。'}
];
export const WORKS=['custom',...VERSIONS.map(v=>v.id)];
const FORM=[
  [0,8,'space','導入'],[8,24,'groove','歌と低音'],[24,32,'build','最初の上昇'],
  [32,48,'peak','1回目の山'],[48,64,'groove','引き算'],[64,72,'build','2回目の上昇'],
  [72,88,'peak','2回目の山'],[88,96,'space','ブレイク'],[96,112,'peak','最後の戻り'],
  [112,118,'space','余韻']
];
const ANSWERS=[[9,10],[15,16],[21,23],[30,32],[42,44],[47,48],[58,60],[64,65],[68,69],[72,74],[82,84],[88,90],[98,100],[102,104],[110,112],[115,117]];
const clamp=x=>Math.max(0,Math.min(1,x));
export function versionScene(work,bar) {
  if(!VERSIONS.some(v=>v.id===work))throw Error('曲アレンジが見つかりません。');
  const index=FORM.findIndex(([a,b])=>bar>=a&&bar<b),row=FORM[index<0?FORM.length-1:index];
  const [start,end,id,name]=row,progress=clamp((bar-start)/(end-start));
  const scene={id,name,work,progress,remaining:Math.max(1,Math.ceil(end-bar)),bass:1,reply:0,kick:1,snare:1,hat:.7,open:.35,clap:0,cutoff:0,phase:start};
  if(work==='shadow-dub') {
    scene.bass=0;scene.reply=ANSWERS.some(([a,b])=>bar>=a&&bar<b)?.8:0;
    scene.cutoff=id==='peak'?4:-5;
  } else {
    const lift=work==='acid-drive'?1:.8;
    Object.assign(scene,id==='space'?{bass:.64,reply:0,kick:1,snare:0,hat:.25,open:0,clap:0,cutoff:-9}:
      id==='groove'?{bass:.9,reply:.22,kick:1,snare:.85,hat:.65,open:.2,clap:.15,cutoff:1}:
      id==='build'?{bass:1,reply:.45,kick:1,snare:.9,hat:.8,open:.4,clap:.4,cutoff:7}:
      {bass:1,reply:lift,kick:1,snare:1,hat:.9,open:.65,clap:.6,cutoff:start===96?19:14});
    if(start===0){scene.bass=bar<4?0:.62;scene.kick=bar<2?0:1;}
    if(start===48){scene.reply=0;scene.cutoff=-4;}
    // Eight-bar breakdown, then a two-bar rising pickup before the final drop.
    if(start===88){scene.bass=.55;scene.kick=0;scene.snare=0;scene.hat=0;scene.open=0;scene.clap=0;scene.cutoff=-14;
      if(bar>=94){scene.hat=.2+.6*clamp((bar-94)/2);scene.cutoff=-8+22*clamp((bar-94)/2);}}
    if(work==='acid-dub')scene.reply*=ANSWERS.some(([a,b])=>bar>=a&&bar<b)?1:.4;
  }
  // Tail follows the recording's end, rather than jumping back to bar zero.
  if(start===112){const fade=1-clamp((bar-112)/5.15);for(const k of ['bass','reply','kick','snare','hat','open','clap'])scene[k]*=fade;scene.cutoff=-8-16*(1-fade);}
  return scene;
}
const phrase=(notes,accents=[],slides=[])=>notes.map((n,i)=>({n,active:n!==null,accent:n!==null&&accents.includes(i),slide:n!==null&&slides.includes(i)}));
export function makeVersion(id,base) {
  if(!VERSIONS.some(v=>v.id===id))throw Error('曲アレンジが見つかりません。');
  const state=structuredClone(base),dub=id==='shadow-dub',hybrid=id==='acid-dub';
  state.auto=false;state.arrangement={auto:true,scene:'keep',progress:.5,work:id,gain:dub?2.3:hybrid?3.6:3.2};
  Object.assign(state.parts.bass,{enabled:!dub,locked:false,volume:hybrid?58:68,cutoff:hybrid?21:25,reso:hybrid?7.6:8.3,env:48,decay:27,delay:hybrid?26:12});
  Object.assign(state.parts.reply,{enabled:true,locked:false,volume:dub?33:hybrid?24:29,cutoff:dub?22:34,reso:dub?3.8:7.7,env:dub?22:52,decay:dub?48:21,delay:dub?54:hybrid?40:21});
  state.parts.bass.steps=phrase([0,null,null,0,0,null,3,null,0,null,0,4,0,null,3,null],[0,8,12],[3,10,14]);
  state.parts.reply.steps=dub?phrase([null,null,null,0,null,null,3,null,null,null,null,null,null,null,4,null],[6],[14]):
    phrase([null,null,3,null,null,0,null,null,null,4,null,3,null,null,0,null],[9],[5,14]);
  state.drums.enabled=!dub;
  for(const p of Object.values(state.drums.parts))p.locked=false;
  state.drums.parts.kick.enabled=!hybrid;state.drums.parts.snare.enabled=!hybrid;
  Object.assign(state.drums.parts.hat,{volume:hybrid?23:36,decay:19,tone:46});
  Object.assign(state.drums.parts.open,{volume:hybrid?18:25,decay:32,tone:43});
  Object.assign(state.drums.parts.clap,{volume:hybrid?18:28,decay:27});
  state.fx={echo:dub?42:hybrid?38:28,tone:36,room:dub?55:hybrid?52:36};
  const context={tempo:100,position:0,instruments:true,mastering:id==='acid-drive'?'blend':'dub',
    levels:{vocals:82,drums:dub?82:78,bass:82,other:id==='acid-drive'?52:76},
    enabled:{vocals:true,drums:id!=='acid-drive',bass:dub,other:true}};
  return {state,context};
}
export function versionNotes(work,part,bar,steps) {
  const next=steps.map(s=>({...s}));
  // Keep the two-bar hook; a single answer in bar four returns to the motif.
  if(work!=='custom'&&bar%4===3){
    const active=next.flatMap((s,i)=>s.active?[i]:[]),i=active.at(-1);
    if(i!==undefined){next[i].n=part==='bass'?3:0;next[i].accent=true;next[i].slide=false;}
  }
  return next;
}
export function versionDrums(work,id,bar,steps) {
  const next=[...steps];
  if(work!=='custom'&&id==='hat'&&bar%4===3)next[0]=0;
  return next;
}
