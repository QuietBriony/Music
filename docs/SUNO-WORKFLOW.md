# Suno Workflow — Tabasco の歌詞を AI に歌わせる手順

> ユーザー質問: 「今の歌詞は Suno にどう上げたらそれっぽく聞こえるの？
> プランによっては、声質もトレースできるの？元のボーカル音程に合わせて、
> 歌詞もそれっぽくつける感じ？」
>
> 全部答える。Suno は 2026 時点で最も実用的な AI 歌唱生成。Tabasco の歌詞
> v2.1 / v3 / v4 を AI vocal にして、band-room の `🎙 external vocal` slot
> に drop = 自分で歌わなくても作品化可能。

---

## 1. プラン比較 (2026 春時点、変動するので公式確認推奨)

| plan | 月額 | crops | persona | voice clone | cover | おすすめ用途 |
|------|------|-------|---------|-------------|-------|----|
| **Free** | $0 | 50 credits / day (10 曲程度) | × | × | △ (限定) | お試し / 1 曲 1 回 |
| **Pro** | **$10** | 2,500 credits / month (~500 曲) | ✅ | △ (instant clone limited) | ✅ | **Tabasco 7 曲制作には最適** |
| **Premier** | $30 | 10,000 credits / month | ✅ | ✅ (full clone) | ✅ | プロ用途 / 多バリエ |

**推奨**: **Pro $10/mo を 1-2 ヶ月**。Tabasco 7 曲を様々な version で試して、気に
入った master を 7 個確保。終わったら downgrade。

---

## 2. 4 つのアプローチ

### A. **Custom Mode + Style Prompt** (基本、最も自由)

Suno の "Create" → "Custom" タブ:

- **Lyrics** 欄: v4 (or v2.1 / v3) の歌詞を貼る — section tag (`[verse]`,
  `[chorus]`, `[bridge]`, `[outro]`) を必ず明記すると AI が構造把握する
- **Style of Music** 欄: ジャンル + 質感 + 楽器 を短文で
  - 例 (Human Fly): `mid-tempo rock, mixture punk meets LCD Soundsystem,
    drive guitar, four-on-floor drum, male vocal raspy, reverb-soaked`
- **Title** 欄: 曲名 (例: "Human Fly")

生成 → 3 分待つ → 2 つの version 出てくる → 気に入った方を keep。

**注意**:
- アーティスト名は使えない (Cramps / LCD Soundsystem 等の固有名は filter される)
- 代わりに **音楽的特徴を文章で**: 「mixture punk」「motorik four-on-floor」
  「reverb-soaked male vocal」みたいに

### B. **Cover Mode** (元音に近づける、Pro 必須)

Suno の "Cover" 機能。**元の Tabasco mp3 を input、別歌詞 + 別 voice で再生成**:

1. band-room から `presets/tabasco-stems/<song>/vocals.mp3` (or 元 mix mp3)
   を download
2. Suno の "Cover" → input にアップロード
3. 別歌詞 (v4) を貼る
4. 別 voice style を指定 (e.g. "raspy female alt-rock")
5. 生成 → 元の **テンポ / 構造 / コード進行** はそのまま、vocal だけ AI に置換

**メリット**: 元の Tabasco 演奏に忠実なまま、vocal だけ新しい。
**デメリット**: 元 mp3 を input する必要 (= 自分の素材の場合 OK、他人のは NG)。

### C. **Persona** (Pro 必須、声の連続性)

最初の 1 曲を Custom Mode で生成 → 気に入った vocal style → **"Save as Persona"**
で記憶。

その後の曲生成で **同じ Persona を選択** → 全 7 曲が同じ声 / 同じスタイルで
鳴る = **album として統一感**。

**Tabasco album 制作のキモ**: 1 曲目で Persona 作る → 残り 6 曲は同 Persona で
連発生成。これで「同じバンドが演奏してる album」になる。

### D. **Voice Clone** (Premier 必須、自分の声をモデル化)

自分の声を 1 分程度の sample (録音 / 録音ファイル) として upload → AI が学習
→ 自分の声で AI 歌唱生成可能。

**Tabasco 全曲を自分の声で歌わせる** が完成。ただ、Premier プラン必要。

---

## 3. 「元のボーカル音程に合わせる」具体 path

ユーザーの「**元のボーカル音程に合わせて歌詞もそれっぽく付ける**」は **Cover
Mode** のことに近い。

### Cover Mode の流れ

1. **元 Tabasco mp3 を抽出**:
   - band-room の 📦 stems pack export で 4 stem 全部出す
   - DAW で 4 stem 重ねて 1 つの mix mp3 にする
   - or 元の Tabasco LIVE mp3 が手元にあればそれを使う

2. **Suno に upload**: "Cover" → mp3 input

3. **歌詞貼る**: v4 (= 元音節リズム保持版) が一番ハマる、v2.1 も OK

4. **style prompt**: 元 voice の特徴を記述
   - 例: "drive male vocal, slightly distorted, mid-90s alt-rock energy"

5. **生成**: 元のメロ進行を AI が解析、新しい voice + 新しい歌詞で再現

**おまけ**: Cover Mode の出力は **元の coral progression / tempo に強く縛られる**
ので、コード進行のミスを避けたい時もこれが安心。

