# Band Room — 使い方ガイド

> Listen hub: https://quietbriony.github.io/Music/listen.html
> Band Room: https://quietbriony.github.io/Music/band-room.html
> HAZAMA直接入口: https://quietbriony.github.io/Music/band-room.html?band=hazama
>
> Tabascoの原音 / AI再現をA/Bしたり、HAZAMAの原音（Still Moving完成レンダー）と
> AI再現を聴き比べたり、自分のtakeを録音・uploadしたりできる。

## いちばん短い遊び方

1. Listen hubから`HAZAMA Band Room — Still Moving`を開く。
2. 01 / 02と`📻 原音`（基準）/ `🎛 AI 再現`を選び、`START`を一度押す。
   02のAI再現は02固有ではなく01 frames共有の暫定版なので、02固有の判断は原音を使う。
   歌詞を外す／自分で歌う時はListenの01/02 `KARAOKE` linkを開く。
3. `WARMING UP` / `PREPARING AI`中はband・song・modeのbusy解除を待つ。
   失敗したらSTART直下の案内に従い、再度`START`、次に`RESET AUDIO`を使う。
4. 聴き終えたらListen hubへ戻り、Lyric Labでkeep / fix・歌詞・制作先を手動で整理する。
   リンクを開くだけでmodel実行やdownloadが始まることはない。

復旧条件を含むこの導線の正本は
[BAND-ROOM-MANUAL.md](./BAND-ROOM-MANUAL.md)。
現行runtime / playability契約はv400（02 AI明示 + session-only KARAOKE + 曲別歌詞境界）、client markerは`br-235` / `br-90`。
実音・mobile合格とHAZAMAのmain selector昇格はBL-041 human gateで、まだ未判定。

## 画面構成（現行: br-235 / br-90）

```
┌─────────────────────────────────┐
│  BAND ROOM                       │
├─────────────────────────────────┤
│  [-] master volume [====] 80 [+] │  ← 車 / touch 向け常時音量
├─────────────────────────────────┤
│  [Tabasco] [...]                 │  ← visible band 選択（HAZAMAはdeep-link）
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← song 選択 (7 曲)
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← HAZAMAは原音が既定（AI切替可）
├─────────────────────────────────┤
│  [ START ]                       │  ← warming / preparing / stop
│  01 Still Moving · 原音 4 stems   │  ← 選択文脈 / 読込サイズ
│  復旧案内                         │  ← START失敗時だけ表示
│  0:00 ━━━━━━━━━━━━━ 5:04          │  ← song timeline / seek
│  117 BPM · G major               │
│  verse-1 · 4/16 → chorus-1       │  ← 現在 / 次セクション
│  ▮▮▮▮▮▮▮▯▯▯▯ (RMS meter)      │
│  ▆▅▄▆▇▅▃▂▁▁ (spectrum)         │
│  [intro] [verse-1] [chorus-1]... │  ← section nav (click で jump)
├─────────────────────────────────┤
│  layer toggles (mode 別)         │
│  📻 vocals · drums · bass · other │
│  🎛 drums · click · bass · g · v · c │
├─────────────────────────────────┤
│  [ lyrics — current section が   │  ← 自動スクロール + ハイライト
│    glow して、他は dim ]         │
├─────────────────────────────────┤
│  chord: G                        │
├─────────────────────────────────┤
│  ▾ sound mix                    │  ← 折り畳み (space / vocal blend / parts)
│  ▾ 🎙 external vocal             │
│  ▾ 🎵 vocal phrase trigger       │     即発火 / 次小節 / ループ
│  ▾ 🥁 drum kit source            │     (AI 再現時のみ)
│  ▾ 🎼 genre pattern picker       │     Hazama FM suggestion 対応
│  ▾ 🐢 practice tempo (50-120%)   │     (AI 再現時のみ)
├─────────────────────────────────┤
│  ← Hazama FM · Music Core · Drum Floor │
│  [space] play/stop · [[]] sec    │  ← keyboard hint
└─────────────────────────────────┘
```

版ごとの詳細は[BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md)、
操作の全体像は[BAND-ROOM-MANUAL.md](./BAND-ROOM-MANUAL.md)を参照。

## 通常入口とdeep-link

初回の通常入口はTabascoの01 `TABASCO`から始まります。以後のqueryなしreloadは
保存済みのvisible bandを復元し、そのbandの01へ戻ります。前回のsongやplayback modeは
復元せず、volume / mixer / kit等の操作prefsを保持します。

`?band=hazama`は保存済みbandより優先され、HAZAMAの01 `Still Moving`と
`📻 原音`を開きます。`song` / `mode` queryで01/02 × 原音/AIの4ケースへ直接入れます。
`mix=karaoke`を原音linkへ加えると、vocalsだけOFF・drums / bass / other ONで開きます。
このvocal-offはsession限定で保存されず、別bandへ移ると原音vocalへ戻ります。
Drum Floorからの明示的な戻りqueryも通常復元より優先されます。

曲末は同じ曲を loop せず、set list 順に次の track へ進みます。01 終了後は
02 `Hey`、以降 03, 04... と続き、最後の曲だけ停止します。A/B loop を明示した時は
その loop 指定を優先します。

