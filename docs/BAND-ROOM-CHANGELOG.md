# Band Room — Changelog (v65 → v171 compact)

Cache marker: `band-room.{html,js,css}?v=br-NN` and `sw.js VERSION = hazama-fm-vNN`.
The two are bumped together — sw VERSION matches the band-room generation it ships.

Note: v113 以降は **Hazama FM 側の修正も含む** ので変更が `engine.js?v=fm-NN`
も bump する。

---

## v171 compact — Band Room PWA + mobile screen-lock hardening

- `band-room.html`: Band Room 専用 `manifest-band-room.webmanifest` と
  `apple-touch-icon` / app title を追加。ホーム画面 install 時の standalone
  起動を Hazama FM / Music Core Rig と揃えた。
- `band-room.js br-86`: iPhone / mobile browser の screen lock / blur / freeze /
  pagehide で複数回の panic release を走らせる。画面を閉じる瞬間に attack 済みで
  release が取り残される単音ループを減らす。
- catalog sampler wrapper に `releaseAll()` / `triggerRelease()` を追加し、
  electric bass / guitar / sampled chord 等も suspend panic の対象にした。
- `sw.js hazama-fm-v171`: Band Room manifest と `band-room.js?v=br-86` を precache。

## v170 compact — Hazama FM / Music Core Rig bassline director

- `engine.js fm-84`: shared engine に phrase-level bassline director を追加。
  4〜8 bar ごとに bass gate / interval walk / ghost push を切り替え、main synth
  bass が固定 root loop に張り付かないようにした。
- lofi Salamander bass と dub electric bass も同じ director を共有し、
  `root / 5th / octave / 5th` や `root + octave skip` の固定 bar を解消。
- runtime diagnostics は `window.MusicRuntimeState.basslineDirector` に pattern /
  gate / phraseBars を出す。
- `sw.js hazama-fm-v170`: `engine.js?v=fm-84` を precache。

## v169 compact — Hazama FM melodic director

- `engine.js fm-83`: Hazama FM に phrase-level melodic director を追加。
  8〜16 bar ごとに key center / contour / chord turn を変え、固定的な
  `D / F# / G / E` 断片の反復感を減らす。
- `tonalRhymeIndex()` は pool length を受け取り、6/10 音 pool も偏らず使う。
  `voiceFragment()` / `randomHazeChord()` / `randomChordForMode()` / bass root は
  director 経由で phrase-aware に変化。
- runtime diagnostics は `window.MusicRuntimeState.melodicDirector` に key /
  contour / phraseBars を出す。
- `sw.js hazama-fm-v169`: `engine.js?v=fm-83` を precache。

## v168 compact — saved mix migration + closeout

- `band-room.js br-85`: v167 の default mix polish を既存ユーザーにも反映するため、
  localStorage に残った v166 系の旧 default slider 値だけを新 default へ自動移行。
- 手動で変えた slider 値は維持し、旧 default と完全一致する値だけ更新する。
- 保存 prefs に `mixPrefsVersion` を持たせ、次回以降は同じ migration を繰り返さない。
- `sw.js hazama-fm-v168`: Band Room の新 script marker を precache。

## v167 compact — default mix polish

- `band-room.js br-84`: master headroom を広げ、limiter threshold / 2 段 comp /
  broad EQ / stereo width / tape send / room reverb を控えめに再調整。
- stem EQ は低域の濁りと高域の刺さりを抑え、vocal de-ess と vocal FX send も
  少し乾いた位置へ。原音 stems は limiter に張り付きにくい default gain に変更。
- AI 再現は source-derived agents の密度に合わせて drums / bass / guitar /
  vocal guide / chords の bus default を下げ、前後感と長時間 listening を優先。
- vocal FX / external vocal / click / master dry path は HTML slider と実 bus の
  初期値を揃え、初回操作で音量や空間が跳ねないようにした。
- 4-stem pack recorder tap は stem bus 構築後に接続し、export が `0/4 streams`
  にならないようにした。
- master presets も neutral / lo-fi / club / rock / ambient を全体に控えめな
  loudness / width / warmth へ再調整。
- `sw.js hazama-fm-v167`: Band Room の新 script marker を precache。

## v166 compact — source-derived AI part agents

- `band-room.js br-83`: AI 再現の bass / guitar / vocal guide / chords を
  source-derived part agent 化。原曲 drum-frame の kick / snare / hat /
  ghost / crash、section role、chord progression を読んで各パートが別々に
  自律 pattern を組む。
- bass は kick pattern に同期し、ghost / recap / comp で pickup を足す。
  guitar は source accent と hat density で palm mute / 16th drive / bridge
  stab を切り替える。vocal guide と chords は phrase end / ghost answer /
  section pressure に応答する。
- AI 再現の初期音色は `bass-electric` / `guitar-electric` sampler を優先し、
  online catalog が使えない場合は既存 synth fallback に戻る。
