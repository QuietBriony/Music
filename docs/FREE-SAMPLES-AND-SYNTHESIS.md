# Free Samples & 生成音完結 — Band Room の音作り戦略

> ユーザー命題: 「Ableton のプリセットはブラウザでは出ない。このシステムとして、
> 生成音で完結はさせたい。サカナクションみたいなアプローチはありかな」

整理して回答する。Ableton/VST/AU plugin はブラウザでは使えない (Web Audio API
が host できるのは wav/mp3 サンプルか WebAssembly 合成器だけ)。だから戦略は
2 つしかない:

1. **フリーの wav サンプルを Tone.Sampler / Tone.Player に読ませる**
2. **Tone.js のオシレーター + フィルタで合成して完結させる**

Band Room は **どちらも受け取れる仕組み**を持っていて、現在 2 番路線を中心に
回してる。理由とディテール:

---

## 1. ブラウザで使えるフリーサンプル一覧

permissive license (CC-0 / CC-BY / CC-BY-SA) で、Tone.Sampler に URL 食わせれば
直接動くもの:

| ライブラリ | ライセンス | 内容 | 入手 |
|-----------|-----------|------|-----|
| **Salamander Grand Piano** | CC-BY 3.0 | Yamaha C5 grand, multi-velocity | github sfzinstruments/SalamanderGrandPiano |
| **VSCO 2 Community Edition** | CC0 | orchestral (strings/brass/ww/perc) | versilstudios.com |
| **Sonatina Symphonic Orchestra** | CC-BY-SA 3.0 | 簡易 orchestral | mattiaswestlund.net |
| **Iowa MIS** | educational free | 各楽器 single note (university 教材) | theremin.music.uiowa.edu/MIS.html |
| **Philharmonia free samples** | restricted free | 各楽器 single note | philharmonia.co.uk |
| **TR-808 / TR-909 ROM 1ショット** | CC0/gray | 古典 drum machine | github 各所 (e.g. TidalCycles dirt-samples) |
| **Karoryfer samples** | CC-BY-SA | bass / guitar / strings | karoryfer.com |
| **NSynth (Magenta)** | CC-BY 4.0 | AI 合成 single note | google magenta NSynth dataset |
| **Freesound.org** | CC-0 / CC-BY (個別) | 巨大、検索必要 | freesound.org |
| **Tone.js example samples** | MIT 等 | drum / synth demo set | tonejs.github.io/audio |

**Band Room で使うなら:**

- 既存の `presets/sample-kits/<source>/<song>/*.wav` (v65 で Tabasco から抽出) は
  問題ない (private use)
- 追加で欲しいなら **TR-808 / 909** の CC-0 dump を `presets/sample-kits/free-808/` に置く
- **Tone.Sampler 用** には `presets/sample-instruments/{guitar,bass}/` (v91 scaffold済)

実装は **band-room.js が manifest.json で自動検出**、無ければ synth に fall back。
依存 0 の状態を維持。

---

## 2. でも Band Room の哲学は「**生成音で完結**」

ブラウザ単体、Pages = static hosting、install 不要。重い sample lib に依存
すると:

- Pages の 1 GB ソフト制限を圧迫 (Tabasco stems で既に 157 MB 使用)
- 100 GB/月 bandwidth に効く
- リスナー側のロード時間が伸びる (mobile 4G で数十 MB は刺さる)

そして本質的に — band-room は **演奏 / 練習 / カバー / 録音** の場所。素材
ライブラリ chase は DAW でやる方が筋がいい。band-room は:

- 楽曲構造 (drum-frames JSON) + 演奏ロジック + UI は完結
- 音色の "本物寄り" は **DAW で取り直して external slot に上げる** (v87 path)
- それまでの間は **synth で十分に良い音** にする (v66 mastering, v70 polish, v91 profiles)

---

## 3. サカナクション風 = synth voice profile (v91 で実装)

「ドラムとかサカナクションみたいなアプローチ」の core は **音色キャラ** で、
これは drum synth の DSP knob 設定で表現できる。Sampler 化しなくても出る。

