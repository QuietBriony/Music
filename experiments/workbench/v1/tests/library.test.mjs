import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';

const source = new URL('../src/', import.meta.url);

test('the public library has a valid default and loadable, parseable patterns', () => {
  const library = JSON.parse(readFileSync(new URL('library.json', source), 'utf8'));
  assert.equal(library.schema_version, 1);
  assert.ok(Array.isArray(library.items) && library.items.length >= 2);
  assert.equal(new Set(library.items.map((item) => item.id)).size, library.items.length);
  assert.ok(library.items.some((item) => item.id === library.default_id));
  for (const item of library.items) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.equal(item.path, '/patterns/' + item.id + '.txt');
    assert.ok(item.title && item.label && item.indexed_at && item.description);
    if (item.mixable !== undefined) assert.equal(typeof item.mixable, 'boolean');
    if (item.playback !== undefined) assert.equal(item.playback, 'from-start');
    if (item.genre !== undefined) assert.ok(typeof item.genre === 'string' && item.genre.trim());
    if (item.genre_note !== undefined) assert.ok(typeof item.genre_note === 'string' && item.genre_note.trim());
    if (item.status !== undefined) assert.equal(item.status, 'prototype');
    if (item.shelf !== undefined) assert.ok(['archive', 'minimal-techno'].includes(item.shelf));
    const code = readFileSync(new URL('patterns/' + item.id + '.txt', source), 'utf8');
    assert.match(code, /stack\(/);
    new Script(code, { filename: item.path });
  }
});