- `sw.js hazama-fm-v166`: Band Room の新 script marker を precache。

## v165 compact — ordinary song timeline / seek

- `band-room.html` / `band-room.css br-73` / `band-room.js br-82`: START 下に
  elapsed / duration の `m:ss` 表示と seek bar を追加。
- 停止中に seek した位置を `pendingSeekOffsetSec` として保持し、次の START は
  その地点から開始。STOP も現在位置を保持する。
- 再生中の seek は Transport / section display / lyrics highlight / 原音 stems /
  external stems を同じ offset に揃え直す。
- `sw.js hazama-fm-v165`: Band Room の新 cache marker を precache。

## v164 compact — Chill Session visible route

- Music Core overview に `Chill` 入口を追加。
- chill 側の session copy も metadata-only / human START 境界を明示し、
  Music Stack 内の導線を整理。

## v163 compact — offline-safe lyrics and handoff copy

- `sw.js hazama-fm-v163`: cache-busted `presets/*.json` and `docs/*.md`
  requests now fall back to the precached bare URL with `ignoreSearch`, so
  Band Room can load drum frames and `docs/tabasco-lyrics-final.md` offline
  even when runtime fetches include `?cb=...`.
- `band-room.html` / `band-room.js br-81`: Band Room ships a fresh script
  cache marker and labels the Drum Floor link as manual preview / metadata-only
  handoff.
- `docs/tabasco-lyrics-final.md`: tightened `Human Fly` so it keeps the same
  meaning as the one final sheet while avoiding duplicate `Hey` imagery and
  mixed-language chorus copy.
- Music Core overview, SYNC docs, and Drum Floor return copy now expose the
  Band Room / Drum Floor route as human-started preview rather than automatic
  playback.

## v162 compact — final singable lyrics

- `docs/tabasco-lyrics-final.md`: Tabasco 7 曲の候補歌詞を一本化し、
  Band Room にそのまま表示できる歌える final sheet として整えた。
- `presets/bands.json` / fallback registry: `lyrics_doc` を final sheet に変更。
  Band Room 本体は draft / cut-up / syllabic 候補を並べず、一本だけ表示する。
- `band-room.html` / `band-room.js br-80` / `sw.js hazama-fm-v162`:
  footer の歌詞リンクも `final singable` に絞り、cache を更新。

## v161 compact — Band Room full-song playback + iPhone suspend recovery

- `band-room.js br-79`: 原音モードの auto advance を、section structure 終端ではなく
  loaded stem / catalog `duration_s` の full-song duration まで待つように修正。
  `Hey` など structure JSON が実曲より短い曲でも途中で次曲へ進まない。
- `band-room.js br-79`: iPhone / mobile Safari の background suspend から戻った時に
  AudioContext / Transport / stem offset を復旧し、stuck single-note を release する
  playback watchdog を追加。
- `band-room.css br-72`: hidden media bridge の `rearming` state を route pill に反映。

## v160 compact — FM route diagnostics + rearm

- `engine.js fm-82`: hidden audio bridge の診断 state を `window.MusicBackgroundBridge`
  に公開し、loss / failed / rearm attempt / output route を snapshot できるようにした。
- `fm.html` / `fm.css fm-50` / `fm.js fm-64`: route badge を押すと診断 panel が開き、
  current route / bridge event / output / AudioContext を確認しつつ `rearm` できる。
- bridge loss 時は direct 出力へ戻したまま、iOS Safari 推奨環境では短い backoff で
  hidden bridge を自動 rearm する。

## v159 compact — FM to Drum Floor handoff

- `fm.html` / `fm.js fm-63`: Hazama FM に `drum floor →` を追加。
  クリック時に shared Music session packet を metadata-only SYNC し、同時に
  `from=fm&g=...&energy=...&bpm=...` query fallback を付けて drum-floor を開く。
- `engine.js fm-81`: FM genre / energy / BPM / dwell / review cue を
  `routing.drum_floor.hazama_fm` と `routing.drum_floor.bpm` に載せ、drum-floor
  側が手動preview候補を作りやすくした。
- drum-floor sister repo main: `from=fm` query fallback と stale packet guard を追加。
  Band Room 由来 packet は song だけでなく section / BPM も見て古い SYNC を弾く。
- 運用 docs: user が「全mergeで締めて」と指示した turn は、検証済み PR / branch
  を main に merge・pushし、merged branch を削除してから final する。

## v158 compact — Hazama FM route badge

- `fm.html` / `fm.css fm-49` / `fm.js fm-62`: Hazama FM に `off` /
  `direct` / `ready` / `bridge` / `failed` の audio route badge を追加。
  engine.js の hidden `background_value` を MutationObserver で読み、車載 /
  Bluetooth 確認時に bridge 経由か direct 出力かを見える化する。
