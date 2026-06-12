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
  "guitar_line":  {...same timing format; midi is the voiced root for guitar voicing}

Usage:
  python scripts/transcribe-stem-lines.py human-fly          # analyze + report
  python scripts/transcribe-stem-lines.py human-fly --write  # embed into the song JSON
  python scripts/transcribe-stem-lines.py human-fly --guitar-only --write
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np

SONG = sys.argv[1] if len(sys.argv) > 1 else "human-fly"
WRITE = "--write" in sys.argv
GUITAR_ONLY = "--guitar-only" in sys.argv
STEM_DIR = Path("presets/tabasco-stems") / SONG
SONG_JSON = Path(f"presets/drum-frames-tabasco-{SONG}.json")

SR = 22050
HOP = 256
NOTE_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
           "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


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
    rms_peak_db = 20.0 * np.log10(rms_peak + 1e-12)

    # segment runs of identical midi. v328 (生感 pass): keep the PERFORMANCE —
    #  - fractional step positions (no 16th quantize): the player's push/drag
    #    micro-timing survives, and stays tempo-relative in the app.
    #  - fractional durations: real note lengths -> staccato/legato breathing.
    #  - dB-relative velocity over a wide range (0.16-1.0): real 強弱 instead
    #    of the old compressed 0.30-0.95 linear-RMS band.
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
            # attack-window loudness (first ~46ms) in dB below the track peak
            atk = rms[i:min(j, i + 4)]
            seg_db = 20.0 * np.log10(float(np.max(atk)) + 1e-12)
            depth = np.clip((rms_peak_db - seg_db) / 24.0, 0.0, 1.0)  # 0=peak, 1=-24dB
            vel = float(np.clip(0.16 + 0.84 * (1.0 - depth), 0.16, 1.0))
            step_pos = start_t / step_sec          # fractional global step
            dur_steps = max(0.25, dur_t / step_sec)
            if 0 <= step_pos < total_steps:
                # min() guards the 2dp round: 15.996 would round to 16.0 and
                # leak into the next bar / break the step<16 invariant.
                events.append([int(step_pos // 16), min(15.99, round(step_pos % 16, 2)),
                               round(dur_steps, 2), int(midi[i]), round(vel, 2)])
        i = j

    # drop double-triggers: two notes within ~1/3 step keep only the stronger
    out = []
    for ev in sorted(events, key=lambda e: (e[0], e[1])):
        if out and ev[0] == out[-1][0] and (ev[1] - out[-1][1]) < 0.35:
            if ev[4] > out[-1][4]:
                out[-1] = ev
            continue
        out.append(ev)
    return out


def root_pc_from_name(name):
    if not name:
        return None
    root = str(name).strip()[:2]
    return NOTE_PC.get(root if root in NOTE_PC else root[:1])


def bar_roots_from_progression(progression, structure, fallback_pc):
    bar_roots = {}
    cursor = 0
    for sec in structure:
        bars_n = int(sec.get("bars") or 0)
        name = sec.get("section") or "section"
        base = name.split("-")[0]
        chords = (progression or {}).get(name) or (progression or {}).get(base) or []
        seq = []
        for chord in chords:
            if not isinstance(chord, (list, tuple)) or not chord:
                continue
            pc = root_pc_from_name(chord[0])
            if pc is None:
                continue
            bars = 1
            if len(chord) > 1:
                try:
                    bars = max(1, int(float(chord[1])))
                except (TypeError, ValueError):
                    bars = 1
            seq += [pc] * bars
        for b in range(bars_n):
            bar_roots[cursor + b] = seq[b % len(seq)] if seq else fallback_pc
        cursor += bars_n
    return bar_roots


def extract_guitar_line(bpm: float, total_steps: int, bar_root_pc):
    """Extract guitar strum timing/length/velocity from the polyphonic other stem."""
    path = STEM_DIR / "other.mp3"
    if not path.exists():
        return []
    y, _ = librosa.load(str(path), sr=SR, mono=True)
    if not np.any(y):
        return []

    n_fft = 2048
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=n_fft)
    body = (freqs >= 120) & (freqs <= 1800)
    pick = (freqs >= 1800) & (freqs <= 6500)
    body_energy = np.mean(S[body], axis=0) if np.any(body) else np.mean(S, axis=0)
    pick_energy = np.mean(S[pick], axis=0) if np.any(pick) else np.zeros_like(body_energy)
    band_energy = body_energy + pick_energy * 0.34
    band_peak = float(np.percentile(band_energy[band_energy > 0], 98)) if np.any(band_energy > 0) else 1.0
    band_peak_db = 20.0 * np.log10(band_peak + 1e-12)

    # v334: sharper detection. The median-aggregated envelope + wide pre/post
    # averaging + delta 0.09 found ~9.5 strums/bar on the verse but the chain
    # only kept ~5 — and dense loud sections raised the local average so chug
    # 8ths fell under delta. Mean envelope + tight averaging + lower delta
    # tracks the actual strum density (the 10/bar cap below still bounds it).
    onset_env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    onsets = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=SR, hop_length=HOP, units="frames",
        backtrack=False, pre_max=3, post_max=3, pre_avg=5, post_avg=5,
        delta=0.05, wait=1
    )
    if len(onsets) < 8:
        return []

    times = librosa.frames_to_time(np.arange(len(band_energy)), sr=SR, hop_length=HOP)
    step_sec = 60.0 / bpm / 4.0
    events = []
    for idx, raw_frame in enumerate(onsets):
        frame = int(np.clip(raw_frame, 0, len(band_energy) - 1))
        start_t = float(times[frame])
        step_pos = start_t / step_sec
        if not (0 <= step_pos < total_steps):
            continue

        next_frame = int(onsets[idx + 1]) if idx + 1 < len(onsets) else min(
            len(band_energy) - 1, frame + int(2.0 * step_sec / (HOP / SR))
        )
        next_frame = int(np.clip(next_frame, frame + 1, len(band_energy) - 1))
        # v334: chug durations. A distorted rhythm guitar gates on the NEXT
        # strum — the 0.34-decay walk on compressed sustain ran to a median of
        # 2.8 steps (73% >= 2 steps), i.e. drones that also exhausted PolySynth
        # voices. Duration = gap to the next strum (slightly shortened), hard
        # cap 2.0 steps.
        gap_steps = (float(times[next_frame]) - start_t) / step_sec
        dur_steps = float(np.clip(gap_steps * 0.92, 0.30, 2.0))

        attack = float(np.max(band_energy[frame:min(len(band_energy), frame + 4)]) or 0.0)
        seg_db = 20.0 * np.log10(attack + 1e-12)
        depth = np.clip((band_peak_db - seg_db) / 24.0, 0.0, 1.0)
        vel = float(np.clip(0.16 + 0.84 * (1.0 - depth), 0.16, 1.0))  # v328-consistent dynamics
        if vel < 0.20 and dur_steps < 0.5:
            continue

        bar = int(step_pos // 16)
        pc = bar_root_pc.get(bar, bar_root_pc.get(max(bar_root_pc.keys()) if bar_root_pc else 0, 0))
        root_midi = 48 + int(pc or 0)
        events.append([bar, min(15.99, round(step_pos % 16, 2)),
                       round(dur_steps, 2), root_midi, round(vel, 2)])

    by_bar = {}
    for ev in sorted(events, key=lambda e: (e[0], e[1])):
        bucket = by_bar.setdefault(ev[0], [])
        if bucket and (ev[1] - bucket[-1][1]) < 0.28:
            if ev[4] > bucket[-1][4]:
                bucket[-1] = ev
            continue
        bucket.append(ev)

    out = []
    for _bar, evs in sorted(by_bar.items()):
        if len(evs) > 12:  # v335: cap 10 -> 12 (8th chug + accents fit)
            keep = sorted(evs, key=lambda e: (e[4] * 1.4 + min(e[2], 4.0) * 0.08), reverse=True)[:12]
            evs = sorted(keep, key=lambda e: e[1])
        out.extend(evs)
    return out


def main() -> None:
    data = json.loads(SONG_JSON.read_text(encoding="utf-8"))
    nominal = float(data["bpm"])
    total_bars = int(data.get("total_bars") or 0) or 200
    total_steps = total_bars * 16

    if GUITAR_ONLY:
        fitted = (data.get("guitar_line") or data.get("bass_line") or data.get("vocal_melody") or {}).get("bpm_fit")
        bpm = float(fitted or fit_bpm(nominal))
        structure = data.get("structure") or []
        key_root_pc = root_pc_from_name((data.get("key") or "C").split(" ")[0]) or 0
        guitar_roots = bar_roots_from_progression(data.get("chord_progression") or {}, structure, key_root_pc)
        guitar = extract_guitar_line(bpm, total_steps, guitar_roots)
        guitar_med_vel = float(np.median([e[4] for e in guitar])) if guitar else 0.0
        guitar_ok = len(guitar) >= 40 and guitar_med_vel >= 0.26
        print(f"{SONG}: bpm {bpm:.2f}")
        print(f"guitar_line: {len(guitar)} strums, median vel {guitar_med_vel:.2f}")
        print(f"embed: guitar_line={'YES' if guitar_ok else 'NO'}")
        if WRITE:
            if guitar_ok:
                data["guitar_line"] = {"granularity": 16, "bpm_fit": round(bpm, 2),
                                       "source": "band-energy on other.mp3 + bass-derived chord roots", "events": guitar}
            else:
                data.pop("guitar_line", None)
            SONG_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"WROTE {SONG_JSON}")
        return

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

    guitar_roots = bar_roots_from_progression(derived, structure, key_root_pc)
    guitar = extract_guitar_line(bpm, total_steps, guitar_roots)
    print(f"guitar_line: {len(guitar)} strums", flush=True)
    if guitar:
        bars = sorted({e[0] for e in guitar})
        midis = [e[3] for e in guitar]
        print(f"  guitar: bars {bars[0]}..{bars[-1]} ({len(bars)} active), "
              f"root midi {min(midis)}..{max(midis)}, median vel {np.median([e[4] for e in guitar]):.2f}")

    # quality gates: thin/garbage transcriptions are worse than the generative
    # fallback, so only embed lines with real coverage. Chords are replaced
    # only when the bass (their source) is trustworthy.
    MIN_BASS, MIN_VOCAL, MIN_GUITAR = 30, 60, 40
    bass_ok = len(bass) >= MIN_BASS
    # v328: also require real loudness — a "melody" whose median velocity sits
    # at the floor is bleed/whisper noise (tabasco/electric-sheep chant stems),
    # and ghost notes through the voice synth are mud, not 生感.
    voc_med_vel = float(np.median([e[4] for e in voc])) if voc else 0.0
    vocal_ok = len(voc) >= MIN_VOCAL and voc_med_vel >= 0.30
    guitar_med_vel = float(np.median([e[4] for e in guitar])) if guitar else 0.0
    guitar_ok = len(guitar) >= MIN_GUITAR and guitar_med_vel >= 0.26
    print(f"embed: bass_line={'YES' if bass_ok else 'NO'} vocal_melody={'YES' if vocal_ok else 'NO'} guitar_line={'YES' if guitar_ok else 'NO'} chords={'YES' if bass_ok else 'NO'}")

    if WRITE:
        if bass_ok:
            data["bass_line"] = {"granularity": 16, "bpm_fit": round(bpm, 2),
                                 "source": "librosa.pyin on bass.mp3", "events": bass}
            # keep the ORIGINAL catalog estimate on re-runs — without the
            # guard a second --write would overwrite legacy with the previous
            # derived progression and the rollback path would be gone.
            if "chord_progression_legacy" not in data:
                data["chord_progression_legacy"] = data.get("chord_progression")
            data["chord_progression"] = derived
        if vocal_ok:
            data["vocal_melody"] = {"granularity": 16, "bpm_fit": round(bpm, 2),
                                    "source": "librosa.pyin on vocals.mp3", "events": voc}
        else:
            data.pop("vocal_melody", None)
        if guitar_ok:
            data["guitar_line"] = {"granularity": 16, "bpm_fit": round(bpm, 2),
                                   "source": "band-energy on other.mp3 + bass-derived chord roots", "events": guitar}
        else:
            data.pop("guitar_line", None)
        if not bass_ok:
            data.pop("bass_line", None)
        SONG_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"WROTE {SONG_JSON}")


if __name__ == "__main__":
    main()
