# Sample Catalog Guide — `presets/online-samples-catalog.json`

> オンライン (CDN) からサンプルを借りるための **定義ファイル 1 本**。 band-room.js
> が起動時に fetch して、kit dropdown と chord instrument selector に並べる。
> repo に音源本体を置かないので **容量を消費しない**。

---

## なぜ catalog 方式か

ブラウザは VST/AU プラグインをロードできない。Web Audio API がホストできるのは
**wav/mp3/ogg/flac のサンプルか WebAssembly 合成器だけ**。つまり「外部音源を借りる」
= 「web 上の wav の URL を fetch する」。

各 URL を band-room の中にハードコードすると硬直化する → **catalog json で抽象化**
すれば:

- catalog 編集だけで音源バリエーション無限
- ライセンス情報を catalog 内に明示
- ユーザーが localStorage 経由で個別 kit を追加できる (v102)
- 将来 catalog を別 repo に出しても band-room.js 変更不要

---

## File location

```
presets/online-samples-catalog.json
```

Service Worker (`sw.js`) の precache に含まれてるので、オフラインでも catalog の
一覧自体は表示される (実サンプル fetch は当然オフライン時 fail)。

---

## Schema (v1.0)

### Top level

```json
{
  "schema": "1.0",
  "comment": "...",
  "kits": [ ... ],
  "instruments": [ ... ]
}
```

| field | type | 用途 |
|-------|------|------|
| `schema` | string | catalog version (今は "1.0") |
| `comment` | string | 自由記述、UI には出ない |
| `kits` | array | drum kits (6 voice fix) |
| `instruments` | array | chord/bass/melody 用の note-mapped sampler |

### kits[] entry — drum kit

```json
{
  "id": "dirt-808",
  "label": "TR-808 (TidalCycles dirt-samples, CC-0)",
  "source": "tidalcycles/dirt-samples",
  "license": "CC-0 (Public Domain)",
  "base_url": "https://cdn.jsdelivr.net/gh/tidalcycles/dirt-samples@master",
  "voices": {
    "kick":  "/808bd/BD0000.WAV",
    "snare": "/808sd/SD0000.WAV",
    "hat":   "/808hc/HC00.WAV",
    "ghost": "/808sd/SD0025.WAV",
    "fill":  "/808sd/SD0050.WAV",
    "crash": "/808/CP.WAV"
  }
}
```

| field | type | 必須 | 用途 |
|-------|------|------|------|
| `id` | string | ✓ | drum source 識別子。kit selector の value (`online/<id>`) になる。`[a-zA-Z0-9_-]+` |
| `label` | string | ✓ | UI 表示名 |
| `source` | string |  | 出典 (repo/site 名)、UI title attr 用 |
| `license` | string |  | ライセンス記述 (CC-0 / CC-BY / MIT 等)、UI title attr 用 |
| `base_url` | string | ✓ | サンプル URL の prefix。末尾スラッシュなし |
| `voices` | object | ✓ | 6 voice 必須: `kick / snare / hat / ghost / fill / crash` — 各 voice path は base_url に concat される |

#### 6 voice の意味

band-room の drum-floor scheduler が drum-frames JSON の `events[]` から名前で
引いてくる:

- **kick**: kick drum (low, punchy)
- **snare**: snare hit (mid, snap)
- **hat**: hi-hat (high, short)
- **ghost**: 弱拍 / clap / 装飾 (snare ghost が一般的)
- **fill**: フィルイン用 (alternate snare or tom)
- **crash**: 章末の cymbal hit

不在の voice はファイル URL を空文字 `""` にしておけば silent。

### instruments[] entry — note-mapped sampler

```json
{
  "id": "salamander-piano",
  "label": "Salamander Grand Piano (Tone.js demo)",
  "kind": "sampler",
  "source": "tonejs.github.io",
  "license": "CC-BY 3.0",
  "base_url": "https://tonejs.github.io/audio/salamander",
  "notes": {
    "A0": "/A0.mp3",
    "C1": "/C1.mp3",
    "D#1": "/Ds1.mp3",
    "..."
  }
}
```

| field | type | 必須 | 用途 |
|-------|------|------|------|
| `id` | string | ✓ | 識別子 |
| `label` | string | ✓ | UI 表示名 |
| `kind` | string | ✓ | 今は `"sampler"` のみ対応 |
| `base_url` | string | ✓ | サンプル URL の prefix |
| `notes` | object | ✓ | note name → relative path。Tone.Sampler が pitch shift で補間 |

note name は Tone.js 規約: `C4 / C#4 / Db4 / D4 / ...` (西洋音名 + octave 数字)。
最小 1 octave (3-4 サンプル) あれば全音域動く。10 個以上あると補間品質が上がる。

---

## サンプル URL の探し方

### A. tonejs.github.io (MIT / Tone.js 公式 demo)

Tone.js の例で使われてる音源は **そのまま借りられる**。CORS 対応済み、安定。

```
https://tonejs.github.io/audio/drum-samples/CR78/{kick,snare,hihat}.mp3
https://tonejs.github.io/audio/drum-samples/breakbeat13/{kick,snare,hihat}.mp3
https://tonejs.github.io/audio/drum-samples/acoustic-kit/{kick,snare,hihat}.mp3
https://tonejs.github.io/audio/salamander/{A0,C1,Ds1,Fs1,A1,...,C8}.mp3
https://tonejs.github.io/audio/casio/{A1,A2,As1,B1,C2,Cs2,D2,Ds2,E2}.mp3
```

