# Runtime Browser Listening Checklist

2026-10-28 v443: Human Flyに曲として聴く3版「Shadow Dub」「Acid Drive」「Acid Dub」を同梱。選ぶと音色・原音4パート・速さ・位置をセットし、既存A-Bループを解除して冒頭から明示再生。完走後は次曲へ進まず停止する。Shadow Dubは元のベース／ドラムと声・ギターのDub反響に短いシンセの応答。Acid Driveは原音ベース／ドラムを303と電子ドラムへ交代。Acid Dubは元のドラムを残し303の低音と控えめなハットを加える。ランダムな選曲や64小節反復ではなく、8／24／32／48／64／72／88／96／112小節の曲構成に沿って出入り・フィルター・短い返しを固定。ブレイクから最後の山へ戻り、録音の終わりに向けて追加楽器を減衰。既存保存の1枠は選択だけで上書きしない。調整は折りたたみ、固定・サイコロ・音色・JSON・保存は維持。追加ライブラリ・音源・歌詞・hostingはなし。同じ音声時計と出力を使い、生演奏のテンポ揺れは補正しない。実iPhoneの3版試聴と本人の聴感確認は未実施。cache `hazama-fm-v443` / client `band-room.js?v=br-276` / CSS `band-room.css?v=br-102`。

2026-10-28 v442: Human Flyの「楽器・声で遊ぶ」に、2台の303と合成の電子ドラム5パートを接続。64小節で余白→グルーヴ→ビルド→山場→抜く→戻す展開、場面の手動キープ、個別固定・サイコロと16ステップ編集を追加。固定パートは出入り・音色変化からも保護し、手で触った追加パートは2小節優先。声／ギターの短い音だけを送る暗いエコー、量・明るさ・共通リバーブを追加。元の4パート操作欄をライブ欄へ移し、閉じると元へ戻す。同じSTART／STOP・音声コンテキスト・録音出力を使い、STOP・seek・ミュート・音量0で反響も破棄。保存は303・ドラム・固定・展開・FX・原音4パート・速さ・位置を一括復元し、停止したままSTARTを待つ。旧303保存も音を変えず読み込み。新音源ファイルは追加せず、既存MITのUnifiedSynthとノイズ合成を使用。初期OFF、Human Flyのパート別だけが対象。生演奏の揺れ補正・実iPhoneでの新機能試聴は未確認。cache `hazama-fm-v442` / client `band-room.js?v=br-275` / CSS `band-room.css?v=br-101` / stem mix v10。

2026-10-28 v441: Human Flyのパート別に任意のAcid LIVEを追加。既存acidBrosの303を2台、同じ音声コンテキスト／原音ミックスの全体出力へ接続し、録音の開始位置と採譜BPMを基準に発音。重ねる／ベースを303へ／元の4パート、個別音量・音色・固定・サイコロ、8小節ごとの小変化、端末保存とJSON編集を用意。初期OFF・開くだけでは音声を作らず、STOP／seek／曲・モード切替で旧発音を破棄し、速さの変更は録音に追従。新音源や独立した再生時計は追加しない。音符は根音推定へ追従し、生演奏の揺れを補正するものではない。v440は本人がiPhoneでDub再生成功を確認。Acidの本人聴感／実iPhoneは未確認。cache `hazama-fm-v441` / client `band-room.js?v=br-274` / CSS `band-room.css?v=br-100`。

2026-10-27 v440: v439でも続いたiPhoneの残響レートエラーに対応。Tone 14同梱のSafari向けnullクリア処理が44100 Hz固定のため、残響のリセット・破棄を現コンテキストのレートに合う1フレーム無音で行う。実Toneを通すSafari互換挙動でv439の同じエラーを再現。通常の残響・4パート・Dub展開は維持。実iPhoneでの再試聴は未確認。cache `hazama-fm-v440` / client `band-room.js?v=br-273` / CSS `band-room.css?v=br-99` / stem mix v9 / Dub v7。

2026-10-27 v439: iPhoneのパート別で報告された残響バッファと音声コンテキストのサンプルレート不一致に対応。レート変更時に残響を作り直し、それでもWebKitが拒否する場合は該当残響を省いて4パートとDubのエコーを継続し、互換再生と表示する。通常時のミックス・保存設定・原音は維持。実iPhoneでの再試聴は未確認。cache `hazama-fm-v439` / client `band-room.js?v=br-272` / CSS `band-room.css?v=br-99` / stem mix v8 / Dub v6。

2026-10-27 v438: Band Room上部に更新確認を追加。確認だけでは演奏や録音を止めず、再読み込みは明示操作。開始例外は処理段階と理由を表示し、原因不明のRESET AUDIO誘導を避ける。音源・保存形式・音声経路は変更しない。iPhoneの再生エラー原因と実機確認は未解決。cache `hazama-fm-v438` / client `band-room.js?v=br-271` / CSS `band-room.css?v=br-99`。

2026-10-26 v437: Human Fly Dubの声とギターを呼応させる。声8フレーズを語頭から戻し、語尾をechoへ。ギターは33打点に絞り、10箇所の返答／アクセントを強める。歌の間は反響だけを引き、間で広げ、繰り返しを左右へ渡して暗くほどく。ベース／ドラムの音量・打点・2小節loop・スネア反響と、調和の共通roomは保持。cache `hazama-fm-v437` / client `band-room.js?v=br-270` / CSS `band-room.css?v=br-99` / arrangement v3 / Dub v5。

2026-10-26 v436: 調和とDubの共通空間を更新。声の直接音・EQ・楽器の打感を保ち、19–139 msの近い反射に、52 msから暗く滑らかに減衰する最長720 msの共通残響を加える。声のsendを0.18→0.24へ。単一の手続きstereo IRで、録音素材の追加なし。途中移動・比較・mute・fader zeroで古いroomを消去。調和は元の演奏、Dubは出し引き・loop・echoによる別編曲。cache `hazama-fm-v436` / client `band-room.js?v=br-269` / CSS `band-room.css?v=br-99` / stem mix v7。

