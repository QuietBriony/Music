# Listening Loop — Music の独立試聴実験

2026-09-14 / BL-048 / preview、採用判定は未完了。

## 境界（取り込み前の sidecar）

ユーザーの「単調で差がわからない」「既存musicつかっていいよ」を受け、
`experiments/listening-loop/v1/` だけで 20 秒 × 3 案の比較を行う。
Music が既に使う Tone.js 14.8.49 と、既存 reference recipe の
和声の霞・短い反復・局所的なリズムずれ・引き算という設計知識を使う。
録音を解析した結果ではなく、既存 docs の解釈から作る新規の楽譜・合成音である。
音源、歌詞、外部プロジェクトのコードは取り込まない。

FM / Core Rig / Band Room の default、OUTPUT、AutoMix、recorder、storage、
`engine.js`、root `index.html` / `style.css`、`sw.js` は変更しない。
Hazama と Openclaw-lab の実装は今回の対象外。公開先は既存 Music GitHub Pages。
この URL を明示的に開き、再生を押した時だけ音声を起動する。
バージョンをディレクトリで固定する（既存 SW の ignoreSearch cache 対策）。
新しい SW、サーバー、API、GPU、モデルの重み、自動アップロードは追加しない。

## データの出自

取り込むのはハエの**脚運動回路の一部分**を表す JSON データだけ。
MaleCNS v1.0 由来の 1,045 ニューロン、17,224 接続、708,689 contacts。
全脳でも、生体を再現した証明でもない。

- 固定 source: [Fly Lab の locomotor_circuit.json](https://raw.githubusercontent.com/Apolotary/fly-lab/631ada7f1e074581ac986e91c7e68ad7074fedb1/data/locomotor_circuit.json)
- Fly Lab revision: `631ada7f1e074581ac986e91c7e68ad7074fedb1`
- 同データの元 extraction: DesktopFly `32b00011e83c3dc85fa3ea0b3934155b04f1635d`
- [取り込み元の notices](https://github.com/Apolotary/fly-lab/blob/631ada7f1e074581ac986e91c7e68ad7074fedb1/THIRD_PARTY_NOTICES.md)
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Credit: MaleCNS collaboration — FlyEM at HHMI Janelia, University of Cambridge,
  MRC Laboratory of Molecular Biology, Google Research. Extraction/provenance: Denis Shiryaev.
- 1,076,374 bytes / SHA-256 `8f76d94034dcf802453e3a0a8ed5342d122e57d37e2bb5ea28da66de0856f5d6`

`node scripts/import-listening-circuit.mjs` はこの 1 ファイルだけを上限付きで取得し、
size / hash / schema を確認して未使用の固定出力先に保存する。
既存ファイルは同一なら検証のみ、異なる場合は上書きせず失敗する。
JSON は byte 無改変。元の巨大な CNS CSV やアプリ・学習済みモデルは取得しない。

## 音への翻訳

独自の離散時間・正規化再帰モデルを使用する。接続の符号、外部刺激、
減衰と順応、時間尺度、音への対応は**モデル上の仮定**。
実測 topology と、こちらで決めた dynamics を混同しない。
6 脚の motor readout を、メロディの選択・反復・拍の置き方に変換する。
再生前に有限長を計算するため、再生中に大きな神経シミュレーションを回さない。

8 小節 / 96 BPM / 20 秒で、霞む和音・ずれたビート・光る断片の 3 方向から始める。
共通のキーとテンポ、低めの出力、休符、問いと応答、途中の間引きと回帰を持つ。
「回路なしのルール」条件も同じ刺激・seed で比較できる。
回路がイベントを変えたという検証と、音楽が良くなったという人の評価は別物。

## フィードバックと RSI の境界

「これを育てる」「どれも単調」「差がわからない」を受け、次の 3 案の探索幅と
和声・リズム・余白・崩しのパラメータを変える。大きい音を報酬の代わりにしない。
固定 seed / 同じ評価列なら同じ楽譜を再生成できる。好みの学習は session 内だけ。
回路の接続・ソースコード・評価基準を自動で書き換える **RSI は未実装**。

任意の「実験メモを保存」は、seed、条件、候補パラメータ、聴いた秒数、
定型評価、生成戦略 version を含む JSON を端末に保存するだけ。
生音、自由入力、名前、端末情報、認証情報は含めない。自動送信・永続 storage はない。
最大 12 round、明示クリックでのみ次へ進む。タブを閉じると session は消える。

Openclaw-lab へ渡すのは、本人の試聴が得られた後のこのメモと比較結果。
次工程では「候補をどう作り、どう比べるか」の仮説を 1 件ずつ、固定 baseline と
未使用 seed で評価する。高い数値だけで昇格しない。自動接続・実行は今回行わない。

## 検証と human gate

- 自動: provenance/hash、同 seed の再現、回路 ablation、評価による更新、
  event/time/voice/parameter の上限、固定出力方針、既存 runtime 非干渉。
- browser: 初期無音、20 秒で停止、連打、途中停止、volume、非表示停止、
  失敗時の再試行、3 案更新、320 px / mobile width、console。
- 本人: 3 案の違い、音楽としての好み、実 iPhone Safari の初回再生と復帰。
  desktop の機械検査や波形数値で、これらを合格にしない。

再現・検証結果は SESSION-LEDGER に追記する。

ローカルの単一checkは `node scripts/check-listening-loop.mjs`。
元データの再importは既存byteの検証に留め、新しい出力は作らない。
browser QAではTone.Offlineで初回3案の全20秒をrenderし、定数palette補正後の
RMS差約2.24dB、最大peak 0.376（volume 100%）を確認。これは左chの数値検査で、
聴感・LUFS・実機の音量安全性の保証ではない。通常初期volumeは35%。
