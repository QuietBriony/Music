# Worker Gaming Runbook

## Purpose

`worker-gaming` is the heavy audio batch machine for music-stack. It should
generate and analyze material, then hand reviewable outputs back to Music,
drum-floor, chill, namima, or openclaw as metadata, JSON candidates, or local
preview stems.

Do not use it as the primary runtime editor for `engine.js`, Band Room UI, or
live DAW/device control.

## Current Machine Snapshot

Observed on 2026-05-31 and updated on 2026-06-01:

- GPU: NVIDIA GeForce RTX 2070 plus Intel UHD Graphics 630
- CLI tools: Python 3.12.10, Node 24.16.0, ffmpeg 8.1.1
- Installed apps: Ableton Live 12 Lite 12.3.2 plus legacy Live 10 Lite,
  Cakewalk Product Center 1.1.0.004, Cakewalk Sonar 32.04.0.078,
  Cakewalk by BandLab 29.09.0.125 as a deprecated fallback,
  Native Access 1.14.1, Kontakt 6.8.0, Kontakt 7 Player 7.6.1,
  Maschine 2.16.1, Reaktor 6.4.3, Guitar Rig 6.3.0,
  VCV Rack 2 Free 2.6.6 plus Rack 1.1.6, SuperCollider 3.9.3,
  Atom 1.59.0
- Installed Cakewalk add-ons: Core Plugins, Studio Instruments Suite, Sonar
  Drum Replacer, Session Drummer 3, TH-U, Help & Documentation, Precision
  Suite, ProChannel Modules, and L-Phase/T-Phase plugin content
- Removed app: BandLab Assistant; Product Center is now the Cakewalk manager
- Worker venv: `C:\workspace\music-stack-worker\.venv`
- Verified venv packages: PyTorch 2.11.0+cu128, torchaudio, Demucs, librosa,
  soundfile, imageio-ffmpeg, scipy, numpy
- Verified GPU access: `torch.cuda.is_available()` is `True`; device is
  `NVIDIA GeForce RTX 2070`
- Global Python may still have CPU-only `torch`; run worker jobs through the
  venv Python.
- Latest setup report: [WORKER-GAMING-ENV-SETUP-2026-05-31.md](WORKER-GAMING-ENV-SETUP-2026-05-31.md)
- Studio/worker DAW parity plan:
  [MUSIC-PC-DAW-PARITY-RUNBOOK.md](MUSIC-PC-DAW-PARITY-RUNBOOK.md)

Run the local doctor:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-env
```

Run the DAW / Native Instruments doctor:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-daw
```

Write a reproducible setup snapshot outside Git:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py snapshot-setup --tag worker-gaming
```

This writes JSON and Markdown under
`C:\workspace\music-stack-worker\reports\...setup-snapshot...`. Use the latest
snapshot as the reference when rebuilding the same stack on the studio PC.

Run the full safe operator loop when the goal is Band Room AI -> Sonar/EP-133
handoff -> local checklist:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py operator-run tabasco human-fly --open-dashboard --open-folder
```

`operator-run` chains the safe checks and handoff generators, then writes one
aggregate report under
`C:\workspace\music-stack-worker\reports\<band>\<song>\operator-run-...`. It
also installs/verifies the MIDI CLI tools and sends only the read-only EP-133
device-info SysEx probe. It does not write to EP-133, change Sonar/Ableton
projects, alter Band Room defaults, send sample/project-write MIDI, or record
audio. Use `--no-midi-probe` when EP-133 is not connected.

## Output Layout

Default output root:

```text
C:\workspace\music-stack-worker\
  inbox\
  stems\
  ai-recreation\
  reports\
  daw-export\
  hardware-jam\
    ep133-inbox\
    captures\
  logs\
  tmp\
```

Override with:

```powershell
$env:MUSIC_STACK_WORKER_ROOT = "D:\music-stack-worker"
```

