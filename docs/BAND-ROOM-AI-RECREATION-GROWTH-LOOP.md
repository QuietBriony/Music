# Band Room AI Recreation Growth Loop

## Purpose

Band Room AI 再現を「生成して終わり」ではなく、worker-gaming の GPU /
DAW / 音源 / 機材を使って、1曲ずつ育てるための反復手順。

音声、DAW project、plugin state、cycle report は repo 外に置く。Git に昇格するのは
聴いて確認した metadata、candidate JSON、docs、code だけ。

## Default Loop

Start with `tabasco/human-fly`:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py operator-run tabasco human-fly --open-dashboard --open-folder
```

This is the preferred worker-gaming entry point. It runs the safe doctors,
reuses existing AI recreation stems, creates the EP-133 transfer pack, writes
the Sonar/EP-133 handoff checklist, captures a setup snapshot, and writes one
aggregate operator report outside Git. Use `--force-recreation` only when the
AI stems should be regenerated.

Run only the recreation cycle when a fresh render/analysis pass is the point:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py recreation-cycle tabasco human-fly --with-analysis --with-drum-candidate
```

This writes:

```text
C:\workspace\music-stack-worker\
  ai-recreation\<band>\<song>\
    drums.mp3
    bass.mp3
    other.mp3
    mix.wav
    ai-recreation-report.json
  reports\<band>\<song>\recreation-cycle-YYYYMMDD-HHMMSS\
    target-spec.json
    drum-frames-<band>-<song>.candidate.json
    recreation-cycle-report.json
    recreation-cycle-report.md
  daw-export\<band>\<song>\
```

## Sonar Polish Pass

Use Sonar as the default DAW lane:

1. Import `drums.mp3`, `bass.mp3`, `other.mp3`, and `mix.wav` from the
   `ai-recreation` folder.
2. Keep the original `mix.wav` as a reference track.
3. Route each generated stem to its own track.
4. Apply light correction only; preserve a fair Band Room comparison.
5. Export revised stems or a rough `mix.wav` to `daw-export\<band>\<song>`.

Suggested roles:

- Drums: Sonar Drum Replacer / Session Drummer only where the source-derived kit
  feels thin; keep ghost notes and section dynamics.
- Bass: Cakewalk EQ/comp for low-end focus; avoid masking kick transients.
- Other: TH-U / Guitar Rig / L-Phase/T-Phase / Reaktor texture for guitar and
  presence color.
- Rough master: light limiter only; do not crush dynamics before Band Room
  comparison.

Ableton remains useful for clip/session experiments, but Sonar is the default
capture and polish lane until Ableton's VST scan is fixed.

## Hardware / Sound Design Lane

Use these only after the basic AI recreation cycle is passing:

- VCV Rack: modular loops, noisy transitions, odd percussion, filter movement.
- SuperCollider: glitch fills, drones, ambience, procedural percussion.
- EP-133 K.O.II: hand sampler / rhythm sketch box. Put source loops in
  `hardware-jam\ep133-inbox`, process by hand, and record captures back through
  Sonar/UR44 when the studio PC is ready.

Prepare a transfer pack without writing to the device:

```powershell
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py ep133-pack tabasco human-fly --include-ai-recreation --open-folder
```

Write the operator handoff checklist:

```powershell
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py sonar-ep133-handoff tabasco human-fly
```

Details: [EP133-KOII-BANDROOM-WORKFLOW.md](EP133-KOII-BANDROOM-WORKFLOW.md).

Run hardware checks after connecting devices:

```powershell
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-hardware
```

## Review And Promotion

Before any repo change:

1. Listen to the generated and DAW-polished outputs in Band Room.
2. Compare the cycle Markdown report against what you hear.
3. Promote only reviewed candidates:
   - drum-frame candidate JSON when it improves timing;
   - target-spec metadata when it helps calibration;
   - docs/code changes when the workflow itself improves.

Do not promote DAW sessions, plugin caches, raw generated audio, or local
snapshot reports unless a separate asset policy is explicitly approved.

## Current Known Gaps

- Ableton plugin DB still reports zero plugins; rescan VST3 from the PC screen.
- EP-133 is visible on worker-gaming over USB-C as MIDI / device media.
- UR44 is not currently visible on worker-gaming; connect it on the studio PC
  and rerun `check-hardware`.
- Final ear checks belong on the future Intel studio PC with UR44 and monitors.
