# Cross-App Integrity — Music Stack 全体の整合性チェック (v168 時点)

> ユーザー指摘: 「全体のネタが先的にかみ合って、最適解になるように、整合性
> チェックと磨き」
>
> 3 つの app + 1 セット engine.js + 1 catalog json で全体が回ってる。
> アプリ境界、機能対応、データソースの整合を一覧で示す。

---

## 1. アプリ境界 (3 app + shared assets)

| app | URL | 主要 JS | 用途 |
|-----|-----|--------|------|
| **Hazama FM** | `/fm.html` | `engine.js` + `fm.js` | 集中作業 BGM ジェネレーター (ambient / lofi / jazz / funk / piano / techno) |
| **Music Core Rig** | `/index.html` | `engine.js` only | 同じエンジンの mixer / 環境音調整 UI、Hazama FM の別フェイス |
| **Band Room** | `/band-room.html` | `band-room.js` | Tabasco LIVE リバイバル + 練習 / カバー / 録音 |

Hazama FM / Music Core Rig は別 manifest、Band Room は mobile-capable page。
Service Worker は `sw.js` を共有し、cache invalidation も `hazama-fm-vNN` で 3 app
まとめて行う。共有している主な runtime は **`engine.js` (Hazama FM ↔ Music Core Rig 共通)**、
sample catalog、genre pattern JSON、CDN サンプル URL。

---

## 2. mode / preset / profile 対応表

ここが混同しがちな部分。**各 app が独自に "lofi" を持ってる**:

| app | "lofi" の所在 | データ source | 音色実装 |
|-----|-------------|------------|---------|
| **Hazama FM** | `engine.js` の `updateSoundForMode("lofi")` + FM GenreFlavor overlay | `presets/drum-frames-lofi.json` + `chill-piano-recipe.json` | ⚡ **v115 で piano trio + breakbeat 化**:<br>• Salamander piano (chord, padBus)<br>• Salamander piano 低オク (walking bass, bassBus)<br>• tone-breakbeat (kick/snare/hat, drumBus)<br>• GenreFlavor の crackle / jazz dust は薄い上澄み |
| **Music Core Rig** | 同 (engine.js 経由) | 同上 | 同上 |
| **Band Room** | `band-room.js` の `MASTER_PRESETS["lo-fi"]` (v109) | カタログ参照 | **Salamander piano (chord) + Salamander bass + tone-breakbeat (kit) + flute (lead) + guitar OFF** (v110-v111) |

**v115 の整合化ポイント**: Hazama FM lofi と Band Room lo-fi preset で同じ CDN サンプル (tonejs.github.io/salamander + drum-samples/breakbeat13) を使う。 **3 app で "lofi = Salamander piano + breakbeat" の同一音源スタック**が成立。

---

## 3. シェアされてるリソース

| asset | 使う app | 用途 |
|-------|--------|------|
| `presets/online-samples-catalog.json` | **全 app** | CDN kit / instrument の URL 定義。Band Room は voice/kit selector、Music Core Rig は catalog override、Hazama FM は `engine.js` loader 経由 |
| `presets/tabasco-stems/*.mp3` | **Band Room only** | Demucs 抽出の Tabasco 4-stem |
| `presets/sample-kits/<source>/<song>/*.wav` | **Band Room only** | Tabasco/UNRIPE 各曲のドラム / vocal phrase 1ショット |
| `presets/drum-frames-*.json` | **Band Room** (`tabasco-*`) + **Hazama FM** (`lofi/funk/techno/jazz` 等) | 別ファミリ。Band Room は曲 frame、Hazama FM は genre flavor |
| `presets/drum-patterns-genres/*.json` | **Band Room + Hazama FM handoff** | Band Room の genre picker 用。Hazama FM の genre pill から suggestion を渡す |
| **Tone.js (CDN)** | 全 app | Web Audio API ラッパー |
| **tonejs.github.io samples** (Salamander 等) | Band Room (v97-v111) + Hazama FM (v113 lofi) | 共有 CDN URL — v113 で初めて Hazama FM 側も借りる |
| **jsDelivr / dirt-samples / nbrosowsky** | Band Room only | 11 sample kit / 11 instrument |

---

## 4. 機能対応マトリクス

似た機能が複数 app に存在する場合、それぞれの実装と整合チェック:

| 機能 | Hazama FM | Music Core Rig | Band Room |
|------|----------|---------------|-----------|
| START/STOP | ✓ (mode-driven) | ✓ (manual mixer) | ✓ (song-driven) |
| BPM 制御 | UCM auto + slider | slider | drum-frames bpm + tempo slider (50-120%) |
| section / structure | なし (generative) | なし | drum-frames JSON の `structure[]` |
| lyrics | なし | なし | markdown + section sync (v73) |
| stems mode | なし | なし | ✓ (Demucs 4-stem) |
| AI 再現 / synth mode | エンジン本体 | 同 | scheduleBar 分岐 |
| sampler 楽器 | 🆕 v113 で pad に Salamander | 同 | v97-v111 で全 voice (drum/bass/chord/guitar/voice) |
| **master mastering chain** | engine.js v74 (gentle comp + widener) | 同 | band-room v66 (per-stem EQ + 2 段 comp + tape sat + widener + reverb) |
| recording | engine.js btn_rec (post-limiter) | 同 | `br-rec-toggle` (post-limiter) + `br-stems-pack` (4 stem 別) |
| online catalog | loader 経由の preset / sample source | ✓ catalog override UI | ✓ |
| genre pattern handoff | genre pill → localStorage suggestion | なし | suggestion highlight → user tap で inject |
| Drum Floor handoff | `drum floor →` が SYNC packet + `from=fm` query で FM genre/BPM を渡す | packet build API を共有 | Band Room song/BPM/section/frame を SYNC、drum-floor main は return links merged |
| 車載/BT音量 | Media Session volume fallback + background bridge | Media Session volume fallback | master volume bar + Media Session fallback + hidden audio bridge |
| focus mode | 40 Hz / 8% AM, default OFF | 同 engine APIあり (UIはFM) | なし |

