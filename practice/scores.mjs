import { melodyNotes } from './midi.mjs?v=8';
import { CHORDS, chordNotes, mapMelody } from './chords.mjs?v=8';
export const SONGS = {
  guitar: [
    { id: 'amazing-grace', title: 'Amazing Grace', file: 'amazing-grace.mid', chords: 'G・C・D', detail: 'G・C・Dで弾く伝統曲。まずはコードを押さえて、一弦ずつ。', source: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1832', credit: 'Trad. / Arr.: Breizh Partitions (2012) · Mutopia · CC BY-SA 3.0。装飾音を省きGへ移調、コードを追加。' },
    { id:'twinkle', title:'きらきら星', file:'twinkle.mid', chords:'C・Fmaj7・G7', detail:'おなじみの旋律。セーハなしのFmaj7とG7を試せます。', source:'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236', credit:'フランス伝承旋律を新たに入力し、伴奏コードを追加 · MIDIはCC0。' },
    { id:'ode-to-joy', title:'歓喜の歌', file:'ode-to-joy.mid', chords:'C・G7', detail:'ベートーヴェンの主題を短い練習に。CとG7の切り替えから。', source:'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528', credit:'L. v. Beethoven · 主題を新たに入力、Cへ移調、練習用コードを追加 · MIDIはCC0。' }
  ],
  sanshin: [
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
