# 🎚️ Music Core Rig 使い方マニュアル

9 フェーダー直接操作の **生成型音楽 mixer**。リアルタイムに音色を作りながら聴く・録る用。

公開 URL: https://quietbriony.github.io/Music/

全体像: [Music Stack System Manual](MUSIC-STACK-SYSTEM-MANUAL.md)
3 app 整合: [CROSS-APP-INTEGRITY.md](./CROSS-APP-INTEGRITY.md)

> **v113-v115 アップデート**: 共有エンジン `engine.js` の lofi mode が
> Salamander Grand Piano + tone-breakbeat の **完全 piano trio + breakbeat**
> 構成になりました (Hazama FM と同じ整合)。energy slider を 34-67 帯に置けば
> lofi mode に入り、本物のピアノ chord + walking bass + boom-bap drum が鳴ります。
>
> REC ボタンで wav export → Band Room の **🥁🎸🎹 external stems slot** に
> drag-drop で素材橋。lofi mode の録音は Nujabes 寄り素材として Band Room
> の Tabasco に重ねられる。

---

## はじめに

### Hazama FM との違い

| | Hazama FM | Music Core Rig |
|---|---|---|
| 用途 | 流しっぱなし作業 BGM | 音作り・特定の質感探し |
| 操作量 | START 1 タップで完結 | 9 フェーダー + AUTO MIX + CULTURE 等で詳細制御 |
| UI | 単純 (pill 7 個) | 全コントロール可視 |
| 録音 | 不可 | REC ボタンで WAV ダウンロード可 |

両方とも **engine は同じ** (engine.js)。違いは UI の見せ方だけ。

### こんな時に使う

- Hazama FM で流れてる音の「中身」を見たい時
- 自分で音を作り込みたい時
- 録音したい時 (engine 出力を WAV で保存)
- マイクで歌って engine に追従させたい時 (MIC follow)

---

## ホーム画面に追加する

### iPhone (Safari)

1. https://quietbriony.github.io/Music/ を Safari で開く
2. 共有ボタン → **「ホーム画面に追加」**
3. 名前は「Music Core Rig」のまま「追加」
4. ホーム画面に **オレンジ色の 9-fader 放射状アイコン** が現れる

### PC

URL 欄のインストールアイコンから「アプリとしてインストール」。

両方追加すれば、ホームに **📻 Hazama FM (ミント)** と **🎚️ Music Core Rig (オレンジ)** が並ぶ。

---

## 画面の構造

```
┌───────────────────────────────────────────┐
│ MUSIC CORE RIG     Mode: LOFI/TAPE/IDM    │
│                    BPM 90  OUT 75  SYNC   │
│ AIR / GLASS / GRIT / FRACTURE             │
│                              📻 HAZAMA FM →│
├───────────────────────────────────────────┤
│ ENERGY    観 8 fader            AUTO MIX  │
│ (静⇄動)  上段4 + 下段4         (右側 panel)│
├───────────────────────────────────────────┤
│        DRIFT  REPEAT  PUNCH  VOID         │
│        AIR / SRC                          │
│        REC  MIC  SYNC                     │
│        START  STOP                        │
└───────────────────────────────────────────┘
```

---

## 9 フェーダーの意味

engine がこれら 9 つの値を読んで音色を組み立てます。
中央 50 が neutral、端に振るほど性格が強く出る。

### ENERGY (静⇄動) ★主軸

- **静側**: 音数少ない、ゆっくり、空間多め
- **動側**: 音数多い、速い、密度高い

迷ったらまず ENERGY だけ動かす。

### 観 8 (左上 4 + 左下 4)

