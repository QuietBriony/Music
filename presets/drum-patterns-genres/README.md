# drum-patterns-genres

Hand-authored, genre-standard drum patterns for band-room.
Each file follows the existing `presets/drum-frames-*.json` schema
(top-level `version / format / genre / frames[]`, plus a `structure[]`
array describing intro → main → climax section ordering).

`session_signature` on every file: `"Tier 1 #2 standard pattern, hand-authored, v135"` for the original 4 files, `"... v139"` for the cross-genre expansion (afro-cuban, reggaeton, breakbeat).

## Files

| File | BPM | Frames | Character |
|---|---|---|---|
| `boom-bap.json`       |  90 | 3 (intro / verse / chorus_climax) | Kick on 1 + and-of-3 syncopation, snare backbeat with +12 ms Dilla drag, 8th-note hats with downbeat/offbeat velocity split. |
| `four-on-floor.json`  | 128 | 3 (intro / main / peak_open_hat) | Kick on every beat, snare 2/4, closed 16th hats with offbeat accent, open hat on "and" of 1 / 3 in peak frame. Tight micro-timing (±2 ms). |
| `jazz-brush.json`     |  90 | 3 (head / solo / trade)          | Feathered kick (vel 0.30), brushed snare wash on 2/4, ride spang-a-lang = 4 on-beat + "and" of 1/3 (6 hits/bar). Skip notes pushed +18 ms for triplet swing feel. |
| `dnb.json`            | 170 | 3 (intro / drop / wash)          | Amen-break inspired: kick 1 + e-of-1 double + and-of-3, snare 2/4 + double-hits, 16th hat with humanized ±2-5 ms timing. Crash on drop. |
| `afro-cuban.json`     | 100 | 3 (intro / verse / chorus_climax) | Tumbao kick (1 + and-of-2 + and-of-4), 3-2 son clave on ghost taps, light rim-ghost backbeat 2/4, shaker on every 16th. Wide micro-timing (−8 to +14 ms) for syncopated tumbao feel. swing 0.0. |
| `reggaeton.json`      |  95 | 3 (verse / drop / break)          | Classic dembow: kick on 1 + and-of-2 + and-of-3, snare boom-ch-boom-chick (1 sub 2 + 3 + 3 sub 2), 8th-note hat. Crash on drop, ghost-snare break with fill turnaround. swing 0.0. |
| `breakbeat.json`      | 140 | 3 (intro / verse / break_down)    | Amen-style chopped break: kick on 1 + and-of-3, snare on 2/4 with 2-3 ghost snares per bar (vel 0.3-0.4), 16th hat with velocity variation. break_down frame ends with tom roll fill into one. swing 0.06. |

## Schema reference

```json
{
  "version": 1,
  "format": "drum-frames",
  "genre": "<name>",
  "session_signature": "Tier 1 #2 standard pattern, hand-authored, v135",
  "structure": [
    { "section": "intro", "frame_id": "<frame.id>" },
    { "section": "main",  "frame_id": "<frame.id>" }
  ],
  "frames": [
    {
      "id": "<unique>",
      "bpm": 90,
      "swing": 0.06,
      "barLength": 4,
      "role": "<intro|verse|drop|...>",
      "session_role": "<same>",
      "events": [
        {
          "instrument": "kick|snare|hat|ghost|fill|crash",
          "beat": 0,          // 0..3
          "sub": 0,           // 0..3 (16-step grid)
          "velocity": 0.50,   // 0.05..0.95
          "microMs": 0,       // -30..+30 timing nudge
          "role": "<human-readable tag>"
        }
      ]
    }
  ]
}
```

The 6 instrument names (`kick / snare / hat / ghost / fill / crash`) are the
keys band-room's drumKit accepts; see `band-room.js` instrument routing
(`drumKit[evt.instrument].triggerAttackRelease(...)`).

## Referencing from band-room

Today, band-room loads drum-frames from a path stored in `band.drum_frames_pattern`,
defaulting to `presets/drum-frames-tabasco-{songid}.json` (see `band-room.js`
around line 1712). KIT_OPTIONS (line 99) defines the synth/sample kit selector.

To wire these genre patterns in, two natural routes:

1. **Per-band pattern field.** Point a band's `drum_frames_pattern` at
   `presets/drum-patterns-genres/<genre>.json` directly. Works today,
   no code change required — the existing loader resolves the path and
   reads `frames[]`.

2. **New "Genre Pattern" menu.** Add a sibling menu next to KIT_OPTIONS
   (e.g. `PATTERN_OPTIONS`) listing the 4 genre files. On change, set
   `state.songData.frames` from the chosen file's `frames[]` and rebuild
   the section mapping from `structure[]` (each section's `frame_id`
   resolves into the existing `state.songData.frames.find(f => f.id ===
   sec.frame_id)` lookup at `band-room.js:1897`).

The `structure[]` array is the addition over the existing `drum-frames-*.json`
files — it lets a pattern self-describe its section ordering instead of
relying on the band-side song definition.
