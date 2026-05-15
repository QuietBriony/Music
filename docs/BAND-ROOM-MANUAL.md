# Band Room — 総合マニュアル (v168 時点)

> https://quietbriony.github.io/Music/band-room.html
>
> Tabasco LIVE リバイバル + 練習 / カバー / 録音 web app。
> ブラウザ単体で完結、install 不要、PWA 対応。
>
> このページ = **入り口**。詳細は各サブ doc にリンクで飛ぶ。

---

## 🟢 現在地 (v168、最適度: ほぼ完成)

### 機能側 (磨き完了 / 残り 5% 未満)

- **音色**: 全 voice (drum / bass / chord / guitar / vocal) が CDN sampler 経由で実音色を選べる
- **整合性**: 3 app (Band Room / Hazama FM / Music Core Rig) で lofi / jazz / ambient / dub が同じ catalog 経由の実 sample stack
- **UX**: keyboard shortcuts / A/B compare / preview / persistence / drag-drop / mobile safety net (iOS 14 警告 + tap unlock retry + on-screen error)
- **連携**: MediaRecorder live record / 4-stem pack export / WebMIDI / external upload per stem
- **車載/BT**: sticky master volume bar + Media Session volume fallback + hidden audio bridge + `direct` / `bridge` / `failed` route status + lock-screen track skip
- **album flow**: reload 後は 01 `TABASCO` から開始し、曲末は同じ曲を loop せず 02 以降へ自動で進む
- **timeline**: START 下に `m:ss` の elapsed / duration と seek bar を表示。停止中に任意地点へ動かし、その位置から START できる
- **AI part agents**: AI 再現の bass / guitar / vocal guide / chords が、原曲 drum-frame の kick / snare / ghost / hat / section role から自律的に pattern を組み、bass/guitar は electric sampler を初期音色にする
- **出音**: v168 で master headroom / stem EQ / vocal FX / AI bus balance を整理し、旧 localStorage default も新 mix へ移行。default は派手すぎず、長く聴ける glue と前後感を優先
- **drum-floor 連携**: footer の `Drum Floor preview` から、現曲 / BPM / section / drum frame を metadata-only SYNC で渡して手動 preview。戻り `song` query は source song だけ復元
- **歌詞**: 候補を `tabasco-lyrics-final.md` の 1 本に統合。Band Room 本体も final singable だけ表示し、cache-busted fetch でも offline precache に戻れる
- **mastering**: per-stem EQ + 2-stage comp + StereoWidener + tape sat + reverb、master preset (lo-fi / club / rock / ambient) で 7 軸 linked 切替
- **genre pattern**: boom-bap / four-on-floor / jazz-brush / dnb / breakbeat / trap / soul-funk などを 1 click inject。Hazama FM の genre selection から suggestion 表示
- **FM 往復**: Hazama FM の `band room →` は query で pattern suggestion を渡し、Band Room の Hazama FM link は近い genre query へ戻る
- **歌詞 sync**: section transition で自動ハイライト + smooth scroll
- **integrity docs**: 全 doc が CROSS-APP-INTEGRITY hub から辿れる、5 doc 全部 v115 整合済

### 残り (🟢 現スコープ内、優先度順)

- multi-velocity sampler (Salamander v3 forte/mezzo/piano 3 layer) — 中規模、ROI 高い
- AI 生成パターン (Magenta.js DrumsRNN を auto-fill に統合) — 中-大規模
- Music Core Rig UI で catalog 選択露出 — 中規模
- final 歌詞を実際に歌い、息継ぎ / syllable が重い箇所だけ耳で微修正する — ユーザータスク

### 作品側 (これから動くフェーズ)

このタイミングで **「磨き → 作品制作」へ転換**するのが推奨。
[PRODUCTION-PATH.md](./PRODUCTION-PATH.md) の 3 path から選ぶ:

- **A) Tabasco album 制作** (~3 ヶ月) — 歌い直し or Suno で 7 曲、SoundCloud / Bandcamp
- **B) Hazama FM lofi 30 min set** (月 1 ペース) — REC ボタン放置 → SoundCloud
- **C) Music Core Rig × Tabasco ハイブリッド** — 同曲を 5 バージョン展開

具体手順:
- [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) — AI 歌唱で album 化 ($10/mo の Pro plan)
- [RECORDING-WORKFLOW.md](./RECORDING-WORKFLOW.md) — UR44 + マイク / bass / 電子ドラム / EP-133 で自分で録る
- [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) — 配信 platform 比較 / 月次 schedule

### 「最適」の限界

現状を超える磨きには **scope 拡張** が必要:
- 🟡 WAM 2.0 host (Surge XT 等の native plugin をブラウザで動かす)
- 🟡 Magenta MusicTransformer (full song AI 生成)
- 🔴 Electron + Ableton Link (DAW と LAN sync)
- 🔴 サーバ側 MusicGen / WebRTC jam (音楽 web app → 音楽サービス)

