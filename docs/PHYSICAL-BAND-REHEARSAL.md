# ギター・ベース・ドラム — 小さな合奏から作り直す

2026-10-01の「ロックから、できたらジャズ」「既存のエッセンスを残して整理する」に対応。
入口は[既存Band Roomの試奏](../band-room.html#br-physical-band)。新しいアプリやrepoを増やさない。

## 今できること

「8小節を試奏」を押し、ロック112 BPM／ジャズ116 BPMを選ぶ。
3パートのON/OFFと試奏音量で聴き比べる。停止は準備中でも有効。
同じスタイルはページ内の短いキャッシュから再開できる。
通常曲のSTARTで試奏を止め、試奏開始で通常曲を止める。ページを離れる時も試奏を破棄する。
これは短い独立した演奏で、Band RoomのREC／原音／ARCB採譜への接続はまだない。

- ロック：パワーコード、弦を軽く押さえた減衰、ピック風ベース、8分ハットとバックビート。
- ジャズ：シェル和音の裏拍コンピング、4分ウォーキングベース、スイングのライドと弱いスネア。
- ギター／ベース：弦の往復伝播と損失を遅延ループで表す小さなモデル。
- ドラム：減衰する振動モードとスネア／金属のノイズを足す近似モデル。

生楽器の忠実な複製、2次元の膜シミュレーション、写真の36／56パート合奏ではない。
弦のボディ／ピックアップ／弦間共鳴、ドラムの打点／膜張力／ワイヤー連成、ブラシ、
ベンド／スライド／指板ポジション、長い曲の展開とAIによるscore生成は未実装。
写真だけでは音質や作者の音高正解率を検証できないため、その水準の達成は主張しない。

## 残すエッセンス、作り直す中核

| 残す入力・役割 | 再利用の方法 |
|---|---|
| Band Roomの`guitar_line`／bass／drum行、section、velocity | score変換adapterを後から接続。既存曲のデータを新音源へ直接上書きしない |
| drum-floorのノリ・強弱・休符 | 奏法eventの時間／力度／休符として翻訳 |
| chillの余白とTouch／Phrase／Room | ジャズの伴奏密度・休符・静かな回復に翻訳 |
| FMのウォーキングベース／会話／長い展開 | scoreと演奏者の規則に分離。12k行engineを置き換える前提にしない |
| test／namima-lab | 回収済みrecipeを保管。詳細は[archive audit](archive-repo-harvest-audit.md) |

AIは曲や奏法の候補をscoreとして作り、音源は決まった入力から再現可能な音を作る。
今回の2 scoreは新規の固定したオリジナル試奏。LLMや音楽生成モデルはロードしない。
「今のAIなら全部捨てて作る方が速い」とは判断せず、楽器DSPだけ小さく再構築して比較する。

## 実装と負荷の境界

- `audio/physical-band/score.mjs`：8小節、時刻／音高／力度／奏法の独立した入力。
- `dsp.mjs`：弦モデルと打楽器の近似。seed固定、入力上限、DC除去、余裕のあるbus音量。
- `render-worker.mjs`：32 kHzで先に3 monoパートを計算。UIと音声スレッドで合成しない。
- `preview.mjs`：明示タップ後だけWorker／audio nodeを作り、同じaudio時刻で3パートを開始。
  通常曲との排他、準備取消、Worker timeout、停止／自然終了／pagehideでの解放を担当。
- 1 scoreのPCMは7 MB未満、cacheは最大2 score。30秒／2048 event／音高28–84を超える入力を拒否。
  再生graphは3 source／3 gain／任意の3 pan／master gain。常駐convolutionやAIモデルなし。
  初回計算時間と実iPhoneの音質・負荷は別に確認する。

弦の遅延と損失、ピック位置、アンプを分ける考え方はJulius O. Smithの
[Electric Guitars / Physical Audio Signal Processing](https://www.dsprelated.com/freebooks/pasp/Electric_Guitars.html)を参考にした。
実装は独自の小さな近似で、書籍のコードをコピーしていない。
将来の膜モデルの選択肢はVan Duyne / Smithの
[2-D Digital Waveguide Mesh](https://people.ece.cornell.edu/land/courses/ece5760/LABS/s2019/vanduyne93physical.pdf)。
この2次元meshは今回のドラムには導入していない。

## 検証と次の一手

`node scripts/check-physical-band.mjs`はレンダーされた弦波形の周期性から音高を測り、
22.05／32／48 kHz × MIDI 28／40／55／69／84で±20 cent以内を要求する。
減衰の差、全パートの有限値／出音／末尾の静音、最大音量の余裕、PCM上限、seed再現と異常入力も検査。
これは限られた音の周期性検査で、全音域の聴感・楽器のリアルさの合格ではない。

1. 本人の試奏で、弦のアタック／低音／ドラムの硬さとノリを判定する。
2. ARCBの短い1区間をscoreへ変換し、原音と発音時刻・強弱・音高を比較する。
3. チョーク／スライド／ブラシ等を1奏法ずつ追加し、同じ短いscoreで負荷と音を比較する。
4. ロックが安定してから、ジャズの会話／休符／コード追従と長い展開を増やす。

通常曲への昇格はこの試奏の音と端末負荷を確認してから。候補を通常のAI再現へ一括置換しない。
