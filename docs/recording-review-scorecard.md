# Music Recording Review Scorecard (v2)

## Purpose

This is the human-gated scorecard for reviewing a **Music (conductor) recording
pass** — a recorder / OUTPUT capture of the self-running mix, Pad, Bandroom, MIC
FOLLOW, or Hazama FM color layer.

The house habit (namima, chill, drum-floor) is that each surface improves through
listening notes, not through louder / denser / more-impressive output. Music has
scorecards for its **siblings** but never had one for its **own** conductor
surface. This doc fills that gap.

Its distinguishing job: put the **machine self-review** and the **human ear**
side by side on the same five axes, so disagreement between them becomes the
evidence that drives the next tuning PR. It is metadata-only and stores no audio,
samples, lyrics, or copied motifs.

> **Not a runtime doc.** Filling this scorecard changes nothing at runtime. The
> machine numbers come from the read-only packet `self_review` block; the human
> numbers are typed by a person. No agent may fill the human column or promote a
> score into an `engine.js` change (see Human gates).

## Why "v2" (v1 → v2 delta)

There was no standalone Music scorecard file before this one. The implicit "v1"
review habit was two disconnected halves:

- **machine half** — the packet `routing.openclaw.self_review` numbers
  (`audio/music-packet.js:354`), schema `music.self-listening-review.v1`
  (`engine.js:4445`), read but never scored against ears.
- **human half** — ad-hoc listening notes and the cross-repo pass in
  `docs/cross-repo-listening-review-round.md`, written in prose with no fixed
  axes and no link back to the machine numbers.

**v2 adds the bridge between the two halves.** It (a) fixes five human 1–5 axes
that line up 1:1 with the machine axes, (b) normalizes the machine numbers to the
same "5 = good" polarity so the two columns are directly comparable, and (c)
defines a reconciliation step whose output is a machine-ingestible
`review-result` block. v2 does **not** replace the machine `self_review` schema
or the cross-repo round guide — it sits on top of them.

## The five axes (machine ↔ human map)

The machine axes do **not** share a polarity. Three are **risks** (lower is
better) and two are **scores** (higher is better). The scorecard normalizes every
machine axis to a `machine_health` in `0..1` where **1 = good**, so it can be
read against a human 1–5 where **5 = good**.

| # | Axis | Machine key (`self_review`) | Machine polarity | `machine_health` | Human question (score 1–5, 5 = good) | Watch for |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | density | `densityRisk` | risk (high = crowded) | `1 - densityRisk` | Does the mix leave enough space, or is it piling up events? | wall-of-sound, no rests, layers fighting |
| 2 | low end | `lowEndRisk` | risk (high = boomy) | `1 - lowEndRisk` | Is the low end clean and controlled, not muddy or pumping? | boom, rumble, sub build-up, pumping |
| 3 | brightness | `brightnessRisk` | risk (high = harsh) | `1 - brightnessRisk` | Are the highs / transients comfortable, not harsh or fatiguing? | ice-pick highs, spiky transients, sizzle |
| 4 | restraint | `restraintScore` | score (high = restrained) | `restraintScore` | Does it hold back tastefully instead of over-producing? | busy gestures, constant motion, no patience |
| 5 | reference fit | `referenceFit` | score (high = on-reference) | `referenceFit` | Does it land on the intended reference gradient / genre feel? | generic haze, drifted off-reference, characterless |

Machine `nextSuggestion` (advisory only) resolves in this order
(`engine.js:4472`): `thin-low-end` when `lowEndRisk > 0.72`, else `add-space`
when `densityRisk > 0.74`, else `soften-transients` when `brightnessRisk > 0.76`,
else `let-reference-morph-speak` when `referenceFit < 0.34`, else
`allow-one-signature` when `restraintScore > 0.72` and `densityRisk < 0.46`, else
`listen`.

## Review flow

1. Serve Music and open the surface under review (Core Rig `index.html`,
   `fm.html`, or `band-room.html`).
2. Do one honest listening pass. If judging OUTPUT / recorder behavior, capture a
   recorder pass so `recorder_duration` and `output_level` are meaningful.
3. Snapshot the **machine** column without editing it: read
   `window.MusicSessionPacket.last?.routing?.openclaw?.self_review` (or build one
   via `window.MusicPacketKit.buildMusicSessionPacket()`), and copy the five
   numbers + `nextSuggestion` into the session block below.
4. Type the **human** column: score each of the five axes 1–5 by ear.
5. Do the reconciliation step (below) for each axis.
6. Turn only the reconciled findings into the next small, reversible PR.

## Listening note + score template

```text
# session context (machine, read-only)
surface:            index.html | fm.html | band-room.html
mode:               (packet.mode)
output_level:       (packet.output_state.output_level, %)
recorder_duration:  (packet.output_state.recorder_duration, s)
self_review.schema: music.self-listening-review.v1
nextSuggestion:     (packet.routing.openclaw.self_review.nextSuggestion)

# axis-by-axis
                    machine_raw   machine_health   human(1-5)   agree?   note
density             densityRisk=  1-raw=           _            _
low_end             lowEndRisk=   1-raw=           _            _
brightness          brightnessRisk= 1-raw=         _            _
restraint           restraintScore= raw=           _            _
reference_fit       referenceFit=  raw=            _            _

what worked:
what felt intrusive:
biggest machine/human gap (axis + direction):
next small PR candidate:
```