2026-10-24 v435: Human Fly Dubを、リズムを保つversionへ組み直す。全体停止と1〜2拍の断片をやめ、ベース／ドラムを土台に声の語尾・ギター・選んだスネアが暗くなるfeedback echoへ応答する。ギターとドラムの帯域、反響の長さ・左右をフレーズで動かし、中盤は2小節のベース＋ドラムを8小節回す。声21・ギター54・スネア45のsource cueをCPUで選定。音源ファイルと曲の長さ・比較位置は保持。cache `hazama-fm-v435` / client `band-room.js?v=br-268` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v434: Human Fly Dubに5つの展開を追加。ベース／ギターの2拍ループ、ギターの1拍ループ、ドラムの2拍ループを既存録音から短く切り出し、ドラム／低音の抜き差し、反響だけの間、最後の1拍の静寂から全員で戻る。約29秒、61秒、127秒、163秒、225秒。音程と曲の長さは変えず、調和と同じ位置で比較。追加音声ファイルはなく、短いコピーだけをRAMへ作る。cache `hazama-fm-v434` / client `band-room.js?v=br-267` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v433: Human FlyのDubを語尾とギターの打点へ合わせる。声6箇所は帯域エネルギーが18 dB以上落ちる位置から引き、ギター7箇所は打点と230 msの胴鳴りを残してから引く。常時echo sendをやめ、選んだ語尾／ストロークだけを反響へ。声は付点8分、ギターは4分で応答し、小さく左右へ返して戻り際は奥へ下げる。ベースとドラムの経路・打点・余韻は保持。cache `hazama-fm-v433` / client `band-room.js?v=br-266` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v432: Human Flyの分離原音から任意のDubミックスを追加。ベースとドラムを保ち、7つの区間で歌とギターを引き、直前のフレーズを暗くなる4回の反響へ送る。調和と同じ位置で比較でき、ミュート・停止・途中移動で古い反響を消す。通常の調和、ライブ原音の補正、AI採譜と音源は維持。cache `hazama-fm-v432` / client `band-room.js?v=br-265` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-23 v431: AIギターの4曲26打点を、固定の和音から原音に裏付けのある単音リフへ補正。分離otherと分離前原音の異なる周波数解析が一致し、声とベースの漏れを抑える判定も通した候補に限定。実native出力で周波数の一致が悪化した3候補は見送り。打点・強弱・音長・奏法、ベース／ドラム、原曲マスタリングと調和ミックスは保持。途中移動で古いTransportの予約が小節位置を進める競合も修正し、全パートを選んだ譜面時刻から再開する。nativeの停止も先読み待ちを挟まず、音声時計の現在時刻で確定する。cache `hazama-fm-v431` / client `band-room.js?v=br-264` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v430: AIベースの休符を分離音源と分離前原音の両方へ照合。5曲8音だけ、譜面の音長より後の追加releaseを制限し、バンドが止まる間を保つ。音程・打点・強弱・譜面の保持音長、楽器bankと−3 dB基準は維持。原曲系は7曲21区間で低中域をさらに削る案を比較し、不採用。本人が評価した原音マスタリング／調和ミックスを維持。cache `hazama-fm-v430` / client `band-room.js?v=br-263` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v429: AIベースの前出を−3 dBで抑え、ほぼ無音の分離音源から最低音量へ持ち上げられた短い検出116音を6曲から除外。前後を含むRMS −65 dBFS未満・peak −45 dBFS未満、velocity 0.16以下・長さ0.25秒以下に限定。残す音符の音程・打点・強弱・長い余韻、ギター／ドラム音源は維持。原曲系のv428調和ミックスは保持。HAZAMAは公開済みの試作として専用入口を残し、Tabascoの通常リンクで未完成バンドが表示される条件を修正。正式昇格は行わない。cache `hazama-fm-v429` / client `band-room.js?v=br-262` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v428: 調和ミックスの共通反射だけを0.65倍（−3.74 dB）へ。7曲28区間で原音・v427・帯域制限案・反射なしの診断案と比較し、追加反射の重なりを控えめにする。直接音、録音済みの余韻、パート間の音量・send比、EQ・反射時刻は保持。gate・圧縮や新しい音源は加えない。cache `hazama-fm-v428` / client `band-room.js?v=br-261` / CSS `band-room.css?v=br-98` / stem mix v3。

2026-10-19 v427: 調和ミックスを分離前原音の28区間と音量を合わせて比較。声の基準を0.86→0.84、2.8 kHzを−0.8→−1.2 dB、全体の3.2 kHz shelfを+0.5→−0.5 dBへ。声のroom sendを0.22→0.18、共通反射は遅い成分を減らして近い反射へ配分。楽器の直接音を遅らせず、圧縮・gate・新しい残響を追加しない。原音ファイル・AI・旧仕上げ・個人のfader設定は保持。cache `hazama-fm-v427` / client `band-room.js?v=br-260` / CSS `band-room.css?v=br-98` / stem mix v2。

2026-10-19 v426: パート別の標準を「調和 · ライブ再ミックス」へ。4音源を従来の曲別boost・EQ・声FXの手前で取り出し、独立した基準音量、声の低域／突出帯域の軽い整理、全パート共通の19–139 msの短い反射でまとめる。新しい圧縮・歪み・長い残響・幅の拡張は加えない。7曲の全長測定で曲別headroomを校正。新しいバランスは80が基準、旧カスタム音量は保存して以前のライブ／厚めで呼び出せる。ライブ原音のv425補正・AI音源・採譜は不変。cache `hazama-fm-v426` / client `band-room.js?v=br-259` / CSS `band-room.css?v=br-98`。

2026-10-19 v425: 分離前の仮ミックス7曲に、26 Hzの低域整理・230 Hzの−1.5 dB・3.2 kHzからの+0.5 dBの軽いライブ補正を追加。圧縮・gate・追加残響・幅の拡張は使わず、原音ファイルを保持する。元の仮ミックスとのA/Bは曲ごとに音量を合わせ、40 msで切替。パート別は歌・ギターほか・ベース・ドラムのminus-oneをワンタップで選べる。分離漏れと元録音の歪みは残り、分離品質の向上を意味しない。cache `hazama-fm-v425` / client `band-room.js?v=br-258` / CSS `band-room.css?v=br-97`。

2026-10-18 v424: AIベースの長い保持音が3秒の音源末尾で途切れる問題を修正。ベースだけ16 kHz／8秒へ延ばし、譜面の音長・自然減衰と次音でのdampingを保つ。53 buffer／15,274,240 bytes、再生node数と128発の上限は維持。原音・採譜イベント・ギター／ドラム音色は保持。分離前原音の終端を7曲の譜面metadataへ結び、ベースのreleaseを録音終端以内に収める。シーク直後の小節処理を確実に起動し、全パートが1小節遅れて鳴るケースも修正。分離前原音も参照し、裏付けの弱い音高変更は不採用。cache `hazama-fm-v424` / client `br-257` / bank v5 / adapter v7。

