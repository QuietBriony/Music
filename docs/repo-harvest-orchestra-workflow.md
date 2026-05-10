# Repo Harvest Orchestra Workflow

## 1. Purpose

This workflow defines how the Music Stack harvests ideas from internal
archive/staging repos and external references without importing unsafe assets or
flattening every repo into one runtime.

The source repo is a harvest source, not a replacement target. The preferred
flow is:

1. Discover and inspect.
2. Record a review-only sidecar or harvest note.
3. Translate the useful idea into production intent.
4. Route it to the correct repo.
5. Promote it only through human-gated, small PRs.

This complements:

- `docs/music-orchestra-protocol.md`
- `docs/music-stack-sync-manual.md`
- `docs/archive-repo-harvest-audit.md`
- `docs/integration-catalog.md`

## 2. Current repo roles

- `Music`: active conductor and central integration target. It owns
  reference-driven production intent, UCM faders, Hazama FM, Music Core Rig,
  session packets, and final experimental runtime decisions.
- `drum-floor`: active rhythm / groove / VCV / stage-safety reference. It owns
  groove grammar, pocket frames, human-gated promotion, browser drum preview,
  raw candidate boundaries, and Music SYNC receiver behavior.
- `namima`: active public-friendly ambient player. It owns safe mood
  translation, water/garden/daytime ambient behavior, user-gesture start, and
  metadata-only Music SYNC translation.
- `chill`: quiet piano / trio / long-form listening light surface and harvest
  source. It is useful for synthetic felt-like piano, long rests, Flow Director,
  Touch / Phrase / Room controls, quiet recovery, deterministic preview, and
  local listening score habits.
- `namima-lab`: lineage / staging / harvest-only source. It is useful for
  safe ripple lineage, gentle touch ideas, organic pluck texture, iOS-safe start
  posture, and lightweight reference notes.
- `test`: archive candidate / harvest-only source. It is useful for style
  blend, archetype interpolation, probability interpolation, and transition
  vocabulary.
- `hazama`: world / game / story / visual reference-only. It may inform
  atmosphere, navigation, liminal world feel, and non-music operations language,
  but it is not a runtime import source.
- `OpenClaw` / Umbrel-like surfaces: mission board, review queue, promotion
  plane, optimizer, and human-gated control plane. They coordinate sidecars and
  PRs; they do not become the audio engine.

## 3. External search categories

External repo searches should be classified before any implementation is
considered:

- WebAudio / Tone.js / browser synths
- generative music
- live coding and pattern languages
- drum sequencers and groove systems
- ambient or audiovisual interaction
- ML music generation
- MIDI timing and sequencer tools
- instrument UI surfaces
- shader, particle, and interaction art

Classification does not imply adoption. It only helps choose the correct
translation target and risk level.

## 4. Candidate evaluation checklist

For each candidate, record:

- license present and compatible enough for review?
- recently maintained, stale, or unknown?
- demo available?
- dependency weight?
- audio files or sample references present?
- model weights present?
- GitHub Actions or automation present?
- browser compatibility?
- small extractable idea?
- direct code-copy risk?
- intended target repo: `Music`, `drum-floor`, `namima`, `chill`, `hazama`,
  `OpenClaw`, or `Umbrel`
- should the source remain active, staging, harvest-only, reference-only, or
  archive candidate?

If any answer suggests audio, samples, lyrics, model weights, copied motifs,
heavy dependencies, or live automation, the default outcome is review-only until
explicitly approved.

## 5. Forbidden imports

Do not import:

- audio files
- samples or sample URLs
- lyrics
- copied melodies, motifs, arrangements, or recordings
- model weights
- blind runtime code copies
- external dependencies without explicit approval
- GitHub Actions or workflow automation
- Apple Music audio, previews, or stored preview URLs
- direct runtime code from `chill`, `test`, or `namima-lab` into `Music`
- automatic playback, recording, MIDI send, DAW arming, device control, upload,
  or merge behavior

The allowed material is design pattern, production intent, interaction model,
schema shape, review note, routing vocabulary, and repo-specific implementation
idea.

## 6. Harvest sidecar workflow

Use a sidecar or harvest note whenever a repo looks useful:

