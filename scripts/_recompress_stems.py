"""Re-encode all stem mp3 files from 192 kbps to 96 kbps in-place to halve repo size.
ffmpeg via imageio-ffmpeg. Idempotent: skips already-96kbps files.

Usage: python scripts/_recompress_stems.py [target_kbps]
"""
import os, sys, subprocess, tempfile, shutil
import imageio_ffmpeg
from mutagen.mp3 import MP3

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TARGET_KBPS = int(sys.argv[1]) if len(sys.argv) > 1 else 96

STEM_DIRS = [
    "presets/tabasco-stems",
    "presets/unripe-stems",
]

total_files = 0
total_saved_kb = 0
for stem_dir in STEM_DIRS:
    if not os.path.isdir(stem_dir):
        print(f"skip: {stem_dir} not found")
        continue
    for root, dirs, files in os.walk(stem_dir):
        for f in files:
            if not f.endswith(".mp3"):
                continue
            path = os.path.join(root, f)
            try:
                info = MP3(path).info
                current_kbps = info.bitrate // 1000
            except Exception:
                current_kbps = None
            if current_kbps and abs(current_kbps - TARGET_KBPS) < 5:
                print(f"skip (already {current_kbps}kbps): {path}")
                continue

            old_size = os.path.getsize(path) / 1024
            tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
            tmp.close()
            cmd = [
                FFMPEG, "-y", "-i", path,
                "-codec:a", "libmp3lame",
                "-b:a", f"{TARGET_KBPS}k",
                "-ac", "2",
                tmp.name
            ]
            r = subprocess.run(cmd, capture_output=True)
            if r.returncode != 0:
                print(f"  ! failed: {path}")
                os.unlink(tmp.name)
                continue
            shutil.move(tmp.name, path)
            new_size = os.path.getsize(path) / 1024
            saved = old_size - new_size
            total_saved_kb += saved
            total_files += 1
            print(f"OK  {path}  {old_size:.0f}KB -> {new_size:.0f}KB  (saved {saved:.0f}KB)")

print(f"\nDone: re-encoded {total_files} files, saved {total_saved_kb/1024:.1f} MB total")
