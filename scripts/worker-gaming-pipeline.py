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
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import winreg
except ImportError:
    winreg = None


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORKER_ROOT = Path(os.environ.get("MUSIC_STACK_WORKER_ROOT", r"C:\workspace\music-stack-worker"))
WORKER_DIRS = ("inbox", "stems", "ai-recreation", "reports", "daw-export", "logs", "tmp")
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
