# MIC Jam / Groove Drive v2

## Aim

`MIC` は録音ボタンではなく、ローカルの演奏入力です。声、息、手拍子、机タップ、部屋の無音を粗い特徴量だけで読み、Music の制作判断へ変換します。

目的は、マイク入力から曲を模倣生成することではありません。部屋にいる人間とエンジンが一緒に演奏している感触を作ることです。

## Gesture Model

`MicFollowState` は従来どおり、以下の metadata features だけを抽出します。

- `inputLevel`
- `onsetRate`
- `roughTempo`
- `density`
- `stability`
- `silence`
- `brightness`

`MicJamState` はそれを音楽的な身振りへ翻訳します。

- `silent`: air、room、restraint へ戻る。
- `breath`: air tail を広げる。
- `hum`: haze、voiceDust、glass tail へ柔らかく寄せる。
- `phrase`: 短い glass / memory 点で返答する。
- `clap`: dry texture snap と hat cue を出す。
- `pulse`: grid、repeat、tempo hint を強める。
- `noisy`: confidence を下げ、過剰driveを避ける。

## Musical Behavior

- 歌フレーズは主旋律にしません。短い返答セルだけを作ります。
- 手拍子やタップは新しいドラムエンジンを起動しません。既存の hat、texture、glass、dry grid を押します。
- 無音は死んだ状態ではありません。`voidAir`、room、restraint へ戻す状態です。
- tempo follow は弱くします。`bpmLock` は反復onsetが十分に安定した時だけ出ます。

## SYNC Packet

`performance_state.mic_follow` には以下が追加されます。

- `gesture`
- `drive`
- `bpm_lock`
- `confidence`

これは metadata-only です。音声、raw buffer、録音、アップロード先は含みません。受信側repoは後続PRでこの情報を読めますが、v2では drum-floor、chill、namima、録音、MIDI、Ableton、EP-133 を自動起動しません。

## Listening Checklist

- 歌う/ハミングする: glass / memory が短く返り、主旋律化しない。
- 手拍子/机タップ: hat / texture / dry repeat が分かりやすく立つ。
- 音を止める: air と room へ戻る。
- 強い入力でも kick、bass、OUTPUT、limiter が過負荷にならない。
- bright EDM 化や machine-gun repeat は `selfReview` と mix load で抑えられる。
