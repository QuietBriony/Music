# PC Registry — music-stack development environments

複数の物理 PC が GitHub 経由で並列で music-stack を触る前提の、**PC 役割境界 +
競合管理 + machineName** の登記簿。新しい PC を加える時はまずここを更新する。

NEW-PC-SETUP.md (clone + setup script) と対になる doc。NEW-PC-SETUP は
「どうやって PC を組み立てるか」、PC-REGISTRY は「組み立てた PC が何を担当し、
他 PC とどう住み分けるか」。

---

## 登録 PC 一覧

| machineName | 役割 | 接続機材 | 主担当タスク | 状態 |
|---|---|---|---|---|
| `primary` | メイン開発機 | (汎用) | 全 engine.js 修正、agent autonomy session 主体、Hazama FM のロジック作業 | active |
| `studio` | 試聴・録音機 | Steinberg UR44 (USB Audio) + monitor speaker/headphone | engine の音作り ear-verified 微調整、stems 録音 confirm、DAW (Cubase / Logic 等) 統合 | planned |
| `worker` | 重タスク機 | GPU/CPU 高負荷向け note PC (gaming) | Magenta DrumsRNN fine-tune、大量 preset 自動生成、長時間 batch、audio rendering | future |

`primary` は無印 (= machineName 未設定) も `primary` 扱い。既存のすべての
SESSION-LEDGER エントリは primary 由来。

---

## 各 PC の役割境界

### `primary` (メイン)

- **メイン担当**: engine.js / audio modules / docs の改修、agent autonomy
  session 主体、PR 主導、cross-app 整合性、Band Room チャットとの並走管理。
- **しない**: UR44 試聴 (機材無し)、長時間 batch (重い処理は worker へ送る)。
- **強み**: 即応性、editor 慣れ、Claude project memory が一番充実、長文 doc
  生成。

### `studio` (UR44 PC)

- **メイン担当**: ear-verified iteration — engine の音作り (drop の強さ、
  build pad の vel、pianoMemory の echo wash 等) を実際のモニター環境で聞いて
  microscope レベルで微調整し PR 化。stems / drum kit の録音 confirm。
  DAW 上で stems と engine の mix 比較。
- **しない**: 大量 batch 処理、autonomy session 主体 (短い iteration メイン)、
  Magenta モデル training (CPU が足りない or 時間がかかる)。
- **強み**: 物理スピーカー / モニターヘッドホン (PHONES 1/2)、低遅延、UR44 の
  チャンネル分け (mic/inst 用) でレコーディング併用可能。
- **設定の注意**: UR44 を Windows 既定の音声出力に設定。dspMixFx で
  channel routing を確認。ASIO ドライバは DAW 使用時のみ必要 (ブラウザ
  audio は WASAPI 経由)。

### `worker` (将来、gaming note PC)

- **メイン担当**: Magenta DrumsRNN の fine-tune (GPU が活きる)、大量 preset
  自動生成 (drum-frames-*.json を batch 生成)、audio rendering を batch で
  (offline render → S3 / GitHub Releases に置く)、長時間 stack-check 全 repo
  健全性監視 cron。
- **しない**: ear-verified iteration (試聴環境が無いので)、ライブ engine 開発
  (主担当は primary)。
- **強み**: GPU、CPU 余裕、長時間プロセスを放置できる、ファン回ってても OK。
- **追加のセットアップ**: GPU driver + CUDA (Magenta 用)。Python venv に
  TensorFlow.js Node or Magenta Python。

---

## 競合回避設計

3 PC が GitHub 経由で並列で commit/push する場合の競合管理。

### 共有ファイル (版番号衝突しやすい)

- `sw.js` の `VERSION = "hazama-fm-vNN"`
- `docs/BAND-ROOM-CHANGELOG.md` のタイトル `(v65 → vNN compact)`
- `docs/autonomy/SESSION-LEDGER.md` の先頭エントリ位置

これらは並列 push でほぼ確実に衝突する → **rebase で繰り上げ吸収** の
パターン (SESSION-LEDGER の v246-v263 セッション参照)。

各 PC とも:
1. 作業前に `git pull --ff-only origin main`
2. feature branch で作業
3. push 前にもう一度 `git fetch && git rebase origin/main`
4. version 衝突は rebase で最大値に繰り上げ
5. squash merge

### 専有領域 (衝突しにくい設計)

| ファイル / 領域 | 触る PC | 触らない PC |
|---|---|---|
| `engine.js` / `audio/music-*.js` | primary, studio | worker |
| `fm.html` / `index.html` / `fm.js` / `fm.css` | primary, studio | worker |
| `band-room.html` / `band-room.js` / `band-room.css` | **全 PC 触らない** (Band Room チャット専用) | (全部) |
| `presets/drum-frames-*.json` | worker (生成)、primary (review) | studio |
| `references/*.json` | primary | worker, studio |
| `docs/autonomy/*` | primary, studio (LEDGER 追記のみ) | worker (autonomy session せず) |
| `docs/HAZAMA-FM-ARCHITECTURE.md` 等 design doc | primary | studio, worker |
| DAW project files (将来 repo に入れるなら) | studio | primary, worker |

