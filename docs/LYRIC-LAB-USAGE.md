# Lyric Lab usage

Lyric Lab is a private writing workspace for growing one lyric project at a
time. It is not an AI chat client and it does not call ChatGPT or Claude by
itself. The browser builds a local rule-based first draft; Cloudflare D1 keeps
the shelf synchronized across devices.

## Normal path

1. Open `作品棚` and resume a saved work with `開く`.
2. Use `新しい歌詞` only when starting a separate song.
3. Add a temporary title, short seed lines, and an optional voice memo URL.
4. Choose direction, taste axis, worldview, dialect, form, voice, heat, and
   weirdness.
5. Run `下書きを作る`, then move the useful draft to `磨く`.
6. Edit one song in place and use `保存` during work.
7. Use `完成にする` only when that version should appear as fixed on the shelf.

With a sync key already stored on the device, save and fix actions also update
D1. Opening the shelf pulls newer cloud versions automatically.

## Optional AI path

AI is a selective editor, not a required first step.

- `思想質問をコピー` creates a broad interview prompt. Use it when the
  worldview itself still needs to be distilled. Paste the resulting summary
  into `思想蒸留`.
- `AIへ渡す` creates a packet for the currently selected song. It includes the
  title, creative controls, seed notes, distilled worldview, Scene metadata,
  current lyric, voice memo URL, and direction-specific ending rule.
- Paste that packet into ChatGPT, Claude, or another writing model. Paste only
  the useful revision back into `磨く`, then save it as the same shelf item.

This keeps raw conversation outside the repository while preserving the
conditions that made a phrase useful.

## Voice memos

Lyric Lab stores only a Dropbox, Drive, or other HTTP(S) source URL. It does not
upload, copy, transcribe, or commit the audio file. A work with a source URL gets
a `メモ` action on its shelf card and `元メモを開く` beside the editor.

## Output views

- `Hook`: short cuts and repeated phrase candidates.
- `Suno`: a text packet for the current lyric and production direction.
- `曲設計`: metadata-only Scene and arrangement intent for later Music Stack
  translation. It does not publish the lyric body to the Music repository.

## Expected next stage

The next useful integrations are server-side transcription for explicitly
selected voice memos, an optional server-side writing model, and a reviewed
Scene-to-Music session packet. Until those exist, `AIへ渡す` is the honest handoff
boundary and `曲設計` is the Music Stack preparation layer.

