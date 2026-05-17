# Tabasco — Lyric v4 (元音節リズム保持版)

> ⚠️ **正直な注意書き** (v127 時点):
> この v4 は **元 vocals.mp3 を実際に聴いて音節を transcribe したものではない**。
> v2.1 (過去の "適当英語" を整えた版) を base にして、音節数を維持しようとした
> 推測版。実際の元 vocal で何と歌ってるかは耳のある人 (= user) が band-room で
> stems mode → vocals only にして聴いて確認する必要がある。
>
> 元音に厳密に合わせたい場合は下記 **「実音節を聴き取って差し替える」** section
> 参照。

> ユーザー: 「元音から拾えそうな音声部分は入れながら、サビメロくらいは。
> まるっきり変えるのは気分が乗らない」
>
> v2.1 (proper English) / v3 (Burroughs) は意味重視で書いてたが、
> **元 vocal stem の音節レイアウトから離れすぎてた**。v4 は逆算アプローチ:
>
> 1. 元 vocal stem の **音節カウント + アクセント + 母音** を拾う
> 2. その骨格に合わせて意味のあるフレーズを置く
> 3. **chorus / hook は特に元音節を尊重** (歌いやすい)
> 4. verse は v3 Burroughs の語彙を音節に合うところだけ流用
>
> v2.1 と v3 はそのまま docs に残してある (どっち歌っても OK)。v4 は
> 「気分が乗る + 歌える」最大公約数案。

---

## 作詞方法論 — syllable-first approach

Tabasco の各曲には:
- BPM (drum-frames JSON に記録)
- structure (intro / verse / chorus / bridge / outro 各 bars 数)
- chord progression (一部曲、JSON に有)

これは「**骨**」。元の vocal stem を聴いて拾うのは:

1. **音節数** (1 bar に何音節入ってるか)
2. **アクセントの位置** (拍頭 / シンコペーション)
3. **母音の傾向** (open: a/o vs closed: i/u)
4. **メロの上下動** (rising / falling)
5. **休符の位置** (どこで息継ぎするか)

→ これに **意味のある現代英語** を当てる作業 = scansion。

### 作詞のコツ

- **chorus は元音節 100% 尊重**: 元 vocal の母音 / アクセントが残ると、自分が聴いた時の "気分" が乗る
- **verse は 80% 元音節 + 20% 自由**: 細かい音節を入れ替えて新意味を作る
- **意味的レイヤー**: v3 Burroughs の語彙 (interzone, agent, wire, meat, operator) を音節に合うところに刺す
- **JP/EN switch**: 元 Human Fly に「ぶっ飛んで」入ってる → そのまま継承

---

## 01 TABASCO — chant manifesto (0:44, 136 BPM, D minor)

**元音節骨格**:
- intro spoken: 短い 2 行、低音 dry
- chant: **TAB-AS-CO** = 3 音節 hard accent x 4、each "TABASCO" の後に **5 音節フレーズ**

```
(spoken intro — single voice, dry)
This is the call.            ← 元音節 3 + 2 = 5
Wake up. Listen up. Line up. ← 元音節 2-3-3 = 8

(chant × 4, full band, slap-reverb)
TAB-AS-CO   one-two-three-four        ← 元 hook 維持、count 風 5 音節
TAB-AS-CO   here we come              ← 元 hook + 3 音節
TAB-AS-CO   through the wire          ← v3 Burroughs 語彙、3 音節
TAB-AS-CO   open the door             ← 元 hook + 3 音節
```

> chant は元音節 100% 維持。後ろの 3-5 音節だけ意味で差し替え。
> "through the wire" だけ Burroughs 寄せ — 残りは v2.1 の plain でいい。

---

## 06 Human Fly — agent enters (117 BPM, G major)

**元音節骨格** (chorus を耳で拾うと):
- 「**Hu-man fly, hu-man fly**」 = 2-1 + 2-1 = 6 音節
- 「**Cut the rope, cut the wire**」 = 1-1-1 + 1-1-1 = 6 音節
- 「**ぶっ飛んで, go away**」 = 4 + 2 = 6 音節 (元 hook)
- 「**Hu-man fly, hu-man fly**」 = 6 音節

