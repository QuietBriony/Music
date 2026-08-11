# Backlog — music-stack

自律開発の作業待ち行列。新しい session はここから次の仕事を取る。
散在していた残課題（`USER-NOTES-MEMO.md` / `CODEX-HANDOFF.md` /
`music-stack-integration-index.md` §6-7）を統合した単一の正本。

## 使い方

- **取る**: `priority` 上位で、この session で完了でき、`human-gate` を踏める item を選ぶ。
- **追記**: 作業中に見つけた新タスクは末尾の優先度節に `BL-xxx` で追加。
- **閉じる**: 完了したら item を `## Done` へ移し、`SESSION-LEDGER.md` に記録。

## 共同開発の claim ルール（Claude / Codex 並走時）

Claude と Codex が同時に回す前提。item の取り合いと shared file 衝突を防ぐ:

1. **claim**: item を取ったら `status: wip — <agent> <date>` 行を item に足し、
   その 1 行だけを即 commit + push（例: `docs(music): claim BL-009`）。
2. 他エージェントは `git pull --ff-only` で claim を見てから別 item を取る。
3. `status` 行が無い item は open。完了したら item を `## Done` へ move。
4. 同じ repo / 同じファイルを 2 エージェントで触らない。repo 単位で割れば
   並列で衝突しない（詳細は `docs/COLLAB-CLAUDE-AND-CODEX.md`）。
5. このファイルと `SESSION-LEDGER.md` は作業前後に `git pull --ff-only`。
   衝突したら両者の意図を残して rebase 解決。

## item スキーマ

```
### BL-00X — タイトル
- priority : P0 | P1 | P2 | icebox
- repo     : Music | chill | drum-floor | namima | openclaw | stack
- scope    : docs | non-engine-code | runtime | engine | cross-repo | verify
- agent    : claude | codex | either | human
- human-gate: yes | no
- status   : open | wip — <agent> <date> | done  （省略時は open）
- source   : 出所
- detail   : 説明（完了条件を含む）
```

---

## P1

### BL-041 — HAZAMA を main Band selector へ昇格する実機判定
- priority : P1
- repo     : Music
- scope    : verify / runtime
- agent    : human
- human-gate: yes
- status   : wip — human gate AMBER 2026-08-11（Surface pass、AI音質・実mobile待ち）
- source   : 2026-08-01 Band Room playability / UI audit
- detail   : 現行は `?band=hazama` で01原音が既定。Listenの01/02 × 原音/AI 4ケースを
  desktop + real mobileで確認し、START一発、60–90秒の単調/ピーポー/途切れ、
  再生中の端末画面ロック→10秒→解除後の継続/復帰、HAZAMA→Tabasco切替時の
  原音mode/palette復帰を別々に判定する。2026-08-11 Surface / interface speakerでは
  START、ピーポーなし、途切れなし、画面復帰、Tabasco復帰は概ね○。ただし01/02 AIは
  「電子MIDI・短音が詰まり音楽になっていない」で音質×、02 AIの01 frames共有表示も
  見落とされた。iPhone Safari / PWA等の実mobileは未確認。v400で暫定表示とKARAOKE導線、
  02歌詞境界を磨くが、AIのauthored rests再試聴と実mobile合格後のみ`ui_hidden`を外す。
  自律ランで `ui_hidden` を外さない。

### BL-035 — Band Room asset lane の契約 / provenance を一本化
- priority : P1
- repo     : Music
- scope    : docs / verify
- agent    : human（契約決定）+ codex | claude（反映）
- human-gate: yes
- source   : 2026-08-01 repo-wide CPU-only 5.6-sol audit
- detail   : AGENTS Rule 3 の「音源 / sample は追加しない」と、`presets/bands.json`・
  `BAND-ROOM-ADD-BAND.md` の stem/sample 追加手順が矛盾。現物は承認済み tracked audio
  790 file / 約216 MiB。既存 Band Room asset を grandfather する範囲と、ACE-Step / Suno
  生成物・model weight を常に repo 外とする境界を owner が確定し、provenance manifest、
  `.gitignore`、増分 guard に落とす。既存 asset の削除 / 再圧縮は本 item に含めない。

### BL-003 — 実車 / Bluetooth で hidden audio bridge を実機検証
- priority : P1
- repo     : Music
- scope    : verify
- agent    : human
- human-gate: yes
- source   : docs/USER-NOTES-MEMO.md（Band Room 車載音量）
- detail   : v145-v160 の hidden audio bridge / route badge / rearm は実装済み。
  残るは実車・BT 環境で車側 volume / track button にメディア音声として認識されるかの
  実機 validation。自律ランでは検証できない（人間が実機で確認）。

### BL-022 — Hazama FM ブラウザ再生の音詰まり（同時起動音での負荷スパイク）
- priority : P1
- repo     : Music
- scope    : engine
- agent    : codex | claude
- human-gate: yes（修正 PR 後に試聴で体感確認）
- status   : wip — fix 1 (v187) + fix 2 (v340) 出荷済み。試聴確認待ち
- source   : user 観察（2026-05-18・Hazama FM ブラウザ再生が「重い・たまに詰まる」）
- detail   : **進捗（v340）**: 候補対策 (2) を実施 — fm.html 限定で AudioContext を
  放送モード生成（`latencyHint: "playback"` + `lookAhead 0.3`、Tone 直後の inline
  `Tone.setContext`）。engine.js 無改変・index.html (rig) は interactive のまま。
  user が Pages で同時起動音シーンを試聴し詰まり減を確認できれば done。
  **進捗（v187）**: 候補対策 (1) を実施 — pad `maxPolyphony` 64→24、
  `pianoMemory` 48→24 に capping（engine.js fm-94）。user が Pages で同時起動音
  シーンを試聴し、詰まり減を確認できれば done。まだ残る・voice steal が可聴なら
  cap 再調整か候補 (2) `Tone.context.lookAhead` 拡大 / `latencyHint: "playback"`。
  以下、当初調査メモ:
  複数音が同時起動するタイミングで音が詰まる体感。engine.js 調査では
  pad `PolySynth` が `maxPolyphony: 64`、`pianoMemory` が `48` と過大で、
  `randomHazeChord()` の `1n`/`2n` 長尺コードを 20+ 経路から鳴らすため、トリガが
  重なると発音数が積み上がり CPU スパイクになりうる。候補対策: (1) `maxPolyphony`
  を妥当値（pad / pianoMemory とも ~24 目安）へ下げ発音数の天井を作る（超過時は
  最古 voice steal・持続 pad ではほぼ不可聴）、(2) AudioContext `latencyHint:
  "playback"`（ラジオ用途で低レイテンシ不要・バッファ拡大でグリッチ耐性向上）。
  完了条件: 小 PR で出し、user が Pages の同時起動音シーンを試聴して詰まり減を確認。
  voice steal が可聴なら cap 値を上げ再調整。

