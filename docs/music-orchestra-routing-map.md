# Music Orchestra Routing Map

## Purpose

This map explains how a future Music session packet can be translated into
repo-specific intent without copying runtime code, audio, samples, lyrics, or
reference material.

## Music To drum-floor

`drum-floor` receives groove intent and turns it into drum grammar.

- `ucm_state.energy`, `resource`, and `body` map to groove density, pressure,
  kick/snare presence, and phrase lift.
- `reference_gradient.micro` and `ghost` map to ghost notes, short fills,
  micro-timing, and connective drum glue.
- `music_intent.rhythm` maps to section, swing, fill demand, dryness, and repeat
  behavior.
- Performance pad intent such as `repeat` or `punch` maps to articulation hints,
  but never forces live arm or overwrites a candidate.

Output from `drum-floor` should remain metadata or generated candidate files
under reviewed locations. Music should not import drum-floor runtime code
directly.

## Music To namima

`namima` receives safe ambient and mood intent.

- `reference_gradient.haze`, `chrome`, and `void` map to water, air, space,
  transparency, and brightness restraint.
- `ucm_state.circle` and `observer` map to calm continuity, slow mood changes,
  and low-surprise interaction.
- Energy should be capped for family-safe loudness and public-friendly use.
- `music_intent.space` and `gesture` map to ripple density, visual motion, and
  mood profile selection.

`namima` should store only coarse metadata such as mood, mode, and safe trace
summaries. It should not receive raw audio, raw pointer streams, or recordings.

## Music To OpenClaw / Umbrel

OpenClaw or an Umbrel-like runtime acts as the mission board and optimizer.

- Music session packet becomes a mission card with source repo, mode, reference
  gradient, UCM state, routing hints, and safety flags.
- Sidecar review result becomes a promotion request, not an automatic runtime
  edit.
- Approved promotion becomes a small repo-specific PR.
- Rejected or uncertain promotion remains a trace note.

OpenClaw may decide which repo should be asked next, but it must not start
browser audio, change OUTPUT, start REC, arm external gear, upload recordings,
or merge changes automatically.

## Harvest Sources

Archive and staging repos should contribute ideas as production parameters:

- `chill` macro controls map to simplified Music/namima controls such as touch,
  phrase, room, calmness, and quiet recovery.
- `chill` piano-like layer maps to soft memory/piano intent, not copied chords
  or sampled piano audio.
- `test` Style Blend maps to Music preset morph and reference gradient
  interpolation.
- `test` pattern probability blending maps to Music preset intent or
  drum-floor pattern probabilities.
- `namima-lab` ripple interaction maps to namima interaction density and
  water-motion intent.
- `namima-lab` PluckSynth texture maps to texture intent, not copied phrases.

## Review Loop

1. Music emits a metadata packet.
2. A sidecar or repo adapter proposes a translation.
3. OpenClaw/Umbrel records a mission and human review gate.
4. A human listens or inspects metadata.
5. Approved changes become small repo-specific PRs.
6. No runtime overwrite happens without explicit human approval.
