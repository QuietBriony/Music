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
- Media Session API の `setActionHandler("seekbackward"/"seekforward", ...)` を音量 down/up に remap してハードウェアボタン経由でも触れるようにする (一部の車で AVRCP の rewind/ff を音量ボタンに割り当てている場合に効く、hack)
- AudioContext を `latencyHint: "playback"` で再構築 (Web Audio の category を "media" 寄りに)
- HTMLAudioElement 経由の出力に切り替え (大規模 refactor、Tone.js だと現実的でない)

---

### Hazama FM — リズム単調 + 転調タイミング気持ち悪い

> Hazama fm リズムパターン単調かつ、変なタイミングで、転調がはいるから、気持ち悪いところがある。
> 音質は良くなってるので、気持ちいい方向の理論構築とか引っ張り実装、マルチエージェントで、進めて。

**現状の良化分 (昨日のメモから今日までで既に効いてる):**
- v132 (fm-68): triple-swing 解消 — Transport.swing は mode-fixed (lofi/jazz/dub は 0)、D'Angelo extraMs を 75-80% 削減
- v138 (fm-69): band-room v133 Dilla per-step microOffsets を engine.js に移植 — lofi/jazz/dub/funk に mode 別 snare drag + hat off-beat push
- v139 (fm-70): mic follow groove で kick/hat 速度をリアルタイム動的化
- v140 (fm-71): Magenta DrumsRNN AI fill burst で 4-8 小節の AI バリエーション生成可能に

**まだ残ってる問題:**
1. **リズムパターン単調** — kick/hat の基本パターンが mode 内で固定。4 小節毎の variation が無いので長時間聴くと飽きる
2. **転調タイミング気持ち悪い** — `advanceMusicRadioBrain()` が UCM 値の閾値で mode 切替を発火する設計で、musical phrase 境界 (16/32 小節) を尊重していない。途中で「ガクッ」と変わる感覚

**v141 では対応保留** — 単発 R&D タスクとして Codex CLI へ引き継ぎ (docs/CODEX-HANDOFF.md 参照)

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

---

## Changelog

- v141 (2026-05-15): メモファイル新設、master volume bar 追加、Codex 引き継ぎドキュメント整備
