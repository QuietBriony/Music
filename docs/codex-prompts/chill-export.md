# Codex prompt — chill repo: export piano recipe JSON

Paste the block below into the chill repo's codex session. The schema this
follows is in **Music** repo at `presets/SCHEMA.md` (section 1).

---

```
Task: export the four CHILL_RECIPES as a portable JSON file that an external
Tone.js player (Hazama FM in QuietBriony/Music) can load and re-render.

Schema reference: see Music/presets/SCHEMA.md section 1
("Chill — chill-piano-recipe.json"). Match that shape exactly.

Implementation:

1. Read CHILL_RECIPES in chill/engine.js (around lines 72–487). The four
   recipes are: piano-jazz-chill, rainy-lofi-room, soft-solo-drift,
   soft-melody-piano.

2. Add a new file chill/scripts/export-piano-recipe.js (or similar) that:
   - imports the CHILL_RECIPES data (extract the data only, not Flow Director)
   - builds an output object matching SCHEMA.md section 1
   - writes the file to chill/exports/chill-piano-recipe.json (2-space indent)

   For each recipe, include:
     id, label (from recipe.label or recipe.id),
     bpm, swing,
     layers[]: id, type, tone, notes, pattern, duration, velocity, every,
       probability, humanize, swingPush, pedal, room, densityWeight
     defaultFaders (faderA/faderB/faderC values, default if absent),
     transitionRules (maxDensity, quietOnLateTicks)

   Exclude: energyWeight, natureWeight, filterBase, filterRange (Flow
   Director–only fields not consumed by Hazama FM).

3. Output requirements:
   - Top-level object: { "version": 1, "format": "chill-piano-recipe", "recipes": [...] }
   - All four recipes in the recipes array, in their declaration order.
   - File size < 100 KB.
   - Add a one-line comment in the script: "Exported from chill:CHILL_RECIPES.
     Suitable for Tone.js PolySynth voicing."

4. Constraints (chill repo rules):
   - No new npm dependencies. Use native JSON.stringify.
   - Don't add audio files or samples.
   - Don't modify CHILL_RECIPES or engine.js logic — write-only export.
   - Determinism: same source = same JSON byte-for-byte.

5. Acceptance:
   - JSON parses cleanly with JSON.parse.
   - Each recipe has at least one layer of type: "piano".
   - notes/pattern arrays preserved exactly as in source.
   - swingPush, humanize, pedal, room present on every layer (default 0 if
     missing in source).
   - Browser fetch("./exports/chill-piano-recipe.json").then(r => r.json())
     resolves without error.

6. Git:
   - Branch: export/chill-piano-recipe
   - Commit message: "export: chill piano recipes as portable JSON for Hazama FM"
   - Open PR; do not auto-merge (follow chill's branch -> PR -> merge rule).
```

---

## After codex finishes

- The chill repo will have `chill/exports/chill-piano-recipe.json`
- Copy it into `Music/presets/chill-piano-recipe.json`
- `presets/loader.js` will pick it up automatically on next `START`
