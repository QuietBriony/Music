# Band Room — Changelog (v65 → v337 compact)

Current compact release: v337.

---

## v337 compact — Null Zone を「音楽的な出来事」に接続 (すべてがつながって)

v333 の Null Zone 窓は master 自動化のみで、音楽の層が窓を知らなかった —
疎な場面では窓が無音で通り過ぎることすらあった。「すべてがつながって」へ:

- **窓の入口で sub swell** (`?v=fm-118`): 現在の melodic-director キーに移調した
  A1 (55Hz) が 1.4s attack で立ち上がる — 「低音がぶっとく立ち上がる」瞬間を
  bass content の有無に依らず保証。和声に属する音なのでドローンではなく
  「その曲の出来事」として鳴る。release 3.5s で場に溶ける。専用 sine synth →
  masterGain (field の mono-low を通る)。
- **窓の間、accent 層が身を引く**: maybeTriggerWorldAccents の glass / harp /
  texture / hat-fracture 確率を ×0.45 — 低音圧が主役の数小節を全員が空ける。
  downbeat / turnaround の構造アンカーは維持。
- `engine.js?v=fm-118` (+ audio/music-*.js 同期)、`sw.js hazama-fm-v337`。
- 試聴ポイント: 窓の入りで深い一音が「立ち上がって」場を支配し、キラキラ系が
  すっと引き、窓明けに戻ってくるか。swell の音程がその時のキーに合っているか。

---

## v336 compact — ギターをダブルトラック(L/R の壁)+ コードパッド整理

生バンド感の続き(v334 リズム転写 → v335 ストローク感 → v336 壁の左右):
- **ダブルトラック**(full runtime のみ): 同一演奏を 2 テイクに —
  ドライを左(pan -0.42)、**13ms Haas 遅延**コピーを右(+0.42)。第二サンプラー
  無しでロックの L/R リズムギターの壁。倍化で約 +2.5dB 上がる分、guitarBus を
  0.88 → 0.74 に補正(広がるが大きくならない)。light runtime は従来の
  単発 -0.18 配置のまま(CPU・モノラルスピーカー)。
- **コードパッドのダック**: 転写ギターが実コードを刻むようになったので、同じ
  ボイシングを重ねるパッドは濁りの素 — `guitar_line` を持つ曲ではパッドの
  velocity を ×0.62 に(支えのベッドへ後退)。転写の無い曲はフルレベル維持。

`band-room.js?v=br-203`、`hazama-fm-v336`。CSS は br-84 のまま。

---

## v335 compact — ギター磨き: ダウン/アップ・ストローク + 密度12 + ドライブ増

v334 リズムギターの磨き(生バンド感の続き):
- **ダウン/アップ・ストローク感**: 速い刻み(1.2 steps 未満間隔)では交互に
  アップストローク扱い — 僅かに弱く(×0.88)・僅かに遅れ(+4ms)・**弦を逆順に
  スイープ**(high→low)。機械的に均一だった刻みに右手の往復が宿る。
  間隔が空いたら新規ダウンストロークでリセット。
- **密度もう一段**: 抽出キャップ 10→12 strums/bar(8分チャグ+アクセントが
  収まる)、light runtime の行キャップ 5→6。全曲再抽出。
- **ドライブ増(full path のみ)**: electric の distortion 0.18→0.26 /
  wet 0.32→0.42 — クリーンなデモ・サンプルから「歪んだロックギター」へ。
  light は据え置き(スマホのスピーカーと CPU)。

`band-room.js?v=br-202`、`hazama-fm-v335`。CSS は br-84 のまま。

---

## v334 compact — ギター転写を「リズムギター」に作り直し(生バンド感)

ユーザー報告「ギターしょぼい、codex に触らせたけどどうにもならん感。生バンド感
マシマシで」。実測診断(human-fly):
- 検出器は verse で **9.5 strums/bar** 拾えるのに最終データは **5/bar**(median
  集約 + 広い移動平均 + delta 0.09 で、音圧の高い箇所のチャグ8分が埋もれていた)
- 持続が **median 2.8 steps(73% が 2 steps 以上)** = 歪みサステインの減衰追跡が
  走りすぎてドローン化、PolySynth の声も食い潰す
- 再生側 `floor(9/rows)` で行数が多い小節ほど **1音に痩せる**(パワーコード崩壊)

v334:
- 抽出: mean envelope + タイトな移動平均(5)+ delta 0.05 + wait 1 →
  実ストローク密度に追従(10/bar キャップは維持)。持続は**次のストロークまで**
  (×0.92、上限 2.0 steps)= チャグのゲート感。ベロシティは v328 と同じ
  dB 基準 0.16-1.0。
- 再生: voicing を **常時 root+5th(+octave)**(light 2音 / full 3音)に固定。
  **ストラム・スタガー**(7ms/弦、上弦ほど僅かに弱く)— オルガン刺しではなく
  ダウンストロークに。light は従来どおり一括発音(CPU)。
- 全曲再抽出: tabasco 85 / hey 973 / i-got-a-feeling 1201 / under-the-moon 882 /
  electric-sheep 706 / human-fly 684 / sister 764 strums(median vel 0.75-0.83)。

`band-room.js?v=br-201`、`hazama-fm-v334`。CSS は br-84 のまま。

---

## v333 compact — Master Field: The Null Zone (低音モノ圧 × 中高域ワイド)

ユーザー方向「A Strange Wedding 'The Null Zone' みたいに低音がモノでぶっとく
立ち上がり良質な低音圧に囲まれる『時』が欲しい / 中高域はひろーく、いろいろ
聞こえる / 全部つながって Aphex 的包み感」。

診断: fm-55 の master StereoWidener(0.62) が**低域まで全帯域を広げていた** —
低音のセンター圧が左右に滲む(ぶっとさの真逆)。

- engine.js master FIELD 化 (`?v=fm-117`、fm-55 ブロックの進化):
  - **low <160Hz → Tone.Mono** — 低音は常時モノで太く、圧として中央に
  - mid 160-2400Hz → Widener 0.55 (従来並み)
  - **high >2400Hz → Widener 0.85** — ひろーっく、ディテールが左右に住む
- **NullZoneState** — 周期的な「囲まれる」窓: 48 小節周期で 6 小節、lows
  +2dB スウェル (2.2s ramp) / mids −1.2dB / highs 幅 0.95 全開 → 3.2s で
  ゆっくり戻る。warmup 24 小節は発動しない。advanceGrooveStructure の
  HumanGrooveGovernor と同じ縫い目から 1 小節ごと駆動。
- `window.NullZoneField.state` で診断可。Tone の帯域ノード不在環境では
  fm-55 経路へフォールバック (無音化リスク無し)。
- references/apple-music-refs.json に **A Strange Wedding — The Null Zone**
  を北極星として追加 (mono-low / wide-high / 周期窓の翻訳付き、36 refs)。
- 対象: Music Core Rig + Hazama FM 共有マスター。Band Room 不変。
- `engine.js?v=fm-117` (+ audio/music-*.js 同期)、`sw.js hazama-fm-v333`。
- 試聴ポイント: 低音が以前よりセンターに「密」か / シンセの高域が左右に
  広いか / 数分聴くと低音に包まれる数小節の「時」が訪れ、ゆっくり引くか。

---

## v332 compact - Band Room light AI playback

Band Room AI recreation keeps the transcribed guitar/bass/vocal data, but
light runtimes now play a representative per-bar subset instead of firing
every extracted row at once. Guitar keeps source-derived timing/velocity while
using a single-voice driven fallback in light mode, chords shorten long pads,
and sampler voice/guitar paths use lightweight delay space instead of heavy
reverb.

The START path also keeps the quick synth-first behavior and avoids rebuilding
samplers from stopped AI controls, so playback can start immediately and stay
responsive on lower-power browser sessions.

`band-room.js?v=br-200`, `hazama-fm-v332`.

---

## v331 compact - Hazama FM Null Zone refractions

Hazama FM's acoustic-fun field now has a `null-zone` layer inspired by
spatially strange IDM / Aphex-style ear play:

- Keeps sub and kick pressure mono-centered through `mono-low`.
- Adds high-passed notch sweeps, micro-ratchet FM flecks, and ping-pong
  refractions above the bass so the mid/high field feels like it is moving
  through holes in the room.
- Uses per-pill profiles so techno/funk get sharper wrong-footed motion while
  ambient/piano stay wider and slower.

`audio/genre-flavor.js?v=fm-75`, `hazama-fm-v331`.

---

## v330 compact - Band Room transcribed guitar line feel

Band Room AI recreation now carries a real `guitar_line` for every Tabasco
song. `scripts/transcribe-stem-lines.py --guitar-only` reads `other.mp3`
onsets and embeds compact `[bar, step16, durSteps, midi, vel]` rows, so guitar
strums keep source-derived microtiming, varied decay lengths, and velocity
swells instead of fixed MIDI placement.

Runtime guitar playback now prefers `guitar_line` and falls back to the
generated guitar agent only when a song lacks the data. The guitar chain also
opens the pick/top-end lane slightly while keeping the PolySynth voice cap low.

`band-room.js?v=br-199`, `hazama-fm-v330`.

---

## v329 compact - Hazama FM acoustic fun field

Hazama FM genre flavor now adds a shared acoustic-fun production layer:

- `mono-low`: centered low-frequency anchor for the thick, mono bass rise.
- `orbital-air`: high-passed FM/glass/noise accents through ping-pong delay,
  stereo widening, and slow auto-pan so mids/highs move around the field.
- Default techno / lofi / jazz / funk fallback paths now run through the same
  governor so the sound design survives missing preset data.

`audio/genre-flavor.js?v=fm-74`, `hazama-fm-v329`.

---

## v328 compact — 転写ラインに「生感」(間・強弱・実音長)

ユーザー要望「音質を生感出るよう磨いて　間とか　強弱とか」。v324/v325 の転写は
16分グリッドに量子化・ベロシティ圧縮(0.30-0.95)・音長整数丸めで、実音は弾くが
機械的だった。v328 で**演奏そのものを保存**する形式に:

- **間(マイクロタイミング)**: step を小数化(量子化廃止)。プレイヤーの
  突っ込み/後ノリがそのまま残る(全曲 87-99% の音が off-grid)。subTime 経由なので
  テンポスライダーにも追従。
- **強弱**: ベロシティを attack 窓(46ms)の実音量から **dB 基準で 0.16-1.0** に
  マップ(旧 0.30-0.95 線形RMS の倍以上のレンジ)。
- **実音長**: 整数丸め+固定ゲート(×0.95)廃止 → スタッカート/レガートの呼吸。
- 品質ゲート強化: **中央値ベロシティ < 0.30 の vocal は embed しない**(tabasco /
  electric-sheep のチャント stem はささやき/ブリード検出だった → 正しくスキップ)。
- スクリプトの再実行バグ2件を先回り修正: step 15.996→16.0 丸め境界、再実行時に
  legacy が導出済み進行で上書きされる件(オリジナル推定を main から全曲復元済み)。

| song | bass | vocal |
|---|---|---|
| tabasco | 71 | skip(チャント) |
| hey | 763 | 922 |
| i-got-a-feeling | 539 | 852 |
| under-the-moon | 566 | 934 |
| electric-sheep | 379 | skip(インスト) |
| human-fly | 728 | 654 |
| sister | 455 | 757 |

`playTranscribedBar` は小数 step/音長対応(min 50ms ガードのみ)。
`band-room.js?v=br-198`、`hazama-fm-v328`。CSS は br-84 のまま。

---

## v327 compact — Melodic Cell 横断展開: funk clavi / walking bass も motif へ

v326 (accent 4 層) の横断第二弾。genre-flavor.js の旋律面に残っていた
per-event 乱数 pitch 選択を engine の phrase motif cell に接続:

- **funk clavi (default 経路)**: chord-tone を 16 分ごとに独立サイコロ →
  `melodicCellIndex("funkClavi", …)` — clavi が反復するリフを刻む。glass /
  harp の動機と同じ cell を踏むので層間で韻が揃う
- **funk clavi (FromFrames 経路)**: claviStep anchor + 乱数 ±1 wobble →
  wobble を cell 駆動に (phrase 内で同じ figure が回る)
- **walking bass の neighbor passing tone**: 接近方向 (上/下) が per-event
  コイン → phrase ごとに固定 (cell home slot から導出) — 同じ側からの反復
  接近は「意図」として聴こえる
- engine 不変 (fm-116 のまま)。fallback 付き (engine 未ロード時は旧 random)。
  密度 gate / velocity / timing humanize は全て不変
- `audio/genre-flavor.js?v=fm-73`、`sw.js hazama-fm-v327`
- 試聴ポイント: funk pill で clavi が「同じ短いリフを繰り返してから変える」
  こと、bass の装飾音の入り方が phrase 内で一貫すること

## v326 compact — Melodic Cell: 旋律面の「ランダムが過ぎる」を motif 化

ユーザー指摘「music rig も Hazama FM の自動も、ちゃんと面白い音楽に。ランダムが
過ぎる」。診断: director (key 進行 / contour / haze コード進行) は構造化済みだが、
**旋律 accent 層 (glass / harp / ambient harp / lofi comp) が毎 event 独立の
uniform random で note を選んでいた** — 反復ゼロ = motif として知覚できない。

- engine.js `MelodicCellState` 新設 (`?v=fm-116`、MelodicDirector 隣の bounded 追加):
  phrase (8-16 小節) ごとに 1 つの短い cell (4 slot、home 域から下方重力つき
  random walk で生成) を作り、全旋律 accent 層が**同じ cell を順に踏む**。
  - 層ごとの counter で cell を周回 → 同じ動機が繰り返し聴こえる
  - 2 周目ごとに tail が home へ解決する answer 値に置換 — 反復+変化 (問い→答え)
  - 正規化 0..1 を各層の pool 長へ写像 → glass / harp / comp が**互いに韻を踏む**
- per-event の Math.random は note **選択**から全廃。密度 gate / micro-timing
  humanize / phrase 転換の新鮮さ (director) は不変。
- `randomChordForMode` も haze pad と同じ progression 化 (裸の random pool pick →
  GrooveState.cycle で 1 小節 1 進行 + phrase/chordTurn で開始回転) — performance
  pad の和声が「進行」になった。
- 対象: Music Core Rig と Hazama FM 両方 (engine 共有層)。drum-frames / Band Room
  は不変。
- `engine.js?v=fm-116` (+ audio/music-*.js 同期 bump)、`sw.js hazama-fm-v326`。
- 試聴ポイント: 同じ phrase 内で glass/harp の短い動機が**繰り返す**こと、phrase
  が変わると新しい動機に入れ替わること、lofi の 2.5 拍 comp が毎回違う音を
  サイコロらず motif をなぞること。

---

## v325 compact — 転写を全曲展開(AI 再現が全曲「実曲」を弾く)

v324 パイロット(human-fly)の全曲展開。`scripts/transcribe-stem-lines.py` を
残り6曲に実行し、実 stem からの bass/vocal 転写 + ベース由来コード進行で置換
(旧推定は全曲 `chord_progression_legacy` 保持)。スクリプト改良: セクションを
フルネーム単位で導出(verse-1 と verse-2 を区別)、無音 fallback を曲のキーから、
薄い転写は埋め込まない品質ゲート(bass ≥30 / vocal ≥60 音)を追加。

| song | bass | vocal | BPM fit |
|---|---|---|---|
| tabasco | 70 | skip(チャント) | 136 → 132.5 |
| hey | 748 | 887 | 123 → 120.2 |
| i-got-a-feeling | 523 | 823 | 117 → 120.2 |
| under-the-moon | 559 | 927 | 161 → 161.5 |
| electric-sheep | 376 | 184 | 129 → 129.2 |
| human-fly (v324) | 711 | 632 | 117 → 117.4 |
| sister | 442 | 731 | 117 → 117.4 |

旧カタログ進行との一致率は全曲 20-33% — 推定進行が全曲実態とズレていた裏付け。
検証: Node simulation 全曲不正行 0・最大 12音/bar(polyphony 安全圏)・全セクションに
コードあり。gate は全曲対応の汎用 assertion へ(形状・時刻順・legacy 保持・5/7 曲以上)。

アプリコードは v324 のまま(データのみ)。`band-room.js?v=br-197`、`hazama-fm-v325`。


---

## v324 compact — AI 再現 転写パイロット: human-fly が「実曲」を弾く

ユーザー指摘「AI再現成立してるかい？そうは思えんが」→ データを開けて確認した
結論: **成立してなかった**。曲 JSON には構造/コード/ドラム打点しか無く、音符レベルの
実曲情報(リフ・メロディ・ベースライン)が**ゼロ** — AI は「同じ構造で別バンドが
初見ジャム」していた。さらに実 bass の音名分布(G 44% / F 19% / D 14%)から、
カタログのコード進行 G-Em-C-D が**実曲と別物**(C も Em もほぼ不在、実態は
G ミクソリディアンの F=♭VII ロック)だったことも判明 — コンピングも間違っていた。

v324 パイロット(human-fly):
- `scripts/transcribe-stem-lines.py` 新設 — librosa.pyin で実 stem から転写。
  BPM は drums stem から実測フィット(117 → 117.45、後半のグリッドずれ防止)。
  bass_line **711音** / vocal_melody **632音**、bars 0-115 をカバー。
- 曲 JSON に `bass_line` / `vocal_melody`(`[bar,step16,durSteps,midi,vel]` 行)を埋込。
- **コード進行をベース由来で導出し直して置換**(旧版は `chord_progression_legacy` に
  保持)。chorus はほぼ G + F、bridge は E♭-D — 実曲の響きに。guitar/chord agent は
  この修正進行をコンピングする。
- band-room.js: `playTranscribedBar()` — 転写データがある曲は bass/voice agent が
  生成をスキップして**実ライン/実メロを演奏**。無い曲は従来の生成にフォールバック。
  コード無しセクション(intro 等)でも転写があれば鳴るよう呼出条件を緩和。

転写の有る/無しはデータ駆動なので、ear-verify OK なら同スクリプトを残り6曲に回すだけ。
`band-room.js?v=br-197`、`hazama-fm-v324`。CSS は br-84 のまま。

---

## v323 compact — AI 再現も wall へ(v322 と同方向)

ユーザー要望「AI音源も改善ヨロ」— 原音 v322(初期 Nirvana wall)と同じ方向へ
AI 再現の polish bus(instrumentBus、AI 専用)を寄せた。

両パス共通(スマホ軽量パスにも効く):
- **EQ ミッドの scoop 解除**: mid -0.4 → 0、low -0.6 → -0.4。壁はミッドに住む。
  high shelf 1.5/4200 は計測チューン済み(v301 brightness 軸)なので不変。
- **glue 一段強め**: 2.05:1 → 2.2:1、release 0.18 → 0.17(attack 14ms 維持)。
  v301 計測で AI の DR は target より広すぎ(16.5 vs 8.7 dB)だったので計測的にも順方向。
- **音圧**: makeup 3.0 → 3.2(原音 v322 の持ち上げに追従)。

フル(デスクトップ)パスのみ:
- **parallel grit 強化**: distortion 0.12 → 0.15 / wet 0.16 → 0.20。synth 素材は
  fizz に転びやすいので 原音(0.16/0.16)よりやや控えめ設定。

v316 のスマホ AI diet(sat/exciter レス)は維持 — 軽量パスには waveshaper を
足さず、EQ/glue/makeup の底上げで wall を作る。AI bus 個別レベル(drum 0.52 /
bass 0.84 / guitar 0.88 / chord 0.62)は並行調整中のため不変。

`band-room.js?v=br-196`、`hazama-fm-v323`。CSS は br-84 のまま。

---

## v322 compact — 原音マスターを初期 Nirvana wall へ(しょぼい fix)

ユーザー報告: 原音 tabasco(イントロ曲)が「音しょぼく感じる」、全体を「初期
Nirvana アルバム的に」。tabasco stems を実測: エネルギーの **57% が 80–250 Hz**、
6 kHz 以上は ~5%、guitar peak は drums より ~6 dB 低い — 暗い・ブーミー・ギター
奥 = しょぼいの正体。加えて v311 で pumping 対策に makeup を 1.35→1.20 へ下げた
分、単純にレベルも控えめだった。

v322(stemMaster = 原音専用、AI 再現には影響なし):
- **parallel grit を主役に**: distortion 0.11→0.16 / wet 0.10→0.16。低域エネルギー
  を倍音へ変換して壁の密度を作る(Bleach 的ダート)。comp pumping なしで太くなる。
- **glue 一段強め**: 2.3:1→2.5:1、release 0.22→0.20(attack 18ms は維持=パンチ温存)。
- **makeup 復帰**: 1.20→1.34(v311 比 ほぼ復元)。しょぼい=音圧不足の直接対処。
- **EQ tilt**: low 0.9→0.8 / mid 0.65→0.85 / high 0.1→0.3 — ブームから一歩離れ、
  ミッドの壁とバイトへ。
- **guitar 前へ**: stemBus.other 0.91→0.96(実測 -6 dB を詰める。Nirvana はギターが壁)。

`band-room.js?v=br-195`、`hazama-fm-v322`。CSS は br-84 のまま。

---

## v321 compact — album vocal thickness を曲別に追加

ユーザーフィードバック「ボーカル、それぞれ最適になるように、少しずつ上げて。厚み出す感じで。」に対応。v320 の曲別 stem mastering をそのまま使い、各曲の `vocals_db` だけ小幅に追加する。

- Hey `+1.2dB`、I got a feeling `+0.8dB`、Under the Moon `+1.1dB`。
- Electric Sheep は全体の音量感を崩さず vocal だけ `+1.4dB`。05 の良い大きさは維持。
- Human Fly は既に vocal が前にいるため `+0.6dB` に抑え、band pressure の改善を邪魔しない。
- Sister は `+0.7dB`。締め曲らしい自然さを残して少しだけ厚みを足す。
- Tabasco intro は実質 vocal が薄いので補正なし。
- JS cache を `band-room.js?v=br-194`、SW を `hazama-fm-v321` へ同期。

---

## v320 compact — album stem mastering で曲間のバンド音圧を統一

ユーザーフィードバック「05 Electric Sheep の音の大きさいい感じ。06 Human Fly に移ると、バンドの音が小さい」「各曲毎の音量というか、バンドの音圧が同じになるように」に対応。

- `presets/bands.json` の Tabasco 各曲に `stem_mastering` を追加。05 Electric Sheep を基準に、低く聴こえる曲の drums / bass / other だけ曲別に小幅ブーストする。
- `band-room.js` の original stems load に `Tone.Player -> per-song Gain -> stem EQ -> stem bus` を追加。既存UIは増やさず、曲切替・stem variant・seek/resyncはそのまま。
- 06 Human Fly は band 3stem が Electric Sheep より低かったため、drums `+2.4dB` / bass `+2.0dB` / other `+1.6dB`。ボーカルは上げず、バンドだけ前へ。
- Hey / I got a feeling / Under the Moon / Sister も、リミッターへ過度に突っ込まない範囲で album pressure を近づける。
- JS cache を `band-room.js?v=br-193`、SW を `hazama-fm-v320` へ同期。

---

## v319 compact — bass / vocal pressure を少しだけ追加

ユーザーフィードバック「ボーカル、ちょっとだけ、音圧足して。ベースも、同様に。」に対応。v318 の guitar sparkle と v317 の drum pressure は維持し、bass と vocal だけ小幅に押し出す。

- 原音 vocal stem: bus / slider を `0.52 / 52 → 0.55 / 55`。dry center は戻さず、溶けたまま少しだけ密度を足す。
- 原音 bass stem: bus / slider を `0.88 / 88 → 0.91 / 91`。drums / guitar wall と並ぶ低域の押し出しを追加。
- AI bass: bus / slider を `0.80 / 80 → 0.84 / 84`。AI voice はデフォルトOFFかつ特殊なgain設計なので今回は据え置き。
- 保存済み prefs は旧既定値の `br-vol-stem-vocals` / `br-vol-stem-bass` / `br-vol-bass` だけ v319 へ移行。custom slider は保持。
- JS cache を `band-room.js?v=br-192`、SW を `hazama-fm-v319` へ同期。

---

## v318 compact — guitar spark / pressure を前へ

ユーザーフィードバック「ギターの音粒のキラキラ感と抜け感、音圧増して」に対応。v317 のドラム圧は維持しつつ、ギターだけ上の粒立ちと前への押し出しを足す。

- AI 再現: guitar bus を `0.82 → 0.88`、既定 slider を `88` へ。bass / chord / voice は据え置き。
- sampled guitar: LPF を `6000 → 7800Hz`、velocity cutoff 上限を `7000 → 9200Hz`、sample volume を `-4 → -2.5dB`。pick attack と shimmer を残す。
- synth fallback guitar: LPF を light/full で `5200 / 6200Hz` へ開き、volume を `-12 → -10.5dB`。軽量再生のまま抜けを改善。
- 原音 stems: `other` bus を `0.88 → 0.91`、other EQ を low `-0.35` / mid `+0.2` / high `+0.85 @ 4600Hz` にして、band/guitar の air と presence を出す。
- 保存済み prefs は旧既定値の `br-vol-guitar` と `br-vol-stem-other` だけ v318 へ移行。custom slider は保持。
- JS cache を `band-room.js?v=br-191`、SW を `hazama-fm-v318` へ同期。

---

## v317 compact — drum pressure を少し前へ

ユーザー試聴で「ドラムの音圧上げて。バランスいい感じで」とフィードバック。
v316 の軽量化は維持しつつ、ドラムだけを小幅に前へ出して、バンド全体の壁は崩さない。

- AI 再現: drum bus を `0.44 → 0.52`、既定 slider を `48 → 52`。
- 原音 stems: drum stem bus / 既定 slider を `0.88 / 88 → 0.92 / 92`。
- bass / guitar / chord / vocal / master は据え置き。ドラムの当たりだけを上げる。
- 保存済み prefs は現行既定値だった `br-vol-drums` と `br-vol-stem-drums` だけ移行し、
  カスタム値は保持。
- JS cache を `band-room.js?v=br-190`、SW を `hazama-fm-v317` へ同期。

---

## v316 compact — AI 再現を light runtime 優先に再調整

v315 の quick synth → sampler upgrade は START の体感は改善したが、再生中の裏
sampler fetch/decode と常時 UI/MediaStream tap が弱い端末ではまだ重かったため、
AI 再現の既定をさらに軽量側へ倒した。

- `START` / 再生中の AI mode 切替では quick synth を既定のまま維持し、CDN sampler
  の自動 upgrade は `?aiSamples=1` または localStorage opt-in 時だけにした。
- light runtime では既存 sampler layer が残っていても START 時に synth layer へ戻す。
- AI 用 polish bus は低負荷端末で常時 saturation / exciter をバイパスし、bass / guitar /
  chord / voice fallback も oversample / LFO / reverb を削った軽い構成にする。
- meter / timeline は AI/light runtime 中に毎 frame で起こさず、低 cadence に変更。
- spectrum FFT、recording MediaStream、background bridge MediaStream、stems recorder tap は
  必要時まで作らない。
- JS cache を `band-room.js?v=br-189`、SW を `hazama-fm-v316` へ同期。

---

## v315 compact — AI 再現を quick synth → sample upgrade の二段構えに変更

Plan mode の入力待ちで止まっていた「AI再現の改善」方針は、スマホ/PWAでもまず鳴る
ことを優先しつつ、生音 sampler も後から活かす二段構えで実装した。

- `START` / 再生中の AI mode 切替では、drums / bass / guitar / chord / voice をまず
  軽量 synth fallback で作って即再生できるようにする。
- CDN sampler はバックグラウンドで読み、song / mode / kit / instrument 選択が
  変わっていない場合だけ、読み込み完了したパートを差し替える。
- 直接の toggle / instrument selector 操作は従来どおり、選んだ音色を明示 rebuild する。
- JS cache を `band-room.js?v=br-188`、SW を `hazama-fm-v315` へ同期。

---

## v314 compact — sound controls を 1 パネルへ整理

v313 の band-forward / vocal-wide 音作りは維持。UI は音設定が `mastering` /
`vocal FX` / `volume mixer` に分かれていて、試聴時に触る場所が散りすぎていたため、
1 つの `sound mix` パネルへ集約した。

- `space`、`vocal blend`、`stems` / `AI parts` を同じパネル内に整理。
- timing smear の原因として off 固定にしていた vocal `echo` slider は表の UI から外した。
  内部 delay send は 0 のまま。
- CSS cache を `band-room.css?v=br-84`、JS cache を `band-room.js?v=br-187`、
  SW を `hazama-fm-v314` へ同期。

---

## v313 compact — band forward / vocal wide-dissolve

v312 で空間を戻した後、試聴ではまだ vocal が前に強い。今回は vocal を単に小さくするだけではなく、
band の wall を少し立てて、vocal は dry center を下げつつ chorus / short room へ広げる。

- vocal: stem bus 0.59→0.52、dry 0.78→0.68。delay は off のまま。
  chorus 0.11→0.16 / depth 0.42、reverb send 0.13→0.16、tail 2.9s / preDelay 0.012。
  声を前面から少し引いて、左右と部屋へ溶かす。
- band stems: drums / bass / other を 0.88 へ。stem master EQ は low 0.9 / mid 0.65 /
  high 0.1、parallel grit も少し増やし、バンド音が vocal の奥で痩せないようにする。
- shared master: width 0.72、room 0.20、tail 3.0s。default slider / migration も同期。

`band-room.js?v=br-186`、`hazama-fm-v313`。

---

## v312 compact — 原音 vocal を空間へ少し溶かす + stereo / air を戻す

v311 で timing smear / pumping を止めるため vocal FX と glue をかなり締めたが、
今回の試聴方針は「もう少しボーカルを空間やバンド音に馴染ませる」「広がる感じ」
「高音を含め全帯域が生きる」。v311 の delay off / 緩めた glue は維持しつつ、
wash に戻らない範囲で空間と air を戻す。

- vocal: delay は off のまま。chorus 0.08→0.11、reverb send 0.07→0.13、
  tail 1.9→2.6s、dry 0.82→0.78、vocal bus 0.58→0.59。早く浮く echo ではなく、
  短め room でバンド壁へ溶かす。
- 原音 stem master: high cut -0.6→-0.2。耳に痛くしないまま、guitar / cymbal /
  room air を殺しすぎない。
- shared master: width 0.62→0.68、master room 0.16→0.18 + tail 2.8s。
  デフォルト slider / migration も同じ値へ同期。

`band-room.js?v=br-185`、`hazama-fm-v312`。

---

## v311 compact — 原音 vocal をポケットに戻す + glue を緩めて pumping 解消

ユーザー報告: 原音が「全体的に音ズレ・調和してない」「ボーカルが早めにきてずれてる」。
切り分け: 4 stems は **サンプル完全一致**(同 SR 44.1k / 同フレーム数 / 同尺、検証済み)
で同時スタート → **物理的なズレは無い**。原因は FX 側:
- v305/v306 で戻した reverb(send 0.18 / 3.2s tail)がボーカルを浮かせて前へ出し、
  8 分音符ディレイがタイミングを滲ませていた → **早く/離れて**聞こえる。
- stemMaster の firm glue comp(2.8:1 / 10ms)+ makeup 1.35 が、前に出たボーカルに
  合わせて **バンド全体を pumping** → 「調和してない」。

修正(v311):
- vocal をポケットへ: reverb 0.18→0.07・tail 3.2→1.9s・preDelay 0.022→0.014、
  **ディレイ off**(0.06→0)、chorus 0.12→0.08、dry 0.78→0.82、level 0.60→0.58。
- glue 緩和: comp 2.8:1/10ms → 2.3:1/18ms attack + 0.22 release、makeup 1.35→1.20。
  トランジェントが抜けてバンドが呼吸、squash した壁から自然な一体感へ。

原音は 4 stems の合算(別途「元のフルミックス」ファイルは存在しない)。stems 自体は
完全同期なので、これは音作りの調整。`band-room.js?v=br-184`、`hazama-fm-v311`。

---

## v310 compact — MetaMask 拡張 promise noise を診断 overlay から除外

Chrome の MetaMask 拡張が出す `Failed to connect to MetaMask` の
unhandled promise rejection を、`audio/audio-safety.js` の画面下診断 overlay から
除外。Hazama FM / Band Room 本体は wallet / web3 を使っていないため、音声エラーと
誤認しないようにするための表示 cleanup。

`audio/audio-safety.js?v=fm-61` / `audio/audio-safety.js?v=br-67`、
`hazama-fm-v310`。音声生成ロジックは不変。

---

## v309 compact — human-fly 歌詞カバレッジ補完(追従の穴を解消)

ユーザー報告: human-fly で「最初 追従無し」「3分くらい以降 止まる」。原因は
**ASR のカバレッジ欠け**(再生コードの不具合ではない):
- 0–約60s は実質インスト・イントロ(明瞭なボーカル無し)→ v307 の先取りリードで
  先頭行をプレビュー表示(これは仕様どおり)。
- **2:40–3:43 に約 63 秒の穴**があり、その間 行が無く「止まって」見えていた。
再録(`condition_on_previous_text=True` / `no_speech_threshold` 緩め / temperature
フォールバック)で穴を埋め、`docs/tabasco-lyrics-timed.json` の human-fly を
25→34 行に。最大ギャップ 63s→13s。誤認識の profanity 3 行を soften
(例: "fucking out"→"freaking out")。`scripts/transcribe-timed-vocals.py` の
設定も高カバレッジ版へ更新。

データのみの更新(タイムド歌詞は `?cb=` で都度 fetch)。アプリ本体コードは不変
(`band-room.js?v=br-183`、`band-room.css?v=br-83`)。SW 版のみ `hazama-fm-v309`。

---

## v308 compact — バックグラウンド再生を「復活」(既定 ON + iOS/Android/PWA 対応)

バックグラウンド再生(画面ロック/アプリ切替でも鳴り続ける)が事実上使えなかった
原因: 隠し media-stream ブリッジが **opt-in かつ Apple モバイル限定**、しかも opt-in
を立てる UI が無く `?bg=1` URL でしか有効化できなかった(= codex がスマホ＋URL で
再生した時だけ効いていた)。修正:
- ブリッジを **既定 ON**(`?bg=0` か保存フラグ "0" で無効化可)。
- 対象を **iOS / Android / インストール済み PWA** に拡張(従来は Apple のみ)。
  デスクトップは隠れても Web Audio が鳴り続けるのでブリッジ不要。
- 仕組み自体は既存のまま: master → MediaStreamDestination → 非表示 `<audio>` を
  再生、ハードウェア出力はミュート。失敗時は直出力にフォールバック。MediaSession の
  メタデータ＋再生状態＋操作ハンドラ(再生/停止/曲送り/シーク)も従来通り。

ルート状態は `br-audio-route-status`(bridge / direct)で確認可。

`band-room.js?v=br-183`、`band-room.css?v=br-83`、`hazama-fm-v308`。

---

## v307 compact — 歌詞カラオケ追従を「最初から」効かせる (intro/gap リード)

v306 の追従が「初回からちゃんといかない」報告。原因はボーカル曲の **長いイントロ**:
最初に歌う行が hey 63.9s / i-got-a-feeling 90s / human-fly 60s と先にあり、それまで
パネルが固まって見える(=追従していないように見える)。修正:
- **イントロ/間奏では次に歌う行を先取り表示**(`.upcoming`)し、そこへスクロール。
  t=0 から「次これ歌うよ」が見えてリードする。歌に入ると `.active`(背景ハイライト)に。
- 間奏でも、前の行と次の行の中点を過ぎたら次の行へリード。
- セルフヒール: stems＋timed データがあるのに `.br-lyric-line` が無ければ即再描画
  (初回レンダリング競合の保険)。

注: tabasco / electric-sheep は実ボーカル無し(チャント/インスト、ASR 不可)なので
従来のセクション・ブロック表示＋セクション追従のまま。デフォルト曲(01 = tabasco)は
これに該当するので、行追従を見るなら歌モノ(hey / under-the-moon 等)で。

`band-room.js?v=br-182`、`band-room.css?v=br-83`、`hazama-fm-v307`。

---

## v306 compact — 歌詞カラオケ追従 + 原音 vocal もう一段「空間になじむ」

原音(stems)モードで、実ボーカルの歌唱タイミングに合わせて歌詞を **1行ずつ
カラオケ追従**(ハイライト＋オートスクロール)。タイミングは Whisper の
word-timestamp ASR を vocal stem にかけて取得、表示テキストは「実際に歌っている
語」を軽く整えたもの(codex の創作歌詞ではなく中庸)。データは
`docs/tabasco-lyrics-timed.json`、対象は実ボーカル5曲(hey / i-got-a-feeling /
under-the-moon / sister / human-fly)。インスト(tabasco / electric-sheep)と
AI(synth)モードは従来のセクション・ブロック表示にフォールバック。追従は
`playbackContentElapsedSec()` を毎フレーム読む(stems=vocals.mp3 の時刻=ASR 時刻)、
seek でも即追従。`updateLyricsHighlight` の querySelectorAll が空振りするので競合なし。

vocal: 「もうちょい空間になじむ」要望で v305 から更に一段。reverb send 0.14 →
0.18、tail 2.8 → 3.2s + preDelay 0.030 → 0.022(早く咲いて馴染む)、vocal bus
0.58 → 0.60(v303 の削りで少し小さく聞こえる分の presence を ~0.3dB 戻す)。
ユーザーの「前のほうが音出てた?」への回答も兼ねる(無加工には戻していない、FX を
減らして整えた上での微増)。

