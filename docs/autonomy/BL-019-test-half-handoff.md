# BL-019 test half — codex 用 handoff doc

`BACKLOG.md` BL-019 のうち、namima-lab → namima 半分 (sub-task a) は
2026-05-25 chouta-surface session で shipped (namima PR #32)。

残る **test → Music (sub-task b)** と **test → drum-floor (sub-task c)** は
codex が拾うことを想定して書いた handoff。

---

## 1. 全体ゴール

`test/engine.js` (428 行、archive repo) の harvest 素材を、`docs/archive-repo-harvest-audit.md`
§4 のルートに沿って Music と drum-floor へ docs-only 翻訳する。

- **runtime コードコピー禁止** — 数値・概念だけを target repo の言葉に書き換える
- **schema / audio / sample / 依存 追加禁止**
- **1 PR = 1 idea** で sub-task b と c は別 PR
- **human-gate** — 翻訳語彙妥当性 user 確認、PR は merge せず保留

## 2. Source 構造 (`test/engine.js` 読み解き)

### Layer 1 (sub-task b の素材) → Music

L115-164: `ARCH` 配列に 4 archetype:

| name | bpm | swing | dist | kick808 | kick909 |
|---|---|---|---|---|---|
| Ambient | 86 | 0.0 | 0.0 | 0.1 | 0.0 |
| Lo-Fi | 80 | 0.3 | 0.05 | 0.9 | 0.1 |
| Goa | 148 | 0.02 | 0.4 | 0.2 | 0.8 |
| HardTechno | 165 | 0.0 | 0.85 | 0.0 | 1.0 |

各 archetype は 16-step `pKick` / `pSnare` / `pHat` / `pBass` の probability vector を持つ
(L122-126, 134-138, 146-150, 158-162)。

L246-251: `styleNameFromS(s)` の 4 段階閾値 (0.2 / 0.5 / 0.8)。

### Layer 2 (sub-task c の素材) → drum-floor

L93-95: `rand(prob)` — `Math.random() < prob` の per-step gate。

L183-244 `computeStyleBlend()`:
- `s = State.style / 100` を 3 segment (`seg = 1/3`) で 4 archetype の隣接ペア間に
  位置付け、`t = (s - seg*iA) / seg` で内部位置を出す
- `EngineParams.bpm = lerp(A.bpm, B.bpm, t)` 等で **全パラメータを lerp**
- 16-step probability も `EngineParams.pKick[i] = lerp(A.pKick[i], B.pKick[i], t)` で
  per-step lerp
- 最後に `rand(EngineParams.pKick[step])` で per-step probabilistic gate

つまり「2 archetype 間の隣接 lerp → per-step rand」が確率補間アルゴリズム本体。

## 3. Sub-task b の handoff (test → Music)

### 着手先

`Music/references/style-archetype-from-test.json` (新設) と `Music/docs/test-style-archetype-translation.md` (新設)。

- `references/` は sw.js precache 登録済みの reference 領域 (`apple-music-refs.json` /
  `hazama-fm-pill-refs.json` の隣)
- `docs/test-style-blend-preset-morph-decision.md` が既存 (boundary 文書) で参照される

### 翻訳のコア

- 4 archetype を Music の **preset morph / reference-gradient** 言語に翻訳
- Hazama FM の既存 pill (`any/ambient/techno/lofi/jazz/funk/piano`) と archetype の
  対応関係を明示 (Ambient↔ambient pill, Lo-Fi↔lofi pill, Goa↔techno pill の 一部 etc.)
- HardTechno は Music の public-facing pill にはマッピングしない (reference only)
- BPM range / swing / dist は `MUSIC_RADIO_BRAIN_PROGRAMS` の bias parameter として
  「もし将来 morph するならこの値レンジ」を記録 (runtime には配線しない)

### Adopted / Deferred / Rejected matrix の枠 (precedent: namima/docs/organic-pluck-lab-recipe.md §5)

| Element | Status | 理由 |
|---|---|---|
| Ambient archetype (bpm 86, dist 0.0, sparse kick) | Adopted (concept) | ambient pill と整合 |
| Lo-Fi archetype (bpm 80, swing 0.3, kick808 0.9) | Adopted (concept) | lofi pill と整合、swing は既存 LEVEL_BY_GENRE と比較 |
| Goa archetype (bpm 148, dist 0.4) | Deferred | psy-trance 系は Hazama FM の現 pill には無い、参考値として保留 |
| HardTechno archetype (bpm 165, dist 0.85) | Rejected | "外部 / sister repo からの harvest は非干渉で / Music engine tuning without fresh review" (AGENTS Rule 6) — Music の public-facing には過剰 |
| 4-segment style fader (0..100) UI 構造 | Rejected | Music UI には fader を増やさない、pill ベースを維持 |
| 16-step probability per-archetype | Deferred (詳細は sub-task c 側へ) | probability の物質は drum-floor 担当 |
| kick808/909 mix probabilities | Rejected | Music は Tone.js 合成のみ、sample 依存禁止 (AGENTS Rule 3) |

### 完了条件

- `Music/references/style-archetype-from-test.json` 新設 (4 archetype の数値を JSON で)
- `Music/docs/test-style-archetype-translation.md` 新設 (翻訳語彙 + Adopted matrix)
- `Music/docs/archive-repo-harvest-audit.md` §4 test 節に「§4.5 translation status」
  小節を追記 ("test/engine.js ARCH harvest is now translated, see ...")
- `sw.js` の precache に新 JSON を追加 + 該当の cache bump (audit.py が要求するため)
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0
- `python -X utf8 scripts/audit.py --quiet`: exit 0
- PR タイトル例: `docs(music): BL-019b — translate test style archetype to references + docs`
- human-gate: 翻訳語彙の妥当性 user 確認待ち、merge しない

## 4. Sub-task c の handoff (test → drum-floor)

### 着手先

`drum-floor/docs/probability-interpolation-from-test.md` (新設) と、必要なら
`drum-floor/docs/schema/groove-grammar-draft.md` (schema-only draft、まだ実装しない)。

### 翻訳のコア

- 「2 archetype 間 lerp → per-step rand」アルゴリズムを drum-floor の `groove-engine`
  / `audio-engine.js` の語彙で記述
- drum-floor 側は既に `check-music-sync-safety.mjs` で「同 seed → byte-identical bar」
  決定性を gate にしているため、本翻訳は **stochastic な per-step rand を runtime に
  入れる提案ではなく**、deterministic な seed-based pattern を 2 archetype 間で lerp
  する将来形を docs だけで記録する
- BL-009 (drum-floor の groove-engine 決定性 check) と整合性を保つ表現に

### Adopted / Deferred / Rejected matrix の枠

| Element | Status | 理由 |
|---|---|---|
| 2-archetype 隣接 lerp (segment-linear) | Adopted (concept) | 滑らかな blend に有用、決定性も保てる |
| 16-step probability vector の lerp | Adopted (concept) | per-step 確率の中間値表現として記録 |
| `Math.random() < prob` per-step gate | Rejected | drum-floor の SYNC 安全契約 (auto-start / arm / MIDI 禁止) と決定性 (同 seed → 同 bar) に反する |
| 代替: seeded RNG (mulberry32 等) で per-step gate | Deferred | groove-engine の決定性 gate と整合するなら将来検討 |
| 4-segment archetype 構造そのもの | Deferred | drum-floor が将来 archetype を持つかは separate decision |
| BPM lerp / swing lerp | Adopted (concept) | translation contract clamp と整合 |

### 完了条件

- `drum-floor/docs/probability-interpolation-from-test.md` 新設
- `drum-floor/docs/archive-references.md` (もしあれば) に link、無ければ
  `drum-floor/README.md` の docs index に追加
- 必要なら `drum-floor/docs/schema/groove-grammar-draft.md` を schema-only draft で追加
- runtime コード (`src/audio-engine.js` / `src/groove-engine.js` 等) は **触らない**
- `node scripts/stack-check.mjs` (Music root から): PASS 15 / FAIL 0
- drum-floor 側 check: `node scripts/check-music-sync-safety.mjs` PASS、`pytest tests/` PASS
- PR タイトル例: `docs(drum-floor): BL-019c — record test probability interpolation as docs-only reference`
- human-gate: 翻訳語彙 / 決定性整合性 user 確認

## 5. 進め方の順序

推奨順序:

1. **sub-task b 先行** — Music repo 内で完結、sw.js cache bump で audit.py との
   整合を取る経験が積めて、sub-task c の前提も整理できる
2. **sub-task c は b の後** — drum-floor の `check-music-sync-safety.mjs` 不変条件
   (auto-start / arm / MIDI 禁止 + 決定性) との整合を慎重に通すため、b で
   archetype 概念を整理し終わってから着手

ただし **同時並列でも OK** — b と c は別 repo、別ファイル、互いに依存しない。

## 6. codex 用 1-shot prompt (コピペ可)

```text
このセッションは music-stack 専用 lane。chouta-surface (Surface) 横で codex CLI
として走る前提。BL-019 の test half (sub-task b と c) を消化する。

参照:
- `Music/docs/autonomy/BL-019-test-half-handoff.md` (本 doc) を全部読む
- `Music/docs/autonomy/BACKLOG.md` の BL-019 entry を読む (sub-split 済み)
- `namima/docs/organic-pluck-lab-recipe.md` を読む (sub-task a の precedent、§5
  Adopted/Deferred/Rejected matrix のテンプレ)
- `Music/docs/archive-repo-harvest-audit.md` §4 (test 節) を読む
- `Music/AGENTS.md` の Hard Rule 1-6 を確認 (engine.js 不変、samples 禁止、
  harvest 非干渉)
- `test/engine.js` 428 行を読む (source、特に L115-164 ARCH、L183-244
  computeStyleBlend)

posture:
- PR-required、main 直 push 禁止
- engine.js / band-room.* / sw.js 既存 VERSION 不変 (sub-task b は新規 JSON 追加 +
  precache list 拡張 + VERSION bump のみ)
- docs-only / reference-only、runtime 配線禁止
- human-gate yes、merge せず保留
- 1 PR = 1 idea で sub-task b と c は別 PR

着手:
1. BACKLOG BL-019 に `status: wip — codex YYYY-MM-DD (test half 着手)` を追記 commit + push (claim)
2. sub-task b を消化 (Music repo、Music PR)
3. sub-task c を消化 (drum-floor repo、drum-floor PR)
4. 各 PR 立てた後 BACKLOG BL-019 status を "b shipped" / "b+c shipped" に更新
5. b と c が両方 shipped されたら BL-019 全体を `## Done` へ move、SESSION-LEDGER 追記

完了条件は本 doc §3 / §4 各「完了条件」節を満たすこと。
stack-check 0 BAD と audit.py exit 0 が必須。
```

`codex exec "$(cat docs/autonomy/BL-019-test-half-handoff.md | tail -40)"` のような
形でも投げられる (上記 prompt は本 doc 末尾 40 行に収まる)。

## 7. 注意事項

- sub-task b で `references/style-archetype-from-test.json` を追加するなら
  `sw.js` precache list に追加 + VERSION bump (`hazama-fm-vNN` → `+1`) が必要
  ([AGENTS.md `## Cache buster discipline`](../../AGENTS.md) 参照、`audit.py` が
  precache list と VERSION の整合を gate にしている)
- sub-task c は drum-floor だけ触る、Music の sw.js には影響しない
- chouta-surface 側で並走中の場合は `git pull --ff-only origin main` で claim を見る
  (現状は chouta-surface 主体の session で並走無いが、studio-surface が UR44 接続
  後に動く可能性あり)
- `band-room.*` 一切編集しない (Band Room チャット worktree 専用)
- 試聴判断は不要 (本 PR は docs-only)。ただし将来 runtime 化するならその時に
  studio-surface で試聴 human-gate

## 8. Related

- `docs/autonomy/BACKLOG.md` BL-019
- `docs/autonomy/SESSION-LEDGER.md` 2026-05-25 chouta-surface entry
- `docs/archive-repo-harvest-audit.md` §4
- `docs/test-style-blend-preset-morph-decision.md` (boundary 既存)
- `namima/docs/organic-pluck-lab-recipe.md` (sub-task a precedent)
- `namima` PR #32 / `Music` PR #242 (sub-task a deliverable)
- `AGENTS.md` Hard Rule 1-6 + Cache buster discipline
