# UCM Mandala Engine — 音響曼荼羅OS（2026 β）
総合芸術 × 自動音楽生成 × 観システム同期エンジン  
Version: 1.0 (Markdown Spec Edition)

## 🎯 目的
UCM（Unified Cognitive Model）を音楽生成エンジンへ翻訳し、  
1つの UI / Engine で **静 → 動** を無段階生成する。

### ● 対応ジャンル
- Ambient / Drone
- Lofi / Nujabes
- Modern Jazz
- IDM / Glitch
- Techno / Minimal
- Trance / PsyTrance
- Rave / Club

---

## 🌌 コア思想（UCM-2026β）
### 八観（Core Kernel）
- 体観 / 波観 / 思観 / 財観  
- 創観 / 観察者 / Void / 円観  

フェーダーの重心で音楽の性質が変わる。

---

## 🛠️ システム構成
```
/index.html
/style.css
/engine.js

/audio/
/presets/
/assets/
```

---

## 🎚️ メインUI（フェーダー）
- 静 ⇄ 動（Energy）
- 波観
- 思観
- 創観
- Void
- 円観
- 体観
- 財観
- 観察者

### 使い方マニュアル (ユーザー向け)
- 📻 **[Hazama FM 使い方](docs/USAGE-HAZAMA-FM.md)** — 24/7 流しっぱなしフォーカス BGM の操作方法
- 🎚️ **[Music Core Rig 使い方](docs/USAGE-MUSIC-CORE-RIG.md)** — 9 fader mixer の操作方法

### 開発者向け

- 🤝 **[AGENTS.md](AGENTS.md)** — claude code / codex / 他 agent の最初に読む共通契約
- 👯 **[並列開発プレイブック](docs/COLLAB-CLAUDE-AND-CODEX.md)** — claude と codex を並列で動かすガイド
- 🏛️ **[Hazama FM アーキテクチャ](docs/HAZAMA-FM-ARCHITECTURE.md)** — システム全体像
- 🎵 **音楽的参照**:
  - [`references/apple-music-refs.json`](references/apple-music-refs.json) — 全 18 アーティスト x production translation
  - [`references/hazama-fm-pill-refs.json`](references/hazama-fm-pill-refs.json) — GENRE pill → reference 紐付け
- 🔬 **整合性監査**: `python -X utf8 scripts/audit.py [--quiet] [--expected-version hazama-fm-v152]`
  - 全リソース (preset JSON / loader / sw precache / cache buster / engine 9 番組 / LEVEL_BY_GENRE) を 1 発でチェック
  - `0 BAD, 0 WARN` で exit 0、BAD で exit 1 (CI 向け)
  - `--quiet` でほぼ silent (CI / pre-commit hook 用)
- ✅ **JS syntax**: `node scripts/check-js.mjs`
- ✅ **Band Room pure logic**: `node scripts/check-band-room-logic.mjs`

### 参考資料
- Reference-Driven Generative Rig: [docs/reference-driven-generative-rig.md](docs/reference-driven-generative-rig.md)
- Apple Music references: [references/apple-music-refs.json](references/apple-music-refs.json)
- Reference analysis template: [docs/reference-analysis-template.md](docs/reference-analysis-template.md)
- Music stack integration index: [docs/music-stack-integration-index.md](docs/music-stack-integration-index.md)
- Music Stack Orchestra Direction: [docs/music-stack-orchestra-direction.md](docs/music-stack-orchestra-direction.md)
- Music Orchestra Protocol: [docs/music-orchestra-protocol.md](docs/music-orchestra-protocol.md)
- Music Stack SYNC manual: [docs/music-stack-sync-manual.md](docs/music-stack-sync-manual.md)
- MIC Jam / Groove Drive: [docs/mic-jam-groove-drive.md](docs/mic-jam-groove-drive.md)
- Mode timbre palettes: [docs/mode-timbre-palettes.md](docs/mode-timbre-palettes.md)
- Music Radio Brain: [docs/music-radio-brain.md](docs/music-radio-brain.md)
- Codex Composer workflow: [docs/codex-composer-workflow.md](docs/codex-composer-workflow.md)
- Music Session Packet Schema: [docs/schema/music-session-packet.schema.json](docs/schema/music-session-packet.schema.json)
- Orchestra Routing Map: [docs/music-orchestra-routing-map.md](docs/music-orchestra-routing-map.md)
- Preset translation schema: [docs/preset-translation-schema.md](docs/preset-translation-schema.md)
- Repo Harvest Orchestra Workflow: [docs/repo-harvest-orchestra-workflow.md](docs/repo-harvest-orchestra-workflow.md)
- Archive repo harvest audit: [docs/archive-repo-harvest-audit.md](docs/archive-repo-harvest-audit.md)
- Xtal reference gradient: [docs/xtal-reference-gradient.md](docs/xtal-reference-gradient.md)
- Xtal reference gradient depth map: [docs/xtal-reference-gradient-depth-map.md](docs/xtal-reference-gradient-depth-map.md)
- iOS Safari background playback check: [docs/ios-safari-background-playback-check.md](docs/ios-safari-background-playback-check.md)
- Browser listening checklist: [docs/runtime-browser-listening-checklist.md](docs/runtime-browser-listening-checklist.md)

---

## 🔁 オートモード
- 観のランダム遷移（1–10 min）
- 最大 50分のシームレスサイクル
- 静⇄動の揺らぎモード

## 📻 Hazama FM mode
START 一発で永遠に流れるフォーカス BGM ページ。`MusicRadioBrain` (9 番組: fieldStudy / glassCoding / dryGridWork / ghostPressure / voidRoom / hardTechno / liveJazz / nightFunk / quietPiano) を可視化、`engine.js` は無変更で再利用。
- Local: `fm.html` をローカルサーバー経由で開く (例: `python -m http.server 8000` → `http://localhost:8000/fm.html`)
- Pages: `https://quietbriony.github.io/Music/fm.html`
- 詳しい使い方: [docs/USAGE-HAZAMA-FM.md](docs/USAGE-HAZAMA-FM.md)

## 🎚️ Music Core Rig (full mixer)
9 fader を直接動かして音作り・録音できる mixer モード。Hazama FM と同じ engine。
- Pages: `https://quietbriony.github.io/Music/`
- 詳しい使い方: [docs/USAGE-MUSIC-CORE-RIG.md](docs/USAGE-MUSIC-CORE-RIG.md)

---

## 🎵 音響アルゴリズム
- Infinite Drone Engine  
- Euclid Rhythm  
- Noise-Warp Synth  
- Jazz Stab Generator  
- IDM Glitch Engine  
- Pattern Mutation System  

---

## 🌈 UI（曼荼羅 OS）
- 青系透明 6レイヤー曼荼羅
- 回転・ブレンド・中心核の呼吸アニメ
- JP/EN 切替

---

## 📘 ライセンス
Free for personal use  
（あなた専用の音響曼荼羅 OS）

