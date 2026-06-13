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
- `frames[].bpm` / `frames[].swing` — **annotation metadata only; NOT wired to
  playback.** Real tempo comes from `fm.js GENRE_PROFILES[pill].bpm` → DJTempoState
  → engine `rampParam("transport-bpm")`; real swing/feel comes from engine
  `FM_MODE_SWING` (lofi/jazz deliberately `0.0` — see fm-67: triple-stacked delay
  felt wrong, so feel is carried by `microMs`) plus per-event `microMs`. These two
  frame-level fields document the bar's *intended* feel for humans and tools;
  editing them does not change the sound. (Resolved BL-025, 2026-06-13 — declared
  metadata rather than wired, to avoid a second tempo authority fighting `fm.js`.)
- `frames[].barLength` — number of bars the frame represents (informational).
- `frames[].role` — phrase role label (`settle` / `build` / etc.); informational.
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

## 4. Legacy engine presets (NOT Hazama FM)

`presets/` には Hazama FM 用 JSON とは別に **engine.js 直接消費の旧 preset** が残っている:

```
presets/ambient.json
presets/dub.json
presets/jazz.json
presets/lofi.json
presets/techno.json
presets/trance.json
```

これらは Music Core Rig (mixer) で **「AIR / SRC」プリセット選択** から読み込まれ、
engine.js の `applyPresetUCM(preset)` (engine.js:8417 付近) が `preset.ucm` を 9 fader
にロードする用途。Hazama FM の preset 経路 (`window.HazamaPresets` / `genre-flavor.js`)
とは **完全に別系統**。

### 整理ポリシー

- 削除しない (Music Core Rig が必要)
- `loader.js` の `PRESET_FILES` には登録しない (上の 6 ファイル: chill / drum-frames × 4 / namima のみ)
- `sw.js` の precache にも入れない (engine が必要時に fetch、stale-while-revalidate 対象外)
- もし将来 Hazama FM 用と同名衝突しそうなら、`presets/legacy/` に移動を検討

### 監査スクリプト

`scripts/audit.py` で `loader.js` 登録漏れ / 古い preset の整合性をチェック可能。
`python -X utf8 scripts/audit.py` で全件 OK / BAD 表示。

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
