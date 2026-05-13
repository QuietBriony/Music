# Band Room — Changelog (v65 → v79)

Cache marker: `band-room.{html,js,css}?v=br-NN` and `sw.js VERSION = hazama-fm-vNN`.
The two are bumped together — sw VERSION matches the band-room generation it ships.

---

## v79 — keyboard shortcuts

- `space` play/stop · `[` `]` prev/next section · `1..9` jump · `m` toggle stems/AI mode
- Skipped when focus is on text inputs / textarea / select, or modifier keys held
- Footer hint chip shows the bindings in `<kbd>`

## v78 — localStorage persistence

- Key `band-room.prefs.v1`: bandId / songId / mode / kitSource / all range sliders / all checkbox toggles
- Debounced 400ms writes on `input` + `change` anywhere in `#br-main`
- Restored on `DOMContentLoaded` after the bands registry loads — selectors and handlers re-fire

## v77 — spectrum analyzer

- `Tone.FFT` size 64, smoothing 0.65, tapped off `masterLimiter`
- 280×36 canvas in transport, shares the master-meter RAF
- Bins color-tinted by band (bass 14°, mid 22°, high 28°)

## v76 — practice tempo slider (50–120%)

- Multiplier on `Tone.Transport.bpm.rampTo(baseBpm × mult, 0.4)`
- Also adjusts `Tone.Player.playbackRate` on stems (acknowledged pitch shift — warned in UI)
- Applied at `startPlayback` and `startStemPlayback` so re-start at 80% stays at 80%

## v75 — clickable section nav with stem seek

- Chips under transport, one per `structure[]` entry
- `jumpToSection(idx)` sums bars × `(60/bpm × 4)` → `Tone.Transport.seconds = targetSec`
- Re-seeks every stem player via `player.start("+0.05", targetSec)` — `loop:true` keeps wrapping

## v74 — cross-app mastering propagated to Hazama FM

- `engine.js` master chain: `masterGain → masterComp (-10 dB, 2:1) → masterWidener (0.62) → masterLimiter`
- Conservative settings; FM ambient softness preserved
- `engine.js?v=fm-55`, `sw VERSION = hazama-fm-v74`

## v73 — lyric blocks with section-synced highlight

- Markdown lyrics parsed into per-`[marker]` `<div class="br-lyric-block" data-marker="slug">`
- `updateLyricsHighlight(sectionName)` slug-matches the current section, scrolls into center, dims others
- Fuzzy fallback: `chorus-2 → chorus`

## v72 — phrase trigger 3-mode

- ⚡ 即発火 (default, instant) · ⏱ 次小節 (`Tone.Transport.nextSubdivision("1m")`) · 🔁 ループ
- Loop mode toggles per phrase: click again to stop and dispose
- Multiple phrases can loop simultaneously, each in its own player

## v71 — stem crossfade + master RMS meter

- `Tone.Player` fadeIn 0.005→0.15, fadeOut 0.02→0.30
- Track-button handler awaits 320ms after `player.stop()` before disposing — audible crossfade on song change
- `Tone.Meter` (smoothing 0.75) → 4px bar in transport, color shift accent → accent-soft @ -12 dB → red @ -3 dB

## v70 — AI 再現 polish (chorus / auto-pan / drive)

- `makeGuitar`: `Tone.Chorus` (0.9 Hz, depth 0.38, wet 0.34) before distortion
- `makeChordSynth`: `Tone.Chorus` + `Tone.AutoPanner` (0.18 Hz, depth 0.32) for slow LR drift
- `makeSynthBass`: post `Tone.Distortion` (0.08, wet 0.45) + LP filter for grit

## v69 — AI 再現 stereo placement

- `makeSampledKit`: per-voice `Tone.Panner` (kick 0, snare -0.06, hat +0.22, ghost -0.16, fill +0.12, crash +0.20)
- `ensureMaster`: per-bus panners — guitar -0.25, chords +0.20, others center
- Stems mode untouched — original mix integrity preserved

## v68 — don't stop mid-song

- `Tone.Player loop:true` on stems — practice/jam sessions don't go silent at song end
- `scheduleBar`: structure end wraps `sectionIdx = 0` instead of `stopPlayback()`
- `visibilitychange` listener calls `Tone.context.resume()` when tab returns visible — fixes mobile freeze

## v67 — UI simplify

- 16+ top sections collapsed into 6 core + 6 `<details>` (vocal FX / external / phrase / kit / volume / mastering)
- Non-active mode is `display:none` instead of dim — half the UI evaporates per mode

## v66 — mastering chain

- Per-stem EQ via `makeStemEQChain` (drums HP/EQ3, bass HP+LP, vocals HP+presence+de-esser, other HP+air)
- Two-stage master comp (gentle leveler + glue), `Tone.StereoWidener`, parallel tape sat
- New sliders: tape warmth (0–40 → wet send), loudness (-12..+6 dB → master gain)

## v65 — real drum pattern extraction

- `_extract_drum_patterns.py` rewrites all 7 Tabasco `drum-frames-*.json` from the actual stems
- librosa onset detect + band-energy classification (sub/low/mid/snap/high) + 16th-quantize
- Each frame's `events[]` reflects what the original drummer played, not a 4-on-floor template
- New `auto-self` kit source = current song's own drums

---

## Keyboard cheat sheet (v79)

| key       | action                                    |
|-----------|-------------------------------------------|
| `space`   | play / stop                                |
| `[`       | previous section (jumps audio + lyrics)   |
| `]`       | next section                              |
| `1..9`    | jump to section index (1-based)           |
| `m`       | toggle stems ↔ AI 再現 mode               |

Skipped when typing in form fields or holding Ctrl/Cmd/Alt.
