"""Slice drum hits from a stem mp3 into individual wav samples.

Pipeline:
  1. Load drum stem (mp3 via ffmpeg → wav buffer)
  2. librosa.onset_detect — find every transient
  3. Extract 250ms clip starting at each onset
  4. Classify each clip via spectral centroid + zero-crossing rate:
       centroid < 200 Hz  → kick
       200-2000 Hz      → snare
       > 2000 Hz        → hat (closed)
       very long decay  → cymbal/ride
  5. Pick top-N by energy (loudest) per category
  6. Save as wav at presets/sample-kits/<source>/<song>/<type>-N.wav

Usage:
  python scripts/_slice_drum_hits.py <source-band-id> <song-id>
  python scripts/_slice_drum_hits.py unripe continuous
  python scripts/_slice_drum_hits.py unripe --all   # all 6 UNRIPE songs

Output:
  presets/sample-kits/<source>/<song>/kick-{N}.wav
                                       snare-{N}.wav
                                       hat-{N}.wav
                                       crash-{N}.wav
                                       summary.json (manifest with metadata)
"""
import os, sys, json, subprocess, tempfile
import imageio_ffmpeg
import numpy as np
import librosa
import soundfile as sf

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MUSIC_REPO = r"C:\workspace\github-inventory\music-stack\Music"

