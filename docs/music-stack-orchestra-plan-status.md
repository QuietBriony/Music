# Music Stack Orchestra — Next 12 PR Plan 実装状況（正本）

> `docs/music-stack-orchestra-development-direction.md` §5 の「Next 12 PR Plan」を
> **リポジトリの現物と突き合わせた結果**。plan から item を取る agent（Claude / Codex）は
> 着手前に必ずここを見ること。12 行中 6 行は既に出荷済みで、再実装は禁止。

- 検証日: 2026-07-10（#367 merge 同日）
- 方法: 各行を該当 repo の実ファイル / git 履歴 / BACKLOG と照合（grep + 実読）

## 状況表

| # | plan 行 | 状況 | 根拠（現物） | 残ギャップ / 掟 |
|---|---|---|---|---|
| 1 | Music: Hazama FM gain staging 修理 | **部分** | BL-022: polyphony cap (v187) + playback latencyHint (v340)。BL-028: 常時 DSP light gate (v359) + 画面内トグル (v360)。band-room pumpGain leak fix (v356) | 弱端末での**試聴確認が未了**（human-gate）。さらなる修理は engine.js 凍結域 = FM/engine workstream 領分 |
| 2 | Music: Bandroom audio-safe boot / reset | **出荷済み** | `band-room.js:57`（`detectBandRoomBootMode` — safe query / standalone 判定）、`band-room.js:3646`（safe boot 時 audio state を読まない）、`band-room.js:8442`（safe-query-reset で stale state 破棄）、`band-room.js:9397-9407`（visibilitychange / pageshow 復帰） | なし（実機での回復動作確認は任意） |
| 3 | Music: genre timbre kits を BPM/Energy で強化 | **部分** | kits runtime は実装済み（engine.js `genreTimbreKitRuntimeState`、packet が消費: `audio/music-packet.js:205`） | 「強化」は未着手。engine.js は凍結 — 着手には user の明示承認が必要 |
| 4 | Music: music-session-packet schema | **出荷済み** | `docs/schema/music-session-packet.schema.json`（+ `music-orchestra-packet.schema.json` / `repo-harvest-sidecar.schema.json`）、`docs/music-orchestra-protocol.md` | なし。再作成禁止 |
| 5 | Music: local packet export | **出荷済み** | `audio/music-packet.js` — `downloadMusicSessionPacket()`（JSON download）+ `syncMusicSessionPacket()`（localStorage `qb:music-stack:latest-packet:v1` + BroadcastChannel `qb:music-stack:v1`） | なし。再作成禁止 |
| 6 | drum-floor: groove packet adapter | **出荷済み** | `drum-floor/app.js:11-14`（packet / orchestra 両チャネルを消費）、`drum-floor/scripts/check-music-sync-safety.mjs`（translation contract を gate 化 — BL-009） | なし |
| 7 | namima: mood packet adapter | **出荷済み** | `namima/sketch.js:19-22`（同チャネル消費）、`namima/scripts/check-mood-profiles.mjs`（family-safe 制約 gate — BL-002） | なし |
| 8 | chill: light surface か archive か決定 | **未決（意図的に human）** | `chill/README.md:18` — 「human が harvest / reactivation / archive を選ぶまで candidate のまま」と明記 | **user の判断待ち**。agent が決めない |
| 9 | Music: recording review scorecard v2 | **未着手** | 単独の scorecard doc は無し（最近傍: `docs/cross-repo-listening-review-round.md`、packet の `routing.openclaw.self_review` 5 軸） | agent-safe な docs 作業として着手可。self_review 軸（density/lowEnd/brightness/restraint/referenceFit）と揃えると機械 self-review と人間採点を突き合わせられる |
| 10 | OpenClaw: mission board docs | **出荷済み** | `openclaw/docs/music-orchestra-mission-board.md`、`openclaw/sessions/examples/music-orchestra-mission-board.example.json`、packet/harvest inspector + tests | なし |
| 11 | drum-floor: mixture_shout demo | **部分** | mixture_shout は groove engine に genre として実装済み（taste 残課題は BL-027） | 「focused demo」としての形は未定義。BL-027（listening-score → suggest-evolution）に乗せるのが正攻法 |
| 12 | namima: ripple ambient runtime pass | **部分（試聴待ち）** | namima#33/#34（潮 v1/v2）merge 済み — BL-026 | **live 試聴判定待ち**（human-gate、BL-026） |

## doc の権威関係（要整理）

#367 より前から、同じ方向を定める authority chain が存在する:

- `docs/music-stack-orchestra-direction.md`（旧 direction — protocol / routing map /
  packet schema / harvest workflow を「Current Authority Docs」として列挙）
- `docs/music-orchestra-protocol.md` / `docs/music-orchestra-routing-map.md` /
  `docs/repo-harvest-orchestra-workflow.md` / `docs/schema/*.json`

#367 の `music-stack-orchestra-development-direction.md` と
`docs/schema/music-stack-orchestra-routing.schema.json` はこれらへの参照が無く、
routing 語彙が `music-orchestra-routing-map.md` / orchestra packet schema と重複している。

**推奨（human 判断待ち）**: どちらかに正本を寄せる。案 A: 新 doc を「方向の再宣言」として
残し、冒頭に旧 authority chain への参照と本 status doc への参照を足す（最小変更・本 PR で
§5 への参照のみ実施）。案 B: 2 つの direction doc を統合する（別 PR・user 承認後）。

## 実際に残っている作業（掟つき）

- **human-gate（agent が done にしない）**: #1 弱端末試聴 / #8 chill の役割決定 /
  #12 namima 潮 試聴（BL-026）/ BL-029 ACE-Step デモ試聴 → Band Room 翻訳
- **agent-safe（着手可）**: #9 scorecard v2（docs）/ doc 権威の統合案 B（user 承認後）
- **要承認（engine 凍結域）**: #1 の追加修理 / #3 kits 強化