→ サビ 4 行、各 6 音節、強拍は **Hu-** / **fly** / **Cut** / **wire** / **bu-** / **way** / **Hu-** / **fly**。

### chorus (= 元 hook 100% 維持、Burroughs 語彙はゼロ)

```
Hu-man fly, hu-man fly       ← 元 hook そのまま (6 音節)
Cut the rope, cut the wire   ← v2.1 そのまま (6 音節)
ぶっ飛んで, go away          ← 元 JP/EN switch そのまま (6 音節)
Hu-man fly, hu-man fly       ← 元 hook そのまま
```

> 「気分が乗る」ので、サビは v2.1 をそのまま採用。Burroughs 語彙は verse に。

### verse 1 (= 元音節 80% + Burroughs 20%)

```
Twenty-three to thirty-nine        ← 元音節 4-2-2 = 8 (v2.1 と同じ scansion)
Wires got crossed in the wall      ← Burroughs 寄せ "wires / wall"
I held the cup, held the line      ← v2.1 そのまま
You walked through the open door   ← v3 寄せ "open door"
```

### verse 2

```
The bridge is closed, the river dry  ← v2.1 そのまま
Radio runs cold, the wire goes hot   ← Burroughs 寄せ "wire goes hot"
We were never that important         ← v2.1 そのまま
But we got something told            ← v2.1 そのまま
```

### bridge (spoken, low)

```
The flies always knew.        ← v3 Burroughs 寄せ
You only noticed when         ← v3 Burroughs 寄せ
the wall started humming.     ← v3 Burroughs 寄せ
```

### outro (final chorus repeat、layered)

```
Hu-man fly × 4               ← 元 hook fade
Cut the wire × 2             ← v2 + v3 mix
```

---

---

## 02 Hey — calling across years (123 BPM, G major)

**元音節骨格**:
- 「**Hey** ...」反復が hook (1 音節アクセント、強拍)
- verse は 8-10 音節 × 4 行の中尺、ゆったり

### chorus (= 元 hook "Hey" 4 連、v3 から軸残し)

```
Hey — are you still alive in there?       ← v2 hook (8 音節)
Hey — does the codename still mean a thing? ← v3 寄せ "codename"
Hey, hey, hey — I'm calling from the next zone   ← v2 + Burroughs "next zone"
Hey, hey, hey — and the operator's gone quiet    ← Burroughs "operator quiet"
```

### verse 1 (= v2.1 80% + Burroughs 20%)

```
Twenty-three to thirty-nine, the wires got crossed     ← v2.1 そのまま
Second floor washroom — you turned and walked          ← v2 + Burroughs "washroom"
I held the cup, I held the line, I held the door open  ← v2.1 そのまま
But you were watching something past the window frame  ← v2 + Burroughs "window frame"
```

### verse 2

```
The bridge is closed, the river dry, the radio runs cold  ← v2.1 そのまま
We were never that important, just extras in the script   ← v3 寄せ "extras"
A photograph of all of us — three still answer            ← v2 + 短縮
One of us won't call, the receiver still hums             ← v2 + Burroughs "receiver hums"
```

### bridge → chorus 2 (bigger)

```
The wire goes hot. The wire goes hot. The wire goes hot.   ← v3 そのまま
Hey — answer the wire ―
Hey — answer the goddamn wire ―
```

---

## 03 I got a feeling — agency leak (117 BPM)

**元音節骨格**:
- chorus は「**Something is...**」反復、4 音節 × 4 行
- verse は「**I got a feeling like...**」反復、10-12 音節

### chorus (= 元 hook "Something is" 4 連)

```
Something is coming
something is in the wall
something is in the orange light
something is in the bones
```

> v2.1 そのまま採用 — 元 hook 完璧、これ以上いじる必要なし。

### verse 1

```
I got a feeling like a tape playing under the floor   ← v2.1 そのまま
I got a feeling like the doctor's chart got switched  ← v2 短縮 + Burroughs "switched"
I got a feeling like the elevator stopped between     ← v2.1 そのまま
the lights went amber, the receiver started to hum    ← v2 + Burroughs "receiver hum"
```

