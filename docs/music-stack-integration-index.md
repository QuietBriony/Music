# Music Stack Integration Index

## まず使う／全体を理解する

- [Music Stack Listen](../listen.html): 日常の総合入口。別の管理アプリを増やさない。
- [全体像と使い方](MUSIC-STACK-SYSTEM-MANUAL.md): 利用者向け正本。生成・演奏・DAW・保存を区別。
- [道具台帳](../config/music-stack-tools.json): publicな入口・機能・境界・実装根拠。
- [BACKLOG](autonomy/BACKLOG.md): 現行の作業待ち行列。過去のNext PR Planは直接実行しない。

2026-09-07の統合では、このindexをrepo責任と連携契約の入口、system manualを利用の入口に固定。
二つのorchestra direction文書と旧ロードマップは背景・履歴として残す。runtimeのprotocol / schemaは
置き換えない。実機の正本は引き続きprivate `music-ops`で、public機能台帳へ移さない。

## 1. Purpose

This document is the top-level entry for the current Music Stack integration
docs.

Use it to find the current role map, metadata-only coordination rules, harvest
workflow, and next safe work queue. It does not authorize runtime migration,
audio asset movement, dependency additions, archive/delete actions, or
cross-repo merges. It also does not authorize copying private operator data
into this public repository.

## 2. Current authority map

- `docs/integration-catalog.md`: short current catalog for repo roles and safe
  integration posture.
- `docs/integration-roadmap-music-stack.md`: docs-first / metadata-only /
  human-gated roadmap.
- `docs/music-orchestra-protocol.md`: conductor, packet, sidecar, trace, data
  safety, and promotion policy.
- `docs/music-stack-sync-manual.md`: user-facing SYNC behavior across Music,
  drum-floor, namima, chill, and OpenClaw.
- `docs/cross-repo-listening-review-round.md`: human listening round for
  choosing exactly one next repo-specific PR.
- `docs/repo-harvest-orchestra-workflow.md`: repeatable harvest review workflow
  for internal and external sources.
- `docs/archive-repo-harvest-audit.md`: current harvest shelf for chill, test,
  and namima-lab. (As of 2026-05-25, `test` and `namima-lab` harvest cycles are
  closed via BL-019 — see `docs/autonomy/BACKLOG.md` Done section. Chill harvest
  to runtime recipe was closed earlier via BL-012.)
- `docs/chill-quiet-piano-trio-decision.md`: current docs-only decision that
  `chill` keeps quiet piano / trio ownership while Music keeps routing and
  production-intent references.
- `docs/test-style-blend-preset-morph-decision.md`: current docs-only decision
  that `test` Style Blend stays archive-harvest metadata for Music preset
  morph / reference-gradient planning.
- `docs/namima-lab-safe-ripple-lineage-decision.md`: current docs-only decision
  that `namima-lab` stays lineage / harvest-only, with safe ripple ownership
  routed primarily to `namima`.
- `docs/lyric-os/okinawa-local/README.md`: metadata-only Okinawa Local Lyric /
  Scene OS for Lyric Lab and Music Stack output philosophy. It stores pressure,
  distance, vocabulary, risk, and scene packets, not lyrics or audio.

Supporting strategy docs:

- `docs/music-stack-repo-strategy.md`
- `docs/reference-driven-generative-rig.md`
- `docs/reference-analysis-template.md`
- `references/apple-music-refs.json`

## 3. Current repo roles

### Music

- **Role:** central integration target / conductor.
- **Direction:** experimental / edge / reference-driven generative rig.
- **Owns:** Music runtime, UCM faders, Hazama FM, Music Core Rig, session
  packet, reference-driven production intent, Lyric Lab, and metadata-only
  Scene OS output philosophy.
- **Boundary:** `engine.js`, `index.html`, and `style.css` stay protected in
  docs/schema PRs.

### music-ops (optional private operator overlay; not a runtime)

- **Role:** private operational source of truth when it exists beside Music.
- **Owns:** owned equipment, lifecycle state, real placement and relationship
  labels, physical constraints, actual routing, machine observations, and
  device-verified settings.
- **Does not own:** creative intent, public workflow, presets, runtime, apps,
  playback defaults, or the active five-repository topology.
- **Availability:** optional. Public clones and CI must work without it. When
  absent, do not infer the owner's hardware state.
- **Boundary:** never copy its private site labels, hostnames, financial data,
  or exact operational snapshots into Music.

### drum-floor

- **Role:** active rhythm / groove / VCV / stage-safety reference.
- **Direction:** groove grammar, pocket frames, human-gated promotion, raw
  candidate boundaries.
- **Owns:** drum feel, stage safety, browser drum preview, candidate CLI, and
  Music SYNC receiver behavior.
- **Boundary:** Music SYNC must not auto-start, record, send MIDI, arm Ableton,
  touch EP-133, or upload anything.

### namima

- **Role:** active public-friendly ambient player.
- **Direction:** daytime / family-safe / water / garden / soft continuous
  listening.
- **Owns:** safe mood translation, ambient profiles, user-gesture start, and
  metadata-only Music SYNC translation.
- **Boundary:** do not import dark glitch, heavy bass, stage groove assumptions,
  or copied namima-lab code.

### chill