2026-10-18 v423: 公開環境でCloudflare Pagesの音声Range要求が200の全体応答になることを確認。原音の音声だけを既存の同一Music GitHub Pagesへ向け、206の部分読み込みで途中移動できるようにする。CORSをsrc設定前に有効化し、Web Audioの消音を防ぐ。入口・7音源のbyte内容・共通−2.2 dB・AIの採譜と音色は保持。原音moduleにも版を付け、旧PWA cacheの参照を避ける。cache `hazama-fm-v423` / client `br-256` / CSS `br-96`。

2026-10-18 v422: Tabascoの原音入口は、本人が公開承認した分離前の仮ミックス7曲を1本ずつストリーム再生する。共通−2.2 dBのみ。原音ではstem／AIエンジンを起動せず、パート別・AIは明示リンクで停止して切り替える。原音のオンライン要件、残るにじみ、実iPhone・本人聴感の未確認を明示。cache `hazama-fm-v422` / client `br-255` / CSS `br-96`。

2026-10-16 v421: 原音のライブ経路を各stemのEQ・声のコーラス／残響より前から合流させる。録音に含まれる位相と余韻を保ち、曲別trim・パート音量／ミュート・全体音量・REC・出力保護は共通。声は従来のdry量0.78に合わせる。厚めは従来のEQ／FX経路。ライブでは効かない声FXも無効表示し、設定値は保存する。原音・AIの音源／採譜は保持。数値は録音への忠実度を測るもので、本人聴感・実iPhoneの合格とはしない。cache `hazama-fm-v421` / client `br-254`。

2026-10-13 v420: 原音otherの帯域エネルギーとspectral fluxを照合し、5曲のギター351打点を約12〜65 ms前へ補正。note-offと強弱を保持し、ベース・ドラムと同じ原音時刻に寄せた。連続ストロークの前後で安定し、CQTとlinear STFTの両方が支持する5和音を追加。従来の和音注釈は補正後の各行へ結び直す。原音・他パート・音源bankは保持。分離漏れと未採譜／曖昧な音は残り、完全再現・聴感合格とはしない。cache `hazama-fm-v420` / client `br-253`。

2026-10-13 v419: 短いTABASCOを200打以上の固定条件で除外していた採譜処理を修正。原音drumsから204打を採用し、うち128打を立ち上がりへ合わせ、10打の弱い同時cymbalを補った。曲の進行に沿うドラム譜を通常ARCBで使用する。AIの開始／seekでは音の予約時刻と再生時計を一致させ、look-ahead分の先走りを修正。ギター・ベースの譜面、音源bank、原音と仕上げは保持。クラス推定・分離漏れと実iPhone聴感は未解決。cache `hazama-fm-v419` / client `br-252`。

2026-10-12 v418: 読み込み中に選んだ原音の「ライブ／厚め」とA/B復元を、その後の保存設定の適用で戻さない。操作しなかった場合は従来どおり保存した仕上げを復元する。v417の音作り・採譜・原音ファイルは保持。

## Rhythm alignment and original live master (v417 / BL-050)

- Compare early/middle/late score windows with independent drum spectral flux; check bass split pitch evidence, original note retention, final releases and per-bar limits.
- Capture normal seven-song AI mixes and original full mixes. Read peak, true peak, crest and stereo power as diagnostics, never a realism percentage. Keep audio local.
- Compare original live/dense while playing, reload the saved choice, mute/volume zero, seek, mode changes, Stop and RESET. Space controls only apply to dense/AI; original volume and REC apply to both.
- Verify high-volume original transients remain bounded, dense mode retains previous routing, native bank remains 13,610,240 bytes, no dropped notes and cached offline starts.

## ARCB band adoption (v416 / BL-051 + BL-050)

- Owner explicitly requested normal-song adoption of the three instruments. Run all seven songs, three tones and four articulations with at most 128 sources; Stop/seek/mute/reset/offline must release old sound.
- Verify the 53-buffer bank, quiet/loud snare, natural string and cymbal tails and zero dropped notes in dense playback.
- Native rock fallback must ignore the inactive piano preference. Attack harmony must bind to the exact score row and reject stale/weak metadata.
- Capture post-master mixes and guitar solos; compare with original stems through independent STFT. Preserve the raw recordings, exact timing/velocity and ambiguous notes. Numeric agreement is not a perceptual fidelity score.

## Rhythm audition (v415 / BL-051)

- Before preparation: no Worker, sources, PCM or recording request. Prepare within 30 seconds; cancellation restores controls.
- Bass / drums / band: switch old/new at matched phrase RMS, natural end, Stop, volume and part-change cleanup.
- Exclusive with guitar audition, eight-bar preview and normal ARCB. Hidden/pagehide stop; cached offline prepare/play.
- Capture actual playback PCM for frequency, decay, drum tail, headroom and bass/kick overlap analysis. Numbers do not certify timbre or real iPhone performance.

## Purpose

This checklist makes browser listening the default review path for Music runtime tuning.

Use m4a recording only for milestone comparisons, CarPlay/output-level checks, or when browser listening is ambiguous.

## One guitar audition (v414 / BL-051)

Open the existing Band Room `#br-guitar-audition`. Before Prepare, no audition Worker, PCM or external audio request should occur.
Prepare explicitly downloads four pinned electric-guitar notes (410,784 bytes). Compare new synthesis / previous synthesis / recording at the same volume, from the phrase start each time.
Check the low E attack and ring, E5/A5 chords and short damped notes. The recorded mute is an approximation, and this recording source has not been promoted into ARCB.
Stop during preparation and playback; switch between all three buttons, the eight-bar rehearsal and a normal song. There should be no overlap or delayed restart.
Hide the page while playing, then return: playback stays stopped. A failed / corrupt asset disables the recording choice without retries or substitutions.
Digital pitch, level and decay measurements do not certify perceived timbre, real iPhone performance or artistic adoption.

## ARCB source-backed harmony (v412 / BL-050)

