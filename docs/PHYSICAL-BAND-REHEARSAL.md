# ギター・ベース・ドラム — 小さな合奏から作り直す

2026-10-01: v408は「音がちょちょぎれる」「ジャーン／ボーンとドラムの余韻」という本人の指摘に対応。
短い音符を自動でpalm muteにする判定と、新ARCBに残っていた旧bass gate上限を除去。
ギター和音は1 strokeとして扱い、note gateの後も弦の自然減衰を残す。次の和音／bass音では短いfadeで前の弦を押さえる。
ドラムの胴鳴り／金属の余韻を伸ばし、post-faderの共通roomを追加。空気感0–100%、既定35%。
roomはnativeの4 filtered delay loop、26 node（send込み）。STOP／seek／mode切替で予約音とroomを解放する。
52音のbankは11,826,560 bytes、12 MB上限内。共有7 node amp・予約128発／8秒先の上限を維持する。

2026-10-01: v407は本人の試奏評価と「そのままARCB再現」の承認を受け、Tabasco 7曲のAI再現を新しい弦・ドラム音源へ接続。
ギターはクリーン／クランチ／ディストーション。既存の音符・打点・sectionを同じtransportで鳴らし、原音・REC・part muteを維持。
Workerで52音を準備し、PCMは9,567,360 bytes。再生中はnative BufferSource、共通アンプ7 node、最大128発まで。
歌声は合成せず、melodyパートが採譜済みの歌の音程を弦でなぞる。ギター和音・奏法は近似、実iPhoneの長時間負荷と聴感は残る。
`?physical=0`は旧音源の診断用。HAZAMAの別音源と原音stemsは維持。既存の公開先とListenから案内する。


2026-10-01の「ロックから、できたらジャズ」「既存のエッセンスを残して整理する」に対応。
入口は[既存Band Roomの試奏](../band-room.html#br-physical-band)。新しいアプリやrepoを増やさない。

## 今できること

「8小節を試奏」を押し、ロック112 BPM／ジャズ116 BPMを選ぶ。
3パートのON/OFFと試奏音量で聴き比べる。停止は準備中でも有効。
同じスタイルはページ内の短いキャッシュから再開できる。
通常曲のSTARTで試奏を止め、試奏開始で通常曲を止める。ページを離れる時も試奏を破棄する。
この8小節試奏は独立した曲です。ギター3音色も試せます。ARCBの通常AI再現は同じ弦・ドラムを音符単位で鳴らし、既存RECに接続します。

- ロック：パワーコード、弦を軽く押さえた減衰、ピック風ベース、8分ハットとバックビート。
- ジャズ：シェル和音の裏拍コンピング、4分ウォーキングベース、スイングのライドと弱いスネア。
- ギター／ベース：弦の往復伝播と損失を遅延ループで表す小さなモデル。
- ドラム：減衰する振動モードとスネア／金属のノイズを足す近似モデル。

生楽器の忠実な複製、2次元の膜シミュレーション、写真の36／56パート合奏ではない。
精密なボディ／ピックアップ／弦間共鳴、ドラムの打点／膜張力／ワイヤー連成、ブラシ、
ベンド／スライド／指板ポジション、長い曲の展開とAIによるscore生成は未実装。
写真だけでは音質や作者の音高正解率を検証できないため、その水準の達成は主張しない。

## 残すエッセンス、作り直す中核

| 残す入力・役割 | 再利用の方法 |
|---|---|
| Band Roomの`guitar_line`／bass／drum行、section、velocity | native音源adapterで既存schedulerに接続。曲のデータと原音を保持 |
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
2. 接続済みのARCB 7曲を原音と比較し、採譜の音高・打点・ギター和音の誤りを直す。
3. チョーク／スライド／ブラシ等を1奏法ずつ追加し、同じ短いscoreで負荷と音を比較する。
4. ロックが安定してから、ジャズの会話／休符／コード追従と長い展開を増やす。

本人が2026-10-01に「全然前よりいい」「そのままARBC再現してほしい」と評価・接続を指示したため、通常のARCB AI再現へ昇格。実iPhoneの長時間負荷と再現の忠実度は継続評価する。

## v407の接続と機械検証

`bank.mjs`／`bank-worker.mjs`は52個の短い弦・打楽器を32 kHzで準備し、AudioBufferへ一度コピーする。
`instruments.mjs`は既存schedulerの音程・duration・velocityを保持し、最寄りbank音の再生速度で半音以下の音程も扱う。
`amp.mjs`は共有7 nodeでpickupの低域整理、soft clip、presence、2段のcabinet EQを行う。
ギター／ベース／melodyは16行/小節、ドラムは24打/小節、同時予約は128発・8秒先まで。
現在の7曲のギター・ベース・ドラムはこの行数上限内で、旧軽量版の4／4／8行より演奏を残す。
既存の構成、拍、パートbus、master limiter、RECを使用する。音源bankは同じcontextで再利用し、reset後は準備し直す。
STOP、mode切替、part mute、all offは未来の予約音も止める。Workerの準備取消は即terminateする。

Chromeの7曲で新音源のSTART／出音／STOP、3音色の出音、全mute・guitar solo、音量上限の余裕を検査。
Human Flyの約1分で予約落ち0、最大観測42発。原音との往復後にも再開でき、4.08秒のWAVに新音源の出力を確認。
390pxは横はみ出しなし。RESET AUDIO後の再準備とoffline再読込後のWorkerレンダーも通る。
ampの実出力で220 Hz入力の第3倍音比がclean <0.001、crunch 0.084、drive 0.265へ増えることを検査。
`check-physical-instruments.mjs`は52 bufferの有限値・DC・末尾静音・PCM上限、open guitarとbass全bank音の波形周期性±20 cent、
小数音程の再生速度、future noteの停止・全node解放、準備取消時のWorker解放を検査する。
これはChromeと数値検査の記録。原曲との音高正解率、細かな奏法、実iPhoneの長時間再生の評価は別に残る。

## v408の余韻と検証

0.12秒の短いgateでも、nativeの出力波形でguitar／bassの0.4–0.65秒RMSは0.0077／0.0131。
0.7–1.0秒も弦の減衰を確認。snareのbodyとroom impulseは有限値のまま減衰する。
次のbass音が前の音を押さえ、同じguitar strokeの3弦は互いを切らない。
短いgateだけでpalm muteを選ばず、明示したpalm奏法は短いまま残す。
roomは4 filtered delay loopの共有graph。低域を整理したpost-fader sendと既存master/RECへのreturnを持つ。

ChromeのHuman Fly約1分で予約落ち0、最大観測47発、output peak 0.547。
空気感0／35／100、seek、原音往復、全mute／part fader 0、STOP後静音とgraph解放を確認。
RECは2.82秒の実WAV（peak 0.485）で確認。390px横はみ出しなし。
数値とChromeの検査で、本人の聴感や実iPhoneの長時間負荷を合格扱いにしない。