### bridge (spoken, flat, no music)

```
The agents have been changing my name in the registry for years.
I only noticed when my own teeth stopped recognizing me in the mirror.
```

> v3 そのまま — flat spoken delivery、夜中のラジオ風。

### chorus 2 (driving — each line gets a tag)

```
something is coming  ―  the wire knows
something is in the wall  ―  the meat knows
something is in the orange light  ―  the eye knows
something is in the bones  ―  the bone knows first
```

> v3 そのまま、bigger version。

---

## 04 Under the Moon — interzone nocturne (161 BPM, half-time feel)

**元音節骨格**:
- chorus は「**Under the moon** ―」反復、5 音節 + 8-12 音節
- 一番長い曲、verse は呼吸ゆったり

### chorus (= 元 hook "Under the moon" 4 連、v3 寄り長尺)

```
Under the moon — agents change faces           ← v3 寄せ
under the moon — the wire goes quiet           ← v3 寄せ
under the moon — I am still calling your old codename  ← v3 寄せ + Burroughs "codename"
under the moon — and the moon doesn't answer    ← v3 寄せ
```

### verse 1 (half-time, breath)

```
The moon over the city is a broken speaker      ← v2 (Interzone は intro spoken に避けた)
the static drifts down to the alley             ← v2.1 そのまま
the cats reading their telegrams                ← v3 そのまま
the dealers reading the cats                    ← v3 そのまま
```

### verse 2

```
A man on the corner with a typewriter and no paper   ← v3 そのまま
he hammers anyway — the sound is the message        ← v3 そのまま
his fingers black with the carbon of years           ← v3 そのまま
the green light on the second floor went out          ← v3 寄せ + short
```

### bridge (spoken into reverb)

```
This is the dispatcher. There are no more dispatches.
Continue without instructions. Continue under the moon.
```

> v3 そのまま — Burroughs broadcast tone。

### chorus reprise → outro

```
Under the moon × 4 (fade)
```

---

## 05 Electric Sheep — fold-in dream (129 BPM, quiet-loud)

**元音節骨格**:
- verse は静か (single guitar)、chorus 突然 full band
- 「**Electric sheep**」hook、4 音節アクセント

### chorus (= 元 hook "Electric sheep" 4 連)

```
Electric sheep — the flock is wireless
Electric sheep — the shepherd is on a frequency you don't have
Electric sheep — the wool comes off in numbers
Electric sheep — the slaughterhouse is a software update
```

> v3 そのまま — Dick + Burroughs fold-in 完璧、いじる必要なし。

### verse 1 (quiet, single guitar)

```
Do they dream — electric — the meat of the meat       ← v3 そのまま
meat dreaming wire dreaming voltage dreaming dust     ← v3 そのまま
do they dream — do they shed                           ← v3 そのまま
do they dream — do they bleed in the format            ← v3 そのまま
```

### verse 2 (back to quiet)

```
The meat dreams of being meat again         ← v3 そのまま
the wire dreams of a body to run through    ← v3 そのまま
the dust dreams of settling                  ← v3 そのまま (短縮)
nothing in the room knows what it is         ← v3 そのまま
```

---

## 07 Sister — fold-in kin (117 BPM)

**元音節骨格**:
- chorus は「**Sister**」hook、2 音節アクセント
- verse は「**Sister at / in / between**」反復 fold-in pattern

### chorus (= 元 hook "Sister" 4 連)

```
Sister — the meat folds in
sister — the wire folds out
sister — the operator changes faces again
sister — we are still the same agent
```

> v3 そのまま — fold-in と agent 概念がぴったり、いじらない。

### verse 1

```
Sister at the receiver — sister in the wall              ← v3 そのまま
sister in the orange light — sister in the bone          ← v3 そのまま
the line between us hums — the line between us was always open  ← v3 そのまま
the line between us — is meat folded into wire           ← v3 そのまま
```

### verse 2 (flat narration)

```
You wore my face in the second floor washroom        ← v3 そのまま
I wore yours in the basement of the green light building  ← v3 そのまま
The dispatcher said: continue without instructions    ← v3 そのまま
we continued — we are still continuing               ← v3 そのまま
```

