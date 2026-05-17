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

### BL-007 — stack-check の health 拡張を検討
- priority : P2
- repo     : stack
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : 本エンジン構築（2026-05-16）
- detail   : `scripts/stack-check.mjs` に、pytest 未導入時の WARN 集計や
  GitHub Pages deploy 後の 200 応答チェックを足すか検討。過剰にしない。

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

### BL-015 — check-hazama-melody.mjs の version hardcode を解消
- priority : P2
- repo     : Music
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : v176 cycle で判明（2026-05-16）
- detail   : `scripts/check-hazama-melody.mjs` が sw.js の VERSION を literal で assert
  しており、cache bump 毎に check script の追従編集が要る。BL-011 で openclaw に施した
  pattern 検出方式へ置換する。

### BL-017 — 休眠 engine.js サブシステムを reactivate か削除か判定
- priority : P2
- repo     : Music
- scope    : engine
- agent    : codex
- human-gate: yes
- source   : dormant-asset 監査（2026-05-16）
- detail   : engine.js に `enabled` 固定 false で起動経路の無いサブシステムが複数 —
  `FocusModulationState`（40Hz AM、8062-8167行。BL-004 の 40Hz focus mode の実体で
  「default OFF」でなく有効化 UI/ロジックが存在しない）、`AcidLockState`（564-570行）、
  `MicFollowState`（750-767行。mic-follow groove は v139 で稼働、現在 off）。各々
  「有効化経路を足して活用」か「デッドコード削除」かを判断。engine 凍結域・要承認・codex 向き。
  BL-004 はこの item に統合。

### BL-018 — 未配線の preset / reference JSON を wire か削除で整理
- priority : P2
- repo     : Music
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : dormant-asset 監査（2026-05-16）
- detail   : `presets/{ambient,dub,jazz,lofi,techno,trance}.json`（`loader.js` 未登録・
  runtime 参照なし）、`presets/tabasco-analysis.json` / `unripe-analysis.json`（参照ゼロ）、
  `references/apple-music-refs.json`（コメント参照のみ・runtime 未パース）。各々 wire して
  活用するか、混乱の元として削除するか整理する。

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
- detail   : `AGENTS.md` hard rule で engine.js は原則凍結。実施するなら codex が
  明確な境界（`MusicRadioBrainState` 周辺など）で PR を立て、user 別承認必須。
  自律ランの対象外。長期の保守性課題として記録のみ。

### BL-020 — 雑多な dormant の cleanup
- priority : icebox
- repo     : Music, drum-floor, namima
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : dormant-asset 監査（2026-05-16）
- detail   : 小粒の未活用物 — `engine.js` の `randomNoteFromScale()`（11563行・未呼び出し）、
  drum-floor の空 `patches/` ディレクトリ（.gitkeep のみ）、namima `sketch.js` の v3/v4
  "lab" variant（active 導線なし）。活用予定が無ければ削除、有るなら個別 BL 化。

### BL-016 — Band Room kit セレクタのラベル明確化（minor / 前提訂正済み）
- priority : icebox
- repo     : Music
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : dormant-asset 監査（2026-05-16）→ 同日の調査で前提を訂正
- detail   : 当初 P1「実ドラムが synth 既定の裏に休眠」としたが、調査で **前提が誤りと判明** —
  Band Room の既定 `kitSource` は `auto-self`（曲自身の抽出実ドラム）で実録音ドラムは
  既に既定、dormant ではない。残る軽微な点のみ: kit セレクタ（`KIT_OPTIONS`、band-room.js
  122-138）のラベルが synth と実 sample を視覚的に区別せず、セレクタが折り畳み `<details>`
  内。やるならラベルに 🎹/🥁 等の区別を足すだけ（zero-risk・低価値）。

---

## Done

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