## Reconciliation (the point of v2)

For each axis, convert the human 1–5 to the same 0–1 scale as `machine_health`:

```text
human_health = (human_score - 1) / 4      # 1->0.0, 3->0.5, 5->1.0
gap          = machine_health - human_health
```

- **Agree** (`|gap| ≤ 0.25`): machine and ear point the same way. No action from
  this axis.
- **Machine over-cautious** (`gap ≤ -0.25`): machine health low but ear says fine
  (e.g. high `lowEndRisk` but the bass feels great). Candidate: the machine axis
  threshold / weight is too aggressive.
- **Machine under-reporting** (`gap ≥ 0.25`): machine health high but ear says bad
  (e.g. low `densityRisk` but the mix feels cluttered to a human). Candidate: the
  machine axis is missing a fatigue the ear hears — the higher-value fix.

The reconciliation does **not** tune anything. It names *which* machine axis
diverged and in *which* direction. Tuning the `self_review` weights / thresholds
or the `SelfReviewGovernor` lives in `engine.js` (frozen) and is a separate,
human-gated PR (see BL-024 measurement lane for the harness that would verify it).

## Machine-ingestible output (`review-result`)

A completed scorecard may be recorded as a `review-result` packet
(`docs/music-orchestra-protocol.md` names this type). It is metadata-only and
carries no promotion authority. Shape:

```json
{
  "version": "music.recording-review-scorecard.v2",
  "source_repo": "Music",
  "surface": "fm.html",
  "created_at": "<ISO8601>",
  "session_context": {
    "mode": "reference_gradient",
    "output_level": 0,
    "recorder_duration": 0,
    "self_review_schema": "music.self-listening-review.v1",
    "next_suggestion": "listen"
  },
  "axes": {
    "density":       { "machine_raw": 0.0, "machine_key": "densityRisk",   "machine_health": 0.0, "human_1_5": 0, "gap": 0.0, "verdict": "agree|machine-over-cautious|machine-under-reporting" },
    "low_end":       { "machine_raw": 0.0, "machine_key": "lowEndRisk",    "machine_health": 0.0, "human_1_5": 0, "gap": 0.0, "verdict": "agree" },
    "brightness":    { "machine_raw": 0.0, "machine_key": "brightnessRisk","machine_health": 0.0, "human_1_5": 0, "gap": 0.0, "verdict": "agree" },
    "restraint":     { "machine_raw": 0.0, "machine_key": "restraintScore","machine_health": 0.0, "human_1_5": 0, "gap": 0.0, "verdict": "agree" },
    "reference_fit": { "machine_raw": 0.0, "machine_key": "referenceFit",  "machine_health": 0.0, "human_1_5": 0, "gap": 0.0, "verdict": "agree" }
  },
  "next_pr_candidate": "",
  "safety": {
    "metadata_only": true,
    "stores_audio": false,
    "stores_samples": false,
    "stores_lyrics": false,
    "human_review_required": true
  }
}
```

`machine_health`, `gap`, and `verdict` are derived by the formulas above; the
`human_1_5` and `next_pr_candidate` fields are typed by a person.

## Acceptance guidance

A recording pass is **ready to route onward** only if:

- density, low_end, and brightness all score ≥ 3 by ear, and
- no axis has a `machine-under-reporting` verdict left unexplained, and
- reference_fit ≥ 3 or the drift is intentional and noted.

A pass should be **revised or split** if:

- any risk axis (density / low_end / brightness) scores ≤ 2 by ear,
- restraint scores low while density scores low too (over-producing quiet space),
- a `machine-under-reporting` gap appears on the same axis across two passes
  (the machine model has a real blind spot → escalate to the measurement lane),
- the recording only sounds good at one output level.

## Human gates

- A person types the human 1–5 column and the `next_pr_candidate`; no agent fills
  them.
- No scorecard result auto-promotes into a runtime / `engine.js` change.
- `self_review` weight / threshold / governor tuning is a separate human-gated PR.
- Recorder captures used for review stay local; no audio / sample / lyric is
  stored in the repo or in any cross-repo packet.

## Storage boundary

Allowed to store (local metadata only): surface, mode, output_level,
recorder_duration, the five machine numbers, human scores, verdicts, reviewer
notes. Disallowed: audio files, samples, waveform excerpts, lyrics, copied
melodies, external tracking without explicit approval.

## References (source of truth)

- Machine axes + polarity + thresholds: `engine.js:4445`
  (`musicSelfReviewRuntimeState`, schema `music.self-listening-review.v1`).
- Packet emission of the five axes: `audio/music-packet.js:354`
  (`routing.openclaw.self_review`).
- Cross-repo listening pass (when to review which repo):
  `docs/cross-repo-listening-review-round.md`.
- Sibling scorecards (house style this doc matches):
  `namima/docs/ambient-listening-scorecard.md`,
  `chill/docs/listening-score-review.md`.
- Packet / review-result contract: `docs/music-orchestra-protocol.md`,
  `docs/schema/music-session-packet.schema.json`.
- Measurement lane that would verify any resulting tuning: BL-024 in
  `docs/autonomy/BACKLOG.md`, `docs/HAZAMA-FM-MEASUREMENT.md`.
