import { melodyNotes } from './midi.mjs?v=43';
import { CHORDS, chordNotes, mapMelody } from './chords.mjs?v=43';
export const SONGS = {
  guitar: [
    { id: 'amazing-grace', title: 'Amazing Grace', file: 'amazing-grace.mid', chords: 'G・C・D', detail: 'G・C・Dで弾く伝統曲。まずはコードを押さえて、一弦ずつ。', source: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1832', credit: 'Trad. / Arr.: Breizh Partitions (2012) · Mutopia · CC BY-SA 3.0。装飾音を省きGへ移調、コードを追加。' },
    { id:'twinkle', title:'きらきら星', file:'twinkle.mid', chords:'C・Fmaj7・G7', detail:'おなじみの旋律。セーハなしのFmaj7とG7を試せます。', source:'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236', credit:'フランス伝承旋律を新たに入力し、伴奏コードを追加 · MIDIはCC0。' },
    { id:'ode-to-joy', title:'歓喜の歌', file:'ode-to-joy.mid', chords:'C・G7', detail:'ベートーヴェンの主題を短い練習に。CとG7の切り替えから。', source:'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528', credit:'L. v. Beethoven · 主題を新たに入力、Cへ移調、練習用コードを追加 · MIDIはCC0。' }
  ],
  sanshin: [
    { id:'asatoya', title:'安里屋ゆんた（前奏＋1節・やさしい版）', file:'asatoya.mid', detail:'前奏と1節を、大きな工工四とマイクで。飾り音を省き、文字を1拍ずつにした練習版。歌詞・先生の譜割りは教材動画で確認できます。', source:'https://ameblo.jp/irei-blog/entry-12530046929.html', credit:'曲：宮良長包／八重山の伝承曲に基づく。Music Stackが基本旋律を等拍の練習データとして新たに入力 · MIDIと練習用配列 CC0。歌詞・録音・教材PDFは同梱しません。', terms:'songs/asatoya-provenance.json' },
    { id:'tinsagu', title:'てぃんさぐぬ花（やさしい版）', file:'tinsagu.mid', detail:'歌詞は1〜3番から選べます。前後の間奏を含む1節分、小さい飾り音を省いた63音。指図・ガイド・マイクで最後まで練習できます。', source:'https://commons.wikimedia.org/wiki/File:Kunkunshi_for_Tinsagu_nu_Hana.png', credit:'Lrschneider (2017) / Wikimedia Commons · CC BY-SA 4.0。大きい文字を1拍ずつ、本調子Cに設定。装飾音を省略。', terms:'songs/sanshin-provenance.json' },
    { id:'tsukinu', title:'月ぬ美しゃ（やさしい版）', file:'tsukinu.mid', detail:'歌詞は1〜3番から。前奏・1番分・囃子を、同じ歌詞付き工工四で練習します。本調子のやさしい位置へ置き換え、文字を1拍ずつにした練習版。マイク・ガイド・手動送りに対応します。', source:'https://toyosanshin.hatenablog.com/entry/2021/04/03/125128', credit:'八重山の伝承歌。基本旋律を本調子用に新たに入力し、飾り音を省いた等拍の練習版 · MIDI・歌詞位置・独自の意味説明 CC0。先生の動画とは譜割りが異なります。', terms:'songs/tsukinu-provenance.json' },
    {id:'aha',title:'安波節（1番・やさしい版）',file:'aha.mid',detail:'次の民謡におすすめ。祝いの1番を、本調子・歌詞付き工工四で。歌の一行だけ反復してから、上下の句を通して練習できます。',source:'https://mabui.jp/ahabushi/',credit:'国頭村安波の伝承歌。基本旋律を本調子・等拍の練習用に新たに入力 · MIDI・独自の読み・説明・歌詞位置 CC0。先生の演奏とは間や節回しが異なります。',terms:'songs/aha-provenance.json'},
    { id:'twinkle', title:'きらきら星', file:'twinkle.mid', detail:'本調子の合・乙・老・四・上・中で弾く、42音の旋律です。', source:'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236', credit:'フランス伝承旋律を新たに入力 · MIDIはCC0。' },
    { id:'ode-to-joy', title:'歓喜の歌', file:'ode-to-joy.mid', detail:'合・乙・老・四・上で弾く、30音の主題です。', source:'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528', credit:'L. v. Beethoven · 主題を新たに入力、Cへ移調 · MIDIはCC0。' }
  ]
};
// Chord-only exercises use the same symbolic timeline as songs, without file I/O.
export function chordExercise(names) {
  if(!names.length || names.some(name=>!Object.hasOwn(CHORDS,name)))throw new Error('コードを選んでください。');
  const ppq=384, secondsAt=tick=>tick/ppq*60/85;
  return { ppq, timeSignature:[4,4], endBeat:names.length*4, secondsAt, warnings:[],
    markers:names.map((chord,i)=>({tick:i*4*ppq,chord})),
    groups:[{id:'chords',name:'コード練習',channel:0,notes:names.map((chord,i)=>({midi:chordNotes(chord)[0].midi,tick:i*4*ppq,durationTicks:4*ppq,beat:i*4,beats:4,time:secondsAt(i*4*ppq),duration:secondsAt(4*ppq)}))}]
  };
}
export function scoreNotes(midi, group, instrument, { shift = 0, tuning = 0, highVoice = false, chords = false } = {}) {
  const melody = mapMelody(melodyNotes(midi, group, highVoice), instrument, { shift, tuning });
  const cues = midi.markers.filter(m => CHORDS[m.chord]).map((m, i, all) => ({ ...m, time: midi.secondsAt(m.tick), end: midi.secondsAt(all[i + 1]?.tick ?? midi.endBeat * midi.ppq) }));
  if (chords) {
    if (shift) throw new Error('コード練習は元の調で使います。移調を0に戻してください。');
    if (!cues.length) throw new Error('このMIDIには対応するchord:コード名マーカーがありません。メロディーで練習できます。');
    return { melody, cues, notes: cues.flatMap((cue, cueIndex) => {
      const strings = chordNotes(cue.chord), step = (cue.end - cue.time) / strings.length;
      return strings.map((n, i) => ({ ...n, chord: cue.chord, cueIndex, time: cue.time + i * step, duration: Math.min(0.65, step * .85), stepSeconds: step }));
    }) };
  }
  return { melody, cues: shift ? [] : cues, notes: melody };
}
