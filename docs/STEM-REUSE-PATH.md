# Stem 流用 — Tabasco / UNRIPE 音を AI 再現に取り込む

## 目標
分離した stem (vocals/drums/bass/other) を「**素材**」として AI 再現側に再利用する。
Hazama FM の純粋合成 (Tone.js synth) と違って、本物の演奏音色を借りて新しい曲を作る道。

## 3 段階の再利用シナリオ

### Phase A: そのままレイヤとして overlay (今すぐ可能)
band-room の `stems` モードと `synth` モードを同時に鳴らす。
例: UNRIPE Continuous の drums だけ ON、Tabasco Human Fly の verse 進行で歌う。
キー/BPM 違うのでぐちゃぐちゃになるが、**実験用** には面白い。

### Phase B: スライス → サンプラー化 (中規模作業)
個別ヒットを切り出して `Tone.Sampler` に食わせる。

```bash
# 例: UNRIPE drums.mp3 から kick / snare 単発を切り出す
# librosa.onset_detect で打点検出 → soundfile で個別 wav 出力
python scripts/_slice_drum_hits.py unripe definition
# → presets/unripe-samples/definition/kick-{N}.wav (~30 files)
# → presets/unripe-samples/definition/snare-{N}.wav
```

`band-room.js` で:
```js
const unripeKick = new Tone.Sampler({
  urls: { "C2": "presets/unripe-samples/definition/kick-01.wav" }
}).connect(drumBus);
```

drum-floor フレームの kick 音色を UNRIPE 本物 kick に差し替え可。Definition (143 BPM 暗め) の kick で Tabasco を再合成すれば、本物の音色 × 異なる構造の新曲。

### Phase C: 完全新曲生成 (大規模)
6 曲 × 4 stem = 24 stem を素材ライブラリ化。
新曲は band-room の song-track JSON に「素材源」を指定。
例:
```json
{
  "format": "song-track",
  "song_id": "new-song-1",
  "samples_source": {
    "drums": "unripe/definition",
    "bass":  "tabasco/human-fly",
    "other": "unripe/erase"
  },
  "structure": [...]
}
```

→ Tabasco のベース + UNRIPE のドラム + UNRIPE other (gtr) で新曲合成。
本物の音色なので Tone.js 純合成より遥かに「演奏感」が出る。

## 実装優先度

| Phase | 工数 | 効果 |
|---|---|---|
| A (overlay) | 0 (今動く) | 実験、A/B 比較 |
| B (sampler) | 中 (slice script + sampler integration) | drum-floor 音色を本物に差し替え |
| C (生成) | 大 (新 schema + ETL + UI) | 完全新曲の作曲補助 |

## 次のステップ

Phase B から始めるなら:
1. `scripts/_slice_drum_hits.py` を librosa.onset_detect ベースで書く
2. UNRIPE Continuous の drums 1 曲だけ試す (~30-50 hits 抽出予想)
3. `presets/unripe-samples/continuous/` に配置
4. band-room.js に `samplerMode` 追加: drum-floor のフレームを sample 再生で発音
5. 比較試聴

ユーザーから「sampler 進めて」言われたら Phase B 着手。

## 注意

- 当該 stems / samples はバンドの私的音源由来。公開リポでは band-room に音源コピー入っているが、**外部配布・販売は不可**
- リファレンス利用 (synthesis target としての参照、analysis 用) は許容範囲
- Phase C で新曲合成した結果は「お前のバンドが弾いてる風の新曲」になるので、用途は自分の創作補助のみ