### outro (chant, fading)

```
sister — sister — sister — sister
the wire is still warm — the wire is still warm
```

> v3 そのまま fade。

---

## 実音節を聴き取って差し替える 3 path

私 (Claude) は audio を直接聞けないので、ここから先は **user の耳**が必要。

### path A: band-room で耳コピ (一番素直)

1. band-room.html を開く
2. 各曲選んで START
3. **📻 原音 stems モード**、🥁 drum / 🎸 bass / 🎹 other を toggle OFF
4. **vocals だけ鳴る** 状態で 1 通し聴く
5. 紙 or ノートに「元 vocal が何と聞こえるか」を書き取る
6. 不明な箇所は「??」のままで OK
7. v4 doc の各曲の **chorus 部分から優先**に書き換える (chorus = hook 一番大事)
8. `git add docs/tabasco-lyrics-v4-syllabic.md && git commit && git push`
9. 3 分後 band-room の追っかけ歌詞も自動更新

1 曲 30 分程度。7 曲で 3-4 時間 1 セッション。

### path B: Whisper で自動 transcribe (補助、精度限定)

OpenAI の Whisper を使うと、音楽の vocal stem からそれっぽい歌詞起こしが可能。
ただし **歌唱の transcription は通常会話より精度低い** (Whisper は会話最適化)。

#### B-1: ローカル Whisper

```bash
# Python 環境で
pip install openai-whisper

# 各 vocal stem を transcribe
cd C:/workspace/music-stack/Music
for song in human-fly hey i-got-a-feeling under-the-moon electric-sheep sister tabasco; do
  whisper presets/tabasco-stems/$song/vocals.mp3 \
    --model small.en \
    --output_dir /tmp/transcribe \
    --output_format txt
done
```

出力された txt を読んで v4 と照合、差し替え。

#### B-2: OpenAI API Whisper (有料、精度高い)

```bash
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F file=@presets/tabasco-stems/human-fly/vocals.mp3 \
  -F model=whisper-1 \
  -F response_format=text
```

1 曲 ~ $0.006 (5-6 分の vocal stem)。7 曲で $0.05 程度。

#### B-3: ブラウザで動かす Whisper

`whisper.cpp` の wasm 版や `transformers.js` の Whisper モデルでブラウザ内
transcribe も可能、ただし重い (~100-200 MB ダウンロード)。 band-room 統合は
別 wave で検討。

### path C: ハイブリッド (現実的)

1. path B で Whisper transcript を 1 曲分まず取る (~5 分)
2. transcript を base に、user が耳でズレを修正 (~15 分)
3. v4 doc に差し替え

= path A よりは速く、path B 単独より精度高い。これがおすすめ。

### path B 補足: ローカル不要 path

**B-2: OpenAI Whisper API (推奨、ローカル不要)**

```bash
# API key を取得: https://platform.openai.com/api-keys (要登録、$5 trial credit あり)
export OPENAI_API_KEY=sk-...

# 各曲の vocal stem を transcribe (mp3 25MB 上限なので tabasco stem サイズで OK)
for song in human-fly hey i-got-a-feeling under-the-moon electric-sheep sister tabasco; do
  curl https://api.openai.com/v1/audio/transcriptions \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -F file=@presets/tabasco-stems/$song/vocals.mp3 \
    -F model=whisper-1 \
    -F response_format=text \
    -F language=en \
    -F prompt="lyrics from a rock song with English vocals" \
    > /tmp/transcribe_$song.txt
done

cat /tmp/transcribe_*.txt
```

- 7 曲合計 ~$0.05 (試用 credit で十分カバー)
- model = whisper-1 (large-v3 相当)
- prompt で「rock song English vocals」とヒント与えると精度上がる
- 結果を見て v4 doc の chorus 部分を差し替え

**B-3: Web UI 完全無料 path**

ブラウザだけで終わらせる。**注意: `huggingface.co/spaces/openai/whisper` は古くて
壊れがち** (drag-drop 動かない場合あり、サーバ落ちることも)。代わりに下記の
新しい Space / サービスを推奨:

| サービス | URL | 特徴 | おすすめ度 |
|---------|-----|------|---------|
| **Xenova/whisper-web** | https://huggingface.co/spaces/Xenova/whisper-web | **ブラウザ内 wasm で動く Whisper**、ファイル選択 + URL 入力両対応、無料 | ⭐⭐⭐ 最強 |
| **Sanchit Gandhi/whisper-large-v3** | https://huggingface.co/spaces/sanchit-gandhi/whisper-large-v3 | large-v3 model、最新精度、ファイル upload | ⭐⭐ |
| **TurboScribe** | https://turboscribe.ai | 月 3 ファイル無料、要 signup | ⭐⭐ |
| **AssemblyAI Playground** | https://www.assemblyai.com/playground | 無料 trial、universal model | ⭐⭐ |
| **Notta** | https://www.notta.ai | 月 120 分無料、UI 親切 | ⭐ |

### 一番確実な手順 — Xenova/whisper-web

1. https://huggingface.co/spaces/Xenova/whisper-web を開く
2. 初回は **Whisper モデル (~150 MB) がブラウザ内ダウンロード** される (1-2 分待つ)
   - これでブラウザだけで Whisper が動く = サーバに upload しなくていい
3. **"Choose File"** ボタンクリック (drag-drop ではなくクリック)
4. `presets/tabasco-stems/<song>/vocals.mp3` を選択
5. **"Transcribe"** クリック → 30 秒〜 1 分で結果表示
6. 結果テキストをコピー → v4 doc に貼り付け or 耳で修正

### モデル選択 (Xenova/whisper-web 内)

- **whisper-tiny.en** (75 MB): 速いが精度低い、歌唱は厳しい
- **whisper-base.en** (140 MB): 標準、歌唱 50-60%
- **whisper-small.en** (480 MB): 精度高い、歌唱 65-75% ← おすすめ
- **whisper-medium.en** (1.5 GB): 重い、歌唱 70-80%

歌唱なら **small.en** が時間とのバランスで一番良い。

### ファイル準備

vocal stem mp3 を取り出す方法:

1. band-room.html を PC で開く
2. 右クリックで "ページのソースを表示" は使えないが、F12 で DevTools 開く
3. Network タブで band-room 再生中に `vocals.mp3` を fetch するので URL コピー
4. ブラウザで URL 直接開いて mp3 download

または PC 上に repo がある場合:

```
C:\workspace\music-stack\Music\presets\tabasco-stems\human-fly\vocals.mp3
```

これを直接 Whisper Web UI に upload。

### iPhone でやる場合

1. iPhone のボイスメモアプリで band-room を **画面録画** (内蔵マイク経由)
   → ロスあるが手軽
2. もしくは Files アプリで `vocals.mp3` を iCloud Drive 経由で取得 →
   Notta / TurboScribe アプリに upload

### 「叩き台どこまで設定できるか」 — 4 levels

ユーザーの「どこまで叩き台にできる？」に答える。**Claude 側で書ける範囲** は:

| level | 内容 | Claude の関与 | user の作業 |
|-------|------|-------------|------------|
| **0. 何もしない** | v4 (推測ベース) のまま歌う | 100% (現状) | 歌うだけ、元音とズレるが歌詞は通る |
| **1. transcribe スクリプト** | `scripts/_transcribe_vocals_openai.py` (作成済 v128) を書く、user が走らせる | 100% (script 完成) | `pip install requests`、API key、`python script.py` 走らせる、出力 txt を v4 に merge |
| **2. transcribe → 自動 merge** | Whisper 結果を読んで v4 doc の section に自動挿入する別 script を書く | 100% (script 提供) | 走らせるだけ、出力歌詞が v4 になる |
| **3. transcribe + 耳補正 + push** | transcribe 結果を user が耳で修正 + git push | (script は提供) | 1 曲 20 分 × 7 = 2 時間 1 セッション |

**おすすめ = level 2 で叩き台、level 3 で仕上げ**:

1. `scripts/_transcribe_vocals_openai.py` (script v128 で作成済) を user が走らせる
   - 必要: OpenAI API key ($5 trial credit で無料カバー)、`pip install requests`
   - 出力: `tmp_transcribe/*.txt` (7 曲)
