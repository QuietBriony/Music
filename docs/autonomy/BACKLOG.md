# Backlog — music-stack

自律開発の作業待ち行列。新しい session はここから次の仕事を取る。
散在していた残課題（`USER-NOTES-MEMO.md` / `CODEX-HANDOFF.md` /
`music-stack-integration-index.md` §6-7）を統合した単一の正本。

## 使い方

- **取る**: `priority` 上位で、この session で完了でき、`human-gate` を踏める item を選ぶ。
- **追記**: 作業中に見つけた新タスクは末尾の優先度節に `BL-xxx` で追加。
- **閉じる**: 完了したら item を `## Done` へ移し、`SESSION-LEDGER.md` に記録。

## 共同開発の claim ルール（Claude / Codex 並走時）

Claude と Codex が同時に回す前提。item の取り合いと shared file 衝突を防ぐ:

1. **claim**: item を取ったら `status: wip — <agent> <date>` 行を item に足し、
   その 1 行だけを即 commit + push（例: `docs(music): claim BL-009`）。
2. 他エージェントは `git pull --ff-only` で claim を見てから別 item を取る。
3. `status` 行が無い item は open。完了したら item を `## Done` へ move。
4. 同じ repo / 同じファイルを 2 エージェントで触らない。repo 単位で割れば
   並列で衝突しない（詳細は `docs/COLLAB-CLAUDE-AND-CODEX.md`）。
5. このファイルと `SESSION-LEDGER.md` は作業前後に `git pull --ff-only`。
   衝突したら両者の意図を残して rebase 解決。

## item スキーマ

```
### BL-00X — タイトル
- priority : P0 | P1 | P2 | icebox
- repo     : Music | chill | drum-floor | namima | openclaw | stack
- scope    : docs | non-engine-code | runtime | engine | cross-repo | verify
- agent    : claude | codex | either | human
- human-gate: yes | no
- status   : open | wip — <agent> <date> | done  （省略時は open）
- source   : 出所
- detail   : 説明（完了条件を含む）
```

---

## P1

### BL-003 — 実車 / Bluetooth で hidden audio bridge を実機検証
- priority : P1
- repo     : Music
- scope    : verify
- agent    : human
- human-gate: yes
- source   : docs/USER-NOTES-MEMO.md（Band Room 車載音量）
- detail   : v145-v160 の hidden audio bridge / route badge / rearm は実装済み。
  残るは実車・BT 環境で車側 volume / track button にメディア音声として認識されるかの
  実機 validation。自律ランでは検証できない（人間が実機で確認）。

## P2

### BL-004 — Hazama FM 40Hz focus mode の depth A/B
- priority : P2
- repo     : Music
- scope    : runtime
- agent    : claude（実装）+ human（試聴判断）
- human-gate: yes
- source   : docs/USER-NOTES-MEMO.md
- detail   : 40Hz focus mode（default OFF / 8% AM）が耳で違和感を出すか A/B。
  強く感じる場合は depth を 8%→5% に落とす。実装は自律ラン可、最終判断は試聴。

### BL-006 — cross-repo listening review round
- priority : P2
- repo     : stack
- scope    : verify
- agent    : human
- human-gate: yes
- source   : docs/cross-repo-listening-review-round.md
- detail   : namima / chill / drum-floor を聴き比べ、次の tuning PR を 1 本だけ選ぶ
  人間レビュー。multi-repo 同時 tuning はしない。

### BL-012 — chill の harvest reference を runtime recipe へ昇格検討
- priority : P2
- repo     : chill
- scope    : runtime
- agent    : human
- human-gate: yes
- source   : Phase B sister-repo 棚卸し（2026-05-16）
- detail   : chill の export に `midnight-whisper` / `morning-light` の参照があるが
  `engine.js` の runtime recipe には未昇格。harvest / 試聴レビューで採否を決める
  taste 判断。`docs/cross-repo-listening-review-round.md` の枠で扱う。

### BL-019 — archive repo (namima-lab / test) の harvest 素材を翻訳取り込み
- priority : P2
- repo     : namima, Music
- scope    : cross-repo
- agent    : either
- human-gate: yes
- source   : dormant-asset 監査（2026-05-16）
- detail   : integration docs が harvest 指定しているのに未着手の素材 — namima-lab の
  organic-pluck audio recipe（a-min v1-v3 の filter/reverb/pluck パラメータ）、test の
  style archetype + interpolation math（Ambient/Lo-Fi/Goa/HardTechno の確率補間）。
  blind copy せず 1 PR = 1 idea で target repo の言葉へ翻訳（repo-strategy Phase 3 準拠）。

## Icebox