- Native adapter instruments.mjs?v=5 reads conservative bar voicings from the existing seven scores.
- Verify actual harmonic and fallback sources, at most three notes per stroke, all original attack timings and confidence rejection.
- Compare actual guitar solo REC with original other through a separate linear STFT pitch-class representation; CQT template fit is not quality evidence.
- Also compare instrumental full mixes, score rests, all songs/tones/styles, seek rates, mute, STOP, RESET, cached offline and mobile layout.
- Other contains separation bleed; short captures cannot certify all bars, chord accuracy, subjective sound or iPhone load.

## ARCB rock strokes (v411 / BL-050)

- Native ARCB uses instruments.mjs?v=4; the bank/DSP remain v3/v4.
- Eighth-note up/down directions continue across barlines and seeks; dense sixteenths use a finer grid.
- Test all four guitar styles in live playback, all three tones, original/legacy restoration and score rests.
- Isolated post-amp render: open chord retains body; cut releases its strings together; palm uses the lossy string bank.
- Actual START/seek/REC mix before/after; do not interpret spectral distance as a listening score or exact hand reconstruction.
- Verify 390px layout, STOP pending 0, reset and cached offline, errors/dropped 0.

## ARCB score gaps and unavailable guide (v410 / BL-050)

- Solo Sister bass at 18 s and Human Fly intro drums: no generated attacks in empty scored bars, and recorded notes resume later. Keep natural tails; an empty detection is not proof of an acoustic rest.
- Electric Sheep / TABASCO: label the absent melody, disable only its unavailable controls, no invented guide even when its saved checkbox is ON. Return to Human Fly and original/legacy: preserve checkbox selection and restore controls.
- TABASCO's wholly absent drum score still uses its existing pattern; explicit reconstruction remains available. Repeat the all-mix/seek/STOP/RESET/offline checks below.

## ARCB measured mix and continuous seek (v409 / BL-050)

- Compare accompaniment against the recombined original, with original vocals and the melody guide OFF. Separation leakage is not ground truth for a single instrument. Check body, pick/transient, wire/cymbal air and the common decay together.
- Seek early/late and backward while playing at 80/100/120%, then switch original/AI at the same content second. No old-note burst, multi-second scheduler silence or wrong-bar accumulation. Check the guide/full mix too.
- Repeat STOP/restart, all OFF/ON, RESET AUDIO, cached offline start and clean/crunch/drive. Confirm actual post-master recording, no clipping or dropped notes and 390px controls.
- Digital measurements and capture hashes: [ARCB-MIX-MEASUREMENT.md](ARCB-MIX-MEASUREMENT.md). These do not certify perfect transcription or physical iPhone playback.

## ARCB natural sustain and air (v408 / BL-051)

- In AI mode, solo guitar in clean/crunch/drive: short notes must ring between strokes; strings of a chord must not choke each other. Solo bass: the body must survive a short gate, with a smooth change on the next note and no stacked low drone.
- Solo drums: check snare/tom body and ride/crash tail after one hit. Compare air at 0 / 35 / 100%; room must sit behind the attack. Part volume zero must also remove its room input.
- STOP, seek, all off, original/AI switch and RESET AUDIO must remove old notes and room state. Restart must prepare one bank and one room; recording must include the same audible room.
- Check dense bars and about a minute of playback for dropped triggers and clipping, then 390px control usability. Actual iPhone long-session load and the user's judgment of instrument realism remain listening checks.

## Strudel workbench LEVEL / 2-deck audition (BL-049)

- While a LIVE set plays, move MASTER/CUTOFF/KICK and the BPM fader between three- and two-digit tempos. The saved metadata and one `setcpm` must agree; live sound faders must stay connected after the offsets change. The tempo status must show the scheduler's BPM, without evaluating the whole score.
- Small bars show section controls, not measured audio. Check manual MUTE goes to zero, motion zero freezes base cutoff, and Ambient Drift shows no automatic drums. Stop/listening view must hide them; return to controls must show current values.
- Save a changed tempo and timbre, reload, reopen and Play. Stop during preparation and reconnect must never restart a stopped set. On actual iPhone, try body-volume keys and Bluetooth/CarPlay connect/disconnect, then `音を再接続`; its desktop fallback does not certify the device route, hardware volume or long-session load.

For `experiments/workbench/v1/` on its separate Cloudflare Pages URL:

- Compare a loud and quiet published work at the same device output. Set each LEVEL by ear, switch away and back, and confirm the values return without a code-loss dialog.
- Open two published works as A/B. A sets the common tempo; verify B plays at A's speed. Move A/B levels and CROSSFADE left / center / right while playing; center needs enough headroom and should not produce an audible clip.
- Stop, reopen the same `?deck=a,b` URL, then save the combined code as a local draft and reopen it. Neither loading the page nor changing selectors should autoplay.
- Repeat on the actual iPhone browser with its own output volume. Desktop Chromium UI checks and code-level gain checks do not certify perceived loudness, clipping, or two-pattern phone load.

## Listening Loop standalone preview (BL-048)

For `experiments/listening-loop/v1/` only; this is not the FM/Band Room gate below.

- Initial page: zero audio contexts and no Tone script until a Play tap; volume 35%.
- Play each candidate for 20 seconds. Check chord / beat / space differences by ear.
- Early stop, rapid A/B/C switches, volume to zero, then back; no stacked voices.
- Five played seconds enable that candidate's preference. Two eligible candidates
  enable the two negative feedback choices. Muted time must not qualify a candidate.
- Pick B, explicitly make next three, confirm changed parameters and **no autoplay**.
- Hide the tab or lock the physical phone: this experiment intentionally stops and
  closes its own context, unlike FM background radio. Return and tap to start afresh.
- Block circuit/Tone download: clear recovery text, no fake circuit, no autoplay;
  cancel a delayed start and confirm it cannot start after the stop.
- Check 320px and 390px, keyboard focus, expanded source details and memo export.
- Optional JSON export contains only bounded experiment/feedback metadata, no audio,
  private device context or upload. Condition/reset warns before clearing a used session.
- Actual iPhone Safari first tap / lock-return / loudness and musical preference
  remain a human gate even when desktop Chromium and offline waveform checks pass.

## Primary Targets

- iPhone Safari
- iPad Safari
- Desktop local browser for fast iteration
- GitHub Pages for pre-merge and post-merge checks

## Baseline Setup

1. Open Music in a normal browser tab.
2. Press `START` or `START.HZM` once to unlock audio.
3. Set `OUTPUT` around 88 in Hazama FM, or 80 to 88 in the full mixer.
4. Turn `AUTO MIX` on for self-running checks.
5. Keep Console open on desktop checks and watch for red errors.

