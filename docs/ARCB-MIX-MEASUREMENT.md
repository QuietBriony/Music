# ARCB — 合奏の測定と補正（現行 v424）

## ベースの長音と曲末を原音へ合わせる（v424 / 2026-10-18）

分離前の現存する仮ミックス7曲が参照できるようになった。原音直接再生はv423の経路を保持し、今回はAIベースを修正する。
既存譜には3秒を超える保持音があるが、旧bankは3秒で終わり、移調後にはさらに短くなる場合があった。
ベース13音だけを16 kHz／8秒にし、全53 bufferは13,610,240→15,274,240 bytes。15.4 MB以内に固定する。
弦のモデル・音程・打点・音量・次音でのdamping・同時128発・再生node数は保つ。ギター／ドラムのPCMは同一。

12保持音で、旧bufferは譜面の保持より0.17〜3.80秒早く終了していた。同じnative adapterの独立renderで、この位置の無音を解消した。
開始0.1〜2.5秒の周波数powerのcosineは最小0.99999988、RMS差は最大0.0021 dB。これは初期音色の保持の検査で、実楽器の再現度ではない。

一方、仮ミックスの末尾にはデジタル無音がある。分離stemの残りを採譜した低音をそこまで延ばしてはいけない。
全曲を復号し、11,025 Hzの左右どちらかが振幅1e-7を最後に超える時刻を測る。既知のstem時刻差1105/44100秒を加え、
原音SHA-256と終端を7曲の`premix_reference`へ記録。bassだけはその時刻までに25 ms以上の最終fadeを収め、以後の音は作らない。
既存の全採譜イベントと他のmetadataは保持。80／100／120%の速度でも同じ録音位置へ対応する。
終端前8秒からの実譜renderで、7曲とも終端後のdry bass RMSは0、終端前には出力がある。部屋の余韻はこの検査に含めない。

