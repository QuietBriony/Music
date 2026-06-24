# QA Loop — LOOP-STATE（栞）

> 毎回これを最初に読む → current_phase を判定 → 1チャンクだけ進める → ここと CSV を書き換える。

- **current_phase**: DONE（Phase 4 満了 → ループ停止 2026-06-13）
- **iteration**: 4 完了（全フェーズ完了）
- **last_updated**: 2026-06-13
- **synced_to**: origin/main c2993aa (v362)
- **canon**: `docs/qa/feature-stories.csv`（単一正典）
- **⚠ 未コミット / 未 push（user 号令待ち）**:
  - `band-room.js` — `getCurrentMode` test hook（QA fix）
  - `docs/qa/*` — 新設 canon（CSV / LOOP-STATE / QA-LOOP）
  - `docs/autonomy/SESSION-LEDGER.md` — 要約追記
  → push は **号令まで保留**。band-room.js を商品反映するなら別途 br-N cache bump + PR が要る
    （今回は test-only hook ゆえローカルでは未 bump）。

## 1 周（FM/BR 5 ストーリー）の結果

| Phase | 結果 |
|---|---|
| P1 story化 | FM-01〜04 + BR-01 起票（5件） |
| P2 実走 | stack-check 0 BAD。FM-02/03/04/BR-01 機能 PASS。FM-01=headless stall（engine/preview 疑い・要実機） |
| P3 修正 | BR-01 testability fix（band-room.js に getCurrentMode hook）。engine.js 不接触・0 BAD |
| P4 再テスト | getCurrentMode が stems→synth→stems を正しく追従（pass）。機能層 agent 完了 |

## 人間へ上げる（human_gate=yes / agent で done にしない）

- **FM-03**（audio runtime トグル）/ **FM-04**（40HZ）/ **BR-01**（原音 vs AI 出音・teardown）
  の **鳴り・聴感** は人間判定。
- **FM-01**: headless で START→playing に到達せず stall（cross-origin Script error.）。
  engine.js startPlayback 領分 + preview 限定の疑い → **実機での確認が必要**（agent で fix しない）。

## 次に再開するなら

- 新しい 1 周を回すなら current_phase を 1 に戻し、別サーフェス（listen / index / 他 fm・band 機能）で
  3〜5 件を新規 story化。depth.html は main に来たら対象化。
- まず user が WIP（docs/qa + band-room.js hook）をレビュー → 号令で commit/push。
