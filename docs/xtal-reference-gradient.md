# Xtal Reference Gradient

## Purpose

This document fixes the Apple Music playlist draft `xtal周辺 制作リファレンス草案` as a production reference gradient for the Music repo.

The gradient is for the Reference-Driven Generative Rig workflow. It stores metadata and production translation notes only. It does not store Apple Music audio, preview URLs, raw URLs, samples, lyrics, or copied musical material.

## Why a Production Gradient

`Xtal` is useful as a center point, but the Music engine should not chase one track directly. The surrounding references form a texture map: soft haze, warped memory, broken logic, ghost groove, long-form space, organic motion, and transparent dust.

The goal is to translate that map into Music-specific production parameters:

- timbre
- rhythm
- space
- structure
- gesture

This is not a copying target. It is a controlled vocabulary for future preset translation, m4a review, and small engine tuning PRs.

## Reference List

1. Aphex Twin - Xtal
2. Aphex Twin - Tha
3. Richard D. James - Donkey Rhubarb
4. Boards of Canada - Roygbiv
5. Boards of Canada - Olson
6. Autechre - Bike (Mixed)
7. Autechre - Eggshell
8. Burial - Archangel
9. Burial - In McDonalds
10. Oneohtrix Point Never - Chrome Country
11. Huerco S. - A Sea of Love (Mixed)
12. The Future Sound of London - Papua New Guinea (12)
13. Global Communication - 14:31
14. Brian Eno - An Ending (Ascent)
15. Four Tet - Parallel Jalebi
16. Biosphere - Novelty Waves

## Gradient Zones

### 1. Xtal / Tha Zone

- soft haze
- gentle pulse
- floating pad density
- loop hypnosis
- quiet body without heavy bass dominance

Music translation:

- soft ambient density bed
- gentle pulse below the foreground
- fader movement that bends the weather rather than changing scenes
- transparent high particles that stay sparse

### 2. BoC Zone

- warped memory
- tape softness
- nostalgic short melodic color
- loop familiarity with small mutations

Music translation:

- rounded mid-band warmth
- short melodic glass/pluck fragments
- loop recurrence without rigid repetition
- softened transient edges

### 3. Autechre Zone

- broken logic
- irregular micro-events
- controlled synthetic fragments
- machine behavior that does not become machine-gun repetition

Music translation:

- probability-shaped repeat fragments
- microtiming drift
- short resampled-feeling glass ticks
- local disruption while the audible floor continues

### 4. Burial Zone

- ghost groove
- rainy air
- low-light transient
- emotional murk without full silence

Music translation:

- low-mid floor with cleanup
- dark air tail
- transient body snap instead of louder bass
- VOID as open space, not mute

### 5. OPN / Huerco S. / Global Communication / Brian Eno Zone

- wide ambient bed
- long-form space
- synthetic hymn
- emotional air
- calm depth

Music translation:

- longer pad and air tails
- transparent particles above a dark bed
- slow fader-to-state smoothing
- Observer/Circle/Void as space and distance controls

### 6. FSOL / Four Tet / Biosphere Zone

- organic electronic motion
- atmospheric texture
- subtle rhythmic detail
- cold pulse and small forward movement

Music translation:

- organic pluck illusion without samples
- texture transient as motion
- controlled pulse that does not overload bassBus
- AutoMix self-motion that remains dark but not dull

## Music Engine Translation

This gradient should inform future Music work through production parameters, not source copying:

- soft ambient density bed
- gentle pulse
- transparent particles
- organic pluck illusion
- low-mid cleanup
- loop hypnosis
- pad / fader / pad-button relationship

Suggested mapping:

- AutoMix: baseline motion and long-form gradient drift
- Faders: terrain, density, weather, and pressure
- DRIFT: floating glass scatter and timing smear
- REPEAT: short resampled tic / glass repeat
- PUNCH: texture transient and body snap, not bass overload
- VOID: air bloom, transparent tail, and low-mid opening
- OUTPUT: listening-level control only, not a composition parameter

## Safety

- No copying of recordings, samples, lyrics, or Apple Music materials.
- No audio import.
- No preview URL or Apple Music URL storage.
- No sample-based implementation.
- No runtime tuning directly from metadata without m4a review.
- Engine changes should remain small and be verified with recorder output.

Use `references/apple-music-refs.json` for structured metadata and this document for the gradient map.
