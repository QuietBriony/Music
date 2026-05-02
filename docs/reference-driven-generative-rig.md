# Reference-Driven Generative Rig

## 1. 定義

Reference-Driven Generative Rig とは、既存曲を「コピー対象」として扱わず、  
**リファレンスの制作上の意思だけを抽出して** Music の再生エンジン向けに再設計する思想です。  
最終目的は、`engine.js` を壊さず、長時間再生と録音レビューが回る安全な生成ルートを維持することです。

Music repoは「再生のための素材配布庫」ではなく、  
制作変換の実験基地として運用します。

## 2. 基本方針

- Apple Music等のリファレンスは「コピー元（原音）として保存」しない。  
- `曲名 / artist / album / genre_hint / taste_notes / 制作変換メモ` のみを保存する。  
- `audio`, `samples`, `lyrics`, 配布不可素材を保存しない。  
- 参照は `references/apple-music-refs.json` に集約し、採用判断は production parameter としてのみ行う。  
- 音色・空間・リズム・構造を parameter 群に落とし込んでから、UI/録音ループで検証する。  
- 収束不能な直接模倣より、収束可能な再現要素（パラメータ）だけを `Music` へ持ち込む。

## 3. 参照曲の取り扱い

### 保存するもの

- `artist`
- `title`
- `album`（確定できるもののみ）
- `genre_hint`
- `taste_notes`（主観）
- `production_translation`（`timbre / rhythm / space / structure / gesture / wrongness / restraint`）
- `implementation_notes`

### 保存しないもの

- 音声データ本体（`*.mp3`, `*.m4a`, `*.wav` 等）
- サンプル名・波形情報・stem
- 歌詞や翻訳
- 外部URL（Apple Music URL / preview URL）
- 配布リスクのある直接素材

### 目的を再確認

- 目的は「聴感の方向性を parameter 化」すること。  
- 目的は「既存曲を忠実再現」することではない。  
- 生成は Music 側の `recorder` と `review loop` の結果で進化させる。

## 4. reference → production parameters の流れ

1. **reference intake**  
   参照曲を決め、`artist/title/album/taste`を簡易記録する。  
2. **translate**  
   `timbre / rhythm / space / structure / gesture / wrongness / restraint` を要点だけ抽出する。
3. **preset idea**  
   抽出項目を `presets` または実験ノートへ落とし、最小差分で適用可能な形にする。  
4. **m4a record**  
   Music のページで `m4a` 録音し、再生状態を保存する。  
5. **review**  
   録音結果を聴取し、どの parameter が有効だったかを更新する。  
6. **small PR tuning**  
   各調整は小PRとして分離し、実装影響を最小化する。

## 5. Music / drum-floor / namima の関係

- **Music**  
  experimental IDM / field-murk / playful wrongness 系の参照変換を継続する中核。
  ここは `runtime stability`, `master limiter`, `bassBus保護` を最優先にする。

- **drum-floor**  
  **band groove generator** として独立運用。  
  実装移植は避け、運用と groove 構造の知見のみ参照する。

- **namima**  
  public-friendly な ambient player 方向の補助リポジトリ。  
  Music 側に安全化された要素だけを段階導入する。

## 6. 安全ルール（今回PRで固定）

- `audio files` 追加禁止  
- `samples` 追加禁止  
- `lyrics` 追加禁止  
- 外部依存追加禁止  
- docs/reference PRでは `engine.js` 編集をしない  
- `.github/workflows` は変更しない  
- 実装PR前提の一括統合は行わない（観測 + 小PRで進める）

## 7. 参照運用（最小実務ルール）

- 1回のPRで扱う preset 変更は必要最小にする。  
- 複数曲参照を追加する場合は、まず `references/apple-music-refs.json` のみ更新し、  
  音響反映は別PRで行う。  
- 録音レビューは実運用ループとして扱い、結果は `taste_notes` / `implementation_notes` に反映する。  
- 参照が増えても、`Music` の既存再生安定性を崩さないことを優先。
- Richard D. James / Autechre / Boards of Canada / Burial / OPN / FSOL 系の参照は、名前や曲想をruntimeへ移植せず、`toy`, `rubber`, `wrong`, `tender`, `edit`, `restraint` や `haze`, `broken`, `pulse`, `void`, `chrome`, `organic` へ抽象化して扱う。

## 8. 用語

- **reference-driven**: 参照を設計入力に変換して生成品質を上げること  
- **translation**: 聴感上の特徴を `value`（数値/閾値/比率）として扱える形式に落とすこと  
- **preset idea**: 実機検証前の仮説としてのパラメータ構成  
- **safe PR**: Start/Stop/AutoMix/recorder に影響しない最小差分更新
