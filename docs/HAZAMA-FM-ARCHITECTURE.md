# Hazama FM — システム全体像

> 24/7 generative focus radio。Music + 3つのpreset供給sister + openclaw review deskで
> 構成する、PWA対応のweb音楽スタック。
>
> 3 app 横断の整合性: [CROSS-APP-INTEGRITY.md](./CROSS-APP-INTEGRITY.md)
> 音色設計の哲学: [FREE-SAMPLES-AND-SYNTHESIS.md](./FREE-SAMPLES-AND-SYNTHESIS.md)
>
> **Current repository snapshot — verified 2026-08-02**
>
> `last_verified_commit: fdef2dbf222b65d9445d7a060cc70443d1259287`
>
> Current cache / asset tuple: `hazama-fm-v399`, `engine.js?v=fm-118`,
> `style.css?v=fm-28`, `fm.css?v=fm-54`, `audio/genre-flavor.js?v=fm-80`, `fm.js?v=fm-72`,
> `band-room.js?v=br-234`, `band-room.css?v=br-89`。
> 公開deploy済みかどうかは別契約で、この値は現在のrepo treeを表す。
>
> **Historical v113-v115 update (cross-app 音色整合)**:
> - lofi mode の chord 担当を Salamander Grand Piano sampler (CC-BY 3.0、
>   Tonejs/audio source) に置換 — 「ノイズで lofi 風」を脱却
> - lofi mode の bass 担当を Salamander 低オク walking sampler に置換
> - lofi mode の drum 担当を tone-breakbeat CDN sample に置換
> - 既存 synth pad/bass は -26 ~ -28 dB に減衰 (二重発音防止)
> - 現在のcatalog URLは`config/external-dependencies.json`のcommit-pinned jsDelivrが正本。
>   `engine.js`の`tonejs.github.io`参照は凍結legacy例外であり、同一URLとはみなさない

## 1. リポ構成（Music + 4 active sibling roles）

```
QuietBriony/Music              ← 演奏ホール (このリポ)
├── fm.html / fm.js / fm.css   ← Hazama FM UI shell
├── index.html / engine.js     ← Music Core Rig (9-fader mixer / protected monolith)
├── listen.html                ← 現行の聴感QA入口
├── band-room.html / .js       ← Tabasco + HAZAMA original-stem / AI comparison surface
├── lyric-lab.html / .js       ← 歌詞 / Scene OS / 制作handoff
├── audio/genre-flavor.js      ← Tone.js synth layer (preset 受容)
├── presets/loader.js          ← sister repo JSON を fetch+validate
├── presets/*.json             ← sister repo からの export (6 files)
├── config/*.json              ← machine / external dependency / currency authority
├── manifest.webmanifest       ← Hazama FM PWA
├── manifest-mixer.webmanifest ← Music Core Rig PWA (別アプリ)
├── manifest-band-room.webmanifest ← Band Room PWA (別アプリ)
└── sw.js                      ← Service Worker (offline cache)

QuietBriony/chill              ← Quiet Piano recipe 資産庫
└── exports/chill-piano-recipe.json

QuietBriony/drum-floor         ← drum frame 資産庫
└── exports/drum-frames-{funk,techno,jazz,lofi}.json

QuietBriony/namima             ← ambient mood shape 資産庫
└── exports/namima-shape-ambient.json

QuietBriony/openclaw           ← review desk / mission board（runtime executorではない）
```

chill / drum-floor / namimaはpreset供給、openclawはreview / mission controlを担当する。
Musicのbrowser runtimeが読むのは、review後にこのrepoへ取り込まれたsame-origin JSONだけ。

## 2. データフロー

