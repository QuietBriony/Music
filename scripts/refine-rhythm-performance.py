#!/usr/bin/env python3
"""Conservatively align existing bass/drum scores to local recorded stems.

CPU only. Band-filtered energy rises locate attacks without the old full-band
onset detector's centering offset. YIN validates bass pitch before changes;
splits additionally require independent spectral flux. No pitch replacement,
quantization, new stems or models. Drum cymbal additions are hypotheses, not
verified labels. --write is opt-in and refuses already-refined input.
"""
import argparse
from pathlib import Path
import json, hashlib, subprocess
import librosa
import numpy as np
from scipy.signal import butter, sosfiltfilt, find_peaks
from scipy.ndimage import uniform_filter1d

ROOT=Path(__file__).resolve().parent.parent
SR=22050; HOP=128; DT=HOP/SR
SONGS=['human-fly','electric-sheep','hey','sister','i-got-a-feeling','under-the-moon','tabasco']

def envelope(y, low, high):
    filtered=sosfiltfilt(butter(3,[low,high],btype='bandpass',fs=SR,output='sos'),y,axis=-1)
    if filtered.ndim==2: power=np.mean(filtered**2,axis=0)
    else: power=filtered**2
    return np.sqrt(np.maximum(0,uniform_filter1d(power,size=221)[::HOP]))

def attacks(env):
    # Positive 12-ms envelope rise; no STFT centering/onset_strength offset.
    rise=np.maximum(0,env-np.r_[np.repeat(env[0],2),env[:-2]])
    scale=np.percentile(rise[rise>0],95) if np.any(rise>0) else 1
    peaks,_=find_peaks(rise,height=scale*.65,prominence=scale*.4,distance=round(.075/DT))
    out=[]
    for f in peaks:
        pre=float(np.median(env[max(0,f-8):max(1,f-3)]))
        peak=float(np.max(env[f:min(len(env),f+6)]))
        if peak<max(pre*1.6,.002):continue
        # First rise out of the pre-attack floor, bounded to 23 ms.
        first=f
        while first>max(0,f-4) and env[first-1]>pre+.18*(peak-pre):first-=1
        out.append({'frame':int(first),'time':round(first*DT,6),'peak':peak,'rise':float(rise[f]),'ratio':peak/(pre+1e-9)})
    return out