### BL-008 — engine.js の部分モジュール化
- priority : icebox
- repo     : Music
- scope    : engine
- agent    : codex
- human-gate: yes
- source   : code health 棚卸し（engine.js 約14.8k行のモノリス）
- detail   : `AGENTS.md` hard rule で engine.js は原則凍結。実施するなら明確な境界で
  PR を立て、user 別承認必須。**進捗（2026-05-17）**: satellite-script パターン
  （IIFE + `window.<Name>` 公開、ビルドステップ無し構成向け）を確立し、cross-repo
  routing 推薦まわり（route labels/URLs・review cue・recommendation 関数）を
  `audio/music-stack-routing.js` へ抽出済み（約280行を engine.js から分離、挙動保存）。
  以降の抽出候補は packet builders / recorder / focus modulation 等。engine.js は
  依然 14k 行台のため長期課題として継続。

---

## Done

### BL-017 — 休眠 engine.js サブシステムを reactivate か削除か判定 ✅ 2026-05-17
- repo: Music / scope: engine
- dormant-asset 監査の前提を訂正。`FocusModulationState` は FM `40HZ` button
  (`fm.html` / `fm.js`) と `window.setFmFocusModeEnabled` / `getFmFocusModeState`
  で現役。`AcidLockState` は `btn_acid_lock` と runtime packet/feedback に露出。
  `MicFollowState` は Core の `btn_mic_follow` と FM の mic follow controls から起動し、
  runtime packet / drum velocity scale / groove bias に現役で効く。
- 実際に未参照だった `randomNoteFromScale()` だけを削除。`randomChordForMode` /
  `randomHazeChord` / melodic director path には影響なし。
- `engine.js?v=fm-89` / `sw.js hazama-fm-v181` に cache bump。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。
- 残る taste 判断は BL-004（40Hz focus depth A/B）として維持。

### BL-016 — Band Room kit セレクタのラベル明確化 ✅ 2026-05-17
- repo: Music / scope: non-engine-code
- 前提訂正済みの minor item を消化。Band Room の `KIT_OPTIONS` label を
  `synth:` と `sample:` prefix で揃え、AI synth kit と曲自身/catalog sample kit が
  セレクタ上で区別できるようにした。既定 `auto-self` behavior は変更なし。
- `band-room.js?v=br-87` / `sw.js hazama-fm-v180` に cache bump。
- `check-band-room-logic.mjs` は Band Room script marker を literal ではなく
  HTML/SW 同期で検証し、kit label guard も追加。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。
- Browser: `http://127.0.0.1:4174/band-room.html` で `br-87` と label 表示を確認、
  console error なし。

### BL-007 — stack-check の health 拡張を検討 ✅ 2026-05-17
- repo: stack / scope: non-engine-code
- 通常の `node scripts/stack-check.mjs` はローカル gate のまま維持し、任意フラグ
  `--deploy-health` を追加。指定時のみ active 5 repo の GitHub Pages URL
  （Music / chill / drum-floor / namima / openclaw）が HTTP 200 を返すかを
  `deploy 200` check として表に加える。ネットワーク依存を通常 gate に混ぜないため、
  過剰な重さや不安定化は避けた。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。
- `node scripts/stack-check.mjs --deploy-health`: PASS 20 / FAIL 0 / SKIP 0（0 BAD）。

### BL-015 — check-hazama-melody.mjs の version hardcode を解消 ✅ 2026-05-17
- repo: Music / scope: non-engine-code
- `scripts/check-hazama-melody.mjs` の `fm-N` / `hazama-fm-vN` literal assert を解消。
  `fm.html` / `index.html` / `sw.js` から `engine.js` と `audio/music-stack-routing.js`
  の cache marker を抽出し、`fm-N` 形式・3箇所同期・engine/routing 同期を検証する
  pattern check へ置換。`sw.js VERSION` も `hazama-fm-vN` 形式だけを見るため、
  今後の cache bump で check script 追従編集が不要になった。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。

### BL-001 — sister repo agent-readiness ✅ 2026-05-16
- repo: chill, drum-floor, namima, openclaw / scope: docs
- chill / drum-floor / namima / openclaw に `AGENTS.md` を作成、STACK-INDEX へ統合。
  drum-floor は pytest が collection error（`drum_floor` 未 import）だったため
  `conftest.py` で repo root を sys.path へ追加し修復。stack-check 0 BAD 達成。
- 詳細は `SESSION-LEDGER.md` 2026-05-16 エントリ。

### BL-011 — openclaw check-pwa-static.mjs の version 引数化 ✅ 2026-05-16
- repo: openclaw / scope: non-engine-code
- `check-pwa-static.mjs` の sw.js VERSION ハードコード assert（`v3` 固定）を、
  正規表現での pattern 検出（`${CACHE_PREFIX}-v<N>` 形）＋ 任意の `--expected-version`
  引数へ置換。cache bump 毎の check script lockstep 編集が不要に。
- AUTONOMOUS-RUN.md プレイブックの初実走で消化（詳細は SESSION-LEDGER）。

### BL-002 — sister repo の domain-logic 検証カバレッジ ✅ 2026-05-16
- repo: chill, namima, openclaw / scope: non-engine-code
- 3 並列エージェントで各 repo に domain-logic check を追加: chill `check-chill-logic.mjs`
  （deterministic-preview 契約 / 公開 adapter / piano-recipe schema）、namima
  `check-mood-profiles.mjs`（mood-profiles schema / family-safe 制約 / 翻訳 logic）、
  openclaw `check-session-manifest.mjs`（session-manifest schema / 例 manifest / connector registry）。
