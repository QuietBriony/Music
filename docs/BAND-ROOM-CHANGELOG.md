# Band Room — Changelog (v65 → v216 compact)

Cache marker: `band-room.{html,js,css}?v=br-NN` and `sw.js VERSION = hazama-fm-vNN`.
The two are bumped together — sw VERSION matches the band-room generation it ships.

Note: v113 以降は **Hazama FM 側の修正も含む** ので変更が `engine.js?v=fm-NN`
も bump する。

---

## v216 compact — AI 再現 bass agent に phrase 呼吸（5 エージェント polish 完結）

v208 から続けてきた AI 再現 polish シリーズで、最後に flat だった
**bass agent** に phrase shape を追加。これで drum / chord / voice / guitar /
**bass** の 5 エージェント全部が 4 小節フレーズで連動して呼吸する。

- **現状の bass:** `ctx.kick` を読んで root/fifth/octave/seventh を音域配置する
  ロジックは元から動いていて、kick との lock は取れている（v208 以降不変）。
  だが velocity も音域も毎小節同じパターン。他 4 エージェントが phrase shape
  を獲得した中で bass だけが flat だった。
- **修正 1 — phrase velocity shape:** `PHRASE_VEL_MULT_BASS = [0.96, 1.00,
  1.06, 0.98]` を `phrasePos = ctx.barInSection % 4` で引いて全 vel 計算に
  掛ける。drum (`[0.95, 1.00, 1.04, 0.98]`) よりわずかに大きい振れ幅（±6%）
  にしたのは、bass はノートが長く鳴るのでわずかな velocity 差でも phrase
  lift がはっきり読めるから。
- **修正 2 — bar 2 ダウンビートのオクターブリフト:** phrasePos === 2 のとき
  だけ、downbeat（hit.step === 0）の音だけを 1 オクターブ上げる。実バンドの
  ベーシストもフィル小節の前の小節で「ちょっと上に飛ぶ」のはよくある move。
  break / intro / outro では適用しない（section が静かに作られている部分は
  そのままに）。
- **既存の追加 step（recap/comp pressure>0.52、verse ghost）にも phraseMult を
  掛ける**：bass の音量はどの step も同じ phrase 抑揚を受ける。
- **5 エージェント連動の効果:** bar 2 では:
  - drum: phrase mult 1.04 で peak
  - chord: sub 14 anticipation 8n でフィル小節へリードイン
  - voice: contour descending（h → m → r → m）で settling
  - guitar: inv 2 で register lift（high voicing）
  - bass: 1.06 vel + downbeat オクターブ↑ で peak
  全パートが「フィル小節へ向かう climax」として同期する。
- `check-band-room-logic.mjs`: `PHRASE_VEL_MULT_BASS = [0.96, 1.00, 1.06,
  0.98]` と `liftBar2Downbeat` の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-105`、`hazama-fm-v216`。
- bass agent 以外は無変更。stems モード / chord_progression / sampler 切替は
  すべて不変。

**AI 再現 v208 → v216 シリーズ 完結ラインナップ:**
| ver | エージェント / 領域 | 中身 |
|-----|-----|-----|
| v208 | drum kit | 規定値 `auto-self` → `synth`（drum-floor groove） |
| v209 | drum scheduler | 4 種フィルローテーション + phrase velocity 抑揚 |
| v210 | chord agent | inversion rotation + phrase-aware rhythm |
| v211 | voice agent | 4 小節 phrase contour（上昇 → ピーク → 下降 → 閉じ） |
| v212 | guitar agent | power chord voicing rotation（chord と weave） |
| v213 | kit profile | band/song ごとの timbre 自動マッピング基盤 |
| v214 | kit profile | Tabasco 残り曲に kit_profile 仮置き |
| v215 | kit profile | auto-apply が 1 曲しか効かないバグ修正 |
| **v216** | **bass agent** | **phrase velocity shape + bar 2 オクターブリフト** |

5 エージェント phrase 呼吸完結。次は synth voice 細部チューニング、UNRIPE
drum-frames 生成、master polish bus の AI モード A/B、など。

---

## v215 compact — kit_profile 自動マッピングの「最初の 1 曲しか効かない」バグ修正

ユーザー監査要望「なり方に、エラーとか、重複とか、バグとかないよね？」に
対する runtime 検証で発覚した機能バグの修正。

- **症状:** v214 で謳った「Tabasco album を頭から流すと曲ごとに synth voice
  の timbre が変わる」が、**実際は最初の 1 曲だけしか auto-apply されない**。
  以降は最初の auto-apply の profile に固定される。
  - 再現: dropdown で "default" を選んでから Hey → `sakanaction` に自動切替
    （✓ 期待通り）→ そのまま Electric Sheep に進むと `sakanaction` のまま
    （✗ `lcd-motorik` になるはず）
- **原因:** v213 で `applyRecommendedKitProfile()` の判定を
  `state.kitProfile === "default"` で書いていた。最初の auto-apply で
  state が "sakanaction" になると、次の曲では `state !== "default"` で
  auto-skip されてしまう。実装が**「ユーザー手動 pick」と「自動適用結果」
  を区別できていない**のが根因。
- **修正:** `state.kitProfileExplicitlyChosen` フラグを導入。
  - profileSel の change handler は **dispatch の出所**を区別:
    `state.__kitProfileAutoApplying === true` のときは自動適用なので
    flag を変更しない。それ以外は手動 click と判断。
    - 手動で "default" 以外を選ぶ → `kitProfileExplicitlyChosen = true`
    - 手動で "default" を選ぶ → `kitProfileExplicitlyChosen = false`
      （「auto-pick mode 再開」の意味）
  - `applyRecommendedKitProfile()` の判定は `state.kitProfileExplicitlyChosen`
    だけを見るように変更。dispatch の前後で `state.__kitProfileAutoApplying`
    を立てて try / finally で確実に降ろす。
- **動作確認:** preview 上で再テスト予定。期待される flow:
  - Boot → kitProfile = "default"、explicit = false
  - Hey load → applyRecommended で sakanaction、explicit = false（auto）
  - Electric Sheep load → applyRecommended で lcd-motorik、explicit = false
  - Human Fly load → applyRecommended で cramps-punk、explicit = false
  - ユーザーが手動で "lofi-nujabes" 選択 → explicit = true、以降の曲では
    auto-skip。dropdown で "default" を選び直せば auto resume。
- **v213/v214 のドキュメントを実態に合わせる:** v213 / v214 entry の「
  state.kitProfile === 'default' のときだけ auto-apply」という説明は
  v215 で **「ユーザーが明示的に pick していないときだけ auto-apply」**に
  変わる。「default = auto-pick mode」という UX 約束は同じ。
- `check-band-room-logic.mjs`: `kitProfileExplicitlyChosen` と
  `__kitProfileAutoApplying` の存在、判定が flag ベースになっていることを
  assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-104`、`hazama-fm-v215`。

これで v214 で配った per-song timbre が album を通して効くようになる。

---

## v214 compact — Tabasco 残り曲に kit_profile 仮置き（A/B 起点）

v213 で作った band/song レベルの自動マッピング機構を活用し、Tabasco の
残りの曲にも初期推奨 profile を BPM / genre cue ベースで仮置き。
ユーザー試聴で違和感があれば dropdown で上書きできる前提の出発点。

- **追加マッピング:**
  - `tabasco / hey` (123 BPM, G major): `"sakanaction"`
    - dance rock 寄りの曲調、`sakanaction` profile は「タイト kick /
      クリッキー hat / ブライト synth bass」で合いそう
  - `tabasco / electric-sheep` (129 BPM, E minor): `"lcd-motorik"`
    - 曲名通り electric 系、`lcd-motorik` の「4-on-floor / cowbell /
      pad swell / sub-y bass / dreamy pad」と相性◎
  - `tabasco / under-the-moon` (161 BPM, Bb major): `"lcd-motorik"`
    - 高速 4 つ打ち feel と krautrock 寄りの motorik profile
- **そのまま band default を継承（"default"）:**
  - tabasco (title track, 136 BPM)
  - i-got-a-feeling (117 BPM)
  - sister (117 BPM)
  - これらは「mixture rock」のド真ん中なので LCD + Backdrop Bomb の
    `default` profile がベース。
- **すでに割当済み（v213）:**
  - tabasco / human-fly: `"cramps-punk"` (The Cramps "Human Fly" カバー)
- **UX 規約は v213 と同じ:** `state.kitProfile === "default"` のときだけ
  自動適用。ユーザーが手動で別の profile を選んだら、その選択は曲
  切替で上書きされない。
- **コード変更なし** — bands.json のみ。`applyRecommendedKitProfile()`
  は v213 で既に実装済みで、新しい `kit_profile` フィールドを自動で
  拾う。
