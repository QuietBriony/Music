# Music Stack Integration Index

## 1. Purpose

このドキュメントは、Music stack 全体の統合入口として現状と次手順を固定する。
- 5.3: `docs/schema` / 参照メタデータ / 小規模レビュー設計を整える。
- 5.5 high/xhigh: 横断統合・音響設計・runtime 実装へ進める。

## 2. Active repos

### Music

- **Role:** Reference-Driven Generative Rig
- **Direction:** experimental / edge / Aphex homage / IDM / field-murk / transparent glitch
- **Current anchors:**
  - `docs/music-stack-repo-strategy.md`
  - `docs/reference-driven-generative-rig.md`
  - `docs/reference-analysis-template.md`
  - `references/apple-music-refs.json`
- **Runtime:** `engine.js` is active but protected
- **Next:** recording review / preset translation / engine tuning only with 5.5 + m4a review

### drum-floor

- **Role:** Band Groove Generator
- **Direction:** vocal / bass / guitar / section / style profile → drum feel
- **Current anchors:**
  - `docs/README.md`
  - `docs/groove-profile-schema.md`
  - `docs/input-output-example.md`
  - `profiles/groove-profiles.json`
- **Runtime:** not implemented yet
- **Next:** JSON Schema / validator docs / simple generator design later

### namima

- **Role:** Public-Friendly Ambient Player
- **Direction:** daytime / family-safe / water / garden / soft continuous listening
- **Current anchors:**
  - `docs/README.md`
  - `docs/mood-profile-schema.md`
  - `docs/input-output-example.md`
  - `profiles/mood-profiles.json`
- **Runtime:** not implemented or not primary yet
- **Next:** mood profile validation / simple ambient player design later

### hazama / archive candidates

- **hazama**: visual / conceptual reference only
- **chill**: archive candidate
- **namima-lab**: namima staging or archive candidate
- **test**: archive candidate unless reactivated intentionally

## 3. Shared rules

- no audio files
- no samples
- no lyrics
- no copyrighted content
- no dependency additions unless intentionally approved
- no GitHub Actions changes
- no `engine.js` changes in docs/schema PRs
- runtime code is copied only after review, never blindly
- references are production translations, not copying targets

## 4. Shared schema concepts

- **reference profile**: `timbre / rhythm / space / structure / gesture`
- **groove profile**: `vocal / bass / guitar / section / style` → `drum feel`
- **mood profile**: `brightness / warmth / water_motion / garden_air / density / loudness_safety` → `ambient feel`

## 5. 5.3 work queue

Codex 5.3 で安全に実施するもの:

- docs cleanup
- README links
- JSON schema drafts
- validator docs
- archive notices
- profile additions
- non-runtime planning

## 6. 5.5 high/xhigh work queue

5.5 high/xhigh 以降で行うもの:

- Music `engine.js` audio tuning
- m4a recording review interpretation
- Tone.js graph changes
- actual drum-floor generator runtime
- namima ambient runtime
- cross-repo architecture synthesis
- preset translation into runtime parameters

## 7. Suggested next PRs

- Music: `docs: add preset translation schema`
- drum-floor: `docs: add JSON schema for groove profiles`
- namima: `docs: add JSON schema for mood profiles`
- Music: `docs: add cross-repo synthesis prompt for 5.5`
- Later: Music engine tuning only after fresh m4a recording review

## 8. 5.5 synthesis prompt seed

```text
Read Music docs, drum-floor docs, namima docs, and hazama status. Produce a unified music-stack architecture, next 10 PRs, shared schema map, and separation rules. Do not merge runtimes blindly. Prioritize Music runtime stability, drum-floor groove specialization, and namima public-friendly safety.
```

## 9. Current state summary

- Music stack phase 1 completed:
  - repo roles fixed
  - reference docs added
  - groove profile schema added
  - mood profile schema added
  - archive/reference notices added
- next phase:
  - schema validation and controlled runtime planning

