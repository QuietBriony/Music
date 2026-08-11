# Codex CLI Handoff — Music Stack

> **Current control-plane snapshot — verified 2026-08-11**
>
> `last_verified_commit: fdef2dbf222b65d9445d7a060cc70443d1259287`
>
> 実行タスクの正本は [autonomy/BACKLOG.md](./autonomy/BACKLOG.md)、直前sessionの状態は
> [autonomy/SESSION-LEDGER.md](./autonomy/SESSION-LEDGER.md)。このmarker以後に事実ソースが
> 変わった場合は`check-autonomy-doc-currency.mjs`が再確認を要求する。

この文書はCodex / Claude等がMusic repoへ入るための現行入口と、過去promptのarchive。
2026-05-15の「計算資源マックス」は歴史的なsession承認であり、現在のGPU利用許可ではない。
machine / capabilityの正本は`config/music-machines.json`、外部modelのrevision・保存先・
明示download条件は`config/external-dependencies.json`。`worker-gaming` / `worker.gpu`を使う
処理は、operatorが空きとdownload / executionを明示した時だけ行う。

## 現在地（2026-08-11）

- 通常の遊び方は`listen.html` → HAZAMA Band Room → Lyric Lab。HAZAMAは01/02とも
  原音4-stem（基準）とAI再現を切替可能。02 AIは02固有ではなく01 frames共有の暫定版。
  v400は01/02のsession-only KARAOKEと曲別歌詞境界を追加。v400 Surface passは操作安定○、
  AI短音過密×。v401はarp + basslineのauthored基準配置を20–21発/barへ整理した
  authored-rest再試聴候補（bass runtimeはそこから発音を減らすだけ）。
  v401実音とreal mobileは未確認のAMBERで、main selector昇格はBL-041待ち。
- Lyric Labのprivate `/api/lyric-drafts`はService Workerをbypassし、Cloudflare Pages
  Functions / D1側がauthと`no-store`を所有する。
- browser / sample / worker / model依存は`config/external-dependencies.json`の24件が正本。
  ACE-Step / Demucs / Whisperのweightはrepo外、tracked weightは0。
- 現行cacheは`hazama-fm-v401`。Band Room runtime markerは`band-room.js?v=br-236` /
  `band-room.css?v=br-90`。実音・mobile・車載 / Bluetoothを自律checkだけで合格扱いにしない。
- Tabascoのregistry / catalog duration正本は`presets/bands.json`、BPM / key / 構成は
  7 drum-frame、canonical / fallback歌詞はfinal lyrics。stems karaokeは5曲だけ
  ASR由来の`tabasco-lyrics-timed.json`を使う。`presets/tabasco-songs.json` v2は
  runtime非消費 / SW非precacheの派生inventoryで、
  BPM / keyは人耳確認まで`human_unverified`。asset provenance決定はBL-035に残す。
- `origin/main`より先のlocal stacked branchがあり得る。branch名やcommit件数ではなく、現物・
  ancestry・`last_verified_commit`以後の事実差分でcurrencyを判断する。

## 現行ワークフロー

1. `cd C:\workspace\music-stack\Music`
2. `codex`（Codex CLI 起動。CLI version は環境で変わるので固定前提にしない）
3. **`docs/autonomy/AUTONOMOUS-RUN.md` のプレイブックに従う** — STACK-INDEX /
   SESSION-LEDGER / BACKLOG を読み、`agent: codex` / `agent: either` の item を 1 つ
   claim（`status: wip` を即 commit）して回す。下の TASK A-E は履歴で再実行しない。
4. 完了したら差分レビュー → `git diff --check` → `node scripts/stack-check.mjs`で0 BAD → commit
5. 共有docs更新直前にpullを試し、`BACKLOG.md`（Doneへ移動）と`SESSION-LEDGER.md`
   （最新entryを先頭へ追記）を同期。接続制限等でpull / pushできなければlocal commitを残して報告

## 並列運用の目安

- **Claude 親 (この session) は 1 本のみ**: 設計 / レビュー / 軽量編集 / 引き継ぎ作成。コンテキスト効率優先
- **並列は read-only 監査を基本**: runtime / docs / test gate など担当を分け、編集は親が統合する
- **Codex CLI の並列実装は非推奨**: 使う場合も 1 active implementer のみ。同じファイルを複数 agent に触らせない
- 推奨並列度: 親 1 + read-only audit 2-4 本。実装 worker を増やすのは、write scope が完全に分離できる時だけ

