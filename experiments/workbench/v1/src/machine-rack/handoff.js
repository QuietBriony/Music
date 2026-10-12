const KEY = 'music-machine-handoff-v1';
// Tab-local and one-use: bring the current unsaved phrase into the host without
// overwriting a FILE or putting score/sample metadata in a public URL.
export function carryMachine(data, storage) {
  const payload = { code:data.exportFullState(), pattern:data.currentPatternId, mode:data.mode, locks:{...data.unitLocks}, drumLocks:{...data.drumLocks}, rackAuto:{...data.rackAuto} };
  storage.setItem(KEY, JSON.stringify(payload));
}
export function takeMachine(data, storage, Decoder) {
  const text = storage.getItem(KEY);
  if (!text) return false;
  storage.removeItem(KEY);
  const payload = JSON.parse(text);
  if (typeof payload.code !== 'string' || payload.code.length > 500000
    || !['pattern','song'].includes(payload.mode)
    || !Number.isInteger(payload.pattern) || payload.pattern < 0 || payload.pattern > 15) throw new Error('引き継ぐフレーズを読み込めません');
  new Decoder().decode(payload.code); // Validate before the native import's reset-on-error path.
  data.currentPatternId = payload.pattern;
  data.importState(payload.code);
  // Native full-FILE decoding defaults to SONG, even if it was exported from
  // PATTERN. Preserve the user's editing mode explicitly in this handoff.
  data.mode = payload.mode;
  for (const unit of ['tb303_1','tb303_2','tr909']) data.unitLocks[unit] = payload.locks?.[unit] === true;
  data.drumLocks=Object.fromEntries(['bd','sd','lt','mt','ht','rs','cp','ch','oh','cr','rd'].map(id=>[id,payload.drumLocks?.[id]===true]));
  data.rackAuto={enabled:payload.rackAuto?.enabled===true,bars:[2,4,8,16].includes(payload.rackAuto?.bars)?payload.rackAuto.bars:4};
  return true;
}
