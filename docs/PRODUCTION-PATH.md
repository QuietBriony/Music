# Production Path — band-room + Hazama FM を「作品」にする道筋

> 機能磨き (= "system を完成させる") とは直交した **「作品を世に出す」**
> ための work item 集。技術ではなく **録音 / 歌い直し / mix / 公開** に
> 時間を使うフェーズ。
>
> 全部、現スコープ内 (band-room v118 / Hazama FM v118) の既存機能で完結する。
> 新規実装は不要。

---

## 0. 大前提

このスタックは「**演奏装置 + 制作スタジオ + 配信プラットフォームの三位一体**」
が既に揃ってる:

- **演奏装置** = band-room (Tabasco 練習・カバー・jam)
- **制作スタジオ** = band-room + Hazama FM の REC / stems export / external upload
- **配信プラットフォーム** = GitHub Pages (PWA install + offline 再生)

不足してるのは **「中身」**: あなた自身の演奏・歌・選曲を取り込むこと。

---

## 1. 作品 path A — Tabasco を本気で完成版にする

### ステップ

1. **歌詞を選ぶ**
   - primary: `docs/tabasco-lyrics-final.md`
   - Band Room 本体もこの 1 本を表示する

2. **vocal を 7 曲分用意**
   - 自分で歌い直し (UR44 + マイクで具体的手順): [RECORDING-WORKFLOW.md](./RECORDING-WORKFLOW.md)
   - Suno で AI 生成: 各曲の歌詞 + style prompt を Suno に投げて mp3 受け取り
   - 詳細: [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) / [VOCAL-REGENERATION-PATH.md](./VOCAL-REGENERATION-PATH.md)

3. **band-room で組み立てて確認**
   - 各曲開いて `🎙 external vocal` に drop
   - 元 stem の vocal を toggle off
   - 全 7 曲 通しで違和感ないか確認

4. **(オプション) 他パートも取り直し**
   - 自分の楽器 (drum / bass / guitar) があれば DAW で録って `🥁🎸🎹 external stems` に drop
   - 完全 self-cover が完成

5. **stems pack export で DAW へ**
   - `📦 stems pack export` で 4 stem 別々の webm に
   - ffmpeg で wav に変換
   - DAW (Ableton / Logic / Reaper) で本気 mix
   - master bounce → mp3 (320 kbps) or wav (24bit/48kHz)

6. **公開**
   - SoundCloud に upload (各曲別 track、Album として束ねる)
   - Bandcamp ならアートワーク + lyrics + 価格 (Pay-What-You-Want も可)
   - YouTube は静止画 video で OK

### 期待 output

- **Tabasco Re-Vival** Album / 7 tracks / 30-40 min
- アーティスト名 (例: air rock connect box)
- アートワーク (1 枚で OK、Burroughs interzone night)
- リスナー: 自分 + 友人 + 偶然見つけた人

---

## 2. 作品 path B — Hazama FM の lofi set を 30 min 録音

### ステップ

1. **Hazama FM 開く** (`fm.html`)
2. lofi mode で起動 (energy 40 デフォルト = 自動 lofi)
3. **REC ボタン押す**、放置
4. 30 min 後 **STOP REC**
5. webm download → ffmpeg で wav に
6. (オプション) DAW で intro / outro / fadeout だけ手入れ
7. SoundCloud に upload (BGM / focus music タグ)

### 期待 output

- **air rock connect box - "interzone night" — 30 min lofi set**
- リスナー: 作業 BGM 探してる人、カフェ用 BGM
- 30 min の中で Salamander piano が自然に walking して、breakbeat が boom-bap で続く

これを **月 1 本** ペースで release すると、3 ヶ月で album 形式に。

---

## 3. 作品 path C — Music Core Rig で素材作って Tabasco に重ねる

### ステップ

1. **Music Core Rig 開く** (`index.html`)
2. AUTO MIX OFF、9 フェーダー手動で気持ちいい音色作る
3. **REC ボタン**で気持ちいい部分を録音
4. webm → wav
5. **band-room の `🥁🎸🎹 external stems` に drop**
6. 元 stem の対応 voice を toggle off
7. = Music Core Rig の素材が Tabasco 曲構造に乗る ハイブリッド曲

### 期待 output

- 「**Tabasco × Music Core Rig**」シリーズ
- 各曲で Music Core Rig 素材の混入率を変えると同じ曲が違う表情に
- 1 曲を 5 つのバージョンで release できる (original / Music-Rig-drums / Music-Rig-pad / heavy-mix / clean)

---

## 4. 配信 platform 比較

| platform | 強み | 制限 | 推奨ケース |
|---------|------|------|----------|
| **SoundCloud** | Free tier、Reposts でバズ可能 | Free は 3h まで、free → Pro $99/yr で無制限 | Hazama FM lofi set 30min × 多数 |
| **Bandcamp** | 有料配信、アートワーク + lyrics + 物販 | 15% 手数料 (PWYW 多い) | Tabasco album、PWYW スタイル |
| **YouTube Music** | 一番リスナー多い | 1 ファイル 1 trackで動画化必要 | アートワーク動画 + 全曲 |
| **PWA としての band-room** | 自分の domain で完全制御、リスナーが install できる | SoundCloud 程の発見性なし | コア・ファン用 + 作品の最終形態 |

**4 つ全部** に同じ master を上げるのが普通。SoundCloud は告知 / 試聴、Bandcamp は購入、YouTube は再生数狙い、PWA は自分の家。

---

## 5. アートワーク / メタデータ

作品化の最低限:

