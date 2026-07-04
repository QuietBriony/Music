# Codex Prompt — Phrase Thinking Rollup

Use this prompt when Codex is asked to absorb phrase thinking from ChatGPT fragments, user notes, issue comments, or local markdown.

```text
You are working inside QuietBriony/Music.

Read:
- docs/music-stack-integration-index.md
- docs/lyric-os/okinawa-local/CODEX-HANDOFF.md
- docs/lyric-os/okinawa-local/PHRASE-CAPTURE-PACKET.yml

Task:
Absorb the supplied notes into the Okinawa Local Lyric OS as metadata only.

Hard boundaries:
- Do not add complete lyrics to the repo.
- Do not add audio, samples, sample URLs, copied lyrics, copied melodies, or copied motifs.
- Do not style-clone named artists.
- Do not preserve raw private chat dumps.
- Do not turn the material into politics-as-slogan, tourism, local identity cosplay, boss self-justification, or shallow nostalgia.

When given rough notes, produce one of:
1. updates to PHRASE-CAPTURE-PACKET.yml,
2. a new scene metadata file under docs/lyric-os/okinawa-local/scenes/,
3. a short issue comment summary,
4. a prompt refinement under docs/lyric-os/okinawa-local/prompts/.

For each phrase/thought, extract:
- pressure: what contradiction creates the phrase
- image_carrier: what object/place/body can carry it
- distance: how close the speaker can stand
- risk_flags: what makes it fake, slogan, tourism, cosplay, self-heroic, or over-explained
- usable_form: hook concept, scene tag, spoken sample seed, vocabulary, avoid rule, arrangement note
- no_lyrics_status: keep_as_metadata unless explicitly moved to a human lyric draft outside this folder

Preferred output format for a new scene:

```yaml
scene_id: short_kebab_case
status: draft
source: user_supplied_notes
no_lyrics: true
pressure: >-
  ...
image_carriers:
  - ...
distance:
  speaker_position: ...
  audience_filter: ...
risk_flags:
  - ...
allowed_moves:
  - ...
avoid_moves:
  - ...
phrase_seeds_as_metadata:
  title_seeds:
    - ...
  motif_labels:
    - ...
  mouthfeel_notes:
    - ...
arrangement_notes:
  ep133_scene_logic: ...
  sonic_notes:
    - ...
```

Review checklist:
- Can a local classmate detect borrowed posture? Remove it.
- Did it make a soldier/base worker faceless? Re-humanize without equalizing power.
- Did it lecture a Tokyo listener? Convert explanation to image.
- Would an old-school hip-hop senpai feel no groove? Add repetition/mouthfeel metadata.
- Would a world listener need a lecture? Replace explanation with body/light/silence.
- Did it become boss complaint? Convert to work-image and risk flag.
- Did it become young-band nostalgia? Convert to adult distance and libido-pruning logic.
```

## Human usage

Paste a compact note like this into an issue or Codex task:

```text
Use CODEX-PHRASE-ROLLUP. New notes:
- [paste rough thought]
- [paste phrase impulse]
Return docs-only metadata. No lyrics.
```

## What not to do

Do not ask Codex to open ChatGPT share links as the primary source. Use selected excerpts or distilled notes instead.

Do not use this prompt to create finished lyrics in-repo. Finished lyrics belong in a separate private writing surface, not in the Music Stack metadata layer.