| fader | 静側 (低) | 動側 (高) | 効くもの |
|---|---|---|---|
| **WAVE** (波観) | Soft | Wild | 波形の形・ノイズの量 |
| **THOUGHT** (思観) | Simple | Complex | 旋律の組み立て密度 |
| **CREATION** (創観) | Plain | Crazy | 即興・実験度 (ハイは破綻寄り) |
| **VOID** (Void) | Empty | Full | 空間と密度のバランス。逆方向: ハイで空間多め |
| **CIRCLE** (円観) | Edge | Smooth | 角の取り方、トーンの丸さ |
| **BODY** (体観) | Light | Heavy | 低域の重み、ベース感 |
| **VALUE** (財観) | Sparse | Dense | テクスチャの粒子密度 |
| **OBSERVER** (観察者) | Near | Far | 距離感、リバーブ感、ステージ深さ |

組み合わせの感触:
- **静 + WAVE Soft + VOID 高 + OBSERVER Far** → アンビエント
- **動 + WAVE Wild + BODY Heavy + CIRCLE Edge** → ハードテクノ寄り
- **中庸 + THOUGHT 高 + CREATION 高 + WAVE 中** → IDM / 実験
- **静 + THOUGHT 低 + OBSERVER Far + CIRCLE Smooth + BODY Light** → ピアノ部屋

---

## AUTO MIX パネル (右側)

9 フェーダーを engine が自動で揺らすモード。
**自分で動かすか、engine に任せるか**を切替。

### 観サイクル (1–10 min)

シーン (haze / stir / tangle / body / open) を巡回する周期。
3 分推奨。短いほど目まぐるしく、長いほどじっくり進む。

### ARC

- **LIVE**: シーンサイクルだけ。50 分アークなし。
- **ARC.36**: 50 分超のロングアーク (submerge → sprout → ferment → exhale 等)。
  長時間流したい時。

### CULT (Culture grammar)

7 つのカルチャーから音色の文法を選択:

| 表記 | 値 | 雰囲気 |
|---|---|---|
| AUTO | auto | engine が自動選択 |
| HAZE | ambient_room | もやっとしたアンビエント部屋 |
| TAPE | tape_memory | カセット記憶風 lofi |
| BROKEN | broken_machine | グリッチ・壊れた機械 |
| GHOST | ghost_dub | ダブ・幽玄 |
| ACID | acid_core | アシッド・テクノ |
| CHROME | chrome_hymn | クローム・金属シマー |
| EARTH | earth_reed | 自然・有機・生音感 |

### IDEA (Odd Logic)

engine に「異論」を投げる仕組み。AUTO で自動投入、ASK ボタンで手動投入。
**WANT.GLASS** などのラベルが出ます (engine が今欲しがってる方向)。

### OUTPUT (出力レベル)

マスター音量 (0–100)。50 で gain ~0.96、80 で ~1.65、100 で ~2.32。
90 以上は engine の limiter に当たりやすいので、音割れや pumping が出たら少し下げます。

### AUDIO (System / BT)

出力デバイス選択。Bluetooth ヘッドフォン繋ぐと出てくるはず。

### BG (Background) / KEEP / ACID

- **KEEP**: WakeLock を立ててバックグラウンド再生を維持
- **ACID**: ACID culture を強制ロック (CULT に依らず acid テイスト)

---

## Performance pad (4 個)

一瞬だけ engine に「演出」を注入するボタン。

| pad | 効果 |
|---|---|
| **DRIFT** (源流) | 旋律を漂流させる、ゆっくりずらす |
| **REPEAT** (反復) | モチーフを刻む、繰り返し強調 |
| **PUNCH** (打撃) | 強い 1 撃 (kick / body 系) |
| **VOID** (空白) | 一瞬の空白を入れる |

押した瞬間 0.5–1 秒で発動して消える。気持ちのアクセントに。

---

## REC / MIC / SYNC

### REC (録音)

START 中に REC を押すと engine 出力を **WAV で録音開始**。
もう一度押すと停止 + ダウンロードリンクが出る。

### MIC (Mic Follow)

マイク入力を engine に追従させる。歌うとそのピッチに engine が反応。
※ 録音はしない、解析のみ。

### SYNC

