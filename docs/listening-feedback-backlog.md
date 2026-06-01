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
