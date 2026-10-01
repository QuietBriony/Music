# Stack Index — music-stack

music-stack を触るエージェントが **最初に読む構造マップ**。
役割・境界の人間向け正本は [`../music-stack-integration-index.md`](../music-stack-integration-index.md)。
こちらは機械可読な短縮版（リンクで繋ぎ、内容は重複させない）。

作業フローは [`AUTONOMOUS-RUN.md`](AUTONOMOUS-RUN.md)、待ち行列は [`BACKLOG.md`](BACKLOG.md)。

利用者の入口は [`../../listen.html`](../../listen.html) →
[`../MUSIC-STACK-SYSTEM-MANUAL.md`](../MUSIC-STACK-SYSTEM-MANUAL.md)。
道具の役割・実装状態・入口は`config/music-stack-tools.json`から同じ一覧を生成し、
`check-music-stack-guide.mjs`で表示と根拠pathを検証する。5 repo構成・private境界は不変。

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

## Optional private operator overlay（runtime ではない）

同じ workspace に private `music-ops` repo が存在する場合、所有機材、実配置、
物理制約、machine observation、常用 routing の正本として参照する。

| repo | 役割 | deploy | active-stack count | check |
|---|---|---|---|---|
| `music-ops` | optional private operator overlay。実機・配線・配置の private source of truth | なし | **含めない** | repo 内で `node scripts/check-music-ops.mjs` |

- active runtime は引き続き上記 5 repo だけ。
- Music の public clone / CI に `music-ops` がなくても正常。存在しない場合は実機状態を
  推測せず、public-safe な workflow と `needs_verification` だけを扱う。
- private label、hostname、財務情報、exact routing を public Music へコピーしない。
- `test` / `namima-lab` を overlay や hardware repo へ転用しない。

## Archived repos（履歴と回収済みアイデアを保管）

| repo | 状態 | harvest 完了マーカー |
|---|---|---|
| `namima-lab` | GitHub正式archive済み 2026-10-01。lineage / harvest-only | BL-019 ✅ 2026-05-25 — organic-pluck recipe → `namima/docs/organic-pluck-lab-recipe.md` (namima PR #32) |
| `test` | GitHub正式archive済み 2026-10-01。harvest-only | BL-019 ✅ 2026-05-25 — style archetype → `Music/references/style-archetype-from-test.json` + `Music/docs/test-style-archetype-translation.md` (Music PR #249) / probability interpolation → `drum-floor/docs/probability-interpolation-from-test.md` (drum-floor PR #52) |

2026-10-01の本人の「半端な分は統合して整理やアーカイブしてっていいよ」を受け、
両repoのREADME、mainの最新commit、open PRなし、回収先の存在を照合して正式archive。
GitHub APIで両方の`archived: true`を確認。コード・履歴は削除しない。
今後の復活や他repoのarchiveは現在の用途と回収先を確認してから判断する。
判断・固定SHA・残すエッセンスは[`../archive-repo-harvest-audit.md`](../archive-repo-harvest-audit.md)。

## 2026-10-01の整理と再構築

- Listenの既存台帳を「演奏・練習」「静かに聴く」「作品棚・段取り」「PC制作」「試作・設計」に整理。
- `chill`は音が動作し、ピアノと余白に独自の役割があるため保管だけにしない。
- `openclaw`は段取りの道具。音源の再構築先にはしない。
- ギター／ベース／ドラムの新中核は既存Band Room内の任意試奏から始める。
  [`../PHYSICAL-BAND-REHEARSAL.md`](../PHYSICAL-BAND-REHEARSAL.md)の8小節を試し、
  合格した部品だけをARCBのscoreへ接続する。既存engine全置換を先行しない。

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