### BL-028 — Hazama FM `addAcousticFunField` の常時 DSP 負荷 + light ゲート不在（監査由来・FM 領分）
- priority : P1
- repo     : Music
- scope    : engine（FM 領分: audio/genre-flavor.js — FM workstream 所有）
- agent    : codex | claude（FM workstream）
- human-gate: yes（出音キャラが変わるので試聴判定）
- status   : wip — v359 で light ゲート実装・merge 済（live preview 実測: AutoPanner 4→0 /
  Reverb 2→0 @ ?aiLight=1、guardrail HEAVY 行 22→18、4-lens adversarial review clean）。
  v360 で画面内トグル（⚙auto/🪶light/💎full・localStorage 永続・rebuild で即反映）も追加。弱端末試聴待ち
- source   : 2026-06-13 audio-overload 監査（Music repo 全体・1 クラス限定）。
  band-room 側の修正可能分は #353/v354・#352/v353・#355/v356（pumpGain leak）で決着済。
  本 item は監査の FM 領分 hand-off。詳細は `docs/CODEX-HANDOFF.md` の同日節を参照。
- detail   : `addAcousticFunField`（genre-flavor.js:1308）が `applyProductionGovernor`（:1322）
  経由で**全 genre build 経路**（295/298/320/1798/2052/2080/2580/2592/2918/2942/3270/3278）から
  無条件に呼ばれ、active genre ごとに常時稼働の DSP を 3 サブフィールド分積む:
  - addMonoLowAnchor（:1091）: oversample "2x" Distortion（sat）+ FMSynth
  - addOrbitalAirField（:1143）: 常時 Tone.Reverb + PingPongDelay + AutoPanner×2 `.start()` + FM/Metal/Noise
  - addNullZoneRefractions（:1219）: 常時 Tone.Reverb + oversample "2x" Distortion（fold）+ AutoPanner×2 `.start()` + FMSynth×2 + Noise
  正味 **+2 常時 Reverb / +4 起動済 AutoPanner（連続 LFO）/ +2 oversample "2x" Distortion**。
  core-overload 原則上、これらは master 接続中は trigger 有無に関わらず全 quantum を処理する。
  **leak ではない**（各 node は layer.synths に push 済 → genre 切替で teardownActive が dispose）。
  あくまで active 中の steady-state CPU コスト。加えて genre-flavor.js には device-tier /
  light-runtime ゲート概念が皆無（`light|lowPower|deviceTier|isMobile` grep clean）— gating は
  movement/会話 role による trigger 確率調整のみで、弱端末でも full stack を構築・稼働する。
  band-room の master が v353 で獲得した light ゲートのような逃げ道が FM 側に無い。
  推奨（FM workstream・未実行）: light/low-power ゲートで addAcousticFunField を skip か軽量変種に
  （2 Reverb → 共有 send 1 本、oversample → 無し、AutoPanner → 静的 Panner）。高価値は 2 常時
  Reverb と oversampling。light OFF 時は出音キャラ不変を厳守（原音/デフォルト挙動は変えない）。
  完了条件: FM workstream が light ゲートを実装 → user 試聴で弱端末の詰まり減を確認。

### BL-030 — #367「Next 12 PR Plan」と現物の突き合わせ + doc 権威の整理
- priority : P1
- repo     : stack
- scope    : docs
- agent    : claude
- human-gate: yes（doc 統合の方向と、残ギャップの owner 決定は user 判断）
- status   : wip — advisor 2026-07-10。status 正本
  `docs/music-stack-orchestra-plan-status.md` を **PR #371 で merge 済み**（main 7677d63）
  + 新 direction doc §5 に参照追記。残: 旧 `music-stack-orchestra-direction.md` 系
  authority chain との統合方針（案 A/B）を user が選ぶ
- source   : 2026-07-10 #367 merge。12 行中 6 行（#2/#4/#5/#6/#7/#10）が既出荷、
  routing schema / direction doc が旧 authority docs と重複と判明
- detail   : Claude / Codex fleet が #367 の plan を素直に拾うと出荷済みシステムを
  再実装するリスクがあるため、各行を実ファイル / git 履歴と照合した status 正本を置いた。
  完了条件: user が doc 統合方針を決定 → 反映 PR → 本 item close。
  実残作業は status doc 末尾の「実際に残っている作業」節が単一の正。

### BL-031 — Music recording review scorecard v2（plan #9・machine↔human 橋）
- priority : P1
- repo     : Music
- scope    : docs
- agent    : claude（枠を作る）+ human（採点を埋める）
- human-gate: yes（採点 1–5 の記入と next_pr_candidate は人間のみ。agent は埋めない）
- status   : wip — advisor 2026-07-12。`docs/recording-review-scorecard.md` 作成済み
  （PR #372 / 40a422b で merge 済み）。scorecard の枠のみ。実採点・そこから派生する
  engine tuning は別
- source   : 2026-07-10 #367 plan #9 / status doc の agent-safe 名指し
- detail   : Music は姉妹 repo 用 scorecard（namima/chill/drum-floor）は持つが自分の
  conductor 面には無かった。machine `self_review` 5 軸（density/lowEnd/brightness=risk・
  restraint/referenceFit=score、極性非対称）を `machine_health`（1=良）へ正規化して
  human 1–5 と同極性で突き合わせ、gap から「機械が過敏／機械が見落とし」を判定 →
  次 tuning PR の根拠にする。出力は metadata-only の `review-result`。
  完了条件: user が実際に 1 パス採点して枠が回ることを確認 → close。scorecard 由来の
  `self_review` 重み/閾値 tuning は engine 凍結域の別 human-gated PR（BL-024 harness で検証）。

## P2

