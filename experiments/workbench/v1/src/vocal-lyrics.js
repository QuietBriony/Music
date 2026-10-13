// This one original was approved for in-app publication by the owner on 2026-10-12.
// User edits and recordings remain local; this is not a remote lyrics service.
export const BUILTIN_LYRICS = Object.freeze([Object.freeze({
  id: 'zankyo-no-jusho-v1', title: '残響の住所',
  note: 'オリジナル · 44小節。1行を約2小節、速いビートは半分の速さで数えて。',
  lyrics: `残響の住所
オリジナル歌詞・初稿

[Intro · 4小節 / 小さく、話す。キック＋低音だけ]
換気扇を止めても　街はまだ回ってる
濡れた靴の裏から　夜が部屋に上がる

[Verse · 16小節 / 前半は低く。後半だけ少し前へ]
ポケットのレシート　知らない地図みたいだ
帰り道のコンビニ　白すぎる灯りが
今日の続きだけを　黙って照らしてる
言いそびれたことは　冷蔵庫で冷えてる

線路の向こうで　誰かがドアを閉めた
その音を拾って　足元へ並べた
一個だけ残して　あとはまたほどく
答えのないところに　次のキックを置く

[Hook · 8小節 / 音程は付けすぎず、同じ抑揚で]
ここにいる　まだ音がする
名前はあとで　息を置いてく
ここにいる　また音がする
帰る場所なら　この間に作る

[Spoken · 4小節 / ハットを抜く。会話の声で]
止まってるように見えたんだ
同じ場所で　少しずつ変わってた

[Hook · 8小節 / 返しの303を戻す。最後の行だけ強く]
ここにいる　まだ音がする
名前はあとで　息を置いてく
ここにいる　また音がする
帰る場所なら　この間に作る

[Outro · 4小節 / 声を抜く。最後の2小節だけつぶやく]
（2小節、演奏だけ）
電気はそのまま　もう少し聴こう
`,
})]);

export const LYRIC_DRAFT_KEY = 'music-workbench-vocal-lyrics-v2';
const LEGACY_KEY = 'music-workbench-vocal-draft-v1';
const known = id => id === 'custom' || BUILTIN_LYRICS.some(song => song.id === id);
const clean = draft => {
  if (!draft || typeof draft.title !== 'string' || typeof draft.lyrics !== 'string') throw new Error('歌詞の保存形式を読めません。');
  return {title: draft.title.slice(0,80), lyrics: draft.lyrics.slice(0,50000)};
};

const content = (drafts, id) => {
  const song = BUILTIN_LYRICS.find(song => song.id === id);
  return {...(drafts[id] || {title: song?.title || '', lyrics: song?.lyrics || ''})};
};
const same = (a, b) => a.title === b.title && a.lyrics === b.lyrics;
function readShelf(storage) {
  let selected, drafts = {};
  const raw = storage.getItem(LYRIC_DRAFT_KEY);
  if (raw !== null) {
    const saved = JSON.parse(raw);
    if (saved?.version !== 2 || !known(saved.selected) || !saved.drafts || typeof saved.drafts !== 'object') throw new Error('歌詞棚の保存形式を読めません。');
    selected = saved.selected;
    for (const [id, draft] of Object.entries(saved.drafts)) if (known(id)) drafts[id] = clean(draft);
  } else {
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy !== null) drafts.custom = clean(JSON.parse(legacy));
    selected = drafts.custom?.title || drafts.custom?.lyrics ? 'custom' : BUILTIN_LYRICS[0].id;
  }
  return {selected, drafts};
}

// Merge the latest shelf on every write: the standalone rack and Workbench
// can be open together. Conflicting edits keep both the stored and visible text.
export function createLyricDrafts(storage) {
  let {selected, drafts} = readShelf(storage);
  const current = () => content(drafts, selected);
  function write(draft, next = selected) {
    if (!known(next)) throw new Error('この歌詞は選べません。');
    const incoming = clean(draft), baseline = current();
    const latest = readShelf(storage), saved = content(latest.drafts, selected);
    if (!same(incoming, baseline) && !same(saved, baseline) && !same(incoming, saved)) {
      const error = new Error('別画面でこの歌詞が更新されています。今の文章はTXTで保存してから開き直してください。');
      error.code = 'LYRIC_CONFLICT'; throw error;
    }
    const updated = {...latest.drafts, [selected]: same(incoming, baseline) ? saved : incoming};
    storage.setItem(LYRIC_DRAFT_KEY, JSON.stringify({version:2, selected:next, drafts:updated}));
    drafts = updated; selected = next;
    return current();
  }
  return {get selected(){return selected;}, current, save:write, choose:(id,draft)=>write(draft,id)};
}

// Only whole-line [section headings] are navigation markers. Text is rendered
// as textContent by the reader, never interpreted as HTML or musical commands.
export function lyricSections(text) {
  const sections = [{heading:'', text:''}];
  for (const line of text.split('\n')) {
    const heading = line.match(/^\s*\[([^\]\r\n]{1,160})\]\s*\r?$/u)?.[1];
    if (heading) sections.push({heading, text:line});
    else sections.at(-1).text += (sections.at(-1).text ? '\n' : '') + line;
  }
  return sections.filter(section => section.text.trim());
}
