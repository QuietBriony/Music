"""Separate Tabasco LIVE tracks into 4 stems (vocals+drums+bass+other) via Demucs.
Pre-converts m4a to wav (bypasses torchaudio's torchcodec dependency).
Output: stems_out/htdemucs/<track>/{vocals,drums,bass,other}.mp3

Also copies clean-named stems into Music/presets/tabasco-stems/{song-id}/{stem}.mp3
for band-room.html to load.

All 4 stems played together ≈ original recording (with small separation artifacts).
"""
import os, sys, subprocess, tempfile, shutil
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
INPUT_DIR = r"C:\Users\平成造園\Desktop\musicpl\Tabasco. LIVE"
OUTPUT_DIR = r"C:\Users\平成造園\Desktop\stems_out"
MUSIC_REPO = r"C:\workspace\music-stack\Music"
STEM_TARGET = os.path.join(MUSIC_REPO, "presets", "tabasco-stems")

# Map filename → song-id (matches band-room.html data-song values + presets/drum-frames-tabasco-{id}.json)
NAME_TO_ID = {
    "01 TABASCO": "tabasco",
    "02 Hey": "hey",
    "03 I got a feeling": "i-got-a-feeling",
    "04 Under the Moon": "under-the-moon",
    "05 Electric Sheep": "electric-sheep",
    "06 Human Fly": "human-fly",
    "07 Sister": "sister",
}

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STEM_TARGET, exist_ok=True)

files = sorted([f for f in os.listdir(INPUT_DIR) if f.endswith(".m4a")])
print(f"Found {len(files)} m4a files")

for f in files:
    src = os.path.join(INPUT_DIR, f)
    base = os.path.splitext(f)[0]
    print(f"\n=== {f} ===")

    # Convert to wav in a temp dir
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    print(f"  Converting m4a -> wav...")
    r = subprocess.run(
        [FFMPEG, "-y", "-i", src, "-ac", "2", "-ar", "44100", "-vn", tmp.name],
        capture_output=True
    )
    if r.returncode != 0:
        print(f"  ! ffmpeg failed: {r.stderr.decode('utf-8', errors='replace')[-300:]}")
        os.unlink(tmp.name)
        continue
    print(f"  wav: {os.path.getsize(tmp.name)/1024/1024:.1f} MB")

    # Run demucs --two-stems vocals
    print(f"  Running demucs (this takes 1-5 min per song)...")
    # Full 4-stem separation: vocals + drums + bass + other.
    # Sum of stems ≈ original mix (small artifacts only).
    cmd = [
        sys.executable, "-m", "demucs",
        "--mp3", "--mp3-bitrate", "192",
        "-n", "htdemucs",
        "-o", OUTPUT_DIR,
        "--filename", base + "_{stem}.{ext}",  # flat: 01_vocals.mp3, 01_drums.mp3, ...
        tmp.name
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(r.stdout[-600:] if r.stdout else "")
    if r.returncode != 0:
        print(f"  ! demucs failed: {r.stderr[-300:]}")
    else:
        print(f"  OK demucs")
        # Copy outputs to Music/presets/tabasco-stems/{song-id}/{stem}.mp3
        song_id = NAME_TO_ID.get(base)
        if song_id:
            song_dir = os.path.join(STEM_TARGET, song_id)
            os.makedirs(song_dir, exist_ok=True)
            for stem in ["vocals", "drums", "bass", "other"]:
                src_path = os.path.join(OUTPUT_DIR, "htdemucs", f"{base}_{stem}.mp3")
                dst_path = os.path.join(song_dir, f"{stem}.mp3")
                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)
                    sz = os.path.getsize(dst_path) / 1024
                    print(f"    copied {stem}.mp3 ({sz:.0f} KB)")
                else:
                    print(f"    ! missing: {src_path}")

    os.unlink(tmp.name)

print("\n=== Done ===")
print(f"Outputs under: {OUTPUT_DIR}\\htdemucs\\")
for root, dirs, fnames in os.walk(os.path.join(OUTPUT_DIR, "htdemucs")):
    for n in sorted(fnames):
        p = os.path.join(root, n)
        sz = os.path.getsize(p) / 1024
        print(f"  {n}  {sz:.0f} KB")
