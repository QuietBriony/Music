// Called by the existing audio scheduler. No timer or independent music clock.
export function createRackAuto({data,audio,model,scenePlayer,notify=()=>{}}) {
  data.rackAuto ||= {enabled:false,bars:4};
  let lastStep=null, bars=0, turn=0, previous=null, pattern=null, config='', touching=false, busy=false;
  let lastChange='';
  function reset() {lastStep=null;bars=0;previous=null;pattern=null;lastChange='';}
  function manual() {
    if(busy) return;
    scenePlayer?.manual();
    // Adopt what is audible as the new motif; never undo a human edit later.
    bars=0;previous=null;lastChange='手動操作を優先';
  }
  return {
    get busy(){return busy;},
    manual,
    touch(value){touching=value;scenePlayer?.touch(value);if(value)manual();},
    reset(){reset();scenePlayer?.reset();notify();},
    configure(enabled,interval) {
      if(typeof enabled!=='boolean'||![2,4,8,16].includes(interval)) throw new Error('AUTOの間隔は2・4・8・16小節です。');
      if(enabled&&scenePlayer?.read().bank.auto.enabled)scenePlayer.configure(false);
      data.rackAuto={enabled,bars:interval};reset();turn=0;data.saveSettings();notify();
    },
    read() {return {...data.rackAuto,remaining:Math.max(1,data.rackAuto.bars-bars),lastChange};},
    tick(time,step) {
      if(busy||!audio.isPlaying||!Number.isFinite(time)||!Number.isInteger(step)||step<0||step>15) return;
      if(scenePlayer?.tick(time,step)){reset();return;}
      const p=data.patterns[data.currentPatternId], signature=JSON.stringify(data.rackAuto);
      if(pattern!==p||config!==signature||data.mode!=='pattern') {reset();pattern=p;config=signature;}
      if(!data.rackAuto.enabled||data.mode!=='pattern') return;
      const boundary=step===0&&lastStep!==0, first=lastStep===null;
      lastStep=step;
      if(!boundary) return;
      if(!first) bars++;
      if(bars>=data.rackAuto.bars&&!touching) {
        busy=true;
        try {
          previous=model.evolve(turn++,previous);
          lastChange=previous?previous.label+' · '+previous.detail:'固定中・無音のパートを保持';
          bars=0;
        } catch(error) {
          data.rackAuto.enabled=false;previous=null;
          config=JSON.stringify(data.rackAuto);data.saveSettings();
          lastChange='AUTOを止めました：'+error.message;
        } finally {busy=false;}
      }
      notify();
    },
  };
}
