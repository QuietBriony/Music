#!/usr/bin/env python3
"""Compare actual guitar REC pitch-class energy to existing other stems.

Uses linear STFT power, without CQT, harmonic separation or chord templates.
This is a timbre-dependent diagnostic, not chord accuracy or a listening score.
python scripts/measure-guitar-output.py --captures output/playwright/mix-calibration --out report.json
"""
import argparse, hashlib, json
from pathlib import Path
import librosa
import numpy as np
import soundfile as sf
from scipy.signal import stft

def pitch_classes(y, sr):
    y=np.asarray(y,dtype=float)
    if y.ndim == 1: y = y[:, None]
    if y.ndim != 2 or y.shape[1] not in (1,2) or len(y)<16384 or sr<8000 or not np.isfinite(y).all():
        raise ValueError('Need finite mono/stereo PCM of at least one FFT window')
    spectra = []
    for channel in y.T:
        f, _, z = stft(channel, fs=sr, nperseg=16384, noverlap=12288, boundary=None, padded=False)
        spectra.append(np.abs(z)**2)
    power = np.mean(spectra, axis=(0, 2))
    keep = (f >= 90) & (f <= 2400)
    midi = 69 + 12*np.log2(f[keep]/440)
    nearest = np.rint(midi).astype(int)
    weight = np.exp(-.5*((midi-nearest)/.2)**2)
    result = np.bincount(nearest % 12, weights=power[keep]*weight, minlength=12)
    return result / max(np.linalg.norm(result), 1e-24)

def self_test():
    sr=48000;t=np.arange(sr*2)/sr
    a=np.sin(2*np.pi*110*t)*.1
    fs=np.sin(2*np.pi*184.997211*t)*.1
    v=pitch_classes(a,sr)
    assert np.argmax(v)==9 and v[9]>.98
    assert np.argmax(pitch_classes(fs,sr))==6
    assert np.allclose(v,pitch_classes(np.column_stack([a,-a]),sr))
    assert v@pitch_classes(fs,sr)<.05
    try: pitch_classes(np.full(sr,np.nan),sr)
    except ValueError: pass
    else: raise AssertionError('Nonfinite PCM accepted')
    print('Guitar output measurement PASS: known pitch classes, phase preservation and nonfinite rejection')

def compare(captures, baseline, candidate):
    rows=[]
    for path in sorted(captures.glob(f'{candidate}-*-synth.wav')):
        key=path.name[len(candidate)+1:-len('-synth.wav')]
        old=captures/f'{baseline}-{key}-synth.wav'
        vectors=[]; captures_meta=[]
        for wav in [old,path]:
            meta=json.loads(wav.with_suffix('.json').read_text())
            y,sr=sf.read(wav,always_2d=True)
            stem=Path(f'presets/tabasco-stems/{meta["song"]}/other.mp3')
            ref,_=librosa.load(stem,sr=sr,mono=False)
            ref=ref.T if ref.ndim==2 else ref[:,None]
            a=round(meta['firstElapsed']*sr); ref=ref[a:a+len(y)]
            v=pitch_classes(y,sr); target=pitch_classes(ref,sr)
            vectors.append({'cosine_distance':round(float(1-v@target),6),
              'output_pitch_class_energy':v.tolist(),'reference_pitch_class_energy':target.tolist(),
              'wav_sha256':hashlib.sha256(wav.read_bytes()).hexdigest(),
              'reference_sha256':hashlib.sha256(stem.read_bytes()).hexdigest()})
            captures_meta.append(meta)
        rows.append({'clip':key,'baseline':vectors[0],'candidate':vectors[1],
          'capture_metadata':captures_meta})
        print(f'{key}: {vectors[0]["cosine_distance"]} -> {vectors[1]["cosine_distance"]}',flush=True)
    if not rows: raise ValueError('No matching captures')
    return {'scope':'Actual guitar-only post-master REC versus other, stereo channel power averaged.',
      'method':{'representation':'Linear STFT pitch-class power; no CQT/HPSS/chord template',
        'fft':16384,'hop':4096,'frequency_hz':[90,2400],'bin_weight_width_semitones':.2,
        'pitch_class_order':'C C# D D# E F F# G G# A A# B','distance':'1 - cosine, lower is closer'},
      'caveats':['Other contains other instruments and separation bleed; it is not isolated guitar truth.',
        'Pitch-class energy depends on timbre and harmonic overtones; it cannot certify exact roots, octaves or chord accuracy.',
        'The captured output is actual audio, but comparison is aggregate rather than sample-aligned.',
        'These short windows do not certify all accepted bars, subjective quality or iPhone performance.'],
      'clips':rows}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--captures',type=Path)
    p.add_argument('--baseline',default='harmony-solo-before');p.add_argument('--candidate',default='harmony-solo-after')
    p.add_argument('--out',type=Path);p.add_argument('--self-test',action='store_true');a=p.parse_args()
    if a.self_test: self_test(); raise SystemExit(0)
    if a.captures is None or a.out is None: p.error('--captures and --out required')
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(compare(a.captures,a.baseline,a.candidate),indent=2,allow_nan=False)+'\n')
