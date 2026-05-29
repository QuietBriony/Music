# Hazama FM — Measurement Loop

How to ground Hazama FM tuning in **measured numbers** instead of
qualitative ear feedback ("乗れない" → "lofi swing 0.10 vs Nujabes
reference 0.14-0.18, BPM 82 vs 85-95 → designed slower + straighter").

This is the Hazama FM analog of Band Room's `docs/MEASUREMENT-LOOP.md`.
Band Room iterates fast (v228→v286) because its tuning is grounded in
measured diffs (`analyze-band-stems.py` + `compare-capture.py`). Hazama
FM's last big push (v244-v263) was driven by the user repeatedly saying
"乗れない / 退屈" — qualitative, slow, with the user's ear as the
bottleneck on every iteration. This loop removes that bottleneck for a
whole class of groove/timing tuning.

---

## Phases

| Phase | What | Audio capture | Status |
|---|---|---|---|
| **1. Drum design analyzer** | Read drum-frames JSON + genre-flavor.js governor, diff against numeric reference targets (funk/jazz/lofi/techno) | none | **shipped** |
| **1.5. Envelope analyzer** | Parse genre-flavor.js builders (ambient/piano), report envelope/velocity/schedule vs qualitative axis hints | none | **shipped** |
| **2. Live capture compare** | Record actual engine playback, analyze real timing/spectral, diff vs design spec | preview MCP | future |

Phase 1 / 1.5 ground the *design* first (cheap, no audio, deterministic).
6 of 7 pills now have a measured design profile (`any` is engine drift,
no fixed builder). Phase 2 confirms the design actually plays as designed
(catches engine clamps / dynamic ramps that silently override frame
values — the same class of bug found in the v260 audit).

---

## Phase 1 — design analyzer (shipped)

### Run

```powershell
node scripts/hazama-fm-measure.mjs          # full console report + JSON
node scripts/hazama-fm-measure.mjs --json   # terse, just write the JSON
```

Runs from the Music repo root or any Music worktree. No dependencies
beyond Node. Not named `check-*.mjs`, so `stack-check.mjs` does **not**
auto-run it as a gate — drift is informative, not pass/fail.

### What it reads

- `presets/drum-frames-{funk,jazz,lofi,techno}.json` — per-frame BPM /
  swing, per-event `microMs` (behind-beat) + `velocity` (Phase 1)
- `audio/genre-flavor.js` `GOVERNOR_BY_PILL` — `rdj` (Aphex wrongness
  dropout) + `dangelo` (D Angelo behind-beat wash) amounts per pill
- `audio/genre-flavor.js` `buildAmbientDefault` / `buildPianoDefault` —
  synth envelope (attack/decay/sustain/release), volume, reverb, trigger
  velocity, schedule interval (Phase 1.5, ambient/piano)

### What it measures (per pill)

- BPM avg + range across frames
- swing avg + range
- per-instrument (kick / snare / hat / ghost) `microMs` avg + range,
  velocity avg
- events per bar (density)
- governor rdj / dangelo amounts

### What it diffs against

Reference targets distilled from `references/apple-music-refs.json`
(production_translation prose) and `references/hazama-fm-pill-refs.json`
(sub_styles, axis hints) into numeric ranges. The targets live in
`TARGET_SPEC` at the top of `scripts/hazama-fm-measure.mjs`, each citing
its source reference so the number is reviewable. Qualitative prose
(no number) is reported but not diffed.

### Output

1. **console** — per-pill measured profile + drift report (axis,
   measured value, target range, LOW/HIGH direction)
2. **`docs/hazama-fm-design-spec.json`** — machine-readable measured
   profile (overwritten each run; committed as a reviewable snapshot,
   like Band Room's `docs/target-spec-bands.json`)

---

## Current findings (snapshot, regenerate to refresh)

As of the harness landing (run `node scripts/hazama-fm-measure.mjs` for
the live numbers; `docs/hazama-fm-design-spec.json` has the full data):

| pill | drift | reading |
|---|---|---|
| **lofi** | BPM 82 vs 85-95 (LOW), swing 0.10 vs 0.14-0.18 (LOW), snare 19.6ms vs 12-18 (HIGH) | designed **slower + straighter** than its Nujabes north-star, snare dragged past target (governor dangelo +0.10 adds more on top) |
| **jazz** | none | within Blakey hard-bop / Miles modal targets |
| **funk** | swing 0.09 vs 0-0.08 (HIGH), kick -2.5ms vs 0-6 (LOW), snare 18.1ms top-of-range | kick **pushes ahead** (front of beat) while snare drags — wide pocket; swing slightly above straight-funk target |
| **techno** | kick -0.5ms vs 0-3 (LOW) | essentially on-grid (marginal lead), as a 4-on-floor should be |
| **ambient** (envelope) | axis-fit ok | attack 4s / release 6s / schedule 16m — long + slow = the space/restraint character ✓ |
| **piano** (envelope) | axis-fit ok | attack 0.06 / release 1.6 / vel 0.32 (felt) / schedule 2m (sparse). felt+long-rest comes from low velocity + sparse schedule, not per-note release ✓ |

These are **observations, not bugs**. The drift tells you where the
design diverges from the reference; whether to close the gap is a taste
call.

### Example use

User: "lofi がなんか乗れない"
→ Run the harness. lofi BPM 82 / swing 0.10 vs Nujabes 85-95 / 0.14-0.18.
→ Hypothesis: the pill is designed slower + straighter than jazz-hop;
   if more bounce is wanted, raise frame swing toward 0.15 and BPM toward 88.
→ That tuning is `presets/drum-frames-lofi.json` + maybe genre-flavor.js;
   ship as a PR and confirm by ear (studio-surface / user) — **the ear
   is now final-confirm, not every-iteration discovery**.

---

## Phase 2 — live capture compare (future)

Phase 1 measures the *design*. Phase 2 confirms the engine actually
*plays* it (frame microMs can be overridden by engine clamps,
HumanGrooveGovernor, dynamic ramps — see the v260 audit where
v253/v256 parameter bumps were found silently neutralized).

Planned shape (parallel to Band Room compare-capture.py):

1. Open `fm.html`, pick a pill, let it play ≥ 60 s
2. Capture via Claude Code preview MCP (autonomous, no human ● REC) —
   the preview MCP audio path is Claude Code-only; codex would need a
   human to record. See Band Room MEASUREMENT-LOOP §4 for the precedent.
3. Analyze the capture (librosa, like compare-capture.py): real
   kick/snare onset times, swing, spectral centroid, dynamic range,
   polyphony load over time
4. Diff actual vs `docs/hazama-fm-design-spec.json` — flag where the
   engine's actual output diverges from the design

Phase 2 also enables the **BL-022 polyphony question** to be measured:
capture the "同時起動音" scene and measure actual voice count / RMS
spikes against the maxPolyphony 24 cap, instead of relying on the user
to hear "詰まる".

---

## Boundary

- This is an **analysis tool**, not a gate. It never fails stack-check.
- It does **not** modify `engine.js`, `genre-flavor.js`, presets, or any
  runtime artifact. It only reads them.
- Closing a measured drift (tuning) IS engine.js / genre-flavor.js /
  preset work and still needs a PR + 試聴 human-gate. The harness
  grounds the *hypothesis*; the ear confirms the *result*.
- `TARGET_SPEC` numbers are distilled from reference prose. If a target
  is wrong, fix it in the script (with an updated source citation) — the
  references prose is the source of truth.

## Related

- `docs/MEASUREMENT-LOOP.md` — Band Room's measurement loop (the model)
- `scripts/hazama-fm-measure.mjs` — Phase 1 analyzer
- `docs/hazama-fm-design-spec.json` — generated measured profile snapshot
- `references/apple-music-refs.json` / `references/hazama-fm-pill-refs.json` — reference targets
- `presets/drum-frames-{funk,jazz,lofi,techno}.json` — measured design inputs
- `audio/genre-flavor.js` `GOVERNOR_BY_PILL` — governor amounts
- `docs/autonomy/BACKLOG.md` BL-022 — polyphony question Phase 2 can measure
