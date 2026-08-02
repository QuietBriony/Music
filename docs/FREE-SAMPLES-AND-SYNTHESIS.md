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

Tone.SamplerにURLを渡せる候補。下表は探索用で、active catalogのrevisionと
`license.status`の正本は
[`config/external-dependencies.json`](../config/external-dependencies.json)に置く。
配布元のcode licenseをsample assetへ読み替えない。

| ライブラリ | ライセンス | 内容 | 入手 |
|-----------|-----------|------|-----|
| **Salamander Grand Piano** | CC-BY 3.0 | Yamaha C5 grand, multi-velocity | github sfzinstruments/SalamanderGrandPiano |
| **VSCO 2 Community Edition** | CC0 | orchestral (strings/brass/ww/perc) | versilstudios.com |
| **Sonatina Symphonic Orchestra** | CC-BY-SA 3.0 | 簡易 orchestral | mattiaswestlund.net |
| **Iowa MIS** | educational free | 各楽器 single note (university 教材) | theremin.music.uiowa.edu/MIS.html |
| **Philharmonia free samples** | restricted free | 各楽器 single note | philharmonia.co.uk |
| **TR-808 / TR-909 ROM 1ショット** | sourceごとに要確認 | 古典 drum machine | github 各所（active Dirt familyも確認待ち） |
| **Karoryfer samples** | CC-BY-SA | bass / guitar / strings | karoryfer.com |
| **NSynth (Magenta)** | CC-BY 4.0 | AI 合成 single note | google magenta NSynth dataset |
| **Freesound.org** | CC-0 / CC-BY (個別) | 巨大、検索必要 | freesound.org |
| **Tone.js example samples** | collection別 | Salamander CC-BY 3.0 / Casio CC-BY-NC-SA 4.0 / active drumは確認待ち | Tonejs/audio pinned commit |

**Band Room で使うなら:**

- 既存の `presets/sample-kits/<source>/<song>/*.wav` (v65 で Tabasco から抽出) は
  問題ない (private use)
- 追加候補は、BL-035のasset契約とowner判断を通し、family単位のlicense evidenceを
  manifestへ登録してから扱う。出典不明のTR-808 / 909 dumpをrepoへ置かない
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

出典とPublic Domain適用範囲が確認できたdrum 1-shot packでも、repo同梱はBL-035の
owner判断対象。承認後に`presets/sample-kits/free-808/`を作るなら:

- `kick-01.wav`, `snare-01.wav`, `hat-01.wav`, `clap-01.wav`, `crash-01.wav`
- `manifest.json` でライセンス明記

manifestへprovenance / license / expected sizeを登録し、KIT_OPTIONSの選択肢に
`"free-808/standard"`として追加すれば、Tabasco stemから抽出したkit隣に並ぶ。

容量だけでは採用可否を決めない。現在のTidalCycles Dirt-Samplesはcommit固定済みだが、
使用familyのlicense確認はpendingなので、再配布可能とは扱わない。

---

## v109-v115 — 「合成 vs 実 sample」ハイブリッドが現実解になった

v91 で synth profile を入れた時は「合成だけで genre 出す」方針だった。でも
v109-v111 で **band-room の全 voice (drum / bass / chord / guitar / vocal lead)
が CDN sampler 経由で実音色を選べる**ようになり、v113-v115 で **Hazama FM lofi
も完全 sample 化**された。

つまり現在の現実解は **「合成 fallback + 実 sample CDN 経由」のハイブリッド**:

| voice | synth fallback (即時、Pages 容量 0) | 実 sample (CDN 経由、初回数秒ロード) |
|-------|-----------------------------------|-----------------------------------|
| drum | Tone.js NoiseSynth / MembraneSynth (KIT_PROFILES の 5 種) | 9 online kit (tonejs / dirt-samples) |
| bass | Tone.MonoSynth + filter | salamander-bass / bass-electric |
| chord | Tone.PolySynth (triangle/saw/square) | salamander-piano / casio-synth |
| guitar | PolySynth saw + distortion | guitar-electric / -acoustic / -nylon |
| voice/lead | AMSynth + dual formant | violin / cello / flute / organ / harp |

選択は band-room の `🥁 drum kit + synth profile` panel で個別、または
**master mix preset** (lo-fi / club / rock / ambient) で全 voice 一斉切替。

Hazama FM 側は `engine.js > updateSoundForMode("lofi")` が hardcoded で
piano trio + breakbeat sample に切替 (将来は catalog 経由化検討中)。

### この方針の利点

- **Pages 容量影響 ゼロ** (catalog json 1 ファイル定義のみ)
- **ライセンス状態を分離追跡**（catalogはUI表示、manifestはevidence付きの`verified / pending`正本）
- **オフライン fallback** (sample fetch 失敗時 synth で代替)
- **拡張性無限** (catalog.json 編集だけで instrument 追加)

詳細仕様: [SAMPLE-CATALOG-GUIDE.md](./SAMPLE-CATALOG-GUIDE.md) / 正本:
[`config/external-dependencies.json`](../config/external-dependencies.json)
3 app 整合: [CROSS-APP-INTEGRITY.md](./CROSS-APP-INTEGRITY.md)
