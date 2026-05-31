# Worker Gaming Environment Setup - 2026-05-31

## Summary

`worker-gaming` の音楽制作環境を保守更新方針で棚卸しし、非対話で安全に進められる更新だけ実施した。

- Audit logs:
  - `C:\workspace\music-stack-worker\logs\env-audit-20260531-192652`
  - `C:\workspace\music-stack-worker\logs\env-audit-20260531-194803-post`
- Primary DAW lanes: Ableton Live 12 Lite and Cakewalk Sonar
- Worker Python lane: `C:\workspace\music-stack-worker\.venv`
- Output policy: generated audio / DAW projects / plugin state stay outside Git

## Updated

- FFmpeg: `8.0.1` -> `8.1.1` via winget portable package.
- Microsoft Edge WebView2 Runtime: installed as Cakewalk dependency.
- Microsoft Visual C++ 2015-2022 Redistributable x64/x86: `14.51.36231.0`.
- Microsoft Visual C++ 2013 Redistributable x86: `12.0.40664.0`.
- Native Instruments Controller Editor: `2.7.6` -> `2.8.2`.
- Native Instruments Kontakt / Kontakt 6 Player: `6.7.1` -> `6.8.0`.
- Native Instruments Kontakt 7 Player: installed `7.6.1`.
- Cakewalk Product Center: installed `1.1.0.004` and logged in manually.
- Cakewalk Sonar: installed `32.04.0.078` / `2026.04`.
- Cakewalk add-ons from Product Center: Core Plugins, Studio Instruments Suite,
  Sonar Drum Replacer, Session Drummer 3, TH-U, Help & Documentation,
  Precision Suite, ProChannel Modules, and L-Phase/T-Phase plugin content.
- BandLab Assistant: removed after Product Center became the current manager.
- Worker script now resolves FFmpeg from PATH, winget portable install paths, or `imageio_ffmpeg`, in that order.
- Worker script now includes `check-daw` for Ableton / Native Instruments /
  Cakewalk readiness checks.

## Current Music App Baseline

- Ableton Live 12 Lite: `12.3.2`
- Ableton Live 10 Lite: legacy install remains under `C:\ProgramData\Ableton`
- Cakewalk Product Center: `1.1.0.004`
- Cakewalk Sonar: `32.04.0.078` (`Sonar.exe` product version `2026.04`)
- Cakewalk by BandLab: legacy `29.09.0.125`; not the primary Cakewalk lane
- Native Access: `1.14.1`
- Kontakt: `6.8.0`
- Kontakt 7 Player: `7.6.1`
- Maschine 2: `2.16.1`
- Reaktor 6: `6.4.3`
- Guitar Rig 6: `6.3.0`
- VCV Rack 2 Free: `2.6.6`
- VCV Rack 1: `1.1.6` legacy
- SuperCollider: `3.9.3`
- Atom: `1.59.0` legacy only
- Kontakt standalone starts and shows installed libraries including Kinetic Treats,
  Kontakt Factory Selection, Scarbee Mark I, and Play Series Selection.
- Kontakt 7 Player installed `Kontakt 7.exe` and `Kontakt 7.vst3`, then
  initialized its local `komplete.db3` with 129 sound entries from Kinetic
  Treats, Kontakt Factory Selection, Play Series Selection, Scarbee Mark I,
  and user content.
- Ableton Live 12 Lite starts to an untitled default set after crash recovery
  state was moved aside.
- Cakewalk Sonar starts, completed first-run setup, and reported
  `Version: 2026.04 (Build 078, 64 bit)` from Quick Start.
- Product Center reports Sonar and the selected add-ons as installed.

## Deferred Manual Work

- Native Access 2: winget package not found. Use the official NI installer and sign in manually.
- Remaining NI product updates: apply only free point updates. Do not buy
  Kontakt/Komplete major upgrades here.
- Ableton plugin scan: NI VST3/VST2 files are present, but Ableton's plugin
  database has not registered them yet. `Options.txt` now contains
  `-DisableGraphicsHardwareAcceleration`, but Ableton Preferences still opened
  as a blank white window under remote control. Enable and rescan plugins from
  Ableton Preferences when the UI renders normally on the PC screen.
- Ableton Live point update: use Ableton account / in-app update manually.
- Cakewalk by BandLab: legacy `29.09.0.125` remains installed but is not the
  main lane. Keep it only as a deprecated fallback until shared Cakewalk
  components have been reviewed.