Repo-local `worker-output/` and `presets/drum-frame-candidates/` are ignored
fallbacks, but the preferred path is the repo-external worker root above.

## Setup

1. Create directories:

   ```powershell
   python -X utf8 scripts/worker-gaming-pipeline.py init
   ```

2. Install GPU Python packages in a venv, not the global Python:

   ```powershell
   python -m venv C:\workspace\music-stack-worker\.venv
   C:\workspace\music-stack-worker\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   ```

3. Use the official PyTorch selector for the current Windows CUDA pip command:
   <https://pytorch.org/get-started/locally/>. Verify before running heavy jobs:

   ```powershell
   python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
   ```

4. Install worker audio packages. For Demucs details, use the upstream project:
   <https://github.com/facebookresearch/demucs>.

   ```powershell
   python -m pip install demucs librosa soundfile imageio-ffmpeg scipy numpy
   ```

5. Confirm:

   ```powershell
   python -X utf8 scripts/worker-gaming-pipeline.py check-env
   node scripts/stack-check.mjs
   ```

## Standard Jobs

Recommended daily entry point:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py operator-run tabasco human-fly --open-dashboard --open-folder
```

Use `--dry-run` to preview the same sequence without executing commands or
writing a report. Use `--force-recreation` only when a fresh AI render is
intended; existing AI recreation stems are reused by default.

Split a folder of source tracks into 4 stems outside the repo:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py separate `
  --band new-band `
  --source "C:\workspace\music-stack-worker\inbox\new-band"
```

Render one Band Room AI recreation outside the repo:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py ai-render tabasco human-fly
```

Render a whole registered band:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py batch-ai-render --band tabasco --keep-going
```

Run one Band Room AI recreation growth cycle:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py recreation-cycle tabasco human-fly --with-analysis --with-drum-candidate
```

Use the cycle report under `C:\workspace\music-stack-worker\reports\...` as the
handoff into Sonar polish and Band Room review. Details:
[BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md](BAND-ROOM-AI-RECREATION-GROWTH-LOOP.md).

Prepare the MIDI CLI lane and confirm EP-133 read-only SysEx before transfer:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py setup-midi-cli
python -X utf8 scripts/worker-gaming-pipeline.py ep133-sysex-probe
```

`setup-midi-cli` installs fixed SendMIDI / ReceiveMIDI builds under the
repo-external worker tool cache with SHA256 checks. `ep133-sysex-probe` sends
only the EP-133 device-info SysEx request and writes a local report under
`C:\workspace\music-stack-worker\reports\ep133-sysex-probe-...`. It confirms
the MIDI/SysEx lane without transferring samples, deleting sounds, or changing
projects.

Prepare a non-destructive EP-133 transfer pack:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py ep133-pack tabasco human-fly --include-ai-recreation --open-folder
python -X utf8 scripts/worker-gaming-pipeline.py ep133-first-pass tabasco human-fly --open-folder
```

This writes WAV files, a manifest, and a suggested pad map under
`C:\workspace\music-stack-worker\hardware-jam\ep133-inbox\...`. It does not
write to EP-133. `ep133-first-pass` stages only B01-B04 loops in a smaller
folder for the first physical transfer. Use the EP sample tool and the
[EP133-KOII-BANDROOM-WORKFLOW.md](EP133-KOII-BANDROOM-WORKFLOW.md) manual for
the transfer step.

Write the Sonar / EP-133 / Band Room operator checklist:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py sonar-ep133-handoff tabasco human-fly
```

This creates a Markdown and JSON report under
`C:\workspace\music-stack-worker\reports\<band>\<song>\sonar-ep133-handoff-...`.
It is a non-destructive checklist: no MIDI send, no EP-133 write, no DAW project
write, and no Band Room default change.

Analyze target specs without rewriting tracked docs:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py analyze tabasco/human-fly
```

Generate review-only drum-frame candidates without overwriting runtime JSON:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py extract-drum-candidate tabasco human-fly
```

