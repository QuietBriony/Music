"""Slice vocal stem into phrases (silence-based segmentation).

Pipeline:
  1. Load vocal stem (mp3 → wav via ffmpeg)
  2. librosa.effects.split — find non-silent intervals
  3. Filter by duration (drop < 400ms = too short, drop > 6s = too long)
  4. Save each phrase as wav with metadata

Output:
  presets/sample-kits/<source>/<song>/vocal-phrase-NN.wav
  + phrases.json (manifest with start/end times + RMS + duration)

Usage:
  python scripts/_slice_vocal_phrases.py <source> [<song>|--all]
"""
import os, sys, json, subprocess, tempfile
import imageio_ffmpeg
import numpy as np
import librosa
import soundfile as sf

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MUSIC_REPO = r"C:\workspace\github-inventory\music-stack\Music"

# Tuning: top_db = how much quieter than peak counts as silence
TOP_DB = 30
MIN_PHRASE_S = 0.4
MAX_PHRASE_S = 6.0
MAX_PHRASES_PER_SONG = 20  # keep top N by RMS

def load_stem_as_wav(mp3_path, sr=44100):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False); tmp.close()
    subprocess.run([
        FFMPEG, "-y", "-i", mp3_path,
        "-ac", "1", "-ar", str(sr), "-vn", tmp.name
    ], capture_output=True, check=True)
    y, sr_out = librosa.load(tmp.name, sr=sr, mono=True)
    os.unlink(tmp.name)
    return y, sr_out

def slice_song(source_id, song_id):
    src_dir = os.path.join(MUSIC_REPO, "presets", f"{source_id}-stems", song_id)
    vocal_path = os.path.join(src_dir, "vocals.mp3")
    if not os.path.exists(vocal_path):
        print(f"! vocal stem not found: {vocal_path}")
        return None

    print(f"\n=== {source_id} / {song_id} ===")
    y, sr = load_stem_as_wav(vocal_path)
    print(f"  loaded: {len(y)/sr:.1f}s @ {sr}Hz")

    # Split on silence
    intervals = librosa.effects.split(y, top_db=TOP_DB)
    print(f"  raw intervals: {len(intervals)}")

    # Filter by duration + score by RMS
    phrases = []
    for (start, end) in intervals:
        dur_s = (end - start) / sr
        if dur_s < MIN_PHRASE_S or dur_s > MAX_PHRASE_S:
            continue
        clip = y[start:end]
        rms = float(np.sqrt(np.mean(clip ** 2)))
        if rms < 0.01:
            continue
        # Add 30ms fade in/out to avoid clicks
        fade_n = int(0.03 * sr)
        if len(clip) > 2 * fade_n:
            clip = np.copy(clip)
            clip[:fade_n] *= np.linspace(0.0, 1.0, fade_n)
            clip[-fade_n:] *= np.linspace(1.0, 0.0, fade_n)
        phrases.append({
            "start_s": round(start / sr, 3),
            "end_s": round(end / sr, 3),
            "duration_s": round(dur_s, 3),
            "rms": round(rms, 4),
            "clip": clip
        })

    phrases.sort(key=lambda p: -p["rms"])
    phrases = phrases[:MAX_PHRASES_PER_SONG]
    print(f"  kept (top {len(phrases)} by RMS, {MIN_PHRASE_S}-{MAX_PHRASE_S}s)")

    out_dir = os.path.join(MUSIC_REPO, "presets", "sample-kits", source_id, song_id)
    os.makedirs(out_dir, exist_ok=True)
    manifest = {
        "source": source_id,
        "song_id": song_id,
        "source_stem": f"presets/{source_id}-stems/{song_id}/vocals.mp3",
        "sample_rate": sr,
        "silence_top_db": TOP_DB,
        "phrases": []
    }
    for i, p in enumerate(phrases):
        fname = f"vocal-phrase-{i+1:02d}.wav"
        fpath = os.path.join(out_dir, fname)
        sf.write(fpath, p["clip"], sr, subtype="PCM_16")
        manifest["phrases"].append({
            "file": fname,
            "src_start_s": p["start_s"],
            "src_end_s": p["end_s"],
            "duration_s": p["duration_s"],
            "rms": p["rms"]
        })
        sz_kb = os.path.getsize(fpath) / 1024
        print(f"    OK  {fname}  {p['duration_s']:.2f}s  rms={p['rms']:.3f}  {sz_kb:.0f}KB")

    # Merge into existing summary.json (drum samples already there)
    summary_path = os.path.join(out_dir, "summary.json")
    summary = {}
    if os.path.exists(summary_path):
        with open(summary_path, "r", encoding="utf-8") as f:
            summary = json.load(f)
    summary["vocal_phrases"] = manifest
    with open(summary_path, "w", encoding="utf-8") as o:
        json.dump(summary, o, indent=2, ensure_ascii=False)
    return manifest

if __name__ == "__main__":
    os.chdir(MUSIC_REPO)
    if len(sys.argv) < 2:
        print("usage: python scripts/_slice_vocal_phrases.py <source-id> [<song-id>|--all]")
        sys.exit(1)
    source = sys.argv[1]
    target = sys.argv[2] if len(sys.argv) > 2 else "--all"

    if target == "--all":
        stem_root = os.path.join(MUSIC_REPO, "presets", f"{source}-stems")
        songs = sorted([d for d in os.listdir(stem_root) if os.path.isdir(os.path.join(stem_root, d))])
        for sid in songs:
            slice_song(source, sid)
    else:
        slice_song(source, target)
