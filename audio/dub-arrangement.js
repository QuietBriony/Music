/* Human Fly version: rhythm phrases stay up under moving tape echoes.
 * Static source-backed cues; no runtime analysis or repeating JS clock. */
(function (root) {
  "use strict";
  const PARTS = ["vocals", "drums", "bass", "other"];
  const SECTIONS = [[0,"intro"],[8,"song"],[24,"rhythm-version"],[40,"voice-return"],[56,"groove-version"],[64,"guitar-space"],[88,"echo-answer"],[96,"song-return"],[104,"dub-outro"]];
  const VOICES = [17.085, 28.595, 40.285, 52.295, 59.985, 84.075, 94.255, 113.405, 117.665, 125.245, 129.845, 136.295, 144.765, 165.315, 176.205, 194.785, 202.445, 216.115, 224.175, 227.235, 233.315];
  const GUITARS = [5.36, 9.82, 14.04, 17.54, 21.66, 25.74, 29.64, 34.06, 38.2, 46.73, 50.71, 54.39, 58.73, 62.65, 67.13, 71.05, 74.9, 79.3, 83.33, 86.89, 91.43, 95.22, 99.13, 103.29, 108.04, 112.08, 115.85, 119.87, 123.61, 128.3, 131.92, 136.26, 140.58, 144.78, 148.91, 152.86, 161.21, 164.48, 168.99, 172.72, 177.27, 181.17, 185.34, 189.8, 193.76, 197.69, 201.76, 205.99, 209.7, 213.92, 218.38, 221.99, 226.44, 230.13];
  const SNARES = [11.345, 14.465, 18.515, 23.525, 28.545, 31.555, 34.515, 40.245, 47.835, 52.605, 55.435, 60.225, 63.025, 67.825, 71.615, 77.495, 87.305, 91.325, 97.195, 100.145, 105.795, 109.585, 113.325, 116.125, 122.025, 123.985, 129.845, 136.775, 141.975, 146.675, 149.745, 152.555, 178.215, 187.545, 190.995, 195.315, 198.285, 204.165, 205.755, 212.225, 216.085, 218.125, 224.195, 228.245, 231.295];
  const prepared = new WeakMap();
  function valueAt(points, second) {
    for (let i = 1; i < points.length; i++) {
      if (second > points[i][0]) continue;
      const [a,x] = points[i-1], [b,y] = points[i];
      return x + (y-x) * Math.max(0, Math.min(1, (second-a)/(b-a)));
    }
    return points.at(-1)[1];
  }
  function build(bpm,duration) {
    if(!Number.isFinite(bpm)||bpm<110||bpm>125||!Number.isFinite(duration)||duration<1||duration>600)throw new Error("Invalid Dub arrangement clock");
    const bar=240/bpm;
    const scenes=SECTIONS.filter(s=>s[0]*bar<duration).map((s,i)=>({id:i+1,name:s[1],start:s[0]*bar,end:Math.min(duration,(SECTIONS[i+1]?.[0]??duration/bar)*bar)}));
    const loops=64*bar+.04<duration ? ["bass","drums"].map(part=>({scene:5,part,start:56*bar,end:64*bar,donor:58*bar,cycle:2*bar})) : [];
    return {scenes,loops};
  }
  function overlay(points,windows,lift=false) {
    const times=[...new Set([...points.map(p=>p[0]),...windows.flatMap(w=>w.map(p=>p[0]))])].sort((a,b)=>a-b);
    return times.map(t=>{
      const active=windows.filter(w=>t>=w[0][0]&&t<=w.at(-1)[0]);
      return [t,active.length ? (lift?Math.max(valueAt(points,t),...active.map(w=>valueAt(w,t))):valueAt(active.at(-1),t)) : valueAt(points,t)];
    });
  }
  function plan(bpm,duration) {
    const {loops}=build(bpm,duration),bar=240/bpm,beat=bar/4;
    function rides(values,fade=1.1) {
      const points=[[0,values[0]]];
      for(let i=1;i<SECTIONS.length;i++){
        const at=SECTIONS[i][0]*bar;if(at>=duration)break;
        points.push([Math.max(points.at(-1)[0]+.001,at-fade),values[i-1]],[at,values[i]]);
      }
      points.push([duration,points.at(-1)[1]]);return points;
    }
    const curves={
      vocals:{dry:rides([.76,.80,.08,.76,.06,.10,.12,.80,.08]),tone:[[0,18000]]},
      other:{dry:rides([.58,.36,.08,.48,.04,.52,.07,.48,.06]),tone:rides([2800,5400,1800,6200,1300,6200,1900,5800,1600],3)},
      drums:{dry:[[0,1],[duration,1]],tone:rides([10500,10500,6800,10800,3800,11000,6200,11000,6600],2)},
      bass:{dry:[[0,1.08],[duration,1.08]],tone:[[0,4200],[duration,4200]]}
    };
    for(const p of PARTS)curves[p].source=[[0,1],[duration,1]];
    for(const j of loops)curves[j.part].source=overlay(curves[j.part].source,[[[j.start,1],[j.start+.008,0],[j.end-.008,0],[j.end,1]]]);
    for(const [part,events]of [["vocals",VOICES],["other",GUITARS],["drums",SNARES]]){
      const c=curves[part],isVoice=part==="vocals",isGuitar=part==="other",baseFeedback=isVoice?.36:isGuitar?.43:.30;
      c.send=[[0,0],[duration,0]];c.feedback=[[0,baseFeedback],[duration,baseFeedback]];
      c.wet=rides(isVoice?[.68,.62,.94,.68,1,.92,.98,.65,1]:isGuitar?[.92,.78,1,.80,1.08,.98,1.10,.80,1.12]:[.42,.38,.62,.42,.68,.58,.68,.42,.72]);
      c.cutoff=rides(isVoice?[4400,4400,2400,4600,1900,3400,2100,4600,1800]:isGuitar?[3800,4600,1700,5200,1400,5200,1900,4800,1400]:[4700,4700,2800,4900,2300,4900,2600,4900,2100],2);
      c.pan=[[0,0],[duration,0]];c.drift=[[0,1],[duration,1]];
      const sends=[],feedback=[],pan=[],hooks=[],drift=[];let n=0;
      // Translate snare sends with the repeated two-bar rhythm phrase.
      const actual=part==="drums"&&loops.length ? events.filter(t=>t<loops[0].start||t>=loops[0].end).concat(...[0,1,2,3].map(i=>events.filter(t=>t>=58*bar&&t<60*bar).map(t=>t-2*bar+i*2*bar))).sort((a,b)=>a-b) : events;
      for(const t of actual){
        if(t<.8||t+beat*6>=duration)continue;
        const a=isVoice?t-.44:t+.012,b=isVoice?t+.025:t+(isGuitar?.19:.085),amount=isVoice?.64:isGuitar?1.35:.62;
        sends.push([[a-.035,0],[a,amount],[b,amount],[b+.06,0]]);
        feedback.push([[a-.06,baseFeedback],[a,.64+(isGuitar?.045:0)],[t+beat*2,.64+(isGuitar?.045:0)],[t+beat*6,baseFeedback]]);
        const side=(n++%2?1:-1)*(isGuitar?.38:isVoice?.22:.24);
        pan.push([[a-.05,0],[a,side],[t+beat*3,side],[t+beat*6,0]]);
        drift.push([[a-.05,1],[a+.1,1.003],[t+beat*2,.998],[t+beat*6,1]]);
        if(isGuitar||isVoice){
          const start=isVoice?t-.72:t-.015,end=isVoice?t+.045:t+.22,high=isVoice?.72:.52;
          hooks.push([[start-.06,valueAt(c.dry,start-.06)],[start,Math.max(high,valueAt(c.dry,start))],[end,Math.max(high,valueAt(c.dry,end))],[end+.18,valueAt(c.dry,end+.18)]]);
        }
      }
      c.send=overlay(c.send,sends,true);c.feedback=overlay(c.feedback,feedback,true);c.pan=overlay(c.pan,pan);c.drift=overlay(c.drift,drift);
      if(hooks.length)c.dry=overlay(c.dry,hooks,true);
      const at=Math.min(duration-1,234.7);c.wet=overlay(c.wet,[[[at,valueAt(c.wet,at)],[duration,0]]]);
    }
    return curves;
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
  root.RecordedDubArrangement=Object.freeze({build,plan,validateBuffers,createLoops,valueAt});
})(globalThis);