Tone.js のソースを github で grep すれば他の URL も見つかる。

### B. jsDelivr 経由で github の wav repo を借りる

任意の github repo の任意の commit に jsDelivr CDN 経由でアクセス:

```
https://cdn.jsdelivr.net/gh/<owner>/<repo>@<branch_or_tag>/<path>
```

例: TidalCycles dirt-samples (CC-0):

```
https://cdn.jsdelivr.net/gh/tidalcycles/dirt-samples@master/808bd/BD0000.WAV
```

注意: jsDelivr は git LFS には対応してない。raw な wav は OK。

### C. Freesound.org の CC-0 検索 → 直接 URL

```
https://freesound.org/search/?q=kick&f=license:%22Creative+Commons+0%22
```

各 sample ページに preview URL あり (.mp3 形式)。

```
https://freesound.org/data/previews/<id>/<id>_<user>-lq.mp3
```

CORS は Freesound 側で許可されてる。

### D. Sample lib の SFZ / SF2 → wav バラ取り出し

Salamander / VSCO 2 等は SFZ 形式で配布されてることが多い。SFZ 内の wav を個別
取り出して repo (or 自分の git pages) に置く → catalog で参照。

---

## CORS チェック

ブラウザで使うには **target サーバが CORS ヘッダー (`Access-Control-Allow-Origin: *`)
を返す必要**。

確認:

```bash
curl -I -X OPTIONS \
  -H "Origin: https://quietbriony.github.io" \
  https://cdn.jsdelivr.net/gh/tidalcycles/dirt-samples@master/808bd/BD0000.WAV
```

`access-control-allow-origin: *` が出れば OK。

実績:
- `tonejs.github.io` — ✓ 公開、CORS 対応
- `cdn.jsdelivr.net` — ✓ CDN として CORS デフォルト ON
- `raw.githubusercontent.com` — ✗ CORS 無し (直接使えない、jsDelivr 経由で)
- `freesound.org` の `data/previews/` — ✓
- 任意の自分の Pages site (`*.github.io`) — ✓

---

## ユーザー編集の 3 path

### 1. catalog json を直接編集 (全員に反映)

`presets/online-samples-catalog.json` を編集 → commit & push。Pages 再 build →
全リスナーの band-room に反映。

### 2. localStorage 経由で個別 kit 追加 (自分のブラウザだけ)

band-room の `🥁 drum kit source` panel → `+ custom kit URL を追加` を開く →
id + URL 3 つ入れて `catalog に追加` ボタン。

`band-room.custom-kits.v1` localStorage キーに保存、reload しても残る。

### 3. PR を投げる (誰かに共有したい)

forked repo で catalog 編集 → PR。merge されると本家 catalog に追加。

---

## 例: NSynth (AI 合成 single note, CC-BY 4.0) を追加

NSynth の wav は Google Storage にあって CORS 対応。

```json
{
  "id": "nsynth-strings",
  "label": "NSynth strings (Magenta AI synth, CC-BY 4.0)",
  "kind": "sampler",
  "source": "magenta nsynth",
  "license": "CC-BY 4.0",
  "base_url": "https://storage.googleapis.com/magentadata/datasets/nsynth/audio",
  "notes": {
    "C4": "/string_acoustic_014-060-127.wav",
    "G4": "/string_acoustic_014-067-127.wav",
    "C5": "/string_acoustic_014-072-127.wav"
  }
}
```

`catalog.instruments[]` に append → band-room reload → chord instrument
selector に出現 → 選んで START → strings chord で Tabasco が鳴る。

---

## 例: VSCO 2 community orchestral kit (CC0) — drum kit 風に使う

VSCO 2 の percussion から組み立てる例:

```json
{
  "id": "vsco2-percussion",
  "label": "VSCO 2 Community Percussion (CC0)",
  "source": "versilstudios",
  "license": "CC0",
  "base_url": "https://example-vsco-cdn.com/vsco2/perc",
  "voices": {
    "kick":  "/timpani_C2.wav",
    "snare": "/snare_hit.wav",
    "hat":   "/triangle_mute.wav",
    "ghost": "/woodblock.wav",
    "fill":  "/timpani_F2.wav",
    "crash": "/cymbal_crash.wav"
  }
}
```

(CDN URL は仮。実際の VSCO 2 は SFZ で配布なので、自分で wav を抽出してどこかに
ホストする必要がある。)

---

## 失敗時の挙動

- catalog json が fetch 失敗 → online kits は表示されないが local kits + synth は動く
- 個別サンプル URL が 404 → その voice は silent (他の voice は動く)
- 個別サンプル URL が CORS エラー → console.warn、その voice は silent
- catalog json が malformed → 全 online kits 不在になる、`catalog load failed`
  ログ出力

ハードに止まらないように設計してある。

---

## 拡張ロードマップ

- [ ] catalog にユーザーが UI から直接 JSON 編集できる "advanced" mode (v103?)
- [ ] catalog の URL preview (どのサンプルか rich preview)
- [ ] catalog 共有 (URL で他人の catalog インポート)
- [ ] bass / melody 用 instrument の追加 (instruments[] 拡張)
- [ ] sample-instruments/ (ローカル wav) の自動検出と catalog 結合