---

## Historical archive — 2026-05-15 完了ステータス（Do Not Execute）

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
| Band Room final singable lyrics | ✅ 完了 | v162 | Tabasco 7 曲の歌詞候補を一本化し、Band Room 表示を `tabasco-lyrics-final.md` の final singable だけに整理 |
| Band Room offline cache + route copy | ✅ 完了 | v163 | cache-busted lyrics / drum-frame fetch を offline-safe 化し、Band Room / Drum Floor 導線を手動previewとして表示 |
| Chill Session visible route | ✅ 完了 | v164 | Music Core overview に Chill Session 入口を追加し、chill 側の metadata-only / human START 境界を画面で明示 |
| Band Room song timeline / seek | ✅ 完了 | v165 | START 下に分秒バーを追加し、停止中 seek → 任意地点 START、再生中 seek → stems / section / lyrics 同期に対応 |
| Band Room source-derived AI part agents | ✅ 完了 | v166 | AI 再現の bass / guitar / vocal / chords が原曲 drum-frame と chord/section から自律 pattern を組み、bass/guitar 初期音色を electric sampler に寄せる |
| Band Room default mix polish | ✅ 完了 | v167 | master headroom / stem EQ / vocal FX / AI bus default / presets を控えめに再調整し、標準状態で長く聴ける出音へ寄せる |
| Band Room saved mix migration | ✅ 完了 | v168 | 旧 localStorage default slider だけを新 mix へ移行し、既存ブラウザでも v167 の出音が反映されるようにする |
| Hazama FM melodic director | ✅ 完了 | v169 | 8〜16 bar phrase ごとに key center / contour / chord turn を動かし、固定断片の旋律反復を減らす |
| Hazama FM / Music Core Rig bassline director | ✅ 完了 | v170 | 4〜8 bar phrase ごとに bass gate / interval walk / human push を動かし、main synth / lofi / dub bass の固定 root loop を減らす |
| Band Room PWA + screen-lock hardening | ✅ 完了 | v171 | 専用 manifest を追加し、screen lock / blur / freeze / pagehide で sampled instruments も含めて panic release |
| music-stack 自律開発エンジン | ✅ 完了 | v174 | `docs/autonomy/` 5 文書 + `scripts/stack-check.mjs` + sister repo AGENTS.md ×4。次タスクの正本を `docs/autonomy/BACKLOG.md` へ集約 |
| 自律開発エンジンを Codex 共同開発対応に | ✅ 完了 | v175 | AUTONOMOUS-RUN に Codex on-ramp + 共同開発セクション、BACKLOG に claim ルール / status フィールド、本 doc の workflow を engine 連動へ更新 |

この文書の下部にあるプロンプト群は **archive** として残す。

**次タスクの正本は `docs/autonomy/BACKLOG.md`**（2026-05-16 v174 で集約）。
Codex も `docs/autonomy/AUTONOMOUS-RUN.md` のプレイブックに従い、BACKLOG の
`agent: codex` / `agent: either` item を取る。完了済み TASK A-E は再実行しない。

---

## Archived Prompts — Do Not Execute

TASK A-E は完了済み。以下は履歴参照のみで、コピペ実行しない。
新規作業は上部の現行workflowからBACKLOG itemをclaimし、TASK番号から作らない。

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

## Historical review tips（現行gateは上部workflowを使用）

Codex から戻ってきた場合:
1. `git status` で変更ファイル確認
2. `git diff <file>` でレビュー
3. node --check で syntax check
4. 必要なら手動 fix (Codex の癖: 過剰コメント、不要な refactor、cache bump 忘れ)
5. 1 つの user-facing 機能ごとに 1 commit、message は既存スタイル踏襲 (`feat(music): v142 — 日本語タイトル`)
6. `git push`
7. ユーザーに簡潔報告

## Historical session note — superseded by autonomy control-plane

