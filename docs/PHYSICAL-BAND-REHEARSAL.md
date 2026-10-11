# ギター・ベース・ドラム — 小さな合奏から作り直す

2026-10-12: v414は一本の比較に、芯と余韻を作り直した合成候補を追加。弦の振動モード・ピックとpickupの位置・周波数別の損失と弱い二方向の振動を、最大128 modeの有限Workerで合成する。新旧合成と既存録音を同じ10.8秒／クランチ／phrase RMSで比較し、再生は1 source／1 gain、準備済みPCMは4,147,200 bytes。音声素材の追加なし。ARCB通常曲へは未昇格で、本人の試奏と実iPhone確認が残る。[設計と測定](PHYSICAL-BAND-REHEARSAL.md#新しい弦の芯と余韻v414)。

2026-10-11: v413は同じ10.8秒の単音・E5・A5・短いミュートを、現行弦合成と既存の録音エレキ4音で比較する任意の試奏。共通クランチと平均音量をそろえ、採譜の誤りと音源の不足を切り分ける。録音は明示準備時だけ取得しSHA-256を照合、再生は1 source／1 gain。ARCBへ未採用で、録音ミュートはfilter／減衰の近似。人の聴感を数値から合格扱いしない。[比較条件](PHYSICAL-BAND-REHEARSAL.md)。

2026-10-03: v411はARCBの8分／16分の上下ストローク、ロックの刻み、響かせる／カッティング／パームミュートを追加。短い検出音符だけでコードを切らず、同じ弦bankとampを使う。奏法は音符からの推定。実ブラウザ出力と前後比較は[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。

2026-10-02: v410は採譜の空白小節へ足していた自動伴奏を止め、既存のreleaseとroom tailを残す。未採譜の歌の音程は生成せず、Electric Sheep／TABASCOのmelodyを明示。合奏・soloの確認と残る採譜漏れは[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。

2026-10-01: v409は原音の分離漏れを前提に、ARCBの合奏全体を測定して補正。
弦の初期変位と小さなpick成分を分け、ベースの芯とギターの中域を残す。打楽器ノイズを帯域で色付けし、kick／snare／金属と弦の相対量を調整。
弦の余韻を少し延ばし、次音のdampingは保持。新ARCBの既存polish makeupを3 dB下げ、歌の音程ガイドも同じ方向へ調整。
一致する採譜bpm_fitを合奏の時計に使い、名目BPMとの差による累積ずれを解消。途中seekはTransportを再構成し、残りの小節と次小節を連続させる。
実際のpost-master REC WAVを原音drums+bass+otherの再結合と比較。計測の条件・結果・限界は[ARCB合奏測定](ARCB-MIX-MEASUREMENT.md)。
52音／11,826,560 bytes、amp 7 node／room 26 node、予約128発／8秒先の予算を保持。音声・依存・公開先の追加なし。
歌声・完全な多声音高採譜の達成や実iPhoneの負荷合格を主張しない。本人の違和感は測定判定を上書きする。

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

## 新しい弦の芯と余韻（v414）

同じ[一本の比較](../band-room.html#br-guitar-audition)で「比較を準備」→「新しい弦合成で聴く」。
「これまでの合成」「録音ギター」も残し、同じ10.8秒・クランチ・平均レベルで比較する。
新しい合成は録音波形を使わない。ARCB通常曲への昇格は本人の試奏後に判断する。

旧弦の3.2秒T60と繰り返す損失フィルターでは、低いEの実出力が約1.75秒後に30 dB近く落ち、倍音も痩せていた。
任意候補の`electric-string.mjs`では弦を最大64倍音×2方向の減衰振動として直接計算する。
三角形の初期変位、ピック位置とpickup位置で各倍音の励起・観測量を決め、弦の硬さによる小さな非整数倍音を入れる。
低い倍音の余韻と高い倍音の損失を別に制御し、弱い第二方向の振動で響きが少し変化する。
openは低Eの基本T60 9.2秒、palmは0.3秒。高音域・高次倍音は早く減衰する。
9.2秒は音声ファイルの長さではなく、減衰の設計値。候補PCMの長さは従来と同じ2.5秒／palm 0.55秒で、共通scoreの次打点とreleaseで滑らかに止める。
これは簡略化した設計であり、特定ギターのpickup実測、二方向の厳密な結合、指・フレット・弦間の接触を再現したものではない。

基礎にした一次資料はJulius O. Smithの[理想的な撥弦](https://www.dsprelated.com/freebooks/pasp/Ideal_Plucked_String.html)と
[エレキギターの損失・sustain設計](https://www.dsprelated.com/freebooks/pasp/Electric_Guitars.html)、
Berdahl / Smithの[二方向の弦振動](https://cct.lsu.edu/~eberdahl/Papers/NIME2008BerdahlSmith.pdf)。
実装は独自の有限mode計算で、資料のコードや録音音源をコピーしていない。

### 実出力の測定

ブラウザで実際に再生するBufferSourceのPCMを取り出し、独立したPython処理で周期性、RMS、peak、時間別の帯域分布を測定。
加えて録音に存在するE2・A2・D#3・A3の4音を、各方式で同じDC処理・peak 0.22・クランチへ通した。
低いEだけを全音域の合格証拠にしない。数値とcapture hashは[測定記録](guitar-sustain-measurement-20261012.json)。

| 比較条件 | これまでの合成 | 新しい合成 | 録音ギター |
|---|---:|---:|---:|
| 11秒フレーズのRMS | 0.060 | 0.060 | 0.060 |
| フレーズのpeak | 0.475 | 0.295 | 0.556 |
| フレーズ低Eの周期性（cent） | −0.00 | +1.91 | −1.22 |
| 低Eの後半／アタックRMS差 | −29.65 dB | −11.82 dB | −10.72 dB |
| 単独E2の後半／アタックRMS差 | −29.50 dB | −11.26 dB | −10.49 dB |
| 単独A2の同差 | −28.92 dB | −12.68 dB | −14.73 dB |
| 単独D#3の同差 | −29.72 dB | −13.32 dB | −15.61 dB |
| 単独A3の同差 | −31.01 dB | −13.49 dB | −13.03 dB |

アタックは開始50–350 ms、後半は1.6–1.9秒。4単音の減衰差の絶対値平均は16.32 dBから1.39 dBへ縮小した。
これは余韻の時間変化に関する証拠で、音色の一致率ではない。帯域分布、実演の揺れ、奏法の違いは残る。
フレーズは同じnearest-note gridで鳴らし、4単音検査は対応する正確なMIDI noteで別途renderした。
既知の音周辺で測る周期性は、多声音高の採譜精度や和音の正答率ではない。

音程・余韻・palm dampingは7音域×4 sample rateの28条件でも検査した。
Workerで新旧の6音ずつを準備し、最終3フレーズの保持PCMは4,147,200 bytes（prepare中の一時bufferと再生用copyは別）。
再生は従来どおり1 source／1 gainで、新しい合成が追加の常時処理を増やすことはない。
新旧と録音の自然終了、相互切替、通常曲／8小節試奏との排他、STOP、取得拒否／hash不一致／準備取消、390px表示を実ブラウザで検査。
実iPhoneの長時間負荷、本人の音色判定とバンド全体の再現は引き続き未完了。

## 一本のロックギターを先に比較する（v413の比較条件）

本人の「音色一本でもギターに聴こえない」を受け、[同じBand Roomのギター比較](../band-room.html#br-guitar-audition)で音源方式を先に判定する。
「比較を準備（録音4音）」を押し、合成／録音ギターのボタンで同じ10.8秒を交互に聴く。
単音E2 → E5（E2・B2・E3）→ A5（A2・E3・A3）→ 短いミュート4回 → E5。
一つの固定したクランチ、7 msの弦間隔、同じ打点と強弱、phrase RMS 0.06を共通条件にする。
残響は加えず、音源自体のアタック／胴鳴り／余韻を比較する。ユーザー音量は両方に同じ値を掛ける。
平均レベルの一致は知覚音量やリアルさの一致を保証しない。

録音は既存のnbrosowsky/tonejs-instrumentsの固定commit、CC BY 3.0のE2／A2／D#3／A3。
4 MP3の合計410,784 bytes。新しいホストや音源バイナリをGitへ追加しない。
各hashを照合してから32 kHzでdecodeし、5秒／2ch、150 KB/assetを超える取得を拒否する。
音高は最寄りの録音音から変換、velocityは音量だけ。録音の短いミュートはlowpassと減衰の近似。
複数強度／弦ごとの録音、実際のパームミュート／ベンド／スライド／アップストロークの収録は含まない。
録音ギターは比較用で、ARCBの曲再現への差し替えや採用は行わない。

合成は現行bankの弦grid／seed／DC処理／peak 0.22を短いWorkerで再現する。
ampは両方ともOfflineAudioContextで準備し、最終PCMは2,764,800 bytes。
再生は1 BufferSource／1 gain。明示Stop、曲／8小節試奏の開始、hidden／pagehideで停止。
取得失敗は録音ボタンを無効化し、合成だけを残す。別URLや合成音を「録音」として代用せず、再取得も行わない。

実再生sourceのPCMを[測定記録](guitar-audition-measurement-20261011.json)に残した。
低いE単音の周期性では合成約+0.01 cent／録音約−1.13 cent。
アタック50〜350 msに対し、1.6〜1.9秒後のRMSは合成約−29.65 dB／録音約−10.72 dB。
この音に限っては音程より余韻に大きな差がある。全音域の正解率や人の聴感評価ではない。
比較のpeakは合成約0.475／録音約0.556、末尾140 msは0／約0.000000807 RMS。
Chromeの操作検査と本人の音色採用・実iPhone負荷は分けて扱う。

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