**整合チェック**: master mastering chain は両 app で揃ってる (band-room の方が高度だが engine.js も v74 で揃え済)。 sampler 経路は今まで band-room only だったが、**v113 で Hazama FM lofi も Salamander piano に置換**して **lofi = 実 piano** の統一が完成。
v142-v168 で、FM の phrase-lock / pattern variation / visible Band Room handoff / 40Hz focus / 長時間 event quieting / start-stop hardening / bridge health fallback / browser loudness uplift / route badge / route diagnostics + rearm / Drum Floor direct handoff と、Band Room の車載 audio bridge / route status / bridge health fallback / album-flow default playback / full-song auto advance guard / iPhone suspend recovery / lock-screen album transport / FM query suggestion / drum-floor metadata handoff / Drum Floor return song link / final singable lyrics / offline-safe cache-busted lyrics+drum-frame load / 普通の分秒 timeline + seek bar / source-derived AI part agents / default mix polish / saved mix migration、Music Core overview からの Chill Session 入口が追加済み。

---

## 5. 共通 catalog 化の現在地

現状: `online-samples-catalog.json` は Band Room と Music Core Rig だけでなく、
`engine.js` からも参照される。Core Rig には `#catalog-select` があり、
Band Room は voice / kit selector、Hazama FM は engine sampler / genre flavor 側の
共有参照として使う。

次の改善余地は「採用済み catalog をどう固定・記憶・モード別 policy 化するか」。
たとえば:

```
mode "lofi"     → instruments[salamander-piano] for pad
mode "jazz"    → instruments[guitar-nylon] for chord + instruments[saxophone] for lead
mode "techno"  → kits[dirt-909] for drum + instruments[bass-electric]
mode "ambient" → instruments[harp] for texture + instruments[cello] for sustained tone
```

catalog 1 ファイル編集だけで 3 app 全部の音色候補が同期する段階までは到達済み。
今後は user preset 保存、offline fallback、mode ごとの優先順位を磨く。

---

## 6. ノイズ vs 音色 — 整合チェック

「lofi っぽさ」を:

- ❌ **ノイズで覆う** (vinyl crackle, tape hiss, narrow filter) ← v109 前の Hazama FM lofi、band-room v93 lofi はこれだった
- ✅ **音色そのもので作る** (piano trio + breakbeat + flute lead) ← v109+ band-room、v113+ Hazama FM
- ✅ **薄い overlay として足す** (crackle / jazz dust / session break) ← v150 時点の FM GenreFlavor

両 app とも **音色そのものが主役** に統一済。noise 系効果 (vinyl crackle 等) は、音色の上の薄いレイヤーとして付ける(覆い隠さない)。

---

## 7. 各 app の現在地 (cache version)

| app | latest cache marker | sw VERSION |
|-----|---------------------|------------|
| Band Room | `band-room.css?v=br-73` / `band-room.js?v=br-85` | hazama-fm-v168 |
| Hazama FM | `engine.js?v=fm-82` / `fm.css?v=fm-50` / `fm.js?v=fm-64` | 同上 |
| Music Core Rig | `engine.js?v=fm-82` / `style.css?v=fm-28` | 同上 |

`sw.js` の VERSION は **3 app 共通** で `hazama-fm-vNN`。ここを bump すると 3 app 全部のキャッシュが invalidate される。

---

## 8. ドキュメント整合チェック

| doc | カバー範囲 | 整合状態 |
|-----|----------|--------|
| `BAND-ROOM-MANUAL.md` | Band Room 入り口 | v168 saved mix migration / default mix polish / AI part agents / timeline 反映済 |
| `BAND-ROOM-CHANGELOG.md` | v65-v168 compact | 近年履歴は compact 追記で同期 |
| `SAMPLE-CATALOG-GUIDE.md` | online catalog 操作 | v112 で大幅拡張済 (search query / license tree / tutorial) |
| `DAW-INTEGRATION.md` | DAW 連携 | v87-v90 まで反映 |
| `FREE-SAMPLES-AND-SYNTHESIS.md` | 音色設計哲学 | v91 までだが v109+ Sampler 化を補追記が必要 |
| `REPO-MANAGEMENT.md` | Pages 制限 | 静的、変更なし |
| `HAZAMA-FM-ARCHITECTURE.md` | 全体アーキ | v149 の phrase / focus / bridge 反映済 |
| `CROSS-APP-INTEGRITY.md` | **このファイル** | 整合性 hub / v168 cache map |
| `tabasco-lyrics-final.md` | Band Room 表示用の歌える一本稿 | v163 primary |
| `tabasco-lyrics-{draft,burroughs,v4-syllabic}.md` | 旧候補 / archive | runtime には表示しない |
| `USAGE-HAZAMA-FM.md` | FM 使い方 | v149 主要 controls 反映済 |
| `USAGE-MUSIC-CORE-RIG.md` | Music Core 使い方 | 基本操作は有効、catalog override 追記余地 |

次に docs を磨くなら、`USAGE-MUSIC-CORE-RIG.md` の catalog override 追記が優先。
