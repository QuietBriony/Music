# acidBros snapshot

- Upstream: https://github.com/acidsound/acidBros
- Source commit: `f0b348a7a641f76689b8ca97f3c1e4b90ab9c44e` (v153, 2026-05-02)
- Upstream README license declaration: MIT License
- Maintainer attribution: acidsound / acidBros contributors
- Included: `index.html`, `js/`, `css/`, icons, font, favicon, and four TR-909 WAV files.
- Omitted: upstream PWA service worker/manifest, screenshots, documentation, and development dependencies.
- Local `index.html` changes: no service-worker registration, no viewport zoom blocking, no links to omitted screenshots, and `lang=en`.
- Local `js/ui/UI.js` change: MIDI access is requested from Settings > Refresh rather than on page load.
- Local `js/main.js` / `js/workbench-bridge.js` change: same-origin, explicit FILE selection and one-shot BPM transfer for the parent workbench; a selected local FILE can also open full-page via `?file=`. This bridge never starts transport or converts patterns.
- Local whitespace-only cleanup: trailing spaces in `TR909.js`, `UnifiedSynth.js`, and `MidiManager.js`.
- Local `index.html` / `js/main.js` integration (2026-10-12): first-party `src/machine-rack/` is copied to `js/workbench-rack/` at build time. `?rack=1` exposes three cards over the existing Data/UI/AudioEngine; the original screen remains available. The adapter reuses the original randomizer with temporary unit locks, preserves current levels and offers a pattern-scoped return point. Tone faders write the original knobs/settings and FILE schema is unchanged. The bridge emits a local UI-refresh event after parent commands. No upstream synthesis or clock code is replaced.

The four WAV files total **438,798 bytes**. Their SHA-256 hashes are:

| File | SHA-256 |
| --- | --- |
| `cr01.wav` | `2a18ced6f0ace2f8e3aa035a36767f6a675a90a8429d3550be24ac597467ee5b` |
| `hh01.wav` | `6b737acdd4e9db504dc8225c613ae72fb9b67c2e493b011c50750e16c708e9bd` |
| `oh01.wav` | `40cdd1489d5d6af8ca7d57bae78c2fd2be97fb392d4eaaf0c9317f05fe09b83e` |
| `rd01.wav` | `bafd8dcb23d81433534337c1b0b3ad33b0631eca501519ae1ed7fe80525bbcda` |

This is a pinned local snapshot. An upstream update requires inspecting its code/assets, refreshing this notice, testing the embedded player on desktop/mobile, and deploying a new Music commit. It does not update automatically.

## Optional Strudel host connection (2026-10-12)

`AudioEngine.js` exposes its output gain, delegates transport/tempo only when `externalTransport` is set, and accepts host ticks without starting its own clock. Worklet URLs are relative to the module, so a parent-owned AudioContext resolves them correctly. Standalone scheduling is unchanged. First-party `workbench-rack/link.js` shares the parent's context and drives the original `handleTick`/voices, disconnects retired voice buses on Stop, reuses the decoded drum bank, and never closes the parent context. The original voice algorithms, randomizer, four WAVs and FILE format are retained.

The original full-page rack can carry its unsaved encoded state, selected pattern and unit locks through one-use sessionStorage into the same-origin host. `workbench-bridge.js` validates this transfer before native import; no FILE is overwritten or content published. The host adds silent clock pulses to its Strudel scheduler. This is an opt-in audio/clock link, not score conversion or free cable routing.

## Combined session saves and drum visibility (2026-10-12)

First-party `machine-state.js` wraps the unchanged full FILE codec with validated exact 303 tone values, selected pattern, locks, candidate tracks, mode, swing and keep-sound setting. The host stores this snapshot and mix level beside the original Strudel code in its existing draft shelf. Restore decodes before applying, stops playback, rolls back failures and detaches the current FILE identity without overwriting existing FILE records. Combined JSON backups use schema 2; code/FILE-only backups retain schema 1. The rack adds a deterministic four-part drum pattern and per-track hit/level/candidate visibility over the same eleven voices. The randomizer and voice algorithms remain unchanged; original cymbal variation may include a cymbal outside the selected candidates. No audio, dependency or hosting additions.
