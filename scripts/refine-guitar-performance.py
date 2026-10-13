#!/usr/bin/env python3
"""Align ARCB guitar attacks and extend stable, source-backed voicings.

CPU only, using the existing recordings and analysis environment. No audio is
embedded. --write refuses already-refined or changed scores. A local Git
--baseline-ref can reproduce a report without modifying current scores.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

import librosa
import numpy as np
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


h = module('guitar_harmony', 'measure-guitar-harmony.py')
r = module('rhythm', 'refine-rhythm-performance.py')
PARAMETERS = {'rate': h.SR, 'hop': h.HOP, 'low': h.LOW, 'count': h.COUNT, 'hpss_margin': 3, 'tuning': 0}
# v420 release review, not detector confidence: actual post-master comparisons
# did not support adopting every proposal. Keep all proposals in the report.
# Revisit withheld songs through a new measured review, not a lower threshold.
# Evidence: docs/arcb-guitar-performance-measurement-20261013.json.
TIMING_ADOPTION = {'human-fly', 'electric-sheep', 'hey', 'under-the-moon', 'tabasco'}
HARMONY_ADOPTION = {'human-fly', 'electric-sheep', 'hey'}


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':'), sort_keys=True).encode()).hexdigest()


def write_line(path, line):
    raw = path.read_text('utf8'); marker = ' "guitar_line": '
    start = raw.index(marker)+len(marker)
    _, length = json.JSONDecoder().raw_decode(raw[start:])
    encoded = json.dumps(line, ensure_ascii=False, indent=1, allow_nan=False)
    # Retain the existing compact attack annotations so unchanged rows remain
    # reviewable. Do not reformat bass/drums or any other score property.
    at = encoded.index('"attacks": ')+len('"attacks": ')
    entries, size = json.JSONDecoder().raw_decode(encoded[at:])
    compact = '[\n'+',\n'.join('   '+json.dumps(e, separators=(',', ':')) for e in entries)+'\n  ]' if entries else '[]'
    encoded = (encoded[:at]+compact+encoded[at+size:]).replace('\n', '\n ')
    path.write_text(raw[:start]+encoded+raw[start+length:], 'utf8')


def cqt(song, y, source_hash, cache):
    path = cache / f'{song}-guitar-cqt.npy' if cache else None
    if path and path.exists():
        meta = json.loads(path.with_suffix('.json').read_text('utf8'))
        if (meta['source_sha256'] != source_hash or meta['parameters'] != PARAMETERS or
                meta['array_sha256'] != hashlib.sha256(path.read_bytes()).hexdigest()):
            raise ValueError('Stale or mismatched CQT cache')
        C = np.load(path, allow_pickle=False)
        if C.ndim != 2 or C.shape[0] != h.COUNT or not np.isfinite(C).all() or np.any(C < 0):
            raise ValueError('Invalid CQT cache')
        return C
    return np.mean([abs(librosa.cqt(librosa.effects.harmonic(ch, margin=3), sr=h.SR,
                         hop_length=h.HOP, fmin=librosa.midi_to_hz(h.LOW),
                         n_bins=h.COUNT, tuning=0)) for ch in np.atleast_2d(y)], axis=0)


def stft_confirmation(y, start, old, new):
    """A different linear-frequency representation rejects CQT-only fits."""
    nfft = 4096
    freq = librosa.fft_frequencies(sr=h.SR, n_fft=nfft)
    mask = (freq >= 75) & (freq <= 3500)
    freq = freq[mask]
    segment = np.atleast_2d(y)[:, round((start + .025) * h.SR):round((start + .325) * h.SR)]
    if segment.shape[1] < nfft:
        return 0., 0.
    S = np.mean([abs(librosa.stft(ch, n_fft=nfft, hop_length=256)) for ch in segment], axis=0)
    spectrum = np.sqrt(np.median(S[mask, 3:-3], axis=1))
    spectrum /= np.linalg.norm(spectrum) + 1e-12

    def similarity(notes):
        template = np.zeros_like(freq)
        for note in notes:
            for partial in range(1, 13):
                f = librosa.midi_to_hz(note) * partial
                template += np.exp(-.5 * ((freq - f) / (h.SR / nfft * 1.1)) ** 2) / partial
        template = np.sqrt(template)
        return float(template @ spectrum / (np.linalg.norm(template) + 1e-12))
    return similarity(old), similarity(new)


def extend_voicings(line, C, y):
    events = line['events']; step = 15 / line['bpm_fit']
    previous = {entry[0]: entry[1] for entry in line['harmonic_voicings']['bars']}
    existing = {entry[0] for entry in line['attack_voicings']['attacks']}
    entries, decisions = [], []
    for index, row in enumerate(events):
        if index in existing:
            continue
        start = (row[0] * 16 + row[1]) * step
        a = round((start + .06) * h.SR / h.HOP)
        b = min(C.shape[1], round((start + .36) * h.SR / h.HOP))
        if b - a < 21:
            continue
        scores = h.TEMPLATES @ h.normalized_spectrum(C, a, b)
        best = int(h.POWER[np.argmax(scores[h.POWER])]); root, _, notes = h.MODELS[best]
        margin = float(scores[best] - max(scores[i] for i in h.POWER if h.MODELS[i][0] % 12 != root % 12))
        old = previous.get(row[0], [int(row[3]), int(row[3])+7, int(row[3])+12])
        old_score = float(h.harmonic_template(old) @ h.normalized_spectrum(C, a, b))
        pieces = [h.TEMPLATES @ h.normalized_spectrum(C, a+(b-a)*i//3, a+(b-a)*(i+1)//3) for i in range(3)]
        votes = [h.MODELS[int(h.POWER[np.argmax(s[h.POWER])])][0] % 12 for s in pieces]
        if not (scores[best] >= .65 and margin >= .12 and votes.count(root % 12) == 3 and
                scores[best] - old_score >= .12 and old != notes):
            continue
        # A window can cross a repeated stroke, but not assume that its new
        # chord was already present. Dense strokes need agreeing pre-attack
        # evidence as well; uncertain transitions retain the existing voicing.
        next_time = (events[index+1][0]*16+events[index+1][1])*step if index+1 < len(events) else float('inf')
        before_a = max(0, round((start-.18)*h.SR/h.HOP)); before_b = round((start-.025)*h.SR/h.HOP)
        before_ok = False
        if before_b-before_a >= 8:
            before = h.TEMPLATES @ h.normalized_spectrum(C, before_a, before_b)
            winner = int(h.POWER[np.argmax(before[h.POWER])]); prior_root = h.MODELS[winner][0]
            prior_margin = float(before[winner] - max(before[i] for i in h.POWER if h.MODELS[i][0] % 12 != prior_root % 12))
            before_ok = prior_root % 12 == root % 12 and before[winner] >= .6 and prior_margin >= .08
        old_stft, new_stft = stft_confirmation(y, start, old, notes)
        accepted = bool((next_time-start >= .385 or before_ok) and new_stft >= .48 and new_stft-old_stft >= .05)
        decisions.append({'index': index, 'time_s': round(start, 6), 'old_notes': old, 'notes': notes,
                          'cqt_old': old_score, 'cqt_new': float(scores[best]), 'margin': margin,
                          'pre_attack_agrees': bool(before_ok), 'stft_old': old_stft, 'stft_new': new_stft, 'accepted': accepted})
        if accepted:
            entries.append([index, row.copy(), notes, round(float(scores[best]), 5), round(margin, 5), 1])
    return entries, decisions


def align_attacks(line, y):
    step = 15 / line['bpm_fit']; rows = line['events']; updated = copy.deepcopy(rows)
    starts = np.array([(row[0]*16+row[1])*step for row in rows])
    candidates = r.attacks(r.envelope(y, 140, 2800))
    S = np.mean([abs(librosa.stft(ch, n_fft=1024, hop_length=r.HOP)) for ch in np.atleast_2d(y)], axis=0)
    f = librosa.fft_frequencies(sr=r.SR, n_fft=1024); band = S[(f >= 600) & (f <= 3500)]
    flux = np.r_[0, np.maximum(0, np.diff(band, axis=1)).mean(axis=0)]
    q = np.percentile(flux[flux > 0], 95) if np.any(flux > 0) else 1
    peaks, _ = find_peaks(flux, height=q*.8, prominence=q*.5, distance=round(.075/r.DT))
    times = peaks*r.DT; moves = []
    for i, row in enumerate(rows):
        old = starts[i]; near = [a for a in candidates if -.07 <= a['time']-old <= .012]
        if not near or not len(times):
            continue
        onset = min(near, key=lambda a: abs(a['time']-old)); at = onset['time']; delta = at-old
        if not -.065 <= delta <= -.012 or onset['ratio'] < 2 or np.min(abs(times-at)) > .023:
            continue
        position = round(at/step, 2)
        # Keep the order, bar voicing and native 16-stroke budget unchanged.
        if int(position//16) != row[0] or i > 0 and at-starts[i-1] < .065:
            continue
        updated[i][1] = round(position % 16, 2)
        updated[i][2] = round(row[2]+row[1]-updated[i][1], 2)  # Same note-off.
        moves.append({'index': i, 'old': round(old, 6), 'new': round(position*step, 6),
                      'delta_ms': round((position*step-old)*1000, 3), 'ratio': round(onset['ratio'], 3)})
    return updated, moves


def refine(song, data, cache):
    original = data['guitar_line']; line = copy.deepcopy(original)
    if line.get('performance_refinement'):
        raise ValueError('Already refined; select the original baseline for read-only reproduction')
    source = ROOT / f'presets/tabasco-stems/{song}/other.mp3'
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    for key in ['harmonic_voicings', 'attack_voicings']:
        if line[key]['stem_sha256'] != source_hash or line[key]['events_sha256'] != h.events_hash(line['events']):
            raise ValueError('Voicing provenance does not match the source/score')
    y, _ = librosa.load(source, sr=h.SR, mono=False)
    proposals, decisions = extend_voicings(line, cqt(song, y, source_hash, cache), y)
    proposed_rows, proposed_moves = align_attacks(line, y)
    extra = proposals if song in HARMONY_ADOPTION else []
    updated = proposed_rows if song in TIMING_ADOPTION else copy.deepcopy(line['events'])
    moves = proposed_moves if song in TIMING_ADOPTION else []
    for decision in decisions:
        decision['adopted'] = decision['accepted'] and song in HARMONY_ADOPTION
    line['attack_voicings']['attacks'] = sorted(line['attack_voicings']['attacks'] + extra, key=lambda a: a[0])
    for entry in line['attack_voicings']['attacks']:
        entry[1] = updated[entry[0]].copy()
    line['events'] = updated
    for key in ['harmonic_voicings', 'attack_voicings']:
        line[key]['events_sha256'] = h.events_hash(updated)
    provenance = {'method': 'guitar-performance-v1', 'source_sha256': source_hash,
                  'input_line_sha256': digest(original), 'moved': len(moves), 'voicings_added': len(extra)}
    line['performance_refinement'] = provenance
    report = {'song': song, **provenance, 'output_line_sha256': digest(line),
              'events': len(updated), 'moves': moves, 'proposed_moves': proposed_moves,
              'voicing_candidates': decisions,
              'withheld': {'timing': len(proposed_moves)-len(moves), 'harmony': len(proposals)-len(extra)}}
    return line, report


def self_test():
    # Known attacks: no cancellation in opposite-phase stereo, no drift or
    # edits on silence, and exact note-off preservation after backtracking.
    t = np.arange(r.SR*2)/r.SR; signal = np.zeros_like(t)
    for onset in [.3, .8, 1.3]:
        local = t-onset
        signal += np.where(local >= 0, np.sin(2*np.pi*220*local)*np.exp(-np.maximum(0, local)*22), 0)*.4
    line = {'bpm_fit': 120, 'events': [[0, (at+.035)/.125, 1., 57, .8] for at in [.3, .8, 1.3]]}
    result, moves = align_attacks(line, np.array([signal, -signal]))
    assert len(moves) == 3
    for old, new, at in zip(line['events'], result, [.3, .8, 1.3]):
        assert abs(new[1]*.125-at) < .018 and abs(sum(old[1:3])-sum(new[1:3])) < .001
        assert old[3:] == new[3:]
    assert align_attacks(line, np.zeros_like(signal))[0] == line['events']
    chord = sum(np.sin(2*np.pi*librosa.midi_to_hz(n)*t) for n in [40, 47, 52])*.1
    wrong, right = stft_confirmation(np.array([chord, -chord]), .5, [41, 48, 53], [40, 47, 52])
    assert right > wrong+.1 and right > .55  # Adjacent low semitones share FFT bins.
    assert stft_confirmation(np.zeros_like(chord), .5, [41, 48, 53], [40, 47, 52]) == (0., 0.)
    print('PASS: known attacks/chords, stereo power, silence, pitch/velocity and note-off preservation')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path); p.add_argument('--song', choices=h.SONGS)
    p.add_argument('--spectrum-cache', type=Path); p.add_argument('--baseline-ref')
    p.add_argument('--write', action='store_true'); p.add_argument('--self-test', action='store_true')
    args = p.parse_args()
    if args.self_test:
        self_test(); return
    if not args.out:
        p.error('--out is required')
    baseline = subprocess.check_output(['git', 'rev-parse', '--verify', '--end-of-options', args.baseline_ref+'^{commit}'], cwd=ROOT, text=True).strip() if args.baseline_ref else None
    if args.write and baseline:
        p.error('--baseline-ref is read-only; --write requires the unchanged current score')
    inputs = []
    for song in [args.song] if args.song else h.SONGS:
        name = f'presets/drum-frames-tabasco-{song}.json'; path = ROOT/name
        raw = subprocess.check_output(['git', 'show', baseline+':'+name], cwd=ROOT, text=True, encoding='utf8') if baseline else path.read_text('utf8')
        data = json.loads(raw)
        if data['guitar_line'].get('performance_refinement'):
            raise ValueError(f'{song}: already refined; refusing to apply twice')
        inputs.append((song, path, raw, data))
    reports, outputs = [], []
    for song, path, raw, data in inputs:
        line, report = refine(song, data, args.spectrum_cache)
        outputs.append((path, raw, line)); reports.append(report)
        print(song, report['moved'], 'attacks aligned;', report['voicings_added'], 'voicings added', flush=True)
    if args.write:
        if any(path.read_text('utf8') != raw for path, raw, _ in outputs):
            raise ValueError('Score changed during analysis; nothing written')
        for path, _, line in outputs:
            write_line(path, line)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({'method': 'guitar-performance-v1', 'baseline': baseline,
        'limits': ['Energy/flux agreement and voicing similarity are not transcription accuracy.',
                   'Other contains separation bleed; uncertain voicings are retained.',
                   'No new attacks, velocities, source audio, bass or drum changes.'],
        'songs': reports}, indent=2, allow_nan=False)+'\n', 'utf8')


if __name__ == '__main__':
    main()
