const STORAGE_KEY = "music-stack.lyric-lab.v1";
const LIBRARY_KEY = "music-stack.lyric-lab.library.v1";
const SYNC_TOKEN_KEY = "music-stack.lyric-lab.sync-token.v1";
const TOKEN_HELP = "接続設定に同期キーを貼り付けてください";
const INTAKE_PROMPT = `私は沖縄ローカルの視点から、歌詞を作るための思想体系を蒸留したいです。

扱いたいテーマは、
ねじれた政局、公共事業依存、基地問題、日本自体の問題、アメリカへの憎悪と憧れと現実のアホさ、地上戦の悲惨さ、先祖への敬意、現代のウチナーンチュとは何か、琉球とは何か、軽々しく言えない独立、です。

ただし、政治スローガンにはしたくありません。
沖縄記号にもしたくありません。
説教ではなく、生活、夜、酒場、小箱、家族、風土、文化を回す立場から滲ませたいです。

私に質問しながら、
1. 私の思想の核
2. 言ってはいけないこと
3. 歌詞にしていい距離感
4. 使える語彙
5. 避けたい語彙
6. 歌詞プリセットにできる世界観
に整理してください。
一問ずつ深く聞いてください。`;

const VIEW_LABELS = {
  draft: "下書き",
  library: "作品棚",
  final: "歌詞",
  hook: "Hook",
  suno: "制作",
  map: "曲設計"
};

const PRODUCTION_SOURCES = {
  notes: { label: "ネタ断片", linkLabel: "制作元を開く", urlLabel: "制作元URL（任意）" },
  "voice-memo": { label: "ボイスメモ", linkLabel: "元メモを開く", urlLabel: "ボイスメモURL" },
  bandlab: { label: "BandLab", linkLabel: "BandLabを開く", urlLabel: "BandLabプロジェクトURL" },
  "ace-step": { label: "ACE-Step", linkLabel: "ACE-Step素材を開く", urlLabel: "ACE-Step素材URL" },
  "band-room": { label: "Band Room", linkLabel: "Band Room素材を開く", urlLabel: "Band Room素材URL" },
  other: { label: "その他", linkLabel: "制作元を開く", urlLabel: "制作元URL（任意）" }
};

const PRODUCTION_TARGETS = {
  "ace-step": "ACE-Step",
  bandlab: "BandLab",
  suno: "Suno",
  "band-room": "Band Room"
};

const $ = (id) => document.getElementById(id);

const state = {
  reroll: 0,
  activeView: "draft",
  result: null,
  currentId: null,
  library: [],
  librarySearch: "",
  libraryFilter: "all",
  cloudStatus: "idle",
  cloudLoaded: false,
  cloudCount: null
};

const imageBanks = {
  quiet: [
    "静かな床だけが",
    "冷えた窓の前で",
    "声になる前の場所で",
    "息を半分だけ残して"
  ],
  heat: [
    "古い火がまだ鳴っている",
    "冷めた熱が手の中で光る",
    "燃え残りだけが拍を打つ",
    "熱は低くなって強くなる"
  ],
  green: [
    "名づける前から緑は濃くなる",
    "部屋のすみで緑が返事をする",
    "みどりの影が少しだけ深くする",
    "葉のない緑がまだ増える"
  ],
  time: [
    "半ばを過ぎてから始まりが開く",
    "時計だけがまじめに働く",
    "終わりのふりをして朝が残る",
    "遅れたままの拍が正しくなる"
  ],
  play: [
    "遊びだけがまだ説明を拒む",
    "まじめな顔をまたいで進む",
    "回らないまま軽くなる",
    "戻らないまま名前になる"
  ],
  odd: [
    "中心なんてない、指だけが残る",
    "ありうるものだけが変な顔をする",
    "便利な口の奥で不便が育つ",
    "わかる前の風が通り抜ける"
  ]
};

const keywordReplies = [
  { test: /中心|指/, lines: ["円の外側で雨が形を変える", "中心なんてない、指だけが残る"] },
  { test: /半ば|とわ|永遠|憧/, lines: ["半ばを過ぎてから始まりが開く", "終わりのふりをして緑は濃くなる"] },
  { test: /静け|熱|覚ま/, lines: ["冷めた熱が手の中で光る", "静かな床だけがまだ拍を持つ"] },
  { test: /便利|hook|loop/i, lines: ["便利な耳をしまう", "不便なままで loop"] },
  { test: /みどり|緑|植物|代弁者/, lines: ["名づける前から緑は濃くなる", "部屋のすみで緑が返事をする"] },
  { test: /遊|回ら|戻ら|ヒトトビ/, lines: ["遊びだけがまだ説明を拒む", "回らないまま軽くなる"] },
  { test: /みざる|いわざる|きかざる|見ざる|言わざる|聞かざる/, lines: ["見ないふりの奥で目が濡れる", "言わない舌の上で言葉だけが育つ"] },
  { test: /stupid|genius|mind/i, lines: ["Live like stupid", "genius free", "mindblowing"] },
  { test: /感謝|かんしゃ|われら/, lines: ["かんしゃ", "われら", "みどりの代弁者"] },
  { test: /基地|アメリカ|日本|琉球|独立|地上戦|先祖|ウチナーンチュ|公共事業|政局/, lines: ["軽く言えない言葉だけが残る", "生活の床で歴史がまだ鳴る", "旗の手前で息を整える"] }
];

const directionProfiles = {
  hitotobi: {
    label: "ヒトトビ prayer",
    suno: "Japanese alternative rock, collective vocal, dry drums, bass-forward room, loose band feel",
    banks: [
      "静けさのなかで熱を覚ます",
      "円の外側で雨が形を変える",
      "名づける前から緑は濃くなる",
      "遊びだけがまだ説明を拒む"
    ],
    bridge: ["中心なんてない", "指だけが残る", "半ば過ぎてから始まりが開く"],
    close: ["回らない", "戻らない", "ヒトトビ"],
    keywordReplies: []
  },
  rave: {
    label: "rave fragments",
    suno: "late-night spoken techno, motorik pulse, warehouse bass, fragmentary Japanese-English chant, no named artist reference",
    banks: [
      "駅の光がまだ走っている",
      "two more minutes in the tunnel",
      "青い看板だけが名前を覚えてる",
      "低い bass が床をまっすぐにする",
      "we move without a witness",
      "neon rain on the inside"
    ],
    bridge: ["地下道の風", "番号だけの朝", "pulse が先に歩く", "言葉はまだ曲がっている"],
    close: ["loop city", "pulse が先に歩く", "朝まで言わない"],
    keywordReplies: [
      { test: /駅|電車|地下|夜|道路|街/, lines: ["駅の光がまだ走っている", "地下道の風が beat を運ぶ"] },
      { test: /走|飛|回|loop|hook/i, lines: ["pulse が先に歩く", "two more minutes in the tunnel"] }
    ]
  },
  folk: {
    label: "soil chant",
    suno: "rough folk chant, hand percussion, low group vocal, field-recording texture, simple repeated hook",
    banks: [
      "土の匂いが言葉を遅くする",
      "手のひらの線で朝を測る",
      "古い歌だけがまだ水を知ってる",
      "石の下で拍が眠っている"
    ],
    bridge: ["土に返す名前", "手拍子の影", "水のない川", "小さい火を囲む"],
    close: ["土に返す", "小さい火を囲む", "まだ歌になる"],
    keywordReplies: [
      { test: /土|川|石|火|水|草|緑/, lines: ["土の匂いが言葉を遅くする", "古い歌だけがまだ水を知ってる"] }
    ]
  },
  city: {
    label: "night bus",
    suno: "night bus pop, spoken-sung vocal, soft synth bass, dry snare, city-window melancholy",
    banks: [
      "終電の窓に顔が溶ける",
      "コンビニの光で息を整える",
      "ビルの隙間で朝が待っている",
      "誰もいない交差点が返事をする"
    ],
    bridge: ["終電の窓", "コンビニの光", "交差点の返事", "朝までの短い距離"],
    close: ["窓に残る", "朝までの短い距離", "まだ帰らない"],
    keywordReplies: [
      { test: /夜|窓|街|バス|駅|朝/, lines: ["終電の窓に顔が溶ける", "誰もいない交差点が返事をする"] }
    ]
  },
  noise: {
    label: "noise memo",
    suno: "lo-fi noise rock, clipped spoken vocal, unstable guitar texture, heavy room tone, chant hook",
    banks: [
      "録音の端が少し焼けている",
      "声の外側でノイズが座る",
      "切れたテープがまだ拍を数える",
      "歪みの奥に小さい祈りがある"
    ],
    bridge: ["録音の端", "切れたテープ", "歪みの奥", "声の外側"],
    close: ["録音の端", "声だけ残る", "まだ消さない"],
    keywordReplies: [
      { test: /録音|声|メモ|ノイズ|歪|テープ/, lines: ["録音の端が少し焼けている", "声の外側でノイズが座る"] }
    ]
  }
};