### BL-004 — Hazama FM 40Hz focus mode の depth A/B
- priority : P2
- repo     : Music
- scope    : runtime
- agent    : claude（実装）+ human（試聴判断）
- human-gate: yes
- status   : wip — A/B 機構を出荷済み（PR #140 / v188, 2026-05-18）。試聴判断待ち
- source   : docs/USER-NOTES-MEMO.md
- detail   : 40Hz focus mode（default OFF / 8% AM）が耳で違和感を出すか A/B。
  強く感じる場合は depth を 8%→5% に落とす。実装は自律ラン可、最終判断は試聴。
  **進捗（v188）**: A/B 機構を実装 — `fm.html?focusDepth=5`（5%）と `fm.html`
  （8%）を聴き比べ可能。focus status に現 depth を併記。`MusicFocusModulation
  .setDepth()` でも切替可。残るは試聴して 8%/5% を決め、default を確定すること。

### BL-006 — cross-repo listening review round
- priority : P2
- repo     : stack
- scope    : verify
- agent    : human
- human-gate: yes
- source   : docs/cross-repo-listening-review-round.md
- detail   : namima / chill / drum-floor を聴き比べ、次の tuning PR を 1 本だけ選ぶ
  人間レビュー。multi-repo 同時 tuning はしない。

### BL-026 — chill / namima musicality 変更の live 試聴判定
- priority : P2
- repo     : stack
- scope    : verify
- agent    : human
- human-gate: yes
- status   : wip — user 指示「全部マージして」で全 PR merge 済み (2026-06-13)。live 試聴待ち
- source   : 2026-06-13 横断磨き session（Music v326/v333 の教訓を sibling へ翻訳）
- detail   : merge 済みの音楽性変更を live (Pages) で聴いて、戻し / knob 調整を判定する。
  - chill#37 (merged) — harmonic spine: 長さ4 notes プールを barIndex%4 ロック
    + depth/bloom echo PingPong。注意点: morning-light のみ slot2/3 が転回形固定
    （PR コメント参照、1 行追修正可）。
  - chill#38 (merged) — 「chillとまる」修正: lifecycle 停止が Transport 駆動 loop に
    復帰役を任せていて永久無音だった → visible/pageshow/focus で自動復帰。
    手動 STOP は尊重。
  - namima#33 (merged) — 潮 v1: 2 集合 + dyad wrap 解消 + tail PingPong。
  - namima#34 (merged) — 潮 v2 (「あまり変化ない」への増幅): home/deep/bright
    3 区間 192s 周期 + 音場が潮に従う (filter/reverb/tail 係数) + 変わり目の
    告知和音。ノブ: TIDE_PERIOD_MS / 区間境界 / 係数 / 告知 vel。
  - 判定観点: chill が裏→表で鳴り続けるか / namima で 3-4 分内に潮の変化に
    気づけるか / 告知和音がうるさくないか。

### BL-023 — ARM 版 `chouta-surface` の UR44 ドライバ安定化を調査
- priority : P2
- repo     : (stack / 非コード)
- scope    : verify (ハードウェア / ドライバ調査)
- agent    : claude (調査) + human (実機テスト)
- human-gate: yes
- status   : wip — Web research 完了 (`docs/arm-ur44-driver-investigation.md`、
  2026-05-25 chouta-surface)。実機テスト step 1-2 待ち、step 3 は Microsoft 新
  in-box USB Audio Class 2 driver の 2026 中後半 Canary 配布待ち
- source   : studio-surface セットアップ session (2026-05-25)
- detail   : chouta-surface (ARM 版 Surface) では UR44 のドライバ / コネクタ
  挙動が不安定 → 音作り iteration は intel 版 `studio-surface` に集約する
  運用に。将来的に Claude で ARM 版 Windows + UR44 の driver 構成 (Steinberg
  公式 ARM ドライバの有無、汎用 USB Audio Class 2 fallback、ASIO4ALL / Generic
  USB Audio Class driver の挙動差、Windows on ARM の USB スタック制約等) を
  調査し、chouta-surface でも UR44 接続が再現できるか確認。
  実機テストは chouta-surface で行う必要があるため human-gate。
  ※ 急がない (intel 版で運用が回るため)。chouta-surface での試聴ニーズが
  発生したタイミングで着手。
  **進捗 (2026-05-25)**: `docs/arm-ur44-driver-investigation.md` に 2026-05 時点
  のドライバエコシステム整理 (Yamaha Steinberg USB V2.1.9 / Microsoft 新 in-box
  USB Audio Class 2 driver / ASIO4ALL) + 推奨試行順序 (step 1-4) + human-gate
  test checklist を完備。要点: UR44 公式 ARM64 native 見込み薄 (IXO series 限定)、
  Microsoft 新 driver (2026 中後半 Canary preview) が plug-and-play で動く path。
  chouta-surface を直接 Canary 化するのはメイン開発機リスクのため非推奨。

### BL-024 — Hazama FM measurement harness Phase 2 + measured tuning
- priority : P2
- repo     : Music
- scope    : non-engine-code (Phase 2) / runtime (tuning, 別 PR)
- agent    : claude (Phase 2 + tuning 実装) + human (audio capture + 試聴判断)
- human-gate: yes
- status   : wip — Phase 1 + 1.5 + 2 **end-to-end verified** (2026-05-29、preview MCP で
  fm.html lofi を無人 capture → 解析、engine が design 通り再生と確認)。残るは (b) measured
  tuning（taste 方向 user 指定 + 試聴 human-gate）と、任意で他 pill の capture 横展開
