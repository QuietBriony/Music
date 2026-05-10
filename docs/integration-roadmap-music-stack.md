# Music Stack 統合ロードマップ

この文書は、Music Stack の次工程を docs-first / metadata-only / human-gated に保つためのロードマップです。

実装統合、runtime 移植、音源追加、archive/delete、dependency 追加はこの文書だけでは許可しません。

## 0. 現在地

- `Music` は central integration target / conductor として扱う。
- `docs/integration-catalog.md` は current catalog として、各 repo の役割を短く固定する。
- `docs/music-stack-integration-index.md` は top-level entry として、active repo、shared rules、work queue を持つ。
- `docs/music-orchestra-protocol.md` と `docs/music-stack-sync-manual.md` は metadata-only の現行境界を持つ。
- runtime code は保護対象。`engine.js` / `index.html` / `style.css` は docs/schema PR では触らない。

## 1. 現在の repo 役割

### Music

- 役割: central integration target / conductor
- 方向: experimental / edge / reference-driven generative rig
- 境界: Music runtime、UCM faders、Hazama FM、Music Core Rig、session packet を所有する

### namima

- 役割: active public-friendly ambient player
- 方向: daytime / family-safe / water / garden / soft continuous listening
- 境界: safe mood、ambient translation、user-gesture start、metadata-only Music SYNC を所有する

### drum-floor

- 役割: active rhythm / groove / VCV / stage-safety reference
- 方向: groove grammar、pocket frames、human-gated promotion、raw candidate 境界
- 境界: Music SYNC を読んでも auto-start / record / MIDI send / arm / upload はしない

### chill

- 役割: quiet piano / trio / long-form listening light surface and harvest source
- 方向: synthetic felt-like piano、long rests、Flow Director、optional BASS / DRUMS、quiet recovery
- 境界: generic ambient に潰さず、PULSE や drums を主役にしない

### namima-lab

- 役割: lineage / staging / harvest-only source
- 方向: historical namima experiments、ripple、organic pluck、lightweight reference notes
- 境界: active runtime として revive しない。Music へ direct merge しない

### test

- 役割: archive candidate / harvest-only source
- 方向: style blend、probability / interpolation idea shelf
- 境界: primary runtime にしない。assets/dependencies を足さない

### hazama

- 役割: world / game / story / visual reference-only
- 方向: atmosphere、navigation、liminal world feel
- 境界: Music runtime / dependency / migration target にしない

## 2. ロードマップ

### Phase 0: docs authority alignment

目的:
- current catalog、integration index、orchestra protocol、SYNC manual の役割を明確にする。

完了条件:
- `docs/integration-catalog.md` が current role catalog として読める。
- 古い direct merge / fixed integration order の表現が、少なくとも入口 docs から外れている。
- 次に古い roadmap / harvest docs を更新する時の判断基準が明確である。

### Phase 1: metadata-only coordination

目的:
- Music session packet、SYNC、sidecar、trace を cross-repo 連携の既定経路にする。

扱うもの:
- docs
- schema / packet explanation
- routing vocabulary
- review notes
- human-gated promotion request shape

扱わないもの:
- audio
- samples
- lyrics
- raw microphone buffers
- runtime ownership transfer
- auto-start / arm / record / upload

### Phase 2: repo-specific harvest decisions

目的:
- useful idea を source repo の runtime から直接コピーせず、target repo の言葉へ翻訳する。

既定方針:
- `chill`: quiet piano / trio / deterministic preview / quiet recovery を harvest idea として扱い、現行境界は `docs/chill-quiet-piano-trio-decision.md` に従う。
- `test`: style blend / probability interpolation を harvest idea として扱い、現行境界は `docs/test-style-blend-preset-morph-decision.md` に従う。
- `namima-lab`: ripple / organic pluck / historical interaction lineage を harvest idea として扱い、現行境界は `docs/namima-lab-safe-ripple-lineage-decision.md` に従う。
- `drum-floor`: groove grammar / stage safety / human-gated review を active reference として扱う。
- `namima`: safe ambient mood translation を active consistency reference として扱う。
- `hazama`: world/story/visual reference-only として扱う。

完了条件:
- 1 PR につき 1 source idea / 1 target repo / 1 translated intent に収まる。
- source repo の code や assets を blind copy しない。
- harvest-only / staging / archive candidate の状態を human review なしで変更しない。

### Phase 3: runtime candidate planning

目的:
- runtime 変更が必要な場合だけ、docs/schema/review を通過した小さな候補へ落とす。

開始条件:
- target repo と intended effect が明確である。
- metadata-only provenance が説明されている。
- no samples / no lyrics / no copied motifs / no dependency surprise が確認されている。
- listening review または browser behavior review の方法が決まっている。

対象外:
- `namima-lab` の direct runtime revive
- `test` / `chill` の全体一括 merge
- `drum-floor` の VCV / Ableton / EP-133 自動操作
- `hazama` の Music runtime 化

### Phase 4: human-gated promotion

目的:
- 実際に採用するかを、人間のレビューで小さく決める。

必要条件:
- 変更が 1 PR / 1 purpose である。
- rollback が容易である。
- 音を変える場合は listening notes がある。
- runtime を変える場合は START / STOP / long-run / mobile gesture / console safety の確認方法がある。

## 3. Definition of Ready

- current role が `docs/integration-catalog.md` と矛盾していない。
- source repo の役割が active / staging / harvest-only / reference-only / archive candidate のどれか明示されている。
- target repo と intended effect が明確である。
- runtime code、assets、dependencies、GitHub Actions、archive/delete/settings を触るかどうかが明記されている。
- human review が必要な判断を自動採用しない。

## 4. Definition of Done

- docs-only PR は runtime ファイルを変更しない。
- runtime candidate PR は docs/schema/review 境界を参照する。
- 各 repo の独自性が潰れていない。
- metadata-only の境界を破っていない。
- next action が 1 つに絞られている。

## 5. Runtime safety checks for future implementation

音を変える future PR だけで確認する:

- START / STOP が破綻しない
- 初回 user gesture が守られている
- クリップ / 歪み / 過大音量がない
- 10-15分の連続再生で jank / timer drift / memory pressure が悪化しない
- mobile Safari の start 制約を壊さない
- console error がない
- panic / quiet recovery / fallback が説明されている

## 6. Non-goals

- no direct repo merge
- no blind runtime code copy
- no audio files or samples
- no lyrics or copied motifs
- no dependency installation
- no GitHub Actions changes
- no archive/delete/settings action
- no `hazama` runtime integration
- no `namima-lab` revival without separate approval
- no `test` / `chill` full merge