- **Role:** quiet piano / trio / long-form listening light surface and harvest
  source.
- **Direction:** synthetic felt-like piano, long rests, Flow Director, optional
  BASS / DRUMS, quiet recovery, deterministic preview.
- **Boundary:** do not flatten into generic ambient, make PULSE the main
  identity, or let Music SYNC auto-start playback.

### openclaw

- **Role:** active music-stack control desk / session planner.
- **Direction:** repo harvest desk, recommended-destination hub, mission-board
  and review-queue surface for Music session packets.
- **Boundary:** track next steps as metadata only; do not auto-promote,
  auto-merge, or auto-start any sister repo runtime.

### namima-lab (archived)

- **Role:** lineage / staging / harvest-only source.
- **Direction:** historical namima experiments, ripple interaction, organic
  pluck, lightweight reference notes.
- **Boundary:** do not revive as active runtime or merge directly into Music
  without separate approval.

### test (archived)

- **Role:** archive candidate / harvest-only source.
- **Direction:** style blend, probability / interpolation ideas.
- **Boundary:** do not treat as primary runtime or add assets/dependencies.

### hazama (external reference, not a music-stack repo)

- **Role:** world / game / story / visual reference-only; outside the
  music-stack repo cluster.
- **Direction:** atmosphere, navigation, liminal world feel.
- **Boundary:** do not make it a Music runtime, dependency, or migration target.

## 4. Shared rules

- no audio files
- no samples or sample URLs
- no lyrics
- no copied melodies, motifs, arrangements, or recordings
- no dependency additions unless intentionally approved
- no GitHub Actions changes
- no direct repo merge
- no blind runtime code copy
- metadata-only packets / sidecars / traces by default
- human review before promotion
- references are production translations, not copying targets

### Public creative vs private operational authority

| Question | Canonical source |
|---|---|
| What sound, workflow, schema, preset, or app should be reusable? | public `Music` |
| What equipment is owned, where is it, and how is it actually connected? | private `music-ops`, when available |
| What did it cost, where was it purchased, or how should a person browse the list? | private Google Sheet view |

Public hardware examples use anonymous IDs such as `site-dtm-desk` and
`site-yard-main`. A manufacturer-documented feature remains `documented` until
the current Windows endpoint, DAW route, physical cable, and audible result are
checked; only then may the private source mark it `verified_on_device`.

## 5. Shared schema / vocabulary concepts

- **reference profile:** timbre / rhythm / space / structure / gesture
- **groove profile:** vocal / bass / guitar / section / style -> drum feel
- **mood profile:** brightness / warmth / water_motion / garden_air / density /
  loudness_safety -> ambient feel
- **session packet:** current Music production intent and routing hints
- **scene metadata:** pressure / image / distance / risk / usable-form packet
  for lyric and Music Stack output thinking; no lyric body or audio
- **sidecar:** review-only interpretation or suggestion
- **trace:** local or reviewed observation without audio or raw private data

## 6. Safe work queue

Docs / schema / review-safe:

- keep role docs aligned with `docs/integration-catalog.md`
- improve packet / sidecar / trace explanations
- run a cross-repo listening review round before choosing runtime tuning
- update harvest notes when source repo identity changes
- add examples that remain metadata-only
- roll phrase-thinking inbox notes into Scene OS metadata packets
- prepare runtime candidates only as review documents

Runtime candidate planning:

- allowed only after docs/schema/review boundaries are clear
- must name target repo, intended effect, provenance, and rollback
- must preserve no-sample / no-lyrics / no-copied-motif rules
- must define listening or browser behavior review before promotion

Not in this queue:

- Music engine tuning without fresh review
- direct `chill`, `test`, or `namima-lab` runtime copy
- drum-floor live arming or DAW/device automation
- namima-lab revival
- hazama runtime integration

## 7. Suggested next PRs

1. Music docs: use `docs/chill-quiet-piano-trio-decision.md` as the current
   docs-only boundary for quiet piano / trio, then ask for human taste review
   before any named Music mode or runtime adoption.
2. Music docs: use `docs/test-style-blend-preset-morph-decision.md` as the
   current docs-only boundary for `test` Style Blend before any runtime preset
   morph or visible control.
3. Music docs: use `docs/namima-lab-safe-ripple-lineage-decision.md` as the
   current docs-only boundary before any namima-lab revival or Music
   gesture-to-texture runtime work.
4. Music docs: use `docs/cross-repo-listening-review-round.md` before choosing
   any next runtime candidate across namima, chill, or drum-floor.
5. Later runtime candidate: only after human review and listening/browser
   review criteria are explicit.

## 8. Synthesis prompt seed

```text
Read Music docs, drum-floor docs, namima docs, chill docs, and hazama status.
Produce a current Music Stack architecture that preserves distinct repo roles,
uses metadata-only coordination by default, and separates harvest ideas from
runtime promotion. Do not merge runtimes blindly. Prioritize Music runtime
stability, drum-floor groove specialization, namima public-friendly safety, and
chill quiet piano / trio identity.
```

## 9. Current state summary

- Music stack role catalog is current.
- Metadata-only protocol and SYNC boundary are the default coordination model.
- Archive / staging repos are harvest sources, not direct runtime import targets.
- Next phase is docs/schema/review alignment before any runtime change.