`band-room.js?v=br-181`、`band-room.css?v=br-82`、`hazama-fm-v306`。

---

## v305 compact — 原音 vocal「軽く空間になじむ」(v304 微調整)

v304 で de-wash したら present だが少しドライ、とのユーザー要望「軽く空間に
なじむ感じにしたい」。space を少しだけ戻す(v303 の float には戻さない):
reverb send 0.10 → 0.14 + tail 2.4 → 2.8s、dry 0.82 → 0.78。v304 より僅かに
潤むが、依然 present。`band-room.js?v=br-180`、`hazama-fm-v305`。

Cache marker: `band-room.{html,js,css}?v=br-NN` and `sw.js VERSION = hazama-fm-vNN`.
The two are bumped together — sw VERSION matches the band-room generation it ships.

Note: v113 以降は **Hazama FM 側の修正も含む** ので変更が `engine.js?v=fm-NN`
も bump する。

---

## v304 compact — 原音 vocal を present に（v303 試聴フィードバック）

v303 ship 後のユーザー試聴(原音 / Human Fly):「ボーカルが早い」→ 切り分けで
**「浮いて/離れて聞こえる」**と確定。stem 整合・player 同期はコード上 OK、vocal FX は
全部後ろに付く処理なので timing 起因ではなく、v198 の「ふわっと上から / 空間に溶かす」
wash が **v303 の Nirvana/LCD 指針(ボーカルは壁の中に present)と逆**でリバーブに
浮いて先に耳へ届いていた。

修正(vocal FX を締めて present に):
- `vocalDryGain` 0.66 → **0.82**(dry/前に)
- `vocalReverbWet` 0.20 → **0.10** + reverb decay 4.0 → **2.4**、preDelay 0.055 → 0.030
- `vocalDelayWet` 0.12 → **0.06**、feedback 0.30 → 0.24
- `vocalChorus` wet 0.22 → **0.12**、depth 0.46 → 0.30（swim 抑制）

ボーカルが band の上に浮かず、in time で前に座る。AI 再現は無影響。webapp は計測 hang
なので ship-then-verify(原音はデフォルト = 即 A/B)。締めすぎなら次 round で戻す。

- `band-room.css?v=br-81`、`band-room.js?v=br-179`、`hazama-fm-v304`。

## v303 compact — 原音 (stems) master bus（Nirvana 音圧 + LCD balance）

ユーザー判断で「原音は触らない」ルールを今回**明示的に解除**し、原音(実録音
stems mode = アプリのデフォルト再生)を初めて改良。指針: **Nirvana 的な音圧/
密度 + LCD Soundsystem 的なバランス**(タイト低域・パンチ・クリアだが耳に痛く
ない)。

実測(human-fly 生 stem)で vocals が drums/bass/other より **+5〜7dB ホット**と
判明 → 指針(ボーカルは壁の中に沈める)とも一致。

変更:
- **`makeStemMasterBus`** を新設(AI 再現の makeInstrumentPolishBus の原音版)。
  4 stem を sum して: EQ(低域 +0.8 でパンチ / 高域 -0.6 で耳当たり緩和、生
  drums が既に 73% 高域 + 共有 master が高域 shelf を足すため)+ glue comp
  (threshold -19, ratio 2.8 = Nirvana density)+ 軽い tape sat + makeup
  +2.6dB(音圧)。`stemBus.* → stemMaster → masterGain`。
- **vocal stem 0.68 → 0.58**(ホットなボーカルを band に沈める)。
- AI 再現は instrumentBus 経由で**完全に別系統 = 無影響**。per-stem export tap
  は stemBus 上(stemMaster 前)なので stems-pack export も無影響。

webapp は再生で計測 renderer が hang するため、これは offline 設計 +
**ship-then-verify(実機試聴)**。原音はデフォルトモードなので即 A/B 可能。
保守的な初手 — もっと音圧/別バランスが欲しければ次 round で調整。

- `band-room.css?v=br-81`、`band-room.js?v=br-178`、`hazama-fm-v303`。

---

## v302 compact - Production listening brief

Listening-page / PWA cache pass.

`listen.html` now starts with a concrete Human Fly pass: what to open first,
what to compare, and what short feedback maps to which next implementation
move. This is a listening-brief deploy only; the Human Fly audio path remains
the v301 `band-room.js?v=br-177` body/glue pass. `sw.js` is bumped so installed
PWA/browser caches fetch the updated listening index before the next phone
review.

- `band-room.js?v=br-177`, `hazama-fm-v302`.

---

## v301 compact - Human Fly AI body pass

Band Room runtime / worker-gaming measurement pass.

Human Fly AI recreation now targets the current listening complaint directly:
the prior worker-gaming render was too bright, too separated, and still leaned
toward "mostly drums." The AI-only instrument bus uses less high shelf/exciter
air and a slightly firmer glue compressor, the cramps-punk cymbal layer is
softer, and the default AI mix moves drums back while bass, guitar, and chords
come forward. The offline AI recreation renderer is synced to the same balance
so worker-gaming reports measure the sound we are actually tuning. The latest
worker-gaming pass reports `mix.wav` at centroid `3044.9 Hz`, DR `11.79 dB`,
peak `0.85065`, and `pass_basic_audio_check: true`.

- `band-room.js?v=br-177`, `hazama-fm-v301`.

---

## v300 compact - Runtime checklist marker guard

Docs/test hardening.

The browser listening checklist had stale v172-era cache markers, which could
send a phone/PWA review down the wrong verification path even while the runtime
itself was healthy. The checklist now lists the current repo markers and
`scripts/check-runtime-doc-markers.mjs` verifies that the doc stays in sync with
`fm.html`, `band-room.html`, and `sw.js`. `sw.js` is bumped so installed PWAs
refresh the precached checklist; runtime script markers are unchanged from
v299 (`audio/genre-flavor.js?v=fm-72`, `band-room.js?v=br-176`).

- `hazama-fm-v300`.

---

## v299 compact - Funk clearance and Band AI stability

Phone listening pass from user feedback.

FM funk sounded packed/crushed, so `audio/genre-flavor.js` now gives the funk
layer more headroom: lower funk level, lighter kick/snare/fill weight, reduced
rubber sub, softer clavi/EP levels, and a lower tape-saturation/sidechain
amount. Band Room AI also reduces foreground playback load by throttling meter
/ timeline telemetry on mobile or AI playback, skipping the spectrum analyzer
on mobile AI, and restarting the AI scheduler if bar callbacks stop advancing
while the page is visible.

- `audio/genre-flavor.js?v=fm-72`, `band-room.js?v=br-176`,
  `hazama-fm-v299`.

---

## v298 compact - Human Fly phone pass

Band Room runtime / registry fix.

Human Fly AI review now avoids two production pitfalls from the phone pass:
the ignored `presets/ai-recreation-stems/` preview is no longer offered as a
production stem source unless a local preview URL is used, and the AI mix
defaults move one more step away from "mostly drums" by lowering drums while
bringing bass, guitar, and chords forward. The AI polish exciter also uses a
lighter mobile path so phone playback spends less CPU on generated air.

- `band-room.js?v=br-175`, `hazama-fm-v298`.

---

## v297 compact - Band Room foreground stop

Band Room runtime fix.

Smartphone review now defaults to foreground-only playback: closing or hiding
the Band Room page stops Tone.Transport, stems, external stems, phrase loops,
Media Session state, wake lock, and the hidden audio bridge instead of keeping
the Human Fly review running in the background. The old iPhone hidden-media
bridge path remains available only when explicitly requested with `?bg=1` or
`localStorage["band-room.allowBackgroundAudio.v1"] = "1"`.

- `band-room.js?v=br-174`, `hazama-fm-v297`.

---

## v296 compact - Worker-gaming listening loop

Music Stack side only. Audio engines are unchanged.

`docs/listening-feedback-backlog.md` now records the 2026-06-01 worker-gaming
`tabasco/human-fly` recreation cycle, including the local report/stem paths and
the measured brightness/thinness issues to verify by ear. `listen.html` surfaces
that run on the Band Room listening card so feedback can go directly from
listening into either Sonar polish or reviewed metadata promotion.

- `hazama-fm-v296`.

---

## v295 compact - Listening feedback cues

Music Stack side only. Audio engines are unchanged.

`listen.html` now carries the listening loop itself: each Music/Hazama/Band Room
entry has concrete things to listen for plus reopened notes from prior feedback
such as FM melody repetition, awkward musical changes, and Band Room AI
recreation thinness. `docs/listening-feedback-backlog.md` keeps the same
feedback backlog in text form so short human listening notes can be translated
into implementation tasks without mixing this surface into the broader
dashboards.

- `hazama-fm-v295`.

---

## v294 compact - Music Stack listening index

Music Stack side only. Audio engines are unchanged.

`listen.html` adds a phone-friendly listening index for opening Hazama FM
genre checks, Music Core Rig, Band Room, and the sister app handoff targets
from one screen. Music Core Rig and Hazama FM now link to that index, and the
service-worker/audit path tracks the page so the review entry remains
available after deploys and PWA refreshes.

- `hazama-fm-v294`.

---

## v293 compact - Hazama FM funk pocket tuning

Hazama FM side only. Band Room runtime is unchanged.

`presets/drum-frames-funk.json` now keeps the P-Funk pocket but reduces the
measured drift: kick anchors sit just behind the grid, snares stay inside the
behind-beat target window, and swing is capped to the tighter rubber-funk
range. `fm.js` also starts the funk pill at the measured frame tempo so the
direct FM and Drum Floor handoff feel consistent before playback starts.
The techno frame kick anchors were also rounded to the grid, clearing the last
static timing drift while keeping the hat/snare machine feel unchanged.

- `fm.js?v=fm-70`, `hazama-fm-v293`.

---

## v292 compact - Hazama FM lofi tempo handoff

Hazama FM side only. Band Room runtime is unchanged.

`fm.js` now starts the lofi pill at the measured pocket tempo and uses
genre-aware BPM for the direct drum-floor link before playback starts. This
prevents the UI handoff from exporting Tone's idle 120 BPM default for lofi.

- `fm.js?v=fm-69`, `hazama-fm-v292`.

---

## v291 compact - Hazama FM lofi pocket tuning

Hazama FM side only. Band Room runtime is unchanged.

`presets/drum-frames-lofi.json` was tuned from the measurement loop:
lofi moves closer to its jazz-hop target by lifting average BPM and swing,
while pulling the snare drag back into the intended behind-beat range.
Kick anchors stay mostly unchanged, and hat/ghost offsets keep the dusty
offbeat feel instead of snapping to a rigid grid.

- `hazama-fm-v291`.

---

## v290 compact — crash 間引き（シンバルの壁を除去、v289 の続き）

v289 の offline 計測で判明: drum frames が crash を**過検出**している。
`librosa onset_detect + band-energy classify` が hat / ride / cymbal bleed を
"crash" に誤分類し、各 4小節 frame に 3-6 個の crash event。frame は section
全体で**毎小節リピート**するので、verse は 3 crash × 毎小節、bridge は 6 ×
毎小節 = 曲全体で **~400発**(kick 334 より多い)。この「シンバル鳴りっぱなし」が
ユーザーの「ドラムばっか」と harshness の決定的主因。

修正(**再生側のみ、抽出データは不変 = 私の領分**): `scheduleBar` の frame
event ループで crash を間引く:
- 1小節につき crash は **最大1発**(最も downbeat のもの)
- verse / intro / outro は phrase 頭(4小節に1回)だけ
- それ以外(prechorus / chorus / bridge)は 1小節1発
- section 切替の crash(別経路)はそのまま

~400発 → 推定 ~70-90発。verse はスパース、chorus は drive を維持。crash は
明るく broadband なので、間引きは brightness の harshness も同時に下げる。

stems mode は drum frame 再生を使わない経路 → 原音 無影響。webapp capture は
hang するので offline 計測 + ship-then-verify(実機試聴)。

- `band-room.css?v=br-81`、`band-room.js?v=br-173`、`hazama-fm-v290`。

---

## v289 compact — AI 再現 mix rebalance（ユーザー耳フィードバック起点、harmonic presence 回復）

ユーザー試聴(Human Fly, AI 再現):「最初ベースなって、あとは、ドラムくらいしか
聞こえない」。offline renderer の stem 計測が裏付け:

| stem | rms_db | vs drums |
|---|---|---|
| drums | -23.5 dB | 基準 |
| bass | -29.2 dB | -5.7 dB |
| other (guitar+chord) | **-33.9 dB** | **-10.5 dB** |

event 数: crash **400発**(kick 334 超)/ guitar 228 / chord 116。

**根本原因**: v255(chord を背景 40 に)+ v254(voice OFF)で「bass+guitar 前景」を
**synth drums 前提**でチューニング → v259 で acoustic drums(よりパンチが強い)に
変えて harmonic 前景が埋もれた。cramps-punk の guitar はスパースなので、stab の
合間は drums+bass だけ → 「ドラムばっか」。

**修正**: harmonic presence を戻す rebalance:
- guitar **56 → 70**(bass の前景パートナーとして復帰)
- chord **40 → 52**(背景 wash ではなく "存在する" harmonic bed。v259 で文脈が
  変わったので v255 を部分的に戻す)
- drums **58 → 52**(acoustic punch を一段下げる)
- voice は OFF のまま(v254 の意図を尊重)

`V289_MIX_REBALANCE_MIGRATION` + `MIX_PREFS_VERSION` を `v289-harmonic-presence`
に bump。各パートの未変更デフォルトのみ移行、カスタム値は保持。bus init と
HTML slider 既定も同期。stems mode は全 bypass、原音 無影響。

注: webapp capture は AI 再現 再生で renderer が hang して計測不可なので、
これは offline 計測 + ship-then-verify(実機試聴)。

- `band-room.css?v=br-81`、`band-room.js?v=br-172`、`hazama-fm-v289`。

---

## v288 compact — exciter oversample 4x → 2x（CPU / capture-hang 緩和）

v287 の exciter は `Tone.Distortion` の waveshaper を AI bus 全体に **常時**
掛ける（per-note transient ではない）。oversample "4x" はその分 standing な
CPU コストになり、v287 の webapp capture 中に headless renderer を hard hang
させた（`preview_eval` が `1+1` すら timeout）。弱い mobile 端末でも同じ risk。

修正: oversample "4x" → "2x"。後段の 3.5 kHz high-pass + wet 0.10 があるので
2x でも生成倍音の antialiasing は十分。**air は同じ、exciter CPU は約半分**。

音の意図（brightness 生成）は不変、純粋な perf/安定化 ship。stems mode は
polish bus を bypass、原音 無影響。

- `band-room.css?v=br-81`、`band-room.js?v=br-171`、`hazama-fm-v288`。

---

## v287 compact — AI 再現 high-frequency exciter（EQ では動かせなかった "air" を生成）

v274/v284/v286 と 3 round、`makeInstrumentPolishBus` の EQ high-shelf で
brightness を上げようとして失敗。webapp capture の rolloff は 3 round 通して
~2.5 kHz に張り付き（target 5.3 kHz）。原因（MEASUREMENT-LOOP §5）:

> AI 再現 の音源（acoustic CDN kit + synth band）は元々 3 kHz 以上に
> ほぼ energy が無い。空の帯域を shelf で持ち上げても何も起きない。

修正: **exciter（倍音生成）** を polish bus に parallel 追加。EQ と違い、
既存の 1.8-3 kHz の content を hard waveshaping して **新しい倍音を作り**、
3.5 kHz で high-pass して生成された "air" だけを薄く（wet 0.10）blend する。
3 round の EQ が触れなかった source-level の "正しい knob"。

```js
const exciteIn    = new Tone.Filter({ frequency: 1800, type: "highpass", Q: 0.4 });
const exciteShape = new Tone.Distortion({ distortion: 0.9, oversample: "4x", wet: 1 });
const exciteOut   = new Tone.Filter({ frequency: 3500, type: "highpass", Q: 0.5 });
const exciteWet   = new Tone.Gain(0.10);
// comp → exciteIn → exciteShape → exciteOut → exciteWet → widen（第3の parallel path）
```

comp の後ろから tap（glue 済みの leveled 信号に exciter を乗せる）。wet 0.10 は
fizz/harsh を避ける conservative 値。次 round の webapp capture で rolloff/
centroid の lift を測って wet を調整する想定。

AI-only: stems mode は polish bus を bypass するので 原音 は無影響。

- `band-room.css?v=br-81`、`band-room.js?v=br-170`、`hazama-fm-v287`。

---

## v286 compact — AI 再現 brightness EQ recenter（measurement-driven、v284 over-correction の解除）

v285 の offline renderer（PR #262）で初の browser-free AI 再現 capture を取得。
`scripts/compare-capture.py` が `tabasco/human-fly` に対して出した diff:

| 指標 | AI - target | 評価 |
|---|---|---|
| bpm | +0.0 BPM | ✅ 完全一致 |
| kick pocket avg | -2.2 ms | ✅ ±15 ms 余裕 |
| tempo stability | -2.2 %-pt | △ 微 over (許容) |
| brightness (centroid) | **+863.3 Hz** | ❌ AI bright 過ぎ |
| rolloff p85 | **+1359.3 Hz** | ❌ AI 高域多すぎ |
| dynamic range | +5.4 dB | △ 微 over (許容) |

→ v284 (EQ corner 4200 → 3000 Hz) が逆方向に行き過ぎていた。+3 dB shelf が
3 kHz から効くと、リファレンスより上の信号にも boost が乗る。

修正: `makeInstrumentPolishBus` の EQ3 を 3000 → **3600 Hz** に戻す。

```js
const eq = new Tone.EQ3({ low: -0.8, mid: -0.6, high: 3.0,
                          lowFrequency: 160, highFrequency: 3600 });
```

3600 は v274 (4200) と v284 (3000) の中点。boost 量 (+3 dB) は据置で
single-knob attribution を保つ。次 round の offline render で
brightness/rolloff diff が半分くらいに縮むことを期待。

stems mode (原音) は instrumentBus を経由しないので無影響。

- `band-room.css?v=br-81`、`band-room.js?v=br-169`、`hazama-fm-v286`。

---

## v285 compact — AI 再現 offline renderer + stem variants

Adds a browser-free offline render path for the Human Fly AI recreation loop:

- `scripts/render-bandroom-ai-recreation.py tabasco human-fly` renders deterministic AI recreation `drums/bass/other` stems plus `mix.wav`
- `mix.wav` can be fed directly to `scripts/compare-capture.py` for stable measurement-loop numbers without preview renderer hangs
- Band Room stems mode gets an optional per-song `AI recreation` stem variant, with original stems as fallback for missing parts
- generated audio remains under ignored `presets/ai-recreation-stems/`; original `presets/tabasco-stems/` files are untouched
- v284's AI-only brightness EQ shift is baked into the offline renderer's instrument polish approximation

- `band-room.css?v=br-81`、`band-room.js?v=br-168`、`hazama-fm-v285`。

---

## v284 compact — AI 再現 brightness EQ shift（measurement-driven、rolloff metric）

v283 で `rolloff_p85_hz` を新規追加（`scripts/compare-capture.py`、PR #257）。
autonomous capture で AI 再現 (human-fly, br-167 系) を計測したところ:

| 指標 | AI 実測 | target full-mix | delta |
|---|---|---|---|
| centroid_avg_hz | 1387 Hz | 2402 Hz | -1016 Hz |
| **rolloff_p85_hz** | **2442 Hz** | **5264 Hz** | **-2822 Hz** |
| rms_dynamic_range_db | 9.0 dB | 8.7 dB | +0.3 dB ✓ |

`rolloff` は 85 % の spectral energy がどの周波数以下に収まるかを返す。AI
は 2442 Hz 以下に 85 % が集中 → v274 で +3 dB 持ち上げてた 4200 Hz 以上
の high-shelf は **信号がない帯域をブーストしてた**。

### 修正（band-room.js — `makeInstrumentPolishBus` EQ）

```js
// Before (v274)
new Tone.EQ3({ ..., high: 3.0, highFrequency: 4200 });
// After (v284)
new Tone.EQ3({ ..., high: 3.0, highFrequency: 3000 });
```

`high` boost 量は据え置き（+3 dB）、shelf corner を 4200 → 3000 Hz に移動
だけ。同じ +3 dB が信号の実在する帯域に着くので、centroid / rolloff の
両方が持ち上がる予想。

### 設計判断

- **+ amount は据え置き**: 3 dB を 4 dB に上げる選択肢もあったが、
  shelf 位置の修正だけで効くはず（measurement-driven）。効かなければ
  次ラウンドで boost 量も検討。
- **stems mode 不変**: instrumentBus は AI 専用、stems は stemBus 経由で
  master 直結（ユーザ要望「原音いい感じだから変えないで」遵守）。
- **master EQ 不変**: stems と共用なので触らない。
- **DR は v275 で実測 9.0 vs target 8.7 = ±5 dB 内 OK**、巻き戻しなし。

### 次の検証

- autonomous capture で v283 と同条件再計測 → rolloff が target 寄り
  （4000-5000 Hz 帯）へ動けば成功
- 動かなければ boost 量 +1 dB or 別 instrument レベル EQ で検討

- `band-room.js?v=br-166`、`hazama-fm-v284`。

---

## v283 compact — album plaque and AI lazy-safe boot

Keeps the Band Room original-stem surface responsive on mobile/PWA while leaving
the current mastering defaults unchanged:

- render the single `TABASCO` collection as a non-clickable album plaque
- split START asset prep by mode: original mode loads only current song stems, AI mode loads only enabled AI parts
- bound CDN sampler predecode concurrency and yield between decodes for mobile/PWA
- load Magenta DrumsRNN and `@tonejs/midi` only when their advanced tools are used
- cache bump: `band-room.css?v=br-80`, `band-room.js?v=br-166`

- `hazama-fm-v283`

---

## v282 compact — Tiffany box identity

Tunes the Band Room listening surface around the Air Rock Connect Box identity:

- show `Air Rock Connect Box` once in the header and strip the repeated prefix from the subtitle
- shift the dark UI toward Tiffany-blue air connecting into black-box panels
- refresh the system font stack without adding font dependencies
- align the Band Room manifest theme/background color with the black-box surface
- update the Band Room boot diagnostic app version to `br-165-tiffany-box-ui`
- cache bump: `band-room.css?v=br-79`, `band-room.js?v=br-165`

- `hazama-fm-v282`

---

## v281 compact — airier listening surface

Lightens the Band Room production listening surface:

- remove the visible A/B compare details from the main UI
- simplify `air rock connect box` from colored chips to an airy line
- add a subtle cool-air top glow and a little more vertical breathing room
- cache bump: `band-room.css?v=br-77`

- `hazama-fm-v281`

---

## v280 compact — listening UI polish

Small Band Room surface cleanup for production listening:

- expose the `air rock connect box` identity in the header
- move mastering above the advanced tool details
- label the baseline preset as `neutral default`
- give `neutral default` and `vertical room` distinct chip color cues
- cache bump: `band-room.css?v=br-76`

- `hazama-fm-v280`

---

## v279 compact — vertical-room mastering preset

Renames the A/B room preset to `vertical room` and gives it a more distinct
mastering shape:

- `reverb: 30`
- `width: 60`
- `warmth: 12`
- `loudness: -1`
- intent: less side spread than club/ambient, more top-down room and low-body lift
- cache bump: `band-room.js?v=br-163`

- `hazama-fm-v279`

---

## v278 compact — live-room vertical retune

Retunes `live room` after listening feedback that v277 spread too far sideways:

- `reverb: 22 → 28`
- `width: 74 → 58`
- `warmth: 8 → 11`
- `loudness` stays `-1`
- intent: less left/right width, more room depth and body pressure
- cache bump: `band-room.js?v=br-162`

- `hazama-fm-v278`

---

## v277 compact — Band Room live-room A/B mastering preset

Adds a mastering-only `live room` A/B preset for 原音 listening:

- `reverb: 22`, `width: 74`, `warmth: 8`, `loudness: -1`
- no default migration, no instrument/profile changes, no recorder path change
- cache bump: `band-room.js?v=br-161`

- `hazama-fm-v277`

---

## v276 compact — reference archetype harvest cache bump (docs/reference only)

BL-019b translates archived `test/engine.js` style archetypes into Music
reference-gradient language:

- new metadata shelf: `references/style-archetype-from-test.json`
- new review note: `docs/test-style-archetype-translation.md`
- no Band Room runtime, audio, sample, preset, or UI behavior change

The service worker cache marker is bumped so the new reference JSON is
available offline with the rest of the Music reference shelf.

- `hazama-fm-v276`

---

## v275 compact — AI 再現 dynamic range 復旧（instrumentBus comp 緩和、measurement-driven）

v274 post-ship 再計測で brightness +976 Hz 改善を実証。残ギャップで
最大は DR -21 dB（実 12.3 vs target 33.6）。v275 = 次の measurement-
driven 修正。

### 修正（band-room.js — `makeInstrumentPolishBus`）

```js
// Before
new Tone.Compressor({ threshold: -20, ratio: 2.2, ... });
// After (v275)
new Tone.Compressor({ threshold: -14, ratio: 1.8, ... });
```

- **threshold -20 → -14 dB**: 6 dB 高い → 弱めの音は comp 通過、強い音だけ catch
- **ratio 2.2 → 1.8**: catch しても compression 弱い

### 効果予測

DR は **2 軸 + 1 軸**で拡張可能:
- per-section: v271 で 5 dB swing 確保済
- per-bar / per-transient: ←今 v275 で改善
- master limiter: 触らない（stems と共用）

v275 で per-bar transients が「潰れない」ようになる → kick の attack ピーク、snare の crack が前に出る → DR 増加が期待値。

### scope

- **instrumentBus は AI 再現 のみ**: stems 完全不変、ユーザ要望「原音いい感じだから変えないで」遵守
- v243 の makeup gain 3.0 はそのまま — comp 緩和は makeup 持ち上げ前に効く
- master comp は触らない

### 次（実測検証 + 残課題）

- v276 candidate: 同 autonomous capture で DR 再計測、12.3 → ?? dB
- DR ターゲット 33.6 dB、+5 dB 以上の改善があれば成功判定
- brightness は -2077 Hz 残、追加 +1〜2 dB lift も別ラウンドで検討
- pocket / BPM の半分検出は **長い録音**が必要（短録音 artifact）

- `band-room.js?v=br-159`、`hazama-fm-v275`。

---

## v274 compact — AI 再現 brightness +1.6 dB（実測 -3054 Hz の dimness 是正、measurement-driven）

v272+v273 で計測 loop 完成 → 同セッションで autonomous capture & compare
を実行。**初の AI 再現 vs 原音 数値 diff** で発見:

| 指標 | AI 再現 (実測) | 原音 target | delta |
|---|---|---|---|
| brightness (spectral centroid) | 1528 Hz | 4581 Hz | **-3054 Hz** |
| dynamic range | 8.7 dB | 33.6 dB | -24.9 dB |
| kick pocket avg | +82 ms | +47 ms | +35 ms |

**最大ギャップは brightness** — AI が圧倒的に dull。drum acoustic kit
(v259) の hat sizzle が高域で十分に出てない。

### v274 の修正（band-room.js — `makeInstrumentPolishBus` EQ）

```js
// Before
const eq = new Tone.EQ3({ low: -0.8, mid: -0.6, high: 1.4, ... });
// After (v274)
const eq = new Tone.EQ3({ low: -0.8, mid: -0.6, high: 3.0, ... });
```

`high` シェルフ `+1.4 dB` → `+3.0 dB`（**+1.6 dB 追加**）。highFrequency
は 4200 Hz のまま。hat / cymbal / acoustic guitar の倍音帯を持ち上げる。

### 設計判断

- **instrumentBus EQ のみ変更**: stems 経路は別 (stemBus → master 直結)、
  完全不変。ユーザ要望「原音いい感じだから変えないで」遵守。
- **master EQ には触らない**: master は stems + AI 共用、ここを触ると
  stems も変わる。NG。
- **+1.6 dB は conservative**: -3054 Hz ギャップは EQ だけで埋まる差では
  ないが、まず polish bus で改善し、足りなければ次ラウンドで追加検討。
  EQ 過度なら hat が刺さるので段階的に。

### 注意点（計測の限界）

target spec は drum stem のみで生成、AI capture は **full mix** (drum +
bass + guitar + chord pad)。full mix は bass + chord pad で centroid が
naturally lower なので、-3054 Hz の一部は「比較の不公平」由来。次の
tooling 改善（v275+: target を full-mix で再生成）で公平化予定。それでも
+1.6 dB の brightness 向上自体は perceptual に効くはず。

### 次の手

- **実機 AB**: 「ハイハット聞こえる」「シャリッとした」なら成功 / 「刺さる」なら +1.0 dB に下げる
- 残ギャップ大: DR -24.9 dB → v275 candidate (section dynamics 更に拡大 or comp 緩和)
- tooling: target spec を full-mix で再生成（v276?）して公平比較

- `band-room.js?v=br-158`、`hazama-fm-v274`。

---

## v272 compact — ● REC を WAV 出力に変更（計測 loop が ffmpeg なしで完成）

プランニング `[E] 計測 loop セットアップ` の最終ピース。ユーザ install
を最小化する方向で実装:

### 背景

v224-v225 で計測 loop の道具一式（`scripts/analyze-band-stems.py`、
`scripts/compare-capture.py`、`docs/MEASUREMENT-LOOP.md`、target-spec
JSON）は揃った。band-room ● REC ボタンも v81 から存在。しかし**録音
出力が `.webm`（opus codec）で librosa が ffmpeg なしには読めなかった**。

選択肢は2つ:
- A. ユーザに `winget install Gyan.FFmpeg` を実行してもらう
- B. ブラウザ内で webm を WAV に変換して download する

B を採用 — ユーザ install ゼロで loop 完成。

### v272 の修正（band-room.js）

1. **`audioBufferToWavBlob(audioBuffer)`** ヘルパ追加（~50 行の標準
   WAV エンコーダ、PCM 16-bit interleaved、Web Audio AudioBuffer 入力）
2. **`stopRecording()`** を async 化、`.webm` blob → `AudioContext.
   decodeAudioData` → AudioBuffer → WAV blob → download
3. ファイル名は `.webm` → **`.wav`** に変更（`band-room_<band>_
   <song>_<timestamp>.wav`）
4. **decode 失敗時のフォールバック**: webm そのままダウンロード
   （古いブラウザや codec 問題時に救命）+ console.warn

### 完成した計測 loop

```
[1] band-room.html で AI 再現 を選択 → 曲選択 → ● REC
[2] 30秒+ 再生 → ■ STOP REC → ↓ download .wav
[3] python -X utf8 scripts/compare-capture.py rec.wav tabasco/human-fly
[4] 数値 diff 出力（BPM、kick pocket、locked %）
```

ffmpeg / mcp-music-analysis / その他外部 tool すべて不要。
Python + librosa 入った PC さえあれば動く。

### docs/MEASUREMENT-LOOP.md 更新

「ffmpeg note」セクションを「Format note (v272)」に書き換え、wav
直接 download の説明と decode 失敗時 fallback を追記。

### 影響

- 原音 (stems) 不変
- AI 再現 再生 / 音色 / groove すべて不変
- ● REC ボタンの挙動だけ変更（出力 format のみ）
- WAV ファイルサイズは webm より 5-10 倍大きい（PCM 非圧縮）が、計測
  目的なら数十秒だけ録ればよく問題なし

### 次の手（計測 loop が動くようになった後）

- 実機 PWA で ● REC → wav 取得 → `compare-capture.py` で**実数値検証**
- v264 push -10ms の妥当性確認
- v271 section dynamics の発火を verify（target spec に section role 別の
  RMS データも追加できる）
- mcp-music-analysis install すれば私が会話中に直接解析可能（任意）

- `band-room.js?v=br-157`、`hazama-fm-v272`。

---

## v271 compact — AI 再現 section dynamics 拡幅（v220 ±10% → ±47%、verse/chorus contrast を出す）

v270 で生音 5/5 が成立した後、ユーザー実機 AB: 「vocal 以外なってる、
とりあえず」+ 「やるべきこと進めて、よくする候補プランニングから」。
プランニングで `[A] structure / arrangement` カテゴリを選択 → A-1
（section dynamics 強化）を単独 ship。

### 背景

v245-v270 までで texture（音色）と groove（pocket）は詰めた。
構成（structure）の不在が「procedural は止まらない loop」感覚の主因。
v220 で section role → bus gain mapping は導入済だが、range が
`0.85〜1.05` (±10%) と控えめで「dynamics があるはずだが目立たない」
状態だった。

### v271 の修正（`band-room.js`）

`sectionGainForRole` の ROLE_GAIN テーブルを拡幅:

| role | v220 | v271 | dB delta | 意図 |
|---|---|---|---|---|
| **intro** | 0.85 | **0.62** | -2.7 dB | 雰囲気的な entrance |
| **verse** | 0.95 | **0.80** | -1.4 dB | settled, vocal/melody の余地 |
| **comp** | 1.00 | 0.95 | -0.4 dB | 中庸 |
| **recap** (chorus) | 1.05 | **1.05** | 0 dB | **lifted、ここは据え置き** |
| **break** | 0.85 | **0.58** | -3.3 dB | dramatic dip、息継ぎ |
| **outro** | 0.92 | 0.72 | -2.2 dB | winding down |
| head/post/swell | 0.92-1.00 | 0.82-0.95 | -0.6〜-1.4 dB | 細かな彩り |

新スプレッド: 0.58 〜 1.05 = **47%（≒5 dB swing）**、v220 の 20% (2 dB) から倍以上。

### 設計思想：comp threshold を超えない方向に振る

instrumentBus の glue comp は threshold -20 dB、ratio 2.2:1。**ループ
量が下がる方向**は comp 域から外れるので perceived loudness drop が
大きい（4-5 dB 落ちる）→ contrast を稼ぐ。**ループ量が上がる方向**は
comp に飲まれて perceived は半減 → recap は +0.4 dB の小幅 lift のみ。

これで pumping artifact なしに「verse 静か → chorus 立ち上がる」の
体感を作る。

### 影響範囲

- 原音 (stems) 不変: instrumentBus は AI 再現 経路のみ通る
- master チェーンへの影響なし: master limiter (-1 dB) は触らない、loud
  section の peak は変わらない
- 既存ユーザの slider 設定不変: instrumentBus は code-level、ユーザ
  vol スライダはその下流
- CPU 影響なし: 既存の linearRampToValueAtTime を使うのみ

### 次の手（実機 AB 次第）

- 「dynamics 効いてる、いい感じ」 → A-2 (part 入退場) へ
- 「verse 静かすぎる」 → verse 0.80 → 0.85 に微調整
- 「dramatic すぎる」 → 全体的に center 寄りに収束
- 「他の感じ薄い」 → B (per-profile push 細分化) など別レイヤーへ

- `band-room.js?v=br-156`、`hazama-fm-v271`。

---

## v270 compact — Tone.js v14.8.49 loader バグ回避（jsDelivr 由来 Sampler を手動 pre-decode）

ユーザー実機 AB: 「drum 以外は chord だけ聞こえる。bass、guitar、vocal が
聞こえない」。

### 原因（preview で再現確定）

Tone.js v14.8.49 の `ToneAudioBuffer.load(url)` が **cdn.jsdelivr.net 由来
の mp3 URL で必ず失敗**。エラーログ:

```
[Band Room] Tone.loaded() rejected: Error: could not load url:
  https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/.../E2.mp3
```

同じ URL を:
- `fetch()` で読み込む → 200、260 KB 取得 OK
- `XMLHttpRequest` (Tone も内部で使用) → 200、260 KB OK
- `AudioContext.decodeAudioData(buffer)` → duration 10.87 s、デコード OK
- `Tone.context.decodeAudioData(buffer)` → 同様 OK
- `Tone.ToneAudioBuffer.load(url)` → ❌ "could not load url"

→ Tone.js loader の特定の挙動（リトライ、タイムアウト、コーデック判定の
どれか）が jsDelivr のレスポンスで NG。`tonejs.github.io/audio/...` 経由の
salamander-piano は通るので chord は鳴っていた。bass-electric + guitar-
acoustic（共に jsDelivr 経由）だけが silent → 表面化。

### v270 の修正（band-room.js）

`makeVelocitySensitiveSampler` を **async** に変更、内部で **Tone の loader
を完全バイパス**:

```js
async function preloadSamplerUrls(urls) {
  const preloaded = {};
  await Promise.all(Object.entries(urls).map(async ([note, url]) => {
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const audio = await Tone.context.decodeAudioData(ab);
      preloaded[note] = new Tone.ToneAudioBuffer(audio);  // 既デコード状態で wrap
    } catch (e) { console.warn(...); /* skip — Sampler interpolates */ }
  }));
  return preloaded;
}
async function makeVelocitySensitiveSampler(opts) {
  const preloaded = await preloadSamplerUrls(opts.urls);
  const sampler = new Tone.Sampler({ urls: preloaded, ... });  // pre-decoded を渡す
  ...
}
```

`Tone.Sampler` は `urls` map の値として URL 文字列 / AudioBuffer /
ToneAudioBuffer どれでも受ける（バッファ渡しなら内部 loader はスキップ）。
preview で再検証: salamander + nbrosowsky 両方とも load OK、bass/guitar
の Sampler が triggerAttackRelease で音を出す。

