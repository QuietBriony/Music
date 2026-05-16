# Autonomous Run — プレイブック

music-stack を 1 session 進めるための定型手順。Claude / Codex / 人間の誰が回しても
同じ品質になるよう、開始から締めまでをここに固定する。

**手動トリガ自律ラン**: スケジュール自動実行はしない。あなた（または Codex）が
この手順を起動するたびに BACKLOG が 1 段進む = 計算資源が有機的に投入される。

## 0. 前提

- 作業ルート: `C:\workspace\github-inventory\music-stack`
- 各 repo の絶対ルール: その repo の `AGENTS.md`
- 安全上限: `README.md` の「自律ランの安全上限」

## 1. オリエンテーション（読む）

1. `Music/docs/autonomy/STACK-INDEX.md` — repo 構造
2. `Music/docs/autonomy/SESSION-LEDGER.md` — 最新エントリ（前 session の next / blockers）
3. `Music/docs/autonomy/BACKLOG.md` — 待ち行列の上位
4. 触る repo の `AGENTS.md`

## 2. ベースライン確認（壊れていない所から始める）

```
cd C:\workspace\github-inventory\music-stack\Music
git pull --ff-only origin main          # 触る repo それぞれで
node scripts/stack-check.mjs            # → "0 BAD" を確認
```

`0 BAD` でなければ、まずそれを直す。直せないなら SESSION-LEDGER に記録して停止。

## 3. タスク選択

BACKLOG から、**この session で完了でき、`human-gate=no` または gate を踏める**
最上位 item を 1〜数個選ぶ:

- `human-gate: yes` で実機 / 試聴が要る item は自律ランでは **実装 + PR まで**。検証は人間。
- `scope: engine` は対象外。
- 並列でやるなら **write scope が repo 単位で完全分離** している item だけ（衝突回避）。

## 4. 実行

- docs / BACKLOG 整備 → main 直 push 可
- 非 engine コード → `feature/<topic>` branch で作業し PR を立てる。**無人 merge しない**
- cache buster を伴う UI 変更は、その repo の `AGENTS.md` の同期 bump 手順に従う
- engine.js / index.html / style.css は触らない

## 5. 検証

```
node scripts/stack-check.mjs            # → "0 BAD"
```

音を変えた場合は `docs/runtime-browser-listening-checklist.md` の該当項目も。

## 6. 締め（記録）

- `BACKLOG.md`: 消化した item を `## Done` へ、発見した新タスクを追記
- `SESSION-LEDGER.md`: 新エントリを先頭に追記（形式は同ファイル参照）
- Music の runtime を変えたら version を bump（`AGENTS.md` の cache buster discipline）
- commit（1 機能 1 commit、既存 message スタイル）→ docs は push / コードは PR
- 人間へ: 何を出したか + 次の推奨 BACKLOG item を簡潔報告

## コピペ用プロンプト

新しい Claude / Codex session にこれを貼れば、この手順を自走する:

```
music-stack の自律ランを 1 回回して。起点は C:\workspace\github-inventory\music-stack\Music

手順は Music/docs/autonomy/AUTONOMOUS-RUN.md に従う:
1. STACK-INDEX / SESSION-LEDGER 最新 / BACKLOG / 対象 repo の AGENTS.md を読む
2. node scripts/stack-check.mjs で 0 BAD を確認
3. BACKLOG 最上位で、この session で完了できる human-gate=no の item を選ぶ
4. 安全上限内で実行（engine.js 不可 / 無人 merge 不可 / 非 engine は branch+PR）
5. stack-check で 0 BAD を再確認
6. BACKLOG と SESSION-LEDGER を更新、commit、人間へ報告

重い R&D は Codex に投げてよい（docs/CODEX-HANDOFF.md）。
```

## Codex に投げる場合

重い実装 R&D は `docs/CODEX-HANDOFF.md` 経由で Codex CLI へ。
BACKLOG の `agent: codex` / `agent: either` item が候補。Codex も本プレイブックの
2→6 を踏む。次タスクの正本は CODEX-HANDOFF ではなく **BACKLOG.md**。
