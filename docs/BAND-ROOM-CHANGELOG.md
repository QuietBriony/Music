# Band Room — Changelog (v65 → v108)

Cache marker: `band-room.{html,js,css}?v=br-NN` and `sw.js VERSION = hazama-fm-vNN`.
The two are bumped together — sw VERSION matches the band-room generation it ships.

---

## v108 — bass anchor for no-chord sections + SW doc precache

- chord_progression が無い section (Human Fly intro/outro 等) で bass が
  rest だったのを song key root の whole-note anchor に fallback
- sw.js PRECACHE_URLS に v103+ で追加した docs (MANUAL / CATALOG-GUIDE /
  DAW-INTEGRATION / FREE-SAMPLES-AND-SYNTHESIS / REPO-MANAGEMENT / burroughs lyrics)
  を全部追加 → オフラインでもマニュアル開ける

## v107 — index-aware lyric highlight + 4-bar drum fill

- `updateLyricsHighlight` に index-aware fuzzy step を挿入 — verse-1 と verse-2 で
  別の lyric block にハイライト (v3 Burroughs marker 対応)
- 各 section の 4 bar 目 (intro/outro 除く) で tom/snare の fill — 16th × 4
  rising velocity (0.42→0.72) で groove に呼吸を入れる

## v106 — universal vocal + sparse drum reinforce + section crash

- vocal guide が Human Fly chorus 限定だったのを全曲全 section (verse/recap/comp)
  に展開 — chord 4-step walk (root/3rd/5th/3rd)、4 bar 目は root sustain
- sparse frame (events < 6) の bar に kick/snare 基本 4-on-floor を低 velocity で
  補強 — 既存 events を覆わず空きビートだけ埋める
- section transition の chorus/bridge/outro/chant-b 頭で drumKit.crash 発火
  (vel 0.62、2分音符) — lift 感

## v105 — Hey verse-2 半端なドラム問題の root cause + bulk toggles

- `chord_progression` キーの形式 mismatch ("verse-1" vs "verse"): 6/7 曲が
  フル名キー、band-room.js は base 名で引いてた → bass/chord/guitar 全部 rest
- Fix: `cp[sec.section] || cp[baseSection]` で full-first / base-fallback
- AI 再現 + 原音 stems 両方に `all on / all off / defaults / karaoke` バルクトグル

## v104 — AI mode usability + section nav clarity

- AI synth toggles の default OFF → drums/bass/guitar/voice/chords を checked に
  (click だけ OFF)
- bus levels 再調整: drums 0.75→0.62, bass 0.65→0.72, voice 0.40→0.56, chord 0.55→0.68
- chord PolySynth -16 → -12 dB、vocal AMSynth -10 → -14 dB
- `jumpToSection` で停止中なら `startPlayback({ preservePosition: true })` 自動発火
- help overlay に section nav の挙動を追記

## v95 — A/B state compare snapshots

- `captureSnapshot()` / `restoreSnapshot()` round-trip all sliders, toggles,
  mode, kitSource, kitProfile through dispatched input/change events
- Two slots (A, B); recall buttons enable when slot is populated
- New <details> "🔀 A/B compare (2 snapshot 即切替)"

## v94 — free-808 scaffold (CC-0 dirt-samples drop-in slot)

- `presets/sample-kits/free-808/README.md` with TidalCycles dirt-samples
  source instructions, file naming contract, manifest.json template
- ~600 KB once filled; not yet in KIT_OPTIONS (user adds after dropping in)

## v93 — master mix preset chips (lo-fi / club / rock / ambient)

- `MASTER_PRESETS` writes to 4 master sliders + dispatches input events
- 5 one-click vibes: neutral / lo-fi / club / rock / ambient
- Chip row in 🌌 mastering panel, .active highlight

## v92 — voice profiles extended (bass / chord / vocal)

- `KIT_PROFILES` each entry now has bass/chord/vocal dicts
- `makeSynthBass / makeChordSynth / makeVoiceBox` consult `currentProfile()`
- Profile change → dispose + rebuild all 4 synth voices (drum/bass/chord/vocal)
- Sakanaction: bright snappy bass, saw stab chord, clean vocal
- LCD motorik: sub-y bass with portamento, dreamy triangle pad, breathy vocal
- Cramps punk: distorted slap bass (drive 0.18), square stab chord, snarled vocal

## v91 — synth kit profiles (Sakanaction / LCD / Cramps punk)

