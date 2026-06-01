#!/usr/bin/env python3
"""Transcribe Tabasco vocal stems with word-level timestamps for karaoke sync.

Whisper segment.start times are far more accurate with word_timestamps=True
(the decoder aligns via cross-attention). We decode the mp3 with librosa into a
numpy array and hand that straight to whisper.transcribe, which bypasses the
ffmpeg-on-PATH requirement entirely.

Output: captures/vocal-timed.json  (gitignored; feeds build-timed-lyrics.py)
Run from the repo root:  python scripts/transcribe-timed-vocals.py
"""
import json
import sys
from pathlib import Path

import librosa
import whisper

# Only the songs that actually have sung vocals. tabasco / electric-sheep are
# instrumental chants (ASR finds nothing usable) and get no timed karaoke.
SONGS = ["hey", "i-got-a-feeling", "under-the-moon", "sister", "human-fly"]
BASE = Path("presets/tabasco-stems")
OUT = Path("captures/vocal-timed.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

print("loading whisper small model (CPU)...", flush=True)
model = whisper.load_model("small")

out = {}
for song in SONGS:
    path = BASE / song / "vocals.mp3"
    if not path.exists():
        print(f"SKIP {song}: {path} missing", flush=True)
        continue
    print(f"transcribing {song} ...", flush=True)
    # 16 kHz mono is whisper's native rate; librosa handles the mp3 decode.
    y, _sr = librosa.load(str(path), sr=16000, mono=True)
    result = model.transcribe(
        y,
        language="en",
        word_timestamps=True,
        fp16=False,                       # CPU
        condition_on_previous_text=False,  # sparse vocals -> avoid loop hallucinations
        no_speech_threshold=0.6,
    )
    segs = []
    for seg in result["segments"]:
        text = (seg.get("text") or "").strip()
        words = [
            {"t": round(float(w["start"]), 2), "w": w["word"]}
            for w in seg.get("words", [])
            if w.get("start") is not None
        ]
        segs.append({
            "start": round(float(seg["start"]), 2),
            "end": round(float(seg["end"]), 2),
            "text": text,
            "words": words,
        })
    out[song] = {"segments": segs}
    # incremental save so partial progress is inspectable mid-run
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  done {song}: {len(segs)} segments", flush=True)

print(f"ALL DONE -> {OUT}", flush=True)
