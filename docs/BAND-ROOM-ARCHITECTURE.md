# Band Room — Architecture Map

One-page orientation for `band-room.js` (~9.5k lines, single IIFE). For the change
log see `BAND-ROOM-CHANGELOG.md`; for the audio-perf rules see
`AUDIO-COST-INVARIANTS.md`; for FM-side hand-offs see `CODEX-HANDOFF.md` (BL-028).

## What it is

A PWA (`band-room.html` + `band-room.js`) for practising along to the Tabasco catalog.
Two playback modes, switched by the `#br-mode` radios:

- **原音 (stems)** — the real recording: 4 separated stems (`drums/bass/vocals/other`)
  played as `Tone.Player`s. This is the default mode and the quality reference.
- **AI 再現 (synth)** — a synthesized re-creation (transcribed drum/bass/guitar/chord
  lines + a vowel vocal guide). Built lazily on play.

## Audio graph (both modes sum at `masterGain` → `masterLimiter` @ -1.0 dB)

```
原音:   stem Players → stemEQs(per-stem filters) → vocal FX(chorus/delay/reverb)
                    → stemBus.* → makeStemMasterBus(EQ3 + glue comp + grit + makeup 1.34)
                    → masterGain
AI 再現: drum/bass/guitar/chord → *Bus → *Pan → instrumentBus = makeInstrumentPolishBus
                    (EQ3 → comp → [dry + parallel sat + exciter] → widener → makeup 3.2)
                    → masterGain
         voice (makeVoiceBox) + click → bypass instrumentBus → masterGain directly
shared master: masterGain(1.2) → comp×2 → EQ → widener → tape-sat + room(reverb/delay)
                    → masterLimiter(-1.0 dB)
```

- **Synth factories** (`makeDrumKit`/`makeLightDrumKit`/`makeSynthBass`/`makeGuitar`/
  `makeVoiceBox`/`makeChordSynth`) each return their layer via
  `withChainDispose(markLayerKind(...))` so it tears down cleanly. The synth band is
  **disposed on AI→原音 switch** (`scheduleSynthBandTeardown`, v354) so its always-on
  FX don't bleed into 原音. (Gate: `check-band-room-logic` G-4 dispose-coverage.)
- **Device gating** — `aiLightRuntimeEnabled()` / `isMobileOrStandaloneRuntime()`. Phones
  get *light* variants (FeedbackDelay instead of convolution Reverb, `oversample:"none"`,
  no started LFOs). The master/buses are built **once and shared**, so audio-cost gating
  MUST key on **device, never `currentMode`** (the v353 bug). See `AUDIO-COST-INVARIANTS.md`.
- **Playback health watchdog** (`startPlaybackHealthWatchdog`, 2.5 s) recovers from a
  genuine suspend, but **debounces** transient iOS non-"running" context reads (≥2
  consecutive bad ticks) so it doesn't hard-restart the stems every tick (the v357
  iPhone stutter). Override light mode for testing with `?aiLight=1`.

## Contract / entry points

- One IIFE wrapper; module `state` object near the top; `window.BandRoomTestHooks`
  exposes `BANDROOM_APP_VERSION`, prefs migration, etc. — the **test/gate contract**, so
  keep it stable across refactors.
- Stems load from `presets/tabasco-stems/{songId}/{stem}.mp3` (local, SW-precached).

## Versioning (three number systems — bump the right one)

| Marker | Where | Meaning | Bump when |
|---|---|---|---|
| `BANDROOM_APP_VERSION` `br-NN-tag` | band-room.js | band-room app/runtime lineage | band-room.js runtime change |
| `?v=br-NN` | band-room.html + sw.js precache | per-asset cache buster | the asset content changes |
| `hazama-fm-vNNN` | sw.js `VERSION` | **shared** SW cache epoch (band-room **and** FM) | any user-facing asset change |

- **Dev-only / infra changes** (gate scripts, docs, dead-code) take **no version bump**.
- The `hazama-fm-vNNN` counter is **shared with the FM workstream** → parallel sessions
  collide on it. Always `git fetch` before push; on collision the higher number wins
  (renumber + rebase). Gate: `check-sw-version-history` (dup-detection + sw==latest).

## Integrity gates (run `node scripts/stack-check.mjs` for all)

`check-band-room-logic.mjs` (band-room invariants incl. G-4 dispose-coverage),
`check-js.mjs` (syntax), `check-fm-route-badge.mjs`, `check-runtime-doc-markers.mjs`,
`check-audio-cost-gates.mjs` (G-1/G-2: no ungated always-on heavy node — band-room=FAIL,
FM=WARN→handoff), `check-sw-version-history.mjs` (G-3), `audit.py` (preset/precache/
version consistency; canonical form is **bare** `audit.py`).

## Ownership

- **This workstream**: `band-room.js`, `scripts/check-*.mjs` gates, band-room docs.
- **FM workstream** (don't edit — report via `CODEX-HANDOFF.md`/BL-028): `engine.js`,
  `fm.js`, `fm.html`, `fm.css`, `audio/genre-flavor.js`.

## Standing constraints

- 原音 / `stemBus` / `makeStemMasterBus` are **never touched by AI-mode changes**.
- `masterLimiter` stays at -1.0 dB (headroom).
- Two budgets: the **freeze budget** (v241/v343 — note triggers / `maxPolyphony` ≤ 16)
  and the **always-on FX budget** (`AUDIO-COST-INVARIANTS.md`).
- iOS preview can't be reproduced in the Chromium preview (it keeps the context
  running); verify audio-graph cost via `Tone.Offline` render-timing, not live playback.