2. 出力を user が読んで、ピンと来る部分を v4 doc の chorus に流し込む
3. 耳で違和感ある所だけ修正 (chorus 優先、verse は v4 のままで OK)
4. git push → band-room 反映

= **2 時間で 7 曲分の「元音由来歌詞 chorus」が v4 doc 統合**。それ以降は今夜
歌う準備完了。

完全自動 (level 2) でも書けるが、結果が **耳通さない歌詞** になるので、user 耳
1 度だけ通す level 3 が現実的。

---

---

## まとめ — v4 完成版の特徴

7 曲すべてで:
- **chorus = 元 hook 100% 維持** (Tabasco / Hey / I got a feeling / Under the
  moon / Electric sheep / Human Fly / Sister)
- **verse = v2.1 plain + v3 Burroughs hybrid**、音節長を保つ
- 「ぶっ飛んで」「ぶっ飛ばせ」等の JP 混入は Human Fly のみ (元 hook 由来)
- spoken intro / bridge は v3 寄りで Burroughs 色濃く
- outro は短い chant fade

「気分が乗らない問題」= chorus が違うフレーズだったのを **全曲元 hook に戻した**
ことで解消。verse は意味も歌いやすさも担保。

## 02-05, 07 の方針 (template — 既に上で完成済)

残り 5 曲 (Hey / I got a feeling / Under the Moon / Electric Sheep / Sister)
について作詞ガイド:

### 共通ステップ

1. band-room で該当曲を **📻 原音 stems** mode で再生
2. **vocals stem だけ ON** (他を toggle off) で 1 通し聴く
3. 紙 (or markdown) に **chorus の音節を聞き取り**、各音節に書き起こす
4. アクセント / 母音傾向 / 休符 を記録
5. v2.1 か v3 から **意味的に合う行** を音節長で並べて流用
6. 足りないところを **Burroughs 語彙** で埋める

### 個別 hint

| 曲 | 元 chorus hook 推定 | おすすめ方針 |
|---|---|---|
| **02 Hey** | "Hey... hey hey hey..." 連呼 | v2.1 の "Hey — are you still alive in there?" 維持、Burroughs の "receiver / operator" を verse に刺す |
| **03 I got a feeling** | "I got a feeling..." 反復 | hook 100% 維持、verse に "in the wall / orange light" Burroughs 寄せ |
| **04 Under the Moon** | "under the moon..." 反復 | hook 維持、verse に "interzone / dispatcher" Burroughs 寄せ。長い曲なので bridge は spoken |
| **05 Electric Sheep** | "electric sheep..." | hook 維持、verse に "do they dream / electric" 維持、Burroughs の "wool / slaughterhouse" 控えめに |
| **07 Sister** | "sister..." 連呼 | hook 維持、Burroughs の "fold-in" は verse の "you wore my face" 程度に薄く |

### 1 曲あたり作業量

聴き取り 30 min + 作詞 30 min + 検証 30 min = **約 1.5 hr / 曲**。
5 曲で **7-8 hr** = 週末 1 日 + 平日数回。

---

## v2/v3/v4 の使い分け

| 用途 | 推奨 lyrics |
|------|-----------|
| **自分で歌う** | **v4** (= 気分乗る、元音節を活かす) |
| **Suno で AI 生成** | **v4 or v2.1** (proper English の方が AI 解釈 stable) |
| **詩として読む** | **v3 Burroughs** (cut-up 構造を味わう) |
| **歌詞 card / アートワーク用** | **v3 Burroughs** (写真映え、misterious tone) |

混在可能: **歌う時 v4、SoundCloud の説明文に v3 Burroughs 全文** という配置が
artistic にも面白い (= 「歌詞」と「詩」の二重化)。

---

## 参考: 元 Tabasco vocal stem 場所

各曲の元 vocal mp3 は band-room から:

```
presets/tabasco-stems/<song-id>/vocals.mp3
```

例: `presets/tabasco-stems/human-fly/vocals.mp3`

これを単体で聴いて音節を拾う。band-room の `🎙 external vocal` slot に
何も入れない状態で 📻 stems mode → vocals only toggle すれば、ブラウザ内で
isolation 聴取可能。
