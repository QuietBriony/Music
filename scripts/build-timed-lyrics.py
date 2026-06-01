#!/usr/bin/env python3
"""Build docs/tabasco-lyrics-timed.json from word-timestamp ASR.

Input : captures/vocal-timed.json  (from transcribe-timed-vocals.py)
Output: docs/tabasco-lyrics-timed.json  (committed; the app's karaoke source)

Philosophy (per the user): show what's ACTUALLY sung, lightly cleaned — the
middle ground between raw ASR noise and codex's over-invented lyrics. We do not
rewrite or rhyme; we just drop ASR garbage (empty/zero-width segments, lone
filler tokens, hallucination loops) and tidy whitespace/encoding.

Each kept line is {"t": <segment start sec>, "x": <text>} so the webapp can
light it up at its playback second.
"""
import json
import re
from pathlib import Path

SRC = Path("captures/vocal-timed.json")
OUT = Path("docs/tabasco-lyrics-timed.json")

FILLER = {"i", "a", "it", "it's", "the", "oh", "yeah", "uh", "um", "you",
          "hmm", "mm", "mmm", "ah", "ooh", "la", "na", "huh", "so"}


def clean_text(t: str) -> str:
    t = (t or "").strip()
    t = t.replace("�", "'")          # mangled apostrophe
    t = t.replace("…", "...")        # ellipsis
    t = re.sub(r"\s+", " ", t)
    t = t.strip(' "“”')          # stray wrapping quotes
    return t


def is_junk(text: str) -> bool:
    if not text:
        return True
    letters = re.sub(r"[^A-Za-z]", "", text)
    if len(letters) < 2:
        return True
    if text.lower().strip(".,!?'") in FILLER:
        return True
    return False


def main() -> None:
    src = json.loads(SRC.read_text(encoding="utf-8"))
    out = {
        "version": 1,
        "generated_from": "Whisper small word-timestamp ASR of vocal stems (lightly cleaned)",
        "songs": {},
    }
    for song, v in src.items():
        lines = []
        last_norm = None
        run = 0
        for seg in v.get("segments", []):
            start = float(seg.get("start", 0.0))
            end = float(seg.get("end", start))
            if end - start < 0.30:          # zero/near-zero artifact
                continue
            text = clean_text(seg.get("text", ""))
            if is_junk(text):
                continue
            norm = text.lower()
            if norm == last_norm:
                run += 1
            else:
                run = 1
                last_norm = norm
            if run > 3:                      # kill hallucination loops, keep musical repeats
                continue
            lines.append({"t": round(start, 2), "x": text})
        # de-dupe an identical line that lands within 0.4s (split-segment dupes)
        deduped = []
        for ln in lines:
            if deduped and deduped[-1]["x"].lower() == ln["x"].lower() and ln["t"] - deduped[-1]["t"] < 0.4:
                continue
            deduped.append(ln)
        if len(deduped) >= 5:
            out["songs"][song] = deduped
            print(f"{song}: {len(deduped)} timed lines  (t {deduped[0]['t']}..{deduped[-1]['t']})")
        else:
            print(f"{song}: only {len(deduped)} lines -> skipped (falls back to section blocks)")

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"-> {OUT}  ({len(out['songs'])} songs)")


if __name__ == "__main__":
    main()
