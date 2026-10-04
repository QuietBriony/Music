# Music Stack — 全体像と使い方

**普段の入口は [Music Stack Listen](../listen.html)。このページは「何を、どこで、どう使うか」の正本です。**

2026-09-07にactive 5 repoのローカルソースを照合。これは実装の棚卸しであり、
全曲の聴感合格・現在の配線・別PCの同期・YouTube投稿済みを証明するものではありません。
機能台帳は [config/music-stack-tools.json](../config/music-stack-tools.json)。
下の全道具一覧とListenの一覧は同じJSONから生成します。

2026-09-08の統合改善: private制作ノートもこの道具IDを参照し、作品→編集・生成の手順へ
接続します。public側に個人の作品一覧や保存先は載せず、各正本を保ったまま結合します。

## 1. 最初に理解すること

### 公開ページは既存の箱を流用する（2026-10-01）

新しいCloudflare Pagesプロジェクト・GitHub Pages repo・並行した一覧は、本人が明示依頼した時だけ作る。
Musicは既存`music-stack`、独立試奏台は既存`music-private-live-workbench`で更新する。
mainへのmergeだけではMusicのCloudflare手動配信は更新されないため、同じprojectへdeployして確認する。
更新ごとの一時URLは版の参照用。利用者へは普段の固定URLを案内する。

