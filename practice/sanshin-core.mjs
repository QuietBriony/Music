// Factual honchoshi positions; original diagrams. See songs/sanshin-provenance.json.
// `fret` is a semitone offset retained for the common note engine, not a metal fret.
const rows = [
  ['合','あい',3,0,48,0], ['乙','おつ',3,2,50,1], ['老','ろう',3,4,52,2],
  ['四','し',2,0,53,0], ['上','じょう',2,2,55,1], ['中','ちゅう',2,4,57,2],
  ['尺♭','しゃく・低め',2,5,58,4], ['尺','しゃく・高め',2,6,59,4],
  ['工','こう',1,0,60,0], ['五','ご',1,2,62,1], ['六','ろく',1,4,64,2],
  ['七','しち',1,5,65,4], ['八','はち',1,7,67,4], ['九','く',1,9,69,4]
];
export const SANSHIN_POSITIONS = rows.map(([symbol,reading,string,fret,midi,finger]) => {
  const stringName=['','女弦','中弦','男弦'][string], fingerName=['押さえない','人差し指','中指','薬指','小指'][finger];
  return Object.freeze({symbol,reading,string,fret,midi,finger,stringName,fingerName,position:`${stringName}・${finger?fingerName:'開放'}`});
});
export const sanshinPosition = symbol => SANSHIN_POSITIONS.find(p=>p.symbol===symbol) || null;
export const neckY = semitones => 55 + (1 - 2 ** (-semitones / 12)) * 390;
export function positionTip(p) {
  if(!p?.finger)return '左手は押さえず、この弦だけを弾きます。';
  if(p.symbol==='八'||p.symbol==='九')return '小指だけを無理に伸ばさず、手全体を胴の方へ移して押さえます。';
  if(p.symbol.startsWith('尺'))return '尺の高さは曲・流派で異なります。譜面と先生の音を確かめて合わせます。';
  return `${p.fingerName}の先で押さえます。手のひらを棹に密着させず、音を聴いて位置を少しずつ調整します。`;
}
