# DAW Integration — Ableton / BandLab / Logic 連携の道筋

> band-room は Web Audio sandbox の中。DAW 直結はできない。
> でも **stem 単位の inout** + **MIDI clock** で十分実用的なワークフローが組める。
>
> ゴール: 「自分のパート (vocals / guitar / drums) 以外を切って、DAW で取り直したテイクを差し替える」 — これを band-room ↔ DAW 往復ループで回す。

---

## 1. band-room → DAW (素材を持ち出す)

### A. 既存 Demucs stem mp3 を直接 DAW にドロップ

最も近道。**band-room を起動する必要すらない**。

```
presets/tabasco-stems/<song>/{vocals,drums,bass,other}.mp3
```

Finder からドラッグ → Ableton/Logic/BandLab のトラックに直接ドロップ。

- Demucs htdemucs 出力 (4-stem)
- 96 kbps mp3 (元から 192 kbps、Pages サイズ事情で v61 で半減)
- BPM: drum-frames JSON の `bpm` 参照、key は `key`
- セクション境界も JSON の `structure[]` に bar 単位で記録あり

**注**: mp3 なので DAW 上で stretch すると音質劣化する。本気で取り直すなら
元の **WAV にバックアップ取ってあるか確認**。なければ次の B でセッション内録音。

### B. band-room の post-limiter mix を MediaRecorder で webm に (v81 で実装済)

band-room で再生 → ⏺ REC → 1ループ走らせる → ■ STOP REC → download。
webm/opus が落ちる。`ffmpeg -i in.webm out.wav` で wav 化して DAW に持ち込み。

**メリット**: band-room の masterチェーン (per-stem EQ + 2段comp + tape sat +
StereoWidener + reverb) を通った後の音が録れる。
**デメリット**: stem 別じゃない、master ミックスのみ。

### C. stem 別の独立録音 (v88 で実装予定)

各 stem 単独 mute + 順番に MediaRecorder 走らせて 4 ファイル取る → DAW で再合体。
今のところ手動 routing 必要。

### D. (将来) stems pack export — 1 セッションで全 stem を別 MediaStreamDestination で取る

Tone.context に MediaStreamDestination 4 個作って、各 stem bus を別々に tap。
同時録音で 4 wav 生成 → JSZip で zip まとめて download。

---

## 2. DAW → band-room (取り直しテイクを戻す)

### A. 自分のパートを DAW で録音 → export → band-room の per-stem external upload (v87 で実装済)

ワークフロー:

1. band-room で **元 stem を全部 ON で再生**
2. DAW で band-room の出音をモニタしながら自分のパート (vocal / guitar / drums) を録音
3. DAW で **自分のパートだけを wav export**
4. band-room の `🥁🎸🎹 external stems` パネルにドロップ
5. **元 stem の同パートを toggle off** → 自分のテイクで再生
6. band-room の master FX (StereoWidener / tape sat / reverb) が自分のパートにも掛かる

これで「自分のパート以外を切って取り直し」が完成。

### B. 差し替え対象パートのまとめ

| パート     | 元 stem        | external slot                 | 用途                                   |
|------------|---------------|-------------------------------|----------------------------------------|
| vocals     | vocals.mp3    | 🎙 external vocal (v83)       | Suno / 自分で歌い直し                  |
| drums      | drums.mp3     | 🥁 external drums (v87)       | 自分で叩いた drum take                 |
| bass       | bass.mp3      | 🎸 external bass (v87)        | 自分の bass take                       |
| gtr/keys   | other.mp3     | 🎹 external other (v87)       | 自分の guitar take / synth re-record   |

### C. 全パート差し替えで完全 self-cover

4 個全部 external upload → 元 stem を全 toggle off → band-room の lyric / section /
master FX 機能だけ借りた "自分版" の Tabasco が組める。

---

## 3. テンポ sync

### A. BPM 合わせる (簡易)

drum-frames JSON の bpm を DAW にも入力。手動。
band-room v76 の practice tempo slider で 50-120% 倍速も可能 (DAW 側も合わせる)。

### B. MIDI Clock 送出 (v90 で実装予定 — WebMIDI)

`Tone.Transport` の bar/beat event を MIDI Clock メッセージに変換 → WebMIDI Output
で送出 → DAW (Ableton / Logic / BandLab Studio) に MIDI Clock 受信設定。

Ableton Link は LAN UDP プロトコルなのでブラウザ単体では不可能 (electron 化 or
native helper 必要)。代替として MIDI Clock で十分実用。

### C. (究極) Ableton Link via WebSocket helper

