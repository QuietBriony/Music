# Rhythm / Timing Research (v132)

> ユーザー: 「Hazama FM、間がずれたり気持ち悪いタイミングで打ち込みが
> 入ったりする。音楽理論 / 音色 / リズムパターン / Suno アルゴリズム
> 等をリサーチしながら開発進めるプラン立てて」
>
> v132 で **3 並列 sub-agent** (engine 構造監査 / web research / drum-frames
> JSON 監査) を走らせて原因究明 → 即効修正 + 中長期 plan を 1 doc に集約。

---

## 1. 真因 — 三重スイング + 浮遊感

3 agent 揃って指摘した中核問題:

| 真因 | 場所 | 影響 |
|------|------|------|
| **A.** `Tone.Transport.swing` を UCM `wave` で動的変動 (0.015-0.105) | engine.js:9966 | スイング量が常時動く |
| **B.** drum-frames `microMs` は既に swing 込みで手書き設計 | drum-frames-lofi.json 等 | A と二重 |
| **C.** D'Angelo `extraMs` (+2-7ms) を snare/ghost に追加加算 | genre-flavor.js:848-850 | 三重スイング |

結果: 78-90 BPM の lofi mode で snare が **元グリッドから 30-50ms 遅延**
→ アンカーなしの「浮遊感」「気持ち悪い」感の主因。

更に副因:
- lofi/jazz drum-frames は **全 voice が microMs 正値で drag** = on-grid anchor が無い
- tabasco-* drum-frames (band-room 側) は extracted 後 **kick/snare が 1 つも無い** ファイル多数 (= 別問題、別 wave で対応)

---

## 2. v132 修正内容

### A. Transport.swing を mode 別固定 (engine.js fm-67)

```js
const FM_MODE_SWING = {
  ambient: 0.0,
  lofi:    0.0,  // microMs で表現済、追加 swing 不要
  jazz:    0.0,
  techno:  0.0,
  trance:  0.04,
  dub:     0.0,
  funk:    0.02
};
```

UCM.wave による動的変動を**止め**、各 mode で固定。三重スイングの A を消す。

### B. D'Angelo extraMs を大幅縮小 (genre-flavor.js fm-67)

```
ambient: 0.0       (変更なし)
techno:  0.0       (変更なし)
lofi:    0.5 → 0.10  (-80%、微キャラ維持)
jazz:    0.5 → 0.15  (-70%)
funk:    1.0 → 0.25  (-75%)
```

`extraMs = (2 + Math.random() * 5) * dangelo` で snare/ghost に乗ってた追加遅延
を大幅減衰。三重スイングの C を消す。

### C. drum-frames JSON の microMs 見直しは v133 で

`drum-frames-lofi.json` 等の microMs 値そのものを書き換えるのは大規模 + キャラ
変わるので、A + B の効果検証してから判断。**v132 では JSON 触らず**、Tone 側
の補正を消すアプローチで効果見る。

---

## 3. 結果検証ポイント

リロード後の試聴で確認:

1. **Hazama FM の lofi mode で snare が前より「ピシッ」と入るか**
   - 改善されてるなら A + B が正解 → 完了
   - まだ「気持ち悪い」なら drum-frames microMs 自体に問題 → v133 で JSON 編集
2. **jazz mode の swing 感が無くなって感じるか**
   - jazz は microMs 24+8 で swing 表現してたので、Transport.swing 切っても残るはず
   - もし足りないなら FM_MODE_SWING.jazz を 0.04 に少し戻す
3. **techno mode で四つ打ちが「整った」感じか**
   - techno は元から swing 不要、改善されてるはず

---

## 4. 副次的発見 — tabasco-* drum-frames 破損

agent 3 の audit で発覚:

| file | 状態 |
|------|------|
| **drum-frames-tabasco-tabasco.json** | 🚨 kick/snare 0 個、crash/hat/ghost のみ |
| **drum-frames-tabasco-hey.json** | 🚨 kick/snare 0 個 |
| **drum-frames-tabasco-electric-sheep.json** | 🚨 kick/snare 0 個、verse_drive が crash 連発 |
| drum-frames-tabasco-sister.json | 混在 (intro_warm は手書き、他は extracted で vel 0.35 一律) |
| drum-frames-tabasco-i-got-a-feeling.json | 混在 |
| drum-frames-tabasco-human-fly.json | 混在 |
| drum-frames-tabasco-under-the-moon.json | 混在 |