- source   : 2026-05-29 measurement harness session
- detail   : harness Phase 1/1.5 (静的 design 解析、6/7 pill, `scripts/hazama-fm-measure.mjs`)
  + Phase 2 analyzer (`scripts/hazama-fm-compare-capture.py`、librosa で録音を design-spec
  と diff) は出荷済。残り 2 段:
  **(a) Phase 2 — live capture compare**: ✅ **end-to-end verified (2026-05-29)**。
  analyzer (`scripts/hazama-fm-compare-capture.py`) + autonomous capture
  (preview MCP で fm.html 再生 → in-page webm→WAV decode → POST receiver
  `scripts/hazama-fm-capture-receiver.py` で disk、ffmpeg 不要) が無人で成立。
  初回 lofi: bpm 83 vs design 82.4、tempo_stability 1.8% (governor 稼働)、
  snare-behind-kick pocket 保持 → engine は design 通り再生、silent override 無し
  (v260-class 不在)。手順は `docs/HAZAMA-FM-MEASUREMENT.md` §Phase 2。BL-022
  polyphony も「同時起動音」録音で RMS spike / dynamic range を測定できる
  (voice-count は in-page telemetry tap 追加が必要)。他 pill (funk/jazz/techno)
  の capture 横展開は任意。
  **方法論的境界 (2026-06-01 検証)**: GENRE pill は generative brain への bias で
  `EngineParams.mode` を hard-set しない (funk capture 試行で pill=funk pressed でも
  mode=lofi のまま near-silent)。→ Phase 2 capture は engine の live blend を測るので
  あって純 pill isolation ではない。lofi capture が成功したのは engine が既に lofi を
  render していたため。録音前に mode===pill + frameId set + audible RMS の engagement
  check が必須 (`docs/HAZAMA-FM-MEASUREMENT.md` §Capture caveat)。Phase 1 が per-pill
  isolated truth、Phase 2 は live-blend reality check という役割分担。
  **(b) measured tuning**: codex が lofi/funk/techno を tune 済 → harness 再測定で
  全 drum pill **drift 0** (target 内) を確認 (2026-06-01)。残る tuning は taste 判断。
  閉じる場合は drum-frames-*.json / genre-flavor.js の PR + 試聴 human-gate
  (studio-surface or user)。focus-listening として現設計が正解の可能性もあるので、
  さらなる tuning 方向は user 指定待ち。
  **訂正 (2026-06-01 fable review)**: 上記「drift 0」のうち bpm/swing 軸は
  metadata field (frame.bpm=表示のみ / frame.swing=dead) を測っていた。consumed
  authorities (fm.js GENRE_PROFILES bpm + engine FM_MODE_SWING + event microMs)
  ベースに harness を再構築した結果、lofi/jazz の **実効 swing (off-8th hat drag)
  が reference 換算の ~1/5** という新 finding。詳細 BL-025 と
  `docs/HAZAMA-FM-MEASUREMENT.md` §Field consumption map。
  完了条件: Phase 2 capture script が `docs/hazama-fm-design-spec.json` と実出力を
  diff 出力 + stack-check 0 BAD。tuning は方向確定 → PR → 試聴確認ごとに 1 件ずつ。

### BL-027 — drum-floor groove の taste チューニング (監査由来・evolution パイプライン)
- priority : P2
- repo     : drum-floor
- scope    : runtime (pocket_director / scoring 重み) — evolution パイプライン経由
- agent    : human (listening-score) → claude/codex (suggest-evolution)
- human-gate: yes
- source   : 2026-06-13 drum-floor 多エージェント監査 (38 agents)。構造 fix は #54 で出荷済、
  残りは taste なので正攻法 (listening-score → suggest-evolution → promotion) に乗せる
- detail   : 監査が出した taste 候補 (いずれも pocket_director / scoring の重み調整で、
  「良くなった」は人間の耳でしか判定できない):
  - fillSlots の位置ボーナス (+0.4 末尾 / +0.22 lateTurn / +0.12 midTurn) が rng(0-1) に
    埋もれ、フィルがフレーズ末に寄り切らない。#54 で phrase-stable にはしたが、末尾寄せ
    にするには位置重みを上げる or rng 振幅を下げる (taste)。
  - hat velocity がゼロ平均ノイズ (rng-0.5)*0.1 のみ → 16th 固定アクセント輪郭にすると
    グルーヴが出る (groove-engine.js hat 層)。
  - breakbeat step-6 の "break ghost response" が part:snare で常時発火 → 真のゴースト
    (ghostScore ゲート + ゴースト voice) に re-voice。
  - nerdy_jazzy_hiphop の soft-displacement kick が microMs +5 固定 → director の
    kick_push_ms に追従させる。
  完了条件: user が listening-score を付け → `suggest-evolution` で pocket_director
  delta を生成 → PR → 試聴 → promotion。multi-repo 同時 tuning はしない (BL-006 方針)。

### BL-029 — ACE-Step で Tabasco 歌入りデモ → Band Room アレンジの指針
- priority : P2
- repo     : Music（制作・参照レーン。runtime には組み込まない）
- scope    : verify / 制作（オフライン）
- agent    : human（CUDA GPU / Apple Silicon / cloud GPU で生成 → 耳で判断 → アイデアを翻訳）
- human-gate: yes
- source   : 2026-06-13 user「ace step 1.5 使える？」→ `docs/ACE-STEP-WORKFLOW.md` でレーン定義
- detail   : ACE-Step 1.5（OSS・LoRA・cover/repaint）で `tabasco-lyrics-final.md` の歌入りフルデモを
  生成し、展開/メロのアイデアを Band Room の Tone.js に**翻訳**（blind copy 禁止）。掟: 出力 wav は
  repo に入れない・実行時依存にしない。副産物として測定ループのジャンル参照ターゲットにも使える（BL-024 連携）。
  **⚠ chouta-surface（ARM64/Snapdragon・CUDA なし）ではローカル生成不可**（`docs/ACE-STEP-WORKFLOW.md §4.5`）。
  ACE-Step を使うなら cloud/レンタル GPU か別マシン。chouta-surface だけで歌入りデモを作るなら
  **Suno（ブラウザ）の方が現実的**（→ `docs/SUNO-WORKFLOW.md`、BL-029 は ACE-Step ルート専用）。
  **実行プロンプト**: GPU 機 workerPC（Codex 専用）に貼る → `docs/CODEX-HANDOFF.md` TASK E。
  **進捗（2026-07 前半）**: workerPC で Tabasco 7 曲の歌入りデモ（MP3）+ beat-synced
  ビジュアライザ（MP4）を生成し、使い捨て公開 repo に配置済み —
  **live: https://quietbriony.github.io/tabasco-acestep-demos/** （repo:
  QuietBriony/tabasco-acestep-demos。参照専用・製品 repo には持ち込まない）。
  残るは user の試聴 → 良い要素の Tone.js 翻訳（human-gate）。
  完了条件: user が（GPU 環境を用意して）1 曲デモ → Band Room で組み立て確認、or Suno ルートに倒す判断。

