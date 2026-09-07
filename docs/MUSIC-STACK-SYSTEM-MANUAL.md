# Music Stack — 全体像と使い方

**普段の入口は [Music Stack Listen](../listen.html)。このページは「何を、どこで、どう使うか」の正本です。**

2026-09-07にactive 5 repoのローカルソースを照合。これは実装の棚卸しであり、
全曲の聴感合格・現在の配線・別PCの同期・YouTube投稿済みを証明するものではありません。
機能台帳は [config/music-stack-tools.json](../config/music-stack-tools.json)。
下の全道具一覧とListenの一覧は同じJSONから生成します。

## 1. 最初に理解すること

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
### ブラウザで聴く・触る・整理する

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [Music Core Rig](../index.html) | 密度と質感をつまみで演奏する中心の音源。アシッドやIDM探索の入口。<br>START → AUTO MIXを手動に → CULTのACIDを試し、まず一つのfaderだけ動かす。 | RECの音声ファイル／SYNCの設定JSON。<br>Hazama FMと同じengine。汎用ピアノロールや303専用16-stepエディタではない。 | 実装あり・実音評価は別<br>[Music/index.html](https://github.com/QuietBriony/Music/blob/main/index.html) / [Music/docs/USAGE-MUSIC-CORE-RIG.md](https://github.com/QuietBriony/Music/blob/main/docs/USAGE-MUSIC-CORE-RIG.md) / [Music/audio/music-recorder.js](https://github.com/QuietBriony/Music/blob/main/audio/music-recorder.js) |
| [Hazama FM](../fm.html) | ジャンルとenergyを選んで流す、少ない操作のラジオ。<br>START → techno / ambient / pianoなどを一つ選び、60–90秒聴く。 | RECの音声ファイル／SYNCの設定・聴感文脈。<br>YouTubeのhazamaチャンネルとは別のアプリ。新曲をAIモデルで生成・投稿するボタンではない。 | 実装あり・実音評価は別<br>[Music/fm.html](https://github.com/QuietBriony/Music/blob/main/fm.html) / [Music/fm.js](https://github.com/QuietBriony/Music/blob/main/fm.js) / [Music/audio/music-recorder.js](https://github.com/QuietBriony/Music/blob/main/audio/music-recorder.js) |
| [Band Room / HAZAMA](../band-room.html?band=hazama) | 原音のパート別音声とブラウザAI再現を聴き比べ、練習・差し替え・録音する。<br>HAZAMA 01の原音でSTART → AI再現と比較。Tabasco等の通常Band Roomにも切り替えられる。 | mix REC／4 stems pack／listening note。MIDI読込は先頭1小節のドラム用。<br>HAZAMA v401の音質・実mobileはBL-041で判定待ち。02 AIは01 frames共有の暫定版。MIDI OUTはclock、INはphrase/section操作で、一般的な鍵盤・CC learnではない。 | 実装あり・実音評価は別<br>[Music/band-room.html](https://github.com/QuietBriony/Music/blob/main/band-room.html) / [Music/band-room.js](https://github.com/QuietBriony/Music/blob/main/band-room.js) / [Music/presets/bands.json](https://github.com/QuietBriony/Music/blob/main/presets/bands.json) |
| [Lyric Lab](../lyric-lab.html) | 歌詞・曲の設計・制作指示を一曲ずつ整理する作品棚。<br>既存作品を開く → 制作先とBPM等を確認 → 制作パケットをコピー。 | 歌詞付き制作指示／歌詞を含まないScene metadata。<br>ACE-Step等へ自動送信しない。端末間の作品棚同期は認証済みCloudflare/D1環境が別途必要。GitHub Pagesの入口だけでは保証されない。 | 実装あり・実音評価は別<br>[Music/lyric-lab.js](https://github.com/QuietBriony/Music/blob/main/lyric-lab.js) / [Music/docs/LYRIC-LAB-USAGE.md](https://github.com/QuietBriony/Music/blob/main/docs/LYRIC-LAB-USAGE.md) / [Music/functions/api/lyric-drafts.js](https://github.com/QuietBriony/Music/blob/main/functions/api/lyric-drafts.js) |
| [Chill Session](https://quietbriony.github.io/chill/session.html) | ピアノと余白を中心に、ゆっくり変化する静かな演奏。<br>START。まずピアノだけを聴き、必要な時だけBASS / DRUMSを足す。 | ブラウザ演奏／quiet-piano recipeとsession文脈。<br>独立したactiveアプリ。汎用アンビエントに統一せず、長い休符とピアノの役割を残す。実音の好みの判定は別。 | 実装あり・実音評価は別<br>[chill/session.html](https://github.com/QuietBriony/chill/blob/main/session.html) / [chill/engine.js](https://github.com/QuietBriony/chill/blob/main/engine.js) / [chill/AGENTS.md](https://github.com/QuietBriony/chill/blob/main/AGENTS.md) |
| [Drum Floor](https://quietbriony.github.io/drum-floor/) | ノリ・休符・強弱を作るドラム専門の演奏面と候補生成器。<br>最初はマイクもMIDIも使わず、再生（SYNC/手動）でgrooveを試す。 | ブラウザ演奏／CLIのMIDI候補／明示有効化した時だけMIDI note出力。<br>SYNC受信だけでは再生・MIDI送信しない。MusicやDAWとのサンプル精度の同時演奏を保証するものではない。 | 実装あり・実音評価は別<br>[drum-floor/app.js](https://github.com/QuietBriony/drum-floor/blob/main/app.js) / [drum-floor/src/midi-output.js](https://github.com/QuietBriony/drum-floor/blob/main/src/midi-output.js) / [drum-floor/drum\_floor/midi.py](https://github.com/QuietBriony/drum-floor/blob/main/drum_floor/midi.py) |
| [Namima](https://quietbriony.github.io/namima/) | 水・庭・穏やかな空気のための、映像付きアンビエント。<br>Tap to start → 音と波紋を聴く。ほかのプレイヤーは止めて比較する。 | ブラウザの音・映像／安全なmoodの翻訳。<br>同じrepoのオフライン周波数レンダーとは別物。暗いアシッドや強い低域を既定音へ混ぜない。 | 実装あり・実音評価は別<br>[namima/audio.js](https://github.com/QuietBriony/namima/blob/main/audio.js) / [namima/sketch.js](https://github.com/QuietBriony/namima/blob/main/sketch.js) / [namima/music-session-adapter.js](https://github.com/QuietBriony/namima/blob/main/music-session-adapter.js) |
| [OpenClaw Desk](https://quietbriony.github.io/openclaw/) | SYNCを読み、次の行き先・確認待ち・候補の段取りを見る制作卓。<br>Core RigかFMでSYNC → 同じブラウザのDeskでlatest packetを確認。 | review・routing案・人間が実行するコマンドの提示。<br>このrepoのDeskは音を出さず、機材操作・REC・upload・mergeを自動実行しない。汎用OpenClaw製品の説明ではない。 | 実装あり・実音評価は別<br>[openclaw/index.html](https://github.com/QuietBriony/openclaw/blob/main/index.html) / [openclaw/README.md](https://github.com/QuietBriony/openclaw/blob/main/README.md) / [openclaw/AGENTS.md](https://github.com/QuietBriony/openclaw/blob/main/AGENTS.md) |

### PCで作る・仕上げる・渡す

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
| [ACE-Step 制作レーン](https://github.com/QuietBriony/Music/blob/main/docs/ACE-STEP-WORKFLOW.md) | スタイル文や歌詞から固定音声の候補を作り、人が選ぶオフライン制作。<br>既存のHAZAMA制作レシピを読む。実行PC・model・出力先を確認してから別途生成する。 | 生成音声／seed・prompt・採用判断。HAZAMA Still Movingの制作実績あり。<br>Band RoomのAI再現とは別の生成方式。GPU・model download・生成はこの入口から開始しない。生成物のYouTube公開実績は未確認。 | 手動工程・環境確認<br>[Music/docs/HAZAMA-STILL-MOVING-ACESTEP.md](https://github.com/QuietBriony/Music/blob/main/docs/HAZAMA-STILL-MOVING-ACESTEP.md) / [Music/config/external-dependencies.json](https://github.com/QuietBriony/Music/blob/main/config/external-dependencies.json) |
| [周波数・IDMレンダー / iPhone受け渡し](https://github.com/QuietBriony/namima/blob/main/README.md) | 周波数・ドローン・深いビートの実験を固定ファイルとして作る、別系統のPythonレーン。<br>namimaのREADMEでcandidate境界と依存を確認。出力先を明示して試作する。 | WAV／ffmpeg利用時のiPhone用M4A／seed・SHA-256付きhandoff。専用調律向けMIDIも別モジュールにある。<br>ブラウザNamimaへ未接続。依存・保存先・調律音源は環境確認が必要。M4A作成はDrive同期完了やYouTube公開を意味しない。 | 候補・要検証<br>[namima/src/namima/deliver.py](https://github.com/QuietBriony/namima/blob/main/src/namima/deliver.py) / [namima/src/namima/idm\_ambient.py](https://github.com/QuietBriony/namima/blob/main/src/namima/idm_ambient.py) / [namima/src/namima/solfeggio\_composer.py](https://github.com/QuietBriony/namima/blob/main/src/namima/solfeggio_composer.py) / [namima/src/namima/midi\_export.py](https://github.com/QuietBriony/namima/blob/main/src/namima/midi_export.py) / [namima/src/namima/hazama\_release.py](https://github.com/QuietBriony/namima/blob/main/src/namima/hazama_release.py) |
| [素材解析・stems・AI再現の制作CLI](https://github.com/QuietBriony/Music/blob/main/docs/WORKER-GAMING-RUNBOOK.md) | 既存素材の解析・パート分離・再現候補・DAW受け渡しを支える制作スクリプト群。<br>runbookで対象コマンドとmachine capabilityを確認。重い処理は別途明示して実行する。 | repo外のworker-output／解析metadata／stemsや再現候補。<br>データを作るレーンで、公開runtimeの自動更新器ではない。未採用候補を既存曲へ上書きしない。 | 手動工程・環境確認<br>[Music/scripts/worker-gaming-pipeline.py](https://github.com/QuietBriony/Music/blob/main/scripts/worker-gaming-pipeline.py) / [Music/scripts/render-bandroom-ai-recreation.py](https://github.com/QuietBriony/Music/blob/main/scripts/render-bandroom-ai-recreation.py) / [Music/docs/BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md](https://github.com/QuietBriony/Music/blob/main/docs/BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md) |
| [Sonar / NI / MIDI・機材](https://github.com/QuietBriony/Music/blob/main/docs/MUSIC-STACK-SYSTEM-MANUAL.md#daw) | MIDIを目で直し、好きな音源で鳴らし、人の演奏とmixを仕上げる場所。<br>音声かMIDIを一つ持ち込み、Sonarの1トラックで確認。実機接続はprivate台帳から別途確認。 | DAW project／MIDI／採用音色の設定／mix・master。<br>MIDIだけではNI preset・303 slide・microtuning・音色は再現されない。M32等のノブ割当やEP-133への書込みを自動化しない。 | 手動工程・環境確認<br>[Music/docs/DAW-INTEGRATION.md](https://github.com/QuietBriony/Music/blob/main/docs/DAW-INTEGRATION.md) / [Music/docs/EP133-KOII-BANDROOM-WORKFLOW.md](https://github.com/QuietBriony/Music/blob/main/docs/EP133-KOII-BANDROOM-WORKFLOW.md) / [Music/references/studiopc-sonar-ni-reference.json](https://github.com/QuietBriony/Music/blob/main/references/studiopc-sonar-ni-reference.json) |
| [保存・動画化・YouTube公開](https://github.com/QuietBriony/Music/blob/main/docs/MUSIC-STACK-SYSTEM-MANUAL.md#delivery) | 採用音源を聴ける形で保存し、動画・説明・権利確認を揃えて公開担当へ渡す。<br>masterとiPhone試聴版、制作メモを一組にして保存。公開先と権限は公開担当へ確認する。 | 受け渡し一式。公開URLは実際の公開確認後に記録。<br>現行YouTubeの制作方式・投稿済み曲・upload権限は今回未監査。Gitの同期や音源生成だけでは投稿されない。 | 手動工程・環境確認<br>[Music/docs/PRODUCTION-PATH.md](https://github.com/QuietBriony/Music/blob/main/docs/PRODUCTION-PATH.md) / [Music/docs/MUSIC-STACK-SYSTEM-MANUAL.md](https://github.com/QuietBriony/Music/blob/main/docs/MUSIC-STACK-SYSTEM-MANUAL.md) |

### これから育てる

| 道具・入口 | 今できること／最初の一手 | 保存・境界 | 状態・実装根拠 |
|---|---|---|---|
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

Driveへ保存したことと、同期完了・iPhoneで再生確認・YouTube公開は別々に確認します。
既存の公開担当との連携、投稿権限、どの動画がACE産かは今回未監査。
公開担当へmaster・試聴版・制作メモを渡し、必要な権利・公開設定を確認してから投稿する工程です。
今回は外部uploadも公開先の変更も行いません。

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
- 全道具の実音品質、実iPhone、実機MIDI、別PC・Driveの同期、認証・公開状態は別の確認項目。
- 次の順序: **この入口で一周する → 採用候補の所在をprivateで台帳化 → 8小節の視覚的楽器**。

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
