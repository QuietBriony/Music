# Cross-Repo Listening Review Round

## Purpose

Use this guide before choosing the next Music Stack runtime or tuning PR.

The goal is to listen across `namima`, `chill`, and `drum-floor` without
flattening them into `Music`. Each repo keeps its own score language and the
next PR is selected from human notes, not from inventory momentum.

## Local review server

When reviewing the local `music-stack` workspace, serve the cluster root:

```text
C:\workspace\music-stack
```

Preferred local URL:

```text
http://127.0.0.1:8130/
```

Use cluster-root serving because `chill/session.html` may load the optional
`drum-floor` adapter through `/drum-floor/...`.

## Review order

### 1. namima

- URL: `http://127.0.0.1:8130/namima/`
- Start with `Tap to start`.
- Listen to one calm pass.
- Tap lightly.
- Save `TRACE`.
- Use `namima/docs/ambient-listening-scorecard.md`.

Decision signal:

- choose `namima` only if ambient safety, water / garden feel, or touch
  softness has a clear human-reviewed weakness.

### 2. chill

- URL: `http://127.0.0.1:8130/chill/session.html`
- Start with `START` only.
- Keep default `BASS ON`.
- Test `AUTO` only if judging flow.
- Leave `DRUMS` optional.
- Save the local listening score.
- Use `chill/docs/listening-score-review.md`.

Decision signal:

- choose `chill` only if quiet-trio flow, fatigue, bass support, or recipe
  confidence has a clear human-reviewed weakness.

### 3. drum-floor

- URL: `http://127.0.0.1:8130/drum-floor/`
- Use standalone browser preview first.
- Open the development panel only if scoring.
- Use the score command panel as metadata-only review support.
- Do not run promotion unless a separate promotion request can name a small,
  reversible pattern-frame change.

Decision signal:

- choose `drum-floor` only when there is a strong groove score plus a precise
  `next_hint`.

## Cluster decision rule

After listening, choose exactly one:

- `namima` mood-profile tuning or scorecard/docs refinement
- `chill` tiny quiet-parameter tuning, docs refinement, or recipe-export
  validation
- `drum-floor` promotion-request candidate
- hold

Do not start a multi-repo tuning PR.

## What Music should do

`Music` should remain the conductor:

- read repo-specific review outcomes
- keep packet / sidecar / trace coordination metadata-only
- avoid absorbing sibling repo identities
- turn approved outcomes into small repo-specific PRs

`Music` should not:

- consume `namima` TRACE directly before human review
- turn `chill` into a Music mode without a separate decision
- promote `drum-floor` pattern frames automatically
- treat localStorage, generated commands, or fixture JSON as accepted truth

## Human gates

- before any runtime tuning
- before consuming sibling review metadata in `Music`
- before recipe re-export or recipe default changes
- before pattern-frame promotion
- before live, MIDI, DAW, VCV, EP-133, audio asset, sample, dependency, or
  workflow work
