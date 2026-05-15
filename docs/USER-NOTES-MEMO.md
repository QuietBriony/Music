# User Notes Memo

ユーザーから受け取ったメモ + 現状ステータス。バージョン毎に追記。

---

## 2026-05-15 (post-v140 メモ受領、v141 で部分対応)

### Band Room — 車から音量触れない問題

> 音量、車から触れるようにしたいね。Pcは触れたけど。
> 車のミュージック音量ボタン押しても、音量固定。

**原因の見立て:**
- iOS Safari の Bluetooth A2DP absolute volume issue (車のハードウェアボリュームが Web Audio AudioContext に届かない)
- もしくは車側で web 音声を別ストリーム扱い (volume button が車のアンプ出力のみ制御し、phone 側に AVRCP volume コマンドを送らない)

**v141 対応:**
- ✅ `#br-master-vol-bar` を header 直下に常時表示で追加 (band-room.html / band-room.js / band-room.css)
- 0-100 のリニアスライダー + ⊖ / ⊕ 5刻みボタン
- 28×28px の thumb + 44×44px のボタンで車 / touch でも操作可
- localStorage で persist (page unload に強い)
- 既存 `br-loudness` (-12〜+6 dB) は mastering 内に残置で fine-tune 用

**残課題 (v142 以降の選択肢):**
- ✅ v144: Media Session API の `setActionHandler("seekbackward"/"seekforward", ...)` を音量 down/up に remap。Band Room / Music Core Rig / Hazama FM で、対応車載機が rewind/forward 系 AVRCP を送る場合はアプリ内音量を ±5 で操作できる。実ボリュームキーをブラウザが直接捕まえるものではないため best-effort。
- ✅ v145: Hazama FM で効いていた iOS Safari 向け hidden `<audio srcObject=MediaStream>` bridge を Band Room に移植。Band Room の WebAudio 最終 mix を HTMLAudioElement 経由にも流し、車側に通常メディア音声として扱われやすくする。
- ✅ v149: master volume と `br-loudness` を乗算関係にし、車載用 0-100 volume と mastering loudness が互いに上書きしないよう修正。`audio/audio-safety.js?v=br-66` も precache。
- ✅ v150: route pill (`bridge` / `direct`) を追加し、hidden media bridge が有効か UI で確認可能にした。master volume `0` の reload 復元も修正。
- ✅ v151: hidden media bridge を user gesture window 内で先に開始し、bridge loss 時は direct output へ復帰。master volume bar も sticky 化。
- ✅ v153: Media Session next/previous track を Band Room の album flow に合わせ、
  手動 track change 中も hidden bridge を維持。Hazama FM / Music Core Rig 側の
  hidden bridge も health fallback を追加し、stale-silent 時は direct output に復帰。
  狭幅でも route badge を 1 文字表示で残す。
- 保留: AudioContext を `latencyHint: "playback"` で再構築 (効果は環境依存、現状 bridge 優先)
- 保留: HTMLAudioElement 経由の出力に全面切替 (大規模 refactor、Tone.js だと現実的でない)

---

### Hazama FM — リズム単調 + 転調タイミング気持ち悪い

> Hazama fm リズムパターン単調かつ、変なタイミングで、転調がはいるから、気持ち悪いところがある。
> 音質は良くなってるので、気持ちいい方向の理論構築とか引っ張り実装、マルチエージェントで、進めて。

**現状の良化分 (昨日のメモから今日までで既に効いてる):**
- v132 (fm-68): triple-swing 解消 — Transport.swing は mode-fixed (lofi/jazz/dub は 0)、D'Angelo extraMs を 75-80% 削減
- v138 (fm-69): band-room v133 Dilla per-step microOffsets を engine.js に移植 — lofi/jazz/dub/funk に mode 別 snare drag + hat off-beat push
- v139 (fm-70): mic follow groove で kick/hat 速度をリアルタイム動的化
- v140 (fm-71): Magenta DrumsRNN AI fill burst で 4-8 小節の AI バリエーション生成可能に

**v142-v147 で対応済み:**
1. ✅ **転調タイミング** — v142 で 16 bar phrase 境界 gate + pending mode を追加。manual preset は即時変更のまま。
2. ✅ **リズム単調さ** — v143 で 4 bar ごとの小さな kick/hat/skin variation、16 bar reset を追加。
3. ✅ **ジャンル連携** — v146 で trap / soul-funk pattern と Hazama FM → Band Room suggestion を追加。
4. ✅ **focus mode** — v147 で default OFF の 40Hz / 8% AM を追加。AI fill burst 中は自動 suppression。

**次に残すなら:**
- 実車 / Bluetooth で v145-v153 bridge が車側の volume / track button に認識されるか確認。実装は入っているので、残りは実機 validation。
- Hazama FM の 40Hz focus mode は耳で違和感がないか A/B。強く感じる場合は depth を 5% へ落とす。

---

