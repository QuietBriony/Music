# Autonomous Development Engine — music-stack

このフォルダは music-stack（Music + sister repo 群）を **長期にわたり、誰が回しても
同じ品質で** 自走開発するための運用エンジンです。新しい session のエージェント
（Claude / Codex / 人間）が **最初に読む入口** をここに集約しています。

## なぜあるか

これまで「次に何をやるか」は `docs/USER-NOTES-MEMO.md` の残課題、
`docs/CODEX-HANDOFF.md` の候補、`docs/music-stack-integration-index.md` §7 など
複数の docs に散在していた。新しい session が毎回それを読み集めるのは摩擦が大きく、
「計算資源を有機的に投入し続ける」妨げになっていた。
このエンジンは **入口・作業待ち行列・検証・記録** を 1 箇所に束ねる。

## ファイル

| ファイル | 役割 |
|---|---|
| `STACK-INDEX.md` | 5 active repo の構造マップ（role / URL / remote / AGENTS.md / check コマンド）。最初に読む |
| `BACKLOG.md` | 優先度付きの作業待ち行列。固定スキーマの item。ここから次の仕事を取る |
| `SESSION-LEDGER.md` | 追記専用のセッション台帳。各 session が何をやったか / 次に何を残したか |
| `AUTONOMOUS-RUN.md` | 自律ランのプレイブック。session 開始時に踏む手順 + コピペ用プロンプト |
| `../../scripts/stack-check.mjs` | 5 repo の既存チェックを 1 コマンドで集約実行する整合性ゲート |

## 設計思想

- **human-gated を壊さない。** このエンジンは「人を外す」ものではなく、人が回す
  1 session を、誰がやっても迷わず・速く・安全にするための足場。merge と
  音の最終判断は人間が持つ（`Music/AGENTS.md` の hard rules 準拠）。
- **有機的な compute 投入。** BACKLOG にアイデアが溜まり、session ごとに上から
  消化され、発見した新タスクが追記される。スケジュール自動実行はしない（手動トリガ）。
- **正本を分散させない。** STACK-INDEX は機械可読な構造マップ、
  `docs/music-stack-integration-index.md` が役割・境界の人間向け正本。リンクで繋ぎ重複させない。

## 自律ランの安全上限

人が逐一見ていない自律 session が、自分の判断で変更してよい範囲:

- ✅ docs / BACKLOG / SESSION-LEDGER の整備 — main 直 push 可
- ✅ 非 engine コード（`fm.js` / `fm.css` / `presets` / 各 sister repo の runtime 以外）
  — **feature branch + PR まで**。merge は人間
- ❌ `engine.js` / `index.html` / `style.css` — 対象外（要・人間 + 別 PR）
- ❌ 無人 merge、GitHub Actions 追加、archive/delete/settings、dependency 追加、
  音源 / サンプル / 歌詞の追加

詳細は各 repo の `AGENTS.md` と `AUTONOMOUS-RUN.md`。

## 使い方

`AUTONOMOUS-RUN.md` を開き、手順に従う（コピペ用プロンプトあり）。
1 session = 「BACKLOG から取る → やる → stack-check → 記録 → 人間レビューへ」。

Claude と Codex は同じプレイブックで回す。並走するときは `BACKLOG.md` の
claim ルールに従う（item を取ったら `status: wip` 行を即 commit）。
