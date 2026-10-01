#!/usr/bin/env python3
"""Compare actual post-master WAV captures, without treating separated parts as truth.

python -X utf8 scripts/measure-band-mix.py --captures output/playwright/mix-calibration \
  --baseline clock --candidate after --reference before --out output/playwright/mix-report.json

Requires the existing analysis environment: numpy, scipy, soundfile. No downloads.
Audio stays local/ignored. This measures balance, dynamics and gaps; it does not
produce a listening score, transcription accuracy or instrument-specific labels.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import stft

BANDS = [(32, 80), (80, 250), (250, 1000), (1000, 4000), (4000, 12000), (12000, 16000)]


def measure(samples: np.ndarray, sr: int) -> dict:
    y = np.asarray(samples, dtype=np.float64)
    if y.ndim == 1:
        y = y[:, None]
    if y.ndim != 2 or y.shape[1] not in (1, 2) or sr < 32000 or len(y) < sr or not np.isfinite(y).all():
        raise ValueError('Need >=1 second of finite mono/stereo PCM at >=32 kHz')
    # Average channel POWERS: summing L+R would discard out-of-phase energy.
    power = []
    for channel in y.T:
        f, _, z = stft(channel, fs=sr, nperseg=4096, noverlap=3072, boundary=None, padded=False)
        power.append(np.abs(z) ** 2)
    spectrum = np.mean(power, axis=(0, 2))
    energies = np.array([spectrum[(f >= lo) & (f < hi)].sum() for lo, hi in BANDS])
    fractions = energies / max(float(energies.sum()), 1e-24)
    rms = float(np.sqrt(np.mean(y * y)))
    peak = float(np.max(np.abs(y)))
    # 20 ms blocks distinguish a scheduler dropout from a single zero crossing.
    hop = round(sr * 0.02)
    envelope = np.sqrt(np.mean(y[:len(y) // hop * hop].reshape(-1, hop, y.shape[1]) ** 2, axis=(1, 2)))
    quiet = envelope < max(1e-5, rms * 0.001)  # -60 dB relative RMS, with a -100 dBFS floor
    padded = np.r_[False, quiet, False].astype(int)
    starts = np.flatnonzero(np.diff(padded) == 1)
    ends = np.flatnonzero(np.diff(padded) == -1)
    active = envelope[~quiet]
    spread = float(20 * np.log10(np.percentile(active, 95) / max(1e-12, np.percentile(active, 10)))) if len(active) else None
    return {
        'duration_s': round(len(y) / sr, 3), 'channels': int(y.shape[1]), 'sample_rate': sr,
        'peak': round(peak, 6), 'rms': round(rms, 6),
        'crest_db': round(20 * np.log10(peak / rms), 2) if rms > 0 else None,
        'active_rms_p95_p10_db': round(spread, 2) if spread is not None else None,
        'quiet_fraction': round(float(quiet.mean()), 4),
        'longest_quiet_s': round(float((ends - starts).max(initial=0) * hop / sr), 3),
        'band_power_fraction': [round(float(value), 6) for value in fractions],
    }


def balance_difference(measured: dict, reference: dict) -> dict:
    a, b = np.array(measured['band_power_fraction']), np.array(reference['band_power_fraction'])
    # A floor avoids infinite differences for a nearly empty band. This is
    # a descriptive equal-region discrepancy, never a perceived-quality score.
    differences = 10 * np.log10(np.maximum(a, 0.001) / np.maximum(b, 0.001))
    return {'band_difference_db': np.round(differences, 2).tolist(),
            'core_band_mean_absolute_difference_db': round(float(np.abs(differences[:5]).mean()), 2),
            'level_difference_db': round(float(20 * np.log10(max(measured['rms'], 1e-12) / max(reference['rms'], 1e-12))), 2)}


def read_capture(path: Path, ffmpeg: Path | None = None) -> dict:
    samples, sr = sf.read(path, always_2d=True)
    result = measure(samples, sr)
    meta_path = path.with_suffix('.json')
    meta = json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
    if meta.get('stats', {}).get('dropped', 0):
        raise ValueError(f'{path.name}: dropped scheduled hits')
    result.update({'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                   'app': meta.get('app'), 'bpm': meta.get('bpm'), 'capture_content_start_s': meta.get('firstElapsed'),
                   'dropped_hits': meta.get('stats', {}).get('dropped', 0)})
    if ffmpeg is not None:
        process = subprocess.run([str(ffmpeg), '-hide_banner', '-nostats', '-i', str(path),
                                  '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, check=True)
        summary = process.stderr.rsplit('Summary:', 1)[-1]
        loud = re.search(r'Integrated loudness:.*?I:\s*([-\d.]+) LUFS', summary, re.S)
        peak = re.search(r'True peak:.*?Peak:\s*([-\d.]+) dBFS', summary, re.S)
        if loud is None or peak is None:
            raise ValueError(f'{path.name}: FFmpeg did not return loudness/true peak')
        result['segment_integrated_lufs'] = float(loud[1])
        result['true_peak_dbtp'] = float(peak[1])
    return result


def self_test():
    sr = 32000
    t = np.arange(sr * 2) / sr
    tone = np.sin(2 * np.pi * 140 * t) * 0.1
    mono = measure(tone, sr)
    stereo = measure(np.column_stack([tone, -tone]), sr)
    assert mono['band_power_fraction'][1] > 0.99
    assert np.allclose(mono['band_power_fraction'], stereo['band_power_fraction'])
    assert mono['longest_quiet_s'] == 0
    gap = tone.copy(); gap[sr // 2:sr] = 0
    assert measure(gap, sr)['longest_quiet_s'] >= 0.48
    assert balance_difference(mono, stereo)['core_band_mean_absolute_difference_db'] == 0
    silence = measure(np.zeros_like(tone), sr)
    assert silence['longest_quiet_s'] == 2 and silence['crest_db'] is None
    json.dumps(silence, allow_nan=False)
    try:
        measure(np.full_like(tone, np.nan), sr)
    except ValueError:
        pass
    else:
        raise AssertionError('Non-finite PCM was accepted')
    print('Band mix measurement PASS: known frequency, stereo phase, dropout, silence and finite-data rejection')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures', type=Path)
    parser.add_argument('--baseline', default='clock')
    parser.add_argument('--candidate', default='after')
    parser.add_argument('--reference', default='before')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--ffmpeg', type=Path, help='Existing local executable, optional LUFS/true-peak measurement')
    args = parser.parse_args()
    if args.self_test:
        self_test(); return
    if args.captures is None or args.out is None:
        parser.error('--captures and --out required')
    rows = []
    for after_path in sorted(args.captures.glob(f'{args.candidate}-*-synth.wav')):
        key = after_path.name[len(args.candidate) + 1:-len('-synth.wav')]
        before_path = args.captures / f'{args.baseline}-{key}-synth.wav'
        ref_path = args.captures / f'{args.reference}-{key}-stems.wav'
        if not before_path.exists() or not ref_path.exists():
            raise FileNotFoundError(f'{key}: need baseline and recombined original captures')
        before, after, ref = [read_capture(path, args.ffmpeg) for path in [before_path, after_path, ref_path]]
        rows.append({'clip': key, 'baseline': before, 'candidate': after, 'reference': ref,
                     'baseline_difference': balance_difference(before, ref),
                     'candidate_difference': balance_difference(after, ref),
                     'balance_comparison_usable': max(before['longest_quiet_s'], after['longest_quiet_s']) < 0.5})
    if not rows:
        raise ValueError('No matching captures')
    report = {'scope': 'Actual post-master instrumental mix; original drums+bass+other recombined by the app. Melody guide excluded in both comparisons.',
              'frequency_bands_hz': BANDS, 'baseline_phase': args.baseline, 'candidate_phase': args.candidate,
              'caveats': ['Relative band powers are level-normalized; dynamics and level are separate measurements.',
                          'Stem bleed is not instrument ground truth. Recombining three stems can retain vocal leakage and separation artifacts.',
                          'REC/seek times have small encoding and control delays; this is not sample-aligned waveform fidelity.',
                          'A quiet interval can be musical: check against the original before calling it a dropout.',
                          'No listening-quality score, pitch/chord accuracy claim, or physical iPhone measurement.'], 'clips': rows}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    for row in rows:
        print(f"{row['clip']}: balance {row['baseline_difference']['core_band_mean_absolute_difference_db']} -> "
              f"{row['candidate_difference']['core_band_mean_absolute_difference_db']} dB; "
              f"quiet {row['candidate']['longest_quiet_s']}s; peak {row['candidate']['peak']}; usable={row['balance_comparison_usable']}")


if __name__ == '__main__':
    main()
