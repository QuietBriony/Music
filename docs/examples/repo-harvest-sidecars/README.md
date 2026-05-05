# Repo Harvest Sidecar Examples

These examples show how internal archive/staging repos can be reviewed without
copying runtime code, audio, samples, lyrics, or dependencies into `Music`.

- `chill.sidecar.json`: light-surface and macro-control harvest.
- `test.sidecar.json`: Style Blend and probability interpolation harvest.
- `namima-lab.sidecar.json`: ripple interaction and organic pluck harvest.

Each file follows `docs/schema/repo-harvest-sidecar.schema.json` and should stay
metadata-only. Promotion means a future small repo-specific PR, not direct code
or asset import.
