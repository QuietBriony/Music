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
  suno: "Suno",
  map: "曲設計"
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

function buildSuno(title, draft, controls) {
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
  return [
    "[Title]",
    title,
    "",
    "[Style of Music]",
    `${profile.suno}, ${taste.suno}, ${worldview.suno}, ${energy}, ${odd}, ${dialect}`,
    "",
    "[Lyrics]",
    draft
  ].join("\n");
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
      "suno_prompt_guardrail",
      "ep133_scene_logic"
    ]),
    phrase_seeds_as_metadata: {
      title_seeds: titleSeeds,
      motif_labels: motifLabels,
      mouthfeel_notes: mouthfeelNotes
    },
    arrangement_notes: {
      ep133_scene_logic: "commit this pressure field as a scene before mutating it",
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
  const lines = [
    `title: ${title}`,
    `direction: ${profile.label}`,
    `taste: ${taste.label}`,
    `dialect: ${dialect}`,
    `worldview: ${worldview.label}`,
    `scene_id: ${sceneData.scene_id}`,
    `no_lyrics: ${sceneData.no_lyrics}`,
    sourceUrl ? `source: ${sourceUrl}` : "source: (none)",
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
  link.hidden = !url;
  if (url) link.href = url;
  else link.removeAttribute("href");
}

function buildAiHandoffPacket() {
  const currentControls = controls();
  const currentLyric = state.activeView === "final"
    ? $("ll-view-final").value.trim()
    : (state.result?.draft || state.result?.final || "").trim();
  const sourceUrl = normalizedSourceUrl(currentControls.sourceUrl);
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
    sourceUrl ? `voice_memo_url: ${sourceUrl}` : "voice_memo_url: none",
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
    currentLyric || "none"
  ].join("\n");
}

function generate() {
  const text = $("ll-seed").value;
  const lines = splitSeed(text);
  const parts = classify(lines);
  const currentControls = controls();
  const built = buildDraft(parts, currentControls);
  const suno = buildSuno(built.title, built.draft, currentControls);
  const scene = buildSceneMetadata(parts, built.title, currentControls);
  const map = buildMap(parts, built.title, currentControls.sourceUrl, currentControls.direction, currentControls.taste, currentControls.dialect, currentControls.worldview, currentControls.distill, scene);
  const previousFinal = state.currentId ? state.result?.final : "";
  const previousStatus = state.currentId ? state.result?.status : "";
  state.result = {
    ...built,
    suno,
    map,
    scene,
    parts,
    final: previousFinal || built.draft,
    status: previousStatus || "working"
  };
  render();
  save();
}

function render() {
  const result = state.result;
  const empty = "素材を貼って「下書きを作る」。";
  $("ll-view-draft").textContent = result?.draft || empty;
  $("ll-view-final").value = result?.final || result?.draft || "";
  $("ll-view-hook").textContent = result?.hook || empty;
  $("ll-view-suno").textContent = result?.suno || empty;
  $("ll-view-map").textContent = result?.map || empty;
  renderChips("ll-hook-cuts", result?.parts?.hooks || [], "hook");
  renderChips("ll-mantras", result?.parts?.mantras || [], "mantra");
  renderChips("ll-images", result?.parts?.images || [], "image");
  renderChips("ll-distill-anchors", distillProfile($("ll-distill").value).anchors || [], "distill");
  renderSourceLink();
  renderLibrary();
  $("ll-status").textContent = result ? `${result.title} の下書きを作りました` : "";
}

function renderChips(id, list, kind) {
  const root = $(id);
  root.innerHTML = "";
  const items = list.length ? list : ["none"];
  for (const item of items.slice(0, 18)) {
    const span = document.createElement("span");
    span.className = "ll-chip";
    span.dataset.kind = kind;
    span.textContent = item;
    root.appendChild(span);
  }
}

function activeText() {
  if (state.activeView === "library") return librarySummaryText();
  if (!state.result) return "";
  if (state.activeView === "final") return $("ll-view-final").value;
  return {
    draft: state.result.draft,
    final: state.result.final,
    hook: state.result.hook,
    suno: state.result.suno,
    map: state.result.map
  }[state.activeView] || state.result.draft;
}

async function copyText(text, label) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    $("ll-status").textContent = `${label}をコピーしました`;
  } catch (error) {
    $("ll-status").textContent = "コピーできませんでした";
  }
}