<!-- public-pages:begin -->
普段のブックマークは [Music Stack Listen](https://music-stack.pages.dev/listen.html)。公開先を増やさず、既存のページと道具をここから辿ります。

### Music — バンド・ラジオ・作品棚

同じMusicの中にある4つの画面。ロック／ジャズの試奏もBand Roomから。

| 公開ページ | 用途 |
|---|---|
| [Band Room / ARCB・Tabasco](../band-room.html?band=tabasco&song=human-fly&mode=synth) | ARCBをギター・ベース・ドラムで再現。原音から和音と音域を補正。上下のストロークと、ロック／カッティング／パームミュート。弦の響き・歪み・空気感を原音と比較・録音。 |
| [Hazama FM](../fm.html) | ジャンルを選んで、ラジオのように流す。 |
| [Music Core Rig](../index.html) | つまみを動かし、アシッドやIDMの音を探る。 |
| [Lyric Lab](../lyric-lab.html) | 歌詞・曲のアイデア・制作指示を一曲ずつ残す。 |

### 試奏台 — テクノ・アシッド・アンビエント

試作ミックス、ライブセット、303／909は同じ試奏台の中で切り替えます。

| 公開ページ | 用途 |
|---|---|
| [Strudel Live Workbench](https://music-private-live-workbench.pages.dev/) | 音とコードを触る。9試作の棚からAfterimage FINAL v1も選べる。LIVEの影グルーヴは量0から。 |

### ほかの道具 — 静かな音・リズム・段取り

前からある4つのアプリ。それぞれの役割を残して使います。

| 公開ページ | 用途 |
|---|---|
| [Chill Session](https://quietbriony.github.io/chill/session.html) | ピアノと余白。ベースやドラムを少しずつ足す。 |
| [Namima](https://quietbriony.github.io/namima/) | 水と波紋の映像に、穏やかな音を合わせる。 |
| [Drum Floor](https://quietbriony.github.io/drum-floor/) | ドラムのノリ・休符・強弱を試す。 |
| [OpenClaw Desk](https://quietbriony.github.io/openclaw/) | 制作の段取りと、次に進む道具を確認する。 |

[MusicのGitHub Pages版](https://quietbriony.github.io/Music/listen.html)は同じ道具の別入口。Lyric Labの端末間同期は既存Cloudflare/D1の認証が必要です。
録音・実験・映像はListenの既存sectionへ。test／namima-labは履歴保管で、演奏アプリの一覧には含めません。
<!-- public-pages:end -->

### いまは既存をまとめて磨く（2026-09-20）

2026-10-01の整理：役割の重ならない5 repoは残し、使う道具を用途別の棚へ統合。
回収完了済みの`test`／`namima-lab`は本人承認で正式archiveした。
エッセンスの回収先は[archive audit](archive-repo-harvest-audit.md)。
音源を小さく作り直す最初の候補は[Band Roomのギター・ベース・ドラム試奏](PHYSICAL-BAND-REHEARSAL.md)。
ロック／ジャズの8小節を別スレッドで準備し、3パートを同じ時計で再生する。
通常の曲再生への昇格は音と端末負荷の確認後に行う。

利用者の方針は「新しく作るより、まとめる・磨く・把握する」。
現在の入口はListenとprivateの再開ノートの2つを維持する。
Listenの[年鑑・索引](../listen.html#yearbook)から、repoの始まりと公開実験の履歴を辿れる。
GitHub作成日時とcommit日時は日本時間で表示し、録音日・公開日と混同しない。
個別作品の年鑑、PCごとの担当、実機の確認日、素材の所在は同じprivate再開ノートへ置く。
年鑑は各正本から作る案内であり、新たな作品台帳やPC台帳を増やさない。
ブラウザ制作台（BL-049）と新しい演奏面（BL-045）は着手を保留し、
既存の道具で一つの作品を再訪してから、足りない操作を具体化する。

| まとまり | 中身・見る場所 | 区別すること |
|---|---|---|
| 作品の棚 | [既存の公開デモ](../listen.html#recorded-works)、private再開ノート | 固定音声・比較抜粋・別版。リンクの数を作品数にしない |
| 触る道具 | [用途別の道具](../listen.html#tool-map)、下の実装台帳 | 演奏・静かな音・作品棚・制作工程。5 active repoの役割を保つ |
| 音の実験 | [Musicの3案比較とHazamaの2試聴](../listen.html#sound-experiments) | 別projectの独立した実験。共通runtimeや評価の自動共有ではない |
| 映像・公開 | [既存プレビューと可視化](../listen.html#visual-release) | 制作候補とYouTube等の公開履歴は別に確認 |

関連する公開入口の正本はListenの上記section。デモ用の
`tabasco-acestep-demos`は過去音声を聴く参照棚、`hazama`は別のゲームrepoであり、
active音楽stackに追加しない。既存公開ページの到達性・内容は確認済みだが、
全PCの素材・全公開作品・同名ファイルのhash対応まで確認した一覧ではない。

整理の順番は、**入口をつなぐ → 同じ作品の版・素材を対応づける → 一区間を比較して磨く**。
保存先の移動やrepoの合体は前提にしない。作品ごとの「次の一手」はprivate再開ノート、
一般の実装課題はBACKLOGに戻す。

Music Stackは一つの巨大DAWではなく、**音を探索する小さな楽器群と、作品に仕上げる制作工程**です。
今回の統合は、入口・役割・記録・次に進む道筋を揃えること。repoや音源を丸ごと合体させません。

| 段階 | 主に使うもの | 次へ渡すもの |
|---|---|---|
| 意図を決める | このガイド・reference・Lyric Lab | どんな音にしたいか、残す／削る要素 |
| 聴く・演奏して探る | Core Rig / FM / Band Room / chill / drum-floor / namima | 気に入った瞬間・短い比較メモ |
| 固定素材を作る | 各REC、ACE-Step、オフラインrenderer、制作CLI | 音声・MIDI・seed / prompt |
| 曲に仕上げる | Sonarと選んだNI等の音源、人の演奏 | project・stems・master |
| 聴ける形で渡す | ローカル保存・試聴版・公開担当 | master＋M4A＋制作メモ、確認後の公開URL |

これは**選択と手動受け渡し**の流れです。全アプリを同時再生したり、
一つのボタンで生成からYouTubeまで実行したりする仕組みではありません。
OpenClaw Deskは途中の段取りを見る場所で、音を出す楽器でも別のDAWでもありません。

### 同じ名前でも別物

- **Hazama FM**: ブラウザで動く生成ラジオ。
- **HAZAMA Band Room**: Still Moving等の原音stemsとブラウザAI再現を比較する場所。
- **ACE-Step版**: 別途生成した固定音声。Band Roomの「AI再現」ボタンはACE-Stepを実行しません。
- **YouTubeのhazama**: 公開先。どの生成方式を使った動画かは、音源と公開履歴の照合が必要です。
- **namimaブラウザ**と**namimaのPython renderer**も別の実行系です。

## 2. 全道具一覧

「実装あり」はソースを確認した意味です。好みの音質、実mobile、実MIDI、
cloud認証まで合格済みという意味ではありません。候補・手動・未実装を分けて表示します。
根拠リンクは現行mainへの入口。棚卸し開始時のcommitは台帳の`source_revisions`に保存しています。
今回新設したMusicのガイド・設計は、この変更に属し、開始時commitには含まれません。

<!-- stack-tools:begin -->
### 演奏する・練習する

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [Music Core Rig](../index.html) | 密度と質感をつまみで演奏する中心の音源。アシッドやIDM探索の入口。<br>START → AUTO MIXを手動に → CULTのACIDを試し、まず一つのfaderだけ動かす。 | RECの音声ファイル／SYNCの設定JSON。<br>Hazama FMと同じengine。汎用ピアノロールや303専用16-stepエディタではない。 | 実装あり・実音評価は別<br>[Music/index.html](https://github.com/QuietBriony/Music/blob/main/index.html) / [Music/docs/USAGE-MUSIC-CORE-RIG.md](https://github.com/QuietBriony/Music/blob/main/docs/USAGE-MUSIC-CORE-RIG.md) / [Music/audio/music-recorder.js](https://github.com/QuietBriony/Music/blob/main/audio/music-recorder.js) |
| [Hazama FM](../fm.html) | ジャンルとenergyを選んで流す、少ない操作のラジオ。<br>START → techno / ambient / pianoなどを一つ選び、60–90秒聴く。 | RECの音声ファイル／SYNCの設定・聴感文脈。<br>軽量設定で追加音色の残響・歪み負荷を抑える。YouTubeのhazamaチャンネルとは別のアプリ。新曲をAIモデルで生成・投稿するボタンではない。 | 実装あり・実音評価は別<br>[Music/fm.html](https://github.com/QuietBriony/Music/blob/main/fm.html) / [Music/fm.js](https://github.com/QuietBriony/Music/blob/main/fm.js) / [Music/audio/music-recorder.js](https://github.com/QuietBriony/Music/blob/main/audio/music-recorder.js) |
| [Band Room / ARCB・Tabasco](../band-room.html?band=tabasco&song=human-fly&mode=synth) | ARCB 7曲の採譜を新しい弦・ドラム音源で鳴らす。原音の確かな区間から和音・音域を補正し、曖昧な区間は従来の音符を保持。ギター3音色とロック／響かせる／カッティング／パームミュートの弾き方。上下のストローク、弦の余韻と共通の空気感。合奏の音量・帯域・時計を測定して補正。採譜空白は余韻を残し、未採譜melodyを明示。HAZAMAは別の既存音源。<br>ARCBの曲を選び、AI再現でSTART。ギターの音をクランチ／ディストーション、弾き方をロックにして、各パートを消して原音と聴き比べる。 | mix REC／4 stems pack／listening note。MIDI読込は先頭1小節のドラム用。<br>melodyは採れた歌の音程を弦でなぞる。未採譜の曲は鳴らさず表示。歌声は未再現。ギター和音・奏法は近似で、原音の完全再現と実iPhone長時間負荷は未保証。HAZAMA 02は01 frames共有の暫定版。MIDI OUTはclock、INはphrase/section操作。 | 実装あり・実音評価は別<br>[Music/band-room.html](https://github.com/QuietBriony/Music/blob/main/band-room.html) / [Music/band-room.js](https://github.com/QuietBriony/Music/blob/main/band-room.js) / [Music/presets/bands.json](https://github.com/QuietBriony/Music/blob/main/presets/bands.json) |
| [Strudel Live Workbench](https://music-private-live-workbench.pages.dev/) | 試作・A/Bミックス／ライブセット／元の303×2＋909を同じ入口で選ぶ。A/Bをコード・テンポ・混ぜ具合ごとライブセットへ持ち込み、追加ドラムや303風をMUTE解除で足す。自動LIVEの動きを小バーで見ながら、音色・音量・BPMを演奏中に操作する。影グルーヴは量0から静かなHPF補助層を足し、打点・音量・フィルター・小節同期を同じ演奏コードで編集できる。 Afterimage FINAL v1は128 BPM・8分の単曲で、棚からコードを開いて明示Playで冒頭から始める。A/B・LIVE素材には使わない。<br>Afterimageは「試作・A/Bミックス」の棚から選択 → Play。初回JSON importは不要。 上の演奏面ボタンで選ぶ。A/Bを選んで「組み合わせのコードを開く」→ Play。楽器を足すなら「このA/Bでライブセットへ」、追加パートはミュートから開始。セットだけならライブセット → Acid DriveかAmbient Drift → セットを鳴らす。音量・音色は基準値、自動の動きは下の小バー。BPMは横フェーダーで触れ、再実行せずコードに残る。スマホの出力や物理音量は上部の音声案内、無音なら音を再接続。PWAはアプリ更新。PCローカルはREADMEの初回準備 → npm run local。 | 公開9試作はGit管理。4セットと引き継いだA/Bは全打点・音符・BPM・音色・22フェーダー・MUTE・素材コード・AUTO・変奏seed/固定/採用前の軸・LIVE設定・影の量/HPF/同期関数を名前付き下書きへ保存。手編集したコード本文をフェーダー操作で上書きしない。V1〜V3保存コードは明示更新まで出音を維持。LEVEL・A/B・acidBros FILEもJSONで別端末へ追加できる。<br>スマホPWAはアプリと従来8試作に必要な音を端末保存（約10 MB）してオフライン利用可。PCはローカルHTTPでも同じ画面を使える。後から指定する外部URL・他の標準バンクは自動保存しない。更新は保存後の明示操作。保存削除/OS整理では再準備が必要。JSON転送は手動で未保存編集・音源は含まない。acidBrosは別エンジンで、音・時計・パターン同期やチャット即時反映は未実装。実iPhoneの追加・試聴は未確認。公開ページ・コード・自前配信のWAV7本は公開。 Afterimageの4外部ドラムはURLを保持し、保存済PWAでは既存aliasの固定cacheを参照。PCローカルは標準バンクだけ端末内へ向け、Afterimageの直接URLは外部のまま。既存909登録は専用名で保持。全曲の出音・第三者音源の公開／商用権利は未確認。 | 実装あり・実音評価は別<br>[Music/experiments/workbench/v1/README.md](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/README.md) / [Music/experiments/workbench/v1/src/app.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/app.js) / [Music/experiments/workbench/v1/src/performance.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/performance.js) / [Music/experiments/workbench/v1/src/performance-code.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/performance-code.js) / [Music/experiments/workbench/v1/src/groove-code.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/groove-code.js) / [Music/experiments/workbench/v1/src/slider-bridge.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/slider-bridge.js) / [Music/experiments/workbench/v1/scripts/local-workbench.mjs](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/scripts/local-workbench.mjs) / [Music/experiments/workbench/v1/src/session-backup.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/session-backup.js) / [Music/experiments/workbench/v1/src/pwa.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/pwa.js) / [Music/experiments/workbench/v1/src/offline-policy.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/offline-policy.js) / [Music/experiments/workbench/v1/src/live-code.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/live-code.js) / [Music/experiments/workbench/v1/src/live-plan.js](https://github.com/QuietBriony/Music/blob/main/experiments/workbench/v1/src/live-plan.js) |
| [Drum Floor](https://quietbriony.github.io/drum-floor/) | ノリ・休符・強弱を作るドラム専門の演奏面と候補生成器。<br>最初はマイクもMIDIも使わず、再生（SYNC/手動）でgrooveを試す。 | ブラウザ演奏／CLIのMIDI候補／明示有効化した時だけMIDI note出力。<br>SYNC受信だけでは再生・MIDI送信しない。MusicやDAWとのサンプル精度の同時演奏を保証するものではない。 | 実装あり・実音評価は別<br>[drum-floor/app.js](https://github.com/QuietBriony/drum-floor/blob/main/app.js) / [drum-floor/src/midi-output.js](https://github.com/QuietBriony/drum-floor/blob/main/src/midi-output.js) / [drum-floor/drum\_floor/midi.py](https://github.com/QuietBriony/drum-floor/blob/main/drum_floor/midi.py) |

### 静かに聴く — ピアノ / 水と映像

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [Chill Session](https://quietbriony.github.io/chill/session.html) | ピアノと余白を中心に、ゆっくり変化する静かな演奏。<br>START。まずピアノだけを聴き、必要な時だけBASS / DRUMSを足す。 | ブラウザ演奏／quiet-piano recipeとsession文脈。<br>独立したactiveアプリ。汎用アンビエントに統一せず、長い休符とピアノの役割を残す。実音の好みの判定は別。 | 実装あり・実音評価は別<br>[chill/session.html](https://github.com/QuietBriony/chill/blob/main/session.html) / [chill/engine.js](https://github.com/QuietBriony/chill/blob/main/engine.js) / [chill/AGENTS.md](https://github.com/QuietBriony/chill/blob/main/AGENTS.md) |
| [Namima](https://quietbriony.github.io/namima/) | 水・庭・穏やかな空気のための、映像付きアンビエント。<br>Tap to start → 音と波紋を聴く。ほかのプレイヤーは止めて比較する。 | ブラウザの音・映像／安全なmoodの翻訳。<br>同じrepoのオフライン周波数レンダーとは別物。暗いアシッドや強い低域を既定音へ混ぜない。 | 実装あり・実音評価は別<br>[namima/audio.js](https://github.com/QuietBriony/namima/blob/main/audio.js) / [namima/sketch.js](https://github.com/QuietBriony/namima/blob/main/sketch.js) / [namima/music-session-adapter.js](https://github.com/QuietBriony/namima/blob/main/music-session-adapter.js) |

### 作品を残す・次の段取りを決める

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [Lyric Lab](../lyric-lab.html) | 歌詞・曲の設計・制作指示を一曲ずつ整理する作品棚。<br>既存作品を開く → 制作先とBPM等を確認 → 制作パケットをコピー。 | 歌詞付き制作指示／歌詞を含まないScene metadata。<br>ACE-Step等へ自動送信しない。端末間の作品棚同期は認証済みCloudflare/D1環境が別途必要。GitHub Pagesの入口だけでは保証されない。 | 実装あり・実音評価は別<br>[Music/lyric-lab.js](https://github.com/QuietBriony/Music/blob/main/lyric-lab.js) / [Music/docs/LYRIC-LAB-USAGE.md](https://github.com/QuietBriony/Music/blob/main/docs/LYRIC-LAB-USAGE.md) / [Music/functions/api/lyric-drafts.js](https://github.com/QuietBriony/Music/blob/main/functions/api/lyric-drafts.js) |
| [OpenClaw Desk](https://quietbriony.github.io/openclaw/) | SYNCを読み、次の行き先・確認待ち・候補の段取りを見る制作卓。<br>Core RigかFMでSYNC → 同じブラウザのDeskでlatest packetを確認。 | review・routing案・人間が実行するコマンドの提示。<br>このrepoのDeskは音を出さず、機材操作・REC・upload・mergeを自動実行しない。汎用OpenClaw製品の説明ではない。 | 実装あり・実音評価は別<br>[openclaw/index.html](https://github.com/QuietBriony/openclaw/blob/main/index.html) / [openclaw/README.md](https://github.com/QuietBriony/openclaw/blob/main/README.md) / [openclaw/AGENTS.md](https://github.com/QuietBriony/openclaw/blob/main/AGENTS.md) |

### PCで作る・仕上げる・渡す

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [ACE-Step 制作レーン](https://github.com/QuietBriony/Music/blob/main/docs/ACE-STEP-WORKFLOW.md) | スタイル文や歌詞から固定音声の候補を作り、人が選ぶオフライン制作。<br>既存のHAZAMA制作レシピを読む。実行PC・model・出力先を確認してから別途生成する。 | 生成音声／seed・prompt・採用判断。HAZAMA Still Movingの制作実績あり。<br>Band RoomのAI再現とは別の生成方式。GPU・model download・生成はこの入口から開始しない。生成物のYouTube公開実績は未確認。 | 手動工程・環境確認<br>[Music/docs/HAZAMA-STILL-MOVING-ACESTEP.md](https://github.com/QuietBriony/Music/blob/main/docs/HAZAMA-STILL-MOVING-ACESTEP.md) / [Music/config/external-dependencies.json](https://github.com/QuietBriony/Music/blob/main/config/external-dependencies.json) |
| [周波数・IDMレンダー / iPhone受け渡し](https://github.com/QuietBriony/namima/blob/main/README.md) | 周波数・ドローン・深いビートの実験を固定ファイルとして作る、別系統のPythonレーン。<br>namimaのREADMEでcandidate境界と依存を確認。出力先を明示して試作する。 | WAV／ffmpeg利用時のiPhone用M4A／seed・SHA-256付きhandoff。専用調律向けMIDIも別モジュールにある。<br>ブラウザNamimaへ未接続。依存・保存先・調律音源は環境確認が必要。M4A作成はDrive同期完了やYouTube公開を意味しない。 | 候補・要検証<br>[namima/src/namima/deliver.py](https://github.com/QuietBriony/namima/blob/main/src/namima/deliver.py) / [namima/src/namima/idm\_ambient.py](https://github.com/QuietBriony/namima/blob/main/src/namima/idm_ambient.py) / [namima/src/namima/solfeggio\_composer.py](https://github.com/QuietBriony/namima/blob/main/src/namima/solfeggio_composer.py) / [namima/src/namima/midi\_export.py](https://github.com/QuietBriony/namima/blob/main/src/namima/midi_export.py) / [namima/src/namima/hazama\_release.py](https://github.com/QuietBriony/namima/blob/main/src/namima/hazama_release.py) |
| [素材解析・stems・AI再現の制作CLI](https://github.com/QuietBriony/Music/blob/main/docs/WORKER-GAMING-RUNBOOK.md) | 既存素材の解析・パート分離・再現候補・DAW受け渡しを支える制作スクリプト群。<br>runbookで対象コマンドとmachine capabilityを確認。重い処理は別途明示して実行する。 | repo外のworker-output／解析metadata／stemsや再現候補。<br>データを作るレーンで、公開runtimeの自動更新器ではない。未採用候補を既存曲へ上書きしない。 | 手動工程・環境確認<br>[Music/scripts/worker-gaming-pipeline.py](https://github.com/QuietBriony/Music/blob/main/scripts/worker-gaming-pipeline.py) / [Music/scripts/render-bandroom-ai-recreation.py](https://github.com/QuietBriony/Music/blob/main/scripts/render-bandroom-ai-recreation.py) / [Music/docs/BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md](https://github.com/QuietBriony/Music/blob/main/docs/BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md) |
| [Sonar / NI / MIDI・機材](https://github.com/QuietBriony/Music/blob/main/docs/MUSIC-STACK-SYSTEM-MANUAL.md#daw) | MIDIを目で直し、好きな音源で鳴らし、人の演奏とmixを仕上げる場所。<br>音声かMIDIを一つ持ち込み、Sonarの1トラックで確認。実機接続はprivate台帳から別途確認。 | DAW project／MIDI／採用音色の設定／mix・master。<br>MIDIだけではNI preset・303 slide・microtuning・音色は再現されない。M32等のノブ割当やEP-133への書込みを自動化しない。 | 手動工程・環境確認<br>[Music/docs/DAW-INTEGRATION.md](https://github.com/QuietBriony/Music/blob/main/docs/DAW-INTEGRATION.md) / [Music/docs/EP133-KOII-BANDROOM-WORKFLOW.md](https://github.com/QuietBriony/Music/blob/main/docs/EP133-KOII-BANDROOM-WORKFLOW.md) / [Music/references/studiopc-sonar-ni-reference.json](https://github.com/QuietBriony/Music/blob/main/references/studiopc-sonar-ni-reference.json) |
| [保存・動画化・YouTube公開](https://github.com/QuietBriony/Music/blob/main/docs/MUSIC-STACK-SYSTEM-MANUAL.md#delivery) | 採用音源を聴ける形で保存し、動画・説明・権利確認を揃えて公開担当へ渡す。<br>masterとiPhone試聴版、制作メモを一組にして保存。公開先と権限は公開担当へ確認する。 | 受け渡し一式。公開URLは実際の公開確認後に記録。<br>現行YouTubeの制作方式・投稿済み曲・upload権限は今回未監査。Gitの同期や音源生成だけでは投稿されない。 | 手動工程・環境確認<br>[Music/docs/PRODUCTION-PATH.md](https://github.com/QuietBriony/Music/blob/main/docs/PRODUCTION-PATH.md) / [Music/docs/MUSIC-STACK-SYSTEM-MANUAL.md](https://github.com/QuietBriony/Music/blob/main/docs/MUSIC-STACK-SYSTEM-MANUAL.md) |

### 試奏する・設計を保管する

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [ギター・ベース・ドラムの8小節試奏](../band-room.html#br-physical-band) | ロック／ジャズの独自8小節で弦・打感・ギター3音色を試す。ARCBのAI再現も同じ楽器中核を使用。<br>スタイルを選ぶ → 8小節を試奏 → 3パートのON/OFFと試奏音量を動かす。 | ページ内で再利用する短い合奏。音声・modelのdownloadなし。<br>8小節試奏は独立曲。RECは通常曲のAI再現で使用。精密な多楽器モデルや歌声生成ではない。実iPhone聴感は本人確認。 | 候補・要検証<br>[Music/audio/physical-band/score.mjs](https://github.com/QuietBriony/Music/blob/main/audio/physical-band/score.mjs) / [Music/audio/physical-band/dsp.mjs](https://github.com/QuietBriony/Music/blob/main/audio/physical-band/dsp.mjs) / [Music/docs/PHYSICAL-BAND-REHEARSAL.md](https://github.com/QuietBriony/Music/blob/main/docs/PHYSICAL-BAND-REHEARSAL.md) |
| [和声マップ＋アシッド演奏面](https://github.com/QuietBriony/Music/blob/main/docs/VISUAL-COMPOSER-PLAN.md) | Drums / Acid / Airを同じ時間軸で触り、ノリを固定しながら和声を溶かす小さな楽器。<br>既存部品と不足分の設計を見る。まず機材なしの8小節を完成条件にする。 | 計画: session JSON＋MIDI＋音色・調律・slide等の受け渡しメモ。<br>まだ演奏画面はない。Sonarの代替DAWは作らず、既存音源の既定動作も変更しない。 | 未実装・設計のみ<br>[Music/docs/VISUAL-COMPOSER-PLAN.md](https://github.com/QuietBriony/Music/blob/main/docs/VISUAL-COMPOSER-PLAN.md) / [drum-floor/src/midi-output.js](https://github.com/QuietBriony/drum-floor/blob/main/src/midi-output.js) / [Music/band-room.js](https://github.com/QuietBriony/Music/blob/main/band-room.js) |
<!-- stack-tools:end -->

## 3. 好きな音へ進むための、最初の3回

### 1回目・15分 — アシッドを触り、何が好みか知る

1. ほかの音楽アプリを止め、[Core Rig](../index.html)だけ開く。
2. START。AUTO MIXを手動へ切り替え、CULTのACIDを選ぶ。
3. まず一つのfaderだけ変え、元へ戻す。音量と、音数・質感の変化を分ける。
4. 60–90秒で「残す1点／削る1点」を書く。気に入った時点でSYNC、録りたい時だけREC。
5. 再生を止めて[Drum Floor](https://quietbriony.github.io/drum-floor/)を単独で比較。
   最初はMIC・MIDI不要。別アプリの同時演奏はまだ狙わない。

**到達点**: どの操作が密度・低域・空間を変えるか一つ説明でき、設定と録音を区別できる。
ACIDの選択だけで、求める303演奏やドープなノリが完成するとは扱いません。

### 2回目・15分 — 音を足さず、溶け方と余白を聴く

1. [Chill Session](https://quietbriony.github.io/chill/session.html)でピアノ中心に聴く。
2. 「音の数」「次の音までの間」「低音を保って上だけ変わる感じ」を分けてメモ。
3. 止めてから[Namima](https://quietbriony.github.io/namima/)と比較する。
4. テクノへ戻すときに残すのは、ピアノ音色そのものではなく、休符・共通音・ゆっくりした変化。

**到達点**: 「ジャズっぽい／普通」だけでなく、何が多いのか・何を固定したいのかを言える。
ソルフェジオ等の周波数は音素材・調律の設計として扱い、効能を採用理由にしません。

### 3回目・30分 — 一つだけ作品として残す

1. 候補を一つ選び、音声かMIDIのどちらを持ち出すか決める。
2. Sonarに一つの素材・一つの音源から入れる。最初から全ツールを接続しない。
3. 余白・展開・音色のうち一つだけ改善し、元と比較する。
4. masterと試聴版、制作メモを一組にする。「再び開いて同じ素材を聴ける」で完了。

**当面の完成単位は「もう一度開ける8小節＋短い試聴版」。**
同じネタを触る→比較→保存→開き直す、が一周するかで進捗を判断します。

<a id="daw"></a>
## 4. Sonar・NI・MIDI・機材の役割

Sonarは残します。MIDIの目視編集、音源選択、録音、編曲、mixを担い、
Music Stackはその前に「自分の好みをつかむ演奏面」と「素材の作り方」を担当します。
汎用ピアノロール・VSTホスト・DAW project管理の再実装は優先しません。

| 受け渡すもの | できること | それだけでは戻らないもの |
|---|---|---|
| WAV / M4A / WebM | 鳴った音を聴く・DAWに置く | 元のMIDI・ノブ・音源設定 |
| MIDI (.mid) | 対応する音源で音符・タイミング・強弱を再生 | NI preset、音色、音声、303固有slide/アクセントの意味 |
| SYNC JSON | genre・BPM・fader・review文脈を別アプリへ渡す | 録音、同一演奏の完全再生、別PCへの自動転送 |
| 音色・調律メモ | preset、CC割当、スケール等を再設定する手掛かり | 実際の音源が対応していない機能 |
| Sonar project | 対応プラグイン・素材が揃えば続きを編集 | 別PCにない音源・素材・配線・認証 |

- Band RoomのMIDI importは**先頭1小節・ドラム変換**。完成曲全体のピアノロール読込ではありません。
- Band Room MIDI OUTは**clock**、INはphrase/section操作。drum-floorの**note出力**と混同しません。
- namimaの専用周波数MIDIは、対応する`.tun` / `.scl`等を読み込んだ音源が前提。
  通常の12平均律音源でMIDIだけ再生しても同じ周波数にはなりません。
- ノブコントローラーやEP-133との実接続は、private `music-ops`の台帳・経路・確認日から判断。
  ここには現在の接続状態や個人の機材一覧を複製しません。
- 実機レーンは、PCだけで一周できた後に、鍵盤・ノブ→サンプラー→必要なら追加コントローラーの順。
  全ノブ対応や実機書込みが既に完成しているとは扱いません。

詳細: [DAW往復](DAW-INTEGRATION.md) / [EP-133 workflow](EP133-KOII-BANDROOM-WORKFLOW.md) /
[Sonar・NI比較用recipe](../references/studiopc-sonar-ni-reference.json)。

## 5. SYNCは何を統合しているか

`Core Rig / FMでSYNC → 同じブラウザのDeskで確認 → 必要なアプリを開いて手動START`。

同じoriginの`localStorage` / `BroadcastChannel`で設定metadataを受け渡します。
同じPCでも別ブラウザ・別profile・別port、まして別PCやiPhoneへは自動で共有されません。
必要な場合はJSONを明示的に持ち出して受け側へ渡します。
Lyric Labの認証付き作品棚同期は、これとは別のクラウド保存です。

**同期していないもの**: raw音声、サンプル、DAW transport、サンプル精度のclock、
録音開始、MIDI有効化、機材設定、YouTube公開、Gitの作業内容。
詳細は [SYNC manual](music-stack-sync-manual.md)。

<a id="delivery"></a>
## 6. 保存・iPhone・公開への出口

### 音声形式を揃える

- Core Rig / FMのREC: `audio/music-recorder.js`がブラウザ対応に応じM4AまたはWebMを選択。
- Band Room mix REC: WAVへの変換を試み、失敗時はM4A / WebMにfallback。
  stems packは各stemのM4A / WebMで、mix RECと同じ形式とは限りません。
- オフラインrenderer: WAVを作成。`namima.deliver`はffmpeg利用時にM4Aと制作メモも作れます。
- WAVをiPhoneで聴けるかは保存場所・アプリ・codecに依存。日常試聴にはM4A/AAC版も用意し、
  masterは別に残す。拡張子だけの変更は変換ではありません。

根拠: [Music recorder](../audio/music-recorder.js) / [Band Room recorder](../band-room.js) /
[namima delivery](https://github.com/QuietBriony/namima/blob/main/src/namima/deliver.py)。

### 一曲の受け渡し単位

音声・DAW projectはGitの外へ。次の命名は**今後の推奨形**で、自動移動や既存作品の改名はしません。

```text
track-id/
  track-id-master.wav       採用音源
  track-id-iphone.m4a       試聴用（作成できた場合）
  track-id.mid              MIDIがある場合だけ
  track-id-session.json     recipe / seed / BPM等がある場合だけ
  track-id-handoff.md       出所・残す点・直す点・使用音源・公開判断
```

制作メモの最小項目: `track id / 元素材 / 生成方式 / seed・prompt / BPM・調律 /
使用音源・preset / 残す点 / 直す点 / 保存先 / 権利確認 / 公開状態`。
本当の保存先、個人のDriveリンク、非公開曲の情報はprivate側へ置きます。

具体的な読み解き方は[ネタの出自と再開ガイド](WORK-PROVENANCE-GUIDE.md)。
「同じ音の再生成」「WAVを磨く」「MIDIで演奏可能に再構成する」を分けます。
既存の納品catalog・本人のverdictを正本として保ち、optional private `music-ops/works/`
の制作ノートから、試聴・意図・親素材・不足・Sonarで触れる範囲・次の一手へ辿ります。
元スクリプト未発見や当時の環境不明を、再現可能・聴感合格と表示しません。

元のoffline生成器から編集素材へ進む実装候補として、namimaのパート別WAV出口を
[出自と再開ガイド](WORK-PROVENANCE-GUIDE.md)へ接続しました。
2026-09-08時点でPR #40のhuman merge待ち。master前の7partを扱うもので、
MIDI化・過去WAVの復元・Sonar実操作済みを意味しません。

Driveへ保存したことと、同期完了・iPhoneで再生確認・YouTube公開は別々に確認します。
既存の公開担当との連携、投稿権限、どの動画がACE産かは今回未監査。
公開担当へmaster・試聴版・制作メモを渡し、必要な権利・公開設定を確認してから投稿する工程です。
音源の外部uploadや公開先の変更は、このガイドを読んだだけでは実行しません。
対象ファイル・保存先・共有範囲を確認した個別の作業として扱います。

## 7. どの文書を信じ、何を残すか

| 知りたいこと | 正本 | 他の文書の扱い |
|---|---|---|
| 今日どれを使うか | [Listen](../listen.html)＋このmanual | 詳細説明は個別manualへ |
| 道具の役割・入口・実装根拠 | [機能台帳JSON](../config/music-stack-tools.json) | HTMLと上の表は生成された表示 |
| repoの責任・連携境界 | [Integration Index](music-stack-integration-index.md) → [Protocol](music-orchestra-protocol.md) / schema | 音を一つに混ぜる命令ではない |
| 次に実装すること | [BACKLOG](autonomy/BACKLOG.md) | 昔のNext PR Planを直接実行しない |
| 何を変更・出荷・検証したか | [SESSION-LEDGER](autonomy/SESSION-LEDGER.md)＋Git | 静的テストと人間の試聴は区別 |
| 実機・現在の配線・PC状態 | private `music-ops`のcanonical JSON | public Musicの一般図や過去chatは現状証明ではない |
| 音源・DAW project・公開履歴 | Git外の制作物とprivate運用記録 | SYNCやGit commitだけでは保存・公開完了にならない |

`test` / `namima-lab`は過去のアイデア棚。active runtimeを増やすために復活させません。
過去のdirection / roadmapは背景資料として残し、現行入口から最新の役割・BACKLOGへ案内します。

### 今回の棚卸しの範囲と残る未確認

- 読んだ範囲: active 5 repoの入口・契約・主要実装、Musicの制作CLIとrecipe、
  namimaのオフライン制作・delivery、private運用台帳の責任境界。
- 個々の既存音源の全件試聴、Git外の全ファイルの所在・重複・採用判定は未実施。
  未採用音源の削除や移動はしていません。
- 初回の納品レーンと出自の照合はprivate制作ノートへ接続。保存物に対応する元script・
  入力guide・stemが揃うかを個別に表示し、既存catalogとverdictは保持しています。
- 全道具の実音品質、実iPhone、実機MIDI、別PC・Driveの同期、認証・公開状態は別の確認項目。
- 次の順序: **この入口で一周する → private制作ノートで元データを回収・比較 → 8小節の視覚的楽器**。

## 8. 次に作るもの／作らないもの

[和声マップ＋アシッド演奏面の設計](VISUAL-COMPOSER-PLAN.md)に既存部品と不足分を整理しました。
「無段階」はコードを無秩序に増やすことではなく、拍の芯を保ち、共通音・余白・音色の移り方を連続させる方針。
写真の教材からは一般的な和声関係の可視化を学び、図や教材本文はコピーしません。

当面作らないもの: 新DAW、新VSTホスト、6つ目の管理アプリ、全機材の自動設定、
各repoを常時同時演奏する巨大エンジン、無人公開システム。

### このガイドを古くしない更新手順

1. 実装・個別manualを確認し、`config/music-stack-tools.json`の該当項目と確認日を更新。
2. `node scripts/render-stack-guide.mjs --write`でListenと本manualの一覧だけ再生成。
3. `node scripts/check-music-stack-guide.mjs`で入口・根拠・表示のズレを確認。
4. `node scripts/stack-check.mjs`で全体検証。音が変わる作業は人間の試聴を別に残す。

新しい道具は「何に使う／最初の一手／何が残る／まだできないこと」を台帳に書ける時だけ入口へ足します。

private制作ノートは道具IDと作業の役割だけを保持し、道具名・URL・statusはこのJSONから
読み込みます。道具の説明を変えたらprivate表示も再生成して保存先へ反映するため、
private `music-ops/works/check-works.mjs`で表示の鮮度・対応ID・ローカル保存を一括確認します。
コマンドの実パス・hostはprivate `works/README.md`を参照。一般のstack-checkには
非公開素材の読込を追加せず、public cloneやCIにprivate情報・アクセスを要求しません。

この整合性検証は音質や公開の審査ではありません。次の完成基準は引き続き、
本人が選んだ一つのネタを、素材と設定を保った別版として開き直せることです。
