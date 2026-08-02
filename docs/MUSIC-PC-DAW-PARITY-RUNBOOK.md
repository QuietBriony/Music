# Music PC DAW Parity Runbook

## Purpose

`worker-gaming`（WorkerPC）で作った music-stack 音楽制作環境を、あとから
`studioPC` / studio PC に再現できるようにする標準構成表。

repo は source of truth、DAW は repo 外の render / polish / recording
環境として扱う。DAW project、plugin cache、生成 audio は Git に入れない。

## Machine Roles

| PC | Role | Main jobs | Avoid |
|---|---|---|---|
| `chouta-surface` | command / repo editor | docs、軽い repo 編集、PR 確認、remote 操作 | UR44 主機、重い stem 分離、DAW 主機 |
| `worker-gaming` | GPU worker / render bench | Demucs、Band Room AI recreation、Sonar/Ableton/NI render、VCV/SuperCollider texture | ear-critical final listen、runtime UI の直接編集 |
| `studioPC` / studio PC | listen / record / DAW reference | UR44、monitor/headphone、Sonar/Ableton stem polish、録音、最終試聴 | 長時間 GPU batch、ARM Surface での UR44 運用 |

ARM Surface では UR44 driver / ASIO 周りが安定しにくいので、UR44 は
Intel studio PC に寄せる。Surface は repo と remote control の司令塔として使う。

## Standard Software Baseline

Install these when rebuilding the same environment on another Windows PC.

Core:

- Git, Node, Python, FFmpeg.
- `C:\workspace\music-stack\Music`
- `C:\workspace\music-stack-worker`
- `C:\workspace\music-stack-worker\.venv`
- Python packages in the worker venv: PyTorch, torchaudio, Demucs, librosa,
  soundfile, imageio-ffmpeg, scipy, numpy.

Exact CPU/GPU analysis package versions, license status, measured footprint, and external
model locations are maintained in
[`config/external-dependencies.json`](../config/external-dependencies.json). Rebuild from
that baseline rather than an unbounded `pip install -U`. ACE-Step / Demucs / Whisper weights
stay under the repo-external worker root and are not copied to StudioPC unless an operator
explicitly schedules that model lane. DAW/product versions below remain the source of truth
for commercial desktop software and are not inferred from the Python manifest.

DAW:

- Cakewalk Product Center.
- Cakewalk Sonar. WorkerPC / StudioPC は同じ安定版へ揃える。
- Product Center add-ons: Core Plugins, Studio Instruments Suite, Sonar Drum
  Replacer, Session Drummer 3, TH-U, Help & Documentation, Precision Suite,
  ProChannel Modules, L-Phase/T-Phase plugin content.
- Ableton Live 12 Lite. 両 PC とも各ライセンスで利用できる edition の同じ安定版へ
  揃え、共有 Set では edition 固有機能を使わない。

Instruments / effects:

- Native Access.
- Kontakt 8 Player を新規プロジェクトの標準にする。
- Kontakt 7 / Kontakt 6 は旧プロジェクト互換用として残す。
- Reaktor 6 VST3、Komplete Kontrol、Traktor Pro 3、Guitar Rig、Maschine は
  既存ライセンスの範囲で保守する。有料 major upgrade は自動購入しない。

## WorkerPC Verified Baseline — 2026-07-27

実行ファイルの product/file version と Native Access の Installed 表示を照合した
更新後の基準。Cakewalk の uninstall registry は旧版番号を残すことがあるので、
Sonar は `Sonar.exe` と Quick Start の表示を基準にする。

