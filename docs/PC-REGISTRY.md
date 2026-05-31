# PC Registry — music-stack development environments

複数の物理 PC が GitHub 経由で並列で music-stack を触る前提の、**PC 役割境界 +
競合管理 + machineName** の登記簿。新しい PC を加える時はまずここを更新する。

NEW-PC-SETUP.md (clone + setup script) と対になる doc。NEW-PC-SETUP は
「どうやって PC を組み立てるか」、PC-REGISTRY は「組み立てた PC が何を担当し、
他 PC とどう住み分けるか」。

---

## 登録 PC 一覧

命名規則は **物理 PC を識別する hostname-flavored 名** (`<役割>-<機種>`)。
machineName は git config `music.machineName` に保存。

| machineName | 役割 | 接続機材 | 主担当タスク | 状態 |
|---|---|---|---|---|
| `chouta-surface` | メイン開発機 | (汎用) | 全 engine.js 修正、agent autonomy session 主体、Hazama FM のロジック作業 | active |
| `studio-surface` | 試聴・録音/DAW 機 (Intel) | Steinberg UR44 (USB Audio) + monitor speaker/headphone、Ableton / Bandlab (予定) | engine の音作り ear-verified 微調整、stems 録音 confirm、DAW 統合 (Ableton / Bandlab / Cubase) | active (2026-05-25 setup 完了、UR44 接続待ち) |
| `worker-gaming` | 重タスク機 | RTX 2070 gaming note PC + Ableton / Cakewalk Sonar / Native Instruments / VCV / SuperCollider | Demucs stem 分離、Band Room AI 再現 batch、drum-frame candidate 生成、audio rendering | active (2026-06-01 worker venv ready / DAW maintenance current) |

`chouta-surface` は無印 (= machineName 未設定) も `chouta-surface` 扱い。
既存のすべての SESSION-LEDGER エントリは chouta-surface 由来。

`primary` / `studio` / `worker` といった抽象 role 名は使わず、物理名 +
役割サフィックスで揃える ＝ 「どの物理機で動いているか」が一意に決まる。

---

## 各 PC の役割境界

### `chouta-surface` (メイン)

- **メイン担当**: engine.js / audio modules / docs の改修、agent autonomy
  session 主体、PR 主導、cross-app 整合性、Band Room チャットとの並走管理。
- **しない**: UR44 試聴 (機材無し)、長時間 batch (重い処理は worker-gaming へ送る)。
- **強み**: 即応性、editor 慣れ、Claude project memory が一番充実、長文 doc
  生成。

### `studio-surface` (UR44 PC、Intel Surface)

- **メイン担当**: ear-verified iteration — engine の音作り (drop の強さ、
  build pad の vel、pianoMemory の echo wash 等) を実際のモニター環境で聞いて
  microscope レベルで微調整し PR 化。stems / drum kit の録音 confirm。
  DAW (Ableton / Bandlab / Cubase) 上で stems と engine の mix 比較。
- **しない**: 大量 batch 処理、autonomy session 主体 (短い iteration メイン)、
  Magenta モデル training (CPU が足りない or 時間がかかる)。engine.js の
  大規模 refactor (architectural な変更は chouta-surface 担当)。
- **強み**: 物理スピーカー / モニターヘッドホン (PHONES 1/2)、低遅延、UR44 の
  チャンネル分け (mic/inst 用) でレコーディング併用可能。**Intel CPU** で
  UR44 driver / オーディオサブシステムが安定 (ARM 版 chouta-surface では
  UR44 ドライバ不安定のためこちらで音作りする運用)。
- **設定の注意**: UR44 を Windows 既定の音声出力に設定。dspMixFx で
  channel routing を確認。ASIO ドライバは DAW 使用時のみ必要 (ブラウザ
  audio は WASAPI 経由)。

### `worker-gaming` (gaming note PC)

- **メイン担当**: Demucs 4-stem 分離、Band Room AI 再現 batch、target-spec
  解析、drum-frame **candidate** 生成、DAW / Native Instruments / VCV /
  SuperCollider を使った repo 外 audio rendering。
- **しない**: ear-verified iteration (試聴環境が無いので)、ライブ engine 開発
  (主担当は chouta-surface)、Band Room runtime 直編集、Ableton / MIDI / 外部機材の
  自動 arm / record / upload。
- **強み**: GPU、CPU 余裕、長時間プロセスを放置できる、ファン回ってても OK。
- **実機確認 (2026-05-31)**: RTX 2070、Python 3.12、Node 24、ffmpeg 8.1.1、
  Ableton / Native Instruments / VCV / SuperCollider を確認済み。
  `C:\workspace\music-stack-worker\.venv` では PyTorch 2.11.0+cu128 /
  torchaudio / Demucs / librosa / imageio-ffmpeg が入り、`torch.cuda.is_available()`
  は `True`、device は `NVIDIA GeForce RTX 2070`。
- **環境整備 (2026-05-31)**: FFmpeg 8.1.1、Visual C++ 2015-2022 x64/x86、
  Visual C++ 2013 x86、Edge WebView2 Runtime を更新。Cakewalk by BandLab、
  SuperCollider 3.14.1、Native Access 2、Ableton point update は GUI / 認証 /
  手動確認に回す。Native Access 1 で Controller Editor 2.8.2 と Kontakt 6.8.0
  は更新済み。Kontakt 単体起動確認済み、Ableton は crash recovery を退避して
  DefaultLiveSet 起動まで確認済み。
