# Codex Composer Workflow For Music Stack

## 1. Purpose

This guide defines how to use Codex CLI v0.129.0 composer, resume, hooks, diff,
plugin, and goals workflows for Music Stack development. "Composer" here does
not mean a music-writing mode. It means a safe orchestration surface for
editing long prompts, separating repo-specific tasks, keeping PRs small, and
producing consistent Return Packets.

`Music` remains the conductor repo. It owns the reference-driven generative rig,
audio review loop, session packet shape, recorder safety, performance pads, and
runtime direction. Codex Composer helps route work from `Music` toward
`drum-floor`, `namima`, `chill`, and `OpenClaw` without turning one repo into an
unsafe all-in-one runtime.

Use Composer for:

- long prompt editing
- branch and PR title hygiene
- forbidden-file checks
- repo separation
- validation block cleanup
- Return Packet standardization
- resuming long Music Stack arcs without losing the safety boundary

Do not use Composer as permission to make unsupervised audio engine mutations,
install dependencies, add assets, or cross-wire runtimes without review.

## 2. Core Operation Model

The default rule is:

```text
1 repo / 1 branch / 1 PR
```

Repo roles:

- `Music`: conductor, audio review, reference gradient, session packet, SYNC,
  recorder, OUTPUT, AutoMix, performance pads, and main experimental runtime.
- `drum-floor`: groove specialist, drum grammar, phrase flow, articulation,
  raw drum candidate generation, and browser drum adapter.
- `namima`: public ambient surface, family-safe mood translation, water/garden
  behavior, and gentle public playback.
- `chill`: harvest/light surface candidate, soft piano/bass/trio ideas,
  compact UI, and simplified macro controls.
- `hazama`: visual and conceptual reference only.
- `OpenClaw` / Umbrel-like surfaces: mission board, promotion plane, optimizer,
  and human-gated control plane.

Human and model roles:

- This chat / GPT-5.5: judgment, audio review, architecture, cross-repo
  direction, and taste decisions.
- Codex: execution, small PRs, validations, branch hygiene, and file-level work.
- Browser/Pagers/local app: smoke checks for UI, recorder, Pages, Start/Stop,
  SYNC, and audio-facing changes.

When a task touches audio behavior, the PR must stay small enough to listen to.
When a task is docs/schema-only, runtime files must stay untouched.

## 3. Composer Usage

### Vim Mode

Use Vim mode for long prompts that include branch names, allowed files, do-not
blocks, validation commands, and Return Packet requirements.

Recommended use:

- enter `/vim` for long Music Stack prompts
- edit the branch name before running
- check `allowed files` and `do not` blocks before approval
- keep Return Packet fields in the prompt
- set a default mode only if it improves repeated workflow

Vim mode is especially useful for preventing a prompt from drifting from
docs-only into runtime work.

### Resume / Fork Picker

Use resume/fork when a multi-day Music Stack arc continues from an older
thread. Before resuming implementation, restate:

- current repo
- current branch
- latest merged PR
- what is still pending
- what files are allowed
- what files are forbidden

Fork when an old thread contains useful context but the next task has a
different repo, branch, or risk profile.

### Raw Scrollback

Use raw scrollback to inspect previous Return Packets, exact validation output,
PR numbers, branch names, and rollback notes. Do not rely on memory for:

- commit hashes
- PR links
- whether `.github/workflows` was touched
- which repo owns a runtime decision
- the last accepted audio review note

### `/ide` Context Injection

Use `/ide` context injection only when the current workspace state matters:

- dirty worktree
- active file set
- unresolved merge state
- local-only docs or examples
- exact branch state before PR creation

Do not use IDE context as a substitute for `git status`, `git diff`, or a
changed-file check.

### Workspace-Aware `/diff`

Run workspace-aware `/diff` before any Return Packet. The diff review should
answer:

- did the PR touch only the allowed files?
- did a docs-only PR avoid `engine.js`, `index.html`, and `style.css`?
- did an audio PR preserve recorder, OUTPUT, Start/Stop, AutoMix, pads, and
  mobile Pages?
- were dependencies, assets, samples, lyrics, or workflows added?
- is the diff small enough to review and roll back?

### Status Line

Use the smarter status line as a wrong-repo guard. Before implementing, confirm:

- repo name
- branch name
- PR status
- whether the branch is ahead/behind
- whether pending local changes already exist

If the status line and prompt disagree, stop and inspect before editing.

### `/keymap` Debug

Use `/keymap` debug only for terminal input issues, especially when Vim mode or
TUI shortcuts behave differently on Surface, SSH, or a terminal multiplexer.

## 4. Recommended Prompt Templates

These templates are compact starting points. Expand the `do not`, validation,
and Return Packet blocks for high-risk tasks.

### Music Audio PR

