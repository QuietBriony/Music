# Mode Timbre Palettes

## 目的

`ModeTimbrePaletteState` は、Music のモードごとの音色人格を強める v1 レイヤー。
新しいサンプル、依存、UIを足さず、既存の pad / glass / texture / hat / air / signature cell の鳴り方だけを変える。

狙いは「イベント数を増やす」ことではない。同じ素材が、状況ごとに違う production kit として振る舞うこと。

- low energy: haze、air、丸いglass、余白が主役
- mid energy: IDM glass、memory pluck、micro edit、制御された違和感
- high energy: dry grid、short texture、clear transient
- pressure: bass過多ではなく body snap と ghost transient
- VOID: 死んだ無音ではなく、透明な部屋とtail

## Palette

`ambientHaze`

- long soft haze、rounded glass、slow drift、低い rhythmic activity。
- 既存の pad、glass、voiceDust、air を使う。
- kick / bass は床として残すが、低energyでは押し出さない。

`idmGlass`

- short glass / pluck fragments、memory points、brokenTexture、micro repeat。
- 既存の ghostGlass、memoryPluck、brokenTexture、glass、texture を使う。
- 旋律の主役ではなく「戻ってくる短い癖」として扱う。

`technoDryGrid`

- tight hat / texture grid、short envelope、dry repeat、clear transient。
- 速さは低域ではなく中高域のcueで出す。
- bright EDM化しそうな時は selfReview と restraint で下げる。

`pressureGhost`

- body snap、ghost transient、controlled punch。
- low-end guard と selfReview で bass overload を避ける。
- サブを増やすのではなく、部屋の圧として聴かせる。

`voidAir`

- low-mid cleanup、air/glass tail、transparent room。
- VOID は無音化ではなく、残響と空気を残す。
- grid は落ちるか短くなってよいが、空間は生きている。

## Runtime

console では次を確認できる。

```js
window.MusicRuntimeState.timbrePalettes
```

主な項目:

- `active`: 現在もっとも強いpalette
- `weights`: paletteごとの重み
- `shape`: step単位の bias。`rhythm`, `haze`, `glass`, `texture`, `air`, `pad`, `signature`, `transient`, `lowClamp`, `restraint`
- `safety`: density、low-end、brightness、restraint の安全係数
- `lastDecision`: 最後の dominant palette

これは聴感レビュー用の目印であり、「良さの証明」ではない。最終判断は録音とリスニングで行う。

## Safety

- audio files、samples、lyrics、model weights、dependencies、workflows を追加しない。
- reference の melody、chord、構成、録音をコピーしない。
- masterGain、limiter、recorder、OUTPUT は触らない。
- Transport loop 内で新規 Tone node を作らない。
- density、brightness、low-end risk、eventLoad が上がったら、palette は restraint、air、low-mid cleanup へ逃がす。

## 聴感レビュー

- Low energy: haze と air が主役で、hat / repeat は控えめ。
- Mid energy: glass / pluck / micro edit が短い記憶点として戻る。
- High energy: dry grid と texture pulse が見えるが、硬く明るすぎない。
- PUNCH: 圧は snap と body。sub overload にならない。
- VOID: 透明な部屋になる。死んだ無音にならない。
- 10分以上流して疲れない。