| Product | WorkerPC verified | StudioPC target / policy |
|---|---:|---|
| Cakewalk Product Center | `1.1.0.004` | 公式提供の現行版 |
| Cakewalk Sonar | `2026.07` / build `32.07.0.021` | 同じ `2026.07` build 021 |
| Ableton Live 12 Lite | `12.4.3` | 同じ `12.4.3` |
| Native Access | `3.25.2.893` | 同じ現行版 |
| Kontakt 8 Player | `8.11.1` | 同じ `8.11.1`、新規 project の標準 |
| Kontakt 7 Player | `7.10.9` | 同版を維持、旧 project 用 |
| Kontakt 6 | `6.8.0` | 必要な旧 project がある PC では維持 |
| Reaktor 6 | `6.5.0` | 同じ `6.5.0`、新規 project は VST3 |
| Komplete Kontrol | `3.5.4` | 同じ `3.5.4` |
| Traktor Pro 3 | `3.11.1.17` | 既存ライセンスの同版。Traktor Pro 4 は購入しない |
| Maschine 2 | `2.18.4` | 使用する場合は同版 |
| Guitar Rig 6 LE | `6.4.0` | 使用する場合は同版 |

WorkerPC の Ableton は公式 account から入手した `12.4.3` へ更新し、`VST3 System
Folders` を有効化して再スキャン済み。StudioPC も同じ `12.4.3` に合わせる。Live
は新しい point release で保存した Set を古い point release で開けないため、旧
Set を初回保存するときは別名保存する。

## StudioPC Measured State — 2026-07-28

StudioPC は C drive 全体を repository にせず、
`C:\workspace\music-stack\Music` だけを既存 Git repository として使用した。
作業開始時の C drive 空きは `42.47 GB`、検証後は `45.68 GB`。内蔵 drive は
C drive のみで、運用 guardrail の `25 GB` を維持している。

| Product | StudioPC current | WorkerPC target | Action / capacity risk |
|---|---:|---:|---|
| Cakewalk Product Center | `1.1.0.004` | `1.1.0.004` | matched |
| Cakewalk Sonar | `2026.07` / build `32.07.0.021` | same | matched |
| Ableton Live 12 Intro | `12.3.2` | Live 12 `12.4.3` | VST3 test passed。built-in updater は `12.3.5` のみ提示したため停止。account から `12.4.3` installer を取得して WorkerPC と同時点へ合わせる |
| Native Access | `3.25.2.893` | same | matched。registry の旧表示は判定に使わない |
| Kontakt 8 Player | `8.11.1` | same | VST3 passed。standalone は process 起動後に main window が表示されず再確認待ち |
| Reaktor 6 | `6.5.0` | same | VST3 / standalone passed |
| Komplete Kontrol | `3.5.4` | same | standalone scan / VST3 passed |
| Traktor Pro 3 | `3.11.1.17` | same | matched。Traktor Pro 4 は未購入 |
| Kontakt 6 / 7 | not installed | old-project compatibility only | StudioPC の既存旧 project 要件が未確認のため追加も削除もしていない |
| Maschine 2 / Guitar Rig 6 LE | not installed | use only when required | 共有 project の要件がないため延期。Guitar Rig 7 LE も major side-by-side のため未導入 |

Native Access location:

```text
Download: C:\Users\Public\Downloads
Application: C:\Program Files\Native Instruments
Content: C:\Users\Public\Documents
```

StudioPC の共通 VST3:

```text
C:\Program Files\Common Files\VST3\Kontakt 8.vst3
C:\Program Files\Common Files\VST3\Reaktor 6.vst3
C:\Program Files\Common Files\VST3\Komplete Kontrol.vst3
```

StudioPC の共有必須 content は次まで揃えた。Native Access は 1 製品ずつ処理し、
各処理後に C drive の空きを確認した。

| Product | Version | StudioPC measured size |
|---|---:|---:|
| Scarbee Mark I | `1.4.0` | `1.32 GB` |
| Monark | `1.3.2` | `62.8 MB` |
| Prism | `1.6.2` | `125.3 MB` |
| TRK-01 Bass | `1.0.1` | `23.1 MB` |
| Reaktor Factory Selection R2 | `1.0.2` | `59.1 MB` |