async function copyAiHandoff() {
  if (!ensureResult()) {
    $("ll-status").textContent = "AIへ渡す下書きがありません";
    return;
  }
  if (state.activeView === "final") {
    state.result.final = $("ll-view-final").value.trim() || state.result.draft;
    updateSunoFromFinal();
  }
  await copyText(buildAiHandoffPacket(), "AI用データ");
}

function appendUniqueLines(textarea, lines) {
  const current = splitSeed(textarea.value);
  const next = unique([...current, ...lines]);
  textarea.value = next.join("\n");
}

function distillToSeed() {
  const profile = distillProfile($("ll-distill").value);
  const additions = unique([
    ...profile.anchors,
    ...profile.sections.terms,
    ...profile.sections.presets
  ]).slice(0, 24);
  if (!additions.length) {
    $("ll-status").textContent = "思想蒸留に拾える言葉がありません";
    return;
  }
  appendUniqueLines($("ll-seed"), additions);
  state.currentId = null;
  generate();
  save();
  $("ll-status").textContent = `${additions.length}個の言葉をネタへ移しました`;
}

function ensureResult() {
  if (!state.result && hasDraftInput()) generate();
  return Boolean(state.result);
}

function updateSunoFromFinal() {
  if (!state.result) return;
  const final = state.result.final || state.result.draft || "";
  state.result.suno = buildSuno(state.result.title, final, controls());
}

function draftToFinal() {
  if (!ensureResult()) {
    $("ll-status").textContent = "磨く下書きがありません";
    return;
  }
  state.result.final = state.result.draft;
  state.result.status = "working";
  updateSunoFromFinal();
  setActiveView("final");
  render();
  saveDraftToLibrary();
  $("ll-status").textContent = "下書きを編集画面へ移しました";
}

async function saveFinal(status = "working") {
  if (!ensureResult()) {
    $("ll-status").textContent = "保存する歌詞がありません";
    return;
  }
  state.result.final = $("ll-view-final").value.trim() || state.result.draft;
  state.result.status = status;
  updateSunoFromFinal();
  const item = saveDraftToLibrary();
  render();
  setActiveView("final");
  $("ll-status").textContent = status === "fixed" ? `${state.result.title} を完成にしました` : "歌詞を保存しました";
  if (item && syncTokenValue()) {
    const message = status === "fixed"
      ? `${item.title} を完成版としてクラウド保存しました`
      : `${item.title} をクラウドにも保存しました`;
    await cloudPush({ saveCurrent: false, keepView: true, successMessage: message });
  }
}

function setActiveView(view) {
  state.activeView = view;
  const output = document.querySelector(".ll-output");
  if (output) output.dataset.view = view;
  for (const button of document.querySelectorAll(".ll-tab")) {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  for (const pre of document.querySelectorAll(".ll-view")) {
    pre.classList.toggle("is-active", pre.id === `ll-view-${view}`);
  }
  for (const tool of document.querySelectorAll(".ll-output-tools [data-views]")) {
    tool.hidden = !tool.dataset.views.split(/\s+/).includes(view);
  }
  const toolbar = document.querySelector(".ll-output-toolbar");
  if (toolbar) toolbar.hidden = view === "library";
  $("ll-output-label").textContent = view === "final" ? "歌詞を磨く" : (VIEW_LABELS[view] || view);
}

function openShelf() {
  setActiveView("library");
  document.querySelector(".ll-output")?.scrollIntoView({ block: "start", behavior: "smooth" });
  save();
  if (syncTokenValue() && !state.cloudLoaded && state.cloudStatus !== "syncing") {
    void cloudPull({ quiet: true });
  }
}

function startNewDraft() {
  const hasWorkspace = hasDraftInput() || Boolean(state.result);
  if (hasWorkspace && !window.confirm("現在の入力欄を空にして、新しい歌詞を始めますか？作品棚の保存済み作品は残ります。")) {
    return;
  }
  $("ll-title").value = "";
  $("ll-source-url").value = "";
  $("ll-seed").value = "";
  $("ll-distill").value = "";
  state.reroll = 0;
  state.currentId = null;
  state.result = null;
  if (location.hash === "#shelf") {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  setActiveView("draft");
  render();
  save();
  $("ll-status").textContent = "新しい歌詞を始めます";
  requestAnimationFrame(() => {
    document.querySelector(".ll-source")?.scrollIntoView({ block: "start", behavior: "smooth" });
    $("ll-title").focus();
  });
}

function draftSnapshot(id = state.currentId) {
  const now = new Date().toISOString();
  const result = state.result || null;
  return {
    id: id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: $("ll-title").value.trim() || result?.title || "Untitled",
    sourceUrl: $("ll-source-url").value.trim(),
    seed: $("ll-seed").value,
    settings: {
      direction: $("ll-direction").value,
      taste: $("ll-taste").value,
      dialect: $("ll-dialect").value,
      worldview: $("ll-worldview").value,
      distill: $("ll-distill").value,
      form: $("ll-form").value,
      voice: $("ll-voice").value,
      heat: $("ll-heat").value,
      weird: $("ll-weird").value
    },
    result,
    status: result?.status || "working",
    reroll: state.reroll,
    activeView: state.activeView,
    createdAt: state.library.find((item) => item.id === id)?.createdAt || now,
    updatedAt: now
  };
}

function saveLibrary() {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(state.library));
  } catch (error) {
    $("ll-status").textContent = "作品棚へ保存できませんでした";
  }
}

