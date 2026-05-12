"""Copy Demucs outputs from stems_out/htdemucs/ to Music/presets/tabasco-stems/{song-id}/{stem}.mp3"""
import os, shutil

SRC = r"C:\Users\平成造園\Desktop\stems_out\htdemucs"
DST = r"C:\workspace\github-inventory\music-stack\Music\presets\tabasco-stems"

NAME_TO_ID = {
    "01 TABASCO": "tabasco",
    "02 Hey": "hey",
    "03 I got a feeling": "i-got-a-feeling",
    "04 Under the Moon": "under-the-moon",
    "05 Electric Sheep": "electric-sheep",
    "06 Human Fly": "human-fly",
    "07 Sister": "sister",
}

os.makedirs(DST, exist_ok=True)
total_copied = 0
for base, song_id in NAME_TO_ID.items():
    song_dir = os.path.join(DST, song_id)
    os.makedirs(song_dir, exist_ok=True)
    for stem in ["vocals", "drums", "bass", "other"]:
        src = os.path.join(SRC, f"{base}_{stem}.mp3")
        dst = os.path.join(song_dir, f"{stem}.mp3")
        if os.path.exists(src):
            shutil.copy2(src, dst)
            sz = os.path.getsize(dst) / 1024
            print(f"OK  {song_id}/{stem}.mp3  {sz:.0f} KB")
            total_copied += 1
        else:
            print(f"--  {song_id}/{stem}.mp3  (not yet ready)")
print(f"\nCopied {total_copied}/28 stems")
