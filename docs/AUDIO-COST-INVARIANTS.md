# Audio-Cost Invariants — MUST NOT REGRESS

These four rules are the hard-won result of the 2026-06-13 audio-thread-overload work
(band-room v352–v358) plus the iPhone periodic-stutter fix. Cheaper models and parallel
sessions keep building on this stack — these invariants are what stops the fixes from
being silently undone. The machine-readable twin is `scripts/check-audio-cost-gates.mjs`
(WARN-only first release; flips to FAIL for band-room once burned down). FM-side instances
are owned by the FM workstream and tracked in `docs/CODEX-HANDOFF.md` (BL-028).

## Background: why this is a class of bug

Any Web Audio node transitively connected to the destination is processed **every audio
quantum**, whether or not it has signal. So an always-on convolution `Tone.Reverb`, an
`oversample: "2x"/"4x"` `Tone.Distortion`, or a started LFO is a *standing* CPU cost.
Stack enough of them and the audio thread underruns → playback drops out. On phones this
happens far sooner than on desktop. Worse, nodes that aren't torn down on a mode/state
switch keep costing after they should be gone, so an AI-mode synth band bled dropouts
into 原音 (real-stems) mode (v352/v354). Measured: the always-on FX set rendered **2.27×**
the cost of a lightened version.

## The four invariants

1. **Gate audio cost on DEVICE, never on `currentMode`.**
   The master/buses are built **once** and shared across modes. Gating their cost on
   `currentMode === "synth"` froze wrong: 原音 (the default mode) on phones got the heavy
   master for the whole session (the v353 bug). Gate on `aiLightRuntimeEnabled()` /
   `isMobileOrStandaloneRuntime()` for anything built once.

2. **No always-on HEAVY node on a path reachable on light runtime.**
   Convolution `Tone.Reverb`/`Convolver` and `oversample: "2x"/"4x"` are the proven
   overload primitives (v345 guitar reverb + v347 drum reverb + the polish/stem-master
   oversampled distortions were the v352/v355 culprits). On phones, prefer a
   `FeedbackDelay`-based "room", `oversample: "none"`, or a render-time/baked effect.
   The full (desktop) variant may keep them — gate the heavy branch behind the device check.
   The shared **master reverb + master tape-sat** device tier is now structurally locked by
   `scripts/check-band-room-logic.mjs` (statement-level, so it catches an ungating the ±6-line
   window in `check-audio-cost-gates.mjs` cannot — see that gate's blind-spot note).

3. **Dispose the synth band on AI→原音 switch.**
   Releasing held notes is not enough — the nodes (and their always-on FX) linger
   connected to `masterGain` and keep processing. Dispose/disconnect on mode exit
   (`scheduleSynthBandTeardown`, v354); the band lazily rebuilds on switching back.

4. **Don't treat a transient iOS `context.state !== "running"` as a real suspend.**
   iOS Safari intermittently reports the AudioContext non-"running" while foreground +
   audible. A watchdog that reacts immediately by hard `stop()`+`start()`-ing the stem
   players stutters playback every tick (the v357 ~2.5s iPhone stutter). Debounce: cheap
   `resume()` on one bad tick, destructive recovery only after ≥2 consecutive bad ticks.

## Related

- `scripts/check-audio-cost-gates.mjs` — enforces #1/#2 (allowlist a true exception with a
  trailing `// audio-cost-ok: <reason>`).
- The freeze budget (v241/v343) is the complementary *note-trigger / polyphony* budget;
  this doc is the *always-on FX* budget.
- FM territory (engine.js / fm.js / audio/genre-flavor.js) has the same gaps (no
  device-tier gate, stacked per-genre reverbs) — owned by the FM workstream, see BL-028.
