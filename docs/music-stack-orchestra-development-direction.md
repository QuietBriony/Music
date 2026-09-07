# Music Stack Orchestra Development Direction

> **Historical development plan — 2026-09-07に現行入口を統合。**
> 下記は当時の提案であり、実行キューではない。[Integration Index](music-stack-integration-index.md)が
> protocol / routing / schemaの入口、[総合manual](MUSIC-STACK-SYSTEM-MANUAL.md)が利用者の入口、
> [BACKLOG](autonomy/BACKLOG.md)が次作業の正本。chillは現在activeなquiet piano / trio surface。
> [当時の12行の照合結果](music-stack-orchestra-plan-status.md)を残し、出荷済みadapterやDeskを再実装しない。
> 本文中のFirst Implementation PRや役割未決は歴史的記録で、今の実行指示ではない。

## 1. Purpose

This document fixes the practical development direction for the Music Stack
Orchestra without changing runtime behavior.

Music is the conductor. The sibling repos remain specialist instruments. The
stack should evolve through packets, review-only sidecars, adapters, and
human-gated promotion instead of direct repo fusion or blind runtime copy.

OpenClaw and Umbrel-like surfaces are the mission board and promotion plane.
They may collect routing status, review notes, rollback notes, and promotion
requests, but human review is required before any runtime change.

## 2. Repo Roles

### Music

- Experimental rig and conductor.
- Audio review surface for recordings, OUTPUT, AutoMix, Pad, Bandroom, MIC
  FOLLOW, and Hazama FM.
- Source of local session packets and review sidecars.
- Home for Genre Timbre Kits and the sharpest Aphex-IDM / reference-driven
  production behavior.

### drum-floor

- Groove specialist.
- Translates Music groove intent into phrase, articulation, pressure, section,
  and pattern behavior.
- Owns mixture_shout, nerdy_jazzy_hiphop, breakbeat, band-room groove, and
  organic drum phrase refinement.

### namima

- Public-friendly ambient specialist.
- Translates Music mood intent into family-safe ambient parameters such as
  water motion, brightness, air, openness, shimmer, touch softness, and sparse
  melody probability.
- Owns ripple runtime, safe session trace metadata, and surface-level mood
  adapters.

### chill

- Light surface candidate and harvest source.
- Contributes macro control ideas such as Energy / Creation / Nature, ACID
  toggle behavior, Cyber-Zen mood, and simple public UI patterns.
- Should be kept lightweight until its role is decided.

### hazama

- Visual, conceptual, void, and industrial mood reference.
- Hazama FM may be used only as a safe parallel color layer. It must not become
  a full-mix serial processor by default.

### OpenClaw / Umbrel

- Mission board, review-only sidecar store, promotion plane, and rollback
  ledger.
- May organize requests and approvals, but must not auto-execute runtime edits,
  audio capture, merges, releases, or live actions.

## 3. Development Lanes

### Lane A: Music Sound Core

- Repair Hazama FM gain staging, modulation depth, feedback, and tail overlap.
- Add Genre Timbre Kits by BPM, energy, density, and reference gradient.
- Add Bandroom PWA audio-safe boot and reset behavior.
- Keep recording review as the judge for sound-core changes.

### Lane B: Music Packet / Sidecar

- Export a local `music-session-packet`.
- Include MIC FOLLOW metadata, UCM / fader state, performance pad history,
  output state, reference gradient, and intent summaries.
- Add a recording review scorecard.
- Keep packet export local JSON copy/download first.

### Lane C: drum-floor

- Add a Music packet to groove adapter.
- Translate groove intent, density, pressure, section, and articulation.
- Develop mixture_shout and nerdy_jazzy_hiphop examples.
- Refine organic drum phrase behavior without importing Music runtime code.

### Lane D: namima

- Add a Music packet to mood adapter.
- Translate safe mood intent into ripple runtime and ambient parameters.
- Preserve public ambient safety, family-safe behavior, and trace recorder
  boundaries.
- Avoid direct Music sound-core copy.

### Lane E: chill

- Decide whether chill is a light surface or archive.
- Harvest macro controls and public UI ideas as metadata.
- Do not add external piano samples or imported sample libraries.

### Lane F: OpenClaw / Umbrel

- Add mission board docs for Music Stack Orchestra.
- Store review-only sidecars and promotion requests.
- Require explicit human approval for promotion and rollback.
- Do not add automatic executors.

## 4. Non-Interference Rule

- Harvested features must not alter default runtime behavior.
- New ideas must not connect to the main audio path by default.
- Development order is docs/schema first, adapter second, feature-flagged
  runtime third.
- Every promoted change needs a rollback path.
- Do not blindly copy code between repos.
- Do not import audio files, samples, model weights, lyrics, or workflow
  changes through this lane.
- Cross-repo changes should move as packets, sidecars, adapters, or reviewed
  PRs, not as direct runtime merges.

## 5. Next 12 PR Plan

> **Implementation status (2026-07-10):** several rows in this table were already
> shipped before this document was merged. Before picking up any row, consult
> `docs/music-stack-orchestra-plan-status.md` — it maps each row to existing
> code, remaining gaps, and human-gate constraints. Do not re-implement shipped
> rows (#2, #4, #5, #6, #7, #10).

| # | repo | title | lane | goal |
|---|---|---|---|---|
| 1 | Music | fix(audio): repair Hazama FM gain staging | A | Stop clipping, pumping, and full-mix damage before wider routing. |
| 2 | Music | fix(pwa): add Bandroom audio-safe boot and reset | A | Make Bandroom recoverable from stale PWA cache and graph state. |
| 3 | Music | feat(engine): strengthen genre timbre kits by BPM/Energy | A | Make low BPM feel ambient and high BPM resolve into IDM / techno timbre. |
| 4 | Music | docs/schema: add music-session-packet schema | B | Lock the conductor packet contract before adapters depend on it. |
| 5 | Music | feat: export local music-session-packet | B | Let Music emit a local JSON packet for review and routing. |
| 6 | drum-floor | feat: add Music groove packet adapter | C | Convert Music groove intent into drum phrase and articulation parameters. |
| 7 | namima | feat: add Music mood packet adapter | D | Convert Music mood intent into family-safe ambient runtime parameters. |
| 8 | chill | docs: decide light surface vs archive | E | Avoid accidental repo flattening and clarify future harvest rules. |
| 9 | Music | docs: add recording review scorecard v2 | B | Standardize listening notes for sound-core changes. |
| 10 | OpenClaw/Umbrel | docs: add Music Stack mission board | F | Create the review-only control plane for packets and promotions. |
| 11 | drum-floor | feat: add mixture_shout groove demo | C | Prove the groove specialist lane with a focused demo. |
| 12 | namima | feat: add ripple ambient runtime pass | D | Deepen the public ambient surface without importing Music's sharp edges. |

## 6. Routing Policy

The routing schema for this direction lives at
`docs/schema/music-stack-orchestra-routing.schema.json`.

Routing is metadata-only by default. A route may be enabled only when it keeps
the target repo's default behavior unchanged, requires an adapter boundary, and
requires human review.

## 7. First Implementation PR

After this docs/schema direction is in place, the first implementation PR should
be:

`Music: fix(audio): repair Hazama FM gain staging`

Music has to be a trustworthy conductor before packets are used to evaluate
drum-floor, namima, chill, or OpenClaw/Umbrel routing. If Bandroom or Hazama FM
damages the sound, every downstream review becomes noisy.
