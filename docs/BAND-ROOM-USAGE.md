# Band Room — 使い方ガイド

> air rock connect box (Tabasco) リバイバル + AI 再現の練習/jam web app。
> https://quietbriony.github.io/Music/band-room.html
>
> 2 つのモードを切り替えながら、本物の音源と AI 合成を A/B したり、混ぜたり、
> 自分で歌い直したり、Suno で生成した声を upload したりできる。

## 画面構成 (上から)

```
┌─────────────────────────────────┐
│  BAND ROOM                       │  ← ヘッダ
│  air rock connect box · ...      │
├─────────────────────────────────┤
│  [Tabasco] [UNRIPE (--)]         │  ← バンド選択 (UNRIPE は素材源で非表示)
├─────────────────────────────────┤
│  [01 TABASCO] [02 Hey] [03 ...]  │  ← トラック選択
├─────────────────────────────────┤
│  [ START ]                       │  ← 再生ボタン
│  117 BPM · G major               │
├─────────────────────────────────┤
│  now: chorus-1 · 4 / 16 bars     │  ← セクション/小節カウンタ
│  next: verse-2                   │
├─────────────────────────────────┤
│  モード:                         │
│    📻 原音 stems                 │  ← どっちか選ぶ
│    🎛 AI 再現                    │
├─────────────────────────────────┤
│  [stems toggles + vol]           │  ← 原音モード時に効く
│  [vocal phrase trigger]          │
│  [external vocal upload]         │
│  [vocal FX (chorus/echo/reverb)] │
├─────────────────────────────────┤
│  [synth toggles + vol]           │  ← AI モード時に効く
│  [drum kit source select]        │
├─────────────────────────────────┤
│  [space (reverb / width)]        │  ← マスター効果 (両モード共通)
├─────────────────────────────────┤
│  [chord display: G]              │  ← 現在のコード
├─────────────────────────────────┤
│  [lyrics panel]                  │  ← 歌詞 (docs/tabasco-lyrics-draft.md)
└─────────────────────────────────┘
```

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
