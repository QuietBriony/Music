"""Hazama FM 整合性監査 script.

Run from repo root:
    python scripts/audit.py            # 通常出力
    python scripts/audit.py --quiet    # BAD のときだけ出力 (CI 向き)

Both modes exit 0 if 0 BAD, exit 1 otherwise.

Checks:
    1. preset JSON files (format/version/array)
    2. presets/loader.js PRESET_FILES vs filesystem
    3. genre-flavor.js PRESET_BY_GENRE vs loader keys
    4. sw.js precache list completeness
    5. cache buster version sync (fm.html vs sw.js)
    6. engine.js MUSIC_RADIO_BRAIN_PROGRAMS coverage
       (reset / reason / target / station-ident / bias for each program)
    7. genre-flavor.js per-builder synth volume settings
    8. LEVEL_BY_GENRE coverage

Exits with non-zero status if any BAD item found (CI-friendly).

Set PYTHONIOENCODING=utf-8 on Windows shells if you see encoding errors.
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

QUIET = "--quiet" in sys.argv or "-q" in sys.argv

bad = 0
warn = 0
bad_lines = []  # capture BAD lines so --quiet can still surface them


def status(ok, msg):
    global bad
    mark = "OK " if ok else "BAD"
    if not ok:
        bad += 1
        bad_lines.append(f"  {mark} {msg}")
    if not QUIET or not ok:
        print(f"  {mark} {msg}")


def warn_msg(msg):
    global warn
    warn += 1
    if not QUIET:
        print(f"  -- WARN {msg}")


def info(msg):
    if not QUIET:
        print(msg)


info("=" * 60)
info("HAZAMA FM Integrity Audit")
info("=" * 60)

# 1. Hazama FM preset JSON files
info("\n[1] Hazama FM preset JSONs")
expected = {
    "presets/chill-piano-recipe.json": ("chill-piano-recipe", "recipes"),
    "presets/drum-frames-funk.json": ("drum-frames", "frames"),
    "presets/drum-frames-techno.json": ("drum-frames", "frames"),
    "presets/drum-frames-jazz.json": ("drum-frames", "frames"),
    "presets/drum-frames-lofi.json": ("drum-frames", "frames"),
    "presets/namima-shape-ambient.json": ("namima-ambient-tone-js", "presets"),
}
for path, (fmt, arr_key) in expected.items():
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        ok = (
            d.get("format") == fmt
            and d.get("version") == 1
            and isinstance(d.get(arr_key), list)
            and len(d[arr_key]) > 0
        )
        n = len(d[arr_key]) if isinstance(d.get(arr_key), list) else 0
        size = os.path.getsize(path)
        status(ok, f"{path:<44s} {n} entries, {size}B")
    except Exception as e:
        status(False, f"{path}: {e}")

# 2. loader.js PRESET_FILES vs FS
info("\n[2] presets/loader.js vs filesystem")
loader_text = (ROOT / "presets/loader.js").read_text(encoding="utf-8")
loader_files = set(s.strip('"') for s in re.findall(r'"presets/[^"]+\.json"', loader_text))
actual = set(f"presets/{f}" for f in os.listdir("presets") if f.endswith(".json"))
hazama_fm_files = set(expected.keys())
legacy = actual - hazama_fm_files
unregistered_hazama = hazama_fm_files - loader_files
extra_in_loader = loader_files - actual

status(not unregistered_hazama,
       f"Hazama FM presets registered in loader ({len(loader_files)}/{len(hazama_fm_files)})")
if unregistered_hazama:
    print(f"     missing: {sorted(unregistered_hazama)}")
status(not extra_in_loader,
       f"loader has no dangling references")
if extra_in_loader:
    print(f"     dangling: {sorted(extra_in_loader)}")
if legacy:
    print(f"  -- {len(legacy)} legacy engine preset(s) present (NOT in loader by design):")
    for p in sorted(legacy):
        print(f"        {p}")

# 3. PRESET_BY_GENRE vs loader keys
info("\n[3] genre-flavor.js PRESET_BY_GENRE vs loader keys")
flavor_text = (ROOT / "audio/genre-flavor.js").read_text(encoding="utf-8")
genre_block = flavor_text[flavor_text.find("PRESET_BY_GENRE"):]
genre_block = genre_block[: genre_block.find("};") + 1]
genre_map = re.findall(r'^\s*(\w+):\s*"([^"]+)"', genre_block, re.MULTILINE)
loader_keys = set(re.findall(r'"([^"]+)":\s*"presets/', loader_text))
for genre, key in genre_map:
    status(key in loader_keys, f"PRESET_BY_GENRE[{genre}] -> {key}")

# 4. sw.js precache list
info("\n[4] sw.js precache list")
sw_text = (ROOT / "sw.js").read_text(encoding="utf-8")
precached = set(s.strip('"') for s in re.findall(r'"presets/[^"]+\.json"', sw_text))
missing_in_sw = hazama_fm_files - precached
status(not missing_in_sw, f"all Hazama FM presets precached ({len(precached & hazama_fm_files)}/{len(hazama_fm_files)})")
if missing_in_sw:
    print(f"     missing in sw: {sorted(missing_in_sw)}")

# 5. Cache buster sync (fm.html vs sw.js)
info("\n[5] cache buster version sync")
html_text = (ROOT / "fm.html").read_text(encoding="utf-8")
versions_html = set(re.findall(r'\?v=(fm-\w+)', html_text))
versions_sw = set(re.findall(r'\?v=(fm-\w+)', sw_text))
sw_version = re.search(r'const VERSION = "([^"]+)"', sw_text)
status(versions_html == versions_sw, f"fm.html ↔ sw.js precache versions match")
info(f"     html: {sorted(versions_html)}")
info(f"     sw  : {sorted(versions_sw)}")
info(f"     sw VERSION: {sw_version.group(1) if sw_version else '?'}")

# 6. engine.js MUSIC_RADIO_BRAIN_PROGRAMS coverage
info("\n[6] engine.js radio brain program coverage")
eng = (ROOT / "engine.js").read_text(encoding="utf-8")
m = re.search(r'MUSIC_RADIO_BRAIN_PROGRAMS\s*=\s*\[([^\]]+)\]', eng)
programs = re.findall(r'"(\w+)"', m.group(1)) if m else []
info(f"  array: {len(programs)} programs")
for p in programs:
    reset_ok = bool(re.search(rf'MusicRadioBrainState\.weights\.{p}\s*=', eng))
    reason_ok = bool(re.search(rf'program === "{p}"\s*\)\s*return', eng))
    target_ok = bool(re.search(rf'\b{p}:\s*clampValue', eng))
    # ident handled either by "else if (program === ...)" or by terminal else fallthrough
    ident_specific = bool(re.search(rf'else if \(program === "{p}"\)', eng))
    ident_default = (p in ("fieldStudy", "voidRoom"))  # known to use the else fallthrough branch
    ident_ok = ident_specific or ident_default
    bias_ok = bool(re.search(rf'programWeight\("{p}"\)', eng))
    all_ok = reset_ok and reason_ok and target_ok and ident_ok and bias_ok
    status(all_ok, f"{p:<14s} reset={reset_ok} reason={reason_ok} target={target_ok} "
                   f"ident={'else' if ident_default and not ident_specific else ident_specific} bias={bias_ok}")

# 7. genre-flavor.js builder volumes + LEVEL_BY_GENRE coverage
info("\n[7] genre-flavor.js per-builder volumes")
for name in ["Ambient", "Techno", "Lofi", "Jazz", "Funk", "Piano"]:
    func = re.search(rf'function build{name}Default\(\)\s*\{{(.*?)^\s*\}}',
                     flavor_text, re.DOTALL | re.MULTILINE)
    body = func.group(1) if func else ""
    volumes = re.findall(r'volume:\s*(-?\d+(?:\.\d+)?)', body)
    info(f"  build{name}Default: synth volumes = {volumes} dB")

info("\n[8] LEVEL_BY_GENRE per-genre master overrides")
lvl_block = flavor_text[flavor_text.find("LEVEL_BY_GENRE"):]
lvl_block = lvl_block[: lvl_block.find("};") + 1]
levels = re.findall(r'^\s*(\w+):\s*([\d.]+)', lvl_block, re.MULTILINE)
known = {"any", "ambient", "techno", "lofi", "jazz", "funk", "piano"}
listed = set(g for g, _ in levels)
for g, v in levels:
    print(f"  {g:<8s} {v}")
status(known == listed, f"LEVEL_BY_GENRE covers all 7 pills")
if known - listed:
    print(f"     missing: {sorted(known - listed)}")

# Summary
if QUIET:
    # In --quiet mode print only the failure-bearing lines + summary if BAD.
    if bad:
        print("HAZAMA FM Integrity Audit — FAILED")
        for line in bad_lines:
            print(line)
        print(f"Result: {bad} BAD, {warn} WARN")
else:
    print()
    print("=" * 60)
    print(f"Result: {bad} BAD, {warn} WARN")
    print("=" * 60)
sys.exit(1 if bad else 0)