def load_stem_as_wav(mp3_path, sr=44100):
    """Convert mp3 to wav buffer via ffmpeg, return mono float32 array + sr."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    subprocess.run([
        FFMPEG, "-y", "-i", mp3_path,
        "-ac", "1", "-ar", str(sr), "-vn", tmp.name
    ], capture_output=True, check=True)
    y, sr_out = librosa.load(tmp.name, sr=sr, mono=True)
    os.unlink(tmp.name)
    return y, sr_out

def classify_hit(clip, sr):
    """Return (type, confidence, features) using band-energy ratios."""
    if len(clip) < 100:
        return ("unknown", 0.0, {})
    rms = float(np.sqrt(np.mean(clip ** 2)))
    if rms < 0.005:
        return ("silence", 0.0, {"rms": rms})

    head = clip[:int(0.08 * sr)]
    if len(head) < 10:
        return ("unknown", 0.0, {})

    # Band energy ratios via FFT
    n_fft = 4096
    pad = max(0, n_fft - len(head))
    padded = np.pad(head, (0, pad))
    fft = np.abs(np.fft.rfft(padded[:n_fft]))
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    total = float(fft.sum()) + 1e-9
    sub_e = float(fft[freqs < 120].sum()) / total      # 0-120 Hz (kick fundamental)
    low_e = float(fft[(freqs >= 120) & (freqs < 350)].sum()) / total  # 120-350 Hz (kick body / tom)
    mid_e = float(fft[(freqs >= 350) & (freqs < 2000)].sum()) / total # 350-2000 Hz (snare body)
    snap_e = float(fft[(freqs >= 2000) & (freqs < 5000)].sum()) / total # 2-5 kHz (snare snap / hat)
    high_e = float(fft[freqs >= 5000].sum()) / total   # 5+ kHz (hat / cymbal)

    # Decay ratio (cymbals decay slow)
    if len(clip) > int(0.15 * sr):
        head_e = float(np.sqrt(np.mean(clip[:int(0.05 * sr)] ** 2)))
        tail_e = float(np.sqrt(np.mean(clip[int(0.15 * sr):int(0.25 * sr)] ** 2)))
        decay_ratio = tail_e / (head_e + 1e-6)
    else:
        decay_ratio = 0.0

    features = {
        "rms": round(rms, 4),
        "sub_e": round(sub_e, 3),
        "low_e": round(low_e, 3),
        "mid_e": round(mid_e, 3),
        "snap_e": round(snap_e, 3),
        "high_e": round(high_e, 3),
        "decay_ratio": round(decay_ratio, 3)
    }

    # Decision tree based on band-energy distribution.
    # Kick: dominant in sub + low bands
    if (sub_e + low_e) > 0.50 and sub_e > 0.18:
        return ("kick", 0.9, features)
    # Crash/cymbal: high+snap dominant + slow decay
    if (high_e + snap_e) > 0.50 and decay_ratio > 0.35:
        return ("crash", 0.75, features)
    # Hat closed: high band dominant + fast decay + low rms
    if high_e > 0.35 and decay_ratio < 0.25:
        return ("hat", 0.85, features)
    # Snare: mid + snap dominant
    if (mid_e + snap_e) > 0.55 and mid_e > 0.15:
        return ("snare", 0.8, features)
    # Tom: dominant in low+mid (pitched body without snare snap)
    if (low_e + mid_e) > 0.55 and snap_e < 0.20:
        return ("tom", 0.6, features)
    return ("other", 0.3, features)

def slice_song(source_id, song_id, top_n_per_type=8):
    src_dir = os.path.join(MUSIC_REPO, "presets", f"{source_id}-stems", song_id)
    drum_path = os.path.join(src_dir, "drums.mp3")
    if not os.path.exists(drum_path):
        print(f"! drum stem not found: {drum_path}")
        return None

    print(f"\n=== {source_id} / {song_id} ===")
    y, sr = load_stem_as_wav(drum_path)
    print(f"  loaded: {len(y)/sr:.1f}s @ {sr}Hz")

    # Detect onsets
    onsets_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames", backtrack=True, hop_length=512)
    onsets_times = librosa.frames_to_time(onsets_frames, sr=sr, hop_length=512)
    print(f"  onsets detected: {len(onsets_times)}")

    # Extract clips + classify
    clip_dur = 0.30  # 300ms per clip
    clip_samples = int(clip_dur * sr)
    hits = []
    for t in onsets_times:
        i = int(t * sr)
        clip = y[i:i + clip_samples]
        if len(clip) < clip_samples * 0.7:
            continue
        # Apply short fade-out to avoid clicks
        fade_n = int(0.01 * sr)
        if len(clip) > fade_n:
            fade = np.linspace(1.0, 0.0, fade_n)
            clip = np.copy(clip)
            clip[-fade_n:] *= fade
        cls, conf, feat = classify_hit(clip, sr)
        if cls in ("silence", "unknown"):
            continue
        hits.append({
            "time": float(t), "type": cls, "confidence": conf,
            "rms": feat.get("rms", 0), "clip": clip, "features": feat
        })

    # Bucket by type
    by_type = {}
    for h in hits:
        by_type.setdefault(h["type"], []).append(h)
    for t in by_type:
        # Sort by RMS (loudest first) — they're cleaner samples
        by_type[t].sort(key=lambda h: -h["rms"])
    print("  classified:", {t: len(v) for t, v in by_type.items()})

    # Save top-N per type
    out_dir = os.path.join(MUSIC_REPO, "presets", "sample-kits", source_id, song_id)
    os.makedirs(out_dir, exist_ok=True)

    manifest = {
        "source": source_id,
        "song_id": song_id,
        "source_stem": f"presets/{source_id}-stems/{song_id}/drums.mp3",
        "sample_rate": sr,
        "clip_duration_s": clip_dur,
        "samples": {}
    }

    for type_name in ("kick", "snare", "hat", "crash", "tom", "other"):
        chosen = by_type.get(type_name, [])[:top_n_per_type]
        if not chosen:
            continue
        manifest["samples"][type_name] = []
        for i, h in enumerate(chosen):
            fname = f"{type_name}-{i+1:02d}.wav"
            fpath = os.path.join(out_dir, fname)
            sf.write(fpath, h["clip"], sr, subtype="PCM_16")
            manifest["samples"][type_name].append({
                "file": fname,
                "src_time_s": round(h["time"], 3),
                "rms": h["rms"],
                "confidence": h["confidence"],
                "features": h["features"]
            })
            f = h['features']
            print(f"    OK  {type_name}-{i+1:02d}.wav  rms={h['rms']:.3f} conf={h['confidence']:.2f} "
                  f"sub={f.get('sub_e',0):.2f} low={f.get('low_e',0):.2f} mid={f.get('mid_e',0):.2f} high={f.get('high_e',0):.2f}")

    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as o:
        json.dump(manifest, o, indent=2, ensure_ascii=False)
    print(f"  manifest → {out_dir}/summary.json")
    return manifest

if __name__ == "__main__":
    os.chdir(MUSIC_REPO)
    if len(sys.argv) < 2:
        print("usage: python scripts/_slice_drum_hits.py <source-band-id> [<song-id>|--all]")
        sys.exit(1)
    source = sys.argv[1]
    target = sys.argv[2] if len(sys.argv) > 2 else None

    if target == "--all" or target is None:
        # All songs in the source dir
        stem_root = os.path.join(MUSIC_REPO, "presets", f"{source}-stems")
        if not os.path.isdir(stem_root):
            print(f"! no stems found at {stem_root}")
            sys.exit(1)
        songs = sorted([d for d in os.listdir(stem_root) if os.path.isdir(os.path.join(stem_root, d))])
        for sid in songs:
            slice_song(source, sid)
    else:
        slice_song(source, target)
