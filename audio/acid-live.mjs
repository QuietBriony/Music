import { TB303 } from '../experiments/workbench/v1/third_party/acidbros/js/audio/TB303.js?v=br-441';
import { PARTS, defaults, validate, stepsForBar, chordAt, voiceSteps, voiceParams } from './acid-live-state.mjs?v=4';
import { DRUMS, createDrumVoices } from './acid-live-drums.mjs?v=1';
import { sceneAt, effective303, drumPattern } from './acid-live-scenes.mjs?v=3';
import { sourceStepSeconds } from './human-fly-versions.mjs?v=2';

// Reuse acidBros voices, but let Band Room own the context, output and clock.
// Only one future event is owned here; no interval or independent transport.
export function createAcidLive({context, transport, createFilter, loadFilter, connect, onStatus = () => {}, drumFactory=createDrumVoices}) {
  let config=defaults(), prepared=false, preparing=null, fallback=false, generation=0, event=null, anchor=null, graph=null, lastBar=-1, played=0, cached=null;
  let holds={},lastScene=null;
  let followReturn=false,lastStep=-1;
  function clearEvent() { if (event !== null) transport.clear(event); event=null; }
  function retire() {
    if (!graph) return;
    const now=context.currentTime;
    // Disconnect the shared bus too: already scheduled old notes cannot leak
    // into a quick restart, even if their individual oscillators end later.
    graph.output.gain.cancelScheduledValues(now); graph.output.gain.setValueAtTime(0,now);
    graph.output.disconnect();
    for (const part of PARTS) {
      const v=graph.voices[part];v?.stop(now);
      for (const n of [v?.delayNode,v?.feedbackGain,v?.wetGain,graph.levels[part]]) n?.disconnect();
    }
    graph.drums?.dispose();
    graph=null;
  }
  function stop() { generation++;clearEvent();retire();anchor=null;lastBar=-1;lastStep=-1;cached=null;holds={};lastScene=null; }
  function levels(time=context.currentTime,position=Math.max(0,lastStep)/16) {
    if (!graph) return;
    const mix=.22*(config.arrangement.gain??1);
    if(graph.lastMix!==mix){graph.lastMix=mix;graph.output.gain.cancelScheduledValues(time);graph.output.gain.setTargetAtTime(mix,time,.035);}
    const scene=sceneAt(config.arrangement,position);
    for (const p of PARTS) {
      const value=effective303(config.parts[p],p,scene,(holds[p]||0)>position).gain;
      if(graph.last[p]===value)continue;graph.last[p]=value;
      const param=graph.levels[p].gain;
      param.cancelScheduledValues(time);param.setTargetAtTime(value,time,.035);
    }
    if(config.drums.enabled&&!graph.drums)graph.drums=drumFactory(context,graph.output);
    if(graph.drums)for(const[id]of DRUMS){const p=config.drums.parts[id],scale=p.locked||(holds[id]||0)>position?1:scene[id];graph.drums.level(id,config.drums.enabled&&p.enabled?p.volume/100*scale:0,time);}
  }
  function build() {
    const output=context.createGain();output.gain.value=.22;connect(output);
    const voices={}, gains={};
    for (const p of PARTS) {
      const gain=context.createGain();gain.gain.value=config.parts[p].volume/100;gain.connect(output);gains[p]=gain;
    }
    graph={output,voices,levels:gains,last:{},drums:null};levels(context.currentTime,anchor.offset*anchor.bpm/240);
  }
  function enqueue(index, token) {
    if (token!==generation || !anchor || !graph) return;
    const earliest=anchor.offset+Math.max(0,context.currentTime+.012-anchor.at)*anchor.rate;
    // Each recorded attack is within one sixteenth of the score. Start one
    // step back on seek/resume so a late kick in that step is still reachable.
    index=Math.max(index,Math.floor(earliest*anchor.bpm/15)-1);
    let content=sourceStepSeconds(index,anchor.bpm,followReturn);
    while(content<earliest-1e-8) content=sourceStepSeconds(++index,anchor.bpm,followReturn);
    if (content>=anchor.duration) { stop();return; }
    const at=anchor.at+(content-anchor.offset)/anchor.rate;
    const ticks=transport.getTicksAtTime(at);
    event=transport.scheduleOnce(() => {
      if (token!==generation || !anchor || !graph) return;
      event=null;
      lastStep=index;
      const bar=Math.floor(index/16), step=index%16;
      if (at>=context.currentTime-.025 && context.state==='running') {
        const chord=chordAt(anchor.song,bar);
        const scene=sceneAt(config.arrangement,index/16);lastScene=scene;levels(Math.max(at,context.currentTime),index/16);
        if (!cached || cached.bar!==bar) {
          const phrase=(part,measure,root)=>voiceSteps(stepsForBar(config,part,measure,(holds[part]||0)>measure),part,root);
          const prior=Math.max(0,bar-1), priorChord=chordAt(anchor.song,prior);
          cached={bar,sequences:Object.fromEntries(PARTS.map(p=>[p,phrase(p,bar,chord)])),
            previous:Object.fromEntries(PARTS.map(p=>[p,phrase(p,prior,priorChord)[15]]))};
        }
        for (const p of PARTS) {
          const settings=effective303(config.parts[p],p,scene,(holds[p]||0)>index/16);
          if(!config.parts[p].enabled||settings.gain===0){graph.voices[p]?.stop(Math.max(at,context.currentTime));continue;}
          const sequence=cached.sequences[p],previous=step===0?cached.previous[p]:sequence[step-1];
          if(!graph.voices[p]&&sequence[step].active)graph.voices[p]=new TB303(context,graph.levels[p],{createFilter});
          graph.voices[p]?.processStep(Math.max(at,context.currentTime),step,sequence,voiceParams(settings,anchor.rate),anchor.bpm*anchor.rate,sequence[step],previous);
        }
        if(graph.drums&&config.drums.enabled)for(const[id]of DRUMS){const p=config.drums.parts[id],held=(holds[id]||0)>index/16,hit=drumPattern(config.drums,id,bar,scene,held)[step];if(p.enabled&&p.volume>0&&hit&&(p.locked||held||scene[id]>0))graph.drums.trigger(id,Math.max(at,context.currentTime),p,hit);}
        played++;
        if (lastBar!==bar) { lastBar=bar;onStatus({bar:bar+1,chord,auto:config.auto,scene,sceneAuto:config.arrangement.auto}); }
      }
      enqueue(index+1,token);
    },`${Math.round(ticks)}i`); // Tone 14's tick-string parser accepts integers only.
  }
  function validClock(options) {
    if (![options.at,options.offset,options.bpm,options.rate,options.duration].every(Number.isFinite) || options.bpm<60 || options.bpm>200 || options.rate<.5 || options.rate>2 || options.offset<0 || options.at<context.currentTime-.03 || options.offset>=options.duration) throw Error('Acidの再生時計が不正です。');
  }
  return {
    async prepare() {
      if (!prepared && !preparing) preparing=Promise.resolve().then(loadFilter).catch(()=>{fallback=true;}).then(()=>{prepared=true;}).finally(()=>{preparing=null;});
      await preparing;
    },
    configure(value,{part}={}) {
      config=validate(value);
      const wasFollowing=followReturn;
      followReturn=config.arrangement.auto && config.arrangement.work==='acid-dub';
      if(part)holds[part]=Math.max(0,lastBar)+2;
      cached=null;levels();
      if(event!==null && wasFollowing!==followReturn){clearEvent();enqueue(lastStep+1,++generation);}
    },
    start(options) {
      stop();
      if (!prepared) throw Error('303の準備が終わっていません。');
      validClock(options);
      anchor={...options};build();played=0;enqueue(0,generation);
    },
    retime(options) {
      if (!graph) return this.start(options);
      validClock(options);generation++;clearEvent();anchor={...options};cached=null;lastStep=-1;
      enqueue(0,generation);
    },
    stop,
    diagnostics:()=>({prepared,fallback,active:!!graph,ownedEvents:event===null?0:1,voices:graph?Object.keys(graph.voices).length:0,drums:graph?.drums?.diagnostics()||null,scene:lastScene?.id||null,phase:lastScene?.phase??null,sceneName:lastScene?.name||null,work:config.arrangement.work,sceneAuto:config.arrangement.auto,played,bar:lastBar+1,anchor:anchor?{at:anchor.at,offset:anchor.offset,rate:anchor.rate,bpm:anchor.bpm}:null}),
    dispose:stop
  };
}