function mergeLibraryDrafts(incoming) {
  const byId = new Map(state.library.map((item) => [item.id, item]));
  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const id = item.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const current = byId.get(id);
    const nextUpdated = String(item.updatedAt || "");
    const currentUpdated = String(current?.updatedAt || "");
    if (!current || nextUpdated >= currentUpdated) byId.set(id, { ...item, id });
  }
  state.library = [...byId.values()].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    state.library = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    state.library = [];
  }
}

function hasDraftInput() {
  return Boolean($("ll-seed").value.trim() || $("ll-source-url").value.trim() || $("ll-distill").value.trim());
}

function saveDraftToLibrary() {
  if (!hasDraftInput()) {
    $("ll-status").textContent = "保存する歌詞がありません";
    return null;
  }
  if (!state.result) generate();
  if (state.result && state.activeView === "final") {
    state.result.final = $("ll-view-final").value.trim() || state.result.draft;
    state.result.status = state.result.status === "fixed" ? "fixed" : "working";
    updateSunoFromFinal();
  }
  const item = draftSnapshot();
  const index = state.library.findIndex((entry) => entry.id === item.id);
  if (index >= 0) state.library[index] = item;
  else state.library.unshift(item);
  state.currentId = item.id;
  saveLibrary();
  renderLibrary();
  save();
  $("ll-status").textContent = `${item.title} を作品棚へ保存しました`;
  return item;
}

async function saveDraftAndSync() {
  const item = saveDraftToLibrary();
  if (!item || !syncTokenValue()) return;
  await cloudPush({ saveCurrent: false, keepView: true, successMessage: `${item.title} をクラウドにも保存しました` });
}

function nextTakeTitle(baseTitle) {
  const base = (baseTitle || "Untitled").replace(/\s+take\s+\d+$/i, "").trim() || "Untitled";
  const count = state.library.filter((item) =>
    (item.title || "").replace(/\s+take\s+\d+$/i, "").trim() === base
  ).length;
  return `${base} take ${Math.max(2, count + 1)}`;
}

function forkDraftToLibrary() {
  if (!hasDraftInput()) {
    $("ll-status").textContent = "別案にする素材がありません";
    return null;
  }
  const title = nextTakeTitle($("ll-title").value.trim() || state.result?.title);
  state.currentId = null;
  state.reroll += 1;
  $("ll-title").value = title;
  generate();
  const item = draftSnapshot(null);
  state.library.unshift(item);
  state.currentId = item.id;
  saveLibrary();
  renderLibrary();
  save();
  $("ll-status").textContent = `${item.title} を別案として保存しました`;
  return item;
}

async function forkDraftAndSync() {
  const item = forkDraftToLibrary();
  if (!item || !syncTokenValue()) return;
  await cloudPush({ saveCurrent: false, keepView: true, successMessage: `${item.title} を別案としてクラウド保存しました` });
}

