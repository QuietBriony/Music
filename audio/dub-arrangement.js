/* Human Fly: recorded-part dropouts and finite, beat-aligned loop scenes.
 * Uses short, tapered copies of the existing decoded buffers. No new media,
 * transport jump, pitch change, analysis, feedback or recurring timer. */
(function (root) {
  "use strict";
  const PARTS = ["vocals", "drums", "bass", "other"];
  const BASE = { vocals: 0.82, drums: 1, bass: 1, other: 0.76 };
  // cue, entry bar, loop entry/end, band return, parts, donor bar,
  // loop beats, drums out, bass out, final silent beats.
  const SCENES = [
    [0,14,14.5,15.5,16,["bass","other"],14,2,14,15.5,0],
    [1,30,30,32,33,["bass","other"],29.5,2,30,32,0],
    [3,62,62,63.5,64,["other"],61.5,1,63.5,62,0],
    [4,80,82,83.5,84,["drums"],81.5,2,83.5,83.5,0],
    [6,110,110,111,112,["bass","other"],109.5,2,110,111,1]
  ];
  const prepared = new WeakMap();
  function valueAt(points, second) {
    for (let i = 1; i < points.length; i++) {
      if (second > points[i][0]) continue;
      const [a,x] = points[i-1], [b,y] = points[i];
      return x + (y-x) * Math.max(0, Math.min(1, (second-a)/(b-a)));
    }
    return points.at(-1)[1];
  }
  function build(bpm, duration) {
    if(!Number.isFinite(bpm)||bpm<110||bpm>125||!Number.isFinite(duration)||duration<1||duration>600)throw new Error("Invalid Dub arrangement clock");
    const beat = 60 / bpm, bar = beat * 4;
    const scenes = SCENES.filter(s => s[4]*bar + 0.04 < duration).map((s,i) => ({
      id: i+1, cue: s[0], start: s[1]*bar, loopAt: s[2]*bar,
      echoAt: s[3]*bar, back: s[4]*bar, parts: [...s[5]],
      donor: s[6]*bar, cycle: s[7]*beat, drumsOut: s[8]*bar,
      bassOut: s[9]*bar, hush: s[10] ? s[4]*bar-s[10]*beat : null
    }));
    return { scenes, loops: scenes.flatMap(s => s.parts.map(part => ({
      scene: s.id, part, start: s.loopAt, end: s.echoAt,
      donor: s.donor, cycle: s.cycle
    }))) };
  }
  function override(points, windows) {
    const times = [...new Set([...points.map(p=>p[0]), ...windows.flatMap(w=>w.map(p=>p[0]))])].sort((a,b)=>a-b);
    return times.map(t => {
      const w = windows.find(w => t>=w[0][0] && t<=w.at(-1)[0]);
      return [t, valueAt(w || points, t)];
    });
  }
  function cut(at, back, normal) {
    return [[at-.03,normal],[at,0],[back-.02,0],[back,normal],[back+.04,normal]];
  }
  function apply(curves, bpm, duration, cues) {
    const {scenes} = build(bpm,duration), beat=60/bpm;
    for (const p of PARTS) {
      if (!curves[p]) curves[p] = { dry: [[0,BASE[p]]] };
      curves[p].source = [[0,1]];
    }
    const dry = Object.fromEntries(PARTS.map(p=>[p,[]]));
    const sources = Object.fromEntries(PARTS.map(p=>[p,[]]));
    const throws = [], wets = [];
    for (const s of scenes) {
      const [exit,,attack] = cues[s.cue];
      const voiceAt = exit === null ? s.start : exit+.10;
      dry.vocals.push([[voiceAt-.08,BASE.vocals],[voiceAt,0],[s.back-.02,0],[s.back,BASE.vocals],[s.back+.04,BASE.vocals]]);
      const out = s.parts.includes("other") ? s.echoAt : s.start;
      dry.other.push([[attack-.02,BASE.other],[out-.03,BASE.other],[out,0],[s.back-.02,0],[s.back,BASE.other],[s.back+.04,BASE.other]]);
      dry.drums.push(cut(s.drumsOut,s.back,1));
      dry.bass.push(cut(s.bassOut,s.back,1));
      for (const p of s.parts) sources[p].push(cut(s.loopAt,s.back,1));
      // Catch only the final turn of the repeating phrase, then let the
      // delay keep going while every direct part is out.
      const end = s.echoAt;
      throws.push([[end-beat*.8,0],[end-beat*.7,.62],[end-.03,.62],[end,0]]);
      wets.push([[s.start-.03,.6],[s.start,1],[s.back-.14,1],[s.back,.6]]);
    }
    for (const p of PARTS) {
      curves[p].dry = override(curves[p].dry,dry[p]);
      curves[p].source = override(curves[p].source,sources[p]);
    }
    // The scene throws do not overlap the earlier source-word throws.
    const send = curves.other.send;
    const times = [...new Set([...send.map(p=>p[0]),...throws.flatMap(w=>w.map(p=>p[0]))])].sort((a,b)=>a-b);
    curves.other.send = times.map(t=>[t,Math.max(valueAt(send,t),...throws.map(w=>t>=w[0][0]&&t<=w.at(-1)[0]?valueAt(w,t):0))]);
    for(const part of ["vocals","other"]){
      const old=curves[part].wet;
      const points=[...new Set([...old.map(p=>p[0]),...wets.flatMap(w=>w.map(p=>p[0]))])].sort((a,b)=>a-b);
      curves[part].wet=points.map(t=>[t,Math.max(valueAt(old,t),...wets.map(w=>t>=w[0][0]&&t<=w.at(-1)[0]?valueAt(w,t):.6))]);
    }
    return curves;
  }
  function echoGate(bpm,duration) {
    const hush=build(bpm,duration).scenes.find(s=>s.hush!==null)?.hush;
    return hush===undefined ? [[0,1]] : [[0,1],[hush-.03,1],[hush,0],[duration,0]];
  }
  function validateBuffers(buffers, options) {
    if (!buffers) throw new Error("Dub arrangement needs the four decoded stems");
    for (const p of PARTS) {
      const b=buffers[p];
      if (!b || typeof b.getChannelData!=="function" || !Number.isFinite(b.sampleRate) ||
          b.sampleRate<8000 || b.sampleRate>192000 || ![1,2].includes(b.numberOfChannels) ||
          !Number.isFinite(b.duration) || b.duration<1 || !Number.isInteger(b.length) ||
          Math.abs(b.length/b.sampleRate-b.duration)>.001) throw new Error("Invalid Dub stem buffer: "+p);
    }
    for (const job of build(options.bpm,options.duration).loops) {
      if (job.donor<0 || job.donor+job.cycle>buffers[job.part].duration) throw new Error("Dub loop exceeds source");
    }
  }
  function prepare(context,source,job) {
    let cache=prepared.get(source);if(!cache){cache=new Map();prepared.set(source,cache);}
    const from=Math.round(job.donor*source.sampleRate), length=Math.round(job.cycle*source.sampleRate), key=from+":"+length;
    if(cache.has(key))return cache.get(key);
    const b=context.createBuffer(source.numberOfChannels,length,source.sampleRate);
    const edge=Math.min(Math.round(source.sampleRate*.0025),Math.floor(length/4));
    for(let ch=0;ch<b.numberOfChannels;ch++){
      const x=b.getChannelData(ch);x.set(source.getChannelData(ch).subarray(from,from+length));
      for(let i=0;i<edge;i++){
        const gain=.5-.5*Math.cos(Math.PI*i/(edge-1));
        x[i]*=gain;x[length-1-i]*=gain;
      }
    }
    if(cache.size>=4)cache.delete(cache.keys().next().value);
    cache.set(key,b);return b;
  }
  function createLoops(context, options, buffers, targets, muted = {}) {
    validateBuffers(buffers,options);
    const nodes=[], sources=[], buses={}, jobs=[], unique=new Set();let dead=false;
    const keep=n=>{nodes.push(n);return n;};
    const now=context.currentTime, start=Math.max(now,options.at);
    const current=options.offset+Math.max(0,start-options.at)*options.rate;
    for(const job of build(options.bpm,options.duration).loops){
      if(job.end<=current)continue;
      if(!buses[job.part]){buses[job.part]=keep(context.createGain());buses[job.part].gain.value=muted[job.part]?0:1;buses[job.part].connect(targets[job.part]);}
      const buffer=prepare(context,buffers[job.part],job);unique.add(buffer);
      const at=options.at+(Math.max(current,job.start)-options.offset)/options.rate;
      const stopAt=options.at+(job.end-options.offset)/options.rate;
      const phase=Math.max(0,current-job.start)%buffer.duration;
      const src=keep(context.createBufferSource()), gain=keep(context.createGain());
      src.buffer=buffer;src.loop=true;src.loopStart=0;src.loopEnd=buffer.duration;src.playbackRate.value=options.rate;
      const fade=Math.min(.008/options.rate,(stopAt-at)/3);
      gain.gain.value=0;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(1,at+fade);
      gain.gain.setValueAtTime(1,stopAt-fade);gain.gain.linearRampToValueAtTime(0,stopAt);
      src.connect(gain);gain.connect(buses[job.part]);src.start(at,phase);src.stop(stopAt);sources.push(src);
      jobs.push({...job,at,stopAt,phase,cycleSeconds:buffer.duration});
    }
    // Drop the source map from this closure; only the short prepared loops
    // are referenced by running nodes. The parent owns original buffers.
    buffers=null;
    return {
      setMuted(part,muted){const p=buses[part]?.gain;if(!p)return;const t=context.currentTime;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(muted?0:1,t+.015);},
      diagnostics(){return{nodes:dead?0:nodes.length,bytes:[...unique].reduce((s,b)=>s+b.length*b.numberOfChannels*4,0),jobs,active:dead?0:jobs.filter(j=>j.at<=context.currentTime&&j.stopAt>context.currentTime).length};},
      destroy(){if(dead)return;dead=true;for(const s of sources){try{s.stop(context.currentTime);}catch{}}for(const n of nodes)n.disconnect();for(const s of sources){try{s.buffer=null;}catch{}}unique.clear();},
      fade(){const t=context.currentTime;for(const b of Object.values(buses)){b.gain.cancelScheduledValues(t);b.gain.setValueAtTime(b.gain.value,t);b.gain.linearRampToValueAtTime(0,t+.015);}}
    };
  }
  root.RecordedDubArrangement=Object.freeze({build,apply,echoGate,validateBuffers,createLoops,valueAt});
})(globalThis);
