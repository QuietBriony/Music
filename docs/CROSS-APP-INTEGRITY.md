# Cross-App Integrity — Music Stack 全体の整合性チェック (v113 時点)

> ユーザー指摘: 「全体のネタが先的にかみ合って、最適解になるように、整合性
> チェックと磨き」
>
> 3 つの app + 1 セット engine.js + 1 catalog json で全体が回ってる。
> アプリ境界、機能対応、データソースの整合を一覧で示す。

---

## 1. アプリ境界 (3 app + shared assets)

| app | URL | 主要 JS | 用途 |
|-----|-----|--------|------|
| **Hazama FM** | `/fm.html` | `engine.js` + `fm.js` | 集中作業 BGM ジェネレーター (ambient / lofi / dub / jazz / techno / trance) |
| **Music Core Rig** | `/index.html` | `engine.js` only | 同じエンジンの mixer / 環境音調整 UI、Hazama FM の別フェイス |
| **Band Room** | `/band-room.html` | `band-room.js` | Tabasco LIVE リバイバル + 練習 / カバー / 録音 |

各 app は **独立した PWA** (別 manifest)、独立した sw scope、独立した state。
共有してるのは **`engine.js` (Hazama FM ↔ Music Core Rig 共通)** と **CDN サンプル URL の概念** のみ。

---

## 2. mode / preset / profile 対応表

ここが混同しがちな部分。**各 app が独自に "lofi" を持ってる**:

| app | "lofi" の所在 | データ source | 音色実装 |
|-----|-------------|------------|---------|
| **Hazama FM** | `engine.js` の `updateSoundForMode("lofi")` | `presets/drum-frames-lofi.json` + `chill-piano-recipe.json` | ⚡ v113 で **Salamander piano sampler** が pad 役 + synth pad は -22 dB 減衰 |
| **Music Core Rig** | 同 (engine.js 経由) | 同上 | 同上 |
| **Band Room** | `band-room.js` の `MASTER_PRESETS["lo-fi"]` (v109) | カタログ参照 | **Salamander piano (chord) + Salamander bass + tone-breakbeat (kit) + flute (lead)** (v110-v111) |

**v113 の整合化ポイント**: Hazama FM の lofi も Salamander piano を使うようになって、両 app で **"lofi = Nujabes piano trio + breakbeat"** という同じ音色イメージが揃った。

---

## 3. シェアされてるリソース

| asset | 使う app | 用途 |
|-------|--------|------|
| `presets/online-samples-catalog.json` | **Band Room only** | 10 drum kit + 11 instrument の CDN URL 定義 (v97-v111) |
| `presets/tabasco-stems/*.mp3` | **Band Room only** | Demucs 抽出の Tabasco 4-stem |
| `presets/sample-kits/<source>/<song>/*.wav` | **Band Room only** | Tabasco/UNRIPE 各曲のドラム / vocal phrase 1ショット |
| `presets/drum-frames-*.json` | **Band Room** (`tabasco-*`) + **Hazama FM** (`lofi/funk/techno/jazz` 等) | 別ファミリ、共有ファイル無し |
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
| online catalog | なし (将来) | なし | ✓ |

**整合チェック**: master mastering chain は両 app で揃ってる (band-room の方が高度だが engine.js も v74 で揃え済)。 sampler 経路は今まで band-room only だったが、**v113 で Hazama FM lofi も Salamander piano に置換**して **lofi = 実 piano** の統一が完成。

---

## 5. 共通 catalog 化のロードマップ (将来)

現状: `online-samples-catalog.json` は band-room.js しか参照しない。

将来案: engine.js も同じ catalog を fetch して、Hazama FM の各 mode の voice 担当を catalog 経由で切替可能にする。

```
mode "lofi"     → instruments[salamander-piano] for pad
mode "jazz"    → instruments[guitar-nylon] for chord + instruments[saxophone] for lead
mode "techno"  → kits[dirt-909] for drum + instruments[bass-electric]
mode "ambient" → instruments[harp] for texture + instruments[cello] for sustained tone
```

実装すれば、catalog 1 ファイル編集だけで 3 app 全部の音色が同期して変わる。

---

## 6. ノイズ vs 音色 — 整合チェック

「lofi っぽさ」を:

- ❌ **ノイズで覆う** (vinyl crackle, tape hiss, narrow filter) ← v109 前の Hazama FM lofi、band-room v93 lofi はこれだった
- ✅ **音色そのもので作る** (piano trio + breakbeat + flute lead) ← v109+ band-room、v113+ Hazama FM

両 app とも **音色そのもので** に統一済。今後 noise 系効果 (vinyl crackle 等) を加えるなら、音色の上の薄いレイヤーとして付ける(覆い隠さない)。

---

## 7. 各 app の現在地 (cache version)

| app | latest cache marker | sw VERSION |
|-----|---------------------|------------|
| Band Room | `band-room.{html,js,css}?v=br-51` (v112) | hazama-fm-v113 |
| Hazama FM | `engine.js?v=fm-56` / `fm.{css,js}?v=fm-44/53` (v113) | 同上 |
| Music Core Rig | 同上 (engine.js 共有) | 同上 |

`sw.js` の VERSION は **3 app 共通** で `hazama-fm-vNN`。ここを bump すると 3 app 全部のキャッシュが invalidate される。

---

## 8. ドキュメント整合チェック

| doc | カバー範囲 | 整合状態 |
|-----|----------|--------|
| `BAND-ROOM-MANUAL.md` | Band Room 入り口 | v102 まで反映済、v111 manual link 追加済 |
| `BAND-ROOM-CHANGELOG.md` | v65-v108 | ⚠️ v109-v113 未追記 (TODO) |
| `SAMPLE-CATALOG-GUIDE.md` | online catalog 操作 | v112 で大幅拡張済 (search query / license tree / tutorial) |
| `DAW-INTEGRATION.md` | DAW 連携 | v87-v90 まで反映 |
| `FREE-SAMPLES-AND-SYNTHESIS.md` | 音色設計哲学 | v91 までだが v109+ Sampler 化を補追記が必要 |
| `REPO-MANAGEMENT.md` | Pages 制限 | 静的、変更なし |
| `HAZAMA-FM-ARCHITECTURE.md` | 全体アーキ | ⚠️ v113 cross-app lofi 整合化を追記すべき |
| `CROSS-APP-INTEGRITY.md` | **このファイル** (v113 新規) | 整合性 hub |
| `tabasco-lyrics-{draft,burroughs}.md` | 歌詞 v2 / v3 | 静的 |
| `USAGE-HAZAMA-FM.md` | FM 使い方 | ⚠️ v113 lofi 音色変更を追記すべき |
| `USAGE-MUSIC-CORE-RIG.md` | Music Core 使い方 | ⚠️ 同上 |

CHANGELOG / アーキ / FREE-SAMPLES / USAGE-FM の 4 つに v113 反映が必要 (次の commit で対応)。
