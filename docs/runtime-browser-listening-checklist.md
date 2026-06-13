# Runtime Browser Listening Checklist

## Purpose

This checklist makes browser listening the default review path for Music runtime tuning.

Use m4a recording only for milestone comparisons, CarPlay/output-level checks, or when browser listening is ambiguous.

## Primary Targets

- iPhone Safari
- iPad Safari
- Desktop local browser for fast iteration
- GitHub Pages for pre-merge and post-merge checks

## Baseline Setup

1. Open Music in a normal browser tab.
2. Press `START` or `START.HZM` once to unlock audio.
3. Set `OUTPUT` around 88 in Hazama FM, or 80 to 88 in the full mixer.
4. Turn `AUTO MIX` on for self-running checks.
5. Keep Console open on desktop checks and watch for red errors.

## Acid OFF Check

Run for at least 90 seconds.

Expected:

- Xtal/Tha-like haze and drone are the center of gravity.
- Low BPM feels like ambient, not drum-forward.
- Kick, hat, and sub attacks are thin and occasional.
- `hazeBed`, `membrane`, `memoryRefrain`, and `chromeHymn` are audible as a soft moving layer.
- `reedBuzz` appears rarely as nasal/earthy color, not as a constant foreground tone.
- There is no apparent silence longer than about 6 seconds.

Fail signs:

- The kick or low transient feels like the main event.
- The mix becomes only dark low-mid without transparent particles.
- `reedBuzz` repeats too often or muddies the bed.

## Acid ON Check

Run for at least 60 seconds.

Expected:

- Tempo moves into a 120 BPM or higher dance pressure range.
- Pressing `ACID` gives a clear short high-register acid indicator, not only a
  low-end or tempo change.
- ACID high replies keep a small human/organic groove feel instead of locking
  to a rigid grid.
- Acid motion is clear: short bouncy turns, filter movement, and small high replies.
- `coldPulse`, `acidBiyon`, `sub808`, and `ghostBody` become more prominent.
- 808/body pressure is present but does not crush the limiter.
- Hats and micro-pulses provide speed without turning into a constant noisy loop.

Fail signs:

- Acid ON still sounds like the ambient state.
- Pressing `ACID` does not create a recognizable high acid sign.
- ACID replies feel quantized, stiff, or machine-looped.
- Low-end blooms continuously or clips.
- The mix becomes bright EDM rather than dark acid/IDM pressure.

## Hazama FM Acid Cue Check

Run this when a PR touches `fm.js`, `engine.js`, service-worker cache busting,
or the acid / groove path.

Setup:

1. Open `fm.html`.
2. Select `techno`.
3. Press `START`.
4. Let it run for at least 90 seconds, then switch briefly to `any` and back to
   `techno`.

Expected:

- `techno` starts with a short acid cue, not a permanent `ACID.ON` lock.
- `window.MusicRuntimeState.acid.transient` rises briefly and decays.
- `window.MusicRuntimeState.acid.transientSource` starts with `hazama-fm.`.
- The FM surface remains one-button/simple; no extra acid control is exposed.
- High-register acid replies are audible enough to identify the genre shift,
  but do not make Hazama FM tiring as a focus radio.
- Groove still feels slightly human/organic rather than rigidly quantized.

Fail signs:

- `techno` sounds identical to `any` except for louder drums.
- The transient never decays, or behaves like the visible Core Rig `ACID` lock.
- The acid cue overfills the mix or fights the long-form radio rotation.

## Hazama FM PWA Refresh Check

Run this when a PR touches `sw.js`, `fm.html`, or installed-app cache busting.

- Open `fm.html` from a local server, not a `file://` URL.
- Confirm the current FM surface appears, including recent controls such as
  `shuffle`, `AI fill`, DJ set buttons, mic follow, and `40HZ`.
- Confirm cache markers match exactly across `fm.html`, `index.html`,
  `band-room.html`, and `sw.js`. Current repo markers include
  `engine.js?v=fm-118`, `fm.css?v=fm-53`, `fm.js?v=fm-70`,
  `audio/genre-flavor.js?v=fm-75`, `audio/ai-fills.js?v=fm-71`,
  `style.css?v=fm-28`, `band-room.css?v=br-86`,
  `band-room.js?v=br-212`, `audio/audio-safety.js?v=br-67`,
  `manifest-band-room.webmanifest?v=br-icon-1`, and `hazama-fm-v347`.