- `scripts/check-fm-route-badge.mjs`: FM route badge の DOM / CSS /
  `background_value` 同期ロジックを静的検査。`check-js.mjs` にも追加。

## v157 compact — Drum Floor return song links

- `band-room.js br-78`: `band-room.html?from=drum-floor&song=...&band=...`
  を受け取り、通常 reload は 01 start のまま、Drum Floor から戻った時だけ
  source song を開く。
- `scripts/check-band-room-logic.mjs`: Drum Floor return query が `from=drum-floor`
  に限定され、saved prefs が last song を復元しないことを静的検査。
- drum-floor sister repo 側は PR #50 merge 済み。return links / query fallback は main に入っている。

## v156 compact — visible FM / Band Room handoff

- `fm.html` / `fm.js fm-61` / `fm.css fm-48`: Hazama FM に `band room →`
  導線を追加し、現在の FM genre を `band-room.html?from=fm&g=...&pattern=...`
  に反映。クリック時は既存 localStorage suggestion も更新する。
- `band-room.html` / `band-room.js br-76` / `band-room.css br-71`: FM deep link
  の `pattern` query を localStorage suggestion より優先して読み、stems mode
  初期表示でも小さな `FM suggests ...` CTA を出す。`inject` はユーザー操作時のみ。
- Band Room footer の Hazama FM link も、inject 済み pattern から近い FM genre
  (`lofi` / `jazz` / `techno` / `funk`) へ戻れる query link に更新。

## v155 compact — Band Room to Drum Floor handoff

- `band-room.html`: footer の別 app 導線に `Drum Floor` を追加。
- `band-room.js br-75`: 現在の Band Room song / BPM / section / drum frame を
  metadata-only の `qb:music-stack:latest-packet:v1` と `qb:music-stack:v1`
  に publish してから drum-floor を開く。drum-floor 側の既存 Music SYNC
  receiver が拾える形式で、音声・sample・lyrics は入れない。
- `scripts/check-band-room-logic.mjs`: handoff が `drum_floor` 推奨、
  manual start required、metadata-only のままかを静的検査。

## v154 compact — louder browser playback

- `fm.js fm-60`: Hazama FM の起動時 OUTPUT target を 75 → 88 に上げ、
  ブラウザ/車載で OS 音量を最大付近まで上げなくても聴ける基準に変更。
- `engine.js fm-80`: Music Core Rig / Hazama FM 共通の OUTPUT gain curve を
  少しだけ前へ出し、default OUTPUT も 88 に更新。limiter は guardrail のまま。
- `audio/genre-flavor.js fm-69`: FM の parallel flavor layer も OUTPUT に
  追従して少し前へ。piano / ambient も隠れすぎないように調整。

## v153 compact — car/lock-screen album transport

- `band-room.js br-74` / `band-room.css br-70`: Media Session `nexttrack` / `previoustrack` を
  section 移動から song 移動へ変更。車載/ロック画面の曲送りが 01 → 02 →
  03... の album flow と一致する。狭幅でも route badge を `B` / `D` / `F` で表示。
- 手動 track click / band switch / 自動曲送り中は、再生中なら hidden media
  bridge を維持してから曲を差し替える。車載/Bluetooth route が手動操作の
  曲間でも落ちにくい。
- `engine.js fm-79`: Hazama FM / Music Core Rig の hidden media bridge に
  health fallback を追加。bridge が pause/error/ended した時は direct output を
  復帰し、stale-silent を避ける。`setSinkId` 失敗時も default sink で継続。
- Band Room logic check に first/adjacent song ordering と Media Session
  album transport の静的検査を追加。

## v152 compact — album-flow default playback

- `band-room.js br-73`: reload 後の default track を 01 `TABASCO` に戻し、
  localStorage の前回 song 復元は廃止。sound/editing prefs は引き続き保持。
- 曲末は同じ曲の structure / stems loop ではなく、次 track へ auto advance。
  01 終了後は 02 `Hey`、以降 set list 順に進む。最後の曲だけ停止。
- 自動曲送り中は hidden media bridge を維持して、車載/Bluetooth の route が
  曲間で落ちにくいようにした。

## v151 compact — audit gate + car bridge hardening

- `scripts/audit.py`: `index.html` も含め、HTML の versioned asset URL と
  `sw.js` precache URL を path 単位で照合。precache local file existence と
  `sw.js VERSION` の release-doc 同期も検査。
- `band-room.js br-72` / `band-room.css br-69`: hidden media bridge を user gesture
  window 内で先に開始し、bridge loss 時は direct output に復帰。master volume bar
  は sticky 化し、narrow mobile の overflow を抑制。
- `fm.js fm-59`: engine start failure を playing 扱いしない。warmup 中 STOP を許可し、
  genre profile の遅延 fader writes に sequence guard を追加。
- `engine.js fm-78`: 40Hz focus AM の gain param base を修正し、focus ON で
  master gain が二重加算されないようにした。