### 連鎖更新

`makeVelocitySensitiveSampler` を async にしたので、これを呼ぶ 4 つの
maker (`makeSynthBass`, `makeGuitar`, `makeVoiceBox`, `makeChordSynth`)
を全部 async 化、`startPlayback` と instrument-selector / profile-apply
ハンドラの計 11 箇所で `await` を付与。`makeClick` は sample 不要なので
sync のまま。`buildKitForSource` (drums online kit) は既に await 済。

### 影響

- 初回再生で全 Sampler サンプルを **並列 fetch+decode**（17 + 11 + 30 =
  ~58 ノート、合計 ~10 MB）。並列実行なので 5-10 秒で完了。SW キャッシュ
  後はオフライン instant。
- v268 の `await Tone.loaded()` はそのまま（drums の `buildBaseKit` 内部の
  Tone.loaded() を待つのに必要）。
- 原音 (stems) 不変、master 不変。
- v245-v269 の全ての音色 / groove / volume 改善が effective に。

### 教訓

「Sampler が silent」を 3 段階で疑え:
1. URL serv 可能？ (HEAD-check)
2. fetch + decodeAudioData 通る？
3. Tone.ToneAudioBuffer.load 通る？

3 だけ落ちるなら Tone 側のローダ問題 → 手動 pre-decode で回避可能。

- `band-room.js?v=br-155`、`hazama-fm-v270`。

---

## v269 compact — AI 再現 Sampler 系の volume を +2〜3 dB 持ち上げ（drum dominance 解消）

ユーザー実機 AB: **「drum 以外の音が小さすぎる。バランス悪い。原音は一応
いい感じだから、そこまでパラメータ変更等で変にはしないように制御」**。

### 原因

v267 で bass-electric、v265 で guitar-acoustic、v262 で salamander-piano
を AI 再現 デフォルトに切替えた結果、bass/guitar/chord の**音源が
synth → Sampler に置換**された。各 Sampler の volume は v101/v126 期に
synth fallback path とのバランスを取って計測されてたが、**実楽器の
自然 decay envelope は synth の sustained 出力より perceived RMS が
低い**ので、drum 比で薄く聞こえる。

### v269 の修正（band-room.js — Sampler path の volume のみ）

| Sampler | volume 旧 | volume 新 | lift | 理由 |
|---|---|---|---|---|
| bass (`makeSynthBass`) | -4 dB | -2 dB | +2 dB | electric bass の attack が短く drum 比で薄い |
| guitar (`makeGuitar`) | -6 dB | -4 dB | +2 dB | acoustic guitar の decay が synth 比で短い |
| chord (`makeChordSynth`) | -8 dB | -5 dB | +3 dB | Salamander piano は最も decay が早く、synth pad との差が大きい。ただし pad は依然 background （v255/v257 の意図維持） |

### 影響範囲

- **原音 (stems) は完全に不変**: Sampler path は AI 再現 mode の `state.<x>Instrument && state.onlineCatalog` 条件で初めて使われる経路。stems は stemBus 経由で master へ、Sampler を通らない。
- synth fallback path も不変: 各 maker の末尾の synth instantiation の volume はそのまま。ユーザが dropdown で "synth" を選んだら従来通り。
- master / limiter チェーンも不変。
- ±3 dB 程度なので headroom 内に収まる（master limiter threshold -1 dBFS）。

### 教訓

「Sampler 化したら別の calibration が要る」も Tone.js のお決まり問題。
v101/v126 期 calibration は synth との単独 A/B だったので、cross-source
比較が想定外だった。

CPU 影響なし（dB スケール変更のみ）。

- `band-room.js?v=br-154`、`hazama-fm-v269`。

---

## v268 compact — Sampler 全部の Tone.loaded() 待ちを `startPlayback` で追加（v267 で表面化した silent-failure 修正）

ユーザー実機 AB 報告: **「ドラムしか聞こえてこない」**。v267 で bass を
bass-electric Sampler に切替えた瞬間に表面化した既存バグ。

### Root cause

`startPlayback` の流れ:

```
ensureMaster()
drumKit = await buildKitForSource(...)  // ← drums は内部で await Tone.loaded()
synthBass = makeSynthBass(bassBus)      // ← await なし
guitarSynth = makeGuitar(guitarBus)     // ← await なし
voiceSynth = makeVoiceBox(voiceBus)     // ← await なし
chordSynth = makeChordSynth(chordBus)   // ← await なし
clickSynth = makeClick(clickBus)
await backgroundBridgeStart
// → Transport.start() / bar callback 開始
```

`makeSynthBass` 等は Tone.Sampler を**同期返却**するだけで内部で
Tone.loaded() を待ってない。bar callback が走り出した瞬間に
`sampler.triggerAttackRelease(...)` が呼ばれる → 17 ノートの CDN
サンプルがまだ未デコードなので**音が出ない**。

- v265 以前: bass はそもそも synth fallback path（Sampler じゃない）
  だったので load 待ちが要らず音が出ていた
- v262 chord (Salamander piano) も同じバグだったが、chord 初回 onset
  が遅い + Tone.Sampler の queue 機能でかろうじて間に合っていた可能性
- v267 bass-electric デフォルト化で bass 初回 onset が bar 0 sub 0
  (super early) に変わり、決定的に間に合わなくなった

drums だけ鳴っていたのは `buildBaseKit` の `await Tone.loaded()` で
ガード済だったから。

### v268 の修正（`band-room.js` `startPlayback`）

全インストルメント作成後に **1 回 global `await Tone.loaded()`** を
追加。これで bass / guitar / chord / voice の Sampler 全部のサンプル
ロード完了を保証してから bar callback 開始。

```js
if (!clickSynth) clickSynth = makeClick(clickBus);
await backgroundBridgeStart;

// v268: ...全 Sampler のロード待ち...
try { await Tone.loaded(); } catch (e) {
  console.warn("[Band Room] Tone.loaded() rejected:", e);
}
```

`Tone.loaded()` は AudioContext 内の全 Buffer の load を待つので、
maker 関数を async に書き換える必要なし。drums が既に同じパターンで
動いてるので副作用なし。

### 副次効果

- v262 chord、v265 guitar 起動時の「初回 onset が薄い／silent」現象も
  同じ理屈で解消するはず（実機で確認推奨）
- 初回 Play で 5-10 秒の load 待ち時間が visible に出る可能性
  （`WARMING UP` ボタン状態の延長）。SW キャッシュ済なら instant。

### 教訓

「Sampler 化したら鳴らなくなる」は Tone.js の典型的な落とし穴。drums
が動いてるのに他が silent → load 待ちの有無を疑う、を audit リストに
追加候補。

原音 (stems) 不変。CPU 影響なし（1 回の Promise await のみ）。

- `band-room.js?v=br-153`、`hazama-fm-v268`。

---

## v267 compact — bass-electric を復活（catalog バグ修正で生音 5/5 達成）

ユーザー指摘:「残 1 = CDN 物理破損で打てない、はクリアせんくていいの？」
→ 真因を再追跡: **CDN 物理破損ではなく v97 catalog の note 名規約ずれ**
だった。github API で nbrosowsky/tonejs-instruments の master 実ファイル
リスト確認 → catalog の登録ノートと不一致発覚 → 補正で全 17 ファイル
servable に。

### v231「unservable」の真因

| v97 catalog 登録 | 実在ファイル | HEAD 結果 |
|---|---|---|
| `bass-electric` `E1, F#1, A1, C#2, E2, F#2, A2, C#3, E3` (9) | `A#1-4, C#1-5, E1-4, G1-4` (17) | 9 中 5 のみ servable（残 4 が 403：F#1/A1/F#2/A2）|
| `guitar-electric` `E2-A5` 13 ノート | `A2-A5, C3-C6, C#2, D#3-5, E2, F#2-5` (17) | 13 中 8 のみ servable（残 5 が 403：C#3-C#5, E3, E4）|

→ jsDelivr が 403 を返してたのは upstream に**そのノート名のファイルが
存在しない**から（raw.githubusercontent.com も 404、authoritative）。
catalog が間違ってただけ。

### v267 の修正

1. **`presets/online-samples-catalog.json`**: bass-electric / guitar-
   electric の `notes` ブロックを実在 17 ファイルに整合（A#/C#/E/G pattern
   for bass、A/C/C#/D#/E/F# pattern for guitar）。HEAD 検証: 17/17 200。
2. **`band-room.js`**:
   - `state.bassInstrument`: `null` → `"bass-electric"`
   - `applyPrefs` の v231 `bassInstrument === "bass-electric" → null`
     強制を**削除**（v265 で guitar に対してやった処置と同形）
   - `MIX_PREFS_VERSION`: `v265-guitar-acoustic` → `v267-bass-electric`
   - `V267_BASS_INSTRUMENT_MIGRATION { null/"" → "bass-electric" }` 新設
3. **`scripts/check-band-room-logic.mjs`**: v231 assertion を新方針に
   追随（bassInstrument 既定 "bass-electric"、強制 null 化削除を assert）。

### AI 再現 baseline 最終形（**生音 5/5 達成**）

| パート | 音源 | 経緯 |
|---|---|---|
| drums | 🌐 acoustic CDN kit | v259 |
| **bass** | 🌐 **electric bass CDN** | **v267 ← 今**、catalog 修正で復活 |
| guitar | 🌐 acoustic CDN | v265 |
| chord | 🌐 Salamander Grand Piano | v262 |
| voice | OFF | v254 |

→ **5 パート全てが実録音サンプル**（voice は明示的に OFF、必要なら
ドロップダウンで synth ON 可能）。ユーザの「音色は、生音方面には持って
いけない？」要望は完全達成。電子要素は AI 再現 デフォルトから消えた。

### 教訓

「CDN 物理破損で打てない」は**早すぎる結論**だった。v231 の audit が
catalog の note 名 vs 実ファイルの整合を確認しなかったため、5 年近く
synth bass で代用していた。実 HEAD-check + github API 照合の auto
化（将来 audit ツール化候補）。

### 影響

- 初回 online 再生で bass-electric 17 ファイル fetch（~5 MB）、SW
  キャッシュ後はオフライン instant。chord (Salamander) + drums (tone-
  acoustic) + guitar (acoustic) と同じ Sampler 経路、新規 CPU 負荷なし。
- 既存ユーザ:
  - 元々 null (v231 強制 null) → v267 migration で "bass-electric" に
  - 自分で別 instrument を選んでた人 → そのまま
- 原音 (stems) 不変。

- `band-room.js?v=br-152`、`hazama-fm-v267`。

---

## v266 compact — online catalog race を `startPlayback` で吸収（silent synth fallback 防止）

v261 監査で deferred にしていた残課題:「`online/tone-acoustic` 初回ロード
レース — catalog 未ロード時に synth へ silent fallback」。v259/v262/v265
で defaults を CDN サンプル前提にしたので、この silent failure は**最
重大の矛盾**になっていた。

### 失敗シナリオ

1. ページ起動 → `loadOnlineCatalog()` の fetch 開始（DOMContentLoaded
   で await されている）
2. fetch がネットワーク blip / 404 / オフライン初回で失敗 →
   `state.onlineCatalog` は null のまま
3. ユーザが Play クリック → `startPlayback` → `buildBaseKit("online/
   tone-acoustic")` → catalog null → `kitDef` not found → silent fall
   back to synth drums
4. 同様に chord (Salamander piano) / guitar (acoustic) も synth へ
5. ユーザは「v259 acoustic にしたはずなのに synth で鳴ってる」と
   分からず混乱

### v266 の修正（`band-room.js` `startPlayback` 直後）

```js
// v266: ensure the online-samples catalog is loaded before any kit /
// instrument is built. ... retry once on-demand; if still failing,
// surface the reason in the kit status so it isn't silent.
if (!state.onlineCatalog) {
  try { await loadOnlineCatalog(); } catch (e) {}
  if (!state.onlineCatalog) {
    const kitStatus = $("br-kit-status");
    const msg = "⚠️ online catalog unavailable — CDN instruments will fall back to synth";
    if (kitStatus) kitStatus.textContent = msg;
    console.warn("[Band Room] startPlayback:", msg);
  }
}
```

### 効果

- 通常パス（catalog 起動時に読めた）: no-op、性能影響なし
- レース／blip 後の Play: 1 回 retry で大体救済（fetch 200ms ＋ Tone.start
  が並行）→ acoustic drums で鳴る
- 真にオフラインで catalog 完全不可: synth fallback だが**理由が UI に
  出る**（`br-kit-status` ＝ "⚠️ online catalog unavailable..."）

### 監査 deferred の整理

v261 で挙げた 3 件:
- ~~voice 関連 FX スライダ disabled 化~~ → 再確認したら `br-vfx-*` は
  stems mode の **vocal stem 用 FX**（`data-scope="stems"`）で AI 再現
  voice toggle とは無関係。v261 の解釈ミスだった、対応不要。
- **online catalog race fallback** → v266 で対応 ✓
- ~~kit_profile invisibility when kitSource is acoustic~~ → design intent
  通り（kit_profile は synth モードのみ効くのは正しい）、対応不要。

→ v261 audit findings は v266 で完全 clear。

原音不変、CPU 影響なし（1 回の awaited fetch のみ、しかも 通常パスは
no-op）。

- `band-room.js?v=br-151`、`hazama-fm-v266`。

---

## v265 compact — AI 再現 guitar をデフォルト acoustic CDN サンプルに（v231 再監査）

ユーザー指示「進めて」+ v262 で残課題に挙げた「bass-acoustic / guitar-
acoustic CDN 検証」。2026 再監査の結果、**v231 の "unservable" 判定が
guitar 側は古い**ことが判明:

| 候補 | 2026 再監査結果 | 判定 |
|---|---|---|
| `guitar-acoustic` | **11/11 ノート HTTP 200** | ✅ 安全にデフォルト化 |
| `guitar-nylon` | 11/11 OK | ✅ 選択肢として有効 |
| `guitar-electric` | 8/13 OK（midrange C#3/E3/C#4/E4/C#5 が 403）| ⚠️ Sampler 補間で動く、デフォルト不適 |
| `bass-electric` | 5/9 OK（**bass core range の F#1/A1/F#2/A2 が 403**）| ❌ v231 判定維持、synth bass 継続 |

### v265 の修正（band-room.js）

1. `state.guitarInstrument`: `null` → `"guitar-acoustic"`
2. `state.bassInstrument`: そのまま `null`（bass-electric の gap は補間
   困難な bass core range なので synth を維持）
3. v231 の `guitarInstrument === "guitar-electric"` 強制 null 化を**削除**。
   8/13 servable + Sampler 補間で実用可能、ユーザがドロップダウンで
   guitar-electric 選んだら永続するように。bass の v231 強制 null 化は
   そのまま（bass-electric は依然 broken）。
4. `MIX_PREFS_VERSION`: `v262-piano-chord` → `v265-guitar-acoustic`
5. `V265_GUITAR_INSTRUMENT_MIGRATION`: 保存済み null/"" → "guitar-acoustic"。
   v262 chord migration と同パターン。
6. `scripts/check-band-room-logic.mjs`: v231 assertion を更新（acoustic
   デフォルト + v231 強制 null 化削除を assert）。

### AI 再現 baseline 最終形（v245-v265 累積）

| パート | 音源 | 経緯 |
|---|---|---|
| drums | 🌐 acoustic CDN kit | v259 |
| bass | synth fat saw | v245 (bass-electric は依然 broken) |
| **guitar** | 🌐 **acoustic CDN** | **v265 ← 今 PR**、v231 deprecation を再監査で訂正 |
| chord | 🌐 Salamander Grand Piano | v262 |
| voice | OFF | v254 |

→ **5パート中4パートが生音サンプル**、synth は bass のみ（CDN 物理的に
不可なので合成で対応）。「生音方面に持っていけない？」のユーザ要望
ほぼ達成。

### 影響

- CPU: Tone.Sampler 1 つ追加。chord (Sampler) + drums (online kit) は
  既存、guitar も Sampler 化で系統一致、追加負荷は限定的。
- ネットワーク: 初回オンライン再生で guitar-acoustic 11 ファイル fetch
  (~2.8 MB)、SW キャッシュ後はオフライン instant。
- 既存ユーザの guitar 設定: v231 で強制 null されてた人は v265 で
  acoustic に migrate。v265 後にドロップダウンで guitar-electric を
  選んだら永続。

- `band-room.js?v=br-150`、`hazama-fm-v265`。

---

## v264 compact — AI 再現 bass lock に**実測根拠の push -10ms**（cramps-punk）

`scripts/analyze-tabasco-stems.py`（前回追加）で 6 Tabasco 曲を計測した
結果、**bass onset が kick より平均 7-16ms 早い**ことが定量化された
（cramps-punk の「前のめり」feel）。v249 は snap を `delta=0`（kick
ぴったり）にしていたので、ロックはしているが**push を再現できてなかった**。
これを実測値で補正。

### 計測結果（avg ms bass-from-kick、負=早い）

| song | offset | lock % |
|---|---|---|
| hey | -16.4 | 58% |
| i-got-a-feeling | -11.5 | 59% |
| under-the-moon | -11.4 | 52% |
| electric-sheep | -11.5 | 49% |
| human-fly | -8.9 | 42% |
| sister | -7.4 | 50% |
| **mean** | **-11.2** | ~52% |

メジアン -11.5ms、平均 -11.2ms、conservative 化して **-10ms** を採用。

### v264 の修正（`triggerBassAgent`）

profile-aware の `BASS_PUSH_BY_PROFILE`:
- `cramps-punk`: **-0.010 sec**（実測根拠の Tabasco push）
- `default` / `sakanaction` / `lcd-motorik` / `lofi-nujabes`: **0**（未計測、変更なし）

snap path のみ適用:
```js
if (nearestKick !== null && nearestDelta <= SNAP_WINDOW_SEC) {
  baseOffset = nearestKick + bassPushSec;  // ← was: nearestKick
}
```

snap window 外（>50ms = 意図的 syncopation）はそのまま、push は付かない。
guitar lock (v250) は未変更 — 計測データなし、保守的に保持。
（バンド演奏的にも「bassist が前、guitarist が kick とジャスト」は妥当）

### 設計思想の転換点

v245-v262 は推測ベースの調整、v264 は**実曲計測根拠の調整**。これ以降の
groove 改善は target-spec-tabasco.json の数値を見て判断 → 「グルーブない」
を ms 単位で具体化できる。

原音不変、CPU 影響なし（純粋なスケジューリング数値）。

- `band-room.js?v=br-149`、`hazama-fm-v264`。

---

## v263 compact — Hazama FM 「pre-surge build」追加 (build → drop ペア完成)

v258 で surge エントリに drop を入れたが、先立つ build (riser / crescendo)
が無く DJ パターンの半分だけだった。v263 で build を追加 → flow セクション
の最終 2 小節で pad swell crescendo が乗り、surge bar 1 の drop に向けて
明確な「something is coming」モーメントを作る。

### v263 の追加(engine.js、新規機構)

- `SectionState.buildCue` フィールド新設 (0-1 の crescendo intensity)。
- `advanceSection`: 次のセクションが surge かつ `barsLeft` が 2 または 1 のとき
  `buildCue` を 0.5 → 1.0 に設定。それ以外は 0 にリセット。
- `triggerSurgeBuild(step, time, context)` 新関数 (`triggerSurgeDrop` の隣):
  - `step === 0 && buildCue > 0` で発火。
  - **pad 1-bar swell** (random haze chord、vel 0.07→0.10 が intensity に応じて上昇)
  - 最終 build bar (intensity ≈ 1.0、v256 fill と重なる) で追加の
    **drumSkin sweep** (vel 0.10) ＝ snare-roll 風のエッジを足す
  - `markMixEvent` で governor 通知
- `scheduleStep` の trigger 列に `triggerSurgeBuild` を追加 (`triggerSurgeDrop` の直前)。
- `stopPlayback` で `buildCue = 0` も reset (v260 の dropCue reset と同じ理由)。

### サウンドシーケンス

```
flow の最終 4 小節:
  bar -4: 通常 flow
  bar -3: 通常 flow
  bar -2 (barsLeft=2): buildCue=0.5 → pad swell (vel ~0.07)
  bar -1 (barsLeft=1): buildCue=1.0 → pad swell (vel ~0.10) + v256 fill
                      + drumSkin sweep + cueSectionIdent
  --- セクション境界 ---
surge bar 1: 【DROP!】 v258 — kick stab + sub808 + crash + acid cue
```

surge cycle は ~90 小節 ≈ 3.5 分に一度。**3 小節の dramatic sequence
(build → fill → drop)** が cycle ごとに pre-planned anchor として立つ。
「ふっと出会う」モーメントが engine 側で確実に提供される構造へ。

- `engine.js?v=fm-115`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v263`。

Band Room 不変。

---

## v262 compact — AI 再現の chord を生ピアノ（Salamander Grand）にデフォルト化

ユーザー: 「進めて。既存の指示を整理しつつ、最適ゴールを目指して」。

**整理した最適ゴール**: 新規ユーザが PWA を開いて即「生バンド感」で
Tabasco を聴ける。原音は安全な baseline、AI 再現は生音方向の創造的再現。
矛盾・無音バグなし。

v259 で drums を acoustic CDN kit に、v261 で UX 整合性を取った。残る
最大の「synth fake」要素は **chord pad の PolySynth**（4-piece の唯一の
electronic 要素）。salamander-piano CDN サンプル（既に lo-fi / ambient
master preset で実証済み、Tone.Sampler 経路）に切り替えれば、harmonic
foundation も生音になる。

### v262 の修正（band-room.js）

1. **`state.chordInstrument` の初期値**: `null`（v101 synth fallback）→
   `"salamander-piano"`。
2. **`MIX_PREFS_VERSION`**: `v259-acoustic-drums` → `v262-piano-chord`。
3. **`V262_CHORD_INSTRUMENT_MIGRATION`**: 既存ユーザの `chordInstrument`
   が `null` or `""` なら `"salamander-piano"` に migrate。null/"" 以外
   （他カタログ instrument を明示的に選択）はそのまま。
4. **`scripts/check-band-room-logic.mjs`**: 新バージョン文字列に追随。

### 経路の確認

- `makeChordSynth` の v101 分岐（line 2276 area）が `state.chordInstrument`
  + `state.onlineCatalog.instruments` を見て **Tone.Sampler with CDN
  samples** を作る。既に lo-fi / ambient master preset で動作実証済み、
  新規コード不要。
- v257 の chord pad whole-note sustain と相性◎: piano は natural decay
  arc を持つので "1n" trigger で chord が小節を rang out → 機械的 pad
  flat から脱却。
- v230 の SW キャッシュが Salamander サンプルを保持 → 初回 online 再生
  後はオフラインも instant。
- `makeVelocitySensitiveSampler` で velocity 感応（line 2285）— v252
  humanize ±10% の breath が piano の dynamics に反映される。

### 影響

- AI 再現 baseline = **drums (acoustic) + bass (synth fat) + guitar
  (synth power-chord) + chord (real piano)** + voice OFF。電子要素は
  bass + guitar（v231 で electric サンプル unservable と確認済み）。
- 原音不変。CPU: Tone.Sampler は per-note polyphony 動的、chord は
  1 onset/bar + decay overlap なので軽量。
- 初回 online 再生で Salamander 全鍵盤を fetch（~数 MB）、SW キャッシュ
  後はオフライン instant。

### 残課題（次 round 候補、順位順）

1. **bass-acoustic / guitar-acoustic CDN サンプルの再検証** — v231 で
   electric が unservable と判定したが、acoustic / nylon は catalog
   登録あり、未検証。動けば bass + guitar も生音化可能 → AI 再現が
   ほぼ完全に生バンド構成に。
2. **voice FX スライダの disabled 化**（v261 で見送り）— chorus /
   delay / reverb も voice 関連スライダ、voice OFF 時は disable。
3. **online catalog 初回ロードレース** — Play まで未ロードだと silent
   synth fallback。`buildBaseKit` に UI トースト追加。
4. **mode toggle のラベル**「AI 再現」→ もっと直感的な日本語（要検討）。

- `band-room.js?v=br-148`、`hazama-fm-v262`。

---

## v261 compact — AI 再現の**デフォルト整合性**と**動線**を整える（監査パス）

ユーザー: 「デフォルトで、一番の推奨挙動なるようにしてね。あと、使いや
すい、わかりやすい導線で。他、矛盾や音ならないエラーが結構きつかった
ので、これまで。見直し、見返し、全体確認もよろしくね」。

監査エージェントで band-room.js / .html / bands.json / changelog の整合性
を全 sweep。発見した「v259 までの蓄積で生じた矛盾／UX 不整合」を v261
で吸収。

### v261 の修正（band-room.js / bands.json / scripts/check-band-room-logic.mjs）

1. **kit dropdown のラベル整合**
   - `KIT_OPTIONS` 先頭に `online/tone-acoustic` を `🌐 acoustic kit
     (生音, default)` ラベルで追加。dropdown を開いたとき**実際の
     デフォルトが明示**される（以前は state 初期値だけで、UI 上は
     synth エントリの "(default)" 表示が嘘になっていた）。
   - synth エントリのラベルを `(default)` → `(legacy)` に。v259 で
     既定の座を譲ったので "(default)" 表記は事実誤認。
   - `renderKitOptions` で local KIT_OPTIONS と online-catalog の
     dedupe を追加 — tone-acoustic を両所から二重表示しない。
2. **MASTER_PRESETS["neutral"] の罠を解消**
   - `kit_source: null`（= "現在の値を維持"）だった → "neutral" preset
     を適用すると v259 の acoustic デフォルトが**消える silent UX bug**。
     `null` → `"online/tone-acoustic"` に変更し、neutral preset 適用後
     も生音ドラムが続く。
3. **bands.json: Tabasco の `kit_profile_default` を整合**
   - `"default"`（無味の汎用 profile）→ `"cramps-punk"`（バンド名通り
     cramps スタイル）。Human Fly track が既に cramps-punk に override
     していたので（line 70）、バンド既定をそれに合わせる。synth モード
     にした時のみ効くが、整合性向上。
4. **voice トグル OFF 時に voice vol スライダを `disabled`**
   - v254 で voice 既定 OFF にしたが、voice vol スライダは draggable
     のまま「動かしても鳴らない」状態だった → `<input disabled>` で
     ブラウザがネイティブにグレーアウト＋入力ブロック。CSS 追加なし。
5. **gate assertion 追随**
   - kit label / Tabasco profile の assertion を新値に更新。

### 監査で見送った（影響小、別 round 候補）

- voice synth と関連 FX スライダ（chorus/delay/reverb 等）のグレーアウト
  までは未実装。voice vol の disabled だけで「動かない」最大原因は解消。
- `online/tone-acoustic` の初回読み込みレース（catalog 未ロード時に
  synth へ silent fallback）。`buildBaseKit` の console.warn は既出。
  別 round で UI トースト化検討。
- kit_profile は kitSource=synth のみ効くので、acoustic デフォルトの
  ユーザには Tabasco profile change は不可視。整合性のみの修正。

原音不変。CPU 影響なし。プレフ migration 追加なし（v261 は default 値の
swap だけで saved state を触らない）。

- `band-room.js?v=br-147`、`hazama-fm-v261`。

---

## v260 compact — Hazama FM v258 監査の polish 7 件(engine integrity sweep)

ユーザー: 「全体で、再生のエラーや矛盾ないか、監査して、必要作業磨き進めて」。
v258 までを system-wide audit (subagent map) → Critical/Medium/Low/clean に
分類し、Medium 1 + Low 6 を本 PR で全件 fix(新規機構なし、純粋な polish)。

### v260 の修正(engine.js)

| # | 項目 | 修正 |
|---|---|---|
| A | `stopPlayback` で `dropCue` を消し忘れ → stop/start 跨ぎで surge drop が誤発火する余地 | `resetRuntimeCounters()` 直後に `SectionState.dropCue = false;` を追加 |
| B | v256 の `INTRA_SECTION_BREATH` widening(±14-18)が UCM clamp `(4, 96)` で頭打ち → surge peak で sin 弧が flat | UCM clamp `(4, 96) → (4, 100)`(2 箇所、`applyUCMToParams` の UCM_TARGET と `sectionMacroTarget` の desired)|
| C | v256 の `microJitterScale` 1.4→1.9 が clamp 上限 1.62 で頭打ち → 実効 +16% (documented +36%) | clamp 上限 `1.62 → 2.0` |
| D | surge drop の subImpact("8n" sub thump)が同 step-0 の他 subImpact path で truncate される | `subImpact` guard に `{ minRetriggerSec: 0.12 }` を付与 → drop tail を 120ms 保護 |
| E | v258 関数 header コメント「fill + ident from v256」が誤帰属(fill は v193 起源、v256 で増幅; ident は v197 起源)| 「fill (v193, amplified in v256) + ident (v197)」へ訂正 |
| F | `pianoMemory` guard の `maxActiveVoices: 40` が dead code(synth 側 `maxPolyphony: 24` で先に cap)| `maxActiveVoices: 24` に整合 |
| G | v253 で `pianoMemory.volume.value` を `-41→-39` (+2dB) にしたが dynamic ramp(base `-45.2`)が即上書き → 第一フレーム以外無効 | dynamic ramp base `-45.2 → -43.2` で +2dB 意図を steady-state にも適用 |

stack-check 15 PASS / 0 BAD。

- `engine.js?v=fm-114`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v260`。

Band Room 不変。新規機構なし、v242-v258 シリーズの「掃除」。

---

## v259 compact — AI 再現のドラムを**生音方面**に振る（acoustic CDN kit デフォルト化）

ユーザー報告: 「音色は、生音方面には持っていけない？音楽として、リアル
な感じならいいけど、ただなってる感なんだよね」。v247-v257 で procedural
の rhythm / structure / mix を詰めたが、**ドラム source 自体が synth**
（Tone.js MembraneSynth/NoiseSynth etc.）だから「機械が頑張ってる」音
から逃げられない。

### v259 の修正

**`kitSource` のデフォルトを `synth` → `online/tone-acoustic`**。
CDN-streamed の**実録 acoustic drum kit**（kick/snare/hat/ghost/fill/
crash の wav サンプル）に切り替える。

- インフラは v97 で既に存在（`presets/online-samples-catalog.json` に
  9 種類の CDN kit、`buildKitForSource` が online/<id> パスを処理）。
- ネットワーク: 初回オンライン再生で読み込み → v230 の SW キャッシュで
  以降オフラインも OK。
- bass / guitar の electric サンプルは v231 で unservable と判定済み
  なので**ドラムだけ**切り替え。chord は引き続き synth pad。voice は
  v254 で OFF。

### Migration（band-room.js）

- `state.kitSource` 初期値: `"synth"` → `"online/tone-acoustic"`
- `MIX_PREFS_VERSION`: `v255-chord-tame` → `v259-acoustic-drums`
- `V259_KIT_SOURCE_MIGRATION` 新設、`migratePrefsForCurrentMix` 内で
  `kitSource === "synth"` を `"online/tone-acoustic"` に変更。
- 別の online kit や song-extracted kit を選んでいたユーザはそのまま。
- UI ドロップダウン（`br-kit-source-select`）に `🌐 acoustic kit` が
  並ぶので戻したければそこから synth に再選択可能。
- `scripts/check-band-room-logic.mjs` の version assertion 追随。

### 影響

- AI 再現の drum part が**実録音**に：kick の "thud"、snare の "crack"、
  hat の "tick" がリアル。v247-v252 の groove pocket と humanize は
  そのまま acoustic samples 上で発動する。
- 原音（stems）はこの経路を通らないので不変。
- 初回 online 再生で 1-2 MB ほどの drum sample 群を fetch。SW キャッシュ
  後はオフラインも instant。

### 次の「生音」候補

drums が真っ先に決定打。残るは:
1. **chord**: salamander-piano（CDN）に切り替え（既に MASTER_PRESETS
   の "lo-fi" / "ambient" で使用例あり、catalog にも存在見込み）
2. **guitar/bass**: v231 で unservable と判断、再検証してダメなら synth
   のまま改善
3. **per-song kit_source override** を実曲リスニング駆動で詰める

- `band-room.js?v=br-145`、`hazama-fm-v259`。

---

## v258 compact — Hazama FM surge エントリに drop(ピーク landed モーメント)

v256 で節境界フィル + 節内アークを強化したが、**surge** (ピーク section、
drive 1.55 / energy 90) 自体は依然として approachValue のスムージング
(5-10秒の glide-in) で「いつ peak に入ったか」が曖昧。listener にとって
明確な「landed」モーメントが欠けていた(agent map の "GAP #2: no drop")。

### v258 の追加(engine.js、新規機構)

- `SectionState.dropCue` フィールド新設(`fillCue` と同様の one-shot 旗)。
- `advanceSection`: 次のセクションが `surge` のときだけ `dropCue = true`。
- `triggerSurgeDrop(step, time, context)` 新関数(`triggerTransientAcidCue` の
  隣):
  - `step === 0 && dropCue` でのみ発火、即 `dropCue` を消費。
  - **kick stab** (vel 0.44、kickProb gate を無視した unconditional hit)
  - **subImpact** (sub808 body thump、vel 0.32)
  - **drumSkin** (noise transient、vel 0.18、"crash" 感)
  - **texture** (top-end shimmer、vel 0.08)
  - `triggerTransientAcidCue({ amount: 0.78, source: "surge-drop" })` で
    AcidLockState + indicator + voice-morph state を pump(glass tag 付き)。
  - `markMixEvent(0.22)` で governor に「moment 起きた」を通知。
- `scheduleStep` の trigger 列に `triggerSurgeDrop(step, t, stepContext)` を追加
  (`triggerAutoDirectorCadence` の直後)。

これで section cycle が **submerge → sprout → flow → 【drop!】surge → hollow
→ return** と、surge 入口で明確な punch が landing。境界の fill (v256) +
ident (v197) は引き続きその前小節で鳴るので、**build (fill) → drop (surge
bar 1)** の DJ 的シークエンスに。

- `engine.js?v=fm-113`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v258`。

surge cycle は ~96 小節ごと(3-4 分に一度)。ふっと出会う「これだ」モーメント
が確実に来る pre-planned anchor point に。

---

## v257 compact — AI 再現 chord pad を non-jazzy 系で whole-note sustain に簡素化

「音楽として成立してない」の **structure 側のレバー**。texture/mix は
v247-v255 で詰めた、次は agent の**やってる事**を絞る。

v210 で入れた chord agent の phrase rhythm（bar 1 mid-stab・bar 2
anticipation）は、chord pad に rhythmic events を発生させる設計だった。
ロック/パンクでは chord pad は背景の harmonic colour であるべきで、
drums + bass + guitar の rhythm-section foreground の上に**追加の
リズム情報**が乗っていると整理がつかない。v255 で chord vol を 40 に
下げてもまだ「ぐじゃつき」が残るのはこれ。

### v257 の修正（`chordAgentPlan`）

非-jazzy かつ非-special-role（break / comp / intro / outro / 高 pressure
recap 以外）= **rock pad case** に対して:

1. downbeat duration を `"2n"`（半音符）→ **`"1n"`（全音符）** に。
   chord は1小節フルで鳴り続ける = pad そのもの。
2. v210 の **phrasePos === 1 mid-stab を削除**。
3. v210 の **phrasePos === 2 anticipation を削除**。
4. 結果: 1 onset / 小節、`"1n"` sustain. chord agent は他声部の
   邪魔をしない pure pad に。

維持するもの:
- jazzy mode: 既存 comping そのまま（jazz は chord rhythm が音楽の核）
- break: call-and-response stab そのまま
- comp: ghost-answer の reactive stab そのまま
- intro / outro: 既に `"1n"` pad swell（v219）
- recap with high pressure: chorus 強度の追加 stab そのまま

polyphony 安全: 3 notes × ~1.5 小節 sustain ＝ ~5 voices、cap 10 以内。
原音不変。CPU 影響ゼロ（onset 数が減るだけ）。

- `band-room.js?v=br-144`、`hazama-fm-v257`。

---

## v256 compact — Hazama FM 「magic moment」機構の強化(境界フィル ＋ 節内息づき)

ユーザー: 「たまにふっと、いい流れと出会える ＝ 音楽。そういう仕組み入れてる？
それを伸ばすか強化して」。要望は新規追加ではなく **既存の magic-moment
機構を強化** すること。

調査(agent map)で確認された既存機構:
- SECTION surge (peak section、drive 1.55)
- `SectionState.fillCue` (境界フィル、1小節)
- `cueSectionIdent` (境界の ident cue)
- `INTRA_SECTION_BREATH` (節内の sin 弧 ±7-8 UCM)
- SignatureCell × 4 (memoryPluck / ghostGlass / lowBreath / brokenTexture)
- MotifMemory afterimage、BPM-zone refrain、9 ラジオ番組、Album arc ACID
  chapter (arc36 モード時のみ、最強の事前計画ピーク)

→ いずれも 「弱い・控えめ」設定で knob 上の調整余地が大きい。v256 では
**節境界と節内アーク** の 3 つを意味的に強化:

### v256 の修正(engine.js)

- `INTRA_SECTION_BREATH`: `{ wave: 8, creation: 8, resource: 7, void: -7 }` →
  **`{ wave: 18, creation: 18, resource: 14, void: -14 }`** — 節中盤の UCM
  アークが ±7-8 → ±14-18 で明確に知覚可能なレベルに。**節の中で「ふっと
  上がる/下がる」モーメントが立ちやすい**。
- `fillBoost` (`scheduleStep`): `0.14 → 0.32` — 境界フィル1小節のハット密度
  ブーストを 2.3 倍に。**節境界が「何か起きてる」フィルとして明確に聞こえる**。
- `GrooveState.microJitterScale` (フィル時): `1.4 → 1.9` — フィルバーの
  micro-timing variance を上げて groove flex を強化。境界の「うねり」が出る。
- `engine.js?v=fm-112`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v256`。