P3 の Mikro Prism、Blocks Base、Kinetic Treats、Kontakt Factory Selection、
Play Series Selection と追加 Expansion は、共有 project での使用が確認できるまで
延期する。大容量 content を追加する場合は、外付け SSD を用意して user 承認後に
Native Access の content location を決める。既存 library は自動 relocate しない。

### Shared NI content

両 PC の同じ Native Access ライセンスから、次を優先して揃える。

| Product | WorkerPC | StudioPC action |
|---|---:|---|
| Scarbee Mark I | installed / Kontakt 8 で認識 | install、Kontakt 8 で認識確認 |
| Monark | `1.3.2` | 同版 |
| Prism | `1.6.2` | 同版 |
| TRK-01 Bass | `1.0.1` | 同版 |
| Reaktor Factory Selection R2 | `1.0.2` | 同版 |
| Mikro Prism | `1.1.1` | 同版 |
| Blocks Base | `1.0.2` | 同じ license で利用可能なら同版 |
| Expansions Selection | `1.0.1` | 同じ license で利用可能なら同版 |
| Kinetic Treats / Kontakt Factory Selection / Play Series Selection | installed | 同じ license で利用可能な content を install |

WorkerPC の Native Access は Updates `0` まで更新済み。Available に残る
Guitar Rig 7 LE は新しい side-by-side major のため、共有構成に必要になるまで
未導入とする。Kontakt 6 / 7、旧 Cakewalk、旧 Ableton は、旧 project の参照確認
なしに削除しない。

### VST3 paths

Sonar / Ableton の共通 system folder:

```text
C:\Program Files\Common Files\VST3
```

WorkerPC で確認済みの主要 NI modules:

```text
C:\Program Files\Common Files\VST3\Kontakt 8.vst3
C:\Program Files\Common Files\VST3\Kontakt 7.vst3
C:\Program Files\Common Files\VST3\Kontakt.vst3
C:\Program Files\Common Files\VST3\Reaktor 6.vst3
C:\Program Files\Common Files\VST3\Komplete Kontrol.vst3
C:\Program Files\Common Files\VST3\Maschine 2.vst3
```

Sonar の scan paths では、上記に加えて次を確認済み。

```text
%LOCALAPPDATA%\Programs\Common\VST3
C:\Program Files\Cakewalk\VstPlugins
```

新規 Sonar project は `Kontakt 8.vst3` と `Reaktor 6.vst3` を使う。Kontakt 6 /
7 の plug-in ID を使う既存 project は、そのまま旧版で開いてから必要な track を
freeze / WAV 化する。VST2 folder は旧 project に必要なときだけ追加する。

Sound design:

- VCV Rack 2 Free.
- SuperCollider.
- Atom remains legacy only; use VS Code / repo-native tooling for new work.

Hardware jam lane:

- EP-133 K.O.II as the hand sampler / rhythm sketch box.
- UR44 as the audio and MIDI interface on the Intel studio PC.
- Hardware routing details:
  [HARDWARE-JAM-ROUTING.md](HARDWARE-JAM-ROUTING.md).

## Default DAW Choice

Default to Sonar for Windows music-stack production.

Use Sonar when:

- UR44 / ASIO recording and monitoring matter.
- Stems need normal timeline editing, comping, mixing, bus processing, or bounce.
- Cakewalk add-ons are useful: drum replacement, ProChannel, TH-U, Studio
  Instruments, L-Phase/T-Phase.
- The job is a Band Room AI recreation polish pass.

Keep Ableton as the secondary DAW.

Use Ableton when:

- Session View / loops / clips are the fast path.
- Ableton Link or live sync experiments become important.
- The work is electronic sketching, performance arrangement, or quick idea
  capture.
- A Live project already exists.

Do not remove either lane. Sonar is the practical Windows/UR44 center; Ableton
is the loop/live/sync lane. WorkerPC の Ableton VST3 scan は完了しており、共有運用の
残件は StudioPC の同版化。

