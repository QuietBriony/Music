# AGENTS.md — Music repo operating contract

このリポを触る agent (claude code / codex / 他) が **最初に読む** 共通ルール。
Hazama FM と Music Core Rig を壊さずに磨くための最低契約事項。

詳しい並列開発ガイドは [docs/COLLAB-CLAUDE-AND-CODEX.md](docs/COLLAB-CLAUDE-AND-CODEX.md) を参照。

---

## Hard rules (絶対守る)

1. **`engine.js` は原則改変禁止**。12k 行のライブランタイム。
   - Hazama FM 用の追加は `fm.js` / `fm.css` / `audio/genre-flavor.js` で吸収する
   - どうしても engine 内部を触る必要があるときは **必ず `MusicRadioBrainState` 周辺のような明確に境界が引ける箇所** に限定する
   - 例外: cache buster / VERSION の bump、Music Core Rig と Hazama FM が共有する短い runtime cue API のみ
2. **無人の PR auto-merge は禁止**。ただし user が「全mergeで締めて」と明示した turn は、検証済み PR / branch を main へ merge・push し、merged branch を削除してから final する。
3. **音源 / サンプル / 歌詞は repo に追加しない**。すべて Tone.js 合成。
4. **GitHub Actions の新規追加は user 承認必須**。現状は `audit.py` をローカル / CI 任意手動実行。
5. **`presets/*.json` (Hazama FM 用 6 ファイル) と `presets/<legacy>.json` (engine 用 6 ファイル) を混同しない**。詳細は `presets/SCHEMA.md` Section 4.

---

## Integrity gate (commit 前に必ず通す)

```bash
python -X utf8 scripts/audit.py --expected-version hazama-fm-v162
node scripts/check-js.mjs
node scripts/check-band-room-logic.mjs
node scripts/check-fm-route-badge.mjs
```

`0 BAD, 0 WARN` の状態でのみ commit する。BAD があれば commit せず原因解決。

これが claude code / codex どちらでも回るので、**両 agent が同じ整合性ゲートを共有**できる。

`audit.py` が見る範囲:
- preset JSON (Hazama FM 6 ファイル) の schema / version 整合
- `loader.js` PRESET_FILES と FS の整合
- `genre-flavor.js` PRESET_BY_GENRE と loader keys の対応
- `sw.js` precache list (Hazama FM 6 ファイル + 必要 assets) の網羅と local file existence
- cache buster (`?v=fm-N` / `?v=br-N`) が `fm.html` / `index.html` / `band-room.html` と `sw.js` precache list で path 単位一致
- `sw.js VERSION` が expected version / release docs と一致
- engine.js `MUSIC_RADIO_BRAIN_PROGRAMS` の各番組が reset / reason / target / station ident / bias を満たす
- `LEVEL_BY_GENRE` が全 7 pill (any/ambient/techno/lofi/jazz/funk/piano) をカバー

---

## Cache buster discipline

UI 変更 (fm.html / fm.js / fm.css) は **必ず 3 箇所同期 bump**:
1. `fm.html` の `?v=fm-N` (全 script/link)
2. `sw.js` の `PRECACHE_URLS` 内 `?v=fm-N`
3. `sw.js` の `const VERSION = "hazama-fm-vN"`

`audit.py` が一致を検証する。

ローカルから手動で bump する手順 (claude / codex 共通):
```bash
# 例: v32 → v33
sed -i 's/v=fm-32/v=fm-33/g' fm.html sw.js
sed -i 's/hazama-fm-v32/hazama-fm-v33/g' sw.js
python -X utf8 scripts/audit.py --expected-version hazama-fm-v33   # 0 BAD 確認
node scripts/check-js.mjs
git add -A && git commit -m "..." && git push
```

---

## Branch & PR convention

| 状況 | 推奨 |
|---|---|
| Hazama FM の UI/UX 改修 | feature branch (`feature/<topic>`) → PR → review → merge |
| 音量・LEVEL_BY_GENRE 微調整 | main 直 push 可 (claude code の 1 行変更パターン) |
| engine.js 改変 | **必ず PR**、user 確認必須 |
| docs only | main 直 push 可 |
| 並列開発で衝突懸念ある時 | feature branch + PR で安全に |

`git pull --ff-only origin main` を **作業前に必ず実行**。
他 agent の最新 commit を取り込んでから新作業。

---

## Cache / preset 取り込み手順 (sister repo から)

```bash
# sister repo の main から JSON を fetch
curl -sL https://raw.githubusercontent.com/QuietBriony/<repo>/main/exports/<file>.json \
     -o presets/<file>.json

# audit で schema チェック
python -X utf8 scripts/audit.py --expected-version hazama-fm-v162

# 必要なら cache bump (sw.js precache に追加が要る場合)
# commit + push
```

詳細は [`docs/codex-prompts/<repo>-export.md`](docs/codex-prompts/) と
[`presets/SCHEMA.md`](presets/SCHEMA.md) 参照。

---

## Agent-specific notes

### claude code (この repo 内では UI/UX + 統合 orchestrator 役)

- 強み: アーキテクチャ俯瞰、preset 取り込み (sister repo → Music)、UI/UX 改善、ドキュメント整備、整合性監査の orchestrator
- 担当しやすい範囲: `fm.js` / `fm.css` / `fm.html` / `audio/genre-flavor.js` / `presets/loader.js` / `scripts/audit.py` / `docs/`
- `engine.js` には触らない方針

### codex (このリポ内では deep 修正 + sister repo specialist 役)

- 強み: 各 sister repo の事情に詳しい、ローカル test 実行、PR 完結
- 担当しやすい範囲: sister repo の export 増強、Music 内の deep refactor、特定の narrow なバグ修正
- engine.js に手を入れる必要があるときは codex が PR を立てて user 承認 → merge

### 並列開発 (両方が同時に動く場合)

- 各 agent は **commit 前に `git pull --ff-only origin main`** で最新化
- 他 agent が同じファイルを触ってたら、**今の作業ブランチに rebase** or **手動マージ**
- 衝突しやすいファイル: `fm.js` (最頻出)、`fm.css`、`sw.js`、`audio/genre-flavor.js`
- 衝突しにくいファイル: `presets/*.json` (各 sister repo 別)、`docs/*.md` (基本独立)、`scripts/audit.py` / `scripts/check-*.mjs` (両方が育てる)

---

## 緊急ロールバック

main で重大バグが出たら:
```bash
git revert <bad-commit-hash>
git push origin main
```
GitHub Pages が次に build した時点で復旧 (1-2 分)。
強制 push (`--force`) は禁止。

---

## 参考

- [docs/COLLAB-CLAUDE-AND-CODEX.md](docs/COLLAB-CLAUDE-AND-CODEX.md) — 並列開発の詳細プレイブック
- [docs/HAZAMA-FM-ARCHITECTURE.md](docs/HAZAMA-FM-ARCHITECTURE.md) — システム全体像
- [presets/SCHEMA.md](presets/SCHEMA.md) — preset JSON 契約
- [docs/USAGE-HAZAMA-FM.md](docs/USAGE-HAZAMA-FM.md) — Hazama FM ユーザーマニュアル
- [docs/USAGE-MUSIC-CORE-RIG.md](docs/USAGE-MUSIC-CORE-RIG.md) — Music Core Rig ユーザーマニュアル
