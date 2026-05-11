# 📻 Hazama FM 使い方マニュアル

24/7 流しっぱなし対応の生成型フォーカス BGM。**START 一発で永遠に聴ける** 設計。

公開 URL: https://quietbriony.github.io/Music/fm.html

全体像: [Music Stack System Manual](MUSIC-STACK-SYSTEM-MANUAL.md)

---

## はじめに

### 何ができる？

- ボタン 1 個で**作業用 BGM が永遠に流れる**
- 9 つの番組 (fieldStudy / glassCoding / dryGridWork / ghostPressure / voidRoom / hardTechno / liveJazz / nightFunk / quietPiano) を AI が 60–90 秒ごとに rotate
- 7 つのジャンル pill で気分を切替 (ambient / techno / lofi / jazz / funk / piano / any)
- iPhone のロック画面に **Hazama FM** ロゴ + 現番組名が表示
- iPhone のホーム画面に**アプリ風アイコン**としてインストール可能
- 一度起動すれば**オフラインでも動く** (Service Worker キャッシュ)

### こんな時に使う

- 作業中 / 読書中 / 寝入りばなの BGM (ANY / piano)
- 集中したいけど無音だと不安な時 (ambient / lofi)
- 動きが欲しい時 (techno / funk)
- 移動中・カフェ・電車内 (オフラインでも音は出続ける)

---

## ホーム画面に追加する (推奨)

### iPhone (Safari)

1. Safari で https://quietbriony.github.io/Music/fm.html を開く
2. 下部の**共有ボタン** (□↑) をタップ
3. **「ホーム画面に追加」** を選択
4. 名前は「Hazama FM」のまま「追加」をタップ
5. ホーム画面に **ミントの同心円リング** アイコンが現れる
6. アイコンタップで Safari UI 無しのフルスクリーン起動

### Android (Chrome / Edge)

URL 欄の右側に「インストール」アイコンが出るのでタップ → ホーム画面に追加。

### PC (Chrome / Edge / Firefox)

URL 欄の右端のインストールアイコン or メニューから「アプリとしてインストール」。

---

## 基本操作

### START / STOP

画面中央の大きな丸ボタン:
- **START**: タップで再生開始。約 4 秒かけてフェードイン
- **STOP**: タップで停止。約 3 秒かけてフェードアウト

iPhone は **サイレントスイッチ off** + メディア音量を上げてください
(マナーモードでは音が出ません)。
Hazama FM は起動時にブラウザ側の OUTPUT を高めにフェードインします。
GenreFlavor 層も OUTPUT に追従しますが、専用 compressor / limiter を通すため、
音量を上げてもピークは潰しすぎない設計です。

### ENERGY ピル (3 段)

`LOW / MID / HIGH` の 3 つから選択:
- **LOW**: 静かめ。深い集中向け
- **MID** (default): バランス型
- **HIGH**: 動きあり。手を動かす作業に

ピル切替は engine 内部の ENERGY フェーダー値を 25 / 45 / 70 に変更します。

### GENRE ピル (7 段)

| pill | 雰囲気 | おすすめシーン |
|---|---|---|
| **ANY** | engine が自由揺らぎ | 飽きずに聴き続けたい時 (50 分アーク) |
| **AMBIENT** | namima の水・庭の空気感 | 朝、瞑想、寝る前 |
| **TECHNO** | 四つ打ち machine drum + acid + filtered lift | 作業の手を動かす時 |
| **LOFI** | dusty live break + vinyl crackle + jazz-hop chord dust | カフェで本を読む時 |
| **JAZZ** | live kit + ride/brush + walking bass + sparse comp | 夜、文章を書く時 |
| **FUNK** | live funk kit + rubber bass + clavi/EP pocket breaks | 元気を出したい時 |
| **PIANO** | dry felt-piano anchor + planing color reply + memory answer | 静かな深い集中 |

