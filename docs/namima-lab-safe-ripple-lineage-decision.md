# Namima-Lab Safe Ripple Lineage Decision

## 1. Purpose

This memo records the current Music-side decision for `namima-lab` safe ripple /
water interaction lineage.

It answers the recurring docs question: should `namima-lab` be revived, merged
into Music, or used as a lineage source for `namima`?

This is a docs-only decision memo. It does not authorize runtime changes,
dependency additions, p5 migration, audio asset movement, schema changes, repo
revival, archive/delete action, or target repo edits.

## 2. Current decision

Keep `namima-lab` as lineage / staging / harvest-only.

The primary destination for safe ripple, water, gentle touch, and public ambient
interaction lineage is `namima`, not Music.

Music may refer to `namima-lab` only as abstract interaction or texture
inspiration. Any Music use must be translated into production parameters such
as gesture intent, organic texture, or memory pluck behavior. It must not copy
`namima-lab` runtime code, p5 visuals, pointer streams, dependencies, or patch
selector structure.

The current integration posture is:

- `namima-lab` remains a historical / staging source, not an active runtime.
- `namima` owns public-friendly water / garden / family-safe ambient behavior.
- Music owns reference-driven production intent and may only borrow the abstract
  idea of gesture-to-texture or organic pluck after human review.
- OpenClaw / inventory surfaces may track the lineage as metadata, but must not
  revive or route runtime work automatically.

## 3. Evidence basis

Current local repo evidence supports this split:

- `music-stack/namima-lab/README.md` says the repo is no longer the primary
  active music runtime and should be used only for namima-safe ambient
  experiments, docs/concepts, or lightweight reference notes.
- `music-stack/namima/docs/ambient-interaction-contract.md` already defines
  ripple interaction as gentle water-surface interaction, not an experimental
  performance instrument.
- `music-stack/namima/docs/ripple-interaction-design.md` already treats touch
  ripple as public-friendly ambient behavior with safe mapping to water texture,
  air, and soft response.
- `music-stack/namima/docs/namima-lab-harvest-closure.md` records that safe
  ambient lineage has been harvested into `namima`.
- `docs/archive-repo-harvest-audit.md` and
  `docs/repo-harvest-orchestra-workflow.md` already route safe ripple lineage
  primarily toward `namima`.
- `docs/examples/repo-harvest-sidecars/namima-lab.sidecar.json` marks the
  source as metadata-only, human-reviewed, no direct code copy, no audio import,
  no sample import, and no dependency import.

## 4. Allowed next docs work

- Link this memo from top-level Music Stack docs.
- Keep `namima-lab` examples metadata-only.
- Describe ripple lineage as `namima` interaction language, not Music runtime
  adoption.
- Describe Music use only as abstract gesture-to-texture or organic pluck
  inspiration.
- Keep future `namima` implementation work separately human-approved and
  rooted in `namima`'s own interaction contract.

## 5. Not allowed by this memo

- reviving `namima-lab` as active runtime
- copying `namima-lab` runtime code into Music or namima
- migrating p5 or other visual dependencies into Music
- storing raw pointer streams or private gesture traces
- adding audio files, samples, sample URLs, or dependencies
- making Music a public-friendly ambient player by absorbing `namima`
- adding dark IDM / glitch / heavy bass behavior to `namima`
- changing `engine.js`, `index.html`, `style.css`, schema files, presets,
  package files, or target repo files
- changing archive/delete status

## 6. Future review question

The following decision is still outside local Music docs evidence and needs
ChatGPT / Claude abstraction review plus human taste review:

```text
Should the safe ripple lineage remain entirely owned by namima, or should Music
also develop a separate gesture-to-texture performance layer inspired by
namima-lab?

Please consider whether Music's experimental identity benefits from organic
touch/pluck gestures, whether that would confuse namima's public-friendly role,
and how to keep water/garden safety separate from Music's darker reference
gradient work.
```

## 7. Review posture

Current status: accepted as a docs-only local decision candidate.

Promotion gates remain:

- human approval before editing `namima-lab`
- human approval before editing `namima`
- human approval before using `namima-lab` beyond metadata harvest
- human approval before adding gesture-to-texture runtime behavior in Music
- human approval before adding assets, samples, dependencies, or presets
- human approval before publishing, pushing, merging, or opening release work