更新・検証の順番は Sonar → Sonar VST3 scan / smoke test → NI standalone /
plug-in 確認 → Ableton update / VST3 rescan とする。NI instrument を使う制作でも
DAW の project format と audio routing が土台なので、共有運用の基準は Sonar を
先に固定する。

## StudioPC 50 GB Capacity Plan

StudioPC の C drive 空きが約 `50 GB` の場合でも、WorkerPC と共有する制作コアは
揃えられる見込み。ただし Native Access の全 Available 製品をミラーせず、
「同じ DAW / plug-in version + 共有 project で使う content」を parity の単位に
する。

### Capacity guard

- 作業前に全 drive の空き容量、Native Access の content / download location、
  既存 NI library の実容量を記録する。
- C drive は作業完了後も最低 `25 GB` を残す。これは製品の公式要件ではなく、
  Windows update、DAW cache、録音、plug-in scan 用にこの環境で採用する運用上の
  guardrail。
- Native Access は必ず 1 製品ずつ処理し、各 install / update 後に空き容量を
  再確認する。一括 queue は使わない。
- 別の内蔵 drive / 外付け SSD がある場合、大きい NI content の保存先候補にする。
  VST3 application は通常の system path に置き、既存 library の自動移動はしない。
- 容量不足時に cache、旧Kontakt、旧DAW、既存 libraryを勝手に削除しない。
  削除候補と回収見込みだけを報告し、user 承認を待つ。
- Native Access の表示上、次の 1 製品を入れると C drive が `25 GB` 未満になる
  見込みなら、その install 前で停止する。

### Install priority

| Priority | StudioPC action | Capacity policy |
|---|---|---|
| P0 | 既存 project、録音、user preset、旧Kontakt 6 / 7 を保護 | 削除・上書きしない |
| P1 | Sonar、Ableton、Native Access、Kontakt 8、Reaktor 6、Komplete Kontrol | WorkerPC と同版を優先 |
| P2 | Scarbee Mark I、Monark、Prism、TRK-01 Bass、Reaktor Factory Selection R2 | 共有必須 content |
| P3 | Mikro Prism、Blocks Base、Kinetic Treats、Kontakt Factory Selection、Play Series Selection | 既存導入済み、または残容量が十分なら共通化 |
| P4 | Expansions、Maschine content、VCV / SuperCollider、StudioPCで使わない追加音源 | 必要になるまで延期可 |

Traktor Pro 3、Maschine、Guitar Rig は application / 既存 project の必要性を見て
更新する。大きな追加 content を parity の必須条件にはしない。有料 major upgrade
は導入しない。公式側に WorkerPC target より新しい安定版が出ていた場合も、
StudioPC だけ先行更新せず、両 PC を同時に上げるか user に確認する。

### StudioPC execution order

1. Repo と drive / app / VST3 / library / hardware の現状を read-only で棚卸し。
2. 既存 project を更新版で開く前に、project folder 全体を repo 外へ backup。
   必要なら旧 NI track を freeze / WAV 化する。
3. Cakewalk Product Center と Sonar を WorkerPC target に合わせる。
4. StudioPC で実際に使う UR44 の公式 driver / dspMixFx だけを更新し、Sonar の
   Yamaha Steinberg ASIO と `48 kHz` / `24 bit` を確認する。
5. Native Access 本体を更新し、login 済み account / license / installed content
   を確認。P1 → P2 → P3 の順で 1 製品ずつ更新する。
6. Kontakt 8、Reaktor 6、Komplete Kontrol standalone を起動して scan と発音を
   確認する。
7. Ableton を WorkerPC target に合わせ、VST3 System Folders を有効化して rescan。
8. Sonar の共通 smoke test と、Komplete Kontrol から Monark preset を読む
   Ableton test を実施する。
9. 実測した version、library、VST3 path、残容量、StudioPC 固有の保留事項をこの
   Runbook と `PC-REGISTRY.md` に反映する。

