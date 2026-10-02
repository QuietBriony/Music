# Collab: claude code と codex の並列開発プレイブック

Music repo を **claude code (Anthropic) と codex (OpenAI) の両方** で
継続開発するためのガイド。先に [`AGENTS.md`](../AGENTS.md) を読むこと。

---

## なぜ並列開発したいか

- **計算資源が余ってる方を使う** — codex chat で context 詰まったら claude code、claude のセッションが長くなったら codex に振る
- **視点が違う** — claude は repo 全体俯瞰 + UX、codex は narrow な実装 + 各 repo の事情に詳しい
- **片方が止まっても止まらない** — A が編集中でも B が別領域を磨ける
- **共通の整合性ガード** — `node scripts/stack-check.mjs`で5 repoの既存検査を集約し、個別auditだけで完了扱いしない

---

## 役割分担 (おすすめ)

### claude code が得意なこと

- アーキテクチャ全体図 (HAZAMA-FM-ARCHITECTURE.md レベルの文書化)
- UI/UX レイヤー (fm.html / fm.js / fm.css)
- preset 取り込み (sister repo の main から `curl` → `presets/`)
- `audio/genre-flavor.js` の builder 拡張
- 整合性 audit script の保守 + 拡張
- 複数 agent / 複数 repo を跨ぐ orchestration (computer-use 経由で codex 起動も含む)
- ドキュメント (USAGE-*.md / SCHEMA / ARCHITECTURE)
- cache buster discipline
- 軽量な main 直 push 改善 (LEVEL_BY_GENRE 1 行変更等)

### codex が得意なこと

- sister repo (chill / drum-floor / namima) の deep export (recipe / frames / mood の刷新)
- Music 内 `engine.js` への深い拡張 (12k 行を読む人手の補完)
- 特定の narrow なバグ修正 (specific PR で完結する形)
- 既存 PR への自動 review コメント
- repo 横断の review packet 生成 (OpenClaw 等との連携)
- node スクリプト経由の自動検証 (codex はローカル実行が強い)

### 両方とも得意 (どちらが空いてる方でやる)

- preset JSON 値の微調整 (`LEVEL_BY_GENRE` の数値、builder volume 等)
- USAGE / ARCHITECTURE / SCHEMA の磨き
- audit script の拡張
- README link 整理

---

## 並列衝突回避フロー

### 作業前

```bash
git fetch origin --quiet
git pull --ff-only origin main
node scripts/stack-check.mjs
python -X utf8 scripts/audit.py   # 0 BAD / 0 WARN 確認
```

直近 commit history を確認:
```bash
git log --oneline -10
```
他 agent の最近 commit が `fm.js` や `audio/genre-flavor.js` を触ってたら、
そのファイル付近を作業する場合は要注意。

### 作業中

- 大きな改修は **feature branch** に切る (`feature/<topic>`)
- 小さい修正は main 直接でも OK (cache bump、LEVEL_BY_GENRE 微調整等)
- 同じファイル領域で衝突しそうな改修は branch + PR で安全に

### 同じHEADの完了証跡

Claude単独・Codex単独・並走・引継ぎのどの入口でも、最新mainの同期と衝突解消を終えてから
`node scripts/stack-check.mjs`を実行する。**終了コード0、FAIL 0 / SKIP 0、0 BAD**が必要。
`--allow-skip`は診断用であり、その0 BADを全通過・完了証拠として扱わない。
個別4checkは原因調査とAGENTSのcommit前検査に使えるが、全体gateの代用にはしない。

記録するのは作業worktreeの絶対path、同期したmainのSHA、候補の`git rev-parse HEAD`、実行コマンド、
終了コードとPASS/FAIL/SKIP、auditの0 BAD / 0 WARN、ログの場所、独立レビューの対象HEADと未解決事項。
5 repoの検査対象もHEADとdirtyの有無を控える。実行後のHEAD・作業差分と対象repoの状態が変わったら証拠は失効する。
rebase・merge・衝突解消・追加commitの後は、古いログを流用せず新しい最終HEADで全体gateと必要レビューを再確認する。
文書検査はこの手順の省略を検出するだけで、実際に検証を実行した証明にはならない。

### 作業後 (commit / push 前)

