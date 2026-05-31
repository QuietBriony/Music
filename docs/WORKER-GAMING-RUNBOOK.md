# Worker Gaming Runbook

## Purpose

`worker-gaming` is the heavy audio batch machine for music-stack. It should
generate and analyze material, then hand reviewable outputs back to Music,
drum-floor, chill, namima, or openclaw as metadata, JSON candidates, or local
preview stems.

Do not use it as the primary runtime editor for `engine.js`, Band Room UI, or
live DAW/device control.

## Current Machine Snapshot

Observed on 2026-05-31:

- GPU: NVIDIA GeForce RTX 2070 plus Intel UHD Graphics 630
- CLI tools: Python 3.12.10, Node 24.16.0, ffmpeg 8.1.1
- Installed apps: Ableton Live 12 Lite 12.3.2 plus legacy Live 10 Lite,
  Native Access 1.14.1, Kontakt 6.8.0, Maschine 2.16.1, Reaktor 6.4.3,
  Guitar Rig 6.3.0, VCV Rack 2 Free 2.6.6 plus Rack 1.1.6,
  SuperCollider 3.9.3, Atom 1.59.0
- Worker venv: `C:\workspace\music-stack-worker\.venv`
- Verified venv packages: PyTorch 2.11.0+cu128, torchaudio, Demucs, librosa,
  soundfile, imageio-ffmpeg, scipy, numpy
- Verified GPU access: `torch.cuda.is_available()` is `True`; device is
  `NVIDIA GeForce RTX 2070`
- Global Python may still have CPU-only `torch`; run worker jobs through the
  venv Python.
- Latest setup report: [WORKER-GAMING-ENV-SETUP-2026-05-31.md](WORKER-GAMING-ENV-SETUP-2026-05-31.md)

Run the local doctor:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-env
```

## Output Layout

Default output root:

```text
C:\workspace\music-stack-worker\
  inbox\
  stems\
  ai-recreation\
  reports\
  daw-export\
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

Analyze target specs without rewriting tracked docs:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py analyze tabasco/human-fly
```

Generate review-only drum-frame candidates without overwriting runtime JSON:

```powershell
python -X utf8 scripts/worker-gaming-pipeline.py extract-drum-candidate tabasco human-fly
```

## Ableton / BandLab / Native Instruments

Use DAWs and Native Instruments as render and polish tools:

- Import stems from `C:\workspace\music-stack-worker\stems\...`.
- Add Kontakt, Maschine, Reaktor, Guitar Rig, or Ableton effects.
- Bounce processed `drums.wav`, `bass.wav`, `other.wav`, or `mix.wav` to
  `C:\workspace\music-stack-worker\daw-export\...`.
- Test in Band Room via external stems before proposing any repo change.

Do not add Ableton project files, Kontakt libraries, generated audio, or plugin
state dumps to the repo unless the user explicitly approves a separate asset
policy.

Current Ableton handoff baseline:

- Use Ableton Live 12 Lite as the primary DAW lane.
- If Live asks to restore `codex1.als`, move recovery files aside instead of
  restoring them; the latest bypass backup is under
  `C:\workspace\music-stack-worker\logs\ableton-recovery-bypass-20260531-2013`.
- Scan VST3 from `C:\Program Files\Common Files\VST3`.
- Scan NI VST2 from `C:\Program Files\Native Instruments\VSTPlugins 64 bit`
  only when a specific legacy plugin requires it.
- NI plugins are installed, but Ableton's plugin database still needs a manual
  Preferences rescan when the Preferences UI renders normally.
- Keep Cakewalk by BandLab installed for legacy project compatibility, but do
  not make it the main worker path; update attempts currently require a GUI
  installer confirmation.

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
