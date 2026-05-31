"""Extract real drum patterns from stem mp3 and rewrite drum-frames JSON events.

For each song's structure section, take a representative bar from the drum
stem, detect onsets, classify (kick/snare/hat), quantize to 16th notes,
and replace the section's frame events with the detected pattern.

Result: AI 再現 mode plays drum patterns that match the real song instead
of a generic 4-on-floor template.

Usage:
  python scripts/_extract_drum_patterns.py <band-id> <song-id>
  python scripts/_extract_drum_patterns.py tabasco --all
  python scripts/_extract_drum_patterns.py tabasco human-fly --out C:/workspace/music-stack-worker/reports/drum-frame-candidates
"""
import sys

if len(sys.argv) < 2 or any(arg in ("-h", "--help") for arg in sys.argv[1:]):
    print(__doc__.strip())
    print("\nusage: python scripts/_extract_drum_patterns.py <band-id> <song-id|--all> [--out <json-or-dir>]")
    sys.exit(0 if len(sys.argv) >= 2 else 1)

import os, json, subprocess, tempfile
import imageio_ffmpeg
import numpy as np
import librosa

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MUSIC_REPO = r"C:\workspace\music-stack\Music"
NAME_MAP = {"tabasco": "tabasco", "unripe": "unripe"}

def load_stem(mp3, sr=44100):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False); tmp.close()
    subprocess.run([FFMPEG, "-y", "-i", mp3, "-ac", "1", "-ar", str(sr), "-vn", tmp.name], capture_output=True, check=True)
    y, sr_out = librosa.load(tmp.name, sr=sr, mono=True)
    os.unlink(tmp.name)
    return y, sr_out

def classify_hit(clip, sr):
    if len(clip) < 100: return ("unknown", 0.0)
    rms = float(np.sqrt(np.mean(clip ** 2)))
    if rms < 0.005: return ("silence", 0.0)
    head = clip[:int(0.08 * sr)]
    n_fft = 4096
    padded = np.pad(head, (0, max(0, n_fft - len(head))))
    fft = np.abs(np.fft.rfft(padded[:n_fft]))
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    total = float(fft.sum()) + 1e-9
    sub_e = float(fft[freqs < 120].sum()) / total
    low_e = float(fft[(freqs >= 120) & (freqs < 350)].sum()) / total
    mid_e = float(fft[(freqs >= 350) & (freqs < 2000)].sum()) / total
    snap_e = float(fft[(freqs >= 2000) & (freqs < 5000)].sum()) / total
    high_e = float(fft[freqs >= 5000].sum()) / total
    if len(clip) > int(0.15 * sr):
        head_e = float(np.sqrt(np.mean(clip[:int(0.05 * sr)] ** 2)))
        tail_e = float(np.sqrt(np.mean(clip[int(0.15 * sr):int(0.25 * sr)] ** 2)))
        decay = tail_e / (head_e + 1e-6)
    else:
        decay = 0.0
    if (sub_e + low_e) > 0.50 and sub_e > 0.18: return ("kick", rms)
    if (high_e + snap_e) > 0.50 and decay > 0.35: return ("crash", rms)
    if high_e > 0.35 and decay < 0.25: return ("hat", rms)
    if (mid_e + snap_e) > 0.55 and mid_e > 0.15: return ("snare", rms)
    if (low_e + mid_e) > 0.55 and snap_e < 0.20: return ("tom", rms)
    return ("ghost", rms)  # weak / unclassified → ghost

def extract_bar_pattern(stem, sr, bar_start_s, bar_dur_s):
    """Detect drum events within a single bar and quantize to 16th grid."""
    start_i = int(bar_start_s * sr)
    end_i = int((bar_start_s + bar_dur_s) * sr)
    clip = stem[start_i:end_i]
    if len(clip) < 100:
        return []

    onset_times_in_clip = librosa.onset.onset_detect(
        y=clip, sr=sr, units="time", hop_length=256, backtrack=True
    )
    if len(onset_times_in_clip) == 0:
        return []

    sixteenth_dur = bar_dur_s / 16
    events = []
    for t in onset_times_in_clip:
        if t < 0 or t > bar_dur_s + 0.05:
            continue
        # Classify
        i = int(t * sr)
        hit_clip = clip[i:i + int(0.25 * sr)]
        cls, rms = classify_hit(hit_clip, sr)
        if cls in ("silence", "unknown"):
            continue

        # Quantize to nearest 16th
        sixteenth_idx = int(round(t / sixteenth_dur))
        sixteenth_idx = max(0, min(15, sixteenth_idx))
        beat = sixteenth_idx // 4
        sub = sixteenth_idx % 4
        # microMs offset from grid
        grid_t = sixteenth_idx * sixteenth_dur
        microMs = int(round((t - grid_t) * 1000))
        microMs = max(-30, min(30, microMs))
        # Velocity from RMS (0.4..0.95 range)
        velocity = round(min(0.95, max(0.35, rms * 5)), 2)

        # Map our classes to drum-frames instrument vocabulary
        inst_map = {
            "kick": "kick", "snare": "snare", "hat": "hat",
            "crash": "crash", "ghost": "ghost", "tom": "fill"
        }
        events.append({
            "instrument": inst_map[cls],
            "beat": int(beat),
            "sub": int(sub),
            "velocity": velocity,
            "microMs": microMs,
            "role": f"extracted_{cls}"
        })

    # Deduplicate (multiple onsets quantized to same slot → keep loudest)
    seen = {}
    for e in events:
        key = (e["instrument"], e["beat"], e["sub"])
        if key not in seen or e["velocity"] > seen[key]["velocity"]:
            seen[key] = e
    deduped = list(seen.values())
    deduped.sort(key=lambda e: (e["beat"], e["sub"], 0 if e["instrument"]=="kick" else 1))
    return deduped

