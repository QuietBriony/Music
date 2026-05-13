# Tabasco — Lyric v4 (元音節リズム保持版)

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

## 02-05, 07 の方針 (template)

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