## Chrome Computer Use Preflight

ChatGPT / Codex から外部 Chrome を使う場合は
[`CHROME-COMPUTER-USE-BASELINE.md`](CHROME-COMPUTER-USE-BASELINE.md) を先に確認する。

1. `scripts/music-machine.ps1 -Json` で machine identity と hostname match を確認する。
2. その PC で実際に使う Chrome profile と、extension を入れた profile が同じことを
   確認する。WorkerPC の検証済み表示名は `ユーザー 2` (`Profile 1`)。
3. `https://quietbriony.github.io` は site-specific allow にし、全サイト許可を Music
   QA の前提にしない。
4. 許可変更後は新しい task を使い、direct URL を開いて操作前 screenshot を先に取る。
5. 拒否、blocklist、browser safety interstitial は迂回しない。permission prompt は
   user 承認範囲の `Allow once` を使う。
6. Chrome task に session 名を付け、`tabs.finalize` を最後の Chrome 操作にする。

## Acid OFF Check

Run for at least 90 seconds.

Expected:

- Xtal/Tha-like haze and drone are the center of gravity.
- Low BPM feels like ambient, not drum-forward.
- Kick, hat, and sub attacks are thin and occasional.
- `hazeBed`, `membrane`, `memoryRefrain`, and `chromeHymn` are audible as a soft moving layer.
- `reedBuzz` appears rarely as nasal/earthy color, not as a constant foreground tone.
- There is no apparent silence longer than about 6 seconds.

Fail signs:

- The kick or low transient feels like the main event.
- The mix becomes only dark low-mid without transparent particles.
- `reedBuzz` repeats too often or muddies the bed.

## Acid ON Check

Run for at least 60 seconds.

Expected:

- Tempo moves into a 120 BPM or higher dance pressure range.
- Pressing `ACID` gives a clear short high-register acid indicator, not only a
  low-end or tempo change.
- ACID high replies keep a small human/organic groove feel instead of locking
  to a rigid grid.
- Acid motion is clear: short bouncy turns, filter movement, and small high replies.
- `coldPulse`, `acidBiyon`, `sub808`, and `ghostBody` become more prominent.
- 808/body pressure is present but does not crush the limiter.
- Hats and micro-pulses provide speed without turning into a constant noisy loop.

Fail signs:

- Acid ON still sounds like the ambient state.
- Pressing `ACID` does not create a recognizable high acid sign.
- ACID replies feel quantized, stiff, or machine-looped.
- Low-end blooms continuously or clips.
- The mix becomes bright EDM rather than dark acid/IDM pressure.

## Hazama FM Acid Cue Check

Run this when a PR touches `fm.js`, `engine.js`, service-worker cache busting,
or the acid / groove path.

Setup:

1. Open `fm.html`.
2. Select `techno`.
3. Press `START`.
4. Let it run for at least 90 seconds, then switch briefly to `any` and back to
   `techno`.

Expected:

- `techno` starts with a short acid cue, not a permanent `ACID.ON` lock.
- `window.MusicRuntimeState.acid.transient` rises briefly and decays.
- `window.MusicRuntimeState.acid.transientSource` starts with `hazama-fm.`.
- The FM surface remains one-button/simple; no extra acid control is exposed.
- High-register acid replies are audible enough to identify the genre shift,
  but do not make Hazama FM tiring as a focus radio.
- Groove still feels slightly human/organic rather than rigidly quantized.

Fail signs:

- `techno` sounds identical to `any` except for louder drums.
- The transient never decays, or behaves like the visible Core Rig `ACID` lock.
- The acid cue overfills the mix or fights the long-form radio rotation.

## Hazama FM PWA Refresh Check

Run this when a PR touches `sw.js`, `fm.html`, or installed-app cache busting.

- Open `fm.html` from a local server, not a `file://` URL.
- Confirm the current FM surface appears, including recent controls such as
  `shuffle`, `AI fill`, DJ set buttons, mic follow, and `40HZ`.
- Confirm cache markers match exactly across `fm.html`, `index.html`,
  `band-room.html`, and `sw.js`. Current repo markers include
  `engine.js?v=fm-119`, `fm.css?v=fm-54`, `fm.js?v=fm-72`,
  `audio/genre-flavor.js?v=fm-81`, `audio/ai-fills.js?v=fm-71`,
  `style.css?v=fm-28`, `band-room.css?v=br-96`,
  `band-room.js?v=br-251`, `audio/audio-safety.js?v=br-68`,
  `manifest-band-room.webmanifest?v=br-icon-1`, and `hazama-fm-v418`.
- For v395 Tabasco inventory retirement, update an existing installed PWA and confirm the
  old `hazama-fm-v394-*` caches are removed after activation. With the network disabled,
  confirm Band Room still lists all 7 Tabasco songs, loads their drum frames and final lyrics,
  while `presets/tabasco-songs.json` is absent from `PRECACHE_URLS`. The network-free
  `check-tabasco-songs-catalog.mjs` enforces the source-side contract before this browser pass.
- For v394 sample-cache classification, select one pinned Tonejs/audio family online,
  reload it once, then confirm the same family can be resolved from the runtime cache.
  `check-external-dependencies.mjs` statically passes all 21 catalog roots through the
  exact Service Worker classifier before this browser check.
- For v393 dependency lock, confirm the online catalog still lists 21 sources, a
  selected CDN source loads only after user selection, and synth fallback remains
  available when it fails. This manual pass does not download or execute ACE-Step,
  Demucs, or Whisper; their revisions and repo-external storage are static-gated by
  `scripts/check-external-dependencies.mjs`.
- For v392 playability docs, confirm README exposes the public Listen / HAZAMA /
  Band Room / Lyric Lab entries and that Manual owns the shortest HAZAMA → START →
  recovery → Lyric Lab path. Usage should point to that contract, not claim that
  audio, mobile, car/Bluetooth, or HAZAMA selector promotion passed automatically.
- For v391 Listen hub, open `listen.html` and confirm the first listening pass
  points to `band-room.html?band=hazama`, exposes the `?aiLight=1` phone-light
  comparison and `lyric-lab.html` handoff, and separates the 60–90 second quick
  pass from the roughly six-minute arc. v299 Funk and v301 Human Fly must read
  as historical evidence, not the current pass. This is a route/copy check;
  sound quality, mobile stability, and HAZAMA selector promotion remain BL-041.