- `band-room.js br-72`: `chordRoot("C")` が `G2` に落ちる bass-root fallback を修正。

## v150 compact — route status + focus event quieting

- `band-room.css br-68` / `band-room.js br-71`: master volume bar に
  `direct` / `bridge` の audio route status を追加。hidden media bridge が有効な時は
  `bridge` と表示され、車載/Bluetooth 確認時に状態を見られる。
- `engine.js fm-77`: 40Hz focus mode の UI event dispatch を状態変化時に限定。
  focus monitor が 500ms ごとに同じ `music-focus-mode-state` を投げ続けない。
- `fm.js fm-58`: 車載/BT の media key volume 操作が fade in/out promise を
  詰まらせないようにし、Media Session metadata と session save の重複更新を抑制。
- `band-room.js br-71`: master volume `0` の reload 復元と Media Session handler
  登録の個別 fallback を修正。

## v149 compact — 車載/BT・genre handoff・runtime hygiene

- `band-room.js br-70`: master volume bar と `br-loudness` を乗算関係に修正。
  車用の 0-100 音量と mastering loudness が互いに上書きしない。
- `band-room.js br-70`: Hazama FM が suggestion を clear した時、Band Room の
  genre picker status も stale 表示を消す。
- `sw.js hazama-fm-v149`: Band Room の `audio/audio-safety.js?v=br-66` を
  precache に追加。

## v145-v146 compact — Band Room car audio bridge + FM genre suggestion

- v145: Hazama FM で効いていた hidden `<audio srcObject=MediaStream>` bridge を
  Band Room に移植。WebAudio final mix を HTMLAudioElement 経由にも流し、
  iOS Safari / 車載 Bluetooth で通常メディア音声として扱われやすくした。
- v146: trap / soul-funk genre pattern を追加。Hazama FM の genre pill から
  Band Room の genre picker へ suggestion を渡す。自動 inject はせず、
  ユーザーが Band Room 側でタップして適用する。

## v141-v144 compact — car volume controls

- v141: header 直下に master volume bar を常時表示。`- / +` は 5 刻み。
- v144: Media Session の `seekbackward` / `seekforward` を master volume の
  down/up fallback として扱う。

## v115 — Hazama FM lofi 完全 piano trio + breakbeat 化

- `engine.js fm-58`: Hazama FM lofi mode で bass / drum も sampler に置換
- `lofiBassSampler`: Salamander Grand Piano 低オク (A0–C3)、walking pattern
  (root/5th/oct/5th)、bassBus 経由、毎 1 小節
- `lofiDrumSamples`: tone-breakbeat の kick/snare/hat 3 ショット、drumBus 経由、
  boom-bap pattern (kick on 1 + sync 3.5、snare 2/4、hat 8th)
- updateSoundForMode の lofi クリーンアップ拡張 (bass.volume も復元、新 layer
  の stop 含む)
- 既存 synth pad/bass は -28/-26 dB に減衰 (二重発音防止)
- 3 app で「lofi = Salamander piano trio + breakbeat」が完全成立
- USAGE-HAZAMA-FM / USAGE-MUSIC-CORE-RIG / FREE-SAMPLES-AND-SYNTHESIS doc 更新
- CROSS-APP-INTEGRITY の lofi 整合表を v115 状態に更新

## v114 — Hazama FM デフォルト最適音 + 全 mode mix profile polish

- `engine.js fm-57`: HAZAMA_FM_ENGINE_MIXES を 6 mode 全て調整
  - lofi: padBus 0.38 → 0.30、glassDb -8.5 → -16、voiceDustDb -8.5 → -16
    (Salamander piano を前面に、装飾 noise 大幅減)
  - ambient: padBus 0.8 → 0.65、textureDb -3.5 → -6、delayWet 0.18 → 0.16
    (静か系で delay 不要)
  - jazz / funk / techno / piano も同様にバランス調整
- lofi mode の synth pad osc を triangle → sine (Salamander の支え役に)
- lofi mode の synth bass を warm triangle + slow filter env (walking 寄り)
- globalReverb decay 5.5 → 3.6 (short room reverb、piano に自前 decay)
- Salamander piano sampler の volume -6 → -10、release 1.6 → 2.0
- scheduling を 1m → 2m (chord stab + 0.5 拍遅れ accent note = anticipated comp)

## v113 — Hazama FM lofi 整合化 (cross-app)

- `engine.js` の lofi mode で **Salamander Grand Piano (CC-BY)** sampler を
  pad 役で起動するレイヤー追加 (fm-56)
- 既存 synth pad は -22 dB に減衰、reverb/delay wet も穏当に (lofi = ノイズで
  覆うじゃなく実音色で表現する band-room と同じ哲学に揃える)
- `CROSS-APP-INTEGRITY.md` 新規 — 3 app + engine.js + catalog の境界 / 機能
  対応表 / リソース共有マップ / 整合性チェック結果

