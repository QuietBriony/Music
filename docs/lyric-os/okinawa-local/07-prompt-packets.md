# Prompt Packets

These prompts are for distillation and metadata generation. They should not ask
for finished lyrics to be committed into the repo.

## Distill Interview

```text
私は沖縄ローカルの視点から、歌詞を書くための思想OSを蒸留したいです。

完成歌詞は作らないでください。
repoに保存するのは、思想の核、禁句、距離感、語彙、避ける語彙、世界観プリセット、metadata schemaだけです。

核の姿勢は、
沖縄を代表しないが、沖縄から逃げない。
政治を叫ぶのではなく、生活、家族、造園、墓、夜、AI画面、地元の距離、左耳のフェードアウトとして滲ませる。
昔のリビドーを再演せず、今の生活の中で根に移った熱を剪定する。

私に一問ずつ質問しながら、
1. 思想の核
2. 言ってはいけないこと
3. 歌詞にしていい距離感
4. 使える語彙
5. 避けたい語彙
6. 世界観プリセット
7. EP-133的なScene候補
に整理してください。
```

## Lyric Lab Distill Paste

Paste the distilled answer into Lyric Lab `思想蒸留`.

Recommended controls:

- `好きな軸`: `沖縄 roots`
- `思想`: `現代ウチナーンチュ`, `基地と生活`, `先祖 / 地上戦`,
  `軽々しく言えない琉球`, or `ねじれた政局`
- `声`: `われら / anonymous` or `neutral`
- `型`: start with `A/B/Hook full`

## Scene Packet Generator

```text
次のOkinawa Local Lyric OSから、完成歌詞ではなくScene packetだけ作ってください。

禁止:
- 完成歌詞
- リリックの長い連
- 音源、sample URL、他人の歌詞やモチーフ

出力:
- scene_id
- label
- distance
- usable anchors
- guardrails
- one-line production mood
- EP-133 Song Mode position
```

## Polishing Guard

```text
次の歌詞案を磨く前に、Okinawa Local Lyric OSの境界チェックだけしてください。

見る点:
- 沖縄を代表していないか
- 沖縄から逃げていないか
- 政治スローガンに潰れていないか
- 観光記号に逃げていないか
- 先祖/地上戦を消費していないか
- 家族とリスク境界を軽く扱っていないか
- 完成歌詞をrepoに保存しようとしていないか

修正案は短い方針だけ。完成歌詞は出さないでください。
```