通常ブラウザでもHuman Fly／I Got a Feeling／Sister／Under the Moonの長音区間を合奏で取得した。
SWを遮断した独立QAで、速度100%・修正済みschedulerを共通にし、旧／新bankだけを比較している。
Sisterでは旧版でほぼ消えていた28–130 Hzの低音が残るが、原音との音量差はまだある。
原音の声・分離漏れ・既存master差も含むため、低域RMSの増加を全体の品質改善率とは扱わない。
既存ベース譜3,630音を対象に持続区間をYINで再照合し、2候補が出たが、別の周波数解析と原音の支持が弱く、音高変更は0件とした。
方法の定義は[librosa YIN](https://librosa.org/doc/0.11.0/generated/librosa.yin.html)。

シーク時にTransport開始位置の最初のcallbackが抜け、全パートの譜面が1小節遅れるケースも確認した。
最初の小節はTransportと同じ絶対音声時刻で直接予約し、次の小節から通常の反復へ渡す。
7曲・15条件・112発のnative発音予約と譜面時刻を照合し、最大誤差は約1.18 ms。Human Flyは80／100／120%で冒頭・中盤・終盤を含む。
これは発音予約の誤差検査であり、実際の楽器attackや聴感を測った数値ではない。
有限8秒bankのため、極端に遅い練習速度で引き伸ばした長音がbankを超える場合は残る。

[入力hash・比較条件・全測定・限界](arcb-bass-sustain-measurement-20261018.json)。音声はlocal ignored出力だけに保持。
再生／seek／停止・速度・更新と最終HEADのgateは対応PRへ記録する。原音のにじみ、ギター／ドラムの精密再現、本人聴感と実iPhoneは残る。


## 録音の位相と余韻を保つ原音ライブ（v421 / 2026-10-16）

v417のライブ経路は全体の厚め処理を迂回していたが、前段の各stemのEQと声のchorus／roomは残っていた。
分離した4パートは同じ録音を共有するため、個別の位相変化と追加残響が再合成の波形を変える。
ライブでは個別EQ前から4つのfaderを通して合流し、既存の28 Hz HP／緩いcomp／出力上限へ渡す。
曲別trim、音量・mute、声の既存dry量0.78、master／RECは共通。厚めは従来のEQ／FX経路。
ライブで効かない声FXも無効表示するが、値は保存し、厚めへ戻すと再び使える。

実際のensureMasterをOfflineAudioContextで鳴らし、全7曲で同じ2秒pre-roll＋3秒切り出しを比較。
基準は同じfader／trimで合流した未加工stemを同じ最終保護へ通したもの。遅れ合わせ・時間伸縮・音量合わせはしない。
下表は基準に対する残差のRMS比dB（より小さいほど波形が一致）。元の分離前mixへの再現率や聴感点数ではない。

| 曲 | 従来ライブ | 新ライブ |
|---|---:|---:|
| human-fly | -4.8 | -89.4 |
| electric-sheep | -5.7 | -88.0 |
| i-got-a-feeling | -5.8 | -81.0 |
| hey | -4.3 | -90.0 |
| sister | -3.6 | -89.3 |
| under-the-moon | -4.0 | -88.5 |
| tabasco | -5.0 | -88.1 |

同条件の厚め前後差は最大0.0000500（PCM16の2段階以内）。native DSPのbit一致とはしない。
ライブのRMSは区間により約1.3〜3.0 dB増え、crestの変化は一様ではない。単に大きい・尖るほどよいとは判断しない。
通常ブラウザでも新ライブ7曲と厚め3曲を5秒ずつ取得し、全16の前後captureで非有限値・clipping・dropped notesなし。
条件・元28 MP3のhash・全測定・限界は[測定JSON](arcb-original-live-measurement-20261016.json)。音声はGitへ追加しない。
原音の分離前mixは今回の入力になく、分離漏れや本人の聴感、実iPhone負荷は未解決。
最終HEADの全体gate／audit、操作回帰と両公開先の照合は対応PRへ記録する。


## ギターの打点・和音を再照合（v420 / 2026-10-13）

原音otherの140–2800 Hz帯域エネルギーと、600–3500 Hzのspectral fluxが一致する近傍だけを補正。
最大約65 ms前へ合わせ、音を切る時刻・強弱・順序・小節所属を保持する。ベース／ドラム譜と原音28 MP3は変更しない。
和音はストローク後のCQT 3区間が一致し、密集箇所では直前も一致、別のlinear STFTでも旧和音より支持される候補に限る。
既存の和音注釈は、補正後の行とhashへ結び直した。同時発音数の上限、53 buffer／13,610,240 bytesは増やさない。

| 曲 | 採用した打点補正 | 追加和音 |
|---|---:|---:|
| human-fly | 15 | 1 |
| electric-sheep | 185 | 2 |
| hey | 50 | 2 |
| sister | 0 | 0 |
| i-got-a-feeling | 0 | 0 |
| under-the-moon | 74 | 0 |
| tabasco | 27 | 0 |

全候補468打点／31和音のうち、実出力の比較で支持が一貫しなかった117打点／26和音は見送り。
SisterとI Got a Feelingの演奏、Under the Moonの和音は従来のまま。
候補の評価、採否、source/input/output hash、実際の比較値は[測定JSON](arcb-guitar-performance-measurement-20261013.json)に残す。

通常ブラウザのpost-masterでは全7曲の合奏とギター単体、採用5曲の別の後半区間も収集した。
AudioWorkletの最初のframe時刻を使い、前後で共通する原音時刻へ切り揃える。時間伸縮・遅れの最適化はしない。
ただし変更しなかった2曲にも走行間のスペクトル差があり、この値だけで改善を断定しない。
初回のguide混入と重なった検証操作は判定から除き、再収集した。録音はGitへ追加しない。

そこで同じnative音源adapterをOfflineAudioContextで鳴らす確認も追加。
共通の2秒pre-roll＋正確な3秒切り出し、クランチ直後、global master／roomを含めない条件。
同じ譜面の反復と変更しない2曲の比較は、PCM16の1段階以内で一致。
下表は原音otherとのpitch-class距離（小さいほど近い）。3区間縮小、2区間小幅拡大、2曲不変。
音域・奏法・人の聴感を保証する指標ではなく、特定ギターの完全な再現を主張しない。

| 同条件の楽器出力 | 旧 | 採用版 |
|---|---:|---:|
| human-fly | 0.2158 | 0.2091 |
| electric-sheep | 0.3551 | 0.3290 |
| hey | 0.6926 | 0.6934 |
| sister | 0.1952 | 0.1952 |
| i-got-a-feeling | 0.2924 | 0.2924 |
| under-the-moon | 0.3253 | 0.3239 |
| tabasco | 0.9609 | 0.9621 |

通常再生の最終24 captureはclipping／dropped notesなし。80／100／120%の開始・途中移動・停止も確認。
公開版のasset照合、candidateとmerged HEADそれぞれの43件gate／auditは対応PRに記録する。
再解析は`scripts/refine-guitar-performance.py`。既存cacheはsource／parameter／array hashで検査し、
補正済み譜面への二重適用と、解析中に変わった譜面への書込みを拒否する。
分離漏れ・曖昧な和音・未採譜と音色／奏法の差、実iPhoneの長時間負荷は継続課題。


## 短い曲のドラム譜と再生時計（v419 / 2026-10-13）

44.722秒のTABASCOは194打を抽出できていたが、固定200打の採用条件で全譜面を捨て、同じframeを繰り返していた。
短曲は長さに応じた打数と曲内4区間中3区間以上のcoverageを検査する。90秒以上の旧200打・kick50・snare30条件は保持。
拒否時に既存譜を消さない。専用の補完処理も既存drum_lineの上書きを拒否する。
128打を原音の立ち上がりへ合わせ、10打の弱い同時cymbal仮説を追加。204打（kick131 / snare62 / cymbal11）、最大12打／小節。
音長・強弱・細かい打点を保持し、bassの132.51 BPMと同じ時計を使う。原音・他6曲・ギター／ベース譜・音源bankは保持。

実出力の比較で、native AIの開始／seekにToneのlook-ahead＋30 msを使う一方、再生時計が即座に始まり約130 ms先行する不具合を発見。
両方に同じ絶対AudioContext時刻を渡すよう修正した。元の原音／legacy時計は保持する。
最初のREC比較はOpus・WAV変換後に時計を読んでおり、遅れと処理負荷が混入したため、判定証拠に使わない。
最終比較は同じpost-masterの音をAudioWorkletで6秒直接収集し、最初のaudio frame時刻から原音区間を指定する。

独立な帯域spectral fluxと±30 msで照合。下表は各録音で全帯域共通の±120 ms以内の遅れ補正を許したF1で、採譜正答率ではない。
補正なしの値、実際の区間、補正量、source/capture hashも[測定JSON](arcb-short-drums-measurement-20261013.json)に残す。時間伸縮はしない。

| 比較位置 | kick 旧 → 新 | snare 旧 → 新 | 高域 旧 → 新 |
|---|---:|---:|---:|
| 2秒付近 | 0.240 → 0.688 | 0.333 → 0.737 | 0.118 → 0.643 |
| 16秒付近 | 0.148 → 0.500 | 0.304 → 0.444 | 0.170 → 0.429 |
| 30秒付近 | 0.609 → 0.667 | 0.538 → 0.667 | 0.500 → 0.387 |

kick/snareは3区間とも改善。終盤の高域は改善せず、シンバル／タム分類や分離漏れが残る。
全captureでPCM clippingなし、dropped notes 0。53 buffer／13,610,240 bytesと128 source上限を保持。
原音のライブ／厚めの仕上げは同じ。比較はsample-aligned／loudness-matched A/Bではなく、主観聴感・実iPhone評価を代行しない。
再解析: `python -X utf8 scripts/complete-tabasco-drums.py --out <report.json>`。`--write`は欠けたTABASCOの譜面にだけ適用。
回帰: `--self-test`、`node scripts/check-band-room-logic.mjs`、`node scripts/check-tabasco-songs-catalog.mjs`。
ローカルの収集／失敗／再測定の証跡は`output/playwright/band-polish/`。


v417追加検証: START前の「厚め」選択・保存復元で無音になる条件を再現。停止中のAudioContextには予約rampを積まず初期gainを直接設定し、再生中のみ40msで切り替える。変更前3条件が無音、変更後は同条件とliveの全4条件で実出力を確認。

## リズム再照合と原音のライブ仕上げ（v417 / 2026-10-12）

既存bass/drumsをCPUで再解析。10 ms帯域エネルギーの立ち上がりを検出し、近傍の明確な打点だけ補正した。
ベースは249打点を前へ合わせ、YINで前後の音程が安定し独立なspectral fluxも立つ128箇所を同音の弾き直しに分割。元の音高・強弱と最後のnote-offを保持する。
ドラムは4,122打点を補正し、キックと重なる高域の立ち上がり・減衰が確認できた287箇所に小さなcymbalを補った。ギター譜・和音注釈・bankは変更しない。
同一音の密集、bass 16／drums 24打点の小節予算を超える候補は採用しない。TABASCOには既存drum_lineがないため、この処理で新しい全曲譜を捏造せず既存fallbackを残す。

| 曲 | bass 打点／弾き直し | drums 打点／同時cymbal |
|---|---:|---:|
| human-fly | 29 / 5 | 736 / 22 |
| electric-sheep | 110 / 1 | 468 / 18 |
| hey | 11 / 17 | 864 / 83 |
| sister | 40 / 3 | 567 / 31 |
| i-got-a-feeling | 25 / 46 | 821 / 83 |
| under-the-moon | 18 / 48 | 666 / 50 |
| tabasco | 16 / 8 | 未採譜 / — |

別方式の帯域spectral fluxと序盤・中盤・終盤18区間を比較し、±30 msの一致F1は各クラスで改善または同等。
高域にはスネアや分離漏れもあるため、これは正答率ではない。上記の追加cymbalも確定したhatラベルではない。再解析は `python scripts/refine-rhythm-performance.py --baseline-ref 9a704d6 --out <report>`。`--write`は未補正譜にだけ適用し、補正済み・変更済みの譜面は上書きしない。追加model不要。

### 原音の仕上げ

既存sound mixに「ライブ · 録音の響き」（初期値）／「厚め · 従来の仕上げ」を追加。ライブは全体の3段圧縮・parallel distortion・widener・追加残響を迂回し、28 Hz HP → 1.35:1 / 35 msの緩いcomp → 音量 → 出力保護を通す。元のstem EQ・vocal blend・パート音量とRECは保持。録音ファイルを上書きせず、仕上げの選択は保存される。
最初の試作gain 0.9ではpeak overloadを検出し不採用。gain 0.45と連続した出力上限で再測定した。ライブの音量0と最大設定でも同じ出力操作を適用する。
追加確認で、原音のHEAD存在確認がオフライン時に保存済みGETまで拒否する旧来の不具合を発見。ネットワーク例外時に完全な200応答のcacheだけを認めるよう修正した。未保存・partial・onlineのHTTPエラーは引き続き拒否する。
原音4stem（vocal ON）の同じseek付近を各約8秒録音。ライブは平均音量が低い曲もある。crestは音量に依存せず、6/7区間で打点と平均の差が増えた。左右差は従来の人工的なwidenerより小さくなる。ライブ感の主観評価は未実施。

| 曲 | 従来 crest dB | ライブ crest dB | ライブ LUFS（区間） | true peak dBTP |
|---|---:|---:|---:|---:|
| electric-sheep | 13.36 | 18.81 | -17.1 | -1.8 |
| hey | 16.4 | 19.91 | -23.7 | -5.4 |
| human-fly | 12.51 | 15.06 | -18.8 | -6.1 |
| i-got-a-feeling | 14.72 | 19.81 | -28.2 | -10.0 |
| sister | 14.27 | 13.75 | -30.5 | -18.9 |
| tabasco | 13.49 | 16.36 | -18.2 | -4.2 |
| under-the-moon | 17.03 | 20.64 | -24.8 | -6.2 |

### 合奏

通常7曲のAI再現（guitar+bass+drums、melody OFF、100%／crunch／room35%）をpost-master REC。13,610,240 bytesのbankと128 source上限を維持し、全captureでdropped notes 0。
旧原音instrumental referenceに対する主5帯域の平均差は7区間平均3.02 → 2.89 dB。5区間で縮小、1区間同等、1区間小幅拡大。これは音色のリアルさや譜面の正答率ではない。
数値、hash、18区間の内訳: [測定JSON](arcb-rhythm-live-measurement-20261012.json)。音声はignored outputに保持。従来試作・失敗ログと公開候補の測定を分けている。


## 通常ARCBへ新しい3楽器を採用（v416 / 2026-10-12）

本人の「そのままARCBにも反映」を受け、v414のギターとv415のベース・ドラムを通常7曲へ採用。
ギターの3秒の響き、ベースの基音と余韻、弱いスネアの胴／ワイヤー、シンバルの減衰を既存アンプと部屋へ送る。
使っていないピアノ初期設定からロックギターへジャズ和音が混ざる経路も修正した。
3楽器は合成音で、原音ファイルの差し替えや再分離は行っていない。

### 再採譜の範囲と留保

既存otherをstereo harmonic CQTで再解析。短い刻みの前後の和音が窓へ混ざるため、
打点の前後から120 msを避け、10 frame以上の安定区間を3分割して全て同じpitch classとなる候補だけに絞った。
similarity ≥0.65、別rootとの差 ≥0.12、従来音符からの説明力の増分 ≥0.12。
広い条件の574候補は採用せず、5,426打点のうち67打点へ追加。曲別ではHuman Fly 5、Electric Sheep 2、
Hey 4、Sister 16、I got a feeling 20、Under the moon 20、TABASCO 0。
元の打点・音長・強弱とscore hashを保ち、各注釈は元の5値の行に結び付けた。
既存の小節和音も残す。これは正答率や全曲の完全な採譜ではない。

同じ新音源で追加注釈だけを無効／有効にした実ギターsolo RECを、原音otherと独立な線形STFTで比較。
下表はpitch-class分布のcosine距離（小さいほど近い）。4区間は縮小、2区間は小幅に拡大。
otherの分離漏れ、倍音、録音窓の差を含むため、全67打点の正しさを証明する値ではない。

| seek区間 | 追加注釈なし | 追加注釈あり |
|---|---:|---:|
| electric-sheep-40 | 0.217 | 0.177 |
| hey-8 | 0.385 | 0.348 |
| human-fly-32 | 0.030 | 0.043 |
| i-got-a-feeling-20 | 0.052 | 0.048 |
| sister-185 | 0.370 | 0.288 |
| under-the-moon-97 | 0.328 | 0.331 |

ベースは3,502音中2,828音をYINで再検査し、安定した食い違い16件を抽出。
長さを満たす3件もFFTでは1 octave下への変更を裏付けられず、今回はベースの譜面を変更しない。
ドラムも既存の帯域別transient検査を7曲で再実行。高域検出にはスネアや分離漏れが混ざり、
正確なhatラベルではない。TABASCOのframe fallback、打点漏れ・クラス推定は継続課題。

### 合奏を実出力で確認

通常START／seek／post-master RECの7曲各約8秒を、v415と原音drums+bass+other再結合へ比較。
vocals／melodyはOFF、100%／crunch／ロック／room35%。Human Fly、Electric Sheep、Heyで相対量を調整し、
残る4曲を確認用にした。ギターpeak正規化0.12、ベース0.30、kick0.48、snare／金属0.55。
下表は音量を正規化した主5帯域の差の平均dBで、聴感の点数ではない。全曲の曲別EQ合わせ込みはしない。

| seek区間 | v415 帯域差 dB | v416 帯域差 dB |
|---|---:|---:|
| electric-sheep-16 | 3.64 | 3.21 |
| hey-16 | 4.55 | 4.20 |
| human-fly-16 | 3.58 | 2.88 |
| i-got-a-feeling-16 | 3.32 | 4.05 |
| sister-16 | 5.26 | 1.97 |
| tabasco-6 | 1.77 | 2.03 |
| under-the-moon-16 | 1.99 | 2.78 |

改善しない区間もあり、低中域の不足や高域の差が残る。長い余韻だけで再現完成とは判断しない。
全7区間で予約落ち0、PCM clipなし。bankは53音／13,610,240 bytes（以前11,826,560 bytes）。
準備はSTART後のWorkerで一度、再生は既存のnative BufferSourceと128予約上限を使う。
3音色、4弾き方、seek80／100／120%、60秒連続、mute／復帰／STOP、RESET、cached offline、390pxを確認。
実iPhoneの負荷と主観的な合奏品質は未評価。

[数値・入力hash・実REC・browser検証](arcb-band-measurement-20261012.json)。PCMはignored localのみ。
再実行: `python -X utf8 scripts/refine-guitar-attacks.py --out <local-report.json>`。
`--write`は追加注釈のない元score専用。既存注釈の上書きは拒否する。
分析は既存CPU環境、[librosa YIN](https://librosa.org/doc/0.11.0/generated/librosa.yin.html)などを使用。新しい学習モデルや音源は取得しない。

## 原音からギターの和音・音域を補正（v412 / 2026-10-03）

従来のguitar_lineはbass由来の根音で、ロックの和音は根音・5度・octaveから作っていた。
既存7曲のstereo otherをCPUで解析し、弦の根音と音域をギター側の持続する響きから推定する。
左右を波形のまま足さず、harmonic CQTの振幅を平均して位相キャンセルを避ける。
小節を3区間に分け、少なくとも2区間で同じpitch classが出て、候補間の差と従来音符からの改善が明確な小節だけ採用。
三度はpower chordより明確な根拠が出た3小節だけ追加。major/minorを曲名・keyから決め打ちしない。

887個の音符のある小節のうち234小節、5,426打点のうち1,402打点に和音を採用。
未採用の小節は従来の音符、空白は余韻を保つ。全ての元の打点・duration・velocity、bass/drumsと時計は同じ。
original eventsとotherのSHA256を保存して検査し、再生時は最大3音の小さい配列のみを読む。
解析やモデルはブラウザへ持ち込まない。bank 52音／11,826,560 bytes、amp 7／room 26 node、予約128／8秒のまま。
採用率やtemplate fitは採譜の正答率ではない。otherには他楽器と分離漏れがあり、リフの途中変化・octave・運指は未確定。

実START／seek／post-master RECからギターsoloを7区間、各約10秒取得。
同じv412の補正配列を無効にした基準と、有効な候補を比較し、基準のharmonic sourceが0であることを確認。
両方とも100%／crunch／ロック／room35%、guideと他パートOFF。
推定に使ったCQTやchord templateとは別に、線形STFT（FFT 16,384、hop 4,096、90–2,400 Hz）のstereo平均powerを12音へ集計。
各RECの実content時刻に対応するotherと、正規化したpitch class分布のcosine距離を比較する。小さいほど近い。

| seek区間 | 従来の和音 | 補正あり |
|---|---:|---:|
| electric-sheep-16 | 0.442 | 0.314 |
| hey-16 | 0.695 | 0.679 |
| human-fly-16 | 0.541 | 0.21 |
| i-got-a-feeling-16 | 0.606 | 0.596 |
| sister-50 | 0.606 | 0.456 |
| tabasco-28 | 0.528 | 0.404 |
| under-the-moon-16 | 0.206 | 0.182 |

補正sourceが実際に出た6区間では分布の差が縮小。Heyのこの区間は補正source 0の対照で、微小差は録音窓の差を含む。
これは音色・倍音にも依存する周波数分布の診断で、根音・octave・和音の正答率、人の音質評価、全採用小節の合格ではない。
既知のA／F# sineと逆位相stereoで測定器を確認。mono和のキャンセルを数値へ持ち込まない。

合奏も修正前v411／後v412の実RECを原音drums+bass+other再結合と比較。
主5帯域の正規化差はElectric Sheep 3.78→3.38 dB、Human Fly 3.44→3.43、Hey 5.00→4.97、Sister 2.90→2.73。
quietは前後ほぼ同じ。予約落ち0、clipなし。音高だけを合わせて音量や帯域を崩していないかも確認した。
7曲、3音色、4弾き方、seek80／100／120%、muteと復帰、休みsolo、未採譜guide、STOP、RESET、cached offline、390pxを検査。
実iPhone負荷と主観的な最終音質は未評価。
[採用数・実録音hash・比較数値・browser検証](arcb-harmony-measurement-20261003.json)。音声はignored localのみ。

```powershell
python -X utf8 scripts/measure-guitar-harmony.py --all --out output/playwright/harmony-analysis.json
python -X utf8 scripts/measure-guitar-output.py --captures output/playwright/mix-calibration --out output/playwright/harmony-guitar-report.json
```

## ロックの上下ストロークとミュート（v411 / 2026-10-03）

本人の参考画像は「物理シミュレーションのカッティング、ストロークのアップダウン」という説明。
画像に音声はないため、その演奏の音色や手の動きを測定したとは扱わない。
既存の物理弦bankとampを使い、採譜の時刻・強弱を保ったまま弦を低→高／高→低へ横切る。
方向は曲全体の8分／密な16分gridから決め、小節境界と途中seekでも保つ。
速く弱い非アクセントの刻みだけをロックのミュート候補とし、短い検出durationだけで通常コードを切らない。
「弾き方」でロック／響かせる／カッティング／パームミュートを選択できる。奏法は音符からの推定。

カッティングは開いた弦の和音を共通の短いreleaseで切り、パームミュートは既存の損失の大きい弦bufferを使う。
音色だけの差し替えではなく、方向・弦を横切る時間・音を止める動作の区別を追加した。
bank／DSP／amp／roomと7曲の音符行は同じ。52音／11,826,560 bytes、amp 7 node／room 26 node、予約128／8秒を保つ。
ベース・ドラムの余韻、空白小節、未採譜guide、原音／legacyの挙動も保持。

実ブラウザのOfflineAudioContextで同じC3/G3/C4和音を、既存弦PCM→production crunch ampでrender。
48 kHz mono、attack 0.05秒、gate 0.12秒、弦間7 ms、velocity 0.8、roomなし。
振幅0.0001を最後に超えた時刻は、downの響かせる音2.007秒／cut 0.212秒／palm 0.230秒。
0.3–0.5秒のRMSはopen 0.07286、cut／palmは0。upは弦順が反転しopenのRMS 0.07494。
これは聴覚のT60や原音の奏法正答率ではない。共通releaseと異なる実波形を確認した値。
通常再生の4弾き方でも対応するsourceが増加し、予約落ち0。

同日の修正前v410／後v411を実post-master RECし、原音drums+bass+other再結合と比較。
100%／crunch／room35%／guideとvocals OFF／再構築off、seekから約1.82秒後の10秒。
録音は48 kHz stereo PCM16。既存6帯域の正規化power差と、音量・dynamicsを別々に評価する。

| seek区間 | v410 帯域差 dB | v411 帯域差 dB | v411 LUFS | v411 true peak dBTP |
|---|---:|---:|---:|---:|
| electric-sheep-16 | 3.86 | 3.67 | -15.8 | -4.7 |
| human-fly-16 | 3.66 | 3.54 | -17.8 | -5.8 |
| hey-16 | 4.94 | 5.00 | -18.0 | -6.4 |
| sister-50 | 2.93 | 2.91 | -18.4 | -6.4 |

主5帯域の差はおおむね同程度。全曲の品質改善率として平均しない。
Heyのquiet 0.34秒は前後同じで、分離原音との違いと採譜漏れは残る。
原音に含まれる分離漏れ、録音開始時刻の差、推定和音の限界があり、完全再現とは扱わない。
7曲のSTART、3音色、seek80／100／120%、全muteと復帰、休みsolo、未採譜guide、RESET、cached offline、390pxを確認。
STOP 2秒後peak 0.00000410／pending 0、全script error 0／予約落ち0。
[数値・録音hash・source hash・実ブラウザ検証](arcb-guitar-measurement-20261003.json)。音声はignored localのみ。

## 空白小節への自動伴奏を停止（v410 / 2026-10-02）

採譜のあるパートで、その小節に音符がない場合も旧fallbackが新しいbass／guitar／drum／melodyを足していた。
新ARCBではこの発音を止め、直前の音のreleaseとroom tailは自然に残す。
パート全体が未採譜の場合の楽器伴奏（TABASCOのdrumなど）と、明示的な「再構築」は既存動作を保つ。
歌の音程データがないElectric Sheep／TABASCOはmelodyを鳴らさず、未採譜表示と無効なcontrolで明示。
曲を戻すとcontrolを復帰し、選択の保存値は書き換えない。bank・音色・音符行・余韻・effect node数は変更していない。

Sisterの7–10小節では原音bassが約−64〜−82 dBFS、Human Fly冒頭のdrumsは約−71／−68 dBFSで、
旧自動伴奏を加える根拠がなかった。一方で、音符がない小節には検出漏れもある。
Electric Sheepの52小節はguitar行がないが原音otherは約−19 dBFS。ここは休符の確定ではなく、採譜漏れが残る。
存在しない歌の音程やstrumを生成して、原曲の再現だと見せない。

v409とv410の実post-master RECを、同じseek条件の原音drums+bass+other再結合と比較した。
100%／crunch／room35%／melodyと原音vocals OFF／再構築off、seekから約1.82秒後の10秒。
32–80／80–250／250–1000／1000–4000／4000–12000／12000–16000 Hzの6帯域で正規化した主5帯域の差の絶対値平均を比較する。録音開始の微小差を含み、品質の点数ではない。

| seek区間 | v409 帯域差 dB | v410 帯域差 dB | v410 / 原音 LUFS | v410 true peak dBTP |
|---|---:|---:|---:|---:|
| electric-sheep-96 | 2.45 | 2.58 | -15.5 / -15.7 | -4.7 |
| human-fly-0 | 2.73 | 2.79 | -17.7 / -17.8 | -5.8 |
| sister-16 | 7.57 | 2.94 | -20.4 / -25.7 | -7.3 |
| sister-50 | 7.22 | 3.13 | -18.3 / -23.6 | -6.9 |

薄いSisterの2区間の差は縮小。他の2区間はほぼ同程度で、全曲の改善率として平均しない。
Sisterの音量差は約5 dB、高域・和音・奏法の近似も残る。
合奏の最長quietは0〜0.04秒、予約落ちは0。数値から人の試聴や実iPhoneの合格は主張しない。

実ブラウザのsolo確認でSisterのbass休みはpeak 0／新規source 0、再開区間はpeak約0.103。
Human Flyの冒頭drumもpeak 0／source 0で、その後のscoreはpeak約0.083。
Electric Sheepの未採譜guideはsource 0、Human Flyへ戻すとguideは発音し保存選択も復帰。
390pxで未採譜の説明を確認し、原音・legacyへのcontrol復帰とscript error 0を確認。
7曲のSTARTで有限出力／予約落ち0を確認（sample peak約0.152〜0.357）。TABASCOは未採譜drumの既存伴奏を保持。
全mixの80／100／120% seek・3音色・all OFF／ONも確認。STOP 2秒後peak約0.00000355／pending 0、
RESETとcached offlineはscoreの最初の音を待ってpeak約0.333／0.338。390px横はみ出し0・script error 0。
[数値・録音hash・source hash・solo／mix／offline検証](arcb-rest-measurement-20261002.json)。音声は引き続きignored localのみ。

```powershell
python -X utf8 scripts/measure-band-mix.py --captures output/playwright/mix-calibration --baseline polish-before --candidate polish-after --reference polish-before --out output/playwright/polish-rest-report.json
```

## 合奏音源の補正（v409 / 2026-10-01・履歴）

本人の「分離できていないところも多い。全体の音感として補正も確認して完成」の指示に対応。
入口は[いつものBand Room](../band-room.html?band=tabasco&song=human-fly&mode=synth)。

## 比較した音

Band Roomの実際のSTART／seek／RECから、post-masterの48 kHz・stereo・PCM16 WAVを取得。
原音のdrums・bass・otherをアプリ内で再結合した伴奏と、新しい3楽器の合奏を比較した。
原音vocalsとAI melodyは両方OFF、再構築off、100%速度、ギターcrunch、空気感35%。
6曲は16秒へ移動した約1.82秒後から10秒、短いTABASCOは6秒へ移動した同条件。
元の分離漏れや残る声を、単独楽器の正解として合わせ込まない。

音源bankの補正前baselineはPR #433の音。時計とseekだけ先に修正して録音し、
無音による比較の歪みを除いてから音色を比較した。音色の調整に使ったのはHuman Fly／Electric Sheep／Hey。
残る4曲を確認用に使い、曲別にEQを合わせ込んでいない。RECの遅延と約20–100 msの操作差を含むため、
波形のサンプル一致・打点のF1・原曲の再現率としてこの表を扱わない。

## 変更と実測

- 弦の初期変位とpickのノイズを分離。bassの基音がseedに左右されすぎる状態を抑え、guitarの中域とpickを両立。
- snareの差分white noiseを帯域で色付けし、胴とwireの成分を整理。kickのclickは短い包絡、金属の高域も帯域処理。
- bass／kick／snare／金属とguitarの相対量、短いscoreの後の弦のreleaseを補正。次音のdampingは保持。
- 新ARCBだけ既存polish makeupを3 dB下げ、melody guideも弱める。再生中のeffect node数とWorker bank容量は増やさない。
- 一致する採譜bpm_fitを演奏の時計に使用。途中seekは予約を作り直し、経過済みのattackを再発火せず残りの小節から続ける。
- 実decodeした曲長で最後のsectionだけ補正。I got a feelingで359.431秒のgridに切られた末尾を既存検出器で追加し、以前の行は保持。
  新しいbass／melody行にはvoicing probability 0.65以上を要求し、末尾のvelocityは0.65以下。ギター根音・打楽器クラスは引き続き推定。

帯域は32–80／80–250／250–1000／1000–4000／4000–12000／12000–16000 Hz。
左右の**power**を平均し、全帯域で正規化して比率を比較する。mono和では位相で音が消えるため使わない。
主帯域5区分の差の絶対値平均は、7区間平均で **5.60 → 3.88 dB**（約31%減）。
これは帯域偏りの指標で、聴感の「31%改善」や完成度の点数ではない。

| 区間（seek秒） | 帯域差・補正前 dB | 補正後 dB | 補正後 / 原音 LUFS | 補正後 true peak dBTP |
|---|---:|---:|---:|---:|
| electric-sheep-16 | 3.67 | 3.89 | -15.3 / -17.1 | -4.7 |
| hey-16 | 5.60 | 4.85 | -18.0 / -23.5 | -6.0 |
| human-fly-16 | 5.52 | 3.77 | -17.8 / -17.9 | -6.0 |
| i-got-a-feeling-16 | 6.00 | 2.65 | -17.7 / -21.8 | -5.7 |
| sister-16 | 10.86 | 7.62 | -20.1 / -25.6 | -7.4 |
| tabasco-6 | 4.03 | 1.78 | -17.7 / -17.3 | -6.2 |
| under-the-moon-16 | 3.55 | 2.61 | -18.0 / -22.5 | -5.6 |

Electric Sheepは帯域差が少し増え、高域がまだ不足。Sisterは原音が薄い区間で、fallbackの低音・打楽器を含む差が大きい。
音量も全曲完全一致ではない。採譜漏れ、octave推定、guitar和音と奏法の近似、原音との全曲の完全一致は残る。
これらを分離漏れへ強制的にEQ合わせして隠さない。

## 再実行と根拠

[数値・入力hash・曲長](arcb-mix-measurement-20261001.json)に録音hashと測定条件を保存。
音声ファイルはignoredのlocal出力にのみ保存し、repoへ追加しない。

```powershell
python -X utf8 scripts/measure-band-mix.py --self-test
python -X utf8 scripts/measure-band-mix.py --captures output/playwright/mix-calibration --baseline clock --candidate delivered --reference before --out output/playwright/mix-report.json
```

既存のFFmpegを`--ffmpeg <path>`で指定するとLUFSとtrue peakを追加する。
10秒区間のLUFSであり、曲全体・アルバム全体のラウドネスではない。
方法は[FFmpeg ebur128](https://ffmpeg.org/ffmpeg-filters.html#ebur128)と
[ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en)のラウドネス／true peak測定に対応。
音高の確率付き推定は[librosa pYIN](https://librosa.org/doc/0.11.0/generated/librosa.pyin.html)。
多声音源や分離漏れではoctave誤認があり、これらを無条件のpitch正解率に変換しない。

bankの全52音の有限値／DC／末尾と弦の周期性±20 cent、原創8小節のheadroom・決定性、
採譜時計の7曲の末尾／不整合fitの拒否、elapsed attackの拒否とsource／roomの解放を検査する。
実ブラウザの全mix・3音色・seek／速度変更・STOP／mute／原音往復・RESET・cached offlineは別に確認する。
今回のChrome確認では予約落ち0、STOP後peakは0.00000392、pendingは0。
RESET／cached offlineの出力peakは0.075／0.065、390pxの横はみ出しとscript errorは0。
末尾のRECはI got a feelingの357.853秒付近から10.08秒を取得し、368.101秒でも同じ曲を再生、音源の自動先送りを起こしていない。
実iPhoneの長時間負荷と本人の耳の最終判断は、このdesktopの数値だけで合格扱いにしない。
