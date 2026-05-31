# Music PC DAW Parity Runbook

## Purpose

`worker-gaming` で作った music-stack 音楽制作環境を、あとから
`studio-surface` / studio PC に再現できるようにする標準構成表。

repo は source of truth、DAW は repo 外の render / polish / recording
環境として扱う。DAW project、plugin cache、生成 audio は Git に入れない。

## Machine Roles

| PC | Role | Main jobs | Avoid |
|---|---|---|---|
| `chouta-surface` | command / repo editor | docs、軽い repo 編集、PR 確認、remote 操作 | UR44 主機、重い stem 分離、DAW 主機 |
| `worker-gaming` | GPU worker / render bench | Demucs、Band Room AI recreation、Sonar/Ableton/NI render、VCV/SuperCollider texture | ear-critical final listen、runtime UI の直接編集 |
| `studio-surface` / studio PC | listen / record / DAW reference | UR44、monitor/headphone、Sonar/Ableton stem polish、録音、最終試聴 | 長時間 GPU batch、ARM Surface での UR44 運用 |

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

DAW:

- Cakewalk Product Center.
- Cakewalk Sonar.
- Product Center add-ons: Core Plugins, Studio Instruments Suite, Sonar Drum
  Replacer, Session Drummer 3, TH-U, Help & Documentation, Precision Suite,
  ProChannel Modules, L-Phase/T-Phase plugin content.
- Ableton Live 12 Lite.

Instruments / effects:

- Native Access.
- Kontakt 7 Player.
- Kontakt 6 / Kontakt legacy plugins only when an old project needs them.
- Guitar Rig, Reaktor, Maschine where licenses already exist.

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
is the loop/live/sync lane. The current blocker for Ableton is plugin scan, not
strategic value.

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

## Rebuild Checklist

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

7. Install Native Access content that is already licensed. Prioritize Kontakt 7
   Player and installed libraries. Avoid paid major upgrades unless explicitly
   approved.

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
- Ableton Windows VST setup:
  <https://help.ableton.com/hc/en-us/articles/209071729-Using-VST-plug-ins-on-Windows>
