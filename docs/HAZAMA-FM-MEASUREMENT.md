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
| **2. Live capture compare** | Analyze a recorded fm.html playback (librosa), diff real timing/tone vs design spec | recording only | **analyzer shipped** (`scripts/hazama-fm-compare-capture.py`); capture step pending |

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

### Field consumption map — measure what's consumed (verified 2026-06-01)

Fable-perspective review traced every drum-frames field to its consumer.
Two of the four "groove" fields turned out to be **metadata that does not
drive playback**:

| field | consumer | status |
|---|---|---|
| `events[].microMs` / `velocity` | `buildDrumsFromFrames` schedules each hit at `beat*4n + sub*16n + microMs` | **CONSUMED — the real groove levers** |
| `frame.bpm` | `genre-flavor.js` → `flavor.frameBpm` (Now Playing UI 表示のみ) | **display-only** |
| `frame.swing` | (no reader anywhere in the repo) | **dead field** |
| actual tempo | `fm.js GENRE_PROFILES[pill].bpm` (ambient 72 / lofi 88 / jazz 96 / funk 100 / techno 132 / piano 68) → `DJTempoState` → `engine.js rampParam("transport-bpm", …)` + organic tempo drift ±0-1.5 | runtime authority |
| actual swing | `engine.js FM_MODE_SWING` (lofi/jazz **0.0** — deliberate fm-67 decision: "microMs で表現済、Transport.swing は不要"; triple-stacking JSON microMs + D'Angelo extraMs + Transport.swing caused 気持ち悪い遅延, rhythm research v132) | runtime authority |

Consequences (honest corrections of earlier claims):
- The original Phase 1 bpm/swing drift findings — and the later tuning that
  "closed" them by editing `frame.bpm`/`frame.swing` — concerned metadata
  fields. The **audible** part of those tunes was the microMs/velocity edits
  shipped alongside.
- The first Phase 2 lofi capture's "bpm 83.35 matches design 82.4 ✓" was a
  coincidence: tempo comes from fm.js/engine (lofi profile 88, engine default
  80), not from frame.bpm. The match told us the engine tempo landed near the
  frame metadata, not that frames drive tempo.
- Whether to wire `frame.bpm`/`frame.swing` into playback, or officially
  declare them annotation metadata, is BL-025 (human-gate — fm-67 already
  decided *against* swing stacking once).

### What it reads

- `presets/drum-frames-{funk,jazz,lofi,techno}.json` — per-event `microMs`
  (behind-beat) + `velocity` (the consumed levers); `frame.bpm`/`swing`
  reported as metadata (Phase 1)
- `fm.js` `GENRE_PROFILES` — per-pill runtime bpm (the tempo authority)
- `engine.js` `FM_MODE_SWING` — per-mode `Transport.swing`
- `audio/genre-flavor.js` `GOVERNOR_BY_PILL` — `rdj` (Aphex wrongness
  dropout) + `dangelo` (D Angelo behind-beat wash) amounts per pill
- `audio/genre-flavor.js` `buildAmbientDefault` / `buildPianoDefault` —
  synth envelope (attack/decay/sustain/release), volume, reverb, trigger
  velocity, schedule interval (Phase 1.5, ambient/piano)

### What it measures (per pill)

- runtime bpm (fm.js) + Transport.swing (engine) — diffed against targets
- **effective swing in ms** — off-8th hat drag minus on-8th hat drag from
  the events (per fm-67, swing lives in microMs); diffed against the
  reference swing fraction converted to ms of an 8th at the runtime bpm
- per-instrument (kick / snare / hat / ghost) `microMs` avg + range,
  velocity avg
- events per bar (density)
- governor rdj / dangelo amounts
- frame `bpm`/`swing` fields — reported, labeled metadata, NOT diffed

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

Run `node scripts/hazama-fm-measure.mjs` for the live numbers;
`docs/hazama-fm-design-spec.json` has the full data. After the 2026-06-01
consumed-fields rework (runtime authorities + effective swing in ms):

| pill | drift | reading |
|---|---|---|
| **lofi** | effective_swing 8.7ms vs ref-equivalent 48-61ms (LOW) | runtime bpm 88 ✓ (fm.js), snare 16.6ms ✓ — but the **felt** swing (off-8th hat drag 16.5 − on-8th 7.8) is ~1/6 of the Nujabes 14-18% reference. The "straight" feel is real and lives in the events, not in the (dead) swing field |
| **jazz** | effective_swing 20.8ms vs 50-69ms (LOW) | ride skip +18ms vs a 16-22% swing reference — much straighter than swung jazz; fm-67 deliberately keeps Transport.swing 0 |
| **funk** | none | runtime bpm 100 ✓, kick 0.6ms ✓, snare 17.2ms ✓, effective 13.8ms within straight-funk 0-24ms ✓ |
| **techno** | none | effective 0.7ms — on-grid as designed |
| **ambient** (envelope) | axis-fit ok | attack 4s / release 6s / schedule 16m — long + slow = the space/restraint character ✓ |
| **piano** (envelope) | axis-fit ok | attack 0.06 / release 1.6 / vel 0.32 (felt) / schedule 2m (sparse). felt+long-rest comes from low velocity + sparse schedule, not per-note release ✓ |

These are **observations, not bugs**. The lofi/jazz effective-swing gap vs
the reference conversion is large but fm-67 chose microMs-only swing
deliberately (stacking caused 気持ち悪い遅延). Widening the off-8th drag is
a microMs edit (the consumed lever) + 試聴 human-gate — and a taste call.

### Example use

User: "lofi がなんか乗れない"
→ Run the harness. Runtime bpm 88 is already in the Nujabes range; the gap
   is **effective swing 8.7ms vs ~48-61ms reference-equivalent**.
→ Hypothesis: if more bounce is wanted, widen the off-8th hat `microMs`
   drag in `presets/drum-frames-lofi.json` (the consumed lever) — NOT the
   `swing` field (dead) and NOT `frame.bpm` (display-only). Step gently
   (e.g. off-8th 16→24-30ms) — fm-67 warns full-reference stacking felt bad.
→ Ship as a PR and confirm by ear (studio-surface / user) — **the ear is
   final-confirm, not every-iteration discovery**.

---

## Phase 2 — live capture compare (verified end-to-end)

Phase 1 measures the *design*. Phase 2 confirms the engine actually
*plays* it (frame microMs can be overridden by engine clamps,
HumanGrooveGovernor, dynamic ramps — see the v260 audit where
v253/v256 parameter bumps were found silently neutralized).

The **analyzer is shipped**: `scripts/hazama-fm-compare-capture.py`
(parallel to Band Room's `compare-capture.py`, same band-onset / spectral
vocabulary).

### ✅ Verified end-to-end (2026-05-29, autonomous via preview MCP)

The full loop ran with no human in the loop: Claude Code preview MCP
served fm.html, started lofi playback, recorded 42 s off the Tone master,
decoded webm→WAV in-page, POSTed the bytes to a local receiver, and ran
the analyzer. First result (lofi):

| metric | actual playback | design | reading |
|---|---|---|---|
| bpm | 83.35 | 82.4 | matches ✓ |
| tempo_stability | 1.8 % | — | HumanGrooveGovernor active (human 1-3 %, not robotic 0 %) |
| snare vs kick | snare −6.3 ms / kick −35.4 ms (snare later) | snare 19.6 > kick 9.2 (snare later) | **snare-behind-kick pocket preserved** ✓ |
| RMS dynamic range | 27.2 dB | — | healthy, not over-compressed |

→ **no major divergence — the engine plays the lofi design faithfully**, no
silent clamp/ramp override (v260-class bug absent for lofi groove). This
also settles the long "乗れない" question: the slower/straighter feel is
the *design* (bpm 82 / swing 0.10 vs Nujabes 85-95 / 0.14-0.18), not an
engine artifact. (That capture predates the later lofi tuning to bpm 87.2 /
swing 0.14; re-capture after a tuning to confirm the new values play.)

### ⚠️ Capture caveat: the GENRE pill is a *bias*, not a hard mode switch

Verified 2026-06-01 while attempting a funk capture. Clicking a GENRE pill
sets `aria-pressed` on the button and biases the engine, but it does **not**
force `EngineParams.mode`. Hazama FM is a generative radio: the
`MUSIC_RADIO_BRAIN` rotates programs, and the pill nudges that rotation. In
the funk attempt, the pill showed `funk` pressed yet `EngineParams.mode`
stayed `lofi` and the master was near-silent (avg RMS ~0.0004) — even after
a clean stop→funk→play sequence.

Consequences for Phase 2:
- A capture measures **whatever the engine is currently rendering**, which
  the pill does not deterministically pin to one pill. The earlier lofi
  capture succeeded because the engine was already rendering lofi (default /
  restored), so it was a lofi-dominated render — not a guaranteed pure-pill
  isolation. Treat Phase 2 numbers as "the engine's live blend, currently
  dominated by pill X", not "pill X's drum-frames in isolation". Phase 1
  is the per-pill isolated truth; Phase 2 is the live-blend reality check.
- **Always gate the recording on an engagement check** before you record:

  ```js
  // in preview_eval, after selecting a pill + play, poll for ~2 s:
  //   EngineParams.mode === <pill>      (engine actually switched)
  //   HazamaFlavorState.frameId is set  (drums are scheduling)
  //   avg RMS over ~15 samples > ~0.01  (audible, not a silent gap)
  // Only start MediaRecorder once all three hold; otherwise you capture
  // silence or the wrong pill.
  ```

- Forcing an arbitrary pill may need more than a click (engine state /
  localStorage can pin the current mode). If a target pill won't engage,
  capture is not yet meaningful for it — don't record noise. This is a known
  limit, not a harness bug; Phase 1 still covers that pill's design.

### Run (once you have a recording)

```powershell
python -X utf8 scripts/hazama-fm-compare-capture.py CAPTURE_FILE PILL
python -X utf8 scripts/hazama-fm-compare-capture.py rec.wav lofi
```

It loads the recording (librosa), measures real bpm / kick+snare offset
from beat (avg + jitter std) / tempo stability / spectral centroid /
dynamic range, then diffs against `docs/hazama-fm-design-spec.json` for
that pill:
- **bpm** vs design `bpm_avg` (octave-fold tolerant)
- **snare-behind-kick pocket** preserved? (sign-flip = engine reshaped it)
- drum pills get the timing diff; envelope pills (ambient/piano) get a
  tone/dynamics baseline only (no clear onsets to diff)

### Capture — manual (human)

1. Open `fm.html`, pick a pill, let it play ≥ 60 s
2. Click the FM ● REC button (`audio/music-recorder.js` MediaRecorder),
   then stop. fm.html saves a capture file (`captures/` is gitignored).
3. Convert to `.wav` if it came out `.webm` (needs ffmpeg for librosa) —
   or use the autonomous path below, which decodes webm→WAV in-page and
   needs no ffmpeg.

### Capture — autonomous (Claude Code preview MCP, no ffmpeg)

Proven 2026-05-29. The trick: the browser decodes webm itself
(`decodeAudioData`), so no ffmpeg is needed, and the bytes are POSTed to a
local receiver so the audio never passes through the agent's context.

1. `.claude/launch.json` → a static server for the repo, e.g.
   `python -m http.server 4178 --directory <repo>`; `preview_start`.
2. `preview_eval` → navigate to `/fm.html`, `Tone.start()`, click a genre
   pill + `#fm_play`. Confirm `Tone.Transport.state === "started"` and
   `HazamaFlavorState.frameId` is set (drums scheduling).
3. `preview_eval` → tap `Tone.getDestination()` into a
   `MediaStreamDestination`, record with `MediaRecorder` for ~20-40 s.
4. `preview_eval` → on stop: `blob.arrayBuffer()` → `decodeAudioData` →
   `OfflineAudioContext(1, …, 22050)` render (mono + resample) → build a
   16-bit PCM WAV → base64 → stash on `window`.
5. Run `scripts/hazama-fm-capture-receiver.py` (a tiny CORS POST receiver),
   then `preview_eval` → `fetch('http://127.0.0.1:9099/save', {method:'POST',
   body: window._capWavB64})`. The receiver base64-decodes and writes
   `captures/fm-<pill>.wav`.
6. `python -X utf8 scripts/hazama-fm-compare-capture.py captures/fm-<pill>.wav <pill>`

The preview-MCP audio path is Claude Code-only; codex would need a human
to record. See Band Room MEASUREMENT-LOOP §4 for the manual precedent.

### BL-022 polyphony question

Phase 2 also lets the **BL-022 polyphony question** be measured: capture
the "同時起動音" scene and read actual RMS spikes / dynamic range against
the maxPolyphony 24 cap, instead of relying on the user to hear "詰まる".
(Voice-count needs an in-page telemetry tap; RMS-spike is already in the
analyzer's `rms_dynamic_range_db`.)

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
- `scripts/hazama-fm-measure.mjs` — Phase 1 / 1.5 design analyzer
- `scripts/hazama-fm-compare-capture.py` — Phase 2 capture analyzer
- `scripts/hazama-fm-capture-receiver.py` — autonomous-capture POST receiver
- `docs/hazama-fm-design-spec.json` — generated measured profile snapshot
- `references/apple-music-refs.json` / `references/hazama-fm-pill-refs.json` — reference targets
- `presets/drum-frames-{funk,jazz,lofi,techno}.json` — measured design inputs
- `audio/genre-flavor.js` `GOVERNOR_BY_PILL` — governor amounts
- `docs/autonomy/BACKLOG.md` BL-022 — polyphony question Phase 2 can measure
