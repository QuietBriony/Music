#!/usr/bin/env python3
"""Identify conservative single-pitch guitar attacks in existing recordings.

CPU only. CQT proposals must agree with an independent linear spectrum in
both the other stem and surviving premix. Quiet vocals and guitar-dominant
fundamental bands reduce (but cannot eliminate) separation-bleed mistakes.
No attacks, velocities, durations, source audio or other parts are changed.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


h = module('harmony', 'measure-guitar-harmony.py')
g = module('performance', 'refine-guitar-performance.py')
RATE = h.SR
METHOD = 'source-backed-guitar-single-v1'
PARAMETERS = dict(cqt_similarity=.75, cqt_margin=.20, cqt_improvement=.12,
    linear_similarity=.65, linear_improvement=.20, linear_margin=.10,
    premix_improvement=.15, vocals_max_dbfs=-45, other_min_dbfs=-40,
    other_over_bass_min_db=6, harmonic_power_min=.80)
MODELS = [(n, 'single', [n]) for n in range(40, 77)] + h.MODELS
TEMPLATES = np.array([h.harmonic_template(x[2]) for x in MODELS])
# v431 review of actual native post-amp PCM: these three proposals worsened
# independent pitch-class agreement with both sources. Detector thresholds
# alone do not authorize adoption. Evidence: arcb-guitar-single-measurement-20261023.json.
WITHHELD = {'i-got-a-feeling': {76, 148, 772}}


def sha(value):
    return hashlib.sha256(value).hexdigest()


def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
        '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'])
    y = np.frombuffer(raw, '<f4').reshape(-1, 2)
    if not len(y) or not np.isfinite(y).all():
        raise ValueError('Invalid decoded audio')
    return y


def db(y):
    return float(20 * np.log10(max(1e-12, np.sqrt(np.mean(y.astype('float64') ** 2)))))


def spectrum(y, a, b):
    if a < 0 or b * RATE > len(y):
        return None
    seg = y[round(a * RATE):round(b * RATE)]
    n = len(seg)
    if n < 2048 or n > 16384:
        return None
    # Linear-frequency, whole-window Hann spectrum; no CQT or HPSS here.
    freq = np.fft.rfftfreq(16384, 1 / RATE)
    amp = np.sqrt(np.mean(abs(np.fft.rfft(seg * np.hanning(n)[:, None],
        n=16384, axis=0)) ** 2, axis=1))
    mask = (freq >= 75) & (freq < 4000)
    return freq[mask], amp[mask], RATE / n


def fit(s, notes):
    f, amp, width = s
    template = np.zeros_like(f)
    for note in notes:
        for k in range(1, 13):
            template += np.exp(-.5 * ((f - 440 * 2 ** ((note - 69) / 12) * k)
                / (width * .85)) ** 2) / k
    return float(template @ amp / (np.linalg.norm(template) * np.linalg.norm(amp) + 1e-12))


def harmonic_power(s, note, partials):
    f, amp, width = s
    f0 = 440 * 2 ** ((note - 69) / 12)
    mask = np.any([abs(f - f0 * k) < width * 1.25 for k in partials], axis=0)
    return float(sum(amp[mask] ** 2))


def inspect(song, data, cache):
    line = data['guitar_line']
    if 'single_note_voicings' in line:
        raise ValueError('Already refined: reproduce with --baseline-ref')
    paths = {p: ROOT / f'presets/tabasco-stems/{song}/{p}.mp3'
             for p in ['other', 'bass', 'vocals']}
    paths['premix'] = ROOT / f'presets/tabasco-premix/{song}.m4a'
    hashes = {p: sha(path.read_bytes()) for p, path in paths.items()}
    if hashes['premix'] != data['premix_reference']['sha256']:
        raise ValueError('Premix reference mismatch')
    y = {p: decode(path) for p, path in paths.items()}
    # Existing cache is checked against source, transform parameters and array hash.
    C = g.cqt(song, y['other'].T, hashes['other'], cache)
    step = 15 / line['bpm_fit']
    rows = line['events']
    bars = {x[0]: x[1] for x in line['harmonic_voicings']['bars']}
    attacks = {x[0]: x[2] for x in line['attack_voicings']['attacks']}
    decisions = []
    for index, row in enumerate(rows):
        at = (row[0] * 16 + row[1]) * step
        next_at = (rows[index+1][0] * 16 + rows[index+1][1]) * step if index+1 < len(rows) else at+1
        end = min(at+.40, next_at-.07)
        a = round((at+.09) * RATE / h.HOP)
        b = min(C.shape[1], round(end * RATE / h.HOP))
        if b-a < 9:
            continue
        old = attacks.get(index, bars.get(row[0], [row[3], row[3]+7, row[3]+12]))
        spec = h.normalized_spectrum(C, a, b)
        scores = TEMPLATES @ spec
        best = int(np.argmax(scores))
        note, kind, notes = MODELS[best]
        margin = float(scores[best] - max(scores[j] for j, m in enumerate(MODELS) if m[0] % 12 != note % 12))
        improvement = float(scores[best] - h.harmonic_template(old) @ spec)
        if kind != 'single' or scores[best] < .75 or margin < .20 or improvement <= .12:
            continue
        votes = [MODELS[int(np.argmax(TEMPLATES @ h.normalized_spectrum(C,
            a+(b-a)*j//3, a+(b-a)*(j+1)//3)))][2] for j in range(3)]
        if not all(v == notes for v in votes):
            continue
        start = at+.025
        offset = data['premix_reference']['stem_offset_s']
        s = spectrum(y['other'], start, end)
        mix = spectrum(y['premix'], start-offset, end-offset)
        bass = spectrum(y['bass'], start, end)
        if s is None or mix is None or bass is None:
            continue
        levels = {p: db(y[p][round(start*RATE):round(end*RATE)]) for p in ['other', 'bass', 'vocals']}
        old_fit, new_fit = fit(s, old), fit(s, notes)
        mix_old, mix_new = fit(mix, old), fit(mix, notes)
        linear = {n: fit(s, [n]) for n in range(40, 77)}
        ranked = sorted(linear, key=linear.get, reverse=True)
        mix_best = max(range(40, 77), key=lambda n: fit(mix, [n]))
        linear_margin = linear[ranked[0]] - linear[ranked[1]]
        bass_ratio = 10 * np.log10(max(1e-15, harmonic_power(s, note, [1, 2]))
            / max(1e-15, harmonic_power(bass, note, [1, 2])))
        purity = harmonic_power(s, note, range(1, 49)) / max(1e-15, float(sum(s[1]**2)))
        accepted = bool(levels['vocals'] < -45 and levels['other'] > -40
            and new_fit > .65 and new_fit-old_fit > .20 and mix_new-mix_old > .15
            and ranked[0] == note and mix_best == note and linear_margin > .10
            and bass_ratio > 6 and purity > .80)
        decisions.append(dict(index=index, row=row, time_s=at, window_s=[start, end],
            old_notes=old, notes=notes, cqt_similarity=float(scores[best]), cqt_margin=margin,
            cqt_improvement=improvement, cqt_votes=votes, other_old=old_fit, other_new=new_fit,
            premix_old=mix_old, premix_new=mix_new, linear_best=ranked[0], linear_margin=linear_margin,
            premix_best=mix_best, level_dbfs=levels, other_over_bass_harmonics_db=float(bass_ratio),
            harmonic_power_fraction=purity, accepted=accepted,
            adopted=accepted and index not in WITHHELD.get(song, set())))
    return dict(song=song, source_sha256=hashes, input_line_sha256=g.digest(line),
                events_count=len(rows), bpm_fit=line['bpm_fit'], decisions=decisions)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path)
    p.add_argument('--self-test', action='store_true')
    p.add_argument('--spectrum-cache', type=Path)
    p.add_argument('--baseline-ref')
    p.add_argument('--write', action='store_true')
    args = p.parse_args()
    if args.self_test:
        t = np.arange(RATE)/RATE
        tone = sum(np.sin(2*np.pi*220*k*t)/k for k in range(1, 9))
        mono = spectrum(tone[:, None], .2, .5)
        stereo = spectrum(np.array([tone, -tone]).T, .2, .5)
        assert np.allclose(mono[1], stereo[1])
        assert max(range(40, 77), key=lambda n: fit(stereo, [n])) == 57
        assert harmonic_power(stereo, 57, range(1, 49))/sum(stereo[1]**2) > .8
        fifth = sum(np.sin(2*np.pi*220*2**(7/12)*k*t)/k for k in range(1, 9))
        chord = spectrum((tone+fifth)[:, None], .2, .5)
        assert harmonic_power(chord, 57, range(1, 49))/sum(chord[1]**2) < .8
        assert fit(spectrum(np.zeros((RATE, 2)), .2, .5), [57]) == 0
        assert spectrum(np.zeros((RATE, 2)), -.1, .2) is None
        assert spectrum(np.zeros((RATE, 2)), .9, 1.2) is None
        print('PASS: known pitch, audible fifth rejection, stereo polarity, silence and window bounds')
        return
    if not args.out:
        p.error('--out is required')
    if args.write and args.baseline_ref:
        p.error('Baseline reproduction is read-only')
    baseline = subprocess.check_output(['git', 'rev-parse', '--verify', '--end-of-options',
        args.baseline_ref+'^{commit}'], text=True).strip() if args.baseline_ref else None
    reports, pending = [], []
    for song in h.SONGS:
        path = ROOT / f'presets/drum-frames-tabasco-{song}.json'
        relative = path.relative_to(ROOT).as_posix()
        raw = subprocess.check_output(['git', 'show', baseline+':'+relative]).decode() if baseline else path.read_text('utf8')
        data = json.loads(raw)
        item = inspect(song, data, args.spectrum_cache)
        accepted = [d for d in item['decisions'] if d['adopted']]
        if accepted:
            metadata = dict(method=METHOD, events_count=item['events_count'], bpm_fit=item['bpm_fit'],
                source_sha256=item['source_sha256'], entries=[[d['index'], d['row'], d['notes'][0]] for d in accepted])
            start = raw.index('{', raw.index('"guitar_line"'))
            _, length = json.JSONDecoder().raw_decode(raw[start:])
            at = start+length-1
            addition = ',\n  "single_note_voicings": '+json.dumps(metadata, indent=2)+'\n '
            pending.append((path, raw, raw[:at].rstrip()+addition+raw[at:]))
        reports.append(item)
        print(song, len(accepted), 'accepted /', len(item['decisions']), 'candidates', flush=True)
    report = dict(method=METHOD, parameters=PARAMETERS, sample_rate=RATE,
        count=sum(d['adopted'] for r in reports for d in r['decisions']), songs=reports,
        limits=['Inference, not exact guitar/string transcription or a listening accuracy score.',
                'Other is a separated mixed track, not an original guitar multitrack.',
                'No changes to attack, duration, velocity, original audio, bass or drums.',
                'Uncertain attacks keep existing voicings; octave doubling and string positions remain unresolved.'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)+'\n', 'utf8')
    if args.write:
        if any(path.read_text('utf8') != raw for path, raw, _ in pending):
            raise ValueError('Score changed during analysis; no writes applied')
        for path, _, value in pending:
            path.write_text(value, 'utf8')


if __name__ == '__main__':
    main()
