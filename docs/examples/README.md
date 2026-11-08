# Music Stack Examples

These examples are metadata-only review fixtures for the Music Stack.

- `music-creative-intent.notes.json`: an editorial synthesis of creative intent.
  Only its `music_intent` fragment follows the existing session schema; the
  whole document is neither an importable packet nor an executable preset.
  [Creative direction](../MUSIC-EXPERIENCE-DIRECTION.md) remains its authority.
- `music-session-packet.example.json`: a conductor packet emitted by Music.
- `music-orchestra-packet.example.json`: a high-level mission/routing wrapper
  around a Music session packet.
- `music-session-trace.example.json`: a reviewed observation trace; no audio,
  samples, lyrics, raw microphone buffers, or private gesture streams.
- `repo-harvest-sidecars/`: review-only harvest examples for internal
  archive/staging repos.

Examples are documentation fixtures, not runtime state. They must not auto-start
audio, arm live systems, record, upload, merge, or change another repo.

Current review boundaries:

- `docs/chill-quiet-piano-trio-decision.md`
- `docs/test-style-blend-preset-morph-decision.md`
- `docs/namima-lab-safe-ripple-lineage-decision.md`
