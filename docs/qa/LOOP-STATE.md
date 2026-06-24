# QA Loop — LOOP-STATE（栞）

> 毎回これを最初に読む → current_phase を判定 → 1チャンクだけ進める → ここと CSV を書き換える。

- **current_phase**: IDLE（round1 shipped #366 / round2 #8c77e5e / round3 完了。次の指示待ち）
- **canon**: `docs/qa/feature-stories.csv`（単一正典・現在 **11 ストーリー**）
- **synced_to**: origin/main 8c77e5e

## カバレッジ

| surface | ストーリー | 状態 |
|---|---|---|
| Hazama FM (fm.html) | FM-01〜06 | 機能 PASS（FM-01 START は headless stall=要実機） |
| Band Room | BR-01, BR-02 | 機能 PASS（mode 切替+hook / master preset 6種適用） |
| Listen (listen.html) | LS-01, LS-02 | 機能 PASS（ハブ nav / genre 深リンク7種） |
| Core Rig (index.html) | IX-01 | 機能 PASS（Tone+engine+controls load・error 0） |
| depth.html | — | main に無い（sibling branch）→ N/A |

機能テスト済の FM 機能: START(01) / genre(02) / runtime toggle(03) / 40HZ(04) / shuffle(05) / DJ set(06)。
Band Room: mode 切替(BR-01) / master preset(BR-02)。

## ラウンド履歴

- **round1（/loop P1-P4）**: FM-01〜04 + BR-01。BR-01 testability fix(getCurrentMode hook)。PR #366 merge+deploy。
- **round2（手動）**: listen + Core Rig load（LS-01/LS-02/IX-01）。全 PASS・fix 不要。
- **round3（手動）**: shuffle / DJ set / master preset（FM-05/FM-06/BR-02）。全機能 PASS・**不具合 0・コード変更なし**。
  - BR-02 は playback 不要で完全検証（preset が distinct な mix 値を適用・loudness ≤0 維持）。
  - FM-05/FM-06 は UI/選択状態を検証（status・aria-pressed）。実再生の挙動は human/device。

## human へ上げる（agent で done にしない・残タスク）

- **試聴**: FM-03/04（runtime/40Hz）/ BR-01・BR-02 の出音 / FM-05 shuffle 進行 / FM-06 DJ アーク再生。
- **実機 START**: FM(fm.html) と Core Rig(index.html) の START→playing（headless では engine startPlayback が stall）。
- **ACE-Step デモ試聴 → Band Room 翻訳（BL-029）**。

## 次に再開するなら

- 残る未カバー: FM mic-follow / AI fill（クリックで重い CDN/mic 起動=要注意）、band-room の mix slider/saved-mix、
  preset の synth profile 連動の中身。または FM-01/Core Rig の START を実機/非 headless で検証。
- ルール: 作業前 `git pull --ff-only`、engine.js read-only、UI 触れば cache buster 3点同期、音は human_gate=yes。