```
[各 preset sister repo]
        ↓  (repo内でexport + review)
[sister repo main の exports/*.json]
        ↓  (明示的にMusicへvendoring / provenance確認)
[Music/presets/*.json]
        ↓  (presets/loader.js がsame-origin fetch+validate)
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

FM pill は Music 本体の UCM faders / culture / tempo だけでなく、本体側の bus mix も
ジャンル別に翻訳する。`techno` は 132 BPM 付近の acid grid、`piano` は 68 BPM
付近の quiet foreground piano に寄せる。`techno` と `piano` では
`pad/glass/pianoMemory/voiceDust` を強く下げ、FM flavor の machine / dry
foreground piano layer を主役にする。`ambient` だけは本体の air / pad を比較的残す。

高BPMの `techno` / IDM 寄り文脈では、16分ハットを増やすのではなく、32分/64分
相当の短い acid/click/texture ratchet を小さい burst として足す。hat は
offbeat の機械 tick に絞り、狙いは foreground のシャカシャカではなく、脳内で踊る
micro-grid。

非 ANY 選択時は engine の AUTOMIX (sine wave 変調) を OFF にして
fader をロック。ANY 戻しで AUTOMIX 復帰。

### MusicRadioBrain (engine.js 内蔵) — 9 番組

```
fieldStudy / glassCoding / dryGridWork / ghostPressure / voidRoom
+ hardTechno / liveJazz / nightFunk / quietPiano  (engine.js に追加した 4)
```

各番組は18–42のphrase cycle targetとweightに従ってrotateする。wall timeはBPMと
bar進行で変わるため、固定60–90秒をruntime契約にしない。
`window.MusicRuntimeState.radioBrain.{active, next, lastReason, phrase, phraseCycles}`
を`music-runtime-state` CustomEventとしてpublishする。絶対行番号は移動するため正本にしない。

v142 以降、mode change は `BarCounter` で 16 bar phrase 境界に gate される。
UCM 閾値が途中で別 mode を要求した場合は `pendingMode` に保持し、次の phrase
境界で commit。manual preset は即時反映。

v143 以降、drum pattern は 4 bar ごとに小さく perturb し、16 bar で base pattern
へ戻す。beat-1 kick / 2・4 snare backbone は崩さず、長時間再生の単調さだけを減らす。

v169 以降、旋律側も `melodicDirector` が 8〜16 bar phrase ごとに key center /
contour / chord turn を変える。`tonalRhymeIndex()` は pool length を受け取るため、
6 音 / 10 音の fragment pool も偏らず使い、`voiceFragment()`、pad chord、bass root
が同じ小さな D/F#/G/E 断片へ戻り続けない。

runtime では `window.MusicRuntimeState.melodicDirector.{key, contour, phraseBars}`
を見れば、現在の旋律 director 状態を確認できる。

v170 以降、低域側も `basslineDirector` が 4〜8 bar phrase ごとに gate pattern /
interval walk / human push を選ぶ。メイン synth bass、lofi Salamander bass、
dub electric bass が同じ director を共有するため、Hazama FM と Music Core Rig の
どちらでも固定 root/5th loop に張り付かない。

runtime では `window.MusicRuntimeState.basslineDirector.{pattern, gate, phraseBars}`
を見れば、現在の bassline director 状態を確認できる。

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

### 現行playability / safety controls

- `auto / light / full`: device推定または人の選択でGenreFlavorの高コストfieldを再構築。
  lightではfun-fieldの2 Reverb、4 LFO AutoPanner、選択的oversamplingを省く。その他の
  genre Reverb / tape saturationまで消す契約ではなく、fullの音色は維持する。
- `AI fill`: explicit / lazy境界を持つ。無効時やasset失敗時はburstを開始せず、既存の
  base local Tone synthesisがそのまま続く。
- `shuffle` / DJ set / mic follow / `40HZ`: いずれも画面内の明示操作。録音・mic・focus
  modulationを暗黙開始しない。
- route diagnostics / SYNC: metadata-onlyでBand Room、Drum Floor、openclaw reviewへ渡す。
  audio、sample、private lyric bodyをpacketへ入れない。

### Media Session API

`navigator.mediaSession.metadata`をradioBrain.active変更時に同期する。対応browser / deviceでは
lock画面やmedia controlへ番組名を渡せるが、iPhone / 車載BT等の実表示はBL-003のhuman checklistで確認する。

### 現行の音量設計（repository snapshot）

```
各 GENRE synth voice
        ↓ per-builder voice gain / velocity（source codeが正本）
flavor master Gain
        ↓ × LEVEL_BY_GENRE[name] (0.54〜0.72)
        ↓ × output follower (engine OUTPUT に追従、0.38〜1.12)
        ↓ compressor / EQ safety tilt / light makeup / limiter guardrail
        ↓
   Tone.Destination (0 dB; no post-limiter boost)

        ↓
        ┌─ engine 各 synth voice
        ↓
   engine masterGain
        ↓ × outputGainFromLevel(FM target 88) ≈ 2.17 linear
   master compressor + 3-band Null Zone field（対応時; single-widener fallback）
    focusModGain (optional 40 Hz / 8% AM, default OFF)
        ↓
   masterLimiter / final guardrail
        ↓
   hardwareOutput + recorder/background bridge taps
        ↓ AudioContext.destination / hidden MediaStream audio bridge
```

- `LEVEL_BY_GENRE` (genre-flavor.js) でジャンル別音量バランス
  (piano 0.54、techno 0.72、他は0.60〜0.68)
- `GenreFlavor` は `fm.html` 専用の parallel color layer。Music full mix を
  直列加工しない
- `Tone.Destination.volume = 0 dB` (fm.js fmStart)。post-limiter boost なし
- flavor limiterは-1.2 dBのguardrail。常時突っ込ませず、FMの通常START targetはOUTPUT 88
- `40HZ` focus mode は limiter 前で 0.92〜1.00 の範囲だけを揺らすため、
  peak を持ち上げない。AI fill 中は depth 0% に自動退避
- iOS Safari / 車載 Bluetooth 向けに、最終 mix は hidden `<audio srcObject>`
  bridge にも流す。Web Audio が車側で通常メディアとして扱われにくい環境への fallback

### Per-genre station ident hue

CSS `body[data-fm-genre="<name>"] #mandala-container` の `--ident-hue`
と `--ident-saturate` を切替え。番組遷移の瞬間 (1.5s) にマンダラが
ジャンル別の色味で光る。
- any: mint (0°)
- ambient: -40° (水色)
- techno: +200° (マゼンタ)
- lofi: +60° (warm dust)
- jazz: +100° (gold-green)
- funk: +150° (orange punch)
- piano: -20° (soft blue-mint)

