# Band Room — 総合マニュアル (v102 時点)

> https://quietbriony.github.io/Music/band-room.html
>
> Tabasco LIVE リバイバル + 練習 / カバー / 録音 web app。
> ブラウザ単体で完結、install 不要、PWA 対応。
>
> このページ = **入り口**。詳細は各サブ doc にリンクで飛ぶ。

---

## まず触る

1. https://quietbriony.github.io/Music/band-room.html を開く
2. **`▶ START`** 押す → 1 曲目 (Human Fly) が原音 stems モードで鳴る
3. **`📻 原音`** / **`🎛 AI 再現`** を切り替えてモード比較
4. `📖 ?` ボタン (header 右上) で keyboard ショートカット一覧

ここまで 1 分で全体像つかめる。

---

## 画面構成 (v102)

```
┌─────────────────────────────────┐
│  BAND ROOM                 [?]   │  ← ヘッダ + help button
├─────────────────────────────────┤
│  [Tabasco]                       │  ← band 選択
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← Tabasco の 7 曲
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← mode pill
├─────────────────────────────────┤
│  [ START ]                       │  ← 再生
│  117 BPM · G major               │
│  verse-1 · 4/16 → chorus-1       │  ← セクションナビ
│  ▮▮▮▮▮▮▮▯▯▯▯ (RMS meter)      │
│  ▆▅▄▆▇▅▃▂▁▁ (spectrum 64-bin)  │
│  [intro] [verse-1] [chorus-1]... │  ← click=jump, shift-click=A/B loop
├─────────────────────────────────┤
│  layer toggles (mode 別)         │
│  📻 vocals · drums · bass · other │
│  🎛 drums · click · bass · g · v · c │
├─────────────────────────────────┤
│  [ lyrics — current section が    │  ← 自動スクロール + ハイライト
│    glow して、他は dim ]          │
├─────────────────────────────────┤
│  chord: G                        │
├─────────────────────────────────┤
│  ▾ 🎤 vocal FX                   │
│  ▾ 🎙 external vocal              │
│  ▾ 🥁🎸🎹 external stems          │
│  ▾ 🎵 vocal phrase trigger        │
│  ▾ 🥁 drum kit + synth profile    │   ← v91-v102 の中心
│  ▾ 🐢 practice tempo (50-120%)    │
│  ▾ 🎚 volume mixer                │
│  ▾ 🌌 mastering + master preset   │
│  ▾ 🔀 A/B compare                 │
│  ▾ 🎹 MIDI in/out                 │
│  ▾ ⏺ live record                  │
│  ▾ 📦 stems pack export           │
├─────────────────────────────────┤
│  別 app · 歌詞 · DAW 連携        │   ← footer リンク群
└─────────────────────────────────┘
```

---

## 主要機能の入口リンク

### モード切替

- **📻 原音 stems** — Demucs で分離した 4 stem (vocals/drums/bass/other) を再生
- **🎛 AI 再現** — Tone.js 合成器で打ち込み再現
- mode bar で 1 クリック切替。非アクティブモードの controls は完全に消える。

### 練習 / 再生

- `space` キー = play/stop
- `[` `]` = 前 / 次 section (audio + lyrics 同時 jump)
- `1..9` = section index に jump
- **section chip shift-click** = A→B loop 範囲設定 (= サビだけ無限ループ)
- `🐢 practice tempo` で 50-120% 倍速

### 自分のテイク差し替え

- **🎙 external vocal** = Suno / 自分歌い直しの mp3 を drag-drop
- **🥁🎸🎹 external stems** = drums / bass / other も同じ要領で差し替え
- 元 stem は自動 mute、master チェーンは自分のテイクにも掛かる
- 詳細: [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)

### 音色いじり

- **🥁 drum kit + synth profile** が一番遊べる
  - kit = local (auto-self / tabasco-X / unripe-X) または **🌐 online** (CDN 経由 9 種)
  - synth profile = default / sakanaction / lcd-motorik / cramps-punk (drum + bass + chord + vocal 全 voice を一斉切替)
  - **per-voice override** = kick だけ 808, snare だけ acoustic, hat だけ 909 みたいに 1 voice 単位で別 kit からピック
  - **chord instr** = synth or Salamander Grand Piano / Casio synth (Tone.Sampler 経由)
  - **+ custom kit URL** = 任意の wav URL を catalog に追加 (localStorage 永続)
  - **▶ preview** = kit / voice 単位で試聴
- **音源追加の手順** (search クエリ集 + license フローチャート + nbrosowsky の note 一覧取得法 + NSynth 追加チュートリアル):
  → [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md)

### マスタリング

- **🌌 mastering** = reverb / width / warmth / loudness の 4 slider
- **master preset chips** = neutral / lo-fi / club / rock / ambient で 1 クリック切替
- 内部: per-stem EQ + 2 段 master comp + StereoWidener + tape sat + reverb wet
- 詳細: [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md)