local の Node.js helper が Ableton Link に参加 + WebSocket で band-room と通信。
ユーザー側で Node 起動が必要なので native app 化に近い。今は MIDI Clock 推奨。

---

## 4. ハードウェア接続 (drum machine / synth / MIDI controller)

WebMIDI API を使えば直接続できる。実装は Wave 23 で。

### 想定機材接続パターン

#### a) ドラムマシン (TR-08 / Volca Beats / Digitakt 等)

```
band-room (MIDI Clock out) ──→ ドラムマシン (Clock in, internal tempo sync)
band-room (note on/off out) ──→ ドラムマシン (trigger kick/snare from drum-frames events)
                              OR
ドラムマシン (audio out) ──→ オーディオインターフェース ──→ ブラウザに external drums として upload
```

最後の audio out 経由が一番素直。drum machine で叩いた grooveを wav にして
band-room の 🥁 external drums に放り込む。

#### b) MIDI コントローラー / キーボード

```
キーボード (MIDI in) ──→ band-room (WebMIDI input listener) ──→ phrase trigger 発火 OR voice synth 駆動
```

phrase trigger の 20 個に MIDI note を割り当て → 鍵盤で打ち込み live performance。

#### c) Push / Maschine / Launchpad

各 pad に phrase 1..20 をマップ + section nav を 8 pad に → ライブ用 controller。
band-room が WebMIDI で各 pad の light を制御 (ループ中の phrase を赤、active section を緑、等)。

---

## 5. 音質を「本物」に近づけるオプション

### Tone.js の限界

オシレータ + フィルタは Tone.js でも十分鳴るが、本物の楽器 (本物の guitar amp,
analog bass) には遠い。アコースティック / モデリングの本気は VST/AU plugins の
領域。

### a) Tone.Sampler でリアルサンプル化 (v91 で実装予定)

本物の guitar / bass の単音サンプルを multi-velocity layer 配置。
PolySynth の代わりに Sampler を使うオプションを追加。

```
presets/sample-instruments/
  guitar/{C3,D3,E3,...,C5}-{soft,medium,hard}.wav
  bass/{E1,A1,D2,G2,...,C4}-{soft,medium,hard}.wav
```

サンプル元: 自分の guitar/bass を 12 note × 3 velocity で録ったり、フリー
sample lib (Salamander / Karoryfer Samples / Versilian Studios) から借用。

### b) WAM (Web Audio Modules) plugins

VST 風の plugin in browser。Surge XT WAM、Dexed WAM (DX7 emulator)、
SFZ Player WAM などが既にある。band-room の synth voice を WAM ホストとして
差し替え可能にすると、本格的に近づく。

実装コスト: 高い (WAM 2.0 SDK で host 側書く必要)。

### c) VCV Rack 連携

VCV Rack はデスクトップ app。band-room の出音を BlackHole (macOS) / VB-Cable
(Windows) で VCV Rack の audio input に流す。VCV Rack 側でモジュラー合成して
書き戻すと、Web Audio + Eurorack のハイブリッド。

これは外部 helper / OS routing 必要なので web 単体では不可能。マニュアル設定
する用途。

### d) MusicGen / AudioCraft (AI 生成)

Meta の AudioCraft / MusicGen で AI 生成した 4 bar pattern を wav にして
band-room の per-stem upload に放り込む。

ブラウザ単体で動かすには onnxruntime-web に量子化モデル載せる必要。重い。
外部生成 → upload の手動 path が現実的 (Suno と同じ流れ)。

---

## 6. 今すぐできるベストプラクティス

1. **元 stem は archive 取っておく** (Pages の 96 kbps はリスナー用)
2. **自分のパートを DAW で wav export**、48 kHz / 24-bit / mono or stereo
3. **band-room の per-stem upload にドロップ**、元 stem を toggle off
4. **band-room の master チェーン** (warmth / loudness / reverb) は通したまま
5. **REC ボタン**で 1 ループ録音 → webm → ffmpeg で wav 化 → DAW にバウンス

これで band-room を **DAW のサブ・ミキサー兼プレイヤー** として運用できる。

---

## 7. ロードマップ

- [x] v83 — vocal drag-drop
- [x] v87 — per-stem external upload (drums/bass/other)
- [x] v81 — post-limiter MediaRecorder export
- [ ] v88 — stems pack export (4 独立 MediaStreamDestination + JSZip)
- [ ] v90 — WebMIDI Clock out + MIDI input listener (phrase trigger / section nav)
- [ ] v91 — Tone.Sampler 化 (guitar/bass 単音サンプル multi-velocity)
- [ ] v92 — DAW project export (?) Ableton Live Set XML or Reaper RPP テンプレ吐く
