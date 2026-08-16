# Hardware Jam Routing

## Purpose and boundary

This is a public-safe routing guide for using a hardware sampler, Windows host,
DAW, audio interface, monitors, and MIDI controllers with Music Stack. It owns
reusable workflow and safety rules, not anyone's asset inventory or current
physical wiring.

When an optional private `../music-ops` checkout is available, its canonical
JSON owns the real equipment, sites, machine observations, exact routing, and
verification state. Without it, keep examples anonymous and mark device facts
`needs_verification`.

Use these state labels consistently:

- `documented_proposed` — supported by current documentation or a reversible
  design, but not proven end to end on the current device.
- `partially_verified` — some endpoints or lanes were observed, but the full
  physical and audible route was not.
- `verified_on_device` — current device/OS, Windows endpoint, DAW path, cable,
  and audible output were all checked.

## EP-133 USB audio timeline

The old “USB is MIDI/power/sample transfer only; audio must be analog” rule is
stale.

Teenage Engineering's current EP-133 guide was version 2.5 when checked on
2026-08-16. OS 2.5 added class-compliant USB audio input and output; the current
guide documents selecting EP-133 as an input/output device and selecting USB as
a sampling source. OS 2.5.1 followed with fixes. An OS 2.0-era manual predates
that feature and must not be used as evidence that current USB audio is absent.

This is manufacturer documentation, not proof that a particular unit is on a
current OS or that a particular Windows/DAW host can monitor two interfaces at
once. Confirm those points on the device before using `verified_on_device`.

## Keep the connection lanes distinct

### USB audio: EP-133 to host

```text
EP-133 playback
  -> USB-C audio output
  -> class-compliant host input
  -> DAW/recorder track
```

This direction is for recording sound from EP-133 into a host.

### USB audio: host to EP-133

```text
host playback
  -> EP-133 USB audio input
  -> SAMPLE mode with USB selected as the source
```

This direction can feed audio to EP-133 for listening or sampling. Actual
sampling writes device content and remains a manual gate.

### USB MIDI

USB MIDI carries notes, clock, transport, and control messages. It is not an
audio stream. Confirm the required MIDI direction and avoid automatic device
writes or transport actions.

### EP sample tool

The EP sample tool transfers/manages sample and project data. It is not the
same lane as USB audio or USB MIDI. Backup, restore, sample transfer, and pad or
project replacement require explicit human review.

### Analog audio

The 3.5 mm stereo output remains a useful fallback and capture route:

```text
EP-133 3.5 mm stereo output
  -> suitable stereo breakout cable
  -> verified stereo line-input pair on an audio interface
  -> DAW stereo track
```

Analog capture is no longer the only possible route, but it is often simpler
when a DAW/driver cannot use EP-133 USB input and a second interface output at
the same time.

## Public-safe routing templates

### `site-dtm-desk`: shared host-monitor path

```text
EP-133 USB audio
  -> Windows/DAW host monitoring
  -> selected USB audio interface
  -> powered monitor pair
```

Manual gates:

1. Confirm the installed EP-133 OS without updating it.
2. Record the exact Windows input/output endpoint names and directions.
3. Confirm the host can combine normal PC playback with EP-133 input without
   feedback or an unsupported multi-device assumption.
4. Inspect the installed output cables and monitor inputs.
5. Let the operator control power, gain, volume, cabling, and the audible test.

For a KOMPLETE AUDIO 2 / PM0.4n example, current manufacturer specifications
say the interface has balanced 1/4-inch jack outputs, while PM0.4n has
unbalanced TS and RCA inputs and gives the TS input priority. Do not relabel the
interface output as TS merely because a TS-ended cable is used downstream.

### `site-yard-main`: DAW capture and alternate monitoring

```text
capture source
  -> verified USB-audio lane OR analog fallback
  -> DAW
  -> selected audio interface
  -> verified downstream monitor chain
```

Use an interface-switch procedure when two monitor environments are separate.
Do not document a private room layout or assume permanent room-crossing cable.
Exact driver, sample rate, bit depth, buffer, input pair, output assignment, and
downstream component order belong to the private verified profile.

Recommended decision order:

1. Inspect current endpoints and DAW driver mode read-only.
2. Try the reversible USB-audio design only if the host supports the required
   input/output combination.
3. Use analog EP-133-to-interface capture as the fallback.
4. Record whether EP-133 needed any setting change; if none, say so.
5. Promote the route only after an audible operator check.

### MIDI-controller mapping

```text
USB MIDI controllers
  -> reviewed application mapping
  -> Traktor, DAW, or browser app

application audio
  -> separately selected audio interface
```

A mixer-style MIDI controller is still a controller; it must not be described
as an audio mixer or audio interface unless the manufacturer documents that
separate capability. Review mappings before enabling transport, recording, or
destructive actions.

## What automation may do

Allowed, read-only or repo-side work:

- inspect Windows device visibility and endpoint names;
- inspect DAW driver/I/O settings without changing them;
- generate public-safe checklists, schemas, and routing candidates;
- create transfer material outside Git;
- compare documented state with a private canonical profile.

Human gates:

- plugging/unplugging cables or switching interfaces;
- power, gain, monitor volume, and hearing checks;
- sample/project writes, pad changes, backup/restore, and firmware updates;
- DAW record-arm, actual recording, and final taste decisions.

## Generic verification record

For each route, record:

- route/profile ID and intent;
- `documented_proposed`, `partially_verified`, or `verified_on_device`;
- source/controller/sink asset IDs in the private overlay;
- endpoint names and directions;
- driver, sample rate, bit depth, and buffer only if directly observed;
- topology and physical constraints without copying them public;
- startup steps, manual gates, audible result, date, evidence, and rollback.

## Safety

- Start with an operator-controlled safe level; do not automate gain or volume.
- Do not connect sync output to an audio input unless deliberately recording a
  pulse signal.
- MIDI, sync, USB audio, analog audio, and sample transfer are separate lanes.
- Do not auto-start playback, arm recording, send MIDI, write device content,
  update firmware, upload media, or alter Music runtime defaults.
- Keep audio, recordings, samples, DAW projects, videos, and manuals outside
  Git.

## Official references

- EP-133 current guide:
  <https://teenage.engineering/guides/ep-133>
- EP-133 OS 2.5 changes:
  <https://teenage.engineering/guides/ep-133/whats-new>
- EP-133 USB audio sampling direction:
  <https://teenage.engineering/guides/ep-133/how-to>
- EP-133 hardware overview:
  <https://teenage.engineering/guides/ep-133/hardware-overview>
- EP-133 current downloads/releases:
  <https://teenage.engineering/downloads/ep-133>
- KOMPLETE AUDIO 2 specifications:
  <https://www.native-instruments.com/en/products/komplete/audio-interfaces/komplete-audio-1-audio-2/specifications/>
- KOMPLETE AUDIO 2 connections:
  <https://www.native-instruments.com/en/komplete-audio-2-quickstart/connecting-devices/>
- Fostex PM0.4n specifications:
  <https://www.fostex.jp/products/pm0-4n/>
- Steinberg UR44 operation manual:
  <https://download.steinberg.net/downloads_hardware/UR44/UR44_documentation/UR44_OperationManual_en.pdf>
