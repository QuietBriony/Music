# Hazama FM — システム全体像

> 24/7 generative focus radio。1 個の Music repo + 3 個の sister repo の
> JSON エクスポートで動く、PWA 対応の web アプリ。

## 1. リポ構成 (1 + 3 + 1)

```
QuietBriony/Music              ← 演奏ホール (このリポ)
├── fm.html / fm.js / fm.css   ← Hazama FM UI shell
├── index.html / engine.js     ← Music Core Rig (9-fader mixer / 12k 行 engine)
├── audio/genre-flavor.js      ← Tone.js synth layer (preset 受容)
├── presets/loader.js          ← sister repo JSON を fetch+validate
├── presets/*.json             ← sister repo からの export (6 files)
├── manifest.webmanifest       ← Hazama FM PWA
├── manifest-mixer.webmanifest ← Music Core Rig PWA (別アプリ)
└── sw.js                      ← Service Worker (offline cache)

QuietBriony/chill              ← Quiet Piano recipe 資産庫
└── exports/chill-piano-recipe.json

QuietBriony/drum-floor         ← drum frame 資産庫
└── exports/drum-frames-{funk,techno,jazz,lofi}.json

QuietBriony/namima             ← ambient mood shape 資産庫
└── exports/namima-shape-ambient.json
```

各 sister repo は **「自分の repo 内で完結する自律的な開発」** を続ける。
Music は sister repo が出してくれた **JSON だけ** を読み、Tone.js で再現。

## 2. データフロー

```
[各 sister repo の codex agent]
        ↓  (codex 内蔵 git で commit + push + PR)
[sister repo main の exports/*.json]
        ↓  (curl raw.githubusercontent.com)
[Music/presets/*.json]
        ↓  (presets/loader.js が fetch+validate)
[window.HazamaPresets.get(name)]
        ↓  (audio/genre-flavor.js builder が受け取る)
[Tone.js synth + Tone.Transport schedule]
        ↓
[ブラウザ AudioContext → スピーカー]
```

### preset がない場合のフォールバック

各 builder は preset を**任意引数**として受け、`null` の場合は
ハンドコード default に降りる (`source: "default"`)。読み込み失敗・404・
JSON parse error も全部 graceful 処理。

つまり sister repo 開発が遅れていても Hazama FM は止まらない。

## 3. UI レイヤー

### GENRE pill (7 種) ↔ 内部状態の対応

| pill | UCM faders | culture grammar | flavor preset | flavor source |
|---|---|---|---|---|
| ANY | automix sine wave | `auto` (engine 選択) | — | (no flavor layer) |
| AMBIENT | low energy / high observer | `ambient_room` | `namima-shape-ambient` | `namima-preset:water_day` |
| TECHNO | high body+energy / low void | `acid_core` | `drum-frames-techno` | `drum-frames+machine-acid-brain` |
| LOFI | mid energy / high mind+wave | `tape_memory` | `drum-frames-lofi` | `drum-frames+vinyl-crackle` |
| JAZZ | high wave+mind+creation | `earth_reed` | `drum-frames-jazz` | `drum-frames+walking-bass+brush` |
| FUNK | high body+creation | `broken_machine` | `drum-frames-funk` | `drum-frames+ep+clavi` |
| PIANO | high circle+observer | `earth_reed` | `chill-piano-recipe` | `chill-recipe:piano-jazz-chill+foreground-piano` |

FM pill は Music 本体の UCM faders / culture だけでなく、本体側の bus mix も
ジャンル別に翻訳する。`techno` と `piano` では `pad/glass/pianoMemory/voiceDust`
を大きく下げ、FM flavor の machine / piano layer を主役にする。`ambient` だけは
本体の air / pad を比較的残す。

高BPMの `techno` / IDM 寄り文脈では、16分ハットを増やすのではなく、32分/64分
相当の短い acid/click/texture ratchet を小さい burst として足す。狙いは
foreground のシャカシャカではなく、脳内で踊る micro-grid。

非 ANY 選択時は engine の AUTOMIX (sine wave 変調) を OFF にして
fader をロック。ANY 戻しで AUTOMIX 復帰。

### MusicRadioBrain (engine.js 内蔵) — 9 番組

```
fieldStudy / glassCoding / dryGridWork / ghostPressure / voidRoom
+ hardTechno / liveJazz / nightFunk / quietPiano  (engine.js に追加した 4)
```

各番組は 60–90 秒で AI が weight に従って rotate。
`window.MusicRuntimeState.radioBrain.{active, next, lastReason, phrase, phraseCycles}`
を 4860 行目で `music-runtime-state` CustomEvent として publish。

fm.js が listener で受け取り、UI 更新 + Media Session metadata 同期 +
station ident animation 駆動。

### station ident animation

`radioBrain.active` が変わる瞬間に:

1. `#mandala-container.ident-active` を 1500ms 付与 (brightness 1.2 + saturate 1.1)
2. `#fm-now.transitioning` を 220ms 付与 → text 差し替え → fade in
3. mandala 内部レイヤーの回転速度が一時的に 90s → 50s に上がる

### phrase progress bar

`#fm-progress > span` の width を `(rb.phrase / rb.phraseCycles) * 100%`
で更新。次の番組までの "残り時間" が視覚的に分かる。

### Media Session API

`navigator.mediaSession.metadata` を radioBrain.active 変更時に同期 →
iPhone ロック画面・コントロールセンター・BT ヘッドフォン・mac Touch Bar
に「fieldStudy — initial haze room」等が表示される。