- この節より上の現行workflow、`autonomy/AUTONOMOUS-RUN.md`、BACKLOG、LEDGERを使う。
- `USER-NOTES-MEMO.md`や下のTASK番号から作業を選ばない。A-Eはすべて歴史資料。
- 最新git logと現物は確認するが、未claimの古い候補を自動で復活させない。

---

## Historical archive — 2026-05-25 AI再現 + measurement-driven thread (v245-v276)

長尺 thread が一段落。v265 で生音 5/5 達成、v272-v276 で measurement
loop 完成 + 実 calibration 2 回。

### Historical AI再現baseline（v276時点）

| パート | 音源 | groove |
|---|---|---|
| drums | 🌐 tone-acoustic CDN kit (v259) | backbeat velocity floor (v247) + humanize ±10% (v252) |
| bass | 🌐 bass-electric CDN Sampler (v267) | kick lock ±50ms + cramps push -10ms (v249, v264) |
| guitar | 🌐 guitar-acoustic CDN Sampler (v265) | kick lock ±50ms (v250) |
| chord | 🌐 Salamander Grand Piano (v262) | whole-note sustain (v257)、vol 40 (v255) |
| voice | OFF (v254) | — |

その他: v258 catalog race fallback、v261 UX coherence、v270 jsDelivr Sampler
loader バグ workaround、v271 section dynamics ±47%、v274 instrumentBus EQ
high +1.6 dB, v275 instrumentBus comp 緩和

### Measurement loop (完成、ffmpeg 不要)

1. `scripts/analyze-band-stems.py` — librosa で stems 解析 →
   `docs/target-spec-bands.json` per-song spec
   - drums section: bpm / kick onsets / pocket
   - bass section: bass→kick lock %
   - mix section (v276): full-mix の centroid / DR ← AI capture と fair 比較
2. band-room ● REC → WAV 直 download (v272 で webm→wav 変換)
3. `scripts/compare-capture.py <wav> <band>/<song>` → 数値 diff + verdict

### 実 calibration の demonstration

```
v270 初 capture → brightness -2077 Hz/DR -21 dB ギャップ (drum-only ベース)
v274 instrumentBus high +1.6 dB → brightness +976 Hz 改善（実測）
v275 comp threshold -20→-14 dB → DR 拡張（実測未取得、preview render hang）
v276 target を full-mix で再生成 → 過去解釈の偏りが判明
  → 真の brightness ギャップ -364 Hz (small)
  → 真の DR ギャップ AI 12.3 vs target 10.8 = AI overshoot → v275 不要だった可能性
```

normal science の小サイクル完走。

### Historical open options — status catch-up（Do Not Execute）

| 2026-05-25候補 | 2026-08-02の事実 |
|---|---|
| autonomous re-capture / brightness | v284-v290でoffline renderer、rolloff、EQ / exciter / rebalanceまで実施済み |
| section-aware part入退場 | repo内に完了根拠なし。現行BACKLOGへ再起票されない限り実行しない |
| kick → bass sidechain | HAZAMAはv368でGain automation型duckを実装。Tabasco一般化は未claimで、代替完了扱いしない |
| v270 regression sweep | 実音 / background / mobile確認はBL-041とBL-003のhuman gateへ集約 |
| 計測指標 | `rolloff_p85_hz` / `tempo_stability_pct`はv283で実装。section-wise RMSは未claim |

### Historical Codex prompt — Do Not Execute

以下は当時の作業形式を保存しただけで、現在のBACKLOG / AGENTS / machine contractを
満たさない。候補選択やbranch作成にコピペしない。

推奨 codex prompt:

```
# Context
Read these files in order:
1. docs/CODEX-HANDOFF.md (this doc) — esp. "2026-05-25 AI 再現" section
2. docs/BAND-ROOM-CHANGELOG.md head (v245-v276 entries)
3. docs/MEASUREMENT-LOOP.md
4. docs/target-spec-bands.json (per-song target numbers)

# Task
Pick the highest-priority item from "未解決 / open options" above.
If autonomous (no user action), execute it. Otherwise, prep a 1-line
question for the user. Standard ship discipline:
- branch feat/band-room-vNNN-<name> from origin/main
- bump sw.js VERSION + band-room.js?v=br-NNN cache buster
- update docs/BAND-ROOM-CHANGELOG.md with vNNN entry
- run 4 gates: check-band-room-logic / check-js / audit.py --expected-version / check-fm-route-badge
- commit via Conventional Commit form, PR, squash-merge
- watch gh run + curl deploy verify
- preview-validate if applicable (Claude Code: recipe in
  `docs/MEASUREMENT-LOOP.md` §4 autonomous capture. **codex は preview
  MCP 無いので人 ● REC 待ち** — `docs/MEASUREMENT-LOOP.md` §2 通り)

# Standing constraints (CRITICAL — user-set)
- 原音 (stems mode) は触らない — instrumentBus が AI 専用、stems は
  stemBus 経由で master 直結
- 音源 / サンプル / 歌詞は repo に追加しない、Tone.js 合成 or CDN サンプルのみ
- destructive git 禁止 (parallel session の WIP 保護)
- 再生 test するなら必ず停止
- FM チャットの領分: engine.js / fm.html / fm.css / fm.js — 触らない
- sw.js / docs/BAND-ROOM-CHANGELOG.md は両チャット共有、commit 前に
  必ず git fetch origin、衝突時は版番号大きい方
- Anthropic 課金: 重い R&D は codex 推奨、ship discipline は claude 親
```

---

## Historical audit — 2026-06-13 audio-overload FM hand-off（v359-v360実装済み）

Music repo 全体を **1 クラス限定**（audio-thread overload / playback dropout /
「ちゃんと鳴らない」/ 徐々に slowdown → silence）で監査した結果の引き継ぎ。
band-room 側の**修正可能分は全て決着済**:

| Finding | 状態 |
|---|---|
| band-room AI→原音 で synth band 残留（常時 FX が原音へ波及） | 修正済 #353 / v354 |
| band-room master light ゲートの mode 依存 | 修正済 #352 / v353（sibling session）|
| genre-flavor `pumpGain` master leak（drum-frames 切替ごとに master 直結 Gain が漏れる） | 修正済 #355 / v356 |
| class 4（feedback/暴走）・class 5（rAF 枯渇） | clean（該当なし）|

以下2件は監査時点では **FM領分の未着手finding**だった。現在はv359で
`addAcousticFunField`のlight gate、v360で画面内`auto / light / full`切替まで実装・merge済み。
BL-028に残るのは弱端末の実音human gateであり、この歴史節から再実装しない。

### F-1 — `addAcousticFunField` の常時 DSP 負荷（全 genre）

- 定義: `audio/genre-flavor.js:1308` `function addAcousticFunField(layer, pill)`
- 呼出: `applyProductionGovernor`（`:1322`）経由で**全 genre build 経路**から無条件:
  `:295` `:298`（ambient）/ `:320`（acid）/ `:1798` `:2052` `:2918` `:2942`（drum-frames 各種）/
  `:2080`（lofi）/ `:2580` `:2592`（jazz）/ `:3270` `:3278`（piano）
- active genre ごとに常時稼働 DSP を 3 サブフィールド積む:
  - `addMonoLowAnchor`（`:1091`）: `Tone.Distortion oversample:"2x"`（sat, `:1098`）+ FMSynth sub
  - `addOrbitalAirField`（`:1143`）: 常時 `Tone.Reverb`（`:1149`）+ PingPongDelay +
    `AutoPanner×2` `.start()`（`:1152-1153`、連続 LFO）+ FMSynth(glass) + MetalSynth + NoiseSynth(air)
  - `addNullZoneRefractions`（`:1219`）: 常時 `Tone.Reverb`（`:1225`）+
    `Tone.Distortion oversample:"2x"`（fold, `:1229`）+ `AutoPanner×2` `.start()`（`:1230-1231`）+
    FMSynth×2(glass/chirp) + NoiseSynth(dust)
- **正味コスト/active genre: +2 常時 Reverb、+4 起動済 AutoPanner、+2 oversample "2x" Distortion**
  （加えて 2 PingPongDelay / 2 StereoWidener / ~5 FM・Metal synth / 2 NoiseSynth / 多数 Filter /
  3 scheduleRepeat）。core-overload 原則: master 接続中は trigger 有無に関わらず全 quantum を処理。
- **leak ではない**: 各 node は `layer.synths.push(...)`（`:1138` `:1214` `:1303`）済 →
  genre 切替で `teardownActive` が dispose。蓄積ではなく active 中の steady-state CPU コスト。
  （pumpGain leak #847 とは別物。あちらは累積、こちらは定常負荷。）

