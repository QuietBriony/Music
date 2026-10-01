#!/usr/bin/env python3
"""Restore an omitted tail without replacing existing ARCB note rows.

--write records decoded duration for the native playback clock. Only songs
whose encoded grid clipped >3 s are extended; earlier rows remain unchanged.
The same existing detectors are reused, with >=0.65 voicing probability for
new monophonic rows. This is an estimate, not ground-truth transcription.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('transcriber', ROOT / 'scripts/transcribe-stem-lines.py')
    transcriber = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(transcriber)
    for path in sorted((ROOT / 'presets').glob('drum-frames-tabasco-*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        song = path.stem.replace('drum-frames-tabasco-', '')
        stems = ROOT / 'presets/tabasco-stems' / song
        duration = sf.info(stems / 'drums.mp3').duration
        fit = data['bass_line']['bpm_fit']
        old_end = data['total_bars'] * 240 / fit
        added = {}
        existing = data.get('transcription_tail_extension', {})
        if duration - old_end > 3 and existing.get('to_s') != round(duration, 3):
            transcriber.STEM_DIR = stems
            offset = max(0, old_end - 1)  # context across the join
            steps = math.ceil(duration * fit / 240) * 16
            roots = transcriber.bar_roots_from_progression(data.get('chord_progression', {}), data['structure'], 0)
            candidates = {
                'bass_line': transcriber.extract_line('bass', 'C1', 'C4', 24, 55, fit, steps, offset=offset, min_probability=.65),
                'vocal_melody': transcriber.extract_line('vocals', 'C2', 'C6', 41, 84, fit, steps, min_ms=90, offset=offset, min_probability=.65),
                'guitar_line': transcriber.extract_guitar_line(fit, steps, roots, offset=offset),
                'drum_line': transcriber.extract_drum_line(fit, steps, offset=offset, min_onsets=4),
            }
            for key, events in candidates.items():
                if key not in data:
                    continue
                original = data[key]['events']
                cap = min(.65, max((row[4] for row in original[-16:]), default=.5))
                tail = [row for row in events if old_end <= (row[0] * 16 + row[1]) * 15 / fit < duration - .03]
                for row in tail:
                    row[4] = round(min(cap, row[4]), 2)
                data[key]['events'] = original + tail
                assert data[key]['events'][:len(original)] == original
                added[key] = len(tail)
            data['transcription_tail_extension'] = {
                'from_s': round(old_end, 3), 'to_s': round(duration, 3),
                'method': 'Existing detectors; new pitch rows probability >=0.65; earlier rows retained; tail velocity ceiling <=0.65',
                'added_rows': added,
                'drums_sha256': hashlib.sha256((stems / 'drums.mp3').read_bytes()).hexdigest(),
            }
        data['performance_duration_s'] = round(duration, 3)
        if args.write:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{song}: decoded {duration:.3f}s, old grid {old_end:.3f}s, added {added}', flush=True)


if __name__ == '__main__':
    main()
