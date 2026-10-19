#!/usr/bin/env python3
"""Conservatively bound added bass releases at source-supported rests.

Existing stereo bass stems AND surviving premixes are required. CPU only;
note rows, pitched holds and source audio are never rewritten.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE, HOP = 16000, 320
METHOD = 'source-backed-bass-release-v1'
PARAMETERS = dict(sample_rate=RATE, hop_s=.02, minimum_quiet_s=.4,
                  quiet_rms_dbfs=-55, quiet_peak_dbfs=-38,
                  minimum_attack_rms_dbfs=-40, minimum_stem_drop_db=20,
                  minimum_premix_harmonic_drop_db=12, fade_s=.15)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
        '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'])
    y = np.frombuffer(raw, '<f4').reshape(-1, 2)
    if not len(y) or not np.isfinite(y).all():
        raise ValueError('Invalid PCM')
    return y


def rms_db(x):
    if not len(x):
        raise ValueError('Empty window')
    return float(20 * np.log10(max(float(np.sqrt(np.mean(x.astype('float64') ** 2))), 1e-12)))


def harmonic_power(x, note):
    # Independent evidence in the unseparated mix; wide bins tolerate tuning
    # and short notes. Short attacks are zero-padded, never extrapolated.
    n = 4096
    if len(x) < n:
        x = np.pad(x, ((0, n - len(x)), (0, 0)))
    frames = np.lib.stride_tricks.sliding_window_view(x, n, axis=0)[::512]
    power = np.mean(abs(np.fft.rfft(frames * np.hanning(n), axis=-1)) ** 2, axis=(0, 1))
    freq = np.fft.rfftfreq(n, 1 / RATE)
    f = 440 * 2 ** ((note - 69) / 12)
    energy = sum(power[abs(freq - f * k) < max(5, f * k * .035)].sum() / k for k in [1, 2, 3])
    return float(10 * np.log10(max(energy, 1e-12)))


def inspect(song, data):
    line = data['bass_line']
    if 'release_limits' in line:
        raise ValueError('Already refined: use --baseline-ref')
    paths = [ROOT / f'presets/tabasco-stems/{song}/bass.mp3',
             ROOT / f'presets/tabasco-premix/{song}.m4a']
    bass, mix = map(decode, paths)
    hashes = [digest(p.read_bytes()) for p in paths]
    reference = data['premix_reference']
    if reference['sha256'] != hashes[1]:
        raise ValueError('Premix provenance changed')
    offset, step = reference['stem_offset_s'], 15 / line['bpm_fit']
    blocks = bass[:len(bass) // HOP * HOP].reshape(-1, HOP, 2)
    levels = np.sqrt(np.mean(blocks.astype('float64') ** 2, axis=(1, 2)))
    peaks = np.max(abs(blocks), axis=(1, 2))
    quiet = (levels < 10 ** (-55 / 20)) & (peaks < 10 ** (-38 / 20))
    edges = np.diff(np.r_[False, quiet, False].astype(int))
    starts, ends = np.flatnonzero(edges == 1) * .02, np.flatnonzero(edges == -1) * .02
    accepted, rejected = [], []
    rows = line['events']
    for index, row in enumerate(rows):
        at = (row[0] * 16 + row[1]) * step
        off = at + max(.5, row[2]) * step
        next_at = (rows[index + 1][0] * 16 + rows[index + 1][1]) * step if index + 1 < len(rows) else float('inf')
        natural_end = min(off + 1.4, next_at + .06, reference['active_end_s'] + offset)
        for start, end in zip(starts, ends):
            release_end = max(start, off) + .15
            if start < at + .08 or end - max(start, off) < .4 or release_end >= natural_end - .2 or start >= next_at:
                continue
            before = bass[round(at * RATE):round(min(off, at + .25) * RATE)]
            after = bass[round(start * RATE):round(min(end, start + .4) * RATE)]
            attack_db, quiet_db = rms_db(before), rms_db(after)
            if attack_db < -40 or attack_db - quiet_db < 20:
                continue
            a0, a1 = round((at - offset) * RATE), round((min(off, at + .3) - offset) * RATE)
            b0, b1 = round((start - offset) * RATE), round((min(end, start + .4) - offset) * RATE)
            if a0 < 0 or b1 > len(mix):
                continue
            drop = harmonic_power(mix[a0:a1], row[3]) - harmonic_power(mix[b0:b1], row[3])
            item = dict(index=index, row=row, at_s=at, hold_end_s=off,
                        quiet_s=[float(start), float(end)], release_end_s=float(release_end),
                        natural_end_s=natural_end, stem_attack_dbfs=attack_db,
                        stem_quiet_dbfs=quiet_db, premix_harmonic_drop_db=drop)
            (accepted if drop >= 12 else rejected).append(item)
            break
    annotation = dict(method=METHOD, events_count=len(rows), bpm_fit=line['bpm_fit'],
                      source_sha256=hashes[0], premix_sha256=hashes[1],
                      entries=[[x['index'], x['row'], x['release_end_s']] for x in accepted])
    return dict(song=song, source_sha256=hashes[0], premix_sha256=hashes[1],
                accepted=accepted, rejected=rejected), annotation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--baseline-ref')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.write and args.baseline_ref:
        parser.error('Baseline reproduction is read-only')
    pending, songs = [], []
    for path in sorted((ROOT / 'presets').glob('drum-frames-tabasco-*.json')):
        name = path.relative_to(ROOT).as_posix()
        raw = subprocess.check_output(['git', 'show', args.baseline_ref + ':' + name], cwd=ROOT).decode() if args.baseline_ref else path.read_text('utf8')
        data = json.loads(raw)
        result, annotation = inspect(path.stem.removeprefix('drum-frames-tabasco-'), data)
        songs.append(result)
        if annotation['entries']:
            # Only append metadata; all existing score fields remain intact.
            start = raw.index('"bass_line": ') + len('"bass_line": ')
            _, length = json.JSONDecoder().raw_decode(raw[start:])
            line = dict(data['bass_line'], release_limits=annotation)
            value = json.dumps(line, ensure_ascii=False, indent=1, allow_nan=False).replace('\n', '\n ')
            pending.append((path, raw[:start] + value + raw[start + length:]))
    report = dict(release='v430', method=METHOD, parameters=PARAMETERS,
                  count=sum(len(x['accepted']) for x in songs), songs=songs,
                  limits=['Separated stems can lose real components; only matching drops in the surviving premix are accepted.',
                          'No pitch, onset, velocity or scored-hold change. Only additional synthetic release is bounded.',
                          'Harmonic-band energy is evidence of a rest, not isolation of the bass or perceptual certification.',
                          'Ambiguous rests including Human Fly 180 s remain unchanged.'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n', 'utf8')
    if args.write:
        for path, text in pending:
            path.write_text(text, 'utf8')
    print(json.dumps(dict(count=report['count'], songs=len(pending), written=args.write)))


if __name__ == '__main__':
    main()