v91 で追加した 4 つの synth kit profile:

### default — LCD + Backdrop Bomb mixture (現状)
- kick: 4 octaves, decay 0.32s, vol -8 dB, click -32 dB
- snare: HP 1100, decay 0.14, body -12 dB
- hat: BP 6800, decay 0.04, vol -22
- crash: decay 0.9, vol -18

### sakanaction — dance rock (tight kick / clicky hat)
- **kick**: 5 octaves, decay **0.20** (tighter), vol -6 (前に出る), click **-22** (clickier)
- **snare**: HP **1600** (brighter), decay **0.09** (snappier), vol -10
- **hat**: BP **8200** (more high freq), decay **0.028** (16th 刻みでも詰まらない)
- **crash**: decay 1.1, vol -16

### lcd-motorik — 4-on-floor (LCD Soundsystem 風)
- **kick**: **6 octaves** (boomier), decay **0.38** (long body), vol -5 (一番前)
- snare: HP 950 (low), decay 0.18 (big snap), vol -8
- hat: BP 5800 (mid-bright), decay 0.06 (open)
- **crash**: decay 1.3 (long shimmer)

### cramps-punk — Human Fly / rockabilly slap
- kick: 5.5 octaves, decay **0.40** (boomy), vol -7, click -36 (faded)
- **snare**: HP **800** (low / roomy), decay **0.22** (slap-back), vol -10
- hat: BP 5200 (mid-low), decay 0.05 (short)
- **crash**: decay **1.6** (huge cymbal wash)

切り替えは band-room の `🥁 drum kit source + synth profile` panel の
"synth profile" selector。**kit source = AI synth (default)** のときだけ効く。
サンプル kit (auto-self / tabasco-* / unripe-*) のときは元音色のまま。

選択は **localStorage に保存される** ので、次回も同じ profile で再開。

---

## 4. もう一歩 — bass / chord / guitar の profile?

drum と同じ要領で、bass / chord / guitar も profile 化できる。今は v70 polish
済みの単一設定。

ロードマップ (将来 v92+):

```
BASS_PROFILES = {
  default:     { filter_freq: 480, drive: 0.08, env_release: 0.15 },
  sakanaction: { filter_freq: 720, drive: 0.04, env_release: 0.08, sub_layer: true },
  lcd-motorik: { filter_freq: 600, drive: 0.06, env_release: 0.22, portamento: 0.04 },
  cramps-punk: { filter_freq: 380, drive: 0.18, env_release: 0.10, slap: true }
}
```

これを実装すると Band Room の synth 音色が「ジャンル A/B 比較できる」段階に
なる。あくまでブラウザ完結。

---

## 5. もし本気で「実在 sample 級の音」が要るとき

その時はもう band-room の外。3 path 用意してある:

1. **Music Core Rig の REC で素材作る** → wav export → band-room の external slot に drop (v89 bridge)
2. **DAW で取り直し** → wav → band-room の external slot に drop (v87 + v90 stems pack export → 再合体)
3. **Suno / AudioCraft で AI 生成** → mp3 → external slot に drop

これは **band-room が生成完結**しつつ、**外部素材を受け入れる** ハイブリッド。
依存ゼロの core + open inputs。今のところこれが正解だと思う。

---

## 6. もし将来 free sample 一式を同梱したくなったら

最小限の Public Domain な drum 808 / 909 1ショット pack なら 5-10 MB 程度で
収まる。`presets/sample-kits/free-808/` を作って:

- `kick-01.wav`, `snare-01.wav`, `hat-01.wav`, `clap-01.wav`, `crash-01.wav`
- `manifest.json` でライセンス明記

これを KIT_OPTIONS の選択肢に `"free-808/standard"` として追加すれば、
Tabasco stem から抽出した kit 隣に並ぶ。

実装したくなったタイミングで言ってください。GitHub の 1 GB 制限内、
TidalCycles dirt-samples (CC0) なら問題なし。
