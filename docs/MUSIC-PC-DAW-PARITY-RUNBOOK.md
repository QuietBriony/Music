# Music PC DAW Parity Runbook

## Purpose and authority

This public runbook describes how to reproduce a Windows music-production
workflow without publishing a person's hostname, installed-environment
snapshot, licensed-content inventory, exact physical routing, or project
paths.

Public Music owns the reusable procedure. When available, the optional private
`music-ops` overlay owns:

- actual machine/hostname observations;
- installed DAW, driver, plug-in, and content versions;
- storage measurements and local paths;
- owned interfaces/monitors and real cabling;
- verified sample rate, bit depth, buffer, latency, and output chain;
- dated smoke-test evidence and rollback state.

If the private overlay is absent, do not infer those facts from an old public
snapshot. Use placeholders and `needs_verification`.

## Logical machine roles

The public role manifest is `config/music-machines.json`. It contains logical
role IDs and capabilities, not a private hardware inventory.

| Logical role | Reusable responsibility | Avoid |
|---|---|---|
| orchestrator/publishing workstation | repo edits, checks, PRs, release coordination | assuming it owns the recording interface |
| studio workstation | DAW recording, low-latency monitoring, ear verification | long unattended GPU batches |
| worker workstation | batch analysis, rendering, stem preparation | declaring a result ear-verified without the studio check |

Local identity is fail-closed through `music.machineName` and
`music.machineHost`. The actual hostname remains local/private; public docs use
only the registered logical role.

## Parity unit

Do not define parity as “install everything.” Define it per shared project:

1. DAW product/edition and compatible project format.
2. Required audio driver and plug-in format.
3. Only the instruments/effects/content that the project actually uses.
4. Matching sample rate, bit depth, buffer policy, and export format.
5. A deterministic smoke test and a human listening check.
6. A rollback or compatibility plan for older projects.

Store the actual values in private machine observations. Public docs retain the
field checklist and decision rules.

## Software baseline policy

Common tooling:

- Git, Node.js, Python, and FFmpeg as required by repository checks;
- one primary DAW for recording/editing;
- one secondary clip/session DAW when that workflow is useful;
- a licensed instrument/effect manager where applicable;
- optional modular or procedural sound-design tools.

Rules:

- Prefer supported stable releases; do not run unbounded upgrades.
- Align machines intentionally rather than updating only one side.
- Record edition as well as version; edition-specific features can break
  project portability.
- Keep older plug-in majors when an existing project needs their plug-in IDs.
- Do not purchase a major upgrade or remove old software automatically.
- Install or update licensed products one at a time and recheck capacity.
- Keep DAW projects, plug-in caches, libraries, renders, and recordings outside
  Git.

Public code/runtime dependency versions remain in repository manifests such as
`config/external-dependencies.json`. Private desktop application and content
versions do not belong there unless they are a public tool contract.

## Plug-in path policy

Use the normal system VST3 folder when supported:

```text
C:\Program Files\Common Files\VST3
```

Add legacy VST2 folders only for a verified existing-project requirement. Do
not publish a person's library paths or scan cache. A private parity record
should list:

- expected plug-in name, format, and version;
- observed path and version;
- whether standalone and DAW-hosted scans passed;
- required licensed library/content;
- migration or freeze/render fallback.

## DAW choice

Use a timeline-oriented DAW when recording external hardware, comping, normal
mixing, and ASIO I/O are central. Use a clip/session-oriented DAW when live
looping, clip launching, or link/sync experimentation is the reason.

Keeping both lanes is valid. A project should still name one canonical DAW and
avoid edition-specific features that the other machine cannot open.

## Capacity guard

Before installing or updating:

1. Record available storage and existing library locations privately.
2. Choose a minimum free-space guard appropriate for OS updates, caches, and
   recording.
3. Process one product/content item at a time.
4. Recheck free space and application health after each item.
5. Stop before crossing the guard.

Never delete caches, older DAWs, older plug-in majors, recordings, or libraries
without a separate reviewed cleanup plan. Do not relocate existing libraries
automatically.

## Rebuild procedure

### 1. Protect existing work

- inventory existing projects, user presets, templates, plug-in majors, and
  licensed content;
- back up the complete project folder outside Git before opening it in a newer
  DAW;
- freeze/render legacy tracks when a compatible plug-in may not be available;
- do not open the same writable project folder on two machines at once.

### 2. Establish repository identity