def find_representative_bar(stem, sr, section_start_bar, section_bar_count, bar_dur_s):
    """Pick a bar with median RMS — avoids fade-in/out edges."""
    # Compute RMS of each bar in section
    bar_rms = []
    for b in range(section_bar_count):
        bs = (section_start_bar + b) * bar_dur_s
        be = bs + bar_dur_s
        si = int(bs * sr)
        ei = int(be * sr)
        clip = stem[si:ei]
        if len(clip) < 100: continue
        bar_rms.append((b, float(np.sqrt(np.mean(clip ** 2)))))
    if not bar_rms:
        return section_start_bar
    bar_rms.sort(key=lambda x: x[1])
    # Pick the median (skip first/last) — most representative
    if len(bar_rms) >= 3:
        median = bar_rms[len(bar_rms) // 2]
        return section_start_bar + median[0]
    return section_start_bar + bar_rms[-1][0]  # loudest

def resolve_output_path(out_arg, band_id, song_id):
    if not out_arg:
        return None
    out_path = os.path.abspath(out_arg)
    if out_path.lower().endswith(".json"):
        return out_path
    return os.path.join(out_path, f"drum-frames-{band_id}-{song_id}.candidate.json")


def process_song(band_id, song_id, out_arg=None):
    drum_mp3 = os.path.join(MUSIC_REPO, "presets", f"{band_id}-stems", song_id, "drums.mp3")
    json_path = os.path.join(MUSIC_REPO, "presets", f"drum-frames-{band_id}-{song_id}.json")
    if not os.path.exists(drum_mp3):
        print(f"! drum stem not found: {drum_mp3}")
        return
    if not os.path.exists(json_path):
        print(f"! frames json not found: {json_path}")
        return

    print(f"\n=== {band_id}/{song_id} ===")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    bpm = float(data.get("bpm", 120))
    bar_dur_s = 60.0 / bpm * 4
    print(f"  bpm={bpm}  bar={bar_dur_s:.3f}s")

    stem, sr = load_stem(drum_mp3)
    print(f"  stem: {len(stem)/sr:.1f}s @ {sr}Hz")

    # Walk through structure[], compute section start bars
    structure = data.get("structure", [])
    cursor_bar = 0
    frame_events_by_id = {}
    for sec in structure:
        bars = sec["bars"]
        frame_id = sec["frame_id"]
        rep_bar = find_representative_bar(stem, sr, cursor_bar, bars, bar_dur_s)
        rep_start_s = rep_bar * bar_dur_s
        events = extract_bar_pattern(stem, sr, rep_start_s, bar_dur_s)
        print(f"  [{sec['section']:<14}] bars {cursor_bar}..{cursor_bar+bars-1}  rep={rep_bar}  events={len(events)}")
        if events:
            # If frame_id already seen, merge by intersection / keep more events
            if frame_id not in frame_events_by_id or len(events) > len(frame_events_by_id[frame_id]):
                frame_events_by_id[frame_id] = events
        cursor_bar += bars

    # Patch frames[].events
    updated = 0
    for frame in data["frames"]:
        fid = frame["id"]
        if fid in frame_events_by_id:
            frame["events"] = frame_events_by_id[fid]
            updated += 1
            print(f"    -> updated frame '{fid}' with {len(frame['events'])} extracted events")

    signature = data.get("session_signature")
    if isinstance(signature, str) and "drum events extracted" not in signature:
        data["session_signature"] = signature + " - drum events extracted from real stem"
    data["events_extracted_from"] = f"presets/{band_id}-stems/{song_id}/drums.mp3"
    data["events_extraction_method"] = "librosa.onset_detect + band-energy classify + 16th-quantize"
    data["events_extraction_updated_frames"] = updated

    save_path = resolve_output_path(out_arg, band_id, song_id) or json_path
    if out_arg:
        data["candidate_source_json"] = os.path.relpath(json_path, MUSIC_REPO).replace("\\", "/")
        data["candidate_policy"] = "review-only; do not replace runtime drum frames without human listening review"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  saved: {save_path} ({updated} frames updated)")

if __name__ == "__main__":
    os.chdir(MUSIC_REPO)
    if len(sys.argv) < 2:
        print("usage: python scripts/_extract_drum_patterns.py <band-id> <song-id|--all> [--out <json-or-dir>]")
        sys.exit(1)
    band = sys.argv[1]
    target = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else "--all"
    out_arg = None
    if "--out" in sys.argv:
        out_idx = sys.argv.index("--out")
        if out_idx + 1 >= len(sys.argv):
            print("! --out requires a json file or output directory")
            sys.exit(1)
        out_arg = sys.argv[out_idx + 1]
    elif "--candidate-root" in sys.argv:
        out_idx = sys.argv.index("--candidate-root")
        if out_idx + 1 >= len(sys.argv):
            print("! --candidate-root requires an output directory")
            sys.exit(1)
        out_arg = sys.argv[out_idx + 1]

    if target == "--all":
        stems_root = os.path.join(MUSIC_REPO, "presets", f"{band}-stems")
        songs = sorted([d for d in os.listdir(stems_root) if os.path.isdir(os.path.join(stems_root, d))])
        for s in songs:
            process_song(band, s, out_arg)
    else:
        process_song(band, target, out_arg)
