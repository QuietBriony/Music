# Music Radio Brain

## 目的

`MusicRadioBrainState` は、Music を「永遠に聴ける内在AI DJ」に近づけるための v1 レイヤー。
外部radioやYouTube配信を再生するのではなく、Music自身の生成状態を読んで、数分単位の番組を選ぶ。

参考にした発想は 24/7 lofi radio、Claude Code の AI DJ、procedural radio 的な常時生成だが、Music では音源や配信の仕組みは持ち込まない。
取り込むのは「今のセッションに合わせて番組を選び、疲れないように戻す」という制作判断だけ。

## Programs

`fieldStudy`

- haze、air、pad、透明な部屋を主役にする。
- low energy や長時間作業向け。
- 密度が上がりすぎた時の休憩先にもなる。

`glassCoding`

- IDM glass、memoryPluck、micro edit、短い戻り癖。
- 集中を少し揺らすが、旋律で前に出すぎない。

`dryGridWork`

- dry grid、short texture、hat cue。
- 速度感は中高域で出し、kick/bassを単純に増やさない。

`ghostPressure`

- body snap、ghost transient、controlled punch。
- low-end guard が強い時は自動で引く。

`voidRoom`

- transparent tail、low-mid cleanup、air。
- 明るさ、低域、密度のriskが高い時に逃がす。

## Runtime

console では次を確認できる。

```js
window.MusicRuntimeState.radioBrain
```

主な項目:

- `active`: 現在の番組
- `next`: 次に向かう番組
- `phrase / phraseCycles`: 番組の滞在時間
- `weights`: 番組ごとの候補重み
- `bias`: `haze`, `glass`, `grid`, `pressure`, `air`, `restraint`, `curiosity`
- `guard`: density / low / bright の事故検知
- `lastReason`: その番組を選ぶ理由
- `cuePending / cueProgram`: 番組変更時に短いstation identを鳴らす準備

`MusicSessionPacket.performance_state.radio_brain` にも metadata-only で出る。

## Station Ident

番組が切り替わった時だけ、既存音源で短い合図を鳴らす。

- `fieldStudy`: haze chord と air glass
- `glassCoding`: 短い glass / memory pluck
- `dryGridWork`: hat / texture のdry cue
- `ghostPressure`: body texture と murk glass
- `voidRoom`: transparent air と voiceDust tail

これは新しい楽器ではない。番組の切り替わりを耳で追えるようにする、小さな署名音。

## Safety

- 音声、録音、サンプル、歌詞、外部URL、API token は保存しない。
- masterGain、limiter、OUTPUT、recorder は触らない。
- 新しい発音器やTone nodeは追加しない。
- 番組は直接音を鳴らさず、`ModeTimbrePaletteState` と既存の probability / envelope / restraint にだけ影響する。
- station ident は番組変更時だけ鳴り、eventLoad が高い時は待つか捨てる。
- density、brightness、low-end risk が高い場合は `voidRoom` / `fieldStudy` へ逃がす。

## 聴感レビュー

- 5分以上で番組がゆっくり変化する。
- `glassCoding` は短い癖として戻るが、メロディ主役にならない。
- `dryGridWork` は速さが見えるが、明るく硬すぎない。
- `ghostPressure` は低域過多ではなく、snapとして聴こえる。
- `voidRoom` は無音ではなく、空気とtailとして残る。
- 10分以上で疲れない。
