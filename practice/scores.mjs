import { melodyNotes } from './midi.mjs?v=3';
import { CHORDS, chordNotes, mapMelody } from './chords.mjs?v=3';
export const SONGS = {
  guitar: { id: 'amazing-grace', title: 'Amazing Grace · MIDI', file: 'amazing-grace.mid', detail: 'G・C・Dで弾く伝統曲。メロディーとコードを切り替えられます。', source: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1832', credit: 'Trad. / Arr.: Breizh Partitions (2012) · Mutopia · CC BY-SA 3.0。装飾音を省きGへ移調、コードを追加。' },
  sanshin: { id: 'twinkle', title: 'きらきら星 · MIDI', file: 'twinkle.mid', detail: '本調子の合・乙・老・四・上・中で弾く、42音の旋律です。', source: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236', credit: 'フランス伝承旋律を新たに入力 · 練習用MIDIはCC0。歌詞・録音なし。' }
};
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