- `check-band-room-logic.mjs`: 新規 3 曲の `kit_profile` 値を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-103`、`hazama-fm-v214`
  (band-room.js 本体は変更なしだが、PWA / cache buster 整合のため bump)。

これで Tabasco album を流すと曲ごとに synth voice の timbre が
変わる体験になる: `default` → `sakanaction` → `default` → `lcd-motorik` →
`lcd-motorik` → `cramps-punk` → `default` の順で巡る。

---

## v213 compact — kitProfile 自動マッピング（band/song 推奨を bands.json で）

v208-v212 の AI 再現 5 パート polish が一段落。次はサンプル swap の
入り口として、**band / 曲ごとに synth voice の timbre 推奨を持つ**仕組み。
ユーザー要望「サカナクション / LCD 調にできたら楽しい」「メンバーの感覚や
出音再現」への布石。

- **bands.json に推奨フィールド追加:**
  - band level: `kit_profile_default`
    - tabasco: `"default"` (LCD + Backdrop Bomb mixture、明示)
    - unripe: `"cramps-punk"` (Okinawa hardcore postpunk)
  - song level: `kit_profile`（band default を上書き）
    - tabasco / human-fly: `"cramps-punk"` (これは The Cramps の "Human Fly"
      カバーで、cramps-punk profile はまさにこの曲のために命名されている)
- **`applyRecommendedKitProfile()` を追加:** `loadSong` の data set 直後に
  呼ぶ。
  - `state.kitProfile` が `"default"` のときだけ自動適用する設計。
    "default" = "曲に決めさせる" の意味として扱う。
  - 推奨は `songMeta.kit_profile || band.kit_profile_default` の順で解決。
  - 解決後、`br-kit-profile-select` の value を更新して `change` を dispatch
    すれば既存の rebuild 経路（synthBass / chordSynth / voiceSynth / drumKit
    の再生成）にそのまま乗る。
- **明示ユーザー pick は尊重:** sakanaction / lcd-motorik / cramps-punk /
  lofi-nujabes を手動で選んだ後は band/song を切り替えても上書きされない。
  再度自動に戻したければ dropdown で "default" を選ぶ。これは「お気に入りの
  音色で全曲ぶん通したい」UX と「曲ごとの推奨音色」UX の両立を狙った
  シンプルな規約。
- **localStorage prefs との整合:** 既存の `applyPrefs(prefs)` は
  `prefs.kitProfile` を boot 時に復元する。保存値が "default" なら今回の
  自動マッピングが効き、保存値が他の何かなら自動マッピングはスキップされる。
  v213 以前から触ってないユーザーは保存値が "default" のままなので、初回
  v213 起動時に **UNRIPE = cramps-punk / Human Fly = cramps-punk** が
  自動適用されて聞こえ方が変わる体験になる。
- **bands.json 自体は precache 済み** (sw.js の PRECACHE_URLS に既に含まれて
  いる)。今回はフィールド追加のみで file path は変えてないので sw 側は
  cache buster の bump だけで済む。
- `check-band-room-logic.mjs`: `applyRecommendedKitProfile` 関数の存在と、
  bands.json の `tabasco/human-fly.kit_profile === "cramps-punk"` と
  `unripe.kit_profile_default === "cramps-punk"` を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-102`、`hazama-fm-v213`。

---

## v212 compact — AI 再現 guitar agent に voicing rotation（chord と weave）

v208 / v209 / v210 / v211 と AI 再現 全パートのフレーズ呼吸を整えてきた
仕上げ。最後に flat だったのが guitar — `triggerGuitarAgent` が
`powerChordNotes(ctx.chord, 3)` を bar の頭で 1 回だけ呼んで、その同じ
`notes` を全 step に流し込んでいた。つまりギターは毎小節同じ voicing
（root, fifth, root+oct）でストラム / バッキングしてた。

- **修正 — power chord voicing rotation:** `GUITAR_INVERSION_BY_PHRASE =
  [1, 0, 2, 0]` を `phrasePos = ctx.barInSection % 4` で引き、v210 で
  追加した `chordInversion(baseNotes, inv)` を power chord notes に適用。
  C パワーコード `[C3, G3, C4]` の場合:
  - bar 0 (inv 1): `G3 C4 C4` → dedup `[G3, C4]`（mid voicing）
  - bar 1 (inv 0): `[C3, G3, C4]`（low voicing、root position）
  - bar 2 (inv 2): `C4 C4 G4` → dedup `[C4, G4]`（high voicing、register lift）
  - bar 3 (inv 0): `[C3, G3, C4]`（low、phrase release）
- **chord agent との weave:** chord は `INVERSION_BY_PHRASE = [0, 1, 2, 0]`
  で top note を `5th → root → 3rd → 5th` の方向で動かす。guitar は
  `[1, 0, 2, 0]` でズレた pattern にしたので、bar 0 では guitar 高め /
  chord 低め、bar 2 では guitar 高 / chord 高（一緒に lift）、bar 3 では
  両方 root に戻る、という相補的な動き。完全な parallel motion を避けつつ、
  フレーズの climax（bar 2）では両方が上に行く設計。
- **dedup:** power chord は root を 1 オクターブ上にもう一度持つので、
  chordInversion で inv 1 / 2 を取ると重複ノートが出る。`new Set` で
  dedup して PolySynth voices の無駄遣いを避ける。triad / seventh の
  chord agent 経路は元から重複ナシなので影響なし。
- **触らない部分:** `guitarAgentPlan` 本体（accent 反応、grid pattern、
  role 別 strum 密度）は不変。drum / bass / chord / voice agent も不変。
  `guitarInstrument` のサンプラー切替（electric-guitar 等）も同じ plan を
  通る。
- `check-band-room-logic.mjs`: `GUITAR_INVERSION_BY_PHRASE = [1, 0, 2, 0]`
  と dedup の `new Set` を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-101`、`hazama-fm-v212`。
- 原音 (stems) モードは不変。AI 再現 mode の guitar synth ラインだけ
  4 小節ぶんの voicing 動きが入った。

**AI 再現 v208 → v212 のラインナップまとめ:**
- v208: drum kit 規定値 auto-self → synth（drum-floor groove）
- v209: drum scheduler に varied fills + 4 小節 phrase velocity 抑揚
- v210: chord agent に inversion rotation + phrase-aware rhythm
- v211: voice agent に 4 小節 phrase contour（上昇 → ピーク → 下降 → 閉じ）
- v212: guitar agent に power chord voicing rotation（chord と weave する pattern）

drum / bass / chord / voice / guitar の 5 パート全部が、独立に flat だった
状態から、4 小節フレーズで連動して呼吸する形になった。

---

## v211 compact — AI 再現 voice agent にフレーズアーチを持たせる

v208 / v209 / v210 と続けてきた AI 再現 polish の続き。次の monotony は
voice（メロディ / 歌唱ガイド）。`voiceAgentPlan(ctx)` の contour が長らく
非 recap 経路で `[root, 3rd, 5th, 3rd]` の同じアルペジオを毎小節
繰り返していて、4 小節フレーズの melodic shape が flat だった。
実際のボーカルはフレーズに「上昇 → ピーク → 下降 → 閉じ」のアーチが
あるので、それを 4 小節ぶん仕込む。

- **修正 — 4 小節フレーズ contour ローテーション:** `r = notes[0]`、
  `m = notes[1]`、`h = notes[2]` として、デフォルト経路 (verse / comp /
  非 recap) に 4 小節ぶんの contour テーブル:
  - bar 0 ascending  : `r → m → h → m`（フレーズ entrance、root から上昇）
  - bar 1 weaving    : `m → h → m → h`（top 付近で揺れる）
  - bar 2 descending : `h → m → r → m`（fill 小節へ下降）
  - bar 3 closing    : `r → h → m → r`（次フレーズの entrance へ繋ぐ）
  recap 経路（コーラス相当）は元の `[3rd, 5th, root, 5th]` を bar 0 に
  保ったまま、bar 1 / 2 / 3 に top-centered な variant を載せて 4 小節
  ぶんのアーチに。
- **触らない部分:**
  - Human Fly recap の `HUMAN_FLY_VOCAL_MELODY` 固定旋律はそのまま
    （これは曲の identity なので contour 自動変動の対象外）
  - intro / outro は無音継続
  - isPhraseEnd の hold note も維持（フレーズの息継ぎ位置）
  - `sourceAccentSteps` の snare/ghost/crash 反応も同じ — contour は
    accent 位置に sub だけマッピングする
- **副作用なし:** voice 以外のエージェント（drum / bass / chord / guitar）
  は `ctx` を変更せず読むだけなので不変。
- `check-band-room-logic.mjs`: `PHRASE_CONTOURS_DEFAULT` と
  `PHRASE_CONTOURS_RECAP` の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-100`、`hazama-fm-v211`。
