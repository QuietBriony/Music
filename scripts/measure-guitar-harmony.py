#!/usr/bin/env python3
"""Estimate bounded ARCB guitar voicings from existing other stems, on CPU.

This is conservative harmonic inference, not exact chord/fret transcription.
Analyze sustained content independently of the old bass-derived guitar roots;
retain the old score on weak, ambiguous or changing windows. No attacks are
added. The browser only reads the small resulting note arrays, never analyzes.

python scripts/measure-guitar-harmony.py --all --out report.json [--write]
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
import librosa
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
SR=22050; HOP=256; LOW=40; COUNT=72
SONGS=['human-fly','electric-sheep','hey','sister','i-got-a-feeling','under-the-moon','tabasco']
THRESHOLDS={'similarity':.48,'pitch_class_margin':.06,'thirds_agreement':2/3,'improvement':.08,'triad_improvement':.09,'triad_margin':.04}

def events_hash(events):
    canonical=[[int(round(float(v)*1000)) for v in row] for row in events]
    return hashlib.sha256(json.dumps(canonical,separators=(',',':')).encode()).hexdigest()

def embed_metadata(raw,metadata):
    start=raw.index('"guitar_line"')+len('"guitar_line"')
    start=raw.index('{',start)
    line,end=json.JSONDecoder().raw_decode(raw,start)
    if 'harmonic_voicings' in line:
        raise ValueError('Existing harmony metadata requires an explicit replacement')
    addition='"harmonic_voicings": '+json.dumps(metadata,ensure_ascii=False,indent=1)
    # Keep every existing score byte: avoid reformatting thousands of notes.
    return raw[:end-1].rstrip()+',\n'+'\n'.join('  '+s for s in addition.splitlines())+'\n '+raw[end-1:]

def harmonic_template(notes):
    bins=np.arange(COUNT); result=np.zeros(COUNT)
    for note in notes:
        for partial in range(1,9):
            position=note-LOW+12*np.log2(partial)
            result+=np.exp(-.5*((bins-position)/.4)**2)/(partial**1.1)
    return result/np.linalg.norm(result)

MODELS=[(root,kind,[root+i for i in intervals]) for root in range(40,65)
        for kind,intervals in [('power',[0,7,12]),('maj',[0,4,7]),('min',[0,3,7])]]
TEMPLATES=np.array([harmonic_template(notes) for root,kind,notes in MODELS])
POWER=np.array([i for i,m in enumerate(MODELS) if m[1]=='power'])

def normalized_spectrum(C,a,b):
    value=np.median(C[:,a:b],axis=1)
    return value/(np.linalg.norm(value)+1e-12)

def analyze(song,write=False):
    path=ROOT/f'presets/drum-frames-tabasco-{song}.json';raw=path.read_text(encoding='utf8');data=json.loads(raw)
    line=data['guitar_line'];events=line['events'];bpm=line['bpm_fit'];barsec=240/bpm
    stem=ROOT/f'presets/tabasco-stems/{song}/other.mp3'
    y,_=librosa.load(str(stem),sr=SR,mono=False)
    channels=y if y.ndim==2 else y[None,:]
    spectra=[]
    for channel in channels:
        harmonic=librosa.effects.harmonic(channel,margin=3)
        spectra.append(np.abs(librosa.cqt(harmonic,sr=SR,hop_length=HOP,
          fmin=librosa.midi_to_hz(LOW),n_bins=COUNT,tuning=0)))
    # Magnitudes, rather than a mono waveform average, retain opposite-phase
    # stereo guitar content. This also avoids masking it with channel cancellation.
    C=np.mean(spectra,axis=0)
    bars={}
    for row in events:bars.setdefault(int(row[0]),[]).append(row)
    chosen=[];diagnostics=[]
    for bar,rows in sorted(bars.items()):
        a=max(0,round((bar*barsec+.08)*SR/HOP));b=min(C.shape[1],round((bar+1)*barsec*SR/HOP))
        if b-a<9:continue
        energy=float(np.linalg.norm(np.median(C[:,a:b],axis=1)))
        if energy<1e-5:continue
        spectrum=normalized_spectrum(C,a,b);scores=TEMPLATES@spectrum
        best=int(POWER[np.argmax(scores[POWER])]);root,kind,notes=MODELS[best]
        margin=float(scores[best]-max(scores[i] for i in POWER if MODELS[i][0]%12!=root%12))
        pieces=[(a+(b-a)*i//3,a+(b-a)*(i+1)//3) for i in range(3)]
        piece_scores=[TEMPLATES@normalized_spectrum(C,aa,bb) for aa,bb in pieces]
        votes=[MODELS[int(POWER[np.argmax(sc[POWER])])][0]%12 for sc in piece_scores]
        agreement=votes.count(root%12)/3
        old=sum((harmonic_template([r[3],r[3]+7,r[3]+12])@spectrum)*max(.01,r[4]) for r in rows)/sum(max(.01,r[4]) for r in rows)
        accepted=(scores[best]>=THRESHOLDS['similarity'] and margin>=THRESHOLDS['pitch_class_margin']
          and agreement>=THRESHOLDS['thirds_agreement'] and scores[best]-old>=THRESHOLDS['improvement'])
        # Add a third only when it has clear evidence over the power voicing,
        # its alternate quality, and at least two separate temporal windows.
        triads=[i for i,m in enumerate(MODELS) if m[0]==root and m[1]!='power']
        triad=max(triads,key=lambda i:scores[i]);alternate=next(i for i in triads if i!=triad)
        if accepted and scores[triad]-scores[best]>=THRESHOLDS['triad_improvement'] and scores[triad]-scores[alternate]>=THRESHOLDS['triad_margin']:
            if sum(sc[triad]>sc[alternate] and sc[triad]>sc[best] for sc in piece_scores)>=2:
                best=triad;root,kind,notes=MODELS[best]
        item={'bar':bar,'root':root,'kind':kind,'notes':notes,'score':round(float(scores[best]),5),
              'old_score':round(float(old),5),'pc_margin':round(margin,5),'agreement':round(agreement,5),'accepted':bool(accepted)}
        diagnostics.append(item)
        if accepted:chosen.append([bar,notes,round(float(scores[best]),5),round(margin,5),round(agreement,5)])
    metadata={'format':'bar-voicings-v1','method':'stereo sustained CQT harmonic templates; confidence-gated power/triad candidates',
      'events_count':len(events),'events_sha256':events_hash(events),'stem_sha256':hashlib.sha256(stem.read_bytes()).hexdigest(),
      'bpm_fit':bpm,'bars':chosen}
    if write:
        path.write_text(embed_metadata(raw,metadata),encoding='utf8')
    result={'song':song,'metadata':metadata,'scored_bars':len(bars),'inferred_bars':len(chosen),'covered_attacks':sum(len(bars[r[0]]) for r in chosen),'diagnostics':diagnostics}
    print(f'{song}: accepted {len(chosen)}/{len(bars)} bars, {result["covered_attacks"]}/{len(events)} existing attacks',flush=True)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);g=p.add_mutually_exclusive_group(required=True);g.add_argument('--song',choices=SONGS);g.add_argument('--all',action='store_true')
    p.add_argument('--out',type=Path,required=True);p.add_argument('--write',action='store_true');args=p.parse_args()
    report={'scope':'Confidence-gated guitar harmony inference, not exact polyphonic transcription','thresholds':THRESHOLDS,
      'analysis':{'sample_rate':SR,'hop':HOP,'midi_min':LOW,'cqt_bins':COUNT,'harmonic_margin':3,'partials':8,'stereo':'average magnitudes'},
      'caveats':['Other includes lead instruments, vocal bleed and separation errors. Low confidence retains old voicing.',
        'Template similarity is an inference criterion; validation must use actual output with a different representation.',
        'Attack times, durations, velocities, bass and drums are not rewritten. No reference audio is added.'],
      'songs':[analyze(song,args.write) for song in (SONGS if args.all else [args.song])]}
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

if __name__=='__main__':main()
