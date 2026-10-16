import { varyVoice } from './variation.js';
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
  data.drumLocks ||= {};
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
    toneState() {
      const pattern=editable();
      return Object.fromEntries([...ids.slice(0,2),...DRUMS.map(([id])=>id)].map(unit=>{
        const synth=ids.slice(0,2).includes(unit),source=synth?pattern.units[unit].settings:pattern.units.tr909.tracks[unit];
        const controls=(synth?SYNTH_CONTROLS:DRUMS.find(([id])=>id===unit)[2]).filter(([key])=>!['volume','level'].includes(key));
        return [unit,{...Object.fromEntries(controls.map(([key])=>[key,source[key]])),...(synth?{waveform:source.waveform}:{})}];
      }));
    },
    applyTonePatch(tones) {
      const pattern=editable(),patches=[];
      for(const [unit,values] of Object.entries(tones)) {
        const synth=ids.slice(0,2).includes(unit),controls=synth?SYNTH_CONTROLS:DRUMS.find(([id])=>id===unit)?.[2];
        if(!controls)throw new Error('音色の楽器が不正です。');
        const allowed=controls.filter(([key])=>!['volume','level'].includes(key));
        const patch={};
        for(const [key,, ,min,max] of allowed) {
          if(!Number.isFinite(values[key])||values[key]<min||values[key]>max)throw new Error('音色の値が範囲外です。');
          patch[key]=values[key];
        }
        if(synth){if(!['sawtooth','square'].includes(values.waveform))throw new Error('波形が不正です。');patch.waveform=values.waveform;}
        if(data.unitLocks[synth?unit:'tr909']||(!synth&&data.drumLocks[unit]))continue;
        const target=synth?pattern.units[unit].settings:pattern.units.tr909.tracks[unit];
        patches.push([target,patch,Object.fromEntries(Object.keys(patch).map(key=>[key,target[key]]))]);
      }
      for(const [target,patch] of patches)Object.assign(target,patch);
      try {data.applyPatternSettings(data.currentPatternId);ui.refreshParamCache(data.currentPatternId);}
      catch(error){for(const [target,,before] of patches)Object.assign(target,before);try{data.applyPatternSettings(data.currentPatternId);}catch{}throw error;}
    },
    read() {
      if (data.mode==='pattern') data.saveCurrentSettingsToPattern();
      const pattern=current();
      return {editable:data.mode==='pattern',patternId:data.currentPatternId,units:clone(pattern?.units || {}),
        locks:{...data.unitLocks},drumLocks:{...data.drumLocks},tracks:[...data.active909Tracks],canRestore:Boolean(checkpoint)};
    },
    remember,
    evolve(turn,previous,random=Math.random) {
      const pattern=editable();
      const isSynth=id=>id.startsWith('tb303');
      const get=id=>isSynth(id)?pattern.units[id]:pattern.units.tr909.tracks[id];
      const put=(id,value)=>{if(isSynth(id))pattern.units[id]=value;else pattern.units.tr909.tracks[id]=value;};
      const locked=id=>isSynth(id)?data.unitLocks[id]:data.unitLocks.tr909||data.drumLocks[id];
      if(!checkpoint) remember();
      const original=clone(pattern.units);
      try {
        // Return the previous variation to its motif only if nobody edited or
        // locked it. Manual edits/dice adopt the current sound via auto.manual.
        if(previous?.pattern===pattern&&!locked(previous.id)&&JSON.stringify(get(previous.id))===JSON.stringify(previous.after)) put(previous.id,clone(previous.before));
        const candidates=[...ids.slice(0,2),...data.active909Tracks].filter(id=>{
          const voice=get(id);return voice&&!locked(id)&&(isSynth(id)?voice.settings.volume>0&&voice.sequence.some(s=>s.active):voice.level>0&&voice.steps.some(Boolean));
        });
        let result=null;
        if(candidates.length) {
          const id=candidates[turn%candidates.length],before=clone(get(id));
          const varied=varyVoice(before,isSynth(id),turn,random);
          if(varied) {put(id,varied.voice);result={pattern,id,before,after:clone(varied.voice),detail:varied.detail,label:[...UNITS,...DRUMS].find(([key])=>key===id)[1]};}
        }
        refresh();return result;
      } catch(error) {pattern.units=original;refresh();throw error;}
    },
    drumCandidates(ids) {
      editable();
      if (data.unitLocks.tr909) throw new Error('909の固定を外してから候補を変えてください。');
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size!==ids.length || ids.some(id=>!DRUMS.some(([key])=>key===id))) throw new Error('打楽器を1つ以上選んでください。');
      data.active909Tracks=[...ids]; data.saveSettings(); refresh();
    },
    basicDrums() {
      const pattern=editable();
      if (data.unitLocks.tr909) throw new Error('909の固定を外してからビートを組んでください。');
      if (!checkpoint) remember();
      data.active909Tracks=[...new Set(['bd','sd','ch','oh',...data.active909Tracks.filter(id=>data.drumLocks[id])])];
      const hits={bd:[0,4,8,12],sd:[4,12],ch:[0,4,8,12],oh:[2,6,10,14]};
      for(const [id,track] of Object.entries(pattern.units.tr909.tracks)) if(!data.drumLocks[id]) track.steps=Array.from({length:16},(_,i)=>hits[id]?.includes(i)?1:0);
      data.saveSettings(); refresh();
    },
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
      const selected=target==='hats'?['ch','oh']:DRUMS.some(([id])=>id===target)?[target]:null;
      const unitTarget=selected?'tr909':target;
      if (unitTarget!=='all' && !ids.includes(unitTarget)) throw new Error('楽器を選んでください。');
      const pattern=editable();
      const freeDrums=DRUMS.map(([id])=>id).filter(id=>!data.drumLocks[id]&&(!selected||selected.includes(id)));
      if (!ids.some(id=>(unitTarget==='all'||unitTarget===id)&&!data.unitLocks[id]&&(id!=='tr909'||freeDrums.length))) return false;
      if (!checkpoint) remember();
      const original=clone(pattern.units),volume=levels(pattern),locks={...data.unitLocks},drumLocks={...data.drumLocks},tracks=[...data.active909Tracks];
      try {
        for (const id of ids) data.unitLocks[id]=Boolean(locks[id] || (unitTarget!=='all' && unitTarget!==id));
        if(selected) {
          data.drumLocks=Object.fromEntries(DRUMS.map(([id])=>[id,Boolean(drumLocks[id]||!selected.includes(id))]));
          // An explicit voice dice makes that voice a candidate, without removing others.
          data.active909Tracks=[...new Set([...tracks,...freeDrums])];
        }
        // Reuse the original bass-to-answer note selection, accent, slide and drums.
        data.randomize();
        applyLevels(pattern,volume);
      } catch (error) {
        pattern.units=original;
        data.active909Tracks=tracks;
        throw error;
      } finally {
        data.unitLocks=locks;
        data.drumLocks=drumLocks;
        refresh();
      }
      data.saveSettings();
      return true;
    },
    lockDrum(id) {
      if(!DRUMS.some(([key])=>key===id)) throw new Error('打楽器を選んでください。');
      editable(); data.drumLocks[id]=!data.drumLocks[id]; data.saveSettings();
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