## Icebox

### BL-008 — engine.js の部分モジュール化
- priority : icebox
- repo     : Music
- scope    : engine
- agent    : codex
- human-gate: yes
- source   : code health 棚卸し（engine.js 約14.8k行のモノリス）
- detail   : `AGENTS.md` hard rule で engine.js は原則凍結。実施するなら明確な境界で
  PR を立て、user 別承認必須。**進捗（2026-05-17）**: satellite-script パターン
  （IIFE + `window.<Name>` 公開、ビルドステップ無し構成向け）を確立。抽出済み:
  cross-repo routing 推薦 → `audio/music-stack-routing.js`（約280行）、
  40Hz focus modulation → `audio/music-focus-modulation.js`（v182・約175行）、
  local recorder → `audio/music-recorder.js`（v183・約180行）、
  packet builders → `audio/music-packet.js`（v184・約700行・metadata-only）、
  Hazama runtime feedback → `audio/music-hazama-feedback.js`（v185・約180行・telemetry）。
  いずれも挙動保存・stack-check 0 BAD で squash-merge 済み
  （PR #131 / #134 / #135 / #136 / #137）。engine.js は 14.8k → 13.5k 行に縮小。
  **現況**: 疎結合な satellite cluster は概ね抽出完了。残る大物候補 mic-follow は
  `MicFollowState` が engine.js 全体で 151 箇所参照・audio loop に毎 tick 織り込み、
  sampler layers は audio trigger 経路と密結合のため、satellite パターンでは
  切り出せない（抽出するなら別アプローチ＋実機試聴 human-gate が必要）。
  engine.js は依然モノリスだが、低リスクな自律抽出余地はここで一区切り。
  **教訓**: v183 で `setRecorderStatus`（共有 status writer）を recorder IIFE に
  閉じ込めてしまい mic/packet が ReferenceError（v184 検証で発覚・同 PR で修正）。
  抽出時は「cluster 外から呼ばれる helper はないか」を grep で必ず確認すること。

---

## Done

### BL-044 — autonomy queue semantic gate ✅ 2026-08-02
- `scripts/check-autonomy-queue.mjs` を追加し、fence / HTML comment / blockquote / codeを除く
  live Markdownからactive / legacy Doneを分離。BL ID一意性、必須field / canonical順・値、
  human-gate / status / protected engine claim、Done heading / outcomeをfail-closedにした。
- 最新ledgerの必須field・stack結果・`backlog` / `next`参照と、全entryの日付順を検証。
  5正例 + 113 memory-only負fixtureで、GPU / audio / model / networkを実行せず固定した。

### BL-043 — Music host DOM seam manifest / gate ✅ 2026-08-02
- `engine.js` 64 ID、`fm.js` 56 ID、audio consumer 2種のDOM lookupをread-only抽出し、
  Core required 60 / optional 5、FM required 76 / optional 31のhost別manifestへ固定した。
- HTML tree / browser-state guardでID exact-case・tag / range / select / ARIA / hidden shim、
  canonical classic-defer consumer、raw-text / plaintext / frameset / foreign / table / select、
  CSP / SRI / legacy language / URL control文字によるconsumer停止をnetworkなしで検証する。
- source token gateはper-ID multisetだけでなくlive function・parameter・owner binding・loop /
  delegated click・genre profile 9-fader domainまで結線。shadow / dead compensation、escaped
  identifier、computed global、string timer、eval / Function / constructor経路をfail-closedにした。
- 101件のin-memory負fixtureをlabel hash / exact count付きで自己検証。stack-check 30 PASS /
  0 FAIL / 0 SKIP（0 BAD）。`engine.js`、HTML / SW / runtime、audio / GPU / modelは不変。

### BL-042 — Band Room auxiliary authority drift gate ✅ 2026-08-02
- test-only hookをメモリ内で注入し、実`loadBandsRegistry()`をfake 503へ通してhardcoded
  Tabasco fallbackを取得。`bands.json`正本と3 path、7曲のID・順序・track・titleを完全一致
  検証し、実timed loader / song lookupもfake JSONで実行した。tracked runtimeは無変更。
- timed lyricsをHey / I got a feeling / Under the Moon / Human Fly / Sisterのexact 5曲へ限定。
  各行をfinite number・非負・strict昇順・registry `duration_s`以内・空でない本文へ固定し、
  TABASCO / Electric Sheepがfinal-sheet fallbackになることも検証した。
- band key / song identity / order / track / title / 3 path、missing / extra ID、string / NaN /
  Infinity / 負値 / 逆順 / 同時刻 / 曲尺超過 / 空本文を個別に壊すin-memory負試験がreject。
- stack-check 29 PASS / 0 FAIL / 0 SKIP（0 BAD）。`band-room.js`、registry、timed JSON、
  audio / GPU / model / network、`br-230` / `hazama-fm-v395`は不変。

### BL-037 — Music satellite / engine seam executable contract harness ✅ 2026-08-02
- 5 satelliteをengine globalsなしの同一VMへ先行loadし、test-only fixtureで47個の遅延
  bindingを後から注入。routing / focus / recorder / packet / Hazama feedbackの5 API群を
  fakeだけで実呼出しし、missing seam、browser fallback、timer / channel cleanupも検証した。
- `index.html` / `fm.html`のhost別Tone契約、classic defer順、重複・欠落・async / module化、
  SW precache一意収録 / marker parityを固定。comment / script body内の偽tag・URL、
  dependency / consumer member driftを意図的に作る負テストがrejectすることも確認した。
- `engine.js`はprovider / consumer markerをtextで読むだけで実行・変更せず、HTML / SW /
  satellite runtimeも不変。Tone / MediaRecorder / DOM / storage / BroadcastChannel / timerは
  同期fakeで、network、実audio、GPU / modelを使わない。`fm-118` / `hazama-fm-v395`据置。
- stack-check 29 PASS / 0 FAIL / 0 SKIP（0 BAD）。実browser挙動、音質、試聴は証明対象外。

### BL-036 — Tabasco songs catalog v2 + drift validator ✅ 2026-08-02
- `presets/tabasco-songs.json`をmetadata-only / runtime非消費の派生inventory v2へ置換。
  7曲のID・順序・title・durationを`bands.json`、BPM / key / 構成を各drum-frame、
  歌詞をfinal文書へ同期し、個人PC絶対path、`TBD` / `todo`、完了済みnext stepを除去した。