- For v169 Hazama FM melodic director, let FM run for at least 16 bars and
  confirm `window.MusicRuntimeState.melodicDirector` changes key/contour over
  phrases while playback stays smooth.
- For v170 Hazama FM / Music Core Rig bassline director, confirm
  `window.MusicRuntimeState.basslineDirector` exposes phrase pattern/gate and
  lofi/dub/main synth bass do not stay on a fixed root/5th loop across phrases.
- Confirm the Hazama FM route badge is visible near the controls. It should
  show `off` while idle, then `direct`, `ready`, `bridge`, or `failed`
  depending on the hidden media bridge state.
- Open the route badge panel and confirm `route` / `bridge` / `event` /
  `output` / `context` update. During playback, tap `rearm`; failed rearm must
  return to direct output rather than leave playback silent.
- If Band Room changed in the same PR, also confirm the current `band-room.css`
  / `band-room.js` / `audio/audio-safety.js` markers (see the marker list
  above) and `band-room.html` references match `sw.js`.
- For v168 Band Room saved mix migration, load with old v166 default slider
  values in `band-room.prefs.v1` and confirm only exact old defaults migrate to
  the v168 default mix while custom slider values remain untouched.
- For v167 Band Room default mix polish, play both 原音 and AI 再現 at the
  default slider values and confirm the master limiter is not audibly pinned,
  vocals sit forward without harsh sibilance, and AI bass/guitar/chords leave
  headroom for the source-derived drum accents.
- For v166 Band Room AI part agents, switch to AI 再現 and confirm bass /
  guitar / vocal / chords respond to the current source song's section changes.
- For v165 Band Room timeline, confirm the seek bar shows elapsed/duration
  in `m:ss`, can seek while paused, and START resumes from the chosen position.
- For v163 Band Room lyrics, confirm the footer shows only
  `final singable` and the lyrics panel loads `docs/tabasco-lyrics-final.md`.
- In offline mode, reload Band Room and confirm
  `docs/tabasco-lyrics-final.md?cb=...` plus
  `presets/drum-frames-tabasco-*.json?cb=...` resolve from the precache rather
  than showing `(lyrics file not available offline)` or `[Band Room] loadSong failed`.
- For v161+ Band Room album flow, let 02 `HEY` play past its structure end and
  confirm it does not auto-advance before the stem/catalog duration completes.
  On iPhone Safari, lock/unlock once during playback and confirm it recovers
  without a stuck single-note loop.
- For v157+ Band Room/Drum Floor roundtrip, open
  `band-room.html?from=drum-floor&band=tabasco&song=hey` and confirm it loads
  02 `HEY`, while plain `band-room.html` still reloads to 01 `TABASCO`.
- For v159+ FM/Drum Floor direct handoff, open FM, select a genre, and confirm
  `drum floor →` points to `drum-floor/?from=fm&g=...&energy=...&bpm=...`.
  In drum-floor, playback must remain manual; stale Band Room packet should not
  override a mismatched `from=fm` query.
- For v164 Chill routing, confirm Music Core overview exposes `Chill`, opens
  `chill/session.html`, and the chill session remains silent until a human
  presses `START`.
- Confirm browser console has no service-worker registration or update errors.
- Close and reopen the installed app after merge; if the old UI remains, open
  the normal browser tab once, reload, then reopen the installed app.
- Do not auto-reload while playback is active. Update reload should only happen
  from the idle app surface.

## Hazama FM Genre Source Check

Run this when a PR changes `audio/genre-flavor.js` or genre preset rendering.

Techno setup:

1. Open `fm.html`.
2. Select `techno`.
3. Press `START`.

Techno expected:

- `window.GenreFlavor.state.source` starts with
  `drum-frames+machine-acid-brain+chord-lift` and may include safety
  suffixes such as sidechain depth and production governor metadata.
- `window.GenreFlavor.state.masterLevel` follows the visible `OUTPUT` slider
  and remains below the internal limiter ceiling.
