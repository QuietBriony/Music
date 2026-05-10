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
3. Set `OUTPUT` around 75 to 85.
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
4. Keep `OUTPUT` around 75 to 85.

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

## Recording Fallback

Record only when needed.

- Use m4a recording for major audio character milestones.
- Use m4a recording for output/CarPlay/Bluetooth loudness comparisons.
- Use m4a recording when two browser listening passes disagree.
