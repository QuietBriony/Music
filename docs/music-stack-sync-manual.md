# Music Stack SYNC Manual

Music の `SYNC` は音声ではなく、いま鳴っている Music の状態を
metadata-only packet として同じブラウザ内の music stack へ共有するボタンです。
録音、サンプル、歌詞、raw trace、API token は入りません。

## いちばん簡単な使い方

1. [Music](https://quietbriony.github.io/Music/) を開く。
2. `START` して聴く。
3. 良い瞬間で `SYNC` を押す。
4. [OpenClaw](https://quietbriony.github.io/openclaw/) を開いて行き先を見る。
5. 行き先で音を出す。
   - [drum-floor](https://quietbriony.github.io/drum-floor/): `AI Live / 再生`
   - [namima](https://quietbriony.github.io/namima/): `Tap to start`
   - [chill session](https://quietbriony.github.io/chill/session.html): `START`

迷ったらここまでで十分です。

## 何が自動で起きるか

- `localStorage` と `BroadcastChannel` に最新の Music session packet が保存されます。
- 同じ `quietbriony.github.io` 上で開いた `drum-floor`、`namima`、`chill`、`OpenClaw` が最新packetを読みます。
- 受け側は preview controls や mood を合わせます。
- 受け側は `START`、`再生`、`REC`、MIDI、Ableton、EP-133、merge を自動操作しません。

## drum-floor の3つの役割

- `drum-floor standalone`: drum-floor ページで合成ドラムを手動previewする場所。Music `SYNC` で controls が寄り、`再生` で鳴ります。
- `chill DRUMS`: chill のピアノ/ベース/trio 内で使う soft pocket。chill が流れを持ち、drum-floor adapter が従います。
- `OpenClaw raw candidate`: Surface CLI で MIDI候補を作る別導線。候補生成と inspect までで、arm/録音/upload は人間確認です。

## JSON fallback

GitHub Pages 本番では `SYNC` が基本です。
ローカル開発で port が違う場合は自動共有できないことがあります。その時だけ
`window.MusicSessionPacket.download()` か受け側の貼り付け欄を使います。

## 安全境界

- audio files、samples、lyrics、raw recordings は保存しません。
- 外部API送信、クラウドupload、録音開始、MIDI接続、live arm はしません。
- Music packet は制作判断の地図であり、他repoのruntimeを直接支配しません。
