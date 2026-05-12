# Music Stack Orchestra Direction

## Purpose

This document fixes the development direction for the Music Stack Orchestra
without changing runtime code. It sits above the existing protocol, routing
map, session packet schema, and repo harvest workflow.

Music is the conductor, not a repo merger. The stack should evolve through
metadata packets, review-only sidecars, traces, and small repo-specific PRs.
No repo should silently overwrite another repo's runtime, audio identity, or
release posture.

## Current Authority Docs

- Protocol: `docs/music-orchestra-protocol.md`
- Routing map: `docs/music-orchestra-routing-map.md`
- Music session packet schema: `docs/schema/music-session-packet.schema.json`
- Repo harvest workflow: `docs/repo-harvest-orchestra-workflow.md`
- Integration index: `docs/music-stack-integration-index.md`

This direction doc does not replace those files. It defines the development
lanes and promotion order so the existing docs point in the same direction.

## Repo Roles

- `Music`: conductor, reference-driven rig, MIC FOLLOW, OUTPUT, recorder,
  session packet source, audio review surface, and final production intent.
- `drum-floor`: groove specialist, phrase-aware drum flow, articulation,
  stage-safety reference, and future Music groove-intent adapter.
- `namima`: public ambient surface, mood profile runtime, ripple interaction,
  safe family-friendly trace recorder, and future Music mood-intent adapter.
- `chill`: quiet piano / trio / light-surface candidate. It contributes
  pacing, room, touch, and listening-space ideas without being folded flat into
  Music.
- `hazama`: visual, world, story, void, and industrial UI reference. Hazama FM
  audio inside Music must remain a safe parallel color layer, not a full-mix
  processor.
- `OpenClaw` / Umbrel-like surfaces: repo hub, mission board, review queue,
  optimizer, promotion plane, and rollback ledger. In this context OpenClaw
  means a coordination surface, not an LLM that directly executes music changes.

## Sidecar Flow

1. `Music` emits a `music-session-packet` or a higher-level orchestra packet.
2. `drum-floor` consumes groove intent only.
3. `namima` consumes safe mood and ambient intent only.
4. `chill` may consume light-surface or quiet-piano intent after its role is
   confirmed.
5. `OpenClaw` / Umbrel-like surfaces track mission status, review, promotion,
   and rollback.
6. A human reviews the packet, trace, or recording.
7. Approved changes become small repo-specific PRs.

There is no automatic runtime promotion, no audio storage, no sample transfer,
and no blind code copy.

## Packet Types

- `music-session-packet`: current Music state and production intent.
- `music-orchestra-packet`: high-level wrapper for routing and promotion.
- `groove-request-packet`: future drum-floor input.
- `mood-request-packet`: future namima input.
- `harvest-sidecar`: review-only import candidate from a source repo.
- `promotion-request`: human-reviewed candidate for a repo-specific PR.
- `review-result`: human or agent review outcome, including rollback notes.

## Development Lanes

### Lane A: Music Audio Quality

- Hazama FM gain staging and clipping.
- Genre timbre kits by BPM, energy, and reference gradient.
- MIC FOLLOW response and restraint.
- Recorder review and output-level comparison.

### Lane B: drum-floor Groove

- Music packet to groove adapter.
- Phrase generation and articulation.
- Organic drum phrase flow demos.
- No live arming or external device automation without a separate gate.

### Lane C: namima Public Ambient

- Music packet to mood adapter.
- Mood profile runtime translation.
- Ripple runtime and session trace.
- Public-friendly safety remains repo-specific.

### Lane D: chill Light Surface

- Decide light-surface regrowth vs archive posture.
- Preserve quiet piano / trio identity.
- Harvest macro controls as intent, not code copy.
- No external samples or piano audio files.

### Lane E: OpenClaw Orchestra

- Mission board docs.
- Sidecar and packet status tracking.
- Human-gated promotion and rollback.
- No automatic executor, merge, release, or audio capture.

## Safety Boundaries

- No audio files.
- No samples.
- No lyrics.
- No Apple Music audio, preview URLs, or copied phrases.
- No dependency adoption unless approved.
- No `.github/workflows` changes from this lane.
- No blind runtime copy between repos.
- No automatic promotion, push, merge, publish, or release.

## Next 12 PR Plan

| # | repo | title | type | model | goal | risk |
|---|---|---|---|---|---|---|
| 1 | Music | fix(audio): repair Hazama FM gain staging | runtime tuning | Codex high | stop clipping / pumping before wider routing | human listening still required |
| 2 | Music | docs: define Music Stack Orchestra development direction | docs/schema | Codex | align stack direction without runtime change | doc overlap |
| 3 | Music | feat: export local music session packet | runtime metadata | Codex high | make conductor state portable | packet drift |
| 4 | drum-floor | feat: accept Music groove intent packet | adapter | Codex high | translate Music groove intent into drum grammar | over-coupling |
| 5 | namima | feat: accept Music mood intent packet | adapter | Codex high | translate Music mood intent into safe ambient behavior | mood flattening |
| 6 | OpenClaw | docs: add Music Stack Orchestra mission board | docs | Codex | clarify hub/control-plane role | name confusion |
| 7 | chill | docs: decide light surface vs archive | docs | Codex | avoid accidental revival or flattening | premature revival |
| 8 | Music | feat: add genre timbre kits by BPM/Energy | runtime tuning | Codex high | make genre source construction clearer | clipping / taste drift |
| 9 | Music | feat: add scene/commit snapshot | metadata | Codex | capture reviewable session state | privacy / noise |
| 10 | drum-floor | feat: mixture_shout groove demo | runtime demo | Codex high | prove organic groove specialization | overbuilding |
| 11 | namima | feat: ripple ambient runtime pass | runtime tuning | Codex high | deepen safe ripple identity | too much Music influence |
| 12 | Music | docs: add recording review scorecard v2 | docs | Codex | standardize listening gates | checklist sprawl |

## Human Review Rule

- Audio PRs require a browser listening plan and, when useful, an m4a recording
  comparison.
- Cross-repo PRs require a packet, sidecar, or schema boundary first.
- Promotion requires a reviewer note and rollback note.
- Merge is allowed only after the scoped validation for that PR passes.

## Near-Term Recommendation

The next implementation move after this docs/schema pass should be one small
Music runtime or metadata PR, not a multi-repo migration. The best candidate is
`feat: export local music session packet`, because the stack cannot coordinate
organically until Music can emit a stable packet that the other repos can read
without copying Music runtime.