Clone only the intended repositories. Do not initialize the workspace
container as a Git repository. Bind the logical machine role on the physical
machine and verify it:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\music-machine.ps1 -SetMachine <registered-role>
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\music-machine.ps1 -Json
```

Do not copy a hostname into public docs.

### 3. Capture a private baseline

Record the current environment read-only before mutation:

- OS/architecture and free space;
- DAW/driver/plug-in versions;
- relevant endpoint names;
- licensed content needed by shared projects;
- current audio settings;
- repo commit and check result.

Store this under the private operator overlay or a repo-external report
directory. Do not commit the snapshot to public Music.

### 4. Install/update in dependency order

Recommended order:

1. primary DAW;
2. audio driver/control application for the actually used interface;
3. plug-in manager and core instruments/effects;
4. only the shared licensed content;
5. secondary DAW and its plug-in rescan;
6. optional sound-design tools.

Authentication, MFA, licensing, UAC, paid upgrades, and destructive cleanup
remain manual gates.

### 5. Verify the audio interface

Inspect before changing:

- selected driver and endpoint;
- sample rate, bit depth, buffer, and reported latency;
- DAW input/output assignment;
- direct/host monitoring and loopback state;
- private physical output chain.

Do not paste values from an older snapshot. If switching between two
interfaces, follow the private routing profile and preserve a rollback to the
normal interface.

### 6. Run a deterministic smoke test

Build a small, reproducible project:

1. create one diagnostic audio tone at a documented level;
2. load each required plug-in on its own track;
3. use a short deterministic MIDI phrase;
4. keep source lanes isolated for A/B/C comparison;
5. freeze/render one instrument track;
6. export a short stereo file in the intended format;
7. verify format and non-silence with a read-only analyzer;
8. perform a human audible check through the intended private monitor route.

The tracked legacy path `references/studiopc-sonar-ni-reference.json` now serves
as a public-safe deterministic A/B recipe, not as authority for a current
machine snapshot. Actual versions, local paths, and pass/fail observations
must be recorded privately.

### 7. Compare and hand off

Compare the two machines on:

- project opens without substitution;
- required plug-ins and libraries resolve;
- expected sample/bit settings are available;
- deterministic exports are non-silent and structurally comparable;
- the studio operator confirms monitoring and sound;
- any differences have an explicit workaround or blocker.

## Generic parity record

For each machine, keep a private record with:

```text
logical_role
observed_at
os_architecture
free_space_before_after
daw_edition_version
driver_version
audio_endpoint
sample_rate_bit_depth_buffer
plugin_versions_and_paths
licensed_content_used
smoke_test_result
audible_result
physical_route_profile_id
rollback
needs_verification
```

The public report should state only the reusable procedure, anonymized role,
and whether a gate remains.

## Repository boundary

GitHub is appropriate for code, schemas, public-safe recipes, metadata,
decisions, and review history. The DAW/private overlay is appropriate for
project files, licensed content, renders, exact machine state, real routing,
and ear-verification evidence.

Do not commit:

- audio or recordings;
- MIDI performance files;
- DAW projects or caches;
- licensed libraries;
- screenshots containing private machine state;
- raw hardware profiles;
- PDF manuals;
- credentials, tokens, device identifiers, or financial data.

## Manual approval boundary

Automation may inspect, compare, validate, and prepare reports. Human approval
is required for:

- UAC, passwords, MFA, and licensing;
- paid upgrades;
- device firmware or content writes;
- cable, gain, monitor volume, and power changes;
- record-arm and actual recording;
- listening and final taste decisions.

## Related public docs

- [PC-REGISTRY.md](PC-REGISTRY.md) — logical public machine roles only.
- [HARDWARE-JAM-ROUTING.md](HARDWARE-JAM-ROUTING.md) — public-safe routing
  templates and verification states.
- [EP133-KOII-BANDROOM-WORKFLOW.md](EP133-KOII-BANDROOM-WORKFLOW.md) — EP-133
  lane separation and human gates.
- [WORKER-GAMING-RUNBOOK.md](WORKER-GAMING-RUNBOOK.md) — repo-external worker
  workflow.

## Official references

- Cakewalk Product Center:
  <https://help.cakewalk.com/hc/ja/articles/37259908610201-Cakewalk-Product-Centerを使用したCakewalk製品のインストールと更新>
- Ableton update guidance:
  <https://help.ableton.com/hc/en-us/articles/6003240646556-Updating-Live>
- Ableton backward compatibility:
  <https://help.ableton.com/hc/en-us/articles/360000841004-Backward-Compatibility>
- Ableton Windows VST setup:
  <https://help.ableton.com/hc/en-us/articles/209071729-Using-VST-plug-ins-on-Windows>
