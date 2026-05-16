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

### BL-002 — sister repo の logic 検証カバレッジを drum-floor 並みへ
- priority : P1
- repo     : chill, namima, openclaw
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : stack-check 棚卸し（2026-05-16）
- detail   : chill / namima / openclaw は現状 `check-pwa-static.mjs`（PWA shell の
  静的検査）と adapter check のみで、ドメインロジックの自動検証が薄い。drum-floor の
  `tests/` 相当の logic チェックを各 repo に 1〜数本足す。feature branch + PR。

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

### BL-005 — integration-index §7 の docs-only boundary PR 群を消化
- priority : P2
- repo     : Music
- scope    : docs
- agent    : either
- human-gate: no
- source   : docs/music-stack-integration-index.md §7
- detail   : chill / test / namima-lab の現行境界 docs（quiet-piano-trio /
  style-blend / safe-ripple-lineage decision）を catalog と整合させる docs-only PR。

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

### BL-009 — drum-floor に JS-side の静的 contract check を追加
- priority : P2
- repo     : drum-floor
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : Phase B sister-repo 棚卸し（2026-05-16）
- detail   : drum-floor の commit gate は `python -m pytest tests/` のみで、JS web UI
  （`app.js` / `src/*.js` / `sw.js` cache 同期）は `test_pwa_static_contract.py` 1 本でしか
  見ていない。chill/namima/openclaw 同様の `node scripts/check-*.mjs` を 1 本足す。

### BL-010 — namima sw.js の cache version 二重管理を解消
- priority : P2
- repo     : namima
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : Phase B sister-repo 棚卸し（2026-05-16）
- detail   : namima/sw.js は `VERSION`（`namima-pwa-v3`）と asset query `?v=stack-3` の
  2 系統を別々に bump する必要があり drift しやすい。単一化、または両者の整合を
  `check-pwa-static.mjs` で assert する。

### BL-011 — openclaw check-pwa-static.mjs の expected version を引数化
- priority : P2
- repo     : openclaw
- scope    : non-engine-code
- agent    : either
- human-gate: no
- source   : Phase B sister-repo 棚卸し（2026-05-16）
- detail   : openclaw の `check-pwa-static.mjs` は sw.js の `VERSION` を literal で
  pin assert しており、cache bump の度に check script 側の編集が要る。Music の
  `audit.py --expected-version` 方式に寄せ、CLI 引数 or env で受ける。

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

---

## Done

### BL-001 — sister repo agent-readiness ✅ 2026-05-16
- repo: chill, drum-floor, namima, openclaw / scope: docs
- chill / drum-floor / namima / openclaw に `AGENTS.md` を作成、STACK-INDEX へ統合。
  drum-floor は pytest が collection error（`drum_floor` 未 import）だったため
  `conftest.py` で repo root を sys.path へ追加し修復。stack-check 0 BAD 達成。
- 詳細は `SESSION-LEDGER.md` 2026-05-16 エントリ。
