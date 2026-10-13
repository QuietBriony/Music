import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_LYRICS, LYRIC_DRAFT_KEY, createLyricDrafts, lyricSections } from '../src/vocal-lyrics.js';
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

test('two open screens editing different songs merge the latest drafts',()=>{
  const storage=memory(), a=createLyricDrafts(storage), b=createLyricDrafts(storage);
  b.choose('custom',b.current());
  a.save({title:'曲A',lyrics:'内蔵曲の自分の編集'});
  b.save({title:'曲B',lyrics:'自由な下書き'});
  assert.deepEqual(a.choose('custom',a.current()),{title:'曲B',lyrics:'自由な下書き'});
  assert.deepEqual(b.choose(song.id,b.current()),{title:'曲A',lyrics:'内蔵曲の自分の編集'});
});

test('same-song conflict preserves saved text and visible selection, including a failed switch',()=>{
  const storage=memory(), a=createLyricDrafts(storage), b=createLyricDrafts(storage);
  a.save({title:'別画面の編集',lyrics:'先に保存した本文'});
  const stored=storage.getItem(LYRIC_DRAFT_KEY), visible={title:'手元の編集',lyrics:'消してはいけない本文'};
  for (const write of [()=>b.save(visible),()=>b.choose('custom',visible)]) {
    assert.throws(write,error=>error.code==='LYRIC_CONFLICT');
    assert.equal(storage.getItem(LYRIC_DRAFT_KEY),stored);
    assert.equal(b.selected,song.id);
    assert.deepEqual(visible,{title:'手元の編集',lyrics:'消してはいけない本文'});
  }
});

test('unchanged stale screen cannot roll back a newer edit when switching songs',()=>{
  const storage=memory(), a=createLyricDrafts(storage), b=createLyricDrafts(storage);
  a.save({title:'新しい版',lyrics:'別画面で書いた言葉'});
  b.choose('custom',b.current());
  assert.deepEqual(b.choose(song.id,b.current()),a.current());
});

test('damaged or newer shelf discovered at save time is not overwritten',()=>{
  const storage=memory(), library=createLyricDrafts(storage);
  const raw=JSON.stringify({version:3,selected:song.id,drafts:{}});
  storage.setItem(LYRIC_DRAFT_KEY,raw);
  assert.throws(()=>library.save({title:'編集',lyrics:'保存しない'}));
  assert.equal(storage.getItem(LYRIC_DRAFT_KEY),raw);
});

test('reader sections distinguish repeated hooks and retain literal text',()=>{
  const sections=lyricSections(song.lyrics);
  assert.equal(sections.length,7);
  assert.equal(sections.filter(s=>s.heading.startsWith('Hook')).length,2);
  assert.match(sections.at(-1).text,/もう少し聴こう/);
  assert.deepEqual(lyricSections('普通の[言葉]\n<script>literal</script>'),[{heading:'',text:'普通の[言葉]\n<script>literal</script>'}]);
  assert.equal(lyricSections('[Verse]\r\n一行\r\n\r\n[Hook]\r\n次').length,2);
  assert.deepEqual(lyricSections(''),[]);
});
