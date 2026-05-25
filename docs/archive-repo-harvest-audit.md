# Archive Repo Harvest Audit

## 1. Purpose

`chill` / `test` / `namima-lab` are not primary Music runtimes.

They remain useful as harvest sources when their ideas are translated into the
right target repo without copying runtime code, audio, samples, motifs, or
dependencies.

This audit is a review shelf. It does not authorize implementation, archive
actions, repo revival, dependency additions, or cross-repo merges.

## 2. Harvest rules

Allowed to harvest:

- design pattern
- production intent
- interaction model
- safety / recovery habit
- schema or packet shape
- review checklist
- human-gated promotion pattern

Do not harvest by default:

- audio files
- samples or sample URLs
- lyrics
- copied melodies, motifs, arrangements, or recordings
- direct runtime code
- dependency additions
- GitHub Actions
- archive/delete/settings actions

## 3. chill harvest

### Current observation

- `chill` is no longer a primary runtime.
- It now has a browser-only regrowth candidate for listening-first quiet piano
  radio and quiet piano trio.
- The current identity is synthetic felt-like piano, long rests, warm jazz
  voicing, optional loose hip-hop pulse, and small mutation.
- The main controls are `Touch`, `Phrase`, and `Room`.
- `AUTO` is a deterministic Flow Director for settle / breathe / lift /
  decrescendo / recover.
- `PULSE`, `BASS`, and `DRUMS` are optional support layers, not the main
  identity.
- `chill/session.html` can receive Music SYNC metadata, but it does not start
  audio until human `START`.
- `window.chillTrioSession.snapshot()` and diagnostics are read-only review
  surfaces.

### Harvest

- quiet piano / trio listening shape
- long-form background listening posture
- deterministic preview mindset
- quiet recovery rules
- Touch / Phrase / Room as simplified expressive macro controls
- Flow Director as low-drama phrase pressure control
- local listening score habit
- optional drum-floor soft pocket as a manually-started trio support

### Do not harvest

- sample-based piano
- copied artist phrases, songs, grooves, or motifs
- PULSE as the main identity
- BASS as a lead instrument
- automatic drum-floor arming or Tone transport takeover
- direct chill runtime code into Music

### Music translation

- `Music` may use chill as a reference for a future quiet piano / memory /
  soft-focus mode.
- If adopted, the piano idea should be recreated as production parameters or
  synth/pluck behavior, not copied audio or sampled phrases.
- Flow Director can inform long-form radio pacing, decrescendo, and recovery.

### namima translation

- `namima` may borrow listening-safe pacing, quiet recovery, and simple controls.
- Keep chill's piano/lofi/trio identity in chill unless a separate human review
  chooses a named Music or namima mode.

## 4. test harvest

### Current observation

- `test` is no longer an active music runtime.
- It is an archive candidate unless a clear active purpose is intentionally
  defined later.
- It should not receive audio files, samples, dependencies, GitHub Actions, or
  primary runtime work.

### Harvest

- style blend idea
- archetype interpolation
- probability / pattern interpolation idea
- style label and BPM label thinking
- transition vocabulary across ambient / lofi / harder energy states

### Do not harvest

- sample references
- hard techno defaults as Music baseline
- direct runtime copy
- new assets or dependencies

### Music translation

- style blend can inform preset morph or reference-gradient translation.
- test remains archive candidate after useful ideas are captured.

### drum-floor translation

- probability interpolation can inform future groove grammar planning, only
  through docs/schema/review first.

### Translation status (2026-05-25 BL-019b)

- `test/engine.js` style archetypes are now translated for Music review in
  `references/style-archetype-from-test.json`.
- The Music-facing interpretation is documented in
  `docs/test-style-archetype-translation.md`.
- This translation adopts Ambient and Lo-Fi as concepts, defers Goa, and keeps
  HardTechno as a rejected public baseline / reference-only boundary.
- The 16-step probability interpolation remains deferred to drum-floor BL-019c.
- No runtime code, samples, UI fader, dependency, or engine wiring is adopted by
  this translation.

## 5. namima-lab harvest

### Current observation

- `namima-lab` is no longer the primary active music runtime.
- It is a possible staging/lab area for `namima`, or an archive candidate after
  useful ideas are harvested.
- Its README says not to use it for main Music runtime development, dark IDM /
  glitch experiments, band groove generation, audio/sample storage,
  dependency-heavy experiments, or GitHub Actions.

### Harvest

- safe ambient interaction lineage
- touch / ripple / gentle gesture ideas
- organic pluck / acoustic illusion as a texture idea
- iOS-safe start posture
- lightweight reference notes for namima-safe ambient experiments

### Do not harvest

- direct p5 dependency
- uncontrolled visual runtime
- direct Music runtime code
- dark IDM / glitch behavior
- audio files or samples
- dependency-heavy experiments
- GitHub Actions

### Music translation

- organic pluck and gesture-to-note ideas may inform future Music performance
  pad or texture design only after human review.
- `namima-lab` should not be merged into Music directly.

### namima translation

- `namima` is the preferred target for safe ripple / water / gentle touch
  interaction ideas.
- Any import must be translated into namima's public-friendly ambient structure.

## 6. Priority

High:

- chill quiet piano / trio identity -> current decision memo plus future named
  Music mode taste review
- namima-lab safe ripple lineage -> current safe ripple lineage decision memo
  plus future namima interaction review
- test style blend -> current preset morph / reference-gradient decision memo
  plus future visible-control taste review

Medium:

- chill Flow Director -> Music radio pacing / recovery review
- chill listening score -> Music review workflow
- test probability interpolation -> drum-floor docs/schema review
- namima-lab organic pluck -> Music texture review

Low / do not copy:

- sample-based instruments
- external sample URLs
- direct visual dependency migration
- hard techno defaults as baseline
- copied runtime code

## 7. Archive / staging rule

- `chill` can remain harvest-only / possible light surface.
- `test` can remain archive candidate after useful ideas are captured.
- `namima-lab` can remain staging / harvest-only for namima-safe lineage.
- Archive means not primary runtime, not no value.
- Changing a repo from harvest-only or archive candidate to active runtime needs
  separate human approval.

## 8. Next suggested docs tasks

- Music: use `docs/chill-quiet-piano-trio-decision.md` as the current quiet
  piano / trio boundary before any named Music mode review.
- Music: use `docs/test-style-blend-preset-morph-decision.md` as the current
  Style Blend boundary before any runtime preset morph work.
- Music: use `docs/namima-lab-safe-ripple-lineage-decision.md` as the current
  safe ripple lineage boundary before any namima-lab revival or Music
  gesture-to-texture work.
- drum-floor: keep probability and groove ideas in docs/schema/review before
  generator work.
