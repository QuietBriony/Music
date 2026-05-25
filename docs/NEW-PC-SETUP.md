# NEW-PC-SETUP.md — music-stack を別 PC で再現する

## このドキュメントの目的

別 PC (例: UR44 オーディオインターフェース・DAW を触る PC) で music-stack の
全 repo を再現し、両 PC が **GitHub 経由で同期** しながら共同開発できる状態を
作る。

直接の PC ↔ PC リンクは不要 ＝ GitHub が唯一の同期メカニズム。primary PC で
ship した PR は別 PC で `git pull` すれば即反映される。逆方向も同じ。

**役割境界 + 競合管理 + PC 登記簿** は別 doc → `docs/PC-REGISTRY.md` を参照。
新 PC を加える時はそちらも更新する。本 doc はあくまで「組み立て」フェーズ
(clone + setup + 初回 Claude 起動)。

---

## 前提ツール (新 PC 側)

| ツール | 用途 |
|---|---|
| Git for Windows | clone / pull / push |
| Node.js (LTS) | `scripts/stack-check.mjs` ＋ 各 repo の `check-*.mjs` |
| Python 3.x | `scripts/audit.py` / `pytest tests/` |
| GitHub CLI (`gh`) | PR 作成 / merge / 認証 |
| Claude Code (CLI) | `claude` コマンド |
| Steinberg UR44 driver + dspMixFx | UR44 を USB Audio として認識(任意、UR44 を使うなら) |

---

## (最短ルート) Claude Code にゼロから丸投げするブートストラッププロンプト

**Claude Code だけ install 済みの新 PC** で、`C:\workspace\` も何も無い状態
から **prompt 1 つ貼るだけで全部やる** ためのプロンプト。下記の section 1-6
の手動手順を内包しているので、ゼロからの初動はこっちが速い。

新 PC で `claude` を起動 (どのディレクトリで起動しても OK、Claude が必要な
フォルダを作る) → 以下を最初のターンに貼り付け:

```text
これは <PC名> (UR44 + Surface PC など) で初めて Claude Code を起動した直後
(C:\workspace\ すら無い状態) から music-stack に正式参加するまでを
一気通貫でやるためのプロンプトです。あなたはこのPCの Claude — 以下を順番に
実行して進めてください。

【前提 (満たしてなければ user に伝えてストップ)】
- Claude Code が起動している(あなたが動いている = OK)
- studio-surface はインターネットに繋がっている
- (理想) PowerShell に admin 権限がある (winget install で必要)

【段階 1: 前提ツール確認 + 不足分インストール】

PowerShell 経由で以下を確認:

  git --version; node --version; python --version; gh --version

不足ツールを winget で install:

  winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements

admin 権限不足で失敗したら user に「管理者権限の PowerShell から手動で
winget install してから戻ってきて」と伝える。

UR44 ドライバは winget に無いので、user に Steinberg のサイトから手で
ダウンロード・インストールしてもらう:
  https://www.steinberg.net/downloads/
  → "Yamaha Steinberg USB Driver" + "Tools for UR44" の両方を入れる
  → インストール後 Surface を一度再起動

「ツール install + UR44 ドライバ + 再起動 完了したら『次』と返事」と user に
依頼してから段階 2 へ。

【段階 2: GitHub 認証】

  gh auth status

未認証なら:

  gh auth login --web --hostname github.com

user がブラウザでログイン + コード入力。完了後 gh auth status で再確認。

【段階 3: workspace 作成 + Music repo clone + setup script 実行】

C:\workspace\ が無くてもディレクトリツリーごと作る:

  New-Item -ItemType Directory -Force -Path 'C:\workspace\music-stack' | Out-Null
  Set-Location 'C:\workspace\music-stack'
  gh repo clone QuietBriony/Music
  Set-Location 'C:\workspace\music-stack\Music'
  .\scripts\setup-new-pc.ps1 -MachineName 'studio-surface'

setup script が残り 4 repo (chill / drum-floor / namima / openclaw) を clone、
machineName を git config に設定、stack-check を実行 (15 PASS / 0 BAD 期待)。
出力を全部 user に見せる。

【段階 4: context 吸収】

Read ツールで順番に読んで内容把握:

1. C:\workspace\music-stack\Music\AGENTS.md
   (Hard Rule 1「engine.js 原則改変禁止」、Rule 6「外部 harvest は非干渉」)
2. C:\workspace\music-stack\Music\docs\PC-REGISTRY.md
   (自分の machineName = "studio-surface" の役割節を熟読 — UR44 試聴 + DAW、
   engine の音作り ear-verified 微調整が主担当)