- BPM / keyは全曲`human_unverified`を維持し、asset provenanceはBL-035のowner判断に残した。
  Human Fly frameの表示名driftだけをruntime registryへ正規化した。
- runtimeが読まない一覧をSW precacheから外し、旧v1 cache退役のため`hazama-fm-v395`へ更新。
  `check-tabasco-songs-catalog.mjs`が7曲coverage、frame / lyrics / path / status / non-precache
  deliveryをnetworkなしで検証。意図的BPM driftの負試験もFAILを確認して復元した。
- stack-check 28 PASS / 0 FAIL / 0 SKIP。`engine.js`、音源、音色・mix・level、model weight、
  GPU処理、audio renderは不変。PWA更新後のoffline実機確認はbrowser checklistに残す。

### BL-034 — autonomy control-plane の factual catch-up + currency gate ✅ 2026-08-02
- `CODEX-HANDOFF.md`を現行のBACKLOG / LEDGER入口、resource / machine boundary、
  Listen → HAZAMA → Lyric Labへ同期。v276候補、BL-028未着手、TASK E再生成promptを
  実装状況付きhistorical archiveへ封じた。
- `HAZAMA-FM-ARCHITECTURE.md`を5 active repo role、5 public surface、3 manifest、
  same-origin preset、現行audio constants / UI safety / PWA routing / HAZAMA synth laneへ更新。
- `config/autonomy-doc-currency.json`で3文書と事実sourceを
  `last_verified_commit: 04bceffbe7560a04386f32048d221dfa8b51346c`へ固定。
  `check-autonomy-doc-currency.mjs`がancestor、marker、runtime tuple、committed / dirty source
  よりdocが古い状態をnetworkなしで拒否する。
- 監査でv393のTonejs/audio固定URLがSW sample cache分類から漏れる回帰を発見しv394で修正。
  catalog 21 rootを実classifierへ通すgateを追加。stack-check 27 PASS / 0 FAIL / 0 SKIP。
  `engine.js`、sample content、音色・mix・level、model weight、GPU / audio処理は不変。

### BL-033 — 外部依存 / モデル lock + mutable URL / license gate ✅ 2026-08-02
- browser CDN、sample source、worker package、repo-external modelを24件の
  `config/external-dependencies.json` に統合。version / commit・model revision / integrity /
  license / size上限 / 保存先 / 実行machine / fallbackを単一の正本にした。
- catalog 21定義をdependency IDへ接続し、GitHub由来sample URLを同一contentのcommit SHAへ
  固定。mutable URL 0、license statusはverified 18 / pending 5 / N/A 1。根拠がないDirtと
  drum familyは推測せずpending、CasioはCC-BY-NC-SA-4.0へ訂正した。
- ACE-Step / Demucs / Whisperの3モデルはrepo-external・明示download・`worker.gpu`限定。
  download / import / executionは行わず、tracked weight 0をvalidatorでfail-closed検証する。
- `check-external-dependencies.mjs`と`hazama-fm-v393`を追加。stack-check 26 PASS / 0 FAIL /
  0 SKIP。`engine.js`、音色・mix・level、意図するsample content、音源/model weightは不変。
  実CDN取得・実音・GPU実行はhuman gateのまま。

### BL-040 — README / Band Room manual を現行の遊び方へ同期 ✅ 2026-08-02
- READMEに公開Listen / HAZAMA direct / Band Room / Lyric Lab / FM / Core Rigを集約。
  ManualをHAZAMA → START → fail-closed復帰 → Lyric Labの詳細正本にし、Usageは
  用途別レシピと正本参照へ整理した。
- v168-eraのcurrent表現、常にTabasco復元、START連打、Wi-Fi必須等の古い案内を、
  synth-only自動選択、band/song/mode busy、保存visible band/deep-link優先、
  cache-awareの現行挙動へ更新。`check-band-room-docs.mjs`で回帰検証する。
- precache済みdocsを既存PWAへ届けるため`hazama-fm-v392`。Band Room runtime
  (`br-230` / `br-88`)、`engine.js`、音色・mix・level、音源、model / GPU処理は不変。
  stack-check 25 PASS / 0 FAIL / 0 SKIP。実音・mobile・selector昇格はBL-041、
  車載/BluetoothはBL-003のhuman gateに残す。

### BL-039 — Listen hub を HAZAMA / Lyric Lab 現行導線へ更新 ✅ 2026-08-02
- `listen.html` の最初の一手をHAZAMAへ更新し、通常 / `?aiLight=1` の60–90秒quick pass、
  約6分arc、Lyric Lab制作handoffを一画面に統合。v299 Funk / v301 Human Flyは
  historical evidenceとして保持した。
- v388 / v390の現在QAとBL-041の人間試聴境界をlistening backlog、LS-01 / LS-03、
  runtime checklistへ同期。`check-listen-hub.mjs`でroute、local target、静的a11y、
  current / historical境界を回帰検証する。
- `hazama-fm-v391`。Band Room runtime (`br-230` / `br-88`)、`engine.js`、音色・mix・level、
  音源、model / GPU処理は不変。実音・mobile・selector昇格はBL-041に残す。

### BL-038 — Band Room synth-only playability contract + fail-closed START ✅ 2026-08-01
- HAZAMA deep-linkを自動 `AI 再現` にし、非対応の原音modeをdisable。HAZAMAが強制した
  synthだけをTabasco復帰時にstemsへ戻し、利用者がTabascoで選んだsynthは維持する。
- Tone/AudioContext/assetsをfail-closed化し、START中のband/song/mode snapshotとbusy reasonを
  固定。band load rollback、再START失敗時MediaSession、REC無音開始、bridge pending/late resolveを
  CPU-only契約と回帰テストで保護。keyboard shortcut / Help focus / range・mode focusも改善。
- `engine.js` / 音色・mix・level / 音源 / model / GPU処理は不変。stack-check 23 PASS / 0 FAIL / 0 SKIP。

### BL-032 — Lyric Lab API privacy boundary + fail-closed integrity gates ✅ 2026-08-01
- PR #392。Service Worker から `/api/` を完全 bypassし、cache cleanup を
  Music-owned `hazama-fm-*` に限定。Lyric API は fail-closed auth、実body / draft size、
  malformed input、async D1 failure を安全な応答へ統一した。