## v112 — catalog manual + jazzy bass/chord voicing

- `SAMPLE-CATALOG-GUIDE.md` 大幅拡張: nbrosowsky 全 instrument リスト、search
  クエリ集、NSynth strings 追加チュートリアル、license フローチャート、
  validation script outline、既知 resource roundup
- bass walking pattern (root/5th/oct/5th) — profile = lofi-nujabes or
  bass_instrument = salamander-bass のとき
- chord jazzy voicing (maj7/m7 + anticipated comping on beat 2.5) —
  profile = lofi-nujabes or chord_instrument = salamander-piano のとき
- `chordToSemi(chord)` helper 追加

## v111 — AI 音色再現を sampler でやり切る

- catalog に **9 新 instrument** 追加 (nbrosowsky/tonejs-instruments、MIT、
  guitar-electric/acoustic/nylon, bass-electric, violin, cello, flute,
  organ, harp)
- `makeGuitar` / `makeVoiceBox` を sampler 分岐対応
- UI: "guitar instr" + "melody lead" selector 追加
- `state.guitarInstrument` / `state.voiceInstrument` 永続化
- MASTER_PRESETS が 7 軸 linked (master 4 sliders + synth profile +
  chord/bass/guitar/voice instrument + kit_source + guitar_on)

## v110 — bass to real Salamander samples + master preset 全リグ駆動

- catalog に salamander-bass (Salamander の低オク抜粋) 追加
- `makeSynthBass` を sampler 分岐対応
- UI: "bass instr" selector
- MASTER_PRESETS に kit_source / bass_instrument / guitar_on linked

## v109 — dual-audio バグ修正 + Nujabes synth profile + linked master presets

- `jumpToSection` が mode 確認なしで stem を start してた問題修正
- mode change handler に hot-swap 追加 (mode 変更で audio graph 切替)
- KIT_PROFILES に `lofi-nujabes` 追加 (dusty drum + warm bass + soft pad +
  warm vocal)
- MASTER_PRESETS に synth_profile + chord_instrument linked 追加
- lo-fi master sliders 穏当に (reverb 38→32, width 50→64, warmth 32→24)

## v108 — bass anchor for no-chord sections + SW doc precache

- chord_progression が無い section (Human Fly intro/outro 等) で bass が
  rest だったのを song key root の whole-note anchor に fallback
- sw.js PRECACHE_URLS に v103+ で追加した docs (MANUAL / CATALOG-GUIDE /
  DAW-INTEGRATION / FREE-SAMPLES-AND-SYNTHESIS / REPO-MANAGEMENT / burroughs lyrics)
  を全部追加 → オフラインでもマニュアル開ける

## v107 — index-aware lyric highlight + 4-bar drum fill

- `updateLyricsHighlight` に index-aware fuzzy step を挿入 — verse-1 と verse-2 で
  別の lyric block にハイライト (v3 Burroughs marker 対応)
- 各 section の 4 bar 目 (intro/outro 除く) で tom/snare の fill — 16th × 4
  rising velocity (0.42→0.72) で groove に呼吸を入れる

## v106 — universal vocal + sparse drum reinforce + section crash

- vocal guide が Human Fly chorus 限定だったのを全曲全 section (verse/recap/comp)
  に展開 — chord 4-step walk (root/3rd/5th/3rd)、4 bar 目は root sustain
- sparse frame (events < 6) の bar に kick/snare 基本 4-on-floor を低 velocity で
  補強 — 既存 events を覆わず空きビートだけ埋める
- section transition の chorus/bridge/outro/chant-b 頭で drumKit.crash 発火
  (vel 0.62、2分音符) — lift 感

## v105 — Hey verse-2 半端なドラム問題の root cause + bulk toggles

- `chord_progression` キーの形式 mismatch ("verse-1" vs "verse"): 6/7 曲が
  フル名キー、band-room.js は base 名で引いてた → bass/chord/guitar 全部 rest
- Fix: `cp[sec.section] || cp[baseSection]` で full-first / base-fallback
- AI 再現 + 原音 stems 両方に `all on / all off / defaults / karaoke` バルクトグル

## v104 — AI mode usability + section nav clarity

- AI synth toggles の default OFF → drums/bass/guitar/voice/chords を checked に
  (click だけ OFF)
- bus levels 再調整: drums 0.75→0.62, bass 0.65→0.72, voice 0.40→0.56, chord 0.55→0.68
- chord PolySynth -16 → -12 dB、vocal AMSynth -10 → -14 dB
- `jumpToSection` で停止中なら `startPlayback({ preservePosition: true })` 自動発火
- help overlay に section nav の挙動を追記

## v95 — A/B state compare snapshots

- `captureSnapshot()` / `restoreSnapshot()` round-trip all sliders, toggles,
  mode, kitSource, kitProfile through dispatched input/change events
