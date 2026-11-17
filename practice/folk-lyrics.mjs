// Traditional first stanzas authorized by the owner on 2026-11-17.
// Aha large-cell order/alignment: mabui (Kawada1965 base), Nomura comparison.
// Aha readings: ks-sanshin. New explanations/app rendering: Music Stack, CC0.
// Other two stanzas are reading companions; their video timing is not inferred.
const cue=(beat,line)=>({time:beat*60/85,line});
const ahaRows=[
 [[8,10,11,12,14,16,20,24],['か','り','ゆ','し','ぬ','あ','し','び']],
 [[28,30,31,32,36,39,40,42],['う','ち','は','り','てぃ','か','ら','や']],
 [[61,63,64,65,67,69,73,77],['ゆ','ぬ','あ','き','てぃ','てぃ','だ','ぬ']],
 [[81,83,84,85,89,95],['あ','が','る','ま','でぃ','ん']]
];
export const FOLK_LYRICS={
 'song:aha':{
  text:'かれよしの遊び\nうちはれてからや\n夜のあけててだの\nあがるまでも',
  cues:[8,28,61,81].map(cue),syncVersion:1,singing:{start:8*60/85,end:96*60/85},
  syllables:ahaRows.flatMap(([beats,texts],line)=>beats.map((beat,i)=>({beat,text:texts[i],line}))),
  notes:[
   {text:'かれよしの遊び',reading:'かりゆしぬ あしび',meaning:'お祝いの席で、みんなと楽しむひととき。',words:'かりゆし＝めでたいこと ／ あしび＝歌や踊りを楽しむこと'},
   {text:'うちはれてからや',reading:'うちはりてぃ からや',meaning:'祝いの席で、ためらわず歌や踊りに加わる気持ちです。',words:'うちはりてぃ＝心が晴れて・うちとけて ／ からや＝〜からには'},
   {text:'夜のあけててだの',reading:'ゆぬ あきてぃ てぃだぬ',meaning:'夜が明け、太陽が顔を出すまで、',words:'ゆ＝夜 ／ てぃだ＝太陽'},
   {text:'あがるまでも',reading:'あがる までぃん',meaning:'この楽しい時間を一緒に過ごそう、と歌います。',words:'までぃん＝〜までも'}
  ],
  note:'本調子で1番を歌う等拍の基礎練習です。上下の句で基本の旋律を繰り返します。小さな飾り音・ハリなどの節回しを省略し、休符上の歌い出しを直前の主音へ寄せた独自の練習位置です。先生の録音とは同期しません。',
  credit:'古典の安波節 · 大きい譜字・歌詞位置：mabui（川田1965を底本）、野村流資料と照合 · 読み：ks-sanshin · アプリの等拍配置・独自の意味：Music Stack CC0',
  source:'https://mabui.jp/ahabushi/',license:'https://creativecommons.org/publicdomain/zero/1.0/'
 },
 'video:sanshin:akata':{
  text:'赤田首里殿内\n黄金灯籠下ぎてぃ\nうりが明がりば\n弥勒迎け\nシーヤープー シーヤープー\nミーミンメー ミーミンメー\nヒージントー ヒージントー\nイーユヌミー イーユヌミー',cues:[],
  notes:[
   {text:'赤田首里殿内',reading:'あかた すんどぅんち',meaning:'首里の赤田にある、祈りの場所を歌っています。',words:'あかた＝首里赤田町 ／ すんどぅんち＝首里殿内'},
   {text:'黄金灯籠下ぎてぃ',reading:'くがに どぅる さぎてぃ',meaning:'金色に輝く灯籠を下げて、',words:'くがに＝黄金 ／ どぅる＝灯籠 ／ さぎてぃ＝下げて'},
   {text:'うりが明がりば',reading:'うりが あかがりば',meaning:'その明かりがともったら、',words:'うり＝それ ／ あかがりば＝明るくなれば'},
   {text:'弥勒迎け',reading:'みるく うんけ',meaning:'平和や豊かな実りを願い、弥勒さまをお迎えします。',words:'みるく＝弥勒 ／ うんけ＝お迎え'},
   {text:'シーヤープー シーヤープー',reading:'しーやーぷー しーやーぷー',meaning:'手遊びを添えて楽しむ囃子です。',words:'伝承の手遊び歌。音の響きを楽しんでみましょう。'},
   {text:'ミーミンメー ミーミンメー',reading:'みーみんめー みーみんめー',meaning:'耳に手を添える手遊びでも親しまれています。',words:'みーみ＝耳'},
   {text:'ヒージントー ヒージントー',reading:'ひーじんとー ひーじんとー',meaning:'ひじを示す手遊びを添えて歌います。',words:'ひーじ＝ひじ'},
   {text:'イーユヌミー イーユヌミー',reading:'いーゆぬみー いーゆぬみー',meaning:'魚の目を表す手遊びを添える句です。',words:'いーゆ＝魚 ／ みー＝目'}
  ],
  note:'1番と伝承の囃子の読みものです。歌詞の表記・囃子には地域差があります。工工四と進み方は先生の動画を使い、この欄は「次の行」で送ります。アプリ内の音符判定や動画への歌詞自動同期は未設定です。',
  credit:'首里の伝承歌 · 本文・囃子の出典：琉球村 vol.1 · 新しい読み・やさしい意味：Music Stack CC0',
  source:'https://www.ryukyumura.co.jp/official/oki100/vol1/',license:'https://creativecommons.org/publicdomain/zero/1.0/'
 },
 'video:sanshin:tancha':{
  text:'谷茶前の浜に\nスルル小が寄ててんど ヘイ\nスルル小が寄ててんど ヘイ\nナンチャマシマシ\nディアンガソイソイ',cues:[],
  notes:[
   {text:'谷茶前の浜に',reading:'たんちゃめーぬ はまに',meaning:'恩納村の谷茶の前に広がる浜辺で、',words:'たんちゃ＝地名の谷茶 ／ めー＝前 ／ はま＝浜'},
   {text:'スルル小が寄ててんど ヘイ',reading:'するるぐわが ゆてぃてんど へい',meaning:'小さな魚がたくさん寄ってきたよ、と呼びかけます。',words:'するる＝キビナゴ ／ ぐわ＝小さなものに添える言葉 ／ ゆてぃ＝寄って'},
   {text:'スルル小が寄ててんど ヘイ',reading:'するるぐわが ゆてぃてんど へい',meaning:'同じ呼びかけをもう一度、楽しく繰り返します。',words:'へい＝歌の掛け声'},
   {text:'ナンチャマシマシ',reading:'なんちゃましまし',meaning:'歌と踊りを盛り上げる囃子です。',words:'囃子は地域・歌い手で言い方が異なります。'},
   {text:'ディアンガソイソイ',reading:'でぃあんがそいそい',meaning:'みんなで調子を合わせて楽しむ掛け声です。',words:'言葉の対訳より、先生の歌のリズムを聴いてみましょう。'}
  ],
  note:'谷茶前節の1番と、琉球村 vol.5 に掲載された形の囃子だけ。伊計離節との接続は含めません。工工四は先生の動画を見て、歌詞のこの欄は「次の行」で送ります。教材によって本文・囃子・調弦が違うため、音符単位の内蔵同期は未設定です。',
  credit:'恩納村谷茶の伝承歌 · 1番：国立劇場おきなわ、囃子2行：琉球村 vol.5 の掲載形のみ · 新しい読み・やさしい意味：Music Stack CC0',
  source:'https://www.nt-okinawa.or.jp/images/lyrics/2026.4/20260404-lyrics.pdf',license:'https://creativecommons.org/publicdomain/zero/1.0/'
 }
};
