# Music Integration Catalog

## 1) Purpose

This document is the current catalog for the local Music Stack roles and safe
integration posture.

It reflects the local inventory and the newer Music Stack docs without
authorizing runtime migration, file moves, archive/delete actions, dependency
changes, or cross-repo merges.

Use this document as a short entrypoint. For active contracts and workflows,
defer to the authority docs below.

## 2) Authority docs

- `docs/music-stack-integration-index.md`: top-level integration entry, current
  repo roles, shared rules, and work queues.
- `docs/music-orchestra-protocol.md`: metadata-only conductor, packet, sidecar,
  trace, and human-gated promotion boundary.
- `docs/repo-harvest-orchestra-workflow.md`: harvest workflow and source repo
  states such as active, staging, harvest-only, reference-only, and archive
  candidate.
- `docs/music-stack-sync-manual.md`: user-facing SYNC behavior across Music,
  drum-floor, namima, chill, and OpenClaw.
- `docs/chill-quiet-piano-trio-decision.md`: current docs-only boundary that
  keeps `chill` as quiet piano / trio owner while Music keeps routing and
  production-intent references.
- `docs/test-style-blend-preset-morph-decision.md`: current docs-only boundary
  that keeps `test` as archive-harvest source while Music may translate Style
  Blend into preset morph / reference-gradient planning.
- `docs/namima-lab-safe-ripple-lineage-decision.md`: current docs-only boundary
  that keeps `namima-lab` as safe ripple lineage / harvest-only source, routed
  primarily toward `namima`.

Supporting / historical docs:

- `docs/archive-repo-harvest-audit.md`: harvest idea shelf for chill, test, and
  namima-lab.
- `docs/integration-roadmap-music-stack.md`: older implementation-prep roadmap;
  useful for safety criteria, but no longer the primary current role source.

## 3) Current repo roles

### Music

- Role: central integration target and conductor.
- Edge: experimental / reference-driven generative rig with UCM, Hazama FM,
  Music Core Rig, session packets, and broad ambient-to-club range.
- Keep repo-specific: Music runtime, UCM faders, Hazama FM, Music Core Rig,
  reference-driven production intent.

### namima

- Role: active public-friendly ambient player and consistency reference.
- Edge: water, garden, daytime, family-safe mood, safe start, no samples, and
  metadata-only Music SYNC translation.
- Do not dilute: do not import dark glitch, heavy bass, stage groove
  assumptions, or copied namima-lab code.

### drum-floor

- Role: active rhythm / groove / VCV / stage-safety reference and Music SYNC
  receiver.
- Edge: pocket-aware groove grammar, stage operation, human-gated promotion,
  browser preview, and raw candidate boundaries.
- Do not dilute: Music SYNC must not auto-start playback, record, send MIDI,
  arm Ableton, touch EP-133, or upload anything.

### chill

- Role: quiet piano / trio / long-form listening light surface and harvest
  source.
- Edge: synthetic felt-like piano, long rests, Flow Director, optional BASS /
  DRUMS, quiet recovery, deterministic preview checks, and local listening
  score.
- Do not dilute: do not flatten chill into generic ambient, and do not make
  PULSE or drums the main identity.

### namima-lab

- Role: lineage / staging / harvest-only source.
- Edge: historical namima experiments, ripple interaction ideas, organic pluck
  texture ideas, and lightweight reference notes.
- Do not dilute: do not revive as the active runtime, merge directly into
  Music, or use as a dependency-heavy experiment lane without separate approval.

### test

- Role: archive candidate and harvest-only source unless intentionally
  reactivated.
- Edge: small style blend and probability/interpolation ideas.
- Do not dilute: do not treat as a primary runtime or add assets/dependencies.

### hazama

- Role: world / game / story / visual reference-only.
- Edge: atmosphere, navigation, liminal world feel, and non-music operations
  reference.
- Do not dilute: do not pull hazama into Music runtime, dependency, or migration
  work.

## 4) Reusable material

Allowed to harvest:

- design patterns
- production intent
- interaction models
- routing vocabulary
- schema or packet ideas
- review notes
- human-gated promotion patterns

Not allowed by default:

- audio files
- samples or sample URLs
- lyrics
- copyrighted melodies, motifs, arrangements, or recordings
- blind runtime code copy
- dependency additions
- GitHub Actions or workflow automation
- archive/delete/settings changes

## 5) Recommended next docs work

Next small Music-side docs work after this catalog:

1. Keep `docs/music-stack-integration-index.md` as the top-level entry.
2. Treat `docs/music-orchestra-protocol.md` and
   `docs/music-stack-sync-manual.md` as the current metadata-only behavior
   boundary.
3. Update older roadmap / harvest docs only when they block a concrete small
   PR.

Do not create another catalog unless the current authority docs change enough
to justify one.

## 6) Non-goals

- no runtime code changes
- no `engine.js`, `index.html`, or `style.css` changes
- no schema changes
- no audio build or playback run
- no audio assets or samples
- no dependency installation
- no cloned repo merge
- no archive/delete action
- no GitHub settings or workflow changes
