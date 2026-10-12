import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_LYRICS, LYRIC_DRAFT_KEY, createLyricDrafts } from '../src/vocal-lyrics.js';
const legacyKey='music-workbench-vocal-draft-v1';
function memory(entries=[]) {
  const values=new Map(entries);
  return {getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value)};
}
const song=BUILTIN_LYRICS[0];
test('fresh phone opens the included original without a file or network',()=>{
  const library=createLyricDrafts(memory());
  assert.equal(library.selected,song.id);
  assert.equal(library.current().title,'残響の住所');
  assert.match(library.current().lyrics,/電気はそのまま　もう少し聴こう/);
});
test('existing v1 draft is retained, both choices preserve edits across switching and reload',()=>{
  const original={title:'自分の曲',lyrics:'消さない歌詞'};
  const storage=memory([[legacyKey,JSON.stringify(original)]]);
  let library=createLyricDrafts(storage);
  assert.equal(library.selected,'custom');
  assert.deepEqual(library.current(),original);
  const builtin=library.choose(song.id,original);
  const edited={...builtin,title:'今日のテイク',lyrics:builtin.lyrics+'\n自分の言葉'};
  library.save(edited);
  assert.deepEqual(library.choose('custom',edited),original);
  const customEdit={title:'続き',lyrics:'編集した続き'};
  assert.deepEqual(library.choose(song.id,customEdit),edited);
  library=createLyricDrafts(storage);
  assert.equal(library.selected,song.id);
  assert.deepEqual(library.current(),edited);
  assert.deepEqual(library.choose('custom',edited),customEdit);
  assert.deepEqual(JSON.parse(storage.getItem(legacyKey)),original,'old version remains recoverable');
});
test('quota failure does not switch the selected song or commit a partial draft',()=>{
  const storage=memory(); const library=createLyricDrafts(storage);
  library.save(library.current()); const before=storage.getItem(LYRIC_DRAFT_KEY);
  storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>library.choose('custom',{title:'未保存',lyrics:'画面に残す'}),/quota/);
  assert.equal(library.selected,song.id);
  assert.equal(library.current().title,song.title);
  assert.equal(storage.getItem(LYRIC_DRAFT_KEY),before);
});
test('intentional blank edits stay blank when returning and reloading',()=>{
  const storage=memory(); const library=createLyricDrafts(storage);
  library.save({title:'',lyrics:''});
  library.choose('custom',library.current());
  library.choose(song.id,library.current());
  assert.deepEqual(createLyricDrafts(storage).current(),{title:'',lyrics:''});
});
test('unsupported or damaged storage is never overwritten during initialization',()=>{
  for (const raw of ['{broken',JSON.stringify({version:3,selected:song.id,drafts:{}})]) {
    const storage=memory([[LYRIC_DRAFT_KEY,raw]]);
    assert.throws(()=>createLyricDrafts(storage));
    assert.equal(storage.getItem(LYRIC_DRAFT_KEY),raw);
  }
});
