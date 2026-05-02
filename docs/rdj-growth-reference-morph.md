# RDJ Growth / Reference Morph

## Purpose

`RdjGrowthState` は Richard D. James 周辺をコピーするための層ではありません。参照から抽出した `playful wrongness`, `rubber motion`, `toy-like memory`, `micro edit`, `beautiful restraint` を、Music runtime の既存発音へ弱く渡すための production parameter です。

曲名やアーティスト名は `references/apple-music-refs.json` の分析メタデータに留め、preset 名、runtime symbol、音色名へ直接持ち込みません。

## Reference Morph

`ReferenceMorphState` は `test` の一本フェーダー的な style blend 思想を直コピーせず、Music 内部の色へ翻訳します。

- `haze`: 霞んだ空間、field-murk、air floor。
- `broken`: 局所的な崩し、texture scar、短い edit。
- `pulse`: 低域を増やさない推進力、acid trace、chain。
- `void`: mute ではなく、空気と残響に変える余白。
- `chrome`: glass、voiceDust、明るすぎない透明粒。
- `organic`: memoryPluck、reedBuzz、身体性のある揺れ。

## RDJ Growth Parameters

- `toy`: 変な可愛さ。`memoryPluck` や短い glass に少しだけ出る。
- `rubber`: 伸び縮みする身体感。`lowBreath`, acid trace, cold pulse に弱く効く。
- `wrong`: 予測から少し外れる感じ。kick / bass ではなく broken texture と odd logic 側へ逃がす。
- `tender`: やわらかい変さ。air, voiceDust, glass tail を前に出しすぎず支える。
- `edit`: micro cut と短い傷。`brokenTexture` や odd logic の局所イベントに効く。
- `restraint`: 美しい抑制。cooldown、`silenceDebt`、eventLoad guard を強める方向に働く。

## Runtime Contract

公開確認用の状態は以下です。

```js
window.MusicRuntimeState.referenceMorph
window.MusicRuntimeState.rdjGrowth
window.MusicRuntimeState.signatureCells.conductor
```

UI は増やしません。聴感レビューでは console の値を見ながら、音色が増えても密度で押していないかを確認します。

## Listening Gate

成功:

- 変な可愛さや編集感はあるが、既存曲の引用には聞こえない。
- `memoryPluck` は旋律ではなく、戻ってくる記憶点として聞こえる。
- `wrong` / `edit` が高い時も kick / bass の床は壊れない。
- conductor が `listen` を挟み、セルが喋りすぎない。
- `VOID` は無音ではなく空気になる。

失敗:

- 参照名を知っている人だけに伝わる引用っぽさになる。
- 音数で押してしまい、10分以上で疲れる。
- texture と glass が hi-hat 的な連打になる。
- `toy` が強すぎて曲全体が軽くなる。
- `restraint` が足りず、eventLoad が高いまま戻らない。