### 録音 / DAW 連携

- **⏺ live record** = post-limiter master mix を webm にして download
- **📦 stems pack export** = 4 stem を別々に同時録音 (DAW 投入用)
- **🎹 MIDI in/out** = ドラムマシン / DAW に MIDI Clock 送出 (24 PPQ)、外部 MIDI note 受信で phrase trigger / section nav
- 詳細: [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)

### A/B 比較

- 🔀 A/B compare = 全 sliders / toggles / mode / profile / preset を A, B にスナップショット → 瞬時切替
- 「Sakanaction vs LCD-motorik」「club vs lo-fi」「original vs all-external」等の比較

### 状態保存

- 全 slider, toggle, mode, kit, profile, voice overrides, chord instrument が **localStorage に自動保存** (v78 + v99 + v101)
- reload しても次回同じ状態から再開
- custom kits も別キー `band-room.custom-kits.v1` で保存

---

## キーボード一覧

| key                | action                                          |
|--------------------|-------------------------------------------------|
| `space`            | play / stop                                     |
| `[` / `]`          | previous / next section (audio + lyrics seek)   |
| `1`..`9`           | jump to section index (1-based)                 |
| `m`                | toggle stems ↔ AI 再現 mode                     |
| `?`                | open quick help overlay                         |
| `Escape`           | close overlay                                   |
| `q`..`p`, `a`..`l`, `;` | fire phrase trigger 01..20                 |
| **shift+click** on section chip | A→B loop range 設定                |

入力欄 (textbox/file/select) にフォーカスしてるときは無効。Ctrl/Cmd/Alt と
組み合わせは browser ショートカット優先。

---

## 歌詞

- **v2.1 proper English** — [tabasco-lyrics-draft.md](./tabasco-lyrics-draft.md)
- **v3 William Burroughs cut-up** — [tabasco-lyrics-burroughs.md](./tabasco-lyrics-burroughs.md)
- 同じメロディ / 同じ構造で歌詞だけ別、どっちでも歌える

歌詞 panel は section の bar 進行に合わせて自動でハイライト + scroll する
(v73)。歌わせたい行が大きく見える。

---

## バンド追加

Tabasco 以外のバンドを追加するなら別 doc:

- [BAND-ROOM-ADD-BAND.md](./BAND-ROOM-ADD-BAND.md)
- presets/bands.json + drum-frames + sample-kits 一式作成手順

---

## ボーカル再生成 (Suno など)

- [VOCAL-REGENERATION-PATH.md](./VOCAL-REGENERATION-PATH.md)
- 3 path (自分で歌う / Suno で生成 / 既存テイク upload)

---

## DAW / ハードウェア連携

- [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)
- Ableton / BandLab / Logic に stem 流す or 自分のテイク戻す
- ドラムマシン (133 等) に MIDI Clock 同期 or audio out を external slot に

---

## 履歴

- [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) — v65 → v102 全履歴
- 設計判断 / パラメータの数値 / 各機能の commit ハッシュもここに

---

## 関連 doc

| doc | 用途 |
|-----|------|
| [BAND-ROOM-USAGE.md](./BAND-ROOM-USAGE.md) | 5 つの典型用途 (カラオケ / AI 再現 / 厚み出し / Suno / ad-lib) |
| [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) | v65-v102 履歴、各 wave 詳細 |
| [BAND-ROOM-ADD-BAND.md](./BAND-ROOM-ADD-BAND.md) | 新バンド追加手順 |
| [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) | Ableton / BandLab / Logic / ハードウェア連携 |
| [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md) | 音色設計の哲学、synth profile 詳細 |
| [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md) | online catalog json の編集 / 拡張 |
| [VOCAL-REGENERATION-PATH.md](./VOCAL-REGENERATION-PATH.md) | ボーカル再生成の 3 path |
| [STEM-REUSE-PATH.md](./STEM-REUSE-PATH.md) | stem 抽出 / 再利用ワークフロー |
| [REPO-MANAGEMENT.md](./REPO-MANAGEMENT.md) | Pages 制限 / repo サイズ管理 |
| [HAZAMA-FM-ARCHITECTURE.md](./HAZAMA-FM-ARCHITECTURE.md) | Music スタック全体のアーキテクチャ |
| [tabasco-lyrics-draft.md](./tabasco-lyrics-draft.md) | 歌詞 v2.1 (proper English) |
| [tabasco-lyrics-burroughs.md](./tabasco-lyrics-burroughs.md) | 歌詞 v3 (Burroughs cut-up) |

---

## 別 app の入り口

- **Hazama FM** (`fm.html`) — 集中作業 BGM ジェネレーター
- **Music Core Rig** (`index.html`) — 同じ engine.js を共有する mixer / 環境音作り
- 両者は **隔離されたアプリ** (catalog / 操作モデル別)、band-room と素材レベルで
  橋渡し可 ([DAW-INTEGRATION.md](./DAW-INTEGRATION.md) 参照)
