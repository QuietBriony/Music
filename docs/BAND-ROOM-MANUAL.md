# Band Room — 総合マニュアル（現行 playability）

> 通常入口: https://quietbriony.github.io/Music/band-room.html
> HAZAMA直接入口: https://quietbriony.github.io/Music/band-room.html?band=hazama
>
> Tabasco LIVEの原音 / AI再現と、HAZAMAの原音 stems / AI再現をブラウザで遊ぶ
> 練習・比較・録音web app。install不要、PWA対応。
>
> このページの「最短導線」がSTART復旧を含む操作の正本。
> カラオケ・録音・Suno等の用途別レシピは
> [BAND-ROOM-USAGE.md](./BAND-ROOM-USAGE.md) を使う。

---

## 現在地とversion

- 現行playability契約は **v401**。client markerは
  `band-room.js?v=br-236` / `band-room.css?v=br-90`。
- この文書を既存PWAへ届けるdocs cacheは **hazama-fm-v402**（Listen・総合ガイド更新、音声runtime不変）。v401はHAZAMA AIの
  arp + basslineのauthored基準配置をactive sectionあたり20–21発へ整理し、明示休符と
  約96–101 msのnote gateを入れた再試聴候補。実演時のbass ghost/dropは基準から発音を
  減らすだけ。v400の02 AI暫定表示、session-only KARAOKE導線、
  曲別歌詞一致も含む。原音stem、`engine.js`、model weightは変更していない。
- Tabascoの曲順 / title / catalog durationは`presets/bands.json`、BPM / key / 構成は
  7曲のdrum-frame、canonical / fallback歌詞はfinal文書が正本。原音karaokeでは任意の
  timed lyricsを重ねる。`tabasco-songs.json`は保守用の派生一覧で、
  再生runtimeやoffline起動には使わない。
- TabascoもHAZAMAも `📻 原音` と `🎛 AI 再現` を切替可能。HAZAMAの原音は
  01 メロウ / 02 Hard完成レンダーのDemucs 4-stem（各約33.0 MiB）で、
  deep-link時は `📻 原音` を自動選択する。02のAI再現は01 authored framesデータ共有の暫定版で、
  曲ID seedによる微細な実演差はある。
  02固有の基準は原音。v390〜v396は
  **synth-only / AI再現専用**（`🎛 AI 再現`を自動選択・原音disabled）だった。
- HAZAMAはまだmain band selectorでは `ui_hidden`。v400時点のSurface試聴ではSTART、
  ピーポーなし、途切れなし、画面ロック解除後の復帰、Tabasco復帰は前進したが、
  AIの短音過密は音質×。v401はその再試聴候補で、Surfaceとreal mobileの実音確認後に判定する。
  real mobileの安定性確認と
  公開昇格は **BL-041 human gate**、車載 / Bluetoothの実機確認は
  **BL-003 human gate**であり、この文書更新では合格扱いにしない。
- 詳細な版履歴は [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md)、
  未完了タスクの正本は [autonomy/BACKLOG.md](./autonomy/BACKLOG.md)。

## 最短導線 — HAZAMAを聴いてLyric Labへ渡す

1. [Listen hub](../listen.html)を開き、current passの
   [HAZAMA Band Room](../band-room.html?band=hazama)へ進む。
2. 01 / 02を選び、`📻 原音`（基準）と`🎛 AI 再現`を切り替える。02のAI再現には
   「02固有AIではない・01 authored frames共有・比較基準は02原音」と表示される。4ケースの直接linkはListen hubにある。
   歌詞を外して演奏を聴く／自分で歌う時は01/02の`KARAOKE` linkを使う。
3. `START`を一度押す。表示が `WARMING UP` / `PREPARING AI` の間は、
   band / song / modeがbusy中なので切替を待つ。
4. v401 AIはまず`all off`から、`drums + bass`、`drums + arp`、
   `drums + bass + arp`（vocal OFF）、`defaults`の順に各30–90秒聴く。
   どの層で短音過密になるかを分け、続けられれば約6分のarcを聴く。弱端末の比較だけ
   [phone-light](../band-room.html?band=hazama&aiLight=1)を使う。