- `KIT_PROFILES` table: 4 presets (default / sakanaction / lcd-motorik / cramps-punk)
- `makeDrumKit(target, profileName)` reads from profile dict for each voice
- UI: "🥁 drum kit source + synth profile" with 2 selectors
- Persisted via v78 prefs alongside kitSource

## v90 — stems pack export (4-stem simultaneous → DAW)

- 4 `Tone.context.createMediaStreamDestination()` tapped off each stemBus
- 4 `MediaRecorder` started/stopped together; STOP emits 4 download links
- Drums/bass/other tap post per-stem EQ pre-master FX (clean stems for DAW)
- Vocals taps post-FX bus (chorus/delay/reverb baked in — that's the vocal sound)
- New <details> "📦 stems pack export (4 stem 同時録音 → DAW へ)" with red rec button

## v89 — Music ↔ Band Room bridge (separate apps, shared samples)

- Design judgement: keep apps cleanly separated (different purposes) but
  provide sample-level bridge for material flow
- Music Core Rig REC now shows "→ Band Room へ" link next to save
- Band Room external stems help text lists sources: DAW / Music Core Rig REC / Suno
- Footer reorganized into "別 app: Hazama FM · Music Core" / "歌詞: v2 · v3" / "DAW 連携"
- `style.css?v=fm-26`, fixed stale `engine.js?v=fm-54 → fm-55` in `index.html`

## v88 — WebMIDI in/out (hardware sync)

- OUT: 24 PPQ MIDI Clock from Tone.Transport.bpm → drum machine / DAW BPM sync
- IN: note-on listener — C2-G3 (36-55) → phrase trigger 01-20, C4-G#4 (60-68) → section jump
- "🎹 MIDI in/out" panel with `navigator.requestMIDIAccess` enable button
- Out/In dropdowns auto-populate from `midiAccess` + hot-plug via `onstatechange`

## v87 — per-stem external upload (drums / bass / other)

- Generalized vocal external upload pattern to all 4 stems
- `externalStemPlayers = { drums, bass, other }` routes to `stemEQs[stem].input`
  so per-stem EQ (HP/shelf/de-ess) applies to user takes
- New <details> "🥁🎸🎹 external stems" with one block per stem
- Toggle external → original stem auto-mutes → user's take plays through master chain
- + `docs/DAW-INTEGRATION.md` (roadmap: stem in/out paths, MIDI sync, sound quality options)
- + `docs/tabasco-lyrics-burroughs.md` v3 cut-up / fold-in lyrics for all 7 songs

## v86 — quick help overlay

- `?` button top-right and `?` key open a modal card with feature bullets + keyboard cheat sheet
- Escape / backdrop click / 閉じる button dismiss

## v85 — MediaSession (lock screen + media keys)

- `navigator.mediaSession` metadata, artwork (PWA icons), playback state
- Handlers: play / pause / stop / previoustrack / nexttrack mapped to band-room actions
- Refresh on band/song change and on playback start/stop

## v84 — SW registration + non-disruptive update banner

- band-room.html now registers `sw.js` (it didn't before — PWA install was broken)
- New version detected → fixed pill banner at bottom-center with "リロード" and "×"
- Unlike fm.html (auto-reload) the banner waits for the user — mid-jam reload is rude

## v83 — drag-drop external vocal

- Drop mp3/wav onto the `#br-external-vocal` panel as an alternative to the file picker
- `dragover` highlights the panel (dashed → solid border + brighter bg)
- Non-audio files rejected with status message

## v82 — phrase trigger qwerty keyboard mapping

- First 20 phrase cells map to `q w e r t y u i o p` (row 1) and `a s d f g h j k l ;` (row 2)
- Each cell shows the assigned key in a small corner chip
- Keydown fires the cell's click handler + `kbd-flash` pulse animation

## v81 — live recording (MediaRecorder → download)

- `Tone.context.createMediaStreamDestination()` taps `masterLimiter`
- `MediaRecorder` (audio/webm;codecs=opus preferred) collects chunks every 500ms
- STOP REC produces a `band-room_{band}_{song}_{ISO}.webm` download link with file size
- Recording does NOT stop playback

## v80 — A-B section loop

- Shift-click chip = set A; second shift-click = set B (auto-orders so A is earlier)
- `state.loopA / loopB` + visual chip prefixes (`A·` / `·B`) + golden tint between
- scheduleBar: at section transition, if `sectionIdx > loopB` → `jumpToSection(loopA)` (via RAF)

## v79 — keyboard shortcuts

- `space` play/stop · `[` `]` prev/next section · `1..9` jump · `m` toggle stems/AI mode
- Skipped when focus is on text inputs / textarea / select, or modifier keys held
- Footer hint chip shows the bindings in `<kbd>`

## v78 — localStorage persistence

- Key `band-room.prefs.v1`: bandId / songId / mode / kitSource / all range sliders / all checkbox toggles
- Debounced 400ms writes on `input` + `change` anywhere in `#br-main`
- Restored on `DOMContentLoaded` after the bands registry loads — selectors and handlers re-fire

## v77 — spectrum analyzer

- `Tone.FFT` size 64, smoothing 0.65, tapped off `masterLimiter`
- 280×36 canvas in transport, shares the master-meter RAF
- Bins color-tinted by band (bass 14°, mid 22°, high 28°)

## v76 — practice tempo slider (50–120%)

- Multiplier on `Tone.Transport.bpm.rampTo(baseBpm × mult, 0.4)`
- Also adjusts `Tone.Player.playbackRate` on stems (acknowledged pitch shift — warned in UI)
- Applied at `startPlayback` and `startStemPlayback` so re-start at 80% stays at 80%

## v75 — clickable section nav with stem seek

- Chips under transport, one per `structure[]` entry
- `jumpToSection(idx)` sums bars × `(60/bpm × 4)` → `Tone.Transport.seconds = targetSec`
- Re-seeks every stem player via `player.start("+0.05", targetSec)` — `loop:true` keeps wrapping

## v74 — cross-app mastering propagated to Hazama FM

- `engine.js` master chain: `masterGain → masterComp (-10 dB, 2:1) → masterWidener (0.62) → masterLimiter`
- Conservative settings; FM ambient softness preserved
- `engine.js?v=fm-55`, `sw VERSION = hazama-fm-v74`

## v73 — lyric blocks with section-synced highlight

- Markdown lyrics parsed into per-`[marker]` `<div class="br-lyric-block" data-marker="slug">`
- `updateLyricsHighlight(sectionName)` slug-matches the current section, scrolls into center, dims others
- Fuzzy fallback: `chorus-2 → chorus`

## v72 — phrase trigger 3-mode

- ⚡ 即発火 (default, instant) · ⏱ 次小節 (`Tone.Transport.nextSubdivision("1m")`) · 🔁 ループ
- Loop mode toggles per phrase: click again to stop and dispose
- Multiple phrases can loop simultaneously, each in its own player

## v71 — stem crossfade + master RMS meter

- `Tone.Player` fadeIn 0.005→0.15, fadeOut 0.02→0.30
- Track-button handler awaits 320ms after `player.stop()` before disposing — audible crossfade on song change
- `Tone.Meter` (smoothing 0.75) → 4px bar in transport, color shift accent → accent-soft @ -12 dB → red @ -3 dB

## v70 — AI 再現 polish (chorus / auto-pan / drive)

- `makeGuitar`: `Tone.Chorus` (0.9 Hz, depth 0.38, wet 0.34) before distortion
- `makeChordSynth`: `Tone.Chorus` + `Tone.AutoPanner` (0.18 Hz, depth 0.32) for slow LR drift
- `makeSynthBass`: post `Tone.Distortion` (0.08, wet 0.45) + LP filter for grit

## v69 — AI 再現 stereo placement

- `makeSampledKit`: per-voice `Tone.Panner` (kick 0, snare -0.06, hat +0.22, ghost -0.16, fill +0.12, crash +0.20)
- `ensureMaster`: per-bus panners — guitar -0.25, chords +0.20, others center
- Stems mode untouched — original mix integrity preserved

## v68 — don't stop mid-song

- `Tone.Player loop:true` on stems — practice/jam sessions don't go silent at song end
- `scheduleBar`: structure end wraps `sectionIdx = 0` instead of `stopPlayback()`
- `visibilitychange` listener calls `Tone.context.resume()` when tab returns visible — fixes mobile freeze

## v67 — UI simplify

- 16+ top sections collapsed into 6 core + 6 `<details>` (vocal FX / external / phrase / kit / volume / mastering)
- Non-active mode is `display:none` instead of dim — half the UI evaporates per mode

## v66 — mastering chain

- Per-stem EQ via `makeStemEQChain` (drums HP/EQ3, bass HP+LP, vocals HP+presence+de-esser, other HP+air)
- Two-stage master comp (gentle leveler + glue), `Tone.StereoWidener`, parallel tape sat
- New sliders: tape warmth (0–40 → wet send), loudness (-12..+6 dB → master gain)

## v65 — real drum pattern extraction

- `_extract_drum_patterns.py` rewrites all 7 Tabasco `drum-frames-*.json` from the actual stems
- librosa onset detect + band-energy classification (sub/low/mid/snap/high) + 16th-quantize
- Each frame's `events[]` reflects what the original drummer played, not a 4-on-floor template
- New `auto-self` kit source = current song's own drums

---

## Synth profile cheat sheet (v91-v92)

| profile        | drum kick                     | bass                          | chord                    | vocal               |
|----------------|------------------------------|-------------------------------|--------------------------|---------------------|
| default        | decay 0.32, 4 oct             | filter 480, drive 0.08         | triangle, verb 0.20      | formants 700/1200   |
| sakanaction    | decay 0.20, 5 oct, click -22  | filter 720, drive 0.04         | saw stab, chorus 0.55    | clean, verb 0.14    |
| lcd-motorik    | decay 0.38, 6 oct             | filter 600, portamento 0.04    | dreamy triangle, verb 0.34 | breathy, verb 0.32 |
| cramps-punk    | decay 0.40, click -36         | filter 380, drive 0.18, wet 0.70 | square stab, verb 0.12 | snarled, vibrato 18c |

## Master mix preset cheat sheet (v93)

| preset   | reverb | width | warmth | loudness | feel                          |
|----------|--------|-------|--------|----------|-------------------------------|
| neutral  | 22     | 72    | 10     |  0       | current default               |
| lo-fi    | 38     | 50    | 32     | -3       | lofi hiphop, washy, narrow    |
| club     | 12     | 88    | 18     | +3       | dry / ultra-wide / hot         |
| rock     | 14     | 65    | 12     | +1       | punchy mid-room               |
| ambient  | 55     | 90    | 22     | -2       | long verb / very wide          |

## DAW / hardware integration (v87-v90)

| feature                  | version | how to use                                          |
|--------------------------|---------|-----------------------------------------------------|
| external stem upload     | v87     | drag mp3/wav onto 🥁🎸🎹 → original auto-mutes       |
| external vocal upload    | v83     | same flow for vocals (Suno / 自分歌い直し)           |
| MIDI Clock out           | v88     | enable MIDI → pick output → DAW/drum machine syncs   |
| MIDI note in             | v88     | C2-G3 → phrase 01-20, C4-G#4 → section jump          |
| 1-track master record    | v81     | ⏺ REC → webm download                                |
| 4-stem pack export       | v90     | 📦 stems pack → 4 download links                    |
| Music Core Rig bridge    | v89     | Music REC → drop wav into Band Room external slot    |

See [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) for the full roadmap.

## Lyric versions

- v2.1 plain English: `docs/tabasco-lyrics-draft.md`
- v3 Burroughs cut-up: `docs/tabasco-lyrics-burroughs.md` (Naked Lunch grade)

Same melody in both, pick by mood.

## Keyboard cheat sheet (v86)

| key                | action                                          |
|--------------------|-------------------------------------------------|
| `space`            | play / stop                                     |
| `[` / `]`          | previous / next section (audio + lyrics seek)   |
| `1`..`9`           | jump to section index (1-based)                 |
| `m`                | toggle stems ↔ AI 再現 mode                     |
| `?`                | open quick help overlay                         |
| `Escape`           | close overlay                                   |
| `q`..`p`, `a`..`l`, `;` | fire phrase trigger 01..20                 |

Shift-click on a section chip sets A→B loop range.

Skipped when typing in form fields or holding Ctrl/Cmd/Alt.

## Production deploy chain (v65 → v86)

All commits push to `main`, GitHub Pages auto-deploys. Each new push
cancels the previous in-flight build (rapid-fire commits during a
session are normal — the final commit is the one that ships).

Service Worker is `sw.js` with `VERSION = hazama-fm-v86`; matches
`band-room.{html,js,css}?v=br-31`. SW caches all the stem mp3s in
`presets/tabasco-stems/<song>/{vocals,drums,bass,other}.mp3` for
offline use; mirror the same naming when adding new bands.