---

## 4. Style Prompt 7 曲分テンプレ (v4 歌詞前提)

各曲 Suno 用 prompt 案:

### 01 TABASCO (chant manifesto)

```
mid-tempo punk rock chant, 136 bpm, slap-back reverb male vocal
shouting in unison group, four-on-floor drum with crash on every chorus,
mixture punk meets late 80s Tokyo alternative
```

### 02 Hey (calling across years)

```
mid-tempo pop rock with LCD Soundsystem energy, 123 bpm,
emotional male lead vocal, cowbell groove, big chorus harmonies,
reverb-soaked verse vocal calling
```

### 03 I got a feeling (premonition)

```
slow burn alt-rock with rising tension, 117 bpm,
half-whispered verse male vocal, soaring chorus, builds from quiet to loud
```

### 04 Under the Moon (interzone night)

```
slow tempo dark indie rock, 161 bpm (half-time feel), male baritone vocal,
spoken bridge, long form 5-minute structure, late-night urban feel
```

### 05 Electric Sheep (android dream)

```
mid-tempo indie with quiet-loud dynamics, 129 bpm, breathy verse vocal
exploding into distorted chorus, Pink Floyd Wish You Were Here flavor
meets early Radiohead OK Computer
```

### 06 Human Fly (agent enters)

```
fast mixture punk rock, 117 bpm, raspy male vocal,
distorted drive guitar, four-on-floor drum, Cramps energy meets Backdrop Bomb,
Japanese 90s hard alternative
```

### 07 Sister (fold-in kin)

```
mid-tempo melodic alt-rock, 117 bpm, female lead vocal layered with male
harmony, intimate close-mic'd quality, gentle but driven
```

---

## 5. workflow (Pro plan で 7 曲制作)

### day 1 (1-2 hr)

- Suno Pro 加入 $10
- v4 歌詞を 1 曲 (Human Fly 推奨、user 好きな曲) で **Custom Mode** に投入
- style prompt 試す、3-4 回 generate して気に入った version 選ぶ
- **"Save as Persona"** で記録 (名前: "air rock connect box")

### day 2 (2-3 hr)

- 残り 6 曲を **同 Persona** で順次生成
- 各曲 2-3 version 生成して keep 1 つずつ
- 全 7 曲分の mp3 download

### day 3 (2-3 hr)

- band-room を開く
- 各曲を選んで `🎙 external vocal` slot に AI 生成 mp3 を drop
- 元 stem の vocals を toggle off
- 通しで聴いて違和感確認

### day 4-7 (DAW で magic)

- band-room の `📦 stems pack export` で 4 stem 別 webm
- DAW (Ableton / Logic / Reaper) で AI vocal を中心に再構成
- master bounce → 各曲 wav / mp3

### day 8 (公開)

- SoundCloud / Bandcamp upload
- アートワーク 1 枚作成
- 曲タイトル / 歌詞 / クレジット記載

= **1 週間で album 完成**。

---

## 6. 声質トレースの限界と注意

### できること

- **Pro Persona**: 1 曲目で気に入った voice style を 6 曲に保つ
- **Premier Voice Clone**: 自分の声をモデル化、自分の声で AI 歌唱

### できないこと

- **特定アーティスト (Cramps 等) の声 clone**: filter で reject
- **元 Tabasco vocal の声 1:1 clone**: 元 vocal の cleaned-up sample 必要、
  品質次第。Premier で試せるが「**それっぽい**」止まり

### 「元音程に乗せる」精度

- **Cover Mode** が一番近い。コード / テンポ / 構造はほぼ保持される
- ただし AI が **歌詞のシラブル割り当てを自分で決める** ので、v4 で
  音節合わせても出力が変わることはある
- 何回か generate して気に入ったのを選ぶ作業が必要

---

## 7. 推奨ワークフロー (まとめ)

```
1. final 歌詞を歌って微修正
   → docs/tabasco-lyrics-final.md
2. Suno Pro 加入 $10
3. day 1: Persona 作成 (Human Fly 1 曲試す)
4. day 2: 残り 6 曲生成
5. day 3-4: band-room で組み立て確認
6. day 5-7: DAW で本気 mix
7. day 8: SoundCloud / Bandcamp 公開
```

合計: **2 週間で Tabasco album 完成**。

詳細は [PRODUCTION-PATH.md](./PRODUCTION-PATH.md) も参照。

---

## 8. 参考: Suno 公式情報

- https://suno.com — メインサービス
- https://suno.com/about/pricing — プラン比較 (公式が変動するのでここで確認)
- https://help.suno.com — FAQ / Cover Mode / Persona / Clone の説明

(直接 URL なので変動可能性あり、迷ったら google で `suno custom mode lyrics
prompt` 等で検索)

---

## 9. ローカル / OSS の代替 — ACE-Step

クラウドを使わず手元の GPU/Mac で同じこと（歌入り生成・cover・声の統一）をしたい場合は
**ACE-Step**（OSS・無料・素材を外部にアップロードしない・数曲から LoRA 学習）。
このページの prompt テンプレ・workflow はそのまま流用できる。
→ [ACE-STEP-WORKFLOW.md](./ACE-STEP-WORKFLOW.md)