sister repo (chill / drum-floor / namima) に**現在状態を packet 送信**する仕組み。
chill の Quiet Piano Trio session 等が SYNC を受けて自分側のステイトを合わせる。

---

## START / STOP

下端の START / STOP ボタンで engine を起動/停止。
クリックすると Tone.js の AudioContext が立ち上がり、engine.js が
Tone.Transport を回し始める。

---

## 観察パネル (上部 ヘッダー)

### Mode 表示

`LOFI / TAPE / IDM DRIFT / dust memory` のような複合表記。
今 engine が出してる音の **タグセット**:
- 1 番目: ジャンル軸 (LOFI / IDM / TECHNO 等)
- 2 番目: culture (TAPE / HAZE 等)
- 3 番目: 副ジャンル
- 4 番目: micro mode (dust / haze / scar 等)

### BPM

現在のテンポ。engine が自動調整 (60–150 BPM 帯)。

### OUT

OUTPUT fader の現在値。

### SYNC

`LIVE` / `ARC` / `LOCK` 等。SYNC packet 送信状況。

---

## 使い方の例

### 例 1: 1 時間集中作業

1. AUTO MIX `ON` + 観サイクル 5 min + ARC `ARC.36` + CULT `AUTO` + IDEA `AUTO`
2. ENERGY 30 (静寄り)、VOID 70 (空間多め)
3. START

放置で 50 分アーク全体を経験できる。

### 例 2: 特定のテクノ感を探す

1. AUTO MIX `OFF` (自分で動かす)
2. CULT `ACID` 固定、IDEA `OFF`
3. ENERGY 80、BODY 80、CIRCLE 30 (Edge 寄り)、VOID 10
4. START → 細かく fader 動かして調整
5. 気に入ったら REC で録音

### 例 3: 歌に合わせて伴奏 (MIC follow)

1. CULT `EARTH` (生音感)、CREATION 60、THOUGHT 60
2. MIC ボタン ON (マイク許可)
3. START → 歌うと engine が応答してくる

---

## トラブルシューティング

### 音が出ない (PC / iPhone 共通)

- まず AUDIO デバイス選択を確認
- OUTPUT fader が 0 になってないか
- iPhone はサイレントスイッチ off + メディア音量を上げる

### CPU 負荷が高い (古い PC / iPhone)

- VALUE / THOUGHT を下げる (粒子・旋律密度を抑制)
- IDEA を OFF にする
- 観サイクルを長く (10 min) して切替頻度を下げる

### 録音した WAV が真っ黒 (無音)

- OUTPUT fader が 0 だった可能性
- START 押した後 REC ON が正しい順序

### Hazama FM と並べて使うとき

- 同時起動はできない (Tone.js AudioContext は 1 個)
- Hazama FM 起動中に Music Core Rig 開くと、後から開いた方が動く
- 切替時は片方の STOP を必ず押してから

---

## デバッグ (開発者向け)

```js
// 9 fader の現在値
window.MusicRuntimeState.faders   // 存在しない場合は下記で個別取得
[
  document.getElementById("fader_energy").value,
  document.getElementById("fader_wave").value,
  // ...
]

// 現在の AUTO MIX 状態
window.MusicRuntimeState.albumArc   // ARC 状態
window.MusicRuntimeState.culture    // CULTURE 状態
window.MusicRuntimeState.proposal   // IDEA / Odd Logic 状態

// 番組ローテ (Hazama FM と共通)
window.MusicRuntimeState.radioBrain.active
```

---

## さらに詳しく

- [HAZAMA-FM-ARCHITECTURE.md](HAZAMA-FM-ARCHITECTURE.md) — システム全体像
- [music-radio-brain.md](music-radio-brain.md) — engine.js の番組ロジック
- [music-orchestra-protocol.md](music-orchestra-protocol.md) — SYNC packet 仕様
- [reference-driven-generative-rig.md](reference-driven-generative-rig.md) — engine 設計思想
