#!/usr/bin/env python3
"""
scripts/analyze-band-stems.py
=============================

Extract target-spec measurements from any band's stems via librosa.
Music-stack wide tool: auto-discovers bands from presets/bands.json
(both `bands` and `reference_libraries`), iterates their songs, and
writes a unified per-band per-song spec.

Output drives AI 再現 calibration — gives concrete numbers to aim at
("kick avg +8 ms vs Tabasco -3 ms") instead of qualitative feedback
("groove feels off"). Was scripts/analyze-tabasco-stems.py — renamed
v264-era to reflect that this is the general workflow, not Tabasco
specific.

Usage:
  python -X utf8 scripts/analyze-band-stems.py
    → analyses every band/song that has a drums.mp3 stem

  python -X utf8 scripts/analyze-band-stems.py tabasco
  python -X utf8 scripts/analyze-band-stems.py tabasco/human-fly
    → restrict to a band or band/song

Output:
  docs/target-spec-bands.json  — machine-readable nested spec
  Console summary — quick human read

Per-song measures:
  drums: bpm (librosa.beat), band-filtered kick (40-180Hz) / snare
         (180-1200Hz) / hat (4-10kHz) onset times, kick offset-from-beat
         (avg + std, ms) — characterises pocket tendency
  bass:  onset times, % locked to a kick within ±50 ms (the v249 lock
         window), avg bass-from-kick offset ms (negative = push)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).parent.parent
BANDS_FILE = ROOT / "presets" / "bands.json"
OUT_FILE = ROOT / "docs" / "target-spec-bands.json"

SR = 22050  # downsample for speed; onset precision still adequate
LOCK_WINDOW_SEC = 0.050  # matches v249 / v250 ±50 ms pocket window


def _band_onset_times(y: np.ndarray, sr: int, lo_hz: float, hi_hz: float) -> np.ndarray:
    """Onset times (sec) on a frequency-band-filtered signal. librosa
    default delta auto-scales — robust across stem amplitudes."""
    S = np.abs(librosa.stft(y, n_fft=2048))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    band = (freqs >= lo_hz) & (freqs <= hi_hz)
    if not band.any():
        return np.array([])
    band_energy = S[band, :].sum(axis=0)
    if band_energy.max() == 0:
        return np.array([])
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=band_energy, sr=sr, units="frames"
    )
    return librosa.frames_to_time(onset_frames, sr=sr)


def analyse_drum_stem(path: Path) -> dict:
    y, sr = librosa.load(str(path), sr=SR, mono=True)
    duration_sec = len(y) / sr

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo) if not isinstance(tempo, np.ndarray) else float(tempo.flat[0])

    all_onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    kick_onsets = _band_onset_times(y, sr, 40, 180)
    snare_onsets = _band_onset_times(y, sr, 180, 1200)
    hat_onsets = _band_onset_times(y, sr, 4000, 10000)

    if len(beat_times) > 0 and len(kick_onsets) > 0:
        offsets_ms = []
        for k in kick_onsets:
            nearest = beat_times[np.argmin(np.abs(beat_times - k))]
            offsets_ms.append((k - nearest) * 1000)
        kick_offset_avg = float(np.mean(offsets_ms))
        kick_offset_std = float(np.std(offsets_ms))
    else:
        kick_offset_avg = 0.0
        kick_offset_std = 0.0

    return {
        "duration_sec": round(duration_sec, 2),
        "bpm": round(bpm, 2),
        "beat_count": int(len(beat_times)),
        "total_drum_onsets": int(len(all_onsets)),
        "kick_onset_count": int(len(kick_onsets)),
        "snare_onset_count": int(len(snare_onsets)),
        "hat_onset_count": int(len(hat_onsets)),
        "kick_offset_from_beat_avg_ms": round(kick_offset_avg, 1),
        "kick_offset_from_beat_std_ms": round(kick_offset_std, 1),
        "kick_onsets_first_8_ms": [round(float(t) * 1000, 1) for t in kick_onsets[:8]],
        "snare_onsets_first_8_ms": [round(float(t) * 1000, 1) for t in snare_onsets[:8]],
        # Private: full kick onsets for bass-lock calc (not written to JSON)
        "_kick_onsets_all_sec": kick_onsets.tolist(),
    }


def analyse_bass_lock(bass_path: Path, kick_onsets_sec: list[float]) -> dict:
    y, sr = librosa.load(str(bass_path), sr=SR, mono=True)
    bass_onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    if len(kick_onsets_sec) == 0 or len(bass_onsets) == 0:
        return {"bass_onset_count": int(len(bass_onsets)), "locked_count": 0,
                "locked_pct": 0.0, "avg_offset_from_kick_ms": 0.0}
    kicks = np.array(kick_onsets_sec)
    locked = 0
    offsets_ms = []
    for b in bass_onsets:
        diffs = kicks - b
        nearest_idx = int(np.argmin(np.abs(diffs)))
        delta = diffs[nearest_idx]
        if abs(delta) <= LOCK_WINDOW_SEC:
            locked += 1
            offsets_ms.append(delta * 1000)
    avg_off = float(np.mean(offsets_ms)) if offsets_ms else 0.0
    return {
        "bass_onset_count": int(len(bass_onsets)),
        "locked_count": locked,
        "locked_pct": round(locked / len(bass_onsets), 3),
        "avg_offset_from_kick_ms": round(avg_off, 1),
    }


def _load_band_registry() -> dict:
    """Merge `bands` + `reference_libraries` into a flat band_id -> band dict.
    Both share the same shape (stems_dir, songs[]); the distinction is
    organisational, not structural."""
    raw = json.loads(BANDS_FILE.read_text(encoding="utf-8"))
    merged = {}
    merged.update(raw.get("bands", {}))
    merged.update(raw.get("reference_libraries", {}))
    return merged


def _filter_targets(registry: dict, args: list[str]) -> list[tuple[str, str, Path]]:
    """Resolve CLI args to a list of (band_id, song_id, song_dir) tuples.
    No args → every band's every song that has a drums.mp3."""
    targets: list[tuple[str, str, Path]] = []
    for band_id, band in registry.items():
        stems_dir = ROOT / band.get("stems_dir", "")
        if not stems_dir.exists():
            continue
        for song in band.get("songs", []):
            song_id = song.get("id")
            if not song_id:
                continue
            song_dir = stems_dir / song_id
            drum_path = song_dir / "drums.mp3"
            if not drum_path.exists():
                continue
            spec = (band_id, song_id, song_dir)
            if not args:
                targets.append(spec)
                continue
            for arg in args:
                if arg == band_id or arg == f"{band_id}/{song_id}":
                    targets.append(spec)
                    break
    return targets


