// Explicit controls for the bundled acidBros machine; no second audio clock.
export const UNITS = [['tb303_2','303 · 低音'],['tb303_1','303 · 返し'],['tr909','909 · ドラム']];
export const SYNTH_CONTROLS = [
  ['volume','音量','vol',0,100,1], ['cutoff','明るさ','cutoff',0,100,1],
  ['reso','みょん','reso',0,15,.1], ['env','うねりの深さ','env',0,100,1],
  ['decay','うねりの長さ','decay',0,100,1], ['delayWet','残響','delayWet',0,100,1],
];
const level = id => ['level','音量',id+'_level',0,100,1];
const tune = (id,key='tune',knob=id+'_p1') => [key,'高さ',knob,0,100,1];
const decay = (id,key='decay',knob=id+'_p2') => [key,'余韻',knob,0,100,1];
export const DRUMS = [
  ['bd','KICK',[level('bd'),tune('bd'),['attack','硬さ','bd_p2',0,100,1],decay('bd','decay','bd_p3')]],
  ['sd','SNARE',[level('sd'),tune('sd'),['tone','明るさ','sd_p2',0,100,1],['snappy','ざらつき','sd_p3',0,100,1]]],
  ...['lt','mt','ht'].map((id,i)=>[id,['LOW TOM','MID TOM','HIGH TOM'][i],[level(id),tune(id),decay(id)]]),
  ['rs','RIM',[level('rs')]], ['cp','CLAP',[level('cp'),decay('cp','decay','cp_decay')]],
  ...['ch','oh'].map(id=>[id,id==='ch'?'CLOSED HAT':'OPEN HAT',[level(id),tune(id,id+'_tune',id+'_tune'),decay(id,id+'_decay',id+'_decay')]]),
  ...['cr','rd'].map(id=>[id,id==='cr'?'CRASH':'RIDE',[level(id),tune(id,id+'_tune',id+'_tune')]]),
];
const ids = UNITS.map(([id])=>id);
const clone = value => structuredClone(value);
const levels = pattern => ({
  tb303_1:pattern.units.tb303_1.settings.volume,tb303_2:pattern.units.tb303_2.settings.volume,
  tr909:Object.fromEntries(Object.entries(pattern.units.tr909.tracks).map(([id,track])=>[id,track.level])),
});
function applyLevels(pattern, values) {
  for (const id of ids.slice(0,2)) pattern.units[id].settings.volume=values[id];
  for (const [id,value] of Object.entries(values.tr909)) if (pattern.units.tr909.tracks[id]) pattern.units.tr909.tracks[id].level=value;
}

export function createMachineRack({data,ui,knobs}) {
  let checkpoint;
  function current() {
    const pattern=data.patterns[data.currentPatternId];
    if (checkpoint && checkpoint.pattern!==pattern) checkpoint=undefined;
    return pattern;
  }
  function editable() {
    if (data.mode!=='pattern') throw new Error('SONGは元の操作画面で編集してください。');
    data.saveCurrentSettingsToPattern();
    const pattern=current();
    if (!pattern?.units) throw new Error('パターンを読み込んでください。');
    return pattern;
  }
  function refresh() { data.applyPatternSettings(data.currentPatternId);ui.renderAll();ui.refreshParamCache(data.currentPatternId); }
  function remember() {
    const pattern=editable();
    checkpoint={pattern,units:clone(pattern.units),tracks:[...data.active909Tracks]};
  }
  return {
    read() {
      if (data.mode==='pattern') data.saveCurrentSettingsToPattern();
      const pattern=current();
      return {editable:data.mode==='pattern',patternId:data.currentPatternId,units:clone(pattern?.units || {}),
        locks:{...data.unitLocks},tracks:[...data.active909Tracks],canRestore:Boolean(checkpoint)};
    },
    remember,
    restore() {
      const pattern=editable();
      if (!checkpoint) return false;
      const volume=levels(pattern);
      pattern.units=clone(checkpoint.units);
      applyLevels(pattern,volume);
      data.active909Tracks=[...checkpoint.tracks];
      data.saveSettings();refresh();return true;
    },
    randomize(target='all') {
      if (target!=='all' && !ids.includes(target)) throw new Error('楽器を選んでください。');
      const pattern=editable();
      if (!ids.some(id=>(target==='all'||target===id)&&!data.unitLocks[id])) return false;
      if (!checkpoint) remember();
      const original=clone(pattern.units),volume=levels(pattern),locks={...data.unitLocks};
      try {
        for (const id of ids) data.unitLocks[id]=Boolean(locks[id] || (target!=='all' && target!==id));
        // Reuse the original bass-to-answer note selection, accent, slide and drums.
        data.randomize();
        applyLevels(pattern,volume);
      } catch (error) {
        pattern.units=original;
        throw error;
      } finally {
        data.unitLocks=locks;
        refresh();
      }
      return true;
    },
    lock(id) {
      if (!ids.includes(id)) throw new Error('楽器を選んでください。');
      editable();const locked=data.toggleUnitLock(id);ui.updateLockUI(id,locked);
    },
    set(unit,key,value) {
      const pattern=editable();
      const synth=unit==='tb303_1'||unit==='tb303_2';
      const control=(synth?SYNTH_CONTROLS:DRUMS.find(([id])=>id===unit)?.[2])?.find(([id])=>id===key);
      if (!control || !Number.isFinite(value) || value<control[3] || value>control[4]) throw new Error('音色の値が範囲外です。');
      const knobId=synth?control[2]+'303_'+unit.slice(-1):control[2];
      const settings=synth?pattern.units[unit].settings:pattern.units.tr909.tracks[unit];
      if (!settings) throw new Error('打楽器が見つかりません。');
      settings[key]=value;
      knobs()[knobId]?.setValue(value);
      ui.refreshParamCache(data.currentPatternId);
    },
    wave(unit,waveform) {
      const pattern=editable();
      if (!['tb303_1','tb303_2'].includes(unit)||!['sawtooth','square'].includes(waveform)) throw new Error('波形を選んでください。');
      pattern.units[unit].settings.waveform=waveform;
      data.applyTB303Settings(Number(unit.slice(-1)),pattern.units[unit].settings);
      ui.refreshParamCache(data.currentPatternId);
    },
  };
}