```text
target repo: QuietBriony/Music
local path: C:\workspace\github-inventory\music-stack\Music
model: GPT-5.5 high / Codex high
branch: feat/music-<short-audio-change>
PR title: feat(music): <short audio change>
allowed files: engine.js, docs/runtime-stability-checklist.md only if useful
do not: add dependencies, audio files, samples, lyrics, workflows; do not break
recorder, OUTPUT, Start/Stop, AutoMix, pads, Pages mobile
validation: node --check engine.js; git diff --check; browser smoke; recording
plan
Return Packet: Branch, Commit, PR, Files changed, Summary, Runtime checks,
Cost safety, Known risks, Rollback, Next recording
```

### Music Docs / Schema PR

```text
target repo: QuietBriony/Music
local path: C:\workspace\github-inventory\music-stack\Music
model: GPT-5.3 or GPT-5.5 high for architecture docs
branch: docs/<topic>
PR title: docs: <topic>
allowed files: docs/**, README.md
do not: touch engine.js, index.html, style.css, workflows, dependencies, audio
files, samples, lyrics
validation: git diff --check; JSON parse if schema changed; changed-files check
Return Packet: Branch, Commit, PR, Files changed, Summary, Added docs,
Policy checks, Validation, Known risks, Rollback, Next suggested PR
```

### drum-floor Groove PR

```text
target repo: QuietBriony/drum-floor
local path: C:\workspace\github-inventory\music-stack\drum-floor
model: GPT-5.5 high for runtime/groove; GPT-5.3 for docs/schema
branch: feat/<groove-change>
PR title: feat: <groove change>
allowed files: keep to adapter/generator/docs/tests relevant to the task
do not: add audio files, samples, lyrics, workflow edits, automatic arm/upload
validation: existing tests; generator/inspect smoke if CLI changed; git diff
--check
Return Packet: Branch, Commit, PR, Files changed, Summary, Groove behavior,
Safety, Validation, Known risks, Rollback, Next PR
```

### namima Ambient PR

```text
target repo: QuietBriony/namima
local path: C:\workspace\github-inventory\music-stack\namima
model: GPT-5.5 high for runtime mood bridge; GPT-5.3 for docs/schema
branch: feat/<ambient-change>
PR title: feat: <ambient change>
allowed files: keep to mood adapter/runtime/docs/tests relevant to the task
do not: add samples, lyrics, heavy dependencies, dark glitch defaults, upload,
workflow edits
validation: runtime smoke, family-safe mood check, git diff --check
Return Packet: Branch, Commit, PR, Files changed, Summary, Mood behavior,
Safety, Validation, Known risks, Rollback, Next PR
```

### Harvest Audit PR

```text
target repo: QuietBriony/Music
local path: C:\workspace\github-inventory\music-stack\Music
model: GPT-5.3 for deterministic docs; GPT-5.5 high for synthesis
branch: docs/<harvest-topic>
PR title: docs: <harvest topic>
allowed files: docs/**, docs/schema/**, README.md
do not: copy runtime code, import assets, add dependencies, touch workflows
validation: git diff --check; JSON parse for schemas; changed-files check
Return Packet: Branch, Commit, PR, Files changed, Summary, Harvest sources,
Policy checks, Validation, Known risks, Rollback, Next suggested PR
```

### OpenClaw Orchestra Docs PR

```text
target repo: QuietBriony/openclaw
local path: C:\workspace\github-inventory\music-stack\openclaw
model: GPT-5.5 high for cross-repo workflow
branch: docs/<orchestra-topic>
PR title: docs: <orchestra topic>
allowed files: docs/**, README/manual files, session examples only if requested
do not: add external token flow, cloud upload, audio storage, workflow edits,
automatic arm/record/push behavior
validation: doctor if relevant; plan/validate for manifest docs if changed; git
diff --check
Return Packet: Branch, Commit, PR, Files changed, Summary, Workflow coverage,
Safety, Validation, Known risks, Rollback, Next PR
```

## 5. Hook Guidance

Hooks should be warnings and checks only. They should not rewrite files,
install packages, push branches, merge PRs, or auto-edit runtime code. Treat
`/hooks`, PreToolUse context, and before/after compaction hooks as context
guards, not as autonomous maintainers.

Safe PreToolUse guardrails:

- warn before editing `.github/workflows`
- warn before adding audio files: `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`,
  `.webm`
- warn before adding a `samples/` directory
- warn before adding `package.json`, `package-lock.json`, `pnpm-lock.yaml`, or
  `yarn.lock`
- warn before dependency install commands
- warn if a docs-only task touches `engine.js`
- warn if an engine task touches unrelated docs/schema heavily
- warn before microphone, upload, external API, cloud, or token-related code

Useful after-task summary:

