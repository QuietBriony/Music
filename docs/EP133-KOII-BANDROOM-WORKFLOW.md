# EP-133 K.O.II / Band Room Workflow

## Position

Use EP-133 K.O.II as a hand-operated sampler and rhythm sketch box that can
reshape material prepared around Band Room. Music owns the reusable workflow;
an optional private `music-ops` overlay owns the actual unit, machine, cabling,
placement, and verified route.

This repository never treats device access as permission to write. EP-133
sample/project writes, pad assignment, backup/restore, firmware updates, and
listening decisions remain human gates.

## Do not break defaults

- Do not change Band Room default playback, runtime, presets, or service worker
  for a hardware experiment.
- Keep generated audio, transfer packs, recordings, and DAW projects outside
  Git.
- Commit only public-safe docs, code, schemas, and reviewed metadata.
- Do not store a private asset register, site labels, hostnames, exact wiring,
  device identifiers, or machine snapshots in Music.

## Documentation timeline

An OS 2.0-era manual reflects the feature set at that time. It is historical
documentation and must not be used to conclude that current EP-133 USB audio is
unsupported.

When checked on 2026-08-16:

- the current online guide identified itself as version 2.5;
- OS 2.5 (2026-06-24) documented USB audio input and output with a
  class-compliant host;
- OS 2.5.1 (2026-07-03) followed with fixes.

The current official guide outranks the older manual. The installed unit's OS,
Windows endpoints, DAW compatibility, and audible result still require direct
verification. Do not update firmware just to complete documentation.

## Do not mix up the USB directions

| Lane | Direction | Purpose | Write risk |
|---|---|---|---|
| USB audio out | EP-133 -> host | record/play EP-133 into a computer or DAW | read/capture until the DAW records |
| USB audio in | host -> EP-133 | feed host audio to EP-133; select USB as sampling source when sampling | sampling writes a sound and needs a human gate |
| USB MIDI | either direction | notes, clock, transport, control | messages may trigger actions; review mappings |
| EP sample tool | file/data transfer | sample management and project backup/restore | writes/restores device content; human gate |
| USB power | host/charger -> EP-133 | power | not an audio or data claim |

Sample transfer is not audio streaming. MIDI is not audio. USB audio in and out
are separate endpoint directions. State the intended lane every time.

## Capture choices

### USB audio capture candidate

```text
EP-133 USB audio output
  -> verified host input endpoint
  -> DAW audio track
```

This is current manufacturer-documented capability. It becomes a usable DAW
route only after the current host proves the endpoint and driver combination.
A DAW may not be able to take EP-133 USB input while using a different ASIO
interface for output; verify rather than assuming multi-device support.

### Analog fallback/capture route

```text
EP-133 3.5 mm stereo output
  -> suitable stereo breakout cable
  -> verified interface stereo line inputs
  -> DAW stereo track
```

Keep this route as a fallback and as an intentional analog capture option. The
operator must confirm the cable, input pair, gain, monitor level, and clipping.

## Public-safe workflow

### 1. Prepare outside Git

Generate or collect short candidate material under a repo-external worker
directory. The preparation step may create a naming sheet, conversion report,
and suggested pad map, but it must not write to EP-133.

### 2. Review the transfer boundary

Before opening the sample tool:

1. confirm which EP-133 project/group/pads are in scope;
2. decide whether a backup is required;
3. verify that each file is authorized and stored outside Git;
4. keep the first transfer deliberately small;
5. let the operator approve the browser/device permission and the actual write.

### 3. Perform on-device variation

Chop, sequence, resample, and use performance effects by hand. Do not automate
pad, fader, project, or firmware changes from repository tooling.

### 4. Capture to a DAW

Inspect current endpoints and DAW settings first. Prefer the verified USB audio
route when the host supports the required input/output combination; otherwise
use the analog fallback. Do not copy exact driver settings from an old machine
snapshot.

### 5. Review in Band Room

Export a review take outside Git and load it through Band Room's existing
external-file workflow. Do not change default playback or presets. Promote
only the reusable timing, texture, or process observation—not the recording or
private route.

## What repo automation may do

- inspect device and endpoint visibility read-only;
- prepare transfer files and reports outside Git;
- generate a suggested pad map;
- prepare a DAW/Band Room handoff checklist;
- compare current observations with a private routing profile;
- open a tool or report without granting permissions or writing the device.

## Human gates

- identifying the physical unit and installed OS;
- cable, power, gain, monitor volume, and ear checks;
- browser device permission;
- project backup/restore;
- sample transfer and pad assignment;
- firmware update;
- DAW record-arm and recording;
- choosing the take that sounds good.

## Verification record

Keep `documented_proposed` separate from `verified_on_device`. A complete
private verification record should include:

- installed EP-133 OS and observation date;
- Windows endpoint names and audio directions;
- DAW driver/input/output behavior;
- selected USB or analog lane;
- cable and physical constraints;
- whether EP-133 needed any setting change;
- audible result and operator;
- rollback steps.

If the private overlay is unavailable, do not invent those fields.

## Troubleshooting

- USB supplies power but no endpoints appear: verify a data-capable cable and
  direct connection, then recheck the host.
- USB MIDI appears but audio does not: confirm the installed EP-133 OS and look
  separately for audio input/output endpoints.
- Host audio does not reach EP-133 sampling: select EP-133 as the host output,
  then select USB as the sampling source on the device under a human gate.
- DAW cannot combine EP-133 input with another interface output: use one
  supported driver path or the analog fallback; do not force an undocumented
  aggregate setup.
- No analog capture: check the stereo breakout, line-input pair, DAW input, and
  operator-controlled gain.
- Sample tool does not see the device: check browser permission and cable, but
  do not retry writes blindly.

## Official references

- Current EP-133 guide:
  <https://teenage.engineering/guides/ep-133>
- OS 2.5 changes:
  <https://teenage.engineering/guides/ep-133/whats-new>
- USB audio sampling direction:
  <https://teenage.engineering/guides/ep-133/how-to>
- Hardware overview and USB audio output:
  <https://teenage.engineering/guides/ep-133/hardware-overview>
- Current downloads/releases:
  <https://teenage.engineering/downloads/ep-133>
- EP sample tool:
  <https://teenage.engineering/apps/ep-sample-tool>