自分のworktreeだけで作業する。未commit差分はAGENTSのcommit前gateと全体gateを通して、
自分の変更だけを候補commitへまとめる。他担当のdirtyなworktreeでpull/rebase/stashを開始しない。
以下はcleanなfeature branchの候補commitを同期し、**同期後の同じHEAD**を検証してpushするbash記法の例。
既にpush済みのbranchは通常mergeを使い、未公開の自分のcommitだけならrebaseでもよい。強制pushは禁止。
PowerShellでは各コマンドの`$LASTEXITCODE`を確認し、非0ならそこで停止する。

```bash
set -e
git fetch origin --quiet
git merge origin/main
test -z "$(git status --porcelain)"
FINAL_HEAD=$(git rev-parse HEAD)
node scripts/stack-check.mjs
python -X utf8 scripts/audit.py   # 0 BAD / 0 WARN 必須
test "$(git rev-parse HEAD)" = "$FINAL_HEAD"
test -z "$(git status --porcelain)"
git push origin HEAD
```

### 衝突したら

自分の候補branchで両者の意図を確認し、難しい判断は保留する。
公開済みbranchのmergeなら解消後の候補commitを作り、「作業後」の全体gateへ戻る。
未公開の自分のbranchのrebaseなら、全衝突を解消してstageし、最後のcontinueを完了してから再検証する。
audit/check-jsの2checkだけでpushしない。例えば最後のrebase continueからの手順は:

```bash
set -e
git rebase --continue
test -z "$(git status --porcelain)"
FINAL_HEAD=$(git rev-parse HEAD)
node scripts/stack-check.mjs
python -X utf8 scripts/audit.py   # 0 BAD / 0 WARN 必須
test "$(git rev-parse HEAD)" = "$FINAL_HEAD"
test -z "$(git status --porcelain)"
git push origin HEAD
```

---

## 「マージして」自然言語パターン (codex 専用)

codexの各taskへ「マージして」と送った場合も、下のagent merge条件と「同じHEADの完了証跡」を確認してから:
```
gh pr merge <PR#> --merge --delete-branch
git switch main
git pull --ff-only origin main
```
が自動実行されて main 同期まで完了する。

claude code はこのパターンを使わず、`gh pr merge` を直接呼ぶか
ローカルから直接 main に push する (gh CLI 認証は user のもの)。

### agent merge が使える条件

- 対象 PR / branch が今回 user から任された作業に属する
- mergeable / clean な状態
- 「作業後」の同期・衝突解消後の最終HEADで`node scripts/stack-check.mjs`が終了コード0、FAIL 0 / SKIP 0、0 BAD
- `--allow-skip`による診断ログを使わず、独立レビューの対象HEADと検証したHEADが一致し、未解決の問題がない
- engine.js を含む場合は差分レビュー済み
- branch deletion は --delete-branch 付き

### 「全mergeで締めて」closeout

user がこの指示を出した turn は、最後に全 repo の open PR / 作業 branch を確認する。
検証済みで今回の作業に属する PR / branch は main へ merge・push し、merged branch を削除する。
古い local-only / upstream gone branch は中身が不明なら混ぜず、final で残件として明示する。

---

## claude code が codex を呼ぶフロー (orchestration)

claude code は **computer-use MCP** 経由で Codex Desktop App を操作可能:

1. `request_access` で ChatGPT / Codex に access 取得
2. `open_application("Codex")` で Codex 起動
3. 適切な project / task に切替 (左サイドバー click)
4. `write_clipboard` で prompt を仕込む
5. compose 欄を click + `ctrl+v` で paste
6. send button を click
7. codex の作業を polling で見守る or 別 task に並行投入

詳細手順は本セッションの conversation 履歴参照
(claude code が computer-use で Codex App を操作した実例多数)。

---

## 想定シナリオ

### シナリオ A: claude 単独運用

Claude単独でも「作業後」と「同じHEADの完了証跡」に従う。同期後の全体gateと必要レビューを通し、
runtimeを変えた場合だけAGENTSのcache buster規則でdeployを同期する。auditだけで完了扱いしない。

### シナリオ B: codex 単独運用

