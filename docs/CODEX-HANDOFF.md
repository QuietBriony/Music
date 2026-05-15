# Codex CLI Handoff — Music Stack

ユーザーが「Codex CLI 呼んでもいい / 計算資源マックス」と承認済み (2026-05-15)。
重い R&D タスクは Codex に投げる用にプロンプトと context を準備したドキュメント。

## 推奨ワークフロー

1. `cd C:\workspace\github-inventory\music-stack\Music`
2. `codex` (Codex CLI 起動。CLI version は環境で変わるので固定前提にしない)
3. 新規 TASK E 以降を作って該当プロンプトを貼る。下の TASK A-D は履歴。
4. Codex が完了したら手動レビュー → `git diff` で確認 → 問題なければ `git add ... && git commit && git push`
5. 親 Claude (この session) に「Codex で X 完了、次は?」と伝えれば締めとレビューする

## 並列運用の目安

- **Claude 親 (この session) は 1 本のみ**: 設計 / レビュー / 軽量編集 / 引き継ぎ作成。コンテキスト効率優先
- **並列は read-only 監査を基本**: runtime / docs / test gate など担当を分け、編集は親が統合する
- **Codex CLI の並列実装は非推奨**: 使う場合も 1 active implementer のみ。同じファイルを複数 agent に触らせない
- 推奨並列度: 親 1 + read-only audit 2-4 本。実装 worker を増やすのは、write scope が完全に分離できる時だけ

---

## 2026-05-15 完了ステータス

| Task | Status | Commit | Notes |
| --- | --- | --- | --- |
| TASK A — phrase-locked mode transitions | ✅ 完了 | `5c6396e` / v142 | 16 bar 境界 gate + pending mode |
| TASK B — rhythm pattern variation | ✅ 完了 | `bfa9fab` / v143 | 4 bar perturb / 16 bar reset |
| TASK C — genre patterns expansion + cross-app linking | ✅ 完了 | `50f5e02` / v146 | trap / soul-funk JSON + Band Room suggestion |
| TASK D — 40Hz AM focus modulation | ✅ 完了 | `5e21ce1` / v147 | default OFF、8%、AI fill 中は suppression |
| Band Room car volume follow-up | ✅ 完了 | `0166961`, `458b604` / v144-v145 | Media Session fallback + Hazama background audio bridge 移植 |
| Docs sync | ✅ 完了 | `41c6a37` / v148 | Codex task status / cross-doc 整理 |
| Long-session + car audio cleanup | ✅ 完了 | `e1974c8` / v149 | master volume × loudness、stale suggestion clear、debug log gating |
| Route status + runtime quieting | ✅ 完了 | v150 | bridge/direct 表示、focus/FM event churn 抑制 |
| Audit gate + bridge hardening | ✅ 完了 | v151 | index.html cache audit、bridge health、FM start/stop hardening |
| Band Room album flow | ✅ 完了 | v152 | reload default 01、曲末 next track auto advance |
| Album transport + bridge health | ✅ 完了 | v153 | Band Room Media Session track skip、手動曲変更中 bridge 維持、FM/Core bridge fallback |
| Browser playback loudness | ✅ 完了 | v154 | Hazama FM target OUTPUT 88、engine curve / GenreFlavor uplift |
| Band Room → drum-floor handoff | ✅ 完了 | v155 | 現曲 / BPM / section / drum frame を metadata-only SYNC で渡す |
| FM ↔ Band Room visible handoff | ✅ 完了 | v156 | FM genre query → Band Room pattern suggestion、Band Room pattern → FM genre query |
| Drum Floor return song link | ✅ 完了 | v157 | Drum Floor → Band Room `song` query、通常 reload 01 は維持 |
| Hazama FM route badge | ✅ 完了 | v158 | `direct` / `bridge` / `failed` を車載/BT確認用に可視化 |
| FM → Drum Floor handoff + all-merge closeout | ✅ 完了 | v159 | FM genre/BPM を metadata-only SYNC + query fallback で drum-floor preview へ渡し、検証済みPR/branchは残さず締める運用に更新 |
| FM route diagnostics + bridge rearm | ✅ 完了 | v160 | route badge panel から hidden audio bridge の event/output/context を確認し、手動 rearm と loss 時 backoff rearm を実行 |
| Band Room full-song playback + iPhone suspend recovery | ✅ 完了 | v161 | 原音 mode の auto advance を full-song duration に合わせ、iPhone sleep 復帰時に AudioContext / Transport / stems を再同期 |

この文書の下部にあるプロンプト群は **archive** として残す。次に自走する場合は、
完了済み TASK A-D を再実行せず、新規 TASK E 以降として追加する。

---

## Archived Prompts — Do Not Execute

TASK A-D は完了済み。以下は履歴参照のみで、コピペ実行しない。
新規作業は必ず TASK E 以降として、最新 HEAD と user request から作る。

