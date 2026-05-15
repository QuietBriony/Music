# Band Room — 使い方ガイド

> air rock connect box (Tabasco) リバイバル + AI 再現の練習/jam web app。
> https://quietbriony.github.io/Music/band-room.html
>
> 2 つのモードを切り替えながら、本物の音源と AI 合成を A/B したり、混ぜたり、
> 自分で歌い直したり、Suno で生成した声を upload したりできる。

## 画面構成 (v160 — コア + 折り畳み詳細)

```
┌─────────────────────────────────┐
│  BAND ROOM                       │
├─────────────────────────────────┤
│  [-] master volume [====] 80 [+] │  ← 車 / touch 向け常時音量
├─────────────────────────────────┤
│  [Tabasco]                       │  ← band 選択
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← song 選択 (7 曲)
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← mode pill
├─────────────────────────────────┤
│  [ START ]                       │  ← 再生
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
│  ▾ 🎤 vocal FX                   │  ← 折り畳み (詳細)
│  ▾ 🎙 external vocal             │
│  ▾ 🎵 vocal phrase trigger       │     即発火 / 次小節 / ループ
│  ▾ 🥁 drum kit source            │     (AI 再現時のみ)
│  ▾ 🎼 genre pattern picker       │     Hazama FM suggestion 対応
│  ▾ 🐢 practice tempo (50-120%)   │     (AI 再現時のみ)
│  ▾ 🎚 volume mixer               │     mode 別
│  ▾ 🌌 mastering                  │     reverb/width/warmth/loudness
├─────────────────────────────────┤
│  ← Hazama FM · Music Core · Drum Floor │
│  [space] play/stop · [[]] sec    │  ← keyboard hint
└─────────────────────────────────┘
```

詳細は [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) (v65-v79 履歴 + キーボード一覧)。

## 最初の再生

reload 後は必ず Tabasco の 01 `TABASCO` から始まります。前回開いていた song は
復元せず、band / volume / mixer などの操作 prefs だけ保持します。

曲末は同じ曲を loop せず、set list 順に次の track へ進みます。01 終了後は
02 `Hey`、以降 03, 04... と続き、最後の曲だけ停止します。A/B loop を明示した時は
その loop 指定を優先します。

ロック画面 / 車載側の next / previous track 信号も同じ set list 順に合わせています。
再生中に画面上の track button や車載の曲送りを使っても、hidden media bridge は
維持したまま曲を差し替えます。

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

## 5 つの典型用途

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

### 3. 厚み出し — 本物 + AI レイヤ

1. 📻 原音 stems モード (主役)
2. 🎛 AI 再現セクション (overlay): drum-floor OFF / guitar ON (合成 guitar 重ね)
3. 🥁 drum kit source = UNRIPE Continuous (元音源 drums の隣に本物 UNRIPE drums)
4. → 倍音増えて密度上がる

### 4. 歌詞 v2 を Suno に投げて生成

1. `docs/tabasco-lyrics-draft.md` で歌う曲の英語歌詞 + style prompt 取得
2. https://suno.com/ で Custom Mode → prompt 貼って generate
3. mp3 ダウンロード → band-room の 🎙 external vocal で upload
4. 自動で stem vocal mute → external が鳴る
5. vocal FX (chorus / echo / reverb) で更に加工

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

## vocal FX 推奨設定

| 用途 | chorus | echo | reverb |
|---|---|---|---|
| 自分の歌をそのまま | 0% | 0% | 10% |
| 直っぽさを消す | 25% | 15% | 30% |
| お風呂気味 | 40% | 30% | 50% |
| Suno 生成を Tabasco に馴染ませる | 20% | 10% | 25% |

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
  tabasco-lyrics-draft.md                      # 全 7 曲歌詞 (v2.1 proper English)
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
→ START 押した直後の audioContext 起動許可を tap で与える必要あり。
   何回かボタン押し直すか、ホーム画面に PWA 化したアイコンから起動。

### 曲再生中に止まる / 遅れる
→ 4 stems 同時 buffer load が重い。`Tone.Loaded()` 待ちで対処してるが、
   モバイルで通信遅いと厳しい。WiFi 必須。

### Suno 生成 mp3 を upload してもズレる
→ Suno の BPM/key は近似なので Tabasco 本来の構造と微妙にズレる。
   external vocal は単体で聴ける形で出してるので、stem drums/bass を OFF
   にして external vocal だけ流すか、自分で歌い直す方が綺麗。

### サンプルキットに切り替えると無音
→ 初回 Tone.loaded() の最中。"sample kit: ..." 表示まで待つ。

### vocal phrase trigger が空
→ その曲の vocal stem から十分な phrases が検出できなかった (短すぎ等)。
   01 TABASCO は 44 秒の opener なので 0 個になる。他の曲は 20 個ある。