### F-2 — device/light-runtimeゲートの不在（監査当時。現在は解消）

- `applyProductionGovernor`→`addAcousticFunField` の gating は**音楽的なものだけ**:
  movement intro skip（`:1184` `:1262`）/ 会話 role の chance scaling / dropBar 抑制。
  これらは note **trigger** を減らすだけで、上記の常時 Reverb/LFO/oversample 構築は止めない。
- 監査時点のgenre-flavor.jsにはdevice-tier / light-runtime概念が**皆無**だった
  （`light|lowPower|deviceTier|isMobile|reduceFx|perfMode` grep clean。`:806` の "Light wash" は
  美的 wash の意で端末ゲートではない）。弱端末でも full stack を構築・稼働する。
- band-room の master が v353/#352 で獲得した「mode 依存 light ゲート」のような逃げ道が FM 側に無い。

### Historical proposed approach（v359-v360で実装、実音判断だけ未完了）

1. light/low-power ゲートを 1 本追加し、active 時は `addAcousticFunField` を skip するか
   軽量変種を構築（2 Reverb → flavor 層共有の send 1 本 / oversample "2x" → 無し /
   AutoPanner×4 `.start()` → 静的 `Panner`）。**最大の高価値は 2 常時 Reverb と oversampling**
   （trigger と無関係に常時コスト）。
2. light **OFF** 時は出音キャラを完全不変に保つ（原音/デフォルト挙動・master limiter -1.0 dB を変えない）。
3. リスク: gating 端末で FM genre のキャラが変わる = 音楽的判断。FM workstream が所有。
   出した PR は user 試聴（弱端末で詰まり減）で done 判定。

### 監査の verify で REJECT した false positive（参考・修正不要）

- drum-panner（`genre-flavor.js:561` 付近）の非 dispose は **GC churn であって audio コストではない**
  と adversarial verify が判定 → finding から除外。overload クラスでは無視してよい。
```

---

## Historical TASK E (2026-06-13) — ACE-Step Tabasco demo（完了 / Do Not Execute）

2026-07前半にTabasco 7曲のMP3 + MP4生成と参照公開まで完了済み。残る作業はBL-029の
人間試聴 → 良い要素のTone.js翻訳だけで、下の生成promptは再実行しない。

現行machine IDは`worker-gaming`、必要capabilityは`worker.gpu`。GPUの空き、revision固定、
download / executionの明示許可が揃わない時は開始しない。正本は
`docs/ACE-STEP-WORKFLOW.md`と`config/external-dependencies.json`。

**なぜ Codex**: 重い R&D（モデル DL + GPU 推論）。BL-029 / `docs/ACE-STEP-WORKFLOW.md` のレーン。
成果物（wav）は **repo に入れない**（音源を repo に置かない掟）。Codex は wav を生成して報告するだけ。
旋律/アレンジの取り込み（Tone.js への翻訳）は人間 + Claude 親の taste 作業で、Codex はしない。

**Historical prompt（監査資料。コピペ禁止）:**

```
You're on worker-gaming (a GPU machine). The current repo is QuietBriony/Music (music-stack). Your job:
generate singable demo tracks of the Tabasco songs with ACE-Step 1.5, so a human can listen and
translate the arrangement ideas into the Band Room engine later. You ONLY generate + report.

HARD CONSTRAINTS (do not violate):
- Clone ACE-Step and write ALL outputs OUTSIDE this repo. Never put model weights, the ACE-Step
  checkout, or any .wav/.mp3 inside the Music repo. NEVER `git add` audio or weights. Do not commit
  anything to the Music repo. Do not modify any Music repo file (read-only: you only READ lyrics +
  style prompts from it).