- For v169 Hazama FM melodic director, let FM run for at least 16 bars and
  confirm `window.MusicRuntimeState.melodicDirector` changes key/contour over
  phrases while playback stays smooth.
- For v170 Hazama FM / Music Core Rig bassline director, confirm
  `window.MusicRuntimeState.basslineDirector` exposes phrase pattern/gate and
  lofi/dub/main synth bass do not stay on a fixed root/5th loop across phrases.
- Confirm the Hazama FM route badge is visible near the controls. It should
  show `off` while idle, then `direct`, `ready`, `bridge`, or `failed`
  depending on the hidden media bridge state.
- Open the route badge panel and confirm `route` / `bridge` / `event` /
  `output` / `context` update. During playback, tap `rearm`; failed rearm must
  return to direct output rather than leave playback silent.
- If Band Room changed in the same PR, also confirm the current `band-room.css`
  / `band-room.js` / `audio/audio-safety.js` markers (see the marker list
  above) and `band-room.html` references match `sw.js`.
- For v399 HAZAMA playability, open the four direct cases from Listen:
  01/02 × `📻 原音` / `🎛 AI 再現`. Confirm each query keeps the requested song
  and mode, START names that context, stem loading shows about 33 MiB plus
  ready/checked progress, and 02 AI clearly says that it provisionally shares
  01 frames while 02 original is the reference. AI START must remain responsive
  on 01 and 02; `?aiLight=0` is diagnostics-only. START must not enter `playing`
  if asset prep reports failure. With keyboard focus on a button/link/details summary,
  Space must retain that control's native action rather than toggle transport.
  Switch HAZAMA -> Tabasco and confirm Tabasco returns to `📻 原音`; a synth
  choice made explicitly on Tabasco should still remain intentional.
  While `WARMING UP` / `PREPARING AI` is visible, band, track, and mode controls
  should be temporarily disabled. Simulate a denied AudioContext or failed
  asset fetch and confirm START returns to idle with recovery text; pressing
  REC or stems-pack in that state must not begin a silent recording.
- For v400 HAZAMA audition clarity, confirm provisional 02 AI shows a visible
  warning that it is not a 02-specific arrangement, is playing 01 AI frames,
  and uses 02 original as the comparison reference. Open the 01/02 KARAOKE
  links and confirm `mix=karaoke` opens original stems with vocals OFF and the
  START context says KARAOKE. Switch to Tabasco and confirm its original vocal
  returns. Track 02 must report its lyrics as unregistered rather than showing
  01 words through the shared `Still Moving` title prefix.
- For v401 HAZAMA pocket, use both 01 AI and provisional 02 AI. Press `all off`
  and confirm arp also turns OFF; `defaults` and `all on` must turn arp ON.
  Listen 30–90 seconds each to `drums + bass`, `drums + arp`, and
  `drums + bass + arp` with vocal OFF, then the default mix. Record whether the
  short-note packing is isolated to arp, bass, vocal guide, or the combined mix.
  If the short pass is stable, continue through the roughly six-minute section
  arc. Repeat START and the physical lock/unlock lifecycle on an actual phone
  Safari tab or installed PWA; a Surface pass does not satisfy this mobile gate.
  Do not remove `ui_hidden` until v401 sound and real-mobile stability both pass.
- The lifecycle check called "lock/unlock" means: while playback is active,
  lock the physical device so its screen turns off, wait 10 seconds, unlock the
  device, and return to the same Band Room tab. Confirm audio continued or
  resumes cleanly without a stuck note. This is unrelated to Chrome site
  permission, Computer Use permission, or revealing a hidden band. Separately,
  switch HAZAMA -> Tabasco to test mode/palette restoration.
- For v168 Band Room saved mix migration, load with old v166 default slider
  values in `band-room.prefs.v1` and confirm only exact old defaults migrate to
  the v168 default mix while custom slider values remain untouched.
- For v167 Band Room default mix polish, play both 原音 and AI 再現 at the
  default slider values and confirm the master limiter is not audibly pinned,
  vocals sit forward without harsh sibilance, and AI bass/guitar/chords leave
  headroom for the source-derived drum accents.
- For v166 Band Room AI part agents, switch to AI 再現 and confirm bass /
  guitar / vocal / chords respond to the current source song's section changes.
- For v165 Band Room timeline, confirm the seek bar shows elapsed/duration
  in `m:ss`, can seek while paused, and START resumes from the chosen position.
- For v163 Band Room lyrics, confirm the footer shows only
  `final singable` and the lyrics panel loads `docs/tabasco-lyrics-final.md`.
- In offline mode, reload Band Room and confirm
  `docs/tabasco-lyrics-final.md?cb=...` plus
  `presets/drum-frames-tabasco-*.json?cb=...` resolve from the precache rather
  than showing `(lyrics file not available offline)` or `[Band Room] loadSong failed`.
- For v161+ Band Room album flow, let 02 `HEY` play past its structure end and
  confirm it does not auto-advance before the stem/catalog duration completes.
  On iPhone Safari, lock/unlock once during playback and confirm it recovers
  without a stuck single-note loop.
- For v157+ Band Room/Drum Floor roundtrip, open
  `band-room.html?from=drum-floor&band=tabasco&song=hey` and confirm it loads
  02 `HEY`, while plain `band-room.html` still reloads to 01 `TABASCO`.
- For v159+ FM/Drum Floor direct handoff, open FM, select a genre, and confirm
  `drum floor →` points to `drum-floor/?from=fm&g=...&energy=...&bpm=...`.
  In drum-floor, playback must remain manual; stale Band Room packet should not
  override a mismatched `from=fm` query.
- For v164 Chill routing, confirm Music Core overview exposes `Chill`, opens
  `chill/session.html`, and the chill session remains silent until a human
  presses `START`.
- Confirm browser console has no service-worker registration or update errors.
- Close and reopen the installed app after merge; if the old UI remains, open
  the normal browser tab once, reload, then reopen the installed app.
- Do not auto-reload while playback is active. Update reload should only happen
  from the idle app surface.

## Hazama FM Genre Source Check

Run this when a PR changes `audio/genre-flavor.js` or genre preset rendering.

Techno setup:

1. Open `fm.html`.
2. Select `techno`.
3. Press `START`.

Techno expected:

- `window.GenreFlavor.state.source` starts with
  `drum-frames+machine-acid-brain+chord-lift` and may include safety
  suffixes such as sidechain depth and production governor metadata.