## マルチエージェント方針メモ

> 消費早いから、マルチじゃなくシングルで、続きに統合できるようにして。

→ v141 から Claude 側は **シングルエージェント / 直接編集** に切替。コンテキスト消費を線形に抑える。

> Financeみたいに、Codexcliも呼んでいいけど。計算資源、マックスで捌いてみて。
> 実際それでパフォーマンスどうなのかは、一回回して推奨教えて。
> 余裕あれば、Claudeマルチ＋Codexcliマルチ　で、回すべきかさ。

→ パフォーマンス所感:
- **Claude マルチ (Agent tool) の利点**: 並列で複数ファイル同時編集、独立タスクなら 2-3 倍速
- **Claude マルチの欠点**: 親 context にエージェントの出力サマリ全部戻ってくるので、context 消費が線形〜超線形。3 エージェント並列ループを 5 回回すと圧縮必須
- **Codex CLI の利点**: 別プロセスで動くので親 Claude の context を消費しない。GitHub Pages へ push されたコードをそのまま編集できる
- **Codex CLI の欠点**: Claude と異なる挙動 / フォーマット、レビュー / merge が必要
- **推奨運用**: 
  - 親 Claude は「設計 / レビュー / 仕上げ / 引き継ぎドキュメント作成」に専念
  - 重い実装 R&D タスクは Codex CLI に投げる (handoff doc 経由)
  - 並列が必要ならば: Claude シングル + Codex 1-2 本 が context 効率最良
  - Claude マルチ + Codex マルチ は爆速だが、Claude 側を 1-2 エージェントに留めればトークン破綻しない

2026-05-15 v150 では、ユーザー指示に合わせて Claude 親 + read-only 監査
subagent 3 本で棚卸しし、親が実装を統合した。編集 agent を並列に増やすより、
監査並列 + 親実装の方が merge risk が低く、今回のような runtime cleanup には合っていた。

---

## Changelog

- v141 (2026-05-15): メモファイル新設、master volume bar 追加、Codex 引き継ぎドキュメント整備
- v142 (2026-05-15): Hazama FM mode change を 16 bar phrase 境界に lock
- v143 (2026-05-15): Hazama FM drum pattern に 4 bar variation / 16 bar reset を追加
- v144 (2026-05-15): Media Session seekbackward/seekforward をアプリ内音量 ±5 に割当 (Band Room / Music Core Rig / Hazama FM)
- v145 (2026-05-15): Hazama FM の background audio bridge を Band Room に移植し、車載/BT のメディア音量認識に寄せる
- v146 (2026-05-15): trap / soul-funk genre patterns 追加、Hazama FM genre から Band Room pattern suggestion へ連携
- v147 (2026-05-15): Hazama FM に default OFF の 40Hz focus mode を追加 (8% AM、AI fill 中 suppression)
- v148 (2026-05-15): Codex task status / cross-doc sync
- v149 (2026-05-15): 長時間 session / 車載音量 cleanup。master volume × `br-loudness`、stale FM suggestion clear、debug log gating
- v150 (2026-05-15): Band Room route status、FM fade promise / Media Session / session save quieting、focus event quieting
- v151 (2026-05-15): audit gate 強化、Band Room bridge hardening、FM start/stop hardening、40Hz focus gain 修正
- v152 (2026-05-15): Band Room reload default を 01 に戻し、曲末は同曲 loop ではなく次 track へ auto advance
- v153 (2026-05-15): Band Room Media Session next/previous track を album flow に合わせ、手動曲変更中も bridge 維持。FM/Core hidden bridge health fallback 追加
- v154 (2026-05-15): Hazama FM / Music Core Rig の browser playback を増音。FM target OUTPUT 88、engine output curve と GenreFlavor level を上げる
- v155 (2026-05-15): Band Room footer に Drum Floor 導線追加。現曲 / BPM / section / drum frame を metadata-only SYNC で渡し、drum-floor 側は手動 preview のまま
- v156 (2026-05-15): Hazama FM に Band Room 導線を追加。FM genre を Band Room の genre pattern suggestion へ query + localStorage で渡し、Band Room からも近い FM genre へ戻れる
- v157 (2026-05-15): Drum Floor から Band Room へ戻る `song` query を受け、通常 reload は 01 のまま source song だけ復元できるようにした
- v158 (2026-05-15): Hazama FM に route badge を追加。車載 / Bluetooth 確認時に `direct` / `bridge` / `failed` を見える化
- v159 (2026-05-15): Hazama FM から Drum Floor へ直行導線を追加。FM genre / energy / BPM を metadata-only SYNC + query fallback で渡し、検証済みPR/branchは全mergeで締める運用に更新
- v160 (2026-05-15): Hazama FM route badge に診断 panel と `rearm` を追加。hidden audio bridge の loss / output / AudioContext を見て、車載・BTで音量 route が崩れた時に direct 復帰 + bridge 再arm できる