- Two slots (A, B); recall buttons enable when slot is populated
- New <details> "🔀 A/B compare (2 snapshot 即切替)"

## v94 — free-808 scaffold (CC-0 dirt-samples drop-in slot)

- `presets/sample-kits/free-808/README.md` with TidalCycles dirt-samples
  source instructions, file naming contract, manifest.json template
- ~600 KB once filled; not yet in KIT_OPTIONS (user adds after dropping in)

## v93 — master mix preset chips (lo-fi / club / rock / ambient)

- `MASTER_PRESETS` writes to 4 master sliders + dispatches input events
- 5 one-click vibes: neutral / lo-fi / club / rock / ambient
- Chip row in 🌌 mastering panel, .active highlight

## v92 — voice profiles extended (bass / chord / vocal)

- `KIT_PROFILES` each entry now has bass/chord/vocal dicts
- `makeSynthBass / makeChordSynth / makeVoiceBox` consult `currentProfile()`
- Profile change → dispose + rebuild all 4 synth voices (drum/bass/chord/vocal)
- Sakanaction: bright snappy bass, saw stab chord, clean vocal
- LCD motorik: sub-y bass with portamento, dreamy triangle pad, breathy vocal
- Cramps punk: distorted slap bass (drive 0.18), square stab chord, snarled vocal

## v91 — synth kit profiles (Sakanaction / LCD / Cramps punk)

- `KIT_PROFILES` table: 4 presets (default / sakanaction / lcd-motorik / cramps-punk)
- `makeDrumKit(target, profileName)` reads from profile dict for each voice
- UI: "🥁 drum kit source + synth profile" with 2 selectors
- Persisted via v78 prefs alongside kitSource

## v90 — stems pack export (4-stem simultaneous → DAW)