- `window.GenreFlavor.state.masterLevel` follows the visible `OUTPUT` slider
  and remains below the internal limiter ceiling.
- `Tone.Transport.bpm.value` settles near 132 BPM.
- The drum frames still drive the rhythm, but the sound reads as stripped
  machine drum: deep four-on-floor kick, restrained offbeat hat, and short dry
  clap/snare.
- A light acid pulse continues underneath the transient cue without turning on
  Core Rig `ACID.ON`.
- The acid pulse is identifiable as a resonant byoing line, not only a bright
  cue at the moment the pill changes.
- The low floor is stronger than `any`, but not limiter-crushed or boomy.
- The 16th-note hat grid is mostly removed; hats read as sparse machine ticks,
  not foreground shaka-shaka.
- In high BPM sections, short 32nd/64th-feeling acid/click/texture ratchets
  create brain-dance motion without becoming a constant hat loop.
- After `SYNC`, `performance_state.hazama_fm.listening_trace` includes the
  techno dwell and any genre switches made during the listening pass.
- The visible `SYNC` control reports a saved genre/dwell status without
  interrupting playback.
- After `SYNC`, `performance_state.hazama_fm.review_cue.short_label` is
  `techno balance`, and `routing.openclaw.next_action.fm_review_cue` carries
  the same metadata-only cue.
- After `SYNC`, `performance_state.hazama_fm.conversation.role` is one of
  `bass-call`, `comp-answer`, `drum-comment`, `space`, `lead-call`,
  `bass-answer`, `comp-lift`, or `recap`.
- The visible `SYNC` status includes the cue, for example
  `saved techno 12s -> techno balance`.

Piano setup:

1. Open `fm.html`.
2. Select `piano`.
3. Press `START`.

Piano expected:

- `window.GenreFlavor.state.source` ends with
  `+foreground-piano+planing-reply`.
- `window.GenreFlavor.state.scheduled` is greater than `1`.
- `Tone.Transport.bpm.value` settles near 68 BPM after the profile lands.
- Piano chord bed, memory reply, and soft melody are all designed to sound,
  while the surface still leaves long quiet spaces.
- A dry hammer/attack foreground anchor makes the piano audible as the pill
  identity, not only as hidden metadata.
- The Music engine pad/glass/electronic-harp tail is suppressed enough that the
  flavor piano is the foreground object.
- After `SYNC`, `performance_state.hazama_fm.listening_trace.current_genre`
  is `piano` and `dwell_ms_by_genre.piano` is greater than `0`.
- After `SYNC`, `performance_state.hazama_fm.review_cue.short_label` is
  `piano foreground`, and the next action points toward a chill comparison
  rather than another blind Music-side sound patch.
- The visible `SYNC` control can be pressed from the FM surface without opening
  Core Rig.

Other genre source sanity:

- `ambient`: `window.GenreFlavor.state.source` starts with `namima-preset:` and
  stays calm/water-safe, not dark club ambience.
- `lofi`: source is
  `drum-frames+dusty-break-kit+vinyl-crackle+jazz-dust+session-breaks`;
  Salamander piano trio / breakbeat remains the body, and crackle / jazz dust
  reads as a thin memory layer, not loud foreground noise.
- `jazz`: source is
  `drum-frames+live-jazz-kit+walking-bass+brush+piano-comp+session-breaks`;
  ride/brush motion, walking bass, and sparse comping make it feel like a
  live writing-room session.
- `funk`: source is
  `drum-frames+live-funk-kit+ep+clavi+rubber-bass+session-breaks`; rubber
  bass and pocket breaks add body without turning the loop into a busy solo.

Shuffle audition sanity:

- Press `shuffle` before `START`. The visible genre should move away from
  `any`, the energy pill should change, and first audio should start from that
  selected genre rather than from the default `any` bed.
- While playing, `window.HazamaFmShuffleAudition.state.enabled` is `true` and
  `timerActive` is `true`.
- While playing, shuffle/manual/`any` genre changes should feel like a short
  DJ crossfade: slight output dip, genre source switch, then a smooth return.
- `window.HazamaFmShuffleAudition.step("check")` switches to another concrete
  genre and records the transition in
  `window.HazamaFmListeningTrace.snapshot().transitions` with a
  `shuffle.check.djmix` reason.
- Shuffle audition is only a listening-test accelerator. It should not change
  Music full mixer `AUTO MIX`, the genre source builders, or the hidden engine
  shim.

SYNC metadata sanity:

- `window.MusicSessionPacket.build().performance_state.hazama_fm.genre`
  matches the current FM pill.
- `performance_state.hazama_fm.integration_mode` is `metadata-only`.
- `performance_state.hazama_fm.engine_translation.profile` matches the current
  FM pill when opened from `fm.html`.
- `performance_state.hazama_fm.review_cue` and
  `routing.openclaw.next_action.fm_review_cue` are metadata-only objects with
  `human_review_required: true`.
- `performance_state.hazama_fm.conversation` is metadata-only and contains only
  abstract role/motif/rest/density data, not a melody, chord progression, or
  audio reference.
- The packet gives other stack repos a role/edge/feedback hint, but does not
  auto-start, record, import samples, open MIDI, or merge anything.

Fail signs:

- `techno` still reads as generic noise hats plus soft membrane kick.
- `techno` has a constant foreground shaka-shaka hat grid.
- High BPM techno/IDM has no extra micro-ratchet or mental dance motion.
- Acid motion is only a one-shot cue and never appears as a light pulse.
- `piano` uses the recipe but sounds effectively absent.
- `piano` still has the same glassy/harp-like Music engine tail heard in other
  genres.
- `piano` becomes busy pop melody and loses the quiet chill identity.

## Reference Breadth / RDJ Edge Check

Use this when reviewing whether Music is carrying the reference-driven spread,
including the Xtal/Tha center and the Richard D. James-adjacent wrongness, as
Music-specific behavior rather than quotation.

Setup:

1. Press `START`.
2. Turn `AUTO MIX` on.
3. Keep Console open.
4. Run the three short states below for at least 60 seconds each.

State passes:

- `CULT=HAZE`, `IDEA=AUTO`: Xtal/Tha-like haze is the center. The bed feels
  soft, long, and gently pulsing; drums remain thin and occasional.
- `CULT=BROKEN`, `IDEA=WILD`: Autechre/RDJ-adjacent micro-events appear as
  short local edits. They should bend the surface without turning into a busy
  machine-gun loop.
