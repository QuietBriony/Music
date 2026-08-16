# PC Registry — public logical roles

## Purpose and privacy boundary

This public registry defines logical Music Stack machine roles, capabilities,
and conflict boundaries. It does not publish the physical hostname, owned
hardware, exact monitor route, installed application snapshot, storage state,
local project paths, or current audio settings.

Machine-readable role authority is `config/music-machines.json`. When the
optional private `music-ops` overlay exists, its `machines/machines.json` and
`routing/profiles.json` own actual observations and hardware-dependent routes.
Without the private overlay, do not infer those details.

## Registered logical roles

| machineName | Public role | Main responsibilities | Avoid |
|---|---|---|---|
| `chouta-surface` | orchestrator and publishing workstation | repo development, stack orchestration, release coordination | assuming studio hardware is attached |
| `studioPC` | recording and listening workstation | DAW recording, hardware inspection/preparation, ear verification | long unattended GPU batches |
| `worker-gaming` | batch and reference-render workstation | GPU/batch work, stem preparation, DAW reference rendering | declaring an ear-critical result verified |

These are stable logical IDs, not public hostnames. A physical machine may be
replaced while retaining the role only after an explicit local rebind and
private observation update.

## Identity contract

Every active machine must set both local Git keys:

- `music.machineName` — one registered logical role;
- `music.machineHost` — the hostname observed during local binding.

The second value remains local/private. Commands fail closed when either key is
missing, the role is unknown, the current hostname no longer matches, or a
required capability is absent.

Bind only while physically operating the intended machine:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\music-machine.ps1 -SetMachine <registered-role>
```

Read-only verification:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\music-machine.ps1 -Json
```

Do not copy the JSON output or hostname into a public issue, document, or
commit. `-ExecutionPolicy Bypass` applies only to that PowerShell process; it
does not change the permanent Windows policy.

## Role boundaries

### Orchestrator/publishing workstation

- Owns cross-repo coordination, docs, PR preparation, and release checks.
- May edit protected runtime files only under the separate rules in
  `AGENTS.md`.
- Sends long batch/render work to the worker role.
- Does not claim a hardware or listening result without private evidence.

### Recording/listening workstation

- Owns hardware-dependent DAW recording and human listening verification.
- Uses the private routing profile for the current interface/monitor chain.
- Records exact driver, sample rate, buffer, latency, and audible result
  privately after observation.
- Avoids large architectural refactors during an ear-check iteration.
- Sends long batch/render work to the worker role.

### Batch/reference-render workstation

- Owns long-running analysis, stem preparation, deterministic reference
  renders, and repo-external reports.
- Does not auto-arm a DAW, record, send device writes, or upload media.
- Does not publish its installed software or machine snapshot as current truth
  for the studio role.
- Produces review material for later studio/human verification.

## Public vs private machine data

| Data | Public Music | Private overlay |
|---|---:|---:|
| logical role and capability | yes | may reference |
| reusable setup/check procedure | yes | may reference |
| physical hostname | no | yes |
| owned interface/monitor | no | yes |
| exact wiring and location | no | yes |
| installed DAW/driver/plug-in versions | no | yes |
| storage measurements and project paths | no | yes |
| current sample rate/buffer/latency | no | yes |
| dated audible result | only anonymized conclusion | yes |

Historical exact snapshots formerly present in this public current tree were
copied to the private source before sanitization. Git history was not rewritten;
history purge would require a separate destructive approval.

## Conflict avoidance

### Before work

1. Read `AGENTS.md` and the target repository's rules.
2. Run `git status --short --branch`; preserve unrelated changes.
3. Run `git pull --ff-only origin main` on a clean default branch.
4. Use a feature branch for broad or overlapping work.
5. Check the required machine capability before a machine-specific command.

### Shared files

Files such as service-worker versions, changelogs, and autonomy ledgers can
conflict across machines. Before push, fetch and reconcile with current main.
Do not discard, reset, or silently overwrite another machine/agent's work.

### Responsibility matrix

| Area | Normal owner | Boundary |
|---|---|---|
| runtime/audio modules | orchestrator or reviewed studio iteration | follow `AGENTS.md`; protect defaults |
| hardware/DAW observation | studio role | exact data private |
| batch/render preparation | worker role | outputs outside Git |
| public docs/schemas | any authorized role | no private operational data |
| Band Room runtime | dedicated workflow | do not casually edit during hardware work |

## Machine-specific command policy

Scripts must check both logical role and capability. A command that prepares a
hardware or DAW report must remain non-destructive unless the user separately
authorizes a bounded action.

Examples of safe defaults:

- inspect endpoints and versions read-only;
- write reports to a repo-external worker directory;
- create deterministic diagnostic material outside Git;
- stop at cable, gain, volume, record, login, licensing, and device-write
  gates.

## Session records

Public session records may use the logical role prefix:

```text
## YYYY-MM-DD [studioPC] — public-safe summary
## YYYY-MM-DD [worker-gaming] — public-safe summary
## YYYY-MM-DD [chouta-surface] — public-safe summary
```

Do not include hostnames, private paths, owned-device inventory, or exact
physical routing in the entry. Put those observations in the private overlay.

## Adding or replacing a machine

1. Add or change the logical role and capabilities in
   `config/music-machines.json` through a reviewed PR.
2. Update this public role boundary without hardware or host details.
3. On the physical machine, bind the role with `music-machine.ps1`.
4. Store the actual hostname, environment inventory, and routing evidence in
   the private overlay.
5. Run the repository checks and a private machine-specific smoke test.
6. Require a human ear check before declaring studio audio verified.

## Related docs

- `docs/NEW-PC-SETUP.md` — public setup procedure.
- `docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md` — public parity method.
- `docs/HARDWARE-JAM-ROUTING.md` — public routing templates.
- `docs/CHROME-COMPUTER-USE-BASELINE.md` — public browser-control baseline.
- `AGENTS.md` — hard rules and integrity gates.
- `docs/autonomy/SESSION-LEDGER.md` — public-safe session history.