- 原音 (stems) モード / 外部ボーカル経路 / `voiceInstrument` のサンプラー
  切替は不変。AI 再現 mode の synth voice ライン（voiceAgent → voiceSynth）
  だけ呼吸が増えた。

---

## v210 compact — AI 再現 chord agent に生気（inversion 回し + フレーズ rhythm）

v208 / v209 のドラム整備の続き。次の monotony は**コード周り**だった。
`chordAgentPlan(ctx)` が長らく「sub 0 で 2n の同じ voicing をスタブ、
たまに sub 8 か 10 でフォロー」という骨組みのまま、毎小節同じ rhythm /
同じ inversion でループしていて、verse が長くなるほど「pad が貼り付き
っぱなし」感が出ていた。

- **修正 1 — inversion rotation:** `chordInversion(notes, inv)` を追加。
  `noteNameToSemi()` で名前を semi に戻し、下から `inv` 本ぶん 1 オクターブ
  上げ、再ソートして名前に戻す。`INVERSION_BY_PHRASE = [0, 1, 2, 0]` で
  4 小節フレーズの 1→2→3 小節で inv を回し、4 小節目は root に戻して
  フレーズ閉じ。例: C-major triad `["C4","E4","G4"]` は phrasePos に応じ
  `C4 E4 G4` → `E4 G4 C5` → `G4 C5 E5` → `C4 E4 G4` と top note が
  G → C → E → G に weave する。コード自体は変わらない（C maj は C maj）
  けど voicing の top が動くので、コード stab が「ふた口の固いもの」から
  「メロディの一部」に寄る。
- **修正 2 — phrase-aware rhythm:** non-break / non-comp / 非 jazzy の
  デフォルト経路に rhythm 4 変奏:
  - phrasePos 0: downbeat のみ（フレーズ entrance、pad を呼吸させる）
  - phrasePos 1: downbeat + sub 8 stab（フレーズ mid push）
  - phrasePos 2: downbeat + sub 14 anticipation 8n（fill 小節 への lead-in）
  - phrasePos 3: downbeat のみ（drums の fill build に空間を譲る）
  break / comp / jazzy / recap-pressure>0.58 の経路は既存ロジック維持
  （これらは元から rhythm 反応してた）、その上に inversion rotation だけ
  乗る。intro / outro は何も追加せず、downbeat だけで静か。
- **`chordInversion` の安全網:** `((inv % 4) + 4) % 4` で負数 / 4以上にも
  耐え、空配列はそのまま返す。`baseNotes` を破壊しない（semis のコピー
  で操作）。
- bass agent / drum scheduler / guitar agent / voice agent は不変。
  ctx.barInSection を読むだけなので side effect なし。
- `check-band-room-logic.mjs`: `chordInversion` 関数の存在 と
  `INVERSION_BY_PHRASE = [0, 1, 2, 0]` を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-99`、`hazama-fm-v210`。
- 原音（stems）モード / sample kit / chord_instrument のサンプラー切替
  は不変。AI 再現 mode の chord 周りだけ呼吸が増えた。

---

## v209 compact — AI 再現ドラムの groove polish（フィル 4 変奏 + フレーズ抑揚）

v208 で AI 再現のドラムがシンセに切り替わって音色は通用するように
なったので、続けて groove 側のレビュー。ユーザー指示「グルーブ優先で、
音として、成立してるか、見直してみて」に対する次の手。

- **問題:** 4 bar に 1 回入るフィルが**毎回まったく同じ tom roll**
  （v107 で入れた `drumKit.fill` の 4×16th 上昇 velocity）。16 bar の
  verse を聴くと 4 回ぜんぶ同じパターンになり「機械が同じ場所で必ず
  ロールする」感が出る。実ドラマーはフィルをバーごとに変える。
- **修正 1 — フィル 4 変奏ローテーション:** `Math.floor(barInSection / 4) % 4`
  で 4 種類を巡回:
  - **V0:** 既存の 4×16th tom roll（v107 のクラシック）
  - **V1:** 4×16th snare 上昇 build（パンクっぽい押し込み）
  - **V2:** kick→snare→kick→snare の Bonham 系 forward march
  - **V3:** 後半 2/16 だけの sparse tom-tom リードイン（隙間を残す）
  4 種が代わりばんこに鳴るので、16 bar 内ですら全部違うフィルになる。
  intro / outro はそのままフィル抑制。
- **修正 2 — 4 bar フレーズ velocity 抑揚:** `phrasePos = barInSection % 4`
  と `PHRASE_VEL_MULT = [0.95, 1.00, 1.04, 0.98]`。フレーズの 1 小節目
  はゆるく入る、3 小節目で 4% 持ち上がってフィル小節へ繋ぐ、フィル
  小節（4 小節目）は本体を 2% 下げてフィル自体に build を譲る。
  ±6% の中の小さな上下で「打ち込みの flat な loop」感を消す。
  既存の `micFollowVelocityScale()` と humanize jitter (±4%) と同じ
  vel 計算行にチェーン掛けする。
- **bass agent は触らない:** `bassAgentPlan(ctx)` が `ctx.kick`（drum-frames
  の kick events）を読み込んで root/fifth/octave/seventh を音域配置する
  ロジックは既に動いていて、kick との lock は取れている。今回の groove
  改善は drum scheduler 側のみ。
- `check-band-room-logic.mjs`: 4-bar phrase mult と fillVariant ローテーション
  の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-98`、`hazama-fm-v209`。
- 副作用なし。stems mode / sample kit / chord / bass / guitar / voice agent
  は不変。シンセドラム周りの groove だけ手を入れた。

---

## v208 compact — AI 再現のドラム規定値を synth に切り替え（drum-floor groove 主軸）

ユーザー報告: 「AI 音源の、ドラムが壊滅的。unripe のなんか生音？ちょっと
とったの？普通に drumfloor と連令してやってください。そのほうが伸ばし
ようあるでしょ？グルーブ優先で、音として成立してるか見直してみて」。

- **原因:** `state.kitSource` の規定値が `"auto-self"` だった。これは
  `resolveKitSource()` で `${bandId}/${songId}` に展開されるので、たとえば
  TABASCO / Human Fly を AI 再現で鳴らすと `presets/sample-kits/tabasco/
  human-fly/{kick,snare,hat,…}-01.wav` を `Tone.Player` で叩く運用に
  なっていた。中身は Demucs 分離後の drum stem から librosa 系で抽出した
  単発 wav なので、他楽器の bleed と onset アーティファクトが残った
  「生録音みたいでデモっぽい」音になっていた。ユーザーが「unripe の生音」と
  呼んだのはまさに `unripe/continuous/kick-01.wav` 系のあの音。
- **修正:** 規定値を `"synth"` に変更。AI 再現 mode のドラムは
  `makeDrumKit(drumBus, state.kitProfile)` が生成する Tone.js シンセ
  ヴォイス（kick=MembraneSynth＋NoiseSynth click、snare=NoiseSynth＋
  MetalSynth rim、hat/ghost/fill/crash も同様）で鳴る。グルーブ側は既存の
  drum-frames events（バンドごとに `drum_frames_pattern` で指定、tabasco は
  `presets/drum-frames-tabasco-{songid}.json`）が駆動するので、Dilla feel /
  velocity jitter / ghost-note vamp / 4-bar fill / sparse pattern reinforcement
  といった groove 補強はそのまま効く。timbre は profile（default /
  sakanaction / lcd-motorik / cramps-punk / lofi-nujabes）で差し替えできる
  ので、サカナクション調 / LCD 調にスワップしていく方向性に素直に拡張できる。
