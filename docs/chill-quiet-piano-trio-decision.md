# Chill Quiet Piano / Trio Decision

## 1. Purpose

This memo records the current Music-side decision for the `chill` quiet piano /
trio lane.

It answers the recurring docs question: should quiet piano / trio stay a
separate `chill` identity, or become a named Music mode?

This is a docs-only decision memo. It does not authorize runtime changes,
audio asset movement, dependency additions, schema changes, repo merges, or
automatic playback.

## 2. Current decision

Keep `chill` as the owner of the quiet piano / trio identity for now.

Music may keep a `PIANO` pill, quiet piano route, memory / soft-focus
production hint, or Hazama FM preset reference. Those should be treated as
Music-side routing and listening intent, not as ownership transfer from
`chill`.

The current integration posture is:

- `chill` owns quiet piano / trio flow, local listening score, Flow Director
  pacing, optional BASS / DRUMS balance, and quiet recovery behavior.
- `Music` owns central production intent, UCM / Hazama FM / Music Core Rig,
  session packets, and reference-driven generative translation.
- Music session packets may suggest `chill` as a destination, but they must not
  auto-start `chill`, copy `chill` runtime code, or turn `chill` into a hidden
  Music subsystem.

## 3. Evidence basis

Current local docs already point to this split:

- `docs/integration-catalog.md` defines `chill` as quiet piano / trio /
  long-form listening light surface and harvest source.
- `docs/music-stack-integration-index.md` lists `chill` as a separate current
  repo role and keeps direct runtime copy out of the safe queue.
- `docs/repo-harvest-orchestra-workflow.md` keeps `chill` as harvest-only /
  possible quiet piano light surface, with future mode adoption behind review.
- `docs/archive-repo-harvest-audit.md` treats `chill` as no longer a primary
  Music runtime, but as a strong listening-first regrowth candidate.
- `docs/USAGE-HAZAMA-FM.md` and `docs/HAZAMA-FM-ARCHITECTURE.md` already
  describe a Music `PIANO` lane that can refer to `chill` recipe identity
  without making `chill` the Music runtime.

## 4. Allowed next docs work

- Link this memo from top-level Music Stack docs.
- Keep examples metadata-only when they mention `chill`.
- Use `chill` sidecars to describe intent, provenance, and review notes.
- Document Music `PIANO` / quiet piano behavior as a route or mode candidate
  only when it stays clear that `chill` remains the source identity.

## 5. Not allowed by this memo

- copying `chill` runtime code into Music
- copying `chill` audio assets, samples, or sample URLs into Music
- auto-starting `chill` from Music SYNC or session packets
- making drum/pulse behavior the main `chill` identity
- treating `chill` as generic ambient
- archiving, merging, or renaming `chill`
- adding dependencies for quiet piano adoption
- changing `engine.js`, `index.html`, `style.css`, schema files, or presets

## 6. Future review question

The following decision is still outside local docs evidence and needs
ChatGPT / Claude abstraction review plus human taste review:

```text
Should Music eventually expose quiet piano / trio as a named Music mode, or
should `chill` remain the long-term owner of that identity with Music only
providing routing, packet hints, and occasional preset references?

Please consider channel identity, listening context, public/private audience,
daytime vs late-night mood, and whether quiet piano should soften Music's edge
or stay as a separate calm surface.
```

## 7. Review posture

Current status: accepted as a docs-only local decision candidate.

Promotion gates remain:

- human approval before editing `chill`
- human approval before moving any `chill` material into Music runtime
- human approval before changing Music's public mode vocabulary
- human approval before adding assets, samples, dependencies, or presets
- human approval before publishing, pushing, merging, or opening release work
