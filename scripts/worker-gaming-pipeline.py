#!/usr/bin/env python3
"""
worker-gaming pipeline wrapper.

This script keeps heavy audio artifacts outside the Music repo by default.
It only orchestrates existing repo tools and common CLI programs. It does not
install packages, write tracked audio, arm DAWs, or edit runtime files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path

try:
    import winreg
except ImportError:
    winreg = None


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORKER_ROOT = Path(os.environ.get("MUSIC_STACK_WORKER_ROOT", r"C:\workspace\music-stack-worker"))
WORKER_DIRS = (
    "inbox",
    "stems",
    "ai-recreation",
    "reports",
    "daw-export",
    "hardware-jam",
    "hardware-jam/ep133-inbox",
    "hardware-jam/captures",
    "logs",
    "tools",
    "tools/midi-cli",
    "tmp",
)
AUDIO_EXTS = {".m4a", ".mp3", ".wav", ".flac", ".aac", ".ogg", ".webm"}
EP_SAMPLE_TOOL_URL = "https://teenage.engineering/apps/ep-sample-tool"
EP133_DEVICE_INFO_REQUEST_SYX = bytes([0xF0, 0x00, 0x20, 0x76, 0x33, 0x40, 0x77, 0x14, 0x01, 0xF7])
MIDI_CLI_TOOLS = {
    "sendmidi": {
        "version": "1.3.1",
        "url": "https://github.com/gbevin/SendMIDI/releases/download/1.3.1/sendmidi-windows-1.3.1.zip",
        "sha256": "9FA5904014E7E1243392AFFD525244A304E12F6399E1012E5AEE5739B8E4B0E3",
        "exe": Path("sendmidi-windows-1.3.1") / "sendmidi.exe",
    },
    "receivemidi": {
        "version": "1.4.4",
        "url": "https://github.com/gbevin/ReceiveMIDI/releases/download/1.4.4/receivemidi-windows-1.4.4.zip",
        "sha256": "931366C157062053A5401D1193A37B884787CC6BE606B9D44646749B6E125959",
        "exe": Path("receivemidi-windows-1.4.4") / "receivemidi.exe",
    },
}


def resolve_ffmpeg() -> str:
    """Find ffmpeg even when winget portable PATH updates have not propagated."""
    found = shutil.which("ffmpeg")
    if found:
        return found

    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages",
        Path(os.environ.get("ProgramFiles", "")) / "WinGet" / "Packages",
    ]
    for root in candidates:
        if not root.exists():
            continue
        for exe in root.glob("Gyan.FFmpeg_*/ffmpeg-*full_build/bin/ffmpeg.exe"):
            if exe.exists():
                return str(exe)
    try:
        import imageio_ffmpeg

        imageio_path = imageio_ffmpeg.get_ffmpeg_exe()
        if imageio_path and Path(imageio_path).exists():
            return imageio_path
    except Exception:
        pass
    return "ffmpeg"


def run(cmd: list[str | Path], *, cwd: Path = ROOT, check: bool = True) -> subprocess.CompletedProcess[str]:
    printable = " ".join(str(part) for part in cmd)
    print(f"+ {printable}", flush=True)
    result = subprocess.run(
        [str(part) for part in cmd],
        cwd=str(cwd),
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and result.returncode != 0:
        raise SystemExit(result.returncode)
    return result


def worker_path(args: argparse.Namespace, *parts: str) -> Path:
    return Path(args.worker_root).resolve().joinpath(*parts)


def init_dirs(args: argparse.Namespace) -> None:
    root = Path(args.worker_root).resolve()
    for name in WORKER_DIRS:
        (root / name).mkdir(parents=True, exist_ok=True)
    print(f"worker root: {root}")


def python_probe(code: str) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.returncode, (result.stdout + result.stderr).strip()


def command_check_env(args: argparse.Namespace) -> None:
    init_dirs(args)
    missing = []
    cuda_ready = False
    print("\nCore tools")
    tools = {
        "python": [sys.executable, "--version"],
        "node": ["node", "--version"],
        "ffmpeg": [resolve_ffmpeg(), "-version"],
        "demucs": [sys.executable, "-m", "demucs", "--help"],
    }
    for name, cmd in tools.items():
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        except FileNotFoundError as exc:
            result = subprocess.CompletedProcess(cmd, 127, "", str(exc))
        first_line = (result.stdout or result.stderr).splitlines()[:1]
        status = "OK" if result.returncode == 0 else "missing"
        detail = first_line[0] if first_line else ""
        print(f"  {name:<8} {status:<8} {detail}")
        if status != "OK":
            missing.append(name)

    print("\nPython packages")
    package_probe = """
import importlib.util
mods = ['torch', 'torchaudio', 'demucs', 'librosa', 'soundfile', 'imageio_ffmpeg', 'numpy', 'scipy']
for mod in mods:
    print(f"{mod}: {'OK' if importlib.util.find_spec(mod) else 'missing'}")
try:
    import torch
    print(f"torch_version: {torch.__version__}")
    print(f"cuda_available: {torch.cuda.is_available()}")
    print(f"cuda_device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none'}")
except Exception as exc:
    print(f"torch_error: {exc!r}")