## Ableton / Cakewalk / BandLab / Native Instruments

Use DAWs and Native Instruments as render and polish tools:

- Import stems from `C:\workspace\music-stack-worker\stems\...`.
- Add Kontakt, Maschine, Reaktor, Guitar Rig, Ableton effects, or Sonar /
  Cakewalk effects.
- Bounce processed `drums.wav`, `bass.wav`, `other.wav`, or `mix.wav` to
  `C:\workspace\music-stack-worker\daw-export\...`.
- Test in Band Room via external stems before proposing any repo change.

Do not add Ableton/Sonar project files, Kontakt libraries, generated audio, or
plugin state dumps to the repo unless the user explicitly approves a separate
asset policy.

Current Ableton handoff baseline:

- Use Ableton Live 12 Lite and Cakewalk Sonar as the primary DAW lanes.
- If Live asks to restore `codex1.als`, move recovery files aside instead of
  restoring them; the latest bypass backup is under
  `C:\workspace\music-stack-worker\logs\ableton-recovery-bypass-20260531-2013`.
- Scan VST3 from `C:\Program Files\Common Files\VST3`.
- Scan NI VST2 from `C:\Program Files\Native Instruments\VSTPlugins 64 bit`
  only when a specific legacy plugin requires it.
- Kontakt 7 Player `7.6.1` is installed and `Kontakt 7.vst3` is present in
  `C:\Program Files\Common Files\VST3`.
- `Options.txt` contains `-DisableGraphicsHardwareAcceleration` to reduce the
  chance of a blank Preferences window.
- NI plugins are installed, but Ableton's plugin database still reported
  `Plugin modules: 0` / `Plugins: 0` on 2026-05-31. Run `check-daw`; if it
  still reports zero plugins, use the PC screen to open Preferences > Plug-Ins,
  turn VST3 System Folders on, and rescan.
- Cakewalk Sonar `32.04.0.078` / `2026.04` is installed through Product
  Center and is the current Cakewalk lane.
- Product Center add-ons are available for the Sonar lane: Core Plugins, Studio
  Instruments Suite, Sonar Drum Replacer, Session Drummer 3, TH-U, Help &
  Documentation, Precision Suite, ProChannel Modules, and L-Phase/T-Phase
  plugin content.
- BandLab Assistant has been removed; use Product Center for Cakewalk updates.
- Keep Cakewalk by BandLab `29.09.0.125` only as a deprecated fallback until
  shared Cakewalk components are reviewed.

## VCV Rack / SuperCollider

Treat VCV Rack and SuperCollider as external sound design tools:

- VCV Rack: modular processing for stems, drum-floor groove ideas, or texture
  renders.
- SuperCollider: short percussion, glitch, drone, and ambience experiments.
- Export audio to the worker root, then review in Band Room or a DAW.

Current app baseline:

- VCV Rack 2 Free 2.6.6 starts and reports its version from CLI.
- VCV Rack 1.1.6 remains installed only for old patch compatibility.
- SuperCollider 3.9.3 `sclang` starts; 3.14.1 update currently needs manual
  installer confirmation.
- Atom is kept as a legacy editor only; prefer VS Code or repo-native tooling
  for new work.

No automatic browser playback, MIDI send, Ableton arm, EP-133 operation, upload,
or cross-repo merge is part of worker-gaming.

## Promotion Rules

- Audio outputs stay outside Git unless a separate human review approves them.
- Drum-frame extraction defaults to candidate JSON when run through
  `worker-gaming-pipeline.py`.
- `docs/target-spec-bands.json` can still be updated intentionally by running
  `scripts/analyze-band-stems.py` without `--out`; worker jobs should pass
  `--out`.
- `drum-floor` receives groove metadata/candidates only.
- `namima` receives safe mood metadata only.
- `chill` receives quiet piano/trio references only.
- `openclaw` tracks review cards and next actions; it does not execute arm,
  record, upload, merge, or DAW actions automatically.