5. Listen hubへ戻って[Lyric Lab](../lyric-lab.html)を開き、制作元をBand Roomとして
   keep / fix、歌詞、BPM / key / 尺、制作先を手動で整理する。リンクを開くだけでは、
   ACE-Step等のmodel実行、weight download、音声生成は始まらない。

### STARTに失敗したら

- 失敗時はplayingへ進まず、ボタンは`START`へ戻り、直下に復旧案内が出る。
  REC / stems packも無音のまま開始しない。
- AudioContext停止なら画面を一度tapしてから`START`を一度押す。
- 直らなければ`RESET AUDIO`を使い、必要ならreloadして通信状態を確認する。
- 「曲または再生モードを切り替えています」と出た場合や、
  `WARMING UP` / `PREPARING AI`中は連打せず、band / song / modeのbusy解除を待つ。

## Tabascoをまず触る

1. [通常のBand Room](../band-room.html)を開く。初回はTabascoの01 `TABASCO`と
   `📻 原音`から始まる。以後のqueryなしreloadは保存済みのvisible bandを復元し、
   そのbandの01へ戻る。HAZAMA deep-linkはこの復元より優先される。
2. `START`を押し、分秒バーで任意地点へseekする。STOP後もその位置から再開できる。
3. 曲末は02 `Hey`以降へ進む。`📻 原音` / `🎛 AI 再現`を切り替えて比較する。
4. `📖 ?`ボタンでkeyboard shortcutを確認する。

---

## 画面構成（現行: br-236 / br-90）

