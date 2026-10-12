import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKUP_KEYS, MAX_BACKUP_BYTES, backupText, mergeBackup, normalizeBackupState,
  parseBackup, readBackupState, writeBackupState,
} from '../src/session-backup.js';
import { BinaryFormatEncoder } from '../third_party/acidbros/js/data/BinaryFormatEncoder.js';
import { BinaryFormatDecoder } from '../third_party/acidbros/js/data/BinaryFormatDecoder.js';
import { captureMachineState } from '../src/machine-state.js';

const savedAt = '2026-09-30T01:00:00.000Z';
const importedAt = '2026-09-30T02:00:00.000Z';
const encoder = new BinaryFormatEncoder();
const decoder = new BinaryFormatDecoder();
const acidState = decoder.createDefaultState();
acidState.bpm = 137;
acidState.patterns[7].units.tb303_1.sequence[4] = { active: true, note: 'D#', octave: 3, accent: true, slide: true };
acidState.patterns[7].units.tr909.tracks.bd.steps[6] = 1;
const acidData = encoder.toBase64URL(encoder.encodeFull(acidState));
const empty = () => ({ strudel: { drafts: [], levels: {}, decks: {} }, acidbros: { files: [] } });
const fixture = () => ({
  strudel: {
    drafts: [{ id: 'draft-one', title: 'ミョンの版', code: 'setcpm(32)\ns("bd*4")', savedAt }],
    levels: { 'draft:draft-one': 0.42, 'published:aphex1': 0.7 },
    decks: { 'aphex1|techno-dub': { a: 0.5, b: 0.6, cross: 0.3 } },
  },
  acidbros: { files: [{ id: 'file-one', name: '303の試作', data: acidData, created: 100, modified: 200 }] },
});
const jointFixture = () => ({ version:1,level:.37,machine:captureMachineState({
  ...acidState,currentPatternId:7,mode:'pattern',keepSoundSettings:false,
  unitLocks:{tb303_1:false,tb303_2:true,tr909:true},active909Tracks:['bd','sd','ch','oh'],
  exportFullState:()=>acidData,
}, {tempo:137,swing:50}) });

test('combined saves survive backup import, retain same-code/different-machine versions, and require schema 4',()=>{
  const current=fixture();current.strudel.drafts[0].joint=jointFixture();
  current.strudel.drafts[0].joint.machine.rackAuto={enabled:true,bars:8};
  const text=backupText(current,savedAt);assert.equal(JSON.parse(text).schema_version,4);
  const parsed=parseBackup(text);assert.deepEqual(parsed.strudel.drafts[0].joint,current.strudel.drafts[0].joint);
  const incoming=parseBackup(text);incoming.strudel.drafts[0].joint.machine.locks.tr909=false;
  const merged=mergeBackup(current,incoming,()=> 'second-version',importedAt);
  assert.equal(merged.stats.drafts,1,'same Strudel code does not erase a different machine snapshot');
  assert.equal(merged.state.strudel.drafts[0].joint.machine.locks.tr909,true);
  assert.equal(merged.state.strudel.drafts[1].joint.machine.locks.tr909,false);
  const repeat=mergeBackup(merged.state,incoming,()=> 'unused',importedAt);
  assert.equal(repeat.stats.drafts,0);
  const storage=new MemoryStorage();writeBackupState(storage,merged.state);
  assert.deepEqual(readBackupState(storage),merged.state);
  const invalid=fixture();invalid.strudel.drafts[0].joint=jointFixture();invalid.strudel.drafts[0].joint.level=2;
  assert.throws(()=>writeBackupState(storage,invalid),/音量/);
  assert.deepEqual(readBackupState(storage),merged.state,'invalid imports cannot partially replace existing saves');
  assert.equal(JSON.parse(backupText(fixture())).schema_version,1,'old code-only backups remain compatible');
  const legacy=JSON.parse(text);legacy.schema_version=2;legacy.strudel.drafts[0].joint.machine.version=1;
  delete legacy.strudel.drafts[0].joint.machine.drumLocks;
  assert.ok(Object.values(parseBackup(JSON.stringify(legacy)).strudel.drafts[0].joint.machine.drumLocks).every(v=>v===false));
  const legacyParts=JSON.parse(text);legacyParts.schema_version=3;legacyParts.strudel.drafts[0].joint.machine.version=2;
  delete legacyParts.strudel.drafts[0].joint.machine.rackAuto;
  assert.deepEqual(parseBackup(JSON.stringify(legacyParts)).strudel.drafts[0].joint.machine.rackAuto,{enabled:false,bars:4});
  const brokenAuto=JSON.parse(text);brokenAuto.strudel.drafts[0].joint.machine.rackAuto.bars=0;
  assert.throws(()=>parseBackup(JSON.stringify(brokenAuto)),/AUTO/);
  current.strudel.drafts[0].joint.machine.drumLocks.bd=true;
  assert.equal(parseBackup(backupText(current,savedAt)).strudel.drafts[0].joint.machine.drumLocks.bd,true);
});

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test('one JSON carries drafts, settings, and an exact full acidBros FILE without loading the engine', () => {
  const state = fixture();
  const parsed = parseBackup(backupText(state, savedAt));
  assert.deepEqual(parsed, normalizeBackupState(state));
  assert.equal(parsed.acidbros.files[0].data, acidData);
  const decoded = decoder.decode(parsed.acidbros.files[0].data);
  assert.equal(decoded.bpm, 137);
  assert.deepEqual(decoded.patterns[7].units.tb303_1.sequence[4], acidState.patterns[7].units.tb303_1.sequence[4]);
  assert.equal(decoded.patterns[7].units.tr909.tracks.bd.steps[6], 1);
  assert.equal(parsed.strudel.drafts[0].code, state.strudel.drafts[0].code);
});