実装規模が 5-10 倍になる別 domain。今は **scope 内では十分最適**、これ以上は
**作品で出した方が ROI 高い** フェーズ。

---

## まず触る

1. https://quietbriony.github.io/Music/band-room.html を開く
2. **`START`** 押す → 1 曲目 (TABASCO) が原音 stems モードで鳴る
3. 分秒バーを動かす → 任意地点に seek。STOP 後もその位置から START できる
4. 曲が終わると同じ曲に戻らず、02 `Hey` へそのまま進む
5. **`📻 原音`** / **`🎛 AI 再現`** を切り替えてモード比較
6. `📖 ?` ボタン (header 右上) で keyboard ショートカット一覧

ここまで 1 分で全体像つかめる。

---

## 画面構成 (v168)

```
┌─────────────────────────────────┐
│  BAND ROOM                 [?]   │  ← ヘッダ + help button
├─────────────────────────────────┤
│  [-] master volume [====] 80 [bridge] [+] │  ← sticky 車 / touch 向け常時音量 (狭幅は route 非表示)
├─────────────────────────────────┤
│  [Tabasco]                       │  ← band 選択
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← Tabasco の 7 曲
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← mode pill
├─────────────────────────────────┤
│  [ START ]                       │  ← 再生
│  0:00 ━━━━━━━━━━━━━ 5:04          │  ← song timeline / seek
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
│  別 app · Drum Floor · 歌詞 · DAW │   ← footer リンク群
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
- reload 後の曲は 01 `TABASCO` から開始。音量 / mixer / kit などの操作 prefs は復元。Drum Floor から戻った時だけ `song` query を優先
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

- **final singable** — [tabasco-lyrics-final.md](./tabasco-lyrics-final.md)
- Band Room 本体はこの 1 本だけ表示する。旧 draft / cut-up / syllabic は archive 扱い。

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

- [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) — v65 → v172 compact 履歴
- 設計判断 / パラメータの数値 / 各機能の commit ハッシュもここに

---

## 関連 doc

| doc | 用途 |
|-----|------|
| [BAND-ROOM-USAGE.md](./BAND-ROOM-USAGE.md) | 5 つの典型用途 (カラオケ / AI 再現 / 厚み出し / Suno / ad-lib) |
| [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) | v65-v172 compact 履歴、各 wave 詳細 |
| [BAND-ROOM-ADD-BAND.md](./BAND-ROOM-ADD-BAND.md) | 新バンド追加手順 |
| [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) | **「作品」として世に出す道筋** (album 制作 / 30 min lofi set / 配信 platform 比較) |
| [RECORDING-WORKFLOW.md](./RECORDING-WORKFLOW.md) | UR44 + マイク / bass / 電子ドラム / EP-133 経由で band-room の external slot に流す具体手順 |
| [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) | Ableton / BandLab / Logic / ハードウェア連携 |
| [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md) | 音色設計の哲学、synth profile 詳細 |
| [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md) | online catalog json の編集 / 拡張 |
| [VOCAL-REGENERATION-PATH.md](./VOCAL-REGENERATION-PATH.md) | ボーカル再生成の 3 path |
| [STEM-REUSE-PATH.md](./STEM-REUSE-PATH.md) | stem 抽出 / 再利用ワークフロー |
| [REPO-MANAGEMENT.md](./REPO-MANAGEMENT.md) | Pages 制限 / repo サイズ管理 |
| [HAZAMA-FM-ARCHITECTURE.md](./HAZAMA-FM-ARCHITECTURE.md) | Music スタック全体のアーキテクチャ |
| [tabasco-lyrics-final.md](./tabasco-lyrics-final.md) | Band Room 表示用の一本化済み歌詞 |
| [tabasco-lyrics-draft.md](./tabasco-lyrics-draft.md) / [tabasco-lyrics-burroughs.md](./tabasco-lyrics-burroughs.md) / [tabasco-lyrics-v4-syllabic.md](./tabasco-lyrics-v4-syllabic.md) | 旧候補 archive |
| [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) | Suno で AI 歌唱生成する手順 (プラン比較 / Cover Mode / Persona / Voice Clone) |

---

## 別 app の入り口

- **Hazama FM** (`fm.html`) — 集中作業 BGM ジェネレーター
- **Music Core Rig** (`index.html`) — 同じ engine.js を共有する mixer / 環境音作り
- **Drum Floor** (`https://quietbriony.github.io/drum-floor/`) — 現曲 / BPM / section / frame を metadata-only で受ける手動ドラム preview
- これらは **隔離されたアプリ** (catalog / 操作モデル別)、band-room と素材レベルで
  橋渡し可 ([DAW-INTEGRATION.md](./DAW-INTEGRATION.md) 参照)