### 強制ルール (全 PC 共通)

- `git push origin main` 直接禁止 (auto-mode classifier も拒否)。
- すべて `feature/<topic>` branch + PR + `gh pr merge --squash --delete-branch`。
- 同じ topic を 2 PC で同時 touch しない (もし起きたら、後発が rebase で
  consolidate)。
- Band Room: 全 PC で `band-room.*` を編集しない。接続が必要なら user に
  「Band Room チャット側で対応してください」と伝える。
- セッション前に必ず `git pull --ff-only origin main`。

---

## エラーシナリオと対処

| 症状 | 原因 | 対処 |
|---|---|---|
| `git pull --ff-only` が "Your local changes would be overwritten by merge" | uncommitted な変更が remote と衝突 | `git stash` → `git pull --ff-only` → `git stash pop` (衝突したら resolve) |
| PR merge で "fatal: 'main' is already used by worktree at <path>" | sibling worktree が main を占有(本 repo は別 worktree 並走を許容) | GitHub 側 merge は完了。次回 `git fetch origin && git checkout origin/main` で同期。worktree 中のローカル main は別途 `git pull` |
| stack-check で BAD が出る | version 数字の不整合、ファイル不在、check スクリプトの assertion 不一致 | まず `git pull --ff-only origin main` → 個別 `check-*.mjs` のエラー文を user に共有 |
| Claude Code 起動時にコンテキスト不在 | 新 PC の初回、または `~/.claude/projects/...` が空 | NEW-PC-SETUP.md 節 6 ブートストラッププロンプトをペースト |
| 版番号衝突 (rebase 中) | 2 PC が同じ vNN を取った | rebase で繰り上げ。具体例は SESSION-LEDGER v246-v263 |
| `sw.js VERSION` と CHANGELOG title 不一致 | 片側だけ rebase 時に bump し忘れ | 両方を同じ vNN に揃える、`audit.py` がエラーを指摘 |

---

## machineName の運用

`scripts/setup-new-pc.ps1 -MachineName "..."` が
`git config --local music.machineName <名前>` を書き込む。

確認:

```powershell
git config --get music.machineName
```

primary では未設定でも OK (機能上は同じ、慣習的に `[primary]` 扱い)。

### SESSION-LEDGER エントリヘッダ prefix

```
## 2026-06-01 [studio] — engine.js surge drop 試聴 + drop 強度微調整 (vNNN)
## 2026-06-05 [worker] — preset batch 生成 (drum-frames-newgenre × 6) (vNNN)
## 2026-06-10 — 全体監査 + ledger consolidate    ← primary は無印で OK
```

抽出:

```powershell
grep "\[studio\]" docs/autonomy/SESSION-LEDGER.md      # studio の作業履歴
grep "\[worker\]" docs/autonomy/SESSION-LEDGER.md      # worker の作業履歴
grep -v "^## 2[0-9]\{3\}-[0-9]\{2\}-[0-9]\{2\} \[" docs/autonomy/SESSION-LEDGER.md  # primary (無印)
```

### コミットメッセージ (任意)

PC 識別を commit にも残したい場合は Co-Authored-By trailer に PC 名:

```
Co-Authored-By: Claude Opus 4.7 (studio) <noreply@anthropic.com>
```

任意 — SESSION-LEDGER の prefix だけで通常十分。

---

## PC 追加のフロー (新 PC を増やす時)

1. **この `docs/PC-REGISTRY.md` を更新** — 新 PC の行を `## 登録 PC 一覧` テーブル
   に追加 + 「各 PC の役割境界」「専有領域」のマトリクスにも追記。**PR 経由**
   (どの PC からでも OK、PR は docs のみ)。
2. 新 PC 側で `setup-new-pc.ps1 -MachineName "<新名>"` 実行。
3. ブートストラッププロンプト (NEW-PC-SETUP.md 節 6) をペースト。Claude が
   PC-REGISTRY を読んで自分の役割境界を把握する。
4. SESSION-LEDGER 初稿エントリ:

   ```
   ## YYYY-MM-DD [<新名>] — <新PC> セットアップ完了 + 初回確認
   - agent      : Claude Code (新PCインスタンス)
   - goal       : <新PC> の setup と動作確認、PC-REGISTRY の役割範囲を把握
   - shipped    : (なし、setup のみ)
   - stack-check: PASS 15 / FAIL 0 / SKIP 0
   - 役割       : (PC-REGISTRY 参照)
   ```

---

## 関連 docs

- `docs/NEW-PC-SETUP.md` — PC の組み立て (clone + script + bootstrap prompt)。
- `AGENTS.md` — Hard Rule 群、ブランチ / PR 規約。
- `docs/autonomy/SESSION-LEDGER.md` — 全 PC 共通の autonomy 履歴。
- `docs/autonomy/BACKLOG.md` — 全 PC 共通の P1/P2/Done backlog。
