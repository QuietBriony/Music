# iOS Safari Background Playback Check

## Purpose

This checklist fixes the minimum real-device validation for Music playback on iPhone and iPad Safari.

The required baseline is:

- open Music in Safari, not a Home Screen PWA
- press `START`
- optionally enable `AUTO MIX`
- switch to another app
- audio continues playing

This is a playback usability check, not an audio-quality review.

## Expected Path

Use the normal Safari tab first.

1. Open the GitHub Pages URL in iPhone or iPad Safari.
2. Press `START`.
3. Confirm audible output.
4. Turn `AUTO MIX` on.
5. Set `OUTPUT` around 75 to 85.
6. Switch to another app.
7. Wait at least 60 seconds.
8. Return to Safari.
9. Confirm the UI still shows a recoverable playing state.
10. Press `STOP` and confirm audio stops.

## Expected Result

- Music keeps playing while another app is foregrounded.
- OS/Bluetooth playback controls show Music as active media when supported.
- Returning to Safari does not require a page reload.
- `STOP` stops both the Web Audio engine and the iOS Safari background audio bridge.
- Recording controls remain usable after returning to Safari.

## iOS Notes

- Safari tab playback is the primary target.
- Home Screen PWA playback may be more restricted by iOS and is not the minimum target.
- Background behavior can vary by iOS version, battery state, Low Power Mode, and whether another app takes audio focus.
- Bluetooth output is normally selected at the OS level. The in-app `AUDIO` selector is only useful where the browser exposes output routing.

## What PR #43 Added

- A hidden HTML audio element fed by the Web Audio master output.
- iPhone/iPad Safari detection.
- Direct hardware output reduction while the Safari bridge is active, to avoid double playback.
- Media Session state and play/pause/stop handlers from PR #42 remain active.
- The recorder tap remains connected to the same limited master output.

## Pass/Fail Notes

Pass:

- Safari continues playback after switching apps for at least 60 seconds.
- Audio resumes without reloading when returning to Safari.
- `STOP` works after returning.

Fail:

- Audio stops immediately when switching apps.
- Audio doubles, phases, or sounds obviously louder after `START`.
- Returning to Safari requires a page reload to hear sound again.
- Recorder or `STOP` breaks after backgrounding.

## Follow-Up If Failed

- Check whether the page was opened as Safari tab or Home Screen PWA.
- Disable Low Power Mode and test again.
- Test with screen unlocked and another app foregrounded first.
- Then test lock screen separately.
- If Safari still stops audio, create a runtime PR focused only on the iOS bridge lifecycle.