3. C:\workspace\music-stack\Music\docs\autonomy\SESSION-LEDGER.md (先頭=最新)
4. C:\workspace\music-stack\Music\docs\HAZAMA-FM-ARCHITECTURE.md
5. C:\workspace\music-stack\Music\docs\BAND-ROOM-CHANGELOG.md (先頭=最新)

【段階 5: 標準制約 (常時メモリに保持)】

- machineName = studio-surface
- 役割: UR44 試聴 + ear-verified 微調整 + DAW 統合
- しない: 大量 batch (worker-gaming へ) / Magenta training / autonomy 主体
- Band Room (band-room.*) は別チャットで磨いている — 編集しない
- 共有ファイル (sw.js / docs/BAND-ROOM-CHANGELOG.md) は commit 前に必ず
  git pull --ff-only origin main、版番号衝突は高い方を採用
- engine.js 改変は必ず PR、直 main push は auto-mode classifier で拒否
- cache-buster: engine.js + audio/music-*.js 5 モジュール = 同じ ?v=fm-NN、
  sw.js VERSION = hazama-fm-vNN を一緒に bump
- ship-then-verify: user は merge 後に試聴で判定
- SESSION-LEDGER 追記は ## YYYY-MM-DD [studio-surface] — ... 形式

【段階 6: UR44 を Windows 既定の音声出力に】

これは PowerShell から自動化困難。user に明確な手順で依頼:
- Windows 設定 → システム → サウンド → 出力 → "Steinberg UR44 Output" を
  既定に
- 設定したら出力デバイスのプロパティ → 「テスト」で UR44 から鳴ることを確認

【段階 7: ブラウザ試聴チェック】

user に依頼:
- Chrome または Edge で https://quietbriony.github.io/Music/fm.html を開く
- "START" を押す → UR44 から鳴る音を確認
- (推奨) PWA バナーで「インストール」 → バックグラウンド再生が安定
- 5〜10 分聞いて以下が知覚できるか報告:
  * 3-4 分に一度の build → fill → drop シークエンス (v256+v258+v263)
  * pianoMemory が groove に locked、退屈感が抜けている (v244+v253)
  * 各 section 中盤の「ふっと盛り上がる」アーク (v256 breath)

【段階 8: 最新状態確認 + 役割範囲内タスク提案】

- git log --oneline -3 で origin/main の最新版を user に報告
- docs/autonomy/BACKLOG.md の P1 / P2 を読む
- studio-surface の役割範囲 (ear-verified iteration) で着手するのに適した
  項目を 1-2 個提案 → user の指示を待つ

途中でエラー・判断迷い → その時点で user に状況報告 + 確認。自動化不可な
部分 (UR44 driver install / Windows GUI / ブラウザ試聴判断) は明確に user
の手作業として依頼する。

最初に「OK、studio-surface セットアップを開始します」と返事してから段階
1 を実行。
```

`<PC名>` と `'studio-surface'` の部分を、別 PC で使う時はそれぞれ該当の名前
(`worker-gaming` 等) に置換する。machineName を変えたら段階 4-2 の役割節
読み込みも該当の PC のものに切り替わる。

このプロンプトを使う場合、本 doc の節 1-6 の手動手順は不要。節 7 (Claude
project memory 移管) は依然として任意。

---

## 1. GitHub 認証

```powershell
gh auth login
```

(SSH 派なら `~/.ssh/id_*` を生成して GitHub に登録)

---

## 2. Music-stack を clone

### (推奨) ワンコマンドスクリプト

Music repo だけ手で clone すれば、付属の `scripts/setup-new-pc.ps1` が
残りを全部やってくれる(認証チェック → 残り 4 repo の clone → PC 名を
git config に埋め込み → stack-check で 0 BAD 確認 → ブラウザでこの doc
を開いてブートストラッププロンプトをコピペ準備):

```powershell
mkdir C:\workspace\music-stack
cd C:\workspace\music-stack
gh repo clone QuietBriony/Music
cd Music
.\scripts\setup-new-pc.ps1 -MachineName "studio-surface"
```

`-MachineName` は任意の識別子(デフォルト `"studio-surface"`)。命名は下記「PC 命名規約」
セクション参照。スクリプトを使わない場合は下記の手動手順:

### 手動セットアップ

**primary PC と同じパス** (`C:\workspace\music-stack\<repo>`) にする。Claude の
project memory がパスでキー付けされるため、同じパスにしておくと memory 移管が
楽 (後述、任意)。

```powershell
mkdir C:\workspace\music-stack
cd C:\workspace\music-stack
gh repo clone QuietBriony/Music
gh repo clone QuietBriony/chill
gh repo clone QuietBriony/drum-floor
gh repo clone QuietBriony/namima
gh repo clone QuietBriony/openclaw
```

`stack-check.mjs` の `ACTIVE_REPOS` がこの 5 つを想定している。`test` /
`namima-lab` 等の inactive repo は当面不要。

---

## 3. 動作確認

```powershell
cd C:\workspace\music-stack\Music
node scripts/stack-check.mjs
```

期待結果: `PASS 15 / FAIL 0 / SKIP 0` (= 0 BAD)。これが出れば 5 repo すべてが
正しく落ちて整合性も取れている状態。

---

## 4. UR44 を音出しに使う設定 (任意)

Hazama FM / Band Room はブラウザ + Tone.js 製のため、システム標準音声出力を
UR44 にすればそのまま鳴る:

1. Steinberg UR44 driver + dspMixFx をインストール。
2. Windows 設定 → サウンド → 出力 → "Steinberg UR44 Output" を既定に。
3. Chrome / Edge で `https://quietbriony.github.io/Music/fm.html` を開く
   (PWA インストールも推奨、バックグラウンド再生が安定する)。

