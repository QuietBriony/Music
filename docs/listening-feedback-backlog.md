# Listening Feedback Backlog

This is the working backlog for ear-led Music Stack improvements.
Use `listen.html` for the actual listening pass, then turn short feedback into
small implementation tasks.

## Operating Rule

- Keep `listen.html` separate from dashboards.
- `listen.html` is for listening, cues, and unresolved sound notes.
- OpenClaw / review queue is for tracking decisions and next actions.
- Short feedback is enough if it names the target and the audible problem.

Feedback shape:

```text
target: FM funk / 60 sec
heard: drums improved, melody still repeats
keep: clavi color, pocket
fix: reply phrases, rests, wider register
priority: high
```

## Current Reopened Notes

### Hazama FM

- Melody can still read as a short repeated fragment, even after the melodic
  director work.
- Rhythm and mode/key changes previously felt awkward or badly timed; phrase
  gating exists, but the ear check should stay open.
- Bass can still fall into root / fifth / octave loop behavior.
- `lofi`, `jazz`, and `funk` pocket timing has been improved; the next question
  is whether the music develops enough to stay interesting.
- `techno` should expose acid motion without bright EDM fatigue, constant hats,
  or limiter-crushed low end.
- `piano` should be a foreground object, not hidden metadata under the engine
  bed.
- `ambient` should remain safe air and not become generic dark pad wash.

### Band Room

- AI recreation can still feel thin or uneven compared with original stems.
- AI mode can read as "mostly drums" if bass / voice / chords do not carry
  enough body.
- Voice / melody can feel stuck or too synthetic if it shadows the same contour
  too often.
- Practice use should prioritize stable click / drums / bass before decorative
  polish.
- Car / Bluetooth volume and route behavior still needs real-device listening
  validation.

### Music Core Rig

- AUTO MIX should not keep increasing density until the piece loses space.
- Low-end pressure, bright transient build-up, and reference-like detail should
  be judged by ear, not only by runtime metadata.
- Reference spread should be audible as Music-specific behavior, not just docs
  or console state.

## Worker-Gaming Run Log

### 2026-06-01 - tabasco/human-fly recreation-cycle

Command:

`C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py recreation-cycle tabasco human-fly --with-analysis --with-drum-candidate`

Artifacts stay outside Git until human listening approves them:

- Report: `C:\workspace\music-stack-worker\reports\tabasco\human-fly\recreation-cycle-20260601-111702\recreation-cycle-report.md`
- AI recreation stems/mix: `C:\workspace\music-stack-worker\ai-recreation\tabasco\human-fly\`
- Drum candidate: `C:\workspace\music-stack-worker\reports\tabasco\human-fly\recreation-cycle-20260601-111702\drum-frames-tabasco-human-fly.candidate.json`

Findings to solve in the next Band Room pass:

- AI mix passed basic audio generation, but it is brighter than target
  (`3785 Hz` centroid vs `2402 Hz` target).
- AI mix has much wider dynamics than the source (`16.49 dB` vs `8.73 dB`),
  so it can read as less glued even before style judgement.
- Bass and other stems are quiet against drums (`-29.1 dB` and `-34.0 dB`
  RMS vs drums `-23.4 dB`), matching the "thin / mostly drums" note.
- Drum-frame candidate has source-derived events for 8 sections; promote it
  only after listening proves the extracted ghosts/crashes serve practice use.
- Ableton on worker-gaming still needs VST3 rescan for Kontakt. Sonar is the
  DAW path for this pass; EP-133 is visible, UR44 capture belongs on the Intel
  studio PC with Yamaha Steinberg ASIO.

## Implementation Translation

- "Melody is boring" -> add phrase-level call/answer, rests, register changes,
  and stronger contour variation before changing timbre.
- "Pocket feels wrong" -> inspect drum-frame microMs, governor amounts, and
  tempo handoff before changing volume.
- "AI recreation is not together" -> first balance drums / bass / voice /
  chords, then check section-aware arrangement.
- "Too loud or harsh" -> check output, bus gain, compression/limiter pressure,
  and high-frequency sources.
- "Good part exists" -> preserve that source or role before making broad sound
  changes.
