export const BACKUP_FORMAT = 'music-live-workbench-backup';
export const MAX_BACKUP_BYTES = 8_000_000;
export const BACKUP_KEYS = {
  drafts: 'music-workbench-drafts-v1', levels: 'music-workbench-levels-v1',
  decks: 'music-workbench-decks-v1', acidFiles: 'acidbros_files',
};
const MAX_ITEMS = 500;
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const level = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function require(condition, message) {
  if (!condition) throw new Error(message);
}

// FILE saves are opaque full-project binary strings. Check the container before
// adding one to storage; decoding/importing it into the audio engine is deferred
// until the user explicitly selects the patch.
function checkAcidData(data) {
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

export function normalizeBackupState(value) {
  require(isObject(value?.strudel) && isObject(value?.acidbros), 'バックアップの内容が不足しています');
  const { drafts, levels, decks } = value.strudel;
  const { files } = value.acidbros;
  require(Array.isArray(drafts) && drafts.length <= MAX_ITEMS && Array.isArray(files) && files.length <= MAX_ITEMS,
    '下書き・パッチの件数または形式が合いません');
  require(isObject(levels) && isObject(decks) && Object.keys(levels).length <= 2000 && Object.keys(decks).length <= 2000,
    '音量・2デッキ設定の形式が合いません');
  const draftIds = new Set();
  const normalizedDrafts = drafts.map((item) => {
    require(validId(item?.id) && !draftIds.has(item.id) && typeof item.title === 'string'
      && item.title.trim() && item.title.length <= 80 && typeof item.code === 'string'
      && item.code.length > 0 && item.code.length <= 100_000 && isDate(item.savedAt), '下書きの形式が合いません');
    draftIds.add(item.id);
    return { id: item.id, title: item.title, code: item.code, savedAt: item.savedAt,
      ...(isDate(item.importedAt) ? { importedAt: item.importedAt } : {}) };
  });
  const fileIds = new Set();
  const normalizedFiles = files.map((item) => {
    require(validId(item?.id) && !fileIds.has(item.id) && typeof item.name === 'string'
      && item.name.trim() && item.name.length <= 200 && Number.isSafeInteger(item.created)
      && item.created >= 0 && Number.isSafeInteger(item.modified) && item.modified >= 0, '303＋909のFILE情報が不正です');
    checkAcidData(item.data);
    fileIds.add(item.id);
    return { id: item.id, name: item.name, data: item.data, created: item.created, modified: item.modified };
  });
  const normalizedLevels = Object.create(null);
  for (const [key, value] of Object.entries(levels)) {
    require(/^(published|draft):[A-Za-z0-9_-]{1,100}$/.test(key) && level(value), '音量設定が不正です');
    normalizedLevels[key] = value;
  }
  const normalizedDecks = Object.create(null);
  for (const [key, value] of Object.entries(decks)) {
    require(/^[a-z0-9-]{1,100}\|[a-z0-9-]{1,100}$/.test(key) && isObject(value)
      && level(value.a) && level(value.b) && level(value.cross), '2デッキ設定が不正です');
    normalizedDecks[key] = { a: value.a, b: value.b, cross: value.cross };
  }
  return { strudel: { drafts: normalizedDrafts, levels: normalizedLevels, decks: normalizedDecks },
    acidbros: { files: normalizedFiles } };
}

export function readBackupState(storage) {
  return normalizeBackupState({
    strudel: {
      drafts: JSON.parse(storage.getItem(BACKUP_KEYS.drafts) || '[]'),
      levels: JSON.parse(storage.getItem(BACKUP_KEYS.levels) || '{}'),
      decks: JSON.parse(storage.getItem(BACKUP_KEYS.decks) || '{}'),
    },
    acidbros: { files: JSON.parse(storage.getItem(BACKUP_KEYS.acidFiles) || '[]') },
  });
}

export function backupText(state, exportedAt = new Date().toISOString()) {
  require(isDate(exportedAt), '書き出し日時が不正です');
  const text = JSON.stringify({ format: BACKUP_FORMAT, schema_version: 1, exportedAt,
    ...normalizeBackupState(state) }, null, 2);
  require(new TextEncoder().encode(text).length <= MAX_BACKUP_BYTES, 'バックアップが大きすぎます');
  return text;
}

export function parseBackup(text) {
  require(typeof text === 'string' && new TextEncoder().encode(text).length <= MAX_BACKUP_BYTES,
    '8 MB以内のバックアップJSONを選んでください');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('JSONとして読めません'); }
  // Also accept the existing acidBros FILE > EXPORT ALL format.
  if (value?.version === 1 && Array.isArray(value.files) && !value.format) {
    return normalizeBackupState({ strudel: { drafts: [], levels: {}, decks: {} }, acidbros: { files: value.files } });
  }
  require(value?.format === BACKUP_FORMAT && value.schema_version === 1 && isDate(value.exportedAt),
    'この試奏台のバックアップJSONではありません');
  return normalizeBackupState(value);
}