"""
    _, output = python_probe(package_probe)
    print(output)
    for line in output.splitlines():
        if line.endswith(": missing"):
            missing.append(line.split(":", 1)[0])
        if line == "cuda_available: True":
            cuda_ready = True

    print("\nInstalled app hints")
    for path in [
        Path(r"C:\Program Files\Ableton"),
        Path(r"C:\Program Files\Native Instruments"),
        Path(r"C:\Program Files\VCV"),
        Path(r"C:\Program Files\SuperCollider-3.9.3"),
    ]:
        print(f"  {'OK' if path.exists() else 'missing':<8} {path}")

    print("\nWorker status")
    if not missing and cuda_ready:
        print("  ready: CUDA, Demucs, librosa, ffmpeg, and worker audio dependencies are available.")
        return
    if missing:
        print("  missing: " + ", ".join(sorted(set(missing))))
    if not cuda_ready:
        print("  cuda: not ready from this Python interpreter.")
    print("  setup: use the official PyTorch selector, then install demucs librosa soundfile imageio-ffmpeg scipy numpy in the worker venv.")


def _latest_ableton_preferences_dir() -> Path | None:
    root = Path(os.environ.get("APPDATA", "")) / "Ableton"
    if not root.exists():
        return None
    candidates = [
        path / "Preferences"
        for path in root.glob("Live *")
        if (path / "Preferences").exists()
    ]
    if not candidates:
        return None

    def version_key(path: Path) -> tuple[tuple[int, ...], float]:
        match = re.search(r"Live\s+(\d+(?:\.\d+)*)", path.parent.name)
        version = tuple(int(part) for part in match.group(1).split(".")) if match else (0,)
        return version, path.stat().st_mtime

    return max(candidates, key=version_key)


def _sqlite_count(db_path: Path, table: str) -> int | None:
    if not db_path.exists():
        return None
    try:
        with sqlite3.connect(db_path) as con:
            return int(con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
    except sqlite3.Error:
        return None


def _sqlite_rows(db_path: Path, query: str, limit: int = 8) -> list[tuple]:
    if not db_path.exists():
        return []
    try:
        with sqlite3.connect(db_path) as con:
            return list(con.execute(query).fetchmany(limit))
    except sqlite3.Error:
        return []


def _uninstall_registry_entries() -> list[dict[str, str]]:
    if winreg is None:
        return []

    fields = ("DisplayName", "DisplayVersion", "Publisher", "InstallDate", "DisplayIcon", "InstallLocation")
    roots = [
        ("HKLM", winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        ("HKLM32", winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        ("HKCU", winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    entries: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for hive_name, hive, root_path in roots:
        try:
            root_key = winreg.OpenKey(hive, root_path)
        except OSError:
            continue
        with root_key:
            subkey_count = winreg.QueryInfoKey(root_key)[0]
            for index in range(subkey_count):
                try:
                    subkey_name = winreg.EnumKey(root_key, index)
                    subkey = winreg.OpenKey(root_key, subkey_name)
                except OSError:
                    continue
                with subkey:
                    entry = {"RegistryKey": fr"{hive_name}\{root_path}\{subkey_name}"}
                    for field in fields:
                        try:
                            value = winreg.QueryValueEx(subkey, field)[0]
                        except OSError:
                            continue
                        if value is not None:
                            entry[field] = str(value)
                display_name = entry.get("DisplayName", "").strip()
                if not display_name:
                    continue
                dedupe = (
                    display_name.lower(),
                    entry.get("DisplayVersion", "").lower(),
                    entry.get("Publisher", "").lower(),
                )
                if dedupe in seen:
                    continue
                seen.add(dedupe)
                entries.append(entry)
    return entries


def _match_uninstall_entry(entries: list[dict[str, str]], names: list[str]) -> dict[str, str] | None:
    needles = [name.lower() for name in names]
    for entry in entries:
        display_name = entry.get("DisplayName", "").lower()
        if any(display_name == needle for needle in needles):
            return entry
    for entry in entries:
        display_name = entry.get("DisplayName", "").lower()
        if any(needle in display_name for needle in needles):
            return entry
    return None


def _entry_detail(entry: dict[str, str] | None) -> str:
    if not entry:
        return ""
    parts = []
    if entry.get("DisplayVersion"):
        parts.append(f"version {entry['DisplayVersion']}")
    if entry.get("InstallDate"):
        parts.append(f"installed {entry['InstallDate']}")
    if entry.get("Publisher"):
        parts.append(entry["Publisher"])
    return "; ".join(parts)


def _print_registry_item(label: str, entry: dict[str, str] | None, path: Path | None = None) -> None:
    path_exists = bool(path and path.exists())
    status = "OK" if entry or path_exists else "missing"
    details = []
    entry_details = _entry_detail(entry)
    if entry_details:
        details.append(entry_details)
    if path:
        details.append(str(path))
    print(f"  {label:<30} {status:<8} {' | '.join(details)}")


def _child_dir_count(path: Path) -> int | None:
    if not path.exists():
        return None
    try:
        return sum(1 for child in path.iterdir() if child.is_dir())
    except OSError:
        return None


def _powershell_json(command: str) -> list[dict[str, str]]:
    exe = shutil.which("powershell") or shutil.which("pwsh")
    if not exe:
        return []
    result = subprocess.run(
        [exe, "-NoProfile", "-Command", f"{command} | ConvertTo-Json -Depth 4"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0 or not result.stdout.strip():
        return []
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


def _windows_pnp_devices() -> list[dict[str, str]]:
    return _powershell_json(
        "$ErrorActionPreference='SilentlyContinue'; "
        "Get-PnpDevice -PresentOnly | "
        "Select-Object Class,FriendlyName,InstanceId,Status"
    )


def _windows_sound_devices() -> list[dict[str, str]]:
    return _powershell_json(
        "$ErrorActionPreference='SilentlyContinue'; "
        "Get-CimInstance Win32_SoundDevice | "
        "Select-Object Name,Manufacturer,Status,DeviceID"
    )


def _matches_device(device: dict[str, str], keywords: list[str]) -> bool:
    haystack = " ".join(str(value or "") for value in device.values()).lower()
    return any(keyword.lower() in haystack for keyword in keywords)


def _print_devices(label: str, devices: list[dict[str, str]]) -> None:
    print(f"\n{label}")
    if not devices:
        print("  missing  no matching Windows device is visible")
        return
    for device in devices[:12]:
        name = device.get("FriendlyName") or device.get("Name") or "<unnamed>"
        class_name = device.get("Class") or device.get("Manufacturer") or ""
        status = device.get("Status") or ""
        instance = device.get("InstanceId") or device.get("DeviceID") or ""
        print(f"  OK       {name} | {class_name} | {status}")
        if instance:
            print(f"           {instance}")
    if len(devices) > 12:
        print(f"  ... {len(devices) - 12} more matching devices")


def _capture_command(cmd: list[str | Path], *, timeout: int = 30) -> dict[str, object]:
    try:
        result = subprocess.run(
            [str(part) for part in cmd],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return {"command": [str(part) for part in cmd], "returncode": 127, "output": str(exc)}
    output = (result.stdout or result.stderr).strip()
    return {"command": [str(part) for part in cmd], "returncode": result.returncode, "output": output}


def _first_line(command_result: dict[str, object]) -> str:
    output = str(command_result.get("output") or "")
    return output.splitlines()[0] if output else ""


def _find_worker_tool(args: argparse.Namespace, exe_name: str, explicit: str | None = None) -> Path | None:
    if explicit:
        path = Path(explicit).expanduser()
        return path.resolve() if path.exists() else None

    found = shutil.which(exe_name)
    if found:
        return Path(found).resolve()

    tools_root = worker_path(args, "tools", "midi-cli")
    if tools_root.exists():
        matches = sorted(tools_root.rglob(exe_name))
        if matches:
            return matches[-1].resolve()
    return None


def _parse_ep133_device_info_syx(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data = path.read_bytes()
    printable = bytes(byte for byte in data if byte not in (0x00, 0xF0, 0xF7) and 32 <= byte <= 126)
    text = printable.decode("ascii", errors="ignore")
    start = text.find("product:")
    if start >= 0:
        text = text[start:]
    fields: dict[str, str] = {}
    for part in text.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            fields[key] = value
    serial = fields.get("serial")
    if serial:
        fields["serial_redacted"] = f"{serial[:2]}...{serial[-4:]}" if len(serial) > 6 else "redacted"
        fields.pop("serial", None)
    return fields


def _write_ep133_sysex_probe_markdown(report: dict[str, object], md_path: Path) -> None:
    paths = report.get("paths", {})
    device_info = report.get("device_info", {})
    lines = [
        "# EP-133 SysEx Probe",
        "",
        f"- Created: `{report.get('created_at')}`",
        f"- Device name: `{report.get('device')}`",
        f"- Status: `{report.get('status')}`",
        f"- Worker root: `{report.get('worker_root')}`",
        "",
        "## Device Info",
        "",
    ]
    if isinstance(device_info, dict) and device_info:
        for key in ["product", "mode", "base_sku", "sku", "os_version", "sw_version", "bl_version", "serial_redacted"]:
            if device_info.get(key):
                lines.append(f"- {key}: `{device_info.get(key)}`")
    else:
        lines.append("- No device-info fields were parsed from the response.")

    lines.extend([
        "",
        "## Artifacts",
        "",
    ])
    if isinstance(paths, dict):
        for label, value in paths.items():
            lines.append(f"- {label}: `{value}`")

    lines.extend([
        "",
        "## Safety Boundary",
        "",
        "- This probe sends only the EP-133 device-info request SysEx.",
        "- It does not transfer samples, delete sounds, change projects, or alter Band Room defaults.",
        "- Sample transfer and project backup remain manual gates in the official EP sample tool.",
        "",
        "## Next Manual Gate",
        "",
        "1. Use this probe when you need to confirm EP-133 MIDI/SysEx connectivity.",
        "2. Use `ep133-pack` for local WAV preparation.",
        "3. Before any real transfer, open the EP sample tool, select EP-133, and back up the current project.",
        "",
    ])
    md_path.write_text("\n".join(lines), encoding="utf-8")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _important_uninstall_entries(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    keywords = [
        "Ableton",
        "BandLab",
        "Cakewalk",
        "Kontakt",
        "Maschine",
        "Native Access",
        "Native Instruments",
        "Reaktor",
        "Guitar Rig",
        "VCV Rack",
        "SuperCollider",
        "Atom",
        "TH-U",
        "Overloud",
        "Yamaha Steinberg",
        "Steinberg UR",
    ]
    safe_fields = ("DisplayName", "DisplayVersion", "Publisher", "InstallDate", "DisplayIcon")
    matched = []
    for entry in entries:
        display_name = entry.get("DisplayName", "")
        publisher = entry.get("Publisher", "")
        haystack = f"{display_name} {publisher}".lower()
        if not any(keyword.lower() in haystack for keyword in keywords):
            continue
        matched.append({field: entry[field] for field in safe_fields if field in entry})
    return sorted(matched, key=lambda item: item.get("DisplayName", "").lower())


def _path_snapshot(paths: dict[str, Path]) -> dict[str, dict[str, object]]:
    snapshot = {}
    for label, path in paths.items():
        item = {"path": str(path), "exists": path.exists()}
        try:
            if path.exists() and path.is_file():
                item["bytes"] = path.stat().st_size
            elif path.exists() and path.is_dir():
                item["child_dirs"] = _child_dir_count(path)
        except OSError:
            pass
        snapshot[label] = item
    return snapshot


def _disk_snapshot() -> list[dict[str, str]]:
    return _powershell_json(
        "$ErrorActionPreference='SilentlyContinue'; "
        "Get-PSDrive -PSProvider FileSystem | "
        "Select-Object Name,Root,Free,Used"
    )


def _repo_snapshot() -> dict[str, object]:
    branch = _capture_command(["git", "branch", "--show-current"])
    sha = _capture_command(["git", "rev-parse", "HEAD"])
    status = _capture_command(["git", "status", "--short", "--branch"])
    return {
        "branch": _first_line(branch),
        "head": _first_line(sha),
        "status": str(status.get("output") or ""),
    }


def _write_snapshot_markdown(snapshot: dict[str, object], md_path: Path) -> None:
    apps = snapshot.get("installed_apps", [])
    paths = snapshot.get("paths", {})
    hardware = snapshot.get("hardware", {})
    lines = [
        "# Music PC Setup Snapshot",
        "",
        f"- Tag: `{snapshot.get('tag')}`",
        f"- Captured: `{snapshot.get('captured_at')}`",
        f"- Hostname: `{snapshot.get('hostname')}`",
        f"- Repo head: `{snapshot.get('repo', {}).get('head')}`",
        f"- Worker root: `{snapshot.get('worker_root')}`",
        "",
        "## Toolchain",
        "",
    ]
    for name, detail in snapshot.get("toolchain", {}).items():
        lines.append(f"- {name}: `{detail}`")

    lines.extend(["", "## Installed Apps", ""])
    for app in apps:
        name = app.get("DisplayName", "<unknown>")
        version = app.get("DisplayVersion", "")
        publisher = app.get("Publisher", "")
        install_date = app.get("InstallDate", "")
        suffix = " / ".join(part for part in [version, publisher, install_date] if part)
        lines.append(f"- {name}: {suffix}" if suffix else f"- {name}")

    lines.extend(["", "## Key Paths", ""])
    for label, item in paths.items():
        status = "OK" if item.get("exists") else "missing"
        lines.append(f"- {label}: {status} - `{item.get('path')}`")

    lines.extend(["", "## Hardware Visibility", ""])
    for label, devices in hardware.items():
        lines.append(f"- {label}: {len(devices)} visible")
        for device in devices[:6]:
            name = device.get("FriendlyName") or device.get("Name") or "<unnamed>"
            status = device.get("Status") or ""
            lines.append(f"  - {name} {status}".rstrip())

    lines.extend([
        "",
        "## Rebuild Notes",
        "",
        "1. Follow `docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md` for install order.",
        "2. Run `check-env`, `check-daw`, and `check-hardware` after setup.",
        "3. Keep generated audio, DAW projects, plugin caches, and snapshots outside Git unless explicitly approved.",
        "",
    ])
    md_path.write_text("\n".join(lines), encoding="utf-8")


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _output_metric_line(name: str, metric: dict) -> str:
    duration = metric.get("duration_s", "?")
    rms_value = metric.get("rms", "?")
    peak_value = metric.get("peak", "?")
    centroid = metric.get("centroid_hz", "?")
    dr = metric.get("dynamic_range_db", "?")
    return f"- `{name}`: {duration}s, rms={rms_value}, peak={peak_value}, centroid={centroid}Hz, DR={dr}dB"


def _target_mix_summary(target_analysis: dict, band: str, song: str) -> dict:
    song_entry = target_analysis.get(band, {}).get(song, {})
    return song_entry.get("mix", {}) if isinstance(song_entry, dict) else {}


def _cycle_recommendations(render_report: dict, target_analysis: dict, band: str, song: str) -> list[str]:
    recommendations = [
        "Open the generated stems in Sonar first; keep Ableton for loop/session experiments after VST scan is fixed.",
        "Bounce DAW-polished stems to the daw-export folder, then preview them in Band Room before promoting metadata.",
        "Keep generated audio and DAW projects outside Git; only promote reviewed metadata, candidates, or docs.",
    ]
    ai_mix = render_report.get("outputs", {}).get("mix.wav", {})
    target_mix = _target_mix_summary(target_analysis, band, song)
    if ai_mix and target_mix:
        ai_centroid = float(ai_mix.get("centroid_hz") or 0.0)
        target_centroid = float(target_mix.get("centroid_avg_hz") or 0.0)
        if ai_centroid and target_centroid:
            delta = ai_centroid - target_centroid
            if delta < -600:
                recommendations.insert(0, "AI mix is darker than target; try Sonar high-shelf / L-Phase presence on other + drums.")
            elif delta > 900:
                recommendations.insert(0, "AI mix is brighter than target; tame cymbals/air before export.")
        ai_dr = float(ai_mix.get("dynamic_range_db") or 0.0)
        target_dr = float(target_mix.get("rms_dynamic_range_db") or 0.0)
        if ai_dr and target_dr and ai_dr - target_dr < -4:
            recommendations.insert(0, "AI mix is flatter than target; automate section energy or ease compression.")
    if not render_report.get("pass_basic_audio_check", False):
        recommendations.insert(0, "Basic audio check failed; inspect render logs before DAW polish.")
    return recommendations


def _write_recreation_cycle_markdown(report: dict, md_path: Path) -> None:
    render_report = report.get("render_report", {})
    target_mix = report.get("comparison", {}).get("target_mix", {})
    ai_mix = report.get("comparison", {}).get("ai_mix", {})
    lines = [
        "# Band Room AI Recreation Cycle",
        "",
        f"- Band/song: `{report['band']}/{report['song']}`",
        f"- Captured: `{report['created_at']}`",
        f"- Report root: `{report['paths']['report_dir']}`",
        "",
        "## Generated Stems",
        "",
    ]
    for name, metric in render_report.get("outputs", {}).items():
        lines.append(_output_metric_line(name, metric))

    lines.extend([
        "",
        "## Target Comparison",
        "",
    ])
    if target_mix and ai_mix:
        ai_centroid = float(ai_mix.get("centroid_hz") or 0.0)
        target_centroid = float(target_mix.get("centroid_avg_hz") or 0.0)
        ai_dr = float(ai_mix.get("dynamic_range_db") or 0.0)
        target_dr = float(target_mix.get("rms_dynamic_range_db") or 0.0)
        lines.append(f"- AI mix centroid: `{ai_centroid:.1f} Hz`; target full-mix centroid: `{target_centroid:.1f} Hz`")
        lines.append(f"- AI mix DR: `{ai_dr:.2f} dB`; target full-mix DR: `{target_dr:.2f} dB`")
    else:
        lines.append("- Target full-mix analysis was not available for this cycle.")

    lines.extend([
        "",
        "## Sonar Polish Pass",
        "",
        "- Import `drums.mp3`, `bass.mp3`, `other.mp3`, and `mix.wav` from the generated stem folder.",
        "- Drums: try Sonar Drum Replacer / Session Drummer only where the source-derived kit feels thin.",
        "- Bass: tighten low end with Cakewalk EQ/comp; avoid masking the kick.",
        "- Other: use TH-U / Guitar Rig / L-Phase/T-Phase for guitar and presence color.",
        "- Export polished `drums.wav`, `bass.wav`, `other.wav`, or `mix.wav` to the daw-export folder.",
        "",
        "## Next Actions",
        "",
    ])
    for item in report.get("recommendations", []):
        lines.append(f"- {item}")

    lines.extend([
        "",
        "## Paths",
        "",
    ])
    for label, value in report.get("paths", {}).items():
        lines.append(f"- {label}: `{value}`")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _ep133_convert_audio(src: Path, dest: Path, *, channels: int, seconds: float | None = None) -> None:
    cmd: list[str | Path] = [resolve_ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", src]
    if seconds is not None:
        cmd.extend(["-t", f"{seconds:.3f}"])
    cmd.extend(["-ac", str(channels), "-ar", "46875", "-sample_fmt", "s16", dest])
    run(cmd)


def _write_ep133_pack_markdown(pack: dict[str, object], md_path: Path) -> None:
    paths = pack.get("paths", {})
    lines = [
        "# EP-133 K.O.II Transfer Pack",
        "",
        f"- Band/song: `{pack['band']}/{pack['song']}`",
        f"- Created: `{pack['created_at']}`",
        f"- Transfer folder: `{paths.get('transfer_dir', '')}`",
        f"- EP sample tool: {EP_SAMPLE_TOOL_URL}",
        "",
        "## Safety",
        "",
        "- This pack does not write to EP-133 by itself.",
        "- It does not change Band Room defaults, repo presets, DAW projects, or device projects.",
        "- Transfer and pad assignment still happen manually in the EP sample tool / EP-133.",
        "",
        "## Suggested Pad Map",
        "",
    ]
    for entry in pack.get("entries", []):
        if not isinstance(entry, dict):
            continue
        lines.append(
            f"- `{entry['slot']}` {entry['role']}: "
            f"`{entry['file']}` ({entry['kind']}, {entry['channels']}ch)"
        )

    lines.extend([
        "",
        "## Transfer Steps",
        "",
        "1. Open the EP sample tool in a WebMIDI-capable browser.",
        "2. Grant access to `EP-133` when the browser asks for MIDI/device permission.",
        "3. Drag the files from the transfer folder into the sample tool.",
        "4. Use the suggested pad map as the project layout; adjust on the device by ear.",
        "5. Keep the original EP-133 project backed up before replacing important samples.",
        "",
        "## Return Path",
        "",
        "- USB-C is the MIDI/sample-transfer lane.",
        "- Record audio from EP-133 through the 3.5 mm output into UR44/Sonar when the audio interface is available.",
        "- Export takes to `hardware-jam/captures` or `daw-export`, then review in Band Room external stems.",
        "",
        "## Paths",
        "",
    ])
    for label, value in paths.items():
        lines.append(f"- {label}: `{value}`")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_ep133_first_pass_markdown(session: dict[str, object], md_path: Path) -> None:
    paths = session.get("paths", {})
    lines = [
        "# EP-133 First Pass B Loops",
        "",
        f"- Band/song: `{session.get('band')}/{session.get('song')}`",
        f"- Created: `{session.get('created_at')}`",
        f"- Selected folder: `{paths.get('selected_dir', '')}`",
        f"- Source pack: `{paths.get('ep133_pack_dir', '')}`",
        "",
        "## Purpose",
        "",
        "Use this smaller folder for the first physical transfer test. Load only the four AI recreation loops before moving on to the full one-shot pack.",
        "",
        "## Before Transfer",
        "",
        "- [ ] EP sample tool can see `EP-133`.",
        "- [ ] Back up the current EP-133 project/sounds in the EP sample tool.",
        "- [ ] Confirm the device project/group you are willing to use for this test.",
        "",
        "## Transfer Targets",
        "",
        "| Done | Suggested pad | Role | File |",
        "|---|---|---|---|",
    ]
    for entry in session.get("entries", []):
        if not isinstance(entry, dict):
            continue
        lines.append(
            f"| [ ] | `{entry.get('slot')}` | {entry.get('role')} | `{entry.get('file')}` |"
        )

    lines.extend([
        "",
        "## After Transfer",
        "",
        "- [ ] Tap pads B01-B04 and confirm audio.",
        "- [ ] Try punch-in FX lightly.",
        "- [ ] Do not overwrite more sounds until the backup is confirmed.",
        "- [ ] Record what actually went to each pad in the Sonar/EP-133 handoff report.",
        "",
        "## Safety",
        "",
        "- This command only copies local WAV files into a smaller staging folder.",
        "- It does not write to EP-133, change projects, alter DAW state, or change Band Room defaults.",
        "",
        "## Paths",
        "",
    ])
    for label, value in paths.items():
        lines.append(f"- {label}: `{value}`")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _latest_child_dir(root: Path, prefix: str) -> Path | None:
    if not root.exists():
        return None
    candidates = [path for path in root.iterdir() if path.is_dir() and path.name.startswith(prefix)]
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def _latest_child_file(root: Path, prefix: str, suffix: str) -> Path | None:
    if not root.exists():
        return None
    candidates = [
        path
        for path in root.iterdir()
        if path.is_file() and path.name.startswith(prefix) and path.name.endswith(suffix)
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def _role_filename(band: str, song: str, source: str, role: str, take: int = 1) -> str:
    clean_source = re.sub(r"[^A-Za-z0-9_-]+", "-", source).strip("-").lower()
    clean_role = re.sub(r"[^A-Za-z0-9_-]+", "-", role).strip("-").lower()
    return f"{band}-{song}_{clean_source}_{clean_role}_take{take:02d}.wav"


def _write_sonar_ep133_handoff_markdown(report: dict[str, object], md_path: Path) -> None:
    paths = report.get("paths", {})
    env = report.get("environment", {})
    ep_entries = report.get("ep133_entries", [])
    lines = [
        "# Sonar / EP-133 / Band Room Handoff",
        "",
        f"- Band/song: `{report['band']}/{report['song']}`",
        f"- Created: `{report['created_at']}`",
        f"- Handoff folder: `{paths.get('handoff_dir', '')}`",
        "",
        "## Current State",
        "",
        f"- Sonar executable: `{env.get('sonar_exe', '')}`",
        f"- Ableton plugin modules/plugins: `{env.get('ableton_plugin_modules')}` / `{env.get('ableton_plugins')}`",
        f"- EP-133 visible devices: `{env.get('ep133_visible_count')}`",
        f"- UR44 visible devices: `{env.get('ur44_visible_count')}`",
        "",
        "## Sonar Import Map",
        "",
        "| Track | Source | Treatment | Export target |",
        "|---|---|---|---|",
    ]
    for item in report.get("sonar_tracks", []):
        if not isinstance(item, dict):
            continue
        lines.append(
            f"| {item['track']} | `{item['source']}` | {item['treatment']} | `{item['export_name']}` |"
        )

    cycle_recommendations = [
        str(item)
        for item in report.get("cycle_recommendations", [])
        if isinstance(item, str)
    ]
    if cycle_recommendations:
        lines.extend([
            "",
            "## Cycle Recommendations",
            "",
        ])
        for item in cycle_recommendations:
            lines.append(f"- {item}")

    lines.extend([
        "",
        "## First Polish Pass",
        "",
        "- Keep `mix.wav` as the reference track and do not export it as a replacement unless the whole balance improves.",
        "- Drums: tame air/cymbal harshness first; use Drum Replacer only where the source-derived kit feels thin.",
        "- Bass: tighten the low end with light EQ/comp; keep kick transients readable.",
        "- Other: use TH-U / Guitar Rig / L-Phase / T-Phase only as light color, not a full rewrite.",
        f"- Export polished stems to `{paths.get('daw_export_dir', '')}`.",
        "",
        "## EP-133 Transfer Checklist",
        "",
        f"- Transfer folder: `{paths.get('ep133_transfer_dir', '')}`",
        "- [ ] Open EP sample tool.",
        "- [ ] Grant browser MIDI/device permission for `EP-133`.",
        "- [ ] Back up the current EP-133 project before replacing important samples.",
        "- [ ] Transfer only the files intentionally selected from the transfer folder.",
        "- [ ] Confirm pad assignment on the device by ear.",
        "",
        "| Done | Slot | Role | File | Device pad / note |",
        "|---|---|---|---|---|",
    ])
    for entry in ep_entries:
        if not isinstance(entry, dict):
            continue
        lines.append(f"| [ ] | `{entry.get('slot')}` | {entry.get('role')} | `{entry.get('file')}` |  |")

    lines.extend([
        "",
        "## Band Room Return Naming",
        "",
        "| Role | File name | Band Room slot |",
        "|---|---|---|",
    ])
    for item in report.get("return_files", []):
        if not isinstance(item, dict):
            continue
        lines.append(f"| {item['role']} | `{item['filename']}` | `{item['band_room_slot']}` |")

    lines.extend([
        "",
        "## Manual Gates",
        "",
        "- EP-133 sample write, pad operation, project selection, cable moves, and ear checks need human confirmation.",
        "- Current gaming PC has no UR44 visible; EP-133 audio recording waits for UR44 / studio PC unless another audio interface is connected.",
        "- Ableton remains secondary until VST3 rescan registers plugins.",
        "",
        "## Paths",
        "",
    ])
    for label, value in paths.items():
        lines.append(f"- {label}: `{value}`")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _operator_self_command(args: argparse.Namespace, *subcommand: str | Path) -> list[str | Path]:
    return [
        sys.executable,
        "-X",
        "utf8",
        "scripts/worker-gaming-pipeline.py",
        "--worker-root",
        Path(args.worker_root).resolve(),
        *subcommand,
    ]


def _format_command(cmd: list[str | Path]) -> str:
    return " ".join(str(part) for part in cmd)


def _ai_recreation_required_files(args: argparse.Namespace) -> list[Path]:
    ai_dir = worker_path(args, "ai-recreation", args.band, args.song)
    return [
        ai_dir / "drums.mp3",
        ai_dir / "bass.mp3",
        ai_dir / "other.mp3",
        ai_dir / "mix.wav",
        ai_dir / "ai-recreation-report.json",
    ]


def _operator_artifacts(args: argparse.Namespace) -> dict[str, str]:
    reports_root = worker_path(args, "reports", args.band, args.song)
    worker_reports_root = worker_path(args, "reports")
    ep_root = worker_path(args, "hardware-jam", "ep133-inbox", args.band, args.song)
    snapshot_prefix = f"{args.snapshot_tag}-setup-snapshot-"
    latest_ep_pack = _latest_child_dir(ep_root, "ep133-pack-")
    latest_handoff = _latest_child_dir(reports_root, "sonar-ep133-handoff-")
    latest_cycle = _latest_child_dir(reports_root, "recreation-cycle-")
    latest_midi_setup = _latest_child_dir(worker_reports_root, "midi-cli-setup-")
    latest_sysex_probe = _latest_child_dir(worker_reports_root, "ep133-sysex-probe-")
    latest_snapshot_json = _latest_child_file(worker_path(args, "reports"), snapshot_prefix, ".json")
    latest_snapshot_md = _latest_child_file(worker_path(args, "reports"), snapshot_prefix, ".md")
    paths = {
        "ai_recreation_dir": str(worker_path(args, "ai-recreation", args.band, args.song)),
        "daw_export_dir": str(worker_path(args, "daw-export", args.band, args.song)),
        "hardware_capture_dir": str(worker_path(args, "hardware-jam", "captures", args.band, args.song)),
        "latest_midi_cli_setup": str(latest_midi_setup or ""),
        "latest_midi_cli_setup_report": str(latest_midi_setup / "midi-cli-setup.md") if latest_midi_setup else "",
        "latest_ep133_sysex_probe": str(latest_sysex_probe or ""),
        "latest_ep133_sysex_probe_report": str(latest_sysex_probe / "ep133-sysex-probe.md") if latest_sysex_probe else "",
        "latest_recreation_cycle": str(latest_cycle or ""),
        "latest_recreation_cycle_report": str(latest_cycle / "recreation-cycle-report.md") if latest_cycle else "",
        "latest_ep133_pack": str(latest_ep_pack or ""),
        "latest_ep133_transfer_dir": str(latest_ep_pack / "transfer") if latest_ep_pack else "",
        "latest_ep133_manifest": str(latest_ep_pack / "ep133-transfer-manifest.json") if latest_ep_pack else "",
        "latest_ep133_first_pass_dir": str(latest_ep_pack / "first-pass-B-loops") if latest_ep_pack else "",
        "latest_ep133_first_pass_report": str(latest_ep_pack / "first-pass-B-loops" / "EP133-first-pass-B-loops.md") if latest_ep_pack else "",
        "latest_sonar_ep133_handoff": str(latest_handoff or ""),
        "latest_sonar_ep133_handoff_report": str(latest_handoff / "sonar-ep133-handoff.md") if latest_handoff else "",
        "latest_setup_snapshot_json": str(latest_snapshot_json or ""),
        "latest_setup_snapshot_markdown": str(latest_snapshot_md or ""),
    }
    return paths


def _operator_manual_gates() -> list[str]:
    return [
        "EP-133 SysEx probe is read-only; any sample/project write remains manual",
        "EP sample tool browser permission for `EP-133`",
        "EP-133 project backup and any sample/project write",
        "Sonar import, playback, save, and export confirmation",
        "Band Room external-stem file selection and runtime A/B listening",
        "UR44 cable/gain setup and final ear check",
    ]


def _operator_step(purpose: str, cmd: list[str | Path], *, timeout: int) -> dict[str, object]:
    print(f"\n[{purpose}]")
    print(f"+ {_format_command(cmd)}", flush=True)
    started = time.monotonic()
    result = _capture_command(cmd, timeout=timeout)
    elapsed = round(time.monotonic() - started, 3)
    output = str(result.get("output") or "")
    if output:
        print(output)
    status = "OK" if result.get("returncode") == 0 else "FAILED"
    print(f"[{purpose}] {status} ({elapsed}s)", flush=True)
    return {
        "purpose": purpose,
        "command": result.get("command", [str(part) for part in cmd]),
        "returncode": result.get("returncode"),
        "duration_s": elapsed,
        "output": output,
    }


def _dashboard_page_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=0.8) as response:
            return 200 <= int(response.status) < 300
    except (OSError, urllib.error.URLError, TimeoutError):
        return False


def _port_is_listening(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _start_or_reuse_dashboard(args: argparse.Namespace, report_dir: Path) -> dict[str, object]:
    start_port = int(args.dashboard_port)
    page = "docs/music-hardware-dashboard.html"
    for port in range(start_port, start_port + 20):
        url = f"http://127.0.0.1:{port}/{page}"
        if _dashboard_page_ready(url):
            return {"url": url, "port": port, "reused": True, "ready": True}

    for port in range(start_port, start_port + 20):
        if _port_is_listening(port):
            continue
        log_dir = worker_path(args, "logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / f"music-hardware-dashboard-{datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
        flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
        with log_path.open("ab") as log:
            process = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                cwd=str(ROOT),
                stdout=log,
                stderr=subprocess.STDOUT,
                creationflags=flags,
            )
        url = f"http://127.0.0.1:{port}/{page}"
        for _ in range(10):
            if _dashboard_page_ready(url):
                break
            time.sleep(0.2)
        server_info = {
            "url": url,
            "port": port,
            "pid": process.pid,
            "reused": False,
            "ready": _dashboard_page_ready(url),
            "log": str(log_path),
            "note": "Started by operator-run; stop it manually only if you no longer need the local dashboard.",
        }
        (report_dir / "dashboard-server.json").write_text(
            json.dumps(server_info, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return server_info

    return {
        "url": "",
        "port": "",
        "reused": False,
        "ready": False,
        "error": f"no available dashboard port in {start_port}-{start_port + 19}",
    }


def _write_operator_run_markdown(report: dict[str, object], md_path: Path) -> None:
    paths = report.get("paths", {})
    dashboard = report.get("dashboard", {})
    lines = [
        "# Musicstack Operator Run",
        "",
        f"- Band/song: `{report.get('band')}/{report.get('song')}`",
        f"- Created: `{report.get('created_at')}`",
        f"- Report folder: `{paths.get('operator_run_dir', '')}`",
        f"- Worker root: `{report.get('worker_root')}`",
        "",
        "## Status",
        "",
    ]
    for item in report.get("commands", []):
        if not isinstance(item, dict):
            continue
        returncode = item.get("returncode")
        status = "OK" if returncode == 0 else f"FAILED ({returncode})"
        lines.append(f"- {item.get('purpose')}: {status}; {item.get('duration_s')}s")

    skipped = [item for item in report.get("skipped", []) if isinstance(item, dict)]
    if skipped:
        lines.extend(["", "## Skipped", ""])
        for item in skipped:
            lines.append(f"- {item.get('purpose')}: {item.get('reason')}")

    if dashboard:
        lines.extend([
            "",
            "## Dashboard",
            "",
            f"- URL: `{dashboard.get('url', '')}`",
            f"- Ready: `{dashboard.get('ready')}`",
            f"- Reused existing server: `{dashboard.get('reused')}`",
        ])
        if dashboard.get("pid"):
            lines.append(f"- Server PID: `{dashboard.get('pid')}`")

    lines.extend([
        "",
        "## Artifacts",
        "",
    ])
    for label, value in paths.items():
        lines.append(f"- {label}: `{value}`")

    lines.extend([
        "",
        "## Manual Gates",
        "",
    ])
    for item in report.get("manual_gates", []):
        lines.append(f"- {item}")

    lines.extend([
        "",
        "## Recommended Next Move",
        "",
        "1. Open the Sonar/EP-133 handoff Markdown and confirm the pad map.",
        "2. Use the EP sample tool only after backing up the EP-133 project.",
        "3. Import `drums.mp3`, `bass.mp3`, `other.mp3`, and `mix.wav` into Sonar for a light polish pass.",
        "4. Return exported or recorded takes to Band Room external stems for A/B review.",
        "",
        "## Policy",
        "",
        str(report.get("policy", "")),
        "",
    ])
    md_path.write_text("\n".join(lines), encoding="utf-8")


def command_check_daw(args: argparse.Namespace) -> None:
    """Inspect DAW and plugin state without touching app settings."""
    init_dirs(args)

    kontakt7_exe = Path(r"C:\Program Files\Native Instruments\Kontakt 7\Kontakt 7.exe")
    kontakt7_vst3 = Path(r"C:\Program Files\Common Files\VST3\Kontakt 7.vst3")
    kontakt6_vst3 = Path(r"C:\Program Files\Common Files\VST3\Kontakt.vst3")
    kontakt6_vst2 = Path(r"C:\Program Files\Native Instruments\VSTPlugins 64 bit\Kontakt.dll")
    kontakt7_db = Path(os.environ.get("LOCALAPPDATA", "")) / "Native Instruments" / "Kontakt 7" / "komplete.db3"
    ableton_prefs = _latest_ableton_preferences_dir()
    ableton_plugin_db = Path(os.environ.get("LOCALAPPDATA", "")) / "Ableton" / "Live Database" / "Live-plugins-1.db"
    uninstall_entries = _uninstall_registry_entries()
    product_center_exe = Path(r"C:\Program Files\Cakewalk\Product Center\ProductCenter.exe")
    sonar_exe = Path(r"C:\Program Files\Cakewalk\Sonar\Sonar.exe")
    cbb_exe = Path(r"C:\Program Files\Cakewalk\Cakewalk Core\Cakewalk.exe")
    cakewalk_core_vst3 = Path(r"C:\Program Files\Common Files\VST3\Cakewalk\Core")
    cakewalk_l_phase_vst3 = Path(r"C:\Program Files\Common Files\VST3\Cakewalk\L-Phase")
    cakewalk_soundbanks = Path(r"C:\ProgramData\Cakewalk\Plugins\Core\BandLab VST Shell\Soundbanks")

    print("\nNative Instruments")
    for label, path in [
        ("Kontakt 7 standalone", kontakt7_exe),
        ("Kontakt 7 VST3", kontakt7_vst3),
        ("Kontakt 6 VST3", kontakt6_vst3),
        ("Kontakt 6 VST2", kontakt6_vst2),
    ]:
        detail = path
        if path.exists() and path.is_file() and path.stat().st_size:
            detail = f"{path} ({path.stat().st_size:,} bytes)"
        print(f"  {label:<22} {'OK' if path.exists() else 'missing':<8} {detail}")

    content_paths = _sqlite_rows(
        kontakt7_db,
        "SELECT path, product_id FROM k_content_path ORDER BY path",
        limit=20,
    )
    sound_count = _sqlite_count(kontakt7_db, "k_sound_info")
    print(f"  {'Kontakt 7 content DB':<22} {'OK' if sound_count else 'missing':<8} {kontakt7_db}")
    if sound_count is not None:
        print(f"  {'Kontakt 7 sounds':<22} {sound_count}")
    for path, product_id in content_paths:
        print(f"    library: {path} [{product_id or 'user'}]")

    print("\nAbleton Live")
    print(f"  {'Preferences':<22} {'OK' if ableton_prefs else 'missing':<8} {ableton_prefs or ''}")
    if ableton_prefs:
        options = ableton_prefs / "Options.txt"
        option_lines = options.read_text(encoding="utf-8", errors="replace").splitlines() if options.exists() else []
        has_disable_gpu = "-DisableGraphicsHardwareAcceleration" in option_lines
        print(f"  {'Options.txt':<22} {'OK' if options.exists() else 'missing':<8} {options}")
        print(f"  {'Disable GPU option':<22} {'OK' if has_disable_gpu else 'missing':<8} -DisableGraphicsHardwareAcceleration")

    module_count = _sqlite_count(ableton_plugin_db, "plugin_modules")
    plugin_count = _sqlite_count(ableton_plugin_db, "plugins")
    plugin_rows = _sqlite_rows(
        ableton_plugin_db,
        "SELECT pm.path, p.name, p.vendor, p.version "
        "FROM plugin_modules pm LEFT JOIN plugins p ON p.module_id = pm.module_id "
        "ORDER BY pm.path, p.name",
        limit=20,
    )
    print(f"  {'Plugin DB':<22} {'OK' if ableton_plugin_db.exists() else 'missing':<8} {ableton_plugin_db}")
    print(f"  {'Plugin modules':<22} {module_count if module_count is not None else 'unknown'}")
    print(f"  {'Plugins':<22} {plugin_count if plugin_count is not None else 'unknown'}")
    for path, name, vendor, version in plugin_rows:
        print(f"    plugin: {name or '<module only>'} | {vendor or ''} | {version or ''} | {path}")

    kontakt_in_ableton = any(
        "Kontakt" in " ".join(str(part or "") for part in row)
        for row in plugin_rows
    )

    print("\nCakewalk / BandLab")
    product_center = _match_uninstall_entry(uninstall_entries, ["Cakewalk Product Center"])
    sonar = _match_uninstall_entry(uninstall_entries, ["Cakewalk Sonar"])
    legacy_cbb = _match_uninstall_entry(uninstall_entries, ["Cakewalk by BandLab"])
    bandlab_assistant = _match_uninstall_entry(uninstall_entries, ["BandLab Assistant"])
    _print_registry_item("Cakewalk Product Center", product_center, product_center_exe)
    _print_registry_item("Cakewalk Sonar", sonar, sonar_exe)
    for label, names, path in [
        ("Cakewalk Core Plugins", ["Cakewalk Core Plugins"], cakewalk_core_vst3),
        ("Studio Instruments Suite", ["Cakewalk Studio Instruments Suite"], Path(r"C:\Program Files\Cakewalk\Studio Instruments")),
        ("Sonar Drum Replacer", ["Sonar Drum Replacer"], Path(r"C:\Program Files\Cakewalk\Shared Utilities\Internal\Drum Replacer")),
        ("Session Drummer 3", ["Session Drummer 3"], None),
        ("TH-U", ["TH-U"], Path(r"C:\Program Files\Overloud\TH-U")),
        ("Help & Documentation", ["Cakewalk Help & Documentation"], None),
        ("Precision Suite", ["Cakewalk Precision Suite"], None),
        ("ProChannel Modules", ["Sonar ProChannel Modules"], Path(r"C:\Program Files\Cakewalk\Shared Utilities\Internal")),
        ("L-Phase / T-Phase plugins", ["L-Phase Plugins", "T-Phase Plugins"], cakewalk_l_phase_vst3),
    ]:
        _print_registry_item(label, _match_uninstall_entry(uninstall_entries, names), path)
    soundbank_count = _child_dir_count(cakewalk_soundbanks)
    soundbank_status = "OK" if soundbank_count else "missing"
    soundbank_detail = (
        f"{soundbank_count} folders | {cakewalk_soundbanks}"
        if soundbank_count is not None
        else str(cakewalk_soundbanks)
    )
    print(f"  {'BandLab soundbanks':<30} {soundbank_status:<8} {soundbank_detail}")
    _print_registry_item("Cakewalk by BandLab legacy", legacy_cbb, cbb_exe)
    if bandlab_assistant:
        print(f"  {'BandLab Assistant':<30} installed {_entry_detail(bandlab_assistant)}")
    else:
        print(f"  {'BandLab Assistant':<30} removed  Product Center is the current Cakewalk manager.")

    print("\nNext action")
    if kontakt7_vst3.exists() and not kontakt_in_ableton:
        print("  Ableton has not registered Kontakt yet.")
        print("  In Ableton: Settings/Preferences > Plug-Ins > turn VST3 System Folders On > Rescan.")
        print(r"  Optional legacy VST2 folder: C:\Program Files\Native Instruments\VSTPlugins 64 bit")
        print("  If the Preferences window is blank, keep Options.txt in place and retry from the PC screen.")
    else:
        print("  Kontakt appears available to Ableton's plugin database.")
    if sonar and sonar_exe.exists():
        print("  Sonar is ready as the Cakewalk lane for Band Room stem polish and Cakewalk add-ons.")
    if legacy_cbb:
        print("  Keep Cakewalk by BandLab as a deprecated fallback until shared Cakewalk components are reviewed.")


def load_band_registry() -> dict:
    registry_path = ROOT / "presets" / "bands.json"
    raw = json.loads(registry_path.read_text(encoding="utf-8"))
    merged = {}
    merged.update(raw.get("bands", {}))
    merged.update(raw.get("reference_libraries", {}))
    return merged


def sanitize_id(name: str) -> str:
    name = re.sub(r"^\d+\s*", "", name).strip()
    name = re.sub(r"[^\w\s-]", "", name)
    return re.sub(r"\s+", "-", name).lower()


def iter_audio_files(source: Path) -> list[Path]:
    if source.is_file() and source.suffix.lower() in AUDIO_EXTS:
        return [source]
    if not source.is_dir():
        raise SystemExit(f"source not found: {source}")
    return sorted(p for p in source.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTS)


def command_separate(args: argparse.Namespace) -> None:
    init_dirs(args)
    source = Path(args.source).resolve()
    files = iter_audio_files(source)
    if not files:
        raise SystemExit(f"no audio files found in {source}")

    band_id = args.band or sanitize_id(source.stem if source.is_file() else source.name)
    out_root = worker_path(args, "stems", band_id)
    out_root.mkdir(parents=True, exist_ok=True)
    print(f"band: {band_id}")
    print(f"source files: {len(files)}")
    print(f"output: {out_root}")

    for src in files:
        song_id = sanitize_id(src.stem)
        print(f"\n=== {src.name} -> {song_id} ===")
        with tempfile.TemporaryDirectory(dir=str(worker_path(args, "tmp"))) as tmp_dir:
            wav_path = Path(tmp_dir) / f"{song_id}.wav"
            run([resolve_ffmpeg(), "-y", "-i", src, "-ac", "2", "-ar", "44100", "-vn", wav_path])
            run([
                sys.executable,
                "-m",
                "demucs",
                "--mp3",
                "--mp3-bitrate",
                str(args.mp3_bitrate),
                "-n",
                args.model,
                "-o",
                out_root,
                "--filename",
                f"{song_id}/{{stem}}.{{ext}}",
                wav_path,
            ])

    print("\nDone. Review output outside the repo before importing anything into Music.")


def command_ai_render(args: argparse.Namespace) -> None:
    init_dirs(args)
    run([
        sys.executable,
        "-X",
        "utf8",
        "scripts/render-bandroom-ai-recreation.py",
        args.band,
        args.song,
        "--output-root",
        worker_path(args, "ai-recreation"),
    ])


def command_batch_ai_render(args: argparse.Namespace) -> None:
    init_dirs(args)
    registry = load_band_registry()
    band_ids = [args.band] if args.band else sorted(registry)
    for band_id in band_ids:
        band = registry.get(band_id)
        if not band:
            raise SystemExit(f"band not found: {band_id}")
        for song in band.get("songs", []):
            song_id = song.get("id")
            if not song_id:
                continue
            run([
                sys.executable,
                "-X",
                "utf8",
                "scripts/render-bandroom-ai-recreation.py",
                band_id,
                song_id,
                "--output-root",
                worker_path(args, "ai-recreation"),
            ], check=not args.keep_going)


def command_recreation_cycle(args: argparse.Namespace) -> None:
    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_dir = worker_path(args, "reports", args.band, args.song, f"recreation-cycle-{timestamp}")
    report_dir.mkdir(parents=True, exist_ok=True)
    ai_root = worker_path(args, "ai-recreation")
    ai_dir = ai_root / args.band / args.song
    daw_export_dir = worker_path(args, "daw-export", args.band, args.song)
    daw_export_dir.mkdir(parents=True, exist_ok=True)

    commands: list[dict[str, object]] = []
    render_cmd: list[str | Path] = [
        sys.executable,
        "-X",
        "utf8",
        "scripts/render-bandroom-ai-recreation.py",
        args.band,
        args.song,
        "--output-root",
        ai_root,
    ]
    if args.profile:
        render_cmd.extend(["--profile", args.profile])
    if args.force:
        render_cmd.append("--force")
    commands.append({"purpose": "ai-render", "command": [str(part) for part in render_cmd]})
    run(render_cmd)

    target_analysis: dict = {}
    target_analysis_path = report_dir / "target-spec.json"
    if args.with_analysis:
        analyze_cmd: list[str | Path] = [
            sys.executable,
            "-X",
            "utf8",
            "scripts/analyze-band-stems.py",
            f"{args.band}/{args.song}",
            "--out",
            target_analysis_path,
        ]
        commands.append({"purpose": "target-analysis", "command": [str(part) for part in analyze_cmd]})
        run(analyze_cmd)
        target_analysis = _read_json(target_analysis_path)

    drum_candidate_path = report_dir / f"drum-frames-{args.band}-{args.song}.candidate.json"
    if args.with_drum_candidate:
        drum_cmd: list[str | Path] = [
            sys.executable,
            "-X",
            "utf8",
            "scripts/_extract_drum_patterns.py",
            args.band,
            args.song,
            "--out",
            drum_candidate_path,
        ]
        commands.append({"purpose": "drum-frame-candidate", "command": [str(part) for part in drum_cmd]})
        run(drum_cmd)

    render_report_path = ai_dir / "ai-recreation-report.json"
    render_report = _read_json(render_report_path)
    ai_mix = render_report.get("outputs", {}).get("mix.wav", {})
    target_mix = _target_mix_summary(target_analysis, args.band, args.song)
    cycle_report = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "band": args.band,
        "song": args.song,
        "commands": commands,
        "paths": {
            "ai_recreation_dir": str(ai_dir),
            "daw_export_dir": str(daw_export_dir),
            "report_dir": str(report_dir),
            "render_report": str(render_report_path),
            "target_analysis": str(target_analysis_path) if target_analysis_path.exists() else "",
            "drum_candidate": str(drum_candidate_path) if drum_candidate_path.exists() else "",
        },
        "render_report": render_report,
        "comparison": {
            "ai_mix": ai_mix,
            "target_mix": target_mix,
        },
        "recommendations": _cycle_recommendations(render_report, target_analysis, args.band, args.song),
        "promotion_policy": (
            "Generated audio, DAW projects, plugin state, and cycle reports stay outside Git. "
            "Promote only reviewed metadata, candidate JSON, docs, or code intentionally."
        ),
    }
    json_path = report_dir / "recreation-cycle-report.json"
    md_path = report_dir / "recreation-cycle-report.md"
    json_path.write_text(json.dumps(cycle_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _write_recreation_cycle_markdown(cycle_report, md_path)
    print(f"recreation cycle JSON: {json_path}")
    print(f"recreation cycle Markdown: {md_path}")
    if args.open_report and sys.platform.startswith("win"):
        os.startfile(md_path)  # type: ignore[attr-defined]


def command_ep133_pack(args: argparse.Namespace) -> None:
    """Prepare a non-destructive EP-133 sample transfer pack outside the repo."""
    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    pack_dir = worker_path(args, "hardware-jam", "ep133-inbox", args.band, args.song, f"ep133-pack-{timestamp}")
    transfer_dir = pack_dir / "transfer"
    transfer_dir.mkdir(parents=True, exist_ok=True)

    source_kit_dir = ROOT / "presets" / "sample-kits" / args.band / args.song
    if not source_kit_dir.exists():
        raise SystemExit(f"sample kit not found: {source_kit_dir}")

    ai_dir = worker_path(args, "ai-recreation", args.band, args.song)
    if args.render_ai and not (ai_dir / "mix.wav").exists():
        run([
            sys.executable,
            "-X",
            "utf8",
            "scripts/render-bandroom-ai-recreation.py",
            args.band,
            args.song,
            "--output-root",
            worker_path(args, "ai-recreation"),
        ])

    plan = [
        ("A01", "kick", "kick-01.wav", "one-shot", 1, None),
        ("A02", "snare", "snare-01.wav", "one-shot", 1, None),
        ("A03", "closed-hat", "hat-01.wav", "one-shot", 1, None),
        ("A04", "open-hat", "hat-02.wav", "one-shot", 1, None),
        ("A05", "tom", "tom-01.wav", "one-shot", 1, None),
        ("A06", "crash", "crash-01.wav", "one-shot", 1, None),
        ("A07", "texture", "other-01.wav", "one-shot", 1, None),
        ("A08", "texture-alt", "other-02.wav", "one-shot", 1, None),
        ("A09", "vocal-phrase", "vocal-phrase-01.wav", "phrase", 1, None),
        ("A10", "vocal-phrase-alt", "vocal-phrase-02.wav", "phrase", 1, None),
    ]
    entries: list[dict[str, object]] = []
    for slot, role, filename, kind, channels, seconds in plan:
        src = source_kit_dir / filename
        if not src.exists():
            continue
        dest = transfer_dir / f"{slot}_{role}_{filename}"
        _ep133_convert_audio(src, dest, channels=channels, seconds=seconds)
        entries.append({
            "slot": slot,
            "role": role,
            "kind": kind,
            "channels": channels,
            "file": dest.name,
            "source": str(src),
            "path": str(dest),
        })

    if args.include_ai_recreation:
        loop_plan = [
            ("B01", "drums-loop", "drums.mp3"),
            ("B02", "bass-loop", "bass.mp3"),
            ("B03", "other-loop", "other.mp3"),
            ("B04", "rough-mix-loop", "mix.wav"),
        ]
        for slot, role, filename in loop_plan:
            src = ai_dir / filename
            if not src.exists():
                print(f"skip missing AI recreation source: {src}")
                continue
            dest = transfer_dir / f"{slot}_{role}_{args.loop_seconds:.1f}s.wav"
            _ep133_convert_audio(src, dest, channels=2, seconds=args.loop_seconds)
            entries.append({
                "slot": slot,
                "role": role,
                "kind": "loop",
                "channels": 2,
                "seconds": args.loop_seconds,
                "file": dest.name,
                "source": str(src),
                "path": str(dest),
            })

    if not entries:
        raise SystemExit("no EP-133 pack entries were created")

    manifest = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "band": args.band,
        "song": args.song,
        "device_policy": (
            "This command only prepares local transfer files outside Git. "
            "It does not write to EP-133, alter Band Room defaults, or change DAW/plugin state."
        ),
        "format": {
            "sample_rate_hz": 46875,
            "sample_format": "16-bit PCM WAV",
            "note": "EP sample tool can still convert on import; this pack is pre-normalized for a predictable handoff.",
        },
        "paths": {
            "pack_dir": str(pack_dir),
            "transfer_dir": str(transfer_dir),
            "source_kit_dir": str(source_kit_dir),
            "ai_recreation_dir": str(ai_dir),
            "manifest": str(pack_dir / "ep133-transfer-manifest.json"),
            "markdown": str(pack_dir / "ep133-transfer-pack.md"),
        },
        "official_refs": [
            "https://teenage.engineering/guides/ep-133/hardware-overview",
            EP_SAMPLE_TOOL_URL,
            "https://teenage.engineering/guides/ep-133/system",
        ],
        "entries": entries,
    }
    json_path = pack_dir / "ep133-transfer-manifest.json"
    md_path = pack_dir / "ep133-transfer-pack.md"
    json_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_ep133_pack_markdown(manifest, md_path)
    print(f"EP-133 transfer folder: {transfer_dir}")
    print(f"EP-133 manifest: {json_path}")
    print(f"EP-133 Markdown: {md_path}")
    if args.open_folder and sys.platform.startswith("win"):
        os.startfile(transfer_dir)  # type: ignore[attr-defined]
    if args.open_sample_tool and sys.platform.startswith("win"):
        os.startfile(EP_SAMPLE_TOOL_URL)  # type: ignore[attr-defined]


def command_ep133_first_pass(args: argparse.Namespace) -> None:
    """Stage a small first-transfer folder from an existing EP-133 pack."""
    init_dirs(args)
    ep_root = worker_path(args, "hardware-jam", "ep133-inbox", args.band, args.song)
    ep_pack_dir = Path(args.ep133_pack).resolve() if args.ep133_pack else _latest_child_dir(ep_root, "ep133-pack-")
    if not ep_pack_dir:
        raise SystemExit("no EP-133 pack found; run ep133-pack first")

    manifest_path = ep_pack_dir / "ep133-transfer-manifest.json"
    manifest = _read_json(manifest_path)
    entries = manifest.get("entries", []) if isinstance(manifest, dict) else []
    wanted_slots = {slot.upper() for slot in args.slots}
    selected_entries = [
        entry for entry in entries
        if isinstance(entry, dict) and str(entry.get("slot", "")).upper() in wanted_slots
    ]
    if not selected_entries:
        raise SystemExit(f"no matching slots found in {manifest_path}: {', '.join(args.slots)}")

    transfer_dir = ep_pack_dir / "transfer"
    selected_dir = ep_pack_dir / args.output_name
    selected_dir.mkdir(parents=True, exist_ok=True)
    copied_entries: list[dict[str, object]] = []
    for entry in selected_entries:
        filename = str(entry.get("file") or "")
        src = transfer_dir / filename
        if not src.exists():
            print(f"skip missing transfer file: {src}")
            continue
        dest = selected_dir / filename
        shutil.copy2(src, dest)
        copied = dict(entry)
        copied["path"] = str(dest)
        copied_entries.append(copied)

    if not copied_entries:
        raise SystemExit("no EP-133 first-pass files were copied")

    session = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "band": args.band,
        "song": args.song,
        "slots": args.slots,
        "entries": copied_entries,
        "paths": {
            "ep133_pack_dir": str(ep_pack_dir),
            "manifest": str(manifest_path),
            "transfer_dir": str(transfer_dir),
            "selected_dir": str(selected_dir),
            "json": str(selected_dir / "EP133-first-pass-B-loops.json"),
            "markdown": str(selected_dir / "EP133-first-pass-B-loops.md"),
        },
        "policy": (
            "Local staging only. This command does not write to EP-133, change projects, "
            "alter DAW state, or change Band Room defaults."
        ),
    }
    json_path = selected_dir / "EP133-first-pass-B-loops.json"
    md_path = selected_dir / "EP133-first-pass-B-loops.md"
    json_path.write_text(json.dumps(session, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_ep133_first_pass_markdown(session, md_path)
    print(f"EP-133 first-pass folder: {selected_dir}")
    print(f"EP-133 first-pass JSON: {json_path}")
    print(f"EP-133 first-pass Markdown: {md_path}")
    if args.open_folder and sys.platform.startswith("win"):
        os.startfile(selected_dir)  # type: ignore[attr-defined]
    if args.open_sample_tool and sys.platform.startswith("win"):
        os.startfile(EP_SAMPLE_TOOL_URL)  # type: ignore[attr-defined]


def command_sonar_ep133_handoff(args: argparse.Namespace) -> None:
    """Write a local Sonar/EP-133/Band Room operator checklist outside Git."""
    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    handoff_dir = worker_path(args, "reports", args.band, args.song, f"sonar-ep133-handoff-{timestamp}")
    handoff_dir.mkdir(parents=True, exist_ok=True)

    ai_dir = worker_path(args, "ai-recreation", args.band, args.song)
    daw_export_dir = worker_path(args, "daw-export", args.band, args.song)
    capture_dir = worker_path(args, "hardware-jam", "captures", args.band, args.song)
    daw_export_dir.mkdir(parents=True, exist_ok=True)
    capture_dir.mkdir(parents=True, exist_ok=True)

    ep_root = worker_path(args, "hardware-jam", "ep133-inbox", args.band, args.song)
    ep_pack_dir = Path(args.ep133_pack).resolve() if args.ep133_pack else _latest_child_dir(ep_root, "ep133-pack-")
    ep_transfer_dir = ep_pack_dir / "transfer" if ep_pack_dir else Path("")
    ep_manifest_path = ep_pack_dir / "ep133-transfer-manifest.json" if ep_pack_dir else Path("")
    ep_manifest = _read_json(ep_manifest_path)
    ep_entries = ep_manifest.get("entries", []) if isinstance(ep_manifest, dict) else []

    latest_cycle_dir = (
        Path(args.recreation_cycle).resolve()
        if args.recreation_cycle
        else _latest_child_dir(worker_path(args, "reports", args.band, args.song), "recreation-cycle-")
    )
    cycle_report_path = latest_cycle_dir / "recreation-cycle-report.json" if latest_cycle_dir else Path("")
    cycle_report = _read_json(cycle_report_path)

    sonar_tracks = [
        {
            "track": "01 reference mix",
            "source": str(ai_dir / "mix.wav"),
            "treatment": "reference only; keep low or muted during export",
            "export_name": "mix-reference.wav",
        },
        {
            "track": "02 drums",
            "source": str(ai_dir / "drums.mp3"),
            "treatment": "tame air/cymbals; light transient cleanup",
            "export_name": "drums.wav",
        },
        {
            "track": "03 bass",
            "source": str(ai_dir / "bass.mp3"),
            "treatment": "light EQ/comp; keep kick space",
            "export_name": "bass.wav",
        },
        {
            "track": "04 other",
            "source": str(ai_dir / "other.mp3"),
            "treatment": "light color with TH-U/Guitar Rig/L-Phase/T-Phase",
            "export_name": "other.wav",
        },
    ]
    return_files = [
        {
            "role": "EP-133 drums / beat",
            "filename": _role_filename(args.band, args.song, "ep133", "drums"),
            "band_room_slot": "external drums",
        },
        {
            "role": "EP-133 bass-like loop",
            "filename": _role_filename(args.band, args.song, "ep133", "bass"),
            "band_room_slot": "external bass",
        },
        {
            "role": "EP-133 guitar / noise / texture",
            "filename": _role_filename(args.band, args.song, "ep133", "other"),
            "band_room_slot": "external other",
        },
        {
            "role": "EP-133 vocal phrase",
            "filename": _role_filename(args.band, args.song, "ep133", "vocal"),
            "band_room_slot": "external vocal",
        },
    ]

    pnp_devices = _windows_pnp_devices()
    sound_devices = _windows_sound_devices()
    ep_keywords = ["EP-133", "EP133", "K.O.II", "KO II", "teenage engineering"]
    ur44_keywords = ["UR44", "Yamaha Steinberg", "Steinberg UR"]
    ableton_plugin_db = Path(os.environ.get("LOCALAPPDATA", "")) / "Ableton" / "Live Database" / "Live-plugins-1.db"
    environment = {
        "sonar_exe": str(Path(r"C:\Program Files\Cakewalk\Sonar\Sonar.exe")),
        "sonar_exe_exists": Path(r"C:\Program Files\Cakewalk\Sonar\Sonar.exe").exists(),
        "ableton_plugin_modules": _sqlite_count(ableton_plugin_db, "plugin_modules"),
        "ableton_plugins": _sqlite_count(ableton_plugin_db, "plugins"),
        "ep133_visible_count": len([device for device in pnp_devices if _matches_device(device, ep_keywords)]),
        "ur44_visible_count": len([device for device in pnp_devices + sound_devices if _matches_device(device, ur44_keywords)]),
    }

    recommendations = []
    if cycle_report:
        recommendations = [
            str(item)
            for item in cycle_report.get("recommendations", [])
            if isinstance(item, str)
        ]

    handoff = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "band": args.band,
        "song": args.song,
        "paths": {
            "handoff_dir": str(handoff_dir),
            "ai_recreation_dir": str(ai_dir),
            "daw_export_dir": str(daw_export_dir),
            "hardware_capture_dir": str(capture_dir),
            "ep133_pack_dir": str(ep_pack_dir or ""),
            "ep133_transfer_dir": str(ep_transfer_dir) if ep_pack_dir else "",
            "ep133_manifest": str(ep_manifest_path) if ep_pack_dir else "",
            "latest_recreation_cycle": str(latest_cycle_dir or ""),
            "recreation_cycle_report": str(cycle_report_path) if latest_cycle_dir else "",
            "json": str(handoff_dir / "sonar-ep133-handoff.json"),
            "markdown": str(handoff_dir / "sonar-ep133-handoff.md"),
        },
        "environment": environment,
        "sonar_tracks": sonar_tracks,
        "ep133_entries": ep_entries,
        "return_files": return_files,
        "cycle_recommendations": recommendations,
        "policy": (
            "This report is an operator checklist only. It does not write to EP-133, "
            "alter DAW projects, change Band Room defaults, send MIDI, or record audio."
        ),
    }
    json_path = handoff_dir / "sonar-ep133-handoff.json"
    md_path = handoff_dir / "sonar-ep133-handoff.md"
    json_path.write_text(json.dumps(handoff, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_sonar_ep133_handoff_markdown(handoff, md_path)
    print(f"Sonar/EP-133 handoff JSON: {json_path}")
    print(f"Sonar/EP-133 handoff Markdown: {md_path}")
    if not ep_pack_dir:
        print("warning: no EP-133 pack found; run ep133-pack first.")
    if not latest_cycle_dir:
        print("warning: no recreation cycle found; run recreation-cycle first.")
    if args.open_report and sys.platform.startswith("win"):
        os.startfile(md_path)  # type: ignore[attr-defined]


def command_operator_run(args: argparse.Namespace) -> None:
    """Run the safe worker-gaming music hardware loop and write one aggregate report."""
    ai_missing = [path for path in _ai_recreation_required_files(args) if not path.exists()]
    latest_cycle = _latest_child_dir(worker_path(args, "reports", args.band, args.song), "recreation-cycle-")
    steps: list[tuple[str, list[str | Path], int]] = [
        ("check-env", _operator_self_command(args, "check-env"), 180),
        ("check-daw", _operator_self_command(args, "check-daw"), 180),
        ("check-hardware", _operator_self_command(args, "check-hardware"), 180),
    ]
    skipped: list[dict[str, str]] = []

    if args.force_recreation or ai_missing:
        recreation_cmd = _operator_self_command(
            args,
            "recreation-cycle",
            args.band,
            args.song,
            "--with-analysis",
            "--with-drum-candidate",
        )
        if args.force_recreation:
            recreation_cmd.append("--force")
        steps.append(("recreation-cycle", recreation_cmd, 1800))
    else:
        reason = "AI recreation stems already exist; rerun with --force-recreation when a fresh render is needed."
        if not latest_cycle:
            reason += " No recreation-cycle report was found, but operator-run avoids rerendering existing audio by default."
        skipped.append({"purpose": "recreation-cycle", "reason": reason})

    if args.no_midi_probe:
        skipped.append({"purpose": "ep133-sysex-probe", "reason": "--no-midi-probe was specified."})
    else:
        steps.extend([
            ("setup-midi-cli", _operator_self_command(args, "setup-midi-cli"), 240),
            ("ep133-sysex-probe", _operator_self_command(args, "ep133-sysex-probe"), 60),
        ])

    if args.no_ep133_pack:
        skipped.append({"purpose": "ep133-pack", "reason": "--no-ep133-pack was specified."})
    else:
        steps.append((
            "ep133-pack",
            _operator_self_command(args, "ep133-pack", args.band, args.song, "--include-ai-recreation"),
            600,
        ))
        if args.no_ep133_first_pass:
            skipped.append({"purpose": "ep133-first-pass", "reason": "--no-ep133-first-pass was specified."})
        else:
            steps.append((
                "ep133-first-pass",
                _operator_self_command(args, "ep133-first-pass", args.band, args.song),
                120,
            ))

    if args.no_handoff:
        skipped.append({"purpose": "sonar-ep133-handoff", "reason": "--no-handoff was specified."})
    else:
        steps.append((
            "sonar-ep133-handoff",
            _operator_self_command(args, "sonar-ep133-handoff", args.band, args.song),
            240,
        ))

    if args.no_snapshot:
        skipped.append({"purpose": "snapshot-setup", "reason": "--no-snapshot was specified."})
    else:
        steps.append((
            "snapshot-setup",
            _operator_self_command(args, "snapshot-setup", "--tag", args.snapshot_tag),
            240,
        ))

    if args.dry_run:
        print(f"operator-run dry run: {args.band}/{args.song}")
        print("No commands will be executed and no report will be written.")
        if ai_missing:
            print("Missing AI recreation files:")
            for path in ai_missing:
                print(f"  - {path}")
        for purpose, cmd, _timeout in steps:
            print(f"- {purpose}: {_format_command(cmd)}")
        for item in skipped:
            print(f"- skip {item['purpose']}: {item['reason']}")
        return

    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_dir = worker_path(args, "reports", args.band, args.song, f"operator-run-{timestamp}")
    report_dir.mkdir(parents=True, exist_ok=True)

    command_results = [_operator_step(purpose, cmd, timeout=timeout) for purpose, cmd, timeout in steps]
    dashboard: dict[str, object] = {}
    if args.open_dashboard:
        dashboard = _start_or_reuse_dashboard(args, report_dir)
        url = str(dashboard.get("url") or "")
        if url and sys.platform.startswith("win"):
            os.startfile(url)  # type: ignore[attr-defined]

    paths = _operator_artifacts(args)
    paths.update({
        "operator_run_dir": str(report_dir),
        "operator_run_json": str(report_dir / "operator-run.json"),
        "operator_run_markdown": str(report_dir / "operator-run.md"),
    })
    report = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "band": args.band,
        "song": args.song,
        "worker_root": str(Path(args.worker_root).resolve()),
        "commands": command_results,
        "skipped": skipped,
        "paths": paths,
        "dashboard": dashboard,
        "manual_gates": _operator_manual_gates(),
        "policy": (
            "operator-run only orchestrates repo/worker-safe steps. It may send the read-only EP-133 "
            "device-info SysEx probe, but it does not write to EP-133, alter Sonar or Ableton projects, "
            "change Band Room defaults, send sample/project-write MIDI, or record audio."
        ),
    }
    json_path = report_dir / "operator-run.json"
    md_path = report_dir / "operator-run.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_operator_run_markdown(report, md_path)
    print(f"\noperator-run JSON: {json_path}")
    print(f"operator-run Markdown: {md_path}")

    if args.open_folder and sys.platform.startswith("win"):
        os.startfile(report_dir)  # type: ignore[attr-defined]
    if args.open_sample_tool and sys.platform.startswith("win"):
        os.startfile(EP_SAMPLE_TOOL_URL)  # type: ignore[attr-defined]

    failed = [item for item in command_results if item.get("returncode") != 0]
    if failed:
        raise SystemExit(1)


def command_analyze(args: argparse.Namespace) -> None:
    init_dirs(args)
    out_file = Path(args.out).resolve() if args.out else worker_path(args, "reports", "target-spec-bands.json")
    cmd = [sys.executable, "-X", "utf8", "scripts/analyze-band-stems.py", *args.targets, "--out", out_file]
    run(cmd)


def command_extract_drum_candidate(args: argparse.Namespace) -> None:
    init_dirs(args)
    out_dir = Path(args.out).resolve() if args.out else worker_path(args, "reports", "drum-frame-candidates")
    run([
        sys.executable,
        "-X",
        "utf8",
        "scripts/_extract_drum_patterns.py",
        args.band,
        args.target,
        "--out",
        out_dir,
    ])


def command_stack_check(_: argparse.Namespace) -> None:
    run(["node", "scripts/stack-check.mjs"])


def command_setup_midi_cli(args: argparse.Namespace) -> None:
    """Install fixed SendMIDI/ReceiveMIDI builds into the repo-external worker tool cache."""
    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    tools_root = worker_path(args, "tools", "midi-cli")
    tools_root.mkdir(parents=True, exist_ok=True)
    report_dir = worker_path(args, "reports", f"midi-cli-setup-{timestamp}")
    report_dir.mkdir(parents=True, exist_ok=True)

    items = []
    for name, meta in MIDI_CLI_TOOLS.items():
        version = str(meta["version"])
        url = str(meta["url"])
        expected_sha = str(meta["sha256"]).upper()
        install_dir = tools_root / f"{name}-{version}"
        zip_path = tools_root / f"{name}-windows-{version}.zip"
        exe_path = install_dir / Path(meta["exe"])
        status = "present"
        if args.force or not exe_path.exists():
            status = "downloaded"
            print(f"download {name} {version}: {url}")
            urllib.request.urlretrieve(url, zip_path)
            actual_sha = _sha256_file(zip_path)
            if actual_sha != expected_sha:
                raise SystemExit(f"SHA256 mismatch for {zip_path}: {actual_sha} != {expected_sha}")
            if install_dir.exists() and args.force:
                shutil.rmtree(install_dir)
            install_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(zip_path) as archive:
                archive.extractall(install_dir)
        elif zip_path.exists() and _sha256_file(zip_path) != expected_sha:
            raise SystemExit(f"SHA256 mismatch for existing {zip_path}")

        items.append({
            "name": name,
            "version": version,
            "status": status,
            "url": url,
            "sha256": expected_sha,
            "zip": str(zip_path),
            "install_dir": str(install_dir),
            "exe": str(exe_path),
            "exe_exists": exe_path.exists(),
        })

    report = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "worker_root": str(Path(args.worker_root).resolve()),
        "tools_root": str(tools_root),
        "items": items,
        "next_command": (
            f"{sys.executable} -X utf8 scripts\\worker-gaming-pipeline.py "
            "ep133-sysex-probe"
        ),
    }
    json_path = report_dir / "midi-cli-setup.json"
    md_path = report_dir / "midi-cli-setup.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# MIDI CLI Setup",
        "",
        f"- Created: `{report['created_at']}`",
        f"- Tools root: `{tools_root}`",
        "",
        "## Tools",
        "",
    ]
    for item in items:
        lines.append(
            f"- {item['name']} {item['version']}: {item['status']}; "
            f"exists={item['exe_exists']}; `{item['exe']}`"
        )
    lines.extend([
        "",
        "## Next",
        "",
        "```powershell",
        "python -X utf8 scripts\\worker-gaming-pipeline.py ep133-sysex-probe",
        "```",
        "",
    ])
    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"MIDI CLI setup JSON: {json_path}")
    print(f"MIDI CLI setup Markdown: {md_path}")
    for item in items:
        print(f"{item['name']}: {item['status']} - {item['exe']}")


def command_ep133_sysex_probe(args: argparse.Namespace) -> None:
    """Run a read-only EP-133 SysEx connectivity probe through SendMIDI/ReceiveMIDI."""
    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_dir = worker_path(args, "reports", f"ep133-sysex-probe-{timestamp}")
    report_dir.mkdir(parents=True, exist_ok=True)

    sendmidi = _find_worker_tool(args, "sendmidi.exe", args.sendmidi)
    receivemidi = _find_worker_tool(args, "receivemidi.exe", args.receivemidi)
    if not sendmidi or not receivemidi:
        raise SystemExit(
            "sendmidi.exe and receivemidi.exe are required. "
            "Put them under worker-root\\tools\\midi-cli or pass --sendmidi/--receivemidi."
        )

    request_syx = report_dir / "ep133-device-info-request.syx"
    response_syx = report_dir / "ep133-device-info-response.syx"
    recv_stdout = report_dir / "receivemidi.stdout.txt"
    recv_stderr = report_dir / "receivemidi.stderr.txt"
    send_stdout = report_dir / "sendmidi.stdout.txt"
    send_stderr = report_dir / "sendmidi.stderr.txt"
    json_path = report_dir / "ep133-sysex-probe.json"
    md_path = report_dir / "ep133-sysex-probe.md"
    request_syx.write_bytes(EP133_DEVICE_INFO_REQUEST_SYX)

    send_list = _capture_command([sendmidi, "list"])
    receive_list = _capture_command([receivemidi, "list"])
    (report_dir / "sendmidi-list.txt").write_text(str(send_list.get("output") or "") + "\n", encoding="utf-8")
    (report_dir / "receivemidi-list.txt").write_text(str(receive_list.get("output") or "") + "\n", encoding="utf-8")

    flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
    process = None
    with recv_stdout.open("w", encoding="utf-8", errors="replace") as stdout, recv_stderr.open(
        "w", encoding="utf-8", errors="replace"
    ) as stderr:
        try:
            process = subprocess.Popen(
                [str(receivemidi), "dev", args.device, "hex", "syx", "syf", str(response_syx)],
                cwd=str(ROOT),
                stdout=stdout,
                stderr=stderr,
                creationflags=flags,
            )
            time.sleep(max(0.1, args.warmup_seconds))
            send_result = subprocess.run(
                [str(sendmidi), "dev", args.device, "syf", str(request_syx)],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=max(5, int(args.send_timeout_seconds)),
            )
            send_stdout.write_text(send_result.stdout or "", encoding="utf-8")
            send_stderr.write_text(send_result.stderr or "", encoding="utf-8")
            time.sleep(max(0.1, args.capture_seconds))
        finally:
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)

    response_bytes = response_syx.stat().st_size if response_syx.exists() else 0
    status = "OK" if response_bytes > 0 else "NO_RESPONSE"
    report = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "status": status,
        "device": args.device,
        "worker_root": str(Path(args.worker_root).resolve()),
        "tools": {
            "sendmidi": str(sendmidi),
            "receivemidi": str(receivemidi),
        },
        "device_lists": {
            "sendmidi": send_list,
            "receivemidi": receive_list,
        },
        "response_bytes": response_bytes,
        "device_info": _parse_ep133_device_info_syx(response_syx),
        "paths": {
            "report_dir": str(report_dir),
            "json": str(json_path),
            "markdown": str(md_path),
            "request_syx": str(request_syx),
            "response_syx": str(response_syx),
            "send_stdout": str(send_stdout),
            "send_stderr": str(send_stderr),
            "receive_stdout": str(recv_stdout),
            "receive_stderr": str(recv_stderr),
        },
        "safety_policy": (
            "Read-only probe. Sends only the EP-133 device-info SysEx request; "
            "does not transfer samples, delete sounds, change projects, or alter Band Room defaults."
        ),
    }
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_ep133_sysex_probe_markdown(report, md_path)
    print(f"EP-133 SysEx probe status: {status}")
    print(f"EP-133 response bytes: {response_bytes}")
    print(f"EP-133 SysEx probe JSON: {json_path}")
    print(f"EP-133 SysEx probe Markdown: {md_path}")
    if args.open_report and sys.platform.startswith("win"):
        os.startfile(md_path)  # type: ignore[attr-defined]


def command_check_hardware(args: argparse.Namespace) -> None:
    """Inspect attached music hardware that Windows can see."""
    init_dirs(args)
    pnp_devices = _windows_pnp_devices()
    sound_devices = _windows_sound_devices()

    ep_keywords = ["EP-133", "EP133", "K.O.II", "KO II", "teenage engineering"]
    ur44_keywords = ["UR44", "Yamaha Steinberg", "Steinberg UR"]
    midi_keywords = ["MIDI", *ep_keywords, *ur44_keywords]
    noisy_midi_keywords = [
        "MIDI 2.0 Service Tests",
        "MIDI 2.0 Virtual",
        "MIDI 2.0 Loop",
        "Service Test",
        "MIDIU_DIAG",
    ]

    ep_devices = [device for device in pnp_devices if _matches_device(device, ep_keywords)]
    ur44_devices = [device for device in pnp_devices + sound_devices if _matches_device(device, ur44_keywords)]
    midi_devices = [
        device
        for device in pnp_devices
        if _matches_device(device, midi_keywords) and not _matches_device(device, noisy_midi_keywords)
    ]
    audio_devices = [
        device
        for device in sound_devices
        if _matches_device(device, ["Steinberg", "Yamaha", "UR44", "EP-133", "EP133"])
    ]

    _print_devices("EP-133 K.O.II USB / MIDI", ep_devices)
    _print_devices("UR44 / Yamaha Steinberg", ur44_devices)
    _print_devices("MIDI-visible devices", midi_devices)
    _print_devices("Audio device hints", audio_devices)

    print("\nRouting baseline")
    print("  EP-133 audio out -> 3.5 mm stereo TRS to dual 1/4 inch TS -> UR44 line inputs -> Sonar audio track.")
    print("  EP-133 USB-C is for MIDI clock/transport and sample transfer, not the main audio capture path.")
    print("  Use Sonar + Yamaha Steinberg ASIO on the Intel studio PC for UR44 recording.")
    print("  Use Ableton when Session View, clips, or Link/sync experiments are the point.")

    print("\nCodex control boundary")
    if ep_devices:
        print("  EP-133 is visible to Windows. Codex can inspect device presence and help with PC-side MIDI/sample/DAW routing.")
    else:
        print("  EP-133 is not visible. Connect it by USB-C, then rerun this command.")
    if ur44_devices:
        print("  UR44/Yamaha Steinberg is visible. Next check is Sonar ASIO input selection and a short recording test.")
    else:
        print("  UR44/Yamaha Steinberg is not visible here. On the studio PC, connect UR44 and install/verify the Yamaha Steinberg USB driver.")
    print("  Physical pads, knobs, cable moves, UAC, logins, and ear checks still need human confirmation.")


def command_snapshot_setup(args: argparse.Namespace) -> None:
    """Write a reproducible setup snapshot outside the repo."""
    init_dirs(args)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    tag = re.sub(r"[^A-Za-z0-9_.-]+", "-", args.tag).strip("-") or "music-pc"
    report_base = worker_path(args, "reports", f"{tag}-setup-snapshot-{timestamp}")
    json_path = report_base.with_suffix(".json")
    md_path = report_base.with_suffix(".md")

    pnp_devices = _windows_pnp_devices()
    sound_devices = _windows_sound_devices()
    ep_keywords = ["EP-133", "EP133", "K.O.II", "KO II", "teenage engineering"]
    ur44_keywords = ["UR44", "Yamaha Steinberg", "Steinberg UR"]
    noisy_midi_keywords = [
        "MIDI 2.0 Service Tests",
        "MIDI 2.0 Virtual",
        "MIDI 2.0 Loop",
        "Service Test",
        "MIDIU_DIAG",
    ]
    midi_devices = [
        device
        for device in pnp_devices
        if _matches_device(device, ["MIDI", *ep_keywords, *ur44_keywords])
        and not _matches_device(device, noisy_midi_keywords)
    ]

    ableton_prefs = _latest_ableton_preferences_dir()
    key_paths = {
        "Music repo": ROOT,
        "worker root": Path(args.worker_root).resolve(),
        "worker venv python": Path(args.worker_root).resolve() / ".venv" / "Scripts" / "python.exe",
        "Ableton preferences": ableton_prefs or Path(""),
        "Ableton plugin DB": Path(os.environ.get("LOCALAPPDATA", "")) / "Ableton" / "Live Database" / "Live-plugins-1.db",
        "Cakewalk Product Center": Path(r"C:\Program Files\Cakewalk\Product Center\ProductCenter.exe"),
        "Cakewalk Sonar": Path(r"C:\Program Files\Cakewalk\Sonar\Sonar.exe"),
        "Kontakt 7 standalone": Path(r"C:\Program Files\Native Instruments\Kontakt 7\Kontakt 7.exe"),
        "Kontakt 7 VST3": Path(r"C:\Program Files\Common Files\VST3\Kontakt 7.vst3"),
        "VCV Rack 2 Free": Path(r"C:\Program Files\VCV\Rack2Free\Rack.exe"),
        "SuperCollider sclang": Path(r"C:\Program Files\SuperCollider-3.9.3\sclang.exe"),
        "EP-133 inbox": worker_path(args, "hardware-jam", "ep133-inbox"),
        "hardware captures": worker_path(args, "hardware-jam", "captures"),
        "DAW export": worker_path(args, "daw-export"),
    }
    if ableton_prefs is None:
        key_paths.pop("Ableton preferences")

    package_probe = """