- **既存ユーザーのマイグレーション:** `applyPrefs()` で
  `prefs.kitSource === "auto-self"` を読み込んだ場合は `"synth"` に
  silent fallback。localStorage に "auto-self" が残っていても起動時に
  synth へ寄せる。ユーザーが意図的にサンプルキットを使いたい場合は
  「synth / sample 切替」ドロップダウンから auto-self や tabasco/* /
  unripe/* を選び直せる（オプションは退役しない）。
- **音として成立してるかのレビュー:** drumBus 経路は `drumBus →
  drumPan → instrumentBus (makeInstrumentPolishBus) → masterGain` に
  既に乗っていて、polish bus は EQ tilt（low/mid -0.8 dB、high +1.4 dB）
  + glue comp（threshold -20 dB / ratio 2.2 / attack 12 ms / release 180 ms）
  + parallel saturation（distortion 0.12、wet 0.16） + StereoWidener 0.58
  + makeup +1.08 で composite を組んでいる。シンセ単発のドライさを
  polish bus が補正するので、原音から離れた timbre でも mix としては
  まとまる（v204 で `バキバキ感` + `抜け感` を狙って組んだチェーンが
  そのまま効く）。
- **AI 再現 mode 自体は依然 WIP** （v205 で stems mode をデフォルト化済み、
  v207 でも mode は localStorage に保存しない方針）。本変更は AI モードに
  入ったときの初手の聞こえを「ベース音色として通用するライン」に揃える
  もの。chord/bass/guitar/voice の synth voice チューニングや、kitProfile の
  自動マッピング（band/song の場面に応じた sakanaction / lcd-motorik 寄せ）は
  次ラウンド以降。
- `check-band-room-logic.mjs`: `kitSource: "synth"` を default で
  保持していることを assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-97`、`hazama-fm-v208`。
- 原音（stems）モードと sampled kit 系（auto-self / tabasco/* / unripe/*）
  の挙動は不変。AI 再現 mode のドラム初期音色のみ変わる。

---

## v207 compact — band-room: BG 再生の音程ブレ修正 + PWA バナー流用

FM 側から共有された案件 1（バックグラウンド再生中、たまに音程が下ブレる）の
修正と、案件 2（PWA インストール推奨バナー）の流用。

- **音程ブレの原因:** `playbackHealthTimer`（2.5s `setInterval`）が BG で
  throttle される間に AudioContext が一瞬 suspend → `recoverPlaybackAfterSuspend`
  が `resyncStemPlaybackToClock(force:true)` を呼び、全 stem を `stop` →
  `start` で再起動していた。この hard cycle が音切れ＋クリックとして
  「ところどころ音程が下ブレる」に聞こえていた（FM 側の `playbackRate`
  throttling 説は近接領域、実体は forced resync 側）。
- **修正:** `recoverPlaybackAfterSuspend` の force resync を
  **`document.hidden` のときスキップ**するように変更。BG 中は context だけ
  resume して stem は再生位置を維持。可視復帰（`reason === "visible"`）で
  再入したときに resync が走り、ドリフトを掃除。
- **PWA バナー:** `index.html` / `fm.html` と同じ install hint を
  band-room.html にも追加（案件 2 / FM 側 v206 の提案そのまま流用）。
  `musicStackInstallHintDismissed` キーは origin 共有なので dismiss 状態は
  3ページで同期。PWA standalone での BG 安定性向上が狙い。
- 案件 1 のうち Wake Lock / playbackRate 更新の Page Visibility ガードは
  今回見送り（band-room の playbackRate は周期更新していないため見送り、
  Wake Lock は次ラウンドに分離）。残症状が出れば v208 で追加。
- `check-band-room-logic.mjs`: PWA install hint の存在を assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-96`、`hazama-fm-v207`。
- 譜面・音色・ミックスは不変、UI も既存配置に影響なし（バナーは
  position:fixed、standalone/dismiss で非表示）。

---

## v206 compact — PWA インストール推奨バナー（Music の 2 ページ）

- ユーザー要望「Music-stack 各システムを PWA 化したほうが安定？それなら
  ページに推奨表示と手順を載せたい」への対応 第 1 弾。**Hazama FM (fm.html)
  と Music Core Rig (index.html)** にインストール推奨バナー（`#install-hint`）
  を追加。
- 動作: ページ起動時、`standalone` 表示モードでなく、かつユーザーが過去に
  dismiss していなければ、画面上部に小さい半透明バナーを表示。「📲 PWA推奨：
  バックグラウンド再生が安定」+「手順」ボタン（iOS / Android / PC の各
  インストール手順を展開）+「×」（localStorage に dismiss を記録、再表示
  しない）。Chrome の `beforeinstallprompt` が来たときは「インストール」
  ボタンで 1 タップ実行（iOS Safari は手順表示のみで OS の制約に従う）。
- 背景 — ユーザー報告: Band Room をバックグラウンド再生中にときどき音程が
  下ブレる。原因はほぼ確実にブラウザのバックグラウンド throttling — JS
  イベントループが遅延し、Tone.js のスケジューリングや Player の `playbackRate`
  計算がズレることで sample 再生のピッチがブレる。PWA standalone はこの
  throttling を緩めるため、Band Room を含む全体の安定性が上がる（Band Room の
  audio コード自体でも軽減できるが、本 PR は別チャット管理域には触れない）。
- `fm.html` / `fm.css fm-53` / `fm.js fm-68`: Hazama FM 側はバナー＋既存の
  `beforeinstallprompt` ロジックを統合（旧 floating `#fm-install` ボタンの
  生成は退役、その役目はバナー内の「インストール」ボタンが担う）。
- `index.html`: Music Core Rig には inline `<style>` ＋ inline `<script>` で
  同じバナーを実装（fm.js を読まないため）。dismiss は同じ localStorage キー
  `musicStackInstallHintDismissed` で同一オリジン共有。
- `sw.js`: `hazama-fm-v206`、precache の fm.js / fm.css バージョン更新。
- Band Room (`band-room.html`) は別チャット管理域のため**本 PR では未着手**。
  バナーを載せる場合は同パターン（inline style/script）で 1 ファイル変更。
- sister repo（namima / chill / drum-floor / openclaw）への展開は、本パイロット
  の試用後に。

---

## v205 compact — band-room: 起動時は必ず原音モードに

ユーザー報告「band-room を開くと AI 再現になっていた。AI 再現は未整備なので
デフォルトは原音に」。

- 原因: `savePrefs` がプレイバックモード（`mode: currentMode`）を保存し、
  `applyPrefs` が起動時に復元していた → 一度 AI 再現に切り替えると以後その
  状態で起動していた。
- 修正: モードを永続化しないようにした。`savePrefs` から `mode` を削除、
  `applyPrefs` のモード復元ブロックを削除。band-room は常に 原音 (stems) で
  起動する。モード切替はセッション内のみ（AI 再現 が整備できたら復活を検討）。
- A/B スナップショット復元は従来どおり（明示操作なので維持）。
- `check-band-room-logic.mjs`: `savePrefs` が `mode` を保存しないことを assert。
- `band-room.html` / `sw.js`: `band-room.js?v=br-95`、`hazama-fm-v205`。

---

## v204 compact — band-room: 原音マスタリング — バキバキ感 + 空間の抜け感

ユーザー要望「原音マスタリングとして、もっと音のバキバキ感と、空間に広がる
抜け感がほしい」。マスターチェーンを調整（構造値のみ、スライダー既定は不変）:

- **バキバキ感（パンチ/粒立ち）:** masterComp2 の attack を 8→16ms に遅らせ、
  トランジェントが glue に潰される前に前へ出るように。master EQ の high shelf
  を 0.7→1.4・クロスオーバーを 5600→4800Hz に下げてプレゼンス〜エアを広く
  持ち上げ輪郭をくっきり。tape saturation も 0.09→0.12 で倍音のエッジを少し。
- **空間の抜け感:** master EQ の mid を −0.2→−0.5 に下げて低中域を整理（抜け・
  クリアさ）、master reverb の decay を 1.9→2.4 に広げて空間を出す。
- リミッター −1.0 / 音量カーブ / 譜面・音色は不変。
- `band-room.html` / `sw.js`: `band-room.js?v=br-94`、`hazama-fm-v204`。

---

## v203 compact — band-room: 歌詞表示の小掃除（マークダウンノイズ除去）

ユーザー依頼「歌詞の中身を最適化」。`renderLyricBlocks` を整理:

- `#` / `##` 見出し行（曲タイトル等）と `---` 罫線を歌詞ブロックから除外。
  生マークダウンの `## 01 TABASCO …` プリアンブル小ブロックが消える。
- 各ブロック本文の先頭/末尾の空行を除去、連続空行を1つに圧縮（連の区切りは保持）。
- CRLF (`\r\n`) を正規化 — `<pre>` に紛れていた `\r` を除去。
- 見出し除去で空になったプリアンブルブロックは生成しない。
- 注: 「歌詞ブロック巨大化」は実バグではなかった（プレビュー幅0での計測ミス、
  通常ビューポートでは元から正常）。今回は中身の整形のみ。
- `band-room.html` / `sw.js`: `band-room.js?v=br-93`、`hazama-fm-v203`。
- 譜面・セクション構造・音は不変。

---

## v202 compact — band-room: 出音をシステム上限まで底上げ

ユーザー報告「他アプリと比べて出音が小さい。ミックスではなくシステム音として
マックスに」。band-room はマスターリミッターが −1 dBFS（ピークはほぼ上限）だが、
マスター音量の既定が控えめだった。

- マスター音量カーブを底上げ: `masterVolBase` 0.90→1.2、スライダー100地点の
  ゲインを 1.25→1.8（−1 dBFS リミッターをより強く駆動 ＝ 体感ラウドネス↑）。
- 既定スライダー位置を 80→100（最大）に。`masterGain` 初期値も 1.2 に追従。
- `MASTER_VOL_KEY` を `.v2` に更新 — 過去に保存された控えめな音量値を無視し、
  全員が新しい最大既定で起動する。
- リミッター閾値 −1.0 は不変（クリップ防止の天井は維持）。譜面・音色・ミックス
  バランスは不変、出力ゲインのみ。
- `band-room.html` / `sw.js`: `band-room.js?v=br-92`、`hazama-fm-v202`。
- `check-band-room-logic.mjs`: `masterVolBase` の assert を 1.2 に更新。

---

## v201 compact — band-room: 歌詞オートスクロールのページ乗っ取り修正

ユーザー報告「AI 再現の画面で歌詞部分に張り付き、正常なスクロールができない」。

- 原因: `updateLyricsHighlight` がセクション変化のたびに `match.scrollIntoView
  ({ block: "center" })` を呼び、これがスクロール可能な祖先を全て——`#br-lyrics`
  パネルだけでなくページ/window まで——スクロールさせ、ユーザーの手動スクロールを
  毎回奪っていた。
- 修正: `#br-lyrics`（`max-height:360px; overflow-y:auto` の独立スクロール枠）の
  `scrollTop` を直接計算して動かすよう変更。歌詞パネルは現セクションを追従するが、
  ページ本体はもう動かない。
- `band-room.html` / `sw.js`: `band-room.js?v=br-91`、`hazama-fm-v201`。
- `check-band-room-logic.mjs`: `scrollIntoView` を使わないことを assert。

---

## v200 compact — band-room AI 再現モード: ポリフォニー溢れ修正（partial fix）

ユーザー報告「AI 再現モードは音が全然ない」の調査・第一弾修正。**部分修正**で、
synth モードのハードハングは未解決（次ラウンドで本格調査）。

- **確証のある修正:** AI 再現モードで PolySynth のポリフォニー溢れを特定。
  `guitarAgentPlan` の recap（サビ）分岐が 16分音符ストラム（16ステップ ×
  3音パワーコード ＝ 48ノート/小節）を発火し、ギター/コード PolySynth の
  `maxPolyphony = 6` を大幅超過 → `Max polyphony exceeded. Note dropped.` が
  大量発生し、和音・ギターが落とされて消えていた。
  - guitar recap ストラム: 16分 → 8分音符（密度半減）。
  - guitar / chord の `maxPolyphony`: 6 → 10（v187 の stutter 対策の範囲内）。
- **未解決:** synth モードで再生開始後にメインスレッドがハードハングする現象は
  これだけでは直らない。agent ループ／スケジューラ／リバーブ decay 再代入／
  小節ごとの synth 再生成は調査済みで除外。原因は非自明、次ラウンドで
  プロファイリング前提の本格調査が必要。
- `band-room.html` / `sw.js`: `band-room.js?v=br-90`、`hazama-fm-v200`。
- 譜面・コード進行・音色は不変。

---

## v199 compact — モードクロスフェードの ReferenceError 修正（jazz / lofi ドラム参照）

`engine.js fm-105`: ユーザー報告「`updateSoundForMode failed` がクロスフェード中に
繰り返し出る（`ReferenceError: jazzDrumSampler is not defined`）」の修正。

- 原因 — v195 の `MODE_LAYERS` で `lofi` / `jazz` の `samplers()` が、宣言されて
  いない変数 `lofiDrumSampler` / `jazzDrumSampler` を参照していた。drum レイヤーの
  実体は `lofiDrumSamples` / `jazzDrumSamples`（`{kick, snare, hat}` の `Tone.Player`
  kit）で、`.volume` を持つ単一 sampler ではない。v195 のクロスフェード設計が
  「drum も `.volume` で ramp できる sampler」と想定したが、その変数は最初から
  存在しなかった。
- 影響 — クロスフェード（`transitionSec > 0`）のたびに `crossfadeOutOtherModes`
  が throw し、`updateSoundForMode` の try/catch が握りつぶしていた。コンソール
  エラーだけでなく、**遷移時の mode 固有の音作り（pad/filter/reverb 設定、
  `start*Layer` 呼び出し、残りモードの layer 停止）が丸ごとスキップ** されていた。
- 修正 — `MODE_LAYERS.lofi` / `.jazz` の `samplers()` から存在しない drum 変数を
  除去。drum kit は `.volume` を持たず（各 voice の volume は mic-follow が毎小節
  再設定する）クロスフェード対象外なので、`stop()` の `stopLofiDrumLayer()` /
  `stopJazzDrumLayer()` でこれまで通りハードカット。これで melodic layer
  （piano / bass / harp / cello / organ）のフェードが実際に効くようになる。
- `fm.html` / `index.html` / `sw.js`: `fm-105`、`hazama-fm-v199`.
- 譜面・音色・セクション構造・モードの音作り内容は不変（壊れていた遷移処理の
  復旧のみ）。

---

## v198 compact — band-room: 非ボーカル磨きバス + ボーカルを空間に + 艶/低音/音圧

band-room.js 専用の音質改善。元 v195/v196 として開発したが、並行セッションが
先に v196/v197 を出したため v198 に採番・統合。

- **非ボーカル磨きバス（`makeInstrumentPolishBus`）** — drums/bass/guitar/chords
  の 4 パンを masterGain 直結から専用バスへ集約し、その手前で磨く。voice
  （ボーカル/メロディリード）と click は対象外（masterGain 直結のまま）。
  - `EQ3 tilt → glue comp → [dry]+[parallel saturation] → StereoWidener →
    makeup → masterGain`。hi-fi = EQ で低中域の濁りを削りプレゼンス〜エアを
    上げ、Widener 0.58 で楽器を広げセンターのボーカルと分離。音圧 = glue
    comp（-20/2.2、attack 12ms でアタック維持）＋ Distortion 0.12 を 16%
    パラレル、makeup +0.7dB。
- **ボーカルを空間に** — 溶け込ませる方向へ再ボイシング:
  - vocal stem EQ: 語/子音帯（420–4200Hz）の presence を mid −1.4 に下げて
    音感寄りに、high-air shelf +1.3 で「上から降りてくる」浮遊感、de-ess −4.5。
  - vocal FX: reverb decay 2.6→4.0 / preDelay 0.035→0.055、chorus を深く
    ゆっくり、dry 0.82→0.66 で一歩奥へ。`makeVoiceBox` のリバーブも拡大。
- **マスター（全体的に）**: tape saturation 0.045→0.09 ＋ EQ high +0.7（艶）、
  EQ low shelf 0.7→1.5 @185Hz（自然な低音ブースト）、comp2 を −10/1.7 に
  詰め masterVolBase 0.84→0.90（Nirvana 寄りの密度・音圧）。limiter −1.0 維持。
- スライダー既定値は不変（構造側のみ調整、mix-prefs migration 不要）。
- `band-room.html` / `sw.js`: `band-room.js?v=br-89`、`hazama-fm-v198`。
- `check-band-room-logic.mjs`: `makeInstrumentPolishBus` の存在・非ボーカル
  経由/ボーカル直結・masterVolBase 0.90 を assert。
- 譜面・コード進行・各楽器の素の音色は不変。

---

## v197 compact — セクション内の息づき + 境界の番組ID合図

- `engine.js fm-104`: 候補項目 2・3 の消化（ユーザー「候補は全部 OK」）。
- **(2) 静かな節を生かす** — セクションは macro params をプラトーで保持するが、
  14-18 小節ずっと平坦だと静かな節（submerge / hollow）が静止して聞こえうる。
  `INTRA_SECTION_BREATH` を追加 — 節の進行（`barsInto / bars`）に対し `sin` の
  弧で wave / creation / resource を中盤に向け微増・void を微減（節頭と節尾は
  0）。`sectionMacroTarget()` に織り込んだので ANY・ジャンル固定の両経路に
  効く。節の中で「ひと息」分の展開が出る。
- **(3) つなぎの有機的強化** — 未使用気味だった radio-brain ident（番組変更時
  だけ鳴る控えめな和声ジェスチャ）を、セクション境界でも鳴らすよう接続
  （`cueSectionIdent()`）。v193 のフィル（リズムの区切り）＋ ident（和声の
  区切り）で塊のエッジが有機的に立つ。番組変更 cue が既に保留中なら重ねない。
- `fm.html` / `index.html` / `sw.js`: `fm-104`、`hazama-fm-v197`。
- `check-hazama-melody.mjs`: `INTRA_SECTION_BREATH` / `cueSectionIdent` を assert。
- 譜面・音色は不変（節内の緩やかな揺らぎと境界の控えめな合図の追加のみ）。

---

## v196 compact — ジャンル固定モードのセクション展開

- `engine.js fm-103` / `fm.js fm-67`: ユーザー要望「個別ジャンル選択時も展開を
  効かせたい」。原因 — ジャンルピル（ambient / techno 等）を選ぶと automix が
  OFF になり 9 マクロ params が固定 → セクション展開（`updateAutoMixTargets`
  経由）が genre モードに届かなかった（ANY 専用だった）。
- 修正: ジャンル適用時、fm.js が engine へそのジャンルの UCM ベースライン
  （9 fader 値）を `window.setMusicGenreSectionBaseline()` で渡す。engine 側は
  `syncGenreModeSectionControls()`（automix OFF 時に `scheduleStep` から駆動）
  で、セクションの形に沿って params をベースライン周りで「ゆるく」変調
  （`GENRE_SECTION_SCALE` 0.32）。
- `energy` だけは固定 — `chooseMode()` は energy 帯でモードを決めるため、
  energy を動かすとジャンル/モード/テンポが変わってしまう。残り 8 params
  （wave / creation / void / body / resource / circle / observer / mind）が
  動くので、密度・空白感・低域・複雑さが節ごとに展開する。
- 変調は `SECTION_FORM_CENTER`（全 6 セクション target の平均）基準の
  zero-mean ＝ ジャンルから乖離せず息づく。手動 fader 操作中の key は
  manual-influence 期間スキップ。
- `fm.html` / `index.html` / `sw.js`: `fm-103` / `fm.js fm-67`、`hazama-fm-v196`。
- `check-hazama-melody.mjs`: genre-section 関数を assert。
- これで ANY・個別ジャンル双方でセクション展開が効く。`drive`/`space`
  （v193/194）は元々 genre モードでも効いており、今回の 8-param 変調と合わさる。

---

## v195 compact — モード遷移の DJ クロスフェード

- `engine.js fm-102`: ユーザー報告「モードが変わるとき**急に始まって急に止まる**」
  対策。原因 — radio brain がモードを回すたび、`updateSoundForMode` が古い
  モードの sample layer（harp / cello / piano / bass / drum / organ の
  sampler）を**即停止**し、新モードのを full volume で**即開始**していた
  （ハードカット）。
- **修正 ＝ レイヤーのクロスフェード**。これらの sampler は永続で `.volume`
  が ramp 可能なので、モード変更時に古いモードの sampler を約 2 小節かけて
  フェードアウト（フェード後にループを `clear`）し、新モードのを無音から
  フェードイン。`MODE_LAYERS` マップ + `crossfadeOutOtherModes()` /
  `fadeInModeLayers()` を追加し、`updateSoundForMode(mode, transitionSec)` に
  遷移秒数を渡す。`commitPhraseLockedMode` がモード変更時に約 2 小節分を渡す。
  trigger 関数や 18 個の `start*/stop*Layer` 関数は無改変 —
  `updateSoundForMode` とヘルパーのみ。
- BPM について: 調査の結果、BPM はすでに DJ 的に滑らか（`energy` 由来・二重
  スムージング ＋ 1.6s ramp、モード変更で snap しない）。詰まって聞こえたのは
  layer のハードカットが原因 — それを直せば BPM も滑らかに繋がって聞こえる。
- `fm.html` / `index.html` / `sw.js`: `fm-102`、`hazama-fm-v195`。
- `check-hazama-melody.mjs`: クロスフェード関数を assert。
- 音色・譜面・セクション構造は不変（遷移の繋ぎ方のみ）。

---

## v194 compact — セクション仕上げ2: 音詰まり修正 + 強弱拡大 + セクション名表示

- `engine.js fm-101`: 試聴フィードバック対応。
  1. **音詰まり修正** — 「たまにウっと詰まる」の原因を特定。`globalReverb
     .decay` を `updateSoundForMode` がモード毎に再代入していた。Tone.Reverb の
     `decay` は setter で、代入のたびにインパルス応答を OfflineAudioContext で
     再レンダする ＝ 同期 CPU スパイク。radio brain が約 60〜90 秒でモードを
     回すたびにこれが走り、音が詰まっていた。`decay` を構築時の固定値（4.3）に
     し、6 個の per-mode 再代入を削除。モード別のリバーブ感は `wet` で付ける。
  2. **セクションの強弱を拡大** — 「のっぺり・打ち込み的な聞かせどころが欲しい」
     対応。各 `SECTION_PROFILES` に `space`（休符確率の倍率）を追加。surge は
     `drive 1.55 / space 0.40` ＝ 詰まった高密度の「打ち込み」見せ場、hollow は
     `drive 0 / space 1.95` ＝ ドラムの無い空白のブレイク、と振り幅を拡大。
     surge は energy 90（≈ アップテンポ）、hollow は energy 15。
  3. **セクション名を `SectionState.name` に保持**（UI 表示用）。
- `fm.js fm-66` / `fm.html` / `fm.css fm-52`: FM 画面に現在のセクション名を表示
  （`#fm-section`「section · surge」等、`#fm-next` の下）。`window.SectionState`
  から `onRuntimeState` で更新。