これでも magic moment が薄ければ、次は SignatureCell の velocity cap 引き上げ、
cueSectionIdent の velocity 倍化、または surge 入り口の drop 追加(新規機構)を検討。

Band Room は不変。

---

## v255 compact — AI 再現 chord pad 音量を下げる（リズム隊3声を前に）

v254 で voice OFF にし baseline を 4-piece instrumental（drums + bass +
guitar + chord pad）にした。次の最有力素材: chord pad は **cramps-punk
で最も非ジャンルな要素**（パンクには鍵盤パッドが無い）かつ procedural
music で **mud-mask の主因**（持続 wash texture が低中域を覆う）。
v249/v250 でせっかく lock した bass+guitar の pocket が pad に埋もれる。

### v255 の修正

- `band-room.html`: `br-vol-chords` のデフォルト値を **58 → 40**（~30%
  reduction）。
- `band-room.js`: `MIX_PREFS_VERSION` を `v254-default-parts` →
  `v255-chord-tame`。`V255_CHORD_REDUCTION_MIGRATION` 新設、`58 → 40`
  へ migrate。既存 V167 migration（68→58）と直列適用 → 旧 v167 ユーザの
  68 は V167 で 58 に上がり、続けて V255 で 40 に下がる。58 から
  カスタムで離れた人はそのまま残る。
- `scripts/check-band-room-logic.mjs`: assertion 文字列追随。

chord pad は背景の harmonic colour 担当に専念、bass+guitar+drums の
locked rhythm-section foreground を前に出す。原音不変。

### 「音楽として成立」次の手（実機 AB で）

- chord 40 で「だいぶマシ」 → 同方向: chord 軽くプラックっぽくする
  （sustain 0.45 → 0.30、release を短く）
- まだダメ → texture じゃなく**構成** → section dynamics（verse 静か→
  chorus 大きい）の差を強める

- `band-room.js?v=br-143`、`hazama-fm-v255`。

---

## v254 compact — AI 再現の voice をデフォルト OFF（4-piece instrumental が baseline）

ユーザー報告: v247-v252 で kick/snare ポケット＋bass/guitar lock＋humanize
拡幅を入れたが「音はちゃんと出るが、音楽として成立してない」。

診断: AI 再現が 5 パート全部ナッシング聞こえる状態だと、procedural な
voice agent が chord-tone のアルペジオ（root → 3rd → 5th → 3rd を 4 小節
contour で回す）を毎拍鳴らす → **リアルな歌のラインに聞こえない**ので、
他 4 パートが揃っていても「機械が変な歌をつけてる」音になる。procedural
melody は実曲の vocal line を再現できない（chord と tempo の枠だけ
合わせても vocal は別物）。

### v254 の修正

1. **`band-room.html`**: `br-toggle-voice` から `checked` を削除 →
   新規ユーザは voice OFF で起動。drums + bass + guitar + chord pad の
   4-piece instrumental が baseline。
2. **`band-room.js`**: `MIX_PREFS_VERSION` を `v168-default-mix` →
   `v254-default-parts` に bump、`V254_DEFAULT_TOGGLES_MIGRATION` を新設。
   - 既存ユーザの localStorage に `br-toggle-voice: true`（旧デフォルト）
     があれば `false` に migrate（カスタマイズで `false` にしていた人は
     そのまま残る → 二重 OFF にはならない）。
   - 既存の slider migration（v167→v168 mix balance）は新しいバージョン
     文字列でも引き続き適用。
3. **`scripts/check-band-room-logic.mjs`**: migration assertion を新
   バージョン文字列に追随。

voice が欲しいユーザは UI のトグルで都度オンに戻せる。停止スコープは
voice agent のみ — drums/bass/guitar/chord 各 agent の挙動は v245-v252
の蓄積を維持。原音（stems）はこの経路を通らず不変。

### 「音楽として成立」改善の次の候補（実機 AB で）

- voice OFF で「だいぶマシ」 → 同方向: chord pad 音量を 20-30% 下げて
  bass+guitar+drums の三声バランスを際立たせる
- voice OFF でも「まだダメ」 → texture でなく**構成**の問題 →
  section dynamics（verse 静か→chorus 大きい）、agent の section-aware
  enable/disable
- voice OFF で「歌が無くてさみしい」 → voice agent を sustained pad
  （chord root 1音を 2 小節 hold）に簡素化、procedural melody 廃止

- `band-room.js?v=br-142`、`hazama-fm-v254`。

---

## v253 compact — Hazama FM pianoMemory を humanize & 前に出す

v248〜v251 で echo character を段階的に復活させたが、wash だけでは
character の幅が限られる。今度は onset を humanize ＋ volume +2dB で
**presence と人間味**を両方持ち上げる。

### v253 の修正(engine.js)

- `pluckTime` (memory-pluck): `time + Math.random()*0.012` (0-12ms 単側) →
  `time + (Math.random()-0.5)*0.016` (**±8ms 中央寄せ**)。kick の
  HumanGrooveGovernor と同じ centered-jitter スタイルで humanize。
  notes can land slightly early or late — robotic 感が抜ける。
- `driftedTime` (piano-memory): 同じく **±8ms 中央寄せ**。
- `pianoMemory.volume.value`: `-41` → `-39` (**+2dB**)。layer の presence を
  控えめに上げる(押し付けがましくならない量)。
- v244 の groove lock は維持(jitter 範囲は同じ 16ms 幅、中心だけ 0 へ移動)。
- `engine.js?v=fm-111`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v253`。

これでも「退屈」が残れば次は `pianoMemory` の発火 gate を広げる(現在は
step%16===4 と 10 が中心 ＝ 2 トリガ/小節)。

---

## v252 compact — AI 再現ドラム humanize 拡幅（±4% → ±10%）

v247 でバックビート velocity フロア（kick 0.82 / snare 0.86）を入れたら、
強拍は確かに立つようになったが、上に乗っていた `±4%` のランダム
humanize が**相対的に狭すぎ**て「機械が大きく叩いている」音に近かった。
リアル drummer は ±10% 程度の dynamic スイングをポケット内で見せる
（kick が常に同じ強さで叩かれることは無い）。

### v252 の修正（band-room.js）

ドラムトリガーの velocity humanize 係数:
`(Math.random() - 0.5) * 0.08`（±4%） → `* 0.20`（±10%）

これで:
- kick 0.82 ベース → 0.74-0.90 のスイング
- snare 0.86 ベース → 0.77-0.95 のスイング
- hat / ghost も比例して広がる（既存の ghost-note variation は temporal、
  別レイヤなのでぶつからない）

ポケット（v249/v250 の bass+guitar→kick lock）はそのまま維持される。
タイミング jitter（v118 の ±3ms、kick 除外）は今回はそのまま — 拡幅は
別 round で。原音は不変。

- `band-room.js?v=br-141`、`hazama-fm-v252`。

---

## v251 compact — Hazama FM pianoMemory echo を強める(feedback 0.24・send 0.42)

v248 で `pianoMemoryEcho` を新設したが「退屈」感が残っていそう(ユーザー
「進めて」継続)。専用 echo の 2 ツマミを上げて wash character を強める。

### v251 の修正(engine.js)

- `pianoMemoryEcho.feedback`: `0.20 → 0.24` — tail を少しだけ延ばす
  (`globalDelay` の 0.32 よりまだ短いので next chord 前に decay 完了は維持)。
- `pianoMemorySend` Gain: `0.32 → 0.42` — 第1エコーが ≈ -10 dB → -7.5 dB に。
  低音 chord に対し echo が明確に乗る。
- on-beat attack は引き続き dry 直結なので v244 の groove lock は不変。
- `engine.js?v=fm-110`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v251`。

これでも「退屈」が残れば次は onset jitter を 0-12ms 単側 → ±8ms 中央寄せで
humanize を強める、または volume +2dB で presence を上げる。

---

## v250 compact — AI 再現の guitar も kick に lock（リズム隊3声を統合）

v249 で bass を kick に lock し「リズム隊2声」が pocket に揃った。次は
**guitar の strum も同じ pocket に入れる**。cramps-punk の rhythm guitar
は基本 kick と一緒に stab する（1拍3拍が骨）→ guitar が kick から
ずれていると、drums+bass はロックしているのに guitar だけ別レイヤーに
聞こえてバンド感が halve する。

### v250 の修正（`triggerGuitarAgent`）

v249 と同じ ±50ms ポケットウィンドウで snap:

1. `ctx.events` から kick 時刻リスト生成（無ければ beat 0/2 を補完）。
2. 各 strum step について最寄り kick との差が **±50ms** なら snap、
   それ以外はグリッドに残す（intended syncopation 保護）。
3. ロジックは v249 bass-lock と完全同形（インライン重複）。3つ目の
   agent が同じパターンを要れば共通ヘルパに抽出予定。

これで drums + bass + guitar の3声が同じ pocket に揃う = リズム隊の
「同じ部屋で弾いている」音。原音は別経路で不変。CPU 影響なし
（スケジューリング計算のみ、新規オシレータ／FX 無し）。

- `band-room.js?v=br-140`、`hazama-fm-v250`。

---

## v249 compact — AI 再現の bass を kick に lock（±50ms ポケット）

v247 でバックビートの velocity フロアを入れ kick/snare は立つようになった
が、ユーザーの「グルーブない」の次のレイヤー: **bass と drums が別々に
鳴っているように聞こえる**。バンド感の核は「リズム隊が同じ pocket に
入る」こと — bass の onset が kick と同居して初めて「2人が一緒に
弾いている」音になる。

### 現状（v249 前）

- `triggerBassAgent` は `step.sub * subTime + microMs` で 16分グリッドに
  そのままスケジュール。
- `playDrumHit` で鳴る kick は frame の `microMs` で僅かにずれることがある
  （`cramps-punk` プロファイルは 0 だが、librosa 元データの microMs は
  非ゼロのことがある）。
- 結果: bass がグリッドに固定、kick が源データ準拠 → 同拍でも数ms ずれ
  ＝ "tight" になりきらない。

### v249 の修正（band-room.js）

`triggerBassAgent` 内で **bass note を最寄り kick に snap**:

1. `ctx.events` から kick の絶対時刻（秒）リストを生成。
2. 各 bass step について、最寄り kick との差が **±50ms 以内**なら kick の
   時刻に snap。50ms を越える bass note は意図的な syncopation と判断し
   グリッドに残す（funk の anticipation 等を保護）。
3. frame に kick が一つも無い場合は、v106 / v247 の補強が beat 0 + beat 2
   に kick を補うので、ロック target もそれを mirror（`[0, 2*beatTime]`）。

これでドラム＋ベースが1つのリズム声部として鳴る。原音（stems）は別
経路なので不変。CPU 影響なし（純粋なスケジューリング計算）。

### 次の groove レバー候補

実機 AB でまだ足りなければ:
- 小さなデフォルト swing（cramps-punk は 0 維持、lofi / jazz / hip-hop は
  自動 swing オン）
- velocity humanize を ±4% → ±10%（ドラムの呼吸感を増やす）
- fill バリエーション増（4小節周期感を消す）

- `band-room.js?v=br-139`、`hazama-fm-v249`。

---

## v248 compact — Hazama FM 低音ピアノの "memory" echo を専用 delay で復活

ユーザー報告: v244+v246 で groove は乗れるようになったが「退屈な音」。
v246(`pianoMemory` を `globalDelay` から完全に dry に解除)で over-correct
— smear を消すために "memory" たる echo character を全部剥がしてしまった。

### v248 の修正(engine.js)

- `pianoMemoryEcho` という専用 `PingPongDelay` を新設(`delayTime "8n"`、
  `feedback 0.20`、`wet 1` 純 wet)+ `pianoMemorySend` という `Gain(0.32)` の
  send。dry は `masterGain` 直結のまま。
- 結果: v244-tight の on-beat attack は維持しつつ、8n のソフトな echo tail
  (≈ -10 dB 相対、feedback 0.20 で速い decay) で wash character を復活。
- `globalDelay` の feedback 0.32 より短い feedback ＝ echo は次の chord 前に
  decay し切る → wash は戻るが smear は最小限。bass / texture は引き続き
  `globalDelay` を共有(独自 rhythmic 装飾はそのまま)。
- `engine.js?v=fm-109`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v248`。

これでも「退屈」が残れば次は (a) `pianoMemory` の onset jitter を 0-12ms 単側
から ±6ms 中央寄せに戻して humanize を強める、(b) volume を ~+3dB 上げて
presence を上げる、のどちらか。

---

## v247 compact — AI 再現のドラムにバックビート pocket を入れる

ユーザー報告: v245 で音色は整ったが「音はなってるけど、グルーブはないね」。

原因: per-song の `drum-frames-*.json` は librosa onset 検出から自動生成
されており、**velocity が全部 ~0.35 で平坦** ＋ 一部の verse（Human Fly
など）は **kick も snare も拍頭・バックビートに無く ghost＋crash＋hat
だけ**。データそのものがグルーブを持っていないので、`±4%` humanize や
4-bar phrase shape では救えない（弱拍を弱くしても、強拍がそもそも
立っていない）。

### v247 の修正（band-room.js）

ランタイム側からバックビートを保証する2段の救済。

1. **バックビート velocity フロア**（既存イベントの救済）
   - kick が beat 0/2 の拍頭にあれば velocity を **0.82** に下限。
   - snare が beat 1/3 の拍頭にあれば velocity を **0.86** に下限。
   - フロアは「上げるだけ」なので、データ側に dynamics があれば残る。
2. **疎フレーム補強の発火条件拡張**（無いイベントの追加）
   - v106 の `events.length < 6` 条件に加えて、`!hasStrongHit`（強拍に
     kick/snare が一つも無い）でも補強。
   - 補強の velocity を **0.50/0.55 → 0.82/0.86** に引き上げ。前のままだと
     "ささやき pulse" でグルーブが立たなかった。
   - intro/outro は `session_role` で除外（雰囲気優先のセクションを
     壊さない）。

`cramps-punk`（Tabasco）など rock 系プロファイル前提だが、4/4 popular
music の backbeat は普遍なので jazz / hip-hop / lofi でも安全。原音
（stems）はこの系統を通らないので不変。velocity は推定、耳で微調整可。

- `band-room.js?v=br-138`、`hazama-fm-v247`。

---

## v246 compact — Hazama FM 低音ピアノを dry 経路へ(globalDelay 経由を解除)

v244 で `pianoMemory` の onset drag(memory-pluck の +18ms ハードオフセット等)を
解消したが、`pianoMemory` は今も `globalDelay`(8n PingPong、wet 0.21)経由で
出ていた。sustained な低音コードにステレオ 8n echo が重なり、元の chord が
鳴り終わる前に echo が乗って **時間的にスメア**(「いつ chord が始まったか」が
曖昧になる) → groove と戦う。

bass / texture は短い percussive 信号なので 8n echo はリズムの装飾になる。
**sustained な低音コードだけ delay と相性が悪い**。

### v246 の修正(engine.js)

- `pianoMemoryFilter` を `globalDelay` → `masterGain` に付け替え。pianoMemory は
  100% dry になり、kick/bass のポケットに乗った clean な低音コードとして鳴る。
- bass / texture / jazz guitar sampler / 他の delay 経由レイヤーは不変。
- `engine.js?v=fm-108`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v246`。

これでもまだ「変に遅く入る」感が残れば、次は装飾の reply/shade テールを詰める。

---

## v245 compact — AI 再現の音色磨き（モノ系2パートのみ fat オシレータ）

ユーザー報告: AI 再現は鳴るが「音楽になってない」。音が**ビープっぽい**
— ユーザー自身の見立てで「synth のまま音色を磨く」方針。

原因: AI 再現の音程パート4種（ベース／ギター／ボイス／コード）はすべて
**単発のオシレータ1基**で鳴っていた。1基の sawtooth は倍音は豊かでも
位相が固定 → 幅・揺らぎがなく、静的な「ビープ」に聞こえる。

### v245 の試行と確定（band-room.js）

- 4パートすべてを **fat（デチューン・ユニゾン）** に切り替える試行
  （bass count 3 / guitar 2 / voice 2 / chord 2）をプレビューでフリーズ
  オラクルにかけたところ、**ギター＋コードの PolySynth × fat 2基/音 で
  オシレータ数が倍増（最大 22 → 46 基）→ レンダラが 30 秒以内に停止**。
  Tone PolySynth は1音=1FatOscillator（内部 N 基）なので polyphony cap
  10 は維持されるが、定常 CPU が伸びて choke した。
- 確定方針: **mono 系の cheap な2パートだけ fat に残し、PolySynth 2基は
  従来の単発オシレータに戻す**。CPU 余裕を保ちつつ低音と歌の「ビープ
  解消」を達成する最小構成。
  - ベース `makeSynthBass`: `fatsawtooth` 3基・spread 20（MonoSynth →
    定常 3 基、安全）。下の lowpass が余分な倍音を抑えるので「太いが
    揺れない」。
  - ボイス `makeVoiceBox`: `fatsawtooth` 2基・spread 12（AMSynth →
    carrier 2 基、控えめ）。既存の vibrato LFO（voice.detune）と
    喧嘩しない量。
  - ギター `makeGuitar`: `sawtooth`（単発）に**復旧**。再試行は別 round。
  - コード `makeChordSynth`: `c.oscType`（単発）に**復旧**。既存の
    Chorus と高域 FX が幅出しを担う。
- 原音（stems）はこの系統を通らないので不変。
- 定常オシレータ数 ≦ 旧 22 + 4 ＝ 約 26 基。choke 域から十分外。
- デチューン量は推定。実機の耳で微調整できる。
- `band-room.js?v=br-137`、`hazama-fm-v245`。

---

## v244 compact — Hazama FM 低音ピアノの「変に遅く入る」を解消

ユーザー報告: 低めのピアノが「変に遅く入る」＝ groove に乗れない原因音。
v242(セクションのドラムゲート)では未解決の別レイヤーだった。engine.js のみ、
Band Room は不変。

原因: `pianoMemory`(低音域のコンプ声部、triangle + 1800Hz lowpass)の trigger
時刻が、キック/ベース(±数ms)に対し大きく後ろにずれていた。
- memory-pluck `pluckTime` = `time + 0.018 + random(0..0.036)` ＝ 常に最低
  +18ms・最大 +54ms 後ろ。
- piano-memory `driftedTime` のランダム押し出しが最大 ~46ms。
→ 低音ピアノだけ rhythm section から 15-50ms 遅れて「変に遅く入る」。

### v244 の修正(engine.js)

- `pluckTime`: ハード +18ms を除去、ジッタを 0-12ms に。
- `driftedTime`: ランダム押し出しを 0-46ms → 0-12ms に。
- 低音ピアノの onset がキック/ベースのポケットに収まる。装飾の reply/shade
  テールは従来どおり後ろに残し feel を維持。
- `engine.js?v=fm-107`(+ `audio/music-*.js` 5モジュール)、`hazama-fm-v244`。

---

## v243 compact — AI 再現の音量を原音マスター基準に引き上げ

「AI 再現がげきしょぼ」— ユーザーの見立て通り、原因は**マスターの共用
ではなく入力レベルのミスマッチ**だった。

原音（stems）と AI 再現（synth）は同じマスターチェーン（2段コンプ＋
テープサット＋リバーブ＋リミッター）を通る。マスターは原音の音圧に
合わせて調整されている。一方 AI 再現の synth バンドは各パートのバス値
が低めで、マスターに**原音より ~10dB 小さく**届く → マスターのコンプ
／リミッターの効くレベルより下に沈み、原音が受ける「音圧のグルー」を
AI 再現だけ受けられない → 痩せて聞こえる。

### v243 の修正

- `instrumentBus` の makeup gain 1.08 → 3.0（drums/bass/guitar/chord ＝
  AI 再現の4パートを ~+9dB）。
- `voiceBus` 0.48 → 1.33（voice は instrumentBus を通らないので個別に
  同じ ~+9dB）。
- これで AI 再現の synth バンドが原音と同等レベルでマスターに入り、
  同じ音圧処理を受ける。**原音（stems）はこのバスを通らないので一切
  不変** — マスター共用のままで両方が正しく鳴る。
- 持ち上げ量は推定。実機の耳で「もっと／控えめ」を微調整できる。
- `band-room.js?v=br-135`、`hazama-fm-v243`。

---

## v242 compact — Hazama FM 低音打ち込みの入場遅延を解消

ユーザー報告: Hazama FM の低音（キック＋ベースの土台）が「入るのを
ためすぎて、乗れない」。engine.js のみの修正で Band Room には不変。

原因: section system は再生のたび必ず最初の `submerge` セクションから
始まり、その `drive` が `0.00` だった。section drum gate
（`applyUCMToParams`）が `drive` でドラム確率を掛けるため、submerge では
**キックが確率 0.004 にクランプされ実質無音、ベースも ×0.5** に絞られ、
これが 16 小節（約 30-46 秒）続いて低音の土台が立ち上がらなかった。

### v242 の変更（`SECTION_PROFILES`、engine.js）

- `submerge`: `drive 0.00 → 0.60` — 1 小節目から軽い低音グルーヴが鳴る。
  キックは無音クランプを脱し、ベースは ×0.5 → ×0.80。
- `submerge`: `bars 16 → 12`・`space 1.55 → 1.30` — 開始セクションを
  短く・休符を減らし、sprout/flow への登りを早める。
- `sprout`: `drive 0.55 → 0.72` — submerge との段差を保ちつつ flow への
  build を一段はっきりさせる。
- `hollow` は `drive 0.00` のまま — 唯一の本物のブレイクダウンとして維持。
- `engine.js?v=fm-106`（+ `audio/music-*.js` 5 モジュール）、`hazama-fm-v242`。

---

## v241 compact — AI 再現に guitar を復帰（5パート再建 完了）

「最小構成から積み直す」最終段。guitar を戻し、AI 再現の5パート
（ドラム／ベース／メロディ／コード／ギター）が全部そろった。

guitar が PolySynth を毎小節 ~8 strum 叩く machine-gun が「フル AI 再現が
固まる」最後の犯人だった。`guitarSparseStrums()` を追加し strum を
**~2/小節**に絞る（chord の ~1-2 stab/小節と同じ安全域）。各 strum は
フルのパワーコード — 疎なリズム＋フルコードの、リズムギターのコンプ。

preview 判定器で **5パート全部**（ドラム＋ベース＋メロディ＋コード＋
ギター）を再生 → 曲をまたいで ~111秒、固まらず応答あり。フル strum の
旧 guitar は ~22秒で固まっていた。

### v241 の変更

- `guitarSparseStrums()` を追加 — `triggerGuitarAgent` が strum を ~2/小節
  に絞る。
- `SYNTH_REBUILD_PARTS.guitar` を `true` に — 全パート on。
- `band-room.js?v=br-134`、`hazama-fm-v241`。

### AI 再現 再建のまとめ（v237–v241）

| 版 | パート | 方式 |
|----|--------|------|
| v237 | drums | ライブ合成 → **バッファ再生**（暴走根治） |
| v238 | bass | 復帰（monophonic・軽い） |
| v239 | voice | 復帰（monophonic・軽い） |
| v240 | chord | 復帰（PolySynth・~1-2 stab/小節で軽い） |
| v241 | guitar | 復帰（PolySynth・**疎な strum** ~2/小節に制限） |

25版以上ブラウザを固めていた AI 再現が、5パートのバンドとして安定して
鳴る状態に到達。Dilla / ghost / fill 等のリズムロジックは全工程で不変。

---

## v240 compact — AI 再現に chord（コード）を復帰

「最小構成から積み直す」第4段。v237 ドラム / v238 ベース / v239 メロディ
に続き chord を戻す。

chord は PolySynth（bass/voice の monophonic より重い）だが、chord agent
のトリガは **毎小節 ~1-2 stab** のみ — machine-gun ではない。preview
判定器で **バッファドラム＋bass＋voice＋chord** を再生 → 曲をまたいで
（auto-advance 含む）~98秒、固まらず応答あり。→ 作り直し不要、un-park のみ。

これで「フル AI 再現が固まる」の犯人は chord ではなく **guitar** と判明
（guitar だけ未投入のこの4パート構成は固まらない）。

### v240 の変更

- `SYNTH_REBUILD_PARTS.chord` を `true` に。AI 再現は **ドラム＋ベース＋
  メロディ＋コード** の4パートで鳴る。
- guitar のみ保留 — PolySynth を毎小節 ~8 strum 叩く、残る暴走候補。次
  ラウンドで検証／作り直し。
- `band-room.js?v=br-133`、`hazama-fm-v240`。

---

## v239 compact — AI 再現に voice（メロディ）を復帰

「最小構成から積み直す」第3段。v237 ドラム（バッファ再生）/ v238 ベース
に続き、voice（メロディガイド）を戻す。

voice（`makeVoiceBox` の formant 合成）も bass 同様 **monophonic・毎小節
~4発**で軽い。preview 判定器で **バッファドラム＋bass＋voice** を再生 →
曲をまたいで（auto-advance 含む）~96秒経っても固まらず応答あり。
→ バッファ方式への作り直しは不要、un-park のみ。

### v239 の変更

- `SYNTH_REBUILD_PARTS.voice` を `true` に。AI 再現は **ドラム＋ベース＋
  メロディ** で鳴る。
- guitar / chord は引き続き保留 — PolySynth なので次ラウンド以降、最も
  慎重に扱う。
- `band-room.js?v=br-132`、`hazama-fm-v239`。

---

## v238 compact — AI 再現の最小コアに bass を復帰

v237 でドラムをバッファ再生に作り直し、AI 再現の暴走（ブラウザ処理落ち）
を根治。「最小構成から積み直す」方針の第2段として bass を戻す。

### 検証で分かったこと

bass（`Tone.MonoSynth`）は **monophonic・毎小節 ~4-8発** のトリガで、
暴走を起こした旧ドラムの ~30発/小節とは桁が違う。preview 判定器で
**バッファドラム＋bass** を再生 — 曲をまたいで（auto-advance 含む）
~130秒経っても renderer 応答あり、固まらない。

→ bass はバッファ方式に作り直す必要なし。`SYNTH_REBUILD_PARTS.bass`
を `true` にして bar スケジューラのトリガを解禁するだけ。

### v238 の変更

- `SYNTH_REBUILD_PARTS = { bass: true, guitar: false, voice: false, chord: false }`
  — bass を un-park。AI 再現は **バッファドラム＋ベース** で鳴る。
- guitar / voice / chord は引き続き保留（ライブ合成のまま）。guitar /
  chord は PolySynth で最も慎重に扱う必要があるため後回し。
- `band-room.js?v=br-131`、`hazama-fm-v238`。

次ラウンド以降: voice → chord → guitar と1パートずつ検証して戻す。

---

## v237 compact — AI 再現の暴走を根治: ドラムをバッファ再生に作り直し

「AI 再現でドラムがちょっと鳴る → だんだん無音 → ブラウザ処理落ち」—
preview を判定器（固まる/固まらない）にして決定的に切り分けた:

- 原音モード → 固まらない（バッファ再生は安定）
- AI 再現 synth 最小コア（ドラム+ベース+ボイス、PolySynth 撤去）→ 固まる
- AI 再現 **ドラムのみ** → それでも固まる
- ドラム ~2発/小節 → 生存。フル密度・basic beat (~8発) → 固まる

→ 暴走の正体は **synth ドラムをライブ合成で毎小節大量に叩くこと**。
PolySynth でもベース/ボイスでもなかった（v227/v233 の前提を訂正）。
1トリガごとに Web Audio コストが積み上がる。

### v237 の修正 — ドラムをバッファ再生に＋他パートは保留

`makeDrumKit` を作り直し:

- 起動時に各ドラム音（kick/snare/hat/clap/cowbell/tom/crash）を
  `Tone.Offline` で短いバッファに**一度だけ**焼く（音色は従来の合成音
  そのまま）。
- 1発ごとは、その焼いたバッファを**使い捨ての一発 buffer source** で
  再生（`playDrumHit`）。原音/stems と同じバッファ再生で、preview でも
  実機でも一度も固まらない技術。ライブ再合成をやめた。
- ベロシティはゲインで付与。Dilla オフセット・ゴースト・フィル・各
  エージェントのリズムロジックは一切不変 — feel は完全維持。
- `makeDrumKit` は async 化（offline レンダリングのため）。

**bass / guitar / voice / chord は保留**（`SYNTH_REBUILD_PARTS` で build
を gate）。これらは旧ドラムと同じくライブ合成で、5パート全部だとフル
AI 再現はまだ固まる。各パートをバッファ方式に作り直し検証でき次第、
1つずつ戻す。**v237 の AI 再現はバッファドラムのグルーヴが鳴る**（最小
コア — ユーザーが選んだ「最小構成から積み直す」方針の第一段）。

`band-room.js?v=br-130`、`hazama-fm-v237`。

### 検証

preview 判定器で、バッファドラム（他パート保留）が renderer を固まらせず
**曲をまたいで（auto-advance 含む）連続再生**することを確認 — ~130 秒
時点でも応答あり。旧ライブ合成ドラムは ~16 秒で固まっていた。
bass / guitar / voice / chord の復帰は次ラウンド以降。

---

## v236 compact — 原音モードの画面ロック遷移グリッチを緩和

v235（画面 Wake Lock）で原音の iOS バックグラウンド再生は安定し、
キーのブレも解消した。残るのは**画面をロックする“その瞬間”**の短い
「ボぼぼぼ」というループ音 — iOS が visibility 遷移の一瞬だけ
AudioContext を throttle し、bridge が再安定するまでの隙間で音声
バッファが引き伸ばし／繰り返しになる。bridge が復帰すればすぐ直る
（v235 で確認済み）が、その継ぎ目が耳に残る。

### v236 の修正 — 遷移を duck でマスク

`duckThroughBackgroundTransition()` を追加。`handlePlaybackGoingBackground`
（visibilitychange→hidden 等）で、master gain を遷移の一瞬だけ
near-silence に落としてから戻す:

- 0.05s で素早く down → 0.60s まで hold → 0.92s で滑らかに復帰。
- エンベロープ全体を**音声クロックに一括スケジュール**するので、
  ページが hidden で JS が凍っても自走完了する — 必ず元の音量に
  戻り、無音で固着しない設計。
- iOS のみ（他 OS はこの throttle が無い）、visibilitychange /
  blur / pagehide の連発は 2.5s デバウンスで1回に集約。
- グリッチが duck の無音区間に隠れる → 継ぎ目が目立たなくなる。

ベストエフォートのマスク（throttle の長さは端末・状況で変わるため
タイミングは推定）。`band-room.js?v=br-129`、`hazama-fm-v236`。

---

## v235 compact — 原音モードの iOS バックグラウンド安定化（画面 Wake Lock）

「原音 PWA を iPhone で画面ロックすると、キーがブレブレ／止まり／単音
ループになる」— iOS の OS 制約で、画面が消えると Web Audio が
throttle/suspend され、隠し `<audio>`＋MediaStream の background-bridge
だけでは支えきれない（音声スレッドが間に合わず、古いバッファを引き伸ばす
／繰り返す音）。

### リサーチ — hazamaFM との比較

`engine.js`（hazamaFM）と band-room の background 処理を読み比べた。
bridge（隠し `<audio>`＋MediaStream）は**ほぼ同一コード**。決定的な
違いは、hazamaFM には `navigator.wakeLock`（「KEEP」）があり band-room
には無いこと。hazamaFM は画面 Wake Lock で画面を消さない＝そもそも
background にしないことで iOS の難所を回避していた。

### v235 の修正 — 画面 Wake Lock を自動取得

- `requestScreenWakeLock()` / `releaseScreenWakeLock()` を追加
  （`navigator.wakeLock.request("screen")`）。
- `startPlayback` で自動取得、`stopPlayback` で解放。
- Wake Lock はページが hidden になると OS が自動解放するので、前面
  復帰（`handlePlaybackReturningForeground`）で再取得。
- ボタン無しの自動方式 — 再生中は画面が消えず、安定した前面に留まる。
  Wake Lock 非対応環境では graceful に no-op。
- JS のみ（HTML/CSS の構造変更なし）。`band-room.js?v=br-128`、
  `hazama-fm-v235`。

### 限界

これは「画面を点けたまま」の集中再生を安定させるもの。物理的に画面を
オフ（ポケット等）にした完全 background 再生は iOS の別次元の課題で、
bridge の地道な改善が必要 — 今回の対象外。

---

## v234 compact — v233 の JIT スケジューリングを revert

v233（JIT note scheduling）を実機で確認したところ「ドラムが薄くたまに
しか鳴らない／シンセ（ビープ音）がかすれ途切れてほぼ鳴らない」と悪化。
preview 環境は band-room の音を再生させると renderer が固まり JIT を
検証できないまま ship していた — 検証不能な変更が実機で悪化したので
revert する（ship-then-verify: 悪ければ戻す）。

### revert 内容

- `jitTrigger()` / `clearJitEvents()` / `jitEventIds` を削除。
- guitar / chord agent は PolySynth を**直接** `triggerAttackRelease`
  で叩く v232 の挙動に戻す。
- `startPlayback` / `stopPlayback` の `clearJitEvents()` 呼び出しも削除。
- maxPolyphony は 10 のまま、v232 の周波数レーン設計は維持。

### 次の調査方針

v233 が狙った polyphony（ボイスプール）の懸念は未解決 — ただしこれ
以上 preview で検証できない変更を盲目的に ship しない。次は実機で
レベルメーター（`#br-meter-fill`）の振れ方をユーザーに確認してもらい、
「信号は出ているが聞こえない（出力/xrun 系）」のか「信号自体が死んで
いる（スケジューラ/ルーティング系）」のかを切り分けてから動く。

`band-room.js?v=br-127`、`hazama-fm-v234`。

---

## v233 compact — AI 再現の polyphony 洪水を JIT スケジューリングで根治

v232 検証中に見つけた `Max polyphony exceeded`（音ドロップ）の洪水を、
PolySynth の voice pool を計測して追い込んだ。

### 根本原因 — ボイスリーク

`_voices` / `_availableVoices` / `_activeVoices` を instrument して観測:
`_activeVoices` が単調増加し `_availableVoices` はずっと 0 — ボイスがプール
に戻ってこない。bar スケジューラが1小節分の音を**一括同期で** PolySynth に
渡すと、遠い未来スケジュールの音について `onsilence`（ボイスをプールへ返す
コールバック）が発火せず、ボイスが溜まって maxPolyphony で洪水。
**cap を上げても `releaseAll` でも止まらなかった**（両案とも検証で却下）。
Tone.js の CDN ソースでボイス確保/解放機構も確認。

### v233 の修正 — JIT（just-in-time）スケジューリング

`jitTrigger()` を追加。guitar / chord（PolySynth の2パート）の各音の
`triggerAttackRelease` **呼び出し**を、発音の約 0.15s 前まで
`Tone.Transport.scheduleOnce` で遅延させる:

- PolySynth が同時に抱える音が ~3-4個になり、ボイスが正常に再利用される
  （遠い未来スケジュールをやめたので `onsilence` も正常発火）。
- `Tone.Transport`（Web Worker クロック）なので**画面オフでも正確**。
- 発音時刻は厳密に維持 — 遅延するのは「呼び出し」だけで timing は不変。
  **low-risk**: 何を/いつ鳴らすかは変えない。最悪でも v232 と同等。
- `startPlayback` / `stopPlayback` で保留中の JIT イベントを clear。
- maxPolyphony は 10 のまま（JIT でリークが消えるので cap 据え置き）。
- bass / voice は monophonic でリークしないので JIT 対象外。
- `band-room.js?v=br-126`、`hazama-fm-v233`。

### 検証 — 実機での確認をお願いします

preview 環境は band-room の音を再生させると renderer が固まる（既知の制約 —
band-room の audio をフル検証できない）。preview 計測ではボイスが溜まらない
兆候は見えたが、完全な確認は preview では不可能。**実機での確認待ち** —
AI 再現の「音切れ・薄さ」が減ったか。low-risk な変更なので、悪化する場合は
revert 容易。

---

## v232 compact — AI 再現の周波数レーン設計（土台 step A）

「5パート全部が鳴る感じがしない」— git 履歴・設計ドキュメント・ミックス
工学のリサーチを経た、AI 再現の土台再建 step A。

### 問題（リサーチで確定）

5つの synth パートが**周波数的に分離していない** → 「バンド」でなく「シンセ
の塊」。決定的なのは: voice（メロディ）が octave 4、chord pad も octave 4 —
**同じオクターブの同じコード構成音**。voice は chord をダブリングしている
だけで、独立した5パート目として聞こえない。

ミックス工学リサーチ: 「複数楽器が同じオクターブ域で同時に鳴ると、どんな
EQ でもクリアにできない。各パートに周波数の居場所を与えれば mix はほぼ
自動で整う」。

### v232 の修正 — 4オクターブのレーン梯子

各ピッチパートに専用オクターブを与える:

| パート | レーン |
|--------|--------|
| bass   | octave 2（既存・低域） |
| guitar | octave 3（低中域・パワーコード、既存） |
| chord  | octave 4（中域パッド、既存） |
| voice  | octave 4 → **5**（メロディを pad の上へ） |

- `voiceAgentPlan`: `chordToNotes(ctx.chord, 4 → 5)`。メロディが chord pad の
  1 オクターブ上に出て、独立したラインとして聞こえる。
- guitar synth: 130Hz ハイパス追加 — 歪んだ低中域が bass レーンを侵さない。
- chord synth: 190Hz ハイパス追加 — pad が bass/guitar の低域を濁さない。
- 新フィルタは withChainDispose に登録（v229 のリーク対策を維持）。
- agent ロジック・音数・maxPolyphony は不変。
- `band-room.js?v=br-125`、`hazama-fm-v232`。

### 次（土台 step B 以降）

B: 音色キャラ分け（saw 一辺倒をやめ各パートに別の音色）。C: EQ carving。
D: レベル再設計（メロを聞こえる位置へ）。E: rolled chord（同時発音をやめ
8-22ms ロール）。F: per-part profile（v91 ロードマップ完成）。

---

## v231 compact — AI 再現を全 synth バンドに（実サンプル CDN が配信不能）

「しょぼい」の診断 step 4 — 計測で根本原因まで到達した。

### 確定した根本原因

AI 再現の guitar (`guitar-electric`) と bass (`bass-electric`) は実サンプル
音源で、jsDelivr 経由で GitHub リポジトリ `nbrosowsky/tonejs-instruments`
から mp3 を引いていた。**だがこのリポジトリは jsDelivr の 50MB 上限を超過**
している（jsDelivr API が明言: `"Package size exceeded the configured
limit of 50 MB"`）。jsDelivr はファイルの約半分を 403 で拒否し、しかも
不安定（同じファイルが成功・失敗を行き来する）。

`Tone.Sampler` は**全ファイルが揃って初めて鳴る**ので、guitar と bass は
オンラインでも**ずっと無音**だった。鳴っていたのは synth ドラム + synth
コードだけ = ユーザーの「一瞬ドラムちぎれてビープ」の正体。

計測で実証: 再生中の `Sampler loaded=false`、CDN 直叩きで 403、jsDelivr
API の 50MB 超過メッセージ、`Tone.Sampler` 実テストで "could not load url"。
v229（フリーズ）/ v230（オフラインキャッシュ）は関連修正だが、しょぼい の
本体はこれ。

### v231 の修正 — 確実に鳴る全 synth バンド

ユーザー判断で「内蔵 synth で確実に鳴らす」を選択。

- `guitarInstrument` / `bassInstrument` のデフォルトを `"guitar-electric"`
  / `"bass-electric"` → **`null`**（= 内蔵 synth）。CDN 不要・オフライン可・
  確実。guitar = ディストーション PolySynth、bass = MonoSynth。
- **既存ユーザー対策**: localStorage には旧デフォルト（`"guitar-electric"` /
  `"bass-electric"`）が保存済みで、これが新デフォルトを上書きしてしまう。
  prefs 復元時に壊れた値 → `null` へ migrate する処理を追加（これが無いと
  既存ユーザーは直らない）。
- guitar が PolySynth になったので polyphony flood 対策:
  - `triggerGuitarAgent`: 1 strum あたりの音数を strum 数でスケール
    （`floor(9 / strum数)`）。密な刻みは単音チャグ（パンクの実テクスチャ）、
    疎な刻みはフルパワーコード。1 小節 ≤9 音 → cap 10 に収まる。
  - `chordAgentPlan`: 7th コード（4 音）を 3 音シェル（root+3rd+7th）に。
    3 stab × 3 音 = 9 → cap 10 に収まる。
- maxPolyphony は 10 のまま（v228 方針どおり「cap は上げず密度を下げる」）。
- `check-band-room-logic.mjs`: assertion を更新（デフォルト null）＋ v231 追加。
- `band-room.js?v=br-124`、`hazama-fm-v231`。

### これで初めてフルバンドが鳴る

guitar / bass は今まで無音だった。v231 で初めて 5 パート（drums / bass /
guitar / chord / voice）すべてが鳴る。音色は合成だが、確実・オフライン可。
実楽器サンプルは配信元が壊れている以上、まともな CDN が見つかればそのとき
差し替える。

---

## v230 compact — AI 再現の実サンプル（guitar / bass）をオフラインキャッシュ

「音がしょぼい」の診断 step 2。AI 再現の楽器ルーティングを調べたら、想定と
違った:

- guitar = `guitar-electric`、bass = `bass-electric` → **実サンプル sampler**
  （`online-samples-catalog.json` 経由、jsDelivr の nbrosowsky/tonejs-
  instruments CDN から取得）
- chord = synth（PolySynth）、voice = synth（AMSynth）、drum = synth

つまり AI バンドのギターとベースは**本物のサンプル音源**。だが `sw.js` は
これらのサンプル CDN を一切キャッシュしていなかった（runtime cache の対象
は Tone.js 本体 CDN と Magenta だけ）。結果:

- **オフラインだと guitar / bass のサンプルが取得できず無音** → synth の
  chord + voice + drum だけが残り「しょぼい / ビープ」に聞こえる
- このアプリの存在理由は「オフライン focus listening」（`sw.js` 冒頭コメント）
  なのに、AI バンドの主要 2 パートがオフラインで死んでいた

### v230 の修正

- `sw.js`: `isSampleCdn()` を追加し、サンプル CDN 3 系統を runtime cache 対象に:
  - `tonejs.github.io/audio`（Salamander piano / Casio / Tone デモドラム）
  - `cdn.jsdelivr.net/gh/tidalcycles/dirt-samples`（dirt ドラムキット）
  - `cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments`（guitar / bass /
    strings / flute samplers — AI 再現の既定 guitar/bass を含む）
- cache-first + opaque cache。既存の Tone / Magenta CDN 分岐と同じ形。
  **一度オンラインで再生すれば、以降はオフラインでも実 guitar / bass が鳴る。**
- `sw.js` のみ変更。band-room.{js,html,css} は不変なので `band-room.js?v=br-123`
  据え置き。`hazama-fm-v230`。

### まだ確認が要ること

オンライン状態でも「しょぼい」なら原因は別系統（`startPlayback` が sampler の
サンプルロード完了を待たないため、最初の数小節 guitar / bass が無音 → 後から
pop-in する等）。ユーザーの実機での online / offline 状況の報告待ち。

---

## v229 compact — AI 再現の曲切り替えフリーズ修正（synth lifecycle leak）

ユーザー報告: v228 後、AI 再現は単音は鳴るが、**別の曲を選ぶと固まる**。
「重いのかねえ」。診断したら、重さではなく **synth の後始末漏れ（leak）**
だった。ブラウザ合成が無理なのではない — hazama FM / drum-floor が固まら
ないのは合成が軽いからではなく **dispose（後始末）が正しいから**。AI 再現
はそこが壊れていただけ。直せる種類のバグ。

### 根本原因 — makeDrumKit に dispose が無かった

AI 再現の `make*` factory はヘッド synth の周りに FX chain（filter /
reverb / chorus / 走りっぱなしの LFO）を組むが、歴史的に **ヘッド synth
しか return していなかった** ので、それを dispose しても chain は孤児と
して audio graph に残り続けた。

`makeDrumKit` はさらにひどく、`{ kick, snare, ... }` という **dispose
メソッドの無いただのオブジェクト**を return していた。`buildKitForSource`
は `if (drumKit && drumKit.dispose)` で守っていたので、synth kit では
この guard が黙って空振りし、**古い synth kit が一度も dispose されない**。
鳴りっぱなしのノイズ / オシレータ生成器を約 9 個ずつ漏らしていた。

`applyRecommendedKitProfile` は曲切り替えのたび（kit_profile が違えば）
この rebuild を走らせる。→ 数曲切り替えるだけで孤児のオシレータと LFO が
数十個に積み上がり、オーディオスレッドが振り切れて実機が固まった。
ユーザーの「ガチャガチャして詰まってる」はまさにこれ。

### v229 の修正

- `withChainDispose(node, extraNodes)` helper を追加。factory の戻り値の
  `dispose()` を、ヘッドだけでなく **chain 全体**を畳むようにラップする。
- `makeDrumKit`: 22 ノード全部を畳む dispose を付与（最重要 — drumKit は
  kit_profile 変更ごとに必ず rebuild される）。
- `makeChordSynth` / `makeVoiceBox`: reverb・filter に加え、**走りっぱなしの
  LFO**（autoPan / chorus / vibrato）も畳む。両者とも曲切り替えごとに rebuild。
- `makeSynthBass` / `makeGuitar`: FX chain（filter / distortion / chorus /
  reverb）を畳む。
- `check-band-room-logic.mjs`: v229 assertion を追加。makeDrumKit が
  withChainDispose 経由で return することを固定（leak の再発防止）。
- `band-room.html` / `sw.js`: `band-room.js?v=br-123`、`hazama-fm-v229`。
- agent ロジック・音数・maxPolyphony・原音モードは一切不変。

### まだ残ること

「音がしょぼい / 単音で鳴る」（maxPolyphony 10 で音がドロップする薄さ）は
別問題。v229 は freeze 修正であって音質修正ではない。次ラウンドで agent の
音数を減らす / 実サンプル catalog に寄せる（step 2）。

---

## v228 compact — v227 を revert（device freeze の緊急安全化 / step 1）

ユーザー報告: v227 デプロイ後、AI 再現 を押すと**実機の画面が固まる**。
v227 の修正が freeze を悪化させた。即・安全化。

### v227 が何を間違えたか

v227 は「polyphony flood（音ドロップ）を直す」つもりで `maxPolyphony` を
guitar 10→64 / chord 10→32 に上げた。だが **polyphony cap は実は CPU
保護**だった。`Tone.PolySynth` の voice = 鳴りっぱなしのオシレータ。
上限を 64 にした → synth-heavy な AI モードが guitar ~64 + chord ~32 =
**~96 個のオシレータ**を同時に走らせ、+ ドラムの MetalSynth + 重い FX
（distortion の 2x oversample 等）でモバイル CPU が振り切れ、デバイスが
freeze した。

v227 以前の「Max polyphony exceeded で音を捨てる」flood は耳障りだったが、
voice 数を 10 で頭打ちにすることで**CPU を守る雑なブレーキ**として機能して
いた。v227 はそのブレーキを外し、「音が欠ける」を「デバイスが固まる」に
悪化させた。

### v228 の修正（step 1: 安全化のみ）

- `guitar.maxPolyphony` 64 → **10**（v200-v226 の known-survivable 値に
  revert）
- `chord.maxPolyphony` 32 → **10**（同上）
- これで「固まる」→「鳴る（音は欠けるけど）」に戻り、デバイスが死ぬのを
  止める。v226 と同じ挙動。

### これは step 1 にすぎない

根本問題は変わっていない: **AI agent がブラウザ合成の限界を超える音数を
出している**（guitar 1 小節 24 音 = 8 strum × 3 音）。cap を下げれば音が
欠け、上げれば固まる — どちらも対症療法。

step 2（別ラウンド）で agent の音数自体を激減させ、低い cap でも音が
欠けない密度に設計し直す。実サンプル catalog（`online-samples-catalog.json`
/ `makeRemoteKit` / catalog sampler）の活用もそこで検討。

- `check-band-room-logic.mjs`: maxPolyphony の assertion を「>=48/24」
  （v227 の誤り）から「<=16」（CPU 保護の上限）に反転。二度と 64 に
  上げられないように。
- `band-room.html` / `sw.js`: `band-room.js?v=br-122`、`hazama-fm-v228`。
- agent ロジック・原音モード・他は一切不変。maxPolyphony 2 行のみ。

---

## v227 compact — AI 再現が再生されない根本原因の修正（polyphony flood）

ユーザー報告「AI音源、まともに再生されない。詰まってないか」。診断したら
**AI 再現 mode は v200 以来ずっと壊れていた** — synth の polyphony flood。
v208-v226 の 19 ラウンドは全部 agent の musicality 磨きで、この根本欠陥は
一度も直っていなかった（むしろ note 数を増やして悪化させた面もある）。

### 根本原因

`Tone.PolySynth` は `triggerAttackRelease` を呼んだ瞬間に voice を予約する
— **未来時刻にスケジュールした note も含めて**。band-room の bar scheduler
は 1 回の callback で**1 小節ぶんの note を全部同期的にスケジュール**する。
guitar の recap strum = 8 strum × 3 音 power chord = **1 callback で 24
voice 予約**。ところが `guitar.maxPolyphony = 10`。→ 毎小節 14 音が
`Max polyphony exceeded. Note dropped.` で捨てられていた。

- これが「まともに再生されない」の正体 — 毎小節ランダムに音が欠ける
- `console.warn` が毎秒数百回 flood → renderer が「詰まる」
- v200 の「maxPolyphony 6→10」は**1 小節ぶんの burst すら収まらない**
  半端な数字だった。summary にも "v200 partial polyphony fix didn't
  resolve the hang" と残っていた通り、ずっと未解決のまま。

### 修正

- `guitar.maxPolyphony` 10 → **64**。1 小節 24 音 burst + release tail の
  重なりを 2 倍 headroom で吸収。
- `chord.maxPolyphony` 10 → **32**。3 stab × 4 音 7th chord + v219 の
  1n intro/outro pad の小節跨ぎ + release tail を吸収。
- `Tone.Synth` の voice は安価（oscillator 1 個）なので 64 / 32 でも
  CPU 負荷は問題ない。stems mode は元から synth を鳴らさないので無関係。

### なぜ v208-v226 で気づかなかったか（正直に）

- integrity gate（check-band-room-logic / audit.py / check-js）は
  **コード構造しか見ない**。実 audio runtime の polyphony flood は
  検出できない。
- preview での過去の検証は「ページがロードするか」「mode が切り替わるか」
  止まりで、**実際に START して再生する所までやっていなかった**
  （band-room.html は preview screenshot が time out するので敬遠していた）。
- ユーザーの ship-then-verify 運用に甘えて、AI mode の実再生を 19 ラウンド
  確認しないまま musicality だけ積み上げてしまった。これは反省点。

v227 で初めて preview で synth mode を START まで回し、polyphony flood を
console で確認 → 根本原因特定 → 修正 → flood 消滅を console で確認、という
順を踏んだ。

### preview の検証限界（正直に）

- 修正後 preview で synth mode を回すと「Max polyphony exceeded」警告は
  **完全に消えた**（flood 解消は確認できた）。
- ただし band-room.html は preview 環境で**長時間再生中の eval が応答
  しなくなる**既知の不安定さがあり（screenshot も time out する）、
  bar scheduler の callback 自体は breadcrumb ログで毎小節完走している
  ことを確認したものの、「再生がスムーズに最後まで通るか」までは
  preview では裏取りしきれなかった。
- drums のみ（1 小節 ~10-15 trigger）でも preview eval が固まるのは、
  実ブラウザがその程度の負荷でハングするはずがないので preview 固有の
  artifact と判断。実機での最終確認はユーザーにお願いする形。

- `check-band-room-logic.mjs`: guitar maxPolyphony >= 48、chord >= 24 を
  assert（将来うっかり 10 に戻せないように下限を固定）。
- `band-room.html` / `sw.js`: `band-room.js?v=br-121`、`hazama-fm-v227`。
- agent のロジック（phrase / voicing / swing 等 v208-v226 の成果）は不変。
  今回は polyphony ceiling だけ直して、積み上げた musicality を実際に
  鳴らせるようにした。

---

## v226 compact — システム整合チェック: swing 矛盾の修正 + isJazzyMode 抽出

ユーザー指摘「今、矛盾はない？システム自体の」を受けて v208-v225 の
17 ラウンドぶんを点検。**矛盾を 1 件発見、修正。** + 潜在リスクを 1 件
予防。

### 発見した矛盾: lofi-nujabes profile の swing 方向不一致

`lofi-nujabes` profile に 2 つの相反する timing 美学が乗っていた:
- **drum scheduler (v133):** `DILLA_OFFSETS_BY_PROFILE["lofi-nujabes"]` =
  `{ snareBack: 14, hatOffPush: -4, ghostBack: 8 }`。J Dilla の MPC feel —
  snare が 14ms 後ろにドラッグ、off-beat hat は **-4ms（前ノリ / ほぼ
  grid）**、ghost 8ms 後ろ。小さい offset（4-14ms）。
- **voice (v223) / guitar (v225):** off-beat 8th を **+35ms 後ろ**へ。
  これは bebop / swing-jazz の triplet feel — drum の hat offset とは
  **符号が逆、桁が 10 倍違う**。

→ 同じ off-beat（拍の「ウラ」）で、drum hat は 4ms 前、voice/guitar は
35ms 後ろ。**39ms のズレ**。combo が swing として揃わない。
さらに v223/v225 のコメントは「Dilla offsets と一致（matches）」と
書いていたが**事実と異なる**（-4 ≠ +35）。

profile 名が「lofi-nujabes」（Nujabes = 日本の lo-fi hip hop、J Dilla
隣接）なので、本来の美学は **Dilla の subtle な wonk**であって、
**一様な bebop triplet swing ではない**。v223/v225 で +35ms triplet を
乗せたのが設計ミスだった。

- **修正:** voice / guitar の off-beat swing を **+35ms → +12ms**。
  12ms は drum の `snareBack 14` / `ghostBack 8` と同じ小さいレンジ。
  これで melodic な laid-back が drum の Dilla feel と coherent になる
  （triplet swing を押し付けるのではなく、lo-fi の loose feel に揃える）。
  on-beat（sub 0/4/8/12）は grid-locked のまま — chord stab と同期。
- **コメント修正:** v223/v225 の「triplet-swing」「matches Dilla offsets」
  という不正確な記述を「lo-fi laid-back micro-timing」に訂正。

### 予防した潜在リスク: isJazzy ブール値の 5 重コピー

`state.kitProfile === "lofi-nujabes" || state.chordInstrument ===
"salamander-piano"` という jazz mode 判定が、bass / chord / voice /
guitar×2 の 5 箇所に**手書きコピー**されていた。今は 5 つとも byte 一致
なので動作上の矛盾はないが、1 箇所だけ直して他を直し忘れると agent 間が
silent に desync する **drift リスク**。

- **修正:** `isJazzyMode()` ヘルパー関数を 1 つ定義、5 箇所をすべて
  `isJazzyMode()` 呼び出しに置換。single source of truth 化。

### 点検して矛盾なしと確認した箇所

- bass agent: v221 walking の早期 return が v216 octave-lift コードより
  前 → jazzy mode で v216 コードは到達せず（dead code なし、v221 の
  「skip bar 2 octave lift in jazz」コメント通り）
- v217 section-end fill / v106 section crash / v220 gain ramp → それぞれ
  「旧 section 最終 bar」「新 section bar 0」「新 section bar 0」で発火、
  タイミング衝突なし、相補的
- v209 drum phrase mult / v216 bass phrase mult / v220 section gain →
  別レイヤーの dynamics として意図的に積算（矛盾ではない）
- v218 voice leading（過去参照）/ v222 walking-bass lookahead（未来参照）
  → chord と bass で別方向を見るが互いに干渉しない
- version 番号 v208→v226 / cache buster br-96→br-115 → 連番、欠番なし

- `check-band-room-logic.mjs`: `isJazzyMode` ヘルパーの存在、swing が
  12ms であることを assert（旧 35ms / 旧 isJazzySwing 宣言の assert を更新）。
- `band-room.html` / `sw.js`: `band-room.js?v=br-115`、`hazama-fm-v226`。

機能変更は voice/guitar の swing 量のみ（35→12ms）。それ以外は
リファクタ（isJazzyMode 抽出）とコメント訂正で、出音の他の部分は不変。

---

## v225 compact — guitar agent: jazz-sparse comping rhythm（Charleston + swing）

v224 で jazz mode の guitar voicing を power chord → shell voicing に
直した。次は strum の **rhythm**。`guitarAgentPlan` の既存パターンは
8th-note 連打（recap）や [0,4,6,8,12,14] grid（default）で、jazz combo
には密すぎる。jazz ギターは「空間を残す」 — 疎でシンコペーション。

- **修正:** `guitarAgentPlan` の冒頭に jazz comp 分岐を追加。
  `isJazzy` 判定（他エージェント v218-v224 と同じ）。
  `outro` / `break` / `intro` 以外の jazz mode のとき:
  - **jazzGrid** = `recap` なら `[0, 6, 10]`、それ以外 `[0, 6]`
  - `[0, 6]` = Charleston リズム（beat 1 + "and of 2"）。jazz / スウィングの
    最も象徴的なギターコンピングパターン
  - `recap` は "and of 3"（sub 10）を足してエネルギー up
  - off-beat 8th 位置（sub 6 / 10）は `microMs += 35` で swing。v223 の
    voice swing と同じ値。これで comp が Dilla ドラム + swing メロディと
    揃って swing する
  - accent map にヒットがあれば velocity を少し持ち上げ（drum-frames
    との connection 維持）、beat 1 (sub 0) は +0.08 accent
- **疎にする狙い:** dense strum は chord pad（v218）+ walking bass
  （v221）と帯域 / リズムで喧嘩する。Charleston の 2 ヒットなら、
  ピアノ・ベース・ドラムの隙間に「コードのアクセント」を置くだけになり、
  jazz combo の各楽器が呼吸できる。
- **outro / break / intro はそのまま:** outro は 1n ロングコード、break
  は 2 スタブ、intro は pressure 低なら無音 — それぞれ既存の意図を
  温存。jazz comp 分岐はこの 3 role を除外。
- 非 jazzy mode（default / sakanaction / lcd-motorik / cramps-punk）は
  完全不変。8th 連打 / grid strum 維持。
- `check-band-room-logic.mjs`: jazz comp 分岐の判定と jazzGrid
  （`[0, 6, 10]` / `[0, 6]`）、off-beat swing を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-114`、`hazama-fm-v225`。

**jazz mode guitar 完成（v224 voicing + v225 rhythm）:**
- voicing: 7th shell（root + 3rd + 7th）+ phrase inversion rotation
- rhythm: Charleston comp（sparse + syncopated）+ off-beat swing
power chord 8th 連打のロックギターから、shell voicing で Charleston を
弾く jazz コンピングギターに完全に置き換わった。

---

## v224 compact — guitar agent: jazz mode に shell voicing（power chord 退役）

jazz mode の同期を v218-v223 で進めてきたが、guitar だけが
`powerChordNotes(ctx.chord, 3)`（root + 5th + octave）の power chord の
ままだった。**power chord は jazz combo の中で完全に浮く** — ロック /
パンクの音。jazz ギターは shell voicing（root + 3rd + 7th、5th を抜く=
Freddie Green スタイル）でコンピングする。

- **修正:** `triggerGuitarAgent` に jazz mode 分岐を追加。
  `isJazzy = state.kitProfile === "lofi-nujabes" || state.chordInstrument
  === "salamander-piano"`（他エージェントの v218/v221/v223 と同じ判定）。
  jazz mode のとき:
  - chord agent の v218 と同じ 7th 拡張を適用（`m\b|min\b` なら m7、
    それ以外 maj7）
  - `chordToNotes(voicingChord, 3)` で `[root, 3rd, 5th, 7th]` を生成
  - **shell voicing にする = `[full[0], full[1], full[3]]`（root, 3rd, 7th、
    5th = index 2 をドロップ）**
- **なぜ shell voicing（5th を抜く）:**
  - 3rd がメジャー / マイナーの色を担う
  - 7th がコードの jazz テンションを担う
  - 5th は和声的に冗長 — 抜くと voicing がすっきりして、bass の
    walking（v221）や chord pad（v218）と帯域が被らない
  - Freddie Green（Count Basie Orchestra のギタリスト）の comping が
    まさにこれ。jazz ギターコンピングの教科書的アプローチ
- **既存の voicing rotation はそのまま効く:** v212 の
  `GUITAR_INVERSION_BY_PHRASE = [1, 0, 2, 0]` による phrase 別 inversion
  回しは shell voicing にもかかる。shell には重複音がないので
  `new Set` dedup は no-op（power chord のときだけ意味があった）。
- **octave 配置:** guitar の shell は octave 3、chord agent の pad は
  octave 4。guitar が chord pad の下でコンピングする標準的なアレンジ
  配置。bass walking はさらに下（chordToSemi の C2 baseline）。
- 非 jazzy mode（default / sakanaction / lcd-motorik / cramps-punk）は
  完全不変 — power chord 維持。ロック / ダンスでは power chord が正解。
- `guitarAgentPlan` の strum パターン（accent reaction / role 別 grid /
  strum 密度）は今回不変。voicing だけ差し替え。jazz 用の sparse comping
  rhythm への切替は次ラウンド候補。
- `check-band-room-logic.mjs`: jazz 分岐の判定と shell voicing 生成
  （`[full[0], full[1], full[3]]`）を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-113`、`hazama-fm-v224`。

**jazz mode 5 エージェント同期 — voicing / timing 完備:**
- drum: lofi-nujabes Dilla offsets（v133）
- bass: walking + chromatic lookahead（v221 + v222）
- chord: voice leading + 7th 拡張 + sustained pad（v218 + v219）
- voice: triplet-swing + phrase contour（v211 + v223）
- **guitar: 7th shell voicing + inversion rotation（v212 + v224）**

power chord が消えて、jazz combo として帯域 / 和声 / タイミングすべてが
噛み合う状態。

---

## v223 compact — voice agent: jazz mode に triplet-swing feel

drum scheduler は v133 以来 profile 別 Dilla offsets を持っていて
（lofi-nujabes は snareBack 14ms / hatOffPush -4ms / ghostBack 8ms）、
ドラムは jazz mode で swing する。**でも voice agent は profile に関係
なく straight タイミング**で、メロディが drum の swing と噛み合って
なかった。jazz combo を作るなら voice もスウィングするのが筋。

- **修正:** `voiceAgentPlan` の `source.map(...)` ループ内で:
  - `isJazzySwing = state.kitProfile === "lofi-nujabes" ||
    state.chordInstrument === "salamander-piano"` を判定
  - `isOffBeat8th = (hit.step % 4) === 2`（sub 2 / 6 / 10 / 14、
    つまり 8th note の off-beat 位置）
  - jazzy && off-beat のとき `microMs: (hit.microMs || 0) + 35`
- **35ms の根拠:**
  - 120 BPM で 8th note = 250ms、triplet feel の 8th = 250 × 2/3 ≈ 167ms
  - off-beat を grid 上の 125ms から 167ms 付近まで遅らせる = +42ms
  - 35ms は「ややスウィング寄り、強くない」設定 (60% swing 程度)
  - 強すぎると "シャッフル" に寄って原曲の感じから離れる。35ms はジャズ
    の中庸
- **on-beat は grid 維持:** sub 0 / 4 / 8 / 12 は chord stab と同期しないと
  違和感が出る（chord と voice が別タイミングで鳴ってる感）。on-beat は
  swing しない、off-beat だけ後ろにドラッグするのが正解。
- **Human Fly recap の hardcoded melody は無関係:**
  `state.currentSongId === "human-fly" && ctx.role === "recap"` は
  早期 return で別経路、jazz swing は適用されない。Human Fly が jazzy
  profile で鳴ることは現実的に少ないし、固定 melody は曲の identity。
- **これで jazz combo 同期完成:**
  - drum: lofi-nujabes Dilla offsets（v133）
  - bass: walking quarter notes + chromatic lookahead（v221 + v222）
  - chord: voice leading + sustained pad（v218 + v219）
  - **voice: triplet-swing on off-beats（v223 新規）**
  - guitar: 既存の accent reaction
  jazz mode 全パートが互いに swing と voice leading で同期する。
- 非 jazzy mode（default / sakanaction / lcd-motorik / cramps-punk）の
  voice agent は完全不変。straight タイミング維持。
- `check-band-room-logic.mjs`: `isJazzySwing` 判定と +35ms 適用条件を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-112`、`hazama-fm-v223`。

---

## v222 compact — next-chord lookahead で walking-bass を chord change に連動

v221 で jazz mode bass を walking line（root → 5th → 3rd → 7th）に
切り替えた。beat 4 が固定で 7th だったが、本物の walking bass は
beat 4 で **次のコードへの chromatic approach note** を弾く。これで
chord change のたびに「滑り込む」感が出る。

- **追加 — chordAtBarInProgression(prog, bar) helper:** 既存の
  `updateChordDisplay` 内のコード（chord 配列の bar 累積走査 + loop）を
  抽出して関数化。今後の lookup ロジックを共有。
- **追加 — nextChordLookahead() helper:**
  - 現在のセクション + barInSection + 1 が同セクション内 → そのまま
    `chordAtBarInProgression(prog, nextBar)` で次 bar のコードを返す
  - セクション境界を跨ぐ場合（barInSection + 1 >= sec.bars）→
    `state.songData.structure[state.sectionIdx + 1]` の最初のコードを返す
  - 次セクションなし / progression なし → null
- **ctx.nextChord に格納:** `makePartAgentContext` の return オブジェクトに
  `nextChord: nextChordLookahead()` を追加。全エージェントから参照可能。
- **bass agent v221 walking の beat 4 を更新:**
  - `ctx.nextChord` が存在 かつ next root ≠ current root のとき
    → beat 4 = `semiToNote(nextRootSemi - 1)`（next root の半音下、
      leading-tone-from-below）
  - 同じコードが続く or lookahead 失敗 → beat 4 = `semiToNote(seventh)`
    （v221 既存挙動を fallback として維持）
- **leading-tone-from-below を選んだ理由:**
  - jazz の walking bass の最も一般的な beat 4 move
  - V7 → I の dominant resolution（例 G7 → C: F# が C を半音下から approach）
    と一致
  - lookahead に key analysis を持ち込まずに（chromatic で）成立する
  - 上から approach（nextRoot + 1）は marginal に少ないので採用見送り
- **chord agent は無変更:** v218 の voice leading（直前 top note 最短距離）
  はそのまま。chord と bass で参照する lookahead 方向が違う
  （chord: 過去 / bass: 未来）ので、両方を別 fix で持たせて
  互いに干渉しない。
- 非 jazzy mode は完全不変。`isJazzy` 分岐の中だけ変更。
- `check-band-room-logic.mjs`: nextChordLookahead 関数、ctx.nextChord、
  bass の beat4Semi 分岐を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-111`、`hazama-fm-v222`。

**実例 ii-V-I の動き（Dm7 → G7 → Cmaj7）:**
- bar 1 (Dm7): D → A → F → **F#** (next G7 の半音下、v222 新規)
  - v221 だと C（Dm7 の 7th）で終わってた、G への接続が遠い
- bar 2 (G7): G → D → B → **B** (next Cmaj7 の半音下、v222 新規)
  - v221 だと F（G7 の 7th）で終わってた、たまたま leading でこれは
    どちらも正解だが、v222 だと意図的な動きとして読める
- bar 3 (Cmaj7): C → G → E → B (next chord 同じ or 不明 → 7th 維持)

ii-V-I のような common jazz changes が「ちゃんと walking として繋がる」
ようになる。

---

## v221 compact — bass agent: jazzy walking-bass（chord と対の動き）

v218 で chord agent に jazz mode voice leading を入れたとき、bass は
そのまま kick-locked のままだった。実ジャズでは **ベースが drummer の
キックに乗らずに独立した 4 つ打ち walking line を弾く**のが基本。
bass まで kick lock していると、AI 再現 mode を lofi-nujabes 寄せして
ピアノ voicing を滑らかにしても、ベースだけ「ロックのままじゃん」と
浮いていた。

- **修正:** `bassAgentPlan` に jazz mode 分岐を追加。
  `isJazzy = state.kitProfile === "lofi-nujabes" || state.chordInstrument
  === "salamander-piano"` の判定（chord agent の v218 と同じ）。
  jazz mode のとき:
  - kick-locked source を完全スキップ
  - 4 quarter notes per bar の固定 walking pattern:
    - beat 1 (sub 0): **root** (vel 0.50)
    - beat 2 (sub 4): **5th** (vel 0.42)
    - beat 3 (sub 8): **3rd** (vel 0.42)
    - beat 4 (sub 12): **7th** (vel 0.46)
  - 各 step に PHRASE_VEL_MULT_BASS を掛ける（フレーズ呼吸は維持）
  - bar 2 オクターブリフトは **適用しない**（jazz dynamics は subtle で
    walking line を維持する方が正解）
  - 既存 role embellishment（recap/comp + pressure>0.52 で sub 14 に
    3rd+12 の 16n）は jazzy mode でも適用（コーラスで extra punch）
  - `break` role は除外（break で walking 続行は不自然）
- **なぜ root → 5th → 3rd → 7th:**
  - root: 拍頭でコードを宣言
  - 5th: 半カデンツ的安定音
  - 3rd: 長/短調を示す色彩音
  - 7th: 次のコードへの leading tone になりやすい（G7 の 7th = F →
    Cmaj7 の root C へ半音下行）。lookahead なしでも progression の
    多くで自然に繋がる音選び。
- **chord agent との分業:** v218 で chord は voice leading（top note 最短
  距離の inversion）、v221 で bass は walking（chord tone を 4 拍に
  並べる）。jazz の chord-bass コンビが分業して動く形が成立。
- **非 jazzy mode は完全不変:** kick-locked + phrase shape + bar 2
  octave lift（v216）はそのまま。rock/dance の bass はそれが正解。
- `check-band-room-logic.mjs`: jazz walking 分岐の判定と walk pattern
  （root → fifth → third → seventh、sub 0 / 4 / 8 / 12）を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-110`、`hazama-fm-v221`。

これで Tabasco / I got a feeling や Hey を lofi-nujabes profile + voice
leading + walking-bass の組み合わせで聴くと、「ピアノ + 立っているベース」
の jazz combo っぽい質感に寄る。

---

## v220 compact — section-aware global dynamics（instrumentBus gain ±5%）

v208-v219 で各エージェントの「演奏者単位の dynamics」（phrase / voicing /
fill）を整えた。次の層は **section 単位の global dynamics** — 実バンドの
曲は verse 控えめ / chorus で持ち上げ / intro/break で引く、という section
ごとの大きな抑揚があるが、AI 再現 は今まで section が変わっても全体音量が
同じだった。

- **修正:** `instrumentBus`（non-vocal polish bus）を module-level に hoist。
  scheduleBar の section 切替検出ブロックと、第 1 bar（`barCount === 0`）の
  両方で `rampInstrumentBusForSection(sec, time)` を呼ぶ。0.5s 線形 ramp で
  pump artifact なし。
- **role → gain マッピング:**
  - `intro` / `break`: **0.85** （控えめ、雰囲気作り）
  - `verse`: **0.95** （settled、後ろに引いて voice を立てる）
  - `comp` / `head`: **1.00** （ニュートラル）
  - `outro` / `swell`: **0.92** （静かに winding down）
  - `recap` / chorus 相当: **1.05** （持ち上げ、曲の頂点）
  - `post`: **0.96** （recap 後の落ち着き）
  - その他: 1.00 fallback
- **±5% の幅** は polish bus の glue comp（ratio 2.2、attack 12ms、release
  180ms）の許容範囲。これ以上振ると comp pumping artifact が出る。逆に
  小さすぎると section ごとの差がほぼ聞こえない。0.5s ramp で transition
  自体も自然。
- **stems mode は no-op:** stems は `stemBus.* → masterGain` 直結で
  instrumentBus をバイパスする経路。`rampInstrumentBusForSection` 内で
  `currentMode !== "synth"` の early return も入れてる。stems mode の
  音量は不変。
- **drum scheduler の section change crash と組み合わせ:**
  - section 最後の小節: V3 forced fill（v217）
  - 次 section bar 0 downbeat: crash 1 発（v106、リフト section のみ）
  - 同 bar 0: **instrumentBus.gain を新 role の target へ 0.5s ramp（v220）**
  → 「pickup + crash + gain lift」の section transition フル装備。
- 既存 5 agent / kit_profile / voice leading / sustained pad は不変。
- `check-band-room-logic.mjs`: `sectionGainForRole` / `rampInstrumentBusForSection`
  / module-level `instrumentBus` 宣言の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-109`、`hazama-fm-v220`。

これで曲全体が「録音 / produced された band」っぽく聞こえる方向にもう一段
寄る。Tabasco / Hey の verse → chorus → verse などで「サビが少し前に出る」
感がはっきり読める範囲の差。

---

## v219 compact — chord agent: intro/outro に sustained pad（1n で雰囲気作り）

v218 で jazz mode の voice leading を入れた流れで、次は **intro/outro の
雰囲気作り**。現状の chord agent は intro/outro でも downbeat の dur が
`"2n"`（半小節）。1 小節 = 4 拍のうち 2 拍だけコードが鳴って残り 2 拍は
release tail（~0.5s）と静寂、というのを毎小節繰り返してた。intro として
は「pad で雰囲気作り」より「ぶつ切りスタブ」感が強かった。

- **修正:** `chordAgentPlan` の `downbeatDur` を:
  - `break`: `"4n"`（変更なし）
  - `intro` / `outro`: `"1n"`（**全小節 hold**、新規）
  - その他: `"2n"`（変更なし）
- **効果:** intro / outro でコードが 1 bar まるまる鳴って、release tail
  が次 bar の attack に overlap する。これで:
  - intro = pad swell 的な atmospheric build
  - outro = 余韻のある winding down
  どちらも実バンドの曲の始まり / 終わりっぽい質感に寄る。
