# Codex Handoff — Okinawa Local Lyric OS

## Purpose

This file is the stable handoff surface for Codex / MCP agents that need to absorb phrase thinking from ChatGPT sessions, voice notes, GitHub issues, or local notes.

Do **not** rely on ChatGPT share links as the source of truth. Treat this repository file and related issue comments as the readable, reviewable, durable context.

## Boundary

This area is **metadata-only**.

Allowed:

- lyric philosophy
- phrase reasoning
- motif maps
- tension axes
- audience filters
- vocabulary / avoid-vocabulary
- prompt packets
- scene metadata
- transformation rules

Not allowed:

- finished lyrics
- unreleased full lyric drafts
- copied lyrics, melodies, motifs, arrangements, or recordings
- audio files
- sample files or sample URLs
- raw private chat dumps that include personal data beyond what the user explicitly wants to operationalize

## Why this exists

ChatGPT conversations are good for discovery, but weak as durable production state. Codex should not need to open a private conversation or a chat share link. The right pattern is:

1. user talks freely in chat
2. assistant distills the thinking into a small, stable packet
3. packet is committed to repo or pasted into an issue comment
4. Codex reads the packet and updates docs/schema/prompts only
5. actual lyrics are written outside this metadata layer, then reviewed by a human

## Current distilled kernel

The project is not trying to write Okinawa slogans. It is building a lyric operating system that lets Okinawa-local pressure appear through life, family, work, landscape, night, sound, risk, memory, and contradiction.

Core sentence:

> Do not represent Okinawa. Do not flee from Okinawa. Do not turn politics into a slogan. Let politics leak through local distance, family risk, work, graves, greenery, AI screens, and the fading left ear.

## Active persona kernel

- roots: Shuri / Ishimine
- natural zones: Kokusai-dori, the south, local routes rather than borrowed Koza nightlife
- drinks sometimes, but current stance is not drunkard mythology
- family risk boundary: wife / child / company means reckless reenactment is no longer valid
- work: second-generation landscaping operator, not a carefree heir
- arc: economics at university, tax-accounting first career, then life-or-death filial piety through business rescue
- company: now stable, office support, roughly ten employees, not dominated by payroll fear anymore
- current irritation: small workplace skirmishes after the larger rescue has been completed
- public/economic world: knows capitalism, industry groups, economic associations, right / state / flag / LDP-coded environments
- counter-world: understands local anti-capitalist / Babylon critique and emotional base-free desire
- pain point: the left-side artistic impulse may be fading as adult stability increases

## Phrase-thinking target

Codex should capture **why a phrase wants to exist**, not only the phrase.

For each note, extract:

- pressure: what life contradiction is pushing it
- image: what object/place/body carries it
- distance: how close the speaker may stand
- risk: what would make it slogan, tourism, self-justification, or cosplay
- usable form: hook seed, verse image, spoken sample, scene tag, prompt constraint, or avoid rule
- no-lyrics status: keep it as metadata unless explicitly moved to a lyric draft outside this folder

## Current major motifs

- left ear fading
- libido pruning
- grave hangout / `haka-men` memory
- Shuri / Ishimine slope body
- Kokusai-dori brightness that is too bright
- southward lowering of the voice
- family as risk limit
- company rescued, but not mythologized
- PC / AI as invisible fieldwork
- landscaping as cutting / leaving / shade / roots / public greenery
- capitalism understood, therefore harder to hate cleanly
- Babylon critique understood, therefore harder to dismiss cleanly
- base-free feeling understood, but not made cheap
- bat / koumori position as translator, not neutral cowardice

## Codex operating rule

When asked to “巻き取る” phrase thinking, Codex should make a docs-only change that updates one of:

- `PHRASE-CAPTURE-PACKET.yml`
- `prompts/CODEX-PHRASE-ROLLUP.md`
- a new `scene-*.yml` metadata packet
- an issue comment summary

Do not generate a complete song in-repo.

## Recommended loop

1. Human pastes rough notes into a GitHub issue comment or a temporary local note.
2. Codex reads the packet and this handoff.
3. Codex produces a `scene` object, not a lyric.
4. Human writes / jams / records outside repo.
5. Only reviewed metadata returns to repo.

## EP-133 mental model

Think in scenes. Commit one thought-state before mutating it.

- Scene = one lyric pressure field
- Commit = save the current thought-state before adding a variation
- Song Mode = later arrangement of scene packets into an album/song worldview

This matches the hardware habit without storing audio or lyrics in the repo.