def refine_rows(rows, step, info, part):
    result=[r.copy() for r in rows]
    starts=[(r[0]*16+r[1])*step for r in rows]
    def place(row,t):
        position=round(max(0,t)/step,2)
        row[0]=int(position//16);row[1]=round(position%16,2)
    def crowded(t,cls,index=-1):
        return any(j!=index and (part=='bass' or r[3]==cls) and
                   abs((r[0]*16+r[1])*step-t)<.06 for j,r in enumerate(result))
    info['adopted_moves']=[];info['adopted_splits']=[];info['adopted_adds']=[]
    for move in info['moves']:
        i=move['index'];t=move['new']
        if crowded(t,rows[i][3],i):continue
        place(result[i],t)
        if part=='bass':
            # Preserve the old note-off; alignment must not shorten the ring.
            result[i][2]=round(rows[i][2]+(starts[i]-t)/step,2)
        info['adopted_moves'].append(move)
    for split in info.get('splits',[]):
        i=split['index'];t=split['time'];row=rows[i]
        bar=int(t/step//16)
        if crowded(t,row[3]) or sum(r[0]==bar for r in result)>=16:continue
        # Find the segment containing this additional pluck, including a
        # previous split of the same long note. Keep the final note-off.
        candidates=[(j,r) for j,r in enumerate(result) if r[3]==row[3] and
            (r[0]*16+r[1])*step < t < (r[0]*16+r[1]+r[2])*step]
        if not candidates:continue
        j,segment=max(candidates,key=lambda pair:pair[1][0]*16+pair[1][1])
        begin=(segment[0]*16+segment[1])*step;end=begin+segment[2]*step
        segment[2]=round((t-begin)/step,2)
        new=[0,0,round((end-t)/step,2),row[3],row[4]];place(new,t)
        result.append(new);info['adopted_splits'].append(split)
    for added in info.get('adds',[]):
        t=added['time'];bar=int(t/step//16)
        if crowded(t,2) or sum(r[0]==bar for r in result)>=24:continue
        # Low-level cymbal accompaniment, never louder than its kick.
        row=[0,0,1.0,2,round(min(.55,rows[added['index']][4]*.6),2)]
        place(row,t);result.append(row);info['adopted_adds'].append(added)
    result.sort(key=lambda r:(r[0],r[1],r[3]))
    assert all(len(r)==5 and all(np.isfinite(r)) and 0<=r[1]<16 and r[2]>0 for r in result)
    return result

def replace_line(path,key,line):
    # Keep every unrelated score/annotation byte intact.
    text=path.read_text('utf8');marker=' "'+key+'": '
    start=text.index(marker)+len(marker)
    _,length=json.JSONDecoder().raw_decode(text[start:])
    encoded=json.dumps(line,ensure_ascii=False,indent=1,allow_nan=False).replace('\n','\n ')
    path.write_text(text[:start]+encoded+text[start+length:],'utf8')

def self_test():
    # Known strikes establish the time-domain detector's latency independently
    # of the seven recordings. Opposite stereo phase must not cancel energy.
    t=np.arange(SR*2)/SR
    signal=np.zeros_like(t)
    for onset in [.3,.8,1.3]:
        local=t-onset
        signal+=np.where(local>=0,np.sin(2*np.pi*220*local)*np.exp(-np.maximum(0,local)*22),0)*.4
    mono=envelope(signal,100,1800)
    stereo=envelope(np.array([signal,-signal]),100,1800)
    assert np.allclose(mono,stereo)
    detected=attacks(mono)
    assert len(detected)==3 and all(abs(a['time']-b)<.018 for a,b in zip(detected,[.3,.8,1.3]))
    assert attacks(np.zeros(200))==[]
    rows=[[0,4.,8.,40,.8],[1,1.,2.,43,.6]]
    info={'moves':[{'index':0,'new':.45}], 'splits':[{'index':0,'time':.8}], 'adds':[]}
    updated=refine_rows(rows,.125,info,'bass')
    assert len(updated)==3 and rows[0]==[0,4.,8.,40,.8]
    assert [r[3] for r in updated]==[40,40,43]
    assert abs((updated[1][1]+updated[1][2])*.125-1.5)<.002
    assert all(0<=r[1]<16 for r in updated)
    print('Rhythm refinement PASS: known attack timing, stereo power, silence, pitch and final release preservation')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--song',choices=SONGS)
    parser.add_argument('--out',type=Path)
    parser.add_argument('--write',action='store_true')
    parser.add_argument('--baseline-ref',help='Read unrefined scores from a local Git commit (no network)')
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:
        self_test(); return
    if args.out is None: parser.error('--out is required for analysis')
    args.out.parent.mkdir(parents=True,exist_ok=True)
    reports=[]
    selected=[args.song] if args.song else SONGS
    baseline=None
    if args.baseline_ref:
        baseline=subprocess.check_output(['git','rev-parse','--verify','--end-of-options',args.baseline_ref+'^{commit}'],cwd=ROOT,text=True).strip()
    def read_score(song):
        name=f'presets/drum-frames-tabasco-{song}.json'
        return json.loads(subprocess.check_output(['git','show',baseline+':'+name],cwd=ROOT,text=True,encoding='utf8') if baseline else (ROOT/name).read_text('utf8'))
    for song in selected:
        data=read_score(song)
        if any(data.get(key,{}).get('rhythm_refinement') for key in ['bass_line','drum_line']):
            raise ValueError(f'{song}: already refined; use an unmodified source checkout')
        if args.write and baseline:
            current=json.loads((ROOT/f'presets/drum-frames-tabasco-{song}.json').read_text('utf8'))
            if any(current.get(key)!=data.get(key) for key in ['bass_line','drum_line']):
                raise ValueError(f'{song}: current score differs from baseline; refusing overwrite')
    for song in selected:
        data=read_score(song)
        result={'song':song,'bass':{},'drums':{}}
        for part in ['bass','drums']:
            source=ROOT/f'presets/tabasco-stems/{song}/{part}.mp3'
            y,_=librosa.load(source,sr=SR,mono=False)
            result[part]['source_sha256']=hashlib.sha256(source.read_bytes()).hexdigest()
            line=data.get('bass_line' if part=='bass' else 'drum_line')
            if not line:
                result[part]['absent']=True;continue
            step=15/line['bpm_fit'];rows=line['events'];starts=np.array([(r[0]*16+r[1])*step for r in rows])
            if part=='bass':
                env=envelope(y,100,1800); ats=attacks(env)
                spec=np.abs(librosa.stft(np.mean(y,axis=0) if y.ndim==2 else y,n_fft=1024,hop_length=HOP))
                freq=librosa.fft_frequencies(sr=SR,n_fft=1024)
                band=spec[(freq>=150)&(freq<=2400)]
                flux=np.r_[0,np.maximum(0,np.diff(band,axis=1)).mean(axis=0)]
                q=np.percentile(flux[flux>0],95)
                peaks,_=find_peaks(flux,height=q,prominence=q*.6,distance=round(.09/DT))
                # Independent periodicity check prevents split attacks on bleed/slides.
                mono=y[np.argmax(np.mean(y*y,axis=1))] if y.ndim==2 else y
                lo=sosfiltfilt(butter(3,[28,1200],btype='bandpass',fs=SR,output='sos'),mono)
                lo=librosa.resample(lo,orig_sr=SR,target_sr=11025)
                f0=librosa.yin(lo,sr=11025,fmin=librosa.midi_to_hz(24),fmax=librosa.midi_to_hz(60),frame_length=2048,hop_length=64)
                midi=librosa.hz_to_midi(f0)
                def pitch_ok(a,b,note):
                    v=midi[round(a/DT):round(b/DT)]
                    return len(v)>=4 and float(np.mean(abs(v-note)<.4))>=.8
                moves=[]; splits=[]
                for i,row in enumerate(rows):
                    t=starts[i];end=t+row[2]*step
                    candidates=[a for a in ats if -.09<=a['time']-t<=.015]
                    if candidates and pitch_ok(t+.055,min(end-.025,t+.25),row[3]):
                        a=min(candidates,key=lambda a:abs(a['time']-t))
                        delta=a['time']-t
                        if -.085<=delta<=-.012 and (i==0 or a['time']>starts[i-1]+.065):
                            moves.append({'index':i,'old':round(t,6),'new':a['time'],'delta_ms':round(delta*1000,2),'ratio':round(a['ratio'],2)})
                    for a in ats:
                        at=a['time']
                        if not t+.16<at<end-.16 or np.min(abs(starts-at))<.10 or a['ratio']<3:continue
                        if len(peaks)==0 or np.min(abs(peaks*DT-at))>.025:continue
                        if pitch_ok(at-.13,at-.025,row[3]) and pitch_ok(at+.055,min(at+.23,end-.025),row[3]):
                            splits.append({'index':i,'time':at,'midi':row[3],'ratio':round(a['ratio'],2),'peak':a['peak']})
                result[part].update({'count':len(rows),'attacks':len(ats),'moves':moves,'splits':splits})
            else:
                bands=[(35,120),(180,1400),(6000,10000),(6000,10000)]
                envs=[envelope(y,*b) for b in bands[:3]]; atss=[attacks(e) for e in envs]; atss.append(atss[-1])
                wire=envelope(y,1500,4500)
                moves=[]; adds=[]
                for i,row in enumerate(rows):
                    t=starts[i];cls=row[3]
                    candidates=[a for a in atss[cls] if -.07<=a['time']-t<=.012]
                    if not candidates:continue
                    a=min(candidates,key=lambda a:abs(a['time']-t));delta=a['time']-t
                    if -.065<=delta<=-.012:
                        moves.append({'index':i,'class':cls,'old':round(t,6),'new':a['time'],'delta_ms':round(delta*1000,2)})
                    if cls==0:
                        hats=[h for h in atss[2] if abs(h['time']-a['time'])<.018 and h['ratio']>=4]
                        if not hats:continue
                        h=max(hats,key=lambda h:h['rise']);f=h['frame']
                        if f+10>=len(envs[2]):continue
                        # No cymbal additions close to a scored snare/crash/hat.
                        if any(abs(starts[j]-h['time'])<.09 and r[3]!=0 for j,r in enumerate(rows)):continue
                        if h['peak']<np.percentile(envs[2],80):continue
                        if np.mean(envs[2][f+4:f+10])<h['peak']*.25:continue
                        if h['peak']<np.max(wire[f:f+6])*.25:continue
                        adds.append({'index':i,'time':h['time'],'ratio':round(h['ratio'],2),'peak':h['peak']})
                result[part].update({'count':len(rows),'attacks':[len(a) for a in atss[:3]],'moves':moves,'adds':adds})
        for part,key in [('bass','bass_line'),('drums','drum_line')]:
            info=result[part]; line=data.get(key)
            if not line: continue
            if line.get('rhythm_refinement'):
                raise ValueError(f'{song}/{part}: already refined; use an unmodified source checkout')
            rows=line['events']; step=15/line['bpm_fit']
            before=json.dumps(rows,separators=(',',':'))
            info['input_events_sha256']=hashlib.sha256(before.encode()).hexdigest()
            updated=refine_rows(rows,step,info,part)
            info['output_count']=len(updated)
            info['output_events_sha256']=hashlib.sha256(json.dumps(updated,separators=(',',':')).encode()).hexdigest()
            if args.write:
                line['events']=updated
                line['rhythm_refinement']={'method':'energy-attack-v1','source_sha256':info['source_sha256'],
                    'input_events_sha256':info['input_events_sha256'],'moved':len(info['adopted_moves']),
                    'split':len(info.get('adopted_splits',[])),'added':len(info.get('adopted_adds',[]))}
                replace_line(ROOT/f'presets/drum-frames-tabasco-{song}.json',key,line)
        reports.append(result)
        args.out.write_text(json.dumps(reports,indent=2,allow_nan=False)+'\n','utf8')
        print(song,{k:{x:len(v[x]) if isinstance(v[x],list) else v[x] for x in ['count','moves','splits','adds'] if x in v} for k,v in result.items() if isinstance(v,dict)},flush=True)

if __name__ == "__main__":
    main()
