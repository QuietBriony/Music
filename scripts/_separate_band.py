"""Generic band-room stem-separator. Run on any folder of m4a/wav/mp3.

Usage:
  python scripts/_separate_band.py <band-id> [<source-folder>]

Defaults:
  source-folder = C:/Users/平成造園/Desktop/musicpl/<band-id-capitalized>/
  or C:/Users/平成造園/Desktop/musicpl/<band-id>/

Output:
  - Demucs raw: C:/Users/平成造園/Desktop/stems_out/htdemucs/<base>_{stem}.mp3
  - Music repo: presets/<band-id>-stems/<sanitized-songid>/{vocals,drums,bass,other}.mp3

Then add the band entry to presets/bands.json manually (mapping song-id → file).
"""
import os, sys, subprocess, tempfile, shutil, re
import imageio_ffmpeg

if len(sys.argv) < 2:
    print("usage: python scripts/_separate_band.py <band-id> [<source-folder>]")
    sys.exit(1)

BAND_ID = sys.argv[1].lower()
SRC_DIR = sys.argv[2] if len(sys.argv) > 2 else None

# Try a few default paths if source dir not given
if not SRC_DIR:
    candidates = [
        rf"C:\Users\平成造園\Desktop\musicpl\{BAND_ID.upper()}",
        rf"C:\Users\平成造園\Desktop\musicpl\{BAND_ID.capitalize()}",
        rf"C:\Users\平成造園\Desktop\musicpl\{BAND_ID}",
    ]
    for c in candidates:
        if os.path.isdir(c):
            SRC_DIR = c
            break
    if not SRC_DIR:
        print(f"! source folder not found. Tried: {candidates}")
        print(f"  pass an explicit path as 2nd arg.")
        sys.exit(1)

print(f"Band: {BAND_ID}")
print(f"Source: {SRC_DIR}")

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUTPUT_DIR = r"C:\Users\平成造園\Desktop\stems_out"
MUSIC_REPO = r"C:\workspace\music-stack\Music"
STEM_TARGET = os.path.join(MUSIC_REPO, "presets", f"{BAND_ID}-stems")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STEM_TARGET, exist_ok=True)

def sanitize_id(name):
    # "06 Human Fly" → "human-fly"
    n = re.sub(r"^\d+\s*", "", name).strip()
    n = re.sub(r"[^\w\s-]", "", n)
    n = re.sub(r"\s+", "-", n).lower()
    return n

EXTS = (".m4a", ".mp3", ".wav", ".flac", ".aac")
files = sorted([f for f in os.listdir(SRC_DIR) if f.lower().endswith(EXTS)])
print(f"Found {len(files)} audio files")
if not files:
    sys.exit(0)

for f in files:
    src = os.path.join(SRC_DIR, f)
    base = os.path.splitext(f)[0]
    song_id = sanitize_id(base)
    print(f"\n=== {f}  →  song-id: {song_id} ===")

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    print(f"  Converting to wav...")
    r = subprocess.run(
        [FFMPEG, "-y", "-i", src, "-ac", "2", "-ar", "44100", "-vn", tmp.name],
        capture_output=True
    )
    if r.returncode != 0:
        print(f"  ! ffmpeg failed")
        os.unlink(tmp.name)
        continue

    print(f"  Running demucs...")
    cmd = [
        sys.executable, "-m", "demucs",
        "--mp3", "--mp3-bitrate", "192",
        "-n", "htdemucs",
        "-o", OUTPUT_DIR,
        "--filename", base + "_{stem}.{ext}",
        tmp.name
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ! demucs failed: {r.stderr[-300:]}")
    else:
        # Copy to Music repo
        song_dir = os.path.join(STEM_TARGET, song_id)
        os.makedirs(song_dir, exist_ok=True)
        for stem in ["vocals", "drums", "bass", "other"]:
            src_p = os.path.join(OUTPUT_DIR, "htdemucs", f"{base}_{stem}.mp3")
            dst_p = os.path.join(song_dir, f"{stem}.mp3")
            if os.path.exists(src_p):
                shutil.copy2(src_p, dst_p)
                sz = os.path.getsize(dst_p) / 1024
                print(f"    OK  {song_id}/{stem}.mp3  {sz:.0f} KB")

    os.unlink(tmp.name)

print(f"\n=== Done ===")
print(f"\nNext steps:")
print(f"  1. Add band entry to presets/bands.json:")
print(f"     bands.{BAND_ID} = {{ name, subtitle, stems_dir: 'presets/{BAND_ID}-stems', ")
print(f"                        drum_frames_pattern: 'presets/drum-frames-{BAND_ID}-{{songid}}.json',")
print(f"                        songs: [...]  // list with song-id from sanitized filenames")
print(f"  2. (Optional) Create drum-frames-{BAND_ID}-*.json per song (use scripts/_gen_*.py pattern)")
print(f"  3. (Optional) Add stems to sw.js precache for offline use")
print(f"  4. Reload band-room.html — new band appears in selector")
