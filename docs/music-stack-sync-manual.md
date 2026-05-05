# Music Stack SYNC Manual

Music の `SYNC` は音声ではなく、いま鳴っている Music の状態を
metadata-only packet として同じブラウザ内の music stack へ共有するボタンです。
録音、サンプル、歌詞、raw trace、API token は入りません。

## いちばん簡単な使い方

1. [Music](https://quietbriony.github.io/Music/) を開く。
2. `START` して聴く。
3. 任意で `MIC` を押す。マイクは録音せず、入力の強さ/密度/テンポ気配だけで Music の生成を少し曲げます。
4. 良い瞬間で `SYNC` を押す。
5. Musicの表示か [OpenClaw](https://quietbriony.github.io/openclaw/) で推奨行き先を見る。
6. 行き先で音を出す。
   - [drum-floor](https://quietbriony.github.io/drum-floor/): `AI Live / 再生`
   - [namima](https://quietbriony.github.io/namima/): `Tap to start`
   - [chill session](https://quietbriony.github.io/chill/session.html): `START`

`chill` は `Quiet Piano / Glass Piano / Memory Piano / Soft Melody` のどれかへ自動で構えを寄せます。

迷ったらここまでで十分です。

## ネタを拾って次PRにする

外部/内部repoのアイデアを拾う時は、OpenClawの `Repo Harvest` を使います。

1. [OpenClaw](https://quietbriony.github.io/openclaw/#repo-harvest) を開く。
2. `chill / test / namima-lab` のカードで `拾う` と `拾わない` を見る。
3. 良さそうなら `このネタで次PR` を押す。
4. コピーされた指示文をこのチャットへ貼る。

これは metadata-only の review 導線です。音声、sample、model weights、歌詞、
dependency、workflow は取り込みません。実装する場合も、対象repoごとの小PRにします。

## 何が自動で起きるか

- `localStorage` と `BroadcastChannel` に最新の Music session packet が保存されます。
- 同じ `quietbriony.github.io` 上で開いた `drum-floor`、`namima`、`chill`、`OpenClaw` が最新packetを読みます。
- packetには `Musicで削る`、`chillで聴く`、`drum-floorで押す`、`namimaで空気に逃がす`、`OpenClawで見る` の推奨行き先が入ります。
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
- `MIC` はローカルfeatures解析のみで、raw microphone audio は保存/送信しません。
- 外部API送信、クラウドupload、録音開始、MIDI接続、live arm はしません。
- Music packet は制作判断の地図であり、他repoのruntimeを直接支配しません。