StudioPC の Codex へ渡す copy-paste prompt:

- [`codex-prompts/studiopc-daw-parity-setup.md`](codex-prompts/studiopc-daw-parity-setup.md)

## VCV Rack / SuperCollider

These are useful, but not the daily production center.

- VCV Rack: modular textures, clocked experiments, drum-floor groove ideas,
  noisy transitions, voltage-style processing.
- SuperCollider: short procedural percussion, drone, glitch, ambience, and
  batch-generated sound design.

Export audio or metadata to `C:\workspace\music-stack-worker\...`, then review
in Sonar, Ableton, or Band Room. Do not wire either tool into automatic record,
upload, or merge flows.

## GitHub-Only vs DAW Hybrid

GitHub-only is good for reproducibility: code, presets, schemas, metadata,
review history, and agent-readable decisions.

DAWs are better for hearing the result: plugin tone, compression, reverb tails,
timing feel, guitar/amp color, stereo image, and final bounce.

The preferred architecture is hybrid:

1. Repo generates candidates and repeatable instructions.
2. Worker/studio PCs render and polish outside Git.
3. Band Room previews external stems.
4. Only reviewed metadata, candidates, docs, or code are promoted into Git.

For the current Band Room AI recreation loop, use
[BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md](BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md).

## Rebuild Checklist

0. On the reference PC, capture the current setup:

   ```powershell
   cd C:\workspace\music-stack\Music
   C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py snapshot-setup --tag worker-gaming-reference
   ```

   Keep the generated JSON/Markdown in
   `C:\workspace\music-stack-worker\reports`. It records the app versions,
   important paths, worker folders, visible MIDI/audio devices, and repo head
   without putting local machine state into Git.

1. Clone repo:

   ```powershell
   cd C:\workspace\music-stack
   git clone https://github.com/QuietBriony/Music.git
   cd C:\workspace\music-stack\Music
   ```

2. Create worker root and venv:

   ```powershell
   python -m venv C:\workspace\music-stack-worker\.venv
   C:\workspace\music-stack-worker\.venv\Scripts\python.exe -m pip install --upgrade pip
   C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py init
   ```

3. Install worker packages. Use the official PyTorch selector for the target
   PC, then install Demucs/librosa dependencies in the worker venv.

4. Install Cakewalk Product Center. Sign in manually, then install Sonar and
   the Product Center add-ons listed above.

5. Launch Sonar once. Complete first-run setup and confirm Quick Start shows
   the expected version.

6. Install Ableton Live 12 Lite. In Preferences > Plug-Ins, enable `VST3 System
   Folders` and rescan. Use `C:\Program Files\Common Files\VST3` as the normal
   VST3 system folder. Add the Native Instruments VST2 folder only when needed:

   ```text
   C:\Program Files\Native Instruments\VSTPlugins 64 bit
   ```

7. Install Native Access content that is already licensed. Prioritize Kontakt 8,
   Reaktor 6, Komplete Kontrol, then the shared NI content listed above.
   Preserve Kontakt 6 / 7 when already installed. Avoid paid major upgrades
   unless explicitly approved.

8. Install VCV Rack 2 Free and SuperCollider when the PC will do sound-design
   renders.

9. On the studio PC, install UR44 driver / dspMixFx and verify ASIO from Sonar.
   Keep browser audio on normal Windows output unless a specific test needs
   otherwise.

10. Validate:

    ```powershell
    C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-env
    C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-daw
    C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-hardware
    node scripts\stack-check.mjs
    ```

## Shared Sonar Smoke Test — 2026-07-27

WorkerPC の repo 外に次を作成した。

```text
C:\Cakewalk Projects\WorkerPC-Common-Smoke-20260727\
```

確認済み:

- Sonar `2026.07` build 021 で新規 project を作成。
- MIDI track と Kontakt 8 VST3 instrument track を作成し、Kontakt 8 editor 起動
  と Scarbee Mark I の認識を確認。
