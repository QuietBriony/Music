import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { BinaryFormatEncoder } from '../third_party/acidbros/js/data/BinaryFormatEncoder.js';
import { BinaryFormatDecoder } from '../third_party/acidbros/js/data/BinaryFormatDecoder.js';
import { BACKUP_KEYS, backupText, parseBackup, readBackupState } from '../src/session-backup.js';

// Exercise the native FILE methods without importing Data's audio/UI graph.
const fileManagerSource = readFileSync(new URL('../third_party/acidbros/js/data/FileManager.js', import.meta.url), 'utf8')
  .replace(/^import \{ Data \} from '\.\.\/data\/Data\.js';\r?\n/, '')
  .replace('export const FileManager =', 'globalThis.FileManager =');
const timestamp = 1_790_000_000_000;
const savedAt = '2026-10-23T00:00:00.000Z';
const encoder = new BinaryFormatEncoder();
const decoder = new BinaryFormatDecoder();
const file = (id, bpm = 137, name = 'Synthetic patch') => {
  const state = decoder.createDefaultState();
  state.bpm = bpm;
  return { id, name, data: encoder.toBase64URL(encoder.encodeFull(state)), created: 100, modified: 200 };
};

class MemoryStorage {
  values = new Map();
  writes = 0;
  failWrites = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('synthetic quota failure');
    this.writes++;
    this.values.set(key, value);
  }
  removeItem(key) { this.values.delete(key); }
}
function nativeFiles(records) {
  const storage = new MemoryStorage();
  storage.setItem(BACKUP_KEYS.acidFiles, JSON.stringify(records));
  storage.setItem('acidbros_current_file', records[0]?.id || 'selected-outside-this-test');
  storage.setItem('unrelated-synthetic-save', 'preserve');
  let exportedText;
  const errors = [];
  const sandbox = {
    localStorage: storage,
    Data: new Proxy({}, { get() { throw new Error('Audio/data initialization is forbidden'); } }),
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [timestamp])); }
      static now() { return timestamp; }
    },
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    URL: {
      createObjectURL(blob) { exportedText = blob.text; return 'blob:synthetic-only'; },
      revokeObjectURL() {}
    },
    document: { createElement(tag) { assert.equal(tag, 'a'); return { click() {} }; } },
    console: { error(...args) { errors.push(args); } }
  };
  vm.runInNewContext(fileManagerSource, sandbox, {
    timeout: 1000, codeGeneration: { strings: false, wasm: false }
  });
  const manager = sandbox.FileManager;
  manager.currentFileId = records[0]?.id || null;
  return {
    manager, storage, errors,
    exportAll() { manager.exportAll(); return exportedText; }
  };
}
function portableFiles(storage) {
  return parseBackup(backupText(readBackupState(storage), savedAt)).acidbros.files;
}

test('native EXPORT ALL -> IMPORT is repeatable and keeps combined backup export usable', () => {
  const original = file('file-one');
  const h = nativeFiles([original]);
  const exported = h.exportAll();
  const writes = h.storage.writes;
  for (let i = 0; i < 3; i++) {
    assert.equal(h.manager.importAll(exported), true);
    assert.deepEqual(portableFiles(h.storage), [original]);
  }
  assert.equal(h.storage.writes, writes, 'an identical native import does not rewrite the shelf');
  assert.equal(h.manager.currentFileId, original.id);
  assert.equal(h.storage.getItem('acidbros_current_file'), original.id);
  assert.equal(h.storage.getItem('unrelated-synthetic-save'), 'preserve');
  assert.equal(h.errors.length, 0);
});

test('native ID collisions preserve both versions, selected FILE, and repeat-import identity', () => {
  const old = file('shared-id');
  const changed = file('shared-id', 141, 'New version');
  const h = nativeFiles([old]);
  const incoming = nativeFiles([changed]).exportAll();
  assert.equal(h.manager.importAll(incoming), true);
  const merged = portableFiles(h.storage);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.find(item => item.id === old.id), old);
  const imported = merged.find(item => item.data === changed.data);
  assert.ok(imported);
  assert.notEqual(imported.id, old.id);
  assert.deepEqual({ ...imported, id: changed.id }, changed);
  assert.equal(h.manager.currentFileId, old.id);
  assert.equal(h.storage.getItem('acidbros_current_file'), old.id);
  const beforeRepeat = new Map(h.storage.values);
  assert.equal(h.manager.importAll(incoming), true);
  assert.deepEqual(h.storage.values, beforeRepeat);
  assert.deepEqual(portableFiles(h.storage), merged);
});

test('duplicate incoming records and colliding batch IDs preserve each distinct saved version', () => {
  const old = file('shared-id');
  const first = file('shared-id', 141, 'First imported');
  const second = file('shared-id', 142, 'Second imported');
  const reserved = file('import-' + timestamp + '-1', 143, 'Distinct ID');
  const h = nativeFiles([old]);
  const incoming = nativeFiles([first, { ...first }, second, reserved]).exportAll();
  assert.equal(h.manager.importAll(incoming), true);
  const merged = portableFiles(h.storage);
  assert.equal(merged.length, 4);
  assert.equal(new Set(merged.map(item => item.id)).size, 4);
  for (const entry of [old, first, second, reserved]) {
    assert.equal(merged.filter(item => item.data === entry.data).length, 1);
  }
  assert.deepEqual(merged.find(item => item.id === old.id), old);
  assert.deepEqual(merged.find(item => item.id === reserved.id), reserved);
  const beforeRepeat = new Map(h.storage.values);
  assert.equal(h.manager.importAll(incoming), true);
  assert.deepEqual(h.storage.values, beforeRepeat);
});

test('native import failure leaves the shelf and selected FILE unchanged', () => {
  const old = file('existing');
  const h = nativeFiles([old]);
  const before = new Map(h.storage.values);
  assert.equal(h.manager.importAll('{'), false);
  assert.deepEqual(h.storage.values, before);
  const incoming = nativeFiles([file('new', 141)]).exportAll();
  h.storage.failWrites = true;
  assert.equal(h.manager.importAll(incoming), false);
  assert.deepEqual(h.storage.values, before);
  assert.equal(h.manager.currentFileId, old.id);
});