- Use the repo-external worker root from `config/external-dependencies.json`, e.g.
  `C:\workspace\music-stack-worker\outputs\ace-step\` for wavs,
  `C:\workspace\music-stack-worker\tools\ACE-Step-1.5\` for code, and
  `C:\workspace\music-stack-worker\models\ace-step\` for weights (adjust path syntax to worker OS).
- This is an offline production/reference tool, not a runtime dependency. Don't wire it into anything.

STEPS:
1. Detect environment: OS, `nvidia-smi` (GPU name + VRAM), python version. Print a one-line summary.
   If no CUDA GPU is found, STOP and report — do not attempt CPU-only (too slow).
2. Install ACE-Step 1.5 OUTSIDE the repo:
     git clone https://github.com/ACE-Step/ACE-Step-1.5.git <worker-root>/tools/ACE-Step-1.5
     git -C <worker-root>/tools/ACE-Step-1.5 checkout --detach dce621408bee8c31b4fcf4811682eb9359e1bc94
   This is release `v0.1.8`; refuse a different HEAD until the dependency manifest is reviewed.
   Install `uv` through an operator-reviewed package/installer path (do not pipe a remote script into
   a shell), then run `uv sync` in that detached checkout.
   If torch resolves to a CPU-only build, reinstall the CUDA build matching the detected CUDA version.
   `cp .env.example .env` if present. Use only `acestep-v15-turbo` at Hugging Face revision
   `571cee88618ae5ef3d3fcdf79c46068ce4e2d727`, stored below the worker model root. Confirm GPU idle
   capacity and explicitly authorize that download; do not rely on an implicit first-run moving revision.
3. Start the REST API non-interactively: `uv run acestep-api` (serves http://localhost:8001).
   Do NOT use the Gradio UI or the interactive `--cli` wizard (you can't drive those headlessly).
   Discover the request schema from http://localhost:8001/docs (OpenAPI) or by reading the API source.
   If the REST API is impractical, fall back to the Python API (import the pipeline, read the repo's
   example scripts) — still fully scripted, no interactive prompts.
4. Read inputs FROM the Music repo (read-only):
   - Lyrics: `docs/tabasco-lyrics-final.md` (7 songs; keep the section tags like [verse]/[chorus]).
   - Per-song style prompts: `docs/SUNO-WORKFLOW.md` section 4 (01 TABASCO … 07 Sister, with bpm +
     genre/voice descriptors). Use each song's prompt as the ACE-Step style/prompt text.
5. VALIDATE FIRST with ONE song — `06 Human Fly` — full pipeline: prompt + lyrics → a real .wav in
   `<worker-root>/outputs/ace-step/06-human-fly.wav`. Confirm the file is non-trivial audio (size > 0, plays). Only
   AFTER that works, generate the remaining 6 under `<worker-root>/outputs/ace-step/NN-<title>.wav`.
   Use a sensible duration per song (their full length ~2.5-5 min, or cap at the model's max).
6. SERVE over LAN so the user can play the wavs from another device (a Surface on the same network):
   find this machine's LAN IPv4 (not 127.0.0.1, not a docker/virtual adapter) and print it; then start
   a static file server for the output dir bound to 0.0.0.0 on port 8009 in the BACKGROUND and keep it
    running, e.g. `python -m http.server 8009 --bind 0.0.0.0 --directory <worker-root>/outputs/ace-step`. Print the
   directory URL `http://<LAN-IP>:8009/` and each file URL `http://<LAN-IP>:8009/NN-<title>.wav`. Note
   if the OS firewall might block inbound 8009 and how to allow it. Report the server PID + stop
   command; do NOT stop it. (Plaintext LAN-only file server — fine for local listening; never expose
   it to the public internet.)
7. REPORT (your final message): OS + GPU + VRAM + chosen model tier; the exact generation call you
   used (so it can be reused); absolute path of the output dir + the LAN URLs from step 6; per-song
   success/fail + file sizes; total wall time; and any schema/API quirks you discovered (so this
   prompt can be refined). Do NOT commit or push anything.

If anything blocks setup (ARM/no-CUDA, uv failure, weight download, schema unknown), STOP and report
the blocker with the exact error rather than guessing.
```

**当時の戻り先（人間）**: `worker-gaming`のrepo外outputを聴く → 良い展開/メロを
Band Room の Tone.js / drum-frame / preset に**翻訳**（blind copy しない）。wav は repo に入れない
（手元 or CDN）。LoRA で album 統一したい場合は ACE-Step Gradio の "LoRA Training" タブ（8 曲 / 3090
で ~1h）を人間が操作。詳細レーン定義は `docs/ACE-STEP-WORKFLOW.md`。
