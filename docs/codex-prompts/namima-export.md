# Codex prompt — namima repo: export ambient mood shapes

Paste the block below into the namima repo's codex session. The schema this
follows is in **Music** repo at `presets/SCHEMA.md` (section 3).

---

```
Task: extract namima's mood snapshots from MOOD_AUDIO + profileToShape() and
export them as a portable JSON file. Hazama FM (in QuietBriony/Music) will
load this and rebuild an equivalent layered ambient bed using Tone.js.

Schema reference: see Music/presets/SCHEMA.md section 3
("Namima — namima-shape-ambient.json"). Match it exactly.

Implementation:

1. Read namima/audio.js — focus on:
   - MOOD_AUDIO (around lines 13–39)
   - profileToShape() (around lines 69–100)

2. For each profile in MOOD_AUDIO (water_day, garden_morning, family_room,
   soft_sleep, transparent_evening), produce a "shape snapshot":
   - Either run profileToShape() with a neutral input_bias (all "medium"
     values) and capture the result,
   - Or just snapshot the raw MOOD_AUDIO values directly.

3. Map to Tone.js conventions:
   - master            ← MOOD_AUDIO[id].gain
   - filter.lowpass    ← { freq: filterBase, Q: 0.6 }
   - filter.highpass   ← { freq: airBase, Q: 0.5 }
   - reverb            ← { decay: 6.5, wet: reverbWet }
   - shimmer           ← { rateHz: 2.0, wet: shimmerWet, feedback: 0.20 }
   - tail              ← { delayMs: 125, wet: tailWet, feedback: 0.14 }
   - air               ← { gain: airChance, noiseType: "sine" }
   - pad               ← { gain: master*0.9, baseNote: cycles through
                            C3/D3/F3/G3, attack: 0.6, decay: 0.2,
                            sustain: 0.7, release: 2.6 }

4. Output file (namima/exports/namima-shape-ambient.json):

   {
     "version": 1,
     "format": "namima-ambient-tone-js",
     "policy": {
       "stores_audio": false,
       "stores_samples": false,
       "stores_metadata_only": true,
       "purpose": "public-friendly ambient preset"
     },
     "presets": [
       {
         "id": "water_day",
         "label": "Water Day",
         "master": 0.72,
         "filter": {...},
         "reverb": {...},
         "shimmer": {...},
         "tail": {...},
         "air": {...},
         "pad": {...}
       },
       ...
     ]
   }

5. Constraints (namima repo rules):
   - Public-friendly: no aggressive elements, no recordings.
   - Gesture-tied start (Hazama FM enforces this on its side; just don't
     break the rule on namima's side).
   - No audio files, no recordings, no external samples.
   - Metadata only.

6. Acceptance:
   - 4–5 presets in the array.
   - All required fields present per preset.
   - master, gain values within 0..1.
   - filter freqs in plausible Hz range (highpass < lowpass center).
   - JSON parses cleanly.

7. Git:
   - Branch: export/namima-shape-ambient
   - Commit message: "export: namima ambient shapes for Hazama FM"
   - Open PR; don't auto-merge.
```

---

## After codex finishes

- namima repo will have `namima/exports/namima-shape-ambient.json`
- Copy into `Music/presets/namima-shape-ambient.json`
- Hazama FM `buildAmbient(shape)` will pick it up automatically