- **既存 agent との整合:**
  - voice agent: `intro`/`outro` で早期 return（空配列）→ メロディが
    競合しない。pad だけが鳴る、というクリーンな構図。
  - guitar agent: `outro` で既に `"1n"`（v200 以前から）。intro は
    pressure 低くて crash なしなら早期 return、それ以外は通常 strum。
    今回の chord 1n と意図が揃う。
  - drum: intro/outro はフィル抑制（v107 以来）、drum-frames events
    のみ。
- **release tail と overlap:** chord synth profile の release は default
  0.5s、lcd-motorik 0.85s、cramps-punk 0.25s など profile 依存。120 BPM
  なら 1 bar = 2 秒なので、release が 0.5s でも overlap は 25% bar 分。
  swell として読める範囲。
- bass / kit_profile / voice leading は不変。chord agent の downbeat dur
  だけ調整。
- `check-band-room-logic.mjs`: intro/outro 時 1n、それ以外 2n の三項分岐
  を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-108`、`hazama-fm-v219`。

これで Tabasco album の TABASCO（intro 4 bar）や Sister（outro 8 bar）
など intro/outro が長めの曲で、AI 再現 mode の入りと終わりに「band の
呼吸」が出る。

---

## v218 compact — chord agent: jazzy mode 用 voice leading（実ジャズピアニスト的）

v210 で入れた `INVERSION_BY_PHRASE = [0, 1, 2, 0]` のフレーズ rotation は
rock / dance には合うけど、jazz / lofi では「機械的すぎる」。実ジャズ
ピアニストはコード変更時に**次のコードまで最短距離の voicing**を選ぶ
（voice leading）。bar ごとに inv を強制ローテーションするのは可動部品が
多すぎる。

- **修正:** `kitProfile === "lofi-nujabes"` または `chord_instrument ===
  "salamander-piano"` のとき（isJazzy = true）、phrase rotation の代わりに
  **voice leading 探索**を実行:
  - 4 つの inversion（root / 1st / 2nd / root+oct）すべての top note を
    計算
  - 直前 bar の top note (`lastChordTopNote`、semi 値) との距離を計算
  - 距離最小の inversion を採用
  - 採用した inversion の top note を `lastChordTopNote` に格納（次 bar
    用）
- **非 jazzy mode は無変更:** default / sakanaction / lcd-motorik /
  cramps-punk profile は引き続き phrase rotation。rock の chord stab は
  「機械的でいい」 — むしろグリッドにロックしてる方が rock feel。
- **`lastChordTopNote` リセットタイミング:**
  - song 切替: `loadSong` 冒頭で `null` にリセット → 新曲は最初のコードの
    自然な root-position voicing から始まる
  - section 切替: リセットしない → section をまたいでも voice leading が
    流れる（real ピアニストの感覚）
  - 初回（`lastChordTopNote === null`）: phrase rotation にフォールバック
    → 最初の bar は意味のある voicing 起点を決められない
- **計算コスト:** 4 inversion × `chordInversion()` (≈ chord 3-4 音 sort) =
  bar 毎 ≈ 60-80 演算。1m スケジューラの中なのでまったく問題なし。
- bass / drum / voice / guitar / kit_profile auto-map は不変。
- `check-band-room-logic.mjs`: `lastChordTopNote` の存在、voice leading
  探索ループ、loadSong でのリセットを assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-107`、`hazama-fm-v218`。

**効果:** Tabasco / I got a feeling や Hey を lofi-nujabes / salamander-piano
の組み合わせで聴くと、コード stab が「ピアノが滑らかに動く」感じに寄る。
Em7 → Am7 → Dmaj7 → G7 のような progression で、top note が
B → C → C# → B みたいに半音単位で動くようになる（root-position だけ
なら B → E → F# → D で大ジャンプ）。

---

## v217 compact — AI 再現 section transition: 最終小節フィル強制

v208-v216 で 5 エージェントの「4 小節フレーズ内」呼吸を整えた。次は
section 境界の処理。現状 4-bar フィルは `(barInSection + 1) % 4 === 0`
で 4 小節周期だけ。section の bar 数が 4 で割り切れない（6 小節 verse、
10 小節 chorus、など）と、section の最後の小節がフィルなしで次セクションに
急に飛び込む状態だった。実バンドは section 切替直前に必ず何かしらフィル /
ピックアップを入れる。

- **修正:** `isSectionEnd = (barInSection === barsInSection - 1)` を計算し、
  - 既存の 4-bar フィル条件（`isFillBar`）に加えて
  - `isFillBar` が立たない section 最終小節（`isForcedSectionEndFill`）も
    フィル発火するように。
  - 強制フィルは **V3（sparse tom-tom リードイン）固定**: 既存の 4-bar
    ローテーション（V0 tom roll / V1 snare build / V2 kick-snare / V3 sparse）
    の中で、最も「次のセクションへ繋ぐ」感じが出るのが V3 だから。busy な
    V0-V2 だと「終わりに向かって暴れる」になっちゃう、V3 は隙間を残しつつ
    上昇する tom-tom リードインなので transition pickup として機能する。
  - 4-bar fill と section-end fill が同じ小節に重ねて発火することはない
    （`isFillBar || isForcedSectionEndFill` の or 条件、かつ
    `isForcedSectionEndFill = isSectionEnd && !isFillBar`）。
- **既存の section-change crash と組み合わせて:** band-room.js には元々
  「新しい section に入る downbeat に crash を 1 発鳴らす」処理がある
  （`if (newSec && drumKit.crash && currentMode === "synth")` 経路）。
  これと v217 の section-end fill が重なって、こうなる:
  - section の最後の小節: V3 sparse tom-tom リードイン（last quarter）
  - 次 section の最初の小節 downbeat: crash 1 発
  → 「ピックアップ + crash で section 切り替え」のクラシックなドラマー move
    が実現。
- **intro / outro はそのままスキップ:** 既存条件 `role !== "intro" && role
  !== "outro"` を維持。intro の終わりは「無音から立ち上がる」演出のために
  あえてフィルしない、outro はもう既に賑やか、というデザインを温存。
- bass / chord / voice / guitar agent は不変。drum scheduler のフィル発火
  条件だけ変更。
- `check-band-room-logic.mjs`: `isForcedSectionEndFill` と
  `barsInSection - 1` の参照、強制フィルが V3 固定であることを assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-106`、`hazama-fm-v217`。

これで section 構造が 4 の倍数でない曲（Tabasco の多くがそう）でも、AI
再現 mode が section 切替で「ピタッと止まって急に次へ」じゃなく「フィル
で繋ぐ」流れになる。

---

## v216 compact — AI 再現 bass agent に phrase 呼吸（5 エージェント polish 完結）

v208 から続けてきた AI 再現 polish シリーズで、最後に flat だった
**bass agent** に phrase shape を追加。これで drum / chord / voice / guitar /
**bass** の 5 エージェント全部が 4 小節フレーズで連動して呼吸する。

- **現状の bass:** `ctx.kick` を読んで root/fifth/octave/seventh を音域配置する
  ロジックは元から動いていて、kick との lock は取れている（v208 以降不変）。
  だが velocity も音域も毎小節同じパターン。他 4 エージェントが phrase shape
  を獲得した中で bass だけが flat だった。
- **修正 1 — phrase velocity shape:** `PHRASE_VEL_MULT_BASS = [0.96, 1.00,
  1.06, 0.98]` を `phrasePos = ctx.barInSection % 4` で引いて全 vel 計算に
  掛ける。drum (`[0.95, 1.00, 1.04, 0.98]`) よりわずかに大きい振れ幅（±6%）
  にしたのは、bass はノートが長く鳴るのでわずかな velocity 差でも phrase
  lift がはっきり読めるから。
- **修正 2 — bar 2 ダウンビートのオクターブリフト:** phrasePos === 2 のとき
  だけ、downbeat（hit.step === 0）の音だけを 1 オクターブ上げる。実バンドの
  ベーシストもフィル小節の前の小節で「ちょっと上に飛ぶ」のはよくある move。
  break / intro / outro では適用しない（section が静かに作られている部分は
  そのままに）。
- **既存の追加 step（recap/comp pressure>0.52、verse ghost）にも phraseMult を
  掛ける**：bass の音量はどの step も同じ phrase 抑揚を受ける。
- **5 エージェント連動の効果:** bar 2 では:
  - drum: phrase mult 1.04 で peak
  - chord: sub 14 anticipation 8n でフィル小節へリードイン
  - voice: contour descending（h → m → r → m）で settling
  - guitar: inv 2 で register lift（high voicing）
  - bass: 1.06 vel + downbeat オクターブ↑ で peak
  全パートが「フィル小節へ向かう climax」として同期する。
- `check-band-room-logic.mjs`: `PHRASE_VEL_MULT_BASS = [0.96, 1.00, 1.06,
  0.98]` と `liftBar2Downbeat` の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-105`、`hazama-fm-v216`。
- bass agent 以外は無変更。stems モード / chord_progression / sampler 切替は
  すべて不変。

**AI 再現 v208 → v216 シリーズ 完結ラインナップ:**
| ver | エージェント / 領域 | 中身 |
|-----|-----|-----|
| v208 | drum kit | 規定値 `auto-self` → `synth`（drum-floor groove） |
| v209 | drum scheduler | 4 種フィルローテーション + phrase velocity 抑揚 |
| v210 | chord agent | inversion rotation + phrase-aware rhythm |
| v211 | voice agent | 4 小節 phrase contour（上昇 → ピーク → 下降 → 閉じ） |
| v212 | guitar agent | power chord voicing rotation（chord と weave） |
| v213 | kit profile | band/song ごとの timbre 自動マッピング基盤 |
| v214 | kit profile | Tabasco 残り曲に kit_profile 仮置き |
| v215 | kit profile | auto-apply が 1 曲しか効かないバグ修正 |
| **v216** | **bass agent** | **phrase velocity shape + bar 2 オクターブリフト** |

5 エージェント phrase 呼吸完結。次は synth voice 細部チューニング、UNRIPE
drum-frames 生成、master polish bus の AI モード A/B、など。

---

## v215 compact — kit_profile 自動マッピングの「最初の 1 曲しか効かない」バグ修正

ユーザー監査要望「なり方に、エラーとか、重複とか、バグとかないよね？」に
対する runtime 検証で発覚した機能バグの修正。

- **症状:** v214 で謳った「Tabasco album を頭から流すと曲ごとに synth voice
  の timbre が変わる」が、**実際は最初の 1 曲だけしか auto-apply されない**。
  以降は最初の auto-apply の profile に固定される。
  - 再現: dropdown で "default" を選んでから Hey → `sakanaction` に自動切替
    （✓ 期待通り）→ そのまま Electric Sheep に進むと `sakanaction` のまま
    （✗ `lcd-motorik` になるはず）
- **原因:** v213 で `applyRecommendedKitProfile()` の判定を
  `state.kitProfile === "default"` で書いていた。最初の auto-apply で
  state が "sakanaction" になると、次の曲では `state !== "default"` で
  auto-skip されてしまう。実装が**「ユーザー手動 pick」と「自動適用結果」
  を区別できていない**のが根因。
- **修正:** `state.kitProfileExplicitlyChosen` フラグを導入。
  - profileSel の change handler は **dispatch の出所**を区別:
    `state.__kitProfileAutoApplying === true` のときは自動適用なので
    flag を変更しない。それ以外は手動 click と判断。
    - 手動で "default" 以外を選ぶ → `kitProfileExplicitlyChosen = true`
    - 手動で "default" を選ぶ → `kitProfileExplicitlyChosen = false`
      （「auto-pick mode 再開」の意味）
  - `applyRecommendedKitProfile()` の判定は `state.kitProfileExplicitlyChosen`
    だけを見るように変更。dispatch の前後で `state.__kitProfileAutoApplying`
    を立てて try / finally で確実に降ろす。
- **動作確認:** preview 上で再テスト予定。期待される flow:
  - Boot → kitProfile = "default"、explicit = false
  - Hey load → applyRecommended で sakanaction、explicit = false（auto）
  - Electric Sheep load → applyRecommended で lcd-motorik、explicit = false
  - Human Fly load → applyRecommended で cramps-punk、explicit = false
  - ユーザーが手動で "lofi-nujabes" 選択 → explicit = true、以降の曲では
    auto-skip。dropdown で "default" を選び直せば auto resume。
- **v213/v214 のドキュメントを実態に合わせる:** v213 / v214 entry の「
  state.kitProfile === 'default' のときだけ auto-apply」という説明は
  v215 で **「ユーザーが明示的に pick していないときだけ auto-apply」**に
  変わる。「default = auto-pick mode」という UX 約束は同じ。
- `check-band-room-logic.mjs`: `kitProfileExplicitlyChosen` と
  `__kitProfileAutoApplying` の存在、判定が flag ベースになっていることを
  assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-104`、`hazama-fm-v215`。

これで v214 で配った per-song timbre が album を通して効くようになる。

---

## v214 compact — Tabasco 残り曲に kit_profile 仮置き（A/B 起点）

v213 で作った band/song レベルの自動マッピング機構を活用し、Tabasco の
残りの曲にも初期推奨 profile を BPM / genre cue ベースで仮置き。
ユーザー試聴で違和感があれば dropdown で上書きできる前提の出発点。

- **追加マッピング:**
  - `tabasco / hey` (123 BPM, G major): `"sakanaction"`
    - dance rock 寄りの曲調、`sakanaction` profile は「タイト kick /
      クリッキー hat / ブライト synth bass」で合いそう
  - `tabasco / electric-sheep` (129 BPM, E minor): `"lcd-motorik"`
    - 曲名通り electric 系、`lcd-motorik` の「4-on-floor / cowbell /
      pad swell / sub-y bass / dreamy pad」と相性◎
  - `tabasco / under-the-moon` (161 BPM, Bb major): `"lcd-motorik"`
    - 高速 4 つ打ち feel と krautrock 寄りの motorik profile
- **そのまま band default を継承（"default"）:**
  - tabasco (title track, 136 BPM)
  - i-got-a-feeling (117 BPM)
  - sister (117 BPM)
  - これらは「mixture rock」のド真ん中なので LCD + Backdrop Bomb の
    `default` profile がベース。
- **すでに割当済み（v213）:**
  - tabasco / human-fly: `"cramps-punk"` (The Cramps "Human Fly" カバー)
- **UX 規約は v213 と同じ:** `state.kitProfile === "default"` のときだけ
  自動適用。ユーザーが手動で別の profile を選んだら、その選択は曲
  切替で上書きされない。
- **コード変更なし** — bands.json のみ。`applyRecommendedKitProfile()`
  は v213 で既に実装済みで、新しい `kit_profile` フィールドを自動で
  拾う。
- `check-band-room-logic.mjs`: 新規 3 曲の `kit_profile` 値を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-103`、`hazama-fm-v214`
  (band-room.js 本体は変更なしだが、PWA / cache buster 整合のため bump)。

これで Tabasco album を流すと曲ごとに synth voice の timbre が
変わる体験になる: `default` → `sakanaction` → `default` → `lcd-motorik` →
`lcd-motorik` → `cramps-punk` → `default` の順で巡る。

---

## v213 compact — kitProfile 自動マッピング（band/song 推奨を bands.json で）

v208-v212 の AI 再現 5 パート polish が一段落。次はサンプル swap の
入り口として、**band / 曲ごとに synth voice の timbre 推奨を持つ**仕組み。
ユーザー要望「サカナクション / LCD 調にできたら楽しい」「メンバーの感覚や
出音再現」への布石。

- **bands.json に推奨フィールド追加:**
  - band level: `kit_profile_default`
    - tabasco: `"default"` (LCD + Backdrop Bomb mixture、明示)
    - unripe: `"cramps-punk"` (Okinawa hardcore postpunk)
  - song level: `kit_profile`（band default を上書き）
    - tabasco / human-fly: `"cramps-punk"` (これは The Cramps の "Human Fly"
      カバーで、cramps-punk profile はまさにこの曲のために命名されている)
- **`applyRecommendedKitProfile()` を追加:** `loadSong` の data set 直後に
  呼ぶ。
  - `state.kitProfile` が `"default"` のときだけ自動適用する設計。
    "default" = "曲に決めさせる" の意味として扱う。
  - 推奨は `songMeta.kit_profile || band.kit_profile_default` の順で解決。
  - 解決後、`br-kit-profile-select` の value を更新して `change` を dispatch
    すれば既存の rebuild 経路（synthBass / chordSynth / voiceSynth / drumKit
    の再生成）にそのまま乗る。
- **明示ユーザー pick は尊重:** sakanaction / lcd-motorik / cramps-punk /
  lofi-nujabes を手動で選んだ後は band/song を切り替えても上書きされない。
  再度自動に戻したければ dropdown で "default" を選ぶ。これは「お気に入りの
  音色で全曲ぶん通したい」UX と「曲ごとの推奨音色」UX の両立を狙った
  シンプルな規約。
- **localStorage prefs との整合:** 既存の `applyPrefs(prefs)` は
  `prefs.kitProfile` を boot 時に復元する。保存値が "default" なら今回の
  自動マッピングが効き、保存値が他の何かなら自動マッピングはスキップされる。
  v213 以前から触ってないユーザーは保存値が "default" のままなので、初回
  v213 起動時に **UNRIPE = cramps-punk / Human Fly = cramps-punk** が
  自動適用されて聞こえ方が変わる体験になる。
- **bands.json 自体は precache 済み** (sw.js の PRECACHE_URLS に既に含まれて
  いる)。今回はフィールド追加のみで file path は変えてないので sw 側は
  cache buster の bump だけで済む。
- `check-band-room-logic.mjs`: `applyRecommendedKitProfile` 関数の存在と、
  bands.json の `tabasco/human-fly.kit_profile === "cramps-punk"` と
  `unripe.kit_profile_default === "cramps-punk"` を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-102`、`hazama-fm-v213`。

---

## v212 compact — AI 再現 guitar agent に voicing rotation（chord と weave）

v208 / v209 / v210 / v211 と AI 再現 全パートのフレーズ呼吸を整えてきた
仕上げ。最後に flat だったのが guitar — `triggerGuitarAgent` が
`powerChordNotes(ctx.chord, 3)` を bar の頭で 1 回だけ呼んで、その同じ
`notes` を全 step に流し込んでいた。つまりギターは毎小節同じ voicing
（root, fifth, root+oct）でストラム / バッキングしてた。

- **修正 — power chord voicing rotation:** `GUITAR_INVERSION_BY_PHRASE =
  [1, 0, 2, 0]` を `phrasePos = ctx.barInSection % 4` で引き、v210 で
  追加した `chordInversion(baseNotes, inv)` を power chord notes に適用。
  C パワーコード `[C3, G3, C4]` の場合:
  - bar 0 (inv 1): `G3 C4 C4` → dedup `[G3, C4]`（mid voicing）
  - bar 1 (inv 0): `[C3, G3, C4]`（low voicing、root position）
  - bar 2 (inv 2): `C4 C4 G4` → dedup `[C4, G4]`（high voicing、register lift）
  - bar 3 (inv 0): `[C3, G3, C4]`（low、phrase release）
- **chord agent との weave:** chord は `INVERSION_BY_PHRASE = [0, 1, 2, 0]`
  で top note を `5th → root → 3rd → 5th` の方向で動かす。guitar は
  `[1, 0, 2, 0]` でズレた pattern にしたので、bar 0 では guitar 高め /
  chord 低め、bar 2 では guitar 高 / chord 高（一緒に lift）、bar 3 では
  両方 root に戻る、という相補的な動き。完全な parallel motion を避けつつ、
  フレーズの climax（bar 2）では両方が上に行く設計。
- **dedup:** power chord は root を 1 オクターブ上にもう一度持つので、
  chordInversion で inv 1 / 2 を取ると重複ノートが出る。`new Set` で
  dedup して PolySynth voices の無駄遣いを避ける。triad / seventh の
  chord agent 経路は元から重複ナシなので影響なし。
- **触らない部分:** `guitarAgentPlan` 本体（accent 反応、grid pattern、
  role 別 strum 密度）は不変。drum / bass / chord / voice agent も不変。
  `guitarInstrument` のサンプラー切替（electric-guitar 等）も同じ plan を
  通る。
- `check-band-room-logic.mjs`: `GUITAR_INVERSION_BY_PHRASE = [1, 0, 2, 0]`
  と dedup の `new Set` を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-101`、`hazama-fm-v212`。
- 原音 (stems) モードは不変。AI 再現 mode の guitar synth ラインだけ
  4 小節ぶんの voicing 動きが入った。

**AI 再現 v208 → v212 のラインナップまとめ:**
- v208: drum kit 規定値 auto-self → synth（drum-floor groove）
- v209: drum scheduler に varied fills + 4 小節 phrase velocity 抑揚
- v210: chord agent に inversion rotation + phrase-aware rhythm
- v211: voice agent に 4 小節 phrase contour（上昇 → ピーク → 下降 → 閉じ）
- v212: guitar agent に power chord voicing rotation（chord と weave する pattern）

drum / bass / chord / voice / guitar の 5 パート全部が、独立に flat だった
状態から、4 小節フレーズで連動して呼吸する形になった。

---

## v211 compact — AI 再現 voice agent にフレーズアーチを持たせる

v208 / v209 / v210 と続けてきた AI 再現 polish の続き。次の monotony は
voice（メロディ / 歌唱ガイド）。`voiceAgentPlan(ctx)` の contour が長らく
非 recap 経路で `[root, 3rd, 5th, 3rd]` の同じアルペジオを毎小節
繰り返していて、4 小節フレーズの melodic shape が flat だった。
実際のボーカルはフレーズに「上昇 → ピーク → 下降 → 閉じ」のアーチが
あるので、それを 4 小節ぶん仕込む。

- **修正 — 4 小節フレーズ contour ローテーション:** `r = notes[0]`、
  `m = notes[1]`、`h = notes[2]` として、デフォルト経路 (verse / comp /
  非 recap) に 4 小節ぶんの contour テーブル:
  - bar 0 ascending  : `r → m → h → m`（フレーズ entrance、root から上昇）
  - bar 1 weaving    : `m → h → m → h`（top 付近で揺れる）
  - bar 2 descending : `h → m → r → m`（fill 小節へ下降）
  - bar 3 closing    : `r → h → m → r`（次フレーズの entrance へ繋ぐ）
  recap 経路（コーラス相当）は元の `[3rd, 5th, root, 5th]` を bar 0 に
  保ったまま、bar 1 / 2 / 3 に top-centered な variant を載せて 4 小節
  ぶんのアーチに。
- **触らない部分:**
  - Human Fly recap の `HUMAN_FLY_VOCAL_MELODY` 固定旋律はそのまま
    （これは曲の identity なので contour 自動変動の対象外）
  - intro / outro は無音継続
  - isPhraseEnd の hold note も維持（フレーズの息継ぎ位置）
  - `sourceAccentSteps` の snare/ghost/crash 反応も同じ — contour は
    accent 位置に sub だけマッピングする
- **副作用なし:** voice 以外のエージェント（drum / bass / chord / guitar）
  は `ctx` を変更せず読むだけなので不変。
- `check-band-room-logic.mjs`: `PHRASE_CONTOURS_DEFAULT` と
  `PHRASE_CONTOURS_RECAP` の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-100`、`hazama-fm-v211`。
- 原音 (stems) モード / 外部ボーカル経路 / `voiceInstrument` のサンプラー
  切替は不変。AI 再現 mode の synth voice ライン（voiceAgent → voiceSynth）
  だけ呼吸が増えた。

---

## v210 compact — AI 再現 chord agent に生気（inversion 回し + フレーズ rhythm）

v208 / v209 のドラム整備の続き。次の monotony は**コード周り**だった。
`chordAgentPlan(ctx)` が長らく「sub 0 で 2n の同じ voicing をスタブ、
たまに sub 8 か 10 でフォロー」という骨組みのまま、毎小節同じ rhythm /
同じ inversion でループしていて、verse が長くなるほど「pad が貼り付き
っぱなし」感が出ていた。

- **修正 1 — inversion rotation:** `chordInversion(notes, inv)` を追加。
  `noteNameToSemi()` で名前を semi に戻し、下から `inv` 本ぶん 1 オクターブ
  上げ、再ソートして名前に戻す。`INVERSION_BY_PHRASE = [0, 1, 2, 0]` で
  4 小節フレーズの 1→2→3 小節で inv を回し、4 小節目は root に戻して
  フレーズ閉じ。例: C-major triad `["C4","E4","G4"]` は phrasePos に応じ
  `C4 E4 G4` → `E4 G4 C5` → `G4 C5 E5` → `C4 E4 G4` と top note が
  G → C → E → G に weave する。コード自体は変わらない（C maj は C maj）
  けど voicing の top が動くので、コード stab が「ふた口の固いもの」から
  「メロディの一部」に寄る。
- **修正 2 — phrase-aware rhythm:** non-break / non-comp / 非 jazzy の
  デフォルト経路に rhythm 4 変奏:
  - phrasePos 0: downbeat のみ（フレーズ entrance、pad を呼吸させる）
  - phrasePos 1: downbeat + sub 8 stab（フレーズ mid push）
  - phrasePos 2: downbeat + sub 14 anticipation 8n（fill 小節 への lead-in）
  - phrasePos 3: downbeat のみ（drums の fill build に空間を譲る）
  break / comp / jazzy / recap-pressure>0.58 の経路は既存ロジック維持
  （これらは元から rhythm 反応してた）、その上に inversion rotation だけ
  乗る。intro / outro は何も追加せず、downbeat だけで静か。
- **`chordInversion` の安全網:** `((inv % 4) + 4) % 4` で負数 / 4以上にも
  耐え、空配列はそのまま返す。`baseNotes` を破壊しない（semis のコピー
  で操作）。
- bass agent / drum scheduler / guitar agent / voice agent は不変。
  ctx.barInSection を読むだけなので side effect なし。
- `check-band-room-logic.mjs`: `chordInversion` 関数の存在 と
  `INVERSION_BY_PHRASE = [0, 1, 2, 0]` を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-99`、`hazama-fm-v210`。
- 原音（stems）モード / sample kit / chord_instrument のサンプラー切替
  は不変。AI 再現 mode の chord 周りだけ呼吸が増えた。

---

## v209 compact — AI 再現ドラムの groove polish（フィル 4 変奏 + フレーズ抑揚）

v208 で AI 再現のドラムがシンセに切り替わって音色は通用するように
なったので、続けて groove 側のレビュー。ユーザー指示「グルーブ優先で、
音として、成立してるか、見直してみて」に対する次の手。

- **問題:** 4 bar に 1 回入るフィルが**毎回まったく同じ tom roll**
  （v107 で入れた `drumKit.fill` の 4×16th 上昇 velocity）。16 bar の
  verse を聴くと 4 回ぜんぶ同じパターンになり「機械が同じ場所で必ず
  ロールする」感が出る。実ドラマーはフィルをバーごとに変える。
- **修正 1 — フィル 4 変奏ローテーション:** `Math.floor(barInSection / 4) % 4`
  で 4 種類を巡回:
  - **V0:** 既存の 4×16th tom roll（v107 のクラシック）
  - **V1:** 4×16th snare 上昇 build（パンクっぽい押し込み）
  - **V2:** kick→snare→kick→snare の Bonham 系 forward march
  - **V3:** 後半 2/16 だけの sparse tom-tom リードイン（隙間を残す）
  4 種が代わりばんこに鳴るので、16 bar 内ですら全部違うフィルになる。
  intro / outro はそのままフィル抑制。
- **修正 2 — 4 bar フレーズ velocity 抑揚:** `phrasePos = barInSection % 4`
  と `PHRASE_VEL_MULT = [0.95, 1.00, 1.04, 0.98]`。フレーズの 1 小節目
  はゆるく入る、3 小節目で 4% 持ち上がってフィル小節へ繋ぐ、フィル
  小節（4 小節目）は本体を 2% 下げてフィル自体に build を譲る。
  ±6% の中の小さな上下で「打ち込みの flat な loop」感を消す。
  既存の `micFollowVelocityScale()` と humanize jitter (±4%) と同じ
  vel 計算行にチェーン掛けする。
- **bass agent は触らない:** `bassAgentPlan(ctx)` が `ctx.kick`（drum-frames
  の kick events）を読み込んで root/fifth/octave/seventh を音域配置する
  ロジックは既に動いていて、kick との lock は取れている。今回の groove
  改善は drum scheduler 側のみ。
- `check-band-room-logic.mjs`: 4-bar phrase mult と fillVariant ローテーション
  の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-98`、`hazama-fm-v209`。
- 副作用なし。stems mode / sample kit / chord / bass / guitar / voice agent
  は不変。シンセドラム周りの groove だけ手を入れた。

---

## v208 compact — AI 再現のドラム規定値を synth に切り替え（drum-floor groove 主軸）

ユーザー報告: 「AI 音源の、ドラムが壊滅的。unripe のなんか生音？ちょっと
とったの？普通に drumfloor と連令してやってください。そのほうが伸ばし
ようあるでしょ？グルーブ優先で、音として成立してるか見直してみて」。

- **原因:** `state.kitSource` の規定値が `"auto-self"` だった。これは
  `resolveKitSource()` で `${bandId}/${songId}` に展開されるので、たとえば
  TABASCO / Human Fly を AI 再現で鳴らすと `presets/sample-kits/tabasco/
  human-fly/{kick,snare,hat,…}-01.wav` を `Tone.Player` で叩く運用に
  なっていた。中身は Demucs 分離後の drum stem から librosa 系で抽出した
  単発 wav なので、他楽器の bleed と onset アーティファクトが残った
  「生録音みたいでデモっぽい」音になっていた。ユーザーが「unripe の生音」と
  呼んだのはまさに `unripe/continuous/kick-01.wav` 系のあの音。
- **修正:** 規定値を `"synth"` に変更。AI 再現 mode のドラムは
  `makeDrumKit(drumBus, state.kitProfile)` が生成する Tone.js シンセ
  ヴォイス（kick=MembraneSynth＋NoiseSynth click、snare=NoiseSynth＋
  MetalSynth rim、hat/ghost/fill/crash も同様）で鳴る。グルーブ側は既存の
  drum-frames events（バンドごとに `drum_frames_pattern` で指定、tabasco は
  `presets/drum-frames-tabasco-{songid}.json`）が駆動するので、Dilla feel /
  velocity jitter / ghost-note vamp / 4-bar fill / sparse pattern reinforcement
  といった groove 補強はそのまま効く。timbre は profile（default /
  sakanaction / lcd-motorik / cramps-punk / lofi-nujabes）で差し替えできる
  ので、サカナクション調 / LCD 調にスワップしていく方向性に素直に拡張できる。
- **既存ユーザーのマイグレーション:** `applyPrefs()` で
  `prefs.kitSource === "auto-self"` を読み込んだ場合は `"synth"` に
  silent fallback。localStorage に "auto-self" が残っていても起動時に
  synth へ寄せる。ユーザーが意図的にサンプルキットを使いたい場合は
  「synth / sample 切替」ドロップダウンから auto-self や tabasco/* /
  unripe/* を選び直せる（オプションは退役しない）。
- **音として成立してるかのレビュー:** drumBus 経路は `drumBus →
  drumPan → instrumentBus (makeInstrumentPolishBus) → masterGain` に
  既に乗っていて、polish bus は EQ tilt（low/mid -0.8 dB、high +1.4 dB）
  + glue comp（threshold -20 dB / ratio 2.2 / attack 12 ms / release 180 ms）
  + parallel saturation（distortion 0.12、wet 0.16） + StereoWidener 0.58
  + makeup +1.08 で composite を組んでいる。シンセ単発のドライさを
  polish bus が補正するので、原音から離れた timbre でも mix としては
  まとまる（v204 で `バキバキ感` + `抜け感` を狙って組んだチェーンが
  そのまま効く）。
- **AI 再現 mode 自体は依然 WIP** （v205 で stems mode をデフォルト化済み、
  v207 でも mode は localStorage に保存しない方針）。本変更は AI モードに
  入ったときの初手の聞こえを「ベース音色として通用するライン」に揃える
  もの。chord/bass/guitar/voice の synth voice チューニングや、kitProfile の
  自動マッピング（band/song の場面に応じた sakanaction / lcd-motorik 寄せ）は
  次ラウンド以降。
- `check-band-room-logic.mjs`: `kitSource: "synth"` を default で
  保持していることを assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-97`、`hazama-fm-v208`。
