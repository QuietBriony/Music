# QA Loop — LOOP-STATE（栞）

> 毎回これを最初に読む → current_phase を判定 → 1チャンクだけ進める → ここと CSV を書き換える。

- **current_phase**: IDLE（round1 #366 / round2 #8c77e5e / round3 #f34ca7f / round4 完了。次の指示待ち）
- **canon**: `docs/qa/feature-stories.csv`（単一正典・**12 ストーリー**）
- **synced_to**: origin/main f34ca7f

## カバレッジ

| surface | ストーリー | 状態 |
|---|---|---|
| Hazama FM | FM-01〜06 | 機能 PASS（FM-01 START stall=headless 由来と確認・要実機） |
| Band Room | BR-01, BR-02, BR-03 | mode 切替(+hook) / master preset / saved-mix 移行(gate-covered) |
| Listen | LS-01, LS-02 | ハブ nav / genre 深リンク |
| Core Rig | IX-01 | load + controls（START は FM-01 同 stall=headless） |

## ラウンド履歴

- **round1（/loop P1-P4）**: FM-01〜04 + BR-01。BR-01 testability fix。PR #366。
- **round2**: listen + Core Rig load。全 PASS。
- **round3**: shuffle / DJ set / master preset。全 PASS・fix 不要。
- **round4（START stall 切り分け + BR-03）**:
  - **DIAG**: FM/Core Rig の START "stall" は **headless 由来と確認**（実バグでない）。根拠: 起動時に
    engine が実際に発音（Max polyphony 警告多数・Mandala ready）/ Tone.start resolve・ctx running・
    失敗 network 無し。stall の実体は recorder + background-bridge の tap が**別 AudioContext** に connect
    して `InvalidAccessError`（engine.js:7337/7342・**caught warning**）+ fm.js の start 完了が headless で
    立たないこと。実機（単一 context + 実ジェスチャ）では user 利用で稼働確認済。
  - **BR-03 saved-mix 移行**: check-band-room-logic（446 assertions）が migratePrefsForCurrentMix を
    網羅 → 重複 preview テスト不要。gate-covered で記録。

## human へ上げる（agent で done にしない）

- **試聴**: FM-03/04・BR-01/BR-02 の出音 / FM-05 shuffle 進行 / FM-06 DJ アーク。
- **実機 START**: FM・Core Rig（headless stall は確認済=preview 由来。実機での再生継続は要確認だが user 利用で概ね OK）。
- **ACE-Step デモ試聴 → Band Room 翻訳（BL-029）**。
- **［engine 領分・report-only］**: recorder(● REC) + 車載 background-bridge の tap が headless で別 context
  `InvalidAccessError`（engine.js:7337/7342）。実機でこれら機能が効くかは FM/engine workstream が要確認
  （preview 限定の可能性が高いが、多 context 化の兆候として記録）。engine.js は当ループ read-only。

## 次に再開するなら

- 残: FM mic-follow/AI fill（クリックで重い CDN/mic=要注意）、band-room mix slider 個別、preset の synth profile 連動中身。
- ルール: 作業前 `git pull --ff-only`、engine.js read-only、UI 触れば cache buster 3点同期、音は human_gate=yes。
