// Original English texts in the public domain; see songs/lyrics-provenance.json.
export const LYRIC_PRESETS={
 'song:amazing-grace':{
  text:'Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.',
  cues:[0,12.000006,24.000012,36.000018].map((time,line)=>({time,line})),
  credit:'John Newton, 1779 · 原詞はPublic Domain · 練習用に区切りと時刻を追加',source:'https://library.intervarsity.org/library/amazing-grace'
 },
 'song:twinkle':{
  text:'Twinkle, twinkle, little star,\nHow I wonder what you are,\nUp above the world so high,\nLike a diamond in the sky.\nTwinkle, twinkle, little star,\nHow I wonder what you are.',
  cues:[0,8,16,24,32,40].map((beat,line)=>({time:beat*.666667,line})),
  credit:'Jane Taylor, The Star, 1806 · 原詞はPublic Domain · 冒頭2行を反復',source:'https://poets.org/poem/star/print'
 }
};
