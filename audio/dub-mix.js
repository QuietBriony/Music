/* Human Fly console version: three damped tape-echo buses, a short resonant
 * drum return, and one paired rhythm phrase. Original recordings unchanged. */
(function (root) {
  "use strict";
  const PARTS=["vocals","other","drums"],ALL_PARTS=["vocals","drums","bass","other"];
  const ECHO_BEATS={vocals:1,other:.75,drums:.75},RAMP=.04;
  const impulseCache=new WeakMap();
  // Unity or lower differential gain: together with Q=.5 filters and the
  // <=.685 return gain, the delay loop cannot regenerate growing energy.
  const tapeCurve=Float32Array.from({length:8193},(_,i)=>Math.tanh(2.2*(i/4096-1))/2.2);
  function validate({bpm,duration,rate=1,offset=0,at=0}){
    if(!Number.isFinite(bpm)||bpm<110||bpm>125||!Number.isFinite(duration)||duration<1||duration>600||!Number.isFinite(rate)||rate<.5||rate>1.5||!Number.isFinite(offset)||offset<0||offset>duration||!Number.isFinite(at)||at<0)throw new Error("Invalid Human Fly dub timeline");
  }
  function spring(context){
    const cached=impulseCache.get(context);
    if(cached&&cached.sampleRate===context.sampleRate)return cached;
    const sr=context.sampleRate,b=context.createBuffer(2,Math.round(sr*1.1),sr);let seed=1951;
    for(let ch=0;ch<2;ch++){
      const x=b.getChannelData(ch);let energy=0;
      for(let i=0;i<x.length;i++){
        const t=i/sr;if(t<.012)continue;
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const noise=seed/2147483648-1;
        const modes=Math.sin(2*Math.PI*(880*t+220*t*t)+ch*.7)+.5*Math.sin(2*Math.PI*(1730*t-310*t*t)+ch*.4);
        x[i]=(noise*.7+modes*.13)*Math.exp(-t/.19)*Math.min(1,(t-.012)/.012);energy+=x[i]*x[i];
      }
      const scale=1/Math.sqrt(energy);for(let i=0;i<x.length;i++)x[i]*=scale;
    }
    impulseCache.set(context,b);return b;
  }
  function create(context,{inputs,direct,sources,tones,loopTargets,buffers,muted:initialMute={},output}){
    const nodes=[],buses={},connections=[],impulse=spring(context);let disposed=false,timer=null,settings=null,curves=null,loops=null,springRateFallback=false;
    const keep=n=>{nodes.push(n);return n;};
    const gain=value=>{const n=keep(context.createGain());n.gain.value=value;return n;};
    const filter=(type,f)=>{const n=keep(context.createBiquadFilter());n.type=type;n.frequency.value=f;n.Q.value=.5;return n;};
    try { for(const part of PARTS){
      const send=gain(0),hp=filter("highpass",part==="vocals"?280:part==="other"?180:650),lp=filter("lowpass",4000);
      const shape=keep(context.createWaveShaper());shape.curve=tapeCurve;shape.oversample="none";
      const delay=keep(context.createDelay(1.2)),feedback=gain(0),pan=typeof context.createStereoPanner==="function"?keep(context.createStereoPanner()):gain(1);
      const wet=gain(0),exit=gain(initialMute[part]?0:1);
      inputs[part].connect(send);connections.push([inputs[part],send]);
      send.connect(hp);hp.connect(lp);lp.connect(shape);shape.connect(delay);
      delay.connect(feedback);feedback.connect(hp);
      delay.connect(pan);pan.connect(wet);wet.connect(exit);exit.connect(output);
      buses[part]={send,hp,lp,delay,feedback,pan,wet,exit};
      if(part==="drums"){
        const springHp=filter("highpass",650),convolver=keep(context.createConvolver()),amount=gain(.25);
        convolver.normalize=false;
        try { convolver.buffer=impulse; }
        catch(error) {
          if(error?.name!=="NotSupportedError"||!/sample.?rate/i.test(String(error.message||"")))throw error;
          springRateFallback=true;
        }
        if(!springRateFallback){send.connect(springHp);springHp.connect(convolver);convolver.connect(amount);amount.connect(wet);}
      }
    } } catch(error) { destroy(); throw error; }
    function automate(param,points,{at,offset,rate}){
      const now=context.currentTime,first=Math.max(now,at),current=param.value;
      param.cancelScheduledValues(now);param.setValueAtTime(current,now);
      const begins=first>now+RAMP?first:first+RAMP;
      param.linearRampToValueAtTime(root.RecordedDubArrangement.valueAt(points,offset+Math.max(0,begins-at)*rate),begins);
      for(const[second,value]of points){const time=at+(second-offset)/rate;if(time>begins)param.linearRampToValueAtTime(value,time);}
    }
    function destroy(){
      disposed=true;loops?.destroy();loops=null;buffers=null;
      if(timer!==null){clearTimeout(timer);timer=null;}
      for(const[input,target]of connections.splice(0)){try{input.disconnect(target);}catch{}}
      for(const node of nodes){node.disconnect();if("buffer"in node){try{node.buffer=null;}catch{}}}
    }
    return{
      schedule(options){
        if(disposed)throw new Error("Disposed dub mix");validate(options);settings={...options};curves=root.RecordedDubArrangement.plan(options.bpm,options.duration);
        loops?.destroy();loops=root.RecordedDubArrangement.createLoops(context,options,buffers,loopTargets,initialMute);
        for(const p of ALL_PARTS){
          automate(direct[p].gain,curves[p].dry,options);automate(sources[p].gain,curves[p].source,options);
          if(tones[p])automate(tones[p].frequency,curves[p].tone.map(([t,f])=>[t,Math.min(f,context.sampleRate*.45)]),options);
        }
        for(const part of PARTS){
          const b=buses[part],c=curves[part];
          automate(b.send.gain,c.send,options);automate(b.feedback.gain,c.feedback,options);automate(b.wet.gain,c.wet,options);
          automate(b.lp.frequency,c.cutoff.map(([t,f])=>[t,Math.min(f,context.sampleRate*.45)]),options);
          if(b.pan.pan)automate(b.pan.pan,c.pan,options);
          const delay=60*ECHO_BEATS[part]/(options.bpm*options.rate);
          b.delay.delayTime.value=delay;automate(b.delay.delayTime,c.drift.map(([t,scale])=>[t,delay*scale]),options);
        }
      },
      setMuted(part,muted){
        initialMute[part]=Boolean(muted);loops?.setMuted(part,muted);const b=buses[part];if(!b)return;
        const p=b.exit.gain,now=context.currentTime;p.cancelScheduledValues(now);p.setValueAtTime(p.value,now);p.linearRampToValueAtTime(muted?0:1,now+.015);
      },
      diagnostics(){
        return{revision:5,active:!disposed,nodes:disposed?0:nodes.length+(loops?.diagnostics().nodes||0),feedbackLimit:.685,
          loops:loops?.diagnostics()||null,scenes:settings?root.RecordedDubArrangement.build(settings.bpm,settings.duration).scenes:[],
          echoBeats:{...ECHO_BEATS},springBytes:impulse.length*impulse.numberOfChannels*4,springRateFallback,lastEchoSeconds:settings?Math.log(.001)/Math.log(.685)*60/(settings.bpm*settings.rate):0,
          settings,direct:Object.fromEntries(ALL_PARTS.map(p=>[p,direct[p].gain.value])),sources:Object.fromEntries(ALL_PARTS.map(p=>[p,sources[p].gain.value])),
          sends:Object.fromEntries(PARTS.map(p=>[p,buses[p].send.gain.value])),feedback:Object.fromEntries(PARTS.map(p=>[p,buses[p].feedback.gain.value])),
          wet:Object.fromEntries(PARTS.map(p=>[p,buses[p].wet.gain.value]))};
      },
      destroy,
      dispose(){
        if(disposed)return;disposed=true;loops?.fade();
        for(const part of PARTS){const b=buses[part];for(const p of [b.send.gain,b.feedback.gain]){p.cancelScheduledValues(context.currentTime);p.setValueAtTime(0,context.currentTime);}const p=b.exit.gain;p.cancelScheduledValues(context.currentTime);p.setValueAtTime(p.value,context.currentTime);p.linearRampToValueAtTime(0,context.currentTime+.015);}
        if(context.state==="running")timer=setTimeout(destroy,35);else destroy();
      }
    };
  }
  root.RecordedDubMix=Object.freeze({create,plan:(b,d)=>root.RecordedDubArrangement.plan(b,d),valueAt:(p,t)=>root.RecordedDubArrangement.valueAt(p,t),validate});
})(globalThis);