- `fm.html` / `index.html` / `sw.js`: `fm-101` / `fm.js fm-66` / `fm.css fm-52`、
  `hazama-fm-v194`。
- `check-hazama-melody.mjs`: `space` と「`globalReverb.decay` 再代入なし」を assert。
- 注: セクション機能は今のところ ANY ピル（AUTOMIX ON）専用。個別ジャンルで
  効かせるのは次弾。

---

## v193 compact — セクション仕上げ: ドラムゲート + 境界フィル

- `engine.js fm-100`: v192 のセクション構造に、世界の差をはっきりさせる 2 点を
  追加。
  1. **セクション・ドラムゲート** — 各 `SECTION_PROFILES` に `drive`（ドラム
     確率の倍率）を追加。submerge / hollow = `drive 0`（ブレイク＝ドラムほぼ
     消える）、flow = `1.0`、surge = `1.3`（高密度ピーク）等。
     `advanceGrooveStructure` で groove governor / mic-follow の後に
     `kickProb` / `hatProb` / `bassProb` を `drive` で再スケール（governor の
     prob スケーリングと同じ場所・同じ手法）。これでセクションごとに「ドラムが
     居る世界／居ない世界」がはっきり分かれる。
  2. **境界フィル** — `SectionState.fillCue` を追加。セクション境界の 1 小節
     手前で `advanceSection()` が cue を立て、`GrooveState.fillActive` を強制
     ON。次の世界へ入る変わり目に必ずフィルが入り、塊のエッジが立つ。