- `check-cloudflare-pwa-contract.mjs` を追加し、`stack-check` の SKIP fail-closed化と
  `check-js` 自動発見も実施。23 PASS / 0 FAIL / 0 SKIP。engine / 音 / GPU変更なし。

### BL-025 — drum-frames の bpm/swing フィールド: metadata 宣言で決着 ✅ 2026-06-13
- 方針: option (b) を採用。`frame.bpm` (表示のみ) / `frame.swing` (dead field) を
  wire せず、`presets/SCHEMA.md` §2 に「annotation metadata only / playback は
  fm.js GENRE_PROFILES + engine FM_MODE_SWING + event microMs が駆動」と公式宣言。
  wire (option a) は fm.js と二重 tempo 権威になり fm-67 の三重 stacking 再来リスク
  のため非採用。harness は既に consumed-authorities ベース (2026-06-01)。docs-only。

### BL-019 — archive repo harvest 素材の翻訳取り込み ✅ 2026-05-25
- repo: namima / Music / drum-floor / scope: cross-repo docs/reference
- namima-lab → namima: organic-pluck recipe を namima docs へ翻訳（namima PR #32）。
- test → Music: style archetype 4 点 (Ambient/Lo-Fi/Goa/HardTechno) を
  Music の reference-gradient 語彙へ翻訳（Music PR #249）。
  `references/style-archetype-from-test.json` と
  `docs/test-style-archetype-translation.md` を追加し、runtime / UI / samples は不変。
- test → drum-floor: 16-step probability vector の lerp 補間を
  deterministic groove grammar reference として翻訳（drum-floor PR #52）。
  `docs/probability-interpolation-from-test.md` を追加し、raw unseeded randomness は
  runtime 採用しない境界を明記。
- 全体方針: blind copy せず、1 PR = 1 idea、docs-only / reference-only / human-gated。
  将来 runtime 化する場合は別 PR と人間 review が必要。
- verification: Music root `node scripts/stack-check.mjs` PASS 15 / FAIL 0 / SKIP 0。

### BL-012 — chill の harvest reference を runtime recipe へ昇格 ✅ 2026-05-18
- repo: chill / scope: runtime
- `midnight-whisper` / `morning-light` を runtime recipe へ昇格（chill PR #35）。
  `CHILL_RECIPES` 入り・`index.html` / `session.html` セレクタ 6 件・
  `SESSION_BASS_ROUTES`（`morning-light` は A-D-G-E 専用ルート、フォールバックの
  和声ズレを解消）・export pipeline（旧 `SUPPLEMENTAL_RECIPES` 撤去）・README 整備。
  挙動保存・chill checks PASS・実機試聴で 6 recipe 選択と bass route を確認。

### BL-017 — 休眠 engine.js サブシステムを reactivate か削除か判定 ✅ 2026-05-17
- repo: Music / scope: engine
- dormant-asset 監査の前提を訂正。`FocusModulationState` は FM `40HZ` button
  (`fm.html` / `fm.js`) と `window.setFmFocusModeEnabled` / `getFmFocusModeState`
  で現役。`AcidLockState` は `btn_acid_lock` と runtime packet/feedback に露出。
  `MicFollowState` は Core の `btn_mic_follow` と FM の mic follow controls から起動し、
  runtime packet / drum velocity scale / groove bias に現役で効く。
- 実際に未参照だった `randomNoteFromScale()` だけを削除。`randomChordForMode` /
  `randomHazeChord` / melodic director path には影響なし。
- `engine.js?v=fm-89` / `sw.js hazama-fm-v181` に cache bump。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。
- 残る taste 判断は BL-004（40Hz focus depth A/B）として維持。

### BL-016 — Band Room kit セレクタのラベル明確化 ✅ 2026-05-17
- repo: Music / scope: non-engine-code
- 前提訂正済みの minor item を消化。Band Room の `KIT_OPTIONS` label を
  `synth:` と `sample:` prefix で揃え、AI synth kit と曲自身/catalog sample kit が
  セレクタ上で区別できるようにした。既定 `auto-self` behavior は変更なし。
- `band-room.js?v=br-87` / `sw.js hazama-fm-v180` に cache bump。
- `check-band-room-logic.mjs` は Band Room script marker を literal ではなく
  HTML/SW 同期で検証し、kit label guard も追加。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。
- Browser: `http://127.0.0.1:4174/band-room.html` で `br-87` と label 表示を確認、
  console error なし。

### BL-007 — stack-check の health 拡張を検討 ✅ 2026-05-17
- repo: stack / scope: non-engine-code
- 通常の `node scripts/stack-check.mjs` はローカル gate のまま維持し、任意フラグ
  `--deploy-health` を追加。指定時のみ active 5 repo の GitHub Pages URL
  （Music / chill / drum-floor / namima / openclaw）が HTTP 200 を返すかを
  `deploy 200` check として表に加える。ネットワーク依存を通常 gate に混ぜないため、
  過剰な重さや不安定化は避けた。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。
- `node scripts/stack-check.mjs --deploy-health`: PASS 20 / FAIL 0 / SKIP 0（0 BAD）。

### BL-015 — check-hazama-melody.mjs の version hardcode を解消 ✅ 2026-05-17
- repo: Music / scope: non-engine-code
- `scripts/check-hazama-melody.mjs` の `fm-N` / `hazama-fm-vN` literal assert を解消。
  `fm.html` / `index.html` / `sw.js` から `engine.js` と `audio/music-stack-routing.js`
  の cache marker を抽出し、`fm-N` 形式・3箇所同期・engine/routing 同期を検証する
  pattern check へ置換。`sw.js VERSION` も `hazama-fm-vN` 形式だけを見るため、
  今後の cache bump で check script 追従編集が不要になった。
- `node scripts/stack-check.mjs`: PASS 15 / FAIL 0 / SKIP 0（0 BAD）。

### BL-001 — sister repo agent-readiness ✅ 2026-05-16
- repo: chill, drum-floor, namima, openclaw / scope: docs
- chill / drum-floor / namima / openclaw に `AGENTS.md` を作成、STACK-INDEX へ統合。
  drum-floor は pytest が collection error（`drum_floor` 未 import）だったため
  `conftest.py` で repo root を sys.path へ追加し修復。stack-check 0 BAD 達成。
