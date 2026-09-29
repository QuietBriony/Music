#!/usr/bin/env python3
"""Measure Tabasco drum transcription against the original separated stem.

The reference detector uses band-limited *spectral flux*, unlike the full-band
onset/energy classifier in transcribe-stem-lines.py. Its high-band output is a
cymbal-activity proxy, not a ground-truth hat label. This is a data-path
baseline: the light-row selection mirrors band-room.js, but browser kit attack,
section crash hints and final WebAudio scheduling are not measured here.

Usage (CPU only):
  python scripts/measure-part-fidelity.py --song human-fly --out report.json
  python scripts/measure-part-fidelity.py --all-tabasco --out report.json
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import statistics

import librosa
import numpy as np
from scipy.signal import find_peaks


ROOT = Path(__file__).resolve().parent.parent
CLASS = ("kick", "snare", "hat", "crash")
SR = 22050
HOP = 128
FFT = 1024
BANDS = {"kick": (40, 180), "snare": (180, 1200), "hat": (4000, 10000)}
# Calibrated once on the documented Human Fly 9–16 bar count envelope
# (roughly K41/S21/high40); apply unchanged to every other song.
PEAK_FACTOR = {"kick": 1.0, "snare": 0.8, "hat": 0.6}
WINDOW_MS = 30


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def rows_by_bar(events: list) -> dict[int, list]:
    bars = defaultdict(list)
    for row in events:
        bars[int(row[0])].append(row)
    return bars


def light_rows_current(rows: list, limit: int = 8) -> list:
    """Historical br-236 data selection, retained for before/after comparison."""
    if len(rows) <= limit:
        return rows[:]
    slots = max(1, int(limit))
    best = [None] * slots
    for row in rows:
        step = max(0, min(float(row[1] or 0), 15.999))
        slot = max(0, min(int(step / 16 * slots), slots - 1))
        prev = best[slot]
        if prev is None or float(row[4] or 0) > float(prev[4] or 0):
            best[slot] = row
    picked = [row for row in best if row is not None]
    if len(picked) < slots:
        for row in sorted(rows, key=lambda item: float(item[4] or 0), reverse=True):
            if len(picked) >= slots:
                break
            if all(row is not existing for existing in picked):
                picked.append(row)
    return sorted(picked, key=lambda item: float(item[1] or 0))


def light_rows_priority(rows: list, limit: int = 8) -> list:
    """Band Room class-aware light budget: replace selected hats with missed core."""
    if len(rows) <= limit:
        return rows[:]
    picked = light_rows_current(rows, limit)
    priority = {3: 3, 1: 2, 0: 1}
    missing = [row for row in rows
               if int(row[3]) in priority and all(row is not item for item in picked)]
    missing.sort(key=lambda row: (priority[int(row[3])], float(row[4] or 0)), reverse=True)
    for row in missing:
        hats = [item for item in picked if int(item[3]) == 2]
        if not hats:
            break
        weakest = min(hats, key=lambda item: float(item[4] or 0))
        picked.pop(next(i for i, item in enumerate(picked) if item is weakest))
        picked.append(row)
    return sorted(picked, key=lambda row: float(row[1] or 0))


def candidate_events(rows: list, bpm: float, start_bar: int) -> dict[str, list]:
    step_seconds = 60 / bpm / 4
    grouped = {name: [] for name in CLASS}
    for row in rows:
        cls = CLASS[int(row[3])]
        t = ((int(row[0]) - start_bar) * 16 + float(row[1])) * step_seconds
        grouped[cls].append((t, float(row[4])))
    return grouped


def reference_flux(stem: Path, start_seconds: float, duration: float,
                   bars: int) -> tuple[dict[str, list], list[float]]:
    # Slight pre-roll avoids an STFT edge dropping a downbeat at the crop start.
    preroll = min(0.12, start_seconds)
    y, sr = librosa.load(str(stem), sr=SR, mono=True,
                         offset=start_seconds - preroll, duration=duration + preroll)
    spec = np.abs(librosa.stft(y, n_fft=FFT, hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=FFT)
    bar_rms = []
    for bar in range(bars):
        left = round((preroll + bar * duration / bars) * sr)
        right = round((preroll + (bar + 1) * duration / bars) * sr)
        segment = y[left:right]
        bar_rms.append(round(float(np.sqrt(np.mean(segment ** 2))), 5) if len(segment) else 0.0)
    result = {}
    low_flux = None
    for name, (low, high) in BANDS.items():
        band = spec[(freqs >= low) & (freqs <= high)]
        flux = np.r_[0, np.maximum(0, np.diff(band, axis=1)).mean(axis=0)]
        positive = flux[flux > 0]
        if len(positive) == 0:
            result[name] = []
            continue
        # Per-band robust scale. A short refractory period suppresses one hit's
        # decay but retains 16th notes at the fastest Tabasco song tempo.
        threshold = float(np.percentile(positive, 95)) * PEAK_FACTOR[name]
        peaks, _ = find_peaks(flux, height=threshold,
                              prominence=threshold * 0.5,
                              distance=max(1, int(0.072 * sr / HOP)))
        if name == "kick":
            low_flux = flux
        if name == "snare" and low_flux is not None:
            # Full-band mid peaks include kick bleed. Keep the independent
            # mid-band attack when low-band flux is not overwhelmingly larger.
            peaks = peaks[low_flux[peaks] / (flux[peaks] + 1e-10) < 5.5]
        detected = []
        for frame in peaks:
            t = frame * HOP / sr - preroll
            if 0 <= t < duration:
                detected.append((float(t), float(flux[frame])))
        result[name] = detected
    return result, bar_rms


def match_events(reference: list, candidate: list, tolerance_ms: int = WINDOW_MS) -> dict:
    """One-to-one nearest matching with deterministic tie order."""
    pairs = []
    for i, (ref_time, _) in enumerate(reference):
        for j, (cand_time, _) in enumerate(candidate):
            delta_ms = (cand_time - ref_time) * 1000
            if abs(delta_ms) <= tolerance_ms:
                pairs.append((abs(delta_ms), i, j, delta_ms))
    used_ref, used_cand, deltas, strengths, velocities = set(), set(), [], [], []
    for _, i, j, delta in sorted(pairs):
        if i in used_ref or j in used_cand:
            continue
        used_ref.add(i)
        used_cand.add(j)
        deltas.append(delta)
        strengths.append(reference[i][1])
        velocities.append(candidate[j][1])
    tp = len(deltas)
    precision = tp / len(candidate) if candidate else 0.0
    recall = tp / len(reference) if reference else 0.0
    corr = None
    if tp >= 3 and np.std(strengths) > 0 and np.std(velocities) > 0:
        corr = round(float(np.corrcoef(strengths, velocities)[0, 1]), 3)
    return {
        "reference": len(reference), "candidate": len(candidate), "matched": tp,
        "precision": round(precision, 3), "recall": round(recall, 3),
        "f1": round(2 * precision * recall / (precision + recall), 3) if precision + recall else 0.0,
        "median_abs_delta_ms": round(statistics.median(map(abs, deltas)), 1) if deltas else None,
        "mean_signed_delta_ms": round(statistics.mean(deltas), 1) if deltas else None,
        "velocity_flux_correlation": corr,
    }


def measure_song(song: str, start_bar: int, bars: int) -> dict:
    song_file = ROOT / "presets" / f"drum-frames-tabasco-{song}.json"
    stem = ROOT / "presets" / "tabasco-stems" / song / "drums.mp3"
    data = json.loads(song_file.read_text(encoding="utf-8"))
    line = data.get("drum_line") or {}
    total_bars = int(data["total_bars"])
    if start_bar + bars > total_bars:
        raise ValueError(f"{song}: requested bar range exceeds {total_bars} bars")
    fitted = float(line.get("bpm_fit") or data.get("bpm"))
    nominal = float(data["bpm"])
    bar_seconds = 240 / fitted
    start_seconds = start_bar * bar_seconds
    duration = bars * bar_seconds
    reference, bar_rms = reference_flux(stem, start_seconds, duration, bars)
    by_bar = rows_by_bar(line.get("events") or [])
    original, current, priority = [], [], []
    counts = {key: Counter() for key in ("original", "current_light", "priority_light")}
    no_line = []
    peak_rows_per_bar = 0
    for bar in range(start_bar, start_bar + bars):
        rows = by_bar.get(bar, [])
        peak_rows_per_bar = max(peak_rows_per_bar, len(rows))
        if not rows:
            no_line.append({"bar": bar + 1, "stem_rms": bar_rms[bar - start_bar]})
        original.extend(rows)
        curr = light_rows_current(rows)
        prio = light_rows_priority(rows)
        current.extend(curr)
        priority.extend(prio)
        for key, selection in (("original", rows), ("current_light", curr), ("priority_light", prio)):
            counts[key].update(CLASS[int(row[3])] for row in selection)
    candidates = {
        "full_data": candidate_events(original, fitted, start_bar),
        "current_light_data": candidate_events(current, fitted, start_bar),
        "priority_light_data": candidate_events(priority, fitted, start_bar),
    }
    metrics = {}
    if line.get("events"):
        for profile, classes in candidates.items():
            metrics[profile] = {
                name: match_events(reference[name], classes[name])
                for name in BANDS
            }
    # A wider diagnostic exposes detector-to-transcriber timing convention;
    # the stricter ±30 ms score above remains the comparison target.
    diagnostic_40ms = ({
        name: match_events(reference[name], candidates["full_data"][name], 40)
        for name in BANDS
    } if line.get("events") else None)
    whole_counts = {key: Counter() for key in ("original", "current_light", "priority_light")}
    whole_missing = []
    whole_peak = 0
    for bar in range(total_bars):
        rows = by_bar.get(bar, [])
        whole_peak = max(whole_peak, len(rows))
        if not rows:
            whole_missing.append(bar + 1)
        for key, selection in (("original", rows),
                               ("current_light", light_rows_current(rows)),
                               ("priority_light", light_rows_priority(rows))):
            whole_counts[key].update(CLASS[int(row[3])] for row in selection)
    return {
        "song": song, "bars_one_based": [start_bar + 1, start_bar + bars],
        "assessment": "diagnostic_only_unaligned_detector" if line.get("events") else "not_scored_frame_fallback",
        "bpm_nominal": nominal, "bpm_fit": fitted,
        "nominal_drift_ms_at_window_end": round(duration * (fitted / nominal - 1) * 1000, 1),
        "source_sha256": {"drums_mp3": sha256(stem), "song_json": sha256(song_file)},
        "transcribed_line_present": bool(line.get("events")),
        "bars_without_transcribed_drums_in_window": no_line,
        "peak_transcribed_hits_per_bar": peak_rows_per_bar,
        "peak_light_hits_per_bar": 8,
        "counts": {key: dict(value) for key, value in counts.items()},
        "metrics": metrics,
        "full_song_data_path": {
            "total_bars": total_bars,
            "bars_without_transcribed_drums": whole_missing,
            "max_transcribed_hits_per_bar": whole_peak,
            "counts": {key: dict(value) for key, value in whole_counts.items()},
        },
        "full_data_diagnostic_40ms": diagnostic_40ms,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--song", help="Tabasco song id, e.g. human-fly")
    source.add_argument("--all-tabasco", action="store_true")
    parser.add_argument("--start-bar", type=int, default=9, help="1-based; default 9")
    parser.add_argument("--bars", type=int, default=8)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.start_bar < 1 or args.bars < 1:
        parser.error("start-bar and bars must be positive")
    songs = [args.song] if args.song else [
        "tabasco", "hey", "i-got-a-feeling", "under-the-moon",
        "electric-sheep", "human-fly", "sister"
    ]
    report = {
        "schema_version": 1,
        "validation_status": "exploratory_not_a_fidelity_gate",
        "method": "band-limited spectral-flux reference vs transcription rows at fitted BPM",
        "reference_caveat": "High-band transients include cymbal, snare bleed and separation artifacts; not verified hat labels.",
        "candidate_caveat": "Rows and light thinning, not captured Band Room WebAudio; kit attack and section hints excluded.",
        "timing_caveat": "No detector-latency or per-bar alignment applied. Human Fly has about +27 ms candidate-minus-flux offset; raw ±30 ms F1 is diagnostic only.",
        "timing_tolerance_ms": WINDOW_MS,
        "reference_detector": {
            "sample_rate": SR, "fft": FFT, "hop": HOP,
            "bands_hz": BANDS, "peak_factor_p95": PEAK_FACTOR,
            "snare_low_to_mid_flux_max": 5.5,
            "calibration": "Factors calibrated on Human Fly bars 9–16 against the prior class-count envelope and inspected transcription alignment; exploratory, not independent ground-truth labels.",
        },
        "songs": [measure_song(song, args.start_bar - 1, args.bars) for song in songs],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for song in report["songs"]:
        if not song["transcribed_line_present"]:
            print(f"{song['song']}: no drum_line; frame fallback requires schedule capture")
            continue
        full = song["metrics"]["full_data"]
        light = song["metrics"]["current_light_data"]
        print(f"{song['song']}: K {full['kick']['matched']}/{full['kick']['reference']} "
              f"S {full['snare']['matched']}/{full['snare']['reference']} "
              f"high {full['hat']['matched']}/{full['hat']['reference']} "
              f"light K {light['kick']['candidate']} S {light['snare']['candidate']}")
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
