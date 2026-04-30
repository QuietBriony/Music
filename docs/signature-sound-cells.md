# Signature Sound Cells

## Purpose

Signature Sound Cells は、Music runtime に「耳が覚える短い音の癖」を足すための薄い発音層です。

今回の v1 は `ghostGlass` です。新しいサンプルや外部依存は追加せず、既存の `glass`, `voiceDust`, `texture`, `pad` を使って、wet glass / air bloom / 細い傷のような短い出来事を作ります。

狙いは「面白さ = 密度」ではありません。

- たまに戻ってくる癖
- 予告と回収に聞こえる短い応答
- 気持ち悪くなりすぎない控えめな違和感
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

`advanceGrooveStructure()` が phrase 単位で状態を進め、`scheduleStep()` が `triggerGhostGlassSignatureCell()` を呼びます。

公開状態は `window.MusicRuntimeState.signatureCells` です。

```js
{
  active: true,
  flavor: "ghostGlass",
  phrase: 2,
  motif: "call",
  intensity: 0.42,
  cooldownSteps: 1,
  lastStep: 128
}
```

## Motifs

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

## Guardrails

- kick / bass の確率や発音は触らない。
- `MixGovernorState.eventLoad` が高い時は鳴らさない。
- 最低 3 step の cooldown を置く。
- gate は 16 step 内で 1-2 箇所に絞る。
- 黄金比は motif 選択の位相分散にだけ使い、自然さや美しさの根拠とは扱わない。

## Listening Criteria

成功:

- glass / voiceDust の短い癖が、ときどき戻ってくる。
- 崩れ場面でも粒が連打にならない。
- kick / bass の床が残る。
- `VOID` が無音ではなく、空気と残響として聞こえる。
- `window.MusicRuntimeState.signatureCells` の `active`, `motif`, `intensity` が聴感と対応している。

失敗:

- 常に同じ glass 連打に聞こえる。
- texture の傷が hi-hat 的に鳴り続ける。
- `eventLoad` が高いのに署名セルが鳴り、全体が詰まる。
- 低域の床よりも細かい粒が前に出る。

## Review Workflow

1. `node --check engine.js`
2. Browser で `START` し、`AUTO MIX` を有効化する。
3. `CULT=BROKEN` / `CULT=HAZE` / `IDEA=AUTO` で5分以上聴く。
4. Console で `window.MusicRuntimeState.signatureCells` を見る。
5. `eventLoad` が高い場面では `active` が無理に張り付かないことを確認する。
