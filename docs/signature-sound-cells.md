# Signature Sound Cells

## Purpose

Signature Sound Cells は、Music runtime に「耳が覚える短い音の癖」を足すための薄い発音層です。

現在の runtime は `ghostGlass`, `lowBreath`, `brokenTexture`, `memoryPluck` の4セル構成です。新しいサンプルや外部依存は追加せず、既存の `glass`, `voiceDust`, `texture`, `pad`, `subImpact`, `reedBuzz`, `drumSkin`, `pianoMemory` を使って、役割ごとの短い出来事を作ります。

狙いは「面白さ = 密度」ではありません。

- たまに戻ってくる癖
- 予告と回収に聞こえる短い応答
- 気持ち悪くなりすぎない控えめな違和感
- 床は信頼できるまま、周辺だけ人格がある状態
- `VOID` でも無音ではなく、空気と残響に変わること

## Runtime Behavior

`engine.js` は内部に `SignatureCellState` を持ちます。

- `phrase`
- `phraseCycles`
- `motif`
- `nextMotif`
- `blend`
- `cooldownSteps`
- `intensity`
- `lastStep`
- `lowBreathIntensity`
- `lowBreathCooldownSteps`
- `lowBreathLastStep`
- `brokenTextureIntensity`
- `brokenTextureCooldownSteps`
- `brokenTextureLastStep`
- `memoryPluckIntensity`
- `memoryPluckCooldownSteps`
- `memoryPluckLastStep`
- `globalCooldownSteps`
- `conductorMode`
- `nextConductorMode`
- `conductorPhrase`
- `conductorPhraseCycles`
- `silenceDebt`

`advanceGrooveStructure()` が phrase 単位で状態を進め、`scheduleStep()` が各 trigger を呼びます。`conductorMode` は `listen`, `breathe`, `scratch`, `remember`, `open` のどれかになり、セル同士が同時に喋りすぎないよう発火許可を決めます。

公開状態は `window.MusicRuntimeState.signatureCells` です。

```js
{
  active: true,
  flavor: "lowBreath",
  phrase: 2,
  motif: "call",
  intensity: 0.31,
  cooldownSteps: 10,
  lastStep: 132,
  globalCooldownSteps: 4,
  conductor: {
    mode: "remember",
    nextMode: "listen",
    phrase: 1,
    phraseCycles: 5,
    silenceDebt: 0.23
  },
  flavors: {
    ghostGlass: { active: false, motif: "call", intensity: 0.42 },
    lowBreath: { active: true, intensity: 0.31 },
    brokenTexture: { active: false, intensity: 0.27 },
    memoryPluck: { active: false, intensity: 0.22 }
  }
}
```

## Cells

`ghostGlass`:

- 上モノの署名
- wet glass、voiceDust、air bloom を使う
- `call`, `answer`, `scar` の motif を持つ

`call`:

- off-step に短い glass 2音を置く
- 必要に応じて薄い voiceDust を重ねる
- 記憶用に `MotifMemoryState` へ短く残す

`answer`:

- voiceDust と transparent air fragment で返答する
- `VOID` では長めの air bloom に寄せる
- pad は低確率で、空間の輪郭を出す時だけ使う

`scar`:

- collapse、`DRIFT`、`REPEAT` の時だけ有効
- texture と短い glass で細い傷を作る
- cooldown を長めにして machine-gun 化を避ける

`lowBreath`:

- 低域の身体感の署名
- subImpact は短く、reedBuzz と voiceDust は息として薄く使う
- kick / bass の pattern や確率は触らず、床を壊さない
- `VOID` では subImpact を避け、reedBuzz / voiceDust / air に寄せる

`brokenTexture`:

- hat / texture 周辺の壊れ方の署名
- texture、drumSkin、短い glass shard を使う
- collapse、micro、DRIFT、REPEAT、IDM寄りで立ち上がる
- `VOID` では基本的に引き、micro が高い時だけ薄く出す

`memoryPluck`:

- 戻ってくる記憶点の署名
- `pianoMemory` と短い `glass` だけで作り、メロディ主役にはしない
- `GradientState.memory`, `TimbreFamilyState.pianoMemory`, motif memory, `RDJ toy/tender` が高い時に少し出やすい
- `remember` conductor では出やすく、`listen` / 高 eventLoad では止まる

## Zen Conductor

署名セル全体には phrase 単位の指揮役があります。

- `listen`: 前景セルを止め、間を取り戻す。
- `breathe`: `lowBreath` と薄い `ghostGlass` を許可する。
- `scratch`: `brokenTexture` と薄い `ghostGlass` を許可する。
- `remember`: `memoryPluck` と薄い `ghostGlass` を許可する。
- `open`: 複数セルを許可するが、shared cooldown と `silenceDebt` で詰まりを防ぐ。

セルが鳴るたびに `silenceDebt` が少し増えます。借金が高い時は conductor が `listen` を選びやすくなり、“面白い音”より先に“間”を回復します。

## Guardrails

- kick / bass の確率や発音は触らない。
- `MixGovernorState.eventLoad` が高い時は鳴らさない。
- どれか1セルが鳴ったら共有 cooldown を置き、他セルがすぐ重ならないようにする。
- ghostGlass は最低 5 step の間隔を置く。
- gate は 16 step 内で 1-2 箇所に絞る。
- lowBreath は最低 10 step、brokenTexture は最低 7 step、memoryPluck は最低 9 step の間隔を置く。
- 黄金比は motif 選択の位相分散にだけ使い、自然さや美しさの根拠とは扱わない。

## Listening Criteria

成功:

- glass / voiceDust の短い癖が、ときどき戻ってくる。
- 低域がたまに呼吸するが、kick / bass の床は揺らがない。
- texture の傷が短く出て、連打にはならない。
- pianoMemory / glass の短い記憶点が、メロディではなく癖として戻る。
- conductor が `listen` を挟み、セルが続いた後に間が戻る。
- 崩れ場面でも粒が連打にならない。
- kick / bass の床が残る。
- `VOID` が無音ではなく、空気と残響として聞こえる。
- `window.MusicRuntimeState.signatureCells.flavors` の `active` / `intensity`、ghost の `motif`、`conductor.mode` が聴感と対応している。

失敗:

- 常に同じ glass 連打に聞こえる。
- texture の傷が hi-hat 的に鳴り続ける。
- lowBreath が bassline のように前へ出る。
- memoryPluck が旋律として前に出すぎる。
- 複数セルが同じ小節で喋りすぎて、間が消える。
- `eventLoad` が高いのに署名セルが鳴り、全体が詰まる。
- 低域の床よりも細かい粒が前に出る。

## Review Workflow

1. `node --check engine.js`
2. Browser で `START` し、`AUTO MIX` を有効化する。
3. `CULT=BROKEN` / `CULT=HAZE` / `IDEA=AUTO` で5分以上聴く。
4. Console で `window.MusicRuntimeState.signatureCells` を見る。
5. `eventLoad` が高い場面では各 flavor の `active` が無理に張り付かないことを確認する。
6. `window.MusicRuntimeState.rdjGrowth` と `window.MusicRuntimeState.referenceMorph` を見て、toy/wrong/edit が高くても低域の床が壊れていないか確認する。
