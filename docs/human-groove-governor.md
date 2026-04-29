# Human Groove Governor

## Purpose

Human Groove Governor は、Music runtime に「人間が気持ちよく聴ける崩れ」を足すための薄い制御層です。  
新しい音源やサンプルではなく、既存の `engine.js` が持つ確率、microtiming、密度、粒度を補正します。

狙いは、完全なグリッドでも完全なランダムでもない状態です。

- kick / bass は床として残す
- hat / glass / texture は短い相関を持って揺れる
- 複雑さが上がりすぎた時は密度を増やさず、休符と空気で修復する
- フィボナッチ / 黄金比は美しさの証明ではなく、周期の衝突を避ける位相分散として使う

## Research Notes

- Kaplan et al. 2023: microtiming は記譜できない細かい timing だが、聴き手は平均と分散を暗黙に識別できる。  
  https://www.sciencedirect.com/science/article/pii/S001002772300166X
- Witek et al. 2014: groove では中程度の syncopation が「動きたい」「気持ちいい」を最大化しやすい。  
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0094446
- Sogorski et al. 2018: 人間演奏の timing は短期の microtiming と長期の tempo 変化に分けて考えられる。  
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0186361
- Colley and Dean 2019: 1/f 的な自然さは、無限の長期相関ではなく、複数の短い lag の重なりでも生まれる。  
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0216088
- Nature Communications 2024: 音楽の 1/f 的構造には cutoff があり、無限に続く相関として扱わないほうが安全。  
  https://www.nature.com/articles/s41467-024-53155-y
- Kramer 2022 / Phillips 2019: golden ratio は理論的・分析的には使えるが、聴感上の必然や美の根拠として断定しない。  
  https://arxiv.org/abs/2111.09953  
  https://www.tandfonline.com/doi/abs/10.1080/10400419.2019.1651243

## Runtime Contract

`audio/human-groove-governor.js` は `window.HumanGrooveGovernor` を公開します。

- `reset()`
- `advancePhrase(context)`
- `shapeStep(context)`
- `getState()`

`advancePhrase()` は小節単位の状態を更新します。

- `collapse`: 自然な進行が崩れそうな量
- `naturalness`: グリッドとランダムの中間に留まれている量
- `density`: 発音密度の目安
- `grain`: 細かい粒の目安
- `syncopation`: 拍から外れる複雑さ
- `repair`: 複雑さを間引いて修復する量
- `jitterMs`: role ごとの上限に渡す microtiming 量
- `phiPhase`: 位相分散用の黄金比ベース phase

実スケジューリングでは、Tone.js の callback 時刻より前に発音予約できないため、microtiming は「早める」のではなく 0ms から role 上限までの相対遅延として畳み込みます。聴感上は粒同士の相対差を作り、kick / bass の床を崩さないことを優先します。

`collapse` は正規化済み入力から以下で計算します。

```text
creation*0.30 + wave*0.24 + resource*0.20 + micro*0.16 + chaos*0.14
- circle*0.18 - observer*0.12 - void*0.10
```

## Listening Criteria

成功:

- 崩れた粒が machine-gun 的に連射されない
- kick / bass の床が消えない
- `CULT=BROKEN` でも粒が聴けるが、密度が飽和しない
- `CULT=HAZE` では空気と余白が残る
- `VOID` は無音ではなく、発音の間に空間が開く
- `window.MusicRuntimeState.humanGroove` で `repair` が上がる場面では、聴感上も密度が少し整理される

失敗:

- high creation / high resource で常に同じ 64n 連打に聴こえる
- kick / bass が微細粒に押されて床がなくなる
- `collapse` が上がった時に output が詰まり、`MixGovernorState.eventLoad` が飽和する
- 黄金比由来の周期が耳で分かるほど露骨に反復する

## Review Workflow

1. `node --check audio/human-groove-governor.js`
2. `node --check engine.js`
3. local static server で `index.html` を開く
4. `START`、`AUTO MIX`、`CULT=BROKEN/HAZE`、`IDEA=AUTO` を確認
5. 5分以上聴き、`window.MusicRuntimeState.humanGroove` を見る
6. 必要な時だけ m4a 録音で milestone 比較する