- 4 `Tone.context.createMediaStreamDestination()` tapped off each stemBus
- 4 `MediaRecorder` started/stopped together; STOP emits 4 download links
- Drums/bass/other tap post per-stem EQ pre-master FX (clean stems for DAW)
- Vocals taps post-FX bus (chorus/delay/reverb baked in — that's the vocal sound)
- New <details> "📦 stems pack export (4 stem 同時録音 → DAW へ)" with red rec button

## v89 — Music ↔ Band Room bridge (separate apps, shared samples)

- Design judgement: keep apps cleanly separated (different purposes) but
  provide sample-level bridge for material flow
- Music Core Rig REC now shows "→ Band Room へ" link next to save
- Band Room external stems help text lists sources: DAW / Music Core Rig REC / Suno
- Footer reorganized into "別 app: Hazama FM · Music Core" / "歌詞: v2 · v3" / "DAW 連携"
- `style.css?v=fm-26`, fixed stale `engine.js?v=fm-54 → fm-55` in `index.html`

## v88 — WebMIDI in/out (hardware sync)

- OUT: 24 PPQ MIDI Clock from Tone.Transport.bpm → drum machine / DAW BPM sync
- IN: note-on listener — C2-G3 (36-55) → phrase trigger 01-20, C4-G#4 (60-68) → section jump
- "🎹 MIDI in/out" panel with `navigator.requestMIDIAccess` enable button
- Out/In dropdowns auto-populate from `midiAccess` + hot-plug via `onstatechange`

## v87 — per-stem external upload (drums / bass / other)

- Generalized vocal external upload pattern to all 4 stems
- `externalStemPlayers = { drums, bass, other }` routes to `stemEQs[stem].input`
  so per-stem EQ (HP/shelf/de-ess) applies to user takes
- New <details> "🥁🎸🎹 external stems" with one block per stem
- Toggle external → original stem auto-mutes → user's take plays through master chain
- + `docs/DAW-INTEGRATION.md` (roadmap: stem in/out paths, MIDI sync, sound quality options)
- + `docs/tabasco-lyrics-burroughs.md` v3 cut-up / fold-in lyrics for all 7 songs

## v86 — quick help overlay

- `?` button top-right and `?` key open a modal card with feature bullets + keyboard cheat sheet
- Escape / backdrop click / 閉じる button dismiss

## v85 — MediaSession (lock screen + media keys)

- `navigator.mediaSession` metadata, artwork (PWA icons), playback state
- Handlers: play / pause / stop / previoustrack / nexttrack mapped to band-room actions
- Refresh on band/song change and on playback start/stop

## v84 — SW registration + non-disruptive update banner

- band-room.html now registers `sw.js` (it didn't before — PWA install was broken)
- New version detected → fixed pill banner at bottom-center with "リロード" and "×"
- Unlike fm.html (auto-reload) the banner waits for the user — mid-jam reload is rude

## v83 — drag-drop external vocal

- Drop mp3/wav onto the `#br-external-vocal` panel as an alternative to the file picker
- `dragover` highlights the panel (dashed → solid border + brighter bg)
- Non-audio files rejected with status message

## v82 — phrase trigger qwerty keyboard mapping

- First 20 phrase cells map to `q w e r t y u i o p` (row 1) and `a s d f g h j k l ;` (row 2)
- Each cell shows the assigned key in a small corner chip
- Keydown fires the cell's click handler + `kbd-flash` pulse animation

## v81 — live recording (MediaRecorder → download)

- `Tone.context.createMediaStreamDestination()` taps `masterLimiter`
- `MediaRecorder` (audio/webm;codecs=opus preferred) collects chunks every 500ms
- STOP REC produces a `band-room_{band}_{song}_{ISO}.webm` download link with file size
- Recording does NOT stop playback

## v80 — A-B section loop

- Shift-click chip = set A; second shift-click = set B (auto-orders so A is earlier)
- `state.loopA / loopB` + visual chip prefixes (`A·` / `·B`) + golden tint between
- scheduleBar: at section transition, if `sectionIdx > loopB` → `jumpToSection(loopA)` (via RAF)

## v79 — keyboard shortcuts

- `space` play/stop · `[` `]` prev/next section · `1..9` jump · `m` toggle stems/AI mode
- Skipped when focus is on text inputs / textarea / select, or modifier keys held
- Footer hint chip shows the bindings in `<kbd>`

## v78 — localStorage persistence

- Key `band-room.prefs.v1`: bandId / songId / mode / kitSource / all range sliders / all checkbox toggles
- Debounced 400ms writes on `input` + `change` anywhere in `#br-main`
- Restored on `DOMContentLoaded` after the bands registry loads — selectors and handlers re-fire

## v77 — spectrum analyzer

- `Tone.FFT` size 64, smoothing 0.65, tapped off `masterLimiter`
- 280×36 canvas in transport, shares the master-meter RAF
- Bins color-tinted by band (bass 14°, mid 22°, high 28°)

## v76 — practice tempo slider (50–120%)

- Multiplier on `Tone.Transport.bpm.rampTo(baseBpm × mult, 0.4)`
- Also adjusts `Tone.Player.playbackRate` on stems (acknowledged pitch shift — warned in UI)
- Applied at `startPlayback` and `startStemPlayback` so re-start at 80% stays at 80%

## v75 — clickable section nav with stem seek

- Chips under transport, one per `structure[]` entry
- `jumpToSection(idx)` sums bars × `(60/bpm × 4)` → `Tone.Transport.seconds = targetSec`
- Re-seeks every stem player via `player.start("+0.05", targetSec)` — `loop:true` keeps wrapping

## v74 — cross-app mastering propagated to Hazama FM

- `engine.js` master chain: `masterGain → masterComp (-10 dB, 2:1) → masterWidener (0.62) → masterLimiter`
- Conservative settings; FM ambient softness preserved
- `engine.js?v=fm-55`, `sw VERSION = hazama-fm-v74`

## v73 — lyric blocks with section-synced highlight

- Markdown lyrics parsed into per-`[marker]` `<div class="br-lyric-block" data-marker="slug">`
- `updateLyricsHighlight(sectionName)` slug-matches the current section, scrolls into center, dims others
- Fuzzy fallback: `chorus-2 → chorus`

## v72 — phrase trigger 3-mode

- ⚡ 即発火 (default, instant) · ⏱ 次小節 (`Tone.Transport.nextSubdivision("1m")`) · 🔁 ループ
- Loop mode toggles per phrase: click again to stop and dispose
- Multiple phrases can loop simultaneously, each in its own player

## v71 — stem crossfade + master RMS meter

- `Tone.Player` fadeIn 0.005→0.15, fadeOut 0.02→0.30
- Track-button handler awaits 320ms after `player.stop()` before disposing — audible crossfade on song change
- `Tone.Meter` (smoothing 0.75) → 4px bar in transport, color shift accent → accent-soft @ -12 dB → red @ -3 dB

## v70 — AI 再現 polish (chorus / auto-pan / drive)

- `makeGuitar`: `Tone.Chorus` (0.9 Hz, depth 0.38, wet 0.34) before distortion
- `makeChordSynth`: `Tone.Chorus` + `Tone.AutoPanner` (0.18 Hz, depth 0.32) for slow LR drift
- `makeSynthBass`: post `Tone.Distortion` (0.08, wet 0.45) + LP filter for grit

## v69 — AI 再現 stereo placement

- `makeSampledKit`: per-voice `Tone.Panner` (kick 0, snare -0.06, hat +0.22, ghost -0.16, fill +0.12, crash +0.20)
- `ensureMaster`: per-bus panners — guitar -0.25, chords +0.20, others center
- Stems mode untouched — original mix integrity preserved

## v68 — don't stop mid-song

- `Tone.Player loop:true` on stems — practice/jam sessions don't go silent at song end
- `scheduleBar`: structure end wraps `sectionIdx = 0` instead of `stopPlayback()`
- `visibilitychange` listener calls `Tone.context.resume()` when tab returns visible — fixes mobile freeze

## v67 — UI simplify

- 16+ top sections collapsed into 6 core + 6 `<details>` (vocal FX / external / phrase / kit / volume / mastering)
- Non-active mode is `display:none` instead of dim — half the UI evaporates per mode

## v66 — mastering chain

- Per-stem EQ via `makeStemEQChain` (drums HP/EQ3, bass HP+LP, vocals HP+presence+de-esser, other HP+air)
- Two-stage master comp (gentle leveler + glue), `Tone.StereoWidener`, parallel tape sat
- New sliders: tape warmth (0–40 → wet send), loudness (-12..+6 dB → master gain)

## v65 — real drum pattern extraction

- `_extract_drum_patterns.py` rewrites all 7 Tabasco `drum-frames-*.json` from the actual stems
- librosa onset detect + band-energy classification (sub/low/mid/snap/high) + 16th-quantize
- Each frame's `events[]` reflects what the original drummer played, not a 4-on-floor template
- New `auto-self` kit source = current song's own drums

---

## Synth profile cheat sheet (v91-v92)

| profile        | drum kick                     | bass                          | chord                    | vocal               |
|----------------|------------------------------|-------------------------------|--------------------------|---------------------|
| default        | decay 0.32, 4 oct             | filter 480, drive 0.08         | triangle, verb 0.20      | formants 700/1200   |
| sakanaction    | decay 0.20, 5 oct, click -22  | filter 720, drive 0.04         | saw stab, chorus 0.55    | clean, verb 0.14    |
| lcd-motorik    | decay 0.38, 6 oct             | filter 600, portamento 0.04    | dreamy triangle, verb 0.34 | breathy, verb 0.32 |
| cramps-punk    | decay 0.40, click -36         | filter 380, drive 0.18, wet 0.70 | square stab, verb 0.12 | snarled, vibrato 18c |

## Master mix preset cheat sheet (v93)

| preset   | reverb | width | warmth | loudness | feel                          |
|----------|--------|-------|--------|----------|-------------------------------|
| neutral  | 22     | 72    | 10     |  0       | current default               |
| lo-fi    | 38     | 50    | 32     | -3       | lofi hiphop, washy, narrow    |
| club     | 12     | 88    | 18     | +3       | dry / ultra-wide / hot         |
| rock     | 14     | 65    | 12     | +1       | punchy mid-room               |
| ambient  | 55     | 90    | 22     | -2       | long verb / very wide          |

## DAW / hardware integration (v87-v90)

| feature                  | version | how to use                                          |
|--------------------------|---------|-----------------------------------------------------|
| external stem upload     | v87     | drag mp3/wav onto 🥁🎸🎹 → original auto-mutes       |
| external vocal upload    | v83     | same flow for vocals (Suno / 自分歌い直し)           |
| MIDI Clock out           | v88     | enable MIDI → pick output → DAW/drum machine syncs   |
| MIDI note in             | v88     | C2-G3 → phrase 01-20, C4-G#4 → section jump          |
| 1-track master record    | v81     | ⏺ REC → webm download                                |
| 4-stem pack export       | v90     | 📦 stems pack → 4 download links                    |
| Music Core Rig bridge    | v89     | Music REC → drop wav into Band Room external slot    |

See [DAW-INTEGRATION.md](./DAW-INTEGRATION.md) for the full roadmap.

## Lyric versions

- v2.1 plain English: `docs/tabasco-lyrics-draft.md`
- v3 Burroughs cut-up: `docs/tabasco-lyrics-burroughs.md` (Naked Lunch grade)

Same melody in both, pick by mood.

## Keyboard cheat sheet (v86)

| key                | action                                          |
|--------------------|-------------------------------------------------|
| `space`            | play / stop                                     |
| `[` / `]`          | previous / next section (audio + lyrics seek)   |
| `1`..`9`           | jump to section index (1-based)                 |
| `m`                | toggle stems ↔ AI 再現 mode                     |
| `?`                | open quick help overlay                         |
| `Escape`           | close overlay                                   |
| `q`..`p`, `a`..`l`, `;` | fire phrase trigger 01..20                 |

Shift-click on a section chip sets A→B loop range.

Skipped when typing in form fields or holding Ctrl/Cmd/Alt.

## Production deploy chain (v65 → v86)

All commits push to `main`, GitHub Pages auto-deploys. Each new push
cancels the previous in-flight build (rapid-fire commits during a
session are normal — the final commit is the one that ships).

Service Worker is `sw.js` with `VERSION = hazama-fm-v86`; matches
`band-room.{html,js,css}?v=br-31`. SW caches all the stem mp3s in
`presets/tabasco-stems/<song>/{vocals,drums,bass,other}.mp3` for
offline use; mirror the same naming when adding new bands.