DAW で UR44 を使う場合は Steinberg ASIO ドライバを併用 (UR44 ユーティリティに
同梱)。

---

## 5. Claude Code を起動

```powershell
cd C:\workspace\music-stack\Music
claude
```

---

## 6. 初回起動時のブートストラッププロンプト

新 PC の Claude Code の最初のターンに **以下をそのままペースト**。これでこの
repo の哲学・履歴・制約・同期ルールを全部読み込ませた状態にできる:

```text
このPCは music-stack 開発の 2 台目です。primary repos は GitHub 上の
QuietBriony/* (Music + chill + drum-floor + namima + openclaw)。同期は
GitHub 経由のみで、PC↔PC の直接接続はありません。

本題の前に context 吸収:

1. 以下を順番に読んで repo の哲学・履歴・制約を把握:
   - AGENTS.md (Hard Rule 群、特に Rule 1「engine.js 原則改変禁止」と PR
     経由での例外、Rule 6「外部 harvest は非干渉で」)
   - docs/autonomy/SESSION-LEDGER.md (autonomy 履歴、先頭が最新)
   - docs/HAZAMA-FM-ARCHITECTURE.md (engine アーキテクチャ + cache-buster
     規律)
   - docs/BAND-ROOM-CHANGELOG.md (リリース履歴、v113 以降は Hazama FM の
     修正も含む)

2. 整合性ゲートで baseline 確認:
     node scripts/stack-check.mjs
   → PASS 15 / FAIL 0 / SKIP 0 を確認

3. 標準制約 (常時メモリ):
   - Band Room (band-room.* ファイル) は別チャットで磨いている — このチャット
     では編集しない。接続が必要なら user に伝える
   - 共有ファイル (sw.js / docs/BAND-ROOM-CHANGELOG.md) は commit 前に必ず
     `git pull --ff-only origin main`、版番号衝突時は高い方を採用
   - engine.js 改変は必ず PR (直 push 不可、feature branch + PR + squash
     merge)
   - 直接の main push は auto-mode classifier で拒否される (docs も含めて
     PR 経由)
   - cache-buster 規律: engine.js + audio/music-*.js (5 モジュール) は同じ
     ?v=fm-NN を共有、sw.js VERSION = hazama-fm-vNN。一緒に bump
   - ship-then-verify: user は merge 後に試聴で判定
   - **PC 命名**: このPCの識別子は `git config --get music.machineName` で
     取得 (setup script が設定済み、例: `studio`)。SESSION-LEDGER に追記する
     時は `## YYYY-MM-DD [studio] — <一行サマリ>` 形式で prefix を付ける
     (primary PC からの追記は無印 = `[primary]` 扱い)

4. 作業サイクル:
   a. git pull --ff-only origin main で primary PC + Band Room の最新を取得
   b. git checkout -b feature/<topic> で作業ブランチ
   c. 編集 → node scripts/stack-check.mjs (0 BAD 必須)
   d. commit + push
   e. gh pr create + gh pr merge --squash --delete-branch --subject "..."
   f. このPCには UR44 が繋がっている前提 ＝ ear-verified iteration が主な
     ループ。試聴 → 微調整 → ship のテンポでOK

5. このPCの用途: UR44 経由の試聴 + 必要なら engine.js 修正 / 新規 polish。

