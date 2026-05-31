# EP-133 K.O.II / Band Room Workflow

## Position

EP-133 K.O.II は、Band Room AI 再現を手で汚して戻すための
hardware sampler / rhythm sketch box として扱う。

この repo では、EP-133 本体を自動で書き換えない。Codex ができるのは
Windows から見えるか確認し、転送用素材、pad map、録音後の戻し先を作るところまで。
sample transfer、project backup、pad assignment、耳での判断は人間確認を挟む。

## Do Not Break Defaults

安全ルール:

- Band Room の default playback、preset JSON、service worker、DAW project は変更しない。
- EP-133 本体への sample / project 書き込みは EP sample tool で人間が確認して実行する。
- 生成 audio、転送 pack、録音 take は `C:\workspace\music-stack-worker` に置く。
- Git に入れるのは docs、code、review 済み candidate JSON、metadata だけ。

## Connection Lanes

### USB-C

USB-C は次のために使う:

- Windows への MIDI device 認識
- MIDI clock / transport
- EP sample tool の sample transfer / backup / restore
- firmware update
- 給電

PC 側は USB-C to USB-C でも USB-A to USB-C でもよい。重要なのは
**data 対応 cable**で、充電専用 cable だと EP-133 が給電だけされて Windows に出ない。

電池は入れたままでよい。長時間作業中に USB 給電が揺れても本体が落ちにくい。

### Audio

音声録音の本線は USB-C ではなく analog output:

```text
EP-133 output 3.5 mm stereo
  -> 3.5 mm stereo TRS to dual 1/4 inch TS
  -> UR44 stereo line input
  -> Sonar stereo audio track
  -> C:\workspace\music-stack-worker\daw-export\...
  -> Band Room external stems
```

Gaming PC では EP-133 が MIDI / USB device として見えているが、audio input としては
見えていない。Studio PC で UR44 をつないだら、この analog capture lane を本命にする。

## Current Verification

EP-133 をつないだら:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-hardware
```

期待する状態:

- `EP-133 | MidiEndpoint | OK`
- `EP-133 | MEDIA | OK`
- `USB\VID_2367&PID_0020...`

UR44 は Studio PC 側で `Yamaha Steinberg` / `UR44` として見える状態を目標にする。

## First Transfer Pack

Band Room / AI recreation から EP-133 に入れるための素材 pack を作る:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py ep133-pack tabasco human-fly --include-ai-recreation --open-folder
```

出力先:

```text
C:\workspace\music-stack-worker\hardware-jam\ep133-inbox\<band>\<song>\ep133-pack-YYYYMMDD-HHMMSS\
  transfer\
    A01_kick_...
    A02_snare_...
    ...
    B01_drums-loop_8.0s.wav
  ep133-transfer-manifest.json
  ep133-transfer-pack.md
```

この command は EP-133 に何も書かない。`transfer` folder に、EP sample tool へ
drag しやすい 46.875 kHz / 16-bit WAV と suggested pad map を作るだけ。

## EP Sample Tool Flow

1. EP-133 を USB-C で PC へ直結する。
2. <https://teenage.engineering/apps/ep-sample-tool> を開く。
3. Browser の MIDI/device permission で `EP-133` を許可する。
4. `ep133-transfer-pack.md` を横に開き、suggested pad map を見る。
5. `transfer` folder の WAV を sample tool へ入れる。
6. EP-133 側で project / pad / group を確認してから置き換える。
7. 重要な本体 project があるなら、先に sample tool で backup を取る。

## Suggested Project Layout

最初は単純でよい:

| Group | Role | Contents |
|---|---|---|
| A | drum kit / one-shots | kick, snare, hat, tom, crash, texture |
| B | loops | AI drums, bass, other, rough mix short loops |
| C | free | EP-133 built-in sounds, resample, live chop |
| D | arrangement | live variation, punch-in FX, song mode scenes |

Band Room に戻すときは、音の役割で分ける:

- drum / beat take -> Band Room `external drums`
- bass-like loop -> Band Room `external bass`
- guitar / noise / sample texture -> Band Room `external other`
- vocal phrase -> Band Room `external vocal` only when it is meant as a vocal layer

## Jam Recipe

1. `recreation-cycle` で Band Room AI stem と target analysis を作る。
2. `ep133-pack` で EP-133 transfer pack を作る。
3. EP sample tool で pack を入れる。
4. EP-133 で chop、pattern、resample、punch-in FX を試す。
5. 良い take は Sonar / UR44 で録音する。
6. 録音を `hardware-jam\captures` か `daw-export` に置く。
7. Band Room の external stems で原音 / AI / hardware take を A/B する。
8. 良かった timing や質感だけを metadata / candidate JSON / docs に昇格する。

## What Codex Can Do

Codex が進められること:

- `check-hardware` で EP-133 / UR44 / MIDI visibility を見る。
- `ep133-pack` で転送用素材と pad map を作る。
- EP sample tool を開く。
- Sonar に取り込むための録音 folder / naming sheet を作る。
- 録音後の WAV を Band Room external stems に入れる手順を整理する。

人間確認が必要なこと:

- EP-133 の pad、knob、fader、project selection。
- EP sample tool の device permission と実際の書き込み確認。
- cable、UR44 gain、monitor volume、clip していないかの確認。
- 最終的に「これが良い」と判断する耳チェック。

## Troubleshooting

- EP-133 が給電だけされる: cable が充電専用かもしれない。data 対応 cable に替える。
- Windows に `EP-133` が出ない: USB hub を避けて PC 直挿しにする。
- sample tool が認識しない: browser permission を確認し、別 browser / cable を試す。
- Sonar に音が入らない: USB-C ではなく analog output -> UR44 input を確認する。
- Band Room に戻せない: まず WAV / MP3 として export し、external stems の file input に入れる。

## Official References

- EP-133 hardware overview:
  <https://teenage.engineering/guides/ep-133/hardware-overview>
- EP sample tool:
  <https://teenage.engineering/apps/ep-sample-tool>
- EP-133 system / MIDI settings:
  <https://teenage.engineering/guides/ep-133/system>
- EP-133 product specifications:
  <https://teenage.engineering/products/ep-133>