- changed files
- forbidden changes check
- validation commands and results
- Return Packet draft
- next recording instruction for audio PRs
- rollback command or revert strategy

Useful compaction hook summaries:

- current repo, branch, PR, and latest commit
- allowed files and forbidden files for the active task
- unresolved validation or browser smoke gaps
- whether the task is docs-only, audio runtime, or cross-repo planning
- next exact command or next review step

Do not add hook implementations in Music audio PRs. If hook examples are needed,
add non-executable docs in a separate docs-only PR.

## 6. Plugin Management Guidance

Keep plugins scoped by workspace. Avoid broad access across all Music Stack
repos unless the task explicitly requires cross-repo inspection.

Guidelines:

- use source filtering for `Music`, `drum-floor`, and `namima`
- keep external repo research read-only until promoted by a harvest sidecar
- do not upgrade marketplace plugins inside audio PRs
- do not mix plugin management changes with `engine.js` audio tuning
- avoid giving a plugin write access to unrelated repos
- document why a plugin is needed when it enters the workflow

Plugin upgrades and access changes should be treated as their own operational
PR or manual step, not as part of a production audio change.

## 7. Experimental Goals Guidance

Experimental goals are useful for docs planning, issue decomposition, and
multi-day Music Stack roadmaps. The persistent paused state can help long arcs
such as Orchestra Protocol, harvest workflows, OpenClaw mission board design,
or gradual packet routing.

Use goals for:

- docs planning
- multi-PR roadmaps
- issue decomposition
- review queues
- long-running architecture notes

Avoid goals for:

- unsupervised `engine.js` mutation
- auto-promoting audio changes
- dependency additions
- recorder changes without review
- microphone/upload/cloud code without explicit approval

Human review is required before any goal output becomes a runtime PR.

## 8. Model Routing

- GPT-5.3: docs, README, schema, archive notices, sidecar examples, and small
  deterministic PRs.
- GPT-5.5 high: `engine.js` audio tuning, cross-repo routing, Music to
  `drum-floor` / `namima` runtime bridge, and browser/Pagers smoke workflows.
- GPT-5.5 xhigh: major architecture, longform synthesis, multi-repo evolution
  planning, and high-ambiguity audio direction.
- Claude Code: local read-only audit, file exploration, and independent
  codebase inspection when useful.
- Codex Cloud: docs-only or deterministic small PRs where audio/browser smoke
  is not required.
- Codex App/local: audio engine work, Pages checks, recorder behavior, browser
  smoke, local screenshots, and anything requiring the shared machine.

When in doubt, route toward the safer model and smaller PR.

## 9. Return Packet Standard

Every Music Stack PR should end with a Return Packet. Required fields:

- Branch
- Commit
- PR
- Files changed
- Summary
- Runtime checks
- Cost safety
- Known risks
- Rollback
- Next recording or next PR

Docs-only PRs can replace `Runtime checks` with `Validation`, but they should
still report runtime safety boundaries, especially whether `engine.js`,
dependencies, audio files, samples, and workflows were untouched.

## 10. Music-Specific Safety Boundaries

Music is public Pages runtime and audio engine surface. Preserve:

- no audio files or samples
- no Apple Music audio, preview URLs, raw URLs, copied motifs, or lyrics
- recorder behavior
- OUTPUT slider and master output compatibility
- Start/Stop
- AutoMix
- performance pads
- mobile Pages usability
- background playback behavior
- metadata-only SYNC and packet safety

`engine.js` changes require:

- `node --check engine.js`
- `git diff --check`
- browser smoke
- console error check
- m4a recording plan or listening note
- rollback plan

Public/private cost safety:

- no workflows unless explicitly requested
- no build/install steps inside Music audio PRs
- no heavy dependencies
- no tokens, secrets, uploads, or external API calls without explicit approval
- local `.openclaw-local` and generated candidates stay out of Pages repos

## 11. Example First-Run Workflow

```text
1. Open the Music workspace.
2. Run /vim.
3. Paste the audio or docs PR prompt.
4. Confirm target repo, branch, allowed files, do-not list, and validation.
5. Implement the smallest coherent slice.
6. Run /diff before commit.
7. Validate:
   - node --check engine.js for runtime PRs
   - git diff --check for all PRs
   - JSON parse for schema PRs
8. Create a small PR.
9. Return Packet.
10. For audio PRs, record m4a and feed review notes back to ChatGPT.
```

The important habit is not speed. It is making every change easy to hear,
review, and undo.

## 12. Next Suggested Actions

- Add repo-specific prompt snippets under `docs/prompts/`.
- Add non-executable hook examples in a separate docs-only PR.
- Add a Music Stack Orchestra mission board prompt for OpenClaw.
- Add a lightweight Return Packet checklist for PR descriptions.