- v192 の連続→離散化に対し、v193 は各セクションの**輪郭**を強める仕上げ。
  楽器の trigger 関数には触れず、既存の prob / fill フラグ経路のみ
  （governor の precedent に倣う）。
- `fm.html` / `index.html` / `sw.js`: `fm-100`、`hazama-fm-v193`。
- `check-hazama-melody.mjs`: `drive` と `fillCue` を assert。
- 譜面・コード進行・音色は不変。

---

## v192 compact — 単調対策: セクション構造（塊・節・世界）

- `engine.js fm-99`: ユーザー報告「まだ単調・ランダム感が気持ち悪い・節ごとに
  世界がある感じが欲しい」への対策。**根本原因**: engine の 9 マクロ
  パラメータ（energy / wave / … / observer）は約3分周期の sine で**常時
  連続 morph** しており、一度も値を「保持」しない。だから音楽は永遠に
  移ろい続け、どこにも定着せず、節・塊として知覚できなかった（散発的な
  ランダム感の正体）。
- **修正 = セクション構造の導入**。`SECTION_PROFILES` — 固定シーケンスの
  「世界」6 つ（submerge 静かな立ち上がり → sprout 芽生え → flow グルーヴ →
  surge 高揚ピーク → hollow 空白のブレイク → return 帰結）。各セクションは
  マクロ params を自分の plateau に**引き寄せて 14〜18 小節 保持**し、
  境界で次の世界へ step する。`SectionState` が小節ごとのクロック
  （`advanceSection()` を `advanceGrooveStructure` から駆動）。
  `updateAutoMixTargets` で各 param の `desired` をセクション plateau へ
  再センタリングし、sine の振れ幅を `SECTION_LIFE_FACTOR`(0.2) まで縮小
  ＝「保持されつつ少し息づく」。plateau の step は既存の `UCM_TARGET →
  UCM_CUR` スムージングで数秒のグライドになる。
- 結果: 連続モーフ → **離散したセクションの連なり**。density・dynamics・
  tempo・音色は各セクションの plateau から導出されるので、世界ごとに
  はっきり表情が変わる。約 4〜5 分で 1 周する曲のような構成。
- `fm.html` / `index.html` / `sw.js`: `fm-99`、`hazama-fm-v192`。
- `check-hazama-melody.mjs`: `SECTION_PROFILES` / `advanceSection` /
  plateau hold を assert。
- 楽器ごとのハード on/off ゲートや境界フィルは未実装（plateau の contrast
  で density は十分振れる）。試聴して「ブレイクで完全にドラムを落としたい」
  等あれば次弾で voice gate を追加。

---

## v191 compact — もっさり対策 第1弾（pad の発音 + リバーブ + groove timing）