- 詳細は `SESSION-LEDGER.md` 2026-05-16 エントリ。

### BL-011 — openclaw check-pwa-static.mjs の version 引数化 ✅ 2026-05-16
- repo: openclaw / scope: non-engine-code
- `check-pwa-static.mjs` の sw.js VERSION ハードコード assert（`v3` 固定）を、
  正規表現での pattern 検出（`${CACHE_PREFIX}-v<N>` 形）＋ 任意の `--expected-version`
  引数へ置換。cache bump 毎の check script lockstep 編集が不要に。
- AUTONOMOUS-RUN.md プレイブックの初実走で消化（詳細は SESSION-LEDGER）。

### BL-002 — sister repo の domain-logic 検証カバレッジ ✅ 2026-05-16
- repo: chill, namima, openclaw / scope: non-engine-code
- 3 並列エージェントで各 repo に domain-logic check を追加: chill `check-chill-logic.mjs`
  （deterministic-preview 契約 / 公開 adapter / piano-recipe schema）、namima
  `check-mood-profiles.mjs`（mood-profiles schema / family-safe 制約 / 翻訳 logic）、
  openclaw `check-session-manifest.mjs`（session-manifest schema / 例 manifest / connector registry）。
- stack-check は 11 → 14 check に拡張、0 BAD。

### BL-009 — drum-floor JS-side domain-logic check ✅ 2026-05-16
- repo: drum-floor / scope: non-engine-code
- `scripts/check-music-sync-safety.mjs` を追加（~55 assertion）。SYNC 安全不変条件
  （auto-start / arm / MIDI を絶対にしない）、translation contract の clamp / 既知 id、
  groove-engine の決定性（同 seed → byte-identical bar）、`sanitizeControls` の boolean 強制を検証。

### BL-010 — namima sw.js cache version 二重管理を解消 ✅ 2026-05-16
- repo: namima / scope: non-engine-code
- `check-pwa-static.mjs` に sw.js の `VERSION`（`namima-pwa-vN`）と asset cache-buster
  （`?v=stack-M`）の数値一致 assert を追加。drift を gate で検出（sw.js は無改変）。

### BL-005 — integration 境界 docs の整合 ✅ 2026-05-16
- repo: Music / scope: docs
- `integration-catalog.md` と `music-stack-integration-index.md` §3 を STACK-INDEX と整合。
  active repo の `openclaw` が両 catalog から欠落していたのを追加、`hazama` を music-stack
  repo ではなく external reference-only と明示、`namima-lab` / `test` を archived 明記。

### BL-013 — drum-floor の出音改善（生音バリエーション + キック） ✅ 2026-05-16
- repo: drum-floor / scope: runtime（要・試聴確認）
- `src/audio-engine.js`: hit ごとの jitter PRNG（pitch ±2-3 cent / decay ±5-9% / level ±5%）
  と velocity → 音色マッピングを追加し「生音差がない」を解消。kick（tight_band）は
  peak level 0.86x・sub tail 短縮（decay 1.35→1.05x, 0.7x）・transient 後の sweeping
  lowpass で「ポンポン / うるさい」を抑制。cache drum-floor-pwa-v3。
- 出音の良否は試聴で人間が判定。ユーザー指摘ベースの改善。

### BL-014 — Hazama FM の出音改善（funk voice timbres） ✅ 2026-05-16 (v176)
- repo: Music / scope: runtime（要・試聴確認）
- `audio/genre-flavor.js`: funk EP (Rhodes) の和音を flat block → per-note ロール
  （8-22ms）+ voice ごと velocity ばらつきへ。funk clavi フィルタを velocity 追従に
  （静的 cutoff で全ノート同一音色だったのを解消）。`buildFunkDefault` /
  `buildFunkFromFrames` の両経路。engine.js 凍結のため genre-flavor.js で実装。
  cache hazama-fm-v176 / `?v=fm-71`。出音の良否は試聴で人間が判定。

### BL-021 — github-inventory→workspace 直下 移行後のパス文字列クリーンアップ ✅ 2026-05-17
- repo: Music, openclaw, namima / scope: docs
- music-stack を `C:\workspace\github-inventory\music-stack` → `C:\workspace\music-stack` へ
  移動後、旧パス文字列を 18 ファイル（Music docs 9 + `scripts/_*.py` 6 + openclaw docs 2 +
  namima docs 1）で `github-inventory/music-stack`→`music-stack` に置換。
  `cross-repo-listening-review-round.md` の単独 `github-inventory` 参照も文脈修正。機能影響なし。
- 詳細は `SESSION-LEDGER.md` 2026-05-17 エントリ。

### BL-018 — 未配線の preset / reference JSON を wire か削除で整理 ✅ 2026-05-17
- repo: Music / scope: non-engine-code
- dormant-asset 監査の前提を一部訂正。`presets/{ambient,dub,jazz,lofi,techno,trance}.json`
  は engine.js PresetManager（Music Core Rig の preset selector）が直接消費する active な
  「engine 用 6 ファイル」で dormant ではない（AGENTS.md Hard Rule 5・SCHEMA.md §4 が
  Hazama FM の loader.js 6 ファイルと別物と明記）。`references/apple-music-refs.json` は
  sw.js precache 登録済み＋設計リファレンスのため keep。実際に未参照だったのは
  `presets/tabasco-analysis.json` / `unripe-analysis.json` の 2 つのみ — 削除した。
- 詳細は `SESSION-LEDGER.md` 2026-05-17 エントリ。

### BL-020 — 雑多な dormant の cleanup ✅ 2026-05-17
- repo: Music, drum-floor, namima / scope: non-engine-code
- dormant-asset 監査の前提を訂正（2026-05-17 検証）。namima `sketch.js` の v3/v4 "lab"
  variant は存在しない（全コード active）。drum-floor `patches/` は README が将来の
  VCV `.vcv` patch 置き場と明記する意図的プレースホルダで junk ではない。残る
  `engine.js` の `randomNoteFromScale()`（未呼び出し）は engine.js 凍結域のため BL-017 へ統合。
- 詳細は `SESSION-LEDGER.md` 2026-05-17 エントリ。
