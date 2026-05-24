#!/usr/bin/env python3
"""
scripts/compare-capture.py
==========================

Compare a band-room AI 再現 capture (recorded via the v81 ● REC button)
against the target-spec-bands.json entry for the referenced song.

Closes the measurement loop:
  1. Open band-room.html, switch to AI 再現, pick the target song
  2. Click ● REC, let it play ≥ 30 s, click ■ STOP REC
  3. Download the .webm (auto-named band-room_<band>_<song>_<stamp>.webm)
  4. Run this script — get the numeric diff vs target

Usage:
  python -X utf8 scripts/compare-capture.py CAPTURE_FILE TARGET_KEY
  python -X utf8 scripts/compare-capture.py rec.webm tabasco/human-fly

  TARGET_KEY = band_id  or  band_id/song_id  (e.g. "tabasco" averages
  all Tabasco songs; "tabasco/human-fly" uses just that song).

Notes:
  - mp3 / wav / m4a load via librosa directly.
  - webm needs ffmpeg on PATH (Windows: `winget install Gyan.FFmpeg`,
    then restart shell). If webm fails, convert externally first.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).parent.parent
SPEC_FILE = ROOT / "docs" / "target-spec-bands.json"
SR = 22050


def _band_onset_times(y: np.ndarray, sr: int, lo_hz: float, hi_hz: float) -> np.ndarray:
    S = np.abs(librosa.stft(y, n_fft=2048))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    band = (freqs >= lo_hz) & (freqs <= hi_hz)
    if not band.any():
        return np.array([])
    energy = S[band, :].sum(axis=0)
    if energy.max() == 0:
        return np.array([])
    frames = librosa.onset.onset_detect(onset_envelope=energy, sr=sr, units="frames")
    return librosa.frames_to_time(frames, sr=sr)


def analyse_capture(path: Path) -> dict:
    """Same metrics as scripts/analyze-band-stems.py drum-stem path —
    treats the full mix as if it were a drum stem. Kick band (40-180 Hz)
    is dominated by kick onsets even with bass interference because the
    kick transient has more onset energy than bass note attacks."""
    try:
        y, sr = librosa.load(str(path), sr=SR, mono=True)
    except Exception as e:
        print(f"\nERROR loading {path}: {type(e).__name__}: {e}", file=sys.stderr)
        if path.suffix.lower() == ".webm":
            print("  webm needs ffmpeg on PATH. Try:", file=sys.stderr)
            print("    winget install Gyan.FFmpeg   (Windows)", file=sys.stderr)
            print("    then restart your shell.", file=sys.stderr)
        sys.exit(2)

    duration_sec = len(y) / sr
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo) if not isinstance(tempo, np.ndarray) else float(tempo.flat[0])

    kick_onsets = _band_onset_times(y, sr, 40, 180)
    if len(beat_times) > 0 and len(kick_onsets) > 0:
        offsets_ms = [(k - beat_times[np.argmin(np.abs(beat_times - k))]) * 1000
                      for k in kick_onsets]
        kick_off_avg = float(np.mean(offsets_ms))
        kick_off_std = float(np.std(offsets_ms))
    else:
        kick_off_avg = 0.0
        kick_off_std = 0.0

    return {
        "duration_sec": round(duration_sec, 2),
        "bpm": round(bpm, 2),
        "kick_onset_count": int(len(kick_onsets)),
        "kick_offset_from_beat_avg_ms": round(kick_off_avg, 1),
        "kick_offset_from_beat_std_ms": round(kick_off_std, 1),
    }


def resolve_target(spec: dict, key: str) -> dict | None:
    """Resolve 'band' (average across songs) or 'band/song' to a target dict
    with the same shape as analyse_capture output (drums-side fields only)."""
    if "/" in key:
        band, song = key.split("/", 1)
        entry = spec.get(band, {}).get(song)
        if not entry:
            return None
        d = entry.get("drums", {})
        return {
            "scope": f"{band}/{song}",
            "bpm": d.get("bpm"),
            "kick_offset_from_beat_avg_ms": d.get("kick_offset_from_beat_avg_ms"),
            "kick_offset_from_beat_std_ms": d.get("kick_offset_from_beat_std_ms"),
        }
    band_data = spec.get(key)
    if not band_data:
        return None
    bpms, offs, stds = [], [], []
    for sid, entry in band_data.items():
        if sid.startswith("_"):
            continue
        d = entry.get("drums", {})
        if d.get("bpm") is not None:
            bpms.append(d["bpm"])
        if d.get("kick_offset_from_beat_avg_ms") is not None:
            offs.append(d["kick_offset_from_beat_avg_ms"])
        if d.get("kick_offset_from_beat_std_ms") is not None:
            stds.append(d["kick_offset_from_beat_std_ms"])
    if not bpms:
        return None
    return {
        "scope": f"{key} (avg of {len(bpms)} songs)",
        "bpm": round(float(np.mean(bpms)), 2),
        "kick_offset_from_beat_avg_ms": round(float(np.mean(offs)), 1) if offs else None,
        "kick_offset_from_beat_std_ms": round(float(np.mean(stds)), 1) if stds else None,
    }


def fmt_delta(ai: float, target: float, unit: str = "ms") -> str:
    if ai is None or target is None:
        return "n/a"
    d = ai - target
    sign = "+" if d >= 0 else ""
    return f"{sign}{d:.1f} {unit}"


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 1
    capture_path = Path(sys.argv[1])
    target_key = sys.argv[2]
    if not capture_path.exists():
        print(f"capture file not found: {capture_path}", file=sys.stderr)
        return 1
    if not SPEC_FILE.exists():
        print(f"target spec not found: {SPEC_FILE}", file=sys.stderr)
        print("Run: python -X utf8 scripts/analyze-band-stems.py first.", file=sys.stderr)
        return 1
    spec = json.loads(SPEC_FILE.read_text(encoding="utf-8"))

    print(f"\nAnalysing capture: {capture_path}")
    ai = analyse_capture(capture_path)
    print(f"  duration       : {ai['duration_sec']}s")
    print(f"  bpm            : {ai['bpm']}")
    print(f"  kick onsets    : {ai['kick_onset_count']}")
    print(f"  kick pocket avg: {ai['kick_offset_from_beat_avg_ms']:+.1f} ms "
          f"(std {ai['kick_offset_from_beat_std_ms']:.1f}ms)")

    target = resolve_target(spec, target_key)
    if not target:
        print(f"\ntarget key '{target_key}' not found in spec", file=sys.stderr)
        return 1
    print(f"\nTarget: {target['scope']}")
    print(f"  bpm            : {target['bpm']}")
    print(f"  kick pocket avg: {target['kick_offset_from_beat_avg_ms']:+.1f} ms "
          f"(std {target['kick_offset_from_beat_std_ms']:.1f}ms)" if target['kick_offset_from_beat_avg_ms'] is not None else "")

    print(f"\nDiff (AI - target):")
    print(f"  bpm            : {fmt_delta(ai['bpm'], target['bpm'], 'BPM')}")
    print(f"  kick pocket avg: {fmt_delta(ai['kick_offset_from_beat_avg_ms'], target['kick_offset_from_beat_avg_ms'])}")

    # Quick verdict
    bpm_match = abs(ai['bpm'] - target['bpm']) < 1
    pocket_match = (target['kick_offset_from_beat_avg_ms'] is not None
                    and abs(ai['kick_offset_from_beat_avg_ms']
                            - target['kick_offset_from_beat_avg_ms']) < 15)
    print()
    print(f"  BPM match     : {'OK' if bpm_match else 'OFF'}")
    print(f"  Pocket within 15ms: {'OK' if pocket_match else 'OFF'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
