# Repo Harvest Sidecar Examples

These examples show how internal archive/staging repos can be reviewed without
copying runtime code, audio, samples, lyrics, motifs, dependencies, or workflow
automation into `Music`.

- `chill.sidecar.json`: quiet piano / trio / long-form listening harvest.
  Boundary: `docs/chill-quiet-piano-trio-decision.md`.
- `test.sidecar.json`: Style Blend and probability interpolation harvest.
  Boundary: `docs/test-style-blend-preset-morph-decision.md`.
- `namima-lab.sidecar.json`: safe ripple lineage and organic pluck harvest.
  Boundary: `docs/namima-lab-safe-ripple-lineage-decision.md`.

Each file follows `docs/schema/repo-harvest-sidecar.schema.json` and should stay
metadata-only. Promotion means a future small repo-specific PR, not direct code,
asset import, archive action, or runtime ownership transfer.
