# Codex prompt — drum-floor repo: export funk + techno frames

Paste the block below into the drum-floor repo's codex session. The schema
this follows is in **Music** repo at `presets/SCHEMA.md` (section 2).

---

```
Task: export two preset JSON files containing 4–8 representative bar
variations each — one funk pocket file, one techno pocket file. Hazama FM
(in QuietBriony/Music) will load these and schedule them through Tone.js.

Schema reference: see Music/presets/SCHEMA.md section 2
("Drum-floor — drum-frames-{funk,techno}.json"). Match it exactly.

Implementation:

1. Read drum-floor/profiles/groove-profiles.json and
   drum-floor/patterns/drum-pattern-frames.json.

2. Funk file (drum-floor/exports/drum-frames-funk.json):
   - Use frames driven by deep_neo_soul_pocket profile (snare_lag_ms ≈ 18,
     hat_swing 0.6–0.8, ghost density high).
   - Generate 4–8 single-bar variations at BPM 84–110.
   - Aesthetic: behind-the-beat snare, soft ghost notes, hat swing.

3. Techno file (drum-floor/exports/drum-frames-techno.json):
   - Use a forward-locked frame (snare_lag_ms ≤ 3, hat_swing ≤ 0.3) — e.g.
     riff_shout_floor or build a tight grid pocket.
   - Generate 4–8 single-bar variations at BPM 120–132.
   - Aesthetic: kick on every beat, tight 16th-note hat, minimal ghost.

4. Output schema (per file):

   {
     "version": 1,
     "format": "drum-frames",
     "genre": "funk" | "techno",
     "frames": [
       {
         "id": "funk_pocket_bar_0",
         "bpm": 98,
         "swing": 0.08,
         "barLength": 4,
         "role": "settle",
         "events": [
           { "instrument": "kick", "beat": 0, "sub": 0, "velocity": 0.72,
             "microMs": -3, "role": "anchor" },
           ...
         ]
       },
       ...
     ]
   }

   - instrument: kick | snare | hat | ghost | fill | crash
   - beat: 0..3, sub: 0..3 (16th within the beat)
   - velocity: 0..1 (linear)
   - microMs: timing offset in ms (negative = early)
   - role: free-form semantic label

5. Constraints (drum-floor repo rules):
   - No audio files. No new npm dependencies. No GitHub Actions.
   - Don't refactor groove-profiles.json or drum-pattern-frames.json.
   - Don't auto-arm live output.
   - Human review gate: open PR, don't merge.

6. Acceptance:
   - Both JSON files parse cleanly.
   - 4–8 frames per file.
   - Each frame has at least one kick event (anchor) and one hat event.
   - Funk avg snare microMs ≥ 8 ms (behind beat).
   - Techno avg snare microMs ≤ 3 ms.
   - Browser fetch resolves successfully.

7. Git:
   - Branch: export/drum-frames
   - Commits:
     "export: drum-frames-funk.json (4-8 bar pocket variations)"
     "export: drum-frames-techno.json (4-8 bar 4-on-floor variations)"
   - Open PR. Don't auto-merge.
```

---

## After codex finishes

- drum-floor repo will have `drum-floor/exports/drum-frames-funk.json`
  and `drum-floor/exports/drum-frames-techno.json`
- Copy both into `Music/presets/`
- Hazama FM `buildFunk` / `buildTechno` will pick them up automatically
