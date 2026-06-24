# QA-LOOP — 運用書

music-stack（Music repo）の各サーフェスを、ユーザーストーリー単位で機能テスト→修正→再テスト
する自走 QA ループ。`/loop`（dynamic mode）で 1 チャンクずつ進む。

## 正典

- **`feature-stories.csv`** — 単一正典。1 行 = 1 機能のストーリー＋全フェーズ結果。
  列: `ID, 区分, 機能, ユーザーストーリー, 期待挙動(file:line), P1_story, P2_テスト結果,
  P2_不具合, P3_修正, P4_再テスト, human_gate, 備考`
- **`LOOP-STATE.md`** — 栞。current_phase / iteration / sync先 / 次にやること。毎回ここから読む。
- **`QA-LOOP.md`** — この運用書。

## フェーズ（1 イテレーション = 1 チャンク）

1. **Phase 1 — story化**: `index/band-room/fm/listen/depth` と `fm.js` / `band-room.js` から
   機能を 3〜5 件ユーザーストーリー化し CSV に起票。`engine.js` は**読むが改変しない**。
   期待挙動は file:line で固定。→ 満了で Phase 2。
2. **Phase 2 — 実走テスト**: `node scripts/stack-check.mjs`（**0 BAD** 必須）→
   `python -m http.server` で各サーフェスを preview 実走し、各ストーリーを機能テスト。
   結果を `P2_テスト結果`、見つけた不具合を `P2_不具合` に記録。→ 満了で Phase 3。
3. **Phase 3 — 修正(1件)**: `P2_不具合` から 1 件選び、**engine.js を避け**
   `fm.js / fm.css / genre-flavor.js / band-room.js` 等で修正 → `stack-check` 0 BAD →
   **UI を触ったら cache buster 3点同期**（asset `?v=fm-N`/`?v=br-N` + `sw.js` VERSION +
   checklist/changelog）。`P3_修正` に記録。→ 満了で Phase 4。
4. **Phase 4 — 再テスト**: 修正した行を再テストし `P4_再テスト` を埋める。満了で
   **ループ停止** → `docs/autonomy/SESSION-LEDGER.md` に要約追記。

## human_gate

音/ミックス/groove/ボーカル/Tone.js の**鳴り・見た目**は `human_gate=yes` にして
**人間へ上げる**。agent は機能面（DOM 状態 / aria / console error / node 数 / source 文字列）
だけ判定し、audio の良否を **agent で done にしない**。

## git / 安全

- 作業前に **`git pull --ff-only`**（sibling セッションが高頻度で push 中）。
- **無人 push しない**（user 号令まで保留）。ローカル作業のみ。破壊的 git 禁止。
- preview で audio を鳴らしたら必ず停止。SW+caches を消してから再検証（marker 据置時の stale 回避）。

## メモ

- `depth.html` は main に無い（sibling branch 上）。Phase 1〜4 では N/A 扱い。
- engine.js は全フェーズで read-only。
