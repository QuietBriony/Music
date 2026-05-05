# Autonomous Reference Evolution

## Intent

`ProducerHabitState` は、Aphex/RDJ や参照作家の音をコピーする層ではない。

参照から拾うのは曲、メロディ、コード、サンプル、構成ではなく、制作判断です。Music runtime ではそれを次のような抽象パラメータへ翻訳する。

- `tenderMemory`: 戻ってくる短い記憶点
- `dryGrid`: 乾いた短い grid / scar
- `ghostPressure`: 低域を壊さない圧の気配
- `transparentVoid`: 無音ではなく空気として残る VOID
- `rubberEdit`: 少し曲がる micro edit
- `beautifulRestraint`: 面白い音より先に間を守る抑制

## Runtime Shape

実装は `engine.js` 内部の小さな phrase-level state として置く。

- `advanceProducerHabits(context)` は `advanceGrooveStructure()` から呼ばれる。
- 直接発音は増やさない。
- 既存の `genreTimbreKits`, `timbre family`, `signatureCells`, `rdjGrowth`, `referenceMorph`, `humanGroove` に小さな bias を渡す。
- `window.MusicRuntimeState.producerHabits` で `mode`, `habits`, `restraintBudget`, `risk`, `lastMutation` を確認できる。
- `selfReview.governor` は、密度/低域/明るさリスクが高い時に音数を増やさず `lowMidClean`, `tail`, `silenceDebt`, `spaceKit` へ小さく逃がす。

## Risk Model

`producerHabitRiskSnapshot()` は taste を証明しない。事故を早めに見るための proxy です。

- `density`: eventLoad、human groove density、signature silence debt
- `bright`: techno/chrome/pulse/particle の出すぎ
- `low`: pressure/sub/punch/lowGuard の出すぎ
- `hook`: memoryPluck や motif memory が旋律化しすぎる危険

リスクが高い時、runtime はイベント追加ではなく `listen`, cooldown, air, low-mid cleanup, restraint を優先する。

## Listening Review

確認すること:

- low energy では haze / air / memory が主役で、grid が前に出すぎない。
- mid energy では memoryPluck や glass particle が短い記憶点として戻る。
- high energy では hat/grid/texture が立つが、bright EDM 化しない。
- PUNCH は body snap で、bassBus や sub が主役にならない。
- VOID は mute ではなく、空気と tail と低域整理になる。
- 10分以上で、面白さより先に間が戻る。

禁止:

- 参照曲の recognizable riff / melody / chord / sample-like hook
- 新規サンプル、音声ファイル、歌詞、外部依存
- UI 追加や OUTPUT / recorder / master routing の変更
