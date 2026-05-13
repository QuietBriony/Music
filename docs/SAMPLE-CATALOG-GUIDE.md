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

### D. nbrosowsky/tonejs-instruments (MIT、Tone.js 用に整備済)

これが一番楽。jsDelivr 経由で全楽器サンプル群が一発で取れる。

```
https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/<instrument>/<note>.mp3
```

利用可能な instrument:

```
bass-electric, bassoon, cello, clarinet, contrabass,
flute, french-horn, guitar-acoustic, guitar-electric, guitar-nylon,
harmonium, harp, organ, piano, saxophone, trombone, trumpet, tuba,
violin, xylophone
```

各 instrument の note set を確認するには:

```bash
# Github contents API で一覧取れる
curl -s "https://api.github.com/repos/nbrosowsky/tonejs-instruments/contents/samples/violin" \
  | jq -r '.[].name' | head -20
```

→ 例: `violin` は `A3.mp3 A4.mp3 A5.mp3 A6.mp3 C4.mp3 C5.mp3 C6.mp3 C7.mp3 E4.mp3 E5.mp3 E6.mp3 G4.mp3 G5.mp3 G6.mp3`

note 名のシャープは **`s`** 表記 (`Fs3.mp3` = F#3)、フラットは存在しないので enharmonic で。

catalog json に書くときは:

```json
"notes": {
  "A3": "/A3.mp3", "C4": "/C4.mp3", "E4": "/E4.mp3", "G4": "/G4.mp3",
  "A4": "/A4.mp3", ...
}
```

Tone.Sampler が pitch-shift で補間するので、10-15 note あれば全音域動く。

### E. 検索クエリ集 (実用)

| 探したいもの | 検索エンジン | クエリ例 |
|-------------|------------|---------|
| **CC-0 ドラム 808** | Freesound | `kick license:CC0 808` `snare license:CC0 808` |
| **Lofi piano single notes** | Freesound | `piano single note license:"Creative Commons 0"` |
| **vintage drum machine ROM** | Github | `tr-808 wav site:github.com license:public-domain` |
| **strings sample CC-BY** | google | `"violin" "wav" "CC-BY" "site:github.com"` |
| **lofi jazz piano** | google | `"lofi" "piano" "samples" "free" "wav"` |
| **vocal "ah" sample CC-0** | Freesound | `vocal ah female license:CC0` |
| **Native sample lib** | google | `"sample library" "CC-BY" OR "CC0" download` |
| **Tone.js example codebase** | github | `"new Tone.Sampler" "urls"` |

### F. Sample lib の SFZ / SF2 → wav バラ取り出し

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
- [x] bass / melody 用 instrument の追加 (instruments[] 拡張) — v110-v111
- [ ] sample-instruments/ (ローカル wav) の自動検出と catalog 結合

---

## 実践チュートリアル: NSynth strings を catalog に追加する

step-by-step で 1 個追加してみる。

### 1. ソース URL を見つける

NSynth は Google の AI 合成 single note dataset。Google Storage に CORS 付きで公開:

```
https://storage.googleapis.com/magentadata/datasets/nsynth/audio/
  string_acoustic_014-060-127.wav
```

ファイル名規則: `string_acoustic_<instrument_id>-<midi_note>-<velocity>.wav`

- midi_note 60 = C4
- midi_note 64 = E4
- midi_note 67 = G4
- midi_note 72 = C5
- velocity 127 = maximum (forte)

### 2. CORS チェック

```bash
curl -I -X OPTIONS \
  -H "Origin: https://quietbriony.github.io" \
  https://storage.googleapis.com/magentadata/datasets/nsynth/audio/string_acoustic_014-060-127.wav
```

response に `access-control-allow-origin: *` あれば OK。

### 3. ヘッドリクエストで存在確認

```bash
for note_id in 048 052 055 060 064 067 072 076 079 084; do
  curl -sI "https://storage.googleapis.com/magentadata/datasets/nsynth/audio/string_acoustic_014-${note_id}-127.wav" \
    | head -1
done
```

→ 全部 `200 OK` ならそろってる、404 が混ざってたら note を skip。

### 4. catalog json に entry を追加

```json
{
  "id": "nsynth-strings",
  "label": "NSynth strings (Magenta AI synth, CC-BY 4.0)",
  "kind": "sampler",
  "source": "magenta nsynth",
  "license": "CC-BY 4.0",
  "base_url": "https://storage.googleapis.com/magentadata/datasets/nsynth/audio",
  "notes": {
    "C3": "/string_acoustic_014-048-127.wav",
    "E3": "/string_acoustic_014-052-127.wav",
    "G3": "/string_acoustic_014-055-127.wav",
    "C4": "/string_acoustic_014-060-127.wav",
    "E4": "/string_acoustic_014-064-127.wav",
    "G4": "/string_acoustic_014-067-127.wav",
    "C5": "/string_acoustic_014-072-127.wav",
    "E5": "/string_acoustic_014-076-127.wav",
    "G5": "/string_acoustic_014-079-127.wav",
    "C6": "/string_acoustic_014-084-127.wav"
  }
}
```

### 5. ローカル動作確認

```bash
cd ~/path/to/Music
python -m http.server 8000
# ブラウザで http://localhost:8000/band-room.html
# chord instrument dropdown に 🌐 NSynth strings (...) が並んでる
```

### 6. 本番反映

```bash
git add presets/online-samples-catalog.json
git commit -m "feat(music): catalog add NSynth strings instrument"
git push
```

Pages auto-deploy で全リスナーの band-room から利用可能になる。

---

## ライセンス判定フローチャート

```
catalog に追加したい？
│
├─ 自分で wav を作った
│  └─→ OK (好きな license で repo にコミット or CDN ホスト)
│
├─ ネットで見つけた
│  │
│  ├─ ライセンス表記が CC-0 / Public Domain
│  │  └─→ OK (catalog の license フィールドに明記)
│  │
│  ├─ ライセンスが CC-BY (要 attribution)
│  │  └─→ OK だが label に "by <author>" 入れて catalog に license: "CC-BY <ver>" 明記
│  │
│  ├─ MIT / Apache 2.0 / BSD
│  │  └─→ OK (catalog の license フィールドに明記)
│  │
│  ├─ ライセンスが CC-BY-NC (非商用のみ)
│  │  └─→ band-room は商用?個人練習なら OK だが、Pages = public、グレー
│  │      避けるのが無難
│  │
│  ├─ ライセンスが CC-BY-SA (継承)
│  │  └─→ band-room も同じ SA にする必要、面倒なので避ける
│  │
│  ├─ 「Royalty-free」「Free for use」だけでライセンス明記なし
│  │  └─→ NG (法的に不確実、後で問題になる)
│  │
│  └─ Sony / Roland / Yamaha などの商用 sample lib
│     └─→ NG (絶対ダメ、Pages = 公開だから配布行為)
│
└─ AI で生成した (NSynth dataset / MusicGen 出力等)
   └─→ 元 dataset / model の license に従う
       NSynth は CC-BY 4.0、MusicGen は CC-BY-NC (グレー)
```

---

## catalog validation スクリプト (将来の自動化案)

`scripts/_validate_catalog.py` (未実装、将来追加):

```python
import json, requests, sys
with open("presets/online-samples-catalog.json") as f:
    cat = json.load(f)

errors = 0
for kit in cat.get("kits", []):
    for voice, path in kit["voices"].items():
        url = kit["base_url"] + path
        try:
            r = requests.head(url, timeout=5, allow_redirects=True)
            if r.status_code != 200:
                print(f"  ❌ {kit['id']}/{voice}: {url} → {r.status_code}")
                errors += 1
            cors = r.headers.get("access-control-allow-origin")
            if not cors:
                print(f"  ⚠️ {kit['id']}/{voice}: no CORS header")
        except Exception as e:
            print(f"  ❌ {kit['id']}/{voice}: {e}")
            errors += 1

for inst in cat.get("instruments", []):
    for note, path in inst["notes"].items():
        url = inst["base_url"] + path
        r = requests.head(url, timeout=5, allow_redirects=True)
        if r.status_code != 200:
            print(f"  ❌ {inst['id']}/{note}: {r.status_code}")
            errors += 1

sys.exit(1 if errors else 0)
```

このスクリプトを CI に組み込めば、catalog の URL が死んだとき自動検知できる。

---

## 既知の音源リソース集

実用的にすぐ使える順:

### 多楽器セット
- **nbrosowsky/tonejs-instruments** (MIT) — 20 楽器、Tone.js 用に整備、jsDelivr 経由でロード安定。**v111 でメイン採用**
- **tonejs.github.io/audio/** (MIT/CC-BY、Tone.js 公式 demo) — Salamander piano, Casio synth, drum kits

### ドラム特化
- **tidalcycles/dirt-samples** (CC-0) — 808/909/各種 percussion 大量、jsDelivr 経由。**v97 で 6 kit 採用**
- **kb1ooo/sample-pack** (gh, CC0 個別) — 雑多な 1ショット

### Magenta / AI 系
- **NSynth dataset** (CC-BY 4.0, Magenta) — Google Storage、AI 合成 single note、各楽器 1000 種類以上
- **MusicGen output** (CC-BY-NC、META) — グレー (NC 制限あり、避ける)

### Orchestral / 楽器個別
- **Karoryfer Samples** (CC-BY-SA) — bass, brass, strings — SA 制限のため avoid 推奨
- **Versilian Studios VSCO 2 CE** (CC0) — orchestral 各楽器、SFZ 形式 (wav 抽出必要)
- **Sonatina Symphonic Orchestra** (CC-BY-SA) — 同上、SA 制限
- **Univ of Iowa MIS** (educational free) — 各楽器 single note、free use
- **Philharmonia orchestra free samples** (restricted free) — 同上

### 1ショット集
- **Freesound.org** (CC-0 / CC-BY filter) — 巨大 community、検索必須
- **Drumkito** (CC0/CC-BY) — boom-bap / vintage drum 派生

### 注意
- LinnDrum, Roland TR-X の official ROM dump は灰色 (Roland が legal action する事例あり、避ける)
- Sample CD / loop pack は基本 NG (商用ライセンス)
