# Music Stack 統合ロードマップ（実装前版）

この文書は、Music統合を始める前に、参照・移植・運用の約束事を固定するための実装前ガイドです。  
実装は本roadmap外の別PRで段階実施します。

## 0. 現在地

- `engine.js` は Music の安定版v1 groove engineとして段階的に更新済み。
- 以後の音作りPRは、`runtime-stability-checklist.md` のSTART/STOP、AutoMix、長時間再生、texture/glass音量確認を通す。
- 本文書の「実装前」記述は統合判断の基準として残し、実装変更は小〜中規模PRで分離する。

## 1. 統合対象

対象repo（評価対象）:
- namima
- namima-lab
- test
- chill
- drum-floor（運用参照）

既定方針:
- Musicは統合先（受け皿）
- namima / namima-lab / test / chill は機能差分の移植候補
- drum-floor は実装移植なし。運用ノウハウ参照のみ

## 2. 統合順（固定）

### Phase 0: 契約固定
1. `docs/audio-integration-adapter-spec.md` を確定する  
2. 運用監視観点を `operational-rules-from-drum-floor.md` に収束  
3. いずれの実装PRも1ファイル or 1モジュールごとに分離

### Phase 1: namima（最優先）
- 目標: Musicで既存のUIに触らず、音源制御の再利用を試す
- 対象候補: `namima/audio.js` の `start / updateEnergy / onTap` 的挙動
- 成功条件: 起動、音割れなし、START後の体感制御が成立
- 注意点: iOSユーザー操作起動制約と既存`Tone.Transport`との競合防止

### Phase 2: namima-lab（選別導入）
- 目標: 2系統のみ比較導入して音色設計を評価
- 優先順:
  1. `a-min-v2`（低リスク・音色の連続性が高い）
  2. `a-min-v3`（位相/エネルギー状態モデル）
  3. `a-min` は参照のみ
  4. `a-min-v4` は現時点では未導入（参照は可）
- 成功条件: v2/v3の差分がMusic側UIと噛み合い、負荷劣化を誘発しない

### Phase 3: test / chill（限定的導入）
- 目標: Musicの既存構造に「壊さない」形で
- test:
  - スタイル変化ロジック（styleアーキタイプ）とラベル系
- chill:
  - UI/ビジュアル断片（入力UI設計）を必要最小で参照
- 成功条件:
  - 実装差分が1PRで回収可能
  - 既存Music構成を壊さない

### Phase 4: drum-floor（ドキュメント化完了）
- 目標: 実装移植はしない
- 対象: `Limiter優先`, `CPU退避`, `ステージ運用`
- 成果: 運用規約としてMusic側に反映

## 3. DoR（Definition of Ready）

- 受け入れ前提
  - 統合対象repoの読了と主要ファイル把握が完了していること
  - `audio-integration-adapter-spec.md` が合意済みであること
  - 参照予定のサンプル/外部リソース有無が明示されていること
  - 本文書の「統合順」と「未統合リスト」がレビューされていること
  - PRはdraft前提、変更範囲が明確（1PR 1目的）

## 4. DoD（Definition of Done）

- 追加した文書がmainに向けてレビュー可能
- 実装変更を含まず、次段の実装PRにそのまま接続できる
- 各統合候補に「実装責務」「停止条件（何もしないか）」が明記されている
- 1回のPRに複数テーマを混在させない

## 5. 成功判定基準（実装前評価）

- 音源安全性
  - クリップ/歪みがなく連続再生可能
  - 起動後に過度の無音・ハングが発生しない
- CPU/パフォーマンス
- タイマー/jank/jitterの発生頻度が上昇しない
- 起動性
  - 初回 START で例外フリーズせず再生可能
- モバイル
  - ユーザー操作起動条件を満たし、連続タップでも暴走しない

## 6. 確認観点（必須）

### 音割れ
- ピーク値が高水準時のLimiter効果有無
- レベル過多時のノイズ有無
- レイヤー増加時の歪み有無

### CPU
- フレーム落ち/タイマー遅延の兆候
- 連続再生10〜15分後の状態
- エフェクト負荷時のノード数変動

### 起動性
- 初期化完了時間
- 再生開始までの例外率
- モジュール未接続時のフォールバック安定性

### モバイル操作
- タッチ開始時の再生許可条件
- 連打時の重複トリガ耐性
- 画面回転・resize時の復旧挙動

## 7. 今回統合しないもの（keep as-is）

- `drum-floor` のVCVパッチ実装（拡張計画で別管理）
- test/chill の全体一括merge
- サンプル素材の新規追加・再取得
- `Music` の既存 `index.html / engine.js / style.css` への無計画な一括改修
- repository設定変更（archive/delete/settings）

