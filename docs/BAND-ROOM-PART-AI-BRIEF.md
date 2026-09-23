# Band Room パート別 AI 完成 — 引き継ぎブリーフ（2026-09-23）

新しいチャット（Claude / Codex）が最初に読む文書。対応する backlog は **BL-050**。

基準の状態：Music commit `1c31d10`、sw `hazama-fm-v402`（sw.js:10）、`band-room.js?v=br-236`（band-room.html:30）。
行番号はこの時点のもの。略号：BR = band-room.js、T = scripts/transcribe-stem-lines.py、L = scripts/check-band-room-logic.mjs。
作り方：パート別の読み取り 6 体 + 曲データ／道具 + 履歴／制約の調査 → 統合 → 照合役がコードと突き合わせて 11 件訂正・9 件補足。

## 1. 目的と「完成」の定義

- AI 再現は、オーナーが 2026-07-23 に承認したとおり **練習・ジャム用のレーンとして凍結**。音色を磨く作業は再開しない。品質は ACE-Step の render を原音 stem として鳴らす別レーンが担う。
- AI 再現の価値：テンポ変更、パートごとの mute / solo、再構築マトリクス、オフラインですぐ鳴ること。
- **完成とは**：各パートが原曲の stem に対して **発音タイミング・強弱・音高と和音・曲の構成** の 4 点で忠実で、iPhone の予算内に収まっていること。音色は判定対象外。
- 合否は **light 経路** で判定する。light になる条件は `?aiLight`、saveData、mobile / standalone、`hardwareConcurrency ≤ 8`、`deviceMemory ≤ 8`（BR:919-929）。Chromium は deviceMemory を 8 で頭打ちにするので、実質すべての Chrome desktop も light。HAZAMA は `denseAiSongRequiresSafety` で全端末 light（BR:939-947）。
- **判定は測定で行う**。オーナーは試聴の判定を AI に委任している（2026-09-23）。各ステップで iPhone 確認を求めない。オーナーは聴いて違和感があったものだけ上書きする。

## 2. パート別の現状