- `Tone.Transport.bpm.value` settles near 132 BPM.
- The drum frames still drive the rhythm, but the sound reads as stripped
  machine drum: deep four-on-floor kick, restrained offbeat hat, and short dry
  clap/snare.
- A light acid pulse continues underneath the transient cue without turning on
  Core Rig `ACID.ON`.
- The acid pulse is identifiable as a resonant byoing line, not only a bright
  cue at the moment the pill changes.
- The low floor is stronger than `any`, but not limiter-crushed or boomy.
- The 16th-note hat grid is mostly removed; hats read as sparse machine ticks,
  not foreground shaka-shaka.
- In high BPM sections, short 32nd/64th-feeling acid/click/texture ratchets
  create brain-dance motion without becoming a constant hat loop.
- After `SYNC`, `performance_state.hazama_fm.listening_trace` includes the
  techno dwell and any genre switches made during the listening pass.
- The visible `SYNC` control reports a saved genre/dwell status without
  interrupting playback.
- After `SYNC`, `performance_state.hazama_fm.review_cue.short_label` is
  `techno balance`, and `routing.openclaw.next_action.fm_review_cue` carries
  the same metadata-only cue.
- After `SYNC`, `performance_state.hazama_fm.conversation.role` is one of
  `bass-call`, `comp-answer`, `drum-comment`, `space`, `lead-call`,
  `bass-answer`, `comp-lift`, or `recap`.
- The visible `SYNC` status includes the cue, for example
  `saved techno 12s -> techno balance`.

Piano setup:

1. Open `fm.html`.
2. Select `piano`.
3. Press `START`.

Piano expected:

- `window.GenreFlavor.state.source` ends with
  `+foreground-piano+planing-reply`.
- `window.GenreFlavor.state.scheduled` is greater than `1`.
- `Tone.Transport.bpm.value` settles near 68 BPM after the profile lands.
- Piano chord bed, memory reply, and soft melody are all designed to sound,
  while the surface still leaves long quiet spaces.
- A dry hammer/attack foreground anchor makes the piano audible as the pill
  identity, not only as hidden metadata.
- The Music engine pad/glass/electronic-harp tail is suppressed enough that the
  flavor piano is the foreground object.
- After `SYNC`, `performance_state.hazama_fm.listening_trace.current_genre`
  is `piano` and `dwell_ms_by_genre.piano` is greater than `0`.
- After `SYNC`, `performance_state.hazama_fm.review_cue.short_label` is
  `piano foreground`, and the next action points toward a chill comparison
  rather than another blind Music-side sound patch.
- The visible `SYNC` control can be pressed from the FM surface without opening
  Core Rig.

Other genre source sanity:

- `ambient`: `window.GenreFlavor.state.source` starts with `namima-preset:` and
  stays calm/water-safe, not dark club ambience.
- `lofi`: source is
  `drum-frames+dusty-break-kit+vinyl-crackle+jazz-dust+session-breaks`;
  Salamander piano trio / breakbeat remains the body, and crackle / jazz dust
  reads as a thin memory layer, not loud foreground noise.
- `jazz`: source is
  `drum-frames+live-jazz-kit+walking-bass+brush+piano-comp+session-breaks`;
  ride/brush motion, walking bass, and sparse comping make it feel like a
  live writing-room session.
- `funk`: source is
  `drum-frames+live-funk-kit+ep+clavi+rubber-bass+session-breaks`; rubber
  bass and pocket breaks add body without turning the loop into a busy solo.

Shuffle audition sanity:

- Press `shuffle` before `START`. The visible genre should move away from
  `any`, the energy pill should change, and first audio should start from that
  selected genre rather than from the default `any` bed.
- While playing, `window.HazamaFmShuffleAudition.state.enabled` is `true` and
  `timerActive` is `true`.
- While playing, shuffle/manual/`any` genre changes should feel like a short
  DJ crossfade: slight output dip, genre source switch, then a smooth return.
- `window.HazamaFmShuffleAudition.step("check")` switches to another concrete
  genre and records the transition in
  `window.HazamaFmListeningTrace.snapshot().transitions` with a
  `shuffle.check.djmix` reason.