ロック画面 / 車載側の next / previous track 信号も同じ set list 順に合わせています。
再生中に画面上の track button や車載の曲送りを使っても、hidden media bridge は
維持したまま曲を差し替えます。

START 下の分秒バーは普通の music bar です。停止中に任意地点へ動かすと、次の
START はその位置から始まります。再生中に動かすと原音 stems / external stems も
同じ offset へ seek します。

AI 再現モードでは、各パートが原曲 drum-frame を読む part agent として動きます。
bass は kick と ghost の位置にロックし、guitar は snare / crash / hat 密度で刻みを
変え、vocal guide と chords は section role と accent へ応答します。

現行default mixは少し余裕を持たせています。masterはlimiterに張り付き
にくく、stem vocal blend は控えめ、AI 再現は bass / guitar / chords が前に出すぎない
バランスです。旧 default が保存済みのブラウザも、完全一致する旧 slider 値だけ
新 default へ移行します。大きくしたい時は master volume を上げるのが一番安全です。

## Drum Floor へ渡す

footer の `Drum Floor` を押すと、現在の曲 / BPM / section / drum frame を
Music Stack の metadata-only packet として同じブラウザに保存してから
drum-floor を開きます。drum-floor 側は kit / pocket / controls の候補だけを
受け取り、音を出すには向こうで手動で `再生` を押します。

drum-floor から `Band Room` へ戻る場合は `song` query を受け取り、通常 reload
は 01 start のまま、その戻り操作だけ source song を開きます。

## Hazama FM から来た pattern

Hazama FM の `band room →` から開くと、FM の genre に近い Band Room pattern が
`FM suggests ...` として表示されます。`AI` で AI 再現モードへ切り替え、
`inject` で現在 frame に入れます。どちらも自動再生はしません。

## Lyric Labへ渡す

Band Roomから自動転送はしません。Listen hubへ戻って
[Lyric Lab](../lyric-lab.html)を開き、制作元をBand Roomとして、keep / fix、歌詞、
BPM / key / 尺、制作先を手動で入力します。`下書きを作る`後に棚へ保存するか、
ACE-Step等へ渡すproduction handoffを整理します。この操作だけで外部modelやGPU処理は
起動しません。

## 用途別の遊び方

### 1. カラオケ — 元バンドの演奏で自分が歌う

1. 📻 原音 stems モード
2. **vocals** stem toggle → OFF
3. drums / bass / other stem は全 ON
4. START → 自分の声で歌う
5. 必要なら space reverb 上げて部屋っぽく

### 2. AI 再現を聴く — 完全打ち込み

1. 🎛 AI 再現モード
2. drum-floor / bass / guitar / chord guide 全 ON
3. (オプション) 🥁 drum kit source で UNRIPE/Definition 等の本物 sample に差し替え
4. START → 全部合成で曲が走る

Human Fly のように vocal OFF で原音 stem の伴奏が欠ける曲は、
`docs/AI-RECREATION-EXPORT.md` の offline export で `drums/bass/other`
を mp3 stem 化し、`mix.wav` を `scripts/compare-capture.py` で測れます。
原音 stems モードの `stem source` から `AI recreation` として A/B できます。
これは原音復旧ではなく、Band Room の AI 再現を独立 stem として検証する
ルートです。

### 3. 厚み出し — 本物 + AI レイヤ

1. 📻 原音 stems モード (主役)
2. 🎛 AI 再現セクション (overlay): drum-floor OFF / guitar ON (合成 guitar 重ね)
3. 🥁 drum kit source = UNRIPE Continuous (元音源 drums の隣に本物 UNRIPE drums)
4. → 倍音増えて密度上がる

### 4. Final 歌詞を Suno に投げて生成

1. `docs/tabasco-lyrics-final.md` で歌う曲の英語歌詞を取得
2. https://suno.com/ で Custom Mode → prompt 貼って generate
3. mp3 ダウンロード → band-room の 🎙 external vocal で upload
4. 自動で stem vocal mute → external が鳴る
5. sound mix の vocal blend (spread / room) で更に加工

### 5. ad-lib / SFX で遊ぶ

1. 📻 原音 stems モード、START
2. 🎵 vocal phrase trigger に 01-20 の番号ボタン
3. クリックで自分の声フレーズが発火 (元音源から切り出した RMS 上位 20 個)
4. 元の歌の上に重ねて adlib / textural 使用

### 6. Hazama FM から groove 候補を受ける

1. Hazama FM で lofi / jazz / funk / techno などの genre pill を選ぶ
2. Band Room を開くと、対応する genre pattern button が suggestion 表示される
3. ボタンをタップすると現在 frame に pattern inject
4. `reset to original` で元 frame に戻せる

自動 inject はしません。現在 frame の drum events を置き換える操作なので、
必ず Band Room 側でタップしてから適用します。

## 車 / Bluetooth 音量

