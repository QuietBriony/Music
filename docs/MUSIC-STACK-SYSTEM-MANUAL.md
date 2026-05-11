# Music Stack System Manual

Music Stack は、音を鳴らす場所と、次の制作判断を整理する場所を分けています。

## まずこれだけ

| 使いたいこと | 開く場所 | やること |
|---|---|---|
| 流しっぱなしで聴く | [Hazama FM](../fm.html) | `START`、必要なら `shuffle` / genre |
| 音を作り込む | [Music Core Rig](../index.html) | 9 fader、`AUTO MIX`、`ARC`、`CULT` |
| 今の状態を保存する | `SYNC` | 音声ではなく metadata-only の地図を保存 |
| 人間確認を残す | [Review Queue](music-stack-human-review-queue.html) | 音量、genre、Desk導線などの確認待ちを見る |
| 次に何を見るか決める | [Desk / OpenClaw repo hub](https://quietbriony.github.io/openclaw/) | latest SYNC を読み、行き先と次PR候補を見る |

## SYNC とは

`SYNC` は録音ボタンではありません。

今鳴っている Music / Hazama FM の状態を、同じブラウザ内の Music Stack に
metadata-only packet として保存するボタンです。

入るもの:

- genre、BPM、energy、fader、AUTO/ARC 状態
- Hazama FM の listening trace、source、review cue
- `Musicで削る`、`chillで聴く`、`drum-floorで押す` などの推奨行き先

入らないもの:

- raw audio、recording、sample、lyrics
- API token、secret
- 自動再生、録音開始、MIDI arm、merge、push

## システム全体像

| System | 役割 | 触るもの | SYNC後 |
|---|---|---|---|
| Hazama FM | 一番簡単な聴感入口 | `START`、energy、genre、`shuffle` | FM文脈とreview cueを保存 |
| Music Core Rig | 統合音源 / producer desk | 9 fader、AUTO MIX、ARC、REC、MIC | session packet と次の行き先を保存 |
| OpenClaw Desk | openclaw repo の Pages ハブ / Surface用の制作卓 | latest SYNC、packet inspector、repo harvest | 候補と手順を出すだけ |
| drum-floor | rhythm / groove / stage-safety reference | 手動preview、candidate | 自動armしない |
| namima | safe ambient / water mood | mood / trace / ripple | 暗いglitchや低域圧を足さない |
| chill | quiet piano / trio / long-form listening | piano, bass, soft drums | STARTは人間操作 |

## いつどれを押すか

| Button | 意味 | いつ使う |
|---|---|---|
| `START` | 音を鳴らす | 最初 |
| `shuffle` | genre / energy をランダム試聴 | Hazama FMの聴感テスト |
| `AUTO MIX` | faderを自動で動かす | Music Core Rigを自走させたい時 |
| `ARC.36` | 長尺アーク | 50分くらい流したい時 |
| `MIC` | 録音せず入力特徴だけでgrooveを曲げる | 歌/手拍子/声で少し反応させたい時 |
| `REC` | Music Core Rigの出音をWAV保存 | 人間が録りたい時 |
| `SYNC` | 今の状態をmetadata-only保存 | 良い/気になる瞬間 |

## 基本フロー

1. Hazama FM か Music Core Rig で聴く。
2. 良い瞬間、または気になる瞬間で `SYNC`。
3. Music画面の `次の行き先` か Desk / OpenClaw repo hub を見る。
4. 必要な repo だけ開く。
5. 音を出す、録る、実装する、mergeする判断は人間が行う。

## 追加マニュアル

- [Hazama FM manual](USAGE-HAZAMA-FM.md)
- [Music Core Rig manual](USAGE-MUSIC-CORE-RIG.md)
- [SYNC manual](music-stack-sync-manual.md)
- [Human review queue](music-stack-human-review-queue.html)
- [Hazama FM architecture](HAZAMA-FM-ARCHITECTURE.md)
- [Runtime listening checklist](runtime-browser-listening-checklist.md)
- [Desk / OpenClaw repo hub](https://quietbriony.github.io/openclaw/)

## 安全境界

- Music Stack OpenClaw Desk は LLM処理先でも Umbrel 常駐 runtime でもありません。
- ここでいう OpenClaw は `QuietBriony/openclaw` repo の Pages ハブです。
- Desk は音を鳴らさず、手順と候補を出す制作卓です。
- SYNC packet は制作判断の地図であり、他repo runtimeを直接支配しません。
- target repo の編集、依存追加、archive、release、push/merge は別判断です。