import importlib.util
mods = ['torch', 'torchaudio', 'demucs', 'librosa', 'soundfile', 'imageio_ffmpeg', 'numpy', 'scipy']
for mod in mods:
    print(f"{mod}: {'OK' if importlib.util.find_spec(mod) else 'missing'}")
try:
    import torch
    print(f"torch_version: {torch.__version__}")
    print(f"cuda_available: {torch.cuda.is_available()}")
    print(f"cuda_device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none'}")
except Exception as exc:
    print(f"torch_error: {exc!r}")
"""
    _, package_output = python_probe(package_probe)

    snapshot = {
        "tag": tag,
        "captured_at": datetime.now().isoformat(timespec="seconds"),
        "hostname": platform.node(),
        "platform": platform.platform(),
        "repo": _repo_snapshot(),
        "worker_root": str(Path(args.worker_root).resolve()),
        "worker_dirs": {
            name: str(worker_path(args, name)) for name in WORKER_DIRS if worker_path(args, name).exists()
        },
        "toolchain": {
            "python": _first_line(_capture_command([sys.executable, "--version"])),
            "node": _first_line(_capture_command(["node", "--version"])),
            "ffmpeg": _first_line(_capture_command([resolve_ffmpeg(), "-version"])),
            "packages": package_output,
        },
        "installed_apps": _important_uninstall_entries(_uninstall_registry_entries()),
        "paths": _path_snapshot(key_paths),
        "disk": _disk_snapshot(),
        "hardware": {
            "ep133": [device for device in pnp_devices if _matches_device(device, ep_keywords)],
            "ur44": [device for device in pnp_devices + sound_devices if _matches_device(device, ur44_keywords)],
            "midi": midi_devices,
            "audio": [
                device
                for device in sound_devices
                if _matches_device(device, ["Steinberg", "Yamaha", "UR44", "EP-133", "EP133"])
            ],
        },
    }

    json_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_snapshot_markdown(snapshot, md_path)
    print(f"setup snapshot JSON: {json_path}")
    print(f"setup snapshot Markdown: {md_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run worker-gaming music-stack jobs safely.")
    parser.add_argument("--worker-root", default=str(DEFAULT_WORKER_ROOT), help="repo-external output root")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("init", help="create worker output directories")
    p.set_defaults(func=init_dirs)

    p = sub.add_parser("check-env", help="inspect local worker dependencies")
    p.set_defaults(func=command_check_env)

    p = sub.add_parser("check-daw", help="inspect Ableton, Native Instruments, and Cakewalk plugin readiness")
    p.set_defaults(func=command_check_daw)

    p = sub.add_parser("check-hardware", help="inspect attached EP-133, UR44, MIDI, and audio devices")
    p.set_defaults(func=command_check_hardware)

    p = sub.add_parser("setup-midi-cli", help="install fixed SendMIDI/ReceiveMIDI builds under the worker tool cache")
    p.add_argument("--force", action="store_true", help="redownload and re-extract MIDI CLI tools")
    p.set_defaults(func=command_setup_midi_cli)

    p = sub.add_parser("ep133-sysex-probe", help="run a read-only EP-133 MIDI/SysEx connectivity probe")
    p.add_argument("--device", default="EP-133", help="MIDI device name to match")
    p.add_argument("--sendmidi", help="explicit path to sendmidi.exe")
    p.add_argument("--receivemidi", help="explicit path to receivemidi.exe")
    p.add_argument("--warmup-seconds", type=float, default=0.8, help="time to let ReceiveMIDI attach before sending")
    p.add_argument("--capture-seconds", type=float, default=4.0, help="time to capture the EP-133 response after sending")
    p.add_argument("--send-timeout-seconds", type=float, default=10.0, help="timeout for the SendMIDI request")
    p.add_argument("--open-report", action="store_true", help="open the Markdown probe report after writing it on Windows")
    p.set_defaults(func=command_ep133_sysex_probe)

    p = sub.add_parser("snapshot-setup", help="write a reproducible Music PC setup snapshot outside the repo")
    p.add_argument("--tag", default="worker-gaming", help="snapshot file prefix")
    p.set_defaults(func=command_snapshot_setup)

    p = sub.add_parser("separate", help="split source audio to 4 stems outside the repo via Demucs")
    p.add_argument("--source", required=True, help="audio file or folder")
    p.add_argument("--band", help="band id for output folder")
    p.add_argument("--model", default="htdemucs")
    p.add_argument("--mp3-bitrate", type=int, default=192)
    p.set_defaults(func=command_separate)

    p = sub.add_parser("ai-render", help="render one Band Room AI recreation outside the repo")
    p.add_argument("band")
    p.add_argument("song")
    p.set_defaults(func=command_ai_render)

    p = sub.add_parser("batch-ai-render", help="render all songs for a band, or every registered band")
    p.add_argument("--band")
    p.add_argument("--keep-going", action="store_true")
    p.set_defaults(func=command_batch_ai_render)

    p = sub.add_parser("recreation-cycle", help="run one Band Room AI recreation growth cycle outside the repo")
    p.add_argument("band")
    p.add_argument("song")
    p.add_argument("--profile", help="renderer profile override")
    p.add_argument("--force", action="store_true", help="pass --force to the renderer")
    p.add_argument("--with-analysis", action="store_true", help="write target-spec analysis beside the cycle report")
    p.add_argument("--with-drum-candidate", action="store_true", help="write a review-only drum-frame candidate beside the cycle report")
    p.add_argument("--open-report", action="store_true", help="open the Markdown report after writing it on Windows")
    p.set_defaults(func=command_recreation_cycle)

    p = sub.add_parser("ep133-pack", help="prepare a non-destructive EP-133 sample transfer pack outside the repo")
    p.add_argument("band")
    p.add_argument("song")
    p.add_argument("--include-ai-recreation", action="store_true", help="include short loops from ai-recreation output")
    p.add_argument("--render-ai", action="store_true", help="render ai-recreation first if mix.wav is missing")
    p.add_argument("--loop-seconds", type=float, default=8.0, help="seconds to trim each ai-recreation loop")
    p.add_argument("--open-folder", action="store_true", help="open the transfer folder after writing it on Windows")
    p.add_argument("--open-sample-tool", action="store_true", help="open the official EP sample tool after writing the pack")
    p.set_defaults(func=command_ep133_pack)

    p = sub.add_parser("ep133-first-pass", help="stage only selected EP-133 pack slots for a cautious first transfer")
    p.add_argument("band")
    p.add_argument("song")
    p.add_argument("--ep133-pack", help="explicit ep133-pack directory; defaults to the latest pack for band/song")
    p.add_argument("--slots", nargs="+", default=["B01", "B02", "B03", "B04"], help="pack slots to copy into the first-pass folder")
    p.add_argument("--output-name", default="first-pass-B-loops", help="folder name created under the EP-133 pack")
    p.add_argument("--open-folder", action="store_true", help="open the staged folder after writing it on Windows")
    p.add_argument("--open-sample-tool", action="store_true", help="open the official EP sample tool after writing the staged folder")
    p.set_defaults(func=command_ep133_first_pass)

    p = sub.add_parser("sonar-ep133-handoff", help="write a Sonar/EP-133/Band Room operator checklist outside Git")
    p.add_argument("band")
    p.add_argument("song")
    p.add_argument("--ep133-pack", help="explicit ep133-pack directory; defaults to the latest pack for band/song")
    p.add_argument("--recreation-cycle", help="explicit recreation-cycle directory; defaults to the latest cycle for band/song")
    p.add_argument("--open-report", action="store_true", help="open the Markdown handoff report after writing it on Windows")
    p.set_defaults(func=command_sonar_ep133_handoff)

    p = sub.add_parser("operator-run", help="run the safe Sonar/EP-133/Band Room worker loop and write one report")
    p.add_argument("band", nargs="?", default="tabasco")
    p.add_argument("song", nargs="?", default="human-fly")
    p.add_argument("--force-recreation", action="store_true", help="rerun the AI recreation cycle even when outputs exist")
    p.add_argument("--no-midi-probe", action="store_true", help="skip SendMIDI/ReceiveMIDI setup and EP-133 read-only SysEx probe")
    p.add_argument("--no-ep133-pack", action="store_true", help="skip EP-133 transfer pack generation")
    p.add_argument("--no-ep133-first-pass", action="store_true", help="skip the reduced B01-B04 first-transfer staging folder")
    p.add_argument("--no-handoff", action="store_true", help="skip the Sonar/EP-133 handoff checklist")
    p.add_argument("--no-snapshot", action="store_true", help="skip setup snapshot capture")
    p.add_argument("--snapshot-tag", default="worker-gaming", help="tag prefix for snapshot-setup")
    p.add_argument("--dashboard-port", type=int, default=8765, help="first localhost port to try for the dashboard")
    p.add_argument("--open-dashboard", action="store_true", help="start/reuse the local dashboard server and open the dashboard")
    p.add_argument("--open-folder", action="store_true", help="open the operator-run report folder after writing it on Windows")
    p.add_argument("--open-sample-tool", action="store_true", help="open the official EP sample tool after writing the report")
    p.add_argument("--dry-run", action="store_true", help="print planned steps without running commands or writing a report")
    p.set_defaults(func=command_operator_run)

    p = sub.add_parser("analyze", help="write stem target-spec report outside the repo")
    p.add_argument("targets", nargs="*", help="optional band or band/song filters")
    p.add_argument("--out", help="report JSON path")
    p.set_defaults(func=command_analyze)

    p = sub.add_parser("extract-drum-candidate", help="write review-only drum-frame candidates outside the repo")
    p.add_argument("band")
    p.add_argument("target", help="song id or --all")
    p.add_argument("--out", help="candidate JSON file or directory")
    p.set_defaults(func=command_extract_drum_candidate)

    p = sub.add_parser("stack-check", help="run the 5-repo integrity gate")
    p.set_defaults(func=command_stack_check)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
