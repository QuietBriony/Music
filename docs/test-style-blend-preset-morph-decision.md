# Test Style Blend / Preset Morph Decision

## 1. Purpose

This memo records the current Music-side decision for harvesting the `test`
repo's Style Blend and interpolation ideas.

It answers the recurring docs question: can `test` inform Music preset morph or
reference-gradient behavior, and if so, what is safe to carry forward?

This is a docs-only decision memo. It does not authorize runtime changes,
AudioEngine adapter work, audio asset movement, sample import, dependency
additions, schema changes, repo revival, or archive/delete action.

## 2. Current decision

Keep `test` as an archive candidate / harvest-only source.

Music may harvest the Style Blend idea only as abstract production-axis
metadata. The idea should be translated into Music's existing reference morph
language, not copied as a runtime, sample set, or direct user-facing fader.

The current integration posture is:

- `test` remains a source of ideas for style blend, archetype interpolation,
  probability / pattern interpolation, and transition vocabulary.
- `Music` may translate those ideas into preset morph notes, reference-gradient
  language, review traces, or future metadata-only examples.
- `Music` should not adopt `test` hard techno defaults as a baseline.
- `Music` should not copy `test` runtime code, sample references, dependencies,
  UI, or direct updateStyle behavior.
- `drum-floor` may later review probability interpolation as groove grammar
  planning, but only through docs/schema/review first.

## 3. Music translation

The safe Music translation is production-axis blending:

- `haze`: ambient / space / field-murk pressure
- `broken`: micro-edit, scar, unstable texture, local wrongness
- `pulse`: movement and pressure without making hard techno the default floor
- `void`: restraint, silence debt, air, and negative space
- `chrome`: transparent grain, glass, voice dust, cool brightness
- `organic`: memory pluck, reed, body, hand-made imperfection

`test` Style Blend can inspire how these axes move together. It should not
become a literal "ambient to hard techno" slider in Music without separate
human review.

## 4. Evidence basis

Current local docs already point to this split:

- `docs/archive-repo-harvest-audit.md` keeps `test` as archive candidate and
  names style blend, archetype interpolation, and probability interpolation as
  harvest ideas.
- `docs/repo-harvest-orchestra-workflow.md` maps `test` Style Blend to Music
  preset morph, reference-gradient translation, and genre timbre matrix, while
  keeping runtime copy out of bounds.
- `docs/music-orchestra-routing-map.md` maps `test` Style Blend to Music preset
  morph and reference-gradient interpolation.
- `docs/rdj-growth-reference-morph.md` already says `ReferenceMorphState`
  translates the one-fader Style Blend idea into Music's internal colors rather
  than copying it directly.
- `docs/examples/repo-harvest-sidecars/test.sidecar.json` marks `test` as
  metadata-only, human-reviewed, no direct code copy, no audio import, no sample
  import, and no dependency import.

## 5. Allowed next docs work

- Link this memo from top-level Music Stack docs.
- Keep `test` sidecar examples metadata-only.
- Document preset morph as review language, not runtime behavior.
- Add future packet or trace examples only if they store production intent and
  safety flags, not audio or samples.
- Keep probability interpolation in a drum-floor docs/schema queue until a
  separate human-approved groove task exists.

## 6. Not allowed by this memo

- copying `test` runtime code into Music
- copying `test` samples, sample URLs, melodies, motifs, arrangements, or
  recordings
- adding dependencies from `test`
- reviving `test` as a primary runtime
- making hard techno the Music default baseline
- adding a user-facing Style Blend control
- changing AudioEngine contracts
- changing `engine.js`, `index.html`, `style.css`, schema files, presets, or
  package files
- changing archive/delete status

## 7. Future review question

The following decision is still outside local docs evidence and needs
ChatGPT / Claude abstraction review plus human taste review:

```text
Should Music expose Style Blend / preset morph as a visible performance control,
or should it remain a hidden conductor/reference-gradient behavior that shapes
production intent behind the scenes?

Please consider Music's public identity, whether a visible blend control would
make the system too generic, how much club pressure should enter the default
sound, and whether the listener should experience style morphing as a knob or
as a subtle composition behavior.
```

## 8. Review posture

Current status: accepted as a docs-only local decision candidate.

Promotion gates remain:

- human approval before editing `test`
- human approval before using `test` beyond metadata harvest
- human approval before adding preset morph runtime behavior
- human approval before adding a visible Style Blend control
- human approval before adding assets, samples, dependencies, or presets
- human approval before publishing, pushing, merging, or opening release work
