#!/usr/bin/env python3
"""
worker-gaming pipeline wrapper.

This script keeps heavy audio artifacts outside the Music repo by default.
It only orchestrates existing repo tools and common CLI programs. It does not
install packages, write tracked audio, arm DAWs, or edit runtime files.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
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
    "tmp",
)
AUDIO_EXTS = {".m4a", ".mp3", ".wav", ".flac", ".aac", ".ogg", ".webm"}


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