### Fade-to-sleep (90 分)

START から 90 分連続再生で sleepTimer 発動 → 30 分かけて output_level を
現在値 → 25 に逓減。ENERGY/GENRE pill 操作 or STOP で即キャンセル。
fm.js の `startSleepTimer` / `cancelSleepTimer` で管理。

### PWA install prompt + manifest shortcuts

- fm.js が `beforeinstallprompt` イベントをキャッチ → 標準バナーを
  preventDefault → `#fm-install` ボタンを fm-shell 下部に表示
- ユーザータップで `deferredPrompt.prompt()` 経由で OS のインストール
  ダイアログが出る
- `manifest.webmanifest` の `shortcuts` で Android ロングプレスメニューに
  Piano / Jazz / Lofi / Techno / Ambient の直接起動 URL を登録
- 各 shortcut は `fm.html?g=jazz` のような URL → fm.js boot で
  URLSearchParams をパースして起動時 GENRE pill を pre-select

### Listening trace overlay (debug)

`#fm-trace-btn` → `#fm-trace-panel` で現在の再生 snapshot を表示。
`listeningTraceSnapshot()` の戻り値を `formatTraceSummary()` で読みやすい
table 形式に整形。2 秒ごと auto-refresh。音には影響なし。

### 音楽的参照 (references/)

各 GENRE pill には**音楽的なリファレンス**を紐付けている。複製しない、
production parameter translation のみ:

- `references/apple-music-refs.json` — 全 18 アーティストの timbre / rhythm
  / space / structure / gesture 翻訳 (Aphex Twin / Boards of Canada /
  Burial / Brian Eno / Four Tet / Biosphere / Nujabes ...)
- `references/hazama-fm-pill-refs.json` — pill ごとに primary / secondary
  referencesを明示。すべての非ANY pillにprimary referenceがあり、曲の複製ではなく
  production axisだけをbuilder / presetへ翻訳する

```
pills:
  ambient → Brian Eno + Boards of Canada + Aphex Twin + Huerco S.
  lofi    → Nujabes (Aruarian Dance / Feather) [primary]
  techno  → Derrick May (Strings of Life) [primary]
  jazz    → Art Blakey (Moanin) + Bill Evans (Peace Piece) [primary]
  funk    → Funkadelic (Maggot Brain) [primary]
  piano   → Debussy (Clair de Lune) + Bill Evans (Peace Piece) [primary]
```

reference → builder への翻訳:
- `audio/genre-flavor.js` の builder 内で voicing / tempo / synth params
  に反映 (例: `addNujabesMemoryDots()` が Fmaj9 / Am11 / Dmaj9 / Bb7sus /
  Cmaj7add / Gm9 の jazz-hop voicing を lofi pill 専用の volume -24
  memory layer で peek させる)
