# Lyric Lab usage

Lyric Lab is a private writing workspace for growing one lyric project at a
time. It is not an AI chat client and it does not call ChatGPT or Claude by
itself. The browser builds a local rule-based first draft; Cloudflare D1 keeps
the shelf synchronized across devices.

## Normal path

1. Open `作品棚` and resume a saved work with `開く`.
2. Use `新しい歌詞` only when starting a separate song.
3. Add a temporary title and short seed lines. When the song starts in a voice
   memo, BandLab, ACE-Step, or Band Room, choose it as `制作元` and keep its URL.
4. Choose `制作先`, BPM, key, duration, and meter. Unknown values can stay
   blank.
5. Choose direction, taste axis, worldview, dialect, form, voice, heat, and
   weirdness.
6. Run `下書きを作る`, then move the useful draft to `磨く`.
7. Edit one song in place and use `保存` during work.
8. Use `完成にする` only when that version should appear as fixed on the shelf.

With a sync key already stored on the device, save and fix actions also update
D1. Opening the shelf pulls newer cloud versions automatically.

## Optional AI path

AI is a selective editor, not a required first step.

- `思想質問をコピー` creates a broad interview prompt. Use it when the
  worldview itself still needs to be distilled. Paste the resulting summary
  into `思想蒸留`.
- `AIへ渡す` creates a packet for the currently selected song. It includes the
  title, creative controls, seed notes, distilled worldview, Scene metadata,
  current lyric, production source/session, and direction-specific ending rule.
- Paste that packet into ChatGPT, Claude, or another writing model. Paste only
  the useful revision back into `磨く`, then save it as the same shelf item.

This keeps raw conversation outside the repository while preserving the
conditions that made a phrase useful.

## Source links

Lyric Lab stores only a BandLab, Dropbox, Drive, or other HTTP(S) source URL. It
does not upload, copy, transcribe, or commit the audio file. A work with a source
URL gets a source action on its shelf card and a matching open action beside the
editor.

## Production roundtrip

Treat every tool as a different stage of the same shelf work:

1. Start with notes, a voice memo, a BandLab sketch, or a Band Room idea.
2. Grow and fix the lyric in Lyric Lab.
3. Select ACE-Step or Suno to make a vocal/arrangement demo, or BandLab to keep
   arranging and recording.
4. Open `制作`, copy the packet, and paste it into the selected tool. Linked
   audio still has to be opened, downloaded, or imported by hand.
5. Bring the reviewed mix or stem back to BandLab or a Band Room external stem
   slot. Keep audio outside the Music repository.

Lyric Lab does not call those services directly. The manual copy/import boundary
keeps the chosen lyric, source audio, and release decision under human review.

## Output views

- `Hook`: short cuts and repeated phrase candidates.
- `制作`: a target-specific handoff for ACE-Step, BandLab, Suno, or Band Room.
  ACE-Step receives caption/session/lyrics, BandLab receives session and lyric
  context, Suno receives its existing style/lyrics format, and Band Room receives
  metadata only.
- `曲設計`: metadata-only Scene and arrangement intent for later Music Stack
  translation. It does not publish the lyric body to the Music repository.

## Expected next stage

The next useful integrations are opt-in transcription for selected voice memos
and a reviewed Scene-to-Music session packet. Until those exist, `AIへ渡す` and
`制作` are the honest handoff boundaries, while `曲設計` remains the Music Stack
preparation layer.