- 原音（stems）モードと sampled kit 系（auto-self / tabasco/* / unripe/*）
  の挙動は不変。AI 再現 mode のドラム初期音色のみ変わる。

---

## v207 compact — band-room: BG 再生の音程ブレ修正 + PWA バナー流用

FM 側から共有された案件 1（バックグラウンド再生中、たまに音程が下ブレる）の
修正と、案件 2（PWA インストール推奨バナー）の流用。

- **音程ブレの原因:** `playbackHealthTimer`（2.5s `setInterval`）が BG で
  throttle される間に AudioContext が一瞬 suspend → `recoverPlaybackAfterSuspend`
  が `resyncStemPlaybackToClock(force:true)` を呼び、全 stem を `stop` →
  `start` で再起動していた。この hard cycle が音切れ＋クリックとして
  「ところどころ音程が下ブレる」に聞こえていた（FM 側の `playbackRate`
  throttling 説は近接領域、実体は forced resync 側）。
- **修正:** `recoverPlaybackAfterSuspend` の force resync を
  **`document.hidden` のときスキップ**するように変更。BG 中は context だけ
  resume して stem は再生位置を維持。可視復帰（`reason === "visible"`）で
  再入したときに resync が走り、ドリフトを掃除。
- **PWA バナー:** `index.html` / `fm.html` と同じ install hint を
  band-room.html にも追加（案件 2 / FM 側 v206 の提案そのまま流用）。
  `musicStackInstallHintDismissed` キーは origin 共有なので dismiss 状態は
  3ページで同期。PWA standalone での BG 安定性向上が狙い。
- 案件 1 のうち Wake Lock / playbackRate 更新の Page Visibility ガードは
  今回見送り（band-room の playbackRate は周期更新していないため見送り、
  Wake Lock は次ラウンドに分離）。残症状が出れば v208 で追加。
- `check-band-room-logic.mjs`: PWA install hint の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-96`、`hazama-fm-v207`。
- 譜面・音色・ミックスは不変、UI も既存配置に影響なし（バナーは
  position:fixed、standalone/dismiss で非表示）。

---

## v206 compact — PWA インストール推奨バナー（Music の 2 ページ）

- ユーザー要望「Music-stack 各システムを PWA 化したほうが安定？それなら
  ページに推奨表示と手順を載せたい」への対応 第 1 弾。**Hazama FM (fm.html)
  と Music Core Rig (index.html)** にインストール推奨バナー（`#install-hint`）
  を追加。
- 動作: ページ起動時、`standalone` 表示モードでなく、かつユーザーが過去に
  dismiss していなければ、画面上部に小さい半透明バナーを表示。「📲 PWA推奨：
  バックグラウンド再生が安定」+「手順」ボタン（iOS / Android / PC の各
  インストール手順を展開）+「×」（localStorage に dismiss を記録、再表示
  しない）。Chrome の `beforeinstallprompt` が来たときは「インストール」
  ボタンで 1 タップ実行（iOS Safari は手順表示のみで OS の制約に従う）。
- 背景 — ユーザー報告: Band Room をバックグラウンド再生中にときどき音程が
  下ブレる。原因はほぼ確実にブラウザのバックグラウンド throttling — JS
  イベントループが遅延し、Tone.js のスケジューリングや Player の `playbackRate`
  計算がズレることで sample 再生のピッチがブレる。PWA standalone はこの
  throttling を緩めるため、Band Room を含む全体の安定性が上がる（Band Room の
  audio コード自体でも軽減できるが、本 PR は別チャット管理域には触れない）。
- `fm.html` / `fm.css fm-53` / `fm.js fm-68`: Hazama FM 側はバナー＋既存の
  `beforeinstallprompt` ロジックを統合（旧 floating `#fm-install` ボタンの
  生成は退役、その役目はバナー内の「インストール」ボタンが担う）。
- `index.html`: Music Core Rig には inline `<style>` ＋ inline `<script>` で
  同じバナーを実装（fm.js を読まないため）。dismiss は同じ localStorage キー
  `musicStackInstallHintDismissed` で同一オリジン共有。
- `sw.js`: `hazama-fm-v206`、precache の fm.js / fm.css バージョン更新。
- Band Room (`band-room.html`) は別チャット管理域のため**本 PR では未着手**。
  バナーを載せる場合は同パターン（inline style/script）で 1 ファイル変更。
- sister repo（namima / chill / drum-floor / openclaw）への展開は、本パイロット
  の試用後に。

---

## v205 compact — band-room: 起動時は必ず原音モードに

ユーザー報告「band-room を開くと AI 再現になっていた。AI 再現は未整備なので
デフォルトは原音に」。

- 原因: `savePrefs` がプレイバックモード（`mode: currentMode`）を保存し、
  `applyPrefs` が起動時に復元していた → 一度 AI 再現に切り替えると以後その
  状態で起動していた。
- 修正: モードを永続化しないようにした。`savePrefs` から `mode` を削除、
  `applyPrefs` のモード復元ブロックを削除。band-room は常に 原音 (stems) で
  起動する。モード切替はセッション内のみ（AI 再現 が整備できたら復活を検討）。
- A/B スナップショット復元は従来どおり（明示操作なので維持）。
- `check-band-room-logic.mjs`: `savePrefs` が `mode` を保存しないことを assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-95`、`hazama-fm-v205`。

---

## v204 compact — band-room: 原音マスタリング — バキバキ感 + 空間の抜け感

ユーザー要望「原音マスタリングとして、もっと音のバキバキ感と、空間に広がる
抜け感がほしい」。マスターチェーンを調整（構造値のみ、スライダー既定は不変）:

- **バキバキ感（パンチ/粒立ち）:** masterComp2 の attack を 8→16ms に遅らせ、
  トランジェントが glue に潰される前に前へ出るように。master EQ の high shelf
  を 0.7→1.4・クロスオーバーを 5600→4800Hz に下げてプレゼンス〜エアを広く
  持ち上げ輪郭をくっきり。tape saturation も 0.09→0.12 で倍音のエッジを少し。
- **空間の抜け感:** master EQ の mid を −0.2→−0.5 に下げて低中域を整理（抜け・
  クリアさ）、master reverb の decay を 1.9→2.4 に広げて空間を出す。
- リミッター −1.0 / 音量カーブ / 譜面・音色は不変。
- `band-room.html` / `sw.js`: `band-room.js?v=br-94`、`hazama-fm-v204`。

---

## v203 compact — band-room: 歌詞表示の小掃除（マークダウンノイズ除去）

ユーザー依頼「歌詞の中身を最適化」。`renderLyricBlocks` を整理:

- `#` / `##` 見出し行（曲タイトル等）と `---` 罫線を歌詞ブロックから除外。
  生マークダウンの `## 01 TABASCO …` プリアンブル小ブロックが消える。
- 各ブロック本文の先頭/末尾の空行を除去、連続空行を1つに圧縮（連の区切りは保持）。
- CRLF (`\r\n`) を正規化 — `<pre>` に紛れていた `\r` を除去。
- 見出し除去で空になったプリアンブルブロックは生成しない。
- 注: 「歌詞ブロック巨大化」は実バグではなかった（プレビュー幅0での計測ミス、
  通常ビューポートでは元から正常）。今回は中身の整形のみ。
- `band-room.html` / `sw.js`: `band-room.js?v=br-93`、`hazama-fm-v203`。
- 譜面・セクション構造・音は不変。

---

## v202 compact — band-room: 出音をシステム上限まで底上げ

ユーザー報告「他アプリと比べて出音が小さい。ミックスではなくシステム音として
マックスに」。band-room はマスターリミッターが −1 dBFS（ピークはほぼ上限）だが、
マスター音量の既定が控えめだった。

- マスター音量カーブを底上げ: `masterVolBase` 0.90→1.2、スライダー100地点の
  ゲインを 1.25→1.8（−1 dBFS リミッターをより強く駆動 ＝ 体感ラウドネス↑）。
- 既定スライダー位置を 80→100（最大）に。`masterGain` 初期値も 1.2 に追従。
- `MASTER_VOL_KEY` を `.v2` に更新 — 過去に保存された控えめな音量値を無視し、
  全員が新しい最大既定で起動する。
- リミッター閾値 −1.0 は不変（クリップ防止の天井は維持）。譜面・音色・ミックス
  バランスは不変、出力ゲインのみ。
- `band-room.html` / `sw.js`: `band-room.js?v=br-92`、`hazama-fm-v202`。
- `check-band-room-logic.mjs`: `masterVolBase` の assert を 1.2 に更新。

---

## v201 compact — band-room: 歌詞オートスクロールのページ乗っ取り修正

ユーザー報告「AI 再現の画面で歌詞部分に張り付き、正常なスクロールができない」。

- 原因: `updateLyricsHighlight` がセクション変化のたびに `match.scrollIntoView
  ({ block: "center" })` を呼び、これがスクロール可能な祖先を全て——`#br-lyrics`
  パネルだけでなくページ/window まで——スクロールさせ、ユーザーの手動スクロールを
  毎回奪っていた。
- 修正: `#br-lyrics`（`max-height:360px; overflow-y:auto` の独立スクロール枠）の
  `scrollTop` を直接計算して動かすよう変更。歌詞パネルは現セクションを追従するが、
  ページ本体はもう動かない。
- `band-room.html` / `sw.js`: `band-room.js?v=br-91`、`hazama-fm-v201`。
- `check-band-room-logic.mjs`: `scrollIntoView` を使わないことを assert。

---

## v200 compact — band-room AI 再現モード: ポリフォニー溢れ修正（partial fix）

ユーザー報告「AI 再現モードは音が全然ない」の調査・第一弾修正。**部分修正**で、
synth モードのハードハングは未解決（次ラウンドで本格調査）。

- **確証のある修正:** AI 再現モードで PolySynth のポリフォニー溢れを特定。
  `guitarAgentPlan` の recap（サビ）分岐が 16分音符ストラム（16ステップ ×
  3音パワーコード ＝ 48ノート/小節）を発火し、ギター/コード PolySynth の
  `maxPolyphony = 6` を大幅超過 → `Max polyphony exceeded. Note dropped.` が
  大量発生し、和音・ギターが落とされて消えていた。
  - guitar recap ストラム: 16分 → 8分音符（密度半減）。
  - guitar / chord の `maxPolyphony`: 6 → 10（v187 の stutter 対策の範囲内）。
- **未解決:** synth モードで再生開始後にメインスレッドがハードハングする現象は
  これだけでは直らない。agent ループ／スケジューラ／リバーブ decay 再代入／
  小節ごとの synth 再生成は調査済みで除外。原因は非自明、次ラウンドで
  プロファイリング前提の本格調査が必要。
- `band-room.html` / `sw.js`: `band-room.js?v=br-90`、`hazama-fm-v200`。
- 譜面・コード進行・音色は不変。

---

## v199 compact — モードクロスフェードの ReferenceError 修正（jazz / lofi ドラム参照）

`engine.js fm-105`: ユーザー報告「`updateSoundForMode failed` がクロスフェード中に
繰り返し出る（`ReferenceError: jazzDrumSampler is not defined`）」の修正。

- 原因 — v195 の `MODE_LAYERS` で `lofi` / `jazz` の `samplers()` が、宣言されて
  いない変数 `lofiDrumSampler` / `jazzDrumSampler` を参照していた。drum レイヤーの
  実体は `lofiDrumSamples` / `jazzDrumSamples`（`{kick, snare, hat}` の `Tone.Player`
  kit）で、`.volume` を持つ単一 sampler ではない。v195 のクロスフェード設計が
  「drum も `.volume` で ramp できる sampler」と想定したが、その変数は最初から
  存在しなかった。
- 影響 — クロスフェード（`transitionSec > 0`）のたびに `crossfadeOutOtherModes`
  が throw し、`updateSoundForMode` の try/catch が握りつぶしていた。コンソール
  エラーだけでなく、**遷移時の mode 固有の音作り（pad/filter/reverb 設定、
  `start*Layer` 呼び出し、残りモードの layer 停止）が丸ごとスキップ** されていた。
- 修正 — `MODE_LAYERS.lofi` / `.jazz` の `samplers()` から存在しない drum 変数を
  除去。drum kit は `.volume` を持たず（各 voice の volume は mic-follow が毎小節
  再設定する）クロスフェード対象外なので、`stop()` の `stopLofiDrumLayer()` /
  `stopJazzDrumLayer()` でこれまで通りハードカット。これで melodic layer
  （piano / bass / harp / cello / organ）のフェードが実際に効くようになる。
- `fm.html` / `index.html` / `sw.js`: `fm-105`、`hazama-fm-v199`.
- 譜面・音色・セクション構造・モードの音作り内容は不変（壊れていた遷移処理の
  復旧のみ）。

---

## v198 compact — band-room: 非ボーカル磨きバス + ボーカルを空間に + 艶/低音/音圧

band-room.js 専用の音質改善。元 v195/v196 として開発したが、並行セッションが
先に v196/v197 を出したため v198 に採番・統合。

- **非ボーカル磨きバス（`makeInstrumentPolishBus`）** — drums/bass/guitar/chords
  の 4 パンを masterGain 直結から専用バスへ集約し、その手前で磨く。voice
  （ボーカル/メロディリード）と click は対象外（masterGain 直結のまま）。
  - `EQ3 tilt → glue comp → [dry]+[parallel saturation] → StereoWidener →
    makeup → masterGain`。hi-fi = EQ で低中域の濁りを削りプレゼンス〜エアを
    上げ、Widener 0.58 で楽器を広げセンターのボーカルと分離。音圧 = glue
    comp（-20/2.2、attack 12ms でアタック維持）＋ Distortion 0.12 を 16%
    パラレル、makeup +0.7dB。
- **ボーカルを空間に** — 溶け込ませる方向へ再ボイシング:
  - vocal stem EQ: 語/子音帯（420–4200Hz）の presence を mid −1.4 に下げて
    音感寄りに、high-air shelf +1.3 で「上から降りてくる」浮遊感、de-ess −4.5。
  - vocal FX: reverb decay 2.6→4.0 / preDelay 0.035→0.055、chorus を深く
    ゆっくり、dry 0.82→0.66 で一歩奥へ。`makeVoiceBox` のリバーブも拡大。
- **マスター（全体的に）**: tape saturation 0.045→0.09 ＋ EQ high +0.7（艶）、
  EQ low shelf 0.7→1.5 @185Hz（自然な低音ブースト）、comp2 を −10/1.7 に
  詰め masterVolBase 0.84→0.90（Nirvana 寄りの密度・音圧）。limiter −1.0 維持。
- スライダー既定値は不変（構造側のみ調整、mix-prefs migration 不要）。
- `band-room.html` / `sw.js`: `band-room.js?v=br-89`、`hazama-fm-v198`。
- `check-band-room-logic.mjs`: `makeInstrumentPolishBus` の存在・非ボーカル
  経由/ボーカル直結・masterVolBase 0.90 を assert。
- 譜面・コード進行・各楽器の素の音色は不変。

---

## v197 compact — セクション内の息づき + 境界の番組ID合図

- `engine.js fm-104`: 候補項目 2・3 の消化（ユーザー「候補は全部 OK」）。
- **(2) 静かな節を生かす** — セクションは macro params をプラトーで保持するが、
  14-18 小節ずっと平坦だと静かな節（submerge / hollow）が静止して聞こえうる。
  `INTRA_SECTION_BREATH` を追加 — 節の進行（`barsInto / bars`）に対し `sin` の
  弧で wave / creation / resource を中盤に向け微増・void を微減（節頭と節尾は
  0）。`sectionMacroTarget()` に織り込んだので ANY・ジャンル固定の両経路に
  効く。節の中で「ひと息」分の展開が出る。
- **(3) つなぎの有機的強化** — 未使用気味だった radio-brain ident（番組変更時
  だけ鳴る控えめな和声ジェスチャ）を、セクション境界でも鳴らすよう接続
  （`cueSectionIdent()`）。v193 のフィル（リズムの区切り）＋ ident（和声の
  区切り）で塊のエッジが有機的に立つ。番組変更 cue が既に保留中なら重ねない。
- `fm.html` / `index.html` / `sw.js`: `fm-104`、`hazama-fm-v197`。
- `check-hazama-melody.mjs`: `INTRA_SECTION_BREATH` / `cueSectionIdent` を assert。
- 譜面・音色は不変（節内の緩やかな揺らぎと境界の控えめな合図の追加のみ）。

---

## v196 compact — ジャンル固定モードのセクション展開

- `engine.js fm-103` / `fm.js fm-67`: ユーザー要望「個別ジャンル選択時も展開を
  効かせたい」。原因 — ジャンルピル（ambient / techno 等）を選ぶと automix が
  OFF になり 9 マクロ params が固定 → セクション展開（`updateAutoMixTargets`
  経由）が genre モードに届かなかった（ANY 専用だった）。
- 修正: ジャンル適用時、fm.js が engine へそのジャンルの UCM ベースライン
  （9 fader 値）を `window.setMusicGenreSectionBaseline()` で渡す。engine 側は
  `syncGenreModeSectionControls()`（automix OFF 時に `scheduleStep` から駆動）
  で、セクションの形に沿って params をベースライン周りで「ゆるく」変調
  （`GENRE_SECTION_SCALE` 0.32）。
- `energy` だけは固定 — `chooseMode()` は energy 帯でモードを決めるため、
  energy を動かすとジャンル/モード/テンポが変わってしまう。残り 8 params
  （wave / creation / void / body / resource / circle / observer / mind）が
  動くので、密度・空白感・低域・複雑さが節ごとに展開する。
- 変調は `SECTION_FORM_CENTER`（全 6 セクション target の平均）基準の
  zero-mean ＝ ジャンルから乖離せず息づく。手動 fader 操作中の key は
  manual-influence 期間スキップ。
- `fm.html` / `index.html` / `sw.js`: `fm-103` / `fm.js fm-67`、`hazama-fm-v196`。
- `check-hazama-melody.mjs`: genre-section 関数を assert。
- これで ANY・個別ジャンル双方でセクション展開が効く。`drive`/`space`
  （v193/194）は元々 genre モードでも効いており、今回の 8-param 変調と合わさる。

---

## v195 compact — モード遷移の DJ クロスフェード

- `engine.js fm-102`: ユーザー報告「モードが変わるとき**急に始まって急に止まる**」
  対策。原因 — radio brain がモードを回すたび、`updateSoundForMode` が古い
  モードの sample layer（harp / cello / piano / bass / drum / organ の
  sampler）を**即停止**し、新モードのを full volume で**即開始**していた
  （ハードカット）。
- **修正 ＝ レイヤーのクロスフェード**。これらの sampler は永続で `.volume`
  が ramp 可能なので、モード変更時に古いモードの sampler を約 2 小節かけて
  フェードアウト（フェード後にループを `clear`）し、新モードのを無音から
  フェードイン。`MODE_LAYERS` マップ + `crossfadeOutOtherModes()` /
  `fadeInModeLayers()` を追加し、`updateSoundForMode(mode, transitionSec)` に
  遷移秒数を渡す。`commitPhraseLockedMode` がモード変更時に約 2 小節分を渡す。
  trigger 関数や 18 個の `start*/stop*Layer` 関数は無改変 —
  `updateSoundForMode` とヘルパーのみ。
- BPM について: 調査の結果、BPM はすでに DJ 的に滑らか（`energy` 由来・二重
  スムージング ＋ 1.6s ramp、モード変更で snap しない）。詰まって聞こえたのは
  layer のハードカットが原因 — それを直せば BPM も滑らかに繋がって聞こえる。
- `fm.html` / `index.html` / `sw.js`: `fm-102`、`hazama-fm-v195`。
- `check-hazama-melody.mjs`: クロスフェード関数を assert。
- 音色・譜面・セクション構造は不変（遷移の繋ぎ方のみ）。

---

## v194 compact — セクション仕上げ2: 音詰まり修正 + 強弱拡大 + セクション名表示

- `engine.js fm-101`: 試聴フィードバック対応。
  1. **音詰まり修正** — 「たまにウっと詰まる」の原因を特定。`globalReverb
     .decay` を `updateSoundForMode` がモード毎に再代入していた。Tone.Reverb の
     `decay` は setter で、代入のたびにインパルス応答を OfflineAudioContext で
     再レンダする ＝ 同期 CPU スパイク。radio brain が約 60〜90 秒でモードを
     回すたびにこれが走り、音が詰まっていた。`decay` を構築時の固定値（4.3）に
     し、6 個の per-mode 再代入を削除。モード別のリバーブ感は `wet` で付ける。
  2. **セクションの強弱を拡大** — 「のっぺり・打ち込み的な聞かせどころが欲しい」
     対応。各 `SECTION_PROFILES` に `space`（休符確率の倍率）を追加。surge は
     `drive 1.55 / space 0.40` ＝ 詰まった高密度の「打ち込み」見せ場、hollow は
     `drive 0 / space 1.95` ＝ ドラムの無い空白のブレイク、と振り幅を拡大。
     surge は energy 90（≈ アップテンポ）、hollow は energy 15。
  3. **セクション名を `SectionState.name` に保持**（UI 表示用）。
- `fm.js fm-66` / `fm.html` / `fm.css fm-52`: FM 画面に現在のセクション名を表示
  （`#fm-section`「section · surge」等、`#fm-next` の下）。`window.SectionState`
  から `onRuntimeState` で更新。
- `fm.html` / `index.html` / `sw.js`: `fm-101` / `fm.js fm-66` / `fm.css fm-52`、
  `hazama-fm-v194`。
- `check-hazama-melody.mjs`: `space` と「`globalReverb.decay` 再代入なし」を assert。
- 注: セクション機能は今のところ ANY ピル（AUTOMIX ON）専用。個別ジャンルで
  効かせるのは次弾。

---

## v193 compact — セクション仕上げ: ドラムゲート + 境界フィル

- `engine.js fm-100`: v192 のセクション構造に、世界の差をはっきりさせる 2 点を
  追加。
  1. **セクション・ドラムゲート** — 各 `SECTION_PROFILES` に `drive`（ドラム
     確率の倍率）を追加。submerge / hollow = `drive 0`（ブレイク＝ドラムほぼ
     消える）、flow = `1.0`、surge = `1.3`（高密度ピーク）等。
     `advanceGrooveStructure` で groove governor / mic-follow の後に
     `kickProb` / `hatProb` / `bassProb` を `drive` で再スケール（governor の
     prob スケーリングと同じ場所・同じ手法）。これでセクションごとに「ドラムが
     居る世界／居ない世界」がはっきり分かれる。
  2. **境界フィル** — `SectionState.fillCue` を追加。セクション境界の 1 小節
     手前で `advanceSection()` が cue を立て、`GrooveState.fillActive` を強制
     ON。次の世界へ入る変わり目に必ずフィルが入り、塊のエッジが立つ。
- v192 の連続→離散化に対し、v193 は各セクションの**輪郭**を強める仕上げ。
  楽器の trigger 関数には触れず、既存の prob / fill フラグ経路のみ
  （governor の precedent に倣う）。
- `fm.html` / `index.html` / `sw.js`: `fm-100`、`hazama-fm-v193`。
- `check-hazama-melody.mjs`: `drive` と `fillCue` を assert。
- 譜面・コード進行・音色は不変。

---

## v192 compact — 単調対策: セクション構造（塊・節・世界）

- `engine.js fm-99`: ユーザー報告「まだ単調・ランダム感が気持ち悪い・節ごとに
  世界がある感じが欲しい」への対策。**根本原因**: engine の 9 マクロ
  パラメータ（energy / wave / … / observer）は約3分周期の sine で**常時
  連続 morph** しており、一度も値を「保持」しない。だから音楽は永遠に
  移ろい続け、どこにも定着せず、節・塊として知覚できなかった（散発的な
  ランダム感の正体）。
- **修正 = セクション構造の導入**。`SECTION_PROFILES` — 固定シーケンスの
  「世界」6 つ（submerge 静かな立ち上がり → sprout 芽生え → flow グルーヴ →
  surge 高揚ピーク → hollow 空白のブレイク → return 帰結）。各セクションは
  マクロ params を自分の plateau に**引き寄せて 14〜18 小節 保持**し、
  境界で次の世界へ step する。`SectionState` が小節ごとのクロック
  （`advanceSection()` を `advanceGrooveStructure` から駆動）。
  `updateAutoMixTargets` で各 param の `desired` をセクション plateau へ
  再センタリングし、sine の振れ幅を `SECTION_LIFE_FACTOR`(0.2) まで縮小
  ＝「保持されつつ少し息づく」。plateau の step は既存の `UCM_TARGET →
  UCM_CUR` スムージングで数秒のグライドになる。
- 結果: 連続モーフ → **離散したセクションの連なり**。density・dynamics・
  tempo・音色は各セクションの plateau から導出されるので、世界ごとに
  はっきり表情が変わる。約 4〜5 分で 1 周する曲のような構成。
- `fm.html` / `index.html` / `sw.js`: `fm-99`、`hazama-fm-v192`。
- `check-hazama-melody.mjs`: `SECTION_PROFILES` / `advanceSection` /
  plateau hold を assert。
- 楽器ごとのハード on/off ゲートや境界フィルは未実装（plateau の contrast
  で density は十分振れる）。試聴して「ブレイクで完全にドラムを落としたい」
  等あれば次弾で voice gate を追加。

---

## v191 compact — もっさり対策 第1弾（pad の発音 + リバーブ + groove timing）

- `engine.js fm-98`: ユーザー報告「音がもっさり・流れない」への対策 第1弾。
  発音のキレ（articulation）に絞った修正:
  1. **pad エンベロープ** — haze chord を鳴らす pad は `updateSoundForMode`
     でモード別に attack/release が設定される。ambient は attack 1.5s /
     release 4.0s で、1.5s かけて立ち上がり 4.0s 尾を引くため、小節ごとに
     変わるコードが全部 wash に溶けて輪郭が出ていなかった（v189 で入れた
     コード進行も埋もれていた）。全モードで attack/release を短縮:
     ambient 1.5/4.0→0.6/2.4、lofi 1.2/3.2→0.5/2.0、dub 0.65/2.5→0.4/1.9、
     jazz 0.55/2.2→0.34/1.7、techno 0.35/1.4→0.18/1.0、trance 0.45/1.8→
     0.24/1.3、fallback（funk/piano）1.2/3.5→0.4/2.0。各モードの性格は維持
     （ambient は最も柔らかく、techno は最もタイト）。
  2. **リバーブの尾** — `globalReverb.decay` が長い 3 モードを短縮:
     ambient 6.4→4.5s、dub 6.2→4.6s、trance 6.8→4.6s。まだ広い空間だが、
     小節間隔のコード変化で尾が消えきらず濁る状態を解消。
- `audio/human-groove-governor.js`: groove の micro-timing を片側遅れ
  （`(sign+1)*0.5` で 0〜maxJitter の常時 late）から **拍中心**（`sign*0.5`）
  へ。全ノートが必ず後ろにずれる一方向ドラッグが「もっさり」の一因だった。
  スプレッド幅は同じまま、拍の前後へ均等に揺れるよう中心化。
- `fm.html` / `index.html` / `sw.js`: `fm-98`、`hazama-fm-v191`。
- 出音の譜面・コード進行・音色キャラクターは不変（発音の速さと残響長のみ）。
- **これは第1弾（もっさり/キレ）**。次弾は「単調・展開不足」対策
  （dynamics レンジ拡大・arc 強化）を試聴フィードバック後に予定。

---

## v190 compact — 音のフロー / キックのノイズ対策（先読みスケジューリング）

- `engine.js fm-97`: 「音が自然につながらない」「キックがたまにノイズ」報告
  への対策。スケジューリングの安全余裕を 3 点で拡げた:
  1. **先読みヘッドルーム拡大** — `ToneScheduleGuard.nowLeadSec` を 4ms→30ms。
     遅延した Transport step や raw `currentTime` 基準のジェスチャは要求時刻が
     "ほぼ過去" になることがあり、4ms では描画クォンタム＋メインスレッド
     ジッタの内側に入って attack が切れて鳴る（＝クリック）。30ms 確保で
     オーディオスレッドが余裕を持って発音でき、Tone の 100ms lookAhead 内
     なので定刻ノートは不変。
  2. **キックのリトリガー debounce** — `kick`（monophonic MembraneSynth）は
     punch パッド / acid trace / ambient ghost-pulse の複数経路から鳴り、
     同じ step で ~10-30ms 差で衝突すると 2 発目が transient 途中で synth を
     再起動 → ピッチ/振幅エンベロープの不連続がクリックになる。
     `toneVoiceRetriggerTooSoon()` を追加し、前回発音から 60ms 以内に重なる
     キックは時刻シフトせず drop（クリーンな 1 発を残す）。
  3. **パッドジェスチャの先読み** — `triggerPadSignature()` はパッド押下時に
     `now+0.002 … now+0.176` の多層オンセットを raw `currentTime` 基準で
     組んでいたため前半が先読み窓に入りきらなかった。基準を
     `currentTime + 50ms` にずらし、ジェスチャの形を保ったまま窓内に収めた。
- `fm.html` / `index.html` / `sw.js`: `fm-97`、`hazama-fm-v190`。
- `check-hazama-melody.mjs`: nowLeadSec ヘッドルーム / kick debounce /
  パッドジェスチャ先読みを assert。
- 出音の譜面・音色・コード進行は不変（スケジューリングの安全余裕のみ）。
  BL-022 entry が予告した「次レバー = lookahead」の的を絞った適用。

---

## v189 compact — pad の意図的コード進行

- `engine.js fm-96`: haze pad の和声を「ランダム pool 拾い」から**意図した
  コード進行**へ。pad の `randomHazeChord()` は `chordTurn + ランダム(0–5)` で
  キー内のコードを毎回ランダム選択していた（機能進行なし）。`HAZE_CHORDS` は
  D メジャーのダイアトニック一式（0=I 1=IV 2=ii 3=iii 4=V 5=vi）なので、
  `HAZE_CHORD_PROGRESSION` をジャンル別に定義（ambient=I-vi-IV-I / jazz=ii-V-I-vi /
  trance=vi-IV-I-V 等、既存 `MELODIC_DIRECTOR_KEY_ORDER` の性格に対応）。pad は
  小節ごと（`GrooveState.cycle`）に進行を1歩進め、phrase 単位のキー転調は
  既存 director がその上に乗ったまま。新コードの作曲ではなく既存 voicing の
  並び替え。進行は index 配列なので試聴で調整可。
- `fm.html` / `index.html` / `sw.js`: `fm-96`、`hazama-fm-v189`。
- `check-hazama-melody.mjs`: `HAZE_CHORD_PROGRESSION` の定義と pad 経由を assert。

---

## v188 compact — BL-004: 40Hz focus depth A/B 切替

- `audio/music-focus-modulation.js fm-95`: 40Hz focus depth を A/B 試聴できる
  ように。`?focusDepth=` URL パラメータで起動時 depth を上書き（`?focusDepth=5`
  →5%、`?focusDepth=8`→8%、bare fraction も可）。`window.MusicFocusModulation
  .setDepth()` も追加（console から再読込なしで切替可）。default は 8% のまま。
- `fm.js fm-65`: focus mode の status 表示に現 depth を併記（`40 hz 8%` /
  `40 hz 5%`）— A/B 中にどちらを聴いているか分かる。
- `fm.html` / `index.html` / `sw.js`: `fm-95` / `fm.js fm-65`、`hazama-fm-v188`。
- 用途: BL-004 — `fm.html`（8%）と `fm.html?focusDepth=5`（5%）を聴き比べ、
  8% AM が耳に違和感を出すか判定。決まった値を default にする。

---

## v187 compact — BL-022: PolySynth maxPolyphony cap（音詰まり対策）

- `engine.js fm-94`: Hazama FM ブラウザ再生の音詰まり（同時起動音での負荷
  スパイク）対策。`pad` PolySynth の `maxPolyphony` を 64→24、`pianoMemory` を
  48→24 に下げ、発音数に天井を設けた。`pad` は 3.5s release の `1n`/`2n`
  haze chord を 20+ 経路から鳴らすため上限過大だと voice が積み上がり CPU
  スパイクになっていた。超過時は最古（深い減衰中＝ほぼ不可聴）の voice を
  steal。`pianoMemory` は短尺 note なので 24 で十分な余裕。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-94`、`sw.js hazama-fm-v187`。
- 出音ロジック・コード進行・音色は不変（polyphony 上限のみ）。次レバーが要れば
  `Tone.context.lookAhead` / `latencyHint: "playback"`（BL-022 entry 参照）。

---

## v186 compact — Hazama FM mobile layout fix (BL-022 隣接)

- `fm.css fm-51`: スマホ／PWA standalone で `#fm-shell` が `position: fixed;
  inset: 0` の非スクロール容器だったため、コントロール群が viewport より
  約 410px 高くなると下部（`40HZ` ボタン等）に届かず、上部も `black-translucent`
  status bar に潜っていた。`overflow-y: auto`（+ `-webkit-overflow-scrolling`）で
  スクロール可能化、`pointer-events` をシェル自身が受けるよう変更、`padding` を
  `env(safe-area-inset-*)` 対応にし、`justify-content` を `safe center` 化。
- `fm.html` / `sw.js`: `fm.css?v=fm-51`、`sw.js hazama-fm-v186`。
- 出音・engine ロジックは不変（CSS のみ）。



- `audio/music-hazama-feedback.js fm-93`: BL-008 next extraction。Hazama runtime
  feedback telemetry cluster（9 functions / 約180行）を engine.js から
  IIFE module へ移動。`music-runtime-feedback` payload を build して
  opener / parent window へ postMessage し、`window.MusicHazamaFeedback` を公開。
- `engine.js fm-93`: feedback cluster を module alias に置換。4 つの
  interleaved Hazama-bridge helpers（`hazamaAutoFollowActive` 等）は
  engine.js 側に維持。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-93`、
  `audio/music-stack-routing.js?v=fm-93`、`audio/music-focus-modulation.js?v=fm-93`、
  `audio/music-recorder.js?v=fm-93`、`audio/music-packet.js?v=fm-93`、
  `audio/music-hazama-feedback.js?v=fm-93` に cache bump。
- `sw.js hazama-fm-v185`: fm-93 assets を precache。

## v184 compact — engine packet module

- `audio/music-packet.js fm-92`: BL-008 next extraction。metadata-only の
  Music session / orchestra packet builder cluster（約700行）を engine.js から
  IIFE module へ移動。`window.MusicPacketKit` を公開。
- `engine.js fm-92`: packet builder cluster を module alias に置換し、
  既存の `window.MusicSessionPacket` / `window.MusicOrchestraPacket`
  publication は engine.js 側に維持。
- `audio/music-recorder.js` / `engine.js`: v183 回帰修正。共有 `#status-text`
  writer の `setRecorderStatus` は recorder だけでなく mic・packet code からも
  呼ばれるが、v183 の recorder 抽出で IIFE に閉じ込めてしまっていた
  （mic toggle と packet sync が `ReferenceError` になる）。
  `window.MusicRecorder.setStatus` として公開し直し、engine.js 側に alias を追加。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-92`、
  `audio/music-stack-routing.js?v=fm-92`、`audio/music-focus-modulation.js?v=fm-92`、
  `audio/music-recorder.js?v=fm-92`、`audio/music-packet.js?v=fm-92` に cache bump。
- `sw.js hazama-fm-v184`: fm-92 assets を precache。

## v183 compact — engine recorder module

- `audio/music-recorder.js fm-91`: BL-008 next extraction。FM `REC`
  button の `RecorderState` + `MediaRecorder` capture cluster を engine.js から
  IIFE module へ移動。`window.MusicRecorder` を公開。
- `engine.js fm-91`: local recorder cluster を module alias に置換し、
  既存の REC button / teardown の `toggleLocalRecorder` / `stopLocalRecorder` flow は維持。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-91`、
  `audio/music-stack-routing.js?v=fm-91`、`audio/music-focus-modulation.js?v=fm-91`、
  `audio/music-recorder.js?v=fm-91` に cache bump。
- `sw.js hazama-fm-v183`: fm-91 assets を precache。

## v182 compact — engine focus modulation module

- `audio/music-focus-modulation.js fm-90`: BL-008 next extraction。FM `40HZ`
  button の 40 Hz focus AM state / LFO / ramp / UI event dispatch cluster を
  engine.js から IIFE module へ移動。`window.MusicFocusModulation` を公開。
- `engine.js fm-90`: focus modulation cluster を module alias に置換し、
  既存の `window.setFmFocusModeEnabled` / `window.getFmFocusModeState` API は維持。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-90`、
  `audio/music-stack-routing.js?v=fm-90`、
  `audio/music-focus-modulation.js?v=fm-90` に cache bump。
- `sw.js hazama-fm-v182`: fm-90 assets を precache。

## v181 compact — engine dormant audit cleanup

- `engine.js fm-89`: BL-017 audit pass。`randomNoteFromScale()` は未参照の
  legacy helper と確認できたため削除。既存 melodic director / chord path には影響なし。
- BL-017 前提訂正: `FocusModulationState` は FM の `40HZ` button + engine API、
  `AcidLockState` は `btn_acid_lock`、`MicFollowState` は Core/FM mic controls として
  現役。削除/復活対象ではなく、残る判断は BL-004 の 40Hz depth A/B。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-89` と
  `audio/music-stack-routing.js?v=fm-89` に cache bump。
- `sw.js hazama-fm-v181`: fm-89 assets を precache。

## v180 compact — Band Room kit source labels

- `band-room.js br-87`: kit selector labels now distinguish `synth:` from
  `sample:` sources, making the AI drum synth vs current-song/catalog sample kits
  scannable without changing the default `auto-self` behavior.
- `band-room.html` / `sw.js`: `band-room.js?v=br-87` cache bump。
- `sw.js hazama-fm-v180`: Band Room script markerをprecache。
- `check-band-room-logic.mjs`: Band Room script markerを literal ではなく
  HTML/SW の同期で検証し、kit label の区別も guard。

## v179 compact — music-stack route recommendation module

- `audio/music-stack-routing.js fm-88`: BL-008 Step B。`musicStackRoutingRecommendation`
  の scoring / destination decision を engine.js から純関数 `routingRecommendation`
  として移動。Tone.js / DOM / engine state 依存なし。
- `engine.js fm-88`: runtime defaults（selfReview / parts / gradient / kits /
  activePads / Hazama FM cue / producer habit curiosity）を集めて module に渡す
  thin adapter に縮小。挙動は保存。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-88` と
  `audio/music-stack-routing.js?v=fm-88` に cache bump。
- `sw.js hazama-fm-v179`: fm-88 assets を precache。

## v178 compact — engine.js modularization step 1 (music-stack routing)

- `engine.js fm-87`: engine.js モノリス（約14.8k行）の部分モジュール化 第1歩（BL-008）。
  cross-repo ルーティング推薦クラスタ（`MUSIC_STACK_ROUTE_*` / `hazamaFmReviewCue`、
  純データ + 純関数 約140行）を engine.js から新規 `audio/music-stack-routing.js` へ抽出。
  engine.js 側は `window.MusicStackRoutes` への 3 行エイリアスに置換。挙動は完全保存。
- `audio/music-stack-routing.js`: 新規モジュール（IIFE、`window.MusicStackRoutes` を公開）。
  既存 helper（`audio/human-groove-governor.js` 等）と同じ satellite-script パターン。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-87` に cache bump、新モジュールを追加。
- `sw.js hazama-fm-v178`: `engine.js?v=fm-87` と `audio/music-stack-routing.js?v=fm-87` を precache。

## v177 compact — Hazama FM melody harmony + humanize

- `engine.js fm-86`: Hazama FM の primary メロディ voice（memory pluck signature
  cell `triggerMemoryPluckSignatureCell`）に和声と humanize を追加。
  - **和声**: 単音だった lead の下に `MODE_CHORDS` の chord tone を 2 声、phrase
    ごと（`MelodicDirectorState.chordTurn`）に回しつつ soft に重ねる。「弾いた
    和音」の厚みを付与。
  - **humanize**: accent 音は長め（"8n"/"16n"）に鳴らして breathe、lead velocity に
    per-hit jitter を追加。固定 "32n" の機械感を緩和。
  - engine.js 凍結ルールに対し、1 関数に境界限定 + feature branch + PR で実施。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-86` に cache bump。
- `sw.js hazama-fm-v177`: `engine.js?v=fm-86` を precache。

## v176 compact — Hazama FM funk voice timbres enriched

- `audio/genre-flavor.js fm-71`: Hazama FM の funk EP (Rhodes) を、和音を
  一括同時発音する flat block から **per-note ロール (8-22ms ずらし) +
  voice ごとの velocity ばらつき** に変更。jazz comp / piano voice と
  同じ「弾いた和音」の質感に揃えた。`buildFunkDefault` と
  `buildFunkFromFrames` の両経路。
- funk clavi のフィルターを **velocity 追従** に変更。強打で bite が
  明るく開き、弱打は丸く残る。これまでは静的 cutoff で全ノート同一音色
  だった。全体音量は据え置き。
- `fm.html` / `sw.js`: `audio/genre-flavor.js?v=fm-71` に cache bump。
- `sw.js hazama-fm-v176`: `audio/genre-flavor.js?v=fm-71` を precache。

## v173 compact — Hazama FM conversation SYNC metadata

- `engine.js fm-85`: Hazama FM v172 の
  `window.HazamaFlavorState.conversation` を
  `performance_state.hazama_fm.conversation` に metadata-only で載せる。
  内容は 8小節会話の `role` / `motif` / `transform` / `densityBias` /
  `restGate` だけで、旋律、コード進行、音声、サンプルは含めない。
- `docs/schema/music-session-packet.schema.json` と example packet を同期。
- `sw.js hazama-fm-v173`: `engine.js?v=fm-85` を precache。

## v172 compact — Hazama FM groove conversation

- `audio/genre-flavor.js fm-70`: Hazama FM の parallel flavor layer に
  `GrooveConversationState` を追加。8小節 cycle で `bass-call` /
  `comp-answer` / `drum-comment` / `space` / `lead-call` /
  `bass-answer` / `comp-lift` / `recap` を回し、ベース、コンピング、
  ドラム、リードが同時に鳴り続けるのではなく呼応するようにした。
- `window.HazamaFlavorState.conversation` に `{ version, bar, role, motif,
  transform, densityBias, restGate }` を公開。既存の `sessionRole` /
  `leadVoice` / `phraseBar` / `phrase8Bar` / `movement` / `dropBar` /
  `keyShift` / `groove` は維持。
- `sw.js hazama-fm-v172`: `audio/genre-flavor.js?v=fm-70` を precache。

## v171 compact — Band Room PWA + mobile screen-lock hardening

- `band-room.html`: Band Room 専用 `manifest-band-room.webmanifest` と
  `apple-touch-icon` / app title を追加。ホーム画面 install 時の standalone
  起動を Hazama FM / Music Core Rig と揃えた。
- `band-room.js br-86`: iPhone / mobile browser の screen lock / blur / freeze /
  pagehide で複数回の panic release を走らせる。画面を閉じる瞬間に attack 済みで
  release が取り残される単音ループを減らす。
- catalog sampler wrapper に `releaseAll()` / `triggerRelease()` を追加し、
  electric bass / guitar / sampled chord 等も suspend panic の対象にした。
- `sw.js hazama-fm-v171`: Band Room manifest と `band-room.js?v=br-86` を precache。

## v170 compact — Hazama FM / Music Core Rig bassline director

- `engine.js fm-84`: shared engine に phrase-level bassline director を追加。
  4〜8 bar ごとに bass gate / interval walk / ghost push を切り替え、main synth
  bass が固定 root loop に張り付かないようにした。
- lofi Salamander bass と dub electric bass も同じ director を共有し、
  `root / 5th / octave / 5th` や `root + octave skip` の固定 bar を解消。
- runtime diagnostics は `window.MusicRuntimeState.basslineDirector` に pattern /
  gate / phraseBars を出す。
- `sw.js hazama-fm-v170`: `engine.js?v=fm-84` を precache。

## v169 compact — Hazama FM melodic director

- `engine.js fm-83`: Hazama FM に phrase-level melodic director を追加。
  8〜16 bar ごとに key center / contour / chord turn を変え、固定的な
  `D / F# / G / E` 断片の反復感を減らす。
