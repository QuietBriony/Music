#!/usr/bin/env python3
"""
Offline renderer for Band Room's source-derived AI recreation path.

This does not try to recover hidden instrumental audio from a vocal stem.
It renders independent drums/bass/other stems from the existing Band Room
song-track JSON, extracted drum sample kit, and chord progression.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import imageio_ffmpeg
import librosa
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt


ROOT = Path(__file__).resolve().parent.parent
SR = 44100
SUBS_PER_BAR = 16
NOTE_OFFSETS = {
    "C": 0,
    "C#": 1,
    "DB": 1,
    "D": 2,
    "D#": 3,
    "EB": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "GB": 6,
    "G": 7,
    "G#": 8,
    "AB": 8,
    "A": 9,
    "A#": 10,
    "BB": 10,
    "B": 11,
}


@dataclass
class RenderContext:
    band_id: str
    song_id: str
    song: dict[str, Any]
    track: dict[str, Any]
    target_len: int
    out_dir: Path
    kit_dir: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render Band Room AI recreation stems.")
    parser.add_argument("band_id", nargs="?", help="Band id from presets/bands.json, e.g. tabasco")
    parser.add_argument("song_id", nargs="?", help="Song id from presets/bands.json, e.g. human-fly")
    parser.add_argument("--band", dest="band_opt", help="Legacy named band id")
    parser.add_argument("--song", dest="song_opt", help="Legacy named song id")
    parser.add_argument("--output-root", default=ROOT / "presets" / "ai-recreation-stems", type=Path)
    parser.add_argument("--profile", default="cramps-punk")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    args.band = args.band_id or args.band_opt
    args.song = args.song_id or args.song_opt
    if not args.band or not args.song:
        parser.error("band_id and song_id are required")
    if not args.output_root.is_absolute():
        args.output_root = ROOT / args.output_root
    return args


def ffmpeg() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(str(part) for part in cmd), flush=True)
    return subprocess.run(
        [str(part) for part in cmd],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def ensure_stereo(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 1:
        audio = audio[:, None]
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    if audio.shape[1] > 2:
        audio = audio[:, :2]
    return np.asarray(audio, dtype=np.float32)


def load_audio(path: Path, *, channels: int = 2) -> tuple[np.ndarray, int]:
    if path.suffix.lower() == ".wav":
        audio, file_sr = sf.read(str(path), always_2d=True, dtype="float32")
        audio = ensure_stereo(audio)
        if file_sr == SR:
            return audio[:, :channels], file_sr

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir) / "decoded.wav"
        result = run([
            ffmpeg(),
            "-y",
            "-i",
            path,
            "-ac",
            str(channels),
            "-ar",
            str(SR),
            "-vn",
            tmp,
        ])
        if result.returncode != 0:
            raise RuntimeError(f"decode failed for {path}: {result.stderr[-1000:]}")
        audio, file_sr = sf.read(str(tmp), always_2d=True, dtype="float32")
        return ensure_stereo(audio)[:, :channels], file_sr


def write_mp3(audio: np.ndarray, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audio = np.nan_to_num(ensure_stereo(audio), nan=0.0, posinf=0.0, neginf=0.0)
    with tempfile.TemporaryDirectory() as tmp_dir:
        wav_path = Path(tmp_dir) / "render.wav"
        sf.write(str(wav_path), audio, SR, subtype="PCM_16")
        result = run([
            ffmpeg(),
            "-y",
            "-i",
            wav_path,
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "192k",
            "-ac",
            "2",
            out_path,
        ])
        if result.returncode != 0:
            raise RuntimeError(f"mp3 encode failed for {out_path}: {result.stderr[-1000:]}")


def write_wav(audio: np.ndarray, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audio = np.nan_to_num(ensure_stereo(audio), nan=0.0, posinf=0.0, neginf=0.0)
    sf.write(str(out_path), np.clip(audio, -0.98, 0.98), SR, subtype="PCM_16")


def fit_length(audio: np.ndarray, target_len: int) -> np.ndarray:
    audio = ensure_stereo(audio)
    if len(audio) == target_len:
        return audio
    if len(audio) > target_len:
        return audio[:target_len]
    pad = np.zeros((target_len - len(audio), audio.shape[1]), dtype=np.float32)
    return np.vstack([audio, pad])


def peak(audio: np.ndarray) -> float:
    return float(np.max(np.abs(audio))) if len(audio) else 0.0


def rms(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(audio)))) if len(audio) else 0.0


def db(value: float) -> float:
    return 20.0 * math.log10(max(float(value), 1e-12))


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def frame_metrics(frame: dict[str, Any] | None) -> dict[str, float]:
    events = list(frame.get("events", [])) if frame else []
    count = len(events)
    velocities = [
        float(event.get("velocity"))
        for event in events
        if event.get("velocity") is not None
    ]
    avg_velocity = sum(velocities) / len(velocities) if velocities else 0.52
    density = clamp(count / 36.0, 0.12, 0.92)
    pressure = clamp(
        avg_velocity * 0.72
        + density * 0.22
        + (0.06 if any(event.get("instrument") == "crash" for event in events) else 0.0),
        0.12,
        0.94,
    )
    ghost = clamp(
        sum(1 for event in events if event.get("instrument") == "ghost") / max(count, 1),
        0.0,
        0.9,
    )
    return {"density": density, "pressure": pressure, "ghost": ghost}


def sos_filter(
    audio: np.ndarray,
    kind: str,
    cutoff: float | tuple[float, float],
    *,
    order: int = 4,
) -> np.ndarray:
    audio = ensure_stereo(audio)
    nyquist = SR * 0.5
    if kind == "bandpass":
        lo, hi = cutoff  # type: ignore[misc]
        wn: float | list[float] = [max(lo / nyquist, 0.0001), min(hi / nyquist, 0.999)]
        btype = "bandpass"
    elif kind == "lowpass":
        wn = min(float(cutoff) / nyquist, 0.999)
        btype = "lowpass"
    elif kind == "highpass":
        wn = max(float(cutoff) / nyquist, 0.0001)
        btype = "highpass"
    else:
        raise ValueError(f"unsupported filter kind: {kind}")
    sos = butter(order, wn, btype=btype, output="sos")
    return np.asarray(sosfiltfilt(sos, audio, axis=0), dtype=np.float32)


def normalize_stems(
    stems: dict[str, np.ndarray],
    *,
    limit: float = 0.92,
    target_karaoke_rms: float = 0.093,
) -> dict[str, np.ndarray]:
    summed = stems["drums"] + stems["bass"] + stems["other"]
    max_peak = max([peak(summed), *(peak(audio) for audio in stems.values())])
    rms_scale = target_karaoke_rms / max(rms(summed), 1e-12)
    peak_scale = limit / max(max_peak, 1e-12)
    scale = min(rms_scale, peak_scale)
    if 0.98 <= scale <= 1.02:
        return stems
    return {name: audio * scale for name, audio in stems.items()}


def frequency_tilt(audio: np.ndarray) -> np.ndarray:
    """Approximate Band Room v301 instrumentBus EQ for deterministic offline render.

    Mirrors makeInstrumentPolishBus's EQ3 in band-room.js:
      low: -0.6 dB below 160 Hz
      mid: -0.4 dB from 160 Hz to 4200 Hz
      high: +1.5 dB above 4200 Hz
    Keeping this in sync with band-room.js is what makes the offline
    renderer measurement-faithful. Bump together when the EQ corner moves.
    """
    audio = ensure_stereo(audio)
    spectrum = np.fft.rfft(audio, axis=0)
    freqs = np.fft.rfftfreq(len(audio), 1.0 / SR)
    gain_db = np.zeros_like(freqs, dtype=np.float32)
    gain_db[freqs < 160.0] += -0.6
    gain_db[(freqs >= 160.0) & (freqs < 4200.0)] += -0.4
    high = freqs >= 4200.0
    gain_db[high] += 1.5
    transition = (freqs >= 3600.0) & (freqs < 4200.0)
    gain_db[transition] += 1.5 * ((freqs[transition] - 3600.0) / 600.0)
    gain = np.power(10.0, gain_db / 20.0)[:, None]
    return np.asarray(np.fft.irfft(spectrum * gain, n=len(audio), axis=0), dtype=np.float32)


def soft_glue_compress(
    audio: np.ndarray,
    *,
    threshold_db: float = -18.0,
    ratio: float = 2.05,
    attack_s: float = 0.014,
    release_s: float = 0.18,
) -> np.ndarray:
    """Frame-envelope compressor matching the v301 AI-bus glue direction."""
    audio = ensure_stereo(audio)
    if len(audio) == 0:
        return audio
    mono = np.sqrt(np.mean(np.square(audio), axis=1))
    hop = 512
    frame = 2048
    frame_times: list[float] = []
    levels: list[float] = []
    for start in range(0, len(mono), hop):
        segment = mono[start : min(len(mono), start + frame)]
        levels.append(float(np.sqrt(np.mean(np.square(segment)))) if len(segment) else 0.0)
        frame_times.append(min(len(mono) - 1, start + frame * 0.5))
    if not levels:
        return audio

    frame_rate = SR / hop
    attack_coeff = math.exp(-1.0 / max(1.0, attack_s * frame_rate))
    release_coeff = math.exp(-1.0 / max(1.0, release_s * frame_rate))
    env = 0.0
    smoothed: list[float] = []
    for level in levels:
        coeff = attack_coeff if level > env else release_coeff
        env = coeff * env + (1.0 - coeff) * level
        smoothed.append(env)

    env_db = 20.0 * np.log10(np.maximum(np.asarray(smoothed, dtype=np.float32), 1e-9))
    over_db = np.maximum(env_db - threshold_db, 0.0)
    gain_db = -over_db * (1.0 - (1.0 / ratio))
    frame_gain = np.power(10.0, gain_db / 20.0)
    sample_gain = np.interp(
        np.arange(len(audio), dtype=np.float32),
        np.asarray(frame_times, dtype=np.float32),
        frame_gain,
        left=float(frame_gain[0]),
        right=float(frame_gain[-1]),
    )
    return np.asarray(audio * sample_gain[:, None], dtype=np.float32)


def upward_body_glue(
    audio: np.ndarray,
    *,
    floor_ratio: float = 0.70,
    max_gain_db: float = 9.0,
) -> np.ndarray:
    """Lift low-level body/tails so the offline mix behaves like a glued take."""
    audio = ensure_stereo(audio)
    if len(audio) == 0:
        return audio
    mono = np.sqrt(np.mean(np.square(audio), axis=1))
    hop = 512
    frame = 2048
    frame_times: list[float] = []
    levels: list[float] = []
    for start in range(0, len(mono), hop):
        segment = mono[start : min(len(mono), start + frame)]
        levels.append(float(np.sqrt(np.mean(np.square(segment)))) if len(segment) else 0.0)
        frame_times.append(min(len(mono) - 1, start + frame * 0.5))
    frame_levels = np.asarray(levels, dtype=np.float32)
    active = frame_levels[frame_levels > 1e-5]
    if len(active) == 0:
        return audio
    floor = float(np.percentile(active, 55)) * floor_ratio
    gains = np.ones_like(frame_levels)
    mask = (frame_levels > 1e-6) & (frame_levels < floor)
    gains[mask] = floor / frame_levels[mask]
    gains = np.minimum(gains, 10.0 ** (max_gain_db / 20.0))
    sample_gain = np.interp(
        np.arange(len(audio), dtype=np.float32),
        np.asarray(frame_times, dtype=np.float32),
        gains,
        left=float(gains[0]),
        right=float(gains[-1]),
    )
    return np.asarray(audio * sample_gain[:, None], dtype=np.float32)


def normalize_audio(audio: np.ndarray, *, target_rms: float = 0.093, limit: float = 0.92) -> np.ndarray:
    audio = ensure_stereo(audio)
    current_rms = max(rms(audio), 1e-12)
    current_peak = max(peak(audio), 1e-12)
    scale = min(target_rms / current_rms, limit / current_peak)
    return np.asarray(audio * scale, dtype=np.float32)


def stereo_widen(audio: np.ndarray, amount: float = 0.58) -> np.ndarray:
    audio = ensure_stereo(audio)
    mid = (audio[:, 0] + audio[:, 1]) * 0.5
    side = (audio[:, 0] - audio[:, 1]) * 0.5 * (1.0 + amount)
    return np.column_stack([mid + side, mid - side]).astype(np.float32)


def instrument_polish(audio: np.ndarray) -> np.ndarray:
    """Bake the synth-only instrumentBus color into generated offline stems."""
    tilted = frequency_tilt(audio)
    glued = soft_glue_compress(tilted)
    saturated = np.tanh(glued * 1.20)
    blended = glued * 0.94 + saturated * 0.14
    widened = stereo_widen(blended, 0.58)
    return np.asarray(widened * 3.0, dtype=np.float32)


def equal_power_pan(pan: float) -> tuple[float, float]:
    pan = max(-1.0, min(1.0, pan))
    angle = (pan + 1.0) * math.pi / 4.0
    return math.cos(angle), math.sin(angle)


def add_clip(target: np.ndarray, clip: np.ndarray, start: int, *, gain: float, pan: float) -> None:
    if start >= len(target):
        return
    clip = ensure_stereo(clip)
    end = min(len(target), start + len(clip))
    if end <= start:
        return
    segment = clip[: end - start].copy() * gain
    left, right = equal_power_pan(pan)
    segment[:, 0] *= left
    segment[:, 1] *= right
    target[start:end] += segment


def note_env(n: int, attack_s: float, release_s: float) -> np.ndarray:
    env = np.ones(n, dtype=np.float32)
    attack_n = min(n, max(1, int(attack_s * SR)))
    release_n = min(n, max(1, int(release_s * SR)))
    env[:attack_n] *= np.linspace(0.0, 1.0, attack_n, dtype=np.float32)
    env[-release_n:] *= np.linspace(1.0, 0.0, release_n, dtype=np.float32)
    return env


def midi_to_freq(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def chord_root_name(chord: str) -> str:
    chord = chord.strip().upper()
    if len(chord) >= 2 and chord[1] in ("#", "B"):
        return chord[:2]
    return chord[:1]


def chord_root_midi(chord: str, octave: int) -> int:
    return 12 * (octave + 1) + NOTE_OFFSETS.get(chord_root_name(chord), NOTE_OFFSETS["G"])


def is_minor(chord: str) -> bool:
    lower = chord.lower()
    return ("m" in lower or "min" in lower) and "maj" not in lower


def chord_tones(chord: str, octave: int) -> dict[str, int]:
    root = chord_root_midi(chord, octave)
    third = root + (3 if is_minor(chord) else 4)
    fifth = root + 7
    seventh = root + (10 if is_minor(chord) else 11)
    return {"root": root, "third": third, "fifth": fifth, "seventh": seventh, "octave": root + 12}


def role_for_section(section_name: str) -> str:
    name = section_name.lower()
    if "intro" in name:
        return "intro"
    if "outro" in name:
        return "outro"
    if "bridge" in name:
        return "break"
    if "chorus" in name:
        return "recap"
    if "prechorus" in name or "pre-chorus" in name:
        return "comp"
    if "verse" in name:
        return "verse"
    return "verse"


def chord_for_bar(track: dict[str, Any], role: str, local_bar: int) -> str:
    lookup_role = {
        "intro": "verse",
        "outro": "chorus",
        "break": "bridge",
        "comp": "prechorus",
        "recap": "chorus",
    }.get(role, role)
    progressions = track.get("chord_progression", {})
    progression = progressions.get(lookup_role) or progressions.get("verse") or [["G", 4]]
    total_bars = sum(int(item[1]) for item in progression if len(item) >= 2) or 1
    pos = local_bar % total_bars
    cursor = 0
    for item in progression:
        chord = str(item[0])
        bars = int(item[1])
        if cursor <= pos < cursor + bars:
            return chord
        cursor += bars
    return str(progression[0][0])


def event_step(event: dict[str, Any]) -> int:
    return int(round((float(event.get("beat") or 0.0) * 4.0) + float(event.get("sub") or 0.0)))


def accent_steps(events: list[dict[str, Any]], instruments: set[str], min_velocity: float) -> list[dict[str, Any]]:
    by_step: dict[int, dict[str, Any]] = {}
    for event in events:
        if event.get("instrument") not in instruments:
            continue
        velocity = float(event.get("velocity") or 0.0)
        if velocity < min_velocity:
            continue
        step = max(0, min(15, event_step(event)))
        hit = {
            "step": step,
            "vel": velocity,
            "micro_ms": float(event.get("microMs") or 0.0),
            "instrument": event.get("instrument"),
        }
        if step not in by_step or hit["vel"] > by_step[step]["vel"]:
            by_step[step] = hit
    return sorted(by_step.values(), key=lambda hit: hit["step"])


def track_duration_samples(ctx: RenderContext) -> int:
    return ctx.target_len


def load_sample(path: Path) -> np.ndarray:
    audio, file_sr = sf.read(str(path), always_2d=True, dtype="float32")
    audio = ensure_stereo(audio)
    if file_sr != SR:
        audio = np.stack(
            [librosa.resample(audio[:, ch], orig_sr=file_sr, target_sr=SR) for ch in range(audio.shape[1])],
            axis=1,
        ).astype(np.float32)
    return audio


def sample_bank(kit_dir: Path) -> dict[str, list[np.ndarray]]:
    bank: dict[str, list[np.ndarray]] = {}
    for voice in ("kick", "snare", "hat", "crash", "tom", "other"):
        files = sorted(kit_dir.glob(f"{voice}-*.wav"))
        if files:
            bank[voice] = [load_sample(path) for path in files]
    return bank


def choose_sample(bank: dict[str, list[np.ndarray]], instrument: str, counter: int) -> np.ndarray | None:
    mapping = {
        "kick": "kick",
        "snare": "snare",
        "ghost": "snare",
        "fill": "snare",
        "hat": "hat",
        "crash": "crash",
        "tom": "tom",
    }
    voice = mapping.get(instrument, "other")
    candidates = bank.get(voice) or bank.get("other")
    if not candidates:
        return None
    if instrument == "ghost" and len(candidates) > 2:
        return candidates[(counter + 2) % len(candidates)]
    if instrument == "fill" and len(candidates) > 1:
        return candidates[(counter + 1) % len(candidates)]
    return candidates[counter % len(candidates)]


def render_drums(ctx: RenderContext) -> tuple[np.ndarray, dict[str, int]]:
    out = np.zeros((track_duration_samples(ctx), 2), dtype=np.float32)
    bank = sample_bank(ctx.kit_dir)
    frames = {frame.get("id"): frame for frame in ctx.track.get("frames", [])}
    bpm = float(ctx.track.get("bpm") or ctx.song.get("bpm") or 117.0)
    beat_s = 60.0 / bpm
    sub_s = beat_s / 4.0
    bar_s = beat_s * 4.0
    gains = {
        "kick": 0.70,
        "snare": 0.62,
        "hat": 0.18,
        "crash": 0.24,
        "ghost": 0.27,
        "fill": 0.42,
        "tom": 0.36,
    }
    pans = {
        "kick": 0.00,
        "snare": -0.06,
        "hat": 0.24,
        "crash": 0.28,
        "ghost": -0.16,
        "fill": 0.12,
        "tom": 0.14,
    }
    counts: dict[str, int] = {}
    global_bar = 0
    sample_counter = 0

    def add_drum_hit(instrument: str, start_s: float, velocity: float, phrase_mult: float, role_mult: float) -> None:
        nonlocal sample_counter
        clip = choose_sample(bank, instrument, sample_counter)
        if clip is None:
            return
        gain = gains.get(instrument, 0.25) * (0.45 + clamp(velocity, 0.02, 1.0)) * phrase_mult * role_mult
        add_clip(out, clip, int(round(start_s * SR)), gain=gain, pan=pans.get(instrument, 0.0))
        counts[instrument] = counts.get(instrument, 0) + 1
        sample_counter += 1

    for section in ctx.track.get("structure", []):
        frame = frames.get(section.get("frame_id"))
        bars = int(section.get("bars") or 0)
        if not frame or bars <= 0:
            global_bar += max(0, bars)
            continue
        role = role_for_section(str(frame.get("session_role") or section.get("section") or "verse"))
        events = list(frame.get("events", []))
        if not any(event.get("instrument") == "kick" for event in events) and role not in ("intro", "outro"):
            events.append({"instrument": "kick", "beat": 0, "sub": 0, "velocity": 0.42, "microMs": 0})
            events.append({"instrument": "kick", "beat": 2, "sub": 0, "velocity": 0.34, "microMs": 0})
        for local_bar in range(bars):
            phrase = local_bar % 4
            phrase_mult = [0.95, 1.0, 1.08, 0.98][phrase]
            role_mult = 1.08 if role == "recap" else 0.92 if role in ("intro", "outro") else 1.0
            bar_start = global_bar * bar_s
            for event in events:
                instrument = str(event.get("instrument") or "other")
                velocity = max(0.02, min(1.0, float(event.get("velocity") or 0.35)))
                beat = int(event.get("beat") or 0)
                sub = int(event.get("sub") or 0)
                if instrument == "kick" and beat in (0, 2) and sub == 0:
                    velocity = max(velocity, 0.82)
                elif instrument == "snare" and beat in (1, 3) and sub == 0:
                    velocity = max(velocity, 0.86)
                step = event_step(event)
                micro_s = float(event.get("microMs") or 0.0) / 1000.0
                add_drum_hit(instrument, bar_start + step * sub_s + micro_s, velocity, phrase_mult, role_mult)

            bars_in_section = max(1, bars)
            is_fill_bar = (local_bar + 1) % 4 == 0
            is_section_end = local_bar == bars_in_section - 1
            is_forced_end_fill = is_section_end and not is_fill_bar
            if (is_fill_bar or is_forced_end_fill) and role not in ("intro", "outro"):
                fill_variant = 3 if is_forced_end_fill else (local_bar // 4) % 4
                beat4 = bar_start + 3 * beat_s
                if fill_variant == 0:
                    for s in range(4):
                        add_drum_hit("tom", beat4 + s * sub_s, 0.42 + s * 0.10, phrase_mult, role_mult)
                elif fill_variant == 1:
                    for s in range(4):
                        add_drum_hit("snare", beat4 + s * sub_s, 0.40 + s * 0.13, phrase_mult, role_mult)
                elif fill_variant == 2:
                    for instrument, s, velocity in (
                        ("kick", 0, 0.56),
                        ("snare", 1, 0.48),
                        ("kick", 2, 0.56),
                        ("snare", 3, 0.68),
                    ):
                        add_drum_hit(instrument, beat4 + s * sub_s, velocity, phrase_mult, role_mult)
                else:
                    add_drum_hit("tom", beat4 + 2 * sub_s, 0.58, phrase_mult, role_mult)
                    add_drum_hit("tom", beat4 + 3 * sub_s, 0.76, phrase_mult, role_mult)

            has_strong_hit = any(
                (
                    event.get("instrument") == "kick"
                    and int(event.get("beat") or 0) in (0, 2)
                    and int(event.get("sub") or 0) == 0
                )
                or (
                    event.get("instrument") == "snare"
                    and int(event.get("beat") or 0) in (1, 3)
                    and int(event.get("sub") or 0) == 0
                )
                for event in events
            )
            if role not in ("intro", "outro") and (len(events) < 6 or not has_strong_hit):
                for instrument, beat, velocity in (
                    ("kick", 0, 0.82),
                    ("snare", 1, 0.86),
                    ("kick", 2, 0.82),
                    ("snare", 3, 0.86),
                ):
                    exists = any(
                        event.get("instrument") == instrument
                        and int(event.get("beat") or 0) == beat
                        and int(event.get("sub") or 0) == 0
                        for event in events
                    )
                    if not exists:
                        add_drum_hit(instrument, bar_start + beat * beat_s, velocity, phrase_mult, role_mult)
            global_bar += 1
    out = sos_filter(out, "highpass", 32.0, order=2)
    return out, counts


def add_note(
    target: np.ndarray,
    start_s: float,
    dur_s: float,
    midi: int,
    *,
    gain: float,
    pan: float,
    color: str,
) -> None:
    start = int(round(start_s * SR))
    if start >= len(target):
        return
    n = max(1, int(round(dur_s * SR)))
    end = min(len(target), start + n)
    n = end - start
    if n <= 0:
        return
    t = np.arange(n, dtype=np.float32) / SR
    freq = midi_to_freq(midi)
    if color == "bass":
        sig = (
            0.85 * np.sin(2.0 * np.pi * freq * t)
            + 0.32 * np.sin(2.0 * np.pi * freq * 2.0 * t)
            + 0.16 * np.sin(2.0 * np.pi * freq * 3.0 * t)
        )
        sig = np.tanh(sig * 1.8) * note_env(n, 0.004, 0.075)
    elif color == "chord":
        sig = (
            0.50 * np.sin(2.0 * np.pi * freq * t)
            + 0.22 * np.sin(2.0 * np.pi * freq * 2.0 * t)
            + 0.10 * np.sin(2.0 * np.pi * freq * 3.0 * t)
        )
        sig = sig * note_env(n, 0.020, 0.300)
    else:
        phase = (freq * t) % 1.0
        saw = 2.0 * phase - 1.0
        sig = np.tanh((0.80 * saw + 0.24 * np.sin(2.0 * np.pi * freq * t)) * 1.4)
        sig = sig * note_env(n, 0.002, 0.090)
    sig = (sig * gain).astype(np.float32)
    left, right = equal_power_pan(pan)
    target[start:end, 0] += sig * left
    target[start:end, 1] += sig * right


def snapped_offset(step: int, micro_ms: float, kick_steps: list[dict[str, Any]], sub_s: float, *, push_s: float = 0.0) -> float:
    base = step * sub_s + micro_ms / 1000.0
    if not kick_steps:
        return base
    nearest = min(kick_steps, key=lambda hit: abs((hit["step"] * sub_s + hit["micro_ms"] / 1000.0) - base))
    nearest_offset = nearest["step"] * sub_s + nearest["micro_ms"] / 1000.0
    if abs(nearest_offset - base) <= 0.050:
        return nearest_offset + push_s
    return base


def render_bass_and_other(ctx: RenderContext) -> tuple[np.ndarray, np.ndarray, dict[str, int]]:
    target_len = track_duration_samples(ctx)
    bass = np.zeros((target_len, 2), dtype=np.float32)
    other = np.zeros((target_len, 2), dtype=np.float32)
    frames = {frame.get("id"): frame for frame in ctx.track.get("frames", [])}
    bpm = float(ctx.track.get("bpm") or ctx.song.get("bpm") or 117.0)
    beat_s = 60.0 / bpm
    sub_s = beat_s / 4.0
    bar_s = beat_s * 4.0
    counts = {"bass_notes": 0, "guitar_strums": 0, "chord_stabs": 0}
    global_bar = 0

    for section in ctx.track.get("structure", []):
        frame = frames.get(section.get("frame_id"))
        bars = int(section.get("bars") or 0)
        role = role_for_section(str(frame.get("session_role") if frame else section.get("section") or "verse"))
        metrics = frame_metrics(frame)
        events = list(frame.get("events", [])) if frame else []
        for local_bar in range(max(0, bars)):
            phrase = local_bar % 4
            phrase_mult = [0.96, 1.0, 1.06, 0.98][phrase]
            chord = chord_for_bar(ctx.track, role, local_bar)
            tones_bass = chord_tones(chord, 1)
            tones_gtr = chord_tones(chord, 2)
            tones_chord = chord_tones(chord, 4)
            bar_start = global_bar * bar_s
            kick_hits = accent_steps(events, {"kick"}, 0.08)
            if not kick_hits and role not in ("intro", "outro"):
                kick_hits = [{"step": 0, "vel": 0.50, "micro_ms": 0.0}, {"step": 8, "vel": 0.36, "micro_ms": 0.0}]

            bass_source = kick_hits or [{"step": 0, "vel": 0.46, "micro_ms": 0.0}]
            for idx, hit in enumerate(bass_source[:8]):
                step = int(hit["step"])
                note = tones_bass["root"]
                if step >= 12:
                    note = tones_bass["seventh"]
                elif step >= 8:
                    note = tones_bass["octave"]
                elif step >= 4:
                    note = tones_bass["fifth"]
                if phrase == 2 and step == 0 and role not in ("intro", "outro", "break"):
                    note += 12
                offset = snapped_offset(step, float(hit.get("micro_ms") or 0.0), kick_hits, sub_s, push_s=-0.010)
                dur = 0.26 if role == "recap" and metrics["density"] > 0.5 else 0.34
                vel = max(0.30, min(0.90, (0.34 + float(hit.get("vel") or 0.4) * 0.62 + (0.08 if idx == 0 else 0.0)) * phrase_mult))
                add_note(bass, bar_start + offset, dur, note, gain=0.145 * vel, pan=0.0, color="bass")
                counts["bass_notes"] += 1
            if role == "verse" and any(hit["step"] >= 10 for hit in accent_steps(events, {"ghost"}, 0.18)):
                add_note(bass, bar_start + 11 * sub_s - 0.006, 0.17, tones_bass["fifth"], gain=0.064, pan=0.0, color="bass")
                counts["bass_notes"] += 1
            if role in ("recap", "comp") and metrics["pressure"] > 0.52:
                add_note(bass, bar_start + 14 * sub_s - 0.008, 0.14, tones_bass["third"] + 12, gain=0.064, pan=0.0, color="bass")
                counts["bass_notes"] += 1

            accent = accent_steps(events, {"kick", "snare", "crash", "ghost"}, 0.20)
            accent_map = {hit["step"]: hit for hit in accent}
            if role == "intro" and not accent and metrics["pressure"] < 0.55:
                guitar_steps: list[int] = []
            elif role == "outro":
                guitar_steps = [0]
            elif role == "break":
                guitar_steps = [0, 8]
            elif role == "recap":
                guitar_steps = [0, 8]
            else:
                guitar_steps = [0, 8]
            gtr_voicings = [
                [tones_gtr["root"], tones_gtr["fifth"], tones_gtr["octave"]],
                [tones_gtr["fifth"], tones_gtr["octave"], tones_gtr["root"] + 12],
                [tones_gtr["octave"], tones_gtr["fifth"] + 12],
                [tones_gtr["root"], tones_gtr["fifth"], tones_gtr["octave"]],
            ]
            gtr_notes = gtr_voicings[phrase]
            for step in guitar_steps:
                hit = accent_map.get(step)
                micro_ms = float(hit.get("micro_ms") or 0.0) if hit else 0.0
                offset = snapped_offset(step, micro_ms, kick_hits, sub_s)
                vel = 0.50 + (float(hit.get("vel") or 0.35) * 0.20 if hit else 0.0)
                vel += 0.10 if step == 0 else 0.0
                for note in gtr_notes:
                    add_note(other, bar_start + offset, 0.18 if role == "recap" else 0.28, note, gain=0.056 * vel, pan=-0.14, color="guitar")
                counts["guitar_strums"] += 1

            chord_notes = [tones_chord["root"], tones_chord["third"], tones_chord["seventh"]]
            if phrase == 1:
                chord_notes = [tones_chord["third"], tones_chord["fifth"], tones_chord["octave"]]
            elif phrase == 2:
                chord_notes = [tones_chord["fifth"], tones_chord["seventh"], tones_chord["octave"]]
            is_rock_pad = (
                role not in ("break", "comp", "intro", "outro")
                and not (role == "recap" and metrics["pressure"] > 0.58)
                and len(accent_steps(events, {"ghost"}, 0.18)) <= 1
            )
            chord_hits = [(0, bar_s * (0.92 if is_rock_pad or role in ("intro", "outro") else 0.45), 0.040)]
            if role == "break":
                chord_hits.append((8, beat_s, 0.027))
            elif role == "comp":
                ghost_answer = next((hit["step"] for hit in accent_steps(events, {"ghost"}, 0.18) if hit["step"] >= 8), 10)
                chord_hits.append((ghost_answer, beat_s, 0.024 + metrics["pressure"] * 0.012))
            elif role == "recap" and metrics["pressure"] > 0.58:
                chord_hits.append((8, beat_s * 1.25, 0.027))
            for step, dur, gain in chord_hits:
                for note in chord_notes:
                    add_note(other, bar_start + step * sub_s + 0.005, dur, note, gain=gain, pan=0.18, color="chord")
                counts["chord_stabs"] += 1
            global_bar += 1

    bass = sos_filter(bass, "lowpass", 1400.0, order=3)
    other = sos_filter(other, "bandpass", (85.0, 5200.0), order=3)
    return bass, other, counts


def load_registry() -> dict[str, Any]:
    return json.loads((ROOT / "presets" / "bands.json").read_text(encoding="utf-8"))


def resolve_context(args: argparse.Namespace) -> RenderContext:
    registry = load_registry()
    bands = {}
    bands.update(registry.get("bands", {}))
    bands.update(registry.get("reference_libraries", {}))
    band = bands.get(args.band)
    if not band:
        raise SystemExit(f"band not found: {args.band}")
    song = next((item for item in band.get("songs", []) if item.get("id") == args.song), None)
    if not song:
        raise SystemExit(f"song not found: {args.song}")
    pattern = str(band.get("drum_frames_pattern") or "").replace("{songid}", args.song)
    track_path = ROOT / pattern
    if not track_path.exists():
        raise SystemExit(f"drum frame track not found: {track_path}")
    track = json.loads(track_path.read_text(encoding="utf-8"))
    kit_dir = ROOT / "presets" / "sample-kits" / args.band / args.song
    if not kit_dir.exists():
        raise SystemExit(f"sample kit not found: {kit_dir}")

    target_len = None
    stem_dir = ROOT / str(band.get("stems_dir", "")) / args.song
    if (stem_dir / "drums.mp3").exists():
        drums, _ = load_audio(stem_dir / "drums.mp3")
        target_len = len(drums)
    if target_len is None:
        duration = float(song.get("duration_s") or track.get("estimated_duration_s") or 0.0)
        if duration <= 0:
            raise SystemExit("could not determine target duration")
        target_len = int(round(duration * SR))
    return RenderContext(
        band_id=args.band,
        song_id=args.song,
        song=song,
        track=track,
        target_len=target_len,
        out_dir=args.output_root / args.band / args.song,
        kit_dir=kit_dir,
    )


def spectral_summary(audio: np.ndarray) -> dict[str, Any]:
    mono = ensure_stereo(audio).mean(axis=1)
    spec = np.abs(librosa.stft(mono, n_fft=2048)) ** 2
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    bands = {
        "sub_20_80": (20.0, 80.0),
        "low_80_180": (80.0, 180.0),
        "body_180_1200": (180.0, 1200.0),
        "presence_1200_5000": (1200.0, 5000.0),
        "air_5000_10000": (5000.0, 10000.0),
    }
    total = float(spec.sum()) + 1e-12
    centroid = librosa.feature.spectral_centroid(y=mono, sr=SR)[0]
    rr = librosa.feature.rms(y=mono)[0]
    return {
        "rms": round(rms(audio), 5),
        "rms_db": round(db(rms(audio)), 2),
        "peak": round(peak(audio), 5),
        "centroid_hz": round(float(centroid.mean()), 1),
        "dynamic_range_db": round(float(20 * np.log10(max(np.percentile(rr, 95), 1e-9) / max(np.percentile(rr, 10), 1e-9))), 2),
        "band_shares": {
            name: round(float(spec[(freqs >= lo) & (freqs < hi), :].sum()) / total, 4)
            for name, (lo, hi) in bands.items()
        },
    }


def write_notes(ctx: RenderContext, report: dict[str, Any]) -> None:
    notes = [
        "# Band Room AI Recreation Render",
        "",
        f"- Band/song: `{ctx.band_id}/{ctx.song_id}`",
        "- Route: source-derived AI recreation, not stem recovery.",
        "- Inputs: song-track drum frames, extracted drum sample kit, chord progression.",
        "- Use these files as independent external stems or direct listening references.",
        "",
        "## Files",
        "",
    ]
    for name, metric in report.get("outputs", {}).items():
        notes.append(f"- `{name}`: {metric['duration_s']}s, rms={metric['rms']}, peak={metric['peak']}")
    notes.append("")
    (ctx.out_dir / "ai-recreation-notes.md").write_text("\n".join(notes), encoding="utf-8")


def output_metric(path: Path) -> dict[str, Any]:
    audio, sr = load_audio(path)
    metric = spectral_summary(audio)
    metric.update({
        "path": str(path),
        "duration_s": round(len(audio) / sr, 3),
        "sample_rate_hz": sr,
        "channels": int(audio.shape[1]),
        "non_silent": bool(rms(audio) > 0.0005 and peak(audio) > 0.005),
    })
    return metric


def render(args: argparse.Namespace) -> dict[str, Any]:
    ctx = resolve_context(args)
    ctx.out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Rendering AI recreation for {ctx.band_id}/{ctx.song_id}...", flush=True)

    drums, drum_counts = render_drums(ctx)
    bass, other, part_counts = render_bass_and_other(ctx)
    stems = normalize_stems({
        "drums": instrument_polish(drums) * 0.84,
        "bass": instrument_polish(bass) * 1.20,
        "other": instrument_polish(other) * 1.45,
    })
    mix = normalize_audio(upward_body_glue(stems["drums"] + stems["bass"] + stems["other"]))

    outputs = {
        "drums.mp3": stems["drums"],
        "bass.mp3": stems["bass"],
        "other.mp3": stems["other"],
    }
    for name, audio in outputs.items():
        write_mp3(audio, ctx.out_dir / name)
    write_wav(mix, ctx.out_dir / "mix.wav")

    report = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "band": ctx.band_id,
        "song": ctx.song_id,
        "song_title": ctx.song.get("title"),
        "profile": args.profile,
        "route": "source-derived-ai-recreation",
        "inputs": {
            "drum_frames": str(ROOT / str(load_registry()["bands"][ctx.band_id]["drum_frames_pattern"]).replace("{songid}", ctx.song_id)),
            "sample_kit": str(ctx.kit_dir),
        },
        "duration_target_s": round(ctx.target_len / SR, 3),
        "event_counts": {**drum_counts, **part_counts},
        "outputs": {
            "mix.wav": output_metric(ctx.out_dir / "mix.wav"),
            **{name: output_metric(ctx.out_dir / name) for name in outputs},
        },
    }
    report["pass_basic_audio_check"] = all(
        metric["channels"] == 2
        and metric["non_silent"]
        and abs(metric["duration_s"] - report["duration_target_s"]) < 1.0
        for metric in report["outputs"].values()
    )
    (ctx.out_dir / "ai-recreation-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    write_notes(ctx, report)
    return report


def main() -> int:
    report = render(parse_args())
    print(json.dumps(report, indent=2, ensure_ascii=False), flush=True)
    return 0 if report.get("pass_basic_audio_check") else 2


if __name__ == "__main__":
    raise SystemExit(main())
