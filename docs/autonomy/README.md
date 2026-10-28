# Autonomous Development Engine — music-stack

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
| `../../config/autonomy-doc-currency.json` | handoff / architecture / ledgerの事実基準commitと監視path |
| `../../scripts/check-autonomy-doc-currency.mjs` | 基準以後のruntime/config変更に対するdocs追随をnetworkなしで検証 |

## 設計思想

- **本番PWAで聴いて育てる。** 通常の改善は公開前の人間レビューを必須にせず、0 BAD・in-scope・cleanな検証済みbranchを既存本番へ反映する。本人の実音・実機の感想は公開後に受け取り、測定の合格と聴感を分ける。
- **有機的な compute 投入。** BACKLOG にアイデアが溜まり、session ごとに上から
  消化され、発見した新タスクが追記される。スケジュール自動実行はしない（手動トリガ）。
- **正本を分散させない。** STACK-INDEX は機械可読な構造マップ、
  `docs/music-stack-integration-index.md` が役割・境界の人間向け正本。リンクで繋ぎ重複させない。
- **事実の古さを隠さない。** `last_verified_commit`より新しい監視対象を変える時は、対応docsも
  同じworktreeまたは後続commitで更新する。branch名・日付・ahead件数だけではcurrentと判定しない。

## 自律ランの安全上限

自律 session が、自分の判断で変更してよい範囲:

- ✅ docs / BACKLOG / SESSION-LEDGER / 検証 script（`check-*` 等）— main 直 push
- ✅ 非 engine の app コード（`fm.js` / `fm.css` / `presets` / 各 sister repo runtime）
  — 実装し、**`stack-check` 0 BAD を確認のうえ merge・本番デプロイ（main push）まで自律実行**
- ⚠ `engine.js`はMusic/AGENTS.mdの変更境界に従う。`index.html` / `style.css`の通常UI改善は検証後に公開できる
- ❌ GitHub Actions 追加、archive/delete/settings、dependency 追加、
  音源 / サンプル / 歌詞の追加
- ⚠ `human-gate: yes` の item（実機 / 試聴が要る）はコードは出してよいが、
  実環境での最終確認は人間

> merge + 本番デプロイのデフォルト ON はプロジェクトオーナーの標準指示（2026-05-16〜）。
> v174 初期設定の「merge は人間」を更新。`stack-check` 0 BAD が常に前提。

詳細は各 repo の `AGENTS.md` と `AUTONOMOUS-RUN.md`。

## 使い方

`AUTONOMOUS-RUN.md` を開き、手順に従う（コピペ用プロンプトあり）。
1 session = 「BACKLOGから取る → 実装 → 必須検証 → 記録 → 既存本番へ公開 → PWAで試聴 → 調整」。

Claude と Codex は同じプレイブックで回す。並走するときは `BACKLOG.md` の
claim ルールに従う（item を取ったら `status: wip` 行を即 commit）。
