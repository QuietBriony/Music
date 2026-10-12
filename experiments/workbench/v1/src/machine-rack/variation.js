// Small variations of the current motif, not another whole-pattern randomizer.
// No new notes, voices, levels or tempo: leave room for the player's controls.
const pick = (items, random) => items[Math.min(items.length-1, Math.floor(random()*items.length))];
const nudge = (value, random) => Math.max(0, Math.min(100, value + (value > 94 ? -6 : value < 6 ? 6 : random()<.5 ? -6 : 6)));
export function varyVoice(voice, synth, turn, random=Math.random) {
  const next=structuredClone(voice), steps=synth?next.sequence:next.steps;
  const active=steps.map((s,i)=>(synth?s.active:s)?i:-1).filter(i=>i>=0);
  if (!active.length) return null;
  const mode=turn%3;
  if (mode===2) {
    const tone=synth?next.settings:next;
    const keys=synth?['cutoff','env','decay']:['decay','tone','snappy','ch_decay','oh_decay'];
    const key=pick(keys.filter(k=>Number.isFinite(tone[k])),random);
    if (key) { tone[key]=nudge(tone[key],random);return {voice:next,detail:'音色を少し'}; }
  }
  if (mode===1) {
    // Keep every main beat and the number of hits. Move one offbeat into space.
    const moves=active.filter(i=>i%4!==0).flatMap(from=>[-2,2].map(d=>({from,to:(from+d+16)%16})))
      .filter(({to})=>to%4!==0 && !(synth?steps[to].active:steps[to]));
    const move=pick(moves,random);
    if (move) {
      if(synth) { const rest=steps[move.to];steps[move.to]=steps[move.from];steps[move.from]={...rest,active:false,slide:false}; }
      else { steps[move.to]=steps[move.from];steps[move.from]=0; }
      return {voice:next,detail:'裏拍を少し'};
    }
  }
  const i=pick(active,random);
  if(synth) { const key=turn%2?'slide':'accent';steps[i][key]=!steps[i][key]; }
  else steps[i]=steps[i]===2?1:2;
  return {voice:next,detail:synth&&turn%2?'スライドを少し':'アクセントを少し'};
}