ピルをタップすると、DJ ミックスのように一度少し音量を沈めてから、
**約 2 秒のクロスフェード** で音色が切り替わります。
ANY 以外を選ぶと engine の AUTO MIX が一時 OFF になり、その質感が安定。
ANY に戻すと AUTO MIX 復帰。

`shuffle` を押すと、聴感テスト用に genre / energy をランダム選択します。
START 前に押すと初音から concrete genre で始まり、再生中は一定間隔で
別 genre へ DJ ミックス的に移ります。通常の長時間作業 BGM は
`shuffle` OFF か `ANY` が基準です。

### SYNC

`SYNC` は今の FM 文脈を保存します。音声は保存せず、genre / source / BPM /
listening_trace などの metadata だけを Music Stack packet に入れます。

---

## 画面で見えるもの

### 番組ラベル (中央)

```
fieldstudy — initial haze room
up next: glasscoding
```

- 上段: 現在の番組名 + その番組が選ばれた理由
- 下段: 次に rotate 予定の番組

番組は **60–90 秒で自動切替**。切替時に:
- マンダラ背景が一瞬明るく光る (1.5 秒)
- 番組ラベルがフェードアウト → 新番組へ

### Progress bar (極細ライン)

ラベル下の細いミントのライン。次の番組までの **進捗** が左→右に伸びます。
バーが満杯になると番組が切り替わる合図。

### Resume hint

`STOP` 後 30 分以内に再起動すると `resume from {前の番組}` と表示されます。
無視して START すれば普通に始まります。

---

## ロック画面・コントロールセンター

iPhone をロック中・コントロールセンター・bluetooth ヘッドフォン:
- **Hazama FM** の文字 + ミントアイコン + 現番組名 が表示される
- 物理 Play/Pause キーで START / STOP できる
- **次へ** / **戻る** で ENERGY を low → mid → high にサイクル

これを Media Session API と呼ぶ標準仕組みで実装。

---

## 細かく触りたい時 (full mixer)

画面下部の `full mixer →` リンクから **Music Core Rig** に遷移。
9 フェーダー全部を直接いじって音を作れます。
詳しくは [`USAGE-MUSIC-CORE-RIG.md`](USAGE-MUSIC-CORE-RIG.md) を参照.

---

## 追加機能 (v32 以降)

### 📲 install ボタン

Chrome / Edge / Android などで「インストール可能」と判定されたブラウザでは、
画面下に **`📲 install as app`** ボタンが出ます。タップで OS のインストール
ダイアログが開き、ホーム画面 / アプリ一覧にアプリ風アイコンとして追加。

iOS Safari はこのイベントを発火しないため、共有ボタン経由のホーム画面追加
を使ってください (上記)。

### 🌙 90 分後の自動フェードトゥスリープ

START から **90 分連続再生** すると、自動的に **30 分かけて output_level
を 100 → 25 まで降ろします** (寝落ち想定)。聴こえなくなるほどではなく、
気付かないほど静かに沈める設計。

途中で **ENERGY / GENRE pill をタップする** か **STOP する** と
即キャンセル。output 100 まで自動復帰。

### 📊 listening trace パネル

画面右下の **小さい 📊 ボタン** で、現在の再生状況の summary を表示:

```
status        playing
elapsed       12.4 min
bpm           96
genre         jazz  (mid)
source        drum-frames+walking-bass
shuffle       off
switch count  3

genre dwell (ms)
  jazz       8.2m   66.1%
  ambient    2.1m   16.9%
  any        2.1m   16.9%

recent transitions (last 3 of 3):
  any      → ambient  ( 125s) [profile.start]
  ambient  → jazz     (  67s) [manual]
  ...
```

2 秒ごとに自動更新。閉じるのは × ボタン or 再度 📊 タップ。
音には影響なし、デバッグ / 振り返り用。

### 🎨 ジャンル別 station ident 色

番組が rotate する瞬間 (60-90 秒ごと) に背景マンダラが一瞬光りますが、
**選択中ジャンルで色味が違います**:

| pill | tint |
|---|---|
| any | mint (default) |
| ambient | クールな水色 |
| techno | マゼンタ寄り |
| lofi | 暖かいダスト |
| jazz | ゴールド-グリーン |
| funk | パンチオレンジ |
| piano | ソフト青-mint |

「今のジャンルがどれか」が視覚的に即わかる。

### 📱 Android ロングプレス・URL ショートカット

Android で Hazama FM アプリアイコンを長押しすると、ジャンル直接起動の
メニューが出ます (PWA manifest shortcuts):

- 📻 Piano / Jazz / Lofi / Techno / Ambient

URL でも直接ジャンル指定可能:

```
https://quietbriony.github.io/Music/fm.html?g=jazz
```

`?g=<genre>` で起動時にそのジャンルが選択された状態に。
iOS Safari の長押しメニューは対応してないが、URL パラメータは効きます。

---

## トラブルシューティング

### 音が出ない (iPhone Safari)

- **サイレントスイッチ** を off に
- **メディア音量** (ボリュームボタン) を上げる
- それでもダメなら STOP → START を再度タップ
- **HOME 画面追加版** の方が安定する (Safari UI 経由より許可が緩い)

### 音が小さい

- Hazama FM を閉じて開き直し、最新版の `shuffle` UI が出ているか確認
- Chrome / iPhone のメディア音量を Apple Music と同じ位置にする
- それでも小さい場合は、ジャンルを `techno` / `piano` に切り替えて
  音量差ではなく genre source 自体が聴こえているか確認

### 画面ロック中に止まる

- iOS の制約で、Web Audio はバックグラウンド再生が完璧ではない
- **HOME 画面アプリ版** を使うと WakeLock が効きやすい
- Bluetooth ヘッドフォン接続中の方が継続率高い (Media Session 効果)

### ジャンルを変えたら音が消えた

- クロスフェード中 (1.5 秒) は一時的に静かになります
- それ以上経っても無音なら STOP → START

### iPhone のホーム画面アプリで起動したら昔の版が出てくる

- Service Worker のキャッシュが古い可能性があります
- まずアプリを閉じて、通常のブラウザタブで Hazama FM を 1 回開き直します
- そのあとアプリを再起動すると、最新版に切り替わります
- まだ古い場合だけ、アプリを長押し → 削除 → 再追加で cache を完全に捨てます

### 「engine unavailable」と表示

- ネット接続を確認
- ブラウザを別タブで開き直す
- それでも続くなら https://quietbriony.github.io/Music/ (mixer) で動くか確認 → engine.js の問題か通信問題か切り分け

---

## デバッグ (開発者向け)

ブラウザ DevTools のコンソールで:

```js
// 現在の番組
window.MusicRuntimeState.radioBrain.active

// 次に来る番組
window.MusicRuntimeState.radioBrain.next

// 各番組の重み (どの程度 rotate に選ばれやすいか)
window.MusicRuntimeState.radioBrain.weights

// flavor 層の動作確認
window.GenreFlavor.state
// → { started: true, genre: "piano", scheduled: 5, source: "chill-recipe:piano-jazz-chill+foreground-piano+planing-reply", outputLevel: 96, masterLevel: 1.242, role: "chill quiet piano memory", ... }

// SYNC で他repoへ渡る metadata-only のFM文脈
window.MusicSessionPacket.build().performance_state.hazama_fm

// preset がちゃんとロードされたか
window.HazamaPresets.available("chill-piano-recipe")
window.HazamaPresets.get("drum-frames-jazz")
```

`source` 欄が `default` の時はハンドコード synth、`chill-recipe:*` /
`drum-frames` / `namima-preset:*` の時は preset 駆動です。
`role` / `edge` / `feedback` は、SYNC で Music stack 側へ渡すための
metadata-only な聴感メモです。音源や録音を自動共有するものではありません。
`performance_state.hazama_fm.engine_translation` は FM pill に合わせた Music 本体
側の bus mix 抑制メモで、`piano` / `techno` では本体の pad / glass / memory 系を
下げて flavor layer を主役にします。