- Reaktor 6 VST3 instrument track で TRK-01 Bass を読み込み、MIDI note を発音。
- Reaktor track を freeze し、非無音の stereo waveform を生成。
- freeze 済み Reaktor track を
  `Audio Export\WorkerPC-Common-Smoke-20260727.wav` へ export。
- `ffprobe` で `pcm_s24le`、`48000 Hz`、`24 bit`、`2 ch`、`5.500521 sec`
  を確認。

DAW project、Audio、Audio Export、MixScenes はすべて repo 外。StudioPC では
同じ構成の project を別 folder に作って再試験し、同じ編集中の project folder を
2 台で同時に開かない。共有するときは `.cwp` 単体ではなく project folder 全体を
扱う。

## StudioPC Sonar / UR44 Verification — 2026-07-28

StudioPC の repo 外に次を作成した。

```text
C:\Cakewalk Projects\StudioPC-Common-Smoke-20260728\
```

確認済み:

- Sonar `2026.07` build `32.07.0.021` で MIDI track、Kontakt 8 VST3、
  Reaktor 6 VST3、短い audio track を作成。
- Kontakt 8 で Scarbee Mark I の `Blue Ballad`、Reaktor 6 で共通 Reaktor 音源
  `Polar Wind` を読み込んだ。
- Kontakt track の freeze を実行した。
- `48 kHz` / `24-bit` / stereo の 2 秒 reference tone を読み込み、
  `Audio Export\StudioPC-Common-Smoke-20260728.wav` へ export した。
- export は PCM、2 ch、`48000 Hz`、`24-bit`、data `576000 bytes`、
  peak `-12.3548 dBFS` で非無音。
- Yamaha Steinberg USB Driver `2.1.9` と Steinberg UR44 Applications
  `2.2.2` を確認し、公式 dspMixFx UR44 の起動と device 通信を確認した。
- Sonar は `Yamaha Steinberg USB ASIO`、UR44 Mix 1、`48 kHz` / `24-bit` /
  `256 samples`。実測 latency は入力 `9.1 ms`、出力 `11.1 ms`、合計
  `20.1 ms`。
- UR44 経由の再生で Sonar meter が動作し、dropout は発生しなかった。物理的な
  `UR44 -> FX1001` 側の可聴確認は user の実機確認を完了条件とする。

StudioPC の通常モニター系は `KOMPLETE AUDIO 2 -> FOSTEX PM0.4`。UR44 は
`FX1001` 側のライブ / 録音系で、同じ出力先として扱わない。Sonar 使用時だけ
Yamaha Steinberg ASIO を選択し、KOMPLETE AUDIO 2 の driver や通常モニター系は
削除しない。

### StudioPC good-output reference

StudioPC の 2026-07-28 Sonar smoke test は
`references/studiopc-sonar-ni-reference.json` に再現条件を記録する。
可聴が確実だった source は 2 秒の `440 Hz` reference tone で、同じ session に
Kontakt 8 + Scarbee Mark I の `Blue Ballad` と Reaktor 6 の `Polar Wind` も
load 済みだった。ただし、user が良いと感じた音をこの 3 source のどれかへ
完全には分離できていない。

WorkerPC では憶測で 1 source に決めず、次を同じ `48 kHz` / `24-bit` stereo で
A/B export する。

- `A-reference-tone.wav`
- `B-scarbee-blue-ballad.wav`
- `C-reaktor-polar-wind.wav`
- `D-combined-reference.wav`

Git で共有するのは recipe と操作手順だけとする。Sonar project、WAV、MIDI、
NI library、plugin cache は repo 外へ置く。WorkerPC の生成と手動 handoff は
`docs/WORKER-GAMING-RUNBOOK.md` の StudioPC Sonar / NI reference 手順を使う。

## Ableton VST3 Verification — 2026-07-27

