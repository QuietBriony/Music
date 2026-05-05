# Repo Harvest Orchestra Workflow

## 1. Purpose

This workflow defines how the Music Stack can harvest ideas from external
GitHub repos and internal archive/reference repos without importing unsafe
assets or flattening each repo into one runtime.

The source repo is a harvest source, not a replacement target. The preferred
flow is:

1. Discover and inspect.
2. Record a review-only sidecar.
3. Translate the useful idea into production intent.
4. Route it to the correct repo.
5. Promote it only through human-gated, small PRs.

This complements `docs/music-orchestra-protocol.md` and
`docs/archive-repo-harvest-audit.md`. The protocol defines the metadata-only
orchestra boundary. The audit records known internal archive ideas. This
workflow is the repeatable review path for both internal and external sources.

## 2. Active And Harvest Repo Roles

- `Music`: active conductor. It owns reference-driven production intent,
  self-running mix behavior, gesture direction, session packet shape, and final
  experimental IDM/ambient runtime decisions.
- `drum-floor`: active groove specialist. It owns groove grammar, drum phrase
  flow, articulation, raw drum candidate export, and browser drum adapters.
- `namima`: active public ambient surface. It owns family-safe mood, water,
  garden, ripple, daytime, and public-friendly ambient translation.
- `chill`: internal harvest repo and possible light surface. It is useful for
  Energy / Creation / Nature macro controls, ACID as performative color,
  piano-like calm layers as reference, compact public UI, and Cyber-Zen mood.
  Do not copy external piano sample URLs, sample implementations, or audio
  assets from it.
- `namima-lab`: staging/archive harvest repo. It is useful for touch ripple to
  audio energy, x-position note selection, particle-field modulation,
  PluckSynth-like organic texture, patch selection, and iOS-safe start flows.
- `test`: internal harvest repo. It is useful for Style Blend, archetype
  interpolation, pattern probability blending, and style/BPM/swing transition
  ideas.
- `hazama`: visual and conceptual reference only. It can inform void,
  boundary, cyber, Zen, and industrial atmosphere, but it is not a runtime
  import source.
- `OpenClaw` / Umbrel-like surfaces: orchestra mission board, review queue,
  promotion plane, optimizer, and human-gated control plane. They coordinate
  sidecars and PRs; they do not become the audio engine.

## 3. External Search Categories

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

## 4. Candidate Evaluation Checklist

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
- should the source remain harvest-only, become active, or become docs-only?

If any answer suggests audio, samples, lyrics, model weights, copied motifs, or
heavy dependencies, the default outcome is review-only until explicitly
approved.

## 5. Forbidden Imports

Do not import:

- audio files
- samples or sample URLs
- lyrics
- copyrighted melodic, harmonic, or arrangement motifs
- model weights
- blind code copies
- external dependencies without explicit approval
- GitHub Actions or workflow automation
- Apple Music audio, previews, or stored preview URLs
- direct runtime code from `chill`, `test`, or `namima-lab` into `Music`

The allowed material is design pattern, production intent, interaction model,
schema shape, review note, and repo-specific implementation idea.

## 6. Harvest Sidecar Workflow

Use a sidecar whenever a repo looks useful:

1. `discover`: identify the repo or internal candidate.
2. `inspect`: read only enough to understand license, assets, dependencies,
   runtime surface, and extractable ideas.
3. `summarize`: record what it does without copying code.
4. `classify`: choose category, current role, target repos, and risk level.
5. `translate`: convert the idea into production language for the target repo.
6. `human review`: decide whether it stays review-only, becomes docs, or gets a
   small runtime PR.
7. `small PR`: implement only the translated idea, not the source repo.
8. `record/listen`: for audio-facing changes, listen and record notes before
   promotion.
9. `promote or reject`: update the sidecar status and keep a rollback plan.

## 7. Internal Repo Harvest Examples

- `chill` Energy / Creation / Nature:
  - `Music`: simplified macro grouping for performance mode.
  - `namima`: public-friendly simplified controls.
- `chill` ACID toggle:
  - `Music`: performative pressure color, not a direct acid clone.
- `chill` piano-like calm layer:
  - `Music` / `namima`: synth or pluck memory, with no samples.
- `test` Style Blend:
  - `Music`: preset morph and genre timbre matrix.
  - `drum-floor`: pattern probability blending.
- `namima-lab` ripple:
  - `namima`: primary interaction model.
  - `Music`: gesture-to-note and organic texture inspiration.
- `hazama`:
  - `Music`: industrial/void UI influence.
  - `OpenClaw`: mission-board atmosphere and liminal review surface.

## 8. External Repo Translation Examples

- Tone.js scheduling idea -> `Music` timing helper or review doc.
- Live coding pattern language -> `drum-floor` pattern grammar.
- Particle/audio interaction -> `namima` ripple interaction.
- ML melody generation -> separate lab only, not main `Music`.
- Visual synth UI -> `hazama` or `Music` UI inspiration only.

The translated idea must not carry source melodies, samples, arrangements,
lyrics, recordings, or private data.

## 9. OpenClaw Orchestra Mapping

Repo harvest maps naturally to the OpenClaw/Umbrel-style control plane:

- repo harvest -> review-only sidecar
- approved sidecar -> repo-specific PR
- OpenClaw mission board -> status, routing, review, and promotion tracking
- optimizer -> recommendation only
- promotion -> human-gated merge path

OpenClaw may track what should happen next, but it must not auto-promote to
runtime, auto-arm live systems, start recording, upload audio, rewrite OUTPUT,
or merge without human approval.

## 10. Repo Promotion States

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
- `chill`: `harvest-only` / possible light surface
- `namima-lab`: `staging` / `harvest-only`
- `test`: `harvest-only` / `archive-candidate`
- `hazama`: `reference-only`
- `OpenClaw` / Umbrel-like surfaces: promotion plane / mission board

## 11. Next Suggested PRs

- `Music`: add a repo-harvest sidecar example for `chill`, `test`, and
  `namima-lab`.
- `Music`: add local `music-session-packet` exporter.
- `drum-floor`: accept Music groove intent packet.
- `namima`: accept Music mood intent packet.
- `chill`: decide archive-only vs light-surface continuation.
- `OpenClaw` / Umbrel-like runtime: add Music Stack Orchestra mission board
  docs.
