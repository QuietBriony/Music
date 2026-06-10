#!/usr/bin/env python3
"""
scripts/hazama-fm-compare-capture.py
====================================
Phase 2 of the Hazama FM measurement loop (see docs/HAZAMA-FM-MEASUREMENT.md).

Phase 1 (scripts/hazama-fm-measure.mjs) measures the DESIGN — the drum-frames
JSON + genre-flavor.js builders — and writes docs/hazama-fm-design-spec.json.
Phase 2 (this script) confirms the engine actually PLAYS that design: it
analyses a recorded fm.html playback and diffs the real timing/tone against
the design spec. This catches HumanGrooveGovernor / clamp / dynamic-ramp
overrides — the class of silent parameter-neutralisation found in the v260
audit (where v253/v256 bumps were not actually reaching the output).

Capture step (human, or Claude Code preview MCP):
  1. Open fm.html, pick a pill (e.g. lofi), let it play >= 60 s
  2. Click the FM ● REC button (audio/music-recorder.js MediaRecorder),
     then stop. fm.html saves a capture file.
  3. Convert to .wav if it came out .webm (or install ffmpeg for librosa).

Usage:
  python -X utf8 scripts/hazama-fm-compare-capture.py CAPTURE_FILE PILL
  python -X utf8 scripts/hazama-fm-compare-capture.py rec.wav lofi

  PILL = one of the design-spec pills. Drum pills (funk/jazz/lofi/techno)
  get a full timing diff; envelope pills (ambient/piano) get a tone/dynamics
  baseline only (no clear onsets to diff).

  CAVEAT: the GENRE pill biases a rotating generative brain, it does NOT
  hard-set EngineParams.mode. A capture measures the engine's live blend
  (currently dominated by whatever it is rendering), not a pure-pill
  isolation. Confirm EngineParams.mode === PILL + HazamaFlavorState.frameId
  set + audible RMS BEFORE recording, or you capture silence / the wrong
  pill. Phase 1 (hazama-fm-measure.mjs) is the per-pill isolated truth;
  Phase 2 is the live-blend reality check. See docs/HAZAMA-FM-MEASUREMENT.md
  "Capture caveat".

Notes:
  - wav / mp3 / m4a load via librosa directly. webm needs ffmpeg on PATH.
  - Reuses the same band-onset / spectral analysis as Band Room's
    scripts/compare-capture.py, for one measurement vocabulary across the stack.
  - Unit note: design microMs is the behind-beat offset added on top of the
    quantised sub-grid position. For on-beat kick/snare hits the captured
    "offset from nearest beat" ≈ design microMs + governor jitter, so the
    comparison is directionally meaningful. Off-beat hits (e.g. lofi kick on
    the "and") add noise to the average — treat the diff as a trend, not a
    laboratory measurement. The std (jitter) reflects the governor humanise.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SPEC_FILE = ROOT / "docs" / "hazama-fm-design-spec.json"
SR = 22050

# Drum pills carry timing data to diff; envelope pills only get a tone baseline.
DRUM_PILLS = {"funk", "jazz", "lofi", "techno"}
ENVELOPE_PILLS = {"ambient", "piano"}


# Onset-time resolution: librosa's default hop of 512 @ 22050 Hz quantizes
# onset times to ~23 ms — COARSER than the 10-20 ms pocket effects being
# measured. hop 128 gives ~5.8 ms resolution, which makes ms-level pocket
# comparison at least meaningful (still treat single-event numbers as noise;
# only the averages over n≳30 onsets carry signal).
HOP = 128


def _band_onset_times(y: np.ndarray, sr: int, lo_hz: float, hi_hz: float) -> np.ndarray:
    """Onset times within a frequency band (kick low, snare mid, hat high).
    Mirror of scripts/compare-capture.py, but at HOP=128 (~5.8 ms) instead of
    the default 512 (~23 ms) — the finer grid is required because Hazama FM's
    design effects are 10-20 ms."""
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    band = (freqs >= lo_hz) & (freqs <= hi_hz)
    if not band.any():
        return np.array([])
    energy = S[band, :].sum(axis=0)
    if energy.max() == 0:
        return np.array([])
    frames = librosa.onset.onset_detect(onset_envelope=energy, sr=sr, hop_length=HOP, units="frames")
    return librosa.frames_to_time(frames, sr=sr, hop_length=HOP)


def _spectral_summary(y: np.ndarray, sr: int) -> dict:
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
    rms = librosa.feature.rms(y=y)[0]
    rms_p95 = float(np.percentile(rms, 95)) if len(rms) else 0.0
    rms_p10 = float(np.percentile(rms, 10)) if len(rms) else 0.0
    dr_db = 20 * np.log10(max(rms_p95, 1e-6) / max(rms_p10, 1e-6)) if rms_p10 > 1e-6 else 0.0
    return {
        "centroid_avg_hz": round(float(centroid.mean()) if len(centroid) else 0.0, 1),
        "rolloff_p85_hz": round(float(rolloff.mean()) if len(rolloff) else 0.0, 1),
        "rms_mean": round(float(rms.mean()) if len(rms) else 0.0, 4),
        "rms_dynamic_range_db": round(float(dr_db), 2),
    }


def _offset_stats(onsets: np.ndarray, beats: np.ndarray) -> tuple[float, float, int]:
    """Mean + std offset (ms) of onsets from their nearest beat."""
    if len(beats) == 0 or len(onsets) == 0:
        return 0.0, 0.0, 0
    offs = [(o - beats[np.argmin(np.abs(beats - o))]) * 1000 for o in onsets]
    return float(np.mean(offs)), float(np.std(offs)), len(offs)


def analyse_capture(path: Path) -> dict:
    try:
        y, sr = librosa.load(str(path), sr=SR, mono=True)
    except Exception as e:
        print(f"\nERROR loading {path}: {type(e).__name__}: {e}", file=sys.stderr)
        if path.suffix.lower() == ".webm":
            print("  webm needs ffmpeg on PATH (winget install Gyan.FFmpeg),", file=sys.stderr)
            print("  or record/convert to .wav first.", file=sys.stderr)
        sys.exit(2)

    duration_sec = len(y) / sr
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo) if not isinstance(tempo, np.ndarray) else float(tempo.flat[0])

    kick = _band_onset_times(y, sr, 40, 180)
    snare = _band_onset_times(y, sr, 180, 450)
    kick_avg, kick_std, kick_n = _offset_stats(kick, beat_times)
    snare_avg, snare_std, snare_n = _offset_stats(snare, beat_times)

    if len(beat_times) >= 4:
        ibi = np.diff(beat_times)
        ibi_mean = float(np.mean(ibi))
        tempo_stability_pct = (float(np.std(ibi)) / ibi_mean * 100) if ibi_mean > 1e-6 else 0.0
    else:
        tempo_stability_pct = 0.0

    spectral = _spectral_summary(y, sr)
    return {
        "duration_sec": round(duration_sec, 2),
        "bpm": round(bpm, 2),
        "kick_onset_count": kick_n,
        "kick_offset_from_beat_avg_ms": round(kick_avg, 1),
        "kick_offset_from_beat_std_ms": round(kick_std, 1),
        "snare_onset_count": snare_n,
        "snare_offset_from_beat_avg_ms": round(snare_avg, 1),
        "snare_offset_from_beat_std_ms": round(snare_std, 1),
        "tempo_stability_pct": round(float(tempo_stability_pct), 2),
        **spectral,
    }


def load_design(pill: str) -> dict | None:
    if not SPEC_FILE.exists():
        print(f"ERROR: {SPEC_FILE} not found. Run `node scripts/hazama-fm-measure.mjs` first.", file=sys.stderr)
        sys.exit(2)
    spec = json.loads(SPEC_FILE.read_text(encoding="utf-8"))
    return (spec.get("pills") or {}).get(pill)


def diff_drum(actual: dict, design: dict) -> list[dict]:
    """Diff captured playback vs design-spec for a drum pill."""
    m = design.get("measured", {})
    insts = m.get("instruments", {})
    findings = []

    # Tempo authority is fm.js GENRE_PROFILES (spec `runtime.fm_profile_bpm`),
    # NOT the frame.bpm metadata field. Fall back to bpm_avg only for old specs.
    runtime = design.get("runtime", {}) or {}
    design_bpm = runtime.get("fm_profile_bpm") or m.get("bpm_avg")
    bpm_basis = "fm.js runtime" if runtime.get("fm_profile_bpm") else "frame avg (legacy spec)"
    if design_bpm is not None:
        d = actual["bpm"] - design_bpm
        # Capture BPM detection can octave-fold (half/double); flag only clear gaps.
        if abs(d) > 5 and abs(actual["bpm"] - 2 * design_bpm) > 5 and abs(actual["bpm"] - design_bpm / 2) > 5:
            findings.append({"axis": "bpm", "design": f"{design_bpm} ({bpm_basis})", "actual": actual["bpm"],
                             "delta": round(d, 1), "note": "engine tempo diverges from fm.js profile (or beat-track octave error)"})

    # Pocket ordering: design says snare drags more than kick (lofi 19.6 vs 9.2).
    dk = insts.get("kick", {}).get("micro_ms_avg")
    ds = insts.get("snare", {}).get("micro_ms_avg")
    if dk is not None and ds is not None:
        design_gap = ds - dk
        actual_gap = actual["snare_offset_from_beat_avg_ms"] - actual["kick_offset_from_beat_avg_ms"]
        # Both should have the same sign (snare behind kick). Flag sign flip.
        if design_gap > 2 and actual_gap < -2:
            findings.append({"axis": "snare-kick pocket", "design": f"snare +{round(design_gap,1)}ms vs kick",
                             "actual": f"{round(actual_gap,1)}ms", "note": "designed snare-behind-kick pocket NOT preserved in playback"})
    return findings


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        print("ERROR: need CAPTURE_FILE and PILL.", file=sys.stderr)
        return 2
    cap_path = Path(sys.argv[1])
    pill = sys.argv[2].lower()
    if not cap_path.exists():
        print(f"ERROR: capture file not found: {cap_path}", file=sys.stderr)
        return 2
    design = load_design(pill)
    if design is None:
        print(f"ERROR: pill '{pill}' not in design spec. Known: see docs/hazama-fm-design-spec.json", file=sys.stderr)
        return 2

    actual = analyse_capture(cap_path)

    print(f"\nHazama FM — Phase 2 capture compare  [{pill}]")
    print("=" * 64)
    print(f"capture: {cap_path.name}  ({actual['duration_sec']}s)")
    print("\nactual playback (from recording):")
    print(f"  bpm={actual['bpm']}  tempo_stability={actual['tempo_stability_pct']}%")
    print(f"  kick offset {actual['kick_offset_from_beat_avg_ms']}ms (std {actual['kick_offset_from_beat_std_ms']}, n={actual['kick_onset_count']})")
    print(f"  snare offset {actual['snare_offset_from_beat_avg_ms']}ms (std {actual['snare_offset_from_beat_std_ms']}, n={actual['snare_onset_count']})")
    print(f"  centroid={actual['centroid_avg_hz']}Hz  rolloff85={actual['rolloff_p85_hz']}Hz  RMS DR={actual['rms_dynamic_range_db']}dB")

    if pill in DRUM_PILLS:
        m = design.get("measured", {})
        rt = design.get("runtime", {}) or {}
        print(f"\ndesign (hazama-fm-design-spec.json):")
        print(f"  runtime bpm={rt.get('fm_profile_bpm')} (fm.js)  Transport.swing={rt.get('transport_swing')}  effective_swing={m.get('effective_swing_ms')}ms")
        print(f"  (frame bpm_avg={m.get('bpm_avg')} / frame swing_avg={m.get('swing_avg')} are display-only metadata)")
        insts = m.get("instruments", {})
        for inst in ("kick", "snare"):
            s = insts.get(inst, {})
            print(f"  {inst} microMs avg={s.get('micro_ms_avg')}")
        findings = diff_drum(actual, design)
        print("\ndiff (actual playback vs design):")
        if not findings:
            print("  no major divergence — engine plays the designed groove (within onset-detection tolerance)")
        else:
            for f in findings:
                print(f"  {f['axis']}: design {f['design']} / actual {f['actual']}  → {f['note']}")
    elif pill in ENVELOPE_PILLS:
        print("\n(envelope pill — no drum onsets to diff. tone/dynamics baseline above.)")
        print("design intent:", design.get("note", "(see design spec)"))

    print("\n" + "=" * 64)
    print("Phase 2 confirms the engine plays the Phase 1 design. Divergence =")
    print("HumanGrooveGovernor / clamp / dynamic-ramp reshaping the output —")
    print("investigate in engine.js (audit) or accept as intended humanise.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
