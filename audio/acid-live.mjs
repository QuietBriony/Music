import { TB303 } from '../experiments/workbench/v1/third_party/acidbros/js/audio/TB303.js?v=br-441';
import { PARTS, defaults, validate, stepsForBar, chordAt, voiceSteps, voiceParams } from './acid-live-state.mjs?v=1';

// Reuse acidBros voices, but let Band Room own the context, output and clock.
// Only one future event is owned here; no interval or independent transport.
export function createAcidLive({context, transport, createFilter, loadFilter, connect, onStatus = () => {}}) {
  let config=defaults(), prepared=false, preparing=null, fallback=false, generation=0, event=null, anchor=null, graph=null, lastBar=-1, played=0, cached=null;
  function clearEvent() { if (event !== null) transport.clear(event); event=null; }
  function retire() {
    if (!graph) return;
    const now=context.currentTime;
    // Disconnect the shared bus too: already scheduled old notes cannot leak
    // into a quick restart, even if their individual oscillators end later.
    graph.output.gain.cancelScheduledValues(now); graph.output.gain.setValueAtTime(0,now);
    graph.output.disconnect();
    for (const part of PARTS) {
      const v=graph.voices[part];v.stop(now);
      for (const n of [v.delayNode,v.feedbackGain,v.wetGain,graph.levels[part]]) n.disconnect();
    }
    graph=null;
  }
  function stop() { generation++;clearEvent();retire();anchor=null;lastBar=-1;cached=null; }
  function levels() {
    if (!graph) return;
    for (const p of PARTS) {
      const param=graph.levels[p].gain;
      param.cancelScheduledValues(context.currentTime);
      param.setTargetAtTime(config.parts[p].volume/100,context.currentTime,.015);
    }
  }
  function build() {
    const output=context.createGain();output.gain.value=.22;connect(output);
    const voices={}, gains={};
    for (const p of PARTS) {
      const gain=context.createGain();gain.gain.value=config.parts[p].volume/100;gain.connect(output);gains[p]=gain;
      voices[p]=new TB303(context,gain,{createFilter});
    }
    graph={output,voices,levels:gains};
  }
  function enqueue(index, token) {
    if (token!==generation || !anchor || !graph) return;
    const sixteenth=15/anchor.bpm;
    // Skip missed beats instead of emitting a burst after a blocked UI/resume.
    index=Math.max(index,Math.ceil((anchor.offset+Math.max(0,context.currentTime+.012-anchor.at)*anchor.rate)/sixteenth-1e-7));
    const content=index*sixteenth;
    if (content>=anchor.duration) { stop();return; }
    const at=anchor.at+(content-anchor.offset)/anchor.rate;
    const ticks=transport.getTicksAtTime(at);
    event=transport.scheduleOnce(() => {
      event=null;
      if (token!==generation || !anchor || !graph) return;
      const bar=Math.floor(index/16), step=index%16;
      if (at>=context.currentTime-.025 && context.state==='running') {
        const chord=chordAt(anchor.song,bar);
        if (!cached || cached.bar!==bar) cached={bar, sequences:Object.fromEntries(PARTS.map(p=>[p,voiceSteps(stepsForBar(config,p,bar),p,chord)])),
          previous:Object.fromEntries(PARTS.map(p=>[p,voiceSteps(stepsForBar(config,p,Math.max(0,bar-1)),p,chordAt(anchor.song,Math.max(0,bar-1)))[15]]))};
        for (const p of PARTS) {
          const sequence=cached.sequences[p],previous=step===0?cached.previous[p]:sequence[step-1];
          graph.voices[p].processStep(Math.max(at,context.currentTime),step,sequence,voiceParams(config.parts[p],anchor.rate),anchor.bpm*anchor.rate,sequence[step],previous);
        }
        played++;
        if (lastBar!==bar) { lastBar=bar;onStatus({bar:bar+1,chord,auto:config.auto}); }
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
    configure(value) { config=validate(value);cached=null;levels(); },
    start(options) {
      stop();
      if (!prepared) throw Error('303の準備が終わっていません。');
      validClock(options);
      anchor={...options};build();played=0;enqueue(Math.ceil(options.offset*options.bpm/15-1e-7),generation);
    },
    retime(options) {
      if (!graph) return this.start(options);
      validClock(options);generation++;clearEvent();anchor={...options};cached=null;
      enqueue(Math.ceil(options.offset*options.bpm/15-1e-7),generation);
    },
    stop,
    diagnostics:()=>({prepared,fallback,active:!!graph,ownedEvents:event===null?0:1,voices:graph?2:0,played,bar:lastBar+1,anchor:anchor?{at:anchor.at,offset:anchor.offset,rate:anchor.rate,bpm:anchor.bpm}:null}),
    dispose:stop
  };
}