WorkerPC の Ableton Live 12 Lite を `12.4.3` へ更新し、Preferences > Plug-Ins の
`VST3 System Folders` を有効化して再スキャンした。

確認済み:

- Browser に Native Instruments の VST3 が登録された。
- Kontakt 8 `8.11.1`、Reaktor 6 `6.5.0`、Komplete Kontrol `3.5.4` をそれぞれ
  instrument track へ読み込み、plug-in processor の生成を確認した。
- Ableton が使う system folder は `C:\Program Files\Common Files\VST3`。

Komplete Kontrol 内で発生していた
`Loading issue: Plug-in not found` は、user 承認後に local database を退避して
再構築し、解消を確認した。旧 database は削除せず、次へ退避した。

```text
C:\Users\cta88\AppData\Local\Native Instruments\Komplete Kontrol.db-backup-20260727-184514
```

Standalone Komplete Kontrol の再スキャン完了後、新しい `Plugin.data`、
`Plugin_kk3.data`、`Browser Data\komplete.db3` の生成を確認した。Ableton の
Komplete Kontrol VST3 で Monark の `2Pranged` preset を読み込み、Monark 本体画面の
表示と track / Main の peak `-12.6 dB` を確認した。`Plug-in not found` は再発して
いない。検証 Set は Git 外の次へ保存した。

```text
C:\Cakewalk Projects\WorkerPC-Ableton-VST3-Smoke-20260727 Project\WorkerPC-Ableton-VST3-Smoke-20260727.als
```

Kontakt 8 / Reaktor 6 自体の起動と発音は上記 Sonar smoke test でも確認済み。

StudioPC では Live 12 Intro `12.3.2` の `VST3 System Folders` を有効化して
再スキャンし、Komplete Kontrol VST3 から Monark `2Pranged` preset を読み込んだ。
`Plug-in not found` は発生せず、検証 Set は Git 外の次へ保存した。

```text
C:\Cakewalk Projects\StudioPC-Ableton-VST3-Smoke-20260728\StudioPC-Ableton-VST3-Smoke-20260728 Project\StudioPC-Ableton-VST3-Smoke-20260728.als
```

ただし WorkerPC は `12.4.3` のため、StudioPC の DAW version parity は未完了。
StudioPC の built-in updater が提示した `12.3.5` は入れず、auto-update を停止した。
Ableton account から StudioPC license の Live 12 Intro `12.4.3` Windows installer
を取得し、更新後に同じ Set を再確認する。

## Manual Approval Boundary

Codex can run audits, local scripts, repo checks, and normal app navigation.

Human confirmation is still required for:

- UAC prompts.
- BandLab / Ableton / Native Instruments login.
- MFA / password entry.
- Paid upgrade decisions.
- DAW audio monitoring decisions that require ears.

Group these confirmations when possible so remote operation does not become a
constant interruption.

## Official References

- Cakewalk Product Center:
  <https://help.cakewalk.com/hc/ja/articles/37259908610201-Cakewalk-Product-Centerを使用したCakewalk製品のインストールと更新>
- Cakewalk by BandLab sunset / Sonar migration:
  <https://help.cakewalk.com/hc/ja/articles/53866492346009-Cakewalk-by-BandLabはどうなりましたか-もう再アクティベートできないようです>
- Ableton Live 12 Lite:
  <https://help.ableton.com/hc/en-us/articles/360021524559-Live-12-Lite>
- Ableton Live 12 release notes:
  <https://www.ableton.com/en/release-notes/live-12/>
- Ableton update / point-release compatibility:
  <https://help.ableton.com/hc/en-us/articles/6003240646556-Updating-Live>
  <https://help.ableton.com/hc/en-us/articles/360000841004-Backward-Compatibility>
- Ableton Windows VST setup:
  <https://help.ableton.com/hc/en-us/articles/209071729-Using-VST-plug-ins-on-Windows>
