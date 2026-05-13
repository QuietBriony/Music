# sample-instruments/ — Tone.Sampler 用の素材置き場

Band Room の AI 再現モードで使う **guitar / bass** を、合成 synth (Tone.PolySynth)
から **本物のサンプルベース (Tone.Sampler)** に切り替えるための素材を置く場所。

無いと AI 再現は今まで通り synth で鳴る。あれば band-room.js が自動検出して
Sampler に差し替える (実装は band-room v91 で予定)。

---

## 期待されるディレクトリ構造

```
presets/sample-instruments/
├── guitar/
│   ├── manifest.json           # 必須: 存在する音域 + velocity の一覧
│   ├── E2.wav                  # 単音 (E2 = 開放6弦)
│   ├── A2.wav
│   ├── D3.wav
│   ├── G3.wav
│   ├── B3.wav
│   ├── E4.wav                  # 開放1弦
│   └── (任意で多 velocity:  E2-soft.wav / E2-hard.wav 等)
│
└── bass/
    ├── manifest.json
    ├── E1.wav                  # 開放4弦
    ├── A1.wav
    ├── D2.wav
    ├── G2.wav
    └── (任意で多 velocity)
```

### manifest.json (例)

```json
{
  "instrument": "guitar",
  "format": "wav",
  "sample_rate": 44100,
  "bit_depth": 16,
  "samples": [
    { "note": "E2", "file": "E2.wav" },
    { "note": "A2", "file": "A2.wav" },
    { "note": "D3", "file": "D3.wav" },
    { "note": "G3", "file": "G3.wav" },
    { "note": "B3", "file": "B3.wav" },
    { "note": "E4", "file": "E4.wav" }
  ]
}
```

Tone.Sampler はサンプル間を自動でピッチシフトで補間してくれるので、
6 個の単音だけで全音域カバー可能。多 velocity は v91+ で対応 (`E2-soft.wav` 等)。

---

## 録音時の指針

### Guitar
- **完全に消音した瞬間 (ぱりっと止め)** ではなく、自然な減衰までを録る (約 4-6 秒)
- **アタック前 0.05 秒の無音** を入れる (Sampler の attack 設定が効くため)
- 単弦単音、distortion なし、エフェクトなしで録る (band-room 側で distortion / chorus / lp filter を掛ける)
- 6 音 (E2 / A2 / D3 / G3 / B3 / E4) があれば全音域使える

### Bass
- 同上、4 音 (E1 / A1 / D2 / G2) でカバー可
- 弦のミュート短音より、サステインある音の方が Sampler でナチュラル

### 録音設定
- 48 kHz / 24-bit mono 推奨 (ブラウザは 44.1 kHz / 16-bit でも可)
- ピーク -3 dB 程度に統一 (samples 間の音量差を抑える)
- DC offset 除去 (DAW で normalize 等)

---

## v91 で実装される検出ロジック (planned)

`band-room.js` 起動時に:

```js
async function detectSampleInstruments() {
  const guitar = await fetch("presets/sample-instruments/guitar/manifest.json")
                        .then(r => r.ok ? r.json() : null).catch(() => null);
  const bass = await fetch("presets/sample-instruments/bass/manifest.json")
                       .then(r => r.ok ? r.json() : null).catch(() => null);
  return { guitar, bass };
}
```

検出された場合のみ、UI に「🎸 use real guitar samples」「🎸 use real bass samples」
トグルが現れる。OFF (synth) と ON (sampler) で随時切替可能。

---

## 既存のドラムサンプル

`presets/sample-kits/<source>/<song>/` に既に kick/snare/hat/crash/etc が
入っている (v65 で Tabasco 各曲のドラムから抽出済)。同じパターンを
sample-instruments にも転用する。