## TASK A — Hazama FM: phrase-locked mode transitions

**問題:**
`engine.js` の `advanceMusicRadioBrain()` が UCM 閾値で発火し、musical phrase 境界 (16-bar / 32-bar) を無視して mode を切り替えるため、転調が「変なタイミング」で入る。

**現状コード:**
- 関数定義: `engine.js` line 3373 付近 `function advanceMusicRadioBrain(context = {})`
- mode 適用箇所: `engine.js` line 10120-10137 (newMode 決定 → EngineParams.mode 代入 → setPatternsByMode)
- 既存の phrase tracker: `MusicRadioBrainState.phrase` (line 711) + `phraseCycles: 24` (line 712)
- 既に "phrase" の概念はあるが、UCM 閾値の方が優先されてしまっている

**Codex プロンプト (コピペ用):**

```
You're improving Hazama FM's mode-transition timing in `engine.js` so transitions only happen at musical phrase boundaries. Currently the brain rotates modes based on UCM threshold values, which fires mid-phrase and feels jarring.

Goal: add a phrase-lock gate so EngineParams.mode only changes at multiples of 16 bars (configurable, default 16).

Steps:
1. Read engine.js around line 3373 (advanceMusicRadioBrain function) and line 10120-10137 (mode assignment).
2. Add a module-level state `BarCounter = { current: 0, lastModeChangeBar: 0, phraseLength: 16 }` near MusicRadioBrainState (line 708).
3. Hook a Tone.Transport bar callback that increments `BarCounter.current` every bar. Find existing Transport callbacks for scheduling reference — look for `Tone.Transport.scheduleRepeat` calls in the file.
4. In the mode assignment block (line 10122 `if (EngineParams.mode !== newMode)`), gate the change:
   - Allow the change only if `(BarCounter.current - BarCounter.lastModeChangeBar) >= BarCounter.phraseLength`
   - If gated, queue the pending newMode and apply it on the next phrase boundary
5. Add a `getNextPhraseBoundary()` helper that returns bars-until-next-phrase
6. Don't break manual preset overrides (the `manual` variable on line 10125) — manual picks should still be immediate
7. Bump cache: sw.js VERSION hazama-fm-v141 → v142, engine.js?v=fm-71 → fm-72, also bump fm.html / index.html

Constraints:
- Don't refactor advanceMusicRadioBrain itself, just gate the EngineParams.mode = newMode assignment
- Phrase length must be configurable via a constant at top of the BarCounter block
- The first mode change after page load should fire immediately (lastModeChangeBar starts at -∞ effectively)
- Report what you changed with line numbers

The full repo is at https://github.com/QuietBriony/Music. After your changes, run `node --check engine.js` to verify syntax.
```

**Estimated tokens (Codex):** 30-50k
**Expected delta:** ~50 lines in engine.js, 4 cache bumps
**Test:** Load fm.html, watch mode-label change → it should only flip at bar boundaries. Console log `BarCounter` to verify.

---

## TASK B — Hazama FM: rhythm pattern variation (Markov-style)

**問題:**
リズムパターンが mode 内で固定。同じ kick/hat パターンが繰り返されて飽きる。

**目標:**
4 小節 (= 1 phrase の 1/4) ごとに、kick/hat/snare パターンに小さな variation を加える。完全な置換ではなく、確率的な「変化」: 1-2 ステップだけ shift / add / remove。

**Codex プロンプト (コピペ用):**

```
You're adding rhythm pattern variation to Hazama FM in `engine.js` so the FM-side drum patterns don't repeat identically forever. Currently scheduleStep uses static kickPattern / hatPattern arrays per mode.

Goal: every 4 bars, apply a small probabilistic variation (Markov-style perturbation) to the current pattern. Reset to base pattern every 16 bars (phrase boundary) to avoid drift.

Steps:
1. Read engine.js around the scheduleStep function (search for `patternAt`, `kickPattern`, `hatPattern`). Find where patterns are looked up per-step.
2. Add a `PatternVariation` module state with:
   - `bar: 0` (current bar counter)
   - `basePattern: { kick: [...], hat: [...], snare: [...] }` (snapshot of base each phrase)
   - `currentPattern: { kick: [...], hat: [...], snare: [...] }` (variation applied)
3. Each bar, call `maybePerturbPattern()`:
   - If bar % 4 === 0 and bar % 16 !== 0: apply 1-2 random perturbations (shift one kick by ±1 sub, mute one hat, add a ghost snare)
   - If bar % 16 === 0: reset currentPattern = basePattern
4. scheduleStep should consult `currentPattern` instead of the per-mode static array
5. On mode change, snapshot new basePattern and reset
6. Constraint: never perturb beat-1 kick or beat-2/4 snare backbone (only off-beats / ghost positions)
7. Bump cache appropriately (depends on TASK A status)

The full repo is at https://github.com/QuietBriony/Music. After your changes, run `node --check engine.js` and listen via fm.html — patterns should subtly evolve every 4 bars.
```

