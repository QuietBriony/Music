// Analysis-only input gain. Microphone audio is never sent to audible output.
const KEY='music-practice-mic-gain-v1';
export const MIC_GAIN_CHOICES=[{value:1,label:'通常'},{value:4,label:'少し拾いやすく'},{value:8,label:'小さな音も拾う（おすすめ）'},{value:16,label:'さらに小さな音'}];
const valid=value=>MIC_GAIN_CHOICES.some(c=>c.value===Number(value))?Number(value):8;
export function readMicGain(){try{return valid(localStorage.getItem(KEY));}catch{return 8;}}
export class MicInputBoost{
 constructor(ctx,source,analyser,value=readMicGain()){
  this.ctx=ctx;this.node=ctx.createGain();this.node.gain.value=valid(value);this.readyAt=0;this.pending=false;
  source.connect(this.node);this.node.connect(analyser);
 }
 set(value,now=performance.now()){
  this.node.gain.cancelScheduledValues(this.ctx.currentTime);
  this.node.gain.setTargetAtTime(valid(value),this.ctx.currentTime,.025);this.readyAt=now+250;this.pending=true;
 }
 settling(tracker,rms,now=performance.now()){
  if(now>=this.readyAt&&!this.pending)return false;
  this.pending=false;
  // A gain change is not a new pluck. Establish its envelope before allowing
  // either follower to detect a new attack, retaining its last accepted note.
  tracker.candidateAt=null;tracker.candidate=null;tracker.since=null;tracker.quietAt=null;tracker.lastRms=rms;
  if(('lastMidi' in tracker?tracker.lastMidi:tracker.last)!==null)tracker.armed=false;
  return true;
 }
 disconnect(){try{this.node.disconnect();}catch{/* Already stopped. */}}
}
export function mountMicGainControls(selects,onChange){
 const controls=selects.map(id=>document.getElementById(id));let value=readMicGain();
 for(const control of controls){
  control.replaceChildren(...MIC_GAIN_CHOICES.map(c=>new Option(c.label,c.value)));control.value=value;
  control.onchange=()=>{value=valid(control.value);try{localStorage.setItem(KEY,String(value));}catch{/* Optional. */}for(const other of controls)other.value=value;onChange(value);};
 }
}
