"""Hazama FM 整合性監査 script.

Run from repo root:
    python -X utf8 scripts/audit.py            # 通常出力
    python -X utf8 scripts/audit.py --quiet    # BAD のときだけ出力 (CI 向き)
    python -X utf8 scripts/audit.py --expected-version hazama-fm-v153

Both modes exit 0 if 0 BAD, exit 1 otherwise.

Checks:
    1. preset JSON files (format/version/array)
    2. presets/loader.js PRESET_FILES vs filesystem
    3. genre-flavor.js PRESET_BY_GENRE vs loader keys
    4. sw.js precache list completeness
    5. cache buster version sync (fm.html / index.html / band-room.html vs sw.js)
    6. engine.js MUSIC_RADIO_BRAIN_PROGRAMS coverage
       (reset / reason / target / station-ident / bias for each program)
    7. genre-flavor.js per-builder synth volume settings
    8. LEVEL_BY_GENRE coverage

Exits with non-zero status if any BAD item found (CI-friendly).

Use `python -X utf8` on Windows shells to avoid console encoding errors.
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

QUIET = "--quiet" in sys.argv or "-q" in sys.argv


def cli_value(*names):
    for i, arg in enumerate(sys.argv):
        for name in names:
            if arg == name and i + 1 < len(sys.argv):
                return sys.argv[i + 1]
            if arg.startswith(f"{name}="):
                return arg.split("=", 1)[1]
    return None


def normalize_sw_version(value):
    if not value:
        return None
    value = value.strip()
    if re.fullmatch(r"v\d+", value):
        return f"hazama-fm-{value}"
    if re.fullmatch(r"\d+", value):
        return f"hazama-fm-v{value}"
    return value


EXPECTED_SW_VERSION = normalize_sw_version(
    cli_value("--expected-version", "--expected-sw-version")
)

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


def extract_precache_urls(text):
    block = re.search(r"PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];", text)
    if not block:
        return []
    return re.findall(r'"([^"]+)"', block.group(1))


def strip_query(url):
    return url.split("?", 1)[0]


def is_remote_url(url):
    return bool(re.match(r"^(?:https?:)?//", url)) or url.startswith(("data:", "blob:"))


def versioned_page_urls(text):
    urls = re.findall(r'\b(?:href|src)="([^"]+\?v=(?:fm|br)-[^"]+)"', text)
    return [u for u in urls if not is_remote_url(u)]


def release_version_number(version):
    m = re.search(r"hazama-fm-v(\d+)", version or "")
    return int(m.group(1)) if m else -1


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
    info(f"  -- {len(legacy)} legacy engine preset(s) present (NOT in loader by design):")
    for p in sorted(legacy):
        info(f"        {p}")

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
precache_urls = extract_precache_urls(sw_text)
precache_url_set = set(precache_urls)
precached = set(s.strip('"') for s in re.findall(r'"presets/[^"]+\.json"', sw_text))
missing_in_sw = hazama_fm_files - precached
status(not missing_in_sw, f"all Hazama FM presets precached ({len(precached & hazama_fm_files)}/{len(hazama_fm_files)})")
if missing_in_sw:
    print(f"     missing in sw: {sorted(missing_in_sw)}")
local_precache_urls = [u for u in precache_urls if not is_remote_url(u)]
missing_local = sorted(
    u for u in local_precache_urls
    if not (ROOT / strip_query(u)).exists()
)
status(not missing_local, f"all local sw precache targets exist ({len(local_precache_urls) - len(missing_local)}/{len(local_precache_urls)})")
if missing_local:
    print(f"     missing local files: {missing_local}")

# 5. Cache buster sync (fm.html / index.html / band-room.html vs sw.js)
info("\n[5] cache buster version sync")
html_text = (ROOT / "fm.html").read_text(encoding="utf-8")
index_html_text = (ROOT / "index.html").read_text(encoding="utf-8")
band_room_html_text = (ROOT / "band-room.html").read_text(encoding="utf-8")
versions_html = set(re.findall(r'\?v=(fm-\w+)', html_text))
versions_index_html = set(re.findall(r'\?v=(fm-\w+)', index_html_text))
versions_sw = set(re.findall(r'\?v=(fm-\w+)', sw_text))
versions_br_html = set(re.findall(r'\?v=(br-\w+)', band_room_html_text))
versions_br_sw = set(re.findall(r'\?v=(br-\w+)', sw_text))
sw_version = re.search(r'const VERSION = "([^"]+)"', sw_text)
for page_name, page_text in [
    ("fm.html", html_text),
    ("index.html", index_html_text),
    ("band-room.html", band_room_html_text),
]:
    refs = set(versioned_page_urls(page_text))
    missing_refs = sorted(refs - precache_url_set)
    status(not missing_refs, f"{page_name} versioned local assets are precached ({len(refs) - len(missing_refs)}/{len(refs)})")
    if missing_refs:
        print(f"     missing in sw: {missing_refs}")
status(versions_html <= versions_sw, f"fm.html version markers present in sw.js")
info(f"     html: {sorted(versions_html)}")
status(versions_index_html <= versions_sw, f"index.html version markers present in sw.js")
info(f"     index: {sorted(versions_index_html)}")
info(f"     sw  : {sorted(versions_sw)}")
status(versions_br_html <= versions_br_sw, f"band-room.html version markers present in sw.js")
info(f"     band-room html: {sorted(versions_br_html)}")
info(f"     band-room sw  : {sorted(versions_br_sw)}")
sw_version_value = sw_version.group(1) if sw_version else ""
status(bool(re.fullmatch(r"hazama-fm-v\d+", sw_version_value)), f"sw.js VERSION is well formed ({sw_version_value or '?'})")
if EXPECTED_SW_VERSION:
    status(sw_version_value == EXPECTED_SW_VERSION, f"sw.js VERSION matches expected {EXPECTED_SW_VERSION}")
release_doc_versions = []
for release_doc in [
    "docs/BAND-ROOM-CHANGELOG.md",
    "docs/BAND-ROOM-MANUAL.md",
    "docs/CROSS-APP-INTEGRITY.md",
    "docs/runtime-browser-listening-checklist.md",
    "docs/USER-NOTES-MEMO.md",
]:
    path = ROOT / release_doc
    if path.exists():
        release_doc_versions.extend(re.findall(r"hazama-fm-v\d+", path.read_text(encoding="utf-8")))
if release_doc_versions:
    latest_doc_version = max(release_doc_versions, key=release_version_number)
    status(sw_version_value == latest_doc_version, f"sw.js VERSION matches latest release docs marker ({latest_doc_version})")

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
    info(f"  {g:<8s} {v}")
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