## 4. PWA architecture

```
manifest.webmanifest         ← Hazama FM (start_url=fm.html、ミントアイコン)
manifest-mixer.webmanifest   ← Music Core Rig (start_url=index.html、warm orange)
sw.js                        ← 共通 Service Worker
  ├ HTML: network-first       (deploy 即反映)
  ├ static (CSS/JS/SVG/PNG): cache-first
  ├ presets/*.json: stale-while-revalidate
  └ Tone.js CDN: cache-first (opaque)
icons/icon-*.png             ← Hazama FM (mint 同心円リング)
icons/mixer-*.png            ← Music Core Rig (orange 9-fader 放射状)
```

iPhone Safari → 共有 → ホーム画面に追加で 2 つの独立アプリが並ぶ
(同じ scope 内に Hazama FM 起動 + 内部リンクで mixer 移動も可)。

## 5. 開発サイクル — 「お任せお願い」フロー

```
1. ユーザー: 「○○磨いて」
2. claude code: spec 設計 (docs/codex-prompts/*.md)
3. claude code: Codex App に paste & send (computer-use 経由)
4. 各 codex (sister repo): branch 切る → 実装 → 自己検証 → PR (auto-merge 禁止)
5. ユーザー (or claude code): codex chat に「マージして」
6. 各 codex: gh pr merge --squash --delete-branch
7. claude code: 各 main から JSON fetch → Music/presets/ にコピー
8. claude code: genre-flavor.js / loader.js / sw.js 拡張
9. claude code: commit + push → GitHub Pages v++ 反映
10. claude code: live URL sanity check
```

Music repo 自体への変更 (UI/animation) も同じパターン (codex が PR 作成 →
「マージして」 → 私が後追い merge or 直接 push)。

## 6. 拡張ポイント

### 新 GENRE pill を追加したい

1. `fm.html` の `#fm-genre` に新 button を追加
2. `fm.js` の `GENRE_PROFILES` に新 profile (9 fader + culture)
3. `audio/genre-flavor.js` に `buildXxx()` を追加
4. (任意) sister repo に対応 preset を出させて `PRESET_BY_GENRE` に追加

### 新 sister repo を追加したい

1. `presets/SCHEMA.md` に新 section 追加 (JSON schema 契約)
2. `presets/loader.js` の `PRESET_FILES` + `EXPECTED_FORMATS` に登録
3. `audio/genre-flavor.js` に新 builder 追加
4. `docs/codex-prompts/<repo>-export.md` に paste-ready prompt 用意
5. sister repo 側に export script を codex で実装させる

### engine.js への番組追加

`MUSIC_RADIO_BRAIN_PROGRAMS` 配列 + `MusicRadioBrainState.weights` +
`resetMusicRadioBrain` + `musicRadioBrainReason` + `targets` 計算 +
station ident audio cue + bias 接続の 6 箇所更新 (詳細は engine.js
内のコメント or `MusicRadioBrainState` 周辺の patches を参照)。

## 7. 運用ルール

| 項目 | 方針 |
|---|---|
| **engine.js 改変** | 原則禁止。Hazama FM 用の追加は fm.js / fm.css / audio/genre-flavor.js で吸収。例外は Core Rig と FM が共有する短い runtime cue API など、Music 全体の音響境界をそろえる最小変更のみ |
| **cache buster** | `?v=fm-N` を fm.html / sw.js の precache list で揃える。version 変えるたびに sw.js の `VERSION` も bump (`hazama-fm-vN`) |
| **sister repo の export** | sister repo 内で完結。Music は raw.githubusercontent.com から fetch のみ |
| **preset の絶対パス** | `presets/foo.json` で root-relative。loader.js の `PRESET_FILES` で一元管理 |
| **PR auto-merge** | 全 sister repo で禁止。「マージして」を codex に明示要求するパターンを採用 |
| **iOS Safari 対応** | Tone.start() は user gesture 内で呼ぶ、wake lock + background bridge は engine.js 標準動作 |

## 8. デバッグ

```js
// 現在の番組
window.MusicRuntimeState.radioBrain.active

// 番組ローテ予定
window.MusicRuntimeState.radioBrain.next
window.MusicRuntimeState.radioBrain.weights

// TECHNO / hardTechno の短い acid cue (Core Rig の ACID ロックとは別)
window.MusicRuntimeState.acid.transient
window.MusicRuntimeState.acid.transientSource
window.MusicAcidCue.getState()

// 現在の flavor 経路 (default vs preset)
window.GenreFlavor.state
// → { started: true, genre: "piano", scheduled: 3, source: "chill-recipe:piano-jazz-chill+foreground-piano", role: "chill quiet piano memory", ... }

// SYNC packet 側にも metadata-only で入る。音声・sample・自動PRは入らない。
window.MusicSessionPacket.build().performance_state.hazama_fm

// preset がロード済か
window.HazamaPresets.available("chill-piano-recipe")
window.HazamaPresets.get("drum-frames-jazz")

// 9 fader 現在値
[
  document.getElementById("fader_energy").value,
  // ...
].map(Number)
```

## 9. References

- `presets/SCHEMA.md` — 各 preset JSON の正式 schema
- `docs/codex-prompts/*.md` — sister repo codex に paste するための prompts
- `docs/music-radio-brain.md` — engine.js 番組ロジックの設計メモ
- `docs/ios-safari-background-playback-check.md` — iOS Safari 対応チェック
- engine.js コメント — 12k 行 live runtime の各セクション説明
