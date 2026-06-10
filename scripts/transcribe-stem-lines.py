#!/usr/bin/env python3
"""Transcribe bass line + vocal melody from real stems into AI 再現 note data.

The AI 再現 song data (presets/drum-frames-tabasco-*.json) has structure /
chords / drum onsets but ZERO note-level musical content — the AI invents
melodies, so it never sounds like the actual song. This extracts the real
lines so the agents can PLAY the song instead of improvising over it.

Method:
  - librosa.pyin f0 tracking per stem (bass is monophonic; vocals mostly).
  - Effective BPM fitted from the drums stem (the catalog BPM is nominal;
    a fitted float grid keeps late bars from drifting off-step).
  - Notes segmented from voiced+stable-pitch runs, quantized to the
    16th grid the webapp scheduler already uses (bar + step 0..15).

Output (printed + embedded by --write):
  "bass_line":    {"granularity":16, "bpm_fit":117.xx, "events":[[bar,step,durSteps,midi,vel],...]}
  "vocal_melody": {...same...}

Usage:
  python scripts/transcribe-stem-lines.py human-fly          # analyze + report
  python scripts/transcribe-stem-lines.py human-fly --write  # embed into the song JSON
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np

SONG = sys.argv[1] if len(sys.argv) > 1 else "human-fly"
WRITE = "--write" in sys.argv
STEM_DIR = Path("presets/tabasco-stems") / SONG
SONG_JSON = Path(f"presets/drum-frames-tabasco-{SONG}.json")

SR = 22050
HOP = 256


def fit_bpm(nominal: float) -> float:
    """Fit effective BPM from the drums stem around the catalog value."""
    y, _ = librosa.load(str(STEM_DIR / "drums.mp3"), sr=SR, mono=True)
    onset_env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    tempo = librosa.feature.tempo(onset_envelope=onset_env, sr=SR, hop_length=HOP,
                                  start_bpm=nominal, std_bpm=0.5, max_tempo=240)[0]
    # tempo() can answer in a different octave (2x / 0.5x) — fold to nominal's
    for mult in (1.0, 2.0, 0.5):
        if abs(tempo * mult - nominal) < nominal * 0.06:
            return float(tempo * mult)
    return float(nominal)


def extract_line(stem: str, fmin_note: str, fmax_note: str, midi_lo: int, midi_hi: int,
                 bpm: float, total_steps: int, min_ms: float = 70.0):
    y, _ = librosa.load(str(STEM_DIR / f"{stem}.mp3"), sr=SR, mono=True)
    f0, voiced, _prob = librosa.pyin(
        y, sr=SR, hop_length=HOP,
        fmin=librosa.note_to_hz(fmin_note), fmax=librosa.note_to_hz(fmax_note),
        frame_length=2048,
    )
    rms = librosa.feature.rms(y=y, hop_length=HOP, frame_length=2048)[0]
    rms_peak = float(np.percentile(rms[rms > 0], 98)) if np.any(rms > 0) else 1.0
    times = librosa.times_like(f0, sr=SR, hop_length=HOP)
    midi = np.full(len(f0), -1, dtype=int)
    ok = voiced & np.isfinite(f0)
    midi[ok] = np.round(librosa.hz_to_midi(f0[ok])).astype(int)
    # gate out-of-register detections (bleed / octave errors)
    midi[(midi < midi_lo) | (midi > midi_hi)] = -1

    step_sec = 60.0 / bpm / 4.0
    min_frames = max(2, int(min_ms / 1000.0 / (HOP / SR)))

    # segment runs of identical midi
    events = []
    i = 0
    n = len(midi)
    while i < n:
        if midi[i] < 0:
            i += 1
            continue
        j = i
        while j < n and midi[j] == midi[i]:
            j += 1
        if j - i >= min_frames:
            start_t = times[i]
            dur_t = times[j - 1] - times[i] + HOP / SR
            seg_rms = float(np.max(rms[i:j])) if j > i else 0.0
            vel = float(np.clip(0.30 + 0.65 * (seg_rms / rms_peak), 0.30, 0.95))
            step_abs = int(round(start_t / step_sec))
            dur_steps = max(1, int(round(dur_t / step_sec)))
            if 0 <= step_abs < total_steps:
                events.append([step_abs // 16, step_abs % 16, dur_steps, int(midi[i]), round(vel, 2)])
        i = j

    # merge events landing on the same (bar,step): keep the stronger one
    dedup = {}
    for ev in events:
        key = (ev[0], ev[1])
        if key not in dedup or ev[4] > dedup[key][4]:
            dedup[key] = ev
    out = sorted(dedup.values(), key=lambda e: (e[0], e[1]))
    return out


def main() -> None:
    data = json.loads(SONG_JSON.read_text(encoding="utf-8"))
    nominal = float(data["bpm"])
    total_bars = int(data.get("total_bars") or 0) or 200
    total_steps = total_bars * 16

    bpm = fit_bpm(nominal)
    print(f"{SONG}: nominal bpm {nominal} -> fitted {bpm:.2f}", flush=True)

    bass = extract_line("bass", "C1", "C4", 24, 55, bpm, total_steps)
    print(f"bass_line: {len(bass)} notes", flush=True)
    voc = extract_line("vocals", "C2", "C6", 41, 84, bpm, total_steps, min_ms=90.0)
    print(f"vocal_melody: {len(voc)} notes", flush=True)

    for name, ev in (("bass", bass), ("vocal", voc)):
        if not ev:
            continue
        bars = sorted({e[0] for e in ev})
        midis = [e[3] for e in ev]
        print(f"  {name}: bars {bars[0]}..{bars[-1]} ({len(bars)} active), "
              f"midi {min(midis)}..{max(midis)}, median {int(np.median(midis))}")

    # chord-agreement sanity: % of bass notes whose pitch class is the root or
    # fifth of the section chord (should be well above chance ~17%)
    NOTE_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
               "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    prog = data.get("chord_progression") or {}
    structure = data.get("structure") or []
    bar_chord_pc = {}
    cursor = 0
    for sec in structure:
        bars_n = int(sec.get("bars") or 0)
        base = sec.get("section", "").split("-")[0]
        chords = prog.get(base) or prog.get(sec.get("section", "")) or []
        if chords:
            seq = []
            for name, beats in chords:
                seq += [name] * max(1, int(beats) // 2)
            for b in range(bars_n):
                root = seq[b % len(seq)][:2]
                pc = NOTE_PC.get(root if root in NOTE_PC else root[0])
                if pc is not None:
                    bar_chord_pc[cursor + b] = pc
        cursor += bars_n
    judged = [e for e in bass if e[0] in bar_chord_pc]
    if judged:
        hit = sum(1 for e in judged if (e[3] % 12) in ((bar_chord_pc[e[0]]) % 12, (bar_chord_pc[e[0]] + 7) % 12))
        print(f"  bass vs chord root/5th agreement: {100.0 * hit / len(judged):.0f}% ({len(judged)} judged)")

    # ---- derive the REAL chord progression from the transcribed bass ----
    # The catalog progression was an estimate (human-fly's said G-Em-C-D while
    # the real bass plays a G/F/D mixolydian vamp — the comping agents were on
    # the wrong changes). Per bar: duration-weighted top pitch class of the
    # bass; per FULL section name (verse-1 and verse-2 can differ); compress
    # runs into the app's [chord, bars] looping format. Roots are written as
    # plain major names — the guitar agent voices power chords (no 3rd) anyway.
    NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    key_root_pc = NOTE_PC.get((data.get("key") or "C").split(" ")[0].strip()[:2].rstrip("m"), None)
    if key_root_pc is None:
        key_root_pc = NOTE_PC.get((data.get("key") or "C")[0], 0)
    bar_pc_weight = {}
    for b, s, d, m, v in bass:
        bar_pc_weight.setdefault(b, {})
        bar_pc_weight[b][m % 12] = bar_pc_weight[b].get(m % 12, 0) + d * v
    bar_root = {b: max(w, key=w.get) for b, w in bar_pc_weight.items()}

    sec_instances = {}
    cursor = 0
    for sec in structure:
        bars_n = int(sec.get("bars") or 0)
        name = sec.get("section") or "section"
        sec_instances.setdefault(name, []).append((cursor, bars_n))
        cursor += bars_n

    derived = {}
    for name, instances in sec_instances.items():
        max_bars = max(n for _, n in instances)
        roots = []
        prev = None
        for pos in range(max_bars):
            votes = {}
            for start, n in instances:
                if pos < n and (start + pos) in bar_root:
                    pc = bar_root[start + pos]
                    votes[pc] = votes.get(pc, 0) + 1
            pc = max(votes, key=votes.get) if votes else prev
            if pc is None:
                pc = key_root_pc  # song-key fallback for silent leading bars
            roots.append(pc)
            prev = pc
        prog = []
        for pc in roots:
            cname = NAMES[pc]
            if prog and prog[-1][0] == cname:
                prog[-1][1] += 1
            else:
                prog.append([cname, 1])
        derived[name] = prog
        print(f"  derived chords [{name}]: {prog}")

    # quality gates: thin/garbage transcriptions are worse than the generative
    # fallback, so only embed lines with real coverage. Chords are replaced
    # only when the bass (their source) is trustworthy.
    MIN_BASS, MIN_VOCAL = 30, 60
    bass_ok = len(bass) >= MIN_BASS
    vocal_ok = len(voc) >= MIN_VOCAL
    print(f"embed: bass_line={'YES' if bass_ok else 'NO'} vocal_melody={'YES' if vocal_ok else 'NO'} chords={'YES' if bass_ok else 'NO'}")

    if WRITE:
        if bass_ok:
            data["bass_line"] = {"granularity": 16, "bpm_fit": round(bpm, 2),
                                 "source": "librosa.pyin on bass.mp3", "events": bass}
            data["chord_progression_legacy"] = data.get("chord_progression")
            data["chord_progression"] = derived
        if vocal_ok:
            data["vocal_melody"] = {"granularity": 16, "bpm_fit": round(bpm, 2),
                                    "source": "librosa.pyin on vocals.mp3", "events": voc}
        SONG_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"WROTE {SONG_JSON}")


if __name__ == "__main__":
    main()
