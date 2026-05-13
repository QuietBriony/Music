"""
Tabasco vocal stem → OpenAI Whisper API で transcribe → /tmp/transcribe/*.txt

ローカル不要、API キー 1 個あれば動く。$0.006/曲、7 曲で $0.05 程度。
OpenAI のサインアップ時に $5 trial credit あり、新規アカウントなら無料カバー。

usage:
    set OPENAI_API_KEY=sk-...
    python scripts/_transcribe_vocals_openai.py

requirements:
    pip install requests
"""
import os
import sys
import json
import requests

MUSIC_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(MUSIC_DIR, "tmp_transcribe")
os.makedirs(OUT_DIR, exist_ok=True)

SONGS = [
    "human-fly",
    "hey",
    "i-got-a-feeling",
    "under-the-moon",
    "electric-sheep",
    "sister",
    "tabasco",
]

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    print("ERROR: set OPENAI_API_KEY env var first")
    print("  (get one from https://platform.openai.com/api-keys, new accounts get $5 trial credit)")
    sys.exit(1)

PROMPT = "lyrics from an English rock song, mixture punk / LCD Soundsystem / alt-rock"

for song in SONGS:
    mp3_path = os.path.join(MUSIC_DIR, "presets", "tabasco-stems", song, "vocals.mp3")
    if not os.path.exists(mp3_path):
        print(f"! skip {song}: {mp3_path} not found")
        continue
    out_path = os.path.join(OUT_DIR, f"{song}.txt")
    if os.path.exists(out_path):
        print(f"= skip {song}: already transcribed → {out_path}")
        continue

    print(f"-> {song}: uploading {os.path.getsize(mp3_path)//1024} KB to OpenAI…")
    with open(mp3_path, "rb") as f:
        resp = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            files={"file": (os.path.basename(mp3_path), f, "audio/mpeg")},
            data={
                "model": "whisper-1",
                "response_format": "text",
                "language": "en",
                "prompt": PROMPT,
                "temperature": "0",
            },
            timeout=120,
        )
    if resp.status_code != 200:
        print(f"  ! API error {resp.status_code}: {resp.text[:200]}")
        continue
    text = resp.text.strip()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  ✓ saved → {out_path} ({len(text)} chars)")
    print(f"    preview: {text[:120]}…")
    print()

print("\n=== done ===")
print(f"results in: {OUT_DIR}")
print("\n次のステップ:")
print("  1. tmp_transcribe/*.txt を確認、各曲の transcript を読む")
print("  2. 雰囲気合ってる箇所を docs/tabasco-lyrics-v4-syllabic.md の chorus に流し込む")
print("  3. 耳で違和感ある所を修正")
print("  4. git add docs/tabasco-lyrics-v4-syllabic.md && git commit && git push")
print("  5. 3 分で band-room の追っかけ歌詞も更新される")
