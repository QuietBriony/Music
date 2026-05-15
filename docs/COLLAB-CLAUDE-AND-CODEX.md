# Collab: claude code と codex の並列開発プレイブック

Music repo を **claude code (Anthropic) と codex (OpenAI) の両方** で
継続開発するためのガイド。先に [`AGENTS.md`](../AGENTS.md) を読むこと。

---

## なぜ並列開発したいか

- **計算資源が余ってる方を使う** — codex chat で context 詰まったら claude code、claude のセッションが長くなったら codex に振る
- **視点が違う** — claude は repo 全体俯瞰 + UX、codex は narrow な実装 + 各 repo の事情に詳しい
- **片方が止まっても止まらない** — A が編集中でも B が別領域を磨ける
- **盤石な整合性ガード** — `scripts/audit.py` を両方が共有する単一の真実

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
python -X utf8 scripts/audit.py --expected-version hazama-fm-v151   # 現状 0 BAD 確認
node scripts/check-js.mjs
node scripts/check-band-room-logic.mjs
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

### 作業後 (commit / push 前)

```bash
python -X utf8 scripts/audit.py --expected-version hazama-fm-v151   # 0 BAD 必須
node scripts/check-js.mjs
node scripts/check-band-room-logic.mjs
git status                # 変更ファイル確認
git pull --rebase origin main   # 他 agent の差分を取り込み
# (衝突あれば手動解決)
git push origin main
```

### 衝突したら

例: `fm.js` で claude と codex の編集が衝突
1. `git pull --rebase origin main` で reject
2. `fm.js` を開いて `<<<<<<<` マーカーで両方の意図を理解
3. 両方の意図を残せるならマージ、難しいなら片方を採用 + 後で対話
4. `git add fm.js && git rebase --continue`
5. `python -X utf8 scripts/audit.py --expected-version hazama-fm-v151` と `node scripts/check-js.mjs` で再検証
6. `git push origin main`

---

## 「マージして」自然言語パターン (codex 専用)

codex の各 task chat に **「マージして」と日本語で送る** だけで:
```
gh pr merge <PR#> --merge --delete-branch
git switch main
git pull --ff-only origin main
```
が自動実行されて main 同期まで完了する。

claude code はこのパターンを使わず、`gh pr merge` を直接呼ぶか
ローカルから直接 main に push する (gh CLI 認証は user のもの)。

### 「マージして」が使える条件

- codex chat の親 PR が現在 open
- mergeable / clean な状態
- branch deletion は --delete-branch 付き

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

何も特別なことはしない。`audit.py` で整合性、cache buster で
deploy 同期、git pull で最新化。これだけで OK。

### シナリオ B: codex 単独運用

codex chat に「○○を磨いて」と日本語指示。codex が PR まで自走。
ユーザーが「マージして」で merge。main 同期は codex が自動。

### シナリオ C: 並列同時開発

- claude code: Music repo の UI 改修 (fm.js + fm.css)
- codex: sister repo の preset 拡張 (chill / drum-floor / namima)
- 互いに干渉しない領域なので衝突なし

### シナリオ D: claude が codex を呼ぶ (今回のセッションの実例)

- ユーザー: 「○○磨いて」
- claude code: spec 設計 → Codex App 開く → 4 task に並列 prompt 投入
- 各 codex: branch → 実装 → PR (auto-merge 禁止)
- ユーザー: 各 chat に「マージして」
- claude code: JSON 取り込み + Music repo 改修 + デプロイ

### シナリオ E: codex が止まって claude が続ける (今回の引き継ぎ例)

- codex chat の context が詰まる
- claude code が同じ repo を直接触って引き継ぎ
- 整合性は audit.py で自動チェック
- cache buster ルールを守って commit + push

---

## 信頼境界

- **claude / codex 両方が同じローカル repo を触る** ことに対する信頼:
  - 両者は同じ Windows ファイルシステム上で動く
  - git で互いの変更を追える
  - audit.py で破壊検出可能
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

毎 commit 直前に audit.py / check-js / Band Room logic check を回す習慣で、整合性は automatic に保たれる。
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
      - run: python -X utf8 scripts/audit.py --expected-version hazama-fm-v151
      - run: node scripts/check-js.mjs
      - run: node scripts/check-band-room-logic.mjs
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
| 両 agent が同じ整合性ガードを使う | `python -X utf8 scripts/audit.py --expected-version hazama-fm-v151` + `node scripts/check-js.mjs` が 1 つの真実 |
| cache buster の同期忘れ | audit.py の Section 5 で検出 |
| engine.js への意図せぬ改変 | AGENTS.md Hard rules + user 承認 |
| 同時編集衝突 | git pull --rebase + 手動解決 |
| どっちが空いてるか | claude が orchestrator として呼び分け |
| context が詰まる | 別 agent に引き継ぎ (この repo は両 agent 対応) |
