# Runtime Stability Checklist

## Purpose
- 音声エンジンの長時間実行時の安定性を毎回同じ手順で検証する。
- 変更前後で `START`/`STOP`、`AutoMix`、UI 操作、コンソール状態を比較し、再現性のある判断材料を残す。

## Pages確認URLの使い方
- 既定: `https://quietbriony.github.io/Music/`
- PR確認時は `?v=<pr>` を付けて検証対象を固定（例: `https://quietbriony.github.io/Music/?v=pr11`）。
- 1回の確認で `キャッシュ強制更新` を実施し、同一URLを使い回す。

## START / STOP確認
1. ページ読み込み後、`START` を押して再生音が出ることを確認。
2. しばらく再生後、`STOP` を押して音が止まることを確認。
3. 立ち上がり直後に異常な待ち時間や固まりがないかを目視。
4. `START` → `STOP` → `START` を少なくとも2〜3回繰り返す。
5. `mode` 表示 / BPM表示 / UI反映が再開後に自然かを確認。

## 3分/10分放置確認
- `AutoMix OFF` と `AutoMix ON` をそれぞれ3分と10分の観点で実施。
- 3分で問題なく音が継続するかをまず確認し、10分に進む。
- 10分経過後、
  - 無音化（再生中に音が止まる）
  - UI固まり（slider が追従しない、CPU高）
  - コンソール赤エラー
  の有無を確認。

## AutoMix OFF / ON確認
- AutoMix OFF: `auto_toggle` がオフの状態で3分以上再生。無音化・固まりが起きないか。
- AutoMix ON: `auto_cycle` の値を短め（2〜3分）/中（5分）/長（10分）で切り替え、安定性を比較。
- いずれでも `STOP` 時に `timer` が残留しないかを目視。
- `START/STOP` を複数回挟んだ際の再開挙動を同条件で比較。

## Energyフェーダー高速操作確認
1. `Energy` の slider を急速に上下させる。
2. BPM/表示/UI が追従し、反対方向に逆走しないことを確認。
3. 指を離した直後に音が固まらず、ノイズが突然増幅しないことを確認。
4. Energy以外の縦／横 slider でも同様の逆方向操作を確認。

## Consoleで見るエラー
- `F12` の Console を開き、次を継続監視。
  - 赤字（赤エラー）
  - 例外: `Uncaught`, `TypeError`, `ReferenceError`
  - `AudioContext` / `Tone` に関する警告
- 1分〜3分間隔で状態ログを観測し、変化点とユーザー操作を紐づける。

## Tone.Transport / AudioContext の見る項目
- `Tone.Transport.state`
  - 再生中は `started` を期待（環境依存で `running` 系）
  - 無音化時に `stopped`/`paused` 相当ではないかを確認
- `Tone.context.state`
  - `running` 継続を確認
  - `suspended` に落ちた場合、watchdog/再開挙動が働いているか
- `Tone.Transport.seconds` が停止後も暴れる・戻る場合の有無
- 主要ノード（Gain/Filter/Delay/Reverb）状態は UI で値変化し過ぎないか

## PR merge前 / merge後の確認
- merge前: 現在版と比較してチェックリストの全項目を実施。
- merge後: 同じ手順を実施し、
  - 変更点影響が限定的
  - 回帰がない
  を確認。
- 片方だけ実施し、もう片方を省略しない。

## Fail時の次アクション
- まず停止条件を切り分ける。
  1. AutoMix OFF でも再現するか
  2. `Tone.context.state` が `suspended` か
  3. `updateUCM` / `applyUCMToParams` 呼び出し頻度が極端に増えていないか
- 併せて以下を記録して次PRに回す。
  - 再現手順
  - 再現時刻（経過時間）
  - Console ログ
  - 直前のユーザー操作（AutoMix ON/OFF、slider 操作）
- 音が止まる/固まる現象は「再生停止不具合」として独立チケット化。