- `engine.js fm-98`: ユーザー報告「音がもっさり・流れない」への対策 第1弾。
  発音のキレ（articulation）に絞った修正:
  1. **pad エンベロープ** — haze chord を鳴らす pad は `updateSoundForMode`
     でモード別に attack/release が設定される。ambient は attack 1.5s /
     release 4.0s で、1.5s かけて立ち上がり 4.0s 尾を引くため、小節ごとに
     変わるコードが全部 wash に溶けて輪郭が出ていなかった（v189 で入れた
     コード進行も埋もれていた）。全モードで attack/release を短縮:
     ambient 1.5/4.0→0.6/2.4、lofi 1.2/3.2→0.5/2.0、dub 0.65/2.5→0.4/1.9、
     jazz 0.55/2.2→0.34/1.7、techno 0.35/1.4→0.18/1.0、trance 0.45/1.8→
     0.24/1.3、fallback（funk/piano）1.2/3.5→0.4/2.0。各モードの性格は維持
     （ambient は最も柔らかく、techno は最もタイト）。
  2. **リバーブの尾** — `globalReverb.decay` が長い 3 モードを短縮:
     ambient 6.4→4.5s、dub 6.2→4.6s、trance 6.8→4.6s。まだ広い空間だが、
     小節間隔のコード変化で尾が消えきらず濁る状態を解消。
- `audio/human-groove-governor.js`: groove の micro-timing を片側遅れ
  （`(sign+1)*0.5` で 0〜maxJitter の常時 late）から **拍中心**（`sign*0.5`）
  へ。全ノートが必ず後ろにずれる一方向ドラッグが「もっさり」の一因だった。
  スプレッド幅は同じまま、拍の前後へ均等に揺れるよう中心化。
- `fm.html` / `index.html` / `sw.js`: `fm-98`、`hazama-fm-v191`。
- 出音の譜面・コード進行・音色キャラクターは不変（発音の速さと残響長のみ）。
- **これは第1弾（もっさり/キレ）**。次弾は「単調・展開不足」対策
  （dynamics レンジ拡大・arc 強化）を試聴フィードバック後に予定。

---

## v190 compact — 音のフロー / キックのノイズ対策（先読みスケジューリング）

- `engine.js fm-97`: 「音が自然につながらない」「キックがたまにノイズ」報告
  への対策。スケジューリングの安全余裕を 3 点で拡げた:
  1. **先読みヘッドルーム拡大** — `ToneScheduleGuard.nowLeadSec` を 4ms→30ms。
     遅延した Transport step や raw `currentTime` 基準のジェスチャは要求時刻が
     "ほぼ過去" になることがあり、4ms では描画クォンタム＋メインスレッド
     ジッタの内側に入って attack が切れて鳴る（＝クリック）。30ms 確保で
     オーディオスレッドが余裕を持って発音でき、Tone の 100ms lookAhead 内
     なので定刻ノートは不変。
  2. **キックのリトリガー debounce** — `kick`（monophonic MembraneSynth）は
     punch パッド / acid trace / ambient ghost-pulse の複数経路から鳴り、
     同じ step で ~10-30ms 差で衝突すると 2 発目が transient 途中で synth を
     再起動 → ピッチ/振幅エンベロープの不連続がクリックになる。
     `toneVoiceRetriggerTooSoon()` を追加し、前回発音から 60ms 以内に重なる
     キックは時刻シフトせず drop（クリーンな 1 発を残す）。
  3. **パッドジェスチャの先読み** — `triggerPadSignature()` はパッド押下時に
     `now+0.002 … now+0.176` の多層オンセットを raw `currentTime` 基準で
     組んでいたため前半が先読み窓に入りきらなかった。基準を
     `currentTime + 50ms` にずらし、ジェスチャの形を保ったまま窓内に収めた。
- `fm.html` / `index.html` / `sw.js`: `fm-97`、`hazama-fm-v190`。
- `check-hazama-melody.mjs`: nowLeadSec ヘッドルーム / kick debounce /
  パッドジェスチャ先読みを assert。
- 出音の譜面・音色・コード進行は不変（スケジューリングの安全余裕のみ）。
  BL-022 entry が予告した「次レバー = lookahead」の的を絞った適用。

---

## v189 compact — pad の意図的コード進行

- `engine.js fm-96`: haze pad の和声を「ランダム pool 拾い」から**意図した
  コード進行**へ。pad の `randomHazeChord()` は `chordTurn + ランダム(0–5)` で
  キー内のコードを毎回ランダム選択していた（機能進行なし）。`HAZE_CHORDS` は
  D メジャーのダイアトニック一式（0=I 1=IV 2=ii 3=iii 4=V 5=vi）なので、
  `HAZE_CHORD_PROGRESSION` をジャンル別に定義（ambient=I-vi-IV-I / jazz=ii-V-I-vi /
  trance=vi-IV-I-V 等、既存 `MELODIC_DIRECTOR_KEY_ORDER` の性格に対応）。pad は
  小節ごと（`GrooveState.cycle`）に進行を1歩進め、phrase 単位のキー転調は
  既存 director がその上に乗ったまま。新コードの作曲ではなく既存 voicing の
  並び替え。進行は index 配列なので試聴で調整可。
- `fm.html` / `index.html` / `sw.js`: `fm-96`、`hazama-fm-v189`。
- `check-hazama-melody.mjs`: `HAZE_CHORD_PROGRESSION` の定義と pad 経由を assert。

---

## v188 compact — BL-004: 40Hz focus depth A/B 切替

- `audio/music-focus-modulation.js fm-95`: 40Hz focus depth を A/B 試聴できる
  ように。`?focusDepth=` URL パラメータで起動時 depth を上書き（`?focusDepth=5`
  →5%、`?focusDepth=8`→8%、bare fraction も可）。`window.MusicFocusModulation
  .setDepth()` も追加（console から再読込なしで切替可）。default は 8% のまま。
- `fm.js fm-65`: focus mode の status 表示に現 depth を併記（`40 hz 8%` /
  `40 hz 5%`）— A/B 中にどちらを聴いているか分かる。
- `fm.html` / `index.html` / `sw.js`: `fm-95` / `fm.js fm-65`、`hazama-fm-v188`。
- 用途: BL-004 — `fm.html`（8%）と `fm.html?focusDepth=5`（5%）を聴き比べ、
  8% AM が耳に違和感を出すか判定。決まった値を default にする。

---

## v187 compact — BL-022: PolySynth maxPolyphony cap（音詰まり対策）

- `engine.js fm-94`: Hazama FM ブラウザ再生の音詰まり（同時起動音での負荷
  スパイク）対策。`pad` PolySynth の `maxPolyphony` を 64→24、`pianoMemory` を
  48→24 に下げ、発音数に天井を設けた。`pad` は 3.5s release の `1n`/`2n`
  haze chord を 20+ 経路から鳴らすため上限過大だと voice が積み上がり CPU
  スパイクになっていた。超過時は最古（深い減衰中＝ほぼ不可聴）の voice を
  steal。`pianoMemory` は短尺 note なので 24 で十分な余裕。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-94`、`sw.js hazama-fm-v187`。
- 出音ロジック・コード進行・音色は不変（polyphony 上限のみ）。次レバーが要れば
  `Tone.context.lookAhead` / `latencyHint: "playback"`（BL-022 entry 参照）。

---

## v186 compact — Hazama FM mobile layout fix (BL-022 隣接)

- `fm.css fm-51`: スマホ／PWA standalone で `#fm-shell` が `position: fixed;
  inset: 0` の非スクロール容器だったため、コントロール群が viewport より
  約 410px 高くなると下部（`40HZ` ボタン等）に届かず、上部も `black-translucent`
  status bar に潜っていた。`overflow-y: auto`（+ `-webkit-overflow-scrolling`）で
  スクロール可能化、`pointer-events` をシェル自身が受けるよう変更、`padding` を
  `env(safe-area-inset-*)` 対応にし、`justify-content` を `safe center` 化。
- `fm.html` / `sw.js`: `fm.css?v=fm-51`、`sw.js hazama-fm-v186`。
- 出音・engine ロジックは不変（CSS のみ）。



- `audio/music-hazama-feedback.js fm-93`: BL-008 next extraction。Hazama runtime
  feedback telemetry cluster（9 functions / 約180行）を engine.js から
  IIFE module へ移動。`music-runtime-feedback` payload を build して
  opener / parent window へ postMessage し、`window.MusicHazamaFeedback` を公開。
- `engine.js fm-93`: feedback cluster を module alias に置換。4 つの
  interleaved Hazama-bridge helpers（`hazamaAutoFollowActive` 等）は
  engine.js 側に維持。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-93`、
  `audio/music-stack-routing.js?v=fm-93`、`audio/music-focus-modulation.js?v=fm-93`、
  `audio/music-recorder.js?v=fm-93`、`audio/music-packet.js?v=fm-93`、
  `audio/music-hazama-feedback.js?v=fm-93` に cache bump。
