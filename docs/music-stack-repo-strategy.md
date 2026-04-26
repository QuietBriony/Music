# Music Stack Repo Strategy

この文書は、Music関連repo群の役割分担と今後の統合方針を固定するための運用ガイドです。  
本方針は実装前提ではなく、まずは文書化を完了して各レイヤーの責務を固定します。

## 1. Music stack 全体方針

1. 全repoを単一repoに統合しない。  
   - 役割の異なる実装を1箇所に詰め込まず、運用・実験・参照を分離する。  
   - Musicを核にしつつ、非連携領域はそれぞれのrepoで維持する。

2. `docs/schema/reference` の思想は統合する。  
   - 参照→抽象化→変換の考え方（reference-driven）を共通原則として共有する。  
   - 参照素材の再利用は「コピー」ではなく「設計パラメータ化」を前提とする。

3. runtimeは役割別に分離する。  
   - `Music` / `drum-floor` / その他experimental runtimesは、共通目的であっても別runtimeとして定義し、相互の無闇な依存を避ける。  
   - 共有するのは仕様・概念・判定ルールまで。

4. 音源・サンプル・歌詞は保存しない。  
   - 著作権や配布リスク、容量膨張を避けるため、実装ソースに含めない。  
   - 既存資産に依存する場合は参照先を明示し、プロダクションパラメータへ変換する。

5. Apple Music等のreferenceは、production parametersへ変換する。  
   - 既存曲の直接移植や複製を行わない。  
   - テンション/密度/エネルギー/リズム傾向などの実装可能値へ落とし込む。

## 2. 各repoの役割

### Music

- 役割: **Reference-Driven Generative Rig**  
- 役割説明: Aphex / Autechre / Burial / Boards of Canada / OPN などの参考思想を、音源やサンプルをコピーせず `production parameters` に変換して実験する中核。
- 位置づけ: 主要受け皿（runtimeの基準点）。  

### drum-floor

- 役割: **Band Groove Generator**  
- 役割説明: vocal / bass / guitar 入力からドラムグルーヴを生成する実験。  
- 取り扱い領域: rock / mixture / shout / hip-hop / breakbeat。  
- 位置づけ: Musicとは別runtimeとして育て、参考・実験成果を共通ドキュメント化。

### namima

- 役割: **Public-friendly Ambient Player**  
- 役割説明: 昼・家族・水面・軽い・流しっぱなしの用途向けプレイヤ体験を担う。  
- 位置づけ: Musicで安全化・検証された要素のみ移植。  

### chill

- 役割: **namima吸収 or ultra-light chill player候補**  
- 役割説明: 軽量UI/雰囲気要素の保全候補。  
- 位置づけ: 現時点では archive candidate として扱い、吸収可能性を継続評価。

### namima-lab

- 役割: **namima実験場（または回収後archive候補）**  
- 役割説明: 実験的差分・派生音色・構造的アイデアの検証土台。  
- 位置づけ: music stack の実験ノートとして扱い、採用可能な要素のみ吸収対象とする。

### hazama

- 役割: **visual / conceptual reference only**  
- 役割説明: 視覚・世界観・物語的方向性を供給する参照空間。  
- 位置づけ: runtime統合は行わない。

### test

- 役割: **active purposeが定まるまで archive candidate**  
- 役割説明: 運用観点・差分検証用途として保持。  
- 位置づけ: 明確なactive purposeがなければ archive 判定対象。

## 3. 統合ルール

- 音源ファイルを移植しない。  
- 著作権物/サンプル/歌詞を保存しない。  
- 再利用可能なものは以下に限定する。  
  - docs  
  - concepts  
  - production translation  
  - rhythm rules  
  - UI concepts  
  - preset ideas  
- runtime codeは無検証で移植しない。  
- `engine.js` はMusicの安定性を最優先し、必要最小の範囲で扱う。  
- `drum-floor` は `Music` とは別runtimeとして継続育成する。

## 4. 開発ロードマップ

### Phase 1

- Musicにstack strategyを固定する。  
- reference-driven-rig方針をdocs化する。  
- `references/apple-music-refs.json` を整備する。  

### Phase 2

- drum-floorをband groove generatorとして再定義する。  
- vocal / bass / guitar input profile schemaを作る。  
- rock mixture / shout / nerdy hip-hop / breakbeat の style profiles をdocs化する。  

### Phase 3

- namimaを表版 ambient player として整理する。  
- Musicで安全化された要素のみ移植する。  
- chill / namima-lab / test の吸収・archive 判断を行う。  

### Phase 4

- Musicは録音レビュー駆動で IDM / field-murk を継続する。  
- drum-floorは人間演奏向けgroove生成を継続する。  
- namimaは public-friendly版として安定化する。  

## 5. Codex運用

### Codex 5.3

- docs / JSON / README / archive notice / small safe PR を担当。  
- 文書整備・命名統一・差分サイズ抑制を優先。

### GPT-5.5 high / xhigh

- 音響設計、engine統合、録音レビュー反映、複数repo方針判断を担当。  
- 複数技術領域を跨る大きな判断を実行。

### Codex Cloud

- docs-only や確定済み小修正を担当。  
- 既定方針の維持と軽微調整に限定。

### Codex App local

- 音を鳴らす・録音する・`engine.js` を触る作業を担当。  
- 実機再現性や動作検証を伴う変更のみ実行。

## 6. 作業ルール（実施順）

- mainに直接commitしない。  
- `origin/main` から分岐したbranchで作業する。  
- docs-only変更に限定する。  
- `engine.js` を触らない。  
- `index.html` を触らない。  
- `style.css` を触らない。  
- audio filesを追加しない。  
- dependenciesを追加しない。  
- `.github/workflows` に触らない。  

## 7. 参照リスト

- 対象repo  
  - Music  
  - drum-floor  
  - namima  
  - chill  
  - namima-lab  
  - hazama  
  - test
