# Hazama FM — Presets JSON Schema

Each sibling repo (`chill`, `drum-floor`, `namima`) owns generation logic
internally and **exports a small portable JSON** that Hazama FM
(`audio/genre-flavor.js`) can load and re-render through Tone.js.

This file is the **contract** — codex sessions in each repo can read it as
the single source of truth.

## Conventions

- All files under `Music/presets/` are static JSON, fetched at runtime.
- Every preset declares `version` (integer) and `format` (string).
- Hazama FM's loader (`presets/loader.js`) **gracefully falls back** to
  hand-coded defaults if the file is missing or fails validation. Never
  ship a "required" field that breaks the player when absent.
- Source-of-truth lives in each repo's `exports/` dir; commit a copy into
  `Music/presets/` only when ready to ship.
- No audio data, no recordings, no samples. Metadata only.

---

## 1. Chill — `chill-piano-recipe.json`

**Owner**: chill repo. Source: `chill/engine.js` `CHILL_RECIPES`.
**Consumed by**: `Music/audio/genre-flavor.js` `buildPiano(recipe)`.

```json
{
  "version": 1,
  "format": "chill-piano-recipe",
  "recipes": [
    {
      "id": "piano-jazz-chill",
      "label": "Quiet Piano",
      "bpm": 66,
      "swing": 0.04,
      "layers": [
        {
          "id": "room-chord-bed",
          "type": "piano",
          "tone": "felt",
          "notes": [["D3", "F3", "A3", "C4", "E4"]],
          "pattern": [0.98, 0, 0, 0, 0.32, 0, 0, 0],
          "duration": ["2n", "1n"],
          "velocity": 0.17,
          "every": 16,
          "probability": 0.9,
          "humanize": 0.026,
          "swingPush": 0,
          "pedal": 0.68,
          "room": 0.58,
          "densityWeight": -0.06
        }
      ],
      "defaultFaders": { "faderA": 0.28, "faderB": 0.2, "faderC": 0.78 },
      "transitionRules": {
        "maxDensity": 0.38,
        "quietOnLateTicks": 3
      }
    }
  ]
}
```

### Field semantics
- `layers[].type` — only `piano` is consumed by Hazama FM today (others ignored).
- `layers[].tone` — `felt` | `glass` | `memory` (informational hint to the renderer).
- `layers[].notes` — array of voicings. Each voicing is an array of notes triggered together.
- `layers[].pattern` — per-step velocity multiplier (0..1). Length = steps per `every` window.
- `layers[].pedal` / `room` — sustain length / reverb wet bias 0..1.

---

## 2. Drum-floor — `drum-frames-{funk,techno}.json`

**Owner**: drum-floor repo. Source: `groove-engine.js` + `groove-profiles.json`.
**Consumed by**: `Music/audio/genre-flavor.js` `buildFunk(frames)` / `buildTechno(frames)`.

```json
{
  "version": 1,
  "format": "drum-frames",
  "genre": "funk",
  "frames": [
    {
      "id": "funk_pocket_bar_0",
      "bpm": 98,
      "swing": 0.08,
      "barLength": 4,
      "role": "settle",
      "events": [
        {
          "instrument": "kick",
          "beat": 0,
          "sub": 0,
          "velocity": 0.72,
          "microMs": -3,
          "role": "anchor"
        },
        {
          "instrument": "snare",
          "beat": 2,
          "sub": 0,
          "velocity": 0.68,
          "microMs": 12,
          "role": "backbeat"
        }
      ]
    }
  ]
}
```

### Field semantics
- `frames[]` — 4–8 single-bar variations. Hazama FM picks one per bar.
- `events[].instrument` — `kick` | `snare` | `hat` | `ghost` | `fill` | `crash`.
- `events[].beat` — 0..3 (quarter), `sub` — 0..3 (16th within the beat).
- `events[].microMs` — timing offset in ms (negative = early, positive = behind).
- `events[].role` — semantic label (e.g. `anchor`, `backbeat`, `timekeeper`); informational.

### Genre conventions
- **funk**: BPM 84–110, snare lag 12–18 ms (behind beat), hat swing high, ghosts dense.
- **techno**: BPM 120–132, kick on every beat, snare lag ≤ 3 ms (forward), 16th hat steady.

---

## 3. Namima — `namima-shape-ambient.json`

**Owner**: namima repo. Source: `audio.js` `MOOD_AUDIO` + `profileToShape()`.
**Consumed by**: `Music/audio/genre-flavor.js` `buildAmbient(shape)`.

```json
{
  "version": 1,
  "format": "namima-ambient-tone-js",
  "presets": [
    {
      "id": "water_day",
      "label": "Water Day",
      "master": 0.72,
      "filter": {
        "lowpass": { "freq": 620, "Q": 0.6 },
        "highpass": { "freq": 320, "Q": 0.5 }
      },
      "reverb": { "decay": 6.5, "wet": 0.18 },
      "shimmer": { "rateHz": 2.0, "wet": 0.08, "feedback": 0.20 },
      "tail": { "delayMs": 125, "wet": 0.07, "feedback": 0.14 },
      "air": { "gain": 0.48, "noiseType": "sine" },
      "pad": {
        "gain": 0.7,
        "baseNote": "C3",
        "attack": 0.6,
        "decay": 0.2,
        "sustain": 0.7,
        "release": 2.6
      }
    }
  ]
}
```

### Field semantics
- `master` — output gain 0..1.
- `filter.lowpass` / `highpass` — Tone.js Filter params (`freq` Hz, `Q`).
- `reverb` — Tone.Reverb (`decay` seconds, `wet` 0..1).
- `shimmer` — Tone.FrequencyShifter or PitchShift cycling at `rateHz`, sent into a delay (`wet`, `feedback`).
- `tail` — Tone.FeedbackDelay (`delayMs`, `wet`, `feedback`).
- `air` — base noise floor gain.
- `pad` — sustained Tone.AMSynth voice with envelope + base note.

---

## Loader contract (Hazama FM side)

`presets/loader.js` exposes `window.HazamaPresets` with:

```js
window.HazamaPresets = {
  async load(name)         // fetch + validate by `format` field
  get(name)                // synchronous lookup of last-loaded preset
  available(name)          // boolean
  fallback                 // hand-coded defaults that mirror the schema
};
```

`audio/genre-flavor.js` calls `await HazamaPresets.load("chill-piano-recipe")`
on first START. If unavailable, `buildPiano()` etc. use built-in defaults.

---

## Validation rules (loader-side)

- Reject if `version` is missing or differs by major number.
- Reject if `format` doesn't match the expected name.
- Warn (but accept) on extra fields the loader doesn't recognize — preserves
  forward compatibility while individual repos extend their schemas.
- Always return a structurally complete object (or `null`) — never throw.