- `CULT=ACID`, `ACID.ON`: rubber/pulse behavior becomes clearer. The body can
  move, and a short high acid sign should be audible, but the floor should stay
  dark and controlled rather than becoming bright EDM pressure. High replies
  should keep a slightly human/organic pocket.

Console evidence:

```js
window.MusicRuntimeState.referenceMorph
window.MusicRuntimeState.rdjGrowth
window.MusicRuntimeState.signatureCells
window.MusicRuntimeState.selfReview
```

Expected:

- `referenceMorph` has visible `haze`, `broken`, `pulse`, `chrome`, and
  `organic` values across the three states.
- `rdjGrowth` exposes `toy`, `rubber`, `wrong`, `tender`, `edit`, and
  `restraint` without making the runtime quote a reference track.
- `signatureCells` brings back `memoryPluck`, `ghostGlass`, `brokenTexture`,
  or `lowBreath` as small recurring colors.
- `selfReview.referenceFit` is useful as a sanity signal, but it is not a
  substitute for listening.

Fail signs:

- The reference spread only reads in docs or console and not in the sound.
- Xtal/Tha turns into generic pad ambience with no fine particles or pulse.
- RDJ-adjacent wrongness becomes novelty, harshness, or copied motif language.
- Autechre-like edits erase the soft floor instead of adding local disruption.
- ACID adds volume and brightness more than rubber motion or dark pulse.
- ACID changes the low/body state but has no clear high-register indicator.
- ACID high replies sound rigid rather than human, rubbery, or organic.

## AUTO ARC Check

Use `ARC.36` when reviewing album-length self-running behavior.

Setup:

1. Press `START` or `START.HZM`.
2. Turn `AUTO MIX` on.
3. Set `ARC` to `ARC.36`.
4. Keep `OUTPUT` around 88 in Hazama FM, or 80 to 88 in the full mixer.

Expected long-form order:

- `ARC.SUB`: low BPM haze/drone, thin drums, membrane, chrome, rare reed buzz.
- `ARC.MEM`: warped memory, pluck-like refrains, softened recurrence.
- `ARC.AE`: broken micro-events, short repeat, dry fragments.
- `ARC.GST`: ghost pulse, body pressure, dark transient.
- `ARC.ACD`: 120 BPM or higher acid/808/body pressure without forcing the visible `ACID` button on.
- `ARC.XHL`: chrome air, open tail, return to soft space.

Fast review:

- Listen for 5 minutes and confirm that `window.MusicRuntimeState.albumArc.progress` advances.
- Listen past 7 minutes or temporarily inspect `window.MusicRuntimeState.albumArc` to confirm chapter movement.
- Manual pads should still work during every chapter.
- Turning `ACID` on manually should override and strengthen the acid behavior, not fight `ARC.36`.

Fail signs:

- `ARC.36` sounds the same as `LIVE`.
- Chapter transitions create abrupt bursts.
- The ACID chapter crushes the limiter or overfills the bass floor.
- Submerge/Exhale become drum-forward instead of drone-forward.

## AutoMix / Hazama Background Check

Use this to confirm self-running behavior without relying on visible UI animation.

1. Start playback.
2. Enable `AUTO MIX`, or load a `#hazama=` profile and press `START.HZM`.
3. Listen for at least 60 seconds with the page visible.
4. Switch to another app or hide the tab.
5. Wait at least 60 seconds.
6. Return to the page.

Expected:

- Audio continues as much as Safari allows after the initial user unlock.
- AutoMix/Hazama motion still changes musical state while the page is hidden.
- Returning to the page does not require reload.
- Pads are not stuck on.
- `STOP` still releases voices and stops playback.

Fail signs:

- Music becomes static when the screen is hidden.
- AudioContext resumes but the musical state no longer evolves.
- Returning to the page causes a burst, stuck pad, or silence.

## Pad Check

Press each pad for 3 to 5 seconds.

- `DRIFT`: floating glass/memory movement over the bed.
- `REPEAT`: short micro-repeat and visible tic/glass fragments.
- `PUNCH`: body accent without low-end overload.
- `VOID`: density opens into air, not mute.

## Quick Desktop Pass

Use this before creating or merging a runtime PR.

1. `node --check engine.js`
2. `git diff --check`
3. Start local static server.
4. Load `http://127.0.0.1:<port>/?v=<branch>`.
5. Run Acid OFF and Acid ON checks.
6. Run pad checks.
7. Run Hazama hash boot if the PR touches bridge/autonomy behavior.
8. Confirm Console has no red errors.

## Browser Loudness Check

Use this when browser output feels small compared with iPhone Apple Music or
other normalized app playback.

- Start from `OUTPUT` 88 in Hazama FM. Briefly check 90+ only if the
  device still feels quiet. Use 80 to 88 in the full mixer first.
- Compare `fm.html` `any`, `techno`, and `piano` without changing OS volume.
- Expected: browser playback should feel usable without maxing the OS volume,
  while the GenreFlavor compressor / limiter prevents harsh clipping.
- Expected: changing `OUTPUT` changes both the engine bed and GenreFlavor
  foreground enough to feel like one browser app, not two unmatched outputs.
- Expected: `OUTPUT` 90+ is near the audition ceiling, not required for normal
  listening, and should still sound like level, not distortion.
- Expected: `techno` is louder through drum/body and acid pulse, not through
  constant bright hiss.
- Expected: `piano` is foreground piano with space, not a low hidden pad.
- Fail sign: raising `OUTPUT` only makes the same thin layer louder.
- Fail sign: Hazama FM feels louder only because the flavor limiter is pumping
  or the same reverb tail becomes more constant.
- Fail sign: limiter pumping, brittle hats, or bass splatter appears at the
  Hazama FM default output.
- Fail sign: the limiter audibly flattens jazz/funk breaks or piano attacks.

## Recording Fallback

Record only when needed.

- Use m4a recording for major audio character milestones.
- Use m4a recording for output/CarPlay/Bluetooth loudness comparisons.
- Use m4a recording when two browser listening passes disagree.
v426実行項目: 7曲×6パート条件、STOP後無音、新旧fader独立・保存・基準復帰、3 profileの音量0、全体RECの有音／無音、mobile幅、原音7曲、AI7曲、旧PWA更新／offline AI。証跡: output/playwright/coherent-live-20261019 と対応PR。実iPhone・人間試聴は未確認。