```
┌─────────────────────────────────┐
│  BAND ROOM                 [?]   │  ← ヘッダ + help button
├─────────────────────────────────┤
│  [-] master volume [====] 80 [bridge] [+] │  ← sticky 車 / touch 向け常時音量 (狭幅は route 非表示)
├─────────────────────────────────┤
│  [Tabasco] [...]                 │  ← visible band 選択（HAZAMAはdeep-linkのみ）
├─────────────────────────────────┤
│  [01] [02] [03] [04] [05] [06] [07] │  ← Tabasco の 7 曲
├─────────────────────────────────┤
│  [ 📻 原音 ]  [ 🎛 AI 再現 ]      │  ← HAZAMAでは原音を自動選択（AI切替可）
├─────────────────────────────────┤
│  [ START ]                       │  ← 再生 / warming / preparing / stop
│  01 Still Moving · 原音 4 stems   │  ← 選択文脈 / 読込サイズ
│  復旧案内                         │  ← START失敗時だけ表示
│  0:00 ━━━━━━━━━━━━━ 5:04          │  ← song timeline / seek
│  117 BPM · G major               │
│  verse-1 · 4/16 → chorus-1       │  ← セクションナビ
│  ▮▮▮▮▮▮▮▯▯▯▯ (RMS meter)      │
│  ▆▅▄▆▇▅▃▂▁▁ (spectrum 64-bin)  │
│  [intro] [verse-1] [chorus-1]... │  ← click=jump, shift-click=A/B loop
├─────────────────────────────────┤
│  ▸ listening note               │  ← 端末内保存 / context付きcopy
├─────────────────────────────────┤
│  layer toggles (mode 別)         │
│  📻 vocals · drums · bass · other │
│  🎛 drums · bass · guitar · vocal · chords · arp · click │
├─────────────────────────────────┤
│  [ lyrics — current section が    │  ← 自動スクロール + ハイライト
│    glow して、他は dim ]          │
├─────────────────────────────────┤
│  chord: G                        │
├─────────────────────────────────┤
│  ▾ sound mix                     │
│  ▾ 🎙 external vocal              │
│  ▾ 🥁🎸🎹 external stems          │
│  ▾ 🎵 vocal phrase trigger        │
│  ▾ 🥁 drum kit + synth profile    │   ← v91-v102 の中心
│  ▾ 🐢 practice tempo (50-120%)    │
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
- 両対応bandはmode barで切替（v397からHAZAMAも両対応・原音が既定）。
  非対応modeのpillはdisabledになり、`m` shortcutでも移らない。

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

- **sound mix / space** = reverb / width / warmth / loudness の 4 slider
- **master preset chips** = neutral / lo-fi / club / rock / ambient で 1 クリック切替
- 内部: per-stem EQ + 2 段 master comp + StereoWidener + tape sat + reverb wet
- 詳細: [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md)

### 録音 / DAW 連携

- **⏺ live record** = post-limiter master mixをWAVへ変換してdownload
  （browser側の変換失敗時だけMediaRecorder形式へfallback）
- **📦 stems pack export** = 4 stem を別々に同時録音 (DAW 投入用)
- **🎹 MIDI in/out** = ドラムマシン / DAW に MIDI Clock 送出 (24 PPQ)、外部 MIDI note 受信で phrase trigger / section nav
- 詳細: [DAW-INTEGRATION.md](./DAW-INTEGRATION.md)

### A/B 比較

- 🔀 A/B compare = 全 sliders / toggles / mode / profile / preset を A, B にスナップショット → 瞬時切替
- 「Sakanaction vs LCD-motorik」「club vs lo-fi」「original vs all-external」等の比較

### 状態保存

- slider / toggle / kit / profile / voice override / instrument等を
  **localStorageに自動保存**。playback modeは保存せず、起動時にbandの対応modeへ戻す。
- queryなしreloadは保存済みvisible bandの01へ戻る。HAZAMAの`band` queryと
  Drum Floorの`from=drum-floor` + `song` queryは通常復元より優先する。
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

- **canonical / synth / fallback** — [tabasco-lyrics-final.md](./tabasco-lyrics-final.md)
- **原音karaoke timing** — `tabasco-lyrics-timed.json`。Whisper ASR由来で、Hey /
  I got a feeling / Under the Moon / Human Fly / Sisterの5曲だけ。歌詞正本や人間確認済み
  transcriptionではなく、原音modeの行表示と時刻にだけ使う。
- timed dataがないTABASCO / Electric Sheepとload失敗時はfinal singableへfallbackする。
  旧 draft / cut-up / syllabic はarchive扱い。

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

- [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) — v65から現行までのcompact履歴
- 設計判断 / パラメータの数値 / 各機能の commit ハッシュもここに

---

## 関連 doc

| doc | 用途 |
|-----|------|
| [BAND-ROOM-USAGE.md](./BAND-ROOM-USAGE.md) | HAZAMA最短入口と用途別レシピ (カラオケ / AI再現 / 厚み出し / Suno / ad-lib) |
| [BAND-ROOM-CHANGELOG.md](./BAND-ROOM-CHANGELOG.md) | v65から現行までのcompact履歴、各wave詳細 |
| [BAND-ROOM-ADD-BAND.md](./BAND-ROOM-ADD-BAND.md) | 新バンド追加手順 |
| [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) | **「作品」として世に出す道筋** (album 制作 / 30 min lofi set / 配信 platform 比較) |
| [RECORDING-WORKFLOW.md](./RECORDING-WORKFLOW.md) | UR44 + マイク / bass / 電子ドラム / EP-133 経由で band-room の external slot に流す具体手順 |
| [EP133-KOII-BANDROOM-WORKFLOW.md](./EP133-KOII-BANDROOM-WORKFLOW.md) | EP-133 K.O.II の USB/sample/audio routing と Band Room への戻し方 |
| [music-hardware-dashboard.html](./music-hardware-dashboard.html) | worker-gaming / hardware / Sonar 作業の静的ダッシュボード |
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

- **Listen hub** (`listen.html`) — 現在の試聴順。HAZAMAを聴いた後にここからLyric Labへ進む
- **Lyric Lab** (`lyric-lab.html`) — 歌詞・keep/fix・制作先を手動で整理するmetadata handoff
- **Hazama FM** (`fm.html`) — 集中作業 BGM ジェネレーター
- **Music Core Rig** (`index.html`) — 同じ engine.js を共有する mixer / 環境音作り
- **Drum Floor** (`https://quietbriony.github.io/drum-floor/`) — 現曲 / BPM / section / frame を metadata-only で受ける手動ドラム preview
- これらは **隔離されたアプリ** (catalog / 操作モデル別)、band-room と素材レベルで
  橋渡し可 ([DAW-INTEGRATION.md](./DAW-INTEGRATION.md) 参照)
