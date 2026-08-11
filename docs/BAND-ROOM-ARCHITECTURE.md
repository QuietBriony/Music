# Band Room — Architecture Map

One-page orientation for `band-room.js` (single IIFE; line count is intentionally not pinned). For the change
log see `BAND-ROOM-CHANGELOG.md`; for the audio-perf rules see
`AUDIO-COST-INVARIANTS.md`; for FM-side hand-offs see `CODEX-HANDOFF.md` (BL-028).

## What it is

A PWA (`band-room.html` + `band-room.js`) for Tabasco practice and HAZAMA 01/02
original-stem / AI-recreation comparison.
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
  no started LFOs). The shared master / stem graph is built **once and shared**, so its
  audio-cost gating MUST key on **device, never `currentMode`** (the v353 bug). The
  AI-only `instrumentBus` may additionally use dense-song layer safety because stems bypass it.
  See `AUDIO-COST-INVARIANTS.md`.
- **Dense-song layer safety** — `aiLayerLightRuntimeEnabled()` adds a layer-only tier for
  HAZAMA songs carrying both `arp` and `bassline`. It keeps the shared master device-gated,
  uses the lean AI-only instrument polish route plus checked-in local drum one-shots, and
  prevents START from building the full multi-oscillator band before the dual 16-step
  sequencers begin. `?aiLight=0` explicitly overrides it for diagnostics.
- **Playback health watchdog** (`startPlaybackHealthWatchdog`, 2.5 s) recovers from a
  genuine suspend, but **debounces** transient iOS non-"running" context reads (≥2
  consecutive bad ticks) so it doesn't hard-restart the stems every tick (the v357
  iPhone stutter). Override light mode for testing with `?aiLight=1`.

## Contract / entry points

- One IIFE wrapper; module `state` object near the top; `window.BandRoomTestHooks`
  exposes `BANDROOM_APP_VERSION`, prefs migration, etc. — the **test/gate contract**, so
  keep it stable across refactors.
- Runtime song registry and catalog duration come from `presets/bands.json`; per-song BPM / key / structure comes from
  `presets/drum-frames-tabasco-{songid}.json`; final lyrics come from
  `docs/tabasco-lyrics-final.md` for canonical / synth / fallback text. Stems mode can overlay
  ASR-derived timestamps / lines from `docs/tabasco-lyrics-timed.json` for 5 songs.
- The hardcoded Tabasco registry used only when `bands.json` fails is an emergency mirror, not
  another authority. BL-042 keeps its three paths (`stems_dir`, `drum_frames_pattern`,
  `lyrics_doc`) and all 7 ordered `{ id, track, title }` rows exactly aligned with the registry.
- Timed lyrics are limited to the 5 ASR-backed vocal songs. Their timestamps must be finite,
  non-negative, strictly increasing, and no later than each registry `duration_s`; TABASCO and
  Electric Sheep intentionally use the final-sheet fallback instead.
- `presets/tabasco-songs.json` v2 is a metadata-only **derived inventory**. Runtime code does
  not fetch it and the Service Worker does not precache it. Its BPM / key status remains
  `human_unverified`; asset provenance remains the BL-035 owner decision.
- Effective playback duration is the maximum of registry duration, loaded stem buffers, and
  frame structure duration; catalog `duration_s` alone does not truncate a longer source.
- Tabasco stems resolve from the selected band registry entry (normally
  `presets/tabasco-stems/{songId}/{stem}.mp3`).

## Versioning (three number systems — bump the right one)

| Marker | Where | Meaning | Bump when |
|---|---|---|---|
| `BANDROOM_APP_VERSION` `br-NN-tag` | band-room.js | band-room app/runtime lineage | band-room.js runtime change |
| `?v=br-NN` | band-room.html + sw.js precache | per-asset cache buster | the asset content changes |
| `hazama-fm-vNNN` | sw.js `VERSION` | **shared** SW cache epoch (band-room **and** FM) | any user-facing asset change |

- **Dev-only / infra changes** (gate scripts, docs, dead-code) take **no version bump**.
- The `hazama-fm-vNNN` counter is **shared with the FM workstream** → parallel sessions
  collide on it. Always fetch before a shared update; on collision, stop, compare both
  changes, reserve the next unused number, rebase, and rerun every gate. Never discard a
  concurrent change merely because its number is lower. Gate: `check-sw-version-history`
  (dup-detection + sw==latest).

## Integrity gates (run `node scripts/stack-check.mjs` for all)

`check-band-room-logic.mjs` (band-room invariants incl. G-4 dispose-coverage, emergency fallback
parity, and exact timed-lyrics ID / timeline bounds),
`check-tabasco-songs-catalog.mjs` (7-song registry / frame / lyrics / path / delivery drift),
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
