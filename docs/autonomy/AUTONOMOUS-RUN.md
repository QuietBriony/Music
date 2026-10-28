# Autonomous Run — プレイブック

## 通常の改善は検証後に本番へ（2026-10-28・本人指示）

本人が任せたMusic関連の改善は、公開前の人間レビュー・試聴承認を必須にしない。
PWAは既存の本番へ出してから本人が聴く運用とし、実装 → 必須検証 → 自分の差分確認 →
merge / main push → 既存の本番へdeploy → 公開版とPWAの更新確認 → 本人の感想で調整、まで進める。
通常の全件検査経路では、別担当の独立レビューも公開の必須条件にしない。
同じ最終HEADのstack-check（FAIL 0 / SKIP 0 / 0 BAD）、各repoの必須検査、cache同期、
担当scope・clean状態・変更履歴・公開反映の証拠・ロールバック手段は維持する。
実iPhoneの聴感が未確認でも公開を止めず、未確認と明記して本番での試聴へ渡す。
新しい公開先、未承認の音源追加、認証や権限の変更、外部機器のarm・record・MIDI送信などは
この通常公開ルールへ含めない。各アプリ自身の手動開始・metadata-onlyの境界も維持する。

music-stack を 1 session 進めるための定型手順。Claude / Codex / 人間の誰が回しても
同じ品質になるよう、開始から締めまでをここに固定する。

**手動トリガ自律ラン**: スケジュール自動実行はしない。あなた（または Codex）が
この手順を起動するたびに BACKLOG が 1 段進む = 計算資源が有機的に投入される。

## 0. 前提

- 作業ルート: `C:\workspace\music-stack`
- 各 repo の絶対ルール: その repo の `AGENTS.md`
- 安全上限: `README.md` の「自律ランの安全上限」

## 1. オリエンテーション（読む）

1. `Music/docs/autonomy/STACK-INDEX.md` — repo 構造
2. `Music/docs/autonomy/SESSION-LEDGER.md` — 最新エントリ（前 session の next / blockers）
3. `Music/docs/autonomy/BACKLOG.md` — 待ち行列の上位
4. `Music/config/autonomy-doc-currency.json` — handoff / architecture / ledgerの事実基準
5. 触る repo の `AGENTS.md`

## 2. ベースライン確認（壊れていない所から始める）

```
cd C:\workspace\music-stack\Music
git pull --ff-only origin main          # 触る repo それぞれで
node scripts/stack-check.mjs            # → "0 BAD" を確認
```

`0 BAD` でなければ、まずそれを直す。直せないなら SESSION-LEDGER に記録して停止。

## 3. タスク選択

BACKLOG から、**この session で完了でき、`human-gate=no` または gate を踏める**
最上位 item を 1〜数個選ぶ:

- `human-gate: yes`でも、通常のPWA改善は必須検証後に既存本番へ公開する。本人の実機・試聴結果は公開後に確認し、未確認を合格扱いしない。外部機器の操作など個別の実行承認は別途守る。
- `scope: engine` は対象外。
- 並列でやるなら **write scope が repo 単位で完全分離** している item だけ（衝突回避）。

## 4. 実行

- docs / BACKLOG / 検証 script → main 直 push
- 非 engine の app コード → 実装 → `stack-check` 0 BAD → merge・本番デプロイまで自律実行
  （プロジェクトオーナー指示でデフォルト ON。2026-05-16〜）
- cache buster を伴う UI 変更は、その repo の `AGENTS.md` の同期 bump 手順に従う
- currency manifestの監視pathを変えた場合は、対応するcurrent docも同じworktreeで更新する。
  `check-autonomy-doc-currency.mjs`はdirty sourceだけ、またはdocより新しいcommitted sourceを拒否する
- engine.jsの変更境界はMusic/AGENTS.mdを守る。index.html / style.cssの通常UI改善も、必須検証後に既存本番へ公開する

## 5. 検証

```
node scripts/stack-check.mjs            # → "0 BAD"
```

GitHub Pages 反映後の疎通だけ確認したい時は任意で:

```
node scripts/stack-check.mjs --deploy-health
```

音を変えた場合は `docs/runtime-browser-listening-checklist.md` の該当項目も。

## 6. 締め（記録）

- `BACKLOG.md`: 消化した item を `## Done` へ、発見した新タスクを追記
- `SESSION-LEDGER.md`: 新エントリを先頭に追記（形式は同ファイル参照）
- Music の runtime を変えたら version を bump（`AGENTS.md` の cache buster discipline）
- commit（1 機能 1 commit、既存 message スタイル）→ `stack-check` 0 BAD を確認して push（本番デプロイ）
- 人間へ: 何を出したか + 次の推奨 BACKLOG item を簡潔報告

## コピペ用プロンプト

新しい Claude / Codex session にこれを貼れば、この手順を自走する:

```
music-stack の自律ランを 1 回回して。起点は C:\workspace\music-stack\Music

手順は Music/docs/autonomy/AUTONOMOUS-RUN.md に従う:
1. STACK-INDEX / SESSION-LEDGER 最新 / BACKLOG / 対象 repo の AGENTS.md を読む
2. node scripts/stack-check.mjs で 0 BAD を確認
3. BACKLOG 最上位で、この session で完了できる human-gate=no の item を選ぶ
4. 安全上限内で実行（engine.js 不可 / 非 engine は stack-check 0 BAD 後 merge・本番デプロイまで）
5. stack-check で 0 BAD を再確認
6. BACKLOG と SESSION-LEDGER を更新、commit、人間へ報告

重いR&Dは`docs/CODEX-HANDOFF.md`の現行resource boundaryに従う。GPU / model download /
executionはmachine capabilityとoperatorの明示許可が揃う時だけで、自動開始しない。
```

## Codex CLI で回す場合

このプレイブックは Claude / Codex どちらでも同じ手順。Codex CLI の場合:

1. `cd C:\workspace\music-stack\Music`
2. `codex` を起動
3. 上の「コピペ用プロンプト」をそのまま貼る（Codex もこの 1〜6 を踏む）
4. claim ルール（下記）に従い BACKLOG の `agent: codex` / `agent: either` item を 1 つ取る
5. 目安: 重い実装 R&D は Codex、UI/UX・統合・docs は Claude が得意

Codex 固有の入口と並列開発の詳細は `docs/CODEX-HANDOFF.md` と
`docs/COLLAB-CLAUDE-AND-CODEX.md`。次タスクの正本は **BACKLOG.md**。

## 共同開発（Claude + Codex 並走）

複数エージェントが同時に回す前提のルール:

- **claim してから着手** — BACKLOG item に `status: wip — <agent> <date>` を足し、
  その 1 行を即 commit + push。他エージェントは `git pull --ff-only` で見てから
  別 item を取る（詳細は `BACKLOG.md` の claim ルール）。
- **repo 単位で割る** — 同じ repo / 同じファイルを 2 エージェントで触らない。
  write scope を分ければ並列で衝突しない。
- **shared file** — `BACKLOG.md` / `SESSION-LEDGER.md` / `STACK-INDEX.md` は
  作業前後に `git pull --ff-only`。衝突したら両者の意図を残して rebase 解決。
- **engine bookkeeping は Music 起点で** — BACKLOG / LEDGER の更新は Music repo を
  起点にしたセッションで行う（sister repo だけ開いた Codex は実装に専念）。