- **運用手順**: [`docs/WORKER-GAMING-RUNBOOK.md`](WORKER-GAMING-RUNBOOK.md) と
  `python -X utf8 scripts/worker-gaming-pipeline.py check-env` を入口にする。
- **2026-05-31 DAW/NI follow-up**: Kontakt 7 Player `7.6.1` installed and
  `Kontakt 7.vst3` is present. Use
  `python -X utf8 scripts/worker-gaming-pipeline.py check-daw` to confirm
  Kontakt / Ableton plugin readiness. As of the follow-up, Ableton's plugin DB
  was still empty and needs a PC-screen Preferences > Plug-Ins rescan.
- **2026-06-01 Cakewalk/Sonar follow-up**: Cakewalk Product Center `1.1.0.004`
  and Cakewalk Sonar `32.04.0.078` / `2026.04` are installed and logged in.
  Product Center add-ons are installed: Core Plugins, Studio Instruments Suite,
  Sonar Drum Replacer, Session Drummer 3, TH-U, Help & Documentation,
  Precision Suite, ProChannel Modules, and L-Phase/T-Phase plugin content.
  BandLab Assistant was removed. Cakewalk by BandLab `29.09.0.125` remains only
  as a deprecated fallback while shared Cakewalk components are reviewed.
- **2026-06-01 DAW parity policy**: reproduce the worker-gaming Sonar/Ableton/
  Native Instruments/VCV/SuperCollider stack on the Intel studio PC, then use
  the studio PC as the UR44 and ear-verified DAW reference. Keep ARM Surface as
  repo/remote command surface. See
  [`docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md`](MUSIC-PC-DAW-PARITY-RUNBOOK.md).

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
| `engine.js` / `audio/music-*.js` | chouta-surface, studio-surface | worker-gaming |
| `fm.html` / `index.html` / `fm.js` / `fm.css` | chouta-surface, studio-surface | worker-gaming |
| `band-room.html` / `band-room.js` / `band-room.css` | **全 PC 触らない** (Band Room チャット専用) | (全部) |
| `presets/drum-frames-*.json` | worker-gaming (生成)、chouta-surface (review) | studio-surface |
| `references/*.json` | chouta-surface | worker-gaming, studio-surface |
| `docs/autonomy/*` | chouta-surface, studio-surface (LEDGER 追記のみ) | worker-gaming (autonomy session せず) |
| `docs/HAZAMA-FM-ARCHITECTURE.md` 等 design doc | chouta-surface | studio-surface, worker-gaming |
| DAW project files (将来 repo に入れるなら) | studio-surface | chouta-surface, worker-gaming |

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

chouta-surface (= 本セッションのこの PC) では未設定でも OK (機能上は同じ、
慣習的に無印 = `[chouta-surface]` 扱い)。

### SESSION-LEDGER エントリヘッダ prefix

```
## 2026-06-01 [studio-surface] — engine.js surge drop 試聴 + drop 強度微調整 (vNNN)
## 2026-06-05 [worker-gaming] — preset batch 生成 (drum-frames-newgenre × 6) (vNNN)
## 2026-06-10 — 全体監査 + ledger consolidate    ← chouta-surface は無印で OK
```

抽出:

```powershell
grep "\[studio-surface\]" docs/autonomy/SESSION-LEDGER.md     # studio-surface 履歴
grep "\[worker-gaming\]" docs/autonomy/SESSION-LEDGER.md      # worker-gaming 履歴
grep -v "^## 2[0-9]\{3\}-[0-9]\{2\}-[0-9]\{2\} \[" docs/autonomy/SESSION-LEDGER.md  # chouta-surface (無印)
```

### コミットメッセージ (任意)

PC 識別を commit にも残したい場合は Co-Authored-By trailer に PC 名:

```
Co-Authored-By: Claude Opus 4.7 (studio-surface) <noreply@anthropic.com>
```

任意 — SESSION-LEDGER の prefix だけで通常十分。

---

## Multi-stack 認知

このリポ (music-stack) は user が運用している複数 stack の 1 つ。他に:

- **zouen-stack**: 造園業務系 (経理 / 受発注 / 工程管理 等)。事務PC や共用PC
  も関与。
- (将来) 他 stack の追加可能性

**PC は単一 stack 専用ではない** — 例: `chouta-surface` は music-stack の
メイン開発機だが、zouen-stack の業務にも関与する(両方で操作される)可能性が
ある。

ただし本 PC-REGISTRY は **music-stack 視点での PC 役割のみ** 列挙。workspace
全体 (cross-stack) の coordination は別のレイヤー:

- workspace-level repo (TBD: `openclaw` を昇格させるか、新規 `workspace-meta` /
  `open-claw-lab` 等を作るか) が cross-stack PC レジストリ + work 割り当て
  ダッシュボードを持つべき。
- そこは Claude と Codex が role-agnostic に参加できる orchestration ハブに。
- music-stack 側の本 PC-REGISTRY は、その上位レイヤーから参照される
  「sub-registry」の位置付け。

新 PC を加える時は本 doc(music-stack の役割) と workspace-meta 側の cross-stack
レジストリの**両方**を更新する想定。

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
