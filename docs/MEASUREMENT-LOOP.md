# Band Room — Measurement Loop

How to ground AI 再現 tuning in **real measured numbers** instead of
qualitative ear feedback ("グルーブない" → "kick avg +18 ms vs Tabasco -3 ms").

This is the workflow that v264 (`-10 ms` cramps-punk bass push) was
derived from. Same workflow scales to any band and any future agent
tweak.

---

## Pieces

| What | Path | Purpose |
|---|---|---|
| Reference spec extractor | `scripts/analyze-band-stems.py` | Reads real stems from `presets/<band>-stems/<song>/`, writes per-song target spec |
| Target spec | `docs/target-spec-bands.json` | BPM / drum onsets / kick pocket / bass→kick lock % per song |
| Live capture | `band-room.html` ● REC button (v81) | Records the post-limiter mix to a `.webm` file |
| Capture analyser | `scripts/compare-capture.py` | Analyses a capture, prints diff vs target |

---

## 1. Generate / refresh the target spec

```powershell
python -X utf8 scripts/analyze-band-stems.py
```

Auto-discovers bands from `presets/bands.json` (both `bands` and
`reference_libraries`), processes every song that has `drums.mp3` +
`bass.mp3`. Writes `docs/target-spec-bands.json`.

Restrict scope:

```powershell
python -X utf8 scripts/analyze-band-stems.py tabasco
python -X utf8 scripts/analyze-band-stems.py tabasco/human-fly
```

---

## 2. Capture an AI 再現 take

1. Open the live site (or local server): https://quietbriony.github.io/Music/band-room.html
2. Switch to **AI 再現** mode.
3. Pick the target song (e.g. *Human Fly*).
4. Click **● REC** in the recording panel.
5. Let it play **≥ 30 s** (more = more stable measurement).
6. Click **■ STOP REC**, then **↓ download** the auto-named file:
   `band-room_<band>_<song>_<timestamp>.wav` (v272 — was `.webm`, now
   re-encoded to PCM 16-bit so librosa can read it directly).

---

## 3. Compare the capture to target

```powershell
python -X utf8 scripts/compare-capture.py path\to\rec.webm tabasco/human-fly
```

Output:

```
Analysing capture: rec.webm
  duration       : 35.42s
  bpm            : 117.45
  kick onsets    : 84
  kick pocket avg: +12.3 ms (std 95.6ms)

Target: tabasco/human-fly
  bpm            : 117.45
  kick pocket avg: +30.8 ms

Diff (AI - target):
  bpm            : +0.0 BPM
  kick pocket avg: -18.5 ms

  BPM match     : OK
  Pocket within 15ms: OFF
```

→ Decision: the AI's kick is 18.5 ms ahead of Tabasco's typical pocket.
If you want it closer, tweak v264's `BASS_PUSH_BY_PROFILE["cramps-punk"]`
(less negative = less push) or adjust the v247 reinforcement timing.

`band_id` (e.g. `tabasco`) averages across all songs in that band;
`band_id/song_id` (e.g. `tabasco/human-fly`) is per-song.

---

## Format note (v272)

The ● REC button now downloads a **.wav** file directly (PCM 16-bit
interleaved). librosa / Audacity / any standard audio tool reads it
with no extra install — no ffmpeg needed.

Pre-v272 the download was `.webm` (opus-encoded), which required
ffmpeg on PATH to decode. v272 added a small in-browser
`AudioBuffer → WAV` encoder so the user gets an analysis-ready file
straight from the browser.

If WAV re-encode fails (very old browser or codec issue), the code
falls back to the original `.webm` and logs a console warning. In
that fallback, you'd still need ffmpeg or Audacity to convert
externally.

---

## Why this matters

v245-v262 were heuristic — "try this number, see if user likes it on
their iPhone." Round-trip was high (user listen → describe in words →
guess at fix → ship → repeat). With the measurement loop:

- v264 came from `analyze-band-stems.py` showing Tabasco bass averages
  -11.2 ms ahead of kick → ship -10 ms push, root in data not guess.
- Future rounds reference `target-spec-bands.json` numerically. "AI
  pocket is +18 ms off target" beats "AI feels rushed."

When `mcp-music-analysis` is installed, the same analysis is available
to the assistant directly via MCP — same numbers, conversational
access. The CLI scripts remain as the local fallback (no MCP needed).

---

## Extension ideas

- Add `--compare bass` to measure bass→kick lock from a capture
  (requires source separation; full-mix kick band is noisy enough to
  approximate but not strictly bass-vs-kick)
- Per-section measurements (verse vs chorus pocket drift)
- Auto-tune: script reads diff → emits suggested `BASS_PUSH_BY_PROFILE`
  delta directly in JSON, ready for hand-pasting into band-room.js
- Compare AI captures across version history (regression detection)
