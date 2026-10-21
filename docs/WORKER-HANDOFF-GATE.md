# Worker JSON handoff narrow gate

This definition takes effect only with its separately approved matching AGENTS
amendment. A draft copy or an inspect result does not activate it. The existing
five-repository/Integrity gate remains the default. This quality workflow grants
no new permission, publication approval, or OS/Git/security-setting change.

## Scope and conservative refusal

The default remains the existing five-repository full gate. An explicit narrow
command may qualify only a clean, committed Music candidate whose entire diff is
modifications of these already tracked, regular mode-100644 files:

- `scripts/worker-gaming-pipeline.py`
- `scripts/tests/test_worker_gaming_pipeline.py`

The source filename alone is insufficient: all module AST outside `_read_json`,
its position/signature and its JSON parse/read/JSONDecodeError behavior must stay
unchanged. Only a bounded boolean predicate made from `path.exists()` and
`path.is_file()` is variable. New imports, other functions, entrypoint, broad
exception handling, writes, processes, network or device operations are refused.
Unrecognized legitimate changes still require the full gate.

The base test contract must contain the eight PR481 cases. Their executable AST,
all imports, fixed fixture root, exclusive lock, setup, cleanup, hardware/network/
process barriers and helper methods stay unchanged. Additional cases are capped
at 24 total and use only bounded expressions, unittest assertions, JSON reads
inside `self.root`, or the existing synthetic handoff helper with `self.root /
"worker"`. They cannot add new fixture writers, imports, decorators, skips,
arbitrary calls, loops or cleanup. Cases that need a broader harness use full gate.

Unknown/full-short SHA, wrong origin/root, unknown or non-ancestor base, mismatch
with the declared `origin/main` ref, dirty/index differences, ignored/untracked
files, modes, renames/deletions, symlinks/junctions or escaping paths prevent this
route. `assume-unchanged`, `skip-worktree` and other unusual index flags are also
refused; they must not hide unrelated dirty content. Even ignored output files
require a fresh clean candidate. Evidence must
remain outside it. Refusal does not start full gate automatically.

## Trusted entry and two-phase review

Use the gate already installed in a trusted base checkout, not a modified gate
from the candidate. Its bytes must match that exact base's Git blob. The gate,
its own tests, AGENTS, docs and any other path are outside this exception. This
proposal cannot use the new gate to approve itself; its eventual rule change
retains the existing full-gate requirement.

The operator first confirms the current remote main and updates the ordinary
local ref through an authorized normal workflow. The gate does not fetch, change
Git settings or prove network freshness. Supply the independently checked full
base SHA and exact candidate HEAD; there is no guessed/fallback comparison base.

1. Run the installed base gate's `inspect` mode (read-only):

   ```text
   python -B <trusted-base>/scripts/worker-handoff-gate.py inspect --repo <candidate> --base <full-main-SHA> --head <full-candidate-SHA>
   ```

   Eligibility returns `ELIGIBLE_REVIEW_REQUIRED`, `gate_pass:false`, exit 2.
   It is not permission to merge or execute the changed tests. The fingerprint
   binds base/head, every changed path/status, both base/candidate blobs,
   actual working-copy SHA256, expected case count and the installed gate version.
   LF Git blobs and CRLF working bytes are distinguished.

2. An independent reviewer inspects that exact diff before any changed test is
   imported/executed. The operator confirms reviewer independence and stores a
   record outside the candidate:

   ```json
   {
     "schema": 1,
     "fingerprint": "<inspect fingerprint>",
     "author": "<author identity>",
     "reviewer": "<different reviewer identity>",
     "decision": "approved",
     "independent": true,
     "source_json_only": true,
     "test_fixture_only": true,
     "exclusive_candidate": true,
     "exclusive_owner": "<same author identity>"
   }
   ```

   JSON presence/hash matching is machine-checkable. JSON is not a signed identity
   credential: this tool cannot prove who wrote it or that a review truly happened.
   The parent/operator must verify the actual independent review. Do not fabricate
   evidence or treat a self-authored record as a review.

