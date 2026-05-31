# Hardware Jam Routing

## Purpose

EP-133 K.O.II、UR44、Sonar、Ableton、VCV Rack、SuperCollider を
music-stack の外部演奏・録音レイヤーとして使うための配線と運用メモ。

repo は候補生成と記録、hardware / DAW は手触りと録音、Band Room は確認画面にする。

## First Patch

Start with this simple wired routing:

```text
EP-133 K.O.II audio out
  -> 3.5 mm stereo TRS to dual 1/4 inch TS
  -> UR44 line inputs 5/6 or another stereo input pair
  -> Sonar stereo audio track
  -> C:\workspace\music-stack-worker\daw-export\...
  -> Band Room preview
```

Use USB-C at the same time for EP-133 MIDI / clock / sample transfer:

```text
PC USB-C
  -> EP-133 USB-C
  -> Windows MIDI device
  -> Sonar or Ableton MIDI clock / transport / notes when needed
```

Audio capture should still use the analog output into UR44. Treat USB-C as the
control and file-transfer lane.

## What Codex Can Touch

If EP-133 is connected by USB-C, Codex can:

- run `check-hardware` to confirm Windows sees the device;
- inspect whether UR44 / Yamaha Steinberg devices are visible;
- help configure Sonar or Ableton from the PC UI when no password/UAC is needed;
- operate browser-side tools such as the EP sample tool if the browser exposes
  the device and the user grants access;
- generate repo-side stems, loops, one-shots, naming sheets, and sample packs
  outside Git for transfer to EP-133.

Codex cannot:

- press EP-133 pads, knobs, fader, or system buttons;
- plug cables or set hardware gain;
- approve UAC prompts;
- enter account passwords or MFA;
- decide whether the monitor mix sounds good without a human ear check.

## First Verification Command

After plugging EP-133 or UR44 into a Windows PC:

```powershell
cd C:\workspace\music-stack\Music
C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-hardware
```

Expected progression:

1. EP-133 appears as a USB/MIDI device.
2. UR44 appears as a Yamaha Steinberg / UR44 audio and MIDI device on the
   studio PC.
3. Sonar can select Yamaha Steinberg ASIO.
4. A stereo audio track can record the EP-133 analog output.
5. The bounce lands under `C:\workspace\music-stack-worker\daw-export\...`.

## Recommended Play Modes

### EP-133 as hand sampler

1. Generate a loop, one-shot, or texture from Music / drum-floor / VCV /
   SuperCollider.
2. Move it to `C:\workspace\music-stack-worker\hardware-jam\ep133-inbox`.
3. Transfer or sample it into EP-133.
4. Chop, sequence, punch-in FX, resample.
5. Record the result into Sonar through UR44 and keep rough captures under
   `C:\workspace\music-stack-worker\hardware-jam\captures`.

### EP-133 as external rhythm brain

1. Build the beat by hand on EP-133.
2. Use MIDI clock only if timing with Sonar/Ableton matters.
3. Record stereo takes into Sonar.
4. Keep the best takes in `daw-export`, then review in Band Room.

### DAW sends material into EP-133

1. Render a short 1-4 bar loop from Sonar, Ableton, or Band Room.
2. Sample it into EP-133 through the 3.5 mm input or transfer it with the sample
   tool.
3. Use EP-133 for destructive human variation.
4. Re-record into Sonar.

### VCV / SuperCollider as texture makers

- VCV Rack: clocked modular loops, noisy transitions, odd percussion, filter
  movement.
- SuperCollider: procedural percussion, drones, glitch fills, ambience.

Render audio outside Git, then feed EP-133 or Sonar. Do not wire these tools to
automatic record, upload, or merge flows.

## Sonar vs Ableton

Use Sonar first when UR44 or external hardware is involved:

- stable timeline recording;
- ASIO-focused audio input selection;
- stereo take management;
- Cakewalk add-ons for mix cleanup;
- export for Band Room review.

Use Ableton when clip/session behavior is the reason:

- loop sketching;
- live clip launching;
- Ableton Link experiments;
- fast electronic arrangement.

Keep both. The practical default is Sonar for capture and polish, Ableton for
loop/live/sync play.

## Cable Checklist

- EP-133 output to UR44: 3.5 mm stereo TRS to dual 1/4 inch TS.
- EP-133 input from phone/PC: 3.5 mm stereo cable or the output of an audio
  interface/mixer at safe level.
- EP-133 MIDI: TRS MIDI Type-A adapters or cables as required by the connected
  device.
- UR44 to PC: USB cable plus Yamaha Steinberg USB driver on the Intel studio PC.
- Monitor/headphones: connected to UR44, not the ARM Surface.

## Safety Notes

- Start with EP-133 and UR44 input gains low, then raise slowly.
- Do not connect sync output to audio inputs unless deliberately recording a
  pulse signal.
- MIDI, sync, and audio are separate lanes. Do not substitute a MIDI cable for a
  sync24 cable.
- Leave repo runtime untouched while jamming. Promote only reviewed metadata,
  candidates, docs, or code afterward.

## Official References

- EP-133 hardware overview:
  <https://teenage.engineering/guides/ep-133/hardware-overview>
- EP-133 system / MIDI settings:
  <https://teenage.engineering/guides/ep-133/system>
- EP-133 product and EP sample tool:
  <https://teenage.engineering/products/ep-133>
- UR44 operation manual:
  <https://download.steinberg.net/downloads_hardware/UR44/UR44_documentation/UR44_OperationManual_en.pdf>