const tasteProfiles = {
  "era-rap": {
    label: "時代感 rap",
    suno: "long-view Japanese spoken rap, hard-earned optimism, documentary city detail, no artist imitation",
    banks: [
      "時代は変わる、でも足跡は消えない",
      "昨日の傷を今日の地図にする",
      "沈黙のあとで言葉が腰を上げる",
      "街の角で未来が小さく咳をする"
    ],
    hook: ["時代は変わる", "変わらない火を持つ", "ここからまた歩く"],
    bridge: ["古い地図の端", "次の朝の重さ", "声を失くした交差点"]
  },
  okinawa: {
    label: "沖縄 roots",
    suno: "Okinawan local roots without beach imagery, humid night streets, low rap vocal, eisa pulse, local venue memory, respectful dialect accents",
    banks: [
      "湿った夜が声をほどく",
      "うちなーの路地に低い太鼓が残る",
      "小箱の外で汗が言葉を冷ます",
      "先祖の影がアスファルトを歩く"
    ],
    hook: ["ニフェーデービル", "島から鳴る", "いちゃりばちょーでー"],
    bridge: ["エイサーの遠い太鼓", "夜の路地", "うちなーの湿度", "小箱の残響"]
  },
  psych: {
    label: "サイケ band",
    suno: "Japanese psychedelic band, loose groove, surreal chorus, dry guitar, hypnotic repetition",
    banks: [
      "部屋が少しだけ回りはじめる",
      "笑っている壁に名前を預ける",
      "昼の夢がアンプの奥で伸びる",
      "まっすぐな道が急に揺れる"
    ],
    hook: ["揺れている", "まだ醒めない", "名前だけが浮く"],
    bridge: ["回る部屋", "昼の夢", "アンプの奥", "揺れる道"]
  },
  grunge: {
    label: "grunge raw",
    suno: "raw alternative rock, cracked melody, loud-soft dynamics, dry room drums, simple wounded hook",
    banks: [
      "錆びた声で朝をこする",
      "破れたシャツに雨が残る",
      "きれいな嘘だけ先に壊れる",
      "小さい怒りが喉で寝ている"
    ],
    hook: ["まだ壊れてない", "汚れたままで光る", "声だけ残る"],
    bridge: ["錆びた声", "破れた朝", "小さい怒り", "乾いた雨"]
  },
  abstract: {
    label: "abstract electronic",
    suno: "abstract electronic pop, fractured rhythm, micro-texture, warm pads, human voice inside machine noise",
    banks: [
      "数字の雨がまぶたに落ちる",
      "壊れた拍が先に眠る",
      "波形の中で名前がほどける",
      "機械の隙間に体温がある"
    ],
    hook: ["壊れた拍", "まだ人間", "波形の中"],
    bridge: ["数字の雨", "ほどける名前", "機械の隙間", "体温のノイズ"]
  },
  dusty: {
    label: "dusty swing",
    suno: "dusty hip-hop swing, warm bass, off-grid drums, smoke-stained soul sample feel, intimate vocal",
    banks: [
      "少し遅れた拍が胸に合う",
      "埃っぽいコードで夜がほどける",
      "低いベースが言葉を丸くする",
      "古いレコードの奥で朝が笑う"
    ],
    hook: ["遅れた拍で", "まだ揺れてる", "夜がほどける"],
    bridge: ["埃っぽいコード", "丸いベース", "古いレコード", "遅れた拍"]
  },
  classic: {
    label: "classic pop",
    suno: "classic melodic pop, clean chord movement, tight chorus, bittersweet harmony, simple memorable refrain",
    banks: [
      "短い言葉で朝が開く",
      "手を振るだけでメロディになる",
      "遠い場所ほど近く歌える",
      "昨日の影に光を置く"
    ],
    hook: ["短い言葉で", "また会える", "光を置く"],
    bridge: ["朝が開く", "手を振る", "遠い場所", "昨日の影"]
  }
};

const dialectLines = {
  light: ["ニフェーデービル", "うちなーの夜", "島ぬ湿度", "いちゃりばちょーでー"],
  deep: ["ニフェーデービル", "うちなーぬ夜", "島ぬ湿度", "いちゃりばちょーでー", "肝どんどん", "路地ぬ影"]
};

const worldviewProfiles = {
  gap: {
    label: "夜の隙間",
    suno: "night-gap philosophy, bar-to-bar walking, loose nocturnal fragments, intoxicated but lucid",
    banks: [
      "夜の隙間だけを歩いていた",
      "看板の明かりが考えを薄くする",
      "飲み歩いた道が地図より正しい",
      "ドープな流れに名前を預ける"
    ],
    hook: ["夜の隙間", "まだ歩ける", "地図より正しい"],
    bridge: ["看板の明かり", "飲み歩いた道", "ドープな流れ", "名前を預ける"]
  },
  "rave-memory": {
    label: "小箱 / rave残り香",
    suno: "small-club techno afterglow, leftover rave culture, close-room bass, sweaty memory, no nostalgia gloss",
    banks: [
      "昔の小箱に低音だけが残る",
      "レイブの残り香が服から抜けない",
      "フロアの端で朝が小さく歪む",
      "テキーラの熱が拍をずらす"
    ],
    hook: ["小箱の残り香", "まだ鳴ってる", "朝までずれる"],
    bridge: ["昔の小箱", "レイブの残り香", "フロアの端", "テキーラの熱"]
  },
  "band-lineage": {
    label: "バンド文化圏",
    suno: "post-punk and hardcore local band lineage, earnest room, clean rock melody under rough guitars",
    banks: [
      "みんな一所懸命に音を鳴らしていた",
      "十八のライブがまだ身体に残る",
      "ポストパンクの影で制服の汗が乾く",
      "きれいなロックが歪みの奥で光る"
    ],
    hook: ["一所懸命", "まだ身体に残る", "歪みの奥で光る"],
    bridge: ["十八のライブ", "ポストパンクの影", "ハードコアの床", "きれいなロック"]
  },
  "return-home": {
    label: "帰郷 / 地元に溶ける",
    suno: "returning-home narrative, Tokyo distance, local re-entry, awkward social rounds, slow belonging",
    banks: [
      "内地の耳だけがまだ尖っていた",
      "地元に溶けるまで時間がかかった",
      "顔を出す場所ごとに言葉が変わる",
      "帰ってきたのに少し遠かった"
    ],
    hook: ["帰ってきた", "まだ遠かった", "溶けていく"],
    bridge: ["内地の耳", "地元の速度", "顔を出す夜", "少し遠い帰り道"]
  },
  "family-climate": {
    label: "家族 / 風土を創る",
    suno: "family-shift worldview, grounded values, nature after nightlife, cultural soil-building, quiet resolve",
    banks: [
      "子どもの寝息で価値観が変わる",
      "自然の細部が急に大きくなる",
      "遊びの後ろに責任が立っている",
      "風土を創る手つきで朝を選ぶ"
    ],
    hook: ["価値観が変わる", "風土を創る", "朝を選ぶ"],
    bridge: ["子どもの寝息", "自然の細部", "責任の影", "朝を選ぶ手"]
  },
  "culture-role": {
    label: "文化を回す立場",
    suno: "cultural stewardship, local organizer perspective, keeping scenes alive, mature but playful",
    banks: [
      "文化を回す側に立ってしまった",
      "遊びを続けるには場所を守る",
      "誰かの夜を次の朝へ渡す",
      "立場だけが先に大人になる"
    ],
    hook: ["文化を回す", "場所を守る", "遊びを続ける"],
    bridge: ["回す側の手", "場所を守る夜", "誰かの朝", "先に大人になる立場"]
  },
  "uchinanchu-now": {
    label: "現代ウチナーンチュ",
    suno: "contemporary Uchinanchu perspective, local daily life, political weight held indirectly, no postcard Okinawa",
    banks: [
      "現代のうちなーんちゅが夜の底で息をする",
      "軽い言葉ほど土地に弾かれる",
      "生活の床で歴史がまだ鳴る",
      "名前にする前の島が胸で重くなる"
    ],
    hook: ["軽く言えない", "生活の床で", "まだ鳴ってる"],
    bridge: ["現代のうちなーんちゅ", "土地に弾かれる言葉", "名前にする前の島", "生活の床"]
  },
  "base-life": {
    label: "基地と生活",
    suno: "base issue from daily-life distance, low anger, documentary fragments, no slogan chant, grounded Okinawan locality",
    banks: [
      "基地の影が生活の横で乾いている",
      "慣れたふりだけが依存を隠す",
      "遠い国の音が窓の外を通る",
      "怒りは声になる前に茶碗を洗う"
    ],
    hook: ["生活の横で", "慣れたふり", "声になる前"],
    bridge: ["基地の影", "依存を隠すふり", "遠い国の音", "茶碗を洗う怒り"]
  },
  "america-distance": {
    label: "アメリカ距離感",
    suno: "ambivalent America distance, hate admiration and absurd reality, dry humor, street-level observation, no easy judgment",
    banks: [
      "憎しみと憧れが同じ看板で光る",
      "近づく気もしないから最近はわからない",
      "アメリカの夢だけが酒で薄まる",
      "現実のアホさに笑って黙る"
    ],
    hook: ["憎しみと憧れ", "最近はわからない", "笑って黙る"],
    bridge: ["同じ看板", "近づかない距離", "薄まる夢", "現実のアホさ"]
  },
  "ancestor-groundwar": {
    label: "先祖 / 地上戦",
    suno: "ancestor respect and ground-war memory, restrained elegy, low collective voice, never exploitative, no spectacle",
    banks: [
      "地上戦の話は声を低くする",
      "先祖の前で冗談だけが姿勢を直す",
      "悲惨という言葉ではまだ足りない",
      "祈りは派手な音を嫌う"
    ],
    hook: ["声を低くする", "まだ足りない", "姿勢を直す"],
    bridge: ["地上戦の話", "先祖の前", "足りない言葉", "派手な音を嫌う祈り"]
  },
  "ryukyu-care": {
    label: "軽々しく言えない琉球",
    suno: "careful Ryukyu identity, sovereignty questions held at a distance, unresolved thought, no easy independence slogan",
    banks: [
      "琉球という言葉を軽く置けない",
      "独立は旗より先に沈黙を連れてくる",
      "言い切れない場所で考え続ける",
      "歴史の名前が喉で止まる"
    ],
    hook: ["軽く置けない", "言い切れない", "考え続ける"],
    bridge: ["琉球という言葉", "旗より先の沈黙", "言い切れない場所", "喉で止まる歴史"]
  },
  "twisted-politics": {
    label: "ねじれた政局",
    suno: "twisted local politics, public-works dependency, cynical but humane, indirect spoken lyric, everyday civic fatigue",
    banks: [
      "ねじれた政局が朝刊の端で乾く",
      "公共事業の椅子に誰も依存と書かない",
      "体制という言葉が生活費の顔をする",
      "怒る前に予定表だけが埋まる"
    ],
    hook: ["ねじれてる", "依存と書かない", "生活費の顔"],
    bridge: ["朝刊の端", "公共事業の椅子", "生活費の顔", "埋まる予定表"]
  }
};