- `tonalRhymeIndex()` は pool length を受け取り、6/10 音 pool も偏らず使う。
  `voiceFragment()` / `randomHazeChord()` / `randomChordForMode()` / bass root は
  director 経由で phrase-aware に変化。
- runtime diagnostics は `window.MusicRuntimeState.melodicDirector` に key /
  contour / phraseBars を出す。
- `sw.js hazama-fm-v169`: `engine.js?v=fm-83` を precache。

## v168 compact — saved mix migration + closeout

- `band-room.js br-85`: v167 の default mix polish を既存ユーザーにも反映するため、
  localStorage に残った v166 系の旧 default slider 値だけを新 default へ自動移行。
- 手動で変えた slider 値は維持し、旧 default と完全一致する値だけ更新する。
- 保存 prefs に `mixPrefsVersion` を持たせ、次回以降は同じ migration を繰り返さない。
- `sw.js hazama-fm-v168`: Band Room の新 script marker を precache。

## v167 compact — default mix polish

- `band-room.js br-84`: master headroom を広げ、limiter threshold / 2 段 comp /
  broad EQ / stereo width / tape send / room reverb を控えめに再調整。
- stem EQ は低域の濁りと高域の刺さりを抑え、vocal de-ess と vocal FX send も
  少し乾いた位置へ。原音 stems は limiter に張り付きにくい default gain に変更。
- AI 再現は source-derived agents の密度に合わせて drums / bass / guitar /
  vocal guide / chords の bus default を下げ、前後感と長時間 listening を優先。
- vocal FX / external vocal / click / master dry path は HTML slider と実 bus の
  初期値を揃え、初回操作で音量や空間が跳ねないようにした。
- 4-stem pack recorder tap は stem bus 構築後に接続し、export が `0/4 streams`
  にならないようにした。
- master presets も neutral / lo-fi / club / rock / ambient を全体に控えめな
  loudness / width / warmth へ再調整。
- `sw.js hazama-fm-v167`: Band Room の新 script marker を precache。

## v166 compact — source-derived AI part agents

- `band-room.js br-83`: AI 再現の bass / guitar / vocal guide / chords を
  source-derived part agent 化。原曲 drum-frame の kick / snare / hat /
  ghost / crash、section role、chord progression を読んで各パートが別々に
  自律 pattern を組む。
- bass は kick pattern に同期し、ghost / recap / comp で pickup を足す。
  guitar は source accent と hat density で palm mute / 16th drive / bridge
  stab を切り替える。vocal guide と chords は phrase end / ghost answer /
  section pressure に応答する。
- AI 再現の初期音色は `bass-electric` / `guitar-electric` sampler を優先し、
  online catalog が使えない場合は既存 synth fallback に戻る。
- `sw.js hazama-fm-v166`: Band Room の新 script marker を precache。

## v165 compact — ordinary song timeline / seek

- `band-room.html` / `band-room.css br-73` / `band-room.js br-82`: START 下に
  elapsed / duration の `m:ss` 表示と seek bar を追加。
- 停止中に seek した位置を `pendingSeekOffsetSec` として保持し、次の START は
  その地点から開始。STOP も現在位置を保持する。
- 再生中の seek は Transport / section display / lyrics highlight / 原音 stems /
  external stems を同じ offset に揃え直す。
- `sw.js hazama-fm-v165`: Band Room の新 cache marker を precache。

## v164 compact — Chill Session visible route

- Music Core overview に `Chill` 入口を追加。
- chill 側の session copy も metadata-only / human START 境界を明示し、
  Music Stack 内の導線を整理。

## v163 compact — offline-safe lyrics and handoff copy

- `sw.js hazama-fm-v163`: cache-busted `presets/*.json` and `docs/*.md`
  requests now fall back to the precached bare URL with `ignoreSearch`, so
  Band Room can load drum frames and `docs/tabasco-lyrics-final.md` offline
  even when runtime fetches include `?cb=...`.
- `band-room.html` / `band-room.js br-81`: Band Room ships a fresh script
  cache marker and labels the Drum Floor link as manual preview / metadata-only
  handoff.
- `docs/tabasco-lyrics-final.md`: tightened `Human Fly` so it keeps the same
  meaning as the one final sheet while avoiding duplicate `Hey` imagery and
  mixed-language chorus copy.
- Music Core overview, SYNC docs, and Drum Floor return copy now expose the
  Band Room / Drum Floor route as human-started preview rather than automatic
  playback.

## v162 compact — final singable lyrics

- `docs/tabasco-lyrics-final.md`: Tabasco 7 曲の候補歌詞を一本化し、
  Band Room にそのまま表示できる歌える final sheet として整えた。
- `presets/bands.json` / fallback registry: `lyrics_doc` を final sheet に変更。
  Band Room 本体は draft / cut-up / syllabic 候補を並べず、一本だけ表示する。
- `band-room.html` / `band-room.js br-80` / `sw.js hazama-fm-v162`:
  footer の歌詞リンクも `final singable` に絞り、cache を更新。

## v161 compact — Band Room full-song playback + iPhone suspend recovery

- `band-room.js br-79`: 原音モードの auto advance を、section structure 終端ではなく
  loaded stem / catalog `duration_s` の full-song duration まで待つように修正。
  `Hey` など structure JSON が実曲より短い曲でも途中で次曲へ進まない。
- `band-room.js br-79`: iPhone / mobile Safari の background suspend から戻った時に
  AudioContext / Transport / stem offset を復旧し、stuck single-note を release する
  playback watchdog を追加。
- `band-room.css br-72`: hidden media bridge の `rearming` state を route pill に反映。

## v160 compact — FM route diagnostics + rearm

- `engine.js fm-82`: hidden audio bridge の診断 state を `window.MusicBackgroundBridge`
  に公開し、loss / failed / rearm attempt / output route を snapshot できるようにした。
- `fm.html` / `fm.css fm-50` / `fm.js fm-64`: route badge を押すと診断 panel が開き、
  current route / bridge event / output / AudioContext を確認しつつ `rearm` できる。
- bridge loss 時は direct 出力へ戻したまま、iOS Safari 推奨環境では短い backoff で
  hidden bridge を自動 rearm する。

## v159 compact — FM to Drum Floor handoff

- `fm.html` / `fm.js fm-63`: Hazama FM に `drum floor →` を追加。
  クリック時に shared Music session packet を metadata-only SYNC し、同時に
  `from=fm&g=...&energy=...&bpm=...` query fallback を付けて drum-floor を開く。
- `engine.js fm-81`: FM genre / energy / BPM / dwell / review cue を
  `routing.drum_floor.hazama_fm` と `routing.drum_floor.bpm` に載せ、drum-floor
  側が手動preview候補を作りやすくした。
- drum-floor sister repo main: `from=fm` query fallback と stale packet guard を追加。
  Band Room 由来 packet は song だけでなく section / BPM も見て古い SYNC を弾く。
- 運用 docs: user が「全mergeで締めて」と指示した turn は、検証済み PR / branch
  を main に merge・pushし、merged branch を削除してから final する。

## v158 compact — Hazama FM route badge

- `fm.html` / `fm.css fm-49` / `fm.js fm-62`: Hazama FM に `off` /
  `direct` / `ready` / `bridge` / `failed` の audio route badge を追加。
  engine.js の hidden `background_value` を MutationObserver で読み、車載 /
  Bluetooth 確認時に bridge 経由か direct 出力かを見える化する。
- `scripts/check-fm-route-badge.mjs`: FM route badge の DOM / CSS /
  `background_value` 同期ロジックを静的検査。`check-js.mjs` にも追加。

## v157 compact — Drum Floor return song links

- `band-room.js br-78`: `band-room.html?from=drum-floor&song=...&band=...`
  を受け取り、通常 reload は 01 start のまま、Drum Floor から戻った時だけ
  source song を開く。
- `scripts/check-band-room-logic.mjs`: Drum Floor return query が `from=drum-floor`
  に限定され、saved prefs が last song を復元しないことを静的検査。
- drum-floor sister repo 側は PR #50 merge 済み。return links / query fallback は main に入っている。

## v156 compact — visible FM / Band Room handoff

- `fm.html` / `fm.js fm-61` / `fm.css fm-48`: Hazama FM に `band room →`
  導線を追加し、現在の FM genre を `band-room.html?from=fm&g=...&pattern=...`
  に反映。クリック時は既存 localStorage suggestion も更新する。
- `band-room.html` / `band-room.js br-76` / `band-room.css br-71`: FM deep link
  の `pattern` query を localStorage suggestion より優先して読み、stems mode
  初期表示でも小さな `FM suggests ...` CTA を出す。`inject` はユーザー操作時のみ。
- Band Room footer の Hazama FM link も、inject 済み pattern から近い FM genre
  (`lofi` / `jazz` / `techno` / `funk`) へ戻れる query link に更新。

## v155 compact — Band Room to Drum Floor handoff

- `band-room.html`: footer の別 app 導線に `Drum Floor` を追加。
- `band-room.js br-75`: 現在の Band Room song / BPM / section / drum frame を
  metadata-only の `qb:music-stack:latest-packet:v1` と `qb:music-stack:v1`
  に publish してから drum-floor を開く。drum-floor 側の既存 Music SYNC
  receiver が拾える形式で、音声・sample・lyrics は入れない。
- `scripts/check-band-room-logic.mjs`: handoff が `drum_floor` 推奨、
  manual start required、metadata-only のままかを静的検査。

## v154 compact — louder browser playback

- `fm.js fm-60`: Hazama FM の起動時 OUTPUT target を 75 → 88 に上げ、
  ブラウザ/車載で OS 音量を最大付近まで上げなくても聴ける基準に変更。
- `engine.js fm-80`: Music Core Rig / Hazama FM 共通の OUTPUT gain curve を
  少しだけ前へ出し、default OUTPUT も 88 に更新。limiter は guardrail のまま。
- `audio/genre-flavor.js fm-69`: FM の parallel flavor layer も OUTPUT に
  追従して少し前へ。piano / ambient も隠れすぎないように調整。

## v153 compact — car/lock-screen album transport

- `band-room.js br-74` / `band-room.css br-70`: Media Session `nexttrack` / `previoustrack` を
  section 移動から song 移動へ変更。車載/ロック画面の曲送りが 01 → 02 →
  03... の album flow と一致する。狭幅でも route badge を `B` / `D` / `F` で表示。
- 手動 track click / band switch / 自動曲送り中は、再生中なら hidden media
  bridge を維持してから曲を差し替える。車載/Bluetooth route が手動操作の
  曲間でも落ちにくい。
- `engine.js fm-79`: Hazama FM / Music Core Rig の hidden media bridge に
  health fallback を追加。bridge が pause/error/ended した時は direct output を
  復帰し、stale-silent を避ける。`setSinkId` 失敗時も default sink で継続。
- Band Room logic check に first/adjacent song ordering と Media Session
  album transport の静的検査を追加。

## v152 compact — album-flow default playback

- `band-room.js br-73`: reload 後の default track を 01 `TABASCO` に戻し、
  localStorage の前回 song 復元は廃止。sound/editing prefs は引き続き保持。
- 曲末は同じ曲の structure / stems loop ではなく、次 track へ auto advance。
  01 終了後は 02 `Hey`、以降 set list 順に進む。最後の曲だけ停止。
- 自動曲送り中は hidden media bridge を維持して、車載/Bluetooth の route が
  曲間で落ちにくいようにした。

## v151 compact — audit gate + car bridge hardening

- `scripts/audit.py`: `index.html` も含め、HTML の versioned asset URL と
  `sw.js` precache URL を path 単位で照合。precache local file existence と
  `sw.js VERSION` の release-doc 同期も検査。
- `band-room.js br-72` / `band-room.css br-69`: hidden media bridge を user gesture
  window 内で先に開始し、bridge loss 時は direct output に復帰。master volume bar
  は sticky 化し、narrow mobile の overflow を抑制。
- `fm.js fm-59`: engine start failure を playing 扱いしない。warmup 中 STOP を許可し、
  genre profile の遅延 fader writes に sequence guard を追加。
- `engine.js fm-78`: 40Hz focus AM の gain param base を修正し、focus ON で
  master gain が二重加算されないようにした。
- `band-room.js br-72`: `chordRoot("C")` が `G2` に落ちる bass-root fallback を修正。

## v150 compact — route status + focus event quieting

- `band-room.css br-68` / `band-room.js br-71`: master volume bar に
  `direct` / `bridge` の audio route status を追加。hidden media bridge が有効な時は
  `bridge` と表示され、車載/Bluetooth 確認時に状態を見られる。
- `engine.js fm-77`: 40Hz focus mode の UI event dispatch を状態変化時に限定。
  focus monitor が 500ms ごとに同じ `music-focus-mode-state` を投げ続けない。
- `fm.js fm-58`: 車載/BT の media key volume 操作が fade in/out promise を
  詰まらせないようにし、Media Session metadata と session save の重複更新を抑制。
- `band-room.js br-71`: master volume `0` の reload 復元と Media Session handler
  登録の個別 fallback を修正。

## v149 compact — 車載/BT・genre handoff・runtime hygiene

- `band-room.js br-70`: master volume bar と `br-loudness` を乗算関係に修正。
  車用の 0-100 音量と mastering loudness が互いに上書きしない。
- `band-room.js br-70`: Hazama FM が suggestion を clear した時、Band Room の
  genre picker status も stale 表示を消す。
- `sw.js hazama-fm-v149`: Band Room の `audio/audio-safety.js?v=br-66` を
  precache に追加。

## v145-v146 compact — Band Room car audio bridge + FM genre suggestion

- v145: Hazama FM で効いていた hidden `<audio srcObject=MediaStream>` bridge を
  Band Room に移植。WebAudio final mix を HTMLAudioElement 経由にも流し、
  iOS Safari / 車載 Bluetooth で通常メディア音声として扱われやすくした。
- v146: trap / soul-funk genre pattern を追加。Hazama FM の genre pill から
  Band Room の genre picker へ suggestion を渡す。自動 inject はせず、
  ユーザーが Band Room 側でタップして適用する。

## v141-v144 compact — car volume controls

- v141: header 直下に master volume bar を常時表示。`- / +` は 5 刻み。
- v144: Media Session の `seekbackward` / `seekforward` を master volume の
  down/up fallback として扱う。

## v115 — Hazama FM lofi 完全 piano trio + breakbeat 化

- `engine.js fm-58`: Hazama FM lofi mode で bass / drum も sampler に置換
- `lofiBassSampler`: Salamander Grand Piano 低オク (A0–C3)、walking pattern
  (root/5th/oct/5th)、bassBus 経由、毎 1 小節
- `lofiDrumSamples`: tone-breakbeat の kick/snare/hat 3 ショット、drumBus 経由、
  boom-bap pattern (kick on 1 + sync 3.5、snare 2/4、hat 8th)
- updateSoundForMode の lofi クリーンアップ拡張 (bass.volume も復元、新 layer
  の stop 含む)
- 既存 synth pad/bass は -28/-26 dB に減衰 (二重発音防止)
- 3 app で「lofi = Salamander piano trio + breakbeat」が完全成立
- USAGE-HAZAMA-FM / USAGE-MUSIC-CORE-RIG / FREE-SAMPLES-AND-SYNTHESIS doc 更新
- CROSS-APP-INTEGRITY の lofi 整合表を v115 状態に更新

## v114 — Hazama FM デフォルト最適音 + 全 mode mix profile polish

- `engine.js fm-57`: HAZAMA_FM_ENGINE_MIXES を 6 mode 全て調整
  - lofi: padBus 0.38 → 0.30、glassDb -8.5 → -16、voiceDustDb -8.5 → -16
    (Salamander piano を前面に、装飾 noise 大幅減)
  - ambient: padBus 0.8 → 0.65、textureDb -3.5 → -6、delayWet 0.18 → 0.16
    (静か系で delay 不要)
  - jazz / funk / techno / piano も同様にバランス調整
- lofi mode の synth pad osc を triangle → sine (Salamander の支え役に)
- lofi mode の synth bass を warm triangle + slow filter env (walking 寄り)
- globalReverb decay 5.5 → 3.6 (short room reverb、piano に自前 decay)
- Salamander piano sampler の volume -6 → -10、release 1.6 → 2.0
- scheduling を 1m → 2m (chord stab + 0.5 拍遅れ accent note = anticipated comp)

## v113 — Hazama FM lofi 整合化 (cross-app)

- `engine.js` の lofi mode で **Salamander Grand Piano (CC-BY)** sampler を
  pad 役で起動するレイヤー追加 (fm-56)
- 既存 synth pad は -22 dB に減衰、reverb/delay wet も穏当に (lofi = ノイズで
  覆うじゃなく実音色で表現する band-room と同じ哲学に揃える)
- `CROSS-APP-INTEGRITY.md` 新規 — 3 app + engine.js + catalog の境界 / 機能
  対応表 / リソース共有マップ / 整合性チェック結果

## v112 — catalog manual + jazzy bass/chord voicing

- `SAMPLE-CATALOG-GUIDE.md` 大幅拡張: nbrosowsky 全 instrument リスト、search
  クエリ集、NSynth strings 追加チュートリアル、license フローチャート、
  validation script outline、既知 resource roundup
- bass walking pattern (root/5th/oct/5th) — profile = lofi-nujabes or
  bass_instrument = salamander-bass のとき
- chord jazzy voicing (maj7/m7 + anticipated comping on beat 2.5) —
  profile = lofi-nujabes or chord_instrument = salamander-piano のとき
- `chordToSemi(chord)` helper 追加

## v111 — AI 音色再現を sampler でやり切る

- catalog に **9 新 instrument** 追加 (nbrosowsky/tonejs-instruments、MIT、
  guitar-electric/acoustic/nylon, bass-electric, violin, cello, flute,
  organ, harp)
- `makeGuitar` / `makeVoiceBox` を sampler 分岐対応
- UI: "guitar instr" + "melody lead" selector 追加
- `state.guitarInstrument` / `state.voiceInstrument` 永続化
- MASTER_PRESETS が 7 軸 linked (master 4 sliders + synth profile +
  chord/bass/guitar/voice instrument + kit_source + guitar_on)

## v110 — bass to real Salamander samples + master preset 全リグ駆動

- catalog に salamander-bass (Salamander の低オク抜粋) 追加
- `makeSynthBass` を sampler 分岐対応
- UI: "bass instr" selector
- MASTER_PRESETS に kit_source / bass_instrument / guitar_on linked

## v109 — dual-audio バグ修正 + Nujabes synth profile + linked master presets

- `jumpToSection` が mode 確認なしで stem を start してた問題修正
- mode change handler に hot-swap 追加 (mode 変更で audio graph 切替)
- KIT_PROFILES に `lofi-nujabes` 追加 (dusty drum + warm bass + soft pad +
  warm vocal)
- MASTER_PRESETS に synth_profile + chord_instrument linked 追加
- lo-fi master sliders 穏当に (reverb 38→32, width 50→64, warmth 32→24)

## v108 — bass anchor for no-chord sections + SW doc precache

- chord_progression が無い section (Human Fly intro/outro 等) で bass が
  rest だったのを song key root の whole-note anchor に fallback
- sw.js PRECACHE_URLS に v103+ で追加した docs (MANUAL / CATALOG-GUIDE /
  DAW-INTEGRATION / FREE-SAMPLES-AND-SYNTHESIS / REPO-MANAGEMENT / burroughs lyrics)
  を全部追加 → オフラインでもマニュアル開ける

## v107 — index-aware lyric highlight + 4-bar drum fill

- `updateLyricsHighlight` に index-aware fuzzy step を挿入 — verse-1 と verse-2 で
  別の lyric block にハイライト (v3 Burroughs marker 対応)
- 各 section の 4 bar 目 (intro/outro 除く) で tom/snare の fill — 16th × 4
  rising velocity (0.42→0.72) で groove に呼吸を入れる

## v106 — universal vocal + sparse drum reinforce + section crash

- vocal guide が Human Fly chorus 限定だったのを全曲全 section (verse/recap/comp)
  に展開 — chord 4-step walk (root/3rd/5th/3rd)、4 bar 目は root sustain
- sparse frame (events < 6) の bar に kick/snare 基本 4-on-floor を低 velocity で
  補強 — 既存 events を覆わず空きビートだけ埋める
- section transition の chorus/bridge/outro/chant-b 頭で drumKit.crash 発火
  (vel 0.62、2分音符) — lift 感

## v105 — Hey verse-2 半端なドラム問題の root cause + bulk toggles

- `chord_progression` キーの形式 mismatch ("verse-1" vs "verse"): 6/7 曲が
  フル名キー、band-room.js は base 名で引いてた → bass/chord/guitar 全部 rest
- Fix: `cp[sec.section] || cp[baseSection]` で full-first / base-fallback
- AI 再現 + 原音 stems 両方に `all on / all off / defaults / karaoke` バルクトグル

## v104 — AI mode usability + section nav clarity

- AI synth toggles の default OFF → drums/bass/guitar/voice/chords を checked に
  (click だけ OFF)
- bus levels 再調整: drums 0.75→0.62, bass 0.65→0.72, voice 0.40→0.56, chord 0.55→0.68
- chord PolySynth -16 → -12 dB、vocal AMSynth -10 → -14 dB
- `jumpToSection` で停止中なら `startPlayback({ preservePosition: true })` 自動発火
- help overlay に section nav の挙動を追記

## v95 — A/B state compare snapshots

- `captureSnapshot()` / `restoreSnapshot()` round-trip all sliders, toggles,
  mode, kitSource, kitProfile through dispatched input/change events
- Two slots (A, B); recall buttons enable when slot is populated
- New <details> "🔀 A/B compare (2 snapshot 即切替)"

## v94 — free-808 scaffold (CC-0 dirt-samples drop-in slot)

- `presets/sample-kits/free-808/README.md` with TidalCycles dirt-samples
  source instructions, file naming contract, manifest.json template
- ~600 KB once filled; not yet in KIT_OPTIONS (user adds after dropping in)

## v93 — master mix preset chips (lo-fi / club / rock / ambient)

- `MASTER_PRESETS` writes to 4 master sliders + dispatches input events
- 5 one-click vibes: neutral / lo-fi / club / rock / ambient
- Chip row in 🌌 mastering panel, .active highlight

## v92 — voice profiles extended (bass / chord / vocal)

- `KIT_PROFILES` each entry now has bass/chord/vocal dicts
- `makeSynthBass / makeChordSynth / makeVoiceBox` consult `currentProfile()`
- Profile change → dispose + rebuild all 4 synth voices (drum/bass/chord/vocal)
- Sakanaction: bright snappy bass, saw stab chord, clean vocal
- LCD motorik: sub-y bass with portamento, dreamy triangle pad, breathy vocal
- Cramps punk: distorted slap bass (drive 0.18), square stab chord, snarled vocal

## v91 — synth kit profiles (Sakanaction / LCD / Cramps punk)

- `KIT_PROFILES` table: 4 presets (default / sakanaction / lcd-motorik / cramps-punk)
- `makeDrumKit(target, profileName)` reads from profile dict for each voice
- UI: "🥁 drum kit source + synth profile" with 2 selectors
- Persisted via v78 prefs alongside kitSource

## v90 — stems pack export (4-stem simultaneous → DAW)

- 4 `Tone.context.createMediaStreamDestination()` tapped off each stemBus
- 4 `MediaRecorder` started/stopped together; STOP emits 4 download links
- Drums/bass/other tap post per-stem EQ pre-master FX (clean stems for DAW)
- Vocals taps post-FX bus (chorus/delay/reverb baked in — that's the vocal sound)
- New <details> "📦 stems pack export (4 stem 同時録音 → DAW へ)" with red rec button

## v89 — Music ↔ Band Room bridge (separate apps, shared samples)

- Design judgement: keep apps cleanly separated (different purposes) but
  provide sample-level bridge for material flow
- Music Core Rig REC now shows "→ Band Room へ" link next to save
- Band Room external stems help text lists sources: DAW / Music Core Rig REC / Suno
- Footer reorganized into "別 app: Hazama FM · Music Core" / "歌詞: v2 · v3" / "DAW 連携"
- `style.css?v=fm-26`, fixed stale `engine.js?v=fm-54 → fm-55` in `index.html`

## v88 — WebMIDI in/out (hardware sync)

- OUT: 24 PPQ MIDI Clock from Tone.Transport.bpm → drum machine / DAW BPM sync
- IN: note-on listener — C2-G3 (36-55) → phrase trigger 01-20, C4-G#4 (60-68) → section jump
- "🎹 MIDI in/out" panel with `navigator.requestMIDIAccess` enable button
- Out/In dropdowns auto-populate from `midiAccess` + hot-plug via `onstatechange`

## v87 — per-stem external upload (drums / bass / other)

- Generalized vocal external upload pattern to all 4 stems
- `externalStemPlayers = { drums, bass, other }` routes to `stemEQs[stem].input`
  so per-stem EQ (HP/shelf/de-ess) applies to user takes
- New <details> "🥁🎸🎹 external stems" with one block per stem
- Toggle external → original stem auto-mutes → user's take plays through master chain
- + `docs/DAW-INTEGRATION.md` (roadmap: stem in/out paths, MIDI sync, sound quality options)
- + `docs/tabasco-lyrics-burroughs.md` v3 cut-up / fold-in lyrics for all 7 songs

## v86 — quick help overlay

- `?` button top-right and `?` key open a modal card with feature bullets + keyboard cheat sheet
- Escape / backdrop click / 閉じる button dismiss

## v85 — MediaSession (lock screen + media keys)

- `navigator.mediaSession` metadata, artwork (PWA icons), playback state
- Handlers: play / pause / stop / previoustrack / nexttrack mapped to band-room actions
- Refresh on band/song change and on playback start/stop

## v84 — SW registration + non-disruptive update banner

- band-room.html now registers `sw.js` (it didn't before — PWA install was broken)
- New version detected → fixed pill banner at bottom-center with "リロード" and "×"
- Unlike fm.html (auto-reload) the banner waits for the user — mid-jam reload is rude

## v83 — drag-drop external vocal

- Drop mp3/wav onto the `#br-external-vocal` panel as an alternative to the file picker
- `dragover` highlights the panel (dashed → solid border + brighter bg)
- Non-audio files rejected with status message

## v82 — phrase trigger qwerty keyboard mapping

- First 20 phrase cells map to `q w e r t y u i o p` (row 1) and `a s d f g h j k l ;` (row 2)
- Each cell shows the assigned key in a small corner chip
- Keydown fires the cell's click handler + `kbd-flash` pulse animation

## v81 — live recording (MediaRecorder → download)

- `Tone.context.createMediaStreamDestination()` taps `masterLimiter`
- `MediaRecorder` (audio/webm;codecs=opus preferred) collects chunks every 500ms
- STOP REC produces a `band-room_{band}_{song}_{ISO}.webm` download link with file size
- Recording does NOT stop playback

## v80 — A-B section loop

- Shift-click chip = set A; second shift-click = set B (auto-orders so A is earlier)
- `state.loopA / loopB` + visual chip prefixes (`A·` / `·B`) + golden tint between
- scheduleBar: at section transition, if `sectionIdx > loopB` → `jumpToSection(loopA)` (via RAF)

## v79 — keyboard shortcuts

- `space` play/stop · `[` `]` prev/next section · `1..9` jump · `m` toggle stems/AI mode
- Skipped when focus is on text inputs / textarea / select, or modifier keys held
- Footer hint chip shows the bindings in `<kbd>`

## v78 — localStorage persistence

- Key `band-room.prefs.v1`: bandId / songId / mode / kitSource / all range sliders / all checkbox toggles
- Debounced 400ms writes on `input` + `change` anywhere in `#br-main`
- Restored on `DOMContentLoaded` after the bands registry loads — selectors and handlers re-fire

## v77 — spectrum analyzer

- `Tone.FFT` size 64, smoothing 0.65, tapped off `masterLimiter`
- 280×36 canvas in transport, shares the master-meter RAF
- Bins color-tinted by band (bass 14°, mid 22°, high 28°)

## v76 — practice tempo slider (50–120%)

- Multiplier on `Tone.Transport.bpm.rampTo(baseBpm × mult, 0.4)`
- Also adjusts `Tone.Player.playbackRate` on stems (acknowledged pitch shift — warned in UI)
- Applied at `startPlayback` and `startStemPlayback` so re-start at 80% stays at 80%

## v75 — clickable section nav with stem seek

- Chips under transport, one per `structure[]` entry
- `jumpToSection(idx)` sums bars × `(60/bpm × 4)` → `Tone.Transport.seconds = targetSec`
- Re-seeks every stem player via `player.start("+0.05", targetSec)` — `loop:true` keeps wrapping

## v74 — cross-app mastering propagated to Hazama FM

- `engine.js` master chain: `masterGain → masterComp (-10 dB, 2:1) → masterWidener (0.62) → masterLimiter`
- Conservative settings; FM ambient softness preserved
- `engine.js?v=fm-55`, `sw VERSION = hazama-fm-v74`

## v73 — lyric blocks with section-synced highlight

- Markdown lyrics parsed into per-`[marker]` `<div class="br-lyric-block" data-marker="slug">`
- `updateLyricsHighlight(sectionName)` slug-matches the current section, scrolls into center, dims others
- Fuzzy fallback: `chorus-2 → chorus`

## v72 — phrase trigger 3-mode

- ⚡ 即発火 (default, instant) · ⏱ 次小節 (`Tone.Transport.nextSubdivision("1m")`) · 🔁 ループ
- Loop mode toggles per phrase: click again to stop and dispose
- Multiple phrases can loop simultaneously, each in its own player

## v71 — stem crossfade + master RMS meter

- `Tone.Player` fadeIn 0.005→0.15, fadeOut 0.02→0.30
- Track-button handler awaits 320ms after `player.stop()` before disposing — audible crossfade on song change
- `Tone.Meter` (smoothing 0.75) → 4px bar in transport, color shift accent → accent-soft @ -12 dB → red @ -3 dB

## v70 — AI 再現 polish (chorus / auto-pan / drive)

- `makeGuitar`: `Tone.Chorus` (0.9 Hz, depth 0.38, wet 0.34) before distortion
- `makeChordSynth`: `Tone.Chorus` + `Tone.AutoPanner` (0.18 Hz, depth 0.32) for slow LR drift
- `makeSynthBass`: post `Tone.Distortion` (0.08, wet 0.45) + LP filter for grit

## v69 — AI 再現 stereo placement

- `makeSampledKit`: per-voice `Tone.Panner` (kick 0, snare -0.06, hat +0.22, ghost -0.16, fill +0.12, crash +0.20)
- `ensureMaster`: per-bus panners — guitar -0.25, chords +0.20, others center
- Stems mode untouched — original mix integrity preserved

## v68 — don't stop mid-song

- `Tone.Player loop:true` on stems — practice/jam sessions don't go silent at song end
- `scheduleBar`: structure end wraps `sectionIdx = 0` instead of `stopPlayback()`
- `visibilitychange` listener calls `Tone.context.resume()` when tab returns visible — fixes mobile freeze

## v67 — UI simplify

- 16+ top sections collapsed into 6 core + 6 `<details>` (vocal FX / external / phrase / kit / volume / mastering)
- Non-active mode is `display:none` instead of dim — half the UI evaporates per mode

## v66 — mastering chain

- Per-stem EQ via `makeStemEQChain` (drums HP/EQ3, bass HP+LP, vocals HP+presence+de-esser, other HP+air)
- Two-stage master comp (gentle leveler + glue), `Tone.StereoWidener`, parallel tape sat
- New sliders: tape warmth (0–40 → wet send), loudness (-12..+6 dB → master gain)

## v65 — real drum pattern extraction

- `_extract_drum_patterns.py` rewrites all 7 Tabasco `drum-frames-*.json` from the actual stems
- librosa onset detect + band-energy classification (sub/low/mid/snap/high) + 16th-quantize
- Each frame's `events[]` reflects what the original drummer played, not a 4-on-floor template
- New `auto-self` kit source = current song's own drums

---

## Synth profile cheat sheet (v91-v92)

| profile        | drum kick                     | bass                          | chord                    | vocal               |
|----------------|------------------------------|-------------------------------|--------------------------|---------------------|
| default        | decay 0.32, 4 oct             | filter 480, drive 0.08         | triangle, verb 0.20      | formants 700/1200   |
| sakanaction    | decay 0.20, 5 oct, click -22  | filter 720, drive 0.04         | saw stab, chorus 0.55    | clean, verb 0.14    |
| lcd-motorik    | decay 0.38, 6 oct             | filter 600, portamento 0.04    | dreamy triangle, verb 0.34 | breathy, verb 0.32 |
| cramps-punk    | decay 0.40, click -36         | filter 380, drive 0.18, wet 0.70 | square stab, verb 0.12 | snarled, vibrato 18c |

## Master mix preset cheat sheet (v93)

| preset   | reverb | width | warmth | loudness | feel                          |
|----------|--------|-------|--------|----------|-------------------------------|
| neutral  | 22     | 72    | 10     |  0       | current default               |
| lo-fi    | 38     | 50    | 32     | -3       | lofi hiphop, washy, narrow    |
| club     | 12     | 88    | 18     | +3       | dry / ultra-wide / hot         |
| rock     | 14     | 65    | 12     | +1       | punchy mid-room               |
| ambient  | 55     | 90    | 22     | -2       | long verb / very wide          |

## DAW / hardware integration (v87-v90)

| feature                  | version | how to use                                          |
|--------------------------|---------|-----------------------------------------------------|
| external stem upload     | v87     | drag mp3/wav onto 🥁🎸🎹 → original auto-mutes       |
| external vocal upload    | v83     | same flow for vocals (Suno / 自分歌い直し)           |
| MIDI Clock out           | v88     | enable MIDI → pick output → DAW/drum machine syncs   |
| MIDI note in             | v88     | C2-G3 → phrase 01-20, C4-G#4 → section jump          |
| 1-track master record    | v81     | ⏺ REC → webm download                                |
| 4-stem pack export       | v90     | 📦 stems pack → 4 download links                    |
| Music Core Rig bridge    | v89     | Music REC → drop wav into Band Room external slot    |

See [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) for the full roadmap.

## Lyric versions

- v2.1 plain English: `docs/tabasco-lyrics-draft.md`
- v3 Burroughs cut-up: `docs/tabasco-lyrics-burroughs.md` (Naked Lunch grade)

Same melody in both, pick by mood.

## Keyboard cheat sheet (v86)

| key                | action                                          |
|--------------------|-------------------------------------------------|
| `space`            | play / stop                                     |
| `[` / `]`          | previous / next section (audio + lyrics seek)   |
| `1`..`9`           | jump to section index (1-based)                 |
| `m`                | toggle stems ↔ AI 再現 mode                     |
| `?`                | open quick help overlay                         |
| `Escape`           | close overlay                                   |
| `q`..`p`, `a`..`l`, `;` | fire phrase trigger 01..20                 |

Shift-click on a section chip sets A→B loop range.

Skipped when typing in form fields or holding Ctrl/Cmd/Alt.

## Production deploy chain (v65 → v86)

All commits push to `main`, GitHub Pages auto-deploys. Each new push
cancels the previous in-flight build (rapid-fire commits during a
session are normal — the final commit is the one that ships).

Service Worker is `sw.js` with `VERSION = hazama-fm-v86`; matches
`band-room.{html,js,css}?v=br-31`. SW caches all the stem mp3s in
`presets/tabasco-stems/<song>/{vocals,drums,bass,other}.mp3` for
offline use; mirror the same naming when adding new bands.