- **アートワーク**: 1500×1500 jpg 1 枚 (各 platform 要件満たす)
- **曲名 / アーティスト名**: 統一 (例: air rock connect box - "Human Fly")
- **歌詞**: lyrics ファイル (Tabasco lyrics-draft / lyrics-burroughs から)
- **クレジット**: 「all songs by ... / vocals by ... / mixed in band-room (https://quietbriony.github.io/Music/band-room.html)」

---

## 6. 月次リリース schedule 例

| 月 | release |
|----|---------|
| 1 | Hazama FM lofi 30 min set #1 (SoundCloud) |
| 2 | Tabasco 1 曲 (Human Fly) self-cover (Bandcamp PWYW) |
| 3 | Hazama FM lofi #2 |
| 4 | Tabasco 2 曲目 (Hey) |
| 5 | Hazama FM lofi #3 |
| 6 | Tabasco 3 曲目 |
| 7 | Music Core Rig × Tabasco ハイブリッド #1 |
| ... | ... |

3-6 ヶ月で **小さなアーティスト activity** ができてる状態。

---

## 7. 「磨く」を続ける場合の優先度

技術側を引き続き磨きたいなら、ROI 順:

### 🟢 現スコープ内 (Tone.js + CDN sampler)

1. **multi-velocity sampler** (Salamander v3 の forte/mezzo/piano 3 layer を Tone.Players で手動 dispatch) — 中規模
2. **swing factor** (Tone.Transport.swing は既に UCM で動いてる、band-room にも露出する) — 小規模
3. **ghost-note variation** (drum events で 16th の hi-hat openness を変化させる) — 小規模
4. **AI 生成パターン** (Magenta.js DrumsRNN を band-room の auto-fill に統合) — 中-大規模
5. **Music Core Rig catalog 経由化** (engine.js が catalog.json 参照) — 中規模、整合性大

### 🟡 スコープ拡張

6. **WAM 2.0 host 実装** — 大規模 R&D
7. **Web Bluetooth で MIDI コントローラー** (Push, Launchpad) — 中規模
8. **Magenta MusicTransformer** for full song generation — 大規模

### 🔴 スコープ超え

9. **Electron で Ableton Link** — domain 変わる
10. **サーバ側 MusicGen / Stable Audio API** — クラウド前提
11. **多人数 jam session** (WebRTC) — protocol 設計から

---

## 8. 推奨

3 つから 1 つ選ぶ:

| 選択 | 推奨ケース |
|------|----------|
| **作品 path A** (Tabasco album) | 自分の楽曲がある、歌える、SNS で出したい |
| **作品 path B** (Hazama FM lofi set) | 作業 BGM 提供したい、月 1 リリース習慣付けたい |
| **磨き続ける** (multi-velocity / WAM 等) | システムそのものを完成させたい、技術が楽しい |

どれも矛盾しない。**作品 path A or B を月 1 でやりながら、空き時間に磨く** が現実的。

---

## 8.5. 歌詞をどう書き換えて、どこにアップするか

現在の正本は `docs/tabasco-lyrics-final.md`。Band Room 本体もこの 1 本だけ表示する。
歌ってみて息継ぎや syllable が重い箇所を直す時は、この final sheet を編集する。

### a) GitHub repo に push (band-room の正本にする)

```bash
cd C:/workspace/music-stack/Music
# テキストエディタで docs/tabasco-lyrics-final.md を開いて編集
git add docs/tabasco-lyrics-final.md
git commit -m "lyrics: polish Tabasco final sheet"
git push
```

3-5 分待つと Pages が auto-deploy、band-room.html の footer の
**final singable** リンクから誰でも見える。Service Worker も自動更新。

### b) Suno に貼る (AI 歌唱用)

そのまま、加工なしでコピペ OK。Suno の Custom Mode の Lyrics 欄に貼り付け。
**`[verse 1]` `[chorus]` 等の section tag を Suno が理解する** ので、
final sheet の section header はそのまま活きる。

style prompt は [SUNO-WORKFLOW.md](./SUNO-WORKFLOW.md) のテンプレ参照。

### c) SoundCloud / Bandcamp の lyrics 欄

公開時の description / lyrics 欄にコピペ。**markdown は除去推奨**:
- `[verse 1]` 等の section tag は残す
- `---` 区切り線は除去
- `>` 引用ブロックの `>` は外す
- 太字 `**...**` は普通のテキストに

エディタで find-and-replace すれば 5 分で plaintext 化できる。

### final sheet のどこに書くか具体例

`docs/tabasco-lyrics-final.md` の該当曲 section を直接磨く:

```markdown
## 02 Hey - calling across years

### chorus-1

Hey, are you still alive in there?
Hey, did you find another name?

### verse-1

(verse 1 の歌詞を磨く)

### verse-2

(verse 2 の歌詞を磨く)
```

各曲 20-40 分ペースで歌って直す。週末 1 回で全曲の息継ぎ確認まで行ける。

---

## 9. 次に手を動かすなら

最も具体的で時間配分も読める:

```
今夜 (1-2 時間):
  - band-room の Tabasco 1 曲を開く
  - 歌詞を選ぶ (v2 or v3)
  - 自分で歌うか Suno で生成、wav 取得

明日:
  - external vocal slot に drop、元 vocal toggle off
  - band-room で通しで聴いて違和感確認
  - stems pack export

週末:
  - DAW で mix master
  - SoundCloud / Bandcamp upload

→ 1 週間で 1 曲完成、リスナーが居る状態に
```

これが **作品化の最小サイクル**。3 ヶ月で 7 曲。