codex chat に「○○を磨いて」と日本語指示。codex が PR まで自走。
「作業後」と「同じHEADの完了証跡」を満たした今回のPRはagentがmergeまで進めてよい。
main同期は自分のcleanなworktreeで行い、HEADが変われば検証・レビューを再確認する。

### シナリオ C: 並列同時開発

- claude code: Music repo の UI 改修 (fm.js + fm.css)
- codex: sister repo の preset 拡張 (chill / drum-floor / namima)
- 互いに干渉しない領域なので衝突なし
- 両担当とも「作業後」と「同じHEADの完了証跡」を満たす。5 repoの対象状態が変われば全体gateを再実行する

### シナリオ D: claude が codex を呼ぶ (今回のセッションの実例)

- ユーザー: 「○○磨いて」
- claude code: spec 設計 → Codex App 開く → 4 task に並列 prompt 投入
- 各codex: branch → 実装 → PR → 「作業後」と「同じHEADの完了証跡」を確認 → 条件を満たせばmerge
- ユーザー: 判断不能・未検証・human-gate が残る PR だけ個別確認
- claude code: JSON取り込み + Music改修 → 自分の最終HEADで同じ全体gateと必要レビュー → デプロイ

### シナリオ E: codex が止まって claude が続ける (今回の引き継ぎ例)

- codex chat の context が詰まる
- claude codeが担当scope・worktree・候補HEAD・検証ログ・未解決事項を確認して引き継ぎ、他担当の差分を混ぜない
- 「作業後」と「同じHEADの完了証跡」に戻り、同期/衝突解消後の全体gateと必要レビューを実施
- cache buster規則はruntime変更時に守り、古いHEADのauditだけを引継ぎ完了証拠にしない

---

## 信頼境界

- **claude / codex 両方が同じローカル repo を触る** ことに対する信頼:
  - 両者は同じ Windows ファイルシステム上で動く
  - git で互いの変更を追える
  - stack-checkで既存の全体検査を実行する。未検出の問題がないという保証にはしない
- **両者が同じ origin/main に push する** ことに対する信頼:
  - GitHub の commit author / timestamp で追跡
  - 強制 push 禁止
  - 重大バグは revert で復旧

---

## 計算資源の使い分け (実際的)

- **claude code 起動中**: chat session が長くなって context 圧迫 → 軽い修正のみ claude、大きい修正は codex に振る
- **codex chat 起動中**: 1 task の容量が詰まる → 別 task or claude code に引き継ぎ
- **両方アイドル**: ユーザーが判断、好きな方に投げる
- **両方稼働中**: 互いに干渉しない領域に振る (上記シナリオ C)

---

## 監査ログ

「同じHEADの完了証跡」を候補HEADへ紐づける。個別checkの成功だけでは全体整合を完了扱いしない。
GitHub Actions で audit.py を CI 化したい場合は user 承認が必要 (現状未導入)。

```yaml
# 将来の .github/workflows/audit.yml の雛形 (user 承認後に有効化)
name: Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.x' }
      - run: pip install --quiet
      - run: python -X utf8 scripts/audit.py
      - run: node scripts/check-js.mjs
      - run: node scripts/check-band-room-logic.mjs
      - run: node scripts/check-fm-route-badge.mjs
```

---

## 改善提案を出すとき

- 「○○磨いて」レベルの大雑把な指示でも、両 agent は本ドキュメントを
  読んで自走できるよう設計
- agent 側で **「これは大きな変更なので PR にする」** 判断は AGENTS.md
  の hard rules + 並列衝突回避ルールに従う
- 不明点は AGENTS.md / SCHEMA.md / HAZAMA-FM-ARCHITECTURE.md の順に読む

---

## まとめ

| 課題 | 解決 |
|---|---|
| 両 agent が同じ整合性ガードを使う | 同期/衝突解消後の同じHEADで`node scripts/stack-check.mjs`、FAIL 0 / SKIP 0、0 BADと必要レビュー |
| cache buster の同期忘れ | audit.py の Section 5 で検出 |
| engine.js への意図せぬ改変 | AGENTS.md Hard rules + user 承認 |
| 同時編集衝突 | git pull --rebase + 手動解決 |
| どっちが空いてるか | claude が orchestrator として呼び分け |
| context が詰まる | 別 agent に引き継ぎ (この repo は両 agent 対応) |
