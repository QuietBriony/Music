# Music Stack Repo Strategy

この文書は、Music 関連 repo 群の役割分担と統合方針を固定するための運用ガイドです。

正本入口は `docs/music-stack-integration-index.md`、短い現行カタログは `docs/integration-catalog.md` とします。この strategy は、なぜ repo を分けたまま連携するのかを説明する補助文書です。

## 1. 全体方針

1. 全 repo を単一 repo に統合しない。
   - 役割の異なる runtime / harvest source / reference を 1 箇所に詰め込まない。
   - `Music` は conductor だが、他 repo の runtime 所有権を奪わない。

2. 共有するのは音そのものではなく production intent。
   - reference-driven の考え方は共有する。
   - 参照素材はコピーせず、timbre / rhythm / space / structure / gesture などの production parameters に変換する。

3. cross-repo 連携は metadata-only を既定にする。
   - session packet / sidecar / trace を使う。
   - 音声、samples、lyrics、raw microphone buffers、recordings は共有しない。
   - 受信側 repo は packet を自分の domain logic へ翻訳する。

4. runtime は役割別に分離する。
   - `Music`, `drum-floor`, `namima`, `chill` はそれぞれ別の体験を持つ。
   - `namima-lab` と `test` は primary runtime ではなく harvest / archive 側で扱う。
   - `hazama` は world / story / visual reference-only として扱う。

5. promotion は human-gated にする。
   - useful idea は小さな docs / schema / review candidate に落とす。
   - runtime 変更は listening review または browser behavior review の準備後に扱う。
   - archive/delete/settings、dependency、GitHub Actions は別承認なしに触らない。

## 2. 各 repo の役割

### Music

- 役割: **central integration target / conductor**
- 方向: experimental / edge / reference-driven generative rig
- 所有するもの: Music runtime, UCM faders, Hazama FM, Music Core Rig, session packet, reference-driven production intent
- 境界: docs/schema PR では `engine.js`, `index.html`, `style.css` を触らない

### drum-floor

- 役割: **active rhythm / groove / VCV / stage-safety reference**
- 方向: groove grammar, pocket frames, human-gated promotion, raw candidate boundaries
- 所有するもの: drum feel, stage safety, browser drum preview, candidate CLI, Music SYNC receiver behavior
- 境界: Music SYNC は auto-start / record / MIDI send / Ableton arm / EP-133 操作 / upload をしない

### namima

- 役割: **active public-friendly ambient player**
- 方向: daytime / family-safe / water / garden / soft continuous listening
- 所有するもの: safe mood translation, ambient profiles, user-gesture start, metadata-only Music SYNC translation
- 境界: dark glitch, heavy bass, stage groove assumptions, copied `namima-lab` code を入れない

### chill

- 役割: **quiet piano / trio / long-form listening light surface and harvest source**
- 方向: synthetic felt-like piano, long rests, Flow Director, optional BASS / DRUMS, quiet recovery, deterministic preview
- 所有するもの: quiet piano/trio identity, local listening score, chill session flow
- 境界: generic ambient に潰さない。PULSE や drums を主役にしない。Music SYNC で自動再生しない

### namima-lab

- 役割: **lineage / staging / harvest-only source**
- 方向: historical namima experiments, ripple interaction, organic pluck, lightweight reference notes
- 所有するもの: namima-safe lineage ideas
- 境界: active runtime として revive しない。Music へ direct merge しない。dependency-heavy 実験場にしない

### test

- 役割: **archive candidate / harvest-only source**
- 方向: style blend, probability / interpolation idea shelf
- 所有するもの: small experimental ideas that may be translated elsewhere
- 境界: primary runtime にしない。assets/dependencies を足さない

### hazama

- 役割: **world / game / story / visual reference-only**
- 方向: atmosphere, navigation, liminal world feel
- 所有するもの: non-music conceptual reference
- 境界: Music runtime / dependency / migration target にしない

## 3. 統合ルール

- audio files を移植しない。
- samples / sample URLs を移植しない。
- lyrics を保存しない。
- copied melodies / motifs / arrangements / recordings を使わない。
- runtime code は blind copy しない。
- dependencies は明示承認なしに追加しない。
- GitHub Actions は明示承認なしに変更しない。
- source repo の役割を human review なしに active 化しない。
- 1 PR は 1 purpose / 1 target / 1 translated intent に絞る。

再利用可能なもの:

- docs
- concepts
- production translation
- interaction models
- rhythm / mood / reference vocabulary
- packet / sidecar / trace ideas
- review notes
- human-gated promotion patterns

## 4. 開発ロードマップ

### Phase 1: docs authority alignment

- `docs/integration-catalog.md` と `docs/music-stack-integration-index.md` を current role source にする。
- 古い direct merge / fixed integration order の表現を、必要な docs から順に外す。
- archive / staging / harvest-only の状態を明確にする。

### Phase 2: metadata-only coordination

- Music session packet / SYNC / sidecar / trace を既定の cross-repo 連携経路にする。
- `drum-floor`, `namima`, `chill`, OpenClaw は Music の intent を metadata として読む。
- 受信側は自分の UI / mood / groove / flow へ翻訳し、音の開始や live 操作は人間が行う。

### Phase 3: harvest decisions

- `chill`: quiet piano / trio / deterministic preview / quiet recovery を harvest idea として扱い、現行境界は `docs/chill-quiet-piano-trio-decision.md` に従う。
- `test`: style blend / probability interpolation を harvest idea として扱い、現行境界は `docs/test-style-blend-preset-morph-decision.md` に従う。
- `namima-lab`: ripple / organic pluck / historical interaction lineage を harvest idea として扱い、現行境界は `docs/namima-lab-safe-ripple-lineage-decision.md` に従う。
- `drum-floor`: groove grammar / stage safety / human-gated review を active reference として扱う。
- `hazama`: world/story/visual reference-only として扱う。

### Phase 4: runtime candidates

- runtime 変更は docs/schema/review を通過した後にだけ扱う。
- 音を変える場合は listening notes または browser behavior review を用意する。
- START / STOP / long-run / mobile gesture / console safety を確認する。
- rollback しやすい小PRに分離する。

## 5. 作業ルール

- main に直接 commit しない。
- docs/schema PR では `engine.js`, `index.html`, `style.css` を触らない。
- audio assets を追加しない。
- dependencies を追加しない。
- `.github/workflows` に触らない。
- archive/delete/settings を触らない。
- build / audio run は別承認がある時だけ行う。
- push / PR / merge は人間確認後に行う。

## 6. 判断を保留するもの

以下は local docs だけで決めず、ChatGPT / Claude abstraction review または人間の taste review を通す。

- `Music` を public に experimental instrument / focus radio / broader music OS のどれとして見せるか
- `docs/chill-quiet-piano-trio-decision.md` の現行境界を超えて、`chill` を将来 named Music mode にするか
- `docs/test-style-blend-preset-morph-decision.md` の現行境界を超えて、Style Blend / preset morph を visible control にするか
- `docs/namima-lab-safe-ripple-lineage-decision.md` の現行境界を超えて、Music に gesture-to-texture layer を持たせるか
- `Music` に残す dark glitch / bass pressure / club energy の比率
- `hazama` の world/story 感を Music UI にどこまで反映するか

## 7. 参照リスト

- `docs/music-stack-integration-index.md`
- `docs/integration-catalog.md`
- `docs/integration-roadmap-music-stack.md`
- `docs/music-orchestra-protocol.md`
- `docs/music-stack-sync-manual.md`
- `docs/repo-harvest-orchestra-workflow.md`
- `docs/archive-repo-harvest-audit.md`