- SuperCollider 3.14.1: winget downloaded the installer, but the installer was cancelled. Current `sclang 3.9.3` starts.
- Visual C++ 2005 x64: update failed while uninstalling the old package with exit code `1603`; leave it unless a specific old plugin requires repair.

## Validation

- `C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-env`
  - Python 3.12.10 OK
  - Node 24.16.0 OK
  - FFmpeg 8.1.1 OK
  - Demucs OK
  - PyTorch 2.11.0+cu128 OK
  - CUDA available: `True`
  - CUDA device: `NVIDIA GeForce RTX 2070`
- `C:\Program Files\VCV\Rack2Free\Rack.exe --version`
  - `VCV Rack Free 2.6.6 Windows x64`
- `C:\Program Files\SuperCollider-3.9.3\sclang.exe -v`
  - `sclang 3.9.3`
- Native Access 1
  - logged in manually
  - Controller Editor `2.8.2` installed successfully
  - Kontakt `6.8.0` installed successfully
- Kontakt standalone
  - starts and displays installed libraries
- Kontakt 7 Player
  - Native Access reports `INSTALLED`
  - registry reports `Native Instruments Kontakt 7` `7.6.1.0`
  - `C:\Program Files\Native Instruments\Kontakt 7\Kontakt 7.exe`
    exists with product version `7.6.1 (x64)`
  - `C:\Program Files\Common Files\VST3\Kontakt 7.vst3` exists with product
    version `7.6.1 (x64)`
  - local content database contains 129 sounds across the installed Kontakt
    factory/player selections
- Ableton Live 12 Lite
  - crash-recovery prompt was bypassed by moving recovery state to
    `C:\workspace\music-stack-worker\logs\ableton-recovery-bypass-20260531-2013`
  - Live loaded `DefaultLiveSet.als` and reached `Live App: End Init`
  - `Options.txt` now contains `-DisableGraphicsHardwareAcceleration`
  - Ableton plugin database still reports `Plugin modules: 0` and
    `Plugins: 0`; Kontakt has not been registered by Live yet
- Cakewalk / BandLab
  - Product Center `1.1.0.004` installed
  - Sonar `32.04.0.078` installed; Quick Start reports `2026.04 (Build 078, 64 bit)`
  - add-ons installed: Core Plugins `1.0.0.178`, Studio Instruments Suite
    `1.0.0.70`, Sonar Drum Replacer `1.2.0.14`, Session Drummer 3 `1.0`,
    TH-U `2.0.8`, Help & Documentation `1.0`, Precision Suite `1.1.0.123`,
    ProChannel Modules `1.0`, and L-Phase/T-Phase plugin content
  - BandLab Assistant is removed; Product Center is the current manager
  - Cakewalk by BandLab remains only as a deprecated fallback
- `C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-daw`
  - Kontakt 7 standalone OK
  - Kontakt 7 VST3 OK
  - Kontakt 6 VST3/VST2 OK
  - Kontakt 7 content DB OK
  - Ableton Preferences / Options.txt OK
  - Ableton plugin DB present but empty
  - Cakewalk Product Center / Sonar / add-on registry checks OK
- `node scripts\stack-check.mjs`
  - `PASS 15 / FAIL 0 / SKIP 0`
- Band Room preview server
  - `http://127.0.0.1:8000/band-room.html` returned HTTP 200 after restart

## Next Operating Step

Use the Human Fly AI recreation stems in Ableton Live 12 Lite or Cakewalk Sonar:

1. Import `drums.mp3`, `bass.mp3`, `other.mp3`, and `mix.wav` from `C:\workspace\music-stack-worker\ai-recreation\tabasco\human-fly`.
2. Run `C:\workspace\music-stack-worker\.venv\Scripts\python.exe -X utf8 scripts\worker-gaming-pipeline.py check-daw`.
3. If Ableton still reports `Plugin modules: 0`, open Ableton Preferences on
   the PC screen, go to Plug-Ins, turn `VST3 System Folders` on, and rescan.
4. Scan NI VST2 from `C:\Program Files\Native Instruments\VSTPlugins 64 bit` only when needed.
5. For the Cakewalk lane, use Sonar with the Product Center add-ons for stem
   polish, guitar/amp processing, drum replacement, and quick mix bounces.
6. Export polished audio to `C:\workspace\music-stack-worker\daw-export\tabasco\human-fly`.
7. Review in Band Room before promoting any metadata or candidates into Git.
