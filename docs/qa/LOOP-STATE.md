# QA Loop — LOOP-STATE（栞）

> 毎回これを最初に読む → current_phase を判定 → 1チャンクだけ進める → ここと CSV を書き換える。

- **current_phase**: IDLE（round1 = 完了/shipped #366・round2 = listen/index カバー完了。次の指示待ち）
- **canon**: `docs/qa/feature-stories.csv`（単一正典・現在 8 ストーリー）
- **synced_to**: origin/main 0d6c324（#366 merge・本番 deploy 済）

## カバレッジ

| surface | ストーリー | 状態 |
|---|---|---|
| Hazama FM (fm.html) | FM-01〜04 | 機能 PASS（FM-01 START は headless stall=要実機） |
| Band Room | BR-01 | 機能 PASS（mode 切替・getCurrentMode hook 追加） |
| Listen (listen.html) | LS-01, LS-02 | 機能 PASS（ハブ nav 21 link・genre 深リンク7種） |
| Core Rig (index.html) | IX-01 | 機能 PASS（Tone+engine+4 controls load・console error 0） |
| depth.html | — | main に無い（sibling branch）→ N/A |

## ラウンド履歴

- **round1（/loop dynamic, P1-P4）**: FM 4 + BR 1 を story化→実走→BR-01 testability fix→再テスト。
  PR #366 で merge + 本番 deploy 済（Pages 自動ビルド取りこぼし → `gh api POST pages/builds` で再ビルド強制）。
- **round2（手動「できる分進めて」, 2026-06-24）**: listen.html + index.html を story化(LS-01/LS-02/IX-01)
  + 実走テスト。**全機能 PASS・不具合 0・fix 不要**。listen は純ハブ(script 無し)、index は Core Rig
  load まで（playback は engine/preview 領分で要実機）。

## human へ上げる（agent で done にしない）

- FM-03/FM-04/BR-01 の鳴り・聴感、FM-01 と index(Core Rig) の **START→playing は実機確認が必要**
  （headless preview では engine startPlayback が stall する）。

## 次に再開するなら

- 新ラウンド: fm/band-room の未カバー機能（shuffle / DJ set / mic follow / AI fill / preset 等）や
  band-room の mix/preset を story化。または FM-01/Core Rig の START stall を実機 or 非 headless で検証。
- ルール: 作業前 `git pull --ff-only`、engine.js は read-only、UI 触れば cache buster 3点同期、
  音は human_gate=yes。