- presets/*.json も対応する taste で codex に depth 増量を依頼する
  (例: drum-frames-lofi.json を 92 BPM / behind-beat snare で生成)

## 4. PWA architecture

```
manifest.webmanifest         ← Hazama FM (start_url=fm.html、ミントアイコン)
manifest-mixer.webmanifest   ← Music Core Rig (start_url=index.html、warm orange)
manifest-band-room.webmanifest ← Band Room (start_url=band-room.html)
sw.js                        ← 共通 Service Worker
  ├ /api/: bypass             (private Lyric Lab data; Functionsがno-storeを所有)
  ├ HTML: network-first       (deploy 即反映)
  ├ same-origin static/docs: cache-first
  ├ presets/*.json: stale-while-revalidate
  └ Tone / Magenta / pinned sample CDN: on-demand cache-first (opaque可)
icons/icon-*.png             ← Hazama FM (mint 同心円リング)
icons/mixer-*.png            ← Music Core Rig (orange 9-fader 放射状)
```

FM / Core Rig / Band Roomは3つのmanifestを持ち、対応browserでは用途別install候補になる。
実際のホーム画面 / standalone起動はdevice human checklistで確認し、repo現物だけで合格扱いしない。

## 5. 開発サイクル — autonomy control-plane

```
1. `docs/autonomy/STACK-INDEX.md` / LEDGER最新 / BACKLOG / 対象repoのAGENTSを読む
2. BACKLOGのagent-safe itemをclaimし、`status: wip`をcommit（共有docs更新前にpull）
3. 1 active implementer + read-only監査で、scopeとhuman gateを維持して実装
4. repo固有check + `node scripts/stack-check.mjs`を0 BADにする
5. itemをDoneへ移し、SESSION-LEDGERを先頭追記、差分を限定してcommit
6. in-scope / clean / mergeableならAGENTSの現行規約でpush / PR / merge。接続不能はlocalで止めて報告
7. runtime変更は必要なcache markerを同期し、browser / audio / mobile等のhuman gateを勝手に合格にしない
```

merge権限やprotected file境界はこの文書へ複製せず、常に`AGENTS.md`を正本とする。

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

### protected engine satellite seam（BL-037）

`index.html`と`fm.html`は、抽出済み5 satelliteをclassic `defer` scriptとして
同じ順序で`engine.js`より前に読み込む。Tone.jsもhost別の順序契約を持つ。
`index.html`ではclassic `defer`でsatellite群より先、`fm.html`ではblocking classicで
直後のinline `Tone.setContext(...)`より先に置き、その後にdeferred satellite群が続く。

```text
music-stack-routing → music-focus-modulation → music-recorder
→ music-packet → music-hazama-feedback → engine.js
```

satelliteはload時に`window.Music*` APIだけを公開し、engineのstate / helperはAPIを
呼ぶ時まで遅延参照する。`defer`は記述順を保つが、`async`化、`type=module`化、
engine先行への並替えはclassic-script global lexical seamを壊すため別の設計変更になる。

| satellite export | engineから遅延解決する主なdependency | harnessの実呼出し |
|---|---|---|
| `MusicStackRoutes` | なし（pure data / functions） | review cue + routing recommendation |
| `MusicFocusModulation` | `clampValue`, `focusModGain`, `isPlaying`, Tone LFO | enable / suppress / disable + LFO lifecycle |
| `MusicRecorder` | `recorderDestination.stream`, DOM / MediaRecorder | fake start / data / stop / download |
| `MusicPacketKit` | UCM / gradient / review / routing / recorder state / clamp | session + orchestra build / SYNC / download |
| `MusicHazamaFeedback` | Hazama / color / arc / feedback state | active postMessage + inactive no-op |

`scripts/check-music-satellite-contract.mjs`は5本をengine globalsなしの同一mock VMへ
先行loadし、その後`scripts/fixtures/music-satellite-engine-fixture.js`の明示的な47 bindingを
注入して上記APIを実呼出しする。comment内の偽tag / URLを除外してToneを含むHTML順、
SW一意収録、public API、実`engine.js`側のprovider / consumer member、missing dependencyと
optional browser fallback、timer / channel cleanupも検証する。
`engine.js`はtext markerを読むだけで**実行しない**。Tone / MediaRecorder / DOM / storage /
BroadcastChannel / timer / postMessageは同期fakeだけで、network・実audio・GPUを使わない。
このcontractは実browserのTone / MediaRecorder挙動、音質、試聴体験までは証明しない。
これはtest/docs追加なのでruntime markerは`fm-118`、SWは`hazama-fm-v395`のまま。
seam自体の変更やdependency object化は1 satellite単位の別human-gated PRで行う。

### Music host DOM seam（BL-043）

`config/music-host-dom-contract.json`は、共有engineと各hostのDOM境界を明示する
read-only契約である。全UI IDのsnapshotではなく、`engine.js` 64 ID、`fm.js` 56 ID、
`audio/genre-flavor.js` 1 ID、`audio/music-recorder.js` 3 IDから導いたconsumer seamを扱う。
Core Rigはrequired 60 / optional 5（union 65）、Hazama FMはrequired 76 / optional 31
（union 107）。requiredは現在そのhostが提供する機能面、optionalは別surface向けのguarded
probeで、source側がnull-safeでも現在ある機能面をoptionalへ弱めない。

`scripts/check-music-host-dom-contract.mjs`はHTMLをtreeとして解析し、IDの一意性・exact-case、
tag / input type、required / optionalの固定分類と双方向coverage、consumer scriptのbrowser-canonicalな
host別exact load（same-document path / classic / defer、async・nomodule・未管理SRIなし）を検証する。
FMの`body[data-page="fm"]`、hidden `#fm-engine-shim` 24要素、performance pad、energy / genre /
DJ setの親子・値・選択状態、progress直下span、range境界、select option、ARIA ID参照も契約に含む。
コメント、`script` / `style` / `template`本文の偽要素はDOMとして数えず、raw-text / double-escape、
plaintext / frameset、foreign namespace、table / select insertion mode、埋め込みCSP、disabled /
multiple selectもfail-closedで拒否する。

JavaScript側は4 consumerをtoken scanし、literal lookupのper-ID multiset、selector root、既知の
dynamic resolver、FMの`$` bindingと7 genre profileの9 fader domainをmanifestと双方向照合する。
lookupは件数だけでなくlive関数・引数・owner binding・loop / delegated-click用途まで結線し、dead code、
shadow binding、computed global、string timer、`eval` / `Function` / constructor chain、escaped
identifierによる補償を拒否する。101件の
negative fixtureは宣言一覧との完全一致も自己検証する。
`engine.js` / `fm.js` / audio consumerはtextで読むだけで実行・importせず、negative fixtureも
memory内の文字列変異だけを使う。実browserのlayout / interaction、Tone.js、音質・試聴までは
証明対象外で、runtime / HTML / SWは変更しないため`fm-118` / `hazama-fm-v395`を据え置く。

## 7. 運用ルール

| 項目 | 方針 |
|---|---|
| **engine.js 改変** | 原則禁止。Hazama FM 用の追加は fm.js / fm.css / audio/genre-flavor.js で吸収。例外は Core Rig と FM が共有する短い runtime cue API など、Music 全体の音響境界をそろえる最小変更のみ |
| **cache buster** | `?v=fm-N` を fm.html / sw.js の precache list で揃える。version 変えるたびに sw.js の `VERSION` も bump (`hazama-fm-vN`) |
| **sister repo の export** | sister repo内で完結。review後にMusicへvendoringし、browserはsame-origin local JSONだけを読む |
| **preset のpath** | `presets/foo.json`のpage/repo-relative path。loader.jsの`PRESET_FILES`で一元管理 |
| **branch / PR / merge** | `AGENTS.md`が正本。0 BAD・in-scope・cleanを確認した検証済みbranchはagent merge可 |
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
// → { started: true, genre: "piano", scheduled: 4, source: "chill-recipe:piano-jazz-chill+foreground-piano", role: "chill quiet piano memory", ... }

// FM 聴感レビュー用の metadata-only trace。
// genre dwell / switch 履歴だけで、音声・raw trace・自動PRは入らない。
window.HazamaFmListeningTrace.snapshot()

// SYNC packet 側にも metadata-only で入る。音声・sample・自動PRは入らない。
window.MusicSessionPacket.build().performance_state.hazama_fm

// FMで保存した聴感の次レビューcue。
// 例: techno -> "techno balance"、piano -> "piano foreground"
window.MusicSessionPacket.build().routing.openclaw.next_action.fm_review_cue

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
- engine.js コメント — protected live runtimeの各セクション説明（行数は固定しない）

## 10. Historical lineage — session feel & narrative (v36 → v53)

genre-flavor.js の上に積んできた「人間的なセッション感」の層。順序は浅い
表面 → 深い長尺構造。

### v36 — production governor
- **Richard D. James wrongness**: 1.2-3.5% 確率で velocity を 0.3x に dropout
- **D Angelo behind-beat**: snare/ghost に +2-7 ms 後ろ揺れ (per-pill amount)
- session_role (head/comp/break/recap/vamp) で break frames は末尾 25% velocity dip、recap は 1.12x lift

### v37 — Nujabes flute lead (lofi)
- FMSynth + 5.2 Hz vibrato LFO + breath noise sidechain + 8n. delay + hall reverb
- 7 modal phrases、4-bar window で 34% 確率で吹く

### v38 — mastering chain + UX
- Master EQ3 (low +1.2 / mid -0.4 / high +0.8 dB)
- Sidechain pump (techno 0.48 / funk 0.38 depth, kick-keyed duck)
- D'Angelo tape saturation parallel-wet (funk 0.7 / lofi 0.45)
- Per-pill flavor arc: warm-up 0-90s → peak 12min → cool-down
- Screen Wake Lock, time-of-day auto pill (ANY モード)
- Human review queue HTML が SYNC + listening trace を表示

### v39 — jazz acoustic upright bass + variation pass
- `makeAcousticBass()`: FMSynth body + brown noise thump + pink finger chiff + 50-cent pitch dive
- `WALKING_BASS_PATTERNS` keyed by session_role (Sam Jones / Paul Chambers feel)
- Jazz brush patterns 1→4 rotating
- Jazz comping voicings 4→10、broken/recap で 5-voice voicings
- Funk bass / clavi / EP も同じパターンで variation 化

### v40 — groove lock + tempo drift
- ドラマーの snare microMs 平均 → `groove.pushMs = pocket * 0.6` を全 melodic レイヤで共有
- 4-bar phrase curve (settle/lift/push/turn) を `groove.intensity` に乗せる
- Lead voice rotation: 4小節ごと bass→comp→drums→lead (call-and-response)
- Tempo micro-drift: jazz/piano ±1.5 BPM, funk 1.2, lofi 1.0, techno/ambient 0 (lock)

### v41 — per-genre kits + structure
- KIT_PAN_LAYOUT per profile (jazz/funk/lofi/techno で異なる pan)
- 8-bar phrase + 32-bar drop bar (Apple Music 的 quiet moment)
- Modal key shifts 64-bar (D → G → A → D dorian)
- Solo melodic layer (jazz sax / funk wah guitar / lofi muted trumpet)、leadVoice === "lead" 時のみ発話
- Funk sub bass (-1 octave sine on downbeat)

### v42 — mix polish (潰れ修正 + 人間的)
- Compressor relax: threshold -18→-10 dB / ratio 2.8→2.0 (ダイナミクス保持)
- Limiter -1.2→-0.8 dB ceiling
- Destination boost 4→6 dB、LEVEL_BY_GENRE +0.06
- `humanizeMs()` 非対称分布 70% slightly late / 25% on-grid / 5% pushed
- `backbeatLag()` ビート 2/4 に +4-8 ms (jazz/funk pocket)
- `peakShift()` 4小節最後の and-of-4 pickup で velocity ×1.18 + -3〜-6 ms (リズム跳ね)
- `isPhraseSilence()` 8小節フレーズ末尾 16th 無音 (息継ぎ)

### v43 — narrative drive (物語進行)
- **96-bar movement plan**: intro 8 → build 16 → peak 32 → break 4 → return 24 → outro 12
- 各 movement で `layerActiveInMovement()` がレイヤの入退場を制御:
  - intro: drums only first 4 bars → bass mid-intro → brush near end
  - build: brush full, clavi joins bar 4, comp joins bar 8 (delayed entry)
  - peak: full ensemble + solo speaks
  - break: all melodic silent — drum-only quiet
  - return: 全員復帰 + key shift active
  - outro: comp/ep/clavi first drop → brush → bass → 完
- `flavor.tension` 0-1 連続値: movement 内で線形上昇、UI / 将来の filter brightness に使える
- Stereo 更に広く (kit pan ×1.4): jazz hat -0.45 / funk clavi +0.45 など
- Destination boost 6→8 dB、LEVEL +0.04 (jazz 0.84, funk 0.82)

### v44 — DJ set mode (30-min cross-genre arcs)

`fm-dj-set` 行に 3 つのプリセット:

| 名前 | 流れ | BPM カーブ |
|---|---|---|
| **FOCUS 30** | piano → lofi → jazz → lofi → ambient | 62 → 108 → 70 |
| **DRIVE 30** | lofi → jazz → funk → techno → ambient | 80 → 130 → 78 |
| **NIGHT 30** | jazz → lofi → piano → ambient | 102 → 56 |

実装 (fm.js):
- `DJ_SETS` const: pill + energy + bpm range per segment
- `tickDjSet()` 1 秒間隔、`Date.now() - djSetStartTime` で wall-clock 経過分を計算
- BPM 線形補間 → `Tone.Transport.bpm.rampTo(target, 4s)`
- セグメント境界で pill + energy を自動切替 (既存 crossfade 経由)
- ユーザーが手動で pill を押すと DJ 解除 (override)
- 30 分完了で自動停止

### v45 — DJ background-tab hardening

Chrome / Firefox は最小化タブで setInterval を ≥1s に throttle、長時間で更に
間延びさせる。音声再生中は audio は止まらないが setInterval が間引かれる。

対策:
- DJ_TICK_INTERVAL_MS 1500 → 1000ms (gridに近い refresh)
- `bindVisibility()` の visibility return で `tickDjSet()` を即時実行
  → throttled 中に飛ばされた tick を 1 回で catch up
- BPM 計算は wall-clock ベースなので、throttle されても次の発火で正しい
  セグメント/BPM を導出

### v46 — DJ stability fix (BPM source contention)

DJ モード再生不安定の原因が 4 つの BPM ソース同時書き込みだったので解決:

| # | ソース | 動作 | 修正前 | 修正後 |
|---|---|---|---|---|
| 1 | DJ tick (1s 間隔) | curve target rampTo(4s) | active | active |
| 2 | Pill 切替時 applyGenreTempo | profile.bpm rampTo(0.65s) | active | DJ 中スキップ |
| 3 | startGenreTempoLock (900ms 間隔) | profile.bpm に snap し続ける | active | DJ 中起動しない |
| 4 | Tempo drift (12s 間隔) | base BPM ± range | active | DJ 中早期 return |

→ DJ 中は DJ tick のみが Tone.Transport.bpm を制御。Pill 切替は faders +
culture + genre-flavor crossfade のみ、BPM は触らない。

`stopDjSet({reason})` で終了時の挙動分岐:
- "user-pill" / "fm-stop" / "switch": tempo lock 再起動しない
- "user-stop" / "completed" / "user-toggle": 現在の pill の tempo lock 再起動

### v53 — Hazama FM parallel gain-staging repair

- `GenreFlavor` を full-mix processor ではなく `fm.html` 専用の parallel
  color layer として再固定
- output follower を 0.34〜0.96 に抑え、`LEVEL_BY_GENRE` を 0.46〜0.66
  に再調整
- compressor / EQ / makeup / limiter を guardrail 目的に戻し、limiter 常時突入を避ける
- piano の Debussy memory tail、jazz/funk/lofi solo、session breaks、
  sidechain pump、tape saturation の積み上がりを薄くして、詰まりと潰れを減らす
- `fm.js` は engine OUTPUT 88 / `Tone.Destination.volume = 0 dB` を維持

### Music Core Rig との同期状況

| 層 | 共有 | 説明 |
|---|---|---|
| engine.js (Radio Brain / 9 programs / Longform Arc / UCM faders) | ✅ | Core Rig と FM が同じ engine.js を load |
| presets/*.json | ✅ | 両アプリで利用可 |
| genre-flavor.js (acoustic bass / kit pans / master EQ / groove lock / 物語進行) | ❌ | fm.html のみ load。Core Rig は素の engine 出力 |
| GENRE pill UI | FM 専用 | Core Rig は UCM 9-fader manual |

Core Rig に flavor を載せるなら:
1. `index.html` で `<script src="audio/genre-flavor.js?v=fm-43" defer></script>` 追加
2. オプション: 小さな flavor pill UI を追加 (ANY/JAZZ/FUNK/...) で `window.GenreFlavor.setGenre(name)` を呼ぶ
3. Core Rig の UCM mix と flavor layer が並行で鳴る (mastering chain は別)

判断: Core Rig は manual mix workflow なので flavor 同期は **opt-in feature** として残すのが
無理ない。フェーダー触っている時に裏で flavor が勝手に変化すると操作感が混乱する。

## 11. Band Room (band-room.html) — Tabasco stems + HAZAMA synth lane

Hazama FMとは別ページ。`band-room.html`は2つのlaneを同じplay surfaceに載せる。

- Tabasco: 既存LIVE録音の4-stem原音、歌い直し、AI再現を比較するlane。
- HAZAMA: 01/02とも原音4-stemとAI再現を比較するlane。`?band=hazama`は原音を既定選択し、
  `song` / `mode` queryで4ケースへ直接入る。02 AIは01 frames共有の暫定版
  できるが、main selectorでは`ui_hidden`。通常公開の合格はBL-041 human gate。

利用者の最短導線は`listen.html` → HAZAMA → Lyric Lab。詳細操作は
`BAND-ROOM-MANUAL.md`、用途別レシピは`BAND-ROOM-USAGE.md`を正本とする。

### 機能まとめ

| 機能 | 状態 |
|---|---|
| 4-stem 分離 (vocals/drums/bass/other) Demucs htdemucs | ✅ Tabasco 7 + UNRIPE 6 |
| stem playback via Tone.Player + 個別 mute/vol | ✅ |
| Master remaster chain (compressor + EQ3 + widener + reverb + limiter) | ✅ |
| Vocal FX (chorus/echo/reverb) | ✅ stem + external + phrase 共通 |
| 原音 / AI 再現 モード切替 (radio) | ✅ |
| AI synth drum-floor (per song frames + chord progression + section) | ✅ 7 曲 |
| Drum kit source 切替 (Tone.Player 化、6 UNRIPE kit) | ✅ v62 |
| External vocal upload (Suno or 自録) | ✅ v63 |
| Vocal phrase trigger (240 phrases click) | ✅ v64 |
| 全 7 曲歌詞 (proper English v2.1) | ✅ |
| HAZAMA 01/02 原音/AI導線 / dense AI safe START / fail-closed START | ✅ v399（実音昇格はBL-041） |

### ファイル構成

```
band-room.html / .css / .js                    # standalone (no engine.js / genre-flavor.js)
presets/bands.json                             # band registry (UI に出すバンド一覧)
presets/drum-frames-tabasco-{songid}.json      # 7 曲分 song-track (intro→verse→chorus→...)
presets/tabasco-songs.json                     # 7曲の派生inventory（runtime非消費 / SW非precache）
presets/tabasco-stems/{songid}/{stem}.mp3      # grandfathered Tabasco stems
presets/unripe-stems/{songid}/{stem}.mp3       # grandfathered UNRIPE stems
presets/sample-kits/{src}/{song}/              # 抽出済サンプル
  ├ {kick,snare,hat,crash}-NN.wav             # drum hits (8 each)
  └ vocal-phrase-NN.wav                       # vocal phrases (top 20)
docs/tabasco-lyrics-final.md                   # 全 7 曲歌詞 final singable
docs/BAND-ROOM-USAGE.md                        # ユーザー向け使い方
docs/VOCAL-REGENERATION-PATH.md                # Suno workflow
docs/BAND-ROOM-ADD-BAND.md                     # 新バンド追加手順
docs/STEM-REUSE-PATH.md                        # Phase B/C 流用設計
scripts/_separate_band.py                      # Demucs 4-stem 切り出し
scripts/_slice_drum_hits.py                    # drum sample 抽出
scripts/_slice_vocal_phrases.py                # vocal phrase 抽出
scripts/_recompress_stems.py                   # 192→96 kbps 再エンコ
scripts/_copy_stems.py                         # raw Demucs → repo へ
scripts/_gen_tabasco_songs.py                  # song-track JSON 生成
```

### Tabasco data authority

| データ | 正本 / role | runtime | 検証 |
|---|---|---|---|
| 曲ID・順序・title・catalog duration | `presets/bands.json` | Band Roomがfetch | Band Room gate + catalog gate |
| BPM・key・構成・frame | `drum-frames-tabasco-{songid}.json` 7件 | Band Roomがfetch | catalog gate |
| canonical / synth / fallback歌詞 | `docs/tabasco-lyrics-final.md` | Band Roomがfetch | Band Room gate + catalog gate |
| stems karaoke行 / 時刻 | `docs/tabasco-lyrics-timed.json`（ASR由来・5曲） | 原音modeで任意fetch | Band Room gate |
| 横断一覧 | `presets/tabasco-songs.json` v2（派生inventory） | **読まない** / SW非precache | catalog gate |

派生inventoryのBPM / keyはruntime値の索引であり、人耳確認済みの主張ではない。
全7曲を`human_unverified`に保ち、確認値の昇格は別のhuman reviewで行う。
音源のownership / license / grandfather範囲はこのinventoryで決めず、BL-035のowner契約に残す。
`scripts/check-tabasco-songs-catalog.mjs`が正本との差、禁止絶対path、legacy placeholder、
frame / lyrics欠落、runtimeやprecacheへの誤接続をnetworkなしで拒否する。
`bands.json`の`duration_s`はcatalog宣言尺で、実効再生尺はloaded stem bufferと
frame構成尺も含む最大値をBand Room runtimeが選ぶ。

### 主要 commit 履歴

- v50 band-room.html 新設 + Human Fly 動作
- v51-52 UNRIPE 疾走感 + flute + 物語進行
- v53-55 全 7 Tabasco 曲 song-track JSON + chord progression
- v56 Demucs 4-stem 分離 + stem playback
- v57 space 補正 (reverb + stereo widener)
- v58 band-aware refactor (bands.json registry)
- v59 vocal FX chain + UI scope 明示
- v60-61 UNRIPE 取り込み + 96 kbps 再エンコでサイズ半減
- v62 Sample Kit mode (drum-floor の音色を UNRIPE 本物 sample に差替)
- v63 vocal phrase slicing + 歌詞 v2.1 + external vocal upload
- v64 vocal phrase trigger UI + 使い方 doc

### Band Room と Hazama FM の関係

| 観点 | Hazama FM | Band Room |
|---|---|---|
| 性格 | 24/7 generative focus radio (Apple Music の Claude FM 的) | 特定の歌を再生 + 練習 + リバイバル |
| 元データ | 9 番組 × 7 GENRE × 物語進行 | Tabasco stems / song tracks + HAZAMA synth song track |
| エンジン | protected engine.js + genre-flavor.js | Tone.js standalone（engine.js非依存） |
| 共有 | Tone.js, master mastering 思想 | engine.js も genre-flavor.js も使わない |
| URL | `/Music/fm.html` | `/Music/band-room.html` |
| PWA | manifest.webmanifest (Hazama FM) / manifest-mixer.webmanifest | manifest-band-room.webmanifest |

Band Roomはengine.js / genre-flavor.jsのprotected monolithと分離したjam appとして
独立進化させた。Hazama FM の mastering chain ノウハウ (compressor + EQ3 + limiter
スペック) は band-room.js master 構築時に再利用。

## 12. Repo roles — Code-as-Agent-Harness lens

Inspired by *Code as Agent Harness* (arXiv:2605.18747, 2026-05)。コードは
単なる出力ではなく、AI エージェント（Claude / Codex / ChatGPT セッション）が
推論・行動・検証する operational substrate でもある、という見方を
music-stack の既存配置に重ねたもの。**現状の運用に名前を付けただけ**で、
ランタイム挙動の変更は無い。

- **Music** — primary harness. Reference-driven generative rig、UI、recorder、
  MIC FOLLOW、session packet、mode-change hooks。多くの agent action が着地する場所。
- **drum-floor** — groove specialist. Music の groove intent を phrase /
  articulation / pattern に翻訳し、JSON で export。
- **namima** — public ambient specialist. Music の mood intent を family-safe
  ambient に翻訳し、JSON で export。
- **chill** — quiet piano surface. piano-jazz-chill recipe を JSON で export。
- **openclaw** — review hub / mission board. Human-gated promotion、cross-repo
  review queue。自動 executor ではない。

協調は **JSON sidecar による metadata-only**（`presets/SCHEMA.md`）。
外部 / 内部 harvest は **AGENTS.md Hard Rule 6（非干渉）** に従う ——
sidecar → adapter → feature-flagged runtime → 人の試聴/preview → 昇格、の順。

`namima-lab` / `test`はarchive / harvest-only。外部`hazama`はreferenceでありactive repoでは
ないが、`presets/bands.json`のHAZAMA bandとは別物なので混同しない。並走する複数sessionは
**multi-agent harness coordination**として動く。共有ファイルは編集直前pull、衝突時は
rebase後に意味を手動統合して全checkを再実行し、版番号だけで勝者を決めない。