def main() -> int:
    args = sys.argv[1:]
    registry = _load_band_registry()
    targets = _filter_targets(registry, args)
    if not targets:
        print("no targets matched", file=sys.stderr)
        return 1

    out: dict = {
        "_meta": {
            "lock_window_sec": LOCK_WINDOW_SEC,
            "sr_hz": SR,
            "generated_by": "scripts/analyze-band-stems.py",
            "purpose": (
                "Per-band, per-song target spec for AI 再現 calibration. "
                "kick_offset_from_beat_avg_ms = pocket tendency "
                "(negative=pushed, positive=laid-back). "
                "bass.locked_pct = ground truth for bass→kick lock tightness "
                "(matches v249's ±50 ms snap window)."
            ),
        }
    }

    current_band = None
    for band_id, song_id, song_dir in targets:
        if band_id != current_band:
            print(f"\n### band: {band_id} ###", flush=True)
            current_band = band_id
            out.setdefault(band_id, {})

        drum_path = song_dir / "drums.mp3"
        bass_path = song_dir / "bass.mp3"
        print(f"\n=== {band_id}/{song_id} ===", flush=True)
        drum = analyse_drum_stem(drum_path)
        print(f"  bpm           : {drum['bpm']}")
        print(f"  duration      : {drum['duration_sec']}s")
        print(f"  drum onsets   : total {drum['total_drum_onsets']} "
              f"(kick {drum['kick_onset_count']} / snare {drum['snare_onset_count']} / hat {drum['hat_onset_count']})")
        print(f"  kick pocket   : avg {drum['kick_offset_from_beat_avg_ms']:+.1f} ms "
              f"(std {drum['kick_offset_from_beat_std_ms']:.1f}ms)")

        bass = None
        if bass_path.exists():
            bass = analyse_bass_lock(bass_path, drum["_kick_onsets_all_sec"])
            print(f"  bass onsets   : {bass['bass_onset_count']}")
            print(f"  bass→kick lock: {bass['locked_pct'] * 100:.1f}% "
                  f"({bass['locked_count']} of {bass['bass_onset_count']}, "
                  f"avg offset {bass['avg_offset_from_kick_ms']:+.1f} ms)")

        drum_public = {k: v for k, v in drum.items() if not k.startswith("_")}
        entry = {"drums": drum_public}
        if bass:
            entry["bass"] = bass
        out[band_id][song_id] = entry

    OUT_FILE.parent.mkdir(exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {OUT_FILE.relative_to(ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
