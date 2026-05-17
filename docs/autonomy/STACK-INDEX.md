# Stack Index — music-stack

music-stack を触るエージェントが **最初に読む構造マップ**。
役割・境界の人間向け正本は [`../music-stack-integration-index.md`](../music-stack-integration-index.md)。
こちらは機械可読な短縮版（リンクで繋ぎ、内容は重複させない）。

作業フローは [`AUTONOMOUS-RUN.md`](AUTONOMOUS-RUN.md)、待ち行列は [`BACKLOG.md`](BACKLOG.md)。

## Active repos (5)

ローカル配置: `C:\workspace\music-stack\<repo>`
deploy はすべて GitHub Pages（`<remote>` の main ブランチ）。

| repo | 役割（1行） | deploy | remote | AGENTS.md | check コマンド（repo root から） |
|---|---|---|---|---|---|
| `Music` | central conductor。Band Room / Hazama FM / Music Core Rig の runtime | quietbriony.github.io/Music | QuietBriony/Music | `Music/AGENTS.md` | `audit.py` + `check-js` + `check-band-room-logic` + `check-fm-route-badge` + `check-hazama-melody` |
| `chill` | quiet piano / trio / long-form listening surface | quietbriony.github.io/chill | QuietBriony/chill | `chill/AGENTS.md` | `node scripts/check-pwa-static.mjs` |
| `drum-floor` | rhythm / groove / VCV / stage-safety reference | quietbriony.github.io/drum-floor | QuietBriony/drum-floor | `drum-floor/AGENTS.md` | `python -m pytest tests/ -q` |
| `namima` | public-friendly ambient visual player | quietbriony.github.io/namima | QuietBriony/namima | `namima/AGENTS.md` | `node scripts/check-music-session-adapter.mjs` + `check-pwa-static.mjs` |
| `openclaw` | music-stack control desk / session planner | quietbriony.github.io/openclaw | QuietBriony/openclaw | `openclaw/AGENTS.md` | `node scripts/check-pwa-static.mjs` + `python -m pytest tests/ -q` |

> **5 repo まとめての検証** は Music repo root で `node scripts/stack-check.mjs`。
> 各 repo の `scripts/audit.py` / `scripts/check-*.mjs` / `tests/test_*.py` を
> 自動発見して集約実行し、統一 PASS/FAIL を出す。`0 BAD` が commit の前提。
> 公開後の軽い疎通確認が必要な時だけ `node scripts/stack-check.mjs --deploy-health` を使う。
> active 5 repo の GitHub Pages URL が HTTP 200 を返すかを追加で見る（通常 gate には混ぜない）。

## Archived repos（触らない）

| repo | 状態 |
|---|---|
| `namima-lab` | lineage / staging / harvest-only。active runtime として revive しない |
| `test` | archive candidate / harvest-only。primary runtime にしない |

archive 操作・復活・削除は別承認が必要。本エンジンの対象外。

## Cross-repo coordination

- 連携は **metadata-only**（session packet / SYNC / sidecar / trace）。
  音源・サンプル・歌詞・録音は移植しない。
- `Music` が conductor。sister repo の runtime 所有権は奪わない。
- 詳細: [`../music-orchestra-protocol.md`](../music-orchestra-protocol.md) /
  [`../music-stack-sync-manual.md`](../music-stack-sync-manual.md)

## 注記

- music-stack 直下（`C:\workspace\music-stack`）は git 管理外。
  エンジンの正本はすべて git 管理下の `Music/docs/autonomy/` に置く。
- 各 repo の commit 前チェックは、その repo の `AGENTS.md` 冒頭にも明記。
