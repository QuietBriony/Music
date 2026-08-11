# Chrome Computer Use Baseline — music-stack

## Purpose

ChatGPT Desktop / Codex から Google Chrome を使って Music の公開画面を確認する時の、
非秘密・PC 間共有可能な正本。Chrome profile や ChatGPT の設定そのものを backup
する文書ではない。

- Git で共有するもの: 対象 machineName、使う profile の表示名、許可する host、
  検証日、再現手順、失敗時の止まり方。
- 各 PC にだけ置くもの: Google account、cookie、token、browser history、password、
  Chrome user-data、ChatGPT の端末設定。
- 実状態は常にその PC の ChatGPT Settings と Chrome が正。本文は再現用 baseline
  なので、別 PC で未確認の状態を `verified` と推測しない。

OpenAI の現行手順でも、Chrome extension は実際に使う Chrome profile で有効にし、
サイトごとの許可は ChatGPT Desktop の
`Settings > Computer Use > Google Chrome > Manage` で管理する。

Official reference:
[Chrome extension | ChatGPT Learn](https://learn.chatgpt.com/docs/chrome-extension)

## Shared safety boundary

- Music の通常 QA は host 単位の site-specific allow を使う。全サイトを対象にする
  設定は共通 baseline にしない。
- 通常の許可対象は `https://quietbriony.github.io`。別 origin、upload、login、
  browser history が必要な時は、その task の目的と user 承認を別途確認する。
- full email address、extension の一時 instance ID、cookie、個人 tab の title / URL、
  browsing history、スクリーンショット中の個人情報は repo に記録しない。
- Chrome profile directory、extension directory、ChatGPT app data を PC 間コピーしない。
  Git で共有するのは本 runbook とコードだけにする。
- permission prompt が出たら task に必要な範囲で `Allow once` を使える。拒否状態や
  browser safety interstitial は迂回しない。

## WorkerPC snapshot — 2026-08-11

| Item | Recorded state | Evidence |
|---|---|---|
| machine identity | `worker-gaming`; bound hostname matches current host | `scripts/music-machine.ps1 -Json` observed |
| browser family | Google Chrome, extension connection active | Chrome control runtime observed |
| Chrome profile display name | `ユーザー 2` | extension metadata observed |
| Chrome profile directory label | `Profile 1` | user-confirmed |
| signed-in account hint | `chouta88@…` only; full address intentionally omitted | user-confirmed |
| Music site permission | `https://quietbriony.github.io` is in the site allowlist | user-confirmed; direct page access succeeded |
| connection diagnostics | Chrome、extension、native host diagnostics were normal | 2026-08-11 audit evidence |
| known profile opener | active bundled Chrome plugin の `scripts/open-chrome-window.js --browser chrome` | 2026-08-11 recovery evidence |
| verified Music target | `https://quietbriony.github.io/Music/band-room.html?band=hazama` | 01/02 screenshot + short-play audit succeeded |
| task permission | audit task was Full access; do not assume this for later tasks | task-scoped user statement |

The 2026-08-11 audit created local evidence under
`C:\workspace\music-stack\audit-output\hazama-v399-local-2026-08-11`.
That folder is machine-local evidence and is not a portable Chrome profile backup.

## WorkerPC operating sequence

1. Confirm the physical PC before machine-specific work:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\music-machine.ps1 -Json
   ```

   Continue only when `machine_name` is `worker-gaming` and `hostname_match` is `true`.
2. Open Google Chrome profile `ユーザー 2` (`Profile 1`). The account hint may be used for
   human recognition, but never expand it into a full address in logs or docs.
3. Confirm the ChatGPT Chrome plugin is on and the extension is enabled in that same profile.
4. In ChatGPT Desktop, confirm `https://quietbriony.github.io` is allowed under
   `Settings > Computer Use > Google Chrome > Manage` and is not blocked.
5. After changing a saved site decision, start a new ChatGPT Work / Codex task. An older task
   may retain its previous refusal state.
6. Open the exact Music URL directly. Capture the before-action screenshot before clicking
   `START` or changing controls.
7. Keep approved listening short. Do not turn a browser QA task into automatic long playback,
   upload、download、MIDI、DAW arm、or device control.
8. Name the Chrome task session. Make `tabs.finalize` the final Chrome operation and keep no
   tab unless the user needs a live handoff.

When the extension is installed correctly but the wrong Chrome profile opens, use the current
bundled Chrome plugin's `scripts/open-chrome-window.js --browser chrome`; do not hard-code the
plugin cache version into this repo.

## Connection failure — fail closed

1. Check the ChatGPT Google Chrome blocklist before retrying.
2. Confirm the extension is enabled in the currently active Chrome profile, not only another
   profile.
3. Reopen the side chat / extension, then start a fresh task after a permission change.
4. Restart Chrome and ChatGPT Desktop if the native connection is stale.
5. If the site is still declined, stop and report the exact host and decision. Do not substitute
   another browser or bypass the browser's safety state unless the user explicitly changes the
   requested surface.

## Mother-machine and other-PC sharing

The shared target is configuration parity, not profile cloning.

| Machine | Shared through Git | Must be configured locally | Status on 2026-08-11 |
|---|---|---|---|
| `worker-gaming` | this runbook and Music QA procedure | `ユーザー 2` extension state and Music site allow | verified |
| `chouta-surface` (母艦) | this runbook, target host, fail-closed procedure | its own chosen Chrome profile, extension install, site allow | not verified in this task |
| `studioPC` | this runbook when browser QA is needed | its own chosen profile and site allow | not verified in this task |

For `chouta-surface` or `studioPC`, repeat setup in the Chrome profile actually used on that PC.
Do not assume the WorkerPC profile name, account, extension state, or allowlist synchronizes with
Chrome Sync. Record a new dated snapshot only after a direct Music page open and a benign
before-action screenshot succeed.

## Update discipline

- Update the dated machine row when profile selection, site permission, plugin connection, or
  recovery behavior changes.
- Mark facts as `observed`, `user-confirmed`, or `not verified`; do not merge those evidence
  levels.
- Never record ephemeral browser / extension instance identifiers.
- If this baseline changes, keep links in `README.md`, `docs/PC-REGISTRY.md`,
  `docs/WORKER-GAMING-RUNBOOK.md`, `docs/NEW-PC-SETUP.md`, and
  `docs/runtime-browser-listening-checklist.md` intact.
