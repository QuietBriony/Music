# Music Stack Orchestra Protocol

## Definition

Music Stack Orchestra is a metadata-only coordination protocol for the
QuietBriony music repos. It lets `Music` act as the musical conductor while
`drum-floor`, `namima`, `chill`, archive repos, and future OpenClaw/Umbrel
surfaces remain separate organs with clear boundaries.

The protocol does not move audio, samples, lyrics, copied phrases, recordings,
or copyrighted material between repos. It moves production intent, session
state, review notes, routing hints, and human-gated promotion requests.

## Repository Roles

- `Music`: conductor and final reference-driven generative rig. It owns session
  intent, reference gradient, UCM state, OUTPUT/recorder review state,
  performance pad state, preset intent, and gesture direction.
- `drum-floor`: band groove generator. It translates groove intent into drum
  pattern, phrase, articulation, fill, ghost note, and candidate metadata.
- `namima`: public-friendly ambient player. It translates safe mood and ambient
  intent into family-safe water, garden, daytime, air, and ripple behavior.
- `chill`: harvest and live trio source. It contributes macro controls,
  piano-like softness, compact UI lessons, cyber-zen mood, and quiet recovery.
- `namima-lab`: staging/archive source for ripple interaction, x-position note
  mapping, PluckSynth texture, and patch selector ideas.
- `test`: archive source for Style Blend, archetype interpolation, and pattern
  probability blending.
- `OpenClaw` / Umbrel-like runtime: mission board, optimizer, promotion desk,
  and human-gated control plane. It should coordinate review, not replace the
  music repos as sound engines.

## Why Music Is The Conductor

`Music` already contains the broadest production context: self-running mix,
reference gradient, gesture map, recorder, OUTPUT, performance pads, UCM state,
and runtime review surfaces. That makes it the correct place to emit session
packets and conductor intent.

Other repos should not copy Music runtime code. They should receive small
packets, sidecar traces, or routing hints and then translate those hints using
their own domain logic.

## Packet, Sidecar, Trace

Cross-repo flow should use three metadata surfaces:

- `packet`: current session intent emitted by Music. Example:
  `music-session-packet.schema.json`.
- `sidecar`: review-only interpretation from another repo or optimizer. It can
  suggest groove, mood, or promotion intent, but it must not overwrite runtime.
- `trace`: local or reviewed session observations. It may include timestamps,
  state summaries, fingerprints, and human notes, but never audio or raw
  private gesture streams.

Direct code copy is a last resort. The preferred path is translation through a
packet or sidecar, followed by a small repo-specific PR.

## Finance To Umbrel Translation

The architecture mirrors the safer parts of a finance-to-Umbrel workflow:

- finance sidecar: review-only market intent.
- music sidecar: review-only production and session intent.
- Umbrel optimizer: orchestra runtime, mission board, review queue, and routing
  dashboard.
- promotion: human-gated evolution from observation to repo-specific PR.

In the music stack, an optimizer may rank or explain suggestions, but it must
not auto-arm live systems, overwrite runtime state, change OUTPUT, start REC,
upload recordings, or promote changes without human approval.

## Promotion Policy

Runtime promotion is human-gated:

- A sidecar may propose an adjustment.
- The proposal must name the target repo and intended effect.
- The proposal must confirm metadata-only provenance.
- A human listens or reviews the result.
- Approved changes become small repo-specific PRs.

No automatic overwriting of live runtime is allowed. OpenClaw/Umbrel may route
missions, but live audio, recording, upload, and merge remain human decisions.

## Data Safety Rules

- `stores_audio` must remain `false`.
- `stores_samples` must remain `false`.
- `stores_lyrics` must remain `false`.
- `metadata_only` must remain `true`.
- `human_review_required` must remain `true`.
- No raw microphone input, audio buffers, recordings, copyrighted excerpts, or
  sample references should be stored in cross-repo packets.
- No `.github/workflows` automation should be introduced by this protocol.

## Runtime Boundary

The protocol defines metadata contracts only. It does not implement a live
runtime, browser transport control, DAW bridge, recorder bridge, or optimizer.
Those belong in later PRs after the packet and routing contract are stable.
