// Public-domain English texts and CC BY-SA 4.0 Tinsagu adaptation; see songs/lyrics-provenance.json.
export const LYRIC_PRESETS={
 'song:tinsagu':{
  text:'てぃんさぐぬ花や\n爪先に染みてぃ\n親ぬゆしぐとぅや\n肝に染みり',cues:[],
  notes:[
   {text:'てぃんさぐぬ花や',reading:'てぃんさぐぬ はなや',meaning:'ホウセンカの花の色は',words:'てぃんさぐ＝ホウセンカ ／ ぬ＝〜の'},
   {text:'爪先に染みてぃ',reading:'ちみさちに すみてぃ',meaning:'爪先を染めるもの。',words:'ちみさち＝爪先 ／ すみてぃ＝染めて'},
   {text:'親ぬゆしぐとぅや',reading:'うやぬ ゆしぐとぅや',meaning:'親から受けた教えは',words:'うや＝親 ／ ゆしぐとぅ＝教え・言い聞かせ'},
   {text:'肝に染みり',reading:'ちむに すみり',meaning:'心に深く留めよう。',words:'ちむ＝心 ／ すみり＝染めなさい（ここでは心に刻むこと）'}
  ],
  note:'1節。意味は歌うためのやさしい意訳です。地域や歌い手により読み方が異なります。歌詞は「次の行」で送り、時刻を付ければ譜面に追従できます。',
  credit:'沖縄の伝承歌 · Lrschneider (2017) の工工四から、漢字・読み方・意味を追加 · CC BY-SA 4.0',
  source:'https://commons.wikimedia.org/wiki/File:Kunkunshi_for_Tinsagu_nu_Hana.png',license:'https://creativecommons.org/licenses/by-sa/4.0/'
 },
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
