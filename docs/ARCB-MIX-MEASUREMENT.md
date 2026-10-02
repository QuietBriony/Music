# ARCB — 合奏の測定と補正（現行 v410）

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
