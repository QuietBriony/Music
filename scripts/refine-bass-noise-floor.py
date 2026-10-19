#!/usr/bin/env python3
"""Reject minimum-velocity bass detections supported only by near-silent audio.

Uses existing stems, CPU NumPy and FFmpeg. No note retiming or repitching.
--baseline-ref reproduces evidence from a Git revision without writing scores.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 16000
PARAMETERS = dict(sample_rate=RATE, maximum_velocity=.16,
                  maximum_duration_s=.25, context_before_s=.12,
                  minimum_context_after_s=.30, maximum_rms_dbfs=-65,
                  maximum_peak_dbfs=-45)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def events_digest(rows):
    # Canonical numeric values agree with JSON.stringify in the runtime gate
    # (e.g. Python's 1.0 and JavaScript's 1 describe the same score value).
    canonical = [[int(v) if float(v).is_integer() else v for v in row] for row in rows]
    return digest(json.dumps(canonical, separators=(',', ':')).encode())

def inspect(song, data):
    line = data['bass_line']
    if 'noise_floor_refinement' in line:
        raise ValueError('Already refined: use --baseline-ref to reproduce')
    source = ROOT / f'presets/tabasco-stems/{song}/bass.mp3'
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source),
                                  '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'])
    y = np.frombuffer(raw, dtype='<f4').reshape(-1, 2)
    if not len(y) or not np.isfinite(y).all():
        raise ValueError('Invalid source PCM')
    step = 15 / line['bpm_fit']
    rejected = []
    for index, row in enumerate(line['events']):
        at = (row[0] * 16 + row[1]) * step
        duration = row[2] * step
        if row[4] > .16 or duration > .25 or at < .15:
            continue
        start = round((at - .12) * RATE)
        end = round((at + max(.30, duration + .12)) * RATE)
        if start < 0 or end > len(y):
            continue
        context = y[start:end]
        rms = float(np.sqrt(np.mean(context.astype(np.float64) ** 2)))
        peak = float(np.max(abs(context)))
        if rms < 10 ** (-65 / 20) and peak < 10 ** (-45 / 20):
            rejected.append(dict(index=index, row=row, time_s=at,
                                 context_s=[start / RATE, end / RATE],
                                 rms_dbfs=20 * np.log10(max(rms, 1e-15)),
                                 peak_dbfs=20 * np.log10(max(peak, 1e-15))))
    omit = {r['index'] for r in rejected}
    kept = [row for i, row in enumerate(line['events']) if i not in omit]
    return dict(song=song, source_sha256=digest(source.read_bytes()),
                input_events_sha256=events_digest(line['events']),
                output_events_sha256=events_digest(kept),
                input_count=len(line['events']), output_count=len(kept),
                rejected=rejected), kept

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--baseline-ref')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.write and args.baseline_ref:
        parser.error('Baseline reproduction is read-only')
    rows = []
    # Inspect all inputs before any mutation. A stale/previously refined score
    # must not leave a half-written set of songs.
    pending = []
    for path in sorted((ROOT / 'presets').glob('drum-frames-tabasco-*.json')):
        relative = path.relative_to(ROOT).as_posix()
        raw = (subprocess.check_output(['git', 'show', args.baseline_ref + ':' + relative], cwd=ROOT).decode()
               if args.baseline_ref else path.read_text('utf8'))
        data = json.loads(raw)
        song = path.stem[len('drum-frames-tabasco-'):]
        result, kept = inspect(song, data)
        rows.append(result)
        if result['rejected']:
            line = dict(data['bass_line'], events=kept)
            line['noise_floor_refinement'] = dict(method='near-silence-context-v1',
                source_sha256=result['source_sha256'], input_events_sha256=result['input_events_sha256'],
                removed=len(result['rejected']), parameters=PARAMETERS)
            marker = '"bass_line": '
            start = raw.index(marker) + len(marker)
            _, length = json.JSONDecoder().raw_decode(raw[start:])
            value = json.dumps(line, ensure_ascii=False, indent=1, allow_nan=False).replace('\n', '\n ')
            pending.append((path, raw[:start] + value + raw[start + length:]))
    report = dict(release='v429', method='near-silence-context-v1', parameters=PARAMETERS,
                  removed=sum(len(r['rejected']) for r in rows), songs=rows,
                  limits=['A separated stem is not original multitrack truth; a missing source component is possible.',
                          'Reject only floor-velocity short notes whose entire surrounding source is below both thresholds.',
                          'Retained rows are byte-value identical; no onset, pitch, duration, or velocity repair is inferred.',
                          'No hard audio gate: existing long note releases and source audio remain unchanged.'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n', 'utf8')
    if args.write:
        for path, value in pending:
            path.write_text(value, 'utf8')
    print(json.dumps({'removed': report['removed'], 'songs': {r['song']: len(r['rejected']) for r in rows}}))

if __name__ == '__main__':
    main()
