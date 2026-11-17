// Traditional/PD texts and CC BY-SA 4.0 Tinsagu adaptation; see songs/lyrics-provenance.json.
import {additionalMinyoLyrics} from './minyo-lyrics.mjs?v=42';
export const LYRIC_PRESETS={
 'song:tsukinu':{
  text:'月ぬ美しゃ 十日三日\n女童美しゃ 十七つ\nホーイ チョーガ',
  cues:[16,24,32].map((beat,line)=>({time:beat*60/85,line})),syncVersion:1,singing:{start:16*60/85,end:42*60/85},
  syllables:[
   [16,'つく',0],[17,'ぬ',0],[18,'かい',0],[19,'しゃ',0],[20,'とぅか',0],[21,'みっ',0],[22,'か',0],
   [24,'みや',1],[25,'らび',1],[26,'かい',1],[27,'しゃ',1],[28,'とぅ',1],[29,'なな',1],[30,'つ',1],
   [32,'ほー',2],[34,'い',2],[36,'ちょー',2],[38,'が',2]
  ].map(([beat,text,line])=>({beat,text,line})),
  notes:[
   {text:'月ぬ美しゃ 十日三日',reading:'つくぬ かいしゃ とぅかみっか',meaning:'月の美しさを、満ちる前の十三夜に重ねています。',words:'かいしゃ＝美しい ／ とぅかみっか＝十三日（旧暦）'},
   {text:'女童美しゃ 十七つ',reading:'みやらび かいしゃ とぅななつ',meaning:'娘の美しい年ごろとして、十七歳を歌います。',words:'みやらび＝娘・若い女性 ／ とぅななつ＝十七歳'},
   {text:'ホーイ チョーガ',reading:'ほーい ちょーが',meaning:'歌の結びに添える囃子です。',words:'語句の対訳より、先生の声を聴いて響きをまねてみましょう。'}
  ],
  note:'前奏・1節・囃子のやさしい本調子版。小さい飾り音を省き、1マス1拍で歌詞を配置しました。先生やApple Musicの演奏とは譜割りが異なります。読み方は一例で、地域・歌い手により発音が変わります。',
  credit:'八重山の伝承歌 · 工工四は本調子用に新たに入力 · 歌詞位置・読み方・やさしい意味はMusic Stackの練習用 CC0',
  source:'https://www.kyogei.co.jp/shirabe/kyoudo/text47.html?p=1479'
 },
 'song:tinsagu':{
  text:'てぃんさぐぬ花や\n爪先に染みてぃ\n親ぬゆしぐとぅや\n肝に染みり',cues:[16,24,32,40].map((beat,line)=>({time:beat*60/85,line})),syncVersion:1,singing:{start:16*60/85,end:45*60/85},
  syllables:[
   [16,'てぃ',0],[17,'んさ',0],[18,'ぐ',0],[19,'ぬ',0],[20,'は',0],[22,'な',0],[23,'や',0],
   [24,'ち',1],[25,'みさ',1],[26,'ち',1],[27,'に',1],[28,'す',1],[30,'み',1],[31,'てぃ',1],
   [32,'う',2],[33,'やぬ',2],[34,'ゆ',2],[35,'し',2],[36,'ぐ',2],[38,'とぅ',2],[39,'や',2],
   [40,'ち',3],[41,'むに',3],[42,'す',3],[43,'み',3],[44,'り',3]
  ].map(([beat,text,line])=>({beat,text,line})),
  notes:[
   {text:'てぃんさぐぬ花や',reading:'てぃんさぐぬ はなや',meaning:'ホウセンカの花の色は',words:'てぃんさぐ＝ホウセンカ ／ ぬ＝〜の'},
   {text:'爪先に染みてぃ',reading:'ちみさちに すみてぃ',meaning:'爪先を染めるもの。',words:'ちみさち＝爪先 ／ すみてぃ＝染めて'},
   {text:'親ぬゆしぐとぅや',reading:'うやぬ ゆしぐとぅや',meaning:'親から受けた教えは',words:'うや＝親 ／ ゆしぐとぅ＝教え・言い聞かせ'},
   {text:'肝に染みり',reading:'ちむに すみり',meaning:'心に深く留めよう。',words:'ちむ＝心 ／ すみり＝染めなさい（ここでは心に刻むこと）'}
  ],
  note:'1節。意味は歌うためのやさしい意訳です。地域や歌い手により読み方が異なります。大きい譜字を1拍とした練習用の位置合わせで、前奏16拍・歌29拍・後奏19拍。ガイドの速さや反復に合わせて歌詞・読み方・意味が進みます。歌い手の節回しとは異なる場合があります。',
  credit:'沖縄の伝承歌 · Lrschneider (2017) の工工四から、漢字・読み方・意味と練習用の歌詞位置を追加 · CC BY-SA 4.0',
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
Object.assign(LYRIC_PRESETS,additionalMinyoLyrics(LYRIC_PRESETS));
