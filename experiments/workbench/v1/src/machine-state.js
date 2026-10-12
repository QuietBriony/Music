// Versioned, bounded machine snapshots. No audio initialization or storage writes.
const require = (condition, message) => { if (!condition) throw new Error(message); };
// FILE saves are opaque full-project binary strings. Check the container before
// adding one to storage; decoding/importing it into the audio engine is deferred
// until the user explicitly selects the patch.
export function checkAcidData(data) {
  require(typeof data === 'string' && data.length <= 300_000 && /^[A-Za-z0-9_-]+$/.test(data),
    '303＋909のパッチ形式が合いません。中のFILEで開き、保存し直してください。');
  let binary;
  try { binary = atob(data.replace(/-/g, '+').replace(/_/g, '/')); }
  catch { throw new Error('303＋909のパッチを読めません'); }
  const byte = (offset) => binary.charCodeAt(offset);
  let offset = 0;
  let global = false;
  const units = new Set();
  while (offset + 3 <= binary.length) {
    const block = byte(offset);
    const size = byte(offset + 1) | (byte(offset + 2) << 8);
    offset += 3;
    require(offset + size <= binary.length && block <= 4, '303＋909のパッチが途中で切れています');
    if (block === 0) {
      require(size === 0 && offset === binary.length && global && units.size === 3,
        '303＋909の完全なFILE保存が必要です');
      return;
    }
    if (block === 1) {
      require(!global && size >= 5 && byte(offset + 2) === 2 && byte(offset) >= 60 && byte(offset) <= 200,
        '303＋909の完全なFILE保存が必要です');
      global = true;
    } else if (block === 2) {
      const unit = byte(offset) + ':' + byte(offset + 1);
      require(size >= 3 && ['1:0', '1:1', '2:0'].includes(unit) && !units.has(unit),
        '303＋909の楽器データが不正です');
      units.add(unit);
    }
    offset += size;
  }
  throw new Error('303＋909のパッチに終了データがありません');
}

const synths = ['tb303_1', 'tb303_2'];
const drums = ['bd','sd','lt','mt','ht','rs','cp','ch','oh','cr','rd'];
const toneKeys = ['tune','cutoff','reso','env','decay','accent','volume','delayTime','delayFb','delayWet'];
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function tone(value) {
  require(value && ['sawtooth','square'].includes(value.waveform), '303の波形が不正です');
  const result = { waveform:value.waveform };
  for (const key of toneKeys) {
    const [min,max] = key === 'tune' ? [-1200,1200] : [0,key === 'reso' ? 15 : 100];
    require(number(value[key],min,max), '303の音色が範囲外です'); result[key] = value[key];
  }
  return result;
}
export function normalizeMachineState(value) {
  require([1,2,3].includes(value?.version), 'この組み合わせの機材データには対応していません');
  require(value.version === 1 || (value.drumLocks && drums.every(id=>typeof value.drumLocks[id]==='boolean')), '909のパート固定が不正です');
  require(value.version !== 3 || (typeof value.rackAuto?.enabled==='boolean' && [2,4,8,16].includes(value.rackAuto.bars)), '303／909 AUTOの設定が不正です');
  checkAcidData(value.code);
  require(Number.isInteger(value.pattern) && value.pattern >= 0 && value.pattern < 16
    && ['pattern','song'].includes(value.mode) && typeof value.keepSoundSettings === 'boolean', '機材のパターン設定が不正です');
  require(number(value.swing,0,100) && number(value.tempo,1,1000), '機材のテンポ設定が不正です');
  require(value.locks && [...synths,'tr909'].every(id => typeof value.locks[id] === 'boolean'), '機材の固定状態が不正です');
  require(Array.isArray(value.tracks) && value.tracks.length <= 11 && new Set(value.tracks).size === value.tracks.length
    && value.tracks.every(id => drums.includes(id)), '909の候補が不正です');
  require(Array.isArray(value.tones) && value.tones.length === 16, '303の音色が不足しています');
  // The original FILE codec rounds resonance/tuning. Keep the exact fader
  // values alongside it, including tones in the other fifteen patterns.
  const tones = value.tones.map(pair => Object.fromEntries(synths.map(id => [id,tone(pair?.[id])])));
  return { version:3, code:value.code, pattern:value.pattern, mode:value.mode,
    keepSoundSettings:value.keepSoundSettings, tempo:value.tempo, swing:value.swing,
    locks:Object.fromEntries([...synths,'tr909'].map(id => [id,value.locks[id]])),
    drumLocks:Object.fromEntries(drums.map(id=>[id,value.version>=2 && value.drumLocks[id]])),
    rackAuto:value.version===3?{enabled:value.rackAuto.enabled,bars:value.rackAuto.bars}:{enabled:false,bars:4}, tracks:[...value.tracks], tones };
}
export function normalizeJointState(value) {
  require(value?.version === 1 && number(value.level,0,1), '組み合わせの音量・保存形式が不正です');
  return { version:1, level:value.level, machine:normalizeMachineState(value.machine) };
}
export function captureMachineState(data, audio) {
  const code = data.exportFullState();
  return normalizeMachineState({ version:3, code, pattern:data.currentPatternId, mode:data.mode,
    keepSoundSettings:data.keepSoundSettings, tempo:audio.tempo, swing:audio.swing,
    locks:data.unitLocks, drumLocks:Object.fromEntries(drums.map(id=>[id,data.drumLocks?.[id]===true])), tracks:data.active909Tracks,
    rackAuto:data.rackAuto || {enabled:false,bars:4},
    tones:data.patterns.map(p => Object.fromEntries(synths.map(id => [id,p.units[id].settings]))) });
}
export function decodeMachineState(value, Decoder) {
  const snapshot = normalizeMachineState(value), state = new Decoder().decode(snapshot.code);
  require(Array.isArray(state.patterns) && state.patterns.length === 16
    && state.patterns.every(p => synths.every(id => p?.units?.[id]?.sequence?.length === 16)
      && drums.every(id => p?.units?.tr909?.tracks?.[id]?.steps?.length === 16))
    && Array.isArray(state.song) && state.song.length <= 255
    && state.song.every(id => Number.isInteger(id) && id >= 0 && id < 16), '機材のフレーズを読み込めません');
  for (let i=0;i<16;i++) for (const id of synths) state.patterns[i].units[id].settings = {...snapshot.tones[i][id]};
  return { snapshot, state };
}
export function applyMachineState({data,audio,ui}, decoded) {
  const {snapshot:s,state} = decoded;
  data.patterns=state.patterns; data.song=state.song; data.currentPatternId=s.pattern;
  data.mode=s.mode; data.keepSoundSettings=s.keepSoundSettings;
  data.unitLocks={...s.locks}; data.active909Tracks=[...s.tracks]; data.customSampleMap=state.customSampleMap || {};
  data.drumLocks={...s.drumLocks};
  data.rackAuto={...s.rackAuto};
  audio.tempo=s.tempo; audio.swing=s.swing;
  data.applyPatternSettings(s.pattern);
  audio.instruments.get('tr909')?.setCustomSampleMap?.(data.customSampleMap);
  ui.renderAll(); ui.updateSwingUI();
  for (const [id,locked] of Object.entries(s.locks)) ui.updateLockUI(id,locked);
  ui.refreshParamCache(s.pattern);
  // A reset refreshes the rack, which reads native knobs back into the pattern.
  // Apply restored tones first so that stale controls cannot overwrite a save.
  audio.rackAuto?.reset();
}
