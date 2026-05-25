# test style archetype translation

Status: reference-only / docs-only

## Purpose

`test/engine.js` is an archive source, not an active Music runtime.

This note translates its four style archetypes into Music's current
reference-gradient language so the idea can be reviewed without copying code,
adding samples, changing runtime behavior, or adding a new visible style fader.

The companion reference file is
[`../references/style-archetype-from-test.json`](../references/style-archetype-from-test.json).

## Source posture

- source repo: `test`
- source file: `test/engine.js`
- source concept: four adjacent archetypes blended by a normalized style value
- adopted here: concept, numeric metadata, translation vocabulary
- not adopted here: runtime code, UI, samples, dependencies, stochastic groove
  behavior

This is a translated harvest record. It is not a claim that `test` is an
official Music standard.

## Archetype mapping

| Source archetype | Source shape | Music fit | Status |
|---|---|---|---|
| Ambient | 86 BPM, no distortion, sparse kick, no snare | ambient pill: haze / void / restraint | Adopted as concept |
| Lo-Fi | 80 BPM, swing 0.3, light distortion, lazy kick/snare/hat pattern | lofi pill: dust / swing / organic memory | Adopted as concept |
| Goa | 148 BPM, low swing, medium distortion, dense pulse | techno pill partial: pulse / chrome / grid | Deferred |
| HardTechno | 165 BPM, high distortion, dense kick/hat pressure | reference-only boundary marker | Rejected as public baseline |

## Translation notes

Ambient and Lo-Fi are immediately useful as language for Music's existing
ambient and lofi pills. They describe pressure, density, swing, and haze without
requiring a new control surface.

Goa is useful as a harder pulse/chrome reference, but it does not map cleanly to
the current public pill set. It stays deferred unless a later human review wants
a trance/acid-adjacent sub-mode.

HardTechno is valuable mostly as an upper boundary. Its BPM and distortion are
too high-pressure for Music's current default public-facing identity, so it is
kept as reference-only and not promoted into a baseline.

The source's `kick808` / `kick909` numbers are not adopted literally. Music does
not store samples here; those values are only read as low/high pressure hints.

## Adopted / Deferred / Rejected

| Element | Status | Reason |
|---|---|---|
| Ambient archetype | Adopted concept | Fits ambient pill restraint, low pressure, and sparse density |
| Lo-Fi archetype | Adopted concept | Fits lofi pill swing, dust, and memory pocket |
| Goa archetype | Deferred | Useful harder pulse reference, but not a current public pill |
| HardTechno archetype | Rejected as public baseline | Too hard as a default; keep only as a boundary marker |
| 0..100 style fader UI | Rejected | Music remains pill-based; no new visible fader from this harvest |
| 16-step probability vectors | Deferred to drum-floor | BL-019c owns probability interpolation as groove grammar documentation |
| `Math.random() < prob` runtime gate | Rejected for Music | No runtime wiring in this PR; stochastic groove belongs in a separate decision |
| 808/909 sample mix | Rejected | Music repo stores no samples; Tone.js synthesis remains the rule |

## Future review gates

- human review of whether Goa should remain deferred
- separate drum-floor BL-019c note for probability-vector interpolation
- separate runtime proposal before any Music morph control, bias wiring, or new
  public mode

Until those gates happen, this remains a reference shelf item, not a shipped
runtime behavior.
