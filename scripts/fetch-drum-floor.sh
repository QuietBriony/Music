#!/usr/bin/env bash
# Fetch latest drum-frames JSON from the drum-floor repo and diff against
# the Music repo's local versions. Codex updates drum-floor; this script
# is the human-in-the-loop bridge to import those updates into Music.
#
# Usage:
#   scripts/fetch-drum-floor.sh           # diff only
#   scripts/fetch-drum-floor.sh --apply   # diff and overwrite local JSONs
#   scripts/fetch-drum-floor.sh --apply --no-audit   # skip audit run
#
# Manual fallback (mirrors what this script does):
#   curl -sL https://raw.githubusercontent.com/QuietBriony/drum-floor/main/exports/drum-frames-jazz.json -o presets/drum-frames-jazz.json
#   curl -sL https://raw.githubusercontent.com/QuietBriony/drum-floor/main/exports/drum-frames-funk.json -o presets/drum-frames-funk.json
#   python scripts/audit.py
#
# This script never auto-commits or auto-pushes — those are human decisions.

set -euo pipefail

DRUM_FLOOR_RAW="https://raw.githubusercontent.com/QuietBriony/drum-floor/main/exports"
PRESETS_DIR="presets"
TARGETS=(
  "drum-frames-jazz.json"
  "drum-frames-funk.json"
)

APPLY=false
RUN_AUDIT=true
for arg in "$@"; do
  case "$arg" in
    --apply)       APPLY=true ;;
    --no-audit)    RUN_AUDIT=false ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "[fetch-drum-floor] unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$PRESETS_DIR" ]]; then
  echo "[fetch-drum-floor] presets/ not found — run from Music repo root" >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

UPDATES=0
for target in "${TARGETS[@]}"; do
  remote_url="$DRUM_FLOOR_RAW/$target"
  local_path="$PRESETS_DIR/$target"
  tmp_path="$TMP_DIR/$target"

  if ! curl -fsSL "$remote_url" -o "$tmp_path"; then
    echo "[fetch-drum-floor] failed to fetch $target — skipping" >&2
    continue
  fi

  if [[ ! -f "$local_path" ]]; then
    echo "[fetch-drum-floor] local $local_path missing — would create"
    if $APPLY; then
      cp "$tmp_path" "$local_path"
      echo "[fetch-drum-floor] created $local_path"
      UPDATES=$((UPDATES + 1))
    fi
    continue
  fi

  if diff -q "$local_path" "$tmp_path" > /dev/null; then
    echo "[fetch-drum-floor] $target — no change"
  else
    echo "[fetch-drum-floor] $target — drum-floor has updates:"
    diff -u "$local_path" "$tmp_path" | head -40 || true
    echo ""
    if $APPLY; then
      cp "$tmp_path" "$local_path"
      echo "[fetch-drum-floor] applied $target -> $local_path"
      UPDATES=$((UPDATES + 1))
    else
      echo "[fetch-drum-floor] (preview only — re-run with --apply to overwrite)"
    fi
  fi
done

if $APPLY && [[ $UPDATES -gt 0 ]] && $RUN_AUDIT; then
  echo ""
  echo "[fetch-drum-floor] running scripts/audit.py..."
  PYTHONIOENCODING=utf-8 python scripts/audit.py
fi

if [[ $UPDATES -gt 0 ]]; then
  echo ""
  echo "[fetch-drum-floor] $UPDATES file(s) updated. Review with: git diff $PRESETS_DIR"
fi
