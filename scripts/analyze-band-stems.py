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

  python -X utf8 scripts/analyze-band-stems.py tabasco/human-fly --out C:/workspace/music-stack-worker/reports/target-spec.json
    -> write the JSON report outside the repo for worker-gaming batch runs

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

if any(arg in ("-h", "--help") for arg in sys.argv[1:]):
    print(__doc__.strip())
    raise SystemExit(0)

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


def analyse_full_mix(song_dir: Path) -> dict | None:
    """v276: load all 4 stems (vocals/drums/bass/other), sum them as a
    rough mixdown, run spectral_summary. The drum-stem-only target was
    unfair to compare against AI 再現 full-mix capture — bass + chord pad
    pull centroid down ~2 kHz, comp processing changes DR. This mix is
    closer to what AI 再現 actually outputs.

    Returns None if any stem file is missing."""
    stems = ["vocals", "drums", "bass", "other"]
    buffers = []
    for name in stems:
        p = song_dir / f"{name}.mp3"
        if not p.exists():
            return None
        y, sr = librosa.load(str(p), sr=SR, mono=True)
        buffers.append(y)
    # Trim to shortest length, then sum
    n = min(len(b) for b in buffers)
    mix = np.zeros(n, dtype=np.float32)
    for b in buffers:
        mix += b[:n]
    # Normalize to avoid clipping (target peak around -3 dB)
    peak = np.abs(mix).max()
    if peak > 0:
        mix = mix * (0.707 / peak)  # -3 dB
    return _spectral_summary(mix, SR)


def _spectral_summary(y: np.ndarray, sr: int) -> dict:
    """v273 + v283: tone + dynamics summary — added for AI 再現 vs real diff.
    - centroid_avg_hz: brightness center (synth often dimmer or harsher than real samples)
    - rolloff_p85_hz (v283): freq below which 85 % of spectral energy lives —
      catches "air" / top-end character that centroid misses
    - rms_dynamic_range_db: perceived-loudness spread (procedural music is
      often flat — low DR — vs real songs which breathe across sections)."""
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
    rms = librosa.feature.rms(y=y)[0]
    rms_max = float(rms.max()) if len(rms) else 0.0
    rms_mean = float(rms.mean()) if len(rms) else 0.0
    # Use 95th-percentile peak vs 10th-percentile quiet to avoid outliers
    rms_p95 = float(np.percentile(rms, 95)) if len(rms) else rms_max
    rms_p10 = float(np.percentile(rms, 10)) if len(rms) else rms_mean
    dr_db = 20 * np.log10(max(rms_p95, 1e-6) / max(rms_p10, 1e-6)) if rms_p10 > 1e-6 else 0.0
    return {
        "centroid_avg_hz": round(float(centroid.mean()) if len(centroid) else 0.0, 1),
        "rolloff_p85_hz": round(float(rolloff.mean()) if len(rolloff) else 0.0, 1),
        "rms_mean": round(rms_mean, 4),
        "rms_peak_p95": round(rms_p95, 4),
        "rms_dynamic_range_db": round(float(dr_db), 2),
    }


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
    spectral = _spectral_summary(y, sr)

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

    # v283: tempo stability — inter-beat interval coefficient of variation.
    # Real humans drift 1-3 %, a stiff drum machine ≈ 0.1 %, an AI scheduler
    # with humanize ±10 % typically lands 2-5 %. Useful diagnostic for the
    # "feels robotic" vs "feels alive" axis.
    if len(beat_times) >= 4:
        ibi = np.diff(beat_times)
        ibi_mean = float(np.mean(ibi))
        ibi_std = float(np.std(ibi))
        tempo_stability_pct = (ibi_std / ibi_mean * 100) if ibi_mean > 1e-6 else 0.0
    else:
        tempo_stability_pct = 0.0

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
        # v273: tone + dynamics (diagnoses AI vs real differences)
        "centroid_avg_hz": spectral["centroid_avg_hz"],
        "rolloff_p85_hz": spectral["rolloff_p85_hz"],  # v283
        "rms_mean": spectral["rms_mean"],
        "rms_peak_p95": spectral["rms_peak_p95"],
        "rms_dynamic_range_db": spectral["rms_dynamic_range_db"],
        "tempo_stability_pct": round(float(tempo_stability_pct), 2),  # v283
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


def _parse_cli(argv: list[str]) -> tuple[list[str], Path]:
    targets: list[str] = []
    out_file = OUT_FILE
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in ("--out", "--output"):
            if i + 1 >= len(argv):
                raise SystemExit(f"{arg} requires a path")
            out_file = Path(argv[i + 1])
            if not out_file.is_absolute():
                out_file = ROOT / out_file
            i += 2
            continue
        if arg in ("-h", "--help"):
            print(__doc__.strip())
            raise SystemExit(0)
        targets.append(arg)
        i += 1
    return targets, out_file


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def main() -> int:
    args, out_file = _parse_cli(sys.argv[1:])
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
        print(f"  tempo stability: {drum['tempo_stability_pct']:.2f}% "
              f"(IBI CV, 0 = robotic / 1-3 = human / 5 + = loose)")

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
        # v276: full-mix tone + dynamics for fair AI vs target comparison
        mix = analyse_full_mix(song_dir)
        if mix:
            entry["mix"] = mix
            print(f"  full-mix      : centroid {mix['centroid_avg_hz']:.0f} Hz, "
                  f"rolloff {mix['rolloff_p85_hz']:.0f} Hz, DR {mix['rms_dynamic_range_db']:.1f} dB")
        out[band_id][song_id] = entry

    # Merge into any existing spec so a SCOPED run (one band or band/song,
    # as MEASUREMENT-LOOP §1 recommends) refreshes only those entries
    # instead of overwriting the file with just the processed song(s) and
    # wiping every other song's target. A full run still updates everything
    # because `out` then contains every song. Without this, the documented
    # `analyze-band-stems.py tabasco/human-fly` quietly destroyed the other
    # 12 songs' targets.
    final = out
    if out_file.exists():
        try:
            prior = json.loads(out_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            prior = None
        if isinstance(prior, dict):
            merged = dict(prior)
            merged["_meta"] = out["_meta"]
            for band_id, songs in out.items():
                if band_id == "_meta":
                    continue
                if isinstance(merged.get(band_id), dict) and isinstance(songs, dict):
                    merged[band_id] = {**merged[band_id], **songs}
                else:
                    merged[band_id] = songs
            final = merged

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8")
    scoped = bool(args)
    print(f"\nwrote {_display_path(out_file)}"
          f"{' (merged scoped update; other songs preserved)' if scoped else ''}",
          flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
