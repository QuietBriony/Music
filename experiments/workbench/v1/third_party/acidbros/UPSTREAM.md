# acidBros snapshot

- Upstream: https://github.com/acidsound/acidBros
- Source commit: `f0b348a7a641f76689b8ca97f3c1e4b90ab9c44e` (v153, 2026-05-02)
- Upstream README license declaration: MIT License
- Maintainer attribution: acidsound / acidBros contributors
- Included: `index.html`, `js/`, `css/`, icons, font, favicon, and four TR-909 WAV files.
- Omitted: upstream PWA service worker/manifest, screenshots, documentation, and development dependencies.
- Local `index.html` changes: no service-worker registration, no viewport zoom blocking, no links to omitted screenshots, and `lang=en`.
- Local `js/ui/UI.js` change: MIDI access is requested from Settings > Refresh rather than on page load.
- Local whitespace-only cleanup: trailing spaces in `TR909.js`, `UnifiedSynth.js`, and `MidiManager.js`.

The four WAV files total **438,798 bytes**. Their SHA-256 hashes are:

| File | SHA-256 |
| --- | --- |
| `cr01.wav` | `2a18ced6f0ace2f8e3aa035a36767f6a675a90a8429d3550be24ac597467ee5b` |
| `hh01.wav` | `6b737acdd4e9db504dc8225c613ae72fb9b67c2e493b011c50750e16c708e9bd` |
| `oh01.wav` | `40cdd1489d5d6af8ca7d57bae78c2fd2be97fb392d4eaaf0c9317f05fe09b83e` |
| `rd01.wav` | `bafd8dcb23d81433534337c1b0b3ad33b0631eca501519ae1ed7fe80525bbcda` |

This is a pinned local snapshot. An upstream update requires inspecting its code/assets, refreshing this notice, testing the embedded player on desktop/mobile, and deploying a new Music commit. It does not update automatically.