header 直下の master volume bar は常時表示です。車の物理音量ボタンが
Web Audio に届かない環境でも、画面上の `- / +` と slider で 0-100 を操作できます。
対応する車載機が rewind / fast-forward 系の Media Session 信号を送る場合は、
それも master volume の 5 刻み上下に割り当てます。
next / previous track 系の信号は album flow の曲送りに使います。

Band Room の最終 mix は hidden `<audio srcObject=MediaStream>` bridge にも流しており、
iOS Safari / 車載 Bluetooth で通常メディア音声として扱われやすくしています。
master volume bar は scroll 中も上に残ります。広めの画面では右側が `bridge` なら
hidden media bridge 経由、`direct` なら通常の Web Audio 出力、`failed` なら
bridge が落ちて direct 出力に復帰済みです。狭い車載/スマホ幅では、操作性優先で
route pill は `B` / `D` / `F` の短い badge に縮め、`- / slider / +` を必ず収めます。

## モード切替の意味

| モード | 主役 | overlay (薄く) | こんな時 |
|---|---|---|---|
| 📻 原音 stems | 本物の Tabasco LIVE 演奏 | 🎛 AI 再現を被せると倍音増 | 歌い直し練習、聴感 polish 確認 |
| 🎛 AI 再現 | drum-floor synth + bass + guitar | 📻 stems は薄く混ぜられる | 完全 AI で雰囲気再現、新曲合成 |

## drum kit source オプション

🎛 AI 再現モードで使う drum kit の音色:

- **AI synth (default)**: Tone.js の MembraneSynth (kick) + NoiseSynth (snare/hat) — 合成音、軽い
- **UNRIPE / Continuous (103 BPM)**: ダーク mid-tempo の本物 drums
- **UNRIPE / List of Words (103)**: 同上、別曲の音色
- **UNRIPE / Definition (144)**: 暗くて速い、agro 系
- **UNRIPE / Past and Fate (144)**: 同上、別タイトル
- **UNRIPE / End Falls (108)**: ミドルテンポ
- **UNRIPE / Erase (136)**: テクスチャ系

各曲の本物 drums から切り出した kick/snare/hat/crash サンプルを直接 trigger。

## vocal blend defaults

| use | spread | room |
|---|---|---|
| plain vocal | 0% | 10% |
| less dry | 20% | 24% |
| washed room | 36% | 44% |
| Suno blend | 18% | 24% |

## ファイル配置 (Music repo)

```
band-room.html / .css / .js
presets/
  bands.json                                   # band registry
  drum-frames-tabasco-{songid}.json            # 7 曲分 song-track JSON
  tabasco-stems/{songid}/{stem}.mp3            # 28 stem mp3 (Tabasco 4×7)
  unripe-stems/{songid}/{stem}.mp3             # 24 stem mp3 (UNRIPE 4×6)
  sample-kits/{source}/{song}/                  # 抽出した個別サンプル
    {kick,snare,hat,crash}-NN.wav              # drum hits (8 each)
    vocal-phrase-NN.wav                        # vocal phrases (top 20)
    summary.json                               # manifest
docs/
  tabasco-lyrics-final.md                      # 全 7 曲歌詞 (final singable)
  VOCAL-REGENERATION-PATH.md                   # Suno workflow
  BAND-ROOM-ADD-BAND.md                        # 新バンド追加手順
  BAND-ROOM-USAGE.md                           # この doc
  STEM-REUSE-PATH.md                           # Phase B/C 流用設計
scripts/
  _separate_band.py                            # Demucs 4-stem 切り出し
  _slice_drum_hits.py                          # drum sample 抽出
  _slice_vocal_phrases.py                      # vocal phrase 抽出
  _recompress_stems.py                         # 192→96 kbps 再エンコ
  _copy_stems.py                               # Demucs 出力を repo へコピー
```

## トラブルシューティング

### iPhone Safari で音が出ない
→ `WARMING UP` / `PREPARING AI`が終わるまで待ちます。START直下に音声停止の
   案内が出てボタンが`START`へ戻ったら、画面を一度tapして`START`を一度押します。
   直らなければ`RESET AUDIO`、次にreloadを試します。準備中の連打は不要です。

### 曲再生中に止まる / 遅れる
→ 初回のstems / online sample取得にはnetworkが必要です。取得後は対応assetがcacheされ、
   Wi-Fiだけが必須ではありません。HAZAMAの弱端末比較は
   `?band=hazama&aiLight=1`を使い、それでも止まる場合はBL-041の実機結果へ記録します。

### Suno 生成 mp3 を upload してもズレる
→ Suno の BPM/key は近似なので Tabasco 本来の構造と微妙にズレる。
   external vocal は単体で聴ける形で出してるので、stem drums/bass を OFF
   にして external vocal だけ流すか、自分で歌い直す方が綺麗。

### サンプルキットに切り替えると無音
→ 初回asset取得中は`sample kit: ...`表示まで待ちます。失敗案内が出た場合は
   通信を確認し、mode / song切替が終わってから`START`を押します。

### vocal phrase trigger が空
→ その曲の vocal stem から十分な phrases が検出できなかった (短すぎ等)。
   01 TABASCO は 44 秒の opener なので 0 個になる。他の曲は 20 個ある。
