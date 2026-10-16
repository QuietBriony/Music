import { MACROS, emptyRackScenes, normalizeRackScenes, normalizeSceneTones } from './rack-scenes-state.js';
export { MACROS };
const KEY='music-workbench-rack-tone-scenes-v1';
export function createRackScenes({data,audio,model,storage,notify=()=>{}}) {
  const incoming=data.rackScenes;
  let raw=null,blocked=false,lastStep=null,bars=0,pattern=null,queued=null,current=null,touching=false;
  let message='音色の場面をA〜Hに保存。音符・打点・音量・BPMはそのまま。';
  try {raw=storage.getItem(KEY);if(raw&&raw.length>40000)throw new Error();data.rackScenes=raw?normalizeRackScenes(JSON.parse(raw)):emptyRackScenes();}
  catch {blocked=true;data.rackScenes=emptyRackScenes();message='場面の保存欄を読めません。元のデータを保護しています。まとめフェーダーは使えます。';}
  let bank=data.rackScenes;
  if(incoming)data.rackScenes=incoming;
  function reset(){lastStep=null;bars=0;queued=null;pattern=null;}
  function sync() {
    if(data.rackScenes!==bank) {
      // Combined restore is explicit. Old backups without scenes leave this bank alone.
      const next=normalizeRackScenes(data.rackScenes);
      try {persist(next);message='保存した組み合わせの音色場面を復元しました。';}
      catch(error){bank=next;data.rackScenes=bank;blocked=true;message='場面を画面へ復元しましたが端末保存できません。組み合わせを保存してください。'+error.message;}
      reset();current=null;
      if(next.auto.enabled&&data.rackAuto?.enabled){data.rackAuto.enabled=false;data.saveSettings?.();}
    }
  }
  function persist(next) {
    next=normalizeRackScenes(next);
    if(blocked)throw new Error('場面の保存欄を利用できません。先に組み合わせをJSONで保管してください。');
    if(storage.getItem(KEY)!==raw)throw new Error('別の画面で場面が更新されています。今の組み合わせを保存してから開き直してください。');
    const text=JSON.stringify(next);storage.setItem(KEY,text);raw=text;bank=next;data.rackScenes=bank;
  }
  function manual(){bars=0;queued=null;message='手動操作を優先。次の場面まで待ちます。';}
  const freeTargets=macro=>macro.targets.filter(([unit])=>!data.unitLocks?.[unit.startsWith('tb303')?unit:'tr909']
    &&(unit.startsWith('tb303')||!data.drumLocks?.[unit]));
  function apply(index) {
    const slot=bank.slots[index];if(!slot)throw new Error('空の場面です。今の音色を保存してください。');
    model.applyTonePatch(slot.tones);current=index;queued=null;bars=0;
    message=String.fromCharCode(65+index)+' · '+slot.name+'。固定パートと音符・音量は保持。';
  }
  return {
    reset,manual,touch(value){const was=touching;touching=value;if(value||was)manual();},
    read(){sync();return {bank,current,queued,remaining:Math.max(1,bank.auto.bars-bars),message};},
    macroValue(id) {
      const macro=MACROS.find(m=>m.id===id),targets=freeTargets(macro),tones=model.toneState();
      return targets.length?Math.round(targets.reduce((n,[unit,key,min,max])=>n+Math.max(0,Math.min(1,(tones[unit][key]-min)/(max-min))),0)/targets.length*100):null;
    },
    macro(id,value) {
      if(!Number.isFinite(value)||value<0||value>100)throw new Error('まとめ値は0〜100です。');
      const macro=MACROS.find(m=>m.id===id);if(!macro)throw new Error('まとめ操作を選んでください。');
      if(!freeTargets(macro).length)return false;
      manual();const tones=model.toneState();
      for(const [unit,key,min,max] of macro.targets)tones[unit][key]=min+(max-min)*value/100;
      model.applyTonePatch(tones);message=macro.title+'を変更。固定・音符・打点・音量を保持。';notify();
    },
    save(index,name) {
      sync();if(!Number.isInteger(index)||index<0||index>7)throw new Error('保存する場面を選んでください。');
      const next=structuredClone(bank);next.slots[index]={name:String(name).trim().slice(0,48)||String.fromCharCode(65+index),tones:normalizeSceneTones(model.toneState())};
      persist(next);current=index;queued=null;message='場面'+String.fromCharCode(65+index)+'をこの端末に保存しました。';notify();
    },
    remove(index) {
      sync();if(!Number.isInteger(index)||index<0||index>7)throw new Error('場面を選んでください。');
      const next=structuredClone(bank);next.slots[index]=null;if(next.slots.filter(Boolean).length<2)next.auto.enabled=false;
      persist(next);if(queued===index)queued=null;if(current===index)current=null;bars=0;message='場面を空にしました。今の演奏はそのまま。';notify();
    },
    recall(index) {
      sync();if(!Number.isInteger(index)||index<0||index>7||!bank.slots[index])throw new Error('先に今の音色を保存してください。');
      if(data.mode!=='pattern')throw new Error('場面はPATTERNで使えます。');
      if(audio.isPlaying){queued=index;message=String.fromCharCode(65+index)+'を次の小節で切替。';}
      else apply(index);notify();
    },
    configure(enabled,interval=bank.auto.bars) {
      sync();if(typeof enabled!=='boolean'||![4,8,16].includes(interval))throw new Error('場面AUTOは4・8・16小節です。');
      if(enabled&&bank.slots.filter(Boolean).length<2)throw new Error('音色の場面を2つ以上保存してください。');
      persist({...bank,auto:{enabled,bars:interval}});reset();message=enabled?'保存した場面を順番に巡ります。固定と音符・音量を保持。':'場面AUTOを止め、今の音色をキープ。';notify();
    },
    tick(time,step) {
      if(!audio.isPlaying||!Number.isFinite(time)||!Number.isInteger(step)||step<0||step>15)return false;
      if(data.rackScenes!==bank){reset();return true;} // Restore is synchronized by the UI, not storage IO inside the clock.
      const p=data.patterns[data.currentPatternId];
      if(pattern!==p){const requested=pattern===null?queued:null;reset();pattern=p;queued=requested;}
      if(data.mode!=='pattern'){reset();return false;}
      const first=lastStep===null,boundary=step===0&&lastStep!==0;lastStep=step;
      const controlsClock=bank.auto.enabled||queued!==null;
      if(!boundary)return controlsClock;
      if(!first)bars++;
      if(!touching)try {
        if(queued!==null)apply(queued);
        else if(bank.auto.enabled&&bars>=bank.auto.bars){
          const next=bank.slots.map((slot,index)=>slot?index:null).filter(index=>index!==null);
          apply(next[(next.indexOf(current)+1)%next.length]);
        }
      }catch(error){queued=null;bank.auto.enabled=false;message='場面の切替を止めました：'+error.message;}
      notify();return controlsClock;
    },
  };
}
