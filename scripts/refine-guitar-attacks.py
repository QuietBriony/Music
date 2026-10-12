#!/usr/bin/env python3
"""Infer conservative within-bar guitar voicings from existing other stems.

CPU only, existing librosa/numpy environment, no downloads. Score attacks,
durations and velocities are never changed. Confidence is template evidence,
not a chord-accuracy or listening score. Other can contain separation bleed.

python -X utf8 scripts/refine-guitar-attacks.py --out report.json [--write]
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import librosa
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('harmony', ROOT / 'scripts/measure-guitar-harmony.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
THRESHOLDS = {'similarity': .65, 'pitch_class_margin': .12, 'agreement': 1, 'improvement': .12}
SPECTRUM_PARAMETERS = {'rate': h.SR, 'hop': h.HOP, 'low': h.LOW, 'count': h.COUNT, 'hpss_margin': 3, 'tuning': 0}


def embed(raw, metadata):
    start = raw.index('{', raw.index('"guitar_line"'))
    line, end = json.JSONDecoder().raw_decode(raw, start)
    if 'attack_voicings' in line:
        raise ValueError('Existing attack refinement requires an explicit replacement')
    fields = {k: v for k, v in metadata.items() if k != 'attacks'}
    compact_rows = ',\n'.join('  '+json.dumps(row, separators=(',', ':')) for row in metadata['attacks'])
    addition = '"attack_voicings": ' + json.dumps(fields, ensure_ascii=False, indent=1)[:-2] + ',\n "attacks": [\n' + compact_rows + '\n ]\n}'
    return raw[:end-1].rstrip() + ',\n' + '\n'.join('  '+s if s else '' for s in addition.splitlines()) + '\n ' + raw[end-1:]


def analyze(song, write=False, cache=None):
    path = ROOT / f'presets/drum-frames-tabasco-{song}.json'
    raw = path.read_text('utf8'); data = json.loads(raw)
    line = data['guitar_line']; events = line['events']; step = 15 / line['bpm_fit']
    stem = ROOT / f'presets/tabasco-stems/{song}/other.mp3'
    stem_hash = hashlib.sha256(stem.read_bytes()).hexdigest()
    cache_file = cache / f'{song}-guitar-cqt.npy' if cache else None
    cache_meta = cache_file.with_suffix('.json') if cache else None
    if cache_meta and cache_meta.exists():
        meta = json.loads(cache_meta.read_text('utf8'))
        if (meta['source_sha256'] != stem_hash or meta['parameters'] != SPECTRUM_PARAMETERS
                or meta['array_sha256'] != hashlib.sha256(cache_file.read_bytes()).hexdigest()):
            raise ValueError('Stale or mismatched spectrum cache')
        C = np.load(cache_file, allow_pickle=False)
        if C.ndim != 2 or C.shape[0] != h.COUNT or not np.isfinite(C).all() or np.any(C < 0):
            raise ValueError('Invalid cached spectrum')
    else:
        y, _ = librosa.load(stem, sr=h.SR, mono=False)
        channels = y if y.ndim == 2 else y[None, :]
        spectra = []
        for channel in channels:
            harmonic = librosa.effects.harmonic(channel, margin=3)
            spectra.append(abs(librosa.cqt(harmonic, sr=h.SR, hop_length=h.HOP,
                                          fmin=librosa.midi_to_hz(h.LOW), n_bins=h.COUNT, tuning=0)))
        C = np.mean(spectra, axis=0)  # Magnitudes retain opposite-phase stereo content.
        if cache_file:
            cache.mkdir(parents=True, exist_ok=True); np.save(cache_file, C)
            cache_meta.write_text(json.dumps({'source_sha256': stem_hash, 'parameters': SPECTRUM_PARAMETERS,
                                  'array_sha256': hashlib.sha256(cache_file.read_bytes()).hexdigest()}), 'utf8')
    previous = {r[0]: r[1] for r in line.get('harmonic_voicings', {}).get('bars', [])}
    items = []; attacks = []; inspected = 0
    for index, row in enumerate(events):
        start = (row[0]*16 + row[1])*step
        next_start = (events[index+1][0]*16 + events[index+1][1])*step if index+1 < len(events) else start+1
        # The lowest CQT filter extends roughly 0.1 s on either side of its
        # center. Keep it inside the stroke: dense strums are too ambiguous.
        a = round((start+.12)*h.SR/h.HOP)
        b = min(C.shape[1], round(min(start+.45, next_start-.12)*h.SR/h.HOP))
        if b-a < 10:
            continue  # Dense attacks without a stable window keep their existing notes.
        inspected += 1
        spectrum = h.normalized_spectrum(C, a, b); scores = h.TEMPLATES @ spectrum
        best = int(h.POWER[np.argmax(scores[h.POWER])]); root, kind, notes = h.MODELS[best]
        margin = float(scores[best] - max(scores[i] for i in h.POWER if h.MODELS[i][0] % 12 != root % 12))
        pieces = [h.TEMPLATES @ h.normalized_spectrum(C, a+(b-a)*i//3, a+(b-a)*(i+1)//3) for i in range(3)]
        votes = [h.MODELS[int(h.POWER[np.argmax(sc[h.POWER])])][0] % 12 for sc in pieces]
        agreement = votes.count(root % 12)/3
        oldnotes = previous.get(row[0], [int(row[3]), int(row[3])+7, int(row[3])+12])
        old = float(h.harmonic_template(oldnotes) @ spectrum)
        triads = [i for i, m in enumerate(h.MODELS) if m[0] == root and m[1] != 'power']
        triad = max(triads, key=lambda i: scores[i]); alternate = next(i for i in triads if i != triad)
        if (scores[triad]-scores[best] >= .09 and scores[triad]-scores[alternate] >= .04
                and sum(sc[triad] > sc[alternate] and sc[triad] > sc[best] for sc in pieces) >= 2):
            best = triad; root, kind, notes = h.MODELS[best]
        accepted = bool(scores[best] >= THRESHOLDS['similarity'] and margin >= THRESHOLDS['pitch_class_margin']
                        and agreement == 1 and scores[best]-old >= THRESHOLDS['improvement'] and notes != oldnotes)
        if accepted:
            confidence = [round(float(scores[best]), 5), round(margin, 5), agreement]
            attacks.append([index, row, notes, *confidence])
            items.append({'index': index, 'time_s': round(start, 4), 'notes': notes, 'old_notes': oldnotes,
                          'similarity': confidence[0], 'old_similarity': round(old, 5), 'pitch_class_margin': confidence[1]})
    metadata = {'format': 'attack-voicings-v1', 'method': 'stereo sustained CQT; three agreeing windows within each existing attack',
                'events_count': len(events), 'events_sha256': h.events_hash(events),
                'stem_sha256': stem_hash, 'bpm_fit': line['bpm_fit'], 'attacks': attacks}
    if write:
        path.write_text(embed(raw, metadata), 'utf8')
    print(f'{song}: {len(attacks)} inferred / {inspected} stable windows / {len(events)} attacks', flush=True)
    return {'song': song, 'metadata': metadata, 'inspected': inspected, 'diagnostics': items}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--song', choices=h.SONGS)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--spectrum-cache', type=Path, help='Optional local numeric cache, source/parameter/hash checked')
    args = parser.parse_args()
    report = {'method': 'Conservative attack voicings, not exact polyphonic transcription', 'thresholds': THRESHOLDS,
              'sample_rate': h.SR, 'hop': h.HOP, 'source_channels': 'mean CQT magnitudes',
              'limits': ['No new attacks; bass, drums, vocals and score clock unchanged.',
                         'Other includes separation bleed; confidence is not ground truth.',
                         'Verify actual browser output with independent STFT pitch-class analysis.'], 'songs': []}
    for song in [args.song] if args.song else h.SONGS:
        report['songs'].append(analyze(song, args.write, args.spectrum_cache))
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', 'utf8')


if __name__ == '__main__':
    main()