3. The operator confirms this is a dedicated, exclusively owned checkout: no
   other editor/agent/process may change it during validation or before delivery.
   Run the same trusted gate with `run`, `--review <outside-record.json>`,
   `--author <same-author>` and `--exclusive-candidate`. Missing confirmation is
   refused. It rechecks the snapshot before execution and uses
   only the current Python with this fixed command, in the candidate:

   ```text
   python -B -m unittest discover -s scripts/tests -p test_worker_gaming_pipeline.py -v
   ```

   Exit 0 alone is insufficient: result count must match the inspected cases,
   no skips/expected failures/denials are allowed, review must match, and the
   complete snapshot must still match afterward. Only then is
   `NARROW_GATE_PASS`, `gate_pass:true`, exit 0 produced. Keep that result and the
   real review alongside the exact PR/commit. Do not change HEAD afterward.

This is an operator-owned quality workflow, not a sandbox against hostile
concurrent edits. Before/after hashes detect ordinary drift, but a temporary
replacement restored before the final snapshot can evade them. No filesystem
lock or immutable execution copy is claimed. The result records this assumption.
If exclusive ownership is unknown, do not attest it or use this route; retain
the full gate and stop for coordination. This operational boundary requires
explicit acceptance when the proposed rule is reviewed for activation.

The gate has no arbitrary command flag, elevation, PowerShell policy argument,
Git trust override, automatic fallback/retry, alternate fixture location or lock
removal. Timeout/launch denial/failed cleanup means stop and inspect the state.
Normal permissions and the operator's actual execution authorization still apply;
no old one-time escalation can be reused.

## Operator confirmation and conservative fallback

These confirmations are operational evidence, not guarantees made by JSON fields
or by before/after hashing.

1. Assign a dedicated checkout and one named owner. The coordinator checks the
   actual task/worktree assignments and obtains confirmation that no other
   agent, editor or test job will write to it through validation and delivery.
   Keep the owner, root, base, head and confirmation time outside the candidate.
   Do not query denied process interfaces or close anyone else's editor. If
   ownership cannot be established, do not set `--exclusive-candidate` or attest
   `exclusive_candidate`: require the existing full gate; stop if it cannot run.

2. Confirm current remote main through an authorized normal synchronization and
   match that full SHA to the local `origin/main` used as base. A failed fetch,
   missing object or unverified freshness is insufficient. The tool checks the
   local facts but does not fetch or prove that a stale ref is current.

3. Assign a different reviewer who did not author the candidate. Before changed
   tests execute, that reviewer reads the exact inspected diff and fingerprint.
   The coordinator reads the actual completed review and verifies its source,
   reviewer identity, time, exact target and approved verdict with no unresolved
   findings. Preserve it outside the candidate. A hand-written JSON identity,
   author/reviewer name mismatch alone, missing report or unverified independence
   is insufficient. If genuine approval cannot be confirmed, require full gate;
   do not fabricate approval or execute the changed tests through this route.

4. Record the exact run result and keep the checkout exclusively owned through
   delivery. Any candidate/base/content change invalidates the earlier review
   and test result. Confirm the delivered target blobs and corresponding review
   and result. Do not reuse a historical pass or clear a lock/retry automatically.

Unknown scope, untracked/ignored files, an unverified base, missing exclusive
ownership, unverified review authenticity or any failed check always returns to
the full-gate requirement. This does not automatically launch the full runner.
If the full runner exceeds current authorization or is unavailable, stop and
report the exact blocker. Do not bypass an action denial.

## Changes to this rule itself

AGENTS, this definition, the gate implementation, its tests, the full runner and
other documentation are outside the two-file route. Their own change requires
the existing full gate, or a separately and explicitly approved exception for
that exact rule-change PR. The narrow gate never supplies its own approval.
Public transmission of these new files requires its own exact-file authorization;
the earlier PR481 two-file code publication approval does not cover them.