export function mergeBackup(current, incoming, makeId = () => crypto.randomUUID(), importedAt = new Date().toISOString()) {
  require(isDate(importedAt), '読み込み日時が不正です');
  const state = normalizeBackupState(current);
  const input = normalizeBackupState(incoming);
  const stats = { drafts: 0, acidFiles: 0, settings: 0, duplicates: 0 };
  const draftIds = new Map();
  const nextId = (items, candidate) => {
    let id = candidate;
    for (let tries = 0; items.some((item) => item.id === id); tries++) {
      require(tries < 100, '保存IDを作れません');
      id = makeId();
      require(validId(id), '保存IDが不正です');
    }
    return id;
  };
  for (const draft of input.strudel.drafts) {
    const duplicate = state.strudel.drafts.find((item) => item.title === draft.title
      && item.code === draft.code && item.savedAt === draft.savedAt);
    if (duplicate) { draftIds.set(draft.id, duplicate.id); stats.duplicates++; continue; }
    const id = nextId(state.strudel.drafts, draft.id);
    draftIds.set(draft.id, id);
    state.strudel.drafts.push({ ...draft, id, importedAt });
    stats.drafts++;
  }
  for (const file of input.acidbros.files) {
    if (state.acidbros.files.some((item) => item.name === file.name && item.data === file.data
      && item.created === file.created && item.modified === file.modified)) { stats.duplicates++; continue; }
    state.acidbros.files.push({ ...file, id: nextId(state.acidbros.files, file.id) });
    stats.acidFiles++;
  }
  for (let [key, value] of Object.entries(input.strudel.levels)) {
    if (key.startsWith('draft:')) {
      const destination = draftIds.get(key.slice(6));
      if (!destination) continue;
      key = 'draft:' + destination;
    }
    if (!Object.hasOwn(state.strudel.levels, key)) { state.strudel.levels[key] = value; stats.settings++; }
  }
  for (const [key, value] of Object.entries(input.strudel.decks)) {
    if (!Object.hasOwn(state.strudel.decks, key)) { state.strudel.decks[key] = value; stats.settings++; }
  }
  return { state: normalizeBackupState(state), stats };
}

export function writeBackupState(storage, value) {
  const state = normalizeBackupState(value);
  const changes = [
    [BACKUP_KEYS.drafts, state.strudel.drafts], [BACKUP_KEYS.levels, state.strudel.levels],
    [BACKUP_KEYS.decks, state.strudel.decks], [BACKUP_KEYS.acidFiles, state.acidbros.files],
  ].map(([key, data]) => ({ key, next: JSON.stringify(data), previous: storage.getItem(key) }));
  const applied = [];
  try {
    for (const change of changes) { storage.setItem(change.key, change.next); applied.push(change); }
  } catch (error) {
    for (const change of applied.reverse()) {
      if (change.previous === null) storage.removeItem(change.key);
      else storage.setItem(change.key, change.previous);
    }
    throw error;
  }
}
