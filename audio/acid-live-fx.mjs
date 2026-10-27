// Finite dark echoes, fed AFTER the existing part fader/mute. No mic access,
// downloaded impulse, convolution or independent musical clock.
export function createLiveEffects({context,tap,connect}) {
  const buses=new Map();let config={echo:35,tone:42},throws=0;
  function stop(part) {
    for(const[id,b]of [...buses])if(!part||id===part){
      b.exit.gain.cancelScheduledValues(context.currentTime);b.exit.gain.setValueAtTime(0,context.currentTime);
      b.unplug();for(const node of b.nodes)node.disconnect();buses.delete(id);
    }
  }
  function bus(part) {
    if(buses.has(part))return buses.get(part);
    const nodes=[],keep=n=>(nodes.push(n),n),gain=value=>{const n=keep(context.createGain());n.gain.value=value;return n;};
    const send=gain(0),hp=keep(context.createBiquadFilter()),lp=keep(context.createBiquadFilter());
    hp.type='highpass';hp.frequency.value=part==='vocals'?280:160;hp.Q.value=.5;
    lp.type='lowpass';lp.Q.value=.5;
    const delay=keep(context.createDelay(2)),feedback=gain(0),wet=gain(0),exit=gain(1);
    const pan=typeof context.createStereoPanner==='function'?keep(context.createStereoPanner()):gain(1);
    if(pan.pan)pan.pan.value=part==='vocals'?-.18:.22;
    send.connect(hp);hp.connect(lp);lp.connect(delay);delay.connect(feedback);feedback.connect(hp);
    delay.connect(pan);pan.connect(wet);wet.connect(exit);connect(exit);
    const b={nodes,send,lp,delay,feedback,wet,exit,unplug:tap(part,send,()=>stop(part))};buses.set(part,b);return b;
  }
  function set(b,now) {
    b.lp.frequency.cancelScheduledValues(now);b.lp.frequency.setTargetAtTime(Math.min(context.sampleRate*.43,1200+config.tone*50),now,.025);
    b.wet.gain.cancelScheduledValues(now);b.wet.gain.setTargetAtTime(.18*config.echo/100,now,.012);
  }
  return {
    configure(value){
      for(const k of ['echo','tone'])if(!Number.isFinite(value[k])||value[k]<0||value[k]>100)throw Error('エコー設定が範囲外です。');
      config={echo:value.echo,tone:value.tone};if(config.echo===0)stop();else for(const b of buses.values())set(b,context.currentTime);
    },
    throw(part,bpm) {
      if(!['vocals','other'].includes(part)||!Number.isFinite(bpm)||bpm<30||bpm>300)throw Error('エコーの拍が不正です。');
      if(config.echo===0)return;
      const b=bus(part),now=context.currentTime+.005,beat=60/bpm,delay=beat*(part==='vocals'?.75:.5),capture=Math.min(.3,beat*.5);
      set(b,now);b.exit.gain.setValueAtTime(1,now);b.delay.delayTime.setValueAtTime(delay,now);
      b.send.gain.cancelScheduledValues(now);b.send.gain.setTargetAtTime(1,now,.004);b.send.gain.setTargetAtTime(0,now+capture,.008);
      b.feedback.gain.cancelScheduledValues(now);b.feedback.gain.setValueAtTime(.38,now);b.feedback.gain.setTargetAtTime(0,now+capture+6*delay,.03);
      b.wet.gain.setTargetAtTime(0,now+capture+6*delay+.25,.04);throws++;
    },
    stop,dispose:()=>stop(),
    diagnostics:()=>({buses:buses.size,throws,feedbackLimit:.38,nodes:[...buses.values()].reduce((n,b)=>n+b.nodes.length,0)})
  };
}
