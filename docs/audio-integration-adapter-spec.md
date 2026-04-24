# Audio Integration Adapter 契約

この文書は、Music側で他repo音源を取り込む際の最小インターフェースを固定します。  
実装前に「何を返し、何を受け取り、何を許容するか」を明文化します。

## 0. 前提

- Music本体は既存UI (`index.html` / `engine.js`) から直接大改修しない前提で進める
- 音源側は原則 `AudioEngine` オブジェクトとして提供
- 音源未接続/サンプル不足でも、起動やUIは停止しないこと

## 1. 契約対象

- `AudioEngine`（window 参照）
- 主要コール:
  - `start()`
  - `updateEnergy(value)`
  - `updateStyle(styleLabelOrRatio)`
  - `onTap(x, y?, intensity?)`
  - `stop()`（任意）

## 2. start()

### 署名
- `start(): Promise<void>`

### 仕様
- 呼び出しはユーザー操作（クリック/タップ）経由を前提にする
- `Tone.start()` 呼び出しを内部で行う
- 音源初期化は例外吸収で、全体クラッシュを起こさない
- 初回呼び出しで一度だけ初期化
- 再入可能（多重呼び出しは無害）

### 合否条件
- 解決: 音源初期化が完了し、`started == true` 相当状態になる
- 失敗: 外部要因（デバイス禁止等）の場合、ログのみ残して再試行可能状態を保つ

## 3. updateEnergy()

### 署名
- `updateEnergy(value: number): void`

### 仕様
- 入力値: `0..1` を期待（Music側からはクランプして渡す）
- `filter`/`reverb`/`gain` などに対して滑らかな変化（`rampTo`等）
- 連打・高頻度更新でも例外を投げない

### 期待副作用
- 値増加で開口/明るさ/音量が増加する方向に収束（実装の色味は自由）
- 値減少で過度な突発変化が起きないこと

## 4. updateStyle()

### 署名
- `updateStyle(style: string | number | null): void`

### 仕様
- `style` は文字列/数値どちらでも受ける
- 文字列: `"ambient"|"lofi"|"chill"|"techno"|"psytrance"|...`
- 数値: 0〜1 または 0〜100 の連続値（ノーマライズ可）
- 既知値以外時は現状維持（fallback）
- 変更は副作用を最小化し、連続操作のたびに急変しない

### 備考
- `test` 系の style blend を受ける際、最短ルートは離散アーキタイプとして内部マッピング

## 5. onTap()

### 署名
- `onTap(x: number, y?: number, intensity?: number): void`

### 仕様
- 第1引数は座標比率または正規化値とみなす（0〜1）
- `x`/`y` がない実装でも安全に処理できること
- 連続入力ではイベントデバウンスまたは速度制御を実装内で吸収
- 未開始状態は無害に無視、または開始要求を伴う安全パスを持つ

## 6. stop()

### 署名
- `stop(): void` （任意）

### 仕様
- 停止時はトランスポート/ノードを停止し、再開可能な状態へ
- 未実装でも `start()` が再入可能なら問題なし（非必須）

## 7. iOS/モバイル制約

- 自動再生は不可：`start()` への直接ユーザー操作必須
- タッチ時は `touchstart` / `pointerdown` などのイベントを起点
- iOS SafariのAudioContext復帰失敗時は再試行UIを想定（音を鳴らそうとして失敗してもクラッシュしない）
- `start()` 未完了時に `onTap` や `updateEnergy` が先行しても安全

## 8. 外部サンプル未接続時の挙動

- `samples/` が存在しないケースを想定して処理を分岐
- `safePlay` 系（存在判定/例外吸収）で再生を破綻させない
- サンプル不在でもシンセ/ノイズ/空間系で最低限のプレイ感を維持
- 何も鳴らないこと自体は「失敗」ではなく「降格動作（graceful degrade）」として扱う

## 9. 非対応・禁止

- `engine.js` / `index.html` / `style.css` の同時大量変更を前提にしない
- ここを満たさない実装は導入対象外
- 設定値ハードコードを増やすのは最小単位原則に反する

## 10. 合否サンプル（簡易）

成功（PASS）:
- `start()`→`updateEnergy(0.7)`→`updateStyle("ambient")`→`onTap(0.5,0.5,0.6)`でも例外なし

失敗（FAIL）:
- `onTap` が未開始状態で落ちる
- `updateStyle("unknown")` が例外を投げる
- サンプル未接続で再生処理が停止・例外を引き起こす