test('existing acidBros EXPORT ALL is accepted, but a partial pattern or truncated FILE is rejected', () => {
  const state = fixture();
  const parsed = parseBackup(JSON.stringify({ version: 1, exported: 200, files: state.acidbros.files }));
  assert.equal(parsed.acidbros.files[0].data, acidData);
  assert.equal(parsed.strudel.drafts.length, 0);
  state.acidbros.files[0].data = encoder.toBase64URL(encoder.encodeForShare(acidState));
  assert.throws(() => backupText(state), /完全なFILE/);
  state.acidbros.files[0].data = acidData.slice(0, -12);
  assert.throws(() => backupText(state), /終了|切れ/);
});

test('invalid schemas, keys, levels, duplicates, and oversized input cannot enter storage', () => {
  assert.throws(() => parseBackup('{'), /JSON/);
  assert.throws(() => parseBackup('{}'), /バックアップJSON/);
  assert.throws(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /8 MB/);
  const state = fixture();
  state.strudel.levels['published:aphex1'] = -0.2;
  assert.throws(() => backupText(state), /音量/);
  state.strudel.levels = JSON.parse('{"__proto__":0.5}');
  assert.throws(() => backupText(state), /音量/);
  state.strudel.levels = {};
  state.strudel.drafts.push({ ...state.strudel.drafts[0] });
  assert.throws(() => backupText(state), /下書き/);
  assert.throws(() => mergeBackup(empty(), empty(), undefined, 'invalid'), /日時/);
});

test('ID collisions keep old saves and remap incoming draft levels, while existing settings win', () => {
  const current = fixture();
  const incoming = fixture();
  incoming.strudel.drafts[0].code = 's("sd*4")';
  incoming.strudel.levels['draft:draft-one'] = 0.22;
  incoming.strudel.levels['published:aphex1'] = 0.1;
  incoming.strudel.levels['draft:missing'] = 0.9;
  incoming.strudel.decks['aphex1|techno-dub'].cross = 0.9;
  incoming.acidbros.files[0].name = '別の303';
  let n = 0;
  const { state, stats } = mergeBackup(current, incoming, () => 'import-' + ++n, importedAt);
  assert.deepEqual(state.strudel.drafts[0], current.strudel.drafts[0]);
  assert.equal(state.strudel.drafts[1].id, 'import-1');
  assert.equal(state.strudel.drafts[1].importedAt, importedAt);
  assert.equal(state.strudel.levels['draft:import-1'], 0.22);
  assert.equal(state.strudel.levels['draft:draft-one'], 0.42);
  assert.equal(state.strudel.levels['published:aphex1'], 0.7);
  assert.equal(state.strudel.levels['draft:missing'], undefined);
  assert.equal(state.strudel.decks['aphex1|techno-dub'].cross, 0.3);
  assert.equal(state.acidbros.files[1].id, 'import-2');
  assert.deepEqual(stats, { drafts: 1, acidFiles: 1, settings: 1, duplicates: 0 });
  assert.equal(current.strudel.drafts.length, 1);
});

test('repeat imports add nothing, including after an ID was remapped on the first import', () => {
  const current = fixture();
  const incoming = fixture();
  incoming.strudel.drafts[0].code = 's("sd*4")';
  incoming.acidbros.files[0].name = '別の303';
  let n = 0;
  const first = mergeBackup(current, incoming, () => 'import-' + ++n, importedAt);
  const second = mergeBackup(first.state, incoming, () => { throw new Error('must not create another ID'); }, importedAt);
  assert.deepEqual(second.state, first.state);
  assert.deepEqual(second.stats, { drafts: 0, acidFiles: 0, settings: 0, duplicates: 2 });
});

test('storage writes preserve selected acid FILE and roll back every earlier write on quota failure', () => {
  const storage = new MemoryStorage();
  storage.setItem('acidbros_current_file', 'current-patch');
  writeBackupState(storage, empty());
  assert.equal(storage.getItem('acidbros_current_file'), 'current-patch');
  const before = new Map(storage.values);
  const set = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === BACKUP_KEYS.acidFiles) throw new Error('quota exceeded');
    set(key, value);
  };
  assert.throws(() => writeBackupState(storage, fixture()), /quota/);
  assert.deepEqual(storage.values, before);
  const fresh = new MemoryStorage();
  fresh.setItem = (key, value) => {
    if (key === BACKUP_KEYS.decks) throw new Error('quota exceeded');
    fresh.values.set(key, value);
  };
  assert.throws(() => writeBackupState(fresh, fixture()), /quota/);
  assert.equal(fresh.values.size, 0);
  storage.setItem = set;
  writeBackupState(storage, fixture());
  assert.deepEqual(readBackupState(storage), normalizeBackupState(fixture()));
  assert.equal(storage.getItem('acidbros_current_file'), 'current-patch');
});
