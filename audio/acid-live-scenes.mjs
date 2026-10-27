export const SCENES = [
  {id:'space',name:'余白',bass:.7,reply:0,kick:.65,snare:0,hat:.35,open:0,clap:0,cutoff:-10},
  {id:'groove',name:'グルーヴ',bass:1,reply:.35,kick:1,snare:.85,hat:.7,open:.25,clap:0,cutoff:0},
  {id:'build',name:'ビルド',bass:.95,reply:.65,kick:1,snare:.85,hat:.95,open:.45,clap:.25,cutoff:12},
  {id:'peak',name:'山場',bass:1,reply:1,kick:1,snare:1,hat:1,open:1,clap:.7,cutoff:18},
];
const ARC=[[0,'space'],[8,'groove'],[24,'build'],[32,'peak'],[48,'space'],[56,'peak'],[64,null]];
const KEEP={id:'keep',name:'そのまま',bass:1,reply:1,kick:1,snare:1,hat:1,open:1,clap:1,cutoff:0};
export function sceneSettings(value) {
  if(!value || typeof value.auto!=='boolean' || ![KEEP,...SCENES].some(s=>s.id===value.scene) || !Number.isFinite(value.progress) || value.progress<0 || value.progress>1)throw Error('展開の設定が不正です。');
  return {auto:value.auto,scene:value.scene,progress:value.progress};
}
export function sceneAt(settings,bar) {
  if(!settings.auto)return {...[KEEP,...SCENES].find(s=>s.id===settings.scene),progress:settings.progress,remaining:0};
  const position=((bar%64)+64)%64;
  const index=ARC.findIndex((s,i)=>i<ARC.length-1 && position>=s[0] && position<ARC[i+1][0]);
  const [start,id]=ARC[index],end=ARC[index+1][0];
  return {...SCENES.find(s=>s.id===id),progress:(position-start)/(end-start),remaining:Math.ceil(end-position)};
}
export function effective303(part,id,scene,held=false) {
  if(part.locked||held)return {...part,gain:part.enabled?part.volume/100:0};
  const lift=scene.cutoff+(scene.id==='build'?18*scene.progress:0);
  return {...part,cutoff:Math.max(0,Math.min(100,part.cutoff+lift)),
    env:Math.max(0,Math.min(100,part.env+(scene.id==='build'?8*scene.progress:0))),
    gain:part.enabled?part.volume/100*scene[id]:0};
}
export function drumPattern(config,id,bar,scene,held=false) {
  const track=config.parts[id],steps=[...track.steps];
  // One authored turnaround at the end of a build, then the motif returns.
  if(!held && !track.locked && config.enabled && scene.id==='build' && scene.remaining===1 && id==='snare') {
    steps[14]=1;steps[15]=2;
  }
  return steps;
}