| part | 生成方式 | 実データ | 既知の問題（測定・コード確認済み） | 完成条件（提案値） |
|---|---|---|---|---|
| drums | drum_line を再生（BR:6313-6333）。行のない小節は frame パターン経路（BR:6843-6844） | Tabasco 6 曲。`tabasco` は 194 打で T:377 の絶対数ゲートに落ちた（密度は正常）。HAZAMA は手書き frame | ・hat が 1 小節 0.5〜1.4 打（原曲は Human Fly 9〜16 小節で強い高域 onset 約 40 打＝約 5 打／小節）<br>・kick の一部が本物より 46〜118 ms 早い<br>・light の間引き（BR:6139-6160）はクラスを見ない。BR:6134 のコメント「kick/snare/crash は残る」は誤りで、human-fly は K25・S65・crash2、sister は K46、electric-sheep は S33・crash4 を落とす<br>・section 頭の crash ヒント（BR:6788-6797）が採譜のある曲にも重なる<br>・frame 経路の light フィルタ（BR:6896-6906）は hat を 1・3 拍の頭だけ残し ghost / fill を全部落とす。HAZAMA・曲 `tabasco`・行のない 61 小節すべてに効く | F1（±30 ms）K ≥ 0.90、S ≥ 0.95、H は 0.70 から 0.80 へ／crash 再現率 ≥ 0.8／\|Δt\| 中央値 ≤ 10 ms／強弱相関 r ≥ 0.75 |
| bass | bass_line（BR:6163、light は 1 小節 4 音・音長 2.8 step）。行のない小節は kick 追従ルール（BR:6385-6443） | Tabasco 7 曲。HAZAMA は手書き 16 step（BR:6711） | ・light で 8〜42% が落ちる<br>・行のない小節は休符とは限らない（sister は 26 小節、うち chorus-1 に 8。pyin の取りこぼしに見える） | onset F1 ≥ 0.85（±50 ms）、pitch class 一致 ≥ 90%、音長比 0.7〜1.3 |
| guitar | guitar_line（BR:6337、light は 1 小節 4 打・1 打 2 音・1.6 step）。行のない小節はルール（BR:6459-） | Tabasco 7 曲 | ・音高は採譜ではなく chord の根音（T:224-225）<br>・light で 18〜61% が落ちる | 刻みの F1 ≥ 0.75、根音・chroma 一致 ≥ 70% |
| chords | pad（BR:6574）。light では作られない（G-6、BR:2451） | bass から出した 1 小節 1 根音、名前は全部 major（T:436-441） | ・major しか無いので、**minor の曲（i-got-a-feeling、electric-sheep、tabasco）で voice の代替旋律の 3 度と、演奏者が読むコード表示が誤る**（chordToNotes は "" を [0,4,7] 扱い）。iPhone でも影響するので優先度は低くない | maj / min 一致 ≥ 80% |
| voice | vocal_melody（BR:6542、light は 1 小節 4 音）。行のない小節は生成で歌う | hey、human-fly、i-got-a-feeling、sister、under-the-moon（electric-sheep・tabasco は無し） | ・light で 26〜40% が落ちる<br>・**休みの小節でも歌う**：voiceAgentPlan が空を返すのは chord 無し・intro・outro だけ（BR:5904-5913、確認済み）<br>・i-got-a-feeling の verse-3 は行のない小節が 8（取りこぼしの可能性） | F1 ≥ 0.70（±70 ms）、±50 cent 以内 ≥ 75% |
| HAZAMA arp / bassline | 手書き 16 step（BR:6642、BR:6711）。v401 で 1 小節 20〜21 打の authored-rest | stem はある（presets/hazama-stems/*）、採譜は無い | 何を正解とするか未決。02 は 01 のコピーを gate が要求（L:162-166） | 保留（HAZAMA は別判断） |
| 構成（全パート共通） | Transport は名目 bpm（BR:7271）、採譜行は bpm_fit のグリッド（T:77、T:195、T:287 の step_sec） | — | ・**bpm_fit は約 2.3% 刻み**（60·22050/(256·lag)：117.45、120.19、129.20、132.51、161.50）。hey・i-got-a-feeling・tabasco の「テンポずれ」はこの粗さで説明できる部分がある<br>・human-fly は 117 で鳴らし 117.45 のグリッドなので 1 小節約 8 ms ずつずれる（8 小節で約 63 ms）<br>・i-got-a-feeling の末尾欠け（T:343 の total_steps） | section 境界のずれ ≤ 1 拍、原曲カバー率 ≥ 95% |

## 3. 測り方（part-fidelity ハーネス）

**正解側**：`presets/{tabasco,hazama}-stems/<song>/{drums,bass,other,vocals}.mp3`。採譜と同じ検出器で自己採点しないよう、drums は帯域別 spectral flux、bass・voice は YIN、guitar は拍ごとの chroma で別に測る。`scripts/analyze-band-stems.py`（librosa の kick / snare タイミング）が再利用できる。

**候補側**：JSON ではなく **Band Room が実際にスケジュールするイベント**。G-6 と同じ Node vm（L:1454-1472）で iPhone 相当と desktop 相当の navigator を与え、triggerAttackRelease を記録する stub を差す。1 小節をスケジュールする hook を BandRoomTestHooks（BR:4609）に足す必要がある（transcribed 系 helper は今は公開されていない）。

**固定する条件**：`micFollowVelocityScale`＝1（BR:10495）、tempoMult＝1（ms 単位の補正はテンポに比例しない）、kit source（Tabasco の START は生成 synth kit：BR:3486-3497・3679。tabasco / human-fly の one-shot は HAZAMA の light だけで、立ち上がりはファイルごとに 0〜58 ms と違う）、`?aiLight`、**再構築マトリクスは off**。section ごとの音量（rampInstrumentBusForSection）が強弱に上乗せされることに注意。

**時間合わせ**：Transport は名目 bpm、行は bpm_fit のグリッドなので、全体を 1 つの offset で合わせると Human Fly は 8 小節で約 63 ms 流れる。**小節ごとに合わせる**か bpm_fit で測る。

**指標（パート × クラス）**：P / R / F1（±30・±50 ms）、\|Δt\| の中央値・p90・符号付き平均、強弱の相関 r、小節ごとの密度相関、light の間引き率、1 小節の最大トリガー数。

**実例（受け入れ条件）**：2026-09-23 に Surface で、採譜データの時刻・強弱を原音ドラム stem の帯域別 onset と照合した結果（Human Fly 9〜16 小節、Drive packet `2026-09-20_human-fly-drums-8bars-v1` の A / B を使用。人の判定ではない）。
- snare 21/21・中央 8 ms・r 0.83／kick 34/41・11 ms・r 0.66（5 打が 46〜118 ms 早い）／hat は原音約 40 に対し 5。
- 「16〜36 ms 遅れ」は build-review.py の検証用合成キットの立ち上がりで、**Band Room の kit の値ではない**。Band Room の kit の遅延は別に測る。
- ハーネスの最初の受け入れ条件は、この数値をおおむね再現すること。

**環境**：librosa は Surface の `C:\workspace\tools\Python313\python.exe`（ARM64・librosa 0.11.0）にある。PATH 先頭の Python には無い。Surface の PATH に ffmpeg は無く、imageio_ffmpeg 同梱の x64 版だけ（Python の subprocess から呼ぶ）。worker には ffmpeg / ffprobe がある。出力は曲 × パート × profile の JSON と md、入力 hash 付き。測定用の音声は repo に入れない（BL-035）。

**使わない**：render-bandroom-ai-recreation.py（採譜行を 1 本も読まない：:710-845）、compare-capture.py（full mix の集計だけ）。

## 4. 進める順番

各ステップは「変更 → ハーネスで前後比較 → `node scripts/stack-check.mjs` 0 BAD → ship（検証済みは merge）」。耳の確認は求めない。

1. **ハーネスを作る**（dev-only、bump 不要）。Human Fly の実例を再現してから、Tabasco 7 曲 × 4 パートの baseline。
2. **schedule-dump hook**（runtime ship）。light と full の実イベントで baseline を取り直す。
3. **再生側の小さな修正**（1 つにつき 1 PR と 1 gate、変異を入れて gate が落ちることを確認）
   - a. 行のない小節の扱い：**stem のその小節のエネルギーが低いときだけ無音にする**（一律に止めると取りこぼしの小節で本当の演奏まで消える）。drums BR:6843、bass BR:6385-、guitar BR:6459、voice（休み小節の生成）BR:5904-
   - b. drum_line のある曲で section crash ヒントを止める（BR:6788-6797）
   - c. light の間引きをクラス優先に（kick・snare・crash を残し、弱い hat から落とす）。1 小節 8 打の上限は予算を測り直すまで増やさない。BR:6134 のコメントも直す
   - d. kit の立ち上がり遅延は、**Band Room で実際に鳴る kit を測ってから**補正を検討（タイミングの問題として扱う）
4. **コード名に minor を入れる**（T:436-441）。voice の代替旋律とコード表示が直る。データ形式 gate（L:487-517：各行 ≥30 events、bass は 5 曲以上、guitar 7/7、human-fly は各行 ≥100、`chord_progression_legacy` は残す）を守る。
5. **グリッドを直す**：fit_bpm（T:47-57）の 2.3% 刻みをやめ、beat tracking と downbeat 固定へ。全行を量子化し直し、i-got-a-feeling の末尾を回収。librosa は上記の Python313 を使う。
6. **drums の中身**：hat・crash の再現率（高域の同時打ち）、kick の精度、曲 `tabasco` の drum_line（T:377 を密度判定へ）。**tom・ride を新しいクラスにしない**（新しい kit voice＝音色作業＋light のトリガー増）。分類ラベルだけ持ち、tom→snare、ride→hat の既存 voice で鳴らす。
7. **bass・guitar・voice**：guitar の音高を実採譜へ。light 上限は内容を見て間引く。
8. **HAZAMA**：オーナー判断待ち（ui_hidden / BL-041 と一緒に）。

曲の順：human-fly → electric-sheep・sister・under-the-moon → hey・i-got-a-feeling・tabasco（ステップ 5 のあと）→ HAZAMA。

## 5. 守るもの

- **iPhone の予算（v364）**：1 小節約 27〜34 トリガー（oscillator 起動約 30）で iPhone が止まった。light の上限（BR:6130-6136）drum 8・bass 4・guitar 4・vocal 4・その他 6、音長 bass 2.8・その他 3.0 step（BR:6172-6175）。polyphony は **PolySynth ごとに maxPolyphony ≤ 16**（L:767-768。現状 guitar 10：BR:4056、chord 5 / 10：BR:4277）。HAZAMA arp + bass は 1 小節 20〜21 打（上限 24、L:178-212）。
- **再構築マトリクスは light で上限が無い**：reconstructDrumBar 12〜16 打＋bass 8（BR:6223-6262）に guitar・voice を足すと最大約 32 トリガー／小節で、iPhone が止まった範囲に入る。触るなら上限を入れる。
- 間引きは内容で行う。`light && s % 2` のようなグリッド間引きは禁止（G-7 L:1492、v387 で「ピーポー」）。予算はパート数・密度・1 トリガーの oscillator 数で払う。
- FX は端末で gate し mode では gate しない（v353）。常時かかる reverb / oversample を足さない（check-audio-cost-gates）。
- G-6：light で鳴るのは drums・bass・guitar・voice の 4 パート（BR:2451、L:1450-1486）。
- 原音・stemBus・makeStemMasterBus には触らない。limiter は −1.0 dB のまま。
- iPhone はモノラル：pan / width は聴こえない。聴こえるのは onset・音量・エンベロープ。
- HAZAMA の `ui_hidden`（presets/bands.json:135、BL-041）は外さない。
- **runtime を ship するときの雑務**：`br-N`（band-room.html と sw の precache）、sw VERSION（FM と共有、fetch して次の空き番号）、CHANGELOG 先頭の `## vN`、版マーカー（runtime-browser-listening-checklist、BAND-ROOM-MANUAL / USAGE、CROSS-APP-INTEGRITY §7、HAZAMA-FM-ARCHITECTURE:13、CODEX-HANDOFF、config/autonomy-doc-currency.json）。gate だけ・docs だけなら bump 不要。
- **並行作業**：Codex も Music を触る。worktree で作業し破壊的 git はしない。着手時に BL-050 に claim 行（BACKLOG の claim ルール）。commit 前に `pull --ff-only`。検証済みは merge（オーナーの常設方針）。
- **測定の罠**：live で AI を再生すると preview の renderer が固まる。非表示の pane で START すると Surface のスピーカーから音が漏れる。mode は eval で切り替え、viewport が 0 px でないか確かめる。

## 6. 触らないもの（別レーン）

音色（シンセ・kit・FX、2026-07-23 凍結）／ACE-Step の render・原音 stem・Demucs の品質／HAZAMA の ui_hidden 解除と 02 の独立（L:162-166）／Listening Loop（BL-048）／band-room.js の分割（見送り決定済み）／音声を repo に入れること（BL-035）。

## 7. 最初の一手

**Human Fly drums の実例をハーネスで再現する**（dev-only、runtime は変えない）。

- 作るもの：`scripts/measure-part-fidelity.py`（名前は提案）。
- 入力：`presets/drum-frames-tabasco-human-fly.json` の drum_line と `presets/tabasco-stems/human-fly/drums.mp3`。
- 最初に読む：T:47-57（fit_bpm）、T:247-336（extract_drum_line）、BR:6106-6160、BR:6313-6333、`scripts/analyze-band-stems.py`。
- 出力：9〜16 小節のクラス別 P / R / F1・Δt・強弱相関、全曲の「行のない小節」一覧（stem エネルギー付き）、light の間引きで落ちる kick / snare / crash の数（BR:6139 のロジックを移植）。
- 受け入れ：§3 の実例をおおむね再現。できなければ正解側の検出器か時間合わせ（小節ごと）を直してから先へ。
- 次：baseline の JSON を commit（音声は repo 外）→ ステップ 2。

## 8. 新チャットに貼る書き出し

```
Band Room のパートごとの AI を完成させたい（BL-050）。ゴールは音色ではなく「原曲どおりに叩く・弾く」忠実度。
Music の docs/BAND-ROOM-PART-AI-BRIEF.md を読んで、§7 の最初の一手（Human Fly drums の実例を再現するハーネス）から始めて。
測定→修正→ship の順。判定は測定で（耳の確認は求めない）。iPhone の予算と G-1〜G-7 は守り、音色と HAZAMA には手を出さない。
```
