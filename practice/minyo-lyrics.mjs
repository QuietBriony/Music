// Traditional words only; new readings and explanations by Music Stack.
// Tinsagu adaptations remain CC BY-SA4.0; Tsukinu additions are CC0.
// Sources, authorization and the limits of this practice alignment are in
// songs/lyrics-provenance.json and songs/minyo-v42-research.json.
const TIN_BEATS=[[16,17,18,19,20,22,23],[24,25,26,27,28,30,31],[32,33,34,35,36,38,39],[40,41,42,43,44]];
const MOON_BEATS=[[16,17,18,19,20,21,22],[24,25,26,27,28,29,30],[32,34,36,38]];
function fragments(beats,rows){
 return beats.flatMap((row,line)=>{
  if(row.length!==rows[line]?.length)throw Error('民謡の歌詞位置を確認してください。');
  return row.map((beat,i)=>({beat,text:rows[line][i],line}));
 });
}
export function additionalMinyoLyrics(base){
 const tin=base['song:tinsagu'],moon=base['song:tsukinu'];
 const tinSource='https://www.pref.okinawa.lg.jp/kensei/kengaiyo/1014898.html';
 const tinCredit='沖縄県公表の伝承歌詞の例 · 旋律の簡略譜：Lrschneider (2017) / Music Stack · 新しい歌詞位置・読み方・やさしい意味も CC BY-SA 4.0';
 const tinNote=number=>`${number}番。沖縄県公表の歌詞の例を、既存の1節分の簡略譜に配置しました。歌詞位置はこのアプリの等拍練習用です。先生の譜面や歌の間、地域の発音とは異なる場合があります。`;
 const moonCredit='八重山の伝承歌 · 歌詞の出典は教育芸術社・琉球村、節の照合は伊禮俊一・豊岡マッシー · 新しい歌詞位置・読み方・やさしい意味は Music Stack CC0';
 const moonNote=number=>`${number}番と囃子。前奏から、既存の1節分のやさしい本調子譜で練習します。歌い方・発音には地域差があり、等拍の歌詞位置は先生や原曲の演奏と異なります。`;
 return {
  'song:tinsagu:verse:2':{...tin,
   text:'天ぬ群り星や\n読みば読まりしが\n親ぬゆしぐとぅや\n読みやならぬ',
   syllables:fragments(TIN_BEATS,[['てぃ','んぬ','む','り','ぶ','し','や'],['ゆ','みば','ゆ','ま','り','し','が'],['う','やぬ','ゆ','し','ぐ','とぅ','や'],['ゆ','みや','な','ら','ぬ']]),
   notes:[
    {text:'天ぬ群り星や',reading:'てぃんぬ むりぶしや',meaning:'夜空に集まる、たくさんの星。',words:'てぃん＝空・天 ／ むりぶし＝群がる星'},
    {text:'読みば読まりしが',reading:'ゆみば ゆまりしが',meaning:'星なら、一つずつ数えられるかもしれません。',words:'ゆみ＝ここでは数えること ／ しが＝けれど'},
    {text:'親ぬゆしぐとぅや',reading:'うやぬ ゆしぐとぅや',meaning:'親から受け取った言葉や教えは、',words:'うや＝親 ／ ゆしぐとぅ＝教え・言い聞かせ'},
    {text:'読みやならぬ',reading:'ゆみや ならぬ',meaning:'数えきれないほどある、と歌います。',words:'ならぬ＝できない'}
   ],note:tinNote(2),credit:tinCredit,source:tinSource
  },
  'song:tinsagu:verse:3':{...tin,
   text:'夜走らす船や\n子ぬ方星目当てぃ\n我ぬ生ちぇる親や\n我ぬどぅ目当てぃ',
   syllables:fragments(TIN_BEATS,[['ゆ','るは','ら','す','ふ','に','や'],['に','ぬふぁ','ぶ','し','み','あ','てぃ'],['わ','ぬな','ちぇ','る','う','や','や'],['わ','ぬどぅ','み','あ','てぃ']]),
   notes:[
    {text:'夜走らす船や',reading:'ゆる はらす ふにや',meaning:'暗い夜に舟を進めるときには、',words:'ゆる＝夜 ／ ふに＝船・舟'},
    {text:'子ぬ方星目当てぃ',reading:'にぬふぁぶし みあてぃ',meaning:'北極星を頼りに、向かう先を定めます。',words:'にぬふぁぶし＝北極星 ／ みあてぃ＝目印・頼り'},
    {text:'我ぬ生ちぇる親や',reading:'わぬ なちぇる うやや',meaning:'私を産み、育ててくれた親にとっては、',words:'わぬ＝私 ／ なちぇる＝産んだ ／ うや＝親'},
    {text:'我ぬどぅ目当てぃ',reading:'わぬどぅ みあてぃ',meaning:'子の姿こそが、大切な目印なのです。',words:'歌の意味をつかむための、やさしい意訳です。'}
   ],note:tinNote(3),credit:tinCredit,source:tinSource
  },
  'song:tsukinu:verse:2':{...moon,
   text:'東から上りおる 大月ぬ夜\n沖縄ん八重山ん 照らしょうり\nホーイ チョーガ',
   syllables:fragments(MOON_BEATS,[['ある','から','あーり','おる','うふ','つきぬ','ゆー'],['うき','なん','やい','まん','てぃ','らしょ','ーり'],['ほー','い','ちょー','が']]),
   notes:[
    {text:'東から上りおる 大月ぬ夜',reading:'あるから あーりおる うふつきぬゆー',meaning:'東の空に、大きな月がのぼる夜。',words:'ある＝東 ／ うふつき＝大きな月 ／ ゆ＝夜'},
    {text:'沖縄ん八重山ん 照らしょうり',reading:'うきなん やいまん てぃらしょーり',meaning:'沖縄も八重山も、その光で包んでほしいと願います。',words:'やいま＝八重山 ／ てぃらしょうり＝照らしてください'},
    {...moon.notes[2]}
   ],note:moonNote(2),credit:moonCredit,source:'https://www.kyogei.co.jp/shirabe/kyoudo/text47.html?p=1479'
  },
  'song:tsukinu:verse:3':{...moon,
   text:'あんだぎなーぬ月ぬ夜\n我がげら遊びょうら\nホーイ チョーガ',
   syllables:fragments(MOON_BEATS,[['あん','だぎ','なー','ぬ','つき','ぬ','ゆー'],['ば','がけー','ら','あ','さ','びょー','ら'],['ほー','い','ちょー','が']]),
   notes:[
    {text:'あんだぎなーぬ月ぬ夜',reading:'あんだぎなーぬ つきぬゆー',meaning:'こんなに明るく美しい月夜なら、',words:'あんだぎなーぬ＝あれほどの ／ ゆ＝夜'},
    {text:'我がげら遊びょうら',reading:'ばがけーら あさびょーら',meaning:'みんなで集まって楽しもう、と誘います。',words:'ばがけーら＝私たちみんな ／ あさびょうら＝遊ぼう'},
    {...moon.notes[2]}
   ],note:moonNote(3),credit:moonCredit,source:'https://www.ryukyumura.co.jp/official/oki100/vol24/'
  }
 };
}
