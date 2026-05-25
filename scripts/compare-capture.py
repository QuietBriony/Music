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


def _spectral_summary(y: np.ndarray, sr: int) -> dict:
    """v273: mirror of analyze-band-stems.py — tone + dynamics."""
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rms = librosa.feature.rms(y=y)[0]
    rms_p95 = float(np.percentile(rms, 95)) if len(rms) else 0.0
    rms_p10 = float(np.percentile(rms, 10)) if len(rms) else 0.0
    dr_db = 20 * np.log10(max(rms_p95, 1e-6) / max(rms_p10, 1e-6)) if rms_p10 > 1e-6 else 0.0
    return {
        "centroid_avg_hz": round(float(centroid.mean()) if len(centroid) else 0.0, 1),
        "rms_mean": round(float(rms.mean()) if len(rms) else 0.0, 4),
        "rms_peak_p95": round(rms_p95, 4),
        "rms_dynamic_range_db": round(float(dr_db), 2),
    }


def analyse_capture(path: Path) -> dict:
    """Same metrics as scripts/analyze-band-stems.py drum-stem path —
    treats the full mix as if it were a drum stem. Kick band (40-180 Hz)
    is dominated by kick onsets even with bass interference because the
    kick transient has more onset energy than bass note attacks.
    v273 also returns spectral_summary fields (tone + dynamics)."""
    try:
        y, sr = librosa.load(str(path), sr=SR, mono=True)
    except Exception as e:
        print(f"\nERROR loading {path}: {type(e).__name__}: {e}", file=sys.stderr)
        if path.suffix.lower() == ".webm":
            print("  webm needs ffmpeg on PATH. Try:", file=sys.stderr)
            print("    winget install Gyan.FFmpeg   (Windows)", file=sys.stderr)
            print("    then restart your shell.", file=sys.stderr)
            print("  (v272+ band-room ● REC writes .wav directly — no ffmpeg needed.)", file=sys.stderr)
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

    spectral = _spectral_summary(y, sr)
    return {
        "duration_sec": round(duration_sec, 2),
        "bpm": round(bpm, 2),
        "kick_onset_count": int(len(kick_onsets)),
        "kick_offset_from_beat_avg_ms": round(kick_off_avg, 1),
        "kick_offset_from_beat_std_ms": round(kick_off_std, 1),
        # v273 additions
        "centroid_avg_hz": spectral["centroid_avg_hz"],
        "rms_mean": spectral["rms_mean"],
        "rms_peak_p95": spectral["rms_peak_p95"],
        "rms_dynamic_range_db": spectral["rms_dynamic_range_db"],
    }


def _pick_field(entry: dict, k: str):
    """v276: tone + dynamics live under entry['mix'] (full-mix, fair vs AI
    capture which is also full-mix). Pocket/onset measures live under
    entry['drums'] (drum stem, more accurate kick detection). Falls back
    to drums-only if mix isn't present (older spec files)."""
    mix_keys = {"centroid_avg_hz", "rms_mean", "rms_peak_p95", "rms_dynamic_range_db"}
    if k in mix_keys:
        v = entry.get("mix", {}).get(k)
        if v is not None:
            return v
    return entry.get("drums", {}).get(k)


def resolve_target(spec: dict, key: str) -> dict | None:
    """Resolve 'band' (average across songs) or 'band/song' to a target dict.
    Pocket/BPM from drums, tone/dynamics from mix (v276)."""
    keys_we_want = (
        "bpm",
        "kick_offset_from_beat_avg_ms",
        "kick_offset_from_beat_std_ms",
        "centroid_avg_hz",
        "rms_mean",
        "rms_peak_p95",
        "rms_dynamic_range_db",
    )
    if "/" in key:
        band, song = key.split("/", 1)
        entry = spec.get(band, {}).get(song)
        if not entry:
            return None
        out = {"scope": f"{band}/{song}"}
        for k in keys_we_want:
            out[k] = _pick_field(entry, k)
        return out
    band_data = spec.get(key)
    if not band_data:
        return None
    accum: dict[str, list[float]] = {k: [] for k in keys_we_want}
    for sid, entry in band_data.items():
        if sid.startswith("_"):
            continue
        for k in keys_we_want:
            v = _pick_field(entry, k)
            if v is not None:
                accum[k].append(v)
    if not accum["bpm"]:
        return None
    out = {"scope": f"{key} (avg of {len(accum['bpm'])} songs)"}
    for k in keys_we_want:
        out[k] = round(float(np.mean(accum[k])), 2) if accum[k] else None
    return out


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
    print(f"  brightness     : {ai['centroid_avg_hz']:.0f} Hz (spectral centroid)")
    print(f"  loudness       : RMS mean {ai['rms_mean']:.3f}, peak {ai['rms_peak_p95']:.3f}")
    print(f"  dynamic range  : {ai['rms_dynamic_range_db']:.1f} dB")

    target = resolve_target(spec, target_key)
    if not target:
        print(f"\ntarget key '{target_key}' not found in spec", file=sys.stderr)
        return 1
    print(f"\nTarget: {target['scope']}")
    print(f"  bpm            : {target.get('bpm')}")
    if target.get('kick_offset_from_beat_avg_ms') is not None:
        print(f"  kick pocket avg: {target['kick_offset_from_beat_avg_ms']:+.1f} ms "
              f"(std {target.get('kick_offset_from_beat_std_ms', 0):.1f}ms)")
    if target.get('centroid_avg_hz') is not None:
        print(f"  brightness     : {target['centroid_avg_hz']:.0f} Hz")
    if target.get('rms_dynamic_range_db') is not None:
        print(f"  dynamic range  : {target['rms_dynamic_range_db']:.1f} dB")

    print(f"\nDiff (AI - target):")
    print(f"  bpm            : {fmt_delta(ai['bpm'], target.get('bpm'), 'BPM')}")
    print(f"  kick pocket avg: {fmt_delta(ai['kick_offset_from_beat_avg_ms'], target.get('kick_offset_from_beat_avg_ms'))}")
    print(f"  brightness     : {fmt_delta(ai['centroid_avg_hz'], target.get('centroid_avg_hz'), 'Hz')}")
    print(f"  dynamic range  : {fmt_delta(ai['rms_dynamic_range_db'], target.get('rms_dynamic_range_db'), 'dB')}")

    # Quick verdict
    bpm_match = abs(ai['bpm'] - target.get('bpm', ai['bpm'])) < 1
    pocket_target = target.get('kick_offset_from_beat_avg_ms')
    pocket_match = (pocket_target is not None
                    and abs(ai['kick_offset_from_beat_avg_ms'] - pocket_target) < 15)
    centroid_target = target.get('centroid_avg_hz')
    centroid_match = (centroid_target is not None
                      and abs(ai['centroid_avg_hz'] - centroid_target) / max(centroid_target, 1) < 0.30)  # within 30%
    dr_target = target.get('rms_dynamic_range_db')
    dr_match = (dr_target is not None
                and abs(ai['rms_dynamic_range_db'] - dr_target) < 5)  # within 5 dB
    print()
    print(f"  BPM match              : {'OK' if bpm_match else 'OFF'}")
    print(f"  Pocket within 15 ms    : {'OK' if pocket_match else 'OFF'}")
    print(f"  Brightness within 30 %  : {'OK' if centroid_match else 'OFF'}")
    print(f"  Dynamic range within 5dB: {'OK' if dr_match else 'OFF'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
