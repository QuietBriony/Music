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
- Acid motion is clear: short bouncy turns, filter movement, and small high replies.
- `coldPulse`, `acidBiyon`, `sub808`, and `ghostBody` become more prominent.
- 808/body pressure is present but does not crush the limiter.
- Hats and micro-pulses provide speed without turning into a constant noisy loop.

Fail signs:

- Acid ON still sounds like the ambient state.
- Low-end blooms continuously or clips.
- The mix becomes bright EDM rather than dark acid/IDM pressure.

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