- stack-check は 11 → 14 check に拡張、0 BAD。

### BL-009 — drum-floor JS-side domain-logic check ✅ 2026-05-16
- repo: drum-floor / scope: non-engine-code
- `scripts/check-music-sync-safety.mjs` を追加（~55 assertion）。SYNC 安全不変条件
  （auto-start / arm / MIDI を絶対にしない）、translation contract の clamp / 既知 id、
  groove-engine の決定性（同 seed → byte-identical bar）、`sanitizeControls` の boolean 強制を検証。

### BL-010 — namima sw.js cache version 二重管理を解消 ✅ 2026-05-16
- repo: namima / scope: non-engine-code
- `check-pwa-static.mjs` に sw.js の `VERSION`（`namima-pwa-vN`）と asset cache-buster
  （`?v=stack-M`）の数値一致 assert を追加。drift を gate で検出（sw.js は無改変）。

### BL-005 — integration 境界 docs の整合 ✅ 2026-05-16
- repo: Music / scope: docs
- `integration-catalog.md` と `music-stack-integration-index.md` §3 を STACK-INDEX と整合。
  active repo の `openclaw` が両 catalog から欠落していたのを追加、`hazama` を music-stack
  repo ではなく external reference-only と明示、`namima-lab` / `test` を archived 明記。

### BL-013 — drum-floor の出音改善（生音バリエーション + キック） ✅ 2026-05-16
- repo: drum-floor / scope: runtime（要・試聴確認）
- `src/audio-engine.js`: hit ごとの jitter PRNG（pitch ±2-3 cent / decay ±5-9% / level ±5%）
  と velocity → 音色マッピングを追加し「生音差がない」を解消。kick（tight_band）は
  peak level 0.86x・sub tail 短縮（decay 1.35→1.05x, 0.7x）・transient 後の sweeping
  lowpass で「ポンポン / うるさい」を抑制。cache drum-floor-pwa-v3。
- 出音の良否は試聴で人間が判定。ユーザー指摘ベースの改善。

### BL-014 — Hazama FM の出音改善（funk voice timbres） ✅ 2026-05-16 (v176)
- repo: Music / scope: runtime（要・試聴確認）
- `audio/genre-flavor.js`: funk EP (Rhodes) の和音を flat block → per-note ロール
  （8-22ms）+ voice ごと velocity ばらつきへ。funk clavi フィルタを velocity 追従に
  （静的 cutoff で全ノート同一音色だったのを解消）。`buildFunkDefault` /
  `buildFunkFromFrames` の両経路。engine.js 凍結のため genre-flavor.js で実装。
  cache hazama-fm-v176 / `?v=fm-71`。出音の良否は試聴で人間が判定。

### BL-021 — github-inventory→workspace 直下 移行後のパス文字列クリーンアップ ✅ 2026-05-17
- repo: Music, openclaw, namima / scope: docs
- music-stack を `C:\workspace\github-inventory\music-stack` → `C:\workspace\music-stack` へ
  移動後、旧パス文字列を 18 ファイル（Music docs 9 + `scripts/_*.py` 6 + openclaw docs 2 +
  namima docs 1）で `github-inventory/music-stack`→`music-stack` に置換。
  `cross-repo-listening-review-round.md` の単独 `github-inventory` 参照も文脈修正。機能影響なし。
- 詳細は `SESSION-LEDGER.md` 2026-05-17 エントリ。

### BL-018 — 未配線の preset / reference JSON を wire か削除で整理 ✅ 2026-05-17
- repo: Music / scope: non-engine-code
- dormant-asset 監査の前提を一部訂正。`presets/{ambient,dub,jazz,lofi,techno,trance}.json`
  は engine.js PresetManager（Music Core Rig の preset selector）が直接消費する active な
  「engine 用 6 ファイル」で dormant ではない（AGENTS.md Hard Rule 5・SCHEMA.md §4 が
  Hazama FM の loader.js 6 ファイルと別物と明記）。`references/apple-music-refs.json` は
  sw.js precache 登録済み＋設計リファレンスのため keep。実際に未参照だったのは
  `presets/tabasco-analysis.json` / `unripe-analysis.json` の 2 つのみ — 削除した。
- 詳細は `SESSION-LEDGER.md` 2026-05-17 エントリ。

### BL-020 — 雑多な dormant の cleanup ✅ 2026-05-17
- repo: Music, drum-floor, namima / scope: non-engine-code
- dormant-asset 監査の前提を訂正（2026-05-17 検証）。namima `sketch.js` の v3/v4 "lab"
  variant は存在しない（全コード active）。drum-floor `patches/` は README が将来の
  VCV `.vcv` patch 置き場と明記する意図的プレースホルダで junk ではない。残る
  `engine.js` の `randomNoteFromScale()`（未呼び出し）は engine.js 凍結域のため BL-017 へ統合。
- 詳細は `SESSION-LEDGER.md` 2026-05-17 エントリ。