function directionProfile(value) {
  return directionProfiles[value] || directionProfiles.hitotobi;
}

function tasteProfile(value) {
  return tasteProfiles[value] || tasteProfiles["era-rap"];
}

function worldviewProfile(value) {
  return worldviewProfiles[value] || worldviewProfiles.gap;
}

function stripMarkdownLead(line) {
  return String(line || "")
    .replace(/^\s*(#{1,6}\s*|[-*•]\s*|\d+[.)]\s*)/, "")
    .replace(/^["'「『]|["'」』]$/g, "")
    .trim();
}

function cleanDistillContent(value) {
  return stripMarkdownLead(value)
    .replace(/\s+/g, " ")
    .replace(/^(私の)?(思想の核|言ってはいけないこと|歌詞にしていい距離感|使える語彙|避けたい語彙|歌詞プリセットにできる世界観|世界観|禁句|語彙|距離感|核|立場)[：:]\s*/, "")
    .trim();
}

function compactPhrase(value, max = 34) {
  const cleaned = cleanDistillContent(value);
  if (!cleaned) return "";
  if (charLength(cleaned) <= max) return cleaned;
  const fragment = cleaned
    .split(/[。.!?！？；;]/)
    .map((item) => item.trim())
    .find((item) => charLength(item) >= 3 && charLength(item) <= max);
  if (fragment) return fragment;
  return [...cleaned].slice(0, max).join("").trim();
}

function distillModeFor(line, current) {
  const head = line.replace(/[：:].*$/, "");
  if (/禁句|避けたい|避ける|言ってはいけ|言わない|NG|したくない|スローガン|記号|説教|avoid|guardrail|forbidden|risk|do not/i.test(head)) return "avoid";
  if (/使える語彙|語彙|言葉|ワード|vocabulary|terms|words/i.test(head)) return "terms";
  if (/距離感|温度|扱い|スタンス|distance|temperature|stance/i.test(head)) return "distance";
  if (/世界観|プリセット|モード|worldview|preset|mode/i.test(head)) return "presets";
  if (/核|思想|立場|テーマ|core|kernel|position|theme/i.test(head)) return "core";
  return current;
}

function isDistillNoise(line) {
  return !line ||
    /^一問ずつ/.test(line) ||
    /^私に質問/.test(line) ||
    /^扱いたいテーマ/.test(line) ||
    /^ただし/.test(line) ||
    /^に整理/.test(line);
}

function splitDistillChunks(line, mode) {
  const clean = cleanDistillContent(line);
  if (!clean || isDistillNoise(clean)) return [];
  const shouldSplit = mode === "terms" || mode === "avoid" || /[。.!?！？；;、,／/・]/.test(clean);
  const chunks = shouldSplit
    ? clean.split(/[。.!?！？；;、,／/・]/)
    : [clean];
  return chunks
    .map((item) => compactPhrase(item, mode === "avoid" ? 42 : 34))
    .filter((item) => charLength(item) >= 2);
}

function distillSections(text) {
  const sections = {
    core: [],
    distance: [],
    terms: [],
    avoid: [],
    presets: []
  };
  let mode = "core";
  const lines = String(text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .split("\n")
    .map(stripMarkdownLead)
    .filter(Boolean);

  for (const rawLine of lines) {
    const nextMode = distillModeFor(rawLine, mode);
    const hasLabel = nextMode !== mode && /[：:]/.test(rawLine);
    const inlineAvoid = nextMode !== "presets" && /したくない|避け|禁句|言いたくない|軽々しく|スローガン|記号|説教/.test(rawLine);
    mode = nextMode;
    const target = inlineAvoid ? "avoid" : mode;
    const content = hasLabel ? rawLine.replace(/^[^：:]+[：:]\s*/, "") : rawLine;
    for (const chunk of splitDistillChunks(content, target)) sections[target].push(chunk);
  }

  for (const key of Object.keys(sections)) sections[key] = unique(sections[key]);
  return sections;
}

function distillProfile(text) {
  const sections = distillSections(text);
  const avoid = sections.avoid.slice(0, 16);
  const anchors = unique([
    ...sections.core,
    ...sections.distance,
    ...sections.terms,
    ...sections.presets
  ]).filter((item) => !avoid.some((bad) => item.includes(bad) || bad.includes(item))).slice(0, 18);
  const active = Boolean(String(text || "").trim());
  const fallback = anchors.length ? anchors : [];
  const hook = fallback.filter((line) => charLength(line) <= 14).slice(0, 4);
  return {
    active,
    label: active ? "蒸留メモ" : "",
    anchors,
    avoid,
    banks: fallback.slice(0, 8),
    hook: hook.length ? hook : fallback.slice(0, 3),
    bridge: fallback.slice(0, 8),
    suno: active
      ? `distilled personal worldview anchors, indirect political weight, daily-life images, avoid slogans${avoid.length ? `, guardrails: ${avoid.slice(0, 5).join(", ")}` : ""}`
      : "",
    sections
  };
}

function mergeWorldview(base, distill) {
  if (!distill.active) return { ...base, distill };
  return {
    ...base,
    label: `${base.label} + 蒸留`,
    suno: `${base.suno}, ${distill.suno}`,
    banks: unique([...distill.banks, ...base.banks]),
    hook: unique([...distill.hook, ...base.hook]),
    bridge: unique([...distill.bridge, ...base.bridge]),
    distill
  };
}

function worldviewForControls(controls) {
  return mergeWorldview(worldviewProfile(controls.worldview), distillProfile(controls.distill));
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, random) {
  if (!list.length) return "";
  return list[Math.floor(random() * list.length) % list.length];
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function uniqueWithBreaks(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    if (!line) return true;
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitSeed(text) {
  return unique(
    text
      .replace(/\r/g, "")
      .replace(/\\n/g, "\n")
      .split(/\n|\s+\/\s+/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function hasEnglish(line) {
  return /[A-Za-z]{2,}/.test(line);
}

function charLength(line) {
  return [...line.replace(/\s+/g, "")].length;
}

function isMantra(line) {
  return charLength(line) <= 9 ||
    /みざる|いわざる|きかざる|見ざる|言わざる|聞かざる|われら|かんしゃ|ヒトトビ|hook|loop|stupid|genius|mind/i.test(line);
}

function classify(lines) {
  const english = lines.filter(hasEnglish);
  const mantras = lines.filter(isMantra);
  const hooks = lines.filter((line) =>
    /静け|熱|楽し|そこんとこ|われら|かんしゃ|ヒトトビ|回ら|戻ら|終わら|hook|loop/i.test(line)
  );
  const images = lines.filter((line) =>
    /中心|円|雨|川|影|石|虫|緑|窓|植物|夜|時計|草|風|火|耳|目|口|舌|太鼓|鳥|人/.test(line)
  );
  const body = lines.filter((line) => !mantras.includes(line) && !english.includes(line));
  return {
    lines,
    english,
    mantras: unique(mantras),
    hooks: unique(hooks.length ? hooks : mantras),
    images: unique(images),
    body: unique(body.length ? body : lines)
  };
}

function inferTitle(inputTitle, parts) {
  const explicit = inputTitle.trim().split(/\r?\n/)[0].slice(0, 64).trim();
  if (explicit) return explicit;
  const hitotobi = parts.lines.find((line) => /ヒトトビ|ひとつ飛び|ひととび/.test(line));
  if (hitotobi) return "ヒトトビ";
  const short = parts.mantras.find((line) => !hasEnglish(line) && charLength(line) >= 3);
  if (short) return short.replace(/[、。,.]/g, "");
  return "Untitled";
}

function replyFor(line, random, weird, profile = directionProfiles.hitotobi, taste = tasteProfiles["era-rap"], worldview = worldviewProfiles.gap) {
  const directionMatches = (profile.keywordReplies || []).filter((item) => item.test.test(line));
  if (directionMatches.length) return pick(pick(directionMatches, random).lines, random);
  const matches = keywordReplies.filter((item) => item.test.test(line));
  if (matches.length) return pick(pick(matches, random).lines, random);
  const bankNames = Object.keys(imageBanks);
  const fallbackBank = imageBanks[pick(bankNames, random)] || imageBanks.odd;
  const bank = random() > 0.62 && worldview.banks?.length
    ? worldview.banks
    : random() > 0.45 && taste.banks?.length
    ? taste.banks
    : profile.banks?.length && random() > 0.28
      ? profile.banks
      : fallbackBank;
  if (weird > 70 && random() > 0.55) return pick(imageBanks.odd, random);
  return pick(bank, random);
}

function buildPairLines(sourceLines, count, random, weird, profile, taste, worldview) {
  const seeds = sourceLines.length ? sourceLines : ["まだ歌になる前の断片"];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const seed = seeds[i % seeds.length];
    let response = replyFor(seed, random, weird, profile, taste, worldview);
    const seedLower = seed.toLowerCase();
    const responseLower = response.toLowerCase();
    if (responseLower === seedLower || seedLower.includes(responseLower) || responseLower.includes(seedLower)) {
      response = pick(worldview.banks?.length ? worldview.banks : taste.banks?.length ? taste.banks : profile.banks?.length ? profile.banks : imageBanks.odd, random);
    }
    out.push(seed);
    out.push(response);
  }
  return out;
}

function cleanCollective(lines, voice) {
  if (voice === "personal") return lines;
  return lines.map((line) =>
    line
      .replace(/\bI am\b/gi, "we are")
      .replace(/\bI'm\b/gi, "we're")
      .replace(/\bmy\b/gi, "our")
      .replace(/俺[はの]?/g, "")
      .replace(/僕[はの]?/g, "")
      .replace(/私[はの]?/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  ).filter(Boolean);
}

function dialectStack(mode) {
  return dialectLines[mode] || [];
}

function buildHook(parts, title, random, taste, dialect, worldview, profile = directionProfiles.hitotobi) {
  const source = parts.hooks.length ? parts.hooks : parts.mantras;
  const hasCollective = parts.lines.some((line) => /われら/.test(line));
  const hasGreen = parts.lines.some((line) => /緑|みどり|代弁者/.test(line));
  const isHitotobi = profile === directionProfiles.hitotobi;
  const hook = [];
  const localLines = [
    ...taste.hook,
    ...worldview.hook,
    ...dialectStack(dialect)
  ];
  const quiet = source.find((line) => /静け/.test(line)) || "静けさのなかで";
  const heat = source.find((line) => /熱|覚ま/.test(line)) || "熱を覚まして";
  hook.push(quiet);
  hook.push(heat);
  hook.push(source.find((line) => /楽し/.test(line)) || pick(localLines, random) || "楽しめる");
  hook.push(source.find((line) => /そこんとこ/.test(line)) || "そこんとこ");
  hook.push("");
  const gratitude = source.find((line) => /かんしゃ|感謝/.test(line));
  if (gratitude && /(われら|みどり|緑|代弁者)/.test(gratitude)) {
    hook.push(gratitude);
  } else {
    hook.push(gratitude || (dialect !== "none" ? "ニフェーデービル" : hasCollective ? "かんしゃ" : "thank you"));
    hook.push(hasCollective ? "われら" : "nameless chorus");
    hook.push(hasGreen ? "みどりの代弁者" : pick(imageBanks.green, random));
  }
  hook.push("");
  const closeLines = isHitotobi
    ? [
        source.find((line) => /回ら/.test(line)) || "回らない",
        "ヒトトビ",
        "",
        source.find((line) => /戻ら|終わら/.test(line)) || "戻らない",
        "ヒトトビ"
      ]
    : [
        ...(profile.close || []).slice(0, 3),
        pick(localLines, random) || title
      ];
  hook.push("");
  hook.push(...closeLines);
  return uniqueWithBreaks(hook);
}

function section(title, lines) {
  return [`## ${title}`, "", ...lines, ""].join("\n");
}

function buildDraft(parts, controls) {
  const profile = directionProfile(controls.direction);
  const taste = tasteProfile(controls.taste);
  const worldview = worldviewForControls(controls);
  const dialect = controls.dialect || "none";
  const seed = `${parts.lines.join("|")}|${controls.title}|${controls.direction}|${controls.taste}|${controls.dialect}|${controls.worldview}|${controls.distill}|${state.reroll}|${controls.heat}|${controls.weird}`;
  const random = mulberry32(hashString(seed));
  const title = inferTitle(controls.title, parts);
  const density = controls.form === "compact" ? 2 : controls.form === "chant" ? 3 : 4;
  const weird = Number(controls.weird);
  const bodyA = buildPairLines(parts.body, density, random, weird, profile, taste, worldview);
  const bodyA2 = buildPairLines(parts.body.slice(density), density, random, weird, profile, taste, worldview);
  const mantraStack = parts.mantras.length ? parts.mantras : parts.hooks;
  const englishStack = parts.english.length ? parts.english : ["Live like stupid", "genius free", "mindblowing"];
  const localStack = dialectStack(dialect);
  const hook = buildHook(parts, title, random, taste, dialect, worldview, profile);
  const bLines = uniqueWithBreaks([
    ...mantraStack.slice(0, controls.form === "chant" ? 6 : 3),
    "",
    ...worldview.banks.slice(0, 3),
    "",
    ...taste.banks.slice(0, 2),
    ...(localStack.length ? ["", ...localStack.slice(0, dialect === "deep" ? 3 : 1)] : []),
    "",
    ...profile.banks.slice(0, 2),
    "",
    "便利な耳をしまう",
    "便利な目を閉じる",
    "便利な口の中で",
    replyFor("便利", random, weird, profile, taste, worldview),
    "",
    ...englishStack.slice(0, 4),
    "",
    replyFor("わかる前", random, weird, profile, taste, worldview),
    replyFor("笑われる", random, weird, profile, taste, worldview)
  ]);
  const b2Lines = uniqueWithBreaks([
    ...mantraStack.slice(0, 3),
    "",
    "見ないふりの奥で",
    replyFor("みざる", random, weird, profile, taste, worldview),
    "言わない舌の上で",
    replyFor("いわざる", random, weird, profile, taste, worldview),
    "きかない耳の底で",
    replyFor("きかざる", random, weird, profile, taste, worldview),
    "",
    parts.lines.find((line) => /hook/i.test(line)) || "便利なネタを hook",
    "不便なままで loop",
    "",
    ...englishStack.slice(0, 3)
  ]);
  const bridgeLines = uniqueWithBreaks([
    ...profile.bridge,
    ...taste.bridge,
    ...worldview.bridge,
    ...localStack.slice(0, dialect === "deep" ? 4 : 2),
    "",
    replyFor("中心", random, weird, profile, taste, worldview),
    replyFor("ありうる", random, weird, profile, taste, worldview),
    "",
    replyFor("半ば", random, weird, profile, taste, worldview),
    "はじまりが開く",
    replyFor("緑", random, weird, profile, taste, worldview),
    "",
    "見ざる目で見る",
    "言わざる口で歌う",
    "聞かざる耳の中",
    replyFor("熱", random, weird, profile, taste, worldview)
  ]);
  const outro = uniqueWithBreaks([
    ...hook,
    "",
    ...mantraStack.slice(0, 3),
    "",
    ...englishStack.slice(0, 3),
    "",
    ...(profile.close || [title]).slice(0, controls.direction === "hitotobi" ? 3 : 2),
    controls.direction === "hitotobi" ? "ヒトトビ" : ""
  ]);
  const sections = controls.form === "compact"
    ? [
        section("A", cleanCollective(bodyA, controls.voice)),
        section("Hook", cleanCollective(hook, controls.voice)),
        section("Bridge", cleanCollective(bridgeLines, controls.voice)),
        section("Last Hook", cleanCollective(outro, controls.voice))
      ]
    : [
        section("A", cleanCollective(bodyA, controls.voice)),
        section("B", cleanCollective(bLines, controls.voice)),
        section("Hook", cleanCollective(hook, controls.voice)),
        section("A2", cleanCollective(bodyA2.length ? bodyA2 : bodyA, controls.voice)),
        section("B2", cleanCollective(b2Lines, controls.voice)),
        section("Bridge", cleanCollective(bridgeLines, controls.voice)),
        section("Last Hook / Outro", cleanCollective(outro, controls.voice))
      ];
  const draft = [`# ${title}`, "", ...sections].join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
  return { title, draft, hook: cleanCollective(hook, controls.voice).join("\n") };
}

function productionSourceProfile(value) {
  return PRODUCTION_SOURCES[value] || PRODUCTION_SOURCES.notes;
}

function productionTargetLabel(value) {
  return PRODUCTION_TARGETS[value] || PRODUCTION_TARGETS["ace-step"];
}

function productionRouteLabel(controls) {
  return `${productionSourceProfile(controls.productionSource).label} → ${productionTargetLabel(controls.productionTarget)}`;
}

function normalizedSession(controls) {
  const bpm = Number(controls.bpm);
  const duration = Number(controls.duration);
  return {
    bpm: Number.isFinite(bpm) && bpm >= 30 && bpm <= 300 ? Math.round(bpm) : "auto",
    key: String(controls.key || "").trim() || "auto",
    duration: Number.isFinite(duration) && duration >= 15 && duration <= 600 ? Math.round(duration) : "auto",
    meter: String(controls.meter || "4/4")
  };
}

function buildProductionStyle(controls) {
  const profile = directionProfile(controls.direction);
  const taste = tasteProfile(controls.taste);
  const worldview = worldviewForControls(controls);
  const heat = Number(controls.heat);
  const weird = Number(controls.weird);
  const energy = heat > 72 ? "hot chorus, shouted group response" : heat < 35 ? "low heat, half-spoken close vocal" : "controlled heat, chant-like hook";
  const odd = weird > 65 ? "surreal but singable images, no explanation" : "plain words with strange edges";
  const dialect = controls.dialect === "deep"
    ? "with stronger Okinawan phrase accents, respectful and sparse"
    : controls.dialect === "light"
      ? "with light Okinawan phrase accents"
      : "standard Japanese lyrics";
  return `${profile.suno}, ${taste.suno}, ${worldview.suno}, ${energy}, ${odd}, ${dialect}`;
}

function productionMetadataLines(controls) {
  const session = normalizedSession(controls);
  const sourceUrl = normalizedSourceUrl(controls.sourceUrl);
  return [
    `route: ${productionRouteLabel(controls)}`,
    `source_type: ${controls.productionSource || "notes"}`,
    sourceUrl ? `source_url: ${sourceUrl}` : "source_url: none",
    `bpm: ${session.bpm}`,
    `key: ${session.key}`,
    `duration_seconds: ${session.duration}`,
    `time_signature: ${session.meter}`
  ];
}

function buildSuno(title, draft, controls) {
  const session = normalizedSession(controls);
  const timing = [
    session.bpm !== "auto" ? `${session.bpm} BPM` : "",
    session.key !== "auto" ? `key ${session.key}` : "",
    session.meter
  ].filter(Boolean).join(", ");
  return [
    "[Title]",
    title,
    "",
    "[Style of Music]",
    `${buildProductionStyle(controls)}, ${timing}`,
    "",
    "[Lyrics]",
    draft
  ].join("\n");
}

function aceStepMode(controls) {
  if (!normalizedSourceUrl(controls.sourceUrl)) return "Custom";
  if (controls.productionSource === "ace-step") return "Repaint or Remix";
  if (["bandlab", "band-room"].includes(controls.productionSource)) return "Remix";
  return "Custom with reference audio";
}

function buildAceStepPacket(title, draft, controls) {
  return [
    "[ACE-Step handoff]",
    `title: ${title}`,
    `mode: ${aceStepMode(controls)}`,
    `caption: ${buildProductionStyle(controls)}`,
    ...productionMetadataLines(controls),
    "audio_note: open or download the linked source manually; Lyric Lab does not upload audio",
    "",
    "[Lyrics]",
    draft,
    "",
    "[Review boundary]",
    "Use this as a vocal and arrangement demo. Keep only phrasing, melody, and structure that survive human review.",
    "Keep generated audio and lyric files outside the Music repository."
  ].join("\n");
}

function buildBandLabPacket(title, draft, controls, scene = null) {
  const sonicNotes = scene?.arrangement_notes?.sonic_notes || [];
  return [
    "[BandLab handoff]",
    `title: ${title}`,
    ...productionMetadataLines(controls),
    "",
    "[Arrangement intent]",
    `scene: ${scene?.scene_id || "not mapped"}`,
    `pressure: ${scene?.pressure || "not mapped"}`,
    ...prefixList(sonicNotes),
    "",
    "[Current lyric]",
    draft,
    "",
    "[Next pass]",
    "Import the selected demo or vocal take, align it to the session BPM, and revise the arrangement around the lyric sections.",
    "Export mixdowns or stems outside the repository, then return only reviewed metadata to Music Stack."
  ].join("\n");
}

function buildBandRoomPacket(title, controls, scene = null) {
  return [
    "[Band Room handoff / metadata only]",
    `title: ${title}`,
    ...productionMetadataLines(controls),
    `scene_id: ${scene?.scene_id || "not mapped"}`,
    `direction: ${directionProfile(controls.direction).label}`,
    `taste: ${tasteProfile(controls.taste).label}`,
    `worldview: ${worldviewForControls(controls).label}`,
    "lyric_reference: keep the lyric body in Lyric Lab",
    "audio_boundary: use a local or hosted render in an external stem slot; do not commit it to Music",
    "",
    "[Scene metadata]",
    scene ? JSON.stringify(scene, null, 2) : "none"
  ].join("\n");
}

function buildProductionPacket(title, draft, controls, scene = null) {
  if (controls.productionTarget === "bandlab") return buildBandLabPacket(title, draft, controls, scene);
  if (controls.productionTarget === "suno") return buildSuno(title, draft, controls);
  if (controls.productionTarget === "band-room") return buildBandRoomPacket(title, controls, scene);
  return buildAceStepPacket(title, draft, controls);
}

function prefixList(list) {
  return (list.length ? list : ["(none)"]).map((item) => `- ${item}`);
}

function sceneId(title, worldviewValue) {
  const prefix = String(worldviewValue || "scene")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scene";
  const titleHash = hashString(title || "untitled").toString(36).slice(0, 6);
  return `${prefix}-${titleHash}`;
}

function sceneItems(list, max = 8) {
  return unique(list.map((item) => compactPhrase(item, 32)).filter(Boolean)).slice(0, max);
}

function defaultSceneRisks(controls) {
  const worldviewRisks = {
    "ancestor-groundwar": ["tragedy consumption", "ancestor as prop", "political slogan"],
    "base-life": ["dehumanized enemy", "clean anti-American slogan", "easy reconciliation"],
    "america-distance": ["clean judgment", "cartoon America", "faceless structure"],
    "ryukyu-care": ["light independence talk", "identity costume", "representative voice"],
    "twisted-politics": ["party-political sermon", "public-works caricature", "cynicism as pose"]
  };
  return sceneItems([
    "slogan",
    "tourism",
    "self-heroic explanation",
    controls.taste === "okinawa" ? "representative Okinawa voice" : "",
    controls.taste === "okinawa" ? "easy dialect decoration" : "",
    ...(worldviewRisks[controls.worldview] || [])
  ], 10);
}

function buildSceneMetadata(parts, title, controls) {
  const distill = distillProfile(controls.distill);
  const worldview = worldviewProfile(controls.worldview);
  const pressure = distill.sections.core[0] ||
    distill.sections.distance[0] ||
    worldview.hook[0] ||
    title;
  const imageCarriers = sceneItems([
    ...distill.sections.terms,
    ...parts.images,
    ...worldview.bridge
  ]);
  const riskFlags = sceneItems([
    ...distill.avoid,
    ...(distill.avoid.length ? [] : defaultSceneRisks(controls))
  ], 10);
  const titleSeeds = sceneItems([
    ...distill.sections.presets,
    ...parts.hooks,
    ...worldview.hook,
    title
  ], 8);
  const motifLabels = sceneItems([
    ...distill.anchors,
    ...parts.mantras,
    ...worldview.bridge
  ], 10);
  const mouthfeelNotes = sceneItems([
    ...parts.mantras,
    ...parts.english,
    ...distill.sections.terms
  ], 8);
  return {
    scene_id: sceneId(title, controls.worldview),
    status: "draft",
    source: "lyric-lab",
    no_lyrics: true,
    pressure,
    image_carriers: imageCarriers,
    distance: {
      speaker_position: distill.sections.distance[0] || "indirect witness, local but not representative",
      audience_filter: controls.taste === "okinawa" ? "okinawa-local / outside listener without tourist packaging" : "music-stack listener"
    },
    risk_flags: riskFlags,
    allowed_moves: sceneItems([
      "metadata-only",
      "daily-life image",
      "scene pressure",
      "guardrail-first prompt"
    ]),
    avoid_moves: riskFlags,
    usable_form: sceneItems([
      "scene_metadata",
      parts.hooks.length ? "hook_concept" : "",
      parts.mantras.length ? "spoken_sample_seed" : "",
      "production_handoff",
      "ep133_scene_logic"
    ]),
    phrase_seeds_as_metadata: {
      title_seeds: titleSeeds,
      motif_labels: motifLabels,
      mouthfeel_notes: mouthfeelNotes
    },
    arrangement_notes: {
      ep133_scene_logic: "commit this pressure field as a scene before mutating it",
      production_route: productionRouteLabel(controls),
      session: normalizedSession(controls),
      sonic_notes: sceneItems([
        directionProfile(controls.direction).label,
        tasteProfile(controls.taste).label,
        worldview.label
      ], 6)
    }
  };
}

function buildMap(parts, title, sourceUrl = "", direction = "hitotobi", tasteValue = "era-rap", dialect = "none", worldviewValue = "gap", distillText = "", scene = null) {
  const profile = directionProfile(direction);
  const taste = tasteProfile(tasteValue);
  const distill = distillProfile(distillText);
  const worldview = mergeWorldview(worldviewProfile(worldviewValue), distill);
  const sceneData = scene || buildSceneMetadata(parts, title, {
    title,
    sourceUrl,
    direction,
    taste: tasteValue,
    dialect,
    worldview: worldviewValue,
    distill: distillText
  });
  const productionSession = sceneData.arrangement_notes?.session || normalizedSession({});
  const lines = [
    `title: ${title}`,
    `direction: ${profile.label}`,
    `taste: ${taste.label}`,
    `dialect: ${dialect}`,
    `worldview: ${worldview.label}`,
    `scene_id: ${sceneData.scene_id}`,
    `no_lyrics: ${sceneData.no_lyrics}`,
    sourceUrl ? `source: ${sourceUrl}` : "source: (none)",
    `production_route: ${sceneData.arrangement_notes?.production_route || "ネタ断片 → ACE-Step"}`,
    `session: ${productionSession.bpm} BPM / ${productionSession.key} / ${productionSession.meter} / ${productionSession.duration}s`,
    "",
    "scene pressure:",
    `- ${sceneData.pressure || "(none)"}`,
    "",
    "image carriers:",
    ...prefixList(sceneData.image_carriers || []),
    "",
    "distance:",
    `- speaker_position: ${sceneData.distance?.speaker_position || "(none)"}`,
    `- audience_filter: ${sceneData.distance?.audience_filter || "(none)"}`,
    "",
    "risk flags:",
    ...prefixList(sceneData.risk_flags || []),
    "",
    "usable form:",
    ...prefixList(sceneData.usable_form || []),
    "",
    "hook candidates:",
    ...prefixList(parts.hooks),
    "",
    "mantra:",
    ...prefixList(parts.mantras),
    "",
    "english / voice bits:",
    ...prefixList(parts.english),
    "",
    "image anchors:",
    ...prefixList(parts.images),
    "",
    "distill anchors:",
    ...prefixList(distill.anchors),
    "",
    "guardrails:",
    ...prefixList(distill.avoid)
  ];
  return lines.join("\n");
}

function controls() {
  return {
    title: $("ll-title").value,
    sourceUrl: $("ll-source-url").value,
    productionSource: $("ll-production-source").value,
    productionTarget: $("ll-production-target").value,
    bpm: $("ll-bpm").value,
    key: $("ll-key").value,
    duration: $("ll-duration").value,
    meter: $("ll-meter").value,
    direction: $("ll-direction").value,
    taste: $("ll-taste").value,
    dialect: $("ll-dialect").value,
    worldview: $("ll-worldview").value,
    distill: $("ll-distill").value,
    form: $("ll-form").value,
    voice: $("ll-voice").value,
    heat: $("ll-heat").value,
    weird: $("ll-weird").value
  };
}

function normalizedSourceUrl(value = $("ll-source-url").value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function renderSourceLink() {
  const link = $("ll-source-link");
  if (!link) return;
  const url = normalizedSourceUrl();
  const source = productionSourceProfile($("ll-production-source").value);
  link.hidden = !url;
  link.textContent = source.linkLabel;
  if (url) link.href = url;
  else link.removeAttribute("href");
}

function renderProductionContext() {
  const currentControls = controls();
  const source = productionSourceProfile(currentControls.productionSource);
  $("ll-production-route-label").textContent = productionRouteLabel(currentControls);
  $("ll-source-url-label").textContent = source.urlLabel;
  $("ll-source-url").placeholder = currentControls.productionSource === "bandlab"
    ? "https://www.bandlab.com/..."
    : "Dropbox / Drive / 制作元URL";
  renderSourceLink();
  if (state.activeView === "suno") {
    $("ll-output-label").textContent = `制作 / ${productionTargetLabel(currentControls.productionTarget)}`;
  }
}

function buildAiHandoffPacket() {
  const currentControls = controls();
  const currentLyric = state.activeView === "final"
    ? $("ll-view-final").value.trim()
    : (state.result?.final || state.result?.draft || "").trim();
  const scene = state.result?.scene || null;
  const direction = directionProfile(currentControls.direction).label;
  const taste = tasteProfile(currentControls.taste).label;
  const worldview = worldviewProfile(currentControls.worldview).label;
  const hitotobiRule = currentControls.direction === "hitotobi"
    ? "ヒトトビは必要な場合だけ残してよい。"
    : "ヒトトビを末尾や共通句として足さない。";

  return [
    "Lyric Labから、1曲だけを磨きます。",
    "ゼロから別作品にせず、現在の核と強い行を残して編集してください。",
    "特定の既存アーティストの歌詞や言い回しは模倣しないでください。",
    "沖縄を観光記号や政治スローガンにせず、生活者の距離から扱ってください。",
    hitotobiRule,
    "",
    "返答:",
    "1. 残す行 / 弱い行",
    "2. Hook別案を3つ",
    "3. 説明を減らした磨き案の全文",
    "4. 次に本人へ聞く質問を1つ",
    "",
    "project:",
    `title: ${$("ll-title").value.trim() || state.result?.title || "Untitled"}`,
    `direction: ${direction}`,
    `taste_axis: ${taste}`,
    `worldview: ${worldview}`,
    `dialect: ${currentControls.dialect}`,
    `voice: ${currentControls.voice}`,
    `heat: ${currentControls.heat}`,
    `weird: ${currentControls.weird}`,
    ...productionMetadataLines(currentControls),
    "",
    "seed_notes:",
    $("ll-seed").value.trim() || "none",
    "",
    "distilled_worldview:",
    currentControls.distill.trim() || "none",
    "",
    "scene_metadata:",
    scene ? JSON.stringify(scene, null, 2) : "none",
    "",
    "current_lyric:",
    currentLyric || "none",
    "",
    "本人の追記（結論にまとめず、引っかかりや余白も残す）:",
    ...(state.result?.notes || []).map(note => note.text),
    "",
    "声と音のメモ:",
    state.result?.soundNote || "未定"
  ].join("\n");
}

const NOTEBOOK_KEY = "music-stack.lyric-lab.notebook.v2";
const NB = LyricNotebook;
Object.assign(state, { pending: {}, bases: {}, conflicts: {}, working: null, dirty: false, editing: false, busy: false, storageFailed: false });
const fieldNames = { productionSource: "production-source", productionTarget: "production-target" };
const defaults = { productionSource: "notes", productionTarget: "ace-step", meter: "4/4", direction: "hitotobi", taste: "era-rap", dialect: "none", worldview: "gap", form: "full", voice: "collective", heat: "58", weird: "64" };
const uid = () => `draft-${crypto.randomUUID()}`;
function nowFor(item) {
  return new Date(Math.max(Date.now(), (Date.parse(item?.updatedAt) || 0) + 1)).toISOString();
}
function status(message) { $("ll-status").textContent = message; }
function syncTokenValue() { return $("ll-sync-token-main").value.trim(); }
function syncHeaders() { return { "Content-Type": "application/json", "X-Lyric-Lab-Token": syncTokenValue() }; }
function workspace() {
  if (!state.working) return state.resume || null;
  return { item: state.working, editing: state.editing, dirty: state.dirty, title: $("ll-title").value,
    text: $("ll-view-final").value, note: $("ll-note").value, sound: $("ll-sound-note").value,
    audio: $("ll-audio-url").value, seed: $("ll-seed").value, settings: controls() };
}
function persist() {
  try {
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify({ library: state.library, pending: state.pending, bases: state.bases, conflicts: state.conflicts, workspace: workspace() }));
    state.storageFailed = false;
    return true;
  } catch (error) {
    state.storageFailed = true;
    status("この端末に保存できませんでした。画面を閉じず、バックアップを取ってください。");
    renderSaved();
    return false;
  }
}
function restoreNotebook() {
  try {
    $("ll-sync-token-main").value = localStorage.getItem(SYNC_TOKEN_KEY) || "";
    const saved = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) || "null");
    if (saved) {
      state.library = Array.isArray(saved.library) ? saved.library : [];
      state.pending = saved.pending || {};
      state.bases = saved.bases || {};
      state.conflicts = saved.conflicts || {};
      state.resume = saved.workspace?.dirty ? saved.workspace : null;
    } else {
      state.library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
      // A legacy library is an unverified local copy, never a bulk upload queue.
      for (const item of state.library) state.bases[item.id] = item.updatedAt;
      const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (old && (old.seed || old.result) && !old.currentId) {
        const item = { id: uid(), title: old.title || "無題", seed: old.seed || "", settings: old, result: old.result || { final: old.seed || "" } };
        state.resume = { item, editing: true, dirty: true, title: item.title, text: NB.body(item), seed: item.seed, settings: old };
      }
    }
  } catch (error) { status("端末の保存データを読み込めません。バックアップからの読み込みを確認してください。"); }
}
function renderSaved() {
  let label = "";
  if (state.storageFailed) label = "端末保存に失敗・画面を閉じないでください";
  else if (state.dirty) label = "書きかけを端末に保持・保存はまだです";
  else if (state.working) label = !state.library.some(i => i.id === state.working.id) ? "まだ保存していません" : state.pending[state.working.id] ? "この端末に保存済み・クラウド未同期" : state.bases[state.working.id] ? "保存済み" : "この端末に保存済み";
  $("ll-saved-state").textContent = label;
  $("ll-conflict").hidden = !state.conflicts[state.working?.id];
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(+date) ? "" : new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function renderLibrary() {
  const root = $("ll-library-main"); root.replaceChildren();
  if (state.resume) {
    const resume = node("button", "書きかけを続ける", "ll-resume");
    resume.type = "button"; resume.onclick = resumeWorkspace; root.append(resume);
  }
  const q = state.librarySearch.toLowerCase();
  const items = state.library.filter(item => [item.title, NB.body(item), item.seed, ...(item.result?.notes || []).map(n => n.text)].join("\n").toLowerCase().includes(q));
  $("ll-library-main-count").textContent = state.library.length ? `${items.length}篇` : state.cloudLoaded ? "0篇" : "";
  if (!items.length) root.append(node("p", q ? "その言葉はまだ見つかりません。" : state.cloudLoaded ? "一行から、置いていけます。" : "この端末では、まだ詩を読み込んでいません。以前の詩は「端末をつなぐ」から。新しく書くなら「＋ 言葉を置く」。", "ll-empty"));
  for (const item of items) {
    const card = node("button", null, "ll-card"); card.type = "button";
    card.append(node("span", item.title || "無題", "ll-card-title"));
    card.append(node("span", NB.body(item).slice(0, 160) || "本文のないメモ", "ll-card-preview"));
    const notes = item.result?.notes?.length || 0;
    card.append(node("span", `${dateLabel(item.updatedAt)}${notes ? ` · 追記 ${notes}` : ""}${state.pending[item.id] ? " · 未同期" : ""}`, "ll-card-date"));
    card.onclick = () => loadDraftFromLibrary(item.id); root.append(card);
  }
  renderCloudState();
}
function renderCloudState() {
  const pendingCount = Object.keys(state.pending).length;
  $("ll-cloud-state-main").textContent = state.busy ? "クラウドと同期中…" : state.cloudStatus === "error" ? "接続を確認してください・端末の詩は読めます" : state.cloudLoaded ? `接続済み${pendingCount ? ` · 未同期 ${pendingCount}篇` : " · 非公開のクラウドと同期"}` : syncTokenValue() ? "同期キーあり・まだ読み込んでいません" : "この端末だけで利用中";
  $("ll-cloud-pull-main").disabled = state.busy || !syncTokenValue();
  $("ll-cloud-push-main").hidden = !pendingCount;
  $("ll-cloud-push-main").disabled = state.busy || !syncTokenValue();
  $("ll-connect").disabled = state.busy;
  $("ll-copy-token").hidden = !syncTokenValue();
}
function setFields(item) {
  if (state.generatedForId !== item.id) {
    state.generated = null;
    $("ll-view-draft").textContent = "";
  }
  $("ll-title").value = item.title === "無題" ? "" : item.title || "";
  $("ll-view-final").value = NB.body(item);
  $("ll-source-url").value = item.sourceUrl || "";
  $("ll-seed").value = item.seed || "";
  for (const key of Object.keys(controls())) {
    if (["title", "sourceUrl"].includes(key)) continue;
    $("ll-" + (fieldNames[key] || key)).value = item.settings?.[key] ?? defaults[key] ?? "";
  }
  $("ll-note").value = "";
  $("ll-sound-note").value = item.result?.soundNote || "";
  $("ll-audio-url").value = item.result?.audioUrl || "";
}
function renderWork() {
  const item = state.working; if (!item) return;
  state.currentId = item.id; state.result = item.result;
  state.reroll = Number(item.reroll || 0);
  $("ll-work-title").textContent = item.title || "無題";
  $("ll-poem").textContent = NB.body(item) || "（本文はまだありません）";
  $("ll-editor").hidden = !state.editing;
  $("ll-reading").hidden = state.editing;
  $("ll-sound").hidden = state.editing;
  $("ll-advanced").hidden = state.editing;
  $("ll-edit-heading").textContent = state.library.some(i => i.id === item.id) ? "本文を磨く" : "言葉を置く";
  const notes = $("ll-notes-list"); notes.replaceChildren();
  for (const note of item.result?.notes || []) {
    const el = node("article", null, "ll-note-entry");
    el.append(node("p", note.text), node("time", dateLabel(note.createdAt))); notes.append(el);
  }
  const historyList = $("ll-history-list"); historyList.replaceChildren();
  const versions = [...(item.result?.revisions || [])].reverse();
  $("ll-history-label").textContent = `原文・これまでの版${versions.length ? `（${versions.length}）` : ""}`;
  const original = item.result?.original || { text: item.result?.draft || NB.body(item), createdAt: item.createdAt };
  for (const [label, version] of [["原文", original], ...versions.map(v => [dateLabel(v.createdAt), v])]) {
    const detail = node("details"); detail.append(node("summary", label), node("pre", version.text)); historyList.append(detail);
  }
  const audioUrl = normalizedSourceUrl(item.result?.audioUrl);
  $("ll-audio-link").hidden = !audioUrl; $("ll-audio-link").href = audioUrl || "#";
  renderProductionContext(); renderProductionPreview(); renderSaved();
}
function showWork({ scroll = true } = {}) {
  $("ll-shelf").hidden = true; $("ll-work").hidden = false;
  state.activeView = state.editing ? "final" : "read";
  history.replaceState(null, "", `#work=${encodeURIComponent(state.working.id)}`);
  if (scroll) window.scrollTo({ top: 0 });
}
function canLeave() {
  return !(state.dirty || state.resume) || window.confirm("書きかけの変更があります。変更を取り消して移動しますか？ 保存済みの本文・追記は残ります。");
}
function openShelf() {
  if (!canLeave()) return;
  state.working = null; state.dirty = false; state.editing = false; state.resume = null;
  $("ll-shelf").hidden = false; $("ll-work").hidden = true;
  history.replaceState(null, "", "#shelf"); persist(); renderLibrary(); window.scrollTo({ top: 0 });
}
function loadDraftFromLibrary(id) {
  if (!canLeave()) return;
  const item = state.library.find(i => i.id === id); if (!item) return;
  state.working = NB.clone(item); state.dirty = false; state.editing = false; state.resume = null;
  setFields(state.working); renderWork(); showWork(); persist(); $("ll-work-title").focus({ preventScroll: true });
}
function startNewDraft() {
  if (!canLeave()) return;
  state.working = { id: uid(), title: "無題", seed: "", sourceUrl: "", settings: {}, result: { final: "", draft: "", status: "working" } };
  state.editing = true; state.dirty = false; state.resume = null;
  setFields(state.working); renderWork(); showWork(); persist(); $("ll-view-final").focus();
}
function resumeWorkspace() {
  const saved = state.resume; if (!saved) return;
  state.working = NB.clone(saved.item); state.editing = saved.editing; state.dirty = true;
  setFields({ ...saved.item, settings: saved.settings || saved.item.settings });
  for (const [id, val] of Object.entries({ "ll-title": saved.title, "ll-view-final": saved.text, "ll-note": saved.note, "ll-sound-note": saved.sound, "ll-audio-url": saved.audio, "ll-seed": saved.seed })) $(id).value = val || "";
  renderWork(); showWork(); persist();
}
function markDirty() { state.dirty = true; persist(); renderSaved(); }
async function commitItem(edited, message, { clearNote = false } = {}) {
  const scroll = state.editing || edited.id !== state.working?.id;
  const previous = state.working?.id === edited.id && state.library.some(i => i.id === edited.id) ? state.working : state.library.find(i => i.id === edited.id);
  const remainingNote = clearNote ? "" : $("ll-note").value;
  // Save other visible notebook fields too; saving a note must never erase an
  // unfinished sound annotation or source setting elsewhere on the same page.
  if (state.working?.id === edited.id) {
    edited.result ||= {};
    edited.result.soundNote = $("ll-sound-note").value;
    edited.result.audioUrl = $("ll-audio-url").value;
    edited.seed = $("ll-seed").value;
    edited.sourceUrl = $("ll-source-url").value;
    edited.settings = { ...edited.settings, ...controls() };
  }
  const next = NB.checkpoint(previous, edited, nowFor(previous));
  state.library = [next, ...state.library.filter(i => i.id !== next.id)];
  state.pending[next.id] = true;
  state.working = NB.clone(next); state.result = state.working.result;
  state.dirty = false; state.editing = false; state.resume = null;
  setFields(state.working);
  $("ll-note").value = remainingNote;
  state.dirty = Boolean(remainingNote);
  if (!persist()) { renderWork(); return false; }
  renderWork(); renderLibrary(); showWork({ scroll });
  status(`${message} · この端末に保存済み`);
  if (syncTokenValue()) await cloudPush();
  return true;
}
async function saveFinal() {
  if (!$("ll-view-final").value.trim()) { status("本文を一行から置いてください。"); return; }
  const item = NB.clone(state.working);
  item.title = $("ll-title").value.trim() || "無題";
  item.result ||= {}; item.result.final = $("ll-view-final").value; item.result.title = item.title;
  item.result.draft ??= item.result.final;
  await commitItem(item, "この版を残しました");
}
async function addNote(event) {
  event.preventDefault(); const text = $("ll-note").value.trim(); if (!text) return;
  const item = NB.clone(state.working); item.result ||= {};
  item.result.notes = [...(item.result.notes || []), { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }];
  await commitItem(item, "追記を残しました", { clearNote: true });
}
async function forkDraftToLibrary() {
  if (!canLeave()) return;
  const copy = NB.fork(state.working, uid(), new Date().toISOString());
  await commitItem(copy, "本文をそのまま別案にしました");
}
function renderProductionPreview() {
  if (!state.working) return;
  const item = state.working;
  const packet = buildProductionPacket(item.title, NB.body(item), controls(), item.result?.scene);
  $("ll-view-suno").textContent = [item.result?.production || item.result?.suno || "", item.result?.soundNote || "", packet].filter(Boolean).join("\n\n");
}
function generate() {
  const parts = classify(splitSeed($("ll-seed").value));
  state.reroll += 1;
  const built = buildDraft(parts, controls());
  state.generated = built; state.generatedForId = state.working.id; $("ll-view-draft").textContent = built.draft;
  $("ll-view-draft").parentElement.open = true;
  status("下書きを試しました。保存中の本文はそのままです。");
}
async function copyText(text, label = "本文") {
  if (!text) { status("コピーする内容がまだありません。"); return; }
  try { await navigator.clipboard.writeText(text); status(`${label}をコピーしました`); }
  catch (error) { status("コピーできませんでした。本文を選択してコピーしてください。"); }
}
async function cloudPull() {
  if (state.busy) return false;
  if (!syncTokenValue()) { $("ll-cloud-settings-main").open = true; status(TOKEN_HELP); return false; }
  state.busy = true; renderCloudState();
  try {
    const response = await fetch("api/lyric-drafts?limit=500", { headers: syncHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "キーを確認してください" : "通信できませんでした");
    const { drafts } = await response.json(); if (!Array.isArray(drafts)) throw new Error("読み込み形式を確認してください");
    state.library = NB.mergeCloud(state.library, drafts, state.pending);
    for (const item of drafts) if (!state.pending[item.id] && !(state.working?.id === item.id && state.dirty) && !(state.resume?.item?.id === item.id)) state.bases[item.id] = item.updatedAt;
    state.cloudLoaded = true; state.cloudStatus = "connected";
    $("ll-cloud-settings-main").open = false;
    if (!state.working && !state.resume && location.hash.startsWith("#work=")) loadDraftFromLibrary(decodeURIComponent(location.hash.slice(6)));
    // Do not replace an open editor, memo or an offline revision during a pull.
    if (state.working && !state.dirty && !state.pending[state.working.id]) {
      const fresh = state.library.find(i => i.id === state.working.id);
      if (fresh) { state.working = NB.clone(fresh); setFields(state.working); renderWork(); }
    }
    if (persist()) status(`${drafts.length}篇を読み込みました`);
    return true;
  } catch (error) { state.cloudStatus = "error"; status(`クラウドを読めませんでした。${error.message}。端末の詩は残っています。`); $("ll-cloud-settings-main").open = true; return false; }
  finally { state.busy = false; renderLibrary(); }
}
async function cloudPush() {
  if (state.busy || !syncTokenValue()) return false;
  state.busy = true; renderCloudState();
  try {
    for (const id of Object.keys(state.pending)) {
      if (state.conflicts[id]) continue;
      const item = NB.clone(state.library.find(i => i.id === id)); if (!item) continue;
      const response = await fetch("api/lyric-drafts", { method: "POST", headers: syncHeaders(), body: JSON.stringify({ drafts: [{ ...item, baseUpdatedAt: state.bases[id] ?? null }] }) });
      if (response.status === 409) { state.conflicts[id] = true; persist(); continue; }
      if (!response.ok) throw new Error(response.status === 413 ? "履歴が保存上限を超えています。バックアップを取り、別作品として分けてください" : response.status === 401 ? "同期キーを確認してください" : "通信できませんでした");
      state.bases[id] = item.updatedAt;
      if (state.library.find(i => i.id === id)?.updatedAt === item.updatedAt) delete state.pending[id];
      if (!persist()) return false;
    }
    state.cloudStatus = "connected";
    const remaining = Object.keys(state.pending).length;
    status(Object.keys(state.conflicts).length ? "別の端末の新しい版があるため、上書きせず止めました。未同期の作品を開いて確認してください。" : remaining ? `この端末に保存済み · 新しい変更が${remaining}篇あります。「未同期を送る」で同期できます。` : "クラウドにも保存済み · ほかの端末でも読めます");
    return true;
  } catch (error) { state.cloudStatus = "error"; status(`クラウドは未同期です。${error.message}。この端末の内容は残っています。`); return false; }
  finally { state.busy = false; renderLibrary(); renderSaved(); }
}
async function resolveConflict() {
  if (!canLeave()) return;
  const oldId = state.working.id;
  const copy = NB.fork(state.working, uid(), new Date().toISOString());
  // First persist the local version under its own id, then refresh the original.
  await commitItem(copy, "こちらの内容を別案に残しました");
  if (state.storageFailed) return;
  delete state.pending[oldId]; delete state.conflicts[oldId];
  persist(); await cloudPull(); await cloudPush();
}
function exportLibraryJson() {
  const payload = { format: "music-stack-lyric-lab-library", version: 2, exportedAt: new Date().toISOString(), drafts: state.library, workspace: workspace() || state.resume };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const a = node("a"); a.href = url; a.download = `lyric-lab-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status("作品・追記・履歴をバックアップしました");
}
async function importLibraryJson(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()); const drafts = Array.isArray(data) ? data : data.drafts;
    if (!Array.isArray(drafts) || !drafts.every(i => i && typeof i === "object" && typeof i.id === "string"
      && (!i.result || (typeof i.result === "object" && !Array.isArray(i.result)
        && [i.result.notes, i.result.revisions].every(list => list == null || (Array.isArray(list) && list.every(n => n && typeof n.text === "string"))))))) throw new Error("format");
    // Import as separate copies: never overwrite an existing/cloud version.
    for (const draft of drafts) {
      const item = NB.fork(draft, uid(), new Date().toISOString());
      item.title = `${draft.title || "無題"}（読込）`; state.library.unshift(item); state.pending[item.id] = true;
    }
    if (data.workspace?.dirty && !state.resume) state.resume = data.workspace;
    if (persist()) status(`${drafts.length}篇を別作品として読み込みました。クラウドへ残すには「未同期を送る」。`);
    renderLibrary();
  } catch (error) { status("バックアップを読み込めませんでした。JSONファイルを確認してください。"); }
}
function bindNotebook() {
  $("ll-new-draft").onclick = startNewDraft;
  document.querySelectorAll("[data-open-shelf]").forEach(el => el.onclick = event => { event.preventDefault(); openShelf(); });
  $("ll-edit").onclick = () => { if (!canLeave()) return; setFields(state.working); state.dirty = false; state.editing = true; state.activeView = "final"; renderWork(); $("ll-view-final").focus(); };
  $("ll-cancel-edit").onclick = () => { if (!canLeave()) return; state.editing = false; state.dirty = false; setFields(state.working); renderWork(); persist(); };
  $("ll-save-final").onclick = saveFinal;
  $("ll-note-form").onsubmit = addNote;
  $("ll-fork-draft").onclick = forkDraftToLibrary;
  $("ll-conflict-fork").onclick = resolveConflict;
  $("ll-copy-view").onclick = () => copyText(NB.body(state.working));
  $("ll-save-sound").onclick = async () => {
    const raw = $("ll-audio-url").value.trim(); if (raw && !normalizedSourceUrl(raw)) { status("リンクは http または https のURLで入力してください。"); return; }
    const item = NB.clone(state.working); item.result ||= {}; item.result.soundNote = $("ll-sound-note").value; item.result.audioUrl = raw; await commitItem(item, "音のメモを残しました");
  };
  $("ll-save-settings").onclick = () => {
    const item = NB.clone(state.working); item.seed = $("ll-seed").value; item.sourceUrl = $("ll-source-url").value;
    item.settings = { ...item.settings, ...controls() }; return commitItem(item, "素材・設定を残しました");
  };
  $("ll-build").onclick = generate;
  $("ll-use-draft").onclick = async () => {
    if (!state.generated || !canLeave()) return;
    const copy = NB.fork(state.working, uid(), new Date().toISOString()); copy.result = { ...state.generated, final: state.generated.draft, status: "working" }; await commitItem(copy, "試した下書きを別作品にしました");
  };
  $("ll-copy-ai-handoff").onclick = () => copyText(buildAiHandoffPacket(), "AIに相談する文");
  $("ll-copy-production").onclick = () => { renderProductionPreview(); copyText($("ll-view-suno").textContent, "制作メモ"); };
  $("ll-copy-intake-prompt").onclick = () => copyText(INTAKE_PROMPT, "思想質問");
  $("ll-distill-to-seed").onclick = () => { const lines = distillProfile($("ll-distill").value).anchors || []; $("ll-seed").value = [$("ll-seed").value, ...lines].filter(Boolean).join("\n"); markDirty(); };
  $("ll-library-search-main").oninput = e => { state.librarySearch = e.target.value; renderLibrary(); };
  $("ll-connect").onclick = cloudPull; $("ll-cloud-pull-main").onclick = cloudPull; $("ll-cloud-push-main").onclick = cloudPush;
  $("ll-sync-token-main").oninput = () => {
    try { localStorage.setItem(SYNC_TOKEN_KEY, syncTokenValue()); } catch (error) { status("同期キーを端末に保存できませんでした"); }
    state.cloudLoaded = false; state.cloudStatus = "idle"; renderCloudState();
  };
  $("ll-sync-token-main").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); void cloudPull(); } };
  $("ll-copy-token").onclick = () => copyText(syncTokenValue(), "同期キー");
  $("ll-export-json").onclick = exportLibraryJson;
  $("ll-import-json").onclick = () => $("ll-import-file").click();
  $("ll-import-file").onchange = e => { void importLibraryJson(e.target.files?.[0]); e.target.value = ""; };
  document.querySelectorAll("#ll-work input, #ll-work textarea, #ll-work select").forEach(el => el.addEventListener("input", markDirty));
  window.addEventListener("beforeunload", e => { if (state.dirty || state.storageFailed) { e.preventDefault(); e.returnValue = ""; } });
  window.addEventListener("online", () => { if (syncTokenValue()) void cloudPush(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#shelf") openShelf(); else if (location.hash.startsWith("#work=")) loadDraftFromLibrary(decodeURIComponent(location.hash.slice(6))); });
}
restoreNotebook(); bindNotebook(); renderLibrary();
if (location.hash.startsWith("#work=") && !state.resume) loadDraftFromLibrary(decodeURIComponent(location.hash.slice(6)));
if (syncTokenValue()) void cloudPull();
else $("ll-cloud-settings-main").open = !state.library.length;
if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