- Shuffle audition is only a listening-test accelerator. It should not change
  Music full mixer `AUTO MIX`, the genre source builders, or the hidden engine
  shim.

SYNC metadata sanity:

- `window.MusicSessionPacket.build().performance_state.hazama_fm.genre`
  matches the current FM pill.
- `performance_state.hazama_fm.integration_mode` is `metadata-only`.
- `performance_state.hazama_fm.engine_translation.profile` matches the current
  FM pill when opened from `fm.html`.
- `performance_state.hazama_fm.review_cue` and
  `routing.openclaw.next_action.fm_review_cue` are metadata-only objects with
  `human_review_required: true`.
- `performance_state.hazama_fm.conversation` is metadata-only and contains only
  abstract role/motif/rest/density data, not a melody, chord progression, or
  audio reference.
- The packet gives other stack repos a role/edge/feedback hint, but does not
  auto-start, record, import samples, open MIDI, or merge anything.

Fail signs:

- `techno` still reads as generic noise hats plus soft membrane kick.
- `techno` has a constant foreground shaka-shaka hat grid.
- High BPM techno/IDM has no extra micro-ratchet or mental dance motion.
- Acid motion is only a one-shot cue and never appears as a light pulse.
- `piano` uses the recipe but sounds effectively absent.
- `piano` still has the same glassy/harp-like Music engine tail heard in other
  genres.
- `piano` becomes busy pop melody and loses the quiet chill identity.

## Reference Breadth / RDJ Edge Check

Use this when reviewing whether Music is carrying the reference-driven spread,
including the Xtal/Tha center and the Richard D. James-adjacent wrongness, as
Music-specific behavior rather than quotation.

Setup:

1. Press `START`.
2. Turn `AUTO MIX` on.
3. Keep Console open.
4. Run the three short states below for at least 60 seconds each.

State passes:

- `CULT=HAZE`, `IDEA=AUTO`: Xtal/Tha-like haze is the center. The bed feels
  soft, long, and gently pulsing; drums remain thin and occasional.
- `CULT=BROKEN`, `IDEA=WILD`: Autechre/RDJ-adjacent micro-events appear as
  short local edits. They should bend the surface without turning into a busy
  machine-gun loop.
- `CULT=ACID`, `ACID.ON`: rubber/pulse behavior becomes clearer. The body can
  move, and a short high acid sign should be audible, but the floor should stay
  dark and controlled rather than becoming bright EDM pressure. High replies
  should keep a slightly human/organic pocket.

Console evidence:

```js
window.MusicRuntimeState.referenceMorph
window.MusicRuntimeState.rdjGrowth
window.MusicRuntimeState.signatureCells
window.MusicRuntimeState.selfReview
```

Expected:

- `referenceMorph` has visible `haze`, `broken`, `pulse`, `chrome`, and
  `organic` values across the three states.
- `rdjGrowth` exposes `toy`, `rubber`, `wrong`, `tender`, `edit`, and
  `restraint` without making the runtime quote a reference track.
- `signatureCells` brings back `memoryPluck`, `ghostGlass`, `brokenTexture`,
  or `lowBreath` as small recurring colors.
- `selfReview.referenceFit` is useful as a sanity signal, but it is not a
  substitute for listening.

Fail signs:

- The reference spread only reads in docs or console and not in the sound.
- Xtal/Tha turns into generic pad ambience with no fine particles or pulse.
- RDJ-adjacent wrongness becomes novelty, harshness, or copied motif language.
- Autechre-like edits erase the soft floor instead of adding local disruption.
- ACID adds volume and brightness more than rubber motion or dark pulse.
- ACID changes the low/body state but has no clear high-register indicator.
- ACID high replies sound rigid rather than human, rubbery, or organic.

## AUTO ARC Check

Use `ARC.36` when reviewing album-length self-running behavior.

Setup:

1. Press `START` or `START.HZM`.
2. Turn `AUTO MIX` on.
3. Set `ARC` to `ARC.36`.
4. Keep `OUTPUT` around 88 in Hazama FM, or 80 to 88 in the full mixer.

Expected long-form order:

- `ARC.SUB`: low BPM haze/drone, thin drums, membrane, chrome, rare reed buzz.
- `ARC.MEM`: warped memory, pluck-like refrains, softened recurrence.
- `ARC.AE`: broken micro-events, short repeat, dry fragments.
- `ARC.GST`: ghost pulse, body pressure, dark transient.
- `ARC.ACD`: 120 BPM or higher acid/808/body pressure without forcing the visible `ACID` button on.
- `ARC.XHL`: chrome air, open tail, return to soft space.

Fast review:

- Listen for 5 minutes and confirm that `window.MusicRuntimeState.albumArc.progress` advances.
- Listen past 7 minutes or temporarily inspect `window.MusicRuntimeState.albumArc` to confirm chapter movement.
- Manual pads should still work during every chapter.
- Turning `ACID` on manually should override and strengthen the acid behavior, not fight `ARC.36`.

Fail signs:

- `ARC.36` sounds the same as `LIVE`.
- Chapter transitions create abrupt bursts.
- The ACID chapter crushes the limiter or overfills the bass floor.
- Submerge/Exhale become drum-forward instead of drone-forward.

## AutoMix / Hazama Background Check

Use this to confirm self-running behavior without relying on visible UI animation.

1. Start playback.
2. Enable `AUTO MIX`, or load a `#hazama=` profile and press `START.HZM`.
3. Listen for at least 60 seconds with the page visible.
4. Switch to another app or hide the tab.
5. Wait at least 60 seconds.
6. Return to the page.

Expected:

- Audio continues as much as Safari allows after the initial user unlock.
- AutoMix/Hazama motion still changes musical state while the page is hidden.
- Returning to the page does not require reload.
- Pads are not stuck on.
- `STOP` still releases voices and stops playback.

Fail signs:

- Music becomes static when the screen is hidden.
- AudioContext resumes but the musical state no longer evolves.
- Returning to the page causes a burst, stuck pad, or silence.

## Pad Check

Press each pad for 3 to 5 seconds.

- `DRIFT`: floating glass/memory movement over the bed.
- `REPEAT`: short micro-repeat and visible tic/glass fragments.
- `PUNCH`: body accent without low-end overload.
- `VOID`: density opens into air, not mute.

## Quick Desktop Pass

Use this before creating or merging a runtime PR.

1. `node --check engine.js`
2. `git diff --check`
3. Start local static server.
4. Load `http://127.0.0.1:<port>/?v=<branch>`.
5. Run Acid OFF and Acid ON checks.
6. Run pad checks.
7. Run Hazama hash boot if the PR touches bridge/autonomy behavior.
8. Confirm Console has no red errors.

## Browser Loudness Check

Use this when browser output feels small compared with iPhone Apple Music or
other normalized app playback.

- Start from `OUTPUT` 88 in Hazama FM. Briefly check 90+ only if the
  device still feels quiet. Use 80 to 88 in the full mixer first.
- Compare `fm.html` `any`, `techno`, and `piano` without changing OS volume.
- Expected: browser playback should feel usable without maxing the OS volume,
  while the GenreFlavor compressor / limiter prevents harsh clipping.
- Expected: changing `OUTPUT` changes both the engine bed and GenreFlavor
  foreground enough to feel like one browser app, not two unmatched outputs.
- Expected: `OUTPUT` 90+ is near the audition ceiling, not required for normal
  listening, and should still sound like level, not distortion.
- Expected: `techno` is louder through drum/body and acid pulse, not through
  constant bright hiss.
- Expected: `piano` is foreground piano with space, not a low hidden pad.
- Fail sign: raising `OUTPUT` only makes the same thin layer louder.
- Fail sign: Hazama FM feels louder only because the flavor limiter is pumping
  or the same reverb tail becomes more constant.
- Fail sign: limiter pumping, brittle hats, or bass splatter appears at the
  Hazama FM default output.
- Fail sign: the limiter audibly flattens jazz/funk breaks or piano attacks.

## Recording Fallback

Record only when needed.

- Use m4a recording for major audio character milestones.
- Use m4a recording for output/CarPlay/Bluetooth loudness comparisons.
- Use m4a recording when two browser listening passes disagree.