- `sw.js hazama-fm-v185`: fm-93 assets を precache。

## v184 compact — engine packet module

- `audio/music-packet.js fm-92`: BL-008 next extraction。metadata-only の
  Music session / orchestra packet builder cluster（約700行）を engine.js から
  IIFE module へ移動。`window.MusicPacketKit` を公開。
- `engine.js fm-92`: packet builder cluster を module alias に置換し、
  既存の `window.MusicSessionPacket` / `window.MusicOrchestraPacket`
  publication は engine.js 側に維持。
- `audio/music-recorder.js` / `engine.js`: v183 回帰修正。共有 `#status-text`
  writer の `setRecorderStatus` は recorder だけでなく mic・packet code からも
  呼ばれるが、v183 の recorder 抽出で IIFE に閉じ込めてしまっていた
  （mic toggle と packet sync が `ReferenceError` になる）。
  `window.MusicRecorder.setStatus` として公開し直し、engine.js 側に alias を追加。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-92`、
  `audio/music-stack-routing.js?v=fm-92`、`audio/music-focus-modulation.js?v=fm-92`、
  `audio/music-recorder.js?v=fm-92`、`audio/music-packet.js?v=fm-92` に cache bump。
- `sw.js hazama-fm-v184`: fm-92 assets を precache。

## v183 compact — engine recorder module

- `audio/music-recorder.js fm-91`: BL-008 next extraction。FM `REC`
  button の `RecorderState` + `MediaRecorder` capture cluster を engine.js から
  IIFE module へ移動。`window.MusicRecorder` を公開。
- `engine.js fm-91`: local recorder cluster を module alias に置換し、
  既存の REC button / teardown の `toggleLocalRecorder` / `stopLocalRecorder` flow は維持。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-91`、
  `audio/music-stack-routing.js?v=fm-91`、`audio/music-focus-modulation.js?v=fm-91`、
  `audio/music-recorder.js?v=fm-91` に cache bump。
- `sw.js hazama-fm-v183`: fm-91 assets を precache。

## v182 compact — engine focus modulation module

- `audio/music-focus-modulation.js fm-90`: BL-008 next extraction。FM `40HZ`
  button の 40 Hz focus AM state / LFO / ramp / UI event dispatch cluster を
  engine.js から IIFE module へ移動。`window.MusicFocusModulation` を公開。
- `engine.js fm-90`: focus modulation cluster を module alias に置換し、
  既存の `window.setFmFocusModeEnabled` / `window.getFmFocusModeState` API は維持。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-90`、
  `audio/music-stack-routing.js?v=fm-90`、
  `audio/music-focus-modulation.js?v=fm-90` に cache bump。
- `sw.js hazama-fm-v182`: fm-90 assets を precache。

## v181 compact — engine dormant audit cleanup

- `engine.js fm-89`: BL-017 audit pass。`randomNoteFromScale()` は未参照の
  legacy helper と確認できたため削除。既存 melodic director / chord path には影響なし。
- BL-017 前提訂正: `FocusModulationState` は FM の `40HZ` button + engine API、
  `AcidLockState` は `btn_acid_lock`、`MicFollowState` は Core/FM mic controls として
  現役。削除/復活対象ではなく、残る判断は BL-004 の 40Hz depth A/B。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-89` と
  `audio/music-stack-routing.js?v=fm-89` に cache bump。
- `sw.js hazama-fm-v181`: fm-89 assets を precache。

## v180 compact — Band Room kit source labels

- `band-room.js br-87`: kit selector labels now distinguish `synth:` from
  `sample:` sources, making the AI drum synth vs current-song/catalog sample kits
  scannable without changing the default `auto-self` behavior.
- `band-room.html` / `sw.js`: `band-room.js?v=br-87` cache bump。
- `sw.js hazama-fm-v180`: Band Room script markerをprecache。
- `check-band-room-logic.mjs`: Band Room script markerを literal ではなく
  HTML/SW の同期で検証し、kit label の区別も guard。

## v179 compact — music-stack route recommendation module

- `audio/music-stack-routing.js fm-88`: BL-008 Step B。`musicStackRoutingRecommendation`
  の scoring / destination decision を engine.js から純関数 `routingRecommendation`
  として移動。Tone.js / DOM / engine state 依存なし。
- `engine.js fm-88`: runtime defaults（selfReview / parts / gradient / kits /
  activePads / Hazama FM cue / producer habit curiosity）を集めて module に渡す
  thin adapter に縮小。挙動は保存。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-88` と
  `audio/music-stack-routing.js?v=fm-88` に cache bump。
- `sw.js hazama-fm-v179`: fm-88 assets を precache。

## v178 compact — engine.js modularization step 1 (music-stack routing)

- `engine.js fm-87`: engine.js モノリス（約14.8k行）の部分モジュール化 第1歩（BL-008）。
  cross-repo ルーティング推薦クラスタ（`MUSIC_STACK_ROUTE_*` / `hazamaFmReviewCue`、
  純データ + 純関数 約140行）を engine.js から新規 `audio/music-stack-routing.js` へ抽出。
  engine.js 側は `window.MusicStackRoutes` への 3 行エイリアスに置換。挙動は完全保存。
- `audio/music-stack-routing.js`: 新規モジュール（IIFE、`window.MusicStackRoutes` を公開）。
  既存 helper（`audio/human-groove-governor.js` 等）と同じ satellite-script パターン。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-87` に cache bump、新モジュールを追加。
- `sw.js hazama-fm-v178`: `engine.js?v=fm-87` と `audio/music-stack-routing.js?v=fm-87` を precache。

## v177 compact — Hazama FM melody harmony + humanize

- `engine.js fm-86`: Hazama FM の primary メロディ voice（memory pluck signature
  cell `triggerMemoryPluckSignatureCell`）に和声と humanize を追加。
  - **和声**: 単音だった lead の下に `MODE_CHORDS` の chord tone を 2 声、phrase
    ごと（`MelodicDirectorState.chordTurn`）に回しつつ soft に重ねる。「弾いた
    和音」の厚みを付与。
  - **humanize**: accent 音は長め（"8n"/"16n"）に鳴らして breathe、lead velocity に
    per-hit jitter を追加。固定 "32n" の機械感を緩和。
  - engine.js 凍結ルールに対し、1 関数に境界限定 + feature branch + PR で実施。
- `fm.html` / `index.html` / `sw.js`: `engine.js?v=fm-86` に cache bump。
- `sw.js hazama-fm-v177`: `engine.js?v=fm-86` を precache。

## v176 compact — Hazama FM funk voice timbres enriched

- `audio/genre-flavor.js fm-71`: Hazama FM の funk EP (Rhodes) を、和音を
  一括同時発音する flat block から **per-note ロール (8-22ms ずらし) +
  voice ごとの velocity ばらつき** に変更。jazz comp / piano voice と
  同じ「弾いた和音」の質感に揃えた。`buildFunkDefault` と
  `buildFunkFromFrames` の両経路。
- funk clavi のフィルターを **velocity 追従** に変更。強打で bite が
  明るく開き、弱打は丸く残る。これまでは静的 cutoff で全ノート同一音色
  だった。全体音量は据え置き。
- `fm.html` / `sw.js`: `audio/genre-flavor.js?v=fm-71` に cache bump。
- `sw.js hazama-fm-v176`: `audio/genre-flavor.js?v=fm-71` を precache。

## v173 compact — Hazama FM conversation SYNC metadata

- `engine.js fm-85`: Hazama FM v172 の
  `window.HazamaFlavorState.conversation` を
  `performance_state.hazama_fm.conversation` に metadata-only で載せる。
  内容は 8小節会話の `role` / `motif` / `transform` / `densityBias` /
  `restGate` だけで、旋律、コード進行、音声、サンプルは含めない。
- `docs/schema/music-session-packet.schema.json` と example packet を同期。
- `sw.js hazama-fm-v173`: `engine.js?v=fm-85` を precache。

## v172 compact — Hazama FM groove conversation

- `audio/genre-flavor.js fm-70`: Hazama FM の parallel flavor layer に
  `GrooveConversationState` を追加。8小節 cycle で `bass-call` /
  `comp-answer` / `drum-comment` / `space` / `lead-call` /
  `bass-answer` / `comp-lift` / `recap` を回し、ベース、コンピング、
  ドラム、リードが同時に鳴り続けるのではなく呼応するようにした。
- `window.HazamaFlavorState.conversation` に `{ version, bar, role, motif,
  transform, densityBias, restGate }` を公開。既存の `sessionRole` /
  `leadVoice` / `phraseBar` / `phrase8Bar` / `movement` / `dropBar` /
  `keyShift` / `groove` は維持。
- `sw.js hazama-fm-v172`: `audio/genre-flavor.js?v=fm-70` を precache。

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