**Estimated tokens:** 40-60k
**Expected delta:** ~80 lines in engine.js
**Dependency:** TASK A's BarCounter is useful here (share state). If running both, do A first.

---

## TASK C — Genre patterns expansion + cross-app linking

**目標:**
v135/v139 で 7 ジャンルパターン JSON ができたが、まだ薄い。あと 2-3 ジャンル追加 + band-room の genre picker と Hazama FM mode の自動リンク。

**Codex プロンプト (コピペ用):**

```
You're expanding the music-stack genre pattern library and adding cross-app linking.

Part 1: Add 2 new drum-pattern JSON files in presets/drum-patterns-genres/ following the existing schema (see boom-bap.json or four-on-floor.json for reference):

- trap.json (140 BPM, 808 sub kick + half-time snare + 16th hat with rolls, 3 frames)
- soul-funk.json (100 BPM James Brown style, kick on 1+the-and-of-2, snare 2/4, busy 16th hat ghost notes, 3 frames)

Each frame should have 18-28 events with realistic velocity (0.3-0.95).

Part 2: Add cross-app linking in fm.js — when Hazama FM mode changes (watch EngineParams.mode), if band-room is open in another tab, set localStorage key `band-room.fm-linked-genre` to a corresponding genre slug. band-room.js polls this on load and suggests the matching genre pattern.

Mode → genre mapping:
- lofi → boom-bap
- jazz → jazz-brush
- techno → four-on-floor
- funk → soul-funk (new)
- dnb / breakbeat / trance → dnb or breakbeat
- ambient → (no auto-pick)
- trap mode (if exists) → trap (new)

Update presets/drum-patterns-genres/README.md to list the 2 new entries.

Bump cache appropriately and add the 2 new JSON files to sw.js PRECACHE_URLS.

The repo is at https://github.com/QuietBriony/Music.
```

**Estimated tokens:** 25-40k
**Expected delta:** 2 new JSON files (~250 lines each), small JS additions
**Independent:** can run parallel with TASK A or B

---

## TASK D — Tier 2 brain.fm 40Hz AM focus modulation

**目標:**
brain.fm 系の研究を踏襲して、40Hz AM (amplitude modulation) を master output に薄くかける focus mode。研究ベースで集中力向上に寄与すると言われている。

**Codex プロンプト (コピペ用):**

```
You're adding a brain.fm-style 40Hz amplitude modulation focus mode to Hazama FM.

Background: research (Pantev et al, Adaikkan & Tsai) suggests 40Hz gamma-band auditory stimulation may enhance focus/cognition. brain.fm applies a low-depth (5-15%) 40Hz AM to their tracks.

Implementation:
1. In engine.js (or a new file audio/focus-modulator.js), add a Tone.Tremolo or manual LFO-driven Gain that modulates the master output at 40 Hz with adjustable depth (default 8%).
2. Wire a toggle in fm.html: <button id="fm-focus-mode">🧠 focus</button> (place near #fm-energy or #fm-genre).
3. When enabled: insert the modulator into the master chain (before destination), starts at 0 depth and ramps to target over 3 seconds.
4. When disabled: ramp depth to 0, then disconnect.
5. The frequency must be EXACT 40 Hz (or 39.5-40.5 Hz range), constant. Don't sync to BPM.
6. Save preference in localStorage.

Constraints:
- Default OFF
- Depth slider optional (start with fixed 8%, can add slider in v143 if user wants)
- Don't apply during AI fill bursts (FmAiFill.status.active)
- The modulation should be SUBTLE — user should not notice it as a tremolo effect

Bump cache: sw.js VERSION → next, engine.js?v=fm-72 → fm-73 etc.

Repo: https://github.com/QuietBriony/Music
```

**Estimated tokens:** 20-30k
**Expected delta:** ~60 lines + UI + CSS
**Independent:** can run parallel with anything

---

## 親 Claude (この session) への引き継ぎ Tips

Codex から戻ってきた場合:
1. `git status` で変更ファイル確認
2. `git diff <file>` でレビュー
3. node --check で syntax check
4. 必要なら手動 fix (Codex の癖: 過剰コメント、不要な refactor、cache bump 忘れ)
5. 1 つの user-facing 機能ごとに 1 commit、message は既存スタイル踏襲 (`feat(music): v142 — 日本語タイトル`)
6. `git push`
7. ユーザーに簡潔報告

## Session 跨ぎでこの doc に到達した Claude へ

- まずこのファイル全体 (`docs/USER-NOTES-MEMO.md` + `docs/CODEX-HANDOFF.md`) を読む
- 次に最新の git log を確認 (`git log --oneline -15`)
- 完了済み TASK A-D は再実行しない。新規 request / notes から TASK E 以降を作る
- 完了後にユーザー報告 + 次の TASK 候補を提示