原因: `scripts/_extract_drum_patterns.py` (v65) の band-energy 分類が低音域を
classify せず、全 crash/hat/ghost に振り分けた。

→ band-room の AI 再現 drum-floor で、Tabasco の特定曲を選ぶと kick/snare 不在で
groove 崩壊。

**v133 候補**: extraction script の threshold 見直し or hand-author fallback。
今は **band-room v106 の sparse frame reinforcement** (kick/snare < 6 events
の bar に基本 4-on-floor を補強) でカバーされてる、無音にはならない。

---

## 5. 中長期 plan — web research の results

### Tier 1: 即実装可能 (Tone.js + Magenta.js)

| # | 内容 | sources | 工数 |
|---|------|--------|------|
| **1** | **Magenta.js DrumsRNN 統合** — band-room の auto-fill ボタンに、4 bar 続編を AI 生成。`@magenta/music` jsDelivr 経由、model ~数 MB | https://magenta.github.io/magenta-js/music/ , https://github.com/magenta/drumbot | 中 (1 日) |
| **2** | **Genre standard patterns を drum-frames JSON に追加** — boom-bap / four-on-floor / jazz brush / drum-and-bass の 16-step テンプレ (research result 4) | https://midimighty.com/blogs/resources/drum-patterns | 小 (2-3 時間) |
| **3** | **`@tonejs/midi` で MIDI loop 取り込み** — Groove Monkee / JJ Doge の free MIDI を JSON 変換 → ライブラリ化 | https://www.jsdelivr.com/package/npm/@tonejs/midi | 中 (1 日) |
| **4** | **per-step microOffsets で Dilla feel** — `microOffsets[16]` array で snare 2/4 を +10-15ms、hat を -3 〜 -6ms | https://github.com/tonejs/tone.js/wiki/Transport | 小 (1 時間) |

### Tier 2: 中規模 R&D

| # | 内容 | sources |
|---|------|--------|
| **5** | **brain.fm 風 40Hz AM 変調** — `Tone.LFO 40Hz → Tone.Gain` を master bus にオーバーレイ、focus mode で A/B | https://www.brain.fm/science |
| **6** | **HR 連動 BPM (Endel 風)** — Web Bluetooth で心拍計接続、BPM = HR + 12 みたいなマッピング | https://endel.io/science |
| **7** | **Suno semantic-marker UX** — `[beat drop]` `[breakdown]` のような cue point を tracks に持たせて操作 | https://www.latent.space/p/suno |

### Tier 3: スコープ超え (別 architecture)

| # | 内容 |
|---|------|
| **8** | **AudioWorklet で custom DSP** — Web Audio API の native worklet に DSP コードを WASM 化して載せる |
| **9** | **WAM 2.0 host** — Surge XT / Dexed / SFZ player を browser host |
| **10** | **Magenta MusicTransformer** — full song AI 生成、checkpoint 数百 MB |

---

## 6. 推奨優先順位

```
v132 (今): A + B 修正 + research doc          ← 完了
   ↓ 試聴して効果検証
v133: C (drum-frames microMs 調整) or
      Tier 1 #4 (per-step microOffsets) or
      Tier 1 #2 (genre standard pattern templates)
v134-135: Tier 1 #1 (Magenta DrumsRNN 統合)
v136+: Tier 2 (brain.fm AM / Endel HR)
v200+: Tier 3 (WAM / MusicTransformer 別 architecture)
```

各 Tier 1 完了で「気持ち悪いタイミング」問題は概ね解消、AI 動的パターン
(Magenta) で更に高品質化、Tier 2 は実験的、Tier 3 は scope 外。

---

## 7. 関連 doc

- 全体アーキ: [CROSS-APP-INTEGRITY.md](./CROSS-APP-INTEGRITY.md)
- 音色設計: [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md)
- catalog 拡張: [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md)
- 作品 path: [PRODUCTION-PATH.md](./PRODUCTION-PATH.md)
- 録音 workflow: [RECORDING-WORKFLOW.md](./RECORDING-WORKFLOW.md)
- Suno AI 歌唱: [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md)
