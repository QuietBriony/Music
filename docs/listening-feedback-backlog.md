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

### 2026-08-11 HAZAMA v397-v401 01/02 current pass

- v397 added the 01 original 4-stem reference; v398 added the 02 Hard original
  lane. Each song is 128 BPM / A minor / 360 seconds and about 32.96 MiB.
- The approved Chrome pass reached loaded/playing state for both originals.
  Before v399, START in 01 and 02 AI recreation made the renderer unresponsive.
- v399 makes HAZAMA's dense arp+bassline AI band use the layer-only light safety
  tier, with checked-in local drum one-shots and no saved/CDN drum override on
  START, while leaving the shared master and original-stem graph unchanged.
- Surface / interface-speaker human pass: 01原音・01AI・02原音はSTARTでき、AIの
  ピーポー再発と途切れはなし。画面ロック解除後は同じBand Roomへ正常復帰し、
  HAZAMAからTabascoへの原音/palette復帰も通過した。02 AIも出音は確認したが、
  START表示の個別記録はなく、暫定境界は見落とされた。
- Musical verdict is AMBER: both AI cases read as over-programmed electronic MIDI,
  with too many packed short notes. Keep both originals as references; 01の日本語箇所は
  再考、02は英語の雰囲気と電子音のきれいさをkeepし、人間らしい初動と間を磨く。
- Surfaceはdesktop-class lifecycle evidenceであり、iPhone Safari / installed PWA等の
  real-mobile stability gateは閉じない。HAZAMA remains `ui_hidden:true`.
- v400 makes the non-track-specific 02 AI warning prominent, fixes 02 inheriting 01 lyrics,
  and exposes session-only 01/02 original-stem KARAOKE routes. No new audio asset is added.
- v401 is the response to the Surface musical verdict: active arp + bassline drops from
  27/32 to a 20–21-hit authored baseline per bar, every lane ends on a rest, and gates
  rise from roughly 59–82 ms to 96–101 ms. Arp runtime may not refill or move those
  rests; bass ghost / phrase-tail drops may only subtract from the baseline. 01/02 share
  the musical frame data, but their song-ID seeds can produce small velocity, jitter, and
  bass-drop differences. The envelope and original stems remain unchanged; this is a
  candidate, not a human listening pass.
- Run the four short cases first (01 original / 01 AI / 02 original / 02 AI), then the
  v401 layer isolation below and a roughly six-minute arc only where useful.
- Re-listen to 01 AI and provisional 02 AI for 30–90 seconds per layer: `drums + bass`,
  `drums + arp`, `drums + bass + arp` with vocal OFF, then `defaults`. Record which
  layer creates or removes short-note packing. Continue to a roughly six-minute arc
  only after the short pass is stable.
- 02 AI is provisional: it shares 01 frames and is not a 02-specific AI
  arrangement. The 02 original remains the reference for Hard-route decisions.
- Local Chrome recheck on `br-234` passed short START/STOP responsiveness for
  01 AI and provisional 02 AI; 02 original reached `stems loaded (4/4)`. The
  earlier 01 original pass also reached 4/4, and the subsequent fix did not
  touch the original-stem graph. Cold local one-shot decode was slow under the
  already-loaded audit profile, but completed instead of freezing the renderer.
- Human listening remains behind BL-041 for v401 AI musical quality, real-mobile stability and
  main-selector promotion. Static/browser responsiveness checks do not promote it.

### Historical: 2026-08-02 HAZAMA v388/v390 pass

- Agent gates confirm the v388 structure keeps all 16 arp / bass steps in
  phone-light mode and pays the budget with one oscillator per trigger instead
  of recreating the two-tone siren ("ピーポー") regression.
- Agent gates confirm the v390 `?band=hazama` entry is synth-only, selects
  `AI 再現` automatically, and fails closed when START preparation cannot finish.
- Human listening remains open: run 60–90 seconds on normal and `?aiLight=1`,
  then continue through the roughly six-minute intro / arp / drive / verse /
  lift / mantra / break / release / outro arc. Report siren recurrence,
  monotony, dropout, or weight separately.
- Keep HAZAMA hidden from the normal band selector until BL-041 passes on
  desktop and mobile. The Listen route is a review entrance, not promotion.
- After listening, use `lyric-lab.html` to retain the words, keep/fix decision,
  and production handoff. This route does not execute ACE-Step or download a
  model.

### Historical — 2026-06-01 phone notes

- `FM funk`: sounded packed/crushed. v299 pass should be checked for more
  headroom, less sub buildup, and less tape/limiter flattening.
- `Band Room AI`: playback can solidify over time. v299 pass throttles UI
  telemetry and adds foreground AI scheduler stall recovery; needs a real
  phone/PWA listen to confirm.

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

## Historical Worker-Gaming Run Log

### 2026-06-01 - tabasco/human-fly v301 recreation-cycle

Command:

`C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py --worker-root C:\workspace\music-stack-worker recreation-cycle tabasco human-fly --with-analysis --with-drum-candidate --force`

Artifacts stay outside Git until human listening approves them:

- Report: `C:\workspace\music-stack-worker\reports\tabasco\human-fly\recreation-cycle-20260601-132113\recreation-cycle-report.md`
- AI recreation stems/mix: `C:\workspace\music-stack-worker\ai-recreation\tabasco\human-fly\`
- Drum candidate: `C:\workspace\music-stack-worker\reports\tabasco\human-fly\recreation-cycle-20260601-132113\drum-frames-tabasco-human-fly.candidate.json`

Measurement result:

- `pass_basic_audio_check: true`.
- `mix.wav`: duration `239.491s`, peak `0.85065`, centroid `3044.9 Hz`, DR `11.79 dB`.
- This clears the v301 numeric gates: centroid moved down from `3785.0 Hz`
  to under `3200 Hz`, and DR moved from `16.49 dB` into the `8-13 dB`
  target window.
- Bass is no longer buried against drums (`bass` RMS `0.05703` vs `drums`
  `0.05595`). `other` is still quieter (`0.04197`) but now has a stronger
  body bed for A/B listening.

Next ear check:

- Human Fly AI should sound less bright and less like drums-only.
- Confirm the new glue does not make intro/break sections feel flat.
- Confirm `other` is present as guitar/chord body, not only pad wash.
- Keep the drum-frame candidate review-only until the groove is approved by ear.

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