6. このPCの役割の把握:
   - `git config --get music.machineName` で識別子を取得 (例: "studio-surface")
   - `docs/PC-REGISTRY.md` を読み、自分の行から **主担当 / しない / 強み** を
     内在化。専有領域マトリクスで「触っていいファイル」「触らないファイル」も
     確認 (Band Room の `band-room.*` は全 PC 触らない、等)
   - 役割範囲外のタスクが user から来たら「これは <他PC名> でやる方が適切」
     と提案する

context 吸収と整合性ゲートが終わったら:
- 現在の origin/main の最新版を伝える (git log --oneline -3)
- docs/autonomy/BACKLOG.md の P1 / P2 を確認
- 自分の役割範囲内で着手するのに適した項目があれば提案

そのあと user の具体的な指示を待つ。
```

---

## 7. Claude project memory の移管 (任意)

primary PC の以下フォルダを新 PC の同じパスへコピー:

```
%USERPROFILE%\.claude\projects\C--workspace-music-stack\
```

repo 内 docs (AGENTS.md + SESSION-LEDGER) で context は再構築できるので
必須ではないが、`memory/MEMORY.md` の auto-memory (ship-then-verify、
parallel-sessions の流儀、preview-testing quirks 等) は引き継いだ方が
スムーズ。

---

## 同期の流れ

```
primary PC ──push─→ GitHub main ←─pull── 別 PC (UR44 PC)
  (このチャット)                       (新 PC の Claude)
```

- どちらかの PC で作業 → feature branch → PR → squash merge to main
- 反対側の PC は作業前に必ず `git pull --ff-only origin main`
- 両 PC が同じ AGENTS.md / SESSION-LEDGER / engine.js を見る ＝ context 共有

並走の衝突管理は SESSION-LEDGER の v246-v263 セッションの rebase 履歴を参照。
共有ファイル (`sw.js` VERSION / `BAND-ROOM-CHANGELOG.md` title) は版番号衝突
しやすいが、rebase で繰り上げて吸収するパターンが既に確立されている。

---

## トラブルシューティング

- **`stack-check` で BAD が出る**: `git pull --ff-only origin main` で最新化、
  それでも残るなら個別 `check-*.mjs` のエラー文を user に共有。
- **PR merge で "main is already used by worktree" エラー**: `gh` の post-merge
  step がローカル main を checkout しようとして失敗することがある(両 PC で
  別 worktree を持っている時)。GitHub 側の merge は完了しているので無視で OK。
  次回 `git fetch origin && git checkout main` で同期。
- **版番号衝突 (sw.js VERSION / CHANGELOG)**: rebase で繰り上げ。
  SESSION-LEDGER の v246-v263 エントリの「並走」項を参照。
- **direct push to main が拒否される**: 仕様。docs でも feature branch + PR
  経由。`gh pr create` + `gh pr merge --squash --delete-branch` で。

---

## PC 命名規約

詳細は `docs/PC-REGISTRY.md` 参照 — **PC 登録一覧、役割境界、専有領域
マトリクス、競合管理、エラー対処、SESSION-LEDGER prefix 規約、PC 追加フロー**
が全部 1 つの doc に集約されている。

簡易版 (覚えとくべきこと):

- `setup-new-pc.ps1 -MachineName "<名前>"` で git config に PC 識別子を埋め込む
  (確認: `git config --get music.machineName`)
- SESSION-LEDGER 追記時はヘッダに `[<PC名>]` prefix:
  `## YYYY-MM-DD [studio] — <一行サマリ> (vNNN)`
- primary PC は無印で OK (既存エントリも全て primary)
- 推奨命名 (物理 PC 名 + 役割サフィックス): `chouta-surface` (メイン開発機) /
  `studio-surface` (UR44 + DAW) / `worker-gaming` (重タスク、gaming note PC)

---

## 関連 docs

- **`docs/PC-REGISTRY.md`** — PC 登録一覧、役割境界、専有領域マトリクス、競合
  管理、エラー対処。本 doc(NEW-PC-SETUP) と対の関係: NEW-PC-SETUP は
  「組み立て」、PC-REGISTRY は「組み立て後の住み分け + 運用」。
- `AGENTS.md` — Hard Rule 集 + cache-buster 規律 + Branch/PR convention
- `docs/HAZAMA-FM-ARCHITECTURE.md` — engine 全体像 + Section 12 (harness lens)
- `docs/autonomy/SESSION-LEDGER.md` — autonomy 履歴 (このセッションも含む)
- `docs/autonomy/BACKLOG.md` — P1 / P2 / Done backlog
- `docs/BAND-ROOM-CHANGELOG.md` — v65 → 最新までのリリース史
- `docs/CODEX-HANDOFF.md` — Codex CLI を併用する場合の handoff 手順