1. `discover`: identify the repo or internal candidate.
2. `inspect`: read only enough to understand license, assets, dependencies,
   runtime surface, and extractable ideas.
3. `summarize`: record what it does without copying code.
4. `classify`: choose current role, target repo, and risk level.
5. `translate`: convert the idea into production language for the target repo.
6. `human review`: decide whether it stays review-only, becomes docs, or gets a
   small runtime candidate.
7. `small PR`: implement only the translated idea, not the source repo.
8. `record/listen`: for audio-facing changes, listen and record notes before
   promotion.
9. `promote or reject`: update the sidecar or note status and keep rollback
   clear.

Concrete internal examples live in
`docs/examples/repo-harvest-sidecars/`. They are review-only metadata examples,
not implementation approval.

## 7. Internal repo harvest examples

- `chill` quiet piano / trio:
  - `Music`: possible future quiet piano / memory / soft-focus mode, after
    separate creative review.
  - `namima`: safe pacing, quiet recovery, and simple controls, without making
    namima a piano/lofi player.
- `chill` Flow Director:
  - `Music`: long-form radio pacing, decrescendo, and recovery.
  - `chill`: stays owner of quiet trio flow and listening score.
- `test` Style Blend:
  - `Music`: preset morph, reference-gradient translation, and genre timbre
    matrix.
  - `drum-floor`: probability interpolation as future groove grammar planning,
    through docs/schema/review first.
- `namima-lab` safe ripple lineage:
  - `namima`: primary target for water / gentle touch / public-friendly ripple
    interaction.
  - `Music`: possible organic pluck or gesture-to-note texture idea only after
    human review.
- `hazama`:
  - `Music`: atmosphere, navigation, void/liminal UI language as reference.
  - `OpenClaw`: mission-board atmosphere and review surface language.

## 8. External repo translation examples

- Tone.js scheduling idea -> `Music` timing helper or review doc.
- Live coding pattern language -> `drum-floor` pattern grammar.
- Particle/audio interaction -> `namima` ripple interaction.
- ML melody generation -> separate lab only, not main `Music`.
- Visual synth UI -> `hazama` or `Music` UI inspiration only.

The translated idea must not carry source melodies, samples, arrangements,
lyrics, recordings, model weights, or private data.

## 9. OpenClaw orchestra mapping

Repo harvest maps naturally to the OpenClaw/Umbrel-style control plane:

- repo harvest -> review-only sidecar
- approved sidecar -> repo-specific PR
- OpenClaw mission board -> status, routing, review, and promotion tracking
- optimizer -> recommendation only
- promotion -> human-gated merge path

OpenClaw may track what should happen next, but it must not auto-promote to
runtime, auto-arm live systems, start recording, upload audio, rewrite OUTPUT,
or merge without human approval.

## 10. Repo promotion states

- `active`: production repo with live runtime or active contract.
- `staging`: experimental repo still being tested.
- `harvest-only`: useful source, not a primary runtime.
- `reference-only`: conceptual or visual reference only.
- `archive-candidate`: may be archived after ideas are captured.
- `archived`: retained for history, not expected to evolve.
- `promoted`: a translated idea was accepted into a target repo.

Current defaults:

- `Music`: `active`
- `drum-floor`: `active`
- `namima`: `active`
- `chill`: `harvest-only` / possible quiet piano light surface
- `namima-lab`: `staging` / `harvest-only`
- `test`: `harvest-only` / `archive-candidate`
- `hazama`: `reference-only`
- `OpenClaw` / Umbrel-like surfaces: promotion plane / mission board

Changing a source from harvest-only or archive candidate to active runtime needs
separate human approval.

## 11. Next suggested docs tasks

- `Music`: refine packet / sidecar / trace examples without changing runtime.
- `Music`: use `docs/chill-quiet-piano-trio-decision.md` as the current quiet
  piano / trio boundary before any named Music mode review.
- `Music`: use `docs/test-style-blend-preset-morph-decision.md` as the current
  Style Blend boundary before any runtime preset morph work.
- `Music`: use `docs/namima-lab-safe-ripple-lineage-decision.md` as the current
  safe ripple lineage boundary before any namima-lab revival or Music
  gesture-to-texture work.
- `drum-floor`: keep probability and groove ideas in docs/schema/review before
  generator work.
