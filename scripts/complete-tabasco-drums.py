#!/usr/bin/env python3
"""Recover the short TABASCO drum performance rejected by the old 200-hit gate.

Uses existing CPU extractors and local source only. --write adds a missing
drum_line; it never replaces an existing score. Cymbal labels remain hypotheses.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent.parent


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


tr = module('stem_lines', 'transcribe-stem-lines.py')
rh = module('rhythm_performance', 'refine-rhythm-performance.py')


def self_test():
    rows = [[i // 16, i % 16, 1., 0 if i % 2 else 1, .7] for i in range(194)]
    assert tr.drum_score_usable(rows, 66, 45)
    assert not tr.drum_score_usable(rows, 66, 180)
    assert not tr.drum_score_usable([], 132, 45)
    assert not tr.drum_score_usable([r[:3] + [0, .7] for r in rows], 66, 45)
    assert not tr.drum_score_usable(rows + [[0, 16, 1, 1, .7]], 66, 45)
    assert not tr.drum_score_usable(rows, 66, float('nan'))
    print('PASS short-song coverage, long-song rejection, silence, missing snare, malformed timing')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.out is None:
        parser.error('--out is required')
    path = ROOT / 'presets/drum-frames-tabasco-tabasco.json'
    original = path.read_text('utf8')
    data = json.loads(original)
    if args.write and 'drum_line' in data:
        raise ValueError('Existing drum_line retained; --write only completes a missing score')
    tr.STEM_DIR = ROOT / 'presets/tabasco-stems/tabasco'
    source = tr.STEM_DIR / 'drums.mp3'
    y, _ = librosa.load(source, sr=rh.SR, mono=False)
    duration = y.shape[-1] / rh.SR
    bpm = float(data['bass_line']['bpm_fit'])
    step = 15 / bpm
    rows = tr.extract_drum_line(bpm, int(np.ceil(duration / step)))
    if not tr.drum_score_usable(rows, bpm, duration):
        raise ValueError('Insufficient drum coverage')
    starts = np.array([(r[0] * 16 + r[1]) * step for r in rows])
    envs = [rh.envelope(y, *b) for b in [(35, 120), (180, 1400), (6000, 10000)]]
    attacks = [rh.attacks(e) for e in envs]
    wire = rh.envelope(y, 1500, 4500)
    info = {'moves': [], 'adds': []}
    # The same conservative timing/cymbal rules used for the six longer songs.
    for i, row in enumerate(rows):
        near = [a for a in attacks[min(2, row[3])] if -.07 <= a['time'] - starts[i] <= .012]
        if not near:
            continue
        a = min(near, key=lambda a: abs(a['time'] - starts[i]))
        if -.065 <= a['time'] - starts[i] <= -.012:
            info['moves'].append({'index': i, 'new': a['time']})
        if row[3] != 0:
            continue
        hats = [h for h in attacks[2] if abs(h['time'] - a['time']) < .018 and h['ratio'] >= 4]
        if not hats:
            continue
        h = max(hats, key=lambda h: h['rise']); f = h['frame']
        if f + 10 >= len(envs[2]):
            continue
        if any(abs(starts[j] - h['time']) < .09 and r[3] != 0 for j, r in enumerate(rows)):
            continue
        if (h['peak'] < np.percentile(envs[2], 80) or
                np.mean(envs[2][f+4:f+10]) < h['peak'] * .25 or
                h['peak'] < np.max(wire[f:f+6]) * .25):
            continue
        info['adds'].append({'index': i, 'time': h['time']})
    events = rh.refine_rows(rows, step, info, 'drums')
    assert tr.drum_score_usable(events, bpm, duration)
    digest = lambda obj: hashlib.sha256(json.dumps(obj, separators=(',', ':')).encode()).hexdigest()
    provenance = {'method': 'short-song-energy-attack-v1',
                  'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'input_events_sha256': digest(rows), 'output_events_sha256': digest(events),
                  'moved': len(info['adopted_moves']), 'split': 0, 'added': len(info['adopted_adds'])}
    line = {'granularity': 16, 'bpm_fit': bpm, 'classes': ['kick', 'snare', 'hat', 'crash'],
            'source': 'local drums.mp3 onset / band energy, attack-aligned; cymbals uncertain',
            'events': events, 'rhythm_refinement': provenance}
    report = {'duration_s': duration, 'raw_count': len(rows), 'count': len(events),
              'bpm_fit': bpm, 'provenance': provenance, 'adopted': info,
              'limits': 'Detector agreement is not transcription accuracy; cymbal/tom labels remain uncertain.'}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', 'utf8')
    if args.write:
        # Append only; preserve every existing score and annotation byte.
        end = original.rfind('}')
        encoded = json.dumps(line, indent=1, allow_nan=False).replace('\n', '\n ')
        path.write_text(original[:end].rstrip() + ',\n "drum_line": ' + encoded + '\n}\n', 'utf8')
    print(json.dumps({k: report[k] for k in ['raw_count', 'count', 'provenance']}))


if __name__ == '__main__':
    main()