function loadDraftFromLibrary(id) {
  const item = state.library.find((entry) => entry.id === id);
  if (!item) return;
  const openView = item.result ? "final" : "draft";
  state.currentId = item.id;
  $("ll-title").value = item.title || "";
  $("ll-source-url").value = item.sourceUrl || "";
  $("ll-seed").value = item.seed || "";
  $("ll-direction").value = item.settings?.direction || "hitotobi";
  $("ll-taste").value = item.settings?.taste || "era-rap";
  $("ll-dialect").value = item.settings?.dialect || "none";
  $("ll-worldview").value = item.settings?.worldview || "gap";
  $("ll-distill").value = item.settings?.distill || "";
  $("ll-form").value = item.settings?.form || "full";
  $("ll-voice").value = item.settings?.voice || "collective";
  $("ll-heat").value = item.settings?.heat || "58";
  $("ll-weird").value = item.settings?.weird || "64";
  state.reroll = Number(item.reroll || 0);
  state.activeView = openView;
  state.result = item.result || null;
  if (state.result) {
    state.result.final = state.result.final || state.result.draft || "";
    state.result.status = state.result.status || item.status || "working";
  }
  if (!state.result && $("ll-seed").value.trim()) generate();
  else {
    render();
    save();
  }
  setActiveView(openView);
  requestAnimationFrame(() => {
    document.querySelector(".ll-output")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  $("ll-status").textContent = `${item.title || "Untitled"} を開きました`;
}

async function deleteDraftFromLibrary(id) {
  const item = state.library.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm(`「${item.title || "Untitled"}」を作品棚から削除しますか？`)) return;
  state.library = state.library.filter((entry) => entry.id !== id);
  if (state.currentId === id) state.currentId = null;
  saveLibrary();
  renderLibrary();
  save();
  $("ll-status").textContent = `${item.title || "Untitled"} を削除しました`;
  if (!syncTokenValue()) return;
  try {
    const response = await fetch(`api/lyric-drafts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: syncHeaders()
    });
    if (!response.ok) throw new Error("cloud delete failed");
    state.cloudCount = Math.max(0, Number(state.cloudCount || 1) - 1);
    state.cloudStatus = "connected";
    renderCloudState();
    $("ll-status").textContent = `${item.title || "Untitled"} をクラウドからも削除しました`;
  } catch (error) {
    state.cloudStatus = "error";
    renderCloudState("削除の同期に失敗");
    $("ll-status").textContent = "端末から削除しました。クラウド削除は再試行してください";
  }
}

function draftStatus(item) {
  return item?.result?.status || item?.status || "working";
}

function draftStatusLabel(item) {
  return draftStatus(item) === "fixed" ? "完成" : "制作中";
}

function draftDirection(item) {
  return item?.settings?.direction || "hitotobi";
}

function draftTaste(item) {
  return item?.settings?.taste || "era-rap";
}

function draftWorldview(item) {
  return item?.settings?.worldview || "gap";
}

function draftDistill(item) {
  return item?.settings?.distill || "";
}

function draftKind(item) {
  if (item?.result?.scene?.no_lyrics) return "scene";
  if (item?.sourceUrl) return "memo";
  if (draftStatus(item) === "fixed") return "lyric";
  return "text";
}

function collapseText(value, max = 150) {
  const text = String(value || "")
    .replace(/^#\s+.*$/gm, "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return charLength(text) > max ? `${text.slice(0, max).trim()}...` : text;
}

function draftPreview(item) {
  return collapseText(
    item?.result?.final ||
    item?.result?.draft ||
    item?.result?.hook ||
    item?.seed ||
    item?.sourceUrl ||
    "",
    160
  ) || "no preview yet";
}

function draftScenePressure(item) {
  return collapseText(item?.result?.scene?.pressure || item?.result?.map || "", 130);
}

function formatLibraryDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function draftWorldviewLabel(item) {
  const label = worldviewProfile(draftWorldview(item)).label;
  return draftDistill(item).trim() ? `${label} + 蒸留` : label;
}

function filteredLibrary() {
  const query = state.librarySearch.trim().toLowerCase();
  const currentDirection = $("ll-direction").value;
  return state.library.filter((item) => {
    const status = draftStatus(item);
    const direction = draftDirection(item);
    if (state.libraryFilter === "current" && direction !== currentDirection) return false;
    if (state.libraryFilter === "scene" && draftKind(item) !== "scene") return false;
    if (state.libraryFilter === "fixed" && status !== "fixed") return false;
    if (state.libraryFilter === "working" && status === "fixed") return false;
    if (state.libraryFilter === "memo" && !item.sourceUrl) return false;
    if (!query) return true;
    const haystack = [
      item.title,
      item.seed,
      item.sourceUrl,
      draftDistill(item),
      directionProfile(direction).label,
      tasteProfile(draftTaste(item)).label,
      draftWorldviewLabel(item),
      draftKind(item),
      item.result?.scene?.pressure,
      item.result?.scene?.scene_id,
      item.settings?.dialect,
      status
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function librarySummaryText() {
  return filteredLibrary()
    .map((item) => {
      const label = directionProfile(draftDirection(item)).label;
      const taste = tasteProfile(draftTaste(item)).label;
      const worldview = draftWorldviewLabel(item);
      return `- ${item.title || "Untitled"} [${draftStatus(item)} / ${label} / ${taste} / ${worldview} / ${draftKind(item)}]`;
    })
    .join("\n");
}

function syncLibraryControls() {
  for (const id of ["ll-library-search", "ll-library-search-main"]) {
    const input = $(id);
    if (input && input.value !== state.librarySearch) input.value = state.librarySearch;
  }
  for (const id of ["ll-library-filter", "ll-library-filter-main"]) {
    const select = $(id);
    if (select && select.value !== state.libraryFilter) select.value = state.libraryFilter;
  }
}

function renderLibraryInto(root, items, limit = 24) {
  if (!root) return;
  const shelf = root.id === "ll-library-main";
  root.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "ll-library-empty";
    empty.textContent = state.library.length ? "該当する作品はありません" : "作品はまだありません";
    root.appendChild(empty);
    return;
  }
  for (const item of items.slice(0, limit)) {
    const row = document.createElement("div");
    row.className = "ll-library-item";
    if (shelf) row.classList.add("ll-library-card");
    if (item.id === state.currentId) row.dataset.active = "true";
    row.dataset.status = draftStatus(item);

    const load = document.createElement("button");
    load.type = "button";
    load.className = "ll-library-load";
    load.textContent = item.title || "Untitled";
    load.addEventListener("click", () => loadDraftFromLibrary(item.id));

    const meta = document.createElement("span");
    meta.className = "ll-library-meta";
    const label = directionProfile(draftDirection(item)).label;
    const taste = tasteProfile(draftTaste(item)).label;
    const worldview = draftWorldviewLabel(item);
    meta.textContent = `${draftStatusLabel(item)} / ${label} / ${taste} / ${worldview}`;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "ll-library-delete";
    del.textContent = "x";
    del.setAttribute("aria-label", `${item.title || "作品"}を削除`);
    del.addEventListener("click", () => void deleteDraftFromLibrary(item.id));

    if (shelf) {
      const top = document.createElement("div");
      top.className = "ll-library-card-top";
      const date = document.createElement("span");
      date.className = "ll-library-date";
      date.textContent = formatLibraryDate(item.updatedAt);
      top.append(load, date);

      const tags = document.createElement("div");
      tags.className = "ll-library-shelf-tags";
      for (const tag of [draftStatusLabel(item), label, worldview]) {
        const chip = document.createElement("span");
        chip.className = "ll-library-tag";
        chip.dataset.kind = draftStatus(item) === "fixed" && tag === draftStatusLabel(item) ? "fixed" : "meta";
        chip.textContent = tag;
        tags.appendChild(chip);
      }

      const preview = document.createElement("p");
      preview.className = "ll-library-preview";
      preview.textContent = draftPreview(item);

      const scenePressure = draftScenePressure(item);
      const scene = document.createElement("p");
      scene.className = "ll-library-scene";
      scene.textContent = scenePressure ? `scene: ${scenePressure}` : "scene: not mapped yet";

      const footer = document.createElement("div");
      footer.className = "ll-library-card-footer";
      const actions = document.createElement("div");
      actions.className = "ll-library-card-actions";
      const sourceUrl = normalizedSourceUrl(item.sourceUrl);
      if (sourceUrl) {
        const source = document.createElement("a");
        source.className = "ll-library-source-link";
        source.href = sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "メモ";
        source.setAttribute("aria-label", `${item.title || "Untitled"} の元メモを開く`);
        actions.appendChild(source);
      }
      const open = document.createElement("button");
      open.type = "button";
      open.className = "ll-library-open-button";
      open.textContent = "開く";
      open.setAttribute("aria-label", `${item.title || "Untitled"} を開く`);
      open.addEventListener("click", () => loadDraftFromLibrary(item.id));
      del.textContent = "削除";
      actions.append(open, del);
      footer.append(meta, actions);

      row.append(top, tags, preview, scene, footer);
    } else {
      row.append(load, meta, del);
    }
    root.appendChild(row);
  }
}

function syncTokenInputs(value = syncTokenValue()) {
  for (const id of ["ll-sync-token", "ll-sync-token-main"]) {
    const input = $(id);
    if (input && input.value !== value) input.value = value;
  }
}

function setCloudSettingsOpen(open) {
  const settings = $("ll-cloud-settings-main");
  const toggle = $("ll-cloud-settings-toggle");
  if (settings) settings.dataset.open = String(open);
  if (toggle) toggle.setAttribute("aria-expanded", String(open));
}

function renderCloudState(message = "") {
  const root = document.querySelector(".ll-library-cloud-tools");
  const label = $("ll-cloud-state-main");
  const hasToken = Boolean(syncTokenValue());
  if (!hasToken && state.cloudStatus !== "syncing") state.cloudStatus = "idle";
  if (hasToken && state.cloudStatus === "idle") state.cloudStatus = "ready";

  const text = message || {
    idle: "この端末は未接続",
    ready: "同期キー保存済み",
    syncing: "同期中...",
    connected: `${state.cloudCount ?? state.library.length}作品・接続済み`,
    error: "接続を確認してください"
  }[state.cloudStatus] || "未接続";

  if (root) root.dataset.state = state.cloudStatus;
  if (label) label.textContent = text;
  const disabled = !hasToken || state.cloudStatus === "syncing";
  for (const id of ["ll-cloud-pull-main", "ll-cloud-push-main"]) {
    const button = $(id);
    if (button) button.disabled = disabled;
  }
  if (!hasToken || state.cloudStatus === "error") setCloudSettingsOpen(true);
  else if (state.cloudStatus === "connected") setCloudSettingsOpen(false);
}

function renderLibrary() {
  syncLibraryControls();
  const items = filteredLibrary();
  renderLibraryInto($("ll-library"), items, 24);
  renderLibraryInto($("ll-library-main"), items, 200);
  for (const id of ["ll-library-count", "ll-library-main-count"]) {
    const count = $(id);
    if (count) {
      count.textContent = items.length === state.library.length
        ? `${state.library.length}作品`
        : `${items.length} / ${state.library.length}作品`;
    }
  }
  renderCloudState();
}

function exportLibraryJson() {
  const payload = {
    format: "music-stack-lyric-lab-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    drafts: state.library
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lyric-lab-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  $("ll-status").textContent = "作品棚のバックアップを作りました";
}

async function importLibraryJson(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : data.drafts;
    if (!Array.isArray(incoming)) throw new Error("missing drafts");
    mergeLibraryDrafts(incoming);
    saveLibrary();
    renderLibrary();
    $("ll-status").textContent = `${incoming.length}作品を復元しました`;
  } catch (error) {
    $("ll-status").textContent = "バックアップを復元できませんでした";
  }
}

function syncHeaders() {
  const token = syncTokenValue();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-Lyric-Lab-Token"] = token;
  return headers;
}

function syncTokenValue() {
  return ($("ll-sync-token-main")?.value || $("ll-sync-token")?.value || "").trim();
}

function focusCloudToken() {
  setActiveView("library");
  setCloudSettingsOpen(true);
  requestAnimationFrame(() => ($("ll-sync-token-main") || $("ll-sync-token"))?.focus());
}

async function cloudPull({ quiet = false } = {}) {
  try {
    if (!syncTokenValue()) {
      focusCloudToken();
      $("ll-status").textContent = TOKEN_HELP;
      renderCloudState();
      return false;
    }
    state.cloudStatus = "syncing";
    renderCloudState();
    if (!quiet) $("ll-status").textContent = "クラウドを更新しています...";
    const response = await fetch("api/lyric-drafts", { headers: syncHeaders() });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("cloud token rejected");
      throw new Error(await response.text());
    }
    const data = await response.json();
    const incoming = Array.isArray(data.drafts) ? data.drafts : [];
    mergeLibraryDrafts(incoming);
    saveLibrary();
    state.cloudStatus = "connected";
    state.cloudLoaded = true;
    state.cloudCount = incoming.length;
    renderLibrary();
    setActiveView("library");
    $("ll-status").textContent = `クラウドから${incoming.length}作品を更新しました`;
    return true;
  } catch (error) {
    state.cloudStatus = "error";
    state.cloudLoaded = false;
    const rejected = error.message === "cloud token rejected";
    renderCloudState(rejected ? "同期キーを確認してください" : "クラウドに接続できません");
    if (rejected) focusCloudToken();
    $("ll-status").textContent = rejected ? "同期キーを確認してください" : "クラウドから更新できませんでした";
    return false;
  }
}

async function cloudPush({ saveCurrent = true, keepView = false, successMessage = "" } = {}) {
  try {
    if (!syncTokenValue()) {
      focusCloudToken();
      $("ll-status").textContent = TOKEN_HELP;
      renderCloudState();
      return false;
    }
    if (saveCurrent && hasDraftInput()) saveDraftToLibrary();
    state.cloudStatus = "syncing";
    renderCloudState();
    $("ll-status").textContent = "クラウドへ保存しています...";
    const response = await fetch("api/lyric-drafts", {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify({ drafts: state.library })
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("cloud token rejected");
      throw new Error(await response.text());
    }
    const data = await response.json();
    state.cloudStatus = "connected";
    state.cloudLoaded = true;
    state.cloudCount = state.library.length;
    renderCloudState();
    if (!keepView) setActiveView("library");
    $("ll-status").textContent = successMessage || `${data.count || 0}作品をクラウドへ保存しました`;
    return true;
  } catch (error) {
    state.cloudStatus = "error";
    const rejected = error.message === "cloud token rejected";
    renderCloudState(rejected ? "同期キーを確認してください" : "クラウドに接続できません");
    if (rejected) focusCloudToken();
    $("ll-status").textContent = rejected ? "同期キーを確認してください" : "クラウドへ保存できませんでした";
    return false;
  }
}

function save() {
  const payload = {
    title: $("ll-title").value,
    sourceUrl: $("ll-source-url").value,
    seed: $("ll-seed").value,
    direction: $("ll-direction").value,
    taste: $("ll-taste").value,
    dialect: $("ll-dialect").value,
    worldview: $("ll-worldview").value,
    distill: $("ll-distill").value,
    form: $("ll-form").value,
    voice: $("ll-voice").value,
    heat: $("ll-heat").value,
    weird: $("ll-weird").value,
    reroll: state.reroll,
    activeView: state.activeView,
    currentId: state.currentId
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(SYNC_TOKEN_KEY, syncTokenValue());
  } catch (error) {
    // Ignore private-mode storage errors.
  }
}

function restore() {
  try {
    const storedToken = localStorage.getItem(SYNC_TOKEN_KEY) || "";
    syncTokenInputs(storedToken);
    state.cloudStatus = storedToken ? "ready" : "idle";
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    $("ll-title").value = data.title || "";
    $("ll-source-url").value = data.sourceUrl || "";
    $("ll-seed").value = data.seed || "";
    $("ll-direction").value = data.direction || "hitotobi";
    $("ll-taste").value = data.taste || "era-rap";
    $("ll-dialect").value = data.dialect || "none";
    $("ll-worldview").value = data.worldview || "gap";
    $("ll-distill").value = data.distill || "";
    $("ll-form").value = data.form || "full";
    $("ll-voice").value = data.voice || "collective";
    $("ll-heat").value = data.heat || "58";
    $("ll-weird").value = data.weird || "64";
    state.reroll = Number(data.reroll || 0);
    state.activeView = data.activeView || "draft";
    state.currentId = data.currentId || null;
  } catch (error) {
    // Ignore broken saved drafts.
  }
}

function bind() {
  $("ll-build").addEventListener("click", generate);
  $("ll-reroll").addEventListener("click", () => {
    state.reroll += 1;
    generate();
  });
  $("ll-copy-all").addEventListener("click", () => copyText(state.result?.draft || "", "draft"));
  $("ll-copy-view").addEventListener("click", () => copyText(activeText(), VIEW_LABELS[state.activeView] || state.activeView));
  $("ll-copy-ai-handoff").addEventListener("click", () => void copyAiHandoff());
  $("ll-copy-hook").addEventListener("click", () => copyText(state.result?.hook || "", "hook"));
  $("ll-draft-to-final").addEventListener("click", draftToFinal);
  $("ll-save-final").addEventListener("click", () => void saveFinal("working"));
  $("ll-fix-final").addEventListener("click", () => void saveFinal("fixed"));
  $("ll-save-draft").addEventListener("click", () => void saveDraftAndSync());
  $("ll-fork-draft").addEventListener("click", () => void forkDraftAndSync());
  $("ll-export-json").addEventListener("click", exportLibraryJson);
  $("ll-import-json").addEventListener("click", () => $("ll-import-file").click());
  $("ll-distill-to-seed").addEventListener("click", distillToSeed);
  $("ll-copy-intake-prompt").addEventListener("click", () => copyText(INTAKE_PROMPT, "思想質問"));
  $("ll-new-draft").addEventListener("click", startNewDraft);
  for (const button of document.querySelectorAll("[data-open-shelf]")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openShelf();
    });
  }
  for (const id of ["ll-cloud-pull", "ll-cloud-pull-main"]) {
    $(id)?.addEventListener("click", () => void cloudPull());
  }
  for (const id of ["ll-cloud-push", "ll-cloud-push-main"]) {
    $(id)?.addEventListener("click", () => void cloudPush());
  }
  $("ll-cloud-settings-toggle")?.addEventListener("click", () => {
    const settings = $("ll-cloud-settings-main");
    const open = settings?.dataset.open !== "true";
    setCloudSettingsOpen(open);
    if (open) requestAnimationFrame(() => $("ll-sync-token-main")?.focus());
  });
  $("ll-import-file").addEventListener("change", (event) => {
    importLibraryJson(event.target.files?.[0]);
    event.target.value = "";
  });
  $("ll-view-final").addEventListener("input", () => {
    if (!state.result) return;
    state.result.final = $("ll-view-final").value;
    if (state.result.status === "fixed") state.result.status = "working";
    updateSunoFromFinal();
    renderLibrary();
  });
  for (const id of ["ll-library-search", "ll-library-search-main"]) {
    $(id).addEventListener("input", (event) => {
      state.librarySearch = event.target.value;
      renderLibrary();
    });
  }
  for (const id of ["ll-library-filter", "ll-library-filter-main"]) {
    $(id).addEventListener("change", (event) => {
      state.libraryFilter = event.target.value;
      renderLibrary();
    });
  }
  for (const id of ["ll-sync-token", "ll-sync-token-main"]) {
    $(id)?.addEventListener("input", (event) => {
      syncTokenInputs(event.target.value);
      state.cloudStatus = event.target.value.trim() ? "ready" : "idle";
      state.cloudLoaded = false;
      renderCloudState();
      save();
    });
    $(id)?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void cloudPull();
    });
  }
  $("ll-clear").addEventListener("click", startNewDraft);
  for (const button of document.querySelectorAll(".ll-tab")) {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.view);
      save();
    });
  }
  for (const id of ["ll-title", "ll-source-url", "ll-seed", "ll-distill", "ll-direction", "ll-taste", "ll-dialect", "ll-worldview", "ll-form", "ll-voice", "ll-heat", "ll-weird"]) {
    $(id).addEventListener("input", save);
  }
  $("ll-source-url").addEventListener("input", renderSourceLink);
  $("ll-distill").addEventListener("input", () => renderChips("ll-distill-anchors", distillProfile($("ll-distill").value).anchors || [], "distill"));
  $("ll-direction").addEventListener("change", renderLibrary);
  $("ll-taste").addEventListener("change", renderLibrary);
  $("ll-dialect").addEventListener("change", renderLibrary);
  $("ll-worldview").addEventListener("change", renderLibrary);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

loadLibrary();
restore();
const initialShelfRequested = location.hash === "#shelf" || new URLSearchParams(location.search).get("view") === "shelf";
if (initialShelfRequested) {
  state.activeView = "library";
}
bind();
setActiveView(state.activeView);
if (hasDraftInput()) generate();
else render();
registerServiceWorker();
if (initialShelfRequested) {
  requestAnimationFrame(() => {
    document.querySelector(".ll-output")?.scrollIntoView({ block: "start" });
  });
  if (syncTokenValue()) void cloudPull({ quiet: true });
}
window.addEventListener("hashchange", () => {
  if (location.hash === "#shelf") openShelf();
});
